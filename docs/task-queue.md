# Resovo（流光）— 任务序列池（Task Queue）

> status: active
> owner: @engineering
> scope: task sequencing, status tracking, blocker notifications
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-23
>
> 用途：提前规划多个任务序列，避免”走一步看一步”；同时作为 BLOCKER/PHASE COMPLETE 通知的写入位置。
> 关系：本文件负责”任务规划 + 状态追踪 + 通知”；`docs/tasks.md` 负责”当前单任务工作台（完成即清空）”；`docs/changelog.md` 负责”完成历史日志”。

---

## 统一规则（必须遵守）

1. 任务序列命名

- 序列 ID 格式：`SEQ-YYYYMMDD-XX`（例：`SEQ-20260319-01`）
- `XX` 从 `01` 递增，不复用、不回填
- 一个序列包含一组有依赖关系的任务（可跨多个模块）

2. 任务编号命名（沿用现有规范）

- 任务 ID 格式：`<PREFIX>-NN`
- `PREFIX` 必须使用既有前缀：`INFRA` / `AUTH` / `VIDEO` / `SEARCH` / `PLAYER` / `CRAWLER` / `ADMIN` / `USER` / `SOCIAL` / `LIST` / `CONTRIB` / `CHG` / `CHORE` / `DEC` / `UX` / `META` / `IMG` / `HANDOFF` / `STATS`
  - `DEC`：前后台解耦架构任务（来自 frontend_backend_decoupling_plan_20260401.md，2026-04-02 新增）
  - `UX`：后台交互改造任务（来自 admin_console_decoupling_and_ux_plan_20260402.md，2026-04-02 新增）
  - `META`：外部元数据层建设任务（来自 external_metadata_import_plan_20260405.md + 2026-04-14 豆瓣扩展方案，2026-04-14 新增）
  - `IMG`：图片管线与样板图系统任务（来自 image_pipeline_plan_20260418.md，2026-04-20 新增）
  - `HANDOFF`：前端交付包落地（来自 handoff_20260422/landing_plan_v1.md，M7 扩充首页重设计，2026-04-22 新增）
  - `STATS`：视频观看埋点 + 综合算分（v2.1 独立跟进，2026-04-22 新增占位）
- `NN` 为两位数字，按同前缀内最大编号递增（例如当前最大 `CHG-335`，下一个必须是 `CHG-336`）
- 禁止跳号占坑、禁止复用已存在编号

3. 时间戳要求

- 每个序列必须包含：`创建时间`、`最后更新时间`
- 每个任务必须包含：`创建时间`（必填），`计划开始时间`（建议），`实际开始时间`（启动后填），`完成时间`（完成后填）
- 时间格式统一：`YYYY-MM-DD HH:mm`（本地时区）

4. 记录位置（统一，禁止混用）

- 本文件：新序列与新任务一律**追加到文件尾部**
- `docs/tasks.md`：新任务块一律**追加到文件尾部**；同一任务只更新其状态与时间字段
- `docs/changelog.md`：新完成记录一律**追加到文件尾部**
- 禁止“有时头插、有时尾插”

5. 执行约束

- `docs/tasks.md` 是单任务工作台：同时只允许 1 个任务为 `🔄 进行中`；任务完成后立即从 tasks.md 删除该卡片（历史存于 changelog.md）
- 任务进入执行前，必须已在本文件序列中定义（除紧急 hotfix）
- 每完成一个任务，立即更新本文件对应任务状态与时间戳，并更新所属序列的 `最后更新时间`
- BLOCKER 和 PHASE COMPLETE 通知写入本文件尾部（不写入 tasks.md）

---

## 序列模板

```markdown
## [SEQ-YYYYMMDD-XX] 序列标题

- **状态**：🟡 规划中 / 🔄 执行中 / ✅ 已完成 / ⛔ 已取消
- **创建时间**：YYYY-MM-DD HH:mm
- **最后更新时间**：YYYY-MM-DD HH:mm
- **目标**：一句话描述目标
- **范围**：涉及模块与边界
- **依赖**：上游任务或环境前置

### 任务列表（按执行顺序）

1. TASK-ID — 标题（状态：⬜/🔄/✅/❌）
   - 创建时间：YYYY-MM-DD HH:mm
   - 计划开始：YYYY-MM-DD HH:mm
   - 实际开始：YYYY-MM-DD HH:mm（未开始可留空）
   - 完成时间：YYYY-MM-DD HH:mm（未完成可留空）
   - 验收要点：...
```

---
## 序列编号约束声明

**重要**：新任务序列号不得与历史归档中的序号重复。历史已完成序列已分段归档：

- `docs/archive/task-queue/task-queue_archive_20260427.md` — SEQ-20260319-* ~ SEQ-20260426-01（M0 ~ M-SN-0 启动准备）
- `docs/archive/task-queue/task-queue_archive_M-SN-1-to-6_20260523.md` — SEQ-20260428-01 ~ CHG-SN-6-29-FOLLOWUP（M-SN-1 ~ M-SN-6）

当前及后续任务使用新序列号；本文件保留 M-SN-7 跟踪卡 + 设计稿对齐重做 + M-SN-8 全部活跃序列。

---


## M-SN-7 跟踪卡（arch-reviewer M-SN-6-29-AUDIT 输出 + 衔接建议）

下列卡片由 CHG-SN-6-29-AUDIT 评审产出，作为 M-SN-7 入口候选。开工时按优先级取下一个。

> **2026-05-18 范围重大扩展**：用户复核发现 server-next 后台**架构性偏离设计稿**（多页面 v1 风格 DataTable + Tab + 外置 SelectionActionBar，未对照 `docs/designs/backend_design_v2.1/reference.md` §5.x + screens-2.jsx 真源），M-SN-7 主线由"清债务"转为"**设计稿对齐重做**"。规划文档：`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md`（5 用户决策 + 11 修订意见全部合并落地）。新增专项段「设计稿对齐重做」见下方。

### 高优先（M-SN-7 前 3 卡推荐顺序）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-PRE-01** 已完成（2026-05-18）| 文件大小守卫 `verify:file-size-budget`（**全量扩范围 28 文件**） | 实施：`scripts/verify-file-size-budget.mjs` + `package.json` 集成 + `preflight.sh` 5e2/6 步骤；**PERMANENT_EXEMPT** 5 文件（apps/server v1 frozen 永久）+ **BASELINE_EXEMPT** 23 文件（M-SN-6 复核 7 + PRE-01 全量扩 16：api/queries 5 + api/routes 2 + api/services+workers 4 + web-next 1 + player core 4）；新增零容忍 + GENERIC_WHITELIST（.types/.schema/index 等）；实测 0 新违规 ✅；4018 unit + typecheck + lint 全 PASS；新挂 5 MISC 拆分跟踪卡（API-QUERIES/ROUTES/SERVICES + WEB-NEXT + PLAYER-CORE） | opus-4-7 | 0.12w | ✅ |
| ✅ **CHG-SN-7-PRE-02** 已完成（2026-05-18）| ADR-121 R-MID-1 RETRO 协议正式化 | 起草 ADR-121（9 段结构 / 4 真源 + **7 文件**框架 / PATCH ≤ 5 豁免依据 / 4 替代方案 11 维度对比 / 5 触发重评条件）；arch-reviewer Opus 评审 A- CONDITIONAL → 红线 1 + 黄线 3 全部修订后 PASS；**重大发现**：原起草"6 文件框架"漏 `audit-log-service-enums-set-equal.test.ts` → 评审拦截修订为 7 文件；4018 unit PASS 保持 | opus-4-7 主循环 + arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-MISC-PERSITE** 已完成（2026-05-20）| perSiteOverrides UI 实装（M-SN-6 deferred 债务） | SchedulerConfigDrawer 加 perSiteOverrides 编辑区（每站点 enabled 切换 + mode 选择 inherit/incremental/full）；可考虑独立子 Drawer 嵌套 / 表格化编辑；CHG-SN-6-27 中标记 advisory 引用此卡。**实际执行**：SchedulerConfigDrawer 361L（+142L）；新增站点覆盖列表（scrollable max-h 220px）+ 移除按钮 + 添加站点 AdminSelect（searchable）；测试 8→11（+3 覆盖用例）| sonnet | 0.15-0.25w | 🟡 P2 |

### 中风险（M-SN-7 中段评估）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-MISC-FILE-SIZE** 已完成（2026-05-20）| **5 文件主动拆分预案（M-SN-6 复核扩范围）**：原 CRAWLER-FILE-SIZE 改名 + 范围扩 2 漏检 | 评估 5 文件按 PATCH-1 范式拆分：crawler 3 接近上限（CrawlerRunDetailView 445 / TaskLogsDrawer 491 / CrawlerRunsView 429）+ **AuditClient 558**（M-SN-6 新增 / CHG-SN-6-01）+ **ImageHealthClient 590**（M-SN-6 新增 / CHG-SN-6-02）；若 PRE-01 守卫触发警告则启动拆分；范式参考 CrawlerSitesTab + ControlsCard + FormDrawer + columns 拆分。**实际执行**：API queries 5 文件拆分（sources.ts / videos.ts 等）+ server-next AuditClient（558→374L）/ ImageHealthClient（590→392L）提取子组件，新增 4 文件（AuditDetailDrawer / AuditColumns / ImageHealthKpiCard / ImageHealthColumns）| sonnet | 0.3-0.6w（5 文件） | 🟡 P2 |
| ✅ **CHG-SN-7-MISC-SETTINGS-TABS** 已完成（2026-05-19）| Settings 8 类 Tab 全部落地（5 类 → 8 类）— 由 **CHG-SN-7-REDO-03-B** 兑现（commit 4186 unit PASS / +通知/API·Webhook/登录会话 + 图片占位 section）；SettingsContainer.tsx L42-50 实证 8 类全 / 本卡历史描述过时（DOCS-CLEANUP-DEBT 2026-05-25 修订）| Opus arch-reviewer (REDO-03 序列) | 0.3w 实际 / REDO-03-B | ✅ |
| ✅ **CHG-SN-7-MISC-SHELL-NOTIFICATIONS** 已完成 90%（2026-05-19 / DOCS-CLEANUP-DEBT 2026-05-25 复盘）| mockNotifications + mockTasks 已 ADR-147 接入真端点（useAdminNotifications + useAdminTasks 60s polling + lastViewedAt）/ admin-shell-client.tsx L127-128 实证；**剩 1 stub**：`adminNavCountProviderStub`（sidebar nav badge 数字）— 涉及新 ADR + 后端 nav-counts 端点（plan §4.5 协议） / 独立 follow-up **CHG-SN-7-MISC-SHELL-NAV-COUNTS** 按需立卡 | claude-opus-4-7 (ADR-147) | 0.2w 完成 / 0.1-0.3w 剩 | ✅ (90%) |

### 低风险（任意时机承接，主循环自助）

| ID | 标题 | 范围 | 工时 | 优先级 |
|---|---|---|---|---|
| ✅ **CHG-SN-7-LOW-1** 已完成（2026-05-20）| 双子卡范式 -A audit + -B UI 文档化 / admin-module-template.md 追加"写端点 + UI 拆卡决策树"节 + 决策树 + 先例表（CHG-SN-6-16/20/25/26） | 0.05w | 🟢 P3 |
| ✅ **CHG-SN-7-LOW-2** 已完成（2026-05-20）| NEGATED ADR 占位 / 重启路径集中说明 / decisions.md 头部追加"NEGATED ADR 占位语义"节 + 5 条规则 + 先例表（ADR-114/119/120-NEGATED） | 0.05w | 🟢 P3 |
| ✅ **CHG-SN-7-LOW-3** 已完成（2026-05-20）| ModerationConsole csv 豁免追溯 / ADR-106 末尾追加"toolbar-less 视图豁免 csv-export"节 + 2 条规则 | 0.03w | 🟢 P3 |
| **CHG-SN-7-LOW-4** | useDoubleConfirm hook 沉淀（触发条件：第 3 处复用时同卡提取） | 不立即起卡；M-SN-7 内若新增第 3 个不可逆操作（如清空 ES / 强制重建审核队列等）→ 在该卡内沉淀至 `apps/server-next/src/lib/` 或 `packages/admin-ui` | — | 🟢 P3（条件触发） |

---

## 设计稿对齐重做（M-SN-7 主线 / 2026-05-18 落卡）

> 真源：`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md`（§0–§8 全文）。本段为 task-queue 索引；详细 spec ↔ 现状 ↔ 重做归属对照见计划文档 §1（16 路由审计矩阵）+ §2（Crawler 完整对照）。
>
> **用户决策已锁**：①Submissions 纳入 REDO-02 ②子卡 A–J 粒度 ③SHARED 拆独立 milestone 先做 ④runs 独立路由 + sidebar 二级菜单 ⑤批量动作留 REDO-01-A Opus 裁决。
>
> **取消**：~~CHG-SN-7-PRE-03~~（CrawlerSitesTab 外置 batch bar 修正）→ 整页要重做，无需局部修。

### PRE 阶段（全量审计 + ADR 起草，**1.27w**）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-PRE-04** 已完成（2026-05-20）| 全量审计 16 admin 路由 vs 设计稿 §5.1–§5.16 | 16/16 路由逐路由审计产出 ✅/⚠️/❌；arch-reviewer Opus 收尾裁决 REDO-NN 优先级（REDO-01/02/03/04 全识别 + 全完成）；评级 **A−**；MISC 跟踪 16 项（9 ✅ / 1 🟡P2 / 6 🟢P3）；REDO-04 IA 分歧正式裁决「独立路由」；`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-audit-FULL.md` 收尾节填充 | sonnet 主循环 + arch-reviewer (claude-opus-4-7) | 0.9w 实际（收尾 0.05w）| ✅ |
| ✅ **CHG-SN-7-PRE-05** 已完成（2026-05-18）| ADR-123 分类映射 schema 起草 — **Accepted** | spawn Opus 子代理 1 轮独立起草 ADR-123 A−（方案 A 新建表 `crawler_site_category_maps` / 复用 VideoGenre + `_unmapped`+`_discard` 特殊值 / 入库前查表映射 / PUT 全量替换语义 + 7 文件 RETRO 框架 / migration 064 SQL 草案完整）；REDO-01-F 按 spec 三段实施路径锁定 | arch-reviewer (opus-4-7) | 0.1w | ✅ |

### M-SN-SHARED milestone（共享原语前置，**0.9w**）

> 三张子卡可并行（无相互依赖），**必须先于任何 REDO-XX 完成**。验收门：颜色零硬编码 + 双品牌 baseline + 入库 `packages/admin-ui/src/components/`。

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-SHARED-01** 已完成（2026-05-18）| KpiCard `progress?` prop 扩展（footer spark/progress 互斥拓展） | 新增 `KpiCardProgress` interface（value/total/color?/showLabel?）+ 渲染于 footer 60×18 槽位与 spark 互斥 + 4 dev warn 防御（非 primitive value 无 ariaLabel / progress+spark 并存 / value<0 或 total<=0 / color 非 CSS 变量）+ a11y aria-label 追加百分比；arch-reviewer Opus 1 轮 **A- 无红线 / 3 黄线** → 采纳黄线 1+2（color 运行时防御 / a11y 追加 %）跳过黄线 3（value=0 争议）；MetricKpiCardRow + AnalyticsView 零破坏；**17 新 case** PASS（原 49 → KpiCard 54 测试）| opus-4-7 主循环 + arch-reviewer (opus-4-7) | 0.1w | ✅ |
| ~~**CHG-SN-SHARED-02**~~ | ❌ **取消**（2026-05-18 实施前实测：DataTable v2 已支持 `renderExpandedRow` + `expandedKeys` + selection + pagination 三态；ADR-117 + CHG-DESIGN-02 Step 5 已落地；Sources MatrixExpand 生产消费验证）→ REDO-01 Crawler 重做直接消费 DataTable v2 | — | 0w（原 0.4w）| — |
| ~~**CHG-SN-SHARED-03**~~ | ❌ **取消**（PRE-04 全部 16 子卡 2026-05-18 闭环：admin-ui Spark 已入库；dashboard / analytics / sources 三处消费形态对齐设计稿，未发现新形态需求） | — | — | — | — |

### CHG-SN-7-REDO-01 采集控制重做（**2.55w**，依赖 SHARED milestone 完成）

> 计划文档 §2.4 对照表全 22 行为 REDO-01-J 强制 checklist；任一行 ❌ → J 不通过。

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-REDO-01-A** 已完成（2026-05-18）| Opus 子代理设计 Crawler 重做契约 — 580 行产出落 `docs/archive/2026Q2/m-sn-7-redo/M-SN-7-redo-01-contract.md` | 6 组件 props/state/事件契约 + 5 Open Issues 全裁决（含 Q5 批量动作删除）+ 4 后端端点契约提纲 + admin-ui 消费映射 + 削减建议（D/G 共下调 0.2w → REDO-01 总估时 2.55w → 2.35w）+ 风险评估 + DAG；Opus 子代理 1 轮通过 | arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-01-B** 已完成（2026-05-18）| 后端：ADR-122 + 4 新端点 + ADR-121 4 文件 audit RETRO | 阶段 1 ADR-122 Accepted A（commit 24606c47）+ 阶段 2 4 文件实施（crawlerKpi.ts 177 / crawlerTimeline.ts 171 / crawlerDashboard.ts 178 / 前端 api.ts 扩 +75 全 < 500）+ 阶段 3 audit RETRO 4 文件框架（route auditSvc.write + 18 case 测试 / 复用 crawler.run_create actionType）+ 阶段 4 全质量门禁（typecheck ✅ / file-size ✅ / endpoint-adr ✅ 152 路由对齐 23 ADR / lint ✅ / **4053 unit PASS** 待最终验证）；§端点契约表格式修订对齐脚本期望（6 列 4 行）| Opus（ADR）+ opus-4-7 实施 | 0.6w | ✅ |
| ✅ **CHG-SN-7-REDO-01-C** 已完成（2026-05-19）| 前端骨架：新 CrawlerClient + KpiRow + TimelineCard + SiteList（9 列骨架） | 5 文件新增/重写（CrawlerKpiRow 95 / CrawlerTimelineCard 213 / CrawlerSiteList 152 / crawler-site-columns-v2 276 / CrawlerClient 312 重写）+ 3 PageHeader actions（导出 toast 占位 / + 新增 drawer / 全站全量 runCrawlerAll('full')）+ 15s 时间轴 auto-refresh + freezeEnabled 守卫 + 测试重写 16 case PASS；4053 → 4044 unit PASS（净 -9：旧 25 case → 新 16 case）| opus-4-7 续会话 | 0.3w | ✅ |
| ✅ **CHG-SN-7-REDO-01-D** 已完成（2026-05-19）| 前端站点行 + `{more}` 菜单 | 1 新 `CrawlerSiteRowActions.tsx`(127 行 / 6 菜单 + 动态 label + fromConfig 守卫)+ 4 改（columns-v2 actions 列实装 + AdminButton sm + 行 dropdown 嵌入 / SiteList 8 callback props 透传 / CrawlerClient 7 handlers 实施 runCrawlerSite+toggle+mark*+copy / test 扩 12 新 case 17–28）；CrawlerClient.tsx 312→454 行（含 7 新 handlers + freeze 守卫）；4044 → **4056 unit PASS**（+12 净增）| opus-4-7 续会话 | 0.3w | ✅ |
| ✅ **CHG-SN-7-REDO-01-E** 已完成（2026-05-19）| 前端行展开 + 线路 sub-table（只读） | ADR-117 AMENDMENT 2026-05-19 Opus 1 轮 PASS + 9 文件（types 扩 + query 扩 + service 扩 + route 扩 + 新建 CrawlerSiteExpand 313 行 + lib/sources/api 扩 + columns chevron 改 button + SiteList 透传 + CrawlerClient 注入 expand state）+ 13 backend test + 9 frontend test；4056 → **4078 unit PASS** | Opus (ADR) + opus-4-7 实施 | 0.35w (Y2 重估) | ✅ |
| ✅ **CHG-SN-7-REDO-01-E2** 已完成（2026-05-19）| 行级 3 mutations + audit RETRO + 前端 3 actions | ADR-117 AMENDMENT 2 Opus 1 轮 PASS A（合并 actionType `sources.route_action` + 4 文件 RETRO）+ 后端 5 文件 + 前端 2 文件 + audit RETRO 4 文件 + sources-routes-mutations-audit.test.ts 10 case + CrawlerClient.test +5 case；4078 → **4095 unit PASS**；endpoint-adr 153→156 路由 / 24→27 ADR 端点；STATE_CONFLICT 409 freeze 守卫（修正 Opus 初稿 503）；R-MID-1 系统化第 13 次 | Opus (ADR) + opus-4-7 实施 | 0.35w (Y2 重估) | ✅ |
| ✅ **CHG-SN-7-REDO-01-F** 已完成（2026-05-19）| 分类映射 collapsible（migration + GET/PUT + 前端） | 11 文件按 ADR-123 §文件范围落地：migration 064 + queries + service + 2 endpoints + types + audit RETRO 7 文件（actionType `crawler_site.category_mapping_update`）+ 前端 lib/api + 新建 CategoryMappingCollapsible 230 行 + CrawlerSiteExpand 嵌入；12 audit case + 4095→4109 unit PASS；endpoint-adr 156→158 / 24→29 ADR 端点；R-MID-1 系统化第 14 次 | opus-4-7（纯实施 / ADR-123 PRE-05 已 Opus PASS）| 0.2w | ✅ |
| ✅ **CHG-SN-7-REDO-01-G** 已完成（2026-05-19）| 高级 dropdown 4 项（PageHeader 第 4 槽位） | 新建 CrawlerAdvancedMenu.tsx (175 行 / AdminDropdown + 4 items + 双重 confirm + 动态 label) + CrawlerClient 注入 + SchedulerConfigDrawer mount；4109→**4117 unit PASS**（+8 G case）；0 新端点 / 0 新 ADR / 全 API 复用 | opus-4-7 | 0.1w | ✅ |
| ✅ **CHG-SN-7-REDO-01-H** 已完成（2026-05-19）| runs 列表迁独立路由 + sidebar 二级菜单 | git mv CrawlerRunsView.tsx 至 crawler/runs/_client/ + 新建 runs/page.tsx + admin-nav children 注册 `/admin/crawler/runs` + test import 路径同步；4117 → 4117 unit PASS（CrawlerRunsView 20 case 保持） | opus-4-7 | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-01-I** 已完成（2026-05-19）| 删除旧文件 + git tag 回滚锚点 | git tag pre-redo-crawler-20260519 + git rm 3 文件（CrawlerSitesTab 334 + CrawlerControlsCard 202 + crawler-site-columns 116 = 652 行清理）+ CrawlerClient 文件头注释修订 + tasks.md Rollback 命令记录；4117 unit PASS 保持 | opus-4-7 | 0.05w | ✅ |
| ✅ **CHG-SN-7-REDO-01-J** 已完成（2026-05-19）| 视觉回归 + Opus 验收 — **A−** | arch-reviewer Opus 1 轮 A−（22 行 §2.4 checklist 21 ✅ + 1 ⚠️ 占位 / verify 全 PASS / 4117 unit / 0 硬编码 / 0 any / 0 越层 / Route→Service→Queries 分层完整）；扣 0.5 视觉回归未跑（软门 / MISC 跟踪）+ 扣 0.5 ADR-122/123 D-status JSON 仍 pending（脚本 bug 非架构缺陷 / MISC 跟踪）；**REDO-01 milestone 全闭环（A→J 10 子卡 ~2.5w）** | Opus 验收 | 0.2w | ✅ |

### CHG-SN-7-REDO-02 Submissions §5.13 Card list 重做（**~2.75w**，PRE-04 + REDO-02-A0 实测 / Opus 重估）

> **2026-05-19 重估**：原 ~1w 严重低估（PRE-04 #9 仅识别 UI 层错位 / 未深入数据模型）；REDO-02-A0 Opus 子代理实测 4 类 Segment（失效源举报 / 求片 / 元数据纠错 / 已处理）当前 video_sources 单表无法承载（求片无 video_id / 元数据纠错与 source 无关）→ 新建 `user_submissions` 表 / 6 新端点 / R-MID-1 第 15 次 audit RETRO；详 ADR-124。

| ID | 标题 | 范围 | 模型 | 工时 | 状态 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-REDO-02-A0** 已完成（2026-05-19）| ADR-124 user_submissions schema 起草 | spawn arch-reviewer Opus 1 轮 PASS A（4 维度全 A / 2 黄线 Y1+Y2 主循环修订 / 3 advisory）+ 落 decisions.md 11 节 + 8 决策 D-124-1..8 + 6 端点契约 + migration 065 SQL + 3 类 metadata zod 锁定 + 7 子卡拆分；endpoint-adr 29→35 ADR 端点 | arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-02-A** 已完成（2026-05-19）| migration 065 + types + audit 4 真源同步 + audit content assertion | migration 065 (120 行 / 3 CHECK + 4 indexes + AD1 jsonb_typeof + AD2 partial index + backfill + ROLLBACK) + types 4 interface + actionType `user_submission.action` + targetKind `user_submission` + AuditLogService 数组 + audit-log-coverage REQUIRED + PAYLOAD + set-equal EXPECTED + UserSubmissionService stub (98 行 / writeUserSubmissionAction helper + 3 metadata zod) + 8 case PASS；R-MID-1 第 15 次系统化；4117→4127 unit PASS (+10 净增) | opus-4-7 | 0.4w | ✅ |
| ✅ **CHG-SN-7-REDO-02-B** 已完成（2026-05-19）| 6 端点 + service + queries + audit 写入 + 23 case PASS | queries 230 行 + service 扩 6 业务方法 + route 180 行 + server.ts 注册 + 状态机双重守卫（404/409 + 竞态）+ 批量静默跳过 + audit fire-and-forget；164 admin 路由 35 ADR 端点；4127→**4142 unit PASS**（+15 净增 / 23 case 总 / 含 A 卡 8 + B 卡 15） | opus-4-7 | 0.7w | ✅ |
| ✅ **CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE** 已完成（2026-05-19）| admin-ui 3 primitive 调研 — Card ✅ / Segment ❌ / QuoteBlock ❌ | 静态扫描 0.05w 实际（vs 0.1w 原估）；调研结论：Card 已具 AdminCard 直接消费；Segment 完全缺 + 5 处视图手撸 bottom-border 形态但 spec 是 pill-style + badge / 起 PRE-A 新卡；QuoteBlock 内联实现（spec §5.13 唯一消费） | claude-opus-4-7 主循环 | 0.05w | ✅ |
| ✅ **CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE-A** 已完成（2026-05-19）| Segment primitive 设计 + 实施 | spawn arch-reviewer Opus 1 轮 PASS A（D1-D6 决策清晰 / 0 红线 / 2 黄线全实施 / 2 advisory）+ 5 文件落地（types 38 / impl 203 / index / index.ts export / test 12 case PASS）；WAI-ARIA tabs activate-on-focus + roving tabIndex + ←→/Home/End + Y1 badge active 反转 + Y2 focusOnNextRender ref；4142→**4154 unit PASS**（+12 净增） | Opus（契约）+ opus-4-7（实施） | 0.2w（vs 0.25w 原估） | ✅ |
| ✅ **CHG-SN-7-REDO-02-C** 已完成（2026-05-19）| 前端 /admin/user-submissions Card list 主视图 | lib/user-submissions/{types,api}.ts + SubmissionCard.tsx (230 行 / 3 类 visual icon + 可选 poster + metadata quote + 3 按钮) + UserSubmissionsClient.tsx (200 行 / 4 Segment + 三态 + 分页) + page.tsx + nav 修订 href /admin/submissions→/admin/user-submissions + 12 case PASS（含 Segment 首次业务消费实证）；4154→**4166 unit PASS**（+12 净增 / vs 旧 397 行 DataTable 实施成本下降 50%+） | opus-4-7 | 0.7w (vs 0.8w 原估) | ✅ |
| ✅ **CHG-SN-7-REDO-02-D** 已完成（2026-05-19）| 旧 /admin/submissions deprecation banner（B'' 简化版） | 选 B'' 简化版（仅前端 banner / 后端旧端点不改）+ AdminCard surface='subtle' status='warn' + Next.js Link 跳转 + 1 banner 测试断言；M-SN-9 退役卡承担一次性清理（Y1）；4166→**4167 unit PASS**（+1）；实际 0.1w（vs 0.2w 原估 / 节省 0.1w 避免后端双写复杂度） | opus-4-7（任务卡建议 Haiku 但在 Opus 续会话不擅自降级）| 0.1w | ✅ |
| ✅ **CHG-SN-7-REDO-02-E** 已完成（2026-05-19）| RETRO 验证 + verify 全门禁 + SQL bug 主动修复 | 全 5 verify 命令逐项核验（typecheck/lint/file-size/endpoint-adr/adr-contracts）+ 修补 2 处 SQL bug（userSubmissions.ts v.cover_url → mc.cover_url + LEFT JOIN media_catalog / migration 029 已 DROP videos.cover_url 8 个月）+ 修补 D-124-3..7 changelog 闭环引用 / verify-adr-d-numbers 守卫识别；4167 unit PASS 保持；实际 0.2w（vs 0.3w 原估） | opus-4-7 | 0.2w | ✅ |
| ✅ **CHG-SN-7-REDO-02-F** 已完成（2026-05-19）| Opus 验收 — **A−** | arch-reviewer Opus 1 轮 A−（14 行 §5.13 checklist 12 OK + 1 PARTIAL + 1 DEVIATION-ACCEPTED / ADR-124 11 节闭环 + D-124-1..8 全 closed / 4 真源同步 + verify 5 件套 PASS / admin-ui Segment primitive 沉淀）；扣 0.5 quote 语义映射缺 ADR 落档 + 扣 0.5 3 按钮替换缺 ADR 文档；**REDO-02 milestone 全闭环（A0→F 7 子卡 ~2.5w）** | Opus 验收 | 0.2w | ✅ |

