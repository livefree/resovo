/**
 * server-next ESLint 边界配置（plan §4.6 / ADR-100 / ADR-102）
 *
 * 与 apps/web-next/server 沿用 next lint 默认配置，本文件仅追加 server-next
 * 专属边界规则：
 *   1. no-restricted-imports —— 禁止跨 apps 直接 import（plan §4.6 字面 patterns）
 *   2. 共享应走 packages/*（ADR-100 架构约束）
 *
 * dual-signal / admin-layout token 的跨域消费禁令（ADR-102）由
 * scripts/verify-server-next-isolation.mjs 兜底（CI），ESLint 仅做 import path 守卫。
 */

module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../../server/**', 'apps/server/**'],
            message: 'server-next 不得引用 apps/server（M-SN-7 cutover 后退役）',
          },
          {
            group: ['../../web/**', 'apps/web/**'],
            message: 'apps/web 已退役（M-SN-0 R11 删除）',
          },
          {
            group: ['../../web-next/src/**', 'apps/web-next/src/**'],
            message: '共享应走 packages/*（plan §4.4 / §4.6 ESLint 边界）',
          },
        ],
      },
    ],
  },
}
