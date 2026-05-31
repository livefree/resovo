'use client'

/**
 * SettingsTab — 站点基础设置 Tab（CHG-SN-6-07 / M-SN-6 第 6 张主体卡）
 *
 * 范围：GET/POST /admin/system/settings（v1 CHG-34 端点 + RETRO-3-A audit_log 已补）
 *
 * 13 字段表单分 4 section card（reference §5.11）：
 *   - 基础信息（siteName / siteAnnouncement）
 *   - 豆瓣（doubanProxy / doubanCookie）
 *   - 内容过滤（showAdultContent / contentFilterEnabled）
 *   - 视频代理（videoProxyEnabled / videoProxyUrl）
 *   - 自动采集（autoCrawlEnabled / autoCrawlMaxPerRun / autoCrawlRecentOnly / autoCrawlRecentDays）
 *
 * 共享原语（≥ 80%）：
 *   AdminCard / AdminButton / AdminInput / ErrorState / LoadingState / useToast
 *
 * 注：原生 <input type="checkbox"> 兜底（admin-ui 暂无 AdminCheckbox 原语）
 */

import React, { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminCheckbox,
  AdminTextarea,
  ErrorState,
  LoadingState,
  useToast,
} from '@resovo/admin-ui'
import {
  getSiteSettings,
  saveSiteSettings,
  type SiteSettings,
  type GeneralSettingsPatch,
} from '@/lib/system/api'
import { ApiClientError } from '@/lib/api-client'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '12px 0',
}

const FIELD_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px 1fr',
  gap: '12px 16px',
  alignItems: 'center',
}

const FIELD_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FIELD_HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  gridColumn: '2 / 3',
  marginTop: '-6px',
}

const ACTION_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  paddingTop: '8px',
}

const SYNC_RESULT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

function describeApiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'VALIDATION_ERROR') {
      return { title: '参数校验失败', description: err.message }
    }
    return { title: '保存失败', description: err.message }
  }
  return { title: '保存失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export function SettingsTab() {
  const toast = useToast()
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [dirty, setDirty] = useState(false)
  // FIX-SETTINGS-PARTIAL-SAVE：只提交本次改动过的字段，避免全量快照覆盖其它 Tab 配置
  const dirtyKeysRef = useRef<Set<keyof GeneralSettingsPatch>>(new Set())
  // 保存进行中（非 null）时记录被改动的键：成功后这些键保留为 dirty，防 in-flight 编辑被静默清除。
  // 同步写读（不经 useEffect），消除值比对方案的时序窗口（含 same-field 重改）。
  const touchedDuringSaveRef = useRef<Set<keyof GeneralSettingsPatch> | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  // ADR-168 META-16-C：Bangumi token 显隐切换（默认隐藏；输入新值时可显）
  const [showBangumiToken, setShowBangumiToken] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getSiteSettings()
      .then((res) => {
        if (cancelled) return
        setSettings(res)
        dirtyKeysRef.current.clear()
        setDirty(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('设置加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const update = useCallback(<K extends keyof GeneralSettingsPatch>(key: K, value: SiteSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    dirtyKeysRef.current.add(key)
    // 保存进行中改动 → 记录，成功后保留为 dirty（不被本次保存清除）
    touchedDuringSaveRef.current?.add(key)
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!settings) return
    // 仅提交本次改动过的字段（dirty）：后端部分 upsert，未提交字段保持不变 → 不覆盖其它 Tab
    const submittedKeys = Array.from(dirtyKeysRef.current)
    if (submittedKeys.length === 0) {
      setDirty(false)
      return
    }
    const patch: GeneralSettingsPatch = {}
    for (const key of submittedKeys) {
      ;(patch as Record<string, unknown>)[key] = settings[key]
    }
    touchedDuringSaveRef.current = new Set()  // 开始追踪 in-flight 改动
    setSaving(true)
    try {
      await saveSiteSettings(patch)
      toast.push({
        title: '已保存',
        description: '站点设置已更新；audit_log 已写入',
        level: 'success',
      })
      // 仅清除「保存进行中未再被改动」的已提交键；in-flight 期间被改的键（含同字段重改）
      // 保留为 dirty，避免静默丢失保存进行中的编辑
      const touched = touchedDuringSaveRef.current ?? new Set<keyof GeneralSettingsPatch>()
      for (const key of submittedKeys) {
        if (!touched.has(key)) dirtyKeysRef.current.delete(key)
      }
      setDirty(dirtyKeysRef.current.size > 0)
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      touchedDuringSaveRef.current = null  // 结束追踪
      setSaving(false)
    }
  }, [settings, toast])

  if (loading && !settings) {
    return (
      <div style={SECTION_STYLE} data-testid="settings-tab">
        <LoadingState variant="skeleton" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={SECTION_STYLE} data-testid="settings-tab">
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      </div>
    )
  }

  if (!settings) return null

  return (
    <div style={SECTION_STYLE} data-testid="settings-tab">
      {/* ── 基础信息 ── */}
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '基础信息', subtitle: '站点名称 / 公告' }}
        data-testid="settings-card-basic"
      >
        <div style={FIELD_GRID_STYLE}>
          <label style={FIELD_LABEL_STYLE} htmlFor="setting-siteName">站点名称</label>
          <AdminInput
            value={settings.siteName}
            onChange={(e) => update('siteName', e.target.value)}
            placeholder="Resovo"
            data-testid="setting-siteName"
            aria-label="站点名称"
          />
          <label style={FIELD_LABEL_STYLE} htmlFor="setting-siteAnnouncement">站点公告</label>
          <AdminTextarea
            id="setting-siteAnnouncement"
            value={settings.siteAnnouncement}
            onChange={(e) => update('siteAnnouncement', e.target.value)}
            placeholder="可选 · 显示在首页顶部"
            rows={3}
            data-testid="setting-siteAnnouncement"
            aria-label="站点公告"
          />
        </div>
      </AdminCard>

      {/* ── 豆瓣 ── */}
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '豆瓣集成', subtitle: '代理 URL + Cookie（外部元数据爬取）' }}
        data-testid="settings-card-douban"
      >
        <div style={FIELD_GRID_STYLE}>
          <label style={FIELD_LABEL_STYLE}>豆瓣代理 URL</label>
          <AdminInput
            value={settings.doubanProxy}
            onChange={(e) => update('doubanProxy', e.target.value)}
            placeholder="http(s)://..."
            data-testid="setting-doubanProxy"
            aria-label="豆瓣代理 URL"
          />
          <label style={FIELD_LABEL_STYLE}>豆瓣 Cookie</label>
          <AdminTextarea
            value={settings.doubanCookie}
            onChange={(e) => update('doubanCookie', e.target.value)}
            placeholder="ll=...; bid=...; ..."
            rows={3}
            data-testid="setting-doubanCookie"
            aria-label="豆瓣 Cookie"
          />
        </div>
      </AdminCard>

      {/* ── 外部数据源（ADR-168）── */}
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '外部数据源', subtitle: 'Bangumi API 凭证（动漫富集走 REST 详情 + 逐集）' }}
        data-testid="settings-card-external"
      >
        <div style={FIELD_GRID_STYLE}>
          <label style={FIELD_LABEL_STYLE}>Bangumi API Token</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AdminInput
              type={showBangumiToken ? 'text' : 'password'}
              value={settings.bangumiApiToken}
              onChange={(e) => update('bangumiApiToken', e.target.value)}
              placeholder="未配置 · 粘贴 bangumi.tv access token"
              data-testid="setting-bangumiApiToken"
              aria-label="Bangumi API Token"
            />
            <AdminButton
              size="sm"
              variant="ghost"
              onClick={() => setShowBangumiToken((v) => !v)}
              data-testid="setting-bangumiToken-toggle"
            >
              {showBangumiToken ? '隐藏' : '显示'}
            </AdminButton>
          </div>
          <label style={FIELD_LABEL_STYLE}>User-Agent</label>
          <AdminInput
            value={settings.bangumiUserAgent}
            onChange={(e) => update('bangumiUserAgent', e.target.value)}
            placeholder="resovo/1.0 (+https://github.com/resovo)"
            data-testid="setting-bangumiUserAgent"
            aria-label="Bangumi User-Agent"
          />
          <label style={FIELD_LABEL_STYLE}>请求超时 (ms)</label>
          <AdminInput
            type="number"
            value={String(settings.bangumiApiTimeoutMs)}
            onChange={(e) => update('bangumiApiTimeoutMs', Number(e.target.value))}
            placeholder="8000"
            data-testid="setting-bangumiApiTimeoutMs"
            aria-label="Bangumi 请求超时毫秒"
          />
        </div>
        <div
          style={{
            marginTop: '10px',
            fontSize: 'var(--font-size-xs)',
            color: settings.bangumiApiTokenSet ? 'var(--state-success-fg)' : 'var(--fg-muted)',
          }}
          data-testid="setting-bangumi-status"
        >
          {settings.bangumiApiTokenSet
            ? '✅ 已配置 · 动漫富集启用 REST 详情 + 逐集'
            : '未配置 · 动漫富集走本地 dump 降级（字段较少）'}
        </div>
      </AdminCard>

      {/* ── 内容过滤 ── */}
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '内容过滤', subtitle: '成人内容 / 内容过滤开关' }}
        data-testid="settings-card-filter"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <AdminCheckbox
            label="显示成人内容"
            checked={settings.showAdultContent}
            onChange={(e) => update('showAdultContent', e.target.checked)}
            data-testid="setting-showAdultContent"
          />
          <AdminCheckbox
            label="启用内容过滤（敏感词 / 元数据）"
            checked={settings.contentFilterEnabled}
            onChange={(e) => update('contentFilterEnabled', e.target.checked)}
            data-testid="setting-contentFilterEnabled"
          />
        </div>
      </AdminCard>

      {/* ── 视频代理 ── */}
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '视频代理', subtitle: '反向代理外链视频源（绕过 CDN 屏蔽）' }}
        data-testid="settings-card-video-proxy"
      >
        <div style={FIELD_GRID_STYLE}>
          <label style={FIELD_LABEL_STYLE}>启用</label>
          <AdminCheckbox
            label="启用视频代理"
            checked={settings.videoProxyEnabled}
            onChange={(e) => update('videoProxyEnabled', e.target.checked)}
            data-testid="setting-videoProxyEnabled"
          />
          <label style={FIELD_LABEL_STYLE}>代理 URL</label>
          <AdminInput
            value={settings.videoProxyUrl}
            onChange={(e) => update('videoProxyUrl', e.target.value)}
            placeholder="https://proxy.example.com"
            disabled={!settings.videoProxyEnabled}
            data-testid="setting-videoProxyUrl"
            aria-label="视频代理 URL"
          />
        </div>
      </AdminCard>

      {/* ── 自动采集 ── */}
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '自动采集', subtitle: '定时任务调度 + 限流' }}
        data-testid="settings-card-auto-crawl"
      >
        <div style={FIELD_GRID_STYLE}>
          <label style={FIELD_LABEL_STYLE}>启用</label>
          <AdminCheckbox
            label="启用自动采集"
            checked={settings.autoCrawlEnabled}
            onChange={(e) => update('autoCrawlEnabled', e.target.checked)}
            data-testid="setting-autoCrawlEnabled"
          />

          <label style={FIELD_LABEL_STYLE}>每次最大数量</label>
          <AdminInput
            type="number"
            value={String(settings.autoCrawlMaxPerRun)}
            onChange={(e) => update('autoCrawlMaxPerRun', Number(e.target.value) || 0)}
            placeholder="1-1000"
            data-testid="setting-autoCrawlMaxPerRun"
            aria-label="每次最大数量"
          />
          <div style={FIELD_HINT_STYLE}>范围 1-1000；超出由后端 zod 校验拒绝</div>

          <label style={FIELD_LABEL_STYLE}>仅采近期</label>
          <AdminCheckbox
            label="仅采集最近视频（reduce 已存量）"
            checked={settings.autoCrawlRecentOnly}
            onChange={(e) => update('autoCrawlRecentOnly', e.target.checked)}
            data-testid="setting-autoCrawlRecentOnly"
          />

          <label style={FIELD_LABEL_STYLE}>近期天数</label>
          <AdminInput
            type="number"
            value={String(settings.autoCrawlRecentDays)}
            onChange={(e) => update('autoCrawlRecentDays', Number(e.target.value) || 0)}
            placeholder="1-365"
            disabled={!settings.autoCrawlRecentOnly}
            data-testid="setting-autoCrawlRecentDays"
            aria-label="近期天数"
          />
        </div>
      </AdminCard>

      {/* ── 图片配置（占位；REDO-03-C 接入真实字段）── */}
      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: '图片配置',
          subtitle: '封面 CDN 前缀 / 图片代理 / 降级策略（待 ADR-130 / M-SN-8+ 实装）',
        }}
        data-testid="settings-card-images"
      >
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
          计划字段：封面 CDN 前缀 · 图片代理 URL · 降级封面策略 · 最大图片尺寸
        </div>
      </AdminCard>

      {/* ── 保存 ── */}
      <div style={ACTION_ROW_STYLE}>
        <span style={SYNC_RESULT_STYLE} data-testid="settings-dirty-indicator">
          {dirty ? '有未保存的修改' : '无未保存修改'}
        </span>
        <span style={{ display: 'inline-flex', gap: '8px' }}>
          <AdminButton
            variant="default"
            size="sm"
            disabled={saving}
            onClick={refresh}
            data-testid="settings-reload"
          >
            重新加载
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!dirty}
            onClick={() => void handleSave()}
            data-testid="settings-save"
          >
            保存设置
          </AdminButton>
        </span>
      </div>
    </div>
  )
}
