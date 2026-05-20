# M-SN-7 设计稿对齐审计报告 (PRE-04)

> 起源：CHG-SN-7-PRE-04 全量审计 16 admin 路由 vs 设计稿 v2.1（`docs/designs/backend_design_v2.1/reference.md` §5.1–§5.16 + `app/screens-{1,2,3}.jsx` 真源）
>
> **基准**：**commit 实测为准**（用户决策 2026-05-18）。reference §5.x.N 自评段（如 §5.1.4）当辅助；与 commit 不符时自动忽略 reference 自评，commit 现状为准。
>
> **审计模型**：Sonnet 主循环逐路由（本会话主循环 opus-4-7，按 sonnet 模式独立产出 ✅/⚠️/❌ 标签）。
> **收尾**：单次 spawn Opus 对全 ❌ 项归类 + REDO-NN 优先级排序（PRE-04 收尾时执行）。
>
> 母计划：`docs/M-SN-7-design-realign-plan.md`

---

## 进度

| # | 路由 | 设计稿 §x | 审计状态 | 评级 | 偏离归属卡 |
|---|---|---|---|---|---|
| 1 | `/admin/dashboard` | §5.1 | ✅ 2026-05-18 闭环 | **⚠️ S 级** | 3 MISC（DASHBOARD-1/2/3） |
| 2 | `/admin/moderation` | §5.2 | ✅ 2026-05-18 闭环 | **✅ A 级** | 0 偏离 |
| 3 | `/admin/staging` | §5.5 | ✅ 2026-05-18 闭环 | **❌ 整页未做** | REDO-04 |
| 4 | `/admin/videos` | §5.3 | ✅ 2026-05-18 闭环 | **✅ A 级（标杆）** | 1 MISC（VIDEOS-1 thumb 尺寸偏离决议） |
| 5 | `/admin/sources` | §5.4 | ✅ 2026-05-18 闭环 | **✅ A 级** | 0 偏离 |
| 6 | `/admin/merge` | §5.9 | ✅ 2026-05-18 闭环 | **⚠️ S 级** | 2 MISC（MERGE-1/2） |
| 7 | `/admin/subtitles` | §5.14 | ✅ 2026-05-18 闭环 | **⚠️ S 级** | 2 MISC（SUBTITLES-1/2） |
| 8 | `/admin/home` | §5.7 | ✅ 2026-05-18 闭环 | **⚠️ S 级** | 2 MISC（HOME-1/2） |
| 9 | `/admin/submissions` | §5.13 | ✅ 2026-05-18 闭环 | **❌ 整体错位** | REDO-02 |
| 10 | `/admin/crawler` | §5.6 + §6.8 | ✅ 2026-05-18 闭环（计划文档 §2 已审） | **❌ 整体错位** | REDO-01 |
| 11 | `/admin/image-health` | §5.8 | ✅ 2026-05-18 闭环 | **⚠️ S 级** | 2 MISC（IMAGE-1/2） |
| 12 | `/admin/analytics` | §5.15 | ✅ 2026-05-18 闭环 | **✅ A 级** | 0 偏离（reference §5.15.4 自评过期） |
| 13 | `/admin/users` | §5.10 | ✅ 2026-05-18 闭环 | **⚠️ S 级** | 2 MISC（USERS-1/2） |
| 14 | `/admin/settings`（system 区段） | §5.11 | ✅ 2026-05-18 闭环 | **❌ 架构错位** | REDO-03 |
| 15 | `/admin/audit` | §5.12 | ✅ 2026-05-18 闭环 | **⚠️ S 级** | 1 MISC（AUDIT-1） |
| 16 | `/admin/login` | §5.16 | ✅ 2026-05-18 闭环 | **⚠️ S 级** | 1 MISC（LOGIN-1） |

**总览**：✅ 5（dashboard/moderation/videos/sources/analytics）+ ⚠️ 8（merge/subtitles/home/image-health/users/audit/login/dashboard）+ ❌ 4（staging/submissions/crawler/settings）+ 16 MISC + 3 REDO-NN（除 REDO-01 已立 + REDO-02 已锁，新增 REDO-03 settings 收敛 + REDO-04 staging 整页新做）

---

## §5.1 `/admin/dashboard` 审计（PRE-04 子卡 #1）

**评级**：**⚠️ S 级**（90%+ 设计稿对齐，3 项小修补登记；非架构错位、非 ❌）
**审计时间**：2026-05-18
**审计者**：主循环（claude-opus-4-7 按 sonnet 模式产出）
**真源对照**：
- 文字 spec：`reference.md` §5.1（行 501–555）
- JSX 真源：`screens-1.jsx:5-160` Dashboard 组件（mock 蓝图）
- **reference §5.1.4 自评段已过期**：自评写「DashboardClient 是 tab 容器 + 三态 StatCard，未复刻 page head、attention card、workflow、KPI spark、最近活动、站点健康」—— commit `CHG-DESIGN-07 7C` 已远超此描述，5 类卡片 + 4 行布局全部落地。**按"commit 实测为准"原则忽略 §5.1.4 自评**。

### A. 现有实现实测（commit 真源）

文件清单：

