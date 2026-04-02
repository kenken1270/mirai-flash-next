import { readFileSync, writeFileSync } from 'fs';

let code = readFileSync('src/app/student/page.tsx', 'utf8');

// デバッグ用：usernameをconsole.logで確認 + 表示名ロジック修正
code = code.replace(
  `const username = session.user.email?.split('@')[0] ?? ''`,
  `const username = session.user.email?.split('@')[0] ?? ''
      console.log('DEBUG username:', username, 'email:', session.user.email)`
);

// 表示名：nickname → username → メールの@前 の順で確実に表示
code = code.replace(
  `{user?.nickname ?? user?.username ?? '\u307e\u306a\u3073\u3073\u3068'}\u3055\u3093`,
  `{user?.nickname || user?.username || username || '\u307e\u306a\u3073\u3073\u3068'}\u3055\u3093`
);

writeFileSync('src/app/student/page.tsx', code, 'utf8');
console.log('OK');
