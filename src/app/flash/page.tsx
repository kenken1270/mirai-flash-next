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
}

type ReviewLog = {
  flashcard_id: number
  next_review_date: string
  quality: number
}

export default function FlashTopPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [sets, setSets] = useState<FlashSet[]>([])
  const [logs, setLogs] = useState<ReviewLog[]>([])
  const [loading, setLoading] = useState(true)
  const [userLang, setUserLang] = useState<'ja'|'zh'>('ja')

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
      setSets(setsRes.data ?? [])
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
            <span className="text-indigo-600 font-bold">SM-2アルゴリズム</span>で効率よく記憶できます。
          </p>
        </div>

        <button
          onClick={() => router.push('/flash/graph')}
          className="w-full py-3 bg-white rounded-2xl shadow-sm border border-indigo-100 hover:shadow-md hover:border-indigo-300 transition flex items-center justify-center gap-2 text-indigo-600 font-bold"
        >
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
                  {/* 通常学習ボタン */}
                  <button
                    onClick={() => router.push('/flash/study?setId=' + s.id + '&setName=' + encodeURIComponent(s.set_name))}
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
                      <span className="text-gray-300 text-xl flex-shrink-0">›</span>
                    </div>
                  </button>
                  {/* タイムアタックボタン */}
                  <div className="border-t border-gray-100 px-4 py-2">
                    <button
                      onClick={() => router.push('/flash/attack?setId=' + s.id + '&setName=' + encodeURIComponent(s.set_name))}
                      className="text-xs text-orange-500 font-bold flex items-center gap-1 hover:text-orange-600 transition">
                      <span>⚡</span>
                      <span>タイムアタックで挑戦</span>
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
    </div>
  )
}