# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-HOTFIX-F — 前端 range '5m' + KpiRow 布局横向滚动

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 17:35
- **实际开始**：2026-05-26 17:35
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 §7 实施期延伸 + EP-1B2-LAYOUT plan-revision 延伸
- **触发**：@livefree D-155 实测后反馈两条：
  1. "自动采集卡和 KPI 在窗口变窄时折叠，改成变窄是水平方向滚动显示"
  2. 时间轴默认 5 分钟（HOTFIX-E 后端已开口；本卡前端同步）

### 问题理解

1. EP-1B2-LAYOUT 后概览区第一行 `grid 'minmax(280px, 360px) 1fr'`：SummaryCard 左 + KpiRow 右；EP-1B1 后 KpiRow 改 `repeat(auto-fit, minmax(140px, 1fr))` 让窗口变窄时 5 KpiCard wrap 成多行垂直堆叠 — 用户希望保持单行 + 横向滚动。
2. HOTFIX-E 后端已接受 '5m' + 默认改 '5m'；前端 RANGE_OPTIONS 仍是 7 选项 + 默认 '1h'，需与后端对齐。

### 根因判断

1. KpiRow 默认设计假设独立使用宽度足够；嵌入到 minmax(280, 360) + 1fr 容器后宽度被压缩到 ≈ 1100px - 360px - 12px ≈ 720px，5 卡 ×144px 临界，窄屏 wrap。
2. HOTFIX-E 仅改后端，前端类型 + UI 默认未同步。

### 方案

**Step 1**（`apps/server-next/src/lib/crawler/api.ts`）：
- `CrawlerTimelineRange` 加 `'5m'`（与后端 HOTFIX-E 对齐）

**Step 2**（`apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`）：
- `RANGE_OPTIONS` 顶部加 `{ value: '5m', label: '5 分钟' }`（共 8 entry）
- `validRanges` 数组加 `'5m'`
- `defaultRange` prop 兜底从 `'1h'` 改为 `'5m'`（CrawlerClient 不显式传时用默认）

**Step 3**（`apps/server-next/src/app/admin/crawler/_client/CrawlerKpiRow.tsx`）：
- `gridTemplateColumns` 从 `repeat(auto-fit, minmax(140px, 1fr))` 改为 `repeat(5, minmax(140px, 1fr))` 固定 5 列（KpiRow 总宽 ≥ 700px）
- 外层加 wrapper `overflow-x: auto` + `min-width: 0`：窗口窄时容器内横向滚动（不 wrap / 不折叠）

**Step 4**（`apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`）：
- `OVERVIEW_ROW_STYLE` 加 `overflow-x: auto`（OVERVIEW_ROW 容器横向滚动兜底）
- 子项 SummaryCard + KpiRow `min-width: 0` 让 grid 1fr 真正可压缩到滚动

**Step 5**（单测）：
- `CrawlerTimelineCard.test.tsx` 适配（默认 range 从 '1h' 改 '5m' / 验证 RANGE_OPTIONS 含 8 entry）

### 涉及文件

- `apps/server-next/src/lib/crawler/api.ts`（Step 1）
- `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（Step 2 + 默认改 5m）
- `apps/server-next/src/app/admin/crawler/_client/CrawlerKpiRow.tsx`（Step 3 固定 5 列 + 横向滚动）
- `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（Step 4 OVERVIEW_ROW overflow-x）
- `tests/unit/components/server-next/admin/crawler/CrawlerTimelineCard.test.tsx`（Step 5 适配）

PATCH 文件数：4 源 + 1 测试 = 5 项（≤ 5 硬约束 ✅ 临界）

### 验收要点

- **dev server 实测**（@livefree）：
  1. 浏览器窄屏（< 1100px）`/admin/crawler` 概览区 → KpiRow 保持单行 5 KpiCard + 容器横向滚动条
  2. 时间轴默认 range = "5 分钟"（不再 "1 小时"）
  3. range select 含 8 选项（5m / 30m / 1h / 2h / 6h / 12h / 24h / 7d）
  4. 切到 5m → 时间轴显示 5 分钟窗口（70% 历史 3.5min + 30% 未来 1.5min）
- typecheck / lint / test / verify:adr-contracts 全过

### 不在范围

- KpiCard 单卡内部布局优化 → 未来评估
- 浏览器窄屏 < 700px 时 KpiCard 字体缩小 → 未来评估

---

## 下次会话恢复入口

HOTFIX-F 完成后等 @livefree 端到端实测；视情况启 N1-EP3b-2 / EP-1C-CLEANUP。
