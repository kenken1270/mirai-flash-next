'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadPlans, updatePlan, saveUserFields, loadUser, todayStr, type PlanRow, type UserRow } from '@/lib/student'

/* ─── ユーティリティ ─── */
function formatYM(year: number, month: number) {
  return `${year}-${String(month).padStart(2,'0')}`
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}
function getFirstDow(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}
function isSameDate(a: string, b: string) {
  return a.slice(0,10) === b.slice(0,10)
}

const DOW_LABELS = ['日','月','火','水','木','金','土']
const BIG_COLORS = [
  'bg-blue-400','bg-purple-400','bg-pink-400','bg-orange-400',
  'bg-teal-400','bg-green-400','bg-rose-400','bg-indigo-400',
]

type ViewMode = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [user, setUser]         = useState<UserRow | null>(null)
  const [plans, setPlans]       = useState<PlanRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [toast, setToast]       = useState('')

  const today = todayStr()
  const [curYear,  setCurYear]  = useState(new Date().getFullYear())
  const [curMonth, setCurMonth] = useState(new Date().getMonth() + 1)
  const [selDate,  setSelDate]  = useState(today)
  const [slideTask, setSlideTask] = useState<PlanRow[] | null>(null)

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

  /* ── 大計画ごとの色マップ ── */
  const bigColorMap = useCallback(() => {
    const keys = [...new Set(plans.map(p => p.big_plan || '未分類'))]
    const map: Record<string,string> = {}
    keys.forEach((k,i) => { map[k] = BIG_COLORS[i % BIG_COLORS.length] })
    return map
  }, [plans])

  /* ── アクション ── */
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

  function openDay(date: string) {
    setSelDate(date)
    const tasks = plans.filter(p => (p.task_date ?? '').slice(0,10) === date)
    setSlideTask(tasks)
  }

  /* ── ナビゲーション ── */
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

  /* ── 週の日付リスト ── */
  function getWeekDates(center: string): string[] {
    const base = new Date(center + 'T00:00:00')
    const dow = base.getDay()
    const dates: string[] = []
    for (let i = -dow; i < 7 - dow; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i)
      dates.push(d.toISOString().slice(0,10))
    }
    return dates
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center"><div className="text-5xl mb-4 animate-bounce">📆</div><p className="text-gray-400">読み込み中...</p></div>
    </div>
  )

  const colorMap = bigColorMap()

  /* ══════ 月ビュー ══════ */
  function MonthView() {
    const days = getDaysInMonth(curYear, curMonth)
    const firstDow = getFirstDow(curYear, curMonth)
    const cells: (number|null)[] = [...Array(firstDow).fill(null), ...Array.from({length:days},(_,i)=>i+1)]
    while (cells.length % 7 !== 0) cells.push(null)

    return (
      <div className="px-2">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1">
          {DOW_LABELS.map((d,i) => (
            <div key={d} className={`text-center text-xs font-bold py-1 ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-400'}`}>{d}</div>
          ))}
        </div>
        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="h-16 rounded-xl bg-gray-50 opacity-30" />
            const dateStr = `${formatYM(curYear,curMonth)}-${String(day).padStart(2,'0')}`
            const dayTasks = plans.filter(p => (p.task_date??'').slice(0,10) === dateStr)
            const done = dayTasks.filter(t => t.is_done===1).length
            const isToday = dateStr === today
            const isSel   = dateStr === selDate
            const dow = (firstDow + day - 1) % 7
            return (
              <button key={idx} onClick={() => openDay(dateStr)}
                className={`h-16 rounded-xl p-1 flex flex-col transition active:scale-95 border ${
                  isSel   ? 'border-indigo-400 bg-indigo-50 shadow-md' :
                  isToday ? 'border-yellow-400 bg-yellow-50' :
                            'border-transparent bg-white hover:bg-gray-50'
                }`}>
                <span className={`text-xs font-bold leading-none mb-0.5 ${
                  isToday ? 'text-yellow-600' :
                  dow===0  ? 'text-red-400' :
                  dow===6  ? 'text-blue-400' : 'text-gray-700'
                }`}>{day}</span>
                <div className="flex-1 overflow-hidden space-y-0.5">
                  {dayTasks.slice(0,3).map(t => (
                    <div key={t.id} className={`text-[9px] leading-tight px-1 rounded truncate text-white ${colorMap[t.big_plan||'未分類']} ${t.is_done===1?'opacity-50 line-through':''}`}>
                      {t.task_name || t.mid_plan}
                    </div>
                  ))}
                  {dayTasks.length > 3 && <div className="text-[9px] text-gray-400 text-center">+{dayTasks.length-3}</div>}
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

  /* ══════ 週ビュー ══════ */
  function WeekView() {
    const weekDates = getWeekDates(selDate)
    return (
      <div className="px-2">
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const [,mm,dd] = date.split('-')
            const dayTasks = plans.filter(p => (p.task_date??'').slice(0,10) === date)
            const done = dayTasks.filter(t => t.is_done===1).length
            const isToday = date === today
            const isSel   = date === selDate
            return (
              <button key={date} onClick={() => openDay(date)}
                className={`rounded-2xl p-2 flex flex-col min-h-[120px] transition border-2 ${
                  isSel   ? 'border-indigo-400 bg-indigo-50 shadow-md' :
                  isToday ? 'border-yellow-400 bg-yellow-50' :
                            'border-gray-100 bg-white hover:bg-gray-50'
                }`}>
                <div className="text-center mb-1">
                  <div className={`text-xs ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-400'}`}>{DOW_LABELS[i]}</div>
                  <div className={`text-lg font-bold leading-none ${isToday?'text-yellow-600':'text-gray-700'}`}>{dd}</div>
                  <div className="text-xs text-gray-300">{mm}/{dd}</div>
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                  {dayTasks.map(t => (
                    <div key={t.id} className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-lg truncate text-white ${colorMap[t.big_plan||'未分類']} ${t.is_done===1?'opacity-50':''}`}>
                      {t.task_name || t.mid_plan}
                    </div>
                  ))}
                </div>
                {dayTasks.length > 0 && (
                  <div className={`text-center text-xs mt-1 font-bold ${done===dayTasks.length?'text-green-500':'text-gray-400'}`}>
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

  /* ══════ 日ビュー ══════ */
  function DayView() {
    const dayTasks = plans.filter(p => (p.task_date??'').slice(0,10) === selDate)
    const done = dayTasks.filter(t => t.is_done===1).length
    return (
      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-700">{selDate.slice(5).replace('-','/')} のタスク</h3>
          <span className="text-sm text-gray-400">{done}/{dayTasks.length} 完了</span>
        </div>
        {dayTasks.length === 0 && (
          <div className="text-center py-16 text-gray-300">
            <div className="text-4xl mb-2">📭</div>
            <p>この日のタスクはありません</p>
          </div>
        )}
        <div className="space-y-2">
          {dayTasks.map(t => (
            <button key={t.id} onClick={() => toggleDone(t)}
              className={`w-full text-left rounded-2xl p-4 border-2 transition ${
                t.is_done===1 ? 'border-green-200 bg-green-50' : `border-l-4 border-l-transparent bg-white border-gray-100`
              }`}
              style={t.is_done!==1 ? {borderLeftColor: colorMap[t.big_plan||'未分類']?.replace('bg-','').includes('blue')?'#60a5fa':'#a78bfa'} : {}}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  t.is_done===1 ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                }`}>{t.is_done===1 && '✓'}</div>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${t.is_done===1?'line-through text-gray-400':'text-gray-800'}`}>{t.task_name}</p>
                  <p className="text-xs text-gray-400">{t.big_plan}{t.mid_plan?` › ${t.mid_plan}`:''}</p>
                  {t.planned_minutes!=null && t.planned_minutes>0 && (
                    <p className="text-xs text-indigo-400">⏱ {t.planned_minutes}分</p>
                  )}
                </div>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorMap[t.big_plan||'未分類']}`} />
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  /* ══════ タイトル表示 ══════ */
  function periodTitle() {
    if (viewMode === 'month') return `${curYear}年 ${curMonth}月`
    if (viewMode === 'week') {
      const wk = getWeekDates(selDate)
      return `${wk[0].slice(5).replace('-','/')} 〜 ${wk[6].slice(5).replace('-','/')}`
    }
    return selDate.slice(5).replace('-','/')
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
          <h1 className="font-bold text-gray-800">📆 カレンダー</h1>
          <button onClick={goToday} className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-bold hover:bg-indigo-200 transition">今日</button>
        </div>
        {/* ナビゲーション */}
        <div className="flex items-center justify-between">
          <button onClick={prevPeriod} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-600 text-lg active:scale-90">‹</button>
          <span className="font-bold text-gray-800 text-base">{periodTitle()}</span>
          <button onClick={nextPeriod} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-600 text-lg active:scale-90">›</button>
        </div>
        {/* 表示切り替え */}
        <div className="flex gap-1 mt-2 bg-gray-100 rounded-xl p-1">
          {(['month','week','day'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition ${
                viewMode===v ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'
              }`}>
              {v==='month'?'月':v==='week'?'週':'日'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 凡例（大計画カラー） ── */}
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

      {/* ── ビュー本体 ── */}
      <div className="mt-2">
        {viewMode === 'month' && <MonthView />}
        {viewMode === 'week'  && <WeekView />}
        {viewMode === 'day'   && <DayView />}
      </div>

      {/* ── 日別スライドアップパネル（月/週ビュー時） ── */}
      {slideTask !== null && viewMode !== 'day' && (
        <div className="fixed inset-0 z-40" onClick={() => setSlideTask(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[60vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                {selDate.slice(5).replace('-','/')}
                {selDate === today && <span className="ml-2 text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">今日</span>}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{slideTask.filter(t=>t.is_done===1).length}/{slideTask.length} 完了</span>
                <button onClick={() => setSlideTask(null)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200">✕</button>
              </div>
            </div>
            {slideTask.length === 0 && (
              <div className="text-center py-10 text-gray-300">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">この日のタスクはありません</p>
              </div>
            )}
            <div className="px-4 py-3 space-y-2">
              {slideTask.map(task => (
                <button key={task.id} onClick={() => toggleDone(task)}
                  className={`w-full text-left rounded-2xl p-4 border-2 transition ${
                    task.is_done===1 ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorMap[task.big_plan||'未分類']}`} />
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs ${
                      task.is_done===1 ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                    }`}>{task.is_done===1 && '✓'}</div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${task.is_done===1?'line-through text-gray-400':'text-gray-800'}`}>{task.task_name}</p>
                      <p className="text-xs text-gray-400">{task.big_plan}{task.mid_plan?` › ${task.mid_plan}`:''}</p>
                    </div>
                    {task.planned_minutes!=null && task.planned_minutes>0 && (
                      <span className="text-xs text-indigo-400 flex-shrink-0">⏱{task.planned_minutes}分</span>
                    )}
                  </div>
                </button>
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
    </div>
  )
}