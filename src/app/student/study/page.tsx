'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { updatePlan, type PlanRow } from '@/lib/student'

type Resource = { video_url: string; explanation: string; hint_text: string; resource_type: string }

function StudyHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get('taskId')
  
  const [task, setTask] = useState<PlanRow | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'menu' | 'video' | 'article'>('menu')

  const [seconds, setSeconds] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!taskId) return
      const { data: taskData } = await supabase.from('plans').select('*').eq('id', taskId).single()
      if (taskData) {
        setTask(taskData)
        // 教材名が一致する全リソース（ページ解説 or 共通基礎）を一度に取得
        const { data: resData } = await supabase.from('learning_resources')
          .select('*')
          .eq('material_name', taskData.mid_plan)
          .or(`page_no.eq.${taskData.page_range},resource_type.eq.common`)
        
        if (resData) setResources(resData)
      }
      setLoading(false)
    }
    fetchData()
  }, [taskId])

  useEffect(() => {
    if (isActive) { timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000) }
    else { if (timerRef.current) clearInterval(timerRef.current) }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isActive])

  const handleComplete = async () => {
    if (!task) return
    await updatePlan(task.id, { is_done: 1, actual_minutes: Math.ceil(seconds / 60) })
    router.push('/student')
  }

  if (loading) return <div className="p-10 text-center animate-pulse text-yellow-600 font-bold">🐕 準備中...</div>
  if (!task) return <div className="p-10 text-center text-gray-400">タスクがありません</div>

  // コンテンツの分類
  const videoResource = resources.find(r => r.resource_type === 'page' && r.video_url)
  const pageExplanation = resources.find(r => r.resource_type === 'page')?.explanation
  const commonExplanations = resources.filter(r => r.resource_type === 'common')
  const hintText = resources.find(r => r.resource_type === 'page')?.hint_text

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col font-sans text-gray-800 pb-24">
      {/* ヘッダー（タイマー） */}
      <div className="bg-yellow-400 p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center text-gray-900 border-b border-yellow-500">
        <button onClick={() => activeTab === 'menu' ? router.back() : setActiveTab('menu')} className="font-bold text-xs">
          {activeTab === 'menu' ? '← もどる' : '← メニュー'}
        </button>
        <div className="bg-gray-900 text-yellow-400 px-4 py-1.5 rounded-2xl font-mono font-black text-2xl shadow-xl border-2 border-gray-800">
          {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="px-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{task.mid_plan}</p>
          <h1 className="text-lg font-black">{task.task_name}</h1>
        </div>

        <button onClick={() => setIsActive(!isActive)} className={`w-full py-5 rounded-[2rem] font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${isActive ? 'bg-orange-100 text-orange-600 border-2 border-orange-200' : 'bg-indigo-600 text-white border-2 border-indigo-700'}`}>
          {isActive ? '⏸ タイマー停止' : '▶︎ 集中を開始！'}
        </button>

        {activeTab === 'menu' && (
          <div className="space-y-4 animate-in fade-in">
            {hintText && (
              <div className="bg-white p-4 rounded-3xl border-2 border-yellow-200 text-sm italic text-gray-600 shadow-sm flex gap-3 items-center">
                <span className="text-2xl">🐕</span><p className="font-bold">{hintText}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setActiveTab('video')} className={`w-full p-5 rounded-3xl border-2 flex items-center gap-4 transition active:scale-95 ${videoResource ? 'bg-white border-red-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                <span className="text-3xl">📺</span><div className="text-left"><p className="font-black text-sm">解説動画をみる</p></div>
              </button>
              <button onClick={() => setActiveTab('article')} className="w-full bg-white p-5 rounded-3xl border-2 border-blue-100 shadow-sm flex items-center gap-4 active:scale-95 transition">
                <span className="text-3xl">📖</span><div className="text-left"><p className="font-black text-sm">解き方のヒントを確認</p></div>
              </button>
              <button onClick={() => router.push('/flash')} className="w-full bg-white p-5 rounded-3xl border-2 border-orange-100 shadow-sm flex items-center gap-4 active:scale-95 transition">
                <span className="text-3xl">🃏</span><div className="text-left"><p className="font-black text-sm">単語を特訓</p></div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="aspect-video w-full bg-black rounded-3xl overflow-hidden shadow-2xl animate-in fade-in">
            {videoResource?.video_url ? <iframe src={videoResource.video_url.replace('watch?v=', 'embed/')} className="w-full h-full" allowFullScreen></iframe> : <div className="text-white p-10 text-center font-bold">動画準備中...🐕</div>}
          </div>
        )}

        {activeTab === 'article' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            {/* 今日のページ解説 */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-blue-50 space-y-2">
              <h2 className="font-black text-sm text-blue-600 uppercase tracking-widest">📝 今日のポイント</h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{pageExplanation || '今日のページに特別なヒントはないよ。自力でチャレンジ！'}</div>
            </div>
            
            {/* 共通基礎知識（あれば表示） */}
            {commonExplanations.map(res => (
              <div key={res.video_url} className="bg-indigo-900 text-white p-6 rounded-[2.5rem] shadow-xl border-4 border-yellow-400 space-y-2">
                <h2 className="font-black text-sm text-yellow-400 uppercase tracking-widest">🛡️ ずっと役立つ基礎知識</h2>
                <div className="leading-relaxed whitespace-pre-wrap text-sm opacity-90">{res.explanation}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-20">
        <button onClick={handleComplete} className="w-full py-4 bg-green-500 text-white rounded-2xl font-black shadow-xl active:scale-95 transition">✅ 勉強を完了して報告！</button>
      </div>
    </div>
  )
}

export default function StudyHubPage() {
  return <Suspense><StudyHubContent /></Suspense>
}