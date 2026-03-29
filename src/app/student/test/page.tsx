'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ContentRow = {
  id: number
  subject: string
  content_type: string
  title: string
  url: string
}

const SUBJECTS = ['国語', '算数', '理科', '社会']

const SUBJECT_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  '国語': { icon: '📖', color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  '算数': { icon: '🔢', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  '理科': { icon: '🔬', color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  '社会': { icon: '🌍', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
}

const TAB_ACTIVE: Record<string, string> = {
  '国語': 'bg-red-500 text-white',
  '算数': 'bg-blue-500 text-white',
  '理科': 'bg-green-500 text-white',
  '社会': 'bg-orange-500 text-white',
}

const TAB_INACTIVE = 'bg-white text-gray-500 border border-gray-200'

export default function TestPage() {
  const router = useRouter()
  const [contents, setContents] = useState<ContentRow[]>([])
  const [activeTab, setActiveTab] = useState('国語')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data } = await supabase
        .from('content')
        .select('*')
        .order('id')
      setContents(data ?? [])
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-4xl animate-bounce">✏️</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  const tabContents = contents.filter(c => c.subject === activeTab)
  const videos = tabContents.filter(c => c.content_type === '動画')
  const tests  = tabContents.filter(c => c.content_type === '小テスト')
  const cfg = SUBJECT_CONFIG[activeTab]

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className={`rounded-2xl p-5 shadow-md border ${cfg.bg}`}>
        <h2 className={`text-xl font-bold ${cfg.color}`}>
          {cfg.icon} 小テスト・動画
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          教科を選んで動画を見たり小テストに挑戦しよう！
        </p>
      </div>

      {/* 教科タブ */}
      <div className="grid grid-cols-4 gap-2">
        {SUBJECTS.map(subject => (
          <button
            key={subject}
            onClick={() => setActiveTab(subject)}
            className={`py-2 rounded-xl text-sm font-bold transition-all shadow-sm
              ${activeTab === subject ? TAB_ACTIVE[subject] : TAB_INACTIVE}`}
          >
            {SUBJECT_CONFIG[subject].icon}<br />
            <span className="text-xs">{subject}</span>
          </button>
        ))}
      </div>

      {/* コンテンツなし */}
      {tabContents.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center space-y-2">
          <div className="text-4xl">{cfg.icon}</div>
          <p className="font-bold text-gray-600">{activeTab}のコンテンツはまだありません</p>
          <p className="text-sm text-gray-400">先生が追加すると<br />ここに表示されます</p>
        </div>
      )}

      {/* 動画セクション */}
      {videos.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-lg text-sm">🎬 動画</span>
            <span className="text-sm text-gray-400">{videos.length}件</span>
          </h3>
          <div className="space-y-2">
            {videos.map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 p-4 rounded-xl border shadow-sm
                  hover:shadow-md transition-all active:scale-95 ${cfg.bg}`}
              >
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow">
                  <span className="text-white text-lg">▶</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${cfg.color}`}>{item.title}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{item.url}</p>
                </div>
                <span className="text-gray-300 flex-shrink-0">›</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 小テストセクション */}
      {tests.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-lg text-sm">✏️ 小テスト</span>
            <span className="text-sm text-gray-400">{tests.length}件</span>
          </h3>
          <div className="space-y-2">
            {tests.map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border border-purple-200 bg-purple-50 shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow">
                  <span className="text-white text-lg">✏️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-purple-700">{item.title}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{item.url}</p>
                </div>
                <span className="text-gray-300 flex-shrink-0">›</span>
              </a>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}