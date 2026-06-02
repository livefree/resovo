'use client'

/**
 * SourceColumns.tsx — 播放线路列定义（CHG-VSR-5-A 重构 / 设计 §3.2）
 *
 * 列集：视频 / 覆盖 / 探测(连接) / 试播 / 质量 / 问题 / 站点 / 最近检测 / 操作。
 * 派生列消费 CHG-VSR-3（activeSourceCount / connectFailCount / qualityHighest / latencyMedianMs / lastCheckedAt 等）。
 * **保留列 id `video/probeStatus/renderStatus/siteKey`** 不破坏 smoke e2e（CHG-VSR-7 正式回归）。
 * 术语：连接失败(probe dead) / 试播失败(render dead)（设计 §0.2 维度②）。
 */

import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import {
  Pill,
  type TableColumn,
  type DistinctOption,
} from '@resovo/admin-ui'
import type { VideoGroupRow } from '@/lib/sources/types'
import { SignalPill } from './SourceMatrixRow'

// 探测 / 试播 4 态静态 filterOptions（matrix popover 多选 enum / raw EXISTS ANY 语义）
const PROBE_STATUS_OPTIONS: readonly DistinctOption[] = [
  { value: 'ok',      label: 'OK' },
  { value: 'partial', label: '部分' },
  { value: 'dead',    label: '连接失败' },
  { value: 'pending', label: '待测' },
]
const RENDER_STATUS_OPTIONS: readonly DistinctOption[] = [
  { value: 'ok',      label: 'OK' },
  { value: 'partial', label: '部分' },
  { value: 'dead',    label: '试播失败' },
  { value: 'pending', label: '待测' },
]
// CHG-VSR-5-B：质量列「低质量」boolean 用单选 enum 表达（勾选 = lowQuality 过滤 / 最高源 < 720P）
const LOW_QUALITY_OPTIONS: readonly DistinctOption[] = [
  { value: 'low', label: '低质量（< 720P）' },
]

const MUTED_SM: CSSProperties = { fontSize: '11px', color: 'var(--fg-muted)' }

