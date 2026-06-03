# ADR-177 前置预研：`video_external_refs` ↔ `catalog_external_refs` 关系定档

> 状态：**已定档（arch-reviewer claude-opus-4-8 认可 / agentId a6cc563d53376800e / CONDITIONAL → R-1 + Y-1~4 吸收）** — 解锁 CHG-VIR-4（ADR-177 起草）
> 日期：2026-06-02
> 决策者：主循环 `claude-opus-4-8` / arch-reviewer（claude-opus-4-8）CONDITIONAL→认可
> 目的：在起草 ADR-177（外部 ID 映射真源 `catalog_external_refs`）前，先定档其与既有 `video_external_refs`（migration 041/045）的「替代 / 并存 / 上卷」关系，消除视频身份解析设计 §9.2 **R1 红线**（"在回答 `video_external_refs` 的替代/并存/上卷关系前，不得起草外部 ID 映射真源 ADR"）。
> 关联：设计 `video-identity-resolution-redesign_20260602.md` §4.6 / ADR-174 D-174-3·D-174-7 / migration 041·045 / ADR-176（`season_number` 维度）/ ADR-105a Y-105a-4（外部 exact ID 证据源）
> 性质：本文件**不是 ADR**，是 ADR-177 起草的定档输入；ADR-177 正式 schema/约束/迁移由 CHG-VIR-4 落 `docs/decisions.md`。

---

## 1. 既有 `video_external_refs` 现状（事实基线）

**Schema（migration 041 + 045，逐字核对）**：

| 列 | 类型 | 语义 |
| --- | --- | --- |
| `id` | UUID PK | |
| `video_id` | UUID NOT NULL FK→videos ON DELETE CASCADE | **video 实例级**（非 catalog） |
| `provider` | TEXT CHECK(douban/tmdb/bangumi/imdb) | |
| `external_id` | TEXT NOT NULL | provider 侧 ID |
| `match_status` | TEXT DEFAULT 'candidate' CHECK(`auto_matched`/`manual_confirmed`/`candidate`/`rejected`) | **video 级匹配状态机** |
| `match_method` | TEXT | title_year_type / imdb_id / alias_year / manual |
| `confidence` | NUMERIC(4,2) | |
| `is_primary` | BOOLEAN DEFAULT false | 该 video 在此 provider 的主绑定 |
| `linked_by` / `linked_at` / `notes` / `updated_at` | | 审计列 |

**约束**：① `uq_video_external_refs_primary` UNIQUE `(video_id, provider) WHERE is_primary`（每 video 每 provider 至多一 primary）；② `uq_video_external_refs_vid_prov_ext` UNIQUE `(video_id, provider, external_id)`（upsert ON CONFLICT 目标）；③ idx `(video_id)` / idx `(provider, external_id)`。

**消费方（全仓事实，R-1 校正后双角色）**：
- **写入（4 富集 Service）**：`db/queries/externalData.ts` `upsertVideoExternalRef`（:368，ON CONFLICT `(video_id,provider,external_id)` DO UPDATE）；`services/BangumiService.ts`（:122 `findPrimaryVideoExternalRef` 幂等 + :311 auto/candidate, :526, :557）；`services/DoubanService.ts`（:200, :383 人工 confirm）；`services/MetadataEnrichService.ts`（:358）。
- **读展示（后台审核台 UI / R-1 校正补全）**：`db/queries/externalData.ts` `listVideoExternalRefs`（:475）→ `services/VideoService.ts` `getAdminVideoById`（:220-237）映射为 `externalRefs: ExternalRefSummary[]` 注入 admin 视频详情（ADR-172 AMENDMENT 3 / D-172-AMD3-3）→ `packages/admin-ui/.../external-meta-panel.tsx` 按 provider 取 primary 渲染 `match_status` 标签 + 外链；server-next `VideoEditDrawer.tsx` / `RightPane/TabDetail.tsx` 消费。`ExternalRefSummary` = `video_external_refs` 面向展示的**窄化投影**（decisions.md D-172-AMD3-2）。

**语义结论**：`video_external_refs` 承载「**某内部 video 实例**与某外部条目的匹配观测 / 自动命中 / 人工确认 / 候选 / 拒绝」，服务**采集 / 导入 / 富集 / 审核**链路，层级是 **video 实例**，**不是 catalog 作品**。**双角色表（R-1）**：后端富集**写入** + 后台审核台经 `ExternalRefSummary` 窄化投影**只读展示**（无前台 UI；写工作流不经 UI）。故「替代」`video_external_refs` 不仅破坏 4 富集 Service 写入，还会破坏审核台 external-meta-panel 展示——排除「替代」的论据更强（见 §3.1）。

