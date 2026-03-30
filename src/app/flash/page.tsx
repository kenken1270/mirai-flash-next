'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = {
  id: number
  title: string
  subtitle: string
  publisher: string
  category: string
  grade: string
  cover_emoji: string
  description: string
}

type PageGroup = {
  page_no: number
  set_id: number
  set_name: string
  min_item: number
  max_item: number
  count: number
}

export default function FlashTopPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [pageGroups, setPageGroups] = useState<PageGroup[]>([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [selectMode, setSelectMode] = useState<'page' | 'word'>('page')

  // ページ選択
  const [startPage, setStartPage] = useState(0)
  const [endPage, setEndPage] = useState(0)

  // 単語番号選択
  const [totalMin, setTotalMin] = useState(1)
  const [totalMax, setTotalMax] = useState(100)
  const [startWord, setStartWord] = useState(1)
  const [endWord, setEndWord] = useState(100)

  const [wordCount, setWordCount] = useState(0)
  const [allPages, setAllPages] = useState<number[]>([])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)
      const { data: booksData } = await supabase.from('flashcard_books').select('*').order('id')
      setBooks(booksData ?? [])
      setLoading(false)
    }
    init()
  }, [router])

  async function selectBook(book: Book) {
    setSelectedBook(book)
    setLoadingPages(true)
    setStartPage(0)
    setEndPage(0)

    const { data: setsData } = await supabase
      .from('flashcard_sets')
      .select('id, set_name')
      .eq('book_id', book.id)
      .order('id')

    if (!setsData || setsData.length === 0) {
      setPageGroups([])
      setLoadingPages(false)
      return
    }

    const setIds = setsData.map(s => s.id)
    const setMap = new Map(setsData.map(s => [s.id, s.set_name]))

    const { data: cards } = await supabase
      .from('flashcards_v3')
      .select('item_no, page_no, set_id')
      .in('set_id', setIds)
      .order('item_no')

    if (!cards || cards.length === 0) {
      setPageGroups([])
      setLoadingPages(false)
      return
    }

    // 単語番号の全体範囲
    const minNo = Math.min(...cards.map(c => c.item_no))
    const maxNo = Math.max(...cards.map(c => c.item_no))
    setTotalMin(minNo)
    setTotalMax(maxNo)
    setStartWord(minNo)
    setEndWord(maxNo)

    // page_noが設定されているものでページグループ作成
    const paged = cards.filter(c => c.page_no != null)
    const pageMap = new Map<number, { set_id: number; min: number; max: number; count: number }>()
    for (const card of paged) {
      const p = card.page_no
      if (!pageMap.has(p)) pageMap.set(p, { set_id: card.set_id, min: card.item_no, max: card.item_no, count: 0 })
      const entry = pageMap.get(p)!
      entry.min = Math.min(entry.min, card.item_no)
      entry.max = Math.max(entry.max, card.item_no)
      entry.count++
    }

    const groups: PageGroup[] = Array.from(pageMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([page_no, v]) => ({
        page_no,
        set_id: v.set_id,
        set_name: setMap.get(v.set_id) ?? '',
        min_item: v.min,
        max_item: v.max,
        count: v.count,
      }))

    setPageGroups(groups)
    setAllPages(groups.map(g => g.page_no))
    if (groups.length > 0) {
      setStartPage(groups[0].page_no)
      setEndPage(groups[groups.length - 1].page_no)
    }
    setLoadingPages(false)
  }

  function getPageSelection() {
    const inRange = pageGroups.filter(p => p.page_no >= startPage && p.page_no <= endPage)
    if (inRange.length === 0) return { start: totalMin, end: totalMax, count: 0, setId: pageGroups[0]?.set_id ?? 0 }
    const start = Math.min(...inRange.map(p => p.min_item))
    const end = Math.max(...inRange.map(p => p.max_item))
    const count = inRange.reduce((s, p) => s + p.count, 0)
    const setId = inRange[0].set_id
    return { start, end, count, setId }
  }

  function getWordSelection() {
    return {
      start: startWord,
      end: endWord,
      count: endWord - startWord + 1,
      setId: pageGroups[0]?.set_id ?? 0,
    }
  }

  useEffect(() => {
    if (selectMode === 'page' && pageGroups.length > 0 && startPage > 0) {
      setWordCount(getPageSelection().count)
    } else if (selectMode === 'word') {
      setWordCount(Math.max(0, endWord - startWord + 1))
    }
  }, [startPage, endPage, startWord, endWord, selectMode, pageGroups])

  function getCategoryColor(category: string) {
    if (category?.includes('英検')) return 'from-orange-400 to-red-500'
    if (category?.includes('日本語')) return 'from-blue-500 to-indigo-500'
    if (category?.includes('中国語')) return 'from-red-500 to-pink-500'
    return 'from-purple-500 to-indigo-500'
  }

  function navigate(mode: 'list' | 'study' | 'attack') {
    const sel = selectMode === 'page' ? getPageSelection() : getWordSelection()
    const setName = encodeURIComponent(selectedBook?.title ?? '')
    const base = `?id=${sel.setId}&setName=${setName}&start=${sel.start}&end=${sel.end}&bookId=${selectedBook?.id}`
    if (mode === 'list') router.push('/flash/list' + base)
    if (mode === 'study') router.push('/flash/study' + base)
    if (mode === 'attack') router.push('/flash/attack' + base)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-5xl animate-bounce">🃏</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 pb-10">
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🃏 単語学習</h1>
            <p className="text-sm opacity-80 mt-0.5">{username} さん</p>
          </div>
          <button onClick={() => router.push('/student')}
            className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition">
            🏠 ホームへ
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        <button onClick={() => router.push('/flash/graph')}
          className="w-full py-3 bg-white rounded-2xl shadow-sm border border-indigo-100 hover:shadow-md hover:border-indigo-300 transition flex items-center justify-center gap-2 text-indigo-600 font-bold">
          <span className="text-xl">📈</span>学習グラフを見る
        </button>

        {/* 本一覧 */}
        {!selectedBook && (
          <div className="space-y-3">
            <h2 className="font-bold text-gray-700 px-1">📚 教材を選んでください</h2>
            {books.map(book => (
              <button key={book.id} onClick={() => selectBook(book)}
                className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition p-4 text-left">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getCategoryColor(book.category)} flex items-center justify-center flex-shrink-0 shadow text-3xl`}>
                    {book.cover_emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800">{book.title}</p>
                    {book.subtitle && <p className="text-xs text-gray-400">{book.subtitle}</p>}
                    <div className="flex gap-2 mt-1">
                      {book.publisher && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{book.publisher}</span>}
                      {book.grade && <span className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">{book.grade}</span>}
                    </div>
                  </div>
                  <span className="text-gray-300 text-2xl">›</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ページ・単語選択UI */}
        {selectedBook && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedBook(null)}
                className="text-sm text-indigo-500 hover:text-indigo-700">
                ← 教材一覧
              </button>
              <span className="text-gray-300">›</span>
              <span className="text-sm font-bold text-gray-700 truncate">{selectedBook.title}</span>
            </div>

            <div className={`p-4 rounded-2xl bg-gradient-to-r ${getCategoryColor(selectedBook.category)} text-white shadow`}>
              <p className="text-2xl">{selectedBook.cover_emoji}</p>
              <p className="font-bold mt-1">{selectedBook.title}</p>
              {selectedBook.subtitle && <p className="text-xs opacity-80">{selectedBook.subtitle}</p>}
            </div>

            {loadingPages ? (
              <div className="text-center py-8">
                <div className="text-3xl animate-bounce">📄</div>
                <p className="text-gray-400 text-sm mt-2">読み込み中...</p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* モード切替タブ */}
                <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex gap-1.5">
                  <button
                    onClick={() => setSelectMode('page')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${
                      selectMode === 'page'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-indigo-500'
                    }`}>
                    📄 ページで選ぶ
                  </button>
                  <button
                    onClick={() => setSelectMode('word')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${
                      selectMode === 'word'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-indigo-500'
                    }`}>
                    🔢 単語番号で選ぶ
                  </button>
                </div>

                {/* ページ選択モード */}
                {selectMode === 'page' && (
                  <div className="space-y-3">
                    {pageGroups.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                        <p className="text-amber-600 text-sm">このセクションはページデータが未設定です</p>
                        <p className="text-amber-500 text-xs mt-1">「単語番号で選ぶ」をお使いください</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                          <p className="text-xs font-bold text-gray-400 mb-3">
                            📄 ページをタップして範囲を選択
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {pageGroups.map(pg => {
                              const inRange = pg.page_no >= startPage && pg.page_no <= endPage
                              const isEdge = pg.page_no === startPage || pg.page_no === endPage
                              return (
                                <button key={pg.page_no}
                                  onClick={() => {
                                    if (pg.page_no < startPage) {
                                      setStartPage(pg.page_no)
                                    } else if (pg.page_no > endPage) {
                                      setEndPage(pg.page_no)
                                    } else if (pg.page_no === startPage && pg.page_no !== endPage) {
                                      setStartPage(pageGroups[pageGroups.findIndex(p => p.page_no === endPage)].page_no)
                                      setEndPage(pageGroups[pageGroups.findIndex(p => p.page_no === endPage)].page_no)
                                    } else {
                                      setStartPage(pg.page_no)
                                      setEndPage(pg.page_no)
                                    }
                                  }}
                                  className={`py-2 px-1 rounded-xl text-sm font-bold transition border ${
                                    isEdge
                                      ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300'
                                      : inRange
                                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300'
                                  }`}>
                                  p.{pg.page_no}
                                  <span className="block text-xs opacity-70">{pg.count}語</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* ページ手動入力 */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                          <p className="text-xs font-bold text-gray-400 mb-2">✏️ ページ番号を直接入力</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="text-xs text-gray-400">開始ページ</label>
                              <input type="number" value={startPage || ''}
                                onChange={e => setStartPage(parseInt(e.target.value) || 0)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-indigo-600 focus:outline-none focus:border-indigo-400 mt-1" />
                            </div>
                            <span className="text-gray-400 font-bold mt-5">〜</span>
                            <div className="flex-1">
                              <label className="text-xs text-gray-400">終了ページ</label>
                              <input type="number" value={endPage || ''}
                                onChange={e => setEndPage(parseInt(e.target.value) || 0)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-indigo-600 focus:outline-none focus:border-indigo-400 mt-1" />
                            </div>
                          </div>
                        </div>

                        {/* クイック選択 */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                          <p className="text-xs font-bold text-gray-400 mb-2">⚡ クイック選択</p>
                          <div className="flex gap-2 flex-wrap">
                            {[2,4,6].map(n => {
                              if (allPages.length < n) return null
                              const count = pageGroups.filter(p => p.page_no <= allPages[n-1]).reduce((s, p) => s + p.count, 0)
                              return (
                                <button key={n}
                                  onClick={() => { setStartPage(allPages[0]); setEndPage(allPages[n-1]) }}
                                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition">
                                  最初の{count}語
                                </button>
                              )
                            })}
                            <button
                              onClick={() => { setStartPage(allPages[0]); setEndPage(allPages[allPages.length-1]) }}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition">
                              全部（{pageGroups.reduce((s,p)=>s+p.count,0)}語）
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 単語番号選択モード */}
                {selectMode === 'word' && (
                  <div className="space-y-3">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 mb-3">🔢 単語番号で範囲を指定</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-gray-400">開始番号</label>
                          <input type="number"
                            value={startWord}
                            min={totalMin}
                            max={totalMax}
                            onChange={e => setStartWord(parseInt(e.target.value) || totalMin)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-indigo-600 focus:outline-none focus:border-indigo-400 mt-1 text-lg" />
                        </div>
                        <span className="text-gray-400 font-bold mt-5">〜</span>
                        <div className="flex-1">
                          <label className="text-xs text-gray-400">終了番号</label>
                          <input type="number"
                            value={endWord}
                            min={totalMin}
                            max={totalMax}
                            onChange={e => setEndWord(parseInt(e.target.value) || totalMax)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-indigo-600 focus:outline-none focus:border-indigo-400 mt-1 text-lg" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        この教材の範囲: {totalMin}番 〜 {totalMax}番
                      </p>
                    </div>

                    {/* クイック選択 */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 mb-2">⚡ クイック選択</p>
                      <div className="flex gap-2 flex-wrap">
                        {[10,20,30,50].map(n => (
                          <button key={n}
                            onClick={() => { setStartWord(totalMin); setEndWord(Math.min(totalMin + n - 1, totalMax)) }}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition">
                            最初の{n}語
                          </button>
                        ))}
                        <button
                          onClick={() => { setStartWord(totalMin); setEndWord(totalMax) }}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition">
                          全部（{totalMax - totalMin + 1}語）
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 選択中の単語数表示 */}
                <div className="bg-indigo-50 rounded-2xl p-4 text-center border border-indigo-100">
                  <p className="text-sm text-indigo-500">選択中の範囲</p>
                  {selectMode === 'page' ? (
                    <p className="text-2xl font-bold text-indigo-700 mt-1">p.{startPage} 〜 p.{endPage}</p>
                  ) : (
                    <p className="text-2xl font-bold text-indigo-700 mt-1">{startWord}番 〜 {endWord}番</p>
                  )}
                  <p className="text-lg font-bold text-indigo-600 mt-0.5">{wordCount} 単語</p>
                </div>

                {/* アクションボタン */}
                <div className="space-y-2 pb-6">
                  <button onClick={() => navigate('list')}
                    className="w-full py-3.5 bg-white border-2 border-indigo-400 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition">
                    📖 一覧で確認する
                  </button>
                  <button onClick={() => navigate('study')}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-bold shadow-md hover:opacity-90 transition">
                    📚 この範囲を暗記する
                  </button>
                  <button onClick={() => navigate('attack')}
                    className="w-full py-3.5 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-2xl font-bold shadow-md hover:opacity-90 transition">
                    ⚡ タイムアタックで挑戦
                  </button>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}