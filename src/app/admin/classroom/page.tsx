'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type StudentStatus = {
  username: string
  nickname: string
  current_status: string
  status_updated_at: string
  grade_num: number
  current_points: number
}

const STATUS_CONFIG = {
  idle:          { label: '待機中',       color: 'bg-gray-100 border-gray-300',    dot: 'bg-gray-400',   icon: '😴' },
  planning:      { label: '計画中',       color: 'bg-purple-50 border-purple-300', dot: 'bg-purple-400', icon: '📋' },
  doing:         { label: '学習中',       color: 'bg-blue-50 border-blue-300',     dot: 'bg-blue-500',   icon: '📖' },
  waiting_check: { label: 'チェック待ち', color: 'bg-red-50 border-red-400',       dot: 'bg-red-500',    icon: '🙋' },
  seeing:        { label: '振り返り中',   color: 'bg-green-50 border-green-300',   dot: 'bg-green-500',  icon: '🪞' },
}

export default function ClassroomPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentStatus[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<string>('all')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data } = await supabase
        .from('users')
        .select('username, nickname, current_status, status_updated_at, grade_num, current_points')
        .not('username', 'is', null)
        .order('current_status')
      setStudents((data ?? []) as StudentStatus[])
      setLoading(false)
    }
    init()

    const channel = supabase
      .channel('classroom-realtime')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'users',
      }, () => {
        supabase.from('users')
          .select('username, nickname, current_status, status_updated_at, grade_num, current_points')
          .not('username', 'is', null)
          .order('current_status')
          .then(({ data }) => setStudents((data ?? []) as StudentStatus[]))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  async function giveStamp(username: string, taskId?: number) {
    if (!taskId) return
    await supabase.from('plans')
      .update({ teacher_stamp: true, stamp_at: new Date().toISOString() })
      .eq('id', taskId)
    await supabase.from('users')
      .update({ current_status: 'seeing', status_updated_at: new Date().toISOString() })
      .eq('username', username)
  }

  const filtered = filter === 'all'
    ? students
    : students.filter(s => s.current_status === filter)

  const waitingCount = students.filter(s => s.current_status === 'waiting_check').length
  const doingCount   = students.filter(s => s.current_status === 'doing').length

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-4xl animate-bounce">🏫</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">

      <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-2xl p-5 text-white shadow-md">
        <h1 className="text-xl font-bold">🏫 リアルタイム教室マップ</h1>
        <p className="text-sm opacity-70 mt-1">生徒の学習状況をリアルタイムで確認</p>
        <div className="flex gap-4 mt-3">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-black text-red-400">{waitingCount}</p>
            <p className="text-xs opacity-70">チェック待ち</p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-black text-blue-400">{doingCount}</p>
            <p className="text-xs opacity-70">学習中</p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-black text-white">{students.length}</p>
            <p className="text-xs opacity-70">全生徒</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all',           label: '全員' },
          { key: 'waiting_check', label: '🙋 チェック待ち' },
          { key: 'doing',         label: '📖 学習中' },
          { key: 'seeing',        label: '🪞 振り返り中' },
          { key: 'idle',          label: '😴 待機中' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-bold border transition
              ${filter === key ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(student => {
          const statusKey = (student.current_status ?? 'idle') as keyof typeof STATUS_CONFIG
          const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.idle
          const elapsed = student.status_updated_at
            ? Math.round((Date.now() - new Date(student.status_updated_at).getTime()) / 60000)
            : 0

          return (
            <div key={student.username}
              className={`rounded-2xl border-2 p-4 shadow-sm transition-all ${cfg.color}`}>
              <div className="flex items-start justify-between mb-2">
                <div className={`w-3 h-3 rounded-full mt-1 ${cfg.dot} ${statusKey === 'waiting_check' ? 'animate-pulse' : ''}`} />
                <span className="text-lg">{cfg.icon}</span>
              </div>
              <p className="font-bold text-gray-800 text-sm">{student.nickname || student.username}</p>
              <p className="text-xs text-gray-500 mt-0.5">{cfg.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{elapsed}分前から</p>
              <p className="text-xs text-yellow-600 mt-1">⚡ {student.current_points?.toLocaleString() ?? 0} XP</p>

              {statusKey === 'waiting_check' && (
                <button
                  onClick={async () => {
                    const { data } = await supabase
                      .from('plans')
                      .select('id')
                      .eq('username', student.username)
                      .eq('is_done', 1)
                      .is('teacher_stamp', false)
                      .order('id', { ascending: false })
                      .limit(1)
                    if (data && data.length > 0) {
                      await giveStamp(student.username, data[0].id)
                    }
                  }}
                  className="mt-2 w-full bg-red-500 text-white py-1.5 rounded-xl text-xs font-bold hover:bg-red-600 transition animate-pulse">
                  🎖️ スタンプ押す
                </button>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
          <p className="text-4xl mb-2">👀</p>
          <p>該当する生徒はいません</p>
        </div>
      )}
    </div>
  )
}