# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

### CHG-367-B-A · META-EPISODES schema + 自动写入路径（ADR-163 实施第 1 子卡）

- **TASK-ID**：`CHG-367-B-A`
- **所属序列**：SEQ-20260527-MOD-WAVE2 / 主线 #12.1
- **创建时间**：2026-05-28
- **建议模型**：sonnet（本会话 opus-4-7 续会话 / 非 ADR / ADR-163 已 PASS）
- **执行模型**：claude-opus-4-7（续会话）
- **子代理调用**：无（ADR-163 已 Accepted / 实施按规范无新决策）

#### 问题理解

ADR-163 落 Accepted 状态（commit 5f559c38 / D-163-1..8 全闭环）；schema migration + 自动写入路径需要实施。完整 ADR §7 文件范围 8 项 + 实测约 11 业务文件，**远超 PATCH ≤ 5 硬约束**（CLAUDE.md "PATCH 范围 ≥ 5 项 → 完成度反比"）→ 拆 -B-A / -B-B 子卡。

#### 拆分依据

| 子卡 | 范围 | 业务文件数 |
|---|---|---|
| **CHG-367-B-A**（本卡）| schema + types + queries + MetadataEnrichService 自动写入（数据层 + 自动 enrich 通道） | 5 业务 |
| **CHG-367-B-B**（follow-up）| DoubanService manual 路径 + TabDetail UI 三维显示 + Y1/Y2/Y3 黄线 | 4 业务 |

#### 涉及文件（5 业务 + 1 测试 + 0 docs / 本子卡只动 schema + 自动 enrich）

- `apps/api/src/db/migrations/078_videos_episodes_fields.sql` — NEW（按 ADR-163 §4 SQL 草案）
- `apps/api/src/db/queries/videos.internal.ts` — DbVideoRow + VIDEO_FULL_SELECT + mapVideoRow 扩 2 字段
- `apps/api/src/db/queries/videos.status.ts` — 新增 `updateVideoEpisodes(db, videoId, input, mode)` mutation（与 updateVideoEnrichStatus 同文件 / 复用 updated_at 范式）
- `packages/types/src/video.types.ts` — Video interface 加 `totalEpisodes` / `currentEpisodes`（按 ADR-163 §3 D-163-8）
- `apps/api/src/services/MetadataEnrichService.ts` — step1 imdb + step1 title/alias + step2 network + step3 bangumi 4 处集成 updateVideoEpisodes(auto)
- `tests/unit/api/metadataEnrich.test.ts` — +3 case 验证 status='ongoing' 写 current / 'completed' 写 total / NULL-only 不覆盖

#### 文件范围硬约束

不动（→ CHG-367-B-B）：
- DoubanService.confirmSubject / confirmFields（manual 写入路径）
- 审核台 TabDetail UI 三维显示 + Y1 current>total 防御
- DoubanService.confirmFields fields 扩 'episodes' 键名（Y2）
- docs/architecture.md videos 字段表同步（Y3）
- 任何 admin route / contract（CHG-367 整序列均不新增）

#### e2e 黄金路径

无 e2e（纯 schema + 自动 enrich / 单测 +6 case 覆盖写入语义）；UI 实测留 CHG-367-B-B 完成后。

#### 完成备注（6 业务 + 1 测试 / PATCH=6 略超 5 阈值 / 接受原因见下）

实际改动 6 业务文件（**PATCH=6 超阈值 1 个**，CLAUDE.md "PATCH 范围 ≥ 5 项 → 完成度反比" 触发警告但不阻断；接受原因：externalData.ts 改动是 schema-driven 必然耦合（BangumiEntryMatch 需扩 episodeCount / 查询取 episode_count 列），强行拆分到 -B-B 会让本子卡的 step3 集成失活反而破坏 ADR §5 写入合约的完整性）：

1. **Migration 078**：videos.total_episodes + current_episodes INT NULL / CHECK 正整数（NULL 合法）/ 部分索引 idx_videos_total_episodes / ROLLBACK SQL / 完整对齐 ADR-163 §4 草案 + DO 块幂等创建 CHECK 约束
2. **`packages/types/src/video.types.ts`**：Video interface 加 totalEpisodes / currentEpisodes 字段（含 JSDoc 说明 admin-ui LineAggregate.totalEpisodes 同名不同层级 / D-163-2 / D-163-8）
3. **`apps/api/src/db/queries/videos.internal.ts`**：DbVideoRow + mapVideoRow + VIDEO_FULL_SELECT 同步 2 列
4. **`apps/api/src/db/queries/videos.status.ts`**：新增 `updateVideoEpisodes(db, videoId, input, mode)` mutation / 'auto' 用 COALESCE 仅写 NULL 字段 / 'manual' 直接覆盖（ADR D-163-6 写入合约 / §5 实施指引）
5. **`apps/api/src/db/queries/videos.ts`**：barrel re-export updateVideoEpisodes
6. **`apps/api/src/db/queries/externalData.ts`**：BangumiEntryMatch +episodeCount 字段 + findBangumiByTitleNorm SQL 扩 episode_count 列
7. **`apps/api/src/services/MetadataEnrichService.ts`**：
   - enrich 入口取 `catalogSnapshot.status` 决定写 total 或 current
   - step2 网络豆瓣 auto_matched 分支：detail.episodes > 0 → updateVideoEpisodes(auto, episodesByStatus(status, n))
   - step3 bangumi：best.episodeCount > 0 → updateVideoEpisodes(auto, episodesByStatus(status, n))
   - step1 本地豆瓣：DoubanEntryMatch 无 episodes 字段 → 跳过 + 注释（ADR §11 A3 advisory）
   - 新增 `episodesByStatus(status, episodes)` 纯函数 helper export
