# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-01
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

### CHG-SN-4-03 · DB schema：060 audit_log + 052 状态机 + 053–059 字段 + types/architecture/ADR 同步

- **来源**：plan v1.2 §8.1 任务卡总览（SEQ-20260501-01 第 1 张 / M-SN-4 milestone）
- **真源**：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.2 §2 + §3.0 + §11.5
- **状态**：🚧 进行中（2026-05-01 开工）
- **建议主循环**：`claude-sonnet-4-6`（plan §8.1）
- **实际主循环**：`claude-opus-4-7`（本会话；偏离 plan §8.1 建议，理由：本卡含跨 3+ 消费方 schema + 4 项 ADR 草拟，Opus 主循环对架构决策稳定性更高；模型审计写入 changelog）
- **强制子代理**：`arch-reviewer (claude-opus-4-7)` — CLAUDE.md 强制升 Opus 第 2 条（跨 3+ 消费方 schema：apps/api / apps/server-next / apps/worker / packages/types）
- **后续阻塞**：本卡是 CHG-SN-4-04 / -05 / -06 / -07 / -08 的硬前置；arch-reviewer PASS 前不得开 -04/-05/-06。

#### 开发前输出（quality-gates.md）

**1. 问题理解**

M-SN-4 plan v1.2 §2 共 9 张 migration（060 audit_log + 052 状态机 + 053–059 业务字段）是后续所有 M-SN-4 卡的硬阻塞前置。本卡完成 schema + types 同步 + architecture.md / ADR 文档同步 + 052 状态机回归测试集；不含任何路由 / Worker / 前端代码。

**2. 根因判断**

- **060 admin_audit_log**：M-SN-2 欠账（D-18），M-SN-4 所有写端点必须能写入审计；本期前置补建（实测仓内 grep `admin_audit_log` 0 命中）
- **052 状态机扩展**：plan §1 D-01"approved → pending_review"两条新转换；现有 `enforce_videos_state_machine()` trigger 白名单需改写
- **053–058**：probe/render 双轨信号 + staff_note + review_labels + crawler_sites.user_label + source_health_events.source_id + 实测分辨率，全部为 plan §3 端点 + §5 操作流必需字段
- **059**：v1.0 §6 显示补全表已列 `review_source` 但 v1.0 无对应 migration；v1.1 §2.8 补齐
- **部署顺序**（plan §2.10）：060 → 052 → 053–059。060 优先确保 audit 全程覆盖；052 状态机回归集 staging 验证后再 prod

**3. 方案**

- **9 张单文件 migration**（`apps/api/src/db/migrations/{nnn}_*.sql`）；每张含 `-- ── up` + `BEGIN/COMMIT` + `-- ── down`（注释形式留存，不主动执行）+ 头部 ADR 锚 + 幂等说明，**对齐仓内 049–051 既有风格**（核实 051_add_videos_trending_tag.sql）
- `apps/api/src/db/queries/videos.ts`：`VideoStateTransitionAction` 联合类型加 `'staging_revert'` 分支（**实际类型名带 `Video` 前缀**，apps/api 真源；行 550）
- `apps/server-next/src/lib/videos/types.ts`：`StateTransitionAction`（apps/api 真源的 re-alias，行 99）同步
- `packages/types/src/admin-moderation.types.ts`（新建，与现有 `video.types.ts` / `user.types.ts` 等平级）：`ReviewLabel` / `SourceHealthEvent` / `AdminAuditLog` / `PendingQueueRow` / `VideoQueueRow` / `DualSignalState` 等类型；`packages/types/src/index.ts` 追加 export
- `docs/architecture.md`：schema 章节追加 9 张 migration 字段表
- `docs/decisions.md`：追加 4 项 ADR 草案 — D-14（admin-ui 共享组件下沉清单 + DecisionCard 跨应用层例外协议）/ D-16（apps/worker 部署归属 + 单实例约束）/ D-17（player_feedback 客户端实装 packages/player-core 位置）/ D-18（admin_audit_log schema 前置补建）。**D-13 / D-15 不出 ADR**（commit trailer + plan 内闭环）
- `tests/unit/db/migrations/052_state_machine_regression.test.ts`（新建子目录）：052 之前所有合法转换路径白名单回归集（确保 052 改 trigger 后旧路径仍通）

**4. 涉及文件（边界严格 — 修正版对齐仓内约定）**

