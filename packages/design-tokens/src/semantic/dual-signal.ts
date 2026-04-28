/**
 * Dual-signal token — admin 业务专属语义层
 * 用途：区分 link probe（HEAD/Content-Type 探测）与实际播放渲染（render）信号
 * 消费：apps/server-next（admin 主用）
 * 跨域消费禁令：apps/web-next 任何路由 0 消费（ADR-102；编译期 ESLint + ts-morph CI 守卫）
 *
 * 颜色源采用 v2.1 后台设计稿 hex 值（设计师调色），暂未转 oklch；
 * 未来若纳入 primitives 颜色层需 ADR 续编（plan §4.3 硬约束 1）。
 */
export const dualSignal = {
  light: {
    probe: '#0284c7', // sky-600（light 主题加深，保持对比）
    'probe-soft': 'rgba(2, 132, 199, 0.14)',
    render: '#9333ea', // purple-600
    'render-soft': 'rgba(147, 51, 234, 0.14)',
  },
  dark: {
    probe: '#38bdf8', // sky-400（v2.1 设计稿原值）
    'probe-soft': 'rgba(56, 189, 248, 0.14)',
    render: '#a855f7', // purple-500（v2.1 设计稿原值）
    'render-soft': 'rgba(168, 85, 247, 0.14)',
  },
} as const

export type DualSignalToken = keyof typeof dualSignal.light
export type DualSignalTheme = keyof typeof dualSignal
