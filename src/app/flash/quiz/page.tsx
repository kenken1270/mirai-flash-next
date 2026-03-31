'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Card = {
  id: number; item_no: number
  lang1: string; lang1_sub: string
  lang2: string; lang2_sub: string
  lang3: string; hint: string; set_id: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getLangDisplay(label: string, ttsLang: string): { icon: string; text: string } {
  if (ttsLang.startsWith('en') || label.includes('英')) return { icon: '🇬🇧', text: label || '英語' }
  if (ttsLang.startsWith('zh') || label.includes('中')) return { icon: '🇨🇳', text: label || '中国語' }
  if (ttsLang.startsWith('ja') || label.includes('日')) return { icon: '🇯🇵', text: label || '日本語' }
  if (ttsLang.startsWith('ko') || label.includes('韓')) return { icon: '🇰🇷', text: label || '韓国語' }
  return { icon: '📖', text: label || '問題' }
}

function QuizContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const bookId     = sp.get('book_id')
  const itemStart  = parseInt(sp.get('item_start') ?? '1')
  const itemEnd    = parseInt(sp.get('item_end')   ?? '9999')
  const initMode   = (sp.get('mode')      ?? 'choice')     as 'choice' | 'typing'
  const initDir    = (sp.get('direction') ?? 'lang1to2')   as 'lang1to2' | 'lang2to1'
  const lang1Label = sp.get('lang1_label') ?? '問題'
  const lang2Label = sp.get('lang2_label') ?? '答え'
  const lang1Tts   = sp.get('lang1_tts')  ?? ''
  const lang2Tts   = sp.get('lang2_tts')  ?? ''
  const strictness = (sp.get('strictness') ?? 'normal') as 'strict' | 'normal' | 'loose'

  const lang1Display = getLangDisplay(lang1Label, lang1Tts)
  const lang2Display = getLangDisplay(lang2Label, lang2Tts)

  const [username, setUsername]         = useState('')
  const [cards, setCards]               = useState<Card[]>([])
  const [allCards, setAllCards]         = useState<Card[]>([])
  const [loading, setLoading]           = useState(true)
  const [idx, setIdx]                   = useState(0)
  const [missCount, setMissCount]       = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [choices, setChoices]           = useState<string[]>([])
  const [selected, setSelected]         = useState<string | null>(null)
  const [typingInput, setTypingInput]   = useState('')
  const [typingResult, setTypingResult] = useState<'correct' | 'wrong' | null>(null)
  const [answered, setAnswered]         = useState(false)
  const [finishing, setFinishing]       = useState(false)

  const mode      = initMode
  const direction = initDir

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)
      let query = supabase.from('flashcards_v3').select('*')
      if (bookId) {
        const { data: sets } = await supabase
          .from('flashcard_sets').select('id').eq('book_id', parseInt(bookId))
        const setIds = (sets ?? []).map((s: any) => s.id)
        if (setIds.length > 0) query = query.in('set_id', setIds)
      }
      const { data } = await query.gte('item_no', itemStart).lte('item_no', itemEnd).order('item_no')
      const loaded = (data ?? []) as Card[]
      setAllCards(loaded)
      setCards(shuffle(loaded))
      setLoading(false)
    }
    init()
  }, [router, bookId, itemStart, itemEnd])

  // 選択肢生成（カードロード後・idx変更後）
  useEffect(() => {
    if (cards.length === 0 || mode !== 'choice') return
    const correct = cards[idx]
    if (!correct) return
    const pool = allCards.filter(c => c.id !== correct.id)
    const wrongs = shuffle(pool).slice(0, 3)
    const ans = direction === 'lang1to2'
      ? [correct.lang2, ...wrongs.map(w => w.lang2)]
      : [correct.lang1, ...wrongs.map(w => w.lang1)]
    setChoices(shuffle(ans))
    setSelected(null)
    setAnswered(false)
  }, [idx, cards, allCards, direction, mode])

  const finishQuiz = useCallback(async (finalCorrect: number, finalMiss: number) => {
    if (finishing) return
    setFinishing(true)
    const total = cards.length
    const scorePct = total > 0 ? Math.round((finalCorrect / total) * 100) : 0
    const stampEarned = finalMiss <= 3
    let setIds: number[] = []
    if (bookId) {
      const { data: sets } = await supabase
        .from('flashcard_sets').select('id').eq('book_id', parseInt(bookId))
      setIds = (sets ?? []).map((s: any) => s.id)
    }
    await supabase.from('quiz_results').insert({
      username,
      book_id:       bookId ? parseInt(bookId) : null,
      set_ids:       setIds,
      mode,
      item_start:    itemStart,
      item_end:      itemEnd,
      total_count:   total,
      correct_count: finalCorrect,
      miss_count:    finalMiss,
      score_pct:     scorePct,
      stamp_earned:  stampEarned,
    })
    const params = new URLSearchParams({
      total:      String(total),
      correct:    String(finalCorrect),
      miss:       String(finalMiss),
      score:      String(scorePct),
      stamp:      String(stampEarned),
      book_id:    bookId ?? '',
      item_start: String(itemStart),
      item_end:   String(itemEnd),
    })
    router.push('/flash/quiz/result?' + params.toString())
  }, [cards.length, finishing, username, bookId, mode, itemStart, itemEnd, router])

  const goNext = useCallback((newIdx: number, newCorrect: number, newMiss: number) => {
    if (newIdx >= cards.length) {
      finishQuiz(newCorrect, newMiss)
    } else {
      setIdx(newIdx)
      setSelected(null)
      setAnswered(false)
      setTypingInput('')
      setTypingResult(null)
    }
  }, [cards.length, finishQuiz])

  function handleChoice(ch: string) {
    if (answered) return
    const correctAns = direction === 'lang1to2' ? cards[idx].lang2 : cards[idx].lang1
    const isCorrect  = ch === correctAns
    setSelected(ch)
    setAnswered(true)
    const newCorrect = isCorrect ? correctCount + 1 : correctCount
    const newMiss    = isCorrect ? missCount       : missCount + 1
    if (isCorrect) setCorrectCount(newCorrect); else setMissCount(newMiss)
    setTimeout(() => goNext(idx + 1, newCorrect, newMiss), 700)
  }

  // ひらがな⇔カタカナ正規化
  function toHira(str: string) {
    return str.replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
  }

  function judgeAnswer(input: string, correct: string): boolean {
    const inp = input.trim()
    const cor = correct.trim()
    if (inp === '' ) return false

    // 厳密：完全一致のみ
    if (strictness === 'strict') {
      return inp === cor || inp.toLowerCase() === cor.toLowerCase()
    }

    // 共通：完全一致は常にOK
    if (inp === cor || inp.toLowerCase() === cor.toLowerCase()) return true

    // 読点・スラッシュ・括弧で区切った候補リストを生成
    const candidates = cor
      .split(/[、,・\/／()（）〔〕【】\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)

    // 標準：候補のどれか1つと一致 or 3文字以上含む
    if (strictness === 'normal') {
      for (const cand of candidates) {
        if (inp === cand || inp.toLowerCase() === cand.toLowerCase()) return true
        if (toHira(inp) === toHira(cand)) return true
        if (cand.length >= 3 && (cor.includes(inp) || inp.includes(cand)) && inp.length >= 2) return true
      }
      // 入力が3文字以上で正解に含まれる
      if (inp.length >= 3 && cor.includes(inp)) return true
      return false
    }

    // ゆるめ：2文字以上含む・ひらがな揺れOK
    if (strictness === 'loose') {
      for (const cand of candidates) {
        if (inp === cand) return true
        if (toHira(inp) === toHira(cand)) return true
        if (inp.length >= 2 && (cor.includes(inp) || cand.includes(inp))) return true
      }
      if (inp.length >= 2 && cor.includes(inp)) return true
      return false
    }

    return false
  }

  function handleTypingSubmit() {
    if (answered) return
    const correctAns = direction === 'lang1to2' ? cards[idx].lang2 : cards[idx].lang1
    const input      = typingInput.trim()
    const isCorrect  = judgeAnswer(input, correctAns)
    setTypingResult(isCorrect ? 'correct' : 'wrong')
    setAnswered(true)
    const newCorrect = isCorrect ? correctCount + 1 : correctCount
    const newMiss    = isCorrect ? missCount       : missCount + 1
    if (isCorrect) setCorrectCount(newCorrect); else setMissCount(newMiss)
    if (isCorrect) setTimeout(() => goNext(idx + 1, newCorrect, newMiss), 700)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-5xl animate-bounce">🃏</div>
      <p className="text-gray-400">問題を準備中...</p>
    </div>
  )

  if (cards.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <div className="text-5xl">😅</div>
      <p className="font-bold text-gray-600">この範囲に単語データがありません</p>
      <button onClick={() => router.back()}
        className="bg-purple-500 text-white px-6 py-3 rounded-2xl font-bold">
        ← もどる
      </button>
    </div>
  )

  const card        = cards[idx]
  const progress    = Math.round((idx / cards.length) * 100)
  const question    = direction === 'lang1to2' ? card.lang1 : card.lang2
  const questionSub = direction === 'lang1to2' ? card.lang1_sub : card.lang2_sub
  const correctAns  = direction === 'lang1to2' ? card.lang2 : card.lang1
  const qDisplay    = direction === 'lang1to2' ? lang1Display : lang2Display
  const aDisplay    = direction === 'lang1to2' ? lang2Display : lang1Display

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-indigo-50 flex flex-col">

      {/* ヘッダー */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-gray-400 text-sm">✕</button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{idx + 1} / {cards.length}</span>
          <span className="text-sm font-bold text-red-500">❌ ミス {missCount}</span>
        </div>
        <div className="w-8" />
      </div>

      {/* 進捗バー */}
      <div className="h-2 bg-gray-100">
        <div className="h-2 bg-gradient-to-r from-purple-400 to-indigo-500 transition-all duration-300"
          style={{ width: `${progress}%` }} />
      </div>

      {/* ミス警告 */}
      {missCount === 2 && (
        <div className="bg-orange-100 border-b border-orange-200 px-4 py-2 text-center">
          <p className="text-xs font-bold text-orange-600">⚠️ あと1回ミスでスタンプが取れなくなるよ！</p>
        </div>
      )}
      {missCount > 3 && (
        <div className="bg-red-100 border-b border-red-200 px-4 py-2 text-center">
          <p className="text-xs font-bold text-red-600">💪 最後まで頑張ろう！次回に活かそう！</p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">

        {/* 問題カード */}
        <div className="bg-white rounded-3xl p-8 shadow-lg w-full max-w-sm text-center space-y-2">
          <p className="text-xs text-gray-400 font-bold">
            {qDisplay.icon} {qDisplay.text} → {aDisplay.icon} {aDisplay.text}
          </p>
          <p className="text-3xl font-bold text-gray-800">{question}</p>
          {questionSub && <p className="text-sm text-indigo-400">{questionSub}</p>}
          {card.hint && (
            <span className="inline-block bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
              {card.hint}
            </span>
          )}
        </div>

        {/* 4択 */}
        {mode === 'choice' && (
          <div className="w-full max-w-sm space-y-3">
            {choices.map((ch, i) => {
              const isCorrect  = ch === correctAns
              const isSelected = ch === selected
              let btnClass = 'bg-white border-2 border-gray-200 text-gray-800'
              if (answered) {
                if (isCorrect)       btnClass = 'bg-green-100 border-2 border-green-500 text-green-700'
                else if (isSelected) btnClass = 'bg-red-100 border-2 border-red-400 text-red-700'
                else                 btnClass = 'bg-white border-2 border-gray-100 text-gray-400'
              }
              return (
                <button key={i} onClick={() => handleChoice(ch)} disabled={answered}
                  className={`w-full py-4 px-5 rounded-2xl font-bold text-sm text-left transition-all shadow-sm ${btnClass}`}>
                  <span className="mr-2 text-gray-400">{['A','B','C','D'][i]}.</span>{ch}
                </button>
              )
            })}
          </div>
        )}

        {/* タイピング */}
        {mode === 'typing' && (
          <div className="w-full max-w-sm space-y-3">
            <input type="text" value={typingInput}
              onChange={e => setTypingInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !answered && handleTypingSubmit()}
              placeholder={`${aDisplay.text}で入力...`}
              disabled={answered}
              className={`w-full border-2 rounded-2xl px-5 py-4 text-lg font-bold text-center outline-none transition
                ${typingResult === 'correct' ? 'border-green-500 bg-green-50 text-green-700' :
                  typingResult === 'wrong'   ? 'border-red-400 bg-red-50 text-red-700' :
                  'border-indigo-300 bg-white text-gray-800 focus:border-indigo-500'}`}
              autoFocus />
            {typingResult === 'correct' && (
              <div className="bg-green-50 border border-green-300 rounded-xl p-3 text-center animate-pulse">
                <p className="text-sm text-green-700 font-bold">✅ 正解！ {correctAns}</p>
              </div>
            )}
            {typingResult === 'wrong' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-xs text-red-600">❌ 正解は <span className="font-bold">{correctAns}</span></p>
              </div>
            )}
            {!answered && (
              <button onClick={handleTypingSubmit}
                className="w-full bg-indigo-500 text-white py-3 rounded-2xl font-bold hover:bg-indigo-600 transition">
                確認する
              </button>
            )}
            {answered && typingResult === 'wrong' && (
              <button onClick={() => goNext(idx + 1, correctCount, missCount)}
                className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold hover:bg-green-600 transition">
                次へ →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-5xl animate-bounce">🃏</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <QuizContent />
    </Suspense>
  )
}