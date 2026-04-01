import { writeFileSync } from 'fs';
const code = `'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser } from '@/lib/student'

const HELP_TYPES = [
  { id: 'meaning', label: '意味がわからない', emoji: '❓' },
  { id: 'method', label: 'やり方がわからない', emoji: '🤷' },
  { id: 'answer', label: '答えが合わない', emoji: '❌' },
  { id: 'other', label: 'その他', emoji: '💬' },
]

function HelpContent() {
  const router = useRouter()
  const params = useSearchParams()
  const taskId = params.get('task_id')
  const [user, setUser] = useState(null)
  const [helpType, setHelpType] = useState(null)
  const [question, setQuestion] = useState('')
  const [tried, setTried] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const username = session.user.email?.replace('@mirai-juku.internal', '') ?? session.user.email?.split('@')[0] ?? ''
      const u = await loadUser(username)
      setUser(u)
      setLoading(false)
    }
    init()
  }, [])

  const handleSend = async () => {
    if (!helpType || !question) return
    const msg = '【質問】' + (HELP_TYPES.find(h=>h.id===helpType)?.label ?? '') + '\\n\\nわからないこと：' + question + '\\n\\n自分で試したこと：' + (tried || 'なし') + '\\n\\ntask_id: ' + taskId
    await supabase.from('news').insert({
      message: msg,
      created_date: new Date().toISOString().split('T')[0],
      target_user: 'teacher',
    })
    setSent(true)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>

  if (sent) return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-8xl">📨</div>
      <div className="bg-white rounded-3xl p-8 shadow text-center space-y-3">
        <h2 className="text-2xl font-black text-green-600">先生に送ったよ！</h2>
        <p className="text-gray-500 text-sm">先生が確認したら返事をくれるよ。それまで次のタスクを進めてみよう！</p>
        <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700 text-left space-y-1">
          <p className="font-bold">💡 SRLポイント</p>
          <p>「わからない」を言葉にできたあなたはすごい！自分で考えてから聞くのが、賢い学び方だよ。</p>
        </div>
      </div>
      <button onClick={() => router.push('/student/today')} className="w-full max-w-sm py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg">➡️ 今日のタスクへ</button>
      <button onClick={() => router.push('/student')} className="text-gray-400 text-sm underline">ホームへ戻る</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24 px-4">
      <div className="max-w-lg mx-auto pt-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-blue-700">🙋 先生に聞く</h1>
          <p className="text-sm text-gray-500 mt-1">自分で考えてから聞くと、もっと力がつくよ！</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700 space-y-1">
          <p className="font-bold">📚 質問上手の3ステップ（SRL）</p>
          <p>① 何がわからないか言葉にする</p>
          <p>② 自分で試したことを思い出す</p>
          <p>③ 先生に「こう思うけど合ってる？」と聞く</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <h2 className="font-bold text-gray-700">どんな種類の質問？</h2>
          <div className="grid grid-cols-2 gap-3">
            {HELP_TYPES.map(h => (
              <button key={h.id} onClick={() => setHelpType(h.id)}
                className={'p-3 rounded-xl border-2 flex items-center gap-2 transition-all ' + (helpType === h.id ? 'border-blue-500 bg-blue-50 font-bold' : 'border-gray-200 bg-gray-50')}>
                <span className="text-xl">{h.emoji}</span>
                <span className="text-sm">{h.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <h2 className="font-bold text-gray-700">何がわからない？</h2>
          <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3} placeholder="たとえば「分数の割り算の意味がわからない」"
            value={question} onChange={e => setQuestion(e.target.value)} />
        </div>
        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <h2 className="font-bold text-gray-700">自分で試したことは？（任意）</h2>
          <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={2} placeholder="たとえば「教科書のp.32を読んだ」"
            value={tried} onChange={e => setTried(e.target.value)} />
        </div>
        <button onClick={handleSend} disabled={!helpType || !question}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl font-bold text-lg disabled:opacity-40">
          📨 先生に送る
        </button>
        <button onClick={() => router.back()} className="w-full py-3 border border-gray-300 rounded-2xl text-gray-500">← 戻る</button>
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
console.log('✅ help/page.tsx 完了');
