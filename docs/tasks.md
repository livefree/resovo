# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### ⏸ MODUX-ACPT-5（暂停 · 检查点已提交）· 验收第 5 条纠正 · 审核台头部去 h1 + 元素并入 tab 行

> 验收迭代已提交 3 检查点：`b6496861`（1-4 轮 + Codex 1·2）/ `587b2999`（5-7 轮快编芯片化）/ `58ca2fc4`（Codex 3 竞态）。用户转入 SRCHEALTH 设计；本卡**暂停待续**（验收若有后续修订可恢复）。下方为完整改动记录。

- **来源**：SEQ-20260610-03 人工验收不通过（第 5 条「标题重复 + 紧凑化」**完全没有解决**）。上轮 P1-0 规约决策方向选错——「保留 PageHeader 标题、弱化面包屑」，导致 body 的「内容审核台」h1 仍在 → 用户要的是**反向**：top bar 面包屑作唯一标题，删 body h1。
- **问题理解**：top bar 面包屑「运营中心 / 内容审核」已含页面名；body `ModerationConsole.tsx:407 PageHeader title={M.title}` 又渲染 h1「内容审核台」→ 两处页面名堆叠。
- **根因判断**：P1-1-A 按 P1-0 规约保留了 body PageHeader 标题，与用户验收意图相反。
- **方案**（仅审核台，**用户明确指令** + 第 2 轮追加）：
  - **第 1 轮**：① 删除整个 PageHeader 块（h1 整行不留），改 sr-only `<h1>{M.title}` 保 a11y heading 层级；② stats（今天已处理/通过率）+ 两个预设按钮（含 FilterPresetPopover）→ 并入「两个 tab 所在行」（`:473`）：tab 紧凑组（gap:1）/ stats / 右簇 `marginLeft:auto`（预设按钮 + pending 态 通过即上架·批量模式 toggle）；flexWrap 窄屏降级。
  - **第 2 轮**（用户追加）：③ 删全页 2 处「键盘流」——ModerationConsole tab 行 chip + PendingPaneController 左队列头部 help 入口按钮（`?` 键仍可呼出 help 浮层；删 KBD_HINT_STYLE）；④ 删 PendingCenter 标题行「待审」pill（`VisChip` 在 pending tab reviewStatus 恒 pending_review → 恒显「待审」纯冗余）；⑤ 信号决策 chip（DecisionCard banner，probe/render 推算 ok/warn/danger）从中部顶部上移到标题行原 pill 位置（复用既有 DecisionCard，零新 admin-ui API / 零逻辑重复）。
  - **第 3 轮**（用户追加）：⑥ 审核操作条（`第N/total` 计数 + 进度条 + `✕拒绝/跳过/✓通过`）从 PendingPaneController 中栏 pane header 上移到 ModerationConsole 顶部 tab 行、整体居中（flex:1 spacer 居中并把右簇推到行尾，替代原 marginLeft:auto）；按钮复用 ModerationConsole 已持有的 v/activeIdx/totalPending/handleApprove/setRejectOpen/setActiveIdx（正好消费掉 pre-existing 未用的 v/BTN_PRIMARY/BTN_DANGER），aria-label 保持不变（e2e 按 aria-label 定位不受搬位影响）；PendingPaneController 删孤立 BTN_PRIMARY/BTN_DANGER/KBD。
  - **第 4 轮**（用户追加）：⑦ 「详情」右栏折叠 toggle 移到 tab 行**最右端**、改 **图标**形式（lucide-react `PanelRightClose`/`PanelRightOpen`，匹配 `docs/designs/sidebar-icon-website.webp` 面板图标风格）。**rightOpen state + 响应式 effect 上提**到 ModerationConsole（真源），PendingPaneController 改为 `rightOpen` 单向 prop 消费（驱动右栏 pane `hidden`）、删本地 state/effect/中栏 header（中栏无 header，播放器占满）；删 useEffect import；测试 defaults 补 `rightOpen:true`。
  - **第 5 轮**（用户追加，快速编辑改造）：⑧ PendingMetaQuickEdit 去「快速编辑」标签；type / 题材（genres）由 AdminSelect **下拉**改 **inline 芯片一次点击**（type 单选高亮 / genres 多选 toggle，去「点下拉再选」）；年代 / 地区 保留 inline input（自由值）。⑨ PendingCenter 元信息行删 ID（`<code>{v.id}</code>`，内部标识审核无用途）。测试：type 改点击芯片 + 题材 toggle 增删用例（PendingMetaQuickEdit.test 9→10）。
  - **第 6 轮**（用户追加）：⑩ 年代 / 地区 input 旁另加快捷候选芯片——年代 = 近 6 年（含当年，动态 `CURRENT_YEAR`）；地区 = 最常见区域（CN/HK/TW/JP/KR/US/GB/TH）。芯片与 input 共用 state/写路径（点击设值 + commit + input 同步）。测试 +2（年代/地区候选芯片点击）（PendingMetaQuickEdit.test 10→12）。
  - **第 7 轮**（用户追加）：⑪ 地区候选芯片改用**精简短名映射**（`{code,label}`，如 HK=香港），不走 `formatCountryName` 的 Intl 官方全称（避免「中国香港特别行政区」等冗长名）；移除 formatCountryName import。
