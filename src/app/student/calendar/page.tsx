'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadPlans, updatePlan, saveUserFields, loadUser, todayStr, type PlanRow, type UserRow } from '@/lib/student'

function formatYM(year: number, month: number) {
  return `${year}-${String(month).padStart(2,'0')}`
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}
function getFirstDow(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}
const DOW_LABELS = ['日','月','火','水','木','金','土']
const BIG_COLORS = [
  'bg-blue-400','bg-purple-400','bg-pink-400','bg-orange-400',
  'bg-teal-400','bg-green-400','bg-rose-400','bg-indigo-400',
]
type ViewMode = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const router = useRouter()
  const [username, setUsername]       = useState('')
  const [user, setUser]               = useState<UserRow | null>(null)
  const [plans, setPlans]             = useState<PlanRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [viewMode, setViewMode]       = useState<ViewMode>('month')
  const [toast, setToast]             = useState('')
  const today = todayStr()
  const [curYear,  setCurYear]        = useState(new Date().getFullYear())
  const [curMonth, setCurMonth]       = useState(new Date().getMonth() + 1)
  const [selDate,  setSelDate]        = useState(today)
  const [slideTask, setSlideTask]     = useState<PlanRow[] | null>(null)
  const [showOverdue, setShowOverdue] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

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

  const colorMap = useCallback(() => {
    const keys = [...new Set(plans.map(p => p.big_plan || '未分類'))]
    const map: Record<string,string> = {}
    keys.forEach((k,i) => { map[k] = BIG_COLORS[i % BIG_COLORS.length] })
    return map
  }, [plans])()

  // 過去の未完了タスク
  const overdueTasks = plans.filter(p =>
    p.is_done !== 1 &&
    (p.task_date ?? '').slice(0,10) < today &&
    (p.task_date ?? '').slice(0,10) !== ''
  ).sort((a,b) => (a.task_date??'').localeCompare(b.task_date??''))

  async function toggleDone(task: PlanRow) {
    const nd = task.is_done === 1 ? 0 : 1
    setPlans(prev => prev.map(p => p.id === task.id ? { ...p, is_done: nd } : p))
    if (slideTask) setSlideTask(prev => prev ? prev.map(p => p.id === task.id ? { ...p, is_done: nd } : p) : prev)
    await updatePlan(task.id, { is_done: nd })
    if (nd === 1 && user) {
      showToast('🎉 完了！ +10 EXP')
      await saveUserFields(username, { current_points: (user.current_points ?? 0) + 10 })
      setUser(prev => prev ? { ...prev, current_points: (prev.current_points ?? 0) + 10 } : prev)
    }
  }

  async function moveToDate(task: PlanRow, targetDate: string) {
    setPlans(prev => prev.map(p => p.id === task.id ? { ...p, task_date: targetDate } : p))
    await updatePlan(task.id, { task_date: targetDate })
    showToast(`📅 ${targetDate.slice(5).replace('-','/')} に移動しました`)
  }

  function openDay(date: string) {
    setSelDate(date)
    setSlideTask(plans.filter(p => (p.task_date ?? '').slice(0,10) === date))
  }

  function prevPeriod() {
    if (viewMode === 'month') {
      if (curMonth === 1) { setCurYear(y => y-1); setCurMonth(12) } else setCurMonth(m => m-1)
    } else {
      const base = new Date(selDate + 'T00:00:00')
      base.setDate(base.getDate() - (viewMode === 'week' ? 7 : 1))
      const nd = base.toISOString().slice(0,10)
      setSelDate(nd); setCurYear(base.getFullYear()); setCurMonth(base.getMonth()+1)
    }
  }
  function nextPeriod() {
    if (viewMode === 'month') {
      if (curMonth === 12) { setCurYear(y => y+1); setCurMonth(1) } else setCurMonth(m => m+1)
    } else {
      const base = new Date(selDate + 'T00:00:00')
      base.setDate(base.getDate() + (viewMode === 'week' ? 7 : 1))
      const nd = base.toISOString().slice(0,10)
      setSelDate(nd); setCurYear(base.getFullYear()); setCurMonth(base.getMonth()+1)
    }
  }
  function goToday() {
    const now = new Date()
    setCurYear(now.getFullYear()); setCurMonth(now.getMonth()+1); setSelDate(today)
  }
  function getWeekDates(center: string): string[] {
    const base = new Date(center + 'T00:00:00')
    const dow = base.getDay()
    return Array.from({length:7}, (_,i) => {
      const d = new Date(base); d.setDate(base.getDate() + i - dow)
      return d.toISOString().slice(0,10)
    })
  }
  function periodTitle() {
    if (viewMode === 'month') return `${curYear}年 ${curMonth}月`
    if (viewMode === 'week') {
      const wk = getWeekDates(selDate)
      return `${wk[0].slice(5).replace('-','/')} 〜 ${wk[6].slice(5).replace('-','/')}`
    }
    return selDate.slice(5).replace('-','/')
  }

  function getTomorrow() {
    const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate()+1)
    return d.toISOString().slice(0,10)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center"><div className="text-5xl mb-4 animate-bounce">📆</div><p className="text-gray-400">読み込み中...</p></div>
    </div>
  )

  /* ══ 月ビュー ══ */
  function MonthView() {
    const days = getDaysInMonth(curYear, curMonth)
    const firstDow = getFirstDow(curYear, curMonth)
    const cells: (number|null)[] = [...Array(firstDow).fill(null), ...Array.from({length:days},(_,i)=>i+1)]
    while (cells.length % 7 !== 0) cells.push(null)
    return (
      <div className="px-2">
        <div className="grid grid-cols-7 mb-1">
          {DOW_LABELS.map((d,i) => (
            <div key={d} className={`text-center text-xs font-bold py-1 ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-400'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="h-16 rounded-xl bg-gray-50 opacity-30" />
            const dateStr = `${formatYM(curYear,curMonth)}-${String(day).padStart(2,'0')}`
            const dayTasks  = plans.filter(p => (p.task_date??'').slice(0,10) === dateStr)
            const done      = dayTasks.filter(t => t.is_done===1).length
            const overdue   = dateStr < today && dayTasks.some(t => t.is_done !== 1)
            const isToday   = dateStr === today
            const isSel     = dateStr === selDate
            const dow       = (firstDow + day - 1) % 7
            return (
              <button key={idx} onClick={() => openDay(dateStr)}
                className={`h-16 rounded-xl p-1 flex flex-col transition active:scale-95 border-2 ${
                  isSel    ? 'border-indigo-400 bg-indigo-50 shadow-md' :
                  isToday  ? 'border-yellow-400 bg-yellow-50' :
                  overdue  ? 'border-red-200 bg-red-50' :
                             'border-transparent bg-white hover:bg-gray-50'
                }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold leading-none ${
                    isToday  ? 'text-yellow-600' :
                    overdue  ? 'text-red-400' :
                    dow===0  ? 'text-red-400' :
                    dow===6  ? 'text-blue-400' : 'text-gray-700'
                  }`}>{day}</span>
                  {overdue && <span className="text-[8px] text-red-400 font-bold">未</span>}
                </div>
                <div className="flex-1 overflow-hidden space-y-0.5 mt-0.5">
                  {dayTasks.slice(0,2).map(t => (
                    <div key={t.id} className={`text-[9px] leading-tight px-1 rounded truncate text-white ${colorMap[t.big_plan||'未分類']} ${t.is_done===1?'opacity-40':''}`}>
                      {t.task_name || t.mid_plan}
                    </div>
                  ))}
                  {dayTasks.length > 2 && <div className="text-[9px] text-gray-400 text-center">+{dayTasks.length-2}</div>}
                </div>
                {dayTasks.length > 0 && done === dayTasks.length && (
                  <div className="text-center text-[9px] text-green-500 font-bold">✓ALL</div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  /* ══ 週ビュー ══ */
  function WeekView() {
    const weekDates = getWeekDates(selDate)
    return (
      <div className="px-2">
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const [,mm,dd] = date.split('-')
            const dayTasks = plans.filter(p => (p.task_date??'').slice(0,10) === date)
            const done     = dayTasks.filter(t => t.is_done===1).length
            const overdue  = date < today && dayTasks.some(t => t.is_done !== 1)
            const isToday  = date === today
            const isSel    = date === selDate
            return (
              <button key={date} onClick={() => openDay(date)}
                className={`rounded-2xl p-2 flex flex-col min-h-[120px] transition border-2 ${
                  isSel   ? 'border-indigo-400 bg-indigo-50 shadow-md' :
                  isToday ? 'border-yellow-400 bg-yellow-50' :
                  overdue ? 'border-red-200 bg-red-50' :
                            'border-gray-100 bg-white hover:bg-gray-50'
                }`}>
                <div className="text-center mb-1">
                  <div className={`text-xs ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-400'}`}>{DOW_LABELS[i]}</div>
                  <div className={`text-lg font-bold leading-none ${isToday?'text-yellow-600':overdue?'text-red-400':'text-gray-700'}`}>{dd}</div>
                  <div className="text-xs text-gray-300">{mm}/{dd}</div>
                  {overdue && <div className="text-[9px] text-red-400 font-bold">⚠️未完了</div>}
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                  {dayTasks.map(t => (
                    <div key={t.id} className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-lg truncate text-white ${colorMap[t.big_plan||'未分類']} ${t.is_done===1?'opacity-40':''}`}>
                      {t.task_name || t.mid_plan}
                    </div>
                  ))}
                </div>
                {dayTasks.length > 0 && (
                  <div className={`text-center text-xs mt-1 font-bold ${done===dayTasks.length?'text-green-500':overdue?'text-red-400':'text-gray-400'}`}>
                    {done}/{dayTasks.length}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  /* ══ 日ビュー ══ */
  function DayView() {
    const dayTasks = plans.filter(p => (p.task_date??'').slice(0,10) === selDate)
    const isOverdueDay = selDate < today
    return (
      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-700">{selDate.slice(5).replace('-','/')} のタスク</h3>
          <span className="text-sm text-gray-400">{dayTasks.filter(t=>t.is_done===1).length}/{dayTasks.length} 完了</span>
        </div>
        {dayTasks.length === 0 && (
          <div className="text-center py-16 text-gray-300"><div className="text-4xl mb-2">📭</div><p>この日のタスクはありません</p></div>
        )}
        <div className="space-y-2">
          {dayTasks.map(t => (
            <div key={t.id} className={`rounded-2xl p-4 border-2 ${t.is_done===1?'border-green-200 bg-green-50':isOverdueDay&&t.is_done!==1?'border-red-200 bg-red-50':'border-gray-100 bg-white'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleDone(t)}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${t.is_done===1?'bg-green-500 border-green-500 text-white':'border-gray-300'}`}>
                  {t.is_done===1 && '✓'}
                </button>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorMap[t.big_plan||'未分類']}`} />
                <div className="flex-1">
                  <p className={`font-bold text-sm ${t.is_done===1?'line-through text-gray-400':'text-gray-800'}`}>{t.task_name}</p>
                  <p className="text-xs text-gray-400">{t.big_plan}{t.mid_plan?` › ${t.mid_plan}`:''}</p>
                  {t.planned_minutes!=null && t.planned_minutes>0 && <p className="text-xs text-indigo-400">⏱ {t.planned_minutes}分</p>}
                </div>
              </div>
              {isOverdueDay && t.is_done !== 1 && (
                <div className="flex gap-2 mt-3 ml-10">
                  <button onClick={() => moveToDate(t, today)}
                    className="flex-1 bg-yellow-100 text-yellow-700 text-xs font-bold py-2 rounded-xl hover:bg-yellow-200 transition active:scale-95">
                    📌 今日に移動
                  </button>
                  <button onClick={() => moveToDate(t, getTomorrow())}
                    className="flex-1 bg-blue-100 text-blue-700 text-xs font-bold py-2 rounded-xl hover:bg-blue-200 transition active:scale-95">
                    📅 明日に移動
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-bold animate-bounce">{toast}</div>
      )}

      {/* ── ヘッダー ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-10 pb-3 sticky top-0 z-20 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-600 text-sm">← ホーム</button>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-gray-800">📆 カレンダー</h1>
            {overdueTasks.length > 0 && (
              <button onClick={() => setShowOverdue(true)}
                className="flex items-center gap-1 bg-red-100 text-red-600 px-2.5 py-1 rounded-full text-xs font-bold hover:bg-red-200 transition animate-pulse">
                ⚠️ 未完了 {overdueTasks.length}件
              </button>
            )}
          </div>
          <button onClick={goToday} className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-bold hover:bg-indigo-200 transition">今日</button>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={prevPeriod} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-600 text-lg active:scale-90">‹</button>
          <span className="font-bold text-gray-800 text-base">{periodTitle()}</span>
          <button onClick={nextPeriod} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-600 text-lg active:scale-90">›</button>
        </div>
        <div className="flex gap-1 mt-2 bg-gray-100 rounded-xl p-1">
          {(['month','week','day'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition ${viewMode===v?'bg-white text-indigo-600 shadow-sm':'text-gray-400'}`}>
              {v==='month'?'月':v==='week'?'週':'日'}
            </button>
          ))}
        </div>
      </div>

      {/* 凡例 */}
      {Object.keys(colorMap).length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-gray-50">
          {Object.entries(colorMap).map(([k, c]) => (
            <div key={k} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${c}`} />
              <span className="text-xs text-gray-500 truncate max-w-[80px]">{k}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2">
        {viewMode === 'month' && <MonthView />}
        {viewMode === 'week'  && <WeekView />}
        {viewMode === 'day'   && <DayView />}
      </div>

      {/* 日別スライドアップ */}
      {slideTask !== null && viewMode !== 'day' && (
        <div className="fixed inset-0 z-40" onClick={() => setSlideTask(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[65vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">
                  {selDate.slice(5).replace('-','/')}
                  {selDate === today && <span className="ml-2 text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">今日</span>}
                  {selDate < today && <span className="ml-2 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">過去</span>}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{slideTask.filter(t=>t.is_done===1).length}/{slideTask.length} 完了</span>
                <button onClick={() => setSlideTask(null)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
              </div>
            </div>
            {slideTask.length === 0 && (
              <div className="text-center py-10 text-gray-300"><div className="text-3xl mb-2">📭</div><p className="text-sm">タスクなし</p></div>
            )}
            <div className="px-4 py-3 space-y-2">
              {slideTask.map(task => (
                <div key={task.id} className={`rounded-2xl p-3 border-2 ${task.is_done===1?'border-green-200 bg-green-50':selDate<today?'border-red-100 bg-red-50':'border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleDone(task)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs ${task.is_done===1?'bg-green-500 border-green-500 text-white':'border-gray-300'}`}>
                      {task.is_done===1&&'✓'}
                    </button>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorMap[task.big_plan||'未分類']}`} />
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${task.is_done===1?'line-through text-gray-400':'text-gray-800'}`}>{task.task_name}</p>
                      <p className="text-xs text-gray-400">{task.mid_plan}</p>
                    </div>
                  </div>
                  {selDate < today && task.is_done !== 1 && (
                    <div className="flex gap-2 mt-2 ml-9">
                      <button onClick={() => moveToDate(task, today)}
                        className="flex-1 bg-yellow-100 text-yellow-700 text-xs font-bold py-1.5 rounded-xl hover:bg-yellow-200 transition">
                        📌 今日に移動
                      </button>
                      <button onClick={() => moveToDate(task, getTomorrow())}
                        className="flex-1 bg-blue-100 text-blue-700 text-xs font-bold py-1.5 rounded-xl hover:bg-blue-200 transition">
                        📅 明日に移動
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 pb-6">
              <button onClick={() => { setSlideTask(null); setViewMode('day') }}
                className="w-full bg-indigo-50 text-indigo-600 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-100 transition">
                この日の詳細を見る →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 過去の未完了一覧パネル */}
      {showOverdue && (
        <div className="fixed inset-0 z-50" onClick={() => setShowOverdue(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[75vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-red-100 bg-red-50 rounded-t-3xl">
              <div>
                <h3 className="font-bold text-red-700">⚠️ 過去の未完了タスク</h3>
                <p className="text-xs text-red-400 mt-0.5">今日か明日に移動して片付けましょう！</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{overdueTasks.length}件</span>
                <button onClick={() => setShowOverdue(false)} className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-red-400">✕</button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              {overdueTasks.map(task => (
                <div key={task.id} className="bg-white rounded-2xl p-4 border-2 border-red-100 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${colorMap[task.big_plan||'未分類']}`} />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-800">{task.task_name}</p>
                      <p className="text-xs text-gray-400">{task.big_plan}{task.mid_plan?` › ${task.mid_plan}`:''}</p>
                      <p className="text-xs text-red-400 font-bold mt-0.5">
                        📅 予定日: {(task.task_date??'').slice(5).replace('-','/')}
                        　（{Math.floor((new Date(today+'T00:00:00').getTime() - new Date((task.task_date??today)+'T00:00:00').getTime()) / 86400000)}日前）
                      </p>
                    </div>
                    <button onClick={() => toggleDone(task)}
                      className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0 hover:border-green-400 transition">
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { moveToDate(task, today); }}
                      className="flex-1 bg-yellow-100 text-yellow-700 text-xs font-bold py-2.5 rounded-xl hover:bg-yellow-200 transition active:scale-95">
                      📌 今日に移動
                    </button>
                    <button onClick={() => { moveToDate(task, getTomorrow()); }}
                      className="flex-1 bg-blue-100 text-blue-700 text-xs font-bold py-2.5 rounded-xl hover:bg-blue-200 transition active:scale-95">
                      📅 明日に移動
                    </button>
                    <button onClick={() => toggleDone(task)}
                      className="flex-1 bg-green-100 text-green-700 text-xs font-bold py-2.5 rounded-xl hover:bg-green-200 transition active:scale-95">
                      ✓ 完了にする
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 pb-8">
              <button onClick={() => setShowOverdue(false)}
                className="w-full bg-gray-100 text-gray-500 py-3 rounded-2xl font-bold text-sm">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}