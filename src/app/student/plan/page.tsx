'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadPlans, updatePlan, insertPlan, saveUserFields, loadUser, todayStr, type PlanRow, type UserRow } from '@/lib/student'

const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土']

function getWeekDates(): string[] {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + (i - 2) * 86400000)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function formatDate(dateStr: string): { mmdd: string; day: string; isToday: boolean } {
  const d = new Date(dateStr)
  const today = todayStr()
  return {
    mmdd: `${d.getMonth() + 1}/${d.getDate()}`,
    day: WEEK_DAYS[d.getDay()],
    isToday: dateStr === today,
  }
}

export default function PlanPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [user, setUser] = useState<UserRow | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')
  const [activeDate, setActiveDate] = useState(todayStr())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTask, setEditingTask] = useState<PlanRow | null>(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskType, setNewTaskType] = useState('reading')
  const [newPlannedMin, setNewPlannedMin] = useState(15)
  const [newBigPlan, setNewBigPlan] = useState('')
  const [newMidPlan, setNewMidPlan] = useState('')
  const weekDates = getWeekDates()

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)
      const [userData, allPlans] = await Promise.all([loadUser(uname), loadPlans(uname)])
      setUser(userData)
      setPlans(allPlans)
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

  async function moveTaskToDate(task: PlanRow, date: string) {
    setPlans(prev => prev.map(t => t.id === task.id ? { ...t, task_date: date } : t))
    await updatePlan(task.id, { task_date: date })
    showToast(`📅 ${date.slice(5).replace('-', '/')} に移動しました`)
  }

  async function updatePlannedMinutes(task: PlanRow, minutes: number) {
    setPlans(prev => prev.map(t => t.id === task.id ? { ...t, planned_minutes: minutes } : t))
    await updatePlan(task.id, { planned_minutes: minutes })
  }

  async function addTask() {
    if (!newTaskName.trim()) return
    const newTask = {
      username,
      big_plan: newBigPlan || '自主学習',
      mid_plan: newMidPlan || '未分類',
      task_name: newTaskName.trim(),
      task_date: activeDate,
      is_done: 0,
      video_url: '',
      material_id: '',
      page_range: '',
      deadline: '',
      month_plan: '',
      task_type: newTaskType,
      planned_minutes: newPlannedMin,
      actual_minutes: 0,
    }
    await insertPlan(newTask)
    const allPlans = await loadPlans(username)
    setPlans(allPlans)
    setNewTaskName('')
    setNewTaskType('reading')
    setNewPlannedMin(15)
    setNewBigPlan('')
    setNewMidPlan('')
    setShowAddModal(false)
    showToast('✅ タスクを追加しました！')
  }

  function taskIcon(type: string) {
    switch (type) {
      case 'flash':   return '🃏'
      case 'video':   return '🎬'
      case 'test':    return '✏️'
      case 'reading': return '📖'
      default:        return '📝'
    }
  }

  const todayTasks = plans.filter(p => String(p.task_date).slice(0, 10) === activeDate)
  const unscheduled = plans.filter(p => !p.task_date)
  const totalAll = plans.length
  const doneAll = plans.filter(p => p.is_done === 1).length
  const pctAll = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-4xl animate-bounce">🗓️</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  return (
    <div className="space-y-4 pb-24">
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-white font-bold px-6 py-3 rounded-full shadow-lg animate-bounce text-sm">
          {toastMsg}
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-5 text-white shadow-md">
        <h2 className="text-xl font-bold">🗓️ 計画確認</h2>
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span>全体進捗 {doneAll} / {totalAll} タスク完了</span>
            <span>{pctAll}%</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
            <div className="bg-white h-3 rounded-full transition-all duration-500" style={{ width: `${pctAll}%` }} />
          </div>
        </div>
        <div className="mt-2 flex justify-between items-center">
          <span className="text-sm opacity-80">⚡ {(user?.current_points ?? 0).toLocaleString()} XP</span>
          {pctAll === 100 && totalAll > 0 && (
            <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-bold">🎉 全完了！</span>
          )}
        </div>
      </div>

      {/* 週間カレンダー */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
        <h3 className="text-sm font-bold text-gray-600 mb-2">📅 週間スケジュール</h3>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map(date => {
            const { mmdd, day, isToday } = formatDate(date)
            const dayTasks = plans.filter(p => String(p.task_date).slice(0, 10) === date)
            const dayDone = dayTasks.filter(p => p.is_done === 1).length
            const isActive = date === activeDate
            return (
              <button key={date} onClick={() => setActiveDate(date)}
                className={`rounded-xl p-1.5 text-center transition-all ${
                  isActive ? 'bg-green-500 text-white shadow-md scale-105' :
                  isToday ? 'bg-green-50 border-2 border-green-400 text-green-700' :
                  'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}>
                <div className="text-xs font-bold">{day}</div>
                <div className="text-xs">{mmdd}</div>
                {dayTasks.length > 0 && (
                  <div className={`text-xs font-black mt-0.5 ${isActive ? 'text-white' : 'text-green-600'}`}>
                    {dayDone}/{dayTasks.length}
                  </div>
                )}
                {dayTasks.length === 0 && (
                  <div className="text-xs mt-0.5 opacity-40">—</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 選択日のタスク */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="font-bold text-gray-700">
              {formatDate(activeDate).mmdd}（{formatDate(activeDate).day}）
            </span>
            {formatDate(activeDate).isToday && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">今日</span>
            )}
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="bg-green-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-green-600 transition">
            ＋ 追加
          </button>
        </div>

        {todayTasks.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm">この日のタスクはありません</p>
            <button onClick={() => setShowAddModal(true)}
              className="mt-3 text-green-500 text-sm underline">タスクを追加する</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todayTasks.map(task => (
              <div key={task.id} className={`px-4 py-4 ${task.is_done === 1 ? 'bg-green-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleTask(task)}
                    className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                      ${task.is_done === 1 ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                    {task.is_done === 1 && <span className="text-xs">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{taskIcon(task.task_type)}</span>
                      <span className={`font-medium text-sm ${task.is_done === 1 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {task.task_name}
                      </span>
                    </div>
                    {task.page_range && (
                      <p className="text-xs text-gray-400 mt-0.5 ml-7">📄 {task.page_range}</p>
                    )}
                    {/* 予想時間スライダー */}
                    {task.is_done !== 1 && (
                      <div className="mt-2 ml-7">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">⏱️ 予想時間</span>
                          <span className="text-xs font-bold text-blue-600">{task.planned_minutes ?? 0}分</span>
                        </div>
                        <input type="range" min={5} max={120} step={5}
                          value={task.planned_minutes ?? 0}
                          onChange={e => updatePlannedMinutes(task, parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-1" />
                      </div>
                    )}
                    {/* 日付移動ボタン */}
                    {task.is_done !== 1 && (
                      <div className="mt-2 ml-7 flex gap-1 flex-wrap">
                        {weekDates.filter(d => d !== activeDate).map(d => (
                          <button key={d} onClick={() => moveTaskToDate(task, d)}
                            className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition">
                            → {formatDate(d).mmdd}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {task.is_done === 1 && (
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full flex-shrink-0">完了</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 未割り当てタスク */}
      {unscheduled.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <h3 className="font-bold text-orange-700 mb-3">📋 日付未設定のタスク ({unscheduled.length}件)</h3>
          <div className="space-y-2">
            {unscheduled.map(task => (
              <div key={task.id} className="bg-white rounded-xl p-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700 flex-1">{taskIcon(task.task_type)} {task.task_name}</span>
                <div className="flex gap-1 flex-wrap">
                  {weekDates.map(d => (
                    <button key={d} onClick={() => moveTaskToDate(task, d)}
                      className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-lg hover:bg-orange-200 transition">
                      {formatDate(d).mmdd}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* タスク追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-800 text-lg">➕ タスクを追加</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="タスク名" value={newTaskName}
                onChange={e => setNewTaskName(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-green-400 focus:outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="大計画（例：英語）" value={newBigPlan}
                  onChange={e => setNewBigPlan(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-green-400 focus:outline-none" />
                <input type="text" placeholder="中計画（例：単語）" value={newMidPlan}
                  onChange={e => setNewMidPlan(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-green-400 focus:outline-none" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">タスクの種類</p>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { type: 'reading', icon: '📖', label: '読み書き' },
                    { type: 'video',   icon: '🎬', label: '動画' },
                    { type: 'test',    icon: '✏️', label: 'テスト' },
                    { type: 'flash',   icon: '🃏', label: '単語' },
                  ].map(({ type, icon, label }) => (
                    <button key={type} onClick={() => setNewTaskType(type)}
                      className={`py-2 rounded-xl text-xs font-bold transition border-2 ${
                        newTaskType === type ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'
                      }`}>
                      {icon}<br />{label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">⏱️ 予想時間</p>
                  <p className="text-sm font-bold text-blue-600">{newPlannedMin}分</p>
                </div>
                <input type="range" min={5} max={120} step={5}
                  value={newPlannedMin}
                  onChange={e => setNewPlannedMin(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 text-center">
                📅 追加先: <span className="font-bold text-green-600">{formatDate(activeDate).mmdd}（{formatDate(activeDate).day}）</span>
              </div>
              <button onClick={addTask}
                className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold text-lg hover:bg-green-600 transition">
                ✅ 追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}