- **不做**：① 不改 `@resovo/admin-ui` 公开 Props（仅审核台停用 PageHeader/VisChip + 复用 DecisionCard，无 arch-reviewer/trailer）；② 跨后台其余 ~17 页统一治理 = 独立 follow-up（本卡先让用户验收审核台样板）。
- **涉及文件**：`ModerationConsole.tsx`（删 PageHeader + import / 重排 tab 行 / sr-only h1 / 删键盘流 chip + KBD_HINT_STYLE / tooltip 改正 / 审核操作条 + 详情图标 toggle 入 tab 行 / rightOpen state + effect / lucide import）、`PendingPaneController.tsx`（删左队列头部键盘流 help 按钮 / 删中栏 header + rightOpen 本地 state/effect / 改 rightOpen 单向 prop / 删孤立 BTN_PRIMARY·BTN_DANGER·KBD + useEffect import）、`PendingCenter.tsx`（删顶部 DecisionCard + VisChip / 信号 chip 上移标题行）、`i18n/messages/zh-CN/moderation.ts`（删孤立 kbdHint/kbdFlowLabel）、`tests/unit/.../PendingPaneControllerKeyboard.test.tsx`（defaults 补 rightOpen）。
- **Codex stop-time review FIX（第 1 轮）**：「acceptance still leaves 键盘流 user-visible」——遗漏的 user-visible「键盘流」= 批量模式 toggle 的 hover `title`（`J/K 键盘流暂停`）+ 孤立 i18n 键 `kbdFlowLabel:'键盘流'`。修复：tooltip 去「键盘流」+ 删 2 个零引用 i18n 键（kbdHint/kbdFlowLabel）；全仓非注释「键盘流」清零。
- **Codex stop-time review FIX（第 2 轮）**：「batch-mode tooltip now gives false user guidance」——上一版 tooltip 改成「J/K 键盘导航暂停」是**事实错误**：批量模式下 J/K（batchSafe:true）仍生效，真正暂停的是审核键 A/R/S/E/P（batchSafe:false，见 `PendingPaneController.tsx:175`）。修复：tooltip 改「审核快捷键 A/R/S/E/P 暂停（J/K 导航仍可用）」，与 binding 逻辑一致。
- **Codex stop-time review FIX（第 3 轮）**：「candidate chips can race with blur commits and save the wrong year/country」——年代/地区**同时有 input（blur 提交）+ 候选芯片（click 提交）**：输入框改值未失焦时点候选芯片 → mousedown 致 input 失焦 → `onBlur` 先用 stale 输入值提交，再芯片 onClick 提交 → 同字段两 PATCH 竞态、网络乱序可能存错值。修复：候选芯片 `onMouseDown` 调 `e.preventDefault()` 阻止 input 失焦 → 不触发 stale blur 提交，仅芯片值提交；+1 单测（mousedown defaultPrevented）。type/genres 芯片无关联 input 故无此竞态。
- **验收**：审核台无可见 h1；stats·预设按钮在 tab 行；**全页（含 hover tooltip）无「键盘流」字样**；标题行无「待审」pill、改显信号 chip；预设/批量/通过即上架/键盘 `?` help 无回归；e2e filter-presets 绿。
- **执行模型**：claude-opus-4-8（主循环）。子代理调用：无（无共享组件 Props 改动 / 无新端点）。
- **遗留标记**：moderation visual 快照（`tests/visual/admin-moderation.visual.spec.ts`，独立 `admin-visual` project，非必跑门禁）布局变更后需 `npm run test:visual:update` 重生成。

_（**SEQ-20260611-02 identity 候选 enrichment 空窗修复 ✅ 1/1 卡收口 2026-06-11**（用户报告两部同名「佐贺偶像是传奇 梦想银河乐园」bangumi id 相同不在合并预选）——根因 = ingest shadow 一次性快照 vs enrichment 异步证据时差（bangumi id 晚 5-9 分钟绑定 → 纯标题分 < 0.75 不落行）+ 绑定后无重评机制 + 离线 rescan 手动无 scheduler。修复 = migration 111 trigger_source +'enrichment' / videoRescore 定向重评 / worker 'video-rescore' job / 六 enrichment 完成位点 fire-and-forget 挂钩（事务路径 COMMIT 后）。端到端实证本案对入候选 identity_score=0.95 合并预选可见。主循环 claude-fable-5；门禁全绿。**工作台空闲**。）_

