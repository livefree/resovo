# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-17

---

## 进行中任务

<!-- REDO-01-D 闭环（2026-05-19）；下一卡 REDO-01-E 行展开线路 sub-table -->

### CHG-SN-7-REDO-01-C ✅ 前端骨架闭环（2026-05-19）

**完成时间**：2026-05-19
**实施**：
- **5 文件新增/重写**（全部 < 500 行）：
  - `apps/server-next/src/app/admin/crawler/_client/CrawlerKpiRow.tsx`（95 行 / 5 KpiCard variant 映射 / 消费 getCrawlerKpi）
  - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（213 行 / AdminCard 容器 + 时间轴 CSS grid 框架 + frozen pill + pause toggle / 消费 getCrawlerTimeline / 15s auto-refresh）
  - `apps/server-next/src/app/admin/crawler/_client/CrawlerSiteList.tsx`（152 行 / DataTable v2 mode=client + 9 列骨架 + toolbar.search + client-mode 分页 + 三态）
  - `apps/server-next/src/app/admin/crawler/_client/crawler-site-columns-v2.tsx`（276 行 / 9 列定义函数 + 占位 callbacks + health/dot 派生 + siteStats 注入）
  - `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（312 行 / 重写 / 单页 3 区块 + 3 PageHeader actions / 消费 4 新端点 + 沿用 CrawlerSiteFormDrawer）
- **测试重写**：`tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` 旧 25 case → 新 **16 case PASS**（REDO-01-C 骨架范围）
- **旧文件保留**：CrawlerSitesTab.tsx / CrawlerControlsCard.tsx / crawler-site-columns.tsx 孤立至 REDO-01-I 删除

**评级**：A（5 文件全闭环 / 0 红线 / 测试重写 16/16 PASS）

**关键决策**：
- "导出" action 接入 warn toast 占位（无 API；CHG-SN-7 后续子卡补齐）
- "全站全量" 接入 runCrawlerAll('full') + confirm + freezeEnabled 守卫拦截
- KpiCard 5 张：站点(default) / 运行中(is-warn) / 失败(is-danger) / 本批视频量(is-ok) / 平均时长(default) — 严格对齐契约 §1.1 映射表
- 时间轴 15s auto-refresh（paused 或 freezeEnabled 时跳过）
- CrawlerSiteList 不消费 selection / expandedKeys / 行级操作 — 契约 §2.2 裁决 A + 后续 D/E/F 子卡范围

**质量门禁**：
- typecheck ✅
- lint ✅（仅 1 unrelated img warning）
- file-size-budget ✅ 0 新违规（5 新文件全 < 500 行 / 最大 312）
- verify:endpoint-adr ✅ 152 路由对齐 23 ADR
- verify:adr-contracts ✅（pre-existing advisory crawlerKpi.ts video_sources.route_count 命中保持不变）
- 全量 unit test：4053 → **4044 PASS**（-25 旧 CrawlerClient case + 16 新 case = 净 -9，符合预期）

**执行模型**：claude-opus-4-7（主循环 / 实施 / 任务卡建议 Sonnet 但用户在 Opus 会话续推 — 不擅自切换）/ 子代理：无（纯实施，契约 + 后端均已锁定）

<!-- 下张：CHG-SN-7-REDO-01-D 前端站点行 + {more} 菜单（0.2w / 估时下调；契约 §1.4 6 项行级 dropdown + 行级 + 增量/全量 按钮 + AdminDropdown）-->


### CHG-SN-7-REDO-01-B ✅ 全 4 阶段闭环（2026-05-18）

**SEQ**：M-SN-7 / REDO-01 第 3 子卡（C 阶段 0.3w / 前端首张实施卡）

**问题理解**：REDO-01-A 契约锁定 6 组件 + REDO-01-B 后端 4 新端点已就绪（getCrawlerKpi / getCrawlerTimeline / runCrawlerSite / runCrawlerAll API 客户端均已存在）。本卡完成新 CrawlerClient 顶层骨架重做：3 page__head actions + KPI row（5 张 KpiCard）+ 时间轴 card 框架 + 站点列表骨架（9 列 DataTable，**不含展开行**、**不含 {more} 行级菜单**）。

**根因判断**：当前 CrawlerClient 是 tab 形式（sites / runs），与设计稿 §5.6 单页 3 区块布局不一致；不重写无法消费新 4 端点数据 + 装配后续 D（行）/ E（线路展开）/ F（分类映射）/ G（高级菜单）/ H（runs 路由）子卡。

**方案**（按 contract §1 + §2 + §4 实施映射）：
1. **新建** `apps/server-next/src/app/admin/crawler/_client/CrawlerKpiRow.tsx`（KpiCard x5 / 消费 `getCrawlerKpi` / 5 variant 映射）
2. **新建** `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（AdminCard 容器 + card head 包含暂停按钮 + 冻结 pill + 时间轴 CSS grid 框架 / 消费 `getCrawlerTimeline` / **本卡只渲染框架 + 行状态 dot + 时间窗 bar 基础形态**，精细化样式留给 REDO-01-J 视觉对齐）
3. **新建** `apps/server-next/src/app/admin/crawler/_client/CrawlerSiteList.tsx`（DataTable v2 mode=client / 9 列骨架 / search toolbar / pagination / **不含 expandedKeys + renderExpandedRow** — 留给 REDO-01-E）
4. **新建** `apps/server-next/src/app/admin/crawler/_client/crawler-site-columns-v2.tsx`（9 列定义函数 + 占位 callbacks 接口 / 操作列暂渲染占位 chip — 真实按钮/{more} 留给 REDO-01-D）
5. **重写** `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（移除 sites/runs tab → 3 区块单页布局 + 3 actions：导出（toast 占位）/ + 新增站点（沿用 CrawlerSiteFormDrawer）/ 全站全量（消费 `runCrawlerAll` + confirm）；不挂"高级"dropdown — REDO-01-G）

**涉及文件**（5 个，全部新建/重写 + 0 个删除）：
- 新建：`CrawlerKpiRow.tsx` / `CrawlerTimelineCard.tsx` / `CrawlerSiteList.tsx` / `crawler-site-columns-v2.tsx`
- 重写：`CrawlerClient.tsx`
- 旧文件保留（孤立至 REDO-01-I 删除）：`CrawlerSitesTab.tsx` / `CrawlerControlsCard.tsx` / `crawler-site-columns.tsx`

**严格约束**：
- ❌ 不破坏 CrawlerSiteFormDrawer（新增/编辑 drawer 沿用）
- ❌ 不破坏 CrawlerRunsView（保留文件，REDO-01-H 迁独立路由前不消费）
- ❌ 不触碰 sources 跨模块 API（线路 sub-table 是 REDO-01-E 范围）
- ❌ 不触碰 ADR-123 分类映射端点（REDO-01-F 范围）
- ❌ 颜色硬编码 / 越层调用 / `any` 类型
- ❌ 单文件 > 500 行（PRE-01 守卫；目标全部 < 200 行）
- 一旦 KpiCard / DataTable / AdminCard / PageHeader 现有 API 不足 → 立即停止汇报，不擅自扩 admin-ui 类型

**执行模型**：claude-opus-4-7 主循环（任务卡建议 Sonnet，但用户在 Opus 会话中连续推进；按 §模型路由"主循环不可中途切换"原则保持 Opus 不擅自降级；不 spawn Opus 子代理 — 本卡纯实施，contract 已锁定）

**估时**：0.3w


### CHG-SN-7-REDO-01-B ✅ 全 4 阶段闭环（2026-05-18）

> **本卡已合并入 changelog + task-queue 标 ✅**，保留卡片副本以便阅读上下文，下一会话清理时一并移除。

**完成时间**：2026-05-18（含 fa8293ae 阶段 1 + 本次会话阶段 2-4）
**实施**：
- **阶段 1** ADR-122 起草（Opus 1 轮 A，commit 24606c47）
- **阶段 2** 4 文件实施：
  - `apps/api/src/db/queries/crawlerKpi.ts`（177 行 / 4 CTE + siteStats LATERAL JOIN）
  - `apps/api/src/db/queries/crawlerTimeline.ts`（171 行 / ROW_NUMBER 窗口函数 + JS 算术派生 pct）
  - `apps/api/src/routes/admin/crawlerDashboard.ts`（178 行 / 4 端点 + zod 校验 + auditSvc.write）
  - `apps/server-next/src/lib/crawler/api.ts`（+75 行 / 4 前端函数 + 4 type interface）
  - `apps/api/src/server.ts`（注册 adminCrawlerDashboardRoutes）
- **阶段 3** audit RETRO 4 文件框架（ADR-121 D-122-5 复用 actionType 降级）：
  - route 含 auditSvc.write（actionType=crawler.run_create 复用 / targetKind=crawler_site / system 区分 / afterJsonb.triggerType=single / all）
  - 新建 `tests/unit/api/crawler-dashboard-audit.test.ts`（**18 case PASS**）
  - audit-log-coverage.test REQUIRED + PAYLOAD 已含 crawler.run_create 无需扩
  - changelog 本条目
- **阶段 4** 全质量门禁：
  - typecheck ✅
  - lint ✅
  - file-size-budget ✅（0 新违规 / 4 新文件全 < 200 行）
  - **verify:endpoint-adr ✅ 152 路由对齐 23 ADR**（ADR-122 §端点契约表格式按脚本期望 6 列 4 行修订）
  - 全量 unit test：4035 → **预期 4053 PASS**（+18 新测试，待最终验证）

**评级**：A（4 阶段全闭环 / 0 红线 / 仅 §端点契约表格式 1 项格式纠错）

**关键发现**：
- ADR-122 起草时使用了 `### 端点契约表` 标题 + 嵌套 `#### 3.x` 子段，与 `scripts/lib/adr-parser.mjs` `findSubsection('端点契约')` 期望的 `### 端点契约`（无"表"后缀） + 平铺 6 列表格式不一致 → 阶段 4 修订加统一 6 列 4 行主表 + 保留下方子段作详细说明（命名为 `### 端点契约细节`）

