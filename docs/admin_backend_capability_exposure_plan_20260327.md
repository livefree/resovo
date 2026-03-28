# 后台已实现能力显性化方案（2026-03-27）

> status: active
> owner: @engineering
> scope: expose implemented admin APIs/features in admin UI and complete operation loops
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27

## 1. 背景与目标

当前后台存在“接口能力已实现，但界面未展示或不可达”的断层，导致：
1. 内容审核台功能偏单一（仅通过/拒绝，无拒绝原因输入）。
2. 视频管理与播放源管理在交互层未承接完整后端能力。
3. 播放源故障感知依赖局部入口，缺少全量视图和运行态提示。
4. 播放源验证仅支持单条操作，无法按“视频主体 + 来源站点”批量治理，效率低。

本方案目标：
1. 先曝光已实现能力，再评估新增接口。
2. 先打通闭环（可见、可操作、可回溯），再做高级治理功能。
3. 不改变既有权限边界（moderator/admin）。

---

## 2. 已实现但未充分展示的能力清单

## 2.1 视频管理（后端已实现）

1. `PATCH /admin/videos/:id/publish`（单条上下架）
2. `POST /admin/videos/batch-publish`（批量上下架）
3. `POST /admin/videos/batch-unpublish`（批量下架）
4. `POST /admin/videos/:id/douban-sync`（豆瓣同步，admin only）
5. `POST /admin/videos/:id/review` 支持 `reason` 字段（前端未提供录入）

## 2.2 播放源管理（后端已实现）

1. `GET /admin/sources` 已支持 `status=active|inactive|all`
2. `POST /admin/sources/:id/verify` 单条源验证
3. `PATCH /admin/sources/:id` 替换 URL 并重置活跃状态
4. `DELETE /admin/sources/:id`、`POST /admin/sources/batch-delete`
5. `GET /admin/sources/shell-count` 空壳视频检测

## 2.3 运行能力（已实现）

1. Verify 定时全量扫描已实现：`VerifyService.scheduleAllActiveVerification()`
2. 受环境变量 `VERIFY_SCHEDULER_ENABLED` 控制，默认关闭

## 2.4 本轮新增能力（需补实现）

1. `/admin/sources` 查询增强：
   - 关键词（URL/视频标题模糊）
   - 视频标题（精确或模糊）
   - 来源站点（`siteKey`）
   - 排序字段与方向（如 `created_at` / `last_checked` / `is_active` / `video_title`）
2. 批量验证入口（按治理范围）：
   - `scope=video`：按视频主体验证全部播放源
   - `scope=site`：按来源站点验证全部播放源
   - `scope=video_site`：按“视频主体 + 来源站点”组合验证
3. 源状态手工切换接口（可选）：
   - 单条切换：`PATCH /admin/sources/:id/status`
   - 批量切换：`POST /admin/sources/batch-status`
   - 定位为运维兜底，不替代自动验证。

---

## 3. 后台展示方案（页面维度）

## 3.1 内容审核台 `/admin/moderation`

定位：审核闭环，不承载复杂元数据编辑。

保留：
1. 待审列表、详情、内嵌预览、通过/拒绝快捷操作。

补齐：
1. 拒绝操作增加 `reason` 输入弹窗，提交到 `POST /admin/videos/:id/review`。
2. 页面文案从“通过、拒绝或封禁”修正为与接口一致的“通过、拒绝”。

## 3.2 视频管理 `/admin/videos`

定位：元数据与可见性主操作面板。

保留：
1. 现有筛选、排序、抽屉编辑、可见性切换、批量审核。

补齐：
1. 操作列改为下拉菜单，显式展示：
   - 编辑（抽屉）
   - 跳转完整编辑页 `/admin/videos/[id]/edit`
   - 单条上架/下架（接 `PATCH /admin/videos/:id/publish`）
   - 豆瓣同步（admin only，接 `POST /admin/videos/:id/douban-sync`）
2. 批量公开/隐藏优先走 `batch-publish` / `batch-unpublish`，减少逐条调用。

## 3.3 播放源管理 `/admin/sources`

定位：可播性治理主面板。

现状问题：
1. 仅有“失效源 / 用户纠错”两 Tab，缺少“全部源”入口。
2. 失效源批量删除栏组件存在，但多选未接线，实际不可达。

补齐：
1. 新增“全部源”Tab，接 `GET /admin/sources?status=all`。
2. 保留“失效源”Tab（`status=inactive`）和“用户纠错”Tab（`/admin/submissions`）。
3. 失效源表补选择列，打通批量删除栏触发链路。
4. 顶部增加 Verify 运行态提示（enabled/disabled），用于解释“为何失效源为空”。
5. 筛选区增加：
   - 关键词（URL/标题）
   - 视频标题
   - 来源站点（siteKey）
   - 排序字段 + 排序方向
