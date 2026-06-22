# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 IMGH-P4-0M — 方案C migration：media_catalog +8 列 + client_error_at 回填 + architecture.md 同步（ADR-213，SEQ-20260621-02）

- **状态**：🔄 进行中（schema 硬前置，时序 `0M→A→A-SCAN门→C` 首卡）｜ **创建/开始**：2026-06-22 ｜ **执行模型**：claude-opus-4-8（主循环）｜**子代理**：无（schema 设计已由 ADR-213 `arch-reviewer` (claude-opus-4-8, a06695fa2c0aa033c) 背书；commit 带 Subagents trailer 引用之）
- **依据**：ADR-213 **Accepted**（D-213-2/3/8）。方案 C 实施第一卡 = 加列 + client_error_at 回填，**不动 worker/读端/端点**（A/B/C）。
- **范围（≤4 项，schema 单层）**：
  - ① 新 migration `NNN_image_health_dissolve.sql`：`media_catalog` 加 8 列 `ADD COLUMN IF NOT EXISTS`——4×`<kind>_checked_at` + 4×`<kind>_client_error_at`（均 `TIMESTAMPTZ` nullable，无 CHECK/索引）。
  - ② `<kind>_client_error_at` 回填：仅当未解决 `client_load_error` 的 **`b.url=m2.<url_col>`（当前 URL 守卫）** 且 `last_seen_at>=NOW()-7d` 才 seed（D-213-8④）；**`checked_at` 不回填、留 NULL**（D-213-8③，→ 读端 COALESCE 判 unknown）。
  - ③ `CLIENT_ERROR_WINDOW_DAYS=7` + `STALE_CHECK_DAYS=30` 常量落 `imageHealth.scan.ts`（单一真源，禁散落硬编码）。
  - ④ **同步 `docs/architecture.md` §5.11**（media_catalog 表定义 +8 列）。
- **不做**：checked_at 扫描（A-SCAN 在 P4-A 后）；`broken_image_events` 零改动；worker 判别式/读端谓词/internal 端点（属 A/B/C）。
- **涉及文件**：`apps/api/src/db/migrations/NNN_image_health_dissolve.sql`（新，取真实下一编号——ADR 文中 049 是 ADR-212 占位语义已废）、`apps/api/src/db/queries/imageHealth.scan.ts`（常量）、`docs/architecture.md`（§5.11）、`tests/integration/...`（migration/回填：**旧 URL 事件不 populate client_error_at**）。
- **门禁**：🚨 **architecture.md §5.11 同步（BLOCKER 级）** + **真库回填演练（需 DB 访问，可能用户跑）** + typecheck/lint/test:changed + commit 带 `Subagents: arch-reviewer (claude-opus-4-8)` trailer（schema 已 ADR 背书）。
- **备注**：上游 IMGH-P4-0（ADR-213 草案 gate）已收口——ADR-213 **Accepted**（Draft v1→v5，arch-reviewer CONDITIONAL-PASS + Codex 4 轮全吸收），见 changelog [IMGH-P4-0]。本卡进入实施。时序 `0M→A→A-SCAN门→C`：0M 为 schema 硬前置，A/B 物理可并行，C 依赖 A-SCAN，S 非阻塞收尾。

---

### ⏸️ IMGH-P3-5 — 图片治理抽屉四图替换增强 + 精修（SEQ-20260621-01）— parked·待用户视觉验收 + commit

- **状态**：⏸️ 代码完成·门禁全绿·**未提交**（parked，阻塞在用户视觉验收，非主循环活跃）｜ **执行模型**：claude-opus-4-8 ｜**子代理**：无
- **进展**：A 基础 + B 精修全落地（focusKind 内部 state 四图切换 / cell 填充式选中态 vs 候选卡 ring 分层 / `ImageMatrixCell` 按 kind 比例精致化 + hover 预览按钮 / 替换区改前小窗 + 改后大图双预览 / 成功不关抽屉留存连续治理）。Codex 候选竞态 + 用户报 border shorthand 运行时警告均已闭环。**门禁**：typecheck=0 / lint=0 / test:changed=58 passed。
- **待办（用户验收后收尾）**：填完成备注 → 更新 task-queue → 删卡 → changelog → git commit。**未 commit**（用户仍在视觉迭代）。

---

