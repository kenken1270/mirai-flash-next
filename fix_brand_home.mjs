import { writeFileSync } from 'fs';

const page = `'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans } from '@/lib/student'
import type { UserRow, PlanRow } from '@/lib/student'

const MENU_ITEMS = [
  { id: 'today',    label: '今日のタスク', emoji: '📚', href: '/student/today',    bg: 'bg-amber-400' },
  { id: 'plan',     label: '計画',         emoji: '🗺️',  href: '/student/plan',     bg: 'bg-amber-400' },
  { id: 'calendar', label: 'カレンダー',   emoji: '📅', href: '/student/calendar', bg: 'bg-amber-400' },
  { id: 'test',     label: 'テスト',       emoji: '✏️',  href: '/student/test',     bg: 'bg-amber-400' },
  { id: 'gacha',    label: 'ガチャ',       emoji: '🎰', href: '/student/gacha',    bg: 'bg-amber-500' },
  { id: 'flash',    label: 'フラッシュ',   emoji: '⚡', href: '/student/flash',    bg: 'bg-amber-400' },
  { id: 'help',     label: '先生に聞く',   emoji: '🐕', href: '/student/help',     bg: 'bg-amber-400' },
  { id: 'break',    label: 'ひと休み',     emoji: '☕', href: '/student/break',    bg: 'bg-amber-300' },
]

function xpToLevel(xp: number) {
  const level = Math.floor(xp / 100) + 1
  const current = xp % 100
  return { level, current, needed: 100 }
}

function getMascot(tasks: PlanRow[], done: number) {
  if (tasks.length === 0) return { msg: 'きょうはおやすみ？のんびりしよ〜' }
  if (done === tasks.length) return { msg: 'ぜんぶできた！！すごすぎる！！🎉' }
  if (done === 0) return { msg: 'さあはじめよう！いっしょにがんばる！' }
  return { msg: \`もう\${done}こできた！あとちょっと！\` }
}

export default function StudentHome() {
  const router = useRouter()
  const [user, setUser] = useState<UserRow | null>(null)
  const [tasks, setTasks] = useState<PlanRow[]>([])
  const [doneTasks, setDoneTasks] = useState(0)
  const [news, setNews] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const u = await loadUser(session.user.id)
      if (u) setUser(u)

      const allPlans = await loadPlans(session.user.id)
      if (allPlans) {
        const today = new Date().toISOString().slice(0, 10)
        const todayTasks = allPlans.filter((p: PlanRow) =>
          p.scheduled_date === today || (!p.scheduled_date && !p.is_done)
        )
        setTasks(todayTasks)
        setDoneTasks(todayTasks.filter((p: PlanRow) => p.is_done).length)
      }

      const { data: newsData } = await supabase
        .from('news')
        .select('message')
        .order('created_date', { ascending: false })
        .limit(1)
        .single()
      if (newsData) setNews(newsData.message)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🐕</div>
        <p className="text-amber-700 font-bold text-lg">よみこみちゅう…</p>
      </div>
    </div>
  )

  const { level, current, needed } = xpToLevel(user?.current_points ?? 0)
  const mascot = getMascot(tasks, doneTasks)
  const progressPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

  return (
    <div className="min-h-screen bg-amber-50 pb-24">

      {/* ヘッダー */}
      <div className="bg-amber-400 px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-amber-200 rounded-full flex items-center justify-center text-4xl border-4 border-amber-600 shadow-lg">
              🐕
            </div>
            <div className="flex-1">
              <p className="text-amber-900 text-sm font-bold">
                {user?.nickname ?? user?.username ?? 'まなびびと'}さん
              </p>
              <p className="text-amber-800 text-xs mt-0.5 font-medium">{mascot.msg}</p>
            </div>
            <div className="text-right">
              <div className="bg-amber-700 text-white text-xs font-black px-3 py-1 rounded-full">
                Lv.{level}
              </div>
              <p className="text-amber-900 text-xs mt-1">🔥 {user?.streak ?? 0}日連続</p>
            </div>
          </div>

          {/* XPゲージ */}
          <div className="bg-amber-200 rounded-full h-3 w-full overflow-hidden">
            <div
              className="h-full bg-amber-700 rounded-full transition-all duration-700"
              style={{ width: \`\${(current / needed) * 100}%\` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-amber-900 text-xs font-bold">XP {user?.current_points ?? 0}</p>
            <p className="text-amber-800 text-xs">あと{needed - current}でLv.{level + 1}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">

        {/* 今日の進捗カード */}
        <div className="bg-white rounded-2xl p-4 shadow border border-amber-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-amber-800 font-black text-lg">📋 今日のタスク</h2>
            <span className="text-amber-600 font-bold text-sm">{doneTasks}/{tasks.length}</span>
          </div>
          <div className="bg-amber-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-700"
              style={{ width: \`\${progressPct}%\` }}
            />
          </div>
          <button
            onClick={() => router.push('/student/today')}
            className="mt-3 w-full bg-amber-400 hover:bg-amber-500 text-amber-900 font-black py-3 rounded-xl text-base transition-all active:scale-95 shadow"
          >
            {doneTasks > 0 && doneTasks === tasks.length ? '✅ 全部おわった！' : '▶ つづきをやる'}
          </button>
        </div>

        {/* メニューグリッド */}
        <div className="grid grid-cols-2 gap-3">
          {MENU_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={\`\${item.bg} rounded-2xl p-4 flex flex-col items-center gap-2 shadow active:scale-95 transition-all border-b-4 border-amber-600\`}
            >
              <span className="text-3xl">{item.emoji}</span>
              <span className="text-amber-900 font-black text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        {/* お知らせ */}
        {news && (
          <div className="bg-white rounded-2xl p-4 shadow border border-amber-100">
            <p className="text-amber-600 text-xs font-bold mb-1">📢 お知らせ</p>
            <p className="text-amber-900 text-sm">{news}</p>
          </div>
        )}

      </div>
    </div>
  )
}
`;

writeFileSync('src/app/student/page.tsx', page, 'utf8');
console.log('OK');
