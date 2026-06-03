# title_observations 生产回填 runbook — identity blocking 召回数据源补齐

> status: active
> owner: @engineering（生产执行主体：用户/运维）
> scope: 生产环境 title_observations 全量回填 + identity 候选重算 + 验证报表的运维手册
> source_of_truth: code（scripts/backfill-title-observations.ts + scripts/report-title-observation-coverage.ts + scripts/enqueue-identity-rescore.ts + scripts/identity-compare-report.ts + apps/api/src/services/identity/offlineRescore.ts）
> related: ADR-105a / Migration 085（title_observations）+ 086（identity_candidate）/ CHG-VIR-6（采集链路 shadow 写入）/ CHG-VIR-8（离线候选 job）/ CHG-VIR-9-C（UI 切换，卡面前置"生产切 UI 前须先回填"）/ CHG-VIR-OBS-BACKFILL（本 runbook）
> last_reviewed: 2026-06-03

---

## 1. 背景与目的

identity 候选（CHG-VIR-8 离线 job）的 blocking 召回按 `title_observations.parsed_facets_jsonb->>'coreTitleKey'` 分桶——**blocking 召回覆盖 = title_observations 覆盖度**。

生产环境目前只有采集链路 fire-and-forget 写入（CHG-VIR-6 起，仅覆盖此后新采集的 video），**历史 video 无观测行 → 不进任何桶 → identity 候选召回不全、对比报表失真**。dev 环境已回填验证（见 §5 基线）。

**本回填是以下工作的硬前置**：

| 被阻塞项 | 关系 |
|---|---|
| CHG-VIR-9-C 生产切 UI | 卡面前置"生产切 UI 前须先回填 title_observations" |
| CHG-VIR-10（Phase 3 ingest shadow） | 生产未回填则 ingest shadow 召回不全、precision/recall 报表失真 |
| CHG-VIR-9-D（merge 默认源翻转 identity） | 硬前置：生产回填 + merge shadow 稳定 |

## 2. 安全性声明（先读再执行）

- **零生产归并行为变更**：全链路只写两张 shadow 表——`title_observations`（回填脚本）与 `identity_candidate`（重算 job）。**不触碰** `videos` / `media_catalog` / merge 链路 / 任何线上读路径的行为。
- **可中断、可重跑（真幂等）**：回填脚本用 `ON CONFLICT DO NOTHING`（已存在即跳过，**不累加 `observed_count`**）。任意时点 Ctrl-C 中断后重新执行即可，不会产生重复行或虚增观测计数。
  - 注意：这与采集链路 `recordTitleObservation`（DO UPDATE `observed_count + 1`，观测频次信号）**刻意不同**——回填语义 = 补历史观测一次性快照。回填与采集并发写同键时互不冲突（同一去重唯一键，先到先得）。
- **重算 job 幂等**：`identity_candidate` 写入走 evidence_hash 幂等 upsert（R5/R6，CHG-VIR-8），重复入队不产生重复候选；advisory lock 保证同时只有一个实例在跑（见 §4 Step 3）。
- **只读验证**：两个报表脚本（coverage / compare-report）均为只读，可在任意时点重复执行。

## 3. 前置检查清单

逐项确认后再进入 §4：

- [ ] **Migration 085 / 086 已应用**：`npm run migrate:check`（dry-run）确认无 pending 迁移；或在 DB 验证 `title_observations` / `identity_candidate` 表存在。
- [ ] **生产 API 进程运行中**：identity 重算 worker 注册在 apps/api 服务进程内（`server.ts` 启动时 `registerIdentityCandidateWorker()`），无独立 worker 进程。API 起着 = 消费者在线。
- [ ] **Redis 可用**：Bull 队列依赖（`enqueue-identity-rescore` 入队 + worker 消费）。
- [ ] **执行机环境**：仓库根目录、依赖已装（`npm ci`）、能连生产 DB 与 Redis 的 env 文件就绪。
- [ ] **env 文件**：下文命令以 `--env-file=.env.production` 为例；按实际生产 env 文件名替换。脚本读取与 apps/api 相同的 `DATABASE_URL` / Redis 连接配置。
- [ ] **执行窗口**：回填为单行 INSERT 循环（keyset 分批 500 读 + 逐行写），负载温和，无需停机窗口；建议避开采集高峰以减少 DB 写竞争（非强制）。

