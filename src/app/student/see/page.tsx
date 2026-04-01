'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, updatePlan, type UserRow, type PlanRow } from '@/lib/student'

const SEE_STAMPS = [
  {
    "score": 5,
    "emoji": "🔥",
    "label": "バッチリ！",
    "color": "bg-red-100 border-red-400"
  },
  {
    "score": 4,
    "emoji": "😊",
    "label": "よくできた",
    "color": "bg-yellow-100 border-yellow-400"
  },
  {
    "score": 3,
    "emoji": "😐",
    "label": "まあまあ",
    "color": "bg-green-100 border-green-400"
  },
  {
    "score": 2,
    "emoji": "😓",
    "label": "むずかしかった",
    "color": "bg-blue-100 border-blue-400"
  },
  {
    "score": 1,
    "emoji": "😭",
    "label": "ぜんぜんダメ",
    "color": "bg-purple-100 border-purple-400"
  }
]

const META_QUESTIONS = [
  {
    "id": "good",
    "label": "✅ うまくできたことは？",
    "placeholder": "たとえば「漢字を3つ覚えられた」"
  },
  {
    "id": "hard",
    "label": "🤔 むずかしかったことは？",
    "placeholder": "たとえば「計算ミスが多かった」"
  },
  {
    "id": "next",
    "label": "🚀 次はどうする？",
    "placeholder": "たとえば「計算問題を5問練習する」"
  }
]

const NEXT_ACTIONS = [
  {
    "id": "retry",
    "label": "もう一度やる",
    "emoji": "🔁"
  },
  {
    "id": "help",
    "label": "先生に聞く",
    "emoji": "🙋"
  },
  {
    "id": "next_task",
    "label": "次のタスクへ",
    "emoji": "➡️"
  },
  {
    "id": "rest",
    "label": "ひと休みする",
    "emoji": "☕"
  }
]

function SeeContent() {
  const router = useRouter()
  const params = useSearchParams()
  const taskId = params.get('task_id')

  const [user, setUser] = useState<UserRow | null>(null)
  const [task, setTask] = useState<PlanRow | null>(null)
  const [step, setStep] = useState(1)
  const [stamp, setStamp] = useState<number | null>(null)
  const [meta, setMeta] = useState<Record<string, string>>({ good: '', hard: '', next: '' })
  const [nextAction, setNextAction] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const username = session.user.email?.split('@')[0] ?? ''
      const u = await loadUser(username)
      setUser(u)
      if (taskId) {
        const { data } = await supabase.from('plans').select('*').eq('id', taskId).single()
        setTask(data)
      }
      setLoading(false)
    }
    init()
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSave = async () => {
    if (!task || !user || stamp === null) return
    setSaving(true)
    await updatePlan(task.id, {
      see_score: stamp,
      see_comment: JSON.stringify(meta),
      is_done: 1,
    })
    const addExp = stamp * 20
    await supabase.from('users').update({ exp: (user.exp ?? 0) + addExp }).eq('username', user.username)
    showToast(`+${addExp} EXP 獲得！振り返り完了🎉`)
    setTimeout(() => router.push('/student'), 2000)
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-2xl">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white pb-24 px-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg z-50 text-sm font-bold">
          {toast}
        </div>
      )}

      <div className="max-w-lg mx-auto pt-6">
        <h1 className="text-2xl font-bold text-indigo-700 mb-1">📝 今日の振り返り</h1>
        {task && <p className="text-gray-500 text-sm mb-4">{task.task_name}</p>}

        {/* ステップインジケーター */}
        <div className="flex gap-2 mb-6">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-2 rounded-full transition-all ${step >= s ? 'bg-indigo-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step 1: スタンプ自己評価 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-700">Step 1｜今日の出来は？</h2>
            <p className="text-sm text-gray-400">正直に選んでね。どれを選んでもOK！</p>
            <div className="grid grid-cols-5 gap-2">
              {SEE_STAMPS.map(s => (
                <button
                  key={s.score}
                  onClick={() => setStamp(s.score)}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${stamp === s.score ? s.color + ' scale-110 font-bold' : 'border-gray-200 bg-gray-50'}`}
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="text-xs mt-1 text-center leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
            {task && (
              <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-700">
                予定時間: {task.planned_minutes ?? 0}分
              </div>
            )}
            <button
              onClick={() => setStep(2)}
              disabled={stamp === null}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-40"
            >
              次へ →
            </button>
          </div>
        )}

        {/* Step 2: メタ認知3質問 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-700">Step 2｜じっくり振り返ろう</h2>
            <p className="text-sm text-gray-400">3つの質問に答えてね（スキップもOK）</p>
            {META_QUESTIONS.map(q => (
              <div key={q.id}>
                <label className="block text-sm font-bold text-gray-600 mb-1">{q.label}</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  rows={2}
                  placeholder={q.placeholder}
                  value={meta[q.id]}
                  onChange={e => setMeta(prev => ({ ...prev, [q.id]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-600">← 戻る</button>
              <button onClick={() => setStep(3)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">次へ →</button>
            </div>
          </div>
        )}

        {/* Step 3: 次のアクション */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-700">Step 3｜次はどうする？</h2>
            <p className="text-sm text-gray-400">次にやることを決めよう！</p>
            <div className="grid grid-cols-2 gap-3">
              {NEXT_ACTIONS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setNextAction(a.id)}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${nextAction === a.id ? 'border-indigo-500 bg-indigo-50 font-bold' : 'border-gray-200 bg-gray-50'}`}
                >
                  <span className="text-2xl">{a.emoji}</span>
                  <span className="text-sm">{a.label}</span>
                </button>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
              🏆 完了すると +{(stamp ?? 3) * 20} EXP 獲得！
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-600">← 戻る</button>
              <button
                onClick={handleSave}
                disabled={saving || nextAction === null}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-bold disabled:opacity-40"
              >
                {saving ? '保存中...' : '🎉 完了！'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SeePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-2xl">読み込み中...</div>}>
      <SeeContent />
    </Suspense>
  )
}
