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

## [SEQ-20260612-FIX2] PLAYER-LINE-BOUND-EP — 播放器选集绑定线路（线路优先模型）

- **状态**：✅ 已完成（2026-06-12）
- **创建时间**：2026-06-12
- **最后更新时间**：2026-06-12 23:50
- **目标**：播放器由"集数优先（全局 episodeCount）"改为"线路优先（集数绑定线路）"，切线路联动选集，杜绝切集时静默跨线路/跨语言跳变
- **范围**：`apps/web-next` watch 播放器（PlayerShell 数据流 + 新 line-matrix helper）；不改 API（`?episode` 已可选）；不含详情页 EpisodePicker/EpisodeGrid
- **依赖**：FIX-MERGE-EPCOUNT（已完成）

### 任务列表（按执行顺序）

1. PLAYER-LINE-BOUND-EP — 选集绑定线路重构（状态：✅ 2026-06-12）
   - 创建时间：2026-06-12
   - 实际开始：2026-06-12
   - 完成时间：2026-06-12 23:50
   - 验收要点：每线路独立选集；切线路有当前集则保留、否则收敛第 1 集；报错切换保持同集换线；arch-reviewer (Opus) CONDITIONAL → 3 红线全吸收。门禁 typecheck/lint/test:changed 215 passed。**e2e PLAYER 本地未运行**（smoke 同 20/21 失败 = e2e-next seed/环境缺口，非本改动；待 CI 验证）。详见 changelog [PLAYER-LINE-BOUND-EP]。

### 后续卡登记（本序列产出，不在本序列内执行）

- **E2E-NEXT-SEED-INFRA**（已在 queue 早前登记，本卡再确认必要性）：web-next e2e-next 本地无 seed 数据，homepage/player 全域 e2e 本地不可跑；需建 seed 基建后方能本地回归 PLAYER 域。
- **PLAYER-DEEPLINK-EP-LINE**（可选）：初始深链 `?ep=N` 优先选含该集的线路（当前默认最优线路 + 收敛第 1 集）。

---

## [SEQ-20260612-FIX] FIX-MERGE-EPCOUNT — 合并/拆分后 episode_count 不推进导致播放页选集丢失

- **状态**：✅ 已完成（2026-06-12）
- **创建时间**：2026-06-12
- **最后更新时间**：2026-06-12 22:55
- **目标**：合并/拆分转移 source 后同步推进 target 的 `episode_count`（已收录最大集数高水位），并修复历史漂移数据，恢复播放页/详情页选集到正常值
- **范围**：`apps/api` Service（VideoMergesService merge/split）+ DB query（video-merge-mutations）+ 数据修复 migration 114；不碰前端（前端读 `episodeCount` 行为正确）
- **依赖**：无

### 任务列表（按执行顺序）

1. FIX-MERGE-EPCOUNT — 合并/拆分 episode_count 不变量维护 + 历史数据修复（状态：✅ 2026-06-12）
   - 创建时间：2026-06-12
   - 实际开始：2026-06-12
   - 完成时间：2026-06-12 22:55
   - 验收要点：merge/split 后 target `episode_count = GREATEST(原值, MAX 活跃非投稿源 ep)`（query+service 双测覆盖）；migration 114 幂等修复全部漂移视频——真库验证「医到孤岛爱上你」2→4 / 全库漂移 4→0；门禁 typecheck/lint EXIT=0 + test:changed 321 passed。详见 changelog [FIX-MERGE-EPCOUNT]。

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

- **状态**：🔄 进行中（**P0 全部 ✅ + P1 全部 ✅**〔P1 地基 ADR-192〔+AMENDMENT〕/ADR-193 ✅ / P1-a 通知存储+端点 ✅ / P1-b TaskResultDigest ✅ / **P1-c 解耦双写全链路整卡 ✅**：-A emit/Reporter 地基 + -B1 worker digest + -B2 8 类事件双写 + -C list 迁新表收口〕；**下一可取：NTLG-ADR-P2**〔起 ADR-194 task_runs 统一抽象 + ADR-195 通知 TTL/dedup/scope，建议 opus〕→ 解锁 P2-a/b/c/d。P2 阶段为增强/未来自动化终态收口。）
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
5. **NTLG-P0-4** — 采集完成 digest 文案补全（过渡态）（状态：✅ 已完成 2026-06-09）
   - 范围：`background-events` finished lane 把 `crawler.run.completed` 补结构化 digest 文案（正式版见 P1-b/c）。
   - 依赖：无（与 P1-b 不冲突，过渡态）。建议模型：sonnet。
   - **完成备注**：`BackgroundEventService` 加 `buildRunDigest(summary)` helper——从 `crawler_runs.summary`（videosUpserted/sourcesUpserted/failed/errors）安全提取 → 「新增 N 视频 · M 线路 · K 站点失败 · E 错误」；finishedRunEvents 条件设 `description`（无有效数据不设）。`AdminBackgroundEventFinished.description?` 字段已存在 + 前端 finished 映射已消费 description→NotificationItem.body（admin-shell-notifications.ts:108）→ 零类型改动、零前端改动，digest 直达通知抽屉。门禁：typecheck/lint/test:changed EXIT=0；新测 2（#5b 有 summary→digest / #5c summary=null→无 description），background-event-service 14 全过。过渡态，正式结构化 TaskResultDigest（metrics chips）见 ADR-193/P1-b/c。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议——「持续推进」授权）；子代理: 无。

**P0 阶段全部完成**（NTLG-ADR-P0 + P0-1 + P0-2 + P0-3 + P0-4 ✅）：侧边栏去写死 + webhook 陈旧警示清理 + tasks cancel/retry 端到端 + 采集完成 digest 文案。P1 阶段（NTLG-ADR-P1-A/B 起 ADR-192/193 → P1-a/b/c）须 Opus 子代理设计，建议新会话 opus 启动。

### P1 阶段（通知架构升级 + 任务结果摘要 · 地基）

6. **NTLG-ADR-P1-A** — 起草 ADR-192：通知/审计解耦双写 + notifications/notification_read_cursor(+reads) schema + 已读混合模型 + unread-count 端点（状态：✅ 已完成 2026-06-09）
   - 依赖：无。建议模型：opus（跨 3+ 消费方 schema + 新 admin route，强制 Opus 子代理设计）。
   - **完成备注**：ADR-192 Accepted（arch-reviewer (claude-opus-4-8) 独立设计 → **AUDIT RESULT: PASS**，无红线）。落定 §11 三决策：**D1** 已读混合模型（broadcast/role 走 `notification_read_cursor` per-user 高水位、定向走 `notification_reads` 逐行；新用户 cursor 初值=加入时间不回溯、markAllRead 仅 upsert 一行——消解「新管理员全历史未读 + 写放大」两 bug）/ **D2** cursor + `(scope,created_at)` 索引足够，ADR 写明理由**不补** anti-join（附未读计数 SQL 锁定口径 D-192-5）/ **D9** (a) 领域服务双写（不引事件总线、守技术栈红线，emit 不写 audit_log）。锁 `notifications`+`notification_read_cursor`(+预留 `notification_reads`) schema（migration 100，P1-a 实施）+ level DB CHECK / scope 类型层前缀校验分层；兼任 `GET /admin/notifications/unread-count` endpoint-ADR（§7 残留 B，避 P1-a 被 `verify:endpoint-adr` 挡）。边界声明：emit 中枢/TaskResultDigest 归 ADR-193、task_runs 归 ADR-194、TTL/dedup/scope 策略归 ADR-195。门禁：`verify:adr-contracts` EXIT=0 / `verify:endpoint-adr` ✅ 229 路由对齐（ADR 端点 115，已含新 unread-count 契约行预登记）/ typecheck/lint EXIT=0 / test:changed SKIP（docs-only）。3 黄线转 P1-a：① migration 100 号落地再确认；② cursor 初值=加入时间须 P1-a 实现 + 补基线 E2E 断言；③ 过渡期双写源去重单一写源开关。docs-only。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / agentId a976fc3359c4cb5d5)。
7. **NTLG-ADR-P1-B** — 起草 ADR-193：TaskResultDigest + TaskRunReporter/NotificationEmitter 共享契约（emit fire-and-forget 对称 + 登记失败容错）（状态：✅ 已完成 2026-06-09）
   - 依赖：无。建议模型：opus（新共享组件 API 契约，强制 Opus 子代理设计）。
   - **完成备注**：ADR-193 Accepted（arch-reviewer (claude-opus-4-8) 独立设计 → **AUDIT RESULT: PASS**，无红线；并捕获修正方案 §2.3 草案 2 缺陷）。落定 §11 三决策：**D3** `NotificationEmitter.emit(...): void` fire-and-forget（与 `AuditLogService.write(): void` 逐行同构，消解领域服务双写失败语义分叉；**修正草案 `Promise<void>`→`void`**）/ **D4** `TaskRunReporter.start` 登记失败不阻断作业（降级 sentinel TaskRunId + log warn）/ **D5** path A 近期默认——digest 走 `crawler_runs.summary` 投影、不建 task_runs（path B 待 ADR-194）。锁 `TaskResultDigest`+`TaskMetric` 类型（置 packages/types、admin-ui 正向 import 复用、`digest?` 双源镜像）+ emit 入参 11 字段一一对应 ADR-192 notifications schema 列（**补 `sourceKind` 必填——修正草案漏项**、`payload:unknown` 禁 any）+ summary→metrics 投影口径锁定（videosUpserted/sourcesUpserted/failed/errors 4 类，余 6 内部计数不投影）+ TaskRunReporter P1 为 NoopReporter（契约先行、真实 DB 写待 ADR-194）。**无新 admin route**（digest 走既有 `GET /admin/system/jobs`），verify:endpoint-adr 不涉及。边界：notifications schema 归 ADR-192、task_runs 归 ADR-194、TTL/scope 策略归 ADR-195。门禁：`verify:adr-contracts` EXIT=0（verify-adr-d-numbers 识别 D-193-1..6 / admin-shell-types-mirror 2 对镜像对齐 / endpoint-adr 229 路由对齐无新增）/ typecheck/lint EXIT=0 / test:changed SKIP（docs-only）。4 黄线转 P1-b/c：① TaskItem.digest? 双源同 commit + mirror + Opus trailer；② chips tone→CSS 变量；③ emit SQL 落 queries 层；④ dedupKey ON CONFLICT DO NOTHING + 幂等单测。docs-only。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / agentId ac8649e7b8354f56f)。
8. **NTLG-P1-a** — 通知存储 + 读 API（状态：🔄 进行中 2026-06-09 — 拆 -A/-B，原子化判据 Q1 范围 >5 + Q2 跨 schema/api-service 层）
   - 范围：`notifications` + `notification_read_cursor`(+预留 `notification_reads`) migration；SQL 落 `db/queries/notifications.ts`；`NotificationService` 编排 emit/list/markAllRead/unreadCount（cursor 模型）；`GET /admin/notifications`（迁新表）+ `GET /admin/notifications/unread-count`。先空跑兼容（旧 audit 派生回填验证读路径）。
   - 依赖：NTLG-ADR-P1-A（ADR-192 PASS ✅）。建议模型：sonnet。
   - **NTLG-P1-a-A** — 通知存储 schema + queries 层地基（状态：✅ 已完成 2026-06-09）
     - 范围：migration 100（3 表 + 索引）+ `db/queries/notifications.ts`（insert/list/countUnread/getReadCursor/upsertReadCursor）+ architecture.md §5.x + 集成测试。纯数据层，零 API/行为变更。
     - 依赖：ADR-192 ✅。建议模型：sonnet（本会话 opus 覆盖）。
     - **完成备注**：按 ADR-192 §schema 落 migration 100（`notifications` + `notification_read_cursor` + `notification_reads` 预留 3 表 + 3 索引，level DB CHECK / scope 无 CHECK / dedup_key partial unique；索引按 db-rules 4 级结构文档化）。`db/queries/notifications.ts` 落 5 函数（insertNotification ON CONFLICT (dedup_key) WHERE NOT NULL DO NOTHING 幂等 + 反查既存 id / listNotifications scope 过滤 + 时间窗 + expires 过滤 / countUnreadNotifications D-192-5 口径〔cursor + users LEFT JOIN COALESCE(read_at, created_at) + NOT EXISTS reads + expires〕/ getReadCursor / upsertReadCursor ON CONFLICT user_id DO UPDATE）；query 参数类型收敛为 `Queryable = Pick<Pool,'query'>`（Pool/PoolClient 皆满足，支持事务测试零污染，下游传 Pool 不破坏，类型探针证 PoolClient→Queryable 合法）。architecture.md §5.17 登记 3 表 + 索引 4 级文档 + 未读口径。集成测试 `admin-notifications.test.ts` 8 用例全过（读路径 schema 对齐 4 + 写路径 BEGIN/ROLLBACK 零污染 round-trip 4：insert→list / dedup 幂等单行 / cursor upsert 单行无写放大 / 未读 cursor 高水位口径独立 scope 隔离）。门禁：migrate 应用 dev DB ✅ / typecheck/lint/verify:adr-contracts EXIT=0（sql-schema-alignment 78 表含新 3 表 ✅）/ test:changed EXIT=0（改动映射无 unit 测，集成测独立验证）。纯数据层零 API/行为变更，端点/service 编排归 -B。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议）；子代理: 无。
   - **NTLG-P1-a-B** — NotificationService 编排 + 端点接入（含 ADR-192 修订）（状态：✅ 已完成 2026-06-09）
     - 范围：**ADR-192 AMENDMENT**（markAllRead 写端点补登 + 空跑兼容读路径锁定，强制 Opus 子代理）+ `NotificationService` unreadCount/markAllRead 编排 + `GET /admin/notifications/unread-count` + `POST /admin/notifications/read` + unread-count/markRead DTO + service/route 测试。
     - 依赖：NTLG-P1-a-A ✅。建议模型：sonnet（本会话 opus 覆盖）。
     - **实现期发现**：markAllRead 服务端写端点缺失于 ADR-192 端点契约（仅登记 unread-count GET），§9 验证要求 P1-a 即有服务端跨设备已读 → 起 ADR-192 AMENDMENT 补登（用户裁定 2026-06-09「起 ADR-192 修订后实现全 P1-a-B」）。
     - **完成备注**：**ADR-192 AMENDMENT Accepted**（arch-reviewer claude-opus-4-8 CONDITIONAL PASS → C1 吸收）。C1 关键发现：`adr-parser.findSubsection` 每 ADR 只解析首个 `### 端点契约` 段 → markAllRead 行必须并入 ADR-192 既有端点契约表（非另起子标题），沿 ADR-105 inline AMENDMENT 范式。AMENDMENT 4 决策：D-192-AMD-1（`POST /admin/notifications/read` 端点：upsert cursor read_at=NOW 服务端取时、空 body、200 `{data:{readAt}}`、admin+moderator、零新错误码；cursor 初值=加入时间由 P1-a-A COALESCE 读兜底已满足、收口黄线②不另做首登写）/ D-192-AMD-2（markOneRead 服务端端点不在 P1-a-B、与 reads 写路径同步 P2，D-192-DEV-4）/ D-192-AMD-3（**策略 B 双轨过渡**：list 暂不迁新表/不做 audit 回填、避免 P1-c 即删机制；unread-count+markAllRead 走新表 cursor，过渡期 unread=0 为「无新通知」正确语义）/ D-192-AMD-4（cursor 只服务新表语义，audit 派生 list 客户端已读维持 localStorage 至 P1-c 收口，不做半吊子桥接）。实现：`NotificationService.unreadCount(userId,role)`（scope 派生 broadcast+role:<role>+user:<id>，调 countUnreadNotifications）+ `markAllRead(userId)`（调 upsertReadCursor，SQL 不入 Service D-192-7）；`routes/admin/notifications.ts` +2 端点；`admin-shell.types.ts` +unread-count/markRead DTO（API-only 非镜像）。测试：notification-service.test.ts +7（unreadCount scope 派生 admin/moderator + markAllRead readAt + 4 端点 auth/200）共 16 全过。门禁：typecheck/lint EXIT=0 / verify:endpoint-adr 231 路由对齐（116 ADR 端点含 markAllRead 行解析 ✅ C1 验证）/ verify:adr-contracts EXIT=0 / test:changed 升全量〔packages/types〕。前端 markAllRead 改调端点 + list 迁新表归 P1-c。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议）；子代理: arch-reviewer (claude-opus-4-8 / agentId a8246b3043fc166d0)。
9. **NTLG-P1-b** — digest 类型 + crawler 投影（状态：✅ 已完成 2026-06-09）
   - 范围：`TaskResultDigest` 落 `packages/types`；`crawler_runs.summary`→`metrics` 映射；`TaskAggregator` 透出 digest 到 `/admin/system/jobs` 的 `TaskItem`；任务抽屉展示 digest chips（path A，不建 task_runs）。
   - 依赖：NTLG-ADR-P1-B（ADR-193 PASS）。建议模型：sonnet。
   - **完成备注**：ADR-193 path A 零自由度落地，4 文件纯加性。① `packages/types/admin-shell.types.ts` +`TaskMetric`/`TaskResultDigest`（逐字按 ADR §契约定义）+`AdminTaskItem.digest?`；② `packages/admin-ui/shell/types.ts` `import type { TaskResultDigest } from '@resovo/types'` 复用 + re-export + `TaskItem.digest?` 镜像（依赖方向合法 admin-ui→types）；③ `TaskAggregator.ts` 模块级纯函数 `buildTaskResultDigest(summary)`（D-193-4 投影表零自由度：videos_added/sources_added tone=ok 恒展示 / sites_failed tone=warn >0 展示 / errors tone=danger >0 展示 / 6 生命周期内部计数不投影 / num 守卫复用 buildRunDigest 口径 / summary=null 或空 metrics→undefined）+ `mapCrawlerRun` 条件挂载；④ `task-drawer.tsx` `TaskDigestChips` 子组件 + `chipStyle` tone→CSS state token（ok→success/warn→warning/danger→error/undefined→neutral surface），零硬编码色。`buildRunDigest`（NTLG-P0-4）并存不删（D-193-6）；未触碰 P1-c（emit/Reporter/worker）。**arch-reviewer (claude-opus-4-8 / agentId a5a5ace3e398944af) 独立评审 AUDIT RESULT: PASS**（无 BLOCKER/HIGH，2 LOW 均「本卡无需改动」属 P1-c 收口 advisory：summary 文案口径未锁可未来复用 / value string 分支预留未测）。门禁：typecheck/lint EXIT=0 / `verify:adr-contracts` EXIT=0（**verify:admin-shell-types-mirror 2 对镜像对齐含新 digest 字段** ✅ / endpoint-adr 231 无新 route）/ 改动测试 38 全过（task-aggregator 13 + task-drawer 25，新增投影口径 8 + chips 6）/ **test:changed 升全量〔packages/types〕6874 passed**（2 失败 = VideoListClient CSV 导出 jsdom + VideoMerges perf p95 baseline，均既有 flaky，隔离复跑 39/39 通过，与本卡零关联）。commit 携 `Subagents: arch-reviewer (claude-opus-4-8)` trailer（黄线①）。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议——「继续执行 SEQ-20260609-01 后续任务」持续推进授权）；子代理: arch-reviewer (claude-opus-4-8 / agentId a5a5ace3e398944af)。
10. **NTLG-P1-c** — 解耦双写 emit 接入（状态：🔄 进行中 2026-06-09 — 拆 -A/-B/-C，原子化判据 Q1 范围 6 项 > 5 + Q2 跨 api-service/worker/UI 多层 + 含破坏性「下线旧路径」迁移须分阶段验证）
    - 范围：`NotificationEmitter` 中枢（fire-and-forget）；现 8 类白名单事件改领域服务主动 emit（audit/通知双写互不依赖）；crawler/富集 worker `on('completed')` 补带 digest 通知；下线 audit 派生通知旧路径。
    - 依赖：NTLG-P1-a ✅ + NTLG-P1-b ✅。建议模型：sonnet。
    - **NTLG-P1-c-A** — NotificationEmitter 中枢 + NoopTaskRunReporter（地基）（状态：✅ 已完成 2026-06-09）
      - 范围：`NotificationEmitter`（emit fire-and-forget，与 `AuditLogService.write(): void` 同构 ADR-193 D-193-2，复用 P1-a-A `insertNotification`、SQL 不入 service D-192-7、scope 默认 'broadcast'、payload:unknown 禁 any）+ `NoopTaskRunReporter`（ADR-193 D-193-3 契约骨架：start 返 sentinel id + log / progress·finish log-only）+ DI 接线 + service/单测。**纯加性，零现有路径改动、零行为变更**（emit 暂无调用方，接入归 -B）。
      - 依赖：P1-a ✅ + P1-b ✅。建议模型：sonnet。
      - **完成备注**：ADR-193 D-193-2/3 两中枢纯加性实装。① `NotificationEmitter.emit(input): void`（与 `AuditLogService.write` 逐行同构 fire-and-forget——`insertNotification` 不 await + `.catch` log warn + 返 void；scope 省略默认 'broadcast'；payload:unknown 禁 any；SQL 复用 P1-a-A insertNotification 不入 service D-192-7）+ `EmitNotificationInput` 11 字段（仅 scope 较 InsertNotificationInput 可选）；② `NoopTaskRunReporter implements TaskRunReporter`（start 返 sentinel `UNLINKED_TASK_RUN_ID='unlinked'` + log / progress·finish log-only `Promise.resolve` 避 no-await-async）；③ `packages/types` +`TaskRunId` + `TaskRunReporter` interface（引用 TaskResultDigest，D-193-3 入 packages/types，**非 mirror interface 不影响 mirror 守卫**）。注入范式同 AuditLogService（constructor(db: Pool)，-B 领域服务 constructor 注入）。**纯加性零行为变更**——emit 暂无调用方，8 类事件接入 + worker digest 归 -B。注释规避陷阱：emit input scope 注释原拟 `role:*/user:*` 含 `*/` 提前闭合 JSDoc → 改纯文本措辞。门禁：typecheck/lint/verify:adr-contracts EXIT=0（mirror 2 对仍对齐）/ 新测 9（emitter 4：入参映射+scope 默认+payload 序列化+void+吞错 / reporter 5：sentinel+ref+progress·finish noop）/ **test:changed 升全量〔packages/types〕6885 passed 零失败**。**不改 admin-ui types.ts Props → commit 不强制 arch-reviewer trailer**（同 P1-a-A 纯地基先例；契约由 ADR-193 arch-reviewer PASS 锁定，本卡纯实施）。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议——持续推进授权）；子代理: 无。
    - **NTLG-P1-c-B** — 8 类白名单事件领域服务接入 emit 双写 + worker digest 通知（状态：✅ 已完成 2026-06-09 — -B1 worker digest ✅ / -B2 8 类事件双写 ✅）
      - 范围：8 类事件（system.webhook_send_failed / staging.batch_publish / video.manual_add / video.merge / user_submission.action / system.cache_clear / system.settings_update / system.audit_rollback）在领域服务写入点 audit + emit **双写互不依赖**（NotificationService.list 仍读 audit，过渡期可对账）+ crawler/富集 worker `on('completed')` 补带 digest 通知（payload 携 TaskResultDigest）。
      - 依赖：P1-c-A ✅。建议模型：sonnet。
      - **写入点分布（2026-06-09 调研实证，供拆卡）**：① service 层 audit.write：`WebhookDispatcher`(webhook_send_failed) / `StagingPublishService`(batch_publish) / `VideoService`(manual_add) / `UserSubmissionService`(submission.action) / `AuditRollbackService`(cache_clear+settings_update+audit_rollback 回滚侧) / `HomePublishService`(audit_rollback)；② route 层 audit.write：`staging.ts` / `cache.ts` / `siteConfig.ts` / `userSubmissions.ts`（部分事件在 route 直写 audit）；③ video.merge 写入点散在 server.ts + identity-decision.ts/video-merge-mutations.ts（queries 层，需定位真实 service 编排点）；④ worker：`crawlerWorker.ts` finally 块 syncResult（run 级，非 per-job on('completed')）+ verify/enrichment worker。
      - **NTLG-P1-c-B-1** — crawler worker run 完成 digest 通知（emit 接入）（状态：✅ 已完成 2026-06-09）
        - 范围：crawler run 终态 emit `crawler.run.completed` digest 通知（复用 P1-b buildTaskResultDigest + P1-c-A NotificationEmitter）。富集 worker 当前仅 on('failed') 无 on('completed') → 收敛 crawler 单点（ADR §影响文件亦只列 crawlerWorker；富集 digest 留后续）。
        - 依赖：P1-c-A ✅ + P1-b ✅。建议模型：sonnet（本会话 opus 覆盖——用户裁定「继续推进 -B1」）。
        - **完成备注**：新建 `crawlerWorker.notifications.ts` 纯函数 `buildRunCompletedNotification(syncResult, runId): EmitNotificationInput | null`（终态 status→level/title 映射：success→info「采集完成」/ partial_failed→warn「采集部分失败」/ failed→danger「采集失败」/ cancelled→warn「采集已取消」；非终态→null；digest 投影 payload+body；`dedupKey='crawler.run.completed:'+runId` 幂等防 multi-site 并发 finally 重复）。`crawlerWorker.ts` 模块级 `notificationEmitter` 实例 + processCrawlJob `finally` 块（紧邻 webhook 触发，复用 syncResult run 级 status+summary，**fire-and-forget 不阻断 worker**）。**实施级偏离登记**：ADR §影响文件提示 `on('completed')`（per-job 拿不到 run summary），实际锚定 `finally` 块 syncResult（run 级，D-193-4 正确锚点，与 webhook 同范式）。crawlerWorker.ts 505→513（+8 最小接入，既有超限 debt 不加重——新逻辑沉淀独立文件）。门禁：typecheck/lint/verify:adr-contracts EXIT=0（mirror 仍对齐）/ 新测 7（终态映射+非终态 null+digest 投影+summary=null 无 body/payload+dedupKey）/ **现有 5 crawler worker 测试 130 passed 行为变更零破**（emit fire-and-forget + mock db.query 吞错）/ test:changed 增量 18 文件 251 passed。emit 策略首次定调记入卡。执行模型: claude-opus-4-8；子代理: 无。
      - **NTLG-P1-c-B-2** — 8 类白名单事件领域服务/route 写入点 emit 双写（状态：✅ 已完成 2026-06-09）
        - 范围：8 类事件在领域服务/route 写入点 audit + emit 双写（复用 NotificationService TITLE_MAP/LEVEL_MAP/HREF_MAP 现成映射建 emit 参数表，DI 注入 NotificationEmitter）。落地先定各事件 type 语义键 + scope + dedupKey 策略（避与未来 ADR-195 冲突）；video.merge 写入点需先定位真实 service 编排点。
        - 依赖：P1-c-B-1 ✅。建议模型：sonnet。
        - **完成备注**：新建 `notification-audit-emit.ts` 共享映射真源（whitelist/title/level/href 从 NotificationService 抽出 `as const satisfies` 派生 union+Set + `buildAuditNotificationEmit` 纯函数；NotificationService.list import 复用 + re-export whitelist，行为零变更）+ 8 写入点接入 emit（DI 镜像 audit：service 内 `new NotificationEmitter(this.db)` / route 局部）。**emit 策略**：type=8 actionType 复用零新命名空间 / scope='broadcast'（parity 全 admin 可见）/ **dedupKey 不设**（与 audit 一对一不去重，helper 刻意不预占键，deferred ADR-195）/ body·payload 不设（parity 派生 list 无 body）/ sourceKind='admin_action'（象限取值集自此 {crawler, admin_action}）。**写入点放置**：AuditRollbackService/VideoMergesService COMMIT 后（emit 走独立 Pool 非事务 client，置前回滚会产幽灵通知）/ StagingPublishService if(audit) 内（系统 Job 无 audit 不 emit，parity 守护）。8 写入点逐一实证单点（video.merge 仅 VideoMergesService；HomePublishService 实写 home_page.rollback 非白名单，调研注勘误）。**arch-reviewer (claude-opus-4-8 / aef51db8d872dae9d) 落地前 CONDITIONAL PASS → 4 项全吸收**（HIGH-1 re-export 防 notification-service.test.ts 断裂 / MEDIUM-1 文档化 sourceKind / MEDIUM-2 helper 无 dedupKey + 注释 / MEDIUM-3 helper 全字段单测）。测试：notification-audit-emit.test.ts ×11（helper 全 8 类全字段 + union 穷尽，单卡豁免前提）+ 7 写入点 emit 双写 smoke（含 if(audit)/COMMIT 后/拦截·422 不 emit parity 守护）+ video-merge-mutations 补 NotificationEmitter mock（修 6 unhandled rejection——其 logger mock 无顶层 warn + bare pool query 返 undefined）。门禁：typecheck（7 ws）/lint（4）EXIT=0 / verify:adr-contracts EXIT=0（endpoint-adr 231 无新 route / mirror 2 对对齐 / sql-schema 78 表）/ **test:changed 55 文件 787 passed** / 全量 api 单测+集成 212 文件 2868 passed 零 unhandled。无新 route/schema/error code → architecture.md 零同步。e2e N/A（emit API-only fire-and-forget 零 UI/契约变更，list 仍读 audit 至 C 卡；同 B-1 先例）。**原子化范围超限接受完成度风险**：8 写入点 > 5（Q1 触发），单卡推进——设计集中单一 tested helper + 8 点机械应用（非 8 独立认知决策）+ 不跨 3 层，逃生口满足（commit arch-reviewer trailer + 本标注）。settings_update（siteConfig）无既有 harness → 依赖 helper 全字段单测 + 与 cache.ts 写入范式逐字等价 + typecheck 锁定。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议——持续推进授权）；子代理: arch-reviewer (claude-opus-4-8 / aef51db8d872dae9d)。
      - **NTLG-P1-c-B 整卡 ✅**（-B1 worker digest ✅ + -B2 8 类事件双写 ✅，解耦双写全量接入完成）。
    - **NTLG-P1-c-C** — list 迁新表 + 前端 markAllRead 接线 + 下线 audit 派生旧路径（破坏性切换）（状态：✅ 已完成 2026-06-09）
      - 范围：`GET /admin/notifications` 改读 notifications 新表（`NotificationService.list` 重写，弃 audit 白名单派生）+ 前端 markAllRead 改调 `POST /admin/notifications/read`（替 localStorage）+ 删 `NOTIFICATION_ACTION_WHITELIST` 派生逻辑（D-192-AMD-3/4 统一 cursor 单一已读源）。**破坏性切换须 -B 双写已验证**（emit 已覆盖全部现有通知来源，否则丢通知）。
      - 依赖：P1-c-B。建议模型：sonnet。
      - **完成备注**：破坏性切换三段落地（详见 changelog [NTLG-P1-c-C]）。① list 迁新表 + sourceKind allowlist `['admin_action']` 过滤（crawler 仍经 background lane，防重复 + 保旧 list parity 零漂移；title/level/href 直读列复用 emit 同源映射）；② 已读统一 cursor 单一源——list 返 `meta.readAt=COALESCE(cursor,users.created_at)`（新增 getEffectiveReadCursor，D-192-5 同口径），前端弃 localStorage 改服务端 readAt，markAllRead 改调 POST /admin/notifications/read（乐观+对齐+reload）；③ 删 audit 派生死代码（NOTIFICATION_ACTION_WHITELIST 零消费方）+ export ADMIN_ACTION_SOURCE_KIND 读写真源 + 新增真 countNotifications 保 meta.total。**arch-reviewer (claude-opus-4-8 / agentId a0ecadc5cac703d68) 落地前评审 CONDITIONAL PASS → 2 BLOCKER+3 HIGH+3 MEDIUM+3 LOW 全 11 条处置**：BLOCKER-1 红点维持 list-derived（拒绝改 unread-count——不含 background lane，破坏 bell↔drawer 一致性）+ 迁移噪音登记；BLOCKER-2 核实 AuditLogService.write 同 fire-and-forget → 切 emit 派生无可靠性回归（ADR-193 D-193-2 同构）；HIGH/MEDIUM/LOW 全吸收。门禁：typecheck/lint/verify:adr-contracts EXIT=0（endpoint-adr 231 无新 route）/ test:changed 升全量 6910 passed（1 既有 jsdom flaky 隔离过）/ 集成 13/13 / **E2E admin 79 passed EXIT=0**。行为变更均 ADR-192 既定（数据源迁移 parity 保形 / 已读跨设备 / 新管理员不回溯历史）。P2 收口登记：crawler 移出 background lane + 红点统一 unread-count + 逐行 reads → 归 NTLG-P2-c。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8 / agentId a0ecadc5cac703d68)。
      - **NTLG-P1-c 整卡 ✅**（-A emit/Reporter 地基 + -B1 worker digest + -B2 8 类事件双写 + -C list 迁新表收口）。**SEQ-20260609-01 P1 阶段全部完成**（P1-a 通知存储+端点 / P1-b TaskResultDigest / P1-c 解耦双写全链路）。

### P2 阶段（增强 / 未来自动化 · 终态收口）

11. **NTLG-ADR-P2** — 起草 ADR-194(task_runs 统一抽象层 + 真源关系二选一) + ADR-195(通知保留期/TTL/去重/scope 定向)（状态：✅ 已完成 2026-06-09）
    - 依赖：P1 落地后（2–3 类流程接入数据支撑真源决策）。建议模型：opus。
    - **完成备注**：ADR-194 + ADR-195 双双 Accepted（arch-reviewer claude-opus-4-8 / agentId af24d2b6d44d50f89 同次独立评审 → **AUDIT RESULT: PASS**，无红线，逐项 13 项核验全 ✅）。**ADR-194 §11 D6 真源裁定 = 「只读投影」**（D-194-1：crawler_runs 保持采集批次唯一真源、否决并行登记；crawler 不写 task_runs 物理表、读时 union 投影、task_runs 仅登记**当前无持久 run 表的 bull 作业**〔enrichment/imageHealth/maintenance/...〕→ 不构成双真源；零回归关键采集路径）。锁 task_runs schema（id BIGSERIAL / kind 无 CHECK 类型层 / status 5 态 CHECK / progress SMALLINT / digest JSONB / 时间戳 + 2 索引）+ TaskRunReporter 升真实 DB 写〔interface 零改动、start 失败降级 sentinel 不阻断〕+ TaskAggregator 副源 bull active→task_runs 持久登记 + `taskrun-` id 方案 + ADR-191 parseTaskId re-point〔AdminTaskControlTarget.kind 扩 'task_run' 加性〕+ bull 协作式取消解 D-191-DEV-1 409 + 无新 admin route 声明。**ADR-195** 锁 ADR-192 留白的策略数值：TTL 默认 30 天〔对齐 ADR-188 purge 先例〕+ Emitter 注入 + NULL 永久 + per-type 覆盖 / dedup 命名约定 `<type>:<source_ref>`〔幂等可重放设、离散操作不设〕/ scope 三前缀正则校验 + 定向 reads 写路径触发条件〔衔接 D-192-DEV-1/4〕/ 过期清理 worker `purge-expired-notifications`〔复用 ADR-188 maintenanceWorker 范式、物理删除否决软隐藏、FK CASCADE 级联 reads〕。**3 黄线全实施期处理**：① admin_action per-type TTL 升级为 P2-d 显式验收项〔已吸收进 D-195-DEV-1，建议 ≥90 天防运营 UX 退化〕；② D-19x-DEV-N 偏离编号不被 verify-adr-d-numbers 追踪〔全项目既有约定盲区，主决策号 D-194-1..8/D-195-1..5 正常解析〕；③ P2-d purge tick 须避开 maintenanceScheduler early-return 注册陷阱。门禁：verify:adr-contracts EXIT=0（**endpoint-adr 231 路由全对齐、116 ADR 端点、无新增路由** ✅ / admin-shell-types-mirror 2 对镜像对齐 ✅ / sql-schema 78 表 ✅ / D-194-1..8+D-195-1..5 advisory 待 P2-a/P2-d 落地闭环，同 ADR-190..193 起草模式）/ typecheck EXIT=0 / lint EXIT=0 FULL TURBO / test:changed docs-only 自动跳过（ADR-180）。docs-only 零代码改动（落地归 P2-a/P2-d）。**解锁 P2-a（ADR-194）+ P2-d（ADR-195）**。执行模型: claude-opus-4-8（人工 opus 覆盖建议 opus 一致——「继续执行 SEQ-20260609-01 序列任务 P2」持续推进授权）；子代理: arch-reviewer (claude-opus-4-8 / agentId af24d2b6d44d50f89)。
12. **NTLG-P2-a** — `task_runs` 统一抽象层（§2.2 路径 B），UI 收敛单一投影（状态：✅ 已完成 2026-06-09 — -A/-B/-C 三子卡全收口；task_runs 端到端落地 + ADR-191 :id re-point 完成）
    - 依赖：NTLG-ADR-P2（ADR-194 ✅）。建议模型：opus（数据模型；schema 已 ADR-194 D-194-3 锁定，子卡降 sonnet 级实施）。
    - **拆卡蓝图（ADR-194 落地，沿 P1-a/P1-c「schema 地基 → 写接入 → 控制/破坏性切换」先例）**：
      - **NTLG-P2-a-A** — task_runs schema + queries 层地基 + DbTaskRunReporter 真实实装（状态：✅ 已完成 2026-06-09）
        - 范围：migration **102**_task_runs.sql（D-194-3 schema + 2 索引）+ `db/queries/taskRuns.ts`（insertTaskRun/updateProgress/finishTaskRun/listTaskRuns，SQL 全落 queries 层 db-rules）+ `DbTaskRunReporter`（替 Noop，interface 零改动 D-194-4，start 失败降级 sentinel 不阻断 §11 D4）+ architecture.md schema 同步 + 集成测试。**纯加性空跑兼容**：Reporter 有真实写但暂无 worker 调用方（接入归 -B）、TaskAggregator 暂不读 task_runs（归 -B）→ 零现有读路径改动、零行为变更。
        - 依赖：ADR-194 ✅。建议模型：sonnet（schema 已锁，纯实施 / 本会话 opus 覆盖）。
        - **完成备注**：按 ADR-194 D-194-3 落 migration 102_task_runs.sql（id BIGSERIAL / kind 无 CHECK 类型层 / status **6 态** CHECK〔含 cancelling 协作式取消中间态，见下 Codex 修正〕/ progress SMALLINT 0-100 CHECK / digest JSONB / 时间戳 + 2 索引〔created_at DESC、status+created_at DESC〕，db-rules 4 步内联注释，COMMENT 标注「只读投影/crawler 不写」）。`db/queries/taskRuns.ts` 4 函数（insertTaskRun 落 status='running'+started_at=NOW() 返 id::text / updateTaskRunProgress 仅 running 行 / finishTaskRun status+digest〔JSON.stringify→JSONB〕+error+finished_at / listTaskRuns created_at DESC + 可选 since），Queryable=Pick<Pool,'query'> 收敛（事务测试零污染，镜像 notifications.ts；时间戳返 Date 对齐 TaskAggregator CrawlerRunRow 约定便 -B 消费）。`DbTaskRunReporter implements TaskRunReporter`（interface 零改动 D-194-4；start 内部 catch DB 错误→降级 sentinel UNLINKED_TASK_RUN_ID+log warn 不阻断 §11 D4；progress/finish 对 sentinel no-op + clamp 0-100 + 吞错 log warn；DI 注入 Pool 同 AuditLogService 范式），NoopTaskRunReporter 旁立保留（降级/测试）。architecture.md §5.18 登记 task_runs schema + 索引 + 真源关系 + 应用层。**纯加性空跑兼容**（Reporter 暂无 worker 调用方、TaskAggregator 暂不读 → 零现有读路径改动、零行为变更）。门禁：migrate 102 应用 dev DB ✅ / typecheck（7 ws）EXIT=0 / lint EXIT=0 / verify:adr-contracts EXIT=0（**sql-schema-alignment 79 表含新 task_runs** ✅ / endpoint-adr 231 无新 route / mirror 2 对对齐）/ 单测 task-run-reporter 13 全过（Noop 5 + DbReporter 8：start 成功/失败降级 / progress·finish sentinel no-op / clamp 150→100 / digest JSON 落库 / 吞错）/ 集成测试 admin-task-runs 8 全过（真实 PG：list schema 对齐 + insert〔running〕→list + progress + finish〔digest JSONB 往返保形+finished_at〕+ **cancelling 中间态 CHECK 接受〔D-194-DEV-4 守卫〕** + status CHECK 拒非法值；BEGIN/ROLLBACK 零污染）/ test:changed EXIT=0。**实施级偏离**：集成测试不含 DbReporter 端到端（integration vitest config 仅解析 @resovo/types、不解析 @/api 传递依赖，既有集成测试只 import relative-path queries 无先例）→ DbReporter 由单测 8 例 mock 全覆盖、queries 层由集成测试真实 PG 验证，覆盖无缺口。**Codex stop-time review 修正（D-194-DEV-4，2 轮）**：① status CHECK 漏 cancelling（与 D-194-6 协作取消「status='cancelling' 中间态」矛盾，P2-a-C 会被拒）→ 修为 6 态 + 同步 ADR/architecture/类型 + 补回归守卫；② 就地补 102 不及已应用旧库（migrate 跳过 + CREATE IF NOT EXISTS 不 ALTER）→ **新增幂等 forward migration 103**（DROP+ADD 6 态约束）令任何库收敛，实测模拟旧库重跑 migrate 收敛 6 态。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet 建议——「继续执行 SEQ-20260609-01 序列任务 P2」持续推进授权）；子代理: 无（schema 已 ADR-194 arch-reviewer PASS 锁定，纯实施，同 P1-a-A 纯地基先例）。
      - **NTLG-P2-a-B** — bull worker 接入 reporter + TaskAggregator 投影收敛（读切换）（状态：✅ 已完成 2026-06-09）
        - 范围：选代表性 bull worker（enrichment/imageHealth）接入 `reporter.start/progress/finish` + `TaskAggregator` 副源 bull active 瞬时快照 → task_runs 持久登记（D-194-5）+ `taskrun-${id}` id 方案 + status 映射。读路径切换 + worker 写入点。
        - 依赖：NTLG-P2-a-A。建议模型：sonnet。
        - **完成备注**：ADR-194 D-194-5/8 落地（详见 changelog [NTLG-P2-a-B]）。**代表 worker 改选 maintenanceWorker**（偏离 card 括注 enrichment/imageHealth——二者逐微作业，per-job 接入淹没 task_runs + 当前不在副源快照；maintenance run 级批次 + 已在快照接它零覆盖回归 + 无持久表，ADR §影响文件候选集内，价值排序 #1 正确性裁定）。新建 `maintenanceWorker.taskrun.ts`（纯函数 `maintenanceJobTitle` / `buildMaintenanceDigest`〔10 metric 键投影〕/ 可测 `runMaintenanceJobWithReporter`〔start→finish(success+digest)/catch-finish(failed)+rethrow 保 bull 语义〕，运行时仅 type-only import 零重型依赖）+ `maintenanceWorker.ts` 模块级 DbTaskRunReporter 接入 + `TaskAggregator.ts` 副源 `fetchBullSnapshot`→`fetchTaskRuns`(listTaskRuns) + `mapTaskRun`（taskrun- 前缀 + TASK_RUN_STATUS_MAP 6→4 态 cancelled→failed/cancelling→running）+ `fetchQueueCounts`（保 bull getJobCounts 供闪电 running 计数 + Redis 降级），删 mapBullJob。门禁：typecheck/lint/verify:adr-contracts EXIT=0（mirror TaskItem↔AdminTaskItem 对齐 / endpoint-adr 231 无新 route / sql-schema 79 表）/ test:changed 20 文件 280 passed（新 maintenance-worker-taskrun 13 + task-aggregator 改写 16）/ reporter 13 + 集成 61 零回归。**已知瞬时态（-B→-C 间隙）**：maintenance 项以 `taskrun-` id 呈现、parseTaskId 暂不识别 → 控制路径 getRunById('taskrun-N')〔crawler_runs.id UUID〕报错；不在 -B 修（route 层属 -C，纳入会令 -B 跨 3 层违原子化），-C 扩分派闭环（紧邻卡无部署边界）。无 schema/type 变更，architecture.md §5.18 仅落地状态更新。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet——「继续按顺序持续推进」授权）；子代理: 无（契约 ADR-194 已锁，代表 worker 选择属候选集内实施判断）。
      - **NTLG-P2-a-C** — ADR-191 `:id` re-point + bull 协作式取消（控制路径）（状态：✅ 已完成 2026-06-09）
        - 范围：`routes/admin/tasks.ts` `parseTaskId` 扩 `taskrun-` 分派 + `AdminTaskControlTarget.kind` 扩 `'task_run'`（加性 D-194-6）+ bull worker 协作式取消改造（检查 `status='cancelling'`，解 D-191-DEV-1 的 409）。控制路径须 -B 已验证。
        - 依赖：NTLG-P2-a-B。建议模型：sonnet。
        - **完成备注**：ADR-194 D-194-6 落地（详见 changelog [NTLG-P2-a-C]）。**worker 不改**——ADR 黄线②裁定（D-194-DEV-5）：maintenance 批次 service 无 abortController → 协作式取消退回 **ADR-191 P0 的 409 诚实暴露**（status='cancelling' 写路径待 service 增 AbortSignal，schema 已预留）。-C 落 route+query 两层：① `AdminTaskControlTarget.kind` +'task_run'（加性，未镜像 admin-ui、前端零消费、不需 arch-reviewer）；② `getTaskRunById`（`/^\d+$/` 守卫防非法 `::bigint`）；③ `parseTaskId` 扩 `taskrun-` 分支（bull-→taskrun-→crawler 顺序）+ cancel（404/终态 no-op/running→409 诚实）+ retry（404/非 failed→409/run.kind→queue+run.ref bull getJob().retry()）。**闭环 -B→-C 瞬时态**（taskrun- 不再落 crawler 分支 500）。门禁：typecheck/lint/verify:adr-contracts EXIT=0（endpoint-adr 231 无新 route / mirror 2 对 / sql 79 表）/ test:changed 升全量 497 文件 6942 passed（packages/types 触发 ADR-180）/ 集成 61 零回归 / tasks-control-route 10→17。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet——「继续按顺序持续推进」授权）；子代理: 无（契约 D-194-6 已锁、加性扩 union 非新契约、worker 不改按黄线②）。
      - **NTLG-P2-a 整卡 ✅**（-A schema/queries/DbReporter 地基 + -B worker 接入/投影收敛 + -C re-point/控制路径）。task_runs 统一抽象层端到端落地：maintenance bull 作业获终态留存 + digest + 失败重试锚点，统一 AdminTaskItem 单一投影（crawler_runs ∪ task_runs 只读 union），ADR-191 D-191-DEV-1 的 :id re-point 完成。**解锁 P2 并行剩卡**：NTLG-P2-d（purge worker）/ P2-b（多渠道）/ P2-c（消息中心+SSE）。
13. **NTLG-P2-b** — 多渠道通知统一订阅（webhook 已有 / 邮件实装 / `submission.created` 补触发点）+ 通知偏好（状态：⏸️ **暂缓**，用户裁定 2026-06-10）
    - 依赖：NTLG-P1-c ✅。建议模型：sonnet。
    - **暂缓裁定（2026-06-10）**：用户决定整卡暂缓。**零核心影响论证**（调研结论沉淀，下次接手免重复）：① email 是叶子功能，无下游卡依赖——通知主链路（emit→notifications 表→SSE/红点/抽屉→已读游标）不经 email，已端到端完成（P2-c ✅）；② admin 改邮箱（ADR-140）早用「直接生效无验证邮件」方案、自洽不依赖 email；③ webhook 通道已实装可用（运营需外发可接 Slack/企微/飞书 webhook URL，email 是其替代形态）；④ 邮件配置「存而不发」是 M-SN-8 起的现状，不实装=维持现状无回归。
    - **拆卡蓝图（恢复时用）——P2-b ≠ email，建议拆 -1/-2**：
      - **P2-b 无真正「无门控可随时做」剩余项（Codex stop-review 2026-06-10 二轮核实修正——原 -1 定位有误）**：治理方案 2026-06-08 列的 3 项核实后全部不成立——① ~~清理 NotificationsTab "后端不发 webhook" 陈旧注释~~ → grep 零命中、注释已不存在（描述过时）；② ~~通知偏好~~ webhook 事件订阅维度已存在（`notification_webhook_events` opt-in subscribedEvents + NotificationsTab UI）；③ `submission.created` **webhook 触发点是孤儿 event、非无门控**——其源行为「用户投稿提交」`POST /sources/submit` **已下线**（CHG-VSR-8 / SEQ-20260601-01，不再写库、`user_submissions` 无 INSERT 入口），补触发点须**先复活用户投稿功能（产品决策，超 P2-b 范围）**；唯一可选小活 = 删该孤儿 webhook event 枚举（`packages/types/src/system.types.ts:239` + `apps/server-next/src/lib/system/webhook-api.ts:24/34`，纯清理）。**结论：P2-b 实质剩余仅 email 实装（见 -2 门控）**。
      - **P2-b-2（门控 = email 实装）**：依赖 ① 用户定 email provider（推荐 Resend）② 域名 DNS 验证（SPF/DKIM/MX，账号侧最耗时）③ 起独立 ADR 锁通道模型 5 决策〔依赖方式（**推荐 fetch Resend REST 零依赖、照 WebhookDispatcher 范式**，否决 resend SDK 触发 BLOCKER）/ 收件人模型（运营单邮箱 notification_email_to vs per-admin users.email）/ 触发范围（全部 vs danger-only vs opt-in）/ 可靠性（fire-and-forget+retry vs bull queue）/ API key 归属（env config.ts 像 BANGUMI_API_TOKEN）〕。已有可复用：NotificationEmitter emit 中枢 + KV notification_email_enabled/to + NotificationsTab UI + WebhookDispatcher 整套 fire-and-forget+retry+失败 audit 范式。新建：EmailDispatcher.ts（照 WebhookDispatcher）+ config.ts +RESEND_API_KEY/RESEND_FROM_EMAIL（.optional 降级）+ NotificationEmitter 接 email 通道 + system.email_send_failed audit。多渠道扩展（Slack/企微）须另起 ADR（governance plan §8855）。
14. **NTLG-P2-c ✅** — 「消息中心」页（全量历史 + 检索）+ 未读 SSE 实时推送（替代 60s 轮询）+ 收口 P1-c-C 3 项（状态：✅ 已完成 2026-06-09 — -ADR〔ADR-196〕/-A〔消息中心〕/-B〔SSE 双模式〕/-C〔crawler 并入 list + 红点 unread-count + F6③ deferred〕全收口；归档 F5 v1 deferred 留独立 follow-up）
    - 依赖：NTLG-P1-a ✅（+ 收口 P1-c-C 登记 3 项：crawler 移出 background lane / 红点统一 unread-count / 逐行 reads）。建议模型：opus（含 SSE 架构裁决）。
    - **Follow-up ✅ NTLG-P2-c-E2E（2026-06-10）**：admin shell 通知链路浏览器级验收（补「e2e:admin SSE 端到端验收 / 单测·集成全绿缺真实链路」）。① shell-mocks 基座补 `/admin/notifications/unread-count`（count:0）+ `/admin/notifications/stream`（503 STREAM_UNAVAILABLE → 60s 轮询 fallback，消除前端调新端点的 404 降级噪声）；② 新建 `tests/e2e/admin/notifications-shell.spec.ts` 3 用例守护 C-2 红点改读 unread-count——unread>0+全已读 list→红点显示（readAt 高水位线设未来）/ unread=0+未读项→红点隐藏（0 守卫，证由 unread-count 驱动非 list-derived；两断言在旧 list-derived 逻辑下均会失败）+ 消息中心 `/admin/messages` page-header render；③ 清 `admin-shell-notifications.ts:77` crawler_run 陈旧注释（C-1 后只走 active lane）。门禁 typecheck/lint/test:changed EXIT=0 + **e2e:admin 全套 82 passed 零回归**（含 3 新用例）。**真实 Redis SSE-push 端到端仍留 follow-up**（Playwright route.fulfill 返完整响应、不支持长连接流式 mock，需流式 mock harness）。执行模型 claude-opus-4-8；子代理 无（e2e 测试非共享组件 API 契约/非 schema/非新 route）。
    - **Follow-up ✅ NTLG-P2-c-UI-1（2026-06-10）**：通知抽屉**可见性增强**（用户裁定 2026-06-10「补一轮可见改善 → 抽屉分组 + digest 摘要」——回应「UI 看起来没改善」：治理 ~90% 是不可见后端地基，铃铛/抽屉视觉杠杆未动）。`packages/admin-ui/src/shell/notification-drawer.tsx`：① 按既有 `NotificationItem.category` 分组渲染（general=「系统通知」/ background=「后台动态」，区头含文案 + 区内计数；`undefined` 归 general 默认组；空组不渲染；general 在前；新 `data-notification-group`/`-title`/`-count` 锚点 + `NotificationGroup` 子组件控函数长度）；② `BODY_TEXT_STYLE` 解除单行截断（`whiteSpace:normal`+`wordBreak:break-word`）让采集 digest 摘要「新增 N 视频 · M 线路 · K 站点失败 · E 错误」完整显示（原 `nowrap+ellipsis` 截断）。**不改 `NotificationDrawerProps`/`types.ts` 公开 Props**（纯组件内部消费既有 category，不触模型路由红线 1/2 → 无 Opus 子代理）。门禁 typecheck/lint/test:changed 79 文件 999 passed + notification-drawer 专项 26（现有 20 + 新 6：分组顺序/区头计数/归属/undefined→general/空组不渲染/digest 完整）。**结构化 digest chips 留独立卡**（需扩 `NotificationItem.digest` 跨 4 层 + admin-ui Props 红线 + Opus + 拆卡）。执行模型 claude-opus-4-8；子代理 无。
    - **Follow-up ✅ NTLG-NTF-UNREAD-FILTER（2026-06-10）**：通知抽屉「只看未读 / 显示全部」切换（用户裁定 2026-06-10「两者都推」之轻档；回应「已读还留在抽屉」）。`notification-drawer.tsx` 加**组件内部** `unreadOnly` state + headerActions 切换按钮（`data-notification-unread-toggle` + `data-active`，激活 accent / 非激活 muted）+ 渲染按 `!read` 过滤（复用 `groupItems` 空组剔除）+ 过滤后空显示「暂无未读通知」（`data-notification-empty-unread`，区别 items=[] 的「暂无通知」）。**不改 `NotificationDrawerProps`/`types.ts`**（纯组件内部 state 复用既有 read，不触模型路由红线 → 无 Opus）。门禁 typecheck/lint/test:changed 79 文件 1003 passed + notification-drawer 专项 30（+4：默认全部/切换隐藏已读/再切恢复/全已读空态）。执行模型 claude-opus-4-8；子代理 无。
    - **NTLG-NTF-DISMISS — dismiss 软移除子系统（ADR-197 ✅ Accepted，待实施 -A/-B/-C）**：ADR-197 落档（arch-reviewer claude-opus-4-8 / agentId a2edc8aa4e6cfa1a9 → **CONDITIONAL PASS**，**纠正主循环传入 3 个事实前提偏差**：① item_key 双前缀 `bg-audit:<id>` 非 `bg-<id>`、active 是 `bg-crawler_run:` 非 `crawler_run:` → item_key 直采前端项最终 id 原值、通知/任务抽屉两套白名单不可混；② 派生项过滤只能 Service 内存 anti-set、禁 SQL 拼 `'audit:'||id` anti-join；③ clear 须前端回传可见 itemKeys 数组、多源不可单查复现）。决策 D-197-1..7：独立表 `notification_dismissals(user_id,item_key,dismissed_at)` PK(user_id,item_key) 无 FK 跨源 / item_key=前端最终 id 原值 + 可 dismiss 白名单（general `\d+` ∪ `bg-audit:` ∪ 终态 `taskrun-`；拒 upcoming/active 422 ITEM_NOT_DISMISSABLE）/ 2 端点 `POST /admin/notifications/dismiss`+`/dismiss-batch`（item_key 走 body）/ 三处抽屉排除〔general SQL NOT EXISTS、派生 Service 内存〕vs 消息中心 history 不排除 / dismiss 独立维度不隐含 read / 清理走 purge worker age N≥90d。门禁 verify:adr-contracts EXIT=0（endpoint-adr 119 ADR 端点含 dismiss 2 预登记 / D-197-1..7 识别）。docs-only。执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8 / a2edc8aa4e6cfa1a9)。**拆卡蓝图**：
      - **NTLG-NTF-DISMISS-A ✅ 已完成 2026-06-10**（schema+queries）：migration 104 `notification_dismissals(user_id UUID FK users CASCADE, item_key TEXT, dismissed_at, PK(user_id,item_key))` 无 FK 跨源（应用 dev DB ✅，80 表）+ `db/queries/notifications.ts` 3 query（insertDismissals unnest+ON CONFLICT DO NOTHING 幂等 / selectDismissedKeys 返 Set 供 Service 内存过滤 / deleteStaleDismissals age 清理）+ `buildNotificationFilter` 加可选 `excludeDismissedForUser`（→ `NOT EXISTS ... item_key=notifications.id::text`，缺省不拼〔history 不排除〕）+ architecture.md §5.17 登记。门禁 typecheck/lint/verify:adr-contracts EXIT=0（sql-schema 80 表含新表）/ 集成 admin-notifications 18（15+3：幂等/空数组 + drawer 排除·history 保留·per-user 隔离 + age 清理）/ test:changed 55 文件 798。纯数据层零 API/行为变更。执行模型 claude-opus-4-8；子代理 无（schema 已 ADR-197 PASS 锁定）。
      - **NTLG-NTF-DISMISS-B（拆 -B1/-B2，原 7 改动点 >5 → ADR-197 预留逃生口）**：
        - **-B1 ✅ 已完成 2026-06-10**（端点 + Service 写路径）：2 端点 `POST /admin/notifications/dismiss`（body itemKey）+ `/dismiss-batch`（body itemKeys[]）+ 守卫纯函数 `lib/dismiss-item-key.ts`（通知抽屉白名单 general `\d+` ∪ `bg-audit:` 可 / upcoming·active 拒）+ `NotificationService.dismiss`〔ok:false→422 ITEM_NOT_DISMISSABLE〕`/dismissBatch`〔部分成功 dismissed+skipped〕（复用 -A insertDismissals，Route 仅校验+委托守分层）+ ErrorCode `ITEM_NOT_DISMISSABLE` 登记 api-errors.ts（20 码）。门禁 typecheck/lint/verify:adr-contracts EXIT=0（**endpoint-adr 234 路由含 dismiss 2 匹配 ADR-197** / error-message ITEM_NOT_DISMISSABLE 登记）/ test:changed 升全量〔api-errors base〕503 文件 7023 passed（守卫 6 + service/端点 #d1-9）。taskrun- 终态校验归 -B2。执行模型 claude-opus-4-8；子代理 无（端点契约 ADR-197 锁定）。
        - **-B2 ✅ 已完成 2026-06-10**（通知侧读过滤）：`NotificationService.list` +`excludeDismissed?:boolean`（drawer→baseFilter 拼 `excludeDismissedForUser=userId`、history 不传）+ `routes/notifications.ts` list 端点传 `excludeDismissed: !isHistoryMode` + `BackgroundEventService.list` +`userId?` + finished audit 项 `selectDismissedKeys` 内存 anti-set 过滤（`bg-${event.id}` 比对，HIGH-1 派生项禁 SQL anti-join）+ `systemBackgroundEvents` route 传 userId。门禁 typecheck/lint/verify EXIT=0 / test:changed 46（bg-event +#7b/#7c dismiss 过滤 + notification-service 32）+ -A 集成已验 query 层 excludeDismissedForUser。**通知抽屉 dismiss 写+读闭环**（general + bg-audit 移除即生效，消息中心保留）。执行模型 claude-opus-4-8；子代理 无。**TaskAggregator/jobs/taskrun 写守卫移 -B3**（任务侧）。
        - **-B3 ✅ 已完成 2026-06-10**（任务侧 + 清理）：`taskRuns.ts` +`selectTerminalTaskRunIds`（id=ANY+status IN 终态）+ `dismiss-item-key.ts` +`parseTaskRunItemKey` + `NotificationService.dismiss/dismissBatch` 升异步守卫（general/bg-audit 同步白名单 + taskrun- 查 task_runs 终态〔success/failed/cancelled 可 / running 拒〕、批量单次查防 N+1）+ `TaskAggregator.list` +userId 终态项内存过滤（先过滤再 slice）+ `system-jobs` route 传 userId + `maintenanceWorker` purge case 接 `deleteStaleDismissals`（cutoff NOW-90d 对齐 ADMIN_ACTION_TTL_DAYS）。门禁 typecheck/lint/verify EXIT=0 / test:changed 22 文件 330（notification-service 35〔#d10-12〕+ task-aggregator 18〔#T-dismiss〕+ dismiss-item-key 6）。**任务抽屉 dismiss 写+读闭环 + dismissal 自动清理**；**dismiss 后端全完成**。selectTerminalTaskRunIds 真实 SQL 单测 mock+typecheck 覆盖（集成验证留 follow-up）。执行模型 claude-opus-4-8；子代理 无。
      - **NTLG-NTF-DISMISS-C ✅ 全完成 2026-06-10（UI，拆 -C1/-C2，arch-reviewer a489b560dbd4f2551 CONDITIONAL PASS）**：**-C2 完成备注**：task-drawer onDismiss/onClearAll + 组件内 isDismissable（`taskrun-` ∧ 终态 success/failed，与 api parseTaskRunItemKey+终态查库守卫同口径）+ 行级 action 横排容器（取消/重试/移除并排）+「清除已完成」header 按钮 + AdminShellProps 穿透 + useAdminTasks dismiss/dismissAll（复用通知侧 2 端点，item_key 跨源 D-197-1）+ shell-client wire。门禁 typecheck/lint EXIT=0 / test:changed 80 文件 1026（task-drawer +6 / hook +4 用例）。执行模型 claude-fable-5；子代理 无。**dismiss 软移除子系统端到端闭环（-A/-B1/-B2/-B3/-C1/-C2 全完成）**。**-C1 完成备注**：notification-drawer onDismiss/onClearAll + 组件内 isDismissable（`\d+` ∪ `bg-audit:` 与 api 守卫同口径）+ H-1 行容器重构（main button 保 data-notification-item 选择器零破 / read opacity 上提）+ 清空回传可见 dismissable keys（unreadOnly 所见即所清）+ AdminShellProps 穿透 + useAdminNotifications dismiss/dismissAll（乐观双 filter + 端点 + reload + catch warn + 空数组 guard）+ shell-client wire。门禁 typecheck/lint EXIT=0 / test:changed 80 文件 1029（drawer +8 / hook +4 用例）。执行模型 claude-fable-5；子代理 无。**方案 (b) 组件内部 derive dismissable → 零 types.ts 改动、不触 mirror、不需 Opus trailer**；onDismiss(itemKey)/onClearAll(itemKeys) 对齐 onCancel 范式；乐观移除+reload+catch warn（markAllRead 范式）；H-1 通知行 button-in-button 须重构（移除按钮移行外兄弟节点）。-C1 通知抽屉（无依赖）+ -C2 任务抽屉（-B3 已解锁）。
      - **NTLG-NTF-DISMISS-C**（UI，sonnet + 若动 types.ts Props 须 `Subagents: arch-reviewer` trailer，3 项）：notification-drawer/task-drawer 项级 onDismiss + 清空按钮（复用 onItemClick/onCancel 回调范式，CSS 变量零硬编码）+ admin-shell-notifications dismiss/dismissAll 接端点 + 乐观移除 + reload。
      - **follow-up（不阻塞 P3，MEDIUM-1）**：跨标签即时同步——现 SSE 仅携 unread count、dismiss 不改 unread → 走 60s 轮询/globalMutateRegistry 最终一致；即时需额外定义 drawer-refresh SSE 事件类型（独立卡）。
    - **现状实证（2026-06-09 调研）**：① **全平台无 EventSource 用法**（`new EventSource` grep 零命中）→ SSE 是全新传输；② admin auth = **Bearer token**（`authenticate.ts:extractBearerToken` 读 Authorization header）→ 浏览器原生 EventSource **无法设 header** → 鉴权 fork；③ 部署 = **长驻 Node 服务**（`node src/server.ts` 非 serverless）→ SSE 长连接可行；④ emit 发生在 API 服务 + **独立 worker 进程**（crawlerWorker digest）→ 进程内事件总线不可行 → 跨进程推送 fork；⑤ schema **无归档列**；broadcast/role 通知「归档语义」（per-user vs 全局）非平凡；⑥ 现 `admin-shell-notifications.ts` 60s `setInterval` 轮询（POLL_INTERVAL_MS=60_000）；3 路由（list/unread-count/read）。
    - **拆卡蓝图**：
      - **NTLG-P2-c-ADR** — SSE 实时推送 + 消息中心契约 + 归档语义 ADR（状态：✅ 已完成 2026-06-09 — ADR-196 Accepted）。**完成备注**：ADR-196 Accepted（arch-reviewer claude-opus-4-8 / ae216f569ae577648 → CONDITIONAL PASS → 2 红线〔D-196-2 worker 同进程事实更正→多实例连接亲和性论据 / D-196-7 端点契约表 4 列 bold→标准 7 列范式，verify-endpoint-adr 识别 116→117〕+ 4 黄线〔crawler 并入成对移除 BackgroundEventService 派生 / keyset 命中 scope_created_at 索引 / SSE 共享 subscribe+内存连接表+metric+Redis-down 降级 / `/stream` 鉴权 admin+moderator〕+ 1 分层项〔NotificationStreamService〕全处置）。F1 fetch-stream / F2 Redis pub/sub / F3 /stream 直连+共享 subscribe / F4 扩展 list / F5 **归档 v1 deferred（用户裁定）** / F6 收口 3 项。门禁 verify:adr-contracts EXIT=0。docs-only。执行模型 opus；子代理 arch-reviewer (claude-opus-4-8 / ae216f569ae577648)。锁以下 fork（ADR-196 已定版）：
        - **F1 SSE 传输/鉴权**：推荐 **fetch-based ReadableStream**（可设 Authorization Bearer + 手动重连退避）；否决原生 EventSource（无法设 header → 逼 cookie 鉴权基建变更 / query-token 安全风险）。
        - **F2 跨进程推送机制**：推荐 **Redis pub/sub**（NotificationEmitter emit 时 publish 轻量信号 → SSE 端点 subscribe → push「重算 unread」tick；bull 已有 Redis）；否决进程内事件总线（worker 独立进程不可见）。
        - **F3 拓扑**：推荐 **浏览器 fetch-stream → API `/admin/notifications/stream`（新 SSE 路由，text/event-stream）直连**（本 ADR 兼作其端点 ADR）；否决 BFF 代理长连接（多一跳 + BFF 持连复杂度）。事件载荷最小化（`{ unreadCount }` 或 tick 触发客户端 refetch）+ 心跳 keep-alive。
        - **F4 消息中心读契约**：推荐**扩展现 `GET /admin/notifications`**（加 cursor 分页 + q 检索 + level/type/date/read 过滤，加性无新 route）；否决新建 `/admin/messages`（重复）。
        - **F5 归档语义**：broadcast/role 非 per-user 行 → 归档「对谁」非平凡。待 ADR 裁（per-user 归档表似 notification_reads / 全局 archived_at 列 migration 104 / 视图层 only 三选一）。
        - **F6 收口 P1-c-C 3 项**：crawler 移出 background lane（统一进 list）/ 红点改读 unread-count（替 list-derived，BLOCKER-1 回填）/ 定向 scope 逐行 reads 激活（D-192-DEV-1/4）。
        - 依赖：P1-a ✅。建议模型：opus（+ arch-reviewer）。
      - **NTLG-P2-c-A 整卡 ✅**（-A-1 后端 list 扩展 + -A-2 前端消息中心页）——消息中心历史+检索端到端（cursor 分页 + q/level/readState 过滤）。**拆卡（api-service + UI + >5 项）**：
        - **NTLG-P2-c-A-1** — list 端点后端扩展（buildNotificationFilter +until/q/levels/types/readState + listNotifications keyset cursor 分页 + service/route/meta.nextCursor）。状态：✅ 已完成 2026-06-09。依赖 D-196-4 ✅。建议模型：sonnet。**完成备注**：扩展现 `GET /admin/notifications` 加性向后兼容（详见 changelog [NTLG-P2-c-A-1]）。buildNotificationFilter 共享扩 until/q〔ILIKE 转义防通配〕/levels/types/readState + listNotifications keyset 分页（`(created_at,id)<游标` + ORDER created_at DESC,id DESC 稳定）+ service nextCursor〔readState 双路径保既有并行 query 顺序〕+ route cursor base64url 编解码 + history 模式无默认 7d 窗 + meta.nextCursor。门禁全绿（test:changed 795 / 集成 14→15 / 既有 19 测零破）。无 schema。执行模型 opus；子代理 无。
        - **NTLG-P2-c-A-2** — server-next 消息中心 admin 页（DataTable 消费扩展后 list + 检索/过滤 UI + 分页）。状态：✅ 已完成 2026-06-09。依赖 -A-1。建议模型：sonnet。**完成备注**：cursor-stack 适配 DataTable（用户裁定）——DataTable 渲染表格 + 隐藏内置 pager（pagination.hidden）+ 外置 AdminInput/AdminSelect 过滤（q/level/readState）+ cursor-stack prev/next。新建 lib/messages/api.ts + app/admin/messages/{page,_client/MessageCenterClient,_client/MessageColumns} + admin-nav 加「消息中心」入口。date/type 过滤延后（无 date primitive / AdminNotificationItem 无 type 触 mirror）。门禁 typecheck/lint/verify/test:changed EXIT=0（messages 6 测）；DataTable 用法源码核实运行时安全（mode=server 直渲 + pagination.hidden 不渲 foot）；e2e:admin 推荐作 render 验证 follow-up。执行模型 opus；子代理 无。**设计 fork（A-1 落地后发现，已裁决 cursor-stack 适配）**：admin-ui DataTable 用 **page/pageSize 偏移分页**（`PaginationConfig` + `query.pagination` page/totalPages，`data-table/types.ts:167`），但 A-1 后端按 ADR-196 D-196-4 实现 **cursor/keyset 分页**（不透明 nextCursor，无 total-page 概念）→ 阻抗不匹配。**裁决项**：① cursor-stack 适配 DataTable（维护游标栈供 prev/next、用 meta.total 显计数、禁随机跳页）；② 自定义 cursor 友好列表视图（prev/next 或 load-more，不强用 DataTable page-pagination）。建议 ② 或 ①——cursor 对 live 数据更正确（无跳行/重复），DataTable page-pagination 为静态数据设计；A-2 起手须先定此 + 配 i18n（zh-CN messages）+ 侧边栏 nav 注册 + 组件/e2e 测试。
      - **NTLG-P2-c-B 整卡 ✅**（-B-1 后端 SSE 基建 + -B-2 前端 fetch-stream + 双模式）——未读实时推送端到端落地（emit→Redis publish→subscribe fan-out→SSE→前端 reload→红点〔list-derived〕实时更新；SSE 断→60s 轮询 fallback）。依赖 -ADR（F1/F2/F3）。建议模型：sonnet（架构已 ADR 锁）。**拆卡（>5 项 + 跨 api-service/UI）→ -B-1（后端）/ -B-2（前端）**：
        - **NTLG-P2-c-B-1** — SSE 后端基建。状态：✅ 已完成 2026-06-09。建议模型：sonnet。**完成备注**：`lib/notification-pubsub`（channel 常量 + `publishNotificationChanged` fire-and-forget + codec 防御）+ `NotificationStreamService`（内存连接表 `Map<scope,Set>` + 单实例共享 `redis.duplicate()` subscribe〔非每连接 duplicate 黄线 3〕+ onSignal scope fan-out 重算 unread + 25s 单 timer 心跳 unref + connectionCount metric + isAtCapacity 软上限 500 + isAvailable Redis-down 降级 + init try/catch 不阻塞 route 注册 + shutdown；`StreamSink` 抽象解耦 Fastify）+ `GET /admin/notifications/stream`（hijack + text/event-stream，503 STREAM_UNAVAILABLE/AT_CAPACITY 降级，route 仅 auth+建流+委托守分层）+ `NotificationEmitter.emit` 写库成功 `.then` publish（scope 同源）。ADR-196 +§错误码（503 两码）+ D-196-DEV-4。门禁 typecheck/lint/verify（endpoint-adr 117 含 /stream / error-message 我 2 条已清 / mirror 2 对）EXIT=0；test:changed 全量升级（改 setup.ts 触 ADR-180）6980/6981〔1 admin-ui matrix flaky 隔离全过证无关〕。新增 3 测试文件（pubsub 6 + stream-service 15 + emitter +3）。无 schema/新依赖。执行模型 claude-opus-4-8；子代理 无。**剩 -B-2**（前端 fetch-stream + 轮询 fallback）。
        - **NTLG-P2-c-B-2** — 前端 fetch-stream 客户端 + admin-shell SSE 优先 + 60s 轮询 fallback 双模式。状态：✅ 已完成 2026-06-09。依赖 -B-1。建议模型：sonnet。**完成备注**：`lib/notification-stream-client`（纯解析 parseSSEEvent/parseUnreadCount + connectNotificationStream：fetch 携 Bearer〔非 EventSource〕直连 /stream + ReadableStream/TextDecoder 增量解析 + `unread`→onUnread + 指数退避重连 1s→cap 30s + onStateChange + close 中止；deps 注入 fetch/token/baseUrl/backoff 供测）+ `useAdminNotifications` SSE 双模式（onUnread→reload 实时 / onStateChange→sseConnected / 仅 !sseConnected 起 60s 轮询 fallback 不删轮询）+ `api-client` export API_BASE_URL 防漂移。**红点保 list-derived**（SSE 作 reload 触发器，F6② 红点→unread-count 归 C，零依赖 C）；useAdminTasks 不接 SSE（边界④）。门禁 typecheck/lint/verify EXIT=0；test:changed 90 文件 1075 passed（client 12 新 + hook 12 恢复〔+mock SSE no-op〕）。无 schema/新依赖。**e2e:admin SSE 留 follow-up**。执行模型 claude-opus-4-8；子代理 无。**FIX（Codex stop-review）**：`markAllRead` read 游标变更对称 publish `user:<id>` 信号（ADR-196 D-196-DEV-5）——补全「SSE 携带全部未读计数变更」不变量，使「SSE 连通停轮询」对跨标签页/设备 read 同步安全（purge 计数中性无需 publish）。
      - **NTLG-P2-c-C ✅** — 收口 P1-c-C 3 项（归档 F5 已 v1 deferred / D-196-DEV-1，本卡不做）。状态：✅ 已完成 2026-06-09（-C-1 F6①③ + -C-2 F6②）。**拆 -C-1/-C-2**（跨 api-service〔F6①〕+ admin-ui 共享 Props〔F6②〕+ server-next UI〔F6②〕**3 层** + F6② 触 `admin-shell.tsx:175` 红点逻辑 → 改 `packages/admin-ui/src/shell/types.ts` 公开 Props **强制 arch-reviewer Opus 子代理** → 原子化红线必拆）。依赖 -ADR + -A。
        - **NTLG-P2-c-C-1** — F6① crawler 并入 notifications list（成对移除 BackgroundEventService finished crawler 派生）+ F6③ 确认 deferred。状态：✅ 已完成 2026-06-09。建议模型：sonnet；执行模型 opus（人工覆盖）。**完成备注**：F6① 成对落地（黄线1 / D-196-5①）——沉淀 `CRAWLER_SOURCE_KIND='crawler'` 常量（crawlerWorker.notifications.ts，emit 写侧引用替字面量，对称 `ADMIN_ACTION_SOURCE_KIND` 防漂移）+ `NotificationService.GENERAL_LANE_SOURCE_KINDS` 由 `[admin_action]` 扩 `[admin_action, crawler]` + `BackgroundEventService.list` 删 finished crawler_run 派生（D）+ 死代码 `buildRunDigest`（保 audit 高危 E〔crawler.freeze 与白名单互斥〕+ active lane C + upcoming A/B）+ `TaskAggregator.ts` 注释悬空引用清理（删除连带）。**前端零改动**（crawler 完成改从 general list 来、background-events 不再产 finished crawler → merged 不重复；id 变 notifications 表 id 不影响功能，readIds ephemeral + readAt 时间高水位线不依赖 id）。F6③：grep 实证 v1 全部 emit `scope='broadcast'`（无 role:/user: 定向写入点）→ D-196-DEV-2 解除条件未满足 → 继续 deferred，零代码。ADR-196 +D-196-DEV-6。门禁：typecheck/lint/verify:adr-contracts EXIT=0（endpoint-adr 232 路由/117 端点、mirror 2 对、sql-schema 79 表全对齐；error-message 195 advisory 未增）/ test:changed 21 文件 309 passed（background-event 12 重写〔#5 移除验证 / #8 id / #10 排序 / #12 一次调用〕+ notification-service 23〔#8 allowlist=[admin_action,crawler] + #8b crawler 直映〕+ crawler-worker-notifications 7）。无 schema/新端点/新依赖 → architecture.md 零同步。子代理：无（api 内部常量非共享组件 API 契约）。**剩 -C-2**（F6② 红点改 unread-count，需 arch-reviewer Opus 子代理改 admin-ui shell Props）。
        - **NTLG-P2-c-C-2** — F6② 红点改读 unread-count（替 list-derived BLOCKER-1 回填）。状态：✅ 已完成 2026-06-09。执行模型 opus；**子代理 arch-reviewer (claude-opus-4-8 / agentId a1d037f0474f41036) CONDITIONAL PASS → 3 必做修订全吸收**。**完成备注**：解 BLOCKER-1——`AdminShellProps` +`notificationUnreadCount?: number`（对称 `runningTaskCount`，消费方传数字、shell 派生）；`notificationDotVisible` 改「`!== undefined ? count>0 : 回退 some(!read)`」（**0 守卫**：count=0 红点隐藏不回退，修正 upcoming 永亮缺陷）；server-next `useAdminNotifications` +`unreadCount`（SSE `onUnread(count)` 实时直驱 + unread-count 端点 reload 第三路 allSettled，覆盖初始/60s 轮询 fallback/markAllRead 后刷新）；admin-shell-client wire。**topbar 不改**（保 dot 语义，本卡仅数据源不引数字 badge）。**mirror 未触发**（AdminShellProps 不在 NotificationItem/TaskItem 比对对；复用既有 AdminNotificationUnreadCountResponse DTO，packages/types 零改）。ADR-196 +D-196-DEV-7。门禁：typecheck/lint/verify:adr-contracts EXIT=0（mirror 2 对仍对齐）/ test:changed 78 文件 981 passed（admin-shell 23〔红点 3 含 0 守卫〕+ hook 14〔#11 端点 + #12 SSE count〕+ 全部 admin-ui shell 消费方零回归）。commit 带 `Subagents: arch-reviewer` trailer（admin-ui 公开 Props 红线）。**NTLG-P2-c-C 整卡 ✅**（-C-1 F6①③ + -C-2 F6②）。**NTLG-P2-c 整卡 ✅**（消息中心 + SSE 实时推送 + 收口 P1-c-C 端到端）。**需 arch-reviewer Opus 子代理**（设计 admin-ui shell 红点 Props 契约扩展：`admin-shell.tsx:175` `notificationDotVisible = notifications.some(!read)` 改 unread-count 数字驱动 + 向后兼容 + commit `Subagents:` trailer）+ server-next `useAdminNotifications` 新增 `unreadCount`（unread-count 端点初始/轮询 + SSE `onUnread(count)` 实时）+ admin-shell-client wire。依赖 **-C-1**（crawler 进新表后 unread-count 才含 crawler，bell↔drawer 一致）。建议模型：sonnet 主循环 + Opus 子代理设计 Props。
15. **NTLG-P2-d** — 维护 worker 清理 `expires_at` 过期通知 + TTL 策略注入（状态：✅ 已完成 2026-06-09 — -A/-B 两子卡全收口；过期通知治理端到端，ADR-195 全 5 决策闭环）
    - 依赖：NTLG-ADR-P2（ADR-195）。建议模型：sonnet。
    - **拆卡判据**：purge 机制（D-195-4）+ TTL 策略注入（D-195-1 + 黄线①）合并跨 4 层违原子化 → 拆 -A/-B（两决策独立、不同层）。
    - **NTLG-P2-d-A** — purge-expired-notifications worker 机制（D-195-4）（状态：✅ 已完成 2026-06-09）
      - 范围：`deleteExpiredNotifications`（queries）+ maintenanceWorker job type `'purge-expired-notifications'` + scheduler 24h tick（避 early-return 陷阱黄线③）。物理删除 `expires_at IS NOT NULL AND <= NOW()`，FK CASCADE 级联 reads。镜像 ADR-188 purge-external-fetch-log 范式。
      - 依赖：ADR-195 ✅。建议模型：sonnet。
      - **完成备注**：ADR-195 D-195-4 落地（详见 changelog [NTLG-P2-d-A]）。`deleteExpiredNotifications`（DELETE WHERE expires_at IS NOT NULL AND <= NOW()，NULL 永不删=D-192-5 补集）+ maintenanceWorker `'purge-expired-notifications'` case（switch+JOB_TITLE 双穷尽性守卫，返 {deleted}→-B digest 自动「已删除 N」）+ scheduler 24h tick **末尾注册避 early-return 陷阱**（黄线③，前序 if(xTimer)return 首次全 null 穿透 / 中段插入会被短路，注释警示）。**现状无人设 expires_at → purge 暂 ready infra（NULL 永不删），待 -B TTL 注入激活**。门禁：typecheck/lint/verify:adr-contracts EXIT=0（endpoint-adr 231 无新 route D-195-5 / sql 79 表无新表 / mirror 2 对）/ test:changed 56 文件 803 passed / 集成 admin-notifications 13→14（新增真 PG 口径：过期删/NULL 不删/未来不删 + FK CASCADE reads 级联验证）。无 schema 变更（复用 migration 100 + FK CASCADE）。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet——「继续按顺序持续推进」授权）；子代理: 无（D-195-4 已 arch-reviewer PASS，纯实施镜像 ADR-188 范式）。
    - **NTLG-P2-d-B** — admin_action per-type TTL 策略注入（D-195-1 + 黄线①）（状态：✅ 已完成 2026-06-09）
      - 范围：emit 层 type→days TTL 策略表 + NotificationEmitter 注入（未显式传 expiresAt 时按 type 策略计算）。**黄线① 必做**：admin_action 显式配 ≥90 天（防默认 30 天落空运营追溯）；NULL=永久按需。
      - 依赖：NTLG-P2-d-A。建议模型：sonnet。
      - **完成备注**：ADR-195 D-195-1 + 黄线① 落地（详见 changelog [NTLG-P2-d-B]）。新建 `notification-ttl-policy.ts`（默认 30d / **admin_action 8 类 90d**——从 NOTIFICATION_ACTION_TYPES 真源派生防漂移满足黄线① / crawler 30d / null=永久预留 P2-c）+ `resolveNotificationExpiresAt`（`type in MAP` 区分无条目→默认 vs null→永久）+ NotificationEmitter.emit 注入（`input.expiresAt ?? resolve(type)`，显式优先逃生口）。**行为变更**：emit 现注入 TTL → 通知到期被 P2-d-A purge（audit_log 永久合规真源不受影响 ADR-192 D-192-1）。循环 type-only 安全。门禁：typecheck/lint/verify:adr-contracts EXIT=0 / test:changed 55 文件 778 passed（emit 相关全过零破）/ 集成 62。无 schema 变更。执行模型: claude-opus-4-8（人工 opus 覆盖 sonnet——「持续推进」+ AskUserQuestion 选定）；子代理: 无（D-195-1 + 黄线① 已 arch-reviewer 锁，纯实施）。
    - **NTLG-P2-d 整卡 ✅**（-A purge 机制 + -B TTL 注入激活）。过期通知治理端到端：emit 注入 TTL + daily worker 物理清理 + FK CASCADE，表不再无界增长。**ADR-195 全 5 决策落地闭环**。

---

## [SEQ-20260610-01] 首次文档治理（T1 · doc-governance 规范首跑，用户指令插队）

- **状态**：✅ 已完成（1/1 卡收口 2026-06-10 12:30；活区断链 20+2 处清零 / frontmatter 38 文件补齐 / verify:docs-format 63→25 项〔活区清零〕）
- **创建时间**：2026-06-10 12:19
- **最后更新时间**：2026-06-10 12:30
- **目标**：按 `docs/rules/doc-governance.md` 触发器 T1 执行首次全量治理：活区反引号路径断链 20 处（目标均已归档但引用未改址）修复改指 archive 新路径；活区 frontmatter 存量缺失（§7 已知遗留，manual/ + rules/ + tracks.md）补齐；R1/R2 复扫 + verify 三件套收尾。
- **范围**：仅 `docs/**` + 仓库根 `CLAUDE.md`（纯文档，零代码改动）。本序列明确标注"更新文档"。
- **依赖**：无 BLOCKER；SEQ-20260609-01 P3 已收口 ✅。
- **先例**：SEQ-20260605-02（CHORE-DOCS-CLEANUP-20260605）同范式；本次为 doc-governance.md 规范落盘后首跑。

### 任务列表

1. **CHORE-DOCS-CLEANUP-20260610** — 活区断链修复 + frontmatter 存量补齐 + 引用健康收尾（状态：✅ 已完成）
   - 创建时间：2026-06-10 12:19
   - 实际开始：2026-06-10 12:19 ｜ 完成时间：2026-06-10 12:30
   - 建议模型：haiku（引用修复 + 模板补齐事务性工作；实际 claude-fable-5，用户会话人工覆盖）
   - 完成备注：3 项全交付，明细见 changelog [CHORE-DOCS-CLEANUP-20260610]。① R2 断链 20 处全修（decisions.md 12 唯一路径仅改路径 / architecture 1 / server_next_plan 3〔含 docs/CLAUDE.md→根 CLAUDE.md 勘误〕/ ui-rules 2 / source-health 方案 1 / CLAUDE.md 1）+ R1 追加 2 处（server_next_plan companion → archive/2026Q2/admin-v1/）；② frontmatter 活区补齐 38 文件（manual 33 + rules 4 + tracks.md，纯增量；archive 内 24 项按 §6 只读不修登记残留）；③ R1/R2 复扫清零 + verify:adr-contracts EXIT=0 + verify:manual-coverage EXIT=0。残留 6 项与 §7 断链计数（第 1 次 ≥3 处）登记于 changelog。子代理偏离 1 项（doc-janitor 误改 manual/README source_of_truth）已回退。执行模型: claude-fable-5（建议 haiku，用户会话人工覆盖）；子代理: doc-janitor (claude-haiku-4-5-20251001)。

---

## [SEQ-20260610-02] 视频/线路/站点健康度与反馈闭环（source-health v2 方案落地）

- **状态**：🔄 执行中（15/17 卡完成（母卡拆分 16→17）：**Phase 1 ✅ + Phase 2 ✅ + Phase 3 本轮可执行范围全收口 ✅（P3-3 三卡 + P3-1，D3+D4 闭环）**；**P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算，最早 ~2026-06-17 后启动）本轮阻塞**，P3-4 随评分项顺延）
- **创建时间**：2026-06-10 12:53
- **最后更新时间**：2026-06-10 22:40
- **目标**：落地 `docs/designs/source-health-feedback-loop-plan_20260610.md` v2（两轮独立审核有条件通过，必修全吸收，commit 88893812）：修复「全部探测/试播后状态不更新」三处可见断点（B1/B2/B3）→ 打通反馈闭环（F1–F4）→ 评分进化 + 站点/主机桥接（D3/D4）。
- **范围**：apps/api（service/queries/routes/lib）+ apps/worker（jobs/lib）+ apps/server-next（sources/videos 模块 UI）+ apps/web-next（PlayerShell）+ packages（media-probe 新包，P1-3）。**方案 §3 为各卡内容真源，§4 为门禁真源**；卡面只记验收口径与文件范围。
- **依赖**：无 BLOCKER；方案 v2 已批准（用户 2026-06-10）。
- **用户裁定**：批准开始 v2 拆卡开发（2026-06-10）。
- **拆卡判据执行**：P1-1 跨 SQL+route+UI 三层 → 拆 -A/-B（§8 C6）；P2-4 范围 6 项 > 5 → 拆 -A/-B；P3-3 内部 schema 先行 → 拆 -A/-B。Phase 1 交付顺序 P1-4 → P1-2 首交付（§8 C6：用户报告的「不更新」最可能对应 B3/B2）。

### 任务列表（Phase 1 — 修可见断点，无 schema 变更）

1. **SRCHEALTH-P1-4** — sources 页探测完成后外层聚合行联动刷新（B3）（状态：✅ 已完成 2026-06-10 13:10）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 12:53 ｜ 完成时间：2026-06-10 13:10
   - 验收口径：在 `/admin/sources` 行展开区点「全部探测/全部试播/单集探测/试播」成功后，外层行的 probe/render 聚合展示与服务端一致（联动 refetch，不需手动刷新）。
   - 文件范围：`apps/server-next/src/app/admin/sources/_client/SourceLinesExpand.tsx`、`SourcesClient.tsx`。
   - 依赖：无。建议模型：sonnet。
   - **完成备注**：镜像 CHG-358 审核台范式落地。① `SourceLinesExpandProps` 增可选 `onSourceHealthChanged`（JSDoc 锁口径：probe/render 单集+批量 success 触发；toggle/disableDead 不触发——非 B3 探测口径，与审核台一致）；`handleActionResult` 4 分支 success 调用 + useCallback 依赖补全。② `SourcesClient.renderExpandedRow` 传 `refresh`（与行操作列「刷新」同源 setRetryKey——保持当前页/筛选，展开态 expandedKeys 按 videoId 不丢；不需 api.ts 单行取数，整列表 refresh 范式已被行操作使用，一致性优先）。共享层沉淀：否——触发点本在消费方 handleActionResult，`@resovo/admin-ui` LinesPanel 零改动。门禁：typecheck/lint EXIT=0 / 单测新增 1 用例（展开→全部探测成功→listVideoGroups 重拉）SourcesClient 11/11 / test:changed 13 passed / **e2e:admin 82/82 EXIT=0**。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖——「批准开始 v2 拆卡准备开发」持续推进授权）；子代理: 无。
2. **SRCHEALTH-P1-2** — 手动探测后同步重算视频聚合状态（B2）（状态：✅ 已完成 2026-06-10 13:20）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 13:13 ｜ 完成时间：2026-06-10 13:20
   - 验收口径：`SourceProbeService` 手动探测（单源/batch）完成后 `videos.source_check_status` 立即与 `video_sources` 现状一致（不再等 6h cron）。
   - 文件范围：`apps/api/src/lib/source-check-status.ts`（新）、`apps/api/src/db/queries/video_sources.ts`、`apps/api/src/services/SourceProbeService.ts`、`apps/worker/src/jobs/source-health/aggregate-source-check-status.ts`（注释）。
   - 依赖：无。建议模型：sonnet。
   - **完成备注**：① `lib/source-check-status.ts` 新建 `computeCheckStatus` 纯函数（worker 并行真源，ADR-107 §4 禁跨 app import → 双副本 + 双向同步注释，auto-retire SQL 先例；**一致性由 85 组全组合对拍单测守卫**，单侧改语义即失败）。② queries `listActiveProbeStatuses`（WHERE 口径与 worker 聚合输入一致）；UPDATE 复用既有 `updateVideoSourceCheckStatus`（videos.status.ts 已 609 行超限不增量）。③ Service `recomputeVideoCheckStatus` 私有方法：probeOne/batchProbe 完成后调用；**render-check 路径不调**（render_status 不进聚合输入，跳过为正确性等价）；失败 catch+warn 不阻断已完成的探测响应（worker cron 兜底）；Q1 裁决 Service 内直算无 advisory-lock（与 worker 并发 last-write-wins 最终一致）。**新发现登记**：`source_check_status` 存在两套语义并存——worker/本卡按 probe_status 聚合 vs `videos.status.ts syncSourceCheckStatusFromSources/bulkSync`（补源/验源路径）按 is_active 聚合，交替覆盖同一字段；收敛裁决留 P1 收口复盘（候选独立卡）。门禁：typecheck/lint EXIT=0 / 新测试 9/9（含对拍 85 组）/ 既有 audit 测试 11/11 零回归 / test:changed 24 文件 277 passed / e2e:admin 82/82 EXIT=0。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
3. **SRCHEALTH-P1-1-A** — videos 列表 API 补 probe/render 聚合字段（B1 后端）（状态：✅ 已完成 2026-06-10 13:33）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 13:22 ｜ 完成时间：2026-06-10 13:33
   - 验收口径：`/admin/videos` 列表响应含视频级 probe/render 聚合字段（probe 复用 `source_check_status`，render 新增聚合表达式），支持排序。
   - 文件范围：`apps/api/src/db/queries/videos.ts`、`apps/api/src/routes/admin/videos.ts`（加性扩展，无新 route，verify:endpoint-adr 不触发）。
   - 依赖：P1-2 ✅。建议模型：sonnet。
   - **完成备注**：① `listAdminVideos` SELECT 增 `render_check_status` 聚合子查询（CASE 语义与 computeCheckStatus 同构：all pending→pending〔含空集，与 probe 字段 DB 默认对称〕/all dead→all_dead/all ok→ok/else partial；输入口径 is_active+未删除与 worker 一致）；probe 维度 `v.source_check_status` 已在 VIDEO_FULL_SELECT 直通无需新增。② 排序：queries SORT_FIELD_WHITELIST + route zod SORT_FIELDS 双白名单同步加 `source_check_status`（列直通）/`render_check_status`（SELECT alias，同 source_health 先例）。**Codex stop-time review 拦截 1 处**：初版漏改 route zod SORT_FIELDS → 新 sortField 422 被拒，已修复并复跑全部门禁。**登记**：videos.ts 503→516 行（存量超 500 红线；本卡为既有函数内最小增量非新概念，拆分留独立重构卡）。门禁：typecheck/lint EXIT=0 / admin-video-list 4/4（新增 1 用例断言聚合 SQL + 双排序路径）/ test:changed 978 passed / e2e:admin 82/82（zod 修复后复跑）。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无（Codex stop-time review 为 hook 自动触发）。
4. **SRCHEALTH-P1-1-B** — VideoColumns 探测列接真数据（B1 前端）（状态：✅ 已完成 2026-06-10 13:50）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 13:35 ｜ 完成时间：2026-06-10 13:50
   - 验收口径：`/admin/videos`「探测/播放」列展示真实聚合双信号（不再硬编码 unknown），排序可用。
   - 文件范围（开工/review 修正后）：`VideoColumns.tsx`、`VideoFilterFields.tsx`、`lib/videos/types.ts`、`lib/videos/columns.ts` + 单测。
   - 依赖：SRCHEALTH-P1-1-A ✅。建议模型：sonnet。
   - **完成备注**：① probe 列占位 cell → `checkStatusToSignal` 四态映射（pending/ok/partial/all_dead → DualSignal 五态，缺失→unknown）双字段真数据 + `enableSorting: true`。② 排序链 4 处同步：VideoFilterFields 白名单 +2 / COMPOSITE_SORT_MAP `probe→source_check_status`（双信号列排序取探测主信号）/ `VideoListFilter.sortField` union +2（**diagnostics 拦截**：初版漏同步致类型错误）/ columns.ts descriptors probe `enableSorting: true`（**Codex stop-time review 拦截**：descriptors 与 buildVideoColumns 不一致致排序指示符状态漂移）。③ 行类型 +`render_check_status?`。**登记**：columns.ts `VIDEO_SORT_FIELDS` 为零消费方死导出（候选清理项，范围外不动）。**B1 收口 = 用户报「探测/试播状态不更新」三根因 B1/B2/B3 全部修复**。门禁：typecheck/lint EXIT=0 / VideoColumns 31/31（新增 5 用例含 descriptors 对齐防漂移守卫）/ test:changed 73 passed / e2e:admin 82/82（descriptors 修复后复跑）。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无（Codex stop-time review 为 hook 自动触发）。
5. **SRCHEALTH-P1-5** — feedback recheck 定向化（F2）（状态：✅ 已完成 2026-06-10 13:55）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 13:52 ｜ 完成时间：2026-06-10 13:55
   - 验收口径：feedback recheck 对信号源先 level1 定向重探、再 level2 定向重测；每个信号源均被真实重测后才标 processed。
   - 文件范围：`apps/worker/src/jobs/feedback-driven-recheck.ts`、`apps/worker/src/jobs/source-health/{level1-probe,level2-render}.ts`。
   - 依赖：无。建议模型：sonnet。
   - **完成备注**：① level1-probe +`loadSourcesByIds`（口径同 loadActiveSources + id 过滤）。② level2 `runLevel2Render` 增可选 `{ sourceIds }` 定向分支（省略 → cron 全局行为不变；定向 SQL 保留 `probe_status='ok'` 守卫——recheck 已先跑 level1，probe dead 源连不通无需 render 重测）。③ recheck 编排重写：信号源去重 → level1 定向重探（probe 真相刷新，消 F2-①「probe dead 静默丢信号」）→ aggregateBatch 受影响视频（与 cron 路径同步骤）→ render 重置 pending → level2 定向（消 F2-②「全局 100 条与信号脱钩」）→ 标 processed（语义成立：每源已真实重测，重测仍 dead = 确认失效）。④ 新编排测试 4 用例（定向参数/去重/NULL 信号/空源降级）。⑤ **Codex stop-time review 第 3 次拦截（收口后修复 fix commit）**：render 重置原对全部信号源执行，probe dead 源（level2 守卫排除不重测）的 render 真相被洗成 stale 'pending'——抬高 effective_score（pending 0.3 > dead 0.0，render 权重 0.6）且阻碍 auto-retire 双 dead 判定；修复 = 重置 SQL 加 `AND probe_status = 'ok'`（FIX-1）+ 二轮拦截补 `is_active = true AND deleted_at IS NULL`（FIX-2，停用/软删源 probe 旧值可为 ok 同样会滞留）。**不变式（测试锁定）：render 重置集合 ⊆ level2 定向重测集合，重置谓词与 loadLevel2Candidates 定向分支逐条对齐**。注：该缺陷在旧实现即存在（重置不过滤 + 全局 candidates 同守卫），本卡重写时被继承后由 review 拦截关闭。worker 改动无对应 e2e 域（ADR-180 域选跑）。门禁：typecheck/lint EXIT=0 / 新测 4/4 + source-health 既有 24/24 / test:changed 通过（修复后复跑）。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无（Codex stop-time review 为 hook 自动触发）。
   - **Phase 1 主线（5 卡）全部收口 ✅ 2026-06-10**。下一步：P1-3 独立卡（前置 Opus 裁决 packages/media-probe 导出面）或 Phase 1 收口复盘（两套聚合语义并存收敛 + videos.ts 拆分 + 排序白名单 4 处收敛三个候选项裁决）。

### 任务列表（P1-3 独立卡 — 共享解析包）

6. **SRCHEALTH-P1-3** — `packages/media-probe` 共享解析包 + 手动试播升级（D1/D2）（状态：✅ 已完成 2026-06-10 16:45）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 14:05 ｜ 完成时间：2026-06-10 16:45
   - 验收口径：admin 手动「试播」走 manifest 真解析（m3u8/moov/mpd）且支持 partial；worker 与 api 消费同一 `packages/media-probe`，双副本消除。
   - 文件范围（开工/实施修正：queue 登记 `parsers.ts` 实为 `parsers/` 目录；Opus 裁决补漏 + partial 契约波及增补，见 tasks.md 卡片）：`packages/media-probe/`（新建 6 文件）、worker（`lib/parsers/` 删除 + level1-probe/level2-render import + types.ts re-export + package.json/tsconfig）、api（SourceProbeService + video_sources queries + tsconfig）、server-next（lib/sources api.ts/types.ts + SourceLinesExpand/LinesPanel toast partial 分桶）、根 package.json workspaces + vitest alias、测试迁 `tests/unit/packages/media-probe/`。
   - 依赖：Phase 1 主线（1–5）完成后启动。**前置强制**：spawn Opus 子代理裁决包导出面（共享组件 API 契约，CLAUDE.md 模型路由）。建议模型：sonnet（+Opus 子代理）。
   - 门禁：独立验收 typecheck / lint / worker 测试 / API service 测试 + 双端替换回归（方案 §3 P1-3）。
   - **完成备注**：① 包导出面 = **arch-reviewer (claude-opus-4-8) 裁决 A2**：解析层（parseM3u8/parseMp4Moov/parseMpd 零改动迁入）+ 判定层（evaluateHls/Mp4/Mpd + heightToQuality 从 level2-render 抽出）+ 类型契约（MediaProbeStatus 三态/QualityDetected/MediaProbeVerdict 包自带，零包间依赖）；IO（fetch/timeout/Range/UA）留两端编排；`lib/parsers/` 物理删除不留薄壳；worker types.ts QualityDetected 改 re-export 消副本。裁决另抓 2 处主循环盲区：**level1-probe.ts:5 范围补漏**（parseM3u8 第二消费方，漏改则删目录即编译红）+ **api 超时禁复用 worker 30s**（inline 端点 5 并发分批最坏 ⌈N/5⌉×30s → 独立 RENDER_CHECK_TIMEOUT_MS=8000）。② api 试播升级（D1/D2 消除）：HEAD+Content-Type → GET manifest + 包判定，三态写 render_status + 质量字段（UPDATE 与 worker updateSourceRender CASE 防御语义逐条对齐：width/height/quality 无条件覆盖，quality_source/detected_at 仅解析出尺寸时写）；契约 BREAKING 兼容扩展：newRenderStatus union +'partial'（Single/BatchItem）+ batch summary +partial 计数 + insertHealthEvent 落 errorDetail——**ADR-158 D-N 偏离登记**：试播协议从二值升三态（原 I3 已知限制按设计消除，AMENDMENT 候补）。③ 前端同步：lib/sources api.ts 双 union + types.ts SourceActionBatchSummary `partial?` + **toast partial 独立分桶 2 处**（SourceLinesExpand/moderation LinesPanel——范围增补，正确性 #1：原分支 partial>0 且无 dead/failed 时误报「全部正常」）；展示层 lines-panel toDisplayState 已支持 partial 零改动。④ **已知限制登记**：partial 集成路径暂不可达——parseM3u8 对 #EXT-X-STREAM-INF 无条件 push variant → isMaster ⇒ variants 非空（worker 既有事实非本卡引入）；三态语义由包测试直接构造 parsed 锁定，未来 parser 增强（过滤无 URI variant）后自然可达。⑤ **Codex stop-time review 拦截（本卡第 1 处，序列累计第 5 处）**：「MP4 inline render check can buffer full videos」——renderCheckManifest 用 `res.arrayBuffer()`/`res.text()` 全量读响应体，服务器忽略 Range 返回 200 全量（或 URL 指向大文件）时整个视频缓冲进内存，inline 端点 5 并发下 OOM；worker checkMp4/checkHls/checkDash 同款存量缺陷（本卡前即存在）。修复 = 双端 `readBodyLimited`（流式读满上限即 cancel；mp4 64KB / manifest 2MB）——IO 编排层依 A2 裁决不进包，api/worker 双副本 + 双向同步注释（ADR-107 §4 范式）；守卫用例：mock 200 无限流，全量读取实现会挂死至超时。随后 SourceProbeService 428→525 行超 500 红线（本卡引入新逻辑阶段非存量豁免）→ 拆 `apps/api/src/lib/render-check-manifest.ts`（renderCheckManifest + readBodyLimited，纯探测 IO 不碰 DB，Service 430 行回红线内；行为等价搬移，单测 7 用例直接覆盖该路径故 e2e 不加跑第四轮）。**Codex 二轮拦截（收口后 fix commit，序列累计第 6 处）**：「invalid manifest bodies are marked ok」——判定层对 HTML 错误页/垃圾字节判 ok（HTTP 200 + 非 manifest 内容；worker 既有误判 + api 较旧 Content-Type 检查构成倒退）。修复 = 解析层加有效性字段（m3u8 `isValidM3u8`〔#EXTM3U 头〕+`hasSegments`〔#EXTINF〕/ mpd `isValidMpd`〔<MPD 根〕/ mp4 `isValidMp4`〔首 box 已知 ISO BMFF 4CC，moov 不在窗口不误杀〕）+ 判定层收紧（无效→dead；media playlist 无分片→dead；MPD 无 Representation→partial 对齐 HLS 语义）+ 测试 +4 无效输入守卫用例；worker level2 同步受益（共享判定层）。⑥ **新发现登记**：renderCheckAll toast 同构 2 处（达 3 处时强制提取共享）；readBodyLimited 双副本（第三消费方出现时再裁决入包）。沉淀自答：本卡即沉淀任务（解析判定 → packages 共享层）。门禁：typecheck/lint EXIT=0 / 包测试 28（含迁移 10 + evaluate 18）/ audit 测试 13（含 UPDATE 质量字段断言 + 无限流截断守卫）/ test:changed 自动升全量终轮 505 文件 7081 passed（中间轮 ImageHealthClient 单例与 e2e dev server 并发抖动，单独复跑 18/18 过，与本卡无关）/ verify:adr-contracts ✅ 234 端点对齐 / e2e:admin 三轮 exit 0（首轮 69 passed+4 flaky 已知抖动域 / toast 修复后复跑 ✅ / readBodyLimited 修复后 70 passed+1 flaky ✅）。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: arch-reviewer (claude-opus-4-8)。

### 任务列表（Phase 2 — 反馈闭环；启动前置：Phase 1 收口）

7. **SRCHEALTH-P2-1** — 前台 PlayerShell 补 success 上报（F1）（状态：✅ 已完成 2026-06-10 18:20）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 17:05 ｜ 完成时间：2026-06-10 18:20
   - 验收口径：首播成功上报 success:true（per-sourceId 去抖 + 1/N 采样配置化），PLAYER 域 e2e 不回归。
   - 文件范围（实施修正：+新单测文件）：`apps/web-next/src/components/player/PlayerShell.tsx`、`tests/unit/web-next/player-shell-success-report.test.tsx`（新）。依赖：Phase 1 收口 ✅。建议模型：sonnet。
   - **完成备注**：① `handlePlaySuccess` 接上报链：previewMode 守卫（ADR-160 D-160-5 `isPlaybackFeedbackEnabled` 首个真实消费方）→ per-sourceId 去抖（`successReportedRef`；**采样未中也记入**——每 source 首播事件恰好掷一次骰，防后续 onPlay 反复掷骰逼近全量、破坏 1/N 语义；与失败侧 errorReportedRef 同范式会话级不清空，sourceId 行级 UUID 跨集/跨视频天然隔离）→ 1/N 采样 → fire-and-forget POST `success:true`（videoId + raw sourceId）。② 采样配置化：`NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N`（默认 1 全报；非法值回退 1；Next 编译期内联保持点号静态访问）；`getSuccessSampleN` + `shouldReportPlaySuccess(sampleN, random)` 纯函数同文件导出便于单测（先例 isPlaybackFeedbackEnabled）。③ 后端零改动：`/feedback/playback` success 路径（dead→ok 复活 + quality 回填）与 (ipHash,sourceId)/min rate-limit 既有（feedback.ts），本卡为其接通首个前台消费方——F1 反馈断点闭合，P2-2 EMA / P2-3 复活门槛的 success 样本流就绪。④ **e2e:player 实跑归因（验收口径「不回归」成立）**：35 failed + 1 flaky + 2 passed——失败全集 = **pre-existing 数据基建欠账非回归**（dev DB 零 seed：fixture 视频 `test-movie-aB3kR9x1` 等 videos 表 0 行 → API 404 → watch 页 server 预取 `fetchVideoDetail` notFound() 404〔CHG-361-E3 起 page.route mock 不覆盖 server fetch〕；home_modules 0 行 → 首页 video-card 恒空）；证据链：curl API 直接 404（与前端代码无关）+ smoke 2/2 绿维持 + 先例归因 changelog CHG-VIR-13-PLAY-FIX / 13 系列收口条目（31 failed 同画像同根因）。**候选独立卡登记：e2e-next seed 基建**（player/homepage/detail/card 系 spec 依赖 DB fixture）。⑤ 过程教训：首轮 e2e 因 `npm run … | tail` 管道吞 playwright exit 1（tail exit 0 伪绿）+ reuseExistingServer 复用昨晚 stale :3000 dev server——已杀 stale server 干净复跑取证，后台命令不再用管道包门禁命令。共享层沉淀：否——上报逻辑与 PlayerShell 会话状态（rawSourcesRef/activeSourceIndex/watchdog）强耦合，纯函数已同文件导出；feedback 上报出现第 3 消费方时再裁决提取 usePlaybackFeedback hook。门禁：typecheck/lint EXIT=0（3 warning 均既有）/ 新测 6 用例 + on-error 既有 8 零回归 / test:changed 4 文件 23 passed。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。**Codex stop-time review 拦截（Phase 2 收口后 fix commit，序列累计第 7 处）**：「success reports can rate-limit later failure reports」——后端 `fb:rl:{ipHash}:{sourceId}` bucket 不分信号类型，P2-1 接入 success 上报后，首播 success 会把 60s 内随后的 failure 上报 429 拒掉（dead 标记 / fb:fail recheck 佐证 / EMA obs=0 全链路丢失；反向复活佐证同理）。修复 = bucket 加 `:s`/`:f` 后缀分维度（防刷语义 =「同类信号重复」，跨类不互斥；旧 key TTL 60s 自然过期）+ 守卫用例（success→failure 连发 202 + 同类共享 bucket 断言），feedbackRoute 19/19。
8. **SRCHEALTH-P2-2** — EMA 反馈统计字段 migration + feedback 写入（F4 前置）（状态：✅ 已完成 2026-06-10 18:50）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 18:30 ｜ 完成时间：2026-06-10 18:50
   - 验收口径：`video_sources` 增 `fb_score`/`fb_sample_weight`/`last_feedback_at`（写入即时半衰，方案 §3 P2-2），feedback 落账；**本卡不进评分**。
   - 文件范围（实施修正：+types/queries/测试——Opus 裁决补漏 + types required 字段编译链波及）：`apps/api/src/db/migrations/105_video_sources_feedback_ema.sql`（新）、`apps/api/src/routes/feedback.ts`、`packages/types/src/admin-moderation.types.ts`、`apps/api/src/db/queries/video_sources.ts`、`docs/architecture.md`、`tests/unit/api/feedbackRoute.test.ts`。依赖：P2-1 ✅。建议模型：sonnet（+Opus 子代理）。
   - **完成备注**：① **arch-reviewer (claude-opus-4-8) 两轮裁决**：一轮（A–F）= 裸 NUMERIC 防 round 漂移 / 三列全 NULL 无 DEFAULT（NULL=无样本唯一正确语义）/ fb_score CHECK [0,1] + weight CHECK ≥0 / 不建索引（P3-2 才有读路径）/ 半衰期 7 天代码常量 `FB_HALF_LIFE_SECONDS`（调参须配合影子验证，不进 env）/ EMA 与 redis INCR 正交并行、与复活 UPDATE 分开 fire-and-forget（失败隔离）/ 105 文件不写 BEGIN（054/059/104 内嵌 BEGIN 是既有技术债不复制）。**二轮定点复核（主循环发现一轮输出内部矛盾后回询）**：一轮交付物为 DRY 改写的 `UPDATE…FROM(SELECT w_eff)` 形式被裁定不安全——EvalPlanQual 只刷新加锁目标行、不重跑 FROM/CTE/LATERAL 子计划（旧快照缓存元组）→ 并发反馈 last-write-lost + 新旧版本混合值；终版 SQL = decay 输入列全部**直接自引用目标表 vs**（表达式重复三遍，正确性 #1 > DRY #5），测试以 SQL 形态守卫锁定（含「退回子查询必须 RED」注释）。② 冷启动：last_feedback_at NULL → decay=0 → 首样本 score=obs/weight=1 无先验。③ **真库验证**（migration 实际执行 + 事务回滚对拍）：三列+双 CHECK 落库 ✅；数值三步对拍精确命中（首样本 1/1 → 间隔≈0 并入 obs=0 → 0.5/2 → 回拨一个半衰期 obs=1 → 0.75/2）✅；CHECK 拒 fb_score=1.5 ✅。④ 实施修正（裁决盲区登记）：types 三字段为 required → `video_sources.ts` mapRow 编译链强制波及 → SOURCE_SELECT/row 接口/mapper 三处真实映射（+NUMERIC string→Number 转换；硬编码 null 是潜伏假数据缺陷，按裁决「映射真源完整」内在意图延伸）。⑤ **P3-2 前置警示已沉淀**：migration COMMENT + types 注释 + architecture.md 三处记「消费 min(1,w/N) 须 COALESCE(w,0)——PG LEAST 忽略 NULL 误返 1」。⑥ 已知限制登记：真库并发交错用例（两连接行锁阻塞→EPQ）未自动化（单测无真 PG 基建；并发语义由 SQL 形态守卫 + 真库手工对拍锁定，候选集成验证）；feedback.ts `countRecentFailures` 既有死代码（范围外不动）。共享层沉淀：否——EMA 写入单消费方（feedback route），SQL 形态注释 + 测试守卫已锁不变式；route 直接 db.query 为既有 feedback 范式（服务化重构候选独立卡，本卡不动分层）。门禁：typecheck/lint EXIT=0 / feedbackRoute 13/13（新增 4：obs=1 契约 / obs=0 正交 / SQL 形态守卫 / 失败隔离）/ test:changed 升全量 506 文件 7095 passed（首轮 1 failed 为并发抖动复跑干净）/ migrate 真库 ✅ / e2e:admin 82/82 EXIT=0。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: arch-reviewer (claude-opus-4-8) ×2（设计裁决 + 定点复核）。
9. **SRCHEALTH-P2-3** — 复活/recheck 门槛独立 ipHash 化（F3 + §8 C3）（状态：✅ 已完成 2026-06-10 19:10）
   - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 19:00 ｜ 完成时间：2026-06-10 19:10
   - 验收口径：dead→ok 复活需窗口内 ≥2 独立 ipHash（SADD+SCARD+TTL，禁 INCR）；失败→recheck 同卡迁移同原语。
   - 文件范围：`apps/api/src/routes/feedback.ts`、`tests/unit/api/feedbackRoute.test.ts`。依赖：P2-1 ✅。建议模型：sonnet。
   - **完成备注**：① 共享原语 `countDistinctIps(key, ipHash, windowSeconds)`（SADD+TTL 检查+SCARD）：**TTL 设置用 ttl<0 检查而非照搬失败侧 `count===1` 判断**——SADD 无 INCR 的原子递增返回值，两个并发首次 SADD（不同 member）后双方 SCARD 都读 2 → 谁都不设 TTL → 永久 key（复活门槛被脏状态永远满足）；ttl<0 由任意后续请求自愈，固定窗口非滑动。② 复活侧：`fb:revive:{sourceId}` 窗口 300s + ≥2 独立 ipHash 才执行 dead→ok UPDATE；未达门槛仅刷 `last_probed_at`（保留 CHG-SN-4-05「success 反馈视为 probe 信号」现状，**该时间戳语义与 P3-1 新鲜度衰减的关系登记留 P3-1 裁决**——feedback 刷 last_probed_at 会让源显得新近探测过）；redis 故障 catch→0 = fail-safe 不复活。③ 失败侧：`fb:fail:set:{sourceId}` 迁移（阈值 3/窗口 300s 保留，语义从「同一客户端 3 次」→「3 个独立客户端」；旧 `fb:fail:{ipHash}:*` 不再写入，存量 TTL 300s 自然过期，无迁移脚本）；同卡删除同 key 族死代码 `countRecentFailures`（P2-2 登记项闭环）。④ 测试 18/18：新增 5 用例（门槛未达仅刷时间戳 / 达标复活 / ttl<0→EXPIRE 设置 + 已有 TTL 不重设〔固定窗口〕/ redis 故障 fail-safe / 失败侧 2 无信号·3 入队 + INCR 不再使用断言）+ 既有 2 用例适配（INCR→SCARD / EMA 正交断言改 sadd）。**已知权衡登记**：低流量源失败侧灵敏度下降（单用户反复失败不再触发 recheck——独立佐证原则的代价，方案 §8 C3 已裁决）。共享层沉淀：否——SET 门槛原语单文件双调用点，第 3 消费方（如 P3-3 host 级熔断计数）出现再裁决提取。门禁：typecheck/lint EXIT=0 / feedbackRoute 18/18 / test:changed 18 passed（feedback 前台 API 无对应 e2e 域，P1-5 同先例）。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
10. **SRCHEALTH-P2-4-A** — manual_route_reprobe 信号 API 侧（状态：✅ 已完成 2026-06-10 19:35）
    - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 19:20 ｜ 完成时间：2026-06-10 19:35
    - 验收口径：`reprobeRoute` 写真实队列信号（`origin='manual_route_reprobe'` + partial index migration + types union + audit 真实 jobId/queuedCount），占位 jobId 消除。
    - 文件范围（实施修正：+architecture.md origin 注释 + 单测）：migration 106、`packages/types/src/admin-moderation.types.ts`、`apps/api/src/db/queries/sourceHealthEvents.ts`、`apps/api/src/services/SourcesMatrixService.ts`、`docs/architecture.md`、`tests/unit/api/sources-routes-mutations-audit.test.ts`。依赖：无硬依赖。建议模型：sonnet。
    - **完成备注**：① migration 106 partial index `idx_source_health_events_route_reprobe_unprocessed`（`WHERE processed_at IS NULL AND origin='manual_route_reprobe'`，对齐 058a feedback_driven 先例；origin 列无 CHECK 新值零列迁移；已真库执行 ✅）。② types union：`SourceHealthEventOriginWorker` +`'manual_route_reprobe'` 同位扩展（§4 要求）。③ 批量入队 query `enqueueRouteReprobeSignals`（INSERT…SELECT，每 active 源一行；**入队口径 = countRouteSources 线路匹配 + `is_active=true`——与 P2-4-B worker 定向消费（P1-5 loadSourcesByIds active 口径）对齐，防「入队不被消费却标 processed」F2-① 同型**；jobId 落 `triggered_by` 列，audit 的 jobId 可关联到全部信号行真实溯源）。④ Service：占位 jobId 消除——queuedCount 语义从「线路源总数」收紧为「实际入队 active 源数」（更诚实：原值关联的是不存在的队列）；线路存在但全 inactive → queuedCount=0 正常返回非 404（404 仅线路不存在）；audit afterJsonb 契约形状不变（probeJobId+queuedCount）。⑤ 测试 11/11：用例 5 改造（INSERT 路由 mock + SQL 契约断言：origin literal / active 口径 / jobId 参数）+ 新增 5b（全 inactive → queuedCount=0 + audit 记真实 0）。既有端点无新 route（verify:endpoint-adr 234 对齐 ✅ 不触发 ADR 起草）。共享层沉淀：否——批量入队 query 单消费方（reprobeRoute），worker 消费侧 P2-4-B 用读路径（partial index 拉取）非本 query。登记：`makeAuditSpy` 测试文件既有死代码（范围外不动）。门禁：typecheck/lint EXIT=0 / 测试 11/11 / test:changed 升全量 7101 passed / migrate ✅ / verify:adr-contracts ✅ / e2e:admin 82/82 EXIT=0。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
11. **SRCHEALTH-P2-4-B** — manual_route_reprobe worker 定向消费（状态：✅ 已完成 2026-06-10 19:50）
    - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 19:40 ｜ 完成时间：2026-06-10 19:50
    - 验收口径：worker 消费 `manual_route_reprobe` 信号定向 probe+render 对应线路全 source，消费多少标多少 processed。
    - 文件范围：`apps/worker/src/jobs/feedback-driven-recheck.ts`、`tests/unit/worker/jobs/feedback-driven-recheck.test.ts`。依赖：SRCHEALTH-P2-4-A ✅ + SRCHEALTH-P1-5 ✅。建议模型：sonnet。
    - **完成备注**：① 取方案 §3 P2-4 ②「拉取条件扩展」选项（vs 拆独立 job）：两种信号定向语义完全同构（source_id 集合 → P1-5 编排 level1 定向→聚合→render 重置→level2 定向→标 processed），复制即重复逻辑（价值排序 #2）。② `fetchUnprocessed` → `origin IN ('feedback_driven','manual_route_reprobe')`（058a/106 两 partial index 由 planner BitmapOr 组合；created_at 全局排序公平混批）。③ SELECT +origin 字段 → log `byOrigin` 分布计数（运营 reprobe 后可观测信号消费）。④ BATCH_LIMIT 100 共享：大线路信号分多 cron 周期消费完（信号持久化不丢，头注释登记）。⑤ 测试 5/5：fixture +origin + 新增混批用例（拉取 SQL 双 origin 断言〔仅 feedback_driven 会让 reprobe 信号永久滞留〕/ 混批定向 loadSourcesByIds+runLevel2Render 参数 / 消费多少标多少 processed 事件 id 全量断言）。共享层沉淀：否——编排复用即本卡实现方式本身。worker 改动无对应 e2e 域（ADR-180 / P1-5 先例）。门禁：typecheck/lint EXIT=0 / recheck 编排 5/5 / test:changed 5 passed。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
    - **Phase 2（P2-1/P2-2/P2-3/P2-4-A/P2-4-B 共 5 卡）全部收口 ✅ 2026-06-10**。下一步：Phase 3（启动前按方案 §4 复核拆卡与时序：P3-3-A 前置 Opus schema 裁决 / P3-2 受影子验证一周硬前置约束——P2-2 落地日起算）或 Phase 1 复盘三候选裁决。

### 任务列表（Phase 3 — 评分进化 + 站点/主机桥接；启动前按方案 §4 复核拆卡与时序）

12. **SRCHEALTH-P3-3-A** — `video_sources.source_hostname` migration + 回填 + 写路径维护（状态：✅ 已完成 2026-06-10 20:20）
    - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 19:55 ｜ 完成时间：2026-06-10 20:20
    - 开工复核（§4 时序门禁）：P3-2 影子一周硬前置（最早 ~06-17）本轮阻塞；P3-4 随评分项顺延；本轮可执行 P3-3-A → P3-3-B → P3-1。
    - **完成备注**：① **arch-reviewer (claude-opus-4-8) 裁决 A–H**：TEXT + 小写 CHECK（`IS NULL OR` 对齐 105 先例）+ NULL 唯一语义（不区分解析失败/未回填——回填后后者消失）；**`extractHostname` 入 `packages/media-probe` 新 `src/url.ts` 分区**（裁决抓到 `extractSiteId` 已存在副本漂移：level1-probe exported + level2-render local 双副本——「第三消费方出现即入包」已触发；放 api 单副本会逼 P3-3-B 跨 ADR-107 边界）；**migration 107 不回填（双重否决 SQL 回填）**：IDN→punycode 为 Node URL 专属语义 SQL regex 不可复制（IDN 主机将产生与写路径永久错配的第二 key）+ migrate.ts 单事务 55.7 万行 UPDATE 长锁阻塞爬虫 upsert → 独立脚本 `scripts/backfill-source-hostname.ts`（游标分批 2000/批独立提交 + 幂等 `WHERE source_hostname IS NULL` + 末尾 ANALYZE 喂 planner 直方图）；partial index `WHERE deleted_at IS NULL AND source_hostname IS NOT NULL` **不加 is_active**（P3-3-B 软降权/恢复需反查 inactive 行）；非 CONCURRENTLY 安全成立条件 = 空列 + IS NOT NULL 谓词 → 初始空索引瞬时建完。② 写路径 3 处全集（worker 无 INSERT）：`upsertSource` / `replaceSourcesForSite`（**DO UPDATE SET source_hostname=EXCLUDED**——恢复软删行修复回填前 NULL，同 URL 冲突幂等无害）/ `replaceSourceUrl`（换源重算，三处中最不能漏）；解析封闭 query 层（「写 URL 必同步写 hostname」不变式，新调用方无法漏传）。③ **真库落地**：migration ✅ / 回填实跑 556,892/556,896（4 行垃圾 URL 如 "01"/"25" 保持 NULL = 正确语义；样本登记 P3-3-B 评估无 hostname 源占比）/ 幂等重跑 updated=0 / 对拍 4 项（NULL=4、小写 0 违例、抽样 hostname↔URL 一致、等值查询 Bitmap Index Scan 走 idx_video_sources_hostname）。④ worker 两处 `extractSiteId` 加 TODO(P3-3-B) 注释：`slice(0,64)` fallback 与 NULL 语义冲突不可 JOIN，P3-3-B 切 extractHostname + 持久化前过滤 null（本卡不动 worker 逻辑）。⑤ 登记：source_hostname 暂不进 VideoSource types/mapper——本卡只写不读，P3-3-B JOIN 在 SQL 层；TS 读字段需求出现时加性扩展。共享层沉淀自答：是——本卡即沉淀（hostname 语义真源入 media-probe URL 工具分区，写路径/回填/P3-3-B worker 三方共用）。门禁：typecheck/lint EXIT=0 / extractHostname 边界 10 用例（IDN punycode + IPv6 方括号固化）+ 写路径 SQL 契约 4 用例（crawlerSourceUpsert 13/13）/ test:changed 60 文件 665 passed / 全量 507 文件 7117 passed / e2e:admin 82/82 EXIT=0 / migrate + 回填真库 ✅。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: arch-reviewer (claude-opus-4-8)。
13. **SRCHEALTH-P3-3-B** — `host_health` 表 + 熔断双存储 + 软降权（**已拆 -B1/-B2**：arch-reviewer claude-opus-4-8 裁决 G——范围 5 项踩线 + schema/worker/api-service 跨 3 层双触发强制拆）
    - 裁决要点（两子卡共同真源）：A 表只存事实字段（`cooldown_until > NOW()` 读时判定熔断，无 state 枚举无后台翻转）；B 仅翻转事件级 UPSERT（circuit-breaker 返回 CircuitTransition，不 import pg；worker 重启不回灌内存——评分侧靠 NOW() 比较不受重启影响）；C 软降权 = **排序分桶**（tripped 桶整体后置、桶内保原 effectiveScore 序；**否决乘法因子**——避免与 P3-2 影子验证在同一 effective_score 标量踩踏；effectiveScore 透出原值 + 新增 VideoSource.hostTripped 可选字段）；D 恢复 = cooldown 30min 自然到期评分侧自动回升（不等 cron；feedback 加速恢复登记 P3-x 不进本卡）；E null hostname 不进熔断统计直接探测；F admin 手动探测不接入熔断（跨进程 + 妨碍人工排查）；H-1 hostname 基数实测 278（行数上界，JOIN 零风险）；H-6 ADR 草稿 -B2 后 PHASE COMPLETE 前补（双存储分工 + 排序分桶 + 恢复语义三决策）。
    13a. **SRCHEALTH-P3-3-B1** — host_health migration + worker 熔断持久化 + extractHostname 切换（写侧）（状态：✅ 已完成 2026-06-10 21:05）
    - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 20:40 ｜ 完成时间：2026-06-10 21:05
    - **完成备注**：① migration 108 `host_health`（hostname TEXT PK + 小写 CHECK；cooldown_until/last_failure_at/last_success_at/last_tripped_at/trip_count/updated_at——只存事实字段无 state 枚举，熔断判定 = `cooldown_until > NOW()` 读时计算；不建额外索引 PK 即 -B2 JOIN 唯一访问路径；已真库执行 ✅ 表结构对拍）。② circuit-breaker：recordFailure/recordSuccess 返回 `CircuitTransition`（'tripped'|'recovered'|null）；recordFailure 入口先清过期 cooldown（防未经 shouldSkipSite 的调用路径把新一轮失败误判「已在冷却中」吞掉 tripped）；recordSuccess 对「cooldown 已过期但行未清」仍返回 recovered 一次（清 PG 旧行+刷观测字段，从未熔断主机恒 null 零写放大）；参数 siteId→hostname 改名；**模块保持纯逻辑不 import pg**（裁决 B）。③ 新建 `jobs/source-health/host-health.ts` `persistCircuitTransition`：tripped UPSERT（cooldown=NOW()+make_interval(config 同一真源)/trip_count+1/last_tripped_at）/ recovered UPSERT（cooldown=NULL+last_success_at）；落库失败 catch+warn 不阻断探测（P1-2 先例）；ON CONFLICT 行级锁幂等无需 advisory lock。④ level1+level2：删两处 extractSiteId 副本（P3-3-A TODO 闭环）→ `extractHostname`；null hostname 跳过熔断统计直接探测、不落库（裁决 E：孤儿 key 污染）；transition 非 null 才落库。⑤ architecture.md +5.2a host_health 章节。登记：`origin='circuit_breaker'` skip event 噪音冗余化（裁决 H-7，P3-x 评估停写，本卡不动）；feedback 加速恢复（api 跨进程清 cooldown）裁决 D 明确不进本卡另起卡。共享层沉淀：否——persistCircuitTransition 单消费域（source-health 两 job），circuit-breaker 纯逻辑层本就 worker lib。门禁：typecheck/lint EXIT=0 / circuit-breaker 11（+4 transition）/ host-health 4（新）/ level1 编排 4（重写，extractSiteId 测试由 media-probe url.test.ts 接管）/ worker 全量 9 文件 60 passed 零回归 / test:changed 24 passed / migrate 真库 ✅（worker 无对应 e2e 域，ADR-180/P1-5 先例）。执行模型: claude-fable-5（用户持续推进授权）；子代理: arch-reviewer (claude-opus-4-8)（母卡裁决 A–H 两子卡共用）。
    13b. **SRCHEALTH-P3-3-B2** — listSources JOIN host_health 排序分桶 + hostTripped 透出（读侧）（状态：✅ 已完成 2026-06-10 21:50）
    - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 21:10 ｜ 完成时间：2026-06-10 21:50
    - **完成备注**：① query：`findActiveSourcesWithSignalsByVideoId` +`LEFT JOIN host_health` + `COALESCE(hh.cooldown_until > NOW(), false) AS host_tripped`（SQL 只透出事实布尔，JOIN miss / NULL hostname → false 不降权；分桶在 Service——CHG-352 A1 范式）；`DbSourceRowWithSignals` +host_tripped。② Service：排序分桶（裁决 C2）——`hostTripped` 第一序键（tripped 桶整体后置）、桶内保 effectiveScore DESC + created_at ASC 原序；**effectiveScore 数值零修改**（裁决 C2 否决乘法因子：避免与 P3-2 影子验证在同一标量踩踏；route-scoring.ts 明确不改）。③ types：`VideoSource.hostTripped?` 可选字段（CHG-352 R1 同范式；JSDoc 钉死 P3-4 切线消费口径「先 hostTripped 升序再 effectiveScore 降序」与列表排序同构）。④ 校准单测 3 用例：**关键断言「熔断 ok 源排非熔断 dead 源之后」**（熔断 = 整台 CDN 此刻不可达强信号 > 单源历史 dead）/ 桶内原序 / effectiveScore 透出原值 + hostTripped 透出。⑤ EXPLAIN 取证（裁决 H-2）：host_health 0~278 行小表 Hash Join 为 planner 最优，无性能风险。⑥ **e2e 归因（裁决 H-4 PLAYER+VIDEO 域）**：player 23 failed+13 passed / video 11 failed+7 passed——失败全集 = **pre-existing e2e-next seed 基建欠账**（P2-1 已登记候选独立卡；取证：fixture 视频 aB3kR9x1 dev DB 实测 0 行 → watch/detail 页 404 → player 元素不存在，请求不触达 listSources）+ smoke 14 passed 绿 + host_health 空表时 COALESCE false 行为与改动前等价（单测锁定）→ 非本卡回归。登记：ADR 草稿（裁决 H-6：双存储分工 + 排序分桶 + 恢复语义三决策）PHASE COMPLETE 前补。共享层沉淀：否——分桶排序为 listSources 单消费方逻辑，P3-4 消费同构口径时再评估提取。门禁：typecheck/lint EXIT=0 / sources.test 17/17（+3）/ test:changed 升全量三轮终轮 508 文件 7128 passed 全绿（前两轮 1 failed/4 errors 为并发抖动，P2-2 先例）/ EXPLAIN ✅ / e2e smoke 14 passed。执行模型: claude-fable-5（用户持续推进授权）；子代理: arch-reviewer (claude-opus-4-8)（母卡裁决 C2/C3/C4 = VideoSource.hostTripped 契约 Opus PASS 依据）。
    - **P3-3（-A/-B1/-B2 共 3 卡）全部收口 ✅ 2026-06-10**：D4 闭环——熔断信号落库 + hostname join key + 评分软降权，CDN 整体宕掉影响半径「6h 逐个发现」→「分钟级整体降权」（评分回升 ≈ cooldown 30min 自然到期，不等 cron）。
14. **SRCHEALTH-P3-1** — 双时钟新鲜度衰减 + 校准表单测（状态：✅ 已完成 2026-06-10 22:40）
    - 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 22:00 ｜ 完成时间：2026-06-10 22:40
    - **完成备注**：① **arch-reviewer (claude-opus-4-8) 裁决 A–F**：**目标值正名**——方案 §3「向中性值 0.345 回归」为轴混淆（0.345 = 全因子总分中性合成，子项轴无此档位），子项衰减 target = pending 档 **0.3**（完全陈旧 ⇒ 信息价值等同从未探测）；**dead 对称参与衰减**（0.0→0.3 有界回升：「坏消息永久可信、好消息会过期」是站不住的不对称假设；auto-retire 180d DB 层兜底退役 + 回升上限 0.3 远低于任何健康源）；`decayed = 0.3 + (score−0.3)×2^(−max(0,age−grace)/T)`，**T_probe=72h grace=6h**（level1 6h 全量 cron 正常节奏零惩罚，72h 为 cron 停摆安全垫）/ **T_render=168h grace=0**（level2 LIMIT 100 单源重测间隔达数百小时——短 T 会把 health 主导项普遍压向中性致区分力坍缩 §7.2；稳态健康源总分 ≈0.789 区间守卫）；常量 `FRESHNESS_DECAY` 进代码不进 env（P2-2 先例）。**裁决 D（P2-3 登记项闭环）**：feedback success 刷 last_probed_at **维持现状** = 合理新鲜度信号（「真实播放是最真实的探测」§3 原则；防滥用由 P2-3 独立 ipHash 门槛 + EMA 闭环），零代码改动；登记非对称遗留：success 不刷 last_rendered_at（合理，另起卡评估）。**裁决 F-4 时序**：影子未启动，P3-1 先行让 P3-2 影子从最终公式形态起算——奠基非污染。② route-scoring：`EffectiveScoreInput` +3 可选字段（lastProbedAt/lastRenderedAt/now 全可选零破坏；**纯函数内禁 Date.now()**，now 注入）；`applyFreshnessDecay` 导出纯函数（负 age max(0,·) 钳制——feedback 未来戳不放大越档）；undefined→不衰减（Phase 1 数学，Case 1–7 零改动原样通过）/ null→短路（从未探测 ⇔ pending=target 恒等）。③ query +`vs.last_probed_at, vs.last_rendered_at` 两列 + row 类型 required；Service **map 前单次 Date.now()** 全源共用（逐行取 now 会破坏同批排序基准一致性）。④ 校准表 Case 8（11 用例）：常量锁定 / D3 主验证（6min ok 0.86 vs 6 天 ok 0.663 拉开 ~0.2）/ dead 对称（6d 0.169 / 30d 0.291 有界 <0.3）/ grace 零惩罚 / 负 age 钳制 / 区分力守卫 0.789 / 纯函数边界收敛；sources.test：MOCK_RAW_ROW 补近期时间戳（age≈0 既有 0.86/0.90 + 分桶断言全部不漂移；null 与 probe='ok' 语义矛盾故不取）+ P3-1 集成用例（Service 传参链实跑衰减排序）。⑤ 与 P3-3-B2 正交确认：衰减改的是 effectiveScore 数值轴合法组成（新鲜度维度），hostTripped 第一序键 / 桶内序逻辑零改动。无 schema 变更（054 列仅 SELECT 透出）。共享层沉淀：否——衰减纯函数已在 lib 共享层（route-scoring），worker 复用时 import 即可。门禁：typecheck/lint EXIT=0 / source-effective-score 38/38（+Case 8 11 用例）/ sources 18/18 / test:changed 587 passed / 全量 507+ 文件 7139 passed / e2e smoke 10 passed（PLAYER 域 seed 欠账沿用 P2-1/P3-3-B2 取证先例，衰减排序由单测校准表精确覆盖）。**Codex stop-time review 拦截（收口后 fix commit，序列累计第 8 处）**：「迁移粗回填行绕过衰减」——裁决 C「NULL ⇔ pending」不变式被 migration 054 粗回填破坏（真库 12.4 万行 ok/dead 时间戳 NULL），null 短路使迁移 ok 永久虚高满分；修复 = null → 子项直取 STALE_TARGET（pending 恒等、undefined 兼容不动），+1 守卫用例。执行模型: claude-fable-5（用户持续推进授权）；子代理: arch-reviewer (claude-opus-4-8)。
    - **Phase 3 本轮可执行范围（P3-3-A/-B1/-B2 + P3-1 共 4 卡）全部收口 ✅ 2026-06-10**：D3+D4 闭环。剩余：P3-2（影子一周硬前置，最早 ~06-17）→ P3-4（依赖评分项收口）；登记：P3-3 ADR 草稿 PHASE COMPLETE 前补（裁决 H-6）。
15. **SRCHEALTH-P3-2** — 反馈项动态权重进分（影子计算一周硬前置）（状态：🟡 规划）
    - 依赖：SRCHEALTH-P2-2 落地 + 影子验证（方案 §4 时序硬依赖链）。建议模型：opus（评分关键路径权重设计）。
16. **SRCHEALTH-P3-4** — 播放端按 effectiveScore 切线（状态：🟡 规划）
    - 依赖：P3 评分项收口。建议模型：sonnet。

## [SEQ-20260610-03] 内容审核台 UX 优化（MODUX · 信息密度 + 去冗余 + 快速编辑）

- **状态**：🔄 执行中（11/15 卡完成：**Phase 1 全收口 ✅**（P1-0~P1-4）+ **Phase 2 全收口 ✅**（P2-1/-2/-3）+ **P3-1 后端闭环 ✅**（P3-1-A 富集枚举语义 + query schema 契约 / P3-1-B listPendingQueue WHERE 过滤 + count 补 mc JOIN + 预设兼容）；下一步 Phase 3 P3-2 待审列表筛选弹层 + F 键〔P2-3 归并〕）
- **创建时间**：2026-06-10 22:04
- **最后更新时间**：2026-06-10 23:13
- **目标**：落地 `docs/designs/moderation-console-ux-plan_20260610.md` v2（两轮独立审核 + 第三轮注册前终审通过，file:line 抽查全部命中）：审核台 12 项问题——去冗余（标题治理/DecisionCard 精简）→ 信息密度（列表单元格/详情 tab/键盘流）→ 功能增强（年代+富集过滤/筛选弹层/类似 tab 阈值/4 字段快速编辑）。
- **范围**：apps/server-next（admin/moderation/_client + 标题治理涉及页）+ packages/admin-ui（PageHeader/DecisionCard/KeyboardShortcuts 消费）+ apps/api（moderation.ts query/meta schema + service/queries）+ packages/types（admin-moderation.types）。**方案文件为各卡内容真源**；卡面只记验收口径与文件范围。
- **依赖**：无 BLOCKER；工作台空闲（SRCHEALTH 剩余 P3-2 影子验证硬前置 ~06-17 / P3-4 顺延，与本 SEQ 无文件冲突）。
- **用户裁定**：①标题治理全后台统一（复用 PageHeader，绝不新建第二套）；②快速编辑 类型+题材+年代+地区 全做；③列表过滤加 年代+富集状态（2026-06-10）。
- **拆卡判据执行**：P1-1 跨多页 → 前置 P1-0 盘点定调再拆 -A/-B；P3-1 跨 schema/types/service 多层 → 拆 -A/-B；P3-4 跨后端 schema + 前端 UI → 拆 -A/-B。方案「共 12 卡」计数勘误为 **15 卡**（终审第 4 条）。
- **路径勘误（终审）**：方案正文审核台文件实际位于 `apps/server-next/src/app/admin/moderation/_client/`（方案缺 `_client/` 段，行号全部准确）；本注册各卡文件范围已写全路径。

### 任务列表（Phase 1 — 快速修复与去冗余，前端为主低风险先行）

1. **MODUX-P1-0** — 全后台标题现状盘点 + 规约定调（item 5 前置）（状态：✅ 已完成 2026-06-10 22:12）
   - 创建时间：2026-06-10 22:04 ｜ 实际开始：2026-06-10 22:04 ｜ 完成时间：2026-06-10 22:12
   - 验收口径：产出盘点表（已用 PageHeader 页 / raw `<h1>` 5 非 dev 页 / dev 5 页豁免 / 例外页）+ 标题规约（Opus 子代理裁决：面包屑末项 vs 页内标题去留、a11y 唯一 h1 层级）+ P1-1-A/-B 拆卡边界定死。**不写业务代码、不新建 PageHead**。
   - 文件范围：docs only（规约写入 `docs/designs/moderation-console-ux-plan_20260610.md` 附录 A）。
   - 依赖：无。建议模型：sonnet（**强制 Opus 子代理**：规约决策，CLAUDE.md 模型路由）。
   - **完成备注**：① 盘点表落账（方案附录 A.1）：PageHeader 页面级消费方实测 **14 处**（grep 误命中纯注释 4 处已排除；crawler/runs/[id] 为 hidden 路由无面包屑先例）；raw `<h1>` 非 dev 5 页确认（VideoListClient 的 PageHeader grep 命中仅为注释）；dev 5 页豁免。② **arch-reviewer (claude-opus-4-8) 裁决 T-1~T-12 + Q1~Q5 + R-1~R-3**（附录 A.2–A.4，P1-1 执行真源），关键裁决：**面包屑零改动**（`<nav>` 内 `<strong>` 充当 h1 违反 heading 语义，末项降级破坏 14 页一致性）；**冗余消解 = 保留标题而非删除**（T-3/T-12——纠正方案原前提：5 迁移页仅 videos/settings 真冗余，Dashboard 问候/Analytics 不冗余）;**Q4 不扩 PageHeaderProps**（现有 title/subtitle/actions ReactNode 三槽全覆盖 → **P1-1-A 不触发 types.ts 强制 Opus trailer 项**；槽不够 → BLOCKER 重新评审）；Moderation 统计+键盘行归 subtitle 槽（T-6）。③ **关键结构发现**：AnalyticsView 非独立路由——是 DashboardClient `activeTab==='analytics'` 互斥 tab（`DashboardClient.tsx:266`），`/admin` 同路由 h1 唯一性走 T-9；ReactNode title 渲染为 div 非 heading → Dashboard/Analytics 迁移需 T-8 h1 兜底（R-1，P1-1-B 实现难点）。④ 拆卡边界修正（Q5）：-A 删除「PageHeader 扩展」项 = 零 admin-ui 改动，纯 server-next 应用层迁移；P1-1-A/-B 卡面已按裁决同步修正。docs-only（test:changed 自动跳过，ADR-180）。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖）；子代理: arch-reviewer (claude-opus-4-8)。
2. **MODUX-P1-1-A** — 审核台/视频库迁移 PageHeader（item 5；P1-0 裁决 Q5 修正：零 admin-ui 改动）（状态：✅ 已完成 2026-06-10 22:24）
   - 创建时间：2026-06-10 22:04 ｜ 实际开始：2026-06-10 22:13 ｜ 完成时间：2026-06-10 22:24
   - 验收口径（真源 = 方案附录 A 规约 T-1~T-6）：`ModerationConsole`（T-5 字号归一 font-size-xl→PageHeader 内置 + **T-6 统计/键盘提示行原样进 subtitle 槽**，R-2：dangerouslySetInnerHTML 原样搬运不得顺手清理）+ `VideoListClient`（T-3 标准三槽迁移，保留标题不删除）改用 PageHeader，移除 raw `<h1>`；headingLevel 默认 1（T-4）；已消费页无回归。
   - 文件范围（**Q4 裁决：不扩 PageHeaderProps，零 packages/admin-ui 改动，不触发 types.ts Opus trailer 项**）：`apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx`、`apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx`。
   - 依赖：MODUX-P1-0 ✅。建议模型：sonnet。
   - **完成备注**：① ModerationConsole：raw `<h1>`(font-size-xl) → `<PageHeader title={M.title}>`（T-5 归一 font-size-lg）；统计+键盘行整体进 subtitle 槽（R-2：dangerouslySetInnerHTML 与全部 CSS 变量逐字原样搬运，内层仅去掉与 SUBTITLE_STYLE 重复的 marginTop/fontSize/color）；preset 按钮区 + FilterPresetPopover（含 anchorRef + position:relative 锚定结构）整体进 actions 槽零行为变化；外包中性 div 保留原 marginBottom:8（该页容器无 gap 体系，不在本卡重排整页间距）。② VideoListClient：**发现 HEAD_STYLE/HEAD_TITLE_STYLE/HEAD_ACTIONS_STYLE 三常量与 PageHeader 内置样式逐字相同（手写副本）→ 删除**，正是 T-1 要收敛的重复实现；quick-filter chips 区进 subtitle 槽（SUBHEAD_STYLE 去 margin 由槽提供，6px→4px 统一到共享契约）；导出 CSV/手动添加按钮进 actions 槽（`videos-export-csv` testid 保留）。③ 选择器迁移核验：`data-page-head` → PageHeader 内置 `data-page-header`；预检 grep 确认 videos/moderation 域测试零依赖旧属性（DashboardClient 测试依赖 data-page-head 属 P1-1-B 范围）；`data-page-head-sub`/chips 的 data-quick-filter 保留在 subtitle 内容上。④ 登记：ModerationConsole 存量 unused BTN_PRIMARY/BTN_DANGER（迁移前已死代码，范围外不动）。共享层沉淀：否——本卡即是把手写副本收敛到既有共享 PageHeader。门禁：typecheck/lint EXIT=0 / test:changed 13 passed / moderation 域单测手动 28 passed / **e2e:admin 82/82 EXIT=0**。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
3. **MODUX-P1-1-B** — Dashboard/Analytics/Settings 迁移 + 已消费 14 页规约核对（item 5）（状态：✅ 已完成 2026-06-10 22:31）
   - 创建时间：2026-06-10 22:04 ｜ 实际开始：2026-06-10 22:25 ｜ 完成时间：2026-06-10 22:31
   - 验收口径（真源 = 方案附录 A 规约 T-7~T-12）：Settings（T-3）+ Dashboard/Analytics 迁移（R-1：`/admin` 同路由互斥 tab，T-8 h1 兜底 + T-9 h1 恰 1 个）；已消费 14 页规约一致性核对；dev 5 页豁免登记（T-11）。
   - 文件范围（实施修正：+2 测试文件选择器同步，P1-1-A 完成备注已预告）：`SettingsContainer.tsx`、`AnalyticsView.tsx`、`DashboardClient.tsx`、`tests/unit/.../DashboardClient.test.tsx`、`tests/e2e/admin/dashboard.spec.ts`。
   - 依赖：MODUX-P1-1-A ✅。建议模型：sonnet。
   - **完成备注**：① **R-1/T-8 难点消解比预期简单**：Dashboard 动态问候 `早上好，Yan — 今天有 {N} 待处理` 用**模板字符串**传 string title → PageHeader 直接渲染 h1，无需 ReactNode 兜底两分支（T-8 自然满足）；AnalyticsView「数据看板」string title 同理；T-9 互斥渲染下任一 tab h1 恰 1 个由结构保证。② 三页手写 HEAD_* 常量组（Settings 4 个/Dashboard 4 个/Analytics 4 个）与 PageHeader 内置逐字或近似等价 → 全部删除（差异按 T-5 归一：Dashboard/Analytics font-size-xl→lg、Settings fontWeight 600→700、subtitle margin 6px→4px、Dashboard paddingTop 4px 丢弃）；Settings actions 槽复用既有 AdminButton 零改动。③ 测试选择器同步：`[data-page-head]` → `[data-page-header]` 单测 8 处 + e2e 2 处 + 头注释 2 处（dashboard.spec.ts:158 为 analytics tab 断言，迁移后由 AnalyticsView 的 PageHeader 输出同名属性继续命中）。④ 规约核对收口：全 admin 非 dev 页 raw `<h1>` **清零**（grep 实证仅剩 dev 5 页豁免）；全 PageHeader 消费方零显式 headingLevel（默认 1，T-4 合规）。**item 5 标题治理（P1-0/-A/-B 三卡）全收口**。共享层沉淀：否——继续收敛手写副本到既有 PageHeader。门禁：typecheck/lint EXIT=0 / test:changed 32 passed（DashboardClient 16 含新选择器断言）/ system 域手动 84 passed / **e2e:admin 82/82 EXIT=0**。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
4. **MODUX-P1-2** — 播放器上方治理：DecisionCard 精简（item 11+12）（状态：✅ 已完成 2026-06-10 22:38）
   - 创建时间：2026-06-10 22:04 ｜ 实际开始：2026-06-10 22:32 ｜ 完成时间：2026-06-10 22:38
   - 验收口径：单视频内标题仅 1 次（PendingCenter h2）；决策 banner 从独占整行降为精简 inline；文案重规划；`dev/visual` 预览渲染正常；单测同步。
   - 文件范围（实施修正：PendingCenter/dev-visual 零改动——纯组件内部布局，消费面无 Props 变化）：`packages/admin-ui/src/components/cell/decision-card.tsx`、`tests/unit/components/admin-ui/cell/decision-card.test.tsx`。
   - 依赖：无。建议模型：sonnet。
   - **完成备注**：① **decision-card v1.7（零 `decision-card.types.ts` 变更 → 不触发 Opus trailer 强制项）**：删 h3 标题行 + TITLE_STYLE（item 12——与 PendingCenter:120 h2 重复；`video.title` 保留于 Pick 契约不动 types.ts，头注释登记「不再渲染」）；banner 整行（padding 10×14 / radius-md / 占满行宽）→ **inline chip**（inline-flex + alignSelf:flex-start + padding 3×10 / pill 999 / font-size-xs，item 11 不独占行）；文案精简 5 态（行动指引收为 · 短后缀：`全线路失效 · 建议拒绝` / `信号未就绪 · 等待验证` / `信号冲突 · 需核查` / `部分线路失效 · 需核查` / `信号健康`）；tone 三色 token（state-success/warning/error 三组 bg/border/fg）不变。② 头注释视觉骨架 v1.6→v1.7 同步；文档化 data attribute 契约零变化（`data-decision-card-title` 本就不在契约清单，全仓零残留引用 grep 实证）。③ 单测同步：标题断言反转（getByText→queryByText null + title 钩子 null）+ 新增 inline chip 样式断言（align-self/inline-flex）；既有 5 文案正则（/信号健康/ 等）关键词保留全兼容零改动。④ 消费面核查：PendingCenter 不传 header/actions 零改动；dev/visual registry × 3 状态纯 props 驱动渲染正常（Props 未变）。共享层沉淀：本卡即共享层内部优化。门禁：typecheck/lint EXIT=0 / **test:changed 自动升面 76 文件 964 passed**（admin-ui 包改动，ADR-180）/ e2e:admin 82/82 EXIT=0。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
5. **MODUX-P1-3** — 前台预览 404 调查 + 修复（item 2）（状态：✅ 已完成 2026-06-10 23:05）
   - 创建时间：2026-06-10 22:04 ｜ 实际开始：2026-06-10 22:39 ｜ 完成时间：2026-06-10 23:05
   - 验收口径：两根因分开复现；新增 admin preview URL builder；`url-helpers.ts` 纯函数不污染；已发布/未发布预览均非 404。
   - 文件范围（实施修正：根因 B 实为两叠加 bug，波及 web-next middleware + admin-access-token）：`apps/server-next/src/lib/admin-preview-url.ts`（新）、`PendingCenter.tsx`、`apps/web-next/src/middleware.ts`、`apps/web-next/src/lib/admin-access-token.ts` + 3 测试。
   - 依赖：无。建议模型：sonnet。
   - **完成备注**：**真库 dev 双端口实测复现 → 两根因结论**：① **根因 A（locale 吞 query）= 不成立**——实测 `/movie/x?preview=admin`（无 locale）→ `307 → /en/movie/x?preview=admin` **redirect 完整保留 query**，不致 404（方案预判证伪）；但仍新增 admin preview URL builder（收口 origin+locale+双因素三要素 + 注入 zh-CN 省一跳 307）。② **根因 B（鉴权降级）= 两个叠加 bug**：**B-1（middleware 请求头未转发）**——原 `middleware.ts` 仅 `response.headers.set(x-admin-preview)`（响应头），但 RSC `shouldUsePreview()` 读的是**请求头**（`headers()`）；next-intl rewrite 经 `new Headers(request.headers)` 转发请求头 → 修复 = 在 `intlMiddleware(req)` **之前** `req.headers.set(x-admin-preview,'1')`（响应头同步保留供 curl 排障）；**B-2（token 交换空 body 400）**——`getAdminAccessToken` 调 `/auth/refresh` 发 `content-type: application/json` 但无 body → fastify `FST_ERR_CTP_EMPTY_JSON_BODY` 400 → accessToken null → 永久降级 public → 未发布视频 `notFound()` 404；修复 = 去 content-type（凭 cookie 鉴权无需 body）。**两 bug 叠加致 ADR-160 preview 自上线从未生效**。③ 端到端验证矩阵（dev :3000+:4000，真实 admin cookie）：未发布+preview+双 cookie **404→200** / 无 cookie 正确降级 404 / 已发布 preview 200 / builder zh-CN URL 200。④ 测试：新建 `admin-preview-url.test.ts`（5 用例 segment/slug/locale）+ middleware 测试补 buildRequest 真实 Headers + 正向 case 双面断言（**请求头**为 RSC 读取面）+ admin-access-token 补 content-type 不发 + body undefined 守卫。⑤ **登记**：B-1/B-2 是 ADR-160 实现 bug 非协议语义变更（无需新 ADR / architecture.md schema 同步）；preview 修复波及 web-next 但属审核台预览链路，PLAYER/SEARCH 域无关。共享层沉淀：是——preview URL 派生入 server-next lib 单点（PendingCenter 唯一消费，未来视频库预览入口可复用）。门禁：typecheck/lint EXIT=0 / test:changed 30 passed（含新 22 P1-3 相关）/ e2e:admin 82/82 EXIT=0 / web-next 真库手测矩阵全绿。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
6. **MODUX-P1-4** — 线路按钮 + 筛选预设调查确认（item 10+6）（状态：✅ 已完成 2026-06-10 23:13）
   - 创建时间：2026-06-10 22:04 ｜ 实际开始：2026-06-10 23:06 ｜ 完成时间：2026-06-10 23:13
   - 验收口径：结论登记（清除失效/刷新已接通；预设双源已实装）；微调清除失效 toast 一致性；既有单测通过。
   - 文件范围（实施修正：lines-panel 实际在 `composite/lines-panel/`；微调含 controller + types + LinesPanel 三处加性）：`apps/server-next/src/lib/sources/types.ts`、`use-source-lines-controller.ts`、`apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx` + controller 单测。
   - 依赖：MODUX-P1-1-A ✅。建议模型：sonnet。
   - **完成备注**：**调查结论登记**：① 清除失效（`disableDead`）/刷新（`refetch`）均已接通后端（`useSourceLinesController` → `disableDeadSources`/`refetchSources`，结构化 `SourceActionResult` 反馈）；P1-1-A 已确认审核台 page-head（含 preset 按钮）随 PageHeader 收敛。② 筛选预设双源已完整实装（`use-filter-presets.ts` + `FilterPresetPopover` + `SavePresetModal`，DB+localStorage）。**微调（item 10 反馈一致性）**：`disableDead` 原仅失败红条、成功静默（与批量探测/试播成功 toast 不一致）→ 加性扩 `SourceActionResult.disabledCount?`（optional，sources 模块类型非 admin-ui 公开 Props 不触发 Opus）+ controller success 携带 `res.disabled` + LinesPanel 补成功 toast（禁用 N 条 success / 无失效 info）。**显式不做二次确认**：清除失效仅禁用 probe+render 双 dead 线路（已不可用）且可逆（toggle 恢复），加 confirm 与「提升审核效率」冲突——方案"二次确认"项判定不采纳（登记理由）。**不触发 onSourceHealthChanged**：遵守 SRCHEALTH-P1-4 裁定。③ 登记：IDE 报 test:374 batchRenderCheckVideo mock summary 缺 partial 为 pre-existing（全量 typecheck EXIT=0 未纳入，范围外不动）。共享层沉淀：否。门禁：typecheck/lint EXIT=0 / controller 19/19 / test:changed 59 passed / e2e:admin 82/82 EXIT=0。执行模型: claude-fable-5（建议 sonnet，用户会话人工覆盖持续推进授权）；子代理: 无。
   - **Phase 1（P1-0~P1-4 共 6 卡）全部收口 ✅ 2026-06-10**：标题治理（item 5）+ DecisionCard 精简（item 11/12）+ 前台预览 404 修复（item 2，ADR-160 两叠加 bug）+ 线路按钮/预设确认（item 10/6）。下一步 Phase 2 信息密度（P2-1 列表单元格 / P2-2 详情 tab / P2-3 键盘流）。
   - **MODUX-ACPT-5（item 5 人工验收纠正迭代，非序列编号卡）全收口 ✅ 2026-06-18**：P1 人工验收第 5 条「标题重复+紧凑化」不通过 → ACPT-5 专卡反向修正（面包屑作唯一标题、删 body h1、tab 行紧凑化、快编芯片化）7 轮 + Codex 3 轮拦截，3 检查点提交（b6496861/587b2999/58ca2fc4）。2026-06-18 恢复跑**全量验收门禁全绿**（typecheck/lint/moderation 单测 88/e2e admin 84/verify:adr-contracts 均 EXIT=0）；visual baseline 因本地 storageState admin cookie 过期全套（含无关 crawler/user-submissions）停登录页 timeout（非本卡回归 + 非必跑门禁，详见 changelog [MODUX-ACPT-5 收口]）。tasks.md 卡已删。

### 任务列表（Phase 2 — 信息密度与布局，前端）

7. **MODUX-P2-1** — 待审列表单元格 + page-head 紧凑化（item 4）（状态：✅ 已完成 2026-06-10）
   - 验收口径：`ModListRow` 分区重构（封面+标题行+元信息行+信号/富集行），280px 列内层级清晰，次要信息 hover 透出；审核台 page-head 占位/键盘提示收敛。
   - 文件范围：`apps/server-next/src/app/admin/moderation/_client/ModListRow.tsx`、`ModerationConsole.tsx`（page-head 部分）。
   - 依赖：MODUX-P1-1-A。建议模型：sonnet。
   - **完成备注**：① **ModListRow 分区重构**：右侧栏 `marginTop:2/4` 散排 → `column`+`gap:4` 三分区（标题行／元信息行／信号富集行）；元信息行 `space-between` 让 type·year 与 badge 占满 280px 列宽两端；badge 次要信息收敛——右对齐 `flexShrink:0`+`maxWidth:55%` 截断、多项折叠「首项 +N」、完整文案经 `title` hover 透出（保留 warning 语义色不加突出背景）。DOM 契约 `role=option`/`data-mod-list-row`/`data-video-id`/`data-batch-selected`/`mod-list-checkbox-*`/`aria-selected` 全保留；新增 `data-mod-row-badge` 锚点。② **page-head 收敛**：常驻 `J/K/A/R/S` KBD 串（硬编码）→ 收口已有 i18n，渲染 `M.kbdFlowLabel`「键盘流」紧凑标记（虚线下划 affordance）+ `title=M.kbdHint` hover 透出完整提示；今日统计保留；删除收敛后无引用的 `KBD` 常量；为 P2-3 help 浮层预留提示位（`data-kbd-hint`）。③ **偏离登记**：方案"次要信息 hover 透出"未做成 badge 完全隐藏——badge 是审核决策 warning 信号，折中保留首项可见 + title 透出完整，兼顾收敛与扫视可达性。共享层沉淀：否（ModListRow 仅审核台消费，无跨消费方）。门禁：typecheck/lint EXIT=0 / test:changed 10 passed（ModListRow selectionMode + enrichment moderation DOM 契约保留）/ **e2e:admin 82/82 EXIT=0**。执行模型: claude-opus-4-8（建议 sonnet，用户会话覆盖持续推进）；子代理: 无。
8. **MODUX-P2-2** — 详情 tab 重设计（item 7）（状态：✅ 已完成 2026-06-10）
   - 验收口径：状态三元组 3 行 DetailRow → 1 行 3 Pill（variant ok/warn + dot）；富集/豆瓣/外部源重叠信息收敛；详情 tab 行数下降无重复信息块。
   - 文件范围：`apps/server-next/src/app/admin/moderation/_client/RightPane/TabDetail.tsx`（路径勘误：原写少 RightPane/；复用 `packages/admin-ui/src/components/cell/pill.tsx`，不改 Pill 公开 Props）。
   - 依赖：无。建议模型：sonnet。
   - **完成备注**：① **状态三元组 3 行 → 1 行 Pill 组**：发布/可见性/审核 3 DetailRow（纵向）→ 复用 admin-ui `Pill`（variant ok/warn + 内置 6px dot）横向集约；isPublished 布尔转中文态（已发布/未发布，与文件既有 inline 中文 section header 范式一致），visibility/review 保留枚举值（public/approved，与原 DetailRow value 逐字一致 + 本就语义清晰）；每 Pill 补 ariaLabel（label: value）无障碍。② **豆瓣收敛**：独立 section header「豆瓣状态」+ douban_status DetailRow（2 行）→ 同行第 4 Pill（matched→ok/其它 warn，文案「豆瓣状态 {doubanLabel}」），消除独立块。状态类信息 5 行（3 三元组 + 2 豆瓣）→ 1 行 Pill 组。③ **不改 Pill 公开 Props**（不触发 types.ts Opus trailer）；DetailRow 保留供信息区（type/year/country/episodes/meta_score/source_check）。④ **偏离登记**：富集 cluster（即时 v.summary header density）+ 外部源 panel（懒加载 extDetail 完整 compact density）**不深度合并**——数据源/时机/density 不同，非纯重复块，深度合并涉 EnrichmentBadgeCluster/ExternalMetaPanel 共享组件职责超本卡 TabDetail 范围。测试契约保留：data-right-detail-enrichment / meta_score 文本 / episodes 三维文案 / moderation-detail-reprobe-all testid 全过；新增 data-status-triad 锚点。共享层沉淀：否（TabDetail 仅审核台详情消费）。门禁：typecheck/lint EXIT=0 / test:changed 14 passed（enrichment-cluster + TabDetailEpisodes + TabDetailReprobe）/ **e2e:admin 82/82 EXIT=0**。执行模型: claude-opus-4-8（建议 sonnet，用户会话覆盖持续推进）；子代理: 无。
9. **MODUX-P2-3** — 键盘流完善（item 1）（状态：✅ 已完成 2026-06-11）
   - 验收口径：审核台局部挂载共享无渲染组件 `<KeyboardShortcuts bindings>` 替换原生 keydown（不混入 AdminShell 全局）；扩 E 编辑/P 预览/数字键选集线路/F 筛选/`/` 搜索/`?` 帮助浮层；批量模式守卫 + allowInInput；与全局快捷键无冲突。
   - 文件范围：`apps/server-next/src/app/admin/moderation/_client/PendingPaneController.tsx`、`KeyboardHelpOverlay.tsx`（新，审核台局部）；消费 `packages/admin-ui/src/shell/keyboard-shortcuts.tsx`（不改其 API）。
   - 依赖：MODUX-P2-1（快捷键提示位随布局定）✅。建议模型：sonnet。
   - **完成备注**：① **原生 keydown → 共享 `KeyboardShortcuts`**：删 `PendingPaneController.tsx:110-123` 手写 `window.addEventListener('keydown')`，改挂 `<KeyboardShortcuts bindings>`（不改其 API）；input/mod 守卫由共享组件统一处理（allowInInput 默认 false）。② **单一真源** `shortcuts` 配置数组派生 bindings + help 列表（避免双份漂移）。③ **扩快捷键**：E 编辑（onEditVideo）/ P 预览（buildAdminPreviewUrl 单一收口 + window.open）/ `/` 聚焦搜索（query `pending-queue-search-input` + preventDefault）/ `shift+?` help 浮层（matchesEvent 严格比 shiftKey，按 ? 时 event.key='?' → spec 'shift+?'）。④ **批量守卫**（修复现状隐患——旧实现注释自承「批量模式 A/R/S 仍触发」）：batchSafe 标记，批量模式仅 J/K/`/`/`?` 生效，A/R/S/E/P 暂停；help 浮层打开时仅留 `?` 切换（Modal 自处理 Esc/遮罩）。⑤ **help 浮层** `KeyboardHelpOverlay`（新，审核台局部）复用 admin-ui `Modal`（不手写 backdrop/Esc/Portal）；左 pane「键盘流」label 升级为可点击 help 入口（`?` 键并行，呼应 P2-1 提示位）。⑥ **登记**：P 预览 window.open 与 PendingCenter 重复 1 处（2 处 < 3 处提取阈值，未抽 lib）；ModerationConsole BTN_PRIMARY/BTN_DANGER/v 为 P1-1-A 既有死代码（超本卡范围不动，typecheck/lint 绿）。新增 6 单测（导航/审核/编辑/批量守卫×2/help 浮层）+ 新 testid `moderation-keyboard-help` / `moderation-keyboard-help-trigger`。共享层沉淀：否（审核台局部键盘流，设计明确不混 AdminShell 全局）。门禁：typecheck/lint EXIT=0 / test:changed 6 passed / **e2e:admin EXIT=0**。执行模型: claude-opus-4-8；子代理: 无。
   - **MODUX-P2-3-FIX（Codex stop-time review 拦截补全 2026-06-11）**：原 P2-3 标记完成时验收口径明列的「数字键选集线路 / F 筛选」未实装、以"延后登记"绕过硬验收项——**已纠正**：⑦ **数字键 1–9 选线路已实装**（前述误判"超文件范围"——moderation `_client/LinesPanel` 仅 PendingCenter 受控消费，挂审核台局部 `<KeyboardShortcuts>` + selectLineByIndex 复用 onLineSelect 既有切源路径〔关键路径回归 e2e:admin 82/82〕；sources 展开无 onLineSelect → 不挂载零影响；help 浮层补「线路」组 1–9 静态文档项）。⑧ **F 筛选正式归并 MODUX-P3-2**（非延后埋备注——筛选弹层确为 P3-2 交付物，task-queue P3-2 验收已 amend「F 键打开筛选弹层」+ 文件范围补 F binding 接入点 + help「筛选」组，跨卡契约显式落账）。补 4 单测（LinesPanel 数字键：第 1/2 条选中 + 越界不触发 + 无 onLineSelect 不绑定）。门禁：typecheck/lint EXIT=0 / test:changed 13 passed / **e2e:admin 82/82 EXIT=0**。
   - **MODUX-P2-3-FIX-2（Codex review 第 2 轮拦截 2026-06-11）**：「numeric shortcuts stay active behind the help modal」——help 模态打开时数字键仍在背后误切线路（controller 在 helpOpen 时过滤自身 bindings 为仅 `?`，但数字键 KeyboardShortcuts 在 LinesPanel、不感知 helpOpen + window 级监听不感知模态）。**修复**：selectLineByIndex 前加通用模态守卫 `document.querySelector('[aria-modal="true"]')` 存在则抑制——不透传 helpOpen 两层，一并覆盖 help/拒绝/编辑抽屉等全部 admin-ui Modal/Drawer（均设 aria-modal=true，已核）。补 1 守卫单测（aria-modal 元素在 DOM → 数字键不触发）。门禁：typecheck/lint EXIT=0 / test:changed 14 passed / **e2e:admin 82/82 EXIT=0**。
   - **Phase 2（P2-1/-2/-3 共 3 卡）全部收口 ✅ 2026-06-11**：信息密度——列表单元格分区（item 4）+ 详情 Pill 化（item 7）+ 键盘流共享化/批量守卫/help 浮层（item 1）。下一步 Phase 3 功能增强（P3-1-A 富集枚举语义 + query schema 起）。

### 任务列表（Phase 3 — 功能增强，前后端含 ADR 核验）

10. **MODUX-P3-1-A** — 富集状态枚举语义 + 共享类型 + query schema（item 3 后端上半）（状态：✅ 已完成 2026-06-11）
    - 验收口径：定义富集枚举语义（建议 missing/partial/complete，**从 raw 字段/provenance 派生**，不按 UI enrichmentSummary 反推）；`PendingQueueQuerySchema` 加 year/decade + enrichmentStatus；共享类型 `PendingQueueQuery` 同步扩。
    - 文件范围：`apps/api/src/routes/admin/moderation.ts`（schema 部分）、`packages/types/src/admin-moderation.types.ts`、`packages/types/src/index.ts`（value 导出 plumbing）、`docs/architecture.md`（枚举派生同步）、moderationQueueRoutes 单测。**非新端点**（verify:endpoint-adr 不触发）；跑 `verify:adr-contracts`。
    - 依赖：无（Phase 3 启动）。建议模型：sonnet。
    - **完成备注**：① **富集枚举从 raw 派生（不按 enrichmentSummary 反推）**：`ENRICHMENT_STATUSES=['missing','partial','complete']`（admin-moderation.types.ts 真源 + index.ts value 导出 plumbing——`export type *` 不带 const，仿 deriveAggregateState 先例）。派生语义（raw：`v.meta_quality->>'enriched_at'` / `v.douban_status` / `mc.bangumi_subject_id` / `mc.douban_id·tmdb_id·imdb_id`）：complete=`enriched_at IS NOT NULL AND (douban_status='matched' OR bangumi_subject_id IS NOT NULL)`；missing=`enriched_at IS NULL AND douban_id/tmdb_id/imdb_id/bangumi_subject_id 全 NULL`；partial=其余。**互斥穷尽**（不会同时 missing+complete）。**关键决策**：不复用 buildEnrichmentSummary 派生的 EnrichmentSummary——后者默认填 'pending'/0，会丢失"从未富集"信号（missing/partial 不可区分）。② `PendingQueueQuery` 加 `year?`/`decade?`/`enrichmentStatus?`（加性可选）；`PendingQueueQuerySchema` 加 year/decade（`z.coerce.number().int().min(1900).max(2100)`）+ enrichmentStatus（`z.enum(ENRICHMENT_STATUSES)`）。③ architecture.md §5.12 末补「待审队列过滤维度扩展」段（枚举派生 + year/decade 语义；decade=起始年 `mc.year ∈ [decade,decade+10)`）。④ **本卡仅契约层**：DB query WHERE 过滤 + 预设兼容 = P3-1-B；route handler 已直传 `parsed.data`→`listPendingQueue`，新字段结构兼容（PendingQueueFilters 独立镜像，暂忽略新字段）。⑤ 补 2 单测（year/decade/enrichmentStatus 透传 + 非法 enrichmentStatus 422）。共享层沉淀：是（ENRICHMENT_STATUSES 单一真源跨 API/前端/P3-1-B）。门禁：typecheck/lint EXIT=0 / **verify:adr-contracts EXIT=0**（加性后向兼容）/ test:changed 升全量 **7159 passed 零失败**（packages/types 基础包，ADR-180）/ e2e:admin 82/82 EXIT=0。执行模型: claude-opus-4-8（建议 sonnet）；子代理: 无（方案模型标记 P3-1 非强制 Opus）。
11. **MODUX-P3-1-B** — Service/DB query 过滤实现 + 预设兼容（item 3 后端下半）（状态：✅ 已完成 2026-06-11）
    - 验收口径：API 按 year/decade/enrichment 过滤正确；筛选预设 JSON 快照新字段保存 + 旧预设缺字段向后兼容（`use-filter-presets.ts` FilterPresetQuery）；契约核验通过。
    - 文件范围（路径勘误：use-filter-presets 实际在 `lib/moderation/`）：`apps/api/src/db/queries/moderation.ts`、`apps/server-next/src/lib/moderation/use-filter-presets.ts`、DB query WHERE 单测 + 预设单测。
    - 依赖：MODUX-P3-1-A ✅。建议模型：sonnet。
    - **完成备注**：① **DB query 过滤**：`PendingQueueFilters` 加 year/decade/enrichmentStatus；`ENRICHMENT_STATUS_SQL` const（complete/missing 固定片段 + partial=`NOT complete AND NOT missing`，**零用户输入零注入**，对齐 P3-1-A/architecture.md 派生语义）；listPendingQueue WHERE 在 q 后/cursor 前加 year(`mc.year=$`)/decade(`mc.year>=$ AND <$`，区间 [decade,decade+10))/enrichmentStatus（片段）。② **关键修复**：count 查询（`SELECT COUNT(*) FROM videos v WHERE`）原**不 JOIN media_catalog**，加 `mc.*` 过滤会破坏——**无条件补 `JOIN media_catalog mc ON mc.id=v.catalog_id`**（INNER on FK catalog_id NOT NULL → 保数不变 + 与 main 查询表作用域对齐）；count 参数切片 `idx-(cursor?3:1)` 不变（新参数 enrichmentStatus 0/year 1/decade 2 均在 cursor 前）。③ **预设兼容**：`FilterPresetQuery` 加 year/decade/enrichmentStatus（**optional → 旧预设缺字段=undefined 自动向后兼容**）+ summarizeQuery 展示（`2024`/`2020s`/`富集:complete`）。④ **本卡后端能力 + 预设类型，独立可验**；前端 fetchPendingQueue 序列化 + URL sync(FILTER_KEYS) + 筛选弹层 UI = **P3-2**。⑤ 补 9 单测（DB WHERE 7：year/decade/complete/missing/partial/count JOIN/无过滤加性；预设 2：新字段展示 + 旧预设兼容）。共享层沉淀：复用 P3-1-A 枚举真源。门禁：typecheck/lint EXIT=0 / **verify:adr-contracts EXIT=0** / test:changed 223 passed / **e2e:admin 82/82 EXIT=0**。执行模型: claude-opus-4-8（建议 sonnet）；子代理: 无。
    - **P3-1 后端闭环 ✅ 2026-06-11**（A 契约 + B 实现）：审核台待审队列 year/decade/enrichmentStatus 过滤后端就绪 + 预设兼容；前端筛选弹层消费 = P3-2。
12. **MODUX-P3-2** — 待审列表筛选弹层（item 3 前端）（状态：✅ 已完成 2026-06-11）
    - 验收口径：toolbar 加筛选按钮开弹层/抽屉（窄列表不内联），覆盖 类型/年代/富集/探测/豆瓣/备注/人工；与 `q` 搜索框 + 预设按钮在 280px 内排布不溢出；URL/预设打通（applyFiltersToUrl）。**+ F 键打开筛选弹层**（MODUX-P2-3-FIX 跨卡契约归并：P2-3 验收口径的「F 筛选」快捷键因当时筛选弹层未建，正式归并本卡——本卡建弹层时一并接 F 键 binding，挂审核台局部 KeyboardShortcuts，allowInInput=false，与既有 J/K/A/R/S/E/P///? 无冲突）。
    - 文件范围：`apps/server-next/src/app/admin/moderation/_client/`（PendingQueueToolbar + 筛选弹层新组件 + F 键 binding 接入点〔ModerationConsole 或 PendingPaneController，弹层 state owner 处〕 + help 浮层「筛选」组补项）。
    - 依赖：MODUX-P3-1-B。建议模型：sonnet。
    - **完成备注（2026-06-11，执行模型 claude-opus-4-8，子代理无）**：新建 `PendingFilterPanel.tsx`（复用 admin-ui Modal + AdminSelect + enum options + ENRICHMENT_STATUSES，7 维 draft→应用/清除）；PendingQueueToolbar 加「筛选」按钮（onOpenFilters 回调 + 维度计数 badge，未破「只显示」职责）；PendingPaneController 持 filterPanelOpen + F 键 binding（group 筛选，batchSafe，F=open-only，弹层开→bindings=[] 交 Modal 关闭）+ help 自动补「筛选」组；ModerationConsole FILTER_KEYS/read/write 扩 year/decade/enrichmentStatus（正整数 + 枚举校验防 422）+ onApplyFilters=applyFiltersToUrl；api.ts fetchPendingQueue 序列化扩 3 维；moderation i18n 加 filterPanel 块。**关键复用**：筛选 Modal aria-modal → LinesPanel 既有 `[aria-modal]` 守卫自动护住 1–9 数字键（零额外 prop drilling）；URL 单向回流复用预设 apply 同路径。门禁全绿：typecheck/lint/verify:adr-contracts EXIT=0、test:changed 95、e2e:admin 82/82。剩余 Phase 3：P3-3（类似 tab 阈值）/ P3-4-A·B（/meta 补 country + 4 字段快编）。
13. **MODUX-P3-3** — 类似 tab 合并优先 + 阈值过滤（item 8）（状态：✅ 已完成 2026-06-11）
    - 验收口径：identityScore/similarityScore 低于阈值不显示/折叠；「发起合并」为主操作（buildMergeHref 已有）；必要时后端 listSimilar 加排序/阈值参数（加性）。
    - 文件范围：`apps/server-next/src/app/admin/moderation/_client/TabSimilar.tsx`（+ 必要时 `apps/api/src/routes/admin/moderation.ts` SimilarQueryParams 加性扩展）。
    - 依赖：无。建议模型：sonnet。
    - **完成备注（2026-06-11，执行模型 claude-opus-4-8，子代理无）**：纯客户端实现——TabSimilar 加相关度阈值 Segment（全部/≥40/≥60/≥80，默认 60）+ 高/低相关折叠（low 折进展开器，不丢数据，切「全部」恢复全量）+ 「发起合并」升 primary 主操作。**关键判定：无需后端加性参数**——similarityScore 两源统一 0-100 量纲（identity=round(identityScore×100) / legacy=4 维加权 clamp 0-100，ModerationService.ts:410）且后端已 DESC 排序，单一客户端阈值统一适用（不触发 verify:endpoint-adr）。提取 renderRow 去重；补 3 单测（默认折叠+展开 / 全部无折叠 / merge data-variant=primary）。门禁全绿：typecheck/lint/verify:adr-contracts EXIT=0、test:changed 22、e2e:admin 82/82。剩余 Phase 3：P3-4-A（/meta 补 country 后端）+ P3-4-B（4 字段内联快编 UI）。
14. **MODUX-P3-4-A** — `/meta` 端点补 country（item 9 后端）（状态：✅ 已完成 2026-06-11）
    - 验收口径：**唯一写路径 = `PATCH /admin/moderation/:id/meta`**（保留 pending-only 守卫，不走 videos PATCH）；MetaEditSchema 补 `country` + service/共享类型/测试同步；非新端点。
    - 文件范围：`apps/api/src/routes/admin/moderation.ts`（MetaEditSchema）、moderation service、`packages/types/src/admin-moderation.types.ts`、单测。
    - 依赖：无。建议模型：sonnet。
    - **完成备注（2026-06-11，执行模型 claude-opus-4-8，子代理无）**：MetaEditSchema 补 `country: z.string().max(10).nullable().optional()`（对齐 videos.ts:71）。**VideoService.update 已支持 country（VideoService.ts:404）→ service 零改**；**无共享 MetaEditInput 类型 + VideoQueueRow.country 读模型已在 → packages/types 零改**（card「类型同步」空满足）。补 3 单测（透传/null/超长 422）。非新端点 verify:endpoint-adr EXIT=0。门禁全绿：typecheck/lint/verify:adr-contracts/verify:endpoint-adr EXIT=0、test:changed 89、e2e:admin 82/82。剩余：P3-4-B 前端 4 字段内联快编 UI（依赖本卡 ✅）。
15. **MODUX-P3-4-B** — 审核主界面 4 字段内联快编 UI（item 9 前端）（状态：✅ 已完成 2026-06-11）
    - 验收口径：类型/题材一键切换（Segment/Pill popover + getVideoTypeOptions/getVideoGenreOptions）、年代步进/输入、地区内联输入；乐观更新 + 失败回滚 + 队列/详情联动刷新；4 字段免开面板即改、单写路径。
    - 文件范围：`apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx` + 内联快编新组件（审核台局部）。
    - 依赖：MODUX-P3-4-A。建议模型：sonnet。
    - **完成备注（2026-06-11，执行模型 claude-opus-4-8，子代理无）**：新建 PendingMetaQuickEdit（类型 AdminSelect / 年代 number 步进 / 地区 text / 题材 AdminSelect multiple）；type/year/country 由 v 种子，**genres 经既有 getVideo(v.id) lazy-fetch**（VideoQueueRow 无 genres → 不越界改 types/DB）；逐字段乐观更新 + 失败回滚 + toast + year 客户端预校验。api.ts 加 saveModerationMeta（单写路径 /meta）。PendingCenter 插入组件，**复用 onSourceHealthChanged→refetchQueue 联动刷新**（不穿透新 prop）。补 7 单测 + 牵连修 split-button stub。门禁全绿：typecheck/lint/verify:adr-contracts EXIT=0、test:changed 105、e2e:admin 82/82。**SEQ-20260610-03 全收口（15/15）**。
    - **P3-4-B-FIX（Codex stop-time review 拦截 2026-06-11）**：被锁字段（skippedFields 非空）快编只弹 warn 未回滚乐观值 → 未保存显示为已保存。修复：commit() skipped 分支补 revert()；type 受控天然正确。+1 单测。
    - **P3-4-B-FIX2（Codex stop-time review 第 2 拦截 2026-06-11）**：前次 FIX 在 skipped 时 return 跳过 onSaved，但 VideoService.update 把 type 等冗余写 videos 表副本（不过 catalog 锁）→ catalog 被锁 skip 时 videos 副本可能已落库 → 跳 onSaved 隐藏真实写入。修复：① `skippedFields.includes(key)` 仅回滚确被锁字段（不误回滚已保存字段）；② **始终调 onSaved** 反映真实持久态。+1 单测。门禁全绿（typecheck/lint/verify:adr-contracts EXIT=0、test:changed 21、e2e:admin 82/82；e2e 首跑 EADDRINUSE 环境噪声清理后绿）。

> **SEQ-20260610-03 MODUX 全 15 卡完成（2026-06-11）**：Phase 1（标题治理 P1-0~P1-1-B / DecisionCard P1-2 / 前台预览 404 P1-3 / 线路按钮·预设 P1-4）+ Phase 2（ModListRow 三分区 P2-1 / 详情 Pill 化 P2-2 / 键盘流共享化 P2-3〔Codex 两轮拦截补全〕）+ Phase 3（P3-1-A/-B 后端富集·年代过滤 / P3-2 筛选弹层 / P3-3 类似 tab 阈值折叠 / P3-4-A /meta 补 country / P3-4-B 4 字段内联快编）。PHASE COMPLETE 全量兜底见 changelog。

### 门禁与验证（每卡）

- 必跑：`npm run typecheck` / `npm run lint` / `npm run test:changed`（commit 前）；审核台改动后 `npm run test:e2e:admin`。
- **强制 Opus 子代理**：P1-0 规约决策；P1-1-A 若扩 PageHeader 公开 Props；P1-2 若改 DecisionCardProps（`packages/admin-ui/**/types.ts` 强制项 + commit trailer）。
- **ADR 核验**：P3-1 系列跑 `verify:adr-contracts` + 涉枚举派生同步 `docs/architecture.md`；全程无新增 admin route → `verify:endpoint-adr` 不触发。
- 手测关键路径清单见方案「验证方式」节。

---

## [SEQ-20260611-01] 视频详情/播放页 404 修复（shortId 字母表冲突 + admin preview 链路收口遗漏）

- **状态**：✅ 已完成（4/4 卡收口 2026-06-11；404 四根因中 ①②④ 修复，③ 为 ADR-160 设计内降级——可观测性增强候补）
- **创建时间**：2026-06-11
- **最后更新时间**：2026-06-11
- **目标**：修复用户报告「后台预览视频播放页/详情页有时 404」+「前台已公开视频同样 404」。调查实证四根因（本会话调查记录）：① 视频库「查看详情（前台）」相对路径开后台域 + 缺 `?preview=admin`；② 前台详情页跳 watch 丢 `?preview=admin`；③ refresh_token 过期静默降级（ADR-160 D-160-4b 设计内，不修）；④ **`CrawlerService` 用 nanoid 默认字母表（含 `-`/`_`）生成 short_id，与 `extractShortId`「最后一个 `-` 分隔」协议冲突——dev 库 4337 视频 526 个（12.1%）命中，含 9 个已公开视频前台必现 404**。
- **范围**：apps/api（生成收口 + migration 110 + resync 脚本）/ apps/server-next（VideoRowActions 链接收口）/ apps/web-next（watch 跳转 preview 透传）。
- **依赖**：无 BLOCKER。关联 ADR-002（Slug + 短 ID 混合 URL）/ ADR-160（Admin Preview，本序列不改其协议，仅消费）。
- **不做**：根因 ③（设计内降级，改善可观测性候补）；`VideoDetailHero`/`EpisodeGrid`/`VideoCardWide` 三个零消费方死代码组件（独立 CHORE 候补）；含 `_` 的 516 个存量 short_id（URL 合法且解析无损，改之反断既有公开链接）。

### 任务列表

1. **BUGFIX-SHORTID-DASH-A** — short_id 生成收口：排除 `-`/`_` 字母表 + 三处重复生成点合一（状态：✅ 已完成 2026-06-11）
   - 创建时间：2026-06-11 ｜ 实际开始：2026-06-11 ｜ 完成时间：2026-06-11
   - 验收口径：所有新生成 short_id 恒为 8 位 `[0-9A-Za-z]`（与 `extractShortId` 分隔协议、`CHAR(8)` 定长列双兼容），生成逻辑全仓唯一真源。
   - 文件范围：`apps/api/src/lib/short-id.ts`（新建 `generateShortId`）、`apps/api/src/services/CrawlerService.ts:217`、`apps/api/src/db/queries/videos.mutations.ts:28`、`apps/api/src/services/VideoMergesService.ts:805`、`apps/api/src/templates/queries.template.ts`（执行中补入，bug 传播媒介）、`tests/unit/api/short-id-generate.test.ts`（新建）。
   - 依赖：无。建议模型：sonnet。
   - **完成备注（2026-06-11，执行模型 claude-fable-5，子代理无）**：lib/short-id.ts 唯一真源（customAlphabet 62 字符定长 8，头注锁双契约）；三处生成点 + 模板替换；+4 契约单测（含 extractShortId 往返）+ ingestPolicy.test nanoid mock 跟随。门禁：typecheck/lint EXIT=0、test:changed 84 文件 1227 passed。明细见 changelog [BUGFIX-SHORTID-DASH-A]。
2. **BUGFIX-SHORTID-DASH-B** — 存量清洗：migration 110 重新生成含 `-` 的 short_id + ES 重同步脚本（状态：✅ 已完成 2026-06-11）
   - 创建时间：2026-06-11 ｜ 实际开始：2026-06-11 ｜ 完成时间：2026-06-11
   - 验收口径：DB 零行 `short_id LIKE '%-%'`（幂等可重跑），受影响行 ES 文档 short_id 同步更新，9 个公开视频前台详情可达。
   - 文件范围：`apps/api/src/db/migrations/110_videos_short_id_dash_cleanup.sql`（新建，DO 块逐行重生成 + 唯一重试 + `updated_at` touch）、`scripts/resync-es-short-id.ts`（新建一次性脚本，复用 `VideoIndexSyncService.syncVideo`）。
   - 依赖：BUGFIX-SHORTID-DASH-A（先收口生成侧防爬虫续产坏数据）。建议模型：sonnet。
   - **完成备注（2026-06-11，执行模型 claude-fable-5，子代理无）**：真库实测 526 行清洗 + 幂等重放 0 命中；ES 实跑 2768 条（sync 441 / unindex 2327 幽灵文档附带清理）复跑收敛零残留；端到端抽验原必现 404 公开视频 HTTP 200。遗留：ES 幽灵文档成因候补卡（reconcileStale 仅 7 天窗）。明细见 changelog [BUGFIX-SHORTID-DASH-B]。
   - **-B-FIX（Codex stop-time review 拦截 2026-06-11）**：「migration leaves persisted banner short_id references stale」——初版 110 重写 short_id 未同步引用方；`home_banners.link_target`（link_type='video'）直存 short_id 会断链。修订 110：重写循环内同事务 UPDATE banner 引用 + 头注全仓引用排查结论（home_modules=UUID 不受影响）。dev 对账 video banner **0 行**（初版/修订版语义等价无数据缺口）；prod 未跑 110，修订版完整生效。教训：ID 重写 migration 必须同事务同步全部持久化引用方。明细见 changelog [BUGFIX-SHORTID-DASH-B-FIX]。
   - **-B-FIX2（Codex stop-time review 第 2 拦截 2026-06-11）**：「still misses persisted banner short_id references in JSONB configs」——FIX1 只同步直存列，漏掉两处整页 HomePageConfig JSONB 内嵌引用：`home_config_drafts.config`（发布全量替换写回）+ `home_publish_versions.config`（回滚恢复三表写回，「不可变归档」例外论证入头注）。修订 110 循环内补两处 JSONB 同步（WITH ORDINALITY 保数组序）；autofill candidates 经查 videoId UUID 不受影响。dev 对账 drafts 0 行 / versions 5 行 0 stale；事务内构造数据全链路验证四处同步 + external 条目不误改 + ROLLBACK 不留痕。明细见 changelog [BUGFIX-SHORTID-DASH-B-FIX2]。
   - **-B-FIX3（Codex stop-time review 第 3 拦截 2026-06-11）**：「draft update advances updated_at and can hide stale drafts」——FIX2 草稿 UPDATE 经 098 trigger 推进 updated_at → staleness `tablesNewer` 信号翻 false → 过期草稿可被发布覆盖正式表。修订 110：DO 块前后 DISABLE/ENABLE trigger，机械 ID 重映射不扰动陈旧性判定；versions 无 updated_at 列 / banner 推进属诚实保守信号（边界裁定入头注）。验证：构造陈旧草稿（updated_at 过去值）→ 跑 110 → config 同步 + updated_at 保持 + trigger 恢复 → ROLLBACK。明细见 changelog [BUGFIX-SHORTID-DASH-B-FIX3]。
   - **-B-FIX4（Codex stop-time review 第 4 拦截 2026-06-11）**：「false home_banners trigger rationale introduced in FIX3」——home_banners 实有 049 `home_banners_set_updated_at_trg`（pg_trigger 实查），FIX3「无 trigger」论述为事实错误（049 仅读前 48 行漏 trigger 段）。勘误头注（各表 trigger 实况三条：banners 有 / videos 仅状态机 / versions 无）+ 删 banner UPDATE 冗余显式 SET updated_at（trigger 覆盖徒留误导）。行为零变化、裁定保留（论据勘正为「trigger 自然推进」）。验证：banner 过去时间戳 → 跑 110 → 同步 + trigger 推进 + 草稿保持 → ROLLBACK。明细见 changelog [BUGFIX-SHORTID-DASH-B-FIX4]。
3. **BUGFIX-PREVIEW-LINK-A** — 视频库「查看详情（前台）」改走 buildAdminPreviewUrl 收口（状态：✅ 已完成 2026-06-11）
   - 创建时间：2026-06-11 ｜ 实际开始：2026-06-11 ｜ 完成时间：2026-06-11
   - 验收口径：视频库行操作打开的前台详情 URL = `WEB_NEXT_ORIGIN + /locale + detailHref + ?preview=admin`（与 moderation「前台预览」同口径），本地 `getDetailHref` 重复实现删除。
   - 文件范围：`apps/server-next/src/app/admin/videos/_client/VideoRowActions.tsx`（slug 投影缺失传 `null`，detail 页裸 shortId 兼容）。
   - 依赖：无（与 -A/-B 正交）。建议模型：sonnet。
   - **完成备注（2026-06-11，执行模型 claude-fable-5，子代理无）**：buildAdminPreviewUrl 收口 + 删本地 getDetailHref 重复实现；+1 完整 URL 断言用例。门禁：typecheck/lint EXIT=0、test:changed 64、e2e:admin 82/82。明细见 changelog [BUGFIX-PREVIEW-LINK-A]。
4. **BUGFIX-PREVIEW-LINK-B** — 前台详情页 → watch 跳转透传 `?preview=admin`（状态：✅ 已完成 2026-06-11）
   - 创建时间：2026-06-11 ｜ 实际开始：2026-06-11 ｜ 完成时间：2026-06-11
   - 验收口径：preview 模式打开的详情页内全部 watch 跳转（立即播放 + 选集）URL 携带 `?preview=admin`；public 普通访问零行为变化。
   - 文件范围：`apps/web-next/src/lib/admin-preview-query.ts`（新建纯函数，复用 `admin-access-token.ts` 协议常量）、`apps/web-next/src/components/detail/DetailHero.tsx`、`apps/web-next/src/components/detail/EpisodePicker.tsx` + 单测。
   - 依赖：无。建议模型：sonnet。
   - **完成备注（2026-06-11，执行模型 claude-fable-5，子代理无）**：carryAdminPreview 纯函数沉淀 + DetailHero/EpisodePicker 两跳转点接入 + 4 单测。门禁：typecheck/lint EXIT=0、test:changed 4、e2e:video 5/5。明细见 changelog [BUGFIX-PREVIEW-LINK-B]。
   - **序列候补登记**：① ES 幽灵文档成因调查（-B 实测 2327 条 DB 已删行残留 ES，reconcileStale 仅 7 天窗）；② 零消费方死代码清理 CHORE（VideoDetailHero/EpisodeGrid/VideoCardWide）；③ 根因 ③ preview 凭证过期静默降级的可观测性增强（操作员提示 / 服务端 log）。

---

## [SEQ-20260611-02] identity 候选 enrichment 空窗修复（外部 ID 绑定后定向重评）

- **状态**：✅ 已完成（1/1 卡收口 2026-06-11；本案对入候选 identity_score=0.95 实证）
- **创建时间**：2026-06-11
- **最后更新时间**：2026-06-11
- **目标**：修复用户报告「两部同名『佐贺偶像是传奇 梦想银河乐园』bangumi id 相同却不在合并预选」的机制缺口。调查实证（本会话）：ingest shadow 评分时 enrichment 尚未绑外部 ID（实测晚 5-9 分钟）→ 纯标题分低于 0.75 候选门槛 `skippedLowScore` 不落行；外部 ID 绑定后**无任何重评机制**（ingest 一生一次；离线 full-rescan 手动触发、上次 06-03 早于两视频入库 06-07）；merge 预选默认 source=identity 且表非空不降级 legacy → 该对永久缺席。
- **范围**：apps/api（migration 111 CHECK 扩值 / identity 定向重评 / worker job type / enrichment 挂钩）+ architecture.md 同步。无新端点（对齐 CHG-VIR-10「无新表无端点」先例，ADR-105a D-105a-16/17 体系延伸实施）。
- **依赖**：无 BLOCKER。关联 ADR-105a（identity 管线）/ CHG-VIR-8/-10（基建复用）。

### 任务列表

1. **BUGFIX-IDENTITY-ENRICH-RESCORE** — 外部 ID 绑定后定向重评入 identity 候选（状态：✅ 已完成 2026-06-11）
   - 创建时间：2026-06-11 ｜ 实际开始：2026-06-11 ｜ 完成时间：2026-06-11
   - **完成备注（2026-06-11，执行模型 claude-fable-5，子代理无）**：5 项全交付——migration 111（CHECK 扩 'enrichment' + architecture.md 两处同步）/ videoRescore 定向重评（复用 blockingRecall·buildSides·scoreAndPersistPairs，IdentityTriggerSource alias 收口 5 处重复 union）/ worker 'video-rescore' union + enqueueVideoRescore（fire-and-forget + jobId 去抖）/ 六挂钩点（事务路径 COMMIT 后入队；candidate 降级不入队——externalIdLoader 双源不认）/ +5 单测 + 2 既有 queue mock 跟随。端到端实证：本案两视频实跑 → created:1/noop:1（幂等）→ 候选 pending / identity_score=0.9500 / exact_id_hits=1 → 合并预选可见。门禁：typecheck/lint EXIT=0、test:changed 840、migration 对拍+幂等 ✓。遗留：admin 直写 catalog 外部 ID 列不触发重评候补 + full-rescan scheduler 候补。明细见 changelog [BUGFIX-IDENTITY-ENRICH-RESCORE]。
   - **-FIX（Codex stop-time review 拦截 2026-06-11）**：「fixed video-rescore jobId can suppress later rescans」——Bull 固定 jobId 在 completed 历史驻留期（removeOnComplete: N = 保留最近 N 个，低流量长期驻留）吞后续 add → 同视频后续绑定不再触发重评，变相复现空窗。去掉固定 jobId（重评幂等轻量，正确性优先于去抖节省；「即时清除」备选仍有执行中竞态窗口弃用）。+用例断言二次入队必再 add。明细见 changelog [BUGFIX-IDENTITY-ENRICH-RESCORE-FIX]。
   - 验收口径：外部 ID 绑定落库后受影响视频自动定向重评入 identity 候选（`trigger_source='enrichment'`）；本案两部视频重评后出现在合并预选。
   - 范围（5 项）：① migration 111 `identity_candidate.trigger_source` CHECK +'enrichment' + architecture.md 同步 ② `services/identity/videoRescore.ts` 定向重评（复用 blockingRecall/buildSides/scoreAndPersistPairs 共享层）+ pairScoringPersist triggerSource 类型扩值 ③ `identityCandidateWorker` job union +'video-rescore' + queue helper `enqueueIdentityVideoRescore`（fire-and-forget + jobId 去抖） ④ enrichment ref 写入完成位点挂钩（MetadataEnrichService ×1 / DoubanService ×2 / BangumiService ×3） ⑤ 单测 + 端到端验证（本案两视频 rescore 后入候选）。
   - 跨层理由：CHECK 枚举扩值与其唯一消费方（pairScoringPersist）同一契约闭环，无 UI 层。
   - 依赖：无。建议模型：sonnet。

### 门禁与验证（每卡）

- 必跑：`npm run typecheck` / `npm run lint` / `npm run test:changed`；migration 真库对拍 + 幂等重跑。
- 无新增 admin route（`verify:endpoint-adr` 不触发）；CHECK 扩值同步 architecture.md（schema 同步红线）。
- 端到端：对本案两 videoId 跑 video-rescore → `identity_candidate` 出现该对（exact bangumi 353181 证据）→ `GET /admin/video-merges/candidates` 可见。

### 门禁与验证（每卡）

- 必跑：`npm run typecheck` / `npm run lint` / `npm run test:changed`（commit 前）。
- 卡 2 追加：`npm run migrate` 真库对拍（含幂等重跑）+ resync 脚本实跑 + DB 断言零残留。
- 卡 3 追加：`npm run test:e2e:admin`（ADMIN 域）；卡 4 追加：`npm run test:e2e:video`（VIDEO 域）。
- 全程无新增 admin route（`verify:endpoint-adr` 不触发）/ 无 schema DDL（architecture.md 不需同步，migration 110 为纯数据迁移）/ 不动 `packages/admin-ui/**/types.ts`。

## [SEQ-20260612-01] 视频命名标准化：采集存储与显示规则收口

- **状态**：🔄 执行中
- **创建时间**：2026-06-12 11:38
- **最后更新时间**：2026-06-12 13:30
- **目标**：设计并落地视频标题标准化规则：同名不同季按独立视频/catalog 存储；`第x季` 结构化入 `season_number`，`剧场版` 保留为发布形态身份，`国语/字幕/画质/更新态` 不污染 catalog/video 显示标题。
- **范围**：apps/api 采集入库命名派生、media_catalog 按季匹配查询、对应单测；同步 ADR-176 AMENDMENT 与 architecture 标题规则。A 卡**不做** schema migration、不改前台/后台 UI 组件、不批量清洗存量数据；存量清洗由 B 卡承接（用户 2026-06-12 验收追加：存量标题季标无间隔需修复）。
- **依赖**：无 BLOCKER；关联 ADR-176（catalog 按季粒度）/ ADR-105a（TitleIdentityParser facets）/ ADR-174（normalizeMergeKey 不改）。
- **跨层理由**：标题标准化必须在 Service 层派生并传给 DB query 的匹配键；文档同步是对既有 ADR-176 D-176-7 的行为修订说明。

### 任务列表

1. **VIDEO-NAMING-STANDARD-A** — 采集入库标题标准化 + catalog 按季匹配（状态：✅ 已完成 2026-06-12）
   - 创建时间：2026-06-12 11:38 ｜ 实际开始：2026-06-12 11:38 ｜ 完成：2026-06-12 13:30
   - 验收口径：`某剧 第2季/第3季` 入库得到不同 `media_catalog`/`videos`；`某片 国语 1080p` 复用同一 catalog 且显示标题为 `某片`；`某番 剧场版` 作为独立发布形态保留在显示标题与 `title_normalized` 中。
   - 范围（5 项）：① 标准标题派生纯函数（复用 `TitleIdentityParser` facets，不改 `normalizeMergeKey`）② `MediaCatalogService.findOrCreateWithMatch` 可选 season-aware Step 5 ③ `CrawlerService.upsertVideo` 使用标准标题/seasonNumber 入 catalog/video ④ 单测覆盖 parser/naming/crawler/catalog ⑤ ADR/architecture 同步。
   - 依赖：无。建议模型：sonnet。实现 gpt-5-codex / 门禁+收口 claude-fable-5。详见 changelog [VIDEO-NAMING-STANDARD-A]。

2. **VIDEO-NAMING-STANDARD-B** — 存量显示标题清洗：季标间隔 + 噪声剥离（状态：✅ 已完成 2026-06-12）
   - 来源：用户 2026-06-12 验收反馈「标题后第几季字样中间没有间隔，添加间隔方便查看」。新写入路径 A 卡已带空格（`作品名 第N季`），缺口在存量数据。
   - 实跑结果：videos 284 + media_catalog 260 行清洗（选行含语言/画质 token 故高于预估 257+232）；旧标题 313 条入 video_aliases；ES syncVideo 284 + 收敛断言通过；幂等重跑 0 行。粘连计数归零验收通过。
   - 偏离（已记 changelog）：dry-run 拦截 A 卡 parser 显示层 2 缺陷溯源修复——displayTitle 全角标点保留（foldDisplayWidth）+ `普通话版` 规则补全；文件范围扩 `TitleIdentityParser.ts` + 测试。
   - 依赖：A 卡（已完成）。建议模型：sonnet。执行 claude-fable-5。详见 changelog [VIDEO-NAMING-STANDARD-B]。

3. **VIDEO-NAMING-STANDARD-C** — 跨季误合并存量盘点（状态：✅ 已完成 2026-06-12）
   - 产出：`docs/audit/cross-season-merge-audit-20260612.md` + 只读审计脚本 `scripts/audit-cross-season-merge.ts`（parseTitle 1.2.0 精确口径）。三类问题：**A 跨季混挂仅 6 例**（regexp 粗审计 24 例多为别名噪声；含「动物管制官」中文/阿拉伯季号双实体）；**B 季槽位错位 355 例**（catalog.season_number NULL + 标题唯一季号——A 卡四元组对 NULL 永不命中 → 每次重爬造重复实体的**活跃风险**；回填撞键预检 0 冲突可直接修）；**C 发布形态撞键 1 例**（魔法使俱乐部 OVA 与正篇同 key 并存）。watch_history 0 行（dev 拆分零进度影响）。详见 changelog [VIDEO-NAMING-STANDARD-C]。

4. **VIDEO-NAMING-STANDARD-D** — B 类 355 例 season_number 回填（状态：✅ 已完成 2026-06-12）
   - 实跑：回填 352 catalog / catalog 内分歧跳过 2（星辰变 第六季、师兄啊师兄 → E 卡）/ 批内互撞 0 / 槽位已占 0 / 失败 0；幂等复跑 0；审计 B 类 355 → 3（残余即 2 个分歧 catalog 下的视频，预期）。活跃重复实体风险解除。详见 changelog [VIDEO-NAMING-STANDARD-D]。
5. **VIDEO-NAMING-STANDARD-E** — （已并入 SEQ-20260612-03 **GOV-6**，2026-06-12；本条仅存指针不再独立跟踪）

## [SEQ-20260612-02] 播放源语言双维度（语音/字幕）结构化

- **状态**：📋 排队中
- **创建时间**：2026-06-12 13:30
- **最后更新时间**：2026-06-12 13:30
- **目标**：语言信息从标题噪声沉淀为 `video_sources` 结构化字段，消除「标题剥掉国语后语言信息在服务层不可见」的窗口期。用户裁定（2026-06-12）：① 语音与字幕**分两个维度**；② 语音缺失时按地区推断（大陆→国语、日本→日语、韩国→韩语），**源数据（vod_lang / 标题 token）优先于推断**；③ 字幕「双语」支持落两个具体语言，可缺失；④ 前台线路**仅在同视频存在 ≥2 语音版本时**显示语言区分，单语音不显示。
- **背景事实**（2026-06-12 调研）：`video_sources` 无任何语言列；上游 `vod_lang` 在 `SourceParserService.ts:350` 已解析但无下游消费；`TitleIdentityParser.facets.languageVariant` 现混装语音（国语/粤语/英语/国配）与字幕（中字/字幕）单值，仅持久化到 `title_observations.parsed_facets_jsonb` 审计层；既有裁决 D-176-12 已定「语言变体归 source 层」但字段未实装；`media_catalog.country` 值混杂（`CN` 2218 / `中国大陆` 44 / NULL 1086），地区推断需先规整取值口径。
- **范围**：schema migration（video_sources 语言双维度字段）→ parser 双维度拆分 + 爬虫写入链路 → API 透出 + 前台线路 UI。跨 schema/api-service/UI 三层，按原子化判据拆 4 卡。
- **依赖**：SEQ-20260612-01 A 卡（buildStandardVideoTitle facets 基础，已完成）。schema 字段跨 3+ 消费方（爬虫写入/admin 线路面板/前台播放页/识别层），**ADR 卡强制 arch-reviewer (Opus) 裁决**。

### 任务列表

1. **LANG-DIM-ADR** — ADR-199 起草 + arch-reviewer (Opus) 裁决（状态：✅ 已完成 2026-06-12）
   - 结果：CONDITIONAL PASS → 全修订采纳后 Accepted。BLOCKER 分叉主循环裁定方案 B（source 行级 + sourceName token 步骤 0，合并端态理由，D-176-12 不需 AMEND）；provenance 双列；subtitle NULL 三态；拆两规则表 + 封闭枚举；复用 COUNTRY_MAP；HK→粤语/TW→国语 采纳；TITLE_PARSER_VERSION 1.1.0；补 D-199-7 DTO 契约。详见 decisions.md ADR-199 + changelog [LANG-DIM-ADR]。
2. **LANG-DIM-A** — Migration 112（video_sources 4 列：audio_language / subtitle_languages / 双 provenance）+ `@resovo/types` + architecture.md §5.2 同步（状态：✅ 已完成 2026-06-12，真库对拍 + 幂等 + 全量 7237 passed；详见 changelog [LANG-DIM-A]）
3. **LANG-DIM-B** — D-199-2/3/4/5：规则表拆分（AUDIO/SUBTITLE_VARIANT_RULES + 封闭枚举）+ 归一函数 + 五级推断链写入（vod_lang 透传 + sourceName token + 地区推断）+ 存量回填脚本（状态：✅ 已完成 2026-06-12，回填 482,090 行 / audio 覆盖率 85.5% / 幂等复跑 0；详见 changelog [LANG-DIM-B]）
4. **LANG-DIM-C** — D-199-7：API 透出 + 前台线路 UI（≥2 语音才显示语言 badge）+ `matchActiveSourceIndex` 跨集语言粘性（状态：✅ 已完成 2026-06-12；详见 changelog [LANG-DIM-C]）
   - follow-up 另起卡（评审 R2）：admin 线路面板 / 合并预选 UI 语言列展示。
   - ⚠️ e2e PLAYER + VIDEO 双域预先存在环境耦合失败（与本卡无关，worktree 基线 9a2df4b2 复现）：mock-slug 测试（player.spec PLAYER-10 / card-to-watch / card-dual-exit 26 例 + **detail.spec 13 例，2026-06-12 补充确认同 MOCK_MOVIE fixture 同 404 签名**）在 :4000 真实 API 在线时必 404——watch/detail 页服务端 `fetchVideoDetail`（ADR-160 AMD2 hydration，video-detail.ts 共用 helper）拿到真 404 触发 notFound()，Playwright 页面级 mock 无法拦截服务端 fetch；API 离线同样 notFound()（网络错误同分支）。**即既有候选卡「e2e-next seed 基建」（SEQ-20260610-02 P2-1 备注）的具体根因**——修复方向：e2e 种子数据（真库种子 + 服务端可命中）或 server-side fetch 的 e2e 旁路。该卡提级建议：PLAYER / VIDEO 两域 e2e 门禁在 seed 基建落地前对 mock-slug 用例无效（仅真种子用例有效，e2e:video 实测 5 passed 即此类）。

## [SEQ-20260612-03] 合并候选与视频标题综合治理

- **状态**：🔄 执行中
- **创建时间**：2026-06-12 17:30
- **最后更新时间**：2026-06-12 17:30
- **目标**：收口本日两轮诊断暴露的合并候选检测体系缺陷（缺陷清单 A-F，见 2026-06-12 会话评审）+ 视频标题存量手术残余，使「标题标准化 → 候选检测 → 人工合并」成为可持续闭环。
- **治理原则**：① **变更传播完备性**——parser/scorer 版本变更、标题变更、时间三类信号都必须能触达候选重评（缺陷 A/B/C）；② **消费侧诚实降级**——identity 空态显式提示而非静默换口径（缺陷 F）；③ **存量手术人工闸门**——实体级合并/拆分逐例附证据经用户确认。
- **背景缺陷清单**（2026-06-12 实证）：A 版本耦合三连（bump 搁浅 207 pending + 召回数据源同钉版本 + 无自动联动）/ B 标题变更无 hook（admin 编辑 + 批量清洗均不触发）/ C 无周期兜底 + fire-and-forget 无补偿 / D 召回仅等值桶（无模糊层 + 单桶 50 截断）/ E 阈值 0.75 单点无灰区观测 / F legacy 静默降级 + filter-after-paginate total 失真（9-C FIX-2 债）。
- **依赖**：SEQ-20260612-01/-02 已收口；GOV-6 吸收原 VIDEO-NAMING-STANDARD-E 卡。

### 任务列表

1. **GOV-1** — 止血：观测重写 + 候选重扫 + 旧版本候选 hygiene（状态：✅ 已完成 2026-06-12）
   - 实跑：4405 条 1.2.0 观测 → 重扫 696 桶/1061 对（created 10 / superseded 205 / blocked 190 / low-score 842）→ 残留 2 死对子（对侧已软删）显式 superseded → 当前版本 pending 215 / 旧版本残留 0；重案解密 0.9 入候选（标题标准化→语言变体合并闭环打通）。详见 changelog [GOV-1]。
2. **GOV-2** — 消费侧诚实化：identity 空态显式信号 + legacy total 口径修复（9-C FIX-2 收口）（状态：✅ 已完成 2026-06-12）
   - 落地：staleIdentityPending 信封字段 + UI「候选待重评」警示条；legacy 有界全量重构（cap=2000 + truncated 复用），total=过滤后组数与 identity 语义统一。全量 7275/7275。详见 changelog [GOV-2]。
3. **GOV-3** — 版本 bump 联动自动化（状态：✅ 已完成 2026-06-12，**GOV-5 并入**）
   - arch-reviewer (claude-opus-4-8) BLOCKER：cron 必须 api 进程内（ADR-107 §4 worker 禁 import api Bull）→ identityReconcileScheduler（boot 自愈 + 每日兜底，不固定 jobId）；versionReconcile 四步幂等编排 = GOV-1 手工链固化；观测 SQL 下沉查询层单真源。详见 changelog [GOV-3]。
4. **GOV-4** — 标题变更重评 hook（状态：✅ 已完成 2026-06-12）：migration 113 +'title_change' / triggerSource 全链参数化 / VideoService 实变位点观测+重评 / 批量脚本逐行观测+提醒 / architecture.md 同步。**主线 GOV-1~5 完结**，余 GOV-6（人工闸门）/ GOV-7（后排）。详见 changelog [GOV-4]。
5. **GOV-5** — （已并入 GOV-3 同卡裁决落地：每日兜底 tick 即周期重扫；fire-and-forget 失败补偿由每日 reconcile 兜底覆盖）
6. **GOV-6** — 存量实体手术（状态：✅ 批准范围收口 2026-06-12）：用户批准 4 项高置信处置全部执行（掌心饵 split〔审计可 unmerge〕/ 宠妻 season 落位 / 星辰变·师兄啊师兄 catalog 重排 / OVA normalized 修正）；审计收敛 B=0 / C=0。**暂缓 4 例**（偶滴歌神啊 / 恶搞之家 / 动物管制官 ×2）登记候补——缺站点级归属证据，GOV-4 后重爬观测自然累积，证据齐后重新取证交用户批准。详见 changelog [GOV-6]。
7. **GOV-7** — 召回增强评估（状态：✅ 已完成 2026-06-12）：灰区报表（1061 对：候选区 96 / 灰区 99 全为高置信真重复 / 0.50-0.55 噪声海 581——结论=窄切片而非降阈值）+ titleEn 缺口 17 组 + 简繁不立案。评估真源 `docs/audit/identity-recall-grayzone-assessment-20260612.md`。**产出候选实施卡**：GRAY-SLICE（✅ 已实施 2026-06-12，D-105a-20，详见 changelog [GRAY-SLICE]）/ TITLEEN-BUCKET（第三 blocking 键，低风险小卡，📋 待用户决定启动）。详见 changelog [GOV-7]。

## [SEQ-20260612-04] merge 候选来源单一化（移除 legacy 实时聚合降级）

- **状态**：🔄 执行中
- **创建时间**：2026-06-12 23:00
- **最后更新时间**：2026-06-12 23:30
- **目标**：彻底移除 `/admin/video-merges/candidates` 的 `source=legacy`（实时聚合）降级链路，identity（多证据离线候选）成为唯一来源。这是 SEQ-20260612-03 缺陷 F「legacy 静默降级」的终极收口——GOV-2 实证「bump 搁浅 207 pending 被用户当 bug 报告」证明降级链路本身是语义漂移源而非安全网。
- **背景**：前端恒请求 identity（CHG-VIR-15-UX-A toggle 退役），legacy 仅服务端空表兜底，前端从不主动请求；GRAY-SLICE（D-105a-20）灰区真重复入候选后 identity 召回覆盖度提升，legacy 兜底边际化；legacyScore/重合度列已退役（CHG-VIR-14-SCORE-UI）。
- **依赖**：SEQ-20260612-03 GOV-2（identity 空态 staleIdentityPending 信号已建）+ GRAY-SLICE（identity 召回增强）。
- **评审**：arch-reviewer (claude-opus-4-8, agentId add53ee9b2c536ecc) REVISE → 方向 PASS + 用户走读 REVISE×2（3 项 P1：identityScore 0..1 口径 / schema 补全 videoCount+q.max+两 refine / staleIdentityPending route 透传缺口）全采纳。**6** 边界 D-105-17~22（删路径≠删字段≠删列 / source enum 收敛 422 / minScore 保留 / source 列退役 / GOV-2 解耦+truncated 保留 / route 透传 staleIdentityPending 修 GOV-2 缺口）。
- **范围**：跨 ADR/schemas/service/queries/types/test 5 层，按原子化判据（跨 3 层 + 范围 ≥5）拆 3 卡。

### 任务列表

1. **CHG-VIR-18-A1** — ADR-105 AMENDMENT 2026-06-12 起草（source 退化单一 identity + 端点契约表 row 1 历史欠账补登 source/sortField/sortDir/identityScoreMin/Max(0..1)/videoCountMin/Max/q + 6 边界声明 D-105-17~22 + 主体段 D-N 登记块 + 回滚路径）（状态：🔄 进行中，创建 2026-06-12 23:00，实际开始 2026-06-12 23:00）
   - **状态：✅ 已完成 2026-06-12**（commit 见下；用户走读 REVISE×2 全采纳；verify:adr-contracts EXIT=0 / adr-d-status ADR-105 total 22）。详见 changelog [CHG-VIR-18-A1]。
   - **解锁**：A1 ADR PASS（用户授权持续实施）→ A2 启动。
2. **CHG-VIR-18-A2** — 后端实施（状态：✅ 已完成 2026-06-12）
   - 落地：listCandidates 删 legacy 分支 + GOV-2 解耦（identity 空态独立查 hasStaleVersionPending）+ route 透传 staleIdentityPending（D-105-22）+ 删 fetchRaw/countRaw/computeOverlapScore + source z.enum(['identity']) + types 注释 + 8 测试文件改写（生产 5 + 测试 8）。门禁：typecheck/lint EXIT=0 / 受影响 7 文件 136 passed / test:changed 全量 7264 passed（1 staging flaky 隔离 PASS）/ verify EXIT=0。后端 D-105-17/18/19/21/22 闭环。详见 changelog [CHG-VIR-18-A2]。
3. **CHG-VIR-18-B** — 前端 + 测试（状态：✅ 已完成 2026-06-13）
   - 落地：MergeCandidatesSection 来源列整列退役 + 删 effectiveSource/CandidateSource/SOURCE_CHIP_STYLE/降级提示条/minScore 控件 + 空态统一 identity + 保留 GOV-2 stale 警示；测试删 2a-fix/3 + 改 2a/1 + 新增 10h stale 警示（26 passed）。门禁：typecheck/lint EXIT=0 / test:changed 6 文件 76 passed / verify EXIT=0。**D-105-20 闭环 → 本卡 D-105-17~22 全闭环**。详见 changelog [CHG-VIR-18-B]。

> **SEQ-20260612-04 完结**（2026-06-13）：merge 候选来源单一化三卡（A1 ADR / A2 后端 / B 前端）全部完成。legacy 实时聚合来源前后端完全退役，identity 多证据为唯一来源；GOV-2 既有 route 透传缺口顺带修复。ADR-105 本序列 D-105-17~22 全闭环。

---

## [CHORE-TEST-CPU-CONCURRENCY] 本地测试并发封顶（Apple Silicon P/E 核响应性）

- **状态**：✅ 已完成 2026-06-13（用户直接指令，非队列序列；调查 + 杠杆 B 落地）
- **来源**：用户报告本地跑测试（尤其 e2e）E 核满载 / P 核空闲、系统总占用未满却其他应用卡顿（Apple M2，4P+4E）。
- **结论**（校准探针实测）：两正交问题——① QoS 降级（启动环境继承 UTILITY QoS → Apple Silicon 硬限 E 核，事后用户态不可逆）= 杠杆 A 终端操作指引；② 并发过度订阅占满含 E 核全部核心 = 杠杆 B 配置封顶。
- **落地**：`playwright.config.ts` 本地 `workers` undefined→3；`vitest.config.ts` 顶层 `maxWorkers/minWorkers` = `process.env.CI ? undefined : 4/1`（仅本地，CI 门控对齐 playwright，零变化）。Codex 复审拦截「CI 默认污染」并修复。门禁全过；commit 前 test:changed 升全量（config 命中 forceRerunTriggers）。详见 changelog [CHORE-TEST-CPU-CONCURRENCY]。

---

## [SEQ-20260613-01] API 凭证统一管理框架 + 连接测试协议（落地 ADR-173）

- **状态**：🔄 执行中
- **创建时间**：2026-06-13 11:00
- **最后更新时间**：2026-06-13 11:00
- **目标**：把单源硬编码的外部数据源凭证管理（bangumi）通用化为**注册表驱动框架**（新建 `api_credentials` 表 + provider 注册表 SSOT + 统一解析器/端点/UI），并补上 ADR-168 明确遗留的「测试连接」能力（即落地长期被引用却未写的 ADR-173）。bangumi 迁入框架、tmdb 凭证位就绪，未来任何源「加一条注册 + 一个测试适配器」即可接入。
- **背景**：ADR-168 已奠基 secret 三道治理（审计/GET/PATCH）+ 通用化 `SECRET_KEY_PATTERNS` + tmdb 占位，但凭证以扁平 KV 混在 `system_settings`、解析器 `bangumi-config.ts` 单源硬编码、`SettingsTab` 写死 bangumi 卡；且明确「测试连接 NOT in scope（依赖 ADR-173/F-A）」而 ADR-173 至今未落笔。
- **依赖**：ADR-168（secret 治理纯函数 `secretRedaction.ts`）+ ADR-188（provider 注册表范式 `external.types.ts`）。
- **设计真源**：plan 文件 `~/.claude/plans/sorted-cooking-feigenbaum.md`（已含 Codex 审核意见 + v2 落实，用户已批准）。
- **用户已锁决策**：① 新建 `api_credentials` 表（非沿用 KV）；② 测试「待保存的输入值」（草稿测试不污染已存状态）；③ UI 升级现有「外部数据源」卡为注册表驱动；④ 范围 = 框架 + bangumi 接入 + tmdb 凭证位就绪（TMDb 富集消费后续单独立项）。
- **审核底线（Codex）**：TMDb Bearer 主契约 / 两阶段迁移不同卡删旧 KV / draft test 不污染 saved status / disabled 压过 env fallback / 审计真源具体文件 / Card A 拆分。
- **范围**：跨 ADR/types/schema/service/route/UI 多层 + ≥5 项 → 按原子化判据拆 6 卡（A1/A2/B/C + 后排 D 清理）。

### 任务列表（按执行顺序）

1. **META-24** — ADR-173 起草（API 凭证统一管理框架 + 连接测试协议）（状态：✅ 已完成 2026-06-13）
   - 创建时间：2026-06-13 11:00 ／ 实际开始：2026-06-13 11:00 ／ 完成时间：2026-06-13 11:30
   - 建议模型：opus（撰写即将成为 ADR 的决策文档 + 跨 3+ 消费方契约，CLAUDE.md 强制 Opus）／执行模型：claude-opus-4-8
   - 落地：`docs/decisions.md` `## ADR-173`（Accepted）D-173-1..11 + 偏离 D-173-A..E + 3 端点契约表。Codex 审核 6 必修 + 5 建议全部并入。门禁 verify:adr-contracts EXIT=0 / docs-only test:changed SKIP。详见 changelog [META-24]。
   - 解锁：ADR PASS → META-25（Card A1）启动。
2. **META-25** — Card A1：`@resovo/types` 注册表 + migration 115（建表+回填，保留旧 KV）+ architecture（状态：✅ 已完成 2026-06-13）
   - 建议模型：opus（`@resovo/types` 公开类型 → commit Opus trailer）／执行模型：claude-opus-4-8
   - 落地：`integration-credentials.types.ts` `PROVIDER_CREDENTIAL_SPECS`（bangumi 3 + tmdb Bearer 3 字段）+ index 导出；migration 115 真库对拍（表结构/FK SET NULL/bangumi 现值回填 secrets.token+config/旧 KV 保留/幂等复跑行数不变）；architecture.md 表段 + migration 列表。门禁 typecheck/lint/verify:adr-contracts EXIT=0 / 全量单测 524 文件 7286 passed。详见 changelog [META-25]。
   - 解锁：→ META-26（Card A2 读取路径迁移）。
3. **META-26** — Card A2：读取路径迁移（`loadProviderCredential` 优先新表→fallback 旧 KV→env + enabled 语义）+ bangumi-config 薄封装（状态：✅ 已完成 2026-06-13）
   - 建议模型：sonnet ／执行模型：claude-opus-4-8（主循环连续推进）
   - 落地：`apiCredentials.ts` `getApiCredentialRow` + `integration-credentials-config.ts` `loadProviderCredential`（新表→旧 KV〔LEGACY_KV_MAP〕→env + enabled 压 env）+ bangumi-config 薄封装（签名不变，BangumiService/Adapter 零改）+ 9 单测。受影响 metadataEnrich/bangumi-service 测试补 `apiCredentials` mock。门禁 typecheck/lint EXIT=0 / test:changed 16 文件 283 passed。详见 changelog [META-26]。
   - 解锁：→ META-27（Card B service + 端点 + 测试适配器）。
  > **Card B 拆分（原子化判据：范围 > 5 项 + 含新 admin 路由）**：B1（纯 service 层构件）→ B2（编排 + 路由 + 审计）。
4. **META-27** — Card B1：lib testConnection（bangumi authStatus / tmdb Bearer）+ `CREDENTIAL_TESTERS` 注册表 + queries mutations（list/upsert/updateTestStatus）+ 单测（状态：✅ 已完成 2026-06-13）
   - 建议模型：opus ／执行模型：claude-opus-4-8
   - 落地：`lib/bangumi.testConnection`（/v0/me valid·invalid / 无 token /calendar not_required）+ `lib/tmdb.testConnection`（Bearer /authentication）+ `integration-credential-testers.CREDENTIAL_TESTERS`（douban/imdb unsupported）+ `apiCredentials` list/upsert（JSONB `||` 合并）/updateTestStatus（仅 UPDATE）+ 14 单测（fetch mock + db mock）。门禁 typecheck/lint EXIT=0 / test:changed 20 文件 323 passed。详见 changelog [META-27]。
   - 解锁：→ META-30（Card B2 Service + 路由 + 审计）。
5. **META-30** — Card B2：`IntegrationCredentialsService`（list/save/test）+ 3 admin 路由 + 2 审计 action type（4 处同步）+ 路由/服务测试（状态：✅ 已完成 2026-06-13）
   - 建议模型：opus ／执行模型：claude-opus-4-8（新增 admin route + @resovo/types 公开类型 → Opus + trailer）
   - 落地：`IntegrationCredentialsService`（list 遮罩视图 / save 占位跳过+JSONB+审计 redact / test 三态+草稿不污染+不落候选 secret）+ 3 路由（GET/PUT/POST，provider z.enum 守门→404）+ server.ts 注册 + 2 审计 action type（admin-moderation union/AuditLogService/set-equal/coverage 4 处同步）+ 13 单测。门禁 typecheck/lint/verify:adr-contracts EXIT=0（endpoint-adr 238 路由对齐）/ 全量单测 529 文件 7326 passed。详见 changelog [META-30]。
   - 解锁：→ META-28（Card C UI）。
6. **META-28** — Card C：UI `ExternalCredentialsCard`（注册表驱动）+ integrations api client + SettingsTab 切换（过渡，不删旧契约）（状态：✅ 已完成 2026-06-13）
   - 建议模型：sonnet ／执行模型：claude-opus-4-8
   - 落地：`lib/integrations/api.ts`（get/save/test）+ `_external/ExternalCredentialsCard.tsx`（注册表驱动多源卡：字段+保存+测试连接 draft+状态行+enabled）+ SettingsTab 删硬编码 bangumi 卡改渲染新组件；SettingsTab.test stub 新组件 + 删迁出用例，新增 ExternalCredentialsCard.test（5 例）。门禁 typecheck/lint EXIT=0 / test:changed 20 passed / **test:e2e:admin 82/82 passed**。详见 changelog [META-28]。
   - 解锁：**框架闭环（META-24..28+30 完成）**；剩 META-29（Card D 清理）后排。
7. **META-29** — Card D：清理卡（线上稳定后单独排期）退役 system_settings bangumi*/tmdb* 旧契约 + 删解析器旧 KV fallback（状态：⏸ 后排，依赖 A1–C 线上稳定）
   - 建议模型：sonnet
   - 验收要点：rollback 窗确认后执行 / system-config 测试断言迁移

---

## [SEQ-20260613-02] 播放器多尺寸控件修复（音量键 + 默认模式选集入口）

- **状态**：✅ 已完成（PLAYER-11 收口 2026-06-13；衍生 e2e-infra follow-up 见下）
- **创建时间**：2026-06-13 12:56
- **最后更新时间**：2026-06-13 13:05
- **目标**：修复用户「播放器多尺寸交互调查」发现的两处控件显隐缺陷——① ≤960px 桌面播放器音量键消失；② PC 默认模式控制条无内嵌选集按钮。
- **背景**：调查实证根因——① `collapsePolicy.ts` 把 volume 当低优先级在 medium/compact/narrow 三档一律删除，而音量控件静止态仅图标、任何桌面宽度都不缺空间（阈值过激）；② `getInlineEpisodes` 以 `!isTheater` 门控使默认模式 `episodes` 恒空、控制条选集按钮不渲染。用户两项裁定：音量键起卡修复；选集控制条也加入口（与侧栏共存）。
- **范围**：纯 UI/布局层（packages/player-core 内部 collapse 行为 + web-next 本地 helper），无 schema/api、无共享组件公开 Props 改动 → 单卡。

### 任务列表

1. **PLAYER-11** — 删 collapse 音量删除（桌面全宽度保留）+ getInlineEpisodes 去 theater 门 + 双向单测（状态：✅ 已完成 2026-06-13）
   - 创建时间：2026-06-13 12:56 ／ 实际开始：2026-06-13 12:56 ／ 完成时间：2026-06-13 13:05
   - 建议模型：sonnet ／执行模型：claude-opus-4-8
   - 文件：`collapsePolicy.ts` / `playerShell.layout.ts` / `PlayerShell.tsx` / 新增 `tests/unit/player-core/collapse-policy.test.ts` + `tests/unit/web-next/player-shell-layout.test.ts`
   - 完成备注：执行模型: claude-opus-4-8。子代理: 无。collapsePolicy 删 `removeControl(volume)` → 桌面指针全宽度保留音量图标；getInlineEpisodes 去 `!isTheater` 门 + 去形参 → 默认/影院两模式控制条均有选集入口。门禁 typecheck/lint EXIT=0、test:changed 自动升全量 **532 文件 / 7358 passed**（含新增 28 定向单测）。**test:e2e:player 未跑绿**——预存系统性基建阻塞（watch 页 SSR `fetchVideoDetail` 直连 api，`resovo_dev` 无 `aB3kR9x1` 等 7 seed 视频 + 客户端 page.route mock 拦不住 SSR fetch；干净基线同样全挂），与本改动无关 → 拆 follow-up 卡 CHORE-E2E-WATCH-SSR-SEED。

> **Follow-up（衍生 / 待排期）** — PLAYER-11 调查暴露的 e2e 基建债，与播放器 bug 修复正交：
>
> #### CHORE-E2E-WATCH-SSR-SEED — e2e watch SSR seed fixture + player 域陈旧测试清理
> - **状态**：✅ 已完成（2026-06-13）
> - **创建时间**：2026-06-13 13:05
> - **建议模型**：sonnet
> - **变更原因**：ADR-160 AMD2 给 watch 页加 SSR hydration（`fetchVideoDetail`/`fetchVideoSources` 服务端直连 api）后，基于客户端 `page.route` mock 的 e2e-next 旧 spec 全部在「整页 SSR 404」处失败（`watch-page` 不渲染）。仓库无任何 e2e seed 脚本/globalSetup/CI seed，`resovo_dev` 无 `test-*` 视频 → test:e2e:player 8 spec 23 用例预存全红（基线复现）。
> - **影响的已完成任务**：PLAYER-11（验证仅靠单测）+ 所有 e2e-next watch spec
> - **文件范围**：新增 `tests/e2e-next/_seed/{fixtures,db,global-setup,global-teardown}.ts` + `playwright.config.ts` globalSetup/teardown 接线（仅 web 域）；清理 `player.spec.ts` / `mini-player.spec.ts` 陈旧用例。
> - **变更内容**：globalSetup 直连 pg 落库 5 seed 视频（aB3kR9x1/bC4lS0y2/TriState/TabsTest/CinemaM1，**每视频建专属 media_catalog**〔填全 description/director/cast/year/rating/genres，title_normalized=marker〕 + approved|internal→public 发布路径绕状态机触发器 + 源 source_name 分线路/episode_number 分集匹配断言；事务幂等 + teardown 删视频 CASCADE + 删专属 catalog）使 SSR fetch 命中。
> - **完成备注**：执行模型: claude-opus-4-8。子代理: 无。**seed 修复 watch-SSR 失败 15 个**（player.spec 10/12 + tri-state 3 + option-tabs 2 + cinema 2；**DxMovie1/DxSerie1 经实证不需 seed**）。残留 8 个 triage 后**确认全为预存陈旧测试**（测已删/改名功能），用户批准一并清理：① theater testid `theater-mode-btn`→`data-ytp-component="theater-btn"` + 视口 1280×720→1600×900（1280 下嵌入 player 高 459px≤SHORT_HEIGHT(460) 落 short-height profile 移除 theater，边界 flaky）；② 删 danmaku 用例（commit e601ea2b 前台移除弹幕）；③ 删 mini-player §3 展开/折叠两用例（HANDOFF-36 commit 2fd2eb16 几何固定高度，toggle-expand/progress testid 移除）；④ mini-player §4 几何 `y<40`→`y<200`（tl dock 含 header 安全区偏移 y≈88）。**最终 test:e2e:player 33 passed**（唯一一致残留 card-dual-exit:99 → 拆 follow-up；mini/card 负载性 flaky retry 过）；门禁 typecheck/lint EXIT=0；teardown 自动清库（DB count=0）。
> - **Codex stop-time review FIX**（「global e2e seed breaks web video/detail specs」）：① **seed 收窄到 player 域**——`playwright.config` globalSetup 门控加 `process.env.E2E_SEED_WATCH === '1'`，仅 `test:e2e:player` 脚本显式置该 env；`test:e2e:video`/`search`/`smoke`/全量 `test:e2e` 不 seed → detail/video/browse spec 回到基线、不被 seed 影响（detail.spec 与 player 共用 aB3kR9x1/bC4lS0y2，全局 seed 会让 detail 页 SSR 命中 seed 视频但渲染数据/testid 不匹配 → 误失败）。② **复用随机 catalog → 专属 catalog**——避免把 seed 视频塞进真实 catalog 的副作用。实证：`test:e2e:player`（带 env）33 passed；`detail.spec`（无 env）跑后 DB seed 视频 count=0（门控生效、seed 未运行）。
>
> #### CHORE-VIDEOCARD-TAGLAYER-E2E — card-dual-exit:99 TagLayer 布局断言修复
> - **状态**：✅ 已完成（2026-06-18）
> - **创建时间**：2026-06-13 14:10
> - **建议模型**：sonnet
> - **变更原因**：`card-dual-exit.spec.ts:99`「TagLayer 左上象限垂直位于 title 上方（tagBox.y ≤ titleBox.y）」隔离一致失败、最初基线即在、与 player/seed/PLAYER-11 无关（测有 tag 的真实首页卡，跳过无 tag 的 seed 卡）。需查 VideoCard StackedPosterFrame TagLayer 与 title 实际相对布局判定真布局 bug vs 陈旧断言。
> - **文件范围**：`tests/e2e-next/card-dual-exit.spec.ts` + 可能 VideoCard/StackedPosterFrame 组件
> - **完成备注**（2026-06-18，claude-opus-4-8，子代理无）：根因复现实证——失败在 `:112` poster height poll（**非** :132 tag/title 断言）。mock `/videos/trending` 只返回 1 卡但 FeaturedRow 请求 limit=4 → FeaturedGrid 3 空占位（aspect 2:3）从拉伸的 row height(625) 反推过大 width(416px) 挤压真实卡列到 ~27px → poster 塌 41px<100 poll 超时（grid-template-columns 实测 `27.47px 416 416 416`）。修：mock 返回 4 卡填满 grid 消除空占位 + 删同文件死代码 `API_BASE`；**TagLayer 布局本身正确**（:132 通过）。验证 card-dual-exit 2/2 passed + typecheck/lint EXIT=0。**发现独立真 bug 登记 follow-up `task_2e725753`**（FeaturedGrid 空占位缺 `min-width:0`，trending<4 卡时挤垮真实卡）。详见 changelog [CHORE-VIDEOCARD-TAGLAYER-E2E]。
>
> #### CHORE-FEATUREDGRID-SPARSE — FeaturedGrid 真实卡<4 时空占位挤垮真实卡列（CHORE-VIDEOCARD-TAGLAYER-E2E 派生，用户启动）
> - **状态**：✅ 已完成（2026-06-18）
> - **完成备注**（2026-06-18，claude-opus-4-8，子代理无）：根因——grid item 默认 `min-width:auto`，空占位 div aspect-ratio 无 width → automatic minimum size 从被 stretch 的 grid row height 反推 width 成 min-content → 撑宽空占位列挤压 fr 真实卡列。修：FeaturedGrid 直接子加 `min-width:0`（VideoCard 传 `className="min-w-0"` + 空占位 div `minWidth:0`）。验证：新 e2e `featured-row-sparse.spec.ts`（mock trending 1 卡）**红(真实卡 width 88.5<100)→绿**；card-dual-exit(4卡)+smoke `--workers=1` 串行无回归 5 passed；typecheck/lint EXIT=0、test:changed 3 passed。注：首轮 3 spec 并发 goto /en 30s 超时系 dev server 冷启动+并发抖动（非回归），串行复跑全绿。详见 changelog [CHORE-FEATUREDGRID-SPARSE]。
>
> #### CHORE-E2E-DETAIL-SSR-SEED — video/detail 域 SSR seed + 陈旧测试清理（平行 player 域）
> - **状态**：✅ 已完成（2026-06-13，并入 CHORE-E2E-WATCH-SSR-SEED 第二轮 Codex 修复）
> - **创建时间**：2026-06-13 14:40
> - **建议模型**：sonnet
> - **变更原因**：detail 页同 watch 为 SSR server component；`detail.spec`/`detail-episode-pick.spec` 在基线（无 seed）即因 SSR-404 大面积失败——预存。
> - **完成备注**：执行模型 claude-opus-4-8。**seed 改全局启用 + 富集 catalog 后，detail 域全绿（detail.spec 10/10 + detail-episode-pick 2/2 + brand-detection 4/4）**。① 补 DetailEp 到 fixtures（12 集 anime）；② detail.spec 3 陈旧断言修复：`detail-description` testid 加到实际可见的 VideoDetailClient.DescriptionBlock（原 testid 在未使用的 legacy `components/video/VideoDetailHero`，实际渲染用 `components/detail/DetailHero` + DescriptionBlock）/ watch URL 正则放宽（`/watch/{slug}-{shortId}` 含 slug 前缀）/ episode-btn 数 12→10（EpisodePicker RANGE_SIZE=10 分段）；③ detail-episode-pick 2 用例按新交互重写（EpisodePicker handleSelect 现 `router.push(/watch?ep=N)` 直跳，旧"详情页 shallow 选集 + aria-pressed + 单独 play"模型随 BUGFIX-PREVIEW-LINK-B 退役）。
>
> #### CHORE-E2E-HOMEPAGE-SEARCH-E2E — homepage/search 域预存 e2e 失败修复
> - **状态**：✅ 已完成（2026-06-18）
> - **创建时间**：2026-06-13 15:30
> - **建议模型**：sonnet
> - **变更原因**：`homepage.spec`（HeroBanner CTA/指示点 / 语言切换 / 免责声明）+ `search-page.spec`（结果网格/数量/清除/q 透传）在**基线（无 seed）即失败**（对照跑确认 search-page:104/108/116/136/158 无 seed 同样红）——与 CHORE-E2E-WATCH-SSR-SEED 的 seed 无关（search 客户端 mock、seed 独立），是独立预存问题（疑 search 页 SSR 化 / banner 数据 / 语言切换链路漂移）。需单独 triage：判 SSR-seed 缺口 vs 陈旧断言。
> - **文件范围**：`tests/e2e-next/homepage.spec.ts` / `search-page.spec.ts`（仅 spec，无产品代码改动）。
> - **完成备注**（2026-06-18，claude-opus-4-8，子代理无）：**triage 结论：12 失败全为陈旧 spec，零产品 bug**（非 SSR-seed 缺口——两 spec 均 page.route mock 不依赖 seed）。① **search ×5**：mock URL `limit=40` 漂移（SearchPage 服务端分页实际 `/v1/search?q=…&limit=20&page=1`）→ 改 URL predicate 精确匹配 `url.pathname==='/v1/search'`+q（首版误用 `endsWith('/search')` 连页面路由 `/{locale}/search` 一起拦截、已修）+ response 补 `pagination`（代码读 `res.pagination.total`）；结果容器 testid `search-results-grid`→`search-results-list`、结果项 `video-card`→`search-result-row`（SearchPage 改 row 布局）；清除按钮 `getByLabel('清除搜索')`→en「Clear search」（测试在 /en locale）。② **homepage ×7**：`nav-logo` `toHaveText('Resovo')`→`toContainText`（logo 加 "R" 图标 span）；HeroBanner :161/166/171 **PC(md:flex)+mobile(md:hidden) 双布局 testid 翻倍**（count 4/strict violation）→ `:visible` 限定可见布局；`footer-disclaimer`→`global-footer`；语言切换 :260/267 **功能未实装**（SettingsDrawer「语言偏好」为 comingSoon 占位、全站无 LocaleSwitcher）→ `test.describe.skip` 待功能实装恢复。验证：homepage+search `--workers=1` **26 passed + 2 skipped**；typecheck/lint EXIT=0。**流程偏离登记**：本卡未先写 tasks.md 卡即开始 triage/改 spec（违 workflow，记录自警）。详见 changelog [CHORE-E2E-HOMEPAGE-SEARCH-E2E]。

---

## [SEQ-20260613-03] 后台独立搜索模块（顶栏全局搜索切入，ES 主线）

- **状态**：🔄 执行中
- **创建时间**：2026-06-13 17:00
- **最后更新时间**：2026-06-13 19:50
- **目标**：兑现"顶栏全局搜索"未接后端的承诺，沿 ES 主线建独立搜索模块。计划真源 = `~/.claude/plans/top-bar-lively-marble.md`（用户已批准 + 3 轮复审 + 4 硬约束）。
- **范围**：Phase 0 契约/ADR → Phase 1 顶栏 MVP（/admin/search + CommandPalette 接线）→ Phase 2 统一 admin_search 索引 → Phase 3 预测/多语言。+ 独立并行卡 videos 搜索框收编。
- **硬约束**：① videos 后台专用 ES 查询不调公开 SearchService；② sources P1 直接搜 source_name/source_url/站点；③ CommandPalette 远程结果不被 label substring 二次误过滤；④ tasks 为新增 q 能力、限近期窗口。
- **决策记录**：顶栏 P1=videos/sources/users/tasks、P1.5=submissions、页内限定=audit/messages/external-resources/notifications；非 videos 兜底先 ILIKE 留 pg_trgm 切换口；Phase 2 优先统一索引非多索引。

### 任务列表

1. **SEARCH-01** — Phase 0：ADR-200 契约定稿（CommandPalette API + /admin/search DTO + AdminSearchService 边界 + entitySearcher）（状态：✅ 已完成 2026-06-13）
   - 建议模型：opus（撰写 ADR + 共享组件公开 API 契约 → 强制 arch-reviewer Opus）／执行模型：claude-opus-4-8
   - 文件：`docs/decisions.md`（ADR-200 D-200-1..9 + §4.1.6 AMENDMENT + 端点契约表）+ `packages/types/src/admin-search.types.ts`（新建 DTO）+ index barrel。
   - 完成备注：执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, agentId a8bc2b8e22de61843) **CONDITIONAL PASS**，M-1/M-2/M-3 + 7 补充全采纳（M-2 用户裁定尽力而为 + follow-up）。门禁 typecheck/lint/verify:adr-contracts EXIT=0（verify-endpoint-adr 238 路由含 GET /admin/search）。解锁 SEARCH-02。
2. **SEARCH-02** — Phase 1：顶栏全局搜索 MVP（**拆 -A/-B/-C 子卡**，原子化判据：改动项 >5 + 跨 api-service/admin-ui/server-next 多层；依赖序 A·B 可并行 → C 依赖 A+B）
   - **SEARCH-02-A** — 后端 `GET /admin/search`（AdminSearchService fan-out + buildVideoMatchQuery 共享抽取 + searchAdminSources/searchAdminUsers/searchTaskRuns queries + 权限分级 + 单测）（状态：✅ 已完成 2026-06-13）
     - 建议模型：opus（端点契约已由 ADR-200 + arch-reviewer Opus 定稿，本卡纯实施后端、不改共享组件 Props → 无需新 spawn）
     - 完成备注：执行模型 claude-opus-4-8；子代理无。门禁 typecheck/lint/verify:adr-contracts/verify:endpoint-adr（239 路由对齐）EXIT=0 + test:changed 804 passed（+20 新测试）。复用沉淀 TASK_RUN_STATUS_MAP 单一真源。偏离：siteDisplayName 暂用 site_key / source href 裸列表页（MVP）。详见 changelog [SEARCH-02-A]。
   - **SEARCH-02-B** — admin-ui CommandPalette Props 扩展（onQueryChange/prefilteredGroups/loading/emptyRemoteState + filterAndFlatten 拆分 + admin-shell 透传 + 单测）（状态：✅ 已完成 2026-06-13）
     - 建议模型：opus（**改 admin-ui 公开 Props → 强制 arch-reviewer Opus + commit trailer**）
     - 完成备注：执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, agentId ae0fbd23a5c95ba9a) **PASS**（无红线；D-200-1 五项 + §4.1.6 AMENDMENT 落地；Y-1 CommandItem.id 唯一性 JSDoc 已纳）。门禁 typecheck/lint EXIT=0 + test:changed 86 文件 1073 passed。commit 带 Subagents trailer。详见 changelog [SEARCH-02-B]。
   - **SEARCH-02-C** — server-next 接线（admin-shell-client debounce+AbortController 调 /admin/search + DTO→CommandGroup 映射）+ e2e（状态：✅ 已完成 2026-06-13 → **SEARCH-02 Phase 1 顶栏 MVP 全 3 子卡闭环**）
     - 建议模型：sonnet（接线 + e2e，无新共享 API / 无新端点）
     - 完成备注：执行模型 claude-opus-4-8（连续推序列，偏离 sonnet 建议，无强制升降触发）；子代理无。门禁 typecheck/lint EXIT=0 + test:changed 14 passed + e2e global-search 2 passed + **test:e2e:admin 84/84**（全 admin 域零回归）。详见 changelog [SEARCH-02-C]。
3. **SEARCH-03** — Phase 2：统一 admin_search ES 索引（状态：⬜ 后排，依 Phase 1 埋点**数据**）
   - **SEARCH-03-PRE** — Phase 2 前置埋点设计（ADR-200 AMENDMENT D-200-10）（状态：✅ 已完成 2026-06-13）
     - 完成备注：执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, agentId ad4632c17c1773830) 设计裁定。ADR-200 AMENDMENT D-200-10.1~.5 Accepted：两类 metric（admin_search_query 服务端 + admin_search_click 客户端，关联键 query_hash）/ PII 红线（加盐 sha256 截断 16hex、盐缺失 fail-closed、明文 query 不落日志）/ route 层 emit（横切关注点不破分层）/ 新端点 POST /admin/search/telemetry（client 传明文 query→服务端加盐 hash、零改 admin-ui Props/跨消费方 DTO）/ 推导口径写死。纠 3 前提（metric 范式=ADR-107 §6 非 NEGATED 的 ADR-119 / admin_search 字符串已占用加后缀区分 / onAction 跨 hook+shell-client 接线）。门禁 verify:adr-contracts EXIT=0。docs-only。详见 changelog [SEARCH-03-PRE]。
   - **SEARCH-03-PRE-IMPL** — 埋点实施（route emit + 新 POST /admin/search/telemetry + searchTelemetry.ts + admin-ui onCommandAction/CommandItem.telemetry Props + server-next 点击接线 + PII 守门单测）（状态：✅ 已完成 2026-06-13）
     - 完成备注：执行模型 claude-opus-4-8；子代理：契约由 SEARCH-03-PRE-FIX 阶段 arch-reviewer (claude-opus-4-8, agentId a2e9de39d3e541d46) PASS-with-changes 定稿、实施未偏离故未再 spawn（commit 带 Subagents trailer，改 admin-ui 公开 Props）。两类 metric emit（admin_search_query route 层 + admin_search_click 新端点）+ 加盐 hashQuery + 限流桶 + CommandItem.telemetry/onCommandAction Props + mapAdminSearchToCommandGroups 预存 rank + hook 暴露 query + 同步 fire-and-forget 点击上报 + ADMIN_SEARCH_KINDS const SSOT + .env.example。**PII 守门发现**：route 测试改用真实 createFastifyLoggerOptions（serializeReq 截断 url.query）验证 GET ?q= 明文不落 access log。门禁 typecheck/lint EXIT=0 + test:changed 7416 passed（4 teardown flake 无关）+ verify:adr-contracts EXIT=0（240 路由对齐）+ e2e global-search 2/2。+20 测试。详见 changelog [SEARCH-03-PRE-IMPL]。
   - **依赖链**：SEARCH-03-PRE-IMPL ✅ 已落地埋点采集 → **上线收集足够数据后** SEARCH-03（Phase 2 统一索引决策）解锁。
4. **SEARCH-04** — Phase 3：预测/多语言（search_as_you_type + 拼音/aliases）（状态：⬜ 后排）
5. **SEARCH-05**（独立并行）— videos VideoFilterBar → DataTableSearchInput 收编（状态：✅ 已完成 2026-06-13）
   - 完成备注：执行模型 claude-opus-4-8（连续推序列，偏离 sonnet 建议，无强制升降触发）；子代理无（消费方收编、未改 admin-ui 公开 Props）。`VideoFilterBar` 内部裸 input + 自管 draft/debounce/sync 全收编到共享原语 `DataTableSearchInput`（ADR-149 D-149-8/D-149-13 IME+debounce+Enter+焦点稳定），公开契约/testid/onPatch 语义零变更；filtersRef read-modify-write 保留不丢并发列筛选。门禁 typecheck/lint EXIT=0 + test:changed 73 passed + admin videos.spec 5/5（含搜索过滤链路守护）。后台搜索框收编后 ~95% 统一 DataTableSearchInput。详见 changelog [SEARCH-05]。

---

## [SEQ-20260614-01] 元数据状态综合治理 + TMDB 接入前置设计

- **状态**：⏸ 后排（META-31 Phase 0 设计已完成；后续实现卡待排期）
- **创建时间**：2026-06-14
- **最后更新时间**：2026-06-14
- **目标**：在 TMDB 真接入前，先统一元数据增强的命名、状态输出、管理 UI/UX、排序过滤数据支撑与 API 凭证语义，避免后续开发继续沿“匹配 / 富集 / 外部元数据 / 豆瓣绑定”多套概念分叉。
- **背景**：项目已通过 Douban、Bangumi 做了元数据增强；已有实现分散在 `MetadataEnrichService`、Bangumi 本地 dump/API、Douban 网络/离线、`ExternalResourcesService`、旧 TMDB CSV import、凭证管理等路径。审核详情、视频编辑、视频库分别暴露“匹配”“富集”“外部元数据”“豆瓣绑定”“豆瓣·元数据”标签，语义混乱且 Douban 被过度特化。TMDB 官方 API 支持搜索、详情、图片、视频预告、watch provider 等元数据能力，不提供播放源；认证同时支持 Bearer Read Access Token 与 `api_key`，现有凭证管理需要明确字段语义。
- **范围**：Phase 0 设计落库 → Phase 1 统一状态 DTO/派生查询 → Phase 2 admin-ui 图标与 tooltip 原语 → Phase 3 审核详情/编辑抽屉/视频库改造 → Phase 4 凭证语义修订 → Phase 5 TMDB 接入。
- **硬约束**：
  - 四来源顺序固定为 Douban / Bangumi / TMDB / IMDb；Douban 不再拥有顶级“绑定”入口或独立编辑 tab。
  - 管理端只消费 `MetadataStatusSummary` 统一状态，不直接拼 `douban_status`、`bangumi_status`、`meta_score` 形成临时 UI。
  - “获取到数据”与“成功应用到视频”必须分离；候选/冲突不能被显示为已增强。
  - TMDB 只作为外部元数据来源，不进入播放源、线路、source health。
  - API 凭证字段必须区分 TMDB `read_access_token` 与 `api_key`，首选 Bearer；旧 KV fallback 清理仍服从 META-29。

### 任务列表

1. **META-31** — Phase 0：ADR-201 元数据状态综合治理 + TMDB 接入 UI/UX 契约落库（状态：✅ 已完成 2026-06-14）
   - 建议模型：opus（撰写 ADR + 跨审核页/视频编辑/视频库/凭证/TMDB 多契约）／执行模型：GPT-5 Codex
   - 文件：`docs/decisions.md`（ADR-201）+ `docs/task-queue.md` + `docs/tasks.md` + `docs/changelog.md`
   - 验收要点：统一术语、状态枚举、provider 图标状态、tooltip 摘要、审核详情、视频编辑、视频库排序过滤、API 凭证修订、TMDB 能力边界、后续拆卡顺序全部明确；不写代码。
   - 完成备注：执行模型 GPT-5 Codex。docs-only 落地 ADR-201：统一“元数据状态”术语与 `MetadataStatusSummary` DTO；定义 `overall/provider/issue/nextAction/sort` 状态模型；四来源图标固定 Douban/Bangumi/TMDB/IMDb（已应用=正常、未获取/不适用=灰、候选=黄点、异常=红点）；审核详情合并为单一 `元数据状态` section；视频编辑删除顶级 `豆瓣·元数据` tab、改统一 `元数据` tab；视频库元数据列服务端排序过滤字段定稿；TMDB 凭证区分 `read_access_token` vs `api_key` 且首选 Bearer；TMDB 只作为元数据 provider，不作为播放源。门禁 `npm run verify:adr-contracts` EXIT=0（仅既有 advisory warning）。详见 changelog [META-31]。
   - 解锁：META-32。
   - **META-31-FIX**（审核修订 · ✅ 已完成 2026-06-14）：独立审核 ADR-201 发现 1 事实错误 + 3 关系/迁移缺口 + 2 实施 open-q，按修订 1–7 落库——订正视频编辑 tab；ADR-172 AMD2/AMD3 + ADR-173 挂修订指针；ADR-201 补取代关系/TMDB 迁移路径/服务端排序 open-q/providers 4-key 常量；META-32 加 Opus 评审 gate + 两决策项、META-37 补迁移项。docs-only，不改动 commit 5f73dd30。执行模型 claude-opus-4-8。
2. **META-32** — Phase 1：统一元数据状态 DTO + 派生服务/查询（状态：✅ 已完成 2026-06-14，依 META-31）→ 前置 gate arch-reviewer(claude-opus-4-8, agentId a9a76572f8b5f83ae) **CONDITIONAL-PASS**，已拆 -A ✅/-B ✅ 全收口 → 解锁 META-33
   - **评审放行条件（C1–C5）**：C1 五枚举（provider/state/issueLevel/nextAction/overall）落 const+type 双形态（对齐 `EXTERNAL_REF_PROVIDERS`）；C2 无源字段（`fetchedAt`/`reasonCodes` 全源、`confidence`/`matchMethod`/`appliedAt` 对 tmdb·imdb）Phase 1 恒占位 + DTO JSDoc 逐字段标注；C3 派生取数真源优先级 `catalog_external_refs`(ADR-177 canonical) > `video_external_refs` > `media_catalog` 四列(仅 cache 兜底)；C4 决策项①=动态 JOIN；C5 拆 -A/-B。
   - **决策裁定**：① 服务端排序过滤 = 动态 JOIN + SQL CASE alias（复用 `render_check_status`/`source_health` 先例；零 schema / 零 architecture.md 同步；性能瓶颈再起独立物化 ADR）；② `providers: Record<MetadataProvider,…>` 四 key 恒在 + `METADATA_PROVIDER_ORDER=['douban','bangumi','tmdb','imdb']` 显示顺序常量（const+type，barrel value 导出，与 `EXTERNAL_REF_PROVIDERS` 异名 + JSDoc 警示 + 集合相等单测防误用）。
   - **新发现（D-201-E）**：ADR-201 §派生规则真源优先级未显式排序（`media_catalog` 已被 ADR-177 降级 cache）→ 已在 ADR-201 §派生规则 + §偏离登记补登记。
   - 2a. **META-32-A** — 类型 + 派生 builder + 兼容并返（状态：✅ 已完成 2026-06-14）
     - 建议模型：opus（`@resovo/types` 公开类型契约；commit 须带 `Subagents: arch-reviewer` trailer）／执行模型：claude-opus-4-8
     - 文件：`packages/types/src/metadata-status.types.ts`(新) + `packages/types/src/index.ts`；`apps/api/src/db/queries/metadata-status.derive.ts`(新，`buildMetadataStatusSummary` + 派生算法 + 阈值 80 常量 + SQL CASE 片段)；`apps/api/src/services/VideoService.ts`(adminList/adminFindById 注入 `metadataStatus` 与 `enrichmentSummary` 并返)；`apps/api/src/db/queries/videos.ts`/`videos.internal.ts`(补 refs 聚合取数，不加排序过滤入参)；`apps/server-next/src/lib/videos/types.ts`(镜像 `metadataStatus?` + re-export)；单测(overall 优先级 1–6 / 阈值 80 边界 / 四 key 恒在 / not_applicable·missing / tmdb·imdb 占位恒 null·空 / refs 与 cache 冲突态)。
     - 协调点：`tooltipLines` i18n 文案不下沉后端 DTO（评审 T1 风险 3）→ 结构化字段为主，UI 拼装归 META-33。
     - 完成备注：执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, agentId a9a76572f8b5f83ae) 前置契约评审 CONDITIONAL-PASS。新增 `metadata-status.types.ts`（5 枚举 const+type + `METADATA_PROVIDER_ORDER` + DTO，无源字段 JSDoc 标注 C2）+ barrel；`metadata-status.derive.ts`（纯 `buildMetadataStatusSummary` + `getMetadataProviderRefs` 按页批量 refs + 真源优先级 catalog>video>cache，D-201-E）；`VideoService.adminList/adminFindById` 注入 `metadataStatus` 与 `enrichmentSummary` 并返；server-next `VideoAdminRow` 镜像 `metadataStatus?`；17 新单测。门禁 typecheck/lint EXIT=0 + test:changed 升全量 7432 passed（唯一失败 `UserSubmissionsClient` 隔离 12/12 = 既有全量 flake，无关）+ verify:adr-contracts EXIT=0。**解锁 META-32-B**。
   - 2b. **META-32-B** — 视频库排序过滤接入（动态 SQL）（状态：✅ 已完成 2026-06-14，依 32-A ✅）
     - 建议模型：sonnet（动态方案，无新端点/无 schema）／执行模型：claude-opus-4-8（主循环连续推进）
     - 文件：`apps/api/src/db/queries/videos.ts`(SORT_FIELD_WHITELIST 加 metadata_status/metadata_score alias + AdminVideoListFilters + WHERE 谓词 + 快捷筛选)；`apps/api/src/routes/admin/videos.ts`(ListQuerySchema + SORT_FIELDS，`csvEnum(METADATA_*)`)；`VideoService.ts`(透传)；`apps/server-next/src/lib/videos/types.ts`(filter/sortField 补值)；单测(过滤/排序 SQL + 大数据集排序性能用例)。
     - 完成备注：`metadata-status.derive.ts` 导出 `METADATA_OVERALL_RANK`/`METADATA_ISSUE_RANK` + `METADATA_STATUS_JOIN_SQL`（动态 `LEFT JOIN LATERAL` 3 层 derived table，per-provider state/issue CASE **逐分支镜像** JS `buildMetadataStatusSummary`，单一分支表 `providerStateBranches` 喂 state/issue 双 CASE 防漂移，纯静态常量 SQL）；`videos.ts` SORT +metadata_status(`md.metadata_status_rank`)/metadata_score(`v.meta_score`) + 9 过滤谓词（overall/providerState/issue 多选经 rank 映射 `=ANY($::int[])` + 四源 OR + `::timestamptz` 范围 + 4 快捷）+ **动态 JOIN 仅 sortField=metadata_status 或带 metadata 过滤时挂**（默认列表零成本，主/count 各按需）；route csvEnum + 透传；server-next 镜像。**口径一致性实证**：真库 200 抽样 SQL↔JS rank/issueRank/四源 state 0 失配 + 新增集成测试守卫。**边界裁定**：metadataScoreMin/Max 复用既有 / `metadataProvider` 单列 facet 延 META-36。门禁 typecheck/lint EXIT=0 + test:changed 升全量 7445 passed（唯一失败 DailyAnimeRow web-next jsdom 隔离 4/4 = 既有并发抖动）+ test:integration 72/72 + verify:adr-contracts EXIT=0。子代理无（方案由前置 gate 已定）。详见 changelog [META-32-B]。
3. **META-33** — Phase 2：admin-ui `MetadataSourceIconCluster` + `MetadataStatusPanel` 原语（状态：✅ 已完成 2026-06-14，依 META-32 ✅；-A 图标簇+tooltip + -B StatusPanel 两子卡全收口）→ 解锁 META-34/35/36
   - 建议模型：opus（admin-ui 公开 Props；commit 须带 `Subagents: arch-reviewer` trailer）
   - 范围：四来源图标、灰态、黄/红点、紧凑/抽屉密度、hover tooltip、a11y 文案；现有 `EnrichmentBadgeCluster` / `ExternalMetaPanel` / `SourceLogoBadge` 进入兼容或退役路径（标 `@deprecated`，不删、不新增消费点）。**仅建原语，零消费方接线**（接线归 META-34/35/36）。
   - **原子化拆卡**（2 完整组件 + 类型 + tooltip + 退役标记 + 测试 > 5 项）：两原语契约由 -A 前置 arch-reviewer (Opus) 一次性裁定，-B 复用同一 gate（沿 META-32-B 先例）。
   - 3a. **META-33-A** — `MetadataSourceIconCluster` + 共享 tooltip 构造器 + 新类型契约 + 旧组件 `@deprecated` 标记（状态：✅ 已完成 2026-06-14）
     - 完成备注：新建 `packages/admin-ui/src/components/metadata-status/`（types/labels/provider-icon/tooltip/cluster/index 6 文件）：`MetadataProviderIcon`（五态，DEV-33-1 新建非复用退役 SourceLogoBadge）+ `MetadataSourceIconCluster`（固定顺序四源、三密度全图标不过滤〔DEV-33-2〕、单 focus 目标 role=img + 受控 Popover hover+focus 同一 tooltip〔C6/R3〕）+ `buildMetadataTooltip` 纯函数（ADR-201 §Tooltip 结构化模型，issue 截断 C7）+ 文案常量进 barrel（C8 供 META-36 复用）。旧 `EnrichmentBadgeCluster`/`SourceLogoBadge`/`ExternalMetaPanel` 加 `@deprecated`（零行为变化）。子代理 arch-reviewer (claude-opus-4-8, agentId a910e6bb5fa5df2a7) CONDITIONAL-PASS（R1–R3 + C1–C11 + DEV-33-1/2/3）。门禁 typecheck/lint EXIT=0 + test:changed 1085 passed + 全量单测 7493 passed 零失败 + verify:adr-contracts EXIT=0；test:integration N/A。46 新单测。详见 changelog [META-33-A]。**解锁 META-33-B**。
   - 3b. **META-33-B** — `MetadataStatusPanel`（variant detail/drawer/compact）（状态：✅ 已完成 2026-06-14，复用 -A gate）
     - 完成备注：`metadata-status-panel.tsx`(154 行) + `metadata-source-card.tsx`(81 行，C1 拆子组件)：Header（overall + 内嵌 `<MetadataSourceIconCluster>` + 完整度 + 最近增强）+ 四来源卡（detail/drawer 展开 / compact 折叠为簇，复用 `MetadataProviderIcon` + externalId 外链 + matchMethod + 置信度 + candidate/problem per-card 动作）+ 问题列表（复用 cell `Pill`，issueLevel→variant，level=none 过滤，compact top-3）+ 下一步主按钮（`AdminButton` → `onAction(nextAction)`）+ `sourceEvidence` slot（detail/drawer，守单向依赖）。`onAction:(action, provider?)` 仅承载 MetadataNextAction（DEV-33-3，编辑细操作归 META-35）。门禁 typecheck/lint EXIT=0 + 全量单测 544 文件 7510 passed 零失败 + verify:adr-contracts EXIT=0；test:integration N/A。17 新单测。子代理无（复用 -A gate agentId a910e6bb5fa5df2a7，commit 带 Subagents trailer）。详见 changelog [META-33-B]。**META-33 全收口。**
4. **META-34** — Phase 3A：审核详情元数据状态统一展示（状态：✅ 已完成 2026-06-14，依 META-33 ✅）
   - 建议模型：sonnet／执行模型：claude-opus-4-8（主循环连续推进，偏离 sonnet 建议、无强制升降触发）
   - 范围：`TabDetail` 移除散落的 Douban pill / “富集” / “外部元数据”并列展示，合并为 `元数据状态` 区块；保留发布/审核/可见性 triad 的业务边界。
   - 完成备注：`TabDetail.tsx` 按 ADR-201 §审核详情（decisions.md 22723–22739）逐条改造——① 内容治理 triad 仅留发布/可见性/审核 3 个 Pill（删 douban pill + `doubanLabel`，douban 去特化为四来源之一）；② 删「富集」section（`EnrichmentBadgeCluster`）+ 信息区裸 `meta_score` DetailRow + 独立「外部元数据」section（`ExternalMetaPanel`）；③ triad 之后新增单一「元数据状态」section 用 `MetadataStatusPanel variant="detail"` 消费 `extDetail.metadataStatus`（沿用既有懒加载 `getVideo`→adminFindById，META-32-A 注入；`VideoQueueRow` 无 metadataStatus 不污染 queue list query），三态降级（加载中/加载失败/已加载无 metadataStatus）不阻断重测按钮与信息区；enrichedAtLabel 取 `enrichedAt.slice(0,10)`（沿用本组件既有日期约定）。**边界裁定**：只读展示不接 `onAction`（增强细操作归 META-35 工作台；读-only 下 panel 零渲染动作按钮，Codex fix 已保障无死按钮）/ 不构造 `sourceEvidence`（bangumi 角色·entry 富视图归 META-35；detail 四来源卡已暴露 externalId 外链+matchMethod+置信度，覆盖「查看原始外部 ref」，ADR「若仍需…」为可选）/ 退役 `EnrichmentBadgeCluster`·`ExternalMetaPanel` 在 TabDetail 移除消费点（D-201-2 / §取代关系；EnrichmentBadgeCluster 在审核台仅余 ModListRow 一个消费点）。退役测试更新：`enrichment-cluster-moderation.test.tsx` 的 TabDetail 富集簇 describe 块随之退役（测试被移除行为的必要后果，ModListRow 接入点保留 3 测试）。门禁 typecheck/lint EXIT=0 + test:changed 5 文件 29 passed（含既有 TabDetail reprobe/episodes 零回归）+ verify:adr-contracts EXIT=0；**test:e2e:admin N/A**（`tests/e2e/admin` 仅 dashboard/search/notifications/videos，无 moderation RightPane spec，本卡无 e2e 验证增量，回归面为单测，14 moderation 测试文件 83 passed 全绿）。8 新单测（TabDetailMetadataStatus）。纯消费不改 admin-ui 公开 Props（无 arch-reviewer / 无 Subagents trailer）。详见 changelog [META-34]。**解锁 META-35（编辑抽屉）/ META-36（视频库列 UI）继续消费两原语。**
5. **META-35** — Phase 3B：视频编辑抽屉去 Douban 独占 tab + 元数据状态整合（状态：✅ 已完成 2026-06-14，依 META-33 ✅；用户裁定选项 A→A1，Opus 自实现）
   - 建议模型：sonnet／执行模型：claude-opus-4-8（用户明示自实现，不 spawn sonnet）
   - 范围：删除顶级 `豆瓣·元数据` tab，`外部元数据` 改为 `元数据`；Douban/Bangumi/TMDB/IMDb 作为来源卡进入同一 tab；旧 `tab=douban` 深链兼容到 `metadata`。
   - 完成备注：抽屉 5 tab → 4 tab（去 douban/external，合并 `metadata`）。新 `_videoEdit/TabMetadata.tsx`（① `MetadataStatusPanel variant="drawer"` 消费 `video.metadataStatus`，**不传 onAction** → Phase 1 无重新增强/跨源应用端点，避免 `missing→run_enrichment`/`partial→improve_fields`/bangumi 候选死按钮，对齐 META-33-B 无死按钮 + META-34 detail 先例；三态降级不阻断下方区；② `sourceEvidence` = 新 `_videoEdit/MetaSourceEvidence.tsx`〔server-next 自建，仅复刻退役 ExternalMetaPanel ②真源字段 ③Bangumi 条目 ④角色·声优，不含①四源总览〔与 panel 四卡重复〕〕；③「Douban 来源关系」区原样复用 `TabDouban`，search/confirm/diff/confirmDoubanMatch/ignoreDoubanMatch 零回归）。`_videoEdit/types.ts` `TabKey` 去 douban/external + 加 metadata + `normalizeTabKey`（旧深链 douban/external→metadata）。`VideoEditDrawer.tsx` TABS 5→4 + initialTab 归一 + tab 内容换 TabMetadata（QUICK_HEAD 头部簇维持既有 EnrichmentBadgeCluster，ADR-201 过渡期新旧共存；D-201-3 头部四源簇迁移连同视频库列簇归 META-36，避免本卡越范围）。`VideoRowActions.tsx`「外部元数据」深链 external→metadata + label 改「元数据」（`douban-sync` 行级豆瓣同步不动）。**边界裁定**：不改 admin-ui 公开 Props（用现有 `sourceEvidence` + 不传 onAction）→ 无 arch-reviewer/trailer；不新增端点（重新增强/跨源应用字段/仅存外部 ID 延后 TMDB phase META-37+）；ExternalMetaPanel 在抽屉的最后消费点移除（组件仍 `@deprecated` 保留供历史引用）。门禁 typecheck/lint EXIT=0 + test:changed 7 文件 91 passed + verify:adr-contracts EXIT=0 + **test:e2e:admin 84/84 passed**（含 videos.spec 编辑 Drawer 黄金路径）。+17 新单测（VideoEditDrawer META-35 6 + normalizeTabKey 1 + MetaSourceEvidence 10），既有 36 零回归。子代理：无（不改 admin-ui 公开 Props / 不新增端点）。详见 changelog [META-35]。**解锁 META-36（视频库列 UI，含头部/列四源簇迁移）。工作台空闲。**
6. **META-36** — Phase 3C：视频库元数据列排序过滤改造（状态：✅ 已完成 2026-06-14，-A ✅ + -B ✅ 全收口，依 META-32 ✅ + META-33 ✅）
   - 建议模型：sonnet
   - 范围：`元数据` 列使用四来源图标；支持 overall/provider/issue/score/updatedAt 过滤；默认排序改为运营优先级，完整度数值另保留专用排序字段。
   - **META-32-B 衔接**：后端排序/过滤字段已备齐（`metadata_status`/`metadata_score` 排序 + overall/providerState/issueLevel 多选 + updated 范围 + needs_review/has_candidate/missing/tmdb_pending 快捷；动态 LATERAL `md.*`）；本卡为 UI 消费。**待补后端**：`metadataProvider` 单列 facet 谓词（META-32-B 边界裁定暂未做，ADR 未明确与 providerState 组合规则；provider state 列 `md.md_<p>_state` 已暴露，仅需补 WHERE 谓词 + route csvEnum，零回头改 SQL 派生）。
   - **原子化拆卡（CHG-CARD-ATOM 第 1 问：改动项 > 5 → 拆 -A/-B）**：图标簇迁移 + 5 维过滤接线 + 排序改造 + 后端 facet + api 序列化 + 头部簇迁移 > 5 项；拆为 -A（排序/过滤服务端接线）→ -B（图标簇消费迁移），-B 依 -A 串行。`metadataProvider` 语义裁定：选中 provider 中任一 `state ∈ {applied,candidate,problem}`（有数据）OR 合流，与其余过滤 AND 组合（复用 `md_<p>_state` 列零新派生 / 对齐 providerState 四源 OR 范式 / 加性可扩展）。
   - 6a. **META-36-A** — 视频库元数据列排序/过滤服务端接线（状态：✅ 已完成 2026-06-14，依 META-32 ✅ + META-33 ✅）
     - 建议模型：sonnet／执行模型：claude-opus-4-8（主循环连续推进，偏离 sonnet 建议、无强制升降触发）
     - 跨层理由：后端 `metadataProvider` facet 单谓词 + UI 过滤/排序接线属同一服务端排序过滤闭环（D-201-6），后端加性无 schema、UI 纯消费，跨 api-service/UI 两层。
     - 完成备注：后端补 `metadataProvider` facet（`routes/admin/videos.ts` ListQuerySchema +`csvEnum(METADATA_PROVIDERS)` + 透传；`db/queries/videos.ts` `AdminVideoListFilters +metadataProvider` + WHERE 谓词〔选中 provider 经 `PROVIDER_STATE_COL` 映射 `md_<p>_state IN ('applied','candidate','problem')` OR 合流，状态字面量内联无用户输入拼接〕+ 纳入 `hasMetadataFilter` 动态 JOIN；`VideoService.adminList` 透传）；server-next `VideoListFilter +metadataProvider` + `api.ts listVideos` 序列化**全量** metadata 过滤参数（断点修复：原零序列化）；UI 排序 `COMPOSITE_SORT_MAP meta: meta_score→metadata_status`（运营优先级默认）+ `meta_score: metadata_score`（完整度专用，解禁 `enableSorting`）+ `SORT_FIELD_WHITELIST +metadata_status/metadata_score`；UI 过滤新增 4 隐藏 filter-only 列（`metadata_overall`/`metadata_provider`/`metadata_issue_level` enum + `metadata_updated` date-range）+ `buildVideoFilter` 映射 + `VIDEO_QUICK_FILTERS` +4 元数据运营快捷（需复核/有候选/未增强/TMDB 待处理）。**必要联动**：`lib/videos/columns.ts` descriptor 注册表同步新列 + meta_score enableSorting（有测试守卫）；`VideoListClient.tsx` `QUICK_COUNT_FILTERS: Record<VideoQuickFilterKey>` 穷举新键（typecheck 强制）。**边界裁定**：`metadataProvider` 语义取保守可扩展解（任一选中 provider 有数据 OR + 与其余过滤 AND，复用既有列零新派生）；`metadataProviderState` UI 不接（卡面范围未列，后端能力 META-32-B 已就绪，留 follow-up）；图标簇 cell/头部迁移（D-201-3）归 -B。门禁全绿：typecheck/lint EXIT=0 + test:changed 104 文件 1363 passed + test:integration metadata SQL 6/6（真实 PG，含 metadataProvider facet 可执行性）+ verify:adr-contracts EXIT=0 + **test:e2e:admin 84/84**（videos.spec 黄金路径 + 列宽零回归）。+14 新单测（route facet 1 + integration 1 + 列接线 5 + buildVideoFilter 映射 5 + api 序列化 2）。子代理无（不改 admin-ui 公开 Props / 无新 route / 无 schema）。详见 changelog [META-36-A]。**解锁 META-36-B（图标簇消费迁移）**。
   - 6b. **META-36-B** — 四来源图标簇消费迁移（状态：✅ 已完成 2026-06-14，依 36-A ✅）
     - 建议模型：sonnet／执行模型：claude-opus-4-8（主循环连续推进）
     - 验收口径（一句话）：`MetadataSourceIconCluster` 取代退役 `EnrichmentBadgeCluster` 成为视频库 `元数据` 列（density=table）与编辑抽屉头部（density=header）的紧凑元数据显示原语（D-201-3）。
     - 完成备注：`VideoColumns.tsx` meta 列 cell `EnrichmentBadgeCluster density="row"` → `MetadataSourceIconCluster summary={row.metadataStatus} density="table"`（固定四源 + 空态四灰图标，ADR-201「空态不显示未富集长 pill」；metadataStatus 缺省〔旧行未派生〕→ null 兜底）；`VideoEditDrawer.tsx` QUICK_HEAD `EnrichmentBadgeCluster density="header"` → `MetadataSourceIconCluster density="header" showScore enrichedAtLabel`（消费 `video.metadataStatus`，enrichedAt slice(0,10) 沿用既有日期约定）。两文件 import 由 EnrichmentBadgeCluster 换 MetadataSourceIconCluster（仅纯消费、不改 admin-ui Props）。退役彻底：迁移后 EnrichmentBadgeCluster 全仓非 test 消费点仅余审核台 `ModListRow`（保留 @deprecated）。测试迁移 `enrichment-cluster-faces.test.tsx` Face1（视频库行 density=table + 四 data-provider 图标 + table 无完整度微文案 + 无 metadataStatus→null）+ Face2（抽屉头部 density=header + 四图标 + showScore 完整度微文案 72 + score=null 无微文案 + 无 metadataStatus→无簇），复用共享 `_fixtures.ts makeSummary`。门禁全绿：typecheck/lint EXIT=0 + test:changed 5 文件 71 passed + verify:adr-contracts EXIT=0 + **test:e2e:admin 84/84**（videos.spec 黄金路径渲染图标簇零回归）。9 单测（迁移）。子代理无（纯消费不改 admin-ui Props）。详见 changelog [META-36-B]。**META-36 全收口（-A 排序过滤 + -B 图标簇迁移）。Phase 3（审核详情/编辑抽屉/视频库三消费面）元数据状态展示统一完成（META-34/35/36）。工作台空闲。**
7. **META-37** — Phase 4：API 凭证 TMDB 语义修订（状态：✅ 已完成 2026-06-14，-A ✅ + -B ✅ 全收口，依 META-31；需协调 META-29）
   - 建议模型：opus（凭证公开类型 + 旧 KV 清理边界）
   - 范围：`tmdb.read_access_token` 与 `tmdb.api_key` 字段分离；Bearer 为首选；连接测试与 UI 文案同步；修正旧 `tmdb.token -> tmdb_api_key` 语义错配；新增 `loadTmdbClientConfig`（对齐 `loadBangumiClientConfig`）。
   - **存量迁移**：`api_credentials.secrets.token` → `read_access_token`（默认）；legacy `system_settings.tmdb_api_key` → `api_key`（不再回填 Bearer）；迁移幂等可回滚、过渡期新旧并存读取 / 写入只走新字段（详见 ADR-201 §凭证语义「存量迁移」）。
   - **原子化拆卡（CHG-CARD-ATOM 第 1/2 问：改动项 7 > 5 + 跨 types/migration/service/UI 多层 → 强制拆 -A/-B）**：关键架构发现 = `IntegrationCredentialsService`（遮罩/占位跳过/configured/审计 redact）与 `ExternalCredentialsCard` UI **全部由 `PROVIDER_CREDENTIAL_SPECS.fields` + `secret` flag 驱动** → 双 secret 字段拆出后自动处理，service/UI 输入框零改。契约由 -A 前置 arch-reviewer (Opus) 一次性裁定，-B 复用同一 gate（沿 META-32/33 先例）。**协调 META-29**：A 仅修正映射不删旧 KV（过渡期新旧并存读取，旧 KV 物理退役仍归 META-29 Card D）。
   - 7a. **META-37-A** — TMDB 凭证字段拆分 + 存量迁移 + 旧 KV 映射修正（状态：✅ 已完成 2026-06-14，依 META-31 ✅）
     - 建议模型：opus（`packages/types` 公开凭证契约 + 数据迁移；commit 须带 `Subagents: arch-reviewer` trailer）
     - 文件：`packages/types/src/integration-credentials.types.ts`（tmdb spec `token` → `read_access_token`〔secret/Bearer/`TMDB_READ_ACCESS_TOKEN`〕 + `api_key`〔secret/v3/`TMDB_API_KEY`〕，保留 baseUrl/language）；`apps/api/src/db/migrations/116_tmdb_credentials_token_split.sql`（新，`secrets.token`→`read_access_token`，`secrets ? 'token'` 幂等守卫 + down 注释）；`integration-credentials-config.ts`（`LEGACY_KV_MAP.tmdb` `token`→`api_key`）；`docs/architecture.md`（116 登记，若需）；单测（config legacy tmdb fallback 取 api_key + types 契约守卫）。
     - 验收口径（一句话）：tmdb 凭证字段拆分 read_access_token/api_key，存量 secrets.token 与 legacy KV 各归位且幂等可回滚。
     - 完成备注：执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, agentId a6c0adf46c51267c5) 前置契约+迁移评审 **CONDITIONAL-PASS**（C1 migration 空串守卫 / C2 LEGACY_KV_MAP 改 api_key / C3 测试 fixture 同步 / C4 清陈旧注释 + Y1/Y2/Y3 全采纳；裁定 snake_case 字段 key 维持，遵循 ADR 字面 + TMDB 官方协议名）。types tmdb spec `token` 拆 `read_access_token`(Bearer/`TMDB_READ_ACCESS_TOKEN`)+`api_key`(v3/`TMDB_API_KEY`)；migration 116 `secrets.token`→`read_access_token`（幂等+并存+空串守卫+down 注释）；LEGACY_KV_MAP.tmdb `token`→`api_key`。**关键发现**：IntegrationCredentialsService 遮罩/占位/configured/审计 + ExternalCredentialsCard 输入框全由 spec.fields+secret flag 驱动 → 双 secret 字段拆出后**自动处理，service/UI 逻辑零改**；siteConfig.ts:153 确有 tmdb_api_key 写入路径，但 ADR 22821/22822 deliberate 区分「表内 secrets.token（label Bearer）→read_access_token」vs「旧 KV fallback→api_key」两互斥位置，116 符合 22821，错配属 ADR 接受边界（META-38 连接测试自愈）。architecture.md 不改（116 非 schema 变更，字段真源委托 PROVIDER_CREDENTIAL_SPECS，verify-sql-schema-alignment 通过）。门禁 typecheck EXIT=0 + lint 仅既有 warning + test:changed 升全量 546 文件 7551 passed 零失败 + verify:adr-contracts EXIT=0（endpoint-adr 240 对齐无新端点）。+3 新 it（config tmdb 解析 2 + 契约守卫 1）+ 2 断言修订。详见 changelog [META-37-A]。**解锁 META-37-B**。**收口后 Codex stop-time review 拦截补 FIX**：loader 加行内旧 secret key 兼容（`LEGACY_ROW_SECRET_MAP`，read_access_token←token），守 ADR-201 22823「过渡期新旧并存读取」——代码先于 migration 部署/回滚时旧行 secrets.token 仍可读为 Bearer；+3 单测；详见 changelog [META-37-A-FIX]。
   - 7b. **META-37-B** — lib·tmdb 双路 testConnection + loadTmdbClientConfig + tmdbTester + UI auth_method 展示（状态：✅ 已完成 2026-06-14，依 37-A ✅）
     - 建议模型：sonnet（服务/客户端/UI 消费接线，复用 -A gate）
     - 文件：`apps/api/src/lib/tmdb.ts`（`TmdbClientConfig` `token`→`readAccessToken`+`apiKey`，`testConnection` Bearer 首选/api_key query 兼容/429 warn 不标 invalid + `resolveTmdbAuthMethod`）；`apps/api/src/services/tmdb-config.ts`（新 `loadTmdbClientConfig` 对齐 `bangumi-config.ts`）；`integration-credential-testers.ts`（tmdbTester 取 read_access_token/api_key）；`ExternalCredentialsCard.tsx`（前端从 view.values 派生 auth_method 展示 badge）；单测。
     - 验收口径（一句话）：TMDB 凭证解析/连接测试/UI 按 Bearer 首选、API Key 兼容取新字段并展示当前 auth_method。
     - 完成备注：执行模型 claude-opus-4-8（主循环连续推进，偏离 sonnet 建议、无强制升降触发；复用 META-37-A arch-reviewer gate）；子代理无。lib/tmdb `TmdbClientConfig` token→readAccessToken+apiKey + `testConnection` Bearer 首选(Authorization)/api_key query 兼容(?api_key=)/429 warn 不标 invalid/皆缺 none + 导出 `resolveTmdbAuthMethod`；新 `tmdb-config.ts` loadTmdbClientConfig（对齐 bangumi-config，仅注入有值字段，Bearer+api_key 并存交消费点派生）；tmdbTester 取 read_access_token/api_key；ExternalCredentialsCard tmdb 卡状态行派生 auth_method badge（view.values read_access_token→Bearer 首选/api_key→API Key v3/皆空→未配置，server-next app 内特化非 admin-ui Props，testid integration-tmdb-auth-method）。**边界**：UI auth_method 前端派生不扩后端 DTO（CredentialTestResult/View 不加 authMethod，lib TmdbTestResult.authMethod 仅测试断言 + META-38 储备）。门禁 typecheck EXIT=0（重构无破坏消费方）+ lint 零本卡警告 + test:changed 增量 6 文件 52 passed（SettingsTab 15 零回归）+ verify:adr-contracts EXIT=0；test:e2e:admin N/A（无 settings 凭证卡 e2e spec，回归面单测，META-34 先例）。+9 单测。详见 changelog [META-37-B]。**META-37 全收口。解锁 META-38。**
8. **META-38** — Phase 5A：TMDB API client + search/detail MVP（状态：✅ 已完成 2026-06-14，依 META-37 ✅）
   - 建议模型：sonnet
   - 范围：官方 API search/movie/tv + detail + external_ids + images + append_to_response；限速/429 尊重；不接播放源。
   - 完成备注：执行模型 claude-opus-4-8（偏离 sonnet 建议，opus 会话覆盖连续推进；lib client 非共享 UI Props + 有 bangumi/douban 范本，未触发强制升 Opus，无子代理）。`lib/tmdb.ts` 补全只读 client：私有 `tmdbGet<T>`（Bearer/api_key 双路鉴权复用 `applyAuth` + 超时 + **429 退避重试**〔Retry-After 优先 / 指数退避封顶 10s / ≤maxRetries〕 + **进程内串行最小间隔节流** throttle）+ `TmdbHttpError`；出口 `searchMovie`/`searchTv`（strict 抛错版，year→primary_release_year/first_air_date_year）+ `getMovieDetail`/`getTvDetail`（append_to_response 拼接 + 404 valid-negative 返 null，对齐 bangumi.getSubject）+ `getConfiguration`；每出口旁路 `recordFetch`（provider=tmdb method=api，复用 external-fetch-recorder，填 DTO fetchedAt 埋点 + source 预留）。新 `lib/tmdb.types.ts`（search/detail/append〔external_ids/images/videos/credits/aggregate_credits/release_dates/content_ratings/translations〕/configuration 响应类型子集）。`testConnection` 重构复用 `applyAuth`（URL 版，13 回归测试零破坏）。**边界裁定**：零 route/migration/UI/worker（候选确认·应用归 META-39 → 届时起独立端点 ADR + Opus PASS，MUST-8）；external_fetch_log provider TEXT 无 CHECK + PROVIDER_KEYS 已含 tmdb → 埋点零 migration；EXTERNAL_PROVIDERS.tmdb planned→active 归 ADR-188 external-resources。门禁 typecheck EXIT=0 + lint EXIT=0（仅既有 warning）+ test:changed 45 passed（tmdb 14 新 + 凭证服务/路由零回归）+ verify:adr-contracts EXIT=0；test:e2e N/A（纯 lib 无 spec，META-34/37-B 先例）。14 新单测。详见 changelog [META-38]。执行模型: claude-opus-4-8
   - 解锁：META-39（TMDB 候选确认与应用，opus；首个新增 admin route 卡 → 起独立端点 ADR）。
9. **META-39** — Phase 5B：TMDB 候选确认与应用流程（状态：✅ 已完成 2026-06-14，-A ✅ + -B ✅ 全收口，依 META-38 ✅ + META-32 ✅；ADR-202 已落库 + 双轮 arch-reviewer CONDITIONAL-PASS）
   - 建议模型：opus（跨增强流程、外部 ref 写入、审核 UI）
   - 范围：TMDB candidate/ref 写入，人工确认后应用到 catalog/video；状态进入 `MetadataStatusSummary`；冲突/低置信走需复核。
   - **前置 ADR-202 已落库**（decisions.md，D-202-1~8 + 3 端点契约 + FU-202-1/2/3）；子代理 arch-reviewer (claude-opus-4-8, a2afa5615397986dd〔D-1~7〕 + a7c8e6a117a6ecc4d〔D-8 多语言〕)；真实 API 实测验证 TMDB 多语言三变体（zh-CN/zh-TW/zh-HK）对应 ADR-174/175 简繁结构。
   - 9a. **META-39-A** — 端点 ADR 落库 + 后端 search/confirm/reject + TmdbConfirmService + 核心标量应用 + mapTmdbGenres（状态：✅ 已完成 2026-06-14）
     - 建议模型：opus
     - 范围：ADR-202 落库（首 commit ✅）→ `routes/admin/moderation.tmdb.ts`（3 端点 `/admin/videos/:id/tmdb-{search,confirm,reject}`）→ `TmdbConfirmService`（search/confirm/reject，单事务 D-202-2）→ 复用 resolveAndWriteExactRef/insertCandidateRef/safeUpdate/upsertVideoExternalRef + 新增 `mapTmdbGenres`（movie+tv 两套 id）+ 核心标量映射 D-202-8（M1/M3/M4/M5，imdb cache-only fill-if-empty）→ 单测。零 migration。
     - 边界：external_kind 仅 movie→exact / tv-season→exact 两路径，tv-show-root 落 candidate（D-202-1）；无 pending 守卫（D-202-6）；冲突走 422 不 409（D-202-4）；title_en/translations→aliases 移出（FU-202-1/2）。
     - 完成备注：执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, a2afa5615397986dd + a7c8e6a117a6ecc4d，ADR-202 双轮评审契约)。`moderation.tmdb.ts` 3 端点（zod + 404 + Service 委托 + D-202-4 冲突 422 CONFIRM_FAILED 不 409 + D-202-6 无 pending 守卫）；`TmdbConfirmService`（search 只读返候选 / confirm 单事务：REST 事务外拉 detail → BEGIN → resolveAndWriteExactRef〔movie/season〕或 insertCandidateRef〔show〕→ safeUpdate 核心标量〔传 client 同事务〕→ tmdb_id cache 确认语义 + imdb_id fill-if-empty〔M4〕→ upsertVideoExternalRef manual_confirmed → COMMIT / reject）；`mapTmdbGenres`（movie+tv 两套数值 id→VideoGenre，稳定 key 避本地化 name 污染）；核心标量 M1〔title 简中缺失回退 original，空不写〕/M3〔original_language 存 BCP47 language-only〕/M5〔genres-by-id〕。**search 只读不落 candidate**（自动富集 candidate 态归 worker follow-up，手动 search→confirm 即时流程不经中间态——D-202-2 实施细化）。cache UPDATE 内联事务编排（applyEnrichmentDb 先例，事务内原子同步）。门禁 typecheck EXIT=0 + lint 通过 + verify-endpoint-adr ✅ 243 路由对齐（3 新端点）+ test:changed 41 文件 548 passed（service 13 + route 8 + douban/bangumi 零回归）。+21 新单测（service 13〔含 mapTmdbGenres 3〕 + route 8）。**集成测边界**：confirm 编排复用的写侧原语（resolveAndWriteExactRef/safeUpdate/upsertVideoExternalRef）各有既存集成测，新增仅 cache UPDATE 简单 SQL；confirm 端到端集成（真实 video/catalog seed）归 META-39-B e2e。详见 changelog [META-39-A]。执行模型: claude-opus-4-8
   - 9b. **META-39-B** — 审核 UI：TabTmdb 候选搜索/确认/拒绝（状态：✅ 已完成 2026-06-14，依 -A ✅）
     - 建议模型：opus
     - 范围：新建 `TabTmdb`（mediaType 切换 + 搜索框 + 候选列表 + fields 多选 + 确认/拒绝，对齐 TabDouban/use-douban 范式）+ `use-tmdb` hook + server-next api 3 函数 + VE.tmdb 文案；挂 `TabMetadata` 作 TMDB 来源关系区。覆盖 bangumi/locked 字段精确 danger（D-202-3）首版用通用提示，精确标记 + e2e（需 seed 基建）留 follow-up。
     - 完成备注：执行模型 claude-opus-4-8；子代理无（纯前端接线，不改 admin-ui 公开 Props）。新建 `TabTmdb`（mediaType movie/tv 切换〔默认据 video.type〕 + 搜索框 + year + 候选列表 + fields 多选〔默认全选 7 字段，取消勾选→confirm fields 不含〕 + 确认/拒绝，对齐 TabDouban）+ `use-tmdb` hook（search/confirm/reject state，confirm 返 boolean）+ api 3 函数（tmdbSearchForVideo/tmdbConfirmForVideo/tmdbRejectForVideo）+ `types.ts` TmdbCandidate 镜像 + `VE.tmdb` 文案（冲突 reason→友好文案映射）；挂 `TabMetadata` 作「TMDB 来源关系」区（④，与 Douban 区并列）。tv 首版不选 season（落 show candidate，仍绑定+应用字段+cache）；season 选择 + per-field 精确 danger + e2e seed 留 follow-up。门禁 typecheck/lint EXIT=0 + test:changed 31 文件 335 passed（TabTmdb 5 + use-tmdb 5 + use-douban/VideoEditDrawer 零回归）+ **test:e2e:admin 84/84**（videos.spec 编辑 Drawer 黄金路径 TabTmdb 挂载零回归）。+10 新单测。详见 changelog [META-39-B]。执行模型: claude-opus-4-8

---

## [SEQ-20260615-01] 元数据字段枚举兼容性治理

- **状态**：✅ 全收口（META-40 / 41-A / 41-B / 42 / 43 / 44-A / 44-B / 45-A / 45-B ✅ 2026-06-15〔+ 旁路 META-37-A-FIX Codex P2×2〕）。元数据字段枚举兼容性治理全 9 卡完成：country 归一真源 + bangumi tags→genre + bangumi/TMDB country + TMDB 图片 + VideoType provider 修正（ADR-203）+ genre 拆双（ADR-204，drama 用户拍板不加）。后续 follow-up（Bangumi cast / 候选审核 UI 闭环 / web-next GENRE_LABELS 补值 O-204-3 / drama follow-up 触发条件）已登记，待另编序列。
- **创建时间**：2026-06-15 00:30
- **最后更新时间**：2026-06-15 01:10（用户评审 B+ 后修订：范围补 server-next / META-40 收敛真源 / META-41·44 拆 -A/-B / cast 后排 / META-43 source 口径 / 逐卡门禁）
- **目标**：修复 douban/bangumi/tmdb 三源元数据字段（类型/题材/地区/图片）与本地枚举的兼容缺口——含 1 项数据正确性 bug（实证）+ 4 项能力闲置 + 1 项设计权衡。
- **范围**：`apps/api`（三 Service + genreMapper + 图片应用）+ `packages/types`（枚举/country 归一真源）+ migration（存量清洗）+ **`apps/server-next`（管理端 UI：TabTmdb + VE.tmdb，META-42/43 fields 多选与文案）**；不动播放器/前台核心。
- **依赖**：META-38/39 ✅（TMDB 接入）；调查证据见本会话（DB 实证 country 污染、genreMapper/三 Service 源码核验）。
- **优先级裁定**：🔴 META-40 / META-41-A（高，数据正确性 + 信息全丢）> 🟡 META-41-B / META-42 / META-43 / META-44（中）> 🟢 META-45（低，需 ADR 扩枚举）。
- **门禁基线（逐卡至少）**：`typecheck` + `lint` + `test:changed`；涉 migration 卡加真库验证（清洗幂等）；涉 `TabTmdb` 卡（META-42/43）加 `test:e2e:admin`（videos.spec 编辑 Drawer 黄金路径）；ADR 卡加 `verify:adr-contracts`。
- **后续卡登记（本序列产出，不在本期）**：
  - **Bangumi cast 接入**（后排，独立评估）：CV 声优**不在 infobox**（`BangumiService.utils.ts:166` 明确「CV 属 /characters，不解析 cast 避免写错」），故 cast 不并入 META-41；须基于 `bangumi_characters`/getCharacters CV 数据另起卡评估写入路径与置信。
  - **Bangumi 候选审核 UI 闭环**（缺口，正交本序列）：上一轮调查的状态机 4 缺口（bangumi 无 confirm UI/无 reject/TMDB 候选无加载入口/onAction 未接线）属审核闭环，非字段兼容，待另编序列。

### 任务列表（按严重度优先级）

1. **META-40** — Country 格式归一治理（🔴 高 / 数据正确性 bug）（状态：✅ 已完成 2026-06-15）
   - **完成备注**：✅ 2026-06-15。country 归一真源 `countryToIso`/`COUNTRY_NAME_TO_ISO` 沉淀 packages/types（收敛原 API-local COUNTRY_MAP 8 国 + normalizeCountryCode，禁第二套表，评审 #2）+ 与 format-country-name 构成双向真源；写入侧 **6 处**归一（卡片记 5，开工调查补出 `DoubanService.confirmFields` 第 6 处——META-07 手动 fields 应用路径）；migration 117 存量清洗（真库 dry-run **124→0 残留** + 幂等 **UPDATE 0**；正式 COMMIT apply 留 `npm run migrate`，因 116 META-37-A 凭证迁移亦 pending、runner 连带 apply 超本卡范围）；裁定 A（D-199-3 显式例外，定向修复非全表回溯）。门禁 typecheck/lint EXIT=0 + test:changed 升全量 **7627 passed** + migration 真库验证。+9 新单测。执行模型 claude-opus-4-8；子代理无。详见 changelog [META-40]。
   - 创建时间：2026-06-15 00:30
   - 建议模型：sonnet
   - **问题（实证）**：`media_catalog.country` 应存 ISO 3166-1 alpha-2，但 dev 库实测同列混入中文名——`CN`(2363) 与 `中国大陆`(52) 并存、`US`/`美国`(18)、`JP`/`日本`(23)、`印度`(7) 等。根因 `DoubanService.ts:121/195` `updateFields.country = detail.countries[0]` 直接写 douban 中文名（`douban_entries.country` 全中文），无 ISO 转换。`formatCountryName('美国')` 降级返回原值故显示不报错，但同国裂两值 → 视频库 distinct/筛选/分组失效（筛「美国」匹配不到「US」行）；douban 仅取 `countries[0]` 丢合拍片多地区。
   - **方案（统一真源约束，评审 #2）**：① **不新建第二套表**——仓库已有 API-local `COUNTRY_MAP`（`SourceParserService.maps.ts:88` 中国大陆→CN…）+ `SourceLanguageResolver`（双形态规整：已 ISO 直接用、否则过 COUNTRY_MAP，且有「禁止新建映射」评审先例）。本卡把 country 归一**真源沉淀到 `packages/types`**（`countryToIso` 双形态 helper），**收敛/替换** API-local `COUNTRY_MAP` 引用，避免两套国家表。② douban 写入侧（DoubanService step1/2 + MetadataEnrichService）`country` 经归一后写。③ migration 存量清洗（中文名 → ISO，幂等 + 不可归一登记）。④ 单测 + 清洗脚本测。
   - **裁定点（须先决）**：清洗 migration 回写存量与 **`D-199-3「不回写存量数据」**有张力——D-199-3 语境是 SourceLanguageResolver 不回溯改写既有行；本卡是修 douban 引入的 `catalog.country` 污染（定向数据修复）。开工前明确：本卡清洗是 **D-199-3 的显式例外**（定向修复非全表回溯），或独立小决策记录。
   - **文件范围**：`packages/types/src/`（country 归一真源 helper）/ `apps/api/src/services/SourceParserService.maps.ts` + `SourceLanguageResolver.ts`（收敛引用）/ `DoubanService.ts` + `MetadataEnrichService.ts`（写入侧归一）/ `apps/api/src/db/migrations/NNN_*.sql`（存量清洗）/ 单测。
   - **门禁**：typecheck + lint + test:changed + **migration 真库验证**（清洗幂等 + COUNTRY_MAP 收敛后既有 SourceParser/Language 测零回归）。
   - **依赖**：无（最高优先，且为 META-41-B / META-42 复用归一真源的前置）。

2. **META-41-A** — Bangumi 细分标签 → genre 映射（🔴 高 / 信息全丢）（状态：✅ 已完成 2026-06-15）
   - **完成备注**：✅ 2026-06-15。genreMapper.ts 新增 `mapBangumiTags`（genre 映射第 4 个范式，对齐 mapDoubanGenres/mapTmdbGenres/mapSourceCategory）——**两层保守去噪**：白名单 `BANGUMI_TAG_MAP`（~35 高频可靠题材标签 → 17 VideoGenre）+ `MIN_TAG_VOTE_COUNT=3` 计数下限（去开放词表单/双用户偶发标签）；政策敏感取向标签（百合/耽美/后宫）不入表（对齐 douban「同性/情色→不映射」），原始标签仍留 catalog.tags 供审核；未知标签静默跳过。返回 `{genres, raw}`（结构体而非裸数组——bangumi 开放词表需同产归一 genres + 命中原始标签子集喂 genres_raw 溯源，JSDoc 论证）。`mapSubjectToCatalogFields` 用全量 subject.tags 产 genres/genresRaw。**scope 修正**：卡片引用 `BangumiService.ts:430-434` 实为 dump 降级分支（local dump `BangumiEntryMatch` 无 tags 字段，物理无源）→ 真落点改 `BangumiService.utils.ts`。门禁 typecheck/lint EXIT=0 + test:changed 43 文件 636 passed（未升全量）。+14 新断言（genreMapper.test 12 新 + bangumi-service mapSubjectToCatalogFields genres 2）。执行模型 claude-opus-4-8；子代理无（lib 纯函数非 admin-ui Props/新端点/跨消费方 schema）。详见 changelog [META-41-A]。
   - 创建时间：2026-06-15 00:30
   - 建议模型：opus（细分标签 → genre 映射设计需判断；bangumi tags 为开放词表）
   - **问题（核验）**：`BangumiService.ts:430-434` 仅写 `title/titleOriginal/description/rating/coverUrl`，**零 genres**。bangumi 动漫细分标签（百合/治愈/热血/日常/校园/废萌…）**全部丢弃**，且无任何 `bangumi→genre` 映射表（对比 douban 40 词表 / tmdb 27 id 表）。
   - **方案**：① 新建 `mapBangumiTags`（`genreMapper.ts`，bangumi tags → VideoGenre，**保守映射**避免开放词表噪声——仅高频可靠标签入表，未知标签静默跳过）；② BangumiService 字段构造补 `genres/genresRaw`；③ 单测。**仅 tags→genre，不含 country（归 -B）/不含 cast（后排登记）。**
   - **文件范围**：`apps/api/src/lib/genreMapper.ts`（+mapBangumiTags）/ `apps/api/src/services/BangumiService.ts`（字段构造补 genres）/ 单测。
   - **门禁**：typecheck + lint + test:changed。
   - **依赖**：**可与 META-40 并行**（不碰 country）。

3. **META-41-B** — Bangumi country 写入（🟡 中）（状态：✅ 已完成 2026-06-15 · 保守仅显式产地）
   - **完成备注**：✅ 2026-06-15。开工调查实证 bangumi 匹配作品 country 分布 **JP 85 / CN 70 / null 31 / US 5 / HK 1**（CN ~36% 国创）→ 卡片隐含「缺省 JP」会误标 ~70 部国创（META-40 同类错国 bug）→ **用户裁定保守**：新增 `parseInfoboxCountry`（仅 infobox 显式产地键：国家/地区·制作国家/地区·产地·国家·地区 + 繁体变体；无则 null），`mapSubjectToCatalogFields` 经 META-40 `countryToIso` 真源归一 ISO 后写 `fields.country`，**绝不盲目缺省 JP**（归一不到/无产地键不写，保列纯净）。门禁 typecheck/lint EXIT=0 + test:changed 14 文件 276 passed。+9 新单测（parseInfoboxCountry 6 + country 集成 3）。执行模型 claude-opus-4-8；子代理无。详见 changelog [META-41-B]。
   - 创建时间：2026-06-15 01:10
   - 建议模型：sonnet
   - **问题**：bangumi 自动增强不写 country；anime 来源国通常 JP 但需走统一 ISO 真源保一致（不可再裸写）。
   - **方案**：BangumiService 字段构造补 `country`（经 META-40 `packages/types` 归一真源写 ISO，anime 缺省 origin 评估）；单测。
   - **文件范围**：`apps/api/src/services/BangumiService.ts` + `BangumiService.utils.ts`（infobox 来源国解析，若 infobox 无则缺省策略）/ 单测。
   - **门禁**：typecheck + lint + test:changed。
   - **依赖**：**META-40**（country 归一真源）。

4. **META-42** — TMDB country 应用（🟡 中 / 能力闲置）（状态：✅ 已完成 2026-06-15）
   - **完成备注**：✅ 2026-06-15。`TMDB_APPLIABLE_FIELDS` 加 `country`；`buildCatalogFields` 加 country 分支——movie 取 `production_countries[0].iso_3166_1` / tv 取 `origin_country[0]`，经 META-40 `countryToIso`（`@/types`）防御性归一（TMDB 已 ISO，countryToIso 对 2 字母输入大写归一；归一不到/空数组不写 → updateFields 空则不调 safeUpdate，保列纯净，对齐 META-41-B 保守口径）；`tmdb.types.ts` `TmdbMovieDetail` 补 `production_countries` 类型（tv `origin_country` 已存在）。server-next：`TabTmdb` 镜像 `TMDB_APPLIABLE_FIELDS` 加 country（自动产 `tmdb-field-country` checkbox 默认全选）+ `VE.tmdb.fieldLabels.country='地区'`。门禁 typecheck/lint EXIT=0 + test:changed 12 文件 148 passed（+5：tmdb-confirm-service 3〔movie production_countries / tv origin_country / 空数组不写〕 + TabTmdb 2〔country checkbox 渲染 + 默认 confirm fields 含 country〕）+ **test:e2e:admin 84/84**（videos.spec:261 编辑 Drawer 黄金路径零回归）。执行模型 claude-opus-4-8；子代理无（既有白名单/buildCatalogFields/UI 镜像各加 1 项，非 admin-ui 公开 Props/新端点/跨消费方 schema）。详见 changelog [META-42]。
   - 创建时间：2026-06-15 00:30
   - 建议模型：sonnet
   - **问题**：TMDB `origin_country`（tv）/`production_countries`（movie）本是**干净 ISO alpha-2**（JP/US），与本地格式完美匹配，但 META-39 `TMDB_APPLIABLE_FIELDS` 未含 country → 白白不用（反而 douban 脏数据在污染）。
   - **方案**：`TmdbConfirmService.buildCatalogFields` + `TMDB_APPLIABLE_FIELDS` 补 `country`（tv 取 origin_country[0] / movie 取 production_countries[0]，经 META-40 归一真源防御性校验）；**TabTmdb fields 多选 + VE.tmdb 文案补一项（server-next UI）**；单测。
   - **文件范围**：`apps/api/src/services/TmdbConfirmService.ts` / `apps/api/src/lib/tmdb.types.ts`（movie production_countries 若未定义则补）/ **`apps/server-next` TabTmdb + VE.tmdb** / 单测。
   - **门禁**：typecheck + lint + test:changed + **test:e2e:admin**（TabTmdb fields 改动，videos.spec 编辑 Drawer 黄金路径零回归）。
   - **依赖**：**META-40**（复用 country 归一真源，统一入口）。

5. **META-43** — TMDB 图片接入（🟡 中 / 能力闲置）（状态：✅ 已完成 2026-06-15）
   - **完成备注**：✅ 2026-06-15。**关键设计裁定（调查实证）**：图片治理批量 sweep（`imageHealth.ts` listPendingImageUrls/listMissingBlurhashUrls）拾取条件=`url IS NOT NULL AND status='pending_review'`（全 4 kind）→ 写 URL + 重置 status='pending_review' 即被既有 sweep 自动接管 health-check + blurhash，**无需在 TmdbConfirmService 接 imageHealthQueue / 不改构造签名 / 不跨 worker 层**（CrawlerService 定向 enqueue 仅即时优化，sweep 是安全网同终点）。实现：① `lib/tmdb.ts` `getImageBaseUrl`（进程级缓存 configuration.images.secure_base_url，失败回退稳定默认 `https://image.tmdb.org/t/p/`，替代硬编码）；② `TmdbConfirmService` confirm append `['external_ids','images']` + 纯 helper `pickBestImage`（语言优先级 zh>null>en → vote_average → vote_count）+ 纯 helper `buildImageFields`（poster=cover_url 优先 images.posters 最佳回退 poster_path，写 coverUrl+posterStatus='pending_review'+posterSource='tmdb'+尺寸；backdrop/logo 写 url+status，无 source 列）+ `TMDB_APPLIABLE_FIELDS` 加 backdrop/logo + buildCatalogFields 委托 + 仅选中图片字段才拉 imageBase；③ server-next TabTmdb 镜像加 backdrop/logo + VE.tmdb.fieldLabels（背景图/台标）。**边界**：poster 写 source='tmdb'（字段就绪）；backdrop/logo/banner 无 source 列不承诺溯源（产品要求→升 schema 任务独立 migration）；blurhash/primaryColor 不从 TMDB 写（交 sweep）；search 候选预览保留硬编码 base（不同关注点）。门禁 typecheck/lint EXIT=0 + test:changed 16 文件 198 passed（+8：tmdb-confirm 8〔cover_url zh 选/回退 poster_path/backdrop+logo/无图不拉 config + pickBestImage 语言优先压 vote〕 + TabTmdb 3 字段断言）+ **test:e2e:admin 84/84**（videos.spec:261 编辑 Drawer 黄金路径零回归）。执行模型 claude-opus-4-8；子代理无（service+lib 内部逻辑 + UI 镜像，非 admin-ui Props/新端点/跨消费方 schema）。详见 changelog [META-43]。
   - 创建时间：2026-06-15 00:30
   - 建议模型：sonnet
   - **问题**：本地图片体系（migration 048）有 poster(cover_url)/backdrop(backdrop_url)/**logo(logo_url)**/banner_backdrop 四类 + status/blurhash/尺寸；**仅 poster 有 `poster_source` 列**（CHECK 含 tmdb），backdrop/logo/banner **无 source 列**（实证 048:17/24/30/37）。TMDB `images` append 提供 backdrops[]/posters[]/logos[] **多语言（iso_639_1）+ 质量 vote + 尺寸**。但 META-39 仅应用 `cover_url ← detail.poster_path`（默认语言、w500、硬编码 base），**完全没用** backdrop / **logo**（`decisions.md:763` 早规划 TMDB logos→logo_url 未兑现）/ 语言偏好（zh 海报）/ 质量 vote / 尺寸 / `poster_source`。
   - **方案（验收口径修正，评审 #5）**：① confirm append `images`；② 图片选择 helper（按 zh-CN 语言偏好 + vote_average 排序选最佳，per kind）；③ 应用 cover_url/backdrop_url/logo_url + 尺寸/status；④ **poster 写 `posterSource='tmdb'`（字段就绪）；backdrop/logo/banner 仅写 url/status/尺寸/blurhash（无 source 列，不承诺 `*_source`）**；⑤ 复用 configuration base（getConfiguration）替代硬编码；⑥ TabTmdb fields 多选补图片项 + 单测。
   - **边界裁定**：若产品要求 backdrop/logo 也记 source 溯源 → **升级为 schema 任务**（独立 migration 加 `backdrop_source`/`logo_source` 列 + `architecture.md` 同步），不在本卡；本卡按现有 schema 能力交付。
   - **文件范围**：`apps/api/src/services/TmdbConfirmService.ts`（append images + 选择 + 多 kind 写入）/ `apps/api/src/lib/tmdb.ts`（configuration base 缓存）/ **`apps/server-next` TabTmdb + VE.tmdb** / 单测。
   - **门禁**：typecheck + lint + test:changed + **test:e2e:admin**（TabTmdb fields 改动黄金路径零回归）。
   - **依赖**：无（独立于 country/genre）。

6. **META-44-A** — VideoType 富集修正 ADR（🟡 中 / 身份性字段，强制 ADR）（状态：✅ 已完成 2026-06-15）
   - **完成备注**：✅ 2026-06-15。**ADR-203「VideoType provider 富集修正」Accepted**（docs/decisions.md）。spawn arch-reviewer (claude-opus-4-8, agentId a4f44fcfad64fa9fb) **CONDITIONAL PASS → 2 红线吸收落库**：① 红线①（主循环背景未识别的二阶耦合）——`isRedirectSafe` 的 `current.type !== existing.type` 是 type 第二身份触点，type 写回必须并入富集 safeUpdate **单事务**不得做异步 job；② D-203-7.7 enrich anime 门控不即时回灌时序偏离登记。决策正文 D-203-1（信号→type 高置信映射，仅形式判别 tv+16→anime/99→documentary/tv+10762→kids/tv+10763→news + douban 动画/纪录片/短片/儿童；明确不映射 family/reality/music 等低置信）/ D-203-2（**fill-if-default 绝不覆盖具体 type**，仅 other→具体）/ D-203-3（other-only 使归并分裂风险与 fill-if-default 闸门坍缩为同一条件自动消解 + 红线①）/ D-203-4（经 safeUpdate 白嫖三层锁 + provenance，闸门留 caller 不污染通用引擎，不改 CATALOG_SOURCE_PRIORITY/fieldMap）/ D-203-5（provenance 自动记 + 冲突未改记观测日志）/ D-203-6（META-44-B 蓝图）/ D-203-7（边界）。**关键核验**：F6 type 写回通道已就绪（CatalogUpdateData.type? + fieldMap type:'type'）→ **零 migration**；F3 风险窗口=四外部 ID 全 NULL 的 catalog。门禁 verify:adr-contracts EXIT=0（endpoint-adr 243 路由对齐，docs-only 无新端点）。docs-only。执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, a4f44fcfad64fa9fb)。详见 changelog [META-44-A]。**解锁 META-44-B（实施，依 ADR PASS）。**
   - 创建时间：2026-06-15 01:10
   - 建议模型：opus（**强制 arch-reviewer**，评审 #6）
   - **问题**：`catalog.type`（VideoType 11 种）仅爬虫入库时设定，**任何 provider 增强都不修正**（三 Service 只读 type 做匹配，从不写回）。provider 携带类型判别信号被丢弃：TMDB genre 16(动画)/99(纪录)/10762(儿童)/10763(新闻)/10764(真人秀→综艺)、douban 动画/纪录片/短片/儿童。但 `type` 是**身份性字段**，影响 catalog 归并键、搜索筛选、身份候选 → **误改风险高**。
   - **方案**：起 ADR 定档——保守 type 修正规则（仅高置信信号纠正触发条件、避免误改人工校正/影响归并键的边界）；arch-reviewer (Opus) 评审。**ADR PASS 前不得动任何 type 写路径。**
   - **文件范围**：`docs/decisions.md`（ADR）/ `docs/task-queue.md`（-B 卡细化）。
   - **门禁**：verify:adr-contracts + arch-reviewer PASS。
   - **依赖**：建议 META-40~43 之后（标量治理稳定后再动身份性字段）。

7. **META-44-B** — VideoType 修正实施（🟡 中）（状态：✅ 已完成 2026-06-15）
   - **完成备注**：✅ 2026-06-15。按 ADR-203 D-203-6 蓝图实施。新建纯函数 `apps/api/src/lib/typeFromProvider.ts`（`tmdbTypeSignal` tv+16→anime/99→documentary/tv+10762→kids/tv+10763→news/media_type 兜底，movie+16 不推 anime + family/reality 不映射 / `doubanTypeSignal` 动画·纪录片·短片·儿童顺序优先 / `resolveTypeSignal` fill-if-default 闸门返 `{typeToWrite, conflict}`）。接线：`TmdbConfirmService.confirm`（读 catalog 现值 → tmdbTypeSignal → 闸门 → 并入 updateFields **同 safeUpdate 单事务红线①**，type 不入 TMDB_APPLIABLE_FIELDS，随 'genres' opt-in）+ `DoubanService` 私有 `applyDoubanTypeSignal`（三处复用）接 syncVideo〔enrich，全量无条件〕/confirmSubject〔全量，补读 catalog 现值〕/confirmFields〔per-field，仅 fields 含 'genres' 随动〕，冲突未改记 D-203-5 观测日志。**实施细化**：confirmFields/TMDB confirm 的 type 修正 gate 于 `fields.includes('genres')`（尊重逐字段 opt-in，ADR「三处统一」未顾及该语义的保守细化）；未触 MetadataEnrichService（D-203-7.7 守）。**红线全守**：单事务、仅 other→具体不覆盖、零 migration（F6 通道就绪）、不改归并 SQL/优先级、不改 enrich anime 门控。门禁 typecheck/lint EXIT=0 + test:changed 15 文件 226 passed（+27：typeFromProvider 14 + tmdb-confirm type 3 + douban-manual type 4 + safeUpdate type 硬锁守护 1 + douban syncVideo/manual 回归零破坏）。执行模型 claude-opus-4-8；子代理无（实施 ADR-203 既定决策，纯函数 + caller 接线）。详见 changelog [META-44-B]。**META-44 全收口（-A ADR + -B 实施）。**
   - 创建时间：2026-06-15 01:10
   - 建议模型：opus
   - **范围（按 ADR-203 D-203-6 蓝图）**：① 新建纯函数 helper `apps/api/src/lib/typeFromProvider.ts`——`tmdbTypeSignal(mediaType, genreIds): VideoType|null`（D-203-1 TMDB 表：tv+16→anime / 99→documentary / tv+10762→kids / tv+10763→news / movie→movie / tv→series）+ `doubanTypeSignal(genres: string[]): VideoType|null`（动画/纪录片/短片/儿童）+ `resolveTypeFillIfDefault(currentType, candidate): VideoType|null`（D-203-2 闸门，`TYPE_LOW_CONFIDENCE_DEFAULTS=new Set(['other'])`，仅 other→具体、不覆盖、幂等）；② `TmdbConfirmService.confirm`——type 推断在 confirm 内 buildCatalogFields 之外（**type 不入 TMDB_APPLIABLE_FIELDS**），读 catalog 现值 → resolveTypeFillIfDefault → 非 null 并入 updateFields **同 safeUpdate 事务**（红线①）；③ `DoubanService` 三处 safeUpdate caller（enrich/confirmSubject/confirmFields）——读 **catalog 现值**（非 video.type）→ doubanTypeSignal → 闸门 → 并入；冲突未改记 D-203-5 观测日志（`module:'catalog-type-signal'`，`type_conflict_skipped`，幂等不记）。
   - **红线（ADR-203，必守）**：🔴 红线① type 写回必须**并入富集 safeUpdate 单事务**，不得脱离主事务做异步 job（否则 isRedirectSafe type 守卫读不一致快照）；不覆盖具体 type（仅 other→具体）；不改 Step-5 SQL / CATALOG_SOURCE_PRIORITY / fieldMap（F6 通道已就绪，零 migration）；不改 enrich anime 门控（D-203-7.7 不即时回灌）。
   - **文件范围**：`apps/api/src/lib/typeFromProvider.ts`（新建 helper）/ `apps/api/src/services/TmdbConfirmService.ts`（confirm type 推断）/ `apps/api/src/services/DoubanService.ts`（三处 caller）/ 单测（`tests/unit/api/typeFromProvider.test.ts` + 扩展 safeUpdate 集成测〔硬锁/软锁/manual 优先级拦截/provenance 记 type〕 + Douban·Tmdb service 测〔other→具体写入 / 具体值不覆盖 + 冲突日志〕）。
   - **门禁**：typecheck + lint + test:changed（type 经 safeUpdate 不改归并 SQL → 单测足够，无需 e2e；集成测覆盖锁/优先级/provenance）。
   - **依赖**：**META-44-A ✅**（ADR-203 Accepted）。

8. **META-45-A** — Genre 颗粒度 ADR-204（🟢 低 / 设计权衡，强制 ADR）（状态：✅ 已完成 2026-06-15）
   - **完成备注**：✅ 2026-06-15。**ADR-204 Accepted**（docs/decisions.md）。spawn arch-reviewer (claude-opus-4-8, agentId a5d9c4c0d1e25ffdc) CONDITIONAL PASS。D-204-1 **Part A 采纳**（TMDB 组合类目拆双：10759→[action,adventure]/10765→[sci_fi,fantasy]/10768→war，映射已有枚举零枚举改，TMDB_GENRE_MAP 单值→`VideoGenre|VideoGenre[]|null` + mapTmdbGenres 展开分支）/ D-204-2 **Part B drama 不加**（**用户拍板**，arch-reviewer 同向：drama 信息熵接近零稀释筛选维度 / 损失被兜底吸收 / 爆炸半径 9 处 vs 收益不对称 / 不加可逆 + follow-up 触发条件 + 加 drama 完整蓝图备查）/ D-204-3 其余坍缩合理 / D-204-4 META-45-B 蓝图（仅 Part A，7 单测覆盖点）/ D-204-5 边界 + O-204-1/2/3 观察登记。**arch-reviewer 补出 3 处遗漏消费方**（verify-enum-ssot.mjs:32 守卫 / web-next 两份 GENRE_LABELS 仅 15 值 / route-codenames 非 genre 消费方 prompt 误列）。零 migration（genres text[] 无 CHECK）。门禁 verify:adr-contracts EXIT=0（243 路由对齐，docs-only 无新端点）。docs-only。执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, a5d9c4c0d1e25ffdc)。详见 changelog [META-45-A]。**解锁 META-45-B（仅 Part A 实施）。**
   - 创建时间：2026-06-15 00:30（拆 -A/-B 2026-06-15）
   - 建议模型：opus（**强制 arch-reviewer**）

9. **META-45-B** — Genre 颗粒度实施（🟢 低）（状态：✅ 已完成 2026-06-15）
   - **完成备注**：✅ 2026-06-15。按 ADR-204 D-204-1 实施 Part A（仅，用户拍板不加 drama）。`genreMapper.ts` TMDB_GENRE_MAP 值类型 `VideoGenre | VideoGenre[] | null`（非 readonly 规避 Array.isArray 窄化坑）+ `10759→['action','adventure']` / `10765→['sci_fi','fantasy']`（10768→'war' 保单值）+ mapTmdbGenres 循环加数组展开分支（Set 去重）。门禁 typecheck/lint EXIT=0 + test:changed 43 文件 663 passed（genreMapper 核心 lib 按 ADR-180 升全量；更新既有 `[10759,10765,16]` 断言为拆双 + 全 genre 消费方零回归）。+6 新断言（拆双 ×2 + 10768 单值 + 去重 ×2 + 单值/null 回归）。零枚举改 / 零 migration。执行模型 claude-opus-4-8；子代理无。详见 changelog [META-45-B]。**META-45 全收口（-A ADR + -B Part A）。SEQ-20260615-01 全 9 卡完成。**
   - 创建时间：2026-06-15（拆卡）
   - 建议模型：sonnet（仅 Part A，零枚举改、单文件 + 单测，无强制 Opus 触发——用户已拍板不加 drama，无跨消费方扩枚举）
   - **范围（仅 Part A，D-204-4）**：`genreMapper.ts`——`TMDB_GENRE_MAP` 值类型改 `VideoGenre | VideoGenre[] | null`（非 readonly 规避 Array.isArray 窄化）+ 10759→[action,adventure] / 10765→[sci_fi,fantasy]（10768→war 保单值）+ `mapTmdbGenres` 循环加数组展开分支；单测 7 覆盖点（拆双 ×2 + 10768 单值 + 28+10759 去重 + 10759+12 去重 + 单值回归 35 + null 回归 [18,16,99]）。**不加 drama**（用户拍板，D-204-2）。
   - **文件范围**：`apps/api/src/lib/genreMapper.ts` / 单测（扩 genreMapper.test 或 tmdb-confirm-service.test mapTmdbGenres 块）。
   - **门禁**：typecheck + lint + test:changed（零枚举改 → 仅 api，无跨消费方）。
   - **依赖**：**META-45-A ✅**（ADR-204 PASS）。

---

## [SEQ-20260615-02] 多源交叉验证编排 + TMDB 自动链路 + douban 降级

- **状态**：✅ **全序列完成（2026-06-15）**——META-46-A ✅ ADR-205 / 47 ✅ TMDB auto 方法 / 48 ✅ enrich 接 TMDB Step / 49-A ✅ proposals 表 / 49-B1 ✅ 标量接口剥离 / 49-B2 ✅ reconcile 裁决核心 / 49-C ✅ 冲突注入 derive / 49-D1 ✅ douban cutover / 49-D2 ✅ 审核台冲突 UI。**经两轮用户审核修订 + arch-reviewer CONDITIONAL-PASS + 3 次 Codex stop-time review FIX（preserveMetadataSource / bangumi-sync defer / stale proposal 清除）**。三源（douban/bangumi/tmdb）gather→reconcile→write 加权裁决 + 字段级 proposal 载体 + TMDB 自动链路 + douban 投票降级 + 跨源冲突 needs_review 端到端打通。
- **创建时间**：2026-06-15 11:00
- **最后更新时间**：2026-06-15 16:40（META-49-D2 ✅ 审核台冲突 UI 收官——field_conflict 中文 label + issueText 字段名拼接；**SEQ-20260615-02 全序列完成**）
- **目标**：补齐三源最大不对称——TMDB 接入自动富集链路（当前零自动）；引入多源逐字段交叉验证（一致性加权 + 冲突挂人工复核）；豆瓣由「单独 auto 写权威字段」退为「补空 + 投票源」。
- **范围**：`apps/api`（`MetadataEnrichService` 编排 / `TmdbConfirmService` **新建 auto 专用方法**〔非参数化 confirm〕 / `enrichmentWorker` 新 Step / `MediaCatalogService.CATALOG_SOURCE_PRIORITY` **仅 META-49 cutover 修改**〔46-B 不碰，见复核补订〕 / **新增字段级 proposal·conflict 载体**〔provenance 现表不支撑，见审核修订 P1〕）+ migration（字段级冲突载体，由 ADR 定形）+ `apps/server-next`（审核台冲突复核呈现，归末卡）。**不动**播放器/前台/搜索。
- **依赖**：SEQ-20260615-01 ✅（标量/枚举治理稳定后再动编排与优先级）。
- **用户决策（2026-06-15，AskUserQuestion 三问全采纳推荐）**：
  - D-用户-1：TMDB 触发范围 = **全类型并行**（movie/tv/anime 均自动跑 TMDB，与 douban/bangumi 并行产出，交叉验证 + 优先级裁决落地；anime 与 Bangumi 互补补 imdb/图片）。
  - D-用户-2：冲突处理 = **一致性加权 + 冲突挂复核**（多源一致 → 高置信自动写；冲突字段 → needs_review 挂起人工）。⚠️ 载体修订见审核 P1：`video_metadata_provenance` PK=(catalog_id,field_name) 仅记**最后写入来源**，无候选/败选/冲突态 → **不能复用做逐字段比对**；`needs_review`/`review_conflict` 枚举虽已存在于 derive.ts 但无字段级输入。**字段级 proposal/conflict 持久化方案由 META-46-A ADR 必裁。**
  - D-用户-3：douban 降级 = **退为补空 + 投票源**（不再单独 auto 写权威内容字段；仅 fill-if-empty + 作交叉验证投票源之一；数值上明确低于 tmdb/bangumi）。⚠️ 时序修订见审核 P1：投票语义依赖 reconcile 层存在；reconcile 上线前下调行级优先级 = 纯削现有覆盖。**实际写行为切换 gated by META-49。**

### 审核修订（2026-06-15，用户红线前提）

- **P1-A（必修，载体）**：ADR 必须新增或明确选择**字段级 proposal/conflict 载体**（候选值 + 败选值 + 多源 proposal + conflict 状态）；不得只写「复用 provenance」。现表 `043_video_metadata_provenance.sql` PK=(catalog_id,field_name) 单行记最后写入，`metadata-status.derive.ts` 仅从 refs/cache/status 派生 provider 状态，**均无字段级冲突输入**。
- **P1-B（必修，时序）**：douban 降级**不可独立先落**。当前 douban Step1/2 经 `safeUpdate`（行级 `metadata_source` 优先级，非字段级投票）直写 rating/description/cover/genres/country。先降级而 TMDB auto + reconcile 未上线 → 直接削弱现有自动富集覆盖。→ `META-46-B` 改为**仅 ADR 常量/观测准备，运行时写行为零变化**；真正的 fill-only/投票切换并入 `META-49`（reconcile 上线时一并 cutover）。
- **P2（必修，语义）**：TMDB auto **不可直接复用 manual confirm**。`confirm` 现为 `source:'manual'`/`linkedBy:'moderator'`/`manual_confirmed` 且**无条件写 tmdb_id cache**（TmdbConfirmService.ts:259）。→ `META-47` 明确**新建 auto 专用方法**（candidate/auto_matched 区分 + 置信度 + 冲突降级 + 字段 apply 策略）；**cache 写入受 reconcile/refs 成功结果约束**，不得无条件写。
- **保留正确项**：ADR 前置 gate / 强制 Opus arch-reviewer / ADR PASS 前不动写路径——三条不变。

### 任务列表（按执行顺序；ADR 卡为前置 gate，实施卡蓝图由 ADR 定稿）

1. **META-46-A** — ADR 起草：多源交叉验证编排 + TMDB 自动链路接入 + douban 降级语义（🔴 高 / **强制 arch-reviewer Opus**）（状态：✅ 已完成 2026-06-15 12:20）
   - 创建时间：2026-06-15 11:00 ｜ 实际开始：2026-06-15 11:55 ｜ 完成时间：2026-06-15 12:20 ｜ 建议模型：opus（强制 arch-reviewer gate）
   - **完成备注**：✅ **ADR-205 Accepted**（docs/decisions.md）。arch-reviewer (claude-opus-4-8, agentId aa7acbacca478ea7c) CONDITIONAL-PASS，6 必修条件 M1–M6 全数吸收为 D-205-1~10。D-205-1 gather→reconcile→write / D-205-2 新表 `metadata_field_proposals`（Migration **119**，is_winner+applied 双列 + PK 同源同字段单 proposal 不变量）/ D-205-3 trust 派生 CATALOG_SOURCE_PRIORITY + canonical 集合相等比较（防假 needs_review）/ D-205-4 M1 方案 A（winner 自身 source + 预读 metadataSource 降 proposal-only）/ D-205-5 M2（redirect 后 effectiveCatalogId + source 分组共享事务 + type 走 ADR-203 专属路径 + rescore 迁移）/ D-205-6 M3（冲突注入 derive + JOIN_SQL 镜像）/ D-205-7 TMDB auto + M4（tmdb/imdb 纳 fill-if-empty/EXTERNAL_KIND_BY_PROVIDER）/ D-205-8 douban 数值不变·reconcile 层降级 / D-205-9 拆卡（46-B 取消 / 49 拆 -A~D）/ D-205-10 边界 + 不破坏 ADR-186/177/202/203/174。门禁 verify:adr-contracts EXIT=0（endpoint-adr 243 对齐无新端点；D-205-* 待实施卡 changelog 闭环 / 仅既有 advisory）。docs-only。执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, aa7acbacca478ea7c)。详见 changelog [META-46-A]。**解锁 META-47（TMDB auto 方法）→ 48 → 49-A~D。**
   - **决策待定档**：① 编排模型——sequential-write（现状，各源独立 safeUpdate）改为 **gather-all-proposals → 逐字段 reconcile → write**，还是保 sequential + 事后冲突检测？（核心架构分叉；D-用户-2 一致性加权实质要求 gather-reconcile，盲写无法比较）② **字段级 proposal/conflict 持久化载体（必裁，审核 P1-A）**——新建表 vs 扩 `video_metadata_provenance`（现 PK 单行仅记最后写入，需加候选/败选/冲突列）vs catalog JSON 列；须承载候选值·败选值·多源 proposal·conflict 态，喂入既有 `needs_review`/`review_conflict` 枚举（derive.ts 已有词汇无输入）③ 一致性加权规则（几源一致才高置信？douban 投票权重）④ TMDB auto 接入点（enrich worker 新 Step vs 独立 worker）+ 凭证/限流守卫 ⑤ douban 新优先级数值 + 「投票源不写权威」与 fill-if-empty（ADR-186）衔接 + **降级 cutover 时序（审核 P1-B：必在 reconcile 上线后）**。
   - **必复用/不破坏**：ADR-186（fill-if-empty 不变量）/ ADR-177（`catalog_external_refs` 真源）/ ADR-202（TMDB confirm 流程）/ ADR-201（metadata 状态治理 DTO，`needs_review`/`review_conflict` 已定义）/ ADR-203（type 修正单事务红线）。
   - **文件范围**：`docs/decisions.md`（新 ADR）/ `docs/task-queue.md`（实施卡 -B/47/48/49 细化）。
   - **门禁**：verify:adr-contracts + arch-reviewer PASS。**ADR PASS 前不得动任何写路径 / 优先级 / worker。**
   - **依赖**：无（本序列首卡）。
   - **arch-reviewer 评审结论（claude-opus-4-8, agentId aa7acbacca478ea7c，2026-06-15 CONDITIONAL-PASS）**：strawman 五项核心方向（①gather-reconcile ②新表 ③一致性加权 ④TMDB auto 经 proposal ⑤douban cutover 延后）架构正确、不破坏任何已采纳 ADR 硬不变量。**6 项必修条件，ADR 落库前全闭合**：
     - **M1（一票否决）**：reconcile winner 与 `safeUpdate` 行级优先级闸门**双重裁决**冲突——采**方案 A**：winner 以**自身 source** 调 safeUpdate + 预读 `catalog.metadataSource`，低于现 source 的 winner 降级 proposal-only（不写 cache，落表+标 candidate），不伪造 provenance source（守 ADR-186 D-186-3）。
     - **M2（最高实施风险）**：reconcile 必须在 **step3 bangumi redirect 之后**、全程用 `effectiveCatalogId`（ADR-174 真去重）；多源 winner 写入按 **source 分组多次 safeUpdate 共享外层 PoolClient 单事务**（保原子 + provenance 不失真，复用 `provenanceCtx.db`）。
     - **M3**：冲突注入 `MetadataStatusSourceRow` 新增 fieldConflicts 输入 + `deriveOverall` 冲突→problem/danger 分支 + **`METADATA_STATUS_JOIN_SQL` 镜像同步**（strawman 遗漏的关键消费方，否则视频库元数据列服务端排序漂移）+ 双向守护单测扩冲突用例。
     - **M4**：tmdb/imdb 接入 auto 写入 → 同步 `EXTERNAL_KIND_BY_PROVIDER` 补 tmdb + fill-if-empty 白名单纳 tmdbId/imdbId（ADR-186 自留 follow-up 锚点，跨 ADR-177/186）。
     - **M5**：`docs/architecture.md` 同步新表（绝对禁止项，参 :437/:468/:1114 范式）+ migration 编号 **119**（最新 118，arch-reviewer 044+ 系基于 043 误判，O-205-1）+ 遗漏消费方（JOIN_SQL / `enqueueIdentityVideoRescore` 触发时机随 reconcile 迁移 / **type 字段走 ADR-203 caller 层 fill-if-default 专属路径不进 trust 加权**）+ **澄清 douban「下调」语义**（数值已 3<4 满足 D-用户-3，主循环裁定：不改 `CATALOG_SOURCE_PRIORITY` 数值，降级=reconcile 层「不单独写非空权威字段」语义 → META-46-B shadow 常量大概率无内容，并入 49）。
     - **M6**：proposals 表「同源同字段单 proposal」写为显式不变量（douban step1/2 互斥当前安全）+ `proposed_value` JSONB **canonical 比较规则定死**（数组归一排序集合相等 / 字符串 trim+大小写归一 / 数值容差——决定冲突率，防 genres 顺序差异制造假 needs_review）+ `is_winner`（逻辑 winner）增 `applied`（实际落 catalog）列区分 M1 skip 场景。
   - **拆卡修订（arch-reviewer）**：META-49 跨 schema+service+query+UI 四层超 3 层红线 → **强制拆 -A/-B/-C/-D**（见下）；META-46-B 必要性随 M5 douban 语义重估。

2. **META-46-B** — douban 降级**准备**（reconcile 专用 shadow 候选权重常量 + 投票源标记 + 观测日志；**运行时写行为零变化**）（🟢 低）（状态：⬜ 规划中，依 ADR）
   - **审核 P1-B 修订**：不再「先落降级」。本卡仅新增 **reconcile 专用候选权重/shadow 常量**（独立新常量）+ 投票源标记 + 观测埋点。
   - **🔴 复核补订**：**严禁修改现有 `MediaCatalogService.CATALOG_SOURCE_PRIORITY`**——该常量由 `safeUpdate` 行级消费（MediaCatalogService.ts:345），改它即改运行时写行为，与「准备态」矛盾。`CATALOG_SOURCE_PRIORITY` 的任何下调归 **META-49 cutover**（reconcile 上线一并切）。本卡 shadow 常量仅供未来 reconcile 读取，不接入 safeUpdate。
   - **⚠️ arch-reviewer 重估（M5）**：douban 数值 3 已 < tmdb/bangumi 4，D-用户-3「数值低于」现状已满足；主循环裁定降级=reconcile 层语义（不单独写非空权威字段）而非改活表数值 → **本卡 shadow 常量大概率无实际内容，待 ADR 定稿后大概率并入 META-49-D 取消本卡**。最终去留由 META-46-A ADR 裁定。

3. **META-47** — TMDB 自动候选打分 + **auto 专用方法**（lib + service，不接 worker）（🟡 中）（状态：✅ 已完成 2026-06-15，主循环 opus）
   - 新 `pickBestTmdbCandidate`（仿 douban `pickBestCandidate` title/year 相似度）+ `TmdbConfirmService` **新建 auto 专用方法**（**非参数化 confirm**，审核 P2）：candidate/auto_matched 区分 + 置信度来自打分 + 冲突降级 + 字段 apply 策略；`linkedBy:'auto'`（区别于现硬编码 moderator/manual_confirmed/confidence:1）。**tmdb_id cache 写入受 reconcile/refs 成功结果约束，不得无条件写**（区别于 confirm:259）。
   - **完成备注**：① **lib 下沉** `apps/api/src/lib/textMatch.ts`（`similarity`/`normalizeForMatch`/`parseYear` 从 `DoubanService.utils` 迁出，后者 import+re-export 零行为变化，避免 tmdb→douban 坏依赖）。② **打分** `tmdbCandidateScore`+`pickBestTmdbCandidate`（title/originalTitle max 相似度 + year ±0/±1 加权 + 0.45 兜底，复用 textMatch）+ 阈值 `CONFIDENCE_AUTO_MATCH=0.85`/`CANDIDATE=0.6`。③ **`autoMatch(videoId,catalogId,{title,year,mediaType,seasonNumber?})`**：search→pickBest→分档单事务——`<0.6` 不写 / `[0.6,0.85)` candidate 仅绑（不拉 detail/不应用字段）/ `≥0.85` auto_matched（movie·season exact ref · show candidate ref，`source/linkedBy:'auto'`，exact 冲突 ROLLBACK 不写 cache = **受 refs 成功约束** 区别 confirm:259）+ `buildCatalogFields` 复用 + `tmdbId`/`imdbId` 经 `safeUpdate(...,'tmdb')` fill-if-empty + type 走 ADR-203 `resolveTypeSignal`；video ref `matchStatus:tier`/`confidence:score`/`linkedBy:'auto'`；凭证缺失·限流·网络 graceful skip（返 matched:false 不抛）。④ **M4 白名单解耦** `MediaCatalogService.EXTERNAL_REF_FIELD_KEYS` = 2 字段 + tmdbId/imdbId superset（cache→ref 自动写仍仅 douban/bangumi）。**⚠️ 偏离登记（M4「补 tmdb 映射」）**：不给 `EXTERNAL_KIND_BY_PROVIDER` 加 tmdb 固定 kind——该常量仅 MediaCatalogService:427 cache→ref 路径消费而 tmdb 不在其中，且 kind 数据形态判定 movie/season/show（confirm:213 + catalogExternalRefs:23-28「不提供默认值防误用」），加固定 kind 会误判 TV；M4 实质=白名单解耦（已做），tmdb ref 由 autoMatch 显式写正确 kind。**测试偏离**：autoMatch+打分单测并入既有 `tmdb-confirm-service.test.ts`（复用 40 行 mock 基建 DRY，非另建 tmdb-auto-match.test.ts）。门禁全绿：typecheck 7ws / lint 4ok / test:changed 59 文件 880 passed（douban·bangumi·enrich 22 文件 287 零回归 + 新单测 textMatch 11 + tmdb-confirm 41〔含 autoMatch 8 + pickBest 6〕 + safeUpdate ⑨⑩⑪⑫ tmdb/imdb fill-if-empty 4）/ verify:adr-contracts REAL_EXIT=0（无新端点）；e2e N/A（纯 service/lib，同 META-38）。执行模型 claude-opus-4-8；子代理无（无 admin-ui 共享 Props / 无 schema·migration / 实施 Opus-reviewed ADR-205 蓝图，M4 偏离有 file:line 证据，无强制升 Opus 触发）。详见 changelog [META-47]。**解锁 META-48（worker 接入 TMDB Step）。**

4. **META-48** — enrich worker 接入 TMDB Step（全类型并行）+ 凭证/限流/去重守卫（🟡 中）（状态：✅ 已完成 2026-06-15，主循环 opus）
   - `MetadataEnrichService` 新增 TMDB Step（全类型，D-用户-1）+ `enrichmentWorker` 触发埋点；TMDB 实时 API 凭证缺失/限流降级守卫。
   - **用户拍板（AskUserQuestion 2026-06-15）**：interim（reconcile 前）anime 同/高优先级源已写 → TMDB **仅补空内容、不覆盖、仍绑 ref/cache**（Option A）。autoMatch 加 `filterCrossValidation`（`currentPriority>=tmdb(4)` 时内容组 fill-if-empty）；防 ADR-161 bangumi 优先被 sequential-write 同级后写覆盖削弱。完整加权待 META-49 reconcile。
   - **完成备注**：① **autoMatch 交叉验证守卫**（`TmdbConfirmService`）：`CROSS_VALIDATION_GROUPS`（10 内容字段组，图片含 status/尺寸）+ `filterCrossValidation(updateFields,current)`——`CATALOG_SOURCE_PRIORITY[current.metadataSource] >= tmdb(4)` 时 current 主字段非空 → 整组剔除（不盖等/高优先级源内容）；tmdbId/imdbId/type 恒保留（ref/cache + type fill-if-default 自守）；current 低于 tmdb → 不过滤权威写。auto_matched 档 type 信号后应用（复用既有 findCatalogById 读）。② **enrich() Step 3.5**：构造注入 `TmdbConfirmService`；私有 `stepTmdb(videoId, effectiveCatalogId, title, year, type)` 挂 step3 后（用 redirect 后 effectiveCatalogId 防 orphan）——去重守卫 `listVideoExternalRefs(_,_,'tmdb')` 有 primary auto_matched/manual_confirmed → skip（对齐 bangumi D-170-4-AMD）；`type==='movie'?'movie':'tv'`（全类型）；调 autoMatch；logger 埋点 outcome；try/catch 包裹 TMDB 失败不阻断 enrich（douban/bangumi 已写、step4/5 仍跑）。③ 凭证/限流由 autoMatch graceful skip（no_credentials/tmdb_unavailable 不抛）+ stepTmdb 防御 try/catch。**Codex stop-time review FIX**：交叉验证 fill 在等优先级（bangumi==tmdb==4）仍翻 metadata_source 为 tmdb（违反 Option A「不覆盖」+ ADR-186 D-186-3）→ `safeUpdate` 加 opt-in `preserveMetadataSource`（默认 off 零回归）+ `filterCrossValidation` 返 boolean 驱动；新增 safeUpdate ⑬⑭ + autoMatch preserve 断言。**边界**：enrichmentWorker 文件不改（埋点在 service，worker 已记 job 生命周期）；不建 proposals/migration（49）；不改 confirm/CATALOG_SOURCE_PRIORITY；safeUpdate 仅加 additive preserveMetadataSource opt-in。门禁全绿（含 FIX 复跑）：typecheck 7ws / lint 4ok / test:changed 58 文件 878 passed（safeUpdate 全消费方零回归 + autoMatch 交叉验证 2 + stepTmdb 5 + safeUpdate ⑬⑭ 2）/ verify:adr-contracts VERIFY=0；e2e N/A（纯 service）。执行模型 claude-opus-4-8；子代理无（interim 语义用户 AskUserQuestion 拍板）。详见 changelog [META-48]。**解锁 META-49-A（Migration 119 proposals 表 + architecture.md 同步）。**

5. **META-49** — reconcile 编排 + 冲突 needs_review + douban cutover + 审核台（🔴 高 / 编排核心，**arch-reviewer 强制拆四子卡**——跨 schema+service+query+UI 四层超 3 层红线）（状态：⬜ 规划中，依 ADR + 47/48）
   - **META-49-A**（✅ 已完成 2026-06-15，主循环 opus）：migration（`metadata_field_proposals` 建表，编号 **119**）+ proposals 写侧 queries + **`docs/architecture.md` 同步**（M5，:468 表清单 + :1114 migration 清单）。纯数据层可独立验证。
     - **完成备注**：Migration 119 建 `metadata_field_proposals`（10 列严格按 D-205-2：PK(catalog_id,field_name,source_kind) M6 不变量 + is_winner/applied 双列 D-205-4 + conflict partial index `WHERE conflict_state IS NOT NULL` 供 49-C 批量读 + FK CASCADE）+ 写侧 queries `metadata-field-proposals.ts`（`batchUpsertFieldProposals` ON CONFLICT upsert + `$N::jsonb`/JSON.stringify 防数组误转 + `getFieldProposalsByCatalogId` 独立验证；对齐 metadataProvenance.ts 范式）+ architecture.md §5.7 表登记（正交 provenance last-writer）+ migration 清单 119。门禁全绿：typecheck 7ws / lint 4ok / test:changed 7 passed / verify:adr-contracts EXIT=0（endpoint-adr 243 对齐无新端点 + verify-sql-schema-alignment queries 列对齐 schema）；**真库 migrate 执行成功 + 收敛 0 pending + 表结构对拍吻合 D-205-2**；e2e N/A（纯数据层）。执行模型 claude-opus-4-8；子代理无（schema 已 ADR-205 arch-reviewer PASS 定形，纯落地，对齐 META-47 先例）。详见 changelog [META-49-A]。**解锁 META-49-B（reconcile 编排相位）。**
   - **META-49-B**（🔄 进行中 2026-06-15，主循环 opus；**arch-reviewer gate ✅ → 强制拆 -B1/-B2**）：reconcile 编排相位。**arch-reviewer (claude-opus-4-8, a2eb1cd50a6e28838) CONDITIONAL-PASS** 裁决落库（实施蓝图，零上下文损失）：
     - **方案 X（一票否决裁定，否决方案 Y）**：身份副作用（ref/cache/redirect/episodes/characters）**留各源自有事务**（bangumi applyEnrichmentDb / tmdb autoMatch），仅剥离**标量内容字段**到上层。方案 Y（拆 applyEnrichmentDb 到外层单事务）违反 ADR-174/177「真源不外迁」+ 回归面爆炸（confirmMatch 共享）。两阶段非原子可接受：阶段二失败 = 「ref/episodes 已落、标量未更新、proposals 无记录」≡ 现有 enrich 中途崩溃语义，去重守卫 + refresh 收敛，不违任何 ADR 不变量。
     - **O-205-3 vs D-205-1 调和（非 AMENDMENT，仅澄清）**：「采集层」=fetch/search/score/detail；service 标量 safeUpdate 不属采集层，改返 proposedFields，身份副作用留各事务（方案 X）。澄清记 49-B changelog/偏离说明（无 docs 授权改 ADR 正文）。
     - **reconcile 字段白名单（进 trust 加权）**：title/titleOriginal/originalLanguage/description/coverUrl/genres+genresRaw/country/rating + tmdb 图片三组（backdrop/logo/cover 含 status/source/width/height **随主字段整组写**，复用 `CROSS_VALIDATION_GROUPS`〔TmdbConfirmService:236-250〕作真源、提取共享）。**directors/cast/writers 不进**（douban 单源，走 fill-if-empty）。**type 不进**（留 autoMatch ADR-203 caller fill-if-default）。cache(doubanId/bangumiSubjectId/tmdbId/imdbId) 不进（各源 ref 写 + fill-if-empty 白名单）。
     - **M1 方案 A 补精度**：winner.source 优先级 ≥ 现 source → safeUpdate(winner.value, winner.source)；< → proposal-only（is_winner=true,applied=false 不写 catalog）。**applied 列必须取自 safeUpdate 返回的 skippedFields 回填**（winner∈skipped→applied=false），故 proposals 落表在该批 safeUpdate **之后**、同一 reconcile 事务。同级 winner 不需 preserveMetadataSource。
     - **事务边界**：bangumi/tmdb 自有事务保留（去标量 safeUpdate）；reconcile 新事务（db.connect→BEGIN→按 source 分组 safeUpdate(winner,{db:client}) + batchUpsertFieldProposals(client)→COMMIT）。**gather 保持现 step1→2→3→3.5 fetch 顺序**（防 tmdb imdb 写回影响 douban 输入竞态 + M6 douban step1/2 互斥）。reconcile 在 bangumi redirect COMMIT 后用 effectiveCatalogId。
     - **canonical+加权**（新模块 `services/metadata/reconcile.ts`，超 500 行拆 .canonical.ts）：trust 派生 CATALOG_SOURCE_PRIORITY（禁另立硬编码）；canonical=数组排序集合相等/字符串 trim+大小写归一/description 仅 trim/rating 容差 ±0.1；≥2 源 canonical 相等→高置信 winner 记参与一致最高 trust 源；单源按 confidence；douban 护栏由 safeUpdate isLowerPriority 兜底；归一后仍 ≥2 源不等→非 winner 源 proposal 写 conflict_state（49-C 消费）。
     - **rescore（核实修正）**：跟 **ref 写入点**（身份证据面），**不随标量 reconcile 迁移**。D-205-5「随 reconcile 迁移」措辞对方案 X 不成立（ref 没迁到 reconcile）。**tmdb autoMatch 既存遗漏无 rescore** → -B2 补 `enqueueIdentityVideoRescore`（auto_matched primary ref 写后），记「META-48 遗漏补齐」偏离。
     - **interim 退场**：`filterCrossValidation`/tmdb 内 `preserveMetadataSource` 调用（TmdbConfirmService:453/435/478）**-B2 随 reconcile 同步退场**（不拖 49-D，否则双重裁决）；`CROSS_VALIDATION_GROUPS` 提取共享给 reconcile 复用后、filterCrossValidation/isEmptyValue 若无他用则删；safeUpdate 的 preserveMetadataSource **参数保留**（通用能力）。
     - **3 关键风险**：①（最高）confirmMatch 共享 applyEnrichmentDb，-B1 剥离标量须保 confirm 写标量不变（ADR-202）；②（高）applied 回填时序（safeUpdate 后用 skippedFields 回填再 batchUpsert，同事务）；③（中）interim filterCrossValidation 未与 reconcile 同步退场→双重裁决。
   - **META-49-B1**（✅ 已完成 2026-06-15，主循环 opus）：内容标量写入接口剥离（bangumi/tmdb → 返 proposedFields）+ enrich 立即 safeUpdate（**行为等价过渡，无 reconcile**）。**两硬约束（用户设计门禁）**：① **TMDB cache/type 显式拆出**——autoMatch（TmdbConfirmService:437 组装 updateFields / :478 一次写）拆为「身份+type 内部 safeUpdate 留事务（tmdbId/imdbId fill-if-empty + type ADR-203 fill-if-default）」+「内容字段返 proposedFields」，**不得把 tmdbId/imdbId/type 排除出 proposedFields 却丢内部写入**（否则 cache/type 回归）。② **Bangumi wrote 语义重定义**——applyEnrichmentDb 加显式 `mode`（inline/defer）：confirm（:294）/refresh 走 inline、事务内 scalar 写**零变化**（wrote=scalar updated，confirm 依赖 !wrote 回滚）；auto 走 defer、只写身份 bangumiSubjectId（留事务触发 catalog ref/cache + redirect）+ 返 proposedFields(content)+effectiveCatalogId，身份副作用成功与 scalar 写入**分开表达**。单测：confirm scalar unchanged + auto scalar 等价 + TMDB tmdbId/imdbId/type retained。
     - **完成备注**：`services/metadata/fieldSplit.ts` 共享原语 `splitIdentityScalarFields`（身份/type vs 内容标量）+ tmdb autoMatch 拆身份+type 留事务/内容 proposedFields 上抛 + bangumi applyEnrichmentDb `mode(inline/defer)`（confirm/refresh inline 零变化 + auto defer 身份/scalar 分离）+ enrich step3Bangumi/stepTmdb 立即 safeUpdate。门禁全绿：typecheck 7ws/lint 4ok/test:changed 16 文件 334 passed/verify EXIT=0；+8 单测（fieldSplit 4 + tmdb retained 1 + enrich 端到端 1 + 2 交叉验证适配 + confirm scalar 断言）；e2e N/A。**偏离（arch-reviewer 澄清，非 AMENDMENT）**：① O-205-3「采集层」=fetch 不含 service safeUpdate；② 两阶段非原子等价现有崩溃语义；③ 实施精化仅剥内容标量、身份字段留事务（防 cache/ref/type 丢失）。执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, a2eb1cd50a6e28838) gate。详见 changelog [META-49-B1]。**解锁 META-49-B2。**
   - **META-49-B2**（✅ 已完成 2026-06-15，主循环 opus；**用户设计门禁通过 P1-a 范围 + P1-b passthrough**）：新建 `reconcile.ts`（gather→reconcile→write + M1 方案 A + canonical + 加权 + proposals 落表 + conflict_state）+ interim 退场 + tmdb rescore 补齐 + ADR-205 O-205-3 澄清 + Service 单测。**🔴 范围边界裁定（用户设计门禁 P1-a）= 方案 (a)：B2 只做 bangumi/tmdb reconcile core，douban Step1/2（MetadataEnrichService:233/281/351）仍直接 safeUpdate、留 49-D cutover**——忠于 ADR-205 D-205-8「douban cutover 在 49-D，不提前改活表」+ D-205-9 拆卡；过渡态 reconcile 仅 bangumi/tmdb 两源加权。douban 进 reconcile（proposal 化 + 投票背书语义）归 **49-D**（届时 49-D = douban proposal 化 cutover + 审核台 review_conflict UI）。否决方案 (b)（B2 纳 douban 化）= 提前 cutover 违反 D-205-8 + douban finalizeDoubanAutoWrite/episodes/recordDoubanSignal 耦合复杂宜专卡。
     - **🔴 P1-b 补订（用户设计门禁 2 / Codex review）= passthrough 字段防回归**：`splitIdentityScalarFields` 只剥身份/type，B1 上抛的 proposedFields 含**非 reconcile 白名单内容字段**——bangumi `mapSubjectToCatalogFields`（BangumiService.utils.ts:242-262）产 `ratingVotes`/`releaseDate`/`year`/`director`/`writers`/`tags`，均不在白名单（本卡 2701 行）。若 B2 仅把白名单送 reconcile 并删 B1 过渡 safeUpdate（MetadataEnrichService:130/189），这组字段**静默停写 = 回归**。**裁定方案 (a)**：reconcile 编排 gather 后对每源 proposedFields **二次拆分**——`reconcileFields`(∩ 白名单)进 canonical/trust 加权/proposals/winner；`passthroughFields`(∖ 白名单)**保 B1 行为等价**经该源 safeUpdate 直写（priority gate + provenance 不变），不进 canonical/proposals，与 winner 同处 reconcile 事务（共享 PoolClient，按源分组）。新增 `splitReconcilePassthrough(proposedFields)` 原语（对齐 fieldSplit `splitIdentityScalarFields` 范式，按 `RECONCILE_FIELD_KEYS` 二分；该常量从 `CROSS_VALIDATION_GROUPS`〔TmdbConfirmService:247-261〕提取共享、作 reconcile 白名单真源）。否决方案 (b)（扩白名单纳 director/writers/year… 补 canonical/applied/proposal 规则）——这组多为 bangumi 单源、无跨源竞争，reconcile 加权零增益反增假 conflict 风险。**范围说明**：tmdb `buildCatalogFields`（TmdbConfirmService:203-238）产出 ⊆ 白名单 → 当前 tmdb 无 passthrough；douban Step1/2 留 49-D inline 不受影响；passthrough 实际仅 bangumi 命中，但**拆分机制源无关**（防未来字段新增静默漏写）。**单测**：enrich 端到端断言 bangumi 非白名单字段（releaseDate/year/ratingVotes/director/writers/tags 至少一组）经 reconcile 路径后仍写 catalog（passthrough 不丢）+ 白名单字段走 winner 裁决。
     - **完成备注**：`services/metadata/reconcile.canonical.ts`（`RECONCILE_GROUPS` 从 `CROSS_VALIDATION_GROUPS` 提取 + `RECONCILE_FIELD_KEYS` + `splitReconcilePassthrough` P1-b 二次拆分 + `canonicalizeValue` 数组排序集合相等/字符串大小写归一/description 仅 trim/rating round 0.1）+ `reconcile.ts`（`reconcileMetadata` gather→逐组裁决〔单源 confidence / 多源 canonical 一致取最高 trust + tie→confidence→bangumi 优先 / 不一致 winner + 非 winner conflict_state〕→ 新事务按 winner.source 优先级升序分组 safeUpdate〔winner content + 该源 passthrough〕+ M1 方案 A applied 据 skippedFields 回填 + batchUpsertFieldProposals）。**interim 退场**：删 `filterCrossValidation`/`isEmptyValue`/`CROSS_VALIDATION_GROUPS`（移 reconcile.canonical）+ tmdb 身份 safeUpdate 固定 `preserveMetadataSource:true`（身份/cache/type 不接管内容来源）+ 删 `TmdbAutoMatchResult.preserveMetadataSource` 透传 + content 全量上抛。**rescore 补齐**：tmdb autoMatch auto_matched primary ref COMMIT 后 `enqueueIdentityVideoRescore`（META-48 遗漏补齐）。**enrich 接线**：删 step3/stepTmdb 立即 safeUpdate → 收集 bangumi/tmdb payload（step3Bangumi 透传 confidence）调 reconcileMetadata。**偏离登记**：① metadata_source 多源 winner 混写时为 last-writer 粗粒度（字段级真源由 provenance 承载，优先级升序写让最高 trust winner 最后定，确定性）；② rating canonical 用 round 0.1 近似容差（边界 7.64/7.66 罕见可接受）；③ P1-b passthrough 守卫置于 reconcile/canonical 单测（机制真源），enrich 端到端测 tmdb 单源 reconcile 交接（bangumi auto REST 路径未净 mock 不强造）。**Codex stop-time review FIX（stale proposal rows never cleared）**：batchUpsert 只 upsert 不删 → 跨 run winner 翻转/冲突消解后旧 is_winner/conflict_state 残留=幽灵冲突（49-C partial index 永不清）→ 新增 `deleteFieldProposalsByFields`，reconcile 对决出字段先删后插（同事务 `decisions.map(d=>d.field)`），+3 单测，门禁复跑 test:changed 228 passed/verify EXIT=0。门禁全绿：typecheck 7ws EXIT=0 / lint 4ok / test:changed 15 文件 262 passed（含 Codex 第二消费方 bangumiRoutes inline 零回归 + tmdb-confirm 44 + metadataEnrich 41 + metadataReconcile 15 + bangumi 84/fieldSplit/proposals 95）/ verify:adr-contracts EXIT=0（243 端点对齐无新端点 + sql schema 对齐）；e2e N/A（纯 service）。+19 单测（reconcile 15 + tmdb 退场适配 2 + enrich reconcile 交接 1 + canonical/split 内含）。执行模型 claude-opus-4-8；子代理 arch-reviewer (claude-opus-4-8, a2eb1cd50a6e28838) B gate（已记，纯落地已 PASS 蓝图 + 用户设计门禁不再 spawn）。详见 changelog [META-49-B2]。**解锁 META-49-C（冲突注入 derive）。**
   - **META-49-C**（✅ 已完成 2026-06-15，主循环 opus）：冲突注入 `derive.ts`（`MetadataStatusSourceRow` 扩 fieldConflicts + `deriveOverall` 分支 + **`METADATA_STATUS_JOIN_SQL` 镜像同步** + 批量 proposals 查询避 N+1 + 双向守护单测，M3）。**无 DTO/枚举/Props 变更**（MetadataStatusIssue.code 裸 string + needs_review/review_conflict 已存在；字段名展示 UI 留 49-D）→ 不触发强制升 Opus。
     - **完成备注**：① 批量查询 `getConflictFieldsByCatalogIds`（DISTINCT catalog_id/field_name WHERE conflict_state IS NOT NULL，走 partial index 避 N+1）→ Map<catalogId, 字段名[]>。② derive 注入：`MetadataStatusSourceRow.fieldConflicts` + `deriveOverall` 首位分支（冲突→needs_review，先于 provider 态）+ `collectIssues` field_conflict danger issue（provider:null 跨源，字段名进 message）+ `buildMetadataStatusSummary` issueLevel 冲突→danger + `toMetadataStatusSourceRow(_,_,fieldConflicts=[])` 默认 [] 兼容。③ JOIN_SQL 镜像：`conflictExists = EXISTS(metadata_field_proposals WHERE catalog_id=v.catalog_id AND conflict_state IS NOT NULL)` + overallRank 首位 needs_review + issue_rank `GREATEST(…, conflict?danger:0)`。④ VideoService adminList/adminFindById 批量注入。⑤ 双向守护：unit（JS 冲突→needs_review/danger/review_conflict + 无冲突默认不变 + SQL 串含 conflictExists/needs_review 首位/issue GREATEST）+ integration（**JS 侧同样经 getConflictFieldsByCatalogIds 消费冲突 → 与 SQL conflictExists 同源，诚实双向守护**，只读不改 dev DB）+ query 单测。门禁全绿：typecheck 7ws EXIT=0 / lint 4ok / test:changed 升全量 78 文件 1097 passed / verify:adr-contracts EXIT=0（sql-schema-alignment 对齐，conflict 查询 + EXISTS 仅引用既有列）/ integration metadata-status 6 passed（真库 SQL conflictExists 可执行 + JS↔SQL 口径一致）。+7 单测（derive 冲突 JS 2 + SQL 1 + query 2 + …）。执行模型 claude-opus-4-8；子代理无（M3 已 ADR-205 arch-reviewer aa7acbacca478ea7c PASS 定形，无 DTO/Props/schema/migration/端点变更）。详见 changelog [META-49-C]。**解锁 META-49-D（douban cutover + 审核台 review_conflict 冲突展示 UI）。**
   - **META-49-D**（原子化拆 -D1/-D2：api cutover 与 server-next UI 两层 deliverable，对齐 49-B 拆卡先例）：
     - **META-49-D1**（✅ 已完成 2026-06-15，主循环 opus）：douban cutover——把 douban Step1/2 三处 safeUpdate 按**方案 X**拆分：身份 `doubanId` 留 douban 路径 safeUpdate（驱动 `finalizeDoubanAutoWrite` refStatus/recordDoubanSignal/writeExternalRef 零变化）+ 内容上抛 → enrich 收集为第三 ReconcileSource 交 reconcile 加权。
       - **完成备注**：新私有助手 `writeDoubanAuto`（身份 `safeUpdate({doubanId})` + finalize + 内容去 undefined 构造 douban ReconcileSource）；step1 imdb/title-alias + step2 network 三写点改造、step1/2 返 `{status, proposal?}`；enrich `reconcileSources` 提前到 step1 之前、douban/bangumi/tmdb 三源一并 push reconcile（effectiveCatalogId）。**douban 降级天然由 reconcile 框架承载**（D-205-3 trust douban:3 < 4 永不盖、一致背书、冲突挂复核）；episodes/recordDoubanSignal 留 douban 路径（与 catalog 内容正交）；无活表 CATALOG_SOURCE_PRIORITY 数值改（M5）。**偏离**：anime + bangumi redirect 时 douban 内容落 surviving catalog（reconcile 用 effectiveCatalogId）反比 pre-D1 落 orphan 更正确；非 anime 无 redirect 零变化。门禁全绿：typecheck 7ws EXIT=0 / lint 4ok / test:changed 13 文件 204 passed + 定向回归 8 文件 219 passed（bangumi/tmdb/douban/reconcile/derive/bangumiRoutes 零回归）/ verify EXIT=0；metadataEnrich 42（+1 D1 身份/内容分离 + douban auto 既有断言零改 objectContaining 兼容）。执行模型 claude-opus-4-8；子代理无（方案 X 已 B1/B2 验证 + D-205-8 定形纯落地）。详见 changelog [META-49-D1]。**解锁 META-49-D2（审核台 review_conflict UI）。**
     - **META-49-D2**（✅ 已完成 2026-06-15，主循环 opus；**用户裁定最小收官无 Opus**）：审核台 review_conflict 冲突展示 UI。**评估结论**：MetadataStatusPanel 已通用渲染 summary.issues + review_conflict nextAction 按钮，唯一缺口=field_conflict 中文 label → 纯 admin-ui 内部 label（非 Props，无 Opus）+ server-next 自动消费。
       - **完成备注**：① derive `collectIssues` field_conflict message 净化为纯字段名数据（`fieldConflicts.join(', ')`，i18n 下沉 UI）；② admin-ui `ISSUE_CODE_LABEL` += `field_conflict:'多源字段冲突'` + `issueText` 对 field_conflict 拼 `label：message` → 「多源字段冲突：title, rating」；③ server-next 审核台（TabDetail/TabMetadata）经 summary.issues 自动渲染冲突（零接线改动），review_conflict 按钮需 onAction（TabDetail 只读 = follow-up，不强接导航）。门禁全绿：typecheck 7ws EXIT=0 / lint 4ok / test:changed 升全量 162 文件 2150 passed / verify EXIT=0；+1 panel 单测（field_conflict「多源字段冲突：…」）。执行模型 claude-opus-4-8；子代理无（最小收官无 Props 变更）。**follow-up**：onAction review_conflict 导航到冲突字段编辑（需交互设计）+ 结构化 conflictFields DTO（如需点击跳字段，触发 Opus）。详见 changelog [META-49-D2]。**META-49 全收口（-A~-D2 六子卡）。SEQ-20260615-02 收官。**

### 备注

- 本序列产出于 docs/audit/metadata-enrichment-investigation-20260615.md 第五节 follow-up「TMDB 自动链路」。
- 原子化：实施卡 -B/47/48/49 为 ADR 定稿前的蓝图占位，最终拆分（尤其 META-49 -A/-B）以 META-46-A ADR 蓝图为准。

---

## SEQ-20260616-01 — 原名/别名驱动的外部匹配 + 跨译名查重 + 字段漂移 UI（META-50）

- **创建时间**：2026-06-16｜**最后更新**：2026-06-16
- **来源**：用户「海贼王/航海王 案例——TMDB 以英文/原名为主，中文译名不一致；优化查询/匹配/查重合并 + 更新编辑/快编/视频库 UI」。ADR 设计先行（用户 AskUserQuestion 裁定）。
- **设计真源**：ADR-206（decisions.md）+ ADR-105a AMENDMENT 2026-06-16。arch-reviewer (claude-opus-4-8, agentId ad0578cea5038ec95) REVISE→CONDITIONAL-PASS，M1–M9 吸收为 D-206-1~10。
- **依赖序**：1A → {1B, 1C, 2A} → 2B；3A → 3B（WS3 可与 WS1/2 并行）。

| 卡 | 内容 | 状态 | 门禁 |
|---|---|---|---|
| **META-50-A** | ADR-206 起草 + ADR-105a AMENDMENT + 本序列登记 | ✅ 已完成（2026-06-16，arch-reviewer Opus 设计裁决） | ADR-level Opus ✅ |
| **META-50-1A** | `knownNames.ts` 共享原语（loadKnownNames + filterForMatchScore/filterForSearchQueries 双投影）+ `listCatalogAliases` query + 单测（D-206-1） | ✅ 已完成（2026-06-16，arch-reviewer Opus 7 MUST 全落实） | **强制 Opus**（新共享原语契约 M4） |
| **META-50-1B** | enrich 预取扩 knownNames + TMDB autoMatch 多词 search（N≤3 早停去重 M5）+ 打分用 knownNames（极性约束 M2）+ 单测（D-206-2/3） | ✅ 已完成（2026-06-16，multiTermSearch + 多 target 打分） | sonnet 可起 |
| **META-50-1C** | bangumi 本地召回补 alias 评估（D-206-4，可选/可并 1B 或独立观察卡） | ✅ 已完成（2026-06-16，评估观察 doc-only：bangumi 单 CN 键召回，多词召回登记 follow-up） | sonnet 可起 |
| **META-50-2A**（拆 -1/-2，arch-reviewer accd3e239e7731ba6 架构裁决 2026-06-16） | 原单卡 ≥9 项跨 schema/service/4 消费方 → 拆 2A-1/2A-2（详 ADR-206 §META-50-2A 架构裁决 + M-2A-1~8） | 已拆分（见下两行） | **schema 设计已 Opus 承担** |
| **META-50-2A-1** | ① migration 120 建派生表 `catalog_blocking_alias_keys`（normalized_key/source/kind/confidence，方案 A，CASCADE+索引+验证块）② queries `upsertCatalogBlockingAliasKeys`/`listCatalogBlockingAliasKeys` ③ 写键 service fn（loadKnownNames→normalizeForExternalMatch→Q2 阈值，**含 'catalog' 哨兵恒进 M-2A-2**）④ 接线写键到 catalog 标题/别名变更位点（加性，不改 reconcile/safeUpdate 既有语义）⑤ 回填脚本 + architecture.md schema 同步 | ✅ 已完成（2026-06-16，migration 120 落库 + 回填 6856 键/4866 catalog） | **schema 卡，commit 带 Subagents trailer** |
| **META-50-2A-2** | ① blockingRecall 段③（`ALIAS_NORM_SOURCE_SQL` 共享常量 + fetch/recall 双路）② `PairSideInput.aliasBlockingKeys`（独立字段 M-2A-3，**不碰 aliasKeys**）+ buildSides 载入 ③ offlineRescore 段③相位 ④ videoRescore+ingestShadow 单 video 段③ ⑤ pairScoringPersist `sharedAliasBucketKeys` 交集 M-2A-4 → blockingKeys（空不注入 M-2A-6）；scorePair/weights 零 diff 守护 | ✅ 已完成（2026-06-16，commit 1838cb0a 机制 + d397149a freshness；段③ 接四召回 + evidence_hash 并集 + scorePair 零 diff，全量 7825 passed） | **红线密度最高（误并防护）** |
| **META-50-2A-2 前置（Codex fix 遗留）** | 上线 2A-2 读派生键前须补 **confirm 路径写键重算**——tmdb/douban/bangumi confirm（标准 admin 确认改 catalog 标题，非 enrich，当前 stale；2A-1 已修 enrich + 手动编辑路径）追加 `recomputeCatalogBlockingKeys`（加性非阻断）+ 部署时重跑回填脚本自愈存量 | ✅ 已完成（并入 2A-2 commit d397149a：tmdb confirm/douban confirmFields/bangumi confirmMatch 三路径 freshness） | 稳态新鲜度 |
| **META-50-2B** | 误并防护验证卡——跨译名 pair 仅进 candidate 不自动合并（M1-a/c）+ 同名不同作不误并回归 fixture（D-206-6/10）+ scorePair/weights 零 diff 实证 | ✅ 已完成（2026-06-16，identity-alias-blocking-redline.test.ts 8 测试锁三红线；external_alias_match 休眠 + 同名不同作 veto + 非 exact 封顶不自动绑定） | sonnet 可起 |
| **META-50-3A** | VideoMetaSchema + VideoService catalogFields 扩 title_original/aliases 写路径（M6/M7，不旁路 reconcile/safeUpdate）+ 单测（D-206-8/9 后端） | ✅ 已完成（2026-06-15，opus；safeUpdate fieldMap 已支持 M6 零新写路径 / replaceManualAkaAliases 替换写 manual aka / recompute hook 扩 titleOriginal·aliases；450 passed） | sonnet 可起 |
| **META-50-3B**（拆 -1/-2/-3，opus 主循环裁决 2026-06-15：探查发现跨 api 读+api 写moderation+前端 3 面，远超 5 项 + R3 回填源裁决 → 拆三子卡；**不碰 admin-ui 公开 Props**，编辑表单/视频库列均 server-next 原生 input/原生列，故「强制 Opus」M8 前提不成立，opus 主循环直接落地） | admin-ui 编辑/快编表单 + 视频库列补 title_original+aliases（D-206-8/9 前端） | 已拆分（见下三行） | server-next 消费层（非 admin-ui Props） |
| **META-50-3B-1** | api 读路径注入结构化 manual aka aliases（listCatalogAliases 过滤 source=manual∧kind=aka，**非数组列**——数组列无同步 stale，R3 单一真源）+ SQL 补 select mc.original_language + DbVideoRow/VideoAdminDetail 镜像 aliases·original_language + 单测 | ✅ 已完成（2026-06-15，opus；VIDEO_FULL_SELECT 共用列加 original_language / adminFindById 注入 manual aka 覆盖数组列 stale / 1143 passed） | sonnet 可起 |
| **META-50-3B-2** | 编辑抽屉（VideoEditDrawer/TabBasicInfo +titleOriginal·originalLanguage·aliases 输入「逗号分隔」范式 + FormState/formToPatch/VideoMetaPatch +3 + 回填读 3B-1 注入）+ 测试（依 3B-1） | ✅ 已完成（2026-06-15，opus；原名/原语种 ROW + 别名 FIELD 原生 input + videoToForm 回填 + formToPatch diff 替换语义；form-helpers +7 测试，36 passed） | sonnet 可起 |
| **META-50-3B-3** | 快编（PendingMetaQuickEdit + PATCH /admin/moderation/:id/meta 端点 schema/service/MetaEditPayload 扩 titleOriginal·aliases，复用 3A safeUpdate/replaceManualAkaAliases，**既有端点不新增 route**）+ 视频库列（VideoColumns +原名列 title_original）+ 测试 | ✅ 已完成（2026-06-15，opus；moderation meta 复用 videoSvc.update 仅补 schema 透传 / 快编 lazy-fetch 回填 baseRef + 原名·别名 input / 视频库原名列；moderationMetaEdit 25 + PendingMetaQuickEdit 17 passed）**→ WS3 收官 + SEQ-20260616-01 全交付** | sonnet 可起 |

- **WS2 最高风险**：别名 blocking 误并——M1 三红线（仅扩召回永不成正证据 / 来源置信门槛 / 自动合并仍受 ADR-105a 闸门）+ ADR-105a 自动合并 Phase 1-4 默认 OFF 安全网双重兜底。
- **关键事实**（arch-reviewer 校正）：① title_original/originalLanguage 已在 ADR-205 RECONCILE_GROUPS，knownNames 只读消费不开第二写入方；② alias blocking 用独立桶不写 title_observations；③ romanization 仅召回不拉分（ADR-175 D-175-4）；④ external_id 桶已召回同 ID pair，别名 blocking 价值仅在"译名桥接、ID 未都填"场景。
- **第二轮审核 R1–R4 闭合**（ADR-206 REVISE 2026-06-16）：R1 alias 桶数据源改 knownNames 投影（CrawlerService 不写 media_catalog_aliases 实证，仅读别名表会一侧化召回）；R2 `external_alias_match` 当前休眠（aliasKeys 无人 populate），WS2 不激活、启用另开 amendment；R3 置信阈值定可执行口径（manual=1.0/NULL+非manual排除/非manual≥0.80）；R4 2A 须落四处召回消费者 + alias 桶 key 纳入 evidence_hash。

---

## SEQ-20260616-03 — TMDB 季粒度自动富集（剧集/动漫/综艺 季级匹配）｜META-53 ✅ 全交付（ADR + A/B/C/D 2026-06-16）

- **创建时间**：2026-06-16｜**最后更新**：2026-06-16
- **来源**：用户「TMDB 对剧集/动漫等按条目分类、库内按季划分，建模错位致元数据增强未自动应用到电影外类型；以《权力的游戏》分季为例，扩展 TMDB 增强到分季类型」。plan mode 设计已批准（含逐集元数据 + 前向生效 + 存量回填，用户 AskUserQuestion 裁定）。
- **设计真源**：ADR-207（decisions.md，D-207-1~10）。arch-reviewer (claude-opus-4-8, agentId a98bf3dfbab2c993d) CONDITIONAL-PASS，1 BLOCKER + 3 HIGH + 5 MEDIUM 全吸收。闭合 **ADR-202 D-202-α**（tv-show-root follow-up）+ 兑现 **ADR-177 D-177-11:20155**（tmdb season ID→season exact）。完整执行档：`~/.claude/plans/tmdb-joyful-mochi.md`。
- **依赖序**：ADR → -A → -B → -C；-D 依赖 -B/-C 落地后跑。**无新 migration**（catalog_external_refs/catalog_episodes/media_catalog schema 全就绪）。
- **实现卡建议另起 sonnet 会话**（用户裁定「先提交 ADR，实现卡另起会话」；本会话 Opus 仅交付 ADR）。

| 卡 | 内容 | 状态 | 门禁 |
|---|---|---|---|
| **META-53-ADR** | ADR-207 起草 + arch-reviewer Opus 裁定（9 决策 → D-207-1~10）+ 本序列登记 | ✅ 已完成（2026-06-16，arch-reviewer claude-opus-4-8 CONDITIONAL-PASS） | ADR-level Opus ✅ |
| **META-53-A** | TMDB 客户端 + 类型（`tmdb.ts` 新增 `getTvSeasonDetail` `/tv/{id}/season/{n}` append+404→null + `tmdb.types.ts` 新增 `TmdbTvSeason`/`TmdbSeasonDetail`/`TmdbSeasonEpisode` + `TmdbTvDetail.seasons?`）D-207-3 | ✅ 已完成（2026-06-16，claude-opus-4-8；tmdb.types 新增 TmdbTvSeason/TmdbSeasonDetail/TmdbSeasonEpisode + TmdbTvDetail.seasons? / tmdb.ts 新增 getTvSeasonDetail〔提取 getDetailAt 复用降级+埋点真源〕/ tmdb.test +4=18 passed；test:changed 318 绿）执行模型: claude-opus-4-8 | sonnet 可起 |
| **META-53-B** | `TmdbConfirmService` 季级路径（autoMatch 季解析 seasons[]→season.id + `buildSeasonCatalogFields`〔季回退 show D-207-4 + 剔标题三件套 D-207-5 + **不并入 tmdbId/imdbId cache** D-207-6〕+ season exact ref〔external_id=季 id D-207-2〕+ video_external_refs 写季 id + 逐集 upsertCatalogEpisodes(source=tmdb) + episodesByStatus〔D-207-7〕+ 软校验 warn〔D-207-3〕+ **失败降级分层 D-207-10**〔getTvSeasonDetail 失败仍写 season exact〕+ **confirm 源头纠偏内部解析季 id D-207-9a**〔BLOCKER〕+ 事务边界 REST 事务外/逐集用 Phase2 client）+ 单测 | ✅ 已完成（2026-06-16，claude-opus-4-8；buildSeasonCatalogFields〔季回退 show + 剔标题三件套〕+ toTmdbEpisodeInput + resolveSeason〔seasons[] 命中 + 软校验 warn + getTvSeasonDetail〕；autoMatch 季级：season exact=季 id / video ref=季 id / 逐集 upsert 同事务 / 季 catalog 永不写 cache / 失败降级分层 / 返回 seasonEpisodeCount；confirm 源头纠偏 D-207-9a。tmdb-confirm-service +8=67 passed；test:changed 276 绿）执行模型: claude-opus-4-8。**架构决策**：集数 episodesByStatus 派发留卡 C（避 service↔enrich 循环 import） | sonnet 可起 |
| **META-53-C** | `MetadataEnrichService.stepTmdb` 接线（透传 `catalogSnapshot.seasonNumber` → autoMatch；season_number!=null→季级 / null→现状 show 级 D-207-1）+ 单测 | ✅ 已完成（2026-06-16，claude-opus-4-8；stepTmdb +seasonNumber/+catalogStatus 参数，enrich 透传 catalogSnapshot.seasonNumber〔redirect 去重键含季号守恒〕；autoMatch 入参 seasonNumber=seasonNumber??undefined〔D-207-1〕；matched 后 seasonEpisodeCount>0 → updateVideoEpisodes(episodesByStatus(catalogStatus,count),'auto')〔D-207-7〕。metadataEnrich +4=46 passed；test:changed 213 绿）执行模型: claude-opus-4-8 | sonnet 可起 |
| **META-53-D** | **存量清理脚本 D-207-9b**〔BLOCKER：检出 tmdb season exact 中 external_id≠正确季 id 行→`demoteExactRef` 降级 candidate，幂等可观测，非 DELETE〕+ 回填（**复用 `scripts/reenrich-backfill.ts` run-unique jobId `backfill-${runTs}-${id}` + `listVideosForBackfillEnrich` 扩 TV 家族∧season_number IS NOT NULL；禁 enqueueEnrichJob/batchEnqueueEnrich**——固定 jobId 被 Bull 残留 job 静默跳过漏跑 REVISE-2，**不新增 admin route**）+ 文档 | ✅ 已完成（2026-06-16，claude-opus-4-8；清理脚本 scripts/cleanup-tmdb-season-refs.ts〔classifyStaleSeasonRef 纯函数 + getTvDetail 解析正确季 id + demoteExactRef 降级，--dry-run，VITEST 守卫 main〕+ listVideosForBackfillEnrich tmdb-season 模式〔TV 家族∧season_number IS NOT NULL〕+ reenrich-backfill 接受 --mode tmdb-season + demoteExactRef 加 note 参数；cleanup 5 + backfill +1=8 + demote +1=15 passed；test:changed 1336 绿）执行模型: claude-opus-4-8。**运行顺序**：先 reenrich-backfill --mode tmdb-season（写正确季 ref）→ 再 cleanup --dry-run 复核 → cleanup 正式跑（降级 stale） | sonnet 可起 |

| **META-53-E** | code review 返工 4 finding：P1-1 季级搜剧不按季年份过滤（searchTv year=null）/ P1-2 confirm 季级用 buildSeasonCatalogFields（加 sel 参数，尊重 moderator fields）/ P2-3 sourceRef 用 season id（autoMatch 返 externalRefId）/ P2-4 逐集 upsert 包 SAVEPOINT 失败不回滚 season exact（对齐 D-207-10）+ 单测 | ✅ 已完成（2026-06-16，claude-opus-4-8；P1-1 季级 searchTv year=null〔避 first_air_date_year 漏非首播季〕/ P1-2 buildSeasonCatalogFields +sel 参数 + confirm 季级改用之〔季简介/季海报，尊重 fields〕/ P2-3 TmdbAutoMatchResult +externalRefId〔季=season id〕→ stepTmdb sourceRef / P2-4 逐集 upsert 包 SAVEPOINT 失败不回滚 season exact。tmdb-confirm-service 67→72 + metadataEnrich 46→47；test:changed 286 绿）执行模型: claude-opus-4-8 | sonnet 可起 |

- **BLOCKER 红线登记（D-207-9）**：confirm 路径是 show-id-as-season 误写源头——**-B 必含 confirm 内部解析季 id**（消除新错绑产生）+ **-D 必含存量清理脚本**（降级旧错绑行）；二者缺一则错绑持续/cache 一致性硬校验无法绿。
- **关键约束**（含实施前契约审核 REVISE-1~4，详 ADR-207 REVISE 2026-06-16）：① 季 ref external_id=TMDB 季自身 id（索引①不含 season_number，用 show id 则同剧多季互撞）；② **季 catalog 不写 tmdb_id/imdb_id cache**（二者 026 列级 UNIQUE，多季写同一 show id 必撞 + findCatalogByTmdbId 误命中——REVISE-1 推翻原「写 show id」）；③ 逐集读侧 source 优先级 anime bangumi>tmdb 防重复集（D-207-7，UI 接线若拆卡须标 follow-up）；④ 季海报复用 pickBestImage/buildImageFields 禁新写（D-207-4）；⑤ 回填禁固定 jobId 入口（REVISE-2）；⑥ getTvSeasonDetail 失败不丢 season exact（REVISE-3）。

### SEQ-20260616-03 round-2 follow-up 登记（code review round 2 / META-53-F 2026-06-16）

> **存量纠偏闭合口径纠正（F1）**：D-207-9 BLOCKER 的「停止新错绑产生（D-207-9a confirm 源头纠偏）+ 移除残留错绑 exact（D-207-9b cleanup demote）」**确已闭合**；此前 changelog/task-queue 的「端到端闭环」措辞**夸大**了——「为 stale 人群写回正确 season exact 恢复季精度」这一**超出 BLOCKER 的增强**未达成：stale 行只来自人工 confirm（manual_confirmed isPrimary video ref），被 `MetadataEnrichService.stepTmdb` alreadyBound 守卫（:210-216）跳过，故 `reenrich-backfill --mode tmdb-season` 跳过整个 stale 人群、autoMatch 不跑、正确季 ref 不写回。cleanup 只降级（安全有益），季精度恢复需人工重新 confirm 或另路。

- **META-54-A（窄口径✅ 文档关闭 2026-06-16 / 广口径拆出）— stale season ref 季精度恢复路径**：**gating ① 已核（SEQ-20260616-04，dev resovo_dev）**：`tmdb season exact ∧ season_number IS NOT NULL` 仅 1 行且为正确季 id（非 stale show-id-as-season）→ **stale=0，窄口径按 gating 规则降级纯文档项、关闭**（生产库无访问权，但 cleanup 脚本判断「端点/UI 实际从未发 seasonNumber」→ 生产大概率亦 0；上线前仍可跑 `cleanup-tmdb-season-refs.ts --dry-run` 复核）。**force-rematch（原步骤②）仅惠及 9 条**（series 5 + anime 4：season_number + alreadyBound blocked），收益失衡，**不单独建 ADR 路径**——并入下方广口径或按需人工 re-confirm。**广口径拆出 → META-54-A2（下）**。
- **META-54-A2（✅ 已完成 2026-06-16，SEQ-20260616-04，主循环 claude-opus-4-8）— 存量非电影季级重富集（兑现脱离待确认）**：**全量重富集已跑**——`reenrich-backfill --mode tmdb-season` 入队 305 videos，worker 全量 enrich（含 reconcile）~8.5 分钟排空。**结果：非电影 season exact 9 → 170（+161 脱离待确认）**，series/variety/documentary 升级率 85-87%、anime 58%（下界，冷门国产动态漫画/网络番 TMDB 无数据）；逐集 3069 条。剩余 only_candidate（2026 未来季待 TMDB 上架自动解析）+ no_candidate（数据源局限）。生产库待 META-54-D 部署后跑同款。详见 changelog [META-54-A2]。原登记↓：META-54-D 搜索词修好后，**286 条非阻塞季级 catalog**（series 119 + anime 84 + variety 54 + documentary 29，无 auto/manual primary video ref → 不被 alreadyBound 卡）可直接 `reenrich-backfill --mode tmdb-season` 升 season exact，**无需 force-rematch**。485 条被 alreadyBound 卡的里仅 9 条有 season_number（其余 476 为 show 级无 season_number，force 也仍 show-candidate，D-202-1 设计）。**命中率已量测**（SEQ-20260616-04，dev inline 抽样 20 条 anime——最难子集）：**季 exact 8/20 (40%) + show candidate 4/20 (20%，季为 2026 未来季待 TMDB 上架) + no_candidate 8/20 (40%，几乎全为冷门国产「动态漫画」/网络番，TMDB 库无此数据)**。修前同类样本仅 ~17%（含「入间/史莱姆」等知名番修前 no_candidate→现 season EXACT），**META-54-D 实效强力验证**。anime 为下界，series/variety 预计更高。**结论**：命中率足以支撑对 286 条跑**全量重富集**（剩余 no_candidate 长尾是 TMDB 数据源覆盖局限、非搜索可解）。待办：① 全量 `reenrich-backfill --mode tmdb-season`（需 Redis+worker，或 inline 批；trigger 后量测整体升级数）；② 9 条 force-rematch（season_number+blocked）按需，收益小可暂缓。
- **META-54-A2-PROD（✅ 作废收口 2026-06-18，SEQ-20260616-04，主循环 claude-opus-4-8）— 生产库非电影季级重富集**：**前提不成立而收口**——本环境无独立"生产库"：本地 postgres 仅 `resovo_dev`（`.env.local` 连）+ `media_atlas` + `postgres`，无 `resovo_prod`。本卡系误判「远程生产待部署 META-54-D 后单独重富集」的产物。该唯一库已由 META-54-A2 跑完（season exact 现 **175 / 逐集 3204**，较收口 170/3069 自然增长）。阻塞理由亦早失效：`6b7b7a5c` 已在 main、dev 仅领先 main 1 个无关 commit（非"541 commit/未合并"）。剩余 135 条非电影长尾（anime 57 / series 40 / variety 20 / documentary 18）无 season exact，但对应 136 video **全 alreadyBound** → reenrich 全跳过、重跑零收益；属 only_candidate（2026 未来季待 TMDB 上架）+ no_candidate（冷门国产 TMDB 无数据），数据源固有局限非缺陷。详见 changelog [META-54-A2-PROD]。
- **META-54-B（follow-up，MEDIUM）— confirm 季级逐集对称（F2）**：confirm 季级现不写逐集（seasonDetail=null）+ 无季多语言海报择优，与 auto（D-207-7 写逐集）不对称；且 confirm 后 manual_confirmed ref 致后续 enrich alreadyBound 跳过、逐集不自动补。补 confirm 拉 getTvSeasonDetail + upsertCatalogEpisodes（与 F1 force 路径可合并设计）。
- **META-54-C（follow-up，MEDIUM）— TmdbConfirmService.ts 模块拆分（F3）**：774 行超 500 红线（SEQ 前已 593）。提取 `tmdb-catalog-fields.ts`（纯函数 buildCatalogFields/buildSeasonCatalogFields/buildImageFields/pickBestImage/pickEnglishTitle/toTmdbEpisodeInput + 常量 + 候选打分组 toCandidate/pickBestTmdbCandidate）至 <500；TMDB_APPLIABLE_FIELDS/pickBestTmdbCandidate/TmdbMediaType 须 re-export 保公开 API。属累积技术债（非本 SEQ 独有，本次越线点）。
- **META-54-D（✅ 已完成 2026-06-16，SEQ-20260616-04，主循环 claude-opus-4-8 / 子代理 arch-reviewer claude-opus-4-8）— 非电影季级 TMDB 搜索词剥离多语言季号标记**：SEQ-20260616-03 完工后验证「TMDB 自动增强非电影」发现（resovo_dev 只读盘点 + 6 样本 inline autoMatch 实证）：季级 applied 代码路径已通（灵不灵 S1 → season exact + 逐集），但存量非电影 **0 条 season exact**、485 条全 show-candidate（待确认），6 样本重富集 **5/6 no_candidate**（含一人之下/入间/史莱姆等知名番）。根因：`buildTmdbSearchTerms` 把带季号后缀的原始标题直发 searchTv，季号后缀以多语言形态（中文第N季/期/部、日文第N期/Nシリーズ、英文 SN）嵌进所有标题变体 → **397 条非电影季级 catalog 中 370 条（93%）无干净作品名**。修：搜索词层剥离多语言季号标记（季号已由 season_number 列承载）；复用 `TitleNormalizer.SEASON_KEYWORDS`/`TitleIdentityParser.SEASON_PATTERNS`（但缺日文形态需补）；回归边界保 movie/show 级 + 不误剥合法标题。**与 META-54-A 协同**：搜索词修好后才值得对存量触发重富集（否则 93% no_candidate）。卡片详见 tasks.md。
- **观察项（F5，INFO）**：`demoteExactRef` WHERE 仅 catalog_id+provider+relation='exact' 无 external_kind 过滤——季 catalog 实务上只有 season exact 故安全，复用既有函数既有性质；若将来同 catalog 多 kind exact 共存需补 kind 约束。
- **已修（F4，LOW，META-53-F 本卡）**：季 catalog 降级 show 时也剔标题三件套（autoMatch else 分支，与 resolved 季路径一致，D-207-5）。

---

## [SEQ-20260618-01] 文档治理 T5（changelog 活跃段分段归档 · doc-governance 触发器 T5）

- **状态**：✅ 已完成（1/1 卡收口 2026-06-18；changelog 活跃段 6886 → 1805 行 / D-N 闭环零回退〔丢失 0 + 净新增识别 217〕 / verify 三件套零新增）
- **创建时间**：2026-06-18
- **最后更新时间**：2026-06-18
- **目标**：按 `docs/rules/doc-governance.md` 触发器 T5（活文档超限）执行 changelog 分段归档：活跃段 6886 行 > 4000 阈值，归档早段保留当前 milestone（META-24 / SEQ-20260613-01 起）。同步修复盘点中发现的历史债务：`scripts/verify-adr-d-numbers.mjs` 的 `CHANGELOG_ARCHIVES` 仅登记 1/3 段（漏 `M-SN-8-to-META` + `m0-m6`），违反 doc-governance §3 Step 2.4 强制项。
- **范围**：`docs/changelog.md` + 新建 `docs/archive/changelog/changelog_VSR-VIR_20260618.md` + `docs/README.md` + `scripts/verify-adr-d-numbers.mjs`（仅归档常量数组，零逻辑改动）。纯文档治理，零业务代码。本序列明确标注"更新文档"。
- **依赖**：无 BLOCKER；SEQ-20260610-02 剩余 2 卡时序阻塞中（非进行中），工作台可承接治理卡。
- **先例**：SEQ-20260610-01（CHORE-DOCS-CLEANUP-20260610，T1）/ SEQ-20260605-02（CHORE-DOCS-CLEANUP-20260605）同范式；本次为首次 T5（changelog 分段）触发。

### 任务列表

1. **CHORE-DOCS-CLEANUP-20260618** — changelog 活跃段分段归档 + 归档数组同步 + 索引更新（状态：✅ 已完成）
   - 创建时间：2026-06-18 ｜ 实际开始：2026-06-18 ｜ 完成时间：2026-06-18 18:30
   - 建议模型：haiku（机械分割 + 索引事务性）；实际主循环 claude-opus-4-8（用户会话人工覆盖）
   - 完成备注：明细见 changelog [CHORE-DOCS-CLEANUP-20260618]。① changelog 分段：切点行 5124（META-24 / SEQ-20260613-01 干净边界），归档 CHG-VSR-1 ~ CHORE-TEST-CPU-CONCURRENCY（行 43-5122）→ `docs/archive/changelog/changelog_VSR-VIR_20260618.md`；活跃段 6886 → 1805 行；行数守恒校验通过。② 历史债务修复：`CHANGELOG_ARCHIVES` 1 段 → 4 段（补漏 m0-m6 + M-SN-8-to-META，§3 Step 2.4 强制项）。③ 索引：changelog 头部归档说明 + README §1/§3.5 三段→四段对齐（同步修复 K1 冲突——changelog 头部此前漏列 M-SN-8-to-META）+ 两文件 last_reviewed 刷新。④ 验证：D-N 闭环零回退（丢失 0 / 净新增识别 217）+ verify:adr-contracts EXIT=0 + verify:docs-format 25 项〔与基线一致零新增〕 + R1/R2 四段引用零断链。未扩大到 designs/audit 归档判定（多数有活跃引用，属 T1 范围）。执行模型: claude-opus-4-8（建议 haiku，用户会话人工覆盖）；子代理: 无。

---

## SEQ-20260619-01 — image-health 页面重构 P1（IA + 概览强化 · 只消费现有端点）

- **状态**：🔄 进行中（2/5 — IMGH-P1-1 ✅ + IMGH-P1-2 ✅ 2026-06-19）
- **创建时间**：2026-06-19｜**最后更新**：2026-06-19
- **来源**：用户「阅读图片健康（image-health）页面重构方案报告，设计任务序列，开卡执行」。
- **设计真源**：`docs/designs/image-health-ux-handoff_20260618.md`（已两轮复审，§17.4 为收敛后权威分期）+ `docs/research/image-health-codebase-survey_20260619.md`（事实底座）。
- **范围裁定（P1 = 只消费现有 6 端点，零新 route / 零 schema / 零 ADR）**：候选应用、精确筛选、选中批量、自愈自动化、通知全部进 P2/P3。本序列**唯一新共享组件 = `ImageLightbox`**（P1-3，触发 Opus 子代理契约门禁）。
- **开卡前事实核验（本会话 Opus 亲验，纠正方案/调研若干假设）**：
  - ✅ admin-ui **已有** `KpiCard`/`Spark`/`Pill`/`Thumb`/`Segment`/`Drawer`/`Modal`（`packages/admin-ui/src/components/cell/` + `segment/` + `overlay/`，经 `export *` 间接导出）→ 方案 §11.1「复用」假设成立，P1-2「淘汰本地 ImageHealthKpiCard → 复用共享 KpiCard」是**复用非新建**。
  - ✅ 后端 `GET /admin/image-health/stats` **确返** `brokenTrend`（`apps/api/src/routes/admin/image-health.ts:48-52` `{ ...stats, brokenTrend }`）→ P1-2 趋势 Spark 数据可用。
  - ⚠️ 但 server-next DTO `lib/image-health/api.ts:20` 声明 `{ day, count }`，后端 `getBrokenEventsTrend`（`imageHealth.scan.ts:43`）实返 `{ date, count }`，**全链无转换层** → P1-2 若按 `point.day` 渲染 Spark 取 `undefined` 空白。P1-1 先对齐 DTO 为 `date`。
  - ⚠️ 现有 `POST /admin/image-health/rescan` 仅 `scope`（无 `videoIds`/`catalogIds`）→ P1 **不渲染**「选中后批量重扫」（否则误扫全局，§17.3.1）；批量留 P2 新增 ids 精确端点。
  - ⚠️ `/missing-videos` 仅支持 page/limit/sortField/sortDir，**无服务端筛选** → P1 治理表保留现分页/排序，**不做 filter chips**（否则前端过滤致 total 不一致，§17.3.2）；筛选留 P2 补服务端 query 后再接。
- **依赖序**：P1-1 →（地基）→ P1-2 →（IA 定型）→ P1-3 → P1-4 →（形态定型）→ P1-5。**P1-3/P1-4 硬串行**（Codex 审 OK→升级）：二者均改 `ImageHealthClient.tsx`（P1-3 wire Lightbox state / P1-4 wire 列 action + Modal 预填），并行必冲突。依赖链 5 层（advisory，纯文档 P1-5 末端不阻塞）。
- **模型策略**：P1-3 含**新共享组件 API 契约**（`ImageLightbox` Props）→ 强制 spawn arch-reviewer (Opus) 设计 + commit `Subagents:` trailer；建议 **opus 会话**。P1-1/P1-2/P1-4 标准 UI/契约对齐，建议 **sonnet 会话**；P1-5 纯文档，建议 **haiku（doc-janitor）**。

### 任务列表（5 卡，每卡范围 ≤ 5 项 / 验收口径唯一）

| 卡 | 内容 | 范围项 | 建议模型 | 依赖 | 门禁 |
|---|---|---|---|---|---|
| **IMGH-P1-1** ✅ | **事实/契约硬纠错（地基）**：① 手册 `P-image-health.md` 端点纠错（§0 `:18` + §3.1/3.3/3.4/3.6 全部 `/admin/images/*` → `/admin/image-health/*`，含真实子路径 stats/broken-domains/missing-videos）② rescan 参数 `mode` → `scope`（§3.1 `:57`）③ backfill 语义纠错（§3.2 `:65`「重新下载到 fallback CDN」→「仅入队探活/blurhash，不下载、不改 URL」）④ 枚举 `dead` → `broken`（§5 `:115-117` + §6 `:130`）⑤ `lib/image-health/api.ts:20` DTO `brokenTrend` 字段 `day` → `date`（对齐后端实返）。**额外**：§3.3 audit actionType `image.switch_fallback_domain`→`image_health.switch_domain`（同类硬错）。**已完成 2026-06-19**：typecheck/lint/test:changed 18/18 全过；零消费方断裂。执行模型: claude-opus-4-8（建议 sonnet，会话人工覆盖）；子代理: 无。详见 changelog [IMGH-P1-1] | 5 | sonnet | 无 | docs（任务明确「更新文档」）+ typecheck |
| **IMGH-P1-2** ✅ | **双 Tab IA + 共享 KPI/趋势**：① `Segment` + `?tab=` 双 Tab（健康概览 / 图片治理）置于 PageHeader 下 ② 淘汰本地 `ImageHealthKpiCard` → 复用共享 `KpiCard`（删 `ImageHealthKpiCard.tsx`；**Codex CONCERN 适配**：共享 KpiCard 无 `sub`/`data-testid` → `sub` 改 `value` 复合节点或 `delta` flat，`data-testid` 改 `testId`，同步测试断言）③ 接共享 `Spark` 渲染 7 日破损趋势（消费已对齐的 `brokenTrend.date`）④ Tab A 概览（KPI + 趋势 + TOP 域 + 破损样本）/ Tab B 治理（缺图 DataTable 保留现分页排序，**不做**选中批量 / 复杂筛选 / 候选列）。**已完成 2026-06-19**：`sub`→`delta` flat / `data-testid`→`testId` 适配；趋势双形态（KPI mini line spark + 独立 area 趋势卡）；测试 18→21（+next/navigation mock + 缺图表切治理 Tab + 双 Tab 切换/趋势用例）；image-health 34/34 + test:changed 21/21 全过。执行模型: claude-opus-4-8（建议 sonnet，会话人工覆盖）；子代理: 无。详见 changelog [IMGH-P1-2] | 4 | sonnet | P1-1 | 共享原语占比 ≥80% + 视图测试 ≥9 |
| **IMGH-P1-3** | **`ImageLightbox` 新共享组件 + 破损样本接入**：① `packages/admin-ui` 新建 `ImageLightbox`（放大遮罩 + 元信息面板）② `BrokenSamplesGrid` 缩略点击 → 打开 Lightbox。**元信息 P1 字段（Codex BLOCK 收敛，零后端改动）**：尺寸=客户端 `<img>` `naturalWidth×naturalHeight`（非后端 DTO）/ 来源 `posterSource` / 状态 pill `posterStatus` / 破损 `brokenDomain`+`occurrenceCount` / 原始 URL 可复制；**`event_type` 精确破损原因 DTO 缺失 → 推迟 P2**（连同服务端筛选 DTO 扩展）。**新共享组件 API 契约 → spawn arch-reviewer (Opus) 设计 Props + commit `Subagents:` trailer**。**测试/a11y（Codex CONCERN）**：组件测试覆盖 click-to-open / Escape 关闭 / 复制 URL / 焦点管理 / 尺寸未加载降级态 | 2（跨 admin-ui + server-next 2 层：新契约 + 接入属同一预览闭环） | **opus** | P1-2 | **Opus 子代理 + arch-reviewer PASS + Subagents trailer** + admin-ui 组件测试 |
| **IMGH-P1-4** | **TOP 域行内「切此域」+ 危险动作强化**：① `ImageHealthColumns` broken-domain 列加行内 action「切此域」→ 打开 `SwitchDomainModal` 预填 `fromDomain` ② Modal 默认 dry-run 预览（展示 affectedRows / affectedColumns / 三列 breakdown）③ 二次确认才启用执行按钮（warn/danger 语义，§17.3.4） | 3 | sonnet | P1-2 | 视图测试（dry-run → 二次确认流程断言） |
| **IMGH-P1-5** | **文档形态收尾**：① 手册 `P-image-health.md` §1/§2/§3 页面形态更新（双 Tab 布局 + Lightbox + 行内切此域 + dry-run 流程）② `W3-image-fallback.md` 工作流对齐 dry-run 二次确认 ③ frontmatter last_reviewed 刷新 | 3 | haiku | P1-2/P1-3/P1-4 | docs-only（doc-janitor） |

- **P1 范围红线（不得越界）**：零新 admin route / 零 schema 变更 / 零 ADR；不渲染无后端能力支撑的按钮（无死按钮，§13）；颜色零硬编码（design-tokens）；DataTable 用 v2 一体化（禁 v1 三件套）。
- **P1 不做（明确推迟）**：候选选图 / apply-candidate / resolveImageEvents 端点（P2）；服务端筛选 + filter chips（P2）；选中批量重扫（P2，需 ids 端点）；ImageGovernanceDrawer / ImageCompare / ImageCandidatePicker（P2）；**Lightbox `event_type` 精确破损原因元信息（需扩展 `/missing-videos` DTO+query，与 P2 服务端筛选 DTO 一起做，P2）**；分级自愈 / image_governance_status 推导 / Dashboard 真实端点 / 阈值告警（P3）。
- **Codex 对抗性审核（2026-06-19，落盘后/执行前，范围 ≥ 3 项必须）**：裁决 **NEEDS REVISION → 已修订消解**。
  - **BLOCK（P1-3）已消解**：ImageLightbox 元信息要的 `posterWidth/posterHeight`+`event_type` 现 `MissingVideoRow` DTO 无（`api.ts:29-38`）、query 未 SELECT（`imageHealth.ts:313-319`）→ 展示需扩展 response/query 跨 API 层，违 P1"纯前端"边界。**修订**：尺寸改客户端 `naturalWidth/Height`（零后端）；`event_type` 推迟 P2。P1-3 现真正零后端改动。
  - **CONCERN（P1-2 KpiCard 非 drop-in）已纳入**：`sub`/`data-testid` 适配点写入 P1-2 卡面。
  - **CONCERN（P1-3 测试/a11y 欠规格）已纳入**：组件测试清单写入 P1-3 门禁。
  - **OK→升级**：P1-3/P1-4 依赖序由"建议串行"升级"硬串行"。
  - **OK**：P1-1 day→date 无消费方断裂（codex grep 确认）；P1-4 零新 route（switch 端点已支持 dryRun+breakdown）。
  - 完整审核日志：codex exec read-only / 121K tokens / 2026-06-19。结论摘要同步 changelog [IMGH-P1-SEQ]。
