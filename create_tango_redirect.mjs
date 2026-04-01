import { writeFileSync, mkdirSync } from 'fs';

// tangoフォルダを作って、flashへリダイレクトするページを置く
mkdirSync('src/app/student/tango', { recursive: true });

const tango = `'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TangoRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/flash')
  }, [router])

  return (
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-7xl mb-4 animate-bounce">🃏</div>
        <p className="text-yellow-700 font-black text-xl">たんごアプリへ移動中…</p>
      </div>
    </div>
  )
}
`;

// ホーム画面のリンクをflash→tangoに更新（既にやっていれば上書きで問題なし）
import { readFileSync } from 'fs';
let home = readFileSync('src/app/student/page.tsx', 'utf8');

// flash残っていれば置換、tangoならそのまま
if (home.includes("'/student/flash'")) {
  home = home.replace(
    `{ id: 'flash',    label: 'フラッシュ', emoji: '⚡', href: '/student/flash'    }`,
    `{ id: 'tango',    label: 'たんご',     emoji: '🃏', href: '/student/tango'    }`
  );
  writeFileSync('src/app/student/page.tsx', home, 'utf8');
  console.log('ホームリンク: flash→tango 置換完了');
} else {
  console.log('ホームリンク: 既にtango設定済み');
}

writeFileSync('src/app/student/tango/page.tsx', tango, 'utf8');
console.log('OK: /student/tango → /flash リダイレクト作成完了');
