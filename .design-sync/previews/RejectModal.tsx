import { RejectModal } from '@resovo/admin-ui'

// 拒绝标签列表（模拟 review_labels 表已过滤排序后的结果）
const REJECT_LABELS = [
  {
    id: 'label-1',
    labelKey: 'copyright_issue',
    label: '版权问题',
    appliesTo: 'reject' as const,
    displayOrder: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'label-2',
    labelKey: 'low_quality',
    label: '画质低劣（< 480p 主流分辨率）',
    appliesTo: 'reject' as const,
    displayOrder: 2,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'label-3',
    labelKey: 'metadata_error',
    label: '元数据严重错误（标题/封面/年份）',
    appliesTo: 'reject' as const,
    displayOrder: 3,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'label-4',
    labelKey: 'duplicate',
    label: '重复内容（已有同版本）',
    appliesTo: 'any' as const,
    displayOrder: 4,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'label-5',
    labelKey: 'region_block',
    label: '地区版权限制',
    appliesTo: 'reject' as const,
    displayOrder: 5,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
]

// 开态（受控 open=true，无预选）
export const Open = () => (
  <RejectModal
    open
    onClose={() => {}}
    labels={REJECT_LABELS}
    onSubmit={async () => {}}
  />
)

// 开态 + 预选标签（快捷恢复上次拒绝标签）
export const OpenWithDefault = () => (
  <RejectModal
    open
    onClose={() => {}}
    labels={REJECT_LABELS}
    defaultLabelKey="metadata_error"
    onSubmit={async () => {}}
  />
)

// 提交中态（submitting=true，按钮 disable）
export const Submitting = () => (
  <RejectModal
    open
    onClose={() => {}}
    labels={REJECT_LABELS}
    defaultLabelKey="low_quality"
    onSubmit={async () => {}}
    submitting
  />
)
