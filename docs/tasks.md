# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-HOTFIX-D — scheduler daily 模式 catch-up window

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 05:40
- **实际开始**：2026-05-26 05:40
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 §7 风险"D-155-3 拖拽 pan 性能" 的范式延伸（catch-up 是健壮性补丁 / 不起新 ADR / 不改设计契约）

### 问题理解

@livefree 走读发现：scheduler daily 模式 `checkDaily` 精确匹配当前 HH:MM，server 在 dailyTime 那一分钟未运行（部署 / 重启 / 慢启动）→ 该次 daily 触发**永久错过**，直到次日同时间。interval 模式有 due-based catch-up 不受影响；本卡只补 daily 容错。

### 根因判断

ADR-155 D-155-6 EP-1C-1b 沿用 ADR-154 D-154-5 §checkDaily 的"分钟精确匹配"判定。该判定假设 server 永远在线（不切实际）。

### 方案

**Step 1**（`apps/api/src/workers/crawlerScheduler.ts`）：

`checkDaily` 重构为 catch-up window 判定（marks 防重保证不重触）：

```ts
const CATCH_UP_WINDOW_MIN = 5  // catch-up 容错窗口（分钟）

export function checkDaily(...): { shouldTrigger, matchedTime } {
  const times = ...  // 兜底逻辑不变
  const today = formatDateStr(now)

  // 遍历 dailyTimes，找过去 CATCH_UP_WINDOW_MIN 分钟内最近一个未触发
  for (const time of times) {
    const [h, m] = time.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue

    // 该 dailyTime 今天的目标时刻
    const target = new Date(now)
    target.setHours(h, m, 0, 0)

    const diffMs = now.getTime() - target.getTime()
    if (diffMs < 0 || diffMs > CATCH_UP_WINDOW_MIN * 60_000) continue  // 跳过未来 / 超窗口
    if (makeMarkKey(today, time) in marks) continue  // 防重

    return { shouldTrigger: true, matchedTime: time }
  }
  return { shouldTrigger: false, matchedTime: null }
}
```

**关键设计**：
- catch-up window = 5 分钟（4-5 次 tick 容错；可配常量）
- diffMs ≥ 0 → 不补未来；≤ 5min → 不补昨日错过（防跨午夜补昨天 23:59）
- marks 防重保证 catch-up 期间多次 tick 仍只触发一次
- 遍历顺序按 times 数组顺序（与 UI chip 列表顺序一致）

**Step 2**（`tests/unit/api/crawlerScheduler.test.ts`）：
- 改 #6 期望（03:01 触发 → catch-up 内匹配 / matchedTime='03:00'）
- 新增 catch-up 5 case：
  - #8a diffMs=0（精确匹配）→ 触发
  - #8b diffMs=60s（1 分钟内 catch-up）→ 触发
  - #8c diffMs=300s（5 分钟边界）→ 触发
  - #8d diffMs=301s（超 5 分钟边界）→ 不触发
  - #8e diffMs<0（未来）→ 不触发

### 涉及文件

- `apps/api/src/workers/crawlerScheduler.ts`（Step 1 catch-up window）
- `tests/unit/api/crawlerScheduler.test.ts`（Step 2 改 1 + 扩 5 case）

PATCH 文件数：1 源 + 1 测试 = 2 项（≤ 5 硬约束 ✅）

### 验收要点

- **dev server 实测**（@livefree）：
  1. dailyTimes=["03:00"]，server 在 03:02 启动 → 立即 catch-up 触发（log 含 matched_time=03:00）
  2. dailyTimes=["03:00"]，server 在 03:06 启动 → 不触发（超窗口）
  3. dailyTimes=["03:00","04:00"]，server 在 03:01 启动 → 仅触发 03:00；04:00 那一分钟到达再触发 04:00
  4. server 在 03:00 正常运行 → 触发 03:00；同分钟下次 tick 不重触（marks 防重）
- typecheck / lint / test / verify:adr-contracts 全过
- 新增 5 case 全过

### 不在范围

- 启动时 missed-fire 扫描（方案 B）→ 推迟到 catch-up window 实测后视情况评估
- 错过 30min+ 的 dailyTime 报警通知（方案 C）→ 推迟（用户期望先简单方案）
- interval 模式（已 catch-up）→ 不动

---

## 下次会话恢复入口

HOTFIX-D 完成后回到 EP-2（D-155-2 topbar 图标合并 / 强制 Opus reviewer）。
