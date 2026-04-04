'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Card = {
  id: number
  item_no: number
  lang1: string
  lang1_sub: string
  lang2: string
  lang2_sub: string
  lang3: string
  set_id: number
}

type ReviewLog = {
  flashcard_id: number
  quality: number
  ease_factor: number
  interval_days: number
  repetitions: number
  next_review_date: string
}

function sm2Update(log: ReviewLog | undefined, quality: number): ReviewLog {
  const ef  = Math.max(1.3, (log?.ease_factor ?? 2.5) + 0.1 - (5 - quality) * 0.18)
  const rep = quality >= 3 ? (log?.repetitions ?? 0) + 1 : 0
  const iv  = rep <= 1 ? 1 : rep === 2 ? 6 : Math.round((log?.interval_days ?? 1) * ef)
  const next = new Date()
  next.setDate(next.getDate() + iv)
  return {
    flashcard_id: log?.flashcard_id ?? 0,
    quality,
    ease_factor: ef,
    interval_days: iv,
    repetitions: rep,
    next_review_date: next.toISOString().split('T')[0],
  }
}

function StudyContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const setId   = Number(searchParams.get('id') ?? searchParams.get('setId') ?? 0)
  const bookId  = Number(searchParams.get('bookId') ?? 0)
  const startNo = Number(searchParams.get('start') ?? 1)
  const endNo   = Number(searchParams.get('end')   ?? 9999)

  const [username,    setUsername]    = useState('')
  const [queue,       setQueue]       = useState<Card[]>([])
  const [logs,        setLogs]        = useState<Map<number, ReviewLog>>(new Map())
  const [current,     setCurrent]     = useState(0)
  const [showAnswer,  setShowAnswer]  = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [phase,       setPhase]       = useState<'study'|'result'>('study')
  const [results,     setResults]     = useState<{card: Card; quality: number}[]>([])
  const [saving,      setSaving]      = useState(false)
  const [lang1Label,  setLang1Label]  = useState('おもて')
  const [lang2Label,  setLang2Label]  = useState('いみ')
  const [ttsLang1,    setTtsLang1]    = useState('en-US')
  const [ttsLang2,    setTtsLang2]    = useState('ja-JP')
  const [autoSpeak,   setAutoSpeak]   = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)

      let query = supabase.from('flashcards_v3')
        .select('id,item_no,lang1,lang1_sub,lang2,lang2_sub,lang3,set_id')
        .order('item_no')

      if (bookId) {
        const { data: sets } = await supabase
          .from('flashcard_sets').select('id').eq('book_id', bookId)
        if (sets && sets.length > 0) {
          query = query.in('set_id', sets.map((s: { id: number }) => s.id))
        }
      } else if (setId) {
        query = query.eq('set_id', setId)
      }

      if (startNo > 1)    query = query.gte('item_no', startNo)
      if (endNo  < 9999)  query = query.lte('item_no', endNo)

      const cardsRes = await query
      const logsRes  = await supabase.from('review_logs').select('*').eq('username', uname)
      const setRes   = await supabase.from('flashcard_sets')
        .select('lang1_label,lang2_label')
        .eq('id', setId).limit(1)
      const userRes  = await supabase.from('users')
        .select('base_daily_limit').eq('username', uname).limit(1)

      console.log('cardsRes:', cardsRes.data?.length, cardsRes.error?.message)
      console.log('logsRes:',  logsRes.data?.length,  logsRes.error?.message)
      console.log('setRes:',   setRes.data,            setRes.error?.message)
      console.log('userRes:',  userRes.data,           userRes.error?.message)

      const allCards: Card[]      = cardsRes.data ?? []
      const allLogs:  ReviewLog[] = logsRes.data  ?? []

      if (setRes.data?.[0]) {
        const s = setRes.data[0]
        setLang1Label(s.lang1_label ?? 'おもて')
        setLang2Label(s.lang2_label ?? 'いみ')
      }

      const langMap: Record<string, string> = {
        '英語': 'en-US', '中国語': 'zh-CN', '日本語': 'ja-JP'
      }
      if (setRes.data?.[0]?.lang1_label) {
        setTtsLang1(langMap[setRes.data[0].lang1_label] ?? 'en-US')
      }

      const logMap = new Map<number, ReviewLog>()
      for (const log of allLogs) logMap.set(log.flashcard_id, log)
      setLogs(logMap)

      const today = new Date().toISOString().split('T')[0]
      const limit = userRes.data?.[0]?.base_daily_limit ?? 20

      let studyQueue: Card[]
      if (startNo > 1 || endNo < 9999 || bookId) {
        studyQueue = [...allCards].sort(() => Math.random() - 0.5)
      } else {
        const newCards = allCards.filter(c => !logMap.has(c.id)).slice(0, limit)
        const dueCards = allCards.filter(c => {
          const log = logMap.get(c.id)
          return log && log.next_review_date <= today
        })
        studyQueue = [...newCards, ...dueCards].sort(() => Math.random() - 0.5)
        if (studyQueue.length === 0) {
          studyQueue = [...allCards].sort(() => Math.random() - 0.5)
        }
      }

      console.log('DEBUG allCards:', allCards.length, 'studyQueue:', studyQueue.length)
      setQueue(studyQueue)
      setLoading(false)
    }
    init()
  }, [setId, bookId, startNo, endNo, router])

  const speak = useCallback((text: string, lang: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    utter.rate = 0.85
    utter.volume = 1.0
    window.speechSynthesis.speak(utter)
  }, [])

  useEffect(() => {
    if (!loading && autoSpeak && queue.length > 0 && !showAnswer && phase === 'study') {
      const card = queue[current]
      if (card) {
        const t = setTimeout(() => speak(card.lang1, ttsLang1), 400)
        return () => clearTimeout(t)
      }
    }
  }, [current, loading, autoSpeak, showAnswer, phase, queue, speak, ttsLang1])

  const handleQuality = useCallback(async (quality: number) => {
    const card = queue[current]
    if (!card) return
    setResults(prev => [...prev, { card, quality }])
    const next = current + 1
    if (next >= queue.length) {
      setPhase('result')
    } else {
      setCurrent(next)
      setShowAnswer(false)
    }
  }, [queue, current])

  const saveResults = useCallback(async () => {
    if (saving || !username) return
    setSaving(true)
    for (const { card, quality } of results) {
      const existing = logs.get(card.id)
      const updated  = sm2Update(existing ? { ...existing, flashcard_id: card.id } : undefined, quality)
      await supabase.from('review_logs').upsert({
        username,
        flashcard_id:     card.id,
        quality:          updated.quality,
        ease_factor:      updated.ease_factor,
        interval_days:    updated.interval_days,
        repetitions:      updated.repetitions,
        next_review_date: updated.next_review_date,
        reviewed_at:      new Date().toISOString(),
      }, { onConflict: 'username,flashcard_id' })
    }
    const good = results.filter(r => r.quality >= 3).length
    const exp  = good * 10
    await supabase.from('users')
      .update({ exp: exp })
      .eq('username', username)
    setSaving(false)
    router.push('/student')
  }, [saving, username, results, logs, router])

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="text-5xl animate-bounce">🃏</div>
      <p className="text-gray-400">よみこみちゅう...</p>
    </div>
  )

  if (queue.length === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FFFDF0]">
      <div className="text-6xl">🎉</div>
      <h2 className="text-2xl font-bold text-gray-700">今日の学習は完了！</h2>
      <p className="text-gray-400">また明日チャレンジしよう</p>
      <button onClick={() => router.back()}
        className="mt-4 px-6 py-3 bg-purple-500 text-white rounded-full font-bold">
        戻る
      </button>
    </div>
  )

  if (phase === 'result') {
    const good = results.filter(r => r.quality >= 3).length
    const pct  = Math.round(good / results.length * 100)
    return (
      <div className="min-h-screen bg-[#FFFDF0] flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-6xl">{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
        <h2 className="text-2xl font-bold">結果発表</h2>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow text-center">
          <p className="text-4xl font-bold text-yellow-500">{pct}%</p>
          <p className="text-gray-500 mt-2">{good} / {results.length} 正解</p>
        </div>
        <button onClick={saveResults} disabled={saving}
          className="px-8 py-3 bg-yellow-400 rounded-full font-bold text-lg shadow">
          {saving ? '保存中...' : '結果を保存して終わる'}
        </button>
        <button onClick={() => { setCurrent(0); setShowAnswer(false); setPhase('study'); setResults([]) }}
          className="px-8 py-3 bg-white border-2 border-yellow-400 rounded-full font-bold text-lg">
          もう一度
        </button>
        <button onClick={() => router.back()}
          className="text-gray-400 underline text-sm">一覧に戻る</button>
      </div>
    )
  }

  const card = queue[current]
  const progress = Math.round((current / queue.length) * 100)

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col">
      {/* ヘッダー */}
      <div className="bg-yellow-400 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow">
        <button onClick={() => router.back()} className="text-2xl">←</button>
        <h1 className="text-lg font-bold flex-1">🃏 単語学習</h1>
        <span className="text-sm font-bold">{current + 1} / {queue.length}</span>
        <button onClick={() => setAutoSpeak(v => !v)}
          className={`text-sm px-2 py-1 rounded-full border ${autoSpeak ? 'bg-white' : 'bg-yellow-200'}`}>
          {autoSpeak ? '🔊 ON' : '🔇 OFF'}
        </button>
      </div>

      {/* プログレスバー */}
      <div className="w-full bg-gray-200 h-2">
        <div className="bg-yellow-400 h-2 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* カード */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="bg-white rounded-3xl shadow-lg w-full max-w-sm p-8 flex flex-col items-center gap-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest">{lang1Label}</p>
          <p className="text-4xl font-bold text-center text-gray-800">{card.lang1}</p>
          {card.lang1_sub && (
            <p className="text-lg text-gray-500">{card.lang1_sub}</p>
          )}
        </div>

        {!showAnswer ? (
          <button onClick={() => { setShowAnswer(true); speak(card.lang2, ttsLang2) }}
            className="w-full max-w-sm py-4 bg-yellow-400 rounded-2xl font-bold text-xl shadow">
            こたえを見る
          </button>
        ) : (
          <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="bg-yellow-50 rounded-3xl shadow p-6 flex flex-col items-center gap-2">
              <p className="text-xs text-gray-400 uppercase tracking-widest">{lang2Label}</p>
              <p className="text-3xl font-bold text-center text-gray-800">{card.lang2}</p>
              {card.lang2_sub && <p className="text-base text-gray-500">{card.lang2_sub}</p>}
              {card.lang3    && <p className="text-sm text-gray-400 italic mt-2">{card.lang3}</p>}
            </div>
            <p className="text-center text-sm text-gray-500 font-bold">どのくらい覚えていた？</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { q: 5, label: 'バッチリ！',   color: 'bg-green-400'  },
                { q: 3, label: 'なんとか…',    color: 'bg-yellow-400' },
                { q: 1, label: 'むずかしい',   color: 'bg-orange-400' },
                { q: 0, label: 'わからない',   color: 'bg-red-400'    },
              ].map(({ q, label, color }) => (
                <button key={q} onClick={() => handleQuality(q)}
                  className={`${color} text-white py-3 rounded-2xl font-bold text-lg shadow`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 下部ナビ */}
      <div className="p-4 flex gap-3">
        <button onClick={() => router.back()}
          className="flex-1 py-3 bg-white border-2 border-gray-200 rounded-2xl font-bold text-gray-500">
          一覧に戻る
        </button>
      </div>
    </div>
  )
}

export default function StudyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-5xl animate-bounce">🃏</div>
        <p className="text-gray-400">よみこみちゅう...</p>
      </div>
    }>
      <StudyContent />
    </Suspense>
  )
}