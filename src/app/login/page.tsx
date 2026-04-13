'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/with-timeout'

const STUDENT_PASSWORD = 'Mirai2026'
const ADMIN_PASSWORD = 'admin'

type Role = 'student' | 'parent' | 'admin'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role>('student')
  /** 表示は nickname 優先。Auth メールは username@mirai-juku.internal（ASCII のみ可） */
  const [userRows, setUserRows] = useState<{ username: string; nickname: string | null }[]>([])
  const [selected, setSelected] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [parentName, setParentName] = useState('')
  const [error, setError] = useState('')
  const [usersFetchError, setUsersFetchError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchUsers() {
      setUsersFetchError('')
      try {
        const q = supabase.from('users').select('username,nickname').order('username')
        const { data, error: qErr } = await withTimeout(
          q as unknown as Promise<{
            data: { username: string; nickname: string | null }[] | null
            error: { message: string } | null
          }>,
          20000,
          'ユーザー一覧'
        )
        if (cancelled) return
        if (qErr) {
          setUsersFetchError('ユーザー一覧を取得できませんでした。ネットワークを確認してください。')
          return
        }
        if (data) {
          setUserRows(data)
          if (data.length > 0) {
            setSelected(data[0].username)
            setParentName(data[0].username)
          }
        }
      } catch (e) {
        console.error('fetchUsers:', e)
        if (!cancelled) {
          setUsersFetchError(
            'サーバーへの接続がタイムアウトしました。VPN・Wi‑Fi・Supabase の状態を確認してください。'
          )
        }
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }
    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [])

  function resetForm() {
    setPassword('')
    setPin('')
    setError('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // ===== 管理者 =====
    if (role === 'admin') {
      if (password === ADMIN_PASSWORD) {
        localStorage.setItem('mirai_admin', 'true')
        router.push('/admin')
      } else {
        setError('管理者パスワードが違います')
      }
      setLoading(false)
      return
    }

    // ===== 保護者 =====
    if (role === 'parent') {
      if (!parentName) { setError('お子さんの名前を選んでください'); setLoading(false); return }
      const { data, error: dbError } = await supabase
        .from('users')
        .select('pin')
        .eq('username', parentName)
        .single()
      if (dbError || !data) { setError('ユーザーが見つかりません'); setLoading(false); return }
      if (data.pin !== pin) { setError('PINコードが違います'); setLoading(false); return }
      localStorage.setItem('mirai_parent', parentName)
      router.push('/parent?user=' + encodeURIComponent(parentName))
      return
    }

    // ===== 生徒 =====
    // 入力パスワードを優先（個別設定）、従来どおり Mirai2026 も許可
    const email = `${selected}@mirai-juku.internal`

    const { error: signIn1 } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (!signIn1) {
      router.push('/student')
      return
    }

    const { error: signInLegacy } = await supabase.auth.signInWithPassword({
      email,
      password: STUDENT_PASSWORD,
    })
    if (!signInLegacy) {
      router.push('/student')
      return
    }

    let { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      const msg = (signUpError.message ?? '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered')) {
        setError('パスワードが違います')
        setLoading(false)
        return
      }
      signUpError = (
        await supabase.auth.signUp({
          email,
          password: STUDENT_PASSWORD,
        })
      ).error
    }

    if (signUpError) {
      setError('ログインできませんでした。パスワードかユーザー名を確認するか、管理者に連絡してください。')
      setLoading(false)
      return
    }

    const { error: retry1 } = await supabase.auth.signInWithPassword({ email, password })
    if (!retry1) {
      router.push('/student')
      return
    }

    const { error: retryLegacy } = await supabase.auth.signInWithPassword({
      email,
      password: STUDENT_PASSWORD,
    })

    if (retryLegacy) {
      setError('ログインに失敗しました。管理者に連絡してください。')
      setLoading(false)
      return
    }

    router.push('/student')
  }

  const TABS: { key: Role; label: string; icon: string }[] = [
    { key: 'student', label: '生徒',  icon: '🎒' },
    { key: 'parent',  label: '保護者', icon: '👨‍👩‍👧' },
    { key: 'admin',   label: '管理者', icon: '👨‍🏫' },
  ]

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

        <div className="bg-white rounded-2xl shadow-md overflow-hidden">

          {/* タブ */}
          <div className="flex border-b">
            {TABS.map(t => (
              <button key={t.key} type="button"
                onClick={() => { setRole(t.key); resetForm() }}
                className={"flex-1 py-3 text-sm font-bold transition " +
                  (role === t.key
                    ? 'bg-yellow-400 text-white border-b-2 border-yellow-500'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50')}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">

            {/* 生徒 */}
            {usersFetchError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2 text-sm">
                {usersFetchError}
              </div>
            )}

            {role === 'student' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">なまえを選んでください</label>
                {loadingUsers ? (
                  <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-400 text-sm">読み込み中...</div>
                ) : (
                  <select value={selected} onChange={e => setSelected(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white text-base">
                    {userRows.map(u => (
                      <option key={u.username} value={u.username}>
                        {u.nickname?.trim() || u.username}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 保護者 */}
            {role === 'parent' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">お子さんの名前</label>
                {loadingUsers ? (
                  <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-400 text-sm">読み込み中...</div>
                ) : (
                  <select value={parentName} onChange={e => setParentName(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-base">
                    {userRows.map(u => (
                      <option key={u.username} value={u.username}>
                        {u.nickname?.trim() || u.username}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* パスワード / PIN */}
            {role === 'parent' ? (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">PINコード（4桁）</label>
                <input type="password" value={pin} onChange={e => setPin(e.target.value)}
                  placeholder="0000" maxLength={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400 text-center text-2xl tracking-widest"
                  required />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">パスワード</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  required />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2 text-sm">
                ❌ {error}
              </div>
            )}

            <button type="submit" disabled={loading || loadingUsers}
              className={"w-full font-bold py-3 rounded-xl transition disabled:opacity-50 text-base text-white " +
                (role === 'admin' ? 'bg-gray-700 hover:bg-gray-800' :
                 role === 'parent' ? 'bg-green-500 hover:bg-green-600' :
                 'bg-yellow-400 hover:bg-yellow-500')}>
              {loading ? '確認中...' :
               role === 'admin' ? '👨‍🏫 管理者としてログイン' :
               role === 'parent' ? '👨‍👩‍👧 保護者として確認' :
               '🚀 ログイン'}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}