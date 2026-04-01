import { writeFileSync, readFileSync } from 'fs';

// 1. tailwind.config.ts にブランドカラー追加
const twConfig = `import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        mirai: {
          yellow:  '#F59E0B',
          cream:   '#FFFBEB',
          brown:   '#92400E',
          success: '#10B981',
          danger:  '#EF4444',
          soft:    '#FEF3C7',
        },
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
`;

// 2. app/layout.tsx に Noto Sans JP を追加（Next.js font）
const appLayout = `import type { Metadata } from 'next'
import { Noto_Sans_JP } from 'next/font/google'
import './globals.css'

const noto = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '未来塾',
  description: '楽しく学ぶ！未来塾アプリ',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={noto.className}>{children}</body>
    </html>
  )
}
`;

writeFileSync('tailwind.config.ts', twConfig, 'utf8');
writeFileSync('src/app/layout.tsx', appLayout, 'utf8');
console.log('OK: tailwind.config.ts + app/layout.tsx 書き換え完了');
