'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, type PlanRow, type UserRow } from '@/lib/student'
import { getGradeMode } from '@/lib/grade'

function CheckContent() {
  const router  = useRouter()
  const sp      = useSearchParams()
  const taskId  = parseInt(sp.get('task_id') ?? '0')

  const [user, setUser]       = useState<UserRow | null>(null)
  const [task, setTask]       = useState<PlanRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [stamped, setStamped] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      const [userData, { data: taskData }] = await Promise.all([
        loadUser(uname),
        supabase.from('plans').select('*').eq('id', taskId).single()
      ])
      setUser(userData)
      if (taskData) setTask(taskData as PlanRow)
      setLoading(false)
    }
    init()

    // Supabase Realtimeでteacher_stampの変化を監視
    const channel = supabase
      .channel('plan-stamp-' + taskId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'plans',
        filter: `id=eq.${taskId}`,
      }, (payload) => {
        if (payload.new.teacher_stamp === true) {
          setStamped(true)
          setTimeout(() => router.push(`/student/see?task_id=${taskId}`), 1500)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router, taskId])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-4xl animate-bounce">⏳</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  const mode = getGradeMode(user?.grade_num)

  if (stamped) return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-orange-50 flex flex-col items-center justify-center gap-6 p-4">
      <div className="text-8xl animate-bounce">🎖️</div>
      <div className="bg-white rounded-3xl p-8 shadow-lg text-center space-y-2">
        <p className="text-2xl font-black text-orange-600">先生スタンプ GET！</p>
        <p className="text-gray-500">振り返りページへ移動します...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-4 gap-6">

      {/* 待機アニメーション */}
      <div className="relative">
        <div className="text-7xl animate-pulse">👩‍🏫</div>
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
          待機中
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-lg text-center space-y-3 w-full max-w-sm">
        {mode === 'low' ? (
          <>
            <p className="text-2xl font-black text-gray-800">せんせいをよぼう！</p>
            <p className="text-gray-500 text-sm">せんせいにみせて、まるをもらおう 🔴</p>
          </>
        ) : (
          <>
            <p className="text-xl font-black text-gray-800">先生チェック待ち</p>
            <p className="text-gray-500 text-sm">
              先生に声をかけて、<br />課題の確認をしてもらいましょう
            </p>
          </>
        )}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3">
          <p className="text-sm font-bold text-indigo-700">📋 {task?.task_name}</p>
        </div>
        {/* ぐるぐるインジケーター */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-xs text-gray-400">先生がスタンプを押すと自動で次へ進みます</p>
      </div>

      <button onClick={() => router.push(`/student/see?task_id=${taskId}`)}
        className="text-sm text-gray-400 underline">
        スキップして振り返りへ進む
      </button>
    </div>
  )
}

export default function CheckPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-4xl animate-bounce">⏳</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <CheckContent />
    </Suspense>
  )
}