**执行模型**：claude-opus-4-7（主循环 / 实施）+ arch-reviewer (claude-opus-4-7) 阶段 1 ADR 起草

<!-- REDO-01-B 闭环 / 下张：CHG-SN-7-REDO-01-C 前端骨架（0.3w / CrawlerClient page__head 3 actions + KPI row + 时间轴 card 框架 + 站点列表骨架） -->


**阶段 1 完成时间**：2026-05-18
**实施**：spawn arch-reviewer Opus 子代理 1 轮独立起草 → 主循环落 `docs/decisions.md` ADR-122 段（约 280 行）
**评级**：Accepted **A**（综合自评 / Opus 1 轮 PASS 无红线无黄线）
**关键决策**：
- 文件归属：方案 A 单文件 `crawlerDashboard.ts`（不追加 crawler.ts 960 行 baseline）
- POST 复用：方案 A alias 委托 `runService.createAndEnqueueRun`
- timeline SQL：DB 窗口函数 `ROW_NUMBER() OVER (PARTITION BY source_site)` + fallback `DISTINCT ON`
- audit 协议：复用 `crawler.run_create` actionType + afterJsonb.triggerType 区分 → **ADR-121 7 文件框架降为 4 文件框架**（不扩 types union / ACTION_TYPES / 两 set-equal 测试）

### CHG-SN-7-REDO-01-B 阶段 2/3/4 ⏳ 待续推（~0.45w）

**剩余工作**：
- **阶段 2 实施**：新建 crawlerDashboard.ts（< 200 行）+ 2 queries 文件（crawlerKpi.ts + crawlerTimeline.ts）+ service + 前端 api.ts 扩展 + sources.ts JOIN（siteStats routeCount）
- **阶段 3 audit RETRO 4 文件框架**：1 route 内 auditSvc.write + 2 payload 内容断言 test + 3 coverage.test 扩 PAYLOAD it.each + 4 changelog
- **阶段 4 质量门禁**：typecheck + lint + file-size + unit + verify:adr-contracts + verify:endpoint-adr

