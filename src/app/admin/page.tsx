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
  
  // 選択・管理用ステート
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'page' | 'common'>('page')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({ 
    material_name: '', page_no: '', video_url: '', explanation: '', hint_text: '', resource_type: 'page', image_url: '' 
  })

  useEffect(() => { fetchResources() }, [])

  async function fetchResources() {
    setLoading(true)
    const { data } = await supabase.from('learning_resources').select('*')
      .order('material_name', { ascending: true })
      .order('page_no', { ascending: true })
    setResources(data || [])
    setLoading(false)
  }

  const materials = useMemo(() => Array.from(new Set(resources.map(r => r.material_name))), [resources])
  
  const filteredResources = useMemo(() => {
    return resources.filter(r => r.material_name === selectedMaterial && r.resource_type === subTab)
  }, [resources, selectedMaterial, subTab])

  async function handleSave() {
    const dataToSave = { ...form, material_name: selectedMaterial || form.material_name }
    if (editingId) {
      await supabase.from('learning_resources').update(dataToSave).eq('id', editingId)
    } else {
      await supabase.from('learning_resources').insert([dataToSave])
    }
    setEditingId(null); setIsAdding(false); fetchResources()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-20">
      {/* ヘッダー：目に優しい配色 */}
      <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐕</span>
          <h1 className="font-black text-lg tracking-tighter text-indigo-900 uppercase">Mirai Admin</h1>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1">
          {(['realtime', 'resources', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition ${activeTab===t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto flex h-[calc(100-64px)]">
        {activeTab === 'resources' && (
          <>
            {/* 左サイド：教材選択ツリー */}
            <div className="w-64 bg-white border-r border-slate-200 p-4 space-y-4 overflow-y-auto hidden md:block">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Library</h2>
              <div className="space-y-1">
                {materials.map(m => (
                  <button key={m} onClick={() => setSelectedMaterial(m)} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition ${selectedMaterial === m ? 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* 右メイン：コンテンツ管理エリア */}
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              {!selectedMaterial ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                  <span className="text-6xl">📚</span>
                  <p className="font-bold">左のリストから教材を選んでね</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Editing Material</p>
                      <h2 className="text-2xl font-black text-slate-800">{selectedMaterial}</h2>
                    </div>
                    <button onClick={() => {setIsAdding(true); setEditingId(null); setForm({material_name: selectedMaterial, page_no:'', video_url:'', explanation:'', hint_text:'', resource_type: subTab, image_url:''})}} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md active:scale-95 transition">＋ 新規追加</button>
                  </div>

                  {/* サブタブ切替 */}
                  <div className="flex border-b border-slate-200 gap-8">
                    <button onClick={() => setSubTab('page')} className={`pb-3 text-sm font-black transition-all ${subTab==='page' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400'}`}>📖 ページ別解説</button>
                    <button onClick={() => setSubTab('common')} className={`pb-3 text-sm font-black transition-all ${subTab==='common' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400'}`}>🛡️ 共通保管庫</button>
                  </div>

                  {/* 編集フォーム（モーダル風表示） */}
                  {(isAdding || editingId) && (
                    <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-xl space-y-4 animate-in slide-in-from-top-4">
                      <div className="grid grid-cols-2 gap-4">
                        <input value={form.page_no} onChange={e => setForm({...form, page_no: e.target.value})} placeholder={subTab==='page' ? "ページ番号 (例: p.6)" : "保管庫の名前 (例: 五十音図)"} className="bg-slate-50 border-none rounded-xl p-3 text-sm" />
                        <input value={form.video_url} onChange={e => setForm({...form, video_url: e.target.value})} placeholder="YouTube URL" className="bg-slate-50 border-none rounded-xl p-3 text-sm" />
                      </div>
                      <input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="画像URL (Public URL)" className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm" />
                      <input value={form.hint_text} onChange={e => setForm({...form, hint_text: e.target.value})} placeholder="一言アドバイス" className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm" />
                      <textarea value={form.explanation} onChange={e => setForm({...form, explanation: e.target.value})} rows={subTab==='common' ? 3 : 6} placeholder={subTab==='common' ? "保管庫の概要（空でもOK）" : "詳しい解説内容"} className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm"></textarea>
                      <div className="flex gap-3">
                        <button onClick={() => {setIsAdding(false); setEditingId(null)}} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold">キャンセル</button>
                        <button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">保存する</button>
                      </div>
                    </div>
                  )}

                  {/* コンテンツ一覧 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredResources.map(res => (
                      <div key={res.id} onClick={() => {setEditingId(res.id); setForm({...res, image_url: res.image_url||''}); setIsAdding(false)}} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-slate-800">{res.page_no || 'No Title'}</h4>
                          <div className="flex gap-1 text-xs">
                            {res.video_url && <span>📺</span>}
                            {res.image_url && <span>🖼️</span>}
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 italic">{res.hint_text || 'No hint'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}