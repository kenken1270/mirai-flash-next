'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, updatePlan, saveUserFields, type PlanRow, type UserRow } from '@/lib/student'
import { getGradeMode, GRADE_CONFIG } from '@/lib/grade'

export default function DoPage() {
  const router  = useRouter()
  const params  = useParams()
  const taskId  = parseInt(params.taskId as string)

  const [user, setUser]       = useState<UserRow | null>(null)
  const [task, setTask]       = useState<PlanRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [username, setUsername] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)
      const [userData, { data: taskData }] = await Promise.all([
        loadUser(uname),
        supabase.from('plans').select('*').eq('id', taskId).single()
      ])
      setUser(userData)
      if (taskData) {
        setTask(taskData as PlanRow)
        const initSec = (taskData.actual_minutes ?? 0) * 60
        setElapsed(initSec)
      }
      // ステータス更新
      await saveUserFields(uname, { current_status: 'doing', status_updated_at: new Date().toISOString() })
      setLoading(false)
    }
    init()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [router, taskId])

  function startTimer() {
    if (running) return
    setRunning(true)
    intervalRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
  }

  async function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    const minutes = Math.round(elapsed / 60)
    await updatePlan(taskId, { actual_minutes: minutes })
  }

  async function handleComplete() {
    await stopTimer()
    const minutes = Math.round(elapsed / 60)
    await updatePlan(taskId, { actual_minutes: minutes, is_done: 1 })
    await saveUserFields(username, { current_status: 'waiting_check', status_updated_at: new Date().toISOString() })
    router.push(`/student/check?task_id=${taskId}`)
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-4xl animate-bounce">📖</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  const mode    = getGradeMode(user?.grade_num)
  const config  = GRADE_CONFIG[mode]
  const planned = task?.planned_minutes ?? 0
  const pct     = planned > 0 ? Math.min(100, Math.round((elapsed / 60 / planned) * 100)) : 0
  const isDark  = mode === 'high'

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

      {/* 左側：コンテンツエリア（7割） */}
      <div className="flex-1 md:w-[70%] p-4 flex flex-col gap-4">
        <div className={`rounded-2xl p-4 shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-800'}`}>
            📖 {task?.task_name}
          </h2>
          {task?.page_range && (
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              📄 {task.page_range}
            </p>
          )}
        </div>

        {/* 動画エリア */}
        {task?.video_url ? (
          <div className="flex-1 rounded-2xl overflow-hidden shadow-lg bg-black min-h-48">
            <iframe
              src={task.video_url.replace('watch?v=', 'embed/')}
              className="w-full h-full min-h-64 md:min-h-96"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        ) : (
          <div className={`flex-1 rounded-2xl flex flex-col items-center justify-center gap-3 min-h-48 border-2 border-dashed
            ${isDark ? 'border-gray-700 text-gray-600' : 'border-gray-200 text-gray-400'}`}>
            <span className="text-5xl">📝</span>
            <p className="font-bold">教材・問題集で学習中</p>
            {task?.page_range && <p className="text-sm">{task.page_range}</p>}
          </div>
        )}
      </div>

      {/* 右側：ナビゲーションエリア（3割） */}
      <div className={`md:w-[30%] p-4 flex flex-col gap-3 border-l ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}`}>

        {/* タイマー */}
        <div className={`rounded-2xl p-4 text-center shadow-sm ${isDark ? 'bg-gray-800' : 'bg-gradient-to-b from-indigo-50 to-purple-50'}`}>
          <p className={`text-xs font-bold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>⏱️ 学習時間</p>
          <p className={`text-5xl font-mono font-black mb-2 ${running ? (isDark ? 'text-green-400' : 'text-indigo-600') : (isDark ? 'text-gray-400' : 'text-gray-400')}`}>
            {formatTime(elapsed)}
          </p>
          {planned > 0 && (
            <>
              <div className={`w-full rounded-full h-2 mb-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-indigo-400'}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                目標 {planned}分 ({pct}%)
              </p>
            </>
          )}
          <div className="flex gap-2 mt-3">
            {!running ? (
              <button onClick={startTimer}
                className="flex-1 bg-indigo-500 text-white py-2 rounded-xl font-bold text-sm">
                ▶ 開始
              </button>
            ) : (
              <button onClick={stopTimer}
                className="flex-1 bg-orange-500 text-white py-2 rounded-xl font-bold text-sm">
                ⏸ 停止
              </button>
            )}
          </div>
        </div>

        {/* 完了ボタン */}
        <button onClick={handleComplete}
          className={`w-full py-4 rounded-2xl font-bold text-lg shadow-md transition
            ${mode === 'low'
              ? 'bg-yellow-400 text-white'
              : 'bg-gradient-to-r from-green-500 to-teal-500 text-white hover:opacity-90'}`}>
          {mode === 'low' ? 'おわった！✋' : '学習完了 →\n先生チェックへ'}
        </button>

        {/* ミニタスクリスト */}
        <div className={`rounded-2xl p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <p className={`text-xs font-bold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>📋 今日のタスク</p>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            このタスクを完了後、次のタスクへ進みます
          </p>
        </div>

        <button onClick={() => { stopTimer(); router.back() }}
          className={`text-sm text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          ← もどる
        </button>
      </div>
    </div>
  )
}