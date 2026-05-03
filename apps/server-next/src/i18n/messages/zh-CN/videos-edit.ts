/**
 * videos-edit.ts — VideoEditDrawer 三 Tab 文案字典（CHG-SN-4-08）
 *
 * 使用方式：`import { VE } from '@/i18n/messages/zh-CN/videos-edit'`
 * 零 i18n 框架依赖；待后续接入 next-intl 时迁移为标准 messages JSON。
 */

export const VE = {
  lines: {
    title: '线路列表',
    enabledCount: (enabled: number, total: number) => `${enabled}/${total} 启用`,
    colLine: '线路',
    colProbe: '探测',
    colRender: '播放',
    colEpisodes: '集数',
    colAction: '操作',
    episodes: (n: number) => `${n} 集`,
    latencyMs: (n: number) => `${n}ms`,
    qualityDetected: (q: string) => `[${q}实测]`,
    toggle: { enable: '显', disable: '隐' },
    barSignalAriaLabel: (probe: string, render: string) =>
      `链接探测：${probe}；实际渲染：${render}`,
    actions: {
      disableDead: '禁用全失效',
      refetch: '重新抓取',
      viewHealth: '证据',
    },
    hints: {
      dragHint: '拖拽 ⠿ 调整播放优先级，排前的线路默认优先播放。',
    },
    healthDrawer: {
      title: (siteName: string, label: string) => `${siteName} · ${label}`,
      empty: '暂无健康事件记录',
      loading: '加载中…',
    },
    status: {
      pending: '待测',
      ok: '可达',
      partial: '部分',
      dead: '失效',
      unknown: '未知',
    },
    errors: {
      loadFailed: '加载线路失败',
      toggleFailed: '操作失败，请重试',
      disableDeadFailed: '批量禁用失败',
      refetchFailed: '触发抓取失败',
      reviewRace: '已被其他操作处理，请刷新',
      stateInvalid: '当前状态不允许此操作',
    },
  },
  images: {
    title: '图片素材',
    uploadedCount: (n: number, total: number) => `${n}/${total} 已上传`,
    present: '已上传',
    missing: '缺失',
    required: '必填',
    urlPlaceholder: '输入图片 URL',
    actions: {
      update: '更新',
      cancel: '取消',
      inputUrl: 'URL',
    },
    status: {
      pending_review: '审核中',
      ok: '正常',
      broken: '失效',
      unknown: '未知',
    },
    slots: {
      poster: { label: '封面 (P0)', desc: '竖版海报 2:3' },
      backdrop: { label: '横版 Banner', desc: '16:9 推荐位用' },
      banner_backdrop: { label: '背景大图', desc: '模糊背景用' },
      logo: { label: '标题 Logo', desc: '片名 PNG 透明底' },
    },
    errors: {
      loadFailed: '加载图片信息失败',
      updateFailed: '更新图片失败',
    },
  },
  douban: {
    matchStatus: '豆瓣匹配',
    statusLabel: {
      pending: '待匹配',
      matched: '已匹配',
      candidate: '候选',
      unmatched: '无匹配',
    },
    candidateSection: '候选匹配',
    fieldsSection: '豆瓣导入字段',
    searchSection: '手动指定豆瓣 ID',
    doubanIdPlaceholder: '输入豆瓣 ID（如 26277285）',
    confidenceLabel: (pct: number) => `置信度 ${pct}%`,
    actions: {
      confirm: '确认匹配',
      ignore: '标为无匹配',
      search: '搜索',
      reSearch: '重新搜索',
      cancelSearch: '取消',
      selectCandidate: '选择此项',
    },
    columns: {
      field: '字段',
      local: '本地',
      douban: '豆瓣',
    },
    synced: '一致',
    useDouban: '用豆瓣',
    notPendingNote: '当前视频不在待审核状态，豆瓣确认/忽略操作不可用。',
    errors: {
      loadCandidateFailed: '加载候选数据失败',
      searchFailed: '豆瓣搜索失败，请重试',
      confirmFailed: '确认匹配失败',
      ignoreFailed: '标记失败',
      notPending: '仅待审核视频可操作',
    },
  },
} as const