_（**SEQ-20260611-01 视频详情/播放页 404 修复 ✅ 全 4 卡收口 2026-06-11**（用户报告「后台预览播放页/详情页有时 404」+「前台已公开视频同样 404」）——调查实证四根因：④ **short_id 字母表冲突**（nanoid 默认字母表含 `-` 被 extractShortId 切坏，dev 库 12.1% 视频必现 404）→ -A 生成收口（lib/short-id.ts 唯一真源）+ -B migration 110 清洗 526 行 + ES 重同步（附带清理 2327 条幽灵文档，端到端抽验 HTTP 200）；① 视频库「查看详情（前台）」相对路径开后台域 → LINK-A buildAdminPreviewUrl 收口；② 详情页跳 watch 丢 `?preview=admin` → LINK-B carryAdminPreview 透传；③ refresh 过期静默降级 = ADR-160 设计内（可观测性增强候补）。主循环 claude-fable-5 全程；逐卡门禁全绿（e2e:admin 82/82 + e2e:video 5/5）。候补登记见 task-queue 序列。**工作台空闲**。）_

_（**BUGFIX-PLAYBACK-VERIFY-LINE-REFRESH ✅ 2026-06-11**（用户报告实际播放成功后线路仍显「待测」）——DB 实测确认后端在生效（`last_admin_verified_at`+`render_status=ok`），纯前端刷新链断点：`onVerified→refetchQueue` 只刷左队列、不 reload LinesPanel `state.lines`；不能用全量 reload（Y4 自动选首行打断播放）。修：controller 新 `applyExternalHealthUpdate` **外科式**只改被播放线路 render/probe（不 reload/不动选中）+ AdminPlayer onVerified 带回 verify 结果 + PendingCenter `verifySignal`(nonce) 中转 + LinesPanel effect 应用。门禁全绿（test:changed 194 / e2e:admin 82/82 / +4 单测）。「实际播放」pill 播放成功即变「可用」。**工作台空闲**。）_

_（**BUGFIX-RENDERCHECK-PLAYBACK-SQL-CAST ✅ 2026-06-11**（用户报告「全部试播」点击线路不更新）——根因实测复现：`updateSourceHealthAfterRenderCheck` 抛 PG `could not determine data type of parameter $3`（可空参数用于裸 `CASE WHEN $N IS NOT NULL` 无类型 OID，parse 阶段必抛，mock 单测盲区），batch 计为「异常」→ 乐观更新跳过 → 待测不更新；**同根因捎带修复本会话 -B 回归** `recordAdminPlaybackVerifySuccess`（admin 真实播放成功路径每次 500）。修：两 query 显式 cast（对齐既有约定）+ 新建 `tests/integration/api` 真库回归守卫 + 集成 config 补 `@/api` 别名基建。门禁全绿（test:changed 7213 / test:integration 70 / verify EXIT=0）。**深层**：服务端试播 403 防盗链 = admin 真实播放反馈的设计针对项。**工作台空闲**。）_

_（**SRCHEALTH-ADMIN-PLAYBACK-FB ✅ MVP 闭环 2026-06-11**（审核验收期用户发现「播放器播放成功/失败不反馈探测」根因）——ADR-198（设计裁决 arch-reviewer claude-opus-4-8 CONDITIONAL PASS + 用户裁定 3 开放项，commit `3a3fd016`）→ **-A** schema+types+architecture.md（migration 109 `last_admin_verified_at` + `admin_playback` origin + partial index，`b7106b78`）→ **-B** API service+route（`recordPlaybackVerify` + `POST /admin/videos/:videoId/sources/:sourceId/playback-verify` + 16 单测，`e464c869`）→ **-C** UI+worker+e2e（AdminPlayer 切端点 + `onVerified` 刷新链 + worker `admin_playback` 定向消费 + e2e，本轮提交）。**成果**：admin 真实播放成功直更 render/probe + 失败定向 recheck，绕众包多 IP 门槛 + 不污染 P2/P3 众包 EMA。主循环全程 claude-opus-4-8；逐卡门禁全绿（含 test:e2e:admin 82/82）。**-D（可选/旁路，未请求）**：AdminPlayer 携实测分辨率驱动 quality，依 player-core 是否暴露 videoWidth/Height（触 player-core 公开 API 则 Opus 强制项）——登记 follow-up。**工作台空闲**——取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER（当前无）。）_

