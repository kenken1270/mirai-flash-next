import { writeFileSync } from 'fs';

const code = `'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadNews, loadPlans, saveUserFields, todayStr, type UserRow, type NewsRow, type PlanRow } from '@/lib/student'

// ===== XPレベル計算 =====
function xpToLevel(xp: number) {
  const thresholds = [0,100,250,500,1000,2000,3500,5500,8000,11000,15000]
  const titles = ['🌱 たまご','⭐ ひよこ','📚 がんばり屋','🔥 燃える子','💎 集中力の鬼','🚀 天才の卵','🌟 エキスパート','👑 マスター','🏆 レジェンド','✨ 賢者','🎯 覚醒者']
  let level = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i
  }
  const nextXp = thresholds[level + 1] ?? thresholds[thresholds.length - 1]
  const prevXp = thresholds[level]
  const progress = nextXp > prevXp ? Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100) : 100
  return { level: level + 1, title: titles[level], nextXp, prevXp, progress }
}

// ===== マスコット状態 =====
function getMascot(streak: number, todayDone: number, todayTotal: number) {
  if (todayTotal > 0 && todayDone === todayTotal) return { face: '😸', msg: 'すごい！今日のタスク全部クリア！', color: 'from-green-400 to-emerald-500' }
  if (todayDone > 0) return { face: '😺', msg: 'いい調子！続けよう！', color: 'from-blue-400 to-indigo-500' }
  if (streak >= 7) return { face: '😻', msg: streak + '日連続！伝説の勉強家！', color: 'from-purple-400 to-pink-500' }
  if (streak >= 3) return { face: '🐱', msg: streak + '日連続中！この調子！', color: 'from-yellow-400 to-orange-500' }
  return { face: '😿', msg: '今日もいっしょに頑張ろう！', color: 'from-orange-400 to-red-400' }
}

const MENU_ITEMS = [
  { path: '/student/today',    icon: '📅', label: '今日のタスク',  color: 'from-orange-400 to-yellow-400',  shadow: 'shadow-orange-200' },
  { path: '/student/plan',     icon: '📋', label: '計画・目標',    color: 'from-green-400 to-emerald-400',  shadow: 'shadow-green-200' },
  { path: '/student/calendar', icon: '🗓', label: 'カレンダー',    color: 'from-blue-400 to-indigo-400',    shadow: 'shadow-blue-200' },
  { path: '/student/test',     icon: '📝', label: 'テスト',        color: 'from-purple-400 to-violet-400',  shadow: 'shadow-purple-200' },
  { path: '/student/gacha',    icon: '🎰', label: 'ガチャ',        color: 'from-pink-400 to-rose-400',      shadow: 'shadow-pink-200' },
  { path: '/flash',            icon: '⚡', label: 'フラッシュ',    color: 'from-yellow-400 to-amber-400',   shadow: 'shadow-yellow-200' },
]

export default function StudentHome() {
  const router = useRouter()
  const [user, setUser]   = useState<UserRow | null>(null)
  const [news, setNews]   = useState<NewsRow[]>([])
  const [tasks, setTasks] = useState<PlanRow[]>([])
  const [weekData, setWeekData] = useState<{date:string,done:number,total:number}[]>([])
  const [loading, setLoading] = useState(true)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [gachaTickets, setGachaTickets] = useState(0)

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
        const newLevel = xpToLevel(userData.current_points ?? 0).level
        if (newLevel > prevLevel) { setShowLevelUp(true); setConfetti(true) }

        // ガチャ券計算（ストリーク3日ごとに1枚）
        setGachaTickets(Math.floor(newStreak / 3))

        setUser(userData)
        const allPlans = await loadPlans(username)
        setTasks(allPlans.filter(p => p.task_date === today))

        // 週間グラフ
        const week = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
          const dp = allPlans.filter(p => p.task_date === d)
          week.push({ date: d, done: dp.filter(t => t.is_done === 1).length, total: dp.length })
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gradient-to-b from-yellow-50 to-white">
      <div className="text-7xl animate-bounce">😺</div>
      <p className="text-gray-400 font-bold">よみこみちゅう...</p>
    </div>
  )

  if (!user) return <div className="p-4 text-red-500">ログインしてください</div>

  const xp = user.current_points ?? 0
  const { level, title, nextXp, prevXp, progress } = xpToLevel(xp)
  const streak = user.streak ?? 0
  const todayDone  = tasks.filter(t => t.is_done === 1).length
  const todayTotal = tasks.length
  const todayPct   = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0
  const xpToNext   = nextXp - xp
  const mascot     = getMascot(streak, todayDone, todayTotal)
  const maxWeek    = Math.max(...weekData.map(d => d.total), 1)

  // ガチャまであと何XP（100XPごとにガチャ1回）
  const xpForGacha = 100 - (xp % 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white pb-24">

      {/* コンフェッティ */}
      {confetti && (
        <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
          {[...Array(20)].map((_,i) => (
            <div key={i}
              className="absolute animate-bounce text-2xl"
              style={{
                left: Math.random()*100+'%',
                top: Math.random()*100+'%',
                animationDelay: Math.random()*2+'s',
                animationDuration: (1+Math.random()*2)+'s'
              }}
            >
              {['🌟','⭐','✨','🎉','🎊'][i%5]}
            </div>
          ))}
        </div>
      )}

      {/* レベルアップモーダル */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
          onClick={() => { setShowLevelUp(false); setConfetti(false) }}>
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl w-full max-w-sm">
            <div className="text-7xl mb-3 animate-bounce">🎉</div>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-1">LEVEL UP!</p>
            <h2 className="text-3xl font-bold text-yellow-500">Lv.{level}</h2>
            <p className="text-2xl font-bold mt-1">{title}</p>
            <div className="mt-4 bg-yellow-50 rounded-2xl p-3 text-sm text-yellow-700 font-bold">
              新しい称号を獲得！
            </div>
            <button onClick={() => { setShowLevelUp(false); setConfetti(false) }}
              className="mt-4 w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-2xl font-bold text-lg shadow-lg">
              やった！ 🎊
            </button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ===== マスコットカード ===== */}
        <div className={\`bg-gradient-to-r \${mascot.color} rounded-3xl p-5 shadow-lg text-white\`}>
          <div className="flex items-center gap-4">
            <div className="text-6xl animate-pulse">{mascot.face}</div>
            <div className="flex-1">
              <p className="text-sm opacity-80">おかえり！</p>
              <h2 className="text-xl font-bold">{user.username} さん</h2>
              <p className="text-sm mt-1 font-bold opacity-90">{mascot.msg}</p>
            </div>
            <div className="text-center bg-white/20 rounded-2xl px-3 py-2">
              <div className="text-3xl font-bold">{streak}</div>
              <div className="text-xs">日連続🔥</div>
            </div>
          </div>

          {/* Zeigarnik: ストリーク目標 */}
          <div className="mt-3 flex gap-2">
            {[3,7,14,30].map(goal => (
              <div key={goal}
                className={\`flex-1 rounded-xl py-1.5 text-center text-xs font-bold \${streak >= goal ? 'bg-white text-orange-500' : 'bg-white/20 text-white/70'}\`}>
                {streak >= goal ? '✅' : ''}{goal}日
              </div>
            ))}
          </div>
        </div>

        {/* ===== XPゲージ ===== */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{title.split(' ')[0]}</span>
              <div>
                <span className="font-bold text-gray-800">{title.split(' ').slice(1).join(' ')}</span>
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-600 font-bold px-2 py-0.5 rounded-full">Lv.{level}</span>
              </div>
            </div>
            <span className="text-yellow-500 font-bold text-sm">⭐ {xp.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 h-4 rounded-full transition-all duration-700 relative"
              style={{ width: progress + '%' }}
            >
              <div className="absolute right-1 top-0 h-full flex items-center">
                <div className="w-2 h-2 bg-white rounded-full opacity-80" />
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-300">{prevXp.toLocaleString()} XP</p>
            <p className="text-xs text-orange-500 font-bold">あと {xpToNext} XP で Lv.{level+1}！💪</p>
          </div>

          {/* ガチャまでのXP（Zeigarnik） */}
          <div className="mt-2 bg-pink-50 rounded-xl p-2 flex items-center justify-between">
            <span className="text-xs font-bold text-pink-500">🎰 ガチャまで あと {xpForGacha} XP！</span>
            <div className="flex gap-1">
              {[...Array(Math.min(gachaTickets, 5))].map((_,i) => (
                <span key={i} className="text-sm">🎫</span>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 今日の進捗（大きく） ===== */}
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 cursor-pointer active:scale-95 transition-transform"
          onClick={() => router.push('/student/today')}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">📅 今日のタスク</h3>
            <span className={\`text-sm font-bold px-3 py-1 rounded-full \${todayPct === 100 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}\`}>
              {todayDone}/{todayTotal}
            </span>
          </div>
          {todayTotal === 0 ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-400">タップして今日のタスクを確認 →</p>
            </div>
          ) : (
            <>
              <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className={\`h-5 rounded-full transition-all duration-700 \${todayPct === 100 ? 'bg-gradient-to-r from-green-400 to-emerald-400' : 'bg-gradient-to-r from-orange-400 to-yellow-300'}\`}
                  style={{ width: todayPct + '%' }}
                />
              </div>
              <p className={\`text-xs font-bold mt-1 \${todayPct === 100 ? 'text-green-500' : 'text-orange-400'}\`}>
                {todayPct === 100 ? '🎉 全部クリア！すごい！' : \`あと \${todayTotal - todayDone} タスクでクリア！→\`}
              </p>
            </>
          )}
        </div>

        {/* ===== 週間グラフ ===== */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">📊 今週の記録</h3>
            <span className="text-xs text-gray-400">完了タスク数</span>
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {weekData.map((d, i) => {
              const isToday = i === 6
              const dayLabel = ['日','月','火','水','木','金','土'][new Date(d.date).getDay()]
              const barH = d.total > 0 ? Math.max(6, Math.round((d.done / maxWeek) * 56)) : 4
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: '56px' }}>
                    <div
                      className={\`w-full rounded-t-lg transition-all \${isToday ? 'bg-gradient-to-t from-orange-500 to-yellow-400' : d.done > 0 ? 'bg-gradient-to-t from-orange-300 to-yellow-200' : 'bg-gray-100'}\`}
                      style={{ height: barH + 'px' }}
                    />
                  </div>
                  <span className={\`text-xs \${isToday ? 'font-bold text-orange-500' : 'text-gray-300'}\`}>{dayLabel}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ===== お知らせ ===== */}
        {news.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-bold text-gray-700">📢 お知らせ</h3>
            {news.map(n => (
              <div key={n.id} className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-gray-700">
                🔔 {n.message}
              </div>
            ))}
          </div>
        )}

        {/* ===== メニューグリッド（カラフル） ===== */}
        <div>
          <h3 className="font-bold text-gray-700 mb-3">🎮 なにする？</h3>
          <div className="grid grid-cols-2 gap-3">
            {MENU_ITEMS.map(({ path, icon, label, color, shadow }) => (
              <button key={path} onClick={() => router.push(path)}
                className={\`bg-gradient-to-br \${color} \${shadow} shadow-lg text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform\`}>
                <span className="text-4xl drop-shadow">{icon}</span>
                <span className="font-bold text-sm drop-shadow">{label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
`;

writeFileSync('src/app/student/page.tsx', code, 'utf8');
console.log('OK');
