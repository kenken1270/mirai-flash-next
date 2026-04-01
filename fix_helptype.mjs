import { writeFileSync, readFileSync } from 'fs';
let help = readFileSync('src/app/student/help/page.tsx', 'utf8');
help = help.replace(
  'const [helpType, setHelpType] = useState(null)',
  'const [helpType, setHelpType] = useState<string | null>(null)'
);
help = help.replace(
  'const [question, setQuestion] = useState(\'\')',
  'const [question, setQuestion] = useState<string>(\'\')'
);
help = help.replace(
  'const [tried, setTried] = useState(\'\')',
  'const [tried, setTried] = useState<string>(\'\')'
);
writeFileSync('src/app/student/help/page.tsx', help, 'utf8');
console.log('✅ helpType型修正完了');