export function buildColumns(
  expandedKeys: ReadonlySet<string>,
): readonly TableColumn<VideoGroupRow>[] {
  return [
    // 视频（复合：展开 chevron + 封面 + 标题 + type · short_id）；sortable（v.title）
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
              <div style={{ ...MUTED_SM, marginTop: '1px' }}>
                {row.type} · {row.shortId}
              </div>
            </div>
          </div>
        )
      },
    },
    // 覆盖：线 / 源 / 可用（可用=is_active；0 染 danger）；sortable→activeSources
    {
      id: 'coverage',
      kind: 'computed',
      enableSorting: true,
      header: '覆盖',
      accessor: (r) => r.activeSourceCount ?? 0,
      width: 130,
      cell: ({ row }) => {
        const active = row.activeSourceCount ?? 0
        return (
          <span style={{ fontSize: '12px', color: 'var(--fg-default)' }}>
            <strong>{row.lineCount}</strong> 线 / <strong>{row.sourceCount}</strong> 源 /{' '}
            <strong style={{ color: active === 0 ? 'var(--state-error-fg)' : 'var(--fg-default)' }}>
              {active}
            </strong>{' '}
            <span style={MUTED_SM}>可用</span>
          </span>
        )
      },
    },
    // 探测（连接）：SignalPill 聚合 worst；filterable enum（raw EXISTS ANY）
    {
      id: 'probeStatus',
      kind: 'computed',
      header: '探测',
      accessor: (r) => r.probeStatus,
      width: 100,
      enableSorting: false, // §3.4：派生聚合，排序业务无意义
      filterable: true,
      filterFieldName: 'probeStatus',
      filterKind: 'enum',
      filterOptions: PROBE_STATUS_OPTIONS,
      cell: ({ row }) => <SignalPill status={row.probeStatus} />,
    },
    // 试播：SignalPill 聚合 worst；filterable enum
    {
      id: 'renderStatus',
      kind: 'computed',
      header: '试播',
      accessor: (r) => r.renderStatus,
      width: 100,
      enableSorting: false, // §3.4：派生聚合，排序业务无意义
      filterable: true,
      filterFieldName: 'renderStatus',
      filterKind: 'enum',
      filterOptions: RENDER_STATUS_OPTIONS,
      cell: ({ row }) => <SignalPill status={row.renderStatus} />,
    },
    // 质量：最高分辨率 + 已检测覆盖率 + 延迟中位；全空显「质量未知」；sortable→quality
    // CHG-VSR-5-B：低质量列筛选——DataTableAutoFilter 无 boolean 控件，用单选 enum 映射 lowQuality（与 KPI 低质量卡 OR 合流，后端 D-5 单谓词）
    {
      id: 'quality',
      kind: 'computed',
      enableSorting: true,
      header: '质量',
      accessor: (r) => r.qualityHighest ?? '',
      width: 140,
      filterable: true,
      filterFieldName: 'lowQuality',
      filterKind: 'enum',
      filterOptions: LOW_QUALITY_OPTIONS,
      cell: ({ row }) => {
        const tier = row.qualityHighest ?? null
        const coverage = row.qualityCoverage
        const latency = row.latencyMedianMs
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
            <span style={{
              fontSize: '12px',
              fontWeight: tier ? 600 : 400,
              color: tier ? 'var(--fg-default)' : 'var(--fg-muted)',
            }}>
              {tier ?? '质量未知'}
            </span>
            {(coverage != null || latency != null) && (
              <span style={MUTED_SM}>
                {coverage != null && `已检测 ${Math.round(coverage * 100)}%`}
                {coverage != null && latency != null && ' · '}
                {latency != null && `延迟中位 ${latency}ms`}
              </span>
            )}
          </div>
        )
      },
    },
    // 问题：多 badge（待补源 / 连接失败 / 试播失败 / 待探测 / 禁用）；各 0 不显示；由快捷筛选驱动（5-B）
    {
      id: 'issues',
      kind: 'computed',
      header: '问题',
      accessor: (r) => r.connectFailCount ?? 0,
      width: 160,
      enableSorting: false, // §3.4：多值聚合，排序业务无意义
      cell: ({ row }) => {
        const connectFail = row.connectFailCount ?? 0
        const renderFail = row.renderFailCount ?? 0
        const pendingProbe = row.pendingProbeCount ?? 0
        const disabled = row.disabledCount ?? 0
        const badges: ReactNode[] = []
        if (row.needsSource) {
          // §3.5.1：已上架且无可播源 = 线上事故(danger) / 未上架 = 草稿警示(warn)
          badges.push(
            <Pill key="needs" variant={row.isPublished ? 'danger' : 'warn'}>待补源</Pill>,
          )
        }
        if (connectFail > 0) badges.push(<Pill key="connect" variant="danger">连接失败 {connectFail}</Pill>)
        if (renderFail > 0) badges.push(<Pill key="render" variant="danger">试播失败 {renderFail}</Pill>)
        if (pendingProbe > 0) badges.push(<Pill key="pending" variant="neutral">待探测 {pendingProbe}</Pill>)
        if (disabled > 0) badges.push(<Pill key="disabled" variant="neutral">禁用 {disabled}</Pill>)
        if (badges.length === 0) {
          return <span style={MUTED_SM}>—</span>
        }
        return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{badges}</div>
      },
    },
    // 站点：siteKeys csv（升序去重 / STRING_AGG DISTINCT）；filterable distinct（sources.site_key）
    {
      id: 'siteKey',
      kind: 'data',
      header: '站点',
      accessor: (r) => r.siteKeys.join(','),
      width: 140,
      enableSorting: false,
      filterable: true,
      filterFieldName: 'site_key',
      filterKind: 'enum',
      filterDistinctTable: 'sources',
      cell: ({ row }) => {
        if (!row.siteKeys || row.siteKeys.length === 0) {
          return <span style={MUTED_SM}>—</span>
        }
        const text = row.siteKeys.join(', ')
        return (
          <span
            style={{
              ...MUTED_SM,
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
    // 最近检测：MAX(last_probed_at) 回退 MAX(updated_at)；sortable→lastChecked；filterable date-range
    {
      id: 'lastChecked',
      kind: 'data',
      header: '最近检测',
      accessor: (r) => r.lastCheckedAt ?? r.updatedAt,
      width: 100,
      enableSorting: true,
      filterable: true,
      filterFieldName: 'lastChecked',
      filterKind: 'date',
      cell: ({ row }) => {
        const ts = row.lastCheckedAt ?? row.updatedAt
        return (
          <span style={MUTED_SM}>
            {ts ? new Date(ts).toLocaleDateString('zh-CN') : '—'}
          </span>
        )
      },
    },
    // 操作：行级运维入口（占位 / 真实接通留 CHG-VSR-5-B + 6）
    {
      id: 'actions',
      kind: 'action',
      header: '操作',
      accessor: () => null,
      width: 120,
      overflowVisible: true,
      cell: () => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            title="重新探测"
            onClick={(e) => e.stopPropagation()}
            style={ACTION_BTN_STYLE}
          >↻</button>
          <button
            type="button"
            title="更多"
            onClick={(e) => e.stopPropagation()}
            style={ACTION_BTN_STYLE}
          >⋯</button>
        </div>
      ),
    },
  ]
}

const ACTION_BTN_STYLE: CSSProperties = {
  width: '24px', height: '24px',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: '12px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
