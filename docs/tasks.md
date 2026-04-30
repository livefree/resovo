# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-30
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

### CHG-DESIGN-07 7D — Browser/Visual 验收 + visual baseline 入库（SEQ-20260429-02 第 7 卡 · 阶段 4/4）

- **状态**：🔄 待启动（7A ✅ + 7B ✅ + 7C ✅）
- **关联序列**：SEQ-20260429-02
- **创建时间**：2026-04-30
- **建议主循环模型**：sonnet
- **实际主循环模型**：claude-opus-4-7（继承 session）

#### 7A / 7B / 7C 阶段累计产出（已落地）

7A（contract）✅：kpi-card.types.ts + spark.types.ts + index.ts；arch-reviewer (Opus) CONDITIONAL → 必修闭环；Codex stop-time 4 处契约矛盾闭环

7B（实装 + 单测）✅：kpi-card.tsx + spark.tsx + 55 case 单测；arch-reviewer (Opus) PASS 直接通过；Codex stop-time 2 处契约-实装一致性 fix（spark slot null 行为 + dataSource/ariaLabel jsdoc）

7C（5 类业务卡 + DashboardClient 重构 + 数据契约对齐）✅：
- 步骤 1：`apps/server-next/src/lib/videos/api.ts` ModerationStats 类型对齐后端真实契约（`pendingCount / todayReviewedCount / interceptRate`），grep 全仓迁移错误字段引用面（DashboardClient + videos.spec.ts mock）
- 步骤 2：`apps/server-next/src/lib/dashboard-data.ts`（DashboardStats 类型 + buildDashboardStats helper + deterministic mock + live/mock 混合派生）
- 步骤 3：5 类业务卡（AttentionCard / WorkflowCard / MetricKpiCardRow / RecentActivityCard / SiteHealthCard）
- 步骤 4：DashboardClient 重写（4 行布局 + page__head + 删 StatCard 占位）
- 步骤 5：unit smoke 11 case（`tests/unit/components/server-next/admin/dashboard/DashboardClient.test.tsx`，三 case 接口完整 / 字段缺失 / 接口失败）
- 步骤 6：e2e smoke 3 路径（`tests/e2e/admin/dashboard.spec.ts`，200 完整 / 200 部分 / 500）
- 步骤 7：grep 验证 `data-stat-card` / `import { StatCard }` 0 残留
- 步骤 8：质量门禁 typecheck / lint / verify:token-references (67/322) / 2678 单测全绿（+11 unit smoke）

#### 7D 阶段范围

按 reference §5.1 三行布局做 browser/visual 验收 + visual baseline 截图入库到 `tests/visual/dashboard/`。

#### 7D 推进顺序

1. **dev server 启动**：`npm run dev` 起 server-next（:3003）+ api（:4000）+ web-next
2. **Playwright MCP visual 对照** reference §5.1：
   - browser_navigate `http://localhost:3003/admin`
   - browser_snapshot 主视图
   - take_screenshot 三行布局：row1.png / row2.png / row3.png
   - take_screenshot 单卡片 close-up：attention-card.png / workflow-card.png / metric-kpi--{default,is-warn,is-ok,is-danger}.png / recent-activity-card.png / site-health-card.png
3. **visual baseline 入库**：截图保存到 `tests/visual/dashboard/`，按 `<row|card>--<state>.png` 命名规范化；git 提交作为后续 visual diff 基线
4. **e2e smoke 执行**：起 dev server 后跑 `npm run test:e2e -- dashboard.spec.ts`，确认 7C 步骤 6 e2e 实际通过
5. **9 项视觉对照清单逐行确认**（见 task-queue.md CHG-DESIGN-07 7C 节）：
   - [ ] page__head（问候式 title + 最后采集 sub + actions）
   - [ ] row1: grid 1.4fr/1fr gap 12 → AttentionCard + WorkflowCard
   - [ ] row2: grid repeat(4,1fr) gap 12 → 4 张 MetricKpiCard（不允许 auto-fill 折行）
   - [ ] row3: grid 1fr/1fr gap 12 → RecentActivityCard + SiteHealthCard
   - [ ] AttentionCard：head warn icon + sub「按优先级排序的当前异常」+ 右侧 xs btn「全部解决」+ 4 条 mock + border-subtle 分隔
   - [ ] WorkflowCard：head sparkle icon + sub + 4 段 progress（label/数值/6px bar，accent/warn/info/ok 配色）+ 底部 grid 1fr/1fr 「审核」+「批量发布」
   - [ ] MetricKpiCard：label 11px uppercase letter-spacing 1px + value 26px/700 tabular + delta 11px is-up/down + spark 60×18 opacity 0.4 右下 + is-warn/danger/ok 控制 border + value（不改整卡背景）
   - [ ] RecentActivityCard：每条 28×28 radius 6 bg3 + sev icon + strong who·what 12 + when 11 muted + 行间 border-subtle
   - [ ] SiteHealthCard：18×18 radius 4 health 数字（>80 ok / >50 warn / else danger）+ name 12/600 + type·format·last 11 muted + spark 60×18 + xs btn（开机=增量/关机=重启）+ 前 8 站
6. 任意 fail 项回 7C 修复后再走 7D

#### 7D 文件范围

- 新建：`tests/visual/dashboard/*.png`（≥ 8 张 PNG baseline）
- 修订：`docs/changelog.md` 7C/7D 任务条目（追加 baseline 路径列表 + 9 项对照表）
- 不写代码（7D 仅 visual 验收 + 基线入库）

#### 7D 不在范围

- visual diff CI 集成（留 follow-up `INFRA-VISUAL-DIFF-CI`）
- 编辑态（CardLibraryDrawer / FullscreenCard，§A4 决议后做）
- analytics tab 内容（CHG-DESIGN-09）

---
