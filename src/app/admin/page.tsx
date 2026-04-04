'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

type Resource = {
  id: string; material_name: string; page_no: string; video_url: string; 
  explanation: string; hint_text: string; resource_type: string; 
  image_url?: string; created_at: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'realtime' | 'resources' | 'tasks'>('resources')
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAddding] = useState(false)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ 
    material_name: '', page_no: '', video_url: '', explanation: '', hint_text: '', resource_type: 'page', image_url: '' 
  })

  useEffect(() => { fetchResources() }, [])

  async function fetchResources() {
    setLoading(true)
    const { data } = await supabase.from('learning_resources').select('*')
      .order('material_name', { ascending: true })
      .order('resource_type', { ascending: false })
      .order('page_no', { ascending: true })
    setResources(data || [])
    setLoading(false)
  }

  const groupedResources = useMemo(() => {
    return resources.reduce((acc, res) => {
      const key = res.material_name || '未分類'
      if (!acc[key]) acc[key] = []
      acc[key].push(res)
      return acc
    }, {} as Record<string, Resource[]>)
  }, [resources])

  async function handleSave() {
    if (editingId) {
      const { error } = await supabase.from('learning_resources').update(form).eq('id', editingId)
      if (error) alert(error.message); else { setEditingId(null); fetchResources(); }
    } else {
      const { error } = await supabase.from('learning_resources').insert([form])
      if (error) alert(error.message); else { setIsAddding(false); fetchResources(); }
    }
    setForm({ material_name: '', page_no: '', video_url: '', explanation: '', hint_text: '', resource_type: 'page', image_url: '' })
  }

  const openEdit = (res: Resource) => {
    setEditingId(res.id)
    setForm({ ...res, image_url: res.image_url || '' })
    setIsAddding(true)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👨‍🏫</span>
          <h1 className="font-black text-lg tracking-tighter text-yellow-400 uppercase">Mirai Admin</h1>
        </div>
        <div className="flex bg-slate-800 rounded-xl p-1">
          {(['realtime', 'resources', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition ${activeTab===t ? 'bg-yellow-400 text-gray-900' : 'text-slate-500'}`}>{t}</button>
          ))}
        </div>
      </header>

      <main className="p-4 max-w-5xl mx-auto">
        {activeTab === 'realtime' && (
          <div className="py-10 text-center text-gray-500 italic">リアルタイム監視画面（準備中...）</div>
        )}

        {activeTab === 'resources' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2">📦 教材ライブラリ <span className="text-xs font-normal text-slate-500">全 {resources.length} 件</span></h2>
              <button onClick={() => {setIsAddding(!isAdding); setEditingId(null)}} className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-500 transition">
                {isAdding ? '✕ 閉じる' : '＋ 新規コンテンツ'}
              </button>
            </div>

            {isAdding && (
              <div className="bg-slate-900 p-6 rounded-3xl border-2 border-indigo-500/50 shadow-2xl space-y-4 animate-in slide-in-from-top-4">
                <h3 className="font-black text-indigo-400">{editingId ? '📝 コンテンツを編集' : '✨ 新しい解説を登録'}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input value={form.material_name} onChange={e => setForm({...form, material_name: e.target.value})} placeholder="教材名" className="bg-slate-800 border-none rounded-xl p-3 text-sm" />
                  <input value={form.page_no} onChange={e => setForm({...form, page_no: e.target.value})} placeholder="ページ番号" className="bg-slate-800 border-none rounded-xl p-3 text-sm" />
                </div>
                <div className="flex bg-slate-800 p-1 rounded-xl w-fit">
                  {(['page','common'] as const).map(t => (
                    <button key={t} onClick={() => setForm({...form, resource_type: t})} className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase ${form.resource_type===t ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>{t === 'page' ? 'ページ解説' : '教材の基礎'}</button>
                  ))}
                </div>
                <input value={form.video_url} onChange={e => setForm({...form, video_url: e.target.value})} placeholder="動画URL (YouTube)" className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm" />
                <input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="画像URL" className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm" />
                <input value={form.hint_text} onChange={e => setForm({...form, hint_text: e.target.value})} placeholder="一言アドバイス" className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm" />
                <textarea value={form.explanation} onChange={e => setForm({...form, explanation: e.target.value})} rows={5} placeholder="詳細な解説" className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm"></textarea>
                <button onClick={handleSave} className="w-full py-4 bg-indigo-600 rounded-2xl font-black shadow-xl active:scale-95 transition">この内容で保存する</button>
              </div>
            )}

            <div className="space-y-10">
              {Object.entries(groupedResources).map(([material, items]) => (
                <section key={material} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-1.5 h-5 bg-yellow-400 rounded-full"></span>
                    <h3 className="font-black text-slate-300">{material}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(res => (
                      <div key={res.id} onClick={() => openEdit(res)} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl hover:border-slate-600 transition cursor-pointer group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase ${res.resource_type==='common' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{res.resource_type}</div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-lg group-hover:text-yellow-400 transition">{res.page_no || '共通基礎'}</h4>
                          <div className="flex gap-1 text-sm">
                            {res.video_url && <span title="動画あり">📺</span>}
                            {res.image_url && <span title="画像あり">🖼️</span>}
                            {res.explanation?.includes('[:zh]') && <span title="多言語対応">🇨🇳</span>}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 italic">{res.hint_text || '(ヒント未登録)'}</p>
                        <div className="mt-3 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                          <span className="text-[9px] text-slate-600 font-bold uppercase">Update: {new Date(res.created_at).toLocaleDateString()}</span>
                          <span className="text-[10px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition">EDIT ›</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="py-10 text-center text-gray-500 italic">タスク管理画面（準備中...）</div>
        )}
      </main>
    </div>
  )
}