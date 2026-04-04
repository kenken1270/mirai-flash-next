'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { updatePlan, type PlanRow } from '@/lib/student'

function StudyHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get('taskId')
  
  const [task, setTask] = useState<PlanRow | null>(null)
  const [loading, setLoading] = useState(true)

  // タイマー用ステート
  const [seconds, setSeconds] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchTask() {
      if (!taskId) return
      const { data } = await supabase.from('plans').select('*').eq('id', taskId).single()
      if (data) setTask(data)
      setLoading(false)
    }
    fetchTask()
  }, [taskId])

  // タイマーロジック
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isActive])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleComplete = async () => {
    if (!task) return
    const actualMinutes = Math.ceil(seconds / 60)
    // 実際にかかった時間を保存（DBのカラムに合わせて調整が必要な場合がありますが、まずはis_doneを更新）
    await updatePlan(task.id, { is_done: 1 })
    alert(`お疲れ様！\n予想: ${task.planned_minutes}分\n実際: ${actualMinutes}分\n\nこの調子でがんばろう！🐕`)
    router.push('/student')
  }

  if (loading) return <div className="p-10 text-center animate-pulse text-yellow-600 font-bold text-xl">🐕 準備中...</div>
  if (!task) return <div className="p-10 text-center">タスクが見つかりませんでした</div>

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col font-sans text-gray-800 pb-20">
      {/* ヘッダー */}
      <div className="bg-yellow-400 p-6 shadow-sm sticky top-0 z-10 text-gray-900">
        <button onClick={() => router.back()} className="text-sm font-bold text-gray-700 mb-2">← もどる</button>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest">Now Studying</p>
            <h1 className="text-xl font-black">{task.task_name}</h1>
          </div>
          {/* フローティング・タイマー */}
          <div className="bg-gray-900 text-yellow-400 px-4 py-2 rounded-2xl shadow-lg text-center min-w-[100px]">
            <p className="text-[8px] font-bold uppercase">Focus Time</p>
            <p className="text-xl font-mono font-black">{formatTime(seconds)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* タイマー操作パネル */}
        <div className="bg-white p-4 rounded-3xl border-2 border-yellow-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400">目標時間: {task.planned_minutes}分</p>
            <p className="text-sm font-black text-gray-700">{isActive ? '🔥 集中タイム！' : '☕️ 準備ができたらスタート'}</p>
          </div>
          <button 
            onClick={() => setIsActive(!isActive)}
            className={`px-6 py-2 rounded-xl font-black text-sm transition-all active:scale-95 ${isActive ? 'bg-orange-100 text-orange-600' : 'bg-indigo-600 text-white shadow-md'}`}
          >
            {isActive ? '⏸ 一時停止' : '▶︎ スタート'}
          </button>
        </div>

        {/* SRL学習メニュータイル */}
        <div className="grid grid-cols-1 gap-3">
          <button className="w-full bg-white p-4 rounded-3xl border-2 border-red-50 flex items-center gap-4 active:scale-[0.98] transition">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-2xl">📺</div>
            <div className="text-left"><p className="font-black text-sm">動画でみる</p></div>
            <span className="ml-auto text-gray-200">▶︎</span>
          </button>
          <button className="w-full bg-white p-4 rounded-3xl border-2 border-blue-50 flex items-center gap-4 active:scale-[0.98] transition">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl">📖</div>
            <div className="text-left"><p className="font-black text-sm">解説をよむ</p></div>
            <span className="ml-auto text-gray-200">▶︎</span>
          </button>
          <button className="w-full bg-white p-4 rounded-3xl border-2 border-indigo-50 flex items-center gap-4 active:scale-[0.98] transition">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl">💬</div>
            <div className="text-left"><p className="font-black text-sm">AI先生にきく</p></div>
            <span className="ml-auto text-gray-200">▶︎</span>
          </button>
          <button onClick={() => router.push('/flash')} className="w-full bg-white p-4 rounded-3xl border-2 border-orange-50 flex items-center gap-4 active:scale-[0.98] transition">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl">🃏</div>
            <div className="text-left"><p className="font-black text-sm">単語を特訓</p></div>
            <span className="ml-auto text-gray-200">▶︎</span>
          </button>
        </div>
      </div>

      {/* 固定完了ボタン */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-20">
        <button onClick={handleComplete} className="w-full py-4 bg-green-500 text-white rounded-2xl font-black shadow-lg active:scale-95 transition flex items-center justify-center gap-2">
          ✅ 勉強おわり！ (計測終了)
        </button>
      </div>
    </div>
  )
}

export default function StudyHubPage() {
  return <Suspense><StudyHubContent /></Suspense>
}