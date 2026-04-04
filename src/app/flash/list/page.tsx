'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

type Card = {
  id: number
  item_no: number
  page_no: number
  lang1: string
  lang1_sub: string
  lang2: string
  lang2_sub: string
  lang3: string
  difficulty: number
  set_id: number
}

type SetInfo = {
  id: number
  set_name: string
}

function FlashListInner() {
  const router = useRouter()
  const params = useSearchParams()
  const setId = parseInt(params.get('id') ?? '0')
  const start = parseInt(params.get('start') ?? '1')
  const end = parseInt(params.get('end') ?? '9999')
  const bookId = parseInt(params.get('bookId') ?? '0')
  const setName = decodeURIComponent(params.get('setName') ?? '')

  const [cards, setCards] = useState<Card[]>([])
  const [sets, setSets] = useState<SetInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSetId, setSelectedSetId] = useState<number | 'all'>('all')
  const [showChinese, setShowChinese] = useState(true)
  const [showPinyin, setShowPinyin] = useState(true)
  const [showJapanese, setShowJapanese] = useState(true)
  const [showExample, setShowExample] = useState(false)
  const [diffFilter, setDiffFilter] = useState<number | 'all'>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      // セット一覧取得
      const { data: setsData } = await supabase
        .from('flashcard_sets')
        .select('id, set_name')
        .eq('book_id', bookId)
        .order('id')
      setSets(setsData ?? [])

      // カード取得（book全体 or 範囲指定）
      const setIds = (setsData ?? []).map((s: SetInfo) => s.id)
      if (setIds.length === 0) { setLoading(false); return }

      const { data: cardsData } = await supabase
        .from('flashcards_v3')
        .select('id, item_no, page_no, lang1, lang1_sub, lang2, lang2_sub, lang3, difficulty, set_id')
        .in('set_id', setIds)
        .gte('item_no', start)
        .lte('item_no', end)
        .order('item_no')

      setCards(cardsData ?? [])
      setLoading(false)
    }
    if (bookId) load()
  }, [bookId, start, end])

  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      const matchSet = selectedSetId === 'all' || c.set_id === selectedSetId
      const matchDiff = diffFilter === 'all' || c.difficulty === diffFilter
      const matchSearch = search === '' ||
        c.lang1.includes(search) ||
        c.lang2.includes(search) ||
        (c.lang1_sub ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.lang2_sub ?? '').includes(search)
      return matchSet && matchDiff && matchSearch
    })
  }, [cards, selectedSetId, diffFilter, search])

  const setCardCount = useMemo(() => {
    const map = new Map<number, number>()
    cards.forEach(c => map.set(c.set_id, (map.get(c.set_id) ?? 0) + 1))
    return map
  }, [cards])

  function diffLabel(d: number) {
    return ['', '★', '★★', '★★★', '★★★★'][d] ?? '?'
  }
  function diffColor(d: number) {
    return ['', 'text-green-500', 'text-blue-500', 'text-orange-500', 'text-red-500'][d] ?? ''
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-5xl animate-bounce">🐕</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FFFDF0] pb-10">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-yellow-400 to-amber-400 text-white px-4 py-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">📋 単語一覧</h1>
            <p className="text-xs opacity-80 mt-0.5">{setName}</p>
          </div>
          <button onClick={() => router.back()}
            className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition">
            ← 戻る
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-3">

        {/* セット別タブ */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedSetId('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold transition ${
              selectedSetId === 'all'
                ? 'bg-amber-400 text-white shadow'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}>
            全セット ({cards.length})
          </button>
          {sets.map(s => (
            <button key={s.id}
              onClick={() => setSelectedSetId(s.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold transition ${
                selectedSetId === s.id
                  ? 'bg-amber-400 text-white shadow'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              {s.set_name.replace(/^.*?[:：]?\s*/, '').slice(0, 12)} ({setCardCount.get(s.id) ?? 0})
            </button>
          ))}
        </div>

        {/* 検索バー */}
        <div className="bg-white rounded-2xl px-4 py-2 shadow-sm border border-gray-100 flex items-center gap-2">
          <span className="text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="単語・日本語・ピンインで検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 outline-none text-sm text-gray-700"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 text-xs">✕</button>
          )}
        </div>

        {/* フィルター・表示設定 */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400">難易度：</span>
            {(['all', 1, 2, 3, 4] as const).map(d => (
              <button key={d}
                onClick={() => setDiffFilter(d)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                  diffFilter === d ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                {d === 'all' ? 'すべて' : diffLabel(d)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-gray-400">表示：</span>
            {[
              { label: '中国語', state: showChinese, set: setShowChinese },
              { label: 'ピンイン', state: showPinyin, set: setShowPinyin },
              { label: '日本語', state: showJapanese, set: setShowJapanese },
              { label: '例文', state: showExample, set: setShowExample },
            ].map(({ label, state, set }) => (
              <button key={label}
                onClick={() => set(!state)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                  state ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
                }`}>
                {state ? '✓' : ''} {label}
              </button>
            ))}
          </div>
        </div>

        {/* 件数表示 */}
        <p className="text-xs text-gray-400 text-right">{filteredCards.length} 件表示中</p>

        {/* 単語テーブル */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50 border-b border-amber-100">
                  <th className="px-3 py-2 text-left text-xs font-bold text-amber-700 w-12">No.</th>
                  {showChinese && <th className="px-3 py-2 text-left text-xs font-bold text-amber-700">中国語</th>}
                  {showPinyin && <th className="px-3 py-2 text-left text-xs font-bold text-amber-700">ピンイン</th>}
                  {showJapanese && <th className="px-3 py-2 text-left text-xs font-bold text-amber-700">日本語</th>}
                  <th className="px-3 py-2 text-center text-xs font-bold text-amber-700 w-16">難易度</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((card, i) => (
                  <tr key={card.id}
                    className={`border-b border-gray-50 hover:bg-amber-50 transition ${
                      i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}>
                    <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{card.item_no}</td>
                    {showChinese && (
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-gray-800 text-base">{card.lang1}</span>
                        {card.lang2_sub && (
                          <span className="ml-1 text-xs text-red-400">（{card.lang2_sub}）</span>
                        )}
                      </td>
                    )}
                    {showPinyin && (
                      <td className="px-3 py-2.5 text-xs text-indigo-500 font-medium">{card.lang1_sub}</td>
                    )}
                    {showJapanese && (
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        <div>{card.lang2}</div>
                        {showExample && card.lang3 && (
                          <div className="text-gray-400 mt-0.5 text-xs border-t border-gray-100 pt-0.5">{card.lang3}</div>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs ${diffColor(card.difficulty)}`}>
                        {diffLabel(card.difficulty)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCards.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">🐕</div>
                <p className="text-sm">該当する単語が見つかりません</p>
              </div>
            )}
          </div>
        </div>

        {/* 学習ボタン */}
        <div className="grid grid-cols-2 gap-3 pb-6">
          <button onClick={() => router.back()}
            className="py-3 bg-white border-2 border-amber-300 text-amber-600 rounded-2xl font-bold text-sm hover:bg-amber-50 transition">
            ← 範囲選択に戻る
          </button>
          <button onClick={() => {
            const base = `?id=${setId}&setName=${encodeURIComponent(setName)}&start=${start}&end=${end}&bookId=${bookId}`
            router.push('/flash/study' + base)
          }}
            className="py-3 bg-gradient-to-r from-amber-400 to-yellow-400 text-white rounded-2xl font-bold text-sm shadow-md hover:opacity-90 transition">
            📖 この範囲を学習する
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FlashListPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-5xl animate-bounce">🐕</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <FlashListInner />
    </Suspense>
  )
}
