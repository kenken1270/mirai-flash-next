'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = { id: number; title: string; subtitle: string; category: string; cover_emoji: string }
type PageGroup = { page_no: number; set_id: number; min_item: number; max_item: number; count: number }

function FlashTopContent() {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [pageGroups, setPageGroups] = useState<PageGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeMode, setRangeMode] = useState<'page' | 'num'>('page')
  const [showPageList, setShowPageList] = useState(false)

  // 選択範囲（ページ用）
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(1)
  // 選択範囲（番号用）
  const [startNum, setStartNum] = useState(1)
  const [endNum, setEndNum] = useState(100)
  const [absMin, setAbsMin] = useState(1)
  const [absMax, setAbsMax] = useState(100)

  const [totalWordCount, setTotalWordCount] = useState(0)

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
    if (!sets) return
    const setIds = sets.map(s => s.id)
    const { data: cards } = await supabase.from('flashcards_v3').select('item_no, page_no, set_id').in('set_id', setIds).order('item_no')
    if (!cards || cards.length === 0) return

    const minNo = Math.min(...cards.map(c => c.item_no))
    const maxNo = Math.max(...cards.map(c => c.item_no))
    setAbsMin(minNo); setAbsMax(maxNo); setStartNum(minNo); setEndNum(Math.min(minNo + 19, maxNo))

    const pageMap = new Map<number, PageGroup>()
    cards.filter(c => c.page_no).forEach(c => {
      if (!pageMap.has(c.page_no)) pageMap.set(c.page_no, { page_no: c.page_no, set_id: c.set_id, min_item: c.item_no, max_item: c.item_no, count: 0 })
      const g = pageMap.get(c.page_no)!
      g.min_item = Math.min(g.min_item, c.item_no); g.max_item = Math.max(g.max_item, c.item_no); g.count++
    })
    const groups = Array.from(pageMap.values()).sort((a, b) => a.page_no - b.page_no)
    setPageGroups(groups)
    if (groups.length > 0) { 
      setStartPage(groups[0].page_no); 
      setEndPage(Math.min(groups[0].page_no + 1, groups[groups.length-1].page_no)) 
    }
  }

  useEffect(() => {
    if (rangeMode === 'page') {
      const count = pageGroups.filter(g => g.page_no >= startPage && g.page_no <= endPage).reduce((s, g) => s + g.count, 0)
      setTotalWordCount(count)
    } else {
      setTotalWordCount(Math.max(0, endNum - startNum + 1))
    }
  }, [startPage, endPage, startNum, endNum, rangeMode, pageGroups])

  const navigate = (mode: string) => {
    let s, e, setId;
    if (rangeMode === 'page') {
      const inRange = pageGroups.filter(g => g.page_no >= startPage && g.page_no <= endPage)
      if (inRange.length === 0) return
      s = Math.min(...inRange.map(g => g.min_item))
      e = Math.max(...inRange.map(g => g.max_item))
      setId = inRange[0].set_id
    } else {
      s = startNum; e = endNum; setId = pageGroups[0]?.set_id || 1
    }
    const base = `?id=${setId}&setName=${encodeURIComponent(selectedBook?.title || '')}&start=${s}&end=${e}&bookId=${selectedBook?.id}`
    router.push(`/flash/${mode}${base}`)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] text-yellow-600 font-bold animate-pulse text-2xl">🐕 準備中...</div>

  return (
    <div className="min-h-screen bg-[#FFFDF0] pb-10 font-sans text-gray-800">
      <header className="bg-yellow-400 px-4 py-4 shadow-sm flex items-center justify-between sticky top-0 z-30 text-gray-900">
        <h1 className="text-xl font-black italic tracking-tighter">MIRAI FLASH</h1>
        <button onClick={() => router.push('/student')} className="text-sm bg-white/40 px-3 py-1 rounded-full font-bold">🏠 ﾎｰﾑ</button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {!selectedBook ? (
          <div className="space-y-3">
            <h2 className="text-lg font-bold px-1">📚 教材をえらぶ</h2>
            {books.map(book => (
              <button key={book.id} onClick={() => selectBook(book)} className="w-full bg-white p-4 rounded-2xl shadow-sm border-2 border-gray-100 flex items-center gap-4 active:scale-95 transition">
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
            <button onClick={() => setSelectedBook(null)} className="text-indigo-500 font-bold text-sm flex items-center gap-1">← もどる</button>
            
            <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-yellow-200 space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                <span className="text-3xl">{selectedBook.cover_emoji}</span>
                <div className="flex-1">
                  <h2 className="font-black text-gray-800 text-sm leading-tight">{selectedBook.title}</h2>
                  <p className="text-[10px] text-indigo-500 font-bold mt-1">
                    {rangeMode === 'page' ? `p.${startPage} 〜 p.${endPage}` : `No.${startNum} 〜 No.${endNum}`} ({totalWordCount}語)
                  </p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => setRangeMode('page')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${rangeMode === 'page' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>ページ</button>
                  <button onClick={() => setRangeMode('num')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${rangeMode === 'num' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>番号</button>
                </div>
              </div>

              {rangeMode === 'page' ? (
                <div className="space-y-4 px-1">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-gray-400 w-8">開始</span>
                      <input type="range" min={pageGroups[0]?.page_no} max={endPage} value={startPage} onChange={e => setStartPage(Number(e.target.value))} className="flex-1 accent-indigo-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                      <span className="font-black text-indigo-600 w-6 text-center text-sm">{startPage}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-gray-400 w-8">終了</span>
                      <input type="range" min={startPage} max={pageGroups[pageGroups.length-1]?.page_no} value={endPage} onChange={e => setEndPage(Number(e.target.value))} className="flex-1 accent-indigo-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                      <span className="font-black text-indigo-600 w-6 text-center text-sm">{endPage}</span>
                    </div>
                  </div>
                  <button onClick={() => setShowPageList(!showPageList)} className="w-full text-center text-[9px] font-bold text-gray-300 uppercase tracking-widest py-1 border-t border-gray-50">
                    {showPageList ? '▲ 閉じる' : '▼ 全ページ表示'}
                  </button>
                  {showPageList && (
                    <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto p-1">
                      {pageGroups.map(g => (
                        <button key={g.page_no} onClick={() => {setStartPage(g.page_no); setEndPage(g.page_no)}} className={`py-1.5 rounded-md text-[10px] font-bold border transition ${g.page_no >= startPage && g.page_no <= endPage ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-gray-50 text-gray-400 border-transparent'}`}>
                          p.{g.page_no}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 px-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 mb-1">開始番号</p>
                      <input type="number" value={startNum} onChange={e => setStartNum(Number(e.target.value))} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 font-black text-indigo-600 focus:outline-none focus:border-indigo-300 text-center" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 mb-1">終了番号</p>
                      <input type="number" value={endNum} onChange={e => setEndNum(Number(e.target.value))} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 font-black text-indigo-600 focus:outline-none focus:border-indigo-300 text-center" />
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-300 text-center uppercase font-bold tracking-tight">Range: {absMin} - {absMax}</p>
                </div>
              )}
            </div>

            {/* モード選択タイル */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('list')} className="aspect-square bg-white border-2 border-gray-100 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition group">
                <span className="text-3xl group-hover:scale-110 transition">📖</span>
                <span className="font-black text-xs text-gray-700">いちらんで見る</span>
              </button>
              <button onClick={() => navigate('study')} className="aspect-square bg-indigo-600 border-2 border-indigo-700 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition group text-white">
                <span className="text-3xl group-hover:scale-110 transition">📚</span>
                <span className="font-black text-xs">暗記度チェック</span>
              </button>
              <button onClick={() => navigate('anagram')} className="aspect-square bg-white border-2 border-orange-200 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition group">
                <span className="text-3xl group-hover:scale-110 transition">🧩</span>
                <span className="font-black text-xs text-orange-600">ならべかえ</span>
              </button>
              <button onClick={() => navigate('attack')} className="aspect-square bg-gradient-to-br from-orange-400 to-red-500 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition group text-white">
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
  return <Suspense><FlashTopContent /></Suspense>
}