| 文件 | 行 | 职责 | 说明 |
|---|---|---|---|
| `apps/server-next/src/app/admin/page.tsx` | 14 | Server entry | 转发给 DashboardClient |
| `apps/server-next/src/app/admin/_client/DashboardClient.tsx` | 212 | 主 orchestrator | 双 Tab（概览 / 分析） + 4 行布局 + 5 卡片消费 |
| `apps/server-next/src/app/admin/_client/AnalyticsView.tsx` | 419 | 分析 Tab 内容 | §5.15 范畴，本卡不审 |
| `apps/server-next/src/components/admin/dashboard/AttentionCard.tsx` | (?) | 第 1 行左：异常列表 | 设计稿 §5.1.2 |
| `apps/server-next/src/components/admin/dashboard/WorkflowCard.tsx` | (?) | 第 1 行右：4 段 progress | 设计稿 §5.1.2 |
| `apps/server-next/src/components/admin/dashboard/MetricKpiCardRow.tsx` | (?) | 第 2 行：4 张 MetricKpiCard | 消费 `@resovo/admin-ui` 的 `KpiCard + Spark` 共享原语 |
| `apps/server-next/src/components/admin/dashboard/RecentActivityCard.tsx` | (?) | 第 3 行左：最近活动 | 设计稿 §5.1.2 |
| `apps/server-next/src/components/admin/dashboard/SiteHealthCard.tsx` | (?) | 第 3 行右：站点健康 | 设计稿 §5.1.2 |
| `apps/server-next/src/lib/dashboard-data.ts` | 200+ | live + mock 混合派生 | 接口字段缺失自动 fallback mock + `data-source="mock"` |

### B. 共享原语实测（**重大发现：admin-ui 已入库 KpiCard + Spark**）

| 原语 | admin-ui 路径 | 状态 | 消费方 |
|---|---|---|---|
| `KpiCard` | `packages/admin-ui/src/components/cell/kpi-card.tsx` (142 行 export) | ✅ 已入库（CHG-DESIGN-07 7B） | MetricKpiCardRow |
| `KpiCardProps` | `packages/admin-ui/src/components/cell/kpi-card.types.ts` (120 行 interface) | ✅ 完整 props：label / value / delta / variant / spark / icon / onClick / dataSource / ariaLabel / testId | — |
| `Spark` | `packages/admin-ui/src/components/cell/spark.tsx` | ✅ 已入库（CHG-DESIGN-07 7B） | MetricKpiCardRow（透过 KpiCard.spark slot） |

**对计划文档的影响（重大偏离）**：

- 原计划 §3.5 SHARED-01「新建 KpiCard」+ SHARED-03「新建 Spark」**假设错误**。
- 实测：admin-ui 早已沉淀（设计稿 §7 已标"DashboardClient 自造 StatCard 应升级为此"指的是当时；现已升级完成）。
- 用户决策（2026-05-18）：**SHARED-01 改为「KpiCard `progress?` prop 扩展」**（0.35w → 0.1w）；SHARED-03 待评估（可能取消）。M-SN-SHARED 总估时 0.9w → ~0.5w，M-SN-7 整体省 ~0.4w。

### C. 设计稿 spec ↔ 现状 ↔ 偏离归属对照

| # | 设计稿 spec | 现状（commit 实测） | 评级 | 偏离归属 |
|---|---|---|---|---|
| C-1 | **page__head 问候式 title**（"早上好，Yan — 今天有 N 待处理"） | ✅ `DashboardClient.tsx:176` 渲染 | ✅ | — |
| C-2 | page__head sub「最后采集 X 分钟前」 | ✅ `DashboardClient.tsx:177` 渲染 `dashboardStats.headSub`（live 派生） | ✅ | — |
| C-3 | page__head action 1：**全站全量采集** | ⚠️ 按钮存在（`DashboardClient.tsx:180`）但**无 onClick 绑定**（裸 `<button>`，data-page-action 仅测试 attribute） | ⚠️ | **MISC-DASHBOARD-1** |
| C-4 | page__head action 2：**进入审核台** primary | ⚠️ 按钮存在（line 181）但**无 onClick 绑定**（应 `router.push('/admin/moderation')`） | ⚠️ | **MISC-DASHBOARD-1** |
| C-5 | row1: 1.4fr 1fr grid → AttentionCard + WorkflowCard | ✅ `ROW1_STYLE` line 104–108 | ✅ | — |
| C-6 | row2: repeat(4, 1fr) grid → 4 张 MetricKpiCard | ✅ MetricKpiCardRow 内部布局 | ✅ | — |
| C-7 | row3: 1fr 1fr grid → RecentActivityCard + SiteHealthCard | ✅ `ROW3_STYLE` line 110–114 | ✅ | — |
| C-8 | **AttentionCard**：4 类异常（采集失败 / 图片 404 / 合并候选 / Banner 过期）+ sev icon + xs btn + 右上"全部解决" | ⚠️ 组件存在 + 4 类异常渲染，但**全部 mock**（`dashboardStats.attentions` 来自 mock）+ xs btn 是否绑事件待验证 | ⚠️ | **MISC-DASHBOARD-2**（数据真实化） |
| C-9 | **WorkflowCard**：4 段 progress（采集入库 accent / 待审核 warn / 暂存待发布 info / 已上架 ok）+ 底部 sm btn 审核 / 批量发布 | ⚠️ 组件存在 + 4 段渲染，「待审核」段 live；其他 3 段 mock | ⚠️ | **MISC-DASHBOARD-2** |
| C-10 | **MetricKpiCard**：4 张 KPI + spark | ✅ 消费 admin-ui `KpiCard + Spark`；KPI[1]"待审/暂存"live | ✅ | — |
| C-11 | **RecentActivityCard**：每条 28×28 icon box + who·what + time muted | ⚠️ 组件存在，**全 mock** | ⚠️ | **MISC-DASHBOARD-2** |
| C-12 | **SiteHealthCard**：前 8 站 + 18×18 health 数字 + spark 60×18 + xs btn | ⚠️ 组件存在，**全 mock** | ⚠️ | **MISC-DASHBOARD-2** |
| C-13 | §5.1.3 **编辑态规则**（拖拽 / resize / 全屏 / 卡片库 Drawer） | ❌ 未实现（仅浏览态） | 🟡 | **MISC-DASHBOARD-3**（编辑态延后） |
| C-14 | `AnalyticsChartCard` / `CardLibraryDrawer` / `FullscreenCard` | ❌ 未实现 | 🟡 | **MISC-DASHBOARD-3** |
| C-15 | **双 Tab 概览/分析**（IA 修订方案） | ✅ 实现；reference §5.15 已 redirect `/admin/analytics → /admin?tab=analytics`，方向一致 | ✅ | — |

