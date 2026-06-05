/**
 * merge.ts — 合并/拆分工作台 i18n 文案字典（CHG-VIR-13-I18N / SEQ-20260604-01）
 *
 * 使用方式：`import { MERGE_M } from '@/i18n/messages/zh-CN/merge'`
 * 范式沿 moderation.ts `M`：零 i18n 框架依赖，待接入 next-intl 时迁移为标准 messages JSON。
 *
 * 收录口径（CHG-VIR-13-I18N 偏离登记）：13 系列新增的**共享/语义性**文案
 * （状态语义 labels / 智能默认 hints / statusTransition 提示 / 裁定与来源 labels /
 * records 视图 labels）——多组件复用或承载业务语义的字符串集中于此；
 * 组件一次性文案（placeholder / 按钮 / confirm 阻断文案）保留组件内联
 * （与 CHG-VSR-6 反馈内联先例一致，全量逐字符串搬迁收益低于维护成本）。
 */

export const MERGE_M = {
  /** 状态二元组展示（matrix 选项 labels / status-defaults PAIR_LABELS 真源迁移） */
  statusPair: {
    'pending_review|internal': '待审（内部）',
    'pending_review|hidden': '待审（隐藏）',
    'approved|public': '通过并公开',
    'approved|internal': '通过（内部可见）',
    'approved|hidden': '通过（隐藏）',
    'rejected|hidden': '拒绝（隐藏）',
  } as Readonly<Record<string, string>>,

  /** 状态设置控件（D-105-9 / CHG-VIR-13-D2） */
  statusControl: {
    keep: '保持不变',
    hiddenOnly: '设为隐藏',
    splitKeep: '默认待审（内部）',
    splitApprove: '直接通过（内部可见）',
    splitApprovePublish: '通过并公开',
    defaultLabel: '合并后 target 状态',
    splitLabel: '新建状态',
  },

  /** 智能默认提示（设计 §4.4 规则表 / suggestMergeTargetStatus） */
  statusHints: {
    rejectedSource: '源含已拒绝内容，请人工复核',
    sourcePublishedAskSync: '源中有已发布内容，是否同步发布 target？',
    sourcePublicWillLose: 'source 的 public 可见性将丢失，建议提升 target 为公开',
    workspaceLimited: '源中有已公开内容且 target 当前未公开，建议确认合并后状态',
  },

  /** post-COMMIT 状态写入结果提示（D-105-10 / R-105-T3） */
  statusTransition: {
    failed: '操作成功，但状态未变更（状态机拒绝），请在审核台手动调整',
  },

  /** 裁定与来源 labels（records 两子视图 / D-105-8 + ADR-179） */
  records: {
    viewAudit: '操作时间线',
    viewDecisions: '决策记录',
    actorHuman: '人工',
    actorSystem: '自动',
    decisionConfirmed: '确认',
    decisionRejected: '拒绝',
    statusActive: '有效',
    statusReverted: '已撤销',
    decisionReverted: '已推翻',
    deletedSuffix: '（已删）',
    deletedVideoFallback: '(已删除视频)',
  },
} as const
