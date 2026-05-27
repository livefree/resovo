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

### 🔄 CHG-BNG-01（Phase 0-A）— 提升 bangumi 优先级 + migration 077 + architecture.md 同步

- **状态**：🔄 进行中
- **开始时间**：2026-05-27
- **来源序列**：SEQ-BANGUMI-01 / Phase 0
- **建议模型**：sonnet（schema 已由 ADR-159 锁定，机械落地）
- **执行模型**：claude-opus-4-7（主循环，worktree 内连续推进）
- **文件范围**：
  - `apps/api/src/services/MediaCatalogService.ts`（CATALOG_SOURCE_PRIORITY.bangumi 3→4）
  - `apps/api/src/db/migrations/077_bangumi_metadata.sql`（新建：扩 bangumi_entries + catalog_episodes）
  - `docs/architecture.md`（持有 `architecture` 硬冲突域，077 schema 同步）
- **任务目标**：按 ADR-159 锁定的 schema 落地 migration 077（不含 total_episodes，复用 episode_count）+ 提升 bangumi 优先级。
- **完成判据**：migration 幂等可跑；architecture.md 同步；typecheck 通过。

---

## 已完成任务

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
