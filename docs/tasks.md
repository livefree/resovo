# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-HOTFIX-E — 后端 range 加 '5m' + 默认改 '5m'

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 17:30
- **实际开始**：2026-05-26 17:30
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 §7 实施期延伸（@livefree 实测后 UX 调整，不动 D-155-3 设计契约）
- **触发**：@livefree D-155 实测后反馈 "采集时间轴时间默认刻度过大，横轴默认从 1 小时，先改成 5 分钟"

### 问题理解

EP-3a/EP-3b-1 后端默认 range='1h'，新部署 / 空 task 库时时间轴默认显示 1 小时窗口（70% 历史 42min + 30% 未来 18min），刻度过疏。用户希望默认 5 分钟（细粒度看 30s/1min 级 task）。

### 根因判断

ADR-154 D-154-1 + ADR-155 D-155-3 range 选项以 30m 为最小粒度，但实际用户 daily/interval 任务可能在分钟级触发；5 分钟窗口能更准确看到刚启动 task。

### 方案

**Step 1**（`apps/api/src/db/queries/crawlerTimeline.ts`）：
- `CrawlerTimelineRange` 类型扩 8 选项：`'5m' | '30m' | '1h' | '2h' | '6h' | '12h' | '24h' | '7d'`
- `RANGE_TO_MS` 加 `'5m': 5 * 60_000`
- `getCrawlerTimeline` 默认 `range = '5m'`（从 '1h' 改）

**Step 2**（`apps/api/src/routes/admin/crawlerDashboard.ts`）：
- timeline route zod `range: z.enum(['5m','30m','1h','2h','6h','12h','24h','7d']).default('5m')`

**Step 3**（单测扩展）：
- `tests/unit/api/crawlerTimeline.test.ts` 加 1 case：默认 range='5m' + RANGE_TO_MS['5m'] = 5 分钟
- `tests/unit/api/crawler-dashboard-audit.test.ts` 适配（5m 接受 / 1y 仍 422）

### 涉及文件

- `apps/api/src/db/queries/crawlerTimeline.ts`（Step 1）
- `apps/api/src/routes/admin/crawlerDashboard.ts`（Step 2）
- `tests/unit/api/crawlerTimeline.test.ts`（Step 3a）
- `tests/unit/api/crawler-dashboard-audit.test.ts`（Step 3b 适配）

PATCH 文件数：2 源 + 2 测试 = 4 项（≤ 5 硬约束 ✅）

### 不在范围（→ HOTFIX-F）

- 前端 `CrawlerTimelineRange` 类型同步 + RANGE_OPTIONS 加 5m + 默认改 5m → HOTFIX-F
- KpiRow + OVERVIEW_ROW 布局水平滚动改造 → HOTFIX-F

---

## 下次会话恢复入口

HOTFIX-E 完成后启 HOTFIX-F（前端 range 5m + 布局水平滚动）。
