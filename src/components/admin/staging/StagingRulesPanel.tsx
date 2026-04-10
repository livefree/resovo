/**
 * StagingRulesPanel.tsx — 自动发布规则配置折叠面板
 * ADMIN-09: 展示/编辑 auto-publish-staging 规则，保存后生效
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface StagingRules {
  minMetaScore: number
  requireDoubanMatched: boolean
  requireCoverUrl: boolean
  minActiveSourceCount: number
}

interface StagingRulesPanelProps {
  initialRules: StagingRules
  /** 当前用户是否为 admin（非 admin 只读） */
  isAdmin: boolean
  /** 规则保存成功后回调（刷新列表就绪状态） */
  onSaved?: (rules: StagingRules) => void
}

export function StagingRulesPanel({ initialRules, isAdmin, onSaved }: StagingRulesPanelProps) {
  const [open, setOpen] = useState(false)
  const [rules, setRules] = useState<StagingRules>(initialRules)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      await apiClient.put('/admin/staging/rules', rules)
      setSaved(true)
      onSaved?.(rules)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--bg2)]" data-testid="staging-rules-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg3)] rounded-lg transition-colors"
        data-testid="staging-rules-toggle"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>⚙</span>
          自动发布规则配置
        </span>
        <span aria-hidden className="text-[var(--muted)] text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 py-4 space-y-4">
          {!isAdmin && (
            <p className="text-xs text-[var(--muted)]" data-testid="rules-readonly-hint">
              当前角色无权修改规则（仅管理员可编辑）
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* 最低元数据评分 */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted)]">最低元数据评分（0-100）</span>
              <input
                type="number"
                min={0}
                max={100}
                value={rules.minMetaScore}
                onChange={(e) => setRules((r) => ({ ...r, minMetaScore: Number(e.target.value) }))}
                disabled={!isAdmin}
                className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="rules-min-meta-score"
              />
            </label>

            {/* 最少活跃源 */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted)]">最少活跃源数量</span>
              <input
                type="number"
                min={0}
                max={10}
                value={rules.minActiveSourceCount}
                onChange={(e) => setRules((r) => ({ ...r, minActiveSourceCount: Number(e.target.value) }))}
                disabled={!isAdmin}
                className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="rules-min-source-count"
              />
            </label>

            {/* 要求封面 */}
            <label className={`flex items-center gap-2 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <input
                type="checkbox"
                checked={rules.requireCoverUrl}
                onChange={(e) => setRules((r) => ({ ...r, requireCoverUrl: e.target.checked }))}
                disabled={!isAdmin}
                className="accent-[var(--accent)] disabled:opacity-50"
                data-testid="rules-require-cover"
              />
              <span className="text-sm text-[var(--text)]">要求封面图</span>
            </label>

            {/* 要求豆瓣匹配 */}
            <label className={`flex items-center gap-2 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <input
                type="checkbox"
                checked={rules.requireDoubanMatched}
                onChange={(e) => setRules((r) => ({ ...r, requireDoubanMatched: e.target.checked }))}
                disabled={!isAdmin}
                className="accent-[var(--accent)] disabled:opacity-50"
                data-testid="rules-require-douban"
              />
              <span className="text-sm text-[var(--text)]">要求豆瓣匹配</span>
            </label>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50"
                data-testid="rules-save-btn"
              >
                {saving ? '保存中…' : '保存规则'}
              </button>
              {saved && (
                <span className="text-xs text-green-400" data-testid="rules-saved-hint">已保存</span>
              )}
              {saveError && (
                <span className="text-xs text-red-400" data-testid="rules-save-error">{saveError}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