**已识别风险**：
- timeline SQL 性能（benchmark > 200ms 时降级 DISTINCT ON）
- crawlerDashboard.ts 控制 < 200 行（4 端点 + auditSvc.write + zod 校验）

**等待用户**：是否单会话续推 vs 切分到下次会话承接

<!-- 阶段 1 ADR-122 已 commit；阶段 2-4 待续 -->


**SEQ**：M-SN-7 / REDO-01 第 2 子卡（B 阶段 0.6w / 实际后端代码改动）

**问题理解**：REDO-01-A 契约已锁定 4 新端点提纲（GET /kpi + GET /timeline + POST /sites/:key/run + POST /run-all）。本卡完成：
1. ADR-122 起草（Opus 必须 / 与现有 analytics + dashboard + monitor-snapshot 端点重叠评估）
2. 4 端点实施
3. DB queries + service 层
4. 2 写端点同步落 ADR-121 7 文件 RETRO 框架（actionType `crawler.run_create` 复用）

**方案**（分 4 阶段）：
1. **阶段 1 ADR-122 起草**：spawn arch-reviewer Opus 子代理起 ADR-122，含：
   - 4 端点契约表（method + path + req + resp + errors + audit）
   - §"与现有端点关系"：核查 `/admin/crawler/overview` + `/system-status` + `/monitor-snapshot` 是否字段重叠，明示 `/kpi` 不替代 monitor-snapshot
   - SQL 聚合策略（timeline 按 site_key 聚合 task 时间窗 / kpi 聚合 healthy/running/failed/batch）
2. **阶段 2 实施**：
   - `apps/api/src/db/queries/crawlerKpi.ts`（新建）+ `crawlerTimeline.ts`（新建）— DB 聚合 query
   - `apps/api/src/services/CrawlerKpiService.ts`（新建）/ 复用 `CrawlerRunService` 派生 run-all
   - `apps/api/src/routes/admin/crawler.ts` 扩 4 endpoint（注：crawler.ts 已 960 行 baseline，不可超 → 拆分独立路由文件 `crawler-kpi.ts` 或路径合理 grouping）
3. **阶段 3 audit RETRO**（ADR-121 7 文件框架，仅写端点 sites/:key/run + run-all）：
   - actionType `crawler.run_create` 已存在 → EXPECTED set + REQUIRED + PAYLOAD it.each 已覆盖
   - 新增 payload 内容断言测试（`crawler-run-create-redo-audit.test.ts` 或扩展现有 audit test）
4. **阶段 4 质量门禁**：typecheck + lint + file-size + unit test 全 PASS + verify:adr-contracts + verify:endpoint-adr

**涉及文件**（预估 ~10 文件）：
- 新建：`docs/decisions.md` ADR-122 段
- 新建：`apps/api/src/db/queries/crawlerKpi.ts` / `crawlerTimeline.ts`
- 新建：`apps/api/src/services/CrawlerKpiService.ts`
- 修改：`apps/api/src/routes/admin/crawler.ts`（4 新 endpoint / 注意 file-size 守卫 / **可能需拆**）
- 修改：`apps/server-next/src/lib/crawler/api.ts`（4 新前端函数）
- 修改：`packages/types/src/admin-moderation.types.ts`（不需要 — actionType 复用）
- 新建：`tests/unit/api/crawler-kpi.test.ts` / `crawler-timeline.test.ts` / `crawler-run-create-redo-audit.test.ts`
- 修改：`docs/changelog.md`

**严格约束**：
- ❌ 不破坏现有 `POST /admin/crawler/runs`（4 新端点是 alias，内部委托 runService）
- ❌ crawler.ts 不得超 500 行（已 960 baseline；不得追加，必须拆分独立路由文件）
- ❌ 写端点不落 audit RETRO 7 文件框架（ADR-121 强制）
- ❌ ADR-122 起草未经 Opus 评审就 commit（CLAUDE.md §模型路由强制项）

**执行模型**：arch-reviewer (claude-opus-4-7) ADR-122 起草 + claude-opus-4-7 主循环实施 + arch-reviewer 评审 ADR

**估时**：0.6w


**完成时间**：2026-05-18
**实施**：spawn arch-reviewer Opus 子代理 1 轮独立设计 → 主循环落 `docs/M-SN-7-redo-01-contract.md`（约 580 行）
**评级**：通过（Opus 子代理"结论：通过"明确表态）
**关键产出**：
1. **6 组件 props/state/事件契约**：CrawlerKpiRow / CrawlerTimelineCard / CrawlerSiteList / buildCrawlerSiteColumns 9 列 / CrawlerSiteExpand / CrawlerAdvancedMenu
2. **5 Open Issues 全裁决**：
   - Q1 runs 独立路由 ✅ A
   - **Q2 批量动作删除 ✅ A**（行 `{more}` 菜单 7 种 batch action 全覆盖）
   - Q3 时间轴 top N + DataTable client-mode 分页
   - Q4 PageHeader 第 4 槽位高级 dropdown
   - Q5 时间轴 card head pill--warn 冻结
3. **4 后端端点契约提纲**：GET /kpi + GET /timeline + POST /sites/:key/run + POST /run-all（含 audit 协议引用 ADR-121）
4. **admin-ui 消费映射**：14 原语全部明示
5. **削减建议**：D 0.3w→0.2w + G 0.2w→0.1w；REDO-01 总估时 **2.55w → 2.35w**
6. **风险评估**：3 项（timeline SQL 聚合 / 线路 by-siteKey API 缺口 / health 字段缺失）+ 缓解策略
7. **DAG 依赖图**：B→C→{D,E,F,G,H} 并行 → I → J

**修订计划文档**：M-SN-7-design-realign-plan.md §2.5 标记 5 Open Issues 全部 ✅ 裁决
**质量门禁**：文档改动 / 0 代码改动 / typecheck + file-size 不变
**执行模型**：arch-reviewer (claude-opus-4-7) 独立设计 + claude-opus-4-7 主循环落地

