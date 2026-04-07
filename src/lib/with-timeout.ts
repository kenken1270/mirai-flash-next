/** Promise が返ってこないときに UI が固まらないよう上限を付ける */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label = 'request'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} が ${ms}ms を超えました`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
