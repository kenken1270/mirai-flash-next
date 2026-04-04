'use client'
import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadUser, loadPlans, insertPlan, updatePlan, deletePlan, saveUserFields, todayStr, type UserRow, type PlanRow } from '@/lib/student'

function getWeekDates(center: string): string[] {
  const dates: string[] = []
  const base = new Date(center + 'T00:00:00')
  const day = base.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(base); monday.setDate(base.getDate() + diff)
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function PlanContent() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [user, setUser]         = useState<UserRow | null>(null)
  const [plans, setPlans]       = useState<PlanRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showAddStock, setShowAddStock] = useState(false)
  
  // クエスト追加用ステート
  const [newStock, setNewStock] = useState({ task_name: '', mid_plan: '', page_range: '', planned_minutes: 30 })
  const [availablePages, setAvailablePages] = useState<string[]>([])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uname = session.user.email?.split('@')[0] ?? ''
      setUsername(uname)
      const [u, p] = await Promise.all([loadUser(uname), loadPlans(uname)])
      setUser(u); setPlans(p); setLoading(false)
    }
    init()
  }, [router])

  // 教材名が選ばれたら、その教材のページリストを取得
  useEffect(() => {
    async function fetchPages() {
      if (!newStock.mid_plan) { setAvailablePages([]); return }
      const { data } = await supabase
        .from('learning_resources')
        .select('page_no')
        .eq('material_name', newStock.mid_plan)
        .eq('resource_type', 'page')
      
      const pages = Array.from(new Set(data?.map(d => d.page_no).filter(Boolean) || [])) as string[]
      setAvailablePages(pages.sort())
    }
    fetchPages()
  }, [newStock.mid_plan])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const bigGoal = useMemo(() => plans[0]?.big_plan || '受験合格！', [plans])
  const stockTasks = useMemo(() => plans.filter(p => !p.task_date && p.is_done === 0), [plans])
  const dayTasks = useMemo(() => plans.filter(p => p.task_date === selectedDate), [plans, selectedDate])
  
  // 既存の教材リスト（plansとlearning_resourcesの両方から取得）
  const [masterMaterials, setMasterMaterials] = useState<string[]>([])
  useEffect(() => {
    async function getMaterials() {
      const { data } = await supabase.from('learning_resources').select('material_name')
      const names = Array.from(new Set(data?.map(d => d.material_name).filter(Boolean) || [])) as string[]
      setMasterMaterials(names.sort())
    }
    getMaterials()
  }, [])

  async function addStockTask() {
    if (!newStock.task_name.trim() || !newStock.mid_plan.trim()) { alert("うめてね！"); return }
    await insertPlan({
      username, big_plan: bigGoal, mid_plan: newStock.mid_plan, task_name: newStock.task_name, task_date: '',
      is_done: 0, video_url: '', task_type: 'lesson', planned_minutes: newStock.planned_minutes,
      material_id: '', page_range: newStock.page_range, deadline: '', month_plan: '',
    })
    setPlans(await loadPlans(username)); setNewStock({ task_name: '', mid_plan: '', page_range: '', planned_minutes: 30 })
    setShowAddStock(false); showToast('📦 プールに保存！')
  }

  async function assignTaskToDate(task: PlanRow) {
    await updatePlan(task.id, { task_date: selectedDate }); setPlans(await loadPlans(username)); showToast(`📅 セットしたよ！`)
  }

  async function toggleDone(task: PlanRow) {
    const nd = task.is_done === 1 ? 0 : 1
    await updatePlan(task.id, { is_done: nd }); setPlans(await loadPlans(username))
    if (nd === 1 && user) { showToast('🎉 ナイス！+10 EXP'); await saveUserFields(username, { current_points: (user.current_points ?? 0) + 10 }) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF0] animate-pulse text-yellow-600 font-bold">🐕 準備中...</div>

  return (
    <div className="min-h-screen bg-[#FFFDF0] pb-24 font-sans text-gray-800 flex flex-col">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg font-black text-white bg-indigo-600">{toast}</div>}
      <div className="px-4 py-6 bg-gray-900 text-white shadow-xl">
        <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-1">Main Quest</p>
        <h1 className="text-xl font-black italic text-yellow-400">🏆 {bigGoal}</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <section className="space-y-3">
          <div className="flex justify-between items-end px-1"><h2 className="text-sm font-black text-gray-400 uppercase">📦 Quest Pool</h2><button onClick={() => setShowAddStock(true)} className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg">＋ 追加</button></div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {stockTasks.length === 0 ? <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 min-w-[200px] text-center text-gray-300 text-xs">クエストを作ろう</div> : stockTasks.map(t => (
              <div key={t.id} onClick={() => assignTaskToDate(t)} className="bg-white border-2 border-yellow-100 rounded-2xl p-4 min-w-[160px] shadow-sm active:scale-95 transition-all">
                <p className="text-[9px] text-gray-400 font-bold mb-1 truncate">{t.mid_plan}</p>
                <p className="font-black text-sm mb-2 h-10 overflow-hidden">{t.task_name}</p>
                <p className="text-[10px] text-indigo-500 font-black">📅 今日にセット</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-end px-1"><h2 className="text-sm font-black text-gray-400 uppercase">⚡ Daily Planner</h2><p className="text-[10px] font-black text-indigo-500">{selectedDate}</p></div>
          <div className="flex gap-1 justify-between">
            {getWeekDates(todayStr()).map(d => (
              <button key={d} onClick={() => setSelectedDate(d)} className={`flex-1 flex flex-col items-center py-3 rounded-2xl border-2 transition-all ${d === selectedDate ? 'bg-yellow-400 border-yellow-500 text-gray-900 shadow-md' : 'bg-white border-gray-50 text-gray-300'}`}>
                <span className="text-[9px] font-black uppercase">{['日','月','火','水','木','金','土'][new Date(d+'T00:00:00').getDay()]}</span>
                <span className="text-sm font-black mt-1">{d.slice(8)}</span>
              </button>
            ))}
          </div>
          <div className="space-y-3 pb-10">
            {dayTasks.map(t => (
              <div key={t.id} className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${t.is_done ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-white border-yellow-100 shadow-sm'}`}>
                <button onClick={() => toggleDone(t)} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${t.is_done ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>{t.is_done===1 && <span className="text-white">✓</span>}</button>
                <div className="flex-1" onClick={() => router.push(`/student/study?taskId=${t.id}`)}>
                  <p className="text-[9px] text-indigo-400 font-bold">{t.mid_plan} {t.page_range}</p>
                  <p className={`font-black text-sm ${t.is_done ? 'text-gray-400 line-through' : ''}`}>{t.task_name}</p>
                </div>
                <button onClick={() => updatePlan(t.id, { task_date: '' }).then(() => loadPlans(username).then(setPlans))} className="text-gray-300 text-xs">× 戻す</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showAddStock && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end p-4 animate-in fade-in" onClick={() => setShowAddStock(false)}>
          <div className="bg-white rounded-t-[2.5rem] w-full p-6 space-y-4 max-w-md mx-auto mb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-black text-lg">NEW QUEST</h2>
            <div className="space-y-3">
              <input placeholder="タスク名 (例: 第1課の練習B)" value={newStock.task_name} onChange={e => setNewStock({...newStock, task_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newStock.mid_plan} onChange={e => setNewStock({...newStock, mid_plan: e.target.value, page_range: ''})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none text-xs appearance-none">
                  <option value="">教材をえらぶ</option>
                  {masterMaterials.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={newStock.page_range} onChange={e => setNewStock({...newStock, page_range: e.target.value})} className={`w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none text-xs appearance-none ${!newStock.mid_plan ? 'opacity-30' : ''}`} disabled={!newStock.mid_plan}>
                  <option value="">ページ</option>
                  {availablePages.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addStockTask} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">保存！</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlanPage() { return <Suspense><PlanContent /></Suspense> }