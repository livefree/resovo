# P-dashboard · 管理台站（首屏）

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-1 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin` |
| 设计稿引用 | reference.md §5.1（含 8 卡类型）|
| 主任务卡 | CHG-DESIGN-07（8 卡浏览态）+ CHG-SN-7-MISC-DASHBOARD-1/2（onClick 接通 + 真实数据 + ADR-127）+ CHG-SN-8-MANUAL-BATCH-1（手册定稿）|
| 涉及端点 | `GET /admin/stats/dashboard`（含 attentions + workflow + kpis + activities + sites 5 投影）+ analytics tab `GET /admin/stats/analytics` |
| 适用角色 | 所有 admin/moderator/editor/viewer（只读）|
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-1）|

---

## 1. 这个页面是做什么的

后台首屏 · 工作台 · 每用户首次进入必到。集中显示 5 类信息让运营 / 审核员 / 管理员快速识别当前最需关注的事项：异常 / 工作流进度 / 核心 KPI / 最近活动 / 站点健康。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 「早上好，Yan — 今天有 N 待处理」                    │
│ 副标题：最后采集时间                                              │
│ Actions: 「全站全量采集」+ 「进入审核台」（CHG-DASHBOARD-1）       │
├──────────────────────────────────────────────────────────────────┤
│ Tab segment：管理台站 / 数据看板（analytics）                     │
├─ 管理台站 Tab ────────────────────────────────────────────────┤
│ Row 1 (1.4fr / 1fr)：AttentionCard │ WorkflowCard                │
│ Row 2 (4 列)：视频总量 / 待审-暂存 / 源可达率 / 失效源（KpiRow）│
│ Row 3 (1fr / 1fr)：RecentActivityCard │ SiteHealthCard           │
├─ 数据看板 Tab ────────────────────────────────────────────────┤
│ AnalyticsView（period select + KPI×4 + SVG 图表 + 爬虫任务表）   │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 看「关注事项」AttentionCard（高频）

- **位置**：左上卡，按优先级列异常项
- **典型条目**：采集失败 N 站 / 图片 404 / 合并候选数 / Banner 过期
- **行为**：每条行尾 xs btn「处理」深链对应页（如 P-image-health / P-merge）
- **顶部「全部解决」**（CHG-SN-DASHBOARD-2 实装）：批量跳处理向导

### 3.2 看「工作流进度」WorkflowCard

- **位置**：右上卡
- **4 段 progress 显示**：采集入库（accent）/ 待审核（warn）/ 暂存待发布（info）/ 已上架（ok）
- **底部 2 按钮**：「审核」深链 /admin/moderation / 「批量发布」深链 staging

### 3.3 看 KPI 4 列（CHG-SN-7-MISC-DASHBOARD-2 真实数据）

| KPI | 数据源 | spark |
|---|---|---|
| 视频总量 | COUNT(videos WHERE deleted_at IS NULL) | accent / ↑↓ 今日 delta |
| 待审 / 暂存 | COUNT(WHERE review_status='pending_review') + staging | warn |
| 源可达率 | (active sources / total) * 100% | ok |
| 失效源 | COUNT(WHERE probe_status='dead') | danger / ↑↓ 较昨日 |

### 3.4 「全站全量采集」按钮（PageHeader · CHG-SN-7-MISC-DASHBOARD-1）

- **位置**：PageHeader 右上 primary
- **行为**：与 P-crawler「全站全量采集」同语义；但本按钮**未跟进 CHG-SN-8-01 双重 confirm 改造**
- **登记 GAPS.md #G-dashboard-runall**（潜在误触风险）

### 3.5 切到数据看板 Tab（analytics）

- 包含：period select（7/30/90 天）+ KPI×4 + SVG 折线 + 源类型分布饼 + 爬虫最近任务表

## 4. 进阶操作

### 4.1 dashboard 编辑态（拖拽 / resize / 全屏 / CardLibrary）

- **状态**：⬜ **未实装**（plan §6.1.3 设计意图；CHG-SN-7-MISC-DASHBOARD-3 标 🟢 P3 / 1.5-2w / 延后到 M-SN-N）
- **登记 GAPS.md #G-dashboard-edit-mode**

### 4.2 FullscreenCard（任一卡片全屏）

- 同上未实装；reference §5.1 列出但 backlog

## 5. 字段含义

| AttentionCard 行字段 | 含义 |
|---|---|
| sev icon | warn / danger 严重度 |
| title | 异常简述（如 "4 个采集站点连失"）|
| meta | 时间 / 详情链接 |

| KPI 字段 | SQL 来源 |
|---|---|
| 视频总量 value | COUNT 全量 |
| delta | 今日新增（CHG-SN-DASHBOARD-2 ADR-127）|
| spark | 最近 7-30 天趋势 SVG |

## 6. 状态颜色

| 颜色 | 用途 |
|---|---|
| ok (绿) | 健康 KPI / 已上架进度 / 站点 health >80 |
| warn (黄) | 待审 / 部分失效 / health 40-80 |
| danger (红) | 失效源 / 严重异常 / health <40 |
| accent (蓝) | 视频总量主 KPI / 主进度 |
| muted (灰) | 无数据 |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 数字显示 "—" | 后端 stats endpoint 失败 | 看 network 日志；可能 worker 未跑 |
| 「全站全量采集」按钮点击没二次确认 | 该按钮未跟进 CHG-SN-8-01 改造 | GAPS.md #G-dashboard-runall follow-up |
| 数据更新延迟 | dashboard stats 后端 cron 周期触发 | 等下一周期 / 强制 refresh |
| 编辑态拖拽卡片 | 未实装 | GAPS.md #G-dashboard-edit-mode |
| RecentActivity 头部「示例数据」warn chip | 卡数据仍 mock（dashboardStats.activitiesDataSource='mock'） | **ADR-141 已起草 A PASS** 2026-05-22 — 设计 `GET /admin/dashboard/activities` 端点（admin_audit_log 派生 + 60s TTL 缓存 + 新索引 idx_admin_audit_log_created）+ 前端 i18n 37 项 actionLabels；待 CHG-SN-8-FUP-DASH-ACTIVITY-LIVE 实施落地后 chip 自动消失（GAPS.md #G-dashboard-activities-mock）|

## 8. 与其他页面的关系

- → 跳出到 [P-moderation](./P-moderation.md)：WorkflowCard「审核」按钮 + 「进入审核台」PageHeader 按钮
- → 跳出到 [P-crawler](./P-crawler.md)：「全站全量采集」（注：UX 待对齐 P-crawler 双重 confirm 范式）
- → 跳出到 [P-image-health](./P-image-health.md)：AttentionCard 图片异常深链
- → 跳出到 [P-merge](./P-merge.md)：AttentionCard 合并候选数深链
- ← 各业务页 KPI 反向链：进入指定 filter 视图（CHG-SN-DASHBOARD-2 ADR-127 设计）
- ↔ 相关工作流：所有 W1-W5 都以 dashboard 为起点
