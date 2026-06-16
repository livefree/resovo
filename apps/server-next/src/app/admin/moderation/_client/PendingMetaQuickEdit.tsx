'use client'

/**
 * PendingMetaQuickEdit.tsx — 审核主界面 4 字段内联快编（MODUX-P3-4-B / item 9 前端）
 *
 * 审核台**局部**组件：类型 / 题材 / 年代 / 地区 免开面板即改，唯一写路径
 * `PATCH /admin/moderation/:id/meta`（P3-4-A 已补 country；pending-only 守卫）。
 *
 * MODUX-ACPT-5（验收纠正）：去「快速编辑」标签；type / 题材 改 **inline 芯片一次点击**
 *   切换（去 AdminSelect 下拉，呼应「尽量避免点击下拉菜单再选择」）；年代 / 地区 保留 inline
 *   input（自由值，直接输入即一次交互）。
 *
 * 数据来源：
 *   - type / year / country 由 VideoQueueRow（v）种子（队列行已含）
 *   - genres VideoQueueRow 不含 → `getVideo(v.id)` lazy-fetch（复用既有详情 api，不越界改 types/DB）
 *
 * 交互：逐字段乐观更新 + 失败/被锁回滚 + toast；保存成功回调 onSaved（队列联动刷新）。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useToast, getVideoTypeOptions, getVideoGenreOptions } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'
import { getVideo } from '@/lib/videos/api'
import { saveModerationMeta, type MetaEditPayload } from '@/lib/moderation/api'
import { M } from '@/i18n/messages/zh-CN/moderation'

const Q = M.quickEdit
const YEAR_MIN = 1900
const YEAR_MAX = 2100

// MODUX-ACPT-5：年代/地区在 input 外另给快捷候选芯片（一次点击）
//   年代 = 近 6 年（含当年，动态）；地区 = 最常见区域（华语索引高频）。
//   地区用精简短名（不走 formatCountryName 的 Intl 官方全称，如 HK 会成「中国香港特别行政区」）。
const CURRENT_YEAR = new Date().getFullYear()
const RECENT_YEARS: readonly number[] = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)
const COMMON_REGIONS: readonly { readonly code: string; readonly label: string }[] = [
  { code: 'CN', label: '中国' },
  { code: 'HK', label: '香港' },
  { code: 'TW', label: '台湾' },
  { code: 'JP', label: '日本' },
  { code: 'KR', label: '韩国' },
  { code: 'US', label: '美国' },
  { code: 'GB', label: '英国' },
  { code: 'TH', label: '泰国' },
]

export interface PendingMetaQuickEditProps {
  readonly v: VideoQueueRow
  /** 保存成功后队列联动刷新（复用 PendingCenter 既有 onSourceHealthChanged→refetchQueue）*/
  readonly onSaved?: () => void
}

const WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '8px 10px',
  marginTop: 8,
  marginBottom: 14,
  background: 'var(--bg-surface-raised)',
  borderRadius: 6,
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
}

const CAPTION_STYLE: React.CSSProperties = {
  flexShrink: 0,
  width: 30,
  paddingTop: 3,
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
}

const CHIPS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  flex: 1,
  minWidth: 0,
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

function chipStyle(active: boolean, disabled = false): React.CSSProperties {
  return {
    padding: '2px 9px',
    borderRadius: 999,
    fontSize: 'var(--font-size-xxs)',
    lineHeight: 1.5,
    border: `1px solid ${active ? 'var(--accent-default)' : 'var(--border-default)'}`,
    background: active ? 'var(--admin-accent-soft)' : 'var(--bg-surface)',
    color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
    fontWeight: active ? 600 : 400,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    userSelect: 'none',
  }
}

