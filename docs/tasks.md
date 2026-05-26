# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-REDESIGN-A-EP-1B2-LAYOUT — D-155-5 实施期布局延伸（plan-revision）

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 04:50
- **实际开始**：2026-05-26 04:50
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 D-155-5（🟢 Accepted）；本卡是 EP-1B2 实施后用户走读暴露的布局优化需求，属 D-155-5 的延伸（plan-revision），不起新 ADR
- **拆分理由**：EP-1B2 已 commit 闭合 D-155-5 核心组件契约；本卡是 layout 重组 + Collapsible 容器（UX 优化），改动多 3 个文件，避免 EP-1B2 commit 回滚

### 问题理解

@livefree EP-1B2 实测后反馈：
1. AutoCrawlSummaryCard 单独占一行 + KpiRow 单独一行 → 信息密度低（4 行垂直滚动才能看到 SiteList）
2. "自动采集 + KPI + 时间轴" 三块都是辅助/概览信息，主操作区是 SiteList；用户希望折叠概览区降低噪音

### 根因判断

EP-1B2 嵌入 AutoCrawlSummaryCard 时直接放在 PageHeader 与 KpiRow 之间（独立行），未考虑信息密度 + 主次区分。`CrawlerKpiRow` 是 5 列 grid，没考虑被收窄到容器内时的 wrap 行为。

### 方案

**Step 1**（`apps/server-next/src/app/admin/crawler/_client/CrawlerKpiRow.tsx`）：
- `gridTemplateColumns` 从 `repeat(5, 1fr)` 改为 `repeat(auto-fit, minmax(140px, 1fr))`
- 让 KpiRow 在容器宽度收窄时自动 wrap 为 2-3 行，单独使用时仍是 1 行 5 列

**Step 2**（`apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`）：
- 新增 `overviewOpen: boolean` state（默认 `true`，展开）
- 重构 layout：
  ```tsx
  <PageHeader ... />

  {/* 概览容器（可折叠） */}
  <div data-overview-section>
    <button data-testid="overview-toggle" aria-expanded={overviewOpen}
      onClick={() => setOverviewOpen(!overviewOpen)}>
      {overviewOpen ? '▾' : '▸'} 概览
    </button>
    {overviewOpen && (
      <>
        {/* 同一行：SummaryCard 360px + KpiRow flex:1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '12px' }}>
          <AutoCrawlSummaryCard onEditClick={() => setSchedulerOpen(true)} />
          <CrawlerKpiRow kpi={kpi} />
        </div>
        <CrawlerTimelineCard ... />
      </>
    )}
  </div>

  {/* 主操作区 - 永久可见 */}
  <CrawlerSiteList ... />
  ```
- 默认 `overviewOpen=true` 保持现有 UX 不变；折叠后只剩 SiteList 节省空间
- toggle 按钮极简内联（border:none + bg:transparent + cursor:pointer + 小字体）

**Step 3**（`tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx`）：
- 加 2 case：overview 默认展开（点击前 SummaryCard 容器存在）；toggle 后折叠（SummaryCard 容器 + KpiRow + Timeline 不渲染，SiteList 仍渲染）
- 由于 EP-1B2 已 mock AutoCrawlSummaryCard，本卡只需用 `data-testid="mock-auto-crawl-summary-card"` 判定渲染态

### 涉及文件

- `apps/server-next/src/app/admin/crawler/_client/CrawlerKpiRow.tsx`（grid auto-fit）
- `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（overviewOpen state + collapsible + grid 同行 + 移 TimelineCard 进容器）
- `tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx`（扩 2 case）

PATCH 文件数：2 源 + 1 测试 = 3 项（≤ 5 硬约束 ✅）

### 验收要点

- **dev server 实测**（@livefree）：
  1. `/admin/crawler` 默认 PageHeader 下方可见"▾ 概览"toggle + 展开的概览区
  2. SummaryCard 与 KpiRow 同一行（左侧 360px 卡 + 右侧 5 KpiCard）
  3. TimelineCard 在概览区内 full width
  4. 点 "▾ 概览" → 折叠为 "▸ 概览"，SummaryCard + KpiRow + TimelineCard 全部隐藏，仅剩 PageHeader + toggle + SiteList
  5. 浏览器窄屏（< 1200px）KpiRow auto-fit wrap 为 2-3 行不破坏布局
- typecheck / lint / test / verify:adr-contracts 全过
- 新增 2 case 全过

### 不在范围

- 折叠状态持久化（localStorage / cookie）→ 推迟到用户反馈"重打开仍想保持折叠"时再做
- 概览区动画（slide / fade）→ 推迟（CSS height transition 易抖动，需 measure pattern；当前 instant toggle 足够）
- AutoCrawlSummaryCard 内部 layout 优化（紧凑模式）→ 360px 宽度已经够展示六态文案

---

## 下次会话恢复入口

EP-1B2-LAYOUT 完成后启 EP-1C-1（D-155-6 后端契约 + scheduler）。