<!-- 下张：CHG-SN-7-REDO-01-B 后端 ADR-122 + 4 新端点实施（0.6w，依赖 A 通过 ✅）— 启动条件：先 Opus 子代理起 ADR-122 评估与现有 analytics/dashboard 端点重叠（§5.4 内化 REDO-01-B 起卡条件） -->


**SEQ**：M-SN-7 / REDO-01 第 1 子卡（首张 / 阻塞 B–J 全部）

**问题理解**：M-SN-SHARED milestone 收尾完成（DataTable v2 行展开 / KpiCard progress / Spark 全部已具备）。REDO-01-A 是 Crawler 重做的 **设计契约阶段**：基于 M-SN-7-design-realign-plan.md §2.2 设计稿 spec 完整清单 + §2.3 现有功能保留底线 + §2.5 5 项 Open Issues，spawn Opus 子代理独立设计 6 个新组件的 props / state / 事件契约。

**根因判断**：Crawler 重做（REDO-01-B..J）涉及 7 新文件（KpiRow / TimelineCard / SiteList / SiteRow / SiteExpand / AdvancedMenu + runs 独立 page），无 props 契约则 B 后端 / C 前端骨架 / D 行 / E 展开 / G 高级菜单 / H runs 独立路由 各子卡无法并行起步。

**方案**：spawn arch-reviewer Opus 子代理（独立设计任务）输出：
1. **6 组件 props 契约**：
   - `CrawlerKpiRow` 5 KPI 数据 props + KpiCard 消费方式
   - `CrawlerTimelineCard` 时间轴 props（sites × 时间窗 × 状态 dot/pulse / 暂停按钮 / 冻结指示）
   - `CrawlerSiteList` 站点表容器 props（消费 DataTable v2 + expandedKeys + renderExpandedRow + selection?）
   - `CrawlerSiteRow` 9 列定义 + Pinned + 行级 `{more}` 菜单 + `+ 增量 / 全量` 按钮
   - `CrawlerSiteExpand` 行展开内容（线路 sub-table + 分类映射 collapsible）
   - `CrawlerAdvancedMenu` 4 操作 DropdownMenu（调度配置 / 重建索引 / 全局止血 / 冻结切换）
2. **5 Open Issues 裁决**（M-SN-7 plan §2.5）：
   - Q5（用户先前留给本卡）：批量动作（enable/disable/mark_*/delete）是否保留 — 与 selection 启用决策强绑定
   - SITES mock 8 个 vs 实际站点 100+ 的时间轴分页策略
   - 高级菜单挂在 PageHeader actions 第 4 槽 vs 二行设计
   - 冻结状态可视化（时间轴 card head pill--warn vs 全屏 banner）
   - 行展开默认所有行展开 vs 单行展开互斥
3. **后端 4 新端点契约提纲**（REDO-01-B 起 ADR-122 时消费）：
   - `GET /admin/crawler/kpi` 响应 schema
   - `GET /admin/crawler/timeline?range=1h` 响应 schema
   - `POST /admin/crawler/sites/:key/run?mode=incremental|full` 请求 + 响应 + audit 协议
   - `POST /admin/crawler/run-all?mode=full` 请求 + 响应 + audit 协议
4. **削减建议**（与 PRE-04 同模式）：识别现有可复用 / 错误假设 / 实际不需要的设计要素

**涉及文件**：
- 新建：`docs/M-SN-7-redo-01-contract.md`（Opus 输出 + 主循环整理的实施契约文档）
- 修改：`docs/M-SN-7-design-realign-plan.md` §2.5 Open Issues 状态标 ✅ 已裁决（带 REDO-01-A 链接）

**严格约束**：
- ❌ 不动业务代码（仅契约文档）
- ❌ 不起后端 ADR-122（留给 REDO-01-B 实施卡）
- ❌ 不写实际 tsx 文件（留给 REDO-01-C-H）
- 一旦发现 6 组件中某个被 DataTable v2 等现有 admin-ui 完全覆盖 → 立即汇报（与 SHARED-01/02 同模式）

**执行模型**：arch-reviewer (claude-opus-4-7) 独立设计 + claude-opus-4-7 主循环整理落 `docs/M-SN-7-redo-01-contract.md`

**估时**：0.15w


**取消时间**：2026-05-18（实施前发现）
**取消理由**：实施前读取 DataTable v2 types.ts 发现已支持 `renderExpandedRow` + `expandedKeys` props（ADR-117 + CHG-DESIGN-02 Step 5），data-table.tsx L500/506/543-545 真实渲染逻辑齐全，Sources MatrixExpand 已生产消费验证。同时 DataTable v2 支持 selection + pagination 三态，"selection + expand 兼容裁决"已被实证。
**与 SHARED-01 / SHARED-03 同模式**：M-SN-7 SHARED milestone 3 张卡的"admin-ui 缺这些原语"假设 3/3 全部错误（KpiCard / Spark / DataTable v2 行展开 admin-ui 全部已入库）
**M-SN-SHARED milestone 收尾**：仅 SHARED-01 完成 0.1w（KpiCard progress? prop 扩展）
**M-SN-7 全 milestone 累计下调**：~12–16w → **~11.0–15.0w**（PRE-04 dashboard 实测下调 0.4w + SHARED-02 实测下调 0.4w = 0.8w）
**REDO-01 实施路径**：直接消费 DataTable v2 `renderExpandedRow` + `expandedKeys`；REDO-01-C 前端骨架可参考 Sources MatrixExpand 范式（`apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx:269/328/464`）

<!-- M-SN-SHARED milestone 全部收尾 — 下张：CHG-SN-7-REDO-01-A Crawler 重做 Opus 子代理契约设计 -->


**SEQ**：M-SN-7 / SHARED milestone 第 2 张（**最大单卡 0.4w**）

**问题理解**：M-SN-7 设计稿对齐重做需要 3+ 页消费"行可展开表格"形态：
- §5.6 Crawler 站点表（每站点行展开线路 sub-table + 分类映射 collapsible）
- §5.4 Sources 视频聚合表（行展开线路矩阵 — 现有 MatrixExpand 参考形态）
- §5.8 Image Health 破损样本网格（候选消费）

