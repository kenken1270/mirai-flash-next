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
  difficulty: number
}

function getDifficultyRowColor(difficulty: number): string {
  switch (difficulty) {
    case 1: return 'bg-green-50 hover:bg-green-100'
    case 2: return 'bg-yellow-50 hover:bg-yellow-100'
    case 3: return 'bg-orange-50 hover:bg-orange-100'
    case 4: return 'bg-red-50 hover:bg-red-100'
    default: return 'bg-white hover:bg-gray-50'
  }
}

function maskText(text: string): string {
  if (!text) return '？'
  return '？'.repeat(Math.min(text.length, 8))
}

// ① lang1の文字コードで言語判定（lang3の例文に引きずられないよう修正）
function detectLang(lang1: string): 'zh' | 'en' | 'ja' {
  if (!lang1) return 'ja'
  const code = lang1.charCodeAt(0)
  if (code >= 0x4E00 && code <= 0x9FFF) return 'zh'
  if (code >= 0x3040 && code <= 0x30FF) return 'ja'
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return 'en'
  return 'ja'
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
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [diffFilter, setDiffFilter] = useState<number | null>(null)

  const [redSheetMode, setRedSheetMode] = useState(false)
  // ② チェックボックスで複数選択できるよう Set で管理
  const [hideTargets, setHideTargets] = useState<Set<string>>(new Set(['lang1']))
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())
  const [revealAll, setRevealAll] = useState(false)

  useEffect(() => {
    async function fetchCards() {
      setLoading(true)
      let query = supabase
        .from('flashcards_v3')
        .select('id, item_no, lang1, lang1_sub, lang2, lang2_sub, lang3, difficulty')
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
    fetchCards()
  }, [setId, bookId, start, end])

  const toggleHideTarget = (target: string) => {
    setHideTargets(prev => {
      const next = new Set(prev)
      if (next.has(target)) { next.delete(target) } else { next.add(target) }
      return next
    })
  }

  const toggleReveal = (id: number) => {
    setRevealedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
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

  const isHidden = (cardId: number, field: string): boolean => {
    if (!redSheetMode) return false
    if (revealAll) return false
    if (revealedIds.has(cardId)) return false
    return hideTargets.has(field)
  }

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
        <h1 className="text-xl font-bold text-gray-900 truncate">📋 {setName}</h1>
        <span className="ml-auto bg-white text-yellow-700 font-bold text-base px-3 py-1 rounded-full">
          {filtered.length}件
        </span>
      </div>

      {/* 検索・フィルター */}
      <div className="px-4 py-3 bg-white border-b space-y-2">
        <input
          type="text"
          placeholder="🔍 単語・日本語・ピンインで検索"
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
              {d === null ? '全て' : d === 1 ? '⭐' : d === 2 ? '⭐⭐' : d === 3 ? '⭐⭐⭐' : '⭐⭐⭐⭐'}
            </button>
          ))}
        </div>
      </div>

      {/* 赤シートコントロール */}
      <div className="px-4 py-3 bg-red-50 border-b">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => { setRedSheetMode(!redSheetMode); setRevealedIds(new Set()); setRevealAll(false) }}
            className={`px-4 py-2 rounded-xl font-bold text-base transition ${
              redSheetMode ? 'bg-red-500 text-white' : 'bg-white border border-red-300 text-red-500'
            }`}
          >
            🟥 赤シート{redSheetMode ? 'ON' : 'OFF'}
          </button>
          {redSheetMode && (
            <>
              <button
                onClick={() => setRevealAll(!revealAll)}
                className="px-3 py-2 rounded-xl border font-bold text-base bg-white border-gray-300"
              >
                {revealAll ? '🙈 全て隠す' : '👁 全て表示'}
              </button>
            </>
          )}
        </div>

        {/* ② チェックボックスで隠す項目を複数選択 */}
        {redSheetMode && (
          <div className="flex gap-4 flex-wrap text-base font-bold">
            {[
              { key: 'lang1', label: '中国語' },
              { key: 'lang1_sub', label: 'ピンイン' },
              { key: 'lang2', label: '日本語' },
              { key: 'lang3', label: '例文' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideTargets.has(key)}
                  onChange={() => toggleHideTarget(key)}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-gray-700">{label}を隠す</span>
              </label>
            ))}
          </div>
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
                <th className="px-2 py-2 text-center w-10">#</th>
                <th className="px-3 py-2 text-left">中国語</th>
                <th className="px-3 py-2 text-left">ピンイン</th>
                <th className="px-3 py-2 text-left">日本語</th>
                {/* ④ 中国語訳（lang2_sub）は常時表示列として固定 */}
                <th className="px-3 py-2 text-left text-red-600">中国語訳</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(card => {
                const lang = detectLang(card.lang1)  // ① lang1で言語判定
                const rowColor = getDifficultyRowColor(card.difficulty)
                const revealed = revealedIds.has(card.id)

                return (
                  <tr
                    key={card.id}
                    className={`${rowColor} border-b border-gray-200 cursor-pointer transition`}
                    onClick={() => redSheetMode && toggleReveal(card.id)}
                  >
                    <td className="px-2 py-3 text-center text-gray-400 text-sm font-mono">{card.item_no}</td>

                    {/* 中国語 */}
                    <td className="px-3 py-3 font-bold text-xl text-gray-900">
                      {isHidden(card.id, 'lang1')
                        ? <span className="text-red-400 tracking-widest">{maskText(card.lang1)}</span>
                        : card.lang1}
                    </td>

                    {/* ピンイン */}
                    <td className="px-3 py-3 text-base text-gray-500 italic">
                      {isHidden(card.id, 'lang1_sub')
                        ? <span className="text-red-400">{maskText(card.lang1_sub)}</span>
                        : card.lang1_sub}
                    </td>

                    {/* 日本語 */}
                    <td className="px-3 py-3 text-base text-gray-800">
                      {isHidden(card.id, 'lang2')
                        ? <span className="text-red-400">{maskText(card.lang2)}</span>
                        : card.lang2}
                    </td>

                    {/* ④ 中国語訳（lang2_sub）は赤シートONでも隠さず常時表示 */}
                    <td className="px-3 py-3 text-base text-red-700 font-semibold">
                      {card.lang2_sub || '—'}
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
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-yellow-500 text-2xl animate-pulse">🐕 読み込み中...</div>}>
      <FlashListContent />
    </Suspense>
  )
}
