import { writeFileSync, readFileSync } from 'fs';
let page = readFileSync('src/app/student/page.tsx', 'utf8');

// MENU_ITEMSを置き換え
const oldMenu = `const MENU_ITEMS = [
  { path: '/student/schedule',  icon: '套', label: '莉頑律縺ｮ蟄ｦ鄙・,  color: 'from-blue-400 to-blue-500',    bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
  { path: '/student/calendar',  icon: '宕', label: '繧ｫ繝ｬ繝ｳ繝繝ｼ', color: 'from-indigo-400 to-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  { path: '/student/plan',      icon: '亮・・, label: '險育判邂｡逅・,   color: 'from-green-400 to-green-500',   bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
  { path: '/student/test',      icon: '笨擾ｸ・, label: '蟆上ユ繧ｹ繝・,   color: 'from-purple-400 to-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  { path: '/student/gacha',     icon: '氏', label: '繧ｬ繝√Ε',     color: 'from-pink-400 to-pink-500',     bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700' },
  { path: '/flash',             icon: '笞｡', label: '蜊倩ｪ槭い繝励Μ', color: 'from-yellow-400 to-orange-500', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
]`;

const newMenu = `const MENU_ITEMS = [
  { path: '/student/today',    icon: '📅', label: '今日のタスク',  color: 'from-orange-400 to-orange-500',  bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700' },
  { path: '/student/plan',     icon: '📋', label: '計画管理',     color: 'from-green-400 to-green-500',    bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-700' },
  { path: '/student/calendar', icon: '🗓', label: 'カレンダー',   color: 'from-indigo-400 to-indigo-500',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700' },
  { path: '/student/test',     icon: '📝', label: 'テスト',       color: 'from-purple-400 to-purple-500',  bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700' },
  { path: '/student/gacha',    icon: '🎰', label: 'ガチャ',       color: 'from-pink-400 to-pink-500',      bg: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-700' },
  { path: '/flash',            icon: '⚡', label: '単語アプリ',   color: 'from-yellow-400 to-orange-500',  bg: 'bg-yellow-50',  border: 'border-yellow-200',  text: 'text-yellow-700' },
]`;

page = page.replace(oldMenu, newMenu);
writeFileSync('src/app/student/page.tsx', page, 'utf8');
console.log('✅ MENU_ITEMS修正完了');
