'use client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Card = {
  id: number
  word: string
  meaning: string
  reading?: string
}

type Result = {
  card: Card
  answered: boolean
  correct: boolean
  timeUsed: number
}

const TIME_LIMIT = 10

function FlashAttackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setId = searchParams.get('setId') || '1'
  const setName = searchParams.get('setName') || '単語'

  const [cards, setCards] = useState<Card[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [results, setResults] = useState<Result[]>([])
  const [phase, setPhase] = useState<'loading' | 'ready' | 'playing' | 'finished'>('loading')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data } = await supabase
        .from('flashcards')
        .select('id, word, meaning, reading, phonetic, reading')
        .eq('set_id', setId)
        .limit(10)

      if (data && data.length > 0) {
        setCards([...data].sort(() => Math.random() - 0.5))
        setPhase('ready')
      } else {
        setPhase('finished')
      }
    }
    init()
  }, [router, setId])

  const goNext = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCurrent(prev => {
      if (prev + 1 >= cards.length) {
        setPhase('finished')
        return prev
      }
      setFlipped(false)
      setTimeLeft(TIME_LIMIT)
      return prev + 1
    })
  }, [cards.length])

  const handleTimeout = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setResults(prev => [...prev, {
      card: cards[current],
      answered: false,
      correct: false,
      timeUsed: TIME_LIMIT
    }])
    goNext()
  }, [cards, current, goNext])

  useEffect(() => {
    if (phase !== 'playing' || flipped) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, current, flipped, handleTimeout])

  function startGame() {
    setPhase('playing')
    setTimeLeft(TIME_LIMIT)
  }

  function handleFlip() {
    if (flipped) return
    if (timerRef.current) clearInterval(timerRef.current)
    setFlipped(true)
  }

  function handleJudge(correct: boolean) {
    const timeUsed = TIME_LIMIT - timeLeft
    setResults(prev => [...prev, { card: cards[current], answered: true, correct, timeUsed }])
    goNext()
  }

  function handleRetry() {
    setCurrent(0)
    setFlipped(false)
    setResults([])
    setTimeLeft(TIME_LIMIT)
    setCards(prev => [...prev].sort(() => Math.random() - 0.5))
    setPhase('ready')
  }

  const score = results.filter(r => r.correct).length
  const totalTime = results.reduce((a, r) => a + r.timeUsed, 0)
  const accuracy = results.length > 0 ? Math.round((score / results.length) * 100) : 0

  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">⚡</div>
        <p className="text-gray-500">カードを読み込み中...</p>
      </div>
    </div>
  )

  if (phase === 'ready') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 px-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center space-y-6">
        <div className="text-6xl">⚡</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">タイムアタック</h1>
          <p className="text-gray-500 text-sm mt-1">{setName}</p>
        </div>
        <div className="bg-orange-50 rounded-2xl p-4 text-left space-y-2">
          <p className="text-sm text-gray-600">📋 <span className="font-bold">{cards.length}問</span> 出題</p>
          <p className="text-sm text-gray-600">⏱️ 1問 <span className="font-bold text-orange-500">{TIME_LIMIT}秒</span> 以内に答える</p>
          <p className="text-sm text-gray-600">🃏 カードをタップして答えを確認</p>
          <p className="text-sm text-gray-600">✅ 正解・不正解を自己申告</p>
        </div>
        <button onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 transition active:scale-95">
          🚀 スタート！
        </button>
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600">← 戻る</button>
      </div>
    </div>
  )

  if (phase === 'finished') return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 pb-10">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-4 text-center">
        <h1 className="text-xl font-bold">⚡ タイムアタック 結果</h1>
        <p className="text-sm opacity-80 mt-0.5">{setName}</p>
      </div>
      <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-3xl shadow-md p-6 text-center space-y-4">
          <div className="text-6xl font-bold text-orange-500">{score}<span className="text-2xl text-gray-400">/{cards.length}</span></div>
          <p className="text-gray-500 text-sm">正解数</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-green-600">{accuracy}%</div>
              <div className="text-xs text-gray-500">正解率</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-blue-600">{totalTime}s</div>
              <div className="text-xs text-gray-500">合計タイム</div>
            </div>
          </div>
          {accuracy >= 80 && <p className="text-yellow-500 font-bold text-lg">🎉 すばらしい！</p>}
          {accuracy >= 50 && accuracy < 80 && <p className="text-blue-500 font-bold text-lg">👍 よくできました！</p>}
          {accuracy < 50 && <p className="text-gray-500 font-bold text-lg">💪 もう一度チャレンジ！</p>}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-600">📝 問題別結果</p>
          {results.map((r, i) => (
            <div key={i} className={"bg-white rounded-xl px-4 py-3 shadow-sm border flex items-center gap-3 " + (r.correct ? 'border-green-200' : 'border-red-200')}>
              <span className="text-xl">{r.correct ? '✅' : r.answered ? '❌' : '⏰'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{r.card.word}</p>
                <p className="text-xs text-gray-400 truncate">{r.card.meaning}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{r.timeUsed}s</span>
            </div>
          ))}
        </div>
        <button onClick={handleRetry}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold shadow hover:opacity-90 transition">
          🔄 もう一度チャレンジ
        </button>
        <button onClick={() => router.push('/flash')}
          className="w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold shadow-sm hover:bg-gray-50 transition">
          📚 教材選択に戻る
        </button>
      </div>
    </div>
  )

  const card = cards[current]
  const timerPct = (timeLeft / TIME_LIMIT) * 100
  const timerColor = timeLeft > 6 ? 'bg-green-400' : timeLeft > 3 ? 'bg-yellow-400' : 'bg-red-500'

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">{current + 1} / {cards.length}</span>
          <span className="text-2xl font-bold">{timeLeft}s</span>
          <button onClick={() => router.push('/flash')} className="text-sm opacity-80 hover:opacity-100">✕</button>
        </div>
        <div className="w-full bg-white/30 rounded-full h-2">
          <div className={"h-2 rounded-full transition-all duration-1000 " + timerColor} style={{ width: timerPct + '%' }}></div>
        </div>
      </div>
      <div className="px-4 pt-3">
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <div key={i} className={"h-1.5 flex-1 rounded-full " + (i < current ? 'bg-orange-400' : i === current ? 'bg-orange-300' : 'bg-gray-200')}></div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <button onClick={handleFlip}
          className={"w-full max-w-sm min-h-48 rounded-3xl shadow-lg flex flex-col items-center justify-center p-6 transition-all active:scale-95 " +
            (flipped ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 hover:shadow-xl cursor-pointer')}>
          {!flipped ? (
            <>
              <p className="text-2xl font-bold text-center mb-3">{card.word}</p>
              <p className="text-sm text-gray-400">タップして答えを見る</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-center mb-2">{card.meaning}</p>
              {card.reading && <p className="text-sm opacity-80 text-center">{card.reading}</p>}
            </>
          )}
        </button>
        {flipped && (
          <div className="w-full max-w-sm mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => handleJudge(false)}
              className="py-4 bg-red-100 text-red-600 rounded-2xl font-bold text-lg hover:bg-red-200 transition active:scale-95">
              ❌ 不正解
            </button>
            <button onClick={() => handleJudge(true)}
              className="py-4 bg-green-100 text-green-600 rounded-2xl font-bold text-lg hover:bg-green-200 transition active:scale-95">
              ✅ 正解！
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FlashAttackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">⚡</div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    }>
      <FlashAttackContent />
    </Suspense>
  )
}