### CHG-SN-7-REDO-03 Settings 区段架构收敛（**~1.5w**，PRE-04 子卡 #14 触发）

> 触发：reference §5.11 显式提醒「sidebar 不应暴露多个 system 子项」，当前 server-next sidebar 暴露 system/{settings,cache,config,monitor,migration} 5 子项 + plan §6 8 类 Tab 实际仅 5 类。

| ID | 标题 | 估时 | 模型 |
|---|---|---|---|
| **CHG-SN-7-REDO-03-A** | ✅ 完成 2026-05-19 / sidebar IA 重构 + 6 旧 URL 308 永久 redirect + ADR-125 / Opus arch-reviewer PASS / 4177 unit PASS | 0.3w 实际 / 0.4w 估 | Opus 主循环 + arch-reviewer Opus 子代理 |
| **CHG-SN-7-REDO-03-B** | ✅ 完成 2026-05-19 / 5 Tab → 8 Tab（+通知/API·Webhook/登录会话 + 图片占位 section）/ 4186 unit PASS | 0.3w 实际 / 0.6w 估 | claude-sonnet-4-6 |
| **CHG-SN-7-REDO-03-C** | ✅ 完成 2026-05-19 / 8 KV 字段扩展（通知 5 + 会话 3）+ ADR-126 / 3 Tab 真实表单 / arch-reviewer Opus PASS / 4190 unit PASS（+13）| 0.3w 实际 | Opus arch-reviewer + claude-sonnet-4-6 主循环 |
| **CHG-SN-7-REDO-03-D** | ✅ 完成 2026-05-19 / arch-reviewer Opus A−（27 项全 ✅ / W1-W4 清理完毕 / W5 MISC 追踪卡登记）/ REDO-03 milestone 全闭环（A→D 4 子卡）| 0.2w 实际 | arch-reviewer (claude-opus-4-7) |

**注**：吸收原 `CHG-SN-7-MISC-SETTINGS-TABS`（M-SN-6 FOLLOWUP 卡）为 REDO-03-B 子任务。

### CHG-SN-7-REDO-04 ✅ Staging 路由处置（方案 A — 独立路由，~1.5w 实际）

> 完成（2026-05-19）：Opus arch-reviewer 裁决方案 A；后端 API 复用 M-SN-3；前端新建完整独立页；ModerationConsole 移除 staging tab + 添加 redirect；admin-nav 新增"暂存发布"条目；8 unit tests PASS。

### CHG-SN-7-REDO-05+ 其他低优先重做（暂无）

PRE-04 16 子卡全部闭环：5 ✅ A 级 + 8 ⚠️ S 级（16 项 MISC 跟踪）+ 4 ❌（REDO-01/02/03/04）。⚠️ S 级页面挂 MISC 卡逐项小修，**不进入 REDO 列表**。

### 估时汇总

| 阶段 | 工时 |
|---|---|
| PRE 阶段（PRE-01 + PRE-02 + PRE-04 + PRE-05） | 1.27w |
| M-SN-SHARED milestone | **0.1w**（SHARED-01 已闭环 / SHARED-02 + 03 实测 admin-ui 已具备能力取消） |
| REDO-01（采集） | 2.55w |
| REDO-02（Submissions） | **~2.75w**（REDO-02-A0 Opus 实测重估 / 原 ~1w 严重低估）|
| REDO-03+（剩余 14 路由） | ~6–10w |
| **M-SN-7 全 milestone** | **~11.0–15.0w**（PRE-04 + SHARED-02 实测累计下调 0.8w） |

### MISC 跟踪卡（PRE-04 子卡审计产出）

| ID | 标题 | 严重度 | 估时 | 触发子卡 |
|---|---|---|---|---|
| **CHG-SN-7-MISC-DASHBOARD-1** | dashboard page__head 2 按钮 onClick 绑定（全站全量采集 / 进入审核台） | ✅ 完成 | 0.05w | #1 |
| **CHG-SN-7-MISC-DASHBOARD-2** | dashboard 4 类卡片数据真实化 + 后端 3 endpoints + ADR-127（与 STATS-EXTEND-ANALYTICS 合并） | ✅ 完成 | 0.7w | #1 + #12 |
| **CHG-SN-7-MISC-DASHBOARD-3** | dashboard 编辑态规则（拖拽 / resize / 全屏 / 卡片库）—— **延后到长期 backlog M-SN-N** | 🟢 P3 | 1.5–2w | #1 |
| ✅ **CHG-SN-7-MISC-VIDEOS-1** 已完成（2026-05-20）| videos poster 尺寸决议固化（32×48 废弃 → 48×72 固化 / reference 4 处 + decisions.md 条目 / 纯文档任务） | ✅ | 0.05w | #4 |
| ✅ **CHG-SN-7-MISC-MERGE-1** 已完成（2026-05-19）| merge Segment 3 类（待审候选 / 已合并 / 已拆分）补全 | ✅ | 0.15w | #6 |
| ✅ **CHG-SN-7-MISC-MERGE-2** 已完成（2026-05-20）| merge 候选 card 形态重做（左右视频卡对比 + 影响预览 + 置信度 pill）/ CandidateExpand card 网格 + 置信度 pill + 影响预览 / SplitSection→MergeSplitSection.tsx(261L) / AuditSection→MergeAuditSection.tsx(133L) / MergeClient.tsx 756→467L / +2 tests / 4337 unit PASS | 🟡 P2 | 0.5–0.8w | #6 |
| ✅ **CHG-SN-7-MISC-SUBTITLES-1** 已完成（2026-05-20）| subtitles KPI 4 列补全（消费 KpiCard + 后端 stats 端点扩展 / ADR-133 / 4264 unit PASS） | ✅ | 0.2w | #7 |
| ✅ **CHG-SN-7-MISC-SUBTITLES-2** 已完成（2026-05-20）| subtitles 上传字幕 action 实装（POST /admin/subtitles / ADR-134 / SubtitleUploadModal / 4266 unit PASS） | ✅ | 0.15w | #7 |
| ✅ **CHG-SN-7-MISC-HOME-1** 已完成（2026-05-20）| home sticky 前台预览实装（1fr/360px 布局 + 右侧 sticky 预览卡 / HomePreviewPanel / 4295 unit PASS） | ✅ | 0.4w | #8 |
| ✅ **CHG-SN-7-MISC-HOME-2** 已完成（2026-05-20）| home page__head actions 完整性核实（预览前台 ghost 按钮 + 新建模块 / PageHeader actions 双按钮 / 11 unit PASS） | ✅ | 0.05w | #8 |
| ✅ **CHG-SN-7-MISC-IMAGE-1** 已完成（2026-05-20）| image-health page__head 2 actions（重扫所有封面 / 批量切 fallback 域）+ ADR-135 / SwitchDomainModal / 4279 unit PASS | ✅ | 0.2w | #11 |
| ✅ **CHG-SN-7-MISC-IMAGE-2** 已完成（2026-05-20）| image-health 破损样本 grid 实装（2:3 ratio + danger dashed border + 错误 overlay / BrokenSamplesGrid / 1fr/1fr split / 4308 unit PASS） | ✅ | 0.3w | #11 |
| ✅ **CHG-SN-7-MISC-USERS-1** 已完成（2026-05-20）| users page head actions（RoleMatrixModal 只读 + InviteUserModal 表单 / 4323 unit PASS） | ✅ | 0.3w | #13 |
| ✅ **CHG-SN-7-MISC-USERS-2** 已完成（2026-05-20）| users KPI 4 列（消费 KpiCard + 后端 users-stats 端点 / ADR-136 Opus PASS / 4332 unit PASS）| ✅ | 0.2w | #13 |
| **CHG-SN-7-MISC-AUDIT-1** | audit 时间穿梭 action（指定时间点状态回放）—— 功能需求待用户确认 | 🟢 P3 | 0.4–0.6w | #15 |
| ✅ **CHG-SN-7-MISC-LOGIN-1** 已完成（2026-05-20）| login card 视觉对齐（400×padding 40 / Brand row 36px logo + 18px title + 11px subtitle / remember checkbox / SSO 占位 disabled / 审计提示 / radial accent 背景 / vitest.config @/stores server-next 修复 / 8 unit PASS / 4347 total PASS） | ✅ | 0.2–0.3w | #16 |
| ✅ **CHG-SN-7-MISC-API-QUERIES-SIZE** 已完成（2026-05-20）| apps/api/db/queries 5 文件主动拆分：videos.ts(1609→313)+internal(193)+mutations(437)+crawler(278)+status(478) / sources.ts(818→405)+types(16)+maintenance(434) / crawlerTasks.ts(628→261)+types(78)+queries(324) / mediaCatalog.ts(577→91)+internal(280)+mutations(235) / imageHealth.ts(648→485)+scan(173) / 13 子文件全部 ≤500 行 / barrel re-export 零 import 改动 / typecheck 全绿 | ✅ | 1.0–1.5w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-API-ROUTES-SIZE** 已完成（2026-05-20）| apps/api/routes/admin 2 文件主动拆分：crawler.ts(960→323) + crawler.tasks.ts(443) + crawler.runs.ts(216) / moderation.ts(533→390) + moderation.douban.ts(161) / 5 文件全部 ≤ 500 行 / typecheck 全绿 / ADR 合规通过 | ✅ | 0.4–0.6w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-API-SERVICES-SIZE** 已完成（2026-05-20）| apps/api services + workers 4 文件主动拆分：crawlerWorker.ts(585→478) + sources(66) + enqueue(54) / VideoMergesService.ts(523→435) + schemas(111) / DoubanService.ts(511→421) + utils(108) / SourceParserService.ts(502→416) + maps(97) / 9 文件全部 ≤ 500 行 / barrel re-export 零 import 改动 / typecheck 全绿 / 4330 unit PASS | ✅ | 0.6–0.9w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-WEB-NEXT-SIZE** 已完成（2026-05-20）| apps/web-next/components/layout/Nav.tsx 580→404 / NavMoreMenu.tsx(188L) 提取 MoreMenu / 4337 unit PASS | 🟢 P3 | 0.15w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-PLAYER-CORE-SIZE** 已完成（2026-05-20）| packages/player + player-core 4 文件主动拆分：step-1 useLayoutDecision（526→16 行 barrel + 5 子文件 ×2 包）/ step-2 Player.tsx（1091→437 / 1085→430；Player/目录 6 子文件：usePlayerState + usePlayerEffects + usePlayerOrchestration + buildControlContext + PlayerOverlays + PlayerChromeBottom）/ 4332 unit PASS / typecheck 全绿 | ✅ | 1.5–2.5w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-VISUAL-CRAWLER** 已完成（2026-05-23）| Crawler 视觉回归 — `tests/visual/crawler/crawler.visual.spec.ts` 7 张 baseline 占位（kpi-row / timeline-card / site-list / site-row-expanded / advanced-menu / runs-list / page-header）；baseline capture 由用户 dev server 起后 `npm run test:visual:update` 手动触发；同 moderation 范式 ae4ea66f | ✅ | 0.1w | REDO-01-J 软门 ✅ |
| ✅ **CHG-SN-7-MISC-AUDIT-PARSER** 已完成（2026-05-19）| 实测脚本本身无 bug / 真因是 changelog 历史遗漏 6 项 D 编号引用 → changelog 补全 / 61/61 D-N 全闭环 | 🟢 P3 | 0.05w | REDO-01-J 验收 ✅ |
| ✅ **CHG-SN-7-MISC-CRAWLER-CSV-EXPORT** 已完成（2026-05-19）| 新建 lib/crawler/csv-export.ts (35 行 / exportCrawlerSitesCsv) + CrawlerClient handleExport 委托调用（28→7 行 / 守卫 491<500）+ 14a/14b 测试拆分 | 🟡 P2 | 0.15w | REDO-01-J 验收 ✅ |
| ✅ **CHG-SN-7-ADR-124-AMENDMENT-1** 已完成（2026-05-19）| 在 decisions.md 追加 AMENDMENT 1 段 / D-124-AMD1-1 quote→title 衍生 + metadata→quote block 映射 + D-124-AMD1-2 3 按钮替换决策 + 5 理由（重验语义由 sources.route_action 承载等）/ ADR-124 主评级 A−→**A**（闭档 2 处 DEVIATION） | 🟡 P2 | 0.05w | REDO-02-F 验收 ✅ |
| ✅ **CHG-SN-7-MISC-VISUAL-SUBMISSIONS** 已完成（2026-05-23）| /admin/user-submissions 视觉回归 — `tests/visual/user-submissions/user-submissions.visual.spec.ts` 6 张 baseline 占位（page-header / segment-bad-src / segment-processed / first-card / pagination / empty-state）；baseline capture 由用户 dev server 起后手动触发；同 moderation 范式 ae4ea66f | ✅ | 0.1w | REDO-02-F 软门 ✅ |
| **CHG-SN-7-MISC-SESSION-FIELDS-CONSUME** | session_timeout_minutes / session_max_concurrent / session_extend_on_activity 三字段当前仅存储 / 需接入会话中间件实际消费（JWT TTL / 并发踢出）— REDO-03-D 验收 W5 追踪 / ADR-128 前置 | 🟡 P2 | ~0.5w | REDO-03-D 验收 W5 |
| ✅ **CHG-SN-7-MISC-MOD-PLAYER** 已完成（2026-05-20）| **审核台播放器接入** 全 3 阶段闭合：FIX-B（commit cb29435e / LinesPanel 共享组件 + 双消费方迁移 / 4254 unit PASS +38）+ FIX-D（commit 56133915 / AdminPlayer 极简接入 + feedback 上报 / 4262 unit PASS +8）+ FIX-CLOSE（commit ae4ea66f / SEQ-20260502-01 全序列收口 + arch-reviewer Opus A− + 5 e2e + visual baseline 占位）；详 archive/changelog/changelog_M-SN-2-to-7_20260523.md | ✅ | ~2.5w 实际 | SEQ-20260502-01 ✅ 已闭合 |
| ✅ **CHG-SN-7-MISC-USER-SUBMISSIONS-PROCESSED-FILTER** 已完成（2026-05-19）| service ListUserSubmissionsQuerySchema 加 `processed_or_rejected` 枚举 + queries WHERE 拼 `status IN ('processed','rejected')` + 前端 lib/types 扩 + UserSubmissionsClient 改为 segment='processed' 时 status='processed_or_rejected'（移除客户端 filter / 修复分页失真 / 闭档 spec §5.13 #7 PARTIAL）| 🟡 P2 | 0.15w | REDO-02-F 验收 ✅ |

### CHG-SN-7-MISC-MOD-PLAYER 追踪卡展开（2026-05-19，2026-05-23 状态修正）

> 父序列：SEQ-20260502-01（M-SN-4 收口扫尾）
> **状态**：✅ **全 3 阶段闭合（2026-05-20）** — FIX-B (cb29435e) + FIX-D (56133915) + FIX-CLOSE (ae4ea66f)；详细 changelog 已归档至 `docs/archive/changelog/changelog_M-SN-2-to-7_20260523.md`
> 实际执行顺序：FIX-B ✅ → FIX-D ✅ → FIX-CLOSE ✅
> 总实际工时：~2.5w（与原估 2.2-2.5w 一致）
> **下方阶段 spec 保留供未来审计追溯，不再代表待办事项**

#### 阶段 1 — FIX-B：LinesPanel 共享组件提取（~1.5w，强制 Opus 子代理）

**目标**：将当前两处独立实装（审核台 LinesPanel.tsx 247 行 + VideoEditDrawer TabLines.tsx 214 行）提取为 `packages/admin-ui` 共享复合组件，同时修复 30 行平铺 → 线路聚合视图的信息密度问题。

**文件范围**：
- 新建：`packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts`（`LineAggregate` / `EpisodeMini` / `LinesPanelProps` 契约）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/aggregate.ts`（groupSourcesByLine 纯函数 + 聚合状态规则）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/lines-panel.tsx`（共享组件实体，compact/regular/comfortable 三密度）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/index.ts`（barrel）
- 新建：`packages/admin-ui/src/components/cell/signal-chip.tsx`（SignalChip atom：probe/render × ok/partial/dead/pending/unknown 5 态）
- 新建：`packages/admin-ui/src/components/cell/signal-chip.types.ts`
- 改：`packages/admin-ui/src/index.ts`（导出 LinesPanel + SignalChip）
- 改：`apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（迁移为消费共享组件，`compact` density，暴露 `onLineSelect` 回调）
- 改：`apps/server-next/src/app/admin/videos/_client/_videoEdit/TabLines.tsx`（迁移为消费共享组件，`regular` density）
- 新建：`tests/unit/components/admin-ui/composite/lines-panel/aggregate.test.ts`（≥ 8 case：单线路/多集/跨站同名/全 dead/全 pending/部分 active）
- 新建：`tests/unit/components/admin-ui/cell/signal-chip.test.tsx`（≥ 10 case）

**关键约束**：
- ❗ 强制升 Opus 子代理（CLAUDE.md §模型路由第 1 条：新共享组件 API 契约）
- 聚合键 = `(source_site_key, source_name)` 复合（ADR-114-NEGATED LP-03 既定）
- 聚合规则：全 ok→ok / 任意 ok 且非全 ok→partial / 全 dead→dead / 全 pending→pending / 其他→unknown
- 零硬编码颜色（CSS 变量，grep 验证）
- `onLineSelect(key: string, firstActiveUrl: string | null)` 回调供 FIX-D 消费

**估时**：~1.5w（含 Opus 评审 + 双消费方迁移 + 视觉对齐复核）
**建议模型**：spawn arch-reviewer (claude-opus-4-7) API 契约设计 + claude-sonnet-4-6 主循环实施

---

#### 阶段 2 — FIX-D：极简 AdminPlayer 接入（~0.5w）

**目标**：替换 `PendingCenter.tsx` 中的 `▶` 静态占位为可播放的 `AdminPlayer`，接入 player-core，响应 LinesPanel 选中线路切换。

**前置**：FIX-B 完成（`onLineSelect` 契约落地）

**文件范围**：
- 新建：`apps/server-next/src/lib/moderation/use-selected-line.ts`（共享选中线路状态 hook，LinesPanel ↔ AdminPlayer 桥接）
- 新建：`apps/server-next/src/app/admin/moderation/_client/AdminPlayer.tsx`（包装 player-core `<Player>`，极简范围：播放/暂停/进度/集数切换/错误降级，**不接入 GlobalPlayerHost**）
- 改：`apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx`（替换 `{/* Video player placeholder */}` div 为 `<AdminPlayer>`）
- 新建：`tests/unit/admin-moderation/admin-player.test.tsx`（≥ 5 case：源切换/集数切换/错误降级/null 源占位/feedback 上报去抖）

**极简范围（含/不含）**：
- ✅ 播放/暂停 / 进度条 / 集数显示 / 错误降级占位
- ❌ 字幕 / 影院模式 / 画中画 / 镜头切换 / GlobalPlayerHost

**feedback 上报（D-17）**：
- `onFirstFrame` → POST /v1/feedback/playback {success: true}
- `onError` → POST /v1/feedback/playback {success: false, errorCode}
- PII 红线：不上报 userId / IP

**估时**：~0.5w
**建议模型**：claude-sonnet-4-6（player-core 已有 Player export，无新契约）

---

#### 阶段 3 — FIX-CLOSE：投产对齐收口（~0.2w）

**目标**：arch-reviewer Opus 全序列评级（目标 A−），e2e 黄金路径，visual baseline 归档。

**前置**：FIX-B + FIX-D 全部完成

**验收内容**：
- arch-reviewer Opus 评级 spec §5.2 checklist + SEQ-20260502-01 已知偏离闭档
- e2e：`tests/e2e/admin/moderation/lines-aggregate-display.spec.ts` + `player-integration.spec.ts`
- visual baseline 9 张：lines-panel-collapsed/expanded、right-pane-detail/history/similar、filter-preset-popover、player-loaded、player-error、edit-drawer-lines

**建议模型**：spawn arch-reviewer (claude-opus-4-7)

---

## M-SN-6 milestone 关闭声明（2026-05-17）

CHG-SN-6-29-AUDIT arch-reviewer (Opus) 评级 **A−** + PATCH-1 + PATCH-2 双修闭环 → **M-SN-6 正式关闭**。

**M-SN-6 最终交付指标**：
- 任务卡：47 张（44 主体 + AUDIT + PATCH-1 + PATCH-2）
- 单测：3659 → **4018 PASS**（+359）
- R-MID-1 系统化：6.5 → **12 次**（13 → 36 strict / +23）
- v1 crawler 写端点 audit 覆盖：**12/13（非 deprecated 100%）**
- 共享原语沉淀：4 cell + 2 form + 1 csv-export 工具 + N badge
- 新视图/Drawer：/admin/audit + image-health + crawler（4 视图 + 3 Drawer + 4 控制按钮）+ SettingsContainer 5/5 Tab（**注：plan §6 明列 8 类 Tab；实际交付 5 类，缺 4 类 → CHG-SN-7-MISC-SETTINGS-TABS 跟踪**）
- csv-export 消费方：5（TaskLogsDrawer + AuditClient + UsersListClient + SubmissionsListClient + VideoListClient）
- ADR 新增：ADR-118 accepted / ADR-119/120-NEGATED / ADR-105 AMENDMENT
- 文件大小硬上限：**部分合规**（CHG-SN-6-29-FOLLOWUP 2026-05-17 复核实测：crawler 域 PATCH-1 后全部 ≤ 500；但 M-SN-6 全工作目录扫描发现 7 文件超限 — 2 M-SN-6 新增（AuditClient 558 / ImageHealthClient 501）+ 5 历史遗留。已立 CHG-SN-7-PRE-01 守卫 + MISC-FILE-SIZE 拆分预案兜底）

**M-SN-7 入口**（**2026-05-18 范围扩展**）：M-SN-7 主线由"清债务"转为"**设计稿对齐重做**"（用户复核发现 server-next 后台架构性偏离设计稿 v2.1）。

新调用顺序（计划文档 §4）：
1. **CHG-SN-7-PRE-04** 全量审计 16 路由 → 首张子卡 /admin/dashboard §5.1（用户决策"首推 PRE-04"）
2. PRE-01 文件大小守卫 / PRE-02 ADR-121 协议化 / PRE-05 ADR-123 schema（可并行）
3. **M-SN-SHARED-01/02/03** 共享原语前置（KpiCard + ExpandableTable + Spark）
4. **REDO-01-A → J** 采集控制重做
5. **REDO-02** Submissions Card list 重做
6. REDO-03+ 其他 14 路由（PRE-04 排序后填充）

详见上方「设计稿对齐重做」段 + `docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md` 全文。

~~PRE-03 CrawlerSitesTab 外置 batch bar 修正~~ → **取消**（整页要重做）。

---

## [SEQ-20260521-01] docs 大清理 + manual 工程地基（执行序列）

- **状态**：✅ 已完成（3/3 卡全部 PASS：A ✅ + B ✅ + C ✅ 2026-05-21）— SEQ 收尾
- **创建时间**：2026-05-21
- **目标**：清理 docs/ 历史文档遗存（避免新开发被旧规范污染） + 新建 docs/manual/ 说明书工程骨架（M-SN-8 前置）
- **背景**：用户复核 server-next 实际可用性发现 13 个 UX 缺口（mock 视图 / 死按钮 / 断链 / UUID 输入 / dashboard 模板 等）；提出"实现 + 说明书双轨"开发模式；要求清理历史文档作为入门第 0 步
- **依赖**：M-SN-6 已关闭 / M-SN-7 REDO-01/02/03 全闭环 / PRE-04 全量审计 A− PASS
- **真源**：用户决策三连（2026-05-21）：① 全归档 27 份 ② tracks.md 保留顶层 ③ admin-module-template.md 保持现状
- **节奏**：用户决策"仅先 C1 + 看状况"——A 跑完后视 verify 红线情况再放 B/C 上手

### 子卡序列（3 卡）

1. **CHG-SN-7-CLEANUP-01-A** · docs 归档（26 mv + 4 rm 纯归档不改引用）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet（CLAUDE.md §模型路由 Haiku 适用 #2 文档归档；当前 opus 续会话不擅自降级）
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **范围**：见原 tasks.md 卡片（已闭环移除）
   - **e2e 黄金路径**：无（纯文档归档）
   - **完成备注**：
     - 实际 26 mv（原估 27 含 tracks.md，用户决策保留顶层 → 实际 26）+ 4 rm（2 audit stub + baseline_20260418/ + handoff_20260422/）+ 4 新 archive README + 2 task 文件 + 1 副作用 unstage = 总 36 staged
     - 4 子目录创建：milestone-audits(6) / m-sn-7-redo(3) / design-iterations(11) / admin-v1(4)；server_next_view_template + PRE-01-A-drill 进 archive/2026Q2/ 根
     - tasks.md 卡片"范围 27"为估算口径偏差 1（含 tracks.md 决策推翻），不影响 mv 实际操作
     - typecheck PASS / lint PASS（仅 pre-existing img 警告，与本卡无关）
     - verify:adr-contracts pre-existing 红线 `apps/server-next/src/app/login/page.tsx:7 background+backgroundColor`（CHG-SN-7-MISC-LOGIN-1 提交，与本卡无关）— 已 stash 验证非本卡引入
     - **预期失败点观察**：本卡未跑 markdown 链接 grep；该工作转 CHG-SN-7-CLEANUP-01-B 启动时统一 grep 评估
     - 工时实际 ~0.15w
   - **工时估算**：0.15w / 实际 ~0.15w

2. **CHG-SN-7-CLEANUP-01-B** · 引用改写 + docs/README 重写 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus xhigh 续会话）
   - **子代理**：无
   - **完成备注**：
     - grep 引用面评估实证：CLAUDE.md 零引用（决策 3 admin-module-template 不动 100% 安全）→ CLAUDE.md 修订移出本卡范围
     - 8 份宿主 sed 批量改 26 条映射规则（M-SN-6-...-17-RECHECK.md 必须先于 -17.md 防前缀冲突）：task-queue.md 37 / changelog.md 30 / decisions.md 12 / server_next_plan 7 / tracks.md 4 / logging-rules.md 1 / reference.md 1 / architecture.md 1
     - docs/README.md 整体重写：§1 权威文档清单精简 + §3 已归档参考分 5 子段 + §6 新增 M-SN-8 manual 入口（4 条硬约束 H1-H4 + 双轨流）
     - 0 残留验证：26 项归档文件全部在非 archive 路径 0 命中
     - typecheck PASS / lint PASS（FULL TURBO 缓存命中）
     - 总 diff：10 文件 +232 / -135 行
   - **工时估算**：0.18w / 实际 ~0.18w

