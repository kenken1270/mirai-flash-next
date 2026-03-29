'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadFlashCardSet, loadFlashCardsV3 } from '@/lib/student'
import type { FlashCardSet, FlashCardV3 } from '@/lib/student'

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
  const setId = Number(searchParams.get('setId'))
  const setName = searchParams.get('setName') ?? '単語学習'

  const [username, setUsername] = useState('')
  const [cardSet, setCardSet] = useState<FlashCardSet | null>(null)
  const [cards, setCards] = useState<FlashCardV3[]>([])
  const [logs, setLogs] = useState<Map<number, ReviewLog>>(new Map())
  const [queue, setQueue] = useState<FlashCardV3[]>([])
  const [current, setCurrent] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<'study' | 'result'>('study')
  const [results, setResults] = useState<{ card: FlashCardV3; quality: number }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)

      const [fetchedSet, allCards, logsRes, userRes] = await Promise.all([
        loadFlashCardSet(setId),
        loadFlashCardsV3(setId),
        supabase.from('review_logs').select('*').eq('username', uname),
        supabase.from('users').select('base_daily_limit,today_limit,today_limit_date').eq('username', uname).limit(1),
      ])

      setCardSet(fetchedSet)

      const allLogs: ReviewLog[] = logsRes.data ?? []
      const logMap = new Map<number, ReviewLog>()
      for (const log of allLogs) logMap.set(log.flashcard_id, log)
      setLogs(logMap)

      const userData = userRes.data?.[0]
      const today = new Date().toISOString().split('T')[0]
      const limit = userData?.today_limit_date === today && userData?.today_limit
        ? userData.today_limit : (userData?.base_daily_limit ?? 10)

      const newCards = allCards.filter(c => !logMap.has(c.id))
      const dueCards = allCards.filter(c => {
        const log = logMap.get(c.id)
        return log && log.next_review_date <= today
      })
      const selectedNew = newCards.slice(0, limit)
      const combined = [...selectedNew, ...dueCards].sort(() => Math.random() - 0.5)

      setCards(allCards)
      setQueue(combined)
      setLoading(false)
    }
    init()
  }, [setId, router])

  // TTS：カード個別設定 → セット設定 → デフォルトの順で言語を決定
  const speak = useCallback((text: string, langOverride?: string | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = langOverride ?? cardSet?.tts_lang ?? 'ja-JP'
    utter.rate = 0.9
    utter.volume = 1.0
    window.speechSynthesis.speak(utter)
  }, [cardSet])

  async function saveReview(card: FlashCardV3, quality: number) {
    const existing = logs.get(card.id)
    const ef = existing?.ease_factor ?? 2.5
    const interval = existing?.interval_days ?? 1
    const reps = existing?.repetitions ?? 0
    const { newEf, newInterval, newReps, nextDate } = sm2Update(quality, ef, interval, reps)
    const data = {
      username,
      flashcard_id: card.id,
      quality,
      ease_factor: newEf,
      interval_days: newInterval,
      repetitions: newReps,
      next_review_date: nextDate,
    }
    if (existing) {
      await supabase.from('review_logs').update(data)
        .eq('username', username).eq('flashcard_id', card.id)
    } else {
      await supabase.from('review_logs').insert(data)
    }
    const xpGain = quality >= 4 ? 5 : quality >= 3 ? 3 : 1
    const { data: userData } = await supabase.from('users')
      .select('current_points').eq('username', username).limit(1)
    if (userData?.[0]) {
      await supabase.from('users').update({
        current_points: (userData[0].current_points ?? 0) + xpGain
      }).eq('username', username)
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-5xl animate-bounce">🃏</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  if (phase === 'result') {
    const perfect = results.filter(r => r.quality === 5).length
    const good    = results.filter(r => r.quality === 4).length
    const ok      = results.filter(r => r.quality === 3).length
    const ng      = results.filter(r => r.quality < 3).length
    const total   = results.length
    const acc     = total > 0 ? Math.round(((perfect + good + ok) / total) * 100) : 0
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-purple-50 pb-10">
        <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold">🎉 学習完了！</h1>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
          <div className={`rounded-2xl p-6 text-white text-center shadow-lg
            ${acc === 100 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
              acc >= 80  ? 'bg-gradient-to-r from-green-400 to-teal-500' :
              acc >= 50  ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                           'bg-gradient-to-r from-gray-400 to-gray-600'}`}>
            <div className="text-5xl mb-2">
              {acc === 100 ? '🏆' : acc >= 80 ? '🎉' : acc >= 50 ? '💪' : '📖'}
            </div>
            <h2 className="text-2xl font-bold">
              {acc === 100 ? 'パーフェクト！！' : acc >= 80 ? '素晴らしい！' : acc >= 50 ? 'よく頑張った！' : '今日はここから！'}
            </h2>
            <p className="opacity-80 mt-1">正解率 {acc}%</p>
            <p className="text-3xl font-bold mt-2">{total}枚 完了！</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-3">📊 結果内訳</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: '⭐バッチリ', count: perfect, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                { label: '🟢だいたい', count: good,    color: 'bg-green-50 text-green-700 border-green-200' },
                { label: '🔶うっすら', count: ok,      color: 'bg-orange-50 text-orange-700 border-orange-200' },
                { label: '❌ダメ',    count: ng,       color: 'bg-red-50 text-red-700 border-red-200' },
              ].map(({ label, count, color }) => (
                <div key={label} className={`rounded-xl p-2 border ${color}`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
          {ng > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100">
              <h3 className="font-bold text-gray-700 mb-2">🔁 次回また挑戦</h3>
              <div className="space-y-1">
                {results.filter(r => r.quality < 3).map(({ card }) => (
                  <div key={card.id} className="flex items-center gap-2 text-sm text-gray-600 py-1 border-b border-gray-50">
                    <span className="font-bold text-gray-800">{card.lang1}</span>
                    <span className="text-gray-400">→</span>
                    <span>{card.lang2}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <button onClick={() => router.push('/flash')}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-2xl transition shadow">
              📚 教材選択に戻る
            </button>
            <button onClick={() => router.push('/student')}
              className="w-full bg-white hover:bg-gray-50 text-gray-600 font-bold py-3 rounded-2xl transition shadow border border-gray-200">
              🏠 ホームへ戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-purple-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-md text-center max-w-sm w-full space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold text-gray-800">今日の分は全部終わった！</h2>
          <p className="text-gray-500 text-sm">また明日来てね！</p>
          <button onClick={() => router.push('/flash')}
            className="w-full bg-indigo-500 text-white font-bold py-3 rounded-2xl">
            教材選択に戻る
          </button>
        </div>
      </div>
    )
  }

  const card = queue[current]
  const progress = Math.round((current / queue.length) * 100)
  const lang1TTS = card.tts_lang1 ?? cardSet?.lang1_tts_lang ?? cardSet?.tts_lang ?? 'ja-JP'
  const lang2TTS = card.tts_lang2 ?? cardSet?.lang2_tts_lang ?? 'ja-JP'
  const lang3TTS = card.tts_lang3 ?? cardSet?.lang3_tts_lang ?? null
  const lang1Label = cardSet?.lang1_label ?? '表面'
  const lang2Label = cardSet?.lang2_label ?? '裏面'
  const lang3Label = cardSet?.lang3_label ?? '補足'

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-purple-50 pb-10">
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 shadow">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-bold text-sm truncate">{setName}</h1>
            <button onClick={() => router.push('/flash')}
              className="text-xs bg-white/20 px-2 py-1 rounded-full">中断</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
              <div className="bg-yellow-300 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs opacity-80 flex-shrink-0">{current + 1}/{queue.length}</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        {!showAnswer && (
          <div className="rounded-2xl p-8 text-center shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
            <p className="text-xs text-gray-400 mb-4 tracking-widest uppercase">{lang1Label}</p>
            <p className="text-4xl font-bold text-gray-800 leading-relaxed">{card.lang1}</p>
            {card.lang1_sub && <p className="text-gray-500 mt-2 text-lg">{card.lang1_sub}</p>}
            <button
              onClick={() => speak(card.lang1, lang1TTS)}
              className="mt-4 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full text-sm font-bold transition active:scale-95"
            >
              🔊 読み上げ
            </button>
            {card.hint && <p className="text-xs text-amber-500 mt-3">💡 {card.hint}</p>}
          </div>
        )}

        {showAnswer && (
          <div className="rounded-2xl p-6 text-center shadow-lg bg-gradient-to-br from-green-50 to-teal-50 border border-green-200">
            <p className="text-xs text-gray-400 mb-3 tracking-widest uppercase">{lang2Label}</p>
            <p className="text-3xl font-bold text-gray-800">{card.lang2}</p>
            {card.lang2_sub && <p className="text-gray-500 mt-1 text-base">{card.lang2_sub}</p>}
            <div className="flex gap-2 justify-center mt-3 flex-wrap">
              <button
                onClick={() => speak(card.lang1, lang1TTS)}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-sm font-bold transition active:scale-95"
              >
                🔊 {lang1Label}
              </button>
              <button
                onClick={() => speak(card.lang2, lang2TTS)}
                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-full text-sm font-bold transition active:scale-95"
              >
                🔊 {lang2Label}
              </button>
              {card.lang3 && lang3TTS && (
                <button
                  onClick={() => speak(card.lang3, lang3TTS)}
                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full text-sm font-bold transition active:scale-95"
                >
                  🔊 {lang3Label}
                </button>
              )}
            </div>
            {card.lang3 && (
              <p className="text-gray-500 text-sm mt-3">
                {lang3Label}：{card.lang3}
                {card.lang3_sub && <span className="text-gray-400">（{card.lang3_sub}）</span>}
              </p>
            )}
          </div>
        )}

        {!showAnswer && (
          <p className="text-center text-xs text-gray-400">💭 意味を頭に思い浮かべてから押してね</p>
        )}
        {!showAnswer && (
          <button onClick={() => setShowAnswer(true)}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg transition text-lg active:scale-95">
            👀 答えを見る
          </button>
        )}
        {showAnswer && (
          <div className="space-y-3">
            <p className="text-center text-sm font-bold text-gray-600">どのくらい覚えていた？</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { q: 0, label: '❌ 全然ダメ',   sub: '答えが出なかった',        color: 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100' },
                { q: 3, label: '🔶 うっすら',   sub: '思い出すのに時間かかった', color: 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100' },
                { q: 4, label: '🟢 だいたい',   sub: 'すぐ出たが少し不安',      color: 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100' },
                { q: 5, label: '⭐ バッチリ！', sub: '一瞬で完全に自信あり',    color: 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100' },
              ].map(({ q, label, sub, color }) => (
                <button key={q}
                  onClick={() => handleQuality(q)}
                  disabled={saving}
                  className={`border-2 rounded-2xl p-3 text-left transition active:scale-95 disabled:opacity-50 ${color}`}>
                  <p className="font-bold text-sm">{label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{sub}</p>
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">🃏</div>
      </div>
    }>
      <StudyContent />
    </Suspense>
  )
}
