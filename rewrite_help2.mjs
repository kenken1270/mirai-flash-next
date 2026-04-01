import { writeFileSync } from 'fs';

const code = `'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, insertHelpRequest, loadHelpRequests, answerHelpRequest, type UserRow, type HelpRequestRow } from '@/lib/student'

const SUBJECTS = ['算数', '国語', '理科', '社会', '英語', '中国語', 'その他']

function HelpContent() {
  const router = useRouter()
  const params = useSearchParams()
  const taskId = params.get('task_id')

  const [user, setUser] = useState<UserRow | null>(null)
  const [tab, setTab] = useState<'ask' | 'together' | 'history'>('ask')
  const [subject, setSubject] = useState('')
  const [question, setQuestion] = useState('')
  const [tried, setTried] = useState('')
  const [currentReq, setCurrentReq] = useState<HelpRequestRow | null>(null)
  const [teacherComment, setTeacherComment] = useState('')
  const [history, setHistory] = useState<HelpRequestRow[]>([])
  const [filterSubject, setFilterSubject] = useState('すべて')
  const [filterStatus, setFilterStatus] = useState('すべて')
  const [saving, setSaving] = useState(false)
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

  const handleAsk = async () => {
    if (!user || !subject || !question) return
    setSaving(true)
    await insertHelpRequest({
      username: user.username,
      subject,
      question,
      tried,
      task_id: taskId ? parseInt(taskId) : undefined,
    })
    const h = await loadHelpRequests(user.username)
    setHistory(h)
    setCurrentReq(h[0])
    setTab('together')
    setSaving(false)
  }

  const handleSolve = async () => {
    if (!currentReq || !user) return
    setSaving(true)
    await answerHelpRequest(currentReq.id, teacherComment)
    const addExp = 30
    await supabase.from('users')
      .update({ current_points: (user.current_points ?? 0) + addExp })
      .eq('username', user.username)
    const h = await loadHelpRequests(user.username)
    setHistory(h)
    setCurrentReq({ ...currentReq, status: 'answered', teacher_comment: teacherComment })
    setSaving(false)
  }

  const filtered = history.filter(h => {
    const ms = filterSubject === 'すべて' || h.subject === filterSubject
    const mt = filterStatus  === 'すべて' || h.status  === filterStatus
    return ms && mt
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-2xl">読み込み中...</div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24 px-4">
      <div className="max-w-lg mx-auto pt-6">

        <h1 className="text-2xl font-bold text-blue-700 mb-1">🙋 先生に聞く</h1>
        <p className="text-sm text-gray-500 mb-4">わからないことを整理して、先生と一緒に解決しよう！</p>

        {/* タブ */}
        <div className="flex gap-2 mb-6">
          {([
            { id: 'ask',      label: '❓ 質問する' },
            { id: 'together', label: '👩‍🏫 先生と一緒' },
            { id: 'history',  label: '📚 きろく' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={\`flex-1 py-2 rounded-xl font-bold text-xs transition-all \${tab === t.id ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-500'}\`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== ❓ 質問タブ ===== */}
        {tab === 'ask' && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
              <p className="font-bold mb-1">🧠 質問する前に確認！</p>
              <p>① 自分で考えた？　② 教科書を見た？　③ それでもわからない → 先生に聞こう！</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">📚 教科</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(s => (
                  <button key={s} onClick={() => setSubject(s)}
                    className={\`px-3 py-1.5 rounded-full text-sm border-2 font-bold transition-all \${subject === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500'}\`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">🤔 どこがわからない？</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                rows={3} placeholder='たとえば「わり算のあまりの出し方がわからない」'
                value={question} onChange={e => setQuestion(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">💪 自分で試したこと（あれば）</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                rows={2} placeholder='たとえば「教科書のp.32を読んだ」'
                value={tried} onChange={e => setTried(e.target.value)}
              />
            </div>

            <button onClick={handleAsk} disabled={saving || !subject || !question}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-40"
            >
              {saving ? '準備中...' : '👩‍🏫 先生と一緒に考える →'}
            </button>
            <button onClick={() => router.back()} className="w-full py-2 text-gray-400 text-sm">← 戻る</button>
          </div>
        )}

        {/* ===== 👩‍🏫 先生と一緒タブ ===== */}
        {tab === 'together' && (
          <div className="space-y-4">
            {!currentReq ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-gray-500 text-sm">まず「❓ 質問する」で質問を入力してね</p>
                <button onClick={() => setTab('ask')} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">質問を入力する</button>
              </div>
            ) : currentReq.status === 'answered' ? (
              /* 解決済み表示 */
              <div className="space-y-4">
                <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-6 text-center">
                  <p className="text-5xl mb-2">🌟</p>
                  <h2 className="text-xl font-bold text-green-700">解決したね！すごい！</h2>
                  <p className="text-sm text-green-600 mt-1">+30 EXP 獲得！</p>
                </div>
                <div className="bg-white rounded-2xl shadow p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">{currentReq.subject}</span>
                  </div>
                  <p className="font-bold text-gray-700">🤔 {currentReq.question}</p>
                  {currentReq.tried && <p className="text-xs text-gray-400">💪 試したこと: {currentReq.tried}</p>}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-green-600 mb-1">👩‍🏫 先生のコメント</p>
                    <p className="text-sm text-green-700">{currentReq.teacher_comment || '（コメントなし）'}</p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
                  <p className="font-bold mb-1">💡 SRLメモ</p>
                  <p>「わからない」→「聞く」→「わかった」のサイクルが自己調整力を育てるよ！</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setTab('ask'); setSubject(''); setQuestion(''); setTried(''); setCurrentReq(null); setTeacherComment('') }}
                    className="flex-1 py-3 border border-blue-300 text-blue-600 rounded-xl font-bold text-sm"
                  >もう一つ聞く</button>
                  <button onClick={() => router.push('/student/today')}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm"
                  >📅 今日のタスクへ</button>
                </div>
              </div>
            ) : (
              /* 先生と一緒モード（メイン） */
              <div className="space-y-4">
                {/* 子どもの質問（大きく表示） */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-300">
                  <p className="text-xs font-bold text-blue-400 mb-3 uppercase tracking-wide">📋 質問カード（先生に見せよう）</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-100 text-blue-600 font-bold px-3 py-1 rounded-full text-sm">{currentReq.subject}</span>
                    <span className="text-xs text-gray-400">{new Date(currentReq.created_at).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 mb-3">
                    <p className="text-xs text-blue-400 font-bold mb-1">🤔 わからないこと</p>
                    <p className="text-lg font-bold text-blue-800">{currentReq.question}</p>
                  </div>
                  {currentReq.tried && (
                    <div className="bg-yellow-50 rounded-xl p-3">
                      <p className="text-xs text-yellow-600 font-bold mb-1">💪 自分で試したこと</p>
                      <p className="text-sm text-yellow-700">{currentReq.tried}</p>
                    </div>
                  )}
                </div>

                {/* 先生入力エリア */}
                <div className="bg-white rounded-2xl shadow p-5 space-y-3">
                  <p className="text-sm font-bold text-gray-600">👩‍🏫 先生へ：解説・ヒントを入力してください</p>
                  <textarea
                    className="w-full border-2 border-green-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
                    rows={4} placeholder="ここに解説やヒントを入力（空欄のまま解決ボタンを押してもOK）"
                    value={teacherComment} onChange={e => setTeacherComment(e.target.value)}
                  />
                  <button onClick={handleSolve} disabled={saving}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-lg shadow disabled:opacity-40"
                  >
                    {saving ? '記録中...' : '🌟 わかった！解決！'}
                  </button>
                </div>

                {/* SRLヒント（先生用） */}
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-sm text-purple-700">
                  <p className="font-bold mb-1">🎓 指導のヒント（先生用）</p>
                  <p>まず「どこまではわかった？」と聞いてみましょう。子どもが自分で答えにたどり着けるよう、ヒントを少しずつ出すのが効果的です（足場かけ）。</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== 📚 きろくタブ ===== */}
        {tab === 'history' && (
          <div className="space-y-4">
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

            <div className="bg-white rounded-2xl shadow p-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {['すべて', ...SUBJECTS].map(s => (
                  <button key={s} onClick={() => setFilterSubject(s)}
                    className={\`px-2.5 py-1 rounded-full text-xs border font-bold transition-all \${filterSubject === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500'}\`}
                  >{s}</button>
                ))}
              </div>
              <div className="flex gap-2">
                {[['すべて','すべて'],['open','⏳ 未解決'],['answered','✅ 解決済み']].map(([v,l]) => (
                  <button key={v} onClick={() => setFilterStatus(v)}
                    className={\`px-3 py-1 rounded-full text-xs border font-bold transition-all \${filterStatus === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500'}\`}
                  >{l}</button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-400">
                <p className="text-4xl mb-2">📭</p><p>まだ記録がないよ</p>
              </div>
            ) : filtered.map(h => (
              <div key={h.id}
                className={\`bg-white rounded-2xl shadow p-4 border-l-4 cursor-pointer \${h.status === 'answered' ? 'border-green-400' : 'border-yellow-400'}\`}
                onClick={() => { setCurrentReq(h); setTab('together') }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{h.subject}</span>
                  <span className={\`text-xs font-bold \${h.status === 'answered' ? 'text-green-600' : 'text-yellow-600'}\`}>
                    {h.status === 'answered' ? '✅ 解決済み' : '⏳ 未解決'}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-700 line-clamp-2">{h.question}</p>
                {h.teacher_comment && (
                  <p className="text-xs text-green-600 mt-1 line-clamp-1">👩‍🏫 {h.teacher_comment}</p>
                )}
                <p className="text-xs text-gray-300 mt-1">{new Date(h.created_at).toLocaleDateString('ja-JP')}</p>
              </div>
            ))}
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
