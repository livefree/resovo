'use client'

/**
 * ApiWebhookTab — API·Webhook Tab（CHG-SN-7-REDO-03-C）
 *
 * 范围（本卡）：Webhook 配置字段读写（复用 notification_webhook_* KV）
 *
 * 后续扩展（ADR-127 / M-SN-8+）：API Key 生成/列表/吊销（独立 api_keys 表 + 专用端点）
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
  lineHeight: 1.8,
}

export function ApiWebhookTab() {
  return (
    <div style={SECTION_STYLE} data-testid="api-webhook-tab">
      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: 'Webhook 配置',
          subtitle: 'Webhook 端点与签名密钥由「通知设置」Tab 统一管理',
        }}
        data-testid="api-webhook-card-webhook"
      >
        <div style={ADVISORY_STYLE}>
          Webhook 端点 URL 和 HMAC-SHA256 签名密钥已在
          <strong style={{ color: 'var(--fg-default)' }}>「通知设置」</strong>
          Tab 统一配置，此处不重复设置。
        </div>
      </AdminCard>

      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: 'API Key 管理',
          subtitle: 'API Key 生成 / 列表 / 吊销（待 ADR-127 / M-SN-8+ 实装）',
        }}
        data-testid="api-webhook-card-keys"
      >
        <div style={ADVISORY_STYLE}>
          <div style={{ marginBottom: '8px' }}>
            <strong style={{ color: 'var(--fg-default)' }}>API Key 管理</strong>：
            Key 列表（名称 / 创建时间 / 最后使用）· 生成 / 吊销操作
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong style={{ color: 'var(--fg-default)' }}>事件订阅</strong>：
            视频采集完成 · 审核状态变更 · 用户投稿处理 · 系统告警
          </div>
          <div style={{ color: 'var(--state-warn-fg)', marginTop: '12px' }}>
            需独立 api_keys 表 + 专用端点（ADR-127 M-SN-8+）
          </div>
        </div>
      </AdminCard>
    </div>
  )
}
