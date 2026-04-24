# 外部基础元数据导入方案（TMDB / Bangumi）

> status: archived
> owner: @engineering
> scope: external metadata ingest and protection
> source_of_truth: no
> supersedes: none
> superseded_by: docs/task-queue.md
> last_reviewed: 2026-04-24

---

## 1. 背景

当前项目已接入站点采集链路，`videos` 表不仅承载标题、简介、封面等基础信息，还承载：

- 内容治理字段：`review_status`、`visibility_status`、`needs_manual_review`
- 类型归一字段：`type`、`source_category`、`genre`、`normalized_type`
- 元数据优先级字段：`metadata_source`
- 归并去重字段：`title_normalized`

因此，`videos` 已经是平台内容主表，而不是单纯的“外部元数据落地表”。

本次新增的外部数据来源包括：

- TMDB 电影 CSV 数据
- Bangumi dump（`subject.jsonlines`、`episode.jsonlines` 等）

目标不是把这两份数据直接灌入主表，而是设计一套安全的导入与匹配方案，用于：

- 提升影视条目基础信息质量
- 为后续采集归并、纠偏、人工审核提供参考
- 防止后续爬虫或低优先级来源反向污染基础元数据

---

## 2. 已验证的数据现状

### 2.1 TMDB 数据

TMDB 当前文件：

- `external-db/tmdb/[124万]TMDB电影元数据.csv`

已验证样本字段包括：

- `id`
- `title`
- `original_title`
- `imdb_id`
- `release_date`
- `runtime`
- `adult`
- `poster_path`
- `overview`
- `genres`
- `production_countries`
- `spoken_languages`

样本观察结论：

- 字段结构稳定，适合作为高质量基础电影元数据源
- `id` 与 `imdb_id` 可作为稳定外部标识
- 仅覆盖电影，不适合作为剧集 / 动漫统一来源
- 存在少量缺失值，尤其是 `imdb_id`、`release_date`
- `adult` 字段需要纳入内容风险控制，不应直接映射为公开内容

结论：

- TMDB 与现有 `videos` 主体字段兼容度高
- 适合优先支持 `movie`
- 不适合直接批量写入现有主表

### 2.2 Bangumi 数据

Bangumi 当前目录：

- `external-db/bangumi/Bangumi-dump-2025-06-24.210345Z`

已验证文件包括：

- `subject.jsonlines`
- `episode.jsonlines`
- `subject-relations.jsonlines`
- `subject-persons.jsonlines`
- `subject-characters.jsonlines`

样本观察结论：

- `subject.jsonlines` 的主键结构清晰，`id` 稳定
- `episode.jsonlines` 可用于补充集数、标题、播出日期
- `subject.type` 并非纯影视类型，包含小说、动画、音乐、游戏、三次元
- `infobox` 为 wiki 模板文本，不能直接映射到规范字段
- `name`、`name_cn`、`tags`、`summary` 适合作为标题别名与辅助匹配输入

当前 `subject.type` 分布样本统计：

- `1`: 342404
- `2`: 26862
- `3`: 88689
- `4`: 72367
- `6`: 22498

结合样本判断：

- `type=2` 可视为动画条目，适合映射为 `anime`
- `type=6` 包含三次元影视条目，可作为 `series` 候选来源
- `type=1/3/4` 不应直接进入当前 `videos` 体系

结论：

- Bangumi 兼容度为“部分兼容”
- 首期只适合导入影视相关子集，而不是全量主条目
- 不能直接把 Bangumi dump 当作平台内容主表来源

---

## 3. 现有数据库兼容性判断

### 3.1 为什么不能直接导入 `videos`

直接把 TMDB / Bangumi 写入 `videos` 会产生以下问题：

1. `videos` 是平台内容实体，不是纯外部元数据实体
2. 主表默认服务于“可治理内容”，而不是“所有外部候选条目”
3. 大量外部条目没有播放源，会制造空壳内容
4. Bangumi 含大量非影视条目，会污染内容域模型
5. 后续采集可能对主表产生反向覆盖风险

因此，外部数据应先进入独立层，再通过匹配关联影响主表。

### 3.2 当前主表中可复用的能力

现有数据库设计中，以下能力可直接复用：

- `metadata_source`：记录元数据来源优先级
- `title_normalized`：归并匹配键
- `video_aliases`：存放别名
- `(title_normalized, year, type)`：已有归并策略
- `review_status` / `visibility_status`：治理层状态控制

这意味着新方案不需要重建整套内容治理，只需要把“外部元数据层”加在主表之前。

---

## 4. 总体方案

推荐采用三层结构：

1. 原始导入层：保存外部文件的原始数据与批次信息
2. 规范化目录层：保存清洗后的外部作品实体
3. 关联映射层：把外部作品与内部 `videos` 做解耦绑定

原则：

- 外部数据先落独立表，不直接进入 `videos`
- 只有命中匹配并通过策略校验后，才允许有限回填到主表
- 播放源采集与基础元数据回填分开治理

---

## 5. 建议的数据模型

