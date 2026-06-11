# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### SRCHEALTH-P3-3-B1 — host_health migration + worker 熔断持久化 + extractHostname 切换（写侧）（状态：🔄 进行中）

- **序列**：SEQ-20260610-02（方案 §3 P3-3 / §8.4 Q4 + arch-reviewer claude-opus-4-8 裁决 A–H 为设计真源；原 P3-3-B 按裁决 G 拆 -B1/-B2，本卡为写侧）
- 创建时间：2026-06-10 12:53 ｜ 实际开始：2026-06-10 20:40
- **验收口径**：① migration 108 `host_health` 表（hostname TEXT PK + 小写 CHECK；只存事实字段 cooldown_until/last_failure_at/last_success_at/last_tripped_at/trip_count/updated_at——**无 state 枚举**，熔断判定 = `cooldown_until > NOW()` 读时计算）；② circuit-breaker `recordFailure`/`recordSuccess` 返回 `CircuitTransition`（'tripped'|'recovered'|null），**不 import pg**；③ level1/level2 切 `extractHostname`（删两处 extractSiteId 副本；null → 跳过熔断直接探测、不落库）+ 翻转事件级 UPSERT host_health；④ architecture.md 新表章节。读侧 JOIN/分桶在 -B2。
- **文件范围**：`apps/api/src/db/migrations/108_host_health.sql`（新）、`apps/worker/src/lib/circuit-breaker.ts`、`apps/worker/src/jobs/source-health/{level1-probe,level2-render}.ts`、host_health UPSERT 落库函数（worker 侧新文件或 job 内）、`docs/architecture.md`、worker 单测。
- **依赖**：SRCHEALTH-P3-3-A ✅。前置 Opus 裁决已完成（见 queue 13 条裁决要点）。
- **建议模型**：sonnet（设计已 Opus 裁决）｜ 执行模型：claude-fable-5（用户持续推进授权）
- **子代理调用**：arch-reviewer (claude-opus-4-8) — host_health schema + 双存储 + 软降权机制裁决 A–H（拆卡前 P3-3-B 母卡触发，两子卡共用）

---

_（**SEQ-20260610-02 source-health v2 落地 🔄 12/16 — Phase 1 ✅ + Phase 2 ✅ + P3-3-A ✅ 2026-06-10**（P3-3-A：migration 107 source_hostname join key + 回填 556,892 行 + 3 写路径维护 + extractHostname 入 media-probe〔arch-reviewer claude-opus-4-8 裁决 A–H〕）。Phase 3 进行中：下一步 **P3-3-B**（host_health 表 + 熔断双存储 + 软降权，前置 Opus 新表设计裁决）→ P3-1；**P3-2 影子一周硬前置本轮阻塞（最早 ~06-17）**，P3-4 顺延。**Phase 1 全收口 ✅ + Phase 2 全收口 ✅ 2026-06-10**（P2-1：F1 断点闭合，PlayerShell 首播成功上报；P2-2：migration 105 EMA 三字段 + 写入侧即时半衰〔arch-reviewer claude-opus-4-8 两轮裁决 + 真库对拍〕；P2-3：复活/recheck 独立 ipHash SET 门槛；P2-4-A：migration 106 + manual_route_reprobe 真实信号入队；P2-4-B：worker 双 origin 混批定向消费）。下一步：Phase 3——P3-3-A 前置 Opus / **P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算）** / P3-1·P3-3 可先行；或 Phase 1 复盘三候选裁决（见 queue P1-2/P1-5 备注）。候选独立卡：e2e-next seed 基建（queue P2-1 备注）。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260610-01 首次文档治理 T1 ✅ 2026-06-10**（CHORE-DOCS-CLEANUP-20260610：活区断链 20+2 处清零 + frontmatter 38 文件补齐，残留登记见 changelog）。**SEQ-20260609-01 P3 dismiss 软移除 ✅ 端到端闭环 2026-06-10**（ADR-197 + -A/-B1/-B2/-B3/-C1/-C2 全完成：schema / 写端点+守卫 / 双侧读过滤+purge 清理 / 通知+任务抽屉 UI〔单项移除 + 清空/清除已完成 + H-1 行重构〕）。**可选 follow-up**：selectTerminalTaskRunIds 真实 SQL 集成验证 + 跨标签即时同步（MEDIUM-1，drawer-refresh SSE 事件独立卡）。**SEQ-20260609-01 其余**：P0→P2 收官（除暂缓 P2-b）+ P2-c 可见性增强（UI-1 分组/UNREAD-FILTER 只看未读）✅。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
