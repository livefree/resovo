# 视频身份解析与合并/拆分升级设计

> 版本：2026-06-02 修订版  
> 状态：设计蓝图，尚未进入实现  
> 范围：视频身份候选、合并/拆分评分、标题解析、catalog 身份层规划  
> 非范围：本文件不直接修改生产阈值，不新增端点，不修改 `normalizeTitle` / `normalizeMergeKey`

## 1. 背景

当前采集数据不完整、不准确，导致入库归并出现两类问题：

- 漏合并：同一作品因 year 缺失、type 被源站误标、标题混入噪声，导致 media_catalog 层 `(title_normalized, year, type)` 三元组不相等，现有 ADR-105 候选无法跨 year/type 召回。
- 误合并：同名、同年、同类型的不同作品被强制压入同一 catalog，缺少负向证据拦截。
- 标题噪声：版本标签、书名号、全半角、标点、多语种、分季/序号信息混入标题；现状更多是删除噪声，容易丢失身份信号。

目标是把“标准化标题 -> 单 key 命中即合并”升级为可解释的 Entity Resolution 流程：

1. Blocking 召回。
2. 多证据 Scoring。
3. 阈值分级 Decision。
4. 可逆审计和决策记忆。

落地顺序必须遵守：先旁路、再影响排序、最后才碰生产归并阈值。

## 2. 已确认产品决策

- 视频无论是否过审都可能需要合并/拆分，身份候选状态机独立于 `review_status` / `visibility_status`。
- 后台合并/拆分页与审核页“类似”tab 共用候选表和评分引擎，但入口、过滤条件和默认视图可以不同。
- edition（加长版、导剪版）归属实例层 `videos`。
- language_variant（国语、粤语、字幕）归属源层 `video_sources`。
- catalog 长期粒度统一为“按季”：同剧不同季是独立 catalog，由 `series_group` 或 `catalog_relations` 表达关联。
- 简繁不做字形归一：简体、繁体、港澳台译名作为并列 localized alias，不互相覆盖。

## 3. 红线与约束

- 禁改 `apps/api/src/services/TitleNormalizer.ts` 中 `normalizeTitle` / `normalizeMergeKey` 的现有语义。`core_title_key` 必须是新增并行 key，`title_normalized` 继续作为保守基线和外部匹配键。
- 禁引入技术栈外新依赖；不引入 OpenCC 等繁简转换依赖。
- 跨站源不合并。合并只发生在 video/catalog 层，`video_sources` 整体转移，不改 `(source_site_key, source_name)` 语义。
- 新增 admin 端点必须先起独立 ADR 并通过架构评审。
- schema 变更必须同步 `docs/architecture.md`。
- 实现必须走 `docs/tasks.md` 唯一入口和 `docs/task-queue.md` 排期。

## 4. 目标架构

### 4.1 四层标题模型

| 层 | 落点 | 说明 |
| --- | --- | --- |
| raw_title | `title_observations` | 源站原始标题，保留采集来源和观测时间 |
| display_title | `media_catalog.title` + locale fallback | 展示标题 |
| core_title_key | 新增并行 key | 确定性归一后的等值召回 key；不做繁简归一，不承诺字符模糊 |
| title_facets | 结构化解析产物 | `season_number` / `edition` / `language_variant` / `release_marker` / `quality_noise` / `source_noise` / `bracket_tokens` |

核心原则：season、edition、language_variant、序号等 token 解析保存，不直接删除。有些 token 只是源版本差异，有些会改变作品身份。

展示标题 fallback 必须确定性定义，避免不同页面展示不一致。默认链路：

```text
requested locale primary alias
  -> same language other region alias
  -> media_catalog.title
  -> title_original
  -> title_en
  -> raw observed title
```

示例：`zh-Hans` 缺失时可 fallback 到同语系 `zh-Hant` / `zh-HK` localized alias，但不得把简繁字形自动转换为同一 alias；只允许选择既有别名。

### 4.2 多证据评分

证据分三类：

- 强正：外部 exact ID 命中；外部别名命中且 year/type/country 不冲突；同源站 canonical id；多 source 指纹高度重叠。
- 中正：`core_title_key` 等值命中；year 相同或差 1；type 兼容；集数结构接近；cast/director/country/runtime/tags 接近。
- 强负：外部 ID 明确不同；season 不同；year 差大且无外部 exact ID；type 不兼容；集数模式冲突；标题序号/部数冲突。