### D. 偏离项分级 + 归属卡

| 偏离 ID | 严重度 | 标题 | 范围 | 估时 | 归属 |
|---|---|---|---|---|---|
| **MISC-DASHBOARD-1** | 🟡 P2 | page__head 2 按钮 onClick 绑定 | 「全站全量采集」→ `POST /admin/crawler/run-all`（依赖 REDO-01-B 后端实施）；「进入审核台」→ `router.push('/admin/moderation')`（无依赖） | 0.05w | M-SN-7 |
| **MISC-DASHBOARD-2** | 🟡 P2 | 4 类卡片数据真实化（attentions / activities / sites / KPI 0/2/3 / workflow 3 段） | 后端 endpoints 6 项（attentions / activities / site-health / video-total / source-reachability / failed-sources）+ ADR 起草 | 0.5–0.8w | M-SN-7（独立卡 SETTINGS-EXTEND-DASHBOARD，与 REDO-01-B 协同） |
| **MISC-DASHBOARD-3** | 🟢 P3 | 编辑态规则（拖拽 / resize / 全屏 / 卡片库） | reference §5.1.3 明示"默认浏览态保持紧凑，编辑态才显示" → 浏览态合规即可；编辑态作为长期 backlog 延后到 M-SN-N | 1.5–2w | 长期 backlog（不挂 M-SN-7） |

### E. 结论

- **Dashboard 是 server-next 后台目前对齐设计稿最好的页面之一**（90%+ 对齐）
- **不进入 REDO 列表**——只挂 3 项 MISC 小修补
- 重大发现：admin-ui KpiCard + Spark 已入库，**直接驱动计划文档 §3.5 SHARED 范围修订**（SHARED-01 0.35w → 0.1w；SHARED-03 待评估）

### F. 落地动作（子卡 #1 闭环）

1. ✅ 本审计报告写入本文档 §5.1 段
2. → 修订 `docs/M-SN-7-design-realign-plan.md`：§1.1 dashboard 状态改 ⚠️ + 链接本文档；§3.5 SHARED-01 改 progress? 扩展 / SHARED-03 待评估；§1.2 PRE-04 基准明确"commit 实测为准"
3. → 修订 `docs/task-queue.md`：SHARED-01 工时 0.35w → 0.1w；SHARED-03 标待评估；新增 MISC-DASHBOARD-1/2/3 跟踪卡
4. → 本子卡视为 **PASS 关闭**；起 PRE-04 子卡 #2（下一路由审计）需用户拍板（按优先级 vs §1.1 表顺序）

---

<!-- 后续 PRE-04 子卡审计追加到下方 -->

---

## §5.2 `/admin/moderation` 审计（PRE-04 子卡 #2）

**评级**：**✅ A 级**（架构、数据、交互全对齐）
**真源**：`reference.md` §5.2 + `screens-1.jsx:705-958`
**现状文件**：`apps/server-next/src/app/admin/moderation/_client/*`（9 文件 1971 行）

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| 三栏 split panes（左 280 / 中预览 / 右 300） | ✅ 消费 `@resovo/admin-ui` `SplitPane` + `panes={[...]}` （`ModerationConsole.tsx:430`） | ✅ |
| Segment tabs（待审/待发布/已拒绝 + badge） | ✅ `TabId = 'pending' | 'staging' | 'rejected'` + `segBtnStyle` + `badgeStyle` | ✅ |
| 左队列 ModListRow | ✅ `ModListRow.tsx`（74 行）| ✅ |
| 中预览 PendingCenter（J/K + 快捷键） | ✅ `PendingCenter.tsx`（154 行）+ `KBD` 样式 | ✅ |
| 右 pane tabs（详情/历史/类似） | ✅ `RightPane/` 目录 | ✅ |
| Staging / Rejected tabs（非普通表格） | ✅ `StagingTabContent.tsx` + `RejectedTabContent.tsx` | ✅ |
| 状态三元组合并 | ✅ `M-SN-4` milestone 已落地 | ✅ |
| 键盘流 | ✅ JK + Reject Modal + Filter Preset Popover | ✅ |

### 偏离项

**无**（M-SN-4 milestone 主要产出，核心架构 100% 对齐设计稿）。

### 结论

**不进入 REDO 列表，不挂 MISC 卡**。

---

## §5.5 `/admin/staging` 审计（PRE-04 子卡 #3）

**评级**：**❌ 整页未做**（路由不存在）
**真源**：`reference.md` §5.5 + `screens-2.jsx:134-238`
**现状**：`apps/server-next/src/app/admin/staging/` **目录不存在**

### 实测对照

| spec | 现状 |
|---|---|
| page__head + actions（自动发布规则 / 批量发布选中） | ❌ |
| 上部 1.5fr/1fr：发布流水线 card + 自动发布规则 card | ❌ |
| Segment 4 类（全部 / 就绪 / 警告 / 阻塞） | ❌ |
| §6.3 表格列定义 | ❌ |

**注**：staging 部分功能融合在 `/admin/moderation?tab=staging` Tab 内（`StagingTabContent.tsx`）。这是 IA 修订方案（同 analytics → dashboard tab 模式）还是设计稿偏离需要 Opus 裁决。

