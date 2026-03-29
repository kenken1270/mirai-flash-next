'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STUDENT_PASSWORD = 'mirai2026'

export default function LoginPage() {
  const router = useRouter()
  const [userList, setUserList] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase
        .from('users')
        .select('username')
        .order('username')
      if (data) {
        const names = data.map((r: { username: string }) => r.username)
        setUserList(names)
        if (names.length > 0) setSelected(names[0])
      }
      setLoadingUsers(false)
    }
    fetchUsers()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isAdmin) {
      // 管理者：localStorageにフラグを立ててadminページへ
      if (password === 'admin') {
        localStorage.setItem('mirai_admin', 'true')
        router.push('/admin')
      } else {
        setError('管理者パスワードが違います')
      }
      setLoading(false)
      return
    }

    // 生徒：まずパスワード確認（共通パスワード）
    if (password !== STUDENT_PASSWORD) {
      setError('パスワードが違います')
      setLoading(false)
      return
    }

    const email = `${selected}@mirai-juku.internal`

    // ① まずログイン試行
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: STUDENT_PASSWORD,
    })

    if (!signInError) {
      // ログイン成功
      router.push('/student')
      return
    }

    // ② ログイン失敗 → 新規作成を試みる
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: STUDENT_PASSWORD,
    })

    if (signUpError) {
      // すでに存在するがパスワードが違う場合
      setError('ログインできませんでした。管理者に連絡してください。')
      setLoading(false)
      return
    }

    // ③ 作成後に再ログイン
    const { error: retryError } = await supabase.auth.signInWithPassword({
      email,
      password: STUDENT_PASSWORD,
    })

    if (retryError) {
      setError('ログインに失敗しました。管理者に連絡してください。')
      setLoading(false)
      return
    }

    router.push('/student')
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">📚</div>
          <h1 className="text-3xl font-bold text-yellow-500">未来塾</h1>
          <p className="text-gray-500 text-sm mt-1">MIRAI JAPANESE LANGUAGE SCHOOL</p>
          <p className="text-gray-600 mt-2 text-sm">楽しく学んで、未来を切り開こう！</p>
        </div>

        {/* フォーム */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-bold text-center text-gray-700 mb-5">🔐 ログイン</h2>

          <form onSubmit={handleLogin} className="space-y-4">

            {!isAdmin ? (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  なまえを選んでください
                </label>
                {loadingUsers ? (
                  <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-400 text-sm">
                    読み込み中...
                  </div>
                ) : (
                  <select
                    value={selected}
                    onChange={e => setSelected(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800
                      focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white text-base"
                  >
                    {userList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                <span className="text-2xl">👨‍🏫</span>
                <p className="font-bold text-gray-700 mt-1">管理者ログイン</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800
                  focus:outline-none focus:ring-2 focus:ring-yellow-400"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2 text-sm">
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || loadingUsers}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-3
                rounded-xl transition disabled:opacity-50 text-base"
            >
              {loading ? '確認中...' : isAdmin ? '👨‍🏫 管理者としてログイン' : '🚀 ログイン'}
            </button>

            <button
              type="button"
              onClick={() => { setIsAdmin(!isAdmin); setError(''); setPassword('') }}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition py-1"
            >
              {isAdmin ? '← 生徒ログインに戻る' : '👨‍🏫 管理者の方はこちら'}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}