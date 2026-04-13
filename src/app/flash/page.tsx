'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = { id: number; title: string; subtitle: string; category: string; cover_emoji: string }
type PageGroup = {
  page_no: number
  set_id: number
  min_item: number
  max_item: number
  count: number
  label: string
}

function FlashTopContent() {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [pageGroups, setPageGroups] = useState<PageGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeMode, setRangeMode] = useState<'page' | 'num'>('page')
  const [showPageList, setShowPageList] = useState(false)

  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(1)
  const [startNum, setStartNum] = useState(1)
  const [endNum, setEndNum] = useState(100)
  const [absMin, setAbsMin] = useState(1)
  const [absMax, setAbsMax] = useState(100)

  const [totalWordCount, setTotalWordCount] = useState(0)
  const [questionPickMode, setQuestionPickMode] = useState<'all' | 'random'>('all')
  const [randomQuestionCount, setRandomQuestionCount] = useState('20')

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('flashcard_books').select('*').order('id')
      setBooks(data ?? [])
      setLoading(false)
    }
    init()
  }, [])

  async function selectBook(book: Book) {
    setSelectedBook(book)
    const { data: sets } = await supabase.from('flashcard_sets').select('id').eq('book_id', book.id)
    if (!sets?.length) return
    const setIds = sets.map(s => s.id)
    const { data: cards } = await supabase
      .from('flashcards_v3')
      .select('item_no, page_no, set_id, lang3')
      .in('set_id', setIds)
      .order('item_no')
    if (!cards?.length) return

    const minNo = Math.min(...cards.map(c => c.item_no))
    const maxNo = Math.max(...cards.map(c => c.item_no))
    setAbsMin(minNo)
    setAbsMax(maxNo)
    setStartNum(minNo)
    setEndNum(Math.min(minNo + 19, maxNo))

    const byPage = new Map<number, { min: number; max: number; count: number; label: string; set_id: number }>()
    for (const c of cards) {
      const p = c.page_no ?? 0
      if (!byPage.has(p)) {
        byPage.set(p, { min: c.item_no, max: c.item_no, count: 0, label: '', set_id: c.set_id })
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
    const groups: PageGroup[] = Array.from(byPage.entries())
      .map(([page_no, v]) => ({
        page_no,
        set_id: v.set_id,
        min_item: v.min,
        max_item: v.max,
        count: v.count,
        label: page_no === 0 ? '未分類（pageなし）' : v.label,
      }))
      .sort((a, b) => a.page_no - b.page_no)
    setPageGroups(groups)
    if (groups.length > 0) {
      const g0 = groups[0]
      const gLast = groups[groups.length - 1]
      setStartPage(g0.page_no)
      setEndPage(Math.min(g0.page_no + 1, gLast.page_no))
    }
  }

  useEffect(() => {
    if (rangeMode === 'page') {
      const count = pageGroups
        .filter(g => g.page_no >= startPage && g.page_no <= endPage)
        .reduce((s, g) => s + g.count, 0)
      setTotalWordCount(count)
    } else {
      setTotalWordCount(Math.max(0, endNum - startNum + 1))
    }
  }, [startPage, endPage, startNum, endNum, rangeMode, pageGroups])

  const rangeSpan = Math.max(1, totalWordCount)
  const randomN = Math.min(Math.max(1, parseInt(randomQuestionCount, 10) || 20), rangeSpan)
  const effectiveWordCount = questionPickMode === 'all' ? totalWordCount : randomN

  const firstPg = pageGroups[0]?.page_no ?? 0
  const lastPg = pageGroups[pageGroups.length - 1]?.page_no ?? 0

  const applyLayerRange = (startP: number, endP: number) => {
    if (!pageGroups.length) return
    const lo = Math.min(startP, endP)
    const hi = Math.max(startP, endP)
    const inRange = pageGroups.filter(g => g.page_no >= lo && g.page_no <= hi)
    if (!inRange.length) return
    setStartPage(lo)
    setEndPage(hi)
  }

  const navigate = (mode: string) => {
    if (!selectedBook) return
    let s: number
    let e: number
    let setId: number
    if (rangeMode === 'page') {
      const inRange = pageGroups.filter(g => g.page_no >= startPage && g.page_no <= endPage)
      if (inRange.length === 0) return
      s = Math.min(...inRange.map(g => g.min_item))
      e = Math.max(...inRange.map(g => g.max_item))
      setId = inRange[0].set_id
    } else {
      s = Math.max(absMin, Math.min(startNum, absMax))
      e = Math.max(absMin, Math.min(endNum, absMax))
      if (e < s) [s, e] = [e, s]
      setId = pageGroups[0]?.set_id ?? 1
    }

    const params = new URLSearchParams()
    params.set('id', String(setId))
    params.set('setName', selectedBook.title || '')
    params.set('start', String(s))
    params.set('end', String(e))
    params.set('bookId', String(selectedBook.id))

    if (questionPickMode === 'random' && mode !== 'attack') {
      const span =
        rangeMode === 'page'
          ? pageGroups
              .filter(g => g.page_no >= startPage && g.page_no <= endPage)
              .reduce((acc, g) => acc + g.count, 0)
          : Math.max(1, e - s + 1)
      const pick = Math.min(Math.max(1, parseInt(randomQuestionCount, 10) || 20), Math.max(1, span))
      params.set('question_count', String(pick))
    }

    router.push(`/flash/${mode}?` + params.toString())
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] text-yellow-600 font-bold animate-pulse text-2xl">
        🐕 準備中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFDF0] pb-10 font-sans text-gray-800">
      <header className="bg-yellow-400 px-4 py-4 shadow-sm flex items-center justify-between sticky top-0 z-30 text-gray-900">
        <h1 className="text-xl font-black italic tracking-tighter">MIRAI FLASH</h1>
        <button
          type="button"
          onClick={() => router.push('/student')}
          className="text-sm bg-white/40 px-3 py-1 rounded-full font-bold"
        >
          🏠 ﾎｰﾑ
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {!selectedBook ? (
          <div className="space-y-3">
            <h2 className="text-lg font-bold px-1">📚 教材をえらぶ</h2>
            {books.map(book => (
              <button
                key={book.id}
                type="button"
                onClick={() => selectBook(book)}
                className="w-full bg-white p-4 rounded-2xl shadow-sm border-2 border-gray-100 flex items-center gap-4 active:scale-95 transition"
              >
                <span className="text-3xl">{book.cover_emoji}</span>
                <div className="text-left flex-1">
                  <p className="font-black text-gray-800 leading-tight">{book.title}</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{book.category}</p>
                </div>
                <span className="text-gray-300">▶︎</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-right duration-300">
            <button
              type="button"
              onClick={() => setSelectedBook(null)}
              className="text-indigo-500 font-bold text-sm flex items-center gap-1"
            >
              ← もどる
            </button>

            <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-yellow-200 space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                <span className="text-3xl">{selectedBook.cover_emoji}</span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-gray-800 text-sm leading-tight">{selectedBook.title}</h2>
                  <p className="text-[10px] text-indigo-500 font-bold mt-1">
                    {rangeMode === 'page' ? `P${startPage} 〜 P${endPage}` : `No.${startNum} 〜 No.${endNum}`}
                    {questionPickMode === 'random'
                      ? ` · ${effectiveWordCount}問（範囲${totalWordCount}語）`
                      : ` · ${totalWordCount}語`}
                  </p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setRangeMode('page')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${rangeMode === 'page' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    ページ
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangeMode('num')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${rangeMode === 'num' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    番号
                  </button>
                </div>
              </div>

              {rangeMode === 'page' && pageGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-500">カテゴリ（ブロック）</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 w-8 flex-shrink-0">開始</span>
                      <select
                        value={startPage}
                        onChange={e => {
                          const v = Number(e.target.value)
                          setStartPage(v)
                          setEndPage(ep => (ep < v ? v : ep))
                        }}
                        className="flex-1 min-w-0 border border-gray-200 rounded-xl px-2 py-2 text-[11px] font-medium bg-white"
                      >
                        {pageGroups.map(g => (
                          <option key={g.page_no} value={g.page_no}>
                            P{g.page_no} {g.label}（No.{g.min_item}〜{g.max_item}）
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 w-8 flex-shrink-0">終了</span>
                      <select
                        value={endPage}
                        onChange={e => {
                          const v = Number(e.target.value)
                          setEndPage(v)
                          setStartPage(sp => (sp > v ? v : sp))
                        }}
                        className="flex-1 min-w-0 border border-gray-200 rounded-xl px-2 py-2 text-[11px] font-medium bg-white"
                      >
                        {pageGroups.map(g => (
                          <option key={g.page_no} value={g.page_no}>
                            P{g.page_no} {g.label}（No.{g.min_item}〜{g.max_item}）
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {rangeMode === 'page' ? (
                <div className="space-y-4 px-1">
                  {pageGroups.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-400 w-8">開始</span>
                        <input
                          type="range"
                          min={firstPg}
                          max={endPage}
                          value={startPage}
                          onChange={e => {
                            const v = Number(e.target.value)
                            setStartPage(v)
                            if (endPage < v) setEndPage(v)
                          }}
                          className="flex-1 accent-indigo-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="font-black text-indigo-600 w-6 text-center text-sm">{startPage}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-400 w-8">終了</span>
                        <input
                          type="range"
                          min={startPage}
                          max={lastPg}
                          value={endPage}
                          onChange={e => {
                            const v = Number(e.target.value)
                            setEndPage(v)
                            if (startPage > v) setStartPage(v)
                          }}
                          className="flex-1 accent-indigo-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="font-black text-indigo-600 w-6 text-center text-sm">{endPage}</span>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPageList(!showPageList)}
                    className="w-full text-center text-[9px] font-bold text-gray-300 uppercase tracking-widest py-1 border-t border-gray-50"
                  >
                    {showPageList ? '▲ 閉じる' : '▼ 全ブロック表示'}
                  </button>
                  {showPageList && (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                      {pageGroups.map(g => {
                        const active = g.page_no >= Math.min(startPage, endPage) && g.page_no <= Math.max(startPage, endPage)
                        return (
                          <button
                            key={g.page_no}
                            type="button"
                            onClick={() => applyLayerRange(g.page_no, g.page_no)}
                            className={`text-left rounded-xl border px-2 py-2 transition ${active ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}
                          >
                            <span className="text-[10px] font-bold text-gray-800 line-clamp-2">{g.label}</span>
                            <span className="text-[9px] text-gray-400 block mt-0.5">
                              P{g.page_no} · No.{g.min_item}〜{g.max_item}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 px-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 mb-1">開始番号</p>
                      <input
                        type="number"
                        value={startNum}
                        onChange={e => setStartNum(Number(e.target.value))}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 font-black text-indigo-600 focus:outline-none focus:border-indigo-300 text-center"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 mb-1">終了番号</p>
                      <input
                        type="number"
                        value={endNum}
                        onChange={e => setEndNum(Number(e.target.value))}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 font-black text-indigo-600 focus:outline-none focus:border-indigo-300 text-center"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-300 text-center uppercase font-bold tracking-tight">
                    Range: {absMin} - {absMax}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-500">出題数</p>
                <p className="text-[9px] text-gray-400">
                  範囲内をシャッフルして出す語数（いちらん・暗記・ならべかえ）。タイムアタックは別仕様のため未適用です。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionPickMode('all')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition ${questionPickMode === 'all' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                  >
                    範囲の全語
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionPickMode('random')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition ${questionPickMode === 'random' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                  >
                    ランダム
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
                        className="w-16 border border-gray-200 rounded-xl px-2 py-1.5 text-center font-bold text-sm"
                        aria-label="ランダム出題数"
                      />
                      <span className="text-xs text-gray-600">語</span>
                      <span className="text-[10px] text-gray-400">（最大 {rangeSpan}）</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[10, 20, 30, 50, 100].map(n => {
                        const tooBig = n > rangeSpan
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={tooBig}
                            onClick={() => setRandomQuestionCount(String(Math.min(n, rangeSpan)))}
                            className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${tooBig ? 'opacity-40 cursor-not-allowed border-gray-100' : 'bg-gray-50 border-gray-200'}`}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => navigate('list')}
                className="aspect-square bg-white border-2 border-gray-100 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition group"
              >
                <span className="text-3xl group-hover:scale-110 transition">📖</span>
                <span className="font-black text-xs text-gray-700">いちらんで見る</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('study')}
                className="aspect-square bg-indigo-600 border-2 border-indigo-700 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition group text-white"
              >
                <span className="text-3xl group-hover:scale-110 transition">📚</span>
                <span className="font-black text-xs">暗記度チェック</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('anagram')}
                className="aspect-square bg-white border-2 border-orange-200 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition group"
              >
                <span className="text-3xl group-hover:scale-110 transition">🧩</span>
                <span className="font-black text-xs text-orange-600">ならべかえ</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('attack')}
                className="aspect-square bg-gradient-to-br from-orange-400 to-red-500 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition group text-white"
              >
                <span className="text-3xl group-hover:scale-110 transition">⚡</span>
                <span className="font-black text-xs">タイムアタック</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FlashTopPage() {
  return (
    <Suspense>
      <FlashTopContent />
    </Suspense>
  )
}