强负命中时禁止自动合并，仅允许人工 override。

阈值为后台 KV 可配，但生产自动绑定在早期阶段默认关闭：

- `identityScore >= 0.92`：仅在允许自动绑定的阶段和场景生效。
- `0.75 <= identityScore < 0.92`：进入候选。
- `< 0.75`：不生成候选，除非人工搜索触发。
- 任一强负：禁止自动合并。

`core_title_key` 不是字符相似搜索。它只做确定性归一后的等值 blocking，B-tree 可承载；召回“变宽”来自多个 blocking key 取并集和 Scoring 层降权。如果未来需要编辑距离、相似度或 trigram 召回，必须另起 DB capability ADR，不得在本设计中隐式引入。

type 兼容矩阵必须在 ADR-105a 中定档，不能散落在调用方。初始建议以代码常量作为单一真源，后台 KV 只调阈值，不调矩阵结构：

| 关系 | 默认处理 |
| --- | --- |
| `anime` ↔ `series` | 兼容，中正；常见源站误标 |
| `movie` ↔ `short` | 弱兼容，仅人工候选；不自动合并 |
| `movie` ↔ `series` | 默认强负，除非强外部 exact ID 证明 |
| `variety` ↔ `series` / `anime` | 默认强负 |
| `other` ↔ 任何类型 | 低置信候选，禁止自动合并 |

### 4.3 候选对象与状态机

当前事实：ADR-105 的候选源不是 pair，而是 media_catalog 层 `(mc.title_normalized, mc.year, v.type)` 聚合出的 N-video 组。migration 029 已移除 `videos.year` 与 `videos.title_normalized`，候选查询通过 `videos.catalog_id` JOIN `media_catalog` 取 `mc.year` / `mc.title_normalized`。

Phase 1-4 的 UI 主对象分两层：

- Phase 2a：保持现有 N-video group，不改变候选数量、分页和默认排序。
- Phase 2b 起：`identity_candidate` 内部使用 video-pair 表示，便于幂等、决策记忆和 reject 复活链。

group 与 pair 的映射规则：

- group -> pair：对同一 N-video group 生成所有 unordered pair，或按 scorer pruning 后生成候选 pair。
- pair -> group：UI 聚合时按 `group_key` / shared catalog-key / connected components 折叠展示，避免把同一组拆成大量重复行。
- merge 执行仍允许 N -> 1，因为现有 mutation 接收 `sourceVideoIds[]` + `targetVideoId`。

catalog-catalog 合并不在此层实现。

新增 `identity_candidate`：

- `id`
- `left_video_id`
- `right_video_id`
- `canonical_pair_key`：有序 pair 规范键，例如 `min(video_id)|max(video_id)`。
- `status`：`pending` / `confirmed` / `rejected` / `superseded`。
- `parser_version`
- `scorer_version`
- `evidence_jsonb`
- `evidence_hash`
- `legacy_score`
- `identity_score`
- `strong_negative_reasons`
- `trigger_source`：`ingest` / `offline-rescore` / `manual-search`。
- `group_key`：可空；用于 Phase 2a 旧 N-video group 与 pair candidate 的折叠展示。
- `revived_from_candidate_id`
- `created_at`
- `updated_at`
- `superseded_by_candidate_id`

生命周期规则：

- 同一 `canonical_pair_key` 同一算法版本和 evidence hash 不重复生成 pending。
- 并发幂等必须靠 DB 约束保证：`UNIQUE(canonical_pair_key) WHERE status = 'pending'`，写入使用单事务 upsert；旧 pending -> `superseded` + 新建 pending 必须在同一事务完成。
- 元数据、版本或 evidence hash 变化时，旧 pending 置为 `superseded`，新建 pending。
- 人工 rejected 默认永久压制该 pair，避免反复召回。
- 如果出现新强正证据，例如新外部 exact ID，允许复活为候选。复活必须新建 pending，并通过 `revived_from_candidate_id` 指向原 rejected candidate；不得覆盖原 rejected 行。
- `evidence_hash` 输入域必须稳定定义，至少包含：normalized candidate pair、parser_version、scorer_version、blocking key 集合、参与评分的字段快照、外部引用摘要、强负原因、阈值配置版本。不得包含 `created_at`、job id、请求 id 等非证据字段。

新增 `identity_decisions` / `merge_blocklist`：

