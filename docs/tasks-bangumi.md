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

（空 — Phase 0 + Phase 1 已完成 ✅；Phase 2 反向建库 + admin 路由待启动）

---

## 已完成任务

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
- ⬜ CHG-BNG-07（Phase 2-A）：BangumiSeedService 占位条目 + 缺口清单查询
- ⬜ CHG-BNG-08（Phase 2-B）：admin 路由 moderation.bangumi.ts（依赖 CHG-BNG-00 ADR PASS）
- ⬜ CHG-BNG-09（Phase 2-C，可选）：cron 归档同步

> PATCH 范围 > 5 项的卡须拆 -A/-B 子卡（workflow-rules §PATCH 软上限）。
