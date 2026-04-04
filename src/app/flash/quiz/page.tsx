'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Card = { id: number; lang1: string; lang2: string; lang3: string; item_no: number }

function QuizContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const setId = searchParams.get('id')
  
  const [cards, setCards] = useState<Card[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [shuffledChars, setShuffledChars] = useState<string[]>([])
  const [answerChars, setAnswerChars] = useState<string[]>([])
  const [isCorrect, setIsCorrect] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCards() {
      if (!setId) return
      const { data } = await supabase.from('flashcards_v3').select('*').eq('set_id', setId).limit(10)
      if (data) {
        setCards(data)
        initQuiz(data[0].lang1)
      }
      setLoading(false)
    }
    fetchCards()
  }, [setId])

  const initQuiz = (word: string) => {
    const chars = word.toLowerCase().split('').filter(c => c !== ' ')
    setAnswerChars([])
    setShuffledChars([...chars].sort(() => Math.random() - 0.5))
    setIsCorrect(false)
  }

  const handleCharClick = (char: string, idx: number) => {
    const newAnswer = [...answerChars, char]
    setAnswerChars(newAnswer)
    
    // 使った文字をシャッフルリストから消す
    const newShuffled = [...shuffledChars]
    newShuffled.splice(idx, 1)
    setShuffledChars(newShuffled)

    // 判定
    const targetWord = cards[currentIdx].lang1.toLowerCase().replace(/ /g, '')
    if (newAnswer.join('') === targetWord) {
      setIsCorrect(true)
      setTimeout(() => nextCard(), 1000)
    }
  }

  const nextCard = () => {
    const nextIdx = currentIdx + 1
    if (nextIdx < cards.length) {
      setCurrentIdx(nextIdx)
      initQuiz(cards[nextIdx].lang1)
    } else {
      alert("全問クリア！おめでとう！")
      router.back()
    }
  }

  if (loading) return <div className="p-10 text-center">読み込み中...</div>
  if (cards.length === 0) return <div className="p-10 text-center">カードがありません</div>

  const currentCard = cards[currentIdx]

  return (
    <div className="min-h-screen bg-[#FFFDF0] p-4 flex flex-col items-center gap-8">
      {/* ヘッダー */}
      <div className="w-full flex justify-between items-center bg-yellow-400 p-4 rounded-2xl shadow-sm">
        <button onClick={() => router.back()} className="font-bold">← もどる</button>
        <span className="font-bold">{currentIdx + 1} / {cards.length}問目</span>
      </div>

      {/* 日本語ヒント */}
      <div className="text-center space-y-2">
        <p className="text-gray-400 text-sm">これなーんだ？</p>
        <h2 className="text-3xl font-bold text-gray-800">{currentCard.lang2}</h2>
      </div>

      {/* 回答エリア */}
      <div className="flex gap-2 min-h-[3rem] items-center border-b-4 border-yellow-200 pb-2 w-full justify-center">
        {answerChars.map((c, i) => (
          <span key={i} className="text-3xl font-bold text-indigo-600 animate-bounce">{c}</span>
        ))}
        {isCorrect && <span className="text-4xl">✅</span>}
      </div>

      {/* 選択肢（バラバラの文字） */}
      <div className="grid grid-cols-5 gap-3 mt-4">
        {shuffledChars.map((c, i) => (
          <button
            key={i}
            onClick={() => handleCharClick(c, i)}
            className="w-12 h-12 bg-white border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 rounded-xl text-xl font-bold text-gray-700 shadow-sm flex items-center justify-center transition-all"
          >
            {c}
          </button>
        ))}
      </div>

      {/* リセットボタン */}
      <button 
        onClick={() => initQuiz(currentCard.lang1)}
        className="mt-auto mb-10 text-gray-400 text-sm underline"
      >
        やりなおす
      </button>
    </div>
  )
}

export default function QuizPage() {
  return <Suspense><QuizContent /></Suspense>
}