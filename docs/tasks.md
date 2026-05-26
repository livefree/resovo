# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-REDESIGN-A-EP-1B2 — D-155-5 AutoCrawlSummaryCard 显式入口卡

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 04:40
- **实际开始**：2026-05-26 04:40
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 D-155-5（🟢 Accepted）；D-155-5 是新组件契约（AutoCrawlSummaryCard 不修改原 ADR），无 §4 AMENDMENT 落盘要求

### 问题理解

当前 schedule 配置仅在 Dashboard `AutoCrawlScheduleCard` 显示（用户必须切到 `/admin` 才能看），且"关闭定时"必须打开 SchedulerConfigDrawer 反勾 globalEnabled。`/admin/crawler` 主页面缺 schedule summary 入口 + 一键关闭快捷。

### 根因判断

CW1-D 实施 Dashboard 卡时未在 /admin/crawler 顶部对称建卡；CW1-A PageHeader inline chip 仅显示"下次自动 HH:MM" 简略信息，无 [立即关闭] / [编辑] 入口。

### 方案

**Step 1**（`apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard.tsx` 新建，约 200 行）：

- Props：`{ onEditClick: () => void }`（父层 CrawlerClient 已持有 SchedulerConfigDrawer state，本卡仅触发 open）
- 状态自治：内部 `useState` 拉 `getAutoCrawlConfig + getCrawlerSystemStatus`（与 AutoCrawlScheduleCard 同范式 / G-155-3 评审建议抽 AutoCrawlInfoBlock 共享组件推迟到第 3 处消费时再抽，本卡仅 2 处接受短期重复）
- 渲染三态（精简版，不复用 AutoCrawlScheduleCard 5 状态完整 UI）：
  - `schedulerEnabled === false` → danger 卡 "调度器进程未启动"（与 AutoCrawlScheduleCard 一致）
  - `!config.globalEnabled` → neutral 卡 "未启用 · 点击编辑配置"
  - `globalEnabled` + countdown → ok 卡 显 `下次: MM-DD HH:MM · ${scheduleSummary} · 模式 X` + 右上角 `[立即关闭]` + `[编辑]`
- `handleClose`：`window.confirm("确认关闭自动调度？已配置的定时任务将不再触发，重新打开后恢复。")` → `setAutoCrawlConfig({...config, globalEnabled: false})` → toast → reload；失败 toast danger
- `data-testid="auto-crawl-summary-card"`、`auto-crawl-summary-close`、`auto-crawl-summary-edit`

**Step 2**（`apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`）：

- 在 `<PageHeader />` 后紧邻插入 `<AutoCrawlSummaryCard onEditClick={() => setSchedulerDrawerOpen(true)} />`
- `setSchedulerDrawerOpen` 已存在（CW1-D query param 自动打开机制）

**Step 3（单测）**（`tests/unit/components/server-next/admin/crawler/AutoCrawlSummaryCard.test.tsx` 新建，5 case）：
- #1 globalEnabled=false → neutral 卡 "未启用" + [编辑] 按钮
- #2 globalEnabled=true + autoCrawlNext + scheduleType=daily → ok 卡 "下次: ... 每日 HH:MM · 模式 X"
- #3 schedulerEnabled=false → danger 卡 "调度器进程未启动"
- #4 [立即关闭] 调 setAutoCrawlConfig({globalEnabled: false}) + success toast
- #5 [编辑] 按钮调 onEditClick props

### 涉及文件

- `apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard.tsx`（新建）
- `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（嵌入）
- `tests/unit/components/server-next/admin/crawler/AutoCrawlSummaryCard.test.tsx`（新建 5 case）

PATCH 文件数：2 源 + 1 测试 = 3 项（≤ 5 硬约束 ✅）

### 验收要点

- **dev server 实测**（@livefree）：
  1. `/admin/crawler` PageHeader 下方可见 AutoCrawlSummaryCard
  2. 卡片显示当前 schedule 摘要（与 SchedulerConfigDrawer 保存的配置一致）
  3. 点 [立即关闭] → confirm 通过 → 卡片变 "未启用" 态 + 全局调度停止
  4. 点 [编辑] → SchedulerConfigDrawer 弹出
  5. scheduler 进程未启动时 → 卡片显红色警告
- typecheck / lint / test / verify:adr-contracts 全过
- 新增 5 case 全过

### 不在范围（→ EP-1C / EP-2 / EP-3）

- D-155-6 多 dailyTime（→ EP-1C-1/C-2）
- D-155-2 topbar 合并（→ EP-2）
- D-155-3 Gantt 三段窗（→ EP-3）
- G-155-3 抽 AutoCrawlInfoBlock 共享组件（推迟到第 3 处消费时再抽）
