'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUsernameFromSession } from '@/lib/auth-user'

type QuizResult = {
  id: number
  score_pct: number
  miss_count: number
  total_count: number
  correct_count: number
  taken_at: string
  stamp_earned: boolean
}

function Fireworks({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    type Particle = { x: number; y: number; vx: number; vy: number; color: string; alpha: number; size: number }
    const particles: Particle[] = []
    const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff6bdf','#ff9f43','#a29bfe']
    function launch() {
      const x = Math.random() * canvas!.width
      const y = Math.random() * canvas!.height * 0.5
      const color = colors[Math.floor(Math.random() * colors.length)]
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60
        const speed = 2 + Math.random() * 4
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, alpha: 1, size: 2 + Math.random() * 3 })
      }
    }
    let frame = 0
    const launchInterval = setInterval(launch, 400)
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.alpha -= 0.015
        if (p.alpha <= 0) { particles.splice(i, 1); continue }
        ctx!.globalAlpha = p.alpha
        ctx!.fillStyle = p.color
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
      frame++
      if (frame < 300) requestAnimationFrame(animate)
      else clearInterval(launchInterval)
    }
    launch(); launch()
    animate()
    return () => clearInterval(launchInterval)
  }, [active])
  if (!active) return null
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-40" style={{ width: '100vw', height: '100vh' }} />
}

function ResultContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const total  = parseInt(sp.get('total')   ?? '0')
  const correct= parseInt(sp.get('correct') ?? '0')
  const miss   = parseInt(sp.get('miss')    ?? '0')
  const score  = parseInt(sp.get('score')   ?? '0')
  const stamp  = sp.get('stamp') === 'true'
  const bookId = sp.get('book_id')
  const itemStart = sp.get('item_start') ?? '1'
  const itemEnd   = sp.get('item_end')   ?? '9999'

  const [history, setHistory]         = useState<QuizResult[]>([])
  const [showFireworks, setShowFireworks] = useState(false)
  const [animIn, setAnimIn]           = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = getUsernameFromSession(session)
      const { data: results } = await supabase
        .from('quiz_results').select('*').eq('username', uname)
        .order('taken_at', { ascending: false }).limit(10)
      setHistory(results ?? [])
      setTimeout(() => setAnimIn(true), 100)
      if (stamp) setTimeout(() => setShowFireworks(true), 400)
    }
    init()
  }, [router, stamp])

  const pastScores   = [...history].reverse()
  const totalTests   = history.length
  const stampCount   = history.filter(r => r.stamp_earned).length
  const avgScore     = totalTests > 0 ? Math.round(history.reduce((s, r) => s + r.score_pct, 0) / totalTests) : 0
  const totalAnswered= history.reduce((s, r) => s + r.total_count, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex flex-col">
      <Fireworks active={showFireworks} />

      {/* iPad最適化：全体をmax-w-4xlで中央揃え */}
      <div className={`flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-4 gap-4 transition-all duration-700
        ${animIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

        {/* 上段：合否カード + 今回スコア（横並び） */}
        <div className="grid grid-cols-2 gap-4">

          {/* 合否カード */}
          {stamp ? (
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 shadow-2xl text-white flex flex-col items-center justify-center gap-2 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 text-[120px] flex items-center justify-center select-none">⭐</div>
              <div className="text-5xl">🎉</div>
              <p className="text-sm font-bold opacity-90">ミス {miss}回 / {total}問</p>
              <p className="text-4xl font-black">合格！🏆</p>
              <p className="text-2xl font-bold">正解率 {score}%</p>
              <div className="bg-white/25 rounded-2xl px-6 py-3 text-center mt-2">
                <p className="text-xl font-black">先生に見せよう！</p>
                <p className="text-sm opacity-90 mt-0.5">スタンプがもらえるよ 🎖️</p>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 shadow-2xl text-white flex flex-col items-center justify-center gap-2">
              <div className="text-5xl">💪</div>
              <p className="text-sm font-bold opacity-90">ミス {miss}回 / {total}問</p>
              <p className="text-4xl font-black">お疲れさま！</p>
              <p className="text-2xl font-bold">正解率 {score}%</p>
              <div className="bg-white/20 rounded-2xl px-4 py-3 text-center mt-2">
                <p className="text-base font-bold">ミス3以内でスタンプGET！</p>
                <p className="text-sm opacity-80 mt-0.5">もう一度チャレンジしよう 🔥</p>
              </div>
            </div>
          )}

          {/* 右側：今回スコア + 累計統計 */}
          <div className="flex flex-col gap-3">
            {/* 今回スコア */}
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 flex-1">
              <h3 className="text-white font-bold text-sm mb-3">📊 今回の結果</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: '正解', value: correct, unit: '問', color: 'text-green-400' },
                  { label: 'ミス',  value: miss,    unit: '回', color: 'text-red-400'   },
                  { label: '正解率',value: score,   unit: '%',  color: 'text-yellow-400'},
                ].map(({ label, value, unit, color }) => (
                  <div key={label} className="bg-white/10 rounded-xl py-3">
                    <p className={`text-2xl font-black ${color}`}>{value}<span className="text-xs">{unit}</span></p>
                    <p className="text-white/60 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 累計統計 */}
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 flex-1">
              <h3 className="text-white font-bold text-sm mb-3">🏅 累計記録</h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                {[
                  { label: 'テスト回数',    value: totalTests,    unit: '回', color: 'text-purple-300' },
                  { label: 'スタンプ獲得',  value: stampCount,    unit: '回', color: 'text-yellow-300' },
                  { label: '平均正解率',    value: avgScore,      unit: '%',  color: 'text-green-300'  },
                  { label: '累計出題数',    value: totalAnswered, unit: '問', color: 'text-blue-300'   },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} className="bg-white/10 rounded-xl py-2">
                    <p className={`text-xl font-black ${color}`}>{value.toLocaleString()}<span className="text-xs">{unit}</span></p>
                    <p className="text-white/60 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 下段：グラフ + ボタン（横並び） */}
        <div className="grid grid-cols-2 gap-4">

          {/* 正解率グラフ */}
          {pastScores.length > 1 && (
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <h3 className="text-white font-bold text-sm mb-3">📈 正解率の推移</h3>
              <div className="flex items-end gap-2 h-28">
                {pastScores.slice(-8).map((r, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-white/70 text-xs">{r.score_pct}%</p>
                    <div className="w-full rounded-t-lg transition-all duration-500 relative"
                      style={{
                        height: `${Math.round((r.score_pct / 100) * 80)}px`,
                        background: r.stamp_earned
                          ? 'linear-gradient(to top,#f59e0b,#fbbf24)'
                          : 'linear-gradient(to top,#6366f1,#818cf8)'
                      }}>
                      {r.stamp_earned && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-sm">⭐</span>
                      )}
                    </div>
                    <p className="text-white/50 text-xs">{i + 1}回目</p>
                  </div>
                ))}
              </div>
              <p className="text-white/40 text-xs mt-2 text-center">⭐ = スタンプ獲得</p>
            </div>
          )}

          {/* ボタン群 */}
          <div className="flex flex-col gap-3 justify-center">
            <button
              onClick={() => {
                const params = new URLSearchParams({
                  book_id: bookId ?? '',
                  item_start: itemStart,
                  item_end: itemEnd,
                })
                router.push('/flash/quiz?' + params.toString())
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 transition">
              🔄 もう一度チャレンジ
            </button>
            <button
              onClick={() => router.push('/student/test')}
              className="w-full bg-white/20 text-white py-3 rounded-2xl font-bold hover:bg-white/30 transition">
              ✏️ 小テスト設定へ戻る
            </button>
            <button
              onClick={() => router.push('/student')}
              className="w-full bg-white/10 text-white/70 py-3 rounded-2xl font-bold hover:bg-white/20 transition">
              🏠 ホームへ
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function QuizResultPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-purple-900">
        <div className="text-5xl animate-bounce">🎉</div>
        <p className="text-white/60">結果を集計中...</p>
      </div>
    }>
      <ResultContent />
    </Suspense>
  )
}