- 记录人工 confirmed/rejected/override。
- confirmed 后如果触发现有 video merge，必须关联 `video_merge_audit.id`。
- confirmed -> merge 优先同一 BEGIN/COMMIT 完成；如果必须两段式，decision 初始状态应为 `confirming`，回填 `video_merge_audit_id` 后才变为 `confirmed`，失败则回滚为 `pending` 或标记 `failed`。
- merge 回滚时，相关 decision 标记为 `reverted` 或记录 `reverted_at`，不得与 `video_merge_audit` 形成两套事实源。
- auto decision 的 actor 使用 system actor，并保留 job id / request id。

### 4.4 video merge 与 catalog identity 边界

video-pair 合并沿用现有 ADR-105 语义：

- 迁移 `video_sources` 到 target video。
- 软删除 source videos。
- 写入 `video_merge_audit`，用于强一致恢复。

catalog 身份解析后移到 Phase 5：

- catalog-catalog 合并。
- `catalog_external_refs` 映射真源。
- catalog 按季唯一键。
- `series_group` / `catalog_relations`。

edition 和 language_variant 只是字段归属决策，不改变 Phase 1-4 的合并对象层级。

### 4.5 catalog 粒度与关系

长期目标是 catalog 按季：

- 第二季、S2、Part2 是独立 catalog。
- 剧场版、SP、OVA 独立 catalog，避免误并入正季。
- `series_group` 或 `catalog_relations` 表达 `season_of` / `edition_of` / `remake_of` / `spinoff_of` / `same_work_candidate`。

硬阻塞：

- 当前无外部 ID catalog 有 `(title_normalized, year, type)` 唯一索引。
- 当前 `normalizeTitle` 会剥离季标记。
- 因此 Phase 5 前必须让 `season_number` 或不剥季的标题键进入 catalog 唯一约束，否则按季 catalog 无法落地。
- `media_catalog` 当前无 `deleted_at`，catalog-catalog 合并不能照搬 video soft delete 回滚。Phase 5 必须沿用迁移 084 的“删前全字段快照/可重建”范式，明确 catalog merge 的 restore snapshot、子表恢复顺序和外部 ref/cache 回滚规则。

### 4.6 外部 ID 映射真源

当前已存在 `video_external_refs`：

- migration 041 创建 video 级外部引用表，字段包括 `video_id` / `provider` / `external_id` / `match_status` / `match_method` / `confidence` / `is_primary`。
- migration 045 补了 `(video_id, provider, external_id)` 唯一索引。
- 该表表达“某个内部 video 与某个外部条目的匹配观测/确认/拒绝”，层级是 video，不是 catalog。

`catalog_external_refs` 是高影响重构，必须独立 ADR；在回答 `video_external_refs` 的替代/并存/上卷关系前，不得起草外部 ID 映射真源 ADR。

临时定向为“并存 + 上卷”，不得直接替代：

- `video_external_refs` 保留为 video 级观测、人工确认、候选和拒绝记录，服务审核、导入、采集链路。
- `catalog_external_refs` 仅承载 catalog 级 canonical 外部身份关系，服务 `findOrCreate`、catalog identity、series/season 粒度建模。
- 上卷规则必须显式定义：多个 video 的同 provider/external_id primary confirmed 一致时，才可建议生成 catalog exact ref；冲突时只生成 candidate，不自动上卷。
- video 级 rejected 不自动等价为 catalog 级 rejected；只有人工明确拒绝 catalog 绑定时才写 catalog 级 rejected。
- catalog 级 exact ref 建立后，可以反向辅助 video 级 candidate 排序，但不得覆盖 video 级人工 rejected。

目标字段：

- `id`
- `catalog_id`
- `provider`：`imdb` / `tmdb` / `douban` / `bangumi`
- `external_id`
- `external_kind`：`show` / `season` / `movie` / `subject` 等
- `relation`：`exact` / `parent` / `candidate` / `rejected`
- `season_number`
- `confidence`
- `source`：`auto` / `manual`
- `is_primary`
- 审计列

现有 `media_catalog.imdb_id` / `tmdb_id` / `douban_id` / `bangumi_subject_id` 降级为 cache：

- 只缓存 `relation = 'exact'` 且 `is_primary = true` 的 ref。
- `parent` / `candidate` / `rejected` 不回填 cache 列，避免 parent 一对多污染唯一列。
- 后续命中优先读 `catalog_external_refs`，cache 仅作读优化。

