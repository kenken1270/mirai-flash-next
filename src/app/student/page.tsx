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
  const [username, setUsername] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.split('@')[0] ?? ''
      setUsername(uname)
      console.log('DEBUG username:', uname, 'email:', session.user.email)
      const u = await loadUser(uname)
      if (u) setUser(u)
      const allPlans = await loadPlans(uname)
      if (allPlans) {
        const today = new Date().toISOString().slice(0, 10)
        const todayTasks = allPlans.filter((p: PlanRow) =>
          p.task_date === today
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFFDF0' }}>
      <div className="text-center">
        <div className="text-7xl mb-4 animate-bounce">🐕</div>
        <p className="font-black text-xl" style={{ color: '#78350F' }}>よみこみちゅう…</p>
      </div>
    </div>
  )

  const { level, current, needed } = xpToLevel(user?.current_points ?? 0)
  const msg = getMascot(tasks, doneTasks)
  const progressPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

  return (
    <div className="min-h-screen pb-24" style={{ background: '#FFFDF0' }}>

      {/* ===== HUDヘッダー：黄色帯は上部のみ ===== */}
      <div className="px-4 pt-10 pb-5" style={{ background: 'linear-gradient(180deg, #FCD34D 0%, #FDE68A 100%)' }}>
        <div className="flex items-start justify-between gap-3 max-w-lg mx-auto">

          {/* 左：柴犬アバター */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-18 h-18 rounded-full bg-white flex items-center justify-center text-5xl border-4 shadow-lg"
              style={{ borderColor: '#F59E0B', width: '72px', height: '72px' }}>
              🐕
            </div>
            <div className="text-white text-xs font-black px-3 py-0.5 rounded-full shadow"
              style={{ background: '#92400E' }}>
              Lv.{level}
            </div>
          </div>

          {/* 中央：名前・メッセージ・XPゲージ */}
          <div className="flex-1 min-w-0">
            <p className="font-black text-lg leading-tight" style={{ color: '#1C1410' }}>
              {user?.nickname || user?.username || username || 'まなびびと'}さん
            </p>
            <p className="text-sm mb-2" style={{ color: '#78350F' }}>{msg}</p>
            <div className="rounded-full h-4 w-full overflow-hidden border" style={{ background: '#FEF3C7', borderColor: '#F59E0B' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(current / needed) * 100}%`,
                  background: 'linear-gradient(90deg, #B45309, #92400E)'
                }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-xs font-bold" style={{ color: '#1C1410' }}>XP {user?.current_points ?? 0}</span>
              <span className="text-xs" style={{ color: '#78350F' }}>あと{needed - current}でLv.{level + 1}</span>
            </div>
          </div>

          {/* 右：ストリーク */}
          <div className="flex flex-col items-center bg-white rounded-2xl px-3 py-2 shadow border flex-shrink-0"
            style={{ borderColor: '#FCD34D' }}>
            <span className="text-2xl">🔥</span>
            <span className="font-black text-lg leading-none" style={{ color: '#1C1410' }}>{user?.streak ?? 0}</span>
            <span className="text-xs" style={{ color: '#78350F' }}>日連続</span>
          </div>
        </div>
      </div>

      {/* ===== 以下は背景クリーム ===== */}
      <div className="max-w-lg mx-auto px-4 mt-4 space-y-3">

        {/* 今日の進捗カード */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: '#FDE68A' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-black text-base" style={{ color: '#1C1410' }}>📋 今日のタスク</span>
            <span className="font-bold text-sm" style={{ color: '#78350F' }}>{doneTasks}/{tasks.length}こ</span>
          </div>
          <div className="rounded-full h-5 overflow-hidden" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #FCD34D, #F59E0B)',
                minWidth: progressPct > 0 ? '1.5rem' : '0'
              }}
            />
          </div>
          <button
            onClick={() => router.push('/student/today')}
            className="mt-3 w-full py-3 rounded-xl font-black text-base shadow-sm transition-all active:scale-95"
            style={{ background: '#FCD34D', color: '#1C1410', border: '2px solid #F59E0B' }}
          >
            {doneTasks === tasks.length && tasks.length > 0 ? '✅ ぜんぶおわった！' : '▶ つづきをやる'}
          </button>
        </div>

        {/* メニューグリッド */}
        <div className="grid grid-cols-4 gap-2">
          {MENU_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className="bg-white rounded-2xl py-3 flex flex-col items-center gap-1 shadow-sm transition-all active:scale-95"
              style={{ border: '2px solid #FDE68A', borderBottom: '4px solid #F59E0B' }}
            >
              <span className="text-3xl">{item.emoji}</span>
              <span className="font-black text-xs" style={{ color: '#78350F' }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* お知らせ */}
        {news && (
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border" style={{ borderColor: '#FDE68A' }}>
            <p className="text-xs font-bold mb-0.5" style={{ color: '#F59E0B' }}>📢 お知らせ</p>
            <p className="text-sm" style={{ color: '#1C1410' }}>{news}</p>
          </div>
        )}

      </div>
    </div>
  )
}
