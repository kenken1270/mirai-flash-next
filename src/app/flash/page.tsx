'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type FlashSet = {
  id: number
  set_name: string
  category: string
  grade: string
  description: string
  total_cards?: number
}

type ReviewLog = {
  flashcard_id: number
  next_review_date: string
  quality: number
}

type RangeModal = {
  setId: number
  setName: string
  totalCards: number
}

export default function FlashTopPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [sets, setSets] = useState<FlashSet[]>([])
  const [logs, setLogs] = useState<ReviewLog[]>([])
  const [loading, setLoading] = useState(true)
  const [userLang, setUserLang] = useState<'ja'|'zh'>('ja')
  const [rangeModal, setRangeModal] = useState<RangeModal | null>(null)
  const [rangeStart, setRangeStart] = useState('1')
  const [rangeEnd, setRangeEnd] = useState('30')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal','') ?? ''
      setUsername(uname)
      const [setsRes, logsRes, userRes] = await Promise.all([
        supabase.from('flashcard_sets').select('id,set_name,category,grade,description').order('id'),
        supabase.from('review_logs').select('flashcard_id,next_review_date,quality').eq('username', uname),
        supabase.from('users').select('lang').eq('username', uname).limit(1),
      ])
      const rawSets = setsRes.data ?? []
      // 各セットのカード数を取得
      const withCounts = await Promise.all(rawSets.map(async s => {
        const { count } = await supabase.from('flashcards_v3').select('id', { count: 'exact', head: true }).eq('set_id', s.id)
        return { ...s, total_cards: count ?? 0 }
      }))
      setSets(withCounts)
      setLogs(logsRes.data ?? [])
      if (userRes.data?.[0]?.lang) setUserLang(userRes.data[0].lang as 'ja'|'zh')
      setLoading(false)
    }
    init()
  }, [router])

  function getCategoryColor(category: string) {
    if (category?.includes('中国語') || category?.includes('漢語')) return 'from-red-500 to-orange-500'
    if (category?.includes('日本語') || category?.includes('みんなの')) return 'from-blue-500 to-indigo-500'
    if (category?.includes('英語')) return 'from-green-500 to-teal-500'
    return 'from-purple-500 to-pink-500'
  }

  function getCategoryIcon(category: string) {
    if (category?.includes('中国語') || category?.includes('漢語')) return '🇨🇳'
    if (category?.includes('日本語') || category?.includes('みんなの')) return '🇯🇵'
    if (category?.includes('英語')) return '🇬🇧'
    return '📚'
  }

  function openRangeModal(s: FlashSet) {
    setRangeModal({ setId: s.id, setName: s.set_name, totalCards: s.total_cards ?? 0 })
    setRangeStart('1')
    setRangeEnd(String(Math.min(30, s.total_cards ?? 30)))
  }

  function goList() {
    if (!rangeModal) return
    const s = parseInt(rangeStart) || 1
    const e = parseInt(rangeEnd) || rangeModal.totalCards
    router.push(`/flash/list?id=${rangeModal.setId}&setName=${encodeURIComponent(rangeModal.setName)}&start=${s}&end=${e}`)
    setRangeModal(null)
  }

  function goStudy() {
    if (!rangeModal) return
    const s = parseInt(rangeStart) || 1
    const e = parseInt(rangeEnd) || rangeModal.totalCards
    router.push(`/flash/study?id=${rangeModal.setId}&setName=${encodeURIComponent(rangeModal.setName)}&start=${s}&end=${e}`)
    setRangeModal(null)
  }

  function goAttack() {
    if (!rangeModal) return
    const s = parseInt(rangeStart) || 1
    const e = parseInt(rangeEnd) || rangeModal.totalCards
    router.push(`/flash/attack?id=${rangeModal.setId}&setName=${encodeURIComponent(rangeModal.setName)}&start=${s}&end=${e}`)
    setRangeModal(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-5xl animate-bounce">🃏</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  const grouped = sets.reduce<Record<string, FlashSet[]>>((acc, s) => {
    const k = s.category || 'その他'
    if (!acc[k]) acc[k] = []
    acc[k].push(s)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-purple-50 pb-10">
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

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100">
          <p className="text-sm text-gray-600">
            📖 教材を選んで学習を始めましょう！<br/>
            <span className="text-indigo-600 font-bold">範囲を指定</span>して一覧・暗記・タイムアタックができます。
          </p>
        </div>

        <button
          onClick={() => router.push('/flash/graph')}
          className="w-full py-3 bg-white rounded-2xl shadow-sm border border-indigo-100 hover:shadow-md hover:border-indigo-300 transition flex items-center justify-center gap-2 text-indigo-600 font-bold">
          <span className="text-xl">📈</span>
          学習グラフを見る
        </button>

        {Object.entries(grouped).map(([category, catSets]) => (
          <div key={category} className="space-y-2">
            <h2 className="font-bold text-gray-700 flex items-center gap-2 px-1">
              <span className="text-xl">{getCategoryIcon(category)}</span>
              <span>{category}</span>
              <span className="text-sm text-gray-400">({catSets.length}セット)</span>
            </h2>
            <div className="space-y-2">
              {catSets.map(s => (
                <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all overflow-hidden">
                  <button
                    onClick={() => openRangeModal(s)}
                    className="w-full text-left p-4 hover:bg-indigo-50 transition">
                    <div className="flex items-center gap-3">
                      <div className={"w-12 h-12 rounded-xl bg-gradient-to-br " + getCategoryColor(category) + " flex items-center justify-center flex-shrink-0 shadow"}>
                        <span className="text-2xl">{getCategoryIcon(category)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{s.set_name}</p>
                        {s.grade && <p className="text-xs text-gray-400 mt-0.5">{s.grade}</p>}
                        {s.description && <p className="text-xs text-gray-400 truncate">{s.description}</p>}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-xs text-indigo-500 font-bold">{s.total_cards}語</span>
                        <span className="text-gray-300 text-xl block">›</span>
                      </div>
                    </div>
                  </button>
                  {/* クイックボタン */}
                  <div className="border-t border-gray-100 px-4 py-2 flex gap-3">
                    <button
                      onClick={() => router.push(`/flash/list?id=${s.id}&setName=${encodeURIComponent(s.set_name)}&start=1&end=${s.total_cards}`)}
                      className="text-xs text-indigo-500 font-bold flex items-center gap-1 hover:text-indigo-700 transition">
                      <span>📋</span><span>一覧で見る</span>
                    </button>
                    <span className="text-gray-200">|</span>
                    <button
                      onClick={() => router.push(`/flash/study?id=${s.id}&setName=${encodeURIComponent(s.set_name)}`)}
                      className="text-xs text-purple-500 font-bold flex items-center gap-1 hover:text-purple-700 transition">
                      <span>🃏</span><span>全範囲を学習</span>
                    </button>
                    <span className="text-gray-200">|</span>
                    <button
                      onClick={() => router.push(`/flash/attack?id=${s.id}&setName=${encodeURIComponent(s.set_name)}`)}
                      className="text-xs text-orange-500 font-bold flex items-center gap-1 hover:text-orange-600 transition">
                      <span>⚡</span><span>タイムアタック</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {sets.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p>教材がまだ登録されていません</p>
          </div>
        )}
      </div>

      {/* 範囲選択モーダル */}
      {rangeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setRangeModal(null) }}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="font-bold text-gray-800 text-lg mb-1">{rangeModal.setName}</h2>
            <p className="text-xs text-gray-400 mb-4">全{rangeModal.totalCards}語 · 学習する範囲を選んでください</p>

            {/* クイック範囲選択 */}
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-500 mb-2">クイック選択</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[10,20,30,50].map(n => (
                  <button key={n} onClick={() => { setRangeStart('1'); setRangeEnd(String(Math.min(n, rangeModal.totalCards))) }}
                    className={"py-1.5 rounded-xl text-xs font-bold border transition " +
                      (parseInt(rangeEnd) === n && rangeStart === '1' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300')}>
                    1〜{n}
                  </button>
                ))}
              </div>
            </div>

            {/* 手動範囲入力 */}
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-500 mb-2">番号で指定</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">開始番号</label>
                  <input type="number" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                    min="1" max={rangeModal.totalCards}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-gray-800 focus:outline-none focus:border-indigo-400" />
                </div>
                <span className="text-gray-400 font-bold mt-4">〜</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">終了番号</label>
                  <input type="number" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                    min="1" max={rangeModal.totalCards}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-center font-bold text-gray-800 focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <p className="text-xs text-indigo-500 text-center mt-2 font-bold">
                {Math.max(0, parseInt(rangeEnd||'0') - parseInt(rangeStart||'0') + 1)}語を選択中
              </p>
            </div>

            {/* アクションボタン */}
            <div className="space-y-2">
              <button onClick={goList}
                className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-bold text-sm hover:bg-indigo-100 transition flex items-center justify-center gap-2">
                <span>📋</span> 一覧で確認する
              </button>
              <button onClick={goStudy}
                className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow">
                <span>🃏</span> この範囲を暗記する
              </button>
              <button onClick={goAttack}
                className="w-full py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm hover:bg-orange-600 transition flex items-center justify-center gap-2 shadow">
                <span>⚡</span> タイムアタックで挑戦
              </button>
            </div>

            <button onClick={() => setRangeModal(null)}
              className="w-full mt-3 py-2 text-gray-400 text-sm hover:text-gray-600 transition">
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}