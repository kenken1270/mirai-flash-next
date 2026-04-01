import { writeFileSync, readFileSync } from 'fs';

let code = readFileSync('src/lib/student.ts', 'utf8');

const helpType = `
export type HelpRequestRow = {
  id: number
  username: string
  subject: string
  question: string
  tried?: string
  task_id?: number
  status: 'open' | 'answered'
  teacher_comment?: string
  commented_at?: string
  created_at: string
}

export async function insertHelpRequest(row: Omit<HelpRequestRow, 'id' | 'status' | 'created_at'>) {
  const { error } = await supabase.from('help_requests').insert({ ...row, status: 'open' })
  if (error) console.error('insertHelpRequest:', error)
}

export async function loadHelpRequests(username: string) {
  const { data } = await supabase
    .from('help_requests')
    .select('*')
    .eq('username', username)
    .order('created_at', { ascending: false })
  return (data ?? []) as HelpRequestRow[]
}

export async function loadAllHelpRequests() {
  const { data } = await supabase
    .from('help_requests')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as HelpRequestRow[]
}

export async function answerHelpRequest(id: number, comment: string) {
  const { error } = await supabase
    .from('help_requests')
    .update({ status: 'answered', teacher_comment: comment, commented_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('answerHelpRequest:', error)
}
`;

// ファイル末尾に追記
code = code + helpType;
writeFileSync('src/lib/student.ts', code, 'utf8');
console.log('✅ HelpRequestRow型＋関数追加完了');
