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

## [SEQ-20260521-06] GAPS 高 ROI 闭合（小卡批量）

67. **CHG-SN-7-MISC-DEV-MIGRATE-CHECK** · npm run dev 前自动 migrate:check 巡检（防 dev DB schema 滞后）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet（package.json 单行 hook）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无
    - **范围**：package.json 加 `predev` npm lifecycle hook 跑 `migrate:check --silent || true`
    - **关联**：f22e7b4b（VISUAL-FOLLOWUP-2 实证 9 migration 落后导致 wish_list 500）
    - **不在范围**：dev.mjs 改 / 强制阻塞 / preflight.sh 替代
    - **工时估算**：~0.05w

66. **CHG-SN-7-MISC-VISUAL-FOLLOWUP-2** · 3 follow-up 收口（migration sync + seed + LinesPanel ADR 评估）— 状态：✅ 已完成（2026-05-23 / commit f22e7b4b）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无
    - **范围**：
      - wish_list 500 修复（npm run migrate 全跑 9 / 064-072）
      - dev DB seed 2 wish_list user_submissions
      - 5 张 user-submissions baseline（2 新 + 3 modified re-capture）
      - LinesPanel auto-select ADR 评估 ❌ NEGATED（ROI 低 / UX 决策守护）
    - **关联**：5993feb0（VISUAL-FOLLOWUP-BATCH）+ dev DB schema sync
    - **不在范围**：业务代码 / spec 修改 / LinesPanel 重构
    - **工时估算**：~0.1w

65. **CHG-SN-7-MISC-VISUAL-FOLLOWUP-BATCH** · 3 follow-up 合卡：admin-ui recapture + moderation player-idle + user-submissions fixup — 状态：✅ 已完成（2026-05-23 / commit 5993feb0）
    - **建议模型**：sonnet（capture + 可能 spec 微调）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无
    - **范围**：5 PNG 上限内（admin-ui 2 + moderation 1 + submissions 2）
    - **关联**：0e4e7098（VISUAL-BACKLOG-COMMIT）+ dev server :3003/:3001 仍跑
    - **不在范围**：业务代码 / schema / 端点 / dev DB seed / wish_list bug 修复
    - **工时估算**：~0.13w

64. **CHG-SN-7-MISC-VISUAL-BACKLOG-COMMIT** · 用户先前 capture 副作用 15 PNG 入库（visual coverage 历史 backlog 收口 / admin-ui 2 张错截已排除）— 状态：✅ 已完成（2026-05-23 / commit 0e4e7098）
    - **建议模型**：sonnet（纯 baseline 入库 / 不动 code / 不动 spec）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无（baseline 已 capture / 仅 review + git add）
    - **范围**：2 类 15 PNG（admin-ui 2 张排除 review 发现为登录页错截 git restore）
      - tests/visual/moderation/ 8 张 untracked（ae4ea66f spec 落地 baseline backlog）
      - tests/visual/admin-moderation/ 7 张 modified
    - **review 拦截**：admin-ui 2 张（line-health-drawer-default / reject-modal-default）capture 时 access token 失效 → middleware redirect /login → 错截登录页；git restore 恢复 pre-existing baseline；独立 follow-up CHG-SN-7-MISC-VISUAL-ADMIN-UI-RECAPTURE
    - **关联**：a000f59f（本卡 baseline 先入库）+ ae4ea66f（moderation spec 落地 / baseline 占位）
    - **不在范围**：spec 文件 / 业务代码 / moderation player-idle 缺张 / admin-ui 2 张 recapture
    - **工时估算**：~0.05w

63. **CHG-SN-7-MISC-VISUAL-BATCH** · CHG-SN-7-MISC-VISUAL-CRAWLER + VISUAL-SUBMISSIONS 合卡：2 visual spec 落地（共 13 张 baseline 占位 / capture 由用户手动触发 / REDO-01-J + REDO-02-F 软门收尾）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet（visual spec 撰写 / 同 moderation.visual.spec.ts 范式）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无（同 ae4ea66f moderation 9 张占位先例 / 不动 admin-ui 公开 API）
    - **范围**：
      - 新建 `tests/visual/crawler/crawler.visual.spec.ts` 7 test cases（kpi-row / timeline-card / site-list / site-row-expanded / advanced-menu / runs-list / page-header）
      - 新建 `tests/visual/user-submissions/user-submissions.visual.spec.ts` 6 test cases（page-header / segment-bad-src / segment-processed / first-card / pagination / empty-state）
      - 同 moderation 范式：`storageState: tests/visual/.auth/admin.json` + `expect.toHaveScreenshot(...)` + 头部注释含运行方式 + dev DB 前置 + capture 由用户手动 `npm run test:visual:update`
      - PLAYWRIGHT_VISUAL=1 env gate 保护（默认不参与 test:e2e）
    - **验收**：
      - ✅ typecheck PASS（spec 文件无语法错误）
      - ✅ `PLAYWRIGHT_VISUAL=1 npx playwright test --project=admin-visual --list` 列出 13 tests（spec parse OK）
      - ⏸ baseline PNG 不入库（dev server 起后 user 手动 capture / PR 内 review）
    - **关联**：REDO-01-J 软门验收扣 0.5（CHG-SN-7-REDO-01-J）+ REDO-02-F 软门验收扣 0.5（CHG-SN-7-REDO-02-F）→ spec 落地后 milestone audit 可正式归零
    - **不在范围**：起 dev server / 实际 capture baseline / 入库 PNG（按 ae4ea66f 范式留用户独立操作）
    - **工时估算**：~0.15w（合卡 / 实际 ~0.15w / 含 testid 收集 + 2 spec 撰写）

62. **CHG-SN-8-CHORE-ADR-146-D-N-CLOSE** · ADR-146 D-N 编号 advisory 清零（6 条）+ crawlerKpi.ts SQL subquery alias 修正（advisory 误报清零）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet（advisory 清零 + SQL alias rename / 无新决策）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无（机械文档补登记 + SQL alias 字面量替换）
    - **范围实际**：
      - `docs/changelog.md` ADR-146 起草条目 `D-N 偏离闭环` 段范围引用 `D-146-1..8` 展开为 8 行枚举（含语义摘要）；D-146-2/4/5/6/7/8 共 6 条新增明确闭环
      - `apps/api/src/db/queries/crawlerKpi.ts` SITE_STATS_SQL subquery alias `vs` → `rc`（3 处字面量替换）
    - **验收结果**：
      - ✅ verify-adr-d-numbers: 全部 150 条 D-N 闭环（144→150）
      - ✅ verify-sql-schema-alignment: queries SQL 引用列全部对齐
      - ✅ verify-endpoint-adr: 186 admin 路由 / 64 ADR 端点对齐保持
      - typecheck + lint PASS
    - **价值**：advisory 红线 2/3 升 ✅ / SEQ-20260521-06 chore 收尾 / milestone audit 准备
    - **工时估算**：~0.05w / 实际 ~0.05w

61. **CHG-SN-8-CHORE-DOCS-DRIFT-SYNC** · ADR-003 描述同步 AMENDMENT + MOD-PLAYER 状态修正（文档漂移收尾）— 状态：✅ 已完成（2026-05-23 / commit 9b58a1c3）
    - **建议模型**：sonnet（文档同步）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无（事实记录 / 引用既有 ADR-148 Opus A PASS + CHG-37）
    - **范围**：
      - `docs/decisions.md` ADR-003 末尾追加 AMENDMENT 2026-05-23 段（access TTL 15m → KV 驱动默认 60m + refresh 7d → 30d 事实同步）
      - `docs/task-queue.md` line 249 + 252-326 MOD-PLAYER 状态从 ⬜ + FIX-D 解锁 → ✅ 全 3 阶段闭合 commit cb29435e/56133915/ae4ea66f
    - **关联**：ADR-148 EP-A changelog 登记的「ADR-003 描述更新（独立小卡 / 不阻塞）」；M-SN-7 跟踪卡清账
    - **不在范围**：N1-148-1 / N1-148-2 独立 ADR / 代码改动
    - **工时估算**：~0.05w

60. **CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-B** · ADR-148 EP-B 前端 LoginSessions Tab disabled tooltip 提示（小卡收尾）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续 EP-A 会话）
    - **子代理**：无
    - **依赖**：ADR-148 ✅ + EP-A ✅（commit dd71d1a2）
    - **范围**：1 文件（LoginSessionsTab.tsx）
    - **关联 GAP**：#G-settings-session-fields-consume 完全闭合 + UX 透明化
    - **完成备注**：
      - timeoutMinutes hint 加「✅ 已生效（ADR-148 EP-A / commit dd71d1a2）」状态标识
      - sessionMaxConcurrent input 加 disabled + tooltip「需 user_sessions 表 + 踢出策略 ADR（N1-148-1）」+ hint「⏸ 即将支持」
      - sessionExtendOnActivity checkbox 加 disabled + tooltip「需 ADR-003 兼容性评估（N1-148-2）」+ hint「⏸ 即将支持」
      - 用户避免误以为 maxConcurrent/extendOnActivity 已生效（H1 零 mock + UX 透明范式）
      - typecheck + lint PASS
      - 现有 LoginSessionsTab.test 5/5 PASS（disabled 不影响 controlled value 测试）
    - **工时估算**：~0.1w / 实际 ~0.05w

59. **CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-A** · ADR-148 后端实施 session_timeout_minutes KV 消费 + R-148-4 user:rca TTL 同步 + 12 单测（#G-settings-session-fields-consume 完全闭合 2/2）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续 ADR 起草会话）
    - **子代理**：无（ADR-148 已 Opus A PASS commit e34b1229）
    - **依赖**：ADR-148 ✅ + auth.ts signAccessToken + UserService 4 caller + admin/users.ts user:rca 3 处写入
    - **范围**：5 代码 + 1 新测试（9 用例）+ 1 现有测试扩展（3 用例）+ 3 现有测试更新（EX=900 → 3600）+ 3 文档
    - **关联 GAP**：#G-settings-session-fields-consume（P2 安全）⚠️+🔄 → ✅ **完全闭合 2/2**
    - **完成备注**：
      - auth.ts signAccessToken 加可选 expiresIn 参数（默认 ACCESS_TOKEN_EXPIRES_IN '15m'，向后兼容）+ jsonwebtoken 类型断言 `as jwt.SignOptions`
      - UserService.getSessionTimeoutMinutes private helper：try-catch getSetting + Number 转换 + NaN 降级默认 60min + Math.max(5, Math.min(1440, x)) clamp 防护
      - 4 处 signAccessToken caller 改造（register/login/refresh/devLogin）传 `${ttl}m` 字符串
      - admin/users.ts R-148-4 修复：ROLE_CHANGED_CACHE_TTL_SECONDS 常量删除 + resolveRoleChangedCacheTtl helper（getSetting + try-catch 降级 + Math.max(900, minutes * 60) 下限保护）+ 3 处写入（ban / role 变更 / batch-ban）改用动态 TTL；batch-ban loop 外 await 一次复用
      - 12 新单测全 PASS：
        - auth.test.ts 加 3 用例（默认 '15m' / '30m' / '5m' expiresIn 参数）
        - user-service-session-timeout.test.ts 新建 9 用例（4 caller 集成 + KV 缺失/非数字降级 + clamp 边界 0/1/9999）
      - 3 现有测试更新 EX=900 → EX=3600（默认 60min default + R-148-4 max 下限）
      - 全 unit 4700/4701 PASS（1 pre-existing flaky 隔离 PASS / 与本卡 0 重叠）
      - typecheck + lint + verify:adr-contracts PASS
    - **行为变更**：access token TTL 从硬编码 15m → KV 驱动默认 60m；user:rca Redis TTL 从硬编码 900s → max(900, session_timeout_minutes * 60) 动态
    - **不在范围**：
      - maxConcurrent 消费（独立 ADR / N1-148-1）
      - extendOnActivity 消费（独立 ADR / N1-148-2）
      - KV Redis cache 升级（N1-148-3）
      - ADR-003 描述更新（独立小卡 / 不阻塞）
      - LoginSessions Tab UI disabled tooltip（EP-B 可选 / 不阻塞）
    - **工时估算**：~0.5w / 实际 ~0.5w（含 R-148-4 同步修复 + 3 现有测试更新 + try-catch 降级范式）

