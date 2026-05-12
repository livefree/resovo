/**
 * dev/visual component-registry.ts — Playwright visual baseline 5 件下沉组件注册表
 * 真源：ADR-116 §2.4（CHG-SN-5-PRE-01-E-1 / SEQ-20260506-02 / M-SN-5.5 A 段）
 *
 * 5 件下沉组件 ~12 状态注册：
 *   - BarSignal × 5 状态（ok / partial / dead / pending / unknown）
 *   - StaffNoteBar × 2 变体（display / edit）
 *   - LineHealthDrawer × 1 状态（events 时间线）
 *   - RejectModal × 1 状态（标签单选 + 备注）
 *   - DecisionCard × 3 状态（approve / reject / pending）
 *
 * 不变约束（ADR-116 §2.3 OBS-2）：
 *   - 组件渲染必须**纯 props 驱动**，零服务端依赖（不调 server actions / API / DB）
 *   - 复杂 mock 数据放 _lib/mock-data.ts，registry 仅 import 引用
 *
 * URL 解析：/admin/dev/visual/<component-id>?state=<slug>
 */

import { createElement, type ReactNode } from 'react'
import {
  BarSignal,
  StaffNoteBar,
  LineHealthDrawer,
  RejectModal,
  DecisionCard,
} from '@resovo/admin-ui'
import {
  MOCK_HEALTH_EVENTS,
  MOCK_REJECT_LABELS,
  MOCK_DECISION_VIDEO_PENDING,
  MOCK_DECISION_VIDEO_APPROVED,
  MOCK_DECISION_VIDEO_REJECTED,
} from './mock-data'

export interface VisualComponentState {
  readonly slug: string
  readonly label: string
}

export interface VisualComponentEntry {
  readonly id: string
  readonly title: string
  readonly states: readonly VisualComponentState[]
  /** 渲染函数：根据 state slug 返回 JSX；未知 slug 返回默认（第一个） */
  readonly render: (stateSlug: string) => ReactNode
}

// 默认 noop async/sync handlers — visual baseline 不交互
const noop = () => undefined
const noopAsync = async () => undefined

// ── BarSignal ───────────────────────────────────────────────────────────────

const barSignalEntry: VisualComponentEntry = {
  id: 'bar-signal',
  title: 'BarSignal · 双信号柱图',
  states: [
    { slug: 'ok', label: 'OK（probe / render 均健康）' },
    { slug: 'partial', label: 'Partial（部分异常）' },
    { slug: 'dead', label: 'Dead（全部失效）' },
    { slug: 'pending', label: 'Pending（未检测）' },
    { slug: 'unknown', label: 'Unknown（占位）' },
  ],
  render: (slug) => {
    const map = {
      ok: { probeState: 'ok', renderState: 'ok' },
      partial: { probeState: 'partial', renderState: 'ok' },
      dead: { probeState: 'dead', renderState: 'dead' },
      pending: { probeState: 'pending', renderState: 'pending' },
      unknown: { probeState: 'unknown', renderState: 'unknown' },
    } as const
    const props = map[slug as keyof typeof map] ?? map.ok
    return createElement(BarSignal, { ...props, ariaLabel: `BarSignal-${slug}` })
  },
}

// ── StaffNoteBar ────────────────────────────────────────────────────────────

const staffNoteBarEntry: VisualComponentEntry = {
  id: 'staff-note-bar',
  title: 'StaffNoteBar · 内部备注',
  states: [
    { slug: 'display', label: 'Display（已有备注，预览态）' },
    { slug: 'edit', label: 'Edit（编辑态）' },
  ],
  render: (slug) =>
    createElement(StaffNoteBar, {
      note: '封面有水印，先 hold',
      editing: slug === 'edit',
      onEdit: noop,
      onSubmit: noopAsync,
      onCancelEdit: noop,
    }),
}

// ── LineHealthDrawer ────────────────────────────────────────────────────────

const lineHealthDrawerEntry: VisualComponentEntry = {
  id: 'line-health-drawer',
  title: 'LineHealthDrawer · 线路健康抽屉',
  states: [{ slug: 'default', label: 'Default（events 时间线 + 头部 BarSignal）' }],
  render: () =>
    createElement(LineHealthDrawer, {
      open: true,
      onClose: noop,
      title: '示例站点 · Line 1',
      probeState: 'partial',
      renderState: 'ok',
      events: MOCK_HEALTH_EVENTS,
    }),
}

// ── RejectModal ─────────────────────────────────────────────────────────────

const rejectModalEntry: VisualComponentEntry = {
  id: 'reject-modal',
  title: 'RejectModal · 拒绝弹窗',
  states: [{ slug: 'default', label: 'Default（标签单选 + 备注）' }],
  render: () =>
    createElement(RejectModal, {
      open: true,
      onClose: noop,
      labels: MOCK_REJECT_LABELS,
      onSubmit: noopAsync,
    }),
}

// ── DecisionCard ────────────────────────────────────────────────────────────

const decisionCardEntry: VisualComponentEntry = {
  id: 'decision-card',
  title: 'DecisionCard · 决策卡',
  states: [
    { slug: 'pending', label: 'Pending（待审，双信号 partial）' },
    { slug: 'approved', label: 'Approved（已通过，双信号 ok）' },
    { slug: 'rejected', label: 'Rejected（已拒绝，双信号 dead）' },
  ],
  render: (slug) => {
    if (slug === 'approved') {
      return createElement(DecisionCard, {
        video: MOCK_DECISION_VIDEO_APPROVED,
        probeState: 'ok',
        renderState: 'ok',
      })
    }
    if (slug === 'rejected') {
      return createElement(DecisionCard, {
        video: MOCK_DECISION_VIDEO_REJECTED,
        probeState: 'dead',
        renderState: 'dead',
      })
    }
    return createElement(DecisionCard, {
      video: MOCK_DECISION_VIDEO_PENDING,
      probeState: 'partial',
      renderState: 'ok',
    })
  },
}

// ── REGISTRY ────────────────────────────────────────────────────────────────

export const REGISTRY: readonly VisualComponentEntry[] = [
  barSignalEntry,
  staffNoteBarEntry,
  lineHealthDrawerEntry,
  rejectModalEntry,
  decisionCardEntry,
]

export function getEntry(componentId: string): VisualComponentEntry | undefined {
  return REGISTRY.find((entry) => entry.id === componentId)
}
