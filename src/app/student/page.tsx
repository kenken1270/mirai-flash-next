'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadNews, saveUserFields, todayStr, type UserRow, type NewsRow } from '@/lib/student'

export default function StudentHome() {
  const router = useRouter()
  const [user, setUser] = useState<UserRow | null>(null)
  const [news, setNews] = useState<NewsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [debugMsg, setDebugMsg] = useState<string[]>([])

  function log(msg: string) {
    console.log(msg)
    setDebugMsg(prev => [...prev, msg])
  }

  useEffect(() => {
    async function init() {
      log('🔍 セッション確認中...')
      const { data: { session } } = await supabase.auth.getSession()
      log(`セッション: ${session ? session.user.email : 'なし'}`)

      if (!session) {
        log('❌ セッションなし → /login へ')
        router.push('/login')
        return
      }

      const username = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      log(`ユーザー名: ${username}`)

      const userData = await loadUser(username)
      log(`ユーザーデータ: ${userData ? JSON.stringify(userData) : 'null'}`)

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
      log(`お知らせ件数: ${newsData.length}`)
      setNews(newsData.filter(n => n.target_user === '全員' || n.target_user === username))

      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        <div className="text-center py-8">
          <div className="text-4xl animate-bounce mb-4">📚</div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
        <div className="bg-gray-100 rounded-xl p-3 text-xs font-mono space-y-1">
          <p className="font-bold text-gray-600">🔍 デバッグログ:</p>
          {debugMsg.map((m, i) => <p key={i} className="text-gray-700">{m}</p>)}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ❌ ユーザーデータが取得できませんでした
        </div>
        <div className="bg-gray-100 rounded-xl p-3 mt-3 text-xs font-mono space-y-1">
          {debugMsg.map((m, i) => <p key={i}>{m}</p>)}
        </div>
      </div>
    )
  }

  const xp = user.current_points ?? 0
  const streak = user.streak ?? 0

  return (
    <div className="space-y-4">
      {/* ウェルカムカード */}
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

      {/* XPカード */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-800">🎮 累計XP</span>
          <span className="text-yellow-500 font-bold">⚡ {xp.toLocaleString()} XP</span>
        </div>
      </div>

      {/* お知らせ */}
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

      {/* メニュー */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/student/schedule', icon: '📅', label: '今日の学習',   color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { href: '/student/plan',     icon: '🗺️', label: '計画確認',     color: 'bg-green-50 border-green-200 text-green-700' },
          { href: '/student/test',     icon: '✏️', label: '小テスト',     color: 'bg-purple-50 border-purple-200 text-purple-700' },
          { href: '/student/gacha',    icon: '🎁', label: 'ガチャ',       color: 'bg-pink-50 border-pink-200 text-pink-700' },
        ].map(({ href, icon, label, color }) => (
          <a key={href} href={href}
            className={`border rounded-xl p-4 flex flex-col items-center gap-1 shadow-sm hover:shadow-md transition ${color}`}>
            <span className="text-3xl">{icon}</span>
            <span className="font-bold text-sm">{label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}