'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUsernameFromSession } from '@/lib/auth-user'
import { loadUser, loadPlans, updatePlan, todayStr, type UserRow, type PlanRow } from '@/lib/student'
import { withTimeout } from '@/lib/with-timeout'
import { MONTH_SUMMARY, planRowBelongsToMonth } from '@/lib/plan-month'

const AUTH_SESSION_MS = 18000
const USER_DATA_MS = 25000

/** ホームのEXPバー用。次の区切りまでの進捗（ゲーム設計で閾値は差し替え可） */
const EXP_BAR_SEGMENT = 100

export default function StudentHomePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRow | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [bootError, setBootError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function init() {
      setBootError('')
      try {
        const { data: sessionData, error: sessionErr } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_MS,
          'ログイン状態の確認'
        )
        if (sessionErr) {
          router.replace('/login')
          return
        }
        const session = sessionData.session
        if (!session) {
          router.replace('/login')
          return
        }
        const uname = getUsernameFromSession(session)
        if (!uname) {
          router.replace('/login')
          return
        }
        const [u, p] = await withTimeout(
          Promise.all([loadUser(uname), loadPlans(uname)]),
          USER_DATA_MS,
          '学習データの読み込み'
        )
        if (cancelled) return
        setUser(u)
        setPlans(p)
      } catch (e) {
        console.error('student home init:', e)
        const msg = e instanceof Error ? e.message : ''
        if (!cancelled) {
          setBootError(
            msg.includes('ms を超え')
              ? '接続がタイムアウトしました。ネットワークを確認し、再読み込みしてください。'
              : 'データを読み込めませんでした。'
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

  const todayTasks = plans.filter(p => p.task_date === todayStr())
  const thisMonthKey = todayStr().slice(0, 7)
  const monthSummaryRow = plans.find(
    p => p.task_type === MONTH_SUMMARY && p.month_plan === thisMonthKey
  )
  const bigGoalPreview = (plans[0]?.big_plan || '').trim() || '（大目標は「未来の計画」で書けます）'
  const monthGoalPreview = (monthSummaryRow?.task_name || '').trim() || '（今月の到達目標を書こう）'
  const monthLabelJa = (() => {
    const [y, m] = thisMonthKey.split('-')
    return y && m ? `${y}年${Number(m)}月` : thisMonthKey
  })()

  const poolThisMonthCount = plans.filter(
    p =>
      !p.task_date &&
      p.is_done === 0 &&
      p.task_type !== MONTH_SUMMARY &&
      p.month_plan === thisMonthKey
  ).length

  const monthDoneCountHome = plans.filter(
    p => planRowBelongsToMonth(p, thisMonthKey) && p.is_done === 1
  ).length

  const doneCount = todayTasks.filter(t => t.is_done === 1).length
  const progress = todayTasks.length > 0 ? Math.round((doneCount / todayTasks.length) * 100) : 0
  const expPts = user?.current_points ?? 0
  /** 表示用レベル（0 EXP なら 1）。DB の grade_num（学年など）とは別 */
  const displayLevel = Math.floor(expPts / EXP_BAR_SEGMENT) + 1
  const expBarPct = EXP_BAR_SEGMENT > 0
    ? Math.min(100, Math.round(((expPts % EXP_BAR_SEGMENT) / EXP_BAR_SEGMENT) * 100))
    : 0

  async function toggleDone(e: React.MouseEvent, task: PlanRow) {
    e.stopPropagation() // 親要素のクリックイベント（ページ遷移）を防ぐ
    const nd = task.is_done === 1 ? 0 : 1
    await updatePlan(task.id, { is_done: nd })
    setPlans(await loadPlans(user?.username || ''))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] animate-pulse text-yellow-600 font-bold">🐕 作戦会議中...</div>

  if (bootError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFDF0] p-6 gap-4 text-center">
        <p className="text-red-700 font-bold text-sm max-w-sm">{bootError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="py-3 px-8 bg-yellow-400 text-gray-900 rounded-2xl font-black shadow"
        >
          再読み込み
        </button>
        <button type="button" onClick={() => router.replace('/login')} className="text-sm font-bold text-indigo-600 underline">
          ログインへ戻る
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col space-y-6 p-4 bg-[#FFFDF0]">
      {/* ユーザープロフィール（色味を柔らかく調整） */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-yellow-100 flex items-center gap-4">
        <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center text-3xl shadow-inner">🐶</div>
        <div className="flex-1">
          <h2 className="font-black text-base text-gray-700">{user?.nickname || user?.username} さん</h2>
          <p className="text-[10px] text-gray-500 font-bold tracking-wide">
            レベル {displayLevel} · {expPts} EXP
          </p>
          <div className="h-1.5 w-full bg-gray-50 rounded-full mt-2 overflow-hidden border border-gray-100">
            <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${expBarPct}%` }}></div>
          </div>
        </div>
      </div>

      {/* 計画の要約（ホーム ↔ 未来の計画） */}
      <button
        type="button"
        onClick={() => router.push('/student/plan')}
        className="w-full text-left bg-gradient-to-br from-emerald-50 to-white p-5 rounded-[2rem] border-2 border-emerald-100 shadow-sm active:scale-[0.99] transition"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-black text-emerald-800 tracking-wide">未来の計画</p>
          <span className="text-[10px] font-black text-emerald-600">編集 →</span>
        </div>
        <p className="text-[11px] font-black text-gray-500 mt-1">大目標</p>
        <p className="text-sm font-bold text-gray-900 line-clamp-2 mt-0.5 leading-snug">{bigGoalPreview}</p>
        <p className="text-[11px] font-black text-gray-500 mt-3">{monthLabelJa}の到達目標</p>
        <p className="text-sm font-bold text-indigo-950 line-clamp-3 mt-0.5 leading-snug">{monthGoalPreview}</p>
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-emerald-100/90">
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-white border border-emerald-100 text-emerald-900">
            今日の予定 {todayTasks.length}件
          </span>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-white border border-emerald-100 text-emerald-900">
            {monthLabelJa}・プール {poolThisMonthCount}件
          </span>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-white border border-green-200 text-green-800">
            {monthLabelJa}・完了 {monthDoneCountHome}件
          </span>
        </div>
      </button>

      {/* 今日のミッション（クリックで学習ページへ） */}
      <div className="space-y-3">
        <div className="flex justify-between items-end px-1">
          <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-[0.2em]">Today's Missions</h3>
          <span className="text-[10px] font-black text-indigo-400">{doneCount} / {todayTasks.length} Done</span>
        </div>
        
        <div className="bg-white p-5 rounded-[2.5rem] shadow-md border-2 border-yellow-200">
          {todayTasks.length === 0 ? (
            <div className="py-6 text-center space-y-4">
              <p className="text-gray-300 font-bold italic text-sm">今日はまだクエストがないよ</p>
              {poolThisMonthCount > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-left">
                  <p className="text-xs font-bold text-amber-900 leading-relaxed">
                    プールにタスクが{poolThisMonthCount}件あります。「日々の予定」で日付を付けて、今日の予定に入れよう。
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/student/plan?tab=daily')}
                    className="mt-3 w-full py-2.5 rounded-xl bg-amber-400 text-gray-900 text-xs font-black shadow-sm active:scale-[0.99]"
                  >
                    日々の予定を開く →
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => router.push('/student/plan')}
                className="bg-yellow-400 text-gray-800 px-8 py-3 rounded-2xl font-black text-sm shadow-md active:scale-95 transition"
              >
                🗓️ 計画をたてる
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                  <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="font-black text-green-500 text-sm">{progress}%</span>
              </div>
              
              <div className="space-y-2 pt-2">
                {todayTasks.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => router.push(`/student/study?taskId=${t.id}`)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] cursor-pointer ${t.is_done ? 'bg-gray-50 border-gray-100' : 'bg-white border-yellow-50 hover:border-yellow-200 shadow-sm'}`}
                  >
                    <button 
                      onClick={(e) => toggleDone(e, t)} 
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${t.is_done === 1 ? 'bg-green-500 border-green-500 shadow-inner' : 'bg-white border-gray-200'}`}
                    >
                      {t.is_done === 1 && <span className="text-white font-black text-sm">✓</span>}
                    </button>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${t.is_done ? 'text-gray-300 line-through' : 'text-gray-700'}`}>{t.task_name}</p>
                      <p className="text-[10px] text-indigo-300 font-bold mt-0.5 uppercase tracking-tighter">▶︎ タップして学習を開始</p>
                    </div>
                    <span className="text-gray-200 text-xl">›</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* サブアクション（色味を柔らかく） */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => router.push('/flash')} className="bg-white border-2 border-indigo-50 p-5 rounded-[2rem] shadow-sm flex flex-col items-center gap-2 active:scale-95 transition">
          <span className="text-3xl">🃏</span>
          <span className="font-black text-[10px] text-indigo-400 uppercase tracking-widest">Training</span>
        </button>
        <button onClick={() => router.push('/student/test')} className="bg-white border-2 border-orange-50 p-5 rounded-[2rem] shadow-sm flex flex-col items-center gap-2 active:scale-95 transition">
          <span className="text-3xl">📝</span>
          <span className="font-black text-[10px] text-orange-400 uppercase tracking-widest">Test</span>
        </button>
      </div>
    </div>
  )
}