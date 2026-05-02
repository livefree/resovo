# Resovo（流光） — 并行 Track 注册表

> status: active
> owner: @engineering
> scope: parallel track lifecycle, conflict zone ownership
> source_of_truth: yes
> last_reviewed: 2026-05-02
>
> 协调中枢。规则真源：`docs/rules/parallel-dev-rules.md` v1.1。
> 多 Track 并发写入冲突规避：每条 Track 只写自己的 `## <track-id>` 区块；本文件顶部汇总表由人工 / 操作员在 Open / Close 时维护。

---

## 汇总表（人工维护）

| Track ID | 状态 | 分支 | 任务文件 | 持有冲突域 | Open 时间 | 集成时间 |
|---|---|---|---|---|---|---|
| sn4-05-api | 🔄 活跃 | `track/sn4-05-api` | `docs/tasks-sn4-05-api.md` | `architecture` | 2026-05-02 | — |
| sn4-06-worker | 🔄 活跃 | `track/sn4-06-worker` | `docs/tasks-sn4-06-worker.md` | `workspace-root` | 2026-05-02 | — |

**当前活跃 Track 数：2 / 3**（上限 3，含主干）

---

## sn4-05-api

- **状态**：🔄 活跃
- **分支**：`track/sn4-05-api`
- **任务文件**：`docs/tasks-sn4-05-api.md`
- **文件作用域**：
  - `apps/api/src/routes/admin/moderation/**`
  - `apps/api/src/routes/admin/videos/**`
  - `apps/api/src/routes/admin/sources/**`
  - `apps/api/src/routes/feedback.ts`（前台）
  - `apps/api/src/routes/playback.ts`（前台）
  - `apps/api/src/services/moderation/**`
  - `apps/api/src/services/audit/**`
  - `apps/api/src/db/migrations/058a_source_health_events_processed_at.sql`
  - `apps/server-next/src/lib/api/**`（前端 API 客户端层）
  - `packages/types/src/api/**`（ApiResponse 信封 / errorCode 枚举 / DTO）
  - `docs/architecture.md` §5.12（058a 列 + ApiResponse 信封段）
- **持有冲突域**：`architecture`
- **创建时间**：2026-05-02
- **集成时间**：—
- **建议模型**：`claude-sonnet-4-6`（plan §8.1）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-05-api-endpoints-plan_20260502.md` v1.1
- **说明**：CHG-SN-4-05 后端 API（8 新端点 + 4 改端点 + 058a schema patch + ApiResponse 信封 + RBAC + audit log + 并发保护）。关键路径：解锁 CHG-SN-4-07 / -08 前端卡。

---

## sn4-06-worker

- **状态**：🔄 活跃
- **分支**：`track/sn4-06-worker`
- **任务文件**：`docs/tasks-sn4-06-worker.md`
- **文件作用域**：
  - `apps/worker/**`（新建独立 service）
  - 根 `package.json`（workspaces 追加 `"apps/worker"`）
  - `package-lock.json`（npm install 同步）
  - `TEMPLATES.md`（worker 模板入口同步）
  - `CLAUDE.md`（视情况修订 v1 时期 `apps/web/...` 旧表述，详见 plan v1.4 §665）
  - CI workflow（如存在覆盖 apps/worker，不存在则 README 记录未配置）
  - `docs/decisions.md`（ADR-107 worker 部署归属落地）
- **持有冲突域**：`workspace-root`
- **创建时间**：2026-05-02
- **集成时间**：—
- **建议模型**：`claude-sonnet-4-6`（plan §8.1）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-06-worker-source-health-plan_20260502.md` v1.1
- **说明**：CHG-SN-4-06 `apps/worker` 新建 + SourceHealthWorker Level 1+2 + 分辨率采集 + advisory lock 视频级聚合 + 站点熔断 + pino 可观测。Step 1–9 与 -05 完全并行；Step 10（feedback-driven-recheck）进入前需验证 -05 的 058a migration 已就位（缺失 → BLOCKER 等 -05 完成）。

---

## 集成顺序约定

```
推荐：sn4-06-worker 先集成 → main → sn4-05-api 后集成
```

理由：
- sn4-05-api 是关键路径（解锁 -07/-08），最后集成可吃到 -06 的 main HEAD 验证
- sn4-06-worker 与 -05 文件域零重叠，先集成不影响 -05 工作
- 若 -05 先完成，可先 -05 后 -06，-06 rebase 一次即可（无文件交集）

**集成阶段 task-queue.md Type B 写入串行**：一次一条 Track，禁止并发原地更新任务状态。

---

## ADR 写入协调

- ADR-107（worker 部署归属）→ sn4-06-worker 落地
- ADR-108 / ADR-109（如 -05 触发新决策）→ sn4-05-api 落地
- 同时改 `docs/decisions.md` 时串行：先 -06 写 ADR-107 commit，-05 后续基于最新 main rebase 后追加

---

## BLOCKER 与冲突域释放

任一 Track 写入 BLOCKER 时：
- 写入对应 `docs/tasks-<id>.md`（不写本文件 / 不写 docs/tasks.md）
- 若 BLOCKER 涉及冲突域释放等待，本表"持有冲突域"字段保持当前持有方
- 集成完成 → 本表对应 Track 区块"持有冲突域"清空为 `无`，状态改 `✅ 已集成`，集成时间填写
