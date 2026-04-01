'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TangoRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/flash')
  }, [router])

  return (
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-7xl mb-4 animate-bounce">🃏</div>
        <p className="text-yellow-700 font-black text-xl">たんごアプリへ移動中…</p>
      </div>
    </div>
  )
}
