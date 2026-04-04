'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
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
  difficulty: number
}

type BookInfo = {
  lang1_label: string
  lang2_label: string
}

function getDifficultyRowColor(difficulty: number): string {
  switch (difficulty) {
    case 1: return 'bg-green-50'
    case 2: return 'bg-yellow-50'
    case 3: return 'bg-orange-50'
    case 4: return 'bg-red-50'
    default: return 'bg-white'
  }
}

function RedBlock({
  text,
  hidden,
  onReveal,
}: {
  text: string
  hidden: boolean
  onReveal: () => void
}) {
  if (!hidden) {
    return <span>{text || '—'}</span>
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); onReveal() }}
      className="inline-block bg-red-500 rounded px-3 py-0.5 min-w-[3rem] text-red-500 select-none cursor-pointer hover:bg-red-400 transition"
      style={{ userSelect: 'none' }}
      aria-label="タップして表示"
    >
      {text || '　'}
    </button>
  )
}

function FlashListContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const setId = searchParams.get('id')
  const bookId = searchParams.get('bookId')
  const setName = searchParams.get('setName') ?? '単語一覧'
  const start = Number(searchParams.get('start') ?? 1)
  const end = Number(searchParams.get('end') ?? 9999)

  const [cards, setCards] = useState<Card[]>([])
  const [bookInfo, setBookInfo] = useState<BookInfo>({ lang1_label: '単語', lang2_label: '日本語' })
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [diffFilter, setDiffFilter] = useState<number | null>(null)

  const [redSheetMode, setRedSheetMode] = useState(false)
  const [hideTargets, setHideTargets] = useState<Set<string>>(new Set(['lang1']))
  const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set())
  const [revealAll, setRevealAll] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      // book_id の特定（setId経由 or bookId直接）
      let resolvedBookId: number | null = bookId ? Number(bookId) : null

      if (setId && !resolvedBookId) {
        const { data: setData } = await supabase
          .from('flashcard_sets')
          .select('book_id')
          .eq('id', Number(setId))
          .single()
        if (setData) resolvedBookId = setData.book_id
      }

      // flashcard_books から lang1_label / lang2_label を取得
      if (resolvedBookId) {
        const { data: bookData } = await supabase
          .from('flashcard_books')
          .select('lang1_label, lang2_label')
          .eq('id', resolvedBookId)
          .single()
        if (bookData) {
          setBookInfo({
            lang1_label: bookData.lang1_label ?? '単語',
            lang2_label: bookData.lang2_label ?? '日本語',
          })
        }
      }

      // カード取得
      let query = supabase
        .from('flashcards_v3')
        .select('id, item_no, lang1, lang1_sub, lang2, lang2_sub, lang3, lang3_sub, difficulty')
        .gte('item_no', start)
        .lte('item_no', end)
        .order('item_no')

      if (setId) {
        query = query.eq('set_id', Number(setId))
      } else if (bookId) {
        const { data: sets } = await supabase
          .from('flashcard_sets')
          .select('id')
          .eq('book_id', Number(bookId))
        if (sets) {
          query = query.in('set_id', sets.map(s => s.id))
        }
      }

      const { data } = await query
      setCards(data ?? [])
      setLoading(false)
    }
    fetchData()
  }, [setId, bookId, start, end])

  const toggleHideTarget = (target: string) => {
    setHideTargets(prev => {
      const next = new Set(prev)
      if (next.has(target)) { next.delete(target) } else { next.add(target) }
      return next
    })
    setRevealedCells(new Set())
    setRevealAll(false)
  }

  const revealCell = (cardId: number, field: string) => {
    setRevealedCells(prev => {
      const next = new Set(prev)
      next.add(`${cardId}_${field}`)
      return next
    })
  }

  const isCellHidden = (cardId: number, field: string): boolean => {
    if (!redSheetMode) return false
    if (revealAll) return false
    if (!hideTargets.has(field)) return false
    return !revealedCells.has(`${cardId}_${field}`)
  }

  const filtered = cards.filter(c => {
    if (diffFilter && c.difficulty !== diffFilter) return false
    if (searchText) {
      const s = searchText.toLowerCase()
      return (
        c.lang1?.toLowerCase().includes(s) ||
        c.lang2?.toLowerCase().includes(s) ||
        c.lang1_sub?.toLowerCase().includes(s)
      )
    }
    return true
  })

  // lang1_label に応じてピンイン列ラベルを決定
  const pinyin_label = bookInfo.lang1_label === '中国語' ? 'ピンイン'
    : bookInfo.lang1_label === '英語' ? '発音記号'
    : 'よみ'

  // 中国語訳列：中国語教材はlang2_sub、英語教材はlang3_sub
  const isChinese = bookInfo.lang1_label === '中国語'
  const isEnglish = bookInfo.lang1_label === '英語' || bookInfo.lang1_label === '英単語' || bookInfo.lang1_label === '英検'
  const showLang2Sub = isChinese
  const showLang3Sub = isEnglish

  // チェックボックスの選択肢（教材に応じて動的）
  const hideOptions = [
    { key: 'lang1',     label: bookInfo.lang1_label },
    { key: 'lang1_sub', label: pinyin_label },
    { key: 'lang2',     label: bookInfo.lang2_label },
    ...(showLang2Sub ? [{ key: 'lang2_sub', label: '中国語訳' }] : []),
    ...(showLang3Sub ? [{ key: 'lang3_sub', label: '中国語訳' }] : []),
    { key: 'lang3',     label: '例文' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-yellow-500 text-2xl animate-pulse">🐕 読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ヘッダー */}
      <div className="bg-yellow-400 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow">
        <button onClick={() => router.back()} className="text-2xl font-bold">←</button>
        <h1 className="text-lg font-bold text-gray-900 truncate">📋 {setName}</h1>
        <span className="ml-auto bg-white text-yellow-700 font-bold text-base px-3 py-1 rounded-full">
          {filtered.length}件
        </span>
      </div>

      {/* 検索・難易度フィルター */}
      <div className="px-4 py-3 bg-white border-b space-y-2">
        <input
          type="text"
          placeholder="🔍 単語・日本語で検索"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        <div className="flex gap-2 flex-wrap">
          {[null, 1, 2, 3, 4].map(d => (
            <button
              key={d ?? 'all'}
              onClick={() => setDiffFilter(d)}
              className={`px-3 py-1 rounded-full text-sm font-bold border transition ${
                diffFilter === d
                  ? 'bg-yellow-400 border-yellow-400 text-white'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {d === null ? '全て' : '⭐'.repeat(d)}
            </button>
          ))}
        </div>
      </div>

      {/* 赤シートコントロール */}
      <div className="px-4 py-3 bg-red-50 border-b space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              setRedSheetMode(!redSheetMode)
              setRevealedCells(new Set())
              setRevealAll(false)
            }}
            className={`px-4 py-2 rounded-xl font-bold text-base transition ${
              redSheetMode ? 'bg-red-500 text-white' : 'bg-white border border-red-300 text-red-500'
            }`}
          >
            🟥 赤シート{redSheetMode ? ' ON' : ' OFF'}
          </button>
          {redSheetMode && (
            <>
              <button
                onClick={() => { setRevealAll(true); setRevealedCells(new Set()) }}
                className="px-3 py-2 rounded-xl border font-bold text-base bg-white border-gray-300 text-gray-700"
              >
                👁 全て表示
              </button>
              <button
                onClick={() => { setRevealAll(false); setRevealedCells(new Set()) }}
                className="px-3 py-2 rounded-xl border font-bold text-base bg-white border-gray-300 text-gray-700"
              >
                🙈 全て隠す
              </button>
            </>
          )}
        </div>

        {redSheetMode && (
          <>
            <div className="flex gap-4 flex-wrap">
              {hideOptions.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1 cursor-pointer text-base font-bold">
                  <input
                    type="checkbox"
                    checked={hideTargets.has(key)}
                    onChange={() => toggleHideTarget(key)}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-red-500 font-bold">🟥 赤いブロックをタップすると1つずつ表示されます</p>
          </>
        )}
      </div>

      {/* 単語テーブル */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 text-xl mt-20">該当する単語がありません</div>
      ) : (
        <div className="overflow-x-auto px-2 pt-3">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="bg-yellow-100 text-gray-700 text-base">
                <th className="px-2 py-2 text-center w-8">#</th>
                <th className="px-3 py-2 text-left">{bookInfo.lang1_label}</th>
                <th className="px-3 py-2 text-left">{pinyin_label}</th>
                <th className="px-3 py-2 text-left">{bookInfo.lang2_label}</th>
                {showLang2Sub && (
                  <th className="px-3 py-2 text-left text-red-600">中国語訳</th>
                )}
                {showLang3Sub && (
                  <th className="px-3 py-2 text-left text-red-600">中国語訳</th>
                )}
                <th className="px-3 py-2 text-left text-blue-600">例文</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(card => {
                const rowColor = getDifficultyRowColor(card.difficulty)
                return (
                  <tr key={card.id} className={`${rowColor} border-b border-gray-200`}>
                    <td className="px-2 py-3 text-center text-gray-400 text-sm font-mono">{card.item_no}</td>

                    {/* lang1（英語 or 中国語 or 日本語） */}
                    <td className="px-3 py-3 font-bold text-xl text-gray-900">
                      <RedBlock
                        text={card.lang1}
                        hidden={isCellHidden(card.id, 'lang1')}
                        onReveal={() => revealCell(card.id, 'lang1')}
                      />
                    </td>

                    {/* ピンイン / 発音記号 */}
                    <td className="px-3 py-3 text-base text-gray-500 italic">
                      <RedBlock
                        text={card.lang1_sub}
                        hidden={isCellHidden(card.id, 'lang1_sub')}
                        onReveal={() => revealCell(card.id, 'lang1_sub')}
                      />
                    </td>

                    {/* 日本語訳 */}
                    <td className="px-3 py-3 text-base text-gray-800">
                      <RedBlock
                        text={card.lang2}
                        hidden={isCellHidden(card.id, 'lang2')}
                        onReveal={() => revealCell(card.id, 'lang2')}
                      />
                    </td>

                    {/* 中国語訳（中国語教材のみ） */}
                    {showLang2Sub && (
                      <td className="px-3 py-3 text-base text-red-700 font-semibold">
                        <RedBlock
                          text={card.lang2_sub}
                          hidden={isCellHidden(card.id, 'lang2_sub')}
                          onReveal={() => revealCell(card.id, 'lang2_sub')}
                        />
                      </td>
                    )}

                    {/* 中国語訳（英語教材のみ・lang3_sub） */}
                    {showLang3Sub && (
                      <td className="px-3 py-3 text-base text-red-700 font-semibold">
                        <RedBlock
                          text={card.lang3_sub ?? ''}
                          hidden={isCellHidden(card.id, 'lang3_sub')}
                          onReveal={() => revealCell(card.id, 'lang3_sub')}
                        />
                      </td>
                    )}

                    {/* 例文 */}
                    <td className="px-3 py-3 text-sm text-blue-700 max-w-xs">
                      <RedBlock
                        text={card.lang3}
                        hidden={isCellHidden(card.id, 'lang3')}
                        onReveal={() => revealCell(card.id, 'lang3')}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 下部ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex gap-3">
        <button
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-base"
        >
          ← 範囲選択
        </button>
        <button
          onClick={() => {
            const params = new URLSearchParams()
            if (setId) params.set('id', setId)
            if (bookId) params.set('bookId', bookId)
            params.set('start', String(start))
            params.set('end', String(end))
            router.push(`/flash/study?${params.toString()}`)
          }}
          className="flex-1 py-3 rounded-xl bg-yellow-400 text-gray-900 font-bold text-base shadow"
        >
          🚀 この範囲で学習
        </button>
      </div>
    </div>
  )
}

export default function FlashListPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 text-yellow-500 text-2xl animate-pulse">
        🐕 読み込み中...
      </div>
    }>
      <FlashListContent />
    </Suspense>
  )
}
