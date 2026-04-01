import { writeFileSync, readFileSync } from 'fs';
let layout = readFileSync('src/app/student/layout.tsx', 'utf8');

// NAV配列を丸ごと置き換え
layout = layout.replace(
`const NAV = [
  { href: '/student',          label: '繝帙・繝',     icon: '匠' },
  { href: '/student/schedule', label: '莉頑律',       icon: '套' },
  { href: '/student/calendar', label: '繧ｫ繝ｬ繝ｳ繝繝ｼ', icon: '宕' },
  { href: '/student/plan',     label: '險育判',       icon: '亮・・ },
  { href: '/student/test',     label: '繝・せ繝・,     icon: '笨擾ｸ・ },
]`,
`const NAV = [
  { href: '/student',          label: 'ホーム',       icon: '🏠' },
  { href: '/student/today',    label: '今日',         icon: '📅' },
  { href: '/student/calendar', label: 'カレンダー',   icon: '🗓' },
  { href: '/student/plan',     label: '計画',         icon: '📋' },
  { href: '/student/test',     label: 'テスト',       icon: '📝' },
]`
);
writeFileSync('src/app/student/layout.tsx', layout, 'utf8');
console.log('✅ layout.tsx NAV修正完了');
