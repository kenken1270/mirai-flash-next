'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadAllUsers, loadNews, insertNews, deleteNews, loadAllPlans, insertPlan, deletePlan, todayStr, type UserRow, type NewsRow, type PlanRow } from '@/lib/student'

const ADMIN_PASSWORD = 'admin'
type Tab = 'realtime' | 'progress' | 'news' | 'tasks'

type TodayStats = {
  username: string
  totalTasks: number
  doneTasks: number
  flashToday: number
  lastLogin: string
}

export default function AdminPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [adminPwd, setAdminPwd] = useState('')
  const [adminError, setAdminError] = useState('')
  const [tab, setTab] = useState<Tab>('realtime')
  const [users, setUsers] = useState<UserRow[]>([])
  const [news, setNews] = useState<NewsRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [todayStats, setTodayStats] = useState<TodayStats[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')
  const [newMsg, setNewMsg] = useState('')
  const [newTarget, setNewTarget] = useState('全員')
  const [taskUser, setTaskUser] = useState('')
  const [taskBig, setTaskBig] = useState('')
  const [taskMid, setTaskMid] = useState('')
  const [taskName, setTaskName] = useState('')
  const [taskDate, setTaskDate] = useState(todayStr())
  const [taskType, setTaskType] = useState('lesson')
  const [taskVideo, setTaskVideo] = useState('')
  const [taskPage, setTaskPage] = useState('')
  const [taskPlanned, setTaskPlanned] = useState(0)
  const [taskSaving, setTaskSaving] = useState(false)
  const [taskMsg, setTaskMsg] = useState('')

  useEffect(() => {
    const isAdmin = localStorage.getItem('mirai_admin')
    if (isAdmin === 'true') { setAuthed(true); loadData() }
  }, [])

  const loadRealtimeStats = useCallback(async (userList: UserRow[]) => {
    const today = todayStr()
    const { data: todayPlans } = await supabase
      .from('plans')
      .select('username, is_done')
      .eq('task_date', today)

    const { data: flashLogs } = await supabase
      .from('review_logs')
      .select('username, created_at')
      .gte('created_at', today + 'T00:00:00')

    const stats: TodayStats[] = userList.map(u => {
      const uPlans = (todayPlans || []).filter(p => p.username === u.username)
      const uFlash = (flashLogs || []).filter(f => f.username === u.username)
      return {
        username: u.username,
        totalTasks: uPlans.length,
        doneTasks: uPlans.filter(p => p.is_done === 1).length,
        flashToday: uFlash.length,
        lastLogin: u.last_visit_date || '未ログイン'
      }
    })
    setTodayStats(stats)
    setLastUpdated(new Date().toLocaleTimeString('ja-JP'))
  }, [])

  async function loadData() {
    setLoading(true)
    const [u, n, p] = await Promise.all([loadAllUsers(), loadNews(), loadAllPlans()])
    setUsers(u)
    setNews(n)
    setPlans(p)
    if (u.length > 0) setTaskUser(u[0].username)
    await loadRealtimeStats(u)
    setLoading(false)
  }

  // 30秒ごと自動更新
  useEffect(() => {
    if (!authed) return
    const interval = setInterval(() => {
      if (users.length > 0) loadRealtimeStats(users)
    }, 30000)
    return () => clearInterval(interval)
  }, [authed, users, loadRealtimeStats])

  function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    if (adminPwd === ADMIN_PASSWORD) {
      localStorage.setItem('mirai_admin', 'true')
      setAuthed(true)
      loadData()
    } else { setAdminError('パスワードが違います') }
  }

  function handleLogout() {
    localStorage.removeItem('mirai_admin')
    router.push('/login')
  }

  async function handleAddNews(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim()) return
    await insertNews({ message: newMsg.trim(), created_date: todayStr(), target_user: newTarget })
    setNewMsg('')
    setNews(await loadNews())
  }

  async function handleDeleteNews(id: number) {
    if (!confirm('このお知らせを削除しますか？')) return
    await deleteNews(id)
    setNews(await loadNews())
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskName.trim() || !taskUser || !taskBig.trim() || !taskMid.trim()) return
    setTaskSaving(true)
    await insertPlan({
      username: taskUser, big_plan: taskBig.trim(), mid_plan: taskMid.trim(),
      task_name: taskName.trim(), task_date: taskDate, is_done: 0,
      video_url: taskVideo.trim(), material_id: '', page_range: taskPage.trim(),
      deadline: '', month_plan: '', task_type: taskType,
    })
    setTaskName(''); setTaskVideo(''); setTaskPage('')
    setTaskMsg('✅ タスクを追加しました！')
    setTimeout(() => setTaskMsg(''), 2000)
    setPlans(await loadAllPlans())
    setTaskSaving(false)
  }

  async function handleDeleteTask(id: number) {
    if (!confirm('このタスクを削除しますか？')) return
    await deletePlan(id)
    setPlans(await loadAllPlans())
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-sm">
          <h2 className="text-xl font-bold text-center text-gray-700 mb-5">👨‍🏫 管理者ログイン</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input type="password" value={adminPwd} onChange={e => setAdminPwd(e.target.value)}
              placeholder="管理者パスワード"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-400" />
            {adminError && <p className="text-red-500 text-sm">{adminError}</p>}
            <button type="submit"
              className="w-full bg-gray-700 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition">
              ログイン
            </button>
            <button type="button" onClick={() => router.push('/login')}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600">
              ← 生徒ログインに戻る
            </button>
          </form>
        </div>
      </div>
    )
  }

  const TAB_CONFIG: { key: Tab; label: string; icon: string }[] = [
    { key: 'realtime', label: 'リアルタイム', icon: '📡' },
    { key: 'progress', label: '生徒進捗', icon: '📊' },
    { key: 'news',     label: 'お知らせ', icon: '📢' },
    { key: 'tasks',    label: 'タスク管理', icon: '📅' },
  ]

  const userPlans = plans.filter(p => p.username === taskUser)
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏫</span>
          <span className="font-bold">未来塾 管理者画面</span>
        </div>
        <button onClick={handleLogout}
          className="text-sm bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded-full transition">
          🚪 ログアウト
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {TAB_CONFIG.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={"py-2 rounded-xl text-xs font-bold transition shadow-sm " +
                (tab === key ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50')}>
              {icon} {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <>
            {/* ── タブ①：リアルタイム ── */}
            {tab === 'realtime' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700">📡 今日の学習状況（リアルタイム）</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">更新: {lastUpdated}</span>
                    <button onClick={() => loadRealtimeStats(users)}
                      className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-200 transition">
                      🔄 更新
                    </button>
                  </div>
                </div>

                {/* サマリー */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-indigo-100">
                    <div className="text-2xl font-bold text-indigo-600">
                      {todayStats.filter(s => s.doneTasks > 0).length}
                    </div>
                    <div className="text-xs text-gray-500">学習中の生徒</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-green-100">
                    <div className="text-2xl font-bold text-green-600">
                      {todayStats.reduce((a, s) => a + s.doneTasks, 0)}
                    </div>
                    <div className="text-xs text-gray-500">完了タスク数</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-purple-100">
                    <div className="text-2xl font-bold text-purple-600">
                      {todayStats.reduce((a, s) => a + s.flashToday, 0)}
                    </div>
                    <div className="text-xs text-gray-500">単語学習枚数</div>
                  </div>
                </div>

                {/* 生徒別カード */}
                {todayStats.map(s => {
                  const pct = s.totalTasks > 0 ? Math.round((s.doneTasks / s.totalTasks) * 100) : 0
                  const isActive = s.doneTasks > 0 || s.flashToday > 0
                  return (
                    <div key={s.username}
                      className={"bg-white rounded-xl p-4 shadow-sm border " +
                        (isActive ? 'border-green-200' : 'border-gray-100')}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={"w-2 h-2 rounded-full " + (isActive ? 'bg-green-400' : 'bg-gray-300')}></span>
                          <span className="font-bold text-gray-800 text-sm">{s.username}</span>
                          {isActive && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">学習中</span>}
                        </div>
                        <span className="text-xs text-gray-400">{s.lastLogin}</span>
                      </div>
                      {s.totalTasks > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>タスク進捗</span>
                            <span>{s.doneTasks}/{s.totalTasks}完了 ({pct}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-green-400 h-2 rounded-full transition-all"
                              style={{ width: pct + '%' }}></div>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-3 text-xs text-gray-500">
                        {s.totalTasks === 0 && <span>📋 今日のタスクなし</span>}
                        {s.flashToday > 0 && <span className="text-purple-600 font-bold">🃏 単語 {s.flashToday}枚</span>}
                        {s.flashToday === 0 && s.totalTasks > 0 && <span>🃏 単語未学習</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── タブ②：生徒進捗 ── */}
            {tab === 'progress' && (
              <div className="space-y-3">
                <h2 className="font-bold text-gray-700">📊 生徒の進捗一覧（{users.length}名）</h2>
                {users.map(u => {
                  const isOld = !u.last_visit_date || u.last_visit_date < cutoff
                  return (
                    <div key={u.id}
                      className={"bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between " +
                        (isOld ? 'border-red-200 bg-red-50' : 'border-gray-100')}>
                      <div>
                        <p className="font-bold text-gray-800">{u.username}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          最終ログイン: {u.last_visit_date || '未ログイン'}
                          {isOld && <span className="ml-2 text-red-500 font-bold">⚠️ 要確認</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-yellow-500">⚡ {(u.current_points ?? 0).toLocaleString()} XP</p>
                        <p className="text-xs text-gray-400">🔥 {u.streak ?? 0}日連続</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── タブ③：お知らせ ── */}
            {tab === 'news' && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-700">📢 お知らせ管理</h2>
                <form onSubmit={handleAddNews}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
                  <p className="font-bold text-sm text-gray-600">➕ 新しいお知らせを追加</p>
                  <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)}
                    placeholder="お知らせ内容を入力..." rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  <div className="flex gap-2">
                    <select value={newTarget} onChange={e => setNewTarget(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
                      <option value="全員">全員</option>
                      {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                    </select>
                    <button type="submit"
                      className="bg-yellow-400 hover:bg-yellow-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
                      投稿
                    </button>
                  </div>
                </form>
                {news.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">お知らせはありません</p>
                ) : news.map(n => (
                  <div key={n.id}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-1">
                        対象: <span className="font-bold text-gray-600">{n.target_user}</span>　{n.created_date}
                      </p>
                      <p className="text-sm text-gray-700">{n.message}</p>
                    </div>
                    <button onClick={() => handleDeleteNews(n.id)}
                      className="text-red-400 hover:text-red-600 text-sm flex-shrink-0 transition">🗑️</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── タブ④：タスク管理 ── */}
            {tab === 'tasks' && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-700">📅 タスク管理</h2>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <label className="block text-sm font-bold text-gray-600 mb-2">生徒を選択</label>
                  <select value={taskUser} onChange={e => setTaskUser(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm">
                    {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
                <form onSubmit={handleAddTask}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
                  <p className="font-bold text-sm text-gray-600">➕ タスクを追加</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">大計画（目標）</label>
                      <input value={taskBig} onChange={e => setTaskBig(e.target.value)}
                        placeholder="例: 英検5級合格"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">中計画（教科）</label>
                      <input value={taskMid} onChange={e => setTaskMid(e.target.value)}
                        placeholder="例: 英語・単語"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">タスク名 ※必須</label>
                    <input value={taskName} onChange={e => setTaskName(e.target.value)}
                      placeholder="例: 単語p.10-15を覚える"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">日付</label>
                      <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">種類</label>
                      <select value={taskType} onChange={e => setTaskType(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="lesson">📝 授業</option>
                        <option value="flash">🃏 単語</option>
                        <option value="video">🎬 動画</option>
                        <option value="test">✏️ テスト</option>
                        <option value="reading">📖 読み</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">ページ範囲（任意）</label>
                      <input value={taskPage} onChange={e => setTaskPage(e.target.value)}
                        placeholder="例: P.10-15"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">目標時間（分）</label>
                      <input type="number" min="0" value={taskPlanned} onChange={e => setTaskPlanned(Number(e.target.value))}
                        placeholder="例: 15"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">動画URL（任意）</label>
                      <input value={taskVideo} onChange={e => setTaskVideo(e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                  </div>
                  {taskMsg && <p className="text-green-600 text-sm font-bold">{taskMsg}</p>}
                  <button type="submit" disabled={taskSaving}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm transition disabled:opacity-50">
                    {taskSaving ? '追加中...' : '➕ タスクを追加'}
                  </button>
                </form>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-600">{taskUser} のタスク一覧（{userPlans.length}件）</p>
                  {userPlans.length === 0 ? (
                    <p className="text-center text-gray-400 py-6 text-sm">タスクはありません</p>
                  ) : userPlans
                    .sort((a, b) => String(a.task_date).localeCompare(String(b.task_date)))
                    .map(p => (
                      <div key={p.id}
                        className={"bg-white rounded-xl px-4 py-3 shadow-sm border flex items-center justify-between gap-2 " +
                          (p.is_done === 1 ? 'border-green-200 bg-green-50' : 'border-gray-100')}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={"text-xs px-2 py-0.5 rounded-full font-bold " +
                              (p.is_done === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                              {p.is_done === 1 ? '✅ 完了' : '⬜ 未完了'}
                            </span>
                            <span className="text-xs text-gray-400">{String(p.task_date).slice(0,10)}</span>
                            <span className="text-xs text-gray-500 font-medium">{p.mid_plan}</span>
                          </div>
                          <p className={"text-sm mt-1 " + (p.is_done === 1 ? 'line-through text-gray-400' : 'text-gray-800')}>
                            {p.task_name}
                          </p>
                        </div>
                        <button onClick={() => handleDeleteTask(p.id)}
                          className="text-red-400 hover:text-red-600 flex-shrink-0 transition text-lg">🗑️</button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}