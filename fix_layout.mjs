import { writeFileSync } from 'fs';

const layout = `'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/student',          label: 'ホーム',       icon: '🏠' },
  { href: '/student/today',    label: '今日',          icon: '📚' },
  { href: '/student/calendar', label: 'カレンダー',    icon: '📅' },
  { href: '/student/plan',     label: '計画',          icon: '🗺️'  },
  { href: '/student/test',     label: 'テスト',        icon: '✏️'  },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#FFFDF0' }}>

      {/* ===== 全ページ共通ヘッダー ===== */}
      <header
        className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between shadow-sm"
        style={{ background: '#FCD34D' }}
      >
        <Link href="/student" className="flex items-center gap-2">
          <span className="text-2xl">🐕</span>
          <span className="font-black text-lg" style={{ color: '#1C1410' }}>未来塾</span>
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm bg-white px-3 py-1.5 rounded-full shadow font-bold transition-all active:scale-95"
          style={{ color: '#78350F', border: '1px solid #F59E0B' }}
        >
          🚪 ログアウト
        </button>
      </header>

      {/* ===== メインコンテンツ ===== */}
      <main className="pb-24">
        {children}
      </main>

      {/* ===== ボトムナビ（全ページ共通） ===== */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 shadow-lg"
        style={{ borderColor: '#FDE68A' }}>
        <div className="flex justify-around items-center max-w-2xl mx-auto">
          {NAV.map(({ href, label, icon }) => {
            const isActive = pathname === href ||
              (href !== '/student' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className="flex flex-col items-center py-2 px-3 text-xs transition-all"
                style={{ color: isActive ? '#F59E0B' : '#9CA3AF' }}
              >
                <span className="text-xl mb-0.5">{icon}</span>
                <span className={isActive ? 'font-black' : ''}>{label}</span>
                {isActive && (
                  <span className="w-4 h-1 rounded-full mt-0.5" style={{ background: '#F59E0B' }} />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
`;

writeFileSync('src/app/student/layout.tsx', layout, 'utf8');
console.log('OK');
