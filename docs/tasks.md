# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-21
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## M5-API-BANNER-01 — home_banners migration + API

- **状态**：🔄 进行中
- **任务 ID**：M5-API-BANNER-01
- **所属序列**：SEQ-20260420-M5-API
- **创建时间**：2026-04-20 19:00
- **实际开始**：2026-04-21 10:00
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无

### 目标

新建 `home_banners` 表 + Banner CRUD API，为前端 HeroBanner 提供真实数据源。

### 文件范围

- 新增 `apps/api/src/db/migrations/049_create_home_banners.sql`
- 修改 `docs/architecture.md`：追加 home_banners schema 说明
- 新增 `apps/api/src/db/queries/home-banners.ts`
- 新增 `apps/api/src/services/BannerService.ts`
- 新增 `apps/api/src/routes/banners.ts`（公开 GET）
- 新增 `apps/api/src/routes/admin/banners.ts`（admin CRUD）
- 新增 `packages/types/src/banner.types.ts` + 更新 `packages/types/src/index.ts`
- 修改 `apps/api/src/server.ts`：注册路由
- 新增 `tests/unit/api/banners.test.ts`

### 验收要点

- `GET /v1/banners?locale=zh-CN` 返回时间窗内 is_active=true banner 列表，按 sort_order 升序
- `POST /PUT/DELETE /v1/admin/banners` 校验 admin 权限
- zod schema 覆盖所有字段（title jsonb 多语言）
- migration 049 幂等（IF NOT EXISTS）
- `docs/architecture.md` 已同步
- Route→Service→DB queries 分层纪律
- typecheck ✅ / lint ✅ / unit ✅

### 完成备注

（待填写）