58. **CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-ADR** · ADR-148 起草（session 3 KV 字段中间件消费协议）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（D-148-1..8 完整 / 12 测试 surface / 4 风险 / 4 N1 / MVP 范围控制：仅 timeoutMinutes / maxConcurrent + extendOnActivity 推 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 C UserService.getSessionTimeoutMinutes helper + 方案 A 每次查 DB（QPS < 10） + 方案 C 双重防护（zod + clamp + NaN） + maxConcurrent/extendOnActivity 推 N1 + R-148-4 ADR-139 user:rca Redis TTL 同步修复（EP-A 一并完成）
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-148 11 节完整正文；8 D-N 决策 + 端点契约 + R-MID-1 零新增确认 + 12 测试 surface + 4 风险 + 4 N1
      - 关键发现 **R-148-4**：ADR-139 `user:rca` Redis TTL 硬编码 900s（= 旧 access token 15m），动态化 timeout 后会出现 max(0, timeout - 900) 秒的权限穿越窗口；EP-A 一并修复（user:rca TTL → `Math.max(900, session_timeout_minutes * 60)`）
      - MVP 范围控制：仅消费 timeoutMinutes（1 KV）；maxConcurrent（需 user_sessions 表 + 踢出策略）+ extendOnActivity（需 ADR-003 兼容评估 + authenticate plugin 改造）独立 N1
      - 与 ADR-003 张力：access token TTL 默认 15m → 60m（KV seed 一致）；属"有意行为变更"
      - 8 条 D-148-N 完整 + 4 关联 ADR（ADR-003 直接修改 / ADR-139 R-148-4 兼容性 / ADR-121 无变更 / ADR-146 同期 KV 消费范式）
      - GAPS.md #G-settings-session-fields-consume ⬜/🔄 → ⚠️+🔄
      - verify-endpoint-adr PASS（零新端点）
    - **关联 GAP**：#G-settings-session-fields-consume（P2 安全）⬜/🔄 → ⚠️+🔄（ADR ✅ 2/3 / 实施 3/3 待立）
    - **工时估算**：~0.15w / 实际 ~0.2w（含 Opus 1 轮评审 + R-148-4 增量发现）

57. **CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B** · ADR-147 前端实施 admin shell SWR 接入 + localStorage read + 5 单测（#G-shell-notifications 完全闭合 3/3）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续 EP-A 会话）
    - **子代理**：无（消费 EP-A 后端 + ADR-147 既定决策）
    - **依赖**：EP-A ✅（commit 1784a943）+ admin-ui AdminShell 现有 props 契约
    - **范围**：4 代码 + 1 测试（5 用例）+ 3 文档
    - **关联 GAP**：#G-shell-notifications（P1）⚠️+🔄 → ✅ **完全闭合** 3/3
    - **完成备注**：
      - admin-shell-notifications.ts 新建（useAdminNotifications + useAdminTasks 双 hook + apiClient.get 复用 + 60s setInterval polling + cleanup + localStorage lastViewedAt + readIds Set session）
      - admin-shell-client.tsx mock → hook（删 mockNotifications/mockTasks import + handleMarkAllNotificationsRead 改 markAllRead from hook + handleNotificationItemClick 改 markOneRead）
      - cancel/retry 改 toast 占位（CrawlerRun cancel + bull retry 端点 N1-147-4 后端待加；维持现有 UX）
      - shell-data.tsx 删 mockNotifications/mockTasks exports + 清 unused NotificationItem/TaskItem import
      - 5 新单测 PASS（mount fetch / lastViewedAt 已读判定 / markAllRead 写 localStorage + 全部 read=true / markOneRead session readIds 不影响其他 / degraded 暴露）
      - read 状态前端计算：`readIds.has(id) || createdAt <= lastViewedAt`（markOneRead 仅 session 弱反馈，不持久化）
      - 零新依赖（不引入 SWR / 复用 apiClient 标准 fetch wrapper）
      - 全 unit 4688/4689 PASS（1 pre-existing flaky 隔离 PASS / 与本卡 0 重叠）
      - typecheck + lint PASS
    - **不在范围**：
      - CrawlerRun cancel + bull retry 真后端端点（N1-147-4 / 按需启动）
      - per-user DB read 表（ADR-147 N1-147-1 / admin 多人协作时触发）
      - SSE 实时推送（ADR-147 N1-147-3 / 同时在线 > 20 时触发）
    - **工时估算**：~0.10w / 实际 ~0.15w（含 markOneRead readIds Set 设计重构 1 轮）

56. **CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A** · ADR-147 后端实施 + 14 单测（admin shell notification hub MVP）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续 ADR 起草会话）
    - **子代理**：无（ADR-147 已 Opus A PASS commit 2a8bc91a）
    - **依赖**：ADR-147 ✅ + admin-ui SSOT NotificationItem/TaskItem ✅ + admin_audit_log + crawler_runs + bull queue
    - **范围**：6 代码 + 2 测试文件（14 用例）+ 4 文档
    - **关联 GAP**：#G-shell-notifications（P1）⚠️+🔄 → ⚠️+🔄 **后端 + ADR 闭合**（剩 EP-B 前端 ~0.10w）
    - **完成备注**：
      - packages/types/admin-shell.types.ts 新建（AdminNotificationItem + AdminTaskItem + Response 信封 + AdminQueueCounts）；types/index.ts export
      - NotificationService（白名单 ReadonlySet 8 类 + LEVEL/HREF/TITLE 三 Map + list 方法 SQL ANY 子查询 + COUNT）
      - TaskAggregator（CrawlerRun mapper readonly-friendly + bull active mapper + Redis try-catch 降级 + id 前缀防冲突 + progress 0-100 clamp）
      - 2 route（notifications + system-jobs）+ server.ts 注册
      - ADR-147 §4 加 sub-heading 触发 verify-endpoint-adr 识别（186 admin 路由 ↔ 63 ADR 端点对齐）
      - 14 新单测全 PASS（NotificationService 9：白名单 + 8 类完整 + level/href 映射 + 时间窗口 + limit + 401/200 endpoint；TaskAggregator 5：CrawlerRun running/failed + Redis 降级 + bull progress clamp + endpoint queueCounts）
      - vi.hoisted 范式避免 mock hoisting 错误
      - 零 R-MID-1 新增 / 零 ErrorCode / 零 migration / 零新依赖
      - 全 unit 4683/4684 PASS（1 pre-existing flaky use-filter-presets.test.ts 隔离 7/7 PASS / 与本卡无关）
      - typecheck + lint + verify:adr-contracts PASS
    - **不在范围**：前端 SWR hooks + admin-shell-client 接入（留 CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B ~0.10w / 4 文件）
    - **工时估算**：~0.20w / 实际 ~0.25w（含 ADR §4 sub-heading 修复 + vi.hoisted 范式适配 + TS readonly 修复 1 轮）

55. **CHG-SN-8-FUP-SHELL-NOTIFICATIONS-ADR** · ADR-147 起草（admin shell notification hub MVP）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（D-147-1..8 完整 / 14 测试 surface / 5 风险 / 4 N1 / MVP 范围 + 现有基础设施复用最大化）
    - **方案选型**：spawn Opus 1 轮；选方案 A audit_log 子集映射（8 类白名单 actionType + level/href 映射，零新表）+ 方案 A 前端 polling 60s + 方案 C 有主次 tasks 数据源（CrawlerRun 主 + bull active 副 + Redis 降级）+ 方案 A localStorage lastViewedAt read（零 per-user DB read）+ 零 R-MID-1 新增 + 零新依赖 + 2 新端点（GET /admin/notifications + GET /admin/system/jobs）
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-147 11 节完整正文；8 D-N 决策 + 端点契约 + R-MID-1 零新增确认 + 14 测试 surface + 5 风险 + 4 N1
      - 关键设计：audit_log 已覆盖 39 actionType → notifications 派生（零表/零 migration/零双写）；CrawlerRun + bull active 双源去重（CrawlerRun 优先）；polling 60s（admin <10 人，0.17 QPS/人 + idx 覆盖）；localStorage lastViewedAt（MVP 单人 admin 场景 OK，跨设备需求弱）
      - GAPS.md #G-shell-notifications ⬜/🔄 → ⚠️+🔄；ADR-147 决策 + 实施 follow-up 完整说明
      - verify-endpoint-adr 184 admin 路由全部对齐（2 新端点登记 ADR-147 待 EP-A 落地）
    - **关联 GAP**：#G-shell-notifications（P1）⬜/🔄 → ⚠️+🔄（ADR ✅ 2/3 / 实施 3/3 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审）

54. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.4** · ADR-146 storage.r2.alert R2 quota cron 触发点接入（4/5 触发点闭合 + 框架 100%）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A ✅ + EP-A2.3 cron 范式 ✅ + @aws-sdk/client-s3 ^3.717 已装
    - **范围**：2 文件代码（maintenanceScheduler 加 runR2QuotaTick + 注册 setInterval + getSchedulerStatus / types SystemSettingKey 扩 2 KV key）+ 2 文档（GAPS / P-settings §3.7）
    - **关联 GAP**：#G-settings-webhook-impl 3/5 → 4/5 触发点闭合 + 框架 100%（剩 1 触发点 EP-A2.2 外部依赖）
    - **完成备注**：
      - runR2QuotaTick：6h 间隔 / ListObjectsV2 分页累加 Size / bucket=R2_IMAGES_BUCKET / 阈值 50 GB 默认 / usagePercent > 80% 触发 / 12h debounce 防风暴（ADR-146 R-146-3）
      - 10 万 keys partial 上限保护（R2_LIST_MAX_ITERATIONS=100）— 超出 partial 数据告警（保守估计反而符合预警目的）
      - payload 对齐 ADR-146 D-146-7：`{ usagePercent, usageBytes, threshold, bucket, checkedAt }`
      - SystemSettingKey 扩 2 KV key（notification_r2_quota_threshold_bytes / notification_r2_last_alert）
      - getSchedulerStatus 加 r2-quota-check 条目
      - R2 env 未配（R2_ENDPOINT/ACCESS_KEY/SECRET_KEY 任一缺失）跳过 tick；零本地开发噪音
      - try/catch 兜底 webhook 失败不阻塞 scheduler 退出
      - 零新依赖（@aws-sdk/client-s3 复用 ImageStorageService 同 SDK）
      - 零新单测（依赖现有 webhook framework 17 用例 + R2 SDK 行为）
      - 全 unit 4669/4670 PASS（1 pre-existing flaky CrawlerClient.test.tsx 隔离 62/62 PASS / 与本卡无关）
      - typecheck + lint + verify:adr-contracts PASS（184 admin 路由 ↔ 61 ADR 端点对齐）
    - **不在范围**：submission.created EP-A2.2（外部依赖待用户端 POST 实装）
    - **工时估算**：~30 min / 实际 ~30 min

53. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.3** · ADR-146 moderation.pending.threshold cron 触发点接入（maintenanceScheduler 1h tick + 1h debounce）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A ✅ + EP-A2.1 ✅
    - **范围**：2 文件代码（maintenanceScheduler 加 tick + dispatcher 触发 + types SystemSettingKey 扩 2 KV）
    - **关联 GAP**：#G-settings-webhook-impl 3/5 触发点闭合
    - **完成备注**：
      - runPendingThresholdTick：1h 间隔 / SQL COUNT pending_review / KV threshold 默认 50 / KV last_alert 1h debounce 防风暴（ADR-146 R-146-3）
      - 不入 maintenanceQueue（轻量 SQL + KV 直接执行）
      - getSchedulerStatus 新增 pending-threshold-check 条目
      - SystemSettingKey 扩 2 KV key（notification_pending_threshold / notification_pending_last_alert）
      - 全 unit 4670/4670 PASS
    - **工时估算**：~20 min / 实际 ~20 min

52. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.1** · ADR-146 CrawlerRun.failed 触发点接入（最小侵入 worker 1 处）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A ✅ + EP-A2 ✅
    - **范围**：2 文件代码（query 加 RETURNING + 返回类型 + worker finally 块接入触发）
    - **关联 GAP**：#G-settings-webhook-impl 2/5 触发点闭合
    - **完成备注**：
      - syncRunStatusFromTasks 加 RETURNING + SyncRunStatusResult interface（8 处 worker 调用方 zero-impact）
      - crawlerWorker.ts finally 块 status=failed/partial_failed 时 webhook 触发
      - try/catch 兜底 webhook 失败不阻塞 worker 退出
      - 零新单测（复用 webhook framework 测试 14+3 = 17 用例覆盖）
      - 全 unit 4670/4670 PASS（0 失败）
    - **工时估算**：~15 min / 实际 ~15 min

51. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2** · ADR-146 触发点接入（StagingPublishService 1 触发点 + framework 集成 3 单测）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A ✅ + EP-B ✅
    - **范围**：3 文件（StagingPublishService 注入 dispatcher + enqueue 调用 + Route 实例化 + 3 单测）
    - **关联 GAP**：#G-settings-webhook-impl 后端核心 + UI → 1/5 触发点闭合（剩余 4 触发点 follow-up）
    - **完成备注**：
      - optional dispatcher 注入范式（系统 Job 不发，避免 cron 噪音）
      - payload 6 字段（operationType + totalCount + successCount + failedCount + publishedIds + skippedIds）
      - 3 单测验证 framework 集成正确
      - 全 unit 4670/4670 PASS（0 失败）
    - **不在范围**：CrawlerRun.failed EP-A2.1 ~30 min / submission.created EP-A2.2 等用户端 / R2 quota + pending threshold cron EP-A2.3 ~40 min
    - **工时估算**：~15 min / 实际 ~20 min

50. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B** · ADR-146 前端实施（NotificationsTab 5 事件订阅 + 连通性测试按钮 + 4 单测）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A 后端端点 ✅（commit f8a57462）
    - **范围**：8 文件（webhook-api lib 新建 + NotificationsTab 改 + siteConfig zod/mapper + systemSettings 读 mapper + types 扩 + v1 fixture 同步 + 4 新单测）
    - **关联 GAP**：#G-settings-webhook-impl 后端核心 → 后端核心 + 前端 UI ✅（5 触发点接入 EP-A2 follow-up 待）
    - **完成备注**：
      - webhook-api.ts lib（testWebhook + WEBHOOK_EVENT_TYPES enum + WEBHOOK_EVENT_LABELS）
      - NotificationsTab 加 webhookEvents state + toggleEvent handler + 5 checkbox enum 驱动渲染 + 「连通性测试」按钮 + handleTestWebhook（dirty 守卫 + 成功/失败 toast）
      - siteConfig zod schema notificationWebhookEvents enum array + mapper 写 KV（去重 Set）
      - systemSettings 读 mapper 加 parseWebhookEvents helper（JSON 解析失败降级 []）
      - types SiteSettings 扩字段 + v1 fixture 同步
      - 4 新单测 PASS（5 checkbox 渲染 / 勾选 dirty + 保存透传 / 测试按钮 disabled 当 dirty / click + success toast）
      - 全 unit 4667/4667 PASS / typecheck/lint PASS
    - **工时估算**：~30 min / 实际 ~30 min

49. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A** · ADR-146 后端核心实施（R-MID-1 第 25 次 + WebhookDispatcher + ssrf-guard + 测试端点 + 16 单测）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-146 已 Opus A PASS commit 07b142ca）
    - **依赖**：ADR-146 ✅（commit 07b142ca）+ AuditLogService + crypto + system_settings 表
    - **范围**：10 文件后端（4 R-MID-1 真源 + ssrf-guard + WebhookDispatcher + Route + server.ts + 16 单测）
    - **关联 GAP**：#G-settings-webhook-impl ⚠️+🔄 → ✅ 后端核心闭合（5 触发点接入 + 前端 UI follow-up 待）
    - **完成备注**：
      - R-MID-1 第 25 次 7 文件 checklist 完整闭环（types union + ACTION_TYPES + 2 set-equal 测试 + Dispatcher audit fire-and-forget）
      - ssrf-guard 5 层防御独立模块（https only + RFC 1918 + loopback + link-local + 云元数据）
      - WebhookDispatcher：enqueue fire-and-forget + dispatch retry [5s/15s/45s] + jitter + 30s 超时 + HMAC sha256= + 4 自定义 header + 最终失败 audit + sendTest 单次不重试
      - POST /admin/webhook/test admin auth + 422/200 完备
      - 16 单测全 PASS（14 dispatcher + 2 endpoint）
      - 全 unit 4661/4663 PASS（2 pre-existing flaky 隔离 PASS）
      - typecheck/lint/verify:adr-contracts PASS（184 admin 路由全部对齐 61 ADR 端点）
    - **不在范围**：5 触发点接入 → CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2 ~25 min / 前端 NotificationsTab → CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B ~30 min
    - **工时估算**：~1.5h / 实际 ~1h（含 R-MID-1 真源同步 + ssrf-guard 5 层 + Dispatcher 完整 + 16 测试 + flaky 边界确认）

48. **CHG-SN-8-FUP-WEBHOOK-IMPL-ADR** · ADR-146 起草（admin webhook 通知触发协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-146-1..8 完整 / 16 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 B 事件 enum + 用户多选订阅（不引入多端点表）+ 5 事件枚举（crawler/storage/moderation/submission/video）+ 方案 A 修正版 fire-and-forget Dispatcher（不用 bull 避免 Redis 依赖）+ HMAC-SHA256 + retry + SSRF 5 层防御 + R-MID-1 第 25 次 + 唯一新端点 POST /admin/webhook/test
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-146 11 节完整正文；8 D-N 决策 + WebhookDispatcher sketch + R-MID-1 7 文件 checklist + 16 测试 surface + 4 风险 + 2 N1
      - 关键设计：bull 已装但不用（避免 Redis 依赖与 Resovo 当前架构对齐）；fire-and-forget Dispatcher 与 AuditLogService 同模式；HMAC sha256= 前缀对齐 GitHub 行业惯例；SSRF 5 层独立模块（apps/api/src/lib/ssrf-guard.ts）
      - verify-endpoint-adr 183 admin 路由全部对齐 61 ADR 端点
      - GAPS.md #G-settings-webhook-impl ⚠️ → ⚠️+🔄；P-settings §3.7 完整重写
    - **关联 GAP**：#G-settings-webhook-impl（P3） ⚠️ → ⚠️+🔄（消费层 warn banner ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.25w / 实际 ~0.3w（含 Opus 1 轮评审）

47. **CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B** · ADR-145 前端实施（VideoEditDrawer 双模式 + 按钮 enable + 3 单测）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-145 ✅ + EP-A 后端端点 ✅（commit b483a59b）
    - **范围**：4 文件（lib createVideo 封装 + Drawer 双模式 + VideoListClient drawerTarget 三态 + 3 新单测）
    - **关联 GAP**：#G-videos-add ⚠️+🔄 → ✅ 完全闭合 4/4
    - **完成备注**：
      - lib createVideo 封装 + ManualAddVideoInput/Result/PublishMode 类型
      - Drawer isCreating 判定 + useEffect 双路径 + handleSubmit 分支 + render header/footer/tab 文案变化
      - VideoListClient drawerTarget 三态 'closed' | null | string（避免 null 双义）
      - PageHeader 「+ 手动添加视频」按钮 enable
      - 3 新单测 PASS（创建模式 header + 提交 + tab disabled）
      - 全 unit 4644/4645 PASS（1 pre-existing flaky 隔离 PASS）
    - **工时估算**：~40 min / 实际 ~50 min（含 form 字段转换 typecheck 修正）

46. **CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A** · ADR-145 后端实施（R-MID-1 第 24 次 + VideoService 重构 + Route + 20 单测）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-145 已 Opus A PASS commit 5dcc897f）
    - **依赖**：ADR-145 ✅（commit 5dcc897f）+ MediaCatalogService.findOrCreate + createVideo + transitionVideoState
    - **范围**：7 文件后端（types union + AuditLogService + 2 set-equal + Service 重构 + Route schema + 20 单测）
    - **关联 GAP**：#G-videos-add ⚠️+🔄 → ✅ 后端闭合（前端 follow-up 待）
    - **完成备注**：
      - VideoService.create 重构：findOrCreate + 重复检测 SELECT count + force 跳过 + publishMode 三路径状态机 + R-MID-1 audit fire-and-forget
      - 新增 ManualAddVideoInput / VideoPublishMode / VideoManualAddResult 类型 + VideoManualAddConflictError 异常
      - Route ManualAddVideoSchema + 409 STATE_CONFLICT detail（existingVideoId + existingTitle）
      - R-MID-1 第 24 次 7 文件 checklist 完整闭环
      - 修复 ADR-145 §1 列出 6 项现有技术债（绕过 catalog / 无类型 / 零 audit / 零重复检测 / 无 publishMode / locked_fields 不保护）
      - 20 新单测 PASS（含 audit payload 内容断言 4 个用例 + 422/403/409 三态不写 audit）
      - 全 unit 4641/4642 PASS（1 pre-existing flaky 隔离 PASS）
    - **不在范围**：前端 VideoEditDrawer 双模式 + 按钮 enable（留 CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B ~40min）
    - **工时估算**：~0.2w / 实际 ~0.3w（含 elasticsearch mock 边界排查）

45. **CHG-SN-8-FUP-VIDEO-MANUAL-ADD-ADR** · ADR-145 起草（admin 手动添加视频端点协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-145-1..8 完整 / 20 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 C 最小 3 字段（title/type/contentRating）+ 14 元数据 optional + 方案 B 重复检测（findOrCreate isNewlyCreated + force 跳过）+ 方案 B catalog 复用 findOrCreate(metadataSource='manual')+ 方案 C publishMode 三路径 + 方案 A VideoEditDrawer 双模式 + 零新 ErrorCode（复用 STATE_CONFLICT）+ R-MID-1 第 24 次 video.manual_add
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-145 11 节完整正文；8 D-N 决策 + 端点 sketch + R-MID-1 7 文件 checklist + 20 测试 surface + 4 风险 + 2 N1
      - 修复 6 项现有 POST /admin/videos 技术债（不是新增端点而是重构）
      - 8 条 D-145-N 在本卡 changelog 完整闭环
      - GAPS.md #G-videos-add ⚠️ → ⚠️+🔄；P-videos §3.5 完整重写
      - verify-endpoint-adr PASS（183 admin 路由全部对齐 60 ADR 端点）
    - **关联 GAP**：#G-videos-add（P2） ⚠️ → ⚠️+🔄（消费层 disabled btn ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审）

