'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, saveUserFields, type UserRow } from '@/lib/student'

const GACHA_COST = 50

const GACHA_RESULTS = [
  { rank: 'SSR', emoji: '🌟', message: '天才！このままいけば世界一になれる！',        color: 'from-yellow-400 to-orange-500',  textColor: 'text-yellow-600', prob: 5 },
  { rank: 'SSR', emoji: '🏆', message: '最高の努力家！継続は力なり！',                color: 'from-yellow-400 to-orange-500',  textColor: 'text-yellow-600', prob: 5 },
  { rank: 'SR',  emoji: '🔥', message: '熱い！その調子で燃え続けろ！',               color: 'from-pink-400 to-purple-500',    textColor: 'text-pink-600',   prob: 15 },
  { rank: 'SR',  emoji: '💎', message: 'ダイヤモンドのような輝きを持っている！',      color: 'from-pink-400 to-purple-500',    textColor: 'text-pink-600',   prob: 15 },
  { rank: 'R',   emoji: '⭐', message: 'よく頑張ってる！その努力は必ず実を結ぶ！',   color: 'from-blue-400 to-indigo-500',    textColor: 'text-blue-600',   prob: 25 },
  { rank: 'R',   emoji: '🌈', message: '毎日コツコツ！積み重ねが大事！',             color: 'from-blue-400 to-indigo-500',    textColor: 'text-blue-600',   prob: 25 },
  { rank: 'N',   emoji: '🍀', message: '今日も一歩前進！明日はもっと上へ！',         color: 'from-green-400 to-teal-500',     textColor: 'text-green-600',  prob: 5 },
  { rank: 'N',   emoji: '💪', message: 'ファイト！諦めなければ必ずできる！',          color: 'from-green-400 to-teal-500',     textColor: 'text-green-600',  prob: 5 },
]

function drawGacha() {
  const rand = Math.random() * 100
  let cumulative = 0
  for (const item of GACHA_RESULTS) {
    cumulative += item.prob
    if (rand < cumulative) return item
  }
  return GACHA_RESULTS[GACHA_RESULTS.length - 1]
}

type GachaResult = typeof GACHA_RESULTS[0]

export default function GachaPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [user, setUser] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<GachaResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [history, setHistory] = useState<GachaResult[]>([])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)
      const userData = await loadUser(uname)
      setUser(userData)
      setLoading(false)
    }
    init()
  }, [router])

  async function handleGacha() {
    if (!user || (user.current_points ?? 0) < GACHA_COST) return
    setSpinning(true)
    setShowResult(false)
    setResult(null)

    // XP消費
    const newXp = (user.current_points ?? 0) - GACHA_COST
    await saveUserFields(username, { current_points: newXp })
    setUser(prev => prev ? { ...prev, current_points: newXp } : prev)

    // アニメーション待機
    await new Promise(resolve => setTimeout(resolve, 1200))

    const drawn = drawGacha()
    setResult(drawn)
    setHistory(prev => [drawn, ...prev].slice(0, 5))
    setSpinning(false)
    setShowResult(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-4xl animate-bounce">🎁</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  const xp = user?.current_points ?? 0
  const canGacha = xp >= GACHA_COST

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-5 text-white shadow-md">
        <h2 className="text-xl font-bold">🎰 はげましガチャ</h2>
        <p className="text-sm opacity-80 mt-1">
          50 XP を使ってガチャを引こう！<br />
          はげましメッセージをゲット！
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm opacity-80">現在のXP</span>
          <span className="font-bold text-yellow-300 text-lg">⚡ {xp.toLocaleString()} XP</span>
        </div>
        {/* XPバー（50単位） */}
        <div className="mt-2 w-full bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="bg-yellow-300 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((xp / GACHA_COST) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs opacity-60 mt-1 text-right">
          {canGacha ? 'ガチャを引ける！' : `あと ${GACHA_COST - xp} XP で引ける`}
        </p>
      </div>

      {/* ガチャボタン */}
      <div className="text-center py-2">
        <button
          onClick={handleGacha}
          disabled={!canGacha || spinning}
          className={`relative w-40 h-40 rounded-full shadow-2xl text-white font-bold text-lg
            transition-all duration-200 active:scale-95
            ${canGacha && !spinning
              ? 'bg-gradient-to-b from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 cursor-pointer'
              : 'bg-gray-300 cursor-not-allowed'
            }`}
        >
          {spinning ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl animate-spin">🎰</span>
              <span className="text-sm">ひいてる...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-5xl">🎁</span>
              <span className="text-sm mt-1">ガチャを引く</span>
              <span className="text-xs opacity-80">-50 XP</span>
            </div>
          )}
          {/* 光るリング */}
          {canGacha && !spinning && (
            <div className="absolute inset-0 rounded-full border-4 border-yellow-300 animate-ping opacity-30" />
          )}
        </button>
      </div>

      {/* 結果表示 */}
      {showResult && result && (
        <div className={`bg-gradient-to-r ${result.color} rounded-2xl p-6 text-white shadow-xl text-center
          animate-bounce`}
          style={{ animationIterationCount: 1 }}
        >
          <div className="text-sm font-bold opacity-80 mb-1">
            {result.rank === 'SSR' ? '✨ SSR ✨' : result.rank === 'SR' ? '🌟 SR 🌟' : result.rank === 'R' ? '⭐ R ⭐' : '🍀 N 🍀'}
          </div>
          <div className="text-6xl my-3">{result.emoji}</div>
          <p className="font-bold text-lg leading-relaxed">{result.message}</p>
          <div className="mt-3 text-sm opacity-70">
            残りXP: {xp.toLocaleString()}
          </div>
        </div>
      )}

      {/* レアリティ説明 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-3 text-sm">🎲 レアリティ</h3>
        <div className="space-y-1.5">
          {[
            { rank: 'SSR', label: '超レア！',   pct: '10%',  color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
            { rank: 'SR',  label: 'レア',       pct: '30%',  color: 'bg-pink-100 text-pink-700 border-pink-300' },
            { rank: 'R',   label: 'ふつう',     pct: '50%',  color: 'bg-blue-100 text-blue-700 border-blue-300' },
            { rank: 'N',   label: 'たまに出る', pct: '10%',  color: 'bg-green-100 text-green-700 border-green-300' },
          ].map(({ rank, label, pct, color }) => (
            <div key={rank} className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-bold ${color}`}>
              <span>{rank} — {label}</span>
              <span>{pct}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 直近の履歴 */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-3 text-sm">📜 直近の結果</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{h.emoji}</span>
                <span className={`font-bold text-xs px-2 py-0.5 rounded-full
                  ${h.rank === 'SSR' ? 'bg-yellow-100 text-yellow-700' :
                    h.rank === 'SR'  ? 'bg-pink-100 text-pink-700' :
                    h.rank === 'R'   ? 'bg-blue-100 text-blue-700' :
                                       'bg-green-100 text-green-700'}`}>
                  {h.rank}
                </span>
                <span className="text-gray-600 truncate">{h.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}