**D-174-3 现状（关键迁移对象）**：`BangumiService.resolveBangumiBinding` 在 `bangumi_subject_id` 唯一约束冲突（subject 已被他 catalog 占用且重指向不安全 type/year 冲突）时，**降级写 `video_external_refs` candidate（非 primary）+ 保留 `bangumi_status=unmatched`，正常 COMMIT**（BangumiService:163-168/187-188/466/508）。**语义错位**：这是 **catalog 层**（`media_catalog.bangumi_subject_id` 唯一约束）的冲突，降级落点却是 **video 级** candidate ref——属历史权宜（当时无 catalog 级外部 ref 表）。

---

## 2. `catalog_external_refs` 规划（设计 §4.6，待 ADR-177 正式定档）

catalog 级 canonical 外部身份关系表，目标字段：`id` / `catalog_id` / `provider` / `external_id` / `external_kind`(show/season/movie/subject) / `relation`(`exact`/`parent`/`candidate`/`rejected`) / `season_number`（ADR-176）/ `confidence` / `source`(auto/manual) / `is_primary` / 审计列。约束用 **partial unique indexes**（exact 全局唯一 / parent 一对多 / candidate·rejected 保留审计）。服务 `MediaCatalogService.findOrCreate`、catalog identity、series/season 粒度建模。`media_catalog.{imdb_id,tmdb_id,douban_id,bangumi_subject_id}` 四列降级为 **cache**（仅缓存 `relation='exact' AND is_primary` 的 ref）。

---

## 3. 关系定档：**并存 + 上卷**（三选一结论）

### 3.1 排除「替代」（catalog_external_refs 取代 video_external_refs）
❌ **不可**。`video_external_refs` 是 **video 实例级**观测真源，被 4 个富集 Service 写入（采集/导入/富集/审核链路），与 `catalog_external_refs`（catalog 作品级 canonical 身份）**层级不同、职责不同**。替代会：① 丢失 video 级匹配观测语义（同 catalog 下不同 video 可有不同匹配观测）；② 破坏 D-174-3 降级 + D-174-7 redirect 传播链（4 Service 改造面巨大）；③ 违价值排序 1（正确性——会引入富集链路回归）。

### 3.2 排除「纯并存（无上卷）」
❌ **不充分**。两表完全独立、互不推导，会产生**两套外部 ID 事实源**且无桥接——`findOrCreate` 改读 `catalog_external_refs` 时**无数据来源**（video 级已确认的外部 ID 无法贡献给 catalog 级 canonical 身份），违价值排序 2（边界与复用，等于重复采集外部 ID）。

### 3.3 定档：**并存 + 上卷**（采纳）
两表**并存**，职责边界清晰，由**确定性上卷**桥接：

| | `video_external_refs`（保留 / 不变） | `catalog_external_refs`（ADR-177 新增） |
| --- | --- | --- |
| 层级 | **video 实例** | **catalog 作品** |
| 职责 | 采集/导入/富集/审核的 video 级匹配观测、自动命中、人工确认、候选、拒绝 | catalog 级 canonical 外部身份、`findOrCreate`、season/series 建模 |
| 写入方 | 4 富集 Service（不变） | findOrCreate / 上卷 job / 人工 catalog 绑定（ADR-177/Phase 5） |
| 状态 | `match_status`(auto_matched/manual_confirmed/candidate/rejected) | `relation`(exact/parent/candidate/rejected) |
| 唯一性 | (video_id,provider) 一 primary | exact:(provider,external_id,external_kind) 全局唯一 |

- `video_external_refs` **保留为 video 级真源**，4 Service 写入路径**零改造**（价值排序 1 不引回归）。
- `catalog_external_refs` **承载 catalog 级 canonical 身份**，由**上卷**从 video 级 primary confirmed 证据聚合推导（§3.4）。
- catalog exact ref 建立后**可反向辅助** video 级 candidate 排序，但**不得覆盖** video 级人工 rejected（设计 §4.6）。

### 3.4 上卷规则（确定性 / ADR-177 实装契约）
以「某 catalog 下其全部 video 在同一 provider 的 `video_external_refs`」为输入，按下表确定性推导 `catalog_external_refs`：

| 输入条件（同 catalog × 同 provider） | 上卷产出 |
| --- | --- |
| 多 video 的 `is_primary=true AND match_status='manual_confirmed'` 指向**同一** `external_id` | 建议 `catalog_external_refs (relation='exact', is_primary=true, source='auto')` |
| 多 video 的 `is_primary=true AND match_status='auto_matched'`（无 manual_confirmed）指向**同一** `external_id` | 仅 `relation='candidate'`（保守，待人工确认升 exact；避免自动错绑上卷） |
| 同 catalog 下不同 video 的 primary confirmed/auto 指向**不同** `external_id`（冲突） | 仅各记 `relation='candidate'`，**不自动上卷 exact**，人工裁定 |
| 单 video 的 manual_confirmed primary | 可上卷 `relation='exact'`（**同 catalog 内**无歧义；**跨 catalog** exact 唯一性按下方 external_kind/season 规则裁定 / Y-2） |

