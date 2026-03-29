'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

type ReviewLog = {
  id: number
  username: string
  flashcard_id: number
  quality: number
  ease_factor: number
  interval_days: number
  repetitions: number
  next_review_date: string
  created_at: string
}

type DailyStats = {
  date: string
  total: number
  correct: number
  rate: number
}

export default function FlashGraphPage() {
  const router = useRouter()
  const [username, setUsername] = useState<string>('')
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [streak, setStreak] = useState(0)
  const [avgAccuracy, setAvgAccuracy] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') || ''
      setUsername(uname)
      await fetchData(uname)
    }
    init()
  }, [router])

  const fetchData = async (uname: string) => {
    const { data, error } = await supabase
      .from('review_logs')
      .select('*')
      .eq('username', uname)
      .order('created_at', { ascending: true })

    if (error || !data) { setLoading(false); return }
    setTotalCards(data.length)

    const byDate: Record<string, { total: number; correct: number }> = {}
    data.forEach(log => {
      const raw = log.created_at || log.next_review_date || ''
      const date = raw.slice(0, 10)
      if (!date) return
      if (!byDate[date]) byDate[date] = { total: 0, correct: 0 }
      byDate[date].total++
      if (log.quality >= 3) byDate[date].correct++
    })

    const stats: DailyStats[] = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, v]) => ({
        date: date.slice(5),
        total: v.total,
        correct: v.correct,
        rate: Math.round((v.correct / v.total) * 100)
      }))
    setDailyStats(stats)

    const totalCorrect = data.filter(l => l.quality >= 3).length
    setAvgAccuracy(data.length > 0 ? Math.round((totalCorrect / data.length) * 100) : 0)

    const today = new Date().toISOString().slice(0, 10)
    const dates = [...new Set(data.map(l => (l.created_at || l.next_review_date || '').slice(0, 10)))]
      .filter(Boolean)
      .sort()
      .reverse()
    let s = 0
    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(today)
      expected.setDate(expected.getDate() - i)
      if (dates[i] === expected.toISOString().slice(0, 10)) s++
      else break
    }
    setStreak(s)
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-gray-500">データを読み込み中...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 pb-24">
      <div className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">
          ← 戻る
        </button>
        <h1 className="text-lg font-bold text-indigo-700">📈 学習グラフ</h1>
        <span className="ml-auto text-sm text-gray-400">{username}</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-indigo-100">
            <div className="text-3xl font-bold text-indigo-600">{totalCards}</div>
            <div className="text-xs text-gray-500 mt-1">総学習枚数</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-green-100">
            <div className="text-3xl font-bold text-green-600">{avgAccuracy}%</div>
            <div className="text-xs text-gray-500 mt-1">平均正解率</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-orange-100">
            <div className="text-3xl font-bold text-orange-500">{streak}🔥</div>
            <div className="text-xs text-gray-500 mt-1">連続学習日</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-4">📅 日別学習枚数（直近14日）</h2>
          {dailyStats.length === 0 ? (
            <p className="text-center text-gray-400 py-8">学習データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="総枚数" fill="#818cf8" radius={[4,4,0,0]} />
                <Bar dataKey="correct" name="正解" fill="#34d399" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-4">🎯 正解率推移（%）</h2>
          {dailyStats.length === 0 ? (
            <p className="text-center text-gray-400 py-8">学習データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="正解率"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <button
          onClick={() => router.push('/flash')}
          className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow hover:bg-indigo-700 transition"
        >
          📚 フラッシュ教材に戻る
        </button>
      </div>
    </div>
  )
}