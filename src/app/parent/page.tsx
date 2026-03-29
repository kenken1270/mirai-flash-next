'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type ParentRecord = {
  id: number
  parent_name: string
  student_username: string
  pin: string
}

type DailyActivity = {
  date: string
  done: number
  total: number
  flash: number
}

type WordStat = {
  word: string
  meaning: string
  quality: number
  repetitions: number
  ease_factor: number
}

type SubjectStat = {
  subject: string
  done: number
  total: number
}

type DetailData = {
  xp: number
  streak: number
  lastVisit: string
  todayDone: number
  todayTotal: number
  flashToday: number
  weeklyActivity: DailyActivity[]
  strongWords: WordStat[]
  weakWords: WordStat[]
  subjectStats: SubjectStat[]
  totalFlash: number
  avgAccuracy: number
  recentTasks: { task_name: string; mid_plan: string; is_done: number; task_date: string }[]
}

export default function ParentPage() {
  const [studentName, setStudentName] = useState('')
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)
  const [parentRecord, setParentRecord] = useState<ParentRecord | null>(null)
  const [pinError, setPinError] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'words' | 'subjects'>('today')
  const [lastUpdated, setLastUpdated] = useState('')

  const loadDetail = useCallback(async (username: string) => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

    const [userRes, plansRes, flashRes, cardsRes] = await Promise.all([
      supabase.from('users').select('current_points, streak, last_visit_date').eq('username', username).limit(1),
      supabase.from('plans').select('task_name, mid_plan, is_done, task_date').eq('username', username).gte('task_date', monthAgo),
      supabase.from('review_logs').select('flashcard_id, quality, ease_factor, repetitions, created_at').eq('username', username),
      supabase.from('flashcards').select('id, word, meaning'),
    ])

    const user = userRes.data?.[0]
    const plans = plansRes.data ?? []
    const logs = flashRes.data ?? []
    const cards = cardsRes.data ?? []

    // カードマップ
    const cardMap = new Map(cards.map(c => [c.id, c]))

    // 今日のタスク
    const todayPlans = plans.filter(p => p.task_date === today)

    // 今日のフラッシュ
    const todayFlash = logs.filter(l => (l.created_at || '').slice(0, 10) === today)

    // 週別アクティビティ（7日分）
    const weeklyActivity: DailyActivity[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      const dayPlans = plans.filter(p => p.task_date === d)
      const dayFlash = logs.filter(l => (l.created_at || '').slice(0, 10) === d)
      weeklyActivity.push({
        date: d.slice(5),
        done: dayPlans.filter(p => p.is_done === 1).length,
        total: dayPlans.length,
        flash: dayFlash.length,
      })
    }

    // 得意単語（quality >= 4 かつ repetitions >= 2）
    const strongWords: WordStat[] = logs
      .filter(l => l.quality >= 4 && l.repetitions >= 2)
      .sort((a, b) => b.ease_factor - a.ease_factor)
      .slice(0, 5)
      .map(l => ({
        word: cardMap.get(l.flashcard_id)?.word ?? '?',
        meaning: cardMap.get(l.flashcard_id)?.meaning ?? '?',
        quality: l.quality,
        repetitions: l.repetitions,
        ease_factor: l.ease_factor,
      }))

    // 苦手単語（quality <= 2 または ease_factor < 1.5）
    const weakWords: WordStat[] = logs
      .filter(l => l.quality <= 2 || l.ease_factor < 1.5)
      .sort((a, b) => a.ease_factor - b.ease_factor)
      .slice(0, 5)
      .map(l => ({
        word: cardMap.get(l.flashcard_id)?.word ?? '?',
        meaning: cardMap.get(l.flashcard_id)?.meaning ?? '?',
        quality: l.quality,
        repetitions: l.repetitions,
        ease_factor: l.ease_factor,
      }))

    // 教科別完了率
    const subjectMap = new Map<string, { done: number; total: number }>()
    plans.forEach(p => {
      const s = p.mid_plan || 'その他'
      if (!subjectMap.has(s)) subjectMap.set(s, { done: 0, total: 0 })
      const v = subjectMap.get(s)!
      v.total++
      if (p.is_done === 1) v.done++
    })
    const subjectStats: SubjectStat[] = Array.from(subjectMap.entries())
      .map(([subject, v]) => ({ subject, ...v }))
      .sort((a, b) => (b.done / b.total) - (a.done / a.total))

    // 全体正解率
    const totalCorrect = logs.filter(l => l.quality >= 3).length
    const avgAccuracy = logs.length > 0 ? Math.round((totalCorrect / logs.length) * 100) : 0

    // 直近タスク（7日分）
    const recentTasks = plans
      .filter(p => p.task_date >= weekAgo)
      .sort((a, b) => b.task_date.localeCompare(a.task_date))
      .slice(0, 10)

    setDetail({
      xp: user?.current_points ?? 0,
      streak: user?.streak ?? 0,
      lastVisit: user?.last_visit_date || '未ログイン',
      todayDone: todayPlans.filter(p => p.is_done === 1).length,
      todayTotal: todayPlans.length,
      flashToday: todayFlash.length,
      weeklyActivity,
      strongWords,
      weakWords,
      subjectStats,
      totalFlash: logs.length,
      avgAccuracy,
      recentTasks,
    })
    setLastUpdated(new Date().toLocaleTimeString('ja-JP'))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authed || !parentRecord) return
    loadDetail(parentRecord.student_username)
    const interval = setInterval(() => loadDetail(parentRecord.student_username), 60000)
    return () => clearInterval(interval)
  }, [authed, parentRecord, loadDetail])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!studentName.trim()) { setPinError('お子さんの名前を入力してください'); return }
    const { data } = await supabase
      .from('parents')
      .select('*')
      .eq('student_username', studentName.trim())
      .eq('pin', pin.trim())
      .limit(1)
    if (data && data.length > 0) {
      setParentRecord(data[0])
      setAuthed(true)
      setPinError('')
    } else {
      setPinError('お子さんの名前またはPINが違います')
    }
  }

  // ── ログイン画面 ──
  if (!authed) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-3">👨‍👩‍👧</div>
          <h1 className="text-2xl font-bold text-gray-800">保護者ページ</h1>
          <p className="text-gray-500 text-sm mt-1">お子さんの学習状況を確認</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-600 block mb-1">お子さんのお名前</label>
            <input
              type="text"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="例: Demo小2"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-400 text-gray-800"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-600 block mb-1">PINコード（4桁）</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="0000"
              className="w-full text-center text-2xl tracking-widest border-2 border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-400"
            />
          </div>
          {pinError && <p className="text-red-500 text-sm text-center">{pinError}</p>}
          <button type="submit"
            className="w-full py-4 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 transition">
            確認する
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center">※ PINコードは塾の先生からお知らせします</p>
      </div>
    </div>
  )

  if (loading || !detail) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-100">
      <div className="text-center space-y-3">
        <div className="text-5xl animate-bounce">📊</div>
        <p className="text-gray-500">学習データを読み込み中...</p>
      </div>
    </div>
  )

  const TABS = [
    { key: 'today',    icon: '📅', label: '今日' },
    { key: 'week',     icon: '📆', label: '今週' },
    { key: 'words',    icon: '🃏', label: '単語分析' },
    { key: 'subjects', icon: '📚', label: '教科別' },
  ] as const

  const todayPct = detail.todayTotal > 0 ? Math.round(detail.todayDone / detail.todayTotal * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 pb-10">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">保護者ページ</p>
              <h1 className="text-xl font-bold">{parentRecord?.student_username} さんの学習</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">{lastUpdated}</span>
              <button onClick={() => loadDetail(parentRecord!.student_username)}
                className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg text-xs transition">🔄</button>
              <button onClick={() => { setAuthed(false); setDetail(null) }}
                className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg text-xs transition">🚪</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* ステータスカード */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-yellow-100">
            <div className="text-2xl font-bold text-yellow-500">{detail.xp.toLocaleString()}</div>
            <div className="text-xs text-gray-500">総XP</div>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-orange-100">
            <div className="text-2xl font-bold text-orange-500">{detail.streak}🔥</div>
            <div className="text-xs text-gray-500">連続学習日</div>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-purple-100">
            <div className="text-2xl font-bold text-purple-600">{detail.avgAccuracy}%</div>
            <div className="text-xs text-gray-500">単語正解率</div>
          </div>
        </div>

        {/* タブ */}
        <div className="grid grid-cols-4 gap-1.5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={"py-2 rounded-xl text-xs font-bold transition " +
                (activeTab === t.key ? 'bg-green-600 text-white shadow' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50')}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── 今日タブ ── */}
        {activeTab === 'today' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-3">📅 今日の学習状況</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-3xl font-bold text-blue-600">{detail.todayDone}/{detail.todayTotal}</div>
                  <div className="text-xs text-gray-500 mt-1">タスク完了</div>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <div className="text-3xl font-bold text-purple-600">{detail.flashToday}</div>
                  <div className="text-xs text-gray-500 mt-1">単語学習枚数</div>
                </div>
              </div>
              {detail.todayTotal > 0 ? (
                <>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>進捗</span><span>{todayPct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className={"h-3 rounded-full transition-all " + (todayPct === 100 ? 'bg-green-500' : 'bg-blue-400')}
                      style={{ width: todayPct + '%' }}></div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center">今日のタスクはありません</p>
              )}
            </div>

            {/* 今日のメッセージ */}
            <div className={"rounded-2xl p-4 text-center font-bold " + (
              todayPct === 100 && detail.todayTotal > 0 ? 'bg-green-100 text-green-700 text-lg' :
              detail.flashToday > 10 ? 'bg-purple-100 text-purple-700' :
              detail.todayDone > 0 || detail.flashToday > 0 ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-500'
            )}>
              {todayPct === 100 && detail.todayTotal > 0 ? '🎉 今日のタスクを全て終わらせました！素晴らしい！' :
               detail.flashToday > 10 ? 🃏 単語を枚も学習しました！ :
               detail.todayDone > 0 || detail.flashToday > 0 ? '📚 今日も頑張って勉強しています！' :
               '😴 今日はまだ学習していません'}
            </div>

            {/* 直近タスク */}
            {detail.recentTasks.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="font-bold text-gray-700 mb-3">📋 直近のタスク</h3>
                <div className="space-y-2">
                  {detail.recentTasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-lg">{t.is_done === 1 ? '✅' : '⬜'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={"text-sm font-medium " + (t.is_done === 1 ? 'line-through text-gray-400' : 'text-gray-700')}>{t.task_name}</p>
                        <p className="text-xs text-gray-400">{t.mid_plan} · {t.task_date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 今週タブ ── */}
        {activeTab === 'week' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-4">📆 7日間の学習カレンダー</h2>
              <div className="grid grid-cols-7 gap-1">
                {detail.weeklyActivity.map((day, i) => {
                  const pct = day.total > 0 ? Math.round(day.done / day.total * 100) : 0
                  const hasActivity = day.done > 0 || day.flash > 0
                  return (
                    <div key={i} className="text-center">
                      <div className="text-xs text-gray-400 mb-1">{day.date.slice(3)}</div>
                      <div className={"w-full aspect-square rounded-lg flex flex-col items-center justify-center text-xs " +
                        (day.done === day.total && day.total > 0 ? 'bg-green-400 text-white' :
                         hasActivity ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-400')}>
                        {hasActivity ? (
                          <>
                            <span className="font-bold">{day.done}</span>
                            <span className="text-xs opacity-70">/{day.total}</span>
                          </>
                        ) : <span>—</span>}
                      </div>
                      {day.flash > 0 && (
                        <div className="text-xs text-purple-500 mt-0.5">{day.flash}枚</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-3 mt-3 text-xs text-gray-500 justify-center">
                <span><span className="inline-block w-3 h-3 rounded bg-green-400 mr-1"></span>全完了</span>
                <span><span className="inline-block w-3 h-3 rounded bg-blue-200 mr-1"></span>学習あり</span>
                <span><span className="inline-block w-3 h-3 rounded bg-gray-100 mr-1"></span>未学習</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <div className="text-3xl font-bold text-green-600">
                  {detail.weeklyActivity.filter(d => d.done > 0 || d.flash > 0).length}日
                </div>
                <div className="text-xs text-gray-500 mt-1">学習した日数</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {detail.weeklyActivity.reduce((a, d) => a + d.flash, 0)}枚
                </div>
                <div className="text-xs text-gray-500 mt-1">単語学習枚数</div>
              </div>
            </div>
          </div>
        )}

        {/* ── 単語分析タブ ── */}
        {activeTab === 'words' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-indigo-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{detail.totalFlash}</div>
                  <div className="text-xs text-gray-500">総学習枚数</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{detail.avgAccuracy}%</div>
                  <div className="text-xs text-gray-500">全体正解率</div>
                </div>
              </div>
            </div>

            {/* 得意単語 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-green-700 mb-3">✅ 得意な単語 TOP5</h3>
              {detail.strongWords.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">まだデータがありません</p>
              ) : (
                <div className="space-y-2">
                  {detail.strongWords.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-lg font-bold text-yellow-500">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800 text-sm">{w.word}</p>
                        <p className="text-xs text-gray-500">{w.meaning}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{w.repetitions}回正解</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 苦手単語 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-red-600 mb-3">⚠️ 苦手な単語（要復習）</h3>
              {detail.weakWords.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">苦手な単語はありません🎉</p>
              ) : (
                <div className="space-y-2">
                  {detail.weakWords.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-lg">❌</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800 text-sm">{w.word}</p>
                        <p className="text-xs text-gray-500">{w.meaning}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">要復習</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {detail.weakWords.length > 0 && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                  💡 これらの単語を家庭でも確認してみましょう
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── 教科別タブ ── */}
        {activeTab === 'subjects' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-4">📚 教科・単元別 完了率</h2>
              {detail.subjectStats.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">タスクデータがありません</p>
              ) : (
                <div className="space-y-3">
                  {detail.subjectStats.map((s, i) => {
                    const pct = s.total > 0 ? Math.round(s.done / s.total * 100) : 0
                    const color = pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-blue-400' : pct >= 30 ? 'bg-yellow-400' : 'bg-red-400'
                    const badge = pct >= 80 ? '得意✨' : pct >= 50 ? 'まあまあ' : pct >= 30 ? 'もう少し' : '要強化⚠️'
                    const badgeColor = pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-blue-100 text-blue-700' : pct >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-gray-700 truncate flex-1">{s.subject}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">{s.done}/{s.total}</span>
                            <span className={"text-xs px-2 py-0.5 rounded-full font-bold " + badgeColor}>{badge}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div className={"h-2.5 rounded-full transition-all " + color} style={{ width: pct + '%' }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 得意・不得意サマリー */}
            {detail.subjectStats.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-2xl p-4 shadow-sm border border-green-100">
                  <h3 className="text-sm font-bold text-green-700 mb-2">✨ 得意な科目</h3>
                  {detail.subjectStats.filter(s => Math.round(s.done/s.total*100) >= 70).slice(0,3).map((s, i) => (
                    <p key={i} className="text-xs text-green-600 py-0.5">• {s.subject}</p>
                  ))}
                  {detail.subjectStats.filter(s => Math.round(s.done/s.total*100) >= 70).length === 0 && (
                    <p className="text-xs text-gray-400">まだ評価できません</p>
                  )}
                </div>
                <div className="bg-red-50 rounded-2xl p-4 shadow-sm border border-red-100">
                  <h3 className="text-sm font-bold text-red-600 mb-2">⚠️ 強化が必要</h3>
                  {detail.subjectStats.filter(s => Math.round(s.done/s.total*100) < 30).slice(0,3).map((s, i) => (
                    <p key={i} className="text-xs text-red-500 py-0.5">• {s.subject}</p>
                  ))}
                  {detail.subjectStats.filter(s => Math.round(s.done/s.total*100) < 30).length === 0 && (
                    <p className="text-xs text-gray-400">問題ありません🎉</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}