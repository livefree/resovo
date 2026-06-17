import { MetadataStatusPanel } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }
const panelWrap: React.CSSProperties = {
  maxWidth: 480,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '16px',
  background: 'var(--surface-default)',
}
const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
}

// 公共完整摘要：豆瓣+Bangumi+TMDB+IMDb 四源全匹配（anime）
const summaryComplete = {
  overall: 'complete' as const,
  issueLevel: 'none' as const,
  score: 95,
  enrichedAt: '2026-06-01T10:00:00Z',
  primaryProvider: 'douban' as const,
  tmdbHrefKind: 'tv' as const,
  providers: {
    douban: {
      provider: 'douban' as const,
      state: 'applied' as const,
      issueLevel: 'none' as const,
      externalId: '2404435',
      label: '进击的巨人',
      confidence: 0.99,
      matchMethod: 'title',
      appliedAt: '2026-06-01T10:00:00Z',
      fetchedAt: '2026-06-01T09:58:00Z',
      reasonCodes: [],
      tooltipLines: [],
    },
    bangumi: {
      provider: 'bangumi' as const,
      state: 'applied' as const,
      issueLevel: 'none' as const,
      externalId: '40196',
      label: '进击的巨人 最终季',
      confidence: 0.97,
      matchMethod: 'title',
      appliedAt: '2026-06-01T10:00:00Z',
      fetchedAt: '2026-06-01T09:59:00Z',
      reasonCodes: [],
      tooltipLines: [],
    },
    tmdb: {
      provider: 'tmdb' as const,
      state: 'applied' as const,
      issueLevel: 'none' as const,
      externalId: '1429',
      label: 'Attack on Titan',
      confidence: null,
      matchMethod: null,
      appliedAt: '2026-06-01T10:00:00Z',
      fetchedAt: null,
      reasonCodes: [],
      tooltipLines: [],
    },
    imdb: {
      provider: 'imdb' as const,
      state: 'applied' as const,
      issueLevel: 'none' as const,
      externalId: 'tt2560140',
      label: 'tt2560140',
      confidence: null,
      matchMethod: null,
      appliedAt: '2026-06-01T10:00:00Z',
      fetchedAt: null,
      reasonCodes: [],
      tooltipLines: [],
    },
  },
  issues: [],
  nextAction: 'none' as const,
  sort: {
    statusRank: 5,
    issueRank: 0,
    scoreRank: 95,
    updatedAt: '2026-06-01T10:00:00Z',
  },
}

// 候选待确认摘要
const summaryCandidate = {
  overall: 'candidate' as const,
  issueLevel: 'warn' as const,
  score: 63,
  enrichedAt: '2026-05-18T09:15:00Z',
  primaryProvider: null,
  tmdbHrefKind: 'movie' as const,
  providers: {
    douban: {
      provider: 'douban' as const,
      state: 'candidate' as const,
      issueLevel: 'warn' as const,
      externalId: '1291542',
      label: '候选：移动迷宫',
      confidence: 0.71,
      matchMethod: 'title',
      appliedAt: null,
      fetchedAt: '2026-05-18T09:10:00Z',
      reasonCodes: ['candidate_unconfirmed'],
      tooltipLines: [],
    },
    bangumi: {
      provider: 'bangumi' as const,
      state: 'not_applicable' as const,
      issueLevel: 'none' as const,
      externalId: null,
      label: null,
      confidence: null,
      matchMethod: null,
      appliedAt: null,
      fetchedAt: null,
      reasonCodes: ['not_applicable_type'],
      tooltipLines: [],
    },
    tmdb: {
      provider: 'tmdb' as const,
      state: 'applied' as const,
      issueLevel: 'none' as const,
      externalId: '198663',
      label: 'The Maze Runner',
      confidence: null,
      matchMethod: null,
      appliedAt: '2026-05-18T09:12:00Z',
      fetchedAt: null,
      reasonCodes: [],
      tooltipLines: [],
    },
    imdb: {
      provider: 'imdb' as const,
      state: 'missing' as const,
      issueLevel: 'warn' as const,
      externalId: null,
      label: null,
      confidence: null,
      matchMethod: null,
      appliedAt: null,
      fetchedAt: null,
      reasonCodes: ['no_ref'],
      tooltipLines: [],
    },
  },
  issues: [
    {
      code: 'candidate_unconfirmed',
      level: 'warn' as const,
      provider: 'douban' as const,
      message: '候选待确认',
      action: 'confirm_candidate' as const,
    },
  ],
  nextAction: 'confirm_candidate' as const,
  sort: {
    statusRank: 2,
    issueRank: 2,
    scoreRank: 63,
    updatedAt: '2026-05-18T09:15:00Z',
  },
}

