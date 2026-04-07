import type { Metadata } from 'next'
import { Noto_Sans_JP, Geist } from 'next/font/google'
import './globals.css'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="ja" className={cn("font-sans", geist.variable)}>
      <body className={noto.className}>{children}</body>
    </html>
  )
}
