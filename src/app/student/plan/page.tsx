'use client'
import { useEffect, useState, useMemo, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUsernameFromSession } from '@/lib/auth-user'
import {
  loadUser,
  loadPlans,
  insertPlan,
  updatePlan,
  saveUserFields,
  todayStr,
  loadLatestGoalPacing,
  saveGoalPacing,
  type UserRow,
  type PlanRow,
} from '@/lib/student'
import {
  PACE_LABELS,
  type PaceLevel,
  type BigPlanHorizonUnit,
  fetchTemplateCounts,
  computePacing,
  countLearningPages,
  type CountLine,
} from '@/lib/goal-templates'
import { withTimeout } from '@/lib/with-timeout'
import { MONTH_SUMMARY, planRowBelongsToMonth } from '@/lib/plan-month'

const AUTH_SESSION_MS = 18000
const USER_DATA_MS = 25000

function getWeekDates(center: string): string[] {
  const dates: string[] = []
  const base = new Date(center + 'T00:00:00')
  const day = base.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(base); monday.setDate(base.getDate() + diff)
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function monthKeyFromDate(iso: string): string {
  return iso.slice(0, 7)
}

function addDaysStr(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 例: 4月7日（火） */
function formatDateJa(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日（${w}）`
}

function dateToLocalIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 今日0時からのゴール日（期間の終わりイメージ） */
function addHorizonFromToday(unit: BigPlanHorizonUnit, value: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (unit === 'days') d.setDate(d.getDate() + value)
  else if (unit === 'months') d.setMonth(d.getMonth() + value)
  else d.setFullYear(d.getFullYear() + value)
  return d
}

type TabId = 'big' | 'month' | 'daily'

function PlanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [user, setUser] = useState<UserRow | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<TabId>('daily')

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [selectedMonth, setSelectedMonth] = useState(() => monthKeyFromDate(todayStr()))
  const [showAddStock, setShowAddStock] = useState(false)

  const [bigPlanDraft, setBigPlanDraft] = useState('')
  const [savingBig, setSavingBig] = useState(false)

  const [monthGoalDraft, setMonthGoalDraft] = useState('')
  const [savingMonth, setSavingMonth] = useState(false)

  const [newStock, setNewStock] = useState({
    task_name: '',
    mid_plan: '',
    page_range: '',
    planned_minutes: 30,
    month_plan: monthKeyFromDate(todayStr()),
  })
  const [availablePages, setAvailablePages] = useState<string[]>([])
  const [masterMaterials, setMasterMaterials] = useState<string[]>([])

  const [goalTemplateId, setGoalTemplateId] = useState('vocab_all')
  const [goalMaterial, setGoalMaterial] = useState('')
  const [flashcardBooks, setFlashcardBooks] = useState<{ id: number; title: string }[]>([])
  const [goalBookId, setGoalBookId] = useState<number | ''>('')
  const [paceLevel, setPaceLevel] = useState<PaceLevel>('standard')
  /** 入力中は空欄OK。blur で 1〜36 に整える */
  const [monthsInput, setMonthsInput] = useState('6')
  /** 入力中は空欄OK。blur で 1〜7 に整える */
  const [weeksInput, setWeeksInput] = useState('5')
  const [bigHorizonUnit, setBigHorizonUnit] = useState<BigPlanHorizonUnit>('months')
  const [bigHorizonValue, setBigHorizonValue] = useState('6')
  /** 大目標：アプリ登録教材（複数）＋自由文（同時可） */
  const [bigFocusMaterials, setBigFocusMaterials] = useState<string[]>([])
  const [bigFocusFree, setBigFocusFree] = useState('')
  /** 教材名 → YYYY-MM → その月の終わりまでに到達するページ（累積） */
  const [monthPageTargets, setMonthPageTargets] = useState<Record<string, Record<string, number>>>({})
  const [materialPageTotals, setMaterialPageTotals] = useState<Record<string, number>>({})
  const [countLines, setCountLines] = useState<CountLine[]>([])
  const [totalUnits, setTotalUnits] = useState(0)
  const [initError, setInitError] = useState<string | null>(null)

  /** 空欄・途中入力時はプレビュー用に既定値を使う（保存・反映は blur 後の文字列を基準にする） */
  const pacingMonths = useMemo(() => {
    const t = monthsInput.trim()
    const n = parseInt(t, 10)
    if (t === '' || Number.isNaN(n)) return 6
    return Math.max(1, Math.min(36, n))
  }, [monthsInput])

  const pacingWeeks = useMemo(() => {
    const t = weeksInput.trim()
    const n = parseInt(t, 10)
    if (t === '' || Number.isNaN(n)) return 5
    return Math.max(1, Math.min(7, n))
  }, [weeksInput])

  const bigHorizonEnd = useMemo(() => {
    const n = parseInt(bigHorizonValue.trim(), 10)
    if (Number.isNaN(n) || n <= 0) return null
    return addHorizonFromToday(bigHorizonUnit, n)
  }, [bigHorizonValue, bigHorizonUnit])

  const bigHorizonTimeProgressPct = useMemo(() => {
    const n = parseInt(bigHorizonValue.trim(), 10)
    if (Number.isNaN(n) || n <= 0) return null
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = addHorizonFromToday(bigHorizonUnit, n)
    const total = end.getTime() - start.getTime()
    if (total <= 0) return 100
    const elapsed = Date.now() - start.getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }, [bigHorizonValue, bigHorizonUnit])

  const refreshPlans = useCallback(async () => {
    if (!username) return
    setPlans(await loadPlans(username))
  }, [username])

  const goTab = useCallback(
    (t: TabId) => {
      setTab(t)
      router.replace(`/student/plan?tab=${t}`, { scroll: false })
    },
    [router]
  )

  useEffect(() => {
    let cancelled = false
    async function init() {
      setInitError(null)
      try {
        const { data: sessionData, error: sessionErr } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_MS,
          'ログイン状態の確認'
        )
        if (sessionErr) {
          if (!cancelled) setInitError('ログイン状態を確認できませんでした。もう一度ログインしてください。')
          return
        }
        const session = sessionData.session
        if (!session) {
          router.replace('/login')
          return
        }
        const uname = getUsernameFromSession(session)
        if (!uname) {
          if (!cancelled) setInitError('ユーザー情報を取得できませんでした。もう一度ログインしてください。')
          return
        }
        if (!cancelled) setUsername(uname)
        const [u, p] = await withTimeout(
          Promise.all([loadUser(uname), loadPlans(uname)]),
          USER_DATA_MS,
          '学習データの読み込み'
        )
        if (cancelled) return
        setUser(u)
        setPlans(p)
        const firstBig = p.find(x => x.big_plan)?.big_plan || '受験合格！'
        setBigPlanDraft(firstBig)
      } catch (e) {
        console.error('plan init:', e)
        const msg = e instanceof Error ? e.message : ''
        if (!cancelled) {
          setInitError(
            msg.includes('ms を超え')
              ? `接続がタイムアウトしました。Wi‑Fi・VPN・Supabase を確認し、再読み込みしてください。\n（${msg}）`
              : '読み込みに失敗しました。通信やログイン状態を確認してください。'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'big' || t === 'month' || t === 'daily') setTab(t)
  }, [searchParams])

  useEffect(() => {
    if (!username) return
    ;(async () => {
      let saved: Awaited<ReturnType<typeof loadLatestGoalPacing>> = null
      try {
        saved = await withTimeout(loadLatestGoalPacing(username), 12000, 'ペース設定の読込')
      } catch {
        return
      }
      if (!saved) return
      setGoalTemplateId(saved.templateId)
      setGoalMaterial(saved.materialName ?? '')
      if (saved.bookId != null) setGoalBookId(saved.bookId)
      setPaceLevel(saved.pace)
      setMonthsInput(String(Math.max(1, Math.min(36, saved.monthsRemaining))))
      setWeeksInput(String(Math.min(7, Math.max(1, saved.studyDaysPerWeek))))
      if (saved.bigPlanHorizon) {
        setBigHorizonUnit(saved.bigPlanHorizon.unit)
        setBigHorizonValue(String(Math.max(1, saved.bigPlanHorizon.value)))
      }
      if (saved.bigPlanFocusMaterials?.length) {
        setBigFocusMaterials(saved.bigPlanFocusMaterials)
      } else if (saved.bigPlanFocusMaterial?.trim()) {
        setBigFocusMaterials([saved.bigPlanFocusMaterial.trim()])
      } else {
        setBigFocusMaterials([])
      }
      if (saved.bigPlanFocusFree != null) setBigFocusFree(saved.bigPlanFocusFree)
      if (saved.monthPageTargets && typeof saved.monthPageTargets === 'object') {
        setMonthPageTargets(saved.monthPageTargets)
      }
    })()
  }, [username])

  useEffect(() => {
    if (tab !== 'month' || !username) return
    let cancelled = false
    ;(async () => {
      const totals: Record<string, number> = {}
      for (const name of bigFocusMaterials) {
        const n = await countLearningPages(supabase, name)
        if (!cancelled) totals[name] = n
      }
      if (!cancelled) setMaterialPageTotals(totals)
    })()
    return () => {
      cancelled = true
    }
  }, [tab, username, bigFocusMaterials])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    ;(async () => {
      try {
        const mat = goalTemplateId === 'textbook_pages' ? goalMaterial : ''
        const bookOpt =
          goalTemplateId === 'vocab_book' && goalBookId !== ''
            ? { bookId: Number(goalBookId) }
            : undefined
        const { lines, totalUnits: tu } = await withTimeout(
          fetchTemplateCounts(supabase, goalTemplateId, mat, bookOpt),
          35000,
          '目標テンプレの集計'
        )
        if (!cancelled) {
          setCountLines(lines)
          setTotalUnits(tu)
        }
      } catch (e) {
        console.error('fetchTemplateCounts:', e)
        if (!cancelled) {
          setCountLines([])
          setTotalUnits(0)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [username, goalTemplateId, goalMaterial, goalBookId])

  useEffect(() => {
    const row = plans.find(x => x.task_type === MONTH_SUMMARY && x.month_plan === selectedMonth)
    setMonthGoalDraft(row?.task_name ?? '')
  }, [plans, selectedMonth])

  useEffect(() => {
    async function fetchPages() {
      if (!newStock.mid_plan) { setAvailablePages([]); return }
      const { data } = await supabase
        .from('learning_resources')
        .select('page_no')
        .eq('material_name', newStock.mid_plan)
        .eq('resource_type', 'page')
      const pages = Array.from(new Set(data?.map(d => d.page_no).filter(Boolean) || [])) as string[]
      setAvailablePages(pages.sort())
    }
    fetchPages()
  }, [newStock.mid_plan])

  useEffect(() => {
    async function getMaterials() {
      const { data } = await supabase.from('learning_resources').select('material_name')
      const names = Array.from(new Set(data?.map(d => d.material_name).filter(Boolean) || [])) as string[]
      setMasterMaterials(names.sort())
    }
    getMaterials()
  }, [])

  useEffect(() => {
    async function loadBooks() {
      const { data } = await supabase.from('flashcard_books').select('id, title').order('id')
      setFlashcardBooks((data ?? []) as { id: number; title: string }[])
    }
    loadBooks()
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const bigGoal = useMemo(() => plans[0]?.big_plan || bigPlanDraft || '受験合格！', [plans, bigPlanDraft])

  const pacingPreview = useMemo(() => {
    if (totalUnits <= 0) return null
    return computePacing(totalUnits, pacingMonths, pacingWeeks, paceLevel)
  }, [totalUnits, pacingMonths, pacingWeeks, paceLevel])

  const stockTasks = useMemo(
    () => plans.filter(p => !p.task_date && p.is_done === 0 && p.task_type !== MONTH_SUMMARY),
    [plans]
  )
  const dayTasks = useMemo(() => plans.filter(p => p.task_date === selectedDate), [plans, selectedDate])

  const monthTasks = useMemo(
    () => plans.filter(p => planRowBelongsToMonth(p, selectedMonth) && p.is_done === 0),
    [plans, selectedMonth]
  )

  /** カレンダーで選んだ日がある月の「月のめあて」（つながり表示用） */
  const monthGoalLineForSelectedDate = useMemo(() => {
    const mk = monthKeyFromDate(selectedDate)
    const row = plans.find(x => x.task_type === MONTH_SUMMARY && x.month_plan === mk)
    const raw = row?.task_name?.trim() ?? ''
    if (!raw || raw === '（今月の目標を書こう）') return '（月計画タブで入力）'
    return raw
  }, [plans, selectedDate])

  async function saveBigPlan() {
    if (!username) return
    setSavingBig(true)
    try {
      const { data: rows } = await supabase.from('plans').select('id').eq('username', username).limit(1)
      if (!rows?.length) {
        await insertPlan({
          username,
          big_plan: bigPlanDraft.trim() || 'マイ目標',
          mid_plan: '',
          task_name: '（最初のタスクをプールに追加しよう）',
          task_date: '',
          is_done: 0,
          video_url: '',
          task_type: 'lesson',
          planned_minutes: 15,
          material_id: '',
          page_range: '',
          deadline: '',
          month_plan: monthKeyFromDate(todayStr()),
        })
      }
      await supabase.from('plans').update({ big_plan: bigPlanDraft.trim() || 'マイ目標' }).eq('username', username)
      await refreshPlans()
      await persistGoalPacing()
      showToast('🏆 大計画を保存したよ')
    } finally {
      setSavingBig(false)
    }
  }

  async function saveMonthGoal() {
    if (!username) return
    setSavingMonth(true)
    try {
      const existing = plans.find(p => p.task_type === MONTH_SUMMARY && p.month_plan === selectedMonth)
      const text = monthGoalDraft.trim()
      if (existing) {
        await updatePlan(existing.id, { task_name: text || '（今月の目標を書こう）' })
      } else {
        await insertPlan({
          username,
          big_plan: bigGoal,
          mid_plan: '',
          task_name: text || '（今月の目標を書こう）',
          task_date: '',
          is_done: 0,
          video_url: '',
          task_type: MONTH_SUMMARY,
          planned_minutes: 0,
          material_id: '',
          page_range: '',
          deadline: '',
          month_plan: selectedMonth,
        })
      }
      await refreshPlans()
      showToast('📅 今月の計画を保存したよ')
    } finally {
      setSavingMonth(false)
    }
  }

  async function addStockTask() {
    if (!newStock.task_name.trim() || !newStock.mid_plan.trim()) { alert('タスク名と教材を入力してください'); return }
    await insertPlan({
      username,
      big_plan: bigGoal,
      mid_plan: newStock.mid_plan,
      task_name: newStock.task_name,
      task_date: '',
      is_done: 0,
      video_url: '',
      task_type: 'lesson',
      planned_minutes: newStock.planned_minutes,
      material_id: '',
      page_range: newStock.page_range,
      deadline: '',
      month_plan: newStock.month_plan || selectedMonth,
    })
    await refreshPlans()
    setNewStock({
      task_name: '',
      mid_plan: '',
      page_range: '',
      planned_minutes: 30,
      month_plan: selectedMonth,
    })
    setShowAddStock(false)
    showToast('📦 プールに保存！')
  }

  async function assignTaskToDate(task: PlanRow) {
    await updatePlan(task.id, { task_date: selectedDate })
    await refreshPlans()
    showToast('📅 セットしたよ！')
    goTab('daily')
  }

  async function toggleDone(task: PlanRow) {
    const nd = task.is_done === 1 ? 0 : 1
    await updatePlan(task.id, { is_done: nd })
    await refreshPlans()
    if (nd === 1 && user) {
      showToast('🎉 ナイス！+10 EXP')
      await saveUserFields(username, { current_points: (user.current_points ?? 0) + 10 })
    }
  }

  async function returnToPool(task: PlanRow) {
    await updatePlan(task.id, { task_date: '' })
    await refreshPlans()
    showToast('日付前に戻しました')
  }

  async function moveToTomorrow(task: PlanRow) {
    const next = addDaysStr(selectedDate, 1)
    await updatePlan(task.id, { task_date: next })
    await refreshPlans()
    showToast(`📅 ${next} に移したよ`)
  }

  function shiftMonth(delta: number) {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(key)
  }

  async function persistGoalPacing() {
    if (!username) return
    const hv = parseInt(bigHorizonValue.trim(), 10)
    const horizonPayload =
      !Number.isNaN(hv) && hv > 0
        ? { unit: bigHorizonUnit, value: hv } as const
        : undefined
    await saveGoalPacing(username, {
      templateId: goalTemplateId,
      materialName: goalTemplateId === 'textbook_pages' ? goalMaterial : undefined,
      bookId:
        goalTemplateId === 'vocab_book' && goalBookId !== '' ? Number(goalBookId) : undefined,
      pace: paceLevel,
      monthsRemaining: pacingMonths,
      studyDaysPerWeek: pacingWeeks,
      updatedAt: new Date().toISOString(),
      bigPlanHorizon: horizonPayload,
      bigPlanFocusMaterials: bigFocusMaterials.length > 0 ? bigFocusMaterials : undefined,
      bigPlanFocusFree: bigFocusFree.trim() ? bigFocusFree : undefined,
      monthPageTargets:
        Object.keys(monthPageTargets).length > 0 ? monthPageTargets : undefined,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] animate-pulse text-yellow-600 font-bold">
        読み込み中…
      </div>
    )
  }

  if (initError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFDF0] p-6 gap-4 text-center">
        <p className="text-red-700 font-bold text-sm max-w-md leading-relaxed">{initError}</p>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="py-3 px-8 bg-yellow-400 text-gray-900 rounded-2xl font-black shadow"
        >
          ログインへ
        </button>
      </div>
    )
  }

  if (!username) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFDF0] p-6 gap-3 text-center">
        <p className="text-gray-600 font-bold text-sm">ログイン画面へ移動します…</p>
        <button
          type="button"
          onClick={() => router.replace('/login')}
          className="py-3 px-8 bg-yellow-400 text-gray-900 rounded-2xl font-black shadow text-sm"
        >
          ログインへ
        </button>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; emoji: string; sub: string }[] = [
    { id: 'big', label: '大目標', emoji: '🏆', sub: '最上位の目標' },
    { id: 'month', label: '月計画', emoji: '📅', sub: '月ごとの量' },
    { id: 'daily', label: '日々の予定', emoji: '✅', sub: '今日・明日' },
  ]

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-28 font-sans text-gray-800 flex flex-col">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg font-bold text-white bg-indigo-600 text-sm max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-200 shadow-sm">
        <h1 className="text-base font-black text-gray-900">未来の計画</h1>
        <p className="text-xs text-gray-500 mt-1 leading-snug">大目標 → 月計画 → 日々の予定</p>
      </div>

      {/* タブ（短い日本語＋補足） */}
      <div className="px-2 pt-2 flex gap-1 bg-[#f3f4f6] sticky top-0 z-40 border-b border-gray-200/80">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => goTab(t.id)}
            className={`flex-1 py-2.5 px-1 rounded-t-xl text-center transition-all min-h-[52px] flex flex-col justify-center ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm border border-b-0 border-gray-200 -mb-px'
                : 'bg-transparent text-gray-500'
            }`}
          >
            <span className="text-sm leading-none">{t.emoji}</span>
            <span className={`text-[11px] font-black mt-1 leading-tight ${tab === t.id ? 'text-gray-900' : ''}`}>
              {t.label}
            </span>
            <span className="text-[9px] text-gray-400 font-bold mt-0.5 leading-tight">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* ── 大目標 ── */}
      {tab === 'big' && (
        <div className="flex-1 px-3 py-4 space-y-4 bg-white min-h-[50vh]">
          <p className="text-sm text-gray-600">ゴールと、使う教材の洗い出しだけです。</p>
          <div className="rounded-2xl p-4 shadow-sm border border-gray-200 bg-amber-50/80">
            <p className="text-sm font-black text-gray-800 mb-2">大目標（メインクエスト）</p>
            <textarea
              value={bigPlanDraft}
              onChange={e => setBigPlanDraft(e.target.value)}
              rows={5}
              className="w-full bg-white text-gray-900 rounded-xl p-3 text-sm font-bold outline-none border border-amber-200 focus:ring-2 focus:ring-yellow-400"
              placeholder="例：志望校に合格し、自分の言葉で説明できるようになる"
            />
            <button
              type="button"
              onClick={saveBigPlan}
              disabled={savingBig}
              className="mt-3 w-full py-3 bg-yellow-400 text-gray-900 rounded-xl font-black text-sm shadow active:scale-[0.99] disabled:opacity-50"
            >
              {savingBig ? '保存中…' : '保存'}
            </button>
          </div>

          <div className="rounded-2xl p-4 shadow-sm border border-amber-300/70 bg-gradient-to-b from-amber-50/90 to-white space-y-3">
            <p className="text-sm font-black text-gray-900">ゴールまでの期間と「何を」</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-gray-600">いつまで</span>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="期間の数値"
                    value={bigHorizonValue}
                    onChange={e => setBigHorizonValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onBlur={() => {
                      const n = parseInt(bigHorizonValue.trim(), 10)
                      if (bigHorizonValue.trim() === '' || Number.isNaN(n) || n < 1) setBigHorizonValue('6')
                      else setBigHorizonValue(String(Math.min(999, n)))
                    }}
                    className="w-16 p-2 rounded-lg border border-amber-200 bg-white font-black text-center text-sm tabular-nums"
                  />
                  <select
                    value={bigHorizonUnit}
                    onChange={e => setBigHorizonUnit(e.target.value as BigPlanHorizonUnit)}
                    className="p-2 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                  >
                    <option value="days">日</option>
                    <option value="months">か月</option>
                    <option value="years">年</option>
                  </select>
                </div>
              </label>
            </div>
            {bigHorizonEnd && (
              <p className="text-xs font-bold text-amber-900">
                目安の終わり：{formatDateJa(dateToLocalIso(bigHorizonEnd))}
              </p>
            )}
            {bigHorizonTimeProgressPct != null && (
              <div>
                <div className="flex justify-between text-[10px] font-bold text-gray-600 mb-0.5">
                  <span>期間の進み（今日がどこまで来たか）</span>
                  <span>{Math.round(bigHorizonTimeProgressPct)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all min-w-[2px]"
                    style={{ width: `${bigHorizonTimeProgressPct}%` }}
                  />
                </div>
              </div>
            )}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-700">その期間に何をやるか</p>
              <div>
                <p className="text-[10px] font-bold text-gray-600 mb-1">アプリに登録した教材</p>
                {bigFocusMaterials.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 mb-2">
                    {bigFocusMaterials.map(m => (
                      <li
                        key={m}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-amber-100 text-xs font-bold text-amber-950 border border-amber-300"
                      >
                        <span className="max-w-[200px] truncate">{m}</span>
                        <button
                          type="button"
                          onClick={() => setBigFocusMaterials(bigFocusMaterials.filter(x => x !== m))}
                          className="min-w-[28px] min-h-[28px] rounded-md text-amber-900 font-black hover:bg-amber-200/80"
                          aria-label={`${m} を外す`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <select
                  value=""
                  onChange={e => {
                    const v = e.target.value
                    if (v && !bigFocusMaterials.includes(v)) {
                      setBigFocusMaterials([...bigFocusMaterials, v])
                    }
                  }}
                  className="w-full p-2.5 bg-white rounded-xl text-sm font-bold border border-amber-200 outline-none"
                >
                  <option value="">＋ 一覧から追加</option>
                  {masterMaterials
                    .filter(m => !bigFocusMaterials.includes(m))
                    .map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-600 mb-1">まだアプリにないもの（任意）</p>
                <textarea
                  value={bigFocusFree}
                  onChange={e => setBigFocusFree(e.target.value)}
                  rows={2}
                  placeholder="例：過去問、別の参考書、動画…"
                  className="w-full bg-white text-gray-900 rounded-xl p-3 text-sm font-bold outline-none border border-amber-200 focus:ring-2 focus:ring-amber-300"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 月計画 ── */}
      {tab === 'month' && (
        <div className="flex-1 px-3 py-4 space-y-4 bg-white min-h-[50vh]">
          <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl p-2 border border-gray-200">
            <button type="button" onClick={() => shiftMonth(-1)} className="min-w-[44px] min-h-[44px] rounded-lg bg-white border border-gray-200 font-bold text-gray-700 shadow-sm">
              前月
            </button>
            <p className="text-center font-black text-gray-900 flex-1 text-base">
              {selectedMonth.split('-')[0]}年{Number(selectedMonth.split('-')[1])}月
            </p>
            <button type="button" onClick={() => shiftMonth(1)} className="min-w-[44px] min-h-[44px] rounded-lg bg-white border border-gray-200 font-bold text-gray-700 shadow-sm">
              翌月
            </button>
          </div>

          {bigFocusMaterials.length > 0 ? (
            <div className="rounded-2xl p-4 border border-emerald-200 bg-emerald-50/70 space-y-3">
              <p className="text-sm font-black text-emerald-900">教材のページ（この月までにどこまで）</p>
              {bigFocusMaterials.map(mat => {
                const total = materialPageTotals[mat] ?? 0
                const cur = monthPageTargets[mat]?.[selectedMonth]
                return (
                  <div key={mat} className="rounded-xl bg-white border border-emerald-100 p-3">
                    <p className="text-xs font-black text-gray-900 truncate" title={mat}>
                      {mat}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      全{total > 0 ? total : '—'}ページ
                    </p>
                    <label className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-bold text-gray-700 whitespace-nowrap">この月の終わりまで</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="flex-1 min-w-0 p-2 rounded-lg border border-emerald-200 font-black text-center text-sm tabular-nums"
                        placeholder="ページ"
                        value={cur !== undefined ? String(cur) : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setMonthPageTargets(prev => {
                            const inner = { ...(prev[mat] || {}) }
                            if (raw === '') {
                              delete inner[selectedMonth]
                            } else {
                              const n = parseInt(raw, 10)
                              if (!Number.isNaN(n) && n >= 1) inner[selectedMonth] = Math.min(9999, n)
                            }
                            const next = { ...prev }
                            if (Object.keys(inner).length === 0) delete next[mat]
                            else next[mat] = inner
                            return next
                          })
                        }}
                        onBlur={() => {
                          setTimeout(() => void persistGoalPacing(), 0)
                        }}
                      />
                      <span className="text-xs font-bold text-gray-600">ページ</span>
                    </label>
                  </div>
                )
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => goTab('big')}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-bold text-gray-600"
            >
              大目標で教材を選ぶ →
            </button>
          )}

          {bigFocusFree.trim() ? (
            <div className="rounded-xl p-3 bg-gray-50 border border-gray-200 text-xs text-gray-700">
              <span className="font-black text-gray-500">その他（大目標）: </span>
              {bigFocusFree.trim()}
            </div>
          ) : null}

          <div className="rounded-2xl p-4 border border-indigo-100 bg-indigo-50/40 shadow-sm">
            <p className="text-sm font-black text-indigo-900 mb-2">この月のメモ</p>
            <textarea
              value={monthGoalDraft}
              onChange={e => setMonthGoalDraft(e.target.value)}
              rows={3}
              className="w-full bg-white rounded-xl p-3 text-sm font-bold outline-none border border-indigo-100"
              placeholder="自由に書いてOK"
            />
            <button
              type="button"
              onClick={saveMonthGoal}
              disabled={savingMonth}
              className="mt-3 w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm disabled:opacity-50"
            >
              {savingMonth ? '保存中…' : '保存'}
            </button>
          </div>

          <div>
            <p className="text-xs font-black text-gray-700 mb-2">今月のタスク（未完了）</p>
            {monthTasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                まだありません。「日々の予定」から追加すると月に紐づきます
              </p>
            ) : (
              <ul className="space-y-2">
                {monthTasks.map(t => (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200"
                  >
                    <span className="text-lg shrink-0">📌</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-500 font-bold truncate">{t.mid_plan} {t.page_range}</p>
                      <p className="font-bold text-sm text-gray-900">{t.task_name}</p>
                      {t.task_date ? (
                        <p className="text-[11px] text-indigo-600 mt-1 font-bold">予定日：{formatDateJa(t.task_date)}</p>
                      ) : (
                        <p className="text-[11px] text-amber-700 mt-1 font-bold">日付未設定</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── 日々の予定（カレンダー＋リスト） ── */}
      {tab === 'daily' && (
        <div className="flex-1 px-3 py-4 space-y-4 bg-[#f3f4f6] pb-28">
          {/* ① 大目標 */}
          <div className="relative pl-4 border-l-4 border-amber-400 bg-white rounded-r-xl p-3 shadow-sm border border-gray-100">
            <p className="text-xs font-black text-amber-800">① 大目標</p>
            <p className="text-sm font-bold text-gray-900 line-clamp-2 mt-1">{bigGoal}</p>
            <button type="button" onClick={() => goTab('big')} className="text-xs font-bold text-indigo-600 mt-2">
              編集 →
            </button>
          </div>

          {/* ② 月の到達目標 */}
          <div className="relative pl-4 border-l-4 border-indigo-300 bg-white rounded-r-xl p-3 shadow-sm border border-gray-100">
            <p className="text-xs font-black text-indigo-900">② 月の到達目標（カレンダーの月）</p>
            <p className="text-sm font-bold text-gray-800 line-clamp-2 mt-1">{monthGoalLineForSelectedDate}</p>
            {pacingPreview && totalUnits > 0 && (
              <p className="text-[11px] text-gray-500 font-bold mt-2 leading-snug">
                ペース目安：{PACE_LABELS[paceLevel].label}・約{Math.ceil(pacingPreview.dailyUnits)}
                {goalTemplateId === 'textbook_pages' ? 'ページ' : '語'}
                /日（全{totalUnits}
                {goalTemplateId === 'textbook_pages' ? 'ページ' : '語'}）
              </p>
            )}
            <button type="button" onClick={() => goTab('month')} className="text-xs font-bold text-indigo-600 mt-2">
              編集 →
            </button>
          </div>

          {/* ③ 日付未設定のタスク */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div>
                <p className="text-xs font-black text-gray-800">③ 日付未設定のタスク</p>
                <p className="text-[10px] text-gray-500 mt-0.5">下の週で日を選び、「この日に入れる」で予定に入れます</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewStock(s => ({ ...s, month_plan: selectedMonth }))
                  setShowAddStock(true)
                }}
                className="min-h-[40px] px-3 rounded-lg bg-indigo-600 text-white text-xs font-black shadow-sm"
              >
                ＋ 追加
              </button>
            </div>
            <div className="p-3 space-y-2">
              {stockTasks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">まだありません。「追加」から作成できます</p>
              ) : (
                stockTasks.map(t => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 flex flex-col gap-2"
                  >
                    <div>
                      <p className="text-[11px] text-gray-500 font-bold">{t.mid_plan} {t.page_range}</p>
                      {t.month_plan && (
                        <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{t.month_plan} のタスク</p>
                      )}
                      <p className="font-bold text-sm text-gray-900 mt-1">{t.task_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => assignTaskToDate(t)}
                      className="w-full py-2.5 rounded-xl bg-white border-2 border-indigo-200 text-indigo-700 text-xs font-black"
                    >
                      選んだ日（{formatDateJa(selectedDate)}）にいれる
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ④ 週カレンダー */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
            <p className="text-xs font-black text-gray-800 mb-2">④ 日付を選ぶ（1週間）</p>
            <div className="flex gap-1 justify-between">
              {getWeekDates(selectedDate).map(d => {
                const isToday = d === todayStr()
                const isSel = d === selectedDate
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border-2 transition-all min-h-[56px] justify-center ${
                      isSel
                        ? 'bg-blue-100 border-blue-400 text-gray-900'
                        : isToday
                          ? 'bg-amber-50 border-amber-300 text-gray-800'
                          : 'bg-white border-gray-100 text-gray-500'
                    }`}
                  >
                    {isToday && (
                      <span className="text-[9px] font-black text-amber-700 leading-none">今日</span>
                    )}
                    <span className="text-[10px] font-black">
                      {['日', '月', '火', '水', '木', '金', '土'][new Date(d + 'T00:00:00').getDay()]}
                    </span>
                    <span className="text-base font-black mt-0.5">{parseInt(d.slice(8), 10)}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-center text-sm font-black text-gray-900 mt-3">
              {formatDateJa(selectedDate)}の予定
            </p>
          </section>

          {/* ⑤ その日のタスク */}
          <section className="space-y-2">
            <p className="text-xs font-black text-gray-600 px-1">⑤ チェックで完了（タップで学習へ）</p>
            <div className="space-y-3">
              {dayTasks.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6 bg-white rounded-xl border border-dashed border-gray-200">
                  この日の予定はまだありません
                </p>
              )}
              {dayTasks.map(t => (
                <div
                  key={t.id}
                  className={`flex flex-col gap-2 p-4 rounded-2xl border transition-all ${
                    t.is_done ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-white border-gray-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDone(t)}
                      className={`w-11 h-11 shrink-0 rounded-full border-2 flex items-center justify-center ${
                        t.is_done ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {t.is_done === 1 && <span className="text-white text-lg">✓</span>}
                    </button>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => router.push(`/student/study?taskId=${t.id}`)}
                      role="presentation"
                    >
                      {t.month_plan && (
                        <p className="text-[10px] text-indigo-600 font-bold">{t.month_plan}</p>
                      )}
                      <p className="text-[9px] text-gray-500 font-bold truncate">
                        {t.mid_plan} {t.page_range}
                      </p>
                      <p className={`font-bold text-sm ${t.is_done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {t.task_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-14">
                    <button
                      type="button"
                      onClick={() => moveToTomorrow(t)}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-blue-50 text-blue-800 border border-blue-100"
                    >
                      明日へ移す
                    </button>
                    <button
                      type="button"
                      onClick={() => returnToPool(t)}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-gray-50 text-gray-700 border border-gray-200"
                    >
                      日付前に戻す
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {showAddStock && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end p-4 animate-in fade-in"
          onClick={() => setShowAddStock(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-t-[2.5rem] w-full p-6 space-y-4 max-w-md mx-auto mb-10 shadow-2xl"
            onClick={e => e.stopPropagation()}
            role="dialog"
          >
            <h2 className="font-black text-lg text-gray-900">タスクを追加</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-gray-600">対象の月（月計画と合わせる）</span>
                <input
                  type="month"
                  value={newStock.month_plan.length >= 7 ? newStock.month_plan.slice(0, 7) : selectedMonth}
                  onChange={e => setNewStock({ ...newStock, month_plan: e.target.value })}
                  className="w-full mt-1 p-3 bg-gray-50 rounded-2xl font-bold outline-none text-sm"
                />
              </label>
              <input
                placeholder="タスク名（例：第1課 練習B）"
                value={newStock.task_name}
                onChange={e => setNewStock({ ...newStock, task_name: e.target.value })}
                className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newStock.mid_plan}
                  onChange={e => setNewStock({ ...newStock, mid_plan: e.target.value, page_range: '' })}
                  className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none text-xs appearance-none"
                >
                  <option value="">教材をえらぶ</option>
                  {masterMaterials.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={newStock.page_range}
                  onChange={e => setNewStock({ ...newStock, page_range: e.target.value })}
                  className={`w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none text-xs appearance-none ${!newStock.mid_plan ? 'opacity-30' : ''}`}
                  disabled={!newStock.mid_plan}
                >
                  <option value="">ページ</option>
                  {availablePages.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={addStockTask}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] text-yellow-700 font-bold">
          読み込み中…
        </div>
      }
    >
      <PlanContent />
    </Suspense>
  )
}