_（**SEQ-20260610-03 MODUX ✅ 全 15/15 收口 2026-06-11** — Phase 1 ✅（标题治理 P1-0~P1-1-B / DecisionCard P1-2 / 前台预览 404 P1-3 / 线路·预设 P1-4）+ Phase 2 ✅（ModListRow 三分区 P2-1 / 详情 Pill 化 P2-2 / 键盘流共享化 P2-3〔Codex 两轮拦截补全〕）+ Phase 3 ✅（P3-1-A/-B 后端富集·年代过滤 / P3-2 筛选弹层〔F 键归并〕/ P3-3 类似 tab 阈值折叠 + merge 升 primary / P3-4-A /meta 补 country / P3-4-B 4 字段内联快编〔genres lazy-fetch〕）。本轮主循环 claude-opus-4-8 全程；门禁逐卡全绿。**PHASE COMPLETE 全量兜底见 changelog。工作台空闲**——取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER（当前无）。）_

_（**SEQ-20260610-02 source-health v2 落地 🔄 15/17 — Phase 1 ✅ + Phase 2 ✅ + Phase 3 本轮可执行范围全收口 ✅ 2026-06-10**（P3-3-A/-B1/-B2 + P3-1 共 4 卡：source_hostname join key + host_health 熔断持久化 + 排序分桶软降权 + 双时钟新鲜度衰减——**D3+D4 闭环**；三轮 arch-reviewer claude-opus-4-8 裁决；母卡拆分序列 16→17）。**剩余 2 卡时序阻塞**：P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算，**最早 ~06-17 后启动**）→ P3-4 依赖评分项收口随后。登记：P3-3 ADR 草稿（双存储分工/排序分桶/恢复语义三决策）PHASE COMPLETE 前补；feedback success 不刷 last_rendered_at 非对称候选卡（P3-1 裁决 D 登记）。**Phase 1 全收口 ✅ + Phase 2 全收口 ✅ 2026-06-10**（P2-1：F1 断点闭合，PlayerShell 首播成功上报；P2-2：migration 105 EMA 三字段 + 写入侧即时半衰〔arch-reviewer claude-opus-4-8 两轮裁决 + 真库对拍〕；P2-3：复活/recheck 独立 ipHash SET 门槛；P2-4-A：migration 106 + manual_route_reprobe 真实信号入队；P2-4-B：worker 双 origin 混批定向消费）。下一步：Phase 3——P3-3-A 前置 Opus / **P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算）** / P3-1·P3-3 可先行；或 Phase 1 复盘三候选裁决（见 queue P1-2/P1-5 备注）。候选独立卡：e2e-next seed 基建（queue P2-1 备注）。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260610-01 首次文档治理 T1 ✅ 2026-06-10**（CHORE-DOCS-CLEANUP-20260610：活区断链 20+2 处清零 + frontmatter 38 文件补齐，残留登记见 changelog）。**SEQ-20260609-01 P3 dismiss 软移除 ✅ 端到端闭环 2026-06-10**（ADR-197 + -A/-B1/-B2/-B3/-C1/-C2 全完成：schema / 写端点+守卫 / 双侧读过滤+purge 清理 / 通知+任务抽屉 UI〔单项移除 + 清空/清除已完成 + H-1 行重构〕）。**可选 follow-up**：selectTerminalTaskRunIds 真实 SQL 集成验证 + 跨标签即时同步（MEDIUM-1，drawer-refresh SSE 事件独立卡）。**SEQ-20260609-01 其余**：P0→P2 收官（除暂缓 P2-b）+ P2-c 可见性增强（UI-1 分组/UNREAD-FILTER 只看未读）✅。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

_（**SEQ-20260612-01 VIDEO-NAMING-STANDARD-A ✅ 收口 2026-06-12**（采集入库标题标准化 + catalog 按季匹配）——`buildStandardVideoTitle` 三层标题（原始观测保留 / 标准显示标题 / 结构化 season_number+facets）+ Step 5 season-aware 匹配（显式传 seasonNumber 才扩四元组，旧调用方保持 D-176-7 行为）；同名不同季不再复用同一 catalog/video；`国语/画质/更新态` 不再污染显示标题（原文保 aliases/observations）。实现 gpt-5-codex / 门禁+收口 claude-fable-5；typecheck/lint/test:changed 970 passed（1 个 listCandidates perf 基准并发抖动、隔离重跑 PASS）/ verify:adr-contracts EXIT=0。D-176-11/12 入 ADR-176 AMENDMENT。**后续登记**：B 卡存量标题清洗（季标间隔，实测 videos 257 + catalog 232 行粘连）/ C 卡跨季误合并盘点 / SEQ-20260612-02 语言双维度序列（用户裁定语音·字幕分维度 + 地区推断 fallback + 前台多语音才显示）。**工作台空闲**。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
