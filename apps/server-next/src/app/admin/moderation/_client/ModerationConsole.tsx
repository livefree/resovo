'use client'
/* eslint-disable no-console */

import React, { useState, useEffect, useCallback } from 'react'
import { SplitPane } from '@resovo/admin-ui'
import { ModListRow } from './ModListRow'
import { PendingCenter } from './PendingCenter'
import { StagingTabContent } from './StagingTabContent'
import { RejectedTabContent } from './RejectedTabContent'
import { MOCK_VIDEOS, MOCK_SIMILAR_VIDEOS, MOCK_HISTORY_ITEMS } from './mock-data'

// ── Types ─────────────────────────────────────────────────────────

type TabId = 'pending' | 'staging' | 'rejected'
type RightTabId = 'detail' | 'history' | 'similar'

// ── Constants ─────────────────────────────────────────────────────

const PAGE_HEIGHT = 'calc(100vh - var(--topbar-h) - 32px)'
const TOTAL_PENDING = 484

const TABS: readonly { id: TabId; label: string; count: number; danger?: boolean }[] = [
  { id: 'pending', label: '待审核', count: TOTAL_PENDING },
  { id: 'staging', label: '待发布', count: 23 },
  { id: 'rejected', label: '已拒绝', count: 2, danger: true },
]

const RIGHT_TABS: readonly { id: RightTabId; label: string; count?: number; warn?: boolean }[] = [
  { id: 'detail', label: '详情' },
  { id: 'history', label: '历史', count: 8 },
  { id: 'similar', label: '类似', count: 3, warn: true },
]

// ── Inline styles ─────────────────────────────────────────────────

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg2)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 12,
}

const BTN_PRIMARY: React.CSSProperties = { ...BTN_SM, background: 'var(--accent)', color: 'var(--fg-on-accent)', borderColor: 'var(--accent)' }
const BTN_DANGER: React.CSSProperties = { ...BTN_SM, color: 'var(--state-error-fg)', borderColor: 'var(--state-error-border)' }
const KBD: React.CSSProperties = { display: 'inline-block', padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3, fontSize: 10, fontFamily: 'monospace', background: 'var(--bg3)', color: 'var(--fg-muted)' }

function segBtnStyle(active: boolean, danger?: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--accent-soft)' : 'var(--bg2)',
    color: active ? (danger ? 'var(--state-error-fg)' : 'var(--accent)') : 'var(--fg-muted)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  }
}

function badgeStyle(danger?: boolean): React.CSSProperties {
  return {
    padding: '0 5px',
    borderRadius: 999,
    fontSize: 10,
    background: danger ? 'var(--state-error-bg)' : 'var(--bg3)',
    color: danger ? 'var(--state-error-fg)' : 'var(--fg-muted)',
  }
}

function rightTabStyle(active: boolean, warn?: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '10px 0',
    textAlign: 'center' as const,
    fontSize: 12,
    cursor: 'pointer',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
    fontWeight: active ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  }
}

function historyDotColor(c: string): string {
  switch (c) {
    case 'ok': return 'var(--state-success-fg)'
    case 'warn': return 'var(--state-warning-fg)'
    case 'danger': return 'var(--state-error-fg)'
    default: return 'var(--state-info-fg)'
  }
}

// ── Right pane content ────────────────────────────────────────────

