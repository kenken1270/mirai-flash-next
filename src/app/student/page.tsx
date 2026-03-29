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
        router.push('/login')
        return
      }

      const username = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      log(`ユーザー名: ${username}`)

      let userData = await loadUser(username)
      log(`DBユーザー: ${userData ? 'あり' : 'なし（新規作成します）'}`)

      // usersテーブルにない場合は自動作成
      if (!userData) {
        log('👤 usersテーブルに新規挿入中...')
        const { error: insertError } = await supabase.from('users').insert({
          username,
          current_points: 0,
          streak: 0,
          last_visit_date: todayStr(),
          last_login_date: todayStr(),
        })
        if (insertError) {
          log(`❌ 挿入エラー: ${insertError.message}`)
        } else {
          log('✅ 新規ユーザー作成完了')
          userData = await loadUser(username)
        }
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
        log(`✅ ユーザー設定完了: XP=${userData.current_points}, streak=${userData.streak}`)
      }

      const newsData = await loadNews()
      log(`📢 お知らせ: ${newsData.length}件`)
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
      <div className="p-4 space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ❌ ユーザーデータが取得できませんでした
        </div>
        <div className="bg-gray-100 rounded-xl p-3 text-xs font-mono space-y-1">
          {debugMsg.map((m, i) => <p key={i}>{m}</p>)}
        </div>
      </div>
    )
  }

  const xp = user.current_points ?? 0
  const { level, title, nextXp, progress } = xpToLevel(xp)
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

      {/* レベル・XPカード */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-lg font-bold text-gray-800">{title}</span>
            <span className="ml-2 text-sm text-gray-400">Lv.{level}</span>
          </div>
          <span className="text-yellow-500 font-bold">⚡ {xp.toLocaleString()} XP</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-yellow-400 to-orange-400 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">
          次のレベルまで {(nextXp - xp).toLocaleString()} XP
        </p>
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
      <div>
        <h3 className="font-bold text-gray-700 mb-2">📌 メニュー</h3>
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

      {/* 単語学習リンク */}
      <a href="/flash"
        className="block bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl p-4 shadow-md text-center hover:opacity-90 transition">
        <div className="text-2xl mb-1">🃏</div>
        <div className="font-bold">単語学習アプリへ</div>
        <div className="text-xs opacity-80 mt-1">フラッシュカードで単語を覚えよう！</div>
      </a>
    </div>
  )
}