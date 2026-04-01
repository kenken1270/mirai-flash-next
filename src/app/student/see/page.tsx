'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, updatePlan, saveUserFields, type PlanRow, type UserRow } from '@/lib/student'
import { getGradeMode, GRADE_CONFIG } from '@/lib/grade'

const SEE_STAMPS = [
  { score: 5, emoji: '🔥', label: 'バッチリ！',     color: 'bg-red-100 border-red-400'    },
  { score: 4, emoji: '😊', label: 'よくできた',     color: 'bg-orange-100 border-orange-400' },
  { score: 3, emoji: '🙂', label: 'まあまあ',       color: 'bg-yellow-100 border-yellow-400' },
  { score: 2, emoji: '😅', label: 'むずかしかった', color: 'bg-blue-100 border-blue-400'   },
  { score: 1, emoji: '😢', label: 'わからなかった', color: 'bg-gray-100 border-gray-400'   },
]

// EEFエビデンスに基づくメタ認知質問（学年別）
const META_QUESTIONS = {
  low: [
    { id: 'what_good',  q: '🌟 どんなところが うまく できた？',         placeholder: 'たとえば：「さいごまで できた」' },
    { id: 'what_hard',  q: '💪 むずかしかった ところは どこ？',          placeholder: 'たとえば：「かんじが むずかしかった」' },
    { id: 'next_plan',  q: '🚀 つぎは どうやって やってみる？',          placeholder: 'たとえば：「もっとゆっくり よむ」' },
  ],
  mid: [
    { id: 'what_good',  q: '✅ うまくできたことは？',                    placeholder: '例：集中して最後までできた' },
    { id: 'what_hard',  q: '🤔 難しかったこと・わからなかったことは？',  placeholder: '例：漢字の読み方が分からなかった' },
    { id: 'next_plan',  q: '🎯 次回はどう変える？',                      placeholder: '例：先に例文を読んでから問題を解く' },
  ],
  high: [
    { id: 'what_good',  q: '✅ 効果的だった学習方法・戦略は？',          placeholder: '例：声に出して読んだら覚えやすかった' },
    { id: 'what_hard',  q: '🧠 つまずいた原因の分析',                   placeholder: '例：前提知識が不足していた。〇〇を復習する必要がある' },
    { id: 'next_plan',  q: '🎯 次回の学習戦略の修正点',                  placeholder: '例：時間配分を変えて、最初に難問に取り組む' },
  ],
}

const NEXT_ACTIONS = [
  { id: 'retry',    label: '🔁 もう一度やる',       color: 'bg-indigo-100 border-indigo-400 text-indigo-700' },
  { id: 'review',   label: '📖 前の内容を復習',     color: 'bg-blue-100 border-blue-400 text-blue-700' },
  { id: 'ask',      label: '🙋 先生に聞く',          color: 'bg-yellow-100 border-yellow-400 text-yellow-700' },
  { id: 'next',     label: '⏭️ 次の内容に進む',     color: 'bg-green-100 border-green-400 text-green-700' },
  { id: 'slow',     label: '🐢 ゆっくりやり直す',   color: 'bg-orange-100 border-orange-400 text-orange-700' },
  { id: 'method',   label: '🔄 やり方を変える',     color: 'bg-purple-100 border-purple-400 text-purple-700' },
]

function SeeContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const taskId = parseInt(sp.get('task_id') ?? '0')

  const [user, setUser]           = useState<UserRow | null>(null)
  const [task, setTask]           = useState<PlanRow | null>(null)
  const [loading, setLoading]     = useState(true)
  const [score, setScore]         = useState<number>(0)
  const [metaAnswers, setMetaAnswers] = useState<Record<string, string>>({})
  const [nextAction, setNextAction]   = useState<string>('')
  const [teacherMsg, setTeacherMsg]   = useState('')
  const [saved, setSaved]         = useState(false)
  const [xpGained, setXpGained]   = useState(0)
  const [username, setUsername]   = useState('')
  const [step, setStep]           = useState<1|2|3>(1)

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
        }
      }
      setLoading(false)
    }
    init()
  }, [router, taskId])

  const mode   = getGradeMode(user?.grade_num)
  const config = GRADE_CONFIG[mode]
  const questions = META_QUESTIONS[mode]

  const plannedMin = task?.planned_minutes ?? 0
  const actualMin  = task?.actual_minutes  ?? 0
  const diffMin    = actualMin - plannedMin
  const diffLabel  = diffMin > 0 ? `+${diffMin}分 オーバー` : diffMin < 0 ? `${Math.abs(diffMin)}分 早かった` : 'ぴったり！'
  const diffColor  = diffMin > 5 ? 'text-red-500' : diffMin < -5 ? 'text-blue-500' : 'text-green-500'

  async function handleSave() {
    if (score === 0) return
    const xp = score >= 4 ? 20 : score >= 3 ? 10 : 5
    const metaText = questions.map(q => `${q.q}\n→ ${metaAnswers[q.id] || '（未記入）'}`).join('\n\n')
    const fullComment = [
      metaText,
      nextAction ? `\n🎯 次のアクション：${NEXT_ACTIONS.find(a => a.id === nextAction)?.label ?? ''}` : '',
      teacherMsg  ? `\n💬 先生へ：${teacherMsg}` : '',
    ].join('')

    if (task) {
      await updatePlan(task.id, {
        see_score:   score,
        see_comment: fullComment,
        is_done:     1,
      })
    }
    if (user) {
      await saveUserFields(username, {
        current_points: (user.current_points ?? 0) + xp,
        current_status: 'idle',
      })
    }
    setXpGained(xp)
    setSaved(true)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="text-4xl animate-bounce">🔍</div>
      <p className="text-gray-400">読み込み中...</p>
    </div>
  )

  if (saved) return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-teal-50 flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-7xl animate-bounce">🎉</div>
      <div className="bg-white rounded-3xl p-8 shadow-lg text-center space-y-3 w-full max-w-sm">
        <p className="text-2xl font-black text-gray-800">振り返り完了！</p>
        <p className="text-yellow-500 font-bold text-xl">⭐ +{xpGained} XP ゲット！</p>
        <div className="bg-indigo-50 rounded-2xl p-3 text-left space-y-1">
          <p className="text-xs font-bold text-indigo-700">📝 今日の振り返りメモ</p>
          <p className="text-xs text-indigo-600">{metaAnswers['next_plan'] || '記録なし'}</p>
        </div>
        <p className="text-sm text-gray-500">
          {score >= 4 ? '素晴らしい！この調子で続けよう！' :
           score >= 3 ? 'よく頑張りました！次も頑張ろう！' :
           '難しかったね。次は改善策を試してみよう！'}
        </p>
      </div>
      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={() => router.push('/student/schedule')}
          className="flex-1 bg-blue-500 text-white py-3 rounded-2xl font-bold">
          📚 今日のタスクへ
        </button>
        <button onClick={() => router.push('/student')}
          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-2xl font-bold">
          🏠 ホーム
        </button>
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen pb-24 ${mode === 'high' ? 'bg-gray-950' : 'bg-gradient-to-b from-teal-50 to-green-50'}`}>
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

        {/* ステップインジケーター */}
        <div className="flex items-center gap-2 px-1">
          {[
            { s: 1, label: mode === 'low' ? 'きもち' : '自己評価' },
            { s: 2, label: mode === 'low' ? 'かんがえる' : 'メタ認知' },
            { s: 3, label: mode === 'low' ? 'つぎは？' : '次の作戦' },
          ].map(({ s, label }) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${step >= s ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`text-[10px] ${step >= s ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>{label}</span>
            </div>
          ))}
          {[1,2].map(i => (
            <div key={i} className={`h-0.5 flex-1 -mt-4 transition-all ${step > i ? 'bg-teal-400' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* ══ Step 1：自己評価スタンプ ══ */}
        {step === 1 && (
          <div className={`rounded-2xl p-4 shadow-sm border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <h3 className={`font-bold text-sm mb-1 ${mode === 'high' ? 'text-white' : 'text-gray-700'}`}>
              {mode === 'low' ? '🎯 きょうの べんきょうは どうだった？' : '🎯 今日の学習を自己評価しよう'}
            </h3>
            <p className={`text-xs mb-3 ${mode === 'high' ? 'text-gray-400' : 'text-gray-400'}`}>
              {mode === 'low' ? 'あてはまる えがおを えらんでね' : 'スタンプをタップして選んでください'}
            </p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {SEE_STAMPS.map(({ score: s, emoji, label, color }) => (
                <button key={s} onClick={() => setScore(s)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all
                    ${score === s ? color + ' scale-105 shadow-md' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-xs font-bold leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>

            {/* 時間比較（中・高学年） */}
            {mode !== 'low' && plannedMin > 0 && actualMin > 0 && (
              <div className={`rounded-xl p-3 mt-2 ${mode === 'high' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p className={`text-xs font-bold mb-2 ${mode === 'high' ? 'text-gray-300' : 'text-gray-600'}`}>⏱️ 時間の振り返り</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: '予想', value: plannedMin, unit: '分', color: 'text-blue-500' },
                    { label: '実際', value: actualMin,  unit: '分', color: 'text-green-500' },
                    { label: 'ズレ', value: diffLabel,  unit: '',   color: diffColor },
                  ].map(({ label, value, unit, color }) => (
                    <div key={label} className={`rounded-lg p-2 ${mode === 'high' ? 'bg-gray-600' : 'bg-white'}`}>
                      <p className={`text-lg font-black ${color}`}>{value}<span className="text-xs">{unit}</span></p>
                      <p className={`text-xs ${mode === 'high' ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => score > 0 ? setStep(2) : null}
              disabled={score === 0}
              className={`w-full mt-4 py-3 rounded-2xl font-bold transition disabled:opacity-40
                ${mode === 'low' ? 'bg-yellow-400 text-white text-lg' : 'bg-teal-500 text-white'}`}>
              {score === 0
                ? (mode === 'low' ? 'えらんでね 👆' : 'スタンプを選んでください')
                : (mode === 'low' ? 'つぎへ →' : '次へ：メタ認知質問 →')}
            </button>
          </div>
        )}

        {/* ══ Step 2：メタ認知質問（EEFエビデンス） ══ */}
        {step === 2 && (
          <div className="space-y-3">
            <div className={`rounded-2xl p-3 border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-teal-50 border-teal-200'}`}>
              <p className={`text-xs font-bold ${mode === 'high' ? 'text-teal-400' : 'text-teal-700'}`}>
                💡 {mode === 'low' ? 'かんがえてみよう！' : '自分の学習を振り返ることで、次がもっとうまくなります'}
              </p>
            </div>

            {questions.map((q, i) => (
              <div key={q.id} className={`rounded-2xl p-4 shadow-sm border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <h3 className={`font-bold text-sm mb-2 ${mode === 'high' ? 'text-white' : 'text-gray-700'}`}>
                  {i + 1}. {q.q}
                </h3>
                <textarea
                  value={metaAnswers[q.id] ?? ''}
                  onChange={e => setMetaAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder}
                  rows={mode === 'low' ? 2 : 3}
                  className={`w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300
                    ${mode === 'high'
                      ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-500'
                      : 'border border-gray-200 text-gray-700 placeholder-gray-300'}`}
                />
              </div>
            ))}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className={`flex-1 py-3 rounded-2xl font-bold border-2 transition
                  ${mode === 'high' ? 'border-gray-600 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                ← 戻る
              </button>
              <button onClick={() => setStep(3)}
                className={`flex-2 flex-1 py-3 rounded-2xl font-bold text-white transition
                  ${mode === 'low' ? 'bg-yellow-400' : 'bg-teal-500 hover:bg-teal-600'}`}>
                {mode === 'low' ? 'つぎへ →' : '次へ：次の作戦 →'}
              </button>
            </div>
          </div>
        )}

        {/* ══ Step 3：次のアクション＋先生へひとこと ══ */}
        {step === 3 && (
          <div className="space-y-3">
            {/* 次のアクション選択 */}
            <div className={`rounded-2xl p-4 shadow-sm border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <h3 className={`font-bold text-sm mb-3 ${mode === 'high' ? 'text-white' : 'text-gray-700'}`}>
                {mode === 'low' ? '🚀 つぎは なにをする？' : '🎯 次のアクションを決めよう'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {NEXT_ACTIONS.map(a => (
                  <button key={a.id} onClick={() => setNextAction(a.id)}
                    className={`py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition
                      ${nextAction === a.id ? a.color + ' scale-105 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 先生へのひとこと */}
            <div className={`rounded-2xl p-4 shadow-sm border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <h3 className={`font-bold text-sm mb-2 ${mode === 'high' ? 'text-white' : 'text-gray-700'}`}>
                {mode === 'low' ? '💬 せんせいへ ひとこと（なくてもOK）' : '💬 先生へひとこと（任意）'}
              </h3>
              <textarea
                value={teacherMsg}
                onChange={e => setTeacherMsg(e.target.value)}
                placeholder={
                  mode === 'low' ? 'たとえば：「ここが わからなかった」' :
                  mode === 'mid' ? '例：〇〇のところが分からなかったので教えてください' :
                  '例：〇〇の概念が理解できていないので次回解説をお願いします'
                }
                rows={2}
                className={`w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300
                  ${mode === 'high'
                    ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-500'
                    : 'border border-gray-200 text-gray-700 placeholder-gray-300'}`}
              />
            </div>

            {/* 振り返りサマリー */}
            <div className={`rounded-2xl p-4 border ${mode === 'high' ? 'bg-gray-800 border-gray-700' : 'bg-indigo-50 border-indigo-200'}`}>
              <p className={`text-xs font-bold mb-2 ${mode === 'high' ? 'text-indigo-400' : 'text-indigo-700'}`}>📋 今日の振り返りまとめ</p>
              <div className="space-y-1">
                <p className={`text-xs ${mode === 'high' ? 'text-gray-300' : 'text-gray-600'}`}>
                  {SEE_STAMPS.find(s => s.score === score)?.emoji} 評価：{SEE_STAMPS.find(s => s.score === score)?.label}
                </p>
                {metaAnswers['next_plan'] && (
                  <p className={`text-xs ${mode === 'high' ? 'text-gray-300' : 'text-gray-600'}`}>
                    🎯 次の作戦：{metaAnswers['next_plan']}
                  </p>
                )}
                {nextAction && (
                  <p className={`text-xs ${mode === 'high' ? 'text-gray-300' : 'text-gray-600'}`}>
                    ⚡ アクション：{NEXT_ACTIONS.find(a => a.id === nextAction)?.label}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className={`flex-1 py-3 rounded-2xl font-bold border-2 transition
                  ${mode === 'high' ? 'border-gray-600 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                ← 戻る
              </button>
              <button onClick={handleSave}
                className={`flex-2 flex-1 py-4 rounded-2xl font-bold text-lg shadow-md transition active:scale-95
                  ${mode === 'low'
                    ? 'bg-yellow-400 text-white text-xl'
                    : mode === 'high'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gradient-to-r from-teal-500 to-green-500 text-white'}`}>
                {mode === 'low' ? 'きろく する 🌟' : `振り返りを保存 ⭐+${score >= 4 ? 20 : score >= 3 ? 10 : 5}XP`}
              </button>
            </div>
          </div>
        )}

        <button onClick={() => router.back()}
          className={`w-full py-3 rounded-2xl font-bold text-sm ${mode === 'high' ? 'text-gray-500' : 'text-gray-400'}`}>
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
        <div className="text-4xl animate-bounce">🔍</div>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <SeeContent />
    </Suspense>
  )
}