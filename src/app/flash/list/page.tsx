'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Card = {
  id: number
  item_no: number
  lang1: string
  lang1_sub: string
  lang2: string
  lang2_sub: string
  lang3: string
  hint: string
  page_range: string
}

type FlashSet = {
  lang1_label: string
  lang2_label: string
  tts_lang: string
}

function ListContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setId = searchParams.get('id') ?? ''
  const setName = searchParams.get('setName') ?? ''
  const startNo = parseInt(searchParams.get('start') ?? '1')
  const endNo = parseInt(searchParams.get('end') ?? '9999')

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [showLang1, setShowLang1] = useState(true)
  const [showLang2, setShowLang2] = useState(false)
  const [lang1Label, setLang1Label] = useState('表面')
  const [lang2Label, setLang2Label] = useState('意味')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [cardsRes, setRes] = await Promise.all([
        supabase.from('flashcards_v3')
          .select('id,item_no,lang1,lang1_sub,lang2,lang2_sub,lang3,hint,page_range')
          .eq('set_id', setId)
          .gte('item_no', startNo)
          .lte('item_no', endNo)
          .order('item_no'),
        supabase.from('flashcard_sets')
          .select('lang1_label,lang2_label,tts_lang')
          .eq('id', setId)
          .limit(1),
      ])

      setCards(cardsRes.data ?? [])
      if (setRes.data?.[0]) {
        setLang1Label(setRes.data[0].lang1_label ?? '表面')
        setLang2Label(setRes.data[0].lang2_label ?? '意味')
      }
      setLoading(false)
    }
    load()
  }, [setId, startNo, endNo, router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-bounce">📖</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 shadow-lg sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => router.back()} className="text-white/80 hover:text-white text-sm">← 戻る</button>
            <div className="text-center flex-1 mx-2">
              <h1 className="font-bold text-sm truncate">{setName}</h1>
              <p className="text-xs text-white/70">{startNo}番〜{endNo}番 · {cards.length}語</p>
            </div>
            <span className="w-8" />
          </div>
          {/* 表示切り替え */}
          <div className="flex gap-2 justify-center">
            <button onClick={() => setShowLang1(!showLang1)}
              className={"px-3 py-1 rounded-full text-xs font-bold transition " +
                (showLang1 ? 'bg-white text-indigo-700' : 'bg-white/20 text-white')}>
              {showLang1 ? '👁 ' : '🙈 '}{lang1Label}を表示
            </button>
            <button onClick={() => setShowLang2(!showLang2)}
              className={"px-3 py-1 rounded-full text-xs font-bold transition " +
                (showLang2 ? 'bg-white text-indigo-700' : 'bg-white/20 text-white')}>
              {showLang2 ? '👁 ' : '🙈 '}{lang2Label}を表示
            </button>
          </div>
        </div>
      </div>

      {/* 単語一覧テーブル */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* テーブルヘッダー */}
          <div className="grid grid-cols-12 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 border-b border-indigo-100">
            <div className="col-span-1 text-center">No.</div>
            <div className={"col-span-5 " + (!showLang1 ? 'opacity-30' : '')}>{lang1Label}</div>
            <div className={"col-span-6 " + (!showLang2 ? 'opacity-30' : '')}>{lang2Label}</div>
          </div>

          {/* 単語行 */}
          {cards.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm">この範囲に単語がありません</p>
            </div>
          ) : cards.map((card, i) => (
            <div key={card.id}
              className={"grid grid-cols-12 px-4 py-3 border-b border-gray-50 hover:bg-indigo-50/30 transition " +
                (i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
              <div className="col-span-1 text-center text-xs text-gray-400 font-mono pt-1">{card.item_no}</div>
              <div className="col-span-5 pr-2">
                {showLang1 ? (
                  <div>
                    <p className="font-bold text-gray-800 text-sm leading-tight">{card.lang1}</p>
                    {card.lang1_sub && <p className="text-xs text-indigo-400 mt-0.5">{card.lang1_sub}</p>}
                  </div>
                ) : (
                  <div className="h-5 bg-gray-200 rounded-md w-4/5 mt-0.5" />
                )}
              </div>
              <div className="col-span-6">
                {showLang2 ? (
                  <div>
                    <p className="text-sm text-gray-700 leading-tight">{card.lang2}</p>
                    {card.lang2_sub && <p className="text-xs text-gray-400 mt-0.5">{card.lang2_sub}</p>}
                    {card.hint && <p className="text-xs text-yellow-500 mt-0.5">💡 {card.hint}</p>}
                  </div>
                ) : (
                  <div className="h-5 bg-gray-200 rounded-md w-3/4 mt-0.5" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 下部ボタン */}
        {cards.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => {
              router.push(`/flash/study?id=${setId}&setName=${encodeURIComponent(setName)}&start=${startNo}&end=${endNo}`)
            }} className="bg-indigo-600 text-white py-3 rounded-2xl font-bold text-sm shadow hover:bg-indigo-700 transition flex items-center justify-center gap-2">
              🃏 この範囲を暗記する
            </button>
            <button onClick={() => {
              router.push(`/flash/attack?id=${setId}&setName=${encodeURIComponent(setName)}&start=${startNo}&end=${endNo}`)
            }} className="bg-orange-500 text-white py-3 rounded-2xl font-bold text-sm shadow hover:bg-orange-600 transition flex items-center justify-center gap-2">
              ⚡ タイムアタック
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FlashListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-5xl animate-bounce">📖</div>
      </div>
    }>
      <ListContent />
    </Suspense>
  )
}