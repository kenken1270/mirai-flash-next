import { writeFileSync } from 'fs';
import { readFileSync } from 'fs';

let code = readFileSync('src/app/student/see/page.tsx', 'utf8');

// score -> see_score, memo -> see_comment に修正
code = code.replace(
  `await updatePlan(task.id, {
      score: stamp,
      memo: JSON.stringify(meta),
      done: true,
    })`,
  `await updatePlan(task.id, {
      see_score: stamp,
      see_comment: JSON.stringify(meta),
      is_done: 1,
    })`
);

writeFileSync('src/app/student/see/page.tsx', code, 'utf8');
console.log('✅ フィールド名修正完了');
