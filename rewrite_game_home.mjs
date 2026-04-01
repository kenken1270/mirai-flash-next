import { writeFileSync } from 'fs';

// ===== layout.tsx =====
const layout = `'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/student',          label: 'ホーム',     icon: '🏠' },
  { href: '/student/today',    label: '今日',        icon: '📅' },
  { href: '/student/calendar', label: 'カレンダー',  icon: '🗓' },
  { href: '/student/plan',     label: '計画',        icon: '📋' },
  { href: '/student/test',     label: 'テスト',      icon: '📝' },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/student'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ホーム以外のみヘッダー表示 */}
      {!isHome && (
        <header className="bg-yellow-400 shadow-md px-4 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-bold text-gray-800 text-lg">未来塾</span>
          </div>
          <button onClick={handleLogout}
            className="text-sm bg-white text-gray-700 px-3 py-1 rounded-full shadow hover:bg-gray-100 transition">
            🚪 ログアウト
          </button>
        </header>
      )}

      <main className={\`\${isHome ? '' : 'max-w-2xl mx-auto px-4 pt-4 pb-24'}\`}>
        {children}
      </main>

      {/* ホーム以外のみボトムナビ表示 */}
      {!isHome && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="flex justify-around items-center max-w-2xl mx-auto">
            {NAV.map(({ href, label, icon }) => {
              const isActive = pathname === href || (href !== '/student' && pathname.startsWith(href))
              return (
                <Link key={href} href={href}
                  className={\`flex flex-col items-center py-2 px-3 text-xs transition-colors \${isActive ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}\`}>
                  <span className="text-xl mb-0.5">{icon}</span>
                  <span>{label}</span>
                  {isActive && <span className="w-1 h-1 rounded-full bg-yellow-400 mt-0.5" />}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
`;