### 5.1 原始导入层

建议新增：

- `external_import_batches`
- `external_tmdb_movies_raw`
- `external_bangumi_subjects_raw`
- `external_bangumi_episodes_raw`

#### `external_import_batches`

建议字段：

- `id`
- `provider`：`tmdb` / `bangumi`
- `dataset_name`
- `source_path`
- `source_checksum`
- `imported_at`
- `row_count`
- `status`
- `notes`

用途：

- 记录每次导入的批次
- 支持版本追踪、回溯和重建
- 避免后续覆盖时失去来源证据

#### `external_tmdb_movies_raw`

建议字段：

- `batch_id`
- `provider_item_id`
- `title`
- `original_title`
- `release_date`
- `runtime`
- `adult`
- `imdb_id`
- `poster_path`
- `overview`
- `genres_raw`
- `countries_raw`
- `languages_raw`
- `raw_payload`

#### `external_bangumi_subjects_raw`

建议字段：

- `batch_id`
- `provider_item_id`
- `subject_type`
- `name`
- `name_cn`
- `date`
- `platform`
- `summary`
- `infobox`
- `tags_raw`
- `meta_tags_raw`
- `raw_payload`

#### `external_bangumi_episodes_raw`

建议字段：

- `batch_id`
- `provider_item_id`
- `subject_id`
- `sort`
- `name`
- `name_cn`
- `airdate`
- `duration`
- `episode_type`
- `raw_payload`

说明：

- raw 表保留原始字段和 `raw_payload jsonb`
- 不在 raw 表做复杂业务映射
- 首要目标是可追溯，而不是“立刻可用”

### 5.2 规范化目录层

建议新增：

- `external_works`
- `external_work_aliases`
- `external_work_episodes`

#### `external_works`

建议字段：

- `id`
- `provider`
- `provider_item_id`
- `media_type`
- `canonical_title`
- `original_title`
- `title_normalized`
- `year`
- `description`
- `cover_url`
- `rating`
- `rating_count`
- `runtime_minutes`
- `country`
- `language`
- `episode_count`
- `content_rating`
- `external_ids jsonb`
- `source_batch_id`
- `raw_ref`
- `created_at`
- `updated_at`

用途：

- 作为统一的外部作品目录
- 屏蔽 provider 差异
- 为匹配、审核、补录提供稳定实体

#### `external_work_aliases`

建议字段：

- `external_work_id`
- `alias`
- `alias_normalized`
- `alias_type`

用途：

- 保留 `title`、`original_title`、`name_cn`、别名、标签派生名
- 提高中英文、别名、繁简体匹配命中率

#### `external_work_episodes`

建议字段：

- `external_work_id`
- `season_number`
- `episode_number`
- `episode_title`
- `episode_title_local`
- `air_date`
- `runtime_minutes`
- `provider_episode_id`

用途：

- 用于未来补足剧集信息
- 不直接进入 `video_sources`

### 5.3 内外部关联层

建议新增：

- `video_external_refs`

建议字段：

- `id`
- `video_id`
- `provider`
- `provider_item_id`
- `external_work_id`
- `match_status`
- `match_method`
- `confidence`
- `is_primary`
- `linked_by`
- `linked_at`
- `notes`

其中：

- `match_status`：`auto_matched` / `manual_confirmed` / `rejected`
- `match_method`：`imdb_id` / `title_year_type` / `alias_year_type` / `manual`

用途：

- 明确外部条目与内部主内容的关系
- 支持人工确认
- 支持一个内部视频绑定多个外部来源

---

## 6. 首期导入范围

### 6.1 TMDB

首期建议：

- 只导入电影
- 只进入 `external_tmdb_movies_raw` 和 `external_works`
- 不直接批量写 `videos`

理由：

- 数据质量高
- 结构稳定
- 与现有 `movie` 模型最兼容
- 可通过 `imdb_id` 提供高置信匹配

### 6.2 Bangumi

首期建议：

- 只导入 `subject.type = 2` 的动画条目
- `subject.type = 6` 先进入候选池，不自动进入正式补录链路
- 其他类型仅保留 raw，不进入规范化影视目录

理由：

- `type = 2` 与 `anime` 明确对应
- `type = 6` 包含真实影视内容，但噪音比动画更高
- 一次性引入全部类型会冲击现有影视模型边界

---

## 7. 导入流程设计

### 7.1 阶段一：原始导入

目标：

- 文件入库
- 批次登记
- 基础格式验证

验证内容：

- TMDB CSV 头部字段校验
- 日期、数字、布尔值格式校验
- Bangumi JSON Lines 每行可解析
- `episode.subject_id` 能关联到 `subject.id`

此阶段不做：

- 主表写入
- 自动创建 `videos`
- 自动覆盖现有内容

### 7.2 阶段二：规范化转换

目标：

- 把 raw 数据转换为 provider 无关的 `external_works`
- 建立别名和剧集信息

TMDB 规范化规则建议：

