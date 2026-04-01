import { writeFileSync, readFileSync } from 'fs';

let code = readFileSync('src/app/student/see/page.tsx', 'utf8');

// handleSave内の固定遷移を nextAction 分岐に変更
code = code.replace(
  `setTimeout(() => router.push('/student'), 2000)`,
  `const dest =
      nextAction === 'retry'     ? \`/student/do/\${task?.id}\` :
      nextAction === 'help'      ? \`/student/help?task_id=\${task?.id}\` :
      nextAction === 'next_task' ? '/student/today' :
      nextAction === 'rest'      ? '/student/break' :
                                   '/student'
    setTimeout(() => router.push(dest), 2000)`
);

writeFileSync('src/app/student/see/page.tsx', code, 'utf8');
console.log('✅ handleSave遷移先修正完了');
