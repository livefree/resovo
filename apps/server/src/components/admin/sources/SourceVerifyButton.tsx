/**
 * SourceVerifyButton.tsx — 单条源验证按钮 + 行内结果展示
 * CHG-28: 点击触发同步验证，显示响应时间或超时
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface VerifyResult {
  isActive: boolean
  responseMs: number
  statusCode: number | null
}

interface SourceVerifyButtonProps {
  sourceId: string
  onVerified?: (result: VerifyResult) => void
}

function isVerifyResult(value: unknown): value is VerifyResult {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.isActive === 'boolean' &&
    typeof payload.responseMs === 'number' &&
    (typeof payload.statusCode === 'number' || payload.statusCode === null)
  )
}

export function SourceVerifyButton({ sourceId, onVerified }: SourceVerifyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  async function handleVerify() {
    setLoading(true)
    setResult(null)
    setErrorText(null)
    try {
      const res = await apiClient.post<{ data: unknown }>(
        `/admin/sources/${sourceId}/verify`,
        {}
      )
      if (!isVerifyResult(res.data)) {
        setErrorText('✗ 返回异常')
        return
      }
      setResult(res.data)
      onVerified?.(res.data)
    } catch {
      setErrorText('✗ 验证失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid={`source-verify-${sourceId}`}>
      <button
        onClick={handleVerify}
        disabled={loading}
        className="rounded px-2 py-0.5 text-xs bg-[var(--bg3)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
        data-testid={`source-verify-btn-${sourceId}`}
      >
        {loading ? '验证中…' : '验证'}
      </button>

      {errorText && !loading && (
        <span
          className="text-xs text-red-400"
          data-testid={`source-verify-result-${sourceId}`}
        >
          {errorText}
        </span>
      )}

      {result && !loading && (
        <span
          className={`text-xs ${result.isActive ? 'text-green-400' : 'text-red-400'}`}
          data-testid={`source-verify-result-${sourceId}`}
        >
          {result.isActive
            ? `✓ ${result.responseMs}ms`
            : result.statusCode
              ? `✗ ${result.statusCode}`
              : '✗ 超时'}
        </span>
      )}
    </span>
  )
}