可写：
- 新增 `apps/api/src/db/migrations/052_state_machine_add_staging_revert.sql`
- 新增 `apps/api/src/db/migrations/053_video_sources_signal_columns.sql`
- 新增 `apps/api/src/db/migrations/054_videos_moderation_fields.sql`
- 新增 `apps/api/src/db/migrations/055_review_labels.sql`
- 新增 `apps/api/src/db/migrations/056_crawler_sites_user_label.sql`
- 新增 `apps/api/src/db/migrations/057_source_health_events_line_detail.sql`
- 新增 `apps/api/src/db/migrations/058_video_sources_resolution_detection.sql`
- 新增 `apps/api/src/db/migrations/059_videos_review_source.sql`
- 新增 `apps/api/src/db/migrations/060_admin_audit_log.sql`
- 新增 `packages/types/src/admin-moderation.types.ts`
- 新增 `tests/unit/db/migrations/052_state_machine_regression.test.ts`
- 修改 `apps/api/src/db/queries/videos.ts`（仅 VideoStateTransitionAction 联合类型 + transitionVideoState `'staging_revert'` 分支）
- 修改 `apps/server-next/src/lib/videos/types.ts`（仅 StateTransitionAction re-alias）
- 修改 `packages/types/src/index.ts`（仅追加 export）
- 修改 `docs/architecture.md`（仅 schema 章节追加段）
- 修改 `docs/decisions.md`（仅追加 ADR 草案 4 项）

不可修改（明确边界）：
- ❌ `apps/server-next/src/app/admin/moderation/_client/*`（属 CHG-SN-4-07 / -10）
- ❌ `apps/api/src/routes/*`（属 CHG-SN-4-05）
- ❌ `apps/worker/*`（属 CHG-SN-4-06；本卡不创建该目录）
- ❌ `packages/admin-ui/*`（属 CHG-SN-4-04）
- ❌ 任何前端业务页（属 -07 / -08）

#### 必跑命令

- `npm run typecheck` — 必须通过
- `npm run lint` — 必须通过
- `npm run test -- --run` — 含 052 状态机回归集，必须全绿
- 9 张 migration 在 staging DB 顺序 up + 顺序 down 均成功（人工验证）
- e2e 不必跑（属 CHG-SN-4-10 收口）

#### 完成判据

- [ ] 9 个单文件 migration（052–060）全部就位，每张含 up + 注释 down + 头部 ADR 锚（对齐 051 风格）
- [ ] 9 张 migration 在 staging 顺序 deploy 成功（down 注释形式留存，回滚靠手动复制注释执行）
- [ ] 052 状态机回归测试集 100% 通过（含现有所有合法转换路径）
- [ ] `VideoStateTransitionAction`（apps/api）+ `StateTransitionAction`（apps/server-next re-alias）双侧同步含 `'staging_revert'`
- [ ] `packages/types/src/admin-moderation.types.ts` 新类型导出，`@/types` 入口可消费（grep 确认无 apps 内重复定义）
- [ ] `docs/architecture.md` schema 章节追加 9 张 migration 字段说明
- [ ] `docs/decisions.md` 追加 4 项 ADR 草案（D-14 / D-16 / D-17 / D-18）
- [ ] **arch-reviewer (claude-opus-4-7) 评审 PASS / CONDITIONAL PASS**（≤ 3 轮闭环；REJECT → BLOCKER）
- [ ] typecheck / lint / unit 全绿
- [ ] commit trailer 含完整字段：`Plan-Source: ...v1.2` / `Main-Model: claude-opus-4-7` / `Sub-Agents: arch-reviewer (claude-opus-4-7)` / `Migration: 060,052,053,054,055,056,057,058,059` / `Architecture-Sync: docs/architecture.md`

#### 子代理调用计划

```
Task(subagent_type: "arch-reviewer", model: "claude-opus-4-7",
     prompt: "评审 M-SN-4 schema 卡（CHG-SN-4-03）：(1) 9 张 migration up/down 完整性与幂等性；
              (2) 052 状态机白名单改动是否破坏现有合法转换；
              (3) 060 admin_audit_log schema 与 §3.0.5 写入位点表对齐；
              (4) packages/types 新类型对 4 消费方（apps/api/server-next/worker/packages/types）的契约稳定性；
              (5) ADR 草案 4 项（D-14/D-16/D-17/D-18）决策依据完整性；
              (6) docs/architecture.md schema 同步覆盖度。
              评级：PASS / CONDITIONAL PASS (≤3 修订项) / REJECT (BLOCKER)")
```

#### 偏离登记（开工时已知）

| 偏离 | 来源 | 处理 |
|---|---|---|
| 主循环 Opus 4.7 vs plan §8.1 建议 sonnet-4-6 | 本会话当前模型 | 备注 + commit trailer Main-Model 写实际值；不另开 BLOCKER |

#### 开发后输出（完成时填）

- [ ] 六问自检
- [ ] 偏离检测
- [ ] [AI-CHECK] 结论块
- [ ] arch-reviewer 评审结论 + 修订轮数

---
