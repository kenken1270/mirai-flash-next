'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/student',          label: 'ホーム',     icon: '🏠' },
  { href: '/student/today',    label: '今日',        icon: '📅' },
  { href: '/student/calendar', label: 'カレンダー',  icon: '🗓' },
  { href: '/student/plan',     label: '計画',        icon: '📋' },
  { href: '/student/test',     label: 'テスト',      icon: '📝' },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/student'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ホーム以外のみヘッダー表示 */}
      {!isHome && (
        <header className="bg-yellow-400 shadow-md px-4 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-bold text-gray-800 text-lg">未来塾</span>
          </div>
          <button onClick={handleLogout}
            className="text-sm bg-white text-gray-700 px-3 py-1 rounded-full shadow hover:bg-gray-100 transition">
            🚪 ログアウト
          </button>
        </header>
      )}

      <main className={`${isHome ? '' : 'max-w-2xl mx-auto px-4 pt-4 pb-24'}`}>
        {children}
      </main>

      {/* ホーム以外のみボトムナビ表示 */}
      {!isHome && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="flex justify-around items-center max-w-2xl mx-auto">
            {NAV.map(({ href, label, icon }) => {
              const isActive = pathname === href || (href !== '/student' && pathname.startsWith(href))
              return (
                <Link key={href} href={href}
                  className={`flex flex-col items-center py-2 px-3 text-xs transition-colors ${isActive ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}>
                  <span className="text-xl mb-0.5">{icon}</span>
                  <span>{label}</span>
                  {isActive && <span className="w-1 h-1 rounded-full bg-yellow-400 mt-0.5" />}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
