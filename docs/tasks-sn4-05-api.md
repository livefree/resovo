# Resovo（流光） — Track sn4-05-api 任务工作台

> Track: sn4-05-api
> 分支：`track/sn4-05-api`
> status: active
> owner: @engineering
> source_of_truth: yes（本 Track 内）
> last_reviewed: 2026-05-02
>
> 单任务工作台（Track 内）：同一时刻只保留 1 个进行中任务。Track 注册表见 `docs/tracks.md`，并行规则真源 `docs/rules/parallel-dev-rules.md` v1.1。
>
> **本 Track 持有冲突域**：`architecture`（`docs/architecture.md` §5.12）
> **集成阶段 task-queue.md Type B 写入**：禁止在本分支执行；统一在 PR 合并到 main 时由集成方串行更新。

---

## 完成任务

### CHG-SN-4-05 · 后端 API：8 新端点 + 4 改端点 + 058a schema patch · ✅ 完成

- **来源序列**：`docs/task-queue.md` SEQ-20260501-01（M-SN-4 阶段 B 双轨）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-05-api-endpoints-plan_20260502.md` v1.1
- **建议主循环模型**：`claude-sonnet-4-6`（plan §8.1）
- **强制子代理**：否（plan §8.1；如出现新 ADR 级决策再升 Opus）
- **前置**：CHG-SN-4-03 ✅
- **下游解锁**：CHG-SN-4-07（审核台前端接入）+ CHG-SN-4-08（VideoEditDrawer 三 Tab 真实 API）

#### 范围（详见 plan §3 文件清单）

- 8 新端点 + 4 改端点（plan §2 端点清单）
- ApiResponse 信封 + errorCode 枚举（plan §1.1 + §1.2，写入 `packages/types/src/api/**`）
- RBAC（plan §1.3）
- audit log 写入（plan §1.5，对接 052 audit_log + 053 状态机）
- 并发保护（plan §1.6）
- 058a migration：`source_health_events.processed_at` + partial index（plan §1.4，本 Track 内补齐）
- `docs/architecture.md` §5.12 同步（058a 列 + ApiResponse 信封段）
- 前端 API 客户端层 `apps/server-next/src/lib/api/**`
- zod schema 自审 → @resovo/types 出口

#### 文件作用域（不得越界）

```
apps/api/src/routes/admin/moderation/**
apps/api/src/routes/admin/videos/**
apps/api/src/routes/admin/sources/**
apps/api/src/routes/feedback.ts        # 前台 feedback
apps/api/src/routes/playback.ts        # 前台 playback
apps/api/src/services/moderation/**
apps/api/src/services/audit/**
apps/api/src/db/migrations/058a_source_health_events_processed_at.sql
apps/server-next/src/lib/api/**
packages/types/src/api/**
docs/architecture.md                   # §5.12 段
docs/decisions.md                      # 仅 ADR-108/109 如触发；与 sn4-06-worker 串行
```

**禁止触碰**：
- `apps/worker/**`（sn4-06-worker 持有）
- 根 `package.json` / `package-lock.json`（`workspace-root` 冲突域，sn4-06-worker 持有）
- `packages/admin-ui/**`（不在本卡范围）
- `docs/task-queue.md` Type B 字段（集成阶段串行）

#### 执行步骤（来自 plan §6 Step 列表，节选）

| Step | 内容 | 依赖 |
|---|---|---|
| 0 | 058a migration 落地 + docs/architecture.md §5.12 同步 | 无 |
| 1 | ApiResponse 信封 + errorCode 枚举（packages/types） | Step 0 |
| 2 | RBAC 中间件 / audit log 复用层 | Step 1 |
| 3 | admin moderation 端点（8 新 + 4 改部分） | Step 2 |
| ... | （详见 plan §6 完整 Step 表） | |
| 11 | feedback / playback 前台路由 + rate-limit + PII hash + 058a queue 写入 + contract test | Step 0+1+3 |

#### 质量门禁（在本 Track 分支独立通过）

```bash
npm run typecheck
npm run lint
npm run test -- --run
# API contract test（plan §8.1 列出）
```

不属于 PLAYER/AUTH/SEARCH/VIDEO 范畴 → 不要求 `npm run test:e2e`（parallel-dev-rules §六继承条款）。

#### 与 sn4-06-worker 的协调点

- **058a migration**：本 Track 在 Step 0 落地；-06 Step 10 进入前会 grep 验证存在
- **packages/types**：本 Track 改 ApiResponse 信封；-06 worker 不消费 @resovo/types（plan §技术栈：worker 自建轻量 pg.Pool）→ 无契约冲突
- **architecture.md**：本 Track 独占；-06 任何文档需求只追加在自身 plan 内
- **decisions.md**：如本卡触发 ADR-108/109，需与 sn4-06-worker 的 ADR-107 串行写入

#### 集成

- 集成 PR 标题：`track(sn4-05-api): CHG-SN-4-05 后端 API 8 新 + 4 改 + 058a`
- 推荐集成顺序：等 sn4-06-worker 先集成到 main → 本 Track rebase → PR 合并
- PR 合并后：删除 `track/sn4-05-api` 分支 / 更新 `docs/tracks.md` 本 Track 区块为 ✅ 已集成 / 本文件归档至 `docs/archive/tasks/`

#### 完成备注（2026-05-02）

- **执行模型**：`claude-sonnet-4-6`；子代理调用：无
- **文件拆分**：`videos.ts`（629 行）→ 拆分为 `videos.ts`（448 行）+ `videoImages.ts`（图片路由）+ `videoSources.ts`（线路路由 + refetch-sources）
- **新测试文件**：10 个测试文件，新增 62 个 test case（共 3044 个，全绿）
- **审计日志守门**：5 写操作 ↔ 5 个 AuditLogService.write 调用，1:1 覆盖
- **未触碰冲突域**：apps/worker ✅ / package.json ✅ / packages/admin-ui ✅

---

## BLOCKER 区

> 本 Track 触发的 BLOCKER 写入此处（不写入主 docs/tasks.md / docs/task-queue.md）。
> 当前：无