- **跨 catalog 同 external_id 上卷处置（Y-1 / exact 全局唯一 × ADR-176 按季粒度）**：上卷输入是「同 catalog × 同 provider」，但 `exact` 是 `(provider, external_id, external_kind)` **全局唯一**；ADR-176 按季粒度下，同剧不同季可各建 catalog 却共享同一 **show 级**外部 ID。定档：
  - **show 级共享 ID**（同一 douban/imdb show、TMDB show parent）→ 各 catalog 上卷 `relation='parent'`（一对多，**不撞 exact 唯一索引**）；
  - **season / movie 级精确 ID**（Bangumi subject、TMDB season、精确条目）→ 上卷 `relation='exact'`，纳入 `external_kind` + ADR-176 `season_number` 区分；
  - **exact 唯一冲突**（两 catalog 都声称同一精确 ID）= **catalog 归并信号**，降级 `candidate` 交人工裁定，**绝不靠唯一索引报错兜底**。
- **保守底线**：`exact` 上卷**仅** manual_confirmed 一致 **且精确级（非 show 级）** 触发；任何冲突只产生 candidate，不自动 exact（价值排序 1：误绑 catalog 身份代价高）。
- 上卷是**建议生成**（auto 写 candidate/exact 但可被人工 reject）；真正自动绑定开关沿 ADR-105a/Phase 3 默认 OFF。

---

## 4. D-174-3 迁移路径

**现状**：D-174-3 是 **catalog 层**冲突（`media_catalog.bangumi_subject_id` 唯一约束）却降级记 **video 级** candidate ref（语义错位的历史权宜）。

**目标态（ADR-177 落地后）**：catalog 层外部 ID 冲突 → 记 **`catalog_external_refs` candidate（relation='candidate'）**；`video_external_refs` 回归纯 video 级匹配观测。

**迁移策略（渐进，不破坏现状 / 价值排序 1）**：
1. **过渡期**：保留现有 D-174-3 写 `video_external_refs` candidate 路径**不变**（BangumiService:508 降级逻辑零改），避免富集链路回归。
2. **ADR-177 落地（Phase 5 CHG-VIR-12）**：catalog 层冲突**新增**写 `catalog_external_refs candidate`（与 video 级 candidate **双写过渡**，或经上卷 job 从 video candidate 派生 catalog candidate）。**candidate 的 `catalog_id` 归属（Y-3）**：D-174-3 触发场景本身是 catalog 唯一约束冲突（subject 已被他 catalog 占用），candidate ref 的 `catalog_id` 应指向当前入参 catalog 还是占用方 existing catalog，须结合 **D-174-7 / R13**（redirect 后 catalogId 传播）在 conflict 与 redirect 两分支下分别定——本预研**点名留 ADR-177 定死**，不在此固化。
3. **目标收敛**：catalog 层冲突主记 `catalog_external_refs`；`video_external_refs` 的 candidate 退回纯 video 级观测语义。**收敛时机与双写→单写切换留 ADR-177 定**（本预研只定方向：catalog 层冲突归 catalog_external_refs，不再借 video 级表承载 catalog 语义）。
4. **D-174-7 redirect 传播链**（运行时改 `video.catalog_id` → 下游 catalogId 传播 / 红线 R13）**不受影响**：上卷读 `video_external_refs` 现状即可，redirect 后 video 归属变化由既有传播链处理。

---

## 5. 两表 candidate/rejected 审计：**不合并（各自独立）**

- `video_external_refs.{candidate,rejected}` = **video 实例级**匹配候选/拒绝（"这个 video 与该外部条目匹配候选/被拒"）。
- `catalog_external_refs.{candidate,rejected}` = **catalog 作品级**身份候选/拒绝（"这个 catalog 作品与该外部实体绑定候选/被拒"）。
- **不合并**：层级不同、基数不同（一 catalog 多 video）。
- **传播规则**：
  - video 级 `rejected` **不自动**等价 catalog 级 `rejected`——一个 video 拒绝某外部 ID ≠ 整个 catalog（含其他 video）拒绝该 ID。只有**人工明确拒绝 catalog 绑定**才写 `catalog_external_refs rejected`（设计 §4.6）。
  - catalog 级 `exact` ref **不覆盖** video 级人工 `rejected`（catalog 身份成立不强制每个 video 都接受该外部 ID）。
