import { writeFileSync, readFileSync } from 'fs';
let code = readFileSync('src/app/student/break/page.tsx', 'utf8');
code = code.replace('const fmt = (s)', 'const fmt = (s: number)');
writeFileSync('src/app/student/break/page.tsx', code, 'utf8');
console.log('✅ 型エラー修正完了');
