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

### 🔄 CHG-BNG-00 — ADR-159 起草 + Opus arch-reviewer 评审

- **状态**：🔄 进行中
- **开始时间**：2026-05-27
- **来源序列**：SEQ-BANGUMI-01 / Phase 0 前置
- **建议模型**：opus（决策文档 + 跨 3+ 消费方 schema，CLAUDE.md §模型路由强制）
- **执行模型**：claude-opus-4-7（主循环）
- **子代理调用**：arch-reviewer（claude-opus-4-7）— 待执行
- **文件范围**：
  - `docs/decisions.md`（ADR-159 新增；持有 `adr` 硬冲突域）
- **任务目标**：撰写 ADR-159「Bangumi.tv REST API + GitHub 归档 dump 集成协议」，含：
  1. 决策摘要 + 理由（dump 索引 + API 详情；anime 下 Bangumi 优先）
  2. C3 端点契约表（4 端点 + 方法 + 权限）
  3. 错误码表（error.code + message + HTTP 状态）
  4. 字段映射表（Bangumi subject/episode → media_catalog / catalog_episodes）
  5. schema 变更声明（migration 077：扩 bangumi_entries + 新建 catalog_episodes）
  6. 优先级调整决策（CATALOG_SOURCE_PRIORITY.bangumi 3→4）
  7. 已知限制（占位条目标题失配可能产生重复 catalog）
- **问题理解**：现状 step3Bangumi 极简陋、无 API 客户端、Token 未用、缺逐集表，
  动漫元数据质量受限；需起 ADR 固化集成协议后方可落地新 admin route（CLAUDE.md 强约束）。
- **完成判据**：ADR-159 写入 decisions.md；arch-reviewer PASS；记录子代理模型 ID。

---

## 待开始任务（Phase 0 → 1 → 2）

- ⬜ CHG-BNG-01（Phase 0-A）：提升 bangumi 优先级 + migration 077 + architecture.md 同步
- ⬜ CHG-BNG-02（Phase 0-B）：config + .env.example + 修复 dump 导入脚本
- ⬜ CHG-BNG-03（Phase 1-A）：lib/bangumi.ts REST 客户端（对标 lib/douban.ts）
- ⬜ CHG-BNG-04（Phase 1-B）：BangumiService + BangumiService.utils（infobox 解析）
- ⬜ CHG-BNG-05（Phase 1-C）：重写 step3Bangumi 委托 BangumiService + 字段映射
- ⬜ CHG-BNG-06（Phase 1-D）：VideoService.update 改类型为 anime 触发 enqueueEnrichJob
- ⬜ CHG-BNG-07（Phase 2-A）：BangumiSeedService 占位条目 + 缺口清单查询
- ⬜ CHG-BNG-08（Phase 2-B）：admin 路由 moderation.bangumi.ts（依赖 CHG-BNG-00 ADR PASS）
- ⬜ CHG-BNG-09（Phase 2-C，可选）：cron 归档同步

> PATCH 范围 > 5 项的卡须拆 -A/-B 子卡（workflow-rules §PATCH 软上限）。
