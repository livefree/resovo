'use client'

/**
 * ApiWebhookTab — API Key + Webhook 配置 Tab（CHG-SN-7-REDO-03-B）
 *
 * 占位实装：计划字段待 REDO-03-C 后端字段扩展后接入。
 * 计划范围：API Key 生成/吊销 / Webhook 端点 URL / 签名密钥 / 事件订阅。
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
  { title: 'API Key 管理', fields: 'Key 列表（名称 / 创建时间 / 最后使用）· 生成 / 吊销操作' },
  { title: 'Webhook 端点', fields: 'Webhook URL · HMAC-SHA256 签名密钥 · 重试策略' },
  { title: '事件订阅', fields: '视频采集完成 · 审核状态变更 · 用户投稿处理 · 系统告警' },
]

export function ApiWebhookTab() {
  return (
    <div style={SECTION_STYLE} data-testid="api-webhook-tab">
      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: 'API Key',
          subtitle: 'API Key 生成与吊销（待 REDO-03-C 后端字段扩展后接入）',
        }}
        data-testid="api-webhook-card-keys"
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
