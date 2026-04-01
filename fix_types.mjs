import { writeFileSync, readFileSync } from 'fs';

// help/page.tsx 修正
let help = readFileSync('src/app/student/help/page.tsx', 'utf8');
help = help.replace(
  "import { loadUser } from '@/lib/student'",
  "import { loadUser, type UserRow } from '@/lib/student'"
);
help = help.replace(
  'const [user, setUser] = useState(null)',
  'const [user, setUser] = useState<UserRow | null>(null)'
);
writeFileSync('src/app/student/help/page.tsx', help, 'utf8');
console.log('✅ help 修正完了');

// today/page.tsx 修正
let today = readFileSync('src/app/student/today/page.tsx', 'utf8');
today = today.replace(
  "import { loadUser, loadPlans } from '@/lib/student'",
  "import { loadUser, loadPlans, type UserRow, type PlanRow } from '@/lib/student'"
);
today = today.replace(
  'const [user, setUser] = useState(null)',
  'const [user, setUser] = useState<UserRow | null>(null)'
);
today = today.replace(
  'const [tasks, setTasks] = useState([])',
  'const [tasks, setTasks] = useState<PlanRow[]>([])'
);
writeFileSync('src/app/student/today/page.tsx', today, 'utf8');
console.log('✅ today 修正完了');
