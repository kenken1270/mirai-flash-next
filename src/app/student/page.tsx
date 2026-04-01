'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans } from '@/lib/student'
import type { UserRow, PlanRow } from '@/lib/student'

const MENU_ITEMS = [
  { id: 'today',    label: '今日',       emoji: '📚', href: '/student/today'    },
  { id: 'plan',     label: '計画',       emoji: '🗺️',  href: '/student/plan'     },
  { id: 'calendar', label: 'カレンダー', emoji: '📅', href: '/student/calendar' },
  { id: 'test',     label: 'テスト',     emoji: '✏️',  href: '/student/test'     },
  { id: 'gacha',    label: 'ガチャ',     emoji: '🎰', href: '/student/gacha'    },
  { id: 'tango',    label: 'たんご',     emoji: '🃏', href: '/student/tango'    },
  { id: 'help',     label: '先生に聞く', emoji: '🐕', href: '/student/help'     },
  { id: 'break',    label: 'ひと休み',   emoji: '☕', href: '/student/break'    },
]

function xpToLevel(xp: number) {
  const level = Math.floor(xp / 100) + 1
  const current = xp % 100
  return { level, current, needed: 100 }
}

function getMascot(tasks: PlanRow[], done: number) {
  if (tasks.length === 0) return 'きょうはおやすみ？のんびりしよ〜'
  if (done === tasks.length) return 'ぜんぶできた！！すごすぎる！！🎉'
  if (done === 0) return 'さあはじめよう！いっしょにがんばる！'
  return `もう${done}こできた！あとちょっと！`
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
      const username = session.user.email?.split('@')[0] ?? ''
      const u = await loadUser(username)
      if (u) setUser(u)
      const allPlans = await loadPlans(username)
      if (allPlans) {
        const today = new Date().toISOString().slice(0, 10)
        const todayTasks = allPlans.filter((p: PlanRow) =>
          p.task_date === today || (!p.task_date && p.is_done === 0)
        )
        setTasks(todayTasks)
        setDoneTasks(todayTasks.filter((p: PlanRow) => p.is_done === 1).length)
      }
      const { data: nd } = await supabase.from('news').select('message').order('created_date', { ascending: false }).limit(1).single()
      if (nd) setNews(nd.message)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-7xl mb-4 animate-bounce">🐕</div>
        <p className="text-yellow-700 font-black text-xl">よみこみちゅう…</p>
      </div>
    </div>
  )

  const { level, current, needed } = xpToLevel(user?.current_points ?? 0)
  const msg = getMascot(tasks, doneTasks)
  const progressPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

  return (
    <div
      className="min-h-screen pb-24 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #FDE047 0%, #FACC15 40%, #FCD34D 100%)' }}
    >
      {/* 背景装飾サークル */}
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-20" style={{ background: '#FBBF24' }} />
      <div className="absolute bottom-[80px] left-[-60px] w-48 h-48 rounded-full opacity-20" style={{ background: '#F59E0B' }} />

      {/* ===== HUDヘッダー ===== */}
      <div className="relative z-10 px-4 pt-10 pb-4">
        <div className="flex items-start justify-between gap-3">

          {/* 左：柴犬アバター */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-5xl border-4 border-yellow-500 shadow-xl">
              🐕
            </div>
            <div className="bg-yellow-600 text-white text-xs font-black px-3 py-0.5 rounded-full shadow">
              Lv.{level}
            </div>
          </div>

          {/* 中央：名前・メッセージ・XPゲージ */}
          <div className="flex-1">
            <p className="text-yellow-950 font-black text-lg leading-tight">
              {user?.nickname ?? user?.username ?? 'まなびびと'}さん
            </p>
            <p className="text-yellow-800 text-sm mb-2">{msg}</p>
            <div className="bg-yellow-200 rounded-full h-4 w-full overflow-hidden border border-yellow-400">
              <div
                className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-1"
                style={{
                  width: `${(current / needed) * 100}%`,
                  background: 'linear-gradient(90deg, #92400E, #B45309)'
                }}
              >
                {current > 20 && <span className="text-white text-xs font-black">{current}</span>}
              </div>
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-yellow-900 text-xs font-bold">XP {user?.current_points ?? 0}</span>
              <span className="text-yellow-800 text-xs">あと{needed - current}でLv.{level + 1}</span>
            </div>
          </div>

          {/* 右：ストリーク */}
          <div className="flex flex-col items-center bg-white rounded-2xl px-3 py-2 shadow-lg border border-yellow-300">
            <span className="text-2xl">🔥</span>
            <span className="text-yellow-900 font-black text-lg leading-none">{user?.streak ?? 0}</span>
            <span className="text-yellow-700 text-xs">日連続</span>
          </div>

        </div>
      </div>

      {/* ===== 今日の進捗バー ===== */}
      <div className="relative z-10 mx-4 mb-3">
        <div className="bg-white rounded-2xl p-3 shadow-lg border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-yellow-900 font-black text-base">📋 今日のタスク</span>
            <span className="text-yellow-700 font-bold text-sm">{doneTasks}/{tasks.length}こ</span>
          </div>
          <div className="bg-yellow-100 rounded-full h-5 overflow-hidden border border-yellow-300">
            <div
              className="h-full rounded-full transition-all duration-700 flex items-center justify-center"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #FBBF24, #F59E0B)',
                minWidth: progressPct > 0 ? '2rem' : '0'
              }}
            >
              {progressPct > 15 && <span className="text-yellow-950 text-xs font-black">{progressPct}%</span>}
            </div>
          </div>
          <button
            onClick={() => router.push('/student/today')}
            className="mt-2 w-full py-2.5 rounded-xl font-black text-base shadow active:scale-95 transition-all text-yellow-950"
            style={{ background: 'linear-gradient(90deg, #FDE047, #FBBF24)' }}
          >
            {doneTasks === tasks.length && tasks.length > 0 ? '✅ ぜんぶおわった！' : '▶ つづきをやる'}
          </button>
        </div>
      </div>

      {/* ===== メニューグリッド（HUD型） ===== */}
      <div className="relative z-10 mx-4 grid grid-cols-4 gap-2">
        {MENU_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className="bg-white rounded-2xl py-3 flex flex-col items-center gap-1 shadow-lg border-b-4 border-yellow-400 active:scale-95 transition-all"
          >
            <span className="text-3xl">{item.emoji}</span>
            <span className="text-yellow-900 font-black text-xs">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ===== お知らせ ===== */}
      {news && (
        <div className="relative z-10 mx-4 mt-3 bg-white rounded-2xl px-4 py-3 shadow border border-yellow-200">
          <p className="text-yellow-600 text-xs font-bold mb-0.5">📢 お知らせ</p>
          <p className="text-yellow-900 text-sm">{news}</p>
        </div>
      )}

    </div>
  )
}
