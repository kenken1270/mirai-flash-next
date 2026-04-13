'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUsernameFromSession } from '@/lib/auth-user'

type ContentRow = { id: number; subject: string; content_type: string; title: string; url: string }
type Book = { id: number; title: string; subtitle: string; cover_emoji: string; category: string }
type SetInfo = { id: number; book_id: number; lang1_label: string; lang2_label: string; lang1_tts_lang: string; lang2_tts_lang: string }
type QuizResult = { id: number; score_pct: number; miss_count: number; total_count: number; correct_count: number; taken_at: string; stamp_earned: boolean; book_id: number }

type PageGroupInfo = {
  page_no: number
  min_item: number
  max_item: number
  count: number
  label: string
}

type RangeMeta = {
  absMin: number
  absMax: number
  groups: PageGroupInfo[]
}

function buildRangeMeta(cards: { item_no: number; page_no: number | null; lang3: string | null }[]): RangeMeta | null {
  if (!cards.length) return null
  const absMin = Math.min(...cards.map(c => c.item_no))
  const absMax = Math.max(...cards.map(c => c.item_no))
  const byPage = new Map<number, { min: number; max: number; count: number; label: string }>()
  for (const c of cards) {
    const p = c.page_no ?? 0
    if (!byPage.has(p)) {
      byPage.set(p, { min: c.item_no, max: c.item_no, count: 0, label: '' })
    }
    const g = byPage.get(p)!
    g.min = Math.min(g.min, c.item_no)
    g.max = Math.max(g.max, c.item_no)
    g.count++
    if (!g.label && c.lang3?.trim()) g.label = c.lang3.trim().split('\n')[0].slice(0, 80)
  }
  for (const g of byPage.values()) {
    if (!g.label) g.label = '（タイトルなし）'
  }
  const groups: PageGroupInfo[] = Array.from(byPage.entries())
    .map(([page_no, v]) => ({
      page_no,
      min_item: v.min,
      max_item: v.max,
      count: v.count,
      label: page_no === 0 ? `未分類（pageなし）` : v.label,
    }))
    .sort((a, b) => a.page_no - b.page_no)
  return { absMin, absMax, groups }
}