- 两表各自保留 candidate/rejected 历史。**约束分级收敛（Y-4）**：`catalog_external_refs` 的 partial unique **仅约束 `exact`/`parent`**（exact 全局唯一 / parent 一对多）；**`candidate`/`rejected` 不进 partial unique 约束集**，故天然可保留多条历史、**无需** `decision_id`。仅当 ADR-177 需对 candidate 去重（如同 pair 重复候选）时，再引状态/版本字段——本预研定方向：candidate/rejected 不受全局唯一约束。

---

## 6. 对 ADR-177 起草的定档输入（CHG-VIR-4 验收锚点）

1. **关系 = 并存 + 上卷**（§3）：`video_external_refs` 保留 video 级真源不改（含后台审核台 UI 只读展示链 / R-1）；`catalog_external_refs` 为 catalog 级 canonical 身份，上卷桥接。
2. **上卷规则 + exact 约束分级**（§3.4）：manual_confirmed primary 一致 + 精确级 → exact；auto_matched 一致 → candidate；冲突 → candidate 不自动 exact；**跨 catalog 同 external_id 按 external_kind/season 裁定**（show 级 → `parent` 一对多 / season·movie 级 → `exact` / exact 冲突 → `candidate` 归并信号）。代码常量真源，保守底线。
3. **D-174-3 迁移**（§4）：过渡期保留 video 级 candidate；ADR-177 落地新增 catalog_external_refs candidate（双写过渡）；目标 catalog 层冲突归 catalog_external_refs。
4. **两表审计不合并**（§5）：层级独立；video rejected 不传播 catalog rejected；catalog exact 不覆盖 video rejected。
5. **四列降级 cache**（设计 §4.6）：仅缓存 `relation='exact' AND is_primary`；parent/candidate/rejected 不回填 cache（ADR-177 细化）。

---

## 7. 风险与门禁

- **不在本预研改代码 / 不落 migration**：4 Service 写入路径过渡期零改；ADR-177 + Phase 5 才实施。
- **价值排序 1（正确性）**：渐进迁移（双写过渡）避免富集链路回归；D-174-3/D-174-7 现状不破坏。
- **价值排序 2（边界复用）**：并存+上卷消除「替代」的回归风险与「纯并存」的双真源，桥接复用 video 级已确认证据。
- **门禁**：本预研经 **arch-reviewer（claude-opus-4-8）认可**后，方可起 CHG-VIR-4（ADR-177）；arch-reviewer 若对关系/上卷/迁移/审计任一提红线，修订吸收后再认可。

---

## 8. arch-reviewer 审核记录

> 评审人：arch-reviewer（`claude-opus-4-8`）· 独立第二意见 · 只读
> agentId：a6cc563d53376800e · 日期：2026-06-02
> 主循环：`claude-opus-4-8`

**结论：CONDITIONAL → R-1 + Y-1~4 修订吸收后，arch-reviewer 认可起草 ADR-177（CHG-VIR-4）。**

- **R-1（必修红线，已吸收）**：§1 「无 UI 消费方」误述——`video_external_refs` 实有后台审核台 UI 只读展示链（`listVideoExternalRefs`:475 → `VideoService.getAdminVideoById`:220-237 `ExternalRefSummary` → `external-meta-panel.tsx` / `VideoEditDrawer` / `TabDetail`，ADR-172 AMD3 / D-172-AMD3-2）。已校正 §1 消费方为「写入 4 Service + 读展示后台 UI」双角色；排除「替代」结论不变（论据更强）。
- **Y-1（已吸收）**：§3.4 补「跨 catalog 同 external_id 上卷 × exact 全局唯一」处置——show 级 → `parent` 一对多 / season·movie 级 → `exact` / exact 冲突 → `candidate` 归并信号（不靠唯一索引兜底）。
- **Y-2（已吸收）**：§3.4 单 video exact 限定为「同 catalog 内无歧义；跨 catalog 按 external_kind/season 裁定」。
- **Y-3（已吸收）**：§4 补 `catalog_external_refs` candidate 的 `catalog_id` 归属（conflict/redirect 分支结合 D-174-7）留 ADR-177 定。
- **Y-4（已吸收）**：§5 收敛——candidate/rejected 不进 partial unique（仅 exact/parent 受全局唯一），无需 `decision_id`。

**认可的核心定档（无返工）**：关系三选一（并存+上卷解 R1 红线）、上卷保守底线（manual_confirmed→exact）、D-174-3 语义错位诊断 + 迁移方向、两表审计不合并——四项达标。

**门禁结论**：R-1 + Y-1~4 全部吸收 → **arch-reviewer 认可，可起 CHG-VIR-4（ADR-177）**。
