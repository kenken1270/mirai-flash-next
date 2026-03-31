'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadNews, saveUserFields, todayStr, type UserRow, type NewsRow } from '@/lib/student'

function xpToLevel(xp: number) {
  const thresholds = [0,100,250,500,1000,2000,3500,5500,8000,11000,15000]
  const titles = ['🌱 見習い','📖 初級生','✏️ 学習者','📝 努力家','⭐ 秀才','🔥 猛者','💎 エキスパート','👑 マスター','🏆 レジェンド','🌟 伝説','🎖️ 神']
  let level = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i
  }
  const nextXp = thresholds[level + 1] ?? thresholds[thresholds.length - 1]
  const prevXp = thresholds[level]
  const progress = nextXp > prevXp ? Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100) : 100
  return { level: level + 1, title: titles[level], nextXp, progress }
}

export default function StudentHome() {
  const router = useRouter()
  const [user, setUser] = useState<UserRow | null>(null)
  const [news, setNews] = useState<NewsRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const username = session.user.email?.replace('@mirai-juku.internal', '') ?? ''

      let userData = await loadUser(username)
      if (!userData) {
        await supabase.from('users').insert({
          username,
          current_points: 0,
          streak: 0,
          last_visit_date: todayStr(),
          last_login_date: todayStr(),
        })
        userData = await loadUser(username)
      }

      if (userData) {
        const today = todayStr()
        const lastVisit = userData.last_visit_date ?? ''
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        let newStreak = userData.streak ?? 0
        if (lastVisit !== today) {
          newStreak = lastVisit === yesterday ? newStreak + 1 : 1
          await saveUserFields(username, { last_visit_date: today, streak: newStreak })
          userData.streak = newStreak
          userData.last_visit_date = today
        }
        setUser(userData)
      }

      const newsData = await loadNews()
      setNews(newsData.filter(n => n.target_user === '全員' || n.target_user === username))
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-4xl animate-bounce">📚</div>
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ❌ ユーザーデータが取得できませんでした。再ログインしてください。
        </div>
      </div>
    )
  }

  const xp = user.current_points ?? 0
  const { level, title, nextXp, progress } = xpToLevel(xp)
  const streak = user.streak ?? 0

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-5 shadow-md text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">おかえり！</p>
            <h2 className="text-2xl font-bold">{user.username} さん 👋</h2>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{streak}</div>
            <div className="text-sm opacity-90">日連続🔥</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-lg font-bold text-gray-800">{title}</span>
            <span className="ml-2 text-sm text-gray-400">Lv.{level}</span>
          </div>
          <span className="text-yellow-500 font-bold">⚡ {xp.toLocaleString()} XP</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 h-3 rounded-full transition-all duration-500"
            style={{ width: progress + '%' }} />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">
          次のレベルまで {(nextXp - xp).toLocaleString()} XP
        </p>
      </div>

      {news.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-gray-700">📢 お知らせ</h3>
          {news.map(n => (
            <div key={n.id} className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-gray-700">
              ⚠️ {n.message}
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="font-bold text-gray-700 mb-2">📌 メニュー</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { path: '/student/schedule', icon: '📅', label: '今日の学習',   color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { path: '/student/calendar', icon: '📆', label: 'カレンダー',  color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
            { path: '/student/plan',     icon: '🗺️', label: '計画確認',     color: 'bg-green-50 border-green-200 text-green-700' },
            { path: '/student/test',     icon: '✏️', label: '小テスト',     color: 'bg-purple-50 border-purple-200 text-purple-700' },
            { path: '/student/gacha',    icon: '🎁', label: 'ガチャ',       color: 'bg-pink-50 border-pink-200 text-pink-700' },
          ].map(({ path, icon, label, color }) => (
            <button key={path} onClick={() => router.push(path)}
              className={"border rounded-xl p-4 flex flex-col items-center gap-1 shadow-sm hover:shadow-md transition " + color}>
              <span className="text-3xl">{icon}</span>
              <span className="font-bold text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => router.push('/flash')}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl p-4 shadow-md text-center hover:opacity-90 transition">
        <div className="text-2xl mb-1">🃏</div>
        <div className="font-bold">単語学習アプリへ</div>
        <div className="text-xs opacity-80 mt-1">フラッシュカードで単語を覚えよう！</div>
      </button>
    </div>
  )
}