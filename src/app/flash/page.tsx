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
  const [showPageList, setShowPageList] = useState(false)

  // 選択範囲
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(1)
  const [totalWordCount, setTotalWordCount] = useState(0)

  useEffect(() => {
    async function init() {
      const { data: booksData } = await supabase.from('flashcard_books').select('*').order('id')
      setBooks(booksData ?? [])
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
    if (!cards) return

    const pageMap = new Map<number, PageGroup>()
    cards.filter(c => c.page_no).forEach(c => {
      if (!pageMap.has(c.page_no)) pageMap.set(c.page_no, { page_no: c.page_no, set_id: c.set_id, min_item: c.item_no, max_item: c.item_no, count: 0 })
      const g = pageMap.get(c.page_no)!
      g.min_item = Math.min(g.min_item, c.item_no); g.max_item = Math.max(g.max_item, c.item_no); g.count++
    })
    const groups = Array.from(pageMap.values()).sort((a, b) => a.page_no - b.page_no)
    setPageGroups(groups)
    if (groups.length > 0) { setStartPage(groups[0].page_no); setEndPage(groups[groups.length - 1].page_no) }
  }

  useEffect(() => {
    const count = pageGroups.filter(g => g.page_no >= startPage && g.page_no <= endPage).reduce((s, g) => s + g.count, 0)
    setTotalWordCount(count)
  }, [startPage, endPage, pageGroups])

  const navigate = (mode: string) => {
    const inRange = pageGroups.filter(g => g.page_no >= startPage && g.page_no <= endPage)
    if (inRange.length === 0) return
    const sItem = Math.min(...inRange.map(g => g.min_item))
    const eItem = Math.max(...inRange.map(g => g.max_item))
    const setId = inRange[0].set_id
    const base = `?id=${setId}&setName=${encodeURIComponent(selectedBook?.title || '')}&start=${sItem}&end=${eItem}&bookId=${selectedBook?.id}`
    router.push(`/flash/${mode}${base}`)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] text-yellow-600 font-bold animate-pulse text-2xl">🐕 準備中...</div>

  return (
    <div className="min-h-screen bg-[#FFFDF0] pb-10 font-sans text-gray-800">
      <header className="bg-yellow-400 px-4 py-4 shadow-sm flex items-center justify-between sticky top-0 z-30">
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
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={() => setSelectedBook(null)} className="text-indigo-500 font-bold text-sm">← 教材をえらびなおす</button>
            
            {/* 範囲選択カード */}
            <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-yellow-200 space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <span className="text-3xl">{selectedBook.cover_emoji}</span>
                <div>
                  <h2 className="font-black text-gray-800 leading-none">{selectedBook.title}</h2>
                  <p className="text-xs text-indigo-500 font-bold mt-1">選択中: p.{startPage} 〜 p.{endPage} ({totalWordCount}語)</p>
                </div>
              </div>

              {/* 簡易スライダー */}
              <div className="space-y-4 px-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                  <span>Start Page</span>
                  <span>End Page</span>
                </div>
                <div className="flex items-center gap-4">
                  <input type="range" min={pageGroups[0]?.page_no} max={endPage} value={startPage} onChange={e => setStartPage(Number(e.target.value))} className="flex-1 accent-indigo-500 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                  <span className="font-black text-indigo-600 w-8 text-center text-lg">{startPage}</span>
                </div>
                <div className="flex items-center gap-4">
                  <input type="range" min={startPage} max={pageGroups[pageGroups.length-1]?.page_no} value={endPage} onChange={e => setEndPage(Number(e.target.value))} className="flex-1 accent-indigo-500 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                  <span className="font-black text-indigo-600 w-8 text-center text-lg">{endPage}</span>
                </div>
              </div>

              {/* ページ一覧トグル */}
              <button onClick={() => setShowPageList(!showPageList)} className="w-full text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest py-1 border-y border-gray-50">
                {showPageList ? '▲ Close List' : '▼ View All Pages'}
              </button>
              
              {showPageList && (
                <div className="grid grid-cols-5 gap-2 animate-in fade-in slide-in-from-top-2">
                  {pageGroups.map(g => (
                    <button key={g.page_no} onClick={() => {setStartPage(g.page_no); setEndPage(g.page_no)}} className={`py-2 rounded-lg text-xs font-bold border transition ${g.page_no >= startPage && g.page_no <= endPage ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-gray-50 text-gray-400 border-transparent'}`}>
                      p.{g.page_no}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* モード選択タイル */}
            <div className="grid grid-cols-2 gap-3 pb-10">
              <button onClick={() => navigate('list')} className="aspect-square bg-white border-2 border-gray-100 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition group">
                <span className="text-3xl group-hover:scale-110 transition">📖</span>
                <span className="font-black text-sm text-gray-700">いちらん</span>
              </button>
              <button onClick={() => navigate('study')} className="aspect-square bg-indigo-600 border-2 border-indigo-700 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition group text-white">
                <span className="text-3xl group-hover:scale-110 transition">📚</span>
                <span className="font-black text-sm">あんき</span>
              </button>
              <button onClick={() => navigate('anagram')} className="aspect-square bg-white border-2 border-orange-200 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition group">
                <span className="text-3xl group-hover:scale-110 transition">🧩</span>
                <span className="font-black text-sm text-orange-600">パズる</span>
              </button>
              <button onClick={() => navigate('attack')} className="aspect-square bg-gradient-to-br from-orange-400 to-red-500 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition group text-white">
                <span className="text-3xl group-hover:scale-110 transition">⚡</span>
                <span className="font-black text-sm">ちょうせん</span>
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