44. **CHG-SN-8-FUP-PRESET-TEAM-EP-B** · ADR-144 前端实施（DB 双源 + scope badge + import 入口）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-144 既定决策 / 消费 EP-A 后端端点）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-144 ✅ + EP-A ✅（commit 0bf0b36c）
    - **范围**：5 文件（lib api 新建 + hook 改 async + Console 透传 + Popover 加 badges/import + 5 SWR 测试）+ 1 旧测试迁移说明
    - **关联 GAP**：#G-moderation-preset-team ⚠️+🔄 → ✅ 完全闭合 4/4
    - **完成备注**：
      - filter-presets-api.ts 4 端点封装
      - hook 改 async + 双源 fallback（fetch 失败保留 localStorage offline 兜底）+ importLocalToServer + dataSource/localPendingCount 状态
      - ModerationConsole 4 handler 加 try/catch 兜底
      - Popover live/local badge + 团队 shared badge + 「导入本地 (N)」按钮
      - 5 新 SWR 单测 + 5 过时 CRUD 测试迁移说明
      - 全 unit 4623/4625 PASS / typecheck + lint PASS
      - 零新依赖（使用仓内 useEffect+fetch；不引入 SWR 避免 BLOCKER）
    - **不在范围**：SavePresetModal scope picker / 列表行 scope 切换 UI（留 follow-up CHG-SN-8-FUP-PRESET-TEAM-EP-C 按需 ~0.05w）
    - **工时估算**：~0.2w / 实际 ~0.2w（含 5 旧测试迁移 + jsdom env 修复）

43. **CHG-SN-8-FUP-PRESET-TEAM-EP-A** · ADR-144 后端实施（migration + DB + Service + Route + R-MID-1 第 21-23 次系统化 + 18 单测）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-144 既定决策 / 复用全栈）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-144 已 Opus A PASS commit b1585847）
    - **依赖**：ADR-144 ✅（commit b1585847）
    - **范围**：10 文件后端（2 migration + DB query + Service + Route + server.ts 注册 + 2 types union + AuditLogService 同步 + 18 单测 + 2 守卫测试同步）
    - **拆 -A/-B 理由**：CLAUDE.md「PATCH 范围 > 5 项」+ ADR-144 §8 工时 ~0.4w；-A 后端独立闭合 / -B 前端 SWR 重写留 follow-up
    - **关联 GAP**：#G-moderation-preset-team ⚠️+🔄 → ✅ 后端闭合（前端 follow-up 待）
    - **完成备注**：
      - migration 071+072（建表 + 3 索引 + 部分唯一保证 default 单一 + CHECK 12→13）
      - DB query CRUD 5 函数（含 LEFT JOIN users + clearDefaultForOwnerTab 互斥）
      - FilterPresetService（zod + RBAC + diff-only audit + 23505→409 兜底）
      - 4 端点（GET/POST/PATCH/DELETE）+ moderator+admin 权限 + 完备错误码
      - R-MID-1 第 21-23 次系统化（filter_preset.create/update/delete + targetKind filter_preset）
      - 18 新单测含 audit 3 路径全断言 PASS / 完整 unit 4618/4620（+18；2 pre-existing flaky）
      - typecheck + lint + verify:adr-contracts 全 PASS（verify-endpoint-adr 4 端点匹配 ADR-144 §端点契约表）
    - **工时估算**：~0.25w / 实际 ~0.3w（含端点契约表 6 列格式修复 + flaky 边界排查）

42. **CHG-SN-8-FUP-PRESET-TEAM-ADR** · ADR-144 起草（FilterPreset 团队共享协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-144-1..8 完整 / 18 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 B `scope: 'private' | 'shared'`（不引入 team 概念，Resovo 当前架构无多租户）+ user_filter_presets 表 + 4 端点（GET/POST/PATCH/DELETE）+ owner 全权 + admin 强制删 shared + R-MID-1 第 21-23 次系统化 + 用户手动 import 迁移 + DB 部分唯一索引保证 default 单一 + 零新 ErrorCode + 7 关联 ADR 实证
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-144 11 节完整正文；8 D-N 决策 + migration 071+072 SQL + 18 测试 surface + 4 风险 + 2 N1
      - 8 条 D-144-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 推进
      - GAPS.md #G-moderation-preset-team ⚠️ → ⚠️+🔄；P-moderation §3.4 更新
    - **关联 GAP**：#G-moderation-preset-team（P3） ⚠️ → ⚠️+🔄（消费层 warn chip ✅ 1/3 + ADR ✅ 2/3 / 实施 3/3 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审）

41. **CHG-SN-8-FUP-USERS-BATCH-BAN-UI** · ADR-143 前端 batch mode UI（#G-users-batch-ban 完全闭合）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（消费侧 UI / 复用 DataTable 原生 selection / 无 ADR）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（消费 admin-ui 真源范式 / 不动公开 API）
    - **依赖**：CHG-SN-8-FUP-USERS-BATCH-BAN-EP ✅（commit b1f8c05f）+ DataTable selection 范式
    - **范围**：2 文件 — UsersListClient（state + 3 handler + DataTable selection/bulkActions props + 删 PageHeader 旧 disabled btn）+ UsersListClient.test 5 新测试
    - **不在范围**：N1-143-1 并行 pipeline / 其他列表页 selection 范式扩展
    - **关联 GAP**：#G-users-batch-ban → ✅ **完全闭合** 4/4
    - **完成备注**：
      - UsersListClient 加 selectedIds Set + batchPending state
      - handleSelectionChange 过滤 admin id 与后端 skip 一致
      - DataTable selection + onSelectionChange + bulkActions 三件套
      - bulkActions slot：已选 N + danger ban + default unban + ghost clear
      - 5 新单测 + 全 unit 4596/4596 PASS
      - 删 PageHeader 旧 disabled「批量封禁」按钮（checkbox 自启后冗余）
      - GAPS / P-users §4.1 完整闭合说明
    - **工时估算**：~0.3w / 实际 ~0.3w（含测试 + 文档闭环）



12. **CHG-SN-8-GAPS-BATCH-1** · merge candidate_b auto-fill + dashboard runAll 改造 + videos-add 状态确认 — 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **完成备注**：
      - **#G-merge-candidate-b-auto 闭合**：DirectMergeWorkspace 增 `candidateBIdFromUrl` prop + useEffect 一次性 fetch + 注入 picker.value；含 AbortController cleanup；测试新增 1 用例 PASS（共 4 用例）
      - **#G-dashboard-runall 闭合**：DashboardClient PageHeader 拆 2 按钮 — 「全站增量」primary（单次 confirm）+ 「全站全量」ghost（双重 confirm + prompt 输入"全量"）；测试 4 用例改造（前 2 个改双重 + 新增 incremental + confirm 取消）；总 16 PASS
      - **#G-videos-add 验证**：实证按钮存在 disabled + tooltip，状态升 ⚠️ 部分实装（H2 已避免死按钮；实际创建功能 follow-up）
      - GAPS.md 3 条状态更新（2 ✅ + 1 ⚠️）
      - typecheck + lint + verify:manual-coverage PASS
    - **关联**：W1 金票 + W4 工作流流畅度提升
    - **工时估算**：0.1w / 实际 ~0.1w（3 件小事打包）

13. **CHG-SN-8-GAPS-MOD-BATCH** · 审核台批量审核 UI（#G-moderation-batch-ui P1）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **完成备注**：
      - `apps/server-next/src/lib/moderation/api.ts` 增 `batchApproveVideos(ids)` + `batchRejectVideos(ids, reason, labelKey?)` lib 封装
      - `ModListRow.tsx` 增 selectionMode + selected + onToggleSelect props；selectionMode 开时显 checkbox + 单击 row → toggle 而非跳详情
      - `ModerationConsole.tsx` 增 batchModeOn state + selectedIds Set + toggleSelectId + clearSelection + handleBatchApprove + handleBatchRejectSubmit
      - 顶部增「批量模式」toggle 标签（紧邻 approveAndPublishOn）
      - 底部 fixed bulk action bar（accent border-top + shadow + 3 按钮：批量通过 / 批量拒绝 / 清除选择）
      - 复用 RejectModal 作批量拒绝弹窗（title 「批量拒绝 N 条」）
      - ModerationBatch.test 5 用例 PASS（lib batch-approve / batch-reject 调用 + ModListRow checkbox + selected 视觉 + 默认模式回归）
      - GAPS.md #G-moderation-batch-ui 标 ✅
      - P-moderation §3.5 完整章节 + §4.2 标 ✅
    - **关联**：审核效率提升；后端 batch-approve / batch-reject 端点首次前端消费
    - **工时估算**：0.2w / 实际 ~0.2w

18. **CHG-SN-8-GAPS-AUDIT-ROLLBACK** · 审计行尾「回滚」按钮（#G-audit-rollback-universal 消费层补齐）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（不动后端 / 不起 ADR / 复用已有反向 API）
    - **完成备注**：
      - 通用后端端点路线（POST /admin/audit/logs/:id/rollback + reverse_action 映射 + 跨表 schema 回滚）需 0.5-0.8w + ADR-138 + Opus 评审；本卡走**消费层补齐**最小可用范围 0.15w
      - 新建 `apps/server-next/src/lib/audit/rollback-routes.ts` — `resolveRollbackTarget(row)` 返 `{ href, label, disabledReason }`；覆盖 40 actionType（含 8 类可跳转业务页 + 22 类单向操作 disabled + targetKind fallback）
      - AuditColumns.tsx：`buildAuditColumns({ onRollback })` 支持回滚 callback；新增 `actions` 列 + danger xs button + disabled 状态视觉（bg-disabled + cursor: not-allowed）+ title tooltip
      - AuditClient.tsx：useRouter + handleRollback → router.push(target.href) / disabled → warn toast；columns useMemo deps 含 handleRollback
      - rollback-routes.test 12 用例 PASS（video.approve / video.reject_labeled / staging.publish / video.merge / home_module.create / crawler.run_create disabled / system.cache_clear disabled / image_health.rescan disabled / targetId 缺失 disabled / 未知 actionType fallback / encodeURIComponent 特殊字符）
      - AuditClient.test 补 `vi.mock('next/navigation')` 修复因新增 useRouter 引发的 15 测试预存红潜在风险；全 unit 4441 → 4453 (+12) PASS
      - GAPS.md #G-audit-rollback-universal ⬜ → ⚠️；登记通用端点 follow-up CHG-SN-8-FUP-AUDIT-ROLLBACK-EP
      - P-audit §3.4 完整重写为新行为说明（含 8 类跳转表 + 单向不可回滚类型清单 + fallback 规则 + follow-up 路径）；§7 FAQ 2 行更新
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
    - **关联**：H2「零死按钮」豁免范式（disabled+tooltip）；P2 GAPS；通用后端端点立独立 follow-up（需 ADR-138 + Opus 评审 0.3w+）
    - **工时估算**：0.15w / 实际 ~0.18w（含 audit.test mock 顺手补 + 文档完整重写）

17. **CHG-SN-8-GAPS-HOME-BRAND-MULTI** · TopTen/Featured 消费 brand_slug（#G-home-brand-multi）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（前端消费已有后端契约 + ADR-052；不动后端 / 公开 API）
    - **完成备注**：
      - 实证核查：后端 `apps/api/src/routes/home.ts:22,41` + HomeService 已按 brand_slug 过滤；问题在前端调用未传 brand_slug 始终走 null 路径（仅命中 brand_scope='all-brands'）
      - TopTenRow.tsx + FeaturedRow.tsx 引入 `useBrand()` → URL 拼 `?brand_slug=<slug>`（encodeURIComponent）+ useEffect deps 加 brand.slug → brand 切换自动重 fetch
      - HomeBrandFiltering.test 3 用例 PASS（TopTen 带 brand_slug / TopTen brand 缺省走 base / FeaturedRow 带 brand_slug）；polyfill ResizeObserver（jsdom 缺失）
      - GAPS.md #G-home-brand-multi 状态 ⬜ → ✅
      - P-home §4.1 改写为「✅ 已完整打通」三段说明（后端 / 前台消费 / 编辑场景）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4441 PASS（+3）
    - **关联**：ADR-052 brand 协议消费侧补齐；多品牌部署完整路径打通；GAPS P3
    - **工时估算**：0.1w / 实际 ~0.1w

