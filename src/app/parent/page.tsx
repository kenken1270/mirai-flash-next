'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const PARENT_PIN = '0000'

type StudentSummary = {
  username: string
  xp: number
  streak: number
  lastVisit: string
  todayDone: number
  todayTotal: number
  flashToday: number
  weeklyFlash: number
  weeklyDone: number
  weeklyTotal: number
}

export default function ParentPage() {
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)
  const [pinError, setPinError] = useState('')
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

    const [usersRes, plansRes, flashRes] = await Promise.all([
      supabase.from('users').select('username, current_points, streak, last_visit_date').order('username'),
      supabase.from('plans').select('username, is_done, task_date').gte('task_date', weekAgo),
      supabase.from('review_logs').select('username, created_at').gte('created_at', weekAgo + 'T00:00:00'),
    ])

    const users = usersRes.data ?? []
    const plans = plansRes.data ?? []
    const flash = flashRes.data ?? []

    const summaries: StudentSummary[] = users
      .filter(u => !['demokun'].includes(u.username))
      .map(u => {
        const uPlans = plans.filter(p => p.username === u.username)
        const uFlash = flash.filter(f => f.username === u.username)

        const todayPlans = uPlans.filter(p => p.task_date === today)
        const weeklyPlans = uPlans

        const todayFlash = uFlash.filter(f => (f.created_at || '').slice(0, 10) === today)
        const weeklyFlash = uFlash

        return {
          username: u.username,
          xp: u.current_points ?? 0,
          streak: u.streak ?? 0,
          lastVisit: u.last_visit_date || '未ログイン',
          todayDone: todayPlans.filter(p => p.is_done === 1).length,
          todayTotal: todayPlans.length,
          flashToday: todayFlash.length,
          weeklyFlash: weeklyFlash.length,
          weeklyDone: weeklyPlans.filter(p => p.is_done === 1).length,
          weeklyTotal: weeklyPlans.length,
        }
      })

    setStudents(summaries)
    setLastUpdated(new Date().toLocaleTimeString('ja-JP'))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authed) return
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [authed, loadData])

  function handlePin(e: React.FormEvent) {
    e.preventDefault()
    if (pin === PARENT_PIN) {
      setAuthed(true)
      setPinError('')
    } else {
      setPinError('PINが違います')
    }
  }

  // ── PIN入力画面 ──
  if (!authed) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center space-y-6">
        <div className="text-5xl">👨‍👩‍👧</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">保護者モニター</h1>
          <p className="text-gray-500 text-sm mt-1">未来塾 学習状況確認</p>
        </div>
        <form onSubmit={handlePin} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 block mb-2">PINコードを入力</label>
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
          {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
          <button type="submit"
            className="w-full py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-2xl font-bold shadow hover:opacity-90 transition">
            確認する
          </button>
        </form>
        <p className="text-xs text-gray-400">※ PINコードは塾の先生にお問い合わせください</p>
      </div>
    </div>
  )

  const selected = selectedStudent ? students.find(s => s.username === selectedStudent) : null

  // ── 詳細画面 ──
  if (selected) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 pb-10">
      <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-4">
        <button onClick={() => setSelectedStudent(null)} className="text-sm opacity-80 mb-2 hover:opacity-100">
          ← 一覧に戻る
        </button>
        <h1 className="text-xl font-bold">{selected.username} さんの学習状況</h1>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-4">

        {/* 今日の状況 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-3">📅 今日の学習</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{selected.todayDone}/{selected.todayTotal}</div>
              <div className="text-xs text-gray-500 mt-1">タスク完了</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{selected.flashToday}</div>
              <div className="text-xs text-gray-500 mt-1">単語学習枚数</div>
            </div>
          </div>
          {selected.todayTotal > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>進捗</span>
                <span>{selected.todayTotal > 0 ? Math.round(selected.todayDone / selected.todayTotal * 100) : 0}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-400 h-2 rounded-full transition-all"
                  style={{ width: (selected.todayTotal > 0 ? Math.round(selected.todayDone / selected.todayTotal * 100) : 0) + '%' }}></div>
              </div>
            </div>
          )}
          {selected.todayTotal === 0 && (
            <p className="text-sm text-gray-400 mt-2 text-center">今日のタスクはありません</p>
          )}
        </div>

        {/* 今週の状況 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-3">📆 今週の学習（7日間）</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{selected.weeklyDone}/{selected.weeklyTotal}</div>
              <div className="text-xs text-gray-500 mt-1">タスク完了</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-orange-500">{selected.weeklyFlash}</div>
              <div className="text-xs text-gray-500 mt-1">単語学習枚数</div>
            </div>
          </div>
        </div>

        {/* XP・連続記録 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-3">🏆 実績</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{selected.xp.toLocaleString()}</div>
              <div className="text-xs text-gray-500">総XP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{selected.streak}🔥</div>
              <div className="text-xs text-gray-500">連続学習日</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-600">{selected.lastVisit}</div>
              <div className="text-xs text-gray-500">最終学習日</div>
            </div>
          </div>
        </div>

        {/* メッセージ */}
        <div className={"rounded-2xl p-4 text-center " + (
          selected.todayDone === selected.todayTotal && selected.todayTotal > 0 ? 'bg-green-100 text-green-700' :
          selected.flashToday > 0 || selected.todayDone > 0 ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-500'
        )}>
          <p className="font-bold text-lg">
            {selected.todayDone === selected.todayTotal && selected.todayTotal > 0 ? '🎉 今日のタスクを全部終わらせました！' :
             selected.flashToday > 0 || selected.todayDone > 0 ? '📚 今日も頑張って勉強しています！' :
             '😴 今日はまだ学習していません'}
          </p>
        </div>
      </div>
    </div>
  )

  // ── 一覧画面 ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 pb-10">
      <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">👨‍👩‍👧 保護者モニター</h1>
            <p className="text-sm opacity-80 mt-0.5">未来塾 学習状況</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">{lastUpdated}</span>
            <button onClick={loadData}
              className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition">
              🔄
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3 animate-bounce">👨‍👩‍👧</div>
            <p>読み込み中...</p>
          </div>
        ) : (
          <>
            {/* サマリー */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-green-600">
                  {students.filter(s => s.todayDone > 0 || s.flashToday > 0).length}
                </div>
                <div className="text-xs text-gray-500">今日学習した</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-600">
                  {students.reduce((a, s) => a + s.todayDone, 0)}
                </div>
                <div className="text-xs text-gray-500">完了タスク</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-purple-600">
                  {students.reduce((a, s) => a + s.flashToday, 0)}
                </div>
                <div className="text-xs text-gray-500">単語学習枚数</div>
              </div>
            </div>

            {/* 生徒カード */}
            {students.map(s => {
              const pct = s.todayTotal > 0 ? Math.round(s.todayDone / s.todayTotal * 100) : 0
              const isActive = s.todayDone > 0 || s.flashToday > 0
              const isToday = s.lastVisit === new Date().toISOString().slice(0, 10)

              return (
                <button key={s.username} onClick={() => setSelectedStudent(s.username)}
                  className={"w-full bg-white rounded-2xl p-4 shadow-sm border text-left hover:shadow-md transition " +
                    (isActive ? 'border-green-200' : 'border-gray-100')}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={"w-3 h-3 rounded-full " + (isActive ? 'bg-green-400' : isToday ? 'bg-yellow-400' : 'bg-gray-300')}></span>
                      <span className="font-bold text-gray-800">{s.username}</span>
                      {isActive && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">学習中</span>}
                    </div>
                    <span className="text-xs text-yellow-500 font-bold">⚡{s.xp.toLocaleString()}</span>
                  </div>

                  {s.todayTotal > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>今日のタスク</span>
                        <span>{s.todayDone}/{s.todayTotal}（{pct}%）</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-green-400 h-1.5 rounded-full transition-all" style={{ width: pct + '%' }}></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 text-xs text-gray-500">
                    {s.todayTotal === 0 && <span>📋 今日のタスクなし</span>}
                    {s.flashToday > 0 && <span className="text-purple-600">🃏 {s.flashToday}枚</span>}
                    <span className="text-orange-500">🔥 {s.streak}日連続</span>
                    <span className="ml-auto text-gray-400">›</span>
                  </div>
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}