export function PendingMetaQuickEdit({ v, onSaved }: PendingMetaQuickEditProps): React.ReactElement {
  const toast = useToast()
  const [year, setYear] = useState<string>(v.year != null ? String(v.year) : '')
  const [country, setCountry] = useState<string>(v.country ?? '')
  const [genres, setGenres] = useState<readonly string[]>([])
  const [genresLoading, setGenresLoading] = useState(true)
  // ADR-206 D-206-9（3B-3）：原名 / 别名（VideoQueueRow 无 → lazy-fetch detail 回填；baseRef 存基线避重复提交）
  const [titleOriginal, setTitleOriginal] = useState<string>('')
  const [aliasesStr, setAliasesStr] = useState<string>('')
  const baseRef = useRef<{ titleOriginal: string; aliases: string }>({ titleOriginal: '', aliases: '' })

  const typeOptions = getVideoTypeOptions()
  const genreOptions = getVideoGenreOptions()

  // 切视频：input 字段从 v 重置；genres lazy-fetch（队列行无 genres）
  useEffect(() => {
    setYear(v.year != null ? String(v.year) : '')
    setCountry(v.country ?? '')
    // META-50-3B-3 FIX（Codex stop-time review）：原名/别名无 props 种子（靠 getVideo lazy-fetch），
    // 须在切视频时**同步**清空 state + baseRef——否则 getVideo(新视频) pending 窗口残留旧视频值，
    // 期间 blur 会用 stale 值 commit 到新视频（把上一视频的原名/别名误写入新视频）。
    setTitleOriginal('')
    setAliasesStr('')
    baseRef.current = { titleOriginal: '', aliases: '' }
    let cancelled = false
    setGenresLoading(true)
    getVideo(v.id)
      .then((detail) => {
        if (cancelled) return
        setGenres(detail.genres)
        // ADR-206 D-206-9（3B-3）：回填结构化 manual aka（3B-1 注入）+ 原名，存基线
        const to = detail.title_original ?? ''
        const al = (detail.aliases ?? []).join(', ')
        setTitleOriginal(to)
        setAliasesStr(al)
        baseRef.current = { titleOriginal: to, aliases: al }
      })
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

  // type：单选芯片，一次点击即提交（受控于 v.type，失败自然回显 → revert no-op）
  const handleTypePick = useCallback(
    (next: string): void => {
      if (next === v.type) return
      void commit({ type: next }, () => { /* 受控于 v.type，失败自然回显 */ })
    },
    [v.type, commit],
  )

  // genres：多选 toggle 芯片，一次点击切换 + 乐观提交，失败回滚到 prev
  const toggleGenre = useCallback(
    (g: string): void => {
      const prev = genres
      const next = prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
      setGenres(next)
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

  // 候选芯片：一次点击设值 + 提交（与 input 共用同一 state / 写路径）
  const pickYear = useCallback((y: number): void => {
    setYear(String(y))
    if (y !== (v.year ?? null)) void commit({ year: y }, () => setYear(v.year != null ? String(v.year) : ''))
  }, [v.year, commit])

  const pickCountry = useCallback((code: string): void => {
    setCountry(code)
    if (code !== (v.country ?? null)) void commit({ country: code }, () => setCountry(v.country ?? ''))
  }, [v.country, commit])

  // ADR-206 D-206-9（3B-3）：原名 / 别名 blur 提交（基线来自 lazy-fetch detail，存 baseRef 避重复提交）。
  // 别名替换语义（splitComma → 完整 manual aka 集，对齐 3A replaceManualAkaAliases）。
  const commitTitleOriginal = useCallback((): void => {
    const next = titleOriginal.trim()
    const base = baseRef.current.titleOriginal.trim()
    if (next === base) return
    baseRef.current.titleOriginal = next
    void commit({ titleOriginal: next || null }, () => {
      baseRef.current.titleOriginal = base
      setTitleOriginal(base)
    })
  }, [titleOriginal, commit])

  const commitAliases = useCallback((): void => {
    if (aliasesStr === baseRef.current.aliases) return
    const base = baseRef.current.aliases
    const arr = aliasesStr.split(',').map((x) => x.trim()).filter(Boolean)
    baseRef.current.aliases = aliasesStr
    void commit({ aliases: arr }, () => {
      baseRef.current.aliases = base
      setAliasesStr(base)
    })
  }, [aliasesStr, commit])

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
  }

  return (
    <div style={WRAP_STYLE} data-testid="pending-meta-quick-edit">
      {/* 类型：单选芯片（一次点击切换，去下拉）*/}
      <div style={ROW_STYLE}>
        <span style={CAPTION_STYLE}>{Q.type}</span>
        <div style={CHIPS_STYLE} role="group" aria-label={Q.type} data-testid="quick-edit-type">
          {typeOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              style={chipStyle(v.type === o.value)}
              aria-pressed={v.type === o.value}
              onClick={() => handleTypePick(o.value)}
              data-testid={`quick-edit-type-${o.value}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* 年代：input + 近几年候选芯片（一次点击）*/}
      <div style={{ ...ROW_STYLE, alignItems: 'center' }}>
        <span style={{ ...CAPTION_STYLE, paddingTop: 0 }}>{Q.year}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
          {RECENT_YEARS.map((y) => (
            <button
              key={y}
              type="button"
              // preventDefault：阻止 input 失焦 → 不触发 onBlur 用 stale 输入值抢先提交（与芯片提交竞态）
              onMouseDown={(e) => e.preventDefault()}
              style={chipStyle(year === String(y))}
              aria-pressed={year === String(y)}
              onClick={() => pickYear(y)}
              data-testid={`quick-edit-year-${y}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* 地区：input + 常见区域候选芯片（一次点击）*/}
      <div style={{ ...ROW_STYLE, alignItems: 'center' }}>
        <span style={{ ...CAPTION_STYLE, paddingTop: 0 }}>{Q.country}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
          {COMMON_REGIONS.map((r) => (
            <button
              key={r.code}
              type="button"
              // preventDefault：阻止 input 失焦 → 不触发 onBlur 用 stale 输入值抢先提交（与芯片提交竞态）
              onMouseDown={(e) => e.preventDefault()}
              style={chipStyle(country === r.code)}
              aria-pressed={country === r.code}
              onClick={() => pickCountry(r.code)}
              data-testid={`quick-edit-country-${r.code}`}
              title={r.code}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 题材：多选 toggle 芯片（一次点击切换，去下拉）*/}
      <div style={ROW_STYLE}>
        <span style={CAPTION_STYLE}>{Q.genres}</span>
        <div style={CHIPS_STYLE} role="group" aria-label={Q.genres} data-testid="quick-edit-genres">
          {genreOptions.map((o) => {
            const on = genres.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                style={chipStyle(on, genresLoading)}
                aria-pressed={on}
                disabled={genresLoading}
                onClick={() => toggleGenre(o.value)}
                data-testid={`quick-edit-genre-${o.value}`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 原名：input（blur 提交，无候选芯片）*/}
      <div style={{ ...ROW_STYLE, alignItems: 'center' }}>
        <span style={{ ...CAPTION_STYLE, paddingTop: 0 }}>{Q.titleOriginal}</span>
        <input
          type="text"
          value={titleOriginal}
          onChange={(e) => setTitleOriginal(e.target.value)}
          onBlur={commitTitleOriginal}
          onKeyDown={onInputKeyDown}
          maxLength={200}
          style={{ ...INPUT_STYLE, flex: 1, minWidth: 160 }}
          aria-label={Q.titleOriginal}
          data-testid="quick-edit-title-original"
        />
      </div>

      {/* 别名：input（aka 逗号分隔，blur 提交，替换语义）*/}
      <div style={{ ...ROW_STYLE, alignItems: 'center' }}>
        <span style={{ ...CAPTION_STYLE, paddingTop: 0 }}>{Q.aliases}</span>
        <input
          type="text"
          value={aliasesStr}
          onChange={(e) => setAliasesStr(e.target.value)}
          onBlur={commitAliases}
          onKeyDown={onInputKeyDown}
          placeholder={Q.aliasesPlaceholder}
          style={{ ...INPUT_STYLE, flex: 1, minWidth: 160 }}
          aria-label={Q.aliases}
          data-testid="quick-edit-aliases"
        />
      </div>
    </div>
  )
}
