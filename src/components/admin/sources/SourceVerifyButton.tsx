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

export function SourceVerifyButton({ sourceId, onVerified }: SourceVerifyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)

  async function handleVerify() {
    setLoading(true)
    setResult(null)
    try {
      const res = await apiClient.post<{ data: VerifyResult }>(
        `/admin/sources/${sourceId}/verify`
      )
      setResult(res.data)
      onVerified?.(res.data)
    } catch {
      setResult({ isActive: false, responseMs: 0, statusCode: null })
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
