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

## [SEQ-20260607-02] DOUBAN-SEARCH-RESOLVER-WIRE — 移除失效豆瓣搜索链路，接入 douban-adapter resolver

- **状态**：✅ 已完成（1/1 卡收口 2026-06-07 14:15）
- **创建时间**：2026-06-07 14:00
- **最后更新时间**：2026-06-07 14:15
- **目标**：`apps/api/src/lib/douban.searchDouban` 从失效端点 `movie.douban.com/j/subject_suggest`（实测恒 `[]`）切到 `douban-adapter` resolver（search.douban.com `window.__DATA__`，实测可用）；删除同文件失效详情链路 `getDoubanDetail`（302 验证墙）死代码。
- **范围**：`apps/api/src/lib/doubanAdapter.ts`（+resolver 单例 + `searchDoubanRich`）+ `apps/api/src/lib/douban.ts`（换源 + 删死代码，保 `SuggestItem` 契约）+ 对应单测。**不改**消费方（DoubanService / MetadataEnrichService / utils）、**不改** server-next 前端类型。
- **根因（调查结论）**：主工程搜索/详情接两个已被豆瓣反爬封死的端点；可用端点封装在 `douban-adapter` 包内，详情侧 `getDoubanDetailRich` 已接、搜索侧未接线。
- **决策口径**（用户 2026-06-07）：同意修复——移除失效链路 + 接入 douban-adapter + 验证 adapter 功能。
- **依赖**：无外部前置；adapter 模式保 `SuggestItem{id,title,year,sub_title}` 形状 → 零下游契约改动（单层 lib 改动，不跨 schema/api-service/UI）。

### 任务列表（按执行顺序）

1. **CHG-DOUBAN-SEARCH-RESOLVER-WIRE** — doubanAdapter 加 `searchDoubanRich` resolver 单例 + douban.searchDouban 换源 + 删 `getDoubanDetail`/`DoubanSubject`/UA 死代码 + 单测（状态：✅ 已完成 2026-06-07 14:15）
   - 创建时间：2026-06-07 14:00 ｜ 计划开始：2026-06-07 14:00 ｜ 实际开始：2026-06-07 14:00 ｜ 完成时间：2026-06-07 14:15
   - 建议模型：opus（主循环 claude-opus-4-8；非强制升 Opus 子代理情形——保公开签名/返回类型不变、零下游契约改动、非新 ADR、非播放器 core/shell）
   - 完成备注：① `doubanAdapter.ts` 加 resolver 懒单例（复用 `createBasicRuntime()`——`DoubanDetailsRuntime` ⊇ `DoubanResolverRuntime`）+ 导出 `searchDoubanRich(query, year?)`（try/catch 吸收 resolver `DoubanError` → `[]`）+ re-export `DoubanResolvedCandidate`；② `douban.ts` 删失效死代码（`getDoubanDetail`/`DoubanSubject`/`USER_AGENTS`/`pickUA`/`extractNames`），`searchDouban` 改 `delay()`→`searchDoubanRich`→`map(mapResolvedToSuggest)`，导出纯映射 `mapResolvedToSuggest`，保 `SuggestItem`/`delay`，删旧"去年份重搜"回退（resolver 已统一 year 排序）；**`SuggestItem` 形状不变 → 消费方零改动**；③ `douban.test.ts` 修 L329 测试名误称；④ 新增 `doubanSearch.test.ts`（10 例：映射 3 + 接线/降级 4 + ……实际 7 例）。**实测验证（临时脚本，已删）**：详情路径 `getDoubanDetailRich` ✅ 完整命中（流浪地球 7.9/2019/导演/题材/演员/国家/语言；HTML challenge_page 自动降级 mobile-api）；搜索路径接线/解析/降级全正确，但豆瓣实时返回 `error_info:"搜索访问太频繁"`、`items:[]`（**环境性频率限流**，非代码缺陷——旧 subject_suggest 是永久失效，新 resolver 是可用端点配 delay+手动触发）。门禁：typecheck 绿 / lint 绿 / test:changed 13 文件 185 测试全过（doubanSearch 7 / douban 12 / metadataEnrich 35 / doubanService-manual 5 / stagingDouban 11）。执行模型: claude-opus-4-8；子代理: 无。
   - **follow-up（未立卡，观察记录）**：resolver `parseSearchPageData` 当前不区分「限流 error_info」与「真无结果」（均 → `[]`）；若需限流可重试语义，应在 `external-adapter/douban-adapter` 包内识别 `error_info` 抛 retriable error（独立卡，超本卡 4 文件范围，不在此处改 shared 包）。
   - **FIX（Codex stop-time review，2026-06-07）**：新搜索链路丢失请求超时（旧 fetch 带 `AbortSignal.timeout(8000)`，换源后 `createBasicRuntime` 的 `fetchWithVerification` 裸 fetch 无 signal → 豆瓣挂起无限等待）。修正 `doubanAdapter.ts` 加 `fetchWithTimeout`（未自带 signal 时注入 `AbortSignal.timeout(10_000)`），套用 `fetch`+`fetchWithVerification` 两路；新增 `tests/unit/api/doubanAdapter.test.ts`（2 例）。门禁复跑全绿（test:changed 14 文件 187 测试）。

---

## [SEQ-20260607-03] DOUBAN-HOT-ACQUISITION — 全面落实豆瓣热门资源获取能力（采集优先，展示后置）

- **状态**：✅ 已完成（本期 4 卡全收口 2026-06-07 16:40：ADR-187 + adapter 服务 + 持久层 + 编排抓取 job；全 16 合集实测落库 1294 行。后续卡 CHG-DOUBAN-HOT-WIRE 展示接线待用户按接口另起）
- **创建时间**：2026-06-07 15:00
- **最后更新时间**：2026-06-07 16:40
- **目标**：妥善全面落实豆瓣**热门合集资源采集 + 落库能力**（实测 16 个可用合集：电影 5 / 剧集 8 / 综艺 3，含热门·热映·即将上映·Top250·口碑榜·分国别）。**不按站内映射/产品展示过滤**，全量字段入库；产品展示（首页接线）后期按接口丰富。
- **范围**：`external-adapter/douban-adapter`（新 subject_collection 服务）+ `apps/api`（迁移建表 / queries / lib 包装 / 定时抓取 job）。**不改** home autofill、**不触** ADR-183 展示治理、**不删** douban_entries。
- **用户裁定**（2026-06-07）：豆瓣热门资源获取要全面做透，不能被「当前产品只展示站内有的视频」反向裁剪数据层；展示后期再按接口丰富。
- **依赖**：内部串行 ADR(187) → ADAPTER → STORE；展示接线（卡 4）后续另起。
- **决策口径**：见计划 `~/.claude/plans/steady-sparking-taco.md`（ADR-187 落地决策要点 1–6）。

### 任务列表（按执行顺序，串行）

1. **CHG-DOUBAN-HOT-ADR** — ADR-187 起草：采集模型 / 合集注册表 / schema 字段完备 / 分页全量替换 / 降级 / 与 douban_entries 边界 / 展示后置声明（状态：✅ 已完成 2026-06-07 15:30）
   - 创建时间：2026-06-07 15:00 ｜ 计划开始：2026-06-07 15:00 ｜ 实际开始：2026-06-07 15:00 ｜ 完成时间：2026-06-07 15:30
   - 建议模型：opus（撰写 ADR + 设计共享服务契约/schema → 强制 spawn arch-reviewer Opus 独立裁定）
   - 完成备注：**ADR-187 Accepted**（docs/decisions.md）。arch-reviewer (claude-opus-4-8 / agentId ab4a867db8960c7ff) 独立裁定 Q1–Q8 → CONDITIONAL PASS，揪出 5 必修条件全数纳入决策要点：**M1** items 表加 `raw JSONB`（strip comments）+ `release_date`/`info` 单列（兑现未来展示免重抓）；**M2** BIGSERIAL PK + UNIQUE(collection,douban_id)、索引 (collection,rank)+(douban_id)、rank 语义写死（拉取序位非评分）；**M3** 新增合集级 `douban_collection_sync_state` 表（last_success_at 等）+ **key 失效静默清空守护**（成功但 items 骤降→不替换保留旧 + warn）；**M4** 4 条不变量（同事务原子 / 零反哺 entries / raw strip comments / 注册表红线对齐）；**M5** 量化延时·超时·header 复用 + 队列归属裁定（复用 maintenanceQueue）+ 封顶有据（注册表 maxItems）。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。
   - 验收要点：ADR-187 Accepted（arch-reviewer Opus PASS）；零实施；task-queue 卡细化。

2. **CHG-DOUBAN-HOT-ADAPTER** — douban-adapter 包新增 subject_collection 服务（全字段归一化 + 类型 + 解析 + 测试）（状态：✅ 已完成 2026-06-07 16:00）
   - 创建时间：2026-06-07 15:00 ｜ 实际开始：2026-06-07 15:40 ｜ 完成时间：2026-06-07 16:00
   - 建议模型：opus（共享包公开 API 契约 / commit 强制 `Subagents: arch-reviewer` trailer）
   - 完成备注：**实施 ADR-187 D-187-1/3**。新建 `subject-collection.{types,helpers,service}.ts`（仿 recommendations 范式）：`createDoubanSubjectCollectionService(runtime).getItems({collection,start?,count?})` → `{collection,total,items}`；`DoubanCollectionItem` 全字段归一化（id/title/originalTitle/cardSubtitle/info/year/ratingValue/ratingCount/coverUrl/uri/releaseDate/subjectType/hasLinewatch/**raw**）；`normalizeCollectionItem` **strip comments 入 raw**（INV-2）+ id/title 缺失过滤；`buildSubjectCollectionUrl`（count clamp ≤ MAX=50 对齐 recommendations）；header 复用 recommendations（Referer m.douban.com + UA + Accept-Language）；非 200 抛 DoubanError。`ports/runtime.ts` 加 `DoubanSubjectCollectionRuntime extends FetchPort` + `DoubanSubjectCollectionService`；`index.ts` 导出 service+类型+helpers+runtime 类型。测试 +1（external-package.test.ts，含 strip comments + 脏数据过滤 + 无评分 null 断言）+ fixture `SUBJECT_COLLECTION_API_DATA`。门禁：adapter `npm test` 14/14（build tsc 过）/ 主仓 typecheck 绿 / lint 5/5 / test:changed 0 相关。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 ADR 阶段裁定服务契约，卡 2 承接实施)。
   - 依赖：ADR ✅。

3. **CHG-DOUBAN-HOT-STORE-A** — 持久层：迁移建表（items + sync_state）+ architecture.md + queries + lib 包装（状态：✅ 已完成 2026-06-07 16:25）
   - 创建时间：2026-06-07 16:05 ｜ 实际开始：2026-06-07 16:05 ｜ 完成时间：2026-06-07 16:25 ｜ 拆分自原 CHG-DOUBAN-HOT-STORE（>5 项 + 跨 schema/queries/worker → 拆 A/B）
   - 建议模型：opus
   - 完成备注：**实施 ADR-187 D-187-1/4/5/6/7**。迁移 099 建 `external_data.douban_collection_items`（20 列含 raw JSONB/release_date/info；BIGSERIAL PK + UNIQUE(collection,douban_id) + idx(collection,rank)/(douban_id)，M1/M2）+ `external_data.douban_collection_sync_state`（collection PK + last_attempt/success_at + last_status + last_error + item_count，M3）；architecture.md §5.5 + 迁移清单同步。queries `douban-collections.ts`：`replaceCollectionItems`（db.connect 事务 DELETE+批量 INSERT+sync_state UPSERT ok，M4①；parseYear 防御 year='' → null）+ `recordCollectionSyncState`（failed/empty_guard，DO UPDATE SET **不重置 last_success_at** 保留陈旧度，D-187-5）+ `getCollectionSyncState` + `listCollectionItems`。`doubanAdapter.getDoubanCollectionItems`（懒单例复用 createBasicRuntime+fetchWithTimeout；try/catch → **null 区分抓取失败 vs items:[] 空**）。`doubanCollections.test.ts` 6 例（事务序/ROLLBACK/sync_state 不重置 success/映射）。门禁：migrate dev 落 2 表 4 索引 / typecheck 绿 / lint 5/5 / test:changed 15 文件 193 测试。执行模型: claude-opus-4-8；子代理: 无（实施 ADR 既定 schema，arch-reviewer 已在 ADR 阶段裁定 M1/M2/M3）。
   - 依赖：CHG-DOUBAN-HOT-ADAPTER ✅。

4. **CHG-DOUBAN-HOT-STORE-B** — 编排：合集注册表 + 抓取 refresh 服务（分页全量 + empty_guard）+ maintenance job kind + scheduler tick（状态：✅ 已完成 2026-06-07 16:40）
   - 创建时间：2026-06-07 16:05 ｜ 实际开始：2026-06-07 16:30 ｜ 完成时间：2026-06-07 16:40
   - 建议模型：opus
   - 完成备注：**实施 ADR-187 D-187-2/3/4/8**。`services/douban-collections/registry.ts`（`DOUBAN_COLLECTIONS` 16 项 + domain/category/maxItems + PAGE_SIZE=50/GLOBAL_MAX_ITEMS=600/延时/guard 阈值常量）+ `refresh.ts`（`collectAllItems` 分页全量累积 rank + 中途/首页失败 → null 整轮失败；`refreshCollection` 失败/empty_guard 判定 → replaceCollectionItems；`refreshAllCollections` 遍历 + 合集间 2s 延时 + 单合集异常隔离记 failed）。`maintenanceWorker` 加 job type `refresh-douban-collections` → refreshAllCollections + 汇总日志；`maintenanceScheduler` 加 6h tick（server.ts 已注册 maintenance 无需改）+ getSchedulerStatus。`doubanCollectionsRefresh.test.ts` 7 例（单页/分页 rank 连续/失败/empty_guard 空/骤降/首轮不误判/refreshAll 隔离）。**端到端实测（临时脚本 run-and-delete）：全 16 合集 ok 落库合计 1294 行**（movie_hot_gaia 330/top250 250/tv_hot 247…），字段齐全、raw 不含 comments、sync_state 全 ok 带 last_success_at。门禁：typecheck 绿 / lint 5/5 / test:changed 3 文件 48 测试（refresh 7 + scheduler 关联 system-config 29 + background-event 12）。执行模型: claude-opus-4-8；子代理: 无。
   - **FIX（Codex stop-time review，2026-06-07）**：refresh 长任务（60–90s）阻塞共享 maintenanceQueue（concurrency=1）+ tick 用 Date.now() jobId 可重复入队。修正拆独立 `doubanCollectionsQueue` + 专属 worker/scheduler（固定 jobId 幂等 + removeOnComplete/Fail 释放），回退 maintenance 两处改动 + server.ts 注册（opt-out `DOUBAN_COLLECTIONS_SCHEDULER_ENABLED`）+ ADR-187 D-187-8 AMENDMENT；新增 scheduler 单测 2 例。门禁：typecheck/lint/test:changed 59 文件 687 测试全过。
   - 依赖：CHG-DOUBAN-HOT-STORE-A ✅。

### 后续卡登记（本期不实施）

- **CHG-DOUBAN-HOT-WIRE**（占位待立案）：首页热门段落候选源接 `douban_collection_items`（桥表映射门控 / gap / policy 版本 / 与 ADR-183 展示治理关系届时决策）。待用户按接口定展示口径后另起。

---
## 序列编号约束声明

**重要**：新任务序列号不得与历史归档中的序号重复。历史已完成序列已分段归档：

- `docs/archive/task-queue/task-queue_archive_20260427.md` — SEQ-20260319-* ~ SEQ-20260426-01（M0 ~ M-SN-0 启动准备）
- `docs/archive/task-queue/task-queue_archive_M-SN-1-to-6_20260523.md` — SEQ-20260428-01 ~ CHG-SN-6-29-FOLLOWUP（M-SN-1 ~ M-SN-6）
- `docs/archive/task-queue/task-queue_archive_SEQ-20260521-06_20260523.md` — SEQ-20260521-06（GAPS 高 ROI 闭合明细）
- `docs/archive/task-queue/task-queue_archive_M-SN-7-to-META_20260605.md` — M-SN-7 跟踪卡 + 设计稿对齐重做 + SEQ-20260521-* ~ SEQ-20260531-01（M-SN-7 ~ M-SN-9 / CRAWLER W1-W3 / MOD Wave 1-4 / META / DTR；含 META-13 backlog、META-15-A DEFER 等残留提示）

当前及后续任务使用新序列号；本文件保留 SEQ-20260524-01（M-SN-9 容器）+ SEQ-20260601-01 起全部序列。

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
   - **方案文件**：`docs/archive/2026Q2/datatable-header-redesign-plan_20260523.md` v3（11/11 决策点 + arch-reviewer R-149-1..9 全消解）
   - **ADR**：`docs/decisions.md` line 11942 · ADR-149 ✅ Accepted（@livefree PASS）/ ADR-103 第 5 次 AMENDMENT
   - **子代理**：arch-reviewer (claude-opus-4-7) 评级 **A− CONDITIONAL PASS** / 9 修订消解
   - **后续 EP**（ADR PASS 后启动，5 段渐进 / typecheck 不破裂）：
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-1** · types.ts deprecate + column-matrix-menu.tsx + dt-styles 矩阵样式 + 39 单测 — 状态：✅ 已完成（2026-05-23 / 实际 0.5w / 39/39 PASS / typecheck + lint + verify 全过）
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-2** · 列名 toggle 互斥 + ⋯ button stopPropagation + columnTriggerVisibility 三态 + 12 单测 — 状态：✅ 已完成（2026-05-23 / 12 新 + 30 旧测试更新全 PASS / typecheck + lint + verify 全过）
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-3** · 删 hidden-columns-menu + filter-chips **两**文件（filter-chip.tsx 保留 / D-149-10 vs D-149-11 矛盾修正）+ 11 集成单测 — 状态：✅ 已完成（2026-05-23 / 4 质量门禁全过）

   **ADR-149 AMENDMENT 1（2026-05-24）— D-149-13/14/15 + EP 序列重写 4→7 段**：
   - **CHG-SN-9-DT-HEADER-REDESIGN-ADR-AMEND-1** · D-149-13 toolbar.search 槽位约定 + D-149-14 三槽位职责闭合 + D-149-15 业务 key 桥接合约 — 状态：✅ 已完成（2026-05-31 收口对齐：原 arch-reviewer A− CONDITIONAL PASS / 9 修订消解；下游实施 EP-4/4.5/5-* 全 ✅ + Wave 3/4 用户验收签字 2026-05-29 → ADR-149 AMENDMENT 1 de-facto Accepted）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4** · DataTableSearchInput 原语 + IME + 2 合规消费方（CrawlerSiteList + SourcesClient）接入 + 13 单测 — 状态：✅ 已完成（2026-05-24 / 4 质量门禁全过 / 全 4751 unit 0 flaky / 范围调整：4 违规消费方含 search 合并 EP-5-*）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4-HOTFIX** · DataTableSearchInput 光标失焦修复（受控 → 半 uncontrolled / DOM 自管 value + ref 同步 + selection 保留）+ 5 focus persistence 单测 — 状态：✅ 已完成（2026-05-24 / 4 质量门禁全过 / 全 4756 unit 0 flaky）
   - **CHG-SN-9-DT-HEADER-REDESIGN-ADR-AMEND-2** · D-149-16 矩阵触发器接入 DataTable 主组件 toolbar + EP 序列 7→8 段插入 EP-4.5 — 状态：✅ 已完成（2026-05-31 收口对齐：原 arch-reviewer B+→A− CONDITIONAL PASS / 10 修订消解含 2 BLOCKER；下游实施 EP-4.5 ✅ + Wave 3/4 用户验收签字 2026-05-29 → ADR-149 AMENDMENT 2 de-facto Accepted）
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

## [SEQ-20260601-01] 视频库 / 播放线路 职责重定义与表格重设计

- **状态**：✅ 已完成（全 15 卡 ✅ / CHG-VSR-7 序列收官回归 2026-06-02；header 状态漂移于 2026-06-05 CHORE-DOCS-CLEANUP-20260605 收口对齐，参照 MAINT-DOC-CLEANUP-20260531 先例；后续散卡 CHG-VSR-SOURCES-ROW-ACTIONS 归 SEQ-20260602-02 / CHG-VSR-LASTCHECKED-FILTER-ALIGN 独立 Codex review 卡均已 ✅）
- **创建时间**：2026-06-01 19:15
- **最后更新时间**：2026-06-05（收口对齐；任务全 ✅ 实际完成于 2026-06-02）
- **目标**：落地《视频库/播放线路职责重定义》设计方案——视频库=作品维度、播放线路=资源运维维度、别名独立页；表格头部极简(搜索+列设置) + 三层过滤 + B 方案快捷筛选；术语裁决（失效=探测②含连接/试播/异常、禁用=is_active①、待补源=无可播源含已上架）；用户投稿/失效举报整体下线。
- **范围**：`apps/server-next`（/admin/videos + /admin/sources 两 client + 子组件）+ `apps/api`（videos/sources 聚合 + 过滤排序 + distinct 白名单 + submit 端点 410）+ `packages/admin-ui`（KpiCard pressed）+ `packages/types`（双表 DTO/术语）+ `apps/web-next`（移除投稿入口）。
- **依赖**：设计方案 ✅（`docs/designs/videos-sources-responsibility-redesign_20260601.md` / commit e1950050）。ADR：ADR-117 amendment（sources 聚合）+ ADR-150 amendment（distinct 白名单 + country 逻辑表）；ADR-124 不触碰。
- **方案全文**：`docs/designs/videos-sources-responsibility-redesign_20260601.md`（§6 拆卡表 + 各节落地点）。
- **执行节奏**：前置 `PRE-1 / PRE-2 / PRE-3` + 契约卡 `1` 先行 → API `2 / 3` → UI `4 / 5 / 6` → 回归 `7`；`8` 独立。Opus 强制：PRE-2 / PRE-3 / 1 + 2·3 的 ADR amendment 部分。
- **依赖链**：前置 `PRE-1 / PRE-2 / PRE-3 / 1`（可并行）→ `(2,3)` → `(4,5,6)` → `7`；`8` 任意时点。

### 任务列表（按执行顺序）

1. **CHG-VSR-PRE-1** — 前置：两 client 超限文件拆分（解 500 行硬限）（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-01 19:15
   - 完成时间：2026-06-01 19:40
   - 建议模型：sonnet（纯重构，零行为变化）
   - 文件范围：`VideoListClient.tsx`(788→400L) 抽 `buildVideoColumns`→VideoColumns.tsx + `BatchActionsRow`→VideoBatchActions.tsx；`SourcesClient.tsx`(623→376L) 抽 `buildColumns`→SourceColumns.tsx。
   - 完成备注：3 新文件（VideoColumns 268 / VideoBatchActions 143 / SourceColumns 260）+ 2 改文件 import 收敛。**typecheck/lint EXIT=0 + 全量 5902 passed 零回归**。file-size-budget 本卡改善（22→20 违规，两目标文件移除）；剩 20 为既有 debt（范围外不修），`sources-matrix.ts` 759L 留 CHG-VSR-3 拆。e2e 跳过（纯抽分零行为变化）。详见 changelog CHG-VSR-PRE-1。

2. **CHG-VSR-PRE-2** — 前置：抽中性 `useSourceLinesController(videoId)`（§5.5）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 完成备注：**蓝图 R1-R5 / Y1-Y4 全实施**。新建 `lib/sources/use-source-lines-controller.ts`（312 行 / state·actions·options 三面 / R2 乐观锁 toggle〔乐观更新+409 重 fetch+非 race 回滚〕/ R3 videoIdRef batch stale-write / R4 结构化 `SourceActionResult` 经 `onActionResult` 注入·localized 反馈留消费方 / R5 `fetchHealth` 仅取数·drawer 留消费方 / Y4 `onLoaded` 留首行选；duck-typed 错误归类对齐 use-sources）。R1 方案 B：source 操作真源移到 `lib/sources/api`（fetchVideoSources 显式 `active=all` 待校准点① / +9 fn + 7 result 类型），`lib/moderation/api` re-export 保后兼容、`ContentSourceRow`→`SourceLineRowData` 别名。Y1：`lib/sources/types` 新增 `SourceLineRowData`（ContentSourceRow∪VideoSource∩RawSourceRow，派生 optional）+ `SourceActionResult`(+code)。两消费方迁移：`moderation/LinesPanel`(341→219，删 8 state+handler)+ `TabLines`(useVideoSources→controller，新增 probe/render)。**门禁全过**：typecheck 8ws / lint(三新改文件零新警告) / verify:adr-contracts / verify:endpoint-adr EXIT=0 / **全量 5949 passed 零失败零 flaky**（新增 hook 14 用例 + 受影响 moderation-api 15 / use-sources 11 / lines-panel 16 / use-selected-line 7 全绿）。**e2e**：审核台 3 spec 需 playwright 测试 env 启 server-next（mock cookie auth），本机运行栈中间件走真实 :4000 → 307 login + :3000 webServer 冲突 → 全在**页面加载/鉴权步失败（组件逻辑之前），非本卡回归**（curl 实证 /admin/moderation→307）；集成契约零变更（PendingCenter + admin-ui LinesPanel Y2 未触及）；e2e 真门禁归 CHG-VSR-7。**注意**：① 审核台 toggle 升级为乐观更新（R2 明示）；② `lib/videos/use-sources.ts` 成孤儿（保留+单测仍验 videos/api）；③ drawer 逻辑 2 处重复待 CHG-VSR-6（3 处）提取 `useLineHealthDrawer`。**Codex stop-time review FIX（并发安全 / 4 轮）**：toggle 失败对账 ① 整组 `setLines(snapshot)`→仅回滚目标行；② 单行回滚仍覆盖**同一行**并发 confirmed（disableDead）→ 改 server 真相重 fetch；③ 整组 `setLines(fresh)` 仍覆盖期间落地的**更新 confirmed 写** → 外科式只对账目标行 + `externallyModifiedRef` 同行 is_active 保护；④ re-fetch 成功分支**整行替换** `freshTarget` 仍覆盖**同行其他字段**（并发 probe 的 probe_status/latency）→ **终修为字段级**（只对账 is_active + updated_at，保留同行其他字段）。至此除 reload 外全部 setLines 路径字段级。抽 helper 降嵌套；新增共 5 回归用例 + 测试隔离改 resetAllMocks；复跑全量 5954 passed（hook 19 用例连跑 3 次稳定）。详见 changelog CHG-VSR-PRE-2。执行模型: claude-opus-4-8
   - 创建时间：2026-06-01 19:15
   - 建议模型：**opus**（共享 hook 契约 / 跨 3 消费方）
   - 子代理调用：arch-reviewer (claude-opus-4-8) — CONDITIONAL PASS + 5 红线 + 4 黄线（蓝图见下）
   - 约束：**禁止 `/admin/sources` 反向 import `/admin/moderation` 内部组件**（依赖方向单向）。
   - 门禁：共享 hook 契约 → Opus 评审 + commit trailer `Subagents: arch-reviewer (...)`。
   - 验收要点：审核台 / 编辑抽屉 / 线路展开三方共用同一 controller，功能零回归。
   - 依赖：PRE-1 ✅（软依赖）。

   **arch-reviewer 蓝图（落地依据 / 2026-06-01）：**
   - **位置/命名**：`apps/server-next/src/lib/sources/use-source-lines-controller.ts`，返回 `[state, actions]`（对齐 useVideoSources 范式）。
   - **R1 api 去重（方案 B）**：把 source 操作从 `lib/moderation/api` **移到** `lib/sources/api.ts`（fetchVideoSources/toggleSource/disableDeadSources/refetchSources/probeOneSource/renderCheckOneSource/batchProbeVideo/batchRenderCheckVideo/fetchLineHealth/toDisplayState + result 类型）；`lib/moderation/api` re-export 保后兼容（blast radius 已核实：source 操作目前无跨模块消费）。**禁方案 A**（hook 反向依赖 moderation）。
   - **Y1 中性行类型**：新增 `lib/sources/types.ts` `SourceLineRowData`（ContentSourceRow ∪ VideoSource ∩ admin-ui `RawSourceRow`；alias 字段 + quality_detected 均 optional；**勿复名** 既有 `SourceLineRow`）。**admin-ui 零改动**（Y2，规避 types.ts Props 门禁）。
   - **R2 乐观锁**：toggle 采 use-sources 的「乐观更新 + 409 REVIEW_RACE 重 fetch + 非 race 回滚 snapshot」完整版，统一进 hook；**审核台原无乐观更新 → 行为变更点，须回归**。
   - **R3**：`videoIdRef` batch stale-write 防御内建 hook。
   - **R4 反馈注入**：hook 不 push toast/alert，只产出结构化 `SourceActionResult`，经 `options.onActionResult` 注入（审核台→useToast / TabLines→alert(VE) / 展开区自定）。
   - **R5 health drawer**：留消费方（open/page/title/i18n 各异）；hook 仅暴露 `fetchHealth(sourceId,page)`。
   - **Y4**：`onLineSelect`/`onSourceHealthChanged`/首行自动选 留消费方（经 `options.onLoaded`）。
   - **待校准点（实施前必查）**：① 统一 fetch 用 `active=all`（审核台现 fetchVideoSources 无 active 参数=默认，会丢禁用源行）；② 后端 `/admin/sources?videoId=` 单行已确认同时返回 quality_detected + codename/retired_at/auto_retired（feasibility ✅，但注意 sources.ts 有两查询分支，确认走透传 alias 的分支）；③ batch 回填 `latencyMs`→`latency_ms` camel→snake（Y3）。
   - **state/actions 面**：state{lines/loading/error/actionError/togglingIds/probingIds/renderCheckingIds/probingAllSources/renderCheckingAllSources/disableDeadPending/refetchPending}；actions{reload/toggleEpisode/disableDead/refetch/probeEpisode/renderCheckEpisode/probeAllSources/renderCheckAllSources/fetchHealth}；options{onLoaded/onActionResult}。
   - **迁移**：moderation/LinesPanel.tsx 341→~140L（删 8 state+handler，onLoaded 放首行 onLineSelect，onActionResult 映射现有全部 toast case，drawer 本地保留）；TabLines.tsx 改用 hook（新增 probe/render 能力）+ alert 经 onActionResult；CHG-VSR-6 展开区后续消费。
   - **关键路径回归必查**：409 红条 / batch 切视频 stale-write / 首次 onLineSelect 切源 / toast 全 case / pill 联动 / TabLines 乐观更新一致性 / 禁用源行不丢。

3. **CHG-VSR-PRE-3** — 前置：KpiCard 扩 `pressed` / `data-active` / `aria-pressed`（B 选中态）（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-01 19:15
   - 完成时间：2026-06-01 19:50
   - 建议模型：**opus**（共享组件 API 契约）
   - 文件范围：`packages/admin-ui/src/components/cell/kpi-card.types.ts` + `kpi-card.tsx` + 单测（+5）。
   - 完成备注：arch-reviewer Opus **CONDITIONAL PASS → 3 红线全采纳**：R1（用 `--admin-accent-soft/-border` token，禁 `--accent-soft` 不存在 fallback 硬编码）/ R2（`data-active` 存在性 `'true'|undefined`）/ R3（pressed 用 inset box-shadow + soft bg **叠加**，不替换 variant border，is-danger 警示共存）+ Y2/Y3/Y4。typecheck/lint EXIT=0 + **全量 5907 passed 零回归**（kpi-card 54→59）。详见 changelog CHG-VSR-PRE-3。

4. **CHG-VSR-1** — 双表 DTO + 问题枚举 + 术语（连接/试播/异常/禁用）+ 待补源语义 + SourceSegment 仅废弃（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-01 19:15
   - 建议模型：**opus**（改 `@resovo/types` 跨消费方契约）
   - 文件范围：`packages/types`（VideoGroupRow/Stats 扩字段 + 问题枚举 + 待补源派生类型）；`SourceSegment` 加 `@deprecated`（**不改名/不删**）；server-next `lib/videos/types` + `lib/sources/types` 镜像。
   - 门禁：`@resovo/types` 契约 → 强制 Opus 子代理 + commit trailer `Subagents: arch-reviewer (...)`。
   - 验收要点：类型可被卡 2/3/4/5/6 增量消费；SourceSegment 兼容保留；typecheck 零回归。
   - 依赖：无（契约地基，建议早做）。
   - 完成备注：**纯加性契约地基**——`sources-matrix.types.ts` 新增 3 枚举（`SOURCE_QUICK_FILTERS`/`SOURCE_PROBLEM_KINDS`/`NEEDS_SOURCE_SEVERITIES`，ADR-157 双形态）+ VideoGroupRow 12 派生列 optional（可用源/连接失败/试播失败/待探测/禁用/质量档+覆盖率+延迟中位/待补源/isPublished/lastCheckedAt）+ VideoGroupListParams（quickFilters 数组 + lowQuality bool 双入口 OR 合流 + lastChecked range + sortField 扩 activeSources/quality/lastChecked）+ VideoGroupStats 4 KPI optional（abnormal/needsSource/pendingProbe/lowQuality）；`SourceSegment` 加 `@deprecated`；`index.ts` + server-next `lib/sources/types.ts` 桥接补 const value re-export（A-1/A-2）；server-next `VideoAdminRow` 镜像 7 字段（title_original/country/status/episode_count/current_episodes/total_episodes/bangumi_status，与 VideoAdminDetail 签名逐字一致）。**arch-reviewer Opus CONDITIONAL PASS → 3 BLOCKER（A-1 index value re-export / A-2 桥接 value re-export / B-1+D-1a 维度①/②注释区隔）+ HIGH（E-1 继承签名一致）+ 5 MEDIUM 全消解**；偏离：`disabledCount` 据设计 §3.2/§3.3「可选中性 badge」确认保留（reviewer 建议可暂不加，按设计文档据实保留）。typecheck 8 workspace 全过 / lint 5 successful / **全量 5909 passed 零回归** / verify:adr-contracts EXIT=0。纯类型加性无运行时行为，e2e 不适用。详见 changelog CHG-VSR-1。**Codex stop-time review FIX（arch-reviewer 复审 Q1(a)+Q2(A)）**：质量字段对齐 canonical——`qualityLabel:string`→`qualityHighest:ResolutionTier`（复用既有 `StagingRow.qualityHighest`）+ 移除冗余 `qualityRank`（rank 纯 producer SQL 内部键）+ 收口 4 处 `quality_rank` 注释；全仓零引用零回归，再跑 5909 passed。**Codex review 第 2 轮 FIX（聚合语义）**：上版注释误导「口径对齐 `pickHighestQuality`」（该函数仅 quality_detected、丢 `quality` 回退），改正 `qualityHighest`/`lowQuality` 注释为「逐源 `quality_detected ?? quality` 回退后取最高档」+ 显式警告卡 3 勿照搬 pickHighestQuality（设计 §0.2/§3.3 D-12）；纯 JSDoc 零回归，5909 passed。**Codex review 第 3 轮 FIX（虚指 canonical）**：注释误称 `QUALITY_ORDER` 为 canonical——实为 `aggregate.ts` admin-ui module-local 非导出常量，唯一 canonical 是 `ResolutionTier` 类型。改正：值域复用 `ResolutionTier`、档位序显式拼出（4K 最高、无共享常量、producer 在 SQL CASE 实现）；纯 JSDoc 零回归，5909 passed。

5. **CHG-VSR-2** — 视频库 API：集数/Bangumi/meta 质量 + 过滤升级 + 搜索扩面 + distinct 白名单（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-01 19:15
   - 建议模型：opus（ADR-150 amendment 起草）+ sonnet（实施）
   - 文件范围：`apps/api/src/db/queries/videos.ts`（`AdminVideoListFilters` 加数组 enum / 年份 range / 国家 / 连载 / 豆瓣 / Bangumi / 完整度 range / 集数异常 boolean；`q` 扩 title_original+short_id）；`services/datatable/distinct-whitelist.ts`（加 country/douban_status/bangumi_status + `media_catalog.country` 逻辑表映射）；route + 单测。
   - ADR/门禁：**ADR-150 amendment**；扩现有端点入参/响应（非新 route）→ ADR amendment；若需新增 route → 独立 ADR + Opus PASS（`verify:endpoint-adr`）。
   - 验收要点：新过滤/搜索/排序服务端生效 + SQL identifier 白名单防注入 + 单测覆盖新参数。
   - 依赖：CHG-VSR-1。
   - 完成备注：**ADR-150 AMENDMENT 3（D-150-VSR2-1..5）**——arch-reviewer Opus CONDITIONAL PASS。① `listAdminVideos` 加 14 过滤条件（types[]/yearMin-Max/country[]/catalogStatus[]/isPublished/doubanStatus[]/bangumiStatus[]/metaScoreMin-Max + 派生 episodeMismatch/episodeMissing/metaIncomplete/pendingReview）+ q 扩 title_original+short_id；数组枚举一律 `= ANY($n::text[])` 参数化 + 空数组短路（防注入/防误过滤）；SORT 白名单 +episode_count + route 默认 `updated_at desc`。② distinct **D-150-VSR2-1 采纳方案 B**（加 `media_catalog` 逻辑表直查 country，**拒绝给 distinct 端点加 JOIN** 避免安全面扩张）+ videos 表加 douban_status/bangumi_status；IDENT 正则/启动断言零改动。③ **D-150-VSR2-2 离散 query params**（拒 `?filters=` envelope，apps/api 走 pg）；**D-150-VSR2-3 type 加性 types[] 保留单值**；**D-150-VSR2-4 visibility/review 维持单值零回归**（消费方已验证单值）。VideoService.adminList 加性透传；server-next VideoListFilter 同步（CHG-VSR-1 延后项）；端点契约表 6→7 表。typecheck 8 workspace 全过 / lint EXIT=0 / **全量 5912 passed 零回归**（含新增 5 测试断言；2 failed flaky=`use-filter-presets` post-teardown window，与本卡无关，重跑 0 再现）/ verify:adr-contracts + verify:endpoint-adr EXIT=0。详见 changelog CHG-VSR-2。**Codex review FIX（typed client 可触达）**：`VideoListFilter` 14 字段未在 `lib/videos/api.ts` `listVideos` 序列化（声明却发不出 = 不可触达+内部不一致），补序列化与后端解析对齐（数组 CSV / 布尔 true-false / 范围 String / 派生仅 true）+ 新增 5 序列化测试；全量 5917 passed。

6. **CHG-VSR-3** — 线路聚合 API：可用源数① / 连接失败 / 试播失败 / 待探测 / 质量(quality_rank+覆盖率+延迟中位) / 待补源 + KPI stats ①→②（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 完成备注：**ADR-117 AMENDMENT 3（D-117-VSR3-1..8）全实施**。① **queries 拆 4 文件**（解 759>500 硬限）：`source-line-aliases.ts`(291)/`source-routes.ts`(158)/`video-matrix.ts`(88)/`sources-matrix.ts` 保留 video-groups(759→**381**)，3 新文件全 <500 零新违规；file-size-budget **净改善 -1**（sources-matrix.ts 退出违规列表）。② **派生列**（D-1/-2/-3）：`QUALITY_RANK_EXPR` alias 参数化 module-level const 工厂（Q1 SELECT/Q2 stats/Q3 quickFilter 三处共用、`COALESCE(quality_detected,quality)` 回退口径、勿照搬 pickHighestQuality）+ 单趟聚合 FILTER（active/disabled/connect_fail/render_fail/pending）+ coverage 仅 quality_detected + percentile_cont 延迟中位（全源非空 scope）+ qualityHighest=CASE MAX(rank) 反查 label（质量未知 null 不并入低质量）+ needsSource/isPublished/lastCheckedAt。③ **KPI②**（D-4）：per-video 子查询 g + 外层 COUNT FILTER，①(total/active/dead/orphan) 口径零变更 + 单测逐值回归断言，②(abnormal/needsSource/pendingProbe/lowQuality) 新增；禁①②同层双算。④ **quickFilters**（D-5）：全 WHERE EXISTS（vs5-9）可组合 AND，lowQuality/quickFilter 'low_quality' OR 合流单份谓词（单测断言不双 push）。⑤ **sortField**（D-6）：扩 activeSources/quality/lastChecked 走 SELECT 别名（IDENT 正则零放宽）+ zod enum 同步 + lastChecked HAVING 范围（CHG-VSR-1 "卡 3 实现" 闭环）。⑥ **派生列双层透传**：raw map + Service map 均显式枚举。⑦ **测试 mock 路径迁移**（BLOCKER 方案 A）：7 测试 import/vi.mock/dynamic import 同步迁移新文件（sources-matrix-service vi.mock 拆 3 路径 + namespace import；alias-mutations/retire-priority-audit → source-line-aliases；routes-by-site → source-routes；sources-matrix 直接 import 拆分；admin-source-lines-view 7 处 dynamic import；admin-sources 集成 relative import 拆分）。`sources-routes-mutations-audit`/`admin-sources-sql` grep 实证不受影响。⑧ SourceSegment 保留（卡 5 删）+ 全卡 SQL 零 user_submissions。**门禁全过**：typecheck/lint/verify:adr-contracts/verify:endpoint-adr EXIT=0 / **全量 5933 passed**（1 失败=`VideoImageSection.test.tsx` jsdom waitFor flaky，隔离重跑 21/21 通过、与本卡无关，同 CHG-VSR-2 既有模式）/ 新增 25 单测（派生列 11 + quickFilters 7 + sortField 4 + KPI② 2 + Service 透传 1）。无新 route/error code/migration → architecture.md 零同步。e2e N/A（API-only 无 UI 消费方，留卡 4/5/6 + CHG-VSR-7）。**Codex stop-time review FIX（2 issue 全闭环）**：① lastChecked 排序非时序安全 → 新增真实 timestamptz 列 `last_checked_sort` 供 ORDER BY（DTO 仍读 `::TEXT` last_checked_at），与 updated_at/quality 双列同范式；② SourcesMatrixService.ts 613>500 硬限 → 抽 `sources-matrix.schemas.ts`(146，Zod schema + 结果 DTO + aggregateSignal)，Service 613→**490**(<500)，route/2 测试改 import 路径；**budget 整卡净改善 -2**(21→19)，原既有 debt 偏离消解。复跑全量 5934 passed 零失败 + 4 门禁全过。详见 changelog CHG-VSR-3。
   - **设计已固化（ADR-117 AMENDMENT 3 / decisions.md，D-117-VSR3-1..8）**：arch-reviewer Opus「需修改」→ 2 BLOCKER + 1 HIGH + 3 MEDIUM 全纳入。实施蓝图（零上下文损失）：
     - **拆分（4 文件）**：`source-line-aliases.ts`（别名 CRUD）/ `source-routes.ts`（routes-by-site + 3 mutations）/ `video-matrix.ts`（getVideoMatrix）/ `sources-matrix.ts` 保留 video-groups（~390 行）。
     - **BLOCKER-2（必做）**：≥6 测试 `vi.mock('@/api/db/queries/sources-matrix')` 按路径 mock 别名/route 符号 → Service import + 这些测试 import & vi.mock 路径**同步迁移新文件**（方案 A）。**文件范围须显式含**：`tests/unit/api/{source-line-alias-retire-priority-audit,source-line-alias-mutations,sources-routes-by-site,sources-matrix,sources-matrix-service}.test.ts` + `tests/integration/api/admin-sources.test.ts`（落地时逐一核 grep 实际引用）。
     - **派生列**：单趟聚合 FILTER（D-117-VSR3-1）+ `QUALITY_RANK_EXPR` 单常量三处共用（CASE COALESCE(quality_detected,quality) 7 档，勿照搬 pickHighestQuality）+ qualityHighest=CASE MAX(rank) 反查 label（D-2）+ coverage 仅 quality_detected 实测 + latencyMedian 全源非空 scope（D-3）。
     - **KPI②**：per-video 子查询 + 外层 COUNT FILTER（D-4，**禁①②同层 FILTER 双算**）；保留①（active/dead/orphan）+ 等价回归断言。
     - **quickFilters**：全 WHERE EXISTS（D-5，low_quality=EXISTS 已知质量 AND NOT EXISTS rank>=4）；lowQuality/quickFilter OR 合流单份谓词。
     - **sortField**：新增走 SELECT 别名引用（D-6，IDENT 正则零放宽）+ Service zod enum 同步。
     - 派生列**双层透传**（raw map + Service map 均显式枚举，须两处补）。无新 route/error code/migration；不碰 user_submissions；SourceSegment 保留（卡 5 删）。
   - 创建时间：2026-06-01 19:15
   - 建议模型：opus（ADR-117 amendment 起草）+ sonnet（实施）
   - 文件范围：`apps/api/src/db/queries/sources-matrix.ts`（`listVideoGroups` 增派生列 + `getVideoGroupStats` 5 卡 FILTER 从 `source_check_status`① 切探测②）+ 快捷筛选谓词（含异常/待补源/待探测/低质量 `quality_rank<4`）+ Service 层 + 单测。
   - ADR/门禁：**ADR-117 amendment**；`quality_rank` CASE 7 档（4K=7…240P=1）；待补源=无可播源（含已上架）；**不做失效举报**（不触碰 user_submissions）。
   - 验收要点：5 KPI 计数走探测维度② + 质量口径（`quality_detected ?? quality` / 覆盖率 / 延迟中位）+ 质量未知不并入低质量 + 单测。
   - 依赖：CHG-VSR-1。

7. **CHG-VSR-4-A** — 视频库列重构（复合显示列 + 默认隐藏原子可筛选列 + 数据格式）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-01 19:15
   - 实际开始：2026-06-02 11:47
   - 完成时间：2026-06-02 12:10
   - 建议模型：sonnet
   - 文件范围：videos columns（封面/视频/类型/发行信息/集数/元数据/内容状态/更新/操作 + 默认隐藏原子列 year/country/连载/可见/审核/发布/douban/bangumi/meta_score）；§2.4 数据格式降级（集数 NULL / 已播>收录 warn）。
   - 验收要点：复合显示列只读不挂筛选；默认列与 §2.2 一致；列宽/排序对齐。
   - 依赖：CHG-VSR-1 / CHG-VSR-2 / CHG-VSR-PRE-1。
   - 完成备注：**设计 §2.2/§2.3/§2.4/§2.5/§2.6 列重构落地**。① `VideoColumns.tsx`（269→~430，声明性<500）默认可见 9 列重组（cover / title「视频」副行 `{title_en ?? title_original} · {short_id}` / type / **release** 复合〔`{year}·CountryName`+Pill 完结/连载/未知〕/ **episodes** §2.4 降级 / **meta** EnrichmentBadgeCluster〔enrichment→meta 重命名〕/ **status** 复合〔VisChip+发布 dot〕/ updated / actions）；§2.3 降级默认隐藏 source_health(保留排序)/probe/image_health；§2.6② 默认隐藏原子列 year/country/catalog_status/visibility/review_status/is_published/douban_status/bangumi_status/meta_score(render-only，filter 接线留 4-B)。② **复合列与未接线列一律显式 `filterable:false`**（D-150-AMD2-1 data-kind 默认 filterable=true / §2.6「只读不挂筛选」硬约束），4-A 筛选面收敛 = title/type/visibility/review_status（既有可用）。③ **排序对齐**：DataTable 以 column.id 作 sort.field（`sortable` 仅看 enableSorting，无 sortField 契约 / 沿用 CHG-VSR-5-A 先例）→ `buildVideoFilter` 加 `COMPOSITE_SORT_MAP`（release→year/episodes→episode_count/meta→meta_score/status→review_status）+ 白名单 +episode_count；default sort `created_at desc`→`updated_at desc`（§2.5）。④ `VIDEO_COLUMN_DESCRIPTORS` 同步 22 条；新建 `VideoColumns.test.tsx` 25 用例 + `enrichment-cluster-faces.test` 同步列重构（descriptor enrichment→meta / 锚点改 title 文本）。**门禁全过**：typecheck 8ws / lint 5 successful（零新警告）/ verify:adr-contracts / verify:endpoint-adr EXIT=0 / **全量 451 files 5984 passed 0 failed 零 flaky**（净 +25 本卡测试）。**范围外（留 4-B）**：原子列 enum/range filter 接线 + 搜索框 q 多列 + 快捷筛选 B + VideoRowActions 扩展 + 导出 CSV 移 PageHeader + FilterChipBar 删 + 视图保存移除。**e2e**：video specs 仅依赖 video-list-table/title 文本/row-actions/cover·actions resize handle/batch（列无关 columnheader handle）→ 结构零破坏（grep 实证无旧列依赖）；实跑因本机鉴权 env（:3003→307 走真实 :4000）阻塞归 CHG-VSR-7。详见 changelog CHG-VSR-4-A。**Codex stop-time review FIX（回访用户列布局失效）**：`useTableQuery` 列可见性持久化 localStorage，storage-sync 仅 schema 校验不对账默认可见性变化 → 回访用户旧偏好覆盖新默认列集（source_health/probe/visibility/review 仍显示、updated 仍隐藏）→ 新默认表不可靠 ship。修复：tableId `'admin-videos'`→`'admin-videos-v2'`（既有 :v1→:v2 版本失效范式定向 bump 本表，不动 admin-ui 共享 LAYOUT_VERSION）；新建 `VideoListClient.layout-reset.test.tsx` 回归（预置旧 key stale 偏好断言新默认生效；护栏验证 revert tableId 转红）。复跑 typecheck/lint EXIT=0 + videos 9 files 117 passed（+1）。执行模型: claude-opus-4-8

8. **CHG-VSR-4-B** — 视频库三层过滤 + 行操作 + 快捷筛选(B 统计计数)（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-01 19:15
   - 实际开始：2026-06-02 13:10
   - 完成时间：2026-06-02 13:40
   - 建议模型：sonnet
   - 用户裁决（2026-06-02）：Q1=前端轻量 count 查询（纯前端 3 count 查询读 total）；Q2=扩 VideoEditDrawer 加 initialTab（加性默认 basic）。
   - 完成备注：**设计 §1.1/§2.1/§2.6/§7-7 前端接线落地**（后端过滤参数 CHG-VSR-2 + api 序列化已就绪，本卡纯前端）。① **搜索框**：`VideoFilterBar` 由 status/site 下拉 → 单一 `q` 搜索框（300ms debounce + filtersRef 防并发列筛选丢失 + 外部 q 同步 + 卸载清 timer；多列 ILIKE 后端承担）。② **原子列筛选接线**：7 列 `filterable:true`（year/meta_score `number`→min/max；country `enum`+distinct `media_catalog.country`；catalog_status/is_published/douban_status/bangumi_status `enum`+静态选项）；`buildVideoFilter` 扩 `getEnumArray/getRange` 映射（数组/范围/isPublished bool）；复合列保持 `filterable:false`（§0.3 阻断项 1 不扩 DataTable 契约）。③ **快捷筛选 B**：PageHeader 子标题「{total} 条 · 全部 · 待审/元数据缺失/集数不一致」可点击 chip（aria-pressed + 可组合 AND + 全部清空 + 切换回 page1），独立 React `Set` state（不入 filters Map 规避 bool URL 往返歧义）；计数走 3 个 `listVideos({k:true,limit:1})` 读 total（Q1=A，全局口径，挂载/批量后刷新）。④ **行操作**：`VideoEditDrawer` 加性 `initialTab`（Q2=A），`onEditRequest(id,tab?)` 透传，新增 图片→images / 外部元数据→external / 查看播放线路→lines。⑤ **头部清理**：删 FilterChipBar（§1.1-5）+ buildFilterChips 死代码 + viewsConfig（视图保存暂缓 §7-7）+ sites/saved-views 消费；导出 CSV 接到 PageHeader 按钮。⑥ `fetchDistinct` 加性入 `lib/videos/api`（复用 `/admin/_dt/distinct`，country ISO→中文 label）。**门禁全过**：typecheck 8ws / lint 5 successful（4 改文件零新警告）/ verify:adr-contracts / verify:endpoint-adr EXIT=0（203 路由对齐无新端点）/ **全量 452 files 5993 passed + 1 flaky**（CrawlerRunsView jsdom 计时器干扰，隔离 33/33 通过，crawler 正交）。**范围偏离（用户授权）**：VideoEditDrawer + lib/videos/api.ts 超字面文件范围 → Q2=A 授权 + 验收必要支撑。**注意**：①计数全局口径不随 search 变化（§2.1）；②快捷筛选不持久化 URL（会话态）；③saved-views.ts 孤儿 = 视图保存暂缓有意保留；④e2e 归 CHG-VSR-7。详见 changelog CHG-VSR-4-B。执行模型: claude-opus-4-8
   - 文件范围：搜索框(q 多列) + 列头菜单原子列筛选 + 页面级统计计数快捷筛选（待审/元数据缺失/集数不一致，点击切换/可组合）；VideoRowActions（编辑/图片/外部元数据/审核/合并/前台/查看播放线路）；导出 CSV 移 PageHeader；视图保存暂缓移除。
   - 验收要点：表格头部仅搜索+列设置；无筛选下拉行 / 已选过滤 chip 条；快捷筛选 B 生效。
   - 依赖：CHG-VSR-4-A。

9. **CHG-VSR-5-A** — 播放线路结构重构：删四 Tab + 删内嵌别名 Tab + 列重构（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
   - 完成备注：**设计 §3.1/§3.2 结构重构落地**。① `SourcesClient.tsx`(377→264)：删 `SEGMENTS` 四 Tab（grouped/dead/correction/orphan）+ segment state/param + 主体「线路矩阵/全局别名表」Tab + `activeTab='aliases'` 分支 + 内嵌 `SourceLineAliasPanel`；保留 PageHeader「线路别名管理→」跳转 + KPI 4 卡（display only，5-B 重建 5 张可点击）；删手动「刷新」按钮（自动 refetch，保留 retryKey 供 ErrorState）；sort 守卫改列 id→API sortField 映射（video/coverage→activeSources/quality/lastChecked）；日期过滤 updatedAt→lastChecked。② `SourceColumns.tsx`(260→290)：按 §3.2 重建列集 video(副标题 `{type}·{short_id}`)/coverage(复合 线·源·可用，可用 0 染 danger，sortable)/probe(探测)/render(试播)/quality(`{qualityHighest ?? 质量未知}`+已检测%+延迟中位ms，sortable)/issues(`Pill` badges 待补源/连接失败/试播失败/待探测/禁用)/sites(站点)/last_checked(最近检测，sortable+date filter)/actions；**保留列 id video/probeStatus/renderStatus/siteKey** 不破坏 smoke e2e；删 lineCount/sourceCount 独立列（并入 coverage）；filterOptions 文案改「连接失败/试播失败」。③ `lib/sources/api.ts`：补 lastCheckedFrom/To 序列化（last_checked 过滤可触达，CHG-VSR-2 教训）。④ `SourcesClient.test.tsx`：同步改 4 测试（删四 Tab/别名 Tab/segment 断言 → 改为负向断言 + 派生列渲染断言），8 passed。**门禁全过**：typecheck/lint/verify:adr-contracts EXIT=0 / **全量 5931 passed + 1 flaky**（`StagingEditPanel` admin/staging，隔离 12/12 通过，与本卡无关）/ file-size-budget 19 中性（两文件均<500）。**范围外（留后续）**：KPI 5 卡 pressed + quality boolean 过滤 + quickFilters/lowQuality 序列化 + 删 SourceSegment 枚举 → 5-B；MatrixExpand→LinesPanel → 6；e2e 正式回归 → 7；`SourceLineAliasPanel.tsx` 成孤儿未删（设计 §4「暂保留兼容历史 IA」/ 清理 follow-up）。**Codex stop-time review FIX（展示与排序契约）**：① 默认排序违反 §3.4 → 初始 sort 改 `{ lastChecked, desc }`（原 undefined → 后端兜底 updated_at desc，且列头无排序指示符 §1.1-4）；② probe/render/issues 补显式 `enableSorting:false`（§3.4 禁排序，sortable 集严格 = video/coverage/quality/last_checked）；单测补默认排序断言；复跑全量 5932 passed 零失败。**e2e smoke 同步修复并实跑**：test 1 断言改 sortField=lastChecked desc，实跑 test 1（我改的）+ test 2 + test 4 **PASS**（直连 :3003 绕 :3000 webServer 冲突）。**test 3（probe filter「应用」按钮 outside viewport）现红 → 已立追踪卡 CHG-VSR-DTAF-VIEWPORT**（admin-ui popover 视口溢出，根因 max-height 480 无 flip-up；取 5-A 前 042a43ef 同样失败证既有缺陷非本卡回归；阻塞 CHG-VSR-7 e2e 门禁）。不再「未追踪」。详见 changelog CHG-VSR-5-A。
   - 创建时间：2026-06-01 19:15
   - 建议模型：sonnet
   - 文件范围：`SourcesClient.tsx`（删 SEGMENTS Tab 行 + activeTab=aliases 分支 + 内嵌 `SourceLineAliasPanel`；保留别名管理跳转）；columns（覆盖/探测/试播/质量/问题=连接失败·试播失败·待探测/站点/最近检测）；刷新改自动 refetch。
   - 验收要点：四 Tab / 别名 Tab 移除；列与 §3.2 一致；文案用「连接失败/试播失败」。
   - 依赖：CHG-VSR-1 / CHG-VSR-3 / CHG-VSR-PRE-1。

10. **CHG-VSR-5-B** — 播放线路快捷筛选(B：可点击 KPI 卡 pressed) + 列头筛选 + 删 SourceSegment（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 完成备注：**sources 页收尾（设计 §3.5/§4）**。① **5 KPI 卡 = 可点击快捷筛选**：`SourcesClient` grid 4→5 列，卡 = 全部(total/清空) + 含异常源(abnormal) + 待补源(needsSource) + 待探测(pendingProbe) + 低质量(lowQuality)，消费 CHG-VSR-3 ②维度 stats；`KpiCard` onClick+pressed（PRE-3）切换 quickFilter（`ActiveQuickFilter` Set 状态 / 可组合 AND / pressed 选中态 aria-pressed+data-active / 全部=清空）；旧 ①维度 4 卡（总播放源/有效/失效/孤岛）退场。② **quality 列「低质量」boolean 列筛选**：DataTableAutoFilter 无 boolean 控件 → 单选 enum `[{value:'low'}]` filterFieldName='lowQuality'，client 派生 lowQuality=true（与 KPI 低质量卡后端 D-5 OR 合流）。③ **typed client 序列化**：`lib/sources/api.ts` 补 quickFilters(csv) + lowQuality(仅 true)。④ **删 SourceSegment**（末尾）：`packages/types`(删 type + VideoGroupListParams.segment) / `apps/api/sources-matrix.ts`(删 import/re-export + segment 分支) / `sources-matrix.schemas.ts`(删 schema segment) / server-next `types.ts`(删 re-export) / `api.ts`(删 segment 序列化)；测试 admin-sources 集成 3 segment→quickFilters/lowQuality + sources-api-url 复合透传去 segment + 新增 quickFilters/lowQuality 序列化测试 + SourcesClient KPI 测试改 5 卡 + quickFilter 点击交互。**全仓 SourceSegment 代码零引用**。**门禁全过**：typecheck/lint/verify:adr-contracts/verify:endpoint-adr EXIT=0 / **全量 5934 passed + 1 flaky**（`CrawlerClient` 导出 CSV，隔离 66/66 通过、与本卡 sources 无关）。**e2e 主动实跑**：sources smoke test 1/2/4 PASS（直连 :3003 绕 :3000），test 3 仍 = 已追踪 CHG-VSR-DTAF-VIEWPORT（5-B 零新破坏）。文件 SourcesClient 322 / SourceColumns 302 均<500。详见 changelog CHG-VSR-5-B。
    - 创建时间：2026-06-01 19:15
    - 建议模型：sonnet
    - 文件范围：5 KPI 卡（全部/含异常源/待补源/待探测/低质量）= 可点击筛选（pressed/可组合/全部清空）；列头菜单筛选（探测/试播/站点/质量/最近检测）；**末尾删除 `SourceSegment` 枚举 + segment 查询分支**。
    - 验收要点：KPI 卡选中态生效；快捷筛选谓词正确；SourceSegment 彻底退场。
    - 依赖：CHG-VSR-5-A / CHG-VSR-PRE-3。

11. **CHG-VSR-6** — 用共享 `LinesPanel` 替换 `MatrixExpand`（消费 PRE-2 控制器）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-01 19:15
    - 实际开始时间：2026-06-02
    - 完成备注：删 `MatrixExpand` + 随之死代码（`SourceMatrixRow` 主组件 CHG-VSR-5-A 表格化后无消费方 / `EpisodeCellBlock` / 矩阵网格常量），新建 `SourceLinesExpand.tsx`（消费 `useSourceLinesController(videoId)` + 共享 `LinesPanel` density=regular + client `groupSourcesByLine` + 本地 `LineHealthDrawer`）。**三宗罪修复**：① 消除 render 阶段 setState 发请求（controller useEffect reload）② 消除 `.slice(0,8)` 截断（LinesPanel 全量聚合，任意集数无截断）③ 全操作接通（单集/整组 toggle·probe·render·disableDead·refetch·health + codename/retired/auto_retired 显示）。反馈：toggle/disableDead/refetch 失败→`actionError` 红条 / probe·render·batch→`useToast` 浮层（与审核台 LinesPanel 同口径；内联中文 = sources 模块无 i18n 文件，跟随现状）。**不传** `onLineSelect`（无选中态）/ `onToggleLine`（controller 无 line 级 toggle，与审核台·TabLines 两参考消费方一致）。保留 `SignalPill`（`SourceColumns` 探测/试播列依赖）。`SourcesClient.renderExpandedRow` `MatrixExpand`→`SourceLinesExpand`。**测试**：删 `getVideoMatrix` mock + 补 controller 函数 mock + `toDisplayState` + 新增 12 集行展开测试（点行→经 controller useEffect 调 `fetchVideoSources(videoId)` + LinesPanel 渲染 + `12/12集` 全聚合证不截断）。**门禁全过**：typecheck 8ws / lint（新文件 `SourceLinesExpand` 零新警告 / 既有 `SourcesClient:164` exhaustive-deps 非本卡）/ verify:adr-contracts / verify:endpoint-adr EXIT=0 / **全量 450 files 5955 passed 0 failed 零 flaky**（比 PRE-2 5954 +1=本卡展开测试）。无新端点/schema/ADR（消费已有），architecture.md 零同步。**e2e**：`sources-sort-filter-smoke.spec.ts` 不展开行（测 page-load/sort/filter）+ 全 e2e 无依赖旧 `MatrixExpand` 结构（"matrix" 命中仅无关的 codename-matrix-picker）→ 本卡零 e2e 影响；展开区 e2e 归 CHG-VSR-7（沿用范式，本机鉴权 env 阻塞既有）。drawer 第 3 处本卡内联，提取 `useLineHealthDrawer` 拆 follow-up 卡 14 `CHG-VSR-6-FOLLOWUP-DRAWER-HOOK`（用户裁决 2026-06-02）。**Codex stop-time review FIX（源全量分页）**：`fetchVideoSources`（PRE-2 移入）`limit=100&page=1` 单页 → 源行 >100（长剧集 × 多线路）静默截断（与「任意集数不截断」验收冲突 / 后端 `/admin/sources` limit zod cap=100）→ 改按 `total` 分页循环拉全量（`PAGE_SIZE`=100；终止 空页 ∨ `all>=total`），三消费方（审核台/编辑抽屉/展开区）共享修复；`sources-api-url.test` +4 分页用例；复跑 typecheck/lint EXIT=0 + 全量 5959 tests 5958 passed（1=`VideoImageSection` 既有 jsdom flaky 隔离 21/21 通过，非本卡）。详见 changelog CHG-VSR-6。执行模型: claude-opus-4-8
    - 用户裁决（2026-06-02）：drawer 第 3 处本卡内联（仿 TabLines），提取 `useLineHealthDrawer` 留独立 follow-up 卡（Opus 评审 + 审核台关键路径回归）。
    - 建议模型：sonnet
    - 文件范围：删 `SourceMatrixRow.tsx` 的 `MatrixExpand`；展开区 `renderExpandedRow` 接 `<LinesPanel>` + `useSourceLinesController` + `groupSourcesByLine`。
    - 约束：不扩 `getVideoMatrix`；client 端聚合；不反向 import 审核台内部。
    - 验收要点：任意集数不截断（消除 `.slice(0,8)`）+ 消除 render 阶段请求 + 全操作接通（含 codename/retired/auto_retired）。
    - 依赖：CHG-VSR-PRE-2 / CHG-VSR-5-A。

12. **CHG-VSR-7** — 回归测试（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-01 19:15
    - 实际开始：2026-06-02 14:45
    - 完成时间：2026-06-02 15:05
    - 建议模型：sonnet
    - 完成备注：**VSR 序列收官回归全过**。三门禁：`test -- --run` 453 files 6001 passed + 2 flaky（AuditClient/StagingEditPanel 隔离各 22/22、12/12 过 = 并行污染既有 flaky 非回归）/ verify:adr-contracts + verify:endpoint-adr EXIT=0 / typecheck 8ws + lint 5 successful。**VIDEO/SOURCES e2e 18/18 PASS**（videos 5 + videos-column-resize 5 + sources-smoke 4〔含 DTAF-VIEWPORT 验证〕+ codename-matrix 4，admin-next-chromium 直连 :3003）。**厘清 VIDEO e2e 长期「鉴权 env」阻塞真因 = fall-through `route.continue()` 把 admin shell 未匹配请求（notifications/background-events/jobs）漏到真实 :4000 → 401 → apiClient refresh 失败重定向 /login**（非 VSR 功能回归）；修：videos 两 spec fall-through 改 404 隔离 + test 2 `filter-q`→`videos-search-input`（4-B 搜索框漂移）+ test 5 确认 locator getByText→getByRole（strict 双命中）。仅测试基建修复零生产代码改动。功能域覆盖 VSR-1..6 已沉淀无空缺。**Codex stop-time review FIX**：原 closeout 误判根因为「缺 /auth/me mock」并补了死 mock；诊断证明 /auth/me 从未调用（死代码），真修复是 404 fall-through，已删死 auth mock + 改正根因，删后复跑 10 VIDEO e2e 仍全绿。详见 changelog。执行模型: claude-opus-4-8
    - 范围：动漫集数 / Bangumi 筛选 / 连接失败 / 试播失败 / 待补源 / 待探测 / 批量探测 / 长剧集展开；e2e（VIDEO/SOURCES 路径）。
    - 验收要点：`test -- --run` + `test:e2e` + `verify:adr-contracts` 全过；零回归。
    - 依赖：CHG-VSR-4-B ✅ / CHG-VSR-5-B ✅ / CHG-VSR-6 ✅ / **CHG-VSR-DTAF-VIEWPORT ✅（e2e 门禁前置已解：sources smoke test 3 实测转绿 2026-06-02）**。

12.5. **CHG-VSR-DTAF-VIEWPORT** — `DataTableAutoFilter` popover 视口溢出修复（高页面「应用」按钮不可达）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-02
    - 实际开始：2026-06-02 14:05
    - 完成时间：2026-06-02 14:35
    - 完成备注：**视口感知定位**。`header-menu.tsx` 纯函数 `computeHeaderMenuPosition`——下方放得下完整 **且 footer 距视口底 ≥ SAFE_BOTTOM_GAP(56)** → 向下；否则上方放得下/够用(≥160) → flip-up（CSS `bottom` 锚定表头上沿，footer 落表头上方避底部叠层）；兜底向下贴底 + maxHeight 内滚 + 水平右溢 clamp；统一 `reposition(measure)` 替换原恒向下两 effect（开启实测自然宽高缓存、scroll/resize 仅重锚）。`dt-styles-matrix.ts` autofilter `max-height` 改 `var(--dt-autofilter-max-height, 480px)` + value-list `min-height:0`。**根因**：原恒 `top:rect.bottom+4` 致中部表头 footer 压视口底/右下角撞 Next dev 浮标。**实测 e2e sources smoke 4/4 PASS**（test 3 目标转绿；test 4 纯 maxHeight 方案曾回归〔footer 压右下角〕→ SAFE_BOTTOM_GAP flip-up 修复，stash 基线对照确认）。门禁全过 + 全量 6002 passed + 1 flaky（StagingEditPanel 隔离过，无关）+ 9 新定位单测。无公开 Props/契约变更 → 不触发 Opus trailer。详见 changelog。执行模型: claude-opus-4-8
    - 建议模型：sonnet（admin-ui 定位逻辑，若改 Props/行为契约则 Opus 评审）
    - **症状**：`/admin/sources` 列头菜单（如「探测」列 ⋯）打开 `DataTableAutoFilter` popover 后，底部 `[data-actions]`「应用」按钮落在视口折叠线下方不可达（playwright `scrollIntoView` 对浮层无效，e2e `sources-sort-filter-smoke.spec.ts` test 3 `filter-probe-status` 红，54 次重试失败）。
    - **根因**：`[data-autofilter-popover]` `max-height: 480px`（`dt-styles-matrix.ts:157`）+ **无视口翻转（flip-up）/ 无 available-below 约束**。从页面靠下列头（sources 页有 4 KPI 卡，表头 y≈350）向下展开 → popover 底部 y≈830 > 720 视口。`[data-value-list]` 内部 240px 滚动不解决整 popover 元素底部出屏。
    - **既有性证明**：取 CHG-VSR-5-A 前版本（commit `042a43ef`，含旧四 Tab 结构、表头更靠下）跑同测试**同样失败**（且更严重）；CHG-VSR-5-A 删 Tab 后表头上移反而改善但不足。**非 CHG-VSR-5-A 引入**。
    - **影响面**：所有高页面表格的 `DataTableAutoFilter`（sources / 潜在 videos 等）。
    - **建议修复方向**：popover 视口感知——空间不足时 flip-up 开向上方，或 `max-height = min(480, 视口可用高度)` + footer `[data-actions]` sticky bottom + body 区滚动。需回归既有 autofilter e2e（多页面）。
    - **文件范围**：`packages/admin-ui/src/components/data-table/{header-menu.tsx 定位 / dt-styles-matrix.ts CSS / data-table-auto-filter.tsx}`。
    - **验收要点**：`sources-sort-filter-smoke.spec.ts` test 3 转绿 + 既有 autofilter e2e 零回归。
    - **关联**：CHG-VSR-5-A 实测暴露（changelog CHG-VSR-5-A）；阻塞 CHG-VSR-7 的 `test:e2e` 门禁。

13. **CHG-VSR-8** — 关闭投稿：`POST /sources/submit` 返 410 Gone 不写库 + 停 verifyFromUserReport（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 无）
    - 完成时间：2026-06-01 20:20
    - 完成备注：纯后端单文件——`sources.ts` submit handler 返 `410 FEATURE_RETIRED` + 不写库 + 删 VerifyService import/实例（submit 是其唯一消费方）；`report-error` 入队重验保留。**前台无调用方**（仅路由定义），无前台改动。测试：sources.test.ts +2（410 断言）/ crawler.test.ts 2 旧 submit 用例（401/202）改 410（实际 submit 测试在此文件，非预期 sources.test.ts）。typecheck/lint/**verify:adr-contracts** EXIT=0 + **全量 5909 passed 零回归**。详见 changelog CHG-VSR-8。
    - 创建时间：2026-06-01 19:15
    - 建议模型：sonnet
    - 文件范围：`apps/api/src/routes/sources.ts`（submit handler 改 410，**保留路由不删**）；`apps/web-next` 投稿 UI 入口移除；`verifyFromUserReport` 投稿触发停用（`report-error` 入队重验保留）。
    - 门禁：非 admin 路由无 ADR-gate；**不得删路由**（CLAUDE.md）；记 changelog。
    - 验收要点：submit 返 410 + 不写库 + 前台无投稿入口；`report-error` 不受影响。
    - 依赖：无（独立，任意时点）。

14. **CHG-VSR-6-FOLLOWUP-DRAWER-HOOK** — 提取共享 `useLineHealthDrawer`（消除 3 处 drawer 重复）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
    - 创建时间：2026-06-02
    - 实际开始：2026-06-02 15:30
    - 完成时间：2026-06-02 16:10
    - 完成备注：**新建中性 hook `useLineHealthDrawer`（arch-reviewer Opus CONDITIONAL PASS 蓝图）+ 3 消费方迁移**。hook 返回 `[state, actions]`，持有 open/sourceId/page/events/total/limit/loading/error + 派生 pagination；**不持有 probeState/renderState/title**（消费方派生 → R-4 审核台保持快照 / TabLines·sources 实时派生，零行为变更）；`fetchHealth` 注入；**requestToken 并发保护**（R-1/R-2 修复现有 3 处 stale 覆盖缺陷）；`loadFailedText` 可选注入（兼容 TabLines 无 error 现状）；分页 `total>limit` limit 取响应真值（R-6 禁硬编码）。门禁全过：typecheck/lint/verify×2 EXIT=0 / **全量 454 files 6015 passed 0 failed 零 flaky**（净 +12 hook 单测）/ hook 12 例（并发/分页/error/no-op）+ SourcesClient 渲染 SourceLinesExpand 过。**审核台 e2e 既有 env 阻塞**（登录重定向先于 LinesPanel 渲染 = 非本卡回归 / PRE-2 已记录），drawer 关键路径回归由 12 例 hook 单测 + typecheck + 全量零回归覆盖。注：TabLines 单页不再显示分页栏（蓝图 R-6 标准化，与 moderation/sources 一致）。详见 changelog。执行模型: claude-opus-4-8
    - 建议模型：**opus**（共享 hook 契约 / 跨 3 消费方 / 触碰审核台并发敏感关键路径 → 强制 Opus 子代理评审 + commit trailer `Subagents: arch-reviewer (...)`）
    - 背景：CHG-VSR-PRE-2 注意 ③ + CHG-VSR-6 引入第 3 处 health drawer 本地实现（`moderation/LinesPanel` + `TabLines` + `SourceLinesExpand` 各一份：open·page·title·events·loading·error + `fetchHealth` 取数）。达 CLAUDE.md「同一 UI 模式 3 处以上必须提取」阈值。
    - 文件范围：新建 `apps/server-next/src/lib/sources/use-line-health-drawer.ts`（中性 hook：open/close/changePage + events/loading/error 状态 + 取数编排）；3 消费方迁移 `moderation/_client/LinesPanel.tsx` + `videos/_client/_videoEdit/TabLines.tsx` + `sources/_client/SourceLinesExpand.tsx`；title 拼接 / i18n 文案 slot 留消费方（各异：M.lines / VE.lines / 内联中文）。
    - 约束：title 拼接与 pagination 阈值差异（moderation `total>20` vs 通用 `total>limit`）须在 hook 契约内协调；**回归审核台关键路径**（健康抽屉开合/分页/probe·render 联动，PRE-2 刚过 4 轮 Codex 并发 review）。
    - 验收要点：3 消费方 drawer 行为零回归 + 单测覆盖 hook + 全量零回归。
    - 依赖：CHG-VSR-6 ✅。

### SEQ-20260601-01 BLOCKER 触发清单

- CHG-VSR-PRE-2 / PRE-3 / 1 任一 Opus 评审出红线未消解 → 暂停。
- 卡 2/3 发现需**新增** admin route（非扩展现有）→ 先起独立 ADR + Opus PASS（`verify:endpoint-adr`），不得直接加 route。
- 复合列被要求挂多条件筛选 → 记 QUESTION，不扩 DataTable 公共契约（§2.6 阻断项 1）。
- 发现需触碰 `user_submissions` 写入 → 暂停（本批次裁决不做，§5.1）。

---

## [SEQ-20260602-01] 后台表格表头行高标准化（表头高度与 body 密度解耦）

- **状态**：✅ 已完成
- **创建时间**：2026-06-02 17:30
- **最后更新时间**：2026-06-02 17:42
- **目标**：统一 server-next 各后台列表表头行高，消除 videos/sources（poster=80px）与其余页面（comfortable=40px）的表头高度断裂。
- **范围**：`packages/admin-ui` DataTable 表头高度逻辑（内部行为，不动公共 Props 契约、不新增 token）。
- **依赖**：无（独立，用户直接指派）。

1. **CHG-DT-HEAD-HEIGHT-DECOUPLE** — 表头行高与 body 行密度解耦（表头恒用 `--row-h` 40px）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-02 17:30
    - 完成时间：2026-06-02 17:42
    - 建议模型：sonnet（共享组件内部行为修正 + 单测；不改 Props 契约 / 不新增 token → 不触发 Opus 门禁）
    - 变更原因：DataTable 表头高度 inline `height: rowHeight` 复用 body 行 density 令牌（`data-table.tsx:142-145` + `data-table-header-row.tsx:85`），poster 密度页面（videos/sources）表头被撑到 80px，与其余 40px 页面视觉断裂。v1 ModernDataTable 表头 `h-12`(48px) 本就与密度解耦——v2 误耦合属回归。
    - 影响的已完成任务：CHG-VSR-4-A/4-B（videos poster 列表）、CHG-VSR-5-A（sources poster 列表）—— 仅表头视觉收敛，body 行/列/筛选零变更。
    - 文件范围：`packages/admin-ui/src/components/data-table/data-table.tsx`（拆 `headerHeight` 常量 = `var(--row-h)`，停止把 density rowHeight 传表头）；`packages/admin-ui/src/components/data-table/data-table-header-row.tsx`（内部 prop `rowHeight`→`headerHeight`，未公开导出）；`tests/unit/components/admin-ui/table/data-table.test.tsx`（+3 解耦断言）。
    - 变更内容：表头行高全站恒定 `var(--row-h)`（40px），与 density 无关；body 行高保留 density 令牌（poster 80 / compact 32 / comfortable 40）。不新增 token、不改公共 Props、不动 `--row-h-relaxed` 悬空令牌（记后续 token 清理）。
    - 验收要点：videos/sources 表头 80→40px；其余页面零变化；body 行高/poster 缩略图零变化；全量单测零回归 + 新增解耦断言通过。
    - 完成备注：表头高度从 `rowHeight`（density 令牌）拆出独立 `headerHeight = 'var(--row-h)'` 常量恒定传 `DataTableHeaderRow`；内部 prop `rowHeight`→`headerHeight` 重命名（`DataTableHeaderRowProps` 未公开导出，零外部影响）；body 行 `rowStyle` 仍用 density `rowHeight` 不变。**videos/sources 表头 80→40px**、crawler 抽屉 32→40px、其余页面不变；body 行高/poster 缩略图零变化。门禁全过：typecheck/lint/verify:adr-contracts EXIT=0 / **全量 454 files 6018 passed 0 failed 零 flaky**（净 +3 解耦断言：poster/compact/comfortable 三态表头恒 `var(--row-h)`）。无新端点/schema/ADR/token。共享层沉淀评估：本身即共享组件内部修正，无需再沉淀。执行模型: claude-opus-4-8

### SEQ-20260602-01 设计标准（确立）

- **后台表格表头行高 = 全站恒定 `var(--row-h)`（40px），与 body 行 density 完全解耦。**
- body 行高继续按 density 取令牌：comfortable 40 / compact 32 / poster 80 / relaxed 48。
- 表头不随 poster/compact 伸缩（表头只渲染列名）；新表格不得给表头单独设密度高度。
- `--row-h-relaxed`（48px）当前为 DataTable 不可达悬空令牌（density union 无 relaxed），本卡不删，记后续 token 清理。

---

## [SEQ-20260602-02] 播放线路表格操作列实装（refresh / zap / more）

- **状态**：✅ 已完成
- **创建时间**：2026-06-02 18:00
- **最后更新时间**：2026-06-02 18:25
- **目标**：实装播放线路表格（SourcesClient/SourceColumns）操作列——设计 §6.2 的 refresh / zap / more 三键真实功能 + UI/UX（pending / toast / 刷新本行）。
- **范围**：apps/server-next sources 模块（行操作组件 + 列定义 + 接线 + 测试），复用既有 api 端点与共享 AdminDropdown/useToast，无新端点/schema/共享契约。
- **依赖**：CHG-VSR-3（VideoGroupRow 派生计数）✅ / CHG-VSR-5-A（列重构）✅。

1. **CHG-VSR-SOURCES-ROW-ACTIONS** — 播放线路表格操作列三键实装（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-02 18:00
    - 完成时间：2026-06-02 18:25
    - 建议模型：sonnet（标准功能实现 + 复用既有 api/共享 AdminDropdown；无新共享契约 / 无 schema → 不触发 Opus 门禁）
    - 变更原因：播放线路表格操作列为纯占位（`SourceColumns.tsx:265-289` ↻/⋯ 仅 `stopPropagation`，无功能），注释「真实接通留 CHG-VSR-5-B + 6」但 5-B/6 均未接，遗留未实装。设计 §6.2 要求 `btn--xs ×3：refresh / zap / more`。
    - 影响的已完成任务：CHG-VSR-5-A（占位列由本卡接通，列 id 不变不破坏 e2e）。
    - 用户裁决（AskUserQuestion 2026-06-02）：① 三键 = refresh(↻) `batchProbeVideo`（重探连接）/ zap(⚡) `batchRenderCheckVideo`（重验播放）/ more(⋯) `AdminDropdown`，均带 pending + toast + 刷新本行；② more 菜单 4 项 = 展开/收起线路 · 重新采集源(`refetchSources`) · 停用全失效源(`disableDeadSources`，danger，仅 connectFail+renderFail>0 显示) · 线路别名管理（深链）。
    - 文件范围：新建 `apps/server-next/src/app/admin/sources/_client/SourceRowActions.tsx`（行操作组件，对齐 videos `VideoRowActions` 范式）；改 `apps/server-next/src/app/admin/sources/_client/SourceColumns.tsx`（`buildColumns` 签名增 `actions` handlers + 操作列 cell 换 `<SourceRowActions>`）；改 `apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx`（传 handlers：`onReload=refresh` / `onExpandToggle=toggleExpand`）；新建 `tests/unit/components/server-next/sources/SourceRowActions.test.tsx`。
    - 变更内容：三键接既有 api（batch-probe / batch-render-check / refetch-sources / disable-dead 端点已存在，无新增）+ `useToast` 反馈（复用 SourceLinesExpand summary 文案口径 `ok/total · dead 失效 · failed 异常`）+ pending 期禁用全部按钮 + 完成后 `onReload` 刷新本行信号；条件菜单项基于 VideoGroupRow 派生计数。
    - 验收要点：三键各调对应 api + toast + 刷新；停用全失效源仅在有失效源时出现 + danger；pending 禁用；列 id 不变（e2e 零破坏）；门禁全过 + 新增组件测试。
    - 完成备注：新建 `SourceRowActions` 组件（范式对齐 videos `VideoRowActions`）：↻=`batchProbeVideo`（重探连接）/ ⚡=`batchRenderCheckVideo`（重验播放）行内键 + ⋯=`AdminDropdown`（展开/收起线路 · 重新采集源`refetchSources` · 停用全失效源`disableDeadSources`〔danger + 仅 `connectFailCount+renderFailCount>0` 显示〕 · 线路别名管理深链）。`run` 统一 pending 守卫（禁用全部按钮）+ 各 handler `try/catch` `useToast` 反馈（复用 SourceLinesExpand summary 文案口径 + level success/warn/danger/info）+ 成功后 `onReload()` 刷新本行聚合信号；容器层 stopPropagation 防误触行展开。`buildColumns(expandedKeys)`→`buildColumns(expandedKeys, actions)` 接 `{onExpandToggle,onReload}`；SourcesClient 抽 `toggleExpand(videoId)`（行点击 + 菜单共用）+ 传 `onReload=refresh`。复用既有 4 端点（batch-probe / batch-render-check / refetch-sources / disable-dead），**无新端点/schema/ADR/共享契约**。门禁全过：typecheck/lint/verify:adr-contracts EXIT=0 / **全量 455 files 6028 passed 0 failed 零 flaky**（净 +10 = SourceRowActions.test U-1..U-10：三键/菜单/条件项/pending/失败不刷新）/ sources 4 文件 37/37（含 SourcesClient.test 渲染新 cell）。列 id `actions` 不变，e2e 零破坏。共享层沉淀评估：app-local 行操作组件（消费方专属），范式已复用共享 AdminDropdown，无需再沉淀。执行模型: claude-opus-4-8
      - **Codex stop-time review FIX（refresh/zap 越权暴露）**：实证核验端点守卫——`batch-probe`(refresh)/`batch-render-check`(zap)=`adminOnly`，`disable-dead`/`refetch`=`moderator+admin`；middleware 使 sources 页 moderator 可达 → moderator 暴露 admin-only 二键。修复：`page.tsx` 读 `user_role` cookie → `isAdmin` 透传 → 非 admin 时 refresh/zap disable+tooltip（对齐 CrawlerSiteExpand/VideoRowActions），more 菜单不门控。+U-11..U-14；全量 455 files 6032 passed 零回归。

---

## [SEQ-20260602-03] 视频身份解析与合并/拆分升级（Entity Resolution）

- **状态**：✅ **主体完结（Phase 0–5 全部任务卡 ✅ / 2026-06-04）+ 遗留项收尾核查完毕（CHG-VIR-CLOSEOUT-AUDIT 2026-06-04：Phase 3 shadow 验收 PASS 收口；4 项后续独立小卡前置未满足、触发条件已逐项量化登记，见任务列表 15.）**
- **创建时间**：2026-06-02 19:41
- **最后更新时间**：2026-06-04 12:45（**CHG-VIR-CLOSEOUT-AUDIT 遗留项收尾核查 ✅ 完毕**——5 项逐一实证：① Phase 3 shadow 验收 **PASS 收口**〔1178 次 ingest 对照 disagree-bind=0 / agree-bind 5 / candidate-only 143；ingest 候选 13 条全部合理〕② findOrCreate 切主读前置未满足〔一致性 HARD=0 全绿 ✅ + 静态对照面由报表等价覆盖 ✅，**实质阻塞 = douban 74 例 REPORT-2 待升级**，需人工 confirm 积累 manual_confirmed 观测〕③ 双写收敛 + cache UNIQUE 复评链式后置 ② ④ 合并端点 + UI ADR 无候选量实证〔冲突簇 0 个〕且应与 CHG-VIR-13 工作台协调 ⑤ 自动绑定 ADR 评估输入不全〔上卷 candidate 12 个零人工裁定〕。各项触发条件已量化登记任务列表 15.，详见 changelog。） / 2026-06-04 05:00（**Phase 5 完结：CHG-VIR-12 全系列（12-A~12-F 六卡）✅ 收口**——**12-A** ADR-176/177 AMENDMENT 8 新 D 条闭合全部开放决策点〔findOrCreate 不纳入 season / series_group 不建表 / 不批量回填 + R-A1 扫描守卫 / 合并脚本先行不起端点 / external_kind 映射 bangumi·douban→subject / douban 维持保守 candidate + R-A2 三口径 / cache UNIQUE 保留 / 对照先行不切主读〕，arch-reviewer PASS-with-conditions 2 必修 + 4 建议全吸收；**12-B** Migration 090/091〔season_number 唯一键改造 + catalog_relations〔swc 有序对 CHECK〕+ catalog_external_refs〔exact 全局唯一 + 去重 partial〕，真实 DB 验证 16 项〕+ seasonNumber 链路 8 处接线；**12-C** 四列回填 244〔bangumi 169 exact + douban 75 candidate，零触碰 cache〕+ 一致性三口径报表 + 半回填态扫描，负向注入三类全检出；**12-D** 写侧原语〔resolveAndWriteExactRef R10 守卫 + RR-A 预检 + insertCandidateRef + demoteExactRef〕+ **safeUpdate 单点接线**〔四列写入面全收敛，YY-C 同事务，conflict 不写 cache〕+ D-174-3 双写起点；**12-E** 上卷规则表纯函数〔R3 保守底线〕+ 脚本〔「冰湖重生」升 exact 首例闭环 75→74，「大猩猩」manual 优先级保守留人工〕+ findOrCreate 旁路对照〔四 outcome pino 日志〕+ 冲突簇报表；**12-F** Migration 092〔11 张快照表 DDL only〕+ CatalogMergeService〔merge 十步 + rollback 数据安全网，dev 完整往返实测 8 断言 + 全复原 + cache 回填/复位 + 防重复回滚〕。门禁链 6320→6355 passed 全绿（净 +35）；6 commits（6831d1f4→ff24a179）。全系列 claude-opus-4-8 + arch-reviewer ×1。**后续独立小卡**（12-A 既定不在系列内）：findOrCreate 切主读〔对照观察期后〕/ 合并端点 + UI ADR / 双写收敛 + cache UNIQUE 复评 Y-A4 / 自动绑定 ADR。**下一步**：Phase 3 shadow 验收观察期或 CHG-VSR-LASTCHECKED-FILTER-ALIGN〔Codex P2〕或长尾系列，留用户裁定。） / 2026-06-03 20:30（**Phase 4 完结：CHG-VIR-11-B + 11-C ✅ 双完结，CHG-VIR-11 全系列收口**——**11-B 拆分实施**：`GET /admin/videos/:id/split-suggestions`〔identity/splitSuggestions 纯函数 + SplitSuggestionsService 瘦编排·线路真源直接复用 getVideoMatrix〕+ SplitSchema targetVideoId xor newVideoMeta + unmerge 仅软删新建 target〔created_target_video_ids + 旧 audit 兜底〕+ MergeSplitSection 建议预填；D-105-1~6 全闭环；6308 passed 净 +39；dev 实测 65.8ms / 注入往返三信号全触发。**11-C 多语种清洗**：Migration 089〔original_language + aliases 5 列 + partial unique〕+ upsertStructuredCatalogAlias + 三步清洗脚本；关键发现 catalog title_en 全列连写拼音 slug 污染 → isConcatenatedPinyin 新增 + 音节分解贪心→DP 修复〔27 fixture 零回归〕；**执行完毕**：迁出 2551/3263〔可逆〕+ original_language 回填 104〔ja=85/en=14/zh-Hans=5〕+ 幂等重跑 0 命中；D-175-1/2/5/6 闭环；6320 passed 净 +12。两卡均 claude-opus-4-8。**下一步**：Phase 5 CHG-VIR-12〔catalog 身份层，依赖 Phase 1-4 稳定〕或 Phase 3 shadow 验收观察期或 CHG-VSR-LASTCHECKED-FILTER-ALIGN〔Codex P2〕，留用户裁定。） / 2026-06-03 18:30（**Phase 4 启动：CHG-VIR-11 拆 3 子卡 + CHG-VIR-11-A ✅ 完结**：原卡范围 ≥ 6 项跨两线〔拆分证据化 / 多语种清洗〕按 M-SN-5 + CHG-VIR-9 先例拆 11-A〔ADR 定档〕/ 11-B〔拆分实施〕/ 11-C〔多语种清洗，依赖 ADR-175 ✅ 可并行〕。**11-A ADR-105 AMENDMENT Accepted**（arch-reviewer × 2 轮：第 1 轮 CONDITIONAL R-A1/R-A2 → **主循环实读反驳 R-A1 断言②③**〔raw_title = 爬虫 payload 标题，per-site 观测有真实分裂信息〕→ 第 2 轮 PASS-with-conditions 全采纳）——`GET /admin/videos/:id/split-suggestions` 只读建议端点（video_sources 线路真源〔键与 getVideoMatrix 逐字一致 R-105-S9〕+ title_observations site 级聚合 facet 信号 + 单维分组 + site 级盲区声明 + intra_site_multi_title 信号）+ SplitSchema targetVideoId xor newVideoMeta（拆到已有 video）+ 冲突预检同 R-105-1 + **unmerge 仅软删新建 target**（snapshot created_target_video_ids / 旧 audit 兜底零行为变更）；6 D 条 + 9 红线 + 5 黄线；零 migration 零代码。门禁 verify:adr-contracts/endpoint-adr/typecheck EXIT=0。claude-opus-4-8 + arch-reviewer (a14ab66155c13a55f + a100cd57de06fca45)。**下一步**：CHG-VIR-11-B〔拆分实施〕→ CHG-VIR-11-C〔多语种清洗〕。） / 2026-06-03 16:00（**CHG-VIR-9-D ✅ 完结**：merge 默认翻 identity + pair→connected-component 页内折叠——启动门禁 arch-reviewer 裁定〔Q1 页内 union-find query 不变 + total 维持 pair 数 + groupKey 成员升序 join；Q2 `candidateIds[]` 扩参互斥 + **硬前提 unmerge 反查 LIMIT 1→复数循环 revert（R8 对称）**；Q3 reject 逐 pair + PairScore.candidateId 锚点；Q4 zod default 与 Service 兜底两处一致翻转〕→ ADR-105a AMENDMENT **D-105a-18**；新建 collapsePairsToGroups.ts〔union-find 纯函数〕+ buildGroupFromCluster〔复用 aggregateGroup〕+ EvidencePanel 逐 pair 拒绝；零 migration 零新端点；门禁全过 **6269 passed / 0 failed 净 +18**；dev 实测 202 pair 默认 identity / 100 pair 折叠 49 行 / 9 个 N>2 分量 / groupKey 幂等 / legacy toggle 正常。claude-opus-4-8 + arch-reviewer agentId ad5a4777ebc076355。**下一步**：Phase 4 CHG-VIR-11〔拆分证据化 + 多语种清洗〕或 Phase 3 验收观察期〔shadow 报表 → 自动绑定 ADR〕或 CHG-VSR-LASTCHECKED-FILTER-ALIGN〔Codex P2〕，留用户裁定。） / 2026-06-03 15:00（**Phase 3 CHG-VIR-10 ✅ 完结**：findOrCreate 旁路 ingest shadow scoring + blocking 第二召回键——前置门禁 Opus 裁定〔①混合 B+C 复用 identity_candidate trigger_source='ingest' + pino 结构化日志，不新建表不加端点；②纳入 external_id 第二召回键〕→ ADR-105a AMENDMENT D-105a-16/17；新建 blockingRecall.ts〔双段召回真源〕+ pairScoringPersist.ts〔评分→hash→upsert 共享层，blockingKeys 改命中桶并集，不 bump SCORER_VERSION〕+ ingestShadow.ts〔召回→评分→候选→bind 判定→日志〕+ findOrCreateWithMatch〔matchedStep 透出，7 处既有消费方零变更〕+ CrawlerService fire-and-forget 接线 + 报表 trigger_source 切片；零 migration〔索引核验已存在〕零端点；生产 catalog_id 零变更 R9+D-105a-12；门禁全过 6251 passed 净 +29；dev 实测 638 桶〔21 ext 新段〕/ +4 ext 新召回 / superseded 24 受控 / ingest 冒烟 31ms。claude-opus-4-8 + arch-reviewer。**下一步**：CHG-VIR-9-D〔merge 翻默认 + 连通分量折叠〕或 Phase 4 CHG-VIR-11，留用户裁定。） / 2026-06-03 12:50（**Phase 2（2a/2b/2c 全系列）收口复核 + Phase 3 启动配置补全**：完成度对照设计 §Phase 2a/2b/2c + §4.3——核心契约全落地、门禁全绿、ADR-105a D 条 14/15 闭环〔唯一 pending D-105a-12 = 守恒条款，Phase 3 验收后另起 ADR 才闭环，非欠账〕+ ADR-178 6/6。落档 4 项：① CHG-VIR-8 完成备注补记蓝图偏离④〔blocking 仅 core_title_key 单 key 召回，多 key 并集未实现，外部 ID 同/标题异 pair 召回不到〕；② CHG-VIR-10 启动前补全〔Opus 前置门禁：shadow decision 持久化形态三选一〔不得塞 identity_decisions，087 CHECK 仅 confirmed/rejected〕+ 外部 ID 第二召回键裁定 / fire-and-forget 性能边界 + ingest 旁路基线另立 / 硬前置生产回填 / 引用校正 Y3→R9+D-105a-12〕；③ 新增 CHG-VIR-OBS-BACKFILL〔生产 title_observations 回填，CHG-VIR-10 与 9-D 双硬前置〕；④ 新增 CHG-VIR-9-D〔merge 翻默认 identity + N-video 连通分量折叠，9-A 登记「留小卡」补建〕。merge_blocklist 复核结论：rejected 状态 + R6 复活链已覆盖其语义，定档舍弃独立表（ADR-105a follow-up 1 视为闭合）。纯 docs 落档无代码变更。） / 2026-06-03 02:40（**Phase 2c CHG-VIR-9-A ✅ 完结**：端点 ADR amendment + 候选来源读切换——ADR-137 AMENDMENT 2.0（similar 默认 identity 空表降级）+ ADR-105a AMENDMENT（merge candidates source default legacy）+ listPendingCandidatesByVideoId/Pairs query + ModerationService/VideoMergesService source 分支 + buildGroupFromPair（抽 schemas）+ schema/前端 api source 参数；向后兼容（旧前端读 similarityScore 不破）；门禁全过 6159 passed 零回归 / claude-opus-4-8 + code-architect。**解阻 CHG-VIR-9-B**。shadow 验证 193 候选已就绪供切 UI。 / **Phase 2b CHG-VIR-8 ✅ 完结**：identity_candidate shadow 表 + 离线生成 job——Migration 086〔表 + 6 索引含 partial unique pending + blocking 表达式索引 + 2 CHECK / 真实 DB 验证约束〕+ identity 模块 5 新文件〔evidenceHash D-105a-8 / candidateUpsert 单事务幂等 R5/R6 / externalIdLoader / offlineRescore Blocking 分桶 pipeline / queries〕+ Bull worker〔apps/api 裁定 A 不跨 ADR-107 §4〕+ 2 脚本〔手动触发 + 对比报表，不切 UI〕+ architecture §5.15 现状同步；code-architect Opus 蓝图；门禁全过 6148 passed 净 +35 / claude-opus-4-8。**解阻 CHG-VIR-9**，离线 candidate 已就绪供 Phase 2c 切 UI。 / **Phase 2a CHG-VIR-7 ✅ 完结**：候选附加多证据身份评分——新建 `apps/api/src/services/identity/` 评分模块〔weights/type-compat/scorePair/aggregateGroup/scoreGroup〕落地 D-105a-3 聚合 + D-105a-5 矩阵 + D-105a-14 release_marker + D-105a-15 group→单值 min/union；`Evidence`/`PairScore`/`GroupIdentityScore` 类型契约（code-architect Opus 蓝图）+ CandidateGroup.identity optional 字段（与 legacyScore 分离 R3）+ listCandidates 集成（候选数量/排序不变 Y-105a-1）+ MergeClient 双 pill + EvidencePanel；外部 ID/集数/metadata 证据留 Phase 2b；去未评估占位保 p95 < 200ms；门禁全过 6115 passed 零回归 / claude-opus-4-8 + code-architect。**解阻 CHG-VIR-8**。 / **Phase 2 前置门禁 CHG-VIR-6.5 ✅ 完结**：ADR-105a AMENDMENT Accepted〔arch-reviewer claude-opus-4-8 / CONDITIONAL → 红线 A1〔release_marker null 语义收窄：仅双方非 null 且不同才 veto〕/ A2〔exact 不豁免〕/ B1〔group 聚合 over all unordered pairs，min+union，零 recommendedTarget 新原语〕+ 黄线 a1/b1/c1 全吸收〕；D-105a-3 补 `release_marker_mismatch` 强负 + 新增 D-105a-14/15 + adr-parser.mjs 正则放宽支持 `D-105a-N`（唯一影响=识别 105a，103a/103b 无 D 编号零变化）；门禁全过 6084 passed 零回归 / claude-opus-4-8。**解除 CHG-VIR-7 硬前置**，Phase 2a 可启动。 / **Phase 1 完结 — CHG-VIR-5 + CHG-VIR-6 ✅**：TitleIdentityParser 纯函数〔core_title_key 并行解析 + facets 七维 + Y4 护栏，40 fixture〕+ title_observations 去重聚合 shadow 表〔migration 085 + 采集链路 fire-and-forget 写入 + F3 容错〕；零生产行为变更、不参与归并决策；全量 6084 passed 零回归 / claude-opus-4-8。**Phase 2 待启动**〔CHG-VIR-7/8/9 候选证据化，CHG-VIR-8/9 建议 opus + 可能需端点 ADR amendment〕，留用户决定。 / **Phase 0 完结 — 四份 ADR 全 Accepted**：CHG-VIR-1/2/3/4 ✅〔ADR-105a/175/176/177〕 **+ 前置门禁 CHG-VIR-PRE-1 ✅**〔insertNewVideo schema 漂移修复 / 全量零回归〕 **+ CHG-VIR-PRE-2 ✅**〔ADR-177 关系定档「并存+上卷」/ arch-reviewer 认可〕；**CHG-VIR-4〔ADR-177〕已 Accepted**〔arch-reviewer CONDITIONAL → RR-A/RR-B 2 必修红线 + 4 黄线吸收 / 哨兵 -1→0 校正 / 10 D 条 + R10 不变量〕。**2026-06-02 22:15 复核 Phase 1** → CHG-VIR-5/6 卡修订〔F1 title_observations 真源=设计 §1b·不另起 ADR / F2 CHG-VIR-5 依赖补 CHG-VIR-2·ADR-175 titleKind / F3 CHG-VIR-6 补采集容错验收〕。**2026-06-02 23:23 复核 Phase 2** → 新增 Phase 2 前置卡 **CHG-VIR-6.5**〔P2-F1：ADR-105a 补 `release_marker_mismatch` 强负 + P2-F3 group 聚合口径 + 放宽 `D-105a-N` 审计正则〕，CHG-VIR-7 依赖补 6.5）
- **目标**：把「标准化标题 → 单 key 命中即合并」升级为 Entity Resolution（Blocking 召回 → 多证据 Scoring → 阈值分级 Decision → 可逆审计 + 决策记忆），为合并/拆分提供稳健、可解释、可回滚基础。严格按「先旁路 → 再影响排序 → 最后碰生产归并阈值」推进。
- **范围**：`apps/api`（TitleIdentityParser 新增 / MediaCatalogService.findOrCreate / VideoMergesService / CrawlerService / 离线候选 job / migrations）+ `packages/types` + `apps/server-next`（/admin/merge + 审核台 similar tab 统一候选）+ `docs/decisions.md`（4 份 ADR）+ `docs/architecture.md`（schema 同步）。
- **方案全文**：`docs/designs/video-identity-resolution-redesign_20260602.md`（commit 27c29a5d；含 §9 arch-reviewer 审核 + §10 修订处置）。
- **关联 ADR**：新增 ADR-105a / ADR-175 / ADR-176 / ADR-177；ADR-105 AMENDMENT 2026-06-02（旧 ADR-105a 方向已取代，commit a35bfa36）；ADR-137（similar 算法 Phase 2c 取代）；ADR-174（D-174-3 重指向语义迁移）；ADR-114-NEGATED（跨站不合并，不触碰）。
- **红线**：禁改 `normalizeTitle`/`normalizeMergeKey` 语义（`core_title_key` 新增并行）；禁 pg_trgm / 技术栈外依赖；繁简不归一（并列 alias）；候选对象 Phase 1-4 = video-pair，catalog 身份层留 Phase 5。
- **执行节奏**：前置门禁 `PRE-1`（独立正确性）+ `PRE-2`（ADR-177 关系预研）→ Phase 0 四份 ADR 起草（**全 Opus + arch-reviewer PASS**，任一红线未闭环 → BLOCKER 停）→ Phase 1 旁路 → Phase 2 候选证据化(2a/2b/2c) → Phase 3 ingest shadow → Phase 4 拆分+清洗 → Phase 5 catalog 身份层。
- **依赖链**：`PRE-1`（任意时点）；`PRE-2 → CHG-VIR-4`；`CHG-VIR-1/2/3/4`（Phase 0，可并行）→ `CHG-VIR-5/6`（Phase 1）→ **`CHG-VIR-6.5`（Phase 2 前置门禁 / ADR-105a AMENDMENT）** → `CHG-VIR-7/8/9`（Phase 2）→ **`CHG-VIR-OBS-BACKFILL` ✅（Phase 3 硬前置已解除 2026-06-03 / 单环境定档回填完毕）** → **`CHG-VIR-10` ✅（Phase 3 已完成 2026-06-03）**；**`CHG-VIR-9-D` ✅（已完成 2026-06-03：merge 翻默认 identity + 连通分量折叠 / D-105a-18）**；`CHG-VIR-11`（Phase 4，依赖 PRE-1+Phase1）；`CHG-VIR-12`（Phase 5，依赖 ADR-176/177 + Phase1-4 稳定）。
- **粒度说明**：Phase 0（ADR 起草卡）验收已具体；Phase 1-5 实施卡为**规划占位**，详细文件范围/验收待对应 ADR 定档后于启动前补全（task-queue「提前规划」性质）。

### 任务列表（按执行顺序）

**前置门禁**

1. **CHG-VIR-PRE-1** — `insertNewVideo` schema 漂移排查修复（现网正确性隐患）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-02 19:41
   - 建议模型：sonnet（既有正确性修复，无新契约）
   - 变更原因：`apps/api/src/db/queries/video-merge-mutations.ts:299-310` split 新建 video 的 INSERT 仍引用已由 migration 029 DROP 的 `videos.year` / `videos.title_normalized`，拆分到新建 video 路径会命中（arch-reviewer 未决项 3）。
   - 文件范围：`video-merge-mutations.ts`（insertNewVideo INSERT 列对齐现行 videos schema，year/title_normalized 不再写 videos，按需落 media_catalog）+ 回归测试。
   - 验收要点：split 新建 video 不引用已删列；现有 split/unmerge 测试零回归；typecheck/lint/test 全过。
   - 依赖：无（独立，建议早做；Phase 4 前必修门禁）。
   - 完成备注：**insertNewVideo schema 漂移修复**。① `insertNewVideo`(video-merge-mutations.ts) 改签名 `{shortId,catalogId,title,type}`，INSERT 列对齐 029 后 videos schema（删已 DROP 的 year/title_normalized，加 catalog_id NOT NULL，范式对齐 `videos.mutations.createVideo`）；② `VideoMergesService` 构造注入 `MediaCatalogService`，split **事务前**对每 group `findOrCreate` 作品层 catalog（幂等；事务外，回滚至多留无害孤儿 catalog）→ 事务内 `insertNewVideo` 传 catalogId。**范围澄清**：卡片原列单文件不足以修（catalog_id NOT NULL + findOrCreate 编排在 Service 层），必要适配延伸 VideoMergesService.ts。测试：更新现有权威 `video-merge-mutations.test.ts` split（mock MediaCatalogService.findOrCreate + happy path 断言 catalogId 替代 year + 事务失败 ROLLBACK 补 findOrCreate 就绪）+ 新建 `video-merge-insert-new-video.test.ts`（insertNewVideo 真实 SQL）。**Codex stop-time review FIX**：现有 split 单测与新 catalog 依赖不兼容（初次 grep 漏 video-merge-mutations.test.ts）→ 适配 + 删初版重叠的 video-merge-split-catalog.test.ts。门禁 typecheck/lint/verify×2 EXIT=0 + **全量 456 files 6034 passed 0 failed 零回归**（StagingEditPanel jsdom flaky 隔离+全量均通过，非本卡）。无新端点/migration/ADR。执行模型: claude-opus-4-8（建议 sonnet，opus 覆盖：事务设计+依赖注入更稳妥）

2. **CHG-VIR-PRE-2** — ADR-177 前置：`video_external_refs` ↔ `catalog_external_refs` 关系预研定档（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**（架构关系决策 + arch-reviewer 第二意见）
   - 变更原因：arch-reviewer R1——设计 §4.6 新提 `catalog_external_refs` 与既有 `video_external_refs`（migration 041/045）语义重叠层级不同；**关系未定不得起草 ADR-177**。
   - 产出：定档「替代/并存/上卷」关系（设计临时定向「并存+上卷」）+ D-174-3 现有写 `video_external_refs` candidate 路径迁移方案 + 两表 candidate/rejected 审计是否合并。
   - 验收要点：关系三选一明确 + 上卷规则 + D-174-3 迁移路径；arch-reviewer 认可后方可起 CHG-VIR-4。
   - 依赖：无。
   - 完成备注：**关系预研定档完成（arch-reviewer claude-opus-4-8 / agentId a6cc563d53376800e / CONDITIONAL → R-1 + Y-1~4 吸收 → 认可起 CHG-VIR-4）**。新建 `docs/designs/adr177-external-refs-relation_20260602.md`。**关系三选一定档「并存 + 上卷」**：排除「替代」（`video_external_refs` = video 级真源 + 4 富集 Service 写 + 后台审核台 UI 读展示链 listVideoExternalRefs→getAdminVideoById→external-meta-panel，层级职责不同）/「纯并存」（双真源 findOrCreate 无来源）；video_external_refs 保留 video 级不改，catalog_external_refs 为 catalog 级 canonical，上卷桥接。**上卷规则**（确定性保守）：manual_confirmed primary 一致 + 精确级 → exact / auto_matched 一致 → candidate / 冲突 → candidate 不自动 exact / 跨 catalog 同 external_id 按 external_kind+season_number 裁定（show 级→parent 一对多 / season·movie→exact / exact 冲突→candidate 归并信号）。**D-174-3 迁移**：过渡期保留 video 级 candidate；ADR-177 落地新增 catalog_external_refs candidate（双写过渡，catalog_id 归属结合 D-174-7 留 ADR-177）；目标 catalog 层冲突归 catalog_external_refs。**两表审计不合并**：层级独立，video rejected 不传播 catalog rejected，catalog exact 不覆盖 video rejected；candidate/rejected 不进 partial unique（仅 exact/parent 受全局唯一）。arch-reviewer R-1（§1 漏后台 UI 读消费链 / ADR-172 AMD3，已校正）+ Y-1/2/3/4 全吸收。门禁 verify:adr-contracts EXIT=0；纯 docs 新建预研文档，无代码/migration/ADR。**解锁 CHG-VIR-4**。执行模型: claude-opus-4-8

**Phase 0 — ADR 起草（全 Opus + arch-reviewer PASS；任一红线未闭环 → BLOCKER）**

3. **CHG-VIR-1** — ADR-105a 起草（多证据评分 / 阈值分级 / 候选持久化 / 离线生成）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**（ADR 起草，强制 arch-reviewer PASS）
   - 范围：评分公式（强正/中正/强负 + 0.92/0.75 阈值）+ `core_title_key` 确定性等值 blocking（B-tree，非 pg_trgm）+ `identity_candidate` schema + 离线生成 job 性能模型（实时端点继承 ADR-105 p95 / 离线另立基线，Y5）+ **type 兼容矩阵**（代码常量真源，未决 2）+ `evidence_hash` 输入域（未决 5）+ Y1 幂等约束 + Y3 confirmed→merge 事务边界。
   - 门禁：Opus 子代理 + arch-reviewer PASS + commit trailer Subagents；落 decisions.md ADR-105a 章节。
   - 验收要点：评分/阈值/候选 schema/离线模型/type 矩阵/evidence_hash 全闭环；与 ADR-105 端点契约兼容；arch-reviewer PASS。
   - 依赖：无（可与 CHG-VIR-2/3/4 并行）。
   - 完成备注：**ADR-105a Accepted（arch-reviewer claude-opus-4-8 / agentId a3933826a5e470df8 / CONDITIONAL → 4 项修订吸收）**。decisions.md 尾部追加完整 ADR-105a（13 D 条 + `identity_candidate` DDL 草案 + type 兼容矩阵 + 三类证据权重表 + 聚合公式 + evidence_hash 输入域 + 10 红线 + 5 黄线 + 后果 + follow-up）；architecture.md §5.15 加「规划草案/未落 migration」前瞻小节。R1-R3（normalizeTitle/normalizeMergeKey 解耦 + core_title_key 等值非模糊 + identityScore/legacyScore 分离）+ Y1/Y3/Y5（幂等 partial unique / confirmed→merge 事务边界 / 性能基线分离）+ 未决 2/5（type 矩阵代码常量真源 / evidence_hash 输入域）全闭环。arch-reviewer 3 必修 + 1 建议全吸收：RR-1（分级可达性确定性映射 + 非 exact 封顶 0.90 + exactScore=0.95 取值理由）/ YY-1（external_exact 数据源校正 `video_external_refs.is_primary=true AND match_status='manual_confirmed'`，现表无 relation/exact）/ YY-3（exact 仅豁免 type_incompatible 单条 veto）/ YY-2（矩阵中性为初始保守取向）。门禁：verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 203 路由对齐 / 其余 ⚠️ 既有 advisory 与本 ADR 无关）+ verify:endpoint-adr EXIT=0；纯 docs 无 TS/TSX，typecheck/lint/test 基线不受影响。未新增端点/migration（identity_candidate 留 Phase 2b CHG-VIR-8）。执行模型: claude-opus-4-8

4. **CHG-VIR-2** — ADR-175 起草（多语种标题模型）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**
   - 范围：`media_catalog` 字段语义收紧（新增 `original_language` / `title_original` 原语种 / `title_en` 仅英文）+ `media_catalog_aliases` 结构化升级（region/script/kind/confidence/is_primary_for_locale）+ **locale fallback 链**（未决 1，简繁不归一并列 alias）+ 匹配分层（同语种强 / 跨语种 alias 中强 / 罗马音辅助）。
   - 门禁：Opus + arch-reviewer PASS；落 decisions.md ADR-175 + architecture.md schema 同步。
   - 验收要点：字段语义 + aliases 升级 + fallback 确定性规则 + 匹配分层；arch-reviewer PASS。
   - 依赖：无。
   - 完成备注：**ADR-175 Accepted（arch-reviewer claude-opus-4-8 / agentId a714ba080c9641c5e / CONDITIONAL → 4 项修订吸收）**。decisions.md 追加 ADR-175（6 D 条：`original_language` 新增 + `title_original`/`title_en` 语义收紧 / `media_catalog_aliases` 5 列结构化升级〔region/script/kind/confidence/is_primary_for_locale〕+ partial unique / display_title 确定性 locale fallback 链 / 匹配分层复用 ADR-105a 既有极性 / `aliases[]` 数组列降级只读单一真源 / 写入口径；7 红线 + 5 黄线）；architecture.md §5.1a 加规划草案小节。arch-reviewer 红线-1（D-175-4 极性映射交叉错配 → 改为复用 ADR-105a `external_alias_match` 强正 / `core_title_key_equal` 中正，不回写 105a）+ 红线-2（拼音迁出须对 catalog 层 `title_en` 独立调 `isPinyin`，video 层 `title_en_is_pinyin` 仅参考）+ 黄线-1（基础去重键保留 `(catalog_id,alias)`）+ 黄线-2（回填先 lang/script/region 再选 primary）全吸收。门禁 verify:adr-contracts/endpoint-adr EXIT=0（203 路由对齐 + sql-schema 对齐 / adr-d-status.json 登记 D-175-1..6）；纯 docs 无 TS/TSX。**发现既有债务（范围外留痕）**：① architecture.md `release_date TEXT` vs migration 026 `DATE` 不一致（黄线-3，另立修正卡）；② verify-adr-d-numbers 正则 `D-\d+-\d+` 不识别 ADR-105a 的 `D-105a-N`（字母 ADR 编号审计盲区，D-105a-1..13 未进 adr-d-status.json），建议后续 MAINT 放宽正则。执行模型: claude-opus-4-8

5. **CHG-VIR-3** — ADR-176 起草（catalog 按季粒度 + series_group）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**
   - 范围：catalog 按季粒度（第二季/SP/OVA 独立 catalog）+ **season_number 纳入 catalog 唯一键**（解 `026:84` 唯一索引 + `normalizeTitle` 剥季的硬阻塞）+ `series_group`/`catalog_relations`（season_of/edition_of/remake_of/spinoff_of/same_work_candidate）+ catalog 无 `deleted_at` 的「删前全字段快照」回滚范式（未决 4，继承 migration 084）。
   - 门禁：Opus + arch-reviewer PASS；落 decisions.md ADR-176 + architecture.md。
   - 验收要点：唯一键改造方案 + series_group 模型 + 回滚范式；arch-reviewer PASS。
   - 依赖：无。
   - 完成备注：**ADR-176 Accepted（arch-reviewer claude-opus-4-8 / agentId a8930709146880a0f / CONDITIONAL → 5 项修订吸收）**。decisions.md 追加 ADR-176（6 D 条 + 7 红线：`season_number` 列 + 唯一键改造 `COALESCE(season_number,0)` 解「无外部 ID 分季撞 partial unique」硬阻塞〔存量 NULL→0 逐值不变〕/ catalog 按季粒度〔S2/SP/OVA/剧场版独立〕/ `catalog_relations` 5 关系有向图 + `series_group` 可选锚 / catalog 无 `deleted_at` 删行回滚范式〔继承 084 + ADR-174 D-174-6 R11/R12〕/ findOrCreate 不纳入 season 留 Phase 5）；architecture.md §5.1a 加规划草案小节。arch-reviewer R-1（`catalog_relations` 反对称四 relation 单向无环 + `same_work_candidate` 对称规范化有序对 → 补关系不变量 + R7）+ R-2（合并删行关系边端点重指向 survivor + old/new 双列快照回滚复位）+ Y-A（哨兵 0 依赖 `CHECK>0` 禁放宽）+ Y-B（回填全系列一致禁半回填）+ Y-C（architecture 同步端点重指向）全吸收。门禁 verify:adr-contracts/endpoint-adr EXIT=0（203 路由 + sql-schema 对齐 / adr-d-status.json 登记 D-176-1..6）；纯 docs 无 TS/TSX。执行模型: claude-opus-4-8

6. **CHG-VIR-4** — ADR-177 起草（外部 ID 映射真源 `catalog_external_refs`）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**
   - 范围：`catalog_external_refs`（provider/external_id/external_kind/relation/season_number/confidence/source/is_primary）+ partial unique index（exact 唯一 / parent 一对多 / candidate·rejected 审计保留）+ 四列降级为 cache（仅 `relation=exact AND is_primary` 回填）+ findOrCreate 改读映射表 + ADR-174 D-174-3 重指向语义迁移 + 既有数据迁移。
   - 门禁：Opus + arch-reviewer PASS；**硬前置 CHG-VIR-PRE-2 关系定档**；落 decisions.md ADR-177 + architecture.md。
   - 验收要点：映射表 schema + 约束分级 + cache 规则 + 迁移路径；arch-reviewer PASS。
   - 依赖：**CHG-VIR-PRE-2**。
   - 完成备注：**ADR-177 Accepted（arch-reviewer claude-opus-4-8 / agentId a18aea6f95f5d88ce / CONDITIONAL → RR-A + RR-B 2 必修红线 + YY-A~D 4 黄线吸收）**。decisions.md 追加 ADR-177（10 D 条 + `catalog_external_refs` DDL 草案 + 2 partial unique〔exact 全局唯一 / exact·parent 同 catalog 唯一 / candidate·rejected 不进约束保留审计免 `decision_id`〕+ 四列降级 cache〔仅 exact·is_primary 回填，parent/candidate/rejected 不回填防一对多污染单值唯一列〕+ 上卷规则继承 PRE-2〔manual_confirmed primary 一致+精确级→exact / 冲突→candidate / show 级→parent / exact 冲突→candidate 归并信号不靠唯一索引兜底〕+ findOrCreate 改读映射表 + D-174-3 catalog 层冲突迁移〔双写过渡 / candidate catalog_id 归属按 D-174-7 redirect 两分支〕+ 两表审计不合并 + catalog 删行回滚纳入 ADR-176 D-176-4 + 既有数据迁移；10 红线 + 6 黄线 + 后果 + follow-up 5 条）；architecture.md §5.6 加 catalog_external_refs 规划草案小节 + §5.1a 四列降级注记。**主动校正**：partial unique 哨兵 `COALESCE(season_number,-1)`（设计 §4.6 草案）→ `0`（与 ADR-176 唯一键口径统一，依赖 CHECK>0 / R9）。arch-reviewer 2 必修红线吸收：**RR-A**（D-177-9+R8：合并重指向 exact 须按索引①预检主导，PostgreSQL ON CONFLICT 单目标无法同覆盖①②，单一兜底在 season_number 不同时漏接撞①炸事务 / 与 R3「不靠唯一索引兜底」一致）+ **RR-B**（D-177-3+R10：补 `external_kind` 全局一致 + exact↔parent 互斥不变量，external_kind 单调决定 relation 取值域，原 schema 不阻止同一外部 ID 既 exact 又 parent / findOrCreate 分流无歧义 + 消除合并撞①大部分场景）；4 黄线吸收：YY-A（redirect 条件对齐 `isRedirectSafe` 缺 year 走 safe）+ YY-B（schema 增 `rollup_rule` 上卷溯源列）+ YY-C（exact 写入与 cache 回填同事务）+ YY-D（迁移 external_kind 推断不确定保守落 candidate）；对齐建议（follow-up 5：douban/imdb/tmdb 三同类约束对称归 catalog_external_refs candidate）。arch-reviewer 认可无返工三项：哨兵校正 / PRE-2 四项定档忠实继承 / D-174-3 candidate catalog_id 归属无 orphan。门禁 verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 203 路由对齐 + sql-schema 对齐 / adr-d-status.json 登记 D-177-1..10）+ verify:endpoint-adr EXIT=0；纯 docs 无 TS/TSX，typecheck/lint/test 基线不受影响。未新增端点/migration（catalog_external_refs 留 Phase 5 CHG-VIR-12）。**Phase 0 四份 ADR（ADR-105a/175/176/177）全部 Accepted，Phase 0 完结**。执行模型: claude-opus-4-8

**Phase 1 — 纯函数旁路（零生产行为变更；实施卡详细范围待 ADR 定档细化）**

7. **CHG-VIR-5** — Phase 1a：TitleIdentityParser 纯函数 + fixture（状态：✅ 已完成 2026-06-02 22:45 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-02 19:41
   - 建议模型：sonnet（纯函数实施，规格来自 ADR-105a/175）
   - 范围：新建 `apps/api/src/services/TitleIdentityParser.ts` `parseTitle(raw)→{coreTitleKey,facets,titleKind,parserVersion,confidence}`；**不改 TitleNormalizer**；大量 fixture（书名号/全半角/标点 · 国语/粤语/字幕 · 加长/导剪/SP/OVA/剧场版 · 第N季/S2/Part2/序号 · 源站噪声）。**Y4**：fixture 须区分「序号即身份（复仇者联盟4）」与「序号即季/卷（第4季）」。
   - 验收要点：fixture 全绿 + `normalizeTitle`/`normalizeMergeKey` 输出完全不变；facets 仅观测不参与决策。
   - 依赖：CHG-VIR-1（ADR-105a：`core_title_key` 归一规则 D-105a-1 / facets 字段 / Y4 序号护栏 D-105a-13）+ **CHG-VIR-2**（ADR-175：`titleKind` 枚举 original/localized/romanized/aka/crawler/edition 规格来源 · 2026-06-02 复核 F2 补全）。
   - 完成备注：**TitleIdentityParser 纯函数 + 40 fixture 全绿**。新建 `apps/api/src/services/TitleIdentityParser.ts`（386 行）`parseTitle(raw)→{coreTitleKey,facets,titleKind,parserVersion,confidence}`：10 步确定性流水线（剥 HTML→全角折叠→括号 token→季/部/卷序号→发布形态→版本→语言变体→画质噪声→源站噪声→折叠/lower/剥标点），`extractSingleMarker`/`extractNoiseTokens` 共用 helper，`parseSeasonNumeral`（阿拉伯+CJK 零~百），`classifyTitleKind`（crawler>edition>localized>romanized>original，复用 `isPinyin`）+ `computeConfidence`，`TITLE_PARSER_VERSION='1.0.0'`。facets 七维解析保存而非删除。**D-105a-1**（core_title_key 等值/语义解耦/不改归并键）+ **D-105a-13 Y4**（仅剥显式季/部关键词序号，裸序号《复仇者联盟4》保留进 core → 不同序号不同 key；第N季剥到 facets.seasonNumber → 同剧异季 core 同 season 异）闭环 + ADR-175 titleKind 枚举落地。**`TitleNormalizer.ts` 零改动**（git 确认，验收红线）。新建 `tests/unit/api/title-identity-parser.test.ts` 40 用例（全分类 + TitleNormalizer 回归守卫）。门禁：typecheck EXIT=0 + lint 5 successful + **全量 6073 passed / 1 flaky**（StagingPageClient jsdom flaky 隔离 8/8 通过，与本卡 node 纯函数无关）+ verify:adr-contracts EXIT=0。无新依赖/migration/端点/ADR。解阻 CHG-VIR-6。执行模型: claude-opus-4-8

8. **CHG-VIR-6** — Phase 1b：title_observations 去重聚合表 + shadow 写入（状态：✅ 已完成 2026-06-02 23:05 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-02 19:41
   - 建议模型：sonnet（**schema 真源 = 设计文档 §1b**，无独立 ADR；实施）
   - 范围：migration `title_observations`（**schema 真源 = `docs/designs/video-identity-resolution-redesign_20260602.md` §1b，无独立 ADR**——单一用途 shadow 观测表，不进任何唯一约束/归并决策〔2026-06-02 复核 F1 定档〕；字段：去重唯一键 video_id+COALESCE(site_key)+COALESCE(source_name)+raw_title_hash+parser_version + observed_count/first_seen/last_seen/parsed_facets_jsonb）+ 采集链路 shadow 写入；不参与合并决策。
   - 验收要点：去重生效（重复标题只增 observed_count）；**采集链路写 observation 容错（fire-and-forget / 写失败不阻断入库主流程 · 2026-06-02 复核 F3 补全）**；零生产行为变更（采集主路径无回归）。
   - 依赖：CHG-VIR-5。
   - 完成备注：**title_observations 去重聚合表 + 采集链路 fire-and-forget shadow 写入**。Migration 085（表 + 去重唯一索引 `uq_title_observations_dedupe` COALESCE 表达式 + 反查 idx + DO 校验，已应用 dev DB）+ `db/queries/titleObservations.ts`（`recordTitleObservation` ON CONFLICT 去重键 DO UPDATE `observed_count+1`，**仅 DB query 零 service import**）+ `services/titleObservation.builder.ts`（`buildTitleObservation`：`parseTitle` facets 快照 + sha256 hash，Service 层组装供 Phase 2 复用）+ `CrawlerService.upsertVideo` Step 5 后 `void recordTitleObservation(...).catch(stderr)`（F3 容错非空 catch）+ architecture.md §5.16 同步。**范围澄清**：卡片原列 5 文件，实施扩 2 文件（① builder 修正分层——全仓 DB query 层无 import services 先例，解析/哈希属 Service 层职责 + 避免 baseline 豁免的 CrawlerService 537 行继续增长；② crawlerTitleObservation.test.ts 端到端 + F3 容错）。真实 DB 验证：同键二次写入 observed_count=2、facets jsonb 正确存取。门禁：typecheck/lint EXIT=0 + **全量 6084 passed / 0 failed**（460 files / 净 +10：query 3 + builder 4 + e2e 3）+ verify:adr-contracts EXIT=0。验收 F1（不进唯一约束/归并决策）/ 去重生效 / F3 容错 / 零生产行为变更全闭环。无新端点/ADR。**SEQ Phase 1 完结**。执行模型: claude-opus-4-8

**Phase 2 启动前置门禁（复核 Phase 2 / P2-F1 新增 · 2026-06-02）**

8.5. **CHG-VIR-6.5** — Phase 2 前置：ADR-105a AMENDMENT（补 `release_marker_mismatch` 强负 + group 聚合口径 + 审计正则）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 23:23
   - 实际开始：2026-06-02 23:32
   - 完成时间：2026-06-02 23:55
   - 建议模型：**opus**（改 ADR-105a D-105a-3 证据表极性，Y-105a-3「实施期不得改极性」→ 须 ADR amendment + arch-reviewer PASS）
   - 变更原因：复核 Phase 2 发现 **P2-F1**——`TitleIdentityParser` 把 `releaseMarker`（剧场版/SP/OVA/番外）剥到 facets（core_title_key 不含），但 ADR-105a `D-105a-3` 强负表仅有 `season_mismatch`、**无 `release_marker_mismatch`**；与 ADR-176「剧场版/SP/OVA 独立 catalog」不对称 → Phase 2b blocking 用 core_title_key 把「正篇」与「剧场版」召回同组且**无强负拦截**（video 层误并，早于 Phase 5）。对比：`edition`（加长版）剥到 facet 故意无强负正确（同作品），`release_marker` 也无强负 = 遗漏。
   - 范围：① **ADR-105a AMENDMENT**（decisions.md）：`D-105a-3` 强负表补 `release_marker_mismatch`（facets.releaseMarker 不同 → veto，对齐 ADR-176；与 edition 不 veto 形成正确对比）；数据源 Phase 2 读 parser facets 实时比较（同 `season_mismatch` 口径，**不依赖 Phase 5 `media_catalog.season_number` 列**）。② 明确 **P2-F3**：`D-105a-9` Phase 2a group 行 `identityScore` 聚合口径（group→单值：组内 recommendedTarget vs 其余成员 pair 的代表/最低口径）。③ 顺带（审计盲区）放宽 `verify-adr-d-numbers` 正则识别字母 ADR 编号 `D-105a-N`，使 `D-105a-1..13` + 新增 D 条进 `adr-d-status.json`。
   - 门禁：Opus 子代理 + arch-reviewer PASS + commit trailer `Subagents`；AMENDMENT 落 decisions.md ADR-105a。
   - 验收要点：`release_marker_mismatch` 强负入 `D-105a-3` + 数据源/口径明确；P2-F3 group 聚合口径定档；正则放宽后 `D-105a-N` 进审计；arch-reviewer 认可。
   - 依赖：无（Phase 1 已完成）；**CHG-VIR-7 硬前置**。
   - 完成备注：**ADR-105a AMENDMENT Accepted（arch-reviewer claude-opus-4-8 / agentId a9d8c49369023192e / CONDITIONAL → 红线 A1/A2/B1 + 黄线 a1/b1/c1 全吸收）**。decisions.md ADR-105a：`D-105a-3` 强负表原地新增 `release_marker_mismatch` veto 行（零删原文）+ 章节末追加 AMENDMENT 小节（D-105a-14 + D-105a-15 + D-N 登记更新扩为 1~15 共 15 条 + c1 影响面声明）。**红线吸收**：A1（null 语义收窄——**仅双方均非 null releaseMarker 且值不同才 veto**，`null↔非 null` 不 veto 仅作 candidate 弱信号，因 parser null=「正则未命中」非「确定正篇」且 Phase 1-4 自动绑定 OFF）/ A2（exact 不豁免理由修正——主战场无 exact ID 召回 pair，exact 场景多由 `external_id_conflict` 先命中，与 YY-3 一致）/ B1（消除 `recommendedTarget` 新原语——D-105a-15 聚合严格继承 D-105a-9「所有 unordered pair」映射，`identityScore`=min、reasons=union over C(N,2)，evidence 保 per-pair）。**黄线**：a1（纯 facet 驱动不接 `media_catalog` 持久化列）/ b1（Phase 2a 排序键仍 legacyScore，identityScore 仅展示列）/ c1（影响面纠正：全仓唯一字母后缀 D 编号即 D-105a-N，ADR-103a/103b 章节无 D 编号→放宽零行为变化）。scripts/lib/adr-parser.mjs 正则放宽 `parseDeviationNumbers`/`parseChangelogDeviations` 支持 `D-\d+[a-z]?-\d+` + ownNumber `/^ADR-(\d+[a-z]?)/`（向后兼容纯数字）；ADR-105a 首次进 adr-d-status.json（total=15/closed=7，D-105a-14/15 闭环，2~12 中 8 条 advisory pending=Phase 2+ 未实施）。门禁全过：verify:adr-contracts EXIT=0 + typecheck EXIT=0 + lint 5 successful + **全量 6084 passed / 0 failed**（零回归）。无新依赖/migration/端点/新 ADR。**解除 CHG-VIR-7 硬前置**。执行模型: claude-opus-4-8

**Phase 2 — 候选证据化（候选对象 video-pair）**

9. **CHG-VIR-7** — Phase 2a：现有 N-video group 候选附加 evidence（不改来源）（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 code-architect (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 实际开始：2026-06-02 23:54（执行模型 claude-opus-4-8 / 偏离 sonnet 建议：用户裁定本 opus 会话连续推进）
   - 完成时间：2026-06-03 00:40
   - 建议模型：sonnet
   - 范围：VideoMergesService 候选保持现状 `mc.title_normalized+mc.year+v.type` N-video group（来源/排序/数量不变）；附加 `identityScore`/`evidence`/`blockingReasons`/`strongNegativeReasons`（**禁复用 legacyScore=source_overlap_ratio**）；UI 展示「为何可合并/为何拦截」。**注**：strongNegativeReasons 须含 CHG-VIR-6.5 落档的 `release_marker_mismatch`。
   - 验收要点：候选数量/分页/默认排序与旧逻辑一致；仅新增 evidence 字段。
   - 依赖：**CHG-VIR-6.5（Phase 2 前置门禁：ADR-105a release_marker 强负 + group 口径）** + CHG-VIR-5 + CHG-VIR-1。
   - 完成备注：**多证据身份评分落地（code-architect claude-opus-4-8 / agentId a16a020a7dd8eae19 蓝图 → 忠实实现）**。新建 `apps/api/src/services/identity/`（weights 权重/极性/weightTag 常量真源 D-105a-3+R10 / type-compat 矩阵 D-105a-5 / scorePair 单对评分 D-105a-3 确定性聚合 + D-105a-14 release_marker + exact 仅豁免 type_incompatible YY-3 / aggregateGroup group→单值 D-105a-15 min+union over all unordered pairs 零 recommendedTarget 原语 / scoreGroup 编排，5 文件均 <212 行）+ `packages/types/identity-evidence.types.ts`（`EvidenceItem`/`PairScore`/`GroupIdentityScore` 契约，三处复用 API/UI/Phase2b）+ `CandidateGroup.identity` optional 字段（与 legacyScore=score 分离 R3/D-105a-6）+ `VideoMergesService.listCandidates` 唯一新增行 `identity: scoreGroup(videos)`（minScore/排序/分页只看 legacyScore，候选数量/默认排序逐值不变 Y-105a-1，sortField 白名单不加 identityScore）+ MergeClient 双 pill（置信度/身份分文案区分）+ 抽 `EvidencePanel.tsx`（避免既有超限 MergeClient 膨胀 / 为何可合并·拦截·逐对明细，颜色零硬编码 state token）。**Phase 2a 数据源边界**：parser facets + 组内 site_keys 驱动（core_title_key_equal/season_mismatch/release_marker_mismatch/source_fingerprint + 组内恒成立 year/type）；外部 ID（exact/conflict/alias/canonical）+ 集数 + metadata 证据留 Phase 2b（externalIds undefined）。**蓝图偏离（合理）**：去 Phase 2a 未评估占位 evidence（蓝图原产全量）——p95 预算（scoreGroup 7.46→5.55ms，perf baseline p95 < 200ms 稳定 / D-105a-10）+ 占位对 UI 零展示价值。门禁全过：typecheck/lint EXIT=0 + verify:adr-contracts EXIT=0 + **全量 6115 passed / 0 failed**（462 files / 净 +31：identity-scorer 27 + video-merges-identity 4；StagingEditPanel 偶发 jsdom flaky 隔离 12/12 通过与本卡无关）。无新端点/migration/新 ADR（GET 响应扩字段不触发 endpoint-adr）。**范围外留痕**：`CrawlerRunsView.tsx` 516 行 pre-existing file-size-budget 违规（本卡未碰 crawler，非本卡引入；budget 非必跑门禁）。**解阻 CHG-VIR-8（Phase 2b）**。执行模型: claude-opus-4-8

10. **CHG-VIR-8** — Phase 2b：`identity_candidate` shadow 写入 + 离线生成 job（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 code-architect (claude-opus-4-8)）
    - 创建时间：2026-06-02 19:41
    - 实际开始：2026-06-03 01:05（执行模型 claude-opus-4-8 / 子代理 code-architect 蓝图 a9a4c5ca8088f4b87 / 用户裁定 A=apps/api Bull）
    - 完成时间：2026-06-03 01:20
    - 建议模型：**opus**（离线 job + identity_candidate 幂等/状态机，跨消费方）
    - 范围：identity_candidate 落地（Y1 partial unique `(canonical_pair_key) WHERE status='pending'` 单事务 upsert / Y2 复活链 `revived_from_candidate_id` / Y5 版本重算可见性）+ 离线 Bull job（Blocking 多 key 并集 → Scoring → 写 candidate）；与现有候选并行对照，不切 UI。
    - 验收要点：shadow candidate vs 旧候选对比报表（新增召回/误召回可解释）；幂等无重复 pending。
    - 依赖：CHG-VIR-7 + CHG-VIR-1。
    - 完成备注：**identity_candidate + 离线 job 落地（code-architect claude-opus-4-8 / agentId a9a4c5ca8088f4b87 蓝图 → 忠实实现，无需新 ADR，纯 D-105a-7/8/10 实施）**。**Migration 086**（identity_candidate 表 + 6 索引〔partial unique pending R5 + pair_key 反查 + status·version 过滤 + left/right FK 反查 + `idx_title_observations_core_key` blocking 表达式索引〕+ 2 CHECK〔left≠right + left::text<right::text canonical 有序兜底防幂等失效〕+ 自引用 FK SET NULL 保复活链 / 真实 DB 验证 partial unique 拦重复 pending + CHECK 拦反序 + DO 校验全过）。新建 5 文件：`evidenceHash.ts`（D-105a-8 八项输入域确定性序列化 + sha256，禁含 created_at/job-id R7）/ `candidateUpsert.ts`（单事务幂等 R5：hash 比对 noop / 腾位 supersede+新建 / 复活链 R6 不覆盖原 rejected + ON CONFLICT DO NOTHING 并发兜底重查）/ `externalIdLoader.ts`（Y-105a-4 双源 media_catalog+video_external_refs，仅 manual_confirmed）/ `offlineRescore.ts`（Blocking core_title_key 分桶〔禁 pairwise + MAX_BUCKET 护栏〕→ 收敛去重 → 评分 → upsert + advisory lock 单实例 + cursor keyset 分批 / D-105a-4 低分跳过）/ `db/queries/identity-candidate.ts`（6 queries 纯 SQL）。`identityCandidateWorker.ts`（Bull 队列，**裁定 A**：评分逻辑单一真源在 apps/api 不跨 ADR-107 §4 复制）+ `lib/queue.ts`/`server.ts` 注册 + 2 脚本（`enqueue-identity-rescore` 手动触发 + `identity-compare-report` 三桶对比，不切 UI/不加 admin 端点）+ architecture.md §5.15 现状基线同步。**蓝图偏离（合理）**：① 不加自动 scheduler——Phase 2b shadow 对照阶段手动触发足够，自动周期留 Phase 2c/用户裁定（避免未验证 job 自动运行）；② offlineRescore 内联 `scorePair` 替代 `scoreCandidatePairs(from ./index)` 消除 index↔offlineRescore 循环 import；③ episode/metadata digest Phase 2b 占位空串（证据细化时 bump SCORER_VERSION）。**identity_decisions / confirmed→merge（D-105a-11）留 Phase 2c**（CHG-VIR-8 无人工裁定入口）。门禁全过：typecheck/lint EXIT=0 + verify:adr-contracts EXIT=0 + **全量 6148 passed**（466 files / 净 +35：evidenceHash 14 + upsert 8 + queries 8 + offlineRescore 5；2 jsdom flaky〔VideoImageSection 21/21 + StagingEditPanel 12/12 隔离全过〕与本卡 node 端无关）+ perf baseline ✓。无新 admin 端点（worker/queue/脚本 → endpoint-adr 不触发）。ADR D-N 闭环 D-105a-7/8/10。**解阻 CHG-VIR-9（Phase 2c）**。**+补记（2026-06-03 Phase 2 收口复核 / 审计一致性）**：蓝图偏离④漏登——Blocking 召回键实际仅 `core_title_key` 单 key 分桶（设计 §Phase 2b 列 6 键：core_title_key/alias normalized key/外部 ID/year band/type compat/source fingerprint；其中 year/type 在 scorePair 作证据/veto、外部 ID 经 externalIdLoader 仅进 scoring 证据，均非召回键）→ **外部 ID 相同但标题差异大的 pair 召回不到**（标题等值是唯一召回门）；`offlineRescore.ts` 头注释「Blocking 多 key 并集召回」与实现不符（注释修正并入 CHG-VIR-9-D）。多 key 并集（至少外部 ID 第二召回键）随 CHG-VIR-10 前置门禁②一并裁定。执行模型: claude-opus-4-8

11. **CHG-VIR-9** — Phase 2c：切 UI 默认候选来源（/admin/merge + 审核台 similar 统一）（状态：✅ 已完成 2026-06-03 / 拆 9-A ✅ + 9-B ✅ + 9-C ✅ 全系列收口）
    - 实际开始：2026-06-03 02:05（执行模型 claude-opus-4-8）
    - **设计阶段产出**：code-architect (claude-opus-4-8 / agentId a662a6b4cd495065e) 端点 ADR amendment 草案 + 实施蓝图。结论：**体量 12+ 项必须拆 3 子卡**（CLAUDE.md PATCH >5 拆）。ADR-137 AMENDMENT 2026-06-02 已预告取代方向（实施 + 端点契约细化）。
    - **3 待裁定决策点（影响 ADR + 生产行为，启动 9-A 前定）**：(a) `/admin/merge` 默认 source（蓝图荐 `legacy` 直到 shadow 稳定 / 或 `identity`）；(b) reject 是否新增独立端点 `POST /admin/identity-candidates/:id/reject`（蓝图荐**是** → 新 route 须独立 ADR + Opus PASS + verify:endpoint-adr）；(c) 切 identity 默认前是否先全量回填 title_observations（蓝图荐 similar 先切·merge 待回填）。

11-A. **CHG-VIR-9-A** — Phase 2c：端点 ADR amendment + 候选来源读切换（fallback 就绪）（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 code-architect (claude-opus-4-8)）
    - **用户裁定**：similar 默认 identity（空表降级）/ merge 默认 legacy / reject 留 9-B。
    - 建议模型：**opus**（ADR-137 AMENDMENT 2.0 + ADR-105a AMENDMENT + by-videoId query 跨消费方 + 默认值决策）
    - 完成备注：**端点 ADR amendment + 候选来源读切换落地（code-architect a662a6b4cd495065e 蓝图 → 实施）**。ADR-137 AMENDMENT 2.0（similar 保留路径 + `?source=identity|legacy` default identity + 响应扩 optional candidateId/identityScore/strongNegativeReasons/status，全向后兼容旧前端读 similarityScore 不破）+ ADR-105a AMENDMENT 2026-06-03（merge candidates `?source=` default legacy）。`listPendingCandidatesByVideoId`（审核台对侧召回 CASE + version 过滤 Y5 / 复用 listSimilarCandidates join 范式）+ `listPendingCandidatePairs`（merge）。`ModerationService.listSimilar` source 分支返回 `{items,source}` + 空表自动降级 legacy（identity 来源 similarityScore=round(identityScore*100) 保旧前端不空）。`VideoMergesService.listCandidates` source 分支 + `buildGroupFromPair`（抽 schemas 避免 VideoMergesService 膨胀，520≈原 523；每 pending pair→2-video group）+ 空表降级。schema source 参数（SimilarQueryParams + ListCandidatesSchema）+ 前端 api 类型扩展（SimilarVideoItem optional + source 参数，返回类型不变避免破坏 TabSimilar）。**蓝图偏离（合理）**：merge identity 基础折叠（2-video，完整 N-video 连通分量 + 翻默认 identity 留 merge shadow 稳定后小卡）；前端 source envelope 回显留 9-C。门禁全过：typecheck/lint EXIT=0 + verify:adr-contracts EXIT=0（无新 route，endpoint-adr 不触发）+ **全量 6159 passed / 0 failed**（467 files / 净 +9：source-switch 7 + queries 2；7 现有 moderation-similar 测试更新消费 `{items,source}` 新契约 + 显式 source:'legacy'）。无 migration/写路径。**解阻 CHG-VIR-9-B**。执行模型: claude-opus-4-8
    - 范围：ADR-137 AMENDMENT 2.0（similar 端点契约：保留路径 + 新增 `?source=identity|legacy` + 响应扩 optional 字段 candidateId/identityScore/evidence/status，向后兼容）+ ADR-105a AMENDMENT（merge candidates `?source=`）；新 query `listPendingCandidatesByVideoId`（审核台召回对侧 pair）+ `listPendingCandidatesGrouped`（merge 按 group_key 折叠）；ModerationService/VideoMergesService source 分支 + **空表自动降级 legacy**。**不含新 route / 不含 migration / 不含写路径**（verify:endpoint-adr 不触发）。
    - 验收：候选来源可切（?source=），identity 空表自动降级 legacy；端点契约向后兼容（旧前端读 similarityScore 不破）。
    - 依赖：CHG-VIR-8 ✅。

11-B. **CHG-VIR-9-B** — Phase 2c：identity_decisions migration + confirmed→merge + reject 写路径（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 code-architect (claude-opus-4-8)）（拆自 CHG-VIR-9）
    - 建议模型：**opus**（migration 列级 DDL 跨 3+ 消费方 + 新 reject route ADR + confirmed→merge 事务 D-105a-11）
    - **前置门禁**：spawn Opus 子代理裁 ① identity_decisions DDL（migration 087）② 新 reject 端点 ADR-NNN 草案 → verify:endpoint-adr 通过。✅ 已执行（code-architect claude-opus-4-8 agentId afd09afa90913f9db / 22 项裁定决策表）。
    - 范围：migration 087（identity_decisions 表 + R8 CHECK confirmed 必有 audit_id + 索引）；`insertIdentityDecision`/`updateCandidateStatus`/`markDecisionReverted` queries（事务内 PoolClient）；merge 事务内挂 decision(confirmed)+candidate status=confirmed+关联 video_merge_audit.id（**单 BEGIN/COMMIT** D-105a-11 R8）；unmerge 联动 decision reverted；新增 `POST /admin/identity-candidates/:id/reject`（candidate rejected + decision，复活链 R6 已就绪）。
    - 验收：confirm→merge 单事务 + audit 关联 ✅；reject→candidate rejected ✅；unmerge→decision reverted ✅；verify:adr-contracts 通过 ✅。
    - 依赖：CHG-VIR-9-A（读契约）。
    - 完成备注：**identity_decisions 写路径落地（前置门禁 code-architect claude-opus-4-8 agentId afd09afa90913f9db → 22 项裁定决策 → 忠实实施）**。**ADR-178 Accepted**（D-178-1~6：reject 独立端点 admin only + 新建 IdentityCandidatesService〔VideoMergesService 超限不膨胀〕/ pending→rejected 非 pending 统一 409 / merge 扩 optional candidateId 单事务 R8 / unmerge 联动 decision 原地置 reverted_at + candidate 保持 confirmed 避撞 uq_identity_candidate_pending / DDL 定档 / audit actionType+targetKind 扩展）+ **ADR-105a AMENDMENT 2026-06-03（D-105a-11 闭环）**。**Migration 087**（identity_decisions：decision CHECK confirmed/rejected〔不预留 override/两段式 YAGNI〕+ R8 CHECK `decision<>'confirmed' OR audit_id IS NOT NULL` + partial unique `(candidate_id) WHERE confirmed` + revert consistency CHECK + actor_type 预留 system + 3 索引；**真实 DB 验证 6 项**：R8 拦截 ✓ / revert consistency 拦截 ✓ / 枚举拦截 ✓ / partial unique confirmed 拦截 ✓ / 双 rejected 通过〔R6 复活后再 reject 合法〕✓ / target_kind 15 种通过 ✓）+ **088**（admin_audit_log target_kind 14→15 加 identity_candidate，073 范式）。新建 `identity-decision.ts` queries（3 函数全 PoolClient 事务内）+ identity-candidate.ts 追加（findCandidateById FOR UPDATE / findCandidateByIdReadonly 事务前快速失败 / updateCandidateStatus from-state 守卫）。`VideoMergesService.merge` 挂载：candidateId 校验（404/409/422）**全在 BEGIN 前**（主路径零变更）→ 事务内 candidate confirmed + decision(confirmed,auditId)，并发被 reject → rowCount=0 → **整 merge ROLLBACK**；unmerge merge 分支事务内联动。**merge 函数 110→60 行**拆 assertVideosMergeable + runMergeTransaction（80 行红线，机械提取零行为变更）。新 route `identity-candidates.ts` + server.ts 注册。AdminAuditActionType + TargetKind 扩展 **4 处同步**（types union / ACTION_TYPES / coverage 守卫 / set-equal 镜像，R-MID-1 第 31 次系统化）。architecture.md §5.15 同步。门禁全过：typecheck/lint/adr-contracts EXIT=0 + verify:endpoint-adr 识别新端点（204 路由全对齐）+ **全量 6196 passed / 0 failed**（470 files / 净 +37：decision-queries 7 + reject 16 + confirm-decision 12 + 守卫 2）。e2e 归 9-C（本卡无 UI 变更）。VideoMergesService.ts 520→578（baseline 豁免内，膨胀来自 merge 拆分管理开销，拆分跟踪卡既有）。**解阻 CHG-VIR-9-C**。执行模型: claude-opus-4-8

11-C. **CHG-VIR-9-C** — Phase 2c：UI 切换 + confirm/reject 操作（状态：✅ 已完成 2026-06-03 / 实际开始 2026-06-03 11:39 / 执行模型 claude-opus-4-8 / 拆自 CHG-VIR-9）
    - 建议模型：sonnet（UI 编排，契约在 9-A/9-B 定）
    - 范围：审核台 TabSimilar + MergeClient source toggle（identity/legacy）+ confirm/reject 双按钮 + 证据展示**复用 EvidencePanel**（CHG-VIR-7）；server-next api 客户端扩展（SimilarVideoItem optional 字段 + rejectIdentityCandidate + mergeVideos candidateId 透传）。
    - 验收：两入口共用候选来源；UI 可回退 legacy；现有组件单测绿 + admin moderation/merge 手测。
    - 依赖：CHG-VIR-9-A + CHG-VIR-9-B。
    - 完成备注：**UI 切换 + confirm/reject 落地（Phase 2c 收口，CHG-VIR-9 全系列完成）**。契约补充：`CandidateGroup` 扩 optional `candidateId`（buildGroupFromPair 透出 `p.id`——9-A 遗留缺口，merge 工作台 confirm/reject 锚点；**ADR-105a AMENDMENT 2026-06-03 CHG-VIR-9-C** 登记，沿 9-A SimilarVideoItem 同款纯增量模式）。**共享层沉淀**：新建 `lib/identity/api.ts`（rejectIdentityCandidate 双入口真源，POST /admin/identity-candidates/:id/reject）+ `lib/identity/evidence-labels.ts`（EVIDENCE_LABELS 真源，EvidencePanel 改 import）。`listSimilarVideos` 消费 `{data,source}` envelope（缺省容错 legacy）+ strongNegativeReasons 类型对齐 `EvidenceType[]`。**TabSimilar**：source Segment toggle（默认 identity）+ 降级回显提示条 + 身份分 pill（identity 来源替代 similarityScore）+ 拦截原因 chips + 拒绝按钮（window.confirm 守卫 + 行本地移除 + toast）+「发起合并」深链追加 `&candidate_id`。**MergeClient 500 行红线先拆**：CandidatesSection+CandidateExpand → `MergeCandidatesSection.tsx`(348) + `MergeCandidateExpand.tsx`(194)，MergeClient 704→320，**budget 零新增**（19 违规全 pre-existing）；source toggle（默认 legacy / 用户裁定 (a)）+ 降级提示 + minScore 仅 legacy 显示（identity 路径后端不消费）+「执行合并」透传 candidateId（confirm 语义 D-178-3）+「拒绝候选」按钮；DirectMergeWorkspace 接 `?candidate_id`（**B 换选自动失效**防 pair 失配 422）+ dismissBanner 同步清理。门禁全过：typecheck/lint/adr-contracts EXIT=0 + endpoint-adr 204 对齐（无新 route/migration）+ **全量 6216 passed / 0 failed**（472 files / 净 +20：TabSimilar 5→10 + MergeCandidatesSection 7 新 + DirectWorkspace +2 + identity-api 6 新）。e2e：本机 :3000 webServer 冲突在页面加载前失败（沿 CHG-VSR-PRE-2 先例 = 非回归；另发现 right-pane-tabs.spec.ts:87 占位文案断言 pre-existing 漂移〔TabSimilar 2026-05-21 已真实化〕，归 e2e 环境长尾）；admin moderation/merge 手测归用户验收。**生产切 UI 前须先回填 title_observations**（卡面前置仍有效）。**+FIX-1（Codex stop-time review）**：merge candidates route 层丢 `result.source` 透传（9-A 遗留）→ 降级提示永不显示；route 补一行 + 新 route inject 测试 2 用例（lib 层 mock 漏过 route 缺口的针对性覆盖）。**+FIX-2/FIX-3（Codex review 第 2 轮）**：FIX-2 identity 分页 total 误用当前页 `groups.length`（候选超 limit 无法翻页）→ 新 `countPendingCandidatePairs`（与 list 同 WHERE 口径）+ 降级语义修正（仅真空表 count=0 降级 legacy；offset 超尾返回空 data 保持 identity **不悄降**）；FIX-3 `listPendingCandidatePairs` 不排除软删视频（legacy merge 软删 pair 一侧后 stale pending 候选确认必败）→ 双侧 EXISTS `deleted_at IS NULL`（similar 侧 by-videoId query 已有过滤无需改）。测试 +5（source-switch 8 / queries +3）。Codex P2 第 3 项（sources-matrix lastChecked filter 口径）属 CHG-VSR-3 范围 → 起 follow-up 卡 CHG-VSR-LASTCHECKED-FILTER-ALIGN。执行模型: claude-opus-4-8（建议 sonnet，用户直接以 opus 会话人工覆盖指派）
    - **前置（验证已证实）**：blocking 召回覆盖 = `title_observations` 覆盖度。dev 环境用 `scripts/backfill-title-observations.ts` 回填后跑通（573 桶/917 pair/193 候选/159 拦截/1.4s）；**生产切 UI 前须先回填 title_observations**（采集 fire-and-forget 覆盖不全），否则候选召回不全。**〔已满足 2026-06-03：CHG-VIR-OBS-BACKFILL 单环境定档，回填完毕 + full-rescan 留档 runbook §0〕**
    - **shadow 验证结论（2026-06-03）**：新增召回 170（标点/语言变体/符号差异漏合并治理 ✅）+ 强负拦截 159（season_mismatch/external_id_conflict 误合并拦截 ✅），逐条可解释，候选质量符合预期 → 支持切 UI。
    - 创建时间：2026-06-02 19:41
    - 建议模型：**opus**（取代 ADR-137 similar 算法；端点变更可能需 ADR amendment）
    - 范围：/admin/merge + 审核台「类似」tab 默认读 identity_candidate（C2：取代 ADR-137 四维加权）；旧实时 group by + ADR-137 算法降级 fallback。
    - 验收要点：两入口共用候选来源；UI 可回退旧来源；端点变更先补 ADR。
    - 依赖：CHG-VIR-8。

**Phase 2 收口 follow-up（2026-06-03 Phase 2 收口复核补建）**

11-D. **CHG-VIR-OBS-BACKFILL** — 生产 title_observations 全量回填（运维执行 runbook + 验证报表）（状态：✅ 已完成 2026-06-03 / 实际开始 2026-06-03 13:30 / **回填执行完毕 + 硬前置已解除**——用户确认单环境〔resovo_dev 为唯一库〕，runbook 全步骤走完留档 §0）
    - 创建时间：2026-06-03 12:50
    - 建议模型：sonnet（脚本已有 `scripts/backfill-title-observations.ts`；产出 runbook + 验证查询，生产执行主体为用户/运维）
    - 变更原因：9-C 卡面前置「生产切 UI 前须先回填 title_observations」（采集 fire-and-forget 覆盖不全）+ CHG-VIR-10 ingest shadow 有效性同依赖——blocking 召回覆盖 = title_observations 覆盖度（9-C 验证证实：dev 回填后 573 桶/917 pair/193 候选/159 拦截）。
    - 范围：生产执行 runbook（分批/可重入确认 + 覆盖度验证查询：有 observation 的 videos 占比）→ 回填后 `enqueue-identity-rescore` 全量重算 → `identity-compare-report` 验证候选量级与 dev 基线同数量级。无生产写路径变更（脚本只写 title_observations shadow 表 + identity_candidate）。
    - 验收要点：生产覆盖度报表 + 候选量级合理（与 dev 基线比例一致）；零生产归并行为变更。
    - 依赖：CHG-VIR-9-C ✅（脚本与 shadow 链路已 ship）。
    - 完成备注：**生产回填 runbook + 覆盖度验证报表落地**。新建 `scripts/report-title-observation-coverage.ts`（只读覆盖度报表：eligible videos〔与 backfill 脚本 WHERE 同口径〕/ 有观测 + coreTitleKey 非空两档覆盖率 / parser_version 分布识别旧版本残留 / blocking 分桶规模〔与 offlineRescore.fetchBlockingBuckets 同口径 HAVING>1 + ΣC(n,2) pair 上限 + 超护栏桶 n>50 计数〕）+ 新建 `docs/manual/title-observations-backfill-runbook.md`（§2 安全性声明〔零生产归并行为变更：只写 title_observations + identity_candidate 两张 shadow 表；DO NOTHING 真幂等可中断重跑，与采集链路 +1 语义差异显式说明〕+ §3 前置检查〔migration 085/086 / worker 在 apps/api 进程内注册无独立进程 / Redis / env〕+ §4 五步执行〔前快照→回填→覆盖率 100% 判据→enqueue full-rescan + `identity-rescore: done` 日志确认含 IdentityRescoreResult 字段表 + lockSkipped 处置→compare-report 候选密度 0.1×–10× dev 基线判据→留档〕+ §5 dev 基线 2026-06-03 实测〔3617 eligible / 100% 覆盖 / 617 桶 / 969 pair 上限 / 最大桶 8 / 193 pending 候选 / 170 新增召回 / 159 拦截 / 密度 ≈5.3%〕+ §6 异常处置表 + §7 回滚〔shadow 表无生产行为可回滚；清空语句限 pending，confirmed/rejected 关联 identity_decisions 审计链不得删〕）。dev 实跑两脚本验证可用。无生产代码变更（纯 scripts + docs，零端点/migration/schema）。门禁全过：typecheck/lint/adr-contracts EXIT=0 + 全量 **6222 passed / 0 failed**（473 files；首跑 1 DataTable matrix jsdom flaky 重跑全过，本卡未触及 admin-ui，沿 CHG-VIR-8 已知 flaky 先例）。共享层沉淀：统计 SQL 消费方仅运维 1 处不沉淀（CHG-VIR-10 报表复用时再抽 queries 函数）；DEFAULT_MAX_BUCKET=50 本地复述 offlineRescore 内联默认（未 export），注释指向真源。**补记（2026-06-03 当日收口）**：① runbook env 占位名修正 `.env.production.local` + REDIS_URL localhost 兜底警告（用户实操 not found 反馈，MAINT）；② **用户确认单环境（resovo_dev 为唯一库，无独立生产）→ 回填即已完成**；按 runbook §5 注重跑 full-rescan（job identity-rescore-1780519984663）反映 617 桶最新观测 → 候选 193→198（173 新增召回 / 162 拦截 / 密度 ≈5.5% 结构合理），留档 runbook §0。**CHG-VIR-10 与 CHG-VIR-9-D 硬前置解除；9-C「切 UI 前须先回填」前置满足**。执行模型: claude-opus-4-8（建议 sonnet，用户直接以 opus 会话人工覆盖指派，沿 9-C 先例）

11-E. **CHG-VIR-9-D** — merge 默认源翻转 identity + N-video 连通分量折叠（状态：✅ 已完成 / 2026-06-03）
    - 创建时间：2026-06-03 12:50
    - 完成备注：**pair→connected-component 页内折叠 + merge 默认翻 identity 落地（启动门禁 arch-reviewer 裁定 → ADR-105a AMENDMENT D-105a-18）**。**门禁裁定（arch-reviewer claude-opus-4-8 / agentId ad5a4777ebc076355）**：Q1 页内 union-find 折叠、**query 逐字不变**（否决拉全量〔ingest 旁路使候选无上界破坏 LIMIT 下推〕与改 ORDER BY〔破坏 identity_score DESC 主序〕）+ total 维持 pair 数（UI 文案「共 N 对候选」区分）+ groupKey=分量成员 video_id 升序 join（幂等稳定，N=2 退化旧 key 排序后特例）+ 同分量跨页拆行登记为 pre-existing 分页近似；Q2 confirm 锚点 = `MergeSchema` 扩 optional `candidateIds[]`（1-55〔cap=C(11,2)=11 视频完全图 pair 数；Codex stop-time review 修订裁定原值 20——会把合法 11-video 折叠组误拒 422〕，与单数 candidateId 互斥 refine + 去重；事务前逐个 404/409/422 校验 + 事务内循环挂 K 个 decision 同一 audit_id、任一 from-state 冲突整 merge ROLLBACK），**硬前提 = unmerge 反查对称修复**：`findConfirmedDecisionByAuditId`（LIMIT 1）→ `findConfirmedDecisionsByAuditId`（全部行）+ unmerge 循环 revert——原单行版在 K-decision merge 后漏 revert K-1 个（R8 回归），否决卡面选项 B（stale pending 残留）；Q3 reject = 逐 pair（per-candidate 端点 K 次独立调用，否决「拒绝整组」非原子半完成态 + 分量内证据异质），`PairScore` 加 optional `candidateId` 锚点（不进 evidence_hash）；Q4 默认翻转 = zod default + Service `?? 'identity'` 兜底**两处一致**（实施中发现第二处）+ MergeCandidatesSection useState 默认 identity，降级链路/toggle 保留。新建 `services/identity/collapsePairsToGroups.ts`（union-find 纯函数，500 行红线下不入 VideoMergesService）+ `buildGroupFromPair`→`buildGroupFromCluster` 演进（复用 `aggregateGroup` D-105a-15 min/union 零重复实现；score=min over pairs 同保守口径）+ EvidencePanel 逐对明细行内「拒绝此对」按钮。**范围项③（offlineRescore 头注释）已在 CHG-VIR-10 提前闭环**，本卡无需重复。门禁全过：typecheck/lint/adr-contracts EXIT=0 + 全量 **6269 passed / 0 failed**（478 files / 净 +18：collapse 6 新 + source-switch 折叠 2 + queries 复数化 1 + confirm-decision candidateIds/unmerge 循环 6 + schema source 默认 1 + 前端折叠组 2；video-merge-candidates/video-merges-identity 共 20 处 legacy 路径调用显式 `source:'legacy'` 适配翻转）。**dev 实测**：默认 identity 生效（202 pending pair）；100 pair 折叠 **49 行**（9 个 N>2 分量，「星辰变」4 视频 C(4,2)=6 pair→1 行）；N=2 单数锚点 40/40 保留；groupKey 两次取数幂等；legacy toggle 正常。e2e 无 merge 工作台 spec（9-C 先例一致），回归由 43 组件单测 + 实测覆盖。**遗留（AMENDMENT 登记）**：部分合并不支持 / 跨页同分量折叠留观察 / 「全部拒绝」便捷按钮可选增强 / N>11 折叠组整组合并 UI 禁用+提示（分批走逐对明细）。**+Codex stop-time review FIX（2026-06-03）**：① candidateIds cap 20→55（C(11,2) 与 sourceVideoIds max 10 + target 自洽）；② 折叠后 N>11 组在 UI 真实可达（旧每行固定 2 视频不触发）→ MergeCandidateExpand 禁用「执行合并」+ `merge-limit-note` 提示（`MAX_MERGE_GROUP_VIDEOS=11`）；+2 测试（cap 55/56 边界 + 8c 禁用断言）。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / agentId ad5a4777ebc076355)
    - 建议模型：sonnet（卡面；用户直接以 opus 会话人工覆盖，沿 OBS-BACKFILL/9-C 先例）
    - 变更原因：2026-06-03 Phase 2 收口复核补建——9-A 蓝图偏离登记「完整 N-video 连通分量 + 翻默认 identity 留 merge shadow 稳定后小卡」但小卡未入队列；设计 §4.3 要求 pair→group 按 connected components 折叠（现状每 pair→2-video group，同组 N 视频产生 C(N,2) 重复行）；设计 §Phase 2c 原文 merge 默认读 identity_candidate（用户裁定 (a) 暂 legacy 直到 shadow 稳定）。
    - 范围：`listPendingCandidatePairs` 消费侧 pair→connected components 折叠 N-video group（group_key/shared catalog-key；折叠层在 VideoMergesService/schemas，query 不变）+ `/admin/merge` 默认 source 翻 identity（ADR-105a AMENDMENT 更新 default + MergeClient 默认值同步）；legacy fallback 与 source toggle 保留。**顺带**：修正 `offlineRescore.ts` 头注释「多 key 并集」与实现不符的表述（CHG-VIR-8 补记留痕项 → 已随 CHG-VIR-10 提前闭环）。
    - 验收要点：N 视频同组只渲染一行 group（C(N,2) 重复消除）✅；confirm/reject 锚点 candidateId 在折叠后逐 pair 操作或按 group 语义定档（启动时裁定）✅；默认 identity 后降级链路（count=0→legacy）回归 ✅；现有 merge 单测/9-C 测试零回归 ✅。
    - 依赖：**CHG-VIR-OBS-BACKFILL ✅（硬前置已解除 2026-06-03：单环境定档，回填完毕）** + merge shadow 对比稳定（**用户 2026-06-03 裁定启动 ✅**）。

**Phase 3 — ingest-time shadow scoring**

12. **CHG-VIR-10** — Phase 3：findOrCreate 旁路 shadow scoring（不改 catalog_id 绑定）（状态：✅ 已完成 / 2026-06-03）
    - 创建时间：2026-06-02 19:41
    - 最后复核：2026-06-03 12:50（Phase 2 收口复核 → 启动前补全：前置门禁 ①② + 性能边界 + 回填硬前置 + 引用校正 Y3→R9+D-105a-12）
    - 完成备注：**ingest 旁路 shadow scoring + blocking 第二召回键落地（前置门禁 Opus 裁定 → ADR-105a AMENDMENT D-105a-16/17）**。**门禁①裁定（arch-reviewer claude-opus-4-8 / agentId abf779f6c31ce38a0）：混合 B+C，拒绝新表 A**——pair 类决策复用 `identity_candidate`（`trigger_source='ingest'`，086 预留）+ 全量决策 pino 结构化日志 `stage='ingest-shadow'`（outcome ∈ agree-bind/disagree-bind/candidate-only/none/no-counterpart），不新建表/不塞 identity_decisions/不加端点；hook 点 = `MediaCatalogService.findOrCreateWithMatch` 透出 `matchedStep`（7 个 return 点；**实施偏离①合理**：裁定假设调用方仅 CrawlerService 与事实不符〔7 处消费方〕，取裁定备选「并列方法+委托」零 churn）+ CrawlerService Step 4 后 fire-and-forget（沿 F3 容错范式）。**门禁②裁定：纳入 external_id 第二召回键**——新建 `services/identity/blockingRecall.ts`（段① core_title_key 分桶迁入 + 段② `provider:id` 桶〔Y-105a-4 双源 UNION〕keyset 分页 + 单 video 召回与分桶同数据源 SQL）；**实施偏离②（按裁定自身条款）**：`pg_indexes` 核验召回索引全部已存在 → 零 migration 零 DDL；evidence_hash blockingKeys 改「双方 core key + 共享 ext 桶 key 并集」（pair 数据确定性计算、召回路径无关），**不 bump SCORER_VERSION**（评分逻辑未变，仅受控局部 superseded）；**偏离③**：裁定 D 编号 15/16 校正为 **16/17**（14/15 已被 CHG-VIR-6.5 占用）。新建 `ingestShadow.ts`（召回→scorePair→upsert(ingest)→bind 判定〔仅 exact+无强负〕→日志；MAX_COUNTERPARTS=50）+ 抽 `pairScoringPersist.ts` 共享层（persistPairs/buildSides/blockingKeys 自 offlineRescore 沉淀，offline 与 ingest 双消费同口径）+ offlineRescore 双段编排（头注释「多 key 并集」自此与实现相符，CHG-VIR-9-D 注释项闭环）+ 报表扩 trigger_source 切片（`countCompareBucketsBySource` + `listForCompareReport` 可选过滤 + 脚本 `--source=`）。**生产 catalog_id 零变更（R9+D-105a-12）**：findOrCreate 5 步逻辑一字未改（仅返回值附加），ingest 测试断言全分支 db.query 仅 SELECT。门禁全过：typecheck/lint/adr-contracts EXIT=0 + 全量 **6251 passed / 0 failed**（477 files / 净 +29：blocking-recall 6 + pair-scoring-persist 4 + ingest-shadow 7 + crawlerIngestShadow 3 + matchedStep 4 + queries 3 + offline 双段改造 2）。**dev 实测**：重算 638 桶（617 core + **21 ext 新段**）/ 973 pairs（+4 ext 新召回 created）/ superseded 24（共享桶 key 进 hash 受控腾位）/ 1.25s；报表 202 候选切片正常；ingest 冒烟 31ms candidate-only 日志字段齐全。**已知语义（非债）**：ingest 重遇离线已建同 hash pair → noop 不改 trigger_source（首建路径语义）。自动绑定留 Phase 3 验收后另起 ADR（D-105a-12 不变）。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / agentId abf779f6c31ce38a0)
    - 建议模型：**opus**（findOrCreate 是采集入库核心归并点；shadow 持久化形态属 schema 决策）
    - **前置门禁（启动时先行，spawn Opus 子代理裁定后再落地）**：
      ① **shadow decision 持久化形态三选一**：新 shadow 表（migration；schema 跨 3+ 消费方 → 强制 Opus）/ `identity_candidate.evidence_jsonb` 扩展（`trigger_source='ingest'` 已在 086 预留，候选写入路径就绪）/ 纯脚本报表不持久化。**注意**：migration 087 `decision CHECK IN ('confirmed','rejected')`（YAGNI 裁定）——shadow decision 语义**不得塞入 identity_decisions**；荐沿 2b 脚本范式、不加 admin 端点（否则触发独立 ADR + verify:endpoint-adr）。
      ② **blocking 第二召回键裁定**：外部 ID 是否纳入召回键（CHG-VIR-8 补记缺口——现仅 core_title_key 单 key，外部 ID 同/标题异 pair 召回不到，shadow precision/recall 报表测不出该类漏召回）；不纳入则显式登记缺口与理由。
    - **硬前置**：CHG-VIR-OBS-BACKFILL ✅（**已解除 2026-06-03**：用户确认单环境〔resovo_dev 为唯一库〕，回填完毕 + full-rescan 重跑留档 runbook §0——198 候选 / 617 桶 / 覆盖率 100%）。
    - 范围：MediaCatalogService.findOrCreate 旁路计算「新评分会绑哪个 catalog」+ 记录 shadow decision/evidence（形态按前置门禁①）+ 对比现有 5 步；模糊只写 identity_candidate（`trigger_source='ingest'`），**不自动绑定**；仅强 exact ID + 无强负 + 与现有 5 步一致才与现行为一致绑定。**性能边界**：findOrCreate 为采集热路径，旁路须 fire-and-forget（沿 Phase 1b CrawlerService 写 observation 容错范式：写失败不阻断入库主流程）；ingest 旁路性能基线另立（D-105a-10 仅定义实时端点/离线 job 两类基线）。
    - 验收要点：shadow precision/recall 报表（复用/扩展 2b `identity-compare-report` 脚本）；生产 catalog_id 零变更（红线 **R9 + D-105a-12**；shadow 不触发 merge，D-105a-11 事务边界不适用本卡）；采集主路径无回归（fire-and-forget 容错验证）；是否开自动绑定留 Phase 3 验收后另起 ADR / Phase 5。
    - 依赖：CHG-VIR-8 ✅（identity_candidate + 评分模块）+ **CHG-VIR-OBS-BACKFILL ✅（硬前置已解除 2026-06-03）**。

**Phase 4 — 拆分证据化 + 多语种清洗**

13. **CHG-VIR-11** — Phase 4：拆分自动分组建议 + title_en 拼音迁出 + original_language 回填（状态：✅ 已完成 2026-06-03 / 拆 11-A ✅ + 11-B ✅ + 11-C ✅ 全收口，**Phase 4 完结**）
    - 创建时间：2026-06-02 19:41
    - **拆卡（2026-06-03）**：原卡范围 ≥ 6 项跨两条独立线（拆分证据化 / 多语种清洗），且建议模型本身双轨（opus ADR amendment + sonnet 数据清洗）→ 按 M-SN-5「PATCH 范围 ≥ 5 项拆 -A/-B 子卡」+ CHG-VIR-9 拆 9-A/9-B/9-C 先例拆 3 子卡（13a/13b/13c ↓）。依赖序：11-A → 11-B；11-C 依赖 ADR-175 ✅ 可独立（与 A/B 正交）。
    - 建议模型：opus（拆分增强 ADR-105 split amendment）+ sonnet（数据清洗）
    - 范围：拆分按 season/edition/core_title/外部ID/集数范围生成分组建议 + 支持拆到已有/新建 video（仍走 `video_merge_audit`）；title_en 拼音/罗马音迁出结构化 aliases（PinyinDetector）；original_language 回填。
    - 验收要点：拆分建议覆盖维度 + 审计强一致；拼音迁出/回填正确。
    - 依赖：**CHG-VIR-PRE-1**（insertNewVideo 已修）+ CHG-VIR-5 + CHG-VIR-2。

13a. **CHG-VIR-11-A** — Phase 4a：ADR-105 AMENDMENT 起草（拆分自动分组建议 + 拆到已有 video 契约）（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8) × 2）
    - 创建时间：2026-06-03
    - 建议模型：**opus**（ADR 起草，强制 arch-reviewer PASS）
    - 范围（纯 docs 定档）：ADR-105 AMENDMENT——(a) 新读端点 `GET /admin/videos/:id/split-suggestions`（建议分组只读预览，数据源 = title_observations facets + episode_number + 外部 ID，确定性不持久化）；(b) `SplitSchema.groups[]` 扩展 `targetVideoId` xor `newVideoMeta`（拆到已有/新建 video）；(c) 拆到已有 video 冲突预检（`uq_sources_video_episode_url` 同 R-105-1 范式）；(d) **snapshot/unmerge 还原协议修订**（现 unmerge 软删全部 target_video_ids——拆到已有 video 不得软删，snapshot 须区分新建/已有 target）；(e) 审计/错误码/鉴权继承。
    - 验收要点：AMENDMENT 落 decisions.md + arch-reviewer PASS + verify:adr-contracts EXIT=0 + commit trailer Subagents。
    - 依赖：CHG-VIR-PRE-1 ✅ + CHG-VIR-5 ✅ + CHG-VIR-6 ✅。
    - 完成备注：**ADR-105 AMENDMENT Accepted（arch-reviewer claude-opus-4-8 × 2 轮）**。decisions.md ADR-105 章节追加 AMENDMENT（2026-06-03 / Phase 4 拆分证据化）小节 + §端点契约表 #6 行（`GET /admin/videos/:id/split-suggestions`，先登记后实施，实施 = 11-B）。**6 D 条**：D-105-1 只读建议端点（**video_sources 线路真源**〔线路键与 getVideoMatrix 逐字一致〕+ **title_observations site 级聚合 facet 信号**〔dominant facets 三键确定性排序〕+ 确定性单维分组 core_title_key>season>release_marker>edition + **site 级盲区显式声明**〔同 site 线路必然同组〕+ `intra_site_multi_title` 信号兜底 + suggestedMeta 取 dominant raw_title〔core_title 维度组标题唯一来源〕）/ D-105-2 SplitSchema `targetVideoId` xor `newVideoMeta`（0 新建合法 / 同 catalog 不校验 / 不新增 audit 预检）/ D-105-3 冲突预检同 R-105-1 范式 BEGIN 前 / D-105-4 snapshot 扩 `created_target_video_ids` + **unmerge 仅软删新建 target**（旧 audit 兜底全视新建零行为变更）+ merge-after-split 争用链点名 / D-105-5 catalog 归属（已有 target 不 findOrCreate + 元数据零变更）/ D-105-6 审计扩展 + UI 消费 + candidate 残留沿现状口径。**9 红线**（含 R-105-S7 零 DDL + 零采集写路径变更两断言分立 / R-105-S9 线路键逐字一致 + 非空 string）+ **5 黄线**（含 Y-105-S1 veto 维度对称性）。**评审两轮**：第 1 轮 CONDITIONAL（agentId a14ab66155c13a55f / R-A1 数据源前提 + R-A2 线路键 2 红线）→ **主循环实读反驳 R-A1 断言②③**（`CrawlerService.upsertVideo` 的 `video.title` = 爬虫 payload 标题非 DB 行标题，误并场景 per-site 观测携带 B 作品真实标题 = 分裂信息；断言①〔site 级无 source_name 维度〕成立，落入 D-105-1 事实口径，并修正草案「per 线路三元组聚合」的事实漂移）→ 第 2 轮 PASS-with-conditions（agentId a100cd57de06fca45 / 反驳成立 + 修订版较第 1 轮路径 A 更优〔不动采集写路径 blast radius 更小〕；硬条件 1 响应类型非空 string + 硬条件 2 盲区落正文 + advisory-strong intra_site_multi_title 全采纳；Y-A1/Y-A2/Y-A3/A-2 全吸收）。零 migration 零新依赖零代码。门禁：verify:adr-contracts EXIT=0 + verify:endpoint-adr EXIT=0（204 路由对齐）+ typecheck EXIT=0（纯 docs，lint/test 基线不受影响）。**解阻 CHG-VIR-11-B**。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / agentId a14ab66155c13a55f + a100cd57de06fca45)

13b. **CHG-VIR-11-B** — Phase 4b：拆分自动分组建议 + 拆到已有 video 实施（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-03
    - 建议模型：**opus**（split 事务 + unmerge 还原协议变更，高风险路径）
    - 范围：按 11-A AMENDMENT 实施——split-suggestions 读端点（Service + queries + route）+ SplitSchema/SplitParams 扩展 + split/unmerge 事务修订（已有 target 冲突预检 + snapshot 区分 + 还原不软删已有 video）+ MergeSplitSection UI（建议分组预填 assignments + 拆到已有 video 选择器）+ 回归测试（split/unmerge 全路径）。
    - 验收要点：建议覆盖 season/edition/core_title/外部 ID/集数范围五维；拆到已有/新建混合分组 + unmerge 还原正确（已有 video 不被软删）；现有 split/unmerge 测试零回归；audit 强一致。
    - 依赖：**CHG-VIR-11-A** ✅。
    - 完成备注：**D-105-1~6 全部闭环实施**。① `GET /admin/videos/:id/split-suggestions` 落地：新建 `services/identity/splitSuggestions.ts`（纯函数：维度优先级单维分组 + dominant facets 三键排序 + intra_site_multi_title/external_id_conflict/episode_overlap/multi_* 信号 + unassignedLines 禁猜测）+ `SplitSuggestionsService.ts`（瘦编排，**线路真源直接复用 `getVideoMatrix`** = R-105-S9 键逐字一致的结构性保证）+ queries（titleObservations 加只读 `listObservationsByVideoId`〔dominant 排序 SQL 落定〕+ 新建 split-suggestions.ts〔外部 ID 冲突双源 UNION〕）+ route（404/409/422 与 split 同语义）；② SplitSchema `targetVideoId` xor `newVideoMeta`（组级 refine + 组间唯一 refine）+ 新建 `VideoMergesService.split-helpers.ts`（resolveSplitGroups：targetVideoId 校验 404/409/422 + 冲突预检 `detectSplitConflictsForTarget`〔新 query 同 R-105-1 口径〕全 BEGIN 前 + newVideoMeta 组 findOrCreate 迁入——**VideoMergesService.ts 593→599 仅 +6**）；③ split 事务组分支（existing 仅 assignSourcesToVideo 不建 catalog/video / D-105-5）+ `updateAuditTargetIds` 扩 createdTargetVideoIds（snapshot_jsonb 自由字段零 DDL）+ admin_audit_log afterJsonb 扩 existingTargetVideoIds（D-105-6）；④ unmerge split 分支按 `created_target_video_ids` 驱动软删（**已有 target 不软删 R-105-S4**；旧 audit 无字段兜底全视新建 = 旧行为逐值一致，显式测试）；⑤ packages/types 落 SplitSuggestion* 4 类型（sourceSiteKey/sourceName **非空 string** 硬条件 1）+ SplitGroup 扩展；⑥ MergeSplitSection（279→421 行）：「生成拆分建议」预填 groupCount/metas/assignments + signals/dimension 提示条 + 每组「拆到已有 videoId」输入（填后标题/类型禁用提示不改元数据）。门禁全过：typecheck/lint EXIT=0 + 全量 **480 files 6308 passed / 0 failed**（净 +39：纯函数 20 + 编排 3 + split 既有文件 +16〔混合组/全已有 0 新建/422/404/409/冲突 409 事务未开启/unmerge created 驱动+兜底/schema xor 6〕）+ verify:adr-contracts/endpoint-adr EXIT=0（205 路由对齐）。**dev 实测**：链路 65.8ms（p95≤200ms 达标）/ 幂等 / 真实数据 suggestible=false 正确路径（52a55ac8 第 2 coreTitleKey 挂 siteKey='' 观测无对应线路 → 不猜测 ✅）/ shadow 表注入往返 suggestible=true 双组分裂 + 三信号全触发（清理零残留）/ 冲突预检 SQL 真实只读验证。**已知边界（留痕）**：观测 siteKey=''（CrawlerService siteKey null 路径）无法对齐 matrix COALESCE 回退键（v.site_key），其 facet 不参与分组——合规 R-105-S2；对齐须改采集写路径 = 独立卡（R-105-S7 禁止本卡做）。零 migration 零新依赖。执行模型: claude-opus-4-8

13c. **CHG-VIR-11-C** — Phase 4c：多语种清洗（migration + title_en 拼音迁出 + original_language 回填 + aliases[] 迁移）（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-03
    - 建议模型：sonnet（数据清洗，规格全部来自 ADR-175 已 Accepted 定档；migration DDL 草案已在 D-175-2）；实际 opus 人工覆盖（沿先例本会话连续推进）
    - 范围：① migration（`media_catalog.original_language` 列 D-175-1 + `media_catalog_aliases` 结构化 5 列 + partial unique D-175-2，DDL 草案照落）；② `title_en` 拼音/罗马音迁出（**catalog 层独立调 `isPinyin`**〔R5/红线-2，不复用 video 层 title_en_is_pinyin〕→ `kind='romanization'` alias + title_en 置 NULL）；③ `original_language` 回填（Y-175-1：Bangumi 日漫→ja / 豆瓣 regions / 站点推断）；④ `aliases[]` 数组列→表迁移 + 只读化（D-175-5）；⑤ 回填顺序遵 Y-175-2（先 lang/script/region 再选 primary）；⑥ `CatalogUpdateData` 纳入 original_language（D-175-6）+ architecture.md §5.1a 同步（R6）。
    - 验收要点：迁出/回填正确可抽查；存量行不破坏（R7）；归一键语义零变更（R2）；简繁不归一（R1）；migration 真实 DB 验证约束。
    - 依赖：CHG-VIR-2 ✅（ADR-175 Accepted）+ CHG-VIR-5 ✅（isPinyin / parser）；与 11-A/11-B 正交可并行。
    - 完成备注：**ADR-175 D-175-1/2/5/6 落地 + 清洗执行完毕**。① **Migration 089**（original_language + aliases 5 列 + `uq_catalog_aliases_primary_locale` partial unique，DDL 草案照落；真实 DB 验证三态：同 locale 重复 primary 阻断 / 简繁 Hant 并列 primary 允许 R1 / 非 primary 多行允许）；② 新建 `db/queries/catalogAliases.ts`（`upsertStructuredCatalogAlias` D-175-6 口径：ON CONFLICT 仅填充缺失维度 + confidence 不降〔双 NULL 保 NULL〕+ **不覆盖 manual 行** / `ALIAS_KINDS` 常量真源 Y-175-3）；③ `CatalogUpdateData`/`MediaCatalogRow`/CATALOG_SELECT/fieldMap/RETURNING 全链路接 originalLanguage（safeUpdate 动态遍历 → 三重锁保护自动覆盖，零额外改动）；④ 新建 `scripts/catalog-multilingual-cleanup.ts`（三步 `--step=` + 默认 dry-run + `--apply`；软锁 locked_fields + 硬锁 video_metadata_locks(hard) 双重尊重；幂等）。**关键实施发现**：catalog title_en 实际污染形态 = **无空格连写拼音 slug**（"wuyanshashou"），isPinyin（空格 ≥2 词设计域）系统性 0 命中；且 **title_en 全列 3263 条无一含空格真英文标题**（全列污染）→ PinyinDetector 新增 **`isConcatenatedPinyin`**（保守：单 token 全小写 + ≥8 字符 + ≥4 音节 + distinctive，混合大小写/含数字 slug 不迁）**不改 isPinyin 既有语义**（红线-2 实质遵守：判定对象 catalog 层独立）；顺修 **音节分解贪心缺陷 → DP**（'dierji' 贪心 die+rji 误判，回溯 di-er-ji；27 既有 fixture 零回归 = 纯 false-negative 修复）。**执行结果（dev 唯一库）**：pinyin 迁出 **2551/3263**（alias kind='romanization' lang='zh' script='Latn' 保存原值 = 可逆）+ 残留 712 保守不迁（含数字 slug 364 + 阈值未达 348，宁漏勿错留 follow-up）；original_language 回填 **104/169**（ja=85/en=14/zh-Hans=5，确定性推断：假名→ja/谚文→ko/纯 ASCII 非拼音→en/汉字按 country 映射，置信不足 65 留 NULL）；aliases[] 迁移 no-op（本库数组列空，脚本就绪幂等）；**幂等重跑全 0 命中**。门禁全过：typecheck/lint/adr-contracts EXIT=0 + 全量 **480 files 6320 passed / 0 failed**（净 +12：isConcatenatedPinyin 11 + isPinyin DP 回归 1）；architecture.md §5.1（original_language 字段 + aliases[] 降级注记）+ §5.1a（ADR-175 段「规划草案」→「已落地」改写）同步 R6。零新依赖。primary 选举未执行（Y-175-2：维度未全量就绪，选举留 follow-up）；富集 Service 写结构化 alias 接线留 follow-up（ADR-175 follow-up 2）。执行模型: claude-opus-4-8

**Phase 5 — catalog 身份层（独立阶段，video-pair 链路稳定后）**

14. **CHG-VIR-12** — Phase 5：catalog_external_refs 落地 + 四列降级 + catalog 按季 + series_group + catalog-catalog 合并（状态：✅ 全系列收口 2026-06-04 / 拆 12-A~12-F 六卡全部完成 / Phase 5 完结；后续独立小卡 = findOrCreate 切主读〔对照观察期后〕/ 合并端点 + UI ADR / 双写收敛 + cache UNIQUE 复评 Y-A4 / 自动绑定 ADR）
    - 创建时间：2026-06-02 19:41
    - 建议模型：**opus**（catalog 身份层重构，最高风险）
    - 范围：落地 catalog_external_refs + findOrCreate 改读映射表 + 四列降级 cache + catalog 唯一键纳入 season_number + series_group/catalog_relations + catalog-catalog 合并（restore snapshot + 子表恢复，不依赖 deleted_at）+ 评估开启真实自动 catalog 绑定。
    - 验收要点：外部 ID 迁移前后 exact cache 与映射表一致；parent 一对多不污染 cache；catalog 合并可回滚。
    - 依赖：CHG-VIR-3 ✅ + CHG-VIR-4 ✅ + Phase 1-4 稳定 ✅（2026-06-03 Phase 4 完结）。

14a. **CHG-VIR-12-A** — Phase 5a：ADR-176/177 Phase 5 实施细则 AMENDMENT（开放决策点闭合 + 拆卡结构定档）（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
    - 创建时间：2026-06-03 21:00
    - 建议模型：**opus**（ADR AMENDMENT 起草，强制 arch-reviewer PASS）
    - 范围（纯 docs 定档）：闭合 ADR-176/177 留给 Phase 5 的全部开放决策点——Y-176-2/Y-177-2（findOrCreate 纳入 season）/ Y-176-3（series_group 建表与否）/ Y-176-4+Y-B（season_number 回填策略全系列一致）/ Y-177-1（candidate catalog_id 归属实装确认）/ Y-177-3（双写收敛 + cache UNIQUE 去留 + 存量回溯）/ Y-177-5（external_kind provider 映射细则）/ catalog-catalog 合并实施形态（端点 vs 脚本，若端点须契约登记 MUST-8）/ Y-177-4 自动绑定评估口径 / 12-B~F 拆卡边界裁定。
    - 验收要点：AMENDMENT 落 decisions.md + arch-reviewer PASS + verify:adr-contracts EXIT=0 + commit trailer Subagents。
    - 依赖：ADR-176 ✅ + ADR-177 ✅。
    - 完成备注：**ADR-176 AMENDMENT（D-176-7~10）+ ADR-177 AMENDMENT（D-177-11~14）双双 Accepted（arch-reviewer claude-opus-4-8 / agentId a6fba96b2a1ccb356 / PASS-with-conditions → 2 必修 + 4 建议全吸收）**。8 新 D 条：D-176-7（findOrCreate **不纳入** season 匹配——爆量新建论证 + 唯一键改造仅解约束阻塞）/ D-176-8（series_group **不建表**，连通分量动态派生 + Y-A1 锚点契约〔DAG 入度 0 正篇，多锚报告不猜测〕）/ D-176-9（存量**不批量回填** + 系列归位约束 + **R-A1 半回填态扫描脚本**〔12-C 验收项〕）/ D-176-10（合并 = **运维脚本先行不起 admin 端点**，原语落 Service 层可复用，MUST-8 不触发）/ D-177-11（external_kind 映射：bangumi/douban→`subject`〔豆瓣按季分条目精确级〕、imdb/tmdb 方向定档存量 0 留实装卡）/ D-177-12（迁移细则：bangumi 169→exact、douban 75→**维持 YY-D 保守 candidate**〔写入源 auto 富集风险不对称〕、**不动四列 cache 现值**〔findOrCreate 逐值零变更〕、**R-A2 一致性校验三口径**〔硬校验/待升级清单/孤儿 cache 检出〕）/ D-177-13（cache UNIQUE 保留 + 双写起点 12-D + 收敛不在 12 系列〔上卷 job 全量输入天然覆盖回溯〕+ Y-A4 复评显式 follow-up）/ D-177-14（findOrCreate **旁路对照先行不切主读** + 自动绑定保持 OFF + Y-A3 冲突 candidate 可观测出口）。拆卡定档 12-B~F 五张（每卡 ≤ 4 项 / Y-A2 标注 4 schema 对象 + 2 强制副产物）。dev 事实基线实测：四列 imdb=0/tmdb=0/douban=75〔全局零重复〕/bangumi=169、manual_confirmed primary 仅 2 行、season facet 覆盖 303/3617。门禁：verify:adr-contracts EXIT=0（D-176-7~10 + D-177-11~14 全登记 adr-d-status.json）+ typecheck EXIT=0（纯 docs）。**解阻 CHG-VIR-12-B**。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / agentId a6fba96b2a1ccb356)

14b. **CHG-VIR-12-B** — Phase 5b：schema migration（season_number 唯一键改造 + catalog_relations + catalog_external_refs）（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-03 21:00
    - 建议模型：**opus**（唯一键改造 + 双表 DDL，存量逐值不变验证）
    - 范围（12-A 定档 / Y-A2：4 schema 对象 + 2 强制同步副产物）：① migration `media_catalog.season_number` 列 + CHECK>0 + `uq_catalog_title_year_type` → `uq_catalog_title_year_type_season`（COALESCE 0 哨兵 / 存量逐值不变验证 R2）；② `catalog_relations` 表（5 relation + R7 反对称/DAG/有序对不变量守卫）；③ `catalog_external_refs` 表（D-177-1 schema + D-177-3 2 partial unique + 2 索引）；④ 真实 DB 验证全部约束；副产物 = `CatalogUpdateData` 扩 season_number（D-176-6）+ architecture.md §5.1a/§5.6 同步（R5）。R7/R10 跨行守卫工作量大时拆 12-B-1（建表）/ 12-B-2（守卫）。
    - 依赖：**CHG-VIR-12-A** ✅。
    - 完成备注：**ADR-176 D-176-2/3 + ADR-177 D-177-1/3 schema 全部落地，未拆 B-1/B-2**（守卫属写路径职责留 12-D/12-F；12-B 仅落 DB 可表达约束——swc 有序对 CHECK 为 R7 的 DB 兜底增强〔migration 086 ordered 范式〕，反对称/DAG/R10 跨行不变量留应用层守卫卡，零偏离）。Migration 090：season_number + `ck_media_catalog_season_number_positive` + 唯一键同事务 DROP+CREATE（CREATE 失败整体回滚保旧索引）+ DO 块 R2 域内重复预检 + catalog_relations（自环 CHECK + swc 有序对 CHECK + UNIQUE(from,to,relation) + to 反查索引；from 由 UNIQUE 前缀覆盖不另建）。Migration 091：catalog_external_refs 草案照落（含 rollup_rule YY-B）+ exact 全局唯一 partial + catalog 去重 partial（COALESCE 0 哨兵 R9 统一）+ catalog/provider_ext 2 索引。**真实 DB 验证 16 项全过**（090 九项：CHECK>0 / NULL 槽位 0 双行阻断〔逐值等价旧键证明〕/ season=2 与 NULL 共存〔解阻塞证明〕/ 同季去重 / 自环阻断 / swc 反序阻断 + 正序通过 / 重复边 UNIQUE / 带外部 ID 行 WHERE 域保留；091 七项：exact 全局唯一 / parent 一对多共存 / 同 catalog 去重 / candidate×2+rejected 同键共存〔R2 审计历史〕/ season 哨兵槽位去重 / CHECK>0〔R9〕/ provider CHECK；全部事务注入 ROLLBACK 零残留）。副产物：seasonNumber 接线 mediaCatalog.internal.ts 5 处（DbRow/Row/UpdateData/mapCatalogRow/CATALOG_SELECT）+ mutations.ts 3 处（fieldMap + RETURNING×2）；**CatalogInsertData 不扩**（D-176-7 findOrCreate 不纳入 season）；architecture.md §5.1（字段清单）+ §5.1a（ADR-176 段「规划草案」→「已落地」改写 + AMENDMENT 口径）+ §5.6（ADR-177 段同改写 + D-177-11 映射注记）。门禁：typecheck/lint EXIT=0 + 全量 480 files **6319/6320 passed**（1 失败 = data-table-auto-filter jsdom timing flaky，隔离重跑 24/24 全过，与本卡无关域）+ verify:adr-contracts EXIT=0（sql-schema **60 表**对齐〔+2 新表〕/ 205 路由）。零新依赖零端点零数据变更（数据迁移 = 12-C）。**解阻 CHG-VIR-12-C**。执行模型: claude-opus-4-8；子代理: 无（DDL 草案照落，规格真源 ADR-176/177 + AMENDMENT 全 Accepted）

14c. **CHG-VIR-12-C** — Phase 5c：既有数据迁移（四列回填映射表 + 一致性校验三口径 + 半回填态扫描）（状态：✅ 已完成 + 回填执行完毕 2026-06-03 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-03 21:00
    - 建议模型：**opus**（D-177-12 迁移分级 + R-A1/R-A2 校验脚本）
    - 范围（12-A 定档）：① 四列现值回填 `catalog_external_refs`（bangumi 169→exact subject primary / douban 75→candidate〔YY-D 保守〕/ imdb·tmdb no-op；**不动四列 cache 现值**）；② 一致性校验脚本三口径（D-177-12 R-A2：bangumi 硬校验 / douban 待升级清单 / 孤儿 cache 检出）；③ 半回填态扫描脚本（D-176-9 R-A1：同三元组簇 season_number 混存检测）；④ 幂等 + dry-run 默认。
    - 依赖：**CHG-VIR-12-B** ✅。
    - 完成备注：**D-177-10/12（迁移）+ D-176-9 R-A1 + D-177-12 R-A2（结构化守卫）全落地，回填已执行**。① `scripts/catalog-external-refs-backfill.ts`：MIGRATE_SPECS 分级真源（bangumi exact subject primary / douban candidate subject 非 primary）+ **imdb/tmdb 仅报告不迁移**（实施期细化：kind 事后推断不可靠〔YY-D〕，非 0 时显式告警交富集实装卡写入时判定，不猜测——对 D-177-12「no-op 脚本支持但空跑」的忠实强化）+ source 按 locked_fields CASE（D-177-10）+ rollup_rule='cache-column-backfill-12c' 溯源 + 幂等 WHERE NOT EXISTS（candidate 不进 partial unique 故不能 ON CONFLICT，统一口径）+ apply 单事务失败整体回滚 + 默认 dry-run。② `scripts/report-catalog-identity-consistency.ts`：Section 1 三口径全 4 provider 通用（HARD-1a exact primary ref 但 cache NULL/不一致 + HARD-1b cache 与 exact ref 值漂移 + REPORT-2 cache 仅 candidate 待升级清单 + HARD-3 孤儿 cache）/ Section 2 半回填态（簇键 `(title_normalized,type)` 不含 year〔同系列各季 year 常不同〕+ year/S 明细输出 + 翻拍同名 false positive 显式声明）/ HARD>0 EXIT 1 可接 CI。**执行结果（dev 唯一库）**：dry-run 计数与 12-A 事实基线逐值一致（169/75/0/0）→ apply 回填 244 行 → cache 列计数零变更（bangumi 169 / douban 75 不动 = 「不动 cache 现值」逐值验证）→ 幂等重跑 0 命中 → 报表全绿（HARD=0 / REPORT-2 douban=75 预期形态 / 半回填簇=0）。**负向验证三类全检出**：注入孤儿 cache（HARD-3=1）+ exact 漂移（HARD-1a=1 + 1b=1 双向）+ 半回填簇（Section 2=1 含 year/S 明细）→ EXIT 1 分支触发 → DELETE 4 行 CASCADE 清理零残留（refs 回 244 恰为回填集）→ 报表回绿。门禁：lint EXIT=0 + 全量 480 files **6320/6320 passed**（12-B 轮 flaky 本轮亦过 = flaky 确认）+ typecheck EXIT=0（scripts 不进主 tsconfig，与先例 catalog-multilingual-cleanup 一致）。零 src 改动零 migration 零新依赖零端点。**解阻 CHG-VIR-12-D**。执行模型: claude-opus-4-8；子代理: 无

14d. **CHG-VIR-12-D** — Phase 5d：catalog_external_refs 写侧原语（exact+cache 同事务 + R10 守卫 + D-174-3 双写）（状态：✅ 已完成 2026-06-03 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-03 21:00
    - 建议模型：**opus**（写路径原语 + 不变量守卫）
    - 范围（12-A 定档）：① ref 写原语（exact 写入与四列 cache 回填**同事务** YY-C / 删降级清 cache）；② R10 应用层守卫（external_kind 一致 + exact↔parent 互斥）+ D-177-11 映射常量表（ALIAS_KINDS 范式单一真源）；③ D-174-3 catalog 层冲突双写 `catalog_external_refs candidate`（catalog_id 归属 D-177-7/Y-177-1 两分支，video 级路径零改 R7）。
    - 依赖：**CHG-VIR-12-C** ✅。
    - 完成备注：**YY-C + R10 + D-177-7/13 双写起点全落地**。① 新建 `db/queries/catalogExternalRefs.ts`（180 行）：`EXTERNAL_KIND_BY_PROVIDER`（D-177-11 映射真源：bangumi/douban→subject；**imdb/tmdb 无默认值防误用**，写入时判定）+ `PRECISE_KINDS`（R10 取值域）+ `resolveAndWriteExactRef`（show kind → throw 契约错误 / R10 kind 全局一致守卫〔同 provider+external_id 既有 kind 不一致 → kind_conflict 拒写〕/ **索引① 预检主导**〔RR-A 范式：命中自身→already_exact 幂等；命中他者→降级 candidate = D-177-4 归并信号不靠唯一索引兜底〕/ INSERT `ON CONFLICT DO NOTHING` 仅并发保险〔rowCount=0 → 重查收敛降级〕）+ `insertCandidateRef`（幂等 NOT EXISTS，与 12-C 同口径）+ `demoteExactRef`（D-177-5 反向：清 cache 联动 exact→candidate 降级，UPDATE 保留审计不 DELETE，notes 留痕）。② **safeUpdate 单点接线**（关键架构洞察：运行时四列写入面 = doubanId×6 + bangumiSubjectId×1 **全部收敛过 safeUpdate** → 单点接线零逐 Service 改造）：filteredFields 命中外部 ID 字段时 —— 外部 client 复用其事务 / 无则自起 BEGIN/COMMIT（**未命中时不起事务主路径行为逐值不变**）+ conflict/kind_conflict 字段剔除**不写 cache**（槽位属 holder）计入 skippedFields + null 清空联动 demote + manual 锁字段以剔除后字段集为准 + provenance 收尾抽 `finishSafeUpdate`。③ BangumiService `applyEnrichmentDb` conflict 分支双写 catalog 级 candidate（Y-177-1 conflict → 入参 catalog；redirect 不写〔D-177-7 existing 已 canonical〕；video 级 candidate 路径零改 R7）。**dev 实测三分支**（真实 DB）：STEP1 exact ref(primary/manual/safe-update:manual) + cache 同事务 ✓ / STEP2 他 catalog 冲突 → skippedFields=['doubanId'] + candidate ref + cache 未写 ✓ / STEP3 清空 → demote candidate + notes='demoted: cache cleared' + cache NULL ✓；清理零残留 + 报表 HARD=0。门禁全过：typecheck/lint EXIT=0 + 全量 **481 files 6341/6341 passed**（净 +21：catalog-external-refs-queries 13 新 + safeUpdate 接线 8 新 + bangumi conflict 双写断言 + douban/bangumi mock 适配 connect/写原语）+ verify:adr-contracts EXIT=0。零 migration 零端点零新依赖。**流程备注**：本卡未先写 tasks.md 进行中卡片即开始实施（违工作流，补记于此），完成备注/收口流程正常。**解阻 CHG-VIR-12-E**。执行模型: claude-opus-4-8；子代理: 无

14e. **CHG-VIR-12-E** — Phase 5e：上卷 job + findOrCreate 旁路对照 + 冲突 candidate 可观测出口（状态：✅ 已完成 + 上卷执行完毕 2026-06-04 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-03 21:00
    - 建议模型：**opus**（D-177-4 确定性上卷 + shadow 对照）
    - 范围（12-A 定档）：① 上卷 job（D-177-4 四行规则表 + R3 保守底线 / 手动触发对齐 CHG-VIR-8 先例 / 消费 12-D 写原语）；② findOrCreate 旁路对照（D-177-14：保持读 cache 逐值不变 + 映射表 shadow 对照 pino 日志 + 报表，fire-and-forget）；③ 冲突 candidate 可观测出口（Y-A3：按 provider/external_id 聚合冲突簇报表，喂 12-F）。**不切主读**（独立小卡）。
    - 依赖：**CHG-VIR-12-D** ✅。
    - 完成备注：**D-177-4 + D-177-14 + Y-A3 全落地，上卷已执行**。① 新建 `services/identity/externalRefRollup.ts` 纯函数（四行规则表：confirmedIds=1 且 auto 无异议→exact 'confirmed-consensus'〔R3 唯一 exact 通道〕/ 仅 auto 一致→candidate 'auto-consensus' / 互斥与异值→全 candidate 'conflict'；确定性升序 + 幂等）+ 9 用例。② 新建 `scripts/catalog-rollup-external-refs.ts`（输入 = video primary 观测 JOIN videos 未删 / bangumi+douban subject 级先行〔imdb/tmdb show/parent 留实装卡 R6〕；dry-run 与 apply 同幂等口径预查；**exact 双路径**——cache 已同值仅升 ref 直走 resolveAndWriteExactRef〔零元数据变更不需源优先级许可，manual 所有权不误伤〕/ cache 需变更经 safeUpdate 12-D 接线〔锁/源优先级尊重 + 冲突自动降级，被阻登记交人工〕+ rollup_rule 溯源 YY-B）。③ findOrCreateWithMatch 外壳接 shadowCompareRefLookup（原体改 internal 单点覆盖；四 outcome：match / cache_hit_ref_miss〔douban 待升级=预期〕/ cache_hit_ref_mismatch〔异常〕/ cache_miss_ref_hit〔切主读行为变化点〕；fire-and-forget pino stage='catalog-ref-shadow'）。④ 报表 +Section 3 冲突簇（candidate 同 (provider,external_id) 跨 catalog 聚合 + rollup_rule/titles 明细，12-F 输入）。⑤ 原语增强：rollupRule 透传 + insertCandidateRef NOT EXISTS 扩 exact（自身已确认不插噪声；rejected 不阻插保复活）。**dev 执行**：douban confirmed 2 → 「冰湖重生」cache 同值升 exact ✓（**REPORT-2 待升级 75→74 上卷升级通道首例闭环**）/「大猩猩」cache NULL+metadata_source=manual → skipped 保守交人工 ✓；candidate 新增 12（video 归属与 cache 回填不一致 = 真实新信号）/ already 223；apply 复跑全幂等 0；报表 HARD=0 + 冲突簇 0；shadow 对照实测 match + cache_hit_ref_miss 双 outcome 结构化日志逐字段验证。门禁全过 typecheck/lint EXIT=0 + 全量 **482 files 6350/6350 passed**（净 +9）。零 migration 零端点零新依赖。切主读前置观察就绪（对照日志 + 报表）。**解阻 CHG-VIR-12-F**。执行模型: claude-opus-4-8；子代理: 无

14f. **CHG-VIR-12-F** — Phase 5f：catalog-catalog 合并脚本 + _bak_* 快照 + 重指向 + 回滚（状态：✅ 已完成 2026-06-04 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-03 21:00
    - 建议模型：**opus**（删行不可逆操作 + RR-A 预检范式）
    - 范围（12-A 定档 D-176-10）：① 合并原语落 Service 层（D-176-4 `_bak_*` 全字段快照〔主表 + CASCADE 子表 + 孙表 + catalog_relations + catalog_external_refs〕+ 关系边/ref 端点重指向 survivor〔RR-A exact 索引①预检主导〕+ videos.catalog_id 指向 + cache 重算 D-177-9）；② 运维脚本编排（默认 dry-run + `--apply`）；③ 回滚脚本（只插不删 R11 继承 + old/new 双列复位）。**不起 admin 端点**（MUST-8 不触发，端点 + UI 另起 ADR）。
    - 依赖：**CHG-VIR-12-B** ✅ + **CHG-VIR-12-D** ✅。
    - 完成备注：**D-176-4（快照范式 + R-2 重指向）+ D-176-10（脚本先行）+ D-177-9（RR-A 预检 + cache 重算）全落地**。① Migration 092（**DDL only 零 DML** 084 范式）：11 张快照表 = 084 同构 9 张（主表/episodes/characters/孙表 actors/provenance/locks/aliases + videos_catalog_id 指向）+ **新增** `_bak_catalog_relations_092` / `_bak_catalog_external_refs_092`（ADR-176/177 新 CASCADE 子表）+ `_bak_catalog_merge_ops_092` 注册表（loser/survivor + **survivor 四列 cache 合并前 jsonb 快照**〔D-177-9 回滚复位源〕+ rolled_back_at 防重复回滚）。② 新建 `CatalogMergeService`（merge 单事务十步：R10 前向守卫〔快照表 11/11 齐全否则阻断〕→ 注册 op → 全字段快照〔relations/refs 快照**双方端点命中行**保完整复位面〕→ videos 重指向 → provenance/locks 碰撞删 + 转移 → 内容子表转移〔084 IS NOT DISTINCT FROM 范式〕→ relations 重指向〔自环边删 + 撞 UNIQUE 删 + **swc 重指向后 LEAST/GREATEST 规范化**保有序对 CHECK〕→ refs 重指向〔**RR-A 索引① 预检主导**：survivor 已持同 (provider,external_id,kind) exact → 丢弃 loser 行进快照不 UPDATE；撞索引② 删；转移 exact 遇 survivor 同 provider 已有 exact → is_primary 置 false 保主绑定唯一〕→ 删 loser → **cache 保守重算**〔仅 survivor 该列 NULL 且获得 is_primary exact 才回填，已有值不覆盖〕→ dangling 断言 8 表清零否则整事务回滚；rollback：loser **原值复活无需 084 sentinel**〔092 零键覆盖问题，合并前共存恢复必不撞〕+ PK(id) 子表 DELETE by 快照 id + INSERT 全量精确还原〔relations/refs 同范式：被 UPDATE 行复原值 / 被 DELETE 行 INSERT 回，行 id 保留消除 disposition 列需求〕+ provenance/locks **只插不删 R11** + 疑似残留 REPORT + cache 按 merge_ops 快照复位 + rolled_back_at 防重复）。③ 2 编排脚本：catalog-merge.ts（--loser/--survivor；**dry-run = mergeInTx 完整路径预演 + ROLLBACK 零落库**）+ catalog-merge-rollback.ts（无参列出近 20 op / --op 预览快照行数 / --apply 执行 + 残留警示）。**dev 完整往返实测**：A(loser)+B(survivor)+C(第三方) 富内容造数 → merge 统计逐项断言（videosRedirected=1 / 自环 swc 删 1 / A→C season_of 重指向 B→C / douban dup candidate 去重 1 / bangumi exact 转移 + **B cache 回填 919191** / episodes 转移 / loser 删）→ rollback 全复原（A 复活 + videos 指向 A + episodes 回 A + B→C 边消失 + swc 复原 + B exact 消失 + **B cache 复位 null**）→ 重复回滚阻断 ✓ + provenance 残留 REPORT=1（R11 预期行为）+ 测试数据零残留（「残留 2」实为 dev 真实作品《往返80致富…》LIKE 误匹配，非残留）。门禁全过：typecheck/lint/verify:adr-contracts EXIT=0 + 全量 **483 files 6355/6355 passed**（净 +5 守卫单测：R10 阻断/行缺失/loser=survivor/op 不存在/重复回滚）。零端点零新依赖。**CHG-VIR-12 六卡（A~F）全收口，Phase 5 catalog 身份层完结**。执行模型: claude-opus-4-8；子代理: 无

**遗留项收尾核查（2026-06-04 / 用户指令「检查登记的遗留项，尝试彻底收尾」）**

15. **CHG-VIR-CLOSEOUT-AUDIT** — SEQ 遗留项核查收尾（5 项前置实证 + 状态登记）（状态：✅ 已完成 2026-06-04 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-04 12:29
    - 范围：12-A/12-F 登记的 4 项后续独立小卡 + Phase 3 shadow 验收观察期，逐项实证前置条件；纯文档收尾零业务代码。
    - **① Phase 3 shadow 验收观察期 → ✅ 验收 PASS 收口**：ingest-shadow 结构化日志全量 **1178 次对照（06-04 采集窗口）bindOutcome 分布 agree-bind 5 / candidate-only 143 / no-counterpart 694 / none 336、disagree-bind = 0 零分歧**；identity-compare-report ingest 切片 13 候选（2 高分跨 group 召回 + 11 强负拦截全部合理，season_mismatch / year_far_no_exact 逐条可解释）；生产 catalog_id 零变更（R9 + D-105a-12 持续成立）。自动绑定维持 OFF（Y-177-4，启用须另起 ADR = 遗留项 ⑤）。样本窗口 = 单日采集批；后续采集自然延续监控，无需专门观察小卡。
    - **② findOrCreate 切主读 → ❌ 前置未满足（已量化）**：D-177-14 前置 = 对照零分歧 + 一致性绿。一致性 ✅（report-catalog-identity-consistency HARD=0 全绿）；静态全量对照面 ✅ 由报表 Section 1 等价覆盖（HARD-1a/1b/3 = match / mismatch / 孤儿面全 0）；**实质阻塞 = douban 74 例 REPORT-2 待升级**（cache 有值仅 candidate → 切主读后该 74 个 douban_id 精确步将 miss 回落标题三元组 = 行为变化面）。消化路径 = R3 保守底线（manual_confirmed 一致才升 exact，上卷通道已闭环〔首例「冰湖重生」〕）→ 需人工确认 douban 匹配积累 confirmed 观测。**澄清：运行期 catalog-ref-shadow 日志 0 条非缺陷**——采集 findOrCreate 输入无外部 ID（probes=0 即 return / MediaCatalogService.ts:265），动态对照样本天然稀少，静态报表已等价覆盖对照口径。**触发条件：REPORT-2 计数趋 0（douban 人工 confirm 进度，报表可量化跟踪）**。
    - **③ 双写收敛 + cache UNIQUE 复评（Y-A4）→ ❌ 链式后置**：D-177-13 复评时点 = 切主读后，依赖 ②。
    - **④ catalog 合并端点 + UI ADR → ❌ 前置未满足**：12-F 登记「待候选量实证后另起 ADR」；冲突簇报表（Y-A3 / Section 3）当前 **0 个** = 无实证需求；且 /admin/merge 工作台重构（SEQ-20260604-01 CHG-VIR-13）规划中、范围明确「不含 catalog-catalog admin 端点」，先行实施 = 过度建设。**触发条件：冲突簇 > 0 或 CHG-VIR-13 收口后产品提出**。
    - **⑤ 自动绑定 ADR（Y-177-4）→ ❌ 评估输入不全**：输入 = Phase 3 shadow 报表（✅ 本卡 ① 收口）+ 上卷 candidate 精度数据（❌ 12-E 新增 12 candidate 零人工裁定）。**触发条件：上卷 candidate 人工 confirm/reject 样本积累**。
    - 完成备注：5 项中 1 项收口（①）、4 项前置未满足如实登记 + 触发条件量化；SEQ 状态字段同步翻转 ✅ 主体完结。顺带：`docs/designs/merge-split-ux-redesign_20260603.md` 补 `git add`（docs 新文档版本控制红线，SEQ-20260604-01 依赖文档）。门禁：纯文档改动 typecheck/lint 不适用；独立运行 report-catalog-identity-consistency ✓ HARD=0 / identity-compare-report ✓ 215 候选三桶健康。claude-opus-4-8。

---

#### CHG-VSR-LASTCHECKED-FILTER-ALIGN — 播放线路「最近检测」列筛选与显示值口径不一致（Codex review P2 发现 / 用户 2026-06-04 裁定启动）

- **状态**：✅ 已完成（2026-06-04）
- **创建时间**：2026-06-03 12:28
- **建议模型**：sonnet（实际 claude-opus-4-8，用户以 opus 会话人工覆盖）
- **变更原因**：Codex stop-time review（CHG-VIR-9-C 收口时 branch diff 全量复查）发现：`apps/api/src/db/queries/sources-matrix.ts:270-275` 行显示 `lastCheckedAt` 用 `COALESCE(MAX(vs.last_probed_at), MAX(vs.updated_at))`，但日期范围 filter 只比较 `MAX(vs.last_probed_at)` —— 无 probe 记录的行其可见「最近检测」日期来自 updated_at 回退，被匹配的日期筛选错误排除，列筛选与表格显示值不一致。
- **影响的已完成任务**：CHG-VSR-3（ADR-117 AMENDMENT 3 派生列）
- **文件范围**：`apps/api/src/db/queries/sources-matrix.ts` + 相关测试
- **变更内容**：filter 谓词改用与显示一致的 COALESCE 口径（或显示侧去回退，二选一须对齐 ADR-117 AMENDMENT 3 口径定义）。
- **完成备注**：**取方案一（filter 对齐 COALESCE）——显示侧为 D-117-VSR3-1 锚定真源（decisions.md「`COALESCE(MAX(vs.last_probed_at), MAX(vs.updated_at))` → last_checked_at」）不动**。`lastCheckedFrom/To` 两条 HAVING 谓词改 COALESCE 口径（count/data SQL 复用同一 havingClauses 数组 → 单点修复双查询同步生效）。**沉淀**：提取 `LAST_CHECKED_EXPR` module-level 常量（QUALITY_RANK_EXPR「单一 SQL 常量禁散落」同范式），显示列 / 排序列 / 2 filter 谓词 4 处共用根治口径漂移（本 bug 根因即散落两处漂移）；SQL 产出逐字节不变（断言字面 SQL 的既有测试原样通过验证零漂移）。**dev 真实 DB 决定性验证**：影响面 = 3498 个有源但零 probe 记录的视频（旧谓词下被任何日期筛选排除）；全日期范围（2026-04-22~06-03）旧谓词命中 108 vs 新谓词 **3606 = 显示口径预期逐值相等**（零多算零漏算）；有 probe 记录的行 COALESCE 退化为旧谓词 → 旧命中集是新命中集真子集，纯增量修复零回归。测试：既有 lastChecked filter 用例改断 COALESCE 口径 + 负向 regex 守卫裸 `MAX(vs.last_probed_at)` 比较谓词回归 + 新增 data SQL 与 count SQL 同 HAVING / 显示列口径未漂移断言。门禁全过：typecheck/lint EXIT=0 + 全量 **483 files 6359/6359 passed**（净 +1）+ verify:adr-contracts EXIT=0。零 migration 零端点零新依赖（verify:endpoint-adr 不触发）。执行模型: claude-opus-4-8；子代理: 无

---

## [SEQ-20260604-01] 后台合并/拆分页面 UI/UX 优化（CHG-VIR-13）

- **状态**：✅ **完全收口**（2026-06-04 23:15：全部 13 卡完成 + 收口硬前置 ①②③ 全兑现——② merge 深链 e2e ✅ 新建 `tests/e2e/admin/merge/merge-deeplink.spec.ts` 6/6 全过〔升级映射 5 形态 + records 双子视图；admin-next :3003 全 mock；修 playwright glob `?` 通配符歧义 → RegExp + catch-all 兜底〕；③ video 域 ✅ 已实跑归因〔13-D1：4 passed / 5 failed 经 stash 基线对照**逐字一致 = pre-existing**，其中 publish-flow 3 个 = `test:e2e:video` admin 段不起 web server 的域选跑脚本结构性缺陷，修复归独立 follow-up〕；① player 域 ✅ **已实跑收口（2026-06-04 23:10 / 用户停止外部 :3000 进程后）**——暴露并修复 pre-existing **webServer 编译破坏**〔PlayerShell（client）value-import `extractShortId` ← video-detail.ts 顶层 `next/headers` 拉入 client bundle，自 M3 时代潜伏、外部热 server 旧编译产物长期掩盖 = 13-PLAY 当时 38 failed 含 smoke 全挂的真正根因；收口 FIX：抽 `short-id.ts` 纯函数模块 + 5 文件改址 + re-export 兼容〕。修复后编译通过 + **smoke 2/2 绿 + 6 passed/1 flaky-passed**；其余 31 failed 逐层归因 = **e2e 数据基建欠账（pre-existing 非回归）**：(a) playwright webServer 无 api 条目〔:4000 须手动起，本次已起 API 重跑验证〕(b) **dev DB 零 e2e seed**〔home_modules 0 行 → 首页 main 恒空 → card 系 spec 必挂；player.spec 硬编码 fixture slug `test-movie-aB3kR9x1`/`test-anime-bC4lS0y2` 在 videos 表 0 行 → 播放链路必挂〕。本系列对 web-next 仅纯函数抽出（语义逐字不变，34 单测过）+ types 加性 optional = **零回归信号充分**。**建议立独立卡**：CHG-E2E-SEED〔web 域 e2e seed 基建：home_modules + fixture videos seed 脚本 + playwright api webServer 条目评估〕。）
- **创建时间**：2026-06-04 00:00
- **最后更新时间**：2026-06-04（融合修订：独立 B 稿对比裁定吸收，设计文档 §10；新增 13-A2/13-WS，13-A→13-A1，13-B2 拆 B2A/B2B，13-C2/13-D2/13-I18N 范围与依赖更新。第二轮问答补 §10.4 N→1 交互定档：矩阵 N 列布局 + 列头 target 单选归 13-B2A；候选组「转入合并工作区」+ >11 组转工作区裁剪分批归 13-B2B。第三轮问答补 §10.5 结构级结果预览〔getVideoMatrix ×N 合成线路×集数 + 结构信号，归 13-B2A〕+ 播放抽验〔AdminPlayer 复用 + 同集对比切换，新卡 13-PLAY〕；§11 目标布局/流程图 9 张入档）
- **目标**：在视频身份解析与合并/拆分升级已完成 Phase 5 的基础上，升级 `/admin/merge` 为统一的视频身份处置工作台（mode 骨架：candidates / merge / split / records 单一活动工作区），覆盖入口体系、合并/拆分前后预览、自动/手动记录、操作内状态设置。
- **范围**：`/admin/merge` 前端工作台（含 mode 骨架重构 + Direct/Batch 合一）、入口深链（含视频库行级拆分 / 批量合并所选新入口）、merge/split API response/body 加性扩展、identity decision 列表/复活端点、audit timeline 展开明细 + 行内撤销、导航 badge 实时化。**不含** 候选评分算法调整、auto-bind 启用、catalog-catalog admin 端点、`normalizeTitle` / `normalizeMergeKey` 修改、audit 表加列（零 migration，§10.1 裁定）、VideoEditDrawer 历史区块（P2 后置）。
- **依赖**：CHG-VIR-12 ✅ 已完成；设计文档 `docs/designs/merge-split-ux-redesign_20260603.md`（§1–9 定档 + §10 融合修订）。
- **依赖序**：13-ADR →（13-A1 并行）→ 13-A2 / 13-WS → 13-B1 → 13-B2A → 13-B2B / 13-PLAY / 13-C1 → 13-C2 / 13-D1 → 13-D2 → 13-I18N。后端卡（13-B1/C1/D1）与 UI 骨架卡（13-WS）可并行，无文件域交叉；13-B2B 与 13-PLAY 同依赖（13-WS + 13-B2A）可并行。
- **系列收口硬前置（e2e gate / 2026-06-04 Codex review 登记）**：全部 13 卡完成后、系列标 ✅ 前，须在**干净 e2e 环境**（外部 :3000 进程停止或 CI，webServer 由 playwright 自起）补跑：① `npm run test:e2e:player`（13-PLAY 门禁兑现；本机实跑因外部 next-server 占 :3000 致 smoke 级环境性失败，已归因非回归）② admin-next merge 页深链回归（13-WS ⑤ 登记）③ `npm run test:e2e:video`（13-D1 状态设置涉 VIDEO 域后追加）。任一失败 → 先修复再收口。

### 任务列表（按执行顺序）

1. **CHG-VIR-13-ADR** — ADR-105 AMENDMENT + identity decisions list/revive 独立 ADR（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04 00:00
   - 实际开始：2026-06-04 13:05
   - 建议模型：**opus**（端点契约 + 状态设置边界 + revive 幂等语义）
   - 范围：① ADR-105 AMENDMENT（candidates/audit response 扩展、merge/split body 状态设置扩展、post-COMMIT 非原子边界）② 新独立 ADR（`GET /admin/identity-decisions` + `POST /admin/identity-candidates/:id/revive`）③ `verify:endpoint-adr` / `verify:adr-contracts` ④ arch-reviewer PASS。
   - 验收要点：ADR 表覆盖所有新增/扩展端点；auto-bind 保持 OFF；状态变更不绕过现有状态机。
   - 完成备注：**ADR-105 AMENDMENT 2026-06-04（D-105-7~12）+ ADR-179 Accepted（D-179-1~6）**。AMENDMENT：candidates +7 optional（coverUrl 真源锁 `mc.cover_url`）/ audit +4 optional（actorType 从 decision 透出、`video_merge_audit` 零加列）/ merge·split body 状态扩展（targetVideoId 组结构互斥天然不可携带 status）/ **post-COMMIT 状态机边界**（transitionVideoState 自持事务 + migration 023 trigger，禁事务内裸 UPDATE；非原子显式声明 + `statusTransition` 响应可观测）/ unmerge `targetStatusBefore` 还原（fetchVideosByIds 扩 2 列依据实证）；红线 R-105-T1~T7 + 黄线 Y-105-T1~T5。ADR-179：decisions list + revive；**零 migration 四表实证**（086 trigger_source CHECK 复用 'manual-search' + `revived_from_candidate_id` 链一等标识 / 052 action_type 无 CHECK / 088 已含 targetKind / 041 primary 唯一）；revive 幂等 `reused` 标志 + 原 rejected decision 置 reverted 审计闭环 + pair 一侧软删 409。**arch-reviewer（a19744b07045b47e3）第 1 轮 CONDITIONAL → 红线 R1 修订后 PASS**：D-105-9 desired-only 固定映射对 approved-target（merge 主场景）确定性 422（approve/approve_and_publish/reject 均要求 from=pending_review，023 白名单 approved 间迁移走 publish/unpublish/set_hidden）→ 改「(current, desired) 二元组 → action」覆盖矩阵 + 13-D1 单测定档 + 前端 status-defaults 同矩阵唯一真源；Y1（088 归因 ADR-178）/ Y2（coverUrl）已收敛，Y3（设计 §5 旧表 +6 历史残留，以 ADR +7 为准）登记。门禁：verify:endpoint-adr ✓ 205 路由（ADR-179 2 新路径登记）+ verify:adr-contracts ✓ + typecheck/lint EXIT=0。零代码零 migration。**解阻 13-A1（并行位）/ 13-B1 / 13-C1 / 13-D1**。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)
2. **CHG-VIR-13-A1** — 入口收口 + badge 实时化（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04 00:00（融合修订：原 13-A 更名）
   - 实际开始：2026-06-04 13:45（实际 13:05 提交 13-ADR 后立即接续）
   - 建议模型：sonnet
   - 范围：① `admin-shell` countProvider 实接 `/admin/merge` pending 候选总数（SWR 60s）② 新增 `lib/merge/entry.ts` 统一深链构造 ③ 替换既有 4+1 处入口内联 URL（含 rollback `?tab=`）④ MergeClient 来源回链栏。
   - 验收要点：所有入口 URL 由单一 helper 生成；导航 badge 不再依赖静态 `count: 6`。
   - 完成备注：**① countProvider 实接**：新建 `lib/admin-shell-nav-counts.ts` `useAdminNavCounts`（60s setInterval 轮询 `listCandidates({source:'identity',limit:1})` 读 total → countProvider 闭包；**合理偏离登记：设计稿「SWR」按项目惯例落地为自写 hook**——server-next 无 swr 依赖，禁新依赖红线，范式对齐 admin-shell-notifications.ts；401/403 静默降级〔moderator 无 merge 权限〕+ 其他 warn 留痕 HOTFIX-G 范式；加载中/失败/0 不入 Map 无 badge）；admin-nav.tsx 移除静态 `count: 6` 假数据（保留 badge:'warn' 色调）；admin-shell-client.tsx stub→hook。**② entry.ts**：MergeEntrySource 4 枚举 + MERGE_ENTRY_SOURCE_META（label/backHref 单一真源）+ buildMergeHref（4 形态 discriminated union；**参数顺序契约显式登记**与既有测试断言一致）。**③ 5 处替换**：VideoRowActions / TabSimilar / PendingCenter（**补 from=moderation**）/ ModerationConsole 批量 / rollback-routes ×3（**补 from=audit-rollback**）。**④ 回链栏**：merge-entry-source-bar（from 合法值守卫渲染 + 返回按钮 push backHref + 关闭仅清 from 保工作流参数）；banner 内来源前缀文案移除（回链栏承载）。测试：+merge-entry.test 8 用例 + 回链栏 4 用例；split/rollback/banner 3 处断言随行为更新（URL +from / 来源文案迁移）。门禁：typecheck/lint EXIT=0 + 全量 **484 files 6371/6371 passed**（净 +12）；crawler #30 隔离复跑 191/191 确认 flaky 与本卡无关。merge 页 e2e 留 13-WS 深链回归 + 系列收口（设计 §9）。零 migration 零端点零新依赖；未触 packages/admin-ui。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——与 13-ADR 同会话连续执行）；子代理: 无
3. **CHG-VIR-13-A2** — 视频库新增合并/拆分入口（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04（融合修订新增，设计 §10.2 增强 #3）
   - 实际开始：2026-06-04 13:50
   - 建议模型：sonnet
   - 依赖：CHG-VIR-13-A1
   - 范围：① `VideoRowActions.tsx` 行级「发起拆分」（与「发起合并」并列）② `VideoBatchActions.tsx` 批量「合并所选」（selectedKeys ≥ 2 显示）③ `MergeEntrySource` 补 `videos-split` / `videos-batch` 枚举。
   - 验收要点：新入口走 buildMergeHref；批量入口 < 2 选中不显示。
   - 完成备注：**① 行级「发起拆分」**：buildItems +onSplit 参数 + `split` item（merge separator 组内并列）→ `buildMergeHref({kind:'split', videoId, from:'videos-split'})` 同窗深链（拆分工作台自动加载线路矩阵）。**② 批量「合并所选」**：`buildBatchActions` 加可选 `opts.onMergeSelected` 注入（纯函数零 router 依赖保持）；count ≥ 2 且提供回调才渲染（数组头插不影响既有索引型 limit 用例——旧调用不传 opts）；label 含计数「合并所选（N）」；无 confirm（导航动作，落地页自带工作区确认）；VideoListClient 注入 `window.open` 新窗口（**对齐 moderation-batch 既有行为**，保留列表选择上下文，免引 useRouter）。**③ entry.ts** 枚举 4→6（videos-split / videos-batch）+ SOURCE_META 同步（merge-entry.test META 完整性用例遍历枚举自动覆盖）。测试：VideoRowActions +3（merge/split 深链断言——router push 升级模块级 spy 顺手补 merge 深链断言空白 + 始终渲染）+ SelectionActions +3（不传 opts 零影响 / <2 不渲染 / ≥2 回调收全 ids，import 真实 buildBatchActions 非镜像）。门禁：typecheck/lint EXIT=0 + 全量 **484 files 6377/6377 passed**（净 +6）；两轮并发 flaky（UserSubmissions/其他，均隔离复跑过 + 末轮全量零失败）确认与本卡无关。零端点零 migration 零依赖；未触 admin-ui。**13-A 系全部收口；解阻 13-WS 无新前置**。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议，连续执行）；子代理: 无
4. **CHG-VIR-13-WS** — 工作台 mode 骨架重构（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04（融合修订新增，设计 §10.2 增强 #1）
   - 实际开始：2026-06-04 14:50
   - 建议模型：sonnet
   - 依赖：CHG-VIR-13-A1 ✅（entry.ts 先收口）；与 13-B1/C1/D1 可并行
   - 范围：① `?mode=<candidates|merge|split|records>` 模型 + Segment 4 区 + URL 双向同步 ② 旧参数升级映射（candidate_a/candidate_b/ids/split/candidate_id/from）③ DirectMergeWorkspace + BatchMergeWorkspace 合一为 `MergeWorkspace`（VideoPicker 集合编辑 + target 单选）④ MergeClient 拆文件（500 行红线）⑤ 既有深链回归 e2e。
   - 验收要点：同一时刻单一活动工作区；5+1 处旧深链升级映射逐一回归；旧组件删除无残留消费。
   - 完成备注：**mode 模型落地**：MergeClient 重写为骨架（370→231 行）——`deriveWorkspace` 升级映射真源（显式 ?mode= > candidate_a/ids→merge > split→split > tab=merged|split→records+AuditSection 预过滤 > 默认 candidates；**不重写 URL**，旧深链保持原参数内部推导）+ Segment 4 区（onChange→router.replace ?mode= 双向同步）+ 单一活动工作区（旧 banner/Direct/Batch/Split-toggle 堆叠废除）。**MergeWorkspace 新建（272 行）**：Direct（2→1/target 锁死）+ Batch（纯 uuid 列表）合一为集合编辑器——深链 ids 并行 fetch 预填（失败 id 占位行可移除）+ VideoPicker 增删排重 + target radio 任意切换 + reason + **candidateId 透传守卫**（成员集合恰为初始 pair 无序相等才透传，增删失配自动失效，沿 Direct 语义）+ 上限 11 禁用提示；BatchMergeWorkspace.tsx 删除、DirectMergeWorkspace 随 MergeClient 重写移除（grep 零残留消费）。测试：**MergeWorkspace.test 新建 9 用例**（吸收 Direct 6 + batch 4 语义：预填×3/执行参数/candidateId 透传+失效/移除重选/​<2 禁用/空工作区）+ MergeClient.test 15→16（Segment 4 区/双向同步两半【点击→replace mode= + URL 注入→渲染】/tab= 升级映射×2/mode=records×2/拆分流程改 URL 注入）+ banner test 重写（升级映射 3 用例 + 回链栏 4 保留）；旧 Direct/batch 测试文件删除。门禁：typecheck 0 error/lint ✓ + 全量 **484 files 6379/6379 passed**（复跑全绿，上轮 1 失败=并发 flaky）。**⑤ e2e 调整登记**：深链回归以单测层全覆盖（5+1 处升级映射逐一断言），Playwright e2e 留系列收口（设计 §9 既定）。**偏离登记**：SplitSection→SplitWorkspace 重命名推迟 13-B2B（卡面预登记）。**解阻 13-B2B / 13-PLAY / 13-C2**。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议）；子代理: 无
5. **CHG-VIR-13-B1** — 合并候选对比数据契约扩展（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04 00:00
   - 实际开始：2026-06-04 14:35（13-WS 大卡留待干净上下文，先行可并行域后端卡）
   - 建议模型：sonnet
   - 依赖：CHG-VIR-13-ADR ✅
   - 范围：① `VideoSummaryForMerge` 加性扩展 review/visibility/catalog/episodeRange/externalIds/**coverUrl**（7 字段，融合修订 +1）② candidates 查询 SELECT 扩展 ③ `mapVideoRow` 映射 ④ response 透出。
   - 验收要点：旧消费方零破坏；候选列表分页/排序/计数不变。
   - 完成备注：**D-105-7 全闭环**。① `VideoSummaryForMerge` +7 optional（R-105-T4 注释锚定）；② `fetchVideoDetailsForCandidates` SELECT 扩：v.review_status/visibility_status/catalog_id 经主键函数依赖免入 GROUP BY、mc.title/mc.cover_url 显式入、episodeRange=MIN/MAX(vs.episode_number)、**externalIds 走相关子查询**（仅 is_primary + manual_confirmed/auto_matched，避免与 vs 聚合笛卡尔；fetchRawCandidateGroups 组级行无 video 字段不需扩——按实际落地修正卡面表述）；③ 单一 `mapVideoRow` 扩 7 映射 → **legacy 候选 / identity 候选 / merge targetVideo 三消费点自动透出**（catalogTitle null→undefined 收敛）。测试 +4（SQL 数据源断言含 candidate/rejected 不透出守卫 / legacy 响应 7 字段 / R-105-T4 同输入 score·组数·推荐 target 逐值不变 / 旧 fixture undefined 向后兼容）。**dev 真实库冒烟**：SQL 形态 ✓ + external_ids 命中样本（douban 单 / bangumi+douban 双 provider，ORDER BY provider）形态精确符合契约。门禁：typecheck/lint EXIT=0 + verify:adr-contracts ✓（SQL schema 对齐含 video_external_refs 引用列）+ 全量 **484 files 6381/6381 passed**（净 +4）。零 migration 零端点。**解阻 13-B2A / 13-D1**。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议）；子代理: arch-reviewer (claude-opus-4-8)（13-ADR 阶段 D-105-7 契约 PASS / a19744b07045b47e3，本卡按契约实施）
6. **CHG-VIR-13-B2A** — 对比矩阵 + 结果预览组件（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04（融合修订：原 13-B2 拆出；§10.4 N→1 布局定档）
   - 实际开始：2026-06-04 15:10
   - 建议模型：sonnet
   - 依赖：CHG-VIR-13-B1 ✅
   - 范围：① `MergeComparePanel`（字段级矩阵：列 = 组内各 video N 列横向扩展，首列 sticky + 列区横滚 + 列最小宽度；**target 选择 = 列头单选**整列高亮，候选路径默认 recommendedTarget + 推荐 badge；冲突标警）② `MergeResultPreview`（合并后 target 形态随 target 切换即时重算 + 拆分组形态 + **原视频软删明示**，§10.2 增强 #4 / §10.4）③ **结构级线路 × 集数预览**（既有 `getVideoMatrix` ×N 按需拉取合成「合并后线路矩阵」+ 结构信号：集数互补正信号 / 同站同名线路 409 预警 / 完全重叠建议播放抽验；拆分侧组内明细零请求前端推导 + 组间集数覆盖提示，§10.5）。
   - 验收要点：展示字段级差异、保留 target、source 转移、拆分后目标形态与原视频去向；N=2 与 N>2 同构无独立形态；候选行展开默认不拉矩阵（按需「展开线路集数预览」）；不硬编码颜色。
   - 完成备注：**两组件新建（merge/_client 域内共享）**。① `MergeComparePanel`（268 行）：8 字段行 × N video 列（首列 sticky + 横滚 + minWidth 160）；列头 radio = target 单选整列高亮 + 推荐 badge；冲突推导纯函数 `deriveConflicts`（type/year 不一致→warn 行 ⚠ / 同 provider 不同 external_id→danger 行）；D-105-7 字段缺失渲染「—」零崩溃（legacy 降级兼容）。② `MergeResultPreview`（双形态 discriminated union）：merge 形态 = After 汇总（源数总和/站点并集随 target 切换 useMemo 重算）+ 软删列表 + **状态降级警示**（source 已审公开 ∧ target 非公开；数据缺失不误报）+ 13-PLAY 锚点 `onEpisodeClick?` 钩子（▶ 格渲染，抽屉留 13-PLAY）；split 形态 = 组卡（新建「默认待审·内部」/ 转入已有「不改元数据」D-105-5 文案）+ **原视频软删明示**。③ `combineMatrices` 纯函数（可单测）：getVideoMatrix ×N 合成 + 三信号（同站同名跨 video → danger 409 预警引导 /admin/sources；集数互补 → ok；完全重叠 → info 建议播放抽验）；**按需展开**（候选行展开默认零矩阵请求，按钮触发 Promise.all ×N）。测试 +12（矩阵 5 / 纯函数 3 / merge 形态 3 / split 形态 1）。**Codex stop-time review FIX ×2**：① 结构预览 stale 守卫——`videos` 集合变化（候选组切换/成员增删）时旧 structure 立即失效 + 飞行中旧请求 seq 比对作废（过期响应丢弃不覆盖新集合）+ unmount 防护；+2 回归用例（11b 集合变化清空 / 11c 挂起旧请求作废）。② **StrictMode 哨兵 bug**——unmount cleanup 置 `MAX_SAFE_INTEGER` 在 StrictMode mount→unmount→remount（ref 保留）后 `++` 超 2^53 精度失效 → seq 比对恒真 → 守卫永久失效；改 cleanup `+= 1`（飞行请求作废 + remount 自然递增）；+1 StrictMode 回归用例（11d：remount 后正常加载 + 集合变化守卫仍生效 + 可重新展开）。门禁：typecheck 0 error / lint ✓ / 全量 **484 files 6394/6394 passed**（净 +15；机器高负载期 3 个跨域 flaky 隔离 115/115 + 终轮全量零失败排除）。零端点零依赖；组件无消费方（13-B2B 嵌入）。**解阻 13-B2B / 13-PLAY**。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议）；子代理: 无
7. **CHG-VIR-13-B2B** — 预览嵌入 + 拆分 VideoPicker + 候选组转工作区（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04（融合修订：原 13-B2 拆出；§10.4 转入动作定档）
   - 实际开始：2026-06-04 16:05
   - 建议模型：sonnet
   - 依赖：CHG-VIR-13-B2A ✅、CHG-VIR-13-WS ✅
   - 范围：① 嵌入 CandidateExpand（替换卡片网格 + 纯文本影响预览）② 嵌入 SplitWorkspace 每组下方 ③ 拆分 VideoPicker ×2（选拆分对象 + 拆到已有 video，§10.2 增强 #2）④ 候选组「转入合并工作区」次级动作 + **N>11 组引导改转工作区裁剪分批**（替换现「逐对明细分批」提示；逐 pair 拒绝保留，§10.4）。
   - 验收要点：两处手输 uuid 消除；拆到已有 video 选中即展示目标卡；>11 组可经工作区裁剪后分批执行。
   - 完成备注：**① CandidateExpand 嵌入改造（213→160 行）**：视频卡网格 + 纯文本影响预览 → `MergeComparePanel`（targetId 受控列头单选）+ `MergeResultPreview kind=merge`；双 pill / EvidencePanel / 拒绝 / 执行合并保留；卡片样式常量与 RECOMMENDED_BADGE（移入矩阵列头）删除。**④ 转工作区**：`candidate-transfer-workspace` 次级按钮 → router.replace(mode=merge&ids=组成员csv，清 candidate_* 锚点——工作区集合可增删 confirm 锚点不跨带)；>11 提示改「转入合并工作区裁剪集合分批合并」。**②③ SplitWorkspace（MergeSplitSection 重命名兑现 13-WS 预登记，421→484 行 <500）**：拆分对象 VideoPicker（选中即 loadMatrix；深链 initialVideoId 自动加载 + 标题充实 fetch 注入 picker〔软删明示文案消费，失败 id 短码兜底〕）+ 每组「拆到已有视频」VideoPicker（GroupMeta.targetVideoId string → PickerVideoItem；选中即显目标卡 + 状态说明）——**两处手输 uuid 消除**；`previewGroups` useMemo 零请求推导（每组 sourceCount + 按线路聚合集数范围明细）→ `MergeResultPreview kind=split` 嵌入（组卡 + **原视频软删明示**）。测试：merge-split-deeplink 重写为 SplitWorkspace 版（4 用例：picker 渲染/自动加载+标题充实/变更重载/防抖）+ MergeClient.test 16→18（+转工作区 ids 断言 / +split 预览嵌入与双 picker 断言；5 处随形态更新〔多元素 getAllByText / 推荐 badge aria-label / 拆分流程改 ?split 深链自动加载〕）。门禁：typecheck 0 error / lint ✓ / 全量 **484 files 6396/6396 passed**（复跑全绿，上轮 2 失败 = 既见并发 flaky）。零端点零依赖；SplitWorkspace 484 行接近 500 预算（13-PLAY 嵌入时注意拆分）。**解阻 13-D2（嵌入点就绪）**。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议）；子代理: 无
8. **CHG-VIR-13-PLAY** — 播放抽验 PlayPreviewDrawer（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04（第三轮问答新增，设计 §10.5 / §11.9）
   - 实际开始：2026-06-04 18:55
   - 建议模型：sonnet
   - 依赖：CHG-VIR-13-WS ✅、CHG-VIR-13-B2A ✅；与 13-B2B 并行（实际后置 ✅）
   - 范围：① `PlayPreviewDrawer`（复用 moderation `AdminPlayer`，props 自足 videoId+sourceUrl+sourceId，跨模块导入沿 VideoEditDrawer 先例）② **同集成员切换 chips**（同 episodeNumber 下秒切 A/B/C/D source 对比画面 = 同一性判断核心交互）③ 结构预览矩阵格 / 拆分分配表行点击 ▶ 唤起 ④ 合并（候选行展开 + mode=merge）/ 拆分两侧嵌入。
   - 验收要点：不触 player-core/shell 公共 API（仅消费 AdminPlayer 封装）；feedback 上报沿用 AdminPlayer 内建；完成后补跑 `npm run test:e2e`（PLAYER 类）。
   - 完成备注：**① PlayPreviewDrawer（165 行）**：admin-ui `Drawer`（right/440）+ moderation `AdminPlayer`（key=sourceId remount 切源，沿 key-bump 范式；feedback 内建零另加；跨模块导入沿 VideoEditDrawer 先例）+ **② 同集切换 chips**（targets 中同 episodeNumber 全部格，§11.9 核心交互）+ 集数条（当前线路快速换集）。**③④ 嵌入与解耦重构**：结构预览自 MergeResultPreview 抽出独立 `StructurePreview`（282 行；输入收窄 `{id,title}` 最小 ref——VideoSummaryForMerge 与 PickerVideoItem 通吃，combineMatrices/stale 守卫/Codex FIX×2 随迁；MergeResultPreview re-export 兼容既有测试 import 170 行瘦身）→ 候选行展开（经 ResultPreview）+ **mode=merge 工作区直接嵌入**（成员 ≥2；§11.3 线框工作区预览嵌入随 ④ 落地，ComparePanel 因 summary 数据无端点不嵌——零新端点约束下结构预览即工作区预览形态，登记）；▶ 格默认唤起内置抽屉（外部 onEpisodeClick 注入优先 = 逃生口）；拆分侧分配表抽 `SplitAssignTable`（109 行；行级 ▶ + 500 行预算控制，SplitWorkspace 490 行守住）。测试：PlayPreview.test 新建 7 用例（抽屉 4 / 内置唤起 + 外部优先 2 / 分配表 ▶ 1）+ MergeWorkspace.test +1（工作区嵌入）+ deeplink stub 补 Drawer（修复全量 Unhandled「No Drawer export」）。门禁：typecheck 0 error / lint ✓ / 全量 **484 files 6404/6404 passed**（净 +8；复跑全绿，上轮 1 失败 = 既见并发 flaky）。**e2e（PLAYER 类）已实跑**（Codex stop-time review 修正「完成状态与 e2e 门禁不一致」）：`test:e2e:player` 8 spec——webServer 自起被外部 :3000 next-server 占用阻塞（EADDRINUSE）→ `PLAYWRIGHT_SERVERS=` 复用外部 server 实跑 **38 failed，含 smoke.spec 基础路由自身 2/2 失败**（`next-placeholder 返回 200` 不通过）= 占用 :3000 的外部 server 与 e2e 期望环境不符的**环境性失败**；归因证据 = 系列全部 commits 对前台 diff 仅 `packages/types/video-merge.types.ts` +17 行纯 optional 类型（apps/web-next / player-core 零触碰，smoke 不消费该类型）→ **与本系列零关联，非回归**。可信 e2e 验证（干净 :3000 环境重跑 PLAYER 域 + admin merge 页）登记为系列收口硬前置（见 SEQ 头部）。零端点零依赖零 player-core 触碰。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议）；子代理: 无
9. **CHG-VIR-13-D1** — merge/split 操作内状态设置后端扩展（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04 00:00
   - 实际开始：2026-06-04（13-PLAY 收口后接续）
   - 建议模型：**opus**（状态机 + merge/split 事务边界）
   - 依赖：CHG-VIR-13-ADR ✅、CHG-VIR-13-B1 ✅
   - 范围：① MergeParams/SplitGroup 类型 + schema ② `fetchVideosByIds` 扩状态列并写 `targetStatusBefore` snapshot ③ post-COMMIT 调状态机 + 非法组合 422 ④ audit 落点 ⑤ unmerge 还原 `targetStatusBefore`。
   - 验收要点：不传状态零行为变更；状态失败不回滚 merge/split 且前端可提示；存量 audit 兜底不动。
   - 完成备注：**D-105-9/10/11/12 全闭环**。① 类型 + zod：`VideoStatusSetting`/`StatusTransitionOutcome` 新类型 + `MergeParams.targetStatus?` / `SplitGroup.newVideoMeta.status?`（targetVideoId 组结构互斥天然不可携带 R-105-T5）+ 三 Result `statusTransition?`；`StatusSettingSchema` 双维 optional 但拒空对象。② **新建 `VideoMergesService.status-helpers.ts`（251 行）**：(current,desired) 二元组 → action 覆盖矩阵（**6 合法 current × 9 desired = 54 cell 全枚举单测定档**，评审 R1 兑现；每条目经应用层 9 值 action from-state 前置 + migration 053 trigger 白名单双层逐行核对，差集注释留档）+ `resolveStatusAction`（归一化 + no-op null + 矩阵外 422）+ `applyStatusTransition`（post-COMMIT 唯一通道 transitionVideoState R-105-T2，失败不抛 statusLog.warn 留痕 → 'failed'）+ `planTargetStatus`/`applyGroupStatusTransitions`（编排下沉控 Service 膨胀）+ `restoreTargetStatusBefore`。③ 编排：merge BEGIN 前 plan（非法 422 快速失败）→ 将 apply 时 snapshot 写 `targetStatusBefore`（no-op 不写，failed 后还原退化 skipped 自洽）→ COMMIT 后 apply →（4b 后查 targetDetail 反映新状态）；split per-group resolve（current 恒 pending|internal / migration 016 DEFAULT）+ 数组仅含携带组；unmerge snapshot 含 before → COMMIT 后反查 current 还原（存量 audit 无字段不动 = 旧行为逐值一致）。④ audit afterJsonb 纯增量补 targetStatus/requestedStatuses + statusTransition（D-105-12）。⑤ `fetchVideosByIds` +2 列（review_status/visibility_status）。Route 零改动（Result 自动透出）。**偏离登记 ×2**：(a) unmerge 还原复用单步矩阵——approve_and_publish/reject 的反向（approved|public→pending|internal 等）无单步回路如实 'failed' 人工兜底（D-105-11 非原子声明覆盖；两步还原须回 ADR 另行定档，不发明协议；dev 实测 + 单测固化该边界）；(b) VideoMergesService.ts 599→700（Baseline 豁免文件恶化 +101，helper 下沉已收敛 727→700，拆分归 MISC FILE-SIZE 跟踪卡）。测试 **+85**（矩阵定档 67 新文件 + mutations 18：merge 5/split 4/unmerge 4/zod 5）。**dev 真实库实测全绿**：轮1 set_hidden applied + snapshot 逐值 + unmerge set_internal 还原 applied；轮2 approve_and_publish applied（post-COMMIT 序保证 sources 先转移过 trigger active-source 检查）+ unmerge 还原无回路 failed 边界实证 + B 保持 approved|public；422 approved-target→rejected 整体不执行；split 携带组 approved|internal + 未携带组 DEFAULT；清理零残留。门禁：typecheck/lint EXIT=0 + verify:adr-contracts ✓ + test:changed 自动升全量 **6488/6489**（1=perf p95 高负载 flaky，隔离复跑 36/36 过）。**e2e:video 已实跑**：admin 段 4 passed / 5 failed——**stash 基线对照重跑失败列表逐字一致 = pre-existing 环境性失败**（publish-flow 3 个依赖 web :3000 而 PLAYWRIGHT_SERVERS=admin 不起 web 等），与本卡 diff 零交叉非回归；可信验证维持系列收口硬前置 ③。零 migration 零端点零依赖。**解阻 13-D2**。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / a19744b07045b47e3)（13-ADR 阶段 D-105-9 矩阵口径 R1 修订 PASS，本卡按契约实施）
10. **CHG-VIR-13-D2** — 状态设置前端控件 + 智能默认（状态：✅ 已完成 2026-06-04）
   - 创建时间：2026-06-04 00:00
   - 实际开始：2026-06-04（13-D1 收口后接续）
   - 建议模型：sonnet
   - 依赖：CHG-VIR-13-D1 ✅、CHG-VIR-13-B2B ✅
   - 范围：① `status-defaults.ts` 纯函数 + 规则表单测 ② `MergeStatusControl` ③ 候选合并/合并工作区/拆分三处嵌入（嵌入点随 13-WS 新骨架）。
   - 验收要点：只产状态机白名单组合；含 rejected source 不自动升级；拆到已有 video 状态只读；split 新建默认 pending/internal + 面板一键通过（§10.1 裁定 #1）。
   - 完成备注：**设计 §4.4 + §10.1 裁定 #1 全落地**。① **`lib/merge/status-defaults.ts` 新建（165 行）**：`legalStatusOptions` 矩阵镜像（与 13-D1 后端覆盖矩阵**双向逐 cell 一致性单测守护**——测试直接 import 后端 `resolveStatusAction` 对照，任意一侧漂移即红 / R-105-T7 第一层防线与第二层守门同源）+ `GENERIC_STATUS_OPTIONS`（工作区 current 不可知场景白名单组合，可达性后端 422 终守门）+ `SPLIT_STATUS_OPTIONS`（默认待审 / 直接通过 / 通过并公开，全 ∈ 矩阵 pending 行）+ `suggestMergeTargetStatus`（§4.4 六行规则表 first-match：rejected source 最高优先不升级 / target 已公开保持 / pending+source 公开建议 approve / approved|internal+source public 建议 approve_and_publish / 受限输入仅提示 / 数据不足不猜测）+ `describeStatusTransition`（仅 failed 产 warn）。② **`MergeStatusControl.tsx` 新建（101 行）**：受控 select + hint，value=null=保持不变（请求体零字段 R-105-T1 前端侧）。③ **三处嵌入**：CandidateExpand（D-105-7 字段齐备 → 矩阵镜像选项 + 智能默认预选，target 切换重算重置；legacy 降级 → GENERIC + 不建议；onMerge 签名 +targetStatus）/ MergeWorkspace（PickerVideoItem 仅 isPublished → GENERIC + 受限 hint，不产建议值）/ SplitWorkspace 每新建组（拆到已有组结构性无控件 = 只读 D-105-5）；三处 merge/split 调用透传 + `statusTransition` failed 提示「请在审核台手动调整」（split 数组逐 video 计数）。**SplitGroupMetaCard 抽出（114 行）**：组 meta 编辑卡（标题/类型/拆到已有 picker/状态控件），SplitWorkspace 490→**433 行净改善 -57**。**偏离登记 ×3**：(a) status-defaults 路径按设计稿 §4.4 真源 `lib/merge/`（卡面文件范围误写 `_client/`）；(b) `lib/merge/api.ts` 零改动（typed params/Result 自动透传，卡面预计需改实际不需）；(c) 实施中发现规则 2 单维建议值 `{reviewStatus:'approved'}` 与控件双维选项无法匹配预选（UI 显示 keep 实际提交建议值的不一致）→ 修正为 approve 单步效果 `(approved, internal)` 双维。测试 **+24**（status-defaults 19〔含矩阵镜像双向 6 态全枚举 + SPLIT 可达性断言〕+ MergeWorkspace 2〔透传 + failed toast〕+ CandidatesSection 2〔智能默认预选+透传 / legacy keep 不带字段〕+ deeplink 1〔split 组 status 透传 + 默认组不带〕）。门禁：typecheck/lint EXIT=0 + 既有 71 前端用例零破坏 + test:changed 增量 73/73。零端点零依赖零 admin-ui 触碰；e2e merge 页维持系列收口硬前置。**解阻 13-I18N（部分前置）**。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议）；子代理: 无
11. **CHG-VIR-13-C1** — identity decisions 列表 + revive 后端（状态：✅ 已完成 2026-06-04）
    - 创建时间：2026-06-04 00:00
    - 实际开始：2026-06-04（13-D2 收口后接续）
    - 建议模型：**opus**（新 admin 端点 + revive 幂等）
    - 依赖：CHG-VIR-13-ADR ✅（ADR-179 Accepted）
    - 范围：① `listIdentityDecisions` query ② revive Service 方法（`revived_from_candidate_id` 链 + pending 唯一约束处理）③ 2 个 route ④ audit 枚举扩展 ⑤ `IdentityDecisionListRow` 类型。
    - 验收要点：rejected 不被覆盖；revive 审计 payload 有内容断言；`verify:endpoint-adr` 通过。
    - 完成备注：**ADR-179 D-179-1~6 全闭环**。① **types**：新建 `identity-decision.types.ts`（`IdentityDecisionListRow` decision 全列 + pair 摘要〔双侧 title + deleted 标注〕/ list params/result / `ReviveCandidateResult` reused 标志）+ actionType `'identity_candidate.revive'`（admin-moderation union + AuditLogService 数组 + audit-log-coverage 守卫 REQUIRED×2，**R-MID-1 第 32 次系统化**；targetKind 复用零 CHECK 扩展）。② **queries**（identity-decision.ts 扩 ④⑤ 段，文件头 Pool/PoolClient 口径更新）：`listIdentityDecisions`（JOIN users + identity_candidate + 双侧 videos〔软删行 title 仍可取 + deleted 标注〕；排序 `created_at DESC, id ASC` 分页幂等）+ `countIdentityDecisions` + `findActiveRejectedDecisionByCandidateId`（D-178-2 至多一条）。③ **Service**：`listDecisions`（camelCase 映射 + identityScore 数值化）+ `revive`（FOR UPDATE 校验全写入前：404 / 非 rejected 409 / pair 一侧软删 409〔fetchVideosByIds 复用〕→ 单事务复制原行新建 pending〔`insertCandidate` 既有 ON CONFLICT 范式直接复用，revived_from 链 + trigger_source='manual-search' D-179-4〕+ **原行零修改** + 原 rejected decision 置 reverted；撞 pending unique → `findPendingByPairKey` 重查幂等 `reused: true` 且**不**置 reverted D-179-3）+ COMMIT 后 fire-and-forget audit（afterJsonb 含 newCandidateId/reused/revivedFromCandidateId/reason）。④ **route ×2**（identity-candidates.ts 内 D-179-6）+ zod（ListIdentityDecisionsSchema strict + reverted 字符串 transform / ReviveCandidateSchema）。**正向偏离登记**：卡面预计 identity-candidate.ts 需扩 query——实际零改动（insertCandidate/findPendingByPairKey 既有函数全覆盖 revive 需求）。测试 **+13**（revive 7：happy 逐值断言含 audit payload R-MID-1 / 404 / 409×2 / 幂等不置 reverted / 防御分支 / ROLLBACK 不写 audit；listDecisions 3：映射逐值 / 过滤透传 + offset / 缺省 null；zod 3）+ coverage 守卫 2 处常量同步。**dev 真实库实测全绿**：happy（新行 pending+链+manual-search+evidence 复制 / 原行保持 rejected / decision reverted 三列）→ 幂等（撞 unique reused=true 同 id）→ 409 非 rejected → 409 pair 软删 → list 过滤（candidateId / reverted=false 滤已撤销）→ audit 落库 afterJsonb 逐值 → 清理零残留。门禁：typecheck/lint EXIT=0 + `verify:endpoint-adr` ✓ **207 路由**（2 新路径与 ADR-179 契约表对齐）+ verify:adr-contracts ✓ + 全量见 changelog。零 migration 零依赖。**解阻 13-C2**。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / a19744b07045b47e3)（ADR-179 契约 PASS 引用，本卡按契约实施）
12. **CHG-VIR-13-C2** — 操作记录增强 + 决策记录 + 行内撤销（状态：✅ 已完成 2026-06-04）
    - 创建时间：2026-06-04 00:00（融合修订：范围 +行内撤销 + records mode 集成）
    - 实际开始：2026-06-04（13-C1 收口后接续）
    - 建议模型：sonnet
    - 依赖：CHG-VIR-13-C1 ✅、CHG-VIR-13-WS ✅
    - 范围：① `MergeAuditRow` 加性扩展 + Service 派生 ② audit 行展开 + auto/manual 列 ③ `MergeDecisionsSection` 决策记录子视图 + revive 操作 ④ records mode 集成（audit 时间线 + 决策记录两个子视图）⑤ 行内撤销 + reason 弹窗（§10.2 增强 #5）。
    - 验收要点：confirmed/rejected/reverted 可查；merge/split audit 可展开前后明细；rejected 可复活；有效行可直接撤销。
    - 完成备注：**D-105-8 全闭环 + ADR-179 前端消费收口**。① **后端派生**：`MergeAuditRow` +4 optional（actorType / relatedCandidateIds / relatedDecisionIds / videoTitlesSnapshot，R-105-T4 旧消费方零破坏）；`listAuditTimeline` +snapshot videos **SQL 内 jsonb 投影**（`jsonb_agg(jsonb_build_object(...))` + `jsonb_typeof` 防御，避免传整个 snapshot；dev 注入往返实证 + ROLLBACK 零残留）+ `fetchVideoTitles`（target 实时轻量查零 catalog JOIN）+ `findDecisionsByAuditIds`（页内单 SQL ANY 零 N+1；**Y-105-T3 dev EXPLAIN 实证 Bitmap Index Scan on idx_identity_decision_audit**）；Service listAudit 页内批量派生（actorType 无 decision 恒 'human' / source 标题 snapshot 投影 + target 实时 + 缺失兜底「(已删除视频)」）。② **AuditSection 改造（133→254 行）**：auto/manual「来源」列 + 行展开明细（前后形态标题 + 关联候选/裁定计数 + reason + reverted 信息）+ **行内撤销**（有效行展开区 reason 输入 + 确认 → unmerge 端点；UnmergeResult.statusTransition failed 复用 describeStatusTransition 提示 / D-105-11 联动）。③ **MergeDecisionsSection 新建（186 行）**：13-C1 list 端点消费（decision badge + pair 摘要软删标注 + 身份分 + reverted「已推翻」）+ rejected 未撤销且 pair 双侧存活 → 「复活候选」（reused 幂等差异化提示）。④ **records mode 双子视图**：MergeClient 内层 Segment（操作时间线 / 决策记录，255 行 <500 未另建容器）。⑤ 行内撤销 reason 以展开区内联输入实现（设计「reason 弹窗」轻量等价，零新 Modal 依赖——登记）。前端 client：identity/api.ts +listIdentityDecisions/reviveIdentityCandidate（merge/api listAudit 类型自动透出）。测试 **+11**（API 派生 4：actorType 双分支+零 N+1 单次 ANY 断言 / 三级标题兜底 / 老 snapshot null 投影 / R-105-T4 逐值+透传不变；前端 records 7：actor 列 / 展开明细 / 行内撤销调用+刷新 / 已撤销无控件 / decisions 渲染+软删标注 / revive+reused 提示 / 三态无复活按钮）。门禁：typecheck/lint/verify:adr-contracts EXIT=0 + 前端 merge 域 83/83（既有 76 零破坏）+ 增量门禁见 changelog。零 migration 零端点零依赖。**解阻 13-I18N（全前置就绪）**。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议）；子代理: arch-reviewer (claude-opus-4-8 / a19744b07045b47e3)（D-105-8 契约 PASS 引用）
13. **CHG-VIR-13-I18N** — merge 工作台硬编码文案抽离（状态：✅ 已完成 2026-06-04）
    - 创建时间：2026-06-04 00:00
    - 实际开始：2026-06-04（13-C2 收口后接续 / 系列末卡）
    - 建议模型：haiku
    - 依赖：CHG-VIR-13-B2B ✅、CHG-VIR-13-PLAY ✅、CHG-VIR-13-C2 ✅、CHG-VIR-13-D2 ✅
    - 范围：合并/拆分工作台新增文案抽离到 i18n 消息文件；保留测试用稳定 testid。
    - 验收要点：UI 文案不再新增散落硬编码；现有中英文消息结构不破坏。
    - 完成备注：**① audit-action-labels.ts 补缺 2 项**（维护约定兑现：`identity_candidate.reject`〔CHG-VIR-9-B pre-existing 欠账〕+ `identity_candidate.revive`〔13-C1〕；头注释「37 项」写死计数改为同步维护表述）。**② 新建 `i18n/messages/zh-CN/merge.ts`（MERGE_M 字典，moderation.ts `M` 同范式零框架）**：13 系列共享/语义性文案集中——statusPair 6 态 labels（status-defaults PAIR_LABELS 真源迁移）+ statusControl 7 项 + statusHints 4 项（§4.4 规则表提示）+ statusTransition.failed（R-105-T3）+ records 11 项（视图/actor/decision/状态/软删 labels）。**③ 六消费方接线**：status-defaults.ts（labels/hints/transition 全量切換）/ MergeStatusControl（default label）/ SplitGroupMetaCard（splitLabel）/ MergeClient（RECORDS_VIEW_ITEMS）/ AuditSection + DecisionsSection（actor/decision/状态/软删 labels）。**偏离登记**：组件一次性文案（placeholder/按钮/confirm 阻断文案）保留内联——与 CHG-VSR-6 反馈内联先例一致，验收「不再新增散落硬编码」按「语义性文案集中化」口径落地（全量逐字符串搬迁收益低于维护成本；待 next-intl 接入时统一迁 JSON）。文案值逐字不变 → 既有测试零改动零破坏（merge 域 + status-defaults 102/102 全过）。门禁：typecheck/lint EXIT=0 + test:changed 增量 EXIT=0。零端点零依赖。**SEQ-20260604-01 全部 13 卡完结**。执行模型: claude-opus-4-8（人工 opus 会话覆盖 haiku 建议，连续收口）；子代理: 无

---

## [SEQ-20260604-02] 测试流程安全瘦身 + 任务卡原子化（流程优化 / 用户指令插队）

- **状态**：✅ 已完成（五卡全收口 2026-06-04 19:35；ADR-180 D-180-1~6 全闭环。实测收益：单测增量 14.7s vs 全量 250s〔17×〕/ docs-only 0s；E2E 全量 290→207 用例、域子集 18~82 + 按需起 server；typecheck:turbo 缓存 37ms。后续卡：CHG-TEST-CLEANUP-* / CHG-TEST-SLIM-E / CHG-CARD-ATOM-VERIFY 待立案）
- **创建时间**：2026-06-04 17:40
- **最后更新时间**：2026-06-04 19:35
- **目标**：① 测试执行分层化——commit 前单测增量（vitest --changed import 图）+ 全量兜底收敛三节点（preflight 冷启动 / PHASE COMPLETE 审计前 / 合并 main 前）；E2E 按任务域选跑 + web-mobile 收窄移动 3 spec；typecheck 解绑 turbo `^build`。② 任务卡原子化判据定档——把 M-SN-5 PATCH 专属 ≤5 项规则推广为全卡型四问判据。
- **范围**：scripts/ 新增包装器 + 根 package.json scripts（只增不删）+ vitest.config.ts / playwright.config.ts / turbo.json + 规范文档（CLAUDE.md / test-rules / workflow-rules / quality-gates / decisions.md ADR-180）。**不动 tests/\*\* 测试代码**（清理另立后续卡）；`test:run` / `test:e2e` / `test:guarded*` / `preflight` 全量入口语义保持不变（兜底锚点）。
- **依赖**：无（与 SEQ-20260604-01 无文件域交叉；CHG-VIR-13 系列暂停让行）。
- **依赖序**：SLIM-A（定档）→ SLIM-B / SLIM-C / SLIM-D 可并行；CARD-ATOM 正交可独立。
- **决策依据**：用户三项拍板（2026-06-04）——增量为主+节点全量兜底 / E2E 按域选跑+mobile 瘦身 / 本次只改流程不动测试代码；可行性已验证（vitest 3.2.4 --changed 基于 module graph 兼容 customResolver alias；web-mobile 19 spec 中 16 个无移动逻辑、移动 3 spec 上下文自带不依赖 project device；turbo typecheck `^build` 会无谓触发 next build）。

### 任务列表（按执行顺序）

1. **CHG-TEST-SLIM-A** — ADR-180 测试分层执行策略定档 + 全量兜底节点规范（状态：✅ 已完成）
   - 创建时间：2026-06-04 17:40
   - 实际开始：2026-06-04 17:40
   - 完成时间：2026-06-04 17:55
   - 建议模型：opus
   - 范围（4 项）：① decisions.md 新增 ADR-180（增量门禁/forceRerunTriggers 集/E2E 域映射/web-mobile 收窄/typecheck 解绑/guarded 全量不耦合 六裁定）② workflow-rules.md PHASE COMPLETE 硬前置补全量单测+全量 E2E + 合并 main 前节点 ③ quality-gates.md §6 补一行（test:guarded/preflight 保持全量语义、不接入增量）④ 本序列后续卡登记核对。
   - 验收要点：verify:adr-contracts + verify:docs-format 绿；落档卡 changelog 不写未实施 D-180 字面（用裁定①~⑥，闭环字面归实施卡）。
   - 完成备注：ADR-180 Accepted（六裁定 + 5 备选否决 + 三重防护回滚论证）；workflow-rules 新增「全量测试兜底三节点」小节 + PHASE COMPLETE 触发条件补全量绿硬前置；quality-gates §6 补分层边界声明（D-180-6 即时闭环）；test-rules/CLAUDE.md 修订刻意归 SLIM-B/C（避免文档先于脚本的悬空窗口）。门禁：verify:adr-contracts FAIL-fast 三项全绿 + verify:docs-format 与基线一致零新增。执行模型: claude-opus-4-8；子代理: Explore ×3 + Plan ×1（均 claude-opus-4-8）。解阻 SLIM-B/C/D。
2. **CHG-TEST-SLIM-B** — 单测增量门禁实施（状态：✅ 已完成）
   - 创建时间：2026-06-04 17:40
   - 实际开始：2026-06-04 18:00
   - 完成时间：2026-06-04 18:25
   - 建议模型：sonnet
   - 依赖：CHG-TEST-SLIM-A ✅
   - 范围（5 项）：① 新增 scripts/test-changed.mjs（docs-only 跳过 / 配置·helpers·基础包升全量 / 否则 vitest run --changed HEAD / git 异常与零选中 fallback 全量）② vitest.config.ts 补 forceRerunTriggers ③ package.json +test:changed / +test:changed:main ④ CLAUDE.md 必跑命令单测行分层化 ⑤ test-rules.md 新增「分层执行策略」小节。
   - 验收要点：改 service 源→只跑相关测试；docs-only→SKIP exit 0；改 helpers/config/基础包→升全量；test:run 全量语义不变。
   - 完成备注：D-180-1/D-180-2 闭环。分级决策 7 场景 worktree 实测全过；门禁经 test:changed 自身入口跑通（配置改动命中触发集自动升全量 484 files 6394/6394 passed / typecheck·lint EXIT=0）；CHANGED 增量路径 commit 后干净树补验实测 = 改 1 个 service 文件 → 6 测试文件 / 117 用例 / 14.7s（vs 全量 250s，17×）。--dry-run 决策预览随卡落地。**+FIX（Codex stop-time review）**：分级改动集原 --diff-filter=ACMR 漏删除——仅删 helpers/基础包文件被视为"无改动"静默跳过；去 filter 纳入 D，5 删除 + 2 回归场景实测全过（见 changelog CHG-TEST-SLIM-B-FIX）。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议）；子代理: 无。
3. **CHG-TEST-SLIM-C** — E2E 任务域选跑 + web-mobile 收窄（状态：✅ 已完成）
   - 创建时间：2026-06-04 17:40
   - 实际开始：2026-06-04 18:30
   - 完成时间：2026-06-04 18:50
   - 建议模型：sonnet
   - 依赖：CHG-TEST-SLIM-A ✅
   - 范围（5 项）：① package.json +7 域脚本（smoke/player/auth/search/video/admin/mobile）② playwright.config.ts web-mobile 加 testMatch（mobile-tabbar/edge-swipe-back/mini-player 3 spec）③ known_failing 隔离清单核查同步 ④ CLAUDE.md test:e2e 行补域用法 ⑤ test-rules.md 各任务类型补对应域命令 + web-mobile 收窄说明。
   - 验收要点：--project=web-mobile --list 只列 3 spec；域命令用例数 ≪ 215；test:e2e 全量 4 projects 不变。
   - 完成备注：D-180-3/D-180-4 闭环。--list 实测：web-mobile 3 files/21 tests（原 104）、域子集 18~82 用例、全量 290→207（−29%）兜底未破。**偏离登记**：auth.spec/search.spec 实测为孤儿 spec（test:e2e 从未运行）→ 域映射据实校准 + ADR-180 D-180-3 校准注记；增强：PLAYWRIGHT_SERVERS 子集只起所需 dev server。隔离清单已全归档零清理。门禁 typecheck/lint EXIT=0 + 单测升全量 6394/6394。执行模型: claude-opus-4-8；子代理: 无。
4. **CHG-TEST-SLIM-D** — typecheck 解绑 turbo ^build + 试验入口（状态：✅ 已完成）
   - 创建时间：2026-06-04 17:40
   - 实际开始：2026-06-04 18:55
   - 完成时间：2026-06-04 19:20
   - 建议模型：sonnet
   - 依赖：CHG-TEST-SLIM-A ✅
   - 范围（2 项）：① turbo.json typecheck dependsOn `["^build"]` → `[]` ② package.json +typecheck:turbo（试验入口；默认链路仍用现有串行 typecheck，turbo inputs 缓存正确性另立验证卡）。
   - 验收要点：typecheck 与 typecheck:turbo 报错集一致；turbo typecheck 不再触发 next build。
   - 完成备注：D-180-5 闭环。typecheck:turbo EXIT=0 零 build 触发，首跑 21.7s / 二跑缓存 37ms FULL TURBO，报错集与串行一致。存量发现：eslint-plugin-resovo typecheck 脚本一直损坏（缺 @types/eslint；根串行从不含它）→ --filter 排除对齐现有覆盖，修复需新依赖留人工裁定。门禁 lint EXIT=0 + 单测升全量两轮（互不重合 jsdom 负载 flaky ×2 各自隔离全过排除）。执行模型: claude-opus-4-8；子代理: 无。
5. **CHG-CARD-ATOM** — 任务卡原子化判据定档（状态：✅ 已完成）
   - 创建时间：2026-06-04 17:40
   - 实际开始：2026-06-04 19:25
   - 完成时间：2026-06-04 19:35
   - 建议模型：opus
   - 依赖：无（正交可独立）
   - 范围（4 项）：① workflow-rules.md「PATCH 卡范围软上限」扩展为「任务卡原子化判据」（四问：改动项 >5 全卡型必拆 / 跨层混合 schema·api·UI 跨 3 层强制拆、跨 2 层须写跨层理由 / 验收口径必须一句话唯一、预估新增测试 >12 用例 advisory 评估拆分 / 依赖链 >4 层 advisory SEQ 重排）② quality-gates.md 硬清单第 5 项「PATCH 卡」→「所有任务卡」③ CLAUDE.md 绝对禁止项对应行同步 ④ 登记后续卡 verify:task-card-scope（自动守卫，可选）。
   - 验收要点：新规仅约束新起卡不追溯存量；与现有 PATCH 条款为超集关系不冲突；verify:docs-format 绿。
   - 完成备注：四问判据落档（真源 workflow-rules §任务卡原子化判据；quality-gates/CLAUDE.md 引用同步；旧名引用全更新）。仅约束新起卡不追溯存量；自动守卫已登记 CHG-CARD-ATOM-VERIFY。门禁：test:changed docs-only SKIP 实测生效（新分层流程自证）+ verify:docs-format 存量基线零新增。执行模型: claude-opus-4-8；子代理: Explore ×1 (claude-opus-4-8)。**SEQ-20260604-02 五卡全收口**。

### 后续卡登记（本序列产出，不在本序列内执行）

- **CHG-TEST-CLEANUP-\***（待立案）：测试代码瘦身——拆 >1000 行巨型测试文件（CrawlerClient 1184 / column-matrix-menu 1150 / bangumi-service 1048 / video-merge-mutations 1014）/ 参数化重复用例（step-ep5 类 50 次同构断言）/ 复审过度 mock（全仓 1091 次 vi.mock）。按模块分批，每批一卡 ≤5 文件。
- **CHG-TEST-SLIM-E**（待立案）：turbo typecheck inputs 缓存正确性验证（改 packages/types 确认依赖 workspace 缓存失效；验证通过后才可在文档把 typecheck 默认链路切 turbo）。
- **CHG-CARD-ATOM-VERIFY**（待立案，可选）：verify:task-card-scope 脚本——解析 task-queue.md 活跃卡「范围」项计数，>5 项无 -A/-B 拆分输出 advisory 警告。

---

## [SEQ-20260605-01] 首页运营 /admin/home UI/UX 改造（字段补齐 + 卡片/预览真实化 + 入口体系）

- **状态**：✅ 已完成（全 13 卡收口 2026-06-05 16:56；改造主线〔UX 缺口 1-7〕+ 入口体系〔页内/深链/趋势〕全交付；前台三断裂按用户裁定仅登记后续卡）
- **创建时间**：2026-06-05 15:04
- **最后更新时间**：2026-06-05 16:56
- **目标**：① 对齐设计稿 reference.md §5.7 + P-home.md §6——模块卡片（序号/120×54 横图/标题降级链/四色生命周期 Pill）+ 预览面板轻拟真（真实封面+标题）+ Drawer 体验（datetime-local / 图片上传 / auto-fill）+ 一致性收编（Segment / Modal 删除确认）。② 字段补齐（用户裁定）——home_modules 增 title JSONB 多语言 + image_url 一等列（参照 home_banners），media ownerType 扩 home_module。③ 视频入口体系（用户裁定：半自动 + 确认面板）——页内 VideoPicker multiple 批量添加 / 视频库行级+批量深链（仿 merge entry.ts 模式）/ 趋势导入 + top10 补位可视化。
- **范围**：docs(decisions/architecture) + migration 093 + packages/types + apps/api(queries/service/media 3 文件) + apps/server-next(app/admin/home/_client 4+3 新文件 + lib/home-modules 4 文件 + lib/videos 接线 + videos/_client 3 文件接线) + tests。**不动**前台 apps/web-next（banner/featured/type_shortcuts 三处前台断裂仅登记 follow-up，用户裁定）。
- **依赖**：无（dev 分支直接推进）。
- **依赖序**：ADR →(Opus PASS)→ 01-A → 01-B → 03 → 04-A → 04-B → 06；02 与 03 并行（05 依赖 02+03）；04-B → 07 → 08/09；FUP 收口。
- **决策依据**：用户三项拍板（2026-06-05）——字段本次一并补齐 / 前台断裂仅登记 / 预览轻拟真；入口两项拍板——自动入选=半自动趋势导入+补位可视化 / 深链落地=确认面板。计划全文见 plan 文件（linear-drifting-minsky）。

### 任务列表（按执行顺序）

1. **CHG-HOME-UX-ADR** — ADR-052/104 AMENDMENT（home_modules title/image_url + media ownerType）（状态：✅ 已完成）
   - 创建时间：2026-06-05 15:04
   - 实际开始：2026-06-05 15:04
   - 完成时间：2026-06-05 15:30
   - 建议模型：opus
   - 范围（5 项）：① ADR-052 AMENDMENT：home_modules +title JSONB NOT NULL DEFAULT '{}' / +image_url TEXT NULL 一等列（vs metadata 通道论证）② ADR-104 AMENDMENT：Create/Update body 扩 title?/imageUrl?（不新增 route）③ media ownerType 扩 'home_module' 裁定 ④ image 对 video 类型可选+回退 coverUrl / auto-fill 走 drawer 端 fetch（ContentRefPicker 契约不动）/ 卡片 120×54 本地 img（不扩 Thumb）裁定 ⑤ architecture.md home_modules 表同步两列。
   - 验收要点：arch-reviewer Opus PASS；verify:adr-contracts 绿。
   - 完成备注：D-052-9/10/11 + D-104-9/10 五决策定档。arch-reviewer（ab0afb7523bcdd0ed）PASS-with-conditions → R-1 影响面清单（6 触点 + 公开端点 GET /home/modules 纯增量透出确认）+ Y-1 metadata 守则「title/subtitle 覆盖」条目显式 supersede 吸收；Y-2/A-2 转 follow-up（CHG-HOME-BANNER-URL-MAX + title 值侧约束评估）；A-1 实证 .url() 双 provider 绝对 URL 安全 / A-3 实证 093 标号。verify:adr-contracts EXIT=0（207 路由对齐 + SQL schema 对齐）。解阻 CHG-HOME-UX-01-A。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。
2. **CHG-HOME-UX-01-A** — schema + query 层（状态：✅ 已完成）
   - 实际开始：2026-06-05 15:35 ｜ 完成时间：2026-06-05 15:22
   - 建议模型：sonnet
   - 依赖：CHG-HOME-UX-ADR ✅
   - 范围（4 项）：① migration 093（ADD COLUMN IF NOT EXISTS 幂等 + 注释 down 节）② packages/types home-module.types.ts 扩字段 ③ db/queries/home-modules.ts DbRow/mapRow/INSERT/UPDATE fieldMap/4 处 SELECT ④ home-queries.test.ts 扩断言。
   - 完成备注：093 已执行 dev 库（幂等复跑 ✅ / INSERT 往返逐值一致 / 默认值 {}/null / 清理零残留）；列清单实为 6 处（4 SELECT + 2 RETURNING）全补；UPDATE fieldMap +2 + JSONB_KEYS 统一 stringify；测试 +5 断言（落点修正：home-modules.test.ts 为 query 层真源而非 home-queries.test.ts〔后者测 top10 videos queries〕，偏离登记）。门禁 typecheck/lint EXIT=0 + test:changed 基础包升全量 6605/6605。解阻 01-B / 02。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
3. **CHG-HOME-UX-01-B** — service 层（状态：✅ 已完成）
   - 实际开始：2026-06-05 15:25 ｜ 完成时间：2026-06-05 15:24
   - 建议模型：sonnet
   - 依赖：CHG-HOME-UX-01-A ✅
   - 范围（3 项）：① HomeModulesService CreateBase +title z.record / +imageUrl z.string().url().nullable() ② create/update 透传（.strict() 验证不误拒）③ admin-home-modules/home-modules 测试扩用例。
   - 完成备注：CreateBase +2 字段；create() 显式透传（update() 整体透传零改动）；+4 用例（透传/缺省/非法 URL 422/title 值收紧 422/PATCH 白名单 .strict() 不误拒）56/56 过。门禁 typecheck/lint EXIT=0 + test:changed 32/32。e2e:admin 与 02 合跑登记。6 端点契约零变化。解阻 03。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
4. **CHG-HOME-UX-02** — media ownerType 扩 home_module（状态：✅ 已完成）
   - 实际开始：2026-06-05 15:30 ｜ 完成时间：2026-06-05 15:35
   - 建议模型：sonnet
   - 依赖：CHG-HOME-UX-01-A ✅
   - 范围（4 项）：① media.ts OwnerTypeSchema +home_module + 错误文案 ② ImageStorageService OwnerType 类型 ③ MediaImageService.upload() home_module 分支（findHomeModuleById 404 前置 → 上传 → updateHomeModule 写回 imageUrl → 失败补偿删除，仿 banner 分支）④ 测试三用例（404/写回/补偿）。
   - 完成备注：三处扩点全落（route 枚举+文案 / OwnerType+buildKey home_modules/ 前缀 / uploadForHomeModule 仿 banner 含补偿删除）；+3 用例 media 域 44/44。门禁 typecheck/lint EXIT=0 + test:changed 44/44 + **e2e:admin 39 passed+1 flaky（无关域重试过）= 01-B+02 合跑完成**。解阻 05。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
5. **CHG-HOME-UX-03** — 前端数据层（状态：✅ 已完成）
   - 实际开始：2026-06-05 15:40 ｜ 完成时间：2026-06-05 15:42
   - 建议模型：sonnet
   - 依赖：CHG-HOME-UX-01-B ✅
   - 范围（4 项）：① lib/home-modules types/api 扩字段 + uploadHomeModuleImage（FormData+进度）② 新建 use-video-meta-map.ts（useVideoMetaMap：video refId 并发 fetchPickerItemByIdSafe + useRef 缓存 + 404→null）③ 新建 derive-status.ts（deriveModuleStatus 四色推导，danger>neutral>warn>ok）④ 测试三文件（derive-status 注入 now 全覆盖 / meta-map 并发缓存 / client upload 契约）。
   - 完成备注：四件全落（derive-status 57 行 / use-video-meta-map 86 行含持久缓存+稳定依赖键+cancelled 守卫）。偏离 ×2 登记：上传进度条改 loading 态（postMultipart 复用不扩 api-client）/ hook 测试落 tests/unit/hooks/ + 相对路径 mock（alias 白名单约束）。新测试 14 用例 30/30 + test:changed 41/41 + typecheck/lint EXIT=0。解阻 04-A/04-B/05/07。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
6. **CHG-HOME-UX-04-A** — HomeModuleCard 改造（状态：✅ 已完成）
   - 实际开始：2026-06-05 15:45 ｜ 完成时间：2026-06-05 15:46
   - 建议模型：sonnet
   - 依赖：CHG-HOME-UX-03 ✅
   - 范围（3 项）：① 设计稿 §5.7 重排（序号 + 120×54 本地 img imageUrl→coverUrl→占位 + 标题降级链 title.zh-CN→视频标题→[类型]refId + 本地化时间窗）② Pill variant=deriveModuleStatus ③ HomeOpsClient.test.tsx 卡片断言更新。
   - 完成备注：全形态落地（裸 UUID/裸 ISO 双退役）；props +index/+videoMeta（metaMap 注入归 04-B，undefined 路径本卡已覆盖）。+4 用例 31/31 + test:changed 15/15 + typecheck/lint EXIT=0。解阻 04-B。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
7. **CHG-HOME-UX-04-B** — HomeOpsClient 编排（状态：✅ 已完成）
   - 实际开始：2026-06-05 15:50 ｜ 完成时间：2026-06-05 15:52
   - 建议模型：sonnet
   - 依赖：CHG-HOME-UX-04-A ✅
   - 范围（4 项）：① 手写 tabs → Segment（badge=已加载 slot 计数）② window.confirm → 新建 DeleteModuleModal（仿 users Modal 范式）③ useVideoMetaMap 顶层一次接线下传 Card+PreviewPanel ④ 测试更新 + test:e2e:admin。
   - 完成备注：Segment 接管（手写 tabs 删除）+ DeleteModuleModal（103 行，目标摘要+硬删 danger 明示）+ metaMap 接线（红 pill 路径激活，四色全实装；PreviewPanel 下传归 06）。+5 用例 36/36 + test:changed 20/20 + typecheck/lint EXIT=0；e2e:admin 与 05/06 批跑登记。解阻 06/07。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
8. **CHG-HOME-UX-05** — HomeModuleDrawer 字段补齐（状态：✅ 已完成）
   - 实际开始：2026-06-05 15:55 ｜ 完成时间：2026-06-05 16:00
   - 建议模型：sonnet
   - 依赖：CHG-HOME-UX-03 ✅、CHG-HOME-UX-02 ✅
   - 范围（5 项）：① FormState +titleZh/titleEn/imageUrl + payload 仅非空键 ② startAt/endAt → datetime-local 往返（仿 BannerForm）③ 图片外链 input + 编辑态上传 + 16:9 预览 + 进度（新建态无 id 仅外链）④ video 选中 auto-fill 预填空字段（不覆盖已填 / type 切走清残留）⑤ 新建 HomeModuleDrawer.test.tsx；500 行红线超则抽 ModuleImageField。
   - 完成备注：五项全落；偏离 ×2 登记（**不仿 BannerForm `.slice(0,16)`**——该模式 UTC 显示×本地解析往返漂移 bug，改 isoToLocalInput 对称往返 + 测试守护零漂移；datetime-local 用原生 input 不扩 AdminInputType 共享契约）。ModuleImageField 预防性拆分（Drawer 471<500）。**v1 BannerForm 漂移 bug 发现登记 follow-up CHG-BANNER-TZ-FIX**。+9 用例 45/45 + test:changed 29/29 + typecheck/lint EXIT=0。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
9. **CHG-HOME-UX-06** — HomePreviewPanel 轻拟真（状态：✅ 已完成）
   - 实际开始：2026-06-05 16:02 ｜ 完成时间：2026-06-05 16:08
   - 建议模型：sonnet
   - 依赖：CHG-HOME-UX-04-B ✅
   - 范围（3 项）：① props +videoMetaMap（父传不自取）② banner 16:9 真实横图+标题 / poster 海报+排名+标题（emoji/UUID 退役）③ HomePreviewPanel.test.tsx 更新。
   - 完成备注：optional prop 零破坏（缺省空 Map 降级）；previewTitle 与卡片同降级口径；与 Card 共用 metaMap 零重复请求。+4 用例 20/20 + test:changed 40/40 + typecheck/lint EXIT=0 + e2e:admin 39+1 flaky（04-B/05/06 批跑完成）。**改造主线（UX 缺口 1-7）全收口**；解阻 07。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
10. **CHG-HOME-UX-07** — 页内批量添加（统一确认面板首建）（状态：✅ 已完成）
    - 实际开始：2026-06-05 16:12 ｜ 完成时间：2026-06-05 16:18
    - 建议模型：sonnet
    - 依赖：CHG-HOME-UX-04-B ✅
    - 范围（4 项）：① 新建 BatchAddVideosModal（slot 选择 + 候选列表充实 + 已在列去重标灰 + 循环 create ordering 追加 + 汇总 toast）② slot 头部「+ 添加视频」（video 类 3 slot）③ VideoPicker multiple 接线 ④ 测试（去重/循环/部分失败）。
    - 完成备注：统一确认面板首建（initialItems 预填口供 08/09 复用；确认前零写库）；VideoPicker multiple 原生多选零契约改动；handleBatchAdd ordering=max+1 末尾追加 + 汇总 toast。+8 用例 57/57 + test:changed 28/28 + typecheck/lint EXIT=0。解阻 08/09。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
11. **CHG-HOME-UX-08** — 他页深链入口（仿 merge 模式）（状态：✅ 已完成）
    - 实际开始：2026-06-05 16:22 ｜ 完成时间：2026-06-05 16:28
    - 建议模型：sonnet
    - 依赖：CHG-HOME-UX-07 ✅
    - 范围（4 项）：① 新建 lib/home-modules/entry.ts（SOURCES/SOURCE_META/buildHomeAddHref/parseHomeEntry；?add_ids=&from=）② VideoRowActions「加入首页运营」+ VideoBatchActions「加入首页运营(N)」+ VideoListClient window.open ③ /admin/home 落地解析 → BatchAddVideosModal 预填 + 来源回链栏 ④ 测试（entry 纯函数参数顺序契约 / row+batch router spy / 落地解析）。
    - 完成备注：四项全落（+use-home-add-entry hook 抽离防 500 红线，HomeOpsClient 469；深链 Modal 独立实例 + consumed 防重弹 + 无效引用过滤提示）。+12 用例 102/102 + test:changed 106/106（首轮 1 jsdom 并发 flaky 复跑全绿）+ typecheck/lint EXIT=0。解阻 09。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
12. **CHG-HOME-UX-09** — 趋势导入 + top10 补位可视化（状态：✅ 已完成）
    - 实际开始：2026-06-05 16:32 ｜ 完成时间：2026-06-05 16:36
    - 建议模型：sonnet
    - 依赖：CHG-HOME-UX-07 ✅
    - 范围（3 项）：①「从趋势导入」（featured/top10 → /videos/trending 候选排除已在列）② top10 tab 取公开 /home/top10 求差 → PreviewPanel 尾部灰显「自动补位」行 ③ 测试。
    - 完成备注：三项全落（求差简化为 Top10Item.isPinned 自带标记；已在列排除由确认面板自动标灰；batchAddInitial 单实例合并页内/趋势入口）。**HomeOpsClient 499 行压线，下次改动必须先拆（FUP 登记）**。+7 用例 83/83 + test:changed 77/77 + typecheck/lint EXIT=0 + e2e:admin 39+1 flaky（07/08/09 批跑）。**入口体系三卡全收口**。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet）；子代理: 无。
13. **CHG-HOME-UX-FUP** — follow-up 登记 + 序列收口（状态：✅ 已完成）
    - 实际开始：2026-06-05 16:40 ｜ 完成时间：2026-06-05 16:56
    - 建议模型：haiku
    - 依赖：08/09/05/06 全完成 ✅
    - 范围（3 项）：① 后续卡登记（见下）② P-home.md 手册更新（本卡明确标注"更新文档"：worker 文档偏差修正 + 新交互）③ 全量单测兜底 + 序列状态收口。
    - 完成备注：后续卡 +CHG-HOME-OPS-SPLIT（499 行拆分预警）；P-home.md §0/§4.2-4.4/§5/§7 修订（worker→读时过滤偏差修正 + 入口体系/四色 pill/字段表/FAQ）。全量兜底两轮交叉全过（第二轮 1 crawler flaky 隔离 33/33）；verify:adr-contracts 4 项绿。**SEQ-20260605-01 全 13 卡收口**。执行模型: claude-opus-4-8（人工 opus 覆盖 haiku）；子代理: 无。
14. **CHG-HOME-UX-07-FIX** — 批量添加未加载 slot 重复创建 + ordering 冲突修复（状态：✅ 已完成）
    - 创建时间：2026-06-05 17:00（**Codex stop-time review 触发**，序列收口后插入）
    - 实际开始：2026-06-05 17:00 ｜ 完成时间：2026-06-05 17:05
    - 建议模型：sonnet
    - 根因：getExistingIds/baseOrdering 真源 = 懒加载 modulesBySlot，目标 slot 未访问 → 去重空集重复创建 + ordering 从 0 撞号；07 卡「确认前 loadSlot 兜底」注释承诺未实现。
    - 修复（3 项）：① handleBatchAdd 确认时服务端真源兜底（listHomeModules 最新列表 → 重过滤去重〔跳过进 toast〕+ ordering 按服务端 max+1 + 取列表失败零 create + 缓存整体回写）② 面板打开预加载未加载 video slots（标灰即时正确）③ 批量添加域抽 use-batch-add.ts（HomeOpsClient 499→441，兑现 CHG-HOME-OPS-SPLIT）。
    - 完成备注：+6 hook 用例（核心 = 未加载 slot 兜底去重 + max+1 回归守护）；home 域 70/70 既有零破坏 + test:changed 38/38 + typecheck/lint EXIT=0；深链/页内/趋势三入口同走兜底。执行模型: claude-opus-4-8；子代理: 无。
15. **CHG-HOME-UX-07-FIX2** — Modal 预过滤决策权移除 + 深链面板预加载（状态：✅ 已完成）
    - 创建时间：2026-06-05 17:10（**Codex stop-time review 第 2 轮触发**）
    - 实际开始：2026-06-05 17:10 ｜ 完成时间：2026-06-05 17:12
    - 建议模型：sonnet
    - 根因：① Modal 提交本地预过滤后的 pendingItems——预过滤仍是提交集决策层，缓存陈旧时旁路服务端守卫 ② 深链面板（addEntry 驱动 open）不触发预加载，标灰失真。
    - 修复（3 项）：① Modal 提交全量 selected（标灰/计数降级展示层估计；过滤唯一真源 = handleBatchAdd 服务端守卫）② useBatchAdd +externallyOpen 并入预加载触发 ③ 测试更新（全量提交核心断言 + 深链预加载用例）。
    - 完成备注：去重职责单层决策定型（Modal 展示估计 / 服务端守卫唯一过滤层，三入口统一）。home 域 71/71 + test:changed 39/39 + typecheck/lint EXIT=0。执行模型: claude-opus-4-8；子代理: 无。
16. **CHG-HOME-UX-07-FIX3** — 本地估计为 0 时阻断服务端校验确认（状态：✅ 已完成）
    - 创建时间：2026-06-05 17:16（**Codex stop-time review 第 3 轮触发**）
    - 实际开始：2026-06-05 17:16 ｜ 完成时间：2026-06-05 17:17
    - 建议模型：sonnet
    - 根因：确认按钮 disabled + handleConfirm 短路仍用 pendingItems（本地估计）——缓存陈旧认为全在列时阻断提交，服务端守卫无机会裁决。
    - 修复（2 项）：① disabled/短路改 selected.length === 0（唯一禁用条件）+ 按钮计数 selected.length（全量提交语义）+ 摘要「预计添加 X（确认后以服务端为准）」② 测试更新（全灰仍可提交核心断言 + 唯一禁用条件 + 文案同步）。
    - 完成备注：本地缓存对确认流程零决策权定型（标灰/计数纯展示；提交集与可提交性归服务端守卫/真实选择）。72/72 + test:changed 33/33 + typecheck/lint EXIT=0。执行模型: claude-opus-4-8；子代理: 无。

### 后续卡登记（本序列产出，不在本序列内执行）

- **CHG-HOME-FE-BANNER** ❌ **已废止（ADR-181 / D-181-1.4，2026-06-05）**：~~前台 HeroBanner 切换/合并消费 home_modules banner slot~~——ADR-181 裁定方向相反（home_banners 维持 Hero 唯一真源，home_modules.slot='banner' 冻结退役）；其登记的断裂问题由「冻结 + 入口统一」收口（CHG-HOME-BANNER-UNIFY 执行）。
- **CHG-HOME-FE-FEATURED**（待立案；**收编裁定 CHG-HOME-FE-CONSUME-B 2026-06-06**）：featured 半断裂闭环——FeaturedRow 已请求 modules 但丢弃恒显 trending（FeaturedRow.tsx:149-152 TODO）。~~需 /home/featured-videos 批量端点~~ → **裁定走 ADR-184 amendment 扩 `/home/shelf` section 枚举 `'featured'` 值**（D-184-2「扩值走 amendment 纯增量」+ D-184-7.3 显式留口；featured 渲染 VideoCard 网格与 shelf 合成语义同构，复用合成单一实现，独立端点方向作废）。amendment + FeaturedRow 改造为协议变更，维持独立卡不并入消费切换卡。
- **CHG-HOME-FE-SHORTCUTS**（待立案；**收编裁定 CHG-HOME-FE-CONSUME-B 2026-06-06**）：type_shortcuts 断裂——前台 CategoryShortcuts 静态 ALL_CATEGORIES 不读 home_modules。**不可走 `/home/shelf`**（区块内容 = `video_type` 引用非 video 卡，D-184-3.2 投影协议丢非 video 卡为结构性裁定）；**无需新端点**——既有公开 `GET /home/modules?slot=type_shortcuts` 原始配置行即可服务（CategoryShortcutsClient 映射 video_type → 分类链接 + 排序），消费切换归本卡执行（即 D-182-6.2 `frontendWired: false` 断裂标记的解除条件）。
- **CHG-HOME-THUMB-MD**（待立案，可选）：Thumb 扩 banner-md 120×54 收编（出现第二复用方时；共享契约 Opus）。
- **CHG-HOME-BLURHASH**（待立案，可选）：home_module 图片 blurhash 入队（同 banner 现状 TODO）。
- **CHG-HOME-COUNTS**（待立案，可选）：GET /admin/home-modules/counts 轻量端点（Segment badge 全 slot 计数；新 route 需 ADR）。
- **CHG-HOME-IMAGE-GUARD**（待立案，可选）：external_url/custom_html image 必填软校验（首版宽松，运营反馈后评估）。
- **CHG-HOME-BANNER-URL-MAX**（待立案，可选）：v1 banner 路由 imageUrl 缺 `.max(2048)` 与 ADR-104 AMENDMENT 对齐（arch-reviewer Y-2）。
- **CHG-BANNER-TZ-FIX**（待立案，v1 维护期 bug）：BannerForm 时间窗往返漂移——`activeFrom.slice(0,16)` UTC 切片显示 + datetime-local 本地解析提交，非 UTC+0 时区「编辑不动保存」偏移（apps/server/src/components/admin/banners/BannerForm.tsx:72,91；CHG-HOME-UX-05 实施中发现，修复参照 isoToLocalInput 对称往返模式）。
- **CHG-HOME-OPS-SPLIT** ✅ 已兑现（CHG-HOME-UX-07-FIX 2026-06-05）：批量添加域抽 use-batch-add.ts，HomeOpsClient 499→441 行，红线压力解除。

---

## [SEQ-20260605-02] docs 季度性清理归档 + 关键文档信息收口（用户指令插队）

- **状态**：✅ 已完成（1/1 卡收口 2026-06-05 17:55；changelog 15189→约 1900 行 / task-queue 3378→约 1060 行 / tasks.md 重置 / 4 文档归档 + 全库引用改址 0 断链 / README·tracks 信息收口）
- **创建时间**：2026-06-05 17:30
- **最后更新时间**：2026-06-05 17:55
- **目标**：清理 docs/ 淤积——changelog.md（1.7MB）/ task-queue.md（533KB）分段归档已完成段、tasks.md 工作台清空重置、已完成方案文档归档、引用路径全库更新、关键文档信息（README 索引 / tracks.md / ADR 范围）收口到最新。
- **范围**：仅 `docs/**`（纯文档，零代码改动）。本序列明确标注"更新文档"。
- **依赖**：SEQ-20260605-01 已收口 ✅；无 BLOCKER。
- **先例**：SEQ-20260521-01（CHG-SN-7-CLEANUP-01）+ MAINT-DOC-CLEANUP-20260531 同范式。

### 任务列表

1. **CHORE-DOCS-CLEANUP-20260605** — docs 归档瘦身 + 引用更新 + 关键信息收口（状态：✅ 已完成）
   - 创建时间：2026-06-05 17:30
   - 实际开始：2026-06-05 17:30 ｜ 完成时间：2026-06-05 17:55
   - 建议模型：sonnet（文档归档事务性工作；实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 完成备注：5 项全交付，明细见 changelog [CHORE-DOCS-CLEANUP-20260605]。偏离登记 1 项：admin-ui column-matrix-menu.tsx 文件头注释真源路径改址（注释级零行为，范围由"仅 docs"扩 1 行）。保留核查：SEQ-20260524-01 容器 / 各序列后续卡登记 / 活跃设计稿 5 份 / adr-d-status.json 既有工作区改动未动。执行模型: claude-opus-4-8；子代理: 无。
   - 范围（5 项）：
     ① changelog.md 分段归档：WAVE3/4 收官段 + CHG-SN-8-* ~ META-23/DTR 段（2026-05-23 ~ 2026-06-01）→ `docs/archive/changelog/`
     ② task-queue.md 分段归档：M-SN-7 跟踪卡 + SEQ-20260521-* ~ SEQ-20260531-01 全 ✅ 序列 → `docs/archive/task-queue/`；SEQ-20260601-01 header 状态漂移收口对齐（15/15 卡 ✅ 实证）
     ③ tasks.md 工作台清空重置（淤积完成记录已逐 ID 核对 changelog 全在档）
     ④ 已完成文档归档 4 件（tasks-bangumi.md / external-metadata-ux-overhaul_20260529.md / datatable-header-redesign-plan.md / known-failing-tests_20260529.md）+ 全库引用路径更新
     ⑤ 关键文档信息更新：docs/README.md（ADR 范围 100..180 / 归档指针 / last_reviewed）+ tracks.md（bangumi track 已集成收口）+ archive 季度索引
   - 验收要点：归档文件均 git add；活跃文档零断链（移动文件引用全部改址）；未完成序列（SEQ-20260524-01 / 各后续卡登记）原样保留。

---

## [SEQ-20260605-03] 首页运营治理方案落盘（用户指令插队）

- **状态**：✅ 已完成（1/1 卡收口 2026-06-05 18:56；治理方案落盘 + README 索引；验证：test:changed docs-only SKIP / typecheck PASS / lint 受既有代码问题阻断 / full unit 1 flaky 隔离复跑通过）
- **创建时间**：2026-06-05 18:47
- **最后更新时间**：2026-06-05 18:56
- **目标**：将“首页运营位 UI/UX 新改造”从口头方案落为可追踪设计/治理文档，指导后续首页运营同构画布、卡片拖拽/删除/添加、自动填充、豆瓣/Bangumi 热榜与 Banner 横图治理实施。
- **范围**：纯文档落盘；新增 `docs/designs/home-operations-governance-plan_20260605.md`，更新 docs 索引、任务队列、当前任务与 changelog。**不改代码 / schema / API**。
- **依赖**：SEQ-20260605-01 首页运营基础改造已完成 ✅；无 BLOCKER。
- **跨层理由**：无跨层实现，本卡仅规划后续契约与拆卡边界。

### 任务列表

1. **CHG-HOME-GOVERNANCE-PLAN** — 首页运营治理方案落盘（状态：✅ 已完成）
   - 创建时间：2026-06-05 18:47
   - 实际开始：2026-06-05 18:47
   - 完成时间：2026-06-05 18:56
   - 建议模型：sonnet（文档方案落盘；实际 claude-opus-4-8，用户当前会话人工覆盖）
   - 范围（5 项）：① 新增首页运营治理方案设计文档 ② 补 docs/README 活跃设计文档索引 ③ 登记/清理 tasks.md 当前任务 ④ 更新 task-queue 序列状态 ⑤ 追加 changelog。
   - 验收要点：方案覆盖前台同构展示、区块可编辑/设置、视频卡片拖拽删除、空卡片添加、自动填充策略、豆瓣电影/剧集、Bangumi 动漫、顶部 Banner 横版大图强约束、实施拆卡与质量门禁。
   - 完成备注：治理方案新增并纳入 docs/README 活跃设计索引；覆盖契约、状态归属、UI/UX 结构、卡片操作、Banner 横图强约束、自动填充、豆瓣/Bangumi 来源策略、Route→Service→queries 边界、发布审计缓存与后续拆卡。验证：`npm run test:changed` docs-only SKIP；`npm run typecheck` PASS；`npm run test -- --run` 全量 6681/6682（`StagingEditPanel` 既见并发 flaky，隔离复跑 12/12 PASS）；`npm run lint` FAIL 于既有 `apps/server-next/src/lib/home-modules/use-batch-add.ts:113` `@next/next/no-assign-module-variable`，超出本卡纯文档范围，未改代码且不 commit。

---

## [SEQ-20260605-04] 首页方案提交前 lint 阻断修复（用户指令：提交并 push 触发）

- **状态**：✅ 已完成（1/1 卡收口 2026-06-05 19:27；提交前 lint 阻断修复；typecheck/lint/test:changed/full unit 全绿）
- **创建时间**：2026-06-05 19:22
- **最后更新时间**：2026-06-05 19:27
- **目标**：修复阻断首页运营治理方案提交的 lint 红灯，使方案文档可按门禁提交并 push。
- **范围**：仅修复 `apps/server-next/src/lib/home-modules/use-batch-add.ts` 中 `@next/next/no-assign-module-variable` 命名问题，并更新任务记录。**不改变业务逻辑**。
- **依赖**：CHG-HOME-GOVERNANCE-PLAN 已完成 ✅；提交前门禁要求 lint 通过。

### 任务列表

1. **CHG-HOME-PRECOMMIT-LINT** — 首页方案提交前 lint 阻断修复（状态：✅ 已完成）
   - 创建时间：2026-06-05 19:22
   - 实际开始：2026-06-05 19:22
   - 完成时间：2026-06-05 19:27
   - 建议模型：sonnet（小范围 lint 修复；实际 claude-opus-4-8，用户当前会话人工覆盖）
   - 范围（4 项）：① `module` 局部变量改名 ② 重新跑 typecheck/lint/test 门禁 ③ 收口 tasks/task-queue/changelog ④ 与首页方案文档一起提交并 push。
   - 验收要点：无行为变化；lint 通过；不暂存既有 `docs/audit/adr-d-status.json`。
   - 完成备注：`use-batch-add.ts` 中 `module` 局部变量改为 `createdModule`，仅解除 `@next/next/no-assign-module-variable`，无行为变化。门禁：`npm run lint` PASS；`npm run typecheck` PASS；`npm run test:changed` 33/33 PASS；`npm run test -- --run` 499 files / 6682 tests PASS。不暂存既有 `docs/audit/adr-d-status.json`。

---

## [SEQ-20260605-05] 首页运营治理实施 — Phase 1 真源与同构预览（治理方案 §13 落地）

- **状态**：✅ 已完成（**全 23 卡收口 2026-06-07 02:50**：Phase 1 全 11 卡 + Phase 2 全 4 卡 + Phase 3 全 6 卡 + 候补 AUTOFILL-UI + 审计立案 5 卡〔19 FE-CONSUME-A：ADR-184 + GET /home/shelf / 20 FE-CONSUME-B：前台消费闭环 D-183-8.3 + 收编裁定 / 21 E2E-SPEC：§14 覆盖收口 admin 域 87/87 / 22 GOV-PLAN-ERRATA：§6/§14 勘误 / 23 PHASE4-ADR：**ADR-185 Accepted**〕。治理方案实施面全闭环，仅余 Phase 4 实施 4 卡（24–27，ADR-185 已细化登记 ⬜ 待开始）+ 待立案池**）
- **创建时间**：2026-06-05 20:05
- **最后更新时间**：2026-06-06 22:05
- **目标**：按 `docs/designs/home-operations-governance-plan_20260605.md` §13 推进实施。本序列承载 Phase 1（真源与同构预览）+ 后续 Phase 细化登记。
- **范围**：ADR 起草（decisions.md）+ /admin/home Banner 统一 + 首页预览聚合端点 + 后台同构画布。
- **依赖**：CHG-HOME-GOVERNANCE-PLAN ✅（含评审修订 2a4d15a7）；无 BLOCKER。
- **执行节奏**：ADR 三卡先行（原 `CHG-HOME-GOV-ADR` 6 必裁项 > 5 → 按方案 §9 粒度建议拆 `-A/-B/-C`；全 Opus 起草 + arch-reviewer Opus PASS，新增 admin 端点走 MUST-8）→ 实施卡按 ADR 裁定执行，不得先行落 migration / 端点。

### 任务列表

1. **CHG-HOME-GOV-ADR-A** — Home Curation ADR ①：真源与 schema 裁定（状态：✅ 已完成）
   - 创建时间：2026-06-05 20:05
   - 实际开始：2026-06-05 20:05 ｜ 完成时间：2026-06-05 21:05
   - 建议模型：opus（ADR 产出 + 跨 3+ 消费方 schema 裁定）
   - 范围（4 项）：① Banner 真源裁定（`home_banners` vs `home_modules.slot='banner'` 去留）+ D-052-9 对账（title/image_url 列处置，方案 §6） ② 时间窗命名分歧处置（**勘误 2026-06-05 20:20**：`home_modules` 已有 `start_at`/`end_at`（migration 050），原"字段结构设计"撤销，改裁"不 rename / 聚合 DTO 统一"；方案 §5.1/§9.1/§13 已同步更正） ③ 热门 shelf 存储裁定（`HomeModuleSlot` 扩枚举 hot_movies/hot_series/hot_anime vs 新表，ADR-052 约束"新增 slot 必须走新 ADR"） ④ ADR-181 草案落 decisions.md + arch-reviewer Opus PASS。
   - 验收口径：真源与 schema 裁定 ADR-181 经 arch-reviewer Opus PASS 落档 decisions.md，三项必裁全闭环。
   - 完成备注：ADR-181 Accepted（arch-reviewer Opus CONDITIONAL PASS → 1 BLOCKER + 2 HIGH + 2 MEDIUM + 2 LOW 全 7 条吸收；事实断言逐条核验全对）。D-181-1 home_banners 维持 Hero 唯一真源 + banner slot 两段式冻结退役（CHG-HOME-FE-BANNER 废止）/ D-181-2 D-052-9 列保留 + 论证③ supersede / D-181-3 时间窗不 rename + 聚合 DTO 统一 / D-181-4 slot 枚举 +3 弃新表（compat 第 3 处同源规则 BLOCKER 警示入文）/ D-181-5 边界声明。过程勘误：方案 §9.1 时间窗误判更正（详见上方范围 ② 勘误注）；新增 CHG-HOME-SLOT-EXTEND 前置小卡（本序列卡 9）。docs-only。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。

2. **CHG-HOME-GOV-ADR-B** — Home Curation ADR ②：admin 端点协议（状态：✅ 已完成）
   - 实际开始：2026-06-05 20:24 ｜ 完成时间：2026-06-05 21:40
   - 建议模型：opus（ADR 产出；MUST-8 新增 admin 端点）
   - 范围（4 项）：① 方案 §9 表 7 个新 admin 端点契约（路径/方法/参数/响应/错误码） ② section settings 结构定义（含 refreshInterval） ③ 审计要求映射（§11 覆盖面） ④ ADR-182 落档 + arch-reviewer Opus PASS（`verify:endpoint-adr` 前置闭环）。
   - 依赖：CHG-HOME-GOV-ADR-A（真源裁定决定端点操作对象）。
   - 完成备注：ADR-182 Accepted（arch-reviewer Opus CONDITIONAL PASS → 1 BLOCKER + 2 HIGH + 3 MEDIUM + 2 LOW 全 8 条吸收）。D-182-1 `/admin/home/*` 聚合门面 7 端点（admin only，资源级端点保留；candidates 路径偏离方案 §9 改 RESTful section param）/ D-182-2 HomeSectionKey 7 值（section ≠ slot）/ D-182-3 home_section_settings 表（migration 095，关键策略字段列化 + seed 7 行 + 品牌维度预留）/ D-182-4 契约细则（preview 跳缓存 + Phase 1 无草稿叠加声明；apply 全有或全无 409；origin 开放字符串；reorder 门面双写路径显式裁定 + 审计载荷硬约束）/ D-182-5 审计扩张（TargetKind +home_section CHECK 15→16；ActionType +4；target_id 锚定 settings 行 id）/ D-182-6 type_shortcuts 评估（slot 保留 + frontendWired:false 标记，履行 D-181-5.2）/ D-182-7 边界。BLOCKER 修复实证：`verify:endpoint-adr` 解析 ADR-182 端点 7/7，全套 verify:adr-contracts EXIT=0。docs-only。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。

3. **CHG-HOME-GOV-ADR-C** — Home Curation ADR ③：自动填充策略（状态：✅ 已完成）
   - 实际开始：2026-06-05 21:45 ｜ 完成时间：2026-06-05 22:15
   - 建议模型：opus（ADR 产出）
   - 范围（5 项）：① 前置统计 `douban_entries.media_type` null 占比与取值分布（方案 §8.1） ② autofill 四模式 + 整页去重 + 解释模型 ③ 候选快照结构 + refreshInterval 调度（复用 workers 体系，§7.3） ④ 豆瓣/Bangumi 排序策略 + ADR-161 复用对账（§8） ⑤ ADR-183 落档 + arch-reviewer Opus PASS。
   - 依赖：CHG-HOME-GOV-ADR-A（热门 shelf 存储裁定决定候选落点）；与 -B 可并行。
   - 完成备注：ADR-183 Accepted（arch-reviewer Opus CONDITIONAL PASS → 2 BLOCKER + 3 HIGH + 4 MEDIUM + 2 LOW 全 11 条吸收）。**关键数据观察**：media_type 实测 100% = 'movie'（导入硬编码）→ D-183-1 分池改裁站内 videos.type + 方案 §8.1 勘误回写；豆瓣排序信号 votes 27.4% / rating 18.5% 非空；bangumi 500 行 rank 98.8%；映射桥每源约 200 → 初期产能依赖 trending 兜底。D-183-2 快照表（candidates+gaps JSONB）/ D-183-3 调度（jobId 幂等 + 429 主动检查协同）/ D-183-4 权重定版 / D-183-6 去重改裁聚合层唯一权威 / D-183-7 豆瓣反向建库首版不建（缺口 top-50 入快照、ContentGap 独立 DTO、ADR-182 follow-up 回写 additive 扩展）。**ADR 三卡全收口 → Phase 1 实施卡解锁**。docs-only。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。

4. **CHG-HOME-TIMEWINDOW-SCHEMA** — ~~`home_modules` 时间窗 migration~~（状态：❌ 已取消 2026-06-05 20:20）
   - 取消原因：ADR-A 调研勘误——`home_modules` 自 migration 050 起已有 `start_at`/`end_at` 全链路（CHECK + 部分索引 + queries/类型/Drawer），无需任何 migration；命名分歧处置并入 ADR-181 裁定项 ②。

5. **CHG-HOME-BANNER-UNIFY-A** — banner slot 冻结（service 拒绝）+ server-next banners API 桥接（状态：✅ 已完成；原卡预估测试 >12 用例 advisory 拆 -A/-B，2026-06-05 23:00）
   - 实际开始：2026-06-05 23:00 ｜ 完成时间：2026-06-05 23:45
   - 建议模型：sonnet（裁定在 ADR-A 完成，本卡只执行；实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围（4 项）：① `HomeModulesService` Create 拒绝 slot='banner'（VALIDATION_ERROR 422 + message 指引 /admin/banners；update/delete/reorder/publish-toggle/list 保留，D-181-1.2(a)） ② Update 路径 slot→banner 变相新建的防护口径（实施级推演，完成备注记录） ③ server-next banners API 桥接层（`lib/banners/`，消费既有 /admin/banners 6 端点，零新端点） ④ 单测（service 拒绝正反 + 桥接契约）。
   - 跨层理由：纯 api-service + 桥接 lib 层，无 UI 组件改动（UI 归 -B）。
   - 依赖：CHG-HOME-GOV-ADR-A ✅。
   - 完成备注：D-181-1.2(a) 落地：CreateSchema banner 冻结 refine（message 指引 /admin/banners）+ update() slot→banner 变相新建防护（实施级推演：ADR 字面只裁 Create，但 Drawer 编辑总携带 slot → service 层比较 before.slot 区分"改为"vs"原值回传"，防误伤存量行编辑）+ PATCH route 补 VALIDATION_ERROR AppError→422 分支。桥接层 `lib/banners/`（types+api，6 端点封装，Banner 真源 @resovo/types re-export；PUT 非 PATCH / orders+sortOrder body 形态显式注释防混用）。测试：+3 防护用例 + 8 桥接契约用例 + 3 既有 banner-slot 用例改 featured 载体；49/49 PASS。门禁：typecheck/lint/verify:adr-contracts 绿 + E2E admin 域 39 passed（1 flaky=admin-source-and-video-flows moderation reject，retry 过，与本卡无关）。中间态声明：banner tab 新建 422（-B 替换 tab 后消除）。执行模型: claude-opus-4-8；子代理: 无。

5b. **CHG-HOME-BANNER-UNIFY-B** — `/admin/home` Banner tab → home_banners 编辑器 UI（状态：✅ 已完成）
   - 实际开始：2026-06-05 23:50 ｜ 完成时间：2026-06-06 00:15
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围（5 项）：① Banner tab 内容替换为 home_banners 列表（卡片形态，消费 -A 桥接层） ② Banner 编辑 Drawer（创建/编辑，title 多语言 + imageUrl + linkType/linkTarget + 时间窗 + isActive + brand） ③ 删除确认 + 启停 + 拖拽排序接线 ④ 存量 home_modules banner slot 行的清理提示条（冻结声明 + 指引） ⑤ 组件测试 ≥9 用例。
   - 跨层理由：纯 UI 层（桥接层已由 -A 交付）。
   - 依赖：CHG-HOME-BANNER-UNIFY-A ✅。
   - 完成备注：新增 BannerOpsSection（列表/拖拽/启停/删除 Modal/创建末尾 sortOrder）+ BannerCard（deriveBannerStatus 对齐 deriveModuleStatus variant 口径，D-181-3 映射）+ BannerDrawer（时区对称往返同 HomeModuleDrawer 实现）；HomeOpsClient banner tab 分支（冻结存量清理区可编辑删除启停不可新建排序 + 顶部新建按钮隐藏 + 右栏 PreviewPanel 隐藏防误导）；顺带修复 SLOT-EXTEND 遗漏（HomeModuleDrawer SLOT_OPTIONS +3，数组非 Record 编译漏检）。测试：新增 11 用例 + HomeOpsClient 3 既有用例适配；home 组件域 77/77。门禁：typecheck/lint 绿 + test:changed 47/47 + verify 4 绿 + E2E admin 域。**D-181-1 冻结裁定全量落地（两子卡收口）**。执行模型: claude-opus-4-8；子代理: 无。

6. **CHG-HOME-PREVIEW-API-A** — home_section_settings 落地 + sections/settings 端点（状态：✅ 已完成；原卡影响面 7 项 > 5 按原子化判据拆 -A/-B，2026-06-06 00:20）
   - 实际开始：2026-06-06 00:20 ｜ 完成时间：2026-06-06 01:00
   - 建议模型：sonnet（契约已由 ADR-182 完全锁定；实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围（5 项）：① migration 095（home_section_settings 表 + seed 7 行 + audit target_kind CHECK 15→16，ADR-182 D-182-3/D-182-5） ② `packages/types/src/home-section.types.ts`（HomeSectionKey/HomeSectionSettings 等）+ audit 枚举 +4/+1 ③ `queries/home-section-settings.ts` + `HomeCurationService` settings 部分 ④ 端点 2 `GET /admin/home/sections` + 端点 3 `PATCH /admin/home/sections/:section/settings`（routes/admin/home.ts 新文件，audit `home_section.settings_update` R-MID-1 断言） ⑤ 单测（端点正反 + audit payload + seed 幂等）。
   - 跨层理由：schema + api-service 跨 2 层——settings 表与其读写端点属同一契约闭环（表落地无消费方即死代码）。
   - 依赖：CHG-HOME-GOV-ADR-B ✅。
   - 完成备注：ADR-182 D-182-2/3/4/5 零自由度落地。migration 095 已应用（seed 7 行 + audit CHECK 16 值 pg 实证）；类型层 +5 接口 +2 常量 + audit 枚举 +4/+1（apply/reorder/refresh 3 项写入位点归 Phase 2/3 卡）；queries 4 函数（countPinnedBySection banner→home_banners UNION）；HomeCurationService settings 域 + audit settings_update（targetId=settings 行 id）；端点 #2（枚举序 + 摘要 + frontendWired）/#3（非法 section 422 先于 404 + .strict() + ≥1 字段）。测试：10 新用例 + audit 守卫登记（R-MID-1 第 33 次）。门禁：typecheck/lint 绿 + **全量 6723/6723** + verify-endpoint-adr 209 对齐 + E2E admin 39 passed。执行模型: claude-opus-4-8；子代理: 无。

6b. **CHG-HOME-PREVIEW-API-B** — `GET /admin/home/preview` 整页预览聚合（状态：✅ 已完成）
   - 实际开始：2026-06-06 01:05 ｜ 完成时间：2026-06-06 01:45
   - 建议模型：sonnet（契约 ADR-182 D-182-4 #1 已锁；实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围（4 项）：① HomePreview/HomePreviewSection/HomePreviewCard DTO 类型层（D-182-4 #1） ② HomeCurationService.buildPreview 整页聚合（7 区块 + pinned/auto/fallback/empty source + 风险态 flags + D-181-3 时间窗 DTO 统一映射 + trending 兜底 + 跨区块整页去重（D-183-6 聚合层唯一权威初版）+ 跳缓存 + at 时间窗模拟） ③ 端点 #1 GET /admin/home/preview ④ 单测。
   - 跨层理由：纯 api-service 层（类型 + Service + route 同一契约闭环）。
   - 依赖：CHG-HOME-PREVIEW-API-A ✅。
   - 完成备注：D-182-4 #1 落地：HomePreview DTO（source 四态 + flags 7 值 + explain origin 开放）；buildPreview 整页聚合（7 区块渲染序 + brand 协议 + banner D-181-3 映射 + video 批量充实 + 风险态 flags + top10 rating/featured trending/hot_* fallback 补位 + 跨区块去重聚合层唯一权威 + empty 占位公式 + at 模拟 + 跳缓存）；banner 冻结存量行显式不进 preview。测试 +8 用例（18/18 文件全绿）。门禁：typecheck/lint 绿 + 全量 6731/6731 + verify-endpoint-adr 210 对齐 + E2E admin 40 passed。**Phase 1 后端面全部交付，CANVAS-A 消费就绪**。执行模型: claude-opus-4-8；子代理: 无。

7. **CHG-HOME-CANVAS-A** — 后台同构画布：画布布局 + 区块渲染（状态：✅ 已完成）
   - 实际开始：2026-06-06 01:50 ｜ 完成时间：2026-06-06 02:30
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围（5 项）：① server-next preview 桥接层（`lib/home-curation/`） ② 画布组件三件（HomeCanvas 容器 + CanvasSection 区块布局变体 + CanvasCard 卡片：source pill + flags 警示 + empty 占位） ③ HomeOpsClient 画布/列表视图切换接线（画布只读渲染先行，编辑操作归 -B 与 Phase 2） ④ 组件测试 ≥9 用例 ⑤ docs 收口。
   - 跨层理由：纯 UI 层（preview 端点已由 PREVIEW-API-B 交付）。
   - 依赖：CHG-HOME-PREVIEW-API-B ✅。
   - 备注：Phase 1 画布直写正式配置，"保存草稿 / 发布"按钮隐藏至 Phase 4（方案 §13 阶段衔接）。
   - 完成备注：桥接层 `lib/home-curation/`（3 端点封装）+ 画布三组件（HomeCanvas 容器/CanvasSection 五种区块布局变体/CanvasCard wide·poster 双形态 + source pill 携 origin + flags 7 值警示 + empty 虚线占位）+ HomeOpsClient 画布/列表双视图切换（列表编辑能力零损失）。只读渲染先行（Inspector 归 -B，卡片操作归 Phase 2）。测试 11 新用例，home 组件域 88/88。门禁：typecheck/lint 绿 + test:changed 37/37 + E2E admin 40 passed。执行模型: claude-opus-4-8；子代理: 无。

8. **CHG-HOME-CANVAS-B** — 后台同构画布：Inspector + 环境栏（状态：✅ 已完成）
   - 实际开始：2026-06-06 02:35 ｜ 完成时间：2026-06-06 03:10
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围（5 项）：① 环境栏（brand / locale / preview time(at) / device 四参数 → preview 重拉，方案 §3） ② 区块 Inspector（选中区块 settings 编辑：autofillMode/refreshInterval/displayCount/allowDuplicates/pinnedLimit，消费端点 #3） ③ HomeCanvas 接线（环境参数下传 + 选中联动 + settings 保存后重拉） ④ 组件测试 ≥9 ⑤ docs 收口。
   - 跨层理由：纯 UI 层（端点 #3 已由 PREVIEW-API-A 交付）。
   - 依赖：CHG-HOME-CANVAS-A ✅。
   - 完成备注：CanvasEnvBar（四参数 + 应用重拉，at 本地值转 ISO）+ SectionInspector（5 设置项编辑，空值 null 语义 + displayCount 本地校验，消费端点 #3；候选池展示留 Phase 3 接入位）+ HomeCanvas 两栏接线（1fr+320px sticky + 保存成功重拉）。测试 +7 用例（文件 18/18）。门禁：typecheck/lint 绿 + test:changed 44/44 + E2E admin 40 passed。**Phase 1 全部 11 卡交付收口**。执行模型: claude-opus-4-8；子代理: 无。

9. **CHG-HOME-SLOT-EXTEND** — slot 枚举 +3（hot_movies/hot_series/hot_anime）schema 与类型全量同步（状态：✅ 已完成；拆卡历程见下）
   - 实际开始：2026-06-05 22:20 ｜ 完成时间：2026-06-05 22:55
   - 建议模型：sonnet（结构已由 ADR-181 D-181-4 完全锁定，零设计自由度；实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围（5 项）：① migration 094（2 CHECK 重建，纯增量零阻断） ② `HomeModulesService` SlotEnum +3 + `compat` 映射 +3（ADR-181 BLOCKER 项） ③ `packages/types` HomeModuleSlot + routes/home.ts HomeModuleSlotEnum +3 ④ server-next UI 常量 +3（SLOTS / SLOT_LABEL ×2 / SLOT_CONTENT_REF_TYPES / VIDEO_SLOTS） ⑤ `docs/architecture.md` §5.10 两处 + 单测同步。
   - **拆卡历程（2026-06-05 22:20→22:30）**：起卡时按原子化判据（跨 schema/api-service/UI 三层）预拆 -A/-B；实施中实证 `Record<HomeModuleSlot, string>` 完整性约束使 packages/types 扩枚举**立即破坏 server-next 编译**——类型层与 UI 常量为同一编译闭环，-A 单独无法过 typecheck（测试不过不得 commit）→ 按 workflow-rules「强行单卡」条款合并回单卡：commit 含 `Subagents: arch-reviewer` trailer（ADR-181 评审已背书"影响面 #3/#4/#5 归并一张前置小卡"），changelog 标注范围超限接受完成度风险。
   - 跨层理由：枚举加性扩展在 schema / 协议 / 类型 / UI 常量四处为同一契约字面量同步，编译强制不可拆。
   - 依赖：CHG-HOME-GOV-ADR-A ✅；Phase 3 写路径前必须完成。
   - 完成备注：ADR-181 D-181-4 零自由度落地。migration 094 已应用 dev DB（DROP+ADD 2 CHECK，pg_constraint 实证 7 值 + hot_* 仅 video）；ADR-181 BLOCKER 项 compat 第 3 处同源规则同卡 +3 并加同步警示注释；server-next 4 文件 UI 常量 +3（/admin/home 即见 3 个新 tab + 批量选片可用）；architecture.md §5.10 两处同步。测试：新增 admin 创建正反 6 用例（it.each 3 hot×video 201 + 3 非 video 422）+ 公开路由全 slot 7 值用例扩展 + HomeOpsClient 测试宽松正则 /热门/ 收紧为精确 'TOP 10'（新 tab 命中漂移修复）。门禁：typecheck/lint EXIT=0；**全量 6688/6688 PASS**（基础包改动升全量，ADR-180）；verify:adr-contracts 4 绿；**E2E admin 域 39 passed**；migrate:check 干净。偏离说明：建议模型 sonnet、实际 opus（用户 opus 会话人工覆盖）；强行单卡（编译闭环不可拆），commit 含 arch-reviewer trailer。执行模型: claude-opus-4-8；子代理: 无新 spawn（设计背书引用 ADR-181 卡内 arch-reviewer (claude-opus-4-8)）。

### Phase 2 卡登记（Phase 1 收口后细化，2026-06-06 03:10；**Phase 2 全部 4 卡收口 2026-06-06 01:40**：CARD-DND-A/-B + EMPTY-SLOTS + IMAGE-GUARD-BANNER）

10. **CHG-HOME-CARD-DND-A** — 端点 #6 reorder 门面实装（后端）（状态：✅ 已完成）
   - 实际开始：2026-06-06 00:25 ｜ 完成时间：2026-06-06 00:50
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 拆卡（2026-06-06）：原卡范围 6 项 > 5 且跨 api-service/UI 两层 → 按原子化判据拆 -A（后端门面）/-B（画布 DnD UI），同 Phase 1 BANNER-UNIFY / CANVAS 拆分惯例。
   - 范围（5 项）：① `ReorderSectionSchema` ② `HomeCurationService.reorderSection` 按 section 分派真源（banner → `updateBannerSortOrders` / 其余 → `reorderHomeModules` 直调 queries 不经资源级 Service；归属校验 422 / settings 缺行 404） ③ audit `home_section.reorder`（D-182-4.6 载荷硬约束 + D-182-5.3 targetId=settings.id + 守卫登记） ④ 端点 #6 route ⑤ 单测 ≥10。
   - 跨层理由：纯 api-service 层（route + Service + queries 微调同一契约闭环）。
   - 依赖：CHG-HOME-CANVAS-B ✅。
   - 完成备注：D-182-4 #6 / D-182-4.6 / D-182-5.3 零自由度落地。reorderSection 双真源分派（banner→home_banners 经 ordering→sortOrder 映射；其余→home_modules slot=section 归属校验；id 不属真源 422 AppError + 不写库不写 audit）；audit `home_section.reorder` 载荷硬约束（before/afterJsonb 均携 sectionKey+source，after 加 ids 数组；before 取 DB 原值 R-MID-1；**单条记录不嵌套 home_module.reorder**——回溯须联合两 actionType 为 D-182-4.6 有意裁定）+ 守卫登记（R-MID-1 第 34 次）。`updateBannerSortOrders` void→number 加性变更（updated 计数诚实化，对齐 reorderHomeModules 口径）。**偏离声明**：BannerService.reorder +2 行（return→await）为 query 返回类型变更强制编译闭环，范围外连带修正。banner 排序经门面首次获得审计覆盖（v1 legacy 无 audit）。测试：+10 用例（文件 28/28，audit 守卫 125/125）。门禁：typecheck/lint 绿 + test:changed 197/197 + verify:adr-contracts 4 绿（endpoint-adr 211 对齐）+ E2E admin 39 passed（1 flaky=admin-source-and-video-flows moderation reject 已知项 retry 过）。执行模型: claude-opus-4-8；子代理: 无。

10b. **CHG-HOME-CARD-DND-B** — 画布同区块拖拽 + 跨区块确认弹层（UI）（状态：✅ 已完成）
   - 实际开始：2026-06-06 00:55 ｜ 完成时间：2026-06-06 01:10
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围：① 桥接层 `lib/home-curation/api.ts` +reorderHomeSection ② 画布内同区块拖拽（复用 dnd-kit，pinned 卡可拖、auto/fallback/empty 不可拖）③ 跨区块落位确认弹层（方案 §5.3：视频卡跨视频型区块需确认；banner 区块不受普通 poster 卡落位；banner 卡不可拖出）④ 组件测试 ≥8。
   - 跨层理由：纯 UI 层（端点 #6 由 -A 交付）。
   - 依赖：CHG-HOME-CARD-DND-A ✅。
   - 完成备注：方案 §5.3 三条拖拽边界全落地（banner 不可拖出 D-181-1 真源分离 / 非视频卡不可跨 / banner+type_shortcuts 不接受落位，warn toast 提示）。同区块：SortableContext per section（featured rect 策略、其余水平）+ MaybeSortable 包装（仅 pinned+refId 注册）+ 区块容器 useDroppable（`section:` 前缀落点协议）→ 端点 #6 全序载荷 + silent 重拉（loading 不闪）。跨区块：CrossSectionConfirmModal（语义改变提示）→ 确认后 PATCH slot（资源级 audit home_module.update）+ 端点 #6 重排目标区块（落点位置插入/容器落点末尾）；失败关弹层防 stale 序重试。SECTION_TITLE 第 3 消费方触发提取 `canvas/section-meta.ts`（+VIDEO_SECTIONS）, SectionInspector 收编（卡范围实施前修订补记）。测试 +11（文件 29/29，home 组件域 106/106）。门禁：typecheck/lint 绿 + test:changed 55/55 + E2E admin 39 passed（1 known flaky retry 过）。**CHG-HOME-CARD-DND 两子卡收口**。执行模型: claude-opus-4-8；子代理: 无。
   - **FIX（Codex stop-time review，2026-06-06 01:50）**：跨区块两步写部分持久化误导修复——第二步 reorder 失败时 slot 迁移已落库，原实现统一报「移动失败」（danger）误导运营。改为 slotMoved 哨兵差异化：第一步失败（零持久化）→ danger「移动失败」；第二步失败（部分持久化）→ warn「已移至 X，但落位排序未应用」+ 可再拖调整指引（不做 slot 补偿回滚——违背已确认意图且回滚自身可能再失败）。测试 +1（第二步失败差异化断言 + 不报「移动失败」反断言）+ 既有失败用例加强 toast 断言（useToast 捕获 mock）；HomeCanvas 34/34，home 域 120/120。

11. **CHG-HOME-EMPTY-SLOTS** — 画布空卡片添加入口（状态：✅ 已完成）
   - 实际开始：2026-06-06 01:12 ｜ 完成时间：2026-06-06 01:25
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围：empty 占位卡点击 → VideoPicker（复用 BatchAddVideosModal + useBatchAdd 选片链路）/ banner 空位 → Banner 编辑器（BannerDrawer 创建实例，方案 §5.2）+ HomeCanvas onEmptySlot/reloadToken 接线 + 测试 ≥6。
   - 依赖：CHG-HOME-CANVAS-B ✅。
   - 完成备注：方案 §5.2 落地——empty 卡按区块文案（banner=「添加横版 Banner」/ 视频型=「添加视频」VIDEO_SECTIONS 驱动 / type_shortcuts 维持纯展示，添加链路未立案）+ role=button 键盘可激活 + stopPropagation 防误触区块选中。接线：视频空位 → setActiveSlot+batchAdd.openBlank（**复用 useBatchAdd 全链路**：服务端真源去重/ordering max+1/汇总 toast 零重复实现）；banner 空位 → HomeOpsClient 画布层 BannerDrawer 创建实例（sortOrder 服务端真源 max+1——与 BannerOpsSection banners.length 策略差异：画布无列表缓存；第 2 消费方未达提取阈值不抽）；HomeCanvas +onEmptySlot/reloadToken（外部添加完成 → silent 重拉防骨架闪）。测试 +6（HomeCanvas 33/33 + HomeOpsClient 28/28，home 域 112/112）。门禁：typecheck/lint 绿 + test:changed 61/61 + E2E admin 40 passed 全绿。执行模型: claude-opus-4-8；子代理: 无。

12. **CHG-HOME-IMAGE-GUARD-BANNER** — Banner 横图警告级校验（状态：✅ 已完成；**Phase 2 三卡全部收口 2026-06-06 01:40**）
   - 实际开始：2026-06-06 01:27 ｜ 完成时间：2026-06-06 01:40
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围：尺寸（推荐 1920×1080 / 最低 1280×720）+ 比例（16:9–21:9）+ 外链探测失败提醒——**全部警告级不阻断**（方案 §6 / D-052-9 口径）+ desktop/mobile 安全区预览 + 测试 ≥8。
   - 依赖：CHG-HOME-BANNER-UNIFY-B ✅。
   - 备注：与 D-052-9 预留 `CHG-HOME-IMAGE-GUARD`（管 home_modules.image_url）职责区分，两卡勿混。
   - 完成备注：方案 §6 警告级口径全落地。`lib/banners/image-guard.ts`（evaluateBannerImage 纯函数：below_min 不叠报 below_recommended / 比例 16:9–21:9 含端点 / 0 值返回空；probeImageSize 浏览器 Image naturalWidth）+ `BannerImageGuard.tsx`（防抖探测 debounceMs 可注入 / 警告条 warn Pill + 「不阻断」声明 / 探测失败「确认后仍可发布」§6.6 / desktop 21:9 + mobile 4:5 双视口 object-fit cover 安全区预览 §6.4 / 'ok' 态存 url 防 prop 清空瞬时帧空 src）+ BannerDrawer 接入（imageUrl 下方，handleSubmit 零拦截）。home_banners.image_url NOT NULL → 「缺图」态本真源不可达（焦点=尺寸/比例/探测三类）。测试 +15（纯函数 8 + 组件 6 + Drawer 集成「警告在场提交直达 onSave」1）。门禁：typecheck/lint 绿 + test:changed 55/55 + home 域 119/119 + **Phase 收口全量 6793/6793**（505 文件，4 个测试外 unhandled errors 噪音 exit 0）+ E2E admin 39 passed（1 known flaky retry 过）。执行模型: claude-opus-4-8；子代理: 无。

### Phase 3 卡登记（细化 2026-06-06；契约全锁 ADR-183，执行序 13→18 依赖串行）

13. **CHG-HOME-AUTOFILL-CORE-A** — 候选生成纯函数层 + 解释模型（状态：✅ 已完成）
   - 实际开始：2026-06-06 12:05 ｜ 完成时间：2026-06-06 12:25
   - 建议模型：sonnet（契约 ADR-183 D-183-4/5/6 + ADR-182 D-182-4.4 已锁；实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 范围（5 项）：① `packages/types` AutofillCandidate + AutofillVideoSummary + ContentGap DTO（解释模型载体；ADR-182 影响面 #2 补全 + D-183-7.3 独立 DTO） ② `services/home-autofill/` policy（POLICY_VERSION 'hp-v1' + D-183-4 权重/惩罚常量）+ score 排序纯函数（normVotes 对数压缩 / doubanScore 加权缺失按 0 / recency 衰减 / bangumi comparator rank ASC + rating DESC 后置） ③ filters 通用过滤链纯函数（D-183-4.5 确定性过滤 → filtered/filterReason 开放字符串解释） ④ dedup 去重纯函数（D-183-6.2 单一实现）+ buildPreview 收编消费（行为零变更） ⑤ 单测（影响面 #8 义务：缺失信号按 0 / norm_votes 边界 / rank 缺失排后 / 过滤链 / 去重豁免）。
   - 跨层理由：纯 api-service 层 + types（DTO 为解释模型载体，同一契约闭环；PREVIEW-API-B 同先例）。
   - 依赖：ADR-183 ✅ / CHG-HOME-SLOT-EXTEND ✅。
   - 完成备注：`services/home-autofill/` 5 文件（policy/score/filters/dedup/index，范式对齐 services/identity/），全模块纯函数无 IO——信号取数归候选源 queries（卡 15/16）、编排与快照写入归 worker（卡 17）。实施级裁量（D-183-4.1 只锁权重与信号集）：惩罚 0.1/0.1、半衰期 30 天、饱和阈值 3 源，均为策略常量随 POLICY_VERSION 演进。FILTER_REASONS 无 occupied_by_*（D-183-6.1 快照不做跨区块去重，单测显式守护）。buildPreview 去重收编零行为变更（既有 28 用例零回归）。测试 +33。门禁：typecheck/lint 绿 + **全量 6827/6827**（types 基础包改动升全量，ADR-180）+ E2E admin 38 passed（2 known flaky retry 过）⚠️〔2026-06-06 勘误：passed 计数真实，但「通过」结论不成立——同套件另有约 49 个失败未入结论，疑管道尾命令退出码伪影，详见 SEQ-20260606-01 BLOCKER〕。执行模型: claude-opus-4-8；子代理: 无。

14. **CHG-HOME-AUTOFILL-CORE-B** — migration 096 快照表 + 端点 #4（状态：✅ 已完成）
   - 实际开始：2026-06-06 12:30 ｜ 完成时间：2026-06-06 12:50
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 完成备注：D-183-2 零自由度落地。migration 096 已应用 dev DB（section/trigger CHECK + (section, generated_at DESC) 索引 pg 实证）；queries 写入+清理保留 10 同事务（失败 ROLLBACK 断言）；端点 #4（未生成 200 空 + snapshotAt/policyVersion null / include_filtered 附 filterReason+gaps additive / 布尔显式枚举防 coerce 陷阱 / 不透出跨区块占用——以 preview #1 为权威）；#2 摘要 lastSnapshotAt/candidateCount 接入（PREVIEW-API-A 留口闭环，候选数=含 filtered 全量口径）。实施级推演：policyVersion 未生成时 null 不回退代码常量伪装。测试 +17（queries 7 + 端点 10）。门禁：typecheck/lint 绿 + 全量 6844（1 flaky=StagingTable 既有项隔离过）+ verify:adr-contracts EXIT=0（212 对齐）+ E2E admin 39 passed。执行模型: claude-opus-4-8；子代理: 无。
   - 范围（5 项）：① migration 096 `home_autofill_snapshots`（D-183-2：section CHECK 7 值与 095 同集 + trigger CHECK + candidates/gaps JSONB + 索引 (section, generated_at DESC)） ② `queries/home-autofill-snapshots.ts`（insertSnapshot + 同事务清理保留 10 / findLatestSnapshot / 各 section 最新摘要） ③ HomeCurationService candidates 域 + 端点 #4（limit ≤100 默认 50 / include_filtered / gaps additive / 快照未生成 200 空数组 snapshotAt null） ④ listSectionSummaries lastSnapshotAt/candidateCount 接入（PREVIEW-API-A 留口） ⑤ architecture.md 新表同步 + 单测（快照写入+清理同事务断言 / #4 正反 / null 语义）。
   - 跨层理由：schema + api-service（表与读端点同一契约闭环，表落地无消费方即死代码；PREVIEW-API-A 同先例）。
   - 依赖：CHG-HOME-AUTOFILL-CORE-A。

15. **CHG-HOME-AUTOFILL-DOUBAN** — 豆瓣热门电影/剧集候选源（状态：✅ 已完成）
   - 实际开始：2026-06-06 12:55 ｜ 完成时间：2026-06-06 13:05
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 完成备注：映射桥三源 UNION（mc.douban_id + ver manual_confirmed+is_primary + cer exact，保守口径）+ 分池 videos.type 参数化（D-183-1）+ 源查询不预过滤可见性（filtered 候选入快照解释）；生成层 doubanScore 接线（recency=updated_at / 源不稳定=source_check_status partial|all_dead / 成人双信号）+ rank 仅未过滤占名次；缺口扫描窗 500 预截 + JS 精确评分 top-50（同公式单一实现）。dev 实测：movies 37 候选全 filtered(not_published，dev 数据态) / 缺口 50 正常 / 122ms；trending 兜底链路（Phase 1）保证不空窗。测试 +13。门禁：typecheck/lint 绿 + test:changed 84/84；E2E N/A（API-only）。执行模型: claude-opus-4-8；子代理: 无。
   - 范围（4 项）：① douban 候选源 query（douban_entries JOIN 映射桥 video_external_refs/catalog_external_refs → 站内 videos；D-183-1 分池走 videos.type movie/series，豆瓣 media_type 不参与判定） ② hot_movies/hot_series 候选生成（doubanScore 接线 + 过滤链 + AutofillCandidate 解释） ③ 缺口 top-50（未映射条目按 D-183-4.1 分数 → ContentGap[]，media_type 降级提示性字段） ④ 单测（分池 / 缺失信号按 0 / 缺口 DTO 无 videoId）。
   - 依赖：CHG-HOME-AUTOFILL-CORE-B。

16. **CHG-HOME-AUTOFILL-BANGUMI** — Bangumi 热门动漫候选源 + 缺口复用 ADR-161（状态：✅ 已完成）
   - 实际开始：2026-06-06 13:10 ｜ 完成时间：2026-06-06 13:15
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 完成备注：映射桥三源 UNION（bangumi_subject_id INT 直连 + ::int cast 数字正则防护）+ **nsfw 硬过滤 SQL 双路径**（候选+缺口；硬 = 不入池 ≠ filtered 解释保留；测试守护增量防线）+ **排序权威 = rank 主序 comparator 非 score 序**（D-183-4.2，score 仅解释展示 rating/10 − 惩罚同豆瓣常量，可与排序逆序）+ 缺口 ContentGap 携原生 rank（建库复用 ADR-161 BangumiSeedService 只读透出）。dev 实测：候选 2（dev 态未发布带解释）/ 缺口 50 rank 主序 / 120ms。测试 +8。门禁：typecheck/lint 绿 + test:changed 79/79；E2E N/A（API-only）。执行模型: claude-opus-4-8；子代理: 无。
   - 范围（4 项）：① bangumi 候选源 query（bangumi_entries rank ASC + nsfw=true 硬过滤 + 映射桥 → anime） ② hot_anime 候选生成（rank 主序 + rating 后置 + 惩罚项） ③ 缺口列表（未映射 → ContentGap；建库动作复用 ADR-161 决策 7 BangumiSeedService，治理层只读透出不新建链路） ④ 单测（nsfw 硬过滤断言守护增量防线 / rank 缺失排后）。
   - 依赖：CHG-HOME-AUTOFILL-CORE-B；与 DOUBAN 可换序。

17. **CHG-HOME-AUTOFILL-REFRESH** — worker 重算调度 + 端点 #7（状态：✅ 已完成）
   - 实际开始：2026-06-06 13:20 ｜ 完成时间：2026-06-06 13:35
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 完成备注：D-183-3 全条款落地：homeAutofillQueue（独立隔离背压）+ 5min 单 tick scheduler（isSectionDue 纯函数：interval null/manual_only 永不到期、无快照立即到期）+ worker 委托 recalculate 编排（douban/bangumi/trending 按 section 分派，type_shortcuts 不写空快照）+ 端点 #7（429 主动 getJob+getState 三态检查 + completed 残留不阻塞 + 入队失败 500 不静默 + audit 轻量载荷 R-MID-1 第 35 次守卫登记）。关键落实：jobId `autofill:${section}` 幂等 + **per-add removeOnComplete/removeOnFail true**（释放前提，failed 残留会永久阻塞重入）。实施级推演：banner suggest_only 候选源=trending（ADR 未裁，与 D-183-4.3 同向）。dev 端到端：6 section written + 保留清理 12 写恰 10 份 + 286ms。**ADR-182 端点 7/7 仅余 #5（APPLY 卡）**。测试 +23。门禁：typecheck/lint 绿 + 全量 6889/6889 零失败 + endpoint-adr 213 对齐 + E2E admin 38 passed ⚠️〔2026-06-06 勘误：同上，「通过」结论不成立，详见 SEQ-20260606-01 BLOCKER〕。执行模型: claude-opus-4-8；子代理: 无。
   - 范围（5 项）：① `lib/queue.ts` +homeAutofillQueue（D-183-3.6：attempts 2 + fixed 30s，独立队列隔离背压） ② `workers/homeAutofillScheduler.ts`（5min tick 扫描 settings refresh_interval_minutes 非空且非 manual_only → 比对最新快照 generated_at + interval → 入队；jobId `autofill:${section}` 幂等） ③ `workers/homeAutofillWorker.ts`（候选生成编排：trending/douban/bangumi 按 section 分派 → 写快照同事务清理；trigger scheduled/manual） ④ 端点 #7（429 主动 getJob+getState 检查不依赖 add 去重副作用 / manual_only 422 / 入队失败 500 不静默 / audit `home_section.refresh_candidates` + 守卫登记） ⑤ architecture.md worker 清单同步 + 单测（429 主动检查 / 幂等键 / 调度判定）。
   - 依赖：CHG-HOME-AUTOFILL-DOUBAN + BANGUMI（worker 分派需候选源就绪）。

18. **CHG-HOME-AUTOFILL-APPLY** — 端点 #5 候选转 pinned + 审计（状态：✅ 已完成；**Phase 3 全部 6 卡收口 2026-06-06 14:50**）
   - 实际开始：2026-06-06 13:40 ｜ 完成时间：2026-06-06 14:50
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话人工覆盖）
   - 完成备注：D-182-4.5 全落地：快照定位（轮换失效 409 携 ids）→ 重校验可见性+可播性（任一失效**整体 409 零写入**，全有或全无）→ 已 pinned 重复 409 → pinnedLimit 超限 422（实施级推演）→ insertPinnedHomeModulesBatch 单事务批量插入（slot MAX(ordering)+1 事务内连续）→ audit apply_autofill 全载荷（R-MID-1 第 36 次守卫登记）。banner 422 指引编辑器（实施级推演：「透出预填」为 UI 行为，端点不写 home_banners/冻结 slot；预填 UI 归 AUTOFILL-UI 候补卡）。端点 #4 +appliedAt 派生（快照不可变——由 slot pinned 行 created_at 派生）。**file-size-budget 拆分**：Service 679→440（schemas/preview/preview-cards 三模块拆出，CHG-VSR-3 同先例）。dev 实测：409 拦截 + banner 约束实证。**ADR-182 端点 7/7 全量落地（endpoint-adr 214 对齐）**。测试 +11。门禁：typecheck/lint 绿 + 全量 6901 兜底（staging 域既有 jsdom 并发 flaky 隔离过，与本卡无关）+ E2E admin 36 passed exit 0 ⚠️〔2026-06-06 勘误：passed 计数真实但「exit 0」为管道尾命令退出码伪影，同套件另有约 49 个失败未入结论，详见 SEQ-20260606-01 BLOCKER〕。执行模型: claude-opus-4-8；子代理: 无。
   - **FIX（Codex stop-time review，2026-06-06 14:55）**：运行时 audit enums 漏同步——ADR-118 enums 端点真源 ACTION_TYPES/TARGET_KINDS 缺 home_section 系 4+1（union 类型 Phase 1 先行而运行时漏同步，筛选器 zod 422 拒收；写路径不受影响属可见性缺口）。补齐 +8/+4（**新增「源码写入 ⊆ 运行时 enums」交叉守卫连带检出同类既有欠账** image_health ×2 + crawler_task ×2 action + 2 targetKind，R-MID-1 第 37 次系统化——set-equal 守卫的结构性盲区 = 双镜像同缺时双双通过）+ zh-CN labels +6。测试守卫 134/134 + test:changed 1218/1218。
   - 范围（4 项）：① ApplyAutofillSchema（candidateIds ≥1）+ HomeCurationService.applyAutofill（读最新快照定位候选 → 逐候选重校验可见性/可播放性 → 任一失效整体 409 STATE_CONFLICT 携失效 ids → 全有或全无事务创建对应 slot home_modules pinned 行） ② banner section 语义（D-182-4.5：suggest_only 候选连同缺图风险态透出至编辑器预填，不直接写 home_banners——响应形态实施级推演入完成备注） ③ audit `home_section.apply_autofill`（afterJsonb 含 module ids + 候选来源 + policyVersion + 守卫登记） ④ 端点 #5 route + 单测（409 全有或全无 / audit payload / pinnedLimit 推演）。
   - 依赖：CHG-HOME-AUTOFILL-CORE-B（快照读取）；与 REFRESH 可换序。

### Phase 3 候补登记（六卡收口后细化）

- `CHG-HOME-AUTOFILL-UI` — 候选池面板（SectionInspector「候选池展示留 Phase 3 接入位」+ 端点 #4 解释展示标灰 / #5 应用 / #7 立即刷新 + banner 候选预填 BannerDrawer〔APPLY 卡完成备注归此卡〕；方案 §7.3.5 + §12 + 验收「自动候选可解释、可跳过、可应用」）。依赖卡 14/17/18 ✅。— 状态：✅ 已完成（2026-06-06 17:05；CandidatePoolPanel 18 用例 + banner 预填链路 + HomeOpsClient 拆分 582→485 budget 净改善 −1；E2E admin 域环境性失败与本卡无关——clean-HEAD A/B 实证，已由 SEQ-20260606-01 收口；执行模型: claude-opus-4-8；详见 changelog。**FIX（Codex stop-time review，17:35）**：切区竞态——load 无 staleness 守卫，快速切换区块时前一区块迟到响应污染当前区块候选池 → +activeSectionRef 三重守卫（过期闭包短路 / 迟到响应丢弃 / apply 成功不清新区块选择态），+2 竞态用例 20/20。**FIX2（第 2 轮，17:50）**：section 等值对 A→B→A 不充分（旧代迟到响应与当前 A 等值仍覆盖新代）→ 双 ref 分职：activeSectionRef 仅顶部闭包短路（先于序号自增防夺位）+ requestSeqRef 写入唯一守卫（effect+load 双处自增），+1 用例 21/21，详见 changelog AUTOFILL-UI-FIX/-FIX2）
- ~~公开首页消费切换（前台 ShelfRow → 聚合，D-183-8.3「Phase 3 末实施卡」）~~ → 已立案为下方 `CHG-HOME-FE-CONSUME-A/-B`（2026-06-06 22:05 完成度审计立案）。

### Phase 3 收尾 + 质量收口卡登记（2026-06-06 22:05 完成度审计立案；审计结论见 changelog 后续条目）

19. **CHG-HOME-FE-CONSUME-A** — 公开消费形态裁定 + 聚合读路径（后端）（状态：✅ 已完成）
   - 创建时间：2026-06-06 22:05 ｜ 实际开始：2026-06-06 22:30 ｜ 完成时间：2026-06-06 23:30
   - 建议模型：opus（公开端点协议设计；若需 ADR-182 amendment / 新 ADR 当卡起草走 Opus PASS）
   - 变更原因：D-183-8.3「Phase 3 末实施卡」——前台三个热门 shelf 仍消费趋势 query（`page.tsx` `type=movie&period=week` 实证），治理方案 §2.1「单一展示真源」前台未闭环，full_auto / pinned 头部 / 候选重算对访客无效。
   - 范围（4 项）：① 消费形态裁定：扩展 `GET /home/modules` 响应（hot_* slot 已在 slot 枚举）vs 新公开聚合端点（pinned + full_auto 快照合成）——公开协议变更需 ADR amendment 则当卡完成 ② HomeCuration 公开读路径（pinned 头部 + 快照 auto 合成 + §7.1 通用过滤复核，Route→Service→queries 分层） ③ 缓存口径落点（§12 短 TTL 保留；主动失效钩子留 Phase 4 CACHE-INVALIDATE，本卡只留接口位） ④ 单测（合成顺序 / 过滤 / 快照缺失降级趋势兜底）。
   - 依赖：Phase 3 全 6 卡 ✅ + AUTOFILL-UI ✅。
   - 完成备注：**ADR-184 当卡起草并 Accepted**（arch-reviewer claude-opus-4-8 CONDITIONAL PASS：1 HIGH + 3 MEDIUM + 2 LOW 全 6 条吸收）。裁定 = 新公开聚合端点 `GET /home/shelf`（不扩 /home/modules——原始配置行契约无法表达 auto/fallback 条目；top10 `{video,rank,isPinned}` 形状家族先例；§7.1 整页去重聚合层承载；第三选项 /home/page 显式排除防卡 20 重开）。合成单一实现复用 buildHomePreview（preview ≡ 公开页结构保证）：投影丢 empty/阻断 flags/非 video（missing_image 警告级放行）+ 读时 listVideoCardsByIds 复核为最终权威（快照 filtered 仅入口筛选；复核丢弃不回填）。HIGH 吸收 = `HomePreviewSection.consumedSnapshotAt?` additive 结构回填 snapshotAt（禁止 shelf 层二次查快照；回写 ADR-182 follow-up）。fetchAutoFill hot_* 快照接线兑现 D-182-4 #1 预留（admin preview 行为面显式化：explain.score 口径 rating→策略分 0–1，CanvasCard 仅消费 origin 实证无失真面）。缓存 60s + 一次 miss 填同 brand 三键（隔离硬约束）+ buildHomeShelfCacheKey 导出 = Phase 4 失效唯一接口位。测试 +14（home-shelf.test.ts 新建 12 + preview 接线 2）。dev 实测：snapshotAt 回填 + 三键 TTL 60 + 422 拦截 + 复核不回填。门禁：typecheck/lint 绿 + test:changed 升全量 6937/6937（types 基础包自动升全量）+ verify:adr-contracts EXIT=0（admin 214 不变）；E2E N/A（API-only，前台零改动）。**卡 20 依赖解除**。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。
20. **CHG-HOME-FE-CONSUME-B** — 前台 3 hot shelf 切换聚合 + 断裂区块收编评估（状态：✅ 已完成）
   - 创建时间：2026-06-06 22:05 ｜ 实际开始：2026-06-06 23:40 ｜ 完成时间：2026-06-07 01:10
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话「按顺序依次推进」承接）
   - 变更原因：同上（-A 的前台落地半张）。
   - 范围（4 项）：① `apps/web-next` 首页三个 ShelfRow 切换聚合消费（快照缺失/空时降级现行趋势 query——§7.1「站内兜底趋势」） ② FE-FEATURED（FeaturedRow 丢弃 modules 恒显 trending）/ FE-SHORTCUTS（CategoryShortcuts 静态）是否同链路顺路收编——**仅评估与裁定**，需独立端点（如 /home/featured-videos）则维持待立案不扩范围 ③ e2e-next homepage spec 同步 ④ 单测。
   - 依赖：CHG-HOME-FE-CONSUME-A。
   - 完成备注：① ShelfRow 增可选 `shelfSection` prop（缺省零行为变更）：提供时走 `/home/shelf` + brand_slug 透传（ADR-052 消费侧），items 空/请求失败降级现行趋势 query + 迟到响应 cancelled 守卫（AUTOFILL-UI-FIX 同款教训）；page.tsx 三 shelf 接 hot_movies/series/anime。② **收编裁定**：FE-FEATURED → 走 ADR-184 amendment 扩 'featured'（独立端点 /home/featured-videos 方向作废，合成单一实现复用）；FE-SHORTCUTS → 不可走 shelf（video_type 非 video 卡 D-184-3.2 结构性丢弃），无需新端点用既有 /home/modules——两裁定已回写待立案条目（SEQ-20260605-01 后续卡登记）。③ homepage spec 同步：+shelf mock（emptyShelf 可选）+2 测试（聚合渲染/空降级金路径）+ **顺手修复两处既有失修**：MOCK_MOVIE/SERIES 类型绑定 VideoCard（缺 subtitleLangs → deriveSpecs 运行时崩，clean HEAD 同样 17 failed 实证非本卡引入）+ 兜底 404 catch-all（-A 后 API 恒起漏真实数据，外链封面阻塞 load）。④ 测试：单测 +5（ShelfRow.test.tsx 消费/brand/双降级/现状回归）；E2E 范围内 4/4 绿（电影/剧集网格 + 聚合渲染 + 空降级，serial 实证）；**homepage 套件全量仍 7 失败 = 既有断言漂移 + 并发 goto 超时（infra），定界证据登记 CHG-E2E-WEB-AUDIT 待立案（SEQ-20260606-01 后续卡）**，非本卡范围。门禁：typecheck/lint/test:changed 绿。执行模型: claude-opus-4-8；子代理: 无。
21. **CHG-HOME-E2E-SPEC** — admin home 域 E2E 金路径补覆盖（状态：✅ 已完成）
   - 创建时间：2026-06-06 22:05 ｜ 实际开始：2026-06-07 01:20 ｜ 完成时间：2026-06-07 01:55
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话「按顺序依次推进」承接）
   - 变更原因：治理方案 §14 质量验收明文要求「后台 /admin/home 有 E2E 覆盖」，现状 `grep -rln "admin/home" tests/e2e/` 零命中（SEQ-20260606-01 BLOCKER 处置期间实证）；E2E admin 域门禁已恢复可信（76/76 EXIT=0），补卡时机成熟。
   - 范围（5 项）：① 画布渲染 + 区块切换/Inspector smoke ② 卡片操作金路径（reorder 端点 spy / 删除 / 固定转换） ③ 候选池金路径（解释展示 / 应用 / 立即刷新——mock ADR-182 端点 #4/#5/#7） ④ Banner 编辑 + 横图警告态 ⑤ 全程复用 `tests/e2e/admin/_shared/shell-mocks.ts` 基座 + mock 类型绑定 `@resovo/types`（test-rules E2E 规程第 4/5 条）。
   - 依赖：无（与 19/20 可并行）。视觉回归（admin-visual baseline）不在本卡，完成备注评估是否另立。
   - 完成备注：**`tests/e2e/admin/home/` 新建 _helpers + home-ops.spec 11 用例全绿；admin 域全量 76→87 EXIT=0 零回归**。① 画布：7 区块渲染 + 生成时间戳 + Inspector 空态/联动/settings 回显 + PATCH #3 spy；② 卡片操作：删除 modal→DELETE spy→列表移除 / 发布切换 POST spy（enabled 翻转）/ **拖拽排序真实鼠标步进**（dnd-kit PointerSensor，handle 按下分步移动，reorder body 断言 [m-b,m-a] 序对换）；③ 候选池：解释展示（filtered 条目同列表不可勾选）+ 应用 #5 spy（candidateIds 断言 + 按钮 disabled→enabled 态）+ 立即刷新 #7 spy + 快照未生成态（snapshotAt null 200 语义）；④ Banner：create drawer + 横图探测失败警告（route abort → Image onerror，§6.6 风险提醒态）+ **警告级不阻断实证**（submit enabled + POST /admin/banners spy）。mock 全程类型绑定（HomeModule/Banner/HomeSectionSettings/AutofillCandidate/HomePreview 工厂）+ writes spy 日志 + route.fallback 下沉基座。实施陷阱 ×2 记档：canvas-section 中心点击落空卡触发 onEmptySlot 不达 select → 改打 head pill（canvas-mode-\*）；AdminInput data-testid 在 wrapper div → fill/toHaveValue 须 `.locator('input')` 下钻。**视觉回归评估：不另立**——画布为动态数据密集界面（时间戳/候选数据/计数实时变化），截图基线脆弱收益低，testid 行为断言已覆盖关键路径。门禁：typecheck/lint 绿 + test:changed 绿（e2e spec 不入 unit 图）+ `npm run test:e2e:admin` 87/87 EXIT=0。执行模型: claude-opus-4-8；子代理: 无。
22. **CHG-HOME-GOV-PLAN-ERRATA** — 治理方案 §6/§14 缺图口径勘误（docs-only）（状态：✅ 已完成）
   - 创建时间：2026-06-06 22:05 ｜ 实际开始：2026-06-07 02:00 ｜ 完成时间：2026-06-07 02:10
   - 建议模型：haiku（实际 claude-opus-4-8，用户 opus 会话「按顺序依次推进」承接；勘误需对账实施语义非纯机械，未降子代理）
   - 变更原因：IMAGE-GUARD-BANNER 实施实证 `home_banners.image_url` NOT NULL → 「缺横版大图」态在 Hero 真源下不可达（schema 吸收），实际落地为尺寸/比例/探测三类警告；§14 验收第 5 条「三处标记」中「发布确认」处依赖 Phase 4 发布流。
   - 范围（2 项）：① §6/§14 勘误（缺图态 → 三类警告口径 + 修订记录追加） ② 「发布确认」第三处标记义务移交注记至 Phase 4 `CHG-HOME-DRAFT-PUBLISH` 验收项。
   - 依赖：无。
   - 完成备注：§6.1 strike + 勘误注记（缺图态结构上不可达，实际口径 = 三类警告；画布卡片 + Inspector 两处已承载）；§6 校验级别小结「缺图」除名；§14 验收第 5 条 strike + 更正（含 CHG-HOME-E2E-SPEC E2E 覆盖引证）；§17 修订记录 +1 行；queue Phase 4 占位行 +DRAFT-PUBLISH 验收项移交注记（卡 23 细化拆卡时写入）。原文全部保留（strike 不删除，与既有勘误范式一致）。门禁：docs-only（test:changed 自动跳过，ADR-180）。执行模型: claude-opus-4-8；子代理: 无。

### Phase 4 细化登记（2026-06-06 22:05；实施卡依赖 ADR 裁定，不得先行落端点）

23. **CHG-HOME-PHASE4-ADR** — 发布治理 ADR：草稿/发布模型 + 审计回滚 + 缓存失效协议（状态：✅ 已完成；**SEQ-20260605-05 全 23 卡收口**）
   - 创建时间：2026-06-06 22:05 ｜ 实际开始：2026-06-07 02:15 ｜ 完成时间：2026-06-07 02:50
   - 建议模型：opus（ADR 起草 + arch-reviewer Opus PASS；新增 admin 端点走 MUST-8）——实际 claude-opus-4-8 匹配
   - 变更原因：方案 §11 三层发布模型（编辑/预览/发布）+ §12 缓存失效全部未落地；Phase 1 画布直写为声明的临时降级（「保存草稿/发布」按钮隐藏待此解锁）。
   - 范围（4 项）：① 草稿存储形态裁定（草稿表 vs 配置版本化 vs diff-patch） ② draft/publish/rollback 端点协议（MUST-8）+ 审计 diff 展示模型（§11 审计锚定衔接） ③ 发布后缓存失效协议（§12，与 FE-CONSUME-A 缓存口径对账） ④ 三张实施占位卡（DRAFT-PUBLISH / AUDIT-ROLLBACK / CACHE-INVALIDATE）细化拆卡。
   - 依赖：CHG-HOME-FE-CONSUME-A（公开消费/缓存形态先定，失效协议才有对象）。
   - 完成备注：**ADR-185 Accepted**（arch-reviewer claude-opus-4-8 CONDITIONAL PASS：1 HIGH + 4 MEDIUM + 2 LOW 全 7 条吸收；MUST-8 Opus PASS）。核心裁定：①「版本快照 + 草稿覆盖层」（D-185-1）——三真源表维持发布态唯一真源，**前台读路径零改动**（ADR-184 链路保护）；`home_publish_versions` 整页 JSONB roll-forward（不设保留上限 + 论证 + 1000 版/1MB 评估 follow-up）+ `home_config_drafts` 全局单草稿行（base_version_no 陈旧锚）；排除平行草稿表/diff-patch。② 7 新端点协议（draft GET/PUT/DELETE + publish + versions 列表/详情 + rollback）——HIGH 吸收 = 端点定性三层清单（资源级 12 端点真·紧急通道 / 门面 #3/#5/#6 停止承接画布写但保留为非画布旁路 / 全部直写触发草稿陈旧双信号检测 + §11.1 为画布工作流保证而非系统级强制的风险显式声明）；候选应用挪草稿、#5 重校验挪 publish 时点。③ audit：home_page targetKind CHECK 16→17 / actionType +2 无 DB CHECK（拆分表述防误加）+ UNSUPPORTED_ACTION_TYPES 显式防御（与 ADR-138 行级回滚语义区分）+ enums 同步守卫。④ 失效协议：publish/rollback 后子前缀级精确 scan 删（home:shelf:\* 经 D-184-5.2 接口位 + home:top10:\*，不复用 clearCache 整删）；失效失败不回滚发布（60s TTL 兜底闭环）。⑤ 拆卡：占位 3 卡细化为 4 卡（24 DRAFT-PUBLISH-A 后端 / 25 -B 前端含 ERRATA 移交验收项 + HIGH-1 核验项 / 26 AUDIT-ROLLBACK / 27 CACHE-INVALIDATE；依赖序 24→25→26∥27）。门禁：verify:adr-contracts EXIT=0（ADR 端点 97→104 表解析正常）；docs-only 零代码。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。
   - **FIX（Codex stop-time review，2026-06-07 03:00）**：changelog 条目误引 D-185-1…5 字面量——verify-adr-d-numbers 以「changelog 出现 D-N 字样 = 已闭环」为权威，docs-only ADR 卡引用未实施裁定编号会**伪闭环**（verifier 实证 ADR-185 仅余 D-185-6 待闭环，错误）。修正：条目改写为不含 D-185-N 字面量的表述 + 显式声明「闭环归实施卡 24–27」；修正后 D-185-1…6 全量回到待闭环态（与 docs-only 事实一致）。规律沉淀：**ADR 起草卡（零实施）的 changelog 条目不得引用本 ADR 的 D-N 字面量**——闭环标记由实施卡完成时记入。

### Phase 4 实施卡（ADR-185 Accepted 后细化，CHG-HOME-PHASE4-ADR 2026-06-07；依赖序 24 → 25 → 26 ∥ 27）——**✅ 全 4 卡收口 2026-06-07 06:45（D-185 全 6 项闭环，剩 ADR-185 follow-up：版本数 > 1000 / 单行 > 1MB 时归档评估）**

24. **CHG-HOME-DRAFT-PUBLISH-A** — 发布治理后端：migration 097/098 + draft CRUD + publish 端点（状态：✅ 已完成）
   - 创建时间：2026-06-07 02:45 ｜ 实际开始：2026-06-07 03:30 ｜ 完成时间：2026-06-07 03:55
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话「批准继续实施 Phase 4」承接）
   - 范围（5 项）：① migration 097 `home_publish_versions`（整页 JSONB 快照 + version_no serial + source publish|rollback；保留策略 = 不设上限 D-185-1.6）+ 098 `home_config_drafts`（全局单草稿行 + base_version_no）+ audit targetKind CHECK 16→17（actionType 无 DB CHECK，D-185-3.5 拆分口径） ② `HomePageConfig`/`HomeConfigDraft`/`HomePublishVersion` 类型 + queries ③ 端点 #1–#4（draft GET/PUT/DELETE + publish；publish 单事务 = 草稿应用三表 + 拍版本 + 删草稿 + audit `home_page.publish`；陈旧双信号 409 / 无草稿 422；发布时整页校验 = D-182-4.5 重校验口径挪点）④ 运行时 audit enums 三处/四处同步 + 「源码写入 ⊆ 运行时 enums」守卫测试 ⑤ 落点 `routes/admin/home-publish.ts` 独立子路由（home.ts 500 行硬限防御，D-185-6.1）+ architecture.md 同步 + 单测。
   - 依赖：ADR-185 ✅。
   - 完成备注：**全 5 项落地，D-185-1 闭环**（1.5 后半「rollback 版本数<2 → 422」移交卡 26 注记）。publish 单事务 = 草稿**乐观锁删除**（id+updated_at 双匹配，竞态 → null → 409）→ 三表全量替换（banners/modules DELETE+INSERT 保留 id/created_at——audit 链 + appliedAt 派生依赖；settings 按 section UPDATE 不删 seed）→ 回读拍版本。zod 整页校验 = settings 7 区块全覆盖 + slot×refType 094 CHECK 镜像（第 4 处同源）+ brand 约束；banner slot 模块放行（恢复路径非新建）。**实施陷阱沉淀：pg 微秒 × JS ms 管道 = 恒等 round-trip 伪 diff**——readHomePageState 全时间戳 ms 截断 + sectionsChanged 剥离 createdAt/updatedAt 元数据（dev 实测捕获修复，恒等重发布 sectionsChanged [] 实证）。dev 实测：冷启动发布 v1（行 id round-trip 20/20+2/2，公开 shelf 无恙 =「前台读路径零改动」实证）/ 恒等重发布 v2 / 门面 #3 直写 → 发布 409 信号② / 丢弃幂等。测试 +21（home-publish.test.ts）+ 守卫三处同步（coverage REQUIRED+PAYLOAD / enums-set-equal 镜像）。门禁：typecheck/lint 绿 + test:changed 升全量 6965/6965 + verify:adr-contracts EXIT=0（admin 路由 214→218）+ E2E admin 87/87 EXIT=0。**卡 25/26/27 依赖解除**。执行模型: claude-opus-4-8；子代理: 无。
25. **CHG-HOME-DRAFT-PUBLISH-B** — 发布治理前端：画布切草稿写 + 发布确认 UI（状态：✅ 已完成）
   - 创建时间：2026-06-07 02:45 ｜ 实际开始：2026-06-07 04:00 ｜ 完成时间：2026-06-07 05:00
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话「批准继续实施 Phase 4」承接）
   - 范围（5 项）：① 画布全部配置变更改写草稿 JSONB（含候选应用→草稿 pinned，D-185-2.1）② 「保存草稿/发布」按钮解锁 + 草稿陈旧提示（双信号）③ preview `draft=true` 叠加消费（ADR-182 #1 预留兑现）④ **发布确认环节横图三类警告标记（ERRATA 移交验收项）** ⑤ 验收核验项：「门面 #3/#5/#6 画布写路径去向」（ADR-185 HIGH-1 吸收——画布停用三端点写路径，端点保留为非画布旁路）+ E2E（复用 tests/e2e/admin/home/ 基座）。
   - 依赖：CHG-HOME-DRAFT-PUBLISH-A ✅。
   - 完成备注：**全 5 项落地，D-185-2 + D-185-6 闭环**。① 画布六类写路径（拖拽/跨区块/settings/候选应用/空位添加/banner 创建）全量经 `useHomeDraft.mutateConfig` 落草稿——纯变异层 `draft-mutations.ts`（新建条目预生成 UUID = 拖拽身份锚 + publish 后正式行 id）；跨区块移动草稿内单次变换**原子完成**（消解原两步 PATCH+reorder 部分持久化态）；批量添加按视图分流（list+深链维持资源级直写）。② UI 形态裁定（D-185-6.1 实施级推演）：**编辑即自动保存草稿**（不设独立保存按钮，显式动作 = 发布/丢弃）；首次编辑惰性建稿（三真源装配整页**含 banner-slot 冻结存量**——全量替换语义防误删）；陈旧提示 = GET draft 顶层 additive `staleness`（双信号编辑器提示，权威判定仍在 publish 409）。③ preview draft=true：配置三键改读覆盖层 + 当前数据聚合；shelf 链路显式 draft:false。④ PublishConfirmModal 横图三类警告（image-guard 同源探测，警告级不阻断——e2e 实证 probe_failed + 确认可用）。⑤ 核验项 = e2e 断言画布操作零触达门面 #3/#5/#6 与资源级 PATCH。dev 实测：草稿 displayCount=12 → draft=true 反映 / 缺省与公开链路维持 10；直写后 staleness 实时翻 stale。测试 +75（变异 10 + staleness/draft 6 + HomeCanvas 重写 39 + Panel 22 改造 + e2e 6 新 2 改）。门禁：typecheck/lint 绿 + test:changed 升全量 6985/6985 + verify:adr-contracts EXIT=0 + E2E admin 93/93（home 域 11→17）。执行模型: claude-opus-4-8；子代理: 无。
   - **FIX（Codex stop-time review，2026-06-07 07:00）**：惰性建稿原单页装配（limit 100）在存量 modules/banners > 100 时静默截断——publish 全量替换语义下**缺行即删行**。修正：`draft-assembly.ts` 分页聚合至 total + 不完整/超上限显式失败（+5 单测含 250 行三页聚合断言）。
   - **FIX2（Codex stop-time review 第 2 轮，2026-06-07 07:30）**：FIX1 的 OFFSET 分页聚合在页间并发增删下仍可**计数吻合而漏行**（客户端分页本质无法保证一致性快照）。根治：基线装配改 **GET draft `include_base=true` 服务端单快照**（`readPublishedHomeConfig` REPEATABLE READ 三表一致读，复用 publish 事务内读取器）；他端并发建稿则采纳其 config 防覆盖；分页装配层删除。规律沉淀（取代 FIX1 版本）：**「整体替换」语义的数据底座必须来自单一一致性快照（服务端事务内全量读）——客户端分页聚合无论怎么校验都只是缩小而非消除竞态窗**。
26. **CHG-HOME-AUDIT-ROLLBACK** — 版本列表/详情/回滚 + diff 展示（状态：✅ 已完成）
   - 创建时间：2026-06-07 02:45 ｜ 实际开始：2026-06-07 05:10 ｜ 完成时间：2026-06-07 06:10
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话「批准继续实施 Phase 4」承接）
   - 范围（4 项）：① 端点 #5–#7（versions 分页列表/详情/rollback——恢复三表 + 拍新版本 roll-forward + audit `home_page.rollback`；**含 D-185-1.5 后半：版本数 < 2 时 rollback 422 无可回滚目标〔卡 24 移交注记〕**；rollback 复用 `publishHomeConfig`（draft 参数省略路径已预留）；写入位点落地时同步 coverage REQUIRED + PAYLOAD_ASSERTION 清单——enums/labels 卡 24 已先行）② `home_page.publish`/`home_page.rollback` 加入 `UNSUPPORTED_ACTION_TYPES` 显式防御 + 守卫测试（D-185-3.4，MEDIUM-2）③ admin UI 版本列表 + diff 展示（消费端计算，D-185-4.2；版本快照时间戳已 ms 截断——卡 24 沉淀，快照间文本 diff 稳定）④ 单测 + E2E。
   - 依赖：CHG-HOME-DRAFT-PUBLISH-A ✅（版本表先行）。
   - 完成备注：**全 4 项落地，D-185-3 + D-185-4 闭环（ADR-185 端点契约 7/7 全量）**。① rollback = 恢复三表 + roll-forward 新版本（note 自动携 `rollback to v{n}` 用户备注追加；现存草稿不删由陈旧信号②自然标记；版本数<2 → 422 兑现移交注记）；复用 publishHomeConfig draft 省略路径零事务代码新增。② 行级防御 = UNSUPPORTED 双 actionType + 行级 rollback 422 e2e 式守卫 + Set 成员守卫（防回归删除）。③ VersionHistoryPanel：「对比上一版」**按列表序取相邻较旧版本**（serial 空洞防御）两份详情经 version-diff 纯函数本地比对；最新版本回滚禁用。**陷阱沉淀：JSON.stringify replacer 数组作用于全嵌套层级丢非顶层键**——diff normalize 平铺 stringify（pg jsonb canonical 键序保证稳定）。dev 实测：#7 回滚 v1 → v3（audit targetVersionNo + 三表 20 modules 完整）+ #5/#6 + 404/422 拦截。测试 +33（diff 6 / Panel 11 / 路由 8 / 行级防御 3 / e2e 5）。门禁：typecheck/lint 绿 + test:changed 406/406 + verify:adr-contracts EXIT=0（admin 路由 218→221）+ E2E admin **98/98**（home 域 17→22）。**卡 27 为 Phase 4 唯一剩余**。执行模型: claude-opus-4-8；子代理: 无。
27. **CHG-HOME-CACHE-INVALIDATE** — 发布后缓存主动失效（状态：✅ 已完成；**Phase 4 全 4 卡收口 → ADR-185 D-185 全 6 项裁定闭环，治理方案全章节实施面闭环**）
   - 创建时间：2026-06-07 02:45 ｜ 实际开始：2026-06-07 06:20 ｜ 完成时间：2026-06-07 06:45
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话「批准继续实施 Phase 4」承接）
   - 范围（3 项）：① 失效钩子：publish/rollback 事务成功后子前缀级精确 scan 删（`home:shelf:*` 经 D-184-5.2 接口位 + `home:top10:*`；**不复用 CacheService.clearCache type 级整删**，D-185-5.3）② 失效失败不回滚发布（warn + 60s TTL 兜底，D-185-5.2）③ 单测（失效键覆盖 / 失败容忍）。
   - 依赖：CHG-HOME-DRAFT-PUBLISH-A ✅（publish 钩子点存在）；与卡 26 可并行。
   - 完成备注：**全 3 项落地，D-185-5 闭环**。`home-cache-invalidation.ts` 新建（scan+UNLINK 两子前缀独立精确删 + fire-and-forget 钩子 warn 容忍）；`HOME_TOP10_CACHE_PREFIX` 自 HomeService 导出补齐 top10 接口位；publish/rollback 双钩子接线（audit 后事务外）。dev 实测：预热 4 键 → rollback → `home:*` 键族清空。测试 +9（失效 6 + 钩子断言 3）。门禁：typecheck/lint 绿 + test:changed 74/74 + **全量单测 7021/7021（Phase 收口兜底节点一次绿）** + verify:adr-contracts EXIT=0；E2E N/A（API-only，admin 域 98/98 在档）。执行模型: claude-opus-4-8；子代理: 无。

   > **DRAFT-PUBLISH-B 验收项移交注记**（CHG-HOME-GOV-PLAN-ERRATA，2026-06-07）：方案 §6.1/§14「发布确认」处 Banner 横图警告标记义务（三类警告：尺寸/比例/探测失败；原「缺横版大图」态经 image_url NOT NULL schema 吸收不可达）——已写入卡 25 范围 ④。

---

## [SEQ-20260606-01] E2E-GATE-AUDIT — E2E admin 域门禁完整性修复（BLOCKER 处置 D 路径）

- **状态**：✅ 已完成（4/4 卡收口 2026-06-06 21:56；E2E admin 域 76/76 EXIT=0，🚨 BLOCKER 已撤除）
- **背景**：E2E admin 域 49/88 稳定失败且干净 HEAD 同样复现（CHG-HOME-AUTOFILL-UI 收口时发现）；四条根因线索 = v1 断言结构性不可满足 / 历史 exit 0 测量伪影 / webServer 缺 api 条目 / reuseExistingServer 陈旧复用 + admin-next 26 超时根因未竟。
- **依赖链**：`-A`（定界 + 基础设施）→ `-B`（v1 退役/降冒烟）与 `-C`（admin-next 根因）可并行；BLOCKER 在 -C 收口前保持活跃。

1. **CHG-E2E-GATE-AUDIT-A** — B 复跑定界 + 基础设施双陷阱修复（状态：✅ 已完成 2026-06-06 18:45）
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话承接）
   - 范围（4 项）：① 干净态复跑定界（清理全部本仓遗留 node 进程 + apps/server·server-next `.next` 缓存 → fresh API + fresh servers 单轮复跑，固化「环境态 vs 代码态」边界结论） ② playwright.config `webServer` 补 apps/api（:4000）条目（消除隐式外部 API 依赖；`PLAYWRIGHT_SERVERS` 语义同步） ③ 陈旧 server 防复用（域选跑前 preflight 提示或文档化清理规程——改 `reuseExistingServer` 行为需评估本地迭代体验代价后定） ④ 历史口径修正：REFRESH/APPLY 卡完成备注附注勘误 + git-rules/test-rules 增补「E2E 退出码不得经管道尾命令采集」。
   - 完成备注：① **定界结论 = 代码态确定性失败**：清 `.next` 缓存 + 全 fresh server + fresh API 复跑仍 49 failed / 38 passed / 1 flaky（与此前 5 轮一致，共 6 轮同集）——排除本机状态，-B/-C 必要性确证。② webServer api 条目落地且实证自起（[WebServer] 日志含 api 启动序列）；**连带定界出 -C 根因 (a)**：真实 API 在场时 admin-next 假 cookie 被 `/v1/auth/refresh` 硬 401 打回 → 重定向 /login（dashboard.spec 隔离对照：无 API 3/3 过 / 有 API 3/3 挂）——admin-next「无后端」假设与 v1「需后端」需求结构性互斥，已写入 -C 卡。③ test-rules.md +「E2E 运行环境规程」3 条（遗留 server 核查 / 退出码采集规范 / 异常先隔离对照）；`reuseExistingServer` 行为保留（本地迭代体验），以规程防陈旧。④ 历史口径勘误 ×3（CORE-A/REFRESH/APPLY 完成备注附注，原文保留）。门禁：typecheck/lint/test:changed 绿（playwright.config.ts 不入 unit import 图，0 选测合法）。执行模型: claude-opus-4-8；子代理: 无。
   - 验收：复跑结论落档（passed/failed 与归因）✅；`PLAYWRIGHT_SERVERS=admin,admin-next` 一键起齐含 API ✅；文档同步 ✅。
2. **CHG-E2E-GATE-AUDIT-B** — v1 E2E 断言与实现对照清点 + 退役/降冒烟（状态：✅ 已完成 2026-06-06 19:40）
   - 建议模型：sonnet（实际 claude-opus-4-8，用户 opus 会话承接）
   - 完成备注：**v1 项目 21 失败 → 6（admin.spec 19/19 EXIT=0）**。三类处置：① **类 1 访问控制 7 项 = 真实安全缺口修复**——`apps/server/middleware.ts` 自 DEC-13 拆分起误置根级（src/app 布局下 Next 仅识别 src/middleware.ts），服务端 /admin 守卫（ADR-010）从未生效、未登录可渲染后台 shell → `git mv` 入 src/ 恢复（维护期 bug 修复，逻辑零变更）+ 断言 `/auth/login`→`/admin/login` 对齐（断言写于 ADMIN-01 apps/web 单体时代）；② 类 2 渲染 8 项 = -A 根因 (a) v1 同型——setCookies 单点加 context.route mock 会话端点（/auth/refresh + /users/me，page.route 优先不扰业务 mock）+ 退役 7 个断言对象已不存在的测试（返回前台 ×2〔e601ea2b 移除〕/ 视频筛选器 / 投稿·字幕页〔已 307 归并〕/ 用户列表 / 采集按钮文案）+ 侧边栏 label 漂移修正（源站与爬虫→采集控制台）；③ 类 3 全链路 6 项 → 登记 **-B2**（publish-flow 需 :3000 web server 套件编成缺口 + 2 项断言漂移 + video-governance 1 项；含既有 known flaky moderation reject）。门禁：typecheck/lint/test:changed 绿（e2e spec + middleware 不入 unit import 图）。**部署影响**：v1 生产部署后未登录 /admin 恢复重定向（ADR-010 设计行为）。执行模型: claude-opus-4-8；子代理: 无。
2b. **CHG-E2E-GATE-AUDIT-B2** — v1 类 3 全链路 6 失败处置（状态：✅ 已完成 2026-06-06 20:20）
   - 完成备注：**v1 admin-chromium 项目全绿 23/23 EXIT=0**。① 套件编成修复：test:e2e:admin/video 域 PLAYWRIGHT_SERVERS 补 web——publish-flow 跨应用金路径访问 :3000 恒 ERR_CONNECTION_REFUSED（实证）；搜索页测试即恢复 ✅ ② 退役 publish-flow 详情/播放 2 项：断言写于 apps/web CSR 时代（page.route 浏览器拦截），CUTOVER 后 web-next SSR 取数 mock 到不了服务端 fetch 结构性失效；覆盖由 e2e-next detail/player spec（web 域真源）承担 ③ 退役 v1 行为漂移 3 项（dropdown douban sync 不再触发 / reject 载荷不携 reason ×2，含原 known flaky）：v1 冻结不追 UI 漂移，同流程由 admin-next moderation 套件真源覆盖。门禁：typecheck/lint 绿 + test:changed 升全量 6922/6923（1 失败 = use-filter-presets jsdom 并发 flaky，隔离 7/7 过，既有家族与本卡无关）。执行模型: claude-opus-4-8；子代理: 无。
3. **CHG-E2E-GATE-AUDIT-C** — admin-next 26 toBeVisible 超时根因修复（状态：✅ 已完成 2026-06-06 21:56）
   - 建议模型：opus
   - 完成备注：**E2E admin 域全量 76/76 EXIT=0**（v1 23 + admin-next 53；admin-next 29 失败→0，验收达成 → BLOCKER 块删除）。三层根因处置：① 根因 (a) dashboard 3 失败 = spec 无 catch-all，shell 3 hooks（useAdminNotifications/useAdminTasks/useAdminNavCounts，admin-shell-client 每页挂载）轮询直通真实 API → 假 cookie 401 → refresh 又 401 → handleUnauthorized 重定向 /login——新建共享基座 `tests/e2e/admin/_shared/shell-mocks.ts`（5 shell 端点契约正确形状 + auth/refresh mock + 兜底 404，CHG-VSR-7 范式：404≠401 不触发重定向）。② 根因 (b) 第一层 = moderation `_helpers` catch-all 兜底 `200 {data:null}` 毒化 shell hooks 契约（`value.data.map`/`value.meta.degraded` TypeError ×3 → React 根崩 "Application error" + Next dev overlay 全屏盖断言）→ 兜底改 `route.fallback()` 下沉基座。**历史定性修正：26 失败隔离单跑同样挂（确定性 mock 毒化，与并发/API/编译态全部无关）**——原「隔离过/全量挂」系仅隔离测过 dashboard 无 API 场景的过度外推。③ 根因 (b) 第二层 = `MockQueueRow` 契约漂移 3 代：缺 ADR-159 `probeAggregate/renderAggregate` 必填字段（ModListRow `probe.state` 渲染崩根）+ ADR-157 规整前旧值域（green/red/broken/fetched/system 均非法）→ `makeQueueRow` 类型绑定 `@resovo/types` VideoQueueRow 编译期锁契约（26→10）。④ 残余 10 = 断言/IA 漂移对照修复 6 类：staging 迁独立页 REDO-04-C ×3（goto /admin/staging + 按钮「发布/退回」+ 列表契约补 rules/summary）/ presets 迁 DB 主源 ADR-144 ×4（_helpers +`/admin/filter-presets` 4 端点 mock，弃 localStorage 种数）/ LinesPanel Y4 自动选首线路（player 初始 ready 非 idle）/ TabSimilar ADR-137 真实化（mock similar 端点 + 断言「未找到类似视频」）/ refetch 按钮改「刷新线路数据」/ 「保存」选择器撞名限定 modal。test-rules「E2E 运行环境规程」+2 条（兜底禁错误形状 200 / mock 类型绑定真源）。门禁：typecheck/lint 绿 + test:changed 0 选测合法（e2e spec 不入 unit 图）+ `npm run test:e2e:admin` 76/76 EXIT=0（规程口径采集）。执行模型: claude-opus-4-8；子代理: 无。
   - 验收：E2E admin 全量绿 ✅ → BLOCKER 块已删除 ✅。

（🚨 BLOCKER 块已按裁定 D 撤除——2026-06-06 21:56，-C 收口 / E2E admin 域 76/76 EXIT=0；原文与证据链见 git 历史 + changelog [CHG-E2E-GATE-AUDIT-A/-B/-B2/-C] 四条目）

### 后续卡登记（2026-06-07 CHG-HOME-FE-CONSUME-B 定界产出）

- **CHG-E2E-WEB-AUDIT**（待立案）：web 域 e2e-next homepage 套件失修——与 SEQ-20260606-01 同病理家族但 web 侧未在该序列范围内。定界证据（2026-06-07 实证，clean HEAD 同样 17 failed 排除卡 20 改动）：① **mock 契约漂移**：MOCK_MOVIE/SERIES 缺 `subtitleLangs` → VideoCard `deriveSpecs` 运行时崩 → Next overlay 盖断言（已由卡 20 顺手修复：类型绑定 VideoCard + 兜底 404 catch-all——`-A` 后 API 恒起致未 mock 端点漏真实数据）；banners mock 形状疑似同漂移（hero CTA 不可见 / dots 2≠实际 / banner-dot-1 strict violation 待清点）。② **断言漂移**：nav-logo 期望 "Resovo" 实际 "RResovo"（logo R 标记）/ footer-disclaimer 不可见 / 语言切换 ×2 超时——serial 复跑 12/19，7 失败全为既有漂移。③ **并发 goto 超时定界未竟**：≥4 workers 时 goto('/en') 30s 超时级联（6 并发复现：0 挂起请求但 load 不触发；server 侧 6 并发 curl 0.5s 实证无辜；单测 1.1s 过）——疑 Chromium 多 context × Next dev 交互，root cause 待查。验收：homepage spec 默认并发全绿 + test:e2e:smoke EXIT=0。

---

## [SEQ-20260607-01] ENRICH-DOUBAN-CONSISTENCY — 富集豆瓣匹配状态与 catalog.douban_id 落地一致性修复

- **状态**：✅ 已完成（3/3 卡收口 2026-06-07 13:00；ADR-186 + safeUpdate fill-if-empty + enrich status 接线 + 存量矫正脚本）
- **创建时间**：2026-06-07 12:20
- **最后更新时间**：2026-06-07 13:00
- **目标**：消除「列表显示豆瓣图标（douban_status=matched/candidate）但视频编辑 douban_id 为空」的数据面脱钩——匹配成功时确保 `catalog.douban_id` 真正落地（空缺填充），落不了则状态如实降级 candidate。
- **范围**：`MediaCatalogService.safeUpdate`（写侧语义）+ `MetadataEnrichService`（status 接线）+ `scripts/`（存量矫正）；**不改**前台读路径、**不改** admin-ui 组件。
- **根因（调查结论）**：UI 两面读不同字段（图标←`videos.douban_status` / 编辑←`media_catalog.douban_id`）；`MetadataEnrichService` 三处 `safeUpdate` 不检查返回值无条件 `return 'matched'`，而 `safeUpdate` 有 4 条静默拒绝写 doubanId 路径（来源优先级整体拦截 / 字段锁 / exact ref 冲突降级 / catalog 重绑脱钩）。
- **决策口径**（用户 2026-06-07 裁定）：① 修复策略 = 补写 ID（fill-if-empty）+ 补不了如实降级 candidate；② 含存量矫正脚本。
- **依赖**：无外部前置；内部串行 ADR → A → B（依赖链 3 层 ≤ 4）。

### 任务列表（按执行顺序，串行）

1. **CHG-ENRICH-DOUBAN-CONSISTENCY-ADR** — ADR 起草：safeUpdate 外部 ID fill-if-empty 语义 + douban_status 落地一致性不变量（状态：✅ 已完成 2026-06-07 12:30）
   - 创建时间：2026-06-07 12:20 ｜ 计划开始：2026-06-07 12:20 ｜ 实际开始：2026-06-07 12:20 ｜ 完成时间：2026-06-07 12:30
   - 建议模型：opus（撰写 ADR + 改共享 service 契约 → 强制 spawn arch-reviewer Opus 独立设计）
   - 完成备注：**ADR-186 Accepted**（docs/decisions.md）。arch-reviewer (claude-opus-4-8 / agentId a39b528d4e282e862) 独立设计 Q1–Q8 → CONDITIONAL PASS，揪出 Q3 metadata_source 降级一票否决项（主循环原调查未点明）；4 必修条件全数纳入 D-186-1~7：fill-if-empty 范围（限 douban_id/bangumi_subject_id 两字段）/ 优先级闸门逐字段放行（内容字段进锁循环前剔除）/ metadata_source 不降级硬约束 / status 据 skippedFields 降级 + meta_quality 同步 / exact 写侧复用 / INV-1·INV-2 不变量（含 redirect 脱钩例外归 B 卡）/ ADR-020 澄清性补充。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。

2. **CHG-ENRICH-DOUBAN-CONSISTENCY-A** — MediaCatalogService.safeUpdate 写侧：外部 ID fill-if-empty + 返回值语义（状态：✅ 已完成 2026-06-07 12:48）
   - 创建时间：2026-06-07 12:20 ｜ 实际开始：2026-06-07 12:30 ｜ 完成时间：2026-06-07 12:48
   - 建议模型：opus（共享 service 核心契约 / commit 强制 `Subagents: arch-reviewer` trailer）
   - 完成备注：**实施 ADR-186 D-186-1/2/3/5**。① 新增 `EXTERNAL_REF_FIELD_KEYS`（CATALOG_EXTERNAL_REF_FIELDS 单一真源派生）② 优先级闸门 L334-340 改造：低优先级源不再整段 return，逐字段判定——外部 ID cache 列（doubanId/bangumiSubjectId）且 `current[key]==null` 且 value 非空 → fillable 放行；内容字段/非空外部 ID/null 清空进锁循环前剔除计入 skippedFields；fillableKeys 空时维持整段 skip（行为逐值不变）③ **metadata_source 不降级硬约束**（D-186-3 一票否决项）：`...(isLowerPriority ? {} : { metadataSource: source })` ④ exact 写侧/字段锁路径零改动复用（D-186-5）。返回契约 `{updated, skippedFields}` 不扩字段（D-186-4 写侧）。测试 +9（mediaCatalogSafeUpdate.test.ts 26 全过，覆盖必修②④⑦ + ①③⑤⑥⑧ + 对照）。门禁：typecheck 绿 / lint 无 error / test:changed 766 全过 / verify:adr-contracts EXIT=0。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 设计裁定，A 卡承接其结论实施)。
   - 依赖：ADR ✅。

3. **CHG-ENRICH-DOUBAN-CONSISTENCY-B** — MetadataEnrichService status 接线 + 存量矫正脚本（状态：✅ 已完成 2026-06-07 13:00）
   - 创建时间：2026-06-07 12:20 ｜ 实际开始：2026-06-07 12:48 ｜ 完成时间：2026-06-07 13:00
   - 建议模型：sonnet（主循环 opus 承接）
   - 完成备注：**实施 ADR-186 D-186-4 调用侧 + INV-1/INV-2 + 存量兜底**。① 新增私有 `finalizeDoubanAutoWrite`（据 skippedFields.includes('doubanId') 判 landed → 'matched' or 'candidate'，同步 recordDoubanSignal + writeExternalRef 用最终 refStatus，三处状态一致：douban_status / meta_quality.douban_match_status / video_external_refs.match_status）；step1-imdb/step1-title/step2 三处重构为**先 safeUpdate 再据落地结果判 status**（candidate 路径——置信度未达 auto——行为不变）② DoubanService.confirmSubject/confirmFields 加 `skippedFields.includes('doubanId')` → 返回 `douban_id_conflict`（exact 冲突时人工 confirm 不虚标 matched；arch-reviewer Q4：`if(!updated)` 不足以捕获，updated 返回原 catalog 非 null）；syncVideo 不写 douban_status 故无图标虚标、改 SyncReason 类型扩散，登记不改 ③ `scripts/fix-douban-status-consistency.ts`（dry-run 优先；圈定 matched + catalog.douban_id NULL，有 douban ref → candidate / 孤儿 → unmatched；事务化双批 UPDATE）④ metadataEnrich.test.ts +2 例（必修⑨降级 + ⑩回归）。仅处理 douban（bangumi 同构 follow-up）。门禁：typecheck 绿 / lint 无 error / test:changed 178 全过 / 脚本单独 tsc 编译通过。执行模型: claude-opus-4-8；子代理: 无。
   - **FIX（Codex stop-time review，2026-06-07）**：矫正脚本会创建 unusable candidate 态（原「有任意 ref → candidate」太粗，审核台 getCandidateData 只查 candidate ref；auto_matched 虚标/rejected ref 被误降级 candidate → 点开无候选可确认，违反 INV-2）。修正：圈定改 `EXISTS(match_status='candidate')` → has_candidate_ref，仅存在 candidate ref 才降级 candidate，否则 unmatched。脚本 tsc 编译通过。
   - 依赖：CHG-ENRICH-DOUBAN-CONSISTENCY-A ✅。

---

## [SEQ-20260607-04] EXT-RES-GOV — 外部资源治理框架 v1（豆瓣首接入 · provider 可扩展）

- **状态**：✅ 已完成 2026-06-07 21:25（卡 1 ADR ✅ / 卡 2 STORE A·B·C ✅ / 卡 3 API A·B ✅ / 卡 4 UI A·B ✅；框架全打通——豆瓣 active 全量接入 + Bangumi/IMDB/TMDb registry 占位）
- **创建时间**：2026-06-07 17:30
- **目标**：搭 provider 无关的「外部资源治理」后台框架——采集观测（worker 抓了什么 / 成功否 / 内容类型 / 离线 vs 在线 / API 用量）+ 热门资源分类展示 + 统一资源搜索 + 富集统计；豆瓣作首个接入 provider 全量打通，Bangumi/IMDB/TMDb 占位待后续。
- **用户定调（2026-06-07）**：① 导航落位采集中心（与采集控制并列，分组不更名）② provider 切换框架 + 4 Tab ③ 采集观测埋点（provider 无关操作日志，非窄口径 API 计数）④ 资源搜索统一（离线 dump + 在线实时）。本期搭框架 + 豆瓣接入；深度治理迭代与 Bangumi 接入框架搭好后另起。
- **范围**：schema（`external_fetch_log` 新表）+ api-service（provider registry / fetch-log queries / ExternalResourcesService / 6 admin 端点 / worker 埋点）+ UI（采集中心 nav + `/admin/external-resources` provider 框架 + 4 Tab）——跨三层，必拆卡。
- **依赖**：SEQ-20260607-03 豆瓣采集能力 ✅（`douban_collection_items` 已落库 1294 行）；无 BLOCKER。

### 任务列表（按执行顺序，串行；卡 2/3 按原子化判据可再拆 -A/-B）

1. **CHG-EXT-RES-ADR** — ADR 起草：IA + provider registry 契约 + `external_fetch_log` 观测模型 + 端点路由清单授权（状态：✅ 已完成 2026-06-07 17:55）
   - 创建时间：2026-06-07 17:30 ｜ 实际开始：2026-06-07 17:30 ｜ 完成时间：2026-06-07 17:55
   - 建议模型：opus（撰写 ADR + provider registry 跨消费方契约 + 跨 provider schema → 强制 spawn arch-reviewer Opus 独立设计）
   - 完成备注：**ADR-188 Accepted**（docs/decisions.md）。arch-reviewer (claude-opus-4-8 / agentId a8c9881fbba9ee504) 独立设计 → CONDITIONAL PASS，3 BLOCKER + 5 HIGH + 4 MEDIUM + 3 LOW **全 15 条吸收**：B1 埋点下沉在线出口（doubanAdapter + lib/douban，非 worker；offline 不入表）/ B2 status 删 empty + method 术语桥接 external.types online + offline 不记 / B3 端点 path 字面 `:provider` + `?live` 5 项契约（默认关/10s/并发1/admin_search埋点/失败降级）/ H1 registry 落 packages/types 单源 / H2 capabilities 数组 / H4 端点 6→5（overview 并 enrichment-stats）/ M4 lib/douban 纳埋点边界 + admin 鉴权 / L3 30天 purge 挂 maintenanceWorker。verify:endpoint-adr 解析 ADR-188 端点 5/5 逐字（含 `:provider`），全套 verify:adr-contracts EXIT=0。docs-only。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。

2. **CHG-EXT-RES-STORE**（拆 -A/-B：改动 ~10 项 + 跨 schema/shared-types/service，原子化判据强制拆）
   - **2-A · CHG-EXT-RES-STORE-A** — 数据模型基座：provider registry 落 `packages/types`（ADR-188 D-188-2）+ migration 100 `external_fetch_log` + architecture.md 同步 + fetch-log queries（insert/query/aggregate/purge）+ 单测（状态：✅ 已完成 2026-06-07 18:25）
     - 建议模型：opus（实施 ADR-188 既定契约 + 跨 provider schema）
     - 依赖：CHG-EXT-RES-ADR ✅
     - 完成备注：实施 ADR-188 **D-188-2/D-188-3**（+ D-188-7 purge query）。① `packages/types/external.types.ts` registry（PROVIDER_KEYS/ACQUISITION_METHODS/PROVIDER_CAPABILITIES const SSOT + ExternalProvider 类型 + EXTERNAL_PROVIDERS 4 provider〔douban active / bangumi·imdb·tmdb planned capabilities 留空待调研〕+ getExternalProvider helper）+ index.ts runtime 导出；② migration 100 external_fetch_log（11 列 + 2 索引，dev 已落库验证结构/索引）；③ architecture.md §5.5 + migration 列表同步；④ queries external-fetch-log.ts（insertFetchLog/queryFetchLog 动态 WHERE 分页 clamp/aggregateFetchLog operation·method 分桶/deleteFetchLogBefore）。门禁：typecheck EXIT=0 / lint 5/5 / 新测 12 例 / **test:changed 升全量 7080/7080 零回归**（packages/types 基础包 ADR-180）。执行模型: claude-opus-4-8；子代理: 无（实施卡 1 既定契约）。
   - **2-B · CHG-EXT-RES-STORE-B** — 采集埋点接入（D-188-4）：recordFetch helper（旁路 await+吞错）+ `doubanAdapter.ts` 3 函数（search/detail/collection）+ `lib/douban.ts` searchDouban 在线出口埋点 + 调用方 source 透传（MetadataEnrichService=enrich_worker / refresh=collections_worker）+ 单测（状态：✅ 已完成 2026-06-07 19:00）
     - 建议模型：opus（埋点接入富集热路径，旁路不改既有行为）
     - 依赖：CHG-EXT-RES-STORE-A ✅
     - 完成备注：实施 ADR-188 **D-188-4**。**关键修正**（实施期发现优于 ADR 字面）：① `lib/douban.searchDouban` 实为**委托** `searchDoubanRich`（adapter），故只在 adapter 3 出口埋点、lib/douban 仅**透传 source 不重复埋**（防双计，ADR 原 M4① 假设 lib/douban 是独立出口有误）；② recorder 改 **lazy 动态 import postgres**——避免 doubanAdapter 全下游测试在 load 期强依赖 DATABASE_URL（postgres import 即抛）；③ classifyFetchError 按 `name` 判 timeout（AbortSignal.timeout 抛 DOMException 非 instanceof Error）。新增 recorder + 3 出口 withDoubanFetchRecord 包裹（method=scrape、source 调用方传、await+吞错、返回/降级语义逐字不变）。单测：externalFetchRecorder(6) + doubanAdapterRecord(6) + 既有 doubanAdapter mock recorder；3 处既有精确参数断言更新（metadataEnrich/doubanSearch×2 因 additive source）。**真实 DB e2e**：recordFetch→落 2 行 + queryFetchLog 过滤命中 + aggregate total 2/ok 1/fail 1/avgMs 106。门禁：typecheck/lint 绿 / test:changed 17 文件 206 全过。执行模型: claude-opus-4-8；子代理: 无。
   - **2-C · CHG-EXT-RES-STORE-C** — fetch_log 30天 purge（D-188-7）：maintenanceWorker job type `purge-external-fetch-log`（调 deleteFetchLogBefore）+ scheduler daily tick + e2e（状态：✅ 已完成 2026-06-07 19:20）
     - 建议模型：opus（接既有维护 worker，旁路）
     - 依赖：CHG-EXT-RES-STORE-A ✅（purge query 已在 STORE-A）
     - 完成备注：实施 ADR-188 **D-188-7** worker 接线。maintenanceWorker 加 job type `purge-external-fetch-log` + case（cutoff=now-retentionDays〔default 30〕→ deleteFetchLogBefore）；maintenanceScheduler 加 daily tick（入共享 maintenanceQueue，DELETE 短任务不阻塞 concurrency=1）+ timer/status/lastRunAt。入既有维护 worker（非独立 queue——purge 是秒级 DELETE，与 60-90s 的 douban refresh 不同，不需隔离）。**真实 DB e2e**：回填 -31d/-29d/now 三行 → deleteFetchLogBefore(30d cutoff) → old31 删、recent29+now 留。门禁：typecheck/lint 绿 / test:changed 2 文件 41 全过。worker/scheduler 接线遵循既有 4 job 同范式（无独立单测，purge 行为由 STORE-A deleteFetchLogBefore 单测 + 本卡 e2e 覆盖）。执行模型: claude-opus-4-8；子代理: 无。

3. **CHG-EXT-RES-API**（拆 -A/-B：5 端点 + service + query ~6 项超原子上限）
   - **3-A · CHG-EXT-RES-API-A** — 观测读端点：`providers` + `:provider/overview` + `:provider/activity`（状态：✅ 已完成 2026-06-07 19:45）
     - 建议模型：opus（新 admin route → ADR-188 §端点契约覆盖 + MUST-8）
     - 依赖：CHG-EXT-RES-STORE ✅
     - 完成备注：实施 ADR-188 §端点契约前 3 端点（D-188-5 部分，完整闭环待 API-B）。`ExternalResourcesService`（Route→Service→queries 聚合：getProviders〔registry + douban dataScale〕/ getOverview〔fetchStats+enrichStats+collectionFreshness+dataScale 并发 4 源〕/ getActivity〔queryFetchLog 过滤分页〕；planned provider → PLANNED_MARKER）+ queries `external-resources-stats.ts`（getDoubanDataScale 双 COUNT / aggregateExternalRefMatch byStatus·byMethod，NULL→(unknown)）+ `listAllCollectionSyncState`（douban-collections）+ routes 3 端点（路径逐字 :provider，鉴权 admin，planned→200+status:planned，无效 provider→404，校验→422）+ server.ts 注册（/v1 prefix）。**真实 DB e2e**：providers douban active items=1294/entries=140502 + 3 planned；overview collectionFreshness 16 合集 + enrich total 212（auto 109/candidate 101/manual 2）；bangumi→planned。门禁：verify:endpoint-adr 224 路由对齐（+3）/ typecheck/lint 绿 / 新测 7 例 / test:changed 4 文件 20 全过。执行模型: claude-opus-4-8；子代理: 无。
   - **3-B · CHG-EXT-RES-API-B** — 资源浏览端点：`:provider/collections` + `:provider/search`（统一搜索 dump + `?live` 在线）（状态：✅ 已完成 2026-06-07 20:10）
     - 建议模型：opus（新 admin route + live 抓取限流/埋点）
     - 依赖：CHG-EXT-RES-API-A ✅
     - 完成备注：实施 ADR-188 **D-188-5（端点契约 5/5 全闭环）+ D-188-6**。collections 端点（listCollectionItemsPaged 可选 collection 过滤分页 + listCollectionsSummary 16 合集分类树）+ search 端点（统一搜索：searchDoubanEntries dump〔LIKE 通配转义防注入 + douban_votes 热度排序〕offline + `?live` 在线 searchDoubanRich source=admin_search，**全局并发 1 限流**〔busy→liveError 降级返回 dump 非 429〕+ doubanId 去重）。dump 搜索 query 归 externalData.ts（D-188-6 layering）。**真实 DB e2e**：collections(movie_hot_gaia) total 330 + summary 16 合集；search(流浪地球) dump 命中 offline 1；bangumi→planned。门禁：verify:endpoint-adr 226 路由对齐（5/5 端点）/ typecheck/lint 绿 / 新测 service+11·browse 4 / test:changed 26 文件 367 全过。执行模型: claude-opus-4-8；子代理: 无。

4. **CHG-EXT-RES-UI**（拆 -A/-B：nav + shell + api client + 4 Tab ~7 项超原子上限；复用 admin-ui 零新共享组件）
   - **4-A · CHG-EXT-RES-UI-A** — 框架 + 观测 Tab：采集中心 nav 加「外部资源」+ `/admin/external-resources` page + ExternalResourcesClient（provider Segment + tab 容器 URL `?provider=&tab=`）+ api client（lib/external-resources/api.ts）+ 概览 Tab（KpiCard：数据规模/采集用量/成功率/离线vs在线/合集新鲜度）+ 采集与富集记录 Tab（fetch_log DataTable + 富集 breakdown）（状态：✅ 已完成 2026-06-07 20:55；UI-A 落地 概览+采集记录 2 Tab，富集 breakdown 归并入概览，planned provider 渲染待接入占位；13 视图单测全绿）
     - 建议模型：opus/sonnet（复用 admin-ui，零新共享组件）
     - 依赖：CHG-EXT-RES-API ✅
   - **4-B · CHG-EXT-RES-UI-B** — 浏览 Tab：热门资源 Tab（CollectionsTab DataTable per category）+ 资源搜索 Tab（SearchTab DataTableSearchInput + 结果 + 在线开关）+ admin 域 e2e（状态：✅ 已完成 2026-06-07 21:25；CollectionsTab 分类 chips + 条目表 / SearchTab dump+在线开关+busy 降级横幅 / TABS 扩 4 / +7 视图单测 +3 e2e smoke 全绿）
     - 建议模型：opus/sonnet
     - 依赖：CHG-EXT-RES-UI-A

### 后续卡登记（本期不做）
- **CHG-DOUBAN-HOT-WIRE**（首页实时热门展示接线）：待用户按接口定展示口径另起；仍独立于本治理框架，ADR-183 首页链不在本序列。
- **CHG-EXT-RES-BANGUMI**（Bangumi provider 接入）：调研已完成（2026-06-07）→ **立项为 SEQ-20260607-05 EXT-RES-BANGUMI**（见下）。

---

## [SEQ-20260607-05] EXT-RES-BANGUMI — Bangumi 全量接入外部资源治理 + 首页每日放送

- **状态**：✅ 已完成 2026-06-08 00:50（卡 1 ADR ✅ / 卡 2 STORE A·B·C ✅ / 卡 3 API 3A·3B ✅ / 卡 4 UI ✅ / 卡 5 HOME 5A·5B ✅；Bangumi active 全量接入治理框架 + 首页每日放送发现位打通）
- **全量收口**：`npm run test -- --run` 7171/7173 passed；2 failed 定界为 **jsdom 重负载非确定性 flaky**（跨 4 次全量运行失败文件各异 CrawlerClient/StagingTable/UserSubmissions/VideoListClient/video-merge-perf，**全部隔离重跑通过 + 零依赖本 SEQ**〔无 bangumi/external/daily import〕→ 非回归）；本 SEQ 所有 bangumi/external/daily 测试零失败。typecheck/lint/verify:adr-contracts/verify:endpoint-adr EXIT=0。
- **创建时间**：2026-06-07 21:40
- **目标**：把 Bangumi 从治理框架的 `planned` 占位升为 **active 全量接入**——概览/热门·每日放送/资源搜索/采集记录 4 Tab 实数据 + 官方入口（API/doc/dump）+ 首页「每日放送」发现板块（含未入站，交叉站内）+ 站内 hot_anime 强化。解决调研定位的核心缺口：埋点只接 douban、热门/每日放送无数据源、capabilities 空、Service douban 硬编码、首页发现位缺失。
- **用户定调（2026-06-07）**：① 热门/每日放送走**落库 worker**（对齐豆瓣 collection_items 范式）② 首页口径 = **每日放送发现位（含未入站）+ 站内 hot_anime 结合** ③ **本期实装**（含首页接线）。
- **范围**：schema（`bangumi_collection_items`+`sync_state` 2 新表）+ api-service（lib/bangumi 扩端点 + 埋点 + collections worker + Service provider 化 + registry capabilities）+ UI（Bangumi 4 Tab + 官方入口卡）+ 首页（新 home section `daily_anime` + `/home/daily-anime` + 前台板块）——跨四层，强制拆卡。
- **依赖**：SEQ-20260607-04 EXT-RES-GOV ✅（治理框架 + fetch_log + provider 参数化聚合已就位）；ADR-161 Bangumi 接入 ✅（lib/bangumi/BangumiService 已实装）；无 BLOCKER。
- **执行真源**：`~/.claude/plans/steady-sparking-taco.md`（已批准 2026-06-07）。

### 任务列表（按执行顺序，串行；卡 2/5 按原子化判据再拆 -A/-B）

1. **CHG-BNG-RES-ADR** — ADR 起草（决策·零实施）：active 化 + 派生合集语义 + `bangumi_collection_items` schema + Service provider-dispatch 契约 + capabilities 取值 + 埋点映射 + 首页每日放送发现机制 + 官方入口位 + 边界（状态：✅ 已完成 2026-06-07 22:10）
   - 创建时间：2026-06-07 21:40 ｜ 实际开始：2026-06-07 21:40 ｜ 完成时间：2026-06-07 22:10
   - 建议模型：opus（撰写 ADR + provider 契约扩展 + 跨 3+ 消费方 schema → 强制 spawn arch-reviewer Opus 独立设计）
   - 依赖：无（SEQ 首卡）
   - 完成备注：**ADR-189 Accepted**（docs/decisions.md）。arch-reviewer (claude-opus-4-8 / agentId a95d2a463b57d2a6d) 独立裁定 → **CONDITIONAL PASS，2 BLOCKER + 4 HIGH + 3 MEDIUM + 2 LOW 全 11 条吸收**：**B1** daily_anime **不进 HomeSectionKey**（28 处枚举消费 + 无 videoId 与 HomePreviewCard/占用集/section seed 结构不兼容）→ 改独立只读发现机制（新 `home-discovery.types.ts` DTO + `GET /home/daily-anime` 不碰 preview/autofill/section）；**B2** dump-refresh **不入 fetch_log**（守 ADR-188 D-188-3「offline 不入表」，dump 可观测走 bangumi_entries MAX(updated_at)/COUNT 聚合）；**H1** dataScale 由硬绑 DoubanDataScale 解耦为 provider 无关 `ProviderDataMetric[]` + 引入 `ProviderResourceAdapter` 接口（douban 逻辑整搬零行为变更）+ doubanId→externalId 泛化；**H2** 分表正确（拒并表，字段差异>50%）；**H3** searchSubjectsSorted/getCalendar 返回 `T[]|null` 失败信号 + sort z.enum 收窄禁 any；**H4** bangumi 专属抓取常量（不复用豆瓣）+ calendar 一拉七写原子 + empty_guard 总量基线；**M1** 埋点接 lib/bangumi HTTP 出口 / **M2** collection 派生语义声明 / **M3** calendar 7 key 原子 / **L1** 官方入口复用 AdminCard / **L2** /home/daily-anime 登记端点契约。门禁：verify:endpoint-adr 226 对齐（无新 admin route）/ verify:adr-contracts EXIT=0（D-189-1..9 待实施卡 changelog 闭环）/ typecheck/lint EXIT=0。docs-only。architecture.md 2 新表登记归 STORE-2A（带 migration 号）。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。

2. **CHG-BNG-RES-STORE**（拆 -A/-B/-C：schema + 埋点 + worker 跨多层）
   - **2-A** schema + registry + queries（状态：✅ 已完成 2026-06-07 22:35）
     - 完成备注：实施 ADR-189 **D-189-2/3**。① migration 101（`bangumi_collection_items` 11 列 + 3 索引 + `CHECK(category='calendar' OR air_weekday IS NULL)` / `bangumi_collection_sync_state`；dev 已落库 DO 块验证通过）② `services/bangumi-collections/registry.ts`（9 合集：trending heat + ranking rank + calendar 7 weekday；bangumi 专属抓取常量 SEARCH_PAGE_DELAY 500/CALENDAR_GUARD_MIN_BASELINE 30 等，**不复用豆瓣** + calendarKeyForWeekday helper）③ `db/queries/bangumi-collections.ts`（replaceBangumiCollectionItems 单合集 + **replaceBangumiCollectionGroupsAtomic calendar 一拉七写**〔单事务多合集，任一失败全 ROLLBACK〕+ recordSyncState + getSyncState/listAll/listPaged/listSummary，对齐 douban-collections 范式）④ architecture.md 2 表 + migration 列表。门禁：typecheck/lint EXIT=0 / migrate 101 ✅ / 新测 12 全绿（含一拉七写原子 + ROLLBACK）/ test:changed EXIT=0。执行模型: claude-opus-4-8；子代理: 无。
   - **2-B** 埋点接入 + lib/bangumi 扩端点（状态：✅ 已完成 2026-06-07 22:50）
     - 完成备注：实施 ADR-189 **D-189-5/6**。① lib/bangumi 全 HTTP 出口接 recordFetch（getSubject/getEpisodes→detail / getCharacters→celebrity / searchSubjects(Strict)→search / getCalendar→schedule / searchSubjectsSorted→collection，均 method=api；bgmGet 改**抛错版** + 各函数 try/catch 记 ok/fail/timeout〔404→ok valid-negative〕+ 保留 null/[]/strict-throw 对外语义，arch M1）② **新增 getCalendar + searchSubjectsSorted**（D-189-5：sort z.enum 收窄 + 结构化 filter 禁 any + **失败返 null 信号** 供 worker empty_guard 区分真空 vs 失败，arch H3）③ BangumiService source 透传（gatherEnrichmentData/matchViaRest 加默认 `enrich_worker` 参 + searchCandidates 显式 `admin_search`，**additive 不改富集行为** D-189-9）。**关键修正**：① **dump-refresh 不接埋点**（守 ADR-188 D-188-3「offline 不入表」/ arch B2，dump 可观测改 bangumi_entries 聚合归卡 3）② collections worker source 复用既有 **`collections_worker`** 枚举（非 ADR 字面 `bangumi_collections_worker`——provider 列已区分，避免 per-provider 枚举膨胀）。门禁：typecheck/lint EXIT=0 / bangumi-lib 20（含埋点断言 + calendar/sorted + 失败信号）+ bangumi-service 72（4 处精确断言补 source）全绿 / test:changed 14 文件 270 全过。执行模型: claude-opus-4-8；子代理: 无。
   - **2-C** collections worker（状态：✅ 已完成 2026-06-07 23:10）
     - 完成备注：实施 ADR-189 **D-189-2** worker 编排。① `services/bangumi-collections/refresh.ts`（trending/ranking 分页 searchSubjectsSorted 累积 rank〔null→整轮 failed〕+ per-collection empty_guard + replaceBangumiCollectionItems / **calendar getCalendar 一次 → 7 weekday 分组 → 7 天总量 empty_guard → replaceBangumiCollectionGroupsAtomic 一拉七写**〔getCalendar null→7 key 统一 failed〕）② `bangumiCollectionsQueue`（lib/queue 独立队列隔离背压，同 douban 范式）③ worker + scheduler（6h tick，jobId `refresh-bangumi-collections` 幂等，`BANGUMI_COLLECTIONS_SCHEDULER_ENABLED` opt-out）④ server.ts 注册（worker + scheduler）。**实现选择**：trending 用 sort=heat 不加 air_date filter（heat 已反映当前热度，ADR D-189-2 air_date 为可选，省略）；source 用 `collections_worker`。门禁：typecheck/lint EXIT=0 / 新测 6 全绿（search 成功·failed·empty_guard / calendar 一拉七写·null→7failed·总量 guard）/ test:changed 60 文件 693 全过。执行模型: claude-opus-4-8；子代理: 无。
   - 依赖：CHG-BNG-RES-ADR

3. **CHG-BNG-RES-API**（拆 -A/-B：DTO 泛化 + adapter 框架 + bangumi adapter ~7 项超原子上限）
   - **3-A · CHG-BNG-RES-API-3A** — provider-dispatch 框架 + douban adapter（状态：✅ 已完成 2026-06-07 23:30）
     - 完成备注：实施 ADR-189 **D-189-4 / arch H1**。① 治理 DTO 泛化 provider 无关（`services/external-resources/types.ts`：`ProviderDataMetric`〔dataScale 数组化〕/ `GovCollectionItem`〔doubanId→externalId + subtitle〕/ `GovSearchHit`〔externalId〕/ `ProviderResourceAdapter` 接口）② `DoubanResourceAdapter`（douban 逻辑整搬 + map 中性 DTO + live 并发 1 限流，**零行为变更**）③ `ExternalResourcesService` 退化为 adapter 分派（去 isActiveDouban，`adapterFor` 按 status=active 选 adapter，planned→PLANNED_MARKER）。route shape 透传无需改。④ service DTO 测试更新（dataScale 数组 / externalId / subtitle）；query 层 Browse/Stats 测试不受影响（保持 doubanId/DoubanDataScale）。门禁：typecheck/lint EXIT=0 / external-resources 17 测全绿 / test:changed EXIT=0。执行模型: claude-opus-4-8；子代理: 无（实施 ADR 锁定契约）。
   - **3-B · CHG-BNG-RES-API-3B** — bangumi adapter（状态：✅ 已完成 2026-06-07 23:55）
     - 完成备注：实施 ADR-189 **D-189-1/4**。① registry bangumi `status='active'` + `capabilities=['detail','search','celebrity','collection','schedule']`（派生语义注释 / arch M2）② `loadBangumiClientConfig` 抽 `services/bangumi-config.ts`（BangumiService.getBangumiConfig 复用去重，行为保持）③ `searchBangumiEntries`（dump 搜索，**bangumi_id INT→String** 对齐 externalId 契约）④ `getBangumiDataScale`（collection items + dump entries + MAX(updated_at) dump 重导时间）⑤ `BangumiResourceAdapter`（overview〔fetch/enrich provider=bangumi + 9 合集 freshness + **dump 重导 freshness 行** D-189-6〕/ collections〔map 中性 externalId/subtitle/airWeekday〕/ search〔dump + searchSubjects live 并发 1 限流 + system_settings 凭证〕/ activity）⑥ 注册 bangumi adapter。**真实 DB e2e**（run-and-delete）：dataScale dump=500 / overview freshness 含 dump 行 / unifiedSearch dump 命中 85 总 externalId 字符串 / dispatch bangumi active 非 planned。门禁：typecheck/lint/verify:adr-contracts EXIT=0 / bangumi-adapter 8 + service 11 + bangumi-service 72 全绿 / externalFetchLog registry 测更新（bangumi active）。**test:changed 全量 EXIT=1 经定界为 jsdom 重负载时序 flaky**（跨 2 次运行失败文件各异：video-merge perf p95 / UserSubmissions / CrawlerClient / StagingTable summary——均隔离重跑 13/13 通过 + 零依赖本卡改动〔无 external/bangumi/provider import〕，**非回归**）；本卡所有 targeted 测试全绿。执行模型: claude-opus-4-8；子代理: 无。
     - 依赖：CHG-BNG-RES-API-3A ✅ + CHG-BNG-RES-STORE ✅

4. **CHG-BNG-RES-UI** — 前端 Bangumi Tab（状态：✅ 已完成 2026-06-08 00:10）
   - 完成备注：实施 ADR-189 **D-189-1/4/8 前端侧**（API DTO 变更强类型耦合，douban+bangumi UI 同卡适配，不可拆）。① api.ts DTO 中性化（`ProviderDataMetric`/`CollectionItem.externalId+subtitle+airWeekday`/`SearchHit.externalId`/summary domain nullable）+ `COLLECTION_LABELS`（bgm_calendar_mon→周一 等友好 chip）+ `PROVIDER_LINKS`（bangumi 官方入口 API/doc/dump）② OverviewTab：dataScale **metric 数组渲染** KPI（testId `ext-kpi-${key}`）+ **官方入口卡**（`ext-overview-official-links`，PROVIDER_LINKS 驱动）③ CollectionsTab：externalId/subtitle/rating + 友好 chip 标签 + 通用「外部 ID」列 ④ SearchTab：externalId + 通用文案 ⑤ ExternalResourcesClient：bangumi 因 active 自动渲染 4 tab（副标题更新）。bangumi active 后 PlannedPlaceholder 仅余 imdb/tmdb。门禁：typecheck/lint EXIT=0 / 视图单测 22（+bangumi active +官方入口卡，planned 改 imdb）/ admin e2e（douban 4-tab + 热门/搜索 + imdb 占位 + **bangumi active 4-tab + 官方入口**）。执行模型: claude-opus-4-8；子代理: 无。
   - 依赖：CHG-BNG-RES-API

5. **CHG-BNG-HOME-WIRE**（可拆 -A/-B）— 首页每日放送 + 站内 hot_anime
   - **5-A** 后端（状态：✅ 已完成 2026-06-08 00:30）
     - 完成备注：实施 ADR-189 **D-189-7 后端侧**。① `db/queries/home-discovery.ts`（DailyAnimeItem/Result DTO〔含 linkedVideo 站内交叉态，apps/api 侧**不进 home-section 框架**〕+ `listDailyAnimeByWeekday`：calendarKeyForWeekday 解析 weekday→合集 key〔越界返 []〕+ calendar 切片 LEFT JOIN media_catalog〔`bangumi_subject_id::TEXT = bangumi_id` 避 TEXT→INT 解析〕+ LATERAL 取站内 published 公开 video）② `HomeService.dailyAnime`（无缓存）③ `GET /home/daily-anime?weekday=N`（公开 route，默认服务端当日 1=周一..7=周日）。**不碰** preview/autofill/section。**真实 DB 验证**：weekday 1/7 查询无错返 0（空表）/ 0 越界返 [] 不查。门禁：typecheck/lint/verify:adr-contracts〔sql-schema-alignment ✅〕EXIT=0 / 新测 4 / test:changed 5 文件 81 / verify-endpoint-adr 226（公开 route 不计 admin）。执行模型: claude-opus-4-8；子代理: 无。
   - **5-B** 前台（状态：✅ 已完成 2026-06-08 00:50）
     - 完成备注：实施 ADR-189 **D-189-7 前台侧**。① `home-discovery.ts` 补 `linkedVideo.shortId`（前台 watch deeplink 需要，同 SEQ 增量 + 5-A 测试同步）② `DailyAnimeRow.tsx`（web-next client 组件：取 `/home/daily-anime` skipAuth + 水平滚动竖卡；**linked → 站内可看徽标 + watch deeplink `/watch/{slug}-{shortId}`** / **未入站 → 想看徽标 + 站内搜索 `/search?q=`**；颜色全 CSS 变量；**空/失败自隐**不占位）③ 首页 page.tsx 接入（hot_anime shelf 之后；hot_anime 既有 autofill 链路核对无需改 D-189-9）④ i18n（zh-CN/en：dailyAnime/Available/Wish）⑤ 单测 4。门禁：typecheck/lint EXIT=0（新文件零告警）/ DailyAnimeRow 4 + homeDailyAnime 4 全绿 / test:changed 6 文件 85 全过。**e2e 决策**：web 无既有 homepage e2e harness（web e2e 仅 auth/publish/search/video-governance），daily-anime 板块空数据自隐 → 组件测试 4（linked/未入站/空自隐/无 slug）+ 后端查询测试 4 + 真实 DB 验证已强覆盖；homepage e2e 待 harness 建立后另起（板块优雅降级不阻塞）。执行模型: claude-opus-4-8；子代理: 无。
   - 依赖：CHG-BNG-RES-STORE（落库）+ ADR section 授权（卡 1）

---

## [SEQ-20260608-01] 旧后台 apps/server 退役执行序列（cutover 收尾）

- **状态**：🔄 进行中（卡 1 ✅ + 卡 2 ✅ + 卡 3 Phase A ✅ 合入 dev `e3aea798` + 卡 6 docs-rules-sync ✅；卡 4 回滚窗 🔄 观察至 ~2026-06-15；卡 5 改名 `apps/server-next→apps/admin` 待排期）
- **创建时间**：2026-06-08 16:30
- **最后更新时间**：2026-06-08 19:05
- **source_of_truth**：`docs/server_next_plan_20260427.md` §6 M-SN-7（CUTOVER 执行门禁版，v2.7）
- **背景**：功能重现核对（`docs/audit/admin-cutover-parity-2026-06-08.md`）确认旧后台 26 条逻辑路由（28 物理 page.tsx）业务功能 100% 重现/收编/拆分，无业务缺口阻塞退役；v1 E2E 已降冒烟（SEQ-20260606-01）。剩余三项收尾工作收口本序列。
- **依赖**：CHG-CUTOVER-PLAN-REFRESH ✅（plan v2.7 + 审计文档落地）。
- **关联**：plan §4.2 / ADR-101（切流回滚）/ ADR-181 + ADR-182（banner 收编）。

1. **CHG-CUTOVER-QA-DEV-MIGRATE** — QA 工具退役前迁移 `/admin/dev/`（状态：✅ 已完成 2026-06-08）
   - 范围：旧 `apps/server/src/app/admin/fallback-preview`（样板图预览）+ `design-tokens`（token 预览）补迁到 server-next `/admin/dev/`（隐藏路由工具区，对照既有 `dev/components` + `dev/visual` 范式）；`sandbox` 已被 `dev/components` 覆盖无需迁移。
   - 不在范围：banner / 业务视图；apps/server 删除。
   - 完成标准：两工具在 server-next `/admin/dev/` 可访问且颜色零硬编码；旧页可在 cutover 时随 apps/server 一并删除。
   - 建议模型：sonnet。
   - **完成备注**：新增 10 文件（`dev/fallback-preview/page.tsx` + `dev/design-tokens/page.tsx` + `_components/{DesignTokensView,TokenTable,TokenEditor,DiffPanel,LivePreviewFrame,InheritanceBadge}.tsx` + `_components/{_paths,_diff}.ts`），零改动既有文件、apps/server 未触碰。`/admin/design-tokens/*` API 在 apps/api 共享后端经 `apiClient` 调用，无需迁后端。**关键现实**：server-next 不启用 Tailwind（全仓内联 `React.CSSProperties`）→ 6 个 `.tsx` 由 Tailwind 类转内联样式；`TokenTable` 重写为原生可选品牌列表（去冻结 `ModernDataTable`，守 CLAUDE.md server-next 边界）；`_paths`/`_diff` 纯函数逐字搬（原无单测，无覆盖丢失）。CSS token 全部经 `@resovo/design-tokens/css` 解析（逐个核验）；两页鉴权由 middleware admin 鉴权（ADR-010）兜底，对标 dev/components（admin-only dev 工具）+ typed `Metadata`（主流约定）。门禁：typecheck 8 workspace ✅ / lint 5/5 零新增告警 ✅ / test:changed EXIT=0。**Codex stop-time review FIX**：初版误照搬 dev/visual 的 `NODE_ENV→notFound` 守卫（dev/visual 因 middleware 豁免才需自守；本路由未豁免、有 middleware 兜底），该守卫对未认证用户无效却误伤生产已登录管理员 → 已移除，鉴权统一靠 middleware，design-tokens 接 isProduction 让生产只读。执行模型 claude-opus-4-8（主循环续用）；子代理：无。

2. **CHG-CUTOVER-BANNER-OPS-VERIFY** — banner 收编运营等价确认（状态：✅ 已完成 2026-06-08）
   - 范围：对照 ADR-181/182，确认 `/admin/home` 是否提供原 banner 的"时间窗（生效区间）+ 显示顺序拖拽"运营等价能力（#PARITY-BANNER-01）。
   - 完成标准：等价能力确认通过；若有缺口登记为 home 增强卡（非 cutover 阻塞项）。
   - 建议模型：sonnet。
   - **完成备注**：**完全等价 ✅，无缺口，不登记增强卡**。时间窗 = `BannerDrawer` activeFrom/activeTo（对齐旧 CreateBannerSchema）；拖拽排序 = `BannerOpsSection` DndContext+`reorderBanners`（PATCH /admin/banners/reorder）；全 CRUD/启停/删除齐备，消费既有 /admin/banners 6 端点零新端点（同后端），ADR-181 D-181-1.3 定为唯一推荐运营入口，且增强（BannerImageGuard/多语言/品牌作用域）。测试佐证 `BannerOpsSection.test.tsx`/`banners-client.test.ts`/e2e `home-ops.spec.ts`。落档：审计文档 §2 #PARITY-BANNER-01 勾选 + §4 banner 确认 ⏳→✅；plan §6 M-SN-7 启动准入 banner 确认 ⏳→✅。docs-only。执行模型 claude-opus-4-8；子代理：无。

3. **CHG-CUTOVER-EXECUTE（Phase A）** — 物理 cutover 功能性退役（🔴 不可逆 · 状态：✅ 已完成 2026-06-08，人工 sign-off + 合入 dev merge `e3aea798`）
   - **启动准入（全部满足）**：parity ✅（审计文档）+ v1 E2E 降冒烟 ✅（SEQ-20260606-01）+ 卡 1 QA 工具迁移 ✅ + 卡 2 banner 运营确认 ✅。
   - **用户决策（AskUserQuestion 2026-06-08）**：分阶段——本卡只做功能性退役；`apps/server-next → apps/admin` 改名（152 文件纯命名）拆为卡 5。
   - 已落地（分支 `cutover/retire-apps-server`，回滚 tag `pre-server-next-cutover` @ 13940b06）：`docker/nginx.conf` /admin :3001→:3003 + 物理删 `apps/server`（256 删除）+ 47 老 admin 测试删除（43 单测 + 4 e2e + 6 modern-table/shared 组件测）+ workspaces/typecheck/e2e scripts/dev.mjs/vitest/playwright/eslintrc/verify 脚本/.env.example/docker-compose/README/CLAUDE.md/architecture.md 同步（16 编辑）。
   - 门禁：typecheck 全 workspace ✅ / lint 4/4 ✅ / verify:adr-contracts EXIT=0 ✅ / vitest 6828 passed（1 CSV 导出 flaky，隔离 3/3 通过，与本退役无关）/ playwright 配置有效（admin-next 79 tests/21 files，无 admin-chromium）。verify:file-size-budget EXIT=1 = 既有 debt（api/server-next 超限，非 apps/server，非本次引入）；verify:admin-guardrails --staged 一次性删除假阳性（脚本 v1 obsolete，不在任何门禁）。
   - 完成标准：**人工 final sign-off（PR 描述签字）→ 合并** → cutover + 24h 平稳 + 运营 0 报障。
   - 建议模型：opus（高风险架构动作）。执行模型 claude-opus-4-8；子代理：无。

5. **CHG-CUTOVER-RENAME-ADMIN** — `apps/server-next → apps/admin` 改名（状态：📋 待 Phase A 合并后 · 独立卡）
   - 范围：目录 `git mv apps/server-next apps/admin` + 包名 `@resovo/server-next → @resovo/admin`（5 处）+ 152 处 `apps/server-next` 路径引用（workspaces/vitest/playwright/scripts/152 测试 import）+ nginx upstream 改名 + 端口可保 :3003。
   - 背景：纯命名零功能收益，AskUserQuestion 裁定后置以降回归风险。
   - 建议模型：opus（大面积路径 churn，需逐项核验）。

6. **CHG-CUTOVER-DOCS-RULES-SYNC** — docs/rules 退役同步 + 产品说明（状态：✅ 已完成 2026-06-08）
   - 范围：`docs/rules/{admin-module-template,test-rules,code-style,workflow-rules,ui-rules}.md` 中 apps/server v1 引用标退役/清理（archive/* 冻结不动）+ docs/README plan 版本 + 根 README 复核。
   - 背景：Phase A 已同步 CLAUDE.md + architecture.md 关键引用；规则文档 staleness 非 build-breaking，独立 docs 卡处理。用户 2026-06-08 指令"收尾旧后端退役，清理旧文档，更新产品说明"授权改 docs/规范文件。
   - **完成备注**：code-style 路径约定 / test-rules 测试树+AUTH / workflow-rules 重写期条款 / docs-README plan v2.6→v2.7 更新现行；admin-module-template 顶部加 v1 退役 banner + @dnd-kit 有序列表规范纠偏（SortableList 已删→server-next 直接用 @dnd-kit，参 BannerOpsSection）；ui-rules 6 处 v1 段（路径/CSS 变量/AdminDropdown/v1 shared 目录/SelectionActionBar）标退役。manual 经核为 server-next 引用无 v1 残留、根 README 已清（cutover 时改）。门禁：test:changed docs-only SKIP exit 0 / verify:docs-format 63 基线持平零新增。执行模型 claude-opus-4-8；子代理：无。

4. **CHG-CUTOVER-ROLLBACK-WINDOW** — cutover +7 天回滚窗收口（状态：🔄 观察中 · 启动 2026-06-08 → 收口 ~2026-06-15）
   - 范围：apps/server 已随 cutover 物理删除（恢复靠 git tag `pre-server-next-cutover`，非保留目录）；+7 天观察期内 tag 为回滚锚点（RTO ≤ 4h：checkout tag + nginx :3003→:3001 reload）；~2026-06-15 确认 0 报障后关闭回滚窗（changelog 收口；tag 可作永久历史锚点保留）。
   - 完成标准：7 天观察期 0 报障（运营输入）；回滚窗关闭记录入 changelog。
   - 建议模型：sonnet。

---

## [SEQ-20260609-01] 后台「消息·通知·提醒·日志」综合治理序列（ntlg-governance 落地）

- **状态**：🔄 进行中（NTLG-ADR-P0 ✅ — P0 端点 ADR 解禁；下一可取：NTLG-P0-2 无依赖快赢 / NTLG-P0-1 + NTLG-P0-3 依赖已 PASS）
- **创建时间**：2026-06-09
- **最后更新时间**：2026-06-09
- **source_of_truth**：`docs/designs/notification-task-log-governance-plan_20260608.md`（r2.1 定稿）
- **背景**：治理方案 r2.1 定稿但未分解进 tasks 工作流。本序列把方案 §6 的 P0/P1/P2 + §7 的 6 个 ADR 拆为原子卡。**ADR 编号锁定**：ADR-NN0a→**ADR-190**(nav-counts) / ADR-NN0b→**ADR-191**(tasks cancel·retry) / ADR-NN1→**ADR-192**(通知 schema+解耦双写+已读混合+unread-count) / ADR-NN2→**ADR-193**(TaskResultDigest+Reporter/Emitter 契约) / ADR-NN3→**ADR-194**(task_runs) / ADR-NN4→**ADR-195**(通知 TTL/dedup/scope)。
- **门禁顺序**：P0 三端点（nav-counts/cancel/retry）+ P1 unread-count 端点全部触发 `verify:endpoint-adr` → 对应 ADR 必须先 PASS（§7 + §11 D7）。P1 schema 跨 3+ 消费方 + 共享契约强制 Opus 子代理设计（CLAUDE.md §模型路由 1/2）。
- **§11 决策基线**：D1–D9 采纳方案推荐值（混合已读 / cursor 索引 / emit fire-and-forget / start 不阻断 / path A 近期默认 / 真源 NN3 二选一 / P0 端点 ADR 前置 / nav-counts 逐模块容错 / 服务双写不引新依赖）。
- **会话切入裁定（AskUserQuestion 2026-06-09）**：本程序首会话切入「起 P0 门禁 ADR」（NTLG-ADR-P0）。

### P0 阶段（修断链 / 去 mock，不动数据模型）

1. **NTLG-ADR-P0** — 起草 ADR-190(nav-counts) + ADR-191(tasks cancel·retry) 端点契约（状态：✅ 已完成 2026-06-09）
   - 范围：`docs/decisions.md` 追加 ADR-190 + ADR-191（§端点契约表 + 鉴权 + 错误码 + 逐模块容错口径 + :id 分派语义）；Opus arch-reviewer PASS。
   - 完成标准：两 ADR Accepted（Opus PASS）；`verify:adr-contracts` EXIT=0；为 P0-1/P0-3 端点解禁。
   - 依赖：无。建议模型：opus（端点 ADR + 强制 Opus PASS）。
   - **完成备注**：ADR-190 + ADR-191 落档并经 arch-reviewer (claude-opus-4-8) 独立评审 **AUDIT RESULT: PASS**（无红线，3 黄线转 P0-1/P0-3 实施期）。门禁 `verify:adr-contracts` EXIT=0（verify-endpoint-adr ✅ 226 路由全对齐，新 3 端点行就位待实施解禁）。黄线转交：① §7 占位编号反向映射已由本 SEQ 背景闭环；② NTLG-P0-1 落地以各模块 route preHandler 角色快照回填 ADR-190 D-190-4 定稿矩阵；③ NTLG-P0-3 补 retry/cancel 并发态二次校验测试 + `task.cancel`/`task.retry` 枚举同步 SSOT + tasks.ts 路由注册挂载。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。
2. **NTLG-P0-1** — nav-counts 聚合端点 + 侧边栏去写死（状态：🔄 进行中 — 拆 -A/-B，原子化判据 Q1 改动项 >5 + Q2 跨 api-service/UI 两层）
   - **-A** 后端聚合端点（状态：✅ 已完成 2026-06-09）
     - 范围：`GET /admin/system/nav-counts`（NavCountsService 逐模块容错聚合 5 计数 + 角色门控）+ 2 轻量 COUNT query（moderation/userSubmissions）+ AdminNavCounts 类型 + server.ts 注册 + 后端单测/route 测。
     - 依赖：NTLG-ADR-P0（ADR-190 PASS）。建议模型：sonnet。
     - **完成备注**：NavCountsService 逐模块 try/catch + 角色门控（真源快照：moderation/sources/userSubmissions=admin+mod，imageHealth/merge=admin-only）；moderation/userSubmissions 新增轻量 COUNT 落 queries 层；sources=getVideoGroupStats().dead / imageHealth=getImageHealthStats().brokenLast7Days / merge=VideoMergesService.listCandidates total（行为保真）。`GET /admin/system/nav-counts` 注册 server.ts。门禁：typecheck/lint EXIT=0 / verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 227 路由对齐，新端点匹配 ADR-190 / sql-schema-alignment ✅ / shell-types-mirror ✅）/ test:changed 升全量（packages/types 改动，ADR-180）6834 passed，2 失败均既有 flaky（VideoListClient CSV 导出 + VideoMergesService perf p95 baseline，隔离复跑 39/39 通过，与本卡无关）；新测 7（service 4 + route 3）。执行模型: claude-opus-4-8（人工 opus 会话覆盖 sonnet 建议——「持续推进」授权同会话连续）；子代理: 无。
   - **-B** 前端接入 + 去写死 + ADR 回填（状态：✅ 已完成 2026-06-09）
     - 范围：`useAdminNavCounts` 改消费聚合端点（单请求）+ `admin-nav.tsx` 删 4 写死 count（保 badge）+ ADR-190 D-190-4 回填定稿角色矩阵（YL3：mod=moderation/sources/userSubmissions，imageHealth/merge=admin-only）。
     - 依赖：NTLG-P0-1-A。建议模型：sonnet。
     - **完成备注**：`useAdminNavCounts` 改 `apiClient.get<AdminNavCountsResponse>('/admin/system/nav-counts')`，按 KEY_TO_HREF 映射建 href→count Map（0/缺省不入 Map 无 badge，保留降级语义；401/403 静默）；admin-nav 删 4 写死 count（moderation 484/sources 1939/imageHealth 597/userSubmissions 12）保 badge 色调；ADR-190 D-190-4 回填定稿角色矩阵表（代码真源 NavCountsService.MODULE_ROLES）；e2e shell-mocks 同步 `/admin/system/nav-counts` mock。门禁：typecheck/lint/verify:adr-contracts EXIT=0 / 新 hook 测 5（映射/0 缺省不入/null 空/401 静默/其他 warn）/ test:changed 增量 11 全过。admin e2e（侧边栏真实徽标验收）需真实栈+数据，按精确单测覆盖 + 既有先例延后为验收步骤。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议——「持续推进」授权）；子代理: 无。
   - **NTLG-P0-1 整卡 ✅**（-A + -B 收口，侧边栏 5 计数端到端去写死）。
3. **NTLG-P0-2** — 修 `NotificationsTab.tsx` 陈旧错误注释（状态：✅ 已完成 2026-06-09）
   - 范围：删除"后端不发 webhook / 触发逻辑未实装"陈旧错误警示横幅 + 副标题 + 注释（WebhookDispatcher ADR-146 已完整实装，核实 fetch POST+HMAC+retry+事件触发）；同步移除断言该横幅的 test #6/#7。零 ADR / 零端点 / 零 schema。
   - 依赖：无。建议模型：haiku。
   - **完成备注**：核实 WebhookDispatcher（ADR-146）已完整实装（fetch POST+HMAC+SSRF+retry，WebhookDispatcher.ts:142/214，被 crawler/maintenance/staging 真实事件触发，事件订阅过滤已实装）→ 横幅"未实装"确属陈旧错误。删除 `webhook-not-impl-banner` 横幅 + `WEBHOOK_WARN_BANNER_STYLE` 常量 + 改副标题为「推送系统事件到外部端点（事件订阅+HMAC 签名+失败重试，ADR-146）」+ 删 line60 陈旧注释；移除/替换 test #6/#7（合一为「不再含陈旧未实装 banner」断言，其余 ADR-146 事件订阅/连通性测试不动）。门禁：typecheck/lint EXIT=0 / NotificationsTab 测试 10 全过 / test:changed 增量 10 全过。执行模型: claude-opus-4-8（人工 opus 覆盖 haiku 建议——「持续推进」授权）；子代理: 无。
4. **NTLG-P0-3** — tasks cancel/retry 端点 + topbar 接线（状态：🔄 进行中 — 拆 -A/-B，原子化判据 Q1 改动项 >5 + Q2 跨 api/UI 两层）
   - **-A** 后端 tasks 控制端点（状态：✅ 已完成 2026-06-09）
     - 范围：`POST /admin/tasks/:id/{cancel,retry}`（按 id 分派 crawler runId / `bull-{queue}-{jobId}`，响应标注 `target.kind`）+ AdminAuditActionType `task.cancel`/`task.retry` 枚举 + AdminTaskControlTarget DTO + crawler retry 经 DISTINCT source_site 重建 siteKeys + createAndEnqueueRun + server.ts 注册 + route 测。
     - 依赖：NTLG-ADR-P0（ADR-191 PASS）。建议模型：sonnet。
     - **完成备注**：`routes/admin/tasks.ts` parseTaskId 分派；cancel（crawler 复用既有协作式取消链 / bull waiting·delayed·paused→remove、active→409、终态→no-op）；retry（bull failed→job.retry()、非 failed→409 / crawler 终态→listDistinctSiteKeysByRun 重建 siteKeys + createAndEnqueueRun 新 run 返 retryRunId、非终态→409）；admin-only。**audit SSOT 4 处同步**（YL2 兑现）：AdminAuditActionType union + AuditLogService.ACTION_TYPES + set-equal EXPECTED_ACTION_TYPES + coverage REQUIRED_ACTION_TYPES/PAYLOAD_ASSERTION_REQUIRED（audit-log-coverage 守卫捕获未同步并修复）。门禁：typecheck/lint/verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 229，2 新端点匹配 ADR-191 / shell-types-mirror ✅）；route 测 10 + audit 守卫 152 全过；test:changed 升全量（packages/types 改动）——audit 守卫 2 真失败已修，余 2 失败既有 flaky（DailyAnimeRow + VideoMerges perf p95，隔离复跑 40/40 通过）。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议——「持续推进」授权）；子代理: 无。
   - **-B** 前端 topbar 接线（状态：✅ 已完成 2026-06-09）
     - 范围：`admin-shell-client.tsx` 任务抽屉 cancel/retry toast stub → 真实调用（补 N1-147-4）+ e2e shell-mocks 同步。
     - 依赖：NTLG-P0-3-A。建议模型：sonnet。
     - **完成备注**：`handleCancelTask`/`handleRetryTask` 改 `apiClient.post('/admin/tasks/:id/{cancel,retry}',{})`→成功 success toast + `reloadTasks()` 刷新抽屉 / 失败 danger toast 透传 `err.message`（含后端 409 文案如「运行中作业不支持取消」）；`useAdminTasks` 解构 `reload`；e2e shell-mocks 加两 POST mock（正则匹配 :id/cancel|retry）。门禁：typecheck/lint/test:changed EXIT=0（增量 6，admin-shell-client 渲染测试持平）。抽屉点击交互按后端 10 测全覆盖 + e2e mock 支持 + 既有 stub 无单测先例，留 e2e/手动验收（plan §9「点取消/重试不再 toast」）。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议——「持续推进」授权）；子代理: 无。
   - **NTLG-P0-3 整卡 ✅**（-A 后端端点 + -B topbar 接线，cancel/retry 端到端打通）。
5. **NTLG-P0-4** — 采集完成 digest 文案补全（过渡态）（状态：⬜ 待开始）
   - 范围：`background-events` finished lane 把 `crawler.run.completed` 补结构化 digest 文案（正式版见 P1-b/c）。
   - 依赖：无（与 P1-b 不冲突，过渡态）。建议模型：sonnet。

### P1 阶段（通知架构升级 + 任务结果摘要 · 地基）

6. **NTLG-ADR-P1-A** — 起草 ADR-192：通知/审计解耦双写 + notifications/notification_read_cursor(+reads) schema + 已读混合模型 + unread-count 端点（状态：⬜ 待开始）
   - 依赖：无。建议模型：opus（跨 3+ 消费方 schema + 新 admin route，强制 Opus 子代理设计）。
7. **NTLG-ADR-P1-B** — 起草 ADR-193：TaskResultDigest + TaskRunReporter/NotificationEmitter 共享契约（emit fire-and-forget 对称 + 登记失败容错）（状态：⬜ 待开始）
   - 依赖：无。建议模型：opus（新共享组件 API 契约，强制 Opus 子代理设计）。
8. **NTLG-P1-a** — 通知存储 + 读 API（状态：⬜ 待开始）
   - 范围：`notifications` + `notification_read_cursor`(+预留 `notification_reads`) migration；SQL 落 `db/queries/notifications.ts`；`NotificationService` 编排 emit/list/markAllRead/unreadCount（cursor 模型）；`GET /admin/notifications`（迁新表）+ `GET /admin/notifications/unread-count`。先空跑兼容（旧 audit 派生回填验证读路径）。
   - 依赖：NTLG-ADR-P1-A（ADR-192 PASS）。建议模型：sonnet。
9. **NTLG-P1-b** — digest 类型 + crawler 投影（状态：⬜ 待开始）
   - 范围：`TaskResultDigest` 落 `packages/types`；`crawler_runs.summary`→`metrics` 映射；`TaskAggregator` 透出 digest 到 `/admin/system/jobs` 的 `TaskItem`；任务抽屉展示 digest chips（path A，不建 task_runs）。
   - 依赖：NTLG-ADR-P1-B（ADR-193 PASS）。建议模型：sonnet。
10. **NTLG-P1-c** — 解耦双写 emit 接入（状态：⬜ 待开始）
    - 范围：`NotificationEmitter` 中枢（fire-and-forget）；现 8 类白名单事件改领域服务主动 emit（audit/通知双写互不依赖）；crawler/富集 worker `on('completed')` 补带 digest 通知；下线 audit 派生通知旧路径。
    - 依赖：NTLG-P1-a + NTLG-P1-b。建议模型：sonnet。

### P2 阶段（增强 / 未来自动化 · 终态收口）

11. **NTLG-ADR-P2** — 起草 ADR-194(task_runs 统一抽象层 + 真源关系二选一) + ADR-195(通知保留期/TTL/去重/scope 定向)（状态：⬜ 待开始）
    - 依赖：P1 落地后（2–3 类流程接入数据支撑真源决策）。建议模型：opus。
12. **NTLG-P2-a** — `task_runs` 统一抽象层（§2.2 路径 B），UI 收敛单一投影（状态：⬜ 待开始）
    - 依赖：NTLG-ADR-P2（ADR-194）。建议模型：opus（数据模型）。
13. **NTLG-P2-b** — 多渠道通知统一订阅（webhook 已有 / 邮件实装 / `submission.created` 补触发点）+ 通知偏好（状态：⬜ 待开始）
    - 依赖：NTLG-P1-c。建议模型：sonnet。
14. **NTLG-P2-c** — 「消息中心」页（全量历史 + 检索 + 归档）+ 未读 SSE 实时推送（替代 60s 轮询）（状态：⬜ 待开始）
    - 依赖：NTLG-P1-a。建议模型：sonnet。
15. **NTLG-P2-d** — 维护 worker 清理 `expires_at` 过期通知（状态：⬜ 待开始）
    - 依赖：NTLG-ADR-P2（ADR-195）。建议模型：sonnet。
