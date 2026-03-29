'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadPlans, updatePlan, saveUserFields, loadUser, todayStr, type PlanRow, type UserRow } from '@/lib/student'

export default function SchedulePage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [user, setUser] = useState<UserRow | null>(null)
  const [todayTasks, setTodayTasks] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)

      const [userData, allPlans] = await Promise.all([
        loadUser(uname),
        loadPlans(),
      ])

      setUser(userData)

      // 今日のタスクを抽出
      const today = todayStr()
      const tasks = allPlans.filter(
        p => p.username === uname && String(p.task_date).slice(0, 10) === today
      )
      setTodayTasks(tasks)
      setLoading(false)
    }
    init()
  }, [router])

  async function toggleTask(task: PlanRow) {
    const newDone = task.is_done === 1 ? 0 : 1
    // 楽観的UI更新
    setTodayTasks(prev =>
      prev.map(t => t.id === task.id ? { ...t, is_done: newDone } : t)
    )
    await updatePlan(task.id, { is_done: newDone })

    // XP加算（完了にした時だけ）
    if (newDone === 1 && user) {
      const newXp = (user.current_points ?? 0) + 10
      await saveUserFields(username, { current_points: newXp })
      setUser(prev => prev ? { ...prev, current_points: newXp } : prev)
      showToast('⚡ +10 XP ゲット！')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-4xl animate-bounce">📅</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  const doneCount = todayTasks.filter(t => t.is_done === 1).length
  const totalCount = todayTasks.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // タスクタイプ別アイコン
  function taskIcon(type: string) {
    switch (type) {
      case 'flash':   return '🃏'
      case 'video':   return '🎬'
      case 'test':    return '✏️'
      case 'reading': return '📖'
      default:        return '📝'
    }
  }

  // 中計画ごとにグループ化
  const grouped = todayTasks.reduce<Record<string, PlanRow[]>>((acc, task) => {
    const key = task.mid_plan || '未分類'
    if (!acc[key]) acc[key] = []
    acc[key].push(task)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* トースト */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50
          bg-yellow-400 text-white font-bold px-6 py-3 rounded-full shadow-lg
          animate-bounce text-sm">
          {toastMsg}
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-5 text-white shadow-md">
        <p className="text-sm opacity-80">{todayStr().replace(/-/g, '/')} の学習</p>
        <h2 className="text-xl font-bold mt-1">📅 今日のタスク</h2>

        {/* 進捗バー */}
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span>{doneCount} / {totalCount} 完了</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
            <div
              className="bg-white h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 全完了メッセージ */}
        {totalCount > 0 && doneCount === totalCount && (
          <div className="mt-3 bg-white/20 rounded-xl p-2 text-center text-sm font-bold">
            🎉 今日のタスク全部完了！すごい！
          </div>
        )}
      </div>

      {/* XP表示 */}
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex justify-between items-center">
        <span className="text-sm text-gray-500">現在のXP</span>
        <span className="font-bold text-yellow-500">⚡ {(user?.current_points ?? 0).toLocaleString()} XP</span>
      </div>

      {/* タスクなし */}
      {totalCount === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center space-y-2">
          <div className="text-4xl">🌙</div>
          <p className="font-bold text-gray-600">今日のタスクはありません</p>
          <p className="text-sm text-gray-400">先生がタスクを追加すると<br />ここに表示されます</p>
        </div>
      )}

      {/* タスク一覧（中計画グループ別） */}
      {Object.entries(grouped).map(([midPlan, tasks]) => (
        <div key={midPlan} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* グループヘッダー */}
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2">
            <span className="text-sm font-bold text-gray-600">{midPlan}</span>
          </div>

          {/* タスクリスト */}
          <div className="divide-y divide-gray-50">
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => toggleTask(task)}
                className={`w-full text-left px-4 py-4 flex items-start gap-3 transition-colors
                  ${task.is_done === 1 ? 'bg-green-50' : 'hover:bg-gray-50'}`}
              >
                {/* チェックボックス */}
                <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                  ${task.is_done === 1
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300'}`}>
                  {task.is_done === 1 && <span className="text-xs">✓</span>}
                </div>

                {/* タスク内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{taskIcon(task.task_type)}</span>
                    <span className={`font-medium text-sm ${task.is_done === 1 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.task_name}
                    </span>
                  </div>
                  {task.page_range && (
                    <p className="text-xs text-gray-400 mt-0.5 ml-7">📄 {task.page_range}</p>
                  )}
                  {task.video_url && task.is_done !== 1 && (
                    <a
                      href={task.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="inline-block mt-1 ml-7 text-xs text-blue-500 underline"
                    >
                      🎬 動画を見る
                    </a>
                  )}
                </div>

                {/* 完了バッジ */}
                {task.is_done === 1 && (
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full flex-shrink-0">
                    完了
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* 単語学習ボタン */}
      <a href="/flash"
        className="block bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl p-4 shadow-md text-center hover:opacity-90 transition">
        <div className="text-2xl mb-1">🃏</div>
        <div className="font-bold">単語学習（フラッシュカード）</div>
        <div className="text-xs opacity-80 mt-1">単語タスクはここから！</div>
      </a>
    </div>
  )
}