// ===== page.tsx (ゲームHUD型ホーム) =====
const page = `'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadNews, loadPlans, saveUserFields, todayStr, type UserRow, type NewsRow, type PlanRow } from '@/lib/student'

function xpToLevel(xp: number) {
  const thresholds = [0,100,250,500,1000,2000,3500,5500,8000,11000,15000]
  const titles = ['たまご','ひよこ','がんばり屋','燃える子','集中の鬼','天才の卵','エキスパート','マスター','レジェンド','賢者','覚醒者']
  const emojis = ['🥚','🐣','📚','🔥','💎','🚀','🌟','👑','🏆','✨','🎯']
  let level = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i
  }
  const nextXp = thresholds[level + 1] ?? thresholds[thresholds.length - 1]
  const prevXp = thresholds[level]
  const progress = nextXp > prevXp ? Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100) : 100
  return { level: level + 1, title: titles[level], emoji: emojis[level], nextXp, prevXp, progress }
}

// アバターパーツ定義（EXPで解放）
const AVATAR_PARTS = {
  face: ['😺','😸','😻','🐯','🦁','🐻','🐼','🦊','🐨','🐸'],
  hat:  ['','🎩','👒','⛑️','🎓','👑','🪖','🎪','✨','🌟'],
  bg:   [
    'from-blue-400 to-purple-500',
    'from-green-400 to-teal-500',
    'from-pink-400 to-rose-500',
    'from-yellow-400 to-orange-500',
    'from-indigo-400 to-blue-600',
    'from-emerald-400 to-green-600',
    'from-purple-400 to-pink-600',
    'from-amber-400 to-red-500',
    'from-cyan-400 to-blue-500',
    'from-violet-400 to-purple-600',
  ]
}

function getMascotMsg(streak: number, todayDone: number, todayTotal: number) {
  if (todayTotal > 0 && todayDone === todayTotal) return '今日のタスク全クリア！🎉'
  if (todayDone > 0) return 'いい調子！続けよう！💪'
  if (streak >= 7) return streak + '日連続！伝説！🏆'
  if (streak >= 3) return streak + '日連続中！✨'
  return '今日もいっしょに頑張ろう！'
}

const ACTION_BUTTONS = [
  { path: '/student/today',    icon: '📅', label: '今日のタスク', color: 'bg-orange-500 hover:bg-orange-600',   size: 'large' },
  { path: '/student/help',     icon: '🙋', label: '先生に聞く',   color: 'bg-blue-500 hover:bg-blue-600',       size: 'small' },
  { path: '/student/gacha',    icon: '🎰', label: 'ガチャ',       color: 'bg-pink-500 hover:bg-pink-600',       size: 'small' },
  { path: '/student/plan',     icon: '📋', label: '計画',         color: 'bg-green-500 hover:bg-green-600',     size: 'small' },
  { path: '/student/calendar', icon: '🗓', label: 'カレンダー',   color: 'bg-indigo-500 hover:bg-indigo-600',   size: 'small' },
  { path: '/flash',            icon: '⚡', label: 'フラッシュ',   color: 'bg-yellow-500 hover:bg-yellow-600',   size: 'small' },
  { path: '/student/test',     icon: '📝', label: 'テスト',       color: 'bg-purple-500 hover:bg-purple-600',   size: 'small' },
  { path: '/student/break',    icon: '☕', label: 'ひと休み',     color: 'bg-teal-500 hover:bg-teal-600',       size: 'small' },
]

export default function StudentHome() {
  const router = useRouter()
  const [user, setUser]     = useState<UserRow | null>(null)
  const [tasks, setTasks]   = useState<PlanRow[]>([])
  const [news, setNews]     = useState<NewsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAvatar, setShowAvatar] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [avatarFace, setAvatarFace] = useState(0)
  const [avatarHat,  setAvatarHat]  = useState(0)
  const [avatarBg,   setAvatarBg]   = useState(0)
  const [weekData, setWeekData] = useState<{date:string,done:number}[]>([])

  useEffect(() => {
    // アバター設定をlocalStorageから復元
    const saved = localStorage.getItem('avatar')
    if (saved) {
      const a = JSON.parse(saved)
      setAvatarFace(a.face ?? 0)
      setAvatarHat(a.hat ?? 0)
      setAvatarBg(a.bg ?? 0)
    }
  }, [])

  const saveAvatar = (face: number, hat: number, bg: number) => {
    localStorage.setItem('avatar', JSON.stringify({ face, hat, bg }))
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const username = session.user.email?.replace('@mirai-juku.internal','') ?? session.user.email?.split('@')[0] ?? ''

      let userData = await loadUser(username)
      if (!userData) {
        await supabase.from('users').insert({ username, current_points: 0, streak: 0, last_visit_date: todayStr(), last_login_date: todayStr() })
        userData = await loadUser(username)
      }
      if (userData) {
        const today = todayStr()
        const lastVisit = userData.last_visit_date ?? ''
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const prevLevel = xpToLevel(userData.current_points ?? 0).level
        let newStreak = userData.streak ?? 0
        if (lastVisit !== today) {
          newStreak = lastVisit === yesterday ? newStreak + 1 : 1
          await saveUserFields(username, { last_visit_date: today, streak: newStreak })
          userData.streak = newStreak
        }
        if (xpToLevel(userData.current_points ?? 0).level > prevLevel) setShowLevelUp(true)
        setUser(userData)

        const allPlans = await loadPlans(username)
        setTasks(allPlans.filter(p => p.task_date === today))

        const week = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
          const dp = allPlans.filter(p => p.task_date === d && p.is_done === 1)
          week.push({ date: d, done: dp.length })
        }
        setWeekData(week)
      }
      const newsData = await loadNews()
      setNews(newsData.filter(n => n.target_user === '全員' || n.target_user === (userData?.username ?? '')))
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gradient-to-b from-indigo-900 to-purple-900">
      <div className="text-8xl animate-bounce">😺</div>
      <p className="text-white font-bold text-xl animate-pulse">よみこみちゅう...</p>
    </div>
  )
  if (!user) return <div className="p-4 text-red-500">ログインしてください</div>

  const xp = user.current_points ?? 0
  const { level, title, emoji, nextXp, prevXp, progress } = xpToLevel(xp)
  const streak   = user.streak ?? 0
  const todayDone  = tasks.filter(t => t.is_done === 1).length
  const todayTotal = tasks.length
  const todayPct   = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0
  const xpToNext   = nextXp - xp
  const xpForGacha = 100 - (xp % 100)
  const mascotMsg  = getMascotMsg(streak, todayDone, todayTotal)
  const unlockedFaces = Math.min(Math.floor(xp / 200) + 1, AVATAR_PARTS.face.length)
  const unlockedHats  = Math.min(Math.floor(xp / 300) + 1, AVATAR_PARTS.hat.length)
  const unlockedBgs   = Math.min(Math.floor(xp / 400) + 1, AVATAR_PARTS.bg.length)
  const maxWeek = Math.max(...weekData.map(d => d.done), 1)

  return (
    <div className="relative min-h-screen overflow-hidden select-none" style={{fontFamily: 'sans-serif'}}>

      {/* ===== 背景グラデーション（世界観） ===== */}
      <div className={\`absolute inset-0 bg-gradient-to-br \${AVATAR_PARTS.bg[avatarBg]} opacity-90\`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

      {/* 装飾パーティクル */}
      {[...Array(8)].map((_,i) => (
        <div key={i} className="absolute animate-pulse opacity-30 text-white text-2xl"
          style={{ left: (10 + i*12)+'%', top: (5 + (i%3)*15)+'%', animationDelay: i*0.5+'s' }}>
          {['⭐','✨','💫','🌟','⚡','🎯','💎','🌈'][i]}
        </div>
      ))}

      {/* レベルアップモーダル */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4"
          onClick={() => setShowLevelUp(false)}>
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl w-full max-w-xs">
            <div className="text-7xl mb-2 animate-bounce">{emoji}</div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">LEVEL UP!</p>
            <h2 className="text-4xl font-bold text-yellow-500 my-1">Lv.{level}</h2>
            <p className="text-xl font-bold">{title}</p>
            <p className="text-sm text-gray-400 mt-2">新しいアバターパーツが解放！</p>
            <button onClick={() => setShowLevelUp(false)}
              className="mt-4 w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-2xl font-bold text-lg">
              やった！🎊
            </button>
          </div>
        </div>
      )}

      {/* アバターカスタマイズモーダル */}
      {showAvatar && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4"
          onClick={() => setShowAvatar(false)}>
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-center mb-4">🎨 アバターをかざろう！</h2>

            {/* プレビュー */}
            <div className={\`bg-gradient-to-br \${AVATAR_PARTS.bg[avatarBg]} rounded-2xl p-6 text-center mb-4\`}>
              <div className="text-6xl">{AVATAR_PARTS.hat[avatarHat]}</div>
              <div className="text-7xl">{AVATAR_PARTS.face[avatarFace]}</div>
              <p className="text-white font-bold mt-2">{user.username}</p>
              <p className="text-white/80 text-sm">{emoji} {title} Lv.{level}</p>
            </div>

            {/* 顔 */}
            <div className="mb-3">
              <p className="text-sm font-bold text-gray-500 mb-2">😺 キャラクター（{unlockedFaces}/{AVATAR_PARTS.face.length}解放）</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PARTS.face.map((f, i) => (
                  <button key={i} onClick={() => { if(i < unlockedFaces) { setAvatarFace(i); saveAvatar(i, avatarHat, avatarBg) }}}
                    className={\`text-3xl p-2 rounded-xl transition \${i < unlockedFaces ? (avatarFace === i ? 'bg-yellow-200 scale-110' : 'bg-gray-100 hover:bg-gray-200') : 'opacity-30 bg-gray-50 cursor-not-allowed'}\`}>
                    {i < unlockedFaces ? f : '🔒'}
                  </button>
                ))}
              </div>
            </div>

            {/* 帽子 */}
            <div className="mb-3">
              <p className="text-sm font-bold text-gray-500 mb-2">🎩 帽子（{unlockedHats}/{AVATAR_PARTS.hat.length}解放）</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PARTS.hat.map((h, i) => (
                  <button key={i} onClick={() => { if(i < unlockedHats) { setAvatarHat(i); saveAvatar(avatarFace, i, avatarBg) }}}
                    className={\`text-3xl p-2 rounded-xl transition \${i < unlockedHats ? (avatarHat === i ? 'bg-yellow-200 scale-110' : 'bg-gray-100 hover:bg-gray-200') : 'opacity-30 bg-gray-50 cursor-not-allowed'}\`}>
                    {i < unlockedHats ? (h || '🚫') : '🔒'}
                  </button>
                ))}
              </div>
            </div>

            {/* 背景 */}
            <div className="mb-4">
              <p className="text-sm font-bold text-gray-500 mb-2">🌈 背景（{unlockedBgs}/{AVATAR_PARTS.bg.length}解放）</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PARTS.bg.map((bg, i) => (
                  <button key={i} onClick={() => { if(i < unlockedBgs) { setAvatarBg(i); saveAvatar(avatarFace, avatarHat, i) }}}
                    className={\`w-10 h-10 rounded-xl bg-gradient-to-br \${bg} transition \${i < unlockedBgs ? (avatarBg === i ? 'ring-4 ring-yellow-400 scale-110' : 'hover:scale-105') : 'opacity-30 cursor-not-allowed'}\`}>
                    {i >= unlockedBgs && <span className="flex items-center justify-center h-full text-white text-sm">🔒</span>}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">XPを貯めると新しいパーツが解放されるよ！</p>
            <button onClick={() => setShowAvatar(false)}
              className="mt-3 w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-2xl font-bold">
              決定！✨
            </button>
          </div>
        </div>
      )}

      {/* ===== メインコンテンツ ===== */}
      <div className="relative z-10 min-h-screen flex flex-col p-3 gap-3">

        {/* ===== 上部HUD ===== */}
        <div className="flex items-center justify-between gap-2">

          {/* 左：アバター＋名前（タップでカスタマイズ） */}
          <button onClick={() => setShowAvatar(true)}
            className="flex items-center gap-2 bg-black/30 backdrop-blur rounded-2xl px-3 py-2 active:scale-95 transition">
            <div className="relative">
              <div className="text-3xl leading-none">{AVATAR_PARTS.hat[avatarHat]}</div>
              <div className="text-4xl leading-none -mt-1">{AVATAR_PARTS.face[avatarFace]}</div>
            </div>
            <div className="text-left">
              <p className="text-white/70 text-xs">おかえり！</p>
              <p className="text-white font-bold text-sm">{user.username}</p>
              <p className="text-white/80 text-xs">{emoji} {title}</p>
            </div>
            <span className="text-white/50 text-xs ml-1">✏️</span>
          </button>

          {/* 中央：今日のメッセージ */}
          <div className="flex-1 bg-black/20 backdrop-blur rounded-2xl px-3 py-2 text-center">
            <p className="text-white font-bold text-sm">{mascotMsg}</p>
          </div>

          {/* 右：ストリーク */}
          <div className="bg-black/30 backdrop-blur rounded-2xl px-3 py-2 text-center min-w-[60px]">
            <div className="text-2xl font-bold text-white">{streak}</div>
            <div className="text-white/70 text-xs">日連続🔥</div>
          </div>
        </div>

        {/* ===== 中央エリア（アバター大表示＋今日の進捗） ===== */}
        <div className="flex gap-3 flex-1">

          {/* 左：アバター大表示＋XP */}
          <div className="flex flex-col items-center gap-2 w-32">
            <div className="bg-black/20 backdrop-blur rounded-3xl p-4 flex flex-col items-center">
              <div className="text-4xl leading-none">{AVATAR_PARTS.hat[avatarHat]}</div>
              <div className="text-7xl leading-none">{AVATAR_PARTS.face[avatarFace]}</div>
              <div className="text-white font-bold text-xs mt-1">Lv.{level}</div>
            </div>

            {/* XPバー縦 */}
            <div className="bg-black/20 backdrop-blur rounded-2xl p-2 w-full">
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>XP</span>
                <span>{xp}</span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-3">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 h-3 rounded-full transition-all"
                  style={{ width: progress + '%' }} />
              </div>
              <p className="text-white/60 text-xs mt-1 text-center">あと{xpToNext}でLv.{level+1}</p>
            </div>

            {/* ガチャカウンター */}
            <button onClick={() => router.push('/student/gacha')}
              className="bg-pink-500/80 backdrop-blur rounded-2xl p-2 w-full text-center active:scale-95 transition">
              <div className="text-2xl">🎰</div>
              <p className="text-white text-xs font-bold">ガチャ</p>
              <p className="text-pink-200 text-xs">あと{xpForGacha}XP</p>
            </button>
          </div>

          {/* 右：メインアクションボタン群 */}
          <div className="flex-1 flex flex-col gap-2">

            {/* 今日のタスク（大きく） */}
            <button onClick={() => router.push('/student/today')}
              className="bg-orange-500/90 backdrop-blur rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition shadow-lg">
              <span className="text-4xl">📅</span>
              <div className="flex-1 text-left">
                <p className="text-white font-bold">今日のタスク</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-white/30 rounded-full h-2">
                    <div className="bg-white h-2 rounded-full transition-all"
                      style={{ width: todayPct + '%' }} />
                  </div>
                  <span className="text-white/90 text-xs font-bold">{todayDone}/{todayTotal}</span>
                </div>
                <p className="text-orange-200 text-xs mt-0.5">
                  {todayPct === 100 ? '🎉 全クリア！' : \`あと\${todayTotal - todayDone}タスク\`}
                </p>
              </div>
              <span className="text-white text-2xl">→</span>
            </button>

            {/* 小ボタン2列グリッド */}
            <div className="grid grid-cols-3 gap-2 flex-1">
              {ACTION_BUTTONS.filter(b => b.path !== '/student/today').map(({ path, icon, label, color }) => (
                <button key={path} onClick={() => router.push(path)}
                  className={\`\${color} backdrop-blur rounded-xl flex flex-col items-center justify-center gap-1 p-2 active:scale-95 transition shadow text-white\`}>
                  <span className="text-2xl">{icon}</span>
                  <span className="text-xs font-bold leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 下部HUD（週間グラフ＋お知らせ） ===== */}
        <div className="flex gap-3">

          {/* 週間グラフ */}
          <div className="flex-1 bg-black/20 backdrop-blur rounded-2xl px-3 py-2">
            <p className="text-white/70 text-xs mb-1">今週の記録📊</p>
            <div className="flex items-end gap-1 h-8">
              {weekData.map((d, i) => {
                const isToday = i === 6
                const barH = d.done > 0 ? Math.max(4, Math.round((d.done / maxWeek) * 28)) : 2
                const day = ['日','月','火','水','木','金','土'][new Date(d.date).getDay()]
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className={\`w-full rounded-t transition \${isToday ? 'bg-yellow-400' : d.done > 0 ? 'bg-white/60' : 'bg-white/20'}\`}
                      style={{ height: barH + 'px' }} />
                    <span className={\`text-xs \${isToday ? 'text-yellow-300 font-bold' : 'text-white/40'}\`}>{day}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* お知らせ（あれば） */}
          {news.length > 0 && (
            <div className="flex-1 bg-black/20 backdrop-blur rounded-2xl px-3 py-2">
              <p className="text-white/70 text-xs mb-1">📢 お知らせ</p>
              <p className="text-white text-xs line-clamp-2">{news[0].message}</p>
            </div>
          )}

          {/* ログアウト */}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="bg-black/20 backdrop-blur rounded-2xl px-3 py-2 text-white/60 text-xs flex flex-col items-center justify-center gap-1">
            <span>🚪</span>
            <span>ログアウト</span>
          </button>
        </div>

      </div>
    </div>
  )
}
`;

writeFileSync('src/app/student/layout.tsx', layout, 'utf8');
writeFileSync('src/app/student/page.tsx', page, 'utf8');
console.log('OK');