_（**当前无 🔄 进行中卡片。SEQ-20260620-01 全交付 ✅ 2026-06-20**：1A/1B〔`f804de79`〕+ 2〔`f804de79`〕+ ADR-211 设计〔`2f71cb31`〕+ 4A〔`3a827433`〕+ 4B〔治理板 + 退役，`c335e393`〕+ 4C〔SafeImage 覆盖面核查，`4afddb3d`〕+ 4D〔DailyAnimeRow 裸 img → SafeImage，**前台零裂图全闭环**，本提交〕。**整个「破损样本区根治」主题收官**：后台问题图片治理板（看图分诊失效图）+ 前台 SafeImage 安全网全覆盖（用户端零裂图）。**剩余可选 follow-up**：problem-images DTO 加 eventId 使治理板可 resolve（4B gap，sonnet 小卡，task-queue 备注）。取卡前先查 🚨 BLOCKER。）_

---

_（**SEQ-20260619-02 image-health P2 治理闭环 ✅ 全交付 2026-06-20**：Phase 0〔ADR-208 + ADR-209〕+ Phase 1〔1A-1D 后端：candidates / apply-candidate / resolve-event + rescan-selected / missing-videos 筛选+行级契约〕+ Phase 2〔2A ImageCompare + 2B ImageCandidatePicker，admin-ui 共享组件〕+ Phase 3〔3A 治理抽屉 + 3B 工作台增强 + 3C 文档收尾〕全完成。**收口待办（合并 dev→main 前）**：`npm run test:e2e`（4 projects）✅ 已补跑（2026-06-20）：暴露 12 失败已全部修复（**E2E-AUDIT-FIX-20260620**，分支 `fix/e2e-audit-20260620`，详见 changelog），全量 173 pass / 0 fail；`npm run test -- --run` 单测全量 ✅ 585 文件 / 8084 测全过（2026-06-20，零回归）。**两道收口门禁均达标。** 下一任务取 task-queue.md 按优先级；取前先查 🚨 BLOCKER。）_

---

_（**SEQ-20260610-02 source-health v2 落地 🔄 15/17 — Phase 1 ✅ + Phase 2 ✅ + Phase 3 本轮可执行范围全收口 ✅ 2026-06-10**（P3-3-A/-B1/-B2 + P3-1 共 4 卡：source_hostname join key + host_health 熔断持久化 + 排序分桶软降权 + 双时钟新鲜度衰减——**D3+D4 闭环**；三轮 arch-reviewer claude-opus-4-8 裁决；母卡拆分序列 16→17）。**剩余 2 卡时序阻塞**：P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算，**最早 ~06-17 后启动**）→ P3-4 依赖评分项收口随后。登记：P3-3 ADR 草稿（双存储分工/排序分桶/恢复语义三决策）PHASE COMPLETE 前补；feedback success 不刷 last_rendered_at 非对称候选卡（P3-1 裁决 D 登记）。**Phase 1 全收口 ✅ + Phase 2 全收口 ✅ 2026-06-10**（P2-1：F1 断点闭合，PlayerShell 首播成功上报；P2-2：migration 105 EMA 三字段 + 写入侧即时半衰〔arch-reviewer claude-opus-4-8 两轮裁决 + 真库对拍〕；P2-3：复活/recheck 独立 ipHash SET 门槛；P2-4-A：migration 106 + manual_route_reprobe 真实信号入队；P2-4-B：worker 双 origin 混批定向消费）。下一步：Phase 3——P3-3-A 前置 Opus / **P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算）** / P3-1·P3-3 可先行；或 Phase 1 复盘三候选裁决（见 queue P1-2/P1-5 备注）。候选独立卡：e2e-next seed 基建（queue P2-1 备注）。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260610-01 首次文档治理 T1 ✅ 2026-06-10**（CHORE-DOCS-CLEANUP-20260610：活区断链 20+2 处清零 + frontmatter 38 文件补齐，残留登记见 changelog）。**SEQ-20260609-01 P3 dismiss 软移除 ✅ 端到端闭环 2026-06-10**（ADR-197 + -A/-B1/-B2/-B3/-C1/-C2 全完成：schema / 写端点+守卫 / 双侧读过滤+purge 清理 / 通知+任务抽屉 UI〔单项移除 + 清空/清除已完成 + H-1 行重构〕）。**可选 follow-up**：selectTerminalTaskRunIds 真实 SQL 集成验证 + 跨标签即时同步（MEDIUM-1，drawer-refresh SSE 事件独立卡）。**SEQ-20260609-01 其余**：P0→P2 收官（除暂缓 P2-b）+ P2-c 可见性增强（UI-1 分组/UNREAD-FILTER 只看未读）✅。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
