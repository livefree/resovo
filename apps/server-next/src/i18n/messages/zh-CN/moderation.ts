/**
 * moderation.ts — 审核台 i18n 文案字典（CHG-SN-4-07 + CHG-SN-4-FIX-C 扩展）
 *
 * 使用方式：`import { M } from '@/i18n/messages/zh-CN/moderation'`
 * 零 i18n 框架依赖；待后续接入 next-intl 时迁移为标准 messages JSON。
 */

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} 天前`
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export const M = {
  title: '内容审核台',
  tabs: {
    pending: '待审核',
    staging: '待发布',
    rejected: '已拒绝',
  },
  rightTab: {
    detail: '详情',
    history: '历史',
    similar: '类似',
  },
  history: {
    empty: '该视频尚无审核记录',
    loading: '加载中…',
    failed: '历史记录加载失败',
    prevPage: '上一页',
    nextPage: '下一页',
    pageInfo: (current: number, total: number) => `第 ${current} / ${total} 页`,
    actor: (username: string | null) => username ?? '系统',
    relativeTime: (iso: string) => formatRelativeTime(iso),
    action: {
      'video.approve': '通过',
      'video.reject_labeled': '拒绝',
      'video.staff_note': '更新备注',
      'video.visibility_patch': '修改可见性',
      'video.reopen': '重新开审',
      'video.refetch_sources': '触发补源',
      'video_source.toggle': '切换线路',
      'video_source.disable_dead_batch': '禁用全失效',
      'staging.revert': '退回审核',
      'staging.publish': '发布上架',
      'staging.batch_publish': '批量发布',
      unknown: '未知操作',
    } as Record<string, string>,
  },
  similar: {
    placeholder: '类似视频功能将于 M-SN-5 上线',
    note: '届时将基于类型 / 国家 / 年份召回相似视频，辅助跨视频审核决策。',
  },
  preset: {
    popoverTitle: '筛选预设',
    localOnlyBadge: '仅本地',
    localOnlyTooltip: '当前预设仅保存在你的浏览器（localStorage），未跨账号同步；团队共享待 follow-up（GAPS.md #G-moderation-preset-team）',
    empty: '尚无保存的预设',
    applyBtn: '应用',
    setDefaultBtn: '设为默认',
    unsetDefaultBtn: '取消默认',
    removeBtn: '删除',
    saveCurrentBtn: '+ 保存当前筛选为预设',
    modalTitle: '保存筛选预设',
    nameLabel: '预设名称',
    namePlaceholder: '例如：本周冷门 / 高优先级',
    tabLabel: '适用 Tab',
    tabAll: '全部 Tab',
    tabPending: '待审核',
    tabStaging: '待发布',
    tabRejected: '已拒绝',
    isDefaultLabel: '设为该 Tab 默认（进入审核台时自动应用）',
    saveBtn: '保存',
    cancelBtn: '取消',
    nameRequired: '名称必填',
    toast: {
      saved: (name: string) => `已保存预设「${name}」`,
      applied: (name: string) => `已应用「${name}」`,
      deleted: (name: string) => `已删除「${name}」`,
      undo: '撤销',
      defaultSet: (name: string) => `已设「${name}」为默认`,
      defaultUnset: (name: string) => `已取消「${name}」默认`,
    },
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
  // MODUX-P3-2：待审列表筛选弹层
  filterPanel: {
    triggerLabel: '筛选',
    title: '筛选待审视频',
    all: '全部',
    type: '类型',
    decade: '年代',
    enrichment: '富集状态',
    sourceCheck: '探测状态',
    douban: '豆瓣状态',
    staffNote: '人工备注',
    manualReview: '需人工复核',
    hasStaffNoteYes: '有备注',
    hasStaffNoteNo: '无备注',
    needsManualReviewYes: '需人工',
    decadeSuffix: (d: number) => `${d}s`,
    enrichmentLabel: { missing: '未富集', partial: '部分富集', complete: '已富集' } as Record<string, string>,
    apply: '应用筛选',
    clear: '清除全部',
    kbdHint: '打开筛选（F）',
  },
  // MODUX-P3-4-B：4 字段内联快编
  quickEdit: {
    label: '快速编辑',
    type: '类型',
    year: '年代',
    country: '地区',
    genres: '题材',
    countryPlaceholder: '如 JP / US / CN',
    genresLoading: '加载中…',
    saved: '已保存',
    skipped: (fields: string) => `部分字段被锁未保存：${fields}`,
    saveFailed: '保存失败，已回滚',
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
    // CHG-367-B-B / ADR-163 §6：episodes 三维显示标签（"已收 X / 已播 Y / 共 Z"）
    episodesTriad: '集数',
    received: '已收',  // episode_count（爬虫推算 / 已收录最大集数）
    aired: '已播',     // current_episodes（外部 metadata / 已播集数）
    total: '共',       // total_episodes（外部 metadata / 总集数）
    anomaly: '数据异常',  // Y1 防御：currentEpisodes > totalEpisodes 时标记
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
    readiness: {
      allOk: '已就绪可发布',
      hasBlockers: '存在发布阻塞项',
      // 以下 5 项为后端 checkReadiness 升级到 5 项 check items 后启用（CHG-SN-4-09c-A 欠账）
      reviewStatus: '审核状态',
      linesMin: '有效线路 ≥ 1',
      cover: '封面 P0',
      douban: '豆瓣匹配',
      signal: '探测/播放信号',
    },
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
    listHeaderWithTotal: (loaded: number, total: number) => `${loaded} / ${total} 条已拒绝`,
    loadMore: '加载更多',
    loadingMore: '加载中…',
    allLoaded: '已显示全部',
    reopen: '↻ 重新审核',
    rejectedLabel: '拒绝标签',
    noLabel: '—',
    empty: '暂无已拒绝视频',
    loading: '加载中…',
    // CHG-SN-9-REJECTED-ENHANCE-B / Wave 4 #1：批量勾选 + reopen toast 文案
    bulkReopen: (count: number) => `↻ 批量重审 ${count} 条`,
    bulkSelectedHint: (count: number) => `已勾选 ${count} 条`,
    clearSelection: '清空',
    toggleSelectAria: '勾选该视频',
    toast: {
      reopened: '已跳回待审核',
      reopenedDesc: '该视频已回到「待审核」队列，可切到 pending tab 处理',
      batchReopened: (n: number) => `已跳回待审核 ${n} 条`,
      batchPartialFailed: (ok: number, failed: number) => `已跳回 ${ok} 条 · ${failed} 条失败`,
      batchAllFailed: (n: number) => `${n} 条全部失败，请重试`,
    },
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
  lines: {
    loadFailed: '加载失败',
    toggleFailed: '切换失败，请重试',
    toggleRace: '已被其他审核员处理，已为你刷新最新状态',
    disableDeadFailed: '批量禁用失败',
    refetchFailed: '触发抓取失败',
    fullEpisode: '全集',
    // CHG-358-FIX：probe/render-check 反馈全改用 admin-ui useToast 浮层（不改变页面布局 / 取代 inline actionError 红条）
    // 既有 toggleFailed / loadFailed / disableDeadFailed / refetchFailed 仍走 actionError（保留 / 不在本卡范围）
  },
  aria: {
    lineEnable: '启用线路',
    lineDisable: '停用线路',
    lineEvidence: '查看线路证据',
    lineRefetch: '重新抓取线路',
    lineDisableDead: '禁用全失效线路',
    stagingBatchPublish: '批量发布',
    stagingRevert: '退回审核',
    stagingPublishOne: '发布上架',
    rejectedReopen: '重新开审',
    consoleSplitRegion: '审核台三栏',
    consoleQueuePane: '审核队列',
    consoleRejectVideo: '拒绝视频',
    consoleSkipVideo: '跳过视频',
    consoleApproveVideo: '通过视频',
    consolePreviewPane: '视频审核预览',
    consoleDetailPane: '视频详情',
    editVideo: '打开视频编辑',
    openFrontend: '在前台预览',
    splitVideo: '打开拆分工作台',
  },
} as const
