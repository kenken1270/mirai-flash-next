'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadPlans, type PlanRow } from '@/lib/student'

function StudyHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get('taskId')
  
  const [task, setTask] = useState<PlanRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTask() {
      if (!taskId) return
      const { data } = await supabase.from('plans').select('*').eq('id', taskId).single()
      if (data) setTask(data)
      setLoading(false)
    }
    fetchTask()
  }, [taskId])

  if (loading) return <div className="p-10 text-center animate-pulse text-yellow-600 font-bold">🐕 勉強の準備をしているよ...</div>
  if (!task) return <div className="p-10 text-center">タスクが見つかりませんでした</div>

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col font-sans text-gray-800">
      {/* ヘッダー */}
      <div className="bg-yellow-400 p-6 shadow-sm">
        <button onClick={() => router.back()} className="text-sm font-bold text-gray-700 mb-2">← もどる</button>
        <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest">Target Mission</p>
        <h1 className="text-2xl font-black text-gray-900">{task.task_name}</h1>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* メインメッセージ */}
        <div className="bg-white p-5 rounded-3xl border-2 border-yellow-100 shadow-sm flex items-center gap-4">
          <div className="text-4xl">🎓</div>
          <div>
            <p className="font-bold text-sm text-gray-700">どうやって勉強する？</p>
            <p className="text-xs text-gray-400">自分にぴったりの方法をえらぼう！</p>
          </div>
        </div>

        {/* SRL学習メニュータイル */}
        <div className="grid grid-cols-1 gap-4">
          
          {/* 1. 動画でみる */}
          <button className="w-full bg-white p-6 rounded-[2rem] border-2 border-red-50 shadow-sm flex items-center gap-6 active:scale-[0.98] transition">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-3xl">📺</div>
            <div className="text-left">
              <p className="font-black text-lg text-gray-800">動画でみる</p>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Point Lesson Video</p>
            </div>
            <span className="ml-auto text-gray-200">▶︎</span>
          </button>

          {/* 2. 記事・解説をよむ */}
          <button className="w-full bg-white p-6 rounded-[2rem] border-2 border-blue-50 shadow-sm flex items-center gap-6 active:scale-[0.98] transition">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl">📖</div>
            <div className="text-left">
              <p className="font-black text-lg text-gray-800">解説をよむ</p>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Reading & Hints</p>
            </div>
            <span className="ml-auto text-gray-200">▶︎</span>
          </button>

          {/* 3. AIにきく */}
          <button className="w-full bg-white p-6 rounded-[2rem] border-2 border-indigo-50 shadow-sm flex items-center gap-6 active:scale-[0.98] transition">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl">💬</div>
            <div className="text-left">
              <p className="font-black text-lg text-gray-800">AI先生にきく</p>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Ask Shiba-AI</p>
            </div>
            <span className="ml-auto text-gray-200">▶︎</span>
          </button>

          {/* 4. 単語を特訓する */}
          <button onClick={() => router.push('/flash')} className="w-full bg-white p-6 rounded-[2rem] border-2 border-orange-50 shadow-sm flex items-center gap-6 active:scale-[0.98] transition">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-3xl">🃏</div>
            <div className="text-left">
              <p className="font-black text-lg text-gray-800">単語を特訓</p>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Flashcard Training</p>
            </div>
            <span className="ml-auto text-gray-200">▶︎</span>
          </button>

        </div>
      </div>

      {/* 下部：完了報告 */}
      <div className="p-4 pb-10 bg-white border-t border-gray-100">
        <button className="w-full py-4 bg-green-500 text-white rounded-2xl font-black shadow-lg shadow-green-100 active:scale-95 transition">
          ✅ この勉強を完了する！
        </button>
      </div>
    </div>
  )
}

export default function StudyHubPage() {
  return <Suspense><StudyHubContent /></Suspense>
}