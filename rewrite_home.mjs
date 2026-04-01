import { writeFileSync } from 'fs';

const code = `'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadNews, loadPlans, saveUserFields, todayStr, type UserRow, type NewsRow, type PlanRow } from '@/lib/student'

function xpToLevel(xp: number) {
  const thresholds = [0,100,250,500,1000,2000,3500,5500,8000,11000,15000]
  const titles = ['🌱 はじめの一歩','⭐ 努力の人','📚 学びの芽','🔥 集中の炎','💎 知識の宝','🚀 飛躍者','🌟 エキスパート','👑 マスター','🏆 レジェンド','✨ 賢者','🎯 覚醒']
  let level = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i
  }
  const nextXp = thresholds[level + 1] ?? thresholds[thresholds.length - 1]
  const prevXp = thresholds[level]
  const progress = nextXp > prevXp ? Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100) : 100
  return { level: level + 1, title: titles[level], nextXp, prevXp, progress }
}

const MENU_ITEMS = [
  { path: '/student/today',    icon: '📅', label: '今日のタスク',  bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700' },
  { path: '/student/plan',     icon: '📋', label: '計画・目標',    bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-700' },
  { path: '/student/calendar', icon: '🗓', label: 'カレンダー',    bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-700' },
  { path: '/student/test',     icon: '📝', label: 'テスト',        bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-700' },
  { path: '/student/gacha',    icon: '🎰', label: 'ガチャ',        bg: 'bg-pink-50',    border: 'border-pink-200',   text: 'text-pink-700' },
  { path: '/flash',            icon: '⚡', label: 'フラッシュ',    bg: 'bg-yellow-50',  border: 'border-yellow-200', text: 'text-yellow-700' },
]

export default function StudentHome() {
  const router = useRouter()
  const [user, setUser]   = useState<UserRow | null>(null)
  const [news, setNews]   = useState<NewsRow[]>([])
  const [tasks, setTasks] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [weekData, setWeekData] = useState<{date:string,done:number,total:number}[]>([])
  const [showLevelUp, setShowLevelUp] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const username = session.user.email?.replace('@mirai-juku.internal','') ?? session.user.email?.split('@')[0] ?? ''

      let userData = await loadUser(username)
      if (!userData) {
        await supabase.from('users').insert({
          username, current_points: 0, streak: 0,
          last_visit_date: todayStr(), last_login_date: todayStr(),
        })
        userData = await loadUser(username)
      }
      if (userData) {
        const today = todayStr()
        const lastVisit = userData.last_visit_date ?? ''
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        let newStreak = userData.streak ?? 0
        const prevLevel = xpToLevel(userData.current_points ?? 0).level
        if (lastVisit !== today) {
          newStreak = lastVisit === yesterday ? newStreak + 1 : 1
          await saveUserFields(username, { last_visit_date: today, streak: newStreak })
          userData.streak = newStreak
          userData.last_visit_date = today
        }
        const newLevel = xpToLevel(userData.current_points ?? 0).level
        if (newLevel > prevLevel) setShowLevelUp(true)
        setUser(userData)

        // 今日のタスク取得
        const allPlans = await loadPlans(username)
        const todayTasks = allPlans.filter(p => p.task_date === today)
        setTasks(todayTasks)

        // 週間データ生成
        const week = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
          const dayTasks = allPlans.filter(p => p.task_date === d)
          week.push({ date: d, done: dayTasks.filter(t => t.is_done === 1).length, total: dayTasks.length })
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
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-4xl animate-bounce">📚</div>
      <p className="text-gray-500">読み込み中...</p>
    </div>
  )

  if (!user) return (
    <div className="p-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        ユーザーデータが取得できませんでした。ログインしてください。
      </div>
    </div>
  )

  const xp = user.current_points ?? 0
  const { level, title, nextXp, prevXp, progress } = xpToLevel(xp)
  const streak = user.streak ?? 0
  const todayDone  = tasks.filter(t => t.is_done === 1).length
  const todayTotal = tasks.length
  const todayPct   = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0
  const maxWeek    = Math.max(...weekData.map(d => d.total), 1)

  // Zeigarnik: あと何XPでレベルアップか
  const xpToNext = nextXp - xp
  const urgentStreak = streak > 0 && streak < 7

  return (
    <div className="space-y-4 pb-4">

      {/* レベルアップ演出 */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowLevelUp(false)}>
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl mx-4">
            <div className="text-6xl mb-3 animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-yellow-500">レベルアップ！</h2>
            <p className="text-4xl font-bold mt-2">{title}</p>
            <p className="text-gray-400 text-sm mt-2">Lv.{level} になったよ！</p>
            <button onClick={() => setShowLevelUp(false)}
              className="mt-4 px-6 py-2 bg-yellow-400 text-white rounded-xl font-bold">
              やった！
            </button>
          </div>
        </div>
      )}

      {/* ウェルカムカード */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-5 shadow-md text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">おかえり！</p>
            <h2 className="text-2xl font-bold">{user.username} さん 👋</h2>
          </div>
          <div className="text-right bg-white/20 rounded-xl px-3 py-2">
            <div className="text-3xl font-bold">{streak}</div>
            <div className="text-xs opacity-90">日連続🔥</div>
          </div>
        </div>
        {/* ストリーク警告（Zeigarnik） */}
        {urgentStreak && (
          <div className="mt-3 bg-white/20 rounded-xl px-3 py-2 text-xs font-bold">
            🎯 7日連続まであと {7 - streak} 日！今日もやってみよう！
          </div>
        )}
        {streak >= 7 && (
          <div className="mt-3 bg-white/20 rounded-xl px-3 py-2 text-xs font-bold">
            🏆 {streak}日連続達成中！この調子！
          </div>
        )}
      </div>

      {/* XPゲージ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-lg font-bold text-gray-800">{title}</span>
            <span className="ml-2 text-sm text-gray-400">Lv.{level}</span>
          </div>
          <span className="text-yellow-500 font-bold">⭐ {xp.toLocaleString()} XP</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 h-3 rounded-full transition-all duration-700"
            style={{ width: progress + '%' }} />
        </div>
        <div className="flex justify-between mt-1">
          <p className="text-xs text-gray-300">{prevXp.toLocaleString()} XP</p>
          {/* Zeigarnik効果: あとXXXで次のレベル */}
          <p className="text-xs text-orange-400 font-bold">あと {xpToNext.toLocaleString()} XP で Lv.{level+1}！</p>
        </div>
      </div>

      {/* 今日の進捗カード */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer"
        onClick={() => router.push('/student/today')}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-700">📅 今日のタスク</h3>
          <span className="text-xs text-orange-500 font-bold">{todayDone}/{todayTotal} 完了</span>
        </div>
        {todayTotal === 0 ? (
          <p className="text-sm text-gray-400">今日のタスクをタップして確認しよう →</p>
        ) : todayPct === 100 ? (
          <div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-green-400 to-emerald-400 h-3 rounded-full" style={{ width: '100%' }} />
            </div>
            <p className="text-xs text-green-500 font-bold mt-1 text-center">🎉 今日のタスク全完了！すごい！</p>
          </div>
        ) : (
          <div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-400 to-yellow-400 h-3 rounded-full transition-all duration-500"
                style={{ width: todayPct + '%' }} />
            </div>
            <p className="text-xs text-orange-400 font-bold mt-1">
              あと {todayTotal - todayDone} タスクで今日クリア！ →
            </p>
          </div>
        )}
      </div>

      {/* 週間グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-3">📊 今週の学習グラフ</h3>
        <div className="flex items-end justify-between gap-1 h-16">
          {weekData.map((d, i) => {
            const h = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0
            const isToday = i === 6
            const dayLabel = ['日','月','火','水','木','金','土'][new Date(d.date).getDay()]
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: '48px' }}>
                  <div
                    className={\`w-full rounded-t-md transition-all \${isToday ? 'bg-orange-400' : d.done > 0 ? 'bg-orange-200' : 'bg-gray-100'}\`}
                    style={{ height: d.total > 0 ? Math.max(4, Math.round((d.done / maxWeek) * 48)) + 'px' : '4px' }}
                  />
                </div>
                <span className={\`text-xs \${isToday ? 'font-bold text-orange-500' : 'text-gray-400'}\`}>{dayLabel}</span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-300 mt-1 text-right">過去7日間の完了タスク数</p>
      </div>

      {/* お知らせ */}
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

      {/* メニューグリッド */}
      <div>
        <h3 className="font-bold text-gray-700 mb-3">🎮 メニュー</h3>
        <div className="grid grid-cols-2 gap-3">
          {MENU_ITEMS.map(({ path, icon, label, bg, border, text }) => (
            <button key={path} onClick={() => router.push(path)}
              className={\`\${bg} \${border} \${text} border rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition active:scale-95\`}>
              <span className="text-3xl">{icon}</span>
              <span className="font-bold text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
`;

writeFileSync('src/app/student/page.tsx', code, 'utf8');
console.log('OK');
