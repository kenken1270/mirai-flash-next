'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans, updatePlan, todayStr, type UserRow, type PlanRow } from '@/lib/student'

export default function StudentHomePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRow | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.split('@')[0] ?? ''
      const [u, p] = await Promise.all([loadUser(uname), loadPlans(uname)])
      setUser(u); setPlans(p); setLoading(false)
    }
    init()
  }, [router])

  const todayTasks = plans.filter(p => p.task_date === todayStr())
  const doneCount = todayTasks.filter(t => t.is_done === 1).length
  const progress = todayTasks.length > 0 ? Math.round((doneCount / todayTasks.length) * 100) : 0

  async function toggleDone(task: PlanRow) {
    const nd = task.is_done === 1 ? 0 : 1
    await updatePlan(task.id, { is_done: nd })
    setPlans(await loadPlans(user?.username || ''))
  }

  if (loading) return <div className="p-10 text-center animate-pulse text-yellow-600 font-bold">🐕 準備中...</div>

  return (
    <div className="flex-1 flex flex-col space-y-6 p-4">
      {/* ユーザープロフィール */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-yellow-100 flex items-center gap-4">
        <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-3xl shadow-inner border-2 border-white">🐶</div>
        <div className="flex-1">
          <h2 className="font-black text-lg text-gray-800">{user?.nickname || user?.username} さん</h2>
          <p className="text-xs text-gray-400 font-bold">Lv.{user?.grade_num || 1} · {user?.current_points || 0} EXP</p>
          <div className="h-1.5 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-yellow-400" style={{ width: '40%' }}></div>
          </div>
        </div>
      </div>

      {/* 今日の進捗 */}
      <div className="space-y-2">
        <div className="flex justify-between items-end px-1">
          <h3 className="font-black text-gray-400 text-xs uppercase tracking-widest">Today's Missions</h3>
          <span className="text-xs font-black text-indigo-500">{doneCount} / {todayTasks.length} 完了</span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-md border-2 border-yellow-400 text-center space-y-4">
          {todayTasks.length === 0 ? (
            <div className="py-4 space-y-3">
              <p className="text-gray-400 font-bold italic">今日はまだクエストがないよ</p>
              <button onClick={() => router.push('/student/plan')} className="bg-gray-900 text-yellow-400 px-6 py-2 rounded-full font-black text-sm">🗓️ 計画をたてる</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="font-black text-green-600">{progress}%</span>
              </div>
              <div className="divide-y divide-gray-50 pt-2 text-left">
                {todayTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 py-3 group">
                    <button onClick={() => toggleDone(t)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${t.is_done ? 'bg-green-500 border-green-500' : 'bg-white border-gray-200'}`}>
                      {t.is_done === 1 && <span className="text-white text-xs">✓</span>}
                    </button>
                    <span className={`font-bold text-sm flex-1 ${t.is_done ? 'text-gray-300 line-through' : 'text-gray-700'}`}>{t.task_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* クイックリンク（特訓） */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => router.push('/flash')} className="bg-white border-2 border-indigo-100 p-4 rounded-3xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition">
          <span className="text-3xl">🃏</span>
          <span className="font-black text-xs text-indigo-600">単語の特訓</span>
        </button>
        <button onClick={() => router.push('/student/test')} className="bg-white border-2 border-orange-100 p-4 rounded-3xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition">
          <span className="text-3xl">📝</span>
          <span className="font-black text-xs text-orange-600">小テスト</span>
        </button>
      </div>
    </div>
  )
}