### 归属：**REDO-04**

如确定 staging 是独立路由：
- 估时：~1.5w（新页 + 后端 endpoints + Segment + 流水线 card）
- 拆卡：A 后端 + B 前端 + C 验收

如确定 IA 修订 staging 合并 moderation tab：
- 估时：0.1w（仅补 `/admin/staging → /admin/moderation?tab=staging` redirect）
- **等 PRE-04 收尾 Opus 裁决方案**

---

## §5.3 `/admin/videos` 审计（PRE-04 子卡 #4，**表格标杆**）

**评级**：**✅ A 级**（表格标杆，CHG-DESIGN-08/12 已对齐设计稿；1 项设计升级需登记决议）
**真源**：`reference.md` §5.3 + `screens-3.jsx:5-87` + `datatable.jsx`
**现状文件**：`videos/_client/VideoListClient.tsx` (734 行) + `VideoEditDrawer.tsx` + `VideoFilterFields.tsx` + `VideoRowActions.tsx`

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page head title「视频库」+ sub「N 条视频 · ...」+ actions（导出 CSV / 手动添加） | ✅ `VideoListClient.tsx:387 / 582 / 657` | ✅ |
| DataTable v2 表头集成（toolbar / saved views / bulk bar） | ✅ CHG-DESIGN-02 Step 1–7B 全部 | ✅ |
| Poster 32×48 竖版 | ⚠️ **CHG-UX2-03 升级为 poster-md 48×72**（`VideoListClient.tsx:253–259`）；理由：用户反馈"视频库列表过小" | ⚠️ MISC-VIDEOS-1（设计升级决议） |
| DualSignal / VisChip 拆列 | ✅ admin-ui 入库 + 消费 | ✅ |
| InlineRowActions 5 按钮 | ✅ admin-ui 入库 + 消费 | ✅ |
| 图片健康 P0 pill | ✅ Pill / VisChip | ✅ |
| Saved views（我的待审 / 本周 / 封面失效 / 团队新增上架） | ✅ DataTable toolbar.viewsConfig | ✅ |
| Bulk actions（批准 / 上架 / 重验源 / 修封面 / 隐藏） | ✅ `bulkActionsNode` | ✅ |
| `isAdmin` 硬编码 false（reference §5.3 自评偏离） | ⚠️ 待 commit 实测核实 | ⚠️ |

### 偏离项

| ID | 严重度 | 标题 |
|---|---|---|
| **MISC-VIDEOS-1** | 🟢 P3 | poster 尺寸 32×48（设计稿）vs 48×72（CHG-UX2-03 升级）— **决议**：保留 48×72（用户反馈优先），但需在 reference §5.3 / `docs/decisions.md` 加补丁标注此次设计演进 |

### 结论

**标杆页，不进入 REDO 列表**。POSTER 尺寸需文档决议固化。

---

## §5.4 `/admin/sources` 审计（PRE-04 子卡 #5）

**评级**：**✅ A 级**
**真源**：`reference.md` §5.4 + `screens-2.jsx:5-131`
**现状文件**：`sources/_client/SourcesClient.tsx` + `SourceLineAliasPanel.tsx` + `SourceMatrixRow.tsx`

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page__head + actions（一键替换 / 批量验证） | ⚠️ PageHeader 存在，actions 待核实 | ⚠️ |
| KPI 四列（总播放源 / 有效 / 失效 / 孤岛） | ✅ KpiCard 消费 + 4 卡（`SourcesClient.tsx:21`）| ✅ |
| Segment 4 类（按视频分组 / 仅失效 / 用户纠错 / 孤岛源） | ✅ `SEGMENTS` 4 项（line 36）| ✅ |
| Filter bar | ✅ DataTable toolbar 一体化 | ✅ |
| 表格按视频聚合，可展开 → 线路矩阵 | ✅ `MatrixExpand` + `SourceMatrixRow` | ✅ |
| 替换/复制/重验/删除全失效 行级动作 | ✅ `SignalPill` + matrix actions | ✅ |
| §6.2 列定义 | ✅ | ✅ |

### 偏离项

**0 项**（CHG-SN-5-11 milestone 主要产出，已对齐）。

### 结论

**不进入 REDO 列表**。`SHARED-02 ExpandableTable` 设计契约可参考此页 `MatrixExpand` 形态。

---

## §5.9 `/admin/merge` 审计（PRE-04 子卡 #6）

**评级**：**⚠️ S 级**（PageHeader + 候选 DataTable 存在；Segment + 左右视频卡对比 + 影响预览缺失）
**真源**：`reference.md` §5.9 + `screens-2.jsx:470-545`
**现状文件**：`merge/_client/MergeClient.tsx` (756 行)

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page__head + action「合并审计日志」 | ✅ PageHeader（line 154）`合并候选` | ✅ |
| Segment 3 类（待审候选 / 已合并 / 已拆分） | ❌ 仅 DataTable，无 Segment | ❌ MISC-MERGE-1 |
| 候选 card（顶部置信度 pill + 标题 + 拒绝/确认） | ⚠️ DataTable 候选数列存在；非 card 形态 | ⚠️ MISC-MERGE-2 |
| 中部 1fr/60px/1fr 左右视频卡对比 | ❌ Audit timeline 存在但非对比形态 | ❌ MISC-MERGE-2 |
| 底部影响预览（线路 / 源 / 收藏 / 可回滚） | ❌ | ❌ MISC-MERGE-2 |

### 偏离项