function buildQuickNumberPresets(absMin: number, absMax: number): { label: string; s: number; e: number }[] {
  const total = absMax - absMin + 1
  const out: { label: string; s: number; e: number }[] = []
  const steps = [15, 30, 50, 100, 200, 500, 1000]
  for (const n of steps) {
    if (n < total) out.push({ label: `先頭${n}問`, s: absMin, e: absMin + n - 1 })
  }
  out.push({ label: `全${total}問`, s: absMin, e: absMax })
  const seen = new Set<string>()
  return out.filter(r => {
    const k = `${r.s}-${r.e}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const SUBJECTS = ['国語', '算数', '理科', '社会']
const SUBJECT_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  '国語': { icon: '📖', color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  '算数': { icon: '🔢', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  '理科': { icon: '🔬', color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  '社会': { icon: '🌍', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
}

function getLangDisplay(label: string, ttsLang?: string): { icon: string; text: string } {
  const l = label ?? ''
  const t = ttsLang ?? ''
  if (t.startsWith('en') || l.includes('英')) return { icon: '🇬🇧', text: l || '英語' }
  if (t.startsWith('zh') || l.includes('中')) return { icon: '🇨🇳', text: l || '中国語' }
  if (t.startsWith('ja') || l.includes('日')) return { icon: '🇯🇵', text: l || '日本語' }
  if (t.startsWith('ko') || l.includes('韓')) return { icon: '🇰🇷', text: l || '韓国語' }
  return { icon: '📖', text: l || '問題' }
}

type Strictness = 'strict' | 'normal' | 'loose'

const STRICTNESS_OPTIONS: { key: Strictness; label: string; desc: string; detail: string }[] = [
  { key: 'strict', label: '🎯 厳密',   desc: 'スペル完全一致', detail: '一字一句正確に入力する必要があります。英単語スペル練習向け。' },
  { key: 'normal', label: '📝 標準',   desc: '意味が合えばOK', detail: '「見える、見る」なら「見える」だけでも正解。読点区切りのどれか1つでOK。' },
  { key: 'loose',  label: '😊 ゆるめ', desc: 'ニュアンスOK',   detail: '2文字以上含んでいれば正解。ひらがな・カタカナの揺れも許容します。' },
]

export default function TestPage() {
  const router = useRouter()
  const [contents, setContents]         = useState<ContentRow[]>([])
  const [books, setBooks]               = useState<Book[]>([])
  const [sets, setSets]                 = useState<SetInfo[]>([])
  const [quizHistory, setQuizHistory]   = useState<QuizResult[]>([])
  const [activeTab, setActiveTab]       = useState<string>('単語')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [itemStart, setItemStart]       = useState<string>('1')
  const [itemEnd, setItemEnd]           = useState<string>('15')
  const [quizMode, setQuizMode]         = useState<'choice' | 'typing'>('choice')
  const [direction, setDirection]       = useState<'lang1to2' | 'lang2to1'>('lang1to2')
  const [strictness, setStrictness]     = useState<Strictness>('normal')
  const [loading, setLoading]           = useState(true)

  const [rangeMeta, setRangeMeta]       = useState<RangeMeta | null>(null)
  const [rangeLoading, setRangeLoading] = useState(false)
  const [rangeMode, setRangeMode]       = useState<'chapter' | 'numbers'>('chapter')
  const [layerStartPage, setLayerStartPage] = useState(0)
  const [layerEndPage, setLayerEndPage]     = useState(0)
  const [questionPickMode, setQuestionPickMode] = useState<'all' | 'random'>('all')
  const [randomQuestionCount, setRandomQuestionCount] = useState('20')
  const [hidePromptQuiz, setHidePromptQuiz] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = getUsernameFromSession(session)
      const [{ data: contentData }, { data: bookData }, { data: setData }, { data: historyData }] = await Promise.all([
        supabase.from('content').select('*').order('id'),
        supabase.from('flashcard_books').select('*').order('id'),
        supabase.from('flashcard_sets').select('id, book_id, lang1_label, lang2_label, lang1_tts_lang, lang2_tts_lang').order('id'),
        supabase.from('quiz_results').select('*').eq('username', uname).order('taken_at', { ascending: false }).limit(20),
      ])
      setContents(contentData ?? [])
      setBooks(bookData ?? [])
      setSets(setData ?? [])
      setQuizHistory(historyData ?? [])
      if ((bookData ?? []).length > 0) setSelectedBook((bookData ?? [])[0])
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (!selectedBook) {
      setRangeMeta(null)
      return
    }
    const bookId = selectedBook.id
    let cancelled = false
    async function loadRange() {
      setRangeLoading(true)
      setRangeMeta(null)
      const { data: bookSets } = await supabase.from('flashcard_sets').select('id').eq('book_id', bookId)
      const setIds = bookSets?.map(s => s.id) ?? []
      if (!setIds.length) {
        if (!cancelled) {
          setRangeMeta(null)
          setRangeLoading(false)
        }
        return
      }
      const { data: cards } = await supabase
        .from('flashcards_v3')
        .select('item_no, page_no, lang3')
        .in('set_id', setIds)
        .order('item_no')
      if (cancelled) return
      const meta = cards?.length ? buildRangeMeta(cards as { item_no: number; page_no: number | null; lang3: string | null }[]) : null
      setRangeMeta(meta)
      setRangeLoading(false)
      if (meta?.groups.length) {
        const g0 = meta.groups[0]
        setLayerStartPage(g0.page_no)
        setLayerEndPage(g0.page_no)
        setItemStart(String(g0.min_item))
        setItemEnd(String(g0.max_item))
        setRangeMode('chapter')
      } else if (meta) {
        setItemStart(String(meta.absMin))
        setItemEnd(String(Math.min(meta.absMin + 14, meta.absMax)))
        setRangeMode('numbers')
      }
    }
    void loadRange()
    return () => {
      cancelled = true
    }
  }, [selectedBook?.id])

  const applyLayerRange = (startP: number, endP: number) => {
    if (!rangeMeta?.groups.length) return
    const lo = Math.min(startP, endP)
    const hi = Math.max(startP, endP)
    const inRange = rangeMeta.groups.filter(g => g.page_no >= lo && g.page_no <= hi)
    if (!inRange.length) return
    setItemStart(String(Math.min(...inRange.map(g => g.min_item))))
    setItemEnd(String(Math.max(...inRange.map(g => g.max_item))))
  }

  const numberPresets = useMemo(
    () => (rangeMeta ? buildQuickNumberPresets(rangeMeta.absMin, rangeMeta.absMax) : []),
    [rangeMeta],
  )

  const bookSets     = sets.filter(s => s.book_id === selectedBook?.id)
  const firstSet     = bookSets[0]
  const lang1Label   = firstSet?.lang1_label    ?? '問題'
  const lang2Label   = firstSet?.lang2_label    ?? '答え'
  const lang1TtsLang = firstSet?.lang1_tts_lang ?? ''
  const lang2TtsLang = firstSet?.lang2_tts_lang ?? ''
  const lang1Display = getLangDisplay(lang1Label, lang1TtsLang)
  const lang2Display = getLangDisplay(lang2Label, lang2TtsLang)

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-4xl animate-bounce">✏️</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  const TABS          = ['単語', ...SUBJECTS]
  const totalTests    = quizHistory.length
  const stampCount    = quizHistory.filter(r => r.stamp_earned).length
  const avgScore      = totalTests > 0 ? Math.round(quizHistory.reduce((s, r) => s + r.score_pct, 0) / totalTests) : 0
  const totalAnswered = quizHistory.reduce((s, r) => s + r.total_count, 0)
  const recentScores  = [...quizHistory].reverse().slice(-8)
  const startNum      = parseInt(itemStart) || 1
  const endNum        = parseInt(itemEnd)   || startNum
  const questionCount = Math.max(0, endNum - startNum + 1)
  const rangeSpan     = Math.max(1, questionCount)
  const randomN       = Math.min(Math.max(1, parseInt(randomQuestionCount, 10) || 20), rangeSpan)
  const effectiveQuizCount = questionPickMode === 'all' ? questionCount : randomN

  function handleStart() {
    if (!selectedBook) return
    let s = startNum
    let e = endNum
    if (rangeMeta) {
      s = Math.max(rangeMeta.absMin, Math.min(s, rangeMeta.absMax))
      e = Math.max(rangeMeta.absMin, Math.min(e, rangeMeta.absMax))
      if (e < s) [s, e] = [e, s]
    }
    const span = Math.max(1, e - s + 1)
    const pick = Math.min(Math.max(1, parseInt(randomQuestionCount, 10) || 20), span)
    const params = new URLSearchParams({
      book_id:     String(selectedBook.id),
      item_start:  String(s),
      item_end:    String(e),
      mode:        quizMode,
      direction,
      lang1_label: lang1Label,
      lang2_label: lang2Label,
      lang1_tts:   lang1TtsLang,
      lang2_tts:   lang2TtsLang,
      strictness,
    })
    if (questionPickMode === 'random') params.set('question_count', String(pick))
    if (quizMode === 'choice' && hidePromptQuiz) params.set('hide_prompt', '1')
    router.push('/flash/quiz?' + params.toString())
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-5 shadow-md text-white">
        <h2 className="text-xl font-bold">✏️ 小テスト</h2>
        <p className="text-sm opacity-80 mt-1">単語・教科の小テストに挑戦しよう！</p>
      </div>

      {/* タブ */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold border transition
              ${activeTab === tab ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-gray-200'}`}>
            {tab === '単語' ? '🃏 単語' : SUBJECT_CONFIG[tab].icon + ' ' + tab}
          </button>
        ))}
      </div>

      {/* ===== 単語タブ ===== */}
      {activeTab === '単語' && (
        <div className="space-y-3">

          {/* 累計統計 */}
          {totalTests > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <h3 className="font-bold text-gray-700 text-sm">🏅 あなたの記録</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'テスト', value: totalTests,    unit: '回', color: 'text-purple-500' },
                  { label: 'スタンプ', value: stampCount,  unit: '回', color: 'text-yellow-500' },
                  { label: '正解率', value: avgScore,      unit: '%',  color: 'text-green-500'  },
                  { label: '累計問', value: totalAnswered, unit: '問', color: 'text-blue-500'   },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-2">
                    <p className={`text-lg font-black ${color}`}>{value.toLocaleString()}<span className="text-xs">{unit}</span></p>
                    <p className="text-gray-400 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {recentScores.length > 1 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">📈 最近の正解率</p>
                  <div className="flex items-end gap-1 h-12">
                    {recentScores.map((r, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full rounded-t transition-all"
                          style={{
                            height: `${Math.round((r.score_pct / 100) * 44)}px`,
                            background: r.stamp_earned
                              ? 'linear-gradient(to top,#f59e0b,#fbbf24)'
                              : 'linear-gradient(to top,#6366f1,#a5b4fc)'
                          }} />
                        <span className="text-xs">{r.stamp_earned ? '⭐' : '　'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 設定カード */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">

            {/* ① 教材選択 */}
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">📚 教材</p>
              <div className="space-y-2">
                {books.map(book => {
                  const s = sets.find(s => s.book_id === book.id)
                  const d1 = getLangDisplay(s?.lang1_label ?? '', s?.lang1_tts_lang ?? '')
                  const d2 = getLangDisplay(s?.lang2_label ?? '', s?.lang2_tts_lang ?? '')
                  return (
                    <button key={book.id}
                      onClick={() => { setSelectedBook(book); setDirection('lang1to2') }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left
                        ${selectedBook?.id === book.id ? 'bg-purple-50 border-purple-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-2xl">{book.cover_emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">{book.title}</p>
                        <p className="text-xs text-gray-400">{book.subtitle}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{d1.icon}{d1.text} / {d2.icon}{d2.text}</span>
                      {selectedBook?.id === book.id && <span className="text-purple-500 font-bold text-lg flex-shrink-0 ml-1">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* ② 出題範囲 */}
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">🎯 出題範囲</p>
              {rangeLoading && (
                <p className="text-xs text-gray-400 py-2">教材の単語一覧を読み込み中…</p>
              )}
              {!rangeLoading && !rangeMeta && selectedBook && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-2">
                  この教材に単語データが見つかりません。番号を直接指定してください。
                </p>
              )}
              {rangeMeta && (
                <p className="text-xs text-gray-500 mb-2">
                  教材内の番号: <span className="font-bold text-gray-700">{rangeMeta.absMin}</span>
                  〜<span className="font-bold text-gray-700">{rangeMeta.absMax}</span>
                  （全{rangeMeta.absMax - rangeMeta.absMin + 1}問分）
                </p>
              )}

              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setRangeMode('chapter')}
                  disabled={!rangeMeta?.groups.length}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition
                    ${rangeMode === 'chapter' ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 text-gray-600 border-gray-200'}
                    disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  📑 ブロックから選ぶ
                </button>
                <button
                  type="button"
                  onClick={() => setRangeMode('numbers')}
                  disabled={!rangeMeta}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition
                    ${rangeMode === 'numbers' ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 text-gray-600 border-gray-200'}
                    disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  🔢 番号で指定
                </button>
              </div>

              {rangeMode === 'chapter' && rangeMeta && rangeMeta.groups.length > 0 && (
                <div className="space-y-3 mb-3">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <label className="text-xs text-gray-500 sm:w-10">開始</label>
                    <select
                      value={layerStartPage}
                      onChange={e => {
                        const v = Number(e.target.value)
                        setLayerStartPage(v)
                        applyLayerRange(v, layerEndPage)
                      }}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:border-purple-400 outline-none bg-white"
                    >
                      {rangeMeta.groups.map(g => (
                        <option key={g.page_no} value={g.page_no}>
                          {g.page_no === 0 ? '— ' : `P${g.page_no} `}
                          {g.label}（No.{g.min_item}〜{g.max_item}）
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <label className="text-xs text-gray-500 sm:w-10">終了</label>
                    <select
                      value={layerEndPage}
                      onChange={e => {
                        const v = Number(e.target.value)
                        setLayerEndPage(v)
                        applyLayerRange(layerStartPage, v)
                      }}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:border-purple-400 outline-none bg-white"
                    >
                      {rangeMeta.groups.map(g => (
                        <option key={g.page_no} value={g.page_no}>
                          {g.page_no === 0 ? '— ' : `P${g.page_no} `}
                          {g.label}（No.{g.min_item}〜{g.max_item}）
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-400">ブロックは教材の「ページ／章」単位です。ラベルは各ブロック先頭の説明（教材によってはひらがな・カタカナなど）です。</p>
                  <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                    {rangeMeta.groups.map(g => {
                      const active =
                        g.page_no >= Math.min(layerStartPage, layerEndPage) &&
                        g.page_no <= Math.max(layerStartPage, layerEndPage)
                      return (
                        <button
                          type="button"
                          key={g.page_no}
                          onClick={() => {
                            setLayerStartPage(g.page_no)
                            setLayerEndPage(g.page_no)
                            applyLayerRange(g.page_no, g.page_no)
                          }}
                          className={`text-left rounded-xl border px-3 py-2 transition
                            ${active ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-sm text-gray-800 line-clamp-2">{g.label}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {g.page_no === 0 ? '—' : `P${g.page_no}`}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            No.{g.min_item}〜{g.max_item} · {g.count}枚
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs text-gray-500 w-full sm:w-auto">出題番号</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={itemStart}
                  onChange={e => {
                    setRangeMode('numbers')
                    setItemStart(e.target.value.replace(/[^0-9]/g, ''))
                  }}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-sm focus:border-purple-400 outline-none" />
                <span className="text-gray-400 font-bold">〜</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={itemEnd}
                  onChange={e => {
                    setRangeMode('numbers')
                    setItemEnd(e.target.value.replace(/[^0-9]/g, ''))
                  }}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-sm focus:border-purple-400 outline-none" />
                <span className="text-gray-500 text-sm">番</span>
              </div>

              {rangeMode === 'numbers' && rangeMeta && numberPresets.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {numberPresets.map(({ label, s, e }) => (
                    <button
                      key={`${label}-${s}-${e}`}
                      type="button"
                      onClick={() => {
                        setItemStart(String(s))
                        setItemEnd(String(e))
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border font-bold transition
                        ${startNum === s && endNum === e ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    >
                      {label}
                      <span className="opacity-80 font-normal">（{s}〜{e}）</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* ②b 出題数（範囲内ランダム） */}
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">🔢 出題数</p>
              <p className="text-xs text-gray-500 mb-2">上で選んだ範囲の中から、出す問題数を決めます（ランダムは毎回シャッフル）。</p>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setQuestionPickMode('all')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition
                    ${questionPickMode === 'all' ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                >
                  範囲の全問
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionPickMode('random')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition
                    ${questionPickMode === 'random' ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                >
                  ランダムで
                </button>
              </div>
              {questionPickMode === 'random' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={randomQuestionCount}
                      onChange={e => setRandomQuestionCount(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-sm focus:border-purple-400 outline-none"
                      aria-label="ランダム出題数"
                    />
                    <span className="text-sm text-gray-600">問</span>
                    <span className="text-xs text-gray-400">（最大 {rangeSpan} 問）</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[10, 20, 30, 50, 100].map(n => {
                      const tooBig = n > rangeSpan
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRandomQuestionCount(String(Math.min(n, rangeSpan)))}
                          disabled={tooBig}
                          className={`text-xs px-3 py-1.5 rounded-full border font-bold transition
                            ${tooBig ? 'opacity-40 cursor-not-allowed border-gray-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'}`}
                        >
                          {n}問
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* ③ 出題方向 */}
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">🔄 出題方向</p>
              <div className="grid grid-cols-2 gap-2">
                {(['lang1to2', 'lang2to1'] as const).map(d => (
                  <button key={d} onClick={() => setDirection(d)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition
                      ${direction === d ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {d === 'lang1to2'
                      ? `${lang1Display.icon} ${lang1Display.text} → ${lang2Display.icon} ${lang2Display.text}`
                      : `${lang2Display.icon} ${lang2Display.text} → ${lang1Display.icon} ${lang1Display.text}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* ④ 出題形式 */}
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">🎮 出題形式</p>
              <div className="grid grid-cols-2 gap-2">
                {(['choice', 'typing'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setQuizMode(m)
                      if (m === 'typing') setHidePromptQuiz(false)
                    }}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition
                      ${quizMode === m ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                  >
                    {m === 'choice' ? '🔤 4択' : '⌨️ 入力'}
                  </button>
                ))}
              </div>
              {quizMode === 'choice' && (
                <label className="mt-3 flex items-start gap-3 cursor-pointer rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={hidePromptQuiz}
                    onChange={e => setHidePromptQuiz(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs text-gray-700 leading-snug">
                    <span className="font-bold">音声のみ（文字を隠す）</span>
                    <br />
                    <span className="text-gray-500">問題の文字を出さず、「きく」で聞いて答えます（ヒントの説明文も非表示）。</span>
                  </span>
                </label>
              )}
            </div>

            {/* ⑤ 判定レベル（入力モード時のみ） */}
            {quizMode === 'typing' && (
              <>
                <div className="border-t border-gray-100" />
                <div>
                  <p className="text-sm font-bold text-gray-600 mb-2">⚖️ 判定レベル</p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {STRICTNESS_OPTIONS.map(({ key, label, desc }) => (
                      <button key={key} onClick={() => setStrictness(key)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-0.5
                          ${strictness === key ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        <span>{label}</span>
                        <span className={`text-xs ${strictness === key ? 'opacity-80' : 'text-gray-400'}`}>{desc}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-2">
                    <p className="text-xs text-blue-700">
                      {STRICTNESS_OPTIONS.find(o => o.key === strictness)?.detail}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* スタンプ条件 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
              <p className="text-xs text-yellow-700 font-bold">🏆 ミス3以内で先生スタンプGET！</p>
            </div>

            {/* テスト開始ボタン */}
            <button onClick={handleStart} disabled={!selectedBook}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-md hover:opacity-90 transition disabled:opacity-40">
              🚀 テスト開始！（{effectiveQuizCount}問）
            </button>
          </div>
        </div>
      )}

      {/* ===== 教科タブ ===== */}
      {SUBJECTS.includes(activeTab) && (() => {
        const tabContents = contents.filter(c => c.subject === activeTab)
        const videos = tabContents.filter(c => c.content_type === '動画')
        const tests  = tabContents.filter(c => c.content_type === '小テスト')
        const cfg = SUBJECT_CONFIG[activeTab]
        return (
          <div className="space-y-4">
            {tabContents.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center space-y-2">
                <div className="text-4xl">{cfg.icon}</div>
                <p className="font-bold text-gray-600">{activeTab}のコンテンツはまだありません</p>
                <p className="text-sm text-gray-400">先生が追加するとここに表示されます</p>
              </div>
            )}
            {videos.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-lg text-sm">🎬 動画</span>
                  <span className="text-sm text-gray-400">{videos.length}件</span>
                </h3>
                {videos.map(item => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-3 p-4 rounded-xl border shadow-sm hover:shadow-md transition-all active:scale-95 ${cfg.bg}`}>
                    <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow">
                      <span className="text-white text-lg">▶</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${cfg.color}`}>{item.title}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.url}</p>
                    </div>
                    <span className="text-gray-300 flex-shrink-0">›</span>
                  </a>
                ))}
              </div>
            )}
            {tests.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-lg text-sm">✏️ 小テスト</span>
                  <span className="text-sm text-gray-400">{tests.length}件</span>
                </h3>
                {tests.map(item => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl border border-purple-200 bg-purple-50 shadow-sm hover:shadow-md transition-all active:scale-95">
                    <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow">
                      <span className="text-white text-lg">✏️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-purple-700">{item.title}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.url}</p>
                    </div>
                    <span className="text-gray-300 flex-shrink-0">›</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}