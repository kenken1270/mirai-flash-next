import { writeFileSync } from 'fs';

const page = `'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans, insertPlan, updatePlan, deletePlan, saveUserFields, todayStr, type UserRow, type PlanRow } from '@/lib/student'

function getWeekDates(center: string): string[] {
  const dates: string[] = []
  const base = new Date(center + 'T00:00:00')
  for (let i = -3; i <= 3; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function pctColor(pct: number) {
  if (pct >= 80) return '#10B981'
  if (pct >= 50) return '#F59E0B'
  if (pct > 0)   return '#FCD34D'
  return '#E5E7EB'
}

const TASK_TYPES = [
  { value: 'reading',  label: '📖 読む' },
  { value: 'writing',  label: '✏️ 書く' },
  { value: 'video',    label: '🎬 動画' },
  { value: 'exercise', label: '💪 練習' },
  { value: 'review',   label: '🔁 復習' },
  { value: 'other',    label: '📌 その他' },
]

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

  const [view, setView]                 = useState<View>('big')
  const [selectedBig, setSelectedBig]   = useState<string | null>(null)
  const [selectedMid, setSelectedMid]   = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(todayStr())

  // ===== 編集モーダル =====
  const [editTask, setEditTask] = useState<PlanRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editType, setEditType] = useState('reading')
  const [editMin,  setEditMin]  = useState(30)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // ===== 追加モーダル =====
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({ task_name: '', task_type: 'reading', planned_minutes: 30 })

  // ===== ウィザード =====
  const [showWizard, setShowWizard] = useState(false)
  const [wizStep, setWizStep]       = useState<WizStep>(1)
  const [wizData, setWizData]       = useState({
    big_plan: '', deadline: '', mid_plan: '', month_plan: '',
    task_name: '', task_date: todayStr(), task_type: 'reading', planned_minutes: 30,
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

  // ===== 編集モーダルを開く =====
  function openEdit(task: PlanRow) {
    setEditTask(task)
    setEditName(task.task_name)
    setEditDate(task.task_date ?? todayStr())
    setEditType(task.task_type ?? 'reading')
    setEditMin(task.planned_minutes ?? 30)
    setDeleteConfirm(false)
  }

  // ===== 編集保存 =====
  async function saveEdit() {
    if (!editTask) return
    await updatePlan(editTask.id, {
      task_name: editName,
      task_date: editDate,
      task_type: editType,
      planned_minutes: editMin,
    })
    setPlans(prev => prev.map(p => p.id === editTask.id
      ? { ...p, task_name: editName, task_date: editDate, task_type: editType, planned_minutes: editMin }
      : p
    ))
    setEditTask(null)
    showToast('✏️ 変更した！計画を修正できたね！+5EXP')
    if (user) await saveUserFields(username, { current_points: (user.current_points ?? 0) + 5 })
  }

  // ===== 削除 =====
  async function handleDelete() {
    if (!editTask) return
    await deletePlan(editTask.id)
    setPlans(prev => prev.filter(p => p.id !== editTask.id))
    setEditTask(null)
    showToast('🗑️ タスクを削除しました')
  }

  // ===== 完了トグル =====
  async function toggleDone(task: PlanRow) {
    const nd = task.is_done === 1 ? 0 : 1
    setPlans(prev => prev.map(p => p.id === task.id ? { ...p, is_done: nd } : p))
    await updatePlan(task.id, { is_done: nd })
    if (nd === 1 && user) {
      showToast('🎉 できた！+10 EXP')
      await saveUserFields(username, { current_points: (user.current_points ?? 0) + 10 })
      setUser(prev => prev ? { ...prev, current_points: (prev.current_points ?? 0) + 10 } : prev)
    }
  }

  // ===== タスク追加 =====
  async function addTask() {
    if (!newTask.task_name.trim()) { showToast('タスク名を入力してください'); return }
    await insertPlan({
      username,
      big_plan: selectedBig || '未分類',
      mid_plan: selectedMid || '未分類',
      task_name: newTask.task_name,
      task_date: selectedDate,
      is_done: 0, video_url: '', task_type: newTask.task_type,
      planned_minutes: newTask.planned_minutes,
      material_id: '', page_range: '', deadline: '', month_plan: '',
    })
    const updated = await loadPlans(username)
    setPlans(updated)
    setNewTask({ task_name: '', task_type: 'reading', planned_minutes: 30 })
    setShowAdd(false)
    showToast('✅ タスク追加！+5 EXP')
    if (user) await saveUserFields(username, { current_points: (user.current_points ?? 0) + 5 })
  }

  // ===== ウィザード完了 =====
  async function completeWizard() {
    if (!wizData.big_plan.trim() || !wizData.task_name.trim()) {
      showToast('ゴールと最初のタスクを入力してください'); return
    }
    await insertPlan({
      username, big_plan: wizData.big_plan,
      mid_plan: wizData.mid_plan || '今月のタスク',
      task_name: wizData.task_name, task_date: wizData.task_date,
      is_done: 0, video_url: '', task_type: wizData.task_type,
      planned_minutes: wizData.planned_minutes,
      material_id: '', page_range: '', deadline: wizData.deadline, month_plan: wizData.month_plan,
    })
    const updated = await loadPlans(username)
    setPlans(updated)
    setShowWizard(false); setWizStep(1)
    setWizData({ big_plan: '', deadline: '', mid_plan: '', month_plan: '', task_name: '', task_date: todayStr(), task_type: 'reading', planned_minutes: 30 })
    showToast('🏆 新しい計画を作成！+20 EXP')
    if (user) await saveUserFields(username, { current_points: (user.current_points ?? 0) + 20 })
  }

  const bigGroups  = plans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const k = p.big_plan || '未分類'; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc
  }, {})
  const midPlans   = selectedBig ? plans.filter(p => p.big_plan === selectedBig) : []
  const midGroups  = midPlans.reduce<Record<string, PlanRow[]>>((acc, p) => {
    const k = p.mid_plan || '未分類'; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc
  }, {})
  const smallPlans = selectedMid
    ? plans.filter(p => p.big_plan === selectedBig && p.mid_plan === selectedMid)
    : plans
  const weekDates  = getWeekDates(selectedDate)
  const dayTasks   = smallPlans.filter(p => (p.task_date ?? '').slice(0, 10) === selectedDate)
  const totalAll   = plans.length
  const doneAll    = plans.filter(p => p.is_done === 1).length
  const pctAll     = totalAll > 0 ? Math.round(doneAll / totalAll * 100) : 0

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFFDF0' }}>
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🐕</div>
        <p className="font-bold" style={{ color: '#78350F' }}>読み込み中...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: '#FFFDF0' }}>

      {/* トースト */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full shadow-lg font-bold text-white animate-bounce"
          style={{ background: '#10B981' }}>{toast}</div>
      )}

      {/* ヘッダー */}
      <div className="px-4 pt-4 pb-4" style={{ background: 'linear-gradient(180deg, #FCD34D, #FDE68A)' }}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="font-black text-xl" style={{ color: '#1C1410' }}>🗺️ 学習プラン</h1>
            <p className="text-xs mt-0.5" style={{ color: '#78350F' }}>⭐ {user?.current_points ?? 0} EXP</p>
          </div>
          <button onClick={() => { setShowWizard(true); setWizStep(1) }}
            className="font-black px-4 py-2 rounded-full shadow active:scale-95 transition-all text-sm"
            style={{ background: '#1C1410', color: '#FCD34D' }}>
            ＋ 新しい計画
          </button>
        </div>
        <div className="bg-white/40 rounded-full h-3 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: \`\${pctAll}%\`, background: '#92400E' }} />
        </div>
        <p className="text-xs mt-1 text-right font-bold" style={{ color: '#78350F' }}>
          {doneAll}/{totalAll} ({pctAll}%)
        </p>
      </div>

      {/* パンくず */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b sticky top-16 z-10 shadow-sm overflow-x-auto"
        style={{ borderColor: '#FDE68A' }}>
        <button onClick={() => { setView('big'); setSelectedBig(null); setSelectedMid(null) }}
          className="px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap transition-all"
          style={{ background: view === 'big' ? '#FCD34D' : 'transparent', color: view === 'big' ? '#1C1410' : '#9CA3AF' }}>
          🏆 大計画
        </button>
        {selectedBig && <>
          <span style={{ color: '#D1D5DB' }}>›</span>
          <button onClick={() => { setView('mid'); setSelectedMid(null) }}
            className="px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap transition-all max-w-[120px] truncate"
            style={{ background: view === 'mid' ? '#FCD34D' : 'transparent', color: view === 'mid' ? '#1C1410' : '#9CA3AF' }}>
            📅 {selectedBig.length > 10 ? selectedBig.slice(0,10)+'…' : selectedBig}
          </button>
        </>}
        {selectedMid && <>
          <span style={{ color: '#D1D5DB' }}>›</span>
          <button onClick={() => setView('small')}
            className="px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap transition-all max-w-[100px] truncate"
            style={{ background: view === 'small' ? '#FCD34D' : 'transparent', color: view === 'small' ? '#1C1410' : '#9CA3AF' }}>
            📝 {selectedMid.length > 8 ? selectedMid.slice(0,8)+'…' : selectedMid}
          </button>
        </>}
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* 大計画 */}
        {view === 'big' && (
          <div className="space-y-3">
            <p className="text-xs font-bold" style={{ color: '#B45309' }}>🎯 ゴールをタップして中計画へ</p>
            {Object.entries(bigGroups).map(([big, tasks]) => {
              const done = tasks.filter(t => t.is_done === 1).length
              const pct  = Math.round(done / tasks.length * 100)
              return (
                <button key={big} onClick={() => { setSelectedBig(big); setView('mid') }}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm text-left active:scale-95 transition-all"
                  style={{ border: '2px solid #FDE68A' }}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-base flex-1 pr-2" style={{ color: '#1C1410' }}>{big}</span>
                    <span className="text-xs font-black px-2 py-1 rounded-full text-white"
                      style={{ background: pctColor(pct) }}>{pct}%</span>
                  </div>
                  <div className="rounded-full h-2.5 overflow-hidden" style={{ background: '#FEF3C7' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: \`\${pct}%\`, background: pctColor(pct) }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs" style={{ color: '#92400E' }}>
                    <span>{done}/{tasks.length}完了</span>
                    <span>タップで詳細 ›</span>
                  </div>
                </button>
              )
            })}
            {Object.keys(bigGroups).length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl" style={{ border: '2px dashed #FDE68A' }}>
                <div className="text-5xl mb-3">🎯</div>
                <p className="font-black" style={{ color: '#78350F' }}>まだ計画がありません</p>
                <p className="text-sm mt-1" style={{ color: '#B45309' }}>「＋ 新しい計画」から始めよう！</p>
              </div>
            )}
          </div>
        )}

        {/* 中計画 */}
        {view === 'mid' && selectedBig && (
          <div className="space-y-3">
            <p className="text-xs font-bold" style={{ color: '#B45309' }}>📅 テーマをタップして小計画へ</p>
            {Object.entries(midGroups).map(([mid, tasks]) => {
              const done = tasks.filter(t => t.is_done === 1).length
              const pct  = Math.round(done / tasks.length * 100)
              return (
                <button key={mid} onClick={() => { setSelectedMid(mid); setView('small') }}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm text-left active:scale-95 transition-all"
                  style={{ border: '2px solid #FDE68A' }}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-base flex-1 pr-2" style={{ color: '#1C1410' }}>{mid}</span>
                    <span className="text-xs font-black px-2 py-1 rounded-full text-white"
                      style={{ background: pctColor(pct) }}>{pct}%</span>
                  </div>
                  <div className="rounded-full h-2.5 overflow-hidden" style={{ background: '#FEF3C7' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: \`\${pct}%\`, background: pctColor(pct) }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs" style={{ color: '#92400E' }}>
                    <span>{done}/{tasks.length}完了</span>
                    <span>タップで詳細 ›</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* 小計画（週カレンダー＋タスク） */}
        {view === 'small' && (
          <div className="space-y-3">
            {/* 週カレンダー */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '2px solid #FDE68A' }}>
              <div className="flex overflow-x-auto gap-1 p-2">
                {weekDates.map(d => {
                  const isToday = d === todayStr()
                  const isSel   = d === selectedDate
                  const dt      = smallPlans.filter(p => (p.task_date ?? '').slice(0,10) === d)
                  const hasDone = dt.some(t => t.is_done === 1)
                  const hasUndone = dt.some(t => t.is_done === 0)
                  const dow     = new Date(d + 'T00:00:00').getDay()
                  return (
                    <button key={d} onClick={() => setSelectedDate(d)}
                      className="flex flex-col items-center py-2 px-3 rounded-xl min-w-[44px] transition-all active:scale-95"
                      style={{
                        background: isSel ? '#FCD34D' : isToday ? '#FEF9C3' : 'transparent',
                        border: isSel ? '2px solid #F59E0B' : isToday ? '2px solid #FDE68A' : '2px solid transparent',
                      }}>
                      <span className="text-xs font-bold" style={{ color: '#78350F' }}>{DAY_LABELS[dow]}</span>
                      <span className="text-lg font-black" style={{ color: dow===0 ? '#EF4444' : dow===6 ? '#3B82F6' : '#1C1410' }}>
                        {d.slice(8)}
                      </span>
                      <div className="flex gap-0.5 mt-0.5 h-2">
                        {hasDone   && <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />}
                        {hasUndone && <span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="border-t px-4 py-2 flex justify-between items-center" style={{ borderColor: '#FDE68A' }}>
                <button onClick={() => {
                  const d = new Date(selectedDate+'T00:00:00'); d.setDate(d.getDate()-7)
                  setSelectedDate(d.toISOString().slice(0,10))
                }} className="text-sm font-bold px-2 py-1 rounded-lg active:scale-95 transition-all"
                  style={{ color: '#78350F' }}>← 前週</button>
                <span className="text-xs font-bold" style={{ color: '#78350F' }}>
                  {selectedDate.slice(0,7).replace('-','年')}月{selectedDate.slice(8)}日
                </span>
                <button onClick={() => {
                  const d = new Date(selectedDate+'T00:00:00'); d.setDate(d.getDate()+7)
                  setSelectedDate(d.toISOString().slice(0,10))
                }} className="text-sm font-bold px-2 py-1 rounded-lg active:scale-95 transition-all"
                  style={{ color: '#78350F' }}>次週 →</button>
              </div>
            </div>

            {/* タスク一覧 */}
            {dayTasks.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl" style={{ border: '2px dashed #FDE68A' }}>
                <div className="text-4xl mb-2">📝</div>
                <p className="font-bold" style={{ color: '#78350F' }}>この日のタスクはないよ</p>
                <p className="text-sm mt-1" style={{ color: '#B45309' }}>下の＋ボタンで追加しよう！</p>
              </div>
            ) : dayTasks.map(task => (
              <div key={task.id}
                className="bg-white rounded-2xl shadow-sm"
                style={{ border: task.is_done===1 ? '2px solid #10B981' : '2px solid #FDE68A', opacity: task.is_done===1 ? 0.75 : 1 }}>
                <div className="flex items-center gap-3 p-4">
                  {/* 完了チェック */}
                  <button onClick={() => toggleDone(task)}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                    style={{
                      background: task.is_done===1 ? '#10B981' : 'white',
                      borderColor: task.is_done===1 ? '#10B981' : '#D1D5DB'
                    }}>
                    {task.is_done===1 && <span className="text-white font-black text-sm">✓</span>}
                  </button>

                  {/* タスク名（タップで編集） */}
                  <button className="flex-1 text-left" onClick={() => openEdit(task)}>
                    <p className="font-bold text-sm"
                      style={{ color: task.is_done===1 ? '#9CA3AF' : '#1C1410', textDecoration: task.is_done===1 ? 'line-through' : 'none' }}>
                      {task.task_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
                      {TASK_TYPES.find(t=>t.value===task.task_type)?.label ?? '📌 その他'} · {task.planned_minutes}分
                    </p>
                  </button>

                  {/* 編集ボタン */}
                  <button onClick={() => openEdit(task)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                    ✏️ 編集
                  </button>
                </div>
              </div>
            ))}

            {/* タスク追加ボタン */}
            <button onClick={() => setShowAdd(true)}
              className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95"
              style={{ border: '2px dashed #F59E0B', color: '#B45309', background: '#FFFDF0' }}>
              ＋ この日にタスクを追加
            </button>
          </div>
        )}
      </div>

      {/* ══ 編集モーダル ══ */}
      {editTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end pb-20"
          onClick={() => { setEditTask(null); setDeleteConfirm(false) }}>
          <div className="bg-white rounded-t-3xl w-full p-5 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-center">
              <h2 className="font-black text-lg" style={{ color: '#1C1410' }}>✏️ タスクを編集</h2>
              <button onClick={() => { setEditTask(null); setDeleteConfirm(false) }}
                className="text-gray-400 text-xl">✕</button>
            </div>

            {/* SRLメッセージ */}
            <div className="px-4 py-3 rounded-2xl" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
              <p className="text-xs font-bold" style={{ color: '#92400E' }}>
                🐕 計画を変えるのは賢い判断！状況に合わせて調整しよう
              </p>
            </div>

            <div>
              <label className="text-xs font-bold" style={{ color: '#78350F' }}>タスク名</label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl text-sm font-bold focus:outline-none"
                style={{ border: '2px solid #FCD34D', background: '#FFFDF0', color: '#1C1410' }} />
            </div>

            <div>
              <label className="text-xs font-bold" style={{ color: '#78350F' }}>日付</label>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl text-sm font-bold focus:outline-none"
                style={{ border: '2px solid #FCD34D', background: '#FFFDF0', color: '#1C1410' }} />
            </div>

            <div>
              <label className="text-xs font-bold" style={{ color: '#78350F' }}>種類</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TASK_TYPES.map(t => (
                  <button key={t.value} onClick={() => setEditType(t.value)}
                    className="text-xs px-3 py-1.5 rounded-full font-bold transition-all active:scale-95"
                    style={{
                      background: editType===t.value ? '#FCD34D' : '#F3F4F6',
                      color: editType===t.value ? '#1C1410' : '#6B7280',
                      border: editType===t.value ? '2px solid #F59E0B' : '2px solid transparent'
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold" style={{ color: '#78350F' }}>予想時間：{editMin}分</label>
              <input type="range" min="5" max="120" step="5" value={editMin}
                onChange={e => setEditMin(Number(e.target.value))}
                className="w-full mt-2" style={{ accentColor: '#F59E0B' }} />
            </div>

            {/* 保存ボタン */}
            <button onClick={saveEdit}
              className="w-full py-3 rounded-2xl font-black text-base shadow active:scale-95 transition-all"
              style={{ background: '#FCD34D', color: '#1C1410', border: '2px solid #F59E0B' }}>
              💾 変更を保存する
            </button>

            {/* 削除ゾーン */}
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)}
                className="w-full py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                style={{ background: '#FEF2F2', color: '#EF4444', border: '2px solid #FECACA' }}>
                🗑️ このタスクを削除する
              </button>
            ) : (
              <div className="space-y-2 p-3 rounded-2xl" style={{ background: '#FEF2F2', border: '2px solid #FECACA' }}>
                <p className="text-sm font-bold text-center" style={{ color: '#EF4444' }}>
                  本当に削除する？
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: 'white', color: '#6B7280', border: '2px solid #E5E7EB' }}>
                    やっぱりやめる
                  </button>
                  <button onClick={handleDelete}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white active:scale-95"
                    style={{ background: '#EF4444' }}>
                    削除する
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ タスク追加モーダル ══ */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end pb-20"
          onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-3xl w-full p-5 space-y-4 max-h-[75vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="font-black text-lg" style={{ color: '#1C1410' }}>📝 タスクを追加</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div>
              <label className="text-xs font-bold" style={{ color: '#78350F' }}>タスク名 *</label>
              <input value={newTask.task_name} onChange={e => setNewTask(p => ({ ...p, task_name: e.target.value }))}
                placeholder="例：説明文読解ドリル P.1-2"
                className="w-full mt-1 px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{ border: '2px solid #FCD34D', background: '#FFFDF0', color: '#1C1410' }} />
            </div>
            <div>
              <label className="text-xs font-bold" style={{ color: '#78350F' }}>種類</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TASK_TYPES.map(t => (
                  <button key={t.value} onClick={() => setNewTask(p => ({ ...p, task_type: t.value }))}
                    className="text-xs px-3 py-1.5 rounded-full font-bold transition-all active:scale-95"
                    style={{
                      background: newTask.task_type===t.value ? '#FCD34D' : '#F3F4F6',
                      color: newTask.task_type===t.value ? '#1C1410' : '#6B7280',
                      border: newTask.task_type===t.value ? '2px solid #F59E0B' : '2px solid transparent'
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold" style={{ color: '#78350F' }}>予想時間：{newTask.planned_minutes}分</label>
              <input type="range" min="5" max="120" step="5" value={newTask.planned_minutes}
                onChange={e => setNewTask(p => ({ ...p, planned_minutes: Number(e.target.value) }))}
                className="w-full mt-2" style={{ accentColor: '#F59E0B' }} />
            </div>
            <button onClick={addTask}
              className="w-full py-3 rounded-2xl font-black text-base shadow active:scale-95 transition-all"
              style={{ background: '#FCD34D', color: '#1C1410', border: '2px solid #F59E0B' }}>
              ＋ 追加する
            </button>
          </div>
        </div>
      )}

      {/* ══ 計画ウィザード ══ */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end pb-20">
          <div className="bg-white rounded-t-3xl w-full p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-black text-lg" style={{ color: '#1C1410' }}>
                  {wizStep===1 ? '🎯 Step1：ゴールを決める' : wizStep===2 ? '📅 Step2：月割り計画' : '📝 Step3：最初のタスク'}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#78350F' }}>
                  {wizStep===1 ? '大きな目標を入力しよう' : wizStep===2 ? '今月のテーマと締め切りを決めよう' : '今日から取り組む最初のタスクを作ろう'}
                </p>
              </div>
              <button onClick={() => setShowWizard(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="flex gap-2">
              {[1,2,3].map(s => (
                <div key={s} className="flex-1 h-2 rounded-full transition-all"
                  style={{ background: s<=wizStep ? '#F59E0B' : '#E5E7EB' }} />
              ))}
            </div>

            {wizStep===1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-black" style={{ color: '#1C1410' }}>🏆 達成したいゴールは？</label>
                  <input value={wizData.big_plan} onChange={e => setWizData(p => ({ ...p, big_plan: e.target.value }))}
                    placeholder="例：大手門中学校 合格！"
                    className="w-full mt-2 px-4 py-3 rounded-xl text-sm focus:outline-none"
                    style={{ border: '2px solid #FCD34D', background: '#FFFDF0', color: '#1C1410' }} />
                </div>
                <div className="px-4 py-3 rounded-2xl" style={{ background: '#FEF9C3' }}>
                  <p className="text-xs font-bold" style={{ color: '#92400E' }}>💡 具体的に書くほどやる気が上がるよ！</p>
                </div>
                {Object.keys(bigGroups).length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-2" style={{ color: '#B45309' }}>または既存のゴールに追加：</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(bigGroups).map(bg => (
                        <button key={bg} onClick={() => setWizData(p => ({ ...p, big_plan: bg }))}
                          className="text-xs px-3 py-1.5 rounded-full font-bold transition-all active:scale-95"
                          style={{
                            background: wizData.big_plan===bg ? '#FCD34D' : '#F3F4F6',
                            color: wizData.big_plan===bg ? '#1C1410' : '#6B7280',
                            border: wizData.big_plan===bg ? '2px solid #F59E0B' : '2px solid transparent'
                          }}>{bg}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => wizData.big_plan.trim() ? setWizStep(2) : showToast('ゴールを入力してください')}
                  className="w-full py-3 rounded-2xl font-black text-base shadow active:scale-95 transition-all"
                  style={{ background: '#FCD34D', color: '#1C1410', border: '2px solid #F59E0B' }}>
                  次へ →
                </button>
              </div>
            )}

            {wizStep===2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-black" style={{ color: '#1C1410' }}>📚 今月のテーマ</label>
                  <input value={wizData.mid_plan} onChange={e => setWizData(p => ({ ...p, mid_plan: e.target.value }))}
                    placeholder="例：みんなの日本語 第1〜5課"
                    className="w-full mt-2 px-4 py-3 rounded-xl text-sm focus:outline-none"
                    style={{ border: '2px solid #FCD34D', background: '#FFFDF0', color: '#1C1410' }} />
                </div>
                <div>
                  <label className="text-sm font-black" style={{ color: '#1C1410' }}>🗓️ 締め切り（任意）</label>
                  <input type="date" value={wizData.deadline} onChange={e => setWizData(p => ({ ...p, deadline: e.target.value }))}
                    className="w-full mt-2 px-4 py-3 rounded-xl text-sm focus:outline-none"
                    style={{ border: '2px solid #FCD34D', background: '#FFFDF0', color: '#1C1410' }} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setWizStep(1)}
                    className="flex-1 py-3 rounded-2xl font-bold"
                    style={{ background: '#F3F4F6', color: '#6B7280' }}>← 戻る</button>
                  <button onClick={() => wizData.mid_plan.trim() ? setWizStep(3) : showToast('今月のテーマを入力してください')}
                    className="flex-1 py-3 rounded-2xl font-black shadow active:scale-95 transition-all"
                    style={{ background: '#FCD34D', color: '#1C1410', border: '2px solid #F59E0B' }}>
                    次へ →
                  </button>
                </div>
              </div>
            )}

            {wizStep===3 && (
              <div className="space-y-4">
                <div className="px-4 py-3 rounded-2xl" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
                  <p className="text-xs font-bold" style={{ color: '#92400E' }}>🏆 {wizData.big_plan}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>📅 {wizData.mid_plan}</p>
                </div>
                <div>
                  <label className="text-sm font-black" style={{ color: '#1C1410' }}>📝 最初のタスクは何をする？</label>
                  <input value={wizData.task_name} onChange={e => setWizData(p => ({ ...p, task_name: e.target.value }))}
                    placeholder="例：説明文読解ドリル P.1-2"
                    className="w-full mt-2 px-4 py-3 rounded-xl text-sm focus:outline-none"
                    style={{ border: '2px solid #FCD34D', background: '#FFFDF0', color: '#1C1410' }} />
                </div>
                <div>
                  <label className="text-sm font-black" style={{ color: '#1C1410' }}>📅 いつやる？</label>
                  <input type="date" value={wizData.task_date} onChange={e => setWizData(p => ({ ...p, task_date: e.target.value }))}
                    className="w-full mt-2 px-4 py-3 rounded-xl text-sm focus:outline-none"
                    style={{ border: '2px solid #FCD34D', background: '#FFFDF0', color: '#1C1410' }} />
                </div>
                <div>
                  <label className="text-sm font-black" style={{ color: '#1C1410' }}>種類</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {TASK_TYPES.map(t => (
                      <button key={t.value} onClick={() => setWizData(p => ({ ...p, task_type: t.value }))}
                        className="text-xs px-3 py-1.5 rounded-full font-bold transition-all active:scale-95"
                        style={{
                          background: wizData.task_type===t.value ? '#FCD34D' : '#F3F4F6',
                          color: wizData.task_type===t.value ? '#1C1410' : '#6B7280',
                          border: wizData.task_type===t.value ? '2px solid #F59E0B' : '2px solid transparent'
                        }}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-black" style={{ color: '#1C1410' }}>予想時間：{wizData.planned_minutes}分</label>
                  <input type="range" min="5" max="120" step="5" value={wizData.planned_minutes}
                    onChange={e => setWizData(p => ({ ...p, planned_minutes: Number(e.target.value) }))}
                    className="w-full mt-2" style={{ accentColor: '#F59E0B' }} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setWizStep(2)}
                    className="flex-1 py-3 rounded-2xl font-bold"
                    style={{ background: '#F3F4F6', color: '#6B7280' }}>← 戻る</button>
                  <button onClick={completeWizard}
                    className="flex-1 py-3 rounded-2xl font-black shadow active:scale-95 transition-all"
                    style={{ background: '#FCD34D', color: '#1C1410', border: '2px solid #F59E0B' }}>
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
`;

writeFileSync('src/app/student/plan/page.tsx', page, 'utf8');
console.log('OK');
