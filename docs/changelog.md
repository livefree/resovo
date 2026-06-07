# Resovo（流光）— 开发变更记录

> status: active
> owner: @engineering
> scope: completed task change history
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-23

> 本文件仅记录 M-SN-8 及以后的活跃变更。
> 历史 changelog 已分段归档：
> - `docs/archive/changelog/changelog_m0-m6.md` — M0 ~ M6 期间
> - `docs/archive/changelog/changelog_M-SN-2-to-7_20260523.md` — M-SN-2 ~ M-SN-7（CHG-SN-2-21 ~ SEQ-20260521-01 总结）

每次任务完成后，AI 在此追加一条记录。
格式固定，便于追踪变更历史和排查问题。
追加规则：新记录统一追加到文件尾部，不做头部插入。

## 记录格式模板

```
## [TASK-ID] 任务标题
- **完成时间**：YYYY-MM-DD
- **记录时间**：YYYY-MM-DD HH:mm
- **执行模型**：claude-<opus|sonnet|haiku>-<version>（完整 ID，如 claude-sonnet-4-6）
- **子代理**：无 / [subagent-name (claude-xxx-x-x), ...]
- **修改文件**：
  - `path/to/file.ts` — 说明做了什么
  - `path/to/another.ts` — 说明做了什么
- **新增依赖**：（如无则写"无"）
- **数据库变更**：（如无则写"无"）
- **注意事项**：（后续开发需要知道的事情，如无则写"无"）
```

字段约束：
- "执行模型" 必填，必须是完整模型 ID
- "子代理" 必填；本任务未 spawn 任何 Task 工具调用时写 "无"；有则列出每个 subagent 的名称和其对应 model ID
- 历史条目（本补丁应用前的条目）不强制回填，保持原样

---

## [CHG-VSR-1] 双表 DTO + 问题枚举 + 术语 + 待补源语义 + SourceSegment 仅废弃（契约地基）
- **完成时间**：2026-06-01
- **记录时间**：2026-06-01 22:40
- **执行模型**：claude-opus-4-8（主循环）
- **子代理**：arch-reviewer (claude-opus-4-8) — `@resovo/types` 跨消费方契约强制 Opus 评审，CONDITIONAL PASS
- **背景**：SEQ-20260601-01 视频库/播放线路职责重定义系列的**契约地基卡**，为后续卡 2（视频库 API）/3（线路聚合 API）/4-A·4-B（视频库 UI）/5-A·5-B（线路 UI）/6（LinesPanel）预置双表 DTO 与术语类型。设计真源 `docs/designs/videos-sources-responsibility-redesign_20260601.md` §0.2/§2/§3/§5.3。
- **修改文件**：
  - `packages/types/src/sources-matrix.types.ts` — ① `SourceSegment` 加 `@deprecated`（指向 `SOURCE_QUICK_FILTERS`，仅兼容不删，§5.3）；② 新增 3 枚举（ADR-157 双形态 const+type）：`SOURCE_QUICK_FILTERS`（5 快捷筛选 all/has_abnormal/needs_source/pending_probe/low_quality）/ `SOURCE_PROBLEM_KINDS`（探测维度②：connect_fail/render_fail/pending_probe，异常源由消费方 OR 派生）/ `NEEDS_SOURCE_SEVERITIES`（online_incident/draft_pending）；③ `VideoGroupRow` 加 12 派生列 optional（activeSourceCount/connectFailCount/renderFailCount/pendingProbeCount/disabledCount/qualityRank/qualityLabel/qualityCoverage/latencyMedianMs/needsSource/isPublished/lastCheckedAt，注释钉死维度①/②区分）；④ `VideoGroupListParams` 加 quickFilters 数组 + lowQuality bool（双入口 OR 合流）+ lastCheckedFrom/To + sortField 扩 activeSources/quality/lastChecked；⑤ `VideoGroupStats` 加 4 KPI optional（abnormal/needsSource/pendingProbe/lowQuality）+ 维度①/②混居块注释。
  - `packages/types/src/index.ts` — BLOCKER A-1：新增 3 枚举 const 的 value re-export（type-only `export type *` 不透出 const，ADR-157 双形态硬约束）。
  - `apps/server-next/src/lib/sources/types.ts` — BLOCKER A-2：桥接补 3 新 type re-export + 3 const value re-export 块（统一类型入口）。
  - `apps/server-next/src/lib/videos/types.ts` — E 节：`VideoAdminRow` 镜像 7 字段 optional（title_original/country/status/episode_count/current_episodes/total_episodes/bangumi_status），与 `VideoAdminDetail`（extends VideoAdminRow）既有同名字段签名逐字一致（HIGH E-1）；import + re-export 补 `BangumiStatus`。
- **arch-reviewer 红线消解**：3 BLOCKER（A-1 index value re-export / A-2 桥接 value re-export / B-1+D-1a 维度①(is_active)与维度②(probe·render)在 DTO 注释层显式区隔）+ 1 HIGH（E-1 继承签名一致）+ 5 MEDIUM（C2 sortField `coverage`→`activeSources` 防与 qualityCoverage 冲突 / C1 quickFilters+lowQuality 双入口 OR 合流注释 / B-2 qualityRank 7 档映射表 / B-3 isPublished 非展示列标注 / E-2 维度边界）全采纳。
- **偏离说明**：`disabledCount` 字段——reviewer MEDIUM 建议「可暂不加，留待真有消费方」，但设计 §3.2/§3.3 已明确将「禁用 {n}」列为 issues 列**可选中性 badge** 消费点，据设计文档据实保留（加性零成本，避免后续再触 @resovo/types 触发二次 Opus 评审）。
- **新增依赖**：无。
- **数据库变更**：无（纯类型契约；qualityRank 为派生概念，真值映射 CASE 留卡 3 producer）。
- **质量门禁**：typecheck 8 workspace 全过 / lint 5 successful（警告均既有）/ **全量 448 文件 5909 passed 0 failed 零回归** / verify:adr-contracts EXIT=0。
- **e2e**：N/A（纯类型加性，无运行时行为变化）。
- **[AI-CHECK]**：六问全过——①零回归（纯加性 optional + 新枚举，既有 producer getVideoGroupStats/listVideoGroups + consumer SourcesClient/SourceColumns/VideoAdminDetail 全不受影响，reviewer 逐一核实）；②不越界（仅类型契约，未触 producer SQL/UI 渲染/DataTable 公开 Props/user_submissions）；③沉淀共享层（枚举落 @resovo/types 真源 + 桥接透出，复用 ADR-157 双形态 + DualSignalState/VideoStatus/BangumiStatus）；④无 any/颜色/空 catch；⑤术语准确（维度①/②注释钉死，连接/试播/异常/禁用对齐 §0.2）；⑥声明性文件不计入 500 行硬限。
- **注意事项**：(1) 下游 producer（卡 3）填充 VideoGroupRow 新字段时务必遵守注释维度口径——`abnormal/connectFailCount/renderFailCount`（维度② probe·render dead）**不得**与既有 `dead`（维度① source_check_status='all_dead'）混算。(2) `quickFilters` 含 `'low_quality'` 与 `lowQuality===true` 是同一谓词，producer 须 OR 合流并补等价性单测。(3) `VideoGroupStats.orphan` 本卡**未改名**（保留兼容），rename→needsSource 级联留卡 3（API）+ 卡 4/5（UI）；`SourceSegment` 枚举本体删除留卡 5 末尾。(4) 视频库过滤入参升级（VideoListFilter/AdminVideoListFilters + ADR-150 amendment）留卡 2 与 API 同步落，本卡未预置（避免空契约）。

### [CHG-VSR-1] Codex stop-time review FIX — 质量契约对齐 canonical ResolutionTier
- **完成时间**：2026-06-01
- **记录时间**：2026-06-01 22:52
- **执行模型**：claude-opus-4-8（主循环）
- **子代理**：arch-reviewer (claude-opus-4-8) — @resovo/types 契约复审，确认 Q1(a)+Q2(A)
- **触发**：Codex stop-time review 指出 CHG-VSR-1（c5f92b2b）含 **producer-facing 不一致**——质量字段未复用代码库既有 canonical 真源。
- **根因**：代码库已有 `ResolutionTier`（7 档，admin-moderation.types.ts:382）+ `StagingRow.qualityHighest: ResolutionTier | null`（既定字段名/lines-panel/staging 多处复用），而我新增的 `qualityLabel?: string`（松散 string + 平行新名）+ `qualityRank?: number`（注释自造平行 7 档映射表，漂移风险）违反价值排序 #2 复用 / #4 一致性。
- **修改文件**：
  - `packages/types/src/sources-matrix.types.ts` — ① import 加 `ResolutionTier`；② `qualityLabel?: string | null` → `qualityHighest?: ResolutionTier | null`（Q1(a)：对齐 canonical 类型 `ResolutionTier` + 既有 `StagingRow.qualityHighest` 命名；档位序在注释显式拼出，**无共享常量**）；③ **移除** `qualityRank?: number | null`（Q2(A)：rank 是 producer 内部 SQL 排序键 + 低质量谓词用，client 无读取场景，移除消除冗余+漂移载体）；④ 收口 4 处 `MAX(quality_rank)` 注释：将 quality_rank 明确标注为「服务端 ResolutionTier 档位派生的排序/阈值键，纯 SQL 内部、非 DTO 字段」，低质量定义集中到 `VideoGroupListParams.lowQuality`（< 720P / ResolutionTier 后三档）。
  - **二次 FIX（聚合语义修正 / Codex stop-time review 第 2 轮）**：上一版注释误写「口径对齐 `pickHighestQuality`(aggregate.ts)」——经核实 `pickHighestQuality`(aggregate.ts:55-60,156) **仅取 `quality_detected`、不含 `quality` 回退**，而设计 §0.2 line 75 / §3.3 line 268 明确 `qualityHighest` 须走 `quality_detected ?? quality` 回退链（059 D-12）。已改正 `qualityHighest` + `lowQuality` 两处注释：明确「逐源 `quality_detected ?? quality` 回退后跨视频取最高档；档位序显式拼出（4K 最高）、值域复用 canonical 类型 `ResolutionTier`」，并**显式警告 producer 卡 3 勿照搬 `pickHighestQuality`（会丢 `quality` 回退）**。纯 JSDoc 修正，类型签名不变、零回归。
- **arch-reviewer 复审结论**：CONDITIONAL→采纳 Q1(a)+Q2(A)；全仓 Grep 核实 `qualityRank`/`qualityLabel` 零 producer 填充/零 consumer 读取（本卡刚加的 optional），移除+改名**零回归**。⚠ 本次推翻上一条 CHG-VSR-1 记录里「B-2 qualityRank 7 档映射表已采纳」结论（从「保留+注释」改「移除」），属对前次评审结论的修订，已显式记述避免与历史 changelog 矛盾。
- **新增依赖/schema/路由/Props 契约**：无（仅类型对齐既有真源）。
- **质量门禁**：typecheck 8 workspace EXIT=0 / lint EXIT=0 / **全量 448 文件 5909 passed 0 failed 零回归**。
- **e2e**：N/A（纯类型）。
- **[AI-CHECK]**：六问全过——复用既有 canonical（`ResolutionTier` 类型 + `qualityHighest` 命名；档位序显式拼出、**无共享常量**，producer 在 SQL CASE 实现）；契约面收敛（VideoGroupRow 质量单一真源 qualityHighest，rank 纯 producer 内部）；零回归（grep 确认无引用）；无 any/颜色/越层。**注意事项（已含二/三次 FIX 修正）**：producer 卡 3 派生 `qualityHighest`/低质量 rank 须**逐源 `quality_detected ?? quality` 回退后**按显式档位序（4K 最高）取最高档——**勿照搬 LinesPanel `pickHighestQuality`（module-local、仅 quality_detected、丢回退）**；低质量排序/谓词的 quality_rank 在服务端 ORDER BY CASE / FILTER 内派生，不回写 DTO。

---

## [CHG-VSR-2] 视频库 API：过滤升级 + 搜索扩面 + distinct 白名单（ADR-150 AMENDMENT 3）
- **完成时间**：2026-06-01
- **记录时间**：2026-06-01 23:40
- **执行模型**：claude-opus-4-8（主循环）
- **子代理**：arch-reviewer (claude-opus-4-8) — ADR-150 AMENDMENT 3 决策文档，CONDITIONAL PASS（D-150-VSR2-1..5）
- **背景**：SEQ-20260601-01 视频库职责重定义。视频库 `/admin/videos` 现有过滤单值且窄，升级为设计 §2.6 三层过滤模型的服务端支撑 + distinct facet 扩展。
- **修改文件**：
  - `apps/api/src/db/queries/videos.ts` — `AdminVideoListFilters` 加 14 字段（types[]/yearMin/yearMax/country[]/catalogStatus[]/isPublished/doubanStatus[]/bangumiStatus[]/metaScoreMin/metaScoreMax/episodeMismatch/episodeMissing/metaIncomplete/pendingReview）；`listAdminVideos` 加对应 WHERE（数组枚举 `= ANY($n::text[])` 参数化 + `if(arr?.length)` 空数组短路；派生布尔仅 true 追加；`IS DISTINCT FROM` NULL 安全）；`q` ILIKE 扩 title_original + short_id（单参数复用）；`SORT_FIELD_WHITELIST` +`episode_count`；类型 import 加 VideoStatus/DoubanStatus/BangumiStatus。
  - `apps/api/src/routes/admin/videos.ts` — `SORT_FIELDS` +episode_count；局部 `csvEnum`/`csvFreeStr`/`queryBool` helper（参 SourcesMatrixService/crawler.runs 各 route 私有 csv 范式）；`ListQuerySchema` 加 14 query param + 默认 `sortField='updated_at'`/`sortDir='desc'`；解构透传 adminList；import 加 BANGUMI_STATUSES。
  - `apps/api/src/services/VideoService.ts` — `adminList` 签名 + 透传加 14 字段（加性，零回归）。
  - `apps/api/src/services/datatable/distinct-whitelist.ts` — `DT_DISTINCT_TABLES` +`media_catalog`（D-150-VSR2-1 方案 B）；`videos` 加 douban_status/bangumi_status；`media_catalog` 加 country（逻辑名=实表名，无需 DT_DISTINCT_FROM）。**IDENT 正则/启动断言零改动**。
  - `apps/server-next/src/lib/videos/types.ts` — `VideoListFilter` 同步 14 入参 + sortField +episode_count（CHG-VSR-1 延后项）。
  - `docs/decisions.md` — ADR-150 **AMENDMENT 3**（D-150-VSR2-1..5）+ 端点契约表 6→7 表。
  - `tests/unit/api/datatable-shared.test.ts` — DT_DISTINCT_TABLES 6→7 断言 + 新 distinct 列断言。
  - `tests/unit/api/admin-video-list.test.ts` — +2 测试（数组 `= ANY` 参数化/范围/q 扩面 + 派生布尔/空数组短路）。
- **决策点（ADR-150 AMENDMENT 3）**：
  - **D-150-VSR2-1** distinct country：采纳方案 B（加 `media_catalog` 逻辑表直查），**拒绝给 distinct 端点加 JOIN**（JOIN const 片段含保留字，IDENT 正则无法覆盖 → 安全面扩张，违 R-150-1）。
  - **D-150-VSR2-2** 入参机制：离散 query params，**拒绝 `?filters=` envelope**（apps/api 全仓零消费，applyFilterValue 是 Drizzle 专用）。
  - **D-150-VSR2-3** type 单→多：加性 `types[]` 保留单值 `type`（不改 union，不破 `?type=movie` 契约）。
  - **D-150-VSR2-4** visibility/review 维持单值（消费方已验证单值 / api.ts set 单值 / getEnumFirst 拍平 / 单测单值）；默认排序落 route，DB fallback 不动。
  - **D-150-VSR2-5** 派生谓词口径：episodeMismatch=`IS DISTINCT FROM`；metaIncomplete=`meta_score IS NULL OR <60`（仅 meta_score，不引入未定义"关键字段"）；仅 true 追加。
- **新增依赖**：无。
- **数据库变更**：无（country/douban_status/bangumi_status 列已存在；distinct 只读；无 migration）。
- **质量门禁**：typecheck 8 workspace EXIT=0 / lint EXIT=0 / **全量 448 文件 5912 passed 0 failed**（含新增 5 测试断言）/ verify:adr-contracts EXIT=0 / verify:endpoint-adr EXIT=0（无新 route）。
- **e2e**：N/A（API 层；VIDEO e2e 走 UI 卡 4）。flaky 说明：首轮全量出现 2 failed = `tests/unit/server-next/admin-moderation/use-filter-presets.test.ts` 的 post-teardown `window is not defined` unhandled rejection（与本卡无关、我未碰 moderation/filter-presets），重跑 2 次均 0 再现、全 448 passed。
- **[AI-CHECK]**：六问全过——①零回归（加性 optional + 单值字段未改 / `listAdminVideos` 唯一调用方 adminList、adminList 唯一调用方 route，pending/staging 走独立 schema 不受影响，arch-reviewer 核实）；②分层（route zod+透传 → adminList 透传无业务 → query SQL，未越层）；③防注入（数组 `= ANY($n::text[])` 参数化 + distinct 三重防御不变 + 拒 JOIN）；④无 any/颜色/空 catch；⑤复用既有 csv 范式 + ResolutionTier 无关；⑥distinct country 走逻辑表非端点 JOIN（边界收敛）。注意事项：(1) 卡 4 UI 接线时 type 多选用 `types` CSV、visibility/review 仍单值（如需多选另起）；(2) country facet 前端列标 `filterDistinctTable:'media_catalog'`；(3) 集数异常/元数据缺失为快捷筛选派生 boolean，仅传 true 生效。

### [CHG-VSR-2] Codex stop-time review FIX — typed client 过滤序列化
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 00:05
- **执行模型**：claude-opus-4-8（主循环）
- **子代理**：无（一手核实 api.ts 序列化缺口 + 后端 csvEnum/queryBool 解析口径）
- **触发**：Codex stop-time review 指出「new filter contract is internally inconsistent and not reachable through the typed client」。
- **根因**：CHG-VSR-2 给 `VideoListFilter` 加了 14 过滤字段，但 typed client `listVideos`（`lib/videos/api.ts`）的 query 序列化器**未同步**——字段在类型里声明却发不出去（不可触达 + 契约内部不一致：类型承诺了 client 静默丢弃的能力）。
- **修改文件**：
  - `apps/server-next/src/lib/videos/api.ts` — `listVideos` 序列化补 14 字段，**与后端解析器精确对齐**：数组 → CSV（`.join(',')` 对齐 `csvEnum`/`csvFreeStr` 逗号分割）/ 布尔 `isPublished` → `String()`（'true'/'false' 对齐 `queryBool` z.enum）/ 范围 → `String()` / 派生快捷筛选（episodeMismatch/Missing/metaIncomplete/pendingReview）仅 true 发送（后端 `=== true` 才追加谓词）；空数组 `?.length` 短路不发。
  - `tests/unit/server-next/videos-api-filter-serialization.test.ts`（新增）— 5 测试：数组 CSV / 范围+布尔 / 派生仅 true / 空数组短路 / episode_count 排序，证明可触达 + 序列化口径与后端一致。
- **新增依赖/schema/路由/Props 契约**：无（client 序列化层）。
- **质量门禁**：typecheck 8 workspace EXIT=0 / lint EXIT=0 / **全量 449 文件 5917 passed 0 failed 零回归**。
- **[AI-CHECK]**：六问全过——契约闭环（type 声明 ↔ client 序列化 ↔ 后端解析三者一致）；零回归（仅 listVideos 加序列化分支）；无 any/颜色/越层。注意：client 数组用 CSV（非重复 key），因后端 csvEnum/csvFreeStr 取单 string 拆分；卡 4 UI 调 listVideos 即可触达全部新过滤。

## [CHG-VSR-3] 线路聚合 API：派生列 + KPI②维度 + queries 拆分（ADR-117 AMENDMENT 3）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 08:20
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)（设计阶段，ADR-117 AMENDMENT 3「需修改」→ 2 BLOCKER + 1 HIGH + 3 MEDIUM 纳入 D-117-VSR3-1..8；本卡按已 Accepted 设计实施）
- **修改文件**：
  - `apps/api/src/db/queries/source-line-aliases.ts`（**新建** 291 行）— 别名 CRUD（listLineAliases/listAllSourceLines/findLineAlias/upsertLineAlias/upsertLineAliasFull/retireLineAlias/updateLineAliasPriority/findCodenameAssignments + `DbAliasRow`/`mapAliasRow`），自 sources-matrix.ts 拆出（D-117-VSR3-7）。
  - `apps/api/src/db/queries/source-routes.ts`（**新建** 158 行）— routes-by-site 视图（listRoutesBySite + `SourceRouteBySiteRaw`/`DbRouteBySiteRow`）+ 行级 3 mutations（selectRouteSampleSource/countRouteSources/softDeleteRouteBySite），自 sources-matrix.ts 拆出。
  - `apps/api/src/db/queries/video-matrix.ts`（**新建** 88 行）— getVideoMatrix（单视频线路×集数矩阵 + `DbEpisodeCellRow`），自 sources-matrix.ts 拆出。
  - `apps/api/src/db/queries/sources-matrix.ts`（759→**381**）— 保留 video-groups 单一关注点。新增 `QUALITY_RANK_EXPR` alias 参数化 module-level const 工厂（Q1 SELECT/Q2 stats/Q3 quickFilter low_quality 三处共用、`COALESCE(quality_detected,quality)` 回退口径、勿照搬 LinesPanel pickHighestQuality）。`listVideoGroups`：单趟聚合 FILTER 派生列（active_source_count/disabled_count/connect_fail_count/render_fail_count/pending_probe_count）+ quality_coverage（仅 quality_detected 实测比例）+ percentile_cont(0.5) 延迟中位（全源非空 scope）+ quality_rank_max(ORDER BY 用) + quality_highest=CASE MAX(rank) 反查 label（质量未知 null 不并入低质量）+ needs_source/is_published/last_checked_at；GROUP BY 追加 v.is_published（D-1）；quickFilters 全 WHERE EXISTS（vs5-9 可组合 AND，lowQuality/quickFilter 'low_quality' OR 合流单份谓词不双 push，D-5）；lastChecked HAVING 范围（CHG-VSR-1「卡 3 实现」闭环）；SOURCES_SORT_FIELD_MAP 扩 activeSources/quality/lastChecked 走裸 SELECT 别名（IDENT 正则零放宽，D-6）。`getVideoGroupStats`：per-video 子查询 g（bool_or/MAX）+ 外层 COUNT FILTER，①(total/active/dead/orphan) source_check_status 口径零变更 + ②(abnormal/needsSource/pendingProbe/lowQuality) 探测/质量维度（禁①②同层双算，D-4）。SourceSegment + segment 查询分支原样保留（卡 5 删，D-8）。
  - `apps/api/src/services/SourcesMatrixService.ts`（586→613）— import 路径迁移至 4 query 文件（D-117-VSR3-7 方案 A）；listVideoGroups map 显式枚举透传 11 派生列（双层透传）；VideoGroupsQuerySchema 扩 quickFilters(csvToStringArray SOURCE_QUICK_FILTERS)/lowQuality(queryBool 显式枚举防 'false'→true)/lastCheckedFrom/To/sortField enum；getVideoGroupStats 透传②维度（query 层已产出）。
  - `tests/unit/api/sources-matrix.test.ts` — 直接 import 拆分（getVideoGroupStats/listVideoGroups ← sources-matrix；getVideoMatrix ← video-matrix；listLineAliases/upsertLineAlias ← source-line-aliases）+ VIDEO_ROW 补派生列 + 新增 19 单测（派生列映射/SQL FILTER/CASE/quickFilters/sortField/lastChecked HAVING/KPI② SQL+映射）。
  - `tests/unit/api/sources-matrix-service.test.ts` — vi.mock 拆 3 路径（sources-matrix/video-matrix/source-line-aliases）+ namespace import（queries/videoMatrixQueries/aliasQueries）+ 新增 1 派生列双层透传单测。
  - `tests/unit/api/source-line-alias-mutations.test.ts` / `source-line-alias-retire-priority-audit.test.ts` — vi.mock + import 路径 → source-line-aliases。
  - `tests/unit/api/sources-routes-by-site.test.ts` — import listRoutesBySite → source-routes。
  - `tests/unit/api/admin-source-lines-view.test.ts` — 7 处 dynamic import → source-line-aliases。
  - `tests/integration/api/admin-sources.test.ts` — relative import 拆分。
- **新增依赖**：无。
- **数据库变更**：无（quality_rank 纯派生；quality/quality_detected/latency_ms/last_probed_at/is_active/is_published 列均已存在）→ architecture.md 零同步。
- **门禁**：typecheck 8 workspace EXIT=0 / lint EXIT=0 / verify:adr-contracts EXIT=0 / verify:endpoint-adr EXIT=0（203 路由对齐，无新 route）/ **全量 5933 passed**（1 失败=`VideoImageSection.test.tsx` jsdom testing-library waitFor 计时 flaky，隔离重跑 21/21 通过、与本卡无关，同 CHG-VSR-2 既有 flaky 模式）。e2e N/A（API-only 无 UI 消费方，留卡 4/5/6 + CHG-VSR-7）。
- **D-N 偏离闭环**：D-117-VSR3-1（QUALITY_RANK_EXPR 工厂三处共用）✅ / -2（CASE MAX 反查 label + ResolutionTier 断言）✅ / -3（latency 全源非空 scope）✅ / -4（KPI② per-video 子查询 + ①零变更逐值回归）✅ / -5（quickFilters WHERE EXISTS + OR 合流）✅ / -6（sortField SELECT 别名 IDENT 零放宽）✅ / -7（4 文件拆分 + 测试 mock 路径方案 A）✅ / -8（SourceSegment 保留 + 零 user_submissions）✅。
- **注意事项**：① `SourcesMatrixService.ts`(613) 为既有 debt（HEAD 已 586>500，设计 D-117-VSR3-7 仅 scope 拆 queries 文件未含 Service，本卡 +27 行均派生列透传 map + zod schema 加性声明）；file-size-budget 本卡**净改善 -1**（sources-matrix.ts 759→381 退出违规），建议 SEQ-FOLLOWUP-ARCH 长尾治理 Service 拆分。② `last_checked_at` ORDER BY 走 ISO TEXT 字典序（=时序，已注释）。③ 派生列均为 VideoGroupRow optional 字段（CHG-VSR-1 契约，不改 types.ts 签名）；卡 4/5 UI 消费方直接读取即可触达。④ KPI 字段 dead/orphan(①) 与 abnormal(②) 维度不同源不可混算（卡 5 rename 级联后移除①遗留字段）。
- **[AI-CHECK]**：结构检查 分层 NO 违反 / 跨模块内部 NO；代码质量 重复逻辑 NO（QUALITY_RANK_EXPR 单一定义）/ hack NO；规模检查 函数 NO / 文件 YES（SourcesMatrixService 613 既有 debt，设计未 scope，另起长尾卡）；安全 副作用/吞异常 NO。结论：SAFE。
- **Codex stop-time review FIX（2 issue 全闭环）**：
  1. **lastChecked 排序非时序安全** → `sources-matrix.ts` 新增真实 timestamptz 排序列 `last_checked_sort`（`COALESCE(MAX(last_probed_at), MAX(updated_at))` 不 ::TEXT），`SORT_FIELD_MAP.lastChecked` 改指向它（裸标识符过 IDENT 正则）；DTO 仍读 `::TEXT` 的 `last_checked_at`。原 `last_checked_at::TEXT` 文本字典序依赖 session DateStyle 非时序安全，现与既有 `updated_at`(走 `MAX(vs.updated_at)` 真实时间戳) + `quality_rank_max`/`quality_highest` 双列同范式。单测断言 `ORDER BY last_checked_sort` 且不含 `ORDER BY last_checked_at`。
  2. **SourcesMatrixService.ts 超 500 行硬限**（613）→ 抽 `apps/api/src/services/sources-matrix.schemas.ts`（**新建** 146 行）：Zod 校验 schema（7 个）+ 行级 mutation 结果 DTO（RouteTestResult/RouteReprobeResult/RouteDeleteResult）+ aggregateSignal 信号派生（单一职责"端点契约层"）。Service **613→490**（<500 ✅）；route 改从 schemas 文件 import 7 schema；Service import 结果 DTO + aggregateSignal；2 测试改从 schemas import aggregateSignal。**file-size-budget 整卡净改善 -2**（21→19，sources-matrix.ts 759→381 + SourcesMatrixService 613→490 双退出，schemas.ts 146<500 零新违规）。
  - **复跑门禁全过**：typecheck/lint/verify:adr-contracts/verify:endpoint-adr EXIT=0 / **全量 449 文件 5934 passed 0 failed 零回归**（VideoImageSection flaky 本轮亦通过）+ 105 受影响测试全过。原"偏离 SourcesMatrixService 既有 debt"已消解（490<500），SEQ-FOLLOWUP-ARCH 不再需为本文件起卡。

## [CHG-VSR-5-A] 播放线路结构重构：删四 Tab + 删内嵌别名 Tab + 列重构
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 09:10
- **执行模型**：claude-opus-4-8
- **子代理**：无（消费既有 admin-ui 原语 Pill/KpiCard/DataTable，无新共享组件契约）
- **修改文件**：
  - `apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx`（377→264）— 删 `SEGMENTS` segment 四 Tab（grouped/dead/correction/orphan）+ segment state/param + handleSegmentChange + 主体「线路矩阵/全局别名表」Tab + `activeTab` state + `activeTab==='aliases'` 分支 + 内嵌 `SourceLineAliasPanel`；删手动「刷新」按钮 + `useToast`（改自动 refetch / useEffect deps，保留 retryKey 供 ErrorState）；新增 `SORT_FIELD_BY_COLUMN` 映射列 id→API sortField（video/coverage→activeSources/quality/lastChecked，§3.4）；日期过滤 updatedAt→lastChecked（filtersMap key + lastCheckedFrom/To）；保留 PageHeader「线路别名管理→」跳转 + KPI 4 卡（display only，5-B 重建 5 张可点击）+ probe/render/site 过滤。
  - `apps/server-next/src/app/admin/sources/_client/SourceColumns.tsx`（260→290）— 按 §3.2 重建列集：`video`(展开 chevron + 封面 + 标题 + 副标题改 `{type}·{short_id}`，sortable) / `coverage`(复合 `{线}/{源}/{可用}`，可用=is_active 0 染 `--state-error-fg`，sortable→activeSources) / `probe`(SignalPill，header 探测，filterable enum) / `render`(SignalPill，header 试播，filterable enum) / `quality`(`{qualityHighest ?? 质量未知}` + 已检测{coverage}% + 延迟中位{ms}ms，sortable→quality) / `issues`(复用 `Pill` 多 badge：待补源[已上架 danger/未上架 warn]/连接失败{n}/试播失败{n}/待探测{n}/禁用{n}，各 0 不显示) / `sites`(站点 distinct filter) / `last_checked`(最近检测，sortable→lastChecked，date-range filter) / `actions`(占位)；**保留列 id `video/probeStatus/renderStatus/siteKey`** + filterFieldName 不破坏 smoke e2e；删 `lineCount`/`sourceCount` 独立列（并入 coverage）；探测/试播 filterOptions 文案改「连接失败/试播失败」（设计 §0.2 维度②术语）；派生列防御性 `?? 0` / `?? null`。
  - `apps/server-next/src/lib/sources/api.ts`（+lastChecked 序列化）— `listVideoGroups` 补 `lastCheckedFrom/To` URL 序列化（last_checked 列过滤可触达 / CHG-VSR-2 "声明却发不出" 教训）；`sortField` 已有通用透传（CHG-VSR-1 类型扩 activeSources/quality/lastChecked 后即可发出）。
  - `tests/unit/components/server-next/admin/sources/SourcesClient.test.tsx` — 随结构同步：fixture 补 CHG-VSR-3 派生列（activeSourceCount/qualityHighest/connectFailCount 等）；改 4 测试——「2 主体 tab」→「无四 Tab/别名 Tab 负向断言 + 别名管理跳转」/「Segment 4 tabs」删→「listVideoGroups 不带 segment」/「segment 切换」删/「全局别名表 tab」删/「lineCount/sourceCount」→「覆盖(可用)+质量 1080P+问题(连接失败)」列渲染断言。8 passed。
- **新增依赖**：无。
- **数据库变更**：无（纯前端结构重构 + typed client 序列化）。
- **门禁**：typecheck 8 workspace EXIT=0 / lint EXIT=0（仅既有 exhaustive-deps warning，filtersMap 覆盖派生 filter，与原代码同范式）/ verify:adr-contracts EXIT=0 / **全量 5931 passed + 1 flaky**（`StagingEditPanel.test.tsx` admin/staging jsdom waitFor 计时，隔离重跑 12/12 通过、与本卡 admin/sources 无关，同既有 flaky 模式）。file-size-budget 19 中性（SourcesClient 264 / SourceColumns 290 均<500）。**e2e 留 CHG-VSR-7**（保留关键列 id 最小化破坏）。
- **范围外（分卡）**：KPI 5 卡可点击 pressed + quality 低质量 boolean 过滤 + quickFilters/lowQuality 序列化 + 删 SourceSegment 枚举 → **CHG-VSR-5-B**；MatrixExpand→`LinesPanel` 展开区 → **CHG-VSR-6**；e2e 正式回归 → **CHG-VSR-7**。
- **注意事项**：① `SourceLineAliasPanel.tsx` 内嵌使用已移除 → 成孤儿（仅 page.tsx 文档注释提及「暂保留兼容历史 IA」），未删（卡范围外 / 清理 follow-up）。② KPI 4 卡暂消费①维度 stats（total/active/dead/orphan），5-B 切②维度 5 卡。③ actions 列为占位按钮（重新探测/更多），真实接通留 5-B + 6。④ 派生列均 VideoGroupRow optional（CHG-VSR-3 已填充），UI 防御性兜底。
- **[AI-CHECK]**：结构检查 分层 NO 违反（UI 只调 typed client）/ 跨模块内部 NO；代码质量 重复逻辑 NO（复用 Pill/SignalPill + filtersMap 既有范式）/ hack NO；规模检查 函数 NO / 文件 NO（264/290<500）；安全 副作用/吞异常 NO。结论：SAFE。
- **Codex stop-time review FIX（展示与排序契约）**：
  - **默认排序违反 §3.4**：初始 `sort.field=undefined` → 不发 sortField → 后端兜底 `updated_at desc`，而契约「默认 last_checked desc ✅ 已定」。改 `SourcesClient` 初始 sort `{ field: 'lastChecked', direction: 'desc' }` → 发 sortField=lastChecked（后端 ORDER BY `last_checked_sort` 时序安全列）；同时修复 §1.1-4「激活排序态在列头显指示符」（原数据已排序却无指示符 + 排错字段的展示/状态错配）。
  - **§3.4 禁排序列显式化**：probe/render/issues 补 `enableSorting: false`（§3.4「probe/render/issues/sites 派生/多值聚合排序业务无意义」），消除 `kind:'computed'` 默认值依赖的隐式假设。sortable 集严格 = video/coverage/quality/last_checked。
  - 单测补默认排序断言（sortField=lastChecked / sortDir=desc）；门禁全过 typecheck/lint EXIT=0 + 全量 5932 passed 0 failed。
  - **e2e smoke 同步修复（不留知情破坏）**：`sources-sort-filter-smoke.spec.ts` test 1 断言由「首请求 sortField=null」改为「sortField=lastChecked + sortDir=desc」（随默认排序契约更新）。实跑（直连已运行 server-next:3003 绕过 web-next:3000 webServer 冲突）：**test 1（我修的默认排序）+ test 2（video sort）+ test 4（siteKey distinct）3 PASS**。
  - **test 3 现红 → 已立追踪卡 `CHG-VSR-DTAF-VIEWPORT`（不再未追踪）**：probeStatus filter「应用」按钮 outside viewport。**根因**：`[data-autofilter-popover]` `max-height:480px`（dt-styles-matrix.ts:157）+ 无视口 flip-up，从 sources 页靠下列头（4 KPI 卡 / 表头 y≈350）向下展开 → popover 底部 y≈830 > 720 视口，浮层 `scrollIntoView` 无效。**既有缺陷非本卡回归**：取 5-A 前版本（042a43ef，旧四 Tab 表头更靠下）跑同测试同样失败（且更严重）；CHG-VSR-5-A 删 Tab 表头上移反而改善。影响所有高页面 autofilter。**修复方向**：popover 视口感知（flip-up / max-height=可用高度 + footer sticky）；属 packages/admin-ui，超 5-A 范围故独立卡（避免压力下仓促改共享组件定位）。**阻塞 CHG-VSR-7 的 test:e2e 门禁**（已在 CHG-VSR-7 依赖标注）。

## [CHG-VSR-5-B] 播放线路快捷筛选(B：可点击 KPI 卡 pressed) + 列头筛选 + 删 SourceSegment
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 10:05
- **执行模型**：claude-opus-4-8
- **子代理**：无（消费 PRE-3 KpiCard pressed + 既有 admin-ui 原语，无新共享组件契约）
- **修改文件**：
  - `apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx`（264→322）— KPI grid 4→5 列；4 display 卡（总播放源/有效/失效/孤岛 ①维度）→ 5 可点击快捷筛选卡：全部(total/清空) + `QUICK_FILTER_CARDS`（含异常源 abnormal / 待补源 needsSource / 待探测 pendingProbe / 低质量 lowQuality，消费 CHG-VSR-3 ②维度 stats）；`KpiCard` onClick+pressed（PRE-3）：`quickFilters: ReadonlySet<ActiveQuickFilter>` state，`toggleQuickFilter`（可组合 AND / setPage(1)）+ `clearQuickFilters`（全部卡）；pressed=选中态（aria-pressed/data-active）；新增 `lowQualityColumnFilter` 派生（filtersMap 'lowQuality' enum 含 'low'）；effect 透传 quickFilters + lowQuality（+deps）。
  - `apps/server-next/src/app/admin/sources/_client/SourceColumns.tsx`（290→302）— quality 列加 `filterable`（DataTableAutoFilter 无 boolean 控件 → 单选 enum `LOW_QUALITY_OPTIONS=[{value:'low',label:'低质量（< 720P）'}]`，filterFieldName='lowQuality'）；client 派生 lowQuality=true，与 KPI 低质量卡后端 D-5 OR 合流。
  - `apps/server-next/src/lib/sources/api.ts`（−segment +quickFilters/lowQuality）— `listVideoGroups` 删 segment 序列化；补 `quickFilters`(csv join，不传 'all') + `lowQuality`(仅 true，对齐后端 queryBool z.enum)。
  - `apps/api/src/db/queries/sources-matrix.ts`（−segment 分支）— 删 SourceSegment import/re-export + listVideoGroups 的 segment 四 Tab 分支（dead/correction/orphan，维度①/user_submissions），由 quickFilters②/lowQuality 取代。
  - `apps/api/src/services/sources-matrix.schemas.ts`（−segment）— VideoGroupsQuerySchema 删 segment enum。
  - `packages/types/src/sources-matrix.types.ts`（−SourceSegment）— 删 `SourceSegment` type + `VideoGroupListParams.segment`；更新 SOURCE_QUICK_FILTERS 注释（segment 已删）。
  - `apps/server-next/src/lib/sources/types.ts`（−re-export）— 删 SourceSegment re-export。
  - `tests/integration/api/admin-sources.test.ts` — 3 segment 集成测试（dead/orphan/correction）→ quickFilters(has_abnormal/needs_source)/lowQuality 集成测试。
  - `tests/unit/components/server-next/admin/sources/sources-api-url.test.ts` — 复合透传去 segment（改 activeSources/lastChecked）+ 新增 quickFilters csv + lowQuality（仅 true）序列化测试。
  - `tests/unit/components/server-next/admin/sources/SourcesClient.test.tsx` — STATS 补②字段；KPI「4 卡」→「5 卡 = 可点击快捷筛选」（断言新 label + 旧①卡退场 + 默认全部 pressed）+ 新增「点击含异常源 → quickFilters=[has_abnormal] + pressed 切换」交互测试。
  - `tests/unit/api/sources-matrix.test.ts` — docstring 去 segment（quickFilters/lowQuality）。
- **新增依赖**：无。
- **数据库变更**：无。
- **门禁**：typecheck 8 workspace EXIT=0 / lint EXIT=0 / verify:adr-contracts EXIT=0 / verify:endpoint-adr EXIT=0 / **全量 5934 passed + 1 flaky**（`CrawlerClient.test.tsx` 导出 CSV spy 计时，隔离重跑 66/66 通过、与本卡 sources 无关）。**e2e 主动实跑**（直连 server-next:3003 绕 web-next:3000 webServer 冲突）：sources smoke **test 1（默认排序）+ test 2（video sort）+ test 4（siteKey distinct）PASS**；test 3（probe filter apply）仍 = 已追踪 `CHG-VSR-DTAF-VIEWPORT`（5-B 零新 e2e 破坏，与 5-A 后结果完全一致）。文件 SourcesClient 322 / SourceColumns 302 均<500。
- **注意事项**：① 低质量 2 入口（KPI 低质量卡 → quickFilters 'low_quality' / 质量列筛选 → lowQuality boolean）后端 D-5 OR 合流单谓词，UI 不强制双向同步（CHG-VSR-1 设计两独立入口）。② KPI ①维度 stats 字段（active/dead/orphan）仍由 getVideoGroupStats 返回但 UI 不再消费（保留兼容 / 等价回归基线；彻底 rename 级联留后续）。③ actions 列 + bulkActions 仍占位（真实接通 CHG-VSR-6）。④ SourceSegment 全仓代码零引用（仅 changelog/types 注释历史提及）。
- **[AI-CHECK]**：结构检查 分层 NO 违反（UI 调 typed client）/ 跨模块内部 NO；代码质量 重复逻辑 NO（复用 KpiCard PRE-3 + AutoFilter enum / lowQuality 后端 OR 合流）/ hack NO；规模检查 函数 NO / 文件 NO（322/302<500）；安全 副作用/吞异常 NO。结论：SAFE。

## [CHG-VSR-PRE-2] 前置：抽中性 `useSourceLinesController(videoId)`（§5.5 / arch-reviewer 蓝图 R1-R5 / Y1-Y4）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 09:35
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8) — 设计评审于立卡时（2026-06-01）完成（CONDITIONAL PASS + 5 红线 + 4 黄线全采纳，蓝图固化 task-queue.md）；本会话按蓝图实施，无新增 spawn
- **修改文件**：
  - `apps/server-next/src/lib/sources/use-source-lines-controller.ts`（**新建** / 中性数据层 hook 312 行）— state{lines/loading/error/togglingIds/probingIds/renderCheckingIds/probingAllSources/renderCheckingAllSources/disableDeadPending/refetchPending} + actions{reload/toggleEpisode/disableDead/refetch/probeEpisode/renderCheckEpisode/probeAllSources/renderCheckAllSources/fetchHealth} + options{onLoaded/onActionResult}；R2 乐观锁 toggle（乐观更新 + 409 REVIEW_RACE 重 fetch + 非 race 回滚 snapshot）/ R3 videoIdRef batch stale-write 防御 / R4 结构化 SourceActionResult 经 onActionResult 注入（不 push toast/alert，localized 反馈留消费方）/ R5 fetchHealth 仅取数（drawer 留消费方）/ Y4 onLoaded 留首行选 + onSourceHealthChanged。错误归类 duck-typed（对齐 use-sources 参照）。
  - `apps/server-next/src/lib/sources/types.ts`（+ `SourceLineRowData` 中性行 Y1 / + `SourceActionResult`+`SourceActionType`+`SourceActionStatus`+`SourceActionBatchSummary` R4，含可选 `code` 供精确 i18n 映射）
  - `apps/server-next/src/lib/sources/api.ts`（R1 方案 B：移入 fetchVideoSources〔显式 active=all 待校准点①〕/ toggleSource / disableDeadSources / refetchSources〔+ 可选 siteKeys〕/ probeOneSource / renderCheckOneSource / batchProbeVideo / batchRenderCheckVideo / fetchLineHealth / toDisplayState + 7 result 类型；端点逐一对齐原 moderation/api 无后端回归）
  - `apps/server-next/src/lib/moderation/api.ts`（R1：删源操作实现 → re-export 自 sources/api；`ContentSourceRow` 收敛为 `SourceLineRowData` 别名；删冗余 import）
  - `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（341→219 / 删 8 state+handler → 消费 controller；onLoaded 首行 onLineSelect；onActionResult → useToast 浮层 + actionError 红条；drawer 本地保留）
  - `apps/server-next/src/app/admin/videos/_client/_videoEdit/TabLines.tsx`（useVideoSources → controller；新增 probe/render 能力；onActionResult → alert(VE) 含 STATE_INVALID 区分；drawer 本地）
  - `tests/unit/server-next/sources/use-source-lines-controller.test.ts`（**新建** / 14 用例：reload+onLoaded / 乐观锁 toggle 成功·409 race·非 race 回滚+code / disableDead / refetch 成败 / 单源 probe·render / 批量 + summary / R3 batch stale-write / probe freeze / fetchHealth 透传）
- **新增依赖**：无。
- **数据库变更**：无。
- **门禁**：typecheck 8 workspace EXIT=0 / lint EXIT=0（三新改文件零新增警告）/ verify:adr-contracts EXIT=0 / verify:endpoint-adr EXIT=0（203 路由对齐，无新端点）/ **全量 5950 passed 零失败**（含本卡新增 15；FIX 前 5949+14 用例）。受影响现有套件全绿：moderation-api 15 / use-sources 11 / lines-panel 16 / use-selected-line 7。（注：全量偶报 4 unhandled errors = player-core/navigation jsdom `Not implemented: navigation/HTMLMediaElement` 异步噪声，非确定性 flaky，与本卡无关；本卡测试隔离运行 0 error。）
- **Codex stop-time review FIX 第 1 轮（并发安全·其他行）**：`toggleEpisode` 失败回滚原用 `setLines(snapshot)` **整组还原启动快照** → 抹掉期间并发操作对**其他行**的 server-confirmed 更新。首版改为仅回滚目标行。
- **Codex stop-time review FIX 第 2 轮（并发安全·同一行）**：第 1 轮的"单行回滚"仍把目标行 `is_active` 还原成启动时捕获的 `prevActive` → 若期间并发操作（如 `disableDead`）server-confirmed 改了**同一行** `is_active`，回滚会用 stale 值覆盖。改为失败一律以 server 真相重 fetch 整组对账（race/非 race 统一），重 fetch 亦失败才退化条件回退。
- **Codex stop-time review FIX 第 3 轮（并发安全·终修）**：第 2 轮的"整组 `setLines(fresh)`"仍会用 **re-fetch 发起时的快照**覆盖期间落地的**更新的 confirmed 写**（其他行的 probe/toggle、或同行 disableDead）。**终修两层**：① **外科式对账**——失败时只对账**目标行**（`fresh.find(id)` 后 `prev.map(target→freshTarget)`），**绝不整组替换 / 绝不触碰其他行**；② **同行 confirmed 写保护**——新增 `externallyModifiedRef` 集，`disableDead` 写 dead/dead 行时若该行正在 toggle 则标记之；该 toggle 失败时**完全短路对账**（不 re-fetch、不回滚），让 confirmed 写赢；re-fetch 完成后二次校验该标记防 re-fetch 窗口内落地的并发写。失败对账抽 `reconcileTargetAfterToggleFailure` helper（降 toggle 嵌套 4→2 层）。新增 2 回归用例（⑤ re-fetch 成功也只对账目标行、B 的 newer probe-dead 不被 stale fresh 覆盖；⑥ 同行 disableDead confirmed → toggle 失败短路、`fetchVideoSources` 仅调用 1 次）。修测试隔离：`beforeEach` 改 `vi.resetAllMocks()` 清 once 队列（防短路用例残留 once 泄漏）。复跑 typecheck/lint EXIT=0 + **全量 5953 passed**（hook 18 用例）。
- **Codex stop-time review FIX 第 4 轮（并发安全·同行其他字段）**：第 3 轮的 re-fetch 成功分支用 `setLines(... ? freshTarget : l)` **整行替换**目标行 → 若期间**同一行**被并发 confirmed 写**其他字段**（如 `probeEpisode(同一行)` 改 `probe_status`/`latency_ms`），整行替换会用 stale `freshTarget` 覆盖之（success 路径与 fallback 路径本已是字段级，唯独此分支整行替换不一致）。**终修**：re-fetch 成功也**只对账 `is_active` + 乐观锁 `updated_at`**（`{ ...l, is_active: freshTarget.is_active, updated_at: freshTarget.updated_at }`），保留同行其他字段。至此 toggle 全部 setLines 路径（success / re-fetch / fallback / disableDead / probe / render）均为字段级，仅 `reload` 为权威整组加载。新增 1 回归用例（同行并发 probe→dead/42，toggle 失败 re-fetch 对账后 is_active=server 真相 + probe_status=dead + latency=42 保留；旧整行 freshTarget 会回退 ok/100）。复跑 typecheck/lint EXIT=0 + **全量 5954 passed**（hook 19 用例 / 连跑 3 次稳定；首次全量 1 flaky 重跑 2 次均零失败，既有非确定性 jsdom 噪声）。
- **e2e**：审核台 e2e（lines-aggregate-display / player-integration / refetch-sources-then-reopen）需 playwright 用**测试 env 启动 server-next**（mock cookie auth），本机运行栈 :3003 中间件校验 `mock-mod-rt` 走真实 :4000 → 307 重定向 `/login`，且 :3000 webServer 冲突（CHG-VSR-5 已记环境问题）无法本机启测试服务 → **3 spec 全在页面加载/鉴权步失败（在组件逻辑之前），非本卡回归**（curl 实证 `/admin/moderation`→307 login）。e2e 真回归门禁归 **CHG-VSR-7**（沿用 CHG-VSR-3「e2e 留 7」范式）。集成契约零变更佐证：`PendingCenter`（onLineSelect/selectedKey 桥接 owner）+ admin-ui `LinesPanel`（Y2 零改动）均未触及，消费方逐一透传同 props。
- **注意事项**：① **审核台 toggle 行为升级**：原审核台无乐观更新，现统一为乐观更新（R2 蓝图明示变更点）。② **孤儿待清理**：`lib/videos/use-sources.ts`（useVideoSources）TabLines 迁走后无消费方（其单测仍验证 videos/api 行为，保留）；moderation/api 的 source 符号为兼容 re-export。③ **drawer 逻辑 2 处重复**（moderation/LinesPanel + TabLines 各本地一份，R5 留消费方）；达 3 处时（CHG-VSR-6 展开区）应提取 `useLineHealthDrawer`。④ `M.errors.loadFailed`（主加载错误文案）按原样保留（既有口径）。⑤ R4 细化：localized `actionError`/`error` 由消费方持有（i18n 各异），hook 仅推结构化结果 + 原始 Error。
- **[AI-CHECK]**：结构检查 分层 NO 违反（lib/sources → api-client + sources/api，单向）/ 跨模块内部 NO（moderation 经公开 re-export，sources 不反向 import moderation 内部）；代码质量 重复逻辑 NO（消除 moderation/useVideoSources 双份源操作）/ hack NO；规模检查 函数 NO（各 action useCallback <30 行 / hook 声明性组装）/ 文件 NO（hook 312 / LinesPanel 219 / TabLines 145 均<500）；安全 副作用/吞异常 NO（catch 经 onActionResult 上报，无空 catch）。结论：SAFE。

## [CHG-VSR-6] 用共享 `LinesPanel` 替换 `MatrixExpand`（消费 useSourceLinesController / 设计 §3.6）

- **背景/问题**：`/admin/sources` 行展开区 `MatrixExpand`（SourceMatrixRow.tsx）重复实现已有共享 `LinesPanel`，四宗罪：① render 阶段 `setState`+`getVideoMatrix` 发请求（反范式 `:164-169`）② `.slice(0,8)` 仅显前 8 集（`:201`）③ 复制线路/重验全部/删除全失效 3 按钮无 `onClick`（`:263-306`）④ 不显示别名 codename / 退役态 retired / auto_retired。
- **方案**：删 `MatrixExpand`，新建 `SourceLinesExpand.tsx` 消费 CHG-VSR-PRE-2 中性 `useSourceLinesController(videoId)` + 共享 `LinesPanel`（density=regular）+ client 端 `groupSourcesByLine(state.lines)` + 本地 `LineHealthDrawer`（仿 TabLines 范式）。不扩 `getVideoMatrix`（client fn + 后端端点均保留），不反向 import 审核台内部（依赖方向单向）。
- **执行模型**：claude-opus-4-8
- **子代理**：无（消费已有 PRE-2 控制器 + admin-ui 已就位组件；无新共享契约 / 无新 ADR）
- **修改文件**：
  - `apps/server-next/src/app/admin/sources/_client/SourceLinesExpand.tsx`（**新建** ~220 行）— 消费 `useSourceLinesController` + `<LinesPanel density="regular">` + `groupSourcesByLine`；toggle/disableDead/refetch 失败 → `actionError` 红条 / probe·render·batch 结果 → `useToast` 浮层（与审核台 LinesPanel 同口径 / 内联中文 = sources 模块无 i18n）；本地 `LineHealthDrawer`（open/page/events/loading/error + title 拼接，取数走 `actions.fetchHealth`）；**不传** `onLineSelect`（无选中态）/ `onToggleLine`（controller 无 line 级 toggle，与审核台·TabLines 一致）。
  - `apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx`（`renderExpandedRow` `<MatrixExpand>`→`<SourceLinesExpand>` + import 同步）
  - `apps/server-next/src/app/admin/sources/_client/SourceMatrixRow.tsx`（删 `MatrixExpand` + 已死的 `SourceMatrixRow` 主组件〔CHG-VSR-5-A 表格化后无消费方〕 + `EpisodeCellBlock` + 矩阵网格常量/类型/import〔`getVideoMatrix`/`LineMatrixRow`/`Image`/`useState`/`CSSProperties`〕；**保留** `SignalPill` + `PILL_VARIANT`/`PILL_LABEL`〔SourceColumns 探测/试播列依赖〕；文件 473→73）
  - `tests/unit/components/server-next/admin/sources/SourcesClient.test.tsx`（删 `getVideoMatrix` mock 依赖 → 补 controller 函数 mock〔fetchVideoSources/fetchLineHealth/toggleSource/disableDeadSources/refetchSources/probeOneSource/renderCheckOneSource/batchProbeVideo/batchRenderCheckVideo/toDisplayState〕；新增 12 集行展开测试：点行 → 经 controller useEffect 调 `fetchVideoSources(videoId)` + 渲染 `sources-lines-expand` LinesPanel + `12/12集` 全聚合证不截断）
- **新增依赖**：无。
- **数据库变更**：无。无新端点 / 无新 ADR / 无 schema 变更 → architecture.md 零同步。
- **门禁**：typecheck 8 workspace EXIT=0 / lint EXIT=0（新文件 `SourceLinesExpand` 零新增警告；既有 `SourcesClient:164` exhaustive-deps 为 CHG-VSR-5-B 设计性收敛，非本卡）/ verify:adr-contracts EXIT=0 / verify:endpoint-adr EXIT=0（203 admin 路由对齐，无新端点）/ **全量 450 files 5955 passed 0 failed 零 flaky**（比 PRE-2 5954 +1 = 本卡展开测试；SourcesClient 10 + lines-panel 16 受影响套件全绿）。
- **验收要点闭环**：① 任意集数不截断 ✅（LinesPanel 行展开后渲染全部集，无 `.slice`；12 集 fixture 测 `12/12集`）② 消除 render 阶段请求 ✅（controller 在 `useEffect` 内 reload，非 render 内 setState）③ 全操作接通 ✅（单集/整组 toggle·probe·render·disableDead·refetch·health 经 controller actions；codename/retired/auto_retired 经 `groupSourcesByLine` + LinesPanel 内建显示）。
- **e2e**：`sources-sort-filter-smoke.spec.ts` 测 page-load/sort/filter（不展开行）+ 全 e2e 无依赖旧 `MatrixExpand` 结构（grep "matrix" 仅命中无关的 codename-matrix-picker）→ **本卡零 e2e 影响**；展开区 e2e 覆盖归 CHG-VSR-7（沿用 CHG-VSR-3/5「e2e 留 7」范式 + 本机鉴权 env 阻塞既有 / DTAF-VIEWPORT 阻塞 test 3）。
- **注意事项**：① drawer 第 3 处本地内联（仿 TabLines），提取共享 `useLineHealthDrawer` 拆 follow-up 卡 `CHG-VSR-6-FOLLOWUP-DRAWER-HOOK`（task-queue #14 / Opus 评审 + 审核台关键路径回归 / 用户裁决 2026-06-02）。② `getVideoMatrix`（client fn）+ `LineMatrixRow` 类型 + 后端 `/admin/sources/video-groups/:id/matrix` 端点删 MatrixExpand 后无 UI 消费方，但保留不删（不在本卡范围 / 关联端点契约审计 / 清理可并入 follow-up）。
- **Codex stop-time review FIX（源全量分页 / 不截断 >100 源）**：`fetchVideoSources`（`lib/sources/api.ts`，PRE-2 移入）原 `limit=100&page=1` 单页拉取 → 视频源行 >100（长剧集 × 多线路）**静默截断**，与函数 doc「拉取视频**全部**播放源」+ 本卡「任意集数不截断」验收冲突（后端 `/admin/sources` `limit` zod cap=100，单请求无法超）。改为**按 `total` 分页循环拉全量**（`PAGE_SIZE` 维持后端 cap 100；终止 = 空页防御 ∨ `all.length>=total`，无死循环）；三消费方（审核台 LinesPanel / 编辑抽屉 TabLines / sources 展开区）共享此修复。`tests/.../sources-api-url.test.ts` +4 用例（≤100 单页不发第二页 / 250 循环分页 3 次 id 唯一无丢 / 200 整除边界收齐即停不发空页 / 空结果终止不死循环）。复跑 typecheck 8ws / lint EXIT=0（`for(;;)` 未触发 no-constant-condition）+ **全量 5959 tests 5958 passed**（新增 4 分页用例；1 失败=`VideoImageSection` jsdom waitFor flaky，隔离重跑 21/21 通过，CHG-VSR-3/PRE-2 已记既有非确定性，与本卡无关）。
- **[AI-CHECK]**：结构检查 分层 NO 违反（SourceLinesExpand → lib/sources controller + @resovo/admin-ui，UI 不直调 DB）/ 跨模块 NO（不反向 import /admin/moderation 内部，依赖方向单向）；代码质量 重复逻辑 部分（drawer 第 3 处，已拆 follow-up 卡显式记录）/ hack NO；规模检查 函数 NO（handleActionResult switch <55 行 / 组件声明性组装 / fetchVideoSources 分页循环 <20 行）/ 文件 NO（SourceLinesExpand 222 / SourceMatrixRow 73 均<500）；安全 副作用/吞异常 NO（loadHealth `.catch` 设 healthError，无空 catch；分页终止双条件防死循环；颜色全 CSS 变量零硬编码）。结论：SAFE。

## [CHG-VSR-4-A] 视频库列重构（复合显示列 + 默认隐藏原子可筛选列 + 数据格式 / 设计 §2.2/§2.3/§2.4/§2.5/§2.6）

- **背景/问题**：视频库表格列集仍为 reference §6.1 旧标杆（15 列：cover/title/type/year/source_health/probe/image_health/visibility/review_status/enrichment/douban_status/meta_score/created_at/updated_at/actions），与职责回归后的设计 §2.2 脱节——线路类信息（source_health/probe）占据默认视图、缺集数/发行/内容状态复合列、缺 country/连载/发布/bangumi 原子列。CHG-VSR-1/2 已补齐 DTO 字段（title_original/country/status/episode_count/current_episodes/total_episodes/bangumi_status）与 API 排序白名单，但前台列定义未消费。
- **方案**：重组列定义对齐设计 §2.2 默认可见复合列 + §2.3 降级可选列 + §2.6② 默认隐藏原子列；复合列只读不挂筛选；复合列 id 语义化 + client 侧 id→后端 sortField 映射打通排序（沿用 CHG-VSR-5-A sources 页先例，不扩 DataTable 公共契约）。filter 接线（原子列 enum/range）与搜索框/快捷筛选/行操作/头部清理留 CHG-VSR-4-B。
- **执行模型**：claude-opus-4-8（建议 sonnet；人工以 opus 启动会话，沿用 CHG-VSR 系列偏离 — 纯消费方列重构，opus 不降质）
- **子代理**：无（无新共享组件 API 契约 / 无 schema / 无 ADR；复用既有 admin-ui 组件 Pill/VisChip/Thumb/DualSignal/EnrichmentBadgeCluster/CountryName）
- **修改文件**：
  - `apps/server-next/src/app/admin/videos/_client/VideoColumns.tsx`（列定义重构核心 269→~430 行〔声明性数组，<500〕）— 默认可见 9 列：cover / title「视频」(副行 `{title_en ?? title_original} · {short_id}`，pinned，q text filter 保留) / type(enum filter 保留) / **release 发行信息**(复合：`{year} · <CountryName>` + `<Pill>{完结/连载/未知}` 取 mc.status / sortable→year / 不挂筛选) / **episodes 集数**(§2.4 降级 render / sortable→episode_count / 不挂筛选) / **meta 元数据**(EnrichmentBadgeCluster density=row，原 enrichment 列 id 重命名 / sortable→meta_score / 不挂筛选) / **status 内容状态**(VisChip〔visibility×review〕 + 发布 dot〔已上架/草稿〕/ sortable→review_status / 不挂筛选) / updated 更新时间(默认可见，§2.5 / sortable→updated_at) / actions。§2.3 降级默认隐藏：source_health(保留 sortable→source_health) / probe(占位 placeholder) / image_health。§2.6② 默认隐藏原子列(render-only / filter 接线留 4-B)：year / country(CountryName) / catalog_status 连载(Pill) / visibility(保留既有 enum filter) / review_status(保留既有 enum filter) / is_published(Pill) / douban_status(4 态中文) / bangumi_status(仅 anime 4 态中文) / meta_score / created_at(保留 sortable)。**复合列与未接线列一律显式 `filterable:false`**（D-150-AMD2-1 data-kind 默认 filterable=true，§2.6「复合显示列只读不挂筛选」硬约束）；4-A 筛选面收敛 = title/type/visibility/review_status（既有可用）；抽 ReleaseCell/EpisodesCell/StatusCell render helper 控制函数长度。
  - `apps/server-next/src/lib/videos/columns.ts`（`VIDEO_COLUMN_DESCRIPTORS` 同步新列集 22 条 id/header/defaultVisible/enableSorting，与 buildVideoColumns 逐列对齐 — 驱动 useTableQuery 列可见性持久化 + 排序指示符命名空间；enrichment→meta 重命名 / source_health·probe·image_health·visibility·review_status 默认隐藏）
  - `apps/server-next/src/app/admin/videos/_client/VideoFilterFields.tsx`（`buildVideoFilter` 加 `COMPOSITE_SORT_MAP`：release→year / episodes→episode_count / meta→meta_score / status→review_status；DataTable 排序以 column.id 作 sort.field〔`sortable` 仅看 enableSorting，无独立 sortField 契约〕→ 先映射再白名单守卫，缺失兜底原 id 直通；白名单 +episode_count 同步后端 SORT_FIELDS〔CHG-VSR-2〕；enum filter / chip / 搜索框组件不动 → 留 4-B）
  - `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx`（仅默认排序 `created_at desc`→`updated_at desc`，§2.5「最近信息变更」视角；field='updated_at' 与 updated 列 id 一致〔排序指示符命名空间〕；toolbar/导出/views/options 注入不动 → 留 4-B）
  - `tests/unit/components/server-next/admin/videos/VideoColumns.test.tsx`（**新建** 25 用例：列集结构〔默认可见列=§2.2 / §2.3·§2.6② 默认隐藏〕+ §2.6 复合列 filterable:false + sortable + 筛选面收敛断言 + §2.4 集数降级 5 例〔电影/三值/已播>收录 warn/仅收录/全空〕+ release·status·title 复合 render + buildVideoFilter 排序映射 8 例）
  - `tests/unit/components/server-next/admin/videos/enrichment-cluster-faces.test.tsx`（同步列重构：descriptor 断言 `enrichment`→`meta`；「无 summary 不渲染簇」锚点从已降级隐藏的 `source-health` testid 改为 title 列文本 `findByText('某番')`）
- **新增依赖**：无。
- **数据库变更**：无。无新端点 / 无新 ADR / 无 schema 变更 → architecture.md 零同步。
- **门禁**：typecheck 8 workspace EXIT=0 / lint 5 successful EXIT=0（VideoColumns/VideoFilterFields/columns/VideoListClient 零新增警告；既有 AuditClient/CrawlerRunsView/SourcesClient/TabImages 警告非本卡）/ verify:adr-contracts EXIT=0（enum-ssot 84 处 advisory 为既有 baseline，本卡未新增 z.enum）/ verify:endpoint-adr EXIT=0（203 admin 路由对齐，无新端点）/ **全量 451 files 5984 passed 0 failed 零 flaky**（比 CHG-VSR-6 5959 基线净 +25 = 本卡新增 VideoColumns.test；videos 套件 116 全绿）。
- **验收要点闭环**：① 复合显示列只读不挂筛选 ✅（release/episodes/meta/status `filterable:false`，单测断言；data-kind 默认 filterable=true 故显式抑制）② 默认可见列与 §2.2 一致 ✅（cover/title/type/release/episodes/meta/status/updated_at/actions，单测断言列顺序）③ 列宽/排序对齐 ✅（复合列点列头按子字段排序 = COMPOSITE_SORT_MAP 映射后端字段，单测 8 例验证；列宽 width/minWidth 对齐 §2.2；e2e dt-resize-handle-cover/actions 依赖保留）④ §2.4 数据格式降级 ✅（集数 NULL/电影/已播>收录 warn+hover，单测 5 例）。
- **e2e**：video e2e specs（`tests/e2e/admin/videos.spec.ts` / `videos-column-resize.spec.ts` / `video-governance.spec.ts`）仅依赖 `video-list-table` testid + title 文本 + `row-actions-trigger` + 编辑 drawer + batch bar + `[role="columnheader"] [data-dt-resize-handle]`〔列无关〕+ `dt-resize-handle-cover/actions`——均被本卡保留，**结构上零破坏**（grep 实证无 source-health/enrichment/旧列头依赖）；实跑因本机鉴权 env（curl :3003/admin/videos→307 / middleware 走真实 :4000）阻塞，沿用 CHG-VSR-3/5/6「e2e 留 7」范式归 CHG-VSR-7 专项回归卡。
- **注意事项**：① enrichment→meta 列 id 重命名 → 旧 localStorage 列可见性偏好 + saved-views 中 'enrichment' key 一次性失配（meta 用默认可见 = true，无功能影响；saved-views 本批次暂缓 §7-7）。② §2.6② 原子列在 4-A 为 render-only（filterable:false），enum/number-range filter 接线（filterFieldName/filterKind/filterOptions + buildVideoFilter 解析 + distinct 注入）+ 搜索框 q 多列扩面 + 快捷筛选 B + VideoRowActions 扩展（查看播放线路等）+ 导出 CSV 移 PageHeader + FilterChipBar 删除 + 视图保存移除 → 全归 CHG-VSR-4-B。③ cover 列 width 保留 72（poster-md 48 + padding 24 贴合内容，设计 §2.2 标 56 沿用旧 poster-sm 与 poster-md 矛盾 / e2e dt-resize-handle-cover 依赖）。④ 4-A→4-B 过渡期 visibility/review 筛选保留（既有），country/连载/发布/bangumi/year-range/meta_score-range 筛选暂缺（4-B 补齐）。
- **[AI-CHECK]**：结构检查 分层 NO 违反（列定义消费 @resovo/admin-ui + lib/videos 类型，UI 不直调 DB）/ 跨模块 NO（columns 层内联 VISIBILITY_LABELS 避免反向依赖 VideoFilterFields）；代码质量 重复逻辑 NO（render helper 抽 ReleaseCell/EpisodesCell/StatusCell；catalogStatus 映射复用于 release + catalog_status 列）/ hack NO / any NO / 空 catch NO；规模检查 函数 NO（buildVideoColumns 声明性数组 / 各 helper <30 行）/ 文件 NO（VideoColumns ~430<500）；样式 颜色全 CSS 变量零硬编码（state-warning-fg/state-success-fg/fg-muted/...）；边界 复合列 filterable:false 满足 §2.6 / 排序映射不扩 admin-ui 契约（§0.3）。结论：SAFE。
- **Codex stop-time review FIX（回访用户列布局失效 / 新默认表可靠生效）**：`useTableQuery` 将列可见性持久化到 localStorage `admin-ui:table:{tableId}:v2`，`storage-sync.readLayout` 仅 schema 校验、**不对账列集默认可见性变化** → §2.2 重构后回访用户旧 stored 偏好（source_health/probe/visibility/review 显示、updated 隐藏）覆盖新 `defaultVisible`，新默认表不可靠 ship。修复：`VideoListClient` tableId `'admin-videos'`→`'admin-videos-v2'`，按既有 `:v1`→`:v2` 版本失效范式**定向 bump 本表 id**（不动 admin-ui 共享 `LAYOUT_VERSION` 以免波及其他表 / saved-views 独立 key 不受影响 / 一次性重置本表列定制 = 列重设计预期行为）。新建 `VideoListClient.layout-reset.test.tsx`（独立模块 → tableQueryStore 单例全新）：预置**旧 key** stale 偏好（source_health:visible），断言新默认下 source-health 隐藏 + episodes/status 复合列渲染 → 旧 key 被忽略；**护栏验证**：临时 revert tableId 回 'admin-videos' 该测试转红（读旧 key→source-health 渲染），bump 后转绿。复跑 typecheck 8ws EXIT=0 / lint 5 successful 零新警告 / videos 套件 9 files 117 passed（+1 回归）。

## [CHG-VSR-4-B] 视频库三层过滤 + 行操作 + 快捷筛选(B 统计计数)（设计 §1.1/§2.1/§2.6/§7-7）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 13:10
- **执行模型**：claude-opus-4-8（建议 sonnet；会话以 opus 主循环启动 = 人工覆盖，workflow-rules §模型字段约束允许不阻断；纯前端接线无须升 Opus 决策项）
- **子代理**：无
- **用户裁决（2026-06-02）**：Q1=快捷筛选统计计数走**前端轻量 count 查询**（3 个 `listVideos({k:true,limit:1})` 读 `total`，纯前端，不新增后端 stats 端点）；Q2=**扩 VideoEditDrawer 加 `initialTab`**（加性默认 basic）支撑行操作深链。
- **修改文件**：
  - `apps/server-next/src/app/admin/videos/_client/VideoFilterFields.tsx` — `buildVideoFilter(snapshot, quickFilters?)` 扩三层映射（year/metaScore `range`→min/max；country/catalogStatus/douban/bangumi `enum` 多选→数组；isPublished 单值 published/draft→bool；快捷筛选 Set→pendingReview/metaIncomplete/episodeMismatch 仅 true）+ `getEnumArray/getRange` helper + `VIDEO_QUICK_FILTERS`/`VideoQuickFilterKey` 常量；`VideoFilterBar` 由 status/site 下拉 → 单一 `q` 搜索框（300ms debounce + filtersRef 防并发列筛选丢失 + 外部 q 同步 + 卸载清 timer）；**删 `buildFilterChips`/`FILTER_LABELS`/`getFilterDisplayValue` 死代码**（FilterChipBar 退场 §1.1-5）；保留 status/site 映射供 URL 向后兼容。
  - `apps/server-next/src/app/admin/videos/_client/VideoColumns.tsx` — 7 原子列 `filterable:true` 接线（year/meta_score `number`；country `enum`+`filterDistinctTable:'media_catalog'`；catalog_status/is_published/douban_status/bangumi_status `enum`+静态 `filterOptions`）+ 静态选项常量（取 @resovo/types SSOT 值域 + 本地中文 label）；`onEditRequest` 扩 `(id, tab?)`。
  - `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx` — 删 `FilterChipBar`/`viewsConfig`/saved-views/sites 消费；**导出 CSV 接到 PageHeader 按钮**（onClick=handleExportCsv，rows 空 disabled）；快捷筛选(B) 子标题（{total} 条 · 全部 · 待审/元数据缺失/集数不一致 可点击 chip，aria-pressed + 可组合 + 全部清空 + 切换回 page1）+ 独立 `quickFilters` Set state + 3 count 查询（挂载/批量后刷新）；`distinctFetcher={fetchDistinct}` 接线；`handleEditRequest(id, tab?)` + `editTab` state → `initialTab` 透传。
  - `apps/server-next/src/app/admin/videos/_client/VideoRowActions.tsx` — 新增 图片素材→images / 外部元数据→external / 查看播放线路→lines（深链 VideoEditDrawer tab），`onEditRequest` 扩 tab 参。
  - `apps/server-next/src/app/admin/videos/_client/VideoEditDrawer.tsx` — 加性 `initialTab?: TabKey`（缺省 basic；创建模式强制 basic；open 时 setTab）。
  - `apps/server-next/src/lib/videos/api.ts` — 加性 `fetchDistinct(table,field,q,signal)`（复用 `/admin/_dt/distinct`；country 列用 `formatCountryName` 把 ISO→中文 label，值仍 ISO）+ `DistinctOption` 类型。
  - 测试：`VideoColumns.test.tsx`（filterable 面 4→11 列 + filterKind/filterFieldName/distinct 断言）；`VideoListClient.test.tsx`（删 buildFilterChips 块；+原子映射 8 例 + 快捷筛选 4 例 + VIDEO_QUICK_FILTERS）；`SelectionActions/enrichment-cluster-faces/VideoListClient.client/VideoListClient.layout-reset` 4 测试 mock 补 `fetchDistinct`（严格 mock 缺导出修复）。
- **新增依赖**：无
- **数据库变更**：无（消费 CHG-VSR-2 既有过滤参数；fetchDistinct 复用既有 `/admin/_dt/distinct` 端点，无新 route → verify:endpoint-adr 203 路由对齐 EXIT=0）
- **门禁**：typecheck 8 workspace EXIT=0 / lint 5 successful（4 改文件零新警告，既有 Audit/Crawler/Sources/TabImages 警告非本卡）/ verify:adr-contracts EXIT=0（advisory 均既有 baseline，enum 引用走 @resovo/types SSOT 未新增违规）/ verify:endpoint-adr EXIT=0 / **全量 452 files 5993 passed + 1 flaky**（`CrawlerRunsView.test.tsx` jsdom navigation 计时器干扰，隔离重跑 33/33 通过 / crawler 模块与本卡正交，同既有 flaky 模式）。
- **注意事项**：① 快捷筛选统计计数为**全局口径**（不随当前 search/列筛选变化，对齐设计 §2.1 «695 条 · 待审 12 …»），挂载 + retryKey（批量操作后）刷新 3 个 limit=1 count 查询；计数加载失败 → 不显示数字（筛选仍可用）。② 快捷筛选 state 用独立 React `Set`（**不入 snapshot.filters**）规避 bool URL 往返 kind 推断歧义 → 不持久化到 URL（会话态，设计未要求 URL 持久化）。③ `type`/`visibility`/`review` 维持单值 enum（D-150-VSR2-4 单值零回归）；`country/catalog/douban/bangumi` 多选数组。④ country 列筛选选项走 distinct 端点（值为 ISO code，`formatCountryName` 提供中文 label）。⑤ `saved-views.ts` 现无消费方（视图保存暂缓 §7-7「本批次暂缓，后续评估入口形态」）= **有意保留待复用，非死代码遗漏**；`status`/`site` buildVideoFilter 映射保留供 URL 向后兼容（UI 入口已撤）。⑥ isPublished enum 多选 UI 取首值（getEnumFirst）→ 同时选 published+draft 取 published（«单值» 语义边界，可接受）。⑦ e2e（VIDEO 路径）归 CHG-VSR-7（无 e2e-next 视频 spec / 本机鉴权 env :3003→307 阻塞，沿用 4-A/5-A/6 deferral）。
- **[AI-CHECK]**：分层 NO 违反（UI 经 lib/videos/api + admin-ui，不直调 DB / fetchDistinct 走 apiClient）；跨模块 NO（VideoColumns 内联枚举选项避免反向依赖）；重复逻辑 NO（getEnumArray/getRange/fetchDistinct 单点）；hack/any/空 catch NO；颜色全 CSS 变量（--admin-accent-soft/-border 复用 PRE-3，零硬编码）；函数/文件规模 NO（VideoListClient 声明性 / VideoFilterFields VideoFilterBar <40 行）；边界 复合列保持 filterable:false 不扩 DataTable 契约（§0.3 阻断项 1）。结论：SAFE。

## [CHG-VSR-DTAF-VIEWPORT] DataTableAutoFilter popover 视口溢出修复（高页面「应用」不可达）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 14:05
- **执行模型**：claude-opus-4-8（建议 sonnet；会话以 opus 主循环启动 = 人工覆盖；无公开 Props/行为契约变更故不触发强制 Opus 评审）
- **子代理**：无
- **根因**：`header-menu.tsx` 两定位 effect 恒向下展开（`top: rect.bottom + 4`）无视口感知；sources 页 4 KPI 卡下表头 y≈350 + popover 最高 480px → footer `[data-actions]`「应用」压到视口底/右下角，撞 Next dev 浮标拦截点击（e2e sources smoke test 3 红 54 重试）。
- **修改文件**：
  - `packages/admin-ui/src/components/data-table/header-menu.tsx` — 新增纯函数 `computeHeaderMenuPosition(rect,panelW,naturalH,vw,vh)`（导出仅供单测/未进 index）：① 下方放得下完整 **且 footer 距视口底 ≥ SAFE_BOTTOM_GAP(56)** → 向下（top 锚定）；② 否则上方放得下完整 → flip-up（CSS `bottom` 锚定表头上沿，footer 落表头上方）；③ 上方够用(≥MIN_FLIP_SPACE 160) → flip-up；④ 兜底向下贴底 + maxHeight 内滚；+ 水平右溢 clamp。统一 `reposition(measure)` 替换原恒向下两 effect（开启 `measureNatural` 清约束→实测自然宽高→还原〔useLayoutEffect paint 前无闪烁〕缓存 `naturalSizeRef`，scroll/resize 仅重锚不重测防布局抖动）；两 portal 返回应用 `top`/`bottom` 互斥锚定 + maxHeight（autofilter 经 Record 断言注入 `--dt-autofilter-max-height` CSS var + outer overflow:hidden 兜底；regular menu maxHeight + overflowY auto）。
  - `packages/admin-ui/src/components/data-table/dt-styles-matrix.ts` — `[data-autofilter-popover] max-height: 480px` → `var(--dt-autofilter-max-height, 480px)`（header-menu 注入 min(480,可用)，缺省回退 480 维持原行为）；`[data-value-list]` 加 `min-height: 0`（popover 受视口约束时随 flex 父收缩，footer 不被挤出）。
  - `tests/unit/components/admin-ui/table/header-menu-position.test.ts`（新建）— 9 用例覆盖向下/flip-up（fits-above + MIN_FLIP_SPACE）/贴底内滚/水平 clamp/SAFE_BOTTOM_GAP 边界等号 + **test 4 回归守卫**（中部表头 footer 贴底 → flip-up）。
- **新增依赖**：无
- **数据库变更**：无（纯前端定位/CSS；无端点/schema/ADR）
- **门禁**：typecheck 8 workspace EXIT=0 / lint 5 successful EXIT=0（header-menu/dt-styles 零警告）/ verify:adr-contracts + verify:endpoint-adr EXIT=0 / **全量 453 files 6002 passed + 1 flaky**（`StagingEditPanel.test.tsx` 隔离 12/12 通过 / admin/staging 与本卡正交，同 CHG-VSR-5-A 既有 flaky）/ 新增 9 定位单测。**e2e 实测**（直连 :3003 绕 :3000 webServer 冲突 / 临时 config 去 webServer，用后即删）：`sources-sort-filter-smoke.spec.ts` **4/4 PASS** — test 3（probe filter「应用」）目标转绿 + test 1/2/4 零回归。
- **注意事项**：① **修复迭代过程**：纯 maxHeight cap 首版修好 test 3 但回归 test 4（footer 压右下角撞 Next dev 浮标 N 钮拦截点击）；经 stash 基线对照确认回归，改 SAFE_BOTTOM_GAP 触发 flip-up（footer 落表头上方远离底边/右下角）同时解 test 3/4。② Next dev 浮标（`<nextjs-portal data-nextjs-dev-overlay>`）是 **dev-only 工具叠层**（生产无），但 footer 压视口底/右下角的定位缺陷在生产同样不良（贴底/可能被分页条遮挡），SAFE_BOTTOM_GAP 是正确通用修复。③ 无公开 Props/契约变更（HeaderMenuProps 字段零增删 / `computeHeaderMenuPosition` 未在 admin-ui index 公开）→ 不触发 admin-ui Props trailer / 强制 Opus 评审。④ 解阻 **CHG-VSR-7** 的 `test:e2e` 门禁（sources smoke test 3 此前为其前置 blocker）。
- **[AI-CHECK]**：分层 NO 违反（admin-ui 表格内部定位逻辑）；颜色零硬编码（仅 CSS var / 数值为视口几何）；any NO（CSS var 经 `Record<string,string|number>` 断言而非 any）；空 catch NO；函数规模 NO（computeHeaderMenuPosition 声明性 <30 行 / measureNatural <20 行）；契约 NO 扩张（pure helper 测试导入）。结论：SAFE。

## [CHG-VSR-7] 回归测试（VSR 序列收官 / VIDEO+SOURCES e2e 全绿）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 14:45
- **执行模型**：claude-opus-4-8（建议 sonnet；会话以 opus 主循环启动 = 人工覆盖）
- **子代理**：无
- **性质**：VSR 序列（CHG-VSR-1..6 + PRE-1..3 + 4-A/4-B + 5-A/5-B + DTAF-VIEWPORT）收官回归卡——三门禁 + VIDEO/SOURCES e2e 全过、零回归验证。
- **修改文件**（仅测试基建修复，零生产代码改动）：
  - `tests/e2e/admin/videos.spec.ts` — ① **fall-through `route.continue()` → `route.fulfill(404)` 隔离**（**VIDEO e2e 长期阻塞真因**：admin shell 挂载即拉 `/admin/notifications` + `/admin/system/background-events` + `/admin/system/jobs`，原 `route.continue()` 把这些未匹配请求转发真实 :4000 → mock 会话 `mock-mod-rt` 无效 → **401** → apiClient 401 拦截器 refresh 失败 → `window.location.assign('/login')`〔`api-client.ts:124-137`〕→ 页面加载前跳登录；改 404〔≠401〕不触发鉴权重定向，shell degraded mode 容忍 → 正常渲染，对齐 sources smoke 已用的 404 隔离范式）；② test 2 搜索 testid `filter-q` → `videos-search-input`（CHG-VSR-4-B VideoFilterBar status/site 下拉 → q 搜索框漂移）；③ test 5 确认按钮 locator `getByText('确认')` → `getByRole('button',{name:'确认'})`（confirm 标题「确认隐藏 N 条视频？」含「确认」致 strict-mode 双命中）。
  - `tests/e2e/admin/videos-column-resize.spec.ts` — 同 ① fall-through `route.continue()` → 404 隔离（同一阻塞真因）。
- **新增依赖**：无
- **数据库变更**：无
- **门禁/验收**（全过）：
  - `npm run test -- --run`：**453 files 6001 passed + 2 flaky**（`AuditClient.test.tsx` test 22 矩阵 popover + `StagingEditPanel.test.tsx` 元数据保存，两者隔离重跑各 22/22、12/12 通过 = 并行测试污染既有 flaky，非 VSR 回归）。
  - `verify:adr-contracts` + `verify:endpoint-adr`：EXIT=0。
  - `test:e2e`（VIDEO/SOURCES，admin-next-chromium 直连 :3003 / 临时去 webServer config 绕 :3000 冲突，用后即删）：**18/18 PASS** = videos.spec(5) + videos-column-resize.spec(5) + sources-sort-filter-smoke(4，含 CHG-VSR-DTAF-VIEWPORT 修复验证) + codename-matrix-picker(4)。
  - typecheck 8ws / lint 5 successful EXIT=0。
- **功能域覆盖确认**（VSR-1..6 已逐卡沉淀，本卡核验无空缺）：动漫集数降级（VideoColumns.test EpisodesCell §2.4）/ Bangumi 筛选（VideoColumns + VideoListClient bangumiStatus）/ 连接·试播失败·待补源·待探测（sources-matrix(-service).test + SourcesClient + VideoListClient quickFilters）/ 批量探测·长剧集展开不截断（use-source-lines-controller + sources-api-url 分页）。
- **注意事项**：① **VIDEO e2e 长期「鉴权 env 阻塞」根因厘清**——非环境/鉴权配置问题，而是 videos 两 spec fall-through 用 `route.continue()` 把 admin shell 的未匹配请求（`/admin/notifications` / `/admin/system/background-events` / `/admin/system/jobs`）漏到真实 :4000 → 401 → apiClient refresh 失败重定向 /login（sources smoke 早用 404 隔离故能跑）；改 404 后 10 个 VIDEO e2e 全绿，前序卡（4-A/5-A/5-B/6）「归 CHG-VSR-7」的 e2e 阻塞至此全部闭环。② 仅修既有 tests/e2e/ spec（testid/locator/fall-through 漂移）= 维护，未在 tests/e2e/ 新增测试（遵守重写期目录约定）。③ e2e 实跑依赖本机 :3003(server-next)+:4000(api) 运行 + 临时去 webServer config（CI 环境走标准 `npm run test:e2e`）。
- **Codex stop-time review FIX（根因证伪 + 删死 mock）**：原 commit `5342a367` 的 closeout 误判根因为「缺 `/auth/me` 会话端点 mock」并据此补了 `/auth/me`+`/auth/refresh` mock。**诊断实测（route handler 加临时日志）证明 `/auth/me` 从未被调用 = 死代码**；真正命中 fall-through 的是 `/admin/notifications`+`/admin/system/background-events`+`/admin/system/jobs`，真正的修复是 `route.continue()` → 404（404≠401 不触发 apiClient 鉴权重定向）。修正：删除两 spec 的死 `/auth/me`+`/auth/refresh` mock，仅保留 404 fall-through + 改正根因注释；删后复跑 10 VIDEO e2e 仍全绿（证 404 兜底为真修复、auth mock 确为死代码）；typecheck/lint EXIT=0。
- **[AI-CHECK]**：零生产代码改动（仅测试基建修复 + docs）；无 any / 无空 catch / 颜色无关；分层无违反。VSR 序列功能正确性经 18 e2e + 6001 unit 实证零回归。结论：SAFE。

## [CHG-VSR-6-FOLLOWUP-DRAWER-HOOK] 提取共享 `useLineHealthDrawer`（消除 3 处 health drawer 重复）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 15:30
- **执行模型**：claude-opus-4-8（建议 opus，一致）
- **子代理**：arch-reviewer (claude-opus-4-8) — 设计/评审 hook API 契约（CONDITIONAL PASS + 蓝图：API 类型 + 8 抉择裁决 + 6 红线 R-1..R-6 + 10 单测用例）。**CLAUDE.md §模型路由「定义新共享组件 API 契约」强制 Opus 子代理 + commit trailer**。
- **背景**：CHG-VSR-PRE-2 注意 ③ + CHG-VSR-6 引入第 3 处 health drawer 本地实现，达「同一 UI 模式 3 处必提取」阈值。
- **修改文件**：
  - 新建 `apps/server-next/src/lib/sources/use-line-health-drawer.ts` — 中性 hook `useLineHealthDrawer({ fetchHealth, loadFailedText? })` 返回 `[state, actions]`（对齐 controller 元组形态）。state: open/sourceId/page/events/total/limit/loading/error + 派生 `pagination`；actions: open/close/changePage/retry。**裁决（蓝图）**：① hook **不持有 probeState/renderState/title**（仅暴露 sourceId，消费方 render 时从自有 lines 派生 → 保留「快照 vs 实时」+ i18n title 的本地控制，R-4 审核台保持快照〔不触碰并发关键路径〕）；② `fetchHealth` 注入（来自 controller，数据所有权一致 + 便于单测）；③ **requestToken 并发保护**（R-1/R-2：自增令牌 + 响应回写前比对，快速切源/翻页/close 后 stale 响应丢弃 → **修复现有 3 处的 stale 覆盖缺陷**）；④ `loadFailedText` 可选注入（省略 → 无 error 态 = TabLines 现状；提供 → error+retry = moderation/sources 现状）；⑤ 分页阈值 `total > limit`，limit 取响应真值（R-6 禁硬编码 20）。
  - 改 `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（审核台 compact / **R-4 保持快照**：删 `HealthDrawerState`/`DRAWER_CLOSED`/`drawer` state + `handleHealthOpen`fetch/`handleHealthPage`，改为 open 时存 `snapshot{title,probeState,renderState}` 局部 state + hook 接管取数/并发/分页；`loadFailedText: M.lines.loadFailed` 必传〔R-3〕）。
  - 改 `apps/server-next/src/app/admin/videos/_client/_videoEdit/TabLines.tsx`（编辑抽屉 regular / 实时派生：删 4 health state + 4 handler，改用 hook；省略 loadFailedText 保持无 error 现状；title/probe/render 仍从 state.lines 实时派生）。
  - 改 `apps/server-next/src/app/admin/sources/_client/SourceLinesExpand.tsx`（行展开区 regular / 实时派生：删 6 health state + 4 handler，改用 hook + `loadFailedText: TXT.loadFailed`）。
  - 新建 `tests/unit/server-next/sources/use-line-health-drawer.test.ts` — 12 用例（U-1..U-10）：open 取数 / 切源 stale 丢弃(R-1) / close 后不回写(R-2) / 翻页 stale / 分页 `total>limit` + limit 取真值(R-6) / error 注入 vs 省略 + retry / 同源重入刷新 / sourceId=null no-op / stale reject 不污染 error。沿用 controller 测试范式（`@vitest-environment jsdom` + 相对路径 + renderHook/act + 受控 Promise）。
- **新增依赖**：无
- **数据库变更**：无（纯前端 hook 抽取 / 复用既有 `/admin/moderation/:id/line-health/:sourceId` 端点，无新 route/schema/ADR）
- **门禁/验收**：typecheck 8ws / lint 5 successful EXIT=0（3 消费方 + hook 零新警告）/ verify:adr-contracts + verify:endpoint-adr EXIT=0 / **全量 454 files 6015 passed 0 failed 零 flaky**（净 +12 = 新 hook 单测；本轮 AuditClient/StagingEditPanel 既有 flaky 均过）/ hook 12 例 + SourcesClient（渲染 SourceLinesExpand）+ lines-panel + line-health-drawer + controller 6 文件 87 passed。
- **注意事项**：① **审核台 R-4 保持快照**：moderation/LinesPanel probeState/renderState/title 仍在 open 时快照（不改实时派生），并发 probe 期间已开抽屉头部 BarSignal 不跳变 = **零行为变更**（避免触碰并发关键路径）；TabLines/sources 保持实时派生。② **并发缺陷修复**：hook 的 requestToken 修复了原 3 处共有的 stale 覆盖缺陷（快速切源 A→B 时 A 的延迟响应不再覆盖 B / close 后响应不回写）—— 正向修复非回归。③ **TabLines 分页轻微一致性变化**：单页（total<=limit）不再显示「1/1（共 N 条）」分页栏（原 always-pass → 标准化 `total>limit`，与 moderation/sources 一致）；moderation/sources 本就 `total>20` 故无变化。④ **审核台 e2e 既有 env 阻塞**：moderation specs 因本机鉴权 env 登录重定向（PRE-2 已记录 / 页面加载前失败、LinesPanel 从未渲染 → 与本卡 drawer 改动无关、非回归 / 其 fall-through 已 200 与 videos 的 continue() 不同根因，修复属共享 moderation 测试基建超本卡范围）；drawer 关键路径回归由 12 例 hook 单测（开合/分页/并发/error）+ typecheck + 全量零回归覆盖。⑤ `LineHealthDrawerPagination` 未从 @resovo/admin-ui barrel 导出 → hook 内定义同形态 `HealthDrawerPagination`（结构兼容 LineHealthDrawerProps.pagination）。
- **Codex stop-time review FIX（retry 重取错误页）**：原实现 `setPage(targetPage)` 仅在 `load` 的 `.then` 成功分支设置 → 翻页**失败**时 `state.page` 仍为「上次成功页」，`retry()` 重取错误页（page 1 而非用户尝试的失败页 2）。这是对 `SourceLinesExpand` 原行为（`changeHealthPage` 立即 `setHealthPage`）的回归 + `moderation` 原潜在 bug。修复：`setPage` 移到 `open`(=1)/`changePage`(=nextPage) **立即设置**（拉取前），`load` 不再设 page → retry 重取「尝试页」（对齐 SourceLinesExpand 正确范式，且保留 token 并发守卫 events/total/limit 回写）。**修复后 3 消费方 retry 行为统一正确**（moderation 从潜在错误页修正为尝试页）。强化 U-6 为精确回归守卫（断言 reject page 2 后 `state.page===2` + retry 调 `fetchHealth('src-A', 2)`，旧实现取 1 会红）。复跑 hook 12/12 + typecheck/lint EXIT=0 + 全量 454 files 6015 passed（4 unhandled rejection = `use-filter-presets.ts:162` post-teardown `window is not defined` 既有 flaky〔CHG-VSR-2 已记录〕，隔离重跑 7/7 干净，与本 hook 无关）。
- **[AI-CHECK]**：分层 NO 违反（hook 在 lib/sources，UI 经 admin-ui）；跨模块 NO（hook 不 import 消费方 / 不下沉 i18n，R-5）；重复逻辑 **消除**（3 处 → 1 hook）；hack/any/空 catch NO（catch 内明确分支）；颜色无关；函数/文件规模 NO（hook ~150 行声明性）；契约经 arch-reviewer Opus CONDITIONAL PASS。结论：SAFE。

## [CHG-DT-HEAD-HEIGHT-DECOUPLE] 后台表格表头行高与 body 密度解耦（表头恒用 `--row-h` 40px）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 17:42
- **执行模型**：claude-opus-4-8（建议 sonnet；共享组件内部行为修正 + 单测，不改 Props 契约 / 不新增 token → 不触发 Opus 门禁，主循环模型已为 Opus 故直接实施）
- **子代理**：无（未改公共 Props 类型、未新增 token 字段，不触发 CLAUDE.md §模型路由强制 Opus 子代理三条件）
- **背景（根因）**：后台各列表页表头行高不一致——videos/sources（`density="poster"`）表头 **80px**、其余主列表（缺省 comfortable）40px、crawler 抽屉（compact）32px。根因：DataTable 表头高度 inline `height: rowHeight` 复用了 body 行的 density 令牌（`data-table.tsx` 单一 `rowHeight` 同时喂表头 `DataTableHeaderRow` 与 body `rowStyle`）。表头只渲染列名、无理由随 body 密度伸缩；poster 密度页面表头被撑到 80px。对照 v1 `ModernDataTable` 表头 `h-12`(48px) 本就与密度**解耦**——v2 重构误把表头耦合进密度令牌，属回归。
- **设计标准（确立）**：**后台表格表头行高 = 全站恒定 `var(--row-h)`（40px），与 body 行 density 完全解耦**；body 行高继续按 density 取令牌（comfortable 40 / compact 32 / poster 80 / relaxed 48）；新表格不得给表头单独设密度高度。
- **修改文件**：
  - `packages/admin-ui/src/components/data-table/data-table.tsx` — 拆出独立 `const headerHeight = 'var(--row-h)'`（密度无关），改 `<DataTableHeaderRow headerHeight={headerHeight} />`；body `rowStyle` 的 `height: rowHeight`（density 令牌）保持不变。
  - `packages/admin-ui/src/components/data-table/data-table-header-row.tsx` — 内部 prop `rowHeight`→`headerHeight`（`DataTableHeaderRowProps` 未从 barrel 公开导出，零外部影响）+ JSDoc 说明解耦语义；`height: headerHeight`。
  - `tests/unit/components/admin-ui/table/data-table.test.tsx` — +3 解耦断言（`querySelectorAll('[role="row"]')[0]`=表头 / `[1]`=首 body 行）：poster→表头 `var(--row-h)` & body `var(--row-h-poster)`；compact→表头 `var(--row-h)` & body `var(--row-h-compact)`；缺省→两者 `var(--row-h)`。
- **新增依赖**：无
- **数据库变更**：无（纯前端共享组件内部行为；无新 route/schema/ADR/token）
- **门禁/验收**：typecheck EXIT=0 / lint 5 successful EXIT=0 / verify:adr-contracts EXIT=0 / **全量 454 files 6018 passed 0 failed 零 flaky**（净 +3 解耦断言）/ data-table.test 28/28。
- **效果**：videos/sources 表头 **80→40px**、crawler 抽屉 32→40px、其余主列表（staging/merge/crawler 站点/runs/source-line-aliases/audit）不变；body 行高与 poster 缩略图零变化。
- **注意事项**：① `--row-h-relaxed`（48px）当前为 DataTable 不可达悬空令牌（density union 仅 comfortable|compact|poster），本卡不删，记后续 token 清理。② 复用现有 `--row-h` 而非新增 `--row-h-head` token，避免触发令牌层新增字段的 Opus 门禁、改动最收敛（用户已确认采用 40px 不新增 token）。
- **[AI-CHECK]**：分层 NO 违反（共享组件内部）；跨模块 NO；重复逻辑 NO（消除「表头误用 body 密度」的隐性耦合）；hack/any/空 catch NO；颜色无关（仅高度令牌）；函数/文件规模 NO；公共 Props 契约未变。结论：SAFE。

## [CHG-VSR-SOURCES-ROW-ACTIONS] 播放线路表格操作列三键实装（refresh / zap / more · 设计 §6.2）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 18:25
- **执行模型**：claude-opus-4-8（建议 sonnet；标准功能实现 + 复用既有 api/共享 AdminDropdown，无新共享契约/无 schema → 不触发 Opus 门禁，主循环已为 Opus 故直接实施）
- **子代理**：无（app-local 行操作组件，未定义共享组件 API 契约 / 未触碰 schema）
- **背景（根因）**：播放线路表格（SourcesClient/SourceColumns）操作列为纯占位（`SourceColumns.tsx` ↻/⋯ 仅 `stopPropagation`，无功能），注释「真实接通留 CHG-VSR-5-B + 6」但 5-B（KPI 快捷筛选）/ 6（LinesPanel 替换）均未接行操作。设计 §6.2 要求 `btn--xs ×3：refresh / zap / more`。
- **用户裁决（AskUserQuestion 2026-06-02）**：① 三键 = ↻ `batchProbeVideo`（重探连接）/ ⚡ `batchRenderCheckVideo`（重验播放）/ ⋯ `AdminDropdown`，均带 pending + toast + 刷新本行；② more 菜单 4 项 = 展开/收起线路 · 重新采集源 · 停用全失效源(danger/条件) · 线路别名管理。
- **修改文件**：
  - 新建 `apps/server-next/src/app/admin/sources/_client/SourceRowActions.tsx` — 行操作组件（范式对齐 videos `VideoRowActions`）。`run` 统一异步执行（`setPending(true)` → `await task` → `finally setPending(false)`，pending 期禁用全部按钮）；4 handler 各自 `try/catch` `useToast` 反馈（复用 SourceLinesExpand summary 文案 `ok/total · dead 失效 · failed 异常`，level success/warn/danger/info）+ 成功后 `onReload()`；条件菜单项「停用全失效源」仅 `(connectFailCount ?? 0)+(renderFailCount ?? 0) > 0` 时渲染 + danger；容器层 `onClick stopPropagation` 防误触行展开；3 键 + 菜单项 a11y（aria-label / title / data-testid）。
  - `apps/server-next/src/app/admin/sources/_client/SourceColumns.tsx` — `buildColumns(expandedKeys)` → `buildColumns(expandedKeys, actions: SourceRowActionHandlers)`；操作列 cell 占位双按钮 → `<SourceRowActions row expanded={expandedKeys.has(row.videoId)} onExpandToggle onReload />`；删占位 `ACTION_BTN_STYLE`（`CSSProperties` import 保留供 `MUTED_SM`）。**列 id `actions` 不变**（e2e 零破坏）。
  - `apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx` — 抽 `toggleExpand(videoId)` useCallback（行点击 `handleRowClick` + 操作列「展开/收起线路」共用）；`buildColumns` 传 `{ onExpandToggle: toggleExpand, onReload: refresh }`（`refresh` = retryKey bump 重取本行聚合信号）。
  - 新建 `tests/unit/components/server-next/admin/sources/SourceRowActions.test.tsx` — 10 用例（U-1..U-10）：↻→batchProbeVideo+onReload+success toast / ⚡→batchRenderCheckVideo+warn toast / probe 失败→danger toast 不刷新 / pending 禁用全部键（DOM `.disabled` 属性，本仓未装 jest-dom matcher）/ 重新采集源→refetchSources / 无失效源「停用全失效源」不出现 / 有失效源出现+点击→disableDeadSources / 展开线路矩阵→onExpandToggle / expanded=true 文案「收起线路」/ 线路别名管理→router.push。
- **新增依赖**：无（复用 `@resovo/admin-ui` AdminDropdown/useToast）
- **数据库变更**：无（复用既有 4 端点 batch-probe / batch-render-check / refetch-sources / disable-dead，无新 route/schema/ADR）
- **门禁/验收**：typecheck EXIT=0 / lint EXIT=0 / verify:adr-contracts EXIT=0 / **全量 455 files 6028 passed 0 failed 零 flaky**（净 +10 = SourceRowActions.test）/ sources 4 文件 37/37（含 SourcesClient.test 渲染新 cell 零破坏）。
- **注意事项**：① 「停用全失效源」为条件 danger 项，无失效源时不渲染（避免无意义操作）。② toast level：探测/试播无失效→success、有失效→warn、请求异常→danger、停用 0 源→info。③ 列 id `actions` 与全部既有列 id 不变，sources smoke e2e（CHG-VSR-7）零破坏。④ bulkActions 顶部「批量验证」按钮仍为占位（超本卡范围，未触碰）。
- **[AI-CHECK]**：分层 NO 违反（UI 经 lib/sources/api，不直连 DB）；跨模块 NO（复用 videos 范式 + 共享 AdminDropdown，不反向依赖）；重复逻辑 NO（统一 `run` 收敛 4 异步入口）；hack/any/空 catch NO（catch 内 toast 明确分支）；硬编码颜色 NO（全 CSS 变量）；函数/文件规模 NO（组件 ~180 行声明性）；公共契约未变。结论：SAFE。
- **Codex stop-time review FIX（refresh/zap 越权暴露）**：Codex 指出「row refresh/zap 在 moderator 可达页面暴露 admin-only 操作」。**实证核验**：`apps/api/src/routes/admin/videoSources.ts` 端点守卫 = `batch-probe`(refresh) + `batch-render-check`(zap) 用 `adminOnly`(`requireRole(['admin'])`)，而 `disable-dead` + `refetch-sources` 用 `auth`(`requireRole(['moderator','admin'])`)；`middleware.ts` 对 `/admin/**` 仅要求 `user_role !== 'user'` → **moderator 可达 sources 页**。即 moderator 会看到/点到 admin-only 二键（服务端虽 403，客户端不应暴露）。**修复（disable + tooltip，对齐 CrawlerSiteExpand / VideoRowActions 既有范式）**：`page.tsx`(server) 读 `user_role` cookie（`next/headers` cookies + `parseUserRole`，沿用 admin layout 范式）→ `isAdmin` 透传 `SourcesClient`(prop 缺省 false 失败安全) → `buildColumns(…, isAdmin)` → `SourceRowActions`；非 admin 时 refresh/zap `disabled` + 透明降 + title「该操作需要管理员权限」；**more 菜单（refetch-sources / disable-dead = moderator+admin 端点）不门控**，moderator 仍可用。新增 U-11..U-14（非 admin 禁用 + 点击不调 adminOnly api + moderator 仍可重采 + admin 启用）。复跑 typecheck/lint/verify:adr-contracts EXIT=0 + **全量 455 files 6032 passed 零回归**（净 +4）。

## [CHG-VIR-1] ADR-105a 起草（视频身份解析：多证据评分 / 阈值分级 / 候选持久化 / 离线生成）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 19:58
- **执行模型**：claude-opus-4-8（建议 opus；ADR 起草强制 arch-reviewer PASS，主循环为 Opus）
- **子代理**：arch-reviewer (claude-opus-4-8)（agentId a3933826a5e470df8 / CONDITIONAL → 4 项修订吸收转 Accepted）
- **背景（根因）**：ADR-105 v1 候选 = `(mc.title_normalized, mc.year, v.type)` 三元组等值 GROUP BY N-video group + 单维 `source_overlap_ratio` 评分；漏合并（year/type 不等无法召回）+ 误合并（同名同年不同作品无负向拦截）。ADR-105 AMENDMENT 2026-06-02 已废 pg_trgm 旧方向。本卡（SEQ-20260602-03 Phase 0）落档 Entity Resolution 升级 ADR，不写业务代码、不改端点、不碰生产阈值。
- **修改文件**：
  - `docs/decisions.md` — 尾部追加 ADR-105a 完整章节（13 D 条：core_title_key 确定性等值 blocking〔B-tree 非 pg_trgm〕/ 多 blocking key 并集召回 / 三类证据权重表 + 确定性聚合公式 / 0.92·0.75 阈值分级 + 自动绑定早期默认 OFF / type 兼容矩阵代码常量真源 / identityScore-legacyScore 字段分离 / `identity_candidate` DDL 草案 + 状态机 + Y1 幂等 partial unique + Y2 复活链 / `evidence_hash` 输入域 / group↔pair 映射 / 离线 job 性能模型 + 实时端点继承 ADR-105 p95 / confirmed→merge 事务边界 + `identity_decisions` / 不触碰生产阈值 / Y4 序号护栏；10 红线 + 5 黄线 + 后果 + 3 follow-up）
  - `docs/architecture.md` — §5.15 新增「视频身份解析层（规划草案 / ADR-105a Draft / 未落 migration）」前瞻小节（显式标注非现状基线、指向 ADR-105a 真源）
  - `docs/task-queue.md` / `docs/tasks.md` — CHG-VIR-1 状态流转
- **新增依赖**：无（红线 R2 明禁 pg_trgm / OpenCC / 技术栈外依赖）
- **数据库变更**：无（`identity_candidate` / `identity_decisions` / `merge_blocklist` 为 schema 草案，Phase 2b CHG-VIR-8 才落 migration）
- **门禁/验收**：arch-reviewer CONDITIONAL → RR-1（评分公式补「分级可达性确定性映射 + 非 exact 封顶 0.90 + exactScore=0.95 取值理由」）/ YY-1（external_exact 数据源校正为 `video_external_refs.is_primary=true AND match_status='manual_confirmed'`，现表无 relation/exact）/ YY-3（exact 仅豁免 `type_incompatible` 单条 veto）/ YY-2（矩阵中性为初始保守取向）**4 项吸收 → Accepted**。verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 203 路由对齐；verify-error-message / verify-adr-d-numbers / enum-ssot ⚠️ 均既有 advisory 与本 ADR 无关）+ verify:endpoint-adr EXIT=0；纯 docs 改动无 TS/TSX，typecheck/lint/test 基线不受影响。
- **注意事项**：① `core_title_key` 是**新增并行 key**，不改 `normalizeTitle`/`normalizeMergeKey` 语义、不写 catalog 唯一约束（红线 R1）；② 不引 pg_trgm，所有 blocking key 确定性等值（R2），字符相似召回须另起 DB capability ADR；③ 自动绑定开关 Phase 1-4 默认 OFF，非 exact 路径 `identityScore` 封顶 0.90 永不进自动绑定区；④ 外部 exact ID 证据 ADR-177 落地前读 `video_external_refs`（`match_status`，非 `relation`），落地后改读 `catalog_external_refs.relation='exact'`；⑤ Phase 0 本轮只做 CHG-VIR-1/2/3，CHG-VIR-4(ADR-177) 硬前置 PRE-2 留后续会话（用户裁决 2026-06-02）。
- **[AI-CHECK]**：纯 ADR 决策文档（无代码）；分层/跨模块/重复逻辑/any/空 catch/硬编码颜色/函数文件规模均 N/A；红线 R1-R3 闭环（normalizeTitle 解耦 / 等值非模糊 / 评分字段分离）；arch-reviewer 独立第二意见 CONDITIONAL→吸收 4 项后 Accepted。结论：SAFE。

## [CHG-VIR-2] ADR-175 起草（多语种标题模型：字段语义收紧 + aliases 结构化升级 + locale fallback + 匹配分层）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 20:20
- **执行模型**：claude-opus-4-8（建议 opus；ADR 起草强制 arch-reviewer PASS，主循环为 Opus）
- **子代理**：arch-reviewer (claude-opus-4-8)（agentId a714ba080c9641c5e / CONDITIONAL → 4 项修订吸收转 Accepted）
- **背景（根因）**：现 `media_catalog` 标题四形态语义松散——`title_en` 被拼音污染（`meta_quality.title_en_is_pinyin` + `PinyinDetector` 信号佐证）、`title_original` 无 `original_language` 标注语种；`media_catalog_aliases` 仅 `alias`/`lang`/`source`，无法支撑确定性 display_title locale fallback（设计 §9.4 未决 1）、简繁正确并列（ADR-174 红线）、跨语种/罗马音匹配分层。本卡（SEQ-20260602-03 Phase 0）落档多语种标题模型 ADR，不写业务代码、不改数据。
- **修改文件**：
  - `docs/decisions.md` — 尾部追加 ADR-175 完整章节（6 D 条：D-175-1 字段语义收紧 + 新增 `original_language` / D-175-2 `media_catalog_aliases` 5 列结构化升级〔region/script/kind/confidence/is_primary_for_locale〕+ partial unique `(catalog_id,lang,region,script) WHERE is_primary_for_locale` / D-175-3 display_title 确定性 6 级 fallback 链 / D-175-4 匹配分层复用 ADR-105a 既有极性 / D-175-5 `aliases[]` 数组列降级只读、表为单一真源 / D-175-6 写入口径；7 红线 + 5 黄线 + 后果 + 3 follow-up）
  - `docs/architecture.md` — §5.1a 末尾新增「ADR-175 多语种标题模型升级（规划草案 / 未落 migration）」前瞻小节
  - `docs/audit/adr-d-status.json` — verify 脚本自动登记 D-175-1..6（pending）
  - `docs/task-queue.md` / `docs/tasks.md` — CHG-VIR-2 状态流转
- **新增依赖**：无（红线 R1 明禁 OpenCC / 繁简转换依赖）
- **数据库变更**：无（`original_language` + aliases 5 列 + partial unique 为 schema 草案，Phase 4 CHG-VIR-11 才落 migration）
- **门禁/验收**：arch-reviewer CONDITIONAL → 红线-1（D-175-4 匹配分层极性与 ADR-105a 权重表交叉错配 → 改为复用既有 `external_alias_match` 强正 +0.45 / `core_title_key_equal` 中正 +0.35，不自创新极性、不回写 ADR-105a）/ 红线-2（拼音迁出驱动信号层级错配 → 明确对 catalog 层 `media_catalog.title_en` 重新调 `isPinyin`，video 层 `videos.meta_quality.title_en_is_pinyin` 仅交叉验证）/ 黄线-1（基础去重键保留 `(catalog_id,alias)` 取舍）/ 黄线-2（存量回填先 lang/script/region 再选 primary）**4 项吸收 → Accepted**。verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 203 路由 / verify-sql-schema-alignment ✅）+ verify:endpoint-adr EXIT=0；纯 docs 无 TS/TSX，typecheck/lint/test 基线不受影响。
- **注意事项**：① 简繁**不做字形归一**（不引 OpenCC / R1），简体/繁体/港澳台经 `script`（ISO 15924 Hans/Hant）维度并列 alias，匹配键复用 `normalizeForExternalMatch` 不改语义（R2）；② `media_catalog_aliases` 表为别名结构化**单一真源**，`aliases[]`（META-06）降级只读（R3，迁移 Phase 4）；③ display_title fallback 同 locale 多候选确定性排序 `is_primary_for_locale DESC, confidence DESC NULLS LAST, source 优先级, created_at ASC`（R4）；④ `title_en` 收紧仅英文 + 拼音迁出 = Phase 4 CHG-VIR-11；⑤ D-175-4 完全复用 ADR-105a 证据条目，无需 AMENDMENT ADR-105a。
- **发现既有债务（范围外留痕，不在本卡修）**：① `architecture.md` `release_date TEXT` vs migration 026 `release_date DATE` 类型不一致（arch-reviewer 黄线-3，建议另立文档修正卡）；② `scripts/verify-adr-d-numbers.mjs` 正则 `D-\d+-\d+` 不识别 ADR-105a 的 `D-105a-N`（字母 ADR 编号审计盲区，D-105a-1..13 未进 `adr-d-status.json` 的 pendingTotal），建议后续 MAINT 放宽正则支持 `D-\d+[a-z]?-\d+`。
- **[AI-CHECK]**：纯 ADR 决策文档（无代码）；分层/跨模块/重复逻辑/any/空 catch/硬编码颜色/函数文件规模均 N/A；红线 R1-R2 闭环（简繁不归一靠 script / 归一函数语义不改）；与 ADR-105a 极性自洽（复用既有条目）；arch-reviewer 独立第二意见 CONDITIONAL→吸收 4 项后 Accepted。结论：SAFE。

## [CHG-VIR-3] ADR-176 起草（catalog 按季粒度 + season_number 唯一键 + catalog_relations/series_group + 删行回滚范式）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 20:30
- **执行模型**：claude-opus-4-8（建议 opus；ADR 起草强制 arch-reviewer PASS，主循环为 Opus）
- **子代理**：arch-reviewer (claude-opus-4-8)（agentId a8930709146880a0f / CONDITIONAL → 5 项修订吸收转 Accepted）
- **背景（根因）**：catalog 长期需按季粒度（S2/SP/OVA/剧场版独立 catalog），但现 `uq_catalog_title_year_type` = `UNIQUE(title_normalized,year,type) WHERE 四外部 ID 全 NULL`（partial）+ `normalizeTitle` 剥季 → **无外部 ID 的分季作品** title_normalized 相同撞约束无法独立 catalog（有外部 ID 的如 Bangumi 分季 subject 已可独立）；且 `media_catalog` 无 `season_number` 列、无 `deleted_at`，缺 catalog-catalog 关系模型与合并回滚范式。本卡（SEQ-20260602-03 Phase 0）落档 catalog 按季 ADR，不写业务代码、不落 migration。
- **修改文件**：
  - `docs/decisions.md` — 尾部追加 ADR-176 完整章节（6 D 条：D-176-1 catalog 按季粒度 / D-176-2 新增 `season_number INT NULL` + 唯一键改造 `COALESCE(season_number,0)` 解硬阻塞〔存量 NULL→0 逐值不变 + 哨兵 0 依赖 CHECK>0〕/ D-176-3 `catalog_relations` 5 关系有向图〔season_of/edition_of/remake_of/spinoff_of/same_work_candidate〕+ 关系不变量〔反对称单向无环 + 对称规范化有序对〕+ `series_group` 可选锚 / D-176-4 catalog 删行回滚范式〔继承 084 `_bak_*` + ADR-174 D-174-6/R11/R12 + 关系边端点重指向 survivor〕/ D-176-5 不改 normalizeTitle 剥季〔季用显式列〕+ findOrCreate 不纳入 season 留 Phase 5 / D-176-6 写入口径 + 回填一致性；7 红线 + 5 黄线 + 后果 + 4 follow-up）
  - `docs/architecture.md` — §5.1a 新增「ADR-176 catalog 按季粒度升级（规划草案 / 未落 migration）」前瞻小节
  - `docs/audit/adr-d-status.json` — verify 脚本自动登记 D-176-1..6（pending）
  - `docs/task-queue.md` / `docs/tasks.md` — CHG-VIR-3 状态流转 + SEQ Phase 0 进度（1/2/3 ✅）
- **新增依赖**：无
- **数据库变更**：无（`season_number` 列 + 唯一键改造 + `catalog_relations` 表为 schema 草案，Phase 5 CHG-VIR-12 才落 migration）
- **门禁/验收**：arch-reviewer CONDITIONAL → R-1（`catalog_relations` 反对称四 relation 单向无环 + `same_work_candidate` 对称规范化有序对 → 补 D-176-3 关系不变量 + R7）/ R-2（catalog 合并删行关系边端点重指向 survivor + old/new 双列快照回滚复位，对齐 084 videos 指向范式）/ Y-A（`COALESCE` 哨兵 0 依赖 `CHECK>0`，禁 Phase 5 放宽 `>=0`）/ Y-B（`season_number` 回填全系列一致禁半回填态）/ Y-C（architecture.md 同步端点重指向）**5 项吸收 → Accepted**。verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 203 路由 / verify-sql-schema-alignment ✅）+ verify:endpoint-adr EXIT=0；纯 docs 无 TS/TSX。
- **注意事项**：① **不改 `normalizeTitle` 剥季语义**（红线 R1），季由新增显式列 `season_number` 承载；② 唯一键 `COALESCE(season_number,0)` 哨兵 0 正确性依赖 `CHECK>0`，Phase 5 禁放宽（R2/Y-A）；③ catalog-catalog 合并删行（无 `deleted_at`）必须继承 084 全字段快照范式 + 关系边端点重指向 survivor（R3/R-2），provenance/locks 只插不删（信息论不可逆 / ADR-174 R11/R12）；④ SP/OVA/剧场版独立 catalog 经 `catalog_relations` `edition_of`/`spinoff_of` 关联，不塞 season_number（Y-176-1）；⑤ `season_number` 列（catalog 持久化真源）vs ADR-105a facets season_number（video-pair scoring）层级清晰互补；⑥ findOrCreate 纳入 season + 实装全部留 Phase 5 CHG-VIR-12。
- **[AI-CHECK]**：纯 ADR 决策文档（无代码）；分层/跨模块/重复逻辑/any/空 catch/硬编码颜色/函数文件规模均 N/A；红线 R1-R4 闭环（normalizeTitle 不改 / COALESCE 存量不破坏 / 回滚快照继承 / edition·language_variant 归属不变）；与 ADR-105a/174 对接自洽；arch-reviewer 独立第二意见 CONDITIONAL→吸收 5 项后 Accepted。结论：SAFE。

---

> **SEQ-20260602-03 Phase 0 本轮收尾（用户裁决「只做 1/2/3」）**：CHG-VIR-1（ADR-105a）/ CHG-VIR-2（ADR-175）/ CHG-VIR-3（ADR-176）三份 ADR 全 Accepted（各经 arch-reviewer claude-opus-4-8 CONDITIONAL → 修订吸收）。**CHG-VIR-4（ADR-177 外部 ID 映射真源）未做**——硬前置 CHG-VIR-PRE-2（`video_external_refs`↔`catalog_external_refs` 关系预研定档）尚未完成，依赖未满足，留后续会话；CHG-VIR-PRE-1（`insertNewVideo` schema 漂移修复，Phase 4 前置）亦待做。Phase 0 整体（4 份 ADR）未完成，不发 PHASE COMPLETE。

## [CHG-VIR-PRE-1] insertNewVideo schema 漂移修复（split 新建 video 正确性隐患）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 20:50
- **执行模型**：claude-opus-4-8（建议 sonnet；opus 覆盖——修复涉及事务原子性设计 + 依赖注入，opus 更稳妥）
- **子代理**：无
- **背景（根因）**：`video-merge-mutations.ts:299 insertNewVideo` 的 INSERT `(short_id,title,year,type,title_normalized,is_published)` 双重失效——引用 migration 029 已 DROP 的 `year`(029:48)/`title_normalized`(029:57)，且缺 `catalog_id`（029:60 改 NOT NULL）。`VideoMergesService.split` 拆分到新建 video 路径必然命中（设计 §9.4 未决项 3 / SEQ-20260602-03 Phase 4 前置门禁）。
- **修改文件**：
  - `apps/api/src/db/queries/video-merge-mutations.ts` — `insertNewVideo` 改签名 `{shortId,catalogId,title,type}`，INSERT 列对齐 029 后 videos schema（删 year/title_normalized、加 catalog_id），范式对齐 `videos.mutations.createVideo`
  - `apps/api/src/services/VideoMergesService.ts` — 构造注入 `MediaCatalogService`；split **事务前**对每 group `findOrCreate` 作品层 catalog（幂等；事务外，回滚至多留无害孤儿 catalog）→ 事务内 `insertNewVideo` 传 catalogId（**范围澄清**：调用方必要适配，卡片原列单文件不足以修 catalog_id NOT NULL + findOrCreate 编排属 Service 层）
  - `tests/unit/api/video-merge-mutations.test.ts` — 更新现有权威 split 测试：mock `MediaCatalogService.findOrCreate` + happy path 断言 catalogId 替代 year + 「事务失败 ROLLBACK」补 findOrCreate 就绪
  - `tests/unit/api/video-merge-insert-new-video.test.ts`（新建）— insertNewVideo 真实 SQL 回归（INSERT 含 catalog_id、不含 year/title_normalized、4 绑定参数）
  - `docs/audit/adr-d-status.json` — verify 重算同步 D-176-1..6 闭环（CHG-VIR-3 changelog 已登记；衍生更新一并纳入）
- **新增依赖**：无
- **数据库变更**：无（修代码对齐既有 schema，不改 migration）
- **门禁/验收**：typecheck/lint/verify:adr-contracts（verify-sql-schema-alignment ✅ insertNewVideo SQL 对齐 / verify-endpoint-adr ✅）/verify:endpoint-adr EXIT=0 + **全量 456 files 6034 passed 0 failed 零回归**。split happy path / unmerge(split action) 等现有测试适配后全绿。
- **Codex stop-time review FIX**：Codex 指出「现有 split 单测与新 catalog 依赖不兼容」——初次 grep 漏 `video-merge-mutations.test.ts`（权威 merge/split 单测，未 mock MediaCatalogService → split 走真实 findOrCreate + mockClient 空 rows 抛错）。修：mock MediaCatalogService + 适配 split 断言（catalogId 替代旧 year）；删初版重叠的 `video-merge-split-catalog.test.ts`（与权威测试重复），独特 insertNewVideo SQL 测试保留为 `video-merge-insert-new-video.test.ts`。
- **注意事项**：① split 拆出新 video 经 `findOrCreate(newVideoMeta)` 绑 catalog（同 title_normalized+year+type 复用现有）；② findOrCreate 在 split 事务外（幂等），split 回滚至多产生无 video 指向的孤儿 catalog（共享作品层无害，下次复用）——未改 MediaCatalogService.findOrCreate 签名去支持外部事务 client；③ StagingEditPanel.test.tsx jsdom flaky（隔离+全量均通过，非本卡回归 / 上一会话已记录）。
- **[AI-CHECK]**：分层 NO 违反（findOrCreate 编排在 Service 层，insertNewVideo 纯 query）；跨模块 NO；重复逻辑 NO（删重叠测试收敛单一权威 split 测试）；any NO（mock 用 `as unknown as PoolClient/Pool`）；空 catch NO；硬编码颜色无关；函数规模 NO；insertNewVideo 签名变（内部 query，唯一消费方 VideoMergesService 已同步）。结论：SAFE。

## [CHG-VIR-PRE-2] ADR-177 前置：video_external_refs ↔ catalog_external_refs 关系预研定档
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 21:00
- **执行模型**：claude-opus-4-8（建议 opus；架构关系决策 + arch-reviewer 第二意见）
- **子代理**：arch-reviewer (claude-opus-4-8)（agentId a6cc563d53376800e / CONDITIONAL → R-1 + Y-1~4 吸收 → 认可起 CHG-VIR-4）
- **背景（根因）**：视频身份解析设计 §9.2 R1 红线——§4.6 新提 `catalog_external_refs` 与既有 `video_external_refs`（migration 041/045）语义重叠层级不同，「关系未定不得起草 ADR-177」。本卡（SEQ-20260602-03 前置门禁）定档两表关系，解锁 CHG-VIR-4（ADR-177 起草）。
- **修改文件**：
  - `docs/designs/adr177-external-refs-relation_20260602.md`（**新建**）— 关系预研定档：§1 现状基线（video_external_refs schema + 写入 4 Service + **读展示后台审核台 UI 链**）/ §2 catalog_external_refs 规划 / §3 关系三选一定档「并存+上卷」+ 上卷规则 / §4 D-174-3 迁移 / §5 两表审计不合并 / §6 ADR-177 输入 / §7 门禁 / §8 arch-reviewer 审核记录
  - `docs/task-queue.md` / `docs/tasks.md` — CHG-VIR-PRE-2 状态流转 + SEQ 前置门禁完成
- **新增依赖**：无
- **数据库变更**：无（预研定档文档，不落 migration；catalog_external_refs schema 由 CHG-VIR-4 ADR-177 + Phase 5 落地）
- **定档结论**：① **关系 = 并存 + 上卷**（排除「替代」：video_external_refs 是 video 级真源 + 富集写 + 审核台 UI 读，层级职责不同；排除「纯并存」：双真源 findOrCreate 无来源）；② **上卷规则**（确定性保守）：manual_confirmed primary 一致 + 精确级 → exact / auto_matched 一致 → candidate / 冲突 → candidate / 跨 catalog 同 ID 按 external_kind+season_number 裁定（show→parent 一对多 / season·movie→exact / exact 冲突→candidate 归并信号）；③ **D-174-3 迁移**：过渡期保留 video 级 candidate，ADR-177 落地新增 catalog_external_refs candidate（双写过渡，catalog_id 归属结合 D-174-7 留 ADR-177）；④ **两表审计不合并**：video rejected 不传播 catalog rejected，catalog exact 不覆盖 video rejected，candidate/rejected 不进 partial unique（仅 exact/parent 受全局唯一）。
- **门禁/验收**：arch-reviewer CONDITIONAL → R-1（§1 漏后台 UI 读消费链 `listVideoExternalRefs`:475 → `VideoService.getAdminVideoById`:220-237 `ExternalRefSummary` → `external-meta-panel.tsx`/`VideoEditDrawer`/`TabDetail`，ADR-172 AMD3 / D-172-AMD3-2，已校正为「写入+读展示」双角色）+ Y-1（跨 catalog exact 唯一 × external_kind/season 裁定）+ Y-2（单 video exact 跨 catalog 限定）+ Y-3（candidate catalog_id 归属留 ADR-177）+ Y-4（candidate/rejected 不进 partial unique 收敛）**5 项吸收 → 认可**。verify:adr-contracts EXIT=0；纯 docs 无代码/migration。
- **注意事项**：① **解锁 CHG-VIR-4**（ADR-177 起草硬前置已满足）；② 关系定档供 ADR-177 起草输入，正式 schema/约束/迁移由 CHG-VIR-4 落 decisions.md；③ 初次 grep 漏 video_external_refs 读消费链（只查 upsert/findPrimary），arch-reviewer R-1 捕获（D-172-AMD3-2 ExternalRefSummary 窄化投影）。
- **[AI-CHECK]**：纯预研定档文档（无代码）；分层/跨模块/重复逻辑/any/空 catch/硬编码颜色/函数文件规模均 N/A；现状基线经 R-1 校正与代码逐字对齐；关系定档与 ADR-174/176/105a 一致；arch-reviewer 独立第二意见 CONDITIONAL→吸收 5 项后认可。结论：SAFE。

---

> **SEQ-20260602-03 前置门禁收尾（本会话）**：CHG-VIR-PRE-1（insertNewVideo schema 漂移修复，全量 6034 passed 零回归）+ CHG-VIR-PRE-2（ADR-177 关系定档「并存+上卷」，arch-reviewer 认可）均 ✅。**CHG-VIR-4（ADR-177 外部 ID 映射真源）依赖已满足、可起草**，留用户决定是否继续。Phase 0 四份 ADR 中 CHG-VIR-1/2/3（ADR-105a/175/176）已 Accepted，CHG-VIR-4 待起；Phase 1-5 实施待启动。

## [CHG-VIR-4] ADR-177 起草：外部 ID 映射真源 catalog_external_refs（Phase 0 完结）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 21:30
- **执行模型**：claude-opus-4-8（建议 opus；ADR 起草 + 强制 arch-reviewer PASS）
- **子代理**：arch-reviewer (claude-opus-4-8)（agentId a18aea6f95f5d88ce / CONDITIONAL → RR-A + RR-B 2 必修红线 + YY-A~D 4 黄线吸收 → Accepted）
- **背景（根因）**：`media_catalog` 四列外部 ID（imdb_id/tmdb_id/douban_id/bangumi_subject_id）作 catalog 身份唯一列存三处结构约束：① 单值无法表达 `parent` 一对多（ADR-176 按季粒度下同剧多季共享 show 级 ID）；② 无法保留 candidate/rejected 审计；③ D-174-3 把 catalog 层冲突降级记 video 级 `video_external_refs`（语义错位）。需引 catalog 级 canonical 映射表 + 约束分级 + 四列降级 cache。硬前置 CHG-VIR-PRE-2 关系定档（「并存+上卷」）已满足。
- **修改文件**：
  - `docs/decisions.md`（**新增 ADR-177 章节**）— 背景 + D-177-1~10（schema DDL 草案 / 并存+上卷继承 PRE-2 / 约束分级 partial unique + RR-B 不变量 / 上卷规则 / 四列降级 cache + 同事务 / findOrCreate 改读 / D-174-3 迁移 + candidate catalog_id 归属 / 两表审计不合并 / 删行回滚纳入 ADR-176 D-176-4 / 既有数据迁移）+ R1~R10 红线 + Y-177-1~6 黄线 + 后果 + D-N 偏离登记（arch-reviewer 评审记录）+ follow-up 5 条；状态 **Accepted**
  - `docs/architecture.md` — §5.6 加 `catalog_external_refs` 规划草案小节（字段/约束分级/external_kind·relation 不变量/并存+上卷/四列降级 cache/D-174-3 迁移/删行回滚）+ §5.1a 四列降级 cache 注记（规划草案标注，落地迁出）
  - `docs/audit/adr-d-status.json` — verify 重算登记 D-177-1..10（10 D 条 advisory）
  - `docs/task-queue.md` / `docs/tasks.md` — CHG-VIR-4 状态流转 ✅ + Phase 0 完结 + 卡片删除
- **新增依赖**：无
- **数据库变更**：无（ADR 定档文档；`catalog_external_refs` 表 + partial unique + 四列降级 + 数据迁移留 Phase 5 CHG-VIR-12）
- **核心定档**：① **关系=并存+上卷**（继承 PRE-2，排除替代/纯并存）；② **约束分级** partial unique：`exact` 全局唯一 `(provider,external_id,external_kind)` / `exact·parent` 同 catalog 唯一 `(...,COALESCE(season_number,0)) WHERE relation IN('exact','parent')` / `candidate·rejected` 不进约束保留审计（结构性免 `decision_id`）；③ **四列降级 cache**：仅 `exact AND is_primary` 回填，parent/candidate/rejected 不回填防一对多污染单值唯一列，写入与 cache 回填同事务；④ **findOrCreate 改读映射表**（cache fallback）；⑤ **D-174-3 迁移**：catalog 层冲突归 catalog_external_refs candidate（双写过渡，candidate catalog_id 按 D-174-7 redirect 两分支）；⑥ **删行回滚**纳入 ADR-176 D-176-4 `_bak_*` 快照 + 端点重指向 survivor。
- **主动校正**：partial unique 哨兵 `COALESCE(season_number,-1)`（设计 §4.6 草案）→ `0`（与 ADR-176 `uq_catalog_title_year_type_season` 口径统一，依赖 `CHECK season_number>0` / R9）。
- **门禁/验收**：arch-reviewer CONDITIONAL → **RR-A**（D-177-9+R8：合并重指向 exact 须按索引①预检主导，PostgreSQL `ON CONFLICT` 单目标无法同覆盖索引①②，单一兜底在 survivor/被删方 season_number 不同时漏接撞①炸事务，违 R3「不靠唯一索引兜底」）+ **RR-B**（D-177-3+R10：补 `external_kind` 全局一致 + `exact↔parent` 互斥不变量，external_kind 单调决定 relation 取值域，原两 partial unique 不阻止同一外部 ID 既 exact 又 parent / findOrCreate 分流无歧义 + 消除合并撞①大部分场景）**2 必修红线** + YY-A（redirect 条件对齐 `isRedirectSafe` 缺 year 走 safe）+ YY-B（schema 增 `rollup_rule` 溯源列）+ YY-C（exact 写入与 cache 回填同事务）+ YY-D（迁移 external_kind 推断不确定保守 candidate）**4 黄线** + 对齐建议（follow-up 5 douban/imdb/tmdb 对称）全吸收。verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 203 路由 + sql-schema 对齐 / adr-d-status.json D-177-1..10）+ verify:endpoint-adr EXIT=0；纯 docs 无 TS/TSX，typecheck/lint/test 基线不受影响。
- **注意事项**：① **Phase 0 完结 — 四份 ADR（ADR-105a/175/176/177）全部 Accepted**；② ADR-105a `external_exact_id_match` 强正证据源切换（`media_catalog` 四列+video_external_refs → `catalog_external_refs.relation='exact'`）登记 follow-up 3 / Y-105a-4，本 ADR 不依赖其落地；③ `external_kind` provider 映射细则（TMDB show/season、IMDB title 类型、豆瓣层级）留 Phase 5 Y-177-5；④ arch-reviewer 认可无返工三项：哨兵校正 / PRE-2 四项定档忠实继承 / D-174-3 candidate catalog_id 归属无 orphan。
- **[AI-CHECK]**：纯 ADR 定档文档（无代码）；分层/跨模块/重复逻辑/any/空 catch/硬编码颜色/函数文件规模均 N/A；schema/约束/迁移与 ADR-174/175/176/105a + PRE-2 定档逐条对齐；主动校正哨兵口径与 ADR-176 统一；arch-reviewer 独立第二意见 CONDITIONAL → 2 必修红线 + 4 黄线吸收后 Accepted；未新增端点/migration（留 Phase 5）。结论：SAFE。

## [CHG-VIR-5] Phase 1a：TitleIdentityParser 纯函数 + fixture（SEQ-20260602-03 / Phase 1）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 22:45
- **执行模型**：claude-opus-4-8（建议 sonnet；纯函数实施按已 Accepted 的 ADR-105a/175 既定契约落地，无新架构决策，opus 启动覆盖不阻断）
- **子代理**：无
- **背景（根因）**：现有 `normalizeTitle`/`normalizeMergeKey` 把季数/画质/装饰 token **删除丢弃**，无法支撑 ADR-105a「序号即身份 vs 序号即季/卷」(Y4 / D-105a-13) 的区分与多证据 blocking。需新增并行 `TitleIdentityParser`，把噪声 token **解析保存**到结构化 facets。
- **修改文件**：
  - `apps/api/src/services/TitleIdentityParser.ts`（**新建** 386 行）— `parseTitle(raw) → {coreTitleKey, facets, titleKind, parserVersion, confidence}`（ADR-105a D-105a-1）；纯函数确定性；10 步流水线（剥 HTML → 全角折叠 → 括号 token → 季/部/卷序号 → 发布形态 → 版本 → 语言变体 → 画质噪声 → 源站噪声 → 折叠/lower/剥标点）；`extractSingleMarker`/`extractNoiseTokens` 共用 helper 收敛三段 marker 循环；`parseSeasonNumeral` 阿拉伯+CJK 数字（零~百）；`classifyTitleKind`/`computeConfidence` 导出；`TITLE_PARSER_VERSION='1.0.0'`；复用 `PinyinDetector.isPinyin` 判 romanized
  - `tests/unit/api/title-identity-parser.test.ts`（**新建**）— 40 用例：基础归一/书名号·全半角·标点/语言·字幕变体/版本·发布形态/季·部·卷序号(Y4)/画质噪声/源站噪声/多噪声组合/titleKind 罗马音·分类辅助 + **TitleNormalizer 回归守卫**（断言 `normalizeTitle`/`normalizeMergeKey` 逐字符不变）
- **新增依赖**：无
- **数据库变更**：无（Phase 1a 纯函数、不落库、不参与任何归并决策）
- **核心实现要点**：① **`core_title_key` 与 `normalizeTitle`/`normalizeMergeKey` 语义解耦**（D-105a-1）——并行 key，刻意不复用 TitleNormalizer 内部常量；**`TitleNormalizer.ts` 零改动**（验收红线，git 确认）；② **Y4 护栏**（D-105a-13）——仅剥「有显式季/部/卷关键词」的序号（第N季/SN/Part N/Vol N → facets.seasonNumber），裸序号（《复仇者联盟4》）保留进 core，使不同序号→不同 core_title_key（fixture 双向验证：复仇者联盟4≠复仇者联盟3 / 斗罗大陆第4季=第3季 core 同 season 异）；③ facets 七维（seasonNumber/edition/languageVariant/releaseMarker/qualityNoise[]/sourceNoise[]/bracketTokens[]）解析保存而非删除；④ titleKind 启发式优先级 crawler>edition>localized>romanized>original，`aka` 无单标题信号 forward-compat 不主动产出；⑤ 不做繁简归一/不引 pg_trgm·OpenCC（红线 R1/R2）。
- **门禁/验收**：typecheck EXIT=0 + lint 5 successful（web-next 警告既有无关）+ **全量 6073 passed / 1 flaky**（`StagingPageClient.test.tsx` jsdom flaky，隔离重跑 8/8 通过，与本卡 node 纯函数无关）+ 本卡新增 40 用例全绿 + verify:adr-contracts EXIT=0（enum-ssot advisory 既有基线，本卡无新 enum）。验收红线全闭环：fixture 全绿 ✅ / normalizeTitle·normalizeMergeKey 输出不变 ✅（回归守卫断言）/ facets 仅观测不参与决策 ✅。
- **ADR D-N 闭环**：D-105a-1（core_title_key 确定性等值/语义解耦/不改归并键）+ D-105a-13（Y4 序号身份 vs 季/卷护栏）随本实施卡闭环；ADR-175 titleKind 枚举（original/localized/romanized/aka/crawler/edition）落地。
- **注意事项**：① titleKind 为单标题 best-effort 启发式，Phase 1a 仅观测，原始 vs 本地化语种区分留 ADR-175 catalog 层（CHG-VIR-11）；② `TITLE_PARSER_VERSION` 语义升级须 bump，驱动 `evidence_hash` 受控 superseded（Phase 2b CHG-VIR-8）；③ CHG-VIR-6（Phase 1b：title_observations shadow 写入）依赖本卡，消费 `parseTitle` 的 facets/parserVersion。
- **[AI-CHECK]**：分层 NO（新建 service 零越层不触 Route/DB）/ 跨模块内部实现 NO / 重复逻辑 NO（helper 收敛 + 解耦为 ADR 明示）/ hack NO / 需拆分函数 NO（parseTitle ~55 行线性流水线）/ 需拆分文件 NO（386<500 单一职责）/ 隐式副作用·吞异常 NO。结论：SAFE。

## [CHG-VIR-6] Phase 1b：title_observations 去重聚合表 + 采集链路 shadow 写入（SEQ-20260602-03 / Phase 1 完结）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 23:05
- **执行模型**：claude-opus-4-8（建议 sonnet；schema 真源=设计 §1b 既定，无新架构决策，opus 启动覆盖不阻断）
- **子代理**：无
- **背景（根因）**：视频身份解析需持久化各源观测到的原始标题 + 解析 facets 以供后续分析；「每次采集快照」无限写不可行 → 去重聚合 shadow 表（设计 §1b，**无独立 ADR**）。纯观测，不参与任何合并决策。
- **修改文件**：
  - `apps/api/src/db/migrations/085_title_observations.sql`（**新建**）— `title_observations` 表（id/video_id FK CASCADE/source_site_key/source_name/raw_title/raw_title_hash/parser_version/parsed_facets_jsonb/observed_count/first_seen_at/last_seen_at）+ 去重唯一索引 `uq_title_observations_dedupe (video_id, COALESCE(source_site_key,''), COALESCE(source_name,''), raw_title_hash, parser_version)` + 反查索引 `idx_title_observations_video` + DO 块校验；幂等 IF NOT EXISTS
  - `apps/api/src/db/queries/titleObservations.ts`（**新建**）— `recordTitleObservation`（INSERT ... ON CONFLICT 去重键 DO UPDATE `observed_count+1`/`last_seen_at=NOW()`/刷新 facets）+ `TitleObservationInput` 入参契约；**仅 DB query，零 service import**
  - `apps/api/src/services/titleObservation.builder.ts`（**新建**）— `buildTitleObservation`（`parseTitle` facets 快照 + sha256 raw_title_hash → `TitleObservationInput`）；Service 层组装 helper，独立模块供 Phase 2 离线 job 复用
  - `apps/api/src/services/CrawlerService.ts`（改）— `upsertVideo` Step 5 后 **fire-and-forget** `void recordTitleObservation(this.db, buildTitleObservation(videoId, video.title, siteKey ?? null)).catch(stderr)`（F3 容错，非空 catch）
  - `docs/architecture.md`（改）— 新增 §5.16 `title_observations` 现状 schema（字段表 + 索引 + 分层应用层说明）
  - `tests/unit/api/titleObservations.test.ts` / `titleObservation-builder.test.ts` / `crawlerTitleObservation.test.ts`（**新建**）— query upsert SQL（3）+ builder 解析透传·hash（4）+ 采集链路 shadow 端到端含 F3 容错（3）共 10 用例
- **新增依赖**：无（sha256 用 node:crypto 内建）
- **数据库变更**：**新增 `title_observations` 表 + 2 索引**（Migration 085，已 `npm run migrate` 应用到本地 dev DB；architecture.md §5.16 同步）。纯 shadow 观测表，不进任何唯一约束/归并决策（复核 F1）。
- **范围澄清**（卡片原列 5 文件，实施扩 2 文件）：① 新增 `titleObservation.builder.ts` —— 修正分层（全仓 DB query 层从无 import `services/` 的先例；解析/哈希组装属 Service 层职责，与 `normalizeMergeKey` 在 Service 算好再传 string 给 query 的既有范式一致），且避免向 baseline 豁免的 `CrawlerService.ts`（537 行）继续增长；② 新增 `crawlerTitleObservation.test.ts` —— 采集链路 shadow 写入 + F3 容错端到端覆盖。
- **真实 DB 验证**：migrate 085 应用成功（表+表达式唯一索引+DO 校验全过）；一次性脚本验证同去重键二次写入 → `observed_count=2`（去重聚合生效，非重复行），`parsed_facets_jsonb` 正确存取（coreTitleKey/titleKind=crawler/confidence=0.85/seasonNumber=4/sourceNoise）；验证数据已清理。
- **门禁/验收**：typecheck EXIT=0 + lint 5 successful + **全量 6084 passed / 0 failed**（460 files；本卡净 +10）+ verify:adr-contracts EXIT=0（sql-schema-alignment ✅ title_observations 非 5 核心表无对齐要求）+ migrate:check 识别 085 唯一 pending。验收要点：去重生效（重复标题只增 observed_count）✅ / 采集链路写 observation 容错 fire-and-forget 写失败不阻断 ✅ / 零生产行为变更（采集主路径无回归）✅。
- **注意事项**：① **SEQ-20260602-03 Phase 1（CHG-VIR-5 + CHG-VIR-6）完结** —— Phase 2（CHG-VIR-7/8/9：候选证据化，CHG-VIR-8/9 建议 opus + 可能需端点 ADR amendment）待用户决定启动；② `source_name` site 级观测默认 null（同一 video.title 对全源一致，不按 source 拆行）；③ `title_observations` 当前仅采集链路写入，离线分析/后台展示消费留后续；④ video 删除经 FK ON DELETE CASCADE 连带清理观测行。
- **[AI-CHECK]**：分层 NO（修正后 DB query 层零 service import / CrawlerService→DB query 正方向 / builder Service 层 helper）/ 跨模块内部实现 NO / 重复逻辑 NO / hack NO / 需拆分函数 NO（builder ~12 行）/ 需拆分文件 NO（主动抽 builder 避免 CrawlerService 增长）/ 隐式副作用·吞异常 NO（F3 catch 显式 stderr 日志）。结论：SAFE。

## [CHG-VIR-6.5] Phase 2 前置：ADR-105a AMENDMENT（补 `release_marker_mismatch` 强负 + group→单值聚合口径 + 审计正则放宽）（SEQ-20260602-03 / Phase 2 前置门禁）
- **完成时间**：2026-06-02
- **记录时间**：2026-06-02 23:55
- **执行模型**：claude-opus-4-8（建议 opus；改 D-105a-3 证据表极性触发 Y-105a-3「实施期不得改极性」→ 须 ADR amendment + arch-reviewer PASS）
- **子代理**：arch-reviewer (claude-opus-4-8)（agentId a9d8c49369023192e；CONDITIONAL → 红线 A1/A2/B1 + 黄线 a1/b1/c1 全吸收 → Accepted）
- **背景（根因 P2-F1 不对称缺陷）**：`TitleIdentityParser`（CHG-VIR-5）把 `releaseMarker`（剧场版/OVA/SP/番外）与 `season_number` **同范式**剥到 facets（不进 `core_title_key`），但 ADR-105a `D-105a-3` 强负表只对齐 ADR-176「分季独立 catalog」（`season_mismatch`），**遗漏 D-176-1「剧场版/SP/OVA 独立 catalog」**。后果：Phase 2b blocking 用 `core_title_key` 召回把「正篇」与「剧场版」并入同组且**无 veto 拦截**（video 层误并，早于 Phase 5）。对比 `edition`（加长版）剥到 facet 故意无强负正确（同作品 / D-176-1 归 video 层），`releaseMarker` 无强负 = 遗漏。
- **修改文件**：
  - `docs/decisions.md`（改）— ADR-105a：① `D-105a-3` 强负表**原地新增** `release_marker_mismatch` veto 行（零删原文）；② 章节末追加 **AMENDMENT 2026-06-02（CHG-VIR-6.5）** 小节，含 **D-105a-14**（release_marker 强负，含 null 语义收窄 + exact 不豁免 + 数据源）+ **D-105a-15**（Phase 2a group→单值聚合口径）+ D-N 偏离登记更新（扩为 D-105a-1~15 共 15 条）+ c1 影响面声明
  - `scripts/lib/adr-parser.mjs`（改）— `parseDeviationNumbers`（ADR 编号正则 `/^ADR-(\d+)/`→`/^ADR-(\d+[a-z]?)/`；D 编号 `/D-(\d+)-(\d+)/g`→`/D-(\d+[a-z]?)-(\d+)/g`）+ `parseChangelogDeviations`（同步放宽 D 编号正则）+ docstring 注释；识别 ADR-105a 的 `D-105a-N`（此前 `\d+` 不含字母 → 审计盲区）
  - `docs/audit/adr-d-status.json`（脚本产物，自动重生成）— 首次纳入 ADR-105a 的 D-105a-1~15
- **核心决策（arch-reviewer 红线/黄线吸收）**：
  - **D-105a-14 极性**：facets `releaseMarker` 不同 = 不同发布形态 = 不同作品 catalog（对齐 ADR-176 D-176-1）；video 层补 veto 使与 Phase 5 catalog 身份层极性一致。
  - **红线 A1（null 语义收窄）**：**仅「双方均有非 null releaseMarker 且值不同」才 veto**（剧场版↔OVA/SP/番外）；`null↔非 null` **不 veto**、仅作 candidate 弱信号进 evidence。理由：parser `releaseMarker=null` 是「正则未命中」非「确定正篇」，硬 veto 会双向误判（漏标/误标剧场版）；Phase 1-4 自动绑定默认 OFF（R9），不 veto 也只进人工候选不会自动误并，误 veto 硬拦代价更高；与 D-105a-13「过激比漏判更危险」一致 + 与 `season_mismatch` 口径对齐（不改 `season_mismatch` 语义）。
  - **红线 A2（exact 不豁免理由修正）**：与 YY-3 一致——`release_marker_mismatch` 不被 exact 豁免；主战场是无 exact ID 召回 pair，exact 场景不同 external_id 多由 `external_id_conflict` 先命中，不豁免覆盖「源站误录共享同一 exact id」边缘情形，无需特例。
  - **红线 B1（消除 recommendedTarget 新原语）**：D-105a-15 聚合严格继承 D-105a-9「group→pair：所有 unordered pair」映射，对全部 `C(N,2)` pair 投影单值——`identityScore`=**min**（保守最弱链接）、`strongNegativeReasons`/`blockingReasons`=**union**、`evidence` 保 per-pair 明细；**不引入主 video/target 锚原语**（现有 group 是无锚等价集合）。
  - **黄线 a1**：数据源声明 Phase 2 读 parser facets 实时比较，不依赖 Phase 5 `media_catalog.season_number`；releaseMarker 在 catalog 层无标量列（靠独立 catalog + `edition_of`/`spinoff_of` 关系），纯 facet 驱动。
  - **黄线 b1**：Phase 2a 排序键仍 `legacyScore`，`identityScore` 仅展示列不参与排序/计数/分页（继承 Y-105a-1，候选数量/排序与旧逻辑逐值一致）。
  - **黄线 c1（影响面纠正 arch-reviewer 前提）**：经全仓核验，decisions.md **唯一字母后缀 D 编号即 `D-105a-N`**；ADR-103a/103b 虽字母后缀标题但**章节内无任何 D 偏离编号**（放宽后 `parseDeviationNumbers` 返回空 → 零行为变化），ADR-103（纯数字）ownNumber 新旧均得 `103`（`[a-z]?` 匹配空）→ 零变化；放宽**唯一实际影响是新识别 `D-105a-N`**。verify 前后 diff `adr-d-status.json` 确认新增项全 advisory 不阻塞。
- **ADR D-N 闭环**：**D-105a-14**（release_marker_mismatch 强负 / null 语义 / exact 不豁免 / facet 数据源）+ **D-105a-15**（Phase 2a group→单值 min/union 聚合口径）随本卡定档闭环；ADR-105a 偏离扩为 D-105a-1~15。
- **新增依赖**：无
- **数据库变更**：无（纯 ADR 文档定档 + 审计脚本正则；未落 migration/端点，identity_candidate 仍留 Phase 2b CHG-VIR-8）
- **门禁/验收**：verify:adr-contracts EXIT=0（verify-adr-d-numbers 放宽后 ADR-105a 进审计：D-105a-1/13 + 新增 14/15 闭环，D-105a-2~12 advisory pending = Phase 2+ 未实施，符合预期）+ typecheck/lint/test 基线不受 docs/.mjs 影响（脚本无 TS）。验收要点：`release_marker_mismatch` 入 D-105a-3 + 收窄口径/数据源明确 ✅ / P2-F3 group 聚合口径定档（min+union over all pairs）✅ / 正则放宽后 `D-105a-N` 进审计 ✅ / arch-reviewer PASS ✅。
- **注意事项**：① **CHG-VIR-7（Phase 2a）硬前置已解除** —— 其 `strongNegativeReasons` 须含本卡落档的 `release_marker_mismatch`，group 行单值按 D-105a-15 min/union 口径；② D-105a-14 判定**纯 facet 驱动**，实施期（CHG-VIR-7/8）不得误接 `media_catalog` 持久化列；③ release_marker veto 收窄为「双方非 null 且不同」，`null↔非 null`（正篇 vs 剧场版）走 candidate 人工裁定——Phase 2b 对比报表可统计该场景召回情况评估是否需收紧；④ ADR-105a D-105a-2~12 在 `adr-d-status.json` 显示 pending 属正常（Phase 2+ 实施卡逐条闭环）。
- **[AI-CHECK]**：分层 NO（纯 docs + 审计脚本，不触业务分层）/ 跨模块内部实现 NO / 重复逻辑 NO / hack NO（正则放宽向后兼容，纯数字 `D-117-1` 经 `[a-z]?` 匹配空仍命中）/ 需拆分函数 NO / 需拆分文件 NO / 隐式副作用 NO（脚本仍 advisory exit 0）/ 偏离检测：建议模型 opus = 执行模型 claude-opus-4-8，无偏离。结论：SAFE。

## [CHG-VIR-7] Phase 2a：现有 N-video group 候选附加多证据 evidence（不改来源）（SEQ-20260602-03 / ADR-105a D-105a-3/5/6/9/15）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 00:40
- **执行模型**：claude-opus-4-8（建议 sonnet；**偏离说明**：用户裁定本 opus 会话连续推进，免去切 sonnet 会话，opus 覆盖 sonnet 能力，后续 CHG-VIR-8/9 本就建议 opus）
- **子代理**：code-architect (claude-opus-4-8)（agentId a16a020a7dd8eae19；产出 Evidence 类型契约 + identity 评分模块实现蓝图，主循环忠实落地）
- **背景（根因）**：现有合并候选仅有 `legacyScore`=`source_overlap_ratio`，无身份证据维度，UI 无法解释「为何可合并/为何拦截」。落地 ADR-105a 多证据评分（Phase 2a：现有 group 附加证据字段，**不改来源/数量/排序**）。新共享 API 契约（Evidence 类型）+ 跨 Phase 2b/2c 复用评分模块 → 按 CLAUDE.md §模型路由「强制 Opus 子代理设计契约」spawn code-architect (Opus) 出蓝图。
- **修改文件**：
  - `packages/types/src/identity-evidence.types.ts`（**新建**）— `EvidencePolarity`/`EvidenceType`(16 条 + release_marker_weak_signal)/`EvidenceItem`/`PairScore`/`GroupIdentityScore` 公开类型契约（三处复用 API/UI/Phase2b）
  - `packages/types/src/index.ts`（改）— re-export identity-evidence.types
  - `packages/types/src/video-merge.types.ts`（改）— `CandidateGroup` 加 optional `identity: GroupIdentityScore`（与 `score`=legacyScore 字段分离 / R3）
  - `apps/api/src/services/identity/weights.ts`（**新建**）— 权重 `POSITIVE_WEIGHTS` + `NON_EXACT_CAP=0.90` + `EXACT_SATURATING_SCORE=0.95` + `STRONG_NEGATIVE_TYPES/SET` + `EVIDENCE_POLARITY` + `evidenceWeightTag` + `SCORER_VERSION`（代码常量真源 R10）
  - `apps/api/src/services/identity/type-compat.ts`（**新建**）— `classifyTypePair` D-105a-5 矩阵（5 组显式 + 同 type compatible + other weak + 其余 neutral，双向归一）
  - `apps/api/src/services/identity/scorePair.ts`（**新建** 212 行）— `scorePair(PairSideInput,PairSideInput)→PairScore`：各维度 eval 子函数（core/season/release_marker[+weak]/year/type/source_fingerprint/external）+ `aggregateEvidence`（D-105a-3 确定性聚合：rawScore→nonExactScore clamp 0.90→max(exactScore 0.95)；强负 veto 不减分；exact 仅豁免 type_incompatible 单条 YY-3）。输入中性供 Phase 2b 复用
  - `apps/api/src/services/identity/aggregateGroup.ts`（**新建**）— `aggregateGroup` D-105a-15：identityScore=min / reasons=union over all unordered pairs（去重保序）+ 空 pairs 防御
  - `apps/api/src/services/identity/index.ts`（**新建**）— `scoreGroup(videos)` 编排（parseTitle facets → C(N,2) scorePair → aggregateGroup）+ re-export
  - `apps/api/src/services/VideoMergesService.ts`（改）— `listCandidates` 唯一新增行 `identity: scoreGroup(videos)`（minScore 过滤/排序/分页仍只看 legacyScore）
  - `apps/server-next/src/app/admin/merge/_client/MergeClient.tsx`（改）— `CandidateExpand` 加身份分 pill（与置信度 pill 双值，文案区分 R3）+ 消费 EvidencePanel；type import 收敛
  - `apps/server-next/src/app/admin/merge/_client/EvidencePanel.tsx`（**新建** 110 行）— evidence 展示面板（为何可合并 chips / 为何拦截 danger 横幅 / 逐对明细折叠）+ `EVIDENCE_LABELS` 中文映射；**抽出独立文件避免既有超限 MergeClient(679→703) 继续膨胀**；颜色零硬编码（state/border CSS 变量）
  - `tests/unit/api/identity-scorer.test.ts`（**新建** 27 用例）+ `tests/unit/api/video-merges-identity.test.ts`（**新建** 4 用例）
- **核心实现要点**：① **字段分离（R3/D-105a-6）** identityScore 独立字段，绝不复用 score/computeOverlapScore；② **D-105a-14 release_marker** 仅双非 null 不同才 veto，null↔非 null 产 `release_marker_weak_signal`（不计分不 veto）；③ **D-105a-15 group→单值** over all unordered pairs min+union，零 recommendedTarget 新原语（B1）；④ **exact 仅豁免 type_incompatible**（YY-3），season/release_marker 等不豁免；⑤ **组内恒成立证据**（year/type 同值）常量化命中；⑥ **Phase 2a 数据源边界** parser facets + site_keys 驱动，外部 ID/集数/metadata 留 Phase 2b（externalIds undefined）；⑦ scorePair 输入中性 PairSideInput 供 Phase 2b 离线 job 复用。
- **ADR D-N 闭环**：**D-105a-5**（type 兼容矩阵代码常量落地）+ **D-105a-6**（identityScore/legacyScore 字段分离落地）+ **D-105a-9**（Phase 2a group↔pair 附加 evidence 字段，候选来源/数量/排序不变）随本卡闭环；**D-105a-3**（多证据评分聚合公式）Phase 2a 落地评分引擎（exact/alias/canonical 数据源留 Phase 2b）；**D-105a-15**（group→单值 min/union，CHG-VIR-6.5 定档）实装。
- **新增依赖**：无
- **数据库变更**：无（identity_candidate 表 + 离线 job 留 Phase 2b CHG-VIR-8）
- **性能（蓝图偏离）**：蓝图原设计「产全量 evidence 含未评估占位」；实测 perf baseline（ADR-105 / D-105a-10 p95 ≤ 200ms 实时端点）因在线评分推到 206ms。**优化**：去 Phase 2a 未评估占位 evidence（external 4 + episode/metadata/ordinal 4 条/pair，对 UI 零展示价值），scoreGroup 100 组 7.46→5.55ms，perf p95 稳定 < 200ms（3/3）。parseTitle 500 次仅 ~4ms 非瓶颈。
- **门禁/验收**：typecheck EXIT=0 + lint EXIT=0（No ESLint warnings/errors）+ verify:adr-contracts EXIT=0（GET 响应扩字段不触发 endpoint-adr）+ **全量 6115 passed / 0 failed**（462 files / 净 +31；StagingEditPanel 偶发 jsdom flaky 隔离 12/12 通过、与本卡无关；perf baseline ✓）。验收要点：候选数量/分页/默认排序与旧逻辑逐值一致（集成测试守卫）✅ / 仅新增 evidence 字段 ✅ / release_marker_mismatch veto 透传 ✅。
- **注意事项**：① **CHG-VIR-8（Phase 2b）解阻** —— 离线 job 复用 `scorePair`/`PairSideInput`，填 `externalIds` 即评估外部 ID 证据（exact/conflict 已实现，alias/same_site_canonical 留 2b 细化数据源），无需改 scorePair 签名（前向兼容）；② identityScore **仅展示列**不参与排序/计数/分页（Y-105a-1）；UI 双 pill 文案区分「置信度」(legacyScore)/「身份分」(identityScore) 防语义混淆；③ merge 按钮行为**不变**（Phase 2a 只加展示，autoMergeBlocked 经横幅警示但不 disable 按钮——人工 override 入口 / D-105a-4）；④ **范围外留痕**：`apps/server-next/.../crawler/runs/_client/CrawlerRunsView.tsx` 516 行 pre-existing file-size-budget 违规（本卡未碰 crawler / `git status` 确认非本卡引入；budget 非 CLAUDE.md 必跑门禁）。
- **[AI-CHECK]**：分层 NO（identity 评分纯函数在 services 层 / VideoMergesService 调用 / route 不变 / UI 消费类型，无越层）/ 跨模块内部实现 NO（scorePair 输入中性）/ 重复逻辑 NO（评分单一真源 + EvidencePanel 抽出 + identityScore/legacyScore 分离）/ hack NO（去占位 = p95 优化有注释）/ 需拆分函数 NO（scorePair eval 子函数 <80 行）/ 需拆分文件 NO（identity 5 文件 <212 行 + EvidencePanel 抽出避免 MergeClient 膨胀）/ 隐式副作用·吞异常 NO（纯函数）/ 偏离检测：建议 sonnet vs 执行 opus（用户裁定）+ 去占位（p95）+ EvidencePanel 抽出（<500 约束），均已说明。结论：SAFE。

## [CHG-VIR-8] Phase 2b：identity_candidate shadow 表 + 离线生成 job（SEQ-20260602-03 / ADR-105a D-105a-7/8/10）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 01:20
- **执行模型**：claude-opus-4-8（建议 opus，一致）
- **子代理**：code-architect (claude-opus-4-8)（agentId a9a4c5ca8088f4b87；产出 schema/状态机/job 实现蓝图，主循环忠实落地；用户拍板裁定 A=apps/api Bull + B-F 认可）
- **背景（根因）**：Phase 2a（CHG-VIR-7）在线评分附加 evidence；Phase 2b 转**离线 Bull job 预计算 + 持久化 identity_candidate**，与现有实时候选并行对照（不切 UI），为 Phase 2c 切 UI 默认来源奠基。schema/状态机/evidence_hash 输入域已 ADR-105a D-105a-7/8/10 定档（经 Opus Accepted）→ 纯实施，无需新 ADR。
- **修改文件**：
  - `apps/api/src/db/migrations/086_identity_candidate.sql`（**新建**）— identity_candidate 表（D-105a-7）+ 6 索引（`uq_identity_candidate_pending` partial unique `WHERE status='pending'` R5 / pair_key 反查 / `(status,scorer_version,parser_version)` 版本过滤 Y5 / left·right video FK 反查 / `idx_title_observations_core_key` blocking 表达式索引）+ 2 CHECK（`left≠right` + `left::text<right::text` canonical 有序兜底）+ 自引用 FK `ON DELETE SET NULL`（保复活/supersede 链不断 R6）+ DO 校验
  - `apps/api/src/db/queries/identity-candidate.ts`（**新建** 230 行）— 6 queries 纯 SQL（findPendingByPairKey / findLatestRejectedByPairKey / insertCandidate〔ON CONFLICT DO NOTHING RETURNING 并发兜底〕/ supersedePendingByPairKey 腾位 / setSupersededBy 回填 / listForCompareReport + countCompareBuckets 报表 join media_catalog）
  - `apps/api/src/services/identity/evidenceHash.ts`（**新建**）— `computeEvidenceHash`（D-105a-8 八项输入域 + stableStringify 字典序递归 + 数组 dedupeSort + sha256 hex；禁含 created_at/job-id R7）
  - `apps/api/src/services/identity/candidateUpsert.ts`（**新建**）— `upsertIdentityCandidate` 单事务编排（R5 幂等：hash 比对 noop / 腾位 supersede+新建 / R6 复活链 revived_from 不覆盖原 rejected〔新 exact 证据才复活〕/ ON CONFLICT 并发兜底 insertOrRecover）
  - `apps/api/src/services/identity/externalIdLoader.ts`（**新建**）— `loadExternalIdSummaries`（Y-105a-4 双源 media_catalog 4 列 + video_external_refs `is_primary AND manual_confirmed`）
  - `apps/api/src/services/identity/offlineRescore.ts`（**新建** 266 行）— `runIdentityRescore` pipeline（advisory lock 单实例 + cursor keyset 分批 + Blocking core_title_key 分桶〔title_observations.parsed_facets_jsonb，禁 pairwise + MAX_BUCKET=50 护栏〕→ 收敛去重 → 批量拉详情+externalIds+parseTitle → scorePair 评分 → D-105a-4 低分跳过 → 单事务 upsert + 对比聚合 log）
  - `apps/api/src/workers/identityCandidateWorker.ts`（**新建**）— Bull `identity-candidate-queue` 消费者（委托 runIdentityRescore，仿 maintenanceWorker）
  - `apps/api/src/lib/queue.ts`（改）— 新增 identityCandidateQueue（低频 attempts:2）+ logger + queues
  - `apps/api/src/server.ts`（改）— registerIdentityCandidateWorker()（无自动 scheduler）
  - `apps/api/src/services/identity/index.ts`（改）— scoreCandidatePairs + THRESHOLD_CONFIG_VERSION + Phase 2b 模块 re-export
  - `apps/api/src/services/identity/weights.ts`（改）— THRESHOLD_CONFIG_VERSION（D-105a-8 ⑧）+ CANDIDATE_MIN_THRESHOLD（D-105a-4）
  - `scripts/enqueue-identity-rescore.ts` + `scripts/identity-compare-report.ts`（**新建**）— 手动触发 + 三桶对比报表（不切 UI / 不加 admin 端点）
  - `docs/architecture.md`（改）— §5.15「规划草案」→「Phase 1a·2a·2b 已落地」现状基线 + identity_candidate 完整字段/索引
  - 4 测试文件（**新建**）— identity-evidence-hash 14 + identity-candidate-upsert 8 + identity-candidate-queries 8 + identity-offline-rescore 5 = 35
- **核心架构决策（裁定 A / 用户拍板）**：离线 job 落 **`apps/api/src/workers/`（Bull）非 `apps/worker/`（node-cron）** —— 评分逻辑单一真源在 apps/api/src/services/identity/，apps/worker 禁 import apps/api（ADR-107 §4），落 apps/api Bull 零重复实现零权重表漂移（避免违反 R10 单一真源）。**D-105a-10 措辞「apps/worker」作实施澄清非偏离**（决策实质「离线 Bull job」不变）。
- **蓝图偏离（合理，均已注释）**：① 不加自动 scheduler —— Phase 2b shadow 对照阶段手动触发（`scripts/enqueue-identity-rescore.ts`）足够，自动周期留 Phase 2c/用户裁定（避免未验证 job 自动运行）；② offlineRescore 内联 `scorePair` 替代 `scoreCandidatePairs(from ./index)` 消除 index↔offlineRescore 循环 import；③ episode/metadata digest Phase 2b 占位空串（证据细化时填 + bump SCORER_VERSION）；④ externalIds 仅纳入 manual_confirmed（auto_matched 留后续，保守）；⑤ identity_decisions / confirmed→merge（D-105a-11）留 Phase 2c（CHG-VIR-8 无人工裁定入口）。
- **ADR D-N 闭环**：**D-105a-7**（identity_candidate schema + 状态机 + R5/R6）+ **D-105a-8**（evidence_hash 确定性输入域）+ **D-105a-10**（离线 job Blocking+Scoring + 实时端点不触 / 运行时澄清 apps/api Bull）随本卡闭环。
- **新增依赖**：无（sha256 用 node:crypto，Bull/pg 既有）
- **数据库变更**：**新增 `identity_candidate` 表 + 6 索引**（Migration 086，已 `npm run migrate` 应用 dev DB；真实 DB 验证 partial unique 拦重复 pending + CHECK 拦反序 + DO 校验全过；architecture.md §5.15 同步）。另在 `title_observations` 加 blocking 表达式索引 `idx_title_observations_core_key`。
- **门禁/验收**：typecheck EXIT=0 + lint EXIT=0 + verify:adr-contracts EXIT=0（无新 admin 端点 → endpoint-adr 不触发）+ **全量 6148 passed**（466 files / 净 +35；VideoImageSection 21/21 + StagingEditPanel 12/12 偶发 jsdom flaky 隔离全过、与本卡 node 端无关）+ perf baseline ✓。验收要点：幂等无重复 pending（partial unique 真实 DB 验证 + 单测）✅ / 复活链不覆盖原 rejected（R6 单测）✅ / shadow vs 旧候选对比报表三桶口径（countCompareBuckets）✅。
- **注意事项**：① **CHG-VIR-9（Phase 2c）解阻** —— 离线 candidate 已就绪，UI 改读 identity_candidate + identity_decisions 落地 + confirmed→merge 事务（D-105a-11）+ 端点变更**先补 ADR**；② 离线 job **无自动周期**，需手动 `node --env-file=.env.local --import tsx scripts/enqueue-identity-rescore.ts` 触发，报表 `scripts/identity-compare-report.ts`；③ blocking 召回覆盖 = title_observations 覆盖度（采集链路 shadow，历史/写失败 video 漏召回，Phase 2c 切 UI 前评估是否需 backfill）；④ scorer/parser version bump → 全量重算 + 旧 pending supersede（Y5），首次 bump 成本未实测；⑤ episode/metadata/alias/same_site_canonical 证据未实现（Phase 2b 占位/留后续，填实须 bump SCORER_VERSION）。
- **[AI-CHECK]**：分层 NO（identity 评分/编排 services 层 / queries 纯 SQL 零 service import / worker 委托 service / candidateUpsert→queries 正方向）/ 跨模块内部实现 NO（scorePair 中性输入复用）/ 重复逻辑 NO（评分单一真源 apps/api + blocking 复用 title_observations + 裁定 A 不跨 app 复制）/ hack NO（advisory lock + ON CONFLICT 兜底标准范式）/ 需拆分函数 NO（offlineRescore 拆 5 子函数 <80 行 / candidateUpsert 拆 helper）/ 需拆分文件 NO（identity 模块 6 文件均 <266 行）/ 隐式副作用·吞异常 NO（advisory unlock 失败 release(err) destroy connection / job 逐 pair 独立事务）/ 偏离检测：5 项蓝图偏离均已注释说明。结论：SAFE。

## [MAINT] title_observations 回填脚本 + CHG-VIR-8 shadow 验证（CHG-VIR-8-FOLLOWUP）
- **记录时间**：2026-06-03
- **执行模型**：claude-opus-4-8 / 子代理：无
- **背景**：CHG-VIR-8 shadow 验证发现 dev DB `title_observations` 覆盖度极低（39/3470，采集链路 fire-and-forget shadow 写入未覆盖历史 video）→ blocking 召回 0 桶 → 离线候选 0（蓝图风险点 7 / changelog CHG-VIR-8 注意事项③ 预警的覆盖度问题，非代码 bug）。
- **修改文件**：`scripts/backfill-title-observations.ts`（**新建**）— cursor 分批遍历未删 video，`buildTitleObservation` 构造 + 本地 `INSERT ... ON CONFLICT DO NOTHING` 补 site 级观测（source_site_key=null）；**真幂等**（已存在跳过，**不累加 observed_count**）。
- **Codex stop-time review FIX**：初版复用 `recordTitleObservation`（其 `ON CONFLICT DO UPDATE observed_count+1` 是采集链路频次语义）→ 回填重跑会虚增 observed_count（非真幂等，污染观测频次信号）。改为本地 DO NOTHING SQL（回填语义=补历史观测，已存在跳过），**不复用** recordTitleObservation。
- **验证结果**（回填 3470 + 直接 runIdentityRescore）：**573 blocking 桶 / 917 pair / 193 候选 / 159 强负拦截 / 724 低分跳过 / 1.4s**。对比报表：跨 group 新增召回 170（标点/语言变体/符号差异漏合并治理 ✅，如「当前、正被打扰中！」↔「当前正被打扰中」/「末日逃生2：迁移国语」↔「末日逃生2：迁移」）+ 强负拦截 159（season_mismatch/external_id_conflict 误合并拦截 ✅，如「星辰变第5季」↔「第7季」）。逐条可解释，候选质量符合 ADR-105a 双向治理预期。
- **门禁**：typecheck EXIT=0（脚本编译）。无业务逻辑变更（一次性运维脚本，复用 CHG-VIR-6 builder/query）。
- **注意事项**：**生产切 UI（CHG-VIR-9）前须先回填 title_observations**（blocking 覆盖度），否则候选召回不全。dev DB 现有 193 shadow 候选（pending）+ 3470 回填观测，供 CHG-VIR-9 切 UI 消费（可清理重跑）。

## [CHG-VIR-9-A] Phase 2c：端点 ADR amendment + 候选来源读切换（fallback 就绪）（SEQ-20260602-03 / ADR-137 AMENDMENT 2.0 + ADR-105a AMENDMENT）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 02:40
- **执行模型**：claude-opus-4-8（建议 opus，一致）
- **子代理**：code-architect (claude-opus-4-8)（agentId a662a6b4cd495065e；CHG-VIR-9 端点 ADR amendment + 实施蓝图 + 拆 9-A/9-B/9-C，主循环按蓝图实施 9-A）
- **背景**：Phase 2b（CHG-VIR-8）shadow 候选就绪（验证新增召回 170 / 拦截 159）。本卡把审核台 similar + /admin/merge 的 UI 候选来源切到统一 identity_candidate（ADR-137 AMENDMENT 2026-06-02 已预告取代方向）。用户裁定 similar 默认 identity / merge 默认 legacy / reject 新端点留 9-B。
- **修改文件**：
  - `docs/decisions.md`（改）— ADR-137 §端点契约表 similar 行加 `source?` + **AMENDMENT 2.0 2026-06-03**（端点契约：保留路径 + `?source=identity|legacy` default identity + 响应扩 optional + 空表自动降级 + 向后兼容论证）；ADR-105a **AMENDMENT 2026-06-03**（merge candidates `?source=` default legacy + 2-video 基础折叠）
  - `apps/api/src/db/queries/identity-candidate.ts`（改）— `listPendingCandidatesByVideoId`（审核台对侧召回：CASE 取对侧 video + 复用 listSimilarCandidates 的 videos/media_catalog JOIN 范式 + version 过滤 Y5）+ `listPendingCandidatePairs`（merge 折叠用）
  - `apps/api/src/services/ModerationService.ts`（改）— `listSimilar` 加 source 分支返回 `{ items, source }`；source=identity 读候选 map（identityScore/candidateId/strongNegativeReasons/status）+ 空表自动降级 legacy；新增 `SimilarResult` 类型 + `SimilarVideoItem` 扩 optional 字段
  - `apps/api/src/services/VideoMergesService.ts`（改）— `listCandidates` 加 source 分支 + `listIdentityCandidates` 私有方法（每 pending pair→2-video group）+ 空表降级；3 处 return 加 source 回显
  - `apps/api/src/services/VideoMergesService.schemas.ts`（改）— `buildGroupFromPair` helper（**抽出避免 VideoMergesService 超限膨胀**，520≈原 523）+ `ListCandidatesSchema` 加 source
  - `apps/api/src/routes/admin/moderation.ts`（改）— `SimilarQueryParams` 加 source + handler 回显 `{ data, source }`
  - `packages/types/src/video-merge.types.ts`（改）— `ListCandidatesParams`/`ListCandidatesResult` 加 source
  - `apps/server-next/src/lib/moderation/api.ts`（改）— `SimilarVideoItem` optional 字段 + `ListSimilarVideosOptions` source 参数（返回类型不变避免破坏 TabSimilar）；`lib/merge/api.ts`（改）— listCandidates source 透传
  - `tests/unit/api/identity-source-switch.test.ts`（**新建** 7）+ `identity-candidate-queries.test.ts`（+2 by-videoId/pairs SQL）+ `moderation-similar.test.ts`（7 现有更新消费 `{items,source}` + 显式 source:'legacy'）
- **核心要点**：① 端点契约向后兼容（保留路径 + 响应扩 optional + 旧前端读 similarityScore 不破，identity 来源填 round(identityScore*100)）；② 空表自动降级 legacy（未回填/job 未跑时不空窗）；③ identityScore 与 legacyScore/similarityScore 字段分离（R3）；④ source envelope 回显实际来源；⑤ legacy 路径（4 维加权 + group-by）完整保留作 fallback，不删。
- **ADR D-N 闭环**：无新 D 编号（ADR-137/105a AMENDMENT 端点契约细化，D-105a-9 候选层级 Phase 2c 切来源实施）。
- **新增依赖**：无
- **数据库变更**：无（query 新增，无 migration；identity_decisions + 写路径留 9-B）
- **门禁/验收**：typecheck EXIT=0 + lint EXIT=0 + verify:adr-contracts EXIT=0（**无新 admin route → endpoint-adr 不触发**）+ **全量 6159 passed / 0 failed**（467 files / 净 +9）。验收：候选来源可切（?source=）✅ / identity 空表自动降级 legacy ✅ / 端点契约向后兼容 ✅ / identityScore 与 similarityScore 分离 ✅。
- **注意事项**：① **CHG-VIR-9-B 解阻** —— 读契约就绪，9-B 落 identity_decisions migration + confirmed→merge 单事务（D-105a-11）+ 新增 `POST /admin/identity-candidates/:id/reject`（**须独立 ADR + Opus PASS + verify:endpoint-adr**）；② **蓝图偏离（合理）**：merge identity 基础折叠（每 pair→2-video group），完整 N-video 连通分量折叠 + 翻 merge 默认 identity 留 merge shadow 稳定后小卡；前端 source envelope 回显 + TabSimilar/MergeClient UI confirm/reject 留 9-C；③ 生产切 identity 默认前须回填 title_observations（blocking 覆盖度 / CHG-VIR-8 证实）；④ similar 默认已切 identity（空表降级），merge 默认仍 legacy。
- **[AI-CHECK]**：分层 NO（query db 层 / service source 分支 / route schema+回显 / 前端 api 类型，无越层）/ 跨模块内部实现 NO（复用 listSimilarCandidates JOIN + fetchVideoDetailsForCandidates + mapVideoRow）/ 重复逻辑 NO（legacy 保留复用 fallback + buildGroupFromPair 抽 schemas 真源）/ hack NO（空表降级是设计）/ 需拆分函数 NO（listIdentityCandidates 私有方法 + buildGroupFromPair <80 行）/ 需拆分文件 NO（buildGroupFromPair 抽 schemas 避免 VideoMergesService 膨胀，回落 520）/ 隐式副作用·吞异常 NO / 偏离检测：merge 2-video 基础折叠 + merge 默认 legacy（用户裁定）+ source envelope 留 9-C，均已说明。结论：SAFE。

## [CHG-VIR-9-B] Phase 2c：identity_decisions migration + confirmed→merge + reject 写路径（SEQ-20260602-03 / ADR-178 + ADR-105a D-105a-11 闭环）

- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 11:20
- **执行模型**：claude-opus-4-8
- **子代理**：feature-dev:code-architect (claude-opus-4-8 / agentId afd09afa90913f9db)——前置门禁裁定 ① identity_decisions DDL ② ADR-178 reject 端点草案 ③ 实施蓝图（22 项裁定决策表）
- **修改文件**：
  - `docs/decisions.md` — 新增 ADR-178（reject 端点 + identity_decisions 关联，D-178-1~6，Accepted）+ ADR-105a AMENDMENT 2026-06-03（D-105a-11 闭环：DDL 定档 + 单 BEGIN/COMMIT + unmerge 联动口径 + merge candidateId 扩参登记）
  - `apps/api/src/db/migrations/087_identity_decisions.sql` — 新建 identity_decisions 表：decision CHECK confirmed/rejected（不预留 override/两段式 YAGNI）+ R8 CHECK `decision<>'confirmed' OR video_merge_audit_id IS NOT NULL` + partial unique `(candidate_id) WHERE decision='confirmed'`（一 candidate 至多 confirm 一次）+ revert consistency CHECK + actor_type human/system 预留 + 3 索引（audit 反查 partial / candidate 反查）+ DO 验证块
  - `apps/api/src/db/migrations/088_audit_log_extend_target_kind_identity_candidate.sql` — admin_audit_log target_kind CHECK 14→15（identity_candidate，073 范式）
  - `apps/api/src/db/queries/identity-decision.ts` — 新建：insertIdentityDecision / findConfirmedDecisionByAuditId / markDecisionReverted（全 PoolClient 事务内，reverted 原地三列不改 decision 值）
  - `apps/api/src/db/queries/identity-candidate.ts` — 追加：findCandidateById（FOR UPDATE 并发串行化）/ findCandidateByIdReadonly（事务前快速失败）/ updateCandidateStatus（from-state 守卫，rowCount=0 → 调用方 409 回滚）
  - `apps/api/src/services/IdentityCandidatesService.ts` — 新建：reject 单事务（pending→rejected + decision(rejected, audit_id=NULL)）+ validateForMerge（404/409/422 事务前）+ attachConfirmedDecision（merge 事务内挂载，client 由 merge 持有）+ RejectCandidateSchema；归属独立 Service（VideoMergesService 超 500 行不膨胀 / D-178-1）
  - `apps/api/src/services/VideoMergesService.ts` — merge：candidateId 校验全在 BEGIN 前（主路径零变更）→ 事务内 candidate confirmed + decision(confirmed, auditId) 单 BEGIN/COMMIT（R8）；并发被 reject → 整 merge ROLLBACK；audit afterJsonb 纯增量补 candidateId/decisionId；unmerge merge 分支事务内联动（findConfirmedDecisionByAuditId → markDecisionReverted，candidate 保持 confirmed 避撞 uq_identity_candidate_pending / D-178-4）；merge 函数 110→60 行拆 assertVideosMergeable + runMergeTransaction（80 行红线，机械提取零行为变更）
  - `apps/api/src/services/VideoMergesService.schemas.ts` — MergeSchema 加 optional candidateId（uuid）
  - `packages/types/src/video-merge.types.ts` — MergeParams.candidateId optional（纯增量）
  - `packages/types/src/admin-moderation.types.ts` — AdminAuditActionType + 'identity_candidate.reject'；AdminAuditTargetKind + 'identity_candidate'
  - `apps/api/src/services/AuditLogService.ts` — ACTION_TYPES / TARGET_KINDS 数组同步
  - `apps/api/src/routes/admin/identity-candidates.ts` — 新建 POST /admin/identity-candidates/:id/reject（adminOnly + safeParse 422 + isAppError 404/409 映射）
  - `apps/api/src/server.ts` — 注册 adminIdentityCandidatesRoutes（prefix /v1）
  - `docs/architecture.md` — §5.15 补 identity_decisions schema + 决策写路径现状（Migration 087/088）
  - `tests/unit/api/identity-decision-queries.test.ts` — 新建 7 用例（SQL/参数断言）
  - `tests/unit/api/identity-candidates-reject.test.ts` — 新建 16 用例（reject 单事务 / 404/409 / 并发兜底 / validateForMerge / attachConfirmedDecision / audit payload 内容断言 R-MID-1 / schema）
  - `tests/unit/api/video-merges-confirm-decision.test.ts` — 新建 12 用例（merge 主路径零变更 / 单事务 BEGIN-COMMIT 各一次 / 事务前快速失败 BEGIN 未调用 / from-state 冲突整 merge ROLLBACK / unmerge 联动 + legacy merge 无 decision 不报错 / split 分支不触发 / MergeSchema）
  - `tests/unit/api/audit-log-coverage.test.ts` + `tests/unit/api/audit-log-service-enums-set-equal.test.ts` — audit 枚举 4 处同步（守卫指引路径，R-MID-1 第 31 次系统化）
- **新增依赖**：无
- **数据库变更**：Migration 087（identity_decisions 新表）+ 088（admin_audit_log target_kind CHECK 14→15）；真实 DB 应用成功 + 约束验证 6 项全过（R8 拦截 / revert consistency 拦截 / decision 枚举拦截 / partial unique confirmed 拦截 / 双 rejected 通过〔R6 复活后再 reject 合法〕/ target_kind identity_candidate 通过），全程事务 ROLLBACK 零残留
- **测试覆盖**：typecheck/lint/verify:adr-contracts EXIT=0；verify:endpoint-adr 识别新端点（204 admin 路由全对齐）；**全量 6196 passed / 0 failed**（470 files / 净 +37）；AuditClient/StagingPageClient 中途 jsdom flaky 隔离重跑全过（既有模式，与本卡 node 端无关），最终全量跑 0 failed；e2e 归 CHG-VIR-9-C（本卡无 UI 变更）
- **注意事项**：① **解阻 CHG-VIR-9-C**（UI confirm/reject：rejectIdentityCandidate 客户端 + mergeVideos candidateId 透传 + EvidencePanel 复用）；② reject 复活链零额外实现——离线 job 既有 R6 路径（revived_from_candidate_id 新建 pending）天然兼容 rejected candidate；③ unmerge 后 candidate 保持 confirmed（不回 pending），该 pair 重新出现在候选列表依赖离线 job 重评（设计裁定 D14，避免撞 partial unique）；④ VideoMergesService.ts 520→578（baseline 豁免内；膨胀主因 merge 110→60 拆分的方法签名/注释管理开销，FILE-SIZE 拆分跟踪卡既有）；⑤ plan v1.4 §3.0.5 表为历史文档（仓内无该节），audit actionType 真源 = AdminAuditActionType union + 4 处同步守卫（与 source_line_alias.retire 先例一致）
- **ADR D-N 闭环**：D-178-1（reject 独立端点 + IdentityCandidatesService 归属）/ D-178-2（pending→rejected 状态迁移 + 非 pending 409 口径）/ D-178-3（merge candidateId 扩参 + 单事务 R8 + 事务前校验）/ D-178-4（unmerge 联动 reverted + candidate 保持 confirmed）/ D-178-5（migration 087 DDL 定档）/ D-178-6（audit actionType/targetKind 扩展 + migration 088）—— 6 条全部随本卡实施闭环；D-105a-11（confirmed→merge 事务边界 + identity_decisions 关联）随 ADR-105a AMENDMENT 2026-06-03 闭环
- **[AI-CHECK]**：分层 NO（migration→queries 纯 SQL→Service 编排→route 无业务逻辑，零越层）/ 跨模块内部实现 NO（merge 挂载经 IdentityCandidatesService 公开 static helper；queries 不 import Service）/ 重复逻辑 NO（decision 写入单一真源 insertIdentityDecision；reverted 复用 video_merge_audit 三列范式；校验复用 AppError + isAppError 既有映射）/ hack NO（FOR UPDATE + from-state 守卫是并发设计；事务前校验+事务内复核是快速失败 UX + 正确性双层）/ 需拆分函数 已拆（merge 110→60 / 所有新函数 <80）/ 需拆分文件 NO（新文件全 <500；VideoMergesService 578 在 baseline 豁免，膨胀已说明）/ 隐式副作用·吞异常 NO（audit fire-and-forget 是既有设计，COMMIT 后才写）/ 偏离检测：与子代理蓝图一致（22 项裁定全落地）；唯一偏离 = merge 函数拆分（蓝图预判"若净增推高风险应抽取"，实际执行）。**共享层沉淀评估**：identity-decision queries 与 IdentityCandidatesService 是 identity 域新真源（本卡即沉淀）；无应沉淀未沉淀项。结论：SAFE。

---

## CHG-VIR-9-C — Phase 2c：UI 切换 + confirm/reject 操作（SEQ-20260602-03 / CHG-VIR-9 全系列收口）

- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 12:05
- **执行模型**：claude-opus-4-8（建议模型 sonnet，用户直接以 opus 会话人工覆盖指派；无子代理需求——UI 编排，契约已在 9-A/9-B 定档）
- **子代理**：无
- **修改文件**：
  - `packages/types/src/video-merge.types.ts` — CandidateGroup 扩 optional `candidateId`（identity 来源 confirm/reject 锚点；沿 9-A SimilarVideoItem.candidateId 同款纯增量模式，legacy 来源不填）
  - `apps/api/src/services/VideoMergesService.schemas.ts` — buildGroupFromPair 透出 `candidateId: p.id`（9-A 遗留缺口：PendingCandidatePairRow.id 未透出，merge 工作台拿不到操作锚点）
  - `docs/decisions.md` — ADR-105a AMENDMENT 2026-06-03（CHG-VIR-9-C）：candidates 响应扩 candidateId 登记 + UI 落地登记（无新 route/migration，verify:endpoint-adr 不触发）
  - `apps/server-next/src/lib/identity/api.ts` — 新建：rejectIdentityCandidate（POST /admin/identity-candidates/:id/reject / ADR-178），TabSimilar + MergeCandidatesSection 双入口共用真源；confirm 不在此处（= merge 透传 candidateId / D-178-3）
  - `apps/server-next/src/lib/identity/evidence-labels.ts` — 新建：EVIDENCE_LABELS 真源沉淀（原 EvidencePanel 本地定义，TabSimilar 拦截 chips 加入消费后跨页面共享 → 提升 lib/identity 中性层；exhaustive Record 缺项 typecheck 拦截）
  - `apps/server-next/src/lib/moderation/api.ts` — listSimilarVideos 消费 `{data, source}` envelope（返回 SimilarVideosResult，source 缺省容错 legacy）；SimilarVideoItem.strongNegativeReasons 类型对齐后端 `EvidenceType[]`
  - `apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar.tsx` — source Segment toggle（默认 identity，所有状态可见空态可切）+ 降级回显提示条（请求 identity 实际 legacy）+ 身份分 pill（identity 来源替代 similarityScore 数字）+ 拦截原因 chips（EVIDENCE_LABELS）+ 拒绝按钮（window.confirm 守卫 + rejectIdentityCandidate + 行本地移除 + toast）+「发起合并」深链追加 `&candidate_id`
  - `apps/server-next/src/app/admin/merge/_client/MergeClient.tsx` — 704→320 行（500 行红线先拆分再扩展）：CandidatesSection+CandidateExpand 拆出；DirectMergeWorkspace 接 `?candidate_id` 透传（**仅当 picker B 仍 === candidate_b 时透传**，换 B 自动失效防 pair 失配 422）+ dismissCandidateBanner 同步清理 candidate_id
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidatesSection.tsx` — 新建（348 行）：source toggle（默认 legacy / 用户裁定 (a)，shadow 稳定后另起小卡翻默认）+ 降级回显提示 + minScore 控件仅 legacy 显示（identity 路径后端不消费 minScore）+ identity 空态差异化文案 +「执行合并」透传 group.candidateId（confirm 语义 / 单事务挂 decision）+ handleReject（confirm 守卫 + toast + 刷新）
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidateExpand.tsx` — 新建（194 行，500 行 budget 二次拆分）：CandidateExpand card 形态 + 置信度/身份分双 pill + EvidencePanel 复用（CHG-VIR-7）+「拒绝候选」按钮（onReject 注入，identity 来源才渲染）；SECONDARY_TEXT 真源 export
  - `apps/server-next/src/app/admin/merge/_client/EvidencePanel.tsx` — EVIDENCE_LABELS 本地定义删除改 import 共享真源（零行为变更）
  - `tests/unit/components/server-next/admin/moderation/TabSimilar.test.tsx` — 5→10 用例（envelope mock + identity 行渲染 / candidate_id 深链 / reject 调用与行移除 / 降级提示 / source toggle 切换）
  - `tests/unit/components/server-next/admin/merge/MergeCandidatesSection.test.tsx` — 新建 7 用例（默认 legacy / toggle identity + minScore 隐藏 / 降级提示 / 拒绝按钮渲染与调用 / merge 透传 candidateId / legacy 无拒绝按钮且不带 candidateId）
  - `tests/unit/components/server-next/admin/merge/MergeDirectWorkspace.test.tsx` — +2 用例（candidate_id 透传 / B 换选自动失效）
  - `tests/unit/server-next/identity/identity-api.test.ts` — 新建 6 用例（reject URL/encode/body/data 解包 + listSimilarVideos source 序列化与 envelope 容错）
- **新增依赖**：无
- **数据库变更**：无（无 migration / 无新 route，verify:endpoint-adr 不触发）
- **测试覆盖**：typecheck/lint/verify:adr-contracts EXIT=0（endpoint-adr 204 admin 路由全对齐）；文件 budget 零新增（19 违规全 pre-existing）；**全量 6216 passed / 0 failed**（472 files / 净 +20）；e2e 本机 :3000 webServer 冲突在页面加载前失败（沿 CHG-VSR-PRE-2 先例 = 非回归）；admin moderation/merge 手测归用户验收
- **注意事项**：① **CHG-VIR-9 全系列（9-A/9-B/9-C）收口，Phase 2c 完成**；② **生产切 UI 前须先回填 title_observations**（`scripts/backfill-title-observations.ts`，采集 fire-and-forget 覆盖不全则候选召回不全 / 卡面前置仍有效）；③ merge 默认仍 legacy（用户裁定），翻默认 identity + N-video 连通分量折叠留 shadow 稳定后小卡；④ pre-existing 发现：`tests/e2e/admin/moderation/right-pane-tabs.spec.ts:87` 仍断言 TabSimilar 占位文案（2026-05-21 已真实化），断言漂移归 e2e 环境长尾；⑤ reject 误触防护 = window.confirm（误拒后复活依赖离线 job 证据变化 R6，不可轻易恢复故加守卫）
- **[AI-CHECK]**：分层 NO（UI 全经 lib api 客户端，零直接 fetch/DB）/ 跨模块内部实现 NO（TabSimilar 不 import merge/_client，经 lib/identity 中性层）/ 重复逻辑 NO（EVIDENCE_LABELS 与 rejectIdentityCandidate 单一真源双消费；candidateId 透传 spread 模式三处一致）/ hack NO（B 换选失效是 pair 一致性守卫；source/effectiveSource 双 state 是请求/回显语义分离）/ 需拆分函数 NO（新函数全 <80）/ 需拆分文件 已拆（MergeClient 704→320 + Section 348 + Expand 194 全 <500）/ 隐式副作用·吞异常 NO（reject 失败 toast 显式反馈）/ 偏离检测：① CandidateGroup.candidateId 契约补充（卡面未明示但 confirm/reject 必需，ADR AMENDMENT 登记）② 执行模型 sonnet→opus 人工覆盖。**共享层沉淀评估**：lib/identity/{api,evidence-labels} 本卡即沉淀（双入口真源）；无应沉淀未沉淀项。结论：SAFE。

### CHG-VIR-9-C FIX-1（Codex stop-time review）— merge candidates route 层 source 回显透传缺口

- **记录时间**：2026-06-03 12:10
- **根因**：`apps/api/src/routes/admin/video-merges.ts` GET candidates 重组响应时丢 `result.source` 字段（9-A 遗留：Service 返回了 source 但 route 未透传）→ 前端 `res.source` 恒 undefined → `effectiveSource` 恒 null → **merge 工作台降级提示永不显示**；lib 层单测 mock 在 api 客户端层故漏过。
- **修复**：route `reply.send({...})` 补 `source: result.source` 一行。
- **测试**：新建 `tests/unit/api/video-merges-candidates-route.test.ts`（fastify inject 2 用例：降级回显 body.source='legacy' 可达前端 / identity 回显 + query 透传 Service）；回归 10 文件 86 passed + typecheck/lint 零错误。

---

## MAINT — VideoListClient 快捷筛选 chip style shorthand 冲突修复（用户报告 console error）

- **记录时间**：2026-06-03 12:14
- **执行模型**：claude-opus-4-8
- **根因**：`QUICK_CHIP_STYLE.border`（shorthand）与 `QUICK_CHIP_PRESSED_STYLE.borderColor`（non-shorthand）spread 合并混用——pressed↔非 pressed rerender 时 React 移除 borderColor 与残留 border 冲突，触发「Removing a style property during rerender (borderColor) when a conflicting property is set (border)」console error（VideoListClient.tsx:306 quick filter buttons）。
- **修复**：`QUICK_CHIP_PRESSED_STYLE.borderColor` → 完整 `border: '1px solid var(--admin-accent-border)'` shorthand 覆盖（语义不变，两分支均只有 border 单键）+ 防回归注释。
- **测试**：videos 组件 9 文件 126 passed + typecheck 零错误。
- **待办备忘**：`verify-style-shorthand-conflict.mjs` 对「跨对象 spread 合并」混用存在检测盲区（本 case 0 命中）；其它 server-next 文件仍有 `borderColor:` 使用待逐元素核对是否与 shorthand 交替——可起脚本增强小卡。

### CHG-VIR-9-C FIX-2 / FIX-3（Codex review 第 2 轮）— identity 候选分页 total + 软删 stale 候选

- **记录时间**：2026-06-03 12:30
- **FIX-2 根因**：`VideoMergesService.listIdentityCandidates` 用当前页 `groups.length` 当 `total`（9-A 引入）——pending 候选超 limit 时前端收到 total ≤ 页大小，无法翻页。
- **FIX-2 修复**：新 `countPendingCandidatePairs`（与 list 同 WHERE 口径常量 `PENDING_PAIR_WHERE`）+ `Promise.all` 并取；降级语义同步修正——仅**真空表**（count=0）降级 legacy，offset 超尾返回空 data 保持 `source:'identity'`（identity 模式翻页中悄然切 legacy 全量数据是更坏的语义漂移）。
- **FIX-3 根因**：`listPendingCandidatePairs` 不排除软删视频——legacy merge（无 candidateId）软删 pair 一侧后 candidate 仍 pending，merge identity 列表给出确认必败的 stale 候选（下游 `fetchVideoDetailsForCandidates` 亦不过滤 deleted_at）。
- **FIX-3 修复**：list/count 共用 WHERE 增双侧 `EXISTS (... deleted_at IS NULL)`；similar 侧 `listPendingCandidatesByVideoId` 已有 `nv.deleted_at IS NULL` 无需改。
- **测试**：identity-source-switch 6→8 用例（total=全量 count / 超尾不悄降）+ identity-candidate-queries +3（FIX-3 双侧 EXISTS 断言 / count 同口径 / rows 空容错）；6 文件 54 passed + typecheck 零错误。
- **Codex P2 第 3 项**（sources-matrix lastChecked filter 与显示值口径不一致）属 CHG-VSR-3 时期代码非本系列 → 起 follow-up 卡 **CHG-VSR-LASTCHECKED-FILTER-ALIGN**（task-queue 尾部，待用户裁决排期）。

### CHG-VIR-9-C FIX-4（Codex review 第 3 轮）— FIX-2 新增 import 未同步既有 Vitest mock 工厂

- **记录时间**：2026-06-03 12:32
- **根因**：FIX-2 在 VideoMergesService 顶层新增 `countPendingCandidatePairs` import，`video-merges-confirm-decision.test.ts` 的 identity-candidate mock 工厂未同步该 key → import 解析为 undefined（该测试现仅走 merge 写路径未触发调用故 pass，属潜伏 TypeError）。
- **修复**：工厂补 `countPendingCandidatePairs: vi.fn()` 一行；另两个 mock 该模块的测试（reject / upsert）其 SUT 不消费 count，按需部分 mock 无需动。
- **测试**：4 文件 44 passed。

## [MAINT] SEQ-20260602-03 Phase 2 收口复核 + Phase 3 启动配置补全（纯 docs 落档）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 12:55
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `docs/task-queue.md` — ① CHG-VIR-8 完成备注补记蓝图偏离④（blocking 召回键实际仅 `core_title_key` 单 key 分桶；设计 §Phase 2b 列 6 键，外部 ID 经 externalIdLoader 仅进 scoring 证据非召回键 → 外部 ID 同/标题异 pair 召回不到；`offlineRescore.ts` 头注释「多 key 并集」与实现不符，修正并入 CHG-VIR-9-D）；② CHG-VIR-10 卡启动前补全（Opus 前置门禁①：shadow decision 持久化形态三选一——新表 migration / identity_candidate.evidence_jsonb 扩展〔trigger_source='ingest' 086 已预留〕/ 纯脚本报表，**不得塞入 identity_decisions**〔087 CHECK 仅 confirmed/rejected，YAGNI 裁定〕；门禁②：外部 ID 第二召回键裁定；fire-and-forget 性能边界 + ingest 旁路基线另立〔D-105a-10 仅覆盖实时端点/离线 job〕；硬前置 OBS-BACKFILL；引用校正 Y3→R9 + D-105a 第 12 条〔shadow 不触发 merge，D-105a-11 不适用；第 12 条此处用中文序数书写避免被 adr-parser 误判闭环——该守恒条款须保持 pending 至 Phase 3 验收后另起 ADR〕；验收报表复用 identity-compare-report 扩展）；③ 新增 11-D CHG-VIR-OBS-BACKFILL（生产 title_observations 全量回填 runbook + 验证报表，CHG-VIR-10 与 9-D 双硬前置；blocking 召回覆盖 = 覆盖度，9-C dev 验证 573 桶/917 pair/193 候选）；④ 新增 11-E CHG-VIR-9-D（merge 默认源翻转 identity + N-video 连通分量折叠——9-A 蓝图偏离登记「留小卡」补建；设计 §4.3 connected components 折叠消除 C(N,2) 重复行）；⑤ SEQ 依赖链行同步（Phase 2 → OBS-BACKFILL → Phase 3）+ 最后更新时间登记复核结论。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：复核结论摘要——Phase 2（2a/2b/2c）对设计完成度高：核心契约全落地、门禁全绿（6216 passed）、ADR-105a D 条 14/15 闭环（唯一 pending = D-105a 第 12 条守恒条款〔中文序数书写避免 adr-parser 误闭环〕，Phase 3 验收后另起 ADR 才闭环，非欠账）+ ADR-178 6/6。开放遗留：生产 title_observations 回填（OBS-BACKFILL）、merge 翻默认 + 连通分量折叠（9-D）、blocking 多 key 并集（CHG-VIR-10 门禁②裁定）、数据变化重评触发器（Phase 3 ingest hook 部分补齐）、episode/metadata digest 占位（细化时 bump SCORER_VERSION）。merge_blocklist 定档舍弃独立表：rejected 状态 + R6 复活链已覆盖其语义（ADR-105a follow-up 1 视为闭合）。CHG-VIR-10 启动须先过 OBS-BACKFILL + spawn Opus 子代理裁定门禁①②。

## CHG-VIR-OBS-BACKFILL — 生产 title_observations 全量回填 runbook + 覆盖度验证报表
- **完成时间**：2026-06-03
- **执行模型**：claude-opus-4-8（建议 sonnet，用户直接以 opus 会话人工覆盖指派，沿 CHG-VIR-9-C 先例）
- **子代理**：无
- **来源**：SEQ-20260602-03 Phase 2 收口 follow-up（11-D）；CHG-VIR-10 与 CHG-VIR-9-D 双硬前置。
- **修改文件**：
  - `scripts/report-title-observation-coverage.ts`（新建）— 只读覆盖度报表：① eligible videos（与 backfill 脚本 `deleted_at IS NULL AND title IS NOT NULL` 同口径）；② 当前 parser_version 下有观测 / coreTitleKey 非空两档覆盖率 + 未覆盖数；③ parser_version 分布（识别旧版本残留行，不参与召回）；④ blocking 分桶规模（与 `offlineRescore.fetchBlockingBuckets` 同口径 HAVING>1：桶数 / ΣC(n,2) pair 上限 / 最大桶 / 超护栏桶 n>50 计数）。DEFAULT_MAX_BUCKET=50 本地复述 offlineRescore 内联默认（未 export），注释指向真源。
  - `docs/manual/title-observations-backfill-runbook.md`（新建）— 生产回填运维手册：§1 背景（blocking 召回覆盖 = title_observations 覆盖度 + 被阻塞项表：9-C 生产切 UI / CHG-VIR-10 / 9-D）；§2 安全性声明（零生产归并行为变更——只写 title_observations + identity_candidate 两张 shadow 表；回填 DO NOTHING 真幂等可中断重跑，与采集链路 recordTitleObservation +1 语义差异显式说明）；§3 前置检查（migration 085/086 / worker 注册在 apps/api 进程内无独立进程 / Redis / env / 执行窗口建议）；§4 五步执行（前快照→回填→覆盖率 100% 通过判据→enqueue full-rescan + `identity-rescore: done` 日志确认含 IdentityRescoreResult 全字段表 + lockSkipped 处置→identity-compare-report 候选密度 0.1×–10× dev 基线判据→留档）；§5 dev 基线（2026-06-03 实测：3617 eligible / 100% 覆盖 / 617 桶 / 969 pair 上限 / 最大桶 8 超护栏 0 / 193 pending 候选 / 170 跨 group 新增召回 / 159 强负拦截 / 密度 ≈5.3% / full-rescan ≈1.4s）；§6 异常处置表（中断重跑 / 覆盖率不达 / lockSkipped / job 无 done / oversize 桶 / 密度异常 / parser_version 残留）；§7 回滚（shadow 表无生产行为可回滚；清空语句限 pending——confirmed/rejected 关联 identity_decisions 审计链 ADR-178 不得删）。
  - `docs/tasks.md` / `docs/task-queue.md` — 任务卡生命周期 + 11-D 状态 ✅。
- **新增依赖**：无
- **数据库变更**：无（零端点 / 零 migration / 零生产代码变更，纯 scripts + docs）
- **测试**：dev 实跑两脚本验证可用（coverage 报表 + compare-report 均正常出数）；门禁全过 typecheck / lint / verify:adr-contracts EXIT=0 + 全量 **473 files 6222 passed / 0 failed**（首跑 1 个 DataTable matrix jsdom flaky 重跑全过——本卡未触及 admin-ui，沿 CHG-VIR-8 已知 flaky 先例）。
- **共享层沉淀评估**：统计 SQL 消费方仅运维场景 1 处（未达 3 处提取阈值），不沉淀；CHG-VIR-10 precision/recall 报表复用时再抽 queries 函数。
- **注意事项**：卡片范围 = 工程产出（runbook + 验证工具）；**生产实际回填由用户/运维按 runbook 执行，执行完成并留档（§4 Step 5）前，CHG-VIR-10 与 CHG-VIR-9-D 的硬前置仍未解除**。dev 桶数 617 > 上次 full-rescan 时 573 印证「观测变化后必须重新入队 full-rescan」（runbook §5 注已说明）。

### [MAINT] CHG-VIR-OBS-BACKFILL runbook env 占位名修正 + REDIS_URL 兜底警告
- **记录时间**：2026-06-03
- **原因**：用户按 runbook 执行报 `node: .env.production: not found`——原示例占位名易被直接复制且仓库无此文件。
- **修改**：`docs/manual/title-observations-backfill-runbook.md` §3 env 条目改为 `.env.production.local`（.gitignore 已覆盖不会被提交，明示需自建）+ 明确脚本只读 `DATABASE_URL` / `REDIS_URL` 两变量 + ⚠️ `queue.ts` 有 `redis://localhost:6379` 兜底——漏填 REDIS_URL 时 enqueue 静默入本地 Redis、生产 worker 收不到 job；§4 五处命令示例同步替换。

### [MAINT] CHG-VIR-OBS-BACKFILL 当日收口 — 单环境定档，回填执行完毕 + 硬前置解除
- **记录时间**：2026-06-03
- **执行模型**：claude-opus-4-8
- **背景**：用户确认 `resovo_dev` 为唯一库、无独立生产环境 → runbook 的"生产回填"即已在该库完成（本卡早前实跑验证覆盖率 100% / 617 桶）。
- **执行**：按 runbook §5 注重跑 full-rescan 反映 617 桶最新观测（job `identity-rescore-1780519984663`，API 进程 :4000 在线消费）→ 候选 193→**198**（173 跨 group 新增召回 / 162 强负拦截 / 密度 ≈5.5%，结构合理）。
- **落档**：runbook 新增 §0 执行留档（单环境定档 + 全步骤结果表 + 结论）；task-queue 同步 5 处（11-D 状态行 + 完成备注补记 / CHG-VIR-10 硬前置 ✅ ×2 / CHG-VIR-9-D 依赖 ✅ / SEQ 依赖链行 / 9-C 卡面前置已满足标注）；tasks.md 头部摘要同步。
- **结论**：**CHG-VIR-10 与 CHG-VIR-9-D 的 OBS-BACKFILL 硬前置解除**（9-D 仍余"merge shadow 稳定"用户裁定时点；CHG-VIR-10 仍余启动时 Opus 前置门禁①②）；CHG-VIR-9-C「切 UI 前须先回填」前置满足。

## [CHG-VIR-10] Phase 3：findOrCreate 旁路 ingest shadow scoring + blocking 第二召回键（不改 catalog_id 绑定）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 15:05
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8 / agentId abf779f6c31ce38a0) — 前置门禁两项裁定（①shadow 持久化形态混合 B+C / ②纳入 external_id 第二召回键）
- **修改文件**：
  - `apps/api/src/services/identity/blockingRecall.ts` — 新建：Blocking 召回真源（段① core_title_key 分桶自 offlineRescore 迁入 + 段② external_id `provider:id` 桶〔Y-105a-4 双源 UNION〕keyset 分页 + HAVING>1；单 video 召回 recall*Counterparts 与分桶共享同一数据源 SQL → ingest 与 offline 口径一致）
  - `apps/api/src/services/identity/pairScoringPersist.ts` — 新建：评分→evidence_hash→幂等 upsert 共享层（persistPairs/buildSides/snapshot/externalRefSummary 自 offlineRescore 沉淀；**blockingKeys 改「双方 core key + 共享 ext 桶 key」有序去重并集**〔D-105a-17，pair 数据确定性计算、召回路径无关〕；triggerSource 参数化；返回全量 PairScore 供 ingest bind 判定）
  - `apps/api/src/services/identity/ingestShadow.ts` — 新建：ingest 旁路编排（D-105a-16：双键召回对侧→scorePair→候选 upsert trigger_source='ingest'→shadow bind 判定〔仅 exact 命中+无强负〕→pino 结构化日志 stage='ingest-shadow' 含 outcome 五态 / matched_step / legacy vs shadow catalog；MAX_COUNTERPARTS=50 确定性截断）
  - `apps/api/src/services/identity/offlineRescore.ts` — 双段召回编排（段①+段② 独立 cursor / 全局 seen 去重 / 共享 processBuckets）+ 消费共享层 + IdentityRescoreResult 增 externalIdBuckets + 头注释「多 key 并集」自此与实现相符（CHG-VIR-9-D 登记的注释修正项随本卡闭环）
  - `apps/api/src/services/identity/index.ts` — Phase 3 导出（ingestShadow / pairScoringPersist / blockingRecall）
  - `apps/api/src/services/MediaCatalogService.ts` — 新增 `findOrCreateWithMatch`（透出 CatalogMatchStep：imdb_id/tmdb_id/douban_id/bangumi_id/title_triple/created/conflict_recovered；**5 步匹配与绑定语义零变更**，findOrCreate 委托保持 7 处既有消费方零改动）
  - `apps/api/src/services/CrawlerService.ts` — Step 2 切 findOrCreateWithMatch + Step 5 后 fire-and-forget runIngestShadowScoring（沿 F3 容错范式，失败不阻断采集主流程）+ baseLogger.child({module:'ingest-shadow'})
  - `apps/api/src/db/queries/identity-candidate.ts` — `countCompareBucketsBySource`（三桶 GROUP BY trigger_source）+ `listForCompareReport` 可选 triggerSource 过滤（向后兼容）
  - `scripts/identity-compare-report.ts` — trigger_source 切片输出 + `--source=` 抽样过滤
  - `docs/decisions.md` — ADR-105a AMENDMENT 2026-06-03（CHG-VIR-10）：**D-105a-16**（ingest shadow 持久化形态混合 B+C + hook 点 + bind 口径 + fire-and-forget）+ **D-105a-17**（blocking 第二召回键 external_id + blockingKeys 输入域 + 不 bump SCORER_VERSION）；偏离编号扩为 D-105a-1~17
  - `docs/architecture.md` — §5.15 现状同步（Phase 3 落地 / 离线生成双段召回 / ingest 旁路段新增）
  - `tests/unit/api/identity-blocking-recall.test.ts`（新建 6）/ `identity-pair-scoring-persist.test.ts`（新建 4）/ `identity-ingest-shadow.test.ts`（新建 7，含 R9 守护断言全分支仅 SELECT）/ `crawlerIngestShadow.test.ts`（新建 3，接线+容错）/ `identity-offline-rescore.test.ts`（双段改造 +2：ext 召回 + seen 去重）/ `mediaCatalogFindOrCreate.test.ts`（+4 matchedStep 路径）/ `identity-candidate-queries.test.ts`（+3 切片查询）/ crawlerTitleObservation·ingestPolicy·crawlerImageHealthEnqueue·crawler-service-data-guards·crawler-service-es（mock 工厂同步 findOrCreateWithMatch + ingestShadow 正交 mock）
- **新增依赖**：无
- **数据库变更**：无（零 migration——门禁②裁定的召回索引经 pg_indexes 核验全部已存在：media_catalog 四外部 ID 列 partial+unique / idx_video_external_refs_provider_external；零新端点 → verify:endpoint-adr 不触发）
- **注意事项**：① **生产 catalog_id 零变更（R9 + D-105a-12）**——ingest 旁路只写 shadow（identity_candidate + 日志），任何分支不回写 videos.catalog_id / 不触发 merge；自动绑定留 Phase 3 验收后另起 ADR。② blockingKeys 输入域变化 → 既有 pending 中共享 ext id 的 pair 下次重算受控 superseded（dev 实测 24 条，预期行为非回归）。③ ingest 重遇离线已建同 hash pair → noop 不改 trigger_source（trigger_source 语义 = 首建路径）。④ agreement rate 统计走 ingest-shadow 结构化日志聚合（形态 C），报表脚本只读 identity_candidate。⑤ 实施偏离三项（均合理已登记 task-queue 完成备注）：findOrCreateWithMatch 并列方法替代返回值改形 / 零 migration / D 编号 15→16、16→17 校正。⑥ D-N 闭环：**D-105a-16 / D-105a-17 随本卡实施闭环**。⑦ dev 实测：重算 638 桶（617 core + 21 ext）/ 973 pairs / +4 ext 新召回 / 1.25s；ingest 冒烟 31ms candidate-only。

## [CHG-VIR-9-D] merge 默认源翻转 identity + N-video 连通分量折叠（Phase 2c 收尾）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 16:00
- **执行模型**：claude-opus-4-8（建议 sonnet，用户直接以 opus 会话人工覆盖，沿 OBS-BACKFILL/9-C 先例）
- **子代理**：arch-reviewer (claude-opus-4-8 / agentId ad5a4777ebc076355) — 启动门禁 Q1-Q5 裁定（折叠算法与分页语义 / confirm 锚点 / reject 锚点 / 默认翻转 / AMENDMENT 草案）
- **修改文件**：
  - `apps/api/src/services/identity/collapsePairsToGroups.ts` — 新建：pending pair → connected components 页内折叠纯函数（union-find on pair 边 + 路径压缩；clusterKey = 分量成员 video_id 升序 join('|')，与 union 顺序无关幂等；行序 = 各分量最高分 pair 首现序，与折叠前排序语义一致；500 行红线下不入 VideoMergesService）
  - `apps/api/src/services/VideoMergesService.schemas.ts` — `buildGroupFromPair` → `buildGroupFromCluster` 演进（连通分量 → N-video CandidateGroup：pairRowToScore 含 candidateId 锚点 + **复用 `aggregateGroup`〔D-105a-15 min/union〕零重复实现** + score=min over pairs 同保守口径 + N=2 单 pair 保留单数 candidateId 兼容 9-C）；`MergeSchema` 扩 optional `candidateIds[]`（uuid 1-55〔cap=C(11,2) / Codex review FIX 自裁定原值 20 修订〕+ 与 candidateId 互斥 refine + 数组去重 refine）；`ListCandidatesSchema.source` default `'legacy'`→`'identity'`
  - `apps/api/src/services/VideoMergesService.ts` — `listIdentityCandidates` 接 collapsePairs（query/排序/total〔pair 数〕逐字不变）；`merge` candidateId/candidateIds 归一化数组 + 事务前逐个快速失败校验 + 事务内循环挂 K 个 decision(confirmed) 同一 audit_id（任一 from-state 冲突整 merge ROLLBACK / R8）；`unmerge` 循环 revert 全部 confirmed decision；Service 兜底 `?? 'legacy'`→`?? 'identity'`（与 zod default 两处一致翻转）；afterJsonb candidateIds/decisionIds 数组化
  - `apps/api/src/db/queries/identity-decision.ts` — **`findConfirmedDecisionByAuditId`（LIMIT 1）→ `findConfirmedDecisionsByAuditId`（返回全部 + ORDER BY created_at）**：折叠组 merge 一个 audit 挂 K 个 decision（087 partial unique 在 candidate_id 非 audit_id），原单行版 unmerge 漏 revert K-1 个 → R8 回归，裁定为 candidateIds[] 可采纳的硬前提
  - `packages/types/src/video-merge.types.ts` — `CandidateGroup` 加 optional `candidateIds`（candidateId 单数标注 9-D 起多 pair 不填）；`MergeParams` 加 optional `candidateIds`（candidateId 标 @deprecated 保留兼容）
  - `packages/types/src/identity-evidence.types.ts` — `PairScore` 加 optional `candidateId`（折叠后逐 pair 操作锚点；运行期身份字段不进 evidence_hash）
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidatesSection.tsx` — source 默认 `'identity'`（翻转）；handleMerge 透传 candidateIds（回退单数兼容）；handleReject 改收 (candidateId, label) 逐 pair；total 文案 identity 来源「共 N 对候选」区分 pair 数语义；onRejectPair 接线
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidateExpand.tsx` — props 加 onRejectPair 透传 EvidencePanel
  - `apps/server-next/src/app/admin/merge/_client/EvidencePanel.tsx` — EvidencePanelProps 抽出 + 逐对明细行内「拒绝此对」按钮（pair.candidateId 存在时渲染，data-testid=`pair-reject-<id>`）
  - `docs/decisions.md` — ADR-105a AMENDMENT 2026-06-03（CHG-VIR-9-D）：**D-105a-18**（折叠算法 + 分页/锚点语义）+ 端点契约纯增量变更（candidateIds 扩参 / unmerge 反查修复 / default 翻转）+ 遗留 3 项；偏离编号扩为 D-105a-1~18
  - `docs/architecture.md` — §5.15 现状基线 + 决策写路径 ①③ 同步（candidateIds 循环挂载 / unmerge 复数反查 / reject 逐 pair）
  - 测试：`identity-collapse-pairs.test.ts`（新建 6：空入参/N=2 退化/链式传递闭包/多分量行序/迟到边桥接/key 幂等）/ `identity-source-switch.test.ts`（默认翻转改写 + 折叠 2 用例：3 pair 同分量→1 行 + 多分量混合）/ `identity-decision-queries.test.ts`（复数化 + K 行返回 +1）/ `video-merges-confirm-decision.test.ts`（candidateIds 多锚点 + 任一失败快速失败 + K decision 循环 revert，+6）/ `video-merge-candidates.test.ts`（16 处 legacy 路径调用显式 source + schema 默认 identity 断言 +1）/ `video-merges-identity.test.ts`（4 处显式 legacy）/ `MergeCandidatesSection.test.tsx`（默认 identity 改写 + 折叠组 candidateIds/逐 pair 拒绝 8a/8b，+2）
- **新增依赖**：无
- **数据库变更**：无（零 migration 零 DDL——087 partial unique 在 candidate_id 已支持同 audit 多 confirmed；零新端点 → verify:endpoint-adr 不触发）
- **测试**：门禁全过 typecheck / lint / verify:adr-contracts EXIT=0 + 全量 **478 files 6269 passed / 0 failed**（净 +18）。dev 实测：默认 identity 生效（202 pending pair）；100 pair 页内折叠 **49 行**（9 个 N>2 分量；「星辰变」4 视频 C(4,2)=6 pair→1 行）；N=2 单数锚点 40/40 保留；groupKey 两次取数幂等；source=legacy 显式仍可用（toggle 保留）。e2e 无 merge 工作台 spec（9-C 先例一致），回归由 43 组件单测 + dev 实测覆盖。
- **共享层沉淀评估**：collapsePairs 当前消费方仅 VideoMergesService 1 处，但按裁定红线置于 `services/identity/`（与 aggregateGroup/blockingRecall 同层，识别为身份解析领域原语而非 merge 私有逻辑）；EvidencePanelProps 抽出为命名接口（原内联）。
- **注意事项**：① **unmerge 反查修复是本卡正确性核心**——若只做 candidateIds[] 不修反查，K-candidate merge 后 unmerge 永久残留 K-1 个 confirmed decision（R8 回归）；arch-reviewer 裁定列为硬前提。② total 回显维持 pending pair 数（折叠后行数 ≤ total），同分量跨页拆行为已登记分页近似（候选规模显著增长时再评估 cursor 分页）。③ candidateId（单数）deprecate 保留：9-C 深链 `?candidate_id`（DirectMergeWorkspace 单 pair 语义）与既有消费方零变更。④ 翻默认 shadow 稳定性依据已记入 AMENDMENT（OBS-BACKFILL 100% 覆盖 + 198→202 pending + ingest 旁路持续注入）。⑤ VideoMergesService.ts 580→593（+13，注释与循环改写；折叠算法已按红线外置新文件，无新逻辑膨胀）。⑥ 遗留 3 项（AMENDMENT 登记）：部分合并 / 跨页折叠 / 「全部拒绝」按钮。⑦ D-N 闭环：**D-105a-18 随本卡实施闭环**。

### [FIX] CHG-VIR-9-D Codex stop-time review — 折叠组 candidateIds 超 cap + N>11 整组合并不可达
- **记录时间**：2026-06-03
- **执行模型**：claude-opus-4-8
- **发现**：Codex stop-time review——折叠后 identity group 的 candidateIds 可超 MergeSchema cap：merge 集合上限 11 视频（sourceVideoIds max 10 + target）的完全图有 C(11,2)=55 个 pair，裁定原值 cap 20 会把合法 11-video 折叠组 confirm 误拒 422；且折叠后 N>11 组在 UI 真实可达（旧实现每行固定 2 视频不触发），「执行合并」必败于 sourceVideoIds max 10。
- **修复**：① `MergeSchema.candidateIds` max 20→**55**（= C(11,2)，与 sourceVideoIds cap 自洽；types/AMENDMENT/architecture 4 处文档同步）；② `MergeCandidateExpand` 加 `MAX_MERGE_GROUP_VIDEOS=11` 守卫——N>11 折叠组禁用「执行合并」+ `merge-limit-note` 提示分批走逐对明细（逐 pair reject 不受影响）；AMENDMENT 遗留 ④ 登记超大分量分批合并辅助为可选增强。
- **测试**：+2（schema cap 55 通过/56 拒边界 + 前端 8c N=12 禁用断言）。

## [CHG-VIR-11-A] ADR-105 AMENDMENT：Phase 4 拆分证据化定档（split-suggestions 只读建议端点 + 拆到已有 video + unmerge 还原协议修订）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 18:30
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：arch-reviewer (claude-opus-4-8) × 2 轮 — 第 1 轮 agentId a14ab66155c13a55f（CONDITIONAL：R-A1 数据源前提 + R-A2 线路键口径 2 红线 + Y-A1/A2/A3 黄线）/ 第 2 轮 agentId a100cd57de06fca45（PASS-with-conditions：主循环反驳成立 + 修订版 5 点裁定 + 2 硬条件 + 1 advisory-strong）
- **拆卡登记**：CHG-VIR-11（Phase 4）范围 ≥ 6 项跨两条独立线（拆分证据化 / 多语种清洗）→ 按 M-SN-5「PATCH 范围 ≥ 5 项拆子卡」+ CHG-VIR-9 先例拆 **11-A**（本卡 / ADR 定档）/ **11-B**（拆分实施，依赖 11-A）/ **11-C**（多语种清洗：migration + 拼音迁出 + original_language 回填 + aliases[] 迁移，依赖 ADR-175 ✅ 与 A/B 正交）。
- **修改文件**：
  - `docs/decisions.md` — ADR-105 章节：§端点契约表新增 #6 行（`GET /admin/videos/:id/split-suggestions`，先 ADR 登记后实施〔实施 = 11-B〕，verify:endpoint-adr 正序合规）+ 章节末追加 AMENDMENT（2026-06-03）完整小节：**D-105-1**（只读建议端点：**video_sources 线路真源**〔线路键 `(COALESCE(source_site_key, videos.site_key), source_name)` 与 getVideoMatrix 逐字一致〕+ **title_observations site 级聚合 facet 信号**〔事实口径：观测 sourceName 恒 NULL / raw_title = 爬虫 payload 标题；dominant facets 三键确定性排序〕+ 确定性单维分组 core_title_key>season>release_marker>edition + **site 级盲区显式声明**〔同 site 线路必然同组〕+ `intra_site_multi_title` 信号兜底 + line 粒度不丢〔facet 仅决定归组〕+ suggestedMeta 取 dominant raw_title〔core_title 维度组标题唯一来源〕）/ **D-105-2**（SplitSchema groups `targetVideoId` xor `newVideoMeta`：互斥 refine + 三条校验 BEGIN 前 + 0 新建合法 + 同 catalog 不校验 + 不新增 audit 预检 + 向后兼容）/ **D-105-3**（拆到已有 video 冲突预检同 R-105-1 范式 STATE_CONFLICT 409）/ **D-105-4**（snapshot 扩 `created_target_video_ids` + **unmerge 仅软删新建 target**〔旧 audit 兜底全视新建 = 现行为逐值一致〕+ merge-after-split 归属争用链显式点名）/ **D-105-5**（catalog 归属：已有 target 不 findOrCreate + 元数据零变更）/ **D-105-6**（审计扩展 existingTargetVideoIds + UI 消费边界 + candidate 残留沿现状口径）；红线 R-105-S1~S9（含 S7 零 DDL + 零采集写路径变更两断言分立 / S9 线路键逐字一致 + 非空 string 自黄线升格）+ 黄线 Y-105-S1~S5（含 S1 与 ADR-105a 强负 veto 维度对称性 / S4 raw_title 噪声边界）。
  - `docs/tasks.md` / `docs/task-queue.md` — 拆卡登记（13a/13b/13c）+ 11-A 完成备注 + 最后更新时间。
- **评审过程（两轮 + 主循环实读反驳）**：第 1 轮 R-A1 断言「raw_title = 已入库归并后 video 标题、恒等、无分裂输入」→ 主循环实读 `CrawlerService.ts` Step 5（`buildTitleObservation(videoId, video.title, siteKey)` 的 `video` 为 **upsertVideo 入参 payload**）反驳断言②③：误并场景 B 站点观测携带 B 作品真实标题（= 分裂信息来源）；断言①（site 级、无 source_name 维度）成立，落入 D-105-1 事实口径并修正草案「per 线路三元组聚合」事实漂移。第 2 轮确认反驳成立，且修订版（只读侧改聚合口径）较第 1 轮路径 A（改采集写路径）blast radius 更小、core_title 维度语义正确。
- **新增依赖**：无
- **数据库变更**：无（零 migration 零 DDL；`created_target_video_ids` 为 snapshot_jsonb 自由字段；suggestions 实时计算用既有 `idx_title_observations_video`）
- **测试**：纯 docs 无 TS/TSX 改动。门禁：verify:adr-contracts EXIT=0 + verify:endpoint-adr EXIT=0（204 路由对齐，#6 表行先登记）+ typecheck EXIT=0；lint/test 基线不受影响。
- **共享层沉淀评估**：定档卡无代码；D-105-1 响应类型草案指定 11-B 落 `packages/types`（API/UI 双消费）。
- **注意事项**：① **unmerge 还原协议修订（D-105-4）是「拆到已有 video」可采纳的硬前提**——现 unmerge 对 split 撤销软删全部 target_video_ids，不修订会错误软删拆分前已存在的 video。② site 级粒度盲区为 Phase 1b 写入设计的固有信息上界（观测无 source_name 维度），「同 site 内双作品误并」二阶低概率场景以 `intra_site_multi_title` 信号显式提示而非静默归组；不得以补线路粒度为由反向扩采集写路径（R-105-S7，须独立卡）。③ 11-B 实施硬义务：响应类型非空 string（与 LineMatrixRow 一致）+ 线路键一一对应测试断言（Y-105-S5 正确性级）+ D-105-1~6 逐条闭环。④ 已知 follow-up（AMENDMENT 登记）：多维交叉分组 / episode_overlap 阈值 / 拆到已有 video 目标 hint 检索 / raw_title 展示清洗。

## [CHG-VIR-11-B] Phase 4b：拆分自动分组建议 + 拆到已有 video 实施（D-105-1~6 闭环）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 19:30
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：无（规格真源 = ADR-105 AMENDMENT 2026-06-03，CHG-VIR-11-A 已经 arch-reviewer × 2 轮 Accepted，照档实施）
- **修改文件**：
  - `packages/types/src/video-merge.types.ts` — `SplitGroup` 扩展（`newVideoMeta` optional + `targetVideoId` optional，xor 语义注释）+ 新增 `SplitSuggestionDimension`/`SplitSuggestionLine`/`SplitSuggestionGroup`/`SplitSignal`/`SplitSuggestionsResult`（D-105-1 契约；`sourceSiteKey`/`sourceName` **非空 string** = 第 2 轮硬条件 1 / R-105-S9）
  - `apps/api/src/services/identity/splitSuggestions.ts` — **新建**：拆分建议纯函数（确定性单维分组 core_title_key>season>release_marker>edition / dominant facets 三键排序〔observed_count DESC, last_seen_at DESC, raw_title_hash ASC〕/ site 级 facet 继承 + 盲区信号 `intra_site_multi_title`〔coreTitleKey 不同或 dominant < 2× 次行〕/ `external_id_conflict`/`episode_overlap`/`multi_*` 信号 / unassignedLines 禁猜测 R-105-S2 / suggestedMeta = 组内 dominant raw_title + type 继承）
  - `apps/api/src/services/SplitSuggestionsService.ts` — **新建**：瘦编排（404/409 校验与 split 同语义 + 三数据源并行 → 纯函数）；**线路真源直接复用 `getVideoMatrix`**（与拆分工作台同一函数 = R-105-S9 键逐字一致的结构性保证，强于任何对齐测试）
  - `apps/api/src/services/VideoMergesService.split-helpers.ts` — **新建**：`resolveSplitGroups`（targetVideoId 校验 ≠videoId 422 / 存在 404 / 未软删 409 + 冲突预检 409 **全 BEGIN 前**〔D-105a-11 范式〕+ newVideoMeta 组 findOrCreate 自 Service 迁入）——**VideoMergesService.ts 593→599 仅 +6**（超 budget 文件零膨胀策略）
  - `apps/api/src/services/VideoMergesService.ts` — split 事务组分支（`existing` 仅 `assignSourcesToVideo`，不建 catalog/video、不改已有 video 元数据 / D-105-5+R-105-S3）+ audit 回填 created；unmerge split 分支按 `snapshot.created_target_video_ids` 驱动软删（**已有 target 不软删 / R-105-S4**；旧 audit 兜底全视新建 = 旧行为逐值一致）；admin_audit_log afterJsonb 扩 `existingTargetVideoIds`（D-105-6）
  - `apps/api/src/services/VideoMergesService.schemas.ts` — `SplitSchema` groups `newVideoMeta` xor `targetVideoId`（组级 refine）+ 组间 targetVideoId 唯一（顶层 refine）；旧请求体完全兼容；全组 targetVideoId（0 新建）合法（Y-A1）
  - `apps/api/src/db/queries/video-merge-mutations.ts` — 新增 `detectSplitConflictsForTarget`（D-105-3 同 R-105-1 口径：(episode_number, source_url) NULLS NOT DISTINCT，排除转入集合自身）+ `updateAuditTargetIds` 扩可选 `createdTargetVideoIds`（snapshot_jsonb `||` jsonb_build_object 零 DDL / D-105-4）
  - `apps/api/src/db/queries/titleObservations.ts` — 新增只读 `listObservationsByVideoId`（site 级聚合 dominant 排序在 SQL 落定 / idx_title_observations_video）+ 头注释「读写」更新
  - `apps/api/src/db/queries/split-suggestions.ts` — **新建**：`listExternalIdConflictProviders`（media_catalog 外部 ID 列 + video_external_refs 非 rejected 双源 UNION，同 provider >1 distinct id → 冲突 / Y-105a-4 口径）
  - `apps/api/src/routes/admin/video-merges.ts` — 新 route `GET /admin/videos/:id/split-suggestions`（uuid 422 / 404 / 409，错误处理与既有端点同构；契约表 #6 已先行登记 → verify:endpoint-adr 205 路由对齐）
  - `apps/server-next/src/lib/merge/api.ts` — `getSplitSuggestions` client
  - `apps/server-next/src/app/admin/merge/_client/MergeSplitSection.tsx`（279→421）— 「生成拆分建议」按钮（预填 groupCount/groupMetas/assignments，unassigned 留组 1 提示人工复核）+ dimension/signals 提示条（中文信号文案 map）+ 每组「拆到已有 videoId」输入（填后标题/类型禁用 + 「仅转移 sources 不修改其元数据」提示）+ 成功 toast 区分新建/转入
  - 测试：`split-suggestions.test.ts` **新建 20 用例**（四维分组/优先级/unassigned/盲区信号三态/overlap 两态/suggestedMeta 排序两级/线路键集合一一对应〔Y-105-S5 义务〕/幂等/null episode 防御）+ `split-suggestions-service.test.ts` **新建 3 用例**（404/409/编排）+ `video-merge-mutations.test.ts` **净 +16**（混合组 happy path 含 audit 断言 / 全已有 0 新建 / targetVideoId=videoId 422 / 不存在 404 / 软删 409 / 冲突 409 且事务未开启 / unmerge created 驱动 + 旧 audit 兜底 / SplitSchema xor·重复·uuid 6 用例）
- **新增依赖**：无
- **数据库变更**：无（零 migration 零 DDL：suggestions 实时只读用既有索引；created_target_video_ids 为 snapshot_jsonb 自由字段 / R-105-S7 两断言均成立——零 schema DDL + 零采集写路径变更）
- **测试**：门禁全过 typecheck / lint / verify:adr-contracts / verify:endpoint-adr EXIT=0 + 全量 **480 files 6308 passed / 0 failed**（净 +39）。**dev 实测**：① 链路 65.8ms（p95 ≤ 200ms 基线达标）；② 幂等（两次调用 deep equal）；③ 真实数据 suggestible=false 正确路径——video 52a55ac8 的第 2 个 coreTitleKey 挂在 siteKey='' 观测上、无对应 matrix 线路 → 不猜测不归组（R-105-S2 正确行为）；④ shadow 观测表注入往返验证 suggestible=true：双组 core_title_key 分裂 + **三信号全触发**（intra_site_multi_title + multi_core_title + episode_overlap），清理零残留；⑤ `detectSplitConflictsForTarget` 真实 DB 只读验证。
- **共享层沉淀评估**：SplitSuggestion* 契约沉淀 packages/types（API/UI 双消费）；buildSplitSuggestions 纯函数置 services/identity（身份解析领域原语，与 collapsePairsToGroups 同层）；split 组解析抽 helper 文件（超 budget 文件零膨胀范式沿用 9-D 先例）。
- **注意事项**：① **unmerge created 驱动是本卡正确性核心**（R-105-S4）：旧 audit 兜底「全视新建」与现行为逐值一致（显式测试断言 [NEW_VIDEO_ID_1, NEW_VIDEO_ID_2] 全删）。② **已知边界（留痕）**：观测 siteKey=''（CrawlerService `siteKey ?? null` 路径写入）无法对齐 matrix 的 COALESCE 回退键（videos.site_key），其 facet 信息不参与分组——合规（R-105-S2 禁猜测）；若要对齐须改采集写路径 = 独立卡（R-105-S7 第②断言禁止本卡做）。③ 实施期常量（确定性）：OBSERVED_TITLES_TOP_K=3 / DOMINANT_OVERWHELM_RATIO=2（Y-105-S2 同级）/ episode_overlap = 组间区间重叠 ≥1 集。④ UI 预填 unassignedLines 默认组 1 并 toast 提示人工复核（ADR 未规定 UI 细节）。⑤ **D-N 闭环：D-105-1 / D-105-2 / D-105-3 / D-105-4 / D-105-5 / D-105-6 随本卡全部实施闭环**。⑥ e2e 无 merge 工作台 spec（9-C/9-D 先例一致），回归由 39 新单测 + dev 实测覆盖。

## [CHG-VIR-11-C] Phase 4c：多语种清洗 — Migration 089 + title_en 拼音迁出 + original_language 回填（D-175-1/2/5/6 落地）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 20:30
- **执行模型**：claude-opus-4-8（建议 sonnet，沿先例本 opus 会话连续推进人工覆盖）
- **子代理**：无（规格真源 = ADR-175 Accepted，D 条照档实施）
- **修改文件**：
  - `apps/api/src/db/migrations/089_catalog_multilingual.sql` — **新建**：`media_catalog.original_language TEXT NULL`（D-175-1）+ `media_catalog_aliases` 5 列（region/script/kind/confidence/is_primary_for_locale，全 nullable/默认 R7）+ `uq_catalog_aliases_primary_locale` partial unique（D-175-2 草案照落）。**真实 DB 验证三态**：同 locale 重复 primary 阻断 / 简繁 `Hant` 并列 primary 允许（R1 简繁不归一）/ 非 primary 多行允许；事务回滚零残留。
  - `apps/api/src/db/queries/catalogAliases.ts` — **新建**：`upsertStructuredCatalogAlias`（D-175-6 写入口径：ON CONFLICT(catalog_id,alias) 仅 COALESCE 填充缺失维度 + confidence 不降〔双 NULL 保 NULL〕+ **`WHERE source <> 'manual'` 不覆盖人工行**）+ `ALIAS_KINDS` 常量真源（Y-175-3，DB 不加 CHECK）。
  - `apps/api/src/db/queries/mediaCatalog.internal.ts` / `mediaCatalog.mutations.ts` — `DbMediaCatalogRow`/`MediaCatalogRow`/`CatalogUpdateData`/`mapCatalogRow`/CATALOG_SELECT/fieldMap/RETURNING×2 全链路接 `originalLanguage`（D-175-6；safeUpdate 动态字段遍历 → 优先级/软锁/硬锁三重保护自动覆盖新字段，零 Service 层改动）。
  - `apps/api/src/services/PinyinDetector.ts` — 新增 **`isConcatenatedPinyin`**（无空格连写拼音判定：单 token 全小写 + ≥8 字符 + ≥4 音节 + distinctive feature；混合大小写 "moxuMAO" / 含数字 "maoxuewang2026" 元数据噪声不迁）；**音节分解贪心 → DP 修复**（'dierji' 贪心吃 'die' 残留 'rji' 误判不可分解，DP 回溯 di-er-ji；`decomposeSyllableCount` 抽出共用，`canDecomposeAsPinyin` 委托）。isPinyin 既有语义不变（27 fixture 零回归 = 纯 false-negative 修复）。
  - `scripts/catalog-multilingual-cleanup.ts` — **新建**：三步清洗（`--step=pinyin|original-language|aliases-array|all` + 默认 dry-run + `--apply`）。软锁 `locked_fields` + 硬锁 `video_metadata_locks(hard)` 双重尊重；pinyin 步单事务/行（alias 落库 + title_en 置 NULL 乐观幂等 WHERE title_en=原值）；original-language 步确定性保守推断（假名→ja / 谚文→ko / 纯 ASCII 非拼音→en / 汉字按 country 映射〔日本→ja / 大陆→zh-Hans / 港台→zh-Hant〕/ 置信不足留 NULL = Y-175-1）；aliases-array 步数组→表（kind='aka' / 维度 NULL = Y-175-2 不选 primary / 数组列保留只读缓存 D-175-5）。
  - `docs/architecture.md` — §5.1 字段清单加 original_language + aliases[] 降级注记；§5.1a ADR-175 段「规划草案/未落 migration」→「schema 已落地 Migration 089」全段改写（R6）。
  - 测试：`PinyinDetector.test.ts` +12（isConcatenatedPinyin 11 用例：真实污染样例/DP 回溯形态/混合大小写/含数字/长度/音节数/distinctive/空格/不可分解/null + isPinyin DP 回归 1 用例 'Dierji Zhanshi'）。
- **新增依赖**：无
- **数据库变更**：Migration 089（已应用 dev DB + 真实约束验证）。**清洗执行完毕（dev 唯一库）**：pinyin 迁出 **2551/3263**（alias `kind='romanization'` `lang='zh'` `script='Latn'` `source='crawler'` 保存原值 = **迁出可逆**）；original_language 回填 **104/169**（ja=85 / en=14 / zh-Hans=5，置信不足 65 留 NULL）；aliases[] 迁移 no-op（本库数组列空，脚本就绪）；**幂等重跑三步全 0 命中**。
- **测试**：门禁全过 typecheck / lint / verify:adr-contracts EXIT=0 + 全量 **480 files 6320 passed / 0 failed**（净 +12）。
- **共享层沉淀评估**：`upsertStructuredCatalogAlias` 沉淀 query 层（后续富集 Service 写结构化 alias 的唯一入口）；`isConcatenatedPinyin` 入共享 PinyinDetector（与 isPinyin 互补，未来 video 层连写形态可复用）。
- **注意事项**：① **关键实施发现**：catalog `title_en` 实际污染形态 = 无空格连写拼音 slug，`isPinyin`（空格 ≥2 词设计域）系统性 0 命中，且**全列 3263 条无一含空格真英文标题**——`isConcatenatedPinyin` 为 R5 红线-2 的实施期细化（判定对象仍 catalog 层独立，不复用 video 层信号），非语义偏离。② DP 修复使 isPinyin 在「词内贪心歧义」罕见形态命中率提升（方向 = 减少 false-negative；27 既有 fixture 零回归证明影响受控）。③ **保守残留（follow-up）**：712 条 title_en 未迁（含数字 slug 364〔拼音+季号/年份混合形态〕+ 阈值未达 348〔<4 音节或无 distinctive，如 'maoxuewang'/'lingtianwendao'〕），宁漏勿错。④ **primary 选举未执行**（Y-175-2：localized 行 lang/script 维度未全量就绪——当前表中仅 romanization 行带维度；选举留 follow-up）。⑤ 富集 Service（豆瓣/Bangumi/TMDB）写结构化 alias 接线 = ADR-175 follow-up 2（另卡）。⑥ **D-N 闭环：D-175-1 / D-175-2 / D-175-5 / D-175-6 随本卡实施闭环**；D-175-3（display_title fallback 消费方接入）/ D-175-4（alias 匹配分层接 ADR-105a blocking）留 follow-up 卡。

## [CHG-VIR-12-A] Phase 5a：ADR-176/177 实施细则 AMENDMENT — 开放决策点闭合 + CHG-VIR-12 拆卡定档（D-176-7~10 + D-177-11~14）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 21:40
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：arch-reviewer (claude-opus-4-8 / agentId a6fba96b2a1ccb356) — PASS-with-conditions → 2 必修 + 4 建议全吸收
- **修改文件**：
  - `docs/decisions.md` — ADR-176 章节追加 AMENDMENT（2026-06-03 / CHG-VIR-12-A）小节：D-176-7（findOrCreate **不纳入** season_number 匹配——爆量新建分季 catalog 论证〔存量全 NULL 槽位 0 与新输入 season=N 永不命中〕+ 唯一键改造仅解约束阻塞不改归并语义；分季建立路径 = 人工 + Bangumi 按季 subject）/ D-176-8（series_group **不建表**，catalog_relations 连通分量动态派生 + Y-A1 派生锚点契约〔DAG 入度 0 正篇节点，多锚歧义报告不猜测〕）/ D-176-9（season_number 存量**不批量回填** + 系列归位约束运行期语义 + **R-A1 必修：半回填态扫描脚本**〔同三元组簇 season 混存检测，12-C 验收项〕）/ D-176-10（catalog-catalog 合并 = **运维脚本先行**，原语落 Service 层可被未来端点复用，**不起 admin route**〔MUST-8 不触发〕，端点 + UI 待候选量实证后另起 ADR）+ CHG-VIR-12 拆卡结构定档（Y-A2：12-B 标注 4 schema 对象 + 2 强制同步副产物）。
  - `docs/decisions.md` — ADR-177 章节追加 AMENDMENT（2026-06-03 / CHG-VIR-12-A）小节：D-177-11（external_kind 映射细则——bangumi/douban→`subject`〔豆瓣产品形态按季独立分条目 = 精确级，规避 YY-D 不可靠推断〕、imdb/tmdb 方向定档〔存量 0，写入时由富集数据形态判定〕、映射函数 12-D 落常量表）/ D-177-12（迁移细则实化——bangumi 169→exact subject primary、douban 75→**维持 YY-D 保守 candidate**〔实测全局零重复但写入源 auto 富集，candidate 误绑零成本 vs exact 误绑占全局槽位的风险不对称〕、**迁移不动四列 cache 现值**〔过渡期 findOrCreate 逐值零变更〕、**R-A2 必修：一致性校验三口径**〔bangumi 硬校验 / douban 待升级清单 / 孤儿 cache 检出硬校验〕）/ D-177-13（cache UNIQUE 保留 + D-174-3 双写起点 12-D + 单写收敛不在 12 系列〔上卷 job 全量输入天然覆盖回溯〕+ Y-A4 复评显式 follow-up）/ D-177-14（findOrCreate 改读 = **旁路对照先行**〔复用 Phase 3 ingest shadow 范式 fire-and-forget〕，12 系列内不切主读；自动绑定保持 OFF + Y-A3 冲突 candidate 可观测出口〔喂 12-F 候选输入〕）+ 评审记录小节。
  - `docs/task-queue.md` — CHG-VIR-12 → 拆卡执行中 + 12-A 完成备注 + 12-B/C/D/E/F 五子卡按定档登记（依赖链 B→C→D→E，F 依赖 B+D）。
  - `docs/tasks.md` — 12-A 卡片收口入完成堆叠。
- **新增依赖**：无
- **数据库变更**：无（纯 docs 定档；零代码零 migration）
- **测试**：门禁 verify:adr-contracts EXIT=0（D-176-7~10 + D-177-11~14 全部登记 adr-d-status.json / 205 admin 路由对齐）+ typecheck EXIT=0。
- **共享层沉淀评估**：不适用（纯 docs）；定档产物本身即共享契约（12-B~F 五卡的实施真源）。
- **注意事项**：① **dev 事实基线实测**（resovo_dev 唯一库）：media_catalog 3585 行，四列非 NULL imdb=0/tmdb=0/douban=75〔全局零重复〕/bangumi=169（迁移总面仅 244 ref）；video_external_refs 386 行，`is_primary AND manual_confirmed` 仅 **2 行** → R3 保守底线下上卷 exact 初始产出极少、主要产 candidate（D-177-14 对照先行的直接依据）；title_observations season facet 覆盖 303/3617 video（D-176-7 不纳入匹配 + D-176-9 不批量回填的直接依据）。② arch-reviewer 逐 Q 裁定 Q1-Q10 全 PASS（Q3/Q6 携必修条件 R-A1/R-A2，已吸收进 D-176-9/D-177-12 正文）。③ **D-N 闭环口径**：D-176-7~10 / D-177-11~14 为定档条款，随 12-B~F 实施卡逐条闭环（同 ADR-176/177 原 D 条 advisory 口径）。④ 不在 12 系列的显式 follow-up：findOrCreate 切主读、合并端点 + UI ADR、双写→单写收敛 + cache UNIQUE 复评（Y-A4）、自动绑定开启 ADR。

## [CHG-VIR-12-B] Phase 5b：schema migration — season_number 唯一键改造 + catalog_relations + catalog_external_refs（D-176-2/3 + D-177-1/3 落地）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 22:40
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：无（DDL 草案照落，规格真源 = ADR-176/177 + 同日 AMENDMENT 全 Accepted）
- **修改文件**：
  - `apps/api/src/db/migrations/090_catalog_season_relations.sql` — **新建**：① `media_catalog.season_number INT NULL` + `ck_media_catalog_season_number_positive` CHECK>0（哨兵不变量 Y-A，禁放宽 >=0）；② 唯一键改造 `uq_catalog_title_year_type` → `uq_catalog_title_year_type_season`（`(title_normalized, year, type, COALESCE(season_number,0)) WHERE 四外部 ID 全 NULL`；同事务 DROP+CREATE 失败整体回滚保旧索引 + 验证 DO 块含 R2 域内重复预检）；③ `catalog_relations` 表（5 relation CHECK + 自环 CHECK + **same_work_candidate 有序对 CHECK**〔R7 对称规范化的 DB 兜底，migration 086 ck_identity_candidate_ordered 同范式〕+ `UNIQUE(from,to,relation)` + `idx_catalog_relations_to` 反查；from 由 UNIQUE 复合前缀覆盖不另建）。反对称四 relation 单向 + season_of/edition_of DAG 为跨行不变量留应用层守卫（12-F 首个写入卡，migration 头注释显式留痕）。
  - `apps/api/src/db/migrations/091_catalog_external_refs.sql` — **新建**：`catalog_external_refs` 表（D-177-1 草案照落：provider/external_id TEXT 统一/external_kind/relation default candidate/season_number CHECK>0/confidence/source/is_primary/linked_by/**rollup_rule**〔YY-B 上卷溯源〕/linked_at/notes/updated_at）+ D-177-3 约束分级（`uq_catalog_external_refs_exact` 全局唯一 WHERE relation='exact' / `uq_catalog_external_refs_catalog_relation` 同 catalog 去重含 COALESCE 0 哨兵〔R9 与 ADR-176 统一〕WHERE IN ('exact','parent')——candidate/rejected 不进任一 unique = R2 审计历史结构性保留）+ `idx_catalog_external_refs_catalog`（上卷输入/合并重指向/cache 校验）+ `idx_catalog_external_refs_provider_ext`（findOrCreate 改读/RR-A 预检）。
  - `apps/api/src/db/queries/mediaCatalog.internal.ts` — seasonNumber 接线 5 处：`DbMediaCatalogRow.season_number` / `MediaCatalogRow.seasonNumber` / `CatalogUpdateData.seasonNumber?`（D-176-6 safeUpdate 口径；**CatalogInsertData 不扩** = D-176-7 findOrCreate 不纳入 season 的结构性表达）/ `mapCatalogRow` / `CATALOG_SELECT`。
  - `apps/api/src/db/queries/mediaCatalog.mutations.ts` — fieldMap `seasonNumber: 'season_number'` + RETURNING ×2（insertCatalog/updateCatalogFields）。
  - `docs/architecture.md` — §5.1（字段清单加 CHG-VIR-12-B 小节）+ §5.1a（ADR-176 段「规划草案/未落 migration」→「schema 已落地 Migration 090」全段改写：唯一键已执行 + catalog_relations 落地细节 + D-176-7~9 AMENDMENT 口径〔不纳入匹配/不建 series_group/不批量回填〕+ 删行回滚实施归 12-F）+ §5.6（ADR-177 段→「已落地 Migration 091」改写：表当前空 + 数据迁移 12-C/写路径 12-D/对照 12-E 节奏 + D-177-11 provider 映射注记）（R5）。
- **新增依赖**：无
- **数据库变更**：Migration 090 + 091（已应用 dev DB）。**真实 DB 约束验证 16 项全过**（事务注入 + ROLLBACK 零残留）：
  - 090 九项：V1 season=0 CHECK 阻断 / V2R 同三元组 NULL 双行阻断（**槽位 0 逐值等价旧键证明**）/ V3R season=2 与 NULL 共存（**「无外部 ID 分季」阻塞解除证明**）/ V4R 同季双行阻断 / V5 自环 CHECK / V6 swc 反序 CHECK 阻断 / V7 swc 正序通过 / V8 重复边 UNIQUE / V9 带外部 ID 行不受三元组约束（WHERE 域保留）。
  - 091 七项：W1 exact 全局唯一（索引①）/ W2 parent 一对多共存（不撞①）/ W3 同 catalog 重复 parent 阻断（索引②）/ W4 candidate×2 + rejected 同键共存（R2）/ W5 season 哨兵槽位去重 / W6 season=0 CHECK（R9）/ W7 非法 provider CHECK。
- **测试**：门禁全过 typecheck / lint EXIT=0 + 全量 480 files **6319 passed / 1 failed**——唯一失败 `data-table-auto-filter.test.tsx #6c`（jsdom timing flaky，隔离重跑 24/24 全过；admin-ui DataTable 域与本卡 schema/queries 改动完全无关）+ verify:adr-contracts EXIT=0（sql-schema 对齐 **58→60 表**〔两新表识别〕/ 205 admin 路由）。
- **共享层沉淀评估**：不适用（schema + 类型接线）；migration 约束注释与索引 4 步核验为后续 12-C~F 消费真源。
- **注意事项**：① **未拆 12-B-1/B-2**（Y-A2 开口）：R7 反对称/DAG 与 R10 互斥均为跨行不变量、属写路径职责（12-D 写原语 / 12-F 关系写入），12-B 仅落 DB 可表达约束——swc 有序对 CHECK 是唯一可下沉 DB 的部分（已落），无守卫工作量堆积，不触发拆卡。② 两表当前**零数据零写入方**：091 表空（迁移 = 12-C）、catalog_relations 空（写入 = 12-F/上卷 job）；本卡纯 schema，生产行为零变更。③ year NULL 行在唯一键中 NULLS DISTINCT（PG 默认）——与旧索引行为一致，非本卡引入（V2/V4 首轮测试用例缺 year 暴露该既有语义，补 year 重测通过）。④ **D-N 闭环：D-176-2（列+唯一键）/ D-176-3（关系表 schema 部分）/ D-177-1 / D-177-3 随本卡实施闭环**；D-176-6 类型扩展部分落地（写入消费方接线留富集/manual 路径卡）。

## [CHG-VIR-12-C] Phase 5c：既有数据迁移 — 四列回填 catalog_external_refs + 一致性三口径 + 半回填态扫描（D-177-10/12 + D-176-9 守卫落地，回填执行完毕）
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 23:20
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：无（规格真源 = ADR-177 AMENDMENT D-177-12 + ADR-176 AMENDMENT D-176-9 R-A1/R-A2，照档实施）
- **修改文件**：
  - `scripts/catalog-external-refs-backfill.ts` — **新建**：四列现值回填映射表。`MIGRATE_SPECS` 分级真源（D-177-12：bangumi→`exact subject is_primary` / douban→`candidate subject`〔YY-D 保守维持〕）+ **imdb/tmdb 仅报告不迁移**（external_kind 事后推断不可靠，非 0 显式告警交富集实装卡写入时判定，不猜测）+ `source` 按 locked_fields CASE 取 manual/auto（D-177-10）+ `rollup_rule='cache-column-backfill-12c'` 溯源（YY-B）+ 幂等 `WHERE NOT EXISTS`（candidate 不进 partial unique 不能依赖 ON CONFLICT，统一口径）+ apply 单事务整批回滚 + 默认 dry-run。**纯 INSERT 零触碰四列 cache**（D-177-12「过渡期 findOrCreate 读 cache 逐值零变更」）。
  - `scripts/report-catalog-identity-consistency.ts` — **新建**：只读一致性报表。Section 1 = R-A2 三口径全 4 provider 通用（HARD-1a「exact primary ref 但 cache NULL/不一致」/ HARD-1b「cache 与 exact ref 值漂移」/ REPORT-2「cache 仅 candidate 待升级清单」/ HARD-3「孤儿 cache：映射表完全无 ref」）；Section 2 = R-A1 半回填态扫描（簇键 `(title_normalized, type)` **不含 year**〔同系列各季 year 常不同〕+ year/S 明细 string_agg 供人工判读 + 翻拍同名 false positive 显式声明）。HARD>0 → EXIT 1（可接 CI / 12-F 合并前置检查）。
- **新增依赖**：无
- **数据库变更**：零 schema 变更。**回填执行完毕（dev 唯一库）**：244 行入 `catalog_external_refs`（bangumi 169 exact + douban 75 candidate）；cache 列计数零变更（bangumi 169 / douban 75 逐值不动）；幂等重跑全 0 命中。
- **测试**：门禁全过 lint EXIT=0 + typecheck EXIT=0 + 全量 480 files **6320 passed / 0 failed**（12-B 轮 data-table-auto-filter flaky 本轮亦过 = flaky 终确认）。**真实 DB 验证**：① dry-run 计数与 12-A 事实基线逐值一致（169/75/0/0）；② 报表迁移后全绿（HARD=0 / REPORT-2 douban=75 预期 / 半回填簇=0）；③ **负向注入三类全检出**——孤儿 cache（HARD-3=1）+ exact 漂移（HARD-1a/1b 双向各 1）+ 半回填簇（=1 含 2025/S- 2026/S2 明细）→ EXIT 1 分支触发 → 清理 DELETE 4 CASCADE 零残留（refs 回 244）→ 报表回绿。
- **共享层沉淀评估**：报表三口径 SQL 与回填 SPECS 为 12-D（写原语 cache 同步）/ 12-E（上卷 job）/ 12-F（合并 cache 重算）的口径真源；上卷 job 落地后报表可扩 rollup 切片（接口预留 = provider 通用循环）。
- **注意事项**：① **实施期细化（合理偏离声明）**：D-177-12 对 imdb/tmdb 说「no-op（脚本支持但空跑）」——实现为「仅报告不迁移」：若未来 cache 非 0，脚本显式告警而非按猜测 kind 迁移（YY-D 保守精神的强化，非语义偏离）。② douban 75 待升级 = REPORT-2 预期形态（升 exact 路径 = 12-E 上卷 manual_confirmed 一致 / 人工确认），报表区分确保不误报。③ 半回填态扫描当前 0 = 存量全 NULL 的预期态；该脚本为 D-176-9 系列归位约束的长期结构化守卫（建立首个分季 catalog 后须重跑）。④ **D-N 闭环：D-177-10（迁移）/ D-177-12（细则三口径 R-A2）/ D-176-9（R-A1 扫描脚本交付）随本卡实施闭环**；REPORT-2 清单消解与上卷升级 = 12-E。

## [CHG-VIR-12-D] Phase 5d：catalog_external_refs 写侧原语 — exact+cache 同事务（YY-C）+ R10 守卫 + D-174-3 双写起点
- **完成时间**：2026-06-03
- **记录时间**：2026-06-03 23:59
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：无（规格真源 = ADR-177 + AMENDMENT D-177-11/13 全 Accepted，照档实施）
- **修改文件**：
  - `apps/api/src/db/queries/catalogExternalRefs.ts` — **新建**：写侧原语单一真源。`EXTERNAL_KIND_BY_PROVIDER`（D-177-11：bangumi/douban→'subject'；imdb/tmdb 不提供默认 = 写入时按富集数据形态判定，防误用）+ `PRECISE_KINDS`（R10 取值域）+ `resolveAndWriteExactRef`（show kind→throw / R10 kind 全局一致守卫→kind_conflict / 索引① **预检主导** RR-A：命中自身→already_exact、命中他者→降级 candidate〔D-177-4 exact 冲突=catalog 归并信号，不靠唯一索引报错兜底 R3〕/ INSERT ON CONFLICT DO NOTHING 仅并发保险，rowCount=0 重查收敛）+ `insertCandidateRef`（幂等 NOT EXISTS——candidate 不进 partial unique 不能 ON CONFLICT，与 12-C 回填同口径）+ `demoteExactRef`（D-177-5 反向：清 cache 联动 exact→candidate，UPDATE 留审计不 DELETE）。事务边界由调用方保证（不开事务）。
  - `apps/api/src/services/MediaCatalogService.ts` — **safeUpdate 单点接线**（架构洞察：运行时四列写入面 doubanId×6 处 + bangumiSubjectId×1 处**全部收敛过 safeUpdate** → 单点接线，DoubanService/MetadataEnrichService/VideoService 等消费方零改造）：`CATALOG_EXTERNAL_REF_FIELDS` 映射 + filteredFields 命中外部 ID 字段时——外部 client（事务内调用）复用 / 无则**自起 BEGIN/COMMIT**（YY-C「exact ref 与 cache 回填同事务」；未命中不起事务，主路径行为逐值不变）+ conflict_candidate/kind_conflict 字段**剔除不写 cache**（槽位属 holder）计入 skippedFields + null 清空联动 demoteExactRef + manual 锁字段以剔除后最终字段集为准（修锁未写入字段的潜在错位）+ provenance 收尾抽 `finishSafeUpdate` 私有方法。
  - `apps/api/src/services/BangumiService.ts` — `applyEnrichmentDb` D-174-3 conflict 分支**双写起点**（D-177-7/D-177-13）：同事务写 catalog 级 candidate（Y-177-1 conflict 分支 → catalog_id=当前入参 catalog / linkedBy='bangumi-enrich-conflict'）；redirect 分支不写（D-177-7「video 已归 existing，existing 已 canonical」）；video 级 candidate 降级路径零改（R7）。safe/redirect 分支的 exact ref 由 safeUpdate 接线自动覆盖（bangumiSubjectId 经 data.fields 传入，外部事务 client 内同事务）。
  - 测试：`tests/unit/api/catalog-external-refs-queries.test.ts` **新建 13 用例**（映射真源 2 / resolveAndWriteExactRef 7〔throw/kind_conflict/already_exact/conflict_candidate/exact_written 含参数断言/并发降级/并发自身收敛〕/ insertCandidateRef 幂等 2 / demoteExactRef 2）+ `mediaCatalogSafeUpdate.test.ts` **+8 接线用例**（同事务 BEGIN/COMMIT+YY-C / manual source / conflict 剔除不写 cache / 全剔除不调 update / null demote / 外部 client 不自起 BEGIN / 无外部 ID 零变化 / 抛错 ROLLBACK+release）+ `bangumi-service.test.ts` conflict case 双写断言 + `douban.test.ts` mock 适配（db.connect + 写原语 mock）。
- **新增依赖**：无
- **数据库变更**：无 schema 变更。**dev 实测三分支**（真实 DB 链路）：① A 写 doubanId → exact ref（primary/manual/'safe-update:manual'）+ cache 同事务写入；② B 写同 doubanId → skippedFields=['doubanId'] + candidate ref + **B cache 未写**（NULL）；③ A 清空 → exact 降级 candidate（notes='demoted: cache cleared'）+ cache NULL。清理 CASCADE 零残留 + 报表 HARD=0 回绿。
- **测试**：门禁全过 typecheck / lint EXIT=0 + 全量 **481 files 6341 passed / 0 failed**（净 +21）+ verify:adr-contracts EXIT=0（60 表 / 205 路由）。
- **共享层沉淀评估**：写原语沉淀 query 层单一真源——12-E 上卷 job 升级 douban candidate→exact、12-F 合并重指向预检（RR-A 同范式复用 resolveAndWriteExactRef 预检段）、未来富集实装卡（imdb/tmdb）均消费本原语；EXTERNAL_KIND_BY_PROVIDER 为 provider 映射唯一真源。
- **注意事项**：① **douban 写路径行为变更（按契约）**：此前两 catalog 可同 douban_id cache（列无 UNIQUE）；接线后第二写入者经索引① 预检降级 candidate 且**不写 cache**——「exact 全局唯一」契约的正确执行（D-177-4），也是 ADR-177 follow-up 5（douban 同类约束对称）在 catalog 层的自然实现。bangumi 路径因 resolveBangumiBinding 预检在前，本接线为残余防御（RR-A 精神）零行为变更。② R10 kind 一致守卫为应用层 best-effort（并发窗口双写不同 kind 理论可能）；报表/上卷为第二道检出，跨行 trigger 留后续评估（AMENDMENT 既定开口）。③ **流程备注**：本卡未先写 tasks.md 进行中卡片即开始实施（违 workflow-rules，已在 task-queue 完成备注补记留痕），收口流程正常。④ **D-N 闭环：D-177-5（写路径侧 cache 同事务+降级清缓存）/ D-177-11（映射常量落地）/ D-177-13（双写起点）随本卡实施闭环**；D-177-7 双写目标态（收敛单写）留收敛卡。

## [CHG-VIR-12-E] Phase 5e：上卷 job + findOrCreate 旁路对照 + 冲突 candidate 可观测出口（D-177-4 + D-177-14 + Y-A3 落地，上卷执行完毕）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 02:40
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：无（规格真源 = ADR-177 D-177-4 + AMENDMENT D-177-14/Y-A3，照档实施）
- **修改文件**：
  - `apps/api/src/services/identity/externalRefRollup.ts` — **新建**：D-177-4 四行规则表纯函数 `rollupCatalogProviderRefs`（confirmedIds=1 且 auto 无异议 → exact 'confirmed-consensus'〔**R3 唯一 exact 通道**〕/ 仅 auto 一致 → candidate 'auto-consensus' / confirmed 互斥・confirmed×auto 异值・auto 互斥 → 全 candidate 'conflict'；产出确定性升序、输入序无关幂等）。
  - `scripts/catalog-rollup-external-refs.ts` — **新建**：上卷编排（手动触发对齐 CHG-VIR-8 先例 / Y-177-4 自动绑定 OFF）。输入 = video 级 primary 观测（is_primary AND status∈confirmed/auto，JOIN videos 未删）按 (catalog, provider) 分组；bangumi/douban subject 级先行（imdb/tmdb show/parent 留富集实装卡 / R6）。**exact 产出双路径**：cache 已同值 → 仅升 ref 直走 `resolveAndWriteExactRef`（零元数据变更不需源优先级许可——manual 元数据所有权 catalog 不被误伤）；cache 需变更 → 经 safeUpdate 复用 12-D 接线（锁/源优先级尊重 + 跨 catalog exact 冲突自动降级，被阻登记 skipped 交人工）+ rollup_rule 溯源补写（YY-B）。candidate 产出 → insertCandidateRef（rollup_rule 直传）。dry-run 默认且与 apply **同幂等口径预查**（计数一致）。
  - `apps/api/src/services/MediaCatalogService.ts` — `findOrCreateWithMatch` 外壳化（原体改 `findOrCreateWithMatchInternal`，单点覆盖全部 return 路径）+ 新增 `shadowCompareRefLookup`（D-177-14：读路径保持 cache 四列逐值不变；COMMIT 后 fire-and-forget 对照映射表 exact；**四 outcome**：`match`〔切主读零分歧〕/ `cache_hit_ref_miss`〔douban candidate 待升级=预期形态〕/ `cache_hit_ref_mismatch`〔异常须处置〕/ `cache_miss_ref_hit`〔切主读行为变化点〕；pino `stage='catalog-ref-shadow'` 结构化日志对齐 ingest-shadow 范式，容错 catch 不影响主流程）。
  - `apps/api/src/db/queries/catalogExternalRefs.ts` — `ExternalRefWriteInput` 扩 optional `rollupRule`（YY-B 一次写入）+ `insertCandidateRef` NOT EXISTS 扩 `relation IN ('candidate','exact')`（自身已 exact 不插噪声 candidate；rejected 不阻插保复活语义）。
  - `scripts/report-catalog-identity-consistency.ts` — +Section 3 冲突 candidate 簇（Y-A3：同 (provider, external_id) 跨多 catalog 共享 candidate 聚合 + rollup_rule/titles 明细 = same_work 合并候选信号，12-F 输入）+ 汇总行。
  - 测试：`tests/unit/api/external-ref-rollup.test.ts` **新建 9 用例**（四行规则表全分支 + R3 保守底线〔confirmed×auto 异值不自动 exact〕+ 确定性/幂等）+ `catalog-external-refs-queries.test.ts` 参数断言同步（rollupRule + NOT EXISTS 扩展）。
- **新增依赖**：无
- **数据库变更**：无 schema 变更。**上卷执行完毕（dev 唯一库）**：douban confirmed-consensus 2 例——「冰湖重生」（cache 同值）升 exact ✓ = **REPORT-2 待升级 75→74，上卷升级通道首例闭环**；「大猩猩的故事」（cache NULL + metadata_source=manual 源优先级）skipped 保守交人工 ✓。candidate 新增 12（video catalog 归属与 12-C cache 回填不一致 = 真实新信号）+ already 223 幂等跳过。**apply 复跑全幂等 0**。报表 HARD=0 / 半回填 0 / 冲突簇 0 全绿。
- **测试**：门禁全过 typecheck / lint EXIT=0 + 全量 **482 files 6350 passed / 0 failed**（净 +9）。**dev 实测 shadow 对照**：bangumi exact 命中 → `outcome='match'`（refCatalogId 一致）+ douban candidate 形态 → `outcome='cache_hit_ref_miss'`（refCatalogId=null），结构化日志逐字段验证。
- **共享层沉淀评估**：rollup 规则表纯函数置 services/identity（与 scorePair/splitSuggestions 同层）；shadow 对照单点挂 findOrCreateWithMatch 外壳（7 处既有消费方自动覆盖零改动）；冲突簇报表与一致性报表合一运维入口。
- **注意事项**：① **切主读（D-177-6）前置观察就绪**：对照日志（grep `catalog-ref-shadow`，重点 `cache_hit_ref_mismatch`/`cache_miss_ref_hit`）+ 报表 HARD 口径；零分歧观察期后另起切主读小卡（12-A 既定不在 12 系列）。② 上卷 exact 双路径的「cache 同值仅升 ref」是实施期细化：safeUpdate 源优先级保护的是**元数据**，ref 升级零元数据变更不应受其约束（被阻案例「冰湖重生」实证）；cache 需变更场景仍全套约束（「大猩猩」实证保守正确）。③ conflict 簇当前 0 = dev 数据无跨 video 异值 primary；簇报表为 12-F same_work 候选的长期信号出口。④ **D-N 闭环：D-177-4（上卷规则 + 溯源）/ D-177-14（旁路对照 + 自动绑定维持 OFF）随本卡实施闭环**；Y-A3 出口交付。

## [CHG-VIR-12-F] Phase 5f：catalog-catalog 合并 — Migration 092 快照表集 + CatalogMergeService + 往返实测（D-176-4/10 + D-177-9 落地 / CHG-VIR-12 全系列收口）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 04:50
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：无（规格真源 = ADR-176 D-176-4/R-2 + ADR-177 D-177-9/RR-A + AMENDMENT D-176-10 全 Accepted，严格继承 084/dedup-catalog-084.ts 合并范式）
- **修改文件**：
  - `apps/api/src/db/migrations/092_catalog_merge_snapshots.sql` — **新建（DDL only 零 DML / 084 范式）**：11 张快照表 = 084 同构 9 张（`_bak_media_catalog_092`〔LIKE 不含约束 + merge_op_id/snapshot_at〕+ episodes/characters/孙表 actors/provenance/locks/aliases + `_bak_videos_catalog_id_092` 指向表）+ **新增** `_bak_catalog_relations_092` / `_bak_catalog_external_refs_092`（ADR-176/177 新 CASCADE 子表，084 时不存在）+ `_bak_catalog_merge_ops_092` 注册表（loser/survivor + **survivor 四列 cache 合并前 jsonb 快照** = D-177-9 cache 重算的回滚复位源 + rolled_back_at 防重复回滚）。
  - `apps/api/src/services/CatalogMergeService.ts` — **新建（合并/回滚原语，D-176-10 落 Service 层供未来端点零重写复用）**：`merge` 单事务十步——R10 前向守卫（快照表 11/11 否则阻断）→ 注册 op → 全字段快照（relations/refs 快照**双方端点命中行**保完整复位面）→ videos 重指向 → provenance/locks 碰撞删 + 转移 → 内容子表转移（084 IS NOT DISTINCT FROM 碰撞范式）→ **relations 端点重指向**（R-2：loser↔survivor 自环边删〔快照留痕〕+ 重指向后撞 UNIQUE 删 + `same_work_candidate` 重指向后 LEAST/GREATEST 规范化保有序对 CHECK）→ **refs 重指向**（RR-A：exact 按索引① `(provider,external_id,external_kind)` **预检主导**——survivor 已持同精确 exact → 丢弃 loser 行进快照不 UPDATE〔catalog 合并即外部身份归并〕；撞索引② 删；转移 exact 遇 survivor 同 provider 已有 exact → `is_primary=false` 保主绑定唯一）→ 删 loser → **cache 保守重算**（D-177-9：仅 survivor 该 provider 列 NULL 且获得 is_primary exact 才回填，已有值不覆盖）→ dangling 断言（8 表清零否则整事务回滚）。`rollback`——loser **原值复活无需 084 sentinel**（092 零键覆盖问题：合并前共存 → 恢复必不撞唯一键；ON CONFLICT(id) 仅兜重复）+ PK(id) 子表 DELETE by 快照 id + INSERT 全量精确还原（relations/refs 同范式：被 UPDATE 行复原值 / 被 DELETE 行 INSERT 回——**行 id 保留消除 disposition 列需求**）+ provenance/locks **只插不删（R11）** + 疑似转移残留 REPORT 交人工 + videos/cache 按快照复位 + rolled_back_at 防重复回滚。
  - `scripts/catalog-merge.ts` — **新建**：合并编排（--loser/--survivor/--by；前置信息人工核对面；**dry-run = mergeInTx 完整路径预演 + ROLLBACK 零落库**；--apply 输出回滚口令）。**不起 admin 端点**（MUST-8 不触发；端点 + UI 待候选量实证后另起 ADR）。
  - `scripts/catalog-merge-rollback.ts` — **新建**：回滚编排（无参列出近 20 merge op / --op 预览快照行数 / --apply 执行 + R11 残留警示 + 建议跑一致性报表）。
  - `tests/unit/api/catalog-merge-service.test.ts` — **新建 5 用例**（loser=survivor 拒绝〔不连接 DB〕/ R10 快照表缺失阻断 + ROLLBACK / 行缺失 1/2 阻断 / op 不存在 / 重复回滚阻断〔防双重复活〕）。
- **新增依赖**：无
- **数据库变更**：Migration 092（已应用 dev DB；DDL only 零 DML，11 张快照表全空就绪）。
- **测试**：门禁全过 typecheck / lint / verify:adr-contracts EXIT=0 + 全量 **483 files 6355 passed / 0 failed**（净 +5）。**dev 完整往返实测**（A=loser 富内容 + B=survivor + C=第三方）：merge 统计逐项断言——videosRedirected=1 / 自环 swc 删 1 / A→C `season_of` 重指向 B→C / douban 同值 candidate 去重 1（7b）/ bangumi exact 转移（7c）+ **B cache 回填 919191**（步骤 9）/ episodes 转移 / loser 删 + dangling=0；rollback 全复原——A 复活（原值无 sentinel）+ videos 指向复位 A + episodes 回 A + B→C 边消失（A→C 复原）+ swc 复原 + B exact 消失 + **B cache 复位 null**；重复回滚阻断 ✓；provenance 残留 REPORT=1（R11「只插不删」预期行为：B 侧转移副本留存 + A 侧恢复）；测试数据零残留（实测「残留 2」为 dev 真实作品《往返80致富我醉卧美人膝》LIKE 误匹配，已逐行核实非残留）。
- **共享层沉淀评估**：合并/回滚原语落 Service 层 = D-176-10 既定（未来 admin 端点 / same_work_candidate 裁定 UI 零重写消费）；快照表集 + merge_ops 注册表为合并审计真源；dry-run「真实路径预演 + ROLLBACK」范式可复用于后续高风险运维脚本。
- **注意事项**：① **回滚是数据安全网非字节级无损**（D-174-6 继承）：provenance/locks 转移副本残留 = 已知不可逆损失（REPORT 不删）；合并后运行期新写入可能被 cache 复位覆盖（脚本头注释运维窗口警示）。② swc 重指向 LEAST/GREATEST 规范化是实施期必要细化（重指向后 from>to 会违 090 有序对 CHECK，ADR 未显式预见，落实 R7 语义零偏离）。③ 转移 exact 的 is_primary 降级（survivor 已有同 provider exact 时）保「主绑定唯一」语义——cache 槽位属 survivor 原 exact，与 D-177-5 一致。④ **D-N 闭环：D-176-4（快照范式 + R-2 重指向 + 回滚复位）/ D-176-10（脚本先行不起端点）/ D-177-9（RR-A 预检 + cache 重算 + 回滚边界）随本卡实施闭环**。⑤ **CHG-VIR-12 全系列（12-A~12-F 六卡）收口，Phase 5 catalog 身份层完结**；后续独立小卡（12-A 既定不在系列内）：findOrCreate 切主读（对照观察期）/ 合并端点 + UI ADR / 双写收敛 + cache UNIQUE 复评（Y-A4）/ 自动绑定 ADR。

## [CHG-VIR-12-FIX] Codex stop-time review FIX：exact-ref ↔ cache 一致性两处可破坏路径修复
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 05:40
- **执行模型**：claude-opus-4-8
- **子代理**：无（Codex stop-time review 发现，主循环复盘定位 + 修复）
- **修改文件**：
  - `apps/api/src/db/queries/catalogExternalRefs.ts` — `demoteExactRef` 扩 optional `exceptExternalId`（换值场景：demote 同 catalog+provider 下其他 external_id 的旧 exact，新值保留；notes 区分 'cache cleared' / 'cache value replaced'）。
  - `apps/api/src/services/MediaCatalogService.ts` — **FIX-1（safeUpdate 换值双 exact）**：写新值 exact 落定（exact_written/already_exact）后，同事务 `demoteExactRef(client, catalogId, provider, 新值)` 降级旧值 exact。复现：A 先写 doubanId='111' 再写 '222' → 双 exact is_primary + cache='222' → 旧 exact('111') 触发报表 HARD-1a。conflict_candidate 分支不 demote（cache 未变，旧 exact 仍一致）。
  - `apps/api/src/services/CatalogMergeService.ts` — **FIX-2（合并转移 exact 遇 survivor cache 异值）**：7c 前新增 7c-pre——survivor 同 provider cache 列非 NULL 且 ≠ loser exact 值 → loser exact 降级 candidate（cache 异值即身份冲突信号，对齐 D-177-4「冲突只产 candidate」；快照已留原值可复位）+ 降级后同值 candidate 补一轮 7b 口径去重。复现：survivor cache='D1'（candidate 形态）+ loser exact('D2') 转移 → exact('D2') 与 cache='D1' 触发 HARD-1b。
  - 测试：`catalog-external-refs-queries.test.ts` +1（exceptExternalId 分支 + 参数断言同步）/ `mediaCatalogSafeUpdate.test.ts` +2（换值 demote 调用 / conflict 不 demote）。
- **数据库变更**：无 schema 变更。**dev 复现 + 修复双验证**：FIX-1 换值后 refs = [candidate('111'), exact('222')] + cache='222' 一致 ✓；FIX-2 合并后 survivor refs = [candidate('D1'), candidate('D2')] + cache='D1' 一致（异值降级归并信号）✓；报表 HARD=0 全绿。
- **测试**：门禁全过 typecheck / lint EXIT=0 + 全量 **483 files 6358 passed / 0 failed**（净 +3）。
- **注意事项**：两修复均为「cache 单值语义 ↔ exact 多行真源」的边界协调：cache 槽位变更（换值/合并异值）必须同事务收敛旧 exact（降级 candidate 保审计，绝不 DELETE）；与 D-177-5「写 exact 同步回填 / 删降级清 cache」契约的双向完整化。归属 D-177-5 / D-177-9 闭环补强。

## [CHG-VSR-LASTCHECKED-FILTER-ALIGN] 播放线路「最近检测」列筛选与显示值口径对齐（Codex review P2）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 21:25
- **执行模型**：claude-opus-4-8（建议 sonnet，用户以 opus 会话人工覆盖指派）
- **子代理**：无（口径真源 = ADR-117 AMENDMENT 3 D-117-VSR3-1 已 Accepted，无新架构决策）
- **修改文件**：
  - `apps/api/src/db/queries/sources-matrix.ts` — `lastCheckedFrom/To` 两条 HAVING 谓词由裸 `MAX(vs.last_probed_at)` 改 `COALESCE(MAX(vs.last_probed_at), MAX(vs.updated_at))`，对齐显示列 `last_checked_at` 口径（D-117-VSR3-1 锚定真源；count/data SQL 复用同一 havingClauses 数组 → 单点修复双查询同步生效）；**沉淀** `LAST_CHECKED_EXPR` module-level 常量（QUALITY_RANK_EXPR「单一 SQL 常量禁散落」同范式），显示列 / 排序列 / 2 filter 谓词 4 处共用根治口径漂移（本 bug 根因即口径散落两处漂移；常量化后 SQL 产出逐字节不变）。
  - `tests/unit/api/sources-matrix.test.ts` — 既有 lastChecked filter 用例改断 COALESCE 口径 + 负向 regex 守卫（裸 `MAX(vs.last_probed_at)` 比较谓词不得回归）；新增「data SQL 与 count SQL 同 HAVING + 显示列口径未漂移」断言用例。
- **新增依赖**：无
- **数据库变更**：无（零 migration 零端点；verify:endpoint-adr 不触发）
- **测试**：门禁全过 typecheck / lint / verify:adr-contracts EXIT=0 + 全量 **483 files 6359 passed / 0 failed**（净 +1）。**dev 真实 DB 决定性验证**：影响面 = 3498 个有源但零 probe 记录的视频（旧谓词下被任何日期筛选排除，可见日期来自 updated_at 回退）；全日期范围（2026-04-22~2026-06-03）旧谓词命中 108 vs 新谓词 **3606 = 显示口径预期值逐值相等**（零多算零漏算）。
- **注意事项**：① 修复纯增量：有 probe 记录的行 COALESCE 取第一参数退化为旧谓词 → 旧命中集是新命中集真子集，零回归。② 显示侧为 ADR 真源不动（卡面二选一取方案一）。③ 与 `updatedAtFrom/To` filter（裸 `MAX(vs.updated_at)`）语义有别属预期：updatedAt 列显示值即 `MAX(vs.updated_at)` 无回退，两 filter 各自与各自显示列一致。

## [CHORE-TEST-CRAWLER-TZ-FLAKY] CrawlerClient 时间轴用例 51 时区无关加固（CHORE-TEST-BASELINE-20260529 残留项闭档）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 21:35
- **执行模型**：claude-opus-4-8（建议 haiku，用户以 opus 会话人工覆盖指派）
- **子代理**：无
- **修改文件**：
  - `tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` — 用例 51 双重加固：① 内容断言整体包入 `waitFor`（card testid 先于 timeline mock resolve 渲染，并行负载下断言早于数据 paint = 原 flaky 主因）；② 期望值由手工 `getHours().padStart + ':00'` 改与组件 `formatLocalHm` **逐字同参**的 `toLocaleTimeString(undefined, {hour:'2-digit',minute:'2-digit',hour12:false})`（消除半小时偏移时区 / 非 ':' 分隔 locale 下的潜伏确定性失败；UTC slice 回归检出能力保留——非 UTC 时区下期望值即不命中）。
  - `docs/archive/2026Q2/known-failing-tests_20260529.md` — §Flaky 唯一条目标记已加固 + 根因/验证记录闭档。
- **新增依赖**：无
- **数据库变更**：无
- **测试**：本机 ×3 + **TZ=Asia/Kolkata（+5:30，旧断言确定性必挂）/ UTC / America/New_York 三时区 66/66 全过** + 全量并行 **483 files 6359/6359 passed**（零 flaky 复现）+ typecheck / lint EXIT=0。零产品代码改动。
- **注意事项**：全量跑 stderr 有 1 条 jsdom `Not implemented: navigation` 噪音，来自 `CrawlerRunsView.test.tsx` 用例 32（pre-existing / 33 用例全过 / 非失败非本卡范围）。CHORE-TEST-BASELINE-20260529 系列至此全部收口。

## [CHG-VIR-CLOSEOUT-AUDIT] SEQ-20260602-03 遗留项核查收尾 — 5 项前置实证 + Phase 3 shadow 验收收口 + SEQ 状态翻转
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 12:50
- **执行模型**：claude-opus-4-8（建议模型 opus，一致）
- **子代理**：无（核查 + 文档登记，数据实证由只读报表/日志聚合直接支撑）
- **修改文件**：
  - `docs/task-queue.md` — SEQ-20260602-03 状态 🟡 规划中 → ✅ 主体完结 + 遗留项收尾核查记录（任务列表 15. CHG-VIR-CLOSEOUT-AUDIT 逐项登记）+ 最后更新时间追加。
  - `docs/tasks.md` — 任务卡全流程（写卡 → 执行 → 删卡）。
  - `docs/designs/merge-split-ux-redesign_20260603.md` — 补 `git add` 纳入版本控制（docs 新文档红线；SEQ-20260604-01 CHG-VIR-13 依赖文档，内容零改动）。
- **核查结论（5 项遗留逐一实证）**：
  - **① Phase 3 shadow 验收观察期 → ✅ PASS 收口**：ingest-shadow 日志全量 1178 次对照（06-04 采集窗口）disagree-bind=0 / agree-bind 5 / candidate-only 143 / no-counterpart 694 / none 336；identity-compare-report 总候选 215（跨 group 召回 186 / 强负拦截 173），ingest 切片 13 候选逐条合理；生产 catalog_id 零变更（R9 + D-105a-12）。
  - **② findOrCreate 切主读 → ❌ 已量化阻塞**：D-177-12 一致性 HARD=0 全绿 ✅；静态对照面由报表 Section 1 等价覆盖 ✅；实质阻塞 = douban 74 例 REPORT-2（cache 有值仅 candidate，切主读后精确步 miss 回落三元组）。澄清 catalog-ref-shadow 运行期 0 条非缺陷（采集输入无外部 ID，probes=0 即 return）。触发条件 = REPORT-2 趋 0。
  - **③ 双写收敛 + cache UNIQUE 复评（Y-A4）→ ❌ 链式后置 ②**（D-177-13 复评时点 = 切主读后）。
  - **④ 合并端点 + UI ADR → ❌ 无候选量实证**（冲突簇 Y-A3 当前 0 个）且应与 CHG-VIR-13 工作台（SEQ-20260604-01）协调，先行实施 = 过度建设。
  - **⑤ 自动绑定 ADR（Y-177-4）→ ❌ 评估输入不全**（Phase 3 报表 ✅ 本卡收口 / 上卷 candidate 12 个零人工裁定）。
- **新增依赖**：无
- **数据库变更**：无（全部只读核查）
- **测试**：纯文档改动，typecheck/lint/test 不适用；实证执行 `report-catalog-identity-consistency` ✓ HARD=0 EXIT 0 + `identity-compare-report`（全量 + --source=ingest）✓ 三桶健康。
- **共享层沉淀评估**：否——核查结论沉淀于 task-queue.md 遗留项登记（触发条件量化可跟踪），无代码产物。
- **注意事项**：① Phase 3 验收样本窗口 = 单日采集批（1178 次），后续采集自然延续监控；验收结论用户可随时基于新数据复核。② douban 74 例升级是人工流程（admin 豆瓣匹配确认 → 上卷 job 升 exact），非代码任务；REPORT-2 计数 = 进度指标。③ SEQ-20260604-01（CHG-VIR-13）全部 ⬜ 待开始，入口 = CHG-VIR-13-ADR。

## [CHG-VIR-13-ADR] ADR-105 AMENDMENT（D-105-7~12）+ ADR-179 Accepted — merge-split UX 工作台端点契约定档
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 13:40
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)（agentId a19744b07045b47e3 / 第 1 轮 CONDITIONAL → R1 修订后 PASS）
- **修改文件**：
  - `docs/decisions.md` — ① ADR-105 章节追加 AMENDMENT 2026-06-04（D-105-7~12 + R-105-T1~T7 + Y-105-T1~T5）+ 端点契约表 #1/#2/#3/#4/#5 行加性标注；② 文件末尾新增 ADR-179（Accepted / 2 新端点契约表 + D-179-1~6）
  - `docs/tasks.md` / `docs/task-queue.md` — 任务卡收口
- **变更内容**：
  - **ADR-105 AMENDMENT（4 既有端点加性扩展 + 操作内状态设置）**：D-105-7 candidates response `VideoSummaryForMerge` +7 optional（review/visibility/catalog×2/episodeRange/externalIds/coverUrl，coverUrl 真源锁 `mc.cover_url`；候选数量/排序/分页/计数逐值不变）；D-105-8 audit response `MergeAuditRow` +4 optional（actorType 从 `identity_decisions` 透出、**`video_merge_audit` 零加列**；titles 取 snapshot_jsonb；批量反查走 `idx_identity_decision_audit` 无 N+1）；D-105-9 merge `targetStatus?` / split `newVideoMeta.status?`（targetVideoId 组结构互斥天然不可携带；**action 推导以 (current, desired) 二元组为输入**——评审 R1 修订，13-D1 以 9 值 action 枚举 from-state 前置单测定档矩阵）；D-105-10 **post-COMMIT 状态写入边界**（transitionVideoState 自持 BEGIN/COMMIT+FOR UPDATE + migration 023 trigger 实证，禁事务内裸 UPDATE 三列；非原子显式声明 + `statusTransition?` 响应可观测）；D-105-11 unmerge `targetStatusBefore` 还原（fetchVideosByIds 现仅 SELECT is_published 实证 → 扩 2 列；存量 audit 兜底不动）；D-105-12 审计 afterJsonb 纯增量 + 错误码零新增。
  - **ADR-179（2 新 admin 端点）**：`GET /admin/identity-decisions`（decision/candidateId/reverted 过滤 + 分页幂等 + pair 摘要 JOIN）+ `POST /admin/identity-candidates/:id/revive`（rejected→新建 pending + `revived_from_candidate_id` 链原行零修改 / R6；**撞 pending unique 幂等返回 reused=true 且不置 reverted**；原 rejected decision 置 reverted 三列审计闭环；pair 一侧软删 409）。**零 migration 四表实证**：086 trigger_source CHECK 复用 'manual-search'（链字段一等复活标识，否决扩枚举）/ 052 action_type 无 DB CHECK（TS 层扩 'identity_candidate.revive'）/ 088 targetKind 已含 / 041 primary 唯一保 externalIds ≤4 条。
  - **评审闭环**：红线 R1（desired-only 固定映射对 approved-target〔merge 主场景〕确定性 422——approve/approve_and_publish/reject 均要求 from=pending_review，023 白名单 approved 间迁移走 publish/unpublish/set_hidden）→ 修订为二元组覆盖矩阵 + 前端 status-defaults 同矩阵唯一真源；Y1（088 归因 ADR-178 修正）/ Y2（coverUrl 收敛）已吸收；Y3（设计 §5 旧表 +6 为历史残留，以 ADR +7 为准）登记不动。
- **新增依赖**：无
- **数据库变更**：无（零 migration；两 ADR 均加性协议层）
- **测试**：纯文档；门禁 `verify:endpoint-adr` ✓（205 admin 路由全对齐，ADR-179 2 新路径登记）+ `verify:adr-contracts` ✓ + typecheck/lint EXIT=0
- **共享层沉淀评估**：否——协议定档无代码产物；(current,desired)→action 覆盖矩阵将在 13-D1 以纯函数 + 单测沉淀（status-defaults.ts 同矩阵真源）。
- **注意事项**：① D-105-7/8/9 触及 `packages/types/src/video-merge.types.ts` 公开类型 → 13-B1/C1/C2/D1 实施 commit 必须带 `Subagents: arch-reviewer (claude-opus-...)` trailer（CLAUDE.md 红线，评审提醒）。② 解阻 13-A1（本就并行）/ 13-B1 / 13-C1 / 13-D1；下一卡按依赖序取 13-A1（sonnet 建议，当前 opus 会话执行须在完成备注登记偏离）。③ auto-bind 维持 OFF（D-105a-17），actorType 通道为展示预留不抢跑。

## [CHG-VIR-13-A1] 入口收口 + badge 实时化 — merge 深链单一真源 + 来源回链栏
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 13:46
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——与 13-ADR 同会话连续执行）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/merge/entry.ts` — 新建：MergeEntrySource 4 枚举 + MERGE_ENTRY_SOURCE_META（label/backHref 单一真源）+ buildMergeHref（merge-pair/split/batch-merge/tab 4 形态 discriminated union；参数顺序契约显式登记防测试回归）
  - `apps/server-next/src/lib/admin-shell-nav-counts.ts` — 新建：useAdminNavCounts 60s setInterval 轮询 listCandidates({source:'identity',limit:1}) total → AdminNavCountProvider 闭包；401/403 静默（moderator 无 merge 权限）+ 其他 warn 降级（HOTFIX-G 范式）；null/0 不入 Map 无 badge
  - `apps/server-next/src/lib/admin-nav.tsx` — merge 项移除静态 count: 6 假数据（保留 badge:'warn'）
  - `apps/server-next/src/app/admin/admin-shell-client.tsx` — countProvider stub → useAdminNavCounts
  - `apps/server-next/src/app/admin/videos/_client/VideoRowActions.tsx` / `moderation/_client/RightPane/TabSimilar.tsx` / `moderation/_client/PendingCenter.tsx`（补 from=moderation）/ `moderation/_client/ModerationConsole.tsx` / `lib/audit/rollback-routes.ts` ×3 行（补 from=audit-rollback）— 5 处内联 URL 拼接 → buildMergeHref
  - `apps/server-next/src/app/admin/merge/_client/MergeClient.tsx` — 来源回链栏（merge-entry-source-bar：from 合法值守卫 + 返回按钮 + 关闭仅清 from）；candidate_a banner 来源前缀文案移除（回链栏承载）
  - `tests/unit/lib/merge-entry.test.ts` — 新建 8 用例（4 形态 + 顺序契约 + 编码 + 守卫 + META 完整性）
  - `tests/unit/components/server-next/admin/merge/MergeCandidateBanner.test.tsx` — +4 回链栏用例 + 用例 2 来源文案断言迁移
  - `tests/unit/components/server-next/admin/moderation/pending-center-split-button.test.tsx` / `tests/unit/server-next/audit/rollback-routes.test.ts` — 断言随 +from 行为更新
- **新增依赖**：无（**合理偏离登记：设计稿「SWR 轮询」按项目惯例落地为自写 setInterval hook**——server-next 无 swr 依赖，禁新依赖红线；范式对齐 admin-shell-notifications.ts POLL_INTERVAL_MS 60s）
- **数据库变更**：无
- **测试**：受影响 10 套件 75/75 → 全量 **484 files 6371/6371 passed**（净 +12）；crawler #30 隔离复跑 191/191 确认 flaky 非本卡回归；typecheck/lint EXIT=0
- **共享层沉淀评估**：是——entry.ts 即本卡的沉淀产物（深链构造从 5 文件内联收口到单一真源；13-WS mode 模型升级时仅改此文件 + MergeClient 映射层，入口零再改）；useAdminNavCounts 为 countProvider 首个真数据接入，后续导航项（审核 484 等静态数）可循同模式接入。
- **注意事项**：① merge 页 e2e 深链回归归 13-WS（升级映射验收）+ 系列收口（设计 §9）。② rollback `?tab=` 形态 MergeClient 尚不消费（pre-existing gap），13-WS mode/URL 双向同步时闭合。③ 下一卡可选：13-A2（视频库新增入口，依赖 13-A1 ✅）/ 13-WS（依赖 13-A1 ✅）/ 13-B1（依赖 13-ADR ✅）。

## [CHG-VIR-13-A2] 视频库新增合并/拆分入口 — 行级发起拆分 + 批量合并所选
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 14:32
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——同会话连续执行）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/merge/entry.ts` — MergeEntrySource 枚举 4→6（videos-split / videos-batch）+ SOURCE_META 同步
  - `apps/server-next/src/app/admin/videos/_client/VideoRowActions.tsx` — buildItems +onSplit 参数 + `split` item（与 merge 同组并列）→ 同窗深链拆分工作台
  - `apps/server-next/src/app/admin/videos/_client/VideoBatchActions.tsx` — buildBatchActions 加可选 `opts.onMergeSelected`（纯函数零 router 依赖）；count ≥ 2 且注入回调才头插「合并所选（N）」action（旧调用不传 opts 零影响）；无 confirm（导航动作，落地页自带工作区确认）
  - `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx` — 注入 onMergeSelected：window.open 新窗口（对齐 moderation-batch 既有行为，保留列表选择上下文，免引 useRouter）
  - `tests/unit/components/server-next/admin/videos/VideoRowActions.test.tsx` — router push 升级模块级 spy + 3 用例（merge 深链断言空白顺手补齐 / split 深链 / 始终渲染）
  - `tests/unit/components/server-next/admin/videos/SelectionActions.test.tsx` — import 真实 buildBatchActions（非镜像）+ 3 用例（不传 opts 零影响 / <2 不渲染 / ≥2 回调收全 ids）
- **新增依赖**：无
- **数据库变更**：无
- **测试**：受影响 5 套件 74/74 → 全量 **484 files 6377/6377 passed**（净 +6）；两轮并发负载 flaky（UserSubmissions 等，隔离复跑全过 + 末轮全量零失败）确认非本卡回归；typecheck/lint EXIT=0
- **共享层沉淀评估**：否——本卡为 entry.ts（13-A1 沉淀）的消费方扩展；buildBatchActions 的 opts 注入模式保持纯函数边界，无新共享原语需求。
- **注意事项**：① 13-A 系（A1+A2）全部收口。② 批量合并 >11 个执行将 422（MergeSchema 上限），与 moderation-batch 入口同等行为；13-WS 集合编辑器落地后可裁剪分批（设计 §10.4）。③ 下一卡按依赖序：13-WS（骨架，依赖 13-A1 ✅）或 13-B1（后端契约，依赖 13-ADR ✅），两者可并行域。

## [CHG-VIR-13-B1] 合并候选对比数据契约扩展 — VideoSummaryForMerge +7 optional（D-105-7）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 14:45
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——同会话连续执行）
- **子代理**：arch-reviewer (claude-opus-4-8)（13-ADR 阶段 D-105-7 契约 PASS / agentId a19744b07045b47e3，本卡按契约实施；packages/types 公开契约扩展 trailer 依据）
- **修改文件**：
  - `packages/types/src/video-merge.types.ts` — VideoSummaryForMerge +7 optional（reviewStatus / visibilityStatus / catalogId / catalogTitle / episodeRange / externalIds / coverUrl），R-105-T4 纯增量注释锚定
  - `apps/api/src/db/queries/video-merge-candidates.ts` — RawVideoDetailRow +8 列 + fetchVideoDetailsForCandidates SELECT 扩展（v.review_status/visibility_status/catalog_id 主键函数依赖免入 GROUP BY；mc.title/mc.cover_url 显式入；MIN/MAX(vs.episode_number)；externalIds 相关子查询仅 is_primary + manual_confirmed/auto_matched，避免与 vs 聚合笛卡尔）
  - `apps/api/src/services/VideoMergesService.schemas.ts` — mapVideoRow +7 映射（单一函数 → legacy 候选 / identity 候选 / merge targetVideo 三消费点自动透出；catalogTitle null→undefined）
  - `tests/unit/api/video-merge-candidates.test.ts` — +4 用例（SQL 数据源断言含「candidate/rejected 不透出」守卫 / legacy 响应 7 字段透出 / R-105-T4 同输入 score·组数·推荐 target 逐值不变 / 旧 fixture undefined 向后兼容）
- **新增依赖**：无
- **数据库变更**：无（纯读侧 SELECT 扩展；verify SQL schema 对齐 ✓）
- **测试**：36/36 → 全量 **484 files 6381/6381 passed**（净 +4）；**dev 真实库只读冒烟**：SQL 形态 ✓（GROUP BY 函数依赖 + jsonb_agg）+ external_ids 命中样本（douban 单 provider / bangumi+douban 双 provider，ORDER BY provider 确定性）形态精确符合契约；typecheck/lint/verify:adr-contracts EXIT=0
- **共享层沉淀评估**：否——契约层加性扩展；mapVideoRow 单点扩展即三消费点覆盖（既有共享结构的收益兑现，无新原语）。
- **注意事项**：① 卡面「fetchRawCandidateGroups 扩 SELECT」按实际落地修正：组级行无 video 字段不需扩，仅 detail 查询扩展（完成备注已登记）。② 13-B2A（MergeComparePanel 消费新字段）与 13-D1（状态设置后端）双解阻。③ identity 候选路径经同一 fetchVideoDetailsForCandidates + mapVideoRow，新字段自动可用（无独立改动）。

## [CHG-VIR-13-WS] 工作台 mode 骨架重构 — 单一活动工作区 + Direct/Batch 合一 MergeWorkspace
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 15:05
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——同会话连续执行）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/merge/_client/MergeClient.tsx` — 重写为 mode 骨架（370→231 行）：`deriveWorkspace` 升级映射真源（显式 ?mode= > candidate_a/ids→merge > split→split > tab=merged|split→records 预过滤 > 默认 candidates；不重写 URL 内部推导）+ Segment 4 区（candidates/merge/split/records，onChange→router.replace 双向同步）+ 单一活动工作区；describeError 多消费方共享保留
  - `apps/server-next/src/app/admin/merge/_client/MergeWorkspace.tsx` — 新建（272 行）：Direct（2→1/target 锁死为 A）+ Batch（纯 uuid 行列表）合一为视频集合编辑器——深链 ids 并行 fetch 预填（失败 id 占位行）+ VideoPicker 增删排重 + target radio 任意切换 + reason ≤500 + candidateId 透传守卫（成员集合恰为初始 pair 无序相等才透传 confirm，增删失配自动失效）+ 上限 11 禁用提示 + toast 撤销 action
  - `apps/server-next/src/app/admin/merge/_client/BatchMergeWorkspace.tsx` — 删除（grep 零残留消费）
  - `tests/unit/components/server-next/admin/merge/MergeWorkspace.test.tsx` — 新建 9 用例（吸收 MergeDirectWorkspace.test 6 + batch-merge-workspace.test 4 语义；两旧文件删除）
  - `tests/unit/components/server-next/admin/merge/MergeClient.test.tsx` — 15→16 用例（Segment 4 区断言 / mode 双向同步两半 / tab= 升级映射×2 / mode=records×2 / 拆分流程改 URL 注入式）
  - `tests/unit/components/server-next/admin/merge/MergeCandidateBanner.test.tsx` — 重写为升级映射 3 用例（banner 废除回归守卫）+ 回链栏 4 用例保留
- **新增依赖**：无
- **数据库变更**：无
- **测试**：merge 目录 5 文件 46/46 → 全量 **484 files 6379/6379 passed**（复跑全绿；上轮 1 失败 = 并发 flaky 非本卡）；typecheck 0 error / lint ✓；MergeClient 231 行 + MergeWorkspace 272 行均 <500 红线
- **共享层沉淀评估**：否——mode 骨架为页面级编排（消费 entry.ts 单一真源）；MergeWorkspace 为 merge 域专属工作区（无跨页消费方）。13-WS 兑现 13-A1 沉淀承诺：入口文件零再改（升级映射收口在 deriveWorkspace + entry.ts）。
- **注意事项**：① 范围 ⑤「既有深链回归 e2e」按单测层全覆盖落地（5+1 处升级映射逐一断言），Playwright e2e 留系列收口（设计 §9 既定）——偏离登记。② SplitSection→SplitWorkspace 重命名推迟 13-B2B（卡面预登记）。③ 候选行展开「转入合并工作区」动作归 13-B2B（§10.4）。④ 解阻 13-B2B / 13-PLAY / 13-C2；下一卡候选：13-D1（opus）/ 13-C1（opus）/ 13-B2A。

## [CHG-VIR-13-B2A] 对比矩阵 + 结果预览组件 — N 列字段矩阵 + 结构级线路×集数预览
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 15:15
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——同会话连续执行）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/merge/_client/MergeComparePanel.tsx` — 新建：8 字段行 × N video 列矩阵（首列 sticky + 横滚 + minWidth；列头 radio target 单选整列高亮 + 推荐 badge；deriveConflicts 纯函数：type/year→warn / 同 provider 不同 external_id→danger；D-105-7 字段缺失「—」零崩溃）
  - `apps/server-next/src/app/admin/merge/_client/MergeResultPreview.tsx` — 新建双形态：merge（After 汇总随 target useMemo 重算 + 软删列表 + 状态降级警示 + onEpisodeClick 13-PLAY 锚点钩子）/ split（组卡新建「默认待审·内部」与转入已有「不改元数据」+ 原视频软删明示 §10.2-4）；combineMatrices 导出纯函数（getVideoMatrix ×N 按需合成 + 三信号：同站同名跨 video danger 409 预警 / 集数互补 ok / 完全重叠 info 播放抽验）
  - `tests/unit/components/server-next/admin/merge/MergeComparePreview.test.tsx` — 新建 12 用例
- **新增依赖**：无
- **数据库变更**：无
- **测试**：12/12 → 全量 **484 files 6391/6391 passed**（净 +12）；typecheck 0 error / lint ✓
- **共享层沉淀评估**：是（域内）——两组件为 merge/_client 域共享件（13-B2B 嵌入候选行展开 + MergeWorkspace 两处消费即 ≥2；若审核台后续消费再上提 src/components/shared）；combineMatrices 纯函数独立可测沉淀。
- **注意事项**：① 组件当前无消费方（13-B2B 嵌入 CandidateExpand/SplitWorkspace + 候选组转工作区）。② onEpisodeClick 仅渲染 ▶ 钩子，PlayPreviewDrawer 实装归 13-PLAY。③ 状态降级警示的「一键修复」交互归 13-D2（MergeStatusControl）。

## [CHG-VIR-13-B2A-FIX] Codex stop-time review — 结构预览 stale/竞态守卫
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 15:26
- **执行模型**：claude-opus-4-8
- **子代理**：无（Codex stop-time review 触发）
- **修改文件**：
  - `apps/server-next/src/app/admin/merge/_client/MergeResultPreview.tsx` — stale 守卫：videosKey 变化（候选组切换/成员增删）→ 旧 structure 立即失效 + requestSeqRef 飞行中旧请求作废（过期响应 seq 比对丢弃）+ unmount 防护
  - `tests/unit/components/server-next/admin/merge/MergeComparePreview.test.tsx` — +2 回归用例（11b 集合变化清空旧预览 / 11c 挂起旧请求过期响应不覆盖）
- **测试**：14/14 → 全量 **484 files 6393/6393 passed**（净 +2）；typecheck/lint ✓
- **注意事项**：问题域 = 13-B2A 新增组件（旧 structure 在 videos prop 变化后误显示旧集合线路）；同会话内闭环，13-B2A 完成备注已补登。

## [CHG-VIR-13-B2A-FIX-2] Codex stop-time review — StrictMode 下 stale 守卫哨兵失效修复
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 15:58
- **执行模型**：claude-opus-4-8
- **子代理**：无（Codex stop-time review 第 2 轮触发）
- **修改文件**：
  - `apps/server-next/src/app/admin/merge/_client/MergeResultPreview.tsx` — unmount cleanup 由 `requestSeqRef.current = Number.MAX_SAFE_INTEGER` 改为 `+= 1`：StrictMode mount→unmount→remount 时 ref 保留，MAX 起点后 `++` 超出 2^53 精度不再递增 → seq 比对恒真 → FIX-1 守卫被永久禁用；`+= 1` 同样作废飞行请求且 remount 后自然递增
  - `tests/unit/components/server-next/admin/merge/MergeComparePreview.test.tsx` — +1 StrictMode 回归用例（11d：remount 后正常加载 + 集合变化守卫生效 + 可重新展开）
- **测试**：15/15 → 全量 **484 files 6394/6394 passed**（净 +1）；机器高负载期（551s+/常态 137s）3 个跨域失败（perf 基线/staging/crawler）隔离 115/115 + 负载回落终轮全量零失败 = 负载型 flaky 排除；typecheck/lint ✓
- **注意事项**：教训沉淀——unmount 哨兵值不要用「极大值毒化」模式（StrictMode ref 保留语义下不可逆），统一用「cleanup 递增序号」（可逆、remount 友好）。

## [CHG-TEST-SLIM-A] ADR-180 测试分层执行策略定档 + 全量兜底节点规范
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 17:55
- **执行模型**：claude-opus-4-8
- **子代理**：Explore ×3 (claude-opus-4-8)、Plan ×1 (claude-opus-4-8)
- **修改文件**：
  - `docs/decisions.md` — 新增 ADR-180（Accepted）：测试分层执行策略——裁定①增量 commit 门禁 + 全量兜底三节点（preflight 冷启动 / PHASE COMPLETE 审计前 / 合并 main 前）/ 裁定②升全量触发集双层防护（脚本层 + forceRerunTriggers 配置层）/ 裁定③E2E 任务域选跑纯 npm scripts 映射 / 裁定④web-mobile 收窄移动 3 spec（16 个无移动逻辑 spec 复跑边际覆盖≈0 实证）/ 裁定⑤typecheck 解绑 turbo ^build + 试验入口默认不切；备选方案 5 项否决记录（全量调优 / 双轨 / spec tag / 删 project / diff 自动推断域）
  - `docs/rules/workflow-rules.md` — 新增「全量测试兜底三节点」小节 + PHASE COMPLETE 模板触发条件补全量绿硬前置
  - `docs/rules/quality-gates.md` — §6 补测试分层执行边界声明
  - `docs/task-queue.md` — SEQ-20260604-02 序列登记（SLIM-A/B/C/D + CARD-ATOM 五卡，每卡 ≤5 项）+ 后续卡登记（CHG-TEST-CLEANUP-* 测试代码瘦身 / CHG-TEST-SLIM-E turbo inputs 验证 / CHG-CARD-ATOM-VERIFY）
- **新增依赖**：无
- **数据库变更**：无
- **测试**：纯文档零代码；verify:adr-contracts FAIL-fast 三项全绿（endpoint-adr 205 路由 / style-shorthand 0 / shell-types-mirror 对齐）；verify:docs-format 与改动前基线一致（64 项均为存量、零新增）
- **D-N 闭环**：D-180-6（test:guarded / preflight 维持全量语义、不接入增量——workflow-rules 三节点小节 + quality-gates §6 声明即为其实施落点）；其余 5 条裁定随 CHG-TEST-SLIM-B/C/D 实施闭环
- **共享层沉淀评估**：否——规范定档类任务，无代码产物；分层策略规则已沉淀至 workflow-rules / quality-gates 单一真源。
- **注意事项**：① 触发背景 = 用户指令（CHG-VIR-13 首卡耗时近 3 小时，流程优化优先插队）。② test-rules.md「分层执行策略」小节与 CLAUDE.md 必跑命令修订**不在本卡**——刻意归 SLIM-B/C（文档引用的 test:changed / test:e2e:<domain> 脚本落地同卡修订，避免文档先于脚本存在的悬空窗口）。③ 落档卡 changelog 不写未实施 D-180 字面（裁定①~⑤），闭环字面归实施卡（quality-gates §6 规约守卫）。

## [CHG-TEST-SLIM-B] 单测增量门禁实施（D-180-1 + D-180-2 闭环）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 18:25
- **执行模型**：claude-opus-4-8
- **子代理**：无（设计已由 SLIM-A 阶段 Plan 子代理完成）
- **修改文件**：
  - `scripts/test-changed.mjs` — 新建：增量包装器（git 改动集〔diff ∪ cached ∪ untracked〕→ docs-only SKIP / 触发集升全量 / 否则 vitest run --changed HEAD；git 异常与零选中双安全网 fallback 全量；--base 支持 origin/main；--dry-run 决策预览；exit code 透传）
  - `vitest.config.ts` — 补 forceRerunTriggers（配置层双保险：vitest.config / integration.config / tests/helpers/** / package.json / tsconfig*.json；显式覆盖默认值并保留默认项）
  - `package.json` — +test:changed / +test:changed:main（只增不删；test:run 全量入口语义不变）
  - `CLAUDE.md` — 必跑命令单测行分层化（commit 前 test:changed；全量三节点注记）
  - `docs/rules/test-rules.md` — 新增「分层执行策略」小节（四级分级 + 双层防护 + 三节点表 + 已知边界声明）
- **新增依赖**：无
- **数据库变更**：无
- **测试**：分级决策 7 场景 worktree 实测全过（干净树 exit 0 / docs-only SKIP / helpers·基础包 FULL / service·untracked CHANGED / 混合 CHANGED）；门禁经 test:changed 自身入口跑通——当前 diff 命中触发集（package.json + vitest.config.ts）自动升全量，**484 files 6394/6394 passed**（4.2 分钟）；typecheck / lint EXIT=0。增量 CHANGED 路径真实选测验证排程于本 commit 后干净树立即执行（配置改动在 diff 中时按设计必然 FULL，无法在 commit 前实测 CHANGED）。
- **D-N 闭环**：D-180-1（增量 commit 门禁 + 三节点兜底 + 安全网）、D-180-2（升全量触发集双层防护）
- **共享层沉淀评估**：否——独立运维脚本，无业务代码；分级规则真源在脚本 + test-rules §分层执行策略双处一致。
- **注意事项**：① 触发集含本脚本自身与 test-guarded.ts（改门禁工具必全量自证）。② 零选中安全网经 vitest 输出 "No test files found" 缓冲检测实现（流式透传不影响正常输出）。③ E2E 域选跑归 SLIM-C；CLAUDE.md test:e2e 行同卡修订。

## [CHG-TEST-SLIM-C] E2E 任务域选跑 + web-mobile 收窄（D-180-3 + D-180-4 闭环）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 18:50
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `package.json` — +7 域脚本（test:e2e:{smoke,player,auth,search,video,admin,mobile}；只增不删，test:e2e 全量入口不变）
  - `playwright.config.ts` — ① web-mobile 加 testMatch 收窄移动 3 spec（D-180-4）② PLAYWRIGHT_SERVERS 子集机制（域脚本只起所需 dev server；未设置默认全起，全量行为零变化）
  - `CLAUDE.md` — 必跑命令 E2E 行：域选跑为日常默认 + 全量收敛 Phase 门禁
  - `docs/rules/test-rules.md` — 运行命令补 7 域命令 + 域选跑机制说明 + web-mobile 收窄依据 + 孤儿 spec 登记；AUTH/VIDEO·SEARCH/PLAYER 三小节补「任务完成后运行」域命令
  - `docs/decisions.md` — ADR-180 D-180-3 实施校准注记（孤儿 spec 修正 / PLAYWRIGHT_SERVERS 增强 / 用例数实测）
- **新增依赖**：无
- **数据库变更**：无
- **测试**：--list 实测全过——web-mobile 3 files/21 tests（原 19 files/104）；域子集 player 38 / auth 26 / search 18 / smoke 19 / admin 82 均 ≪ 全量；全量 `test:e2e` 290→207 用例（−29%）兜底未破；typecheck/lint EXIT=0 + 单测门禁经 test:changed 升全量 484 files 6394/6394 passed。
- **D-N 闭环**：D-180-3（E2E 任务域映射 + 按需 webServer）、D-180-4（web-mobile 收窄移动 3 spec）
- **共享层沉淀评估**：否——纯 npm scripts + playwright config，零自研编排层（ADR-180 备选 C 论证）。
- **注意事项**：① **偏离登记（实测修正 ADR 草案映射）**：tests/e2e/auth.spec.ts 与 search.spec.ts 为孤儿 spec（不被任何 project testMatch 匹配、test:e2e 从未运行）→ auth 域据实 = admin.spec.ts（角色访问）、search 域不含孤儿；孤儿处置随 tests/e2e LEGACY 清理。② 活跃隔离清单不存在（known_failing 已全部归档），web-mobile 收窄零清单清理。③ video 域两段 && 串联（admin/web 不同 server 子集）。

## [CHG-TEST-SLIM-D] typecheck 解绑 turbo ^build + 试验入口（D-180-5 闭环）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 18:20
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `turbo.json` — typecheck `dependsOn: ["^build"]` → `[]`（typecheck 全部为 tsc --noEmit、无 project references、alias 指 src/，不消费 build 产物；解绑前 turbo typecheck 会无谓触发 3 个 next build）
  - `package.json` — +typecheck:turbo（`tsc --noEmit && npx turbo run typecheck --filter=!eslint-plugin-resovo`；试验入口，默认必跑命令仍是现有串行 typecheck）
- **新增依赖**：无
- **数据库变更**：无
- **测试**：typecheck:turbo EXIT=0 + 零 build 触发 + 7 tasks 与现有串行枚举一致；首跑 21.7s（串行约 70s）/ 二跑缓存 37ms FULL TURBO；与 `npm run typecheck` 报错集一致（双零错误）。门禁：lint EXIT=0 + 单测经 test:changed 升全量（turbo.json 命中触发集）——两轮全量各 1 个互不重合的 jsdom flaky（StagingEditPanel / CrawlerRunsView，历史已知负载型），各自隔离复跑 12/12 + 33/33 全过排除，483+1/484 实质全绿。
- **D-N 闭环**：D-180-5（解绑 ^build + 试验入口默认不切；inputs 缓存正确性验证留 CHG-TEST-SLIM-E）
- **共享层沉淀评估**：否——构建编排配置，无代码。
- **注意事项**：① **存量发现**：tools/eslint-plugin-resovo 的 typecheck 脚本一直损坏（缺 @types/eslint，TS7016/TS7006 ×3）——根串行 typecheck 从不包含它故从未暴露；turbo 入口以 --filter 排除对齐现有覆盖范围（修复需新依赖 @types/eslint → 禁新依赖红线，留待人工裁定或随 ESLint plugin R&D 卡处理）。② 缓存命中判定基于 turbo 默认 inputs（全包内文件），跨 workspace 源变化是否正确失效未验证 → typecheck:turbo 不得作为门禁默认，CHG-TEST-SLIM-E 验证后才可切换。

## [CHG-CARD-ATOM] 任务卡原子化判据定档（全卡型四问）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 19:35
- **执行模型**：claude-opus-4-8
- **子代理**：Explore ×1 (claude-opus-4-8)（现有拆卡规则与缺口调查）
- **修改文件**：
  - `docs/rules/workflow-rules.md` — 「PATCH 卡范围软上限」扩展为「任务卡原子化判据」：全卡型起卡前四问（①改动项 >5 必拆〔原 PATCH 专属推广〕②跨层混合 schema/api-service/UI 跨 3 层强制拆、跨 2 层须写跨层理由 ③验收口径必须一句话唯一、新增测试 >12 用例 advisory ④依赖链 >4 层 advisory SEQ 重排）；阶段审计硬清单第 5 项同步全卡型
  - `docs/rules/quality-gates.md` — §7 硬清单第 5 项「PATCH 卡」→「所有任务卡」（判据/统计口径/自动化指引同步）+ §6 第 7 条引用更新
  - `CLAUDE.md` — 绝对禁止项对应行扩展为全卡型 + 跨 3 层禁止
- **新增依赖**：无
- **数据库变更**：无
- **测试**：纯文档；test:changed docs-only SKIP 实测生效（6 个 .md 改动零测试运行 exit 0——新分层流程自证）；verify:docs-format 64 项 = 存量基线零新增；旧名"PATCH 卡范围软上限"引用全部更新（仅节标题保留出处注记）。
- **共享层沉淀评估**：否——流程规则定档；判据单一真源 = workflow-rules §任务卡原子化判据，quality-gates/CLAUDE.md 为引用。
- **注意事项**：① 仅约束新起卡、不追溯存量（CHG-VIR-13 系列等进行中卡不受影响）。② 数据依据 = M-SN-5 完成度反比 + CHG-VIR-9/11/12 拆卡 100% 完成度佐证；缺口调查证据 = 文件数/跨层/验收口径/链深四维无约束（CHG-VIR-12 A→F 六层链先例）。③ 自动守卫 verify:task-card-scope 已登记 CHG-CARD-ATOM-VERIFY 待立案。④ 权威源 server_next_plan §5.3 为历史 plan 文档不改写，演进真源在 workflow-rules（节内已注明扩展关系）。

## [CHG-TEST-SLIM-B-FIX] Codex stop-time review — test:changed 漏删除类改动
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 19:55
- **执行模型**：claude-opus-4-8
- **子代理**：无（Codex stop-time review 触发）
- **修改文件**：
  - `scripts/test-changed.mjs` — 分级改动集去掉 `--diff-filter=ACMR`（纳入删除 D）：原实现下**仅删除文件**（如删 tests/helpers/db.ts / packages/types 文件）被视为"无改动"直接 exit 0 静默跳过测试——分级清单只用于 docs-only/触发集判定、不传给 vitest，无需过滤；删 helpers/基础包现正确升全量，删普通源走 --changed（vitest 选中仍 import 它的测试报错暴露 / 零选中走安全网全量），仅删 docs 正确 SKIP
- **测试**：worktree 实测 5 删除场景（rm helpers→FULL / rm 基础包→FULL / rm docs→SKIP / rm 普通源→CHANGED / git rm staged helpers→FULL）+ 2 回归场景（改源 CHANGED / 干净树 exit 0）全过；门禁经 test:changed 自身入口升全量 **484 files 6394/6394 passed**。
- **注意事项**：问题域 = SLIM-B 新增脚本；同会话内闭环，SLIM-B 完成备注已补登。教训沉淀——"改动集"类工具默认不要加 diff-filter，除非清单的下游消费方确实无法处理删除路径。

## [CHG-VIR-13-B2B] 预览嵌入 + 拆分 VideoPicker + 候选组转工作区
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 18:48
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——同会话连续执行）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidateExpand.tsx` — 嵌入改造（213→160 行）：视频卡网格 + 纯文本影响预览 → MergeComparePanel（targetId 受控）+ MergeResultPreview kind=merge；「转入合并工作区」次级按钮（mode=merge&ids=组成员，清 candidate_* 锚点）；>11 提示改「转入合并工作区裁剪集合分批合并」（§10.4-2）
  - `apps/server-next/src/app/admin/merge/_client/SplitWorkspace.tsx` — 新建（MergeSplitSection.tsx 重命名兑现 13-WS 预登记；421→484 行）：拆分对象 VideoPicker（选中即加载 + 深链标题充实 fetch）+ 每组「拆到已有视频」VideoPicker（GroupMeta string→PickerVideoItem）——两处手输 uuid 消除；previewGroups useMemo 零请求推导 → MergeResultPreview kind=split 嵌入（组卡 + 原视频软删明示）
  - `apps/server-next/src/app/admin/merge/_client/MergeSplitSection.tsx` — 删除（重命名）
  - `apps/server-next/src/app/admin/merge/_client/MergeClient.tsx` — import 跟随 + 注释更新
  - `tests/unit/components/server-next/admin/merge/merge-split-deeplink.test.tsx` — 重写为 SplitWorkspace 版（4 用例 + picker-fetcher mock + VideoPicker stub）
  - `tests/unit/components/server-next/admin/merge/MergeClient.test.tsx` — 16→18 用例（+转工作区 ids 断言 / +split 预览嵌入双 picker 断言；5 处随形态更新）
- **新增依赖**：无
- **数据库变更**：无
- **测试**：merge 目录 6 文件 63/63 → 全量 **484 files 6396/6396 passed**（复跑全绿；上轮 2 失败 = 既见并发 flaky）；typecheck 0 error / lint ✓
- **共享层沉淀评估**：否——13-B2A 组件的消费接线（ComparePanel/ResultPreview 各 2 消费点兑现）；previewGroups 推导为 SplitWorkspace 内聚逻辑。
- **注意事项**：① SplitWorkspace 484 行接近 500 预算——13-PLAY 嵌入 ▶ 锚点时若超限先拆（分配表/分组配置子组件）。② 13-D2（MergeStatusControl 三处嵌入点）就绪。③ 剩余卡：13-PLAY / 13-D1（opus）/ 13-D2 / 13-C1（opus）/ 13-C2 / 13-I18N。

## [CHG-VIR-13-PLAY] 播放抽验 PlayPreviewDrawer — 同集对比切换 + 两侧嵌入
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 19:14
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——同会话连续执行）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/merge/_client/PlayPreviewDrawer.tsx` — 新建（165 行）：admin-ui Drawer（right/440）+ moderation AdminPlayer（key=sourceId remount 切源；跨模块导入沿 VideoEditDrawer 先例；feedback 内建零另加）+ 同集成员切换 chips（§11.9 核心交互：同 episodeNumber 秒切对比画面）+ 集数条
  - `apps/server-next/src/app/admin/merge/_client/StructurePreview.tsx` — 新建（282 行）：结构级预览自 MergeResultPreview 抽出解耦——输入收窄 `{id,title}` 最小 ref（VideoSummaryForMerge/PickerVideoItem 通吃）；combineMatrices + stale 守卫（Codex FIX×2）随迁；▶ 格默认唤起内置抽屉、外部 onEpisodeClick 优先（逃生口）
  - `apps/server-next/src/app/admin/merge/_client/MergeResultPreview.tsx` — 瘦身（170 行）：消费 StructurePreview + re-export combineMatrices 兼容既有 import
  - `apps/server-next/src/app/admin/merge/_client/MergeWorkspace.tsx` — 成员 ≥2 嵌入 StructurePreview（§11.3 工作区预览嵌入；ComparePanel 因 summary 数据无端点不嵌——零新端点约束登记）
  - `apps/server-next/src/app/admin/merge/_client/SplitAssignTable.tsx` — 新建（109 行）：分配表自 SplitWorkspace 抽出（500 行预算）+ 行级 ▶ 播放抽验
  - `apps/server-next/src/app/admin/merge/_client/SplitWorkspace.tsx` — 接 SplitAssignTable + 抽屉（490 行守住红线）
  - `tests/.../PlayPreview.test.tsx`（新建 7 用例）/ `MergeWorkspace.test.tsx`（+1 嵌入）/ `merge-split-deeplink.test.tsx`（stub 补 Drawer 修 Unhandled「No Drawer export」）
- **新增依赖**：无
- **数据库变更**：无
- **测试**：merge 目录 7 文件 71/71 → 全量 **484 files 6404/6404 passed**（净 +8；复跑全绿）；typecheck 0 error / lint ✓
- **共享层沉淀评估**：是（域内）——StructurePreview 最小输入解耦使其成为候选行展开 + merge 工作区双消费共享件；PlayTarget 类型为 13 系列播放抽验统一契约。
- **注意事项**：① e2e（PLAYER 类）登记留系列收口（本机 e2e 鉴权 env 已知问题沿 CHG-VSR-PRE-2；AdminPlayer 自身已有审核台 e2e 覆盖）。② 剩余卡：13-D1（opus）/ 13-D2 / 13-C1（opus）/ 13-C2 / 13-I18N。

## [CHG-VIR-13-PLAY-FIX] Codex stop-time review — 完成状态与 e2e 门禁一致性修正
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 19:30
- **执行模型**：claude-opus-4-8
- **子代理**：无（Codex stop-time review 第 3 轮触发）
- **修改文件**：`docs/task-queue.md`（13-PLAY 完成备注 e2e 项「登记留收口」→「已实跑 + 归因」；SEQ 头部新增**系列收口硬前置 e2e gate** 显式条目）、`docs/tasks.md`（历史行同步）
- **变更内容**：13-PLAY 卡面自书「完成后补跑 test:e2e(PLAYER)」门禁未兑现即标 ✅ —— 本次实跑兑现：`test:e2e:player` 8 spec，webServer 自起被外部 :3000 next-server 占用（EADDRINUSE）→ `PLAYWRIGHT_SERVERS=` 复用外部 server 实跑 38 failed；**归因 = 环境性非回归**（双证据：① smoke.spec 基础路由自身 2/2 失败〔next-placeholder 200 不通过〕= 外部 server 与 e2e 期望环境不符；② 系列全部 commits 对前台 diff 仅 video-merge.types.ts +17 行纯 optional 类型，apps/web-next / player-core 零触碰，smoke 不消费该类型）。可信 e2e 验证（干净 :3000 环境：player 域 + merge 页深链 + video 域〔13-D1 后〕）登记为**系列收口硬前置**，任一失败先修复再收口。
- **测试**：纯 docs + e2e 实跑取证；单测门禁不受影响（6404/6404 维持）
- **注意事项**：教训沉淀——卡面自书门禁加项必须在收口前兑现或显式降级为可追踪条目，禁止「登记留收口」的含糊态（无归宿的未尽门禁 = 完成状态不一致）。

## [CHG-VIR-13-D1] merge/split 操作内状态设置后端扩展（SEQ-20260604-01 / ADR-105 AMENDMENT 2026-06-04 D-105-9~12）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 20:20
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8 / a19744b07045b47e3)——13-ADR 阶段 D-105-9 契约 PASS（含 R1 修订「(current,desired) 二元组矩阵」），本卡按契约实施，无新 spawn
- **修改文件**：
  - `packages/types/src/video-merge.types.ts` — 新增 `VideoStatusSetting` / `StatusTransitionOutcome`；`MergeParams.targetStatus?` + `SplitGroup.newVideoMeta.status?`（targetVideoId 组结构互斥天然不可携带 / R-105-T5）+ `MergeResult` / `SplitResult`（数组形态）/ `UnmergeResult` 各扩 `statusTransition?`
  - `apps/api/src/services/VideoMergesService.status-helpers.ts` — **新建（251 行）**：(current,desired) 二元组 → action 覆盖矩阵（应用层 9 值 action from-state 前置 + migration 053 trigger 白名单双层逐行核对，差集注释留档）+ `resolveStatusAction`（归一化 / no-op null / 矩阵外 422）+ `applyStatusTransition`（post-COMMIT 唯一通道 transitionVideoState / R-105-T2，失败 warn 留痕不抛）+ `planTargetStatus` / `applyGroupStatusTransitions`（编排下沉）+ `restoreTargetStatusBefore`（unmerge 还原）+ `SPLIT_INITIAL_STATE`（migration 016 DEFAULT 真源）
  - `apps/api/src/services/VideoMergesService.ts` — merge：BEGIN 前 plan（非法 422 快速失败）→ 将 apply 时 snapshot 写 `targetStatusBefore`（no-op 不写）→ COMMIT 后 apply → targetDetail 查询后置反映新状态；split：per-group resolve（current 恒 pending|internal）+ 组下标→新建 videoId 定位 + post-COMMIT 数组仅含携带组；unmerge：snapshot 含 before → COMMIT 后反查 current 还原（存量 audit 无字段不动 = 旧行为逐值一致）；audit afterJsonb 纯增量补 targetStatus / requestedStatuses + statusTransition（D-105-12）
  - `apps/api/src/services/VideoMergesService.schemas.ts` — `StatusSettingSchema`（双维 optional + 拒空对象）接入 MergeSchema / SplitSchema newVideoMeta
  - `apps/api/src/db/queries/video-merge-mutations.ts` — `fetchVideosByIds` SELECT +2 列（review_status / visibility_status）+ `RawVideoRow` 同步（D-105-11 还原依据 + BEGIN 前矩阵输入）
  - `tests/unit/api/video-merge-status-helpers.test.ts` — **新建（67 用例）**：矩阵 6×9=54 cell 全枚举定档（D-105-9 评审 R1 兑现，矩阵漂移即红）+ 归一化 4 + SPLIT_INITIAL_STATE 1 + applyStatusTransition 3 + restoreTargetStatusBefore 5
  - `tests/unit/api/video-merge-mutations.test.ts` — +18 用例（merge targetStatus 5：R-105-T1 逐值不变 / applied+snapshot 逐值+afterJsonb / skipped / failed 不回滚 / 422 BEGIN 前；split status 4；unmerge 还原 4 含无回路边界；zod 5）+ makeVideoRow 状态参数化 + videos.mutations/logger mock
- **新增依赖**：无
- **数据库变更**：无（零 migration；fetchVideosByIds 仅扩 SELECT 列）
- **注意事项**：
  - **偏离登记 (a)**：unmerge 还原复用单步矩阵——`approve_and_publish` / `reject` 的反向（如 approved|public → pending|internal 须先 unpublish 两步 / M-SN-4 D-01）无单步回路时如实 `statusTransition='failed'` 人工兜底（D-105-11 非原子声明覆盖；**两步还原须回 ADR 另行定档，本卡不发明协议**；dev 实测 + 单测固化该边界）。13-D2 前端提示文案需覆盖此场景。
  - **偏离登记 (b)**：VideoMergesService.ts 599→700 行（Baseline 豁免文件恶化 +101；helper 下沉已收敛 727→700；拆分归 MISC FILE-SIZE 跟踪卡）。
  - dev 真实库实测全绿：set_hidden applied→unmerge set_internal 还原 applied / approve_and_publish applied（post-COMMIT 序保证 sources 先转移过 trigger active-source 检查）→还原无回路 failed 边界实证 / 422 approved-target→rejected 整体不执行 / split 携带组 approved|internal + 未携带组 DEFAULT / 清理零残留。
  - 门禁：typecheck/lint EXIT=0 + verify:adr-contracts ✓ + test:changed 自动升全量 6488/6489（1 = perf p95 高负载 flaky，隔离复跑 36/36 过）。
  - e2e:video 已实跑：admin 段 4 passed / 5 failed —— **git stash 基线对照重跑失败列表逐字一致 = pre-existing 环境性失败**（publish-flow 3 个依赖 web :3000 而 PLAYWRIGHT_SERVERS=admin 不起 web 等），与本卡 diff 零交叉非回归；可信验证维持 SEQ 系列收口硬前置 ③。
  - 13-D2（前端控件 + 智能默认）的 `status-defaults.ts` 必须以本卡矩阵为唯一真源（R-105-T7 三层防线）。

## [CHG-VIR-13-D2] 状态设置前端控件 + 智能默认（SEQ-20260604-01 / 设计 §4.4 + §10.1 裁定 #1）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 20:40
- **执行模型**：claude-opus-4-8
- **子代理**：无（status-defaults 以 13-D1 矩阵为唯一真源，无新契约设计）
- **修改文件**：
  - `apps/server-next/src/lib/merge/status-defaults.ts` — **新建（165 行）**：`legalStatusOptions` 矩阵镜像（与 13-D1 后端覆盖矩阵双向逐 cell 一致性单测守护 / R-105-T7 第一层防线）+ `GENERIC_STATUS_OPTIONS`（current 不可知场景白名单组合）+ `SPLIT_STATUS_OPTIONS`（默认待审/直接通过/通过并公开，全 ∈ 矩阵 pending 行）+ `suggestMergeTargetStatus`（§4.4 六行规则表 first-match，rejected source 最高优先不升级；数据不足不猜测）+ `describeStatusTransition`（仅 failed 产 warn 提示）
  - `apps/server-next/src/app/admin/merge/_client/MergeStatusControl.tsx` — **新建（101 行）**：受控 select + 智能默认 hint；value=null = 保持不变（请求体零字段 / R-105-T1 前端侧）
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidateExpand.tsx` — 候选路径嵌入（D-105-7 字段齐备 → 矩阵镜像选项 + 智能默认预选，target 切换重算重置；legacy 降级 → GENERIC + 不建议）；`onMerge` 签名 +`targetStatus?`
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidatesSection.tsx` — handleMerge 透传 targetStatus + statusTransition failed 提示
  - `apps/server-next/src/app/admin/merge/_client/MergeWorkspace.tsx` — 工作区嵌入（成员 = PickerVideoItem 仅 isPublished → GENERIC 选项 + 受限 hint 不产建议值）+ 透传 + failed 提示
  - `apps/server-next/src/app/admin/merge/_client/SplitGroupMetaCard.tsx` — **新建（114 行）**：组 meta 编辑卡抽出（标题/类型/拆到已有 picker/新建状态控件；拆到已有组结构性无控件 = 只读 D-105-5）
  - `apps/server-next/src/app/admin/merge/_client/SplitWorkspace.tsx` — 消费 SplitGroupMetaCard（490→**433 行净改善 -57**）+ newVideoMeta.status 透传 + statusTransition 数组 failed 计数提示
  - `tests/unit/lib/merge-status-defaults.test.ts` — **新建（19 用例）**：矩阵镜像双向 6 态全枚举对照（直接 import 后端 resolveStatusAction，任意一侧漂移即红）+ SPLIT 选项可达性 + 规则表 8 + describeStatusTransition 2
  - `tests/unit/components/server-next/admin/merge/{MergeWorkspace,MergeCandidatesSection,merge-split-deeplink}.test.tsx` — +5 用例（透传/failed toast/智能默认预选/legacy keep 零字段/split 组 status）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - **偏离登记 (a)**：status-defaults 路径按设计稿 §4.4 真源 `lib/merge/`（卡面文件范围误写 `_client/`）。
  - **偏离登记 (b)**：`lib/merge/api.ts` 零改动——typed MergeParams/SplitGroup/Result 自动透传新字段，卡面预计需改实际不需。
  - **偏离登记 (c)**：实施中发现 §4.4 规则 2 单维建议值 `{reviewStatus:'approved'}` 与控件双维选项无法匹配预选（UI 显示「保持不变」但提交建议值的不一致）→ 修正为 approve 单步效果 `(approved, internal)` 双维（公开须运营显式选 approved|public，与设计「publish 需运营确认」一致）。
  - 门禁：typecheck/lint EXIT=0 + 既有 71 前端用例零破坏 + test:changed 增量 73/73。零端点零依赖零 admin-ui 触碰；e2e merge 页维持 SEQ 系列收口硬前置。

## [CHG-VIR-13-C1] identity decisions 列表 + revive 后端（SEQ-20260604-01 / ADR-179 D-179-1~6）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 21:25
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8 / a19744b07045b47e3)——ADR-179 契约 PASS 引用（13-ADR 阶段），本卡按契约实施，无新 spawn
- **修改文件**：
  - `packages/types/src/identity-decision.types.ts` — **新建**：`IdentityDecisionListRow`（decision 全列 + pair 摘要〔双侧 title + deleted 标注〕）+ `ListIdentityDecisionsParams/Result` + `ReviveCandidateResult`（reused 幂等标志）
  - `packages/types/src/index.ts` — re-export
  - `packages/types/src/admin-moderation.types.ts` + `apps/api/src/services/AuditLogService.ts` — actionType `'identity_candidate.revive'`（R-MID-1 第 32 次系统化；targetKind 复用 'identity_candidate' 零 CHECK 扩展 / D-179-5）
  - `apps/api/src/db/queries/identity-decision.ts` — +`listIdentityDecisions`（JOIN users/identity_candidate/双侧 videos，软删行 title 仍可取 + deleted 标注；排序 created_at DESC, id ASC 分页幂等 / D-179-1）+ `countIdentityDecisions` + `findActiveRejectedDecisionByCandidateId`（D-178-2 至多一条）；文件头 Pool/PoolClient 口径更新
  - `apps/api/src/services/IdentityCandidatesService.ts` — +`listDecisions`（camelCase 映射）+ `revive`（FOR UPDATE 校验全写入前 404/409×2 → 单事务复制原行新建 pending〔insertCandidate 既有 ON CONFLICT 范式复用 + revived_from 链 + trigger_source='manual-search' D-179-4〕+ **原行零修改** + 原 rejected decision 置 reverted；撞 pending unique → 重查幂等 reused:true 且不置 reverted / D-179-3）+ COMMIT 后 audit + `ReviveCandidateSchema` / `ListIdentityDecisionsSchema`（strict + reverted transform）
  - `apps/api/src/routes/admin/identity-candidates.ts` — +`POST /admin/identity-candidates/:id/revive` + `GET /admin/identity-decisions`（D-179-6 同域归属；admin only）
  - `tests/unit/api/identity-decisions-revive.test.ts` — **新建（13 用例）**：revive 7（happy 逐值含 audit payload R-MID-1 / 404 / 非 rejected 409 / pair 软删 409 / 幂等不置 reverted / 防御分支 / ROLLBACK 不写 audit）+ listDecisions 3 + zod 3
  - `tests/unit/api/audit-log-coverage.test.ts` — REQUIRED_ACTION_TYPES + PAYLOAD_ASSERTION_REQUIRED 各 +1（守卫同步）
- **新增依赖**：无
- **数据库变更**：无（零 migration：trigger_source 复用 'manual-search'〔D-179-4〕、targetKind 088 已入 CHECK、action_type 列无 CHECK）
- **注意事项**：
  - **正向偏离**：卡面预计 `identity-candidate.ts` 需扩 query——实际零改动（insertCandidate / findPendingByPairKey 既有函数全覆盖 revive 需求）。
  - dev 真实库实测全绿：happy（新行 pending+链+manual-search+evidence 复制 / 原行保持 rejected / decision reverted 三列置位）→ 幂等（撞 unique reused=true 同 id 返回）→ 409 非 rejected → 409 pair 软删 → list 过滤（candidateId + reverted=false 滤已撤销行）→ audit afterJsonb 逐值 → 清理零残留。
  - 门禁：typecheck/lint EXIT=0 + `verify:endpoint-adr` ✓ 207 路由（2 新路径对齐 ADR-179 契约表）+ verify:adr-contracts ✓ + 全量 **6526/6528**——首轮全量暴露 `audit-log-service-enums-set-equal` 真回归（actionType **第 4 处**真源副本镜像未同步，前 3 处已同步守卫未覆盖该文件）→ 已修；其余 2 失败（StagingEditPanel / data-table-auto-filter）隔离复跑 36/36 全过 = 既见 jsdom 并发 flaky 与本卡无关。
  - 13-C2 消费提示：list 响应 `reused`/`revertedAt` 已就绪供决策记录子视图 + 行内 revive 操作；前端 api client 留 13-C2。

## [CHG-VIR-13-C2] 操作记录增强 + 决策记录 + 行内撤销（SEQ-20260604-01 / D-105-8 + ADR-179 消费）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 21:50
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8 / a19744b07045b47e3)——D-105-8 契约 PASS 引用（13-ADR 阶段），本卡按契约实施，无新 spawn
- **修改文件**：
  - `packages/types/src/video-merge.types.ts` — `MergeAuditRow` +4 optional（actorType / relatedCandidateIds / relatedDecisionIds / videoTitlesSnapshot；R-105-T4 旧消费方零破坏）
  - `apps/api/src/db/queries/video-merge-mutations.ts` — `listAuditTimeline` +snapshot videos SQL 内 jsonb 投影（`jsonb_typeof` 防御非数组）+ `fetchVideoTitles`（target 实时轻量查）
  - `apps/api/src/db/queries/identity-decision.ts` — `findDecisionsByAuditIds`（页内单 SQL ANY 零 N+1；Y-105-T3 dev EXPLAIN 实证走 `idx_identity_decision_audit` partial 索引）
  - `apps/api/src/services/VideoMergesService.ts` — listAudit 页内批量派生（actorType 无 decision 恒 'human'；source 标题 snapshot 投影 / target 实时 / 缺失兜底「(已删除视频)」）
  - `apps/server-next/src/lib/identity/api.ts` — +`listIdentityDecisions` / `reviveIdentityCandidate`（ADR-179 两端点 client）
  - `apps/server-next/.../merge/_client/MergeAuditSection.tsx` — auto/manual 列 + 行展开明细（前后形态/关联候选/reverted）+ 行内撤销（展开区 reason 输入；statusTransition failed 联动提示 / D-105-11）
  - `apps/server-next/.../merge/_client/MergeDecisionsSection.tsx` — **新建（186 行）**：decision badge + pair 摘要（软删标注）+ rejected 复活（reused 幂等差异化提示）+ 过滤/分页
  - `apps/server-next/.../merge/_client/MergeClient.tsx` — records mode 内层 Segment 双子视图（操作时间线/决策记录）
  - `tests/unit/api/merge-audit-derive.test.ts` — **新建（4 用例）**：actorType 双分支 + 零 N+1 单次 ANY 断言 / 三级标题兜底 / 老 snapshot null / R-105-T4 逐值+透传不变
  - `tests/unit/components/server-next/admin/merge/MergeRecordsSections.test.tsx` — **新建（7 用例）**：actor 列 / 展开明细 / 行内撤销 / 已撤销无控件 / decisions 渲染+软删标注 / revive+reused / 三态无复活按钮
- **新增依赖**：无
- **数据库变更**：无（零 migration；listAuditTimeline 仅扩 SELECT 投影）
- **注意事项**：
  - 行内撤销 reason 以展开区内联输入实现（设计 §10.2 #5「reason 弹窗」轻量等价，零新 Modal 依赖）。
  - records 双子视图内联 MergeClient（255 行 <500，未另建容器文件）。
  - dev 实证：EXPLAIN Bitmap Index Scan on idx_identity_decision_audit（Y-105-T3）+ snapshot 投影注入往返 ROLLBACK 零残留。
  - 门禁：typecheck/lint/verify:adr-contracts EXIT=0 + 前端 merge 域 83/83（既有 76 零破坏）。
  - SEQ-20260604-01 全部业务卡完结，仅剩 13-I18N（haiku 文案抽离）+ 系列收口 e2e 硬前置。

## [CHG-VIR-13-I18N] merge 工作台硬编码文案抽离（SEQ-20260604-01 / 系列末卡）
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 21:58
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/i18n/messages/zh-CN/audit-action-labels.ts` — 补缺 `identity_candidate.reject`（CHG-VIR-9-B pre-existing 欠账）+ `identity_candidate.revive`（13-C1 维护约定兑现）；头注释写死计数改同步维护表述
  - `apps/server-next/src/i18n/messages/zh-CN/merge.ts` — **新建**：MERGE_M 字典（moderation.ts `M` 同范式零框架）——statusPair 6 / statusControl 7 / statusHints 4 / statusTransition 1 / records 11 共 29 项语义文案集中
  - `apps/server-next/src/lib/merge/status-defaults.ts` + `_client/{MergeStatusControl,SplitGroupMetaCard,MergeClient,MergeAuditSection,MergeDecisionsSection}` — 六消费方接线（文案值逐字不变）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - **偏离登记**：组件一次性文案（placeholder/按钮/confirm）保留内联（CHG-VSR-6 先例；验收按「语义性文案集中化」口径落地，待 next-intl 接入统一迁 JSON）。
  - 文案值逐字不变 → 既有测试零改动零破坏（merge 域 + status-defaults 102/102）。
  - **SEQ-20260604-01 全部 13 卡完结**；系列收口 e2e 硬前置（SEQ 头部 ①②③）接续执行。

## [CHG-VIR-13-CLOSE-FIX] 系列收口 ①：web-next client bundle 编译破坏修复 + player 域 e2e 实跑归因
- **完成时间**：2026-06-04
- **记录时间**：2026-06-04 23:15
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/web-next/src/lib/short-id.ts` — **新建**：`extractShortId` 纯函数自 video-detail.ts 抽出（client/server 双侧安全）
  - `apps/web-next/src/lib/video-detail.ts` — 本地定义 → import + re-export（server 侧既有 import 零破坏）
  - `apps/web-next/src/components/player/PlayerShell.tsx` + `src/components/video/VideoDetailClient.tsx` — import 改址 `@/lib/short-id`
  - `tests/unit/web-next/player-shell-{hydration,on-error}.test.tsx` — vi.mock 路径同步；`tests/unit/api/videos.test.ts` — import 对齐真源
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - **根因**：PlayerShell（'use client'）value-import `extractShortId` ← video-detail.ts（顶层 `import { cookies, headers } from 'next/headers'`）→ server-only 模块进 client bundle → 干净环境自起 webServer 编译失败。自 M3-PLAYER-02 时代潜伏；外部热 :3000 server（Jun 4 00:28 旧编译产物）长期掩盖 = **13-PLAY 当时 e2e 38 failed 含 smoke 全挂的真正根因**。
  - **player 域 e2e 实跑终值**（修复后 + API server 手动起）：smoke 2/2 绿 + 6 passed/1 flaky-passed；31 failed 逐层归因 = pre-existing e2e 数据基建欠账——(a) playwright webServer 无 api 条目 (b) dev DB 零 seed（home_modules 0 行 → 首页 main 恒空；player.spec fixture slug `test-movie-aB3kR9x1` 等 videos 表 0 行）。本系列对 web-next 仅本 FIX（语义逐字不变，34 单测过）+ types 加性 = 零回归。
  - **follow-up 建议立卡 CHG-E2E-SEED**：web 域 e2e seed 基建（home_modules + fixture videos seed 脚本 + playwright api webServer 条目评估）。
  - 门禁：web-next tsc EXIT=0 + 受影响单测 34/34 + 负载性 4 文件隔离复跑 37/37 + lint EXIT=0。

## [CHG-VIR-13-FIX-LAYOUT] merge 工作台表格容器截断修复（用户 bug 报告）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 23:30
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/merge/_client/MergeClient.tsx` — PAGE_STYLE 去 `height:100%` 钉死 + AdminCard 改 `padding="none"` 自然高度（去 flex:1/minHeight/display:flex）+ 内容 div 去 flex/overflow——滚动归 shell main（既有 overflow:auto）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - **根因**（playwright 逐层测量定位）：13-WS 引入的 AdminCard flex 误用——AdminCard DOM = `root(flex col, overflow:hidden)` > `[data-admin-card-body]`（普通块、高度 auto）> children；MergeClient 把 flex 语义设在 root 而内容 div 是 body 孙级，**body wrapper 断开 flex 约束链** → 内容 div 被撑至 1432px → root 648px hidden 裁切 = 表格截断且不可滚。
  - 修复后实测：MAIN 747/1614 正常滚动、30 组 mock 末行可达、分页 foot 完整；视觉副效应 = 消除原 AdminCard 默认 padding(14px) 与内层 16px 的冗余叠加。
  - **共享组件提示**：AdminCard 当前结构不支持「children 内滚」骨架（body wrapper 无 flex 透传）——后续若有同类需求应扩展 AdminCard（如 `bodyFlex` prop）经设计评审，勿在消费方重复此误用。
  - 门禁：merge 域单测 83/83 零破坏 + server-next tsc EXIT=0 + e2e merge-deeplink 6/6 + lint EXIT=0。

## [CHG-VIR-13-FIX-PREFILL] 深链成员预填恒走「加载失败」兜底修复（用户 bug 报告）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 23:45
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/videos/picker-fetcher.ts` — +`fetchPickerItemByIdSafe(id)`（`GET /admin/videos/:id` 精确查 + VideoAdminDetail→PickerVideoItem 映射；失败 null 调用方占位兜底）
  - `apps/server-next/.../merge/_client/MergeWorkspace.tsx` — 深链 ids 预填改 by-id（去 AbortController——apiClient 无 signal，cancelled flag 丢结果保留）
  - `apps/server-next/.../merge/_client/SplitWorkspace.tsx` — 深链标题充实改 by-id
  - `tests/.../MergeWorkspace.test.tsx` — api mock +getVideo（by-id 命中返回/未命中 reject = 真实契约形态）
  - `tests/.../merge-split-deeplink.test.tsx` — picker-fetcher mock 工厂 +fetchPickerItemByIdSafe
  - `tests/e2e/admin/merge/merge-deeplink.spec.ts` — route +by-id 精确 mock + 用例 2 增「标题充实非『加载失败』」断言
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - **根因**：13-WS 预填 `videoPickerFetcher({ q: uuid })`——后端 listVideos 的 q 仅匹配 `title/title_en/title_original/short_id ILIKE`（videos.ts:300），**UUID 恒 0 结果** → 全部深链预填路径（候选转工作区 / 视频库批量 / 审核台 batch / candidate_a+b / SplitWorkspace 标题充实）自上线起恒走「(加载失败，请确认 id)」占位。
  - **测试教训**：原单测/e2e 的 mock fetcher 按 `q===id` 返回，掩盖真实契约不匹配——本次 mock 全部对齐真实契约（搜索 mock 不再按 uuid 命中；by-id 单独 mock）+ e2e 增反占位断言。
  - 门禁：merge 域单测全过 + e2e deeplink 6/6 + server-next tsc EXIT=0 + lint EXIT=0。

## [CHG-VIR-14-SCORE-UI] merge 工作台重合度（legacyScore）UI 退役 + 「身份分」全消费点改名「相似度」（用户裁定）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 00:10
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidatesSection.tsx` — 移除「重合度」列（id: 'score'）+ sort 白名单守卫去 score + SCORE_BADGE_STYLE 死码清理
  - `apps/server-next/src/app/admin/merge/_client/MergeCandidateExpand.tsx` — 移除置信度 pill（confidence-pill + CONFIDENCE_PILL_STYLE）；identity-pill 文案「身份分」→「相似度」
  - `apps/server-next/src/app/admin/merge/_client/EvidencePanel.tsx` — 「身份分取最弱链接」+ 逐对明细文案 →「相似度」
  - `apps/server-next/src/app/admin/merge/_client/MergeDecisionsSection.tsx` — 决策记录表头「身份分」→「相似度」
  - `apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar.tsx` — 审核台相似 Tab pill「身份分」→「相似度」
  - `tests/unit/components/server-next/admin/merge/MergeClient.test.tsx` — MERGE-2 改反向断言（confidence-pill 不渲染 + 候选行 85.0% 不再出现）
  - `tests/unit/components/server-next/admin/merge/MergeCandidatesSection.test.tsx` — it 名文案对齐
  - `tests/unit/components/server-next/admin/moderation/TabSimilar.test.tsx` — 断言「身份分 87%」→「相似度 87%」
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - **背景**（用户会话内审计裁定）：identity 默认来源下 `identity_candidate.legacy_score` 全 NULL（唯一写入点 pairScoringPersist.ts:152 硬编码 null，dev 实测 239 行全空）→ buildGroupFromCluster `min(legacy_score ?? 0)` = 0 → 「重合度」列 + 「置信度」pill 恒 0% 误导审核员。本卡为重合度退役三步走**第 1 步（仅 UI 展示层）**。
  - **不动**：API 契约（CandidateGroup.score 字段保留）/ minScore 参数与 legacy 模式控件 / legacy 降级链路（identity 空表自动落回）/ `identity_candidate.legacy_score` DB 列 / source toggle。**完整退役（第 3 步）须起 ADR-105/105a AMENDMENT**：移除 legacy 评分路径 + computeOverlapScore + minScore + legacy_score 死列，受 Y-105a-1 黄线约束需 Opus 评审，另案排卡。
  - identityScore 代码字段名不改，仅中文展示文案统一为「相似度」。
  - 门禁：merge+TabSimilar 单测 93/93 + test:changed 71/71 + typecheck/lint EXIT=0 + e2e merge-deeplink 6/6。

## [CHG-MERGE-DEDUP-ADR] merge/split 线路自动去重取并集 ADR（R-105-1 策略修订 / 用户裁定）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8 / ad842ae68cf0872db)——第 1 轮 CONDITIONAL → Y-105-D3/D4 吸收转 PASS
- **修改文件**：
  - `docs/decisions.md` — ADR-105 AMENDMENT 2026-06-05（D-105-13~16 + R-105-D1~D5 + Y-105-D1~D4）
- **新增依赖**：无 / **数据库变更**：无（零 migration——去重纯软删 + snapshot 自由字段）
- **注意事项**：
  - 用户裁定废止 R-105-1 方案 A：重复 (episode_number, source_url) 不再 409，合并取并集（事务内确定性去重软删：target 恒胜 > sourceVideoIds 序首胜）。
  - unmerge 对称：snapshot.dedupedSourceIds 驱动「先归还后复活 deleted_at」（顺序避免瞬时撞键——评审确认）。
  - 评审唯一条件（pre-existing 盲点）：target 已软删行仍占唯一键槽位 → Y-105-D3 防御性残余预检（命中 409 明确文案，零物理删除）。
  - 实施 = CHG-MERGE-DEDUP-EP（query 去重 SQL + Service 三流程 + types dedupedCount + 前端信号语义 + 测试 + dev 实测）。

## [CHG-MERGE-DEDUP-EP] merge/split 线路自动去重取并集实施（D-105-13~16）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 00:45
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8 / ad842ae68cf0872db)——ADR 阶段 PASS 引用，本卡按契约实施
- **修改文件**：
  - `apps/api/src/db/queries/video-merge-mutations.ts` — +6 函数：`dedupeSourcesForMerge`（窗口函数单 SQL：PARTITION BY (ep,url) + target 恒胜 → sourceVideoIds array_position 序 → id tiebreak，rn>1 软删 RETURNING）/ `detectResidualTargetConflicts`（Y-105-D3：幸存行 vs target 含软删占槽位）/ `dedupeSourcesForSplitTarget` + `detectResidualSplitTargetConflicts`（split 对称）/ `restoreSourcesByIds` / `setAuditDedupedSourceIds`；**删除** detectMergeConflicts / detectSplitConflictsForTarget（方案 A 废止死代码）
  - `apps/api/src/services/VideoMergesService.ts` — merge：BEGIN 前预检 409 删除 → 事务内去重（转移前 / Y-105-D4）→ 残余预检 409（「历史软删线路」明确文案）→ snapshot 补 dedupedSourceIds → 响应 dedupedCount；unmerge 双分支 reassign 后 `restoreSourcesByIds`（先归还后复活避免瞬时撞键）；split existing 组 assign 前去重 + 残余预检
  - `apps/api/src/services/VideoMergesService.split-helpers.ts` — D-105-3 预检 409 删除（去重移事务内）
  - `packages/types/src/video-merge.types.ts` — Merge/SplitResult +`dedupedCount?`（R-105-D4 纯增量）
  - `apps/server-next/.../StructurePreview.tsx` — 同站同名信号 danger「409 预警」→ info「合并时自动去重（线路取并集）」
  - `apps/server-next/.../{MergeCandidatesSection,MergeWorkspace,SplitWorkspace}.tsx` — 成功 toast 拼「自动去重 N 条重复线路」
  - 测试：video-merge-mutations.test（预检用例重写为去重语义 + 时序断言〔dedupe < transfer / dedupe < assign invocationCallOrder〕+ 残余 409 ×2 + unmerge 复活 describe ×3）/ confirm-decision.test + merge-audit-derive.test（mock 工厂同步）/ MergeComparePreview.test（信号 info 断言）/ integration admin-video-merges.test（SQL 跑通迁移新函数）
- **新增依赖**：无 / **数据库变更**：无（纯软删 + snapshot 自由字段）
- **注意事项**：
  - **dev 实测全绿**：三方两两重复（T:ep1,ep2 / A:ep1*,ep3,ep5 / B:ep2*,ep4,ep5*）→ merge dedupedCount=3、target 并集 5 活源、snapshot.dedupedSourceIds={a1,b2,b5}（**target 恒胜 + A 序首胜 b5 被删实证**）→ unmerge 三方源数逐值还原 A=3/B=3/T=2 → Y-105-D3 残余软删 409 + ROLLBACK（去重软删一并回滚，A 活源仍 3）。
  - 实测发现：`video_sources.episode_number` 现 schema **NOT NULL**（NULL 重复场景实际不存在；`IS NOT DISTINCT FROM` 口径无害保留为防御 + 与唯一键 NULLS NOT DISTINCT 一致）。
  - 门禁：typecheck/lint/verify:adr-contracts EXIT=0 + merge 域 API 209/209 + 前端 102/102 + 全量 6542/6543（1=StagingEditPanel 既见 jsdom flaky 隔离 12/12 过）+ e2e merge-deeplink 6/6。
  - **Codex stop-time review FIX（D-105-16 预览契约兑现）**：detect 预检函数物理删除后「预览信息源 + 将自动去重 N 条」缺口 → combineMatrices 增 (episodeNumber, sourceUrl) 精确重复计数信号（与后端 dedupeSourcesForMerge PARTITION 同口径预演，零新端点），同站同名信号拆分为「归并显示」提示（URL 不同不去重，语义精确化）；split 侧 target sources 前端未拉取，预览不产 N 以执行后 dedupedCount 兑现——形态澄清登记 AMENDMENT D-N 偏离节。测试 6→6a/6b 拆分 + 用例 11 随更（前端 84/84）。

## [CHG-VIR-15-UX-A/B/C] merge 候选页 7 项 UX 重构（用户裁定，三卡）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05
- **执行模型**：claude-opus-4-8｜子代理：无（纯 UI 展示层，零共享组件 API / 零 schema / 零 API 契约变更）
- **修改文件**：
  - `MergeCandidatesSection.tsx`（A）— 来源 Segment toggle 退役（请求固定 identity，空表降级 legacy 链路保留；minScore 控件仅降级态显示）；+来源列（行级 `g.identity` 有无 → 多证据/实时聚合 chip）/ +相似度列（identityScore%，legacy '—'）/ +操作列（快捷合并〔推荐 target + confirm〕+ 快捷拒绝；stopPropagation 不触发行展开）
  - `MergeComparePanel.tsx`（B）— 列等宽（tableLayout fixed + colgroup；字段列 110px，视频列 minWidth 200 撑横滚）；target 绿背景 → 整列绿色边框（头顶边+侧边+末行底边）；值全同行背景 --bg-subtle 标示（per-field valueKey）；新增「线路 · 播放」行：每视频列自己的线路+▶En（归属一目了然）+ 列内嵌 AdminPlayer（key=sourceId remount，多列同播对比画面）+ 展开/收起 toggle
  - `MergeCandidateExpand.tsx`（B）— 线路惰性拉取（getVideoMatrix ×N，收起清数据）+ 结构信号 combineMatrices 零请求推导注入；EXPAND_PANEL_STYLE borderBottom 2px 强分隔（⑥）
  - `MergeResultPreview.tsx`（B）— merge 形态内嵌 StructurePreview 退役 → optional `signals` 注入渲染（tone 配色对齐既有口径）；StructurePreview 本体保留（MergeWorkspace 深链消费）
  - `MergeClient.tsx`（C）— Segment 常驻 3 区：「待审候选」更名「合并工作区」顶替旧 merge tab；mode=merge 保留**深链专用通道**（视频库/审核台 5+1 处 ?ids=/?candidate_a= 入口零破坏），深链激活时动态补「批量合并（深链）」项
- **测试**：Section 用例 2 → 2a/2b/2c 重写；ComparePanel 11 系重写（注入契约/列内播放器装载关闭/idle-loading 态/signals；stale 守卫 11b/c/d 改测 StructurePreview 本体）；MergeClient 3 区断言 + 深链动态项用例；e2e merge-deeplink 用例 1/3 更新。merge 前端 89/89 + e2e 6/6 + tsc/lint/test:changed EXIT=0
- **注意事项**：
  - 来源列行级真源 = `g.identity` 有无（单查询内 identity 行有评分、降级 legacy 全表无）——未做双来源混合查询（identity 召回面 ≥ legacy 高度重叠，混合徒增重复组与分页复杂度）。
  - AdminPlayer 跨模块导入第 2 消费方（PlayPreviewDrawer 先例）；第 3 消费方出现时按规则上提共享层。
  - PlayPreviewDrawer + StructurePreview 保留：SplitWorkspace / MergeWorkspace（深链）继续消费。
  - **Codex stop-time review FIX（来源列误标）**：legacy 分支也实时填 identity 评分（CHG-VIR-7 scoreGroup）——按 row.identity 有无判定会把降级行全表误标「多证据」→ 来源列真源改服务端回显 effectiveSource（单查询单来源，回显即行级真值）；相似度列与来源标签解耦保留评分显示；2a-fix 用例对齐真实契约防回归（90/90）。

## [CHG-VIR-16-TBL-ADR] ADR-105a AMENDMENT 2026-06-05 — 合并工作区表格组级检索（D-105a-19）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05
- **执行模型**：claude-opus-4-8｜子代理：arch-reviewer (claude-opus-4-8 / agentId adddab18b4cd502e8)
- **修改文件**：
  - `docs/decisions.md` — ADR-105a 章节追加 AMENDMENT 2026-06-05（CHG-VIR-16-TBL-ADR）：D-105a-19 有界全量轻列折叠取代页内折叠（supersede D-105a-18 折叠范围与行序条款，遗留 ② 再评估点触发）
  - `docs/tasks.md` — 任务卡流转
- **决策要点**：
  - 触发 = 用户裁定合并工作区表格三项 UX（相似度排序 / 相似度 + 候选数筛选 / 标题搜索框）；「候选数」组级语义在 pair 级分页 + 页内折叠下结构性不可实现
  - 端点契约纯增量：`GET /admin/video-merges/candidates` query +5 参数（sortField 扩 identityScore / identityScoreMin·Max / videoCountMin·Max / q）+ envelope optional `truncated`；**total 语义（identity 路径）pair 数 → 过滤后组数**（跨页拆行近似随之消除）
  - 五阶段管线：轻列全量（cap+1 探测）→ 全局 union-find（collapsePairs 泛型化 `PairCluster<T>`）→ 组级谓词（q 双口径：title lower contains 为主 + normalizeMergeKey(q)/title_normalized 辅召回）→ 组级排序（缺省 identityScore DESC + clusterKey tiebreak）→ 组级分页切片 + per-page full 行回查重建
  - cap = MAX_COLLAPSE_PAIRS 2000 + **截断态组完整性防御（红线 R-1 方案 (b)）**：界内 video 集合补查全部 pending pair 有界迭代至闭包（轮次 ≤3 / 累计 ≤3×cap 守卫）
  - 降级判定收窄：轻列全量空才降级 legacy，**筛选空不降级**（9-C FIX-2 同型漂移预防）；legacy 路径页内过滤近似登记（与 FIX-2 正交，Y-5）
- **评审**：arch-reviewer PASS-with-conditions → R-1（截断组完整性）/ R-2（测试影响面登记：identity-source-switch / identity-collapse-pairs / identity-candidate-queries 三文件随 BE 卡改写）回写 + Y-1~Y-5（meta 查询 media_catalog join 归属 / q 双口径 / 排序「同向非逐行等价」措辞收紧 / 泛型化实现口径锁定 / FIX-2 正交声明）全吸收
- **测试**：纯文档零业务代码；`npm run verify:adr-contracts` EXIT=0（D-105a-19 未闭环为预期，随 CHG-VIR-16-TBL-BE 实施闭环）
- **注意事项**：解阻 CHG-VIR-16-TBL-BE（后端落地）→ CHG-VIR-16-TBL-FE（前端接线）

## [CHG-VIR-16-TBL-BE] merge 合并工作区表格组级检索后端落地（D-105a-19 实施闭环）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05
- **执行模型**：claude-opus-4-8｜子代理：无（ADR 阶段 arch-reviewer adddab18b4cd502e8 PASS 引用，实施忠实落地）
- **修改文件**：
  - `packages/types/src/video-merge.types.ts` — ListCandidatesParams +5（sortField 扩 identityScore / identityScoreMin·Max / videoCountMin·Max / q）+ ListCandidatesResult +truncated（纯增量 optional）
  - `apps/api/src/services/VideoMergesService.schemas.ts` — ListCandidatesSchema zod 扩展 + 双 refine（min>max → 422，显式拒绝优于静默交换）
  - `apps/api/src/db/queries/identity-candidate.pairs.ts`（新）— ⑧ 段自 identity-candidate.ts 拆出（516>500 行硬限，sources-matrix 拆分先例；re-export 保持 import 路径零迁移）+ D-105a-19 三新 query：listPendingCandidatePairsLight（轻列全量 cap+1 探测，无 evidence 重列）/ listPendingPairsLightByVideoIds（R-1 闭包补全）/ listPendingPairsByIds（stage 5 页分量完整行回查，pending 守卫并发裁定脱落）
  - `apps/api/src/services/identity/collapsePairsToGroups.ts` — collapsePairs 泛型化 `PairCluster<T extends PairEdge>`（评审 Y-4 口径：出参 pairs 保留入参元素类型，buildGroupFromCluster 零破坏；default = PendingCandidatePairRow）
  - `apps/api/src/services/identity/groupFilters.ts`（新 137 行）— 双路径共用纯函数：groupMatchesFilters（区间 AND q）/ titleMatchesQuery（Y-2 双口径：title lower contains 为主 + normalizeMergeKey(q)/title_normalized 辅召回〔剥标点保词间空格，ADR-174 R1 实证修正表述〕）/ sortIdentityClusterEntries（白名单 + clusterKey tiebreak）/ clusterTitles
  - `apps/api/src/services/VideoMergesService.ts` — listIdentityCandidates 五阶段管线重写（轻列全量 → 全局 union-find → 组级谓词〔meta 仅 q/title/year 排序激活时拉取〕→ 组级排序 → 分页切片 + per-page 完整行回查重建）+ completeClusterClosure（R-1 方案 b：闭包迭代 ≤3 轮 / ≤3×cap 守卫）+ legacy 路径共用谓词过滤 + identityScore 排序 case；total = 过滤后组数；降级判定收窄（轻列空才降级，筛选空不降级）；listPendingCandidatePairs/count 列表路径退役
  - `apps/api/src/db/queries/video-merge-candidates.ts` — fetchVideoMetaLight（videos JOIN media_catalog 轻元数据，评审 Y-1 归属修正：title_normalized/year 在 media_catalog）
- **偏离登记**：任务卡文件范围外 +2 文件——video-merge-candidates.ts（fetchVideoMetaLight 归属 videos 域查询文件，架构正确性优先于卡面范围）/ identity-candidate.pairs.ts（500 行红线强制拆分，identity-candidate.ts 439→516 为本卡引入，拆后 401+141）
- **测试**：R-2 登记三文件改写——identity-source-switch.test.ts 重写（16 用例：轻列管线 mock / total=组数 / 排序×2 / 区间筛选×2 / q 命中+不降级 / **cap 截断+闭包补全**〔2001 行探测 truncated + 桥接 pair 补全后 videoCount 可信 + candidateIds 不漏〕）/ identity-candidate-queries.test.ts +3 describe（轻列无重列断言 / ANY 双侧 / pending 守卫 + 空集短路）/ identity-collapse-pairs.test.ts +泛型轻列行用例（Y-4 验证）；新增 identity-group-filters.test.ts（13 用例：双口径 q / 区间边界 / 排序白名单回落 / 组代表 meta）。改动域 55/55 + merge API 域 200/200 + **test:changed 自动升全量 491 files 6573/6573 passed 零失败**（types 包改动触发，ADR-180）
- **门禁**：typecheck/lint EXIT=0；verify-file-size-budget 新违规清零（identity-candidate.ts 拆分收口）
- **dev 实测（只读临时脚本，验后删除）**：缺省 identity total=99 组 + identityScore DESC 有序 ✓ / ASC 有序 ✓ / videoCount DESC（8/6/5）+ videoCountMin=3 → 24 组全部 ≥3 ✓ / score∈[0.8,0.95] → 29 组全在区间 ✓ / q=「关于」命中 1 组（样本组在内）✓ / q 无命中 total=0 **source=identity 不降级** ✓ / 同参数幂等 ✓ / 越界页空 data 保持 identity ✓
- **注意事项**：D-105a-19 实施闭环；解阻 CHG-VIR-16-TBL-FE（前端列 sort/filter + toolbar 搜索接线）。零 migration 零新端点（query 参数扩展不触发 verify:endpoint-adr）。

## [CHG-VIR-16-TBL-FE] merge 合并工作区表格组级检索前端接线（相似度排序 + 相似度/候选数筛选 + 搜索框）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05
- **执行模型**：claude-opus-4-8｜子代理：无（按 ADR-105a AMENDMENT 前端接线契约落地）
- **修改文件**：
  - `MergeCandidatesSection.tsx`（546→456 行）— 相似度列 enableSorting + number range filter（accessor 改百分比口径与 cell 显示一致）/ 候选数列 number range filter / 作品列 text filter 复用 q 通道（遗留 ③ / VideoColumns title 先例）/ filters 真 state 接通（query + onQueryChange patch + commit 翻页重置）/ sort 白名单守卫扩 identityScore / total 文案统一「共 N 组」（D-105a-19 组数语义）/ truncated 警示条 / 筛选空结果保持 DataTable 渲染（emptyState prop，整页 EmptyState 仅无检索条件时）
  - `MergeCandidatesFilters.tsx`（新 112 行，500 行红线拆出）— buildCandidateSearchParams 纯函数（相似度 % → 0..1 clamp / 候选数整数 ≥2 / min>max 前端交换规范化防 zod 422 砸表格）+ MergeSearchInput（**复用共享原语 DataTableSearchInput**〔D-149-8 IME composition + debounce + Enter〕，本层仅 filters Map read-modify-write 适配不丢并发列筛选；自建 AdminInput 防抖版经评估废弃——缺 IME 处理）
  - `lib/merge/api.ts` — listCandidates 序列化 +5 参数（identityScoreMin/Max / videoCountMin/Max / q）
- **测试**：MergeCandidatesSection.test +7（10a 排序透传 / 10b % 区间 ÷100 映射 + page 重置 / 10c 候选数 min / 10d 搜索防抖 + 清空不发送 / 10e 「共 N 组」+ 反断言「对候选」/ 10f truncated 警示 / 10g 筛选空保持 DataTable + 表内空态）；MergeCandidatesFilters.test 新建 7 用例（纯函数：clamp / 交换 / 整数化 / q / 联合）。merge 前端域 **104/104** + test:changed 85/85 + typecheck/lint EXIT=0 + budget 零新违规 + **e2e merge-deeplink 6/6**
- **注意事项**：
  - 筛选 UI 锚点 = DataTable 列头菜单 AutoFilter（`th-menu-trigger-*` / number-min·max / apply），零自建筛选控件
  - 共享层沉淀评估：getRange/getTextValue 局部 helper 第 2 处出现（VideoFilterFields 先例），第 3 处时按规则上提共享层
  - truncated 警示文案不内嵌 cap 数值（避免与后端 MAX_COLLAPSE_PAIRS 漂移）
  - **CHG-VIR-16-TBL 系列（ADR/BE/FE 三卡）收口**：用户裁定三项 UX 全量交付

## [CHG-VIR-16-TBL-FIX] route 层 truncated 透传修复（Codex stop-time review）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05
- **执行模型**：claude-opus-4-8｜子代理：无
- **根因**：`GET /admin/video-merges/candidates` route 手工构造响应对象（data/total/page/limit/source 逐字段拼装），D-105a-19 新增的 `truncated` 字段被丢弃——前端截断警示条永不显示。与 CHG-VIR-9-C FIX「source 丢字段」**同型缺口复发**（Service/前端两侧单测各自 mock 对侧，route 重组层无人断言）。
- **修改文件**：
  - `apps/api/src/routes/admin/video-merges.ts` — truncated 条件透传（undefined 不携带键，对齐 envelope optional 语义）
  - `tests/unit/api/video-merges-candidates-route.test.ts` — +2 用例（#3 truncated=true 透传 + D-105a-19 检索参数 coerce 解析透传断言 / #4 非截断态不携带 truncated 键）
- **测试**：route 4/4 + test:changed 4/4 + typecheck/lint EXIT=0
- **注意事项**：该 route 已两次因「手工拼装响应丢新增字段」返工；后续 envelope 再扩字段时优先考虑整对象透传或在 route 测试先行加字段断言。

## [CHG-VIR-17-PARTIAL] 候选组部分合并（选定视频子集就地合并 / D-105a-18 遗留 ① 兑现）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05
- **执行模型**：claude-opus-4-8｜子代理：无（消费既有后端契约，纯前端交互层；零 schema/API/migration/ADR）
- **算法复核结论（dev 实证先行）**：
  - 用户案例实查：地灵曲跨季 4 pair 全带 `season_mismatch` 强负（2017 第一季×2 / 2019 第二季×2，双非 null veto 正确触发）；危险关系同名 6 视频全 pair 带 `year_far_no_exact`/`type_incompatible` 强负——**算法行为符合设计**（D-105a-3：强负仅 veto auto-merge，pending 候选保留供人工裁定）
  - 交互缺口真因 = collapsePairs 把强负 pair 边当连通边 →「确定不同」的视频连进同一分量 → 整组合并语义失效
  - 后端**已天然支持部分合并**：`validateForMerge` 校验 pair 两端 ⊆ 合并集合（D-178-3）+ `candidateIds` optional——零后端改动
  - **follow-up 登记（需用户裁定后另起 ADR 卡）**：「强负 pair 边不参与 union-find 连通」可让地灵曲自动分成两组（强负边仍展示证据），但改变候选组织语义（强负误判时真同组被拆散为多行），须 arch-reviewer 评审
- **修改文件**：
  - `MergeComparePanel.tsx`（474→315 行）— +optional `selectedIds`/`onSelectedChange`（列头 checkbox + 排除列整列灰化 + 排除列 target radio disabled + 列头点击选 target 跳过排除列）；500 行硬限拆出 `MergeComparePanel.styles.ts`（105 行样式常量，column-matrix-menu.styles 同范式）+ `CompareLinesRow.tsx`（152 行线路·播放行，playByVideo state 随迁；cellStyle 父级注入保持排除灰化口径单一真源；CompareLinesState 迁移 + 原路径 re-export 零消费方改动）
  - `MergeCandidateExpand.tsx`（216→272 行）— 选中集合 state（默认全选 + 组成员变化重置）+ target 被排除自动转移（推荐者优先→选中集首个）+ 状态建议/结果预览/结构信号按选中子集重算 + 合并按钮动态数量与选中<2 禁用 + **超限判定改选中数**（整组 >11 取消勾选即可就地分批，merge-limit-note 文案升级）+ 部分合并提示（已排除 N 个视频）
  - `MergeCandidatesSection.tsx` — handleMerge 扩 `selectedVideoIds?`：sourceVideoIds = 选中-target；**candidateIds 改由 identity.pairs 过滤「两端均在选中集合」计算**（集合外 pair 传了后端 422——遗留 ① 契约核心；全选时与 group.candidateIds 同源逐值不变由既有用例守护；部分合并禁用整组 fallback；legacy 组无 pair 锚点自然 undefined）
  - `docs/decisions.md` — ADR-105a AMENDMENT（9-D）遗留 ①/②/④ 行追加兑现/升级标注（任务卡已标注更新文档）
- **测试**：MergeCandidatesSection.test +4（11a 排除成员 → sourceVideoIds 子集 + candidateIds 仅集合内 pair〔跨界 0002/0003 不传〕/ 11b 排除 target 自动转移 + 排除列 radio disabled / 11c 选中<2 禁用 / 11d N=12 组取消勾选 1 个 → 选中 11 可就地合并〔8c 引导升级〕）。merge 前端域 **108/108** + test:changed 94/94 + typecheck/lint/budget/verify:adr-contracts EXIT=0 + **e2e merge-deeplink 6/6**
- **注意事项**：
  - 快捷合并（行级操作列）保持整组语义（不传 selectedVideoIds）；「转入批量合并」深链通道保留
  - 部分合并后集合外 pair 仍 pending：涉软删成员的 pair 自动从列表过滤（9-C FIX-3），两端均存活的跨界 pair（如地灵曲合并两个第一季后的跨季 pair）继续展示，由人工逐 pair 拒绝（既有能力）——完整工作流闭环
  - 建议实操验证：地灵曲组展开 → 勾掉两个第二季 → 合并两个第一季（toast 撤销可还原）→ 同理第二季 → 剩余跨季 pair 逐对拒绝

## [CHG-VIR-17-PARTIAL-FIX] 子集合并 target 排除守卫（Codex stop-time review）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05
- **执行模型**：claude-opus-4-8｜子代理：无
- **根因**：handleMerge 对「target ∈ 选中集合」无结构性守卫，仅依赖 CandidateExpand 的 target 转移 effect 时序——`selectedVideoIds` 不含 `targetVideoId` 时请求仍成形，会把选中视频合并到**被排除的** target 上（语义反转的数据损坏，可撤销但错误；后端 merge 无「前端选中集合」概念不会拦截）。
- **修改文件**：
  - `apps/server-next/src/lib/merge/merge-selection.ts`（新 61 行）— `buildMergeSelection` 纯函数：请求成形收敛单点（target ∉ 集合 → null 结构性拒绝 / candidateIds 集合内 pair 过滤 / 全选 fallback 口径自 handleMerge 原样迁移）；落 lib/merge 与 api/entry/status-defaults 同层，可直接单测
  - `MergeCandidatesSection.tsx`（481→474）— handleMerge 消费纯函数，null → danger toast「合并目标不在选中集合内」中止
  - `MergeCandidateExpand.tsx` — 执行合并按钮 disabled 加 `!selectedIds.has(targetId)`（转移 effect 瞬态兜底，双层覆盖）
- **测试**：新 `tests/unit/lib/merge-selection.test.ts` 6 用例（**核心：target ∉ 集合 → null** / 全组 / 子集跨界 pair 不传 / 不足 2 回退整组 / 9-C 单数 fallback 全选限定 / legacy 无锚点字段不出现）+ Section 11e 端到端（排除 target → 自动转移后全链路：新 target + 子集 + 仅 a-c pair）。merge 域 115/115 + test:changed 83/83 + e2e deeplink 6/6 + tsc/lint EXIT=0
- **注意事项**：请求成形逻辑自此单点（buildMergeSelection），后续 MergeWorkspace 若需同款守卫可直接复用。

## [CHG-HOME-UX-ADR] ADR-052/104 AMENDMENT — home_modules title/image_url 一等列补齐 + media ownerType 扩 home_module
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 15:30
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8 / ab0afb7523bcdd0ed)
- **修改文件**：
  - `docs/decisions.md` — ADR-052 追加 AMENDMENT 2026-06-05（D-052-9 一等列 migration 093 + 不走 metadata 通道四点论证 + Y-1 supersede「title/subtitle 覆盖」守则条目 / D-052-10 image_url 可空语义 + 降级链 `imageUrl ?? coverUrl ?? placeholder` + 首版不加条件必填 / D-052-11 media ownerType 扩 'home_module' 三处扩点 + banner 范式写回补偿 / R-1 影响面清单 6 触点 + 公开端点纯增量确认）；ADR-104 追加 AMENDMENT 2026-06-05（D-104-9 CreateBase +title z.record(z.string()) +imageUrl z.string().url().max(2048)，applyBusinessRules + .partial().strict() 派生链自动覆盖，6 端点路径/方法/错误码/audit 零变化 / D-104-10 前端实施裁定：auto-fill 走 fetchPickerItemByIdSafe 不扩 ContentRefPicker 契约 + 卡片 120×54 页面本地 img 不扩 Thumb + 上传需先有 id 新建态仅外链）
  - `docs/architecture.md` — §5.10 home_modules 表补 title / image_url 两行 + metadata 行注记 supersede
  - `docs/tasks.md` / `docs/task-queue.md` — SEQ-20260605-01 序列登记（13 卡）+ ADR 卡收口
- **新增依赖**：无
- **数据库变更**：无（migration 093 由 CHG-HOME-UX-01-A 实施；本卡纯协议定档）
- **注意事项**：arch-reviewer PASS-with-conditions → R-1（影响面清单 + 公开端点 GET /home/modules 自动透出新列确认为有意纯增量）/ Y-1（metadata 守则 title 条目显式 supersede）已吸收；Y-2/A-2 登记 follow-up（CHG-HOME-BANNER-URL-MAX：banner imageUrl 缺 .max(2048) 对齐；title 值侧 min/max 评估）。A-1 实证 .url() 对 R2/local-fs 双 provider 绝对 URL 形态安全；A-3 实证 migration 093 标号正确。verify:adr-contracts EXIT=0。解阻 CHG-HOME-UX-01-A。

## [CHG-HOME-UX-01-A] home_modules schema + query 层 — title/image_url 落地（migration 093）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 15:22
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/api/src/db/migrations/093_home_modules_title_image.sql`（新建）— ADD COLUMN IF NOT EXISTS title JSONB NOT NULL DEFAULT '{}' + image_url TEXT NULL，幂等 + 注释 down 节（049/050 约定）
  - `packages/types/src/home-module.types.ts` — HomeModule / CreateHomeModuleInput / UpdateHomeModuleInput 三接口扩 title: Record<string,string> + imageUrl: string|null（HomeModule 必有，Input 可选）；metadata 注释补 supersede 注记
  - `apps/api/src/db/queries/home-modules.ts` — DbHomeModuleRow + mapRow（title ?? {} 防御 / image_url 直通）+ 6 处列清单（4 SELECT + 2 RETURNING）+ INSERT 列 10→12 + UPDATE fieldMap +2（JSONB_KEYS 集合统一 title/metadata stringify）
  - `tests/unit/api/home-modules.test.ts` — MODULE_ROW 补两列 + 新增 5 断言（映射透出 / null 防御兜底 / SELECT 列含 / INSERT stringify+缺省分支 / UPDATE stringify+imageUrl 清空 null）
- **新增依赖**：无
- **数据库变更**：migration 093（已执行 dev 库；幂等复跑 ✅；INSERT 往返 title/image_url 逐值一致 + 默认值分支 {}/null + 清理零残留实证）
- **注意事项**：表当前 0 行，存量零破坏 trivially 成立。test:changed 因 packages/types 基础包改动按 ADR-180 自动升全量：493 files 6605/6605 全过；typecheck/lint EXIT=0。公开端点 GET /home/modules 自此自动透出 title/imageUrl（ADR-052 AMENDMENT R-1 确认的纯增量）。解阻 CHG-HOME-UX-01-B / CHG-HOME-UX-02。

## [CHG-HOME-UX-01-B] HomeModulesService zod 扩 title/imageUrl（ADR-104 D-104-9 实施）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 15:24
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/api/src/services/HomeModulesService.ts` — CreateBase +title z.record(z.string()).default({}) + imageUrl z.string().url().max(2048).nullable().optional()；create() 显式透传两字段（update() 整体透传 input 零改动；CreateSchema/UpdateSchema 经 applyBusinessRules + .partial().strict() 派生链自动覆盖）
  - `tests/unit/api/admin-home-modules.test.ts` — +4 用例（POST 透传+缺省分支 / imageUrl 非法 URL 422 / title 值非 string 422〔z.record(z.string()) 收紧〕/ PATCH 白名单 .strict() 不误拒 + 透传）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：56/56（home-modules 24 + admin-home-modules 32）全过；typecheck/lint EXIT=0 + test:changed 增量 32/32。test:e2e:admin 与 CHG-HOME-UX-02 合跑（连续后端卡批处理，偏离登记）。6 端点路径/方法/错误码/audit 枚举零变化。解阻 CHG-HOME-UX-03。

## [CHG-HOME-UX-02] media ownerType 扩 home_module（ADR-052 D-052-11 实施）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 15:35
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/api/src/routes/admin/media.ts` — OwnerTypeSchema +home_module + 422 错误文案三值化
  - `apps/api/src/services/ImageStorageService.ts` — OwnerType 类型并集 +home_module + buildKey 分支（key 前缀 home_modules/）
  - `apps/api/src/services/MediaImageService.ts` — upload() home_module 前置校验分支（findHomeModuleById 404）+ uploadForHomeModule（仿 banner 范式：upload → updateHomeModule 写回 image_url → 写库失败补偿删除；无 blurhash 入队同 banner 现状）
  - `tests/unit/api/mediaImageService.test.ts` — +home-modules queries mock + 3 用例（404 不调 upload / 写回+不入队+kind null / 补偿删除）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：既有端点 body 枚举值扩张非新 route（verify:endpoint-adr 不触发，ADR 卡已确认）。media 域 44/44 过；typecheck/lint EXIT=0 + test:changed 44/44；**e2e:admin 39 passed + 1 flaky（旧版 moderation 域重试过，与本卡无关）= 01-B+02 合跑门禁完成**。解阻 CHG-HOME-UX-05（图片上传依赖）。

## [CHG-HOME-UX-03] 首页运营前端数据层 — types/api 扩字段 + useVideoMetaMap + deriveModuleStatus
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 15:42
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/home-modules/types.ts` — CreateHomeModuleBody +title/imageUrl（UpdateBody Partial 派生自动覆盖）
  - `apps/server-next/src/lib/home-modules/api.ts` — +uploadHomeModuleImage(id, file)（postMultipart /admin/media/images ownerType=home_module）
  - `apps/server-next/src/lib/home-modules/derive-status.ts`（新 57 行）— deriveModuleStatus 四色生命周期纯函数（P-home §6；danger〔video meta===null〕> neutral〔禁用/过期〕> warn〔待生效〕> ok；now 注入；undefined=未取回不判 danger）
  - `apps/server-next/src/lib/home-modules/use-video-meta-map.ts`（新 86 行）— useVideoMetaMap（仅 video 类型 refId 并发 fetchPickerItemByIdSafe + useRef 持久缓存〔null=已确认失效也缓存〕+ 稳定依赖键 sorted-join + loadingIds + cancelled 守卫）
  - `tests/unit/server-next/home-derive-status.test.ts`（新 8 用例）/ `tests/unit/hooks/use-video-meta-map.test.tsx`（新 5 用例，jsdom renderHook）/ `tests/unit/server-next/home-modules-client.test.ts`（+1 upload FormData 契约）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：**偏离登记 ×2**：① 上传进度条改 loading 态——server-next apiClient 仅有 postMultipart（CHG-SN-6-08）无 XHR 进度，不为单消费点扩 api-client 共享层（v1 uploadWithProgress 不迁移）；② hook 测试落 tests/unit/hooks/（JSDOM_GLOBS 内）+ 相对路径 mock——tests/unit/hooks/ 不在 vitest context-aware alias server-next importer 白名单，@/ 会误解析到 web-next。30/30 新测试 + test:changed 41/41 + typecheck/lint EXIT=0。解阻 04-A/04-B/05/07。

## [CHG-HOME-UX-04-A] HomeModuleCard 设计稿 §5.7 重排 — 序号/120×54 横图/标题降级链/四色 Pill
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 15:46
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/HomeModuleCard.tsx` — 全面重排：drag handle + #序号（INDEX_STYLE）+ 120×54 页面本地 img（THUMB_STYLE，降级链 imageUrl→videoMeta.coverUrl→ImageOff 占位，D-104-10 不扩 Thumb）+ 标题降级链（deriveDisplayTitle：title.zh-CN→en→videoMeta.title→[类型] refId）+ 时间窗本地化（formatTimeWindow「MM-DD HH:mm → MM-DD HH:mm」裸 ISO 退役）+ admin-ui Pill（deriveModuleStatus 四色）；props +index 必填 +videoMeta 可选
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` — map 调用处传 index（接口对齐一行）
  - `tests/unit/components/server-next/admin/home/HomeOpsClient.test.tsx` — MODULE_FIXTURE 补 title/imageUrl + 新增 4 用例（序号+降级末位+占位 / zh-CN 优先+img src / 三色 Pill〔生效中/待生效/已隐藏〕/ 时间窗本地化裸 ISO 退役断言）
- **新增依赖**：无（lucide-react ImageOff 既有依赖图标）
- **数据库变更**：无
- **注意事项**：videoMeta 实际注入归 04-B（本卡 undefined 路径已覆盖：占位+降级末位）；红 pill「引用失效」用例归 04-B（需 metaMap 接线）。组件测试 31/31 + test:changed 15/15 + typecheck/lint EXIT=0。解阻 04-B。

## [CHG-HOME-UX-04-B] HomeOpsClient 编排 — Segment + DeleteModuleModal + useVideoMetaMap 接线
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 15:52
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` — 手写 bottom-border tabs（TAB_BAR_STYLE/tabStyle/nav 删除）→ 共享 Segment（设计稿 §5.7；badge=已加载 slot 计数，懒加载未访问 slot 无 badge〔全量计数端点 follow-up CHG-HOME-COUNTS〕）；window.confirm → deleteTarget state + DeleteModuleModal；useVideoMetaMap 顶层一次接线 → videoMeta 下传 Card（video 类型 metaMap.get）
  - `apps/server-next/src/app/admin/home/_client/DeleteModuleModal.tsx`（新 103 行）— 确认型 Modal（仿 SwitchDomainModal 范式；目标摘要 + 硬删 danger 明示 +「运营下线请改用隐藏」引导）
  - `tests/unit/components/server-next/admin/home/HomeOpsClient.test.tsx` — +picker-fetcher mock（默认成功 meta 防误触红 pill）+5 用例（videoMeta 标题/coverUrl 回退 / 红 pill 引用失效 / Segment badge / Modal 删除全流程含行移除 / 取消不调 delete）；04-A 降级用例改 pending fetch 模拟未取回
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：window.confirm 全退役；红 pill「引用失效」路径自此激活（P-home §6 四色全实装）。组件测试 36/36 + test:changed 20/20 + typecheck/lint EXIT=0；e2e:admin 与 05/06 批跑登记（连续前端卡）。解阻 06 / 07。

## [CHG-HOME-UX-05] HomeModuleDrawer 字段补齐 — 多语言标题 + 图片 + datetime-local + auto-fill
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 16:00
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/HomeModuleDrawer.tsx`（352→471 行 <500）— FormState +titleZh/titleEn/imageUrl + buildTitlePayload（仅非空键）；startAt/endAt 裸 ISO 文本 → datetime-local 原生 input（**偏离登记 ×2**：① 不移植 v1 BannerForm `.slice(0,16)` 模式——该模式 UTC 显示 × 本地解析在非 UTC+0 时区「编辑不动保存」漂移，改 isoToLocalInput/localInputToIso 本地化对称往返；② AdminInputType 不含 datetime-local，用原生 input + 本地 DATETIME_INPUT_STYLE 复刻 md 视觉，不为单消费点扩共享契约）；auto-fill：handleContentRefChange → fetchPickerItemByIdSafe 预填空字段（不覆盖已填 + 竞态守卫〔应用前比对当前选中 id〕+ autoFilledRef 记录预填值，type 切走仅清未手改的残留）
  - `apps/server-next/src/app/admin/home/_client/ModuleImageField.tsx`（新 134 行，500 红线预防性拆分）— 外链 input + 编辑态上传按钮（uploadHomeModuleImage + loading 态）+ 16:9 预览 + 新建态「保存后可上传」提示
  - `tests/unit/components/server-next/admin/home/HomeModuleDrawer.test.tsx`（新 9 用例）— title 仅非空键 / **datetime 对称往返零漂移守护**（BannerForm bug 不回归）/ 留空 null / auto-fill 预填+不覆盖+404 零预填 / 上传按钮可见性 / imageUrl 空串→null；AdminInput testid 落容器 → 取值用 getByLabelText
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：**发现 v1 BannerForm 时间窗往返漂移 bug**（apps/server/src/components/admin/banners/BannerForm.tsx:72,91——UTC 切片显示 + 本地解析提交），v1 已冻结仅维护期修复，登记 follow-up CHG-BANNER-TZ-FIX。home 域 45/45 + test:changed 29/29 + typecheck/lint EXIT=0。解阻 FUP 部分。

## [CHG-HOME-UX-06] HomePreviewPanel 轻拟真 — 真实封面 + 标题（emoji/UUID 退役）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 16:08
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/HomePreviewPanel.tsx` — props +videoMetaMap?（optional 默认空 Map 零破坏；父传不自取守住「仅消费已加载数据」原则）；BannerPreviewItem 🎬/🔗 emoji → 真实 16:9 横图（imageUrl→coverUrl→ImageOff/Link2 icon 占位）+ previewTitle 降级链（与卡片同口径：title.zh-CN→en→视频标题→contentRefId）；PosterPreviewItem 🎬 → 真实海报（coverUrl 优先竖版语义）+ 标题 + 排名保留；type_shortcuts pills 与 disabled overlay 不动
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` — PreviewPanel 接 videoMetaMap（与 Card 共用同一 metaMap，零重复请求）
  - `tests/unit/components/server-next/admin/home/HomePreviewPanel.test.tsx` — fixture 补 title/imageUrl + META_MAP + 4 新用例（meta 命中横图+标题 / imageUrl+title.zh-CN 优先级 / poster 海报+排名 / 缺省降级零破坏）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：预览 20/20 + home 域全绿 + test:changed 40/40 + typecheck/lint EXIT=0 + **e2e:admin 39 passed+1 flaky（publish-flow 既见 flaky 重试过）= 04-B/05/06 批跑完成**。改造主线（缺口 1-7）全部收口；解阻 07。

## [CHG-HOME-UX-07] 页内批量添加 — BatchAddVideosModal 统一确认面板首建
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 16:18
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/BatchAddVideosModal.tsx`（新 247 行）— 三入口共用确认面板：目标 slot AdminSelect（video 类 3 slot，type_shortcuts 回落 banner）+ VideoPicker multiple（共享原语原生多选，零契约改动）+ 候选列表（缩略图+标题，已在列标灰「已在列 · 跳过」）+ initialItems 预填口（08 深链 / 09 趋势导入复用）+ 确认仅提交未在列项（确认前零写库，硬删语义安全）
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` — slot 卡片头部「+ 添加视频」（仅 video 类 slot）+ getExistingIds（已加载 modules 去重真源）+ handleBatchAdd 编排（ordering=max+1 末尾追加 + 循环 createHomeModule + 汇总 toast 成功 N/失败 K〔warn〕+ 跨 slot 添加后 loadSlot 兜底）
  - `tests/unit/components/server-next/admin/home/BatchAddVideosModal.test.tsx`（新 6 用例）— 去重标灰+确认过滤 / 全在列禁用 / slot 切换重新比对（AdminSelect click+mouseDown 驱动先例）/ 页内增选 / initialItems 预填 / type_shortcuts 回落
  - `tests/unit/components/server-next/admin/home/HomeOpsClient.test.tsx` — +2 用例（按钮开 Modal / type_shortcuts 不显示按钮）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：无批量端点（循环 POST，N≤选片数，不新增 route）。home 域 57/57 + test:changed 28/28 + typecheck/lint EXIT=0。解阻 08 / 09。

## [CHG-HOME-UX-08] 他页深链入口 — 视频库行级/批量「加入首页运营」+ 落地确认面板
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 16:28
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/home-modules/entry.ts`（新 58 行）— 深链单一真源（仿 lib/merge/entry.ts）：HOME_ENTRY_SOURCES=['videos','videos-batch'] + SOURCE_META 回链栏元数据 + buildHomeAddHref/parseHomeAddEntry（参数顺序契约 add_ids → from；ids 去空去重保持首现序；非法 from/空 ids → null 零干扰）
  - `apps/server-next/src/lib/home-modules/use-home-add-entry.ts`（新 60 行，HomeOpsClient 500 红线预防抽 hook）— 解析 + fetchPickerItemByIdSafe 并发充实 + 无效引用过滤（invalidCount 供提示）+ consumed 防重弹 + cancelled 守卫
  - `apps/server-next/src/app/admin/videos/_client/VideoRowActions.tsx` — buildItems +onAddToHome +「加入首页运营」项（merge/split 之后）→ window.open 新窗深链（保留列表上下文，对齐 videos-batch 先例）
  - `apps/server-next/src/app/admin/videos/_client/VideoBatchActions.tsx` — buildBatchActions opts +onAddToHome →「加入首页运营（N）」（count≥1；导航动作无二次 confirm——落地确认面板自带且确认前零写库）
  - `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx` — onAddToHome 注入 window.open(buildHomeAddHref)
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx`（469<500）— useHomeAddEntry 接线 + 来源回链栏（home-entry-source-bar，info 底色 + 无效引用计提示 + 返回链）+ 深链专用 BatchAddVideosModal 实例（initialItems 预填，与页内实例独立避免状态混淆）
  - 测试：新建 `tests/unit/server-next/home-entry.test.ts`（7 用例：参数顺序契约/往返/去重/守卫/META）+ VideoRowActions +1（window.open spy 断言精确 URL）+ SelectionActions +2（回调 ids/向后兼容）+ HomeOpsClient +2（深链落地回链栏+面板预填〔Modal effect flush waitFor〕/ 普通访问零干扰）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：HomeOpsClient.test 补 next/navigation mock（useSearchParams，深链用例覆写）。08 相关 102/102 + test:changed 106/106（首轮 1 failed = jsdom 并发 flaky 复跑全绿）+ typecheck/lint EXIT=0。解阻 09。

## [CHG-HOME-UX-09] 半自动趋势导入 + top10 补位可视化
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 16:36
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/home-modules/api.ts` — +fetchTrendingCandidates（公开 /videos/trending?period=week skipAuth → VideoCard 映射 PickerVideoItem）+ fetchTop10AutoFill（公开 /home/top10 → **isPinned=false 项**映射 Top10AutoFillItem——Top10Item 自带人工/自动标记，无需求差）
  - `apps/server-next/src/lib/home-modules/use-top10-autofill.ts`（新 31 行）— top10 tab 激活时取一次（manualCount 进依赖：置顶增删后重取；失败静默降级；前台 60s 缓存致可视化短暂滞后已注释声明为提示性可接受）
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx`（499<500 压线）— batchAddOpen → batchAddInitial（null=关/[]=页内空白/[...]=趋势预填，页内与趋势合并单实例）+「从趋势导入」按钮（仅 featured/top10）+ handleTrendingImport + useTop10AutoFill 接线下传
  - `apps/server-next/src/app/admin/home/_client/HomePreviewPanel.tsx` — props +autoFillItems?（仅 top10 渲染）+ AutoFillPreviewItem（灰显 0.55 + rank + 「自动」pill + 说明文案「人工置顶不足 10 个时前台按评分自动补位」）+ 空 modules 有补位不显「暂无模块」
  - 测试：HomePreviewPanel +3（补位行+标记+文案 / 纯自动不显空态 / 非 top10 忽略）+ home-modules-client +2（trending/top10 端点契约含 isPinned 过滤断言）+ HomeOpsClient +2（趋势导入预填 / banner 无按钮）+ api mock 补 2 导出
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：**HomeOpsClient 已满 499 行**——下次任何改动必须先拆（登记 FUP）。读时补位机制（无 worker）经「自动」行在后台显性化，闭合 P-home §4.2 文档偏差的可视化侧。83/83 + test:changed 77/77 + typecheck/lint EXIT=0 + e2e:admin 39+1 flaky（07/08/09 批跑完成）。**入口体系三卡（07/08/09）全收口**；解阻 FUP。

## [CHG-HOME-UX-FUP] follow-up 登记 + P-home 手册更新 + SEQ-20260605-01 序列收口
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 16:56
- **执行模型**：claude-opus-4-8（人工 opus 会话覆盖 haiku 建议，偏离登记）
- **子代理**：无
- **修改文件**：
  - `docs/task-queue.md` — 后续卡登记补全（+CHG-HOME-OPS-SPLIT 拆分预警：HomeOpsClient 499 行压线，下次触碰必拆）+ SEQ-20260605-01 状态收口 ✅
  - `docs/manual/20-pages/P-home.md`（本卡明确标注"更新文档"）— §0 元信息（CHG-HOME-UX 系列 + 新端点）；§4.2 **worker 文档偏差修正**（旧文「后台 worker 周期扫描」→ 实际为前台查询读时 NOW() 过滤无 worker）+ 四色 pill 生命周期；§4.3 批量添加入口体系（页内/深链/趋势导入）；§4.4 top10 补位可视化；§5 字段表 +title/imageUrl + datetime-local 口径；§7 FAQ 时效条目修正 + 红 pill/上传按钮/批量标灰 3 新条目
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：全量单测兜底两轮交叉：第一轮 6674/6674 全过；第二轮 6673/6674（CrawlerRunsView #25 crawler 域与本序列零交集，隔离 33/33 过 = 既见 jsdom 并发 flaky）。verify:adr-contracts 4 项全绿 + test:changed docs-only SKIP。**SEQ-20260605-01 全 13 卡收口**。

## [CHG-HOME-UX-07-FIX] 批量添加未加载 slot 重复创建 + ordering 冲突修复（Codex stop-time review）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 17:05
- **执行模型**：claude-opus-4-8
- **子代理**：无（Codex stop-time review 触发）
- **根因**：① getExistingIds 去重真源 = 懒加载 modulesBySlot——目标 slot 未访问时 undefined → 空集 → 已在列视频不标灰且确认后**重复创建**；② baseOrdering 按本地缓存 max+1——未加载时从 0 起与服务端已有 ordering **冲突**。07 卡注释「确认前 loadSlot 兜底」未实现（注释承诺与实现脱节）。
- **修改文件**：
  - `apps/server-next/src/lib/home-modules/use-batch-add.ts`（新 143 行）— 批量添加编排域 hook（自 HomeOpsClient 抽离，**同时兑现 CHG-HOME-OPS-SPLIT 拆分预警**）。修复双层：数据层 = handleBatchAdd 确认时**服务端真源兜底**（先 listHomeModules(slot) 取最新列表 → 重过滤去重〔跳过数进 toast〕+ baseOrdering 按服务端 max+1 + 列表获取失败零 create + 缓存以 fresh+本批整体回写取代逐条追加）；UI 层 = 面板打开预加载未加载 video slots（slot 切换标灰即时正确）
  - `apps/server-next/src/lib/home-modules/types.ts` — +VIDEO_SLOTS 常量真源（自 Modal 迁入，hook 消费避免 lib→_client 反向依赖）
  - `apps/server-next/src/app/admin/home/_client/BatchAddVideosModal.tsx` — VIDEO_SLOTS 改 import + re-export（既有消费方零迁移）
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx`（499→441 行，红线压力解除）— 批量添加域整段（getExistingIds/handleBatchAdd/handleTrendingImport/batchAddInitial state ~60 行）→ useBatchAdd 接线
  - `tests/unit/hooks/use-batch-add.test.tsx`（新 6 用例）— 未加载 slot 服务端兜底去重+ordering max+1（核心回归守护）/ 全在列零 create / 列表失败零 create+danger / 部分失败 warn / 打开预加载（已加载不重复）/ 初始零预加载
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：home 域 70/70（既有 64 零破坏）+ test:changed 38/38 + typecheck/lint EXIT=0。深链 Modal 同走 handleBatchAdd 服务端兜底（双入口同修）。

## [CHG-HOME-UX-07-FIX2] Modal 预过滤决策权移除 + 深链面板预加载（Codex review 第 2 轮）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 17:12
- **执行模型**：claude-opus-4-8
- **子代理**：无（Codex stop-time review 第 2 轮触发）
- **根因**：① Modal handleConfirm 提交本地缓存预过滤后的 pendingItems——**预过滤仍是提交集决策层**，缓存陈旧时服务端真源守卫被旁路（守卫只能兜「传进来的」）② use-batch-add 预加载 effect 仅由 batchAddInitial 驱动——深链面板实例（addEntry.items 驱动 open）打开不预加载，slot 切换标灰失真
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/BatchAddVideosModal.tsx` — handleConfirm 提交**全量 selected**（本地标灰/「待添加 N」计数降级为展示层估计；过滤唯一真源 = handleBatchAdd 服务端守卫）；头注 + onConfirm Props 注释职责分层声明
  - `apps/server-next/src/lib/home-modules/use-batch-add.ts` — opts +externallyOpen?（深链面板 open 信号并入预加载触发：panelOpen = batchAddInitial !== null || externallyOpen）
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` — useBatchAdd 接 externallyOpen: addEntry.items !== null
  - 测试：BatchAddVideosModal 确认用例改 FIX2 核心断言（提交全量含本地标灰项）+ use-batch-add +1（externallyOpen 触发预加载）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：去重职责自此单层决策——Modal 仅展示估计，handleBatchAdd 服务端最新列表是唯一过滤层（三入口统一）。home 域 71/71 + test:changed 39/39 + typecheck/lint EXIT=0。

## [CHG-HOME-UX-07-FIX3] 本地估计为 0 时阻断服务端校验确认（Codex review 第 3 轮）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 17:17
- **执行模型**：claude-opus-4-8
- **子代理**：无（Codex stop-time review 第 3 轮触发）
- **根因**：FIX2 后确认按钮 disabled 与 handleConfirm 短路仍用 `pendingItems.length === 0`（本地缓存估计）——缓存陈旧地认为「全部已在列」时用户被阻断提交，服务端守卫无机会裁决（local cache blocks server-validated confirmation）。
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/BatchAddVideosModal.tsx` — disabled/短路条件改 `selected.length === 0`（仅真无选择才禁用，唯一禁用条件）；按钮文案「添加 N 个」N=selected.length（与 FIX2 全量提交语义一致）；摘要改「预计添加 X · 已在列跳过 Y（确认后以服务端为准）」
  - `tests/unit/components/server-next/admin/home/BatchAddVideosModal.test.tsx` — 「全部已在列→禁用」用例改「全部本地标灰仍可提交（FIX3 核心断言）」+ 新增「selected 空 = 唯一禁用条件」+ 摘要文案断言同步 + 头注覆盖清单同步
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：本地缓存自此对确认流程零决策权（标灰/计数纯展示提示，提交集与可提交性均归服务端守卫/真实选择）。home 域+hook 72/72 + test:changed 33/33 + typecheck/lint EXIT=0。

---

## [CHORE-DOCS-CLEANUP-20260605] docs 季度性清理归档 + 引用更新 + 关键信息收口（SEQ-20260605-02 / 用户指令插队）

- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 17:55
- **任务类型**：纯文档维护（本卡明确标注"更新文档"；先例 SEQ-20260521-01 / MAINT-DOC-CLEANUP-20260531）
- **执行模型**：claude-opus-4-8（建议 sonnet，用户 opus 会话人工覆盖）｜ **子代理**：无
- **变更内容（5 项）**：
  1. **changelog.md 分段归档**：原 43~13363 行（WAVE3/4 收官头插段 + CHG-SN-8-01 ~ CHG-DT-RESIZE-ROLLOUT 顺序段，2026-05-23 ~ 2026-06-01）→ `docs/archive/changelog/changelog_M-SN-8-to-META_20260605.md`；活跃段保留 CHG-VSR-1（SEQ-20260601-01）起。文件 15189 → 收尾约 1900 行（1.7MB → 0.37MB）。
  2. **task-queue.md 分段归档**：原 93~908 + 984~2512 行（M-SN-7 跟踪卡 + 设计稿对齐重做 + SEQ-20260521-* ~ SEQ-20260531-01 全 ✅ 序列）→ `docs/archive/task-queue/task-queue_archive_M-SN-7-to-META_20260605.md`（归档头注明：内部子条目状态滞后以序列头 + changelog 为准；META-13 backlog / META-15-A DEFER / 条件触发卡残留提示）。SEQ-20260524-01（M-SN-9 容器 🟡）+ SEQ-20260601-01 起保留。**SEQ-20260601-01 header 状态漂移收口对齐**（🔄→✅：全 15 卡 ✅ / CHG-VSR-7 收官 2026-06-02 实证）。文件 3378 → 约 1060 行（533KB → 0.27MB）。
  3. **tasks.md 工作台清空重置**：淤积的已完成记录（CHG-VIR/VSR/HOME 系列等 58 个 ID）逐一核对 changelog 在档后删除；过期 Wave 2/3/4 收官段与"新会话启动指引"移除（历史在 changelog + 归档）。
  4. **已完成文档归档 4 件 + 全库引用改址**：`tasks-bangumi.md`→`docs/archive/tasks/`（track 已 2026-05-29 集成）；`designs/external-metadata-ux-overhaul_20260529.md`、`audit/datatable-header-redesign-plan.md`（补日期后缀 `_20260523`）、`audit/known-failing-tests_20260529.md`→`docs/archive/2026Q2/`；4 件均加 ARCHIVED banner；decisions/architecture/changelog/task-queue/tracks 及两个新归档内引用全部改址，全库断链检查 0 残留。**偏离登记**：范围"仅 docs"扩 1 行——`packages/admin-ui/.../column-matrix-menu.tsx` 文件头注释真源路径改址（注释级零行为）。
  5. **关键文档信息收口**：`docs/README.md`（ADR 范围 100..136→100..180 / task-queue·changelog 三段归档指针 / §2 活跃设计文档与台账清单 / §6 manual 已落地状态 / last_reviewed 2026-06-05）；`docs/tracks.md`（bangumi track ✅ 已集成 2026-05-29 / 冲突域释放 / 活跃 Track 0/3 / last_reviewed）；`docs/archive/2026Q2/README.md` 季度索引追加。
- **保留不动（核查确认）**：SEQ-20260524-01（🟡 容器 + `docs/audit/user-review-2026-05-23.md` 登记簿）；SEQ-20260602-03 / 20260604-02 / 20260605-01 各"后续卡登记"小节；`designs/` 5 份活跃设计稿（route-labeling-system / adr177 预研被 decisions.md·architecture.md·manual 真源引用，保留）；`docs/audit/adr-d-status.json` 工作区既有改动不属本卡，未提交。
- **门禁**：docs 主体 + 1 行代码注释；`npm run test:changed` 见 commit 前执行记录。
- **[AI-CHECK]**：六问——①归档零删失（行级切分 + 行号映射记录）②活跃文档零断链（全库 grep 0 残留）③未完成项零丢失（🟡/⬜/后续卡逐项核查保留或在归档头登记）④状态翻转均有实证（SEQ-20260601-01 全卡 ✅ / bangumi 代码在 main + 分支已删）⑤遵守追加式写入与归档命名惯例 ⑥偏离 1 项已登记（代码注释改址）。

## [CHG-HOME-GOVERNANCE-PLAN] 首页运营治理方案落盘（SEQ-20260605-03 / 用户指令插队）

- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 18:56
- **任务类型**：纯文档方案落盘（本卡明确标注"更新文档"；不改代码 / schema / API）
- **执行模型**：claude-opus-4-8（建议 sonnet，用户当前会话人工覆盖）｜ **子代理**：无
- **修改文件**：
  - `docs/designs/home-operations-governance-plan_20260605.md`（新）— 首页运营治理方案：前台同构画布、模块 Inspector、卡片拖拽/删除/添加、空卡片补位、Banner 横版大图强约束、自动填充、豆瓣电影/剧集、Bangumi 动漫、发布审计缓存与后续拆卡。
  - `docs/README.md` — 活跃设计文档索引补充本治理方案。
  - `docs/task-queue.md` — 新增并收口 SEQ-20260605-03 / CHG-HOME-GOVERNANCE-PLAN。
  - `docs/tasks.md` — 当前任务卡生命周期登记并清空工作台。
  - `docs/changelog.md` — 追加本记录。
- **新增依赖**：无
- **数据库变更**：无
- **门禁**：`npm run test:changed` docs-only SKIP；`npm run typecheck` PASS；`npm run test -- --run` 全量 6681/6682（`tests/unit/components/admin/staging/StagingEditPanel.test.tsx` 既见并发 flaky，隔离复跑 12/12 PASS）；`npm run lint` FAIL 于既有 `apps/server-next/src/lib/home-modules/use-batch-add.ts:113` `@next/next/no-assign-module-variable`，超出本卡文件范围，未改代码且不 commit。
- **共享层判断**：本次只落治理方案，不新增组件；后续 UI 实施阶段应优先复用 `ModernDataTable`、既有 admin form/drawer/modal、VideoPicker 与首页模块 API 客户端，若同构卡片/空槽/Inspector 字段 3 处以上复用，再沉淀到 `src/components/admin/shared/` 或对应 server-next shared 层。
- **[AI-CHECK]**：问题理解 = 将首页运营改造需求固化为后续 UI/UX 与数据治理实施依据；根因判断 = 现后台已具备基础运营能力但缺少同构画布、强素材契约、自动填充与来源治理的统一方案；方案 = 文档化输入输出契约、状态归属、模块治理、自动填充来源、服务边界、验收标准与拆卡路径；偏离检测 = 无代码/schema/API 偏离，验证红灯均登记为既有范围外问题；结论 = docs-only 方案已落盘，可作为后续首页运营 UI/UX 改造入口。

## [CHG-HOME-PRECOMMIT-LINT] 首页方案提交前 lint 阻断修复（SEQ-20260605-04 / 用户指令：提交并 push）

- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 19:27
- **任务类型**：小范围 lint 修复（提交前门禁阻断处理；不改变业务逻辑）
- **执行模型**：claude-opus-4-8（建议 sonnet，用户当前会话人工覆盖）｜ **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/home-modules/use-batch-add.ts` — 将局部变量 `module` 改名为 `createdModule`，解除 Next lint 规则 `@next/next/no-assign-module-variable`。
  - `docs/task-queue.md` — 新增并收口 SEQ-20260605-04 / CHG-HOME-PRECOMMIT-LINT。
  - `docs/tasks.md` — 当前任务卡生命周期登记并清空工作台。
  - `docs/changelog.md` — 追加本记录。
- **新增依赖**：无
- **数据库变更**：无
- **门禁**：`npm run lint` PASS；`npm run typecheck` PASS；`npm run test:changed` 33/33 PASS；`npm run test -- --run` 499 files / 6682 tests PASS。
- **七问自检**：无整页刷新；无重复逻辑/重复状态；无应下沉逻辑；未破坏 Route→Service→DB 边界；无函数/文件规模新增风险；未引入技术债；不涉及 audit log 写入位点。
- **偏离检测**：本次是命名级 lint 修复，不以补丁绕过结构问题；无兼容复杂度、状态流混乱、组件职责膨胀或无关代码触达；不涉及 ADR 验证段与 D-N 闭环。
- **[AI-CHECK]**：结构检查：是否违反分层 NO；是否跨模块访问内部实现 NO。代码质量：是否新增重复逻辑 NO；是否存在 hack / 临时补丁 NO。规模检查：是否存在需拆分函数 NO；是否存在需拆分文件 NO。安全性：是否存在隐式副作用或吞异常 NO。结论：SAFE。

## [CHG-HOME-GOV-ADR-A] Home Curation ADR ①：真源与 schema 裁定（ADR-181）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 21:05
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)
- **修改文件**：
  - `docs/decisions.md` — 新增 ADR-181（Accepted）：D-181-1 Banner 真源唯一化（home_banners 维持 Hero 真源，home_modules.slot='banner' 两段式冻结退役，v1 UI 处置声明，CHG-HOME-FE-BANNER 废止）/ D-181-2 D-052-9 title+image_url 列对账保留 + 论证③ supersede / D-181-3 时间窗命名分歧不 rename + 聚合 DTO 统一 startAt/endAt/enabled / D-181-4 热门 shelf 扩 HomeModuleSlot 枚举 +3（hot_movies/hot_series/hot_anime，弃新表；migration 094 结构锁定 + HomeModulesService compat 第 3 处同源规则 BLOCKER 警示）/ D-181-5 边界声明（settings/快照/端点归 ADR-182/183）
  - `docs/designs/home-operations-governance-plan_20260605.md` — §5.1/§9.1/§13/§17 勘误：home_modules 实有 start_at/end_at（migration 050），原「无时间窗字段需扩展」误判撤销，CHG-HOME-TIMEWINDOW-SCHEMA 卡取消
  - `docs/task-queue.md` — 新序列 SEQ-20260605-05 登记（Phase 1 七卡 + Phase 2–4 占位）；TIMEWINDOW 卡 ❌ 取消；CHG-HOME-SLOT-EXTEND 新卡登记（评审 MEDIUM 吸收）；SEQ-20260605-01 后续卡 CHG-HOME-FE-BANNER ❌ 废止标注（D-181-1.4）；ADR-A 条目 ✅
  - `docs/tasks.md` — 卡片登记与收口（完成即删，回到空稳定态）
- **新增依赖**：无
- **数据库变更**：无（migration 094 结构已裁定，实施归 CHG-HOME-SLOT-EXTEND 卡）
- **注意事项**：① arch-reviewer CONDITIONAL PASS 全 7 条吸收，其中 BLOCKER 为 slot×content_ref_type 规则的**第 3 处同源真源**（HomeModulesService `applyBusinessRules` compat 字面量映射）——CHG-HOME-SLOT-EXTEND 实施时与 2 处 DB CHECK 同卡同步，否则 hot_* 写路径被 422 拦死；② CHG-HOME-BANNER-DECOM（物理退役）有两条技术警告记入 ADR follow-up（缩枚举 CHECK ADD 全表校验 / 必须基于 094 后枚举集）；③ 下一卡 CHG-HOME-GOV-ADR-B（admin 端点协议 ADR-182），与 -C 可并行。

## [CHG-HOME-GOV-ADR-B] Home Curation ADR ②：admin 端点协议（ADR-182）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 21:40
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)
- **修改文件**：
  - `docs/decisions.md` — 新增 ADR-182（Accepted）：D-182-1 `/admin/home/*` 聚合门面 7 端点（preview/sections/settings/candidates/apply/reorder/refresh，admin only，Route→HomeCurationService→queries 分层，资源级端点保留）/ D-182-2 HomeSectionKey 7 值枚举 / D-182-3 home_section_settings 表（migration 095：autofill_mode + refresh_interval_minutes + display_count 等列化 + seed 7 行 + 审计锚点）/ D-182-4 契约细则（含 sort_order 双写路径显式裁定 + home_section.reorder 审计载荷硬约束 + origin 开放字符串 + Phase 1 无草稿叠加声明）/ D-182-5 审计扩张（TargetKind +1 CHECK 15→16，ActionType +4）/ D-182-6 type_shortcuts 评估（slot 保留 + frontendWired:false）/ D-182-7 边界（快照/job/policyVersion 归 ADR-183）
  - `docs/task-queue.md` — ADR-B 条目 ✅
  - `docs/tasks.md` — 卡片登记与收口
- **新增依赖**：无
- **数据库变更**：无（migration 095 结构已裁定，实施归 CHG-HOME-PREVIEW-API 卡）
- **注意事项**：① arch-reviewer BLOCKER：ADR「### 端点契约」表必须 ≥6 列才能被 verify-endpoint-adr 解析（2 列简化表会被静默跳过）——已修复并实证解析 7/7，未来 ADR 起草沿用 ADR-104 表结构；② reorder 门面审计载荷硬约束（sectionKey + 真源标识 + ids 数组）与「联合 home_module.reorder ∪ home_section.reorder 回溯」声明为实施级强制；③ 端点 3（settings PATCH）归 CHG-HOME-PREVIEW-API（读写同卡内聚）；④ 下一卡 CHG-HOME-GOV-ADR-C（自动填充策略 ADR-183，依赖 A ✅）。

## [CHG-HOME-GOV-ADR-C] Home Curation ADR ③：自动填充策略（ADR-183）
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 22:15
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)
- **修改文件**：
  - `docs/decisions.md` — 新增 ADR-183（Accepted）：D-183-1 分池信号改裁（映射后站内 videos.type 替代豆瓣 media_type——前置统计实测 140,502 行 100% = 'movie' 导入硬编码不可信）/ D-183-2 home_autofill_snapshots 表（migration 096：candidates + gaps JSONB、每 section 保留 10 份、095/096 CHECK 同步义务）/ D-183-3 homeAutofillQueue + scheduler（单 tick 5min 扫描 settings；jobId 入队幂等与端点 429 主动状态检查两机制协同；attempts:2 + Redis 不可用降级）/ D-183-4 排序策略定版（权重入码随 POLICY_VERSION 演进，不开放运营调参）/ D-183-5 policyVersion 'hp-v1' / D-183-6 跨区块去重改裁「快照不做、聚合层唯一权威」（消解释失真）/ D-183-7 Bangumi 缺口复用 ADR-161 BangumiSeedService + 豆瓣反向建库首版不建（缺口 top-50 入快照 gaps、ContentGap 独立 DTO）；ADR-182 follow-up 回写端点 #4 additive `gaps` 扩展
  - `docs/designs/home-operations-governance-plan_20260605.md` — §8.1 勘误（media_type 分池假设作废 → videos.type）+ §17 修订行
  - `docs/task-queue.md` — ADR-C 条目 ✅（ADR 三卡全收口，Phase 1 实施卡解锁）
  - `docs/tasks.md` — 卡片登记与收口
- **新增依赖**：无
- **数据库变更**：无（migration 096 结构已裁定，实施归 CHG-HOME-AUTOFILL-CORE-B 卡；本卡含 dev DB 只读统计）
- **注意事项**：① arch-reviewer 双 BLOCKER 集中在缺口条目落点——已改裁「入快照 gaps 列 + ContentGap 独立 DTO（无 videoId）+ 端点 #4 additive 扩展」，实施时不得把缺口塞进 AutofillCandidate；② 跨区块去重唯一权威在聚合层，快照阶段禁止产生 occupied_by_* filterReason；③ 端点 #7 的 429 必须主动 getJob+getState 判定，不得依赖 Bull add() 去重副作用；④ SEQ-20260605-05 ADR 三卡（181/182/183）全部 Accepted，下一卡按依赖序为 CHG-HOME-BANNER-UNIFY 或 CHG-HOME-PREVIEW-API / CHG-HOME-SLOT-EXTEND（均仅依赖已完成卡）。

## [CHG-HOME-SLOT-EXTEND] HomeModuleSlot 枚举 +3（hot_movies/hot_series/hot_anime）schema 与类型全量同步
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 22:55
- **执行模型**：claude-opus-4-8
- **子代理**：无新 spawn（设计裁定引用 ADR-181 卡内 arch-reviewer (claude-opus-4-8) 评审背书）
- **修改文件**：
  - `apps/api/src/db/migrations/094_home_modules_hot_slots.sql` — 新增：slot CHECK 4→7 值 + ref_type_slot_compat 重建（hot_* 仅 video）；纯增量零阻断；已应用 dev DB 并 pg_constraint 实证
  - `apps/api/src/services/HomeModulesService.ts` — SlotEnum +3 + `applyBusinessRules` compat 映射 +3（ADR-181 BLOCKER 项，加第 3 处同源规则警示注释）
  - `packages/types/src/home-module.types.ts` — HomeModuleSlot +3 + slot×ref 约束注释更新
  - `apps/api/src/routes/home.ts` — 公开 HomeModuleSlotEnum +3（纯增量合法入参）
  - `apps/server-next/src/app/admin/home/_client/{HomeOpsClient,HomeModuleDrawer,HomePreviewPanel}.tsx` + `apps/server-next/src/lib/home-modules/types.ts` — SLOTS/SLOT_LABEL×2/SLOT_CONTENT_REF_TYPES/VIDEO_SLOTS +3（Record<HomeModuleSlot,...> 完整性编译强制）
  - `docs/architecture.md` — §5.10 两处同步（枚举列表 + CHECK 描述）
  - `tests/unit/api/admin-home-modules.test.ts` — +6 用例（it.each：3 hot slot×video→201；hot_movies×3 非 video→422）
  - `tests/unit/api/home.test.ts` — 公开路由全 slot 用例扩 7 值
  - `tests/unit/components/server-next/admin/home/HomeOpsClient.test.tsx` — 宽松正则 /热门/ 收紧为 'TOP 10'（新 tab 命中漂移修复）
- **新增依赖**：无
- **数据库变更**：migration 094（2 CHECK 重建，纯增量；down 注释式 + 缩枚举全表校验警告）
- **注意事项**：① **范围超限接受完成度风险**（workflow-rules 强行单卡条款）：起卡预拆 -A/-B，实证 `Record<HomeModuleSlot, string>` 完整性使类型层与 UI 常量为同一编译闭环、无法拆分交付，合并回单卡（5 项），commit 含 arch-reviewer trailer；② /admin/home 即日起出现 3 个新 slot tab（热门电影/热播剧集/热门动漫），pinned 编辑与批量选片能力即开——自动候选不落 home_modules（ADR-181 D-181-4.3）；③ 门禁：typecheck/lint 绿 + 全量 6688/6688 + E2E admin 39 passed + verify:adr-contracts 4 绿；④ Phase 3 写路径（CHG-HOME-AUTOFILL-*）前置已清障。

## [CHG-HOME-BANNER-UNIFY-A] banner slot 冻结（service 拒绝）+ server-next banners API 桥接
- **完成时间**：2026-06-05
- **记录时间**：2026-06-05 23:40
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/services/HomeModulesService.ts` — CreateSchema 加 banner 冻结 refine（BANNER_SLOT_FROZEN_MESSAGE 常量导出 + message 指引 /admin/banners）；update() 加 slot→banner 变相新建防护（AppError VALIDATION_ERROR 422，存量 banner 行回传原值放行）
  - `apps/api/src/routes/admin/home-modules.ts` — PATCH catch 补 VALIDATION_ERROR AppError → 422 分支（与既有 STATE_CONFLICT 分支同范式）
  - `apps/server-next/src/lib/banners/types.ts` + `api.ts` — 新增 home_banners 桥接层（6 端点封装：list/get/create/update(PUT)/delete/reorder(orders+sortOrder)；@resovo/types Banner 真源 re-export）
  - `tests/unit/api/admin-home-modules.test.ts` — +3 防护用例（POST banner 422 + PATCH slot→banner 422 + 存量 banner 行回传放行 200）；既有 3 个 banner-slot Create 用例改 featured+video（冻结后不再可用作 happy-path 载体）
  - `tests/unit/server-next/banners-client.test.ts` — 新增桥接契约 8 用例（参数序列化/pagination 包络/PUT 非 PATCH/orders body 形态）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **Update 防护为 ADR-181 冻结意图的实施级推演**（ADR 字面只裁 Create 拒绝；Drawer 编辑总携带 slot，故防护必须区分"改为 banner"vs"原值回传"，在 service 层比较 before.slot）；② 桥接层暂无 UI 消费方（-B 卡接线）；/admin/home banner tab 现状：新建 422 + message 指引（中间态，-B 替换 tab 后消除）；③ 门禁：typecheck/lint 绿 + 测试 49/49 + verify:adr-contracts 4 绿 + E2E admin 域（无 banner 用例，回归性选跑）。

## [CHG-HOME-BANNER-UNIFY-B] /admin/home Banner tab → home_banners 编辑器 UI
- **完成时间**：2026-06-05
- **记录时间**：2026-06-06 00:10
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/BannerOpsSection.tsx` — 新增：banner tab 主区编辑器（home_banners 列表 + dnd 拖拽排序（orders+sortOrder body）+ 启停 + 删除确认 Modal + 创建末尾 sortOrder 注入；消费 -A 桥接层 6 端点）
  - `apps/server-next/src/app/admin/home/_client/BannerCard.tsx` — 新增：Banner 单卡（HomeModuleCard 同范式：handle+序号+120×54 横图+标题降级链+meta+状态 Pill+启停/编辑/删除）；deriveBannerStatus 对齐 deriveModuleStatus variant 口径（D-181-3 字段映射）
  - `apps/server-next/src/app/admin/home/_client/BannerDrawer.tsx` — 新增：创建/编辑表单（title 多语言/imageUrl 必填/linkType+linkTarget/时间窗对称往返/isActive/brand；时区往返与 HomeModuleDrawer 同实现，第 3 消费方时抽 lib）
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` — banner tab 分支：渲染 BannerOpsSection + 冻结存量 home_modules 清理区（可编辑/删除/启停，不可新建不可排序）；顶部「+ 新建模块」banner tab 隐藏；右栏 PreviewPanel banner tab 隐藏（预览的是冻结数据会误导）
  - `apps/server-next/src/app/admin/home/_client/HomeModuleDrawer.tsx` — 顺带修复 SLOT-EXTEND 遗漏：SLOT_OPTIONS +3 hot slot（数组非 Record 编译不强制故漏检）
  - `tests/unit/components/server-next/admin/home/BannerOpsSection.test.tsx` — 新增 11 用例（加载/错误重试/空态/列表/状态派生×2/启停/删除确认+取消/新建+sortOrder/必填校验/编辑预填）
  - `tests/unit/components/server-next/admin/home/HomeOpsClient.test.tsx` — banners API mock + 3 既有用例适配新行为（error 态切 featured 断言/批量添加改 featured 载体/新建按钮 banner 隐藏断言）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① 运营入口自此统一：server-next /admin/home Banner tab 即 home_banners（Hero 真源）唯一推荐编辑入口（D-181-1.3），v1 banners UI 降级为维护期参考、随 v1 退场；② 冻结存量区无 DndContext——useSortable 在缺省 context 下安全降级（拖拽 handle 无效果，符合"不可排序"预期）；③ banner tab 右栏预览隐藏，Hero 真实效果走「预览前台」；④ CHG-HOME-BANNER-UNIFY 两子卡全部收口 → D-181-1 冻结裁定全量落地。

## [CHG-HOME-PREVIEW-API-A] home_section_settings 落地 + sections/settings 端点（ADR-182 端点 #2/#3）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 00:50
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/db/migrations/095_home_section_settings.sql` — 新增：home_section_settings 表（section 7 值 UNIQUE CHECK + autofill_mode 4 值 + refresh_interval_minutes/display_count/allow_duplicates/pinned_limit/settings JSONB + updated_at 触发器）+ seed 7 行幂等 + admin_audit_log.target_kind CHECK 15→16（+home_section）；已应用 dev DB 实证
  - `packages/types/src/home-section.types.ts` — 新增：HomeSectionKey/HomeAutofillMode/HomeSectionSettings/UpdateHomeSectionSettingsInput/HomeSectionSummary + HOME_SECTION_KEYS/HOME_AUTOFILL_MODES 常量；`index.ts` value export
  - `packages/types/src/admin-moderation.types.ts` — AdminAuditActionType +4（home_section.{settings_update,apply_autofill,reorder,refresh_candidates}）+ AdminAuditTargetKind +home_section
  - `apps/api/src/db/queries/home-section-settings.ts` — 新增：list/find/update（动态 SET + settings JSONB 整体替换）/countPinnedBySection（banner→home_banners UNION 其余→home_modules）
  - `apps/api/src/services/HomeCurationService.ts` — 新增：聚合层 Service（settings 域）+ SectionParamSchema/UpdateSectionSettingsSchema（.strict() + ≥1 字段）+ audit settings_update（targetId=settings 行 id，D-182-5.3）
  - `apps/api/src/routes/admin/home.ts` — 新增：端点 #2 GET sections（枚举序 + 摘要：pinnedCount/快照 null/type_shortcuts frontendWired:false）+ 端点 #3 PATCH settings（非法 section 422 先于 404）；`server.ts` 注册
  - `docs/architecture.md` — §5.10 新表 + audit 枚举同步
  - `tests/unit/api/admin-home-sections.test.ts` — 新增 10 用例（枚举序/摘要字段/401/部分更新/audit R-MID-1 内容断言/非法 section/空 body/.strict()/404 兜底/null 置回）
  - `tests/unit/api/audit-log-coverage.test.ts` — 守卫登记 home_section.settings_update（声明集 + PAYLOAD_ASSERTION_REQUIRED，R-MID-1 第 33 次系统化）
- **新增依赖**：无
- **数据库变更**：migration 095（新表 + seed 7 行 + audit CHECK 15→16）
- **注意事项**：① sections 摘要的 lastSnapshotAt/candidateCount 恒 null 直到 ADR-183 快照表落地（契约语义"未生成"）；② actionType 4 项一次性入类型真源，其中 3 项（apply/reorder/refresh）写入位点归 Phase 2/3 实施卡——守卫只登记已有写入位点的 settings_update，后续卡照此逐项登记；③ 端点 #1 preview 归 -B 卡；④ 门禁：typecheck/lint 绿 + 全量 6723/6723 + verify-endpoint-adr 209 路由对齐（新 2 端点命中 ADR-182 契约表）+ E2E admin 域。

## [CHG-HOME-PREVIEW-API-B] GET /admin/home/preview 整页预览聚合（ADR-182 端点 #1）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 01:40
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `packages/types/src/home-section.types.ts` — +HomePreview/HomePreviewSection/HomePreviewCard/HomePreviewCardSource/HomePreviewCardFlag（source 四态 + flags 7 值 union + explain origin 开放字符串）
  - `apps/api/src/services/HomeCurationService.ts` — +PreviewQuerySchema + buildPreview 整页聚合（7 区块渲染序 / brand 协议过滤 / banner D-181-3 DTO 映射 / pinned video 批量充实防 N+1 / ref_broken·unplayable·missing_image·pending·expired·disabled flags / top10 rating 补位·featured trending 补位·hot_* trending fallback / 跨区块去重聚合层唯一权威 D-183-6（pinned 占用 + allow_duplicates 豁免）/ empty 占位 D-182-3 公式 / at 时间窗模拟 / 跳缓存）+ 模块级纯函数（bannerToCard/moduleToCard/videoToAutoCard/timeWindowFlags/brandVisible）
  - `apps/api/src/routes/admin/home.ts` — +端点 #1 GET /admin/home/preview
  - `docs/architecture.md` — 端点 #1 + preview DTO 同步
  - `tests/unit/api/admin-home-sections.test.ts` — +8 preview 用例（枚举序+context 回显 / banner DTO 映射+pending / ref_broken+missing_image / 跨区块去重 / fallback·auto origin / type_shortcuts 全 empty / at 时间窗模拟 / 非法 at 422）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① banner slot 冻结存量行不进 preview（聚合显式跳过 slot='banner'，真源 home_banners）；② hot_* 在 ADR-183 候选快照实装前 source='fallback'（trending 兜底语义），Phase 3 接入快照后改 'auto'+douban/bangumi origin；③ unplayable 判定本版 = sourceCount 0，深化归 Phase 3 过滤链；④ 画布消费（CANVAS-A）就绪——Phase 1 后端面（ADR 三卡 + slot 扩展 + banner 统一 + settings + preview）全部交付；⑤ 门禁：typecheck/lint 绿 + 全量 6731/6731 + verify 4 绿 + E2E admin 域。

## [CHG-HOME-CANVAS-A] 后台同构画布：画布布局 + 区块渲染
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 02:20
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/home-curation/types.ts` + `api.ts` — 新增：聚合门面桥接（getHomePreview / listHomeSections / updateHomeSectionSettings，ADR-182 #1/#2/#3 三端点封装）
  - `apps/server-next/src/app/admin/home/_client/canvas/HomeCanvas.tsx` — 新增：画布容器（preview 消费 + loading/error/retry + generatedAt 工具条「正式配置实时预览（无草稿态）」+ 区块选中高亮回调）
  - `apps/server-next/src/app/admin/home/_client/canvas/CanvasSection.tsx` — 新增：区块布局变体（banner wide 横滑 / type_shortcuts chips / featured 网格 / top10 rank 角标横滑 / hot_* poster 横滑）+ 模式 Pill + 槽位计数
  - `apps/server-next/src/app/admin/home/_client/canvas/CanvasCard.tsx` — 新增：卡片（wide 16:9 / poster 2:3 + source pill 携 explain.origin + flags 7 值警示 Pill + empty 虚线占位）
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` — 画布/列表双视图切换（home-view-toggle-btn；列表保留全部既有编辑能力）
  - `tests/unit/components/server-next/admin/home/HomeCanvas.test.tsx` — 新增 11 用例（加载/错误重试/7 区块渲染序/generatedAt+刷新/rank 角标/chips/auto·fallback origin/flags 警示/empty 占位/选中回调/槽位计数）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① 画布本卡为只读渲染（方案 §13 阶段衔接：「保存草稿/发布」隐藏至 Phase 4；卡片拖拽/删除/替换归 Phase 2 CHG-HOME-CARD-DND；Inspector + 环境栏归 CANVAS-B）；② 默认视图仍为列表（编辑能力完整），画布经页头切换进入——CANVAS-B 接 Inspector 后评估默认切画布；③ 颜色零硬编码（CSS 变量含 fallback：--overlay-scrim / --fg-on-media / --fg-on-accent / --radius-full 四个新引用如主题层缺失走 fallback 值，不阻塞）；④ 门禁：typecheck/lint 绿 + home 组件域 88/88 + test:changed 37/37 + E2E admin 域。

## [CHG-HOME-CANVAS-B] 后台同构画布：Inspector + 环境栏
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 03:00
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/canvas/CanvasEnvBar.tsx` — 新增：环境栏（brand/locale/preview time(at)/device 四参数 +「应用」→ preview 重拉；at 经 datetime-local 本地值转 ISO）
  - `apps/server-next/src/app/admin/home/_client/canvas/SectionInspector.tsx` — 新增：区块设置 Inspector（autofillMode/refreshIntervalMinutes(空=null)/displayCount(本地正整数校验)/allowDuplicates/pinnedLimit(空=null)，消费端点 #3；候选池展示留 Phase 3 接入位）
  - `apps/server-next/src/app/admin/home/_client/canvas/HomeCanvas.tsx` — -B 接线：环境栏置顶 + 画布/Inspector 两栏（1fr+320px sticky）+ 环境参数 ref 驱动重拉 + settings 保存成功重拉 preview
  - `tests/unit/components/server-next/admin/home/HomeCanvas.test.tsx` — +7 用例（环境栏控件/应用携参重拉/Inspector 未选中提示/选中预填/编辑保存+重拉/refresh 清空传 null/displayCount 非法本地拦截）；文件 18/18
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **CHG-HOME-CANVAS 两子卡收口 → SEQ-20260605-05 Phase 1（真源与同构预览）全部 11 卡交付**（ADR 三卡 + SLOT-EXTEND + BANNER-UNIFY-A/B + PREVIEW-API-A/B + CANVAS-A/B；TIMEWINDOW 取消）；② 方案 §3 信息架构落地形态：画布主区 + 右侧 Inspector + 环境栏；「保存草稿/发布」按钮按 §13 阶段衔接隐藏至 Phase 4；③ Phase 2（卡片操作闭环：CARD-DND/EMPTY-SLOTS/IMAGE-GUARD-BANNER）为下一阶段，起卡前按惯例细化登记；④ 门禁：typecheck/lint 绿 + test:changed 44/44 + E2E admin 域。

## [CHG-HOME-CARD-DND-A] 端点 #6 reorder 门面实装（后端）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 00:55
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/services/HomeCurationService.ts` — 新增 `ReorderSectionSchema`（≥1 ≤200 uuid+ordering，.strict()）+ `reorderSection`（按 section 分派真源：banner→`updateBannerSortOrders`（ordering→sortOrder 映射）/ 其余→`reorderHomeModules`（slot=section 归属校验）；**直调 queries 不经资源级 Service**——不嵌套触发 `home_module.reorder`，D-182-4.6 有意裁定；id 不属真源 422 AppError + 不写库不写 audit；settings 缺行 null→404）+ `writeReorderAudit`（载荷硬约束：before/afterJsonb 携 sectionKey+source，after 加 ids；before 取 DB 原值 R-MID-1；targetId=settings.id D-182-5.3）
  - `apps/api/src/routes/admin/home.ts` — 端点 #6 `POST /admin/home/sections/:section/reorder`（非法 section 422 先于 404；归属校验 AppError→422 分支）
  - `apps/api/src/db/queries/home-banners.ts` — `updateBannerSortOrders` 返回 void→number（加性变更，updated 计数对齐 reorderHomeModules 口径）
  - `apps/api/src/services/BannerService.ts` — **范围外编译闭环连带**：reorder 内 return→await（query 返回类型变更强制；v1 void 签名不变）
  - `tests/unit/api/admin-home-sections.test.ts` — +10 用例（双真源分派 happy path / audit payload 内容断言 ×2 / slot 不匹配 422 / id 不存在 422 / 非法 section / body 三态校验 / 404 / 401）；文件 28/28
  - `tests/unit/api/audit-log-coverage.test.ts` — `home_section.reorder` 守卫登记（declared + PAYLOAD_ASSERTION_REQUIRED，R-MID-1 第 34 次系统化）
  - `docs/architecture.md` — §5.10 端点行 +#6（门面分派 + 审计联合查询口径）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① banner 排序经门面**首次获得审计覆盖**（v1 legacy `PATCH /admin/banners/reorder` 无 audit；D-182-4.6 裁定门面为画布唯一排序路径）；② home_modules 排序历史回溯须联合 `home_module.reorder` ∪ `home_section.reorder` 两 actionType 查询（有意裁定非盲区，审计 UI 实现时不得单 actionType 过滤）；③ 原卡 CHG-HOME-CARD-DND 范围 6 项 > 5 按原子化判据拆 -A/-B，-B（画布 DnD + 跨区块确认弹层）已登记待取；④ 门禁：typecheck/lint 绿 + test:changed 197/197 + verify:adr-contracts 4 绿（endpoint-adr 211 对齐）+ E2E admin 39 passed（1 known flaky retry 过）。

## [CHG-HOME-CARD-DND-B] 画布同区块拖拽 + 跨区块确认弹层（UI）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 01:15
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/home-curation/api.ts` — +`reorderHomeSection`（端点 #6 桥接；画布唯一排序路径，banner 经此获审计覆盖）
  - `apps/server-next/src/app/admin/home/_client/canvas/section-meta.ts` — 新增：SECTION_TITLE 第 3 消费方（CanvasSection/SectionInspector/确认弹层）触发共享提取 + VIDEO_SECTIONS 集合（方案 §5.3 边界判定）
  - `apps/server-next/src/app/admin/home/_client/canvas/CanvasSection.tsx` — SortableContext per section（featured rect / 其余水平策略）+ MaybeSortable 包装（仅 pinned+refId 注册可拖；auto/fallback/empty 不注册）+ 区块容器 useDroppable（`section:<key>` 落点协议，空区块跨区块落位）
  - `apps/server-next/src/app/admin/home/_client/canvas/CrossSectionConfirmModal.tsx` — 新增：跨区块落位确认弹层（语义改变提示「排序策略与自动填充规则按目标区块生效」）
  - `apps/server-next/src/app/admin/home/_client/canvas/HomeCanvas.tsx` — DndContext 编排：同区块 pinned 前缀 arrayMove → 端点 #6 全序载荷 + silent 重拉（load 加 silent 选项不闪骨架）；跨区块边界三连判（banner 不可拖出 D-181-1 / 非视频卡拒绝 / banner+type_shortcuts 不接受落位，warn toast）→ 确认后 PATCH slot + 端点 #6 重排目标区块（落点位置插入/容器落点末尾）；失败关弹层防 stale 序重试
  - `apps/server-next/src/app/admin/home/_client/canvas/SectionInspector.tsx` — SECTION_TITLE 改 import section-meta（提取收编，行为零变化）
  - `tests/unit/components/server-next/admin/home/HomeCanvas.test.tsx` — +11 用例（@dnd-kit mock + onDragEnd 捕获手动触发：sortable 注册边界/同区块全序载荷+silent 重拉/banner 门面分支/自身与容器落点无操作/失败重拉/跨区块弹层+确认双写链/取消/空区块末尾落位/边界拒绝 ×4/移动失败关弹层）；文件 29/29
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **CHG-HOME-CARD-DND 两子卡收口**——画布卡片排序闭环交付（同区块直拖 + 跨区块确认）；② 跨区块移动为两步非原子（PATCH slot → reorder），失败 toast + silent 重拉恢复（Phase 1 直写正式配置口径，方案 §13）；③ Pill ariaLabel stderr 警告为 CANVAS-A 既有 source pill 双段 children 所致，非本卡引入（范围外，留待 Phase 2 收尾顺带）；④ 门禁：typecheck/lint 绿 + test:changed 55/55 + home 组件域 106/106 + E2E admin 39 passed（1 known flaky retry 过）。

## [CHG-HOME-EMPTY-SLOTS] 画布空卡片添加入口
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 01:30
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/canvas/CanvasCard.tsx` — empty 占位 +emptyLabel/onEmptyClick props（role=button + Enter/Space 键盘激活 + stopPropagation 防触发区块选中；未传 onClick 维持纯展示）
  - `apps/server-next/src/app/admin/home/_client/canvas/CanvasSection.tsx` — +onEmptySlot 上抛；按区块文案（banner=「添加横版 Banner」/ 视频型=「添加视频」VIDEO_SECTIONS 驱动 / type_shortcuts 纯展示——添加链路未立案，方案 §5.2）
  - `apps/server-next/src/app/admin/home/_client/canvas/HomeCanvas.tsx` — +onEmptySlot 透传 + reloadToken（外部添加完成 → silent 重拉，初始 mount 跳过）
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` — 画布空位编排：视频空位 → setActiveSlot + batchAdd.openBlank（**复用 useBatchAdd 全链路**：服务端真源去重/ordering max+1/汇总 toast）；banner 空位 → 画布层 BannerDrawer 创建实例（sortOrder 服务端真源 max+1，画布无列表缓存）；handleBatchConfirm 共用 wrapper（确认后 bump reloadToken，深链实例 +dismiss）
  - `tests/unit/components/server-next/admin/home/HomeCanvas.test.tsx` — +4 用例（文案按区块/点击上抛+不触发选中/未传回调纯展示/reloadToken silent 重拉）；33/33
  - `tests/unit/components/server-next/admin/home/HomeOpsClient.test.tsx` — +2 用例（画布视频空位→BatchAddVideosModal / banner 空位→BannerDrawer，两链路互不串扰）+ dnd mock 补 useDroppable/strategy/utilities + home-curation api mock；28/28
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① 方案 §5.2「自动空位：开启自动填充/查看候选」入口随 Phase 3 候选池端点 #4 实装接入（本卡视频空位统一「添加视频」，人工 pinned 优先语义）；② banner 创建 sortOrder 第 2 消费方（BannerOpsSection=banners.length / 画布=服务端 max+1），未达 3 处提取阈值；③ 门禁：typecheck/lint 绿 + test:changed 61/61 + home 域 112/112 + E2E admin 40 passed 全绿。

## [CHG-HOME-IMAGE-GUARD-BANNER] Banner 横图警告级校验
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 01:45
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/banners/image-guard.ts` — 新增：规则纯函数 evaluateBannerImage（below_min 优先不叠报 below_recommended / 比例 16:9–21:9 含端点 / 非法输入空数组）+ probeImageSize（浏览器 Image naturalWidth/Height，img 加载不受 CORS 限）+ 常量（推荐 1920×1080 / 最低 1280×720）
  - `apps/server-next/src/app/admin/home/_client/BannerImageGuard.tsx` — 新增：防抖探测（debounceMs 可注入测试传 0）→ 警告条（warn Pill + 「不阻断保存」声明）/ 探测失败提醒（「确认后仍可发布」§6.6）/ desktop 21:9 + mobile 4:5 双视口 object-fit cover 安全区预览（§6.4）；'ok' 态保存探测时刻 url 防 prop 清空瞬时帧空 src
  - `apps/server-next/src/app/admin/home/_client/BannerDrawer.tsx` — imageUrl 字段下接入 BannerImageGuard（handleSubmit 零拦截——校验纯提示）
  - `tests/unit/server-next/banner-image-guard.test.ts` — 新增 8 用例（达标/低于推荐/低于最低不叠报/方图仅比例/超宽比例/双违规并报/区间端点/非法输入）
  - `tests/unit/components/server-next/admin/home/BannerImageGuard.test.tsx` — 新增 7 用例（空 URL 不渲染/达标 ok+双视口预览/低尺寸警告+不阻断声明/比例警告/探测失败提醒/URL 清空复位/**BannerDrawer 集成：警告在场提交直达 onSave**）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **SEQ-20260605-05 Phase 2（卡片操作闭环）全部 4 卡收口**（CARD-DND-A/-B + EMPTY-SLOTS + IMAGE-GUARD-BANNER）；② 校验级别全警告级与 D-052-9「宽松优先 + UI 提示引导」口径一致，运营反馈缺图率过高再评估升阻断；③ home_banners.image_url NOT NULL → 「缺图」态本真源不可达（焦点=尺寸/比例/探测三类）；缺横版大图风险标记（home_modules 旧语义）归 D-052-9 预留 CHG-HOME-IMAGE-GUARD，两卡勿混；④ focal point（方案 §6.5）需 schema 字段未立案，不在本卡；⑤ 门禁：typecheck/lint 绿 + test:changed 55/55 + home 域 119/119 + Phase 收口全量 6793/6793 + E2E admin 39 passed（1 known flaky retry 过）。

## [CHG-HOME-CARD-DND-B-FIX] 跨区块移动部分持久化差异化提示（Codex stop-time review）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 01:55
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/canvas/HomeCanvas.tsx` — confirmCrossMove 差异化错误处理：slotMoved 哨兵区分两步写失败点——第一步 PATCH slot 失败（零持久化）→ danger「移动失败」；第二步 reorder 失败（**slot 迁移已持久化**）→ warn「已移至 X，但落位排序未应用」+ 重新拖拽指引。原实现统一报「移动失败」与实际状态矛盾（卡片已在目标区块）误导运营
  - `tests/unit/components/server-next/admin/home/HomeCanvas.test.tsx` — +1 用例（第二步失败 → warn 差异化 + 不报「移动失败」反断言 + slot 已落库断言）+ 既有第一步失败用例加强 danger toast 断言；useToast 捕获 mock（admin-ui 部分 mock，其余导出真实现）；34/34
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① 不做 slot 补偿回滚——违背用户已确认的移动意图，且回滚写自身可能再失败造成二阶不一致；最终一致由 silent 重拉保证（画布反映真实位置，运营可再拖调整）；② 原子化方案（移动+排序单事务端点）需扩展 ADR-182 契约，留待运营反馈失败率后评估；③ 门禁：typecheck/lint 绿 + test:changed 62/62 + home 域 120/120。

## [CHG-HOME-AUTOFILL-CORE-A] 候选生成纯函数层 + 解释模型（Phase 3 卡 13）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 12:25
- **执行模型**：claude-opus-4-8
- **子代理**：无（契约由 ADR-183 卡内 arch-reviewer (claude-opus-4-8) 背书，无新决策面）
- **修改文件**：
  - `packages/types/src/home-section.types.ts` — +3 DTO：AutofillCandidate（D-182-4.4 已锁形态；origin/filterReason 双开放字符串）+ AutofillVideoSummary（快照 JSONB 内嵌展示最小集，非 VideoCard 全量）+ ContentGap（D-183-7.3 独立 DTO 无 videoId，结构上不可与候选混淆）
  - `apps/api/src/services/home-autofill/policy.ts` — 新增：POLICY_VERSION 'hp-v1'（D-183-5）+ DOUBAN_WEIGHTS 0.4/0.3/0.15/0.15（D-183-4.1 定版，权重和 =1）+ 惩罚/半衰期/饱和阈值常量
  - `apps/api/src/services/home-autofill/score.ts` — 新增：normVotes（ln 压缩归一，缺失/max 非正按 0 防 NaN，越界钳位）+ recencyWeight（30 天指数半衰）+ sourceHealthFromCount（3 源线性饱和）+ doubanScore（加权 + 双惩罚 + 下钳 0）+ compareBangumiCandidates（rank ASC 主序 / 缺失排后组内 rating DESC / 双缺失垫底，D-183-4.2）
  - `apps/api/src/services/home-autofill/filters.ts` — 新增：FILTER_REASONS 6 值常量集 + evaluateCandidateFilters（方案 §7.1 顺序首中即返；图片缺失有 fallback 通过；**无 occupied_by_\* reason**——快照阶段不做跨区块去重 D-183-6.1）
  - `apps/api/src/services/home-autofill/dedup.ts` — 新增：occupyVideoIds / isOccupied 去重纯函数（D-183-6.2 单一实现；allowDuplicates 双向豁免语义与 Phase 1 buildPreview 初版逐字一致）
  - `apps/api/src/services/home-autofill/index.ts` — 新增：模块统一出口
  - `apps/api/src/services/HomeCurationService.ts` — buildPreview/fetchAutoFill 去重收编（inline occupied 操作 → dedup 纯函数，行为零变更）
  - `tests/unit/api/home-autofill-core.test.ts` — 新增 33 用例（policy 常量 2 / normVotes 边界 5 / recency·health 3 / doubanScore 6 / bangumi comparator 3 / 过滤链 10 / 去重 4）
- **新增依赖**：无
- **数据库变更**：无（migration 096 归 CORE-B）
- **注意事项**：① 实施级裁量（ADR-183 D-183-4.1 只锁权重与信号集）：惩罚幅度 0.1/0.1、recency 半衰期 30 天、source_health 饱和阈值 3——均为策略常量随 POLICY_VERSION 演进，policy.ts 注释已声明；② 全模块纯函数无 IO：信号取数归候选源 queries（DOUBAN/BANGUMI 卡）、编排归 worker（REFRESH 卡）；③ filterReason 与 origin 同款开放字符串演进范式（新值随 POLICY_VERSION 递增，消费端降级展示）；④ 门禁：typecheck/lint 绿 + 全量 6827/6827（packages/types 基础包改动自动升全量，ADR-180）+ E2E admin 38 passed（2 known flaky retry 过）。

## [CHG-HOME-AUTOFILL-CORE-B] migration 096 候选快照表 + 端点 #4（Phase 3 卡 14）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 12:50
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/db/migrations/096_home_autofill_snapshots.sql` — 新增：D-183-2 全列（section CHECK 7 值与 095 同源字面量 / trigger CHECK scheduled|manual / policy_version / settings_snapshot / candidates+gaps JSONB）+ 索引 (section, generated_at DESC)；不可变快照无 updated_at trigger；已应用 dev DB（CHECK + 索引 pg 实证）
  - `packages/types/src/home-section.types.ts` — +HomeAutofillSnapshot + AutofillCandidatesResult（端点 #4 响应：snapshotAt/policyVersion null = 未生成；gaps optional additive）
  - `apps/api/src/db/queries/home-autofill-snapshots.ts` — 新增：insertHomeAutofillSnapshot（写入+清理保留 10 **同事务**，reorderHomeModules 范式；失败 ROLLBACK 不留半写态）/ findLatestHomeAutofillSnapshot / listLatestSnapshotSummaries（DISTINCT ON + jsonb_array_length）
  - `apps/api/src/services/HomeCurationService.ts` — candidates 域（listAutofillCandidates：未生成 200 空 + null；include_filtered 剔除/附 gaps；limit 过滤后切片）+ CandidatesQuerySchema（布尔显式枚举防 z.coerce 'false' 判 true 陷阱，videos.ts queryBool 同范式）+ listSectionSummaries 快照摘要接入（PREVIEW-API-A 留口闭环）
  - `apps/api/src/routes/admin/home.ts` — 端点 #4 GET /admin/home/sections/:section/autofill-candidates（section 422 先于 404 / data+snapshotAt+policyVersion 顶层 + gaps additive；只读无 audit）
  - `tests/unit/api/admin-home-sections.test.ts` — +10 用例（#4 默认剔除 filtered / include_filtered+gaps / false 字符串语义 / limit 截断+越界 422 / 未生成 null 语义 / 非法 section 422 / 缺行 404 / 401 / #2 摘要接入断言）+ 快照 queries mock 接入；38/38
  - `tests/unit/api/home-autofill-snapshot-queries.test.ts` — 新增 7 用例（**写入+清理同事务断言**（影响面 #8 义务）：BEGIN→INSERT→DELETE→COMMIT 同 client / 失败 ROLLBACK / 参数化序列化 / 保留 N 参数 / DISTINCT ON 摘要）
  - `docs/architecture.md` — §5.10 +home_autofill_snapshots 表全列 + 端点行 #1/#2/#3/#4/#6 + 策略纯函数层指针
- **新增依赖**：无
- **数据库变更**：migration 096（home_autofill_snapshots 新表；纯增量零阻断）
- **注意事项**：① 端点 #4 不透出跨区块占用状态（D-183-6：占用结果以 preview #1 聚合权威为准，两端点职责分离）；② #2 摘要候选数 = 快照内全量（含 filtered，jsonb_array_length 口径）；③ policyVersion 未生成时 null（实施级推演：无快照即无策略产物，不回退代码常量伪装）；④ 快照写入方（worker）归 REFRESH 卡——当前表空，#4 全 section 返回未生成语义为预期中间态；⑤ 门禁：typecheck/lint 绿 + 全量 6844（1 flaky=StagingTable jsdom 既有项隔离 13/13 过）+ verify:adr-contracts EXIT=0（endpoint-adr 212 对齐）+ migrate:check 干净 + E2E admin 39 passed（1 known flaky retry 过）。

## [CHG-HOME-AUTOFILL-DOUBAN] 豆瓣热门电影/剧集候选源（Phase 3 卡 15）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 13:05
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/db/queries/home-autofill-douban.ts` — 新增：listDoubanCandidateSourceRows（映射桥三源 UNION：media_catalog.douban_id + video_external_refs manual_confirmed+is_primary（Y-105a-4 保守口径）+ catalog_external_refs relation='exact'；分池 WHERE videos.type 参数化 D-183-1；**不预过滤可见性**——filtered 候选保留入快照供解释；同 video 多映射 DISTINCT ON 取 votes 最高）+ listDoubanGapSourceRows（三源 NOT EXISTS + votes 序扫描窗预截，窗口钳位 2000）
  - `apps/api/src/services/home-autofill/douban.ts` — 新增：buildDoubanCandidates（doubanScore 接线：recency=videos.updated_at 距今 / 源不稳定=source_check_status partial|all_dead / 成人=content_rating 或源站 is_adult 双信号；score DESC 排序，rank 仅未过滤条目占名次、filtered rank=0 哨兵；videoSummary.rating 取站内 catalog 非豆瓣）+ buildDoubanGaps（同公式评分单一实现，站内信号自然缺失按 0 → 纯豆瓣信号上界 0.7）+ generateDoubanSectionCandidates 编排（候选+缺口同时序产出同一快照 D-183-7.3）
  - `apps/api/src/services/home-autofill/policy.ts` — +CANDIDATE_POOL_LIMIT 100 / GAP_TOP_N 50（D-183-7.2 裁定值）/ GAP_SCAN_WINDOW 500
  - `apps/api/src/services/home-autofill/index.ts` — 出口同步
  - `tests/unit/api/home-autofill-douban.test.ts` — 新增 13 用例（排序+rank 连续 / filtered 保留+不占名次 / 过滤链 5 信号映射 / 缺失按 0 / 源不稳定惩罚 / summary 口径 / 缺口 top-N+无 videoId+mediaTypeHint 提示性 / SQL 三源断言+不预过滤断言 / 编排分派）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **dev 数据观察**：hot_movies 映射候选 37 条全 filtered（not_published——dev 库映射豆瓣视频均未发布）/ hot_series 仅 3 条，符合 ADR-183「初期 full_auto 产能=已映射可播视频、候选不足走 trending 兜底不空窗」预判（preview 聚合 hot_* fallback 已在 Phase 1 就绪）；缺口 top-50 正常（霸王别姬 0.681 居首）；全链路 122ms；② 实施级裁量：brandLocaleVisible 恒 true（D-182-3 settings 首版全局无 brand 维度）/ hasImageFallback 恒 false（FallbackCover 为渲染级兜底非数据级信号）——两处随过滤链输入显式声明；③ 修复过程：crawler_sites JOIN 列名 site_key→key（dev DB 实测捕获，单测 SQL 字符串断言不查列存在性的盲区，实测兜底）；④ E2E：N/A（API-only 无端点/UI 变更，CHG-VSR-3 同先例）；⑤ 门禁：typecheck/lint 绿 + test:changed 84/84。

## [CHG-HOME-AUTOFILL-BANGUMI] Bangumi 热门动漫候选源 + 缺口复用 ADR-161（Phase 3 卡 16）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 13:10
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/db/queries/home-autofill-bangumi.ts` — 新增：listBangumiCandidateSourceRows（映射桥三源 UNION：mc.bangumi_subject_id INT 直连 + ver/cer external_id ::TEXT→int cast 带数字正则防护；**nsfw=false 硬过滤在 SQL**——硬 = 不入池，区别于 filtered 解释保留；anime 分池；同 video 多映射 DISTINCT ON 取 rank 最优）+ listBangumiGapSourceRows（缺口路径同样 nsfw 硬过滤 + rank ASC 主序预截）
  - `apps/api/src/services/home-autofill/bangumi.ts` — 新增：buildBangumiCandidates（**排序权威 = compareBangumiCandidates rank 主序**，非 score 序——D-183-4.2 与 douban 加权序的根本差异，头注释显式声明；score 仅解释展示值 rating/10 − 惩罚同豆瓣常量；rank 仅未过滤占名次）+ buildBangumiGaps（ContentGap 携 bangumi 原生 rank，douban 缺口 null 对照）+ generateBangumiSectionCandidates 编排
  - `apps/api/src/services/home-autofill/index.ts` — 出口同步
  - `tests/unit/api/home-autofill-bangumi.test.ts` — 新增 8 用例（rank 主序非 score 序断言（score 可与排序逆序）/ rank 缺失排后组内 rating DESC / filtered 保留+rank=0 / 展示分惩罚+下钳 / 缺口 rank 携带+无 videoId / **nsfw 硬过滤 SQL 断言候选+缺口双路径**（影响面 #8 增量防线义务）/ 编排常量透传）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① dev 数据观察：hot_anime 映射候选 2 条全 filtered（not_published，dev 数据态同 douban 卡）/ 缺口 50 按 rank 主序正常（混沌武士 rank 40 居首——更优 rank 条目已映射）；全链路 120ms；trending 兜底（Phase 1）保证不空窗；② 缺口建库动作复用 ADR-161 决策 7 BangumiSeedService 既有路径，治理层只读透出（D-183-7.1，零新建链路）；③ E2E：N/A（API-only 同 DOUBAN 卡）；④ 门禁：typecheck 0 错 + lint 干净 + test:changed 79/79。

## [CHG-HOME-AUTOFILL-REFRESH] worker 重算调度 + 端点 #7（Phase 3 卡 17）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 13:35
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/lib/queue.ts` — +homeAutofillQueue（独立队列隔离背压；attempts 2 + fixed 30s，D-183-3.6）+ logger + queues 导出
  - `apps/api/src/services/home-autofill/trending.ts` — 新增：站内信号候选生成（featured/banner→listTrendingVideos origin 'trending' / top10→listVideosByRatingDesc origin 'rating'，与 preview fetchAutoFill 同口径；源已预过滤 published/public，过滤链仍统一跑捕获可播/封面缺失；**banner suggest_only 候选源=trending 为实施级推演**——ADR-183 未裁 banner 源，与 D-183-4.3 同向，apply 至 Hero 仍须编辑器人工确认 D-182-4.5）
  - `apps/api/src/services/home-autofill/recalculate.ts` — 新增：单 section 重算编排（worker 只委托 Service，identityCandidateWorker 范式）：hot_movies/series→douban、hot_anime→bangumi、featured/top10/banner→trending、type_shortcuts 跳过（无视频候选概念，不写空快照污染 #2 摘要）、manual_only/settings 缺行防御性 skipped；写快照携 POLICY_VERSION + settings 全行快照（方案 §11.2 回溯链）
  - `apps/api/src/workers/homeAutofillScheduler.ts` — 新增：单一 5min tick（D-183-3.2 常量，不为每 section 建 timer，改配下一 tick 生效）+ isSectionDue 判定纯函数（interval null/manual_only 永不到期、无快照立即到期、时间非法视为到期防卡死）+ **per-add removeOnComplete/removeOnFail: true**（jobId 释放是定频重入前提——failed 残留会永久阻塞后续入队，D-183-3.3 前提显式落实）+ 入队/查询失败 warn 不阻塞（D-183-3.6）
  - `apps/api/src/workers/homeAutofillWorker.ts` — 新增：队列消费者（concurrency 1；结构化日志 snapshot written/skipped）
  - `apps/api/src/services/HomeCurationService.ts` — +refreshCandidates（**429 主动 getJob+getState 检查**——不依赖 add 去重副作用（命中幂等键不抛错端点拿不到信号）；completed/failed 残留态不阻塞重入；audit `home_section.refresh_candidates` 轻量载荷 {section, enqueuedAt}，targetId=settings.id）
  - `apps/api/src/routes/admin/home.ts` — 端点 #7 POST refresh-candidates（202 / 422 manual_only / 429 / 404 / 入队失败异常上抛 500 不静默）
  - `apps/api/src/server.ts` — worker 注册 + scheduler 接线（HOME_AUTOFILL_SCHEDULER_ENABLED opt-out 同 maintenance 范式）
  - `packages/types/src/home-section.types.ts` — AutofillVideoSummary.slug 改 string|null（VideoCard.slug 同口径，消费端回退 videoId 深链）
  - `tests/unit/api/home-autofill-refresh.test.ts` — 新增 15 用例（isSectionDue 6 / tick 入队语义 3（含幂等键+释放前提断言、单 section 失败不阻塞、查询失败不抛）/ recalculate 分派 5 / buildTrendingCandidates 1）
  - `tests/unit/api/admin-home-sections.test.ts` — +7 用例（#7：202+幂等键断言 / audit R-MID-1 / 429 三态主动检查+负断言 / completed 残留不阻塞 / manual_only 422 / 入队失败 500 不记审计 / 422·404·401）；45/45
  - `tests/unit/api/audit-log-coverage.test.ts` — `home_section.refresh_candidates` 守卫登记（declared + PAYLOAD_ASSERTION_REQUIRED，R-MID-1 第 35 次）
  - `docs/architecture.md` — §5.10 重算调度块（队列/scheduler/worker/端点 #7/审计语义）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **dev 端到端实测**：6 section 重算全 written（hot_movies 37 候选+50 缺口 / trending 三区各 24）、端点 #4 读取链路同源摘要 6 section、**保留清理实证 12 次写入后 featured 恰 10 份**、总耗时 286ms；② ADR-182 端点 7/7 全落地（#5 apply 归下一卡 APPLY）；verify:endpoint-adr 213 对齐；③ scheduler tick 内 interval 判定基于快照 generated_at 比对（无独立状态），与 maintenanceScheduler 的 tickRunning 守卫同范式；④ 门禁：typecheck/lint 绿 + **全量 6889/6889 零失败**（types 基础包改动升全量）+ E2E admin 38 passed（2 known flaky retry 过）。

## [CHG-HOME-AUTOFILL-APPLY] 端点 #5 候选转 pinned + 审计（Phase 3 卡 18 / 末卡）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 14:50
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/db/queries/home-modules.ts` — +insertPinnedHomeModulesBatch（单事务全有或全无，reorder 同款 BEGIN/COMMIT；slot 内 MAX(ordering)+1 起连续追加事务内取 max 防并发空洞；title 留空 {} 消费端降级视频标题 093 语义；brand 默认 all-brands D-182-3 首版全局）
  - `apps/api/src/services/HomeCurationService.ts` — +applyAutofill（D-182-4.5：快照定位候选（轮换失效 409 携 ids）→ listVideoCardsByIds 重校验可见性+sourceCount 可播性（任一失效整体 409 零写入）→ 同 video 已 pinned 重复应用 409 → pinnedLimit 超限 422（实施级推演）→ 批量插入 → audit afterJsonb {sectionKey, moduleIds, candidateIds, origins, policyVersion}）+ banner section 422 指引编辑器（**实施级推演**：D-182-4.5「透出预填」为 UI 行为，端点不写 home_banners 亦不写冻结 banner slot；预填 UI 归 AUTOFILL-UI 候补卡）+ 端点 #4 appliedAt 派生（快照不可变不回写——由当前 slot pinned 行 content_ref_id 匹配 created_at 派生，banner 真源非 home_modules 跳过）
  - `apps/api/src/services/home-curation.schemas.ts` / `home-curation.preview.ts` / `home-curation.preview-cards.ts` — **新增（file-size-budget 拆分）**：Service 679 行超 500 硬限 → zod schemas（6 个）+ preview 聚合（buildHomePreview + fetchAutoFill）+ 卡片映射纯函数三模块拆出（CHG-VSR-3 sources-matrix.schemas 同先例）；Service 440 行达标，buildPreview 单点委托，route 消费入口经 re-export 保持单点
  - `apps/api/src/routes/admin/home.ts` — 端点 #5 POST apply-autofill（section 422 先于 404 / body .strict() uuid / VALIDATION_ERROR→422 / STATE_CONFLICT→409 分支）；**ADR-182 端点 7/7 全量落地**
  - `tests/unit/api/admin-home-sections.test.ts` — +10 用例（200 批量插入断言 / audit R-MID-1 全载荷断言 / 快照轮换 409+零写入零审计 / 重校验失效整体 409（全有或全无：有效候选同被拒）/ 不可播 409 / 已 pinned 重复 409 / 快照未生成 409 / banner 422 / pinnedLimit 422 / body·section·404·401 矩阵）+ #4 appliedAt 派生用例；55/55
  - `tests/unit/api/audit-log-coverage.test.ts` — `home_section.apply_autofill` 守卫登记（declared + PAYLOAD_ASSERTION_REQUIRED，R-MID-1 第 36 次）
  - `docs/architecture.md` — §5.10 端点行 7/7 收口 + 拆分模块指针
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **SEQ-20260605-05 Phase 3（自动填充）全部 6 卡收口**（CORE-A/B + DOUBAN + BANGUMI + REFRESH + APPLY），ADR-182 7 端点 + ADR-183 全 D 条落地；② dev 实测：apply 对 dev 态全 filtered 候选正确 409 拦截（STATE_CONFLICT 携 candidate id）+ banner 约束 422 指引编辑器；③ 全量兜底 6901：3 次复跑分别 1/0/4 失败，全部为 staging 域 jsdom 并发 flaky（StagingEditPanel/StagingTable，隔离 12/12+13/13 过，Phase 1 收口同款登记项），与本卡无关；④ E2E admin 36 passed + 1 flaky（codename-matrix-picker page-load retry 过）exit 0；E2E 全量 4 projects 归序列收口节点（Phase 1/2 收口同口径）；⑤ 候补卡待细化：CHG-HOME-AUTOFILL-UI（候选池面板消费 #4/#5/#7）+ 公开首页消费切换（D-183-8.3）；⑥ 门禁：typecheck/lint 绿 + verify:endpoint-adr **214 对齐** + test:changed 295/295。

## [CHG-HOME-AUTOFILL-APPLY-FIX] 运行时 audit enums 漏同步补齐 + 新增源码⊆运行时守卫（Codex stop-time review）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 14:55
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/services/AuditLogService.ts` — ACTION_TYPES +8 / TARGET_KINDS +4：`home_section.*` 4 项 + `home_section`（本系列欠账：PREVIEW-API-A 时 union 类型先行 +4/+1，ADR-118 enums 端点运行时真源漏同步 → audit 筛选器 zod 422 拒收按 home_section 过滤）；**新守卫连带揪出同类既有欠账** `image_health.rescan/switch_domain`（ADR-135）+ `crawler_task.cancel/batch_cancel`（ADR-151）+ `image_health`/`crawler_task` targetKind——union 在档、写入位点在档、双镜像同缺
  - `tests/unit/api/audit-log-service-enums-set-equal.test.ts` — EXPECTED_* 镜像同步 +8/+4
  - `tests/unit/api/audit-log-coverage.test.ts` — **新增「源码实际写入 actionType ⊆ 运行时 ACTION_TYPES」守卫**（R-MID-1 第 37 次系统化）：set-equal 守卫的结构性盲区 = 运行时数组与其测试硬编码镜像**同缺时双双通过**（本次 8 项漏网即此径）；新断言锚定源码扫描结果对运行时真源，镜像同缺亦拦截（上线即检出 4 项既有欠账，自证有效）
  - `apps/server-next/src/i18n/messages/zh-CN/audit-action-labels.ts` — +6 label（home_section 4 + crawler_task 2；image_health 2 项已在档；维护约定兑现，缺失时消费方 fallback 原始 key 不空白）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① 影响面 = audit log 后台筛选器（ADR-118 enums 端点）此前无法按 8 个 actionType / 4 个 targetKind 过滤——audit **写入**从未受影响（写路径不校验 enums 数组），属可见性缺口非数据缺口；② 根因为「4 处手工同步协议」（types union / Service 数组 / coverage 列表 / set-equal 镜像）缺少跨真源交叉断言，新守卫闭环该类别；③ 门禁：typecheck/lint 绿 + test:changed 1218/1218（守卫 134/134）。

## [CHG-HOME-AUTOFILL-UI] 候选池面板 — SectionInspector 消费端点 #4/#5/#7（Phase 3 候补卡）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 17:05
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/home-curation/api.ts` — +3 客户端函数：getAutofillCandidates（#4，顶层 snapshotAt/policyVersion/gaps 重组为 AutofillCandidatesResult）/ applyAutofillCandidates（#5）/ refreshSectionCandidates（#7）
  - `apps/server-next/src/lib/home-curation/types.ts` — re-export AutofillCandidate / AutofillCandidatesResult / AutofillVideoSummary / ContentGap（真源 packages/types）
  - `apps/server-next/src/app/admin/home/_client/canvas/CandidatePoolPanel.tsx` — **新建**：候选解释展示（origin/filterReason 中文映射 + **未知值原样降级**——开放字符串 D-182-4.4 演进范式同 audit labels；filtered 标灰 + rank=0 哨兵无前缀；appliedAt 已应用态）/ 复选选择应用（**可跳过 = 不选**；409 全有或全无 danger 提示 + 重拉最新快照）/ 立即刷新（202 异步语义提示 / 429 warn / manual_only 禁用）/ gaps 折叠区（provider 中文 + 未知降级）/ include_filtered=true 恒开（解释展示前提）
  - `apps/server-next/src/app/admin/home/_client/canvas/SectionInspector.tsx` — Phase 3 预留接入位填充（面板用 settings.autofillMode 已保存值而非 form 编辑中间态）+ onCandidateApplied/onBannerPrefill props
  - `apps/server-next/src/app/admin/home/_client/canvas/HomeCanvas.tsx` — Inspector 接线（应用成功 → silent 重拉 preview）+ onBannerPrefill 上抛
  - `apps/server-next/src/app/admin/home/_client/BannerDrawer.tsx` — +prefill prop（创建模式合并入空表单；**imageUrl 刻意不在预填集**——横版大图须人工提供，预填竖版封面诱导误用，D-052-9 口径）
  - `apps/server-next/src/app/admin/home/_client/HomeOpsClient.tsx` + `home-ops-meta.ts` + `use-canvas-entries.ts` — banner 候选「预填」→ BannerDrawer 创建模式接线（titleZh + linkType=video + linkTarget=videoId）；**file-size 拆分**：本卡 +22 使既有违规 582 加重 → 拆声明性常量模块 + 画布入口编排 hook（EMPTY-SLOTS 空位添加 + 预填 + canvasReload 信号聚合，行为零变更）→ **485 行退出违规列表（budget 净改善 −1）**，CHG-VSR-3 / AUTOFILL-APPLY 同先例
  - `tests/unit/components/server-next/admin/home/CandidatePoolPanel.test.tsx` — **新建 18 用例**（loading/error 重试/快照未生成/include_filtered 恒开/meta/解释映射+未知降级 ×2/filtered 标灰无复选/已应用态/选择应用含 onApplied+重拉/409 整体拒绝/202/429/manual_only 禁用/banner 预填上抛/type_shortcuts 不发请求/gaps 折叠）
  - `tests/unit/components/server-next/admin/home/HomeCanvas.test.tsx` / `HomeOpsClient.test.tsx` — mock 补 3 新函数（Inspector 选中即拉取候选）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **方案 §12 验收「自动候选可解释、可跳过、可应用」后台 UI 闭环**——Phase 3 三端点全部接入后台消费；② banner 应用按端点恒 422（D-182-4.5）降级为「预填」编辑器（APPLY 卡显式归本卡的预填 UI 兑现）；③ 共享层沉淀评估：否——单一消费方页面组件；④ 门禁：typecheck/lint/test:changed 绿 + admin home 套件 138/138；⑤ **E2E admin 域选跑 49 failed——与本卡无关的环境性失败（git stash 干净 HEAD A/B 同样失败 + admin home 域零 E2E spec 覆盖），已起 🚨 BLOCKER**（task-queue.md 尾部）：含 admin.spec v1 重定向断言结构性不可满足线索 + playwright webServer 缺 api 条目 + reuseExistingServer 跨会话陈旧 server 复用陷阱 + 历史「exit 0」记录疑为管道退出码测量伪影，待人工裁定。

## [CHG-HOME-AUTOFILL-UI-FIX] 切区竞态防御 — 迟到候选响应不得污染当前区块（Codex stop-time review）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 17:35
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/canvas/CandidatePoolPanel.tsx` — +activeSectionRef 三重守卫：① load 顶部过期闭包短路（handler 持有的旧 load 不发请求不触状态）② await 后迟到响应丢弃（result/error/loading 三态均守卫）③ handleApply 成功路径切区后不清新区块选择态（effect 已重置，再清会吞用户新勾选）；apply POST 本身按点击时 target 区块发出（用户意图不变）
  - `tests/unit/components/server-next/admin/home/CandidatePoolPanel.test.tsx` — +2 竞态用例（慢响应切区不污染 / apply 挂起中切区不清新选择态），18→20
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① 原实现 load 无 staleness 守卫——快速切换区块时前一区块迟到响应 setResult 覆盖当前区块（展示错数据；apply 因 candidateIds 不在新区块快照会被后端 409 兜住，属展示层缺陷非写入风险）；② 修复采用 section ref 等值守卫而非请求序号——handler 旧闭包重拉会自增序号反夺「最新」位，ref 等值无此盲区；③ 门禁：typecheck/lint 绿 + test:changed 82/82（面板 20/20）。

## [CHG-HOME-AUTOFILL-UI-FIX2] A→B→A 旧代迟到响应守卫补强（Codex stop-time review 第 2 轮）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 17:50
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/app/admin/home/_client/canvas/CandidatePoolPanel.tsx` — FIX1 的 section 等值守卫对 **A→B→A 不充分**（A 旧代迟到响应与当前 A 等值仍覆盖新代数据，含 appliedAt 派生标记丢失）→ 改双 ref 分职：activeSectionRef 仅作 load 顶部过期闭包短路（**先于序号自增**——否则旧闭包自增反夺「最新」位，正是 FIX1 弃序号的盲区）；requestSeqRef 为写入唯一守卫（effect 每次区块激活 + 每次合法 load 双处自增，旧代恒失配；含切到 no-source 区块的在途作废 + 同区块 apply 后重拉不被先前慢请求倒灌）
  - `tests/unit/components/server-next/admin/home/CandidatePoolPanel.test.tsx` — +1 A→B→A 用例（旧代 stale 响应丢弃 / 新代数据保留），20→21
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① 守卫语义收敛为「顶部闭包合法性（section）+ 写入新鲜度（seq）」正交两层，FIX1 的两用例不变继续通过；② 门禁：typecheck/lint 绿 + test:changed 83/83（面板 21/21）。

## [CHG-E2E-GATE-AUDIT-A] B 复跑定界 + E2E 基础设施双陷阱修复（SEQ-20260606-01 卡 1 / BLOCKER 处置 D 路径）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 18:45
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `playwright.config.ts` — webServer +apps/api（:4000，url=/v1/health）恒起条目：此前 E2E 隐式依赖外部手动启动的 API（陈旧实例静默复用 / 缺失时双项目大面积超时）；`PLAYWRIGHT_SERVERS` 语义不变（仅选前端 server，API 为公共底座）；实证 playwright 自起成功
  - `docs/rules/test-rules.md` — +「E2E 运行环境规程」3 条：跑前遗留 dev server 核查（端口归属表 + 启动时间判异）/ **退出码不得经管道尾命令采集**（`cmd | grep; $?` 恒取尾命令 0——历史「exit 0」即此伪影）/ 结果异常先隔离对照（单 spec + 干净 HEAD A/B）再归因
  - `docs/task-queue.md` — 定界结论落档 + CORE-A/REFRESH/APPLY 三处历史口径勘误附注（原文保留）+ -C 卡根因 (a) 增补
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **定界结论：代码态确定性失败**（后续见 -B 条目）——清 `.next` 缓存 + 全 fresh 复跑仍 49 failed/38 passed/1 flaky（六轮同集），排除本机状态；② **连带实证 -C 根因 (a)**：admin-next spec 假 cookie（`refresh_token=mock-admin-rt`）未 mock auth 校验端点，真实 API 在场时 `/v1/auth/refresh` 硬 401 → 重定向 /login（dashboard.spec 隔离对照：无 API 3/3 过 / 有 API 3/3 挂）——admin-next「无后端」假设与 v1「需后端」需求**结构性互斥**，修法（统一 auth mock fixture 或 storageState 真登录）归 -C；③ `reuseExistingServer: !CI` 保留（本地迭代体验优先），以规程第 1 条防陈旧复用；④ E2E admin 在 -B/-C 收口前保持红（BLOCKER 活跃，ADMIN 域任务按其口径标注）；⑤ 门禁：typecheck/lint/test:changed 绿（playwright.config.ts 不入 unit import 图，0 选测合法）。

## [CHG-E2E-GATE-AUDIT-B] v1 E2E 断言对照清点 + middleware 安全修复 + 退役/降冒烟（SEQ-20260606-01 卡 2）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 19:40
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server/middleware.ts → src/middleware.ts` — **维护期安全 bug 修复**：DEC-13 拆分起误置项目根级（src/app 布局下 Next 仅识别 src/middleware.ts）→ 服务端 /admin 访问控制（ADR-010）从未生效，未登录可渲染后台 shell。git mv 恢复守卫，逻辑零变更；**部署影响：v1 上线后未登录 /admin 恢复重定向 /admin/login**
  - `tests/e2e/admin.spec.ts` — ① setCookies 单点加 context.route 会话端点 mock（/v1/auth/refresh + /v1/users/me；-A 根因 (a) v1 同型：真实 API 在场假 cookie 被硬 401 登出）② `/auth/login`→`/admin/login` 断言对齐 ×6（原断言写于 ADMIN-01 apps/web 单体时代）③ 退役 7 个断言对象已不存在的测试（返回前台 ×2〔e601ea2b 移除〕/ 视频筛选器 testid / 投稿·字幕页〔已 307 归并 content tab〕/ 用户列表 testid / 采集按钮文案）+ 文件头退役清单注释 ④ 侧边栏 label 漂移修正（源站与爬虫→采集控制台）⑤ 类型整理（Parameters 体操→BrowserContext）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **v1 admin-chromium 项目 21 失败 → 6**（admin.spec 19/19 EXIT=0；middleware 激活零新增失败）；② 残余 6 项 = 类 3 全链路（publish-flow 3〔ADMIN_SPECS 编成缺 :3000 web server〕+ 断言漂移 2 + video-governance 1），登记 **CHG-E2E-GATE-AUDIT-B2**；③ 考古结论：v1 E2E 自 DEC-13（3 月）起即结构性不可满足——断言对象历经多轮改版未同步，佐证 -A「历史 exit 0 为测量伪影」判断；④ 门禁：typecheck/lint/test:changed 绿（e2e spec + middleware 不入 unit import 图）。

## [CHG-E2E-GATE-AUDIT-B2] v1 类 3 全链路 6 失败处置 — v1 项目全绿（SEQ-20260606-01 卡 2b）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 20:20
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `package.json` — test:e2e:admin/video 域 PLAYWRIGHT_SERVERS 补 web（publish-flow 跨应用金路径 :3000 ERR_CONNECTION_REFUSED 实证修复）
  - `tests/e2e/publish-flow.spec.ts` — 退役详情/播放 2 项（apps/web CSR 时代断言，CUTOVER 后 web-next SSR 取数浏览器 mock 失效；覆盖归 e2e-next detail/player）+ 孤儿 VIDEO_DETAIL 清理
  - `tests/e2e/admin-source-and-video-flows.spec.ts` / `video-governance.spec.ts` — 退役 v1 行为漂移 3 项（dropdown douban sync / reject reason 载荷 ×2，含原 known flaky），同流程归 admin-next moderation 真源套件
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **v1 admin-chromium 全绿 23/23 EXIT=0**（-B+-B2 累计：21 失败→0，退役 12 / 修复 9）；② E2E admin 整体余 admin-next 26 失败（-C 卡，根因 (a) 已定界）；③ 门禁：typecheck/lint 绿 + test:changed 升全量 6922/6923（1 失败 = use-filter-presets jsdom 并发 flaky 隔离 7/7 过，既有家族）。

## [CHG-E2E-GATE-AUDIT-C] admin-next 29 失败根因修复 — E2E admin 域全绿 + BLOCKER 撤除（SEQ-20260606-01 卡 3 / 全序列收口）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 21:56
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `tests/e2e/admin/_shared/shell-mocks.ts` — 新建共享 shell 基座 mock：5 个 shell 级端点契约正确形状（auth/refresh + notifications + background-events + jobs〔meta.degraded 必需〕+ video-merges/candidates + crawler/sites）+ 兜底 404（CHG-VSR-7 范式：404≠401 不触发鉴权重定向）
  - `tests/e2e/admin/moderation/_helpers.ts` — ① 装基座 + 兜底 `200 {data:null}` → `route.fallback()`（根因 (b) 第一层：错误形状毒化 shell hooks → TypeError ×3 → React 根崩 + dev overlay 全屏）② `MockQueueRow` 类型绑定 `@resovo/types` VideoQueueRow（根因 (b) 第二层：漂移 3 代——缺 ADR-159 aggregates 必填字段致 ModListRow 渲染崩根 + ADR-157 规整前旧值域）③ staging 列表契约补 rules+summary（REDO-04 后缺失恒卡 skeleton）+ `/admin/staging/rules` + `/admin/moderation/:id/similar` + `/admin/filter-presets` 4 端点（ADR-144 DB 主源）+ `makeFilterPreset` 工厂
  - `tests/e2e/admin/dashboard.spec.ts` — 装基座（根因 (a)：无 catch-all 时 shell 3 hooks 轮询直通真实 API → 假 cookie 401 → refresh 又 401 → 重定向 /login，3 用例全灭）
  - `tests/e2e/admin/moderation/filter-presets.spec.ts` — localStorage 种数 → mock 端点种数（ADR-144 后 fetch 成功覆盖 local）+ 删除断言改 DELETE 写 spy + 「保存」选择器撞名限定 modal + 'broken' 旧值对齐 'all_dead'
  - `tests/e2e/admin/moderation/pending-approve-staging-publish.spec.ts` / `staging-revert-to-pending.spec.ts` — staging 迁独立页对照（REDO-04-C：goto /admin/staging + 按钮「发布/退回」exact）
  - `tests/e2e/admin/moderation/player-integration.spec.ts` — 初始断言 idle → ready（LinesPanel Y4「reload 后首行自动选」）
  - `tests/e2e/admin/moderation/right-pane-tabs.spec.ts` — 类似 Tab 断言 M-SN-5 占位文案 → 「未找到类似视频」（ADR-137 真实化空态）
  - `tests/e2e/admin/moderation/refetch-sources-then-reopen.spec.ts` — 按钮「重新抓取」→「刷新线路数据」（admin-ui LinesPanel header）+ probe/render 旧值对齐 dead/all_dead
  - `tests/e2e/admin/moderation/state-preservation-stress.spec.ts` — Step2 切「待发布」tab → 切「已拒绝」（staging tab 已迁出审核台）
  - `docs/rules/test-rules.md` — E2E 运行环境规程 +2 条：mock 兜底禁错误形状 200（统一基座 + route.fallback）/ mock 数据类型必须绑定 @resovo/types 真源
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **`npm run test:e2e:admin` 全量 76/76 EXIT=0**（v1 23 + admin-next 53；规程口径采集），**SEQ-20260606-01 全 4 卡收口，🚨 BLOCKER 撤除**；② **历史定性修正**：admin-next 26 失败隔离单跑同样挂（确定性 mock 契约毒化，与 API 在场/workers/编译态全部无关），原 BLOCKER「隔离过/全量挂」系 dashboard 无 API 场景的过度外推；moderation 套件自 CHG-360（aggregates 必填化）起即红，被历史 exit 0 测量伪影掩盖；③ 业务代码零改动（纯测试层 + docs），admin-next 真源覆盖按当前实现对齐断言，符合 test-rules「不允许改断言让测试通过」例外条款（断言对象 IA/契约已演进，逐项注明依据 ADR/卡号）；④ 门禁：typecheck/lint 绿 + test:changed 0 选测合法（e2e spec 不入 unit 图）。

## [AUDIT-HOME-GOV-PLAN-20260606] 首页运营治理方案完成度审计 + 5 卡立案
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 22:10
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `docs/task-queue.md` — SEQ-20260605-05 登记卡 19–23（FE-CONSUME-A/-B / E2E-SPEC / GOV-PLAN-ERRATA / PHASE4-ADR）+ 序列状态行更新
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **审计结论：`home-operations-governance-plan_20260605.md` 完成度约 85%（22/26 项）**——Phase 1（11 卡）/ Phase 2（4 卡）/ Phase 3（6 卡 + 候补 AUTOFILL-UI）全收口，ADR-181/182/183 全 Accepted；② **缺口 4 项**：公开首页消费切换未实施（前台 3 hot shelf 仍消费趋势 query 实证，§2.1 单一真源前台未闭环，D-183-8.3 Phase 3 末卡）/ Phase 4 发布治理 3 占位未动（§11/§12，画布直写为声明降级）/ §14 质量验收 E2E 覆盖零命中 / §6「缺横版大图」口径被 schema 吸收（image_url NOT NULL 不可达）需勘误；③ 交叉缺口 FE-FEATURED / FE-SHORTCUTS（SEQ-20260605-01 待立案）归入 FE-CONSUME-B 收编评估项；④ 建议执行序：19（opus 裁定）→ 20 ∥ 21 ∥ 22 → 23（opus，依赖 19）。

## [CHG-HOME-FE-CONSUME-A] 公开消费形态裁定 + 聚合读路径（后端）— ADR-184 + GET /home/shelf（SEQ-20260605-05 卡 19）
- **完成时间**：2026-06-06
- **记录时间**：2026-06-06 23:30
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)（ADR-184 评审：CONDITIONAL PASS → 1 HIGH + 3 MEDIUM + 2 LOW 全 6 条吸收后 Accepted）
- **修改文件**：
  - `docs/decisions.md` — **ADR-184**（公开消费协议）：D-184-1 裁定新公开聚合端点 `GET /home/shelf` 不扩 `/home/modules`（原始配置行契约无法表达 auto/fallback 条目 / top10 形状家族先例 / §7.1 整页去重；第三选项 `/home/page` 显式排除）+ D-184-3 preview 同构投影 + D-184-4 fetchAutoFill hot_* 快照接线 + D-184-5 缓存口径 60s + Phase 4 失效接口位；ADR-182 follow-up 回写（HomePreviewSection.consumedSnapshotAt additive + #1 预留兑现登记）
  - `packages/types/src/home.types.ts` — `HomeShelfItem` / `HomeShelfResponse`
  - `packages/types/src/home-section.types.ts` — `HOME_SHELF_SECTIONS` 窄集常量 + `HomeShelfSection` + `HomePreviewSection.consumedSnapshotAt?` additive（HIGH 吸收：snapshotAt 结构来源，禁止 shelf 层二次查快照）
  - `apps/api/src/services/home-curation.preview.ts` — `fetchAutoFill` hot_* 快照接线（候选 filtered 仅入口筛选，读时 listVideoCardsByIds 复核为最终权威；origin/score 入 explain；缺失/不足 trending 兜底；同区块不重复）+ consumedSnapshotAt 回填（读到快照即回填）
  - `apps/api/src/services/home-curation.preview-cards.ts` — `videoToAutoCard` 增可选 score 入参（快照候选传 D-183-4 策略分 0–1；CanvasCard 仅消费 origin 实证无区间失真面）
  - `apps/api/src/services/home-curation.shelf.ts` — **新建**投影模块：丢 empty/阻断 flags/非 video 卡（missing_image 警告级放行）+ 3 section 一次批量读时复核（丢弃不回填）+ `HOME_SHELF_CACHE_PREFIX` / `buildHomeShelfCacheKey` 导出（Phase 4 CACHE-INVALIDATE 唯一失效接口位）
  - `apps/api/src/services/HomeService.ts` — `shelf()` 公开门面：Redis TTL 60s，一次 miss 填同 brand 三键（隔离硬约束）+ settings 缺行空 shelf 防御
  - `apps/api/src/routes/home.ts` — `GET /home/shelf`（section 窄集 zod 422 / brand_slug 协议同 ADR-052）
  - `tests/unit/api/home-shelf.test.ts` — **新建** 12 用例（投影 4 / 缓存门面 4 / 路由 3 / key builder 1）
  - `tests/unit/api/admin-home-sections.test.ts` — preview 快照接线 +2 用例 + 既有 fallback 测试补 consumedSnapshotAt null 断言 + beforeEach 锚定快照默认 null（防 mock 实现跨 describe 泄漏）
  - `docs/architecture.md` — Home Curation 块补公开消费路径 + consumedSnapshotAt additive 注记
- **新增依赖**：无
- **数据库变更**：无（零新表 / 零 migration / 零 audit——公开只读零写径）
- **注意事项**：① **D-183-8.3「Phase 3 末实施卡」后端半张落地**——前台 ShelfRow 切换归卡 20（CHG-HOME-FE-CONSUME-B，依赖解除）；② **admin preview 行为面同步变化**（MEDIUM 吸收显式化）：端点 #1 hot_* 渲染从「trending fallback」变为「快照 auto + trending 兜底」，explain.score 口径 rating(0–10)→策略分(0–1)，属 D-182-4 #1 预留的预期内兑现；③ dev 实测：snapshotAt 回填（快照接线生效）+ 一次 miss 填三键 TTL 60 + 422 拦截 + 复核后 items 2/10 不回填（dev 数据态 filtered 居多，合法）；④ 门禁：typecheck/lint 绿 + test:changed 升全量 **6937/6937**（types 基础包改动自动升全量，ADR-180）+ verify:adr-contracts EXIT=0（admin 214 不变——公开端点不入 MUST-8 域）；E2E N/A（API-only：admin-next 套件全 mock 不消费真实 API，前台零改动；admin home 域 E2E 覆盖归卡 21）。

## [CHG-HOME-FE-CONSUME-B] 前台 3 hot shelf 切换聚合消费 + 断裂区块收编裁定（SEQ-20260605-05 卡 20）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 01:10
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/web-next/src/components/video/Shelf.tsx` — ShelfRow 增可选 `shelfSection` prop：提供时优先 `GET /home/shelf`（ADR-184，brand_slug 透传 ADR-052 消费侧协议），items 空/失败降级现行趋势 query（§7.1 消费侧兜底）+ cancelled 迟到响应守卫；缺省零行为变更
  - `apps/web-next/src/app/[locale]/page.tsx` — 三 ShelfRow 接 `shelfSection="hot_movies|hot_series|hot_anime"`（query 保留为降级路径）
  - `tests/e2e-next/homepage.spec.ts` — +`/home/shelf` mock（emptyShelf 可选）+2 测试（聚合渲染 / 空降级金路径）；**顺手修复两处既有失修**：MOCK_MOVIE/SERIES 类型绑定 `VideoCard`（test-rules E2E 规程第 5 条——缺 subtitleLangs 致 deriveSpecs 运行时崩 + overlay 盖断言）+ 兜底 404 catch-all（规程第 4 条——CHG-E2E-GATE-AUDIT-A 后 :4000 恒起，未 mock 端点漏真实数据、外链封面阻塞 load）
  - `tests/unit/web-next/ShelfRow.test.tsx` — **新建** 5 用例（聚合消费 / brand 透传 / 空降级 / 错误降级 / 缺省现状回归）
  - `docs/task-queue.md` — FE-FEATURED / FE-SHORTCUTS 收编裁定回写 + CHG-E2E-WEB-AUDIT 待立案登记（SEQ-20260606-01 后续卡）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **D-183-8.3 前台消费闭环完成**——治理链（pinned 头部 / full_auto 快照 / 候选重算）自此对访客生效；② **收编裁定**（范围项②，仅裁定不实施）：FE-FEATURED 走 ADR-184 amendment 扩 `'featured'`（独立端点方向作废）/ FE-SHORTCUTS 不可走 shelf（video_type 非 video 卡，D-184-3.2 结构性丢弃）用既有 `/home/modules` 无需新端点；③ **定界产出**：homepage 套件全量仍 7 失败 = 既有断言漂移（nav-logo "RResovo" / hero CTA / banner dots / footer）+ ≥4 workers 并发 goto 30s 超时（6 并发复现 0 挂起请求 load 不触发、server 侧 6 并发 curl 0.5s 实证无辜）——**clean HEAD 同样 17 failed 实证与本卡无关**，证据链登记 `CHG-E2E-WEB-AUDIT` 待立案；④ 门禁：typecheck/lint 绿 + 单测 5/5 + E2E 本卡范围 4/4 绿（电影/剧集网格 + 聚合渲染 + 空降级，serial 口径）。

## [CHG-HOME-E2E-SPEC] admin home 域 E2E 金路径补覆盖 — 11 用例 + admin 域 87/87（SEQ-20260605-05 卡 21）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 01:55
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `tests/e2e/admin/home/_helpers.ts` — **新建**：home 域 mock 基座（installAdminShellMocks 先注册 + 业务 catch-all route.fallback 下沉；HomeModule/Banner/HomeSectionSettings/AutofillCandidate/HomePreview 类型绑定工厂；ADR-182 #1/#3/#4/#5/#6/#7 + ADR-104 资源级 + /admin/banners v1 pagination 包络全信封对齐；writes spy 日志）
  - `tests/e2e/admin/home/home-ops.spec.ts` — **新建** 11 用例：A 画布（7 区块渲染/Inspector 联动/settings PATCH spy）B 卡片操作（删除 modal/发布切换/拖拽排序真实鼠标步进 reorder 序断言）C 候选池（解释展示 filtered 不可勾选/应用 #5 candidateIds 断言/立即刷新 #7/快照未生成态）D Banner（drawer + 横图探测失败警告 + 警告级不阻断 submit + POST spy）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：① **治理方案 §14「后台 /admin/home 有 E2E 覆盖」收口**（此前零命中）；admin 域全量 **76→87 EXIT=0** 零回归；② 实施陷阱记档：canvas-section 中心点击落在空卡触发 onEmptySlot 不冒泡 select → 选区块须打 head pill（`canvas-mode-*`）；AdminInput `data-testid` 落 wrapper div → fill/toHaveValue 须 `.locator('input')` 下钻（后续 home 域 spec 沿用）；③ 视觉回归评估：**不另立**——画布动态数据密集，截图基线脆弱收益低，testid 行为断言已覆盖；④ 门禁：typecheck/lint/test:changed 绿 + `npm run test:e2e:admin` 87/87 EXIT=0。

## [CHG-HOME-CANVAS-STYLE-FIX] CanvasSection 选中态 border 简写/longhand 混用（用户实测直报）
- **完成时间**：2026-06-07 ｜ **记录时间**：2026-06-07
- **执行模型**：claude-opus-4-8 ｜ **子代理**：无
- **修改文件**：`apps/server-next/src/app/admin/home/_client/canvas/CanvasSection.tsx` — `SECTION_STYLE.border` 简写拆 longhand（borderWidth/Style/Color）：selected 态条件覆写 `borderColor` 与简写混用，取消选中重渲时 React 报「Removing a style property during rerender (borderColor) when a conflicting property is set (border)」
- **注意事项**：① 全 home _client 扫描仅此一处；② **verifier 盲区记档**：`verify-style-shorthand-conflict` 仅查同一对象字面量内共存，**跨常量 spread + 条件 longhand**（`{...SECTION_STYLE, ...(cond ? { borderColor } : {})}`）漏报——扩检待立案；③ 门禁：typecheck/lint 绿 + verify-style-shorthand 0 命中 + test:changed 122/122 + E2E admin 98/98。

## [CHG-SHELL-THEME-HYDRATION-FIX2] system 未解析阶段不写 DOM——防覆写 pre-hydration 脚本（Codex stop-time review）
- **完成时间**：2026-06-07 ｜ **记录时间**：2026-06-07
- **执行模型**：claude-opus-4-8 ｜ **子代理**：无
- **修改文件**：
  - `apps/{server-next,web-next}/src/contexts/BrandProvider.tsx` — Codex 命中：FIX 的单路径 DOM 同步 effect 在**首次 commit** 用未解析回退值写 `data-theme`，覆写 web-next `theme-init-script` 首绘前已按 matchMedia 解析的正确值 → system+OS 深色用户闪白一帧再翻回（重引 FOUC）。修正：`systemResolved` 改 `ResolvedTheme | null`（null = 未解析哨兵），**未解析阶段不写 DOM**（脚本/SSR attr 值保护），context 回退 SSR 确定值维持 hydration 稳定；解析在首个 effect flush 内落地后写入同值（视觉无变化）
  - 测试：server-next 文件 +1（**MutationObserver oldValue 序列断言 'light' 从未写入 DOM**——防闪烁核心）；`tests/unit/web-next/BrandProviderTheme.test.tsx` **新建** 3 例（SSR 确定值 'light' 差异面 + 脚本值保护 + 非 system 直通）
- **注意事项**：① 规律补充（FIX 沉淀之上）：**「首渲染恒定 + 挂载后升级」还需第三条——升级落地前不得把恒定回退值写出组件边界（DOM/存储），否则会覆写更早阶段（pre-hydration script）的正确解析**；② 门禁：typecheck/lint 绿 + test:changed 122/122（provider 9 例双副本）+ E2E admin 98/98。

## [CHG-SHELL-THEME-HYDRATION-FIX] BrandProvider resolvedTheme 派生 hydration mismatch（用户实测直报）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07
- **执行模型**：claude-opus-4-8
- **子代理**：无（ThemeContextValue API 形状零变更，非共享契约修改）
- **修改文件**：
  - `apps/server-next/src/contexts/BrandProvider.tsx` + `apps/web-next/src/contexts/BrandProvider.tsx`（同构副本同步）— **根因**：render 期急算 `resolvedTheme: resolveTheme(state.theme)`——`theme='system'` 时 SSR 分支返确定值而客户端首渲染直读 `matchMedia`，OS 偏好与 SSR 默认不一致时首渲染两端撕裂（实测面：/admin/home Topbar `data-topbar-theme` + Sun/Moon 图标 + aria-label 三处 mismatch，React 整树重建）。头注释「SSR 安全…hydration 无 mismatch」仅对 store 状态成立，**派生值泄漏 client-only 信息进首渲染**。修复：`system` 解析改 `systemResolved` state（首渲染恒 SSR 确定值——server-next 'dark' / web-next 'light'，与原 SSR 分支一致），挂载后 effect 经 matchMedia 解析 + 监听 mql change；**连带修复**：OS 偏好变化此前仅同步 DOM、context resolvedTheme 不更新（消费者图标不重渲）；主题 DOM 同步收敛单 effect 路径（挂载/解析就绪/OS 变化/setTheme 统一）；`resolveTheme` 模块私有函数移除
  - `tests/unit/components/server-next/BrandProviderTheme.test.tsx` — **新建** 5 例：**首渲染恒 SSR 确定值（render 期探针断言 seen[0]，hydration 稳定性核心）**/ 挂载后解析 light + DOM 同步 / OS 变化重渲（连带修复断言）/ 非 system 直通 / setTheme 单路径
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① 触发条件 = `resovo-theme` cookie 为 `system`（或缺省映射）且 OS 浅色——admin layout 把 system 映射 'dark' 传 initialTheme，但 BrandProvider 自身拿到 'system' 后 render 期解析撕裂；② web-next 副本当前无 render 期 resolvedTheme 消费者（潜伏态），按「API 同构不跨 apps import」维护约定同卡同步防漂移；③ 规律沉淀：**SSR 安全不止 store 快照——context 派生值在 render 期读 `window`/`matchMedia` 同样破坏 hydration，client-only 解析必须经挂载后 state**（首渲染恒定 + effect 升级，next-themes 同款范式）；④ 门禁：typecheck/lint 绿 + test:changed 51/51（新增 5 + 受影响图）+ E2E admin 98/98。

## [CHG-HOME-DRAFT-PUBLISH-B-FIX2] 惰性建稿基线改服务端单快照（Codex stop-time review 第 2 轮）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 07:30
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/db/queries/home-publish.ts` — `readPublishedHomeConfig` 新增：REPEATABLE READ READ ONLY 事务包裹 `readHomePageState`（publish 事务内同款三表全量读复用）——**单快照零分页**
  - `apps/api/src/services/HomePublishService.ts` + `home-publish.schemas.ts` + `routes/admin/home-publish.ts` — GET /admin/home/draft 增 `include_base=true` query（布尔显式枚举）：顶层 additive `base` 携当前发布态整页；缺省路径零变化（base 不计算不返回，既有断言不破）
  - `apps/server-next/src/lib/home-curation/{api,use-home-draft}.ts` — 惰性建稿基线改 `getHomeDraft({ includeBase: true })`；同请求回传草稿态：**他端已并发建稿则采纳其 config 为基（共享单草稿模型防覆盖）**；FIX1 的客户端分页装配层 `draft-assembly.ts` 及其测试**删除**（被本方案整体取代）
  - 测试：`home-publish.test.ts` +3（include_base 无草稿携 base / 缺省零触达零 base 键 / 有草稿并存）；e2e `_helpers` GET draft mock 同步 include_base
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① Codex 第 2 轮命中：「paginated draft assembly can still silently miss modules」——FIX1 的 OFFSET 分页聚合在**页间并发增删**下可计数吻合仍漏行（删页一区行 + 插页二区行净零位移即穿过 total 校验），且无稳定排序 tiebreaker 时静态数据也可页间重叠/漏行；**客户端分页本质上无法保证一致性快照**；② 规律沉淀（取代 FIX1 版本）：**「整体替换」语义的数据底座装配必须来自单一一致性快照（服务端事务内全量读）——客户端分页聚合无论怎么校验都只是缩小而非消除竞态窗**；③ dev 实测：include_base 回传 20 modules + 2 banners + 7 settings；缺省路径键集无 base；④ 门禁：typecheck/lint 绿 + test:changed 237/237 + home 域 E2E 22/22。

## [CHG-HOME-DRAFT-PUBLISH-B-FIX] 惰性建稿装配截断防御（Codex stop-time review）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 07:00
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/server-next/src/lib/home-curation/draft-assembly.ts` — **新建**：首次编辑惰性建稿整页装配自 use-home-draft 抽出——**分页聚合至 total**（两列表路由 limit 上限 100，原单页装配在存量 modules/banners > 100 时静默截断，publish 全量替换语义下**缺行即删行**）；超装配上限（modules 500 / banners 100，HomePageConfigSchema 同源）或聚合不完整 → **显式失败**（宁可建稿失败不可静默截断）
  - `apps/server-next/src/lib/home-curation/use-home-draft.ts` — assembleBaseConfig 改导入装配层（错误经 mutateConfig 上抛 → 既有操作处 danger toast 自然承接）
  - `tests/unit/server-next/home-draft-assembly.test.ts` — **新建** 5 例：单页全量 / **存量 250 三页聚合零截断（修复点核心断言）** / 超上限显式失败 / 空页提前终止聚合不完整失败 / banners pagination 包络聚合
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① Codex stop-time review 命中：「first draft edit can truncate existing home modules before publish」——卡 25 实施时已注意到 limit 100 边界但未设防（当时存量 20 行），属**全量替换语义的完整性前置条件缺失**；② 规律沉淀：**凡为「整体替换」语义装配数据底座，必须聚合至 total 并对不完整路径显式失败**——单页取数 + 上限默认值是静默截断温床；③ 门禁：typecheck/lint 绿 + test:changed 33/33 + home 域 E2E 22/22（惰性建稿路径回归）。

## [CHG-HOME-CACHE-INVALIDATE] 发布后缓存主动失效（SEQ-20260605-05 Phase 4 卡 27 / **Phase 4 全收口**）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 06:45
- **执行模型**：claude-opus-4-8
- **子代理**：无（协议已由 ADR-185 Opus PASS 定档，本卡纯实施）
- **修改文件**：
  - `apps/api/src/services/home-cache-invalidation.ts` — **新建**失效模块：`invalidatePublishedHomeCaches`（**子前缀级精确 scan+UNLINK**——`home:shelf:*` 经 D-184-5.2 接口位 `HOME_SHELF_CACHE_PREFIX` + `home:top10:*`；不复用 CacheService.clearCache type 级整删，`home:*` 整删会连带清非目标 home key）+ `schedulePublishedHomeCacheInvalidation`（事务外 fire-and-forget：成功 debug / 失败 warn 不上抛——失效失败不回滚发布，60s TTL 兜底自愈，主动失效是优化不是正确性前提）；`HOME_PUBLISH_INVALIDATION_PREFIXES` 导出（扩前缀同卡同步约定）
  - `apps/api/src/services/HomeService.ts` — `HOME_TOP10_CACHE_PREFIX` 导出（top10 键族失效接口位，shelf 接口位同范式）
  - `apps/api/src/services/HomePublishService.ts` — publish/rollback 事务成功 + audit 后接失效钩子（携 trigger/versionNo 上下文）
  - `tests/unit/api/home-cache-invalidation.test.ts` — **新建** 6 例：接口位对账（两子前缀全集）/ 精确 MATCH 断言（禁 home:\* 整删）/ 空键族合法态 / SCAN 游标分页聚合 / 成功 debug / redis 故障 warn 不上抛；`home-publish.test.ts` +3 断言（publish/rollback 钩子触发 + 竞态路径不触发）
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① **ADR-185 D-185-5 闭环 → D-185 全 6 项裁定收口；Phase 4 实施 4 卡（24–27）全完成 = 治理方案（home-operations-governance-plan_20260605.md）§11/§12 最后两节落地，方案全章节实施面闭环**；② dev 实测：预热 4 键（shelf 三键 + top10）→ rollback → `home:*` 键族清空（publish 钩子同链路）；③ 门禁：typecheck/lint 绿 + test:changed 74/74（API-only 增量）+ **全量单测 7021/7021 EXIT=0（Phase 收口兜底节点，一次绿）** + verify:adr-contracts EXIT=0（零新端点 221 不变）；E2E N/A（API-only，UI 零改动——admin 域卡 26 后 98/98 在档；E2E 全量受 web 域既有失修阻塞，已登记 CHG-E2E-WEB-AUDIT 待立案）。

## [CHG-HOME-AUDIT-ROLLBACK] 版本列表/详情/回滚 + diff 展示（SEQ-20260605-05 Phase 4 卡 26）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 06:10
- **执行模型**：claude-opus-4-8
- **子代理**：无（协议已由 ADR-185 Opus PASS 定档，本卡纯实施）
- **修改文件**：
  - `apps/api/src/db/queries/home-publish.ts` — 版本读取三函数：`listHomePublishVersions`（轻量行分页 DESC 不含 config）/ `findHomePublishVersionByNo`（详情全量 config = 消费端 diff 数据源）/ `countHomePublishVersions`
  - `apps/api/src/services/HomePublishService.ts` + `home-publish.schemas.ts` + `routes/admin/home-publish.ts` — 端点 #5–#7（**ADR-185 端点契约 7/7 全量落地**）：versions 列表/详情（非法 versionNo 422 先于 404）/ rollback（恢复三表 + roll-forward 拍新版本 source='rollback'、note 自动携 `rollback to v{n}` 用户备注追加；**版本数 < 2 → 422 无可回滚目标**〔卡 24 移交注记兑现〕；复用 `publishHomeConfig` draft 省略路径——草稿乐观锁仅作用于草稿删除分支；现存草稿不删、由陈旧信号②自然标记；audit `home_page.rollback` targetId=新版本 UUID + afterJsonb 同构 publish + targetVersionNo；rollback 静态后缀先于详情注册）
  - `apps/api/src/services/AuditRollbackService.ts` — `home_page.publish`/`home_page.rollback` 入 `UNSUPPORTED_ACTION_TYPES` **显式防御**（与 ADR-138 行级回滚语义区分：整页版本回滚走专用端点，操作对象 = 配置三表；不依赖 TARGET_KIND_TABLE_MAP 缺映射隐式兜底——未来加表映射会破防）
  - `apps/server-next/src/lib/home-curation/version-diff.ts` — **新建**消费端 diff 纯函数（服务端不存不算 diff）：section 粒度 added/removed/changed（按 id）+ settingsChanged；剥离 createdAt/updatedAt 元数据（ms 截断教训延续）；**陷阱记档：JSON.stringify replacer 数组作用于全嵌套层级会丢非顶层键（title/metadata）**——平铺 stringify 即稳定（两侧均出自 pg jsonb canonical 键序）
  - `apps/server-next/.../canvas/VersionHistoryPanel.tsx` — **新建**版本历史 Drawer：列表（source pill / 当前版本标记 / note·时间）+「对比上一版」**按列表序取相邻较旧版本**（serial 可留空洞，不可按 n-1 推算）+ 回滚确认 modal（最新版本禁用——即当前发布态）；HomeCanvas 工具栏「版本历史」入口，回滚成功 → preview 重拉 + 草稿双信号刷新
  - `apps/server-next/src/lib/home-curation/{api,types}.ts` — listHomeVersions / getHomeVersion / rollbackHomeVersion 客户端 + 类型桥接
  - 测试：`home-version-diff.test.ts` **新建** 6 例（恒等剥离/增删改计数/banner 独立/settings/嵌套键检出/渲染序）；`VersionHistoryPanel.test.tsx` **新建** 11 例；`home-publish.test.ts` +8（#5–#7 路由含 R-MID-1 rollback payload 内容断言）；`audit-rollback.test.ts` +3（home_page.* 行级 422 防御 ×2 + Set 成员守卫）；coverage REQUIRED/PAYLOAD +home_page.rollback；E2E `home-versions.spec.ts` **新建** 5 例（列表/diff/回滚金路径/禁用边界/冷启动空链）
- **新增依赖**：无 ｜ **数据库变更**：无（097 版本表已就位）
- **注意事项**：① **ADR-185 D-185-3 + D-185-4 闭环**（3.1/3.2/3.5/3.6 卡 24 + 3.3/3.4 本卡；4.1 摘要双 actionType 落定 + 4.2 diff 消费端 + 4.3 full_auto 漂移不入版本链为既有语义零代码）；缓存失效裁定闭环归卡 27——有意不引用其 D 编号字面量防 verify-adr-d-numbers 伪闭环（卡 23 沉淀规律）；② dev 实测：#5 轻量行 DESC（hasConfig false）/ #6 v1 详情 20 modules+2 banners / 404·422 拦截 / **#7 回滚 v1 → roll-forward v3**（source=rollback + note 拼接 + audit targetVersionNo=1 + sectionsChanged []〔v1≡当前态恒等〕+ 三表 20 modules 完整）；③ 门禁：typecheck/lint 绿 + test:changed 406/406（未触基础包，增量门禁）+ verify:adr-contracts EXIT=0（admin 路由 218→221 全对齐）+ `npm run test:e2e:admin` **98/98** EXIT=0（home 域 17→22）。

## [CHG-HOME-DRAFT-PUBLISH-B] 发布治理前端：画布切草稿写 + 发布确认 UI（SEQ-20260605-05 Phase 4 卡 25）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 05:00
- **执行模型**：claude-opus-4-8
- **子代理**：无（协议已由 ADR-185 Opus PASS 定档，本卡纯实施）
- **修改文件**：
  - `apps/api/src/services/home-curation.{schemas,preview}.ts` — preview `draft=true` 草稿叠加消费（ADR-182 #1 显式预留兑现，additive query param 布尔显式枚举防 coerce 陷阱）：配置三键改读 `home_config_drafts` 覆盖层（`draftConfigToRows` 兜底补 id/时间戳），自动候选/快照/趋势仍实时；无草稿降级发布态；`context.draft` additive 回显；shelf 链路显式 `draft: false`（公开面恒发布态）
  - `apps/api/src/services/HomePublishService.ts` + `routes/admin/home-publish.ts` — GET draft 附顶层 additive `staleness`（双信号编辑器提示——权威判定仍在 publish 时点；gaps additive 同范式非 break）；`HomeDraftStaleness` 类型入 `packages/types/home-publish.types.ts`，`HomePreview.context.draft?` additive
  - `apps/server-next/src/lib/home-curation/draft-mutations.ts` — **新建**纯变异层（画布操作 → HomePageConfig 逐映射）：reorder（banner sortOrder / modules ordering）/ move（**slot 迁移 + 目标重排单次变换原子完成**，消解原两步 PATCH+reorder 部分持久化态）/ settings 替换 / addVideos（slot 内去重跳过 + ordering 续接 + 默认值对账 insertPinnedHomeModulesBatch）/ applyCandidates / addBanner（草稿内 max+1）；新建条目预生成 UUID（拖拽身份锚 + publish 后即正式行 id）
  - `apps/server-next/src/lib/home-curation/use-home-draft.ts` — **新建**草稿生命周期 hook：**编辑即自动保存草稿**（UI 形态裁定记此——与既有画布"每操作即持久化"粒度一致，「保存草稿」不设独立按钮，显式动作 = 发布/丢弃）；首次编辑惰性建稿（三真源装配整页，**含 banner-slot 冻结存量**——publish 全量替换语义下缺装配即被删）；mutate 串行链防会话内 PUT 竞态；初始读失败降级发布态
  - `apps/server-next/.../canvas/HomeCanvas.tsx` — 写路径全量切草稿（draftCtl prop）：拖拽/跨区块/settings/候选应用经 mutateConfig；草稿态工具栏（chip 基于 vN + 发布/丢弃）+ 陈旧显著提示条；preview 按 draftActive 加 draft=true
  - `apps/server-next/.../canvas/PublishConfirmModal.tsx` — **新建**发布确认弹层：摘要 + 可选备注 + **横图三类警告标记**（尺寸/比例/探测失败，复用 lib/banners/image-guard 同源探测；§6 警告级**不阻断发布**——ERRATA 移交验收项落地）+ 陈旧警示；409 拒绝 → danger toast + 双信号刷新
  - `apps/server-next/.../canvas/{SectionInspector,CandidatePoolPanel}.tsx` + `use-canvas-entries.ts` + `HomeOpsClient.tsx` — 保存/应用改回调注入（onSaveSettings/onApplyCandidates/onApply）；批量添加按视图分流（canvas → 草稿 / list+深链 → 资源级直写维持）；画布 banner 创建 → 草稿条目
  - 测试：`home-draft-mutations.test.ts` **新建** 10 例（纯函数）；`home-publish.test.ts` +staleness 3 例（22→25 形态）；`admin-home-sections.test.ts` +draft=true 3 例（草稿叠加/降级/draft=false 不触草稿查询）；`HomeCanvas.test.tsx` 重写 39 例（draftCtl mock + lastMutated 载荷断言 + 草稿工具栏 7 例）；`CandidatePoolPanel.test.tsx` 应用语义改造 22 例；E2E `home-draft-publish.spec.ts` **新建** 6 例（草稿态进入/发布金路径/横图警告不阻断/陈旧 409/丢弃）+ `home-ops.spec.ts` 2 例改造 + `_helpers` 扩 draft/publish/sections mock
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① **ADR-185 D-185-2 + D-185-6 闭环**（2.1 画布全量进草稿含候选应用；2.2 三层清单运行核验 = e2e 断言画布操作零触达门面 #3/#5/#6 与资源级 PATCH〔HIGH-1 验收核验项〕；6.1 独立子路由卡 24 已执行 / 6.4 发布确认横图警告本卡落地 / 6.2 多 brand·6.3 定时发布为非目标边界声明）；其余裁定闭环归卡 26（端点 #5–#7 + 审计 diff 展示）与卡 27（缓存失效）——有意不引用其 D 编号字面量防 verify-adr-d-numbers 伪闭环（卡 23 沉淀规律）；② **「编辑即不影响前台」实证**：dev 实测草稿改 top10 displayCount=12 → preview draft=true 反映 12 / 缺省 preview 与公开链路维持 10；直写门面 #3 后 GET draft staleness 实时翻 stale/tablesNewer=true；③ 候选池 appliedAt 派生仍基于正式配置（草稿 pinned 发布前不显「已应用」）——已知轻微偏差，草稿内重复防御由 slot 去重承担；④ 门禁：typecheck/lint 绿 + test:changed 升全量 6985/6985（v1 staging 域 2 例并发 flake 隔离/复跑全绿，与本卡零交集——StagingTable/StagingEditPanel 同家族既有失修候选）+ verify:adr-contracts EXIT=0（零新端点，218 不变）+ `npm run test:e2e:admin` **93/93** EXIT=0（home 域 11→17）。

## [CHG-HOME-DRAFT-PUBLISH-A] 发布治理后端：migration 097/098 + draft CRUD + publish 端点（SEQ-20260605-05 Phase 4 卡 24）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 03:55
- **执行模型**：claude-opus-4-8
- **子代理**：无（协议已由 ADR-185 Opus PASS 定档，本卡纯实施）
- **修改文件**：
  - `apps/api/src/db/migrations/097_home_publish_versions.sql` — **新建**：版本快照表（version_no serial UNIQUE 单调递增 / source publish|rollback CHECK / config 整页 JSONB / published_by FK users RESTRICT；不设保留上限 + 冷启动空表语义）+ audit target_kind CHECK **16→17**（+home_page，088/095 同范式；action_type 列无 DB CHECK——拆分口径防误加）
  - `apps/api/src/db/migrations/098_home_config_drafts.sql` — **新建**：草稿覆盖层表（UNIQUE(scope) 全局单行，scope 恒 'global' 为多 brand 扩展位；base_version_no 陈旧锚无 FK——失锚即读作陈旧；updated_at 触发器 = 乐观锁 + 陈旧信号②基准）
  - `packages/types/src/home-publish.types.ts` — **新建**：`HomePageConfig`（三键整页，entry 类型 id/时间戳可选——草稿新建行 publish 时生成，版本快照运行时恒全量）+ `HomeConfigDraft` / `HomePublishVersion(Summary)` / `HOME_PUBLISH_SOURCES`；index.ts value export
  - `packages/types/src/admin-moderation.types.ts` + `apps/api/src/services/AuditLogService.ts` + `apps/server-next/src/i18n/messages/zh-CN/audit-action-labels.ts` — audit 枚举三处同步：`home_page` targetKind + `home_page.{publish,rollback}` actionType（rollback 写入位点归卡 26，enums 先行使 audit 筛选器即时可过滤——AUTOFILL-APPLY-FIX 教训）
  - `apps/api/src/db/queries/home-publish.ts` — **新建**：draft CRUD（upsert 创建锚定 MAX(version_no)、冲突更新不重置锚）+ 双信号源（findLatestVersionNo / findTruthTablesMaxUpdatedAt GREATEST 三表）+ `publishHomeConfig` 单事务 = 草稿乐观锁删除（id+updated_at 双匹配，竞态 → null）→ 三表全量替换（banners/modules DELETE+INSERT **保留 id/created_at**——audit 链与 appliedAt 派生依赖；settings 按 section UPDATE，seed 行不可删）→ 回读拍版本；读取层时间戳 **ms 截断**（dev 实测捕获：pg 微秒经 JS ms 管道截断 → 恒等 round-trip 伪 diff）
  - `apps/api/src/services/HomePublishService.ts` + `home-publish.schemas.ts` — **新建**：publish 时序 = 陈旧双信号 409（base_version_no 失配 ∨ 三表直写晚于草稿；无强制覆盖参数防误覆盖热修）→ 整页重校验（modules video 引用可见性/可播性，#5 口径挪点；banner linkTarget=short_id 非本口径对象）→ 单事务 → audit `home_page.publish`（targetId=版本行 UUID，afterJsonb 轻量摘要 versionNo/baseVersionNo/sectionsChanged/counts；sectionsChanged 剥离 createdAt/updatedAt 元数据防伪报）；zod 整页校验（7 区块 settings 全覆盖 + slot×refType 094 CHECK 镜像第 4 处 + brand 约束；banner slot 模块放行——恢复路径非新建，ADR-181 冻结的是编辑器入口）
  - `apps/api/src/routes/admin/home-publish.ts` — **新建**独立子路由（home.ts 248 行 + 新端点防 500 硬限）：GET/PUT/DELETE /admin/home/draft + POST /admin/home/publish（无草稿 data:null 200 / 422 / 409 信封）；server.ts 注册
  - `tests/unit/api/home-publish.test.ts` — **新建** 21 用例：draft 读写删（401/422 ×4 整页校验）/ publish（无草稿 422 / 双信号 409 ×2 / 重校验 409 / 乐观锁竞态 409 / 冷启动 happy + audit R-MID-1 payload 内容断言）/ computeSectionsChanged 4 例（元数据剥离）；audit-log-coverage（REQUIRED + PAYLOAD_ASSERTION +home_page.publish）+ enums-set-equal 镜像同步
  - `docs/architecture.md` — 097/098 两表 + 端点 #1–#4 + audit 枚举 17 种同步
- **新增依赖**：无
- **数据库变更**：migration 097 + 098（dev 已应用）；`admin_audit_log.target_kind` CHECK 16→17
- **注意事项**：① **ADR-185 D-185-1 闭环**（版本快照 + 草稿覆盖层模型 + 两表 + 冷启动；其中 1.5 后半「回滚端点版本数<2 → 422」随 rollback 端点归卡 26 兑现，已注记其范围）；端点 #5–#7 / 画布切草稿 / 缓存失效分别归卡 26/25/27，对应 D 编号闭环随各卡记入；② dev 实测全链路：冷启动发布 v1（20 modules + 2 banners 快照，三表行 id round-trip 20/20+2/2 保留，公开 shelf 链路无恙=「前台读路径零改动」实证）→ 恒等重发布 v2 sectionsChanged []（伪报修复实证）→ 门面 #3 直写后发布 409 信号② → 草稿丢弃幂等 true/false；③ 实施陷阱记档：**pg 微秒精度 × JS ms 管道 = 恒等 round-trip 伪 diff**——版本快照/比较层凡涉 timestamptz 文本化必须 ms 截断（卡 26 diff 展示消费同受益）；④ 门禁：typecheck/lint 绿 + test:changed 升全量 6965/6965（types 基础包自动升全量；StagingTable 首跑 1 例并发 flake，隔离 13/13 + 复跑全量绿）+ verify:adr-contracts EXIT=0（admin 路由 214→218 全对齐）+ `npm run test:e2e:admin` 87/87 EXIT=0（UI 零改动，labels 文件 additive）。

## [CHG-HOME-GOV-PLAN-ERRATA] 治理方案 §6/§14 缺图口径勘误 + 发布确认义务移交（SEQ-20260605-05 卡 22，docs-only）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 02:10
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `docs/designs/home-operations-governance-plan_20260605.md` — §6.1 strike + 勘误（image_url NOT NULL → 缺图态不可达，实际口径 = 尺寸/比例/探测失败三类警告）；§6 校验级别小结「缺图」除名；§14 验收第 5 条同步更正；§17 修订记录 +1
  - `docs/task-queue.md` — Phase 4 占位行 +`CHG-HOME-DRAFT-PUBLISH` 验收项移交注记（「发布确认」处横图警告标记，卡 23 细化时写入验收标准）
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① 勘误原文全部 strike 保留（与方案既有两次勘误范式一致）；② 警告级不阻断口径（D-052-9）不变，仅「缺图」一类经 schema 吸收除名；③ docs-only，test:changed 自动跳过（ADR-180）。

## [CHG-HOME-PHASE4-ADR] ADR-185 发布治理 — 版本快照 + 草稿覆盖层 + 7 端点协议 + 缓存失效（SEQ-20260605-05 卡 23 / 全序列收口）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 02:50
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)（CONDITIONAL PASS：1 HIGH + 4 MEDIUM + 2 LOW 全 7 条吸收后 Accepted；MUST-8 Opus PASS）
- **修改文件**：
  - `docs/decisions.md` — **ADR-185**（决策要点 1–6 全部为协议裁定，**本卡零实施**——D 编号闭环归实施卡 24–27 各自完成时记入 changelog，本条目有意不引用 D-185-N 字面量防 verify-adr-d-numbers 误判闭环〔Codex stop-time review 修正〕）：版本快照 + 草稿覆盖层（前台读路径零改动 / roll-forward 回滚 / 不设保留上限 + follow-up）；写路径三层清单（HIGH 吸收：门面 #3/#5/#6 停止承接画布写、保留为非画布旁路；§11.1 风险显式声明）；7 新 admin 端点契约（draft CRUD + publish + versions + rollback；audit 枚举拆分表述 + UNSUPPORTED 显式防御；与 ADR-138 行级回滚语义区分）；diff 归消费端；子前缀级精确 scan 删失效协议（D-184-5.2 接口位对账〔卡 19 已实施闭环〕+ 失效失败不回滚发布）
  - `docs/task-queue.md` — Phase 4 占位 3 卡细化为 4 卡（24 DRAFT-PUBLISH-A / 25 -B / 26 AUDIT-ROLLBACK / 27 CACHE-INVALIDATE，依赖序 24→25→26∥27）+ SEQ-20260605-05 状态 → ✅ 全 23 卡收口
- **新增依赖**：无 ｜ **数据库变更**：无（migration 097/098 归实施卡 24）
- **注意事项**：① **SEQ-20260605-05 全序列收口**——治理方案（home-operations-governance-plan_20260605.md）实施面全闭环：Phase 1–3 + 公开消费切换 + E2E 覆盖 + 勘误 + Phase 4 ADR；仅余 Phase 4 实施 4 卡（已细化登记待开始）；② ADR-181→185 五份关联 ADR 全 Accepted（各自 arch-reviewer Opus PASS）；③ 门禁：verify:adr-contracts EXIT=0（ADR 端点 97→104，「### 端点契约」表 verify-endpoint-adr 解析兼容）；docs-only（test:changed 自动跳过）。

## [CHG-ENRICH-DOUBAN-CONSISTENCY-ADR] ADR-186 外部 ID cache 列 fill-if-empty 写入语义 + 富集匹配状态落地一致性不变量（SEQ-20260607-01 卡 1）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 12:30
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)（独立设计裁定 Q1–Q8 / CONDITIONAL PASS：Q3 metadata_source 降级一票否决项 + 4 必修条件全数纳入决策要点）
- **修改文件**：
  - `docs/decisions.md` — **ADR-186**（Accepted / 本卡零实施，D 编号闭环归实施卡 A/B）：消除「列表豆瓣图标（douban_status=matched）但编辑 douban_id 为空」数据面脱钩；裁定 fill-if-empty 写入语义（外部 ID cache 列当前 NULL 时低优先级源可填充，非 NULL 维持 ADR-020 规则 D 优先级保护）+ metadata_source 不降级硬约束（一票否决项）+ status 如实降级口径（doubanId∈skippedFields → candidate）+ 落地一致性不变量 INV-1/INV-2（含 redirect 脱钩已知例外）+ 与 ADR-020 澄清性补充关系 + ADR-177 exact 写侧复用
  - `docs/tasks.md` — ADR 卡完成清空 ｜ `docs/task-queue.md` — SEQ-20260607-01 序列登记 + 卡 1 → ✅
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① 根因调查结论：UI 把「匹配判定」douban_status 当「数据已落地」用，二者由写侧分别产生互不校验；safeUpdate 4 条静默拒绝写 doubanId 路径（优先级整体拦截/字段锁/exact 冲突降级/catalog 重绑脱钩）；② 用户裁定 fill-if-empty + 含存量矫正脚本（2026-06-07）；③ 拆 A（safeUpdate 写侧 / opus）→ B（enrich 接线 + 矫正脚本 / sonnet）串行；④ docs-only（test:changed 自动跳过 / ADR-180）。

## [CHG-ENRICH-DOUBAN-CONSISTENCY-A] MediaCatalogService.safeUpdate 外部 ID fill-if-empty 写侧 + metadata_source 不降级（SEQ-20260607-01 卡 2）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 12:48
- **执行模型**：claude-opus-4-8
- **子代理**：arch-reviewer (claude-opus-4-8)（ADR 设计裁定承接，A 卡实施其 Q1–Q8 结论）
- **修改文件**：
  - `apps/api/src/services/MediaCatalogService.ts` — ① 新增 `EXTERNAL_REF_FIELD_KEYS`（CATALOG_EXTERNAL_REF_FIELDS 派生）② 优先级闸门改造（D-186-2）：低优先级源不再整段 return，逐字段判定——外部 ID cache 列且 `current[key]==null` 且 value 非空 → fillable 放行进锁循环/exact 写侧；内容字段/非空外部 ID/null 清空进锁循环前剔除计入 skippedFields；fillableKeys 空时维持整段 skip（行为逐值不变）③ metadata_source 不降级硬约束（D-186-3 一票否决项）：`...(isLowerPriority ? {} : { metadataSource: source })`
  - `tests/unit/api/mediaCatalogSafeUpdate.test.ts` — makeCatalog 扩 doubanId/bangumiSubjectId override + 新增 describe「ADR-186 fill-if-empty」9 例（必修②metadata_source 不降级 / ④内容字段不放行 / ⑦低优先级整段 skip 回归 + ①fill 命中 / ③非 NULL 不 fill / ⑤exact 冲突降级 / ⑥硬锁 / ⑧bangumi 对称 / 对照同优先级仍更新 metadata_source）
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① fill-if-empty 限 douban_id/bangumi_subject_id 两字段（imdb/tmdb 零自动写入方不纳入，D-186-1 follow-up）；② 返回契约 `{updated, skippedFields}` 不扩字段（D-186-4 写侧，调用侧判定归 B 卡）；③ exact 冲突/字段锁路径零改动复用（D-186-5）；④ 门禁：typecheck 绿 / lint 无 error / test:changed 52 files 766 tests 全过（mediaCatalogSafeUpdate 26）/ verify:adr-contracts EXIT=0。

## [CHG-ENRICH-DOUBAN-CONSISTENCY-B] MetadataEnrichService status 接线 + 存量矫正脚本（SEQ-20260607-01 卡 3 / 序列收口）
- **完成时间**：2026-06-07
- **记录时间**：2026-06-07 13:00
- **执行模型**：claude-opus-4-8
- **子代理**：无
- **修改文件**：
  - `apps/api/src/services/MetadataEnrichService.ts` — 新增私有 `finalizeDoubanAutoWrite`（据 `skippedFields.includes('doubanId')` 判 landed → matched/candidate，同步 recordDoubanSignal + writeExternalRef 用最终 refStatus）；step1-imdb/step1-title/step2 三处重构为「先 safeUpdate 再据落地结果判 status」（candidate 路径行为不变）。三处状态一致：douban_status / meta_quality.douban_match_status / video_external_refs.match_status（D-186-4 / INV-1/INV-2）
  - `apps/api/src/services/DoubanService.ts` — confirmSubject/confirmFields 加 `skippedFields.includes('doubanId')` → 返回 `douban_id_conflict`（exact 冲突时人工 confirm 不虚标 matched；`if(!updated)` 不足以捕获，arch-reviewer Q4）
  - `scripts/fix-douban-status-consistency.ts`（新建）— 存量矫正：圈定 douban_status=matched 且 catalog.douban_id NULL，有 douban ref → candidate / 孤儿 → unmatched；dry-run 优先 + 事务化双批 UPDATE
  - `tests/unit/api/metadataEnrich.test.ts` — +2 例（必修⑨ skippedFields 含 doubanId → 降级 candidate + 三处状态一致 / ⑩ skippedFields 空 → matched 回归）
- **新增依赖**：无 ｜ **数据库变更**：无
- **注意事项**：① 仅处理 douban；bangumi_status 同构（follow-up：复制脚本改 provider/列名）；② syncVideo 不写 douban_status 故无图标虚标 + 改 SyncReason 类型扩散，登记不改；③ episodes 写入与 douban 绑定状态正交，降级 candidate 仍照写（沿既有口径）；④ 矫正脚本不自动补写（补写须走 enrich 完整逻辑 + 网络）——重置 status 后由下次 enrich（A 卡 fill-if-empty 生效）/ 人工 confirm 收敛；⑤ 门禁：typecheck 绿 / lint 无 error / test:changed 178 全过（metadataEnrich 35 / doubanService-manual 5 / douban 12）/ 脚本单独 tsc 编译通过。
- **SEQ-20260607-01 全序列收口**：ADR-186（决策）+ A（safeUpdate fill-if-empty 写侧）+ B（enrich status 接线 + 存量矫正），「富集匹配成功但 douban_id 空」脱钩闭环。运维需在生产执行 `node --env-file=.env.local --import tsx scripts/fix-douban-status-consistency.ts --dry-run` 预览后正式跑一次矫正存量。
- **FIX（Codex stop-time review，2026-06-07）**：矫正脚本会创建 unusable candidate 态——原判定「有任意 douban ref → candidate」太粗，但审核台 douban-candidate（DoubanService.getCandidateData）只查 `match_status='candidate'` 的 ref；若 video 的 douban ref 实为 auto_matched（虚标典型）或 rejected，降级 candidate 后列表显示候选黄点却点开无候选可确认（违反 INV-2）。修正 `scripts/fix-douban-status-consistency.ts`：圈定改 `EXISTS(... match_status='candidate')` → has_candidate_ref，仅存在 candidate ref 才降级 candidate，否则 unmatched（下次 enrich fill-if-empty 重新评估写正确 ref）。脚本单独 tsc 编译通过。
