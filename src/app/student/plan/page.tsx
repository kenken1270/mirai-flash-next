'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans, insertPlan, updatePlan, saveUserFields, todayStr, type UserRow, type PlanRow } from '@/lib/student'

/* ─── ユーティリティ ─── */
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
  { value: 'video',    label: '🎥 動画' },
  { value: 'exercise', label: '💪 練習' },
  { value: 'review',   label: '🔁 復習' },
  { value: 'other',    label: '📌 その他' },
]
function taskIcon(type: string) {
  return TASK_TYPES.find(t => t.value === type)?.label.split(' ')[0] ?? '📌'
}

/* ─── メインコンポーネント ─── */
type View = 'big' | 'mid' | 'small'

export default function PlanPage() {
  const router = useRouter()
  const [username, setUsername]           = useState('')
  const [user, setUser]                   = useState<UserRow | null>(null)
  const [plans, setPlans]                 = useState<PlanRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [toast, setToast]                 = useState('')

  /* ドリルダウン状態 */
  const [view, setView]                   = useState<View>('big')
  const [selectedBig, setSelectedBig]     = useState<string | null>(null)
  const [selectedMid, setSelectedMid]     = useState<string | null>(null)
  const [selectedDate, setSelectedDate]   = useState(todayStr())

  /* 追加モーダル */
  const [showAdd, setShowAdd]             = useState(false)
  const [newTask, setNewTask] = useState({
    task_name: '', big_plan: '', mid_plan: '',
    task_type: 'reading', planned_minutes: 30,
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

  /* ─── 集計 ─── */
  const bigGroups = plans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const k = p.big_plan || '未分類'; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc
  }, {})

  const midPlans = selectedBig ? plans.filter(p => p.big_plan === selectedBig) : []
  const midGroups = midPlans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const k = p.mid_plan || '未分類'; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc
  }, {})
  const months = getMonthRange(midPlans)

  const smallPlans = selectedMid
    ? plans.filter(p => p.big_plan === selectedBig && p.mid_plan === selectedMid)
    : plans
  const weekDates = getWeekDates(selectedDate)
  const dayTasks  = smallPlans.filter(p => (p.task_date ?? '').slice(0, 10) === selectedDate)

  const totalAll = plans.length
  const doneAll  = plans.filter(p => p.is_done === 1).length
  const pctAll   = totalAll > 0 ? Math.round(doneAll / totalAll * 100) : 0

  /* ─── アクション ─── */
  async function toggleDone(task: PlanRow) {
    const nd = task.is_done === 1 ? 0 : 1
    setPlans(prev => prev.map(p => p.id === task.id ? { ...p, is_done: nd } : p))
    await updatePlan(task.id, { is_done: nd })
    if (nd === 1 && user) {
      showToast('🎉 完了！ +10 EXP')
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
    showToast('✅ タスク追加！ +5 EXP')
    if (user) await saveUserFields(username, { current_points: (user.current_points ?? 0) + 5 })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-indigo-50">
      <div className="text-center"><div className="text-5xl mb-4 animate-bounce">📅</div><p className="text-gray-500">読み込み中...</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-bold animate-bounce">{toast}</div>
      )}

      {/* ── ヘッダー ── */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white px-4 pt-10 pb-5 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold">📅 学習プラン</h1>
            <p className="text-blue-200 text-xs">{username}</p>
          </div>
          <button onClick={() => router.push('/student')}
            className="bg-white/20 px-3 py-1 rounded-full text-sm hover:bg-white/30 transition">← ホーム</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/20 rounded-full h-2.5">
            <div className="bg-yellow-300 h-2.5 rounded-full transition-all" style={{ width: `${pctAll}%` }} />
          </div>
          <span className="text-sm font-bold text-yellow-200 whitespace-nowrap">{doneAll}/{totalAll} ({pctAll}%)</span>
        </div>
        <p className="text-center text-yellow-200 text-xs mt-1">⭐ {user?.current_points ?? 0} EXP</p>
      </div>

      {/* ── パンくずナビ ── */}
      <div className="flex items-center gap-1 px-4 py-2 text-sm bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <button onClick={() => { setView('big'); setSelectedBig(null); setSelectedMid(null) }}
          className={`px-2 py-0.5 rounded-lg transition ${view === 'big' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-400 hover:text-gray-600'}`}>
          🎯 大計画
        </button>
        {selectedBig && <>
          <span className="text-gray-300">›</span>
          <button onClick={() => { setView('mid'); setSelectedMid(null) }}
            className={`px-2 py-0.5 rounded-lg transition truncate max-w-[120px] ${view === 'mid' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-400 hover:text-gray-600'}`}>
            📆 {selectedBig.length > 10 ? selectedBig.slice(0, 10) + '…' : selectedBig}
          </button>
        </>}
        {selectedMid && <>
          <span className="text-gray-300">›</span>
          <span className="px-2 py-0.5 rounded-lg bg-green-100 text-green-700 font-bold truncate max-w-[100px]">
            📝 {selectedMid.length > 8 ? selectedMid.slice(0, 8) + '…' : selectedMid}
          </span>
        </>}
      </div>

      {/* ══════════════════════════════
          🎯 大計画ビュー
      ══════════════════════════════ */}
      {view === 'big' && (
        <div className="px-4 mt-4 space-y-4">
          <p className="text-xs text-gray-400 text-center">目標をタップすると月別の詳細が見られます</p>
          {Object.entries(bigGroups).map(([bigPlan, tasks]) => {
            const done  = tasks.filter(t => t.is_done === 1).length
            const total = tasks.length
            const pct   = total > 0 ? Math.round(done / total * 100) : 0
            const mids  = [...new Set(tasks.map(t => t.mid_plan).filter(Boolean))]
            const ms    = getMonthRange(tasks)
            return (
              <button key={bigPlan} onClick={() => { setSelectedBig(bigPlan); setView('mid') }}
                className="w-full text-left bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition active:scale-98">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 leading-tight">{bigPlan}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{mids.length}テーマ • {ms.length > 0 ? `${ms[0]}〜${ms[ms.length-1]}` : '日程未設定'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-2xl font-bold ${pct >= 80 ? 'text-green-500' : 'text-indigo-500'}`}>{pct}%</div>
                    <div className="text-xs text-gray-400">{done}/{total}</div>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
                  <div className={`${pctColor(pct)} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {mids.slice(0, 4).map(m => (
                    <span key={m} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 truncate max-w-[120px]">{m}</span>
                  ))}
                  {mids.length > 4 && <span className="text-xs text-gray-400">+{mids.length - 4}件</span>}
                </div>
                <p className="text-xs text-indigo-400 mt-3 text-right">タップして詳細を見る →</p>
              </button>
            )
          })}
          {Object.keys(bigGroups).length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">🎯</div>
              <p className="font-bold">まだ計画がありません</p>
              <p className="text-xs mt-1">小計画タブからタスクを追加してください</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════
          📆 中計画ビュー（月別ガントチャート）
      ══════════════════════════════ */}
      {view === 'mid' && selectedBig && (
        <div className="mt-4">
          <div className="px-4 mb-3">
            <h2 className="font-bold text-gray-700 text-sm">📆 月別進捗マップ</h2>
            <p className="text-xs text-gray-400">教材・テーマをタップすると日別タスクが見られます</p>
          </div>

          {/* ガントチャート表 */}
          <div className="overflow-x-auto px-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" style={{ minWidth: `${180 + months.length * 80}px` }}>
              {/* ヘッダー行 */}
              <div className="flex border-b border-gray-100 bg-gray-50">
                <div className="w-44 flex-shrink-0 px-3 py-2 text-xs font-bold text-gray-500">教材 / テーマ</div>
                {months.map(m => (
                  <div key={m} className="w-20 flex-shrink-0 text-center px-1 py-2 text-xs font-bold text-gray-500">
                    {m.slice(5)}月
                  </div>
                ))}
                <div className="w-16 flex-shrink-0 text-center px-1 py-2 text-xs font-bold text-gray-500">合計</div>
              </div>

              {/* データ行 */}
              {Object.entries(midGroups).map(([midPlan, tasks]) => {
                const totalMid = tasks.length
                const doneMid  = tasks.filter(t => t.is_done === 1).length
                const pctMid   = totalMid > 0 ? Math.round(doneMid / totalMid * 100) : 0
                return (
                  <button key={midPlan} onClick={() => { setSelectedMid(midPlan); setView('small') }}
                    className="w-full flex border-b border-gray-50 hover:bg-indigo-50 transition text-left items-center">
                    {/* テーマ名 */}
                    <div className="w-44 flex-shrink-0 px-3 py-3">
                      <p className="text-xs font-bold text-gray-700 leading-tight line-clamp-2">{midPlan || '（未分類）'}</p>
                    </div>
                    {/* 月別セル */}
                    {months.map(m => {
                      const mTasks = tasks.filter(t => (t.task_date ?? '').slice(0, 7) === m)
                      const mDone  = mTasks.filter(t => t.is_done === 1).length
                      const mTotal = mTasks.length
                      const mPct   = mTotal > 0 ? Math.round(mDone / mTotal * 100) : 0
                      return (
                        <div key={m} className="w-20 flex-shrink-0 px-2 py-3 flex flex-col items-center gap-1">
                          {mTotal > 0 ? (
                            <>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className={`${pctColor(mPct)} h-2 rounded-full`} style={{ width: `${mPct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{mDone}/{mTotal}</span>
                            </>
                          ) : (
                            <span className="text-gray-200 text-lg">—</span>
                          )}
                        </div>
                      )
                    })}
                    {/* 合計 */}
                    <div className="w-16 flex-shrink-0 px-2 py-3 flex flex-col items-center">
                      <div className={`text-sm font-bold ${pctMid >= 80 ? 'text-green-500' : 'text-indigo-500'}`}>{pctMid}%</div>
                      <div className="text-xs text-gray-400">{doneMid}/{totalMid}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 凡例 */}
          <div className="flex gap-3 justify-center mt-3 px-4">
            {[['bg-green-400','80%以上'],['bg-blue-400','50〜79%'],['bg-yellow-400','1〜49%'],['bg-gray-200','0%']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${c}`} />
                <span className="text-xs text-gray-400">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          📝 小計画ビュー（週カレンダー）
      ══════════════════════════════ */}
      {view === 'small' && (
        <div>
          {selectedMid && (
            <div className="mx-4 mt-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-400">表示中のテーマ</p>
                <p className="font-bold text-indigo-700 text-sm">{selectedMid}</p>
              </div>
              <button onClick={() => setSelectedMid(null)}
                className="text-xs text-indigo-400 hover:text-indigo-600 border border-indigo-300 rounded-lg px-2 py-1">全て表示</button>
            </div>
          )}

          {/* 週カレンダー */}
          <div className="px-4 mt-3 overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-1">
              {weekDates.map(date => {
                const cnt  = smallPlans.filter(p => (p.task_date ?? '').slice(0,10) === date).length
                const done = smallPlans.filter(p => (p.task_date ?? '').slice(0,10) === date && p.is_done===1).length
                const isToday = date === todayStr()
                const isSel   = date === selectedDate
                const [,mm,dd] = date.split('-')
                const dow = ['日','月','火','水','木','金','土'][new Date(date+'T00:00:00').getDay()]
                return (
                  <button key={date} onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center px-3 py-2 rounded-2xl min-w-[52px] transition border-2 ${
                      isSel   ? 'bg-indigo-500 text-white border-indigo-600 shadow-md scale-105' :
                      isToday ? 'bg-yellow-100 border-yellow-400 text-yellow-700' :
                                'bg-white border-gray-200 text-gray-600'
                    }`}>
                    <span className={`text-xs ${isSel ? 'text-indigo-200' : 'text-gray-400'}`}>{dow}</span>
                    <span className="text-sm font-bold">{dd}</span>
                    <span className="text-xs">{mm}/{dd}</span>
                    {cnt > 0 && (
                      <span className={`text-xs font-bold mt-0.5 ${done===cnt ? 'text-green-400' : isSel ? 'text-white' : 'text-indigo-500'}`}>
                        {done}/{cnt}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 日付サマリー */}
          <div className="px-4 mt-2">
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-700 text-sm">
                {selectedDate === todayStr() ? '📌 今日' : `📅 ${selectedDate.slice(5).replace('-','/')}`}
                　{dayTasks.length > 0 && <span className="text-gray-400 font-normal text-xs">{dayTasks.filter(t=>t.is_done===1).length}/{dayTasks.length} 完了</span>}
              </h2>
              {dayTasks.length > 0 && (
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div className="bg-indigo-400 h-2 rounded-full transition-all"
                    style={{ width: `${Math.round(dayTasks.filter(t=>t.is_done===1).length/dayTasks.length*100)}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* タスクカード */}
          <div className="px-4 mt-2 space-y-2">
            {dayTasks.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">この日のタスクはありません</p>
              </div>
            )}
            {dayTasks.map(task => (
              <div key={task.id} className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition ${
                task.is_done===1 ? 'border-green-200 bg-green-50' : 'border-gray-100'
              }`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleDone(task)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                      task.is_done===1 ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                    }`}>
                    {task.is_done===1 && '✓'}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{taskIcon(task.task_type ?? '')}</span>
                      <span className={`font-bold text-sm ${task.is_done===1 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {task.task_name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{task.big_plan}{task.mid_plan ? ` › ${task.mid_plan}` : ''}</p>
                    {task.planned_minutes != null && task.planned_minutes > 0 && (
                      <p className="text-xs text-indigo-400 mt-1">⏱ 予想 {task.planned_minutes}分</p>
                    )}
                  </div>
                  {task.is_done !== 1 && (
                    <div className="flex gap-1">
                      <button onClick={() => moveTask(task, -1)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg">←</button>
                      <button onClick={() => moveTask(task,  1)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg">→</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* タスク追加ボタン */}
          <div className="px-4 mt-5">
            <button onClick={() => setShowAdd(true)}
              className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-4 rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition active:scale-95">
              ＋ タスクを追加
            </button>
          </div>
        </div>
      )}

      {/* ── タスク追加モーダル ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-3xl p-6 w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1">📝 タスクを追加</h2>
            <p className="text-sm text-indigo-400 mb-4">📅 {selectedDate.slice(5).replace('-','/')}</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold text-gray-600">タスク名 *</label>
                <input value={newTask.task_name} onChange={e => setNewTask(p => ({ ...p, task_name: e.target.value }))}
                  placeholder="例：英単語50個"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-600">大計画</label>
                  <input value={newTask.big_plan} onChange={e => setNewTask(p => ({ ...p, big_plan: e.target.value }))}
                    placeholder={selectedBig || '例：受験合格！'}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-600">中計画</label>
                  <input value={newTask.mid_plan} onChange={e => setNewTask(p => ({ ...p, mid_plan: e.target.value }))}
                    placeholder={selectedMid || '例：英検4級単語'}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-600">タスク種別</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {TASK_TYPES.map(t => (
                    <button key={t.value} onClick={() => setNewTask(p => ({ ...p, task_type: t.value }))}
                      className={`py-2 rounded-xl text-sm font-bold border-2 transition ${
                        newTask.task_type === t.value ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-600">予想時間: {newTask.planned_minutes}分</label>
                <input type="range" min={5} max={120} step={5} value={newTask.planned_minutes}
                  onChange={e => setNewTask(p => ({ ...p, planned_minutes: Number(e.target.value) }))}
                  className="w-full mt-1 accent-indigo-500" />
                <div className="flex justify-between text-xs text-gray-400"><span>5分</span><span>60分</span><span>120分</span></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold">キャンセル</button>
              <button onClick={addTask} className="flex-1 bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-3 rounded-2xl font-bold shadow-md">✅ 追加する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}