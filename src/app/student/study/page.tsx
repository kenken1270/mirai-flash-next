'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { updatePlan, type PlanRow } from '@/lib/student'

type Resource = { video_url: string; explanation: string; hint_text: string }

function StudyHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get('taskId')
  
  const [task, setTask] = useState<PlanRow | null>(null)
  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'menu' | 'video' | 'article'>('menu')

  // タイマー用
  const [seconds, setSeconds] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!taskId) return
      // 1. 今日のタスクを取得
      const { data: taskData } = await supabase.from('plans').select('*').eq('id', taskId).single()
      
      if (taskData) {
        setTask(taskData)
        
        // 2. 教材マスター(learning_resources)から、教材名とページ数が一致するものを自動検索
        // plansの mid_plan(教材名) と page_range(ページ) をキーにする
        const { data: resData } = await supabase
          .from('learning_resources')
          .select('video_url, explanation, hint_text')
          .eq('material_name', taskData.mid_plan)
          .eq('page_no', taskData.page_range)
          .single()
        
        if (resData) {
          setResource(resData)
        } else if (taskData.video_url) {
          // タスクに直接動画URLがある場合のフォールバック
          setResource({ video_url: taskData.video_url, explanation: '', hint_text: '' })
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [taskId])

  // タイマーのカウント
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isActive])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60); const s = sec % 60
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  const handleComplete = async () => {
    if (!task) return
    const actualMin = Math.ceil(seconds / 60)
    await updatePlan(task.id, { is_done: 1, actual_minutes: actualMin })
    alert(`🎉 クエストクリア！\n予想: ${task.planned_minutes}分 / 実際: ${actualMin}分\nしっかり自分を調整できたね！`)
    router.push('/student')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] animate-pulse text-yellow-600 font-bold">🐕 教材をひらいているよ...</div>
  if (!task) return <div className="p-10 text-center">タスクが見つかりませんでした</div>

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col font-sans text-gray-800 pb-24">
      {/* ヘッダー */}
      <div className="bg-yellow-400 p-6 shadow-sm sticky top-0 z-10 flex justify-between items-center text-gray-900">
        <button onClick={() => activeTab === 'menu' ? router.back() : setActiveTab('menu')} className="font-bold text-sm">
          {activeTab === 'menu' ? '← もどる' : '← メニュー'}
        </button>
        <div className="bg-gray-900 text-yellow-400 px-4 py-1 rounded-full font-mono font-black text-xl shadow-lg">
          {formatTime(seconds)}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="px-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{task.mid_plan} {task.page_range}</p>
          <h1 className="text-xl font-black">{task.task_name}</h1>
        </div>

        {activeTab === 'menu' && (
          <div className="space-y-4 animate-in fade-in">
            {resource?.hint_text && (
              <div className="bg-white p-4 rounded-3xl border-2 border-yellow-200 text-sm italic text-gray-600 shadow-sm flex gap-3">
                <span className="text-xl">🐕</span>
                <p>{resource.hint_text}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setActiveTab('video')} 
                className={`w-full p-5 rounded-3xl border-2 flex items-center gap-4 transition active:scale-95 ${resource?.video_url ? 'bg-white border-red-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                <span className="text-3xl">📺</span>
                <div className="text-left">
                  <p className="font-black text-sm">解説動画をみる</p>
                  {!resource?.video_url && <p className="text-[9px] text-gray-400">（このページは動画なし）</p>}
                </div>
              </button>

              <button onClick={() => setActiveTab('article')} 
                className="w-full bg-white p-5 rounded-3xl border-2 border-blue-100 shadow-sm flex items-center gap-4 active:scale-95 transition">
                <span className="text-3xl">📖</span>
                <div className="text-left"><p className="font-black text-sm">解き方のヒント</p></div>
              </button>

              <button onClick={() => router.push('/flash')} 
                className="w-full bg-white p-5 rounded-3xl border-2 border-orange-100 shadow-sm flex items-center gap-4 active:scale-95 transition">
                <span className="text-3xl">🃏</span>
                <div className="text-left"><p className="font-black text-sm">関連する単語を特訓</p></div>
              </button>
            </div>

            <button onClick={() => setIsActive(!isActive)} className={`w-full py-5 rounded-[2rem] font-black shadow-lg transition-all active:scale-95 ${isActive ? 'bg-orange-100 text-orange-600' : 'bg-indigo-600 text-white'}`}>
              {isActive ? '⏸ タイマーを止める' : '▶︎ 今すぐ集中を開始！'}
            </button>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <div className="aspect-video w-full bg-black rounded-3xl overflow-hidden shadow-2xl">
              {resource?.video_url ? (
                <iframe src={resource.video_url.replace('watch?v=', 'embed/')} className="w-full h-full" allowFullScreen></iframe>
              ) : <div className="text-white p-10 text-center font-bold">動画準備中...🐕</div>}
            </div>
            <p className="text-center text-gray-400 text-xs font-bold">動画を見終わったらメニューに戻って集中しよう！</p>
          </div>
        )}

        {activeTab === 'article' && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-blue-50 space-y-4 animate-in slide-in-from-bottom-4">
            <h2 className="font-black text-lg text-blue-600 flex items-center gap-2">📝 攻略ポイント</h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
              {resource?.explanation || 'このページの解説はまだ登録されていないよ。\n自力でチャレンジしてみよう！🐕'}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-20">
        <button onClick={handleComplete} className="w-full py-4 bg-green-500 text-white rounded-2xl font-black shadow-xl active:scale-95 transition">
          ✅ 勉強を完了して報告！
        </button>
      </div>
    </div>
  )
}

export default function StudyHubPage() {
  return <Suspense><StudyHubContent /></Suspense>
}