# image-health 重构 — 代码现状调研纪要

> 用途：为 `/admin/image-health` 页面重构（P1–P3）提供经核验的代码事实底座，供后续任务卡 / 子代理直接引用，避免重复研究。
> 方法：5 个只读子代理并行 fan-out（架构分层 / 规范+admin-ui / image-health 链路 / 元数据图片候选 / 工作流门禁）+ 主循环亲自裁决矛盾点。
> 撰写：2026-06-19 ｜ 代码基线：`dev` 分支 ｜ 配套设计稿：`docs/designs/image-health-ux-handoff_20260618.md`
> 标注约定：✅ 已证实（附 `文件:行号`）｜ ⚠️ 已纠正（推翻先前结论）｜ ❓ 待核实（未亲验，仅子代理单源）

---

## 0. 事实校正表（最高优先级 — 先看这里）

设计稿 `image-health-ux-handoff_20260618.md` 与第一轮审核存在若干出入，逐条钉死如下。

### 0.1 ⚠️ 重大纠正：图片候选**确实写入** `metadata_field_proposals`

第一轮审核曾判定「图片候选未写入 proposals → §7/§8 前提崩塌（致命）」。**该结论错误，已撤回。** 根因：第一轮对 `reconcile.canonical.ts` 的一次读取损坏（输出混入 `file content` 占位符、行号错乱），据此误判白名单只含 5 标量。主循环重读全文定论：

- ✅ `reconcile.canonical.ts:31-42` `RECONCILE_GROUPS` **包含图片三组**：
  - `:39` `{ main: 'coverUrl', fields: ['coverUrl','posterStatus','posterSource','posterWidth','posterHeight'] }`
  - `:40` `{ main: 'backdropUrl', fields: ['backdropUrl','backdropStatus'] }`
  - `:41` `{ main: 'logoUrl', fields: ['logoUrl','logoStatus'] }`
  - `:29` 注释原文："图片三组（cover/backdrop/logo）辅字段随主字段整组写。"
- ✅ 唯一写入路径：`reconcile.ts:189 batchUpsertFieldProposals`（全仓仅此一处业务调用 + 定义 + 单测 mock 三处）。
- ✅ 单测佐证：`tests/unit/api/metadataReconcile.test.ts:67-72` 验证图片字段全进白名单（`passthroughFields` 为空）。

**结论**：设计稿 §7.1「图片候选已写入 proposals、是从外部源补图的现成数据底座」**基本成立**。§12.2 把 candidates/apply-candidate 列为「复用现有 proposals 的轻量增量」**合理**（第一轮「严重低估」的批评一并撤回）。

### 0.2 ✅ 但保留一处真实落差：TMDB 同源多候选**不持久化**

- ✅ `TmdbConfirmService.ts` `pickBestImage`（约 :220-272）只按语言/vote 选**最优一张**写入；`images.posters[]` 其余备选**不进 proposals**。
- 影响：proposals 能给**跨源**候选（tmdb 最优 / douban / bangumi 各一行），给不出"tmdb 的 N 张里再挑一张"。
- 缓解：后者需用 `catalog_external_refs` 的 tmdb_id **实时重搜 TMDB**——设计稿 §7.2 已提到此 fallback，方向正确。
- 读接口缺口：现有 `getFieldProposalsByCatalogId`（全字段读）+ `getConflictFieldsByCatalogIds`（冲突读）；缺按字段过滤的 `getFieldProposalsByField(catalogId,'coverUrl')` —— 小增量。

### 0.3 ✅ 已证实成立的设计稿断言（第一轮已对，复核确认）

- ✅ 端点路径与行为（rescan 重置 poster→pending_review 且要求 cover_url NOT NULL 只动 poster / switch 三列 `'://'+domain+'/'` REPLACE、dryRun 仅 COUNT / backfill 仅入队不下载不改 URL）：`imageHealth.scan.ts` + `image-health.ts` 一致。
- ✅ worker 无自动换源：`imageHealthWorker.ts` 仅标 broken + 写事件；`imageBackfillWorker.ts` 仅入队。
- ✅ schema 枚举（poster/logo/banner status、`image_governance_status` 4 态、`event_type` 8 值、`poster_source`）：与 `048_image_pipeline.sql` 逐字一致。
- ✅ `resolveImageEvents` 已存在仅缺路由（`imageHealth.scan.ts:161`）；dashboard attentions 是 mock；前台上报链路 `reportBrokenImage → sendBeacon → /internal/image-broken` 成立。

### 0.4 ⚠️ 仍成立的几处偏差（设计稿需修，第一轮判断保留）

- ⚠️ **`brokenTrend` 字段名契约偏差（方向更正）**：后端 `getBrokenEventsTrend` 虽 SQL 别名 `AS day`，但函数 `imageHealth.scan.ts:43` 实际 `push({ date, count })` —— 返回字段是 **`date`**（`AS day` 仅用于第 36 行内部 Map）；route `image-health.ts:48-52` 原样透传不重命名 → **线上 JSON 字段是 `date`**。`BrokenTrendPoint.date`（`scan.ts:11`）声明**正确**；反而 server-next DTO `api.ts:20` 写 `day` 是错的，且全链无转换层。**净结果：后端实返 `date`、DTO 误标 `day`，二者不一致**——P1 若按 DTO 用 `point.day` 会取 `undefined`、趋势 Spark 空白。修法：DTO 对齐 `date`（或路由层重命名 `day`）。（订正：先前"实际返回 `day`、二者一致"结论方向反了，已纠正。）
- ⚠️ **§6.3「PUT images + 审计」措辞**：`videoImages.ts` PUT **无 `insertAuditLog`**，仅 `updated_at`；§3.1 表格已诚实标注"经 updated_at"，§6.3 措辞应改。
- ⚠️ **§3.3 文档纠错清单经复核全部成立（订正先前误判）**：第 2 条端点纠错**有效**——手册 `P-image-health.md:18`（§0）+ `:99`（§3.6）确实仍用错误的 `/admin/images/*` 前缀（真实路由 `/admin/image-health/*`），不可删；第 3 条 `dead` 章节号 **`§5` 本就正确**——`dead` 在手册 §5（`:115`）+ §6（`:130`），§3.2（`:65`）是 backfill。三条映射均与手册一致。

### 0.5 ❓ 待核实（子代理单源、主循环未亲验）

- ❓ 维度3 子代理称 `getImageHealthStats` 过滤 `v.is_published = true`（`imageHealth.ts:189-224`）——与设计稿"已上架"口径需对账。
- ❓ 维度4 子代理称 ADR-028/029/045/046/047 为 image-health 相关 ADR；维度5 子代理同时列 ADR-046/135/150/177/201-207。两组编号不完全一致，开卡前需查 `docs/decisions.md` 对账。
- ❓ 维度5 子代理引用的 `docs/decisions.md:23095-23265`（ADR-205）等具体行号未亲验。

---
