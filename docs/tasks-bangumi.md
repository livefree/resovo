# Resovo（流光） — Track bangumi 任务看板

> Track: bangumi
> 分支: track/bangumi（从 main HEAD afa10184 切出）
> 来源序列: SEQ-BANGUMI-01（Bangumi.tv 接入：动漫元数据增强 + 反向建库）
> 执行真源: ~/.claude/plans/bangumi-tv-bangumi-https-bangumi-tv-dev-enumerated-cosmos.md（已批准）
> last_reviewed: 2026-05-27

并行模式：与 main 上 server-next 改进 WIP 并行。本 Track 文件域限 `apps/api/**` + `scripts/**`，
docs 硬冲突域（adr / architecture）已在 tracks.md 声明持有。
单活任务约束：同一时刻仅 1 个 `🔄 进行中`。

---

## 进行中任务

（空 — Phase 0/1/2 全部完成 ✅，含 CHG-BNG-09 cron；Track 可进入集成 PR 准备）

---

## 已完成任务

### ✅ CHG-BNG-09（Phase 2-C）— worker cron 本地 dump 定时重导

- **状态**：✅ 完成（2026-05-27）
- **执行模型**：claude-opus-4-7（主循环）
- **用户决策**：方案「本地 dump 定时重导」（零新依赖，避开 GitHub 归档 ZIP 解压需引入新依赖的 BLOCKER；不自动下载，dump 由 ops provision）。
- **完成备注**：
  - 新建 `apps/worker/src/jobs/bangumi-dump-refresh.ts`：`parseBangumiLine`（纯函数，type=2 过滤 / 标题回退 / 年份 / rank>0 / nsfw / 归一化）+ `upsertBatch`（与 scripts 同列 ON CONFLICT）+ `runBangumiDumpRefresh(pool, log, filePath)`（流式批量；文件缺失 warn+返回不崩 cron）。
  - `config.ts` 加 `cron.bangumiDumpRefresh`（env `WORKER_CRON_BANGUMI_DUMP`，默认每周日 04:00）+ `bangumiDumpPath`（env `BANGUMI_DUMP_PATH`）。
  - `index.ts` 接线 `bangumiDumpTask`（start/stop/启动日志；**不 boot 跑**，重活只按 schedule）。
  - `.env.example` 文档化两个新 env。`docs/tracks.md` 扩 apps/worker 文件域。
  - **复用决策**：worker 与 scripts/ 分属独立部署包，跨包运行时 import repo-root 脚本在 prod 易断 → 自包含 job，注释交叉引用 scripts/import-bangumi-dump.ts + ADR-159 + migration 077 保持同步（正确性/稳定性 #1 > 去重 #2）。
  - 单测：bangumi-dump-refresh（7，parseBangumiLine 全分支）。
  - **门禁**：typecheck ✅（8 包全 PASS）/ verify:adr-contracts ✅（无新端点 / 199 路由对齐 / SQL schema 对齐）/ `npm run test -- --run`：**5286 passed（399 文件全通过）**。
  - **已知（pre-existing，非本卡引入）**：全量跑 exit code 非 0 源于 `tests/unit/server-next/admin-moderation/use-filter-presets.test.ts` 的 flaky post-teardown unhandled rejection（`window is not defined`——该测试路径 `server-next/admin-moderation/**` 不匹配 jsdom globs `admin-moderation/**` → node 环境跑，异步 setLoading 在并行 teardown 后触发）；**隔离单跑 exit 0 / 0 错误**，与 apps/worker 改动无关。属 server-next 测试卫生 + environmentMatchGlobs 覆盖缺口，**超出 bangumi Track 文件域**，建议 server-next owner 跟进。
- **沉淀判断**：cron 接入对标既有 source-health/feedback 任务范式，自包含 job 边界清晰；parse 规则与 import 脚本交叉引用约束同步，是。

### ✅ CHG-BNG-07/08（Phase 2）— 反向建库占位 + 缺口查询 + 5 admin 端点

