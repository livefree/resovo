export function validateJsonText(raw: string): { ok: boolean; error: string | null } {
  if (!raw.trim()) {
    return { ok: true, error: null }
  }

  try {
    JSON.parse(raw)
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'JSON 格式错误',
    }
  }
}

export function parseJsonToPrettyText(raw: string): string {
  const parsed = JSON.parse(raw) as unknown
  return JSON.stringify(parsed, null, 2)
}

export function normalizeSubscriptionUrl(raw: string): {
  ok: boolean
  value?: string
  shouldClear?: boolean
  error?: string
} {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return {
      ok: true,
      shouldClear: raw.length > 0,
    }
  }

  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol')
    }
    return {
      ok: true,
      value: trimmed,
      shouldClear: false,
    }
  } catch {
    return {
      ok: false,
      error: '订阅 URL 格式错误（可先清空后仅保存 JSON）',
    }
  }
}
