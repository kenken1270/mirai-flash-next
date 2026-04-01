import { writeFileSync, readFileSync } from 'fs';
let code = readFileSync('src/app/student/see/write_see.mjs', 'utf8');
code = code.replace('score: stamp,', 'see_score: stamp,');
code = code.replace('memo: JSON.stringify(meta),', 'see_comment: JSON.stringify(meta),');
code = code.replace('done: true,', 'is_done: 1,');
writeFileSync('src/app/student/see/write_see.mjs', code, 'utf8');
console.log('✅ write_see.mjs 修正完了');
