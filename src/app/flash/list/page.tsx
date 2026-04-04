'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Card = {
  id: number; item_no: number; lang1: string; lang1_sub: string; lang2: string; 
  lang2_sub: string; lang3: string; lang3_sub: string; difficulty: number;
}

function RedBlock({ text, hidden, onReveal, isFullWidth = false }: { text: string; hidden: boolean; onReveal: () => void; isFullWidth?: boolean }) {
  if (!hidden) return <span className="break-words">{text || '—'}</span>
  return (
    <button onClick={e => { e.stopPropagation(); onReveal() }}
      className={`inline-block bg-red-500 rounded px-2 py-0.5 text-red-500 select-none hover:bg-red-400 transition ${isFullWidth ? 'w-full min-h-[1.5rem]' : 'min-w-[3rem]'}`}
    >
      {text || '　'}
    </button>
  )
}

function FlashListContent() {
  const searchParams = useSearchParams(); const router = useRouter();
  const setId = searchParams.get('id'); const bookId = searchParams.get('bookId');
  const setName = searchParams.get('setName') ?? '単語一覧';
  const start = Number(searchParams.get('start') ?? 1); const end = Number(searchParams.get('end') ?? 9999);

  const [cards, setCards] = useState<Card[]>([]);
  const [bookInfo, setBookInfo] = useState({ lang1_label: '単語', lang2_label: '日本語' });
  const [loading, setLoading] = useState(true);
  
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(['lang1', 'lang2']));
  const [redSheetMode, setRedSheetMode] = useState(false);
  const [hideTargets, setHideTargets] = useState<Set<string>>(new Set(['lang1']));
  const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let resBookId = bookId ? Number(bookId) : null;
      if (setId && !resBookId) {
        const { data } = await supabase.from('flashcard_sets').select('book_id').eq('id', Number(setId)).single();
        if (data) resBookId = data.book_id;
      }
      if (resBookId) {
        const { data } = await supabase.from('flashcard_books').select('lang1_label, lang2_label').eq('id', resBookId).single();
        if (data) setBookInfo({ lang1_label: data.lang1_label || '単語', lang2_label: data.lang2_label || '日本語' });
      }
      let query = supabase.from('flashcards_v3').select('*').gte('item_no', start).lte('item_no', end).order('item_no');
      if (setId) query = query.eq('set_id', Number(setId));
      const { data } = await query;
      setCards(data ?? []);
      setLoading(false);
    }
    fetchData();
  }, [setId, bookId, start, end]);

  const isEnglish = bookInfo.lang1_label.includes('英') || bookInfo.lang1_label.includes('英語');
  const colOptions = [
    { key: 'lang1', label: bookInfo.lang1_label },
    { key: 'lang1_sub', label: 'よみ' },
    { key: 'lang2', label: bookInfo.lang2_label },
    ...(isEnglish ? [{ key: 'lang3_sub', label: '中国語' }] : []),
    { key: 'lang3', label: '例文' },
  ];

  const speak = (text: string) => {
    const u = new window.SpeechSynthesisUtterance(text); u.lang = "en-US";
    window.speechSynthesis.speak(u);
  };

  const isHidden = (cardId: number, key: string) => {
    return redSheetMode && hideTargets.has(key) && !revealedCells.has(cardId + '_' + key);
  }
  const reveal = (cardId: number, key: string) => {
    setRevealedCells(new Set(revealedCells).add(cardId + '_' + key));
  }

  if (loading) return <div className="p-10 text-center animate-pulse text-yellow-500">🐕 読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-gray-900">
      <div className="bg-yellow-400 px-4 py-3 sticky top-0 z-20 shadow flex items-center justify-between text-gray-900">
        <button onClick={() => router.back()} className="text-xl font-bold">←</button>
        <h1 className="text-base font-bold truncate px-2">{setName}</h1>
        <span className="text-xs bg-white px-2 py-1 rounded-full">{cards.length}語</span>
      </div>

      <div className="p-3 bg-white border-b space-y-4">
        <div>
          <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">👀 表示する項目</p>
          <div className="flex flex-wrap gap-2">
            {colOptions.map(opt => (
              <button key={opt.key} onClick={() => {
                const next = new Set(visibleCols);
                if (next.has(opt.key)) next.delete(opt.key); else next.add(opt.key);
                setVisibleCols(next);
              }} className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${visibleCols.has(opt.key) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-red-50 p-3 rounded-xl border border-red-100 space-y-2">
          <button onClick={() => {setRedSheetMode(!redSheetMode); setRevealedCells(new Set());}} 
            className={`w-full py-2 rounded-xl font-bold text-sm transition-all ${redSheetMode ? 'bg-red-500 text-white shadow-md' : 'bg-white border border-red-200 text-red-500'}`}>
            🟥 赤シート {redSheetMode ? 'ON' : 'OFF'}
          </button>
          {redSheetMode && (
            <div>
              <p className="text-[10px] font-bold text-red-400 mb-1 uppercase tracking-wider">🎯 隠すターゲット</p>
              <div className="flex flex-wrap gap-2">
                {colOptions.filter(o => visibleCols.has(o.key)).map(opt => (
                  <button key={'h_'+opt.key} onClick={() => {
                    const next = new Set(hideTargets);
                    if (next.has(opt.key)) next.delete(opt.key); else next.add(opt.key);
                    setHideTargets(next);
                    setRevealedCells(new Set());
                  }} className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${hideTargets.has(opt.key) ? 'bg-red-500 text-white border-red-600' : 'bg-white text-red-300 border-red-200'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {cards.map(card => (
          <div key={card.id} className="p-3 bg-white flex flex-col gap-1 active:bg-gray-50 transition-colors">
            <div className="text-[10px] text-gray-300 font-mono">#{card.item_no}</div>
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
              {visibleCols.has('lang1') && (
                <div className="min-w-[100px] flex-1">
                  <p className="text-[10px] text-gray-400 font-bold">{bookInfo.lang1_label}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => speak(card.lang1)} className="text-gray-400 hover:text-yellow-500 p-1">🔊</button>
                    <span className="font-bold text-lg">
                      <RedBlock text={card.lang1} hidden={isHidden(card.id, 'lang1')} onReveal={() => reveal(card.id, 'lang1')} />
                    </span>
                  </div>
                </div>
              )}
              {visibleCols.has('lang1_sub') && (
                <div className="min-w-[80px] flex-1">
                  <p className="text-[10px] text-gray-400 font-bold">よみ</p>
                  <span className="text-gray-500 text-sm italic">
                    <RedBlock text={card.lang1_sub} hidden={isHidden(card.id, 'lang1_sub')} onReveal={() => reveal(card.id, 'lang1_sub')} />
                  </span>
                </div>
              )}
              {visibleCols.has('lang2') && (
                <div className="min-w-[120px] flex-[2]">
                  <p className="text-[10px] text-gray-400 font-bold">{bookInfo.lang2_label}</p>
                  <span className="text-gray-800 text-sm">
                    <RedBlock text={card.lang2} hidden={isHidden(card.id, 'lang2')} onReveal={() => reveal(card.id, 'lang2')} />
                  </span>
                </div>
              )}
              {visibleCols.has('lang3_sub') && (
                <div className="min-w-[100px] flex-1">
                  <p className="text-[10px] text-red-500 font-bold">中国語</p>
                  <span className="text-red-700 text-sm font-medium">
                    <RedBlock text={card.lang3_sub} hidden={isHidden(card.id, 'lang3_sub')} onReveal={() => reveal(card.id, 'lang3_sub')} />
                  </span>
                </div>
              )}
              {visibleCols.has('lang3') && card.lang3 && (
                <div className="w-full mt-1 bg-blue-50 p-2 rounded text-xs text-blue-800">
                  <p className="text-[10px] text-blue-400 font-bold mb-1 uppercase">例文</p>
                  <RedBlock 
                    text={card.lang3} 
                    hidden={isHidden(card.id, 'lang3')} 
                    onReveal={() => reveal(card.id, 'lang3')} 
                    isFullWidth={true}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FlashListPage() {
  return <Suspense><FlashListContent /></Suspense>
}