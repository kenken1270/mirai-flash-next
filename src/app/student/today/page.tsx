'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans, type UserRow, type PlanRow } from '@/lib/student'

export default function TodayPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRow | null>(null)
  const [tasks, setTasks] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const username = session.user.email?.replace('@mirai-juku.internal', '') ?? session.user.email?.split('@')[0] ?? ''
      const u = await loadUser(username)
      const plans = await loadPlans(username)
      const todayTasks = plans.filter(p => p.task_date === today)
      setUser(u)
      setTasks(todayTasks)
      setLoading(false)
    }
    init()
  }, [])

  const done = tasks.filter(t => t.is_done === 1).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  if (loading) return <div className="flex items-center justify-center min-h-screen text-2xl">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-24 px-4">
      <div className="max-w-lg mx-auto pt-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-orange-600">📅 今日のタスク</h1>
          <p className="text-sm text-gray-500 mt-1">{today}</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>進捗</span>
            <span>{done}/{total} 完了 ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-orange-400 h-3 rounded-full transition-all" style={{width: pct+'%'}} />
          </div>
        </div>
        {tasks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center space-y-3">
            <div className="text-6xl">🎉</div>
            <p className="text-xl font-bold text-gray-700">今日のタスクはないよ！</p>
            <p className="text-sm text-gray-400">計画ページから新しいタスクを追加しよう</p>
            <button onClick={() => router.push('/student/plan')} className="mt-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold">📋 計画ページへ</button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className={'bg-white rounded-2xl shadow p-4 border-l-4 ' + (task.is_done === 1 ? 'border-green-400 opacity-60' : 'border-orange-400')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className={'font-bold text-gray-700 ' + (task.is_done === 1 ? 'line-through text-gray-400' : '')}>
                      {task.is_done === 1 ? '✅ ' : '⏳ '}{task.task_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{task.planned_minutes ?? 0}分 · {task.task_type ?? ''}</p>
                  </div>
                  {task.is_done !== 1 && (
                    <button onClick={() => router.push('/student/do/' + task.id)}
                      className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold whitespace-nowrap">
                      やる！
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => router.push('/student/plan')} className="w-full py-3 border border-orange-300 text-orange-600 rounded-2xl font-bold">📋 計画ページへ</button>
      </div>
    </div>
  )
}