## 4. 执行步骤

### Step 0 — 回填前覆盖度快照（只读）

```bash
node --env-file=.env.production --import tsx scripts/report-title-observation-coverage.ts
```

记录输出（覆盖率、未覆盖数、桶数），作为回填前快照留档。生产首次执行预期：覆盖率低（仅 CHG-VIR-6 上线后新采集的 video 有观测）。

### Step 1 — 执行回填

```bash
node --env-file=.env.production --import tsx scripts/backfill-title-observations.ts
```

- 行为：keyset 分页（id 升序，批 500）遍历 `deleted_at IS NULL AND title IS NOT NULL` 的全部 videos，为每个 video 写一条 **site 级观测**（`source_site_key = NULL`，CHG-VIR-6 范式：video.title 对全源一致）。
- 进度：每 2000 个 video 打一行 `...已处理 N`；结束打 `✅ 回填完成：处理 N 个 video`。
- 量级参考：dev 3617 个 video 秒级完成；生产按 video 数线性外推。
- **中断处理**：直接重跑（§2 真幂等）。已写入的行被 DO NOTHING 跳过，从头扫一遍的成本可接受。

### Step 2 — 回填后覆盖度验证（只读）

```bash
node --env-file=.env.production --import tsx scripts/report-title-observation-coverage.ts
```

**通过判据**：

| 指标 | 预期 |
|---|---|
| 有观测 videos 覆盖率 | **100.0%**，`未覆盖 videos = 0`（回填对每个 eligible video 都写 site 级观测） |
| coreTitleKey 非空覆盖率 | 接近 100%；略低属正常（个别标题被 TitleIdentityParser 解析为空 key，Y4 护栏），这部分 video 不参与 blocking 召回 |
| 超护栏桶（n > 50） | 关注但不阻塞：oversize 桶会被 job 跳过（`bucketsSkippedOversize`）；若出现，记录 core_key 留待人工分析（通常是超泛化标题） |

覆盖率非 100% 时：确认 Step 1 是否完整跑完（看结束行）；重跑一次再验证；仍异常则按 §6 排查。

### Step 3 — 全量重算入队 + 确认完成

```bash
node --env-file=.env.production --import tsx scripts/enqueue-identity-rescore.ts
```

输出 `✅ 已入队 identity-rescore job: identity-rescore-<ts>`。job 由生产 API 进程内 Bull worker（concurrency 1）消费。

**完成确认**：在 API 进程日志中检索 `identity-rescore: done`（logger `worker: 'identity-candidate-worker'`），结构化字段含完整结果：

| 字段 | 含义 |
|---|---|
| `buckets` / `pairs` | 召回桶数 / 实际评分 pair 数 |
| `created` / `superseded` / `noop` / `revived` | 新建候选 / 版本替换 / 已存在跳过 / rejected 复活（R6） |
| `skippedRejected` / `skippedLowScore` | rejected 不复活跳过 / 低分跳过 |
| `bucketsSkippedOversize` | 超护栏（n > 50）跳过的桶数 |
| `blocked` | 强负拦截候选数 |
| `durationMs` | 耗时（dev 573 桶 ≈ 1.4s；生产按桶数线性外推） |

**`lockSkipped: true`**（日志 `another instance holds lock, skipping`）= 已有一个重算实例在跑，本次入队被跳过——等上一个 `identity-rescore: done` 后重新入队即可。

### Step 4 — 候选量级验证（只读）

