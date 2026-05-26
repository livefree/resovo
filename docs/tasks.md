# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-REDESIGN-A-EP-2 — D-155-2 Topbar 图标合并（强制 Opus reviewer）

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 06:10
- **实际开始**：2026-05-26 06:10
- **建议模型**：opus 主循环 + **强制 arch-reviewer (claude-opus-4-7)** 评审（CLAUDE.md "共享组件 API 契约强制 Opus" / W1 N1-152-A process 红线复发监测）
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 D-155-2（🟢 Accepted）+ ADR-152 §端点契约 + §N1-152-A 路径决策 AMENDMENT 落盘

### 问题理解

CW1-E（ADR-152）实施时主循环采用 N1-152-A `position:fixed` 旁路方案规避 "共享组件 API 契约强制 Opus" 约束 — BackgroundEventBell 作为第 3 个 topbar 图标叠加，违反 AdminShell `notifications + tasks` 二图标范式。

### 根因判断

W1 期间为避免 Opus reviewer 流程，主循环刻意规避 packages/admin-ui types.ts 修改；走读暴露后 ADR-155 D-155-2 决策"删除旁路方案 + 扩展 NotificationItem discriminated union 双源同步"。

### 方案

**Step 1（双源类型扩展 / R-155-1 必修）**：
- `packages/admin-ui/src/shell/types.ts`：
  - `NotificationItem` 加 `category?: 'general' | 'background'`（discriminated union 友好 / 向后兼容默认 'general'）
  - `TaskItem` 加 `source?: 'crawler' | 'maintenance' | 'general'`
- `packages/types/src/admin-shell.types.ts`（**双源镜像 / R-155-1 关键约束**）：同步加 category + source 字段；与 admin-ui SSOT 严格对齐

**Step 2（前端 hook 合并 / Y-155-3 路径 A：并发两 GET）**：
- `apps/server-next/src/lib/admin-shell-notifications.ts`：
  - `useAdminNotifications` 并发 GET `/admin/notifications` + `/admin/system/background-events`
  - 主端点 items category='general'；background events `upcoming` + `finished` lane 映射为 NotificationItem + category='background'
  - 合并后按 createdAt DESC 排序
  - 注册到 `globalMutateRegistry`（让 CrawlerClient `invalidateBackgroundEvents()` 触发 reload）
- `useAdminTasks` 并发 GET `/admin/system/jobs` + background events `active` lane
  - active lane → TaskItem + source='crawler'

**Step 3（admin-shell-background-events.ts 瘦身）**：
- 删除 `useAdminBackgroundEvents` hook 导出
- 保留 `invalidateBackgroundEvents` + `globalMutateRegistry`（CrawlerClient 仍消费 Y-152-4 mutate invalidate）

**Step 4（admin-shell-client 清理）**：
- `apps/server-next/src/app/admin/admin-shell-client.tsx`：
  - 删除 `<BackgroundEventBell>` 渲染
  - 删除 `useAdminBackgroundEvents` import + 调用
  - 保留 `useAdminNotifications` + `useAdminTasks`（数据已合并）

**Step 5（删除文件）**：
- `apps/server-next/src/components/admin-shell/BackgroundEventBell.tsx`
- `tests/unit/components/server-next/admin/admin-shell/BackgroundEventBell.test.tsx`

**Step 6（单测扩展）**：
- `tests/unit/lib/admin-shell-notifications.test.ts`：扩 category='background' merge case + globalMutateRegistry 注册 case

**Step 7（ADR-152 AMENDMENT 落盘）**：`docs/decisions.md` ADR-152 §N1-152-A path 后追加 AMENDMENT 块（撤销旁路方案 + 双源镜像同步路径声明）

**Step 8（arch-reviewer Opus 评审）**：spawn `arch-reviewer` subagent，model `opus`，独立评审：
- 双源镜像同步完整性（packages/admin-ui + packages/types 字段一致）
- BackgroundEvent → NotificationItem/TaskItem 映射的语义正确性（lane → category/source）
- `invalidateBackgroundEvents` 兼容性（CrawlerClient 调用方零改动）
- 是否有遗漏的消费方（grep）
- ADR-152 AMENDMENT 描述准确性

### 涉及文件

- `packages/admin-ui/src/shell/types.ts`（NotificationItem + TaskItem 扩展 / **强制 Opus 评审**）
- `packages/types/src/admin-shell.types.ts`（**双源镜像 R-155-1 必修**）
- `apps/server-next/src/lib/admin-shell-notifications.ts`（并发两 GET + merge + register）
- `apps/server-next/src/lib/admin-shell-background-events.ts`（删 hook / 保留 invalidate）
- `apps/server-next/src/app/admin/admin-shell-client.tsx`（删 BackgroundEventBell 引用）
- **删除**：`apps/server-next/src/components/admin-shell/BackgroundEventBell.tsx`
- **删除**：`tests/unit/components/server-next/admin/admin-shell/BackgroundEventBell.test.tsx`
- `tests/unit/lib/admin-shell-notifications.test.ts`（扩 category 合并 case）
- `docs/decisions.md`（ADR-152 AMENDMENT；不计 PATCH）

PATCH 文件数：5 改 + 2 删 + 1 测试 = 8 项（ADR-155 §5 临界 / **强制 Opus reviewer 弥补**）

### 验收要点

- **dev server 实测**（@livefree / ADR-155 §8 验收第 4 条）：
  1. `/admin` 顶部仅有铃铛 + 闪电两图标（BackgroundEventBell 消失）
  2. 点铃铛 → NotificationDrawer 含 background 来源（upcoming/finished lane → 通知项 category='background'）
  3. 点闪电 → TaskDrawer 含 crawler runs active lane source='crawler'
  4. CrawlerClient 写操作（立即采集）→ invalidateBackgroundEvents → 两 drawer 同步刷新
- typecheck / lint / test / verify:adr-contracts 全过
- arch-reviewer Opus 评级 ≥ A−
- **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)` + Reviewer 显式声明审查双源镜像同步

### 不在范围（→ ADR-156 候选 / 推迟）

- 后端端点合并（`/admin/notifications` 内嵌 background events）→ 起 ADR-156 后再做
- BackgroundEventService deprecated 注释 → ADR-156 落地后再加
- D-155-3 Gantt 三段窗 → EP-3

---

## 下次会话恢复入口

EP-2 完成后启 EP-3（D-155-3 Gantt 三段窗 + 拖拽 pan / 最后一卡）。
