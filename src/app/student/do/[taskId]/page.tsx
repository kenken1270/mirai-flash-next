import { redirect } from 'next/navigation'

type Props = { params: Promise<{ taskId: string }> }

/** 旧URL互換: 学習は `/student/study` に統一 */
export default async function DoPageRedirect({ params }: Props) {
  const { taskId } = await params
  redirect(`/student/study?taskId=${encodeURIComponent(taskId)}`)
}