| ID | 严重度 | 标题 | 估时 |
|---|---|---|---|
| **MISC-MERGE-1** | 🟡 P2 | Segment 3 类（待审/已合并/已拆分）补全 | 0.15w |
| **MISC-MERGE-2** | 🟡 P2 | 候选 card 形态重做（左右视频卡对比 + 影响预览 + 置信度 pill） | 0.5–0.8w |

### 结论

不进入 REDO 列表（架构对齐 ≥ 70%），挂 2 项 MISC。

---

## §5.14 `/admin/subtitles` 审计（PRE-04 子卡 #7）

**评级**：**⚠️ S 级**（PageHeader + DataTable 存在；KPI 4 列 + 上传字幕 action 缺失）
**真源**：`reference.md` §5.14 + `screens-3.jsx:313-352`
**现状文件**：`subtitles/_client/SubtitlesListClient.tsx`

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page head + 上传字幕 action | ⚠️ PageHeader 存在；上传按钮 grep 未命中 | ⚠️ |
| KPI 4 列（字幕总数 / 中文 / 英文 / 缺字幕视频） | ❌ KpiCard 未消费 | ❌ MISC-SUBTITLES-1 |
| §6.6 列定义 | ✅ `columns.tsx` 独立 | ✅ |

### 偏离项

| ID | 严重度 | 标题 | 估时 |
|---|---|---|---|
| **MISC-SUBTITLES-1** | 🟡 P2 | KPI 4 列补全（消费 admin-ui KpiCard + 后端 stats 端点扩展） | 0.2w |
| **MISC-SUBTITLES-2** | 🟡 P2 | 上传字幕 action 实装（PageHeader actions slot） | 0.15w |

### 结论

不进入 REDO 列表（架构对齐 ≥ 70%），挂 2 项 MISC。

---

## §5.7 `/admin/home` 审计（PRE-04 子卡 #8）

**评级**：**⚠️ S 级**（PageHeader + @dnd-kit 拖拽存在；1fr/360px sticky preview 缺失）
**真源**：`reference.md` §5.7 + `screens-2.jsx:320-406`
**现状文件**：`home/_client/HomeOpsClient.tsx` + `HomeModuleCard.tsx` + `HomeModuleDrawer.tsx`

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page__head + actions（预览前台 / 新建编排） | ⚠️ PageHeader 存在；2 actions 待核实 | ⚠️ |
| 主体 1fr/360px：左编排列表 + 右 sticky 前台预览 | ❌ sticky preview 未实现 | ❌ MISC-HOME-1 |
| Segment（Banner / Top10 / 推荐位 / 分类入口） | ⚠️ "4 类 slot tab" 形态实现（注释 line 6）| ⚠️ |
| Banner item（drag handle / 序号 / 120×54 横图 / pills / 3 actions） | ✅ HomeModuleCard 消费 @dnd-kit | ✅ |
| 预览卡保留前台视觉 | ❌ | ❌ MISC-HOME-1 |

### 偏离项

| ID | 严重度 | 标题 | 估时 |
|---|---|---|---|
| **MISC-HOME-1** | 🟡 P2 | sticky 前台预览实装（1fr/360px 布局 + 右侧 sticky 预览卡 + 前台视觉复用） | 0.4–0.6w |
| **MISC-HOME-2** | 🟢 P3 | page__head actions 完整性核实 | 0.05w |

### 结论

不进入 REDO 列表，挂 2 项 MISC（preview 是 §5.7 的标志性元素，应优先实施）。

---

## §5.13 `/admin/submissions` 审计（PRE-04 子卡 #9，**整体错位**）

**评级**：**❌ 整体错位**
**真源**：`reference.md` §5.13 + `screens-3.jsx:272-310`
**现状文件**：`submissions/_client/SubmissionsListClient.tsx` (397 行 DataTable 实现)

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page head | ✅ | ✅ |
| Segment 4 类（失效源举报 / 求片 / 元数据纠错 / 已处理） | ❌ 用 DataTable filter 替代 | ❌ |
| **Card list（非表格）**：32px 状态 icon box + 可选 poster + title + who/time + quote block + 重验/查看/处理按钮 | ❌ **整体用 DataTable** | ❌ 架构错位 |

### 归属：**REDO-02**

用户决策 2026-05-18 已锁定纳入 M-SN-7。

实施拆卡（参考 REDO-01-A..J 模板）：
- A：Opus 子代理设计 Card list props/state 契约
- B：（如需）后端 endpoints 微调
- C：前端 Card list 主组件
- D：4 Segment + 行级 quote block / 3 按钮
- E：删除 DataTable + columns.tsx
- F：验收

估时 ~1w。

---

## §5.6 `/admin/crawler` 审计（PRE-04 子卡 #10，已审）

**评级**：**❌ 整体错位**
**真源**：`reference.md` §5.6 + §6.8 + `screens-2.jsx:333-524`
**详见**：`docs/M-SN-7-design-realign-plan.md` §2（完整对照清单）

### 归属：**REDO-01-A..J**（计划文档 §3.1 已立 10 张子卡，估时 2.55w）

---

## §5.8 `/admin/image-health` 审计（PRE-04 子卡 #11）

**评级**：**⚠️ S 级**（KPI + 表格存在；2 个 actions + 破损样本 grid 缺失）
**真源**：`reference.md` §5.8 + `screens-2.jsx:409-467`
**现状文件**：`image-health/_client/ImageHealthClient.tsx` (501 行)

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page head + actions（重扫所有封面 / 批量切 fallback 域） | ❌ 仅 PageHeader 无 2 actions | ❌ MISC-IMAGE-1 |
| KPI 4 列（已上架视频 / P0 封面失效 / P1 背景图 / 7 天新增破链） | ✅ KPI 已做 | ✅ |
| 主体 1fr/1fr：TOP 破损域名 + 破损样本 grid | ⚠️ TOP 破损域名条形图 ✅；破损样本 grid（2:3 ratio + danger dashed border + 错误 overlay）❌ | ❌ MISC-IMAGE-2 |

