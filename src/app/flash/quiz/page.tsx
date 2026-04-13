'use client'

import { useState, useEffect, useMemo, useCallback, Suspense, type FormEvent } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUsernameFromSession } from '@/lib/auth-user'
import { speechForQuizPrompt } from '@/lib/flash-kana-tts'

type Card = {
  id: number
  lang1: string
  lang2: string
  lang3: string
  lang3_sub?: string
  item_no: number
  set_id: number
}

type Strictness = 'strict' | 'normal' | 'loose'
type Direction = 'lang1to2' | 'lang2to1'
type QuizMode = 'choice' | 'typing'

function normalizeRomaji(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, '')
}

function normalizeKana(s: string) {
  return s.normalize('NFKC').trim()
}

function kanaToHira(s: string) {
  return [...normalizeKana(s)]
    .map((c) => {
      const cp = c.codePointAt(0)!
      if (cp >= 0x30a1 && cp <= 0x30f6) return String.fromCodePoint(cp - 0x60)
      return c
    })
    .join('')
}

function answersMatch(
  user: string,
  expected: string,
  strictness: Strictness,
  answerIsRomaji: boolean
): boolean {
  if (answerIsRomaji) {
    const u = normalizeRomaji(user)
    const e = normalizeRomaji(expected)
    if (strictness === 'strict') return u === e
    if (strictness === 'normal') {
      const parts = e.split(/[、,／/]/).map((p) => normalizeRomaji(p)).filter(Boolean)
      if (parts.some((p) => p === u)) return true
      return u === e
    }
    if (u === e) return true
    if (u.length >= 2 && (e.includes(u) || u.includes(e))) return true
    return false
  }

  const u = kanaToHira(normalizeKana(user))
  const e = kanaToHira(normalizeKana(expected))
  if (strictness === 'strict') return u === e
  if (strictness === 'normal') return u === e
  if (u === e) return true
  if (u.length >= 1 && e.length >= 1 && (e.includes(u) || u.includes(e))) return true
  return false
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildChoiceOptions(card: Card, pool: Card[], direction: Direction): string[] {
  const correct = direction === 'lang1to2' ? card.lang2 : card.lang1
  const key: 'lang1' | 'lang2' = direction === 'lang1to2' ? 'lang2' : 'lang1'
  const candidates = shuffle(
    pool.filter((c) => c.id !== card.id).map((c) => c[key]).filter((s) => s && s !== correct)
  )
  const pick: string[] = []
  let i = 0
  while (pick.length < 3) {
    if (candidates.length === 0) {
      pick.push(`(${pick.length + 1})`)
      continue
    }
    pick.push(candidates[i % candidates.length])
    i++
  }
  return shuffle([correct, ...pick.slice(0, 3)])
}

function QuizContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const bookId = parseInt(searchParams.get('book_id') ?? '0', 10)
  const setIdParam = parseInt(searchParams.get('id') ?? '0', 10)
  const itemStart = parseInt(searchParams.get('item_start') ?? searchParams.get('start') ?? '1', 10)
  const itemEnd = parseInt(searchParams.get('item_end') ?? searchParams.get('end') ?? '999999', 10)
  const questionCountParam = parseInt(searchParams.get('question_count') ?? '0', 10)
  const questionCountLimit =
    Number.isFinite(questionCountParam) && questionCountParam > 0 ? questionCountParam : 0
  const mode = (searchParams.get('mode') as QuizMode) || 'choice'
  const direction = (searchParams.get('direction') as Direction) || 'lang1to2'
  const strictness = (searchParams.get('strictness') as Strictness) || 'normal'
  const label1 = searchParams.get('lang1_label') || '問題'
  const label2 = searchParams.get('lang2_label') || '答え'
  const hidePrompt =
    searchParams.get('hide_prompt') === '1' || searchParams.get('hide_prompt') === 'true'

  const [resolvedLabels, setResolvedLabels] = useState<{ l1: string; l2: string }>({ l1: '', l2: '' })
  const [cards, setCards] = useState<Card[]>([])
  const [deck, setDeck] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [missCount, setMissCount] = useState(0)
  const [typingValue, setTypingValue] = useState('')
  const [shake, setShake] = useState(false)
  const [choiceOptions, setChoiceOptions] = useState<string[]>([])
  const [finishing, setFinishing] = useState(false)
  /** この問題で既にミスを1回カウントしたか（連打でミスが増えない） */
  const [hasMissedThisQuestion, setHasMissedThisQuestion] = useState(false)
  /** 正解演出中は操作を受け付けない */
  const [isResolving, setIsResolving] = useState(false)
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none')

  useEffect(() => {
    async function loadSetLabels() {
      if (setIdParam) {
        const { data } = await supabase
          .from('flashcard_sets')
          .select('lang1_label, lang2_label')
          .eq('id', setIdParam)
          .maybeSingle()
        if (data) setResolvedLabels({ l1: data.lang1_label ?? '', l2: data.lang2_label ?? '' })
        return
      }
      if (bookId) {
        const { data } = await supabase
          .from('flashcard_sets')
          .select('lang1_label, lang2_label')
          .eq('book_id', bookId)
          .limit(1)
          .maybeSingle()
        if (data) setResolvedLabels({ l1: data.lang1_label ?? '', l2: data.lang2_label ?? '' })
      }
    }
    void loadSetLabels()
  }, [bookId, setIdParam])

  useEffect(() => {
    async function fetchCards() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      let query = supabase
        .from('flashcards_v3')
        .select('id,lang1,lang2,lang3,lang3_sub,item_no,set_id')
        .order('item_no')

      if (bookId) {
        const { data: sets } = await supabase.from('flashcard_sets').select('id').eq('book_id', bookId)
        if (!sets?.length) {
          setCards([])
          setLoading(false)
          return
        }
        query = query.in(
          'set_id',
          sets.map((s: { id: number }) => s.id)
        )
      } else if (setIdParam) {
        query = query.eq('set_id', setIdParam)
      } else {
        setCards([])
        setLoading(false)
        return
      }

      query = query.gte('item_no', itemStart).lte('item_no', itemEnd)
      const { data } = await query
      const list = (data ?? []) as Card[]
      setCards(list)
      const shuffled = shuffle(list)
      const deckList =
        questionCountLimit > 0 ? shuffled.slice(0, Math.min(questionCountLimit, shuffled.length)) : shuffled
      setDeck(deckList)
      setLoading(false)
    }
    fetchCards()
  }, [bookId, setIdParam, itemStart, itemEnd, questionCountLimit, router])

  const current = deck[currentIdx]
  const total = deck.length

  useEffect(() => {
    if (!current || !cards.length) return
    if (mode === 'choice') setChoiceOptions(buildChoiceOptions(current, cards, direction))
    setTypingValue('')
    setHasMissedThisQuestion(false)
    setFeedback('none')
    setIsResolving(false)
  }, [current, cards, mode, direction, currentIdx])

  const effLang1 = resolvedLabels.l1 || label1 || '問題'
  const effLang2 = resolvedLabels.l2 || label2 || '答え'

  const promptPair = useMemo(() => {
    if (!current) return { prompt: '', answer: '', promptLabel: '', answerLabel: '' }
    if (direction === 'lang1to2') {
      return {
        prompt: current.lang1,
        answer: current.lang2,
        promptLabel: effLang1,
        answerLabel: effLang2,
      }
    }
    return {
      prompt: current.lang2,
      answer: current.lang1,
      promptLabel: effLang2,
      answerLabel: effLang1,
    }
  }, [current, direction, effLang1, effLang2])

  const answerIsRomaji = direction === 'lang2to1'

  const speak = useCallback((text: string, lang: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 0.85
    window.speechSynthesis.speak(u)
  }, [])

  const speakQuizPrompt = useCallback(() => {
    if (!current) return
    const { text, lang } = speechForQuizPrompt(current, direction, effLang1, effLang2)
    speak(text, lang)
  }, [current, direction, effLang1, effLang2, speak])

  const goToResult = useCallback(
    async (miss: number, correctTotal: number) => {
      if (finishing) return
      setFinishing(true)
      const { data: { session } } = await supabase.auth.getSession()
      const uname = session ? getUsernameFromSession(session) : ''
      const scorePct =
        total + miss > 0 ? Math.round((total / (total + miss)) * 100) : 0
      const stamp = miss <= 3

      let resolvedBookId = bookId
      if (!resolvedBookId && setIdParam) {
        const { data: setRow } = await supabase.from('flashcard_sets').select('book_id').eq('id', setIdParam).maybeSingle()
        if (setRow?.book_id) resolvedBookId = setRow.book_id
      }

      if (uname && resolvedBookId) {
        await supabase.from('quiz_results').insert({
          username: uname,
          book_id: resolvedBookId,
          score_pct: scorePct,
          miss_count: miss,
          total_count: total,
          correct_count: correctTotal,
          stamp_earned: stamp,
          taken_at: new Date().toISOString(),
        })
      }

      const q = new URLSearchParams({
        total: String(total),
        correct: String(correctTotal),
        miss: String(miss),
        score: String(scorePct),
        stamp: stamp ? 'true' : 'false',
        book_id: resolvedBookId ? String(resolvedBookId) : '',
        item_start: String(itemStart),
        item_end: String(itemEnd),
        mode,
        direction,
        strictness,
      })
      if (questionCountLimit > 0) q.set('question_count', String(questionCountLimit))
      if (hidePrompt) q.set('hide_prompt', '1')
      router.push('/flash/quiz/result?' + q.toString())
    },
    [
      finishing,
      total,
      bookId,
      setIdParam,
      itemStart,
      itemEnd,
      questionCountLimit,
      mode,
      direction,
      strictness,
      hidePrompt,
      router,
    ]
  )

  const handleChoice = (picked: string) => {
    if (!current || isResolving) return
    const ok = answersMatch(picked, promptPair.answer, strictness, answerIsRomaji)
    if (ok) {
      setIsResolving(true)
      setFeedback('correct')
      const idx = currentIdx
      const misses = missCount
      window.setTimeout(() => {
        setFeedback('none')
        setIsResolving(false)
        if (idx + 1 >= deck.length) {
          void goToResult(misses, total)
        } else {
          setCurrentIdx((i) => i + 1)
        }
      }, 850)
    } else {
      if (!hasMissedThisQuestion) {
        setMissCount((m) => m + 1)
        setHasMissedThisQuestion(true)
      }
      setFeedback('wrong')
      setShake(true)
      window.setTimeout(() => {
        setShake(false)
        setFeedback('none')
      }, 550)
    }
  }

  const handleTypingSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!current || isResolving) return
    const ok = answersMatch(typingValue, promptPair.answer, strictness, answerIsRomaji)
    if (ok) {
      setIsResolving(true)
      setFeedback('correct')
      const idx = currentIdx
      const misses = missCount
      window.setTimeout(() => {
        setFeedback('none')
        setIsResolving(false)
        if (idx + 1 >= deck.length) {
          void goToResult(misses, total)
        } else {
          setCurrentIdx((i) => i + 1)
        }
      }, 850)
    } else {
      if (!hasMissedThisQuestion) {
        setMissCount((m) => m + 1)
        setHasMissedThisQuestion(true)
      }
      setFeedback('wrong')
      setShake(true)
      window.setTimeout(() => {
        setShake(false)
        setFeedback('none')
      }, 550)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0]">読み込み中...</div>
  if (!bookId && !setIdParam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FFFDF0] p-6">
        <p className="text-gray-600 text-center">教材（book_id）またはセット（id）が指定されていません。</p>
        <button type="button" onClick={() => router.push('/student/test')} className="text-indigo-600 font-bold">
          小テストへ
        </button>
      </div>
    )
  }
  if (!current || total === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FFFDF0] p-6">
        <p className="text-gray-600">この範囲にカードがありません。</p>
        <button type="button" onClick={() => router.back()} className="text-indigo-600 font-bold">
          もどる
        </button>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[#FFFDF0] p-4 flex flex-col items-center gap-6 pb-16">
      {feedback === 'correct' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-emerald-400/25" aria-hidden />
          <div className="relative flex animate-bounce flex-col items-center gap-2 rounded-3xl border-4 border-emerald-400 bg-white px-10 py-8 shadow-2xl">
            <span className="text-7xl leading-none drop-shadow-md" aria-hidden>
              🌟
            </span>
            <span className="text-3xl font-black tracking-tight text-emerald-600">せいかい！</span>
            <span className="text-sm font-bold text-emerald-700/90">すばらしい！</span>
          </div>
        </div>
      )}
      {feedback === 'wrong' && (
        <div
          className="fixed top-20 left-1/2 z-40 -translate-x-1/2 rounded-2xl border-2 border-red-400 bg-red-50 px-6 py-3 shadow-lg"
          role="status"
        >
          <p className="flex items-center gap-2 text-lg font-black text-red-600">
            <span className="text-2xl" aria-hidden>
              ✗
            </span>
            ちがうよ
          </p>
          <p className="text-center text-xs font-bold text-red-500/90">もういちど えらんでね</p>
        </div>
      )}
      <div className="w-full max-w-lg flex justify-between items-center bg-yellow-400 p-4 rounded-2xl shadow-sm">
        <button type="button" onClick={() => router.back()} className="font-bold text-gray-900">
          ← もどる
        </button>
        <span className="font-bold text-gray-900">
          {currentIdx + 1} / {total} 問　ミス {missCount}
        </span>
      </div>

      <div
        className={`text-center space-y-2 w-full max-w-lg transition rounded-2xl px-2 py-1
          ${shake ? 'animate-pulse ring-4 ring-red-300/80' : ''}
          ${feedback === 'correct' ? 'ring-4 ring-emerald-400 shadow-lg shadow-emerald-200/50' : ''}`}
      >
        <p className="text-gray-500 text-sm">
          {mode === 'choice' && hidePrompt ? '音声' : promptPair.promptLabel}
        </p>
        <div className="flex flex-col items-center gap-2">
          {mode === 'choice' && hidePrompt ? (
            <div className="min-h-[5rem] w-full max-w-sm flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/80 px-4 py-3">
              <span className="text-sm font-bold text-amber-800/90">問題の文字は非表示です</span>
              <span className="text-xs text-amber-700/80">「きく」だけで聞いて答えよう</span>
            </div>
          ) : (
            <h2 className="text-3xl md:text-4xl font-black text-gray-800 break-all px-2">{promptPair.prompt}</h2>
          )}
          <button
            type="button"
            onClick={speakQuizPrompt}
            disabled={isResolving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-yellow-100 hover:bg-yellow-200 text-sm font-bold text-yellow-900 border border-yellow-200 disabled:opacity-40 disabled:pointer-events-none"
            title="ローマ字教材はかなの読みで再生します"
          >
            🔊 きく
          </button>
        </div>
        {!(mode === 'choice' && hidePrompt) && <p className="text-xs text-gray-400">{current.lang3}</p>}
      </div>

      {mode === 'choice' && (
        <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
          {choiceOptions.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={isResolving}
              onClick={() => handleChoice(opt)}
              className="min-h-[3.5rem] px-3 py-3 bg-white border-b-4 border-gray-200 rounded-xl text-lg md:text-xl font-bold text-gray-800 shadow-sm active:border-b-0 active:translate-y-1 disabled:opacity-40 disabled:pointer-events-none disabled:active:translate-y-0"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {mode === 'typing' && (
        <form onSubmit={handleTypingSubmit} className="w-full max-w-lg space-y-4">
          <label className="block text-sm text-gray-600 font-bold">{promptPair.answerLabel}を入力</label>
          <input
            value={typingValue}
            onChange={(e) => setTypingValue(e.target.value)}
            readOnly={isResolving}
            autoComplete="off"
            className="w-full text-2xl px-4 py-3 rounded-xl border-2 border-yellow-200 focus:border-yellow-400 outline-none read-only:bg-gray-50"
            placeholder="ここに入力"
          />
          <button
            type="submit"
            disabled={isResolving}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-md disabled:opacity-40"
          >
            答え合わせ
          </button>
        </form>
      )}

      <p className="text-xs text-gray-400 max-w-lg text-center">
        {mode === 'choice' ? '四択' : '入力'}
        {mode === 'choice' && hidePrompt ? '・音声のみ' : ''}・
        {direction === 'lang1to2' ? `${effLang1}→${effLang2}` : `${effLang2}→${effLang1}`}・
        {strictness === 'strict' ? '厳密' : strictness === 'normal' ? '標準' : 'ゆるめ'}
      </p>
    </div>
  )
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FFFDF0]">読み込み中...</div>}>
      <QuizContent />
    </Suspense>
  )
}
