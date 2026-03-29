"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const [sets, setSets] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSets() {
      const { data, error } = await supabase
        .from("flashcard_sets")
        .select("*")
        .limit(5)
      if (error) setError(error.message)
      else setSets(data || [])
    }
    fetchSets()
  }, [])

  return (
    <main style={{ padding: 40 }}>
      <h1>Supabase接続テスト</h1>
      {error && <p style={{ color: "red" }}>エラー: {error}</p>}
      {sets.length === 0 && !error && <p>読み込み中...</p>}
      <ul>
        {sets.map((s) => (
          <li key={s.id}>{s.set_name}</li>
        ))}
      </ul>
    </main>
  )
}