- **状态**：✅ 完成（2026-05-27）
- **执行模型**：claude-opus-4-7（主循环；ADR-159 端点契约/类型已由 Phase 0 arch-reviewer Opus PASS，无需再起 Opus）
- **完成备注**：
  - **CHG-BNG-07（Phase 2-A）**：
    - `externalData.listBangumiEntriesForSeed`（按 rank/year 过滤 + 默认跳过 nsfw=true，SQL 收敛于 query 层）。
    - `mediaCatalog.listBangumiGaps` + `countBangumiGaps`（有 bangumi_subject_id 但无 published video 的 catalog；LEFT JOIN bangumi_entries 取 rank 排序）。
    - **MediaCatalogService.findOrCreate retry 补 bangumiId 分支（ADR-159 Y5）**——与 Step4 对称，修复并发 seed + enrich step3 写同一 subject 时 ON CONFLICT 跳过后查不回的缺口。
    - 新建 `BangumiSeedService.seedPlaceholders`（仅本地 dump、零 REST 调用规避限流；type 固定 anime）+ `listGaps`。
    - 单测：bangumi-seed-service（7）+ mediaCatalogFindOrCreate Y5 retry（1）。
  - **CHG-BNG-08（Phase 2-B）**：
    - `packages/types/external.types.ts` 加 `BangumiCandidate` / `BangumiGapRow`（ADR-159 §端点契约 readonly 形状逐字落地）。
    - `BangumiService.searchCandidates`（本地 dump 召回带置信度为主 + keyword 时 REST 兜底 confidence=0，按 confidence 降序去重）。
    - 新建 `routes/admin/moderation.bangumi.ts` 5 端点（sync/candidates/confirm = moderator+admin；seed = admin only；gaps = moderator+admin），zod schema 逐字对齐 ADR-159；注册进 moderation.ts。
    - sync 端点直接映射 matchAndEnrich 结果（auto→updated:true / candidate/none→updated:false+reason）；token 缺失走 Phase 1 既有 dump 降级（比 ADR 决策 9 字面 token_missing 更优，仍写入 dump 字段）。
    - 单测：bangumiRoutes（12，含 403 admin-only / 422 边界 / 非法 UUID → 422）+ searchCandidates（3）。
  - **审阅修订（Codex review gate，2026-05-27）**：
    - **P1（已修）**：三视频端点（sync/candidates/confirm）补 `VideoIdParamsSchema = z.object({ id: z.string().uuid() }).strict()`（ADR-159 §zod 逐字），非法 id 现返回 422 VALIDATION_ERROR 而非走查库返 404；路由测试 fixture 改真实 UUID + 新增非法 UUID→422 用例。
    - **P2（已修）**：seed created/matched 计数改为精确——不复用 `findOrCreate`（返回行无法区分本次插入 vs 并发命中），改为 `findCatalogByBangumiId` + `findCatalogByNormalizedKey` 双 precheck（后者必需：`uq_catalog_title_year_type` 是 *部分* 唯一索引，仅全外部 ID 为 NULL 时生效，带 bangumi_id 的占位 INSERT 不受约束，须显式 SELECT 防重复占位）+ `insertCatalog` 的 `row|null` 返回值作唯一可靠"是否本次插入"信号（null=唯一冲突并发竞态→matched）；新增并发竞态用例。findOrCreate Y5 修订保留（crawler 路径仍需）。
    - **P3（已核实）**：reviewer 报 `npm run test -- --run` 164 个 localStorage 失败**在本 worktree 不可复现**——同命令实测 0 个 localStorage 失败。根因：`vitest.config.ts` 用 `environmentMatchGlobs`（vitest 3.2.4 **已 deprecated**，每次运行告警）按 glob 切 jsdom 环境提供 localStorage；reviewer 环境（不同 vitest/jsdom/node）未应用该映射 → 组件测试回落 node 环境。属 pre-existing 测试基建脆弱性，非 Bangumi（apps/api）引入。
  - **门禁（最终）**：typecheck ✅（8 包全 PASS）/ verify:endpoint-adr ✅ 199 路由对齐 / verify:adr-contracts ✅（advisory：error-message + enum-ssot + D-159-1 均 pre-existing/非阻塞）/ `npm run test -- --run`：**5278 passed / 1 failed**，唯一失败为 `CrawlerClient.test.tsx` 14b（server-next CSV/toast，tasks.md 既载 flaky；单跑 **66/66 PASS**），与 Bangumi 无关。
  - **lint**：嵌套 worktree（`.claude/worktrees/bangumi` 物理位于主仓内）导致 ESLint 同时解析 worktree 与父仓两份 `eslint-plugin-resovo` → 插件歧义，对任意文件均 fail（环境性，非本次代码问题）；改动文件 typecheck 干净。
  - **D-159-1**：占位 normalizedKey 失配产生重复 catalog 已知限制，accept best-effort，按 ADR-159 待集成 PR 时在 changelog.md 闭环（活跃 Track 期不写共享 changelog 冲突域）。
- **沉淀判断**：seed 服务 + 缺口查询 + 端点分层对标 douban，是；BangumiCandidate/GapRow 进 packages/types 共享层（ADR 锁定契约），是。
- **CHG-BNG-09（Phase 2-C，可选 cron 归档同步）**：延后——涉及 apps/worker + GitHub 归档下载 + 调度，独立性强且 plan 标注"可选/后续"，不在本次 Phase 2 核心交付内；按需立卡。

### ✅ CHG-BNG-03/04/05/06（Phase 1）— REST 客户端 + 匹配增强