**根因判断**：admin-ui 当前 `DataTable` 是 v2 一体化（支持 toolbar / saved views / bulk bar / filter chips / 隐藏列 chip / pagination 三态），但**不支持行级 expand 形态**（设计稿要求 chevron + accent-soft active row + expanded content slot）。设计稿明示 §5.6 Crawler 为"非标准 DataTable"，§5.4 Sources 的 MatrixExpand 是页内私有实现。需抽 admin-ui 共享原语。

**方案**：
1. spawn arch-reviewer Opus 子代理设计 `ExpandableTable` API 契约（独立设计任务），含：
   - Props 类型（rows / columns / expandRow / rowKey / pagination? / selection?）
   - **selection 能力契约裁决**（与"是否启用"分离）—是否原生支持 selection 列 vs ExpandableTable + selection 是否兼容
   - 渲染契约（chevron + accent-soft active row + expand transition + table-level pagination）
   - 与 DataTable 的关系（独立组件 vs 共享底座 hook）
   - 边缘 case（空 rows / loading / error / 单页 vs 多页）
2. 主循环按契约实施：
   - 新建 `packages/admin-ui/src/components/data-table/expandable-table.tsx`（业务实装）
   - 新建 `packages/admin-ui/src/components/data-table/expandable-table.types.ts`（Props 契约）
   - 更新 `packages/admin-ui/src/index.ts` 入口导出
   - 新建 `tests/unit/components/admin-ui/data-table/expandable-table.test.tsx`（多 case 单测）
   - dev/components-demo 加 ExpandableTable 形态展示
3. arch-reviewer Opus 评审实施一致性
4. 视觉 baseline（如有 Playwright harness 支持）

**涉及文件**：
- 新建：`packages/admin-ui/src/components/data-table/expandable-table.types.ts`
- 新建：`packages/admin-ui/src/components/data-table/expandable-table.tsx`
- 修改：`packages/admin-ui/src/index.ts` + `packages/admin-ui/src/components/data-table/index.ts`（如有）
- 新建：`tests/unit/components/admin-ui/data-table/expandable-table.test.tsx`
- 修改：`apps/server-next/src/app/admin/dev/components/components-demo.tsx`（demo 新增形态）

**严格约束**：
- ❌ 不破坏现有 DataTable v2 / MatrixExpand（Sources 模块继续消费私有 MatrixExpand 直到 REDO-01-E）
- ❌ 颜色硬编码（必须 CSS 变量 token）
- ❌ 单文件 > 500 行（PRE-01 守卫；如超线立即拆 expand-row.tsx / use-expand-state.ts 等）
- 一旦实施中发现 selection + expand 冲突无解 → 立即汇报

**执行模型**：arch-reviewer (claude-opus-4-7) 子代理设计契约 + claude-opus-4-7 主循环实施 + arch-reviewer 评审实施

**估时**：0.4w


**完成时间**：2026-05-18
**实施**：
- `kpi-card.types.ts` 新增 `KpiCardProgress` interface + `progress?` 字段 + 完整 JSDoc
- `kpi-card.tsx` 新增 `PROGRESS_SLOT_STYLE` / `PROGRESS_LABEL_STYLE` / `PROGRESS_TRACK_STYLE` / `variantProgressColor()` / `deriveProgress()` + footer 渲染 progress 与 spark 互斥逻辑 + 4 dev warn 防御
- `kpi-card.test.tsx` 新增 17 case（12 主流程 + 5 黄线修订）
**评级**：A−（arch-reviewer Opus 1 轮，**0 红线** + 3 黄线）→ 采纳黄线 1（color CSS 变量运行时防御）+ 黄线 2（a11y aria-label 追加百分比），跳过黄线 3（value=0 dev warn 争议）
**重大决策（执行中）**：原假设"扩 progress 承载 WorkflowCard 4 段形态"被识别为错误（KpiCard 单卡 vs WorkflowCard 子区域形态不匹配），用户裁决方案 A：footer spark/progress 互斥拓展；WorkflowCard 不动
**质量门禁**：KpiCard 单测 49 → **54 PASS**；待跑全量
**执行模型**：claude-opus-4-7 主循环（契约 + 实施）+ arch-reviewer (claude-opus-4-7) 1 轮评审

<!-- 下张：CHG-SN-SHARED-02 ExpandableTable 新建（0.4w）— SHARED milestone 收尾后启动 REDO-01-A -->


**SEQ**：M-SN-7 / SHARED milestone 第 1 张 / WorkflowCard 4 段 progress 形态承载

**问题理解**：PRE-04 dashboard 子卡 #1 实测发现 admin-ui 已入库 `KpiCard`（`packages/admin-ui/src/components/cell/kpi-card.tsx`），但当前消费方为 MetricKpiCardRow（dashboard 4 KPI）和 AnalyticsView（4 KPI + Spark）。**WorkflowCard 4 段 progress** 形态（采集入库 / 待审核 / 暂存待发布 / 已上架）目前是 dashboard 内独立组件，未消费 KpiCard。设计稿 reference §5.1.2 + §5.6（Crawler KPI 5 列）要求 KpiCard 能承载 progress 视觉。

**根因判断**：KpiCard 现有 props（label / value / delta / variant / spark / icon / onClick / dataSource）覆盖 4/4 + Spark 形态，但不支持"progress bar + n/total + label/color"组合（设计稿 §5.1.2 WorkflowCard 4 段每段 6px progress track）。

**方案**：
1. 主循环 opus-4-7 设计 `progress?: { value, total, color?, showLabel? }` prop API 契约
2. spawn arch-reviewer Opus 子代理评审契约（覆盖：渲染契约 / footer slot 与 spark/delta 共存规则 / 向后兼容硬约束 / 7 页消费扩展性）
3. 按评审落地实施：
   - 扩 `KpiCardProps` interface
   - 扩 KpiCard 组件渲染逻辑（progress 与 spark 互斥位置 footer / 与 delta 同行）
   - 单测：6 case（progress=undefined / value=0 / value=total / partial / value>total 边缘 / color 自定义）
   - 视觉 baseline 更新（admin-ui Playwright visual harness）
