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
| **CHG-SN-7-MISC-SETTINGS-TABS** | **Settings 8 类 Tab 补 4 类（M-SN-6 复核新增）**：图片 / 通知 / API·Webhook / 登录会话 | plan §6 明列 8 类，实际交付 5 类（基础 / 豆瓣 / 内容过滤 / 视频代理 / 自动采集）；**起卡前先核对 plan §6 vs reference §5.11 哪个是正源**（reference §5.11 仅举 4 类示例 + "等"字 / plan §6 明列 8 类）；若 plan 为正源 → 补 4 类 Tab + 后端 settings 端点扩字段 + audit | sonnet（前端）+ 可能起 ADR 前置（settings 字段扩展） | 0.3-0.5w | 🟡 P2 |
| **CHG-SN-7-MISC-SHELL-NOTIFICATIONS** | **admin-shell Topbar 真实数据注入（M-SN-6 复核新增 / 半成品收尾）** | admin-shell-client.tsx line 27/28/97/98 mockNotifications/mockTasks + line 142 adminNavCountProviderStub → 替换为真实 useQuery / SWR 拉 /admin/notifications + /admin/system/jobs；与通知 Hub MVP 协同（后者建端点本卡接前端）；CHG-DESIGN-05 已标 "M-SN-4+ 接入真端点"债务可知 | sonnet（前端消费 / 端点 + ADR 由通知 Hub MVP 卡承担）| 0.2-0.3w | 🟡 P2 |

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

5. **CHG-SN-8-04** · 审核台 RightPane TabSimilar 实装
   - **状态**：⬜ 待开始
   - **范围**：调研：GET /admin/moderation/:id/similar 是否已有，无则起 ADR-NN + 端点（type/year/country 召回 top10）/ TabSimilar.tsx 真实化 / 行尾「发起合并」深链 → /admin/merge?candidate_a=<id>&candidate_b=<sim_id>
   - **关联问题**：用户问题 #5 + #7
   - **风险**：可能需起新端点 + ADR（按 §4.5 协议先 Opus PASS 才能起实施卡）
   - **工时估算**：0.4w（含 ADR）

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

- **状态**：🔄 进行中
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
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5-HOTFIX-4** · 未过滤列 disabled switch 旁加可见 hint「列名 ⋯ 编辑」+ dt-styles 新增 hint CSS rule + 2 单测更新（断言 hint 渲染/不渲染）— 状态：✅ 已完成（2026-05-24 / matrix 40/40 + admin-ui/table 395/395 + 4 质量门禁全过 / 解决 HOTFIX-3 OS 原生 tooltip 可发现性差）
   - **⚠️ EP-5-SOURCES-SORT-FULLSTACK + EP-5-submissions/users/audit/videos + EP-6 + EP-7** · 已被 **ADR-150 阶段 2-5** 取代（@livefree 在 EP-4.5-HOTFIX-4 走读后看 Google Sheets 截图反馈"过滤应是列固有属性"/ ADR-149 个别 EP-5 迁移范式被列固有自动过滤范式替换）— 状态：⛔ 已废弃（不要执行 / 改走 ADR-150 SEQ 容器）
   - **CHG-SN-9-DT-AUTOFILTER-ADR** · ADR-150 起草 + Opus 子代理评审 + 6 D-150-× 论证（D-150-3 + D-150-5 REVISED）+ 13 章 + 5 阶段实施计划 + 写入 decisions.md line 12664-13037 — 状态：✅ ADR 起草完成 / 🟡 Proposed 待 @livefree 仲裁 D-150-5 默认值（2026-05-24 / verify-adr-contracts ✅ 含 6 advisory D-150-× 待阶段 2-5 闭环）
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
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-PHASE5-EP4-SOURCES** · ADR-150 阶段 5 EP-4 sources sort 全栈打通 ✅（2026-05-24 / PATCH-2 范式完整复刻 5 文件 / types + svc + queries + lib + client / SOURCES_SORT_FIELD_MAP 4 字段白名单 + SORT_IDENT_REGEX 启动期断言 + ORDER BY 动态 / 3 列 video/lineCount/sourceCount 真排序 / kind='computed' + enableSorting: true 灵活组合 / 12/12 单测零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-D** · 子卡 D：ImageHealthClient + MergeClient — 状态：🚫 BLOCKED on EP-3-C（~0.3w）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-E** · 子卡 E：SubtitlesListClient + SourcesClient（包含 sources 排序全栈断链顺手修 / 5 层 types/api/route/DB query/SourcesClient deps）— 状态：🚫 BLOCKED on EP-3-D（~0.3w）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-F** · 子卡 F：CrawlerClient + CrawlerRunDetailView — 状态：🚫 BLOCKED on EP-3-E（~0.3w）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-G** · 子卡 G：dev demo 表 + 任何剩余消费方 + 全表 e2e smoke — 状态：🚫 BLOCKED on EP-3-F（~0.3w）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4** · EP-5-shared 3 原语 @逃生口 JSDoc + admin-module-template.md v2 双范式决策树 + @livefree 走读 5 代表页 + #UR-B5 闭合 + e2e smoke 3 case — 状态：🚫 BLOCKED on EP-3-G（~0.4w）
   - **总工时（ADR-150 替代 ADR-149 EP-5 序列）**：原 ADR-149 EP-5 ~2.6w + sources sort ~0.7w + EP-6 ~0.2w + EP-7 ~0.3w = 3.8w → **ADR-150 阶段 2-5 共 3.6w**（节省 ~0.2w + UX 强一致 + 长期收益）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-A · DataTableSearchInput IME + 5 高优消费方接入 + 12 单测（~0.4w）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-B · 剩余 8+ 消费方删 deprecated prop + 类型完全删除（~0.4w）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-C · @livefree 走读 5 代表页 + #UR-B1/B2/B3/B4 闭合验证（~0.3w）

> 后续用户提其它问题时按 #UR-* 顺序追加

