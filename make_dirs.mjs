import { writeFileSync, mkdirSync } from 'fs';
mkdirSync('src/app/student/help', { recursive: true });
mkdirSync('src/app/student/today', { recursive: true });
mkdirSync('src/app/student/break', { recursive: true });
console.log('✅ ディレクトリ作成完了');
