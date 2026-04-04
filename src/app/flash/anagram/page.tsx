'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Card = { id: number; lang1: string; lang2: string; lang3: string; item_no: number }

function AnagramContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const setId = searchParams.get('id')
  
  const [cards, setCards] = useState<Card[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [shuffledChars, setShuffledChars] = useState<{id: number, char: string}[]>([])
  const [answerChars, setAnswerChars] = useState<{id: number, char: string}[]>([])
  const [isCorrect, setIsCorrect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<"quiz" | "result">("quiz")

  useEffect(() => {
    async function fetchCards() {
      if (!setId) return
      const { data } = await supabase.from('flashcards_v3').select('*').eq('set_id', setId).limit(20)
      if (data && data.length > 0) {
        setCards(data)
        initQuiz(data[0].lang1)
      }
      setLoading(false)
    }
    fetchCards()
  }, [setId])

  const initQuiz = (word: string) => {
    const chars = word.split('').filter(c => c !== ' ').map((c, i) => ({ id: i, char: c }))
    setAnswerChars([])
    setShuffledChars([...chars].sort(() => Math.random() - 0.5))
    setIsCorrect(false)
  }

  const handleCharClick = (item: {id: number, char: string}, fromAnswer: boolean) => {
    if (isCorrect) return
    if (fromAnswer) {
      setAnswerChars(prev => prev.filter(i => i.id !== item.id))
      setShuffledChars(prev => [...prev, item])
    } else {
      const newAnswer = [...answerChars, item]
      setAnswerChars(newAnswer)
      setShuffledChars(prev => prev.filter(i => i.id !== item.id))
      const currentWord = cards[currentIdx].lang1.replace(/ /g, '')
      if (newAnswer.map(i => i.char).join('') === currentWord) {
        setIsCorrect(true)
        setTimeout(() => nextCard(), 800)
      }
    }
  }

  const nextCard = () => {
    const nextIdx = currentIdx + 1
    if (nextIdx < cards.length) {
      setCurrentIdx(nextIdx)
      initQuiz(cards[nextIdx].lang1)
    } else {
      setPhase("result")
    }
  }

  if (loading) return <div className="p-10 text-center text-yellow-600 font-bold animate-pulse">🐕 準備中...</div>
  if (cards.length === 0) return <div className="p-10 text-center text-gray-400">カードが見つかりません</div>

  if (phase === "result") return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-10 rounded-3xl shadow-xl border-4 border-yellow-400 space-y-6 animate-in zoom-in duration-500">
        <span className="text-6xl">🎉</span>
        <h2 className="text-3xl font-bold text-gray-800">全問正解！</h2>
        <p className="text-gray-500 font-bold leading-relaxed">スペルマスターへの道が<br/>また一歩開けたぞ！🐕</p>
        <button onClick={() => router.back()} className="w-full py-4 bg-yellow-400 text-gray-900 rounded-2xl font-bold shadow-md active:scale-95 transition">
          一覧へもどる
        </button>
      </div>
    </div>
  )

  const currentCard = cards[currentIdx]

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col items-center">
      <div className="w-full bg-yellow-400 p-4 shadow-md flex justify-between items-center text-gray-900 font-bold">
        <button onClick={() => router.back()} className="bg-white/50 px-3 py-1 rounded-full text-sm">← 戻る</button>
        <span>🧩 ならべかえクイズ</span>
        <span className="bg-white/50 px-3 py-1 rounded-full text-sm">{currentIdx + 1} / {cards.length}</span>
      </div>

      <div className="flex-1 w-full max-w-md flex flex-col items-center justify-center p-6 gap-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-yellow-100 w-full text-center">
          <p className="text-xs text-gray-400 mb-1 font-bold">意味</p>
          <h2 className="text-2xl font-bold text-gray-800">{currentCard.lang2}</h2>
        </div>

        <div className="w-full">
          <p className="text-[10px] text-center font-bold text-gray-300 mb-2 uppercase tracking-widest">Answer Area</p>
          <div className="flex flex-wrap gap-2 min-h-[4.5rem] items-center justify-center p-4 bg-white/50 rounded-2xl border-2 border-dashed border-yellow-200">
            {answerChars.map((item) => (
              <button key={item.id} onClick={() => handleCharClick(item, true)}
                className="w-10 h-12 bg-indigo-500 text-white rounded-xl text-xl font-bold shadow-md transform transition active:scale-95 animate-in zoom-in"
              >
                {item.char}
              </button>
            ))}
            {isCorrect && <span className="text-3xl animate-bounce ml-2">✅</span>}
          </div>
        </div>

        <div className="w-full">
          <p className="text-[10px] text-center font-bold text-gray-300 mb-2 uppercase tracking-widest">Pick Letters</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {shuffledChars.map((item) => (
              <button key={item.id} onClick={() => handleCharClick(item, false)}
                className="w-12 h-14 bg-white border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 rounded-xl text-xl font-bold text-gray-700 shadow-sm flex items-center justify-center transition-all hover:bg-yellow-50"
              >
                {item.char}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => initQuiz(currentCard.lang1)} className="text-gray-400 text-xs font-bold underline decoration-dotted">
          ならべなおす
        </button>
      </div>
    </div>
  )
}

export default function AnagramPage() {
  return <Suspense><AnagramContent /></Suspense>
}