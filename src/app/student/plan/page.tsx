'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans, insertPlan, updatePlan, saveUserFields, todayStr, type UserRow, type PlanRow } from '@/lib/student'

const TASK_TYPES = [
  { value: 'reading',  label: '📖 読む' },
  { value: 'writing',  label: '✏️ 書く' },
  { value: 'video',    label: '🎥 動画' },
  { value: 'exercise', label: '💪 練習' },
  { value: 'review',   label: '🔁 復習' },
  { value: 'other',    label: '📌 その他' },
]

function taskIcon(type: string) {
  return TASK_TYPES.find(t => t.value === type)?.label.split(' ')[0] ?? '📌'
}

function getWeekDates(center: string): string[] {
  const dates: string[] = []
  const base = new Date(center + 'T00:00:00')
  for (let i = -2; i <= 4; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

type TabType = 'big' | 'mid' | 'small'

export default function PlanPage() {
  const router = useRouter()

  const [username, setUsername]         = useState('')
  const [user, setUser]                 = useState<UserRow | null>(null)
  const [plans, setPlans]               = useState<PlanRow[]>([])
  const [activeTab, setActiveTab]       = useState<TabType>('big')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [toast, setToast]               = useState('')
  const [newTask, setNewTask] = useState({
    task_name: '',
    big_plan: '',
    mid_plan: '',
    task_type: 'reading',
    planned_minutes: 30,
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.split('@')[0] ?? ''
      setUsername(uname)
      const [u, p] = await Promise.all([loadUser(uname), loadPlans(uname)])
      setUser(u)
      setPlans(p)
      setLoading(false)
    }
    init()
  }, [router])

  const weekDates = getWeekDates(selectedDate)
  const todayTasks = plans.filter(p => (p.task_date ?? '').slice(0, 10) === selectedDate)

  // 大計画グループ
  const bigGroups = plans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const key = p.big_plan || '未分類'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  // 中計画グループ
  const midGroups = plans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const key = p.mid_plan || '未分類'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  async function addTask() {
    if (!newTask.task_name.trim()) { showToast('タスク名を入力してください'); return }
    await insertPlan({
      username,
      big_plan:        newTask.big_plan  || '未分類',
      mid_plan:        newTask.mid_plan  || '未分類',
      task_name:       newTask.task_name,
      task_date:       selectedDate,
      is_done:         0,
      video_url:       '',
      task_type:       newTask.task_type,
      planned_minutes: newTask.planned_minutes,
      material_id:     '',
      page_range:      '',
      deadline:        '',
      month_plan:      '',
    })
    const updated = await loadPlans(username)
    setPlans(updated)
    setNewTask({ task_name: '', big_plan: '', mid_plan: '', task_type: 'reading', planned_minutes: 30 })
    setShowAddModal(false)
    showToast('✅ タスクを追加しました！ +5 EXP')
    if (user) await saveUserFields(username, { current_points: (user.current_points ?? 0) + 5 })
  }

  async function toggleDone(task: PlanRow) {
    const newDone = task.is_done === 1 ? 0 : 1
    setPlans(prev => prev.map(p => p.id === task.id ? { ...p, is_done: newDone } : p))
    await updatePlan(task.id, { is_done: newDone })
    if (newDone === 1 && user) {
      showToast('🎉 完了！ +10 EXP')
      await saveUserFields(username, { current_points: (user.current_points ?? 0) + 10 })
      setUser(prev => prev ? { ...prev, current_points: (prev.current_points ?? 0) + 10 } : prev)
    }
  }

  async function moveTask(task: PlanRow, days: number) {
    const base = new Date((task.task_date ?? todayStr()) + 'T00:00:00')
    base.setDate(base.getDate() + days)
    const newDate = base.toISOString().slice(0, 10)
    setPlans(prev => prev.map(p => p.id === task.id ? { ...p, task_date: newDate } : p))
    await updatePlan(task.id, { task_date: newDate })
    showToast(`📅 ${newDate.slice(5).replace('-','/')} に移動しました`)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-indigo-50">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-bounce">📅</div>
        <p className="text-gray-600">読み込み中...</p>
      </div>
    </div>
  )

  const totalAll = plans.length
  const doneAll  = plans.filter(p => p.is_done === 1).length
  const pctAll   = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-bold animate-bounce">
          {toast}
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 pt-10 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h1 className="text-2xl font-bold">📅 学習プラン</h1>
            <p className="text-blue-100 text-sm">{username} さんの計画</p>
          </div>
          <button onClick={() => router.push('/student')}
            className="bg-white/20 text-white px-3 py-1 rounded-full text-sm hover:bg-white/30 transition">
            ← ホーム
          </button>
        </div>
        {/* 全体進捗 */}
        <div className="bg-white/20 rounded-2xl px-4 py-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-bold">📊 全体進捗</span>
            <span className="text-sm">{doneAll}/{totalAll} 完了 ({pctAll}%)</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-2">
            <div className="bg-yellow-300 h-2 rounded-full transition-all" style={{ width: `${pctAll}%` }} />
          </div>
          <div className="mt-2 text-center">
            <span className="text-yellow-200 font-bold text-sm">⭐ {user?.current_points ?? 0} EXP</span>
          </div>
        </div>
      </div>

      {/* 3タブ切り替え */}
      <div className="px-4 mt-4">
        <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1 gap-1">
          {([
            { key: 'big',   label: '🎯 大計画', desc: '長期目標' },
            { key: 'mid',   label: '📆 中計画', desc: '月別テーマ' },
            { key: 'small', label: '📝 小計画', desc: '日別タスク' },
          ] as { key: TabType; label: string; desc: string }[]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <div>{tab.label}</div>
              <div className={`text-xs font-normal ${activeTab === tab.key ? 'text-blue-100' : 'text-gray-400'}`}>
                {tab.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ===== 大計画タブ ===== */}
      {activeTab === 'big' && (
        <div className="px-4 mt-4 space-y-4">
          <p className="text-xs text-gray-400 text-center">長期的な目標。一度立てたら当面は変更しません。</p>
          {Object.entries(bigGroups).map(([bigPlan, tasks]) => {
            const done = tasks.filter(t => t.is_done === 1).length
            const total = tasks.length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const midSet = [...new Set(tasks.map(t => t.mid_plan).filter(Boolean))]
            return (
              <div key={bigPlan} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">🎯</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg leading-tight">{bigPlan}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{midSet.length} 科目・テーマ</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-500">{pct}%</div>
                    <div className="text-xs text-gray-400">{done}/{total}</div>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
                  <div className={`h-3 rounded-full transition-all ${
                    pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-blue-400' : 'bg-yellow-400'
                  }`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {midSet.map(mid => (
                    <span key={mid} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                      {mid}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
          {Object.keys(bigGroups).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🎯</div>
              <p>大計画がまだありません</p>
              <p className="text-xs mt-1">小計画タブからタスクを追加してください</p>
            </div>
          )}
        </div>
      )}

      {/* ===== 中計画タブ ===== */}
      {activeTab === 'mid' && (
        <div className="px-4 mt-4 space-y-3">
          <p className="text-xs text-gray-400 text-center">1ヶ月単位のテーマ別進捗。状況に応じて調整します。</p>
          {Object.entries(midGroups).map(([midPlan, tasks]) => {
            const done  = tasks.filter(t => t.is_done === 1).length
            const total = tasks.length
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0
            const upcoming = tasks
              .filter(t => t.is_done !== 1)
              .sort((a, b) => (a.task_date ?? '').localeCompare(b.task_date ?? ''))
              .slice(0, 3)
            return (
              <div key={midPlan} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{midPlan}</h3>
                    <p className="text-xs text-gray-400">{tasks[0]?.big_plan ?? ''}</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <div className={`text-xl font-bold ${pct >= 80 ? 'text-green-500' : 'text-blue-500'}`}>{pct}%</div>
                    <div className="text-xs text-gray-400">{done}/{total}</div>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div className={`h-2 rounded-full transition-all ${
                    pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-blue-400' : 'bg-yellow-400'
                  }`} style={{ width: `${pct}%` }} />
                </div>
                {upcoming.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-400 font-bold">📌 直近のタスク</p>
                    {upcoming.map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="text-gray-300">•</span>
                        <span className="text-blue-400">{(t.task_date ?? '').slice(5).replace('-','/')}</span>
                        <span className="truncate">{t.task_name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {pct === 100 && (
                  <div className="mt-2 text-center text-green-500 text-sm font-bold">🎉 完了！</div>
                )}
              </div>
            )
          })}
          {Object.keys(midGroups).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📆</div>
              <p>中計画がまだありません</p>
            </div>
          )}
        </div>
      )}

      {/* ===== 小計画タブ ===== */}
      {activeTab === 'small' && (
        <div>
          {/* 週間カレンダー */}
          <div className="px-4 mt-4 overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-1">
              {weekDates.map(date => {
                const count = plans.filter(p => (p.task_date ?? '').slice(0, 10) === date).length
                const done  = plans.filter(p => (p.task_date ?? '').slice(0, 10) === date && p.is_done === 1).length
                const isToday = date === todayStr()
                const isSel   = date === selectedDate
                const [, mm, dd] = date.split('-')
                return (
                  <button key={date} onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center px-3 py-2 rounded-2xl min-w-[56px] transition border-2 ${
                      isSel   ? 'bg-blue-500 text-white border-blue-600 shadow-md scale-105' :
                      isToday ? 'bg-yellow-100 border-yellow-400 text-yellow-700' :
                                'bg-white border-gray-200 text-gray-600'
                    }`}>
                    <span className="text-xs">{mm}/{dd}</span>
                    {isToday && <span className="text-xs font-bold">今日</span>}
                    {count > 0 && (
                      <span className={`text-xs mt-1 font-bold ${done === count ? 'text-green-500' : isSel ? 'text-white' : 'text-blue-500'}`}>
                        {done}/{count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 選択日サマリー */}
          <div className="px-4 mt-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-gray-700">
                  {selectedDate === todayStr() ? '📌 今日のタスク' : `📅 ${selectedDate.slice(5).replace('-','/')} のタスク`}
                </h2>
                <span className="text-sm text-gray-500">
                  {todayTasks.filter(t => t.is_done === 1).length}/{todayTasks.length} 完了
                </span>
              </div>
              {todayTasks.length > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${todayTasks.length > 0 ? Math.round(todayTasks.filter(t=>t.is_done===1).length/todayTasks.length*100) : 0}%` }} />
                </div>
              )}
              {todayTasks.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-2">この日のタスクはまだありません</p>
              )}
            </div>
          </div>

          {/* タスクリスト */}
          <div className="px-4 mt-3 space-y-3">
            {todayTasks.map(task => (
              <div key={task.id} className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition ${
                task.is_done === 1 ? 'border-green-300 bg-green-50' : 'border-gray-100'
              }`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleDone(task)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                      task.is_done === 1 ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                    }`}>
                    {task.is_done === 1 && '✓'}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{taskIcon(task.task_type ?? '')}</span>
                      <span className={`font-bold ${task.is_done === 1 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {task.task_name}
                      </span>
                    </div>
                    {(task.big_plan || task.mid_plan) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {task.big_plan}{task.mid_plan ? ` › ${task.mid_plan}` : ''}
                      </p>
                    )}
                    {task.planned_minutes != null && task.planned_minutes > 0 && (
                      <p className="text-xs text-blue-500 mt-1">⏱ 予想 {task.planned_minutes} 分</p>
                    )}
                  </div>
                  {task.is_done !== 1 && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => moveTask(task, -1)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition">←</button>
                      <button onClick={() => moveTask(task, 1)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition">→</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* タスク追加ボタン */}
          <div className="px-4 mt-6">
            <button onClick={() => setShowAddModal(true)}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition active:scale-95">
              ＋ この日にタスクを追加
            </button>
          </div>
        </div>
      )}

      {/* タスク追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-t-3xl p-6 w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1 text-gray-800">📝 タスクを追加</h2>
            <p className="text-sm text-blue-500 mb-4">📅 {selectedDate.slice(5).replace('-','/')}</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold text-gray-600">タスク名 *</label>
                <input value={newTask.task_name}
                  onChange={e => setNewTask(p => ({ ...p, task_name: e.target.value }))}
                  placeholder="例：英単語50個"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-600">大計画</label>
                  <input value={newTask.big_plan}
                    onChange={e => setNewTask(p => ({ ...p, big_plan: e.target.value }))}
                    placeholder="例：受験合格！"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-600">中計画</label>
                  <input value={newTask.mid_plan}
                    onChange={e => setNewTask(p => ({ ...p, mid_plan: e.target.value }))}
                    placeholder="例：英検4級単語"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-600">タスク種別</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {TASK_TYPES.map(t => (
                    <button key={t.value} onClick={() => setNewTask(p => ({ ...p, task_type: t.value }))}
                      className={`py-2 rounded-xl text-sm font-bold border-2 transition ${
                        newTask.task_type === t.value ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-600">予想時間: {newTask.planned_minutes} 分</label>
                <input type="range" min={5} max={120} step={5}
                  value={newTask.planned_minutes}
                  onChange={e => setNewTask(p => ({ ...p, planned_minutes: Number(e.target.value) }))}
                  className="w-full mt-1 accent-blue-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>5分</span><span>60分</span><span>120分</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold hover:bg-gray-200 transition">
                キャンセル
              </button>
              <button onClick={addTask}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-6 rounded-2xl font-bold shadow-md hover:shadow-lg transition active:scale-95">
                ✅ 追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}