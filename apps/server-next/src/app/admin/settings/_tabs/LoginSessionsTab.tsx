'use client'

/**
 * LoginSessionsTab — 登录会话管理 Tab（CHG-SN-7-REDO-03-B）
 *
 * 占位实装：计划字段待 REDO-03-C 后端字段扩展后接入。
 * 计划范围：会话超时配置 / 活跃会话列表 / 强制退出 / 多设备策略。
 */

import React, { type CSSProperties } from 'react'
import { AdminCard } from '@resovo/admin-ui'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '12px 0',
}

const ADVISORY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  lineHeight: 1.6,
}

const PLANNED_GROUPS: ReadonlyArray<{ title: string; fields: string }> = [
  { title: '会话超时', fields: 'Access Token 有效期 · Refresh Token 有效期 · 活动后自动续期' },
  { title: '活跃会话', fields: 'IP 地址 · User-Agent · 最后活动时间 · 强制退出单会话' },
  { title: '多设备策略', fields: '同时在线设备数上限 · 超限自动踢出最旧会话' },
]

export function LoginSessionsTab() {
  return (
    <div style={SECTION_STYLE} data-testid="login-sessions-tab">
      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: '登录会话',
          subtitle: '会话超时 / 活跃会话 / 多设备策略（待 REDO-03-C 后端字段扩展后接入）',
        }}
        data-testid="login-sessions-card"
      >
        <div style={ADVISORY_STYLE}>
          {PLANNED_GROUPS.map((g) => (
            <div key={g.title} style={{ marginBottom: '8px' }}>
              <strong style={{ color: 'var(--fg-default)' }}>{g.title}</strong>：{g.fields}
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  )
}