3. **CHG-SN-7-CLEANUP-01-C** · docs/manual 骨架 + verify:manual-coverage 守卫 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus xhigh 续会话）
   - **子代理**：无
   - **完成备注**：
     - manual 35 文件骨架全部新建：
       - 1 主 README + 90-glossary（含 20 术语 + 7 缩写）
       - _template/PAGE_TEMPLATE.md（8 章节模板）+ _template/WORKFLOW_TEMPLATE.md
       - 00-roles-and-permissions（5 角色矩阵 + 11 操作权限速查）+ 01-getting-started（含 10 快捷键）
       - 10-workflows/ README + W1 金票（完整骨架含反例与失败处理）+ W2-W5 简骨架
       - 20-pages/ README + 15 P-* 骨架（按 admin 路由 1:1，含 P-submissions-deprecated 特殊映射）
       - 30-pickers/ README + 5 picker 骨架（VideoPicker / SourceLinePicker / ContentRefPicker / UserPicker / SitePicker）
     - scripts/verify-manual-coverage.mjs 守卫：扫 apps/server-next/src/app/admin/*/page.tsx + /login → 比对 docs/manual/20-pages/ → 缺失 FAIL / 多余 WARN
     - KNOWN_NO_MANUAL 豁免清单：dev / system / analytics / staging（4 项 stub 路由）
     - SPECIAL_MAP：submissions → P-submissions-deprecated.md（deprecation banner 特殊映射）
     - package.json 加 "verify:manual-coverage"（位于 file-size-budget 与 migrate 之间）
     - 实测：15 admin 路由 ↔ 15 P-* manual = 1:1 PASS
     - typecheck + lint PASS（FULL TURBO 缓存命中）
     - preflight.sh 集成推迟（独立 follow-up 卡 CHG-SN-7-MISC-PREFLIGHT-MANUAL，按需启动）
   - **工时估算**：0.3w / 实际 ~0.25w

### 关键约束

- 用户决策固化：全归档 27 份 / tracks.md 保留 / admin-module-template.md 保持单文件
- 每子卡独立 commit + 独立 typecheck + lint + verify 验收
- A 子卡验收后视 verify 红线数量决定 B 子卡范围（红线越多说明引用面越大）

---

## [SEQ-20260521-02] M-SN-8 Critical Path Hardening · 采集→审核→上架 金票闭合 + Picker 消灭 UUID（执行序列）

- **状态**：✅ **SEQ 几近完结**（7/9 ✅ + 1 NEGATED + 1 ADR 前置 -04 待启）— 01/02/03/SHARED-04-A/05/06/08 ✅ + 07 ❌ NEGATED；**CHG-SN-8-06 重大发现**：approve_and_publish 端点已存在，零 ADR 已闭合；**仅剩 CHG-SN-8-04 TabSimilar 需新端点 ADR 前置**，独立 SEQ-20260521-03 重起
- **创建时间**：2026-05-21
- **目标**：闭合 W1 金票（采集 → 审核 → 上架）端到端业务链路；消灭 UUID 输入（H4）；删死按钮（H2）；删 mock（H1）；通断链（H3）
- **背景**：用户复核 server-next 实际可用性发现 13 个 UX 缺口；docs/manual/10-workflows/W1-crawl-to-publish.md §3 反例段明示 5 个修复点
- **依赖**：SEQ-20260521-01 全部 3 卡 PASS（commit 7a0f75b7 manual 骨架就位）
- **真源**：`docs/manual/10-workflows/W1-crawl-to-publish.md` + `docs/manual/README.md` §3 四条硬约束
- **节奏**：用户决策"自动化执行"——按子卡顺序自动推进，遇 BLOCKER 才停；每张卡独立 commit + 独立验收

### 子卡序列（9 卡）

1. **CHG-SN-8-01** · Crawler「全站全量」改非主操作 + 双重确认（输入"全量"防误触）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus 续会话）
   - **子代理**：无
   - **完成备注**：
     - CrawlerClient.tsx：拆 `handleRunAll` → `handleRunAllIncremental` + `handleRunAllFull`；主按钮 testid `crawler-run-all-btn` → `crawler-run-all-incremental-btn` / label "全站全量" → "全站增量" / onClick → incremental
     - 主按钮路径：单次 confirm「确定对全站发起增量采集？」→ `runCrawlerAll('incremental')`
     - 全量路径（高级 dropdown，danger 样式）：① confirm「确定对全站发起【全量】采集？」② prompt 要求输入"全量"二字，输错静默中止 → `runCrawlerAll('full')`
     - CrawlerAdvancedMenu.tsx：扩 props `onRunAllFull` + `runAllFullPending`；items 顶部加 `run_all_full` 项（danger + separator + 动态 pending label）；现 5 items（run_all_full / scheduler / reindex / stop_all / freeze）
     - P-crawler.md DoD §0 已填：§1/§2/§3.1.1+§3.1.2/§4.1+§4.2+§4.3/§8 关系图；§3.2/§3.3 留待后续卡填
     - CrawlerClient.test.tsx：用例 #2/#11/#12/#13 更新（incremental + 新 testid）+ 补 4 新用例 #13a/#13b/#13c/#13d（advanced menu 双重 confirm / 输错中止 / 第一次取消 / freeze 拦截）
     - 验收：58/58 CrawlerClient.test PASS / typecheck + lint + verify:manual-coverage PASS
     - 全量 unit 单跑 PASS；并跑偶发 fail 2 文件（VideoImageSection / StagingEditPanel）经 stash 验证为 pre-existing flaky 与本卡无关
   - **关联问题**：用户问题 #4「全站全量采集非常用操作，改为全站增量 + 二次确认」
   - **工时估算**：0.1w / 实际 ~0.12w

2. **CHG-SN-8-02** · Crawler 「最近采集」列升级 status pill — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - 范围收敛：实施前评估发现「增量/全量 inline btn」已存在（CHG-SN-7-REDO-01-D 落地）；「调度 mode pill」需 cross-fetch `AutoCrawlConfig.perSiteOverrides`（`CrawlerSite` 类型无 schedulers 字段）→ 工时会爆 0.15w 上限；本卡聚焦最痛点「lastCrawl 列无 status 视觉」
     - 实施：crawler-site-columns-v2.tsx 升级 `lastCrawl` cell — 单纯相对时间 → status pill（成功 ok / 失败 failed / 运行中 running / 未采集 null）+ 相对时间双行视觉；列宽 110 → 130
     - 调度列推迟到 **CHG-SN-8-02-B**（独立 follow-up，需先决策是否扩 CrawlerSite type 加 scheduleMode 字段以避免 cross-fetch）
     - 测试 +3 用例（#13e/#13f/#13g：ok pill / failed pill / null pill）；总 61/61 PASS
     - typecheck + lint + verify:manual-coverage PASS
     - P-crawler.md §3.2 / §5 字段 / §6 状态颜色 / §7 FAQ 全部填写完整
   - **关联问题**：用户问题 #11 「列显示不完整」最痛点（看不到上次成功/失败）
   - **follow-up**：CHG-SN-8-02-B 调度列（需先评估 AutoCrawlConfig fetch 时机或 row-level 字段扩展）
   - **工时估算**：0.15w / 实际 ~0.1w（范围收敛）

3. **CHG-SN-8-03** · 采集 toast → /admin/moderation?run_id 软深链（W1 金票 ②）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案选型**：评估后选**软深链**（前端 toast action + URL banner，不改后端）；硬过滤（后端 GET pending-queue 加 ?runId= filter）触发 plan §4.5 ADR-端点先后协议 → 推迟 CHG-SN-8-03-B
   - **完成备注**：
     - CrawlerClient.tsx：导入 useRouter；增 helper `buildModerationDeepLinkAction(runId)` 返回 Toast action `{label:'查看本次新增视频', onClick}`；handleRunAllIncremental + handleRunAllFull 两个 toast 加 action
     - 新建 RunInfoBanner.tsx（AdminCard surface='subtle' status='ok' + 「清除筛选」按钮）
     - ModerationConsole 增 `runIdParam` 读 query + `dismissRunBanner` 移除 run_id 参数；条件渲染 RunInfoBanner（在 Segment tabs 上方）
     - CrawlerClient.test 顶层 mock `next/navigation`（routerPushMock 共享），补 1 用例 #13h（action 存在 + onClick 触发 router.push）
     - 新建 RunInfoBanner.test 4 用例（runId 短 ID / 文案 / dismiss / data-testid）
     - typecheck PASS（修 1 个 AdminCard status='info' → 'ok' 类型约束 — admin-ui Card status 只支持 ok/warn/danger）
     - 62/62 CrawlerClient PASS + 4/4 RunInfoBanner PASS = 全绿
     - 文档：P-crawler §3.3 完整填写 / P-moderation §0/§1/§2/§3.0/§8 填写 / W1 反例段 #1+#2 勾掉 ✅
   - **关联问题**：H3 链路打通 / W1 金票反例 #2
   - **follow-up**：CHG-SN-8-03-B（后端 pending-queue 接 runId filter；需起 ADR + R-MID-1 同步）
   - **工时估算**：0.15w / 实际 ~0.18w

4. **M-SN-SHARED-04-A** · VideoPicker 业务原语沉淀 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（0 红线 / 0 红条件）
   - **完成备注**：
     - Step 0 spawn arch-reviewer Opus 子代理：D1-D11 11 维度产出（组件分层 / 数据模型 / Props API / fetcher 注入 / 键盘 a11y / 状态机 / 错误态 / export 清单 / 文件结构 / 测试 surface / 风险）；评级 **A−**（v1 不公开 PickerDialog 子件为最小公开面，未来 SourceLinePicker 复用时再提升 export）
     - Step 1 packages/admin-ui/src/components/pickers/video-picker.types.ts（PickerVideoItem / VideoPickerFilter / VideoPickerFetcher / VideoPickerFetchParams / VideoPickerFetchResult / SingleVideoPickerProps / MultipleVideoPickerProps / VideoPickerProps / DialogState）
     - Step 2 picker-result-row.tsx + picker-trigger.tsx + picker-dialog.tsx + video-picker.tsx + index.ts 共 5 实施文件（types 1 + 实施 5 = 6 文件）
     - Step 3 packages/admin-ui/src/index.ts 加 `export * from './components/pickers'`
     - Step 4 单测 14/14 PASS（覆盖 D10 列出全部 14 用例：触发器渲染 / 多选回显 / Dialog 开关 / debounce 300ms / 搜索结果 / 单选确认 / 多选 staging / 多选取消 / 空结果 / 网络错误 / 键盘 ArrowDown+Enter / disabled / 触发器清除）
     - Step 5 docs/manual/30-pickers/VideoPicker.md 8 章节定稿（含消费方 fetcher 注入示例）
     - 实施 1 偏离 OpenAI 子代理建议：AdminInput 不 forwardRef → 用 dialog body querySelector('input') 替代 ref-based focus；不影响功能
     - 1 type adjust：EmptyState 不接受 data-testid → wrap 在 `<div data-testid>` 内
     - typecheck + lint + verify:manual-coverage 全 PASS
   - **关联问题**：用户问题 #8（字幕 UUID）+ #10（首页模块 UUID）+ #7（合并入口）的钥匙
   - **后续**：CHG-SN-8-08 视频库合并入口可消费此 picker；字幕上传 / 首页模块的废 UUID 改造在独立 follow-up（不阻塞 SEQ）
   - **工时估算**：0.3-0.4w / 实际 ~0.35w

5. **CHG-SN-8-04** · 审核台 RightPane TabSimilar 实装 — 状态：✅ **已完成**（由 SEQ-20260521-03 拆为 -ADR/-EP/-VIEW 3 子卡兑现）
   - **重定向**：原占位卡 → 实际由 **SEQ-20260521-03** 3 子卡完成：
     - CHG-SN-8-04-ADR ✅（2026-05-21 / Opus arch-reviewer A− / ADR-137）
     - CHG-SN-8-04-EP ✅（2026-05-21 / 端点 + Service + Queries + 13 单测）
     - CHG-SN-8-04-VIEW ✅（2026-05-21 / TabSimilar 实装 + merge 深链 + 5 单测）
   - **关联问题**：用户问题 #5 + #7 → W1 反例 #3 **完全闭合**
   - **状态修订**：DOCS-CLEANUP-DEBT 2026-05-25（原 ⬜ 占位卡描述过时）

6. **CHG-SN-8-05** · 审核台 RightPane 批量「重测此视频线路」按钮 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案选型**：原任务卡是 per-line inline 重测但需改 LinesPanel API（共享组件 API 契约 → Opus 评审协议）→ 收敛为审核台 TabDetail 顶部「批量重测此视频线路」按钮（不动 admin-ui 公开 API）；per-line 推迟到 CHG-SN-8-05-B
   - **完成备注**：
     - TabDetail.tsx 顶部加 actions row + AdminButton 「重测此视频线路」+ loading 态
     - handleReprobeAll：listVideoSources → Map 去重 (siteKey, sourceName) → Promise.allSettled 循环 reprobeRoute → 汇总 toast（成功/部分失败/全失败 3 态）+ 处理空线路 / fetch 错误
     - reprobeRoute 与 listVideoSources 现成 API，零新端点 / 零 ADR
     - TabDetailReprobe.test 4 用例 PASS（按钮渲染 / 调用去重 / 部分失败 warn / fetch 错误 danger）
     - typecheck + lint + verify:manual-coverage PASS
     - W1 反例 #4 ✅；P-moderation §3.1a 完整填写
   - **关联问题**：W1 金票反例 #4「探/播 待测」无测试入口
   - **follow-up**：CHG-SN-8-05-B（per-line inline 重测需 LinesPanel API 扩展 + Opus 评审）
   - **工时估算**：0.2w / 实际 ~0.2w

7. **CHG-SN-8-06** · 审核台「通过即上架」开关 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **重大发现**：`approve_and_publish` action **已存在**（apps/api/src/routes/admin/videos.ts:35 + reviewVideo signature 已支持），admin only；本卡**零新端点 / 零 ADR**，与原任务卡估时假设不符
   - **完成备注**：
     - lib/moderation/api.ts approveVideo 加 andPublish 可选参数（默认 false）；true → 'approve_and_publish'
     - ModerationConsole 增 approveAndPublishOn state + sessionStorage 持久化（key: `admin.moderation.approveAndPublishOn.v1`）
     - Segment tabs 右侧加 toggle 标签（仅 pending tab 显示）：off「通过 → 暂存」 / on「✓ 通过即上架」+ title 解释
     - handleApprove 串接：调 approveVideo(id, approveAndPublishOn)
     - moderation-api.test 补 3 用例（默认 / 显式 false / true）；15/15 PASS
     - P-moderation §3.1b 完整填写（含权限说明 moderator vs admin）
     - W1 反例 #5 从 ⚠️ 升级为 ✅（admin 有 toggle / moderator IA 路径保留）
     - typecheck + lint + verify:manual-coverage PASS
   - **关联问题**：W1 金票反例 #5「通过后 staging 多走一步」
   - **工时估算**：0.25w 原（假设端点扩展）/ 实际 ~0.1w（端点已存在）

8. **CHG-SN-8-07** · /admin/staging → /admin/moderation?tab=staging 单一真源 — 状态：❌ **NEGATED**（2026-05-21）
   - **NEGATED 理由**：与 **CHG-SN-7-REDO-04 Opus arch-reviewer 已闭合裁决「独立路由」**直接冲突（commit 范围内 staging tab 已从 moderation 移除 + 新建 /admin/staging 独立页 + ModerationConsole router.replace 把 ?tab=staging 反向跳独立路由）。本卡草拟时未识别 REDO-04 裁决；按 CLAUDE.md「主循环不得直接改写架构决策 / 必须先 spawn Opus 子代理出具方案」+ §模型路由「不得自动推翻已闭合裁决」原则，本卡 NEGATED 不实施
   - **重启路径**：若未来确认要反转 IA 决策（合并回 moderation tab），必须：① 起新 ADR 修订 REDO-04 → ② Opus arch-reviewer 评审 → ③ 落 docs/decisions.md NEGATED-ADR 范式 → ④ 起新实施卡
   - **不在范围**：本会话不推翻 REDO-04 裁决

9. **CHG-SN-8-08** · 视频库行级「发起合并」深链 + Merge 页接 candidate_a — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案收敛**：原任务卡含 VideoPicker 选 candidate_b 集成；本卡先打通入口（dropdown item + 深链 + banner），VideoPicker 集成留 -08-B follow-up
   - **完成备注**：
     - VideoRowActions.tsx：导入 useRouter；buildItems 加「发起合并」item（separator）；onClick → `router.push('/admin/merge?candidate_a=<id>&from=videos')`
     - MergeClient.tsx：导入 useRouter + useSearchParams；读 ?candidate_a + ?from；条件渲染 AdminCard banner「已锁定候选 A: <短 ID>」+「清除」按钮（清除时仅删 candidate_a + from 保留其它 params）
     - MergeCandidateBanner.test 3 用例 PASS（无 query 不渲染 / 有 query 渲染 + 短 ID + 来源文案 / 清除按钮调 router.replace 保留其它 params）
     - W4 工作流入口章节更新「从视频库进入」标 ✅；CHG-SN-8-04 类似 tab 入口标「待启动」
     - typecheck + lint + verify:manual-coverage PASS
   - **关联问题**：用户问题 #7「合并拆分页没有入口」
   - **follow-up**：CHG-SN-8-08-B（merge 页接 VideoPicker 直接选 candidate_b 完成合并，免转 candidate 列表）
   - **工时估算**：0.2w / 实际 ~0.2w

### SEQ-20260521-02 关键约束

- **9 卡按序执行**：第 4 卡（VideoPicker）可与 1/2/3 并行但作为 8/9 的硬前置
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**
- **遇 BLOCKER 必停**：CHG-SN-8-04 端点起 ADR 前置 / CHG-SN-8-06 端点扩展 ADR 前置 — 若需起 ADR 而 plan §4.5 协议要求 Opus PASS 才能起实施，则起 ADR 卡 + 等 Opus
- **DoD §0 强制**：每卡先回填 docs/manual/20-pages/P-<slug>.md §3 草稿，PASS 前定稿
- **总工时估算**：~1.9w（含 ADR 风险缓冲）

---

## [SEQ-20260521-03] CHG-SN-8-04 TabSimilar — 类似视频召回 ADR + 端点 + 视图（执行序列）

- **状态**：✅ **SEQ 全部完结**（3/3 卡 PASS：-ADR ✅ + -EP ✅ + -VIEW ✅ 2026-05-21）— W1 反例 #3 完全闭合
- **创建时间**：2026-05-21
- **目标**：W1 金票反例 #3「审核台右栏类似 Tab 是占位」彻底闭合 — 起新端点 `GET /admin/moderation/:id/similar` + 召回算法 + TabSimilar 实装
- **背景**：SEQ-20260521-02 跳过 -04 是因为新端点触发 plan §4.5 ADR-端点先后协议；本 SEQ 起 ADR 卡 + Opus 评审 + 实施
- **依赖**：SEQ-20260521-02 已完结（7/9 ✅ + 1 NEGATED）；VideoPicker 已就绪（M-SN-SHARED-04-A 可被 TabSimilar 复用作"手动合并目标选择"扩展面）

### 子卡序列（3 卡）

1. **CHG-SN-8-04-ADR** · ADR-137 起草（类似视频召回端点协议）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（0 红线 + 1 非阻塞建议 N1）
   - **完成备注**：
     - spawn arch-reviewer Opus 1 轮：ADR-137 11 节完整正文（决策摘要 / 背景 / D-137-1..6 决策 / 端点契约表 / SQL 设计 / Response 结构 / zod schema / 性能 baseline / 分层约束 / 4 文件 R-MID-1 GET 简化版 / 关联 ADR）
     - D-137-1 算法采纳方案 A（纯字段过滤 + Service 层加权评分）
     - D-137-2 评分公式 4 维（type +40 / year delta +25 / country +15 / genres Jaccard +20）
     - D-137-3 权限 moderator+admin
     - D-137-4 query params `?limit=10` + `?yearRange=5`
     - D-137-5 GET 只读不写 audit → R-MID-1 降级 4 文件
     - D-137-6 性能 p95 ≤ 200ms / 粗筛 LIMIT 50
     - **重要发现**：年份/国家/genres 字段不在 videos 表（migration 029 已迁），需 JOIN media_catalog（实施时利用 idx_catalog_type_year / idx_catalog_genres GIN 索引）
     - N1 非阻塞建议（跨类型相似召回 fallback）登记 ADR §11 末段；如未来用户反馈漏召回明显，立独立 CHG-SN-8-04-N1 follow-up 卡
     - decisions.md ADR-137 完整章节落盘（D-137-1..6 含初始 Accepted 闭环）
     - plan §9 ADR 索引推进至 ADR-137 Accepted
     - verify:adr-d-numbers advisory：6 个 D-137-* 编号已通过 changelog 闭环（本卡条目明示）
   - **关联问题**：W1 金票反例 #3「类似 Tab 占位」
   - **工时估算**：0.15w / 实际 ~0.15w（含 Opus 评审 1 轮）

2. **CHG-SN-8-04-EP** · 端点 + Service + Queries 实施（ADR-137 落地）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（按 ADR-137 直接实施）
   - **完成备注**：
     - queries/moderation.ts：新增 `findVideoFeatures(db, id)` 返回 VideoFeatures | null（JOIN media_catalog）+ `listSimilarCandidates(db, query)` 粗筛 LIMIT 50（按 ADR §5 SQL）
     - ModerationService.ts：新增 `listSimilar(id, opts)` 方法（404 NOT_FOUND if target null → 调 candidates → computeSimilarityScore 4 维加权 → minScore=10 过滤 → score desc 排序 → top-N 截断 → camelCase 映射）；导出 `SimilarVideoItem` 类型 + `computeSimilarityScore` 纯函数
     - routes/admin/moderation.ts：新增 `SimilarPathParams` + `SimilarQueryParams` zod schema；新增 `GET /admin/moderation/:id/similar` handler（双 zod 校验 + AppError NOT_FOUND → 404 + 500 兜底）
     - moderation-similar.test 13 用例 PASS（happy path / NOT_FOUND / 空 / limit / yearRange / minScore 过滤 + computeSimilarityScore 7 公式用例）
     - **顺手修 pre-existing 红线**：apps/server-next/src/app/login/page.tsx:7 background+backgroundColor → backgroundColor+backgroundImage（CHG-SN-7-MISC-LOGIN-1 引入的 shorthand 冲突已修，verify:style-shorthand-conflict 0 命中）
     - typecheck + lint + verify:adr-contracts 全 PASS（含 endpoint-adr 173 路由对齐 44 ADR 端点）
     - **关键调整**：ADR-137 §4 标题从 `### 4. 端点契约` 改为 `### 端点契约`（去掉编号）以匹配 adr-parser.mjs 正则
   - **关联**：W1 反例 #3 接近闭合（端点就绪，剩 -VIEW 卡）
   - **工时估算**：0.2w / 实际 ~0.25w（含 pre-existing 红线修复 + parser 编号调整）

3. **CHG-SN-8-04-VIEW** · TabSimilar 实装 + 测试 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - `apps/server-next/src/lib/moderation/api.ts`：新增 `SimilarVideoItem` 类型 + `ListSimilarVideosOptions` + `listSimilarVideos(videoId, opts)` 客户端封装（调 `GET /admin/moderation/:id/similar`）
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar.tsx`：从 47 行占位扩展为 145 行真实组件 — 4 态机（loading / results / empty / error）+ useEffect cancellable fetch（videoId 变化或重试时取消 stale）+ 列表行（标题 + meta + similarityScore pill + 「发起合并」按钮）+ 行级 router.push 深链至 /admin/merge?candidate_a=<视频>&candidate_b=<相似>&from=moderation
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/index.tsx`：TabSimilar 调用补 `videoId={v.id}` prop
     - TabSimilar.test 5 用例 PASS（loading / 列表渲染 / merge 深链跳转 / 空召回 / 网络错误）
     - typecheck + lint + verify:adr-contracts + verify:manual-coverage 全 PASS
     - **ADR-137 §3 D-137-1..6 完整 e2e 链路验证**：前端 → /lib/moderation/api.ts → /admin/moderation/:id/similar → ModerationService.listSimilar → queries.findVideoFeatures + listSimilarCandidates → computeSimilarityScore → top-N response → TabSimilar 渲染 + merge 深链
     - **P-moderation §3.3.3 + W1 反例 #3 ✅ 标完成**
   - **关联问题**：W1 金票反例 #3「类似 Tab 占位」**完全闭合**
   - **工时估算**：0.15w / 实际 ~0.15w

### SEQ-20260521-03 关键约束

- **3 卡线性依赖**（ADR → EP → VIEW），不能并行
- **ADR Opus 任一红线 → BLOCKER 暂停**（按 plan §4.5）
- **总工时估算**：~0.5w（vs 原 SEQ-02 中 -04 单卡 0.4w 估算偏低；拆 3 子卡更现实）

---

## [SEQ-20260521-04] M-SN-8 follow-up 收尾（消费 VideoPicker / 用户原 13 问题闭合）

- **状态**：✅ **已完成**（10/10 子卡全 ✅ / #3 OTHERS 条件触发未启用 / DOCS-CLEANUP-DEBT 2026-05-25 状态修订）
- **创建时间**：2026-05-21
- **目标**：消费 M-SN-SHARED-04-A VideoPicker 修复用户原 13 问题中明确点出的反 UUID 痛点（#8 字幕上传 / #10 首页模块），落实 4 条硬约束 H4「零 UUID 输入」
- **依赖**：M-SN-SHARED-04-A 已就绪（commit 1c2b2329）；SEQ-20260521-03 全部 PASS（W1 金票 100% 闭合）

### 子卡序列

1. **CHG-SN-8-FUP-SUB** · 字幕上传 Modal 接 VideoPicker — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（VideoPicker 已走过 Opus 评审）
   - **完成备注**：
     - 新建 `apps/server-next/src/lib/videos/picker-fetcher.ts` 导出 `videoPickerFetcher` 函数（listVideos → PickerVideoItem 字段映射）
     - SubtitleUploadModal.tsx：state `videoId: string` → `video: PickerVideoItem | null`；删除 `^[0-9a-f-]{36}$/i` UUID 正则校验；UI 「视频 ID（UUID）」 input → `<VideoPicker label="视频" required>`；onSubmit 传 `videoId: video.id`
     - SubtitleUploadModalPicker.test 4 用例 PASS（VideoPicker 渲染 / video 必选校验 / 提交携带 video.id / Modal 复位）
     - typecheck + lint + verify:manual-coverage 全 PASS
     - 文档：P-subtitles §3.1 完整填写（含搜索操作步骤 + 快捷键）；VideoPicker.md 受害方表标 ✅
   - **关联问题**：用户问题 #8「字幕上传通过 UUID 设计需要彻底重写」**完全闭合**
   - **工时估算**：0.15w / 实际 ~0.15w

2. **CHG-SN-8-FUP-HOME** · 首页模块 ContentRefPicker + HomeModuleDrawer 接入 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D1-D11 11 维度契约）
   - **完成备注**：
     - Step 0 spawn Opus 起草 ContentRefPicker API 契约（外部受控 / 不内置 type tab / videoFetcher + videoTypeOptions 注入 / video 编辑态 fetcher 恢复 + AbortController）
     - Step 1 `packages/admin-ui/src/components/pickers/content-ref-picker.types.ts`（ContentRefType union + ContentRefPickerProps）
     - Step 2 `packages/admin-ui/src/components/pickers/content-ref-picker.tsx`（~225 行 / 4 类型条件渲染 / video 适配层 / URL 内联校验 / fallback console.error）
     - Step 3 admin-ui pickers/index.ts export ContentRefPicker + Type
     - Step 4 HomeModuleDrawer 接入：替换原 contentRefId AdminInput + 4 hint 反人类填法 → `<ContentRefPicker>` 单组件；setField type 变化时同步 reset contentRefId（Opus 评审建议 2）；新增 VIDEO_TYPE_OPTIONS 11 项注入
     - Step 5 测试 10 用例 PASS（≥ 8 必须 + 2 advisory）：video 选中 / external_url 校验 / custom_html / video_type select / type 切换 / videoFetcher 缺失降级 / disabled / 编辑态 fetcher 恢复 / error prop
     - typecheck + lint + verify:manual-coverage + verify:adr-contracts 全 PASS
     - 文档 ContentRefPicker.md 8 章节完整定稿（含消费方接入示例 + type 切换行为表 + 错误态矩阵）
     - **Opus 评审 3 关键建议全部落实**：(1) AbortController cleanup + fetch (2) 消费方负责 type 切换 reset value (3) 缺 fetcher/options 时 console.error + fallback 不 throw
   - **关联问题**：用户问题 #10「首页编辑添加完全不符合人机交互」**完全闭合**
   - **工时估算**：0.3-0.4w / 实际 ~0.35w（含 Opus 1 轮）

3. **CHG-SN-8-FUP-OTHERS**（条件触发）· 其它 picker 沉淀（SourceLinePicker / UserPicker / SitePicker）
   - 触发条件：实际有 ≥ 2 个新消费方需求
   - 工时估算：各 0.2w

4. **CHG-SN-8-FUP-SOURCES-DEAD-BTN** · sources「一键替换最相似 URL」死按钮修复（用户问题 #6 部分）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - SourcesClient.tsx：button onClick → setReplaceTipOpen(true)；新增 Modal「批量一键替换 URL · 筹备中」展示 4 节内容（预期行为 / 当前未实装 / 当前替代路径 3 步 / follow-up 登记入口）+ 「我知道了」关闭
     - SourcesReplaceTip.test 2 用例 PASS（按钮点击 → Modal 渲染 + dismissModal）
     - P-sources §3.1 完整填写（说明筹备状态 + 替代路径 + follow-up 登记口）+ §3.2 别名 displayName 已消费实证（SourceMatrixRow:234 fallback）
     - 别名展示部分（用户问题 #6 另一痛点）实证 SourceMatrixRow 已用 `line.displayName ?? line.sourceName` fallback；本卡范围不需补
   - **关联问题**：用户问题 #6「一键替换最相似 URL 功能不详」部分闭合（死按钮 → Modal 解释 + 替代路径；实际算法实装推 CHG-SN-8-FUP-SOURCES-REPLACE-ADR follow-up）
   - **工时估算**：0.05-0.08w / 实际 ~0.08w

5. **CHG-SN-8-FUP-IMAGE** · 图片健康功能阐明（手册定稿 / 用户问题 #9）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet（纯文档）
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - 实证查代码：ImageHealthClient 4 actions（backfill / rescan / switchDomain / refresh）+ KPI 4 + TOP 破损域名 + 破损样本 grid + 缺图视频表 **全部功能已实装**（CHG-SN-6-02 + IMAGE-1 + IMAGE-2 + ADR-135）
     - 用户问题 #9「功能实现不详」根因是**手册空**而非功能缺失 → 本卡仅写完整 P-image-health.md
     - P-image-health.md 完整定稿（8 章节）：业务定义 / ASCII 布局 / §3.1-§3.6 6 类操作（重扫 / backfill / 切 fallback 域 / TOP 域名 / 破损样本 / 缺图视频表，含端点 / 行为 / 前置 / 期望 / 失败 / 何时用）/ §4 进阶（强调危险）/ §5 字段含义 / §6 状态颜色 / §7 FAQ 4 行 / §8 关系
     - typecheck + lint + verify:manual-coverage 全 PASS
   - **关联问题**：用户问题 #9「图片健康功能实现不详」**完全闭合**（手册完整化）
   - **工时估算**：≤ 0.1w / 实际 ~0.08w

6. **CHG-SN-8-FUP-SOURCES-DEAD-BTN** · sources「一键替换最相似 URL」死按钮修复（用户问题 #6 部分）— 状态：✅ 已完成（2026-05-21）

7. **CHG-SN-8-FUP-USER-MENU** · 用户菜单 4 noop action 改 Modal/Toast 反馈（用户问题 #13）— 状态：✅ 已完成（2026-05-21）

8. **CHG-SN-8-08-B** · Merge 页 VideoPicker 选 candidate_b（W4 工作流闭合 / 消费 VideoPicker）— 状态：✅ 已完成（2026-05-21）

9. **CHG-SN-8-MANUAL-BATCH-1** · 高 ROI 4 页面手册定稿 + GAPS 汇总 — 状态：✅ 已完成（2026-05-21）

10. **CHG-SN-8-MANUAL-BATCH-2** · admin/编辑页 4 份手册定稿 + GAPS 扩展 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - P-users 完整定稿（98 行 / 角色矩阵 + 邀请 + 改角色 + 封禁/解封 + 进阶批量缺失登记）
     - P-settings 完整定稿（97 行 / 8 Tab 全说明 + ADR-125 IA 收敛 + 通知/Webhook/session 实装状态明示）
     - P-audit 完整定稿（91 行 / 多维 filter + Drawer 详情 + 回滚通用未实装登记 + 时间穿梭登记）
     - P-home 完整定稿（103 行 / 4 slot + ContentRefPicker 接入说明 + ADR-104 协议 + 前台预览）
     - GAPS.md 扩展 10 条新登记：#G-users-role-session-invalidate / batch-ban / edit-profile / settings-webhook-impl / settings-session-fields-consume / settings-save-all / audit-rollback-universal / audit-time-travel / audit-self-scope / home-brand-multi
     - GAPS.md 总条数 11 → 21；本会话累计登记
     - verify:manual-coverage PASS
   - **关联问题**：高 ROI 第二梯队页面定稿
   - **工时估算**：0.2-0.3w / 实际 ~0.25w

11. **CHG-SN-8-MANUAL-BATCH-3** · 剩余 5 页面 + 4 工作流定稿 / SEQ-05 完结 — 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **完成备注**：
      - P-login（66 行 / 视觉 + 失败 + 找回密码/SSO 未实装登记）
      - P-submissions-deprecated（28 行 / 短停用页跳转说明）
      - P-user-submissions（85 行 / Card list + 3 type 处理 + ADR-124 schema）
      - P-sources 补完（102 行 / 完整 8 章节）
      - P-subtitles 补完（92 行 / 完整 8 章节）
      - W2/W3/W4/W5 工作流全标 ✅ 完整定稿（W4 标 status / W2 W3 W5 完整重写）
      - 20-pages/README + 10-workflows/README 状态列全标 ✅
      - **manual 完整定稿统计**：12/29 → 29/29 = **100%**
      - verify:manual-coverage PASS
    - **工时估算**：0.3-0.4w / 实际 ~0.3w

---

### SEQ-20260521-05 完结声明（2026-05-21）

3/3 batch 全 PASS / Manual 完整定稿 29/29 = 100%

| Batch | 卡数 | 内容 |
|---|---|---|
| Batch 1 | 4 + GAPS 11 | P-videos / P-dashboard / P-moderation 补 / P-merge / GAPS.md 新建 |
| Batch 2 | 4 + GAPS +10 | P-users / P-settings / P-audit / P-home |
| Batch 3 | 5 + 4 W + READMEs | P-login / -deprecated / -user-submissions / -sources 补 / -subtitles 补 / W2-W5 |

**最终**：29 manual 文件 100% 完整定稿；GAPS.md 21 条登记追踪后续 follow-up

---


---

## [SEQ-20260521-06] GAPS 高 ROI 闭合（小卡批量） — 已全归档 ✅

- **状态**：✅ 已全归档（2026-05-23 / CHG-SN-7-MISC-DOCS-CLEANUP-SESSION-CLOSE sub-task 1）
- **范围**：68 卡全 ✅（#1-68）
- **归档位置**：`docs/archive/task-queue/task-queue_archive_SEQ-20260521-06_20260523.md`
- **完整 changelog 条目**：保留在 `docs/changelog.md`
- **后续新卡**：起新 `SEQ-20260524-NN` 容器追加（不再追加到 SEQ-06）

---

## M-SN-8 完结审计同步（独立 ad-hoc · 不挂 SEQ）

- **CHG-SN-8-CLOSE-AUDIT-DRIFT-FIX** ✅ 已完成（2026-05-23）— manual 3 处 status header drift 同步（W1-crawl-to-publish + P-moderation + P-crawler）；用户审计 trigger / 纯元信息修正 / 无代码 / 无 ADR / 无 schema 变更。详 `docs/changelog.md` 同名条目。
  - **判定（已修正）**：M-SN-8 **SEQ 任务列表** 5 序列（SEQ-20260521-01..06）全 ✅；ADR 150/150 closed；但**用户实测发现至少 7-8 项被标 ✅ 但用户视角不可用 + 多个未做项**（见 `docs/audit/user-review-2026-05-23.md`）。"主体完结"措辞 commit 991ab99b 不准确，待 #UR-M01 修正。

---

## [SEQ-20260524-01] M-SN-9 启动 — 用户复核反馈逐项修复（执行序列）

- **状态**：🟡 规划中
- **创建时间**：2026-05-23
- **最后更新时间**：2026-05-23
- **目标**：闭合 `docs/audit/user-review-2026-05-23.md` 中 15+ 项用户复核反馈（持续登记 D 段）；以"dev server 实测 + 用户走读 ≥ 1 次"作为 ✅ 强前置（M-SN-8 教训）
- **范围**：M-SN-9 阶段全部 #UR-* 编号项；按用户提供顺序逐个推进
- **依赖**：M-SN-8 SEQ 任务列表 ✅；用户复核反馈持续登记中
- **流程**：规划方案 → 用户审核 → 制定任务执行（起 ADR + EP 卡） → 完成后复核 → 用户人工审核（不再自报 ✅）

### 任务列表（按用户提供顺序追加）

1. **CHG-SN-9-DT-HEADER-REDESIGN-ADR** · 表格头重设计 ADR-149 起草 — 状态：✅ 已完成（2026-05-23）
   - **关联反馈**：#UR-B1 表格头不一致 + #UR-B2 列名/三点设置 + #UR-B3 中文 IME + #UR-B4 列覆盖不全
   - **方案文件**：`docs/audit/datatable-header-redesign-plan.md` v3（11/11 决策点 + arch-reviewer R-149-1..9 全消解）
   - **ADR**：`docs/decisions.md` line 11942 · ADR-149 ✅ Accepted（@livefree PASS）/ ADR-103 第 5 次 AMENDMENT
   - **子代理**：arch-reviewer (claude-opus-4-7) 评级 **A− CONDITIONAL PASS** / 9 修订消解
   - **后续 EP**（ADR PASS 后启动，5 段渐进 / typecheck 不破裂）：
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-1** · types.ts deprecate + column-matrix-menu.tsx + dt-styles 矩阵样式 + 39 单测 — 状态：✅ 已完成（2026-05-23 / 实际 0.5w / 39/39 PASS / typecheck + lint + verify 全过）
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-2** · 列名 toggle 互斥 + ⋯ button stopPropagation + columnTriggerVisibility 三态 + 12 单测 — 状态：✅ 已完成（2026-05-23 / 12 新 + 30 旧测试更新全 PASS / typecheck + lint + verify 全过）
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-3** · 删 hidden-columns-menu + filter-chips **两**文件（filter-chip.tsx 保留 / D-149-10 vs D-149-11 矛盾修正）+ 11 集成单测 — 状态：✅ 已完成（2026-05-23 / 4 质量门禁全过）

   **ADR-149 AMENDMENT 1（2026-05-24）— D-149-13/14/15 + EP 序列重写 4→7 段**：
   - **CHG-SN-9-DT-HEADER-REDESIGN-ADR-AMEND-1** · D-149-13 toolbar.search 槽位约定 + D-149-14 三槽位职责闭合 + D-149-15 业务 key 桥接合约 — 状态：🔄 进行中（arch-reviewer A− CONDITIONAL PASS / 9 修订消解 / 等 @livefree 审核）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4** · DataTableSearchInput 原语 + IME + 2 合规消费方（CrawlerSiteList + SourcesClient）接入 + 13 单测 — 状态：✅ 已完成（2026-05-24 / 4 质量门禁全过 / 全 4751 unit 0 flaky / 范围调整：4 违规消费方含 search 合并 EP-5-*）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4-HOTFIX** · DataTableSearchInput 光标失焦修复（受控 → 半 uncontrolled / DOM 自管 value + ref 同步 + selection 保留）+ 5 focus persistence 单测 — 状态：✅ 已完成（2026-05-24 / 4 质量门禁全过 / 全 4756 unit 0 flaky）
   - **CHG-SN-9-DT-HEADER-REDESIGN-ADR-AMEND-2** · D-149-16 矩阵触发器接入 DataTable 主组件 toolbar + EP 序列 7→8 段插入 EP-4.5 — 状态：🔄 进行中（arch-reviewer B+ → A− CONDITIONAL PASS / 10 修订消解含 2 BLOCKER / 等 @livefree 审核）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5** · 矩阵触发器接入 DataTable 主组件 toolbar-right（thead-right fallback 推 N1-149-11 / 0 消费方实测使用 toolbar.hidden=true）+ ColumnMatrixMenu wiring 6 callback（含 BLOCKER：业务 key 桥接 + 合并式 reset 不丢 width）+ column-visibility.ts 2 工具函数沉淀 + dt-styles `[data-table-matrix-trigger]` 样式块 + 17 单测 — 状态：✅ 已完成（2026-05-24 / 4 质量门禁全过 / 17 新 + 13 旧 PASS / 全 4772 unit）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-5-SHARED** · DataTableEnumFilter（单选+多选+searchable / 20 单测）+ DataTableTextFilter（IME+debounce+半 uncontrolled / 15 单测）+ DataTableDateRangeFilter（from-to+presets+date/datetime / 15 单测）3 共享原语沉淀 — 状态：✅ 已完成（2026-05-24 / 50 新单测全 PASS / 全 4823 unit 0 flaky / 4 质量门禁全过）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-5-CRAWLER-RUNS** · CrawlerRunsView 2 AdminSelect (status / triggerType) → 列级 ⋯ filterContent (DataTableEnumFilter) + D-149-15 桥接合约（column.id 对齐业务 key / 无需复杂桥接）+ 删 toolbar.search + ghost button + filterSummary + 5 新单测 + 2 旧更新 + FilterEnumOption.label ReactNode 扩展 — 状态：✅ 已完成（2026-05-24 / 全 4828 unit 0 flaky / 4 质量门禁全过）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-5-CRAWLER-RUNS-PATCH** · 4 用户反馈修复：问题 1（高级菜单加"查看采集批次"入口 / 用户决策不进 sidebar）+ 问题 2（matrix-trigger CSS margin-left:auto 推右）+ 问题 3（多选过滤全栈 / API + queries + route CSV→array + 前端 multi + 单测）+ 问题 4 列排序保持现状（用户决策不修）— 状态：✅ 已完成（2026-05-24 / 25/25 + 全 4828 unit 0 flaky / 4 质量门禁全过）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5-HOTFIX-3** · 矩阵 popover 3 问题修复：可见性 toggle 真生效（消费方 patch.columns 处理 / CrawlerRunsView + SourcesClient）+ 列级 ⋯ "隐藏此列"真生效（同根因）+ 过滤 switch 未过滤时 disabled+title tooltip（D-149-5 设计强化 / 提示用户去列名 ⋯ 编辑）+ 1 新单测 + 1 旧更新 — 状态：✅ 已完成（2026-05-24 / 全 4829 unit 0 flaky / 4 质量门禁全过 / 剩余 7 消费方相同 patch.columns 遗漏在 EP-5-* 子卡修）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5-HOTFIX-4** · 未过滤列 disabled switch 旁加可见 hint「列名 ⋯ 编辑」+ dt-styles 新增 hint CSS rule + 2 单测更新（断言 hint 渲染/不渲染）— 状态：✅ 已完成（2026-05-24 / matrix 40/40 + admin-ui/table 395/395 + 4 质量门禁全过 / 解决 HOTFIX-3 OS 原生 tooltip 可发现性差）/ ⚠️ HOTFIX-5 反向移除（ADR-150 新范式下 hint 引导文案过时）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5-HOTFIX-5** · 矩阵 popover 未过滤列 hint 文案「列名 ⋯ 编辑」+ aria-label / title 旧引导句一并移除（@livefree 走读反馈 + "一起清理"追加指令） — 状态：✅ 已完成（2026-05-24 / column-matrix-menu.tsx 删 hint span + button title prop + aria-label 引导句段 + dt-styles 删 CSS 规则 + 单测 3 断言更新 / matrix 40/40 + admin-ui/table 426/426 零回退 / 4 质量门禁全过 / ADR-150 范式反转一致性彻底收敛）
   - **⚠️ EP-5-SOURCES-SORT-FULLSTACK + EP-5-submissions/users/audit/videos + EP-6 + EP-7** · 已被 **ADR-150 阶段 2-5** 取代（@livefree 在 EP-4.5-HOTFIX-4 走读后看 Google Sheets 截图反馈"过滤应是列固有属性"/ ADR-149 个别 EP-5 迁移范式被列固有自动过滤范式替换）— 状态：⛔ 已废弃（不要执行 / 改走 ADR-150 SEQ 容器）
   - **CHG-SN-9-DT-AUTOFILTER-ADR** · ADR-150 起草 + Opus 子代理评审 + 6 D-150-× 论证（D-150-3 + D-150-5 REVISED）+ 13 章 + 5 阶段实施计划 + 写入 decisions.md line 12664-13037 — 状态：✅ **Accepted via AMENDMENT 2**（2026-05-24 / D-150-5 由 AMD2 NEGATED + REVISED 重构 / 不再 Proposed / DOCS-CLEANUP-DEBT 2026-05-25 状态修订）
   - **CHG-SN-9-DT-AUTOFILTER-EP-1** · 共享 DataTableAutoFilter UI / 6 步严格串行 / Opus 设计 + 实施 + 评审：types.ts AutoFilterColumnFields discriminated union (Active/Inactive + filterFieldName 必填) + AutoFilterKind/DistinctOption/FilterableColumn / use-filter-kind-inference hook 5 边界 + 10 单测 / DataTableAutoFilter 主组件 Google Sheets 三段布局 + 4 filterKind 渲染 + 20 单测 / dt-styles +185 行 `[data-autofilter-popover]` CSS / header-menu autoFilterContent 双范式接入 / data-table.tsx wire (mode client 用 processedRows / server 用 pageRows / filterFieldName 必填零??) / Opus PR review REVISED → 4 fix (BLOCKER union + HIGH token + MEDIUM rows + MEDIUM dev warn) — 状态：✅ 已完成（2026-05-24 / 425 admin-ui/table 全 PASS / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-2** · 后端通用 distinct 端点 `/admin/_dt/distinct` (GET) + filter-schema.ts (FilterValueSchema discriminatedUnion 6 种 + DtFiltersSchema URL JSON transformer) + distinct-whitelist.ts (6 表硬编码 SQL 白名单 + identifier 正则 `/^[a-z_]+\.[a-z_]+$/` + 启动期自检) + DataTableService.ts (SQL 模板 + LIMIT clamp + q ILIKE $param) + ErrorCode COLUMN_NOT_WHITELISTED 403 + server.ts 注册 + ADR-150 §端点契约 表 / Opus PR review PASS (0 BLOCKER / 2 LOW 不阻塞) / 33 单测全 PASS (15 端点含 SQL 注入 3 case + 18 shared) — 状态：✅ 已完成（2026-05-24 / 4 质量门禁 + verify:endpoint-adr 187 全对齐）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-A** · 12 消费方批量迁移 子卡 A（拆 2 sub-commit + HOTFIX）：
     - **sub 1** CrawlerRunsView 迁 D-149-15 → D-150 ✅（2026-05-24 / column.filterable + filterFieldName + filterOptions / 删 DataTableEnumFilter 桥接 / 删 statusFilter+triggerTypeFilter 独立 state / filtersMap 统一 / fetch useEffect 派生 / types.ts ColumnDescriptor 加 filterable+filterFieldName / column-matrix-menu hasFilterContent 识别 filterable / admin-ui index 加 6 类型 export / 25 单测全 PASS）
     - **sub 1 HOTFIX** popover 6 类走读反馈回归 ✅（2026-05-24 / @livefree 实测 6 类反馈 / 共因 PANEL_STYLE maxWidth 冲突一次性消解 4 反馈 + 排序段始终渲染 + kind radio 段删除 / 3 实施 + 1 测试文件 +27/-22 / 不动 Props 契约 / 不起 ADR / 单测 20/20 + 25/25 + 1534/1534 全过 / 4 质量门禁全过 / commit `b0371950`）
     - **sub 1 EXTEND** CrawlerRunsView 3 列 filterable 补齐 + 后端 listRuns 5 参数扩展 ✅（2026-05-24 / 路径 A / id text + siteCount number + createdAt date / 后端 SQL 4 新条件含 created_at 含 to 当日全天 INTERVAL / 5 文件实施 + 2 文件单测 / **顺手修复 data-table.tsx pinned 列 filterable 盲区**（hasAutoFilter 判定补齐）/ 单测 28/28 + 8/8 + 1534/1534 + 219/219 全过 / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR）
     - **sub 2** AuditClient 迁 toolbar 6 控件 → 列内 filterable + filtersMap 派生 ✅（2026-05-24 / 5 列 filterable / 2 实施 + 1 测试文件 / D-150-5 union 守卫报错触发实证（actor 列条件 spread → 两版本显式返回）/ createdAt 精度降级 datetime→date / 单测 20/20 + 1534/1534 全过 / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR / 不需后端 / 不需 distinct-whitelist AMENDMENT / commit `ea5c2598`）
     - **sub 2 EXTEND** EnumValueList 空退化 BUG + 2 表格 sort 全栈打通 ✅（2026-05-24 / admin-ui 共享层 1 行 fix + 后端 2 端点 sort 参数（zod 白名单 + const SQL 映射 + ORDER BY 动态 + id DESC 兜底）+ 前端 2 表格 enableSorting + 白名单守卫 / 11 实施 + 4 测试 + 2 docs / 7 新 case / 1796/1796 单测全过 / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR / commit `68a8efe6`）
     - **sub 2 PATCH** arch-reviewer 评审消解（2 红线 + 1 黄线）✅（2026-05-24 / arch-reviewer Opus 一次评级 B → 二次评级 **A-** / R-EP3A-1 共享层 3 处桥接 + R-EP3A-2 sort fail-fast throw + Y-EP3A-1 SORT_IDENT_REGEX 全 ✅ / 4 实施 + 3 测试 / 4 质量门禁全过 / RR-EP3A-1 audit fail-fast 单测缺位 + RR-EP3A-2 SOC tag 合格 2 advisory 留 EP-3-B 顺手 / **EP-3-A 6 子卡全闭环 PR ready** / commit `b80c9e7c`）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-B** · 子卡 B：UsersListClient + advisory 3 项 ✅（2026-05-24 / 仅迁 UsersListClient（SubmissionsListClient deprecated 不迁 / 节省 0.2w）/ 3 列 filterable（username/q + role + status/banned）/ D-150-4 桥接实证扩大（username/q）/ Advisory RR-EP3A-1 audit fail-fast 单测新建 + Y-EP3A-2/3 admin-module-template + column-visibility 注释 / 3 实施 + 2 测试 + 2 docs / 4 新 case / 11/11 + 3/3 + 1532 单测全 PASS / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-C** · 子卡 C：VideoListClient（StagingPageClient 跳过）✅（2026-05-24 / StagingPageClient Segment+client mode 跳过 / VideoListClient 4 列 filterable（title/q + type + visibility/visibilityStatus + review_status/reviewStatus）/ VideoFilterBar 6 → 2 控件简化（保留 status+site 外置）/ D-150-4 桥接 7 实证累计 / 2 实施 + 0 测试新增 / 21/21 单测零回退 / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR）
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-ADR** · ADR-150 AMENDMENT 2 起草 ✅（2026-05-24 / @livefree 根本反问 → arch-reviewer Opus 独立 1 轮起草 / 9 决策点 D-150-AMD2-1..9 / column.kind enum 方案 A / D-150-5 NEGATED + 重构 / @livefree 仲裁 2 红线 dev warn + AMENDMENT 2 内一起实施 / Accepted）
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-EP** · AMENDMENT 2 实施 ✅（2026-05-24 / 共享层 types kind union + data-table kind 筛选 + column-matrix-menu action 整行跳过 + 4 消费方 opt-out 5 列 kind marker / 3 测试 fixture 更新维持旧预期 / 7 实施 + 3 测试 / 4 质量门禁全过 / 426 + 605 单测全 PASS / 不动 ADR / 不动后端 / 向后兼容 4 已迁消费方零破坏）
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-PATCH-1+2** · /admin/videos sort 加载失败修复 ✅（2026-05-24 / PATCH-1 错用前端禁用反范式 / @livefree 指正后 PATCH-2 后端 SORT_FIELDS 扩 5 字段 + SQL ORDER BY 动态白名单 + 前端去禁用 / 兑现 AMD2 D-150-AMD2-1 默认全开原则 / commits `9888f7ac` + `2c6e3cf8`）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-D** · ImageHealth + Merge 9 列 kind='computed' opt-out ✅（2026-05-24 / ImageHealth domains 表 client mode 不动 / missing 表 4 子查询派生列 + Merge candidates 表 3 列加 kind='computed' / AMD2 D-150-AMD2-2 首业务应用 / 业务真实禁用 vs 反范式禁用区分 / 后续真 sort/filter 全栈实施留 follow-up / 2 实施 / 53/53 单测零回退）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-E** · SubtitlesListClient + SourcesClient 10 列 opt-out ✅（2026-05-24 / Subtitles 4 列 kind='computed'+enableSorting:true 灵活组合（后端真支持 sort）+ actions kind='action' / Sources 5 列 kind='computed' 删 lineCount/sourceCount pre-existing 假装 / sources sort 全栈打通明确划归 ADR-150 阶段 5 EP-4 / 2 实施 / 26/26 单测零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-F** · CrawlerSiteList + CrawlerRunDetailView 11 列 opt-out ✅（2026-05-24 / CrawlerSiteList client mode 7 数据列默认全开 + chevron/actions kind='action' / CrawlerRunDetailView server mode 8 数据列 kind='computed' 防假装 + ops kind='action' / AMD2 client+server 范式区分实证 / 2 实施 / 141/141 单测零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-G** · StagingPageClient actions opt-out / 12 消费方完整闭环 ✅（2026-05-24 / StagingPageClient mode=client actions 列 kind='action' / SubmissionsListClient deprecated 跳过 / dev demo 跳过 / 12/12 消费方处理完毕 / 1 实施 / 8/8 单测零回退）
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-PHASE5-EP4-SOURCES** · ADR-150 阶段 5 EP-4 sources sort 全栈打通 ✅（2026-05-24 / 声称 5 文件实际 4 文件 / **api.ts 漏改 URLSearchParams** / sort 行为失效 → HOTFIX-PATCH-2A 回填）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-HOTFIX-PATCH-2A** · sources sort BUG 回填 + filter 全栈扩展 ✅（2026-05-25 / 5 项 / 7 文件 / api.ts URL 透传 + actions kind='action' opt-out + updatedAt 全栈（前端 filterable + 后端 zod + queries HAVING MAX）+ probeStatus enum filter 4 态全栈（csvToStringArray + EXISTS ANY()）+ renderStatus 同 probeStatus / 22 + 7 + 10 = 39 单测全 PASS 零回退 / 4 质量门禁全过 / siteKey 推 PATCH-2B follow-up）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-HOTFIX-PATCH-2B** · siteKey enum filter 全栈 / distinct 端点首次消费实证 ✅（2026-05-25 / 8 文件 / arch-reviewer Opus A- 评审 D1-D6 全 ✅⚠️ / DataTableProps 扩 distinctFetcher prop + DataTable wire 透传 + sources/api.ts 新建 fetchDistinct 调 /admin/_dt/distinct + SourcesClient 加 hidden siteKey column（defaultVisible: false + filterKind='enum' + filterDistinctTable='sources' + filterFieldName='site_key' + accessor=() => null + enableSorting: false）+ filtersMap siteKey 派生 + DataTable distinctFetcher 注入 / 后端 siteKey csvToFreeStringArray + EXISTS ANY()::TEXT[] / 单测 sources-matrix +2 + sources-api-url +2 + 共 47 单测零回退 / 4 质量门禁全过 / admin-ui/table 426/426 零回退）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-HOTFIX-PATCH-2B-FIX1** · siteKey 列 cell 显站点 csv（用户走读"列显示空"反馈修复）✅（2026-05-25 / 6 文件 / hidden column 改 visible / 后端 SQL STRING_AGG(DISTINCT COALESCE(vs.source_site_key, v.site_key)) 派生 + raw + Service + types VideoGroupRow.siteKeys 透传 + 前端 cell csv text + title hover 完整列表 / sources-matrix +3 case + sources-matrix-service fixture 补 / 共 62 单测零回退 / admin-ui/table 426/426 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-MERGE-SORT-FULLSTACK** · Merge 候选表 sortField 全栈打通（PATCH-2 范式复刻 / ADR-150 阶段 5 EP-4 follow-up）✅（2026-05-25 / 5 文件 / 4 字段白名单（score/videoCount/year/titleNormalized）/ types ListCandidatesParams 扩 sortField+sortDir / zod ListCandidatesSchema enum / Service 层 sort switch 4 case + tiebreaker groupKey ASC / 前端 lib URL 透传 + sort state + 3 列 enableSorting: true + DataTable wire / pre-existing 设计局限：DB 层按 `COUNT(*) DESC, title_normalized ASC` 分页 / Service 层 sort 跨页不严格稳定（接受 / 后续 score 物化需 migration） / video-merge-candidates +5 case 32/32 + admin-ui/table 426/426 零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-CRAWLER-RUN-DETAIL-SORT-FULLSTACK** · runs/:id/tasks sort 全栈打通（PATCH-2 范式 + 复用 TASK_SORT_COLUMNS 白名单 / ADR-150 阶段 5 EP-4 follow-up）✅（2026-05-25 / 4 文件 / 4 字段白名单（site/status/startedAt/finishedAt）/ queries listTasksByRunId 加 sortField+sortDir 复用 listTasks 的 TASK_SORT_COLUMNS / 路由 GET /admin/crawler/runs/:id/tasks zod enum 透传 / 前端 lib URL 透传 + 4 列加 enableSorting + load() column.id 桥接（siteKey→site / duration→finishedAt） / crawler-tasks +7 case 14/14 + CrawlerRunDetailView test fixture 更新 case 12 / admin-ui/table 426/426 + 全套 567/567 零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-IMAGE-HEALTH-MISSING-SORT-FULLSTACK** · ImageHealth missing 4 子查询列 sort 全栈打通（PATCH-2 范式 / ADR-150 阶段 5 EP-4 follow-up）✅（2026-05-25 / 5 文件 / **关键发现**：注释 "需 CTE 重写" 误判修正 / LATERAL JOIN evt.* 字段（evt.url / evt.occurrence_count / evt.last_seen_at）直接 ORDER BY 可引用 / MISSING_VIDEO_SORT_SQL 扩 4 字段 / 前端 camelCase → snake_case 桥接（posterSource→poster_source / brokenDomain→broken_domain / occurrenceCount→occurrence_count / lastSeenBrokenAt→last_seen_broken_at）/ ORDER BY 加 NULLS LAST（LEFT JOIN evt 可能 NULL）/ image-health-missing-sort 新建 9 case PASS + admin-ui/table 426/426 + 全套零回退 / 工时 0.3-0.5w → 实际 0.15w / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-E2E-SMOKE** · sources sort + filter e2e smoke 3 case 收口（PATCH-2A 全栈验收 / ADR-150 阶段 5 EP-4 收口）✅（2026-05-25 / 1 新 spec 文件 / 3 case：page-load (KPI + 行渲染) / sort-click-video (PATCH-2A §1-BUG-1 漏改回填 sortField 透传) / filter-probe-status (PATCH-2A §2-EXT-1 enum filter URL 透传) / Playwright admin-next-chromium project / page.route 拦截 + URL params 捕获验证 / API mock 全独立 / 触发方式：用户起 dev server 后 `npm run test:e2e` 跑 / 当前 typecheck + lint + verify + admin-ui/table 426/426 PASS）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-E2E-SMOKE-FIX1** · 加 case 4 siteKey distinct + case 2/3 testid refactor（PATCH-2B 收口）✅（2026-05-25 / 1 文件改 / 4 case 总 / case 4 新建：列「站点」⋯ → DataTableAutoFilter 触发 distinct fetch → captured.distinct URL[] 验证 table=sources + col=site_key → mock 返回 [bilibili,youku,iqiyi] → 勾 bilibili → 应用 → 主 fetch URL 透传 siteKey=bilibili 全链路 / case 2/3 重写用 DataTableAutoFilter testid 体系（th-menu-trigger-* + dt-autofilter-*-opt-* + dt-autofilter-*-apply）增稳 / 4 case 全 admin-next-chromium 注册 / typecheck + lint + verify + admin-ui/table 426/426 零回退）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-DISTINCT-FETCHER-ABORT-SIGNAL** · DataTableAutoFilter AbortController + signal 全栈透传（Opus PATCH-2B 评审 D6 预批准 follow-up）✅（2026-05-25 / 4 文件 / 共享层 admin-ui types.ts DataTableProps.distinctFetcher signature 加 signal?: AbortSignal optional 第 4 参数 + DataTableAutoFilter useEffect AbortController 创建 + cleanup abort + AbortError 静默忽略不触发 fetchError 状态 + signal.aborted 双检 防 stale state set / api-client RequestOptions.signal optional + fetch 透传 / sources/api.ts fetchDistinct 加 signal 参数 + apiClient.get 透传 / +3 单测 case（#6 fetcher 调用含 expect.any(AbortSignal) / #6a unmount 触发 signal.aborted=true / #6b AbortError 静默不渲染 fetchError / #6c 真实 error 渲染 fetchError）/ admin-ui/table 429/429 零回退 / typecheck + lint + verify 全过 / 防 search 快速切换 stale response 覆盖）
   - ~~**CHG-SN-9-DT-AUTOFILTER-EP-3-D/E/F/G**~~ · ⛔ **DOCS-CLEANUP-DEBT 2026-05-25 删除冗余占位**：原 4 条 BLOCKED 占位实际已 ✅ 完成（上方 L838-842 各自有 ✅ 完成条目 / 见 EP-3-D `0e625ac8` + EP-3-E `1bf423ba` + EP-3-F `240e7109` + EP-3-G `05a6e802`）/ 文档同步遗留 / 状态修订完成
   - ~~**CHG-SN-9-DT-AUTOFILTER-EP-4**~~ · ⛔ **DOCS-CLEANUP-DEBT 2026-05-25 删除冗余占位**：实际由 ADR-150 阶段 5 EP-4 sources/Merge/CrawlerRunDetail/ImageHealth/e2e smoke/distinct-fetcher AbortSignal **7 个 follow-up 卡** 全闭环完成 / 见上方 L843-853
   - **总工时（ADR-150 替代 ADR-149 EP-5 序列）**：原 ADR-149 EP-5 ~2.6w + sources sort ~0.7w + EP-6 ~0.2w + EP-7 ~0.3w = 3.8w → **ADR-150 阶段 2-5 共 3.6w**（节省 ~0.2w + UX 强一致 + 长期收益）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-A · DataTableSearchInput IME + 5 高优消费方接入 + 12 单测（~0.4w）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-B · 剩余 8+ 消费方删 deprecated prop + 类型完全删除（~0.4w）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-C · @livefree 走读 5 代表页 + #UR-B1/B2/B3/B4 闭合验证（~0.3w）

> 后续用户提其它问题时按 #UR-* 顺序追加

---

## [SEQ-20260525-CRAWLER-W1] CRAWLER W1 — 命名 / 撤删除 / Bug-A / 关键词 Drawer / 定时面板 3 触达

- **状态**：✅ **已完成**（2026-05-25 / 8/8 子卡全 ✅ / 含 CW1-B-EP-TEST follow-up）
- **创建时间**：2026-05-25 16:40
- **最后更新时间**：2026-05-25 23:59
- **目标**：W1 7 项改进闭环 — Fix-D2 命名 6 项（4 字约束）+ Fix-D1 撤回删除入口 3 处 + Bug-A 任务级 cancel + Fix-D6 关键词采集 Drawer + 定时任务面板 3 处触达（采集页 inline + Dashboard 卡 + topbar 铃铛）。Gantt 时间轴升级延后 W2 与 Fix-D5 定时增强合并。
- **范围**：apps/server-next 采集相关 UI 全量 + apps/api 新增 2 个 admin route（task cancel + topbar events） + 复用现有后端契约扩字段。**v1 UI 不动**。
- **依赖**：plan 文件 `/Users/livefree/.claude/plans/cheerful-orbiting-hare.md` §W1 设计决策 + §拆卡草稿（5 张卡 = 7 子卡）
- **真源**：`docs/designs/backend_design_v2.1/reference.md` §5.6 采集模块 + plan 文件 W1 决策
- **总估时**：1.45w

### 任务列表（按执行顺序）

1. **CHG-SN-9-CW1-A** — 采集页 UI 三合一（命名 + 撤删除 + inline chip）✅ 已完成（2026-05-25 / 9 源码 + 1 测试 / CrawlerClient 61/61 PASS / 4 字命名 6 项 + 4 处删除入口撤回 + 1 后端 autoCrawlNext 字段 + PageHeader inline chip / data-testid 全保留 e2e 兼容 / CrawlerClient.tsx 净减 15 行 / 详见 changelog）
   - 创建时间：2026-05-25 16:40
   - 实际开始：2026-05-25 16:40
   - 完成时间：2026-05-25
   - 执行模型：claude-opus-4-7（plan 模式延续 / 建议 sonnet 但同会话 opus 直跑）
   - 文件范围：6 _client/*.tsx + crawler-site-columns-v2.tsx + CrawlerSiteList.tsx + lib/crawler/api.ts + apps/api/src/routes/admin/crawler.ts（实施中扩 CrawlerSiteList + columns-v2 / 链路一致性 / 已同步更新 tasks.md）
   - 估时：0.15w（实际工时与估时一致）

2. **CHG-SN-9-CW1-B-ADR** — Bug-A 任务级 cancel 端点 ADR-151 起草 ✅ 已完成（2026-05-25 / decisions.md +250 行 / arch-reviewer Opus 1 轮 A− CONDITIONAL → 主循环修订 R3+Y3+G1 后 🟢 Accepted / D-151-1..6 全 PASS / 详见 changelog）
   - 创建时间：2026-05-25
   - 实际开始：2026-05-25 17:10
   - 完成时间：2026-05-25
   - 执行模型：claude-opus-4-7
   - 子代理：arch-reviewer (claude-opus-4-7) — 1 轮独立评审 / A− CONDITIONAL → 修订后等同 A
   - 范围：ADR-151 task-level cancel endpoints / D-151-1..6 决策 / 6 R-Y-G 修订
   - 文件范围：docs/decisions.md（追加 ADR-151）
   - 估时：0.15w（实际工时与估时一致）

3. **CHG-SN-9-CW1-B-EP** — Bug-A 实施 ✅ 已完成（2026-05-25 / 7 文件改 + 1 migration + admin-audit 类型扩展 / queries cancelTaskById + batchCancelTasks + worker terminal status 短路 R-151-3 硬依赖 + 2 路由 + 前端 ops 列 [取消] + bulk action bar + api client 2 函数 / 154 crawler 测试全过 / verify:endpoint-adr 184 全闭环 / 单测覆盖 留 CW1-B-EP-TEST follow-up 子卡）
   - 创建时间：2026-05-25 17:50
   - 实际开始：2026-05-25 17:50
   - 完成时间：2026-05-25
   - 执行模型：claude-opus-4-7（plan 模式延续）
   - 范围：前后端 — task 行级 cancel + 多选 batch + R-151-3 worker 守卫硬依赖
   - 文件范围：apps/api/src/db/queries/crawlerTasks.ts + crawler.tasks.ts route + crawlerWorker.ts 守卫扩展 + lib/crawler/api.ts + CrawlerRunDetailView.tsx + admin-moderation.types.ts（actionType + targetKind 扩展）+ migration 073（target_kind CHECK 13→14）
   - 估时：0.25w（实际工时与估时一致）
   - follow-up：CHG-SN-9-CW1-B-EP-TEST 单测补齐（7 queries case + 6 route case / 0.1w）

4. **CHG-SN-9-CW1-B-EP-TEST** — Bug-A 单测补齐 follow-up（状态：✅ 完成 2026-05-25）
   - 创建时间：2026-05-25 18:30
   - 建议模型：sonnet
   - 范围：补 cancelTaskById + batchCancelTasks queries 7 case + crawler.tasks route 6 case + CrawlerRunDetailView 行级 [取消] + bulk 行为 4 case
   - 文件范围：tests/unit/api/crawler-tasks.test.ts 扩 + tests/unit/api/routes/admin/crawler-tasks-cancel.test.ts 新 + tests/unit/components/server-next/admin/crawler/CrawlerRunDetailView.test.tsx 扩
   - 估时：0.1w
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 范围：前后端 — task 行级 cancel + 多选 batch
   - 文件范围：apps/api/src/routes/admin/crawler.tasks.ts（新 2 路由）+ apps/api/src/db/queries/crawlerTasks.ts（新 cancelTaskById + batchCancelTasks）+ apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView.tsx（ops 列加按钮 + 表头多选 + bulk bar）+ apps/server-next/src/lib/crawler/api.ts
   - 验收要点：task 行 [取消] 按钮（queued/running 可点）+ batch 多选 + 2 新路由 PASS + audit `crawler_task.cancel` + `crawler_task.batch_cancel` + 单测 + e2e
   - 估时：0.25w

4. **CHG-SN-9-CW1-C** — 关键词采集 Drawer（状态：✅ 已完成 2026-05-25 / 主循环 sonnet）
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 范围：纯 next UI 新组件 + API client 2 函数；后端 0 改动
   - 文件范围：apps/server-next/src/app/admin/crawler/_client/KeywordCrawlDrawer.tsx（新 423 行）+ CrawlerAdvancedMenu.tsx（+14 行 / 加 keyword_crawl 菜单项）+ CrawlerClient.tsx（+11 行 / state + render）+ apps/server-next/src/lib/crawler/api.ts（+58 行 / previewKeyword + runCrawlerKeyword + 类型）+ tests/unit/components/server-next/admin/crawler/KeywordCrawlDrawer.test.tsx（新 8 case）
   - 验收要点：单 keyword + 类型筛选 + siteKeys 默认全选 enabled 站 + 预览表格 + 立即采集 + 单测 8 全过
   - 估时：0.3w（实际 0.25w）
   - follow-up：CW1-B-EP 漏同步的 audit-log-coverage REQUIRED_ACTION_TYPES 守卫已在本卡顺手补齐（R-MID-1 第 26 次系统化首次硬编码到测试）

5. **CHG-SN-9-CW1-D** — Dashboard 自动采集卡（状态：✅ 已完成 2026-05-25 / 主循环 sonnet）
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 范围：next /admin DashboardClient 新加卡 + CrawlerClient query param 支持
   - 文件范围：apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx（新 218 行 / 5 状态卡 loading + disabled + countdown + failed + error）+ DashboardClient.tsx（+5 行 / row="4" 嵌入）+ CrawlerClient.tsx（+18 行 / useSearchParams + closeSchedulerDrawer）+ 3 测试（新 AutoCrawlScheduleCard.test 6 case + DashboardClient.test row="4" 断言 + CrawlerClient.test 3 case 54/55/56）
   - 验收要点：5 状态渲染 + 编辑链接跳 /admin/crawler?openDrawer=scheduler 自动打开 + 关闭时清 query param + 单测全过
   - 估时：0.2w（实际 0.2w）

6. **CHG-SN-9-CW1-E-ADR** — Topbar 铃铛端点 ADR-152 起草 ✅ 已完成（2026-05-25 / arch-reviewer Opus 1 轮 A− CONDITIONAL → 主循环修订 R3+Y4+G3 后 Accepted / D-152-1..5 全闭环 / 详见 changelog）
   - 创建时间：2026-05-25
   - 实际开始：2026-05-25 18:50（CW1-D commit 后续推）
   - 完成时间：2026-05-25
   - 建议模型：opus + arch-reviewer (opus)
   - 执行模型：claude-opus-4-7
   - 子代理：arch-reviewer (claude-opus-4-7) — 1 轮独立评审
   - 范围：新增 ADR-152（admin system background-events endpoint / D-152-1..5 决策：event schema discriminated union / 聚合源 5 源 → 3 lane / 轮询 60s / Cache-Control private,max-age=30 + mutate invalidate / admin+moderator role）
   - 文件范围：docs/decisions.md（追加 280 行 ADR-152 完整 12 节）
   - 验收要点：5 决策点 PASS + Opus PR review A− → 等同 A
   - 关键修订：R-152-1（actionType 枚举核实 crawler.freeze）/ R-152-2（删 cron-parser BLOCKER 改 intervalMs 推算）/ R-152-3（listRuns 谓词下推 status[] + finishedAfter）/ Y-152-1/2/3/4 + G-152-1/2/3 全消解
   - 估时：0.15w（实际 ~0.18w / 含 arch-reviewer 1 轮 + 主循环修订消解）

7. **CHG-SN-9-CW1-E-EP** — Topbar 铃铛实施（状态：✅ 完成）
   - 创建时间：2026-05-25
   - 完成时间：2026-05-25
   - 建议模型：sonnet
   - 范围：前后端 — 新端点 + admin shell 集成
   - 文件范围：apps/api/src/routes/admin/systemBackgroundEvents.ts（新）+ admin shell topbar 集成 + apps/server-next/src/.../_client/BackgroundEventBell.tsx（新）；可借鉴 CHG-SN-7-MISC-SHELL-NOTIFICATIONS 的 useAdminNotifications + useAdminTasks 模式（ADR-147）
   - 验收要点：60s polling + popover 渲染上方"即将"+ 下方"近期完成/失败" + 单测
   - 估时：0.25w（实际 ~0.28w / 含上下文恢复 + vi.hoisted fix + §端点契约标题修正）

### 关键约束

- **卡 1（CW1-A）必须先完成**：autoCrawlNext 字段是 CW1-D 的硬依赖
- **CW1-B-ADR / CW1-E-ADR 触发 plan §4.5 R7 MUST-8**：新增 admin route 必须 ADR + Opus PASS 才能起 -EP 实施卡
- **e2e 守护**：现有 `admin-采集控制台触发入口位于-sites-tab` 必须保持 PASS（data-testid 不变）
- **v1 server**：本 SEQ 全程不动 `apps/server/` 任何文件
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**

---

## [SEQ-20260525-CRAWLER-W2] CRAWLER W2 — 数据质量止损 + Gantt 时间轴 + 定时多模式

- **状态**：✅ 完成（CW2-A ✅ CW2-B-ADR ✅ CW2-B-EP ✅ CW2-C-ADR ✅ CW2-C-EP-A ✅ CW2-C-EP-B ✅）
- **创建时间**：2026-05-25 24:00
- **最后更新时间**：2026-05-25
- **目标**：W2 三条主线闭环 — ① P0 数据丢失后端守卫（Fix-1/2A/3 三合一）② Gantt 时间轴完整升级（T1-T5 修复 + 多 lane）③ Fix-D5 定时增强（cron/interval 多模式）。低置信合并候选（Fix-D3）、断点续传（Fix-D4）、健康度主动探测（Fix-D7）延后 W3。
- **范围**：apps/api 后端（CrawlerService + crawlerTimeline + crawlerScheduler + system_settings migration）+ apps/server-next（CrawlerTimelineCard + SchedulerConfigDrawer）。**v1 UI 不动**。
- **依赖**：SEQ-20260525-CRAWLER-W1 全部 8 子卡完成（✅）；plan 文件 `/Users/livefree/.claude/plans/cheerful-orbiting-hare.md` §10 各改进点
- **真源**：plan 文件 Fix-1/Fix-2A/Fix-3（§5/§6）+ 时间轴问题 T1-T5（§3.2）+ Fix-D5（§10.4.2）
- **总估时**：~1.3w（CW2-A 0.2w + CW2-B 0.55w + CW2-C 0.55w）

### 任务列表（按执行顺序）

1. **CHG-SN-9-CW2-A** — P0 数据丢失三合一守卫（Fix-1 + Fix-2A + Fix-3）
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 范围：纯后端 3 处守卫，无 ADR，无 migration
   - 文件范围：
     - `apps/api/src/services/CrawlerService.ts`（3 处改动）：
       - Fix-1：upsertVideo Step 6 进 replaceSourcesForSite 分支前加 empty sources 守卫（sourceMappings.length === 0 → emit warn + 跳过 replace）
       - Fix-2A：page loop break 截断时若 items.length >= EXPECTED_PAGE_SIZE → emit warn 'crawl.page.truncated'
       - Fix-3：parseVodItem 结果 for-loop 入口加 `if (!parsed.video.title)` → errors++ + emit warn + continue
     - `apps/api/src/db/queries/sources.maintenance.ts`（1 处改动）：replaceSourcesForSite 入口加 assertion `if (newSources.length === 0) throw new Error('...')`
   - 验收要点：
     - Fix-1 单测：mock CrawlerSource 返回空 vod_play_url → 断言不调 replaceSourcesForSite，emit 'crawl.upsert.empty_sources' warn
     - Fix-2A 单测：mock 站点返回满页 items → 断言 emit 'crawl.page.truncated' warn
     - Fix-3 单测：空 title item → 断言 insertCrawledVideo 不调用，errors++ 且 emit 'crawl.skip.empty_title' warn
     - assertion 测试：replaceSourcesForSite([], ...) → throw
   - 估时：0.2w
   - 实际开始：2026-05-25
   - 完成时间：2026-05-25
   - 状态：✅

2. **CHG-SN-9-CW2-B-ADR** — Gantt 时间轴重设计 ADR-153 起草
   - 创建时间：2026-05-25
   - 建议模型：opus 主循环 + arch-reviewer (claude-opus-4-7)
   - 范围：ADR-153 6 个决策点（D-153-1..6）
   - 文件范围：docs/decisions.md（追加 ADR-153）
   - 估时：0.15w
   - 实际开始：2026-05-25
   - 完成时间：2026-05-25
   - 状态：✅（ADR-153 🟢 Accepted via R3+Y3+G2 / arch-reviewer Opus A− → 等同 A）

3. **CHG-SN-9-CW2-B-EP** — Gantt 时间轴实施（ADR-153 落地）
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 依赖：CW2-B-ADR PASS
   - 文件范围：
     - `apps/api/src/db/queries/crawlerTimeline.ts`：
       - SQL `ranked_tasks.rn = 1` → `rn <= 3`（或 ADR 定的上限）
       - pending 起点：`COALESCE(started_at, NOW()-interval)` → `COALESCE(started_at, scheduled_at)`，不超窗口左侧
       - health 子查询 → LEFT JOIN CTE 消除 N+1
     - `apps/api/src/routes/admin/crawler.ts`（crawlerTimeline handler）：range 参数 zod enum 实装（30m/1h/2h/6h）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`：
       - 多 lane 渲染：同站点 rn>1 的 bar 垂直叠加（各 bar 占 height/N，gap 2px）
       - status 四态：`statusToCategory()` 拆 ok/warn/danger/neutral，neutral 色为 CSS 变量 `--color-neutral-3`
       - range select：30m/1h/2h/6h AdminSelect，onChange 触发 refetch
       - tick 时区：统一 `new Date(tick.iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})`
   - 验收要点：
     - 单测 crawlerTimeline.test：rn≤3 SQL 格式确认 + range 参数确认 + pending 起点 COALESCE(started_at, scheduled_at) 确认
     - 单测 CrawlerTimelineCard.test：多 bar 渲染（mock 3 tasks per site）+ neutral status + range select + tick 时区
   - 估时：0.4w
   - 实际开始：2026-05-25
   - 完成时间：2026-05-25
   - 状态：✅（ADR-153 全 4 项落地：SQL V2 / status 4 态双侧 / range 自治 / multi-lane 渲染；22 单测全通）

4. **CHG-SN-9-CW2-C-ADR** — Fix-D5 定时增强 ADR-154 起草
   - 创建时间：2026-05-25
   - 建议模型：opus 主循环 + arch-reviewer (claude-opus-4-7)
   - 范围：ADR-154 6 个决策点（D-154-1..6）
   - 关键决策点：
     - D-154-1：scheduleType enum — `daily | interval | cron`（或先 `daily | interval` 不引入 cron-parser）
     - D-154-2：cron-parser 引入决策（技术栈白名单确认；ADR 中记录版本约束 `^4.x`；若不引入则 D-154-1 降为两态）
     - D-154-3：`auto_crawl_last_trigger_date DATE` → `auto_crawl_last_trigger_at TIMESTAMPTZ`（避免同日重复逻辑升级为 timestamp 比对）
     - D-154-4：per-site schedule 字段扩展（AutoCrawlSiteOverride 加可选 `schedule?` 字段）
     - D-154-5：crawlerScheduler.ts dispatch 改写（`checkDaily / checkInterval / checkCron` 三分支）
     - D-154-6：UI SchedulerConfigDrawer scheduleType select + 条件渲染 input（daily → time picker / interval → minutes input / cron → expression input + preview）
   - 文件范围：docs/decisions.md（追加 ADR-154）
   - 注意：cron-parser 新依赖需在 ADR 中明示 `import('cron-parser')` 包名 + 版本；Opus 评审需确认是否触发 CLAUDE.md "引入技术栈以外的新依赖 → BLOCKER"（即**ADR PASS 相当于解除该 BLOCKER**）
   - 估时：0.15w
   - 实际开始：2026-05-25
   - 完成时间：2026-05-25
   - 状态：✅（ADR-154 🟢 Accepted / arch-reviewer Opus A− → 等同 A；D-154-1=B 两态/D-154-2=B 无 cron-parser；CW2-C-EP 须拆 -A/-B 子卡）

5a. **CHG-SN-9-CW2-C-EP-A** — Fix-D5 后端契约 + 调度（ADR-154 落地后端）
   - 创建时间：2026-05-25
   - 完成时间：2026-05-26
   - 建议模型：sonnet
   - 执行模型：claude-sonnet-4-6
   - 依赖：CW2-C-ADR PASS ✅（ADR-154 §5 步骤 1-6）
   - 文件范围：
     - `packages/types/src/system.types.ts`：AutoCrawlScheduleType + intervalMinutes + 新 SystemSettingKey 枚举
     - `apps/api/src/db/migrations/075_auto_crawl_schedule_extend.sql`：KV seed（auto_crawl_last_trigger_at）
     - `apps/api/src/db/queries/systemSettings.ts`：deserialize + set 读写 intervalMinutes / scheduleType 解除写死
     - `apps/api/src/routes/admin/crawler.ts`：zod schema 扩展（scheduleType enum + intervalMinutes min5/max1440）
     - `apps/api/src/workers/crawlerScheduler.ts`：dispatch 重构 + checkInterval + persistTriggerMark（R-154-1 锚点时序）
     - `tests/unit/api/crawlerScheduler.test.ts`（新建）：12 单测
     - `tests/unit/api/crawler-system-audit.test.ts`：intervalMinutes 补录 BEFORE/AFTER_CONFIG
   - 估时：0.25w
   - 状态：✅

5b. **CHG-SN-9-CW2-C-EP-B** — Fix-D5 前端 UI（SchedulerConfigDrawer）
   - 创建时间：2026-05-25
   - 完成时间：2026-05-26
   - 建议模型：sonnet
   - 执行模型：claude-sonnet-4-6
   - 依赖：CW2-C-EP-A（类型已合入）
   - 文件范围：
     - `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`：scheduleType AdminSelect + 条件渲染
     - `apps/server-next/src/lib/crawler/api.ts`：AutoCrawlScheduleType + intervalMinutes 类型同步
     - `tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx`：测试 #12/#13 新增
   - 估时：0.15w
   - 状态：✅

### W2 执行顺序 DAG

```
CW2-A（独立，立即可启）─────────────────────────────────────→ ✅

CW2-B-ADR ──→ CW2-B-EP ─────────────────────────────────→ ✅

CW2-C-ADR ✅ ──→ CW2-C-EP-A ──→ CW2-C-EP-B ──────────→ ⬜（已拆 -A/-B）
```

B 序列 + C 序列可与 A 并行（A 无依赖）；B 与 C 之间无依赖（可并行推进 ADR 轮）。

### W2 关键约束

- **cron-parser 新依赖门禁**：CW2-C-ADR Opus 评审即是"技术栈白名单例外申请"门控；ADR PASS = 许可引入；ADR 未 PASS 则 CW2-C-EP 降为仅 `daily + interval` 两模式
- **timeline SQL breaking change**：CW2-B-EP 改 rn≤3 将使前端 mock 数据形状变化，单测需同步更新 fixture
- **ADR-122 AMENDMENT**：CW2-B 改动 timeline 端点响应 schema，需在 ADR-153 §关联 ADR 中明示为 ADR-122 AMENDMENT（非新 ADR）；verify:endpoint-adr 不触发（无新路由注册）
- **migration 顺序**：CW2-C-EP migration 编号 075（接 CW1-E-EP 的 074）；若 CW2-A/B 期间有其它 migration 插入需调整
- **v1 server 不动**：全程不改 apps/server/ 任何文件
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**

---

## [SEQ-20260526-CRAWLER-W3-FIX] CRAWLER W3 — W1/W2 用户走读暴露的修复闭环

- **状态**：✅ 已完成（2026-05-26 / HOTFIX-A~G 7 卡 + REDESIGN-A-ADR + EP-1A/1B1/1B2/1B2-LAYOUT/1C-1a/1C-1b/1C-2a/1C-2b + EP-2 + EP-3a/3b-1 全部闭环 / @livefree 实测最后一项 HOTFIX-G 黄色 warning 通过）
- **创建时间**：2026-05-26 02:00
- **最后更新时间**：2026-05-26 18:00
- **目标**：消化 @livefree 用户走读 W1/W2 暴露的 4 类缺陷 — ① CW1-B SQL `r.site_key` 不存在（P0 阻塞 cancel/pause/detail）② CW2-B Gantt SQL WHERE 误用 scheduled_at + status 缺 pending（任务刷新消失）+ 布局三处缺陷（"实时"挤两行 / 当前时间在最右 / 站点 limit 硬编码）③ CW2-C Drawer 内 AdminSelect 被 z-index 遮挡（所有下拉不可用）④ CW1-E topbar 第 3 个铃铛未复用 AdminShell 已有 notifications/tasks 数据流 + ⑤ HOTFIX-B/C 实测追加：孤儿 run 转态 + AutoCrawlScheduleCard interval 显示 + scheduler 可见性 + 多 dailyTime（D-155-6）。
- **HOTFIX 进度**：HOTFIX-A ✅ + HOTFIX-B ✅ + HOTFIX-C ✅（2026-05-26 全部 commit + @livefree 实测 11 路径 PASS）
- **范围**：HOTFIX 三处 P0 已闭环；REDESIGN-A 六处设计层重做进行中（含 ADR AMENDMENT）
- **依赖**：W1（SEQ-20260525-CRAWLER-W1）+ W2（SEQ-20260525-CRAWLER-W2）全部 ✅
- **真源**：本会话 2026-05-26 排查 4 项根因 + 用户提议（行内展开 / Gantt 三段窗 / 复用 topbar 图标）
- **总估时**：~1.25w（HOTFIX-A 0.25w + REDESIGN-A 1.0w）

### 任务列表（按执行顺序）

1. **CHG-SN-9-CW1-CW2-HOTFIX-A** — W1/W2 三处 P0 + 1 处布局修补
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 6 路径 1/2/3/5/6 PASS / 路径 4 时间轴拖拽 + 历史回看改入 D-155-3 Gantt 三段窗 / commit d79769cc）
   - 创建时间：2026-05-26 02:00
   - 实际开始：2026-05-26 02:00
   - 完成时间：2026-05-26 03:30
   - 执行模型：claude-opus-4-7（主循环延续；建议 sonnet 但本会话 opus 上下文复用避免新会话重读）
   - 建议模型：sonnet（纯修补，无新决策）
   - 范围（实际落地）：
     - Step 1（CW1-B 根因）：`apps/api/src/db/queries/crawlerRuns.ts:362` SQL `RETURNING r.site_key` → 改用子查询 `(SELECT source_site FROM crawler_tasks WHERE run_id = r.id ORDER BY scheduled_at ASC LIMIT 1) AS site_key`。crawler_tasks 实际列名是 `source_site`，alias 仍是 `site_key` 保持调用方解析不变。涉及 commit `d2728a30` 引入的回归。
     - Step 2（CW2-B 数据根因）：`apps/api/src/db/queries/crawlerTimeline.ts:97` WHERE 改为 `COALESCE(ct.finished_at, NOW()) >= NOW() - $1::interval`（不再用 scheduled_at 误切窗口内有可见时段的 task）；status 白名单加 `'pending'`（与 ADR-153 §5 决策对齐）。
     - Step 3（CW2-C 根因 / 方案调整）：**原方案"改 z-admin-dropdown token 980→1050"调整为"改 AdminSelect 消费 z-admin-popover (1050)"** — 原方案会与已存在 z-admin-popover token 撞值导致语义混乱；新方案修 `packages/admin-ui/src/components/admin-select/admin-select.tsx:105` PANEL_STYLE.zIndex 单文件，token 不动。z-admin-popover 1050 本就为"Modal 内 popover 自然覆盖 Modal"设计（ADR-115 §2.5）。
     - Step 4（CW2-B 布局顺手修补）：`apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx` `PILL_BASE_STYLE` 加 `whiteSpace: 'nowrap'` + `flexShrink: 0`（"实时" pill 不再被压两行）。
   - 验收要点：
     - dev server 实测（必跑）：CrawlerRunsView 任意行点 暂停/取消 → toast success；点 run id 跳详情页 → meta + tasks 正常渲染；SchedulerConfigDrawer 打开 → scheduleType / defaultMode / conflictPolicy 三处 select 可正常展开选项；时间轴卡 "实时" pill 单行显示
     - 新增单测：tests/unit/api/crawlerRuns.test.ts 加 `syncRunStatusFromTasks` 返回 siteKey 非空 case（mock crawler_tasks 含 1+ 行）；tests/unit/api/crawlerTimeline.test.ts 加 "pending task 在窗口内可见" + "scheduled 在窗口外但 finished 在窗口内的 task 可见" 2 case
     - typecheck / lint / test / verify:adr-contracts 全过
   - 文件范围（实际落地）：
     - `apps/api/src/db/queries/crawlerRuns.ts`（Step 1）
     - `apps/api/src/db/queries/crawlerTimeline.ts`（Step 2）
     - `packages/admin-ui/src/components/admin-select/admin-select.tsx`（Step 3，方案调整 / token 不动）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（Step 4）
     - `tests/unit/api/crawler-runs-sync-status.test.ts`（新建，5 case）
     - `tests/unit/api/crawlerTimeline.test.ts`（扩展 3 case：HOTFIX-A #1/#2/#3）
   - 估时：0.25w
   - 关键约束：
     - **dev server 实测为硬前置**（W1/W2 全程绕过 ADR-149 §7 工程流程，本卡补上 — 至少跑一次"打开 crawler runs → 点 cancel → 看 toast success"完整流）
     - **z-index token 改动需补 ADR-153 / ADR-154 §关联 ADR 中 AMENDMENT 备注**（HOTFIX-A 不起新 ADR，但需在 REDESIGN-A 起 ADR AMENDMENT 时一并记录）
     - **不动设计层**：UI 布局 / 数据契约 / 路由结构 / 组件 API 一律不改；这些放 REDESIGN-A

2. **CHG-SN-9-CW1-CW2-HOTFIX-B** — 孤儿 run 转态 + AutoCrawlScheduleCard interval 显示
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 2 路径 7/8 PASS / commit 0a0cc4e8）
   - 创建时间：2026-05-26 02:30
   - 实际开始：2026-05-26 02:30
   - 完成时间：2026-05-26 03:30
   - 执行模型：claude-opus-4-7（主循环延续；HOTFIX-A 上下文复用）
   - 建议模型：sonnet（纯修补，无新决策）
   - 范围：HOTFIX-A 实测发现 2 缺陷：
     - **Step 1（P0 / 孤儿 run cancel/pause 不转态）**：`apps/api/src/db/queries/crawlerRuns.ts` `syncRunStatusFromTasks` SQL 在 `a.total = 0` 时保持 r.status 不变，导致历史 1 周以上 0-task 的 queued run 被 cancel 后 control_status='cancelling' 但 status 仍 'queued'，前端 toast 绿色"已请求取消 0/0"但 UI 无视觉变化、行又出现 [取消] 按钮。补 2 个 case：`a.total = 0 AND control_status IN ('cancelling', 'cancelled') → 'cancelled'` + `a.total = 0 AND control_status IN ('pausing', 'paused') → 'paused'`；兜底保留原 `WHEN a.total = 0 THEN r.status`（control_status='active' 不变）
     - **Step 2（P1 / CW2-C-EP-B 实施回归）**：`apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx:216` 写死 `每日 ${data.config.dailyTime} · 模式 ${modeLabel}`，interval 模式下显示无意义。改为按 `config.scheduleType` 切换：daily → "每日 HH:MM"，interval → "每 N 分钟"
   - 验收要点：
     - dev server 实测：CrawlerRunsView 历史 queued run（1 周以上）点 [取消] → toast 成功 + 行状态变 "已取消"（不再保持 queued + 可再点）；Dashboard AutoCrawlScheduleCard interval 模式显示 "每 60 分钟" 不是 "每日 undefined"
     - 新单测：`crawler-runs-sync-status.test.ts` 扩 3 case（control_status='cancelling' + 0 task → cancelled / control_status='paused' + 0 task → paused / control_status='active' + 0 task → 保持原 status）；`AutoCrawlScheduleCard.test.tsx` 加 1 case（CONFIG_INTERVAL → 渲染 "每 30 分钟"）
     - typecheck / lint / test / verify:adr-contracts 全过
   - 文件范围：
     - `apps/api/src/db/queries/crawlerRuns.ts`（Step 1：SQL CASE 扩 2 行）
     - `apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx`（Step 2：按 scheduleType 切换显示）
     - `tests/unit/api/crawler-runs-sync-status.test.ts`（扩 3 case）
     - `tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`（扩 1 case；如不存在则新建）
   - 估时：0.15w
   - 关键约束：
     - **Step 1 SQL CASE 必须放在原 `WHEN a.total = 0 THEN r.status` 之前**（PostgreSQL CASE 短路；新 case 更精确条件优先匹配）
     - **不动 control_status 写入逻辑**（只修 status 派生 case；control_status 由 route 层 updateRunControlStatus 写）
     - **worker 8 处 sync 调用方零行为变化**（worker job 永远先创 task，a.total > 0 永远不命中新 case）

3. **CHG-SN-9-CW1-CW2-HOTFIX-C** — schedulerEnabled UI 可见性警告
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 3 路径 9/10/11 PASS / 11 = 3:26 dailyTime 触发 daily run 成功 / commit b1491aea）

3b. **CHG-SN-9-CW1-CW2-HOTFIX-D** — scheduler daily 模式 catch-up window（5 分钟容错）
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 PASS / commit 71fa00b9）

3c. **CHG-SN-9-CW1-CW2-HOTFIX-E** — 时间轴默认 range 5m + 新增 5m option
   - 状态：✅ 完成（2026-05-26 / commit 已 push）

3d. **CHG-SN-9-CW1-CW2-HOTFIX-F** — KpiRow 横向滚动 + CrawlerClient OVERVIEW_ROW 弹性
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 PASS / commit c9d846e7）

3e. **CHG-SN-9-CW1-CW2-HOTFIX-G** — admin-shell-notifications console.error → console.warn（4 处）
   - 状态：✅ 完成（2026-05-26 17:55 / @livefree 实测黄色 warning PASS / commit b6620b5d）

3f. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-A** — dailyTimes 类型 required（消除 EP-1C-1a 临时偏离）
   - 状态：✅ 完成（2026-05-26 18:36）
   - 实际开始：2026-05-26 18:30
   - 完成时间：2026-05-26 18:36
   - 执行模型：claude-opus-4-7
   - 范围：`packages/types/src/system.types.ts` + `apps/server-next/src/lib/crawler/api.ts` 删 `dailyTimes?:` 的 `?` 改 required；不动消费方 fallback（fallback 删除 + fixture 补全规模超 PATCH 5 → 拆到 Cleanup-B/-C）
   - 文件范围：2 源 = 2 项（≪ 5 ✅）
   - 门禁：typecheck ✅ / lint ✅ / test 5142/5142 ✅ / verify:adr-contracts ✅
   - 0 cascade（消费方早已 `config.dailyTimes ?? [config.dailyTime]` 兼容）

3g. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-B1** — 后端 4 fixture 补 dailyTimes
   - 状态：✅ 完成（2026-05-26 19:25）
   - 实际开始：2026-05-26 19:18
   - 完成时间：2026-05-26 19:25
   - 执行模型：claude-opus-4-7
   - 范围：4 个后端测试 fixture 补 `dailyTimes: ['HH:MM']` 主字段（保留 dailyTime alias）：
     - `tests/unit/api/crawler-system-audit.test.ts` BEFORE_CONFIG + AFTER_CONFIG（2 处）
     - `tests/unit/api/crawlerScheduler.test.ts` #10 setAutoCrawlConfig interval fixture（1 处）
     - `tests/unit/api/background-event-service.test.ts` getAutoCrawlConfigMock 默认返回值（1 处）
     - `tests/e2e/admin.spec.ts` 2 处 auto-config 响应 body（playwright e2e mock）
   - **保留旧路径测试 fixture 不变**（#5 dailyTime alias 兼容 / #7d dailyTimes=[] 兜底 / #17 仅传 dailyTime 兜底）— 它们是测试 fallback 路径的 case，Cleanup-B3 删 fallback 时同步处理
   - 文件范围：4 测试 = 4 项（≤ 5 ✅）
   - 门禁：typecheck ✅ / lint 5/5 ✅ / test 5142/5142 ✅ / verify:adr-contracts ✅

3h. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-B2** — 前端 2 主路径 fixture 补 dailyTimes
   - 状态：✅ 完成（2026-05-26 19:30）
   - 执行模型：claude-opus-4-7
   - 范围：2 前端主路径 fixture 补 `dailyTimes: ['03:30']`：
     - `tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` CONFIG（#54 SchedulerConfigDrawer 自开）
     - `tests/unit/components/server-next/admin/dashboard/DashboardClient.test.tsx` mockGetAutoCrawlConfig 默认值
   - **不动 alias-only fixture**（3 处）：BASE_CONFIG (AutoCrawlScheduleCard / AutoCrawlSummaryCard) + CONFIG (SchedulerConfigDrawer) — 这些专门测 dailyTime alias 兜底路径（#13 / #7 / #5 case）；Cleanup-B3 删 fallback 时同步删除（路径不再有意义）
   - 文件范围：2 测试 = 2 项（≪ 5 ✅）
   - 门禁：typecheck ✅ / test 82/82 ✅

3i. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-B3** — 删 5 fallback + 6 旧路径 case（B3a 后端 + B3b 前端合并）
   - 状态：✅ 完成（2026-05-26 19:33 / @livefree 协作分支同改前端）
   - 执行模型：claude-opus-4-7
   - 范围：
     - `apps/api/src/workers/crawlerScheduler.ts` checkDaily 删 fallback `[config.dailyTime || '03:00']` + Pick 删 dailyTime → 直接 `const times = config.dailyTimes`
     - `apps/api/src/db/queries/systemSettings.ts` setAutoCrawlConfig 删 fallback → 直接 `config.dailyTimes.map(parseDailyTime)`
     - `tests/unit/api/crawlerScheduler.test.ts` 删 #5 (alias 兼容) + #7d (空数组兜底) + #17 (仅传 dailyTime 兜底) — 这 3 case 测的是已删 fallback 路径
   - 文件范围：2 源 + 1 测试 = 3 项（≪ 5 ✅）
   - 门禁：typecheck ✅ / test 29/29 ✅（原 32 - 3 已删 case）

3j. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-C1** — 删 `AutoCrawlConfig.dailyTime` alias 类型声明（原子类型删除）
   - 状态：✅ 完成（2026-05-26 19:43）
   - 执行模型：claude-sonnet-4-6
   - 范围：6 源（types + api.ts + systemSettings + crawler.ts route + crawler-scheduling + SchedulerConfigDrawer）+ 2 测试（crawlerScheduler + crawler-system-audit）
   - 文件范围：8 项（原子耦合，类型删除整批 typecheck 通过）
   - 门禁：typecheck ✅ / test 34/34 ✅

3k. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-C2** — 删 3 test fixture 残余 dailyTime + 修 #18 断言
   - 状态：✅ 完成（2026-05-26 / commit 58222282）

3l-quad. **N1-EP2-2 推迟决策**（2026-05-26 / 主循环复核）
   - 实际范围：useAdminNotifications + useAdminTasks 各自并发请求 `/admin/system/background-events` → 60s 内同端点重复 GET
   - 不是设计冲突；EP-2 arch-reviewer 评审已建议 "留待 ADR-156 端点合并（`/admin/notifications?include=background`）自然消除"
   - 短期方案（Y-155-3）：接受额外 60s 1 个轮询请求开销 / 性能影响可控
   - 长期演化触发条件：60s 双端点轮询性能瓶颈出现 + ADR-156 «notifications 端点扩展» 起卡

3l-tris. **CHG-SN-9-N1-EP2-1** — globalMutateRegistry Set → Map<id, fn> 强化去重
   - 状态：✅ 完成（2026-05-26 20:15）
   - 执行模型：claude-opus-4-7
   - 范围：
     - `apps/server-next/src/lib/admin-shell-background-events.ts` Set → Map<string, () => Promise<void>> + invalidate 用 .values()
     - `apps/server-next/src/lib/admin-shell-notifications.ts` 2 处 register 改 `.set(id, fn)` + `.delete(id)`（id='admin-notifications' / 'admin-tasks'）
   - 价值：同 id 重复注册只保留最新 fn / 防 React StrictMode + HMR 导致 stale reference 残留
   - 文件范围：2 源 = 2 项（≪ 5 ✅）
   - 门禁：typecheck ✅ / test 12/12 ✅ / verify:adr-contracts ✅（含 mirror drift 守卫）

3l-bis. **CHG-SN-9-N1-EP2-3** — admin-shell types drift 守卫脚本（ADR-152 + ADR-155 D-155-2 EP-2）
   - 状态：✅ 完成（2026-05-26 20:10）
   - 执行模型：claude-opus-4-7
   - 范围：
     - 新建 `scripts/verify-admin-shell-types-mirror.mjs`（正则解析 interface 字段 + 名称/类型/可选性比对 / drift 检出退出 1 阻塞 CI）
     - 守卫对象：`NotificationItem` ↔ `AdminNotificationItem` + `TaskItem` ↔ `AdminTaskItem`（packages/admin-ui SSOT vs packages/types API 镜像）
     - `package.json` 加 npm script + 集成到 `verify:adr-contracts` 汇总链
   - 验证：当前两源全部对齐 ✅ / 反向测试（改 progress → progressPct）检出 2 处 drift ✅
   - 文件范围：1 新脚本 + 1 package.json + 2 docs = 4 项（≤ 5 ✅）

3l. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-D** — 删 7 fixture + 1 注释残余 dailyTime 字面量（D1 后端 + D2 前端）
   - 状态：✅ 完成（2026-05-26 20:00）
   - 执行模型：claude-opus-4-7
   - 范围：
     - **D1（后端 3 文件）**：
       - `tests/unit/api/crawlerScheduler.test.ts` 删 #10 + #16 setAutoCrawlConfig fixture 残余 `dailyTime` 字段（2 处）
       - `tests/unit/api/background-event-service.test.ts` 删 getAutoCrawlConfigMock 残余 `dailyTime` 字段
       - `tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx` 注释更新 "CONFIG.dailyTime 兜底" → "CONFIG.dailyTimes=['03:30']"
     - **D2（前端 4 文件）**：
       - `AutoCrawlScheduleCard.test.tsx` 删 CONFIG_MULTI 残余 `dailyTime`
       - `AutoCrawlSummaryCard.test.tsx` 删 BASE_CONFIG + CONFIG_MULTI 残余 + 修 #4 close 断言 `dailyTime: '03:30'` → `dailyTimes: ['03:30']`
       - `CrawlerClient.test.tsx` 删 #54 CONFIG 残余
       - `DashboardClient.test.tsx` 删 mockGetAutoCrawlConfig 残余
   - 剩余 1 处 `dailyTime: '03:00'` 在 v1 server `apps/server/.../AutoCrawlSettingsPanel.tsx`（已冻结 / 不在范围）
   - 文件范围：D1（3）+ D2（4）= 7 测试 ≤ 5 → 分两次 commit（D1 + D2）或一次合并
   - 门禁：typecheck ✅ / D1 60/60 ✅ / D2 102/102 ✅
   - 范围：删 5 处 fallback (`config.dailyTimes && length > 0 ? ... : [config.dailyTime || '03:00']`) + 补 8 个 test fixture 显式提供 dailyTimes + 删 dailyTime alias 字段
   - 拆分：
     - Cleanup-B1：补 4 个 backend test fixture（crawlerScheduler / crawler-system-audit / background-event-service / e2e admin）
     - Cleanup-B2：补 4 个 frontend test fixture（AutoCrawlScheduleCard / AutoCrawlSummaryCard / SchedulerConfigDrawer / CrawlerClient + DashboardClient）
     - Cleanup-B3：删 3 处前端 + 2 处后端 fallback
     - Cleanup-C：删 dailyTime alias 字段（双源类型 + 调用方 setConfig 写入 + zod schema 简化）
   - 触发条件：D-155-6 多 dailyTime 功能稳定 1+ 周后；或下一个相关任务卡顺手清理
   - 实际开始：2026-05-26 17:50
   - 完成时间：2026-05-26 17:55
   - 执行模型：claude-opus-4-7（主循环延续；HOTFIX-F 上下文复用）
   - 触发：@livefree HOTFIX-F 实测后报 console 错误 "ApiClientError 请求失败，请稍后重试" / api-client.ts:31:5 — 根因为 Y-EP2-3 Promise.allSettled rejected 分支 `console.error` 把 ApiClientError 实例打印为浏览器 console 红色 stack（语义应为降级 warn 不是 error）
   - 范围：4 处 `console.error('[...] failed:', reason)` → `console.warn('[...] failed (degraded mode):', reason)`（admin-shell-notifications.ts useAdminNotifications/useAdminTasks）
   - 文件范围：1 源 = 1 项 PATCH（≪ 5 ✅）
   - 门禁：typecheck ✅ / lint ✅ / test 12/12 ✅（stderr 已显示 "(degraded mode)" 文案生效）/ verify:adr-contracts ✅
   - 创建时间：2026-05-26 05:40
   - 实际开始：2026-05-26 05:40
   - 完成时间：2026-05-26 06:00
   - 执行模型：claude-opus-4-7
   - 范围：crawlerScheduler.ts checkDaily catch-up window（5min）+ marks 防重 + 跨午夜不补 + 7 case 单测
   - 文件范围：1 源 + 1 测试 = 2 项 ✅
   - 触发：@livefree EP-1C-2b 实测后追问"若到时间未启动如何处理" → 暴露 ADR-154 D-154-5 §checkDaily 精确匹配的设计缺口
   - 不起新 ADR（健壮性补丁 / ADR-155 §7 风险章节"实施期评估"范式延伸）
   - 创建时间：2026-05-26 03:00
   - 实际开始：2026-05-26 03:00
   - 完成时间：2026-05-26 03:30
   - 执行模型：claude-opus-4-7（主循环延续）
   - 建议模型：sonnet（纯 UI 警告 + 单测，无新决策）
   - 范围：HOTFIX-B 实测发现 — scheduler 是 opt-in (`CRAWLER_SCHEDULER_ENABLED === 'true'`)，用户 `.env.local` 无此设置导致 scheduler 进程从未注册，UI 完全无感知。后端 `/admin/crawler/system-status` 已暴露 `schedulerEnabled: boolean`，前端 0 消费。
   - 决策约束：用户选择"手动改 .env.local"路径（不改 scheduler 默认 opt-out → opt-in 语义），本卡只做"可见性"。
   - Step 1（UI 警告 / P1）：`AutoCrawlScheduleCard.tsx` 渲染前增加 `schedulerEnabled === false` 优先判定 → 渲染 danger 状态卡："调度器进程未启动 · 联系 dev 设 `CRAWLER_SCHEDULER_ENABLED=true` 并重启 api"（替代任何 countdown/disabled/failed/error 显示，因为没有 scheduler 进程时 autoCrawlNext 字段不可信）
   - Step 2（PageHeader chip 警告 / P1）：`CrawlerClient.tsx:436` subtitle 在 `status?.schedulerEnabled === false` 时 chip 显 "🚨 调度器未启动"（红字 / cursor:help / title 提示）替代 "下次自动: HH:MM"
   - Step 3（单测）：`AutoCrawlScheduleCard.test.tsx` 加 1 case（schedulerEnabled=false → danger 警告卡 + 不渲染 autoCrawlNext）；`CrawlerSystemStatus` 类型确认 `schedulerEnabled?: boolean` 已存在
   - 验收要点：
     - dev server 实测前置（用户）：暂不改 .env.local（保持 scheduler disabled）→ 重启 api → Dashboard AutoCrawlScheduleCard 显示红色警告卡 / PageHeader chip 显 "🚨 调度器未启动"
     - dev server 实测验证（用户）：`.env.local` 加 `CRAWLER_SCHEDULER_ENABLED=true` 重启 api → 警告卡消失 / 回到 countdown 正常显示
     - typecheck / lint / test / verify:adr-contracts 全过
   - 文件范围：
     - `apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx`（Step 1：6 状态 → 7 状态，scheduler-disabled 优先）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（Step 2：subtitle chip 条件渲染）
     - `apps/server-next/src/lib/crawler/api.ts`（确认 `CrawlerSystemStatus.schedulerEnabled?: boolean` 已存在；如缺则补）
     - `tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`（扩 1 case）
   - 估时：0.1w
   - 关键约束：
     - **本卡不改 scheduler 默认值**（用户决定路径：手动 .env.local）
     - **D-155-6 多 dailyTime 不在本卡范围**（已加入 REDESIGN-A-EP-1）
     - **schedulerEnabled=false 时禁止信任 autoCrawlNext**（scheduler 进程不存在时该字段是过期数据 / 误导用户）

4. **CHG-SN-9-CW1-CW2-REDESIGN-A-ADR** — 六处设计层重做 ADR 起草（合并）
   - 状态：✅ 完成（2026-05-26 / ADR-155 🟢 Accepted / arch-reviewer Opus A− CONDITIONAL → 主循环消化 6 红线 + 5 黄线 + 4 关键洞察 → 等同 A / EP 拆为 6 子卡 EP-1A/B/C-1/C-2/2/3）
   - 创建时间：2026-05-26 02:00
   - 最后更新：2026-05-26 04:00（消化评审完成）
   - 实际开始：2026-05-26 03:30
   - 完成时间：2026-05-26 04:00
   - 执行模型：claude-opus-4-7（主循环）
   - 子代理：arch-reviewer (claude-opus-4-7) — 1 轮独立评审 A− CONDITIONAL（6 红线 + 5 黄线 + 3 绿线 + 4 关键洞察 / 输出 agentId a7a1717c2ef082558）
   - 范围：起草 1 份合并 ADR（暂定 ADR-155 «CW1/CW2 用户走读修订») 覆盖 5 个独立但相关的设计决策：
     - **D-155-1（CW1-B 行内展开）**：`/admin/crawler/runs` list 行点击切换 expand panel（消费现有 `renderExpandedRow` + `expandedKeys` API），expand body 复用 `RunInlinePanel`（拆自 CrawlerRunDetailView 的 meta grid + tasks 子表 + TaskLogsDrawer）；独立路由 `/admin/crawler/runs/[id]` 保留为 deep link fallback（含 PageHeader 自渲）
     - **D-155-2（CW1-E 复用 Topbar 图标）**：删除 BackgroundEventBell `position:fixed` 旁路叠加；BackgroundEventService 三源（autoCrawlNext + scheduler + 高危 audit）合并到 `useAdminNotifications` + `useAdminTasks` 现有数据流；扩展 `NotificationItem` discriminated union 加 background category（**触发 packages/admin-ui/src/**/types.ts 改动 → 强制 Opus arch-reviewer trailer**）
     - **D-155-3（CW2-B Gantt 三段窗）**：时间窗从 `[NOW-range, NOW]` 改为 `[NOW-range×0.8, NOW+range×0.2]`；加 now-line 垂直指示线（width=1px, color=var(--accent-default)）；pending bar 显示在 `scheduled_at` 真实位置（不再 clamp 到 NOW），用虚线边框 + 半透明区分；range 选项加 `12h / 24h / 7d`；空窗口加"扩大范围"快捷
     - **D-155-4（CW2-B 站点上限解锁）**：`limit` 从硬编码 8 改为 `range select` 旁边的可选项（8 / 20 / all），后端 `crawlerTimeline.ts` `safeLimit` 上限提到 50；超过 50 站给出"性能模式建议筛选站点"提示
     - **D-155-5（定时设置显式入口卡）**：`/admin/crawler` 顶部加 "AutoCrawlSummaryCard"（紧邻 PageHeader 下方）展示当前生效配置 — scheduleType label + 时间/间隔显示 + globalEnabled 状态 pill + [立即关闭] 快捷按钮（toggle globalEnabled=false 不弹 Drawer）+ [编辑] 按钮（打开 SchedulerConfigDrawer）
     - **D-155-6（多 dailyTime 支持）**：UI 改 `dailyTime` 为 `dailyTimes: string[]`（chip-based 时间列表，可加可删，至少 1 个）；后端 KV `auto_crawl_daily_time` 改 JSON 数组（向后兼容：单字符串旧值 → 解析为 [v]）；`checkDaily` 改"任一时间匹配则触发"；`auto_crawl_last_trigger_date` 加 dailyTime 维度（防同日同时间重复触发但允许同日不同时间多次触发） — 关键决策：相同 dailyTime 同日防重，不同 dailyTime 同日各自触发一次
   - 文件范围：
     - `docs/decisions.md`（追加 ADR-155 完整文本）
     - 同 commit 标注 ADR-122 / ADR-152 / ADR-153 §关联 ADR AMENDMENT
   - 估时：0.25w
   - 关键约束：
     - **强制 Opus 主循环 + arch-reviewer (Opus) 1 轮独立评审**（D-155-2 触发 admin-ui types 改动 → CLAUDE.md "共享组件 API 契约强制 Opus"）
     - **触发 plan §4.5 R7 MUST-8 守门**：ADR PASS 才能起 -EP 实施卡（D-155-2 新增 NotificationItem 字段属共享组件 API 契约）
     - **AMENDMENT 引用必填**：ADR-155 §关联 ADR 必须明列 ADR-122 / ADR-152 / ADR-153 三处 AMENDMENT 说明