约束必须使用 partial unique indexes，不能写成一个全局 composite unique：

```sql
-- exact: 一个外部实体只能精确对应一个 catalog
CREATE UNIQUE INDEX uq_catalog_external_refs_exact
  ON catalog_external_refs (provider, external_id, external_kind)
  WHERE relation = 'exact';

-- 同一 catalog 不重复挂同一外部关系
CREATE UNIQUE INDEX uq_catalog_external_refs_catalog_relation
  ON catalog_external_refs (
    catalog_id,
    provider,
    external_id,
    external_kind,
    relation,
    COALESCE(season_number, -1)
  );
```

`parent` 允许一对多，例如一个 TMDB show parent 对应多个本地 season catalog。`candidate` / `rejected` 如果需要保留历史，需要额外 `decision_id` 或状态字段，避免唯一键压掉审计历史。

## 5. 分阶段实施路线

### Phase 0：设计定档

不写业务代码。

产出 4 份 ADR 草案，并通过架构评审：

1. ADR-105a：多证据评分、阈值分级、候选持久化、离线生成、性能模型。
2. 多语种标题模型：字段语义收紧、`media_catalog_aliases` 结构化升级、匹配分层。
3. catalog 按季粒度：`season_number` 唯一键、`series_group` / `catalog_relations`。
4. 外部 ID 映射真源预研：先定 `video_external_refs` 与 `catalog_external_refs` 的替代/并存/上卷关系；关系未定前不得起草正式外部 ID 映射真源 ADR。关系定档后再进入 `catalog_external_refs`、四列降级为 cache、现有数据迁移、ADR-174 Bangumi 重指向语义迁移。

必须同步 schema 草案到 `docs/architecture.md`。

### Phase 1a：纯函数 TitleIdentityParser

零生产行为变更，不落库。

新增：

- `apps/api/src/services/TitleIdentityParser.ts`
- `parseTitle(raw) -> { coreTitleKey, facets, titleKind, parserVersion, confidence }`

测试覆盖：

- 书名号、全半角、标点。
- 国语、粤语、字幕。
- 加长、导剪、SP、OVA、剧场版。
- 第 N 季、S2、Part2、序号。
- 源站噪声：更新至、全集、水印。

### Phase 1b：标题观测 shadow 写入

仍不参与合并决策。

新增 `title_observations` 时不能“每次采集快照”无限写，必须去重聚合：

- `video_id`
- `source_site_key`
- `source_name`
- `raw_title`
- `raw_title_hash`
- `parser_version`
- `parsed_facets_jsonb`
- `observed_count`
- `first_seen_at`
- `last_seen_at`

建议唯一键：

```sql
CREATE UNIQUE INDEX uq_title_observations_dedupe
  ON title_observations (
    video_id,
    COALESCE(source_site_key, ''),
    COALESCE(source_name, ''),
    raw_title_hash,
    parser_version
  );
```

### Phase 2a：现有候选附加 evidence

不改候选来源，不改默认排序口径，不扩大召回。

现有候选仍来自 media_catalog 层 `mc.title_normalized + mc.year + v.type` group by，返回 N-video group。新增 evidence 仅用于解释和人工判断。

类型字段必须拆开：

- `legacyScore`：现有 `source_overlap_ratio`，继续服务当前 `minScore` 和默认排序。
- `identityScore`：新多证据评分。
- `evidence`
- `blockingReasons`
- `strongNegativeReasons`

不得复用现有 `score` 字段承载新评分，避免 UI 和 API 语义漂移。

### Phase 2b：shadow 写入 identity_candidate

离线 job 使用 Blocking + Scoring 双跑，写入 `identity_candidate`，不切 UI 默认来源。

ADR-105a 必须定义 Blocking 性能模型：

- Blocking keys：
  - `core_title_key` 等值键
  - alias normalized key
  - 外部 ID
  - year band
  - type compatibility
  - source fingerprint
- 索引：
  - B-tree 覆盖高选择性 key。
  - JSONB/GIN 仅用于明确字段集合。
  - 不依赖 `pg_trgm`，除非另起 DB capability ADR。
- 重评触发：
  - video title/year/type 变化。
  - catalog alias 变化。
  - source 指纹变化。
  - external ref 变化。
  - parser/scorer version 升级。