4. 现有消费方零破坏验证（MetricKpiCardRow + AnalyticsView 全量回归）
5. WorkflowCard 选项性消费 progress prop（dashboard 内部重构，本卡可选 stretch goal）

**涉及文件**：
- 修改：`packages/admin-ui/src/components/cell/kpi-card.types.ts`
- 修改：`packages/admin-ui/src/components/cell/kpi-card.tsx`
- 修改：`packages/admin-ui/src/components/cell/kpi-card.test.tsx`（如存在）+ 新增 progress test cases
- 修改：`apps/server-next/src/app/admin/dev/components/components-demo.tsx`（demo 新增 progress 形态展示）
- baseline 更新：`packages/admin-ui/playwright-baselines/kpi-card/` 视觉 baseline（如有）
- WorkflowCard 消费（可选 stretch）：`apps/server-next/src/components/admin/dashboard/WorkflowCard.tsx`

**严格约束**：
- ❌ 向后破坏（现有 MetricKpiCardRow + AnalyticsView 不得改动消费方）
- ❌ 颜色硬编码（progress.color 必须 CSS 变量 token）
- ❌ progress 与 spark **同时**渲染（footer 互斥；设计稿不要求二者并存）
- 一旦实施中发现 KpiCard 现有 footer 布局无法容纳 progress → 立即汇报

**执行模型**：claude-opus-4-7 主循环（契约 + 实施）+ arch-reviewer (claude-opus-4-7) 评审契约

**估时**：0.1w


**完成时间**：2026-05-18
**实施**：spawn arch-reviewer Opus 子代理 1 轮独立起草 → 主循环落 `docs/decisions.md`（追加 ~310 行）
**评级**：**Accepted A−**（子代理直接 PASS，无需修订）
**决策**：方案 A（新建表 `crawler_site_category_maps`）；方案 B（JSONB）/ C（config 文件）/ D（仅扩展硬编码）全部否定
**核心设计**：
- 复合主键 `(site_key, source_label)` + FK `crawler_sites(key)` ON DELETE CASCADE
- `target_genre` CHECK 约束 22 值（ADR-017 VideoGenre 20 + `_unmapped` + `_discard`）
- `PUT /admin/crawler/sites/:key/category-mapping` 全量替换语义 + 7 文件 RETRO 框架
- 入库前查表映射，命中即用 / 未命中走现有 `parseGenre()` 兜底（向后兼容）
- migration 064 SQL 草案完整（含 updated_at trigger + ROLLBACK 段）
**REDO-01-F 实施路径**：schema migration → query + service + 2 endpoints (with audit RETRO) → UI collapsible 消费 GET/PUT
**质量门禁**：verify:adr-d-numbers ⚠️ advisory（D-121-4/6 + D-123-1..6 未闭环，后续实施卡补）/ file-size-budget ✅ / typecheck ✅
**执行模型**：claude-opus-4-7 主循环 + arch-reviewer (claude-opus-4-7) 独立起草

<!-- PRE 阶段全部 4 张闭环 ✅✅✅✅
     下张：M-SN-SHARED milestone 启动 — SHARED-01 KpiCard progress? prop 扩展（0.1w）+ SHARED-02 ExpandableTable（0.4w）可并行；SHARED-03 已取消 -->


**SEQ**：M-SN-7 / PRE 阶段第 4 张 / REDO-01-F 前置依赖

**问题理解**：M-SN-7 设计稿对齐重做的 Crawler 重做（REDO-01）站点行展开包含"分类映射 collapsible"区块（screens-2.jsx:307-330）— 站点采集到的源分类（如「动作片」/「喜剧片」）→ 资源库类目（如 `action` / `comedy` / `drama` / `sci-fi`）的映射。当前无任何 schema / API / lib 支持。

**根因判断**：M-SN-6 实现 crawler 模块时此功能未规划；设计稿 v2.1 §5.6 + §6.8 + screens-2.jsx 真源新增此需求。

**方案**：
spawn arch-reviewer Opus 子代理起草 ADR-123（独立设计任务）：
- Context：业务必要性 + screens-2.jsx mock + 关联 ADR-017 内容类型系统
- Decision：3 选项对比并选定
  - 方案 A：新建表 `crawler_site_category_maps`（site_key + source_label + target_genre + 唯一约束）
  - 方案 B：`crawler_sites` 表加 JSONB 字段 `category_map`
  - 方案 C：写入 config 文件（与 fromConfig 站点同源 / 读写非对称）
- 决策要点（D-123-1...）
- 实施路径（migration + service + 端点 + UI）
- 不在范围 / 关联 / 4 维度自评

**涉及文件**：
- 修改：`docs/decisions.md`（追加 ADR-123 段）

**严格约束**：
- ❌ 不改业务代码（仅 ADR 文档）
- ❌ 不动 schema（迁移在 ADR 通过后由 REDO-01-F 实施）
- Opus 子代理独立起草后主循环直接落（CLAUDE.md §模型路由"设计跨 3+ 消费方 schema"+"撰写 ADR"双重强制项）

**执行模型**：spawn arch-reviewer (claude-opus-4-7) 独立起草 + 主循环 opus-4-7 落到 decisions.md

**估时**：0.1w


**完成时间**：2026-05-18
**实施**：`docs/decisions.md` 追加 ADR-121 段（约 240 行）
**评审**：arch-reviewer Opus 1 轮 **A- CONDITIONAL** → 红线 1（6 文件 → 7 文件，漏 audit-log-service-enums-set-equal）+ 黄线 3（D-121-5 与 R7 MUST-8 关系 / 替代方案缺 D / 自评对称性 A → A-）全部修订后 PASS
**重大发现**：原起草"6 文件固定框架"实际遗漏 `tests/unit/api/audit-log-service-enums-set-equal.test.ts`（service 层 enum 一致性独立守卫），5 先例均触及；评审拦截修订为 **7 文件框架**
**质量门禁**：typecheck ✅ / file-size-budget ✅ 0 新违规 / **4018 unit PASS 保持**
**执行模型**：claude-opus-4-7（主循环起草）+ arch-reviewer (claude-opus-4-7) 1 轮评审