- `provider = 'tmdb'`
- `provider_item_id = tmdb.id`
- `media_type = 'movie'`
- `canonical_title = title`
- `original_title = original_title`
- `year = release_date` 提取年份
- `cover_url = poster_path` 拼接完整图片地址
- `external_ids.imdb_id = imdb_id`
- `content_rating` 不直接取 `adult` 为平台结论，而是映射为风险提示

Bangumi 规范化规则建议：

- `provider = 'bangumi'`
- `provider_item_id = subject.id`
- `canonical_title` 优先 `name_cn`，其次 `name`
- `original_title = name`
- `media_type` 仅在白名单类型内映射
- `episode_count` 从 `episode` 数据汇总
- `infobox` 原文保留，不直接拆主字段

### 7.3 阶段三：匹配关联

目标：

- 建立 `external_works` 与 `videos` 的关联
- 不直接修改主表，仅产出候选关系

建议匹配优先级：

1. 外部 ID 精确匹配
2. `title_normalized + year + type`
3. 别名 + 年份 + 类型
4. 人工确认

TMDB 建议：

- 若未来引入 `tmdb_id` / `imdb_id` 到主内容侧，应优先用 ID 精确匹配
- 在未引入前，可先使用 `title_normalized + year + movie`

Bangumi 建议：

- 优先用 `name_cn/name` 生成 alias 候选
- 只对 `anime` / `series` 执行
- 不对低置信标题自动绑定

### 7.4 阶段四：受控回填

目标：

- 只把“明确更优的基础字段”回填给已关联的 `videos`

建议允许回填的字段：

- `title_en`
- `description`
- `cover_url`
- `rating`
- `year`
- `director`
- `cast`
- `writers`
- `genre`

建议暂不自动回填的字段：

- `type`
- `visibility_status`
- `review_status`
- `site_key`
- `episode_count`（除非规则明确）

原则：

- 外部元数据只补“基础信息”
- 不介入平台治理字段
- 不改变播放源归属逻辑

---

## 8. 防止后期采集覆盖基础数据

### 8.1 问题

虽然当前采集逻辑已经约定：

- `tmdb > douban > manual > crawler`
- `crawler` 不覆盖更高优先级元数据

但这仍然是“记录级”规则，不是“字段级”规则。

风险包括：

- 采集器补录时错误更新封面或简介
- 不同来源在不同字段上质量不同
- 手工修订字段可能被下一轮同步误伤

### 8.2 建议新增字段级来源追踪

建议新增：

- `video_metadata_provenance`

建议字段：

- `id`
- `video_id`
- `field_name`
- `source_kind`
- `source_ref`
- `source_priority`
- `updated_at`

用途：

- 记录每个基础字段最后一次由谁写入
- 为冲突判定和审核提供依据

### 8.3 建议新增字段级锁

建议新增：

- `video_metadata_locks`

建议字段：

- `id`
- `video_id`
- `field_name`
- `lock_mode`
- `locked_by`
- `locked_at`
- `reason`

其中：

- `lock_mode = 'soft'`：仅允许更高优先级来源覆盖
- `lock_mode = 'hard'`：任何自动流程不得覆盖

### 8.4 覆盖规则

建议统一使用以下策略：

1. 人工锁定字段永不被自动流程覆盖
2. 高优先级来源可覆盖低优先级来源
3. 低优先级来源不得覆盖高优先级来源
4. 爬虫可继续补播放源，但不得改已锁定的基础元数据字段

建议优先级：

- `manual`
- `tmdb`
- `bangumi`
- `douban`
- `crawler`

说明：

- 该优先级是建议值，不要求与当前 `metadata_source` 枚举完全同构
- `metadata_source` 可继续作为“记录级主来源”
- `video_metadata_provenance` 用于“字段级实际来源”

---

## 9. 推荐的首版实施边界

首版仅建议做到以下范围：

1. 建立 raw 层、catalog 层、关联层
2. 支持 TMDB 电影导入
3. 支持 Bangumi 动画条目导入
4. 生成自动匹配候选，不自动创建 `videos`
5. 对已匹配视频提供“可审核的回填候选”
6. 设计字段级 provenance / lock，但可分后续迭代落地

首版不建议做：

- 全量 Bangumi 类型入库
- 外部数据自动创建主内容
- 自动重写 `type`、`visibility_status`、`review_status`
- 用 Bangumi `infobox` 直接回填结构化主字段
- 用外部剧集信息自动生成播放源

---

## 10. 最终建议

最终建议如下：

- 不把 TMDB / Bangumi 直接作为 `videos` 的首层写入源
- 先建设“外部元数据中间层”
- 通过匹配关联影响主内容，而不是直接替代主内容
- TMDB 首期只做电影
- Bangumi 首期只做动画，三次元内容先作为候选
- 在正式回填主表前，引入字段级来源追踪与锁机制

该方案可以保证：

- 主表不被外部大体量数据污染
- 采集链路继续以播放源补充为主
- 基础信息回填有边界、有优先级、有追溯
- 后续可以逐步扩展到更多外部来源，而不需要重构主内容模型