- job：
  - cursor 分批。
  - batch size 可配。
  - 超时和失败重试。
  - 版本升级可全量重算。

### Phase 2c：切 UI 默认候选来源

`/admin/merge` 和审核页“类似”tab 默认读 `identity_candidate`。

旧实时 group by 继续保留为 fallback，直到 shadow 对比稳定。

自动合并阈值仍不启用。

### Phase 3：ingest-time shadow scoring

本阶段不改变 `catalog_id` 绑定，不开启模糊自动归并。

目标：

- 在 `MediaCatalogService.findOrCreate` 旁路计算“如果启用新评分会绑定哪个 catalog”。
- 记录 shadow decision 和 evidence。
- 对比现有 5 步匹配结果与新评分建议。
- 对于模糊结果，只写入 `identity_candidate`，不自动绑定 catalog。

允许的窄场景：

- 只有在强外部 exact ID 命中、无强负、且现有 5 步匹配本来也会命中的情况下，才允许与现有行为一致地绑定。
- 其他 `identityScore >= 0.92` 的结果也只进入 shadow 或 candidate，不直接改生产 catalog。

Phase 3 验收后，是否开启真实自动绑定必须另起 ADR 或作为 Phase 5 后置决策。

### Phase 4：拆分证据化与多语种清洗

- Phase 4 前必须另立排查卡修复既有 `insertNewVideo` schema 漂移：当前 split 新建 video 的 INSERT 路径仍可能引用已由 migration 029 下沉到 `media_catalog` 的 `year` / `title_normalized` 字段。该问题属于现有实现正确性修复，不并入身份解析设计。
- 拆分按 season、edition、core title、外部 ID、集数范围生成建议。
- 支持拆到已有 video、拆到新建 video。
- 拆分仍走现有 `video_merge_audit` 强一致审计。
- `title_en` 中的拼音/罗马音迁移到结构化 aliases。
- 回填 `original_language`。

### Phase 5：catalog 身份层

在 Phase 1-4 稳定后独立实施。

内容：

- 落地 `catalog_external_refs` 映射真源。
- 四个外部 ID 列降级为 cache。
- `findOrCreate` 改读映射表。
- catalog 唯一键纳入 `season_number` 或不剥季标题键。
- 落地 `series_group` / `catalog_relations`。
- 新增 catalog-catalog 合并能力。
- catalog-catalog 合并必须有 restore snapshot 和子表恢复协议；不得依赖 `deleted_at`。
- 评估是否开启真实自动 catalog 绑定。

## 6. 关键文件

- `apps/api/src/services/TitleNormalizer.ts`：只读，不改语义。
- `apps/api/src/services/TitleIdentityParser.ts`：Phase 1a 新增纯函数。
- `apps/api/src/services/MediaCatalogService.ts`：Phase 3 只做 shadow scoring，Phase 5 才允许改核心命中语义。
- `apps/api/src/services/VideoMergesService.ts`
- `apps/api/src/services/VideoMergesService.schemas.ts`
- `apps/api/src/db/queries/video-merge-candidates.ts`
- `apps/api/src/db/queries/video-merge-mutations.ts`
- `packages/types/src/video.types.ts`
- `packages/types/src/video-merge.types.ts`
- `docs/decisions.md`
- `docs/architecture.md`

## 7. 验证方式

每阶段必跑：

```bash
npm run typecheck
npm run lint
npm run test -- --run
```

涉及 admin 端点或页面时，补跑相关 e2e：

```bash
npm run test:e2e
```

阶段验收：

- Phase 1a：fixture 全绿，且 `normalizeTitle` / `normalizeMergeKey` 输出完全不变。
- Phase 1b：观测表去重生效，采集重复标题只增加 `observed_count`。
- Phase 2a：候选数量、分页、默认排序与旧逻辑一致；仅新增 evidence 字段。
- Phase 2b：shadow candidate 与旧候选对比有报表，能解释新增召回和误召回。
- Phase 2c：UI 切换可回退到旧实时 group by。
- Phase 3：shadow scoring 对照样本集输出 precision/recall，不改变生产 `catalog_id`。
- Phase 5：外部 ID 迁移前后 exact cache 与映射表一致；parent 一对多不污染 cache 列。

## 8. 风险与门禁

