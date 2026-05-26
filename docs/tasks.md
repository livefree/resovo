# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-REDESIGN-A-EP-1C-1b — D-155-6 zod preprocess + scheduler checkDaily/marks/GC

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 05:00
- **实际开始**：2026-05-26 05:00
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 D-155-6（🟢 Accepted）+ ADR-154 §D-154-1 AMENDMENT 落盘

### 问题理解

EP-1C-1a 已打开多 dailyTime 向后兼容窗口；本卡完成消费侧：
1. R-155-6 zod preprocess 兼容旧 `{dailyTime}` POST schema（前后端部署顺序无关性）
2. R-155-2' scheduler `checkDaily` 改"任一 dailyTime 匹配 + marks[date#HH:MM] 防重"
3. Y-155-2 marks JSONB GC 7 天前 keys

### 根因判断

EP-1C-1a 后 zod schema 仍要求 `dailyTime` 必填，新前端只传 `dailyTimes` 会 422；scheduler 仍用旧 `lastTriggerDate` 天级防重，多 dailyTime 时无法各自触发。

### 方案

**Step 1**（`apps/api/src/routes/admin/crawler.ts` zod schema）：
- `dailyTime: z.string().regex(...).optional()` + `dailyTimes: z.array(z.string().regex(...)).min(1).max(24).optional()`
- `.refine(data => data.dailyTime || data.dailyTimes, '需提供 dailyTime 或 dailyTimes')`
- `.transform(data => ({ ...data, dailyTime: data.dailyTime ?? data.dailyTimes![0], dailyTimes: data.dailyTimes ?? [data.dailyTime!] }))`
- 透传 `setAutoCrawlConfig`（已兼容 dailyTimes 主 + dailyTime alias）

**Step 2**（`apps/api/src/workers/crawlerScheduler.ts`）：
- 新 `getLastTriggerMarks(): Promise<Record<string, string>>`（读 `auto_crawl_last_trigger_marks` JSONB / 解析失败 / 缺键 → `{}`）
- 新 `gcOldMarks(marks, now, retentionDays=7)`（key 格式 `'YYYY-MM-DD HH:MM'`，过滤 datePart < cutoff 的项）
- `checkDaily` 重构：
  - 签名 `(config: Pick<AutoCrawlConfig, 'dailyTimes' | 'dailyTime'>, now: Date, marks: Record<string, string>): { shouldTrigger: boolean; matchedTime: string | null }`
  - 兜底 `times = config.dailyTimes && config.dailyTimes.length > 0 ? config.dailyTimes : [config.dailyTime || '03:00']`
  - 当前 HH:MM 在 times 中 + `marks[today#HH:MM]` 不存在 → `{ shouldTrigger: true, matchedTime: currentTime }`
- `runSchedulerTick` daily 分支重构：先 `marks = await getLastTriggerMarks()`，传 `checkDaily`；触发后 `marks = gcOldMarks({ ...marks, [today#matchedTime]: isoTs }, now)` 写 JSON.stringify(marks) 到 KV
- `persistTriggerMark` daily 分支不再写旧 `auto_crawl_last_trigger_date`（scheduler 内部用 marks）

**Step 3**（`tests/unit/api/crawlerScheduler.test.ts`）：
- 改 #5/#6/#7 现有 case 适配新 API（dailyTimes + marks + 返回 object）
- 加 case：多 dailyTime 任一匹配 / 同 dailyTime 同日防重 / 同日不同 dailyTime 各触发一次 / GC 7 天前 keys

**Step 4（ADR-154 AMENDMENT 落盘 / ADR-155 §8 第 2 条）**：`docs/decisions.md` ADR-154 §D-154-1 §结尾追加 AMENDMENT 块

### 涉及文件

- `apps/api/src/routes/admin/crawler.ts`（Step 1 zod preprocess）
- `apps/api/src/workers/crawlerScheduler.ts`（Step 2 checkDaily/marks/GC）
- `tests/unit/api/crawlerScheduler.test.ts`（Step 3 改 + 扩 case）
- `docs/decisions.md`（Step 4 ADR-154 AMENDMENT；不计 PATCH）

PATCH 文件数：2 源 + 1 测试 = 3 项（≤ 5 硬约束 ✅）

### 验收要点

- 旧前端 POST `{dailyTime: "03:00"}` 仍 422-free 接受（preprocess 转 dailyTimes）
- 新前端 POST `{dailyTimes: ["03:00","04:00"]}` 接受
- scheduler tick 内 3am 触发 + marks 写入 + 4am 再次触发（同日不同时间各一次）
- 同一时间同日重复 tick 不重触（marks 防重）
- 7 天前 marks 自动清理（GC）
- typecheck / lint / test / verify:adr-contracts 全过

### 不在范围（→ EP-1C-2）

- 前端 SchedulerConfigDrawer chip 列表 UI → EP-1C-2
- AutoCrawlSummaryCard / AutoCrawlScheduleCard 多时间显示 → EP-1C-2
- `dailyTimes` 类型从 optional 改回 required → EP-1C-2 完成后清理

---

## 下次会话恢复入口

EP-1C-1b 完成后启 EP-1C-2（前端 chip UI）。