function RightPaneContent({ v, rightTab, setRightTab }: {
  v: typeof MOCK_VIDEOS[0]
  rightTab: RightTabId
  setRightTab: (t: RightTabId) => void
}): React.ReactElement {
  return (
    <>
      {/* Tab header strip */}
      <div style={{ display: 'flex', margin: '-10px -12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        {RIGHT_TABS.map(t => (
          <div key={t.id} onClick={() => setRightTab(t.id)} style={rightTabStyle(rightTab === t.id, t.warn)}>
            {t.label}
            {t.count != null && (
              <span style={{ background: t.warn ? 'var(--state-warning-bg)' : 'var(--bg3)', color: t.warn ? 'var(--state-warning-fg)' : 'var(--fg-muted)', padding: '1px 6px', borderRadius: 8, fontSize: 10 }}>
                {t.count}
              </span>
            )}
          </div>
        ))}
      </div>

      {rightTab === 'detail' && (
        <div style={{ fontSize: 12 }}>
          {/* Douban match */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>豆瓣匹配</div>
            <div style={{ display: 'flex', gap: 8, padding: 8, background: 'var(--bg3)', borderRadius: 6 }}>
              <div style={{ width: 36, height: 54, background: 'var(--bg2)', borderRadius: 3, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 9, color: 'var(--fg-muted)' }}>封{v.thumb}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{v.title}</div>
                <div style={{ color: 'var(--fg-muted)', fontSize: 11, marginTop: 2 }}>豆瓣 ID 26277285 · 置信度 <span style={{ color: 'var(--state-success-fg)' }}>92%</span></div>
                <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                  <button style={{ ...BTN_SM, padding: '2px 6px', fontSize: 11 }} onClick={() => console.log('confirm douban')}>确认</button>
                  <button style={{ ...BTN_SM, padding: '2px 6px', fontSize: 11 }} onClick={() => console.log('change douban')}>换一个</button>
                </div>
              </div>
            </div>
          </div>
          {/* State triad */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>状态三元组</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([
                ['is_published', v.review === 'approved', v.review === 'approved' ? 'true' : 'false'],
                ['visibility', v.visibility === 'public', v.visibility],
                ['review', v.review === 'approved', v.review],
              ] as [string, boolean, string][]).map(([k, ok, val]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg3)', borderRadius: 4 }}>
                  <code style={{ fontFamily: 'monospace', color: 'var(--fg-muted)', fontSize: 11 }}>{k}</code>
                  <span style={{ color: ok ? 'var(--state-success-fg)' : 'var(--state-warning-fg)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Key fields */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>关键字段</div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <tbody>
                {(['演员,王凯, 江疏影', '导演,黄立行', '分类,悬疑 · 爱情', '语言,普通话', '更新,2 小时前'] as const).map(row => {
                  const [k, val] = row.split(',') as [string, string]
                  return (
                    <tr key={k} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 0', color: 'var(--fg-muted)', width: 50 }}>{k}</td>
                      <td style={{ padding: '6px 0' }}>{val}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rightTab === 'history' && (
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 1, background: 'var(--border)' }} />
          {MOCK_HISTORY_ITEMS.map((h, i) => (
            <div key={i} style={{ position: 'relative', paddingBottom: 14 }}>
              <span style={{ position: 'absolute', left: -17, top: 4, width: 9, height: 9, borderRadius: '50%', background: historyDotColor(h.c), border: '2px solid var(--bg2)' }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{h.e}</span>
                <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>· {h.who}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{h.t}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{h.detail}</div>
            </div>
          ))}
        </div>
      )}

      {rightTab === 'similar' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 8, lineHeight: 1.6 }}>
            根据标题、年份、演员相似度找出可能<strong style={{ color: 'var(--fg-default)' }}>重复</strong>的视频。
          </div>
          {MOCK_SIMILAR_VIDEOS.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: 8, background: 'var(--bg3)', borderRadius: 6, marginBottom: 8 }}>
              <div style={{ width: 40, height: 60, background: 'var(--bg2)', borderRadius: 3, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 9, color: 'var(--fg-muted)' }}>封{s.thumb}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: s.sim > 90 ? 'var(--state-error-fg)' : s.sim > 80 ? 'var(--state-warning-fg)' : 'var(--fg-muted)' }}>{s.sim}%</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{s.year} · {s.country} · {s.sources} 源</div>
                <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 2, fontStyle: 'italic' }}>{s.why}</div>
                <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                  <button style={{ ...BTN_SM, padding: '2px 6px', fontSize: 11 }} onClick={() => console.log('merge', s.title)}>合并</button>
                  <button style={{ ...BTN_SM, padding: '2px 6px', fontSize: 11 }}>↗</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Left queue header ─────────────────────────────────────────────

function QueueHeader({ count }: { count: number }): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{TOTAL_PENDING} 条 · 已选 0</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: 'var(--state-success-fg)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--state-success-fg)', display: 'inline-block' }} />
        键盘流
      </span>
    </div>
  )
}

// ── Center pane header ────────────────────────────────────────────

