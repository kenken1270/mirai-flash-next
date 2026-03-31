'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, updatePlan, saveUserFields, type PlanRow, type UserRow } from '@/lib/student'
import { getGradeMode, GRADE_CONFIG } from '@/lib/grade'

const SEE_STAMPS = [
  { score: 5, emoji: '🔥', label: 'バッチリ！',     color: 'bg-red-100 border-red-400'    },
  { score: 4, emoji: '😊', label: 'よくできた',     color: 'bg-orange-100 border-orange-400' },
  { score: 3, emoji: '🤔', label: 'まあまあ',       color: 'bg-yellow-100 border-yellow-400' },
  { score: 2, emoji: '😓', label: 'むずかしかった', color: 'bg-blue-100 border-blue-400'   },
  { score: 1, emoji: '❌', label: 'わからなかった', color: 'bg-gray-100 border-gray-400'   },
]

const IMPROVEMENT_OPTIONS = [
  '時間をもっとかける', '復習を増やす', '先生に質問する',
  '教科書を読み直す', '問題を解き直す', '集中できる環境を作る',
]

function SeeContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const taskId = parseInt(sp.get('task_id') ?? '0')

  const [user, setUser]         = useState<UserRow | null>(null)
  const [task, setTask]         = useState<PlanRow | null>(null)
  const [loading, setLoading]   = useState(true)
  const [score, setScore]       = useState<number>(0)
  const [comment, setComment]   = useState('')
  const [improvement, setImprovement] = useState<string[]>([])
  const [saved, setSaved]       = useState(false)
  const [xpGained, setXpGained] = useState(0)
  const [username, setUsername] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.replace('@mirai-juku.internal', '') ?? ''
      setUsername(uname)
      const userData = await loadUser(uname)
      setUser(userData)

      if (taskId) {
        const { data } = await supabase.from('plans').select('*').eq('id', taskId).single()
        if (data) {
          setTask(data as PlanRow)
          setScore(data.see_score ?? 0)
          setComment(data.see_comment ?? '')
        }
      }
      setLoading(false)
    }
    init()
  }, [router, taskId])

  const mode   = getGradeMode(user?.grade_num)
  const config = GRADE_CONFIG[mode]

  const plannedMin = task?.planned_minutes ?? 0
  const actualMin  = task?.actual_minutes  ?? 0
  const diffMin    = actualMin - plannedMin
  const diffLabel  = diffMin > 0 ? `+${diffMin}分 オーバー` : diffMin < 0 ? `${Math.abs(diffMin)}分 余った` : 'ぴったり！'
  const diffColor  = diffMin > 5 ? 'text-red-500' : diffMin < -5 ? 'text-blue-500' : 'text-green-500'

  function toggleImprovement(item: string) {
    setImprovement(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    )
  }

  async function handleSave() {
    if (score === 0) return
    const xp = score >= 4 ? 20 : score >= 3 ? 10 : 5
    if (task) { await updatePlan(task.id, {
      see_score:   score,
      see_comment: comment + (improvement.length > 0 ? '\n【次回の改善】' + improvement.join('、') : ''),
    }) }
    if (user) {
      const newXp = (user.current_points ?? 0) + xp
      await saveUserFields(username, {
        current_points: newXp,
        current_status: 'idle',
      })
    }
    setXpGained(xp)
    setSaved(true)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-4xl animate-bounce">🪞</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  if (saved) return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-teal-50 flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-7xl animate-bounce">🎉</div>
      <div className="bg-white rounded-3xl p-8 shadow-lg text-center space-y-3 w-full max-w-sm">
        <p className="text-2xl font-black text-gray-800">振り返り完了！</p>
        <p className="text-yellow-500 font-bold text-xl">⚡ +{xpGained} XP ゲット！</p>
        <p className="text-sm text-gray-500">
          {score >= 4 ? '素晴らしい！この調子で続けよう！' :
           score >= 3 ? 'よく頑張りました！次も頑張ろう！' :
           '難しかったね。次は改善点を意識してみよう！'}
        </p>
      </div>
      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={() => router.push('/student/schedule')}
          className="flex-1 bg-blue-500 text-white py-3 rounded-2xl font-bold">
          📅 今日のタスクへ
        </button>
        <button onClick={() => router.push('/student')}
          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-2xl font-bold">
          🏠 ホーム
        </button>
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen pb-10 ${mode === 'high' ? 'bg-gray-950' : 'bg-gradient-to-b from-teal-50 to-green-50'}`}>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* ヘッダー */}
        <div className={`bg-gradient-to-r ${config.colors.primary} rounded-2xl p-5 text-white shadow-md`}>
          <p className="text-sm opacity-80">
            {mode === 'low' ? 'ふりかえり' : '振り返り（See）'}
          </p>
          <h2 className="text-xl font-bold mt-1">
            {task?.task_name ?? '学習の振り返り'}
          </h2>
          {task?.task_date && (
            <p className="text-sm opacity-70 mt-1">📅 {String(task.task_date).slice(0, 10)}</p>
          )}
        </div>

        {/* 予実分析（高学年・中学生のみ） */}
        {mode !== 'low' && plannedMin > 0 && (
          <div className={`rounded-2xl p-4 shadow-sm border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <h3 className={`font-bold text-sm mb-3 ${mode === 'high' ? 'text-white' : 'text-gray-700'}`}>
              ⏱️ 時間の予実分析
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              {[
                { label: '予定', value: plannedMin, unit: '分', color: 'text-blue-500' },
                { label: '実際', value: actualMin,  unit: '分', color: 'text-green-500' },
                { label: 'ズレ', value: diffLabel,  unit: '',   color: diffColor },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className={`rounded-xl p-3 ${mode === 'high' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className={`text-xl font-black ${color}`}>{value}<span className="text-xs">{unit}</span></p>
                  <p className={`text-xs mt-0.5 ${mode === 'high' ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
                </div>
              ))}
            </div>
            {/* 予実バー */}
            {plannedMin > 0 && actualMin > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs w-8 ${mode === 'high' ? 'text-gray-400' : 'text-gray-500'}`}>予定</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="h-3 bg-blue-400 rounded-full" style={{ width: '100%' }} />
                  </div>
                  <span className={`text-xs w-10 text-right ${mode === 'high' ? 'text-gray-400' : 'text-gray-500'}`}>{plannedMin}分</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs w-8 ${mode === 'high' ? 'text-gray-400' : 'text-gray-500'}`}>実際</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className={`h-3 rounded-full ${diffMin > 5 ? 'bg-red-400' : diffMin < -5 ? 'bg-blue-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.min(200, Math.round((actualMin / plannedMin) * 100))}%` }} />
                  </div>
                  <span className={`text-xs w-10 text-right ${mode === 'high' ? 'text-gray-400' : 'text-gray-500'}`}>{actualMin}分</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 自己評価スタンプ */}
        <div className={`rounded-2xl p-4 shadow-sm border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`font-bold text-sm mb-3 ${mode === 'high' ? 'text-white' : 'text-gray-700'}`}>
            {mode === 'low' ? 'きょうのべんきょうはどうだった？' : '自己評価'}
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {SEE_STAMPS.map(({ score: s, emoji, label, color }) => (
              <button key={s} onClick={() => setScore(s)}
                className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all
                  ${score === s ? color + ' scale-105 shadow-md' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-2xl">{emoji}</span>
                <span className={`text-xs font-bold ${mode === 'low' ? 'text-sm' : ''}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 改善点選択（高学年・中学生） */}
        {mode !== 'low' && score > 0 && score <= 3 && (
          <div className={`rounded-2xl p-4 shadow-sm border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <h3 className={`font-bold text-sm mb-3 ${mode === 'high' ? 'text-white' : 'text-gray-700'}`}>
              🔧 次回の改善点（複数選択OK）
            </h3>
            <div className="flex flex-wrap gap-2">
              {IMPROVEMENT_OPTIONS.map(item => (
                <button key={item} onClick={() => toggleImprovement(item)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold border transition
                    ${improvement.includes(item)
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : mode === 'high' ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 自由記述（中学生のみ） */}
        {mode === 'high' && (
          <div className="rounded-2xl p-4 shadow-sm border bg-gray-800 border-gray-700">
            <h3 className="font-bold text-sm mb-2 text-white">📝 自由記述（なぜ？次はどうする？）</h3>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="例：思ったより時間がかかった。単語を覚えるのに集中できなかった。次回は先に予習してから取り組む。"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-sm resize-none h-24 outline-none focus:border-indigo-500 placeholder-gray-500"
            />
          </div>
        )}

        {/* コメント（高学年のみ・簡易） */}
        {mode === 'mid' && score > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-bold text-sm mb-2 text-gray-700">💬 一言メモ（任意）</h3>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="気づいたことを書こう"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        )}

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={score === 0}
          className={`w-full py-4 rounded-2xl font-bold text-lg shadow-md transition disabled:opacity-40
            ${mode === 'low'
              ? 'bg-yellow-400 text-white text-xl'
              : mode === 'high'
              ? 'bg-indigo-600 text-white'
              : 'bg-gradient-to-r from-teal-500 to-green-500 text-white'}`}>
          {score === 0
            ? (mode === 'low' ? 'スタンプをえらんでね 👆' : '評価を選んでください')
            : (mode === 'low' ? 'きろくする！✨' : `振り返りを保存する ⚡+${score >= 4 ? 20 : score >= 3 ? 10 : 5}XP`)}
        </button>

        <button onClick={() => router.back()}
          className={`w-full py-3 rounded-2xl font-bold text-sm ${mode === 'high' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400'}`}>
          ← もどる
        </button>
      </div>
    </div>
  )
}

export default function SeePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-4xl animate-bounce">🪞</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <SeeContent />
    </Suspense>
  )
}