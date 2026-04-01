import { writeFileSync, readFileSync } from 'fs';
let code = readFileSync('src/app/student/see/page.tsx', 'utf8');
code = code.replace(
  `setTimeout(() => router.push('/student'), 2000)`,
  `setTimeout(() => {
      if (nextAction === 'rest') router.push('/student')
      else router.push('/student/plan')
    }, 2000)`
);
writeFileSync('src/app/student/see/page.tsx', code, 'utf8');
console.log('✅ 遷移先修正完了');
