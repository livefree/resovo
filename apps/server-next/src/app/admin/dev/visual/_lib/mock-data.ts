/**
 * dev/visual mock-data.ts — Playwright visual baseline 5 件组件的 mock 数据
 * 真源：ADR-116 §2.4（CHG-SN-5-PRE-01-E-1 / SEQ-20260506-02 / M-SN-5.5 A 段）
 *
 * 复杂 mock（SourceHealthEvent[] / ReviewLabel[] / DecisionCardVideo）独立持久化，
 * component-registry 仅 import 引用。
 *
 * 约束：
 *   - 纯静态数据，零服务端依赖（与 ADR-116 §2.3 OBS-2 强约束对齐）
 *   - 字段命名严格对齐 packages/types 接口（避免漂移）
 */

import type { SourceHealthEvent, ReviewLabel } from '@resovo/types'
import type { DecisionCardVideo } from '@resovo/admin-ui'

// ── SourceHealthEvent[] (LineHealthDrawer 消费) ─────────────────────────────

export const MOCK_HEALTH_EVENTS: readonly SourceHealthEvent[] = [
  {
    id: 'evt-1',
    videoId: 'vid-1',
    sourceId: 'src-1',
    origin: 'scheduled_probe',
    oldStatus: 'ok',
    newStatus: 'partial',
    triggeredBy: null,
    errorDetail: '间歇 5xx',
    httpCode: 502,
    latencyMs: 1820,
    createdAt: '2026-05-12T08:30:00.000Z',
  },
  {
    id: 'evt-2',
    videoId: 'vid-1',
    sourceId: 'src-1',
    origin: 'render_check',
    oldStatus: 'partial',
    newStatus: 'ok',
    triggeredBy: null,
    errorDetail: null,
    httpCode: 200,
    latencyMs: 420,
    createdAt: '2026-05-12T08:15:00.000Z',
  },
  {
    id: 'evt-3',
    videoId: 'vid-1',
    sourceId: 'src-1',
    origin: 'feedback_driven',
    oldStatus: 'ok',
    newStatus: 'ok',
    triggeredBy: 'user-feedback',
    errorDetail: null,
    httpCode: null,
    latencyMs: null,
    createdAt: '2026-05-12T07:50:00.000Z',
  },
  {
    id: 'evt-4',
    videoId: 'vid-1',
    sourceId: 'src-1',
    origin: 'circuit_breaker',
    oldStatus: 'ok',
    newStatus: 'partial',
    triggeredBy: null,
    errorDetail: '连续超时触发熔断',
    httpCode: null,
    latencyMs: null,
    createdAt: '2026-05-12T07:20:00.000Z',
  },
]

// ── ReviewLabel[] (RejectModal 消费) ────────────────────────────────────────

export const MOCK_REJECT_LABELS: readonly ReviewLabel[] = [
  {
    id: 'lbl-1',
    labelKey: 'duplicate',
    label: '重复上传',
    appliesTo: 'reject',
    displayOrder: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'lbl-2',
    labelKey: 'all_lines_dead',
    label: '全线路失效',
    appliesTo: 'reject',
    displayOrder: 2,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'lbl-3',
    labelKey: 'low_quality',
    label: '画质过低',
    appliesTo: 'reject',
    displayOrder: 3,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'lbl-4',
    labelKey: 'metadata_invalid',
    label: '元数据缺失/错误',
    appliesTo: 'reject',
    displayOrder: 4,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

// ── DecisionCardVideo 三态 (DecisionCard 消费) ──────────────────────────────

export const MOCK_DECISION_VIDEO_PENDING: DecisionCardVideo = {
  id: 'vid-pending',
  title: '危险关系',
  reviewStatus: 'pending_review',
  visibilityStatus: 'internal',
  isPublished: false,
  staffNote: '封面有水印，先 hold',
  reviewLabelKey: null,
  sourceCheckStatus: 'partial',
  doubanStatus: 'matched',
}

export const MOCK_DECISION_VIDEO_APPROVED: DecisionCardVideo = {
  id: 'vid-approved',
  title: '黑神话：悟空',
  reviewStatus: 'approved',
  visibilityStatus: 'internal',
  isPublished: false,
  staffNote: null,
  reviewLabelKey: null,
  sourceCheckStatus: 'ok',
  doubanStatus: 'matched',
}

export const MOCK_DECISION_VIDEO_REJECTED: DecisionCardVideo = {
  id: 'vid-rejected',
  title: '玫瑰的故事',
  reviewStatus: 'rejected',
  visibilityStatus: 'hidden',
  isPublished: false,
  staffNote: '全线路失效无法播放',
  reviewLabelKey: 'all_lines_dead',
  sourceCheckStatus: 'all_dead',
  doubanStatus: 'matched',
}
