# Resovo（流光） — API 接口规范

> status: active
> owner: @engineering
> scope: api layer implementation rules
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 适用范围：`apps/api/src/routes/` 所有后端路由文件
> AI 在编写 API 接口前必须读取本文件

---

## 接口设计原则

- **Base URL**：`https://api.resovo.tv/v1`
- **协议**：HTTPS only
- **响应格式**：JSON，`Content-Type: application/json`
- **认证**：`Authorization: Bearer <access_token>`
- **版本**：路径版本号 `/v1/`，不使用 Header 版本

---

## 路由文件结构

```typescript
// apps/api/src/routes/videos.ts 标准结构
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { VideoService } from '@/api/services/VideoService'

export async function videoRoutes(fastify: FastifyInstance) {
  // 1. 实例化 Service（依赖注入）
  const videoService = new VideoService(fastify.db, fastify.es)

  // 2. 路由定义，含 schema 验证
  fastify.get('/videos', {
    schema: {
      querystring: z.object({
        type: z.enum(['movie', 'series', 'anime', 'variety']).optional(),
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(20),
      }),
      response: {
        200: z.object({
          data: z.array(VideoSchema),
          pagination: PaginationSchema
        })
      }
    }
  }, async (request, reply) => {
    const videos = await videoService.list(request.query)
    return reply.send(videos)
  })
}
```

---

## 响应格式规范

### 成功响应
```json
// 单个资源
{ "data": { "id": "...", "title": "..." } }

// 列表资源
{
  "data": [...],
  "pagination": {
    "total": 47,
    "page": 1,
    "limit": 20,
    "hasNext": true
  }
}

// 无内容
// HTTP 204，无 body
```

### 错误响应（统一格式）
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "视频不存在或已被删除",
    "status": 404
  }
}
```

### 错误码规范
```typescript
// 在 packages/types/src/api-errors.ts 中统一定义（ADR-110 决策；apps/api/src/lib/errors.ts 仅保留 AppError class + isAppError + makeError 工具）
export const ErrorCodes = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
  RATE_LIMITED: 429,
} as const
```

---

## 参数验证（必须用 Zod）

```typescript
// ✅ 所有输入参数用 Zod schema 验证
const QuerySchema = z.object({
  q: z.string().min(1).max(100),
  director: z.string().optional(),
  actor: z.string().optional(),
  writer: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ❌ 不使用裸 JavaScript 校验
if (!req.query.q || typeof req.query.q !== 'string') { ... }
```

---

## 认证中间件

```typescript
// 需要认证的路由使用 preHandler
fastify.post('/lists', {
  preHandler: [fastify.authenticate],  // 必须登录
  // ...
})

// 需要特定角色的路由
fastify.post('/lists', {
  preHandler: [
    fastify.authenticate,
    fastify.requireRole(['admin', 'moderator'])  // 片单需要权限
  ],
  // ...
})

// 可选认证（游客也能访问，但登录用户有额外字段）
fastify.get('/videos/:id', {
  preHandler: [fastify.optionalAuthenticate],
  // ...
})
```

---

## 分页规范

```typescript
// 所有列表接口使用统一分页参数
// ?page=1&limit=20（默认），?page=2&limit=50

// 响应中必须包含 pagination 对象
const response = {
  data: results,
  pagination: {
    total: count,
    page: query.page,
    limit: query.limit,
    hasNext: query.page * query.limit < count
  }
}
```

---

## 幂等操作规范

```typescript
// 收藏/点赞等切换操作使用单一 POST，响应当前状态
// POST /users/me/favorites/:shortId
// POST /lists/:shortId/like

// 响应格式
{ "favorited": true, "count": 42 }
// 或
{ "liked": false, "like_count": 41 }
```

---

## 速率限制

```typescript
// 在 CLAUDE.md 禁止清单之外，以下接口有额外限流：
// POST /auth/login        → 10次/分钟/IP，失败5次锁定15分钟
// GET  /search            → 60次/分钟/IP
// POST /videos/:id/danmaku → 20条/分钟/用户
// POST /admin/sources/submit → 50条/天/用户
```

---

## 向后兼容原则

- **不得删除**已存在的 API 路径
- **不得重命名**响应字段（新增字段可以）
- **不得改变**字段类型（string 不能改成 number）
- 需要破坏性变更时，在新路径下实现（如 `/v2/videos`），旧路径保留至少 3 个月

---

## admin_audit_log 写入规范（CHG-SN-4-10-D Y2）

所有 admin 写操作（POST/PATCH/DELETE）成功路径上必须 fire-and-forget 写入 `admin_audit_log`。
真源：M-SN-4 plan v1.4 §3.0.5（11 个 action_type union 在 `packages/types/src/admin-moderation.types.ts` `AdminAuditActionType`）。

### 调用契约（强约束 — 守卫测试依赖）

```typescript
// ✅ 必须用 actionType 字面量调用（守卫正则 actionType:\s*['"]([a-z_.]+)['"] 依赖此格式）
this.auditSvc.write({
  actorId: input.actorId,
  actionType: 'video.approve',  // ← 字面量，不允许动态拼接
  targetKind: 'video',
  targetId: input.videoId,
  requestId: input.requestId,
})

// ❌ 禁止：动态拼接（守卫扫不到）
const type = `video.${action}`
this.auditSvc.write({ actionType: type, ... })

// ❌ 禁止：snake_case key（不是 AdminAuditActionType union 字段名）
this.auditSvc.write({ action_type: 'video.approve', ... })
```

### 写入位点设计原则

- **service 层 audit**（业务编排型操作）：ModerationService / VideoService / StagingPublishService 等
- **路由层 audit**（异步入队型操作）：refetch-sources 等"管理员触发 → worker 异步消费"场景，audit 应在路由层入队成功后写，不在 service（service 是 worker 异步执行体，与"触发事件"解耦）
- **audit 参数 optional**：同时支持 admin 显式调用（传 audit）与 worker 自动 Job（不传不写）

### 守卫

- `tests/unit/api/audit-log-coverage.test.ts` 三层断言：
  - 11 个 plan §3.0.5 action_type 必须有写入位点
  - 不允许出现 plan 未声明的 action_type（防漂移）
  - 总覆盖断言（防有人删测试 + 删 audit）

### 新增 action_type 流程

1. 改 plan §3.0.5 表（before/after 字段）
2. 改 `packages/types/src/admin-moderation.types.ts` `AdminAuditActionType` union
3. 改 `tests/unit/api/audit-log-coverage.test.ts` `REQUIRED_ACTION_TYPES`
4. 在 service 或路由层加 `auditSvc.write({ actionType: '...', ... })` 字面量调用
