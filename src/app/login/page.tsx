'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const email = username.toLowerCase() + '@mirai-juku.internal'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('ユーザー名またはパスワードが違います')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f4ff' }}>
      <div style={{ width: 340, padding: 40, background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <h1 style={{ marginBottom: 8, fontSize: 22, textAlign: 'center' }}>🌟 未来塾</h1>
        <p style={{ marginBottom: 24, color: '#888', textAlign: 'center', fontSize: 14 }}>なまえとパスワードでログイン</p>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 'bold' }}>なまえ</label>
            <input type='text' placeholder='なまえをいれてね' value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 16, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 'bold' }}>パスワード</label>
            <input type='password' placeholder='パスワードをいれてね' value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 16, boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: '#e53e3e', marginBottom: 16, fontSize: 14, textAlign: 'center' }}>{error}</p>}
          <button type='submit' disabled={loading} style={{ width: '100%', padding: '12px 0', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 6, fontSize: 16, cursor: 'pointer', fontWeight: 'bold' }}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </main>
  )
}