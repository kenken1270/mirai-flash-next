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
  lang3_sub: string
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
  const setName = decodeURIComponent(searchParams.get('setName') ?? '')
  const startNo = Number(searchParams.get('start') ?? 1)
  const endNo   = Number(searchParams.get('end')   ?? 9999)

  const [username,   setUsername]   = useState('')
  const [queue,      setQueue]      = useState<Card[]>([])
  const [logs,       setLogs]       = useState<Map<number, ReviewLog>>(new Map())
  const [current,    setCurrent]    = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [phase,      setPhase]      = useState<'study'|'result'>('study')
  const [results,    setResults]    = useState<{card: Card; quality: number}[]>([])
  const [saving,     setSaving]     = useState(false)
  const [lang1Label, setLang1Label] = useState('おもて')
  const [lang2Label, setLang2Label] = useState('いみ')
  const [ttsLang1,   setTtsLang1]   = useState('en-US')
  const [ttsLang2,   setTtsLang2]   = useState('ja-JP')
  const [autoSpeak,  setAutoSpeak]  = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)

      let query = supabase.from('flashcards_v3')
        .select('id,item_no,lang1,lang1_sub,lang2,lang2_sub,lang3,lang3_sub,set_id')
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

      if (startNo > 1)   query = query.gte('item_no', startNo)
      if (endNo < 9999)  query = query.lte('item_no', endNo)

      const cardsRes = await query
      const logsRes  = await supabase.from('review_logs').select('*').eq('username', uname)
      const setRes   = await supabase.from('flashcard_sets')
        .select('lang1_label,lang2_label').eq('id', setId).limit(1)
      const userRes  = await supabase.from('users')
        .select('base_daily_limit').eq('username', uname).limit(1)

      const allCards: Card[]      = cardsRes.data ?? []
      const allLogs:  ReviewLog[] = logsRes.data  ?? []

      if (setRes.data?.[0]) {
        const s = setRes.data[0]
        setLang1Label(s.lang1_label ?? 'おもて')
        setLang2Label(s.lang2_label ?? 'いみ')
        const langMap: Record<string, string> = {
          '英語': 'en-US', '中国語': 'zh-CN', '日本語': 'ja-JP'
        }
        setTtsLang1(langMap[s.lang1_label] ?? 'en-US')
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

      setQueue(studyQueue)
      setLoading(false)
    }
    init()
  }, [setId, bookId, startNo, endNo, router])

  const speak = useCallback((text: string, lang: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang   = lang
    utter.rate   = 0.85
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
    if (saving) return
    setSaving(true)
    const card = queue[current]
    setResults(prev => [...prev, { card, quality }])

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

    const xpGain = quality >= 4 ? 5 : quality >= 3 ? 3 : 1
    const { data: userData } = await supabase.from('users')
      .select('current_points').eq('username', username).limit(1)
    if (userData?.[0]) {
      await supabase.from('users')
        .update({ current_points: (userData[0].current_points ?? 0) + xpGain })
        .eq('username', username)
    }

    if (current + 1 >= queue.length) {
      setPhase('result')
    } else {
      setCurrent(prev => prev + 1)
      setShowAnswer(false)
    }
    setSaving(false)
  }, [saving, queue, current, logs, username])

  // ローディング
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#FFFDF0]">
      <div className="text-5xl animate-bounce">🃏</div>
      <p className="text-gray-400">よみこみちゅう...</p>
    </div>
  )

  // カードが0件
  if (queue.length === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FFFDF0] px-6">
      <div className="text-6xl">🎉</div>
      <h2 className="text-2xl font-bold text-gray-700">今日の学習は完了！</h2>
      <p className="text-gray-400">また明日チャレンジしよう</p>
      <button onClick={() => router.back()}
        className="mt-4 px-6 py-3 bg-yellow-400 text-white rounded-full font-bold shadow">
        戻る
      </button>
    </div>
  )

  // 結果画面
  if (phase === 'result') {
    const perfect = results.filter(r => r.quality === 5).length
    const good    = results.filter(r => r.quality >= 3 && r.quality < 5).length
    const ng      = results.filter(r => r.quality < 3).length
    const total   = results.length
    const acc     = total > 0 ? Math.round(((perfect + good) / total) * 100) : 0

    const ngCards   = results.filter(r => r.quality < 3).map(r => r.card)
    const goodCards = results.filter(r => r.quality >= 3).map(r => r.card)

    return (
      <div className="min-h-screen bg-[#FFFDF0] pb-24">
        {/* ヘッダー */}
        <div className="bg-yellow-400 px-4 py-4 shadow sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-900 text-center">📊 学習結果</h1>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

          {/* スコアカード */}
          <div className="bg-white rounded-3xl shadow-md p-6 text-center border-2 border-yellow-200">
            <div className="text-6xl mb-2">{acc >= 80 ? '🏆' : acc >= 60 ? '👍' : '💪'}</div>
            <p className="text-5xl font-bold text-yellow-500">{acc}%</p>
            <p className="text-gray-400 mt-1 text-sm">{total}問中 {perfect + good}問 正解</p>

            {/* 内訳バッジ */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div className="bg-green-50 rounded-2xl p-3 border border-green-100">
                <p className="text-2xl font-bold text-green-500">{perfect}</p>
                <p className="text-xs text-gray-500 mt-1">🌟 バッチリ</p>
              </div>
              <div className="bg-yellow-50 rounded-2xl p-3 border border-yellow-100">
                <p className="text-2xl font-bold text-yellow-500">{good}</p>
                <p className="text-xs text-gray-500 mt-1">👌 なんとか</p>
              </div>
              <div className="bg-red-50 rounded-2xl p-3 border border-red-100">
                <p className="text-2xl font-bold text-red-400">{ng}</p>
                <p className="text-xs text-gray-500 mt-1">😅 もう一度</p>
              </div>
            </div>
          </div>

          {/* できなかった単語リスト */}
          {ngCards.length > 0 && (
            <div className="bg-white rounded-3xl shadow-md p-5 border-2 border-red-100">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-lg">😅</span> もう一度おぼえよう
                <span className="ml-auto bg-red-100 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full">{ngCards.length}語</span>
              </h3>
              <div className="space-y-2">
                {ngCards.map(card => (
                  <div key={card.id} className="flex items-center gap-3 bg-red-50 rounded-2xl px-4 py-3">
                    <span className="text-base font-bold text-gray-800 flex-1">{card.lang1}</span>
                    {card.lang1_sub && <span className="text-xs text-gray-400">{card.lang1_sub}</span>}
                    <span className="text-sm text-red-400 font-bold">{card.lang2}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* できた単語リスト */}
          {goodCards.length > 0 && (
            <div className="bg-white rounded-3xl shadow-md p-5 border-2 border-green-100">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-lg">✅</span> おぼえた単語
                <span className="ml-auto bg-green-100 text-green-600 text-xs font-bold px-2 py-0.5 rounded-full">{goodCards.length}語</span>
              </h3>
              <div className="space-y-2">
                {goodCards.map(card => (
                  <div key={card.id} className="flex items-center gap-3 bg-green-50 rounded-2xl px-4 py-3">
                    <span className="text-base font-bold text-gray-800 flex-1">{card.lang1}</span>
                    {card.lang1_sub && <span className="text-xs text-gray-400">{card.lang1_sub}</span>}
                    <span className="text-sm text-green-600 font-bold">{card.lang2}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 積み重ねメッセージ */}
          <div className="bg-yellow-50 rounded-3xl p-5 border-2 border-yellow-200 text-center">
            <p className="text-2xl mb-1">🐕</p>
            <p className="text-sm text-gray-600 font-bold">
              {acc >= 80
                ? 'すごい！この調子で続けよう！'
                : acc >= 60
                ? 'いい感じ！もう一回やると完璧だよ！'
                : '大丈夫！くり返せばかならず覚えられる！'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              今日 +{results.filter(r => r.quality >= 4).length * 5 + results.filter(r => r.quality === 3).length * 3 + results.filter(r => r.quality < 3).length} EXP 獲得！
            </p>
          </div>
        </div>

        {/* 下部ボタン */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex gap-3 max-w-lg mx-auto">
          <button onClick={() => router.back()}
            className="flex-1 py-3 bg-white border-2 border-gray-200 rounded-2xl font-bold text-gray-500 text-sm">
            一覧に戻る
          </button>
          <button onClick={() => { setCurrent(0); setShowAnswer(false); setPhase('study'); setResults([]) }}
            className="flex-1 py-3 bg-yellow-400 rounded-2xl font-bold text-gray-900 text-sm shadow">
            🔄 もう一度
          </button>
          <button onClick={() => router.push('/student')}
            className="flex-1 py-3 bg-gray-800 text-white rounded-2xl font-bold text-sm shadow">
            🏠 ホーム
          </button>
        </div>
      </div>
    )
  }

  // 学習画面
  const card     = queue[current]
  const progress = Math.round((current / queue.length) * 100)

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col">
      {/* ヘッダー */}
      <div className="bg-yellow-400 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow">
        <button onClick={() => router.back()} className="text-2xl">←</button>
        <div className="flex-1">
          <p className="text-xs text-yellow-800 opacity-80">
            {setName || (startNo > 1 || endNo < 9999 ? `${startNo}〜${endNo}番` : '単語学習')}
          </p>
          <p className="text-sm font-bold text-gray-900">{current + 1} / {queue.length}</p>
        </div>
        <button onClick={() => setAutoSpeak(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full border border-yellow-600 font-bold ${autoSpeak ? 'bg-yellow-600 text-white' : 'bg-white text-yellow-700'}`}>
          {autoSpeak ? '🔊 ON' : '🔇 OFF'}
        </button>
      </div>

      {/* プログレスバー */}
      <div className="w-full bg-yellow-100 h-2">
        <div className="bg-yellow-400 h-2 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* カード */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 gap-4">
        <div className="w-full max-w-lg">
          {/* 表面カード */}
          <div className="bg-white rounded-3xl shadow-lg border-2 border-yellow-100 p-8 min-h-[200px] flex flex-col items-center justify-center gap-3 relative">
            <span className="absolute top-4 left-5 text-xs text-gray-300 font-bold uppercase">{lang1Label}</span>
            <span className="absolute top-4 right-5 text-xs text-gray-200">No.{card.item_no}</span>
            <p className="text-4xl font-bold text-gray-800 text-center leading-snug">{card.lang1}</p>
            {card.lang1_sub && (
              <p className="text-base text-yellow-600 font-mono">{card.lang1_sub}</p>
            )}
            <button onClick={() => speak(card.lang1, ttsLang1)}
              className="mt-1 w-10 h-10 rounded-full bg-yellow-100 hover:bg-yellow-200 flex items-center justify-center transition">
              <span className="text-lg">🔊</span>
            </button>
          </div>

          {/* 答え表示エリア */}
          {showAnswer && (
            <div className="bg-yellow-50 rounded-3xl shadow border-2 border-yellow-200 p-6 mt-4 flex flex-col items-center gap-3">
              <span className="text-xs text-yellow-600 font-bold self-start">{lang2Label}</span>

              {/* 日本語訳 */}
              <div className="w-full bg-white rounded-2xl px-5 py-3 border border-yellow-100 text-center">
                <p className="text-xs text-gray-400 mb-1">🇯🇵 日本語</p>
                <p className="text-2xl font-bold text-gray-800">{card.lang2}</p>
              </div>
              {/* lang2_sub：中国語教材→中国語表示、英語/日本語教材→よみかた表示 */}
              {card.lang2_sub && (
                ttsLang1 === 'zh-CN'
                  ? <div className="w-full bg-red-50 rounded-2xl px-5 py-2 border border-red-100 text-center">
                      <p className="text-xs text-gray-400 mb-0.5">🇨🇳 中国語</p>
                      <p className="text-xl font-bold text-red-700">{card.lang2_sub}</p>
                    </div>
                  : <div className="w-full bg-yellow-50 rounded-2xl px-5 py-2 border border-yellow-100 text-center">
                      <p className="text-xs text-gray-400 mb-0.5">🔤 よみかた</p>
                      <p className="text-base text-yellow-700 font-mono tracking-wide">{card.lang2_sub}</p>
                    </div>
              )}

              {/* 中国語訳: lang3_subに入っている（英検4級・3級共通） */}
              {card.lang3_sub && ttsLang1 !== 'zh-CN' && (
                <div className="w-full bg-red-50 rounded-2xl px-5 py-2 border border-red-100 text-center">
                  <p className="text-xs text-gray-400 mb-0.5">🇨🇳 中国語</p>
                  <p className="text-xl font-bold text-red-700">{card.lang3_sub}</p>
                </div>
              )}

              {/* 例文 */}
              {card.lang3 && (
                <div className="bg-white/80 rounded-2xl px-4 py-2 w-full">
                  <p className="text-xs text-gray-400 mb-1">📝 例文</p>
                  <p className="text-sm text-gray-500 text-center italic">{card.lang3}</p>
                </div>
              )}
              <div className="flex gap-3 mt-1">
                <button onClick={() => speak(card.lang1, ttsLang1)}
                  className="flex items-center gap-1 px-4 py-2 bg-yellow-200 hover:bg-yellow-300 rounded-full text-sm font-bold text-yellow-800 transition">
                  🔊 {lang1Label}
                </button>
                <button onClick={() => speak(card.lang2, ttsLang2)}
                  className="flex items-center gap-1 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 rounded-full text-sm font-bold text-yellow-700 transition">
                  🔊 {lang2Label}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ボタンエリア */}
      <div className="px-4 pb-8 max-w-lg mx-auto w-full space-y-3">
        {!showAnswer ? (
          <button onClick={() => { setShowAnswer(true); speak(card.lang2, ttsLang2) }}
            className="w-full py-4 bg-yellow-400 text-gray-900 rounded-2xl font-bold text-xl shadow-lg hover:bg-yellow-500 transition">
            💡 こたえを見る
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-xs text-gray-400 font-bold mb-1">どのくらい覚えていた？</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { q: 5, label: '🌟 バッチリ！',    sub: '見た瞬間に答えが出てきた',  color: 'bg-green-400 hover:bg-green-500'  },
                { q: 3, label: '👌 なんとか…',     sub: '少し考えたら思い出せた',     color: 'bg-yellow-400 hover:bg-yellow-500'},
                { q: 1, label: '😓 むずかしい',    sub: 'かなり考えてやっと出てきた', color: 'bg-orange-400 hover:bg-orange-500'},
                { q: 0, label: '😅 わからなかった', sub: '全然思い出せなかった',       color: 'bg-red-400 hover:bg-red-500'     },
              ].map(({ q, label, sub, color }) => (
                <button key={q} onClick={() => handleQuality(q)} disabled={saving}
                  className={`${color} text-white py-3 rounded-2xl font-bold shadow transition disabled:opacity-50 flex flex-col items-center`}>
                  <span className="text-base">{label}</span>
                  <span className="text-xs opacity-80 font-normal mt-0.5">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function StudyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#FFFDF0]">
        <div className="text-5xl animate-bounce">🃏</div>
        <p className="text-gray-400">よみこみちゅう...</p>
      </div>
    }>
      <StudyContent />
    </Suspense>
  )
}
