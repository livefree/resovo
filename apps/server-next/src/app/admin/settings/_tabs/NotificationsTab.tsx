'use client'

/**
 * NotificationsTab — 通知设置 Tab（CHG-SN-7-REDO-03-B）
 *
 * 占位实装：计划字段待 REDO-03-C 后端字段扩展后接入。
 * 计划范围：通知渠道（邮件 / Telegram / Webhook）/ 触发事件 / 阈值配置。
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

const PLANNED_FIELDS: ReadonlyArray<{ title: string; fields: string }> = [
  { title: '通知渠道', fields: '邮件地址 · Telegram Bot Token / Chat ID · 自定义 Webhook URL' },
  { title: '触发事件', fields: '采集失败 · 存储告警 · 审核待处理超阈值 · 用户投稿新增' },
  { title: '通知频率', fields: '即时通知 / 摘要聚合（每小时 / 每日）· 静默期配置' },
]

export function NotificationsTab() {
  return (
    <div style={SECTION_STYLE} data-testid="notifications-tab">
      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: '通知渠道',
          subtitle: '邮件 / Telegram / Webhook（待 REDO-03-C 后端字段扩展后接入）',
        }}
        data-testid="notifications-card-channels"
      >
        <div style={ADVISORY_STYLE}>
          {PLANNED_FIELDS.map((g) => (
            <div key={g.title} style={{ marginBottom: '8px' }}>
              <strong style={{ color: 'var(--fg-default)' }}>{g.title}</strong>：{g.fields}
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  )
}
