'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadPlans, updatePlan, saveUserFields, loadUser, todayStr, type PlanRow, type UserRow } from '@/lib/student'

export default function PlanPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [user, setUser] = useState<UserRow | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')
  const [openMids, setOpenMids] = useState<Set<string>>(new Set())

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  function toggleMid(key: string) {
    setOpenMids(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)
      const [userData, allPlans] = await Promise.all([loadUser(uname), loadPlans()])
      setUser(userData)
      const myPlans = allPlans.filter(p => p.username === uname)
      setPlans(myPlans)

      // 最初は全中計画を開いた状態にする
      const midKeys = new Set(myPlans.map(p => `${p.big_plan}__${p.mid_plan}`))
      setOpenMids(midKeys)
      setLoading(false)
    }
    init()
  }, [router])

  async function toggleTask(task: PlanRow) {
    const newDone = task.is_done === 1 ? 0 : 1
    setPlans(prev => prev.map(t => t.id === task.id ? { ...t, is_done: newDone } : t))
    await updatePlan(task.id, { is_done: newDone })
    if (newDone === 1 && user) {
      const newXp = (user.current_points ?? 0) + 10
      await saveUserFields(username, { current_points: newXp })
      setUser(prev => prev ? { ...prev, current_points: newXp } : prev)
      showToast('⚡ +10 XP ゲット！')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-4xl animate-bounce">🗺️</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  // 大計画ごとにグループ化
  const bigGroups = plans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const k = p.big_plan || '未分類'
    if (!acc[k]) acc[k] = []
    acc[k].push(p)
    return acc
  }, {})

  const totalAll  = plans.length
  const doneAll   = plans.filter(p => p.is_done === 1).length
  const pctAll    = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0

  function taskIcon(type: string) {
    switch (type) {
      case 'flash':   return '🃏'
      case 'video':   return '🎬'
      case 'test':    return '✏️'
      case 'reading': return '📖'
      default:        return '📝'
    }
  }

  function deadlineColor(dateStr: string) {
    if (!dateStr) return 'text-gray-400'
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
    if (diff < 0)  return 'text-red-500'
    if (diff <= 3) return 'text-orange-500'
    return 'text-gray-400'
  }

  return (
    <div className="space-y-4">
      {/* トースト */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50
          bg-yellow-400 text-white font-bold px-6 py-3 rounded-full shadow-lg
          animate-bounce text-sm">
          {toastMsg}
        </div>
      )}

      {/* 全体進捗カード */}
      <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-5 text-white shadow-md">
        <h2 className="text-xl font-bold">🗺️ 計画確認</h2>
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span>全体進捗　{doneAll} / {totalAll} タスク完了</span>
            <span>{pctAll}%</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
            <div
              className="bg-white h-3 rounded-full transition-all duration-500"
              style={{ width: `${pctAll}%` }}
            />
          </div>
        </div>
        <div className="mt-2 flex justify-between items-center">
          <span className="text-sm opacity-80">⚡ {(user?.current_points ?? 0).toLocaleString()} XP</span>
          {pctAll === 100 && totalAll > 0 && (
            <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-bold">
              🏆 全完了！
            </span>
          )}
        </div>
      </div>

      {/* タスクなし */}
      {totalAll === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center space-y-2">
          <div className="text-4xl">📋</div>
          <p className="font-bold text-gray-600">計画がまだありません</p>
          <p className="text-sm text-gray-400">先生が計画を登録すると<br />ここに表示されます</p>
        </div>
      )}

      {/* 大計画ループ */}
      {Object.entries(bigGroups).map(([bigPlan, bigTasks]) => {
        const bigDone = bigTasks.filter(t => t.is_done === 1).length
        const bigTotal = bigTasks.length
        const bigPct = bigTotal > 0 ? Math.round((bigDone / bigTotal) * 100) : 0

        // 中計画ごとにグループ化
        const midGroups = bigTasks.reduce<Record<string, PlanRow[]>>((acc, p) => {
          const k = p.mid_plan || '未分類'
          if (!acc[k]) acc[k] = []
          acc[k].push(p)
          return acc
        }, {})

        return (
          <div key={bigPlan} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 大計画ヘッダー */}
            <div className="bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 text-white">
              <div className="flex items-center justify-between">
                <span className="font-bold">🎯 {bigPlan}</span>
                <span className="text-sm opacity-80">{bigDone}/{bigTotal}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${bigPct}%` }}
                />
              </div>
            </div>

            {/* 中計画ループ */}
            <div className="divide-y divide-gray-50">
              {Object.entries(midGroups).map(([midPlan, midTasks]) => {
                const midKey = `${bigPlan}__${midPlan}`
                const isOpen = openMids.has(midKey)
                const midDone = midTasks.filter(t => t.is_done === 1).length
                const midTotal = midTasks.length
                const midPct = midTotal > 0 ? Math.round((midDone / midTotal) * 100) : 0

                return (
                  <div key={midKey}>
                    {/* 中計画ヘッダー（タップで開閉） */}
                    <button
                      onClick={() => toggleMid(midKey)}
                      className="w-full text-left bg-gray-50 px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-bold text-gray-700 truncate">
                          📚 {midPlan}
                        </span>
                        {/* 中計画進捗バー */}
                        <div className="flex-1 max-w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-green-400 h-1.5 rounded-full transition-all"
                            style={{ width: `${midPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {midDone}/{midTotal}
                        </span>
                      </div>
                      <span className="text-gray-400 ml-2 text-xs">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* タスク一覧（アコーディオン） */}
                    {isOpen && (
                      <div className="divide-y divide-gray-50">
                        {midTasks
                          .sort((a, b) => String(a.task_date).localeCompare(String(b.task_date)))
                          .map(task => {
                            const taskDate = String(task.task_date).slice(0, 10)
                            const today = todayStr()
                            const isToday = taskDate === today
                            const isPast = taskDate < today && task.is_done !== 1

                            return (
                              <button
                                key={task.id}
                                onClick={() => toggleTask(task)}
                                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors
                                  ${task.is_done === 1 ? 'bg-green-50' : isPast ? 'bg-red-50' : isToday ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                              >
                                {/* チェック */}
                                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                                  ${task.is_done === 1 ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                                  {task.is_done === 1 && <span className="text-xs">✓</span>}
                                </div>

                                {/* 内容 */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-base">{taskIcon(task.task_type)}</span>
                                    <span className={`text-sm font-medium ${task.is_done === 1 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                      {task.task_name}
                                    </span>
                                    {isToday && task.is_done !== 1 && (
                                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">今日</span>
                                    )}
                                    {isPast && (
                                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">遅れ</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-xs ${deadlineColor(taskDate)}`}>
                                      📅 {taskDate}
                                    </span>
                                    {task.page_range && (
                                      <span className="text-xs text-gray-400">📄 {task.page_range}</span>
                                    )}
                                  </div>
                                  {task.video_url && task.is_done !== 1 && (
                                    <a
                                      href={task.video_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="inline-block mt-1 text-xs text-blue-500 underline"
                                    >
                                      🎬 動画を見る
                                    </a>
                                  )}
                                </div>

                                {/* 完了バッジ */}
                                {task.is_done === 1 && (
                                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full flex-shrink-0">
                                    完了
                                  </span>
                                )}
                              </button>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}