import { readFileSync, writeFileSync } from 'fs';

let code = readFileSync('src/app/student/page.tsx', 'utf8');

// username をstateとして保存するよう修正
code = code.replace(
  `const [loading, setLoading] = useState(true)`,
  `const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')`
);

// setUsernameを呼ぶ行を追加
code = code.replace(
  `const username = session.user.email?.split('@')[0] ?? ''
      console.log('DEBUG username:', username, 'email:', session.user.email)`,
  `const uname = session.user.email?.split('@')[0] ?? ''
      setUsername(uname)
      console.log('DEBUG username:', uname, 'email:', session.user.email)`
);

// loadUser/loadPlansのusername参照を uname に変更
code = code.replace(
  `const u = await loadUser(username)`,
  `const u = await loadUser(uname)`
);
code = code.replace(
  `const allPlans = await loadPlans(username)`,
  `const allPlans = await loadPlans(uname)`
);

writeFileSync('src/app/student/page.tsx', code, 'utf8');
console.log('OK');
