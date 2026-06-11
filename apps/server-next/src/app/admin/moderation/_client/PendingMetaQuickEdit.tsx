'use client'

/**
 * PendingMetaQuickEdit.tsx — 审核主界面 4 字段内联快编（MODUX-P3-4-B / item 9 前端）
 *
 * 审核台**局部**组件：类型 / 题材 / 年代 / 地区 免开面板即改，唯一写路径
 * `PATCH /admin/moderation/:id/meta`（P3-4-A 已补 country；pending-only 守卫）。
 *
 * 数据来源：
 *   - type / year / country 由 VideoQueueRow（v）种子（队列行已含）
 *   - genres VideoQueueRow 不含 → `getVideo(v.id)` lazy-fetch（复用既有详情 api，不越界改 types/DB）
 *
 * 交互：逐字段乐观更新 + 失败回滚 + toast；保存成功回调 onSaved（队列联动刷新）。
 */

import React, { useCallback, useEffect, useState } from 'react'
import { AdminSelect, useToast, getVideoTypeOptions, getVideoGenreOptions } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'
import { getVideo } from '@/lib/videos/api'
import { saveModerationMeta, type MetaEditPayload } from '@/lib/moderation/api'
import { M } from '@/i18n/messages/zh-CN/moderation'

const Q = M.quickEdit
const YEAR_MIN = 1900
const YEAR_MAX = 2100

export interface PendingMetaQuickEditProps {
  readonly v: VideoQueueRow
  /** 保存成功后队列联动刷新（复用 PendingCenter 既有 onSourceHealthChanged→refetchQueue）*/
  readonly onSaved?: () => void
}

const WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  marginBottom: 14,
  background: 'var(--bg-surface-raised)',
  borderRadius: 6,
}

const FIELD_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
}

const INPUT_STYLE: React.CSSProperties = {
  height: 24,
  padding: '0 6px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
}

export function PendingMetaQuickEdit({ v, onSaved }: PendingMetaQuickEditProps): React.ReactElement {
  const toast = useToast()
  const [year, setYear] = useState<string>(v.year != null ? String(v.year) : '')
  const [country, setCountry] = useState<string>(v.country ?? '')
  const [genres, setGenres] = useState<readonly string[]>([])
  const [genresLoading, setGenresLoading] = useState(true)

  const typeOptions = getVideoTypeOptions()
  const genreOptions = getVideoGenreOptions()

  // 切视频：input 字段从 v 重置；genres lazy-fetch（队列行无 genres）
  useEffect(() => {
    setYear(v.year != null ? String(v.year) : '')
    setCountry(v.country ?? '')
    let cancelled = false
    setGenresLoading(true)
    getVideo(v.id)
      .then((detail) => { if (!cancelled) setGenres(detail.genres) })
      .catch(() => { if (!cancelled) setGenres([]) })
      .finally(() => { if (!cancelled) setGenresLoading(false) })
    return () => { cancelled = true }
  }, [v.id, v.year, v.country])

  const commit = useCallback(
    async (patch: MetaEditPayload, revert: () => void): Promise<void> => {
      try {
        const res = await saveModerationMeta(v.id, patch)
        // commit 单字段 patch；仅当**该字段**在 skippedFields（被 provenance 锁未写入）时回滚乐观值，
        //   避免误回滚实际已保存的字段。
        const key = Object.keys(patch)[0]
        if (key && res.skippedFields.includes(key)) {
          revert()
          toast.push({ level: 'warn', title: Q.skipped(res.skippedFields.join(', ')) })
        } else {
          toast.push({ level: 'success', title: Q.saved })
        }
        // 始终刷新队列：后端为真源，反映任何已落库写入（含 VideoService.update 的 videos 表冗余副本，
        //   即便 catalog 字段被锁 skip），避免隐藏真实持久写入。
        onSaved?.()
      } catch {
        revert()
        toast.push({ level: 'danger', title: Q.saveFailed })
      }
    },
    [v.id, toast, onSaved],
  )

  const handleTypeChange = useCallback(
    (next: string | null): void => {
      if (!next || next === v.type) return
      void commit({ type: next }, () => { /* AdminSelect 受控于 v.type，失败自然回显 */ })
    },
    [v.type, commit],
  )

  const handleGenresChange = useCallback(
    (next: readonly string[]): void => {
      const prev = genres
      setGenres(next) // 乐观
      void commit({ genres: next }, () => setGenres(prev))
    },
    [genres, commit],
  )

  // year / country 在 blur（或 Enter）提交：与 v 基线比较，避免重复保存
  const commitYear = useCallback((): void => {
    const trimmed = year.trim()
    const baseline = v.year ?? null
    if (trimmed === '') {
      if (baseline !== null) void commit({ year: null }, () => setYear(v.year != null ? String(v.year) : ''))
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < YEAR_MIN || parsed > YEAR_MAX) {
      setYear(v.year != null ? String(v.year) : '') // 非法 → 回滚显示，不发请求
      return
    }
    if (parsed !== baseline) void commit({ year: parsed }, () => setYear(v.year != null ? String(v.year) : ''))
  }, [year, v.year, commit])

  const commitCountry = useCallback((): void => {
    const next = country.trim() || null
    const baseline = v.country ?? null
    if (next !== baseline) void commit({ country: next }, () => setCountry(v.country ?? ''))
  }, [country, v.country, commit])

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
  }

  return (
    <div style={WRAP_STYLE} data-testid="pending-meta-quick-edit">
      <span style={{ ...LABEL_STYLE, fontWeight: 600 }}>{Q.label}</span>

      <label style={FIELD_STYLE}>
        <span style={LABEL_STYLE}>{Q.type}</span>
        <AdminSelect
          options={typeOptions}
          value={v.type}
          onChange={handleTypeChange}
          size="sm"
          aria-label={Q.type}
          data-testid="quick-edit-type"
        />
      </label>

      <label style={FIELD_STYLE}>
        <span style={LABEL_STYLE}>{Q.year}</span>
        <input
          type="number"
          min={YEAR_MIN}
          max={YEAR_MAX}
          step={1}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          onBlur={commitYear}
          onKeyDown={onInputKeyDown}
          style={{ ...INPUT_STYLE, width: 76 }}
          aria-label={Q.year}
          data-testid="quick-edit-year"
        />
      </label>

      <label style={FIELD_STYLE}>
        <span style={LABEL_STYLE}>{Q.country}</span>
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          onBlur={commitCountry}
          onKeyDown={onInputKeyDown}
          placeholder={Q.countryPlaceholder}
          style={{ ...INPUT_STYLE, width: 96 }}
          aria-label={Q.country}
          data-testid="quick-edit-country"
        />
      </label>

      <label style={FIELD_STYLE}>
        <span style={LABEL_STYLE}>{Q.genres}</span>
        <AdminSelect
          multiple
          options={genreOptions}
          value={genres}
          onChange={handleGenresChange}
          size="sm"
          disabled={genresLoading}
          placeholder={genresLoading ? Q.genresLoading : Q.genres}
          aria-label={Q.genres}
          data-testid="quick-edit-genres"
        />
      </label>
    </div>
  )
}