- `catalog_external_refs` 是高影响 schema 重构，必须独立 ADR，不得在 Phase 1-4 顺手实现。
- 外部 ID 映射真源 ADR 前必须先定 `video_external_refs` 与 `catalog_external_refs` 的替代/并存/上卷关系。
- `findOrCreate` 是采集入库核心归并点，Phase 3 只允许 shadow scoring，不允许模糊自动绑定。
- `identityScore` 与 `legacyScore` 必须分离，避免 API 字段语义漂移。
- `identity_decisions` 必须关联 `video_merge_audit`，避免候选决策和真实合并审计形成两套事实源。
- Blocking 必须先有性能模型和索引设计，不允许 pairwise 全量比较。
- title observation 必须去重聚合，不允许无限快照写入。
- `insertNewVideo` schema 漂移必须作为独立正确性排查卡先修，不得等 Phase 4 才暴露。

## 9. 审核记录

> 评审人：arch-reviewer（`claude-opus-4-8`）· 独立第二意见 · 只读
> 日期：2026-06-02 · agentId：a03af07288f8f2045
> 主循环：`claude-opus-4-8`（plan 模式发起，审核结论忠实落档，未擅改正文）

### 9.1 总体结论：CONDITIONAL

设计方向（Blocking → Scoring → 阈值分级 → 可逆审计 + 决策记忆）正确，Phase 化「先旁路 → 再排序 → 最后碰阈值」的克制路线与项目价值排序一致，红线意识（禁改 `normalizeTitle`、禁 pg_trgm、`identityScore`/`legacyScore` 分离、`identity_decisions` 关联 `video_merge_audit`）总体到位。但存在 3 条基于过时代码事实的红线问题，其中 R1、R2 会直接误导后续所有 Phase 的 ADR 起草，**必须在 Phase 0 定档前修复**。满足红线后可进入 Phase 0。

### 9.2 红线问题（必须修复才能进 Phase 0）

**R1 — 设计对既有 `video_external_refs` 表零认知，与 `catalog_external_refs` 关系未定义。**
- 证据：`migrations/041_video_external_refs.sql:9-37`（已存在 video 级外部引用表，含 `provider/external_id/match_status(auto_matched|manual_confirmed|candidate|rejected)/confidence/is_primary`）+ `045_fix_video_external_refs_unique.sql:9-10`。该表正是 ADR-174 D-174-3 冲突降级落点与 D-174-7 redirect 传播链消费方（`decisions.md` 约 18795/18806）。
- 问题：§4.6 全新提出的 `catalog_external_refs` 字段语义与现有 `video_external_refs` 高度重叠且层级不同（catalog 级 vs video 级），通篇未提既有表，等于规划一个与既有真源并存的第二外部引用表，违反价值排序 2（边界与复用）。
- 建议：外部 ID 映射真源 ADR 必须显式回答「替代 / 并存 / 上卷」关系、D-174-3 现有写 `video_external_refs` candidate 路径如何迁移、两表 `candidate/rejected` 审计是否合并。**在此澄清前不得起草该 ADR。**

**R2 — 候选来源/硬阻塞的事实基础已被 migration 029 推翻。**
- 证据：`029_videos_drop_metadata_fields.sql:48,57` 已 `DROP COLUMN videos.year` 与 `videos.title_normalized`；候选 GROUP BY 现为 `mc.title_normalized, mc.year, v.type`（`video-merge-candidates.ts:61,88`，JOIN `media_catalog`）；`uq_catalog_title_year_type` 建在 `media_catalog`（`026:85-90`）。
- 问题：§1（line 12）、§2a（line 253）把候选源隐含为「videos 表 title_normalized+year+type」错误——year/title_normalized 已归属 catalog 层。衍生矛盾：§4.3「候选对象固定 video-pair」声称「与现有 video-level 合并一致」，但现有候选是 catalog-key 聚合的 **N-video 组**（`fetchRawCandidateGroups` 返回 `video_ids[]`，merge 接受 `sourceVideoIds[]` 多对一），非 pair；拆 pair 会改变枚举语义与 §2a「候选数量/排序不变」冲突。
- 建议：(a) 全文候选源/唯一键主体更正为 `media_catalog`；(b) §4.3 明确 Phase 2a 保持「N-video catalog 组」对象不变，video-pair 仅作 Phase 2b 离线 `identity_candidate` 内部表示，并给出 group↔pair 展开/折叠映射。