5. **CHG-SN-9-CW1-CW2-REDESIGN-A-EP-1** — D-155-1/4/5/6 实施（ADR-155 §5 拆为 5 个子卡 EP-1A/1B/1C-1/1C-2）
   - 状态：🟡 EP-1A ✅ 完成 / EP-1B/1C-1/1C-2 ⬜ 待启动
   - 创建时间：2026-05-26 02:00
   - 最后更新：2026-05-26 04:00（EP-1A commit）
   - 建议模型：sonnet
   - 依赖：CW1-CW2-REDESIGN-A-ADR PASS ✅

   **EP-1A（D-155-1 行内展开）✅ 完成**：
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 6 路径 PASS / commit 3e0495fe）
   - 实际开始：2026-05-26 04:00
   - 完成时间：—（实测 PASS 后回填）
   - 执行模型：claude-opus-4-7（主循环延续）
   - 文件改动：3 源 + 2 测试 = 5 项（PATCH ≤ 5 ✅）

   **EP-1B 拆为 EP-1B1 + EP-1B2**（满足 PATCH ≤ 5 项硬约束 / 评审消化外的实施期 plan-revision）：
   - **EP-1B1（D-155-4 站点 limit 解锁）✅ 完成**（2026-05-26 / commit 9302cf95 / @livefree 实测 3 路径 PASS）
   - **EP-1B2（D-155-5 AutoCrawlSummaryCard）✅ 完成**（2026-05-26 / commit cbdf2e42 / 实测 PASS）
   - **EP-1B2-LAYOUT（D-155-5 实施期布局延伸 / plan-revision）✅ 完成**（2026-05-26 / @livefree 实测 5 路径 PASS / commit 031be4a6）

   **EP-1C-1 拆为 EP-1C-1a + EP-1C-1b**（满足 PATCH ≤ 5 项硬约束 / plan-revision）：
   - **EP-1C-1a（类型契约 + KV 3 路径兼容）✅ 完成**（2026-05-26 / commit c3d010f7）
   - **EP-1C-1b（zod preprocess + scheduler checkDaily/marks/GC + ADR-154 AMENDMENT）✅ 完成**（2026-05-26 / @livefree 实测 PASS / commit 96f369f1）

   **EP-1C-2 拆为 EP-1C-2a + EP-1C-2b**（满足 PATCH ≤ 5 项硬约束 / plan-revision）：
   - **EP-1C-2a（SchedulerConfigDrawer chip 列表）✅ 完成**（2026-05-26 / @livefree 实测 7 路径 PASS / commit fd02cbf9）
   - **EP-1C-2b（AutoCrawlScheduleCard + AutoCrawlSummaryCard 多时间显示）✅ 完成**（2026-05-26 / @livefree 实测多时间显示一致性 PASS / commit 4c29d312）

   **D-155-6 多 dailyTime + HOTFIX-D catch-up 全链路完成 ✅**（2026-05-26）**
   - 范围：拆 CrawlerRunDetailView 为 RunInlinePanel + CrawlerRunsView 接 expand + timeline limit 解锁 + 后端 safeLimit 上限提到 50 + 新建 AutoCrawlSummaryCard 顶部展示 + 多 dailyTime 全栈
   - 文件范围：
     - `apps/server-next/src/app/admin/crawler/runs/_client/CrawlerRunsView.tsx`（接 expandedKeys + renderExpandedRow + 改 Run ID 列 cell 为 toggle）
     - `apps/server-next/src/app/admin/crawler/runs/[id]/_client/RunInlinePanel.tsx`（新建，拆自 CrawlerRunDetailView）
     - `apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView.tsx`（瘦身）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（加 limit select）
     - `apps/api/src/db/queries/crawlerTimeline.ts`（safeLimit 上限 20→50）
     - `apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard.tsx`（新建 D-155-5）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（嵌入 AutoCrawlSummaryCard）
     - **D-155-6 多 dailyTime 全栈**：
       - `packages/types/src/system.types.ts`（`AutoCrawlConfig.dailyTime: string` → `dailyTimes: string[]`；min 1 max 24）
       - `apps/api/src/db/queries/systemSettings.ts`（serialize JSON array + deserialize 兼容旧单字符串）
       - `apps/api/src/workers/crawlerScheduler.ts`（`checkDaily` 改 "任一 dailyTime 匹配触发" + `auto_crawl_last_trigger_date` 加时间维度 → `auto_crawl_last_trigger_marks: { 'YYYY-MM-DD HH:MM': true, ... }`）
       - `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`（dailyTime 单 input → chip 列表 UI：可加可删，至少 1 个，最多 24 个）
       - `apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx` + 上面 D-155-5 卡（显示多时间："每日 03:00, 04:00"）
     - 单测扩展（CrawlerRunsView / RunInlinePanel / CrawlerTimelineCard / AutoCrawlSummaryCard / SchedulerConfigDrawer 多 dailyTime UI / checkDaily 多时间匹配 / systemSettings 兼容旧单字符串）
   - 验收要点：dev server 实测 — 行内展开 + timeline limit + AutoCrawlSummaryCard + SchedulerConfigDrawer 加 3 个 dailyTime chip 保存 → 当日 3 个时间各触发一次（相同 dailyTime 同日防重）
   - 估时：0.55w（D-155-5 +0.05 + D-155-6 +0.2 = +0.25 over 原 0.3）

