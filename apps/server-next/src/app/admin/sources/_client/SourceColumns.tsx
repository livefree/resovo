'use client'

/**
 * SourceColumns.tsx — 播放线路列定义（CHG-VSR-PRE-1 从 SourcesClient 抽出，零行为变化）
 *
 * HOTFIX-PATCH-2A/2B 列 kind 规则 + probeStatus/renderStatus 静态 enum filter + siteKey distinct。
 */

import Image from 'next/image'
import {
  type TableColumn,
  type DistinctOption,
} from '@resovo/admin-ui'
import type { VideoGroupRow } from '@/lib/sources/types'
import { SignalPill } from './SourceMatrixRow'

// HOTFIX-PATCH-2A §2-EXT-1/2（2026-05-25）：probeStatus / renderStatus 4 态静态 filterOptions（matrix popover 多选 enum）
const PROBE_STATUS_OPTIONS: readonly DistinctOption[] = [
  { value: 'ok',      label: 'OK' },
  { value: 'partial', label: '部分' },
  { value: 'dead',    label: '失效' },
  { value: 'pending', label: '待测' },
]
const RENDER_STATUS_OPTIONS: readonly DistinctOption[] = [
  { value: 'ok',      label: 'OK' },
  { value: 'partial', label: '部分' },
  { value: 'dead',    label: '失效' },
  { value: 'pending', label: '待测' },
]

// HOTFIX-PATCH-2A（2026-05-25）：列 kind 规则（EP-3-E 漏改 actions + updatedAt 修订）
//   - 5 列 video/lineCount/sourceCount/probeStatus/renderStatus → kind='computed'
//   - probeStatus/renderStatus 加 filterable + filterOptions（4 态 enum / raw EXISTS ANY 语义）
//   - updatedAt → kind='data' + filterable + filterKind='date'（HAVING MAX 范围）
//   - actions → kind='action' opt-out（matrix popover 整行跳过）
export function buildColumns(
  expandedKeys: ReadonlySet<string>,
): readonly TableColumn<VideoGroupRow>[] {
  return [
    // ADR-150 阶段 5 EP-4（2026-05-24）：sources sort 全栈打通
    //   - 3 列 video / lineCount / sourceCount 改回 enableSorting: true（后端 SORT_FIELDS 已扩展）
    //   - 保留 kind: 'computed' filter 禁用（业务无意义 / Sources 已有 keyword + Segment）
    //   - probeStatus / renderStatus 2 列 sort 业务无意义（STRING_AGG 派生 / 保留 kind='computed' default false）
    {
      id: 'video',
      kind: 'computed',
      enableSorting: true,
      header: '视频',
      accessor: (r) => r.title,
      minWidth: 200,
      cell: ({ row }) => {
        const isExpanded = expandedKeys.has(row.videoId)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '14px',
              color: 'var(--fg-muted)',
              transform: isExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
              flexShrink: 0,
              userSelect: 'none',
            }}>›</span>
            {row.coverUrl && (
              <Image
                src={row.coverUrl}
                alt=""
                width={32}
                height={44}
                sizes="32px"
                style={{ objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--fg-default)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {row.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '1px' }}>
                {row.type} · {row.year ?? '—'}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'lineCount',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 sort 全栈打通后恢复（line_count SELECT alias）
      header: '线路',
      accessor: (r) => r.lineCount,
      width: 80,
      cell: ({ row }) => (
        <span>
          <strong>{row.lineCount}</strong>{' '}
          <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>条</span>
        </span>
      ),
    },
    {
      id: 'sourceCount',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 sort 全栈打通后恢复（source_count SELECT alias）
      header: '集·源',
      accessor: (r) => r.sourceCount,
      width: 90,
      cell: ({ row }) => (
        <span>
          <strong>{row.sourceCount}</strong>{' '}
          <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>个</span>
        </span>
      ),
    },
    {
      id: 'probeStatus',
      kind: 'computed',
      header: '探测',
      accessor: (r) => r.probeStatus,
      width: 100,
      // HOTFIX-PATCH-2A §2-EXT-1：静态 4 态 enum filter / raw EXISTS ANY 语义
      filterable: true,
      filterFieldName: 'probeStatus',
      filterKind: 'enum',
      filterOptions: PROBE_STATUS_OPTIONS,
      cell: ({ row }) => <SignalPill status={row.probeStatus} />,
    },
    {
      id: 'renderStatus',
      kind: 'computed',
      header: '播放',
      accessor: (r) => r.renderStatus,
      width: 100,
      // HOTFIX-PATCH-2A §2-EXT-2：静态 4 态 enum filter / raw EXISTS ANY 语义
      filterable: true,
      filterFieldName: 'renderStatus',
      filterKind: 'enum',
      filterOptions: RENDER_STATUS_OPTIONS,
      cell: ({ row }) => <SignalPill status={row.renderStatus} />,
    },
    {
      id: 'updatedAt',
      // HOTFIX-PATCH-2A §1-BUG-3：updatedAt 真生效（kind=data + filterable + 后端 zod + HAVING）
      kind: 'data',
      header: '更新',
      accessor: (r) => r.updatedAt,
      width: 80,
      enableSorting: true,
      filterable: true,
      filterFieldName: 'updatedAt',
      filterKind: 'date',
      cell: ({ row }) => (
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('zh-CN') : '—'}
        </span>
      ),
    },
    {
      // HOTFIX-PATCH-2B（2026-05-25）+ FIX1（2026-05-25 走读后）：siteKey 可见列 / cell 显行跨站点 csv
      // - filter 入口：matrix popover「站点」行 + 列内 ⋯ DataTableAutoFilter（走 distinct 端点）
      // - filterFieldName='site_key' 与 distinct-whitelist sources 表白名单 col 名一致
      // - cell 显 row.siteKeys csv（升序去重 / 后端 STRING_AGG DISTINCT 派生 / title 完整列表 hover）
      id: 'siteKey',
      kind: 'data',
      header: '站点',
      accessor: (r) => r.siteKeys.join(','),
      width: 140,
      enableSorting: false, // 多值列 sort 业务无意义（多个 site 一行）
      filterable: true,
      filterFieldName: 'site_key',
      filterKind: 'enum',
      filterDistinctTable: 'sources',
      cell: ({ row }) => {
        if (!row.siteKeys || row.siteKeys.length === 0) {
          return <span style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>—</span>
        }
        const text = row.siteKeys.join(', ')
        return (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--fg-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              maxWidth: '120px',
            }}
            title={text}
          >
            {text}
          </span>
        )
      },
    },
    {
      id: 'actions',
      // HOTFIX-PATCH-2A §1-BUG-2：actions kind='action' opt-out（EP-3-E 漏改回填）
      kind: 'action',
      header: '操作',
      accessor: () => null,
      width: 100,
      overflowVisible: true,
      cell: () => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            title="重验"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >↻</button>
          <button
            type="button"
            title="快速操作"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >⚡</button>
          <button
            type="button"
            title="更多"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >⋯</button>
        </div>
      ),
    },
  ]
}
