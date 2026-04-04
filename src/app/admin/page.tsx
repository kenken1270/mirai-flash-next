'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Resource = {
  id: string; material_name: string; page_no: string; video_url: string; 
  explanation: string; hint_text: string; resource_type: string; created_at: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'realtime' | 'resources' | 'tasks'>('realtime')
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAddding] = useState(false)
  const [newRes, setNewRes] = useState({ 
    material_name: '', page_no: '', video_url: '', explanation: '', hint_text: '', resource_type: 'page' 
  })

  useEffect(() => { fetchResources() }, [])

  async function fetchResources() {
    setLoading(true)
    const { data } = await supabase.from('learning_resources').select('*').order('created_at', { ascending: false })
    setResources(data || [])
    setLoading(false)
  }

  async function handleAddResource() {
    const { error } = await supabase.from('learning_resources').insert([newRes])
    if (error) alert('登録エラー: ' + error.message)
    else {
      setIsAddding(false)
      setNewRes({ material_name: '', page_no: '', video_url: '', explanation: '', hint_text: '', resource_type: 'page' })
      fetchResources()
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 z-20">
        <h1 className="font-black text-xl tracking-tighter text-yellow-400">未来塾 管理者画面</h1>
        <div className="flex bg-gray-700 rounded-xl p-1">
          {['realtime', 'resources', 'tasks'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab===t ? 'bg-yellow-400 text-gray-900' : 'text-gray-400'}`}>{t === 'realtime' ? 'ライブ' : t === 'resources' ? '教材マスター' : 'タスク管理'}</button>
          ))}
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {activeTab === 'resources' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-black text-yellow-400 text-indigo-400">📦 教材コンテンツ管理</h2>
              <button onClick={() => setIsAddding(!isAdding)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg">{isAdding ? '× 閉じる' : '＋ 新規登録'}</button>
            </div>

            {isAdding && (
              <div className="bg-gray-800 p-6 rounded-3xl border-2 border-indigo-500 space-y-4 animate-in slide-in-from-top-4">
                <div className="flex bg-gray-700 p-1 rounded-xl w-fit">
                  <button onClick={() => setNewRes({...newRes, resource_type: 'page'})} className={`px-4 py-1 rounded-lg text-[10px] font-bold ${newRes.resource_type==='page' ? 'bg-indigo-500 text-white' : 'text-gray-400'}`}>ページ解説</button>
                  <button onClick={() => setNewRes({...newRes, resource_type: 'common'})} className={`px-4 py-1 rounded-lg text-[10px] font-bold ${newRes.resource_type==='common' ? 'bg-indigo-500 text-white' : 'text-gray-400'}`}>教材共通の基礎</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">教材名</label>
                    <input value={newRes.material_name} onChange={e => setNewRes({...newRes, material_name: e.target.value})} placeholder="例: 基礎トレーニング5級" className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">ページ番号 (共通の場合は空でも可)</label>
                    <input value={newRes.page_no} onChange={e => setNewRes({...newRes, page_no: e.target.value})} placeholder="例: P.1" className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">動画URL / 単語表URL</label>
                  <input value={newRes.video_url} onChange={e => setNewRes({...newRes, video_url: e.target.value})} placeholder="https://..." className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">一言アドバイス</label>
                  <input value={newRes.hint_text} onChange={e => setNewRes({...newRes, hint_text: e.target.value})} placeholder="柴犬先生のアドバイス" className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">解説記事・公式集 (Markdown形式)</label>
                  <textarea value={newRes.explanation} onChange={e => setNewRes({...newRes, explanation: e.target.value})} rows={6} placeholder="公式や重要なポイントをまとめよう" className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1"></textarea>
                </div>
                <button onClick={handleAddResource} className="w-full py-4 bg-indigo-600 rounded-2xl font-black shadow-xl active:scale-95 transition">登録を保存する</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resources.map(res => (
                <div key={res.id} className="bg-gray-800 p-4 rounded-2xl border border-gray-700 flex flex-col gap-2 relative overflow-hidden">
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase ${res.resource_type==='common' ? 'bg-orange-500' : 'bg-indigo-500'}`}>{res.resource_type}</div>
                  <p className="text-[10px] font-bold text-gray-500 truncate pr-16">{res.material_name}</p>
                  <h3 className="font-black text-lg">{res.page_no || '共通基礎'}</h3>
                  <div className="flex gap-2">
                    {res.video_url && <span className="text-[8px] border border-red-500/50 text-red-400 px-1 rounded">VIDEO</span>}
                    {res.explanation && <span className="text-[8px] border border-blue-500/50 text-blue-400 px-1 rounded">INFO</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}