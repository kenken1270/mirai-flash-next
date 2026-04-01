import { writeFileSync, readFileSync } from 'fs';
let code = readFileSync('src/app/student/see/page.tsx', 'utf8');
code = code.replace(
  `await supabase.from('users').update({ exp: (user.exp ?? 0) + addExp }).eq('username', user.username)`,
  `await supabase.from('users').update({ current_points: (user.current_points ?? 0) + addExp }).eq('username', user.username)`
);
writeFileSync('src/app/student/see/page.tsx', code, 'utf8');
console.log('✅ exp -> current_points 修正完了');