16. **CHG-SN-8-GAPS-SETTINGS-NEGATE** · #G-settings-save-all NEGATED 登记（架构决策不实装）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：haiku（纯文档 NEGATED 登记）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **完成备注**：
      - 实证查代码：`apps/server-next/src/app/admin/settings/_client/SettingsContainer.tsx:161-163` 注释明示「CHG-SN-6-AUDIT-DEBOUNCE-FIX 已删除『保存所有更改』，理由：5 Tab 各自保存模型下无语义」
      - GAPS.md #G-settings-save-all 状态从「⬜ 未启动」改 **❌ NEGATED**（CHG-SN-7-LOW-2 双子卡决策树 / CHG-SN-8-07 NEGATED 同范式）
      - P-settings §4.1 改写为 NEGATED 说明（保存通过 Tab 内 debounced 自动持久化）
      - verify:manual-coverage PASS（不动业务代码）
    - **关联**：澄清「设计稿要求」vs「CHG-SN-6 架构决策」冲突；GAPS P3 移出追踪
    - **工时估算**：≤ 0.02w / 实际 ~0.02w（纯实证 + 文档）

15. **CHG-SN-8-GAPS-DASH-ACTIVITY** · RecentActivityCard mock 视觉警示（#G-dashboard-activities-mock）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（仅前端 prop 透传 + lib 字段新增；无公开 API 改动）
    - **完成备注**：
      - 核查 `apps/server-next/src/lib/dashboard-data.ts` 两 return 路径（live 全量 + ModerationStats fallback）：`activities` 字段均为 `MOCK_ACTIVITIES` 全 mock → 违反 H1「零 mock 视图」硬约束（看似真实的活动时序误导审核员）
      - dashboard-data.ts：`DashboardStats` 新增 `activitiesDataSource: 'mock' | 'live'` 字段；两 return 路径设 'mock'（待 CHG-SN-8-FUP-DASH-ACTIVITY-LIVE follow-up 接 audit_log 端点后改 'live'）
      - RecentActivityCard.tsx：Props 加 `dataSource?: 'mock' | 'live'`（默认 'live'）；mock 时头部右侧渲染「示例数据」warn chip（state-warning-bg/fg + tooltip 指 follow-up 卡号 + cursor: help）
      - DashboardClient.tsx：传 `dataSource={dashboardStats.activitiesDataSource}`
      - tests/.../RecentActivityCard.test.tsx 新建 3 用例 PASS（mock 显 chip / live 不显 / 缺省默认 live）
      - GAPS.md #G-dashboard-activities-mock 状态从「⬜ 待复核」→「⚠️ 已部分实装」+ 真端点 follow-up CHG-SN-8-FUP-DASH-ACTIVITY-LIVE 登记
      - P-dashboard §7 FAQ 一行更新（说明 warn chip 来源 + follow-up 路径）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4438 PASS
    - **关联**：H1 硬约束部分缓解（mock 数据视觉可识别，真后端接入立单独 follow-up）；GAPS P2
    - **工时估算**：0.05w / 实际 ~0.08w

14. **CHG-SN-8-04-N1** · ADR-137 §11 N1 跨类型相似召回 fallback — 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（按 ADR-137 既定决策直接实施，未触动公开 API）
    - **完成备注**：
      - `apps/api/src/db/queries/moderation.ts` `listSimilarCandidates` 新增 `relaxType?: boolean` + `excludeIds?: readonly string[]` 参数；动态 WHERE（relaxType=true 去除 `v.type=$2` 严格约束 / excludeIds 非空时 `AND v.id != ALL($6::uuid[])`）
      - `ModerationService.listSimilar` 加 fallback 路径：strict 通过 minScore 后 < limit 时发起第二次 relaxType 查询，excludeIds 传 strict 结果 ids 避免重复；合并 strict+fallback scored 后整体 score desc 排序 + slice top-N
      - `computeSimilarityScore` 公式不变（type 维度 +40 仅同 type 命中；跨类型自然 +0 由其他 3 维评分）
      - moderation-similar.test 新增 2 用例（#8 fallback 命中：strict 1 条 + fallback 1 条异 type → 合并 2 条 + score 排序 / #9 strict ≥ limit → fallback 不触发只 1 次 query）；旧用例 #1 #6 改用 mockResolvedValueOnce + 第二次返空数组确保 fallback 调用预期；总 15 PASS
      - ADR-137 §11 N1 状态从「非阻塞建议（待 follow-up）」改为「✅ 已闭合（CHG-SN-8-04-N1）」
      - **顺手修 pre-existing 红线**：CHG-SN-8-08 在 MergeClient.tsx + VideoRowActions.tsx 引入 useRouter/useSearchParams 但未给测试补 mock，导致 30 测试预存红；为两个 test 文件加 `vi.mock('next/navigation', ...)` stub，恢复 30 测试 PASS（4405 → 4435 total）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4435 PASS
    - **关联**：ADR-137 §11 N1 非阻塞建议闭合；预存测试红清零；为未来用户反馈漏召回明显场景（电影同名 anime 改编版等）提供 fallback 通道
    - **工时估算**：0.1w / 实际 ~0.15w（含 pre-existing 测试红修复）

   - **历史 trailer 残留**：sonnet（文档）
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - P-videos 完整定稿（179 行 / 8 章节：标杆页 + 14 列字段表 + 6 类常用操作 + 行级/批量动作 + 4 进阶 / FAQ 6 行）
     - P-dashboard 完整定稿（96 行 / 5 类信息 + 8 卡布局 + 数据看板 Tab + 编辑态登记 backlog）
     - P-moderation 补全 §3.1 J/K 键盘流 + §3.2 RejectModal + §3.4 FilterPresetPopover + §4 进阶（重开/批量）+ §5 字段 + §6 颜色 + §7 FAQ
     - P-merge 完整定稿（136 行 / 3 类入口 + DirectMergeWorkspace + minScore 调节 + 5 字段 + 6 FAQ）
     - 新建 `docs/manual/GAPS.md`（11 条已登记 gap + 闭合规则 + 引用规约）：
       - P0 阻塞 1（#G-shell-notifications）
       - P1 主线 4（#G-dashboard-runall / #G-videos-add / #G-moderation-batch-ui / #G-merge-candidate-b-auto / 等）
       - P2 长尾 3
       - P3 视觉/文档 3
     - manual README 末尾新增 GAPS.md 索引行
     - verify:manual-coverage PASS（15 admin 路由 ↔ 15 P-* 1:1）
   - **新发现的 gap**：#G-dashboard-runall（dashboard 全站全量按钮未跟进双重 confirm） / #G-moderation-batch-ui（批量审核 UI 缺失但端点已存在） / #G-merge-candidate-b-auto（审核台深链 candidate_b 未自动注入 Merge）等 — 全部登记 GAPS.md，未在本卡修复（独立 follow-up）
   - **工时估算**：0.3-0.4w / 实际 ~0.35w（4 份 + GAPS 单 commit）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（消费 VideoPicker / 不动 admin-ui 公开 API）
   - **完成备注**：
     - MergeClient.tsx：import VideoPicker + PickerVideoItem + videoPickerFetcher；candidate_a banner 下渲染 DirectMergeWorkspace 子组件（仅当 candidate_a 存在时）
     - 新增 DirectMergeWorkspace 子组件（~75 行）：AdminCard 容器 + 标题 + 说明 + VideoPicker label「候选 B（被合并到 A）」+ 「立即合并」AdminButton
     - handleMerge：B 必选 + B !== A 校验 + window.confirm 二次确认 + mergeVideos({ sourceVideoIds: [B.id], targetVideoId: A.id }) + 成功 toast + 调用 onMergeSuccess（清 banner）
     - 错误：复用 describeError(err, 'merge')；B === A 时按钮 disabled
     - MergeDirectWorkspace.test 3 用例 PASS（工作区渲染 + 选 B 合并 + B===A disabled）
     - W4 §2.2 完整填写（视频库 → Merge 页直接合并 8 步流程含撤销路径）
     - typecheck + lint + verify:manual-coverage 全 PASS
   - **关联问题**：CHG-SN-8-08 follow-up；用户问题 #7 合并入口的端到端工作流闭合
   - **工时估算**：0.15w / 实际 ~0.15w
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（仅前端 UI / 不动 admin-ui 公开 API）
   - **完成备注**：
     - 新建 `apps/server-next/src/app/admin/_client/UserMenuActionModal.tsx`（~210 行 / 单组件根据 type prop 切 3 视图：profile / preferences / help）
     - profile：显示当前 user.displayName / email / role / id + 「编辑（筹备中）」disabled
     - preferences：复用 ThemeProvider 暴露主题切换 + 「品牌 / 语言 / 密度」筹备中占位
     - help：W1-W5 工作流速查 + 9 高频快捷键 + `docs/manual/` 完整说明书入口
     - admin-shell-client.tsx：增 actionModalType state + useToast；handleUserMenuAction 3 case → setActionModalType；switchAccount → toast「多账号切换在 M-SN-N」
     - UserMenuActionModal.test 5 用例 PASS（null / profile / preferences toggle / help / close）
     - typecheck + lint + verify:manual-coverage PASS
     - 00-roles-and-permissions.md §4 用户菜单 6 项 action 矩阵填写
   - **关联问题**：用户问题 #13「用户菜单项目多不可用」**完全闭合**（H2 零死按钮）
   - **工时估算**：0.15w / 实际 ~0.15w

40. **CHG-SN-8-FUP-USERS-BATCH-BAN-EP** · ADR-143 实施（POST batch-ban + batch-unban 2 endpoint）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-143 既定决策 / 复用全链路）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-143 已 Opus A PASS commit de20a302）
    - **依赖**：ADR-143 ✅（commit de20a302）+ USERS-BAN-INV/AUDIT 全链路
    - **范围**：4 文件 — 2 route handler + 2 lib + UsersListClient PageHeader tooltip 更新 + 16 单测；零新 actionType / 零 R-MID-1 触发
    - **不在范围**：前端 batch mode toggle UI（独立 CHG-SN-8-FUP-USERS-BATCH-BAN-UI）/ N1-143-1 并行 pipeline
    - **关联 GAP**：#G-users-batch-ban ⚠️+🔄 → ✅ 后端端点闭合（前端 UI 留 FUP-UI）
    - **完成备注**：
      - routes/admin/users.ts 加 POST batch-ban + batch-unban：admin auth + zod max 50 ids + dedupe Set + per-id for-loop + 5 类 skip（self/missing/admin/already-banned/dedup）+ Redis fire-and-forget per-id + R-MID-1 user.ban/unban audit fire-and-forget per-id + 三计数 response
      - lib batchBanUsers/batchUnbanUsers 2 封装
      - 16 新单测 PASS（覆盖所有 skip guards + 三态 422 + Redis + audit 内容 + 403）
      - 附带修：admin-shell-client.test 前序卡 ADR-142 漂移（moderator 可见 /admin/audit）
      - 完整 unit 4593/4593 PASS / typecheck PASS / lint PASS / verify advisory PASS
      - GAPS.md + P-users.md §4.1 同步
    - **工时估算**：~0.3w（实际 ~0.5w 含前序漂移修复）

39. **CHG-SN-8-FUP-USERS-BATCH-BAN-ADR** · ADR-143 起草（用户批量封禁端点协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-143-1..6 完整 / 6 batch endpoint 仓内实证 / 16 测试 surface / 4 风险 / 1 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 B 对称双端点 + best-effort per-id + 三计数 + max 50 + 5 类 skip + Redis fire-and-forget per-id + 复用 user.ban actionType（零 R-MID-1 触发）+ 零新 ErrorCode + 零 schema；与仓内 6 batch endpoint 范式 100% 对齐；端点实施独立卡 CHG-SN-8-FUP-USERS-BATCH-BAN-EP 依赖 ADR-143 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-143 11 节完整正文；6 D-N 决策 + 7 维 trade-off + 16 测试 surface + 4 风险 + 1 N1
      - 6 条 D-143-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 104 → 110 全闭环
      - GAPS.md #G-users-batch-ban ⚠️ → ⚠️+🔄；P-users §4.1 更新
      - 仓内实证：arch-reviewer 完整 grep 6 现有 batch endpoint（moderation/submissions/videos/staging）；命名 + 部分失败 + max + audit 范式 100% 对齐
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-143-1（串行→并行 pipeline 优化）登记按需评估
    - **关联 GAP**：#G-users-batch-ban ⚠️ → ⚠️+🔄
    - **工时估算**：~0.2w / 实际 ~0.2w