function CenterHeader({ activeIdx, total, v, onApprove, onReject, onSkip, onToggleRight, rightOpen }: {
  activeIdx: number
  total: number
  v: typeof MOCK_VIDEOS[0]
  onApprove: () => void
  onReject: () => void
  onSkip: () => void
  onToggleRight: () => void
  rightOpen: boolean
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
      <span style={KBD}>J</span>
      <span style={KBD}>K</span>
      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>第 {activeIdx + 1} / {total}</span>
      <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, minWidth: 40 }}>
        <div style={{ height: '100%', width: `${((activeIdx + 1) / total) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
      </div>
      <button style={BTN_DANGER} onClick={onReject}>✕ 拒绝 <span style={KBD}>R</span></button>
      <button style={BTN_SM} onClick={onSkip}>跳过 <span style={KBD}>S</span></button>
      <button style={BTN_PRIMARY} onClick={onApprove}>✓ 通过 <span style={KBD}>A</span></button>
      <button style={BTN_SM} onClick={onToggleRight}>{rightOpen ? '›' : '‹'} 详情</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export function ModerationConsole(): React.ReactElement {
  const [tab, setTab] = useState<TabId>('pending')
  const [activeIdx, setActiveIdx] = useState(0)
  const [rightTab, setRightTab] = useState<RightTabId>('detail')
  const [rightOpen, setRightOpen] = useState(true)

  useEffect(() => {
    const update = () => setRightOpen(window.innerWidth >= 1280)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const v = MOCK_VIDEOS[activeIdx] ?? MOCK_VIDEOS[0]!

  const approve = useCallback(() => console.log('approve', v.id), [v.id])
  const reject = useCallback(() => console.log('reject', v.id), [v.id])
  const skip = useCallback(() => console.log('skip', v.id), [v.id])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (tab !== 'pending') return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'j' || e.key === 'J') setActiveIdx(i => Math.min(i + 1, MOCK_VIDEOS.length - 1))
    else if (e.key === 'k' || e.key === 'K') setActiveIdx(i => Math.max(i - 1, 0))
    else if (e.key === 'a' || e.key === 'A') approve()
    else if (e.key === 'r' || e.key === 'R') reject()
    else if (e.key === 's' || e.key === 'S') skip()
  }, [tab, approve, reject, skip])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: PAGE_HEIGHT }} data-moderation-console>

      {/* Page head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--fg-default)' }}>内容审核台</h1>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4, fontSize: 12, color: 'var(--fg-muted)', flexWrap: 'wrap' }}>
            <span>今天已处理 <strong style={{ color: 'var(--fg-default)' }}>27</strong> 条 · 通过率 <strong style={{ color: 'var(--state-success-fg)' }}>81%</strong> · 平均决策 <strong>14s</strong></span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span><span style={KBD}>J</span> <span style={KBD}>K</span> 切换 · <span style={KBD}>A</span> 通过 · <span style={KBD}>R</span> 拒 · <span style={KBD}>S</span> 跳过</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={BTN_SM} onClick={() => console.log('filter preset')}>筛选预设 ▾</button>
          <button style={BTN_SM} onClick={() => console.log('save preset')}>保存预设</button>
        </div>
      </div>

      {/* Segment tabs */}
      <div style={{ display: 'flex', gap: 1, marginBottom: 10, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={segBtnStyle(tab === t.id, t.danger)}>
            {t.label}
            <span style={badgeStyle(t.danger)}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Tab content — flex:1 wrapper needed for SplitPane height inheritance */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'pending' && (
          <SplitPane
            height="100%"
            gap={12}
            role="region"
            aria-label="审核台三栏"
            data-testid="moderation-split"
            panes={[
              {
                width: 280,
                minWidth: 200,
                header: <QueueHeader count={TOTAL_PENDING} />,
                noPadding: true,
                role: 'complementary',
                'aria-label': '审核队列',
                children: (
                  <div role="listbox" aria-label="审核队列">
                    {MOCK_VIDEOS.map((it, i) => (
                      <ModListRow key={it.id} it={it} active={i === activeIdx} onClick={() => setActiveIdx(i)} />
                    ))}
                    <div style={{ padding: 14, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 11 }}>
                      — 底部 · 还有 476 条 —
                    </div>
                  </div>
                ),
              },
              {
                width: '1fr',
                minWidth: 400,
                header: (
                  <CenterHeader
                    activeIdx={activeIdx}
                    total={TOTAL_PENDING}
                    v={v}
                    onApprove={approve}
                    onReject={reject}
                    onSkip={skip}
                    onToggleRight={() => setRightOpen(o => !o)}
                    rightOpen={rightOpen}
                  />
                ),
                role: 'main',
                'aria-label': '视频审核预览',
                children: <PendingCenter v={v} />,
              },
              {
                width: 300,
                minWidth: 260,
                hidden: !rightOpen,
                role: 'complementary',
                'aria-label': '视频详情',
                children: (
                  <RightPaneContent v={v} rightTab={rightTab} setRightTab={setRightTab} />
                ),
              },
            ]}
          />
        )}
        {tab === 'staging' && <StagingTabContent />}
        {tab === 'rejected' && <RejectedTabContent />}
      </div>

    </div>
  )
}