**R3 — `core_title_key`「弱召回模糊匹配」与「不依赖 pg_trgm + B-tree 等值索引」矛盾。**
- 证据：全库无 pg_trgm 扩展（migrations grep 零命中）；§4.1 line 51 称「弱召回 key」、§4.2 line 61 称「相同」算中正、§2b line 280 索引为「B-tree」「不依赖 pg_trgm」。
- 问题：B-tree 只支持等值/前缀，「core_title_key 相同」是等值（强召回），非模糊。真正字符模糊召回在禁 pg_trgm + 禁新依赖下 B-tree 无法承载，措辞自相矛盾。
- 建议：ADR-105a 明确 core_title_key 为**确定性归一后等值匹配**（B-tree 可承载），模糊性收敛到「多 blocking key 取并集 + Scoring 层降权」；如确需字符相似召回须另起 DB capability ADR（§2b line 281 已留口，但 §4.1/§4.2 措辞需同步收紧）。

### 9.3 黄线问题（对应 Phase 前澄清）

- **Y1（Phase 2b 前）** `identity_candidate` 并发 upsert 幂等缺约束：§4.3 line 98 仅规则描述无唯一约束。建议 partial unique index `(canonical_pair_key) WHERE status='pending'`，并明确「旧 pending→superseded + 新建」单事务完成，参 `MediaCatalogService.ts:159-186` 的 `ON CONFLICT DO NOTHING + 重查收敛`。
- **Y2（Phase 2b 前）** `rejected` 复活与 `superseded` 边界：复活复用同 canonical_pair_key 会撞 Y1 约束。建议复活 = 新建 pending + `revived_from_candidate_id` 指针 + 保留原 rejected 行，避免审计断链。
- **Y3（Phase 2c/3 前）** confirmed→video merge 跨表事务边界：现 merge 是独立事务（`VideoMergesService.ts:201-224`）。建议 confirmed decision 与 merge 同一 BEGIN/COMMIT，或两段式回填 `video_merge_audit.id`（参 split `updateAuditTargetIds` `VideoMergesService.ts:387-410`），消除双事实源。
- **Y4（Phase 1a/4 前）** 强负「序号/部数冲突」与 facets 对齐：现 `normalizeTitle` 剥离 `Part N/Vol.N/第N季`（`TitleNormalizer.ts:30-39`）。强负过激比漏判更危险（直接 block 所有自动合并）。fixture 必须覆盖「序号是身份（复仇者联盟4）vs 序号是季/卷（第4季）」，强负仅在「同 core_title_key + 序号不同」时生效。
- **Y5（Phase 2b 前）** 版本升级全量重算成本未量化：评分转离线后 ADR-105 p95≤200ms 基线对象变了。建议 ADR-105a 声明「实时端点 p95 继承 ADR-105，离线 job 另立时长/吞吐基线」，定义重算期间候选可见性（双写 + version 过滤读）。

### 9.4 未决项 / 需补充设计

1. **`display_title` locale fallback 规则缺失**：§4.1 仅写「locale 选择策略」，无 fallback 链（zh-Hans 缺→zh-Hant→original→en→raw）。多语种标题模型 ADR 须给确定性规则。
2. **type 兼容矩阵未定义**：§4.2 反复引用「type 兼容/不兼容」，但矩阵内容、存放位置（KV/常量/DB）、维护责任人缺失。ADR-105a 须锁定。
3. **`insertNewVideo` 既有 schema 漂移**（范围外但 Phase 4 必踩）：`video-merge-mutations.ts:299-310` 仍 `INSERT INTO videos (... year, title_normalized ...)`，而 029 已 DROP。建议另立独立排查卡。
4. **`media_catalog` 无 `deleted_at`**（ADR-174 R4）→ Phase 5 catalog-catalog 合并可回滚性须沿用 084 迁移「删前全字段快照」范式，catalog 按季 ADR 补回滚边界继承。
5. **`evidence_hash` 输入域定义缺失**：决定「重复生成」与「复活」的核心，哪些字段进 hash（含 scorer_version？year band 边界？）未定义，直接影响 Phase 2b 幂等正确性。

### 9.5 认可的设计点（已稳健，避免返工）