38. **CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP** · ADR-142 实施（audit endpoints moderator self-scope）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-142 已 Opus A− PASS commit 0ded3c38）
    - **依赖**：ADR-142 ✅（commit 0ded3c38）+ AUDIT-NAV-HIDE（commit 3277ee7b）
    - **完成备注**：
      - 3 GET 端点守卫 requireRole(['admin']) → (['moderator', 'admin'])；list handler Route 层强制覆盖 actorId 防 bypass；detail handler 所有权校验 404 防枚举
      - ADMIN_ONLY_HREFS Set 移除 /admin/audit（3→2 项）；moderator 可见审计 nav
      - AuditClient 加 readUserRoleFromCookie + isModerator 推断；info banner (state-info 样式) + actorId filter 隐藏 + subtitle 分支
      - rollback 维持 adminOnly 不变（ADR-138 D-138-2）
      - audit-self-scope.test 12/12 PASS（按 ADR-142 §9 完整覆盖）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - GAPS #G-audit-self-scope ⚠️+🔄 → ✅ 完全闭合；P-audit §0 适用角色字段重写
      - 基础设施零改动（Service / Query 完全未触）
    - **关联 GAP**：#G-audit-self-scope ⚠️+🔄 → ✅ 完全闭合
    - **工时估算**：~0.2-0.3w / 实际 ~0.2w

37. **CHG-SN-8-FUP-AUDIT-SELF-SCOPE-ADR** · ADR-142 起草（audit endpoints self-scope 权限协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A− PASS**（D-142-1..6 完整 / 3 方案 8 维度 trade-off / 4 endpoint 各自策略 + 详情 404 防枚举 / Route 层注入防 bypass + 伪代码 / 6 文件降级清单 / 12 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 B（admin + moderator self-scope）+ Route 层强制覆盖 actorId + 详情端点 404 防枚举 + 前端 nav 恢复 + info banner + 零 schema + 零新 ErrorCode + 复用 idx_admin_audit_log_actor_created；端点 1-3 GET 扩 moderator，端点 4 POST rollback 维持 admin only（ADR-138 D-138-2）；端点实施独立卡 CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP 依赖 ADR-142 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-142 11 节完整正文；6 D-N 决策 + 3 方案 trade-off + 4 endpoint 策略 + Route 层注入防 bypass 设计含伪代码 + 6 文件 R-MID-1 降级清单 + 12 测试 surface + 4 风险 + 2 N1
      - 6 条 D-142-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 98 → 104 全闭环
      - GAPS.md #G-audit-self-scope ⚠️ → ⚠️+🔄；P-audit §0 适用角色字段重写（admin + moderator self-scope 待 EP）
      - 重要发现：基础设施全部就绪（Query 层 actorId 参数已支持 + Service 层透传 + 索引已就位）；EP 实施仅 Route 层 + 前端少量改动
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-142-1（moderator dashboard widget）/ N1-142-2（ipHash strip GDPR）登记按需评估不立 follow-up
    - **关联 GAP**：#G-audit-self-scope ⚠️ → ⚠️+🔄（消费层 ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审 + decisions.md ~600 行落盘）

36. **CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS** · ADR-138 N1-138-1 P1 闭合（注册 video.approve + video.reject_labeled handler）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：CHG-SN-8-FUP-AUDIT-ROLLBACK-EP ✅（commit c8a2cb33）
    - **完成备注**：
      - 新增 2 reverse_handler 不调 ModerationService.reopen / transitionVideoState（避免嵌套事务）；同事务 client 直接 UPDATE SQL
      - ROLLBACK_HANDLER_REGISTRY 初始化含 2 项 Map（之前为空）
      - UNSUPPORTED Set 移除 video.approve + video.reject_labeled（32→30）；video.reopen 单独保留（反向语义模糊）
      - 顺手修 TARGET_KIND_TABLE_MAP home_module softDeleteColumn 'deleted_at' → null（schema 实证 hard delete / migration 050 无 deleted_at 列）
      - audit-rollback.test 扩 2 用例 PASS（#22 video.approve / #23 video.reject_labeled handler 都 bypass 通用路径）；修 #3 home_module.update 断言 → null；23/23 PASS
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - ADR-138 §11 N1-138-1 P1 状态「按需启动」→「✅ 已闭合」+ P2 推迟说明 + P3 仍待
    - **关联 N1**：ADR-138 §11 N1-138-1 P1 ✅ / P2 推迟（home_modules hard delete schema）/ P3 待独立 ADR
    - **工时估算**：~0.15w / 实际 ~0.15w

35. **CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE** · ADR-138 N1-138-2 闭合（rollback 加 force 参数跳过 stale）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：CHG-SN-8-FUP-AUDIT-ROLLBACK-EP ✅（commit c8a2cb33）
    - **完成备注**：
      - 端点 RollbackBodySchema z.object({ force?: boolean }).default({}) + POST handler 解析 body
      - AuditRollbackService.rollback options 第 3 参数 + rollbackGeneric force 参数 + 跳过 stale 检测
      - audit log payload spread auditMeta 含 force flag 供追溯审计
      - audit-rollback.test 扩 2 用例 PASS（force 跳 stale + audit flag / force 不绕 UNSUPPORTED）；21/21 PASS
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - ADR-138 §11 N1-138-2 状态「待运营反馈」→「✅ 已闭合」
      - 向后兼容：空 body 仍合法（旧调用零回归）；force 仅跳过 stale，其它守卫保持
    - **关联 N1**：ADR-138 §11 N1-138-2（force 强制覆盖参数） → ✅ 闭合
    - **工时估算**：~0.1w / 实际 ~0.1w

34. **CHG-SN-8-FUP-USERS-BAN-AUDIT** · user.ban + user.unban audit 补齐（R-MID-1 第 20 次系统化）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：USERS-EDIT-EP migration 069 + USERS-BAN-INV（commit 4301d8e6）
    - **完成备注**：
      - R-MID-1 7 文件 + 1 新单测 = 8 文件改动
      - admin-moderation.types union + AuditLogService ACTION_TYPES + enums set-equal + coverage REQUIRED+PAYLOAD_REQUIRED 同步加 user.ban + user.unban
      - ban handler 加 auditSvc.write（before/after.banned_at null/NEW）
      - unban handler 先 findAdminUserById 取 before snapshot + 顺手加 404 兜底 + audit.write（before/after.banned_at OLD/null）
      - admin-users-ban-audit.test 4 用例 PASS（ban payload / unban payload / ban admin 403 / unban 404）
      - 共 121/121 PASS（audit-log-coverage 97 自动验证 R-MID-1 守卫 + ban-audit 4 + ban-inv 4 + admin-users 12 + enums 4）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - P-users §3.4 audit 追溯标 ✅；闭合 ADR-139 N1-139-2 audit follow-up
    - **关联**：ADR-139 N1-139-2 audit 补齐路径完全闭环
    - **工时估算**：~0.15w / 实际 ~0.15w

33. **CHG-SN-8-FUP-USERS-BAN-INV** · ADR-139 N1-139-2 闭合（ban 同模式 session invalidate）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（N1 派生）
    - **依赖**：USERS-ROLE-INV-EP ✅（commit c2594fa7）
    - **完成备注**：
      - banUser SQL 加 SET role_changed_at = NOW() + RETURNING role_changed_at；返回类型补字段
      - ban handler 写 Redis user:rca:{id} EX 900 + 防御性 if 守卫 + 404 兜底新增
      - admin-users-ban-inv.test 4 用例 PASS（SQL / Redis 写入 / admin 403 / 404 边界）
      - admin-users.test 12/12 不变（防御性守卫保证 mock 兼容）；admin-users-role-change/edit 测试同步 PASS（共 46/46）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - ADR-139 §11 N1-139-2 状态「登记」→「✅ 已闭合」含语义 trade-off 说明
      - P-users §3.4 封禁段重写（session 即时失效说明 + audit follow-up）
      - audit 补齐独立 follow-up CHG-SN-8-FUP-USERS-BAN-AUDIT 按需启动
    - **关联 N1**：ADR-139 §11 N1-139-2（ban/unban 同模式扩展） → ✅ 闭合
    - **工时估算**：~0.15w / 实际 ~0.15w

32. **CHG-SN-8-FUP-DASH-ACTIVITY-DISPLAY-NAME** · ADR-141 N1-141-1 闭合（targetDisplayName 扩展）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-141 N1-141-1 既定决策 / 接口向后兼容）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（N1 范围扩展 / 无新端点 / 无 ADR）
    - **依赖**：CHG-SN-8-FUP-DASH-ACTIVITY-LIVE ✅（commit 27833561）
    - **完成备注**：
      - DashboardActivityRow 追加 targetDisplayName?: string | null 可选字段（向后兼容）
      - enrichTargetDisplayNames helper：TARGET_DISPLAY_MAP 4 项映射（video.title / user.username / crawler_site.name / home_module.slot）；按 target_kind 分组 Promise.all 并行 IN 查询 + 去重 + 单组失败兜底
      - route handler enrich + 缓存对 enriched 结果（缓存行为不变）
      - 前端 mapActivityRow 文案：`${actionLabel}「${displayName ?? shortId ?? ''}」`；formatTargetSuffix 三层 fallback
      - dashboard-activities.test 扩 2 用例（#11 video.title 拼接 / #12 target 不存在 fallback）；#10 缓存断言更新为 2 次 DB；12/12 PASS
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS；dashboard 组前端 60/60 PASS
      - ADR-141 §11 N1-141-1 状态从"待登记"→"✅ 已闭合"含完整实施摘要
    - **关联 N1**：ADR-141 §11 N1-141-1（targetDisplayName 扩展） → ✅ 闭合
    - **工时估算**：~0.15w / 实际 ~0.18w（含文档同步）

31. **CHG-SN-8-FUP-DASH-ACTIVITY-LIVE** · ADR-141 实施（dashboard activities 真端点 + 前端 mock → live）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-141 既定决策）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-141 已 Opus A PASS commit 4de065f4）
    - **依赖**：ADR-141 ✅（commit 4de065f4）
    - **完成备注**：
      - migration 070 idx_admin_audit_log_created (created_at DESC) 幂等
      - DashboardActivityRow 类型 + listDashboardActivities query（LEFT JOIN users + ORDER BY created_at DESC, id DESC + LIMIT）
      - GET /admin/dashboard/activities handler + zod limit 1-50 default 10 + Map<number, {data, expiry}> 60s TTL 缓存
      - getDashboardActivities lib fetcher + 新 i18n audit-action-labels.ts 37 项全集 + deriveActivitySeverity helper
      - dashboard-data.ts buildDashboardStats 加 activitiesRows 第 3 参数 + mapActivityRow + formatRelative helpers；两 return 路径派生 activities + activitiesDataSource live/mock
      - DashboardClient.tsx 新增 activities state + Promise.all 拉真端点 + fallback null → mock
      - dashboard-activities.test 10/10 PASS（含缓存命中测试 vi.resetModules 隔离）
      - 全 unit 4547/4547 PASS（+10 / 0 回归）；typecheck + lint + verify:adr-contracts（verify-endpoint-adr 176→177 含 GET activities 自动对齐 / verify-adr-d-numbers 98 全闭环）+ verify:manual-coverage PASS
      - GAPS.md #G-dashboard-activities-mock ⚠️+🔄 → ✅ 完全闭合；P-dashboard §7 FAQ 重写（已实装 + fallback 路径）
      - N1-141-1 targetDisplayName / N1-141-2 severity 后端化登记按需启动
    - **关联 GAP**：#G-dashboard-activities-mock ⚠️+🔄 → ✅ 完全闭合
    - **工时估算**：~0.3w / 实际 ~0.3w