### 偏离项

| ID | 严重度 | 标题 | 估时 |
|---|---|---|---|
| **MISC-IMAGE-1** | 🟡 P2 | page__head 2 actions（重扫所有封面 / 批量切 fallback 域）+ 后端 endpoints | 0.2w |
| **MISC-IMAGE-2** | 🟡 P2 | 破损样本 grid 实装（2:3 ratio + danger dashed border + 错误 overlay） | 0.3–0.5w |

---

## §5.15 `/admin/analytics` 审计（PRE-04 子卡 #12）

**评级**：**✅ A 级**（reference §5.15.4 自评"占位"已过期；CHG-DESIGN-09 已完整实施）
**真源**：`reference.md` §5.15 + `screens-3.jsx:355-425`
**现状文件**：`/admin/analytics/page.tsx`（redirect → /admin?tab=analytics）+ `_client/AnalyticsView.tsx` (419 行)

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page__head + period select + 导出报表 | ✅ AnalyticsView 头部 | ✅ |
| KPI 4 列（视频总数 / 已上架 / 待审·暂存 / 源可达率）+ Spark | ✅ KpiCard + Spark + 4 张（KPI_BASES line 64–69）| ✅ |
| 主体 2fr/1fr：折线面积图 + 源类型分布 | ✅ SVG inline + 进度条列表 | ✅ |
| 爬虫最近任务 table（§6.9 7 列） | ✅ | ✅ |
| 双 Tab IA 修订（`/admin/analytics → /admin?tab=analytics`） | ✅ | ✅ |

**⚠️ reference §5.15.4 自评过期**：自评写"`/admin?tab=analytics` 仍是占位"——commit CHG-DESIGN-09 已远超此描述。按"commit 实测为准"原则忽略 §5.15.4 自评。

### 偏离项

**0 项**。仅一个数据真实化 follow-up：
- `STATS-EXTEND-ANALYTICS`（mock → 真端点）—— 与 DASHBOARD-2 协同（同后端 stats 扩展），合并到 MISC-DASHBOARD-2 一并实施

### 结论

**不进入 REDO 列表**。

---

## §5.10 `/admin/users` 审计（PRE-04 子卡 #13）

**评级**：**⚠️ S 级**（PageHeader + DataTable 存在；KPI 4 列 + 角色矩阵 / 邀请用户 actions 缺失）
**真源**：`reference.md` §5.10 + `screens-3.jsx:90-136`
**现状文件**：`users/_client/UsersListClient.tsx` + `columns.tsx` + `UserRolePopover.tsx`

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page head + actions（角色矩阵 / 邀请用户） | ❌ PageHeader 存在；2 actions grep 未命中 | ❌ MISC-USERS-1 |
| KPI 4 列（总数 / 活跃 / 今日新增 / 已封禁） | ❌ KpiCard 未消费（grep 命中 0） | ❌ MISC-USERS-2 |
| §6.4 列定义 | ✅ `columns.tsx` | ✅ |
| UserRolePopover（角色编辑） | ✅ | ✅ |

### 偏离项

| ID | 严重度 | 标题 | 估时 |
|---|---|---|---|
| **MISC-USERS-1** | 🟡 P2 | page head actions（角色矩阵 Modal + 邀请用户 Modal） | 0.3–0.5w |
| **MISC-USERS-2** | 🟡 P2 | KPI 4 列（消费 KpiCard + 后端 users-stats 端点） | 0.2w |

---

## §5.11 `/admin/settings`（system 区段）审计（PRE-04 子卡 #14，**架构错位**）

**评级**：**❌ 架构错位**（违反 reference §5.11 显式提醒"sidebar 不应暴露多个 system 子项"）
**真源**：`reference.md` §5.11 + `screens-3.jsx:139-217`
**现状**：
- `/admin/system/page.tsx`：仅 `PlaceholderPage`
- 5 个子路由分散：`/admin/system/{settings,cache,config,monitor,migration}/page.tsx`
- `/admin/system/settings/_client/SettingsContainer.tsx` 内含 5 Tab（Settings/Cache/Config/Migration/Monitor）

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| 单一入口 `/admin/settings` | ❌ 路由名 `/admin/system/settings` + 4 个兄弟子路由 | ❌ |
| 180px/1fr 左 vertical tab + 右 card 内容 | ✅ SettingsContainer 内部对齐 | ✅ |
| Tab item 样式 | ✅ | ✅ |
| **plan §6 8 类 Tab** 实际仅 5 类（基础/豆瓣/内容过滤/视频代理/自动采集；缺图片/通知/API·Webhook/登录会话） | ❌ | ❌ |
| reference §5.11 显式：「sidebar 不应暴露多个 system 子项」 | ❌ 当前 sidebar 暴露 5 个子项 | ❌ 架构 |

### 归属：**REDO-03**

3 项子任务：
- A：sidebar IA 重构（5 子项 → 1 入口 `/admin/settings`）+ 旧路由 redirect
- B：SettingsContainer 5 Tab → 8 Tab 扩展（补图片/通知/API·Webhook/登录会话）
- C：后端 settings 端点字段扩展 + ADR

估时 ~1.5w。

**注**：原 `CHG-SN-7-MISC-SETTINGS-TABS`（M-SN-6 关闭 FOLLOWUP 时挂的卡）作为 REDO-03-B 子任务消费。

---

## §5.12 `/admin/audit` 审计（PRE-04 子卡 #15）

