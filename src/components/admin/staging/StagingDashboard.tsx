/**
 * StagingDashboard.tsx — 暂存发布队列主容器
 * ADMIN-09: 拉取规则 → 渲染表格 + 规则配置面板
 */

'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { StagingTable } from '@/components/admin/staging/StagingTable'
import { StagingRulesPanel } from '@/components/admin/staging/StagingRulesPanel'

interface StagingRules {
  minMetaScore: number
  requireDoubanMatched: boolean
  requireCoverUrl: boolean
  minActiveSourceCount: number
}

const DEFAULT_RULES: StagingRules = {
  minMetaScore: 40,
  requireDoubanMatched: false,
  requireCoverUrl: true,
  minActiveSourceCount: 1,
}

export function StagingDashboard() {
  const [rules, setRules] = useState<StagingRules>(DEFAULT_RULES)
  const [rulesLoaded, setRulesLoaded] = useState(false)

  useEffect(() => {
    apiClient.get<{ data: StagingRules }>('/admin/staging/rules')
      .then((res) => {
        setRules(res.data)
        setRulesLoaded(true)
      })
      .catch(() => {
        setRulesLoaded(true)
      })
  }, [])

  if (!rulesLoaded) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--muted)]" data-testid="staging-dashboard-loading">
        加载中…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6" data-testid="staging-dashboard">
      <StagingTable rules={rules} />
      <StagingRulesPanel initialRules={rules} onSaved={setRules} />
    </div>
  )
}
