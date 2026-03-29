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

  function getSetStats(setId: number, allCards: number) {
    const today = new Date().toISOString().split('T')[0]
    const setLogs = logs.filter(l => l.flashcard_id) // 全ログ（set_idがないので概算）
    const dueCount = setLogs.filter(l => l.next_review_date <= today).length
    return { dueCount }
  }

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

  // カテゴリでグループ化
  const grouped = sets.reduce<Record<string, FlashSet[]>>((acc, s) => {
    const k = s.category || 'その他'
    if (!acc[k]) acc[k] = []
    acc[k].push(s)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-purple-50 pb-10">
      {/* ヘッダー */}
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

        {/* 説明カード */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100">
          <p className="text-sm text-gray-600">
            📖 教材を選んで学習を始めましょう！<br/>
            <span className="text-indigo-600 font-bold">SM-2アルゴリズム</span>で効率よく記憶できます。
          </p>
        </div>

        {/* カテゴリ別教材一覧 */}
        {Object.entries(grouped).map(([category, catSets]) => (
          <div key={category} className="space-y-2">
            <h2 className="font-bold text-gray-700 flex items-center gap-2 px-1">
              <span className="text-xl">{getCategoryIcon(category)}</span>
              <span>{category}</span>
              <span className="text-sm text-gray-400">({catSets.length}セット)</span>
            </h2>
            <div className="space-y-2">
              {catSets.map(s => (
                <button key={s.id}
                  onClick={() => router.push(`/flash/study?setId=${s.id}&setName=${encodeURIComponent(s.set_name)}`)}
                  className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100
                    hover:shadow-md hover:border-indigo-200 transition-all active:scale-98">
                  <div className="flex items-center gap-3">
                    {/* カラーアイコン */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getCategoryColor(category)}
                      flex items-center justify-center flex-shrink-0 shadow`}>
                      <span className="text-2xl">{getCategoryIcon(category)}</span>
                    </div>
                    {/* テキスト */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm">{s.set_name}</p>
                      {s.grade && <p className="text-xs text-gray-400 mt-0.5">{s.grade}</p>}
                      {s.description && <p className="text-xs text-gray-400 truncate">{s.description}</p>}
                    </div>
                    <span className="text-gray-300 text-xl flex-shrink-0">›</span>
                  </div>
                </button>
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