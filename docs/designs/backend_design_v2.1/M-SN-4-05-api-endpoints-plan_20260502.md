# CHG-SN-4-05 · 后端 API：8 新端点 + 4 改端点 — 开发指导方案

> status: active
> revision: v1.1（2026-05-02 审核闭环）
> owner: @engineering
> scope: M-SN-4 moderation console API endpoints and contracts
> source_of_truth: yes（本卡执行真源）
> supersedes: none
> superseded_by: none
> parent_plan: `docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 + v1.5 patch
> task_id: **CHG-SN-4-05**（前置 CHG-SN-4-03 ✅，与 -06 双轨并行）
> 建议主循环：`claude-sonnet-4-6`
> 强制子代理：否（zod schema 自审；如出 ADR 级决策再升 Opus）
> last_reviewed: 2026-05-02

## v1.1 修订摘要（2026-05-02 审核闭环）

针对审核结论 5 项阻塞 + 部分修正项：

1. **§2.2 ApiResponse 信封**：撤回 `{ success, data, error }` 形态，回归 `docs/rules/api-rules.md` 现行规范——成功 `{ data }`（列表 `{ data, pagination }`）/ 失败 `{ error: { code, message, status } }`；不破坏既有 4 个改端点的前端兼容性
2. **§2.4 RBAC**：`requireStaff` → `fastify.requireRole(['moderator', 'admin'])`（apps/api 实际原语）
3. **§4.2 状态机参数**：`expectedOld` → `expectedUpdatedAt: string`（与 `transitionVideoState` 现行签名对齐，乐观锁基于 updated_at）
4. **§4.4 disable-dead**：`UPDATE … updated_at` → `UPDATE … last_checked = NOW()`（video_sources 表无 updated_at；既有 query 全部用 last_checked）
5. **§4.2 / §4.4 ES 同步**：`VideoIndexSyncService.unindexVideo()` 当前不存在 → 本卡前置补该方法（DELETE document by id），与 ModerationService 同 PR 落地
6. **§1.2 + 新增 §1.4 058.1 schema patch 前置**：`source_health_events.processed_at + idx` 由本卡内补 058.1 migration（feedback 入队信号产生方），不下推 -06
7. **§2.3 errorCode 枚举**：仅供本卡新端点和 ModerationService 内部使用；不强制改 4 个既有端点已落地的错误响应（沿用 `docs/rules/api-rules.md` 现行错误码字典 + 本卡补充本期 6 个新码）
8. **§8 commit trailer**：改用 `docs/rules/git-rules.md` §M-SN 扩展协议（`Refs:` / `Plan:` / `Review:` / `Executed-By-Model:` / `Subagents:`）

---

---

## 1. 范围与依赖

### 1.1 端点清单（plan v1.4 §3.1 / §3.2 / §3.3）

**8 新端点**：

| # | 方法 + 路径 | RBAC | 业务文件 | audit action_type |
|---|-------------|------|----------|------------------|
| 1 | GET `/admin/moderation/pending-queue` | staff+ | `routes/admin/moderation.ts` | — |
| 2 | POST `/admin/moderation/:id/reject-labeled` | staff+ | `routes/admin/moderation.ts` | `video.reject_labeled` |
| 3 | PATCH `/admin/moderation/:id/staff-note` | staff+ | `routes/admin/moderation.ts` | `video.staff_note` |
| 4 | GET `/admin/review-labels` | staff+ | `routes/admin/reviewLabels.ts`（**新建**） | — |
| 5 | GET `/admin/moderation/:id/line-health/:sourceId` | staff+ | `routes/admin/moderation.ts` | — |
| 6 | POST `/admin/staging/:id/revert` | staff+ | `routes/admin/staging.ts` | `staging.revert` |
| 7 | PATCH `/admin/videos/:id/sources/:sourceId` | staff+ | `routes/admin/videos.ts` | `video_source.toggle` |
| 8 | POST `/admin/videos/:id/sources/disable-dead` | staff+ | `routes/admin/videos.ts` | `video_source.disable_dead_batch` |

**1 前台端点**（不入 admin_audit_log）：

| # | 方法 + 路径 | RBAC | 业务文件 |
|---|-------------|------|----------|
| 9 | POST `/v1/feedback/playback`（route 内部定义 `/feedback/playback`，由 server.ts 统一 prefix `/v1`） | 公开 + rate-limit | `routes/feedback.ts`（**新建**） |

**4 改端点**：

| 端点 | 改动 |
|------|------|
| POST `/admin/videos/:id/review` | body 新增 `labelKey?: string`；reject 时未传 → `'other'` |
| POST `/admin/moderation/batch-reject` | body 新增 `labelKey?: string` |
| GET `/admin/videos/:id` | response 新增 `staff_note` / `review_label_key` / `needs_manual_review` |
| GET `/admin/staging` | response 行新增 `quality_detected` 聚合（最高实测档位） |

### 1.2 前置依赖

- ✅ CHG-SN-4-03：052–060 migration / `packages/types/admin-moderation.types.ts` / `transitionVideoState('staging_revert')` / `admin_audit_log` 表 / `review_labels` 表
- ✅ apps/api 现行原语：`fastify.requireRole(['moderator', 'admin'])`（M-SN-2 已建立；本卡 8 admin 端点全部使用，**不引入** `requireStaff` 别名）
- ✅ 响应格式现行规范：`docs/rules/api-rules.md` §响应格式规范——成功 `{ data }`（列表 `{ data, pagination }`）/ 失败 `{ error: { code, message, status } }`
- ⏸ **本卡前置补丁**：见 §1.4
- ⏸ **本卡前置补丁**：`VideoIndexSyncService.unindexVideo(id)` 方法当前不存在；reject-labeled / disable-dead 写端点接入前必须先补（同 PR 同步落地，不另起卡）

### 1.3 ADR-103a / packages/types 类型边界

zod schema → TS 推导导出 `packages/types/src/admin-moderation.types.ts`；**响应类型**沿用 api-rules.md 现行 `{ data }` / `{ error }` 形态（不引入 `ApiResponse<T>` 信封类型）。

### 1.4 058.1 schema patch 前置（本卡内落地）

058 migration 当前列：`source_id / error_detail / http_code / latency_ms`；**未含** `processed_at` 列。本卡作为 feedback 入队信号产生方，前置补 058.1 migration（在 -03 已落 058 之后追加）：

```
apps/api/src/db/migrations/058a_source_health_events_processed_at.sql
```

```sql
BEGIN;
ALTER TABLE source_health_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN source_health_events.processed_at
  IS 'feedback-driven recheck queue 消费标记；NULL = 未处理；非 NULL = worker 已入队';
