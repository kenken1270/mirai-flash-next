'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, type PlanRow, type UserRow } from '@/lib/student'

function CheckContent() {
  const router  = useRouter()
  const sp      = useSearchParams()
  const taskId  = parseInt(sp.get('task_id') ?? '0')

  const [user, setUser]         = useState<UserRow | null>(null)
  const [task, setTask]         = useState<PlanRow | null>(null)
  const [loading, setLoading]   = useState(true)
  const [code, setCode]         = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

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
  }, [router, taskId])

  async function handleSubmit() {
    if (code.length !== 4) { setError('4桁のコードを入力してください'); return }
    const { data } = await supabase
      .from('plans')
      .select('id, stamp_code')
      .eq('id', taskId)
      .single()
    if (!data) { setError('タスクが見つかりません'); return }
    if (data.stamp_code === code) {
      await supabase.from('plans')
        .update({ teacher_stamp: true, stamp_at: new Date().toISOString() })
        .eq('id', taskId)
      await supabase.from('users')
        .update({ current_status: 'seeing', status_updated_at: new Date().toISOString() })
        .eq('username', user?.username ?? '')
      setSuccess(true)
      setTimeout(() => router.push(`/student/see?task_id=${taskId}`), 1500)
    } else {
      setError('コードが違います。先生にもう一度確認してください')
      setCode('')
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-4xl animate-bounce">⏳</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  if (success) return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-orange-50 flex flex-col items-center justify-center gap-6 p-4">
      <div className="text-8xl animate-bounce">🎖️</div>
      <div className="bg-white rounded-3xl p-8 shadow-lg text-center space-y-2">
        <p className="text-2xl font-black text-orange-600">合格スタンプ GET！</p>
        <p className="text-gray-500">振り返りページへ移動します...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-4 gap-6">
      <div className="relative">
        <div className="text-7xl animate-pulse">👨‍🏫</div>
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
          待機中
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-lg text-center space-y-4 w-full max-w-sm">
        <p className="text-xl font-black text-gray-800">先生チェック待ち</p>
        <p className="text-gray-500 text-sm">
          先生に声をかけて、<br />課題の確認をしてもらいましょう
        </p>
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3">
          <p className="text-sm font-bold text-indigo-700">📋 {task?.task_name}</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold text-gray-700">先生から4桁コードをもらって入力してください</p>
          <input
            type="number"
            maxLength={4}
            value={code}
            onChange={e => { setCode(e.target.value.slice(0, 4)); setError('') }}
            placeholder="0000"
            className="w-full text-center text-4xl font-black tracking-widest border-2 border-gray-300 rounded-2xl py-4 focus:border-indigo-500 focus:outline-none"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={handleSubmit}
            className="w-full bg-indigo-500 text-white py-3 rounded-2xl font-bold text-lg hover:bg-indigo-600 transition">
            ✅ 確認する
          </button>
        </div>
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