'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setLoading(false)
      }
    }
    checkUser()
  }, [router])

  if (loading) return <p style={{ padding: 40 }}>読み込み中...</p>

  return (
    <main style={{ padding: 40 }}>
      <h1>🌟 未来塾 ホーム</h1>
      <p>ログイン成功！</p>
      <button
        onClick={async () => {
          await supabase.auth.signOut()
          router.push('/login')
        }}
        style={{ marginTop: 16, padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        ログアウト
      </button>
    </main>
  )
}

