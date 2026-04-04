'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const menuItems = [
    { name: '🔥 今日のクエスト', path: '/student/today', icon: '🎯' },
    { name: '📅 未来の見通し', path: '/student/plan', icon: '🗺️' },
    { name: '🃏 単語学習', path: '/flash', icon: '📚' },
    { name: '📝 小テスト', path: '/student/test', icon: '✏️' },
    { name: '🐶 ぼくの成績', path: '/student', icon: '⭐' },
  ]

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex flex-col font-sans text-gray-800">
      {/* ヘッダー */}
      <header className="bg-yellow-400 px-4 py-4 shadow-sm flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2" onClick={() => router.push('/student')}>
          <span className="text-2xl">🐕</span>
          <h1 className="font-black italic tracking-tighter text-gray-900">MIRAI JUKU</h1>
        </div>

        {/* 三点リーダー（ハンバーガー）ボタン */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 focus:outline-none z-[60]"
        >
          <div className={`w-6 h-1 bg-gray-900 rounded-full transition-all ${isOpen ? 'rotate-45 translate-y-2.5' : ''}`}></div>
          <div className={`w-6 h-1 bg-gray-900 rounded-full transition-all ${isOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-6 h-1 bg-gray-900 rounded-full transition-all ${isOpen ? '-rotate-45 -translate-y-2.5' : ''}`}></div>
        </button>
      </header>

      {/* ドロワーメニュー */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] animate-in fade-in" onClick={() => setIsOpen(false)}></div>
          <div className="fixed top-0 right-0 bottom-0 w-64 bg-white z-[56] shadow-2xl p-6 pt-20 animate-in slide-in-from-right duration-300">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Menu</p>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <Link 
                  key={item.path} 
                  href={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${
                    pathname === item.path ? 'bg-yellow-400 text-gray-900 shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm">{item.name}</span>
                </Link>
              ))}
            </nav>
            <button 
              onClick={() => router.push('/login')}
              className="absolute bottom-10 left-6 right-6 py-3 rounded-xl border-2 border-gray-100 text-gray-400 font-bold text-xs"
            >
              ログアウト
            </button>
          </div>
        </>
      )}

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  )
}