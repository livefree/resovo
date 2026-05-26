# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-REDESIGN-A-EP-1C-2a — D-155-6 SchedulerConfigDrawer chip 列表

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 05:20
- **实际开始**：2026-05-26 05:20
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 D-155-6（🟢 Accepted）
- **拆分理由**：原 EP-1C-2 范围 5 源 + 3 测试 = 8 项超 PATCH ≤ 5。本卡仅做"前端类型同步 + SchedulerConfigDrawer chip UI"；AutoCrawlScheduleCard + SummaryCard 多时间显示拆到 EP-1C-2b。

### 问题理解

EP-1C-1b 后端 zod 已接受 `dailyTimes: string[]`，scheduler 已多时间触发。但前端 SchedulerConfigDrawer 仍是单 `dailyTime` input — 用户无法配置 3am + 4am 等多时间。

### 根因判断

CW2-C-EP-B 实施 SchedulerConfigDrawer 时单 dailyTime input 是 ADR-154 D-154-1 决策范围内的合理简化；D-155-6 用户走读后需要扩为 chip 列表 UI。

### 方案

**Step 1**（`apps/server-next/src/lib/crawler/api.ts`）：
- `AutoCrawlConfig` 加 `readonly dailyTimes?: readonly string[]`（与后端 `packages/types` 类型同步）
- `dailyTime` 标 `@deprecated` alias 注释（暂保留）

**Step 2**（`apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`）：
- daily 模式下 `dailyTime` 单 input → chip 列表 UI
  - state 内部用 `dailyTimes: string[]` 主字段
  - 渲染 chip 列表（每 chip = HH:MM + × 删除按钮）+ 时间输入框（按 Enter 或 [+] 按钮添加）
  - min 1（保留 1 项不可删）+ max 24（达到上限禁用 [+] 按钮）
  - 时间格式校验：HH:MM 正则 + 数值范围
  - 提交时 payload 含 dailyTimes（preferred）+ dailyTime alias = dailyTimes[0]（向后兼容 zod transform 旧路径）
- toast description 动态："每日 03:00, 04:00 · 模式 X"

**Step 3**（单测）：
- `tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx`：扩 case
  - daily 模式渲染 chip 列表（含初始 dailyTimes）
  - [+] 加 chip → state 加项 + chip 列表更新
  - chip × 删除 → state 减项
  - min 1 守卫（最后一个 chip × 按钮 disabled / hidden）
  - max 24 守卫（chip 数到 24 时 [+] disabled）
  - 提交 POST payload 含 dailyTimes 数组

### 涉及文件

- `apps/server-next/src/lib/crawler/api.ts`（Step 1 类型同步）
- `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`（Step 2 chip UI）
- `tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx`（Step 3 扩 case）

PATCH 文件数：2 源 + 1 测试 = 3 项（≤ 5 硬约束 ✅）

### 验收要点

- **dev server 实测**（@livefree）：
  1. `/admin/crawler` → 高级菜单 → 定时设置 Drawer 打开
  2. scheduleType=daily → 看到 chip 列表（初始 1 chip 示例 "03:00"）
  3. 输入 "04:00" + 点 [+] → chip 列表新增
  4. 点 chip × → 删除（最后一个 chip 不可删）
  5. 加到 24 个 chip → [+] 按钮 disabled
  6. 保存 → POST 含 dailyTimes 数组 → 后端 OK
  7. 重新打开 Drawer → 展示之前保存的所有 chip
- typecheck / lint / test / verify:adr-contracts 全过

### 不在范围（→ EP-1C-2b / EP-1C-CLEANUP）

- AutoCrawlScheduleCard + AutoCrawlSummaryCard 多时间显示 → EP-1C-2b
- dailyTimes 类型从 optional 改回 required + dailyTime 删除 → EP-1C-CLEANUP（在 EP-1C-2b 后落地）

---

## 下次会话恢复入口

EP-1C-2a 完成后启 EP-1C-2b（卡片多时间显示）。
