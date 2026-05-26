# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-REDESIGN-A-EP-1C-1a — D-155-6 类型契约 + KV 3 路径兼容

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 04:55
- **实际开始**：2026-05-26 04:55
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 D-155-6（🟢 Accepted）；ADR-154 §D-154-1 AMENDMENT 推迟到 EP-1C-1b 同 commit 落盘
- **拆分理由**：原 EP-1C-1 范围 5 源 + 2 测试 = 7 项触发 PATCH ≤ 5 硬约束。本卡仅做"类型契约 + KV 兼容性"层（向后兼容窗口已打开），zod preprocess + scheduler checkDaily/marks/GC + ADR-154 AMENDMENT 拆到 EP-1C-1b。

### 问题理解

ADR-155 D-155-6：当前 `AutoCrawlConfig.dailyTime: string` 单一时间不允许 "3am + 4am" 多时间触发。需扩为 `dailyTimes: string[]`，且后端 KV 必须兼容 3 种历史值（旧单字符串 / JSON 字符串 / JSON 数组）。

### 根因判断

ADR-154 D-154-1 选 `daily | interval` 两态时单 dailyTime 是合理简化，但用户走读暴露多时间需求（@livefree 设 3am + 4am 期望两者都生效，实际只剩第二个）。

### 方案

**Step 1**（`packages/types/src/system.types.ts`）：
- `AutoCrawlConfig` 加 `dailyTimes: readonly string[]`（主字段；min 1 max 24）
- `dailyTime: string` 标 `@deprecated`（向后兼容 alias = `dailyTimes[0]` ?? `'03:00'`）；EP-1C-2 前端切换后可删
- `SystemSettingKey` 加 `'auto_crawl_last_trigger_marks'`（R-155-2' 防重维度升级 / EP-1C-1b 消费）

**Step 2**（`apps/api/src/db/migrations/076_auto_crawl_daily_times_array.sql` 新建）：
- KV seed `auto_crawl_last_trigger_marks = '{}'`（JSON object 容器，EP-1C-1b checkDaily 写入 `{date#HH:MM: isoTs}`）
- ROLLBACK 注释

**Step 3**（`apps/api/src/db/queries/systemSettings.ts`）：
- 新 `parseDailyTimes(input: string | undefined): readonly string[]` 函数 — R-155-3 3 路径完整覆盖：
  - 空 / undefined → `['03:00']` 兜底
  - JSON.parse 数组 → 过滤 HH:MM 合法项 + 兜底
  - JSON.parse 单字符串 → `[parsed]`（若合法 HH:MM）
  - 旧裸单字符串（非 JSON）→ `[raw.trim()]`（若合法 HH:MM）
  - 非法格式 → `['03:00']` 兜底
- `deserializeAutoCrawlConfig` 输出 `dailyTimes` 主字段 + `dailyTime = dailyTimes[0] ?? '03:00'` 兼容 alias
- `setAutoCrawlConfig` line 184 改为 `auto_crawl_daily_time: JSON.stringify(config.dailyTimes ?? [config.dailyTime || '03:00'])`（永远写 JSON 数组；兼容旧调用方仅传 dailyTime）

**Step 4**（单测）：
- `tests/unit/api/systemSettings.test.ts`（若不存在则新建）：
  - parseDailyTimes 5 case：①旧单字符串 ②JSON 单字符串 ③JSON 数组 ④空 ⑤非法
  - deserializeAutoCrawlConfig 输出 dailyTimes + dailyTime alias 一致性
  - setAutoCrawlConfig 写 JSON.stringify(dailyTimes) 验证

**Step 5**（architecture.md 同步 / Y-155-5 + CLAUDE.md 反面义务）：
- 在 system_settings 表章节追加 `auto_crawl_last_trigger_marks` 键（JSON object / R-155-2' 防重维度升级）

### 涉及文件

- `packages/types/src/system.types.ts`（Step 1）
- `apps/api/src/db/migrations/076_auto_crawl_daily_times_array.sql`（Step 2 新建）
- `apps/api/src/db/queries/systemSettings.ts`（Step 3）
- `tests/unit/api/systemSettings.test.ts`（Step 4 / 已存在则扩 / 否则新建）
- `docs/architecture.md`（Step 5 同步 / 不计入 PATCH 5 项）

PATCH 文件数：3 源 + 1 测试 = 4 项（≤ 5 硬约束 ✅）

### 验收要点

- 下游消费方（apps/server-next 前端、crawlerScheduler、admin auto-config route）**无需任何改动**即可继续工作（dailyTime alias 保证向后兼容）
- typecheck / lint / test / verify:adr-contracts 全过
- 新增单测 5 case 全过
- architecture.md 含 auto_crawl_last_trigger_marks 描述

### 不在范围（→ EP-1C-1b / EP-1C-2）

- zod preprocess 兼容旧 `{dailyTime}` POST schema（R-155-6）→ EP-1C-1b
- crawlerScheduler checkDaily 任一匹配 + marks 防重 + GC 7 天前 keys（Y-155-2）→ EP-1C-1b
- ADR-154 AMENDMENT 落盘 → EP-1C-1b 同 commit
- 前端 SchedulerConfigDrawer chip 列表 UI + AutoCrawlSummaryCard 多时间显示 → EP-1C-2

---

## 下次会话恢复入口

EP-1C-1a 完成后启 EP-1C-1b（zod + scheduler + ADR-154 AMENDMENT）。