30. **CHG-SN-8-FUP-DASH-ACTIVITY-ADR** · ADR-141 起草（dashboard activities 真端点协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-141-1..6 完整 / 3 方案 6 维度 trade-off / 索引 4 项分析 + 新索引代价评估 / 10 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮起草；选方案 C（admin_audit_log 直接派生 + Service 层 60s TTL 缓存）+ 新 idx_admin_audit_log_created (created_at DESC) 索引 + actionType 中文 label 前端 i18n 承担（37 项扩展） + admin only + 单 limit max 50 + 零新 ErrorCode；端点实施独立卡 CHG-SN-8-FUP-DASH-ACTIVITY-LIVE 依赖 ADR-141 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-141 11 节完整正文；6 D-N 决策 + 3 方案 trade-off + 索引 4 项分析 + 5 文件 R-MID-1 降级清单 + 10 测试 surface + 4 风险 + 2 N1
      - 6 条 D-141-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 92 → 98 全闭环
      - GAPS.md #G-dashboard-activities-mock ⚠️ → ⚠️+🔄；P-dashboard §7 FAQ 重写（含 ADR-141 决策摘要）
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-141-1（targetDisplayName 扩展）→ CHG-SN-8-FUP-DASH-ACTIVITY-DISPLAY-NAME 按需启动
      - N1-141-2（severity 后端化）→ 按需评估不立 follow-up
      - **评级 A**（最高级）：GET 只读端点设计简洁清晰；所有决策自洽 + trade-off 完整 + 索引代价实证
    - **关联 GAP**：#G-dashboard-activities-mock ⚠️ → ⚠️+🔄（消费层 ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.2w / 实际 ~0.2w

29. **CHG-SN-8-FUP-AUDIT-ROLLBACK-EP** · ADR-138 实施（audit 通用回滚端点 + R-MID-1）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-138 既定决策）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-138 已 Opus PASS commit e446a17c）
    - **依赖**：ADR-138 ✅（commit e446a17c）+ USERS-EDIT-EP migration 069
    - **完成备注**：
      - api-errors.ts +3 码（AUDIT_ROLLBACK_UNSUPPORTED 422 / STALE 409 / SCHEMA_DRIFT 422）；15 → 18 码
      - admin-moderation.types union +1 + AuditLogService ACTION_TYPES +1（system.audit_rollback）
      - AuditRollbackService 新建（核心算法 + 9 target_kind 字段白名单 + 32 项 UNSUPPORTED Set + ROLLBACK_HANDLER_REGISTRY 扩展点 + 事务管理 + isJsonEqual stale 检测）
      - DB queries +3：rollbackAuditLogTarget（动态 SET + quoteIdent 防注入）+ selectCurrentRowForRollback（stale 检测）+ insertAuditLogInTransaction（事务原子性）
      - POST /admin/audit/logs/:id/rollback handler（AppError 域异常分发；PG 23505→409 STALE / 42703→422 SCHEMA_DRIFT）
      - R-MID-1 第 19 次系统化（enums set-equal + coverage REQUIRED + PAYLOAD_REQUIRED 同步）
      - audit-rollback.test 新建 19 用例 PASS；全 unit 4537/4537 PASS（+21 / 0 回归）
      - typecheck + lint + verify:adr-contracts（verify-endpoint-adr 175→176 / verify-adr-d-numbers 92 闭环）+ verify:manual-coverage PASS
      - GAPS.md #G-audit-rollback-universal ⚠️+🔄 → ✅ 完全闭合；P-audit §3.4 重写（含 8 失败场景 / 11 target_kind 白名单 / R-MID-1 第 19 次）
      - N1-138-1（reverse_handler 渐进注册）/ N1-138-2（force 参数）/ 消费层升级 — 3 follow-up 登记按需启动
    - **关联 GAP**：#G-audit-rollback-universal ⚠️+🔄 → ✅ 完全闭合
    - **工时估算**：0.5-0.8w / 实际 ~0.5w

28. **CHG-SN-8-FUP-AUDIT-ROLLBACK-ADR** · ADR-138 起草（audit 通用回滚端点协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D-138-1..6 完整 + 4 方案 trade-off 8 维度 + 8 失败场景处理 + 字段白名单 3 示例 + 24 项 UNSUPPORTED + 19 测试 surface + 5 风险 + 2 N1）
    - **方案选型**：spawn arch-reviewer Opus 1 轮起草；选方案 D 混合策略（JSONB diff 反向 UPDATE + reverse_handler 注册扩展 + UNSUPPORTED Set 24 项）；admin only + 高敏感 6 actionType 二次确认；R-MID-1 第 19 次（system.audit_rollback 复用 system targetKind）；3 新 ErrorCode（UNSUPPORTED 422 / STALE 409 / SCHEMA_DRIFT 422）；字段白名单防 password_hash/role 注入；端点实施独立卡 CHG-SN-8-FUP-AUDIT-ROLLBACK-EP 依赖 ADR-138 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-138 11 节完整正文；6 D-N 决策 + 4 方案 trade-off + 8 失败场景 + 字段白名单 3 示例 + 11 target_kind→table 映射 + 24 项 UNSUPPORTED 完整清单 + ~12 项可自动回滚 + 10 文件 R-MID-1 清单 + 19 测试 surface + 5 风险 + 2 N1
      - 6 条 D-138-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 86 → 92 全闭环
      - GAPS.md #G-audit-rollback-universal ⚠️ → ⚠️+🔄；P-audit §3.4 通用端点段重写（方案 D / 字段白名单 / 3 ErrorCode / R-MID-1 第 19 次 + 2 N1）
      - 重要发现：USERS-EDIT-EP migration 069 已修 admin_audit_log CHECK 含 system / user — 本 ADR 的 system.audit_rollback actionType + system targetKind 可直接复用，无 schema 阻塞
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-138-1（reverse_handler 渐进注册 P1/P2/P3）→ CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS 按需启动
      - N1-138-2（force 强制覆盖参数）→ CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE 待运营反馈触发
    - **关联 GAP**：#G-audit-rollback-universal ⚠️ → ⚠️+🔄（消费层 ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审 + decisions.md ~600 行落盘）

27. **CHG-SN-8-FUP-USERS-EDIT-EP** · ADR-140 实施（admin 改邮箱 + 编辑资料 + R-MID-1 + audit CHECK 历史漂移修复）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-140 既定决策）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-140 已 Opus PASS commit 2523a920）
    - **依赖**：ADR-140 ✅（commit 2523a920）+ USERS-ROLE-INV-EP（commit c2594fa7）
    - **完成备注**：
      - 2 migration（068 users.display_name VARCHAR(50) + 069 admin_audit_log CHECK 6→12 含 user + 5 历史漂移修复）
      - DB queries: updateUserEmail + updateUserProfile（动态 SET + COALESCE 模式）+ findUserByEmailExcludingId（唯一性预验）+ mapUser/findAdminUserById/listAdminUsers 加 display_name
      - User 类型加 displayName?: string | null（向后兼容）
      - R-MID-1 第 18 次系统化（user.email_change + user.profile_update 2 actionType 单卡落地）
      - 2 PATCH route handler（admin 守卫 + 404/403/409/422 + Service 层唯一性 + DB UNIQUE race 23505 兜底 + audit fire-and-forget + partial before/after payload）
      - 前端 EditEmailModal + EditProfileModal + columns 2 按钮（admin disabled + tooltip + 列宽 240→340）
      - 测试 22 后端 + 12 前端 = 34 新单测 PASS；全 unit 4516/4515 PASS (+38 / 1 pre-existing flaky 与本卡无关)
      - typecheck + lint + verify:manual-coverage + verify:adr-contracts (verify-endpoint-adr 173→175 / verify-adr-d-numbers 86 全闭环) PASS
      - **顺手修复 USERS-ROLE-INV-EP 生产可用性 BLOCKER**：migration 069 补 admin_audit_log CHECK 至 12 种 target_kind，消除 'user' INSERT reject 风险
      - GAPS.md #G-users-edit-profile ⚠️+🔄 → ✅ 完全闭合（reset-pwd + ADR + EP 三段路径全 PASS）
      - P-users §4.2 完整重写；N1-140-1（邮件升级）/ N1-140-2（email session inv）登记 follow-up
    - **不在范围**：N1-140-1 邮件验证流程 / N1-140-2 email session invalidate — 按需启动
    - **关联 GAP**：#G-users-edit-profile 🔄 → ✅ 完全闭合
    - **工时估算**：0.55-0.65w / 实际 ~0.55w

26. **CHG-SN-8-FUP-USERS-ROLE-INV-EP** · ADR-139 实施（角色变更 session invalidate 完整端点）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-139 既定决策直接实施）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（按 ADR-139 D-139-1..8 既定决策）
    - **依赖**：ADR-139 ✅（commit 83e49fbb）
    - **完成备注**：
      - migration 067_users_role_changed_at.sql（幂等 + COMMENT）
      - DB queries: updateUserRole SET role_changed_at = NOW() + RETURNING；mapUser/DbUserRow 加 roleChangedAt
      - User.roleChangedAt 类型扩展（向后兼容 optional）
      - ErrorCode ROLE_CHANGED 加入 ERRORS 字典（14 → 15 码）
      - R-MID-1 7 文件框架（actionType union + AuditLogService ACTION_TYPES + enums set-equal test + coverage REQUIRED/PAYLOAD_REQUIRED + route 调用 + payload 内容断言 + changelog）
      - UserService.refresh: 新增 RoleChangedError + iat 比对；auth.ts route catch 区分 → 401 ROLE_CHANGED
      - middleware resolveUser 重构为 ResolveResult 三态 + Promise.all 并行查 blacklist + user:rca
      - PATCH /admin/users/:id/role: 增 Redis set fire-and-forget EX 900 + auditSvc.write payload 含 before/after role + roleChangedAt
      - 前端 api-client.ts: peekErrorCode + handleRoleChanged → forced logout + redirect /login?reason=role_changed
      - admin-users-role-change.test 8/8 PASS（PATCH + Redis + audit payload / middleware 3 用例 / refresh 3 用例）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4478/4478 PASS（+8 / 0 回归）
      - 审计发现：image_health.* pre-existing 漂移（ADR-140 D-140-5 已识别），本卡守 ADR-140 EP 范围不顺手修
      - N1-139-1（DB fallback）评估后选不加；N1-139-2（ban/unban）登记独立 follow-up CHG-SN-8-FUP-USERS-BAN-INV
    - **不在范围**：e2e（#11 测试 surface 推迟 advisory）/ ban-inv（N1-139-2 独立卡）/ cache miss DB fallback（实施评估后选不加，保持 ADR-139 §D-139-7 默认放行）
    - **关联 GAP**：#G-users-role-session-invalidate 🔄 → ✅ 完全闭合
    - **工时估算**：0.4-0.6w / 实际 ~0.45w

