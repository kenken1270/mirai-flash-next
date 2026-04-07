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
  GOAL_TEMPLATES,
  PACE_LABELS,
  type PaceLevel,
  fetchTemplateCounts,
  computePacing,
  buildMonthSummaryDraft,
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
  const [monthsRemaining, setMonthsRemaining] = useState(6)
  const [studyDaysPerWeek, setStudyDaysPerWeek] = useState(5)
  const [countLines, setCountLines] = useState<CountLine[]>([])
  const [totalUnits, setTotalUnits] = useState(0)
  const [loadingCounts, setLoadingCounts] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

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
      setMonthsRemaining(Math.max(1, saved.monthsRemaining))
      setStudyDaysPerWeek(Math.min(7, Math.max(1, saved.studyDaysPerWeek)))
    })()
  }, [username])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    ;(async () => {
      setLoadingCounts(true)
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
      } finally {
        if (!cancelled) setLoadingCounts(false)
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
    return computePacing(totalUnits, monthsRemaining, studyDaysPerWeek, paceLevel)
  }, [totalUnits, monthsRemaining, studyDaysPerWeek, paceLevel])

  const stockTasks = useMemo(
    () => plans.filter(p => !p.task_date && p.is_done === 0 && p.task_type !== MONTH_SUMMARY),
    [plans]
  )
  const dayTasks = useMemo(() => plans.filter(p => p.task_date === selectedDate), [plans, selectedDate])

  const monthTasks = useMemo(
    () => plans.filter(p => planRowBelongsToMonth(p, selectedMonth) && p.is_done === 0),
    [plans, selectedMonth]
  )

  const monthDoneCount = useMemo(
    () => plans.filter(p => planRowBelongsToMonth(p, selectedMonth) && p.is_done === 1).length,
    [plans, selectedMonth]
  )

  const monthPoolCount = useMemo(
    () =>
      plans.filter(
        p =>
          !p.task_date &&
          p.is_done === 0 &&
          p.task_type !== MONTH_SUMMARY &&
          p.month_plan === selectedMonth
      ).length,
    [plans, selectedMonth]
  )

  const monthTaskProgressPct = useMemo(() => {
    const done = monthDoneCount
    const undone = monthTasks.length
    const total = done + undone
    if (total <= 0) return null
    return Math.min(100, Math.round((done / total) * 100))
  }, [monthDoneCount, monthTasks.length])

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
    await saveGoalPacing(username, {
      templateId: goalTemplateId,
      materialName: goalTemplateId === 'textbook_pages' ? goalMaterial : undefined,
      bookId:
        goalTemplateId === 'vocab_book' && goalBookId !== '' ? Number(goalBookId) : undefined,
      pace: paceLevel,
      monthsRemaining,
      studyDaysPerWeek,
      updatedAt: new Date().toISOString(),
    })
  }

  async function addPacingDraftToPool() {
    if (!username) return
    if (totalUnits <= 0) {
      showToast('量が0のため追加できません')
      return
    }
    const p = computePacing(totalUnits, monthsRemaining, studyDaysPerWeek, paceLevel)
    const daily = Math.max(1, Math.ceil(p.dailyUnits))
    const paceName = PACE_LABELS[paceLevel].label
    let mid = ''
    let taskName = ''
    if (goalTemplateId === 'textbook_pages') {
      if (!goalMaterial.trim()) {
        showToast('教材を選んでください')
        return
      }
      mid = goalMaterial
      taskName = `【目安・${paceName}】約${daily}ページ/日（${selectedMonth}）`
    } else if (goalTemplateId === 'vocab_book') {
      if (goalBookId === '') {
        showToast('書籍を選んでください')
        return
      }
      const book = flashcardBooks.find(b => b.id === Number(goalBookId))
      mid = book?.title ?? '単語'
      taskName = `【目安・${paceName}】約${daily}語/日（${book?.title ?? ''}）`
    } else if (goalTemplateId === 'vocab_all') {
      mid = '単語（全書籍）'
      taskName = `【目安・${paceName}】約${daily}語/日（全${totalUnits}語）`
    } else {
      showToast('テンプレートを選んでください')
      return
    }
    await insertPlan({
      username,
      big_plan: bigGoal,
      mid_plan: mid,
      task_name: taskName,
      task_date: '',
      is_done: 0,
      video_url: '',
      task_type: 'lesson',
      planned_minutes: 30,
      material_id: '',
      page_range: '',
      deadline: '',
      month_plan: selectedMonth,
    })
    await refreshPlans()
    await persistGoalPacing()
    showToast('プールに目安タスクを追加したよ')
    goTab('daily')
  }

  async function applyTemplateToBigPlan() {
    const tmpl = GOAL_TEMPLATES.find(t => t.id === goalTemplateId)
    const p = pacingPreview
    const extra =
      p && totalUnits > 0
        ? `【量の目安・${PACE_LABELS[paceLevel].label}】約${Math.max(1, Math.ceil(p.dailyUnits))}単位/日（全${totalUnits}・残り${monthsRemaining}か月・週${studyDaysPerWeek}日想定）`
        : '【量の目安】教材・単語データを登録すると、日の目安が出ます。'
    const next = [tmpl?.bigPlanExample ?? '', extra].filter(Boolean).join('\n\n')
    setBigPlanDraft(next)
    await persistGoalPacing()
    showToast('大目標欄に反映したよ（編集してOK）')
  }

  async function applyPacingToSelectedMonth() {
    if (!username) return
    const tmpl = GOAL_TEMPLATES.find(t => t.id === goalTemplateId)
    const p = computePacing(totalUnits, monthsRemaining, studyDaysPerWeek, paceLevel)
    const draft = buildMonthSummaryDraft(tmpl?.title ?? '計画', countLines, p)
    setMonthGoalDraft(draft)
    const existing = plans.find(x => x.task_type === MONTH_SUMMARY && x.month_plan === selectedMonth)
    if (existing) {
      await updatePlan(existing.id, { task_name: draft })
    } else {
      await insertPlan({
        username,
        big_plan: bigGoal,
        mid_plan: '',
        task_name: draft,
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
    await persistGoalPacing()
    showToast(`「月計画」の${selectedMonth}に反映したよ`)
    if (tab !== 'month') goTab('month')
  }

  async function addWeeklyPacingToPool() {
    if (!username) return
    if (totalUnits <= 0) {
      showToast('量が0のため追加できません')
      return
    }
    const p = computePacing(totalUnits, monthsRemaining, studyDaysPerWeek, paceLevel)
    const daily = Math.max(1, Math.ceil(p.dailyUnits))
    const paceName = PACE_LABELS[paceLevel].label
    const unit = goalTemplateId === 'textbook_pages' ? 'ページ' : '語'
    let mid = ''
    if (goalTemplateId === 'textbook_pages') {
      if (!goalMaterial.trim()) {
        showToast('教材を選んでください')
        return
      }
      mid = goalMaterial
    } else if (goalTemplateId === 'vocab_book') {
      if (goalBookId === '') {
        showToast('書籍を選んでください')
        return
      }
      const book = flashcardBooks.find(b => b.id === Number(goalBookId))
      mid = book?.title ?? '単語'
    } else if (goalTemplateId === 'vocab_all') {
      mid = '単語（全書籍）'
    } else {
      showToast('テンプレートを選んでください')
      return
    }
    for (let w = 1; w <= 4; w++) {
      await insertPlan({
        username,
        big_plan: bigGoal,
        mid_plan: mid,
        task_name: `【第${w}週】${paceName} 約${daily}${unit}/日（${selectedMonth}）`,
        task_date: '',
        is_done: 0,
        video_url: '',
        task_type: 'lesson',
        planned_minutes: 30,
        material_id: '',
        page_range: '',
        deadline: '',
        month_plan: selectedMonth,
      })
    }
    await refreshPlans()
    await persistGoalPacing()
    showToast('第1〜4週をプールに追加したよ')
    goTab('daily')
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
        <p className="text-xs text-gray-500 mt-1 leading-snug">
          大目標 → 月計画 → 日々の予定の順で整理すると分かりやすいです
        </p>
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
          <p className="text-sm text-gray-600 leading-relaxed">
            勉強のゴールや、卒業後の姿を書きます。あとから変更できます。
          </p>
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

          <div className="rounded-2xl p-4 shadow-sm border border-emerald-200 bg-emerald-50/70">
            <p className="text-sm font-black text-emerald-900 mb-1">目標テンプレートとペース</p>
            <p className="text-xs text-emerald-800/90 mb-2 leading-relaxed">
              教材・単語の登録データから「だいたいの量」を出し、月・日に分けた目安を作れます。
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-bold text-emerald-900/90">
              <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200">① 種類</span>
              <span className="text-emerald-600">→</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200">② 対象</span>
              <span className="text-emerald-600">→</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200">③ ペース</span>
              <span className="text-emerald-600">→</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200">④ 反映</span>
            </div>
            <label className="block mb-3">
              <span className="text-xs font-bold text-gray-700">反映先の月（月計画・プールと同じ）</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full mt-1 p-3 bg-white rounded-xl text-sm font-bold border border-emerald-200 outline-none"
              />
            </label>
            <label className="block text-xs font-bold text-gray-700 mb-1">テンプレート</label>
            <select
              value={goalTemplateId}
              onChange={e => {
                const v = e.target.value
                setGoalTemplateId(v)
                if (v !== 'vocab_book') setGoalBookId('')
                if (v !== 'textbook_pages') setGoalMaterial('')
              }}
              className="w-full mb-3 p-3 bg-white rounded-xl text-sm font-bold border border-emerald-200 outline-none"
            >
              {GOAL_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {goalTemplateId === 'vocab_book' && (
              <label className="block mb-3">
                <span className="text-xs font-bold text-gray-700">単語帳（書籍）</span>
                <select
                  value={goalBookId === '' ? '' : String(goalBookId)}
                  onChange={e => setGoalBookId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full mt-1 p-3 bg-white rounded-xl text-sm font-bold border border-emerald-200 outline-none"
                >
                  <option value="">えらんでください</option>
                  {flashcardBooks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {goalTemplateId === 'textbook_pages' && (
              <label className="block mb-3">
                <span className="text-xs font-bold text-gray-700">教材（学習リソース）</span>
                <select
                  value={goalMaterial}
                  onChange={e => setGoalMaterial(e.target.value)}
                  className="w-full mt-1 p-3 bg-white rounded-xl text-sm font-bold border border-emerald-200 outline-none"
                >
                  <option value="">えらんでください</option>
                  {masterMaterials.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <label className="block text-xs">
                <span className="font-bold text-gray-700">残り月数</span>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={monthsRemaining}
                  onChange={e => setMonthsRemaining(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full mt-1 p-2 rounded-lg border border-emerald-200 bg-white font-bold text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="font-bold text-gray-700">週の学習日</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={studyDaysPerWeek}
                  onChange={e => setStudyDaysPerWeek(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full mt-1 p-2 rounded-lg border border-emerald-200 bg-white font-bold text-sm"
                />
              </label>
            </div>
            <p className="text-xs font-bold text-gray-700 mb-1">ペース</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(PACE_LABELS) as PaceLevel[]).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPaceLevel(k)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border ${
                    paceLevel === k
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-gray-800 border-emerald-200'
                  }`}
                >
                  {PACE_LABELS[k].label}
                  <span className="block text-[10px] font-bold opacity-90">{PACE_LABELS[k].desc}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-white/90 border border-emerald-100 p-3 text-xs space-y-2">
              {loadingCounts ? (
                <p className="text-gray-600 font-bold">集計中…</p>
              ) : countLines.length === 0 ? (
                <p className="text-gray-600">条件に合うデータがありません。</p>
              ) : totalUnits === 0 && goalTemplateId === 'vocab_book' && goalBookId === '' ? (
                <p className="text-amber-800 font-bold">上で書籍を選ぶと、語数が表示されます。</p>
              ) : (
                countLines.map((line, i) => (
                  <p key={i} className="font-bold text-gray-800">
                    {line.label}：{line.units}
                    {line.unitLabel}
                  </p>
                ))
              )}
              {pacingPreview && totalUnits > 0 && (
                <p className="text-emerald-900 font-black pt-1 border-t border-emerald-100">
                  目安：約{Math.max(1, Math.ceil(pacingPreview.dailyUnits))} / 日（合計{totalUnits}・{PACE_LABELS[paceLevel].label}）
                  <span className="block text-[11px] font-bold text-gray-600 mt-1">
                    月あたり約{Math.max(1, Math.ceil(pacingPreview.monthlyUnits))}（週{pacingPreview.studyDaysPerWeek}日×4週の想定）
                  </span>
                </p>
              )}
              {totalUnits === 0 &&
                !loadingCounts &&
                !(goalTemplateId === 'vocab_book' && goalBookId === '') &&
                !(goalTemplateId === 'textbook_pages' && !goalMaterial.trim()) && (
                  <p className="text-amber-800 font-bold">単語・ページが0のときは目安を出せません。</p>
                )}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={applyTemplateToBigPlan}
                className="w-full py-2.5 rounded-xl bg-white border-2 border-emerald-400 text-emerald-900 text-xs font-black"
              >
                上の文例＋目安を大目標に反映
              </button>
              <button
                type="button"
                onClick={applyPacingToSelectedMonth}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow"
              >
                月計画（{selectedMonth}）に反映 →
              </button>
              <button
                type="button"
                onClick={addPacingDraftToPool}
                className="w-full py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-black"
              >
                日々の予定用・プールに目安タスクを1件追加 →
              </button>
              <button
                type="button"
                onClick={addWeeklyPacingToPool}
                className="w-full py-2 rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-950 text-[11px] font-black"
              >
                プールに週別4件（第1〜4週）を追加 →
              </button>
              <button
                type="button"
                onClick={async () => {
                  await persistGoalPacing()
                  showToast('ペース設定を保存したよ')
                }}
                className="w-full py-2 text-[11px] font-bold text-emerald-800 underline"
              >
                数字だけ保存（テンプレ・ペース）
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-snug">
              上の「反映先の月」が、月計画のテキスト・プールのタスクに使われます。「月計画」タブの前月／翌月とも連動します。
            </p>
          </div>

          <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 border border-gray-100">
            💡 大目標がはっきりすると、月・日のタスクの意味がつかみやすくなります。
          </p>
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
          <p className="text-sm text-gray-600">
            この1か月でどこまで進めるか、教科・ページの目安でも大丈夫です。
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-gray-600 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
            <span>未完了 {monthTasks.length}件</span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-green-700">完了 {monthDoneCount}件</span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span>プール {monthPoolCount}件</span>
          </div>
          {monthTaskProgressPct !== null && (
            <div className="rounded-xl bg-white border border-gray-200 px-3 py-2.5 shadow-sm">
              <div className="flex justify-between items-center text-[11px] font-bold text-gray-600 mb-1.5">
                <span>月内タスク完了率</span>
                <span className="text-green-700">{monthTaskProgressPct}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${monthTaskProgressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 font-bold mt-1.5">完了 {monthDoneCount} / 合計 {monthDoneCount + monthTasks.length}（未完了の学習タスク）</p>
            </div>
          )}
          <div className="rounded-2xl p-3 border border-emerald-200 bg-emerald-50/60 shadow-sm">
            <p className="text-xs font-black text-emerald-900 mb-1">大目標タブのテンプレをここに反映</p>
            <p className="text-[11px] text-emerald-800/95 mb-2 leading-snug">
              「大目標」で選んだテンプレとペースの目安文を、<span className="font-black">{selectedMonth}</span> の月の到達目標にそのまま入れます。
            </p>
            <button
              type="button"
              disabled={loadingCounts || totalUnits <= 0}
              onClick={applyPacingToSelectedMonth}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow disabled:opacity-40"
            >
              この月に目安テキストを反映
            </button>
          </div>
          <div className="rounded-2xl p-4 border border-indigo-100 bg-indigo-50/40 shadow-sm">
            <p className="text-sm font-black text-indigo-900 mb-2">月の到達目標</p>
            <textarea
              value={monthGoalDraft}
              onChange={e => setMonthGoalDraft(e.target.value)}
              rows={4}
              className="w-full bg-white rounded-xl p-3 text-sm font-bold outline-none border border-indigo-100"
              placeholder="例：第2単元の単語を1周する／算数は○ページまで"
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
            <p className="text-xs font-black text-gray-700 mb-2">今月のタスク一覧（未完了）</p>
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
