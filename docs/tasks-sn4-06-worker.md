# Resovo（流光） — Track sn4-06-worker 任务工作台

> Track: sn4-06-worker
> 分支：`track/sn4-06-worker`
> status: active
> owner: @engineering
> source_of_truth: yes（本 Track 内）
> last_reviewed: 2026-05-02
>
> 单任务工作台（Track 内）：同一时刻只保留 1 个进行中任务。Track 注册表见 `docs/tracks.md`，并行规则真源 `docs/rules/parallel-dev-rules.md` v1.1。
>
> **本 Track 持有冲突域**：`workspace-root`（根 `package.json` workspaces 追加）
> **集成阶段 task-queue.md Type B 写入**：禁止在本分支执行；统一在 PR 合并到 main 时由集成方串行更新。

---

## 进行中任务

### CHG-SN-4-06 · apps/worker 新建 + SourceHealthWorker Level 1+2 · 🔄 进行中

- **来源序列**：`docs/task-queue.md` SEQ-20260501-01（M-SN-4 阶段 B 双轨）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-06-worker-source-health-plan_20260502.md` v1.1
- **建议主循环模型**：`claude-sonnet-4-6`（plan §8.1）
- **强制子代理**：否（plan §8.1）
- **前置**：CHG-SN-4-03 ✅
- **与 sn4-05-api 关系**：Step 1–9 完全并行；Step 10（feedback-driven-recheck）进入前必须 grep 验证 `apps/api/src/db/migrations/058a_*` 存在，缺失 → BLOCKER 等 -05 完成

#### 范围（详见 plan §3 文件清单）

- `apps/worker` 新建独立 Node.js service（package.json / tsconfig.json / README.md / index.ts 入口 + signal handlers）
- SourceHealthWorker Level 1（健康度判定）+ Level 2（分辨率采集）
- advisory lock 视频级聚合（避免多任务并发污染）
- 站点熔断（**单实例约束**：内存熔断状态本期不外移 Redis；多实例水平扩展列入 M-SN-6 性能门）
- pino 可观测（结构化日志，遵守 `docs/rules/logging-rules.md` worker job 段）
- node-cron 定时调度
- worker 自建轻量 `pg.Pool`，复用 `DATABASE_URL` 等 env，**不 import** `apps/api` 内部文件
- 仓内同步 5 项：根 `package.json` workspaces / `package-lock.json` / `TEMPLATES.md` / `CLAUDE.md`（如必要）/ CI workflow（覆盖或 README 记录未配置）
- ADR-107（worker 部署归属）落地至 `docs/decisions.md`

#### 文件作用域（不得越界）

```
apps/worker/**                          # 新建独立 service
package.json                            # workspaces 追加 "apps/worker"
package-lock.json                       # npm install 同步
TEMPLATES.md                            # worker 模板入口
CLAUDE.md                               # 视情况修订 v1 时期 apps/web/... 旧表述（plan §665）
.github/workflows/**                    # 如存在覆盖 apps/worker
docs/decisions.md                       # ADR-107 worker 部署归属（与 sn4-05-api 串行）
README.md                               # 如 CI 不存在则记录未配置
```

**禁止触碰**：
- `apps/api/**`（sn4-05-api 持有；本 Track 与之解耦，仅通过 DB 表 `source_health_events` + `processed_at` 列通信）
- `apps/server-next/**`
- `packages/admin-ui/**`
- `packages/types/**`（worker 不消费 @resovo/types，自建轻量类型）
- `docs/architecture.md`（sn4-05-api 持有；任何 schema 文档需求只追加在自身 plan 内）
- `docs/task-queue.md` Type B 字段（集成阶段串行）

#### 执行步骤（来自 plan §6 Step 列表，节选）

| Step | 内容 | 依赖 |
|---|---|---|
| 1 | 仓内同步 5 项（package.json workspaces / npm install / TEMPLATES.md / CLAUDE.md / CI） | 无 |
| 2 | apps/worker/{package.json,tsconfig.json,README.md} 起骨架 + index.ts 空入口 + signal handlers | Step 1 |
| ... | （详见 plan §6 完整 Step 表，Level 1 / Level 2 / advisory lock / 熔断 / pino） | |
| 9 | 集成测试 + worker integration test | 前序全部 |
| 10 | feedback-driven-recheck | **依赖 -05 058a migration 上线**；进入前 grep 验证 |

**单实例约束**（plan v1.2 + D-16）：本期 worker 单实例运行；多实例水平扩展须把熔断 / advisory lock 协调状态外移到 Redis 或 DB（M-SN-6 性能门或独立卡），不在本卡范围。部署文档须标注"单实例"约束。

#### 质量门禁（在本 Track 分支独立通过）

```bash
npm run typecheck
npm run lint
npm run test -- --run
# worker integration test（plan §8.1 列出）
```

不属于 PLAYER/AUTH/SEARCH/VIDEO 范畴 → 不要求 `npm run test:e2e`（parallel-dev-rules §六继承条款）。

#### 零新依赖红线（plan §硬约束）

`apps/worker/package.json` 仅含技术栈以内依赖：`pino` / `node-cron` / `pg` / `zod` 等已存在的 npm 包；任何新增 → 必须先 BLOCKER 用户裁定（CLAUDE.md 绝对禁止条款）。

#### 与 sn4-05-api 的协调点

- **058a migration**：本 Track Step 10 进入前 `grep apps/api/src/db/migrations/058a_*`：
  - 已存在 → 继续
  - 不存在 → 写本 Track BLOCKER 等 -05 集成；Step 1–9 不受影响
  - 不要 cherry-pick（运行时 schema 依赖，需真正落地）
- **ADR-107**：本卡落地；如 sn4-05-api 触发 ADR-108/109，串行写入 `docs/decisions.md`
- **packages/types**：本 Track 不消费，零冲突

#### 集成

- 集成 PR 标题：`track(sn4-06-worker): CHG-SN-4-06 apps/worker + SourceHealthWorker Level 1+2`
- 推荐集成顺序：本 Track 先集成（独立无下游） → main → sn4-05-api 后集成
- PR 合并后：删除 `track/sn4-06-worker` 分支 / 更新 `docs/tracks.md` 本 Track 区块为 ✅ 已集成 / 本文件归档至 `docs/archive/tasks/`

---

## BLOCKER 区

> 本 Track 触发的 BLOCKER 写入此处（不写入主 docs/tasks.md / docs/task-queue.md）。
> 当前：无