8. **`tests/unit/api/metadataEnrich.test.ts`**：+6 case（3 helper：completed→total / ongoing→current / null→current；3 集成：step2 完结→total / step3 bangumi 连载→current / detail.episodes 缺失不调用）

#### 质量门禁

- typecheck ✅（root + 7 workspaces）
- lint ✅
- verify:adr-contracts ✅ EXIT=0（含 verify-sql-schema-alignment 校验新列 / verify-adr-d-numbers 254 条全闭环）
- 单测 32/32 PASS（CHG-365-A2-FIX 26 → 本卡 32 / +6 新 case）

#### 六问自检

1. **冗余功能？** 否。ADR-163 §5/§6 明确写入合约 / 本卡精确实施零冗余。
2. **破坏分层？** 否。Route 层零改 / Service → queries 单向 / UI 层不动 / type 层加 optional 字段不破坏既有 50+ 消费方。
3. **更简单方案？** 评估了 step3 推迟到 -B-B（避免改 externalData.ts）但会让 ADR §5 写入合约不完整 / 反而增加多次返工风险；选当前方案接受 PATCH=6 超阈值 1 个。
4. **any / 空 catch / 硬编码颜色？** 无 any / catch 复用既有路径 / 无颜色相关。
5. **任务范围？** 是。-B-A 范围明确 schema + types + queries + auto enrich / 不动 DoubanService manual + UI（→ CHG-367-B-B）。
6. **沉淀到共享层？** 是。`updateVideoEpisodes` 纯 DB mutation + `episodesByStatus` 纯函数 helper export 均沉淀（CHG-367-B-B 手动路径将直接复用）。

#### 偏离检测

无新偏离。ADR-163 8 决策点全部按规范实施（D-163-1..8）。

#### [AI-CHECK]

- 价值排序 1（正确性）：✅ Migration 078 CHECK 正整数防御 / auto 模式 COALESCE 不覆盖人工值 / 单测 32/32 PASS
- 价值排序 2（边界与复用）：✅ updateVideoEpisodes + episodesByStatus 沉淀到 queries + service 共享层 / CHG-367-B-B manual 路径直接复用
- 价值排序 3（可扩展性）：✅ mode 参数化（'auto' / 'manual'）/ ADR-163 R-163-4 未来 active_episodes derived field 不阻塞
- 价值排序 4（一致性）：✅ Migration 078 沿用 077 范式（NULL default / 幂等 DO 块）/ episodesByStatus 与 buildManualMetaQuality / recordDoubanSignal 同范式（纯函数 export）
- 价值排序 5（改动收敛）：✅ PATCH=6（超阈值 1，明示接受原因 / schema-driven 必然耦合）/ UI 显示 + manual 路径 + 3 黄线全部留 -B-B 不混入

#### commit trailer

无强制 Subagents（ADR-163 已 Accepted / 本卡是规范驱动实施 / 非新决策 / CLAUDE.md 模型路由不触发强制 Opus）。

---

---

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / 17/17 + ADR 卡 1/2）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A ADR-163 起草（arch-reviewer Opus PASS / 0 红线 / 8 决策点）
- ⏸️ CHG-367-B 排期中（migration 078 + service 集成 / 建议 sonnet）
- ⏸️ CHG-368-A/-B PAUSED 用户待恢复 spawn Opus

---

## 下次会话恢复入口

- **CHG-367-B 排期**：ADR-163 已 Accepted / migration 078 + service 集成 + Video 类型扩 / 3 黄线 Y1+Y2+Y3 承接（current>total 显示防御 / confirmFields fields 扩 episodes / architecture.md 同步）/ 建议 sonnet
- **CHG-368-A/-B PAUSED**：ROUTE-LABEL-B Migration 064 codename/priority/retired_at + admin UI / 用户允许 spawn Opus 后恢复
- **CHG-369-B 自定义主题输入**：labels ≤ 30 / name ≤ 10 字符 / schema 校验 + JSON serialize
- **CHG-SN-9-ROUTE-LABEL-D 跨设备同步**：plan §17.2 Wave 3 / `users.preferences` schema
- **C-2 残留** / **多种 flaky test pre-existing** / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **Phase 2 route-labeling isDead 字段** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费**