**评级**：**⚠️ S 级**（导出 + 总数 + DataTable 已对齐；时间穿梭 action 缺失）
**真源**：`reference.md` §5.12 + `screens-3.jsx:220-269`
**现状文件**：`audit/_client/AuditClient.tsx` (558 行)

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| page head + actions（导出 / 时间穿梭） | ⚠️ 导出 CSV ✅（line 411）；**时间穿梭 ❌** | ❌ MISC-AUDIT-1 |
| Filter bar（搜索 + 用户/类型/时间 chip + 总数） | ⚠️ 搜索 + AdminSelect 用户/类型 chip ✅；时间 chip ✅；总数 ✅（`totalRows={total}` line 535）| ✅ |
| §6.5 列定义 | ✅ | ✅ |

### 偏离项

| ID | 严重度 | 标题 | 估时 |
|---|---|---|---|
| **MISC-AUDIT-1** | 🟢 P3 | 时间穿梭 action 实装（指定时间点状态回放） | 0.4–0.6w（**或** P3 长期 backlog，本卡功能需求待用户确认） |

---

## §5.16 `/admin/login` 审计（PRE-04 子卡 #16）

**评级**：**⚠️ S 级**（登录核心功能 ✅；视觉规范偏离）
**真源**：`reference.md` §5.16 + `screens-3.jsx:428-447`
**现状文件**：`apps/server-next/src/app/login/page.tsx` + `LoginForm.tsx` (129 行)

### 实测对照

| spec | 现状 | 状态 |
|---|---|---|
| 全屏居中 + radial accent overlay | ⚠️ 待核实 | ⚠️ |
| 登录 card 宽 400 / padding 40 / bg2/border/r-4/shadow-lg | ❌ `width: 320px` + `padding: var(--space-5)` | ❌ MISC-LOGIN-1 |
| Brand row（36px logo / 18px title / 11px subtitle） | ❌ 无 logo + brand row | ❌ MISC-LOGIN-1 |
| 表单 input + remember checkbox + primary 登录 | ⚠️ identifier + password ✅；**remember ❌** | ⚠️ MISC-LOGIN-1 |
| 分隔线 + SSO button | ❌ | ❌ MISC-LOGIN-1 |
| 审计提示 | ❌ | ❌ MISC-LOGIN-1 |

### 偏离项

| ID | 严重度 | 标题 | 估时 |
|---|---|---|---|
| **MISC-LOGIN-1** | 🟢 P3 | 登录 card 视觉对齐（400×padding 40 / brand row / remember / SSO / 审计提示） | 0.2–0.3w |

### 结论

登录核心功能正常，视觉对齐为低优 backlog。可推迟到 M-SN-7 后期或 M-SN-8。

---

## PRE-04 收尾：REDO-NN 优先级排序

> **2026-05-20 PRE-04 正式闭环**。本节由 arch-reviewer Opus 子代理（claude-opus-4-7）基于 16 路由审计结果产出最终归类与收尾裁决，覆盖原占位段。

### 1. 正式 REDO-NN 归类表（4 项，全部已完成）

| 优先级 | REDO 卡 | 路由 | 触发原因 | 原估时 | 完成日期 | 验收 |
|---|---|---|---|---|---|---|
| **P0-1** | **REDO-01**（A→J 10 子卡） | `/admin/crawler` | 架构错位：Tab + DataTable + 仅 4 按钮，违反 §5.6 + §6.8 设计稿 6 区段编排 | 2.55w | 2026-05-19 | arch-reviewer A− |
| **P0-2** | **REDO-02**（A0→F 7 子卡） | `/admin/submissions` | 架构错位：通体 DataTable，违反 §5.13 Card list（status icon box + quote block + 3 按钮）形态 | ~1.0w | 2026-05-19 | arch-reviewer A− |
| **P0-3** | **REDO-03**（A→D 4 子卡） | `/admin/settings`（system 区段收敛） | 架构错位：sidebar 暴露 5 个 system 子项 + Tab 数量 5/8 不足，违反 §5.11 显式提醒 | ~1.5w | 2026-05-19 | arch-reviewer A− |
| **P0-4** | **REDO-04** | `/admin/staging` | 整页未做：原仅作为 `/admin/moderation?tab=staging` 嵌入。Opus 裁决（2026-05-20）：采用「独立路由」方案，与 §5.5 设计稿一致 | ~1.5w | 2026-05-20 | 独立路由实装完成 |

**裁决要点（REDO-04 IA 分歧最终结论）**：选择「独立路由实装」而非「redirect 合并」。理由：
- §5.5 设计稿明示 staging 是独立 page__head + 上部 1.5fr/1fr 双 card（发布流水线 + 自动发布规则）+ Segment 4 类的完整页态，无法在 moderation tab 内承载
- 与 §5.15 analytics → dashboard tab 的 IA 修订不同：analytics 是「KPI + 图表」可嵌入双 Tab，staging 是「流水线 + 规则编辑」需要独立路由承载 actions
- moderation 内 `StagingTabContent.tsx` 保留为「审核台快速暂存视角」，与 `/admin/staging` 独立路由「发布运营视角」并存，职责分离清晰

### 2. MISC 跟踪卡完成快照（16 项，按路由分组）

