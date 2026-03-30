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
  lang3_sub: string
  hint: string
  tts_lang1: string
  tts_lang2: string
}

function speak(text: string, lang: string) {
  if (!text || typeof window === 'undefined') return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang || 'ja-JP'
  u.rate = 0.85
  window.speechSynthesis.speak(u)
}

function ListContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const setId   = sp.get('id') ?? sp.get('setId') ?? ''
  const setName = decodeURIComponent(sp.get('setName') ?? '')
  const startNo = parseInt(sp.get('start') ?? '1')
  const endNo   = parseInt(sp.get('end')   ?? '9999')

  const [cards,       setCards]       = useState<Card[]>([])
  const [loading,     setLoading]     = useState(true)
  const [lang1Label,  setLang1Label]  = useState('中国語')
  const [lang2Label,  setLang2Label]  = useState('日本語')
  const [ttsLang1,    setTtsLang1]    = useState('zh-CN')
  const [ttsLang2,    setTtsLang2]    = useState('ja-JP')

  const [showLang1All, setShowLang1All] = useState(false)
  const [showLang2All, setShowLang2All] = useState(true)
  const [openLang1,    setOpenLang1]    = useState<Set<number>>(new Set())
  const [openLang2,    setOpenLang2]    = useState<Set<number>>(new Set())

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [cardsRes, setRes] = await Promise.all([
        supabase.from('flashcards_v3')
          .select('id,item_no,lang1,lang1_sub,lang2,lang2_sub,lang3,lang3_sub,hint,tts_lang1,tts_lang2')
          .eq('set_id', setId)
          .gte('item_no', startNo)
          .lte('item_no', endNo)
          .order('item_no'),
        supabase.from('flashcard_sets')
          .select('lang1_label,lang2_label,tts_lang1,tts_lang2')
          .eq('id', setId)
          .limit(1),
      ])
      setCards(cardsRes.data ?? [])
      if (setRes.data?.[0]) {
        const s = setRes.data[0]
        setLang1Label(s.lang1_label ?? '中国語')
        setLang2Label(s.lang2_label ?? '日本語')
        setTtsLang1(s.tts_lang1 ?? 'zh-CN')
        setTtsLang2(s.tts_lang2 ?? 'ja-JP')
      }
      setLoading(false)
    }
    load()
  }, [setId, startNo, endNo, router])

  function toggleLang1All() { setShowLang1All(v => !v); setOpenLang1(new Set()) }
  function toggleLang2All() { setShowLang2All(v => !v); setOpenLang2(new Set()) }

  function toggleRow(cardId: number, lang: 1 | 2) {
    if (lang === 1) {
      setOpenLang1(prev => { const n = new Set(prev); n.has(cardId) ? n.delete(cardId) : n.add(cardId); return n })
    } else {
      setOpenLang2(prev => { const n = new Set(prev); n.has(cardId) ? n.delete(cardId) : n.add(cardId); return n })
    }
  }

  function isVisible(cardId: number, lang: 1 | 2) {
    if (lang === 1) return showLang1All || openLang1.has(cardId)
    return showLang2All || openLang2.has(cardId)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-5xl animate-bounce">📖</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  const rangeLabel = startNo === 1 && endNo === 9999
    ? `全${cards.length}単語`
    : `No.${startNo}〜${endNo}（${cards.length}単語）`

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 pb-28">

      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">📖 {setName}</h1>
            <p className="text-xs opacity-80 mt-0.5">{rangeLabel}</p>
          </div>
          <button onClick={() => router.back()}
            className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition">
            ← 戻る
          </button>
        </div>
      </header>

      {/* 全体表示切替 */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 flex gap-3 sticky top-[68px] z-10 bg-gradient-to-b from-indigo-50 to-transparent">
        <button onClick={toggleLang1All}
          className={`flex-1 py-2 rounded-xl font-bold text-sm transition shadow-sm border ${
            showLang1All
              ? 'bg-indigo-600 text-white border-indigo-700'
              : 'bg-white text-indigo-600 border-indigo-200'
          }`}>
          {showLang1All ? `👁 ${lang1Label}を隠す` : `👁 ${lang1Label}を全表示`}
        </button>
        <button onClick={toggleLang2All}
          className={`flex-1 py-2 rounded-xl font-bold text-sm transition shadow-sm border ${
            showLang2All
              ? 'bg-purple-600 text-white border-purple-700'
              : 'bg-white text-purple-600 border-purple-200'
          }`}>
          {showLang2All ? `👁 ${lang2Label}を隠す` : `👁 ${lang2Label}を全表示`}
        </button>
      </div>

      {/* ヒント */}
      <div className="max-w-2xl mx-auto px-4 pb-2">
        <p className="text-xs text-gray-400 text-center">
          💡 隠れている単語は <span className="font-bold text-indigo-500">タップ</span> で1単語確認 ／ 🔊 で音声再生
        </p>
      </div>

      {/* 単語リスト */}
      <div className="max-w-2xl mx-auto px-4 space-y-2">
        {cards.map(card => (
          <div key={card.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* 番号バー */}
            <div className="bg-gray-50 border-b border-gray-100 px-3 py-1 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-6 text-center">{card.item_no}</span>
              {card.hint && (
                <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">💡 {card.hint}</span>
              )}
            </div>

            {/* 2カラム */}
            <div className="flex divide-x divide-gray-100">

              {/* lang1 列 */}
              <div className="flex-1 p-3">
                {isVisible(card.id, 1) ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-gray-800 flex-1">{card.lang1}</p>
                      <button
                        onClick={() => speak(card.lang1, card.tts_lang1 || ttsLang1)}
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center transition">
                        🔊
                      </button>
                    </div>
                    {card.lang1_sub && (
                      <p className="text-xs text-indigo-400 font-mono">{card.lang1_sub}</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => toggleRow(card.id, 1)}
                    className="w-full flex items-center gap-2 hover:bg-indigo-50 rounded-xl px-2 py-1 transition">
                    <div className="h-5 bg-indigo-100 rounded flex-1"></div>
                    <span className="text-xs text-indigo-300 flex-shrink-0">タップ</span>
                  </button>
                )}
              </div>

              {/* lang2 列 */}
              <div className="flex-1 p-3">
                {isVisible(card.id, 2) ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-gray-800 flex-1">{card.lang2}</p>
                      <button
                        onClick={() => speak(card.lang2, card.tts_lang2 || ttsLang2)}
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center transition">
                        🔊
                      </button>
                    </div>
                    {card.lang2_sub && (
                      <p className="text-xs text-purple-400">{card.lang2_sub}</p>
                    )}
                    {card.lang3 && (
                      <p className="text-xs text-gray-400 border-t border-gray-100 pt-1 mt-1">{card.lang3}</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => toggleRow(card.id, 2)}
                    className="w-full flex items-center gap-2 hover:bg-purple-50 rounded-xl px-2 py-1 transition">
                    <div className="h-5 bg-purple-100 rounded flex-1"></div>
                    <span className="text-xs text-purple-300 flex-shrink-0">タップ</span>
                  </button>
                )}
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* 下部ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 z-20">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={() => router.push(`/flash/study?id=${setId}&setName=${encodeURIComponent(setName)}&start=${startNo}&end=${endNo}`)}
            className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-bold shadow-md hover:opacity-90 transition text-sm">
            📚 この範囲を暗記する
          </button>
          <button
            onClick={() => router.push(`/flash/attack?id=${setId}&setName=${encodeURIComponent(setName)}&start=${startNo}&end=${endNo}`)}
            className="flex-1 py-3 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-xl font-bold shadow-md hover:opacity-90 transition text-sm">
            ⚡ タイムアタック
          </button>
        </div>
      </div>

    </div>
  )
}

export default function FlashListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-5xl animate-bounce">📖</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <ListContent />
    </Suspense>
  )
}