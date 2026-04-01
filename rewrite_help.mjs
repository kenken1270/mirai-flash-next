import { writeFileSync } from 'fs';

const code = `'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, insertHelpRequest, loadHelpRequests, type UserRow, type HelpRequestRow } from '@/lib/student'

const SUBJECTS = ['算数', '国語', '理科', '社会', '英語', '中国語', 'その他']

const STATUS_LABEL: Record<string, string> = {
  open:     '⏳ 未回答',
  answered: '✅ 解決済み',
}

function HelpContent() {
  const router = useRouter()
  const params = useSearchParams()
  const taskId = params.get('task_id')

  const [user, setUser] = useState<UserRow | null>(null)
  const [tab, setTab] = useState<'send' | 'history'>('send')
  const [subject, setSubject] = useState('')
  const [question, setQuestion] = useState('')
  const [tried, setTried] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [history, setHistory] = useState<HelpRequestRow[]>([])
  const [filterSubject, setFilterSubject] = useState('すべて')
  const [filterStatus, setFilterStatus] = useState('すべて')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const username = session.user.email?.split('@')[0] ?? ''
      const u = await loadUser(username)
      setUser(u)
      const h = await loadHelpRequests(username)
      setHistory(h)
      setLoading(false)
    }
    init()
  }, [])

  const handleSend = async () => {
    if (!user || !subject || !question) return
    setSending(true)
    await insertHelpRequest({
      username: user.username,
      subject,
      question,
      tried,
      task_id: taskId ? parseInt(taskId) : undefined,
    })
    setSent(true)
    setSending(false)
    const h = await loadHelpRequests(user.username)
    setHistory(h)
  }

  const filtered = history.filter(h => {
    const matchSubject = filterSubject === 'すべて' || h.subject === filterSubject
    const matchStatus  = filterStatus  === 'すべて' || h.status  === filterStatus
    return matchSubject && matchStatus
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-2xl">読み込み中...</div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24 px-4">
      <div className="max-w-lg mx-auto pt-6">

        {/* ヘッダー */}
        <h1 className="text-2xl font-bold text-blue-700 mb-1">🙋 先生に聞く</h1>
        <p className="text-sm text-gray-500 mb-4">わからないことを送ろう。先生が返事をくれるよ！</p>

        {/* タブ */}
        <div className="flex gap-2 mb-6">
          {(['send', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSent(false) }}
              className={\`flex-1 py-2 rounded-xl font-bold text-sm transition-all \${tab === t ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-500'}\`}
            >
              {t === 'send' ? '📨 質問を送る' : '📚 過去の質問'}
            </button>
          ))}
        </div>

        {/* ===== 送信タブ ===== */}
        {tab === 'send' && (
          sent ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center space-y-4">
              <div className="text-5xl">📨</div>
              <h2 className="text-xl font-bold text-blue-700">先生に送ったよ！</h2>
              <p className="text-sm text-gray-500">先生が確認したら返事をくれるよ。それまで次のタスクを進めよう！</p>
              <div className="bg-blue-50 rounded-xl p-4 text-left text-sm text-blue-700">
                <p className="font-bold mb-1">💡 SRLポイント</p>
                <p>「わからない」を言葉にできたあなたはすごい！自分で考えてから聞くのが、賢い学び方だよ。</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSent(false); setSubject(''); setQuestion(''); setTried('') }}
                  className="flex-1 py-3 border border-blue-300 text-blue-600 rounded-xl font-bold"
                >
                  もう一つ送る
                </button>
                <button
                  onClick={() => router.push('/student/today')}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold"
                >
                  📅 今日のタスクへ
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow p-6 space-y-4">

              {/* SRL 3ステップガイド */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
                <p className="font-bold mb-1">🧠 質問の前に3ステップ</p>
                <p>① 自分で考えた？　② 教科書を見た？　③ それでもわからなかった → 送ろう！</p>
              </div>

              {/* 教科 */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">📚 教科</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map(s => (
                    <button
                      key={s}
                      onClick={() => setSubject(s)}
                      className={\`px-3 py-1.5 rounded-full text-sm border-2 font-bold transition-all \${subject === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500'}\`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 質問 */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">🤔 どこがわからない？</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={3}
                  placeholder="たとえば「わり算のあまりの出し方がわからない」"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                />
              </div>

              {/* 試したこと */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">💪 自分で試したこと（あれば）</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={2}
                  placeholder="たとえば「教科書のp.32を読んだ」"
                  value={tried}
                  onChange={e => setTried(e.target.value)}
                />
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !subject || !question}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-40"
              >
                {sending ? '送信中...' : '🙋 先生に送る'}
              </button>
              <button
                onClick={() => router.back()}
                className="w-full py-2 text-gray-400 text-sm"
              >
                ← 戻る
              </button>
            </div>
          )
        )}

        {/* ===== 過去の質問タブ ===== */}
        {tab === 'history' && (
          <div className="space-y-4">

            {/* フィルター */}
            <div className="bg-white rounded-2xl shadow p-4 space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">教科で絞り込み</p>
                <div className="flex flex-wrap gap-1.5">
                  {['すべて', ...SUBJECTS].map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterSubject(s)}
                      className={\`px-2.5 py-1 rounded-full text-xs border font-bold transition-all \${filterSubject === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500'}\`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">状態で絞り込み</p>
                <div className="flex gap-2">
                  {['すべて', 'open', 'answered'].map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={\`px-3 py-1 rounded-full text-xs border font-bold transition-all \${filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500'}\`}
                    >
                      {s === 'すべて' ? 'すべて' : s === 'open' ? '⏳ 未回答' : '✅ 解決済み'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 統計バッジ */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-xl shadow p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{history.length}</p>
                <p className="text-xs text-gray-400">総質問数</p>
              </div>
              <div className="bg-white rounded-xl shadow p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{history.filter(h => h.status === 'answered').length}</p>
                <p className="text-xs text-gray-400">解決済み</p>
              </div>
              <div className="bg-white rounded-xl shadow p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{history.filter(h => h.status === 'open').length}</p>
                <p className="text-xs text-gray-400">回答待ち</p>
              </div>
            </div>

            {/* 質問リスト */}
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-400">
                <p className="text-4xl mb-2">📭</p>
                <p>質問はまだないよ</p>
              </div>
            ) : (
              filtered.map(h => (
                <div key={h.id} className={\`bg-white rounded-2xl shadow p-4 border-l-4 \${h.status === 'answered' ? 'border-green-400' : 'border-yellow-400'}\`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{h.subject}</span>
                    <span className={\`text-xs font-bold \${h.status === 'answered' ? 'text-green-600' : 'text-yellow-600'}\`}>
                      {STATUS_LABEL[h.status]}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-1">{h.question}</p>
                  {h.tried && (
                    <p className="text-xs text-gray-400 mb-2">💪 試したこと: {h.tried}</p>
                  )}
                  {h.teacher_comment && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-2">
                      <p className="text-xs font-bold text-green-600 mb-1">👩‍🏫 先生のコメント</p>
                      <p className="text-sm text-green-700">{h.teacher_comment}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-300 mt-2">{new Date(h.created_at).toLocaleDateString('ja-JP')}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">読み込み中...</div>}>
      <HelpContent />
    </Suspense>
  )
}
`;

writeFileSync('src/app/student/help/page.tsx', code, 'utf8');
console.log('OK');