<!-- 下张：CHG-SN-7-PRE-05 ADR-123 分类映射 schema 起草（0.1w）— REDO-01-F 依赖 -->


**SEQ**：M-SN-7 / PRE 阶段第 3 张（M-SN-6 关闭挂账）

**问题理解**：M-SN-6 期间产生 12 次 R-MID-1 RETRO 实践（5 卡先例 CHG-SN-6-14/16-A/20-A/25-RETRO/26-RETRO；共补齐 crawler 域 v1 写端点 audit 13/13），但范式无 ADR 规范背书。下游若有人偏离范式，无规范可援引拒绝。

**根因判断**：R-MID-1（reorder before=after）首次发现于 CHG-SN-5-06 audit；之后 12 次实践全部沿用同框架（4 真源同步 + 6 文件固定 + PATCH ≤ 5 豁免依据），但范式未沉淀为 ADR 文档。

**方案**：撰写 `docs/decisions.md` 追加 `ADR-121: R-MID-1 audit RETRO 协议正式化`，9 段结构：
1. Context（R-MID-1 起源 + 12 次实践累积）
2. Decision（4 真源同步范式 + 6 文件固定框架 + PATCH ≤ 5 豁免依据）
3. Status（Accepted）
4. Consequences（正面 + 负面）
5. Alternatives Considered
6. Compliance & Verification（如何核验范式合规）
7. References（5 先例 changelog 链接 + ADR-100 / ADR-109）
8. 4 维度自评（命名 / 对称性 / 状态职责 / 扩展性）
9. spawn arch-reviewer Opus 评审起草质量

**4 真源同步范式**（从 5 先例提炼）：
- (1) `packages/types/src/admin-moderation.types.ts` union 新增分支
- (2) `apps/api/src/services/AuditLogService.ts` ACTION_TYPES 常量数组追加
- (3) `tests/unit/api/audit-log-coverage.test.ts` EXPECTED set-equal 测试同步
- (4) `tests/unit/api/audit-log-coverage.test.ts` REQUIRED / PAYLOAD_ASSERTION_REQUIRED 数组同步

**6 文件固定框架**（PATCH ≤ 5 豁免依据）：
1-4 上述 4 真源 + 5 端点 route auditSvc.write + 6 端点 payload 内容断言新测试

**涉及文件**：
- 修改：`docs/decisions.md`（追加 ADR-121 段）

**严格约束**：
- ❌ 不改业务代码 / 测试代码
- ❌ 不动 5 先例 changelog（保留作 audit trail）
- ADR 起草必经 spawn arch-reviewer Opus 评审（CLAUDE.md §模型路由强制项）

**执行模型**：claude-opus-4-7 主循环起草 + spawn arch-reviewer (claude-opus-4-7) 评审

**估时**：0.15w


**完成时间**：2026-05-18
**实施**：`scripts/verify-file-size-budget.mjs`（210 行）+ package.json 集成 + preflight.sh 5e2/6 步骤
**实测结果**：5 PERMANENT（v1 frozen 永久豁免）+ 23 BASELINE（M-SN-6 复核 7 + PRE-01 全量扩 16）+ **0 新违规** ✅
**关键决策**：PRE-01 执行中实测发现 baseline 清单严重不全（原 7 → 实际 28），用户裁决"扩 BASELINE_EXEMPT 至 28 文件全量" + "v1 永久豁免"，新挂 5 张 MISC 拆分跟踪卡（API-QUERIES/ROUTES/SERVICES + WEB-NEXT + PLAYER-CORE）
**质量门禁**：typecheck ✅ / lint ✅ / 4018 unit PASS ✅ / file-size-budget ✅ 0 新违规
**执行模型**：claude-opus-4-7 / 子代理：无

<!-- 下张：CHG-SN-7-PRE-02 ADR-121 R-MID-1 协议化（0.15w，M-SN-6 挂账） -->


**SEQ**：M-SN-7 / PRE 阶段第 2 张（M-SN-6 关闭挂账）

**问题理解**：
M-SN-6 关闭复核暴露"自评数据可信度"盲点 — PATCH-2 自评"全部 ≤ 500 行"实际 7 文件超限。需要静态扫描守卫 + preflight 集成，把 500 行约束从"软门"提升为"硬门"。

**根因判断**：
CLAUDE.md §绝对禁止第 11 条「文件超 500 行非声明性 / 导出 2+ 主要概念，不先拆分就继续写」无机制守卫；arch-reviewer 抽样无法兜底（H1 案例已证）。

**方案**：
1. 新建 `scripts/verify-file-size-budget.mjs`：
   - 扫描 `apps/**/*.{ts,tsx}` + `packages/**/*.{ts,tsx}`
   - 超 500 行 → 收入违规清单
   - **5 baseline 豁免清单**（M-SN-6 复核 2026-05-17 实测）：MergeClient 756 / VideoListClient 734 / ModerationConsole 583 / sidebar 696 / data-table 608
   - **GENERIC_WHITELIST**：`*.types.ts` / `index.ts` 等结构性大文件豁免
   - **新增文件零容忍**：不在 baseline 清单 + 不在 whitelist = FAIL
   - exit 0 = 通过；exit 1 = 命中违规 + 清单；exit 2 = 脚本错误
2. `package.json` 新增 `verify:file-size-budget` script
3. `scripts/preflight.sh` 集成（紧跟 verify:token-references 之后）
4. 单测：脚本本身先跑通（实测当前仓库应输出 5 baseline 0 新违规）

**涉及文件**：
- 新建：`scripts/verify-file-size-budget.mjs`
- 修改：`package.json`（scripts 段）
- 修改：`scripts/preflight.sh`（5f/6 步骤新增）

**严格约束**：
- ❌ 不改业务代码
- ❌ 不调整 baseline 清单（5 文件锁定 M-SN-6 复核实测数）
- 一旦实测产出 baseline 外新违规 → 立即汇报（说明 M-SN-6 关闭至今有人新违规提交）