```bash
node --env-file=.env.production --import tsx scripts/identity-compare-report.ts
```

**通过判据（与 §5 dev 基线同数量级）**：

- **候选密度** = `总候选数 ÷ eligible videos`（eligible 取 Step 2 输出）。dev 基线密度 ≈ **5.3%**（193 / 3617）。生产密度落在 dev 的 **0.1×–10× 区间**（约 0.5%–50%）视为同数量级。
- 三桶结构合理：`跨 group 新增召回` 与 `强负拦截` 均 > 0（生产数据存在标点/语言变体与强负冲突是常态）；抽样 30 条逐条目视可解释（标题对相似性与拦截原因直观成立）。
- 量级异常（密度超出区间、或候选数为 0）→ 按 §6 排查，**不要继续切 UI**。

### Step 5 — 留档

将 Step 0 / 2 / 3 / 4 的输出（覆盖度前后快照、`identity-rescore: done` 日志行、对比报表）留档到本次执行记录（贴入 task-queue.md 完成备注或运维工单），作为 CHG-VIR-9-C 生产切 UI 与 CHG-VIR-10 / 9-D 启动的依据。

## 5. dev 基线（2026-06-03 实测）

| 指标 | dev 值 |
|---|---|
| eligible videos | 3617 |
| 回填后覆盖率（有观测 / coreTitleKey 非空） | 100.0% / 100.0% |
| blocking 桶数（HAVING > 1） | 617 |
| pair 上限估算 ΣC(n,2) | 969 |
| 最大桶 video 数 / 超护栏桶 | 8 / 0 |
| pending 候选总数 | 193 |
| 跨 group 新增召回 / 强负拦截 | 170 / 159 |
| 候选密度 | ≈ 5.3% |
| full-rescan 耗时 | ≈ 1.4s（573 桶时，CHG-VIR-9-C 验证） |

注：dev 桶数 617 > 上次 full-rescan 时的 573，是重算后 observation 继续增长所致（候选 193 为上次重算产物）——这正说明**回填/观测变化后必须重新入队 full-rescan** 才会反映到候选。

## 6. 异常处置

| 现象 | 处置 |
|---|---|
| 回填中断（任何原因） | 直接重跑 Step 1（真幂等，§2） |
| 覆盖率重跑后仍非 100% | 核对 eligible 口径（`deleted_at IS NULL AND title IS NOT NULL`）；确认连接的是同一个 DB；检查回填脚本报错输出（FK 失败等会直接抛错中止） |
| `lockSkipped: true` | 等待当前实例 `identity-rescore: done` 后重新入队（§4 Step 3） |
| job 长时间无 `done` 日志 | 检查 API 进程存活 + Redis 连接；Bull job 可在 Redis 中查看状态；必要时重启 API 进程后重新入队（advisory lock 随连接释放） |
| `bucketsSkippedOversize > 0` | 记录 warn 日志中的 `core_key`，人工分析是否为超泛化标题；不阻塞验收 |
| 候选密度量级异常 | 检查 parser_version 分布（coverage 报表）是否存在版本不一致；确认 Step 3 完成后才跑 Step 4；仍异常 → 暂停切 UI，回报工程侧 |
| parser_version 残留旧版本行 | 不参与召回（job 只读当前 `TITLE_PARSER_VERSION`），无需清理；仅当占比异常时回报 |

## 7. 回滚

本回填**无生产行为可回滚**（shadow 表不参与任何线上决策路径）。如确需清空重来（例如灌错库）：

```sql
-- ⚠️ 仅限确认灌错时使用；会同时丢失采集链路积累的 observed_count 频次信号
DELETE FROM identity_candidate WHERE status = 'pending';
DELETE FROM title_observations;
```

注意：`identity_candidate` 仅删 `pending`——`confirmed` / `rejected` 行关联 `identity_decisions` 审计链（ADR-178），**不得删除**。删除后重新从 Step 1 执行。