- **状态**：✅ 完成（2026-05-27）
- **执行模型**：claude-opus-4-7（主循环）
- **完成备注**：
  - `lib/bangumi.ts`（CHG-BNG-03）：getSubject/getEpisodes（分页拉全，50 页上限）/searchSubjects/isBangumiApiConfigured；Bearer+UA；**直接读 process.env（对标 lib/queue，避免 config 单例启动期 fail-fast）**；失败降级 null/[]。
  - `BangumiService` + `.utils`（CHG-BNG-04）：本地召回→置信度（复用豆瓣阈值 0.85/0.60）→ video_external_refs(provider=bangumi)→auto 拉 rich 详情+逐集 upsert+回填 episode_count；Token 缺失/抓取失败降级用 dump 字段。catalogService 可注入复用。infobox 解析导演/系列构成/动画制作（声优不在 infobox 故不写 cast）。
  - `step3Bangumi` 重写委托 BangumiService（CHG-BNG-05），保留 type==='anime' 触发位与签名扩 videoId（R2）。
  - `VideoService.update` 改类型→anime 经 enrichmentQueue.add 入队（CHG-BNG-06，对标 CrawlerService，避免引入 worker 的 db 单例）。
  - 新查询：catalogEpisodes.upsertCatalogEpisodes / videos.updateEpisodeCount / externalData.findBangumiById + BangumiEntryMatch 扩 coverUrl/rank/nsfw。
  - 测试：bangumi-lib.test.ts（9）+ bangumi-service.test.ts（15，含 utils）；回归修复 metadataEnrich（MediaCatalogService 单例注入）。
  - **worktree 修复**：构建本地 file-dep `external-adapter/douban-adapter`（dist 缺失致 video-manual-add-audit 解析失败）。
  - 全量单测套件 5252 passed（green）；root tsc --noEmit 通过。
- **沉淀判断**：HTTP 客户端/服务分层对标 douban，是。

### ✅ CHG-BNG-01（Phase 0-A）— 提升 bangumi 优先级 + migration 077 + architecture.md 同步

- **状态**：✅ 完成（2026-05-27）
- **执行模型**：claude-opus-4-7（主循环）
- **完成备注**：`CATALOG_SOURCE_PRIORITY.bangumi` 3→4（ADR-159 决策 2）；新建 `migration 077`（bangumi_entries 扩 rank/nsfw + 新建 catalog_episodes 逐集表，幂等含验证 DO block）；architecture.md §5.5/§5.6a/migration 列表同步。root `tsc --noEmit` 通过。

### ✅ CHG-BNG-02（Phase 0-B）— config + .env.example + 修复 dump 导入

- **状态**：✅ 完成（2026-05-27）
- **执行模型**：claude-opus-4-7（主循环）
- **完成备注**：config.ts 新增 BANGUMI_API_TOKEN/TIMEOUT_MS/USER_AGENT（Zod，Token optional 降级）；.env.example 同步。import-bangumi-dump.ts 回填 rank/nsfw。**实测 archive subject.jsonlines schema 修正**：含 rank(顶层)/nsfw，但无 eps/images → episode_count/cover_url 不来自 dump，改由 REST API getSubject 匹配时写入；ADR-159 字段映射 + architecture.md 同步修正。
- **沉淀判断**：dump schema 实测发现已回写 ADR-159 字段映射表，是。

### ✅ CHG-BNG-00 — ADR-159 起草 + Opus arch-reviewer 评审

- **状态**：✅ 完成（2026-05-27）
- **执行模型**：claude-opus-4-7（主循环）
- **子代理调用**：arch-reviewer（claude-opus-4-7）× 1 轮 — CONDITIONAL（2 红 R1/R2 + 5 黄 Y1–Y5 + 4 advisory A1–A4），全部已消化进 ADR → 改 Accepted
- **完成备注**：ADR-159 写入 decisions.md（端点契约 5 端点 + 字段映射 + migration 077 schema + 优先级决策 + D-159-1 偏离）。红线消化：R1 去除重复列 total_episodes 改复用 episode_count；R2 明确 step3 签名扩 videoId + episode_count 经专用 query 写入不越层。verify-endpoint-adr 通过（194 路由对齐）。D-159-1 待集成时在 changelog 闭环。
- **沉淀判断**：协议沉淀到 ADR-159，是。

---

## 待开始任务（Phase 0 → 1 → 2）

- ⬜ CHG-BNG-02（Phase 0-B）：config + .env.example + 修复 dump 导入脚本（回填 episode_count/cover_url/rank/nsfw）
- ⬜ CHG-BNG-03（Phase 1-A）：lib/bangumi.ts REST 客户端（对标 lib/douban.ts）
- ⬜ CHG-BNG-04（Phase 1-B）：BangumiService + BangumiService.utils（infobox 解析）
- ⬜ CHG-BNG-05（Phase 1-C）：重写 step3Bangumi 委托 BangumiService + 字段映射
- ⬜ CHG-BNG-06（Phase 1-D）：VideoService.update 改类型为 anime 触发 enqueueEnrichJob
- ✅ CHG-BNG-07（Phase 2-A）：BangumiSeedService 占位条目 + 缺口清单查询（2026-05-27）
- ✅ CHG-BNG-08（Phase 2-B）：admin 路由 moderation.bangumi.ts（5 端点，2026-05-27）
- ✅ CHG-BNG-09（Phase 2-C）：worker cron 本地 dump 定时重导（2026-05-27；用户决策方案「本地 dump 定时重导」，零新依赖）

> PATCH 范围 > 5 项的卡须拆 -A/-B 子卡（workflow-rules §PATCH 软上限）。