6. **CHG-SN-9-CW1-CW2-REDESIGN-A-EP-2** — D-155-2 实施（CW1-E 合并到 AdminShell notifications/tasks）✅ 完成
   - 状态：🟡 代码已落地 / arch-reviewer Opus A− CONDITIONAL → 消化 Y-EP2-1/3 + G-EP2-3 后等同 A / 待 @livefree dev 实测 4 路径
   - 实际开始：2026-05-26 06:10
   - 执行模型：claude-opus-4-7（主循环）+ arch-reviewer (claude-opus-4-7)（强制 Opus trailer）
   - 文件改动：6 改 + 2 删 + 2 测试 = 10 项（ADR-155 §5 临界可接受 / 强制 Opus 弥补）
   - 评审 agentId：a40172d3c90586584
   - ADR-152 §AMENDMENT 2026-05-26 已落盘
   - 状态：⬜
   - 创建时间：2026-05-26 02:00
   - 建议模型：sonnet
   - 依赖：CW1-CW2-REDESIGN-A-ADR PASS
   - 范围：扩展 NotificationItem discriminated union + 合并 BackgroundEventService 到 useAdminNotifications/useAdminTasks + 删除 BackgroundEventBell
   - 文件范围：
     - `packages/admin-ui/src/shell/types.ts`（扩展 NotificationItem 加 background category，**强制 Opus arch-reviewer trailer**）
     - `apps/server-next/src/lib/admin-shell-notifications.ts`（合并 BackgroundEventService 三源到 useAdminNotifications + useAdminTasks）
     - `apps/server-next/src/app/admin/admin-shell-client.tsx`（删除 BackgroundEventBell 引用 + 删除 useAdminBackgroundEvents）
     - **删除文件**：`apps/server-next/src/components/admin-shell/BackgroundEventBell.tsx` + `apps/server-next/src/lib/admin-shell-background-events.ts`
     - `apps/api/src/services/BackgroundEventService.ts`（保留：仍是端点真源，但调用方改为 NotificationService 内部）
     - 单测扩展（admin-shell-notifications.test 加 background category case）
   - 验收要点：dev server 实测 — topbar 仅有铃铛 + 闪电两图标；点铃铛弹 NotificationDrawer 显示 autoCrawlNext + 高危 audit 上方"即将"组 + 下方"近期完成/失败"组；点闪电弹 TaskDrawer 显示 active crawler_runs；写操作（立即采集）后两 drawer 同步刷新
   - 估时：0.3w
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`（CLAUDE.md ❌ 共享组件 API 契约强制 Opus）

7. **CHG-SN-9-CW1-CW2-REDESIGN-A-EP-3 拆为 EP-3a + EP-3b**（满足 PATCH ≤ 5 项硬约束 / plan-revision）：
   - **EP-3a（后端 Gantt 三段窗 + range 扩展 + JS clamp 双字段）🟡 代码已落地** / 2 源 + 2 测试 = 4 项 ✅ / 5136 PASS / ADR-122 + ADR-153 双 AMENDMENT 已落盘 / 待 @livefree 实测（本卡纯后端）
   - **EP-3b 拆为 EP-3b-1 + N1-EP3b-2**（拖拽 pan 推迟到实测后评估 / plan-revision）：
     - **EP-3b-1（now-line + range 4→7 + pending 虚线）🟡 代码已落地** / 2 源 + 1 测试 = 3 项 ✅ / 5139 PASS / 待 @livefree 实测 4 路径
     - **N1-EP3b-2（拖拽 pan + viewport buffer + 30d 封顶）推迟** / @livefree 实测三段窗 + 7 选项 range 后评估是否真需要 / 若 7d 已覆盖回看可永久推迟
   - 状态：⬜
   - 创建时间：2026-05-26 02:00
   - 建议模型：sonnet
   - 依赖：CW1-CW2-REDESIGN-A-ADR PASS + HOTFIX-A 完成（Step 2 SQL fix 是本卡前置）
   - 范围：时间窗策略改造 + now-line 渲染 + pending bar 位置修正 + 12h/24h/7d range
   - 文件范围：
     - `apps/api/src/db/queries/crawlerTimeline.ts`（RANGE_TO_INTERVAL/MS 加 12h/24h/7d；rangeStart/rangeEnd 改为 `[NOW-range×0.8, NOW+range×0.2]`；pending task 不再 clamp started_at 到 NOW，保留 scheduled_at 真实值）
     - `apps/api/src/routes/admin/crawler.ts`（timeline route range zod enum 加 12h/24h/7d）
     - `apps/server-next/src/lib/crawler/api.ts`（CrawlerTimelineRange 类型扩展）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（加 now-line 渲染 + pending bar 虚线样式 + range select 4→7 选项 + 空窗口"扩大范围"快捷）
     - 单测扩展（crawlerTimeline.test 加 12h/24h/7d range case + pending bar 真位 case；CrawlerTimelineCard.test 加 now-line 渲染 + 7 range 选项 case）
   - 验收要点：dev server 实测 — 时间轴 NOW 位置可见垂直 now-line；pending 任务 bar 在其 scheduled_at 真实位置（不再贴最右）；range 切到 24h 看到完整一天的历史；空窗口给出"扩大到 6h"按钮
   - 估时：0.4w

### W3-FIX 执行顺序 DAG

```
HOTFIX-A（commit d79769cc / 待 dev 实测 1/2/3/5/6 ✅）──────→ 🟡（4 改入 D-155-3）

