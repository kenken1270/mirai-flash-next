'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Resource = {
  id: string; material_name: string; page_no: string; video_url: string; 
  explanation: string; hint_text: string; created_at: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'realtime' | 'resources' | 'tasks'>('realtime')
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)

  // フォーム用
  const [isAdding, setIsAddding] = useState(false)
  const [newRes, setNewRes] = useState({ material_name: '', page_no: '', video_url: '', explanation: '', hint_text: '' })

  useEffect(() => {
    fetchResources()
  }, [])

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
      setNewRes({ material_name: '', page_no: '', video_url: '', explanation: '', hint_text: '' })
      fetchResources()
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* 管理者ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 z-20">
        <h1 className="font-black text-xl tracking-tighter text-yellow-400">未来塾 管理者画面</h1>
        <div className="flex bg-gray-700 rounded-xl p-1">
          <button onClick={() => setActiveTab('realtime')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab==='realtime' ? 'bg-yellow-400 text-gray-900' : 'text-gray-400'}`}>ライブ</button>
          <button onClick={() => setActiveTab('resources')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab==='resources' ? 'bg-yellow-400 text-gray-900' : 'text-gray-400'}`}>教材マスター</button>
          <button onClick={() => setActiveTab('tasks')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab==='tasks' ? 'bg-yellow-400 text-gray-900' : 'text-gray-400'}`}>タスク管理</button>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {activeTab === 'realtime' && (
          <div className="py-10 text-center text-gray-500 italic">リアルタイム監視画面（準備中...）</div>
        )}

        {activeTab === 'resources' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-black text-yellow-400">📦 教材コンテンツ管理</h2>
              <button onClick={() => setIsAddding(!isAdding)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg">
                {isAdding ? '× 閉じる' : '＋ 新規登録'}
              </button>
            </div>

            {isAdding && (
              <div className="bg-gray-800 p-6 rounded-3xl border-2 border-indigo-500 space-y-4 animate-in slide-in-from-top-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">教材名</label>
                    <input value={newRes.material_name} onChange={e => setNewRes({...newRes, material_name: e.target.value})} placeholder="例: 基礎トレーニング5級" className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1 focus:ring-2 ring-indigo-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">ページ番号</label>
                    <input value={newRes.page_no} onChange={e => setNewRes({...newRes, page_no: e.target.value})} placeholder="例: P.1" className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1 focus:ring-2 ring-indigo-400" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">動画URL (YouTube埋め込みURLを推奨)</label>
                  <input value={newRes.video_url} onChange={e => setNewRes({...newRes, video_url: e.target.value})} placeholder="https://www.youtube.com/embed/..." className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1 focus:ring-2 ring-indigo-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">柴犬先生のヒント</label>
                  <input value={newRes.hint_text} onChange={e => setNewRes({...newRes, hint_text: e.target.value})} placeholder="一言アドバイス" className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1 focus:ring-2 ring-indigo-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">詳細解説 (Markdown形式可)</label>
                  <textarea value={newRes.explanation} onChange={e => setNewRes({...newRes, explanation: e.target.value})} rows={4} placeholder="重要なポイントを書き込もう" className="w-full bg-gray-700 border-none rounded-xl p-3 text-sm mt-1 focus:ring-2 ring-indigo-400"></textarea>
                </div>
                <button onClick={handleAddResource} className="w-full py-4 bg-indigo-600 rounded-2xl font-black shadow-xl active:scale-95 transition">登録を保存する</button>
              </div>
            )}

            <div className="space-y-3">
              {resources.length === 0 ? (
                <p className="text-center py-20 text-gray-600">登録された教材はありません</p>
              ) : resources.map(res => (
                <div key={res.id} className="bg-gray-800 p-4 rounded-2xl border border-gray-700 flex justify-between items-center group">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">{res.material_name}</p>
                    <h3 className="font-black text-lg">{res.page_no}</h3>
                    <div className="flex gap-3 mt-1">
                      {res.video_url && <span className="text-[10px] bg-red-900/50 text-red-400 px-2 py-0.5 rounded border border-red-800">VIDEO</span>}
                      {res.explanation && <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded border border-blue-800">ARTICLE</span>}
                    </div>
                  </div>
                  <button className="text-gray-600 group-hover:text-yellow-400 transition">✏️ 編集</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}