// 需复核（冲突 + 缺失）摘要
const summaryNeedsReview = {
  overall: 'needs_review' as const,
  issueLevel: 'danger' as const,
  score: 31,
  enrichedAt: '2026-04-10T06:00:00Z',
  primaryProvider: null,
  tmdbHrefKind: 'tv' as const,
  providers: {
    douban: {
      provider: 'douban' as const,
      state: 'problem' as const,
      issueLevel: 'danger' as const,
      externalId: '3016873',
      label: '神探夏洛克',
      confidence: 0.45,
      matchMethod: 'network',
      appliedAt: null,
      fetchedAt: '2026-04-10T05:55:00Z',
      reasonCodes: ['low_confidence', 'id_conflict'],
      tooltipLines: [],
    },
    bangumi: {
      provider: 'bangumi' as const,
      state: 'not_applicable' as const,
      issueLevel: 'none' as const,
      externalId: null,
      label: null,
      confidence: null,
      matchMethod: null,
      appliedAt: null,
      fetchedAt: null,
      reasonCodes: ['not_applicable_type'],
      tooltipLines: [],
    },
    tmdb: {
      provider: 'tmdb' as const,
      state: 'missing' as const,
      issueLevel: 'warn' as const,
      externalId: null,
      label: null,
      confidence: null,
      matchMethod: null,
      appliedAt: null,
      fetchedAt: null,
      reasonCodes: ['no_ref'],
      tooltipLines: [],
    },
    imdb: {
      provider: 'imdb' as const,
      state: 'missing' as const,
      issueLevel: 'warn' as const,
      externalId: null,
      label: null,
      confidence: null,
      matchMethod: null,
      appliedAt: null,
      fetchedAt: null,
      reasonCodes: ['no_ref'],
      tooltipLines: [],
    },
  },
  issues: [
    {
      code: 'id_conflict',
      level: 'danger' as const,
      provider: 'douban' as const,
      message: '匹配冲突',
      action: 'review_conflict' as const,
    },
    {
      code: 'low_confidence',
      level: 'warn' as const,
      provider: 'douban' as const,
      message: '低置信度',
      action: 'review_conflict' as const,
    },
  ],
  nextAction: 'review_conflict' as const,
  sort: {
    statusRank: 1,
    issueRank: 3,
    scoreRank: 31,
    updatedAt: '2026-04-10T06:00:00Z',
  },
}

// compact 变体——折叠摘要（视频库行展开预览卡）
export const CompactVariant = () => (
  <div style={col}>
    <div>
      <div style={sectionLabel}>compact — 完整（无问题）</div>
      <div style={panelWrap}>
        <MetadataStatusPanel
          summary={summaryComplete}
          variant="compact"
          enrichedAtLabel="2026-06-01 10:00"
        />
      </div>
    </div>
    <div>
      <div style={sectionLabel}>compact — 候选待确认</div>
      <div style={panelWrap}>
        <MetadataStatusPanel
          summary={summaryCandidate}
          variant="compact"
          enrichedAtLabel="2026-05-18 09:15"
          onAction={(action, provider) => {
            console.log('onAction', action, provider)
          }}
        />
      </div>
    </div>
  </div>
)

// drawer 变体——编辑抽屉内四来源卡
export const DrawerVariant = () => (
  <div style={col}>
    <div>
      <div style={sectionLabel}>drawer — 全源命中（进击的巨人 / anime）</div>
      <div style={panelWrap}>
        <MetadataStatusPanel
          summary={summaryComplete}
          variant="drawer"
          enrichedAtLabel="2026-06-01 10:00"
          onAction={(action, provider) => {
            console.log('onAction', action, provider)
          }}
        />
      </div>
    </div>
    <div>
      <div style={sectionLabel}>drawer — 候选待确认（含主动作按钮）</div>
      <div style={panelWrap}>
        <MetadataStatusPanel
          summary={summaryCandidate}
          variant="drawer"
          enrichedAtLabel="2026-05-18 09:15"
          onAction={(action, provider) => {
            console.log('onAction', action, provider)
          }}
        />
      </div>
    </div>
  </div>
)

// detail 变体——审核详情全展开（含来源证据子区）
export const DetailVariant = () => (
  <div style={col}>
    <div>
      <div style={sectionLabel}>detail — 需复核（冲突 + 多问题）</div>
      <div style={panelWrap}>
        <MetadataStatusPanel
          summary={summaryNeedsReview}
          variant="detail"
          enrichedAtLabel="2026-04-10 06:00"
          onAction={(action, provider) => {
            console.log('onAction', action, provider)
          }}
          sourceEvidence={
            <div style={{ marginTop: 8, fontSize: '12px', color: 'var(--fg-muted)' }}>
              <div>豆瓣 ID：3016873 · 条目名：神探夏洛克</div>
              <div>匹配方式：按网络搜索（network）· 置信度：45%</div>
            </div>
          }
        />
      </div>
    </div>
  </div>
)

// 只读模式（无 onAction——不渲染主动作按钮）
export const ReadOnlyMode = () => (
  <div style={col}>
    <div>
      <div style={sectionLabel}>drawer — 只读（不传 onAction）</div>
      <div style={panelWrap}>
        <MetadataStatusPanel
          summary={summaryCandidate}
          variant="drawer"
          enrichedAtLabel="2026-05-18 09:15"
        />
      </div>
    </div>
  </div>
)
