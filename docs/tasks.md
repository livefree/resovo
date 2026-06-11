# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（**SEQ-20260610-03 MODUX 🔄 14/15 — Phase 1 ✅ + Phase 2 ✅ + P3-1 后端闭环 ✅ + P3-2 筛选弹层 ✅ + P3-3 类似 tab 阈值折叠 ✅ + P3-4-A /meta 补 country ✅**（P1 标题治理/DecisionCard/前台预览 404/线路按钮；P2-1 ModListRow 三分区 / P2-2 详情 Pill 化 / P2-3 键盘流共享化+批量守卫+help+数字键选线路〔Codex 两轮拦截补全〕；P3-1-A 富集枚举语义 + query schema 契约 / P3-1-B listPendingQueue WHERE 过滤 + count 补 mc JOIN + 预设兼容；P3-2 PendingFilterPanel 7 维弹层 + F 键归并 + 序列化/URL sync；P3-3 TabSimilar 阈值折叠 + merge 升 primary；P3-4-A MetaEditSchema 补 country〔service 已支持零改/非新端点〕）。下一步 **Phase 3 收尾末卡**：**MODUX-P3-4-B** 审核主界面 4 字段内联快编 UI（PendingCenter 类型/题材/年代/地区 一键改 + 乐观更新/失败回滚/队列联动，唯一写路径 /meta）。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。）_

_（**SEQ-20260610-02 source-health v2 落地 🔄 15/17 — Phase 1 ✅ + Phase 2 ✅ + Phase 3 本轮可执行范围全收口 ✅ 2026-06-10**（P3-3-A/-B1/-B2 + P3-1 共 4 卡：source_hostname join key + host_health 熔断持久化 + 排序分桶软降权 + 双时钟新鲜度衰减——**D3+D4 闭环**；三轮 arch-reviewer claude-opus-4-8 裁决；母卡拆分序列 16→17）。**剩余 2 卡时序阻塞**：P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算，**最早 ~06-17 后启动**）→ P3-4 依赖评分项收口随后。登记：P3-3 ADR 草稿（双存储分工/排序分桶/恢复语义三决策）PHASE COMPLETE 前补；feedback success 不刷 last_rendered_at 非对称候选卡（P3-1 裁决 D 登记）。**Phase 1 全收口 ✅ + Phase 2 全收口 ✅ 2026-06-10**（P2-1：F1 断点闭合，PlayerShell 首播成功上报；P2-2：migration 105 EMA 三字段 + 写入侧即时半衰〔arch-reviewer claude-opus-4-8 两轮裁决 + 真库对拍〕；P2-3：复活/recheck 独立 ipHash SET 门槛；P2-4-A：migration 106 + manual_route_reprobe 真实信号入队；P2-4-B：worker 双 origin 混批定向消费）。下一步：Phase 3——P3-3-A 前置 Opus / **P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算）** / P3-1·P3-3 可先行；或 Phase 1 复盘三候选裁决（见 queue P1-2/P1-5 备注）。候选独立卡：e2e-next seed 基建（queue P2-1 备注）。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260610-01 首次文档治理 T1 ✅ 2026-06-10**（CHORE-DOCS-CLEANUP-20260610：活区断链 20+2 处清零 + frontmatter 38 文件补齐，残留登记见 changelog）。**SEQ-20260609-01 P3 dismiss 软移除 ✅ 端到端闭环 2026-06-10**（ADR-197 + -A/-B1/-B2/-B3/-C1/-C2 全完成：schema / 写端点+守卫 / 双侧读过滤+purge 清理 / 通知+任务抽屉 UI〔单项移除 + 清空/清除已完成 + H-1 行重构〕）。**可选 follow-up**：selectTerminalTaskRunIds 真实 SQL 集成验证 + 跨标签即时同步（MEDIUM-1，drawer-refresh SSE 事件独立卡）。**SEQ-20260609-01 其余**：P0→P2 收官（除暂缓 P2-b）+ P2-c 可见性增强（UI-1 分组/UNREAD-FILTER 只看未读）✅。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
