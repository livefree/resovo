'use client'

/**
 * CrawlerSiteRowActions.tsx — 站点行 {more} dropdown（REDO-01-D）
 *
 * 真源：M-SN-7-redo-01-contract.md §1.4 + §2.2 裁决 A
 *
 * 6 项菜单：edit / toggle / copy_key / mark_adult / mark_shortdrama / delete
 * - mark_adult / mark_shortdrama 动态 label（成人 ↔ 取消成人 / 短剧 ↔ 标记 vod）
 * - delete：site.fromConfig=true 时 disabled（config 来源不可删）
 *
 * 仿 VideoRowActions（apps/server-next/src/app/admin/videos/_client/VideoRowActions.tsx）模式。
 */

import { useCallback, useState, type CSSProperties } from 'react'
import { AdminDropdown, type AdminDropdownItem } from '@resovo/admin-ui'
import type { CrawlerSite } from '@/lib/crawler/api'

export interface CrawlerSiteRowActionsProps {
  readonly site: CrawlerSite
  readonly onEdit: (site: CrawlerSite) => void
  readonly onToggleDisable: (site: CrawlerSite) => void
  readonly onCopyKey: (key: string) => void
  readonly onMarkAdult: (site: CrawlerSite) => void
  readonly onMarkShortdrama: (site: CrawlerSite) => void
  readonly onDelete: (site: CrawlerSite) => void
}

const TRIGGER_STYLE: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-base)',
  lineHeight: 1,
}

export function CrawlerSiteRowActions({
  site,
  onEdit,
  onToggleDisable,
  onCopyKey,
  onMarkAdult,
  onMarkShortdrama,
  onDelete,
}: CrawlerSiteRowActionsProps) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  const items: readonly AdminDropdownItem[] = [
    {
      key: 'edit',
      label: '编辑站点',
      onClick: () => {
        close()
        onEdit(site)
      },
    },
    {
      key: 'toggle',
      label: site.disabled ? '启用' : '禁用',
      onClick: () => {
        close()
        onToggleDisable(site)
      },
    },
    {
      key: 'copy_key',
      label: '复制 key',
      onClick: () => {
        close()
        onCopyKey(site.key)
      },
    },
    {
      key: 'mark_adult',
      label: site.isAdult ? '取消标记成人' : '标记成人',
      onClick: () => {
        close()
        onMarkAdult(site)
      },
    },
    {
      key: 'mark_shortdrama',
      label: site.sourceType === 'shortdrama' ? '标记 vod' : '标记短剧',
      onClick: () => {
        close()
        onMarkShortdrama(site)
      },
    },
    {
      key: 'delete',
      label: site.fromConfig ? '删除（config 来源不可删）' : '删除站点',
      danger: true,
      disabled: site.fromConfig,
      separator: true,
      onClick: () => {
        close()
        onDelete(site)
      },
    },
  ]

  return (
    <AdminDropdown
      open={open}
      trigger={
        <button
          type="button"
          aria-label={`${site.name} 行操作`}
          style={TRIGGER_STYLE}
          onClick={() => setOpen((o) => !o)}
          data-testid={`crawler-row-actions-trigger-${site.key}`}
        >
          ⋯
        </button>
      }
      items={items}
      onOpenChange={setOpen}
      align="right"
      data-testid={`crawler-row-actions-dropdown-${site.key}`}
    />
  )
}
