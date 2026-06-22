# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 IMGH-P4-0 — ADR-213 草案《图片健康双真源溶解（方案 C）》（supersede ADR-212）（SEQ-20260621-02）

- **状态**：🔄 进行中（ADR 草案 gate，**不写实现代码**）｜ **创建/开始**：2026-06-21 ｜ **执行模型**：claude-opus-4-8（主循环）｜**子代理**：`arch-reviewer`（claude-opus-4-8, a06695fa2c0aa033c — 方案 C 设计 CONDITIONAL-PASS；早期 ab6f77498087aab55 / ad7eedc3859a734ba 出 ADR-212 patch 裁决〔随 ADR-212 废弃〕）
- **问题理解**：problem-images「真破损」桶对**已恢复**封面系统性误报——7 张 `poster_status='ok'` 正常显示的图被判真破损。
- **根因**：两套真源结构性漂移——`media_catalog.<kind>_status`（当前态/per-catalog）vs `broken_image_events`（事件流/per-video，`resolved_at` 仅人工写）；problem-images CASE（`imageHealth.scan.ts:173-179`）让 `broken_event` 分支无条件压过当前 status；worker 复检写 `ok`（`imageHealthWorker.ts:165`）/ apply-candidate / rescan **均不联动 resolve 旧事件**。
- **方向转向（用户批准方案 C / dissolve，取代 ADR-212 的 patch/align）**：健康判定**不再读 events**，收敛为「`<kind>_status` 当前态 + `<kind>_client_error_at` 浏览器自过期信号」两列真源；events 降级纯遥测。ADR-212 全部对齐机制（event_class/写端 resolve/url_hash/migration 049）整类不需要。
- **方案（产出 ADR-213，固化 D-213-1~9）**：
  - **D-213-2/3** schema：`media_catalog` +8 列（4×`checked_at` + 4×`client_error_at`，纯 ADD COLUMN；窗口 N=7 单一常量）。
  - **D-213-4** `broken_image_events` schema 零改动 + 退出健康读路径（仅留遥测：brokenLast7Days/趋势/域名）。
  - **D-213-5** worker：status 写入同步 checked_at + 吸收 ADR-212 D-212-9 判别式（HTTP/decode→broken，瞬态→不改 status）。
  - **D-213-6** 前台 beacon 端点契约不变，内部改写信号列（per-catalog）+ events 双写（best-effort）。
  - **D-213-7** 读端单一 `problemFilterSqlV2`（counts/list 共用，total 不漂移）+ problemReason `broken_event`→`client_error`（DTO 值域变更）。
  - **D-213-8** 存量：7 误报上线即消失零运维 + **checked_at 不回填（留 NULL→unknown，A 后 A-SCAN 一次性真实扫描排空）** + client_error_at 从 events 回填（带当前 URL 守卫）。时序硬约束 `0M→A→A-SCAN门→C`。
  - **D-213-9** 已知缺口：worker 无周期巡检 scheduler（不阻塞，登记 follow-up 卡）。
- **涉及文件**：`docs/decisions.md`（ADR-213 草案落盘 + ADR-212 转 Superseded）+ `docs/tasks.md`（本卡）。**不改业务代码**（实施在 P4-0M/A/B/C）。
- **门禁**：Opus `arch-reviewer` 裁决（ADR + 跨 worker/service/query/读端 3+ 消费方 schema）→ Codex 对抗性独立审核（ADR 非代码产物，落盘后定稿前）→ Subagents trailer。
- **备注**：本卡为设计 gate，不触发 typecheck/lint/test（无代码改动）；ADR Accepted 后拆 A/B 实施卡。
- **进展（2026-06-21）**：① ADR-212（patch 路线）经 **3 轮 Codex + 2 轮 arch-reviewer** 收敛到 event_class 分行 + migration 049，复杂度高且脆弱；② **用户批准方案 C（dissolve）**——spawn **arch-reviewer (claude-opus-4-8, a06695fa2c0aa033c)** 独立设计，核实全部代码事实（4 补正 + 发现 worker 无周期巡检/无 checked_at 列）→ **CONDITIONAL-PASS**：方案 C 在正确性 #1 与边界复用 #2 显著优于 ADR-212 patch，7 修订全吸收；③ **ADR-213 落盘** `docs/decisions.md`（Draft v1，D-213-1~9 + 0M/A/B/C 拆卡）；④ **ADR-212 转 Rejected/Superseded by ADR-213**（保留 D-212-9 吸收 + 「patch 路线行不通」三轮论证作审计）。**🚨 含 schema 变更（media_catalog +8 列）→ 0M 须同步 architecture.md §5.11**。⑤ **Codex 对抗审核 round-1 (a1d0700349d19909a) needs-attention：3 HIGH+2 MEDIUM+1 LOW 全吸收** → ADR-213 Draft v2：ADV-213-1 信号列 URL 同源守卫 / ADV-213-4 stale-ok：P4-C 加 **`unknown` 可观测面**兜底 + **P4-S 周期巡检（非阻塞根治收尾卡）** / ADV-213-6 信号列仅 4 kind（stills/thumbnail 仅遥测）/ ADV-213-2 双写 warn + brokenLast7Days 定性遥测 / ADV-213-5 recall 取舍 / ADV-213-3 total 回归测。⑥ **Codex re-review round-2 needs-attention：2 HIGH+1 MEDIUM**（均 round-1 修正的传播/一致性缺口）**全吸收** → **Draft v3**：R2-HIGH-1 回填补 URL 守卫（D-213-8）/ R2-HIGH-2 checked_at 仅确定性出口推进、瞬态不刷（D-213-2/5）/ R2-MEDIUM stale-ok 并入单一谓词 `problemFilterSqlV2` + problemReason 加 `unknown`（D-213-7）。⑦ **Codex re-review round-3：1 HIGH 全吸收** → Draft v4：checked_at 改不回填、留 NULL→unknown（D-213-8③）。⑧ **Codex re-review round-4：1 HIGH = rollout 时序缺口全吸收** → **Draft v5**：一次性扫描移到 A 之后（A-SCAN 门），时序 `0M→A→A-SCAN门→C`、C 硬依赖扫描完成。**数据模型 rounds 1–3 已封板，问题下沉到实施编排层**。**待办**：① **Codex re-review**（验证 round-4 闭环，用户触发）② 放行后 ADR-213 转 Accepted + 拆 0M/A/B/C/S。未 commit。

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
