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
| sn4-05-api | ✅ 已集成 | `track/sn4-05-api`（已删除）| `docs/archive/tasks/tasks-sn4-05-api.md` | 无（已释放） | 2026-05-02 | 2026-05-02 |
| sn4-06-worker | ✅ 已集成 | `track/sn4-06-worker`（已删除）| `docs/archive/tasks/tasks-sn4-06-worker.md` | 无（已释放） | 2026-05-02 | 2026-05-02 |
| sn4-07-fe-moderation | 🔄 活跃 | `track/sn4-07-fe-moderation` | `docs/tasks-sn4-07-fe-moderation.md` | `app:server-next:moderation` | 2026-05-02 | — |
| sn4-08-video-edit-drawer | 🔄 活跃 | `track/sn4-08-video-edit-drawer` | `docs/tasks-sn4-08-video-edit-drawer.md` | `app:server-next:videos` | 2026-05-02 | — |

**当前活跃 Track 数：2 / 3**（上限 3，含主干）— M-SN-4 阶段 C 双轨启动

---

## sn4-05-api

- **状态**：✅ 已集成（2026-05-02，PR commit `8a797ec`）
- **分支**：`track/sn4-05-api`（已删除）
- **任务文件**：`docs/archive/tasks/tasks-sn4-05-api.md`（已归档）
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
- **持有冲突域**：无（已释放，集成时 architecture.md §5.12 已落 main）
- **创建时间**：2026-05-02
- **集成时间**：2026-05-02
- **建议模型**：`claude-sonnet-4-6`（plan §8.1）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-05-api-endpoints-plan_20260502.md` v1.1
- **说明**：CHG-SN-4-05 后端 API（8 新端点 + 4 改端点 + 058a schema patch + ApiResponse 信封 + RBAC + audit log + 并发保护）。关键路径：解锁 CHG-SN-4-07 / -08 前端卡。
- **集成评级**：A 级（arch-reviewer claude-opus-4-7 复核 2 轮 PASS；237 文件 / 2998 测试全绿；DEBT-SN-4-05-A/B/C 已登记）

---

## sn4-06-worker

- **状态**：✅ 已集成（2026-05-02，PR commit `cc27eef`）
- **分支**：`track/sn4-06-worker`（已删除）
- **任务文件**：`docs/archive/tasks/tasks-sn4-06-worker.md`（已归档）
- **文件作用域**：
  - `apps/worker/**`（新建独立 service）
  - 根 `package.json`（workspaces 追加 `"apps/worker"`）
  - `package-lock.json`（npm install 同步）
  - `TEMPLATES.md`（worker 模板入口同步）
  - `CLAUDE.md`（视情况修订 v1 时期 `apps/web/...` 旧表述，详见 plan v1.4 §665）
  - CI workflow（如存在覆盖 apps/worker，不存在则 README 记录未配置）
  - `docs/decisions.md`（ADR-107 worker 部署归属落地）
- **持有冲突域**：无（已释放，集成时根 package.json workspaces 已落 main）
- **创建时间**：2026-05-02
- **集成时间**：2026-05-02
- **建议模型**：`claude-sonnet-4-6`（plan §8.1）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-06-worker-source-health-plan_20260502.md` v1.1
- **说明**：CHG-SN-4-06 `apps/worker` 新建 + SourceHealthWorker Level 1+2 + 分辨率采集 + advisory lock 视频级聚合 + 站点熔断 + pino 可观测。Step 1–9 与 -05 完全并行；Step 10（feedback-driven-recheck）依赖 058a migration（CHG-SN-4-05 已落地）；R-1 修复保证 058a 缺失时优雅降级不崩溃。
- **集成评级**：A− 级（arch-reviewer claude-opus-4-7 复核 2 轮 PASS；246 文件 / 3045 测试全绿；唯一扣分：R-1 catch 路径无 unit）

---

## 集成顺序约定

```
原推荐：sn4-06-worker 先集成 → main → sn4-05-api 后集成
实际执行（2026-05-02 复核后修订）：sn4-05-api 先集成 → main → sn4-06-worker rebase → sn4-06-worker 后集成
```

修订原因：sn4-06 第一轮审核发现 R-1 阻塞（feedback-driven-recheck 引用 058a 列），先集成 -05 让 worker 启动即满血运行；R-1 修复后约束放松但顺序仍最优。

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

---

## sn4-07-fe-moderation

- **状态**：🔄 活跃
- **分支**：`track/sn4-07-fe-moderation`
- **任务文件**：`docs/tasks-sn4-07-fe-moderation.md`
- **文件作用域**：
  - `apps/server-next/src/app/admin/moderation/**`（page.tsx + _client/* 全部）
  - `apps/server-next/src/lib/moderation/**`（新建；API 客户端 + hooks）
  - `apps/server-next/src/i18n/messages/zh-CN/moderation.ts`（新建；i18n keys per plan §5.0.5）
  - `tests/unit/server-next/moderation/**`（新建）
  - `tests/visual/moderation/**`（新建；7 张 visual baseline per plan §1190-1202）
- **持有冲突域**：`app:server-next:moderation`（自定义软冲突域，命名空间隔离）
- **创建时间**：2026-05-02
- **集成时间**：—
- **建议模型**：`claude-sonnet-4-6`（plan §8.1 - 4 工作日）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §5（六项前端共性约束 + 三 Tab 操作流程）
- **说明**：CHG-SN-4-07 审核台前端接入：useTableQuery 状态保留 + Gmail 流虚拟滚动 + 键盘流作用域 + RejectModal 接线 + LinesPanel 真实数据 + LineHealthDrawer 接线 + StaffNoteBar + i18n + a11y + visual baseline。前置依赖 -04（admin-ui 5 件）+ -05（后端 API）+ -05a（ErrorCode 真源）+ -05b（CONFLICT status）全部已就位。

---

## sn4-08-video-edit-drawer

- **状态**：🔄 活跃
- **分支**：`track/sn4-08-video-edit-drawer`
- **任务文件**：`docs/tasks-sn4-08-video-edit-drawer.md`
- **文件作用域**：
  - `apps/server-next/src/app/admin/videos/_client/**`（仅 VideoEditDrawer 相关；不动 VideoListClient 主结构）
  - `apps/server-next/src/lib/videos/**`（扩展；API 客户端 + 三 Tab hooks）
  - `tests/unit/server-next/videos/video-edit-drawer/**`（新建）
  - `tests/visual/admin-videos/video-edit-drawer-lines-tab.png`（新建；1 张 visual baseline per plan §1202）
- **持有冲突域**：`app:server-next:videos`（自定义软冲突域，命名空间隔离）
- **创建时间**：2026-05-02
- **集成时间**：—
- **建议模型**：`claude-sonnet-4-6`（plan §8.1 - 4 工作日）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §6（VideoEditDrawer 三 Tab 真实 API）
- **说明**：CHG-SN-4-08 VideoEditDrawer 三 Tab 真实 API：线路 / 图片 / 豆瓣（依赖 054/059 字段 + apps/api admin/videos GET 扩展）。前置依赖 -04 + -05 + -05a + -05b 全部已就位；可与 sn4-07 完全并行。

---

## 集成顺序约定（sn4-07 / sn4-08 双轨）

```
推荐：任一先完成即先集成（无依赖关系）
推测：sn4-08 先完成（VideoEditDrawer 范围更聚焦）→ main → sn4-07 rebase → sn4-07 后集成
```

理由：
- 两条 Track 文件作用域完全隔离（moderation/ vs videos/_client/VideoEditDrawer 部分）
- 共享层（packages/admin-ui / packages/types / apps/api）不变
- 集成顺序不影响功能；冲突点仅 docs/changelog.md 末尾追加（按上次 sn4-05/-06 经验，rebase 时手工合并即可）

**集成阶段 task-queue.md Type B 写入串行**：一次一条 Track，禁止并发原地更新任务状态。

---

## 共享层冻结约定（双轨期内）

以下文件 Track 期内**禁止改动**（如必须改 → BLOCKER 上报，转串行新卡）：

- `packages/admin-ui/src/**`（5 件下沉组件 + DataTable 等已就位，本期不扩展）
- `packages/types/src/**`（ErrorCode 真源已统一，新增类型须先评估）
- `packages/design-tokens/**`
- `apps/api/src/**`（后端 API 已 freeze；如需改契约 → BLOCKER）
- `apps/worker/src/**`
- `docs/decisions.md`（新 ADR 须先评估）
- `docs/architecture.md`（schema/分层变更须先评估）

允许改的协调文件（append-only / per-track 区块）：
- `docs/changelog.md`（尾部追加，每条带 Track ID）
- `docs/tracks.md`（仅自己的命名区块）