- `core_title_key` 作新增并行 key、`title_normalized` 保留为外部匹配键基线（§3 line 36）：与 `TitleNormalizer.ts:81-85`「勿改语义」及 ADR-174 D-174-1 对齐，META-22/ADR-174 不被违反（前提 R3 收紧后不引入字符模糊）。
- `legacyScore`/`identityScore` 分离、禁复用 `score`（§2a line 263 / §8 line 386）：正确防止 `computeOverlapScore`（`VideoMergesService.schemas.ts:71-90`）的 `source_overlap_ratio` 语义漂移。
- 跨站源不合并、`video_sources` 整体转移（§3 line 38）：严格延续 ADR-114-NEGATED，与 `transferSourcesToTarget`（仅 UPDATE video_id）一致。
- 拆分仍走 `video_merge_audit` 强一致审计（§4.4 / Phase 4）：复用既有 snapshot/unmerge 范式（`VideoMergesService.ts:325-433`）。
- Phase 间依赖顺序正确：Phase 3「不改 catalog_id、仅强 exact ID + 无强负 + 与现有 5 步一致才绑定」与 `findOrCreate` 5 步（`MediaCatalogService.ts:106-193`）兼容，真源切换留 Phase 5，无隐藏耦合（修正 R2 group/pair 表述后成立）。
- `title_observations` 强制去重聚合 + 唯一键（§1b line 239-247）：正确规避无限快照，`COALESCE` 处理 nullable 字段，SQL 形式正确。
- §4.6 partial unique index SQL（line 169-183）形式正确，且明确 `candidate/rejected` 需额外 `decision_id` 防审计被压——但落地受 R1 阻塞。

### 9.6 主循环处置

- 审核结论 CONDITIONAL：R1–R3 为进入 Phase 0 的前置条件，**Phase 0 起草 4 份 ADR 前须先据 R1（与 `video_external_refs` 关系）、R2（候选源/唯一键主体更正为 catalog 层 + group/pair 语义澄清）、R3（core_title_key 等值召回措辞收紧）修订本文正文对应章节**。
- Y1–Y5 在各自对应 Phase 起草 ADR 时澄清；未决项 1–2、4–5 并入对应 ADR；未决项 3（`insertNewVideo` schema 漂移）另立独立排查卡，不并入本设计。
- 本文档作为设计蓝图保留；正文修订与 ADR 起草仍走 `docs/tasks.md` 唯一入口 + task-queue 排期。

## 10. 正文修订处置

> 日期：2026-06-02  
> 处置：根据 §9 审核结论修正文档正文，未改动代码。

- R1 已吸收：§4.6 补充既有 `video_external_refs` 现状，明确临时定向为“并存 + 上卷”，并规定未先定替代/并存/上卷关系前不得起草正式外部 ID 映射真源 ADR。
- R2 已吸收：§1、§4.3、§5 Phase 2a 更正候选事实为 media_catalog 层 `mc.title_normalized + mc.year + v.type` N-video group；Phase 2a 保持 group，Phase 2b 起 `identity_candidate` 内部用 pair，并补 group↔pair 展开/折叠规则。
- R3 已吸收：§4.1、§4.2、§5 Phase 2b 将 `core_title_key` 收紧为确定性归一后的等值 blocking key；字符模糊召回需另起 DB capability ADR。
- Y1–Y3 已吸收：§4.3 补并发幂等 partial unique、rejected 复活链、`evidence_hash` 输入域、confirmed -> merge 事务边界。
- 未决项 1–2、4–5 已吸收：§4.1 补 locale fallback；§4.2 补 type 兼容矩阵定档要求；§4.5/Phase 5 补 catalog 无 `deleted_at` 的 restore snapshot 范式；§4.3 补 evidence hash 输入域。
- 未决项 3 已吸收为门禁：Phase 4 前必须另立 `insertNewVideo` schema 漂移排查卡，作为现有实现正确性修复，不并入身份解析设计。
- Y4–Y5 本次不吸收正文，按 §9.6 原则留至对应 Phase 起草 ADR 时澄清，已在 §9.3 留痕不丢失：
  - Y4（Phase 1a/4）：强负「序号/部数冲突」护栏——仅在同 `core_title_key` + 序号不同时生效，fixture 须区分「序号即作品身份（复仇者联盟 4）」与「序号即季/卷（第 4 季）」，避免误杀反向加剧漏合并。
  - Y5（Phase 2b）：评分转离线后性能基线对象切换——实时端点继承 ADR-105 的 p95≤200ms、离线 job 另立时长/吞吐基线，并定义重算期间候选可见性（双写 + version 过滤读）。
