'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans, insertPlan, updatePlan, saveUserFields, todayStr, type UserRow, type PlanRow } from '@/lib/student'

function getWeekDates(center: string): string[] {
  const dates: string[] = []
  const base = new Date(center + 'T00:00:00')
  for (let i = -3; i <= 3; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}
function getMonthRange(plans: PlanRow[]): string[] {
  const months = new Set<string>()
  plans.forEach(p => { if (p.task_date) months.add(p.task_date.slice(0, 7)) })
  return [...months].sort()
}
function pctColor(pct: number) {
  if (pct >= 80) return 'bg-green-400'
  if (pct >= 50) return 'bg-blue-400'
  if (pct > 0)   return 'bg-yellow-400'
  return 'bg-gray-200'
}
const TASK_TYPES = [
  { value: 'reading',  label: '📖 読む' },
  { value: 'writing',  label: '✏️ 書く' },
  { value: 'video',    label: '🎬 動画' },
  { value: 'exercise', label: '💪 練習' },
  { value: 'review',   label: '🔁 復習' },
  { value: 'other',    label: '📌 その他' },
]
function taskIcon(type: string) {
  return TASK_TYPES.find(t => t.value === type)?.label.split(' ')[0] ?? '📌'
}

const DAY_LABELS = ['日','月','火','水','木','金','土']

type View = 'big' | 'mid' | 'small'
type WizStep = 1 | 2 | 3

export default function PlanPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [user, setUser]         = useState<UserRow | null>(null)
  const [plans, setPlans]       = useState<PlanRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')

  const [view, setView]               = useState<View>('big')
  const [selectedBig, setSelectedBig] = useState<string | null>(null)
  const [selectedMid, setSelectedMid] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(todayStr())

  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({
    task_name: '', big_plan: '', mid_plan: '',
    task_type: 'reading', planned_minutes: 30,
  })

  // ウィザード用
  const [showWizard, setShowWizard] = useState(false)
  const [wizStep, setWizStep]       = useState<WizStep>(1)
  const [wizData, setWizData]       = useState({
    big_plan: '',
    deadline: '',
    mid_plan: '',
    month_plan: '',
    task_name: '',
    task_date: todayStr(),
    task_type: 'reading',
    planned_minutes: 30,
  })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.split('@')[0] ?? ''
      setUsername(uname)
      const [u, p] = await Promise.all([loadUser(uname), loadPlans(uname)])
      setUser(u); setPlans(p); setLoading(false)
    }
    init()
  }, [router])

  const bigGroups = plans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const k = p.big_plan || '未分類'; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc
  }, {})
  const midPlans  = selectedBig ? plans.filter(p => p.big_plan === selectedBig) : []
  const midGroups = midPlans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const k = p.mid_plan || '未分類'; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc
  }, {})
  const months    = getMonthRange(midPlans)
  const smallPlans = selectedMid
    ? plans.filter(p => p.big_plan === selectedBig && p.mid_plan === selectedMid)
    : plans
  const weekDates = getWeekDates(selectedDate)
  const dayTasks  = smallPlans.filter(p => (p.task_date ?? '').slice(0, 10) === selectedDate)
  const totalAll  = plans.length
  const doneAll   = plans.filter(p => p.is_done === 1).length
  const pctAll    = totalAll > 0 ? Math.round(doneAll / totalAll * 100) : 0

  async function toggleDone(task: PlanRow) {
    const nd = task.is_done === 1 ? 0 : 1
    setPlans(prev => prev.map(p => p.id === task.id ? { ...p, is_done: nd } : p))
    await updatePlan(task.id, { is_done: nd })
    if (nd === 1 && user) {
      showToast('🎉 完了！+10 EXP')
      await saveUserFields(username, { current_points: (user.current_points ?? 0) + 10 })
      setUser(prev => prev ? { ...prev, current_points: (prev.current_points ?? 0) + 10 } : prev)
    }
  }
  async function moveTask(task: PlanRow, days: number) {
    const base = new Date((task.task_date ?? todayStr()) + 'T00:00:00')
    base.setDate(base.getDate() + days)
    const nd = base.toISOString().slice(0, 10)
    setPlans(prev => prev.map(p => p.id === task.id ? { ...p, task_date: nd } : p))
    await updatePlan(task.id, { task_date: nd })
    showToast(`📅 ${nd.slice(5).replace('-','/')} に移動`)
  }
  async function addTask() {
    if (!newTask.task_name.trim()) { showToast('タスク名を入力してください'); return }
    await insertPlan({
      username,
      big_plan: newTask.big_plan || selectedBig || '未分類',
      mid_plan: newTask.mid_plan || selectedMid || '未分類',
      task_name: newTask.task_name,
      task_date: selectedDate,
      is_done: 0, video_url: '', task_type: newTask.task_type,
      planned_minutes: newTask.planned_minutes,
      material_id: '', page_range: '', deadline: '', month_plan: '',
    })
    const updated = await loadPlans(username)
    setPlans(updated)
    setNewTask({ task_name: '', big_plan: '', mid_plan: '', task_type: 'reading', planned_minutes: 30 })
    setShowAdd(false)
    showToast('✅ タスク追加！+5 EXP')
    if (user) await saveUserFields(username, { current_points: (user.current_points ?? 0) + 5 })
  }

  async function completeWizard() {
    if (!wizData.big_plan.trim() || !wizData.task_name.trim()) {
      showToast('ゴールと最初のタスクを入力してください')
      return
    }
    await insertPlan({
      username,
      big_plan:        wizData.big_plan,
      mid_plan:        wizData.mid_plan  || '今月のタスク',
      task_name:       wizData.task_name,
      task_date:       wizData.task_date,
      is_done:         0,
      video_url:       '',
      task_type:       wizData.task_type,
      planned_minutes: wizData.planned_minutes,
      material_id:     '',
      page_range:      '',
      deadline:        wizData.deadline,
      month_plan:      wizData.month_plan,
    })
    const updated = await loadPlans(username)
    setPlans(updated)
    setShowWizard(false)
    setWizStep(1)
    setWizData({ big_plan: '', deadline: '', mid_plan: '', month_plan: '', task_name: '', task_date: todayStr(), task_type: 'reading', planned_minutes: 30 })
    showToast('🏆 新しい計画を作成しました！+20 EXP')
    if (user) await saveUserFields(username, { current_points: (user.current_points ?? 0) + 20 })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-5xl mb-4 animate-bounce">📚</div><p className="text-gray-500">読み込み中...</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-bold animate-bounce">{toast}</div>
      )}

      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white px-4 pt-6 pb-5 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold">🗺️ 学習プラン</h1>
            <p className="text-blue-200 text-xs">{username}</p>
          </div>
          <button onClick={() => { setShowWizard(true); setWizStep(1) }}
            className="bg-yellow-400 text-yellow-900 font-bold px-3 py-1.5 rounded-full text-sm shadow hover:bg-yellow-300 transition active:scale-95">
            ＋ 新しい計画
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/20 rounded-full h-2.5">
            <div className="bg-yellow-300 h-2.5 rounded-full transition-all" style={{ width: `${pctAll}%` }} />
          </div>
          <span className="text-sm font-bold text-yellow-200 whitespace-nowrap">{doneAll}/{totalAll} ({pctAll}%)</span>
        </div>
        <p className="text-center text-yellow-200 text-xs mt-1">⭐ {user?.current_points ?? 0} EXP</p>
      </div>

      {/* パンくずナビ */}
      <div className="flex items-center gap-1 px-4 py-2 text-sm bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm overflow-x-auto">
        <button onClick={() => { setView('big'); setSelectedBig(null); setSelectedMid(null) }}
          className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition ${view === 'big' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-400 hover:text-gray-600'}`}>
          🏆 大計画
        </button>
        {selectedBig && <>
          <span className="text-gray-300">›</span>
          <button onClick={() => { setView('mid'); setSelectedMid(null) }}
            className={`px-2 py-0.5 rounded-lg truncate max-w-[120px] whitespace-nowrap transition ${view === 'mid' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-400 hover:text-gray-600'}`}>
            📅 {selectedBig.length > 10 ? selectedBig.slice(0, 10) + '…' : selectedBig}
          </button>
        </>}
        {selectedMid && <>
          <span className="text-gray-300">›</span>
          <button onClick={() => setView('small')}
            className={`px-2 py-0.5 rounded-lg truncate max-w-[100px] whitespace-nowrap transition ${view === 'small' ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-400 hover:text-gray-600'}`}>
            📝 {selectedMid.length > 8 ? selectedMid.slice(0, 8) + '…' : selectedMid}
          </button>
        </>}
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* ══ 大計画ビュー ══ */}
        {view === 'big' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">🎯 ゴールをタップして中計画へ</p>
            {Object.entries(bigGroups).map(([big, tasks]) => {
              const done = tasks.filter(t => t.is_done === 1).length
              const pct  = Math.round(done / tasks.length * 100)
              return (
                <button key={big} onClick={() => { setSelectedBig(big); setView('mid') }}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition active:scale-95">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-gray-800 text-sm leading-snug flex-1 pr-2">{big}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${pctColor(pct)}`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                    <div className={`h-2 rounded-full transition-all ${pctColor(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{done}/{tasks.length} 完了</span>
                    <span>タップで詳細 ›</span>
                  </div>
                </button>
              )
            })}
            {Object.keys(bigGroups).length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">🎯</div>
                <p className="text-gray-500 font-bold">まだ計画がありません</p>
                <p className="text-gray-400 text-sm mt-1">「＋ 新しい計画」から始めよう！</p>
              </div>
            )}
          </div>
        )}

        {/* ══ 中計画ビュー（月別ガント） ══ */}
        {view === 'mid' && selectedBig && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">📅 月テーマをタップして小計画へ</p>
            {months.map(month => {
              const monthTasks = midPlans.filter(p => (p.task_date ?? '').slice(0, 7) === month)
              const monthGroups = monthTasks.reduce<Record<string, PlanRow[]>>((acc, p) => {
                const k = p.mid_plan || '未分類'; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc
              }, {})
              return (
                <div key={month} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
                    <span className="font-bold text-blue-700 text-sm">{month.replace('-','年')}月</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {Object.entries(monthGroups).map(([mid, tasks]) => {
                      const done = tasks.filter(t => t.is_done === 1).length
                      const pct  = Math.round(done / tasks.length * 100)
                      return (
                        <button key={mid} onClick={() => { setSelectedMid(mid); setView('small') }}
                          className="w-full text-left p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition active:scale-95">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-sm font-bold text-gray-700 truncate flex-1 pr-2">{mid}</span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{done}/{tasks.length}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all ${pctColor(pct)}`} style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {months.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-gray-500">まだ月計画がありません</p>
              </div>
            )}
          </div>
        )}

        {/* ══ 小計画ビュー（週カレンダー） ══ */}
        {view === 'small' && (
          <div className="space-y-3">
            {/* 週カレンダー */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex overflow-x-auto gap-1 p-2">
                {weekDates.map(d => {
                  const isToday  = d === todayStr()
                  const isSel    = d === selectedDate
                  const dayTasks = smallPlans.filter(p => (p.task_date ?? '').slice(0, 10) === d)
                  const hasDone  = dayTasks.some(t => t.is_done === 1)
                  const hasUndone= dayTasks.some(t => t.is_done === 0)
                  const dow      = new Date(d + 'T00:00:00').getDay()
                  return (
                    <button key={d} onClick={() => setSelectedDate(d)}
                      className={`flex flex-col items-center py-2 px-3 rounded-xl min-w-[44px] transition active:scale-95 ${
                        isSel   ? 'bg-indigo-500 text-white shadow' :
                        isToday ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' :
                                  'hover:bg-gray-50 text-gray-600'
                      }`}>
                      <span className="text-[10px] font-medium">{DAY_LABELS[dow]}</span>
                      <span className={`text-base font-bold ${dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : ''} ${isSel ? 'text-white' : ''}`}>
                        {d.slice(8)}
                      </span>
                      <div className="flex gap-0.5 mt-0.5 h-1.5">
                        {hasDone   && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                        {hasUndone && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-gray-100 px-4 py-2 flex justify-between items-center">
                <button onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 7)
                  setSelectedDate(d.toISOString().slice(0, 10))
                }} className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded">← 前週</button>
                <span className="text-xs text-gray-500 font-medium">
                  {selectedDate.slice(0, 7).replace('-','年')}月{selectedDate.slice(8)}日
                </span>
                <button onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 7)
                  setSelectedDate(d.toISOString().slice(0, 10))
                }} className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded">次週 →</button>
              </div>
            </div>

            {/* タスク一覧 */}
            <div className="space-y-2">
              {dayTasks.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
                  <div className="text-4xl mb-2">📝</div>
                  <p className="text-gray-400 text-sm">この日のタスクはありません</p>
                </div>
              ) : dayTasks.map(task => (
                <div key={task.id} className={`bg-white rounded-2xl p-4 shadow-sm border transition ${task.is_done === 1 ? 'border-green-200 opacity-75' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleDone(task)}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${task.is_done === 1 ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}>
                      {task.is_done === 1 && '✓'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${task.is_done === 1 ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.task_name}</p>
                      <div className="flex gap-2 mt-1 text-xs text-gray-400">
                        <span>{taskIcon(task.task_type ?? 'other')}</span>
                        <span>⏱ {task.planned_minutes}分</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => moveTask(task, -1)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition">←</button>
                      <button onClick={() => moveTask(task, 1)}  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition">→</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* タスク追加ボタン */}
            <button onClick={() => setShowAdd(true)}
              className="w-full border-2 border-dashed border-indigo-300 rounded-2xl py-3 text-indigo-500 font-bold hover:bg-indigo-50 transition active:scale-95">
              ＋ この日にタスクを追加
            </button>
          </div>
        )}
      </div>

      {/* ══ タスク追加モーダル ══ */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">📝 タスクを追加</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">タスク名 *</label>
                <input value={newTask.task_name} onChange={e => setNewTask(p => ({ ...p, task_name: e.target.value }))}
                  placeholder="例：説明文読解ドリル P.1-2"
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">種類</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {TASK_TYPES.map(t => (
                    <button key={t.value} onClick={() => setNewTask(p => ({ ...p, task_type: t.value }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${newTask.task_type === t.value ? 'bg-indigo-500 text-white border-indigo-500' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">予想時間：{newTask.planned_minutes}分</label>
                <input type="range" min="5" max="120" step="5" value={newTask.planned_minutes}
                  onChange={e => setNewTask(p => ({ ...p, planned_minutes: Number(e.target.value) }))}
                  className="w-full mt-1 accent-indigo-500" />
              </div>
            </div>
            <button onClick={addTask}
              className="w-full bg-indigo-500 text-white font-bold py-3 rounded-2xl hover:bg-indigo-600 transition active:scale-95">
              ＋ 追加する
            </button>
          </div>
        </div>
      )}

      {/* ══ 計画ウィザード ══ */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">

            {/* ウィザードヘッダー */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {wizStep === 1 ? '🎯 Step 1：ゴールを決める' :
                   wizStep === 2 ? '📅 Step 2：月割り計画' :
                                   '📝 Step 3：最初のタスク'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {wizStep === 1 ? '大きな目標を入力しましょう' :
                   wizStep === 2 ? '今月のテーマと締め切りを決めましょう' :
                                   '今日から取り組む最初のタスクを作りましょう'}
                </p>
              </div>
              <button onClick={() => setShowWizard(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* ステップインジケーター */}
            <div className="flex items-center gap-2">
              {[1,2,3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= wizStep ? 'bg-indigo-500' : 'bg-gray-200'}`} />
              ))}
            </div>

            {/* Step 1：大計画 */}
            {wizStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700">🏆 達成したいゴールは？</label>
                  <input
                    value={wizData.big_plan}
                    onChange={e => setWizData(p => ({ ...p, big_plan: e.target.value }))}
                    placeholder="例：大手門中学校 合格！"
                    className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-xs text-yellow-700 font-medium">💡 ヒント</p>
                  <p className="text-xs text-yellow-600 mt-1">具体的に書くほどやる気が上がります！<br/>例）英検3級合格・NSA検定合格・〇〇中学受験合格</p>
                </div>
                {/* 既存の大計画候補 */}
                {Object.keys(bigGroups).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">または既存のゴールに追加：</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(bigGroups).map(bg => (
                        <button key={bg} onClick={() => setWizData(p => ({ ...p, big_plan: bg }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition ${wizData.big_plan === bg ? 'bg-indigo-500 text-white border-indigo-500' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                          {bg}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => wizData.big_plan.trim() ? setWizStep(2) : showToast('ゴールを入力してください')}
                  className="w-full bg-indigo-500 text-white font-bold py-3 rounded-2xl hover:bg-indigo-600 transition active:scale-95">
                  次へ →
                </button>
              </div>
            )}

            {/* Step 2：中計画 */}
            {wizStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700">📚 今月のテーマ（中計画）</label>
                  <input
                    value={wizData.mid_plan}
                    onChange={e => setWizData(p => ({ ...p, mid_plan: e.target.value }))}
                    placeholder="例：みんなの日本語 第1〜5課"
                    className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">🗓️ 締め切り（任意）</label>
                  <input
                    type="date"
                    value={wizData.deadline}
                    onChange={e => setWizData(p => ({ ...p, deadline: e.target.value }))}
                    className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">📝 今月のメモ（任意）</label>
                  <textarea
                    value={wizData.month_plan}
                    onChange={e => setWizData(p => ({ ...p, month_plan: e.target.value }))}
                    placeholder="例：週3回・1回30分を目標にする"
                    rows={2}
                    className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setWizStep(1)}
                    className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition">
                    ← 戻る
                  </button>
                  <button onClick={() => wizData.mid_plan.trim() ? setWizStep(3) : showToast('今月のテーマを入力してください')}
                    className="flex-2 flex-1 bg-blue-500 text-white font-bold py-3 rounded-2xl hover:bg-blue-600 transition active:scale-95">
                    次へ →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3：小計画（最初のタスク） */}
            {wizStep === 3 && (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <p className="text-xs text-indigo-600">🏆 {wizData.big_plan}</p>
                  <p className="text-xs text-blue-600 mt-0.5">📅 {wizData.mid_plan}</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">📝 最初のタスクは何をする？</label>
                  <input
                    value={wizData.task_name}
                    onChange={e => setWizData(p => ({ ...p, task_name: e.target.value }))}
                    placeholder="例：説明文読解ドリル P.1-2"
                    className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">📅 いつやる？</label>
                  <input
                    type="date"
                    value={wizData.task_date}
                    onChange={e => setWizData(p => ({ ...p, task_date: e.target.value }))}
                    className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">種類</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {TASK_TYPES.map(t => (
                      <button key={t.value} onClick={() => setWizData(p => ({ ...p, task_type: t.value }))}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${wizData.task_type === t.value ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">予想時間：{wizData.planned_minutes}分</label>
                  <input type="range" min="5" max="120" step="5" value={wizData.planned_minutes}
                    onChange={e => setWizData(p => ({ ...p, planned_minutes: Number(e.target.value) }))}
                    className="w-full mt-2 accent-green-500" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setWizStep(2)}
                    className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition">
                    ← 戻る
                  </button>
                  <button onClick={completeWizard}
                    className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl hover:bg-green-600 transition active:scale-95">
                    🏆 計画を作成！
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}