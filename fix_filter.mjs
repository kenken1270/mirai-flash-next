import { readFileSync, writeFileSync } from 'fs';

let code = readFileSync('src/app/student/page.tsx', 'utf8');

// 間違ったフィルタを正しいものに置換
code = code.replace(
  `p.task_date === today || (!p.task_date && p.is_done === 0)`,
  `p.task_date === today`
);

writeFileSync('src/app/student/page.tsx', code, 'utf8');
console.log('OK');
