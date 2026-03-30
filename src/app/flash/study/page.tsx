'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Card = {
  id: number
  item_no: number
  lang1: string
  lang1_sub: string
  lang2: string
  lang2_sub: string
  lang3: string
  tts_lang1: string
  tts_lang2: string
  hint: string
  set_id: number
}

type ReviewLog = {
  flashcard_id: number
  ease_factor: number
  interval_days: number
  repetitions: number
  next_review_date: string
  quality: number
}

function sm2Update(quality: number, ef: number, interval: number, reps: number) {
  let newReps = reps
  let newInterval = interval
  if (quality < 3) {
    newReps = 0
    newInterval = 1
  } else {
    if (reps === 0) newInterval = 1
    else if (reps === 1) newInterval = 6
    else newInterval = Math.round(interval * ef)
    newReps = reps + 1
  }
  let newEf = ef + (0.1 - (5 - quality) * (0.08 + 0.02 * (5 - quality)))
  newEf = Math.max(1.3, newEf)
  const nextDate = new Date(Date.now() + newInterval * 86400000).toISOString().split('T')[0]
  return { newEf, newInterval, newReps, nextDate }
}

function StudyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setId    = Number(searchParams.get('id') ?? searchParams.get('setId'))
  const setName  = decodeURIComponent(searchParams.get('setName') ?? '単語学習')
  const startNo  = parseInt(searchParams.get('start') ?? '1')
  const endNo    = parseInt(searchParams.get('end')   ?? '9999')

  const [username,   setUsername]   = useState('')
  const [queue,      setQueue]      = useState<Card[]>([])
  const [logs,       setLogs]       = useState<Map<number, ReviewLog>>(new Map())
  const [current,    setCurrent]    = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [phase,      setPhase]      = useState<'study'|'result'>('study')
  const [results,    setResults]    = useState<{card: Card; quality: number}[]>([])
  const [saving,     setSaving]     = useState(false)
  const [lang1Label, setLang1Label] = useState('表面')
  const [lang2Label, setLang2Label] = useState('意味')
  const [ttsLang1,   setTtsLang1]   = useState('en-US')
  const [ttsLang2,   setTtsLang2]   = useState('ja-JP')
  const [autoSpeak,  setAutoSpeak]  = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal','') ?? ''
      setUsername(uname)

      let query = supabase.from('flashcards_v3')
        .select('id,item_no,lang1,lang1_sub,lang2,lang2_sub,lang3,tts_lang1,tts_lang2,hint,set_id')
        .eq('set_id', setId)
        .order('item_no')
      if (startNo > 1)    query = query.gte('item_no', startNo)
      if (endNo < 9999)   query = query.lte('item_no', endNo)

      const [cardsRes, logsRes, setRes, userRes] = await Promise.all([
        query,
        supabase.from('review_logs').select('*').eq('username', uname),
        supabase.from('flashcard_sets').select('lang1_label,lang2_label,lang1_tts_lang,lang2_tts_lang,tts_lang').eq('id', setId).limit(1),
        supabase.from('users').select('base_daily_limit,lang').eq('username', uname).limit(1),
      ])

      const allCards: Card[] = cardsRes.data ?? []
      const allLogs: ReviewLog[] = logsRes.data ?? []

      if (setRes.data?.[0]) {
        const s = setRes.data[0]
        setLang1Label(s.lang1_label ?? '表面')
        setLang2Label(s.lang2_label ?? '意味')
        setTtsLang1(s.lang1_tts_lang ?? s.tts_lang ?? 'en-US')
        setTtsLang2(s.lang2_tts_lang ?? 'ja-JP')
      }

      const logMap = new Map<number, ReviewLog>()
      for (const log of allLogs) logMap.set(log.flashcard_id, log)
      setLogs(logMap)

      const today = new Date().toISOString().split('T')[0]
      const limit = userRes.data?.[0]?.base_daily_limit ?? 20

      let studyQueue: Card[]
      if (startNo > 1 || endNo < 9999) {
        studyQueue = [...allCards].sort(() => Math.random() - 0.5)
      } else {
        const newCards  = allCards.filter(c => !logMap.has(c.id)).slice(0, limit)
        const dueCards  = allCards.filter(c => {
          const log = logMap.get(c.id)
          return log && log.next_review_date <= today
        })
        studyQueue = [...newCards, ...dueCards].sort(() => Math.random() - 0.5)
      }

      setQueue(studyQueue)
      setLoading(false)
    }
    init()
  }, [setId, startNo, endNo, router])

  const speak = useCallback((text: string, lang: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang  = lang
    utter.rate  = 0.85
    utter.volume = 1.0
    window.speechSynthesis.speak(utter)
  }, [])

  // カードが変わったら自動で lang1 を読み上げ
  useEffect(() => {
    if (!loading && autoSpeak && queue.length > 0 && !showAnswer && phase === 'study') {
      const card = queue[current]
      if (card) {
        const t = setTimeout(() => speak(card.lang1, card.tts_lang1 || ttsLang1), 400)
        return () => clearTimeout(t)
      }
    }
  }, [current, loading, showAnswer, phase, autoSpeak])

  async function saveReview(card: Card, quality: number) {
    const existing  = logs.get(card.id)
    const ef        = existing?.ease_factor    ?? 2.5
    const interval  = existing?.interval_days  ?? 1
    const reps      = existing?.repetitions    ?? 0
    const { newEf, newInterval, newReps, nextDate } = sm2Update(quality, ef, interval, reps)

    const data = {
      username,
      flashcard_id: card.id,
      quality,
      ease_factor:      newEf,
      interval_days:    newInterval,
      repetitions:      newReps,
      next_review_date: nextDate,
    }
    if (existing) {
      await supabase.from('review_logs').update(data).eq('username', username).eq('flashcard_id', card.id)
    } else {
      await supabase.from('review_logs').insert(data)
    }
    const xpGain = quality >= 4 ? 5 : quality >= 3 ? 3 : 1
    const { data: userData } = await supabase.from('users').select('current_points').eq('username', username).limit(1)
    if (userData?.[0]) {
      await supabase.from('users').update({ current_points: (userData[0].current_points ?? 0) + xpGain }).eq('username', username)
    }
  }

  async function handleQuality(quality: number) {
    if (saving) return
    setSaving(true)
    const card = queue[current]
    setResults(prev => [...prev, { card, quality }])
    await saveReview(card, quality)
    if (current + 1 >= queue.length) {
      setPhase('result')
    } else {
      setCurrent(prev => prev + 1)
      setShowAnswer(false)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-5xl animate-bounce">🃏</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  if (queue.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
      <div className="text-6xl">🎉</div>
      <h2 className="text-xl font-bold text-gray-700">今日の学習は完了！</h2>
      <p className="text-gray-400 text-center">また明日チャレンジしよう</p>
      <button onClick={() => router.back()}
        className="px-6 py-3 bg-indigo-500 text-white rounded-2xl font-bold hover:bg-indigo-600 transition">
        ← 戻る
      </button>
    </div>
  )

  // 結果画面
  if (phase === 'result') {
    const perfect = results.filter(r => r.quality === 5).length
    const good    = results.filter(r => r.quality === 4).length
    const ok      = results.filter(r => r.quality === 3).length
    const ng      = results.filter(r => r.quality  < 3).length
    const total   = results.length
    const acc     = total > 0 ? Math.round(((perfect + good + ok) / total) * 100) : 0
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 flex flex-col items-center justify-center px-6 gap-6">
        <div className="text-6xl">{acc >= 80 ? '🏆' : acc >= 60 ? '👍' : '💪'}</div>
        <h2 className="text-2xl font-bold text-gray-800">学習完了！</h2>
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-sm space-y-3">
          <div className="text-center">
            <p className="text-4xl font-bold text-indigo-600">{acc}%</p>
            <p className="text-sm text-gray-400 mt-1">正解率（{total}問）</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div className="bg-green-50 rounded-xl p-2"><p className="font-bold text-green-600">{perfect}</p><p className="text-xs text-gray-400">完璧</p></div>
            <div className="bg-blue-50 rounded-xl p-2"><p className="font-bold text-blue-600">{good}</p><p className="text-xs text-gray-400">正解</p></div>
            <div className="bg-yellow-50 rounded-xl p-2"><p className="font-bold text-yellow-600">{ok}</p><p className="text-xs text-gray-400">まあまあ</p></div>
            <div className="bg-red-50 rounded-xl p-2"><p className="font-bold text-red-600">{ng}</p><p className="text-xs text-gray-400">要復習</p></div>
          </div>
        </div>
        <div className="flex gap-3 w-full max-w-sm">
          <button onClick={() => router.back()}
            className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition">
            ← 戻る
          </button>
          <button onClick={() => { setCurrent(0); setShowAnswer(false); setPhase('study'); setResults([]) }}
            className="flex-1 py-3 bg-indigo-500 text-white rounded-2xl font-bold hover:bg-indigo-600 transition">
            🔁 もう一度
          </button>
        </div>
      </div>
    )
  }

  const card = queue[current]
  const progress = ((current) / queue.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 flex flex-col">

      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs opacity-80">
              {startNo === 1 && endNo === 9999 ? setName : `${startNo}〜${endNo}番 | ${setName}`}
            </span>
            <div className="flex items-center gap-3">
              {/* 自動読み上げトグル */}
              <button onClick={() => setAutoSpeak(v => !v)}
                className={`text-xs px-2 py-1 rounded-full transition ${autoSpeak ? 'bg-white/30' : 'bg-white/10 opacity-60'}`}>
                {autoSpeak ? '🔊 自動ON' : '🔇 自動OFF'}
              </button>
              <button onClick={() => router.back()}
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition">
                中断
              </button>
            </div>
          </div>
          {/* プログレスバー */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/30 rounded-full h-2">
              <div className="bg-yellow-300 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-bold">{current + 1}/{queue.length}</span>
          </div>
        </div>
      </header>

      {/* カードエリア */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4">
        <div className="w-full max-w-lg">

          {/* 問題カード */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 min-h-[220px] flex flex-col items-center justify-center gap-3 relative">

            {/* 問題ラベル */}
            <span className="absolute top-4 left-5 text-xs text-gray-400 font-bold">{lang1Label}</span>

            {/* 番号 */}
            <span className="absolute top-4 right-5 text-xs text-gray-300">No.{card.item_no}</span>

            {/* 単語 */}
            <p className="text-4xl font-bold text-gray-800 text-center leading-tight">{card.lang1}</p>

            {/* 発音記号 */}
            {card.lang1_sub && (
              <p className="text-base text-indigo-400 font-mono">{card.lang1_sub}</p>
            )}

            {/* ヒント */}
            {card.hint && (
              <span className="text-xs bg-amber-50 text-amber-500 px-3 py-1 rounded-full border border-amber-200">
                💡 {card.hint}
              </span>
            )}

            {/* 🔊 問題面の音声ボタン */}
            <button
              onClick={() => speak(card.lang1, card.tts_lang1 || ttsLang1)}
              className="mt-2 w-12 h-12 rounded-full bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center transition shadow-sm">
              <span className="text-xl">🔊</span>
            </button>
          </div>

          {/* 答えカード */}
          {showAnswer && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl shadow-lg border border-purple-100 p-6 mt-4 flex flex-col items-center gap-3">

              <span className="text-xs text-purple-400 font-bold self-start">{lang2Label}</span>

              {/* 意味 */}
              <p className="text-2xl font-bold text-gray-800 text-center">{card.lang2}</p>

              {/* 読み仮名 */}
              {card.lang2_sub && (
                <p className="text-sm text-purple-400">{card.lang2_sub}</p>
              )}

              {/* 例文 */}
              {card.lang3 && (
                <div className="bg-white/70 rounded-2xl px-4 py-2 w-full">
                  <p className="text-sm text-gray-600 text-center">{card.lang3}</p>
                </div>
              )}

              {/* 🔊 答え面の音声ボタン群 */}
              <div className="flex gap-3 mt-1">
                <button
                  onClick={() => speak(card.lang1, card.tts_lang1 || ttsLang1)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 rounded-full transition text-sm font-bold text-indigo-600">
                  🔊 {lang1Label}
                </button>
                <button
                  onClick={() => speak(card.lang2, card.tts_lang2 || ttsLang2)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-100 hover:bg-purple-200 rounded-full transition text-sm font-bold text-purple-600">
                  🔊 {lang2Label}
                </button>
              </div>

            </div>
          )}

          {/* ヒントテキスト */}
          {!showAnswer && (
            <p className="text-center text-xs text-gray-400 mt-4">
              💭 意味を頭に思い浮かべてから押してね
            </p>
          )}
        </div>
      </div>

      {/* ボタンエリア */}
      <div className="px-4 pb-8 max-w-lg mx-auto w-full space-y-3">
        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 transition">
            🔍 答えを見る
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-xs text-gray-400 font-bold">どのくらい覚えていた？</p>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => handleQuality(5)} disabled={saving}
                className="py-3.5 bg-green-500 text-white rounded-2xl font-bold hover:bg-green-600 transition disabled:opacity-50 flex flex-col items-center">
                <span className="text-base">⚡ すぐにわかった</span>
                <span className="text-xs opacity-80 font-normal mt-0.5">見た瞬間に意味が出てきた</span>
              </button>
              <button onClick={() => handleQuality(4)} disabled={saving}
                className="py-3.5 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition disabled:opacity-50 flex flex-col items-center">
                <span className="text-base">🤔 少し考えたらわかった</span>
                <span className="text-xs opacity-80 font-normal mt-0.5">数秒考えれば思い出せた</span>
              </button>
              <button onClick={() => handleQuality(3)} disabled={saving}
                className="py-3.5 bg-yellow-500 text-white rounded-2xl font-bold hover:bg-yellow-600 transition disabled:opacity-50 flex flex-col items-center">
                <span className="text-base">😓 時間がかかった</span>
                <span className="text-xs opacity-80 font-normal mt-0.5">かなり考えてやっと思い出した</span>
              </button>
              <button onClick={() => handleQuality(0)} disabled={saving}
                className="py-3.5 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition disabled:opacity-50 flex flex-col items-center">
                <span className="text-base">❌ 思い出せなかった</span>
                <span className="text-xs opacity-80 font-normal mt-0.5">わからなかった・覚えていなかった</span>
              </button>
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-5xl animate-bounce">🃏</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <StudyContent />
    </Suspense>
  )
}