**执行模型**：claude-opus-4-7（主循环，按 sonnet 模式独立实施，无需 Opus 子代理）

**估时**：0.12w


**完成时间**：2026-05-18（连续推进 #1–#16 一会话内闭环）
**产出**：`docs/M-SN-7-design-realign-audit-FULL.md` 16 段完整审计

**汇报评级**：

| # | 路由 | 评级 | 关键发现 |
|---|---|---|---|
| 1 | dashboard | ⚠️ S 级 | 90%+ 对齐 + 3 MISC（按钮 onClick / 数据 mock / 编辑态延后）；KpiCard + Spark 已入库 → SHARED-01 0.35w→0.1w |
| 2 | moderation | ✅ A 级 | SplitPane 三栏 + segment + 键盘流全对齐，0 偏离 |
| 3 | staging | ❌ 整页未做 | 路由不存在；REDO-04 待 Opus 裁决（独立路由 ~1.5w vs IA 修订 0.1w） |
| 4 | videos | ✅ A 级（标杆） | DataTable 标杆，1 MISC（poster 32×48 vs 48×72 设计升级决议） |
| 5 | sources | ✅ A 级 | KpiCard 4 + Segment 4 + MatrixExpand 全对齐，0 偏离 |
| 6 | merge | ⚠️ S 级 | 缺 Segment 3 类 + 候选 card 形态（左右视频卡对比），2 MISC |
| 7 | subtitles | ⚠️ S 级 | 缺 KPI 4 列 + 上传字幕 action，2 MISC |
| 8 | home | ⚠️ S 级 | 缺 sticky 前台预览（1fr/360px），2 MISC |
| 9 | submissions | ❌ 整体错位 | DataTable vs §5.13 Card list；REDO-02 已锁 ~1w |
| 10 | crawler | ❌ 整体错位 | 计划文档 §2 已审；REDO-01 已立 10 子卡 2.55w |
| 11 | image-health | ⚠️ S 级 | 缺 2 actions（重扫封面/切 fallback 域）+ 破损样本 grid，2 MISC |
| 12 | analytics | ✅ A 级 | CHG-DESIGN-09 完整实施；reference §5.15.4 自评"占位"已过期；0 偏离 |
| 13 | users | ⚠️ S 级 | 缺 KPI 4 列 + 角色矩阵 + 邀请用户 actions，2 MISC |
| 14 | settings/system | ❌ 架构错位 | sidebar 5 子项分散违反 §5.11 + plan §6 8 类实际 5 类；REDO-03 ~1.5w（4 子卡） |
| 15 | audit | ⚠️ S 级 | 缺时间穿梭 action（功能需求待用户确认），1 MISC |
| 16 | login | ⚠️ S 级 | card 视觉偏离（320 vs 400 + 无 brand/SSO/审计），1 MISC |

**关键裁决（PRE-04 收尾）**：
- **SHARED-03 Spark 取消**：dashboard / analytics / sources / MetricKpiCardRow 已消费现有 admin-ui Spark
- **REDO-03 settings 收敛**新增（4 子卡 ~1.5w）：吸收原 MISC-SETTINGS-TABS
- **REDO-04 staging** 待 Opus 裁决方案 A vs B

**总览**：5 ✅ + 8 ⚠️ + 4 ❌ + **16 MISC** + **4 REDO（01/02/03/04）**

**等待**：用户对 REDO 启动顺序 + REDO-04 staging 裁决方案拍板


**SEQ**：M-SN-7 / 设计稿对齐重做 / PRE-04 全量审计 16 路由的第 1 张

**计划真源**：`docs/M-SN-7-design-realign-plan.md` §1（16 路由审计矩阵）+ §4（调用顺序）+ §1.2（PRE-04 拆解）

**问题理解**：

server-next 后台 `/admin/dashboard` 当前实现是否对齐设计稿 §5.1 + screens-2.jsx Dashboard 真源。设计稿 §5.1 spec：
- page__head 问候式 title + 全站全量采集 primary action
- AttentionCard：异常列表（采集失败 / 图片 404 / 合并候选 / Banner 过期），按优先级 + 状态 icon + xs action
- WorkflowCard：4 段 progress（采集入库 accent / 待审核 warn / 暂存待发布 info / 已上架 ok），底部审核 / 批量发布快捷按钮

**根因判断**：未知，本卡即审计本身

**方案**：
1. 读设计稿真源：`docs/designs/backend_design_v2.1/reference.md` §5.1（行 501–556 含 AttentionCard / WorkflowCard 描述）+ `docs/designs/backend_design_v2.1/app/screens-2.jsx` Dashboard 部分
2. 读现有实现：`apps/server-next/src/app/admin/page.tsx` + 关联 client 组件
3. 输出 spec ↔ 现状 ↔ 偏离归属对照表（与计划文档 §2.4 同结构）
4. 给 ✅ / ⚠️ / ❌ 总评级 + 偏离项分级
5. 写入 `docs/M-SN-7-design-realign-audit-FULL.md`（新文档，本卡首段）

**涉及文件**：
- 读：`docs/designs/backend_design_v2.1/reference.md` §5.1 + `app/screens-2.jsx` Dashboard 段 + `apps/server-next/src/app/admin/page.tsx` + `apps/server-next/src/app/admin/_client/**`
- 写：**新建** `docs/M-SN-7-design-realign-audit-FULL.md`（仅本卡建首段，后续 PRE-04 子卡接续追加）

**严格约束**（CLAUDE.md §绝对禁止 + 计划文档 §0）：
- ❌ 不动业务代码（审计卡只读 + 写 docs/）
- ❌ 不修计划文档（除非用户明确要求）
- ❌ 不动 SETTINGS / image-health / crawler 等其他路由（本卡仅 dashboard）
- 一旦发现规范偏离立即停止汇报

**执行模型**：claude-opus-4-7（主循环，按 PRE-04 §1.2 模型路由——Sonnet 主循环逐路由扫描；本会话主循环虽为 Opus，仍按 sonnet 模式独立产出审计而不擅自升 Opus）

**估时**：0.05w
