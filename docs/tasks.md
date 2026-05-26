# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-HOTFIX-A — W1/W2 三处 P0 + 1 处布局修补

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 02:00
- **实际开始**：2026-05-26 02:00
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续，opus 主循环排查后直接落地纯修补）
- **关联 ADR**：无（纯修补，3 个 P0 + 1 处布局，无新决策；ADR-155 在 REDESIGN-A 中起草）

### 问题理解（开发前必填 — quality-gates）

W1/W2 用户走读暴露 4 类缺陷，本卡只处理 3 个 P0 阻塞 + 1 处布局修补，不动设计层：

1. **P0**：`apps/api/src/db/queries/crawlerRuns.ts:362` `RETURNING r.site_key` 引用 `crawler_runs` 不存在的列（commit `d2728a30` ADR-146 webhook 引入），导致 `syncRunStatusFromTasks` 抛 `column r.site_key does not exist` → GET `/runs/:id`、POST `/runs/:id/cancel|pause|resume`、task cancel 全部 500 → 用户感知 "取消失败 / 暂停失败 / 批次加载失败" toast。
2. **P0**：`apps/api/src/db/queries/crawlerTimeline.ts:97` WHERE 用 `scheduled_at >= NOW() - $1::interval` 把"早于窗口左端 scheduled、但在窗口内 finished"的 task 全砍掉 + status 白名单缺 `'pending'`，导致刷新后任务"消失"。
3. **P0**：`packages/design-tokens/src/admin-layout/z-index.ts` `z-admin-dropdown: 980` < `z-modal: 1000`，Drawer 内所有 AdminSelect popover 被遮挡 → 用户感知 "下拉菜单不可用 / 仅有每日"。
4. **布局**：`apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx` PILL_BASE_STYLE 缺 `whiteSpace: 'nowrap'`，actions 区域宽紧张时"实时"两字 break 为两行。

### 根因判断

- Bug 1/2/3 共因：W1/W2 主循环只跑 mock 单测，没在 dev server 实测；ADR-149 §7 "用户走读 ≥ 1 次 + dev server 实测硬前置"被绕过。
- Bug 1 子因：webhook payload 需要 `siteKey`，但 run 维度没有单一 siteKey，应该用子查询从 crawler_tasks 取首个 task 的 site_key 而非直接列引用。
- Bug 2 子因：ADR-153 §5 决策"pending 起点 GREATEST(COALESCE(started_at, scheduled_at), ...)"明确要含 pending，但实施时 WHERE status 白名单漏了 `'pending'`，且 WHERE 字段选择 `scheduled_at` 与 ADR §"显示窗口内有可见时段的 task"语义不符。
- Bug 3 子因：z-index 命名空间分层时（packages/design-tokens 注释 "L1 业务 1000 / L2 Shell 1100"）把 `z-admin-dropdown=980` 放在了"业务原语下方"，未考虑 AdminSelect 与 Drawer 是同层但 popover 必须高于 Drawer panel。
- Bug 4 子因：pill 样式直接复用 PILL_BASE_STYLE，未为 actions 容器内可被压缩的 chip 显式声明 nowrap。

### 方案

**Step 1（CW1-B P0）**：`apps/api/src/db/queries/crawlerRuns.ts:362` SQL `RETURNING r.status, r.site_key, r.summary` → 改为子查询取首个 task 的 site_key：
```sql
RETURNING r.status,
  (SELECT site_key FROM crawler_tasks WHERE run_id = r.id ORDER BY scheduled_at ASC LIMIT 1) AS site_key,
  r.summary
```
保留 `SyncRunStatusResult.siteKey: string | null` 类型语义（worker webhook payload 不变）。

**Step 2（CW2-B 数据 P0）**：`apps/api/src/db/queries/crawlerTimeline.ts:97` WHERE 改为：
```sql
WHERE ct.type IN ('full-crawl', 'incremental-crawl')
  AND COALESCE(ct.finished_at, NOW()) >= NOW() - $1::interval
  AND ct.status IN ('pending', 'running', 'done', 'failed', 'paused', 'cancelled', 'timeout')
```
（status 加 `'pending'` 对齐 ADR-153 §5；filter 字段改用 `COALESCE(finished_at, NOW())` 包含"窗口内有可见时段的 task"）。

**Step 3（CW2-C P0）**：`packages/design-tokens/src/admin-layout/z-index.ts` `'z-admin-dropdown': 980` → `1050`。在文件 JSDoc 中加偏离备忘：`原 980 设计意在"业务层 dropdown 略低于 modal"，但 AdminSelect popover 在 Drawer (1000) 内 portal 渲染时会被遮挡；调整为 1050 介于 z-modal (1000) 与 z-shell-drawer (1100) 之间，确保 Drawer 内 dropdown 可见的同时不破坏 Shell 抽屉的最高层级。`

**Step 4（CW2-B 布局）**：`PILL_BASE_STYLE` 加 `whiteSpace: 'nowrap'`。

### 涉及文件

- `apps/api/src/db/queries/crawlerRuns.ts`（Step 1）
- `apps/api/src/db/queries/crawlerTimeline.ts`（Step 2）
- `packages/design-tokens/src/admin-layout/z-index.ts`（Step 3）
- `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（Step 4）
- `tests/unit/api/crawlerRuns.test.ts`（扩展 / 新建：siteKey 取首 task 非空 case + run 无 tasks 时 siteKey 为 null case）
- `tests/unit/api/crawlerTimeline.test.ts`（扩展 2 case：pending task 在窗口内可见 + 早于左端 scheduled 但 finished 在窗口内的 task 可见）

### 验收要点

- **必须 dev server 实测**（W1/W2 漏检根因）：
  1. `/admin/crawler/runs` 任意行点 [暂停] → toast "已暂停" 成功
  2. `/admin/crawler/runs` 任意行点 [取消] → toast "已请求取消" 成功
  3. 点 run id → 跳转 `/admin/crawler/runs/[id]` → meta + tasks 正常渲染（不再 "批次加载失败"）
  4. `/admin/crawler` 时间轴：制造一个 pending 状态 task → 可见 bar；制造一个 finished_at < 1h 但 scheduled_at > 1h 的 task → 1h 窗口可见 bar
  5. `/admin/crawler` 打开 SchedulerConfigDrawer → scheduleType / defaultMode / conflictPolicy 三 select 可正常展开选项
  6. 时间轴卡 "实时" pill 单行显示，不被压两行
- typecheck / lint / test / verify:adr-contracts 全过
- 新增 4 单测全过

### 不在范围（→ REDESIGN-A）

- CW1-B run 行内展开（D-155-1 / EP-1）
- CW1-E topbar 合并到 AdminShell notifications/tasks（D-155-2 / EP-2）
- CW2-B Gantt 三段窗 + now-line + pending 真位 + 12h/24h/7d range（D-155-3 / EP-3）
- CW2-B 站点 limit 解锁（D-155-4 / EP-1）

---

## 下次会话恢复入口

（HOTFIX-A 完成后启 REDESIGN-A-ADR；见 task-queue.md SEQ-20260526-CRAWLER-W3-FIX）
