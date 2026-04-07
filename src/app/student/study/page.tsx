'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUsernameFromSession } from '@/lib/auth-user'
import { updatePlan, saveUserFields, type PlanRow } from '@/lib/student'

type Resource = { video_url: string; explanation: string; hint_text: string; resource_type: string; image_url?: string }

function StudyHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get('taskId')
  
  const [task, setTask] = useState<PlanRow | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'menu' | 'video' | 'article'>('menu')
  
  // 多言語スイッチ用: 'all' | 'ja' | 'zh'
  const [langMode, setLangMode] = useState<'all' | 'ja' | 'zh'>('all')

  const [seconds, setSeconds] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!taskId) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const username = getUsernameFromSession(session)
      const { data: taskData } = await supabase.from('plans').select('*').eq('id', taskId).single()
      if (taskData) {
        setTask(taskData)
        setSeconds(Math.round((taskData.actual_minutes ?? 0) * 60))
        await saveUserFields(username, {
          current_status: 'doing',
          status_updated_at: new Date().toISOString(),
        })
        const { data: resData } = await supabase.from('learning_resources')
          .select('*')
          .eq('material_name', taskData.mid_plan)
          .or(`page_no.eq.${taskData.page_range},resource_type.eq.common`)
        if (resData) setResources(resData)
      }
      setLoading(false)
    }
    fetchData()
  }, [taskId, router])

  useEffect(() => {
    if (isActive) { timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000) }
    else { if (timerRef.current) clearInterval(timerRef.current) }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isActive])

  // 言語タグ [:ja] [:zh] を処理する関数
  const parseLangText = (text: string) => {
    if (!text) return "";
    let processed = text;
    if (langMode === 'ja') {
      processed = text.replace(/\[:zh\].*?(\[:ja\]|$)/g, '$1').replace(/\[:ja\]/g, '');
    } else if (langMode === 'zh') {
      processed = text.replace(/\[:ja\].*?(\[:zh\]|$)/g, '$1').replace(/\[:zh\]/g, '');
    } else {
      processed = text.replace(/\[:ja\]/g, '\n🇯🇵 ').replace(/\[:zh\]/g, '\n🇨🇳 ');
    }
    return processed.trim();
  };

  const renderTextWithLinks = (text: string) => {
    const langText = parseLangText(text);
    if (!langText) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return langText.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all font-bold">🔗 リンク</a>
      }
      return part;
    });
  };

  const handleComplete = async () => {
    if (!task) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    const username = getUsernameFromSession(session)
    const minutes = Math.ceil(seconds / 60)
    await updatePlan(task.id, { is_done: 1, actual_minutes: minutes })
    await saveUserFields(username, {
      current_status: 'waiting_check',
      status_updated_at: new Date().toISOString(),
    })
    router.push(`/student/check?task_id=${task.id}`)
  }

  if (loading) return <div className="p-10 text-center animate-pulse text-yellow-600 font-bold">🐕 作戦会議中...</div>
  if (!task) return <div className="p-10 text-center">タスクがありません</div>

  const videoResource = resources.find(r => r.resource_type === 'page' && r.video_url)
  const pageExplanation = resources.find(r => r.resource_type === 'page')?.explanation
  const commonExplanations = resources.filter(r => r.resource_type === 'common')
  const hintText = resources.find(r => r.resource_type === 'page')?.hint_text

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col font-sans text-gray-800 pb-24">
      <div className="bg-yellow-400 p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center text-gray-900 border-b border-yellow-500">
        <button onClick={() => activeTab === 'menu' ? router.back() : setActiveTab('menu')} className="font-bold text-xs">
          {activeTab === 'menu' ? '← もどる' : '← ﾒﾆｭｰ'}
        </button>
        <div className="bg-gray-900 text-yellow-400 px-4 py-1.5 rounded-2xl font-mono font-black text-2xl shadow-xl">
          {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="px-2 flex justify-between items-end">
          <h1 className="text-lg font-black leading-tight">{task.task_name}</h1>
          {/* 言語切り替えスイッチ */}
          <div className="flex bg-gray-200 p-1 rounded-lg scale-90 origin-right">
            {(['all', 'ja', 'zh'] as const).map(m => (
              <button key={m} onClick={() => setLangMode(m)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${langMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                {m === 'all' ? '両方' : m === 'ja' ? '🇯🇵' : '🇨🇳'}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => setIsActive(!isActive)} className={`w-full py-5 rounded-[2rem] font-black shadow-lg transition-all ${isActive ? 'bg-orange-100 text-orange-600 border-2 border-orange-200' : 'bg-indigo-600 text-white border-2 border-indigo-700'}`}>
          {isActive ? '⏸ タイマー停止' : '▶︎ 集中を開始！'}
        </button>

        {activeTab === 'menu' && (
          <div className="space-y-4 animate-in fade-in">
            {hintText && (
              <div className="bg-white p-4 rounded-3xl border-2 border-yellow-200 text-sm italic text-gray-600 shadow-sm flex gap-3 items-center">
                <span className="text-2xl">🐕</span><p className="font-bold">{parseLangText(hintText)}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setActiveTab('video')} className={`w-full p-5 rounded-3xl border-2 flex items-center gap-4 transition ${videoResource ? 'bg-white border-red-100' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                <span className="text-3xl">📺</span><div className="text-left"><p className="font-black text-sm">解説動画をみる</p></div>
              </button>
              <button onClick={() => setActiveTab('article')} className="w-full bg-white p-5 rounded-3xl border-2 border-blue-100 flex items-center gap-4 transition">
                <span className="text-3xl">📖</span><div className="text-left"><p className="font-black text-sm">解き方のヒント</p></div>
              </button>
              <button onClick={() => router.push('/flash')} className="w-full bg-white p-5 rounded-3xl border-2 border-orange-100 flex items-center gap-4 transition">
                <span className="text-3xl">🃏</span><div className="text-left"><p className="font-black text-sm">単語を特訓</p></div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="aspect-video w-full bg-black rounded-3xl overflow-hidden shadow-2xl animate-in fade-in">
            {videoResource?.video_url ? <iframe src={videoResource.video_url.replace('watch?v=', 'embed/')} className="w-full h-full" allowFullScreen></iframe> : <div className="text-white p-10 text-center font-bold">動画準備中...🐕</div>}
          </div>
        )}

        {activeTab === 'article' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 pb-10">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-blue-50 space-y-2">
              <h2 className="font-black text-sm text-blue-600 uppercase tracking-widest text-center">📝 Today's Point</h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                {renderTextWithLinks(pageExplanation ?? '') || '特別なヒントはないよ。'}
              </div>
            </div>
            {commonExplanations.map((res, idx) => (
              <div key={idx} className="bg-indigo-900 text-white p-6 rounded-[2.5rem] shadow-xl border-4 border-yellow-400 space-y-2">
                <h2 className="font-black text-sm text-yellow-400 uppercase tracking-widest text-center">🛡️ Basic Rules</h2>
                <div className="leading-relaxed whitespace-pre-wrap text-sm opacity-90">
                  {renderTextWithLinks(res.explanation ?? '')}
                </div>
                {res.image_url && (
                  <div className="mt-4 rounded-xl overflow-hidden border-2 border-yellow-200/30">
                    <img src={res.image_url} alt="Reference" className="w-full h-auto" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-20">
        <button onClick={handleComplete} className="w-full py-4 bg-green-500 text-white rounded-2xl font-black shadow-xl active:scale-95 transition">✅ 学習を完了して報告！</button>
      </div>
    </div>
  )
}

export default function StudyHubPage() {
  return <Suspense><StudyHubContent /></Suspense>
}