CREATE INDEX IF NOT EXISTS idx_source_health_events_unprocessed
  ON source_health_events (created_at)
  WHERE processed_at IS NULL AND origin = 'feedback_driven';
COMMIT;
```

**编号说明**：058a 是字母后缀编号（已有 058 + 059 + 060；插入新 060+ 会破坏 -03 已固化的部署顺序）；runner 字典序遍历下 `058 < 058a < 059`，部署顺序天然正确。
**回滚**：注释形式 down SQL 与 058 同协议。
**docs/architecture.md §5.12 同步**：本卡内追加 `processed_at` 列说明 + index 描述。

---

## 2. 七项共性约束实装映射（plan §3.0）

### 2.1 端点归属（§3.0.1）

`apps/api/src/routes/admin/{moderation,staging,videos}.ts` 扩展（既有路由，**非新建后端**）+ 新建 `reviewLabels.ts` / `feedback.ts`。

### 2.2 响应格式（沿用 api-rules.md 现行规范）

成功（单资源）：
```json
{ "data": { ... } }
```

成功（列表）：
```json
{ "data": [...], "pagination": { "total": 47, "page": 1, "limit": 20, "hasNext": true } }
```

失败（统一）：
```json
{ "error": { "code": "STATE_INVALID", "message": "当前状态不允许此操作", "status": 409 } }
```

实装：复用既有 `apps/api/src/lib/errors.ts` 错误码字典与抛错路径；**禁止**引入新的 `ApiResponse<T>` / `ApiError` 信封。前端 `apps/web-next` / `apps/server-next` 既有 fetcher 兼容性不变。

> 4 个改端点（review labelKey / batch-reject labelKey / videos GET 加字段 / staging GET 加 quality_detected）必须保持响应外壳不变，仅扩展 `data` 字段。

### 2.3 errorCode 枚举（本卡新增 6 码 — 仅供新端点 / ModerationService 内部使用）

新增 6 码集中维护于 `apps/api/src/lib/errors.ts`（既有错误码字典扩展，**不新建** `apps/api/src/types/error-codes.ts` 目录）：

| code | HTTP | 触发位 | 文案（zh-CN） |
|---|---|---|---|
| `STATE_INVALID` | 409 | 状态机 trigger 拒绝 | 当前状态不允许此操作 |
| `LABEL_UNKNOWN` | 400 | reject-labeled 传未知 labelKey 且 fallback 关闭时 | 拒绝标签不存在 |
| `STAGING_NOT_READY` | 422 | publish 时 readiness 仍存在 critical 项且未传 force | 该视频未通过发布预检 |
| `REVIEW_RACE` | 409 | 同条视频已被其他审核员处理（updated_at 校验） | 已被其他审核员处理，请刷新 |
| `RATE_LIMITED` | 429 | feedback / 重测全部 / 补源超频 | 操作过于频繁，请稍候 |
| `SOURCE_PROBE_FAILED` | 502 | refetch-sources 触发 worker 失败 | 探测服务暂不可用 |

> 4 个既有改端点不强制改错误码语义；如本卡内某既有错误码语义与新码冲突，单独列入 follow-up，不在本卡内做全局错误码迁移。

### 2.4 RBAC 矩阵（§3.0.4）

apps/api 实际原语为 `fastify.requireRole(roles: string[])`（参见 `apps/api/src/routes/admin/moderation.ts:59`），**不存在** `requireStaff`。本卡 8 admin 端点 RBAC 实装：

| 端点 | requireRole 参数 |
|------|------------------|
| GET pending-queue / staging GET / videos GET / line-health / review-labels | `['moderator', 'admin']`（即审核员及以上）|
| POST reject-labeled / staff-note PATCH / staging revert / sources PATCH / disable-dead | `['moderator', 'admin']` |
| POST staging publish（单条；既有端点）| 既有矩阵不变 |
| POST staging batch-publish（既有端点）| 既有矩阵不变 |

> plan v1.4 §3.0.4 提到的 "staff" 角色在 apps/api 当前未建立角色枚举；本卡按现行 `moderator | admin` 二元角色实装；如未来引入 staff 角色 → 单独迁移卡。

### 2.5 audit log 写入位点（§3.0.5）

11 个 action_type 由 `AuditLogService.write()` 写入，**fire-and-forget**（log warn + sentry breadcrumb；不阻塞主操作）。`request_id` 来自 pino child logger 透传。

### 2.6 并发保护（§3.0.6）

- `approve` / `reject_labeled` / `reopen`：沿用 `transitionVideoState(..., { expectedUpdatedAt })`，基于 `videos.updated_at` 乐观锁；不一致触发 `REVIEW_RACE`
- `staging.publish`：`WHERE id = $1 AND is_published = false AND review_status = 'approved'`（v1.2 加固）
- `sources.toggle` / `disable-dead`：is_active 幂等无需乐观锁
- `staff-note`：末写入胜出

### 2.7 zod schema（§3.0.7）

每端点 query / body / response zod schema 集中导出 `packages/types/src/admin-moderation.types.ts`（已部分落地，本卡补全 12 端点）。**禁 any**。

---

## 3. 文件清单（写）

### 3.1 apps/api 新建

```
apps/api/src/db/migrations/058a_source_health_events_processed_at.sql  # §1.4 前置 schema patch
apps/api/src/lib/errors.ts                            # 既有；扩展 6 个本期新错误码
apps/api/src/services/AuditLogService.ts              # 新建（11 action_type 写入封装）
apps/api/src/services/ModerationService.ts            # 新建（业务编排：状态机 + audit + ES 索引）
apps/api/src/db/queries/auditLog.ts                   # 新建（INSERT admin_audit_log）
apps/api/src/db/queries/reviewLabels.ts               # 新建（GET review_labels）
apps/api/src/db/queries/sourceHealthEvents.ts         # 新建（line-health 分页查询）
apps/api/src/routes/admin/reviewLabels.ts             # 新建：GET /admin/review-labels
apps/api/src/routes/feedback.ts                       # 新建：内部 POST /feedback/playback；外部 /v1/feedback/playback
apps/api/src/services/VideoIndexSyncService.ts        # 既有；本卡补 unindexVideo(id) 方法
```

**`VideoIndexSyncService.unindexVideo(id)` 补丁草案**（同 PR 落地）：

```typescript
// apps/api/src/services/VideoIndexSyncService.ts
async unindexVideo(videoId: string): Promise<void> {
  try {
    await this.es.delete({ index: ES_INDEX, id: videoId })
  } catch (err) {
    // 404（文档不存在）视为成功；其他错误 stderr + breadcrumb
    const status = (err as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[VideoIndexSyncService] unindexVideo failed for ${videoId}: ${message}\n`)
  }
}
```

> 不新增 `apps/api/src/types/error-codes.ts` 目录（v1.0 草案撤回）。错误码统一在既有 `lib/errors.ts`。

### 3.2 apps/api 扩展

```
apps/api/src/routes/admin/moderation.ts               # 扩展 4 端点（pending-queue / reject-labeled / staff-note / line-health）
apps/api/src/routes/admin/staging.ts                  # 扩展 1 端点（revert）+ GET /admin/staging response 加 quality_detected
apps/api/src/routes/admin/videos.ts                   # 扩展 2 端点（sources PATCH / disable-dead）+ review 加 labelKey + GET /:id response
apps/api/src/db/queries/videos.ts                     # 加 staff_note / review_label_key / needs_manual_review 选择
apps/api/src/db/queries/video_sources.ts              # 加 toggle / disable-dead query
apps/api/src/index.ts（或 server.ts）                 # 注册新路由
```

### 3.3 packages/types 同步

```
packages/types/src/admin-moderation.types.ts          # 12 端点 zod schema + 推导 TS 类型
packages/types/src/index.ts                           # re-export（如未就位）
```

### 3.4 测试

```
tests/unit/services/AuditLogService.test.ts           # write fire-and-forget / 失败不阻塞
tests/unit/services/ModerationService.test.ts        # 状态机 + audit + ES 编排
tests/unit/db/queries/auditLog.test.ts
tests/unit/db/queries/reviewLabels.test.ts
tests/unit/db/queries/sourceHealthEvents.test.ts

tests/contract/routes/admin/moderation.contract.test.ts   # 4 端点（pending-queue / reject-labeled / staff-note / line-health）
tests/contract/routes/admin/staging.contract.test.ts      # revert + GET 加 quality_detected
tests/contract/routes/admin/videos.contract.test.ts       # sources PATCH / disable-dead / review labelKey / GET 加字段
tests/contract/routes/admin/reviewLabels.contract.test.ts
tests/contract/routes/feedback.contract.test.ts            # rate-limit + 副作用断言
```

---

## 4. 关键端点设计要点

### 4.1 GET `/admin/moderation/pending-queue`

```typescript
// query
const PendingQueueQuerySchema = z.object({
  cursor: z.string().optional(),                    // opaque base64({createdAt, id})
  limit: z.coerce.number().int().min(1).max(50).default(30),
  type: VideoTypeSchema.optional(),
  sourceCheckStatus: z.enum(['pending', 'ok', 'partial', 'all_dead']).optional(),
  doubanStatus: z.enum(['pending', 'matched', 'candidate', 'unmatched']).optional(),
  hasStaffNote: z.coerce.boolean().optional(),
  needsManualReview: z.coerce.boolean().optional(),
})
```

- cursor 排序：`(created_at DESC, id DESC)` 稳定
- response：`{ data: VideoQueueRow[], nextCursor, total, todayStats }`
- `total`：当前筛选下全量待审数（COUNT；可缓存 30s）
- `todayStats`：当天 review 操作统计（来自 `admin_audit_log` 当日 + 本人）

### 4.2 POST `/admin/moderation/:id/reject-labeled`

```typescript
const RejectLabeledBodySchema = z.object({
  labelKey: z.string().max(64),
  reason: z.string().max(500).optional(),
})
```

实装：
1. 校验 `labelKey ∈ review_labels.is_active=true`，否则 fallback 到 `'other'`（不抛 LABEL_UNKNOWN，对齐 plan §3.1）
2. **乐观锁**：客户端透传 `If-Match: <video.updated_at ISO>` 或 body `expectedUpdatedAt: string`；调用 `transitionVideoState(id, { action: 'reject', expectedUpdatedAt })`（与 `apps/api/src/db/queries/videos.ts` 现行签名对齐：基于 `updated_at` 比对，不支持 `expectedOld`）；`expectedUpdatedAt` 不一致 → 抛 `REVIEW_RACE`
3. 同事务 / 事务后 UPDATE `videos.review_label_key`、`review_reason = reason ?? label.label`
4. fire-and-forget：`AuditLogService.write({ action_type: 'video.reject_labeled', ... })`
5. fire-and-forget：`VideoIndexSyncService.unindexVideo(id)`（**本卡新补方法**，见 §3.1）

### 4.3 POST `/admin/staging/:id/revert`

```typescript
const StagingRevertBodySchema = z.object({}).strict()  // 空 body
```

实装：
1. 乐观锁：`transitionVideoState(id, { action: 'staging_revert', expectedUpdatedAt })`（CHG-SN-4-03 ✅ 已支持 staging_revert action）
2. updated_at 不一致 → `REVIEW_RACE`
3. fire-and-forget：audit `staging.revert` + 不需 ES 同步（仍保持 internal/hidden）

### 4.4 POST `/admin/videos/:id/sources/disable-dead`

```typescript
// 事务（video_sources 表无 updated_at 列；既有 query 全部使用 last_checked）
BEGIN;
UPDATE video_sources SET is_active = false, last_checked = NOW()
  WHERE video_id = $1 AND deleted_at IS NULL AND probe_status = 'dead' AND is_active = true
  RETURNING id;
-- 触发视频级 source_check_status 重算（worker 异步聚合 / 或同步 helper）
COMMIT;
```

response：`{ data: { disabled: number, sourceIds: string[] } }`（沿用 §2.2 现行 `{ data }` 信封）
audit：`video_source.disable_dead_batch` with `before/after = { source_ids, count }`
ES：fire-and-forget `VideoIndexSyncService.syncVideo(videoId)` 重算文档（线路状态影响 source_check_status，可能影响搜索可见性；不需要 unindex）

### 4.5 POST `/v1/feedback/playback`（前台；route 内部 `/feedback/playback`）

```typescript
const PlaybackFeedbackBodySchema = z.object({
  videoId: z.string().uuid(),
  sourceId: z.string().uuid(),
  success: z.boolean(),
  resolutionWidth: z.number().int().positive().optional(),
  resolutionHeight: z.number().int().positive().optional(),
  bufferingCount: z.number().int().min(0).optional(),
  errorCode: z.string().max(64).optional(),
})
```

**rate-limit**：同一 `(userId|hash(IP), sourceId)` 每分钟 1 次（`RATE_LIMITED` 429）。  
**PII**：客户端不上报 userId/IP；后端仅存 `hash(IP)` 头 8 字节（plan §9 风险条 D-17）。  
**副作用**（异步入队 / fire-and-forget）：

- success=true + 之前 probe='dead' → `probe_status='ok'` + `last_probed_at=NOW()`
- success=true + `quality_detected IS NULL` + 提供 `resolutionHeight` → 写 `quality_detected` + `quality_source='player_feedback'`
- success=false → INSERT `source_health_events { origin:'feedback_driven', http_code, latency_ms?, error_detail, processed_at: NOW() }` 作为证据行
- success=false 连续 3 次（按 sourceId hash IP+UA 5 min 窗口）→ 追加一条 `origin:'feedback_driven', processed_at: NULL` 的队列信号，供 CHG-SN-4-06 worker 消费

> rate-limit 实装：复用 `apps/api/src/services/` 既有 limiter（如 `RateLimitService`）；如缺失先以 in-memory + Redis 备选评估，必要时升 Opus。

---

## 5. 实装步骤（建议顺序）

| Step | 内容 | 依赖 |
|------|------|------|
| 0 | **058a migration 落地**（§1.4 schema patch）+ docs/architecture.md §5.12 同步 | 无 |
| 1 | `apps/api/src/lib/errors.ts` 扩展 6 个本期新错误码（不新建 types/error-codes.ts 目录） | 无 |
| 2 | AuditLogService + tests（fire-and-forget 主路径不阻塞断言） | Step 1 |
| 3 | packages/types 12 端点 zod schema 全量导出（响应类型沿用 `{ data }` 形态） | 无 |
| 4 | **`VideoIndexSyncService.unindexVideo(id)` 补丁** + 单测（404 视为成功） | 无 |
| 5 | reviewLabels query + 路由 + contract test | Step 1+3 |
| 6 | sourceHealthEvents query + line-health 路由 + contract test | Step 1+3 |
| 7 | ModerationService（状态机 + audit + ES 编排） | Step 2+4 |
| 8 | reject-labeled / staff-note / staging revert / sources PATCH / disable-dead 路由 + contract test（用 `requireRole(['moderator','admin'])`） | Step 7 |
| 9 | pending-queue 路由（cursor + todayStats）+ contract test | Step 7 |
| 10 | 4 改端点（review labelKey / batch-reject / videos GET / staging GET）— 响应外壳不变，仅扩展 `data` 字段 | Step 7 |
| 11 | feedback/playback 前台路由 + rate-limit + PII hash + 058a queue 写入 + contract test | Step 0+1+3 |
| 12 | 全量回归：typecheck + lint + unit + contract + audit log grep 守门 | Step 1–11 |

---

## 6. 完成判据（must）

- [ ] typecheck 0 error / lint 0 warning / 禁 `any`
- [ ] unit + contract test 全绿
- [ ] **audit log grep 守门**：写端点（POST/PATCH/DELETE）vs `AuditLogService.write` 调用 1:1 对应
  ```bash
  grep -rE "(\.post|\.patch|\.delete)\b" apps/api/src/routes/admin/{moderation,staging,videos,reviewLabels}.ts | wc -l
  grep -rE "AuditLogService\.write\(" apps/api/src/services/ apps/api/src/routes/admin/ | wc -l
  # 二者 admin 写端点数 + audit fire-and-forget 数应一致（前台 feedback 不计）
  ```
- [ ] **响应格式覆盖**：所有新端点响应符合 api-rules.md `{ data }` / `{ data, pagination }` / `{ error: { code, message, status } }`；4 改端点响应外壳不变（仅扩展 `data` 字段）
- [ ] **VideoIndexSyncService.unindexVideo(id)** 已落地 + 单测覆盖 404 / 其他错误降级（不阻塞主路径）
- [ ] **058a migration**：`source_health_events.processed_at` + partial index 落地 + docs/architecture.md §5.12 同步
- [ ] **zod 覆盖**：每路由 handler 入口前有 `parseQuery` / `parseBody`；grep 路由文件 `as any` 0 命中
- [ ] feedback PII：grep `userId` / `ip` 直接 INSERT 应 0 命中（仅 hash 形式）
- [ ] commit trailer 遵循 git-rules.md §M-SN 扩展协议：`Refs:` / `Plan:` / `Review:` / `Executed-By-Model:` / `Subagents:`

---

## 7. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| `transitionVideoState` 与 audit log 事务边界不清 → 状态变了但 audit 未写 | 中 | 中 | audit fire-and-forget 在 commit 后；plan §3.0.5 明确"写入失败不阻塞主操作" |
| `disable-dead` 与 worker 聚合并发触发重算混乱 | 低 | 中 | worker 视频级 advisory lock（CHG-SN-4-06 实装）；本卡触发 NOTIFY 即可 |
| feedback rate-limit 实装缺失 → 滥用风险 | 中 | 高 | 步骤 10 必须 rate-limit + PII hash；如缺基础设施 → BLOCKER |
| ES 索引同步在 reject-labeled / disable-dead 上漏跑 | 中 | 中 | contract test 显式断言 `VideoIndexSyncService` 调用（mock + spy） |
| `pending-queue` cursor 实时变化重复行（plan §9 风险条 cursor）| 低 | 低 | `(created_at, id)` 双键稳定排序；contract test 覆盖 |

---

## 8. commit trailer 模板

遵循 `docs/rules/git-rules.md` §M-SN 扩展协议（`Refs:` / `Plan:` / `Review:` / `Executed-By-Model:` / `Subagents:`）：

```
feat(CHG-SN-4-05): 后端 API 8 新端点 + 4 改端点

Refs: CHG-SN-4-05
Plan: docs/designs/backend_design_v2.1/M-SN-4-05-api-endpoints-plan_20260502.md v1.1
Review: <arch-reviewer commit hash> PASS  # 如本卡未触发 Opus 评审写 n/a
Executed-By-Model: claude-sonnet-4-6
Subagents: none
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

> M-SN-4 序列均落在 `docs/rules/git-rules.md` §M-SN 扩展 trailer 适用范围内（M-SN-0 第三批 ADR PASS 起至 cutover + 7 天）。

---

## 9. 与上下游卡的契约边界

| 方向 | 卡 | 契约边界 |
|------|----|---------|
| 上游 | CHG-SN-4-03 | 052–060 schema + types ✅ |
| 本卡内 | 058a migration | 在 -05 内补 `source_health_events.processed_at` + index（feedback 入队信号产生方应同时建表） |
| 平行 | CHG-SN-4-06 worker | feedback 副作用（success=false 连续 3 次入队 Level 2 recheck）通过 `source_health_events.processed_at IS NULL` + `origin='feedback_driven'` queue 解耦，**双方零 import 依赖** |
| 下游 | CHG-SN-4-07 前端 | 12 端点 zod schema → `@resovo/types` 直接 import；不允许前端再造 schema |
| 下游 | CHG-SN-4-08 VideoEditDrawer | GET `/admin/videos/:id` 扩展字段 + review labelKey |

如本卡实装期间发现 schema / 状态机不足以支撑：触发 BLOCKER 写入 `docs/task-queue.md` 尾部；不允许"边走边改" schema（必须回 -03 修订）。
