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

  async function toggleDone(e: React.MouseEvent, task: PlanRow) {
    e.stopPropagation() // 親要素のクリックイベント（ページ遷移）を防ぐ
    const nd = task.is_done === 1 ? 0 : 1
    await updatePlan(task.id, { is_done: nd })
    setPlans(await loadPlans(user?.username || ''))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] animate-pulse text-yellow-600 font-bold">🐕 作戦会議中...</div>

  return (
    <div className="flex-1 flex flex-col space-y-6 p-4 bg-[#FFFDF0]">
      {/* ユーザープロフィール（色味を柔らかく調整） */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-yellow-100 flex items-center gap-4">
        <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center text-3xl shadow-inner">🐶</div>
        <div className="flex-1">
          <h2 className="font-black text-base text-gray-700">{user?.nickname || user?.username} さん</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Level {user?.grade_num || 1} · {user?.current_points || 0} EXP</p>
          <div className="h-1.5 w-full bg-gray-50 rounded-full mt-2 overflow-hidden border border-gray-100">
            <div className="h-full bg-yellow-400" style={{ width: '40%' }}></div>
          </div>
        </div>
      </div>

      {/* 今日のミッション（クリックで学習ページへ） */}
      <div className="space-y-3">
        <div className="flex justify-between items-end px-1">
          <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-[0.2em]">Today's Missions</h3>
          <span className="text-[10px] font-black text-indigo-400">{doneCount} / {todayTasks.length} Done</span>
        </div>
        
        <div className="bg-white p-5 rounded-[2.5rem] shadow-md border-2 border-yellow-200">
          {todayTasks.length === 0 ? (
            <div className="py-6 text-center space-y-4">
              <p className="text-gray-300 font-bold italic text-sm">今日はまだクエストがないよ</p>
              <button onClick={() => router.push('/student/plan')} className="bg-yellow-400 text-gray-800 px-8 py-3 rounded-2xl font-black text-sm shadow-md active:scale-95 transition">🗓️ 計画をたてる</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                  <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="font-black text-green-500 text-sm">{progress}%</span>
              </div>
              
              <div className="space-y-2 pt-2">
                {todayTasks.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => router.push(`/student/study?taskId=${t.id}`)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] cursor-pointer ${t.is_done ? 'bg-gray-50 border-gray-100' : 'bg-white border-yellow-50 hover:border-yellow-200 shadow-sm'}`}
                  >
                    <button 
                      onClick={(e) => toggleDone(e, t)} 
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${t.is_done === 1 ? 'bg-green-500 border-green-500 shadow-inner' : 'bg-white border-gray-200'}`}
                    >
                      {t.is_done === 1 && <span className="text-white font-black text-sm">✓</span>}
                    </button>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${t.is_done ? 'text-gray-300 line-through' : 'text-gray-700'}`}>{t.task_name}</p>
                      <p className="text-[10px] text-indigo-300 font-bold mt-0.5 uppercase tracking-tighter">▶︎ タップして学習を開始</p>
                    </div>
                    <span className="text-gray-200 text-xl">›</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* サブアクション（色味を柔らかく） */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => router.push('/flash')} className="bg-white border-2 border-indigo-50 p-5 rounded-[2rem] shadow-sm flex flex-col items-center gap-2 active:scale-95 transition">
          <span className="text-3xl">🃏</span>
          <span className="font-black text-[10px] text-indigo-400 uppercase tracking-widest">Training</span>
        </button>
        <button onClick={() => router.push('/student/test')} className="bg-white border-2 border-orange-50 p-5 rounded-[2rem] shadow-sm flex flex-col items-center gap-2 active:scale-95 transition">
          <span className="text-3xl">📝</span>
          <span className="font-black text-[10px] text-orange-400 uppercase tracking-widest">Test</span>
        </button>
      </div>
    </div>
  )
}