| 路由 | MISC 卡 | 当前状态 | 备注 |
|---|---|---|---|
| `/admin/dashboard` | MISC-DASHBOARD-1 | ✅ 完成（2026-05-20） | page__head 2 按钮 onClick 绑定 |
|  | MISC-DASHBOARD-2 | ✅ 完成（2026-05-20） | Dashboard 数据真实化 ADR-127 / 3 端点实装 |
|  | MISC-DASHBOARD-3 | 🟢 P3 延后 | 编辑态规则（拖拽/resize/全屏/卡片库）→ M-SN-N long-term backlog |
| `/admin/videos` | MISC-VIDEOS-1 | 🟢 P3 待处理（0.05w） | poster 32×48 vs 48×72 设计升级决议文档化 |
| `/admin/merge` | MISC-MERGE-1 | ✅ 完成 | Segment 3 类补全 |
|  | MISC-MERGE-2 | 🟡 P2 待处理（0.5–0.8w） | 候选 card 形态重做（左右视频对比 + 影响预览） |
| `/admin/subtitles` | MISC-SUBTITLES-1 | ✅ 完成 | KPI 4 列补全 |
|  | MISC-SUBTITLES-2 | ✅ 完成 | 上传字幕 action 实装 |
| `/admin/home` | MISC-HOME-1 | ✅ 完成 | sticky 前台预览实装（1fr/360px） |
|  | MISC-HOME-2 | 🟢 P3 待处理（0.05w） | page__head actions 完整性核实 |
| `/admin/image-health` | MISC-IMAGE-1 | ✅ 完成 | page__head 2 actions 实装 |
|  | MISC-IMAGE-2 | ✅ 完成 | 破损样本 grid（2:3 ratio + danger dashed border） |
| `/admin/users` | MISC-USERS-1 | ✅ 完成 | page head actions（角色矩阵 / 邀请用户） |
|  | MISC-USERS-2 | ✅ 完成 | KPI 4 列 + users-stats 端点 |
| `/admin/audit` | MISC-AUDIT-1 | 🟢 P3 待处理 | 时间穿梭 action（功能需求待确认） |
| `/admin/login` | MISC-LOGIN-1 | 🟢 P3 待处理（0.2–0.3w） | 登录 card 视觉对齐（400×40 / brand row / remember / SSO） |

**完成度统计**：16 项中 9 项 ✅ 完成 + 1 项 🟡 P2 待处理（MERGE-2）+ 6 项 🟢 P3 待处理或延后（DASHBOARD-3 / VIDEOS-1 / HOME-2 / AUDIT-1 / LOGIN-1）

### 3. PRE-04 闭环结论

**PRE-04 使命完成**：

- ✅ 16/16 路由全量审计完成（2026-05-18）
- ✅ REDO-01/02/03/04 四项 P0 主线全部完成（最末 REDO-04 于 2026-05-20 闭环）
- ✅ 架构错位 4 项（crawler / submissions / settings / staging）100% 收敛
- ✅ MISC 跟踪卡 ✅ 完成 9 项 + 🟡 P2 跟进 1 项 + 🟢 P3 backlog 6 项

**SHARED milestone 范围确认**：
- SHARED-01 KpiCard `progress?` 扩展 → **保留**（已完成 CHG-SN-SHARED-01）
- SHARED-02 ExpandableTable → **保留**（REDO-01 + sources 矩阵已参考）
- SHARED-03 Spark → **取消**（analytics + dashboard + MetricKpiCardRow 已消费现有 admin-ui Spark；本审计未发现新形态需求）

**尚未完成的 MISC 跟踪卡**（不阻塞 PRE-04 闭环，独立排期）：

| 优先级 | 卡 | 估时 | 建议归属 |
|---|---|---|---|
| 🟡 P2 | MISC-MERGE-2 | 0.5–0.8w | M-SN-7 内择机或 M-SN-8 |
| 🟢 P3 | MISC-DASHBOARD-3 | 1.5–2w | M-SN-N long-term backlog |
| 🟢 P3 | MISC-VIDEOS-1 | 0.05w | 文档决议固化（`docs/decisions.md` 补丁） |
| 🟢 P3 | MISC-HOME-2 | 0.05w | 顺手清单 |
| 🟢 P3 | MISC-AUDIT-1 | 0.4–0.6w | 功能需求待用户确认 |
| 🟢 P3 | MISC-LOGIN-1 | 0.2–0.3w | M-SN-8 |

**PRE-04 评级：A−**

评级理由：
- ✅ A 级要素：16 路由审计 100% 覆盖；4 项架构错位（REDO-01/02/03/04）全部 P0 主线收敛；SHARED 范围基于实测修订（SHARED-03 取消省 ~0.4w）；reference §5.x.4 过期自评按"commit 实测为准"原则纠偏（dashboard / analytics 2 处）
- − 扣分要素：REDO-04 IA 方案在审计期遗留分歧（独立路由 vs redirect 合并），直到 PRE-04 收尾才裁决；MISC-MERGE-2（0.5–0.8w 形态级重做）未在 PRE-04 内闭环，下放 M-SN-7 后期 / M-SN-8

**与 ADR / 规范对齐情况**：
- ✅ 对齐 ADR-127（Dashboard 数据真实化）
- ✅ 对齐 `docs/designs/backend_design_v2.1/reference.md` §5.1–§5.16 + `app/screens-{1,2,3}.jsx` 真源
- ✅ 对齐 CLAUDE.md "后端分层 Route → Service → Queries"（REDO-01/02/03 子卡均在分层内落地）
- ✅ 对齐 CLAUDE.md "新增 admin route 须先起独立 ADR"（REDO-01-B / DASHBOARD-2 端点均通过 ADR-127 等核验）
- ✅ 对齐 "server-next 新模块禁止复用 ModernDataTable 三件套"（REDO-02 改造为 Card list；REDO-03 settings Tab 容器非 DataTable）

---

**收尾时间戳**：2026-05-20
**收尾子代理**：arch-reviewer（claude-opus-4-7）
**主循环模型**：claude-sonnet-4-6（PRE-04 收尾会话）

