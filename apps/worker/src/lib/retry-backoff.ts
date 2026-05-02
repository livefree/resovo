import { config } from '../config'

export async function withRetry<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, err: unknown) => void,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < config.retry.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < config.retry.maxAttempts - 1) {
        onRetry?.(attempt + 1, err)
        await sleep(config.retry.backoffMs[attempt] ?? 16_000)
      }
    }
  }
  throw lastErr
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
