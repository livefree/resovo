/**
 * moderation.ts — 审核台 i18n 文案字典（CHG-SN-4-07）
 *
 * 使用方式：`import { M } from '@/i18n/messages/zh-CN/moderation'`
 * 零 i18n 框架依赖；待后续接入 next-intl 时迁移为标准 messages JSON。
 */

export const M = {
  title: '内容审核台',
  tabs: {
    pending: '待审核',
    staging: '待发布',
    rejected: '已拒绝',
  },
  todayStats: (reviewed: number, approveRate: number | null) =>
    `今天已处理 ${reviewed} 条 · 通过率 ${approveRate != null ? approveRate.toFixed(0) + '%' : '—'}`,
  kbdHint: 'J K 切换 · A 通过 · R 拒绝 · S 跳过',
  kbdFlowLabel: '键盘流',
  counter: (current: number, total: number) => `第 ${current} / ${total}`,
  selectedCount: (count: number) => `${count} 条`,
  totalCount: (total: number, selected: number) => `${total} 条 · 已选 ${selected}`,
  pending: {
    loadingMore: '加载更多…',
    noMore: '— 已全部加载 —',
    empty: '暂无待审核视频',
    loading: '加载中…',
  },
  actions: {
    approve: '通过',
    reject: '拒绝',
    skip: '跳过',
    detail: '详情',
    reopen: '重新审核',
    filterPreset: '筛选预设 ▾',
    savePreset: '保存预设',
  },
  rejectModal: {
    title: '拒绝该视频',
  },
  detail: {
    statusTriad: '状态三元组',
    reviewStatus: 'review',
    visibility: 'visibility',
    isPublished: 'is_published',
    doubanStatus: '豆瓣状态',
    pendingReview: 'pending_review',
    approved: 'approved',
    rejected: 'rejected',
    public: 'public',
    internal: 'internal',
    hidden: 'hidden',
    matched: '已匹配',
    pending: '待匹配',
    unmatched: '无匹配',
    candidate: '候选',
  },
  staging: {
    title: '发布预检',
    listHeader: (count: number) => `${count} 条待发布`,
    publishAll: '↑ 全部发布',
    publishOne: '↑ 发布上架',
    revert: '✕ 退回审核',
    readinessChecks: '发布就绪检查',
    publishSettings: '发布设置',
    approved: '已通过审核',
    empty: '暂无待发布视频',
    loading: '加载中…',
    errors: {
      loadFailed: '加载暂存队列失败',
      publishFailed: '发布失败，请重试',
      batchPublishFailed: '批量发布失败',
      revertFailed: '退回失败，请重试',
    },
  },
  rejected: {
    title: '已拒绝',
    listHeader: (count: number) => `${count} 条已拒绝`,
    reopen: '↻ 重新审核',
    rejectedLabel: '拒绝标签',
    noLabel: '—',
    empty: '暂无已拒绝视频',
    loading: '加载中…',
    errors: {
      loadFailed: '加载已拒绝列表失败',
      reopenFailed: '重新开审失败，请重试',
    },
  },
  errors: {
    loadFailed: '加载待审核队列失败',
    approveFailed: '通过操作失败，请重试',
    rejectFailed: '拒绝操作失败，请重试',
    staffNoteFailed: '备注保存失败，请重试',
  },
} as const