25. **CHG-SN-8-GAPS-USERS-BATCH-BAN-BTN** · 用户管理「批量封禁」disabled 入口（#G-users-batch-ban 消费层）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（纯前端 visual / 同 audit-rollback disabled 范式）
    - **方案选型**：disabled 按钮 + tooltip（同 P-videos 添加视频 / audit-rollback 未支持类型 / H2 死按钮豁免）；位 PageHeader actions 末尾；后端 batch endpoint follow-up CHG-SN-8-FUP-USERS-BATCH-BAN-EP
    - **完成备注**：
      - UsersListClient PageHeader 邀请用户 与 刷新 之间插 disabled「批量封禁」按钮 + title tooltip 指 GAPS + follow-up
      - UsersListClient.test 扩 2 用例 PASS（#4 disabled + 文案 / #5 tooltip 指向 GAPS + follow-up）；总 5/5 PASS
      - GAPS.md #G-users-batch-ban ⬜ → ⚠️；登记 CHG-SN-8-FUP-USERS-BATCH-BAN-EP（参 ModerationBatch 已闭合范式可直接复用）
      - P-users §4.1 重写（含 disabled 入口说明）
      - typecheck + lint + verify:manual-coverage PASS
    - **关联 GAP**：#G-users-batch-ban（P3） ⬜ → ⚠️
    - **工时估算**：~0.05w / 实际 ~0.07w

24. **CHG-SN-8-GAPS-WEBHOOK-NOT-IMPL** · Webhook 通知「字段存但回调未实装」警示（#G-settings-webhook-impl 消费层）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（纯前端 visual + 文档）
    - **方案选型**：纯视觉警示（同 PRESET-LOCAL-BADGE / DASH-ACTIVITY 范式）— card 顶部 warn banner 明示「字段存储有效但 webhook 触发未实装」；字段保留以便实装后无迁移；后端实装 follow-up CHG-SN-8-FUP-WEBHOOK-IMPL
    - **完成备注**：
      - 实证：apps/api + apps/worker grep `webhookEnabled` / `sendWebhook` 零匹配 — 字段存但永远不发
      - NotificationsTab webhook card subtitle 改 ⚠️ 标记；card 顶部加 warn banner（state-warning-bg + 「不会向该 URL 发送任何 HTTP POST」+ 指向 GAPS）
      - NotificationsTab.test 扩 2 用例 PASS（#6 banner 渲染 + 关键文案 / #7 banner 含 #G-settings-webhook-impl + CHG-SN-8-FUP-WEBHOOK-IMPL 指向）；总 7/7 PASS
      - GAPS.md #G-settings-webhook-impl ⬜ → ⚠️；登记 CHG-SN-8-FUP-WEBHOOK-IMPL（5 决策点设计草案：事件订阅 / HMAC / 重试 / audit / worker job 派发）
      - P-settings §3.7 完整重写（含视觉警示 + 后端 follow-up）
      - typecheck + lint + verify:manual-coverage PASS
    - **关联 GAP**：#G-settings-webhook-impl（P3） ⬜ → ⚠️
    - **工时估算**：~0.05w / 实际 ~0.08w（含文档同步）

23. **CHG-SN-8-GAPS-PRESET-LOCAL-BADGE** · FilterPreset 「仅本地」视觉警示（#G-moderation-preset-team 消费层）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（纯前端 visual + i18n）
    - **方案选型**：纯视觉警示（同 DASH-ACTIVITY mock 警示范式）— popover header 加「仅本地」chip + tooltip 解释；零 admin-ui contract / 零端点 / 零 schema；团队共享需后端表 + ADR + Opus 独立 follow-up CHG-SN-8-FUP-PRESET-TEAM-EP
    - **完成备注**：
      - i18n moderation.ts preset 块加 localOnlyBadge + localOnlyTooltip 2 key
      - FilterPresetPopover header 拆 flex 布局 + warn chip（state-warning-bg/fg + cursor: help + title tooltip 指 GAPS）
      - 新建 FilterPresetPopoverBadge.test 3/3 PASS（chip 渲染 / tooltip 含 localStorage + 未跨账号同步 + #G-moderation-preset-team / open=false 不渲染）
      - 实证修正：use-filter-presets.ts 是 localStorage 不是 sessionStorage；P-moderation §3.4 + §7 FAQ + GAPS 三处同步修正
      - GAPS.md #G-moderation-preset-team ⬜ → ⚠️；登记 CHG-SN-8-FUP-PRESET-TEAM-EP（含 user_filter_presets 表 + 4 端点 + scope toggle 设计草案）
      - typecheck + lint + verify:manual-coverage PASS
    - **关联 GAP**：#G-moderation-preset-team（P3） ⬜ → ⚠️
    - **工时估算**：~0.05w / 实际 ~0.08w（含文档同步修正）

22. **CHG-SN-8-FUP-USERS-EDIT-ADR** · ADR-140 起草（admin 改用户邮箱 + 显示名端点协议）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D-140-1..6 完整 + 3 方案 trade-off + 22 测试 surface + 4 风险 + 2 N1）
    - **方案选型**：spawn arch-reviewer Opus 1 轮起草 ADR-140；选方案 B 双端点（PATCH /admin/users/:id/email + /profile）；email 直接生效（邮件服务零基础设施实证）；admin 互改保护沿用 4 端点一致守卫；R-MID-1 7 文件框架触发；端点实施独立卡 CHG-SN-8-FUP-USERS-EDIT-EP 依赖 ADR-140 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-140 11 节完整正文（~370 行）；6 D-N 决策 + 3 方案 trade-off 表 + 双端点契约 + 2 migration（users 加 display_name + audit_log CHECK 6→12 历史漂移补齐）+ 22 测试 surface + R-MID-1 7 文件清单
      - D-140-1（双端点）/ D-140-2（直接生效 + 邮件服务零基础设施实证）/ D-140-3（displayName VARCHAR(50) + 正则字符集）/ D-140-4（admin 互改保护沿用 role === 'admin' 守卫）/ D-140-5（R-MID-1 触发 + 2 actionType + 1 targetKind）/ D-140-6（关联 ADR 8 项 + Schema 2 列变更）
      - 6 条 D-140-N 在本卡 changelog 条目完整闭环；verify-adr-d-numbers 从 80 → 86 全闭环
      - GAPS.md #G-users-edit-profile ⚠️ → ⚠️ + 🔄（reset-pwd ✅ 1/3 + ADR 2/3 + 实施 follow-up CHG-SN-8-FUP-USERS-EDIT-EP 3/3 待立）；P-users §4.2 同步更新
      - 重要发现：admin_audit_log CHECK 约束仅 6 种 target_kind（TS 类型已扩展到 11 种漂移），实施卡顺带一次性补齐至 12 种
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-140-1（邮件服务上线后升级路径）/ N1-140-2（email 变更后 session invalidate）登记
    - **关联 GAP**：#G-users-edit-profile（P2） ⚠️ → ⚠️ + 🔄 ADR 已起草（reset-pwd 1/3 + ADR 2/3 + 实施 follow-up 3/3）
    - **工时估算**：~0.2w / 实际 ~0.3w（含 Opus 1 轮评审 + decisions.md ~370 行落盘）

21. **CHG-SN-8-FUP-USERS-RESET-PWD** · 用户管理「重置密码」前端补齐（#G-users-edit-profile 消费层 1/3）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（消费层；后端已存在 POST /admin/users/:id/reset-password）
    - **方案选型**：reset-pwd 后端 ready 走纯消费层；2 态 Modal（idle confirm + success 显示新密码 + 复制按钮 + warn 一次性 / 关闭后不可复看）；admin 目标 disabled（与后端 403 一致）；改邮箱 / 改显示名（2 新端点）需 ADR + Opus，独立 follow-up CHG-SN-8-FUP-USERS-EDIT-ADR
    - **完成备注**：
      - api.ts 加 `resetUserPassword(id) → { newPassword }` lib 封装
      - 新建 ResetPasswordModal.tsx（2 态 / 含错误内联 / 复制 navigator.clipboard 失败降级）
      - columns.tsx 加 onResetPassword + 「重置密码」xs ghost btn（admin disabled + tooltip）；列宽 170 → 240
      - UsersListClient 接 modal state + handler
      - ResetPasswordModal.test 5/5 PASS；users 6 文件 41/41 PASS；全 unit 4460 PASS
      - GAPS.md #G-users-edit-profile ⬜ → ⚠️（reset-pwd 1/3 闭合）；登记 CHG-SN-8-FUP-USERS-EDIT-ADR follow-up
      - P-users §3.5 完整新建「重置密码」章节；§4.2 改名 + 标 reset-pwd 已闭合
      - typecheck + lint + verify:manual-coverage PASS
    - **关联 GAP**：#G-users-edit-profile（P2） ⬜ → ⚠️（reset-pwd 1/3 闭合，email + displayName 待 ADR）
    - **工时估算**：~0.15w / 实际 ~0.18w

20. **CHG-SN-8-FUP-USERS-ROLE-INV-ADR** · ADR-139 起草（角色变更 session invalidate 协议）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D-139-1..8 完整 + 4 方案 trade-off + 12 测试 surface + 4 风险 + 2 N1）
    - **方案选型**：用户裁定 — 仅 ADR 卡（不实施 端点 / Service / migration / 前端）；端点实施独立卡 CHG-SN-8-FUP-USERS-ROLE-INV-EP 依赖 ADR-139 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-139 11 节完整正文（~370 行）；选方案 B（users.role_changed_at TIMESTAMPTZ + access token iat 校验）；权限穿越窗口最大 15min → 0
      - D-139-1（方案 B 选型）/ D-139-2（401 ROLE_CHANGED + 不静默续约）/ D-139-3（refresh 拒绝 + 强制重登）/ D-139-4（user_role cookie 靠 logout 清除）/ D-139-5（migration ALTER 幂等 + 回滚 SQL）/ D-139-6（R-MID-1 降级 — 实施卡补 user.role_change actionType + user targetKind）/ D-139-7（Redis 缓存 user:rca:{id} EX 900 + 与 blacklist Promise.all 并行 + cache miss 放行）/ D-139-8（admin 自残保护现状已充分）
      - 8 条 D-139-N 在本卡 changelog 条目完整闭环；verify-adr-d-numbers 从 72 → 80 全闭环
      - GAPS.md #G-users-role-session-invalidate ⬜ → 🔄 ADR 已起草；P-users §3.3 + §7 FAQ 同步更新
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-139-1（cache miss DB fallback）→ 实施卡评估；N1-139-2（ban/unban 同类穿越）→ 独立 follow-up CHG-SN-8-FUP-USERS-BAN-INV
    - **关联 GAP**：#G-users-role-session-invalidate（P2 安全） ⬜ → 🔄 ADR 已起草
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审 + decisions.md ~370 行落盘）

19. **CHG-SN-8-GAPS-AUDIT-NAV-HIDE** · 系统管理组对 moderator 消费层 nav 过滤（#G-audit-self-scope 消费层补齐）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（不动 admin-ui 公开 API；消费层 ADMIN_NAV 按 role 过滤）
    - **方案选型**：用户裁定 Path A — 仅消费层补齐；moderator 隐藏「系统管理」组 3 死链（用户管理 / 站点设置 / 审计日志）；不起 ADR / 不改后端；完整 self-scope（admin 看全量 + moderator 看自己 audit）走独立后端 follow-up CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP
    - **完成备注**：
      - 实证：后端 `/admin/audit/*` + `/admin/users` + `/admin/system/settings` 全 adminOnly；前端 sidebar 对 moderator 全显 → 死链 403
      - admin-shell-client.tsx 新增 `filterNavForRole(nav, role)` helper + `ADMIN_ONLY_HREFS` Set；useMemo navForRole；admin 看全量 / moderator 自动过滤 3 路由
      - 测试 5/5 PASS（原 2 用例主题 + 新增 3 用例：admin 见全部 / moderator 不见 admin-only / moderator 仍见业务 nav）
      - GAPS.md #G-audit-self-scope ⬜ 待复核 → ⚠️ 已部分实装；登记 CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP（需 ADR-N + Opus + 后端 role-aware filter）
      - P-audit §0 适用角色字段重写
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4456 PASS（+3）
    - **关联**：#G-audit-self-scope ⬜ → ⚠️；H2「零死按钮」延伸到 nav 死链豁免
    - **工时估算**：0.08w / 实际 ~0.1w

