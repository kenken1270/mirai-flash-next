'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BREAK_TIPS = [
  { emoji: '🧘', title: '深呼吸タイム', desc: '4秒吸って、4秒止めて、4秒はく。3回やってみよう！', time: '1分' },
  { emoji: '🚶', title: 'ちょっと動こう', desc: '立ち上がって、首をゆっくり回してみよう。体をほぐすと頭もスッキリするよ！', time: '2分' },
  { emoji: '💧', title: '水を飲もう', desc: '脳が一番使うのは水分。コップ1杯の水を飲んでリフレッシュ！', time: '1分' },
  { emoji: '👀', title: '目を休めよう', desc: '遠くをぼーっと見てみよう。20秒間、遠くを見ると目が休まるよ！', time: '1分' },
  { emoji: '😄', title: '好きなことを思い浮かべよう', desc: 'お気に入りの場所や楽しかった思い出を30秒だけ思い浮かべてみよう。', time: '30秒' },
]

export default function BreakPage() {
  const router = useRouter()
  const [seconds, setSeconds] = useState(0)
  const [timerOn, setTimerOn] = useState(false)
  const [tip] = useState(() => BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setReady(true)
    }
    check()
  }, [])

  useEffect(() => {
    if (!timerOn) return
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [timerOn])

  const fmt = (s: number) => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0')

  if (!ready) return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-cyan-50 pb-24 px-4">
      <div className="max-w-lg mx-auto pt-8 space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-3">☕</div>
          <h1 className="text-3xl font-black text-teal-700">ひと休みタイム</h1>
          <p className="text-sm text-teal-500 mt-1">休むのも学習の一部だよ！</p>
        </div>
        <div className="bg-white rounded-3xl shadow-lg p-6 text-center space-y-4">
          <div className="text-6xl font-mono font-black text-teal-600">{fmt(seconds)}</div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setTimerOn(!timerOn)}
              className={'px-6 py-3 rounded-2xl font-bold text-white ' + (timerOn ? 'bg-red-400' : 'bg-teal-500')}>
              {timerOn ? '⏸ 止める' : '▶️ スタート'}
            </button>
            <button onClick={() => { setSeconds(0); setTimerOn(false) }}
              className="px-6 py-3 rounded-2xl font-bold border border-gray-300 text-gray-500">
              🔄 リセット
            </button>
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{tip.emoji}</span>
            <div>
              <p className="font-bold text-gray-700">{tip.title}</p>
              <span className="text-xs bg-teal-100 text-teal-600 px-2 py-0.5 rounded-full">{tip.time}</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">{tip.desc}</p>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-sm text-teal-700 space-y-1">
          <p className="font-bold">🧠 科学的な休憩の効果</p>
          <p>認知負荷理論（Sweller, 1988）によると、適度な休憩は作業記憶をリセットし、次の学習効率を上げるよ！</p>
        </div>
        <button onClick={() => router.push('/student/today')}
          className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-2xl font-bold text-lg">
          ➡️ タスクに戻る
        </button>
        <button onClick={() => router.push('/student')} className="w-full py-3 border border-gray-300 rounded-2xl text-gray-500">
          🏠 ホームへ
        </button>
      </div>
    </div>
  )
}
