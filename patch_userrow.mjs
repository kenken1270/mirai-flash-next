import { writeFileSync, readFileSync } from 'fs';
let code = readFileSync('src/lib/student.ts', 'utf8');
code = code.replace(
  'export type UserRow = {',
  'export type UserRow = {\n  exp?: number'
);
writeFileSync('src/lib/student.ts', code, 'utf8');
console.log('✅ UserRow に exp 追加完了');