6. 行/批量操作增加“手工标记状态”（可选）：
   - 标记活跃
   - 标记失效

## 3.4 播放源批量治理（视频主体 + 源站）

问题：
1. 同一视频主体多集通常来自同一来源站点，失效具有强相关性。
2. 单条验证会导致重复点击和重复请求，治理效率低。

方案：
1. 后端新增批量验证接口（建议异步任务化）：
   - 入参支持 `videoId`、`siteKey`、`scope`、`activeOnly`
   - 返回任务 ID、命中条数、执行摘要
2. 前端在 `/admin/sources` 增加“批量验证”动作：
   - 按当前筛选条件发起
   - 快捷动作：按视频、按站点、按视频+站点
3. 验证后回写：
   - 刷新列表更新 `is_active / last_checked`
   - 展示本次批量任务结果（成功/失败/超时）

约束：
1. 大批量请求必须限流与分片，避免瞬时压垮外部源站。
2. 批量验证与手工状态切换均保留审计信息（操作者、时间、动作类型）。

## 3.5 已删除源管理（回收站）

问题补充：
1. 当前删除为软删除（`deleted_at`），数据仍在库内，但后台无查看与恢复入口。
2. 运维无法区分“已治理删除”与“数据丢失”，排障成本高。

目标：
1. 后台可查看已删除源（回收站）。
2. 支持单条/批量恢复，避免误删后只能手工改库。
3. 保持现有软删除语义，不引入数据库结构变更。

后端方案（轻量扩展）：
1. 扩展 `GET /admin/sources` 查询参数：
   - `deleted=exclude|only|all`（默认 `exclude`，保持兼容）
2. 新增恢复接口：
   - `POST /admin/sources/:id/restore`
   - `POST /admin/sources/batch-restore`
3. 权限：
   - 查看回收站与恢复：`moderator+`
   - 永久删除（若后续引入）：建议 `admin only`，且不在本阶段启用。

前端方案（播放源页）：
1. 在 `/admin/sources` 增加“已删除”Tab（回收站视图）。
2. 回收站表格展示：视频标题、源 URL、删除时间（`deleted_at`）、最近验证（`last_checked`）。
3. 操作列支持“恢复”；多选后出现“批量恢复”底栏。
4. 默认列表（全部源/失效源）继续只展示 `deleted=exclude`，避免污染治理主视图。

---

## 4. 实施边界

1. 优先前端接线，不新增数据库结构。
2. 后端仅在必要处补小接口（若前端接线无法满足）。
3. 严格沿用现有权限控制和 API 前缀，不改已有路径语义。
4. 手工状态切换为可选能力，默认 `moderator+`，且必须可审计。
5. 批量验证优先复用现有 verify worker 与队列，不引入平行验证体系。

---

## 5. 分阶段实施

## Phase 1：能力显性化（前端接线优先）

1. 播放源页新增“全部源”Tab与筛选切换。
2. 修复失效源多选逻辑，恢复批量删除可达性。
3. 视频管理操作列挂出 publish/unpublish、douban-sync、完整编辑入口。
4. 视频批量公开/隐藏改走批量接口。
5. 审核台拒绝理由录入。
6. 增加“已删除源”回收站视图与恢复链路（单条/批量）。
7. `/admin/sources` 增加关键词/标题/siteKey/排序筛选项并同步 URL 参数。

## Phase 2：运行态可观测性

1. 在播放源页展示 Verify scheduler 状态。
2. 增加“状态解释”提示，降低空列表误判。
3. 增加批量验证任务反馈（任务状态、命中条数、失败条数）。

## Phase 3：批量治理与手工兜底

1. 实现按 `video` / `site` / `video+site` 的批量验证接口和前端入口。
2. 实现手工状态切换接口与 UI 操作（可选，默认开关控制）。
3. 接入最小审计字段（操作人、操作时间、操作类型）。

## Phase 4：回归与验收

1. 补单元测试（关键交互）+ 管理端关键路径冒烟。
2. 校验接口调用数与失败重试策略。

---

## 6. 验收标准

1. 管理员可在后台看到全量播放源，不再仅依赖失效源列表判断健康。
2. 视频管理可执行单条/批量发布与下架、豆瓣同步、完整编辑跳转。
3. 审核台拒绝操作可录入原因并落到后端。
4. 播放源批量删除可从 UI 真实触发。
5. 所有新增展示能力均有对应接口日志与测试覆盖。
6. 已删除源可在后台查看并恢复，无需手工修改数据库。
7. 可按视频主体与来源站点发起批量验证，结果回写到 `is_active/last_checked`。
8. `/admin/sources` 可按关键词、标题、siteKey、排序字段高效筛查。
9. 手工状态切换（若启用）可用于运维兜底，且具备可审计记录。