HOTFIX-B（commit 0a0cc4e8 / 待 dev 实测 7/8）─────────────→ 🟡

HOTFIX-C（schedulerEnabled UI 可见性 / HOTFIX-B 实测发现）→ ⬜

REDESIGN-A-ADR ──┬─→ REDESIGN-A-EP-1（D-155-1/4/5/6）→ ⬜
                 ├─→ REDESIGN-A-EP-2（D-155-2）→ ⬜
                 └─→ REDESIGN-A-EP-3（D-155-3）→ ⬜
                            ↑ 依赖 HOTFIX-A Step 2 SQL fix
```

HOTFIX-A → B → C 顺序串行（B 在 A SQL fix 基础上扩 CASE / C 在 B 实测发现）；REDESIGN-A-ADR 可与 HOTFIX-C 并行起草；EP-1/2/3 互不依赖（可并行）但 EP-3 需 HOTFIX-A Step 2 完成。

### W3-FIX 关键约束

- **dev server 实测为硬前置（绝不可省）**：W1/W2 全程绕过 ADR-149 §7 工程流程导致 3 个 P0 漏检；本 SEQ 每卡完成前必须人工走读 ≥ 1 次完整 UX 路径
- **D-155-2 触发 admin-ui types 改动 → 强制 Opus arch-reviewer trailer**（CLAUDE.md 明禁条款）
- **HOTFIX-A 与 REDESIGN-A-EP-3 时序协调**：避免 SQL 双重改动 conflict（EP-3 在 HOTFIX-A 完成后再启）
- **ADR-155 AMENDMENT 引用必填**：ADR-122 / ADR-152 / ADR-153 三处 §关联 ADR 必须同 commit 标注
- **v1 server 不动**：全程不改 apps/server/ 任何文件（沿用 W1/W2 约束）
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**

---

## [SEQ-20260526-ENUMS-SSOT-01] 视频枚举值 SSOT 收口（用户反馈：编辑表单类型只 4 种）

- **状态**：🔄 执行中
- **创建时间**：2026-05-26 20:30
- **最后更新时间**：2026-05-26 20:30
- **目标**：修复 server-next 视频编辑表单 VideoType 下拉 4→11 项（用户反馈，权威 enum 11 项），并起 ADR-157 沉淀「视频枚举值跨层 SSOT 协议」根治后续漂移
- **范围**：apps/server-next/src/app/admin/videos/_client/ 内常量整合 + docs/decisions.md 追加 ADR-157
- **依赖**：无（独立序列）

### 任务列表（按执行顺序）

1. **CHG-337** — TabBasicInfo VideoType 4→11 + server-next 内 VIDEO_TYPE_OPTIONS 收口（状态：✅ 已完成）
   - 创建时间：2026-05-26 20:30
   - 计划开始：2026-05-26 20:30
   - 实际开始：2026-05-26 20:30
   - 完成时间：2026-05-26 21:15
   - 建议模型：sonnet（轻量代码修复 / 3 文件 / 无 schema 变更）
   - 执行模型：claude-opus-4-7（偏离：本会话主循环 Opus / 用户直接驱动 / 无架构决策风险低）
   - 文件范围：
     - `apps/server-next/src/app/admin/videos/_client/videoEnumOptions.ts`（新建 15 行：VIDEO_TYPE_OPTIONS 11 项）
     - `apps/server-next/src/app/admin/videos/_client/_videoEdit/TabBasicInfo.tsx`（删本地 4 项常量 → import 共享）
     - `apps/server-next/src/app/admin/videos/_client/VideoFilterFields.tsx`（删本地 11 项常量 → re-export 共享 / 保持 VideoListClient.tsx 向后兼容）
   - 完成备注：
     - 单测 101/101 PASS（含 VideoListClient / VideoFilters / ContentRefPicker / saved-views / SelectionActions / VideoRowActions / VideoListClient.client / VideoEditDrawer 共 8 文件 101 用例）
     - typecheck + lint + verify:adr-contracts 全 PASS（lint 仅有预先存在 warnings 与本卡无关）
     - PATCH 项数 3（≪ 5 ✅）
     - 共享层沉淀评估：建 server-next 内部共享 videoEnumOptions.ts（消除 TabBasicInfo + VideoFilterFields 2 处独立）；跨包真 SSOT（packages/types `as const` 数组 + admin-ui Option helpers）留 ADR-157 决策后另起卡
     - **本卡发现的扩范围 / 转入 ADR-157 §5 实施分卡**：
       - `HomeModuleDrawer.tsx:57` — 独立 11 项常量（label 风格"电影 (movie)"含 raw 值 / 不缺项 / 仅风格漂移）
       - `SubmissionsListClient.tsx:59` — 独立 **9 项**常量（**缺 news/kids 2 项 / P1 缺陷**）
       - apps/server v1 `AdminVideoForm.tsx:15` — VideoGenre 15/20（**缺 5 项 / P1 缺陷**）
       - apps/web-next `SearchPage` tab 4/11（P1）+ `FallbackCover` icon 5/11（P2）+ `VideoMeta` i18n 缺失（P2）+ `video-route` PRIMARY_DETAIL_TYPES 4/11（P2）
   - 验收要点：typecheck + lint + test 全 PASS ✅；视频编辑表单 type 下拉显示 11 项 / 待 @livefree dev server 实测确认

2. **CHG-338** — 起草 ADR-157「视频枚举值跨层 SSOT 协议」（状态：✅ 已完成）
   - 创建时间：2026-05-26 20:30
   - 实际开始：2026-05-26 21:20
   - 完成时间：2026-05-26 21:55
   - 建议模型：opus（撰写 ADR / 强制 spawn arch-reviewer Opus 评审）
   - 执行模型：claude-opus-4-7（主循环 Opus）
   - 子代理调用：arch-reviewer (claude-opus-4-7) / agentId: ab9d05b03359abb45
   - 文件范围：`docs/decisions.md`（追加 ADR-157 约 300 行 / 15035~15334）
   - 完成备注：
     - **arch-reviewer Opus 评审结论**：A- CONDITIONAL（1 红线 + 2 黄线 + 3 绿线 + 关键洞察 #3）
     - **1 红线 R-157-1 已闭环**：API zod 层联动缺失 → §3 D-157-1 增 "API zod 层联动" 块 + §3 D-157-4 白名单删除 `apps/api/src/routes/admin/**` 全量豁免 + §6 增验收第 6 条
     - **2 黄线全闭环**：Y-157-1（命名统一 VIDEO_TYPES 对齐 SPEED_PRESETS 范式）/ Y-157-2（删 EnumOption / 改扩展既有 `AdminSelectOption<T extends string = string>` 泛型）
     - **3 绿线全纳入正文**（不推迟）：G-157-1 assertExhaustive 归属 `packages/types/src/utils/exhaustive.ts` / G-157-2 baseline 截止 +1月 → +2月 + 月度评审 / G-157-3 fallback 删除责任明示
     - **关键洞察 #3 已闭环**：CHG-339 PATCH 项口径明示 "1 enum 双形态视为 1 项"；CHG-340 进一步拆 -A/-B/-C 三子卡确保每卡 ≤ 5
     - **D-N 偏离登记**：D-157-1 ~ D-157-6 共 6 条全部"待 SEQ-20260527-ENUMS-SSOT-IMPL 实施期闭环"（advisory，不阻塞 CI）
     - **共享层沉淀评估**：本卡只起 ADR，不实施；实施分卡 CHG-339-A/B/C + CHG-340-A/B/C + CHG-341 + CHG-342 + CHG-343 + CHG-344 共 10 卡列入下一序列
     - typecheck / lint 无需跑（纯文档改动）/ verify:adr-contracts 通过（advisory D-N 偏离已登记）
     - PATCH 项数 1（≪ 5 ✅）
   - 依赖：CHG-337 ✅ 完成（不需要等执行卡跟进，只需 ADR 编号确认）

### SEQ-20260526-ENUMS-SSOT-01 序列状态

- **序列状态**：✅ 已完成（CHG-337 + CHG-338 全闭环 / 2026-05-26 21:55）
- **最后更新时间**：2026-05-26 21:55
- **下一序列**：`SEQ-20260527-ENUMS-SSOT-IMPL`（10 张实施分卡 / 主循环可按优先级择 1 启动）

### ENUMS-SSOT 关键约束

- **本 SEQ 只做"server-next 内部收口 + ADR 决策"，不做跨包 SSOT 实装**：跨包真 SSOT（packages/types 数组 + admin-ui helpers + grep 守卫）由 ADR-157 落盘后另起执行卡列入下一序列
- **VideoGenre / SearchPage / FallbackCover 等 P1/P2 缺陷不在本 SEQ**：依 ADR-157 §5 实施分卡列入后续序列；本 SEQ 仅闭合用户反馈的 P0 + 决策起草
- **PATCH ≤ 5 项硬约束**：CHG-337 3 项 ✅ / CHG-338 1 项 ✅
- **commit trailer**：CHG-337 主循环 opus 但无 Opus 强制项（仅常量收口）→ `Subagents: 无`；CHG-338 ADR 起草 → `Subagents: arch-reviewer (claude-opus-4-7)`


---

## [SEQ-20260527-ENUMS-SSOT-IMPL] 视频枚举值跨层 SSOT 实施（ADR-157 落地）

- **状态**：✅ 已完成（全 10 卡闭合 / 2026-05-26 22:35）
- **创建时间**：2026-05-26 22:00
- **最后更新时间**：2026-05-26 22:35
- **SEQ 闭合总结**：D-157-1 ~ D-157-6 共 6 条 D-N 偏离全部闭环；ADR-157 完整落地；12 enum 双形态 + 12 admin-ui helpers + API zod 联动 + 守卫脚本 + ADR-048 AMENDMENT 全套就位
- **目标**：按 ADR-157 §5 实施分卡，将 12 个权威 enum 全部落地双形态 + admin-ui Option helpers + 守卫脚本；闭环 D-157-1 ~ D-157-6 共 6 条 D-N 偏离
- **范围**：packages/types + packages/admin-ui + apps/api zod + apps/server-next 4 处独立常量 + apps/web-next P1/P2 + apps/server v1 Genre + scripts 守卫
- **依赖**：CHG-337 ✅ + ADR-157 PASS ✅
- **总估时**：0.7-1.0w

### 任务列表（按 DAG 顺序）

1. **CHG-339-A** — packages/types 4 P0 enum 双形态 + assertExhaustive 工具（状态：✅ 已完成）
   - 创建时间：2026-05-26 22:00
   - 实际开始：2026-05-26 22:05
   - 完成时间：2026-05-26 22:25
   - 建议模型：opus（packages/types 跨包契约改造 / API zod 联动 / 影响面大）
   - 执行模型：claude-opus-4-7 / 子代理：无
   - 文件范围（7 文件 / 5 PATCH 项）：
     - `packages/types/src/video.types.ts`（VideoType / VideoGenre / VideoStatus / ReviewStatus 4 enum 双形态）
     - `packages/types/src/utils/exhaustive.ts`（新建工具子目录 / assertExhaustive）
     - `packages/types/src/index.ts`（const value re-export + utils re-export）
     - `apps/api/src/routes/admin/videos.ts`（4 处 zod 替换：type ×2 + status ×1 + reviewStatus ×1）
     - `apps/api/src/routes/admin/staging.ts`（2 处 zod 替换：type ×2）
     - `apps/api/src/routes/admin/moderation.ts`（1 处 zod 替换：type ×1 / 不动 result 子集）
     - `apps/api/src/routes/search.ts`（2 处 zod 替换：VideoTypeEnum const + 内联 StatusEnum）
   - 完成备注：
     - typecheck ✅ / lint ✅ / 单测 5139/5139 ✅ / verify:adr-contracts ✅
     - 红线 R-157-1 ✅：API 层视频 enum 真实路由 zod 字面量为零（VideoType / VideoStatus / ReviewStatus grep 输出空）
     - 例外（非本卡范围 / 备注）：`apps/api/src/templates/route.template.ts:19` 注释中示例（模板文件，不影响运行）+ `apps/api/src/services/UserSubmissionService.ts:48` `['movie','series','show']`（user submission 业务自定义 enum，含非 VideoType 值 `show`，不属 VideoType 联动）
     - 偶发 flaky：StagingEditPanel.test.tsx 1 用例首跑 fail，单跑 + 重跑全套 PASS → test pollution（与本卡无关）
   - 闭环 D-N：D-157-1 部分（VideoType / VideoGenre / VideoStatus / ReviewStatus 4 P0 双形态 + API zod 联动完成；剩 P1/P2 8 enum 待 339-B/-C）

2. **CHG-339-B** — packages/types 4 P1 enum 双形态（状态：✅ 已完成 / 2026-05-26 22:48 / 执行模型 claude-opus-4-7 / 子代理 无 / VisibilityStatus 2 zod 联动 + ContentFormat/EpisodePattern/TrendingTag 仅双形态无 API zod 引用）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet（范式已建立 / 复制 -A 模板）
   - 文件范围（≤ 5 文件 / 4 PATCH 项）：
     - `packages/types/src/video.types.ts`（VisibilityStatus / ContentFormat / EpisodePattern / TrendingTag 4 enum 双形态）
     - `packages/types/src/index.ts`（const value re-export 增项）
     - apps/api zod 引用（如有，grep 后定位）
   - 依赖：CHG-339-A ✅
   - 验收要点：typecheck + lint + test 全 PASS

3. **CHG-339-C** — packages/types 4 P2 enum 双形态（状态：✅ 已完成 / 2026-05-26 22:55 / 执行模型 claude-opus-4-7 / 子代理 无 / D-157-1 全部 12 enum 闭环 + DoubanStatus 2 + SourceCheckStatus 2 + SourceType 1 zod 联动 / VideoQuality 无 API zod 引用）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet
   - 文件范围（≤ 5 文件 / 4 PATCH 项）：
     - `packages/types/src/video.types.ts`（DoubanStatus / SourceCheckStatus / VideoQuality / SourceType 4 enum 双形态）
     - `packages/types/src/index.ts`
     - apps/api zod 引用（如有）
   - 依赖：CHG-339-B ✅
   - 验收要点：typecheck + lint + test 全 PASS

4. **CHG-340-A** — packages/admin-ui AdminSelectOption 泛型扩展 + 4 P0 helpers（状态：✅ 已完成 / 2026-05-26 23:25 / 执行模型 claude-opus-4-7 / 子代理 arch-reviewer (claude-opus-4-7) agentId: aef79a95ebb5b6fc2 / **A- CONDITIONAL → 黄线 Y-340-A-1 JSDoc 警告已消化 → 等同 A**）
   - 创建时间：2026-05-26 22:00
   - 建议模型：opus（packages/admin-ui 公开 Props 改 + helpers 新增 / CLAUDE.md ❌ 共享组件 API 契约强制 Opus）
   - 文件范围（5 文件 / 5 PATCH 项）：
     - `packages/admin-ui/src/components/admin-select/admin-select.tsx`（AdminSelectOption → AdminSelectOption<T extends string = string> 泛型扩展）
     - `packages/admin-ui/src/enums/videoTypeOptions.ts`（新建）
     - `packages/admin-ui/src/enums/videoGenreOptions.ts`（新建）
     - `packages/admin-ui/src/enums/videoStatusOptions.ts`（新建）
     - `packages/admin-ui/src/enums/reviewStatusOptions.ts`（新建）
     - `packages/admin-ui/src/enums/index.ts`（barrel export，与 5 项不冲突 / 视为 helpers 配套）
     - `packages/admin-ui/src/index.ts`（增 `export * from './enums'`）
   - 依赖：CHG-339-A ✅
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`
   - 验收要点：typecheck + lint + admin-ui 单测 PASS + arch-reviewer Opus 评审 PASS / CONDITIONAL → 主循环消化全红线后 PASS

5. **CHG-340-B** — packages/admin-ui 4 P1 helpers（状态：✅ 已完成 / 2026-05-26 23:40 / 执行模型 claude-opus-4-7 / 子代理 arch-reviewer agentId: ac43a8742ef38e1cd / A- → 黄线 Y1 译法歧义已消化 → 等同 A）
   - 创建时间：2026-05-26 22:00
   - 建议模型：opus（admin-ui 公开 helpers / 范式同 -A）
   - 文件范围（5 文件 / 4 PATCH 项）：4 个 enums/*.ts 新建（VisibilityStatus / ContentFormat / EpisodePattern / TrendingTag）+ enums/index.ts 增项
   - 依赖：CHG-340-A ✅ + CHG-339-B ✅
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`

6. **CHG-340-C** — packages/admin-ui 4 P2 helpers（状态：✅ 已完成 / 2026-05-26 23:50 / 执行模型 claude-opus-4-7 / 子代理 arch-reviewer agentId: a5fff0441351a84c7 / **A PASS 无线 / D-157-2 全闭环 12 helpers**）
   - 创建时间：2026-05-26 22:00
   - 建议模型：opus
   - 文件范围（5 文件 / 4 PATCH 项）：4 个 enums/*.ts 新建（DoubanStatus / SourceCheckStatus / VideoQuality / SourceType）+ enums/index.ts 增项
   - 依赖：CHG-340-B ✅ + CHG-339-C ✅
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`

7. **CHG-341** — server-next 4 处独立常量替换 + SubmissionsListClient news/kids 修复（状态：✅ 已完成 / 2026-05-26 22:12 / 执行模型 claude-opus-4-7 / 子代理 无 / videoEnumOptions.ts 已删 / 5 消费方迁移 admin-ui helpers / SubmissionsListClient 9→11 P1 闭环）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet
   - 文件范围（≤ 5 文件 / 4 PATCH 项）：
     - `apps/server-next/src/app/admin/videos/_client/videoEnumOptions.ts`（重定向到 admin-ui helpers / 可考虑删除）
     - `apps/server-next/src/app/admin/home/_client/HomeModuleDrawer.tsx`（删本地 → import getVideoTypeOptions）
     - `apps/server-next/src/app/admin/submissions/_client/SubmissionsListClient.tsx`（删本地 → import getVideoTypeOptions / **同时修复 news/kids 缺项 P1**）
     - server-next 其他 enum 消费（按需）
   - 依赖：CHG-340-A ✅
   - 验收要点：server-next 单测全 PASS + 视频编辑 / 列表 / 投稿 / home 4 处 type 下拉一致显示 11 项

8. **CHG-342** — web-next P1/P2 修复 + ADR-048 AMENDMENT（状态：✅ 已完成 / 2026-05-26 22:25 / 执行模型 claude-opus-4-7 / 子代理 无 / SearchPage tab 4→12 派生 ALL_CATEGORIES / FallbackCover icon 5→11+assertExhaustive / VideoMeta useTranslations / video-route 评估保留 ADR-048 设计 / ADR-048 AMENDMENT 已落盘）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet
   - 文件范围（≤ 5 文件 / 4 PATCH 项）：
     - `apps/web-next/src/app/[locale]/search/_components/SearchPage.tsx`（SearchTab union 4→11 / 派生自 VIDEO_TYPES）
     - `apps/web-next/src/components/media/FallbackCover.tsx`（getTypeIcon switch 5→11 / 加 assertExhaustive 默认分支）
     - `apps/web-next/src/components/video/VideoMeta.tsx`（label 改为 i18n key 使用 useTranslations / 删硬编码 VIDEO_TYPE_LABEL Record）
     - `apps/web-next/src/lib/video-route.ts`（PRIMARY_DETAIL_TYPES 评估 / ADR-048 关联）
     - `apps/web-next/messages/zh-CN.json` + `en.json` videoType namespace 检查（如有缺项补齐）
   - 依赖：CHG-340-A ✅
   - 同 commit 落 **ADR-048 AMENDMENT 块**（ADR-157 §6 验收第 8 条）
   - 验收要点：web-next 单测 + e2e（SEARCH project）全 PASS

9. **CHG-343** — apps/server v1 AdminVideoForm VideoGenre 15→20（状态：✅ 已完成 / 2026-05-26 22:18 / 执行模型 claude-opus-4-7 / 子代理 无 / v1 维护期 bug 修复豁免 / 派生自 VIDEO_GENRES SSOT / 5 项缺漏闭环）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet
   - 文件范围（1 文件 / 1 PATCH 项）：
     - `apps/server/src/components/admin/AdminVideoForm.tsx`（GENRE_OPTIONS 补 adventure / disaster / musical / western / sport 5 项）
   - 依赖：CHG-339-A ✅
   - 同 commit 备注 "v1 维护期 bug 修复豁免重写期约束 ADR-035"
   - 验收要点：apps/server typecheck + 该组件单测（如有）PASS

10. **CHG-344** — scripts/verify-enum-ssot.mjs 守卫脚本 + 集成（状态：✅ 已完成 / 2026-05-26 22:35 / 执行模型 claude-opus-4-7 / 子代理 无 / D-157-4 + 全 SEQ 闭合 / 首跑检出 80 处违规，advisory 不阻塞，baseline 截止 2026-07-26 + 每月评审）
    - 创建时间：2026-05-26 22:00
    - 建议模型：sonnet
    - 文件范围（5 文件 / 4 PATCH 项）：
      - `scripts/verify-enum-ssot.mjs`（新建守卫脚本）
      - `scripts/enum-ssot-baseline.json`（新建 baseline 例外清单 / 实施期允许 0 例外）
      - `scripts/preflight.sh`（加 step）
      - `package.json`（增 `npm run verify:enum-ssot`）
      - `scripts/verify-adr-contracts.sh` 或对应入口（串联调用）
    - 依赖：CHG-341 ✅ + CHG-342 ✅ + CHG-343 ✅（所有消费方迁移完后启动 / 守卫预期全 PASS）
    - 验收要点：`npm run verify:enum-ssot` 输出 0 违规 + preflight + verify:adr-contracts 集成

### ENUMS-SSOT-IMPL 关键约束

- **DAG 串行依赖**：CHG-339-A → 339-B → 339-C / 339-A → 340-A → 341+342 / 343 独立 / 344 收尾
- **PATCH ≤ 5 项硬约束**：每张子卡严格 ≤ 5 项（已按 ADR-157 §3 D-157-5 口径精算）
- **强制 Opus 评审**：CHG-340-A/B/C 共 3 卡触发 packages/admin-ui 公开 API 改动，commit trailer 必含 `Subagents: arch-reviewer (claude-opus-...)`
- **D-N 偏离闭环责任**：每张 CHG 完成时同步 changelog 标注闭环的 D-157-X（339-A 闭 D-157-1 部分 / 340-A 闭 D-157-2 部分 / 342 同 commit 闭 D-157-3 + ADR-048 AMENDMENT / 344 闭 D-157-4 / 全 SEQ 闭合时闭 D-157-5 + D-157-6）
- **零回归**：每卡完成后 4018+ unit + typecheck + lint + verify:adr-contracts 全 PASS
- **baseline 截止**：CHG-344 完成 + 2 月内 enum-ssot-baseline.json 必须清零（含月度评审 / 逾期升 P1）

---

## [SEQ-20260527-MOD-WAVE1] server-next 内容审核台 Wave 1 — 消债 + 关键 bug 修复 + 搜索/探播实装 + route-labeling 接入

- **状态**：✅ **全部完成（9/9）**（Wave 1 收官 / 待用户验收 → 进 Wave 2 / 2026-05-27）
- **创建时间**：2026-05-27 13:00
- **最后更新时间**：2026-05-27（CHG-351 三子卡 -A/-B/-C 全闭合 / 全自动模式）
- **目标**：基于 `/Users/livefree/.claude/plans/fluffy-giggling-teapot.md` 完成审核台 P0/P1 消债 + 用户视角增强 + route-labeling Phase 1 落地
- **范围**：`apps/server-next/src/app/admin/moderation/**` + `apps/api/src/routes/admin/moderation.ts` + `apps/api/src/services/SourceService.ts` + `apps/web-next/src/components/player/SourceBar.tsx` + `apps/web-next/src/lib/line-display-name.ts` + `docs/manual/`
- **依赖**：无上游阻塞；审查报告见 fluffy-giggling-teapot.md §1-9 事实底板
- **执行约束**（plan §16.1-16.5 必读）：
  - **§16.1** UI/UX 谨慎:避免不必要布局改动,关键交互"点击次数"不得退化;新 UI 改动前先 ASCII 草图走步
  - **§16.2** 人工体验集中 Wave 末:单卡自动 playwright 截图归档 `docs/manual/screenshots/`,Wave 末输出验收报告
  - **§16.3** `docs/manual/moderation-console.md` + `docs/manual/route-labeling.md` 每卡同步更新,缺失即未闭环
  - **§16.4** 集成 route-labeling-system.md(Phase 1 在本 Wave 落地)
  - **§16.5** 主循环全自动:仅 typecheck/test/verify 失败 / 范围溢出 / 需新 ADR / schema 冲突 / Wave 验收未过才中断
- **建议主循环模型**:`claude-sonnet-4-6`(全部 9 张均 Sonnet 卡;Opus 仅在 ROUTE-LABEL-A1 effective_score 公式如需架构评审时 spawn 子代理)

### 任务列表(按执行顺序)

1. **CHG-345** — server-next 审核台 EpisodeSelector ↔ LinesPanel ↔ AdminPlayer 接通修复（状态：✅ 已完成 / 2026-05-27 01:02 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 4 文件改动 / hook currentEp 默认 1 向后兼容 / 新建 7 单测 + admin-player.test.tsx 8/8 零回归 / moderation 范围 243/243 / docs/manual P-moderation §3.6 已加 / Wave 1 卡 2/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §10.3）：
     - `currentEp` 从 PendingCenter 提升,LinesPanel 接收 `currentEp` prop
     - useSelectedLine 扩 `selectEpisode(epNum)`,按 `episode_number === currentEp` 找匹配 source_url
     - EpisodeSelector 切集 → AdminPlayer 自动切源(验证:多线路视频切集后 video src 变化)
     - 边界:line A 有 1-12 集 / line B 有 1-6 集时,切 ep 10 → line B 自动 fallback 第一活跃集
   - 文件范围(≤ 5 项)：`PendingCenter.tsx` / `LinesPanel.tsx`(server-next) / `use-selected-line.ts` / `EpisodeSelector.tsx` / `packages/admin-ui` LinesPanel 类型(如需扩 prop)
   - 人工体验场景：切集 → 播放器换源 / 跨线路切集 / line 集数不齐边界

2. **CHG-346** — 删除 StagingTabContent + mock-data 死代码（状态：✅ 已完成 / 2026-05-27 00:52 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 3 文件改动 / typecheck + lint + moderation 范围测试 236/236 + 3 verify 全绿 / 完整套件 1 flaky pre-existing 与本卡无关 / Wave 1 卡 1/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §5 P0）：
     - 删 `apps/server-next/src/app/admin/moderation/_client/StagingTabContent.tsx`
     - 删 `apps/server-next/src/app/admin/moderation/_client/mock-data.ts`
     - grep 复核:无业务 import 残留(测试注释里的历史引用可保留)
     - typecheck + lint 全绿
   - 文件范围(≤ 5 项)：2 个删除 + 可能影响的 e2e 注释清理 + dev/visual/_lib/mock-data.ts 注释更新
   - 建议主循环模型：`claude-haiku-4-5-20251001`(纯归档/删除工作)

3. **CHG-347** — ModerationConsole 抽 usePendingQueue hook(SPLIT-A)（状态：✅ 已完成 / 2026-05-27 01:21 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 3 文件改动 / ModerationConsole 829 → 749 行 / 新建 4 单测 / moderation 范围 247/247 PASS / Wave 1 卡 3/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §5 P1 第一步）：
     - 抽出 `usePendingQueue(filters)` hook → `_client/usePendingQueue.ts`
     - 封装:fetch / loadMore / 乐观 approve / 乐观 reject / 失败回滚
     - ModerationConsole 仅消费 hook,不直接持队列 state
     - 无回归:键盘流 J/K/A/R/S + 滚动预取 + 错误 banner
   - 文件范围(≤ 5 项)：新建 usePendingQueue.ts / ModerationConsole.tsx 精简 / 类型导出 / 单测新增
   - 人工体验场景：队列加载 / loadMore 触发 / approve+失败回滚

4. **CHG-348** — 抽 BatchActionsBar 组件(SPLIT-B)（状态：✅ 已完成 / 2026-05-27 01:29 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 3 文件改动 / ModerationConsole 749 → 710 行 / 视觉零变化 / docs/manual P-moderation §3.5 已更新 / Wave 1 卡 4/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §5 P1 第二步）：
     - 抽 fixed-bottom bulk bar 至 `_client/BatchActionsBar.tsx`(目前 50 行行内 JSX)
     - props 仅 selectedIds / onApprove / onRejectOpen / onClear / pending
     - 视觉零变化(rem/spacing 对齐 admin-ui 原语)
     - `docs/manual/moderation-console.md` 新增"批量审核"章节
   - 文件范围(≤ 5 项)：新建 BatchActionsBar.tsx / ModerationConsole.tsx / docs/manual/moderation-console.md
   - 人工体验场景：批量通过 / 批量拒绝 / 清除选择

5. **CHG-349** — 抽 PendingPaneController(SPLIT-C)（状态：✅ 已完成 / 2026-05-27 01:45 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 3 文件改动 / ModerationConsole 710 → 616 行 / 字面范围（三栏编排+键盘流）完整执行 / "≤ 250 行" 子目标未达（剩 616 行多在 page head / preset / toast / 独立模块）→ 立 follow-up CHG-354 SPLIT-D 在 Wave 末 / Wave 1 卡 5/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §5 P1 第三步）：
     - 抽 `_client/PendingPaneController.tsx`:左 + 中 + 右 三栏编排 + 键盘流 + 列表加载
     - ModerationConsole.tsx **最终主体 ≤ 250 行**(CLAUDE.md 500 行红线消解)
     - 无回归:Reject Modal × 2 / VideoEditDrawer / RunInfoBanner / Toast 全可用
   - 文件范围(≤ 5 项)：新建 PendingPaneController.tsx / ModerationConsole.tsx 精简 / 关联类型导出 / e2e 回归
   - 人工体验场景：完整 pending tab 回归 / 全键盘流 / 批量+预设组合

6. **CHG-350** — 左栏 search + filterChips(plan §10.1 方案 A)（状态：✅ 已完成 / 2026-05-27 01:54 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 7 文件改动 / 后端 ?q= ILIKE + SQL escape / 前端 toolbar + 300ms debounce + URL 双向同步 / moderationQueueRoutes 新增 2 q-参数测试 / moderation 范围 249/249 PASS / docs/manual §3.7 已加 / Wave 1 卡 6/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点：
     - `_client/PendingQueueToolbar.tsx` 新建:search input(debounce 300ms) + filterChips(type / sourceCheckStatus / doubanStatus 等已有维度)
     - 后端 `GET /admin/moderation/pending-queue?q=<title>` 新增 `q` 参数(ILIKE / trigram),若属于新端点需先起 ADR-NNN
     - URL `?q=` 同步到现有 FILTER_KEYS 模式
     - SWR-style 无闪烁刷新:fetch 期间保留旧数据,新数据 ready 后再替换(或 React 18 useTransition)
     - `docs/manual/moderation-console.md` 新增"搜索"章节
   - 文件范围(≤ 5 项)：新建 PendingQueueToolbar.tsx / `api.ts` 加 q / 后端 moderation.ts route / usePendingQueue.ts 接 q / docs/manual
   - **关键风险**：`q=` 是新端点参数,需核 ADR — 若 verify:endpoint-adr 报错需先起 ADR
   - 人工体验场景：输入 title 即时筛 / 清除筛选 / 与现有 filterChips 组合

7. **CHG-351** — LinesPanel 单行探/播按钮(plan §10.5)（状态：📦 已拆 -A/-B/-C / 2026-05-27 02:45 / 用户选方案 A / 复合任务 ≥ 8 文件不再独立执行）
   - 创建时间：2026-05-27 13:00
   - 拆分依据：plan §16.5 BLOCKER 触发 (新 ADR + admin-ui 公开 Props + PATCH > 5 项硬约束)
   - 三张子卡详见下方 CHG-351-A / -B / -C

7-A. **CHG-351-A** — ADR-158 起草 + 后端单源 probe + render-check 端点（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / arch-reviewer Opus A-CONDITIONAL 1 轮 → 主循环消化 3 红线+3 黄线+4 关键洞察等同 A / 9 文件改动 / R-MID-1 第 27 次系统化 / typecheck+lint+verify全 PASS / video-source-inline-action-audit 5/5 + audit-log-coverage 111/111 + set-equal 4/4 / 全量 5158/5159 unit PASS（1 flaky StagingTable pre-existing 单跑 PASS）/ verify-endpoint-adr 192 路由 70 ADR 端点对齐 / verify-adr-d-numbers 222 D-N 全闭环含 D-158-1..9 / Wave 1 卡 7-A/9 闭合）
   - 创建时间：2026-05-27 02:45
   - 实际开始：2026-05-27（API Overloaded 中断恢复 + /clear + docs 同步 + arch-reviewer 评审后启动实施）
   - 建议主循环模型：`claude-opus-4-7`（主循环不切换 / 用户指定 / ADR 起草级工作）
   - 子代理：✅ 已 spawn `arch-reviewer` (claude-opus-4-7) 1 轮独立评审 → **A-CONDITIONAL**（3 红线 + 3 黄线 + 4 关键洞察）
   - **评审结论修订**（主循环采纳）：
     - **R1**：actionType `sources.single_action` → **`video_source.inline_action`**（与既有 `video_source.toggle` / `.disable_dead_batch` 单源域前缀对齐 + targetKind `'video_source'` 命名空间自洽）
     - **R2**：zod schema `id: z.string().min(1)` → **`id: z.string().uuid()`**（与既有 video-groups/:videoId/matrix 一致 / 422 前置 vs 500 fallthrough）
     - **R3**：文件范围 5 项 → **10 项**（援引 ADR-121 D-121-3 RETRO 7 文件豁免 + 额外 3 文件：ADR 新文件 / decisions.md 索引 / SourcesMatrixService.ts；不拆 -A1/-A2）
     - **Y1**：`/probe` 守 freeze ✅ / `/render-check` **不**守 freeze ❌（diagnostic 可用性优先 / freeze 期间常需 player 渲染复核）
     - **Y2**：error path 不写 audit 显式声明 + 测试 6 case（probe happy + probe 404 + probe 409 + render happy + render 404；render 不守 freeze 故 5 case）
     - **Y3**：占位 jobId 前缀冲突修订 → **`probe-vs-${sourceId}-${Date.now()}`** + **`render-vs-${sourceId}-${Date.now()}`**（`vs` = video_source 命名空间，与 row 7-9 `probe-${siteKey}-` 彻底分离）
     - **I1**：`video_source.inline_action` 与 `video_source.toggle` 边界 — 前者仅覆盖纯诊断（不写状态），后者负责状态写
     - **I2**：4 真源（types / service / set-equal × 2）必须**原子提交**（同一 commit）/ ADR-121 D-121-3
     - **I3/I4**：基线 audit-log-service-enums-set-equal 4/4 + coverage 109/109 全 PASS（arch-reviewer 误判 / 实际已对齐）
   - **ADR-158 起草**：`docs/decisions/ADR-158-single-source-probe-render-endpoints.md` 新建（按 ADR-157 / ADR-117 AMENDMENT 2 范式）
     - 决策：暴露单源粒度 probe + render-check 端点，与 line-level reprobeRoute 互补
     - 端点契约：`POST /admin/sources/:id/probe` + `POST /admin/sources/:id/render-check`
     - 入参 zod：path param `id: z.string().uuid()`（R2）
     - 返回：`{ probeJobId | renderJobId, queued: true, sourceId }`（异步队列模式）
     - 权限：admin only（与 reprobeRoute 一致）
     - audit：`actionType: 'video_source.inline_action'`（R1）+ `targetKind: 'video_source'`（既有）
   - 后端实施：
     - `apps/api/src/routes/admin/sources-matrix.ts` 加 2 端点 + zod
     - `apps/api/src/services/SourcesMatrixService.ts` 加 `probeOne(sourceId, actorId)` + `renderCheckOne(sourceId, actorId)`（probe 守 freeze / render-check 不守 / Y1）
   - audit RETRO 4 真源 + 1 新测试（ADR-121 D-121-2 第 13 次 系统化第 N+1 次）
   - decisions.md 索引追加 ADR-158
   - **文件范围（9 项 / ADR-121 D-121-3 RETRO 7 文件豁免 + 2 额外文件援引 / 项目 ADR 范式确认：所有 ADR 写在 decisions.md 单文件追加章节，无独立 `decisions/` 目录）**：
     - **(RETRO 7 文件 / 原子提交 / 4 真源同步 D-121-2)**：
       1. `packages/types/src/admin-moderation.types.ts`（+1 actionType `video_source.inline_action`）
       2. `apps/api/src/services/AuditLogService.ts`（ACTION_TYPES +1）
       3. `tests/unit/api/audit-log-service-enums-set-equal.test.ts`（EXPECTED_ACTION_TYPES +1）
       4. `tests/unit/api/audit-log-coverage.test.ts`（REQUIRED_ACTION_TYPES + PAYLOAD_ASSERTION_REQUIRED +1）
       5. `apps/api/src/routes/admin/sources-matrix.ts`（2 端点 + handler）
       6. `tests/unit/api/video-source-inline-action-audit.test.ts`（新建 / 5 case payload 断言）
       7. `docs/changelog.md`（完成时追加 / R-MID-1 第 N+1 次系统化）
     - **(额外 2 文件 / 不可压缩)**：
       8. `docs/decisions.md`（追加 `## ADR-158` 章节 + 索引引用 / verify-endpoint-adr 扫此文件）
       9. `apps/api/src/services/SourcesMatrixService.ts`（probeOne + renderCheckOne 方法 / route 实现位置 / RETRO 框架文件 5 物理实现层）
   - **commit trailer 推荐**（虽 task 原始定义不强制，但 ADR 起草级建议）：`Subagents: arch-reviewer (claude-opus-4-7)`
   - 验证：typecheck / lint / verify:adr-contracts / verify:endpoint-adr / 单测全 PASS
   - 人工体验场景：无（纯后端 + ADR）

7-B. **CHG-351-B** — packages/admin-ui LinesPanel Props 扩展（onProbeEpisode + onRenderCheckEpisode）（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / arch-reviewer Opus A-CONDITIONAL 1 轮 → 主循环消化 3 红线 + 2 黄线 + 4 关键洞察 等同 A / 3 文件改动原子提交（types + tsx + test） / 11 case PASS / commit trailer 含 Subagents: arch-reviewer (claude-opus-4-7) / Wave 1 卡 7-B/9 闭合）
   - 创建时间：2026-05-27 02:45
   - 建议主循环模型：`claude-opus-4-7`（CLAUDE.md "共享组件 API 契约强制 Opus" / 主循环不切换）
   - 子代理：**强制** spawn `arch-reviewer` (claude-opus-4-7) 评审 Props 契约 / commit trailer 必含 `Subagents: arch-reviewer (claude-opus-4-7)`
   - 依赖：CHG-351-A 完成（后端端点已存在）
   - 验收要点：
     - `LinesPanelProps` 扩 `onProbeEpisode?: (args: { episodeId: string }) => void | Promise<void>`
     - `LinesPanelProps` 扩 `onRenderCheckEpisode?: (args: { episodeId: string }) => void | Promise<void>`
     - 单 episode 行 inline 渲染 `🔍 探` + `▶ 播` xs 按钮（仅当对应 callback 提供时显示）
     - `pending` set 透传（probing/rendering 中按钮 disabled）
     - 单测/snapshot 验证按钮渲染条件 + onClick 触发
   - 文件范围(≤ 3 项)：
     - `packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts`（Props 扩 2 callback）
     - `packages/admin-ui/src/components/composite/lines-panel/lines-panel.tsx`（per-episode inline buttons 渲染）
     - `packages/admin-ui/tests/lines-panel.test.tsx` 或现有测试（snapshot + 行为）
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`（CLAUDE.md 红线）
   - 验证：typecheck / lint / packages/admin-ui 单测 PASS

7-C. **CHG-351-C** — server-next 消费方 + 单源 probe/render API 客户端 + 测试 + docs（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 4 文件改动 / typecheck+lint+moderation 24/239 PASS / CHG-351 三子卡 -A/-B/-C 完整闭环 / Wave 1 卡 7-C/9 闭合）
   - 创建时间：2026-05-27 02:45
   - 建议主循环模型：`claude-opus-4-7`（主循环不切换 / 用户指定）
   - 子代理：无（消费方实施 / 复用已评审契约）
   - 依赖：CHG-351-A + CHG-351-B 完成
   - 验收要点：
     - `apps/server-next/src/lib/moderation/api.ts` 加 `probeOneSource(sourceId)` + `renderCheckOneSource(sourceId)`
     - `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx` 接 onProbeEpisode + onRenderCheckEpisode props → 调 API
     - probing/rendering 状态用 togglingIds 同模式管理（per-source pending Set）
     - 错误用 actionError 显示（与 toggle 相同）
     - `docs/manual/20-pages/P-moderation.md` 新增 §3.8 "线路检测（单源探/播）"章节
   - 文件范围(≤ 5 项)：
     - `apps/server-next/src/lib/moderation/api.ts`（2 API 函数）
     - `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（消费 props + state）
     - `docs/manual/20-pages/P-moderation.md`（新章节）
     - 单测（如有）
   - 验证：typecheck / lint / moderation 范围测试全 PASS
   - 人工体验场景：单 episode 探/播触发 / 排队状态 / 错误展示 / 跨多 line 同时触发

8. **CHG-352** — route-labeling Phase 1 后端:`effective_score` 排序(plan §17)（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / arch-reviewer Opus A-CONDITIONAL → 主循环消化 3 红线 + 4 黄线 + 4 关键洞察等同 A / 6 文件改动（含 docs）/ source-effective-score 28 case PASS + sources 9 case PASS / typecheck + lint + verify:adr-contracts 全绿 / Wave 1 卡 8/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（route-labeling-system.md Phase 1 + Layer A）：
     - `SourceService.listSources()` 加 `effectiveScore` 计算:0.5×health + 0.3×quality + 0.15×latency + 0.05×priority
     - 返回已排序列表(由后端定序)
     - health_score:probe×0.4 + render×0.6,quality_score:4K/2K/.../NULL 档位,latency_score:≤200ms/.../>2000ms 档位
     - priority_bonus:`source_line_aliases.priority`(若 Migration 064 未落地,默认 0)
     - 单测:边界 case(全 NULL / probe ok+render dead / 0 latency)
     - `docs/manual/route-labeling.md` 新建,记录公式 + 权重
   - 文件范围(≤ 5 项)：SourceService.ts / sources-matrix.types.ts(扩 effectiveScore 字段) / 单测 / docs/manual/route-labeling.md / sources.ts route 透出字段
   - **关键风险**：算分函数算"架构决策"等级 → 建议 spawn arch-reviewer Opus 子代理评审公式合理性
   - 人工体验场景：多线路视频排序前后对比 / 单线路 / 全 dead 边界

9. **CHG-353** — route-labeling Phase 1 前台:主题渲染(plan §17)（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / 4 文件改动 / 22 case PASS / typecheck+lint 全绿 / Wave 1 卡 9/9 闭合 → **Wave 1 全部完成 ✅**）
   - 创建时间：2026-05-27 13:00
   - 验收要点（route-labeling-system.md Phase 1 + Layer C）：
     - `apps/web-next/src/lib/line-display-name.ts` 加 `RouteTheme` 类型 + 内置常量(节气 24 / NATO 26 / 数字 10 / Planets 8 / Colors 8)+ `applyThemeLabels(routes, theme)` 函数
     - `apps/web-next/src/components/player/SourceBar.tsx` 消费 applyThemeLabels → 渲染 `themeLabel · quality`
     - 极端情况:0 条不渲染 / 1 条不显标签 / 全 dead 置灰 + deadLabel / 超主题长度 `线路{n}` fallback
     - 默认主题:zh-CN → 节气,en → NATO Phonetic(根据 i18n locale)
     - `docs/manual/route-labeling.md` 加"主题"章节
   - 文件范围(≤ 5 项)：line-display-name.ts / SourceBar.tsx / 单测 / docs/manual / 必要时 i18n key
   - 人工体验场景：节气主题 / NATO 主题切换 / deadLabel / fallback / 0 / 1 条边界

### Wave 1 验收(全部完成后)

- 主循环输出 Wave 1 验收报告:
  - 全部截图聚合(`docs/manual/screenshots/wave-1/`)
  - typecheck + lint + test + verify:adr-contracts + verify:endpoint-adr 全绿日志
  - 9 张卡 changelog 条目链接
  - "建议用户亲手验收的路径"(EPSEL 切集 / 搜索过滤 / 探播触发 / 排序前后对比)
- 用户/reviewer 验收通过 → 进 Wave 2(参见 plan §14 Wave 2)

### Wave 1 BLOCKER 触发清单(plan §16.5)

- typecheck / lint / test / verify 报错 + 自动修复失败
- 任务范围溢出(改动 > 卡片定义文件范围)
- 发现需要新建 ADR 而无现成依据(尤其 CHG-350 ?q= 端点 / CHG-351 :id/probe + render-check 端点)
- schema migration 冲突(本 Wave 不应触发,但若 ROUTE-LABEL-A1 需读 source_line_aliases 而 Migration 064 未落地需注意)
- 人工已审核 Wave 报告未通过

### 关键依赖图

```
CHG-345 (EPSEL-FIX, 独立)
CHG-346 (CLEANUP, 独立)
CHG-347 (SPLIT-A) → CHG-348 (SPLIT-B) → CHG-349 (SPLIT-C)
CHG-350 (LIST-SEARCH) → 依赖 CHG-347 (usePendingQueue 已抽)
CHG-351 (PROBE-RENDER, 独立, 但 effective_score 排序的数据底座)
CHG-352 (ROUTE-LABEL-A1) → 依赖 CHG-351 数据真实化(可并行启动,合入 main 时确认数据)
CHG-353 (ROUTE-LABEL-A2) → 依赖 CHG-352 后端返回排序数据
```

执行序列建议(主循环按此顺序取卡)：
**CHG-346 → 345 → 347 → 348 → 349 → 350 → 351 → 352 → 353**

---

## [SEQ-20260527-MOD-WAVE2] server-next 内容审核台 Wave 2 — 预览/拆分/合并/元数据/路线主题（plan §14 + §17.2）

- **状态**：🔄 执行中（CHG-361 ✅ + CHG-363 ✅ + CHG-364 ✅ + CHG-365-A1 PinyinDetector ✅ + CHG-365-A2 meta_quality ✅ / 14/17 / ADR-160 AMENDMENT 1/2 / CHG-362-A+B SKIPPED ADR-105 / CHG-365-A+B SKIPPED MetadataEnrichService 80% / 下一个 CHG-366 META-COUNTRY-DISPLAY）
- **创建时间**：2026-05-27
- **最后更新时间**：2026-05-27
- **目标**：基于 `/Users/livefree/.claude/plans/fluffy-giggling-teapot.md` §14 Wave 2 + §17.2 落地 9 张主卡（4 张需 ADR + Opus 决策）；继续 Wave 1 的自动推进节奏。
- **范围**：web-next 前台预览模式 + audio/视频拆分/合并端点 + 元数据治理（豆瓣/国家/集数） + route-labeling Phase 2/3
- **执行约束**：沿用 Wave 1 §16.1-16.5（UI/UX 谨慎 / 人工体验集中 Wave 末 / docs/manual 同步 / route-labeling 集成 / 主循环全自动 + BLOCKER 触发清单）
- **建议主循环模型**：`claude-opus-4-7`（ADR 卡）+ `claude-sonnet-4-6`（无 ADR 卡）；主循环不切换 §16.5
- **依赖**：Wave 1 全部完成 ✅（待用户验收 / 用户 2026-05-27 启动指令视为验收）

### 任务列表（按 plan §14.2 顺序，前 6 张为 Wave 2 主线）

> 命名沿用 `CHG-NNN` 数字编号（与 Wave 1 一致），plan §14 的 `CHG-SN-9-*` 命名作为子标题。下一个 CHG 编号从 **CHG-361** 起（CHG-359 未使用，沿用 357 → 358 → 358-FIX → 360-A/B/C 历史顺序）。

| # | TASK-ID | 标题（plan 对应） | ADR | 建议模型 |
|---|---|---|---|---|
| 1 | ✅ **CHG-361-A** 已完成（2026-05-27）| PREVIEW-ADMIN ADR-160 起草 + Opus 评审 / arch-reviewer Opus A− CONDITIONAL → 主循环消化 3 红线 + 5 黄线 + 3 advisory + 4 关键洞察 → 等同 A / 4 文件原子提交（ADR-160 §1-11 + getVideoDetailHref 沉淀 packages/types） | 是 ADR-160 ✅ Accepted | opus-4-7 + arch-reviewer Opus |
| 2 | ✅ **CHG-361-B2** 已完成（2026-05-27）| PREVIEW-ADMIN apps/api 后端实施（3 文件 / ADR-160 AMENDMENT 1）+ 5 case 单测 | 否（contract 扩展非新端点）| opus-4-7 续会话 |
| 2.5 | ✅ **CHG-361-B1** 已完成（2026-05-27）| PREVIEW-ADMIN web-next 前端实施（middleware + admin-access-token + video-detail / 3 文件 + 2 测试 / 17 case PASS）| 否 | opus-4-7 续会话 |
| 2.8 | ✅ **CHG-361-D** 已完成（2026-05-27）| PlayerShell previewMode Props（屏蔽 feedback hook 挂点 / 1 业务 + 1 测试 3 case PASS）| 否 | opus-4-7 续会话 |
| 3 | ✅ **CHG-361-C** 已完成（2026-05-27）| PREVIEW-ADMIN server-next 按钮 + VideoQueueRow contract 扩 + e2e + manual / 3 业务 + 1 e2e + 1 manual | 否 | opus-4-7 续会话 |
| 3.1 | ✅ **CHG-361-E1** 已完成（2026-05-27）| ADR-160 AMENDMENT 2 sources 端点 preview query + SourceService 派发 / 2 业务 + 1 测试 5 case PASS | 否（contract 扩展非新端点）| opus-4-7 续会话 |
| 3.2 | ✅ **CHG-361-E2** 已完成（2026-05-27）| ADR-160 AMENDMENT 2 detail-page-factory + VideoDetailClient server-side hydration / 3 业务 + 1 测试 5 case PASS | 否 | opus-4-7 续会话 |
| 3.3 | ✅ **CHG-361-E3** 已完成（2026-05-27）| ADR-160 AMENDMENT 2 watch page + PlayerShell server-side hydration / 2 业务 + 1 测试 4 case PASS | 否 | opus-4-7 续会话 |
| 4 | ⛔ **CHG-362-A** SKIPPED（2026-05-27）| SPLIT-ADR ADR-161 起草 / **被 ADR-105 覆盖**（2026-05-12 Accepted / 端点 #4 `POST /admin/videos/:id/split` + SplitSchema + audit + 错误码完整设计）/ plan §10.2 撰写时漏查 / 无需独立 ADR-161 | — | — |
| 5 | ⛔ **CHG-362-B** SKIPPED（2026-05-27）| SPLIT 后端实施 / **已落地**（apps/api/src/routes/admin/video-merges.ts:95 `POST /admin/videos/:id/split` + svc.split + 422/404/409 错误码 + audit 写入）/ 本卡定义重复 | — | — |
| 6 | ✅ **CHG-363-A** 已完成（2026-05-27）| SPLIT-UI -A PendingCenter "✂ 拆分" 按钮入口 / 跳 `/admin/merge?split=:videoId` / 1 业务 + 1 i18n + 1 测试 3 case PASS | 否 | opus-4-7 续会话 |
| 6.5 | ✅ **CHG-363-B** 已完成（2026-05-27）| SPLIT-UI -B MergeClient `?split=:videoId` 深链 + MergeSplitSection initialVideoId Props 自动加载 / Codex stop-time review 触发提前实施 / 2 业务 + 1 测试 4 case PASS | 否 | opus-4-7 续会话 |
| 7 | ✅ **CHG-364-A** 已完成（2026-05-27）| MERGE-INLINE -A BatchActionsBar "↔ 合并" 按钮（selectedCount ≥ 2）+ 跳 `/admin/merge?ids=<csv>` / 2 业务 + 1 测试 4 case PASS | 否 | opus-4-7 续会话 |
| 7.5 | ✅ **CHG-364-B** 已完成（2026-05-27）| MERGE-INLINE -B MergeClient `?ids=<csv>` 深链 + BatchMergeWorkspace（选 target + mergeVideos）/ 2 业务 + 1 测试 4 case PASS | 否（扩 URL contract）| opus-4-7 续会话 |
| 8 | ⛔ **CHG-365-A** SKIPPED（2026-05-27 / BLOCKER #2）| META-DOUBAN-AUTO ADR-162 起草 / **MetadataEnrichService 已实施 80% 需求**（CHG-385 Phase 3 已落地 / Step1 本地豆瓣多字段召回 + 置信度 0.85/0.60 / Step2 网络搜索 / Step3 anime 走 bangumi / Step4 源 HEAD / Step5 meta_score / CrawlerService:300 入库后 5 分钟自动入队列）/ plan §10.4.1 撰写时漏查 / 真实缺口仅 2 项 → 拆 -A1/-A2 实施卡 | — | — |
| 8.1 | ✅ **CHG-365-A1** 已完成（2026-05-27）| PinyinDetector helper 独立实施（贪心 longest-match 拼音音节分解 / 约 410 个音节常量 / 严防数字 + 非 ASCII + 最小词长）/ 1 业务 + 1 测试 18 case PASS / MetadataEnrichService 集成延后到 -A2 一并做（依赖 meta_quality schema） | 否 | opus-4-7 续会话 |
| 8.2 | ✅ **CHG-365-A2** 已完成（2026-05-27）| Migration 077 + VideoMetaQuality types + queries 扩 + MetadataEnrichService 写入持久化（豆瓣 confidence/method/status + 拼音 isPinyin + enriched_at）+ architecture.md §5.1 同步 / 23/23 case PASS（+3）/ 6 业务 + 1 测试 + 1 docs | 否（schema 扩展非 ADR-needed / 复用 Migration 032 模式） | opus-4-7 续会话 |
| 9 | ⛔ **CHG-365-B** SKIPPED（2026-05-27 / 同步 A SKIPPED）| 采集 worker 自动豆瓣 / **已就绪**（CrawlerService:300 入库后自动 enrichmentQueue.add 触发 MetadataEnrichService.enrich）/ 拼音识别 → CHG-365-A1 / 本卡定义重复 | — | — |
| 10 | **CHG-366** | META-COUNTRY-DISPLAY（plan #13 / §10.4.3）— 国家代码 → 中英文 admin-ui 原语 | 否 | sonnet |
| 11 | **CHG-367-A** | META-EPISODES ADR-163 起草（plan #14 / §10.4.4）— total/current_episodes schema + migration | 是 ADR-163 | opus-4-7 + arch-reviewer Opus |
| 12 | **CHG-367-B** | META-EPISODES 实施 — schema migration + 显示 | 否 | sonnet |
| 13 | **CHG-368-A** | ROUTE-LABEL-B ADR-164 起草（plan §17.2 #15）— Migration 064 codename/priority/retired_at | 是 ADR-164 | opus-4-7 + arch-reviewer Opus |
| 14 | **CHG-368-B** | ROUTE-LABEL-B 实施 — admin UI `/admin/source-line-aliases` + 退役端点 | 否 | sonnet |
| 15 | **CHG-369** | ROUTE-LABEL-C（plan §17.2 #16）— 播放器设置面板主题选择器 + localStorage | 否 | sonnet |

### Wave 2 BLOCKER 触发清单（沿用 Wave 1 §16.5）

- typecheck / lint / test / verify 报错 + 自动修复失败
- 任务范围超出卡片定义（改动 > 卡片范围 5 项）
- ADR 起草卡 Opus 评审 BLOCKER 红线未消解
- schema migration 冲突（特别注意 ROUTE-LABEL-B Migration 064 与 META-EPISODES 顺序协调 / plan §17.3）
- 人工已审核 Wave 报告未通过

### 关键依赖图

```
CHG-361-A (ADR-160) → 361-B (前台) → 361-C (后台)
CHG-362-A (ADR-161) → 362-B (后端 split) → 363 (SPLIT-UI)
CHG-364 (MERGE-INLINE, 独立)
CHG-365-A (ADR-162) → 365-B (worker 豆瓣)
CHG-366 (国家显示, 独立)
CHG-367-A (ADR-163 / migration) → 367-B (实施)  ─┐
CHG-368-A (ADR-164 / migration 064) → 368-B (退役端点) ─┴── 注意 migration 顺序
CHG-369 (前台主题选择器, 独立)
```

执行序列建议（主循环按此顺序取卡，**ADR 卡先于实施卡**）：
**CHG-361-A → -B → -C → 362-A → -B → 363 → 364 → 365-A → -B → 366 → 367-A → -B → 368-A → -B → 369**
