# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-REDESIGN-A-EP-3a — D-155-3 后端 Gantt 三段窗 + range 扩展 + JS clamp 双字段

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 06:30
- **实际开始**：2026-05-26 06:30
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 D-155-3（🟢 Accepted）+ ADR-122 §timeline 端点契约 AMENDMENT + ADR-153 §pending clamp + range 自治 AMENDMENT
- **拆分理由**：原 EP-3 范围 4 源 + 2 测试 = 6 项超 PATCH ≤ 5。本卡仅做后端 SQL + range + JS clamp；前端 now-line + 拖拽 pan 拆到 EP-3b。

### 问题理解

ADR-153 D-153-4 GREATEST 钳值把 pending bar 强制 clamp 到窗口左端，破坏 Gantt 图核心语义（pending 应显示在 scheduled_at 真实位置）；时间窗 `[NOW-range, NOW]` 单段窗 + 当前时间在最右端，无法回看历史 + 不支持显示 30% 未来 buffer。

### 根因判断

ADR-153 §5 实施时 GREATEST clamp 是性能优化（减少 JS 端 clamp 计算），但破坏 durationSeconds 业务语义（实际持续时间被 clamp 到窗口长度）。range 选项 30m/1h/2h/6h 不覆盖"看 24h 历史"等真实需求。

### 方案

**Step 1（`apps/api/src/db/queries/crawlerTimeline.ts`）**：

- `CrawlerTimelineRange` 类型扩展：`'30m' | '1h' | '2h' | '6h' | '12h' | '24h' | '7d'`
- `RANGE_TO_MS` 加 12h / 24h / 7d
- **rangeStart/rangeEnd 三段窗**：`rangeStart = NOW - rangeMs × 0.7` + `rangeEnd = NOW + rangeMs × 0.3`
- **SQL interval 改用 rangeMs × 0.7 秒**：精确取过去 0.7×range 数据（不浪费 SQL bandwidth）
- **SQL SELECT 移除 D-153-4 GREATEST 钳值**：`GREATEST(COALESCE(...), NOW()-interval) AS started_at` → `COALESCE(rt.started_at, rt.scheduled_at) AS started_at`（保留真实值）
- **R-155-2 JS clamp 双字段重构**（`rowToTimelineRow`）：
  - `durationSeconds = (realEnd - realStart) / 1000`（真实业务值 / hover tooltip 显示）
  - `visStart = Math.max(realStart, rangeStartMs)` + `visEnd = Math.min(realEnd, rangeEndMs)`（可视化 clamp）
  - `startPct / widthPct` 基于 visStart/visEnd 计算（不再溢出）

**Step 2（`apps/api/src/routes/admin/crawlerDashboard.ts`）**：
- timeline route zod `range: z.enum(['30m','1h','2h','6h','12h','24h','7d']).default('1h')`

**Step 3（单测扩展）**（`tests/unit/api/crawlerTimeline.test.ts`）：
- 加 5 case：
  - #EP3a-1 三段窗：rangeStart/rangeEnd 70/30 切分（rangeEnd > NOW）
  - #EP3a-2 range 12h/24h/7d 接受
  - #EP3a-3 R-155-2 双字段：durationSeconds 真实值 vs startPct/widthPct 可视化
  - #EP3a-4 移除 GREATEST：SQL 不再含 `GREATEST(COALESCE(`
  - #EP3a-5 pending bar 真位：scheduled_at 远早于窗口时 durationSeconds 仍真实，widthPct 被 clamp 到可视部分

**Step 4（AMENDMENT 落盘）**：
- ADR-122 §timeline 端点契约 AMENDMENT（70/30 三段窗 + range 扩展）
- ADR-153 §D-153-4 pending clamp AMENDMENT（移除 GREATEST + JS 双字段 clamp）

### 涉及文件

- `apps/api/src/db/queries/crawlerTimeline.ts`（Step 1 三段窗 + JS clamp）
- `apps/api/src/routes/admin/crawlerDashboard.ts`（Step 2 zod enum 扩展）
- `tests/unit/api/crawlerTimeline.test.ts`（Step 3 扩 5 case）
- `docs/decisions.md`（Step 4 ADR-122 + ADR-153 双 AMENDMENT；不计 PATCH）

PATCH 文件数：2 源 + 1 测试 = 3 项（≤ 5 硬约束 ✅）

### 验收要点

- pending task SQL 返回 scheduled_at 真实值 + JS durationSeconds 真实计算
- 现有 22 测试不破坏（statusToCategory 4 态 + multi-lane + N+1 + SQL CTE 结构等）
- typecheck / lint / test / verify:adr-contracts 全过

### 不在范围（→ EP-3b）

- 前端 CrawlerTimelineCard now-line / 拖拽 pan / range select 4→7 选项 → EP-3b
- CrawlerTimelineRange 前端类型扩展 → EP-3b
- 前端 lib api.ts 同步 → EP-3b

---

## 下次会话恢复入口

EP-3a 完成后启 EP-3b（前端 now-line + 拖拽 pan 实施 / W3-FIX 最后一卡）。
