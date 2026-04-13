import type { Metadata } from 'next'
import { getSupabase } from '@/lib/supabase'
import type { VideoThemeRow } from '@/types/video-lab'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata: Metadata = {
  title: 'ネタストック（接続テスト） | 動画制作ラボ',
  description: 'video_themes 一覧 — Supabase 接続確認用',
}

/** ビルド時にスナップショット化せず、リクエストごとに Supabase から取得する */
export const dynamic = 'force-dynamic'

function formatTags(tags: unknown): string {
  if (tags == null) return '—'
  if (Array.isArray(tags)) return tags.join(', ')
  if (typeof tags === 'object') return JSON.stringify(tags)
  return String(tags)
}

export default async function VideoLabThemesTestPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const missingEnv = !url?.trim() || !key?.trim()

  let rows: VideoThemeRow[] = []
  let errorMessage: string | null = null

  if (!missingEnv) {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('video_themes')
      .select(
        'id, title, hook, category, idea_status, selected_idea, theme_keyword, source, tags',
      )
      .order('id', { ascending: false })

    if (error) {
      errorMessage = error.message
    } else {
      rows = (data ?? []) as VideoThemeRow[]
    }
  } else {
    errorMessage =
      'NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。'
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">動画制作ラボ — 接続テスト</CardTitle>
          <CardDescription>
            テーブル <code className="rounded bg-muted px-1.5 py-0.5">video_themes</code>{' '}
            から取得した一覧です（Step 1）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {missingEnv && (
            <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          {!missingEnv && errorMessage && (
            <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Supabase エラー: {errorMessage}
            </p>
          )}
          {!missingEnv && !errorMessage && rows.length === 0 && (
            <p className="text-muted-foreground text-sm">
              行がありません。テーブルが空か、RLS で anon
              が読めない可能性があります。
            </p>
          )}
          {rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">ステータス</TableHead>
                  <TableHead>タイトル</TableHead>
                  <TableHead className="hidden md:table-cell">フック</TableHead>
                  <TableHead className="hidden lg:table-cell">カテゴリ</TableHead>
                  <TableHead className="hidden xl:table-cell">キーワード</TableHead>
                  <TableHead className="hidden xl:table-cell">タグ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.idea_status ? (
                        <Badge variant="secondary">{row.idea_status}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] font-medium">
                      {row.title ?? '—'}
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate md:table-cell">
                      {row.hook ?? '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {row.category ?? '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {row.theme_keyword ?? '—'}
                    </TableCell>
                    <TableCell className="hidden max-w-[180px] truncate text-muted-foreground text-xs xl:table-cell">
                      {formatTags(row.tags)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!missingEnv && !errorMessage && (
            <p className="text-muted-foreground text-xs">
              {rows.length} 件を表示しました。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
