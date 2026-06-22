# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 CARD-SIZING-A — 前台视频卡片尺寸碎片化治理·死代码/死配置清理（SEQ-20260622-01）

- **状态**：🔄 进行中 ｜ **创建/开始**：2026-06-22 ｜ **执行模型**：claude-opus-4-8（主循环）｜**子代理**：无（纯死代码收敛，零架构决策；规范统一 token 设计移至子卡 -B 经 arch-reviewer）
- **依据**：调查报告 `docs/designs/client-video-card-sizing-audit_20260622.md`（问题清单 5/6/7 项）；用户选定中力度治理「清理 + 规范统一」，本卡 = 清理半（零视觉变化）。
- **范围（清理 5 项，纯收敛·零视觉变化）**：
  - ① 删 `VideoCardWide.tsx`（`@deprecated` 全仓零引用，无 barrel 导出）。
  - ② 删 `--shelf-card-w-landscape` token（`globals.css`）+ `Shelf.tsx` 头部注释 landscape 行（landscape-row 经 HANDOFF-20 已统一竖版，token 零消费）。
  - ③ 删 `ShelfRow` 的 `landscape-row` template（type union 值 + `LandscapeTrack` 函数 + render 分支）——零调用方（实际仅 poster-row/top10-row/featured-grid）。
  - ④ 删 `VideoGrid` 死 `variant` prop（`VideoGridProps` + `VideoGridSkeleton` props + 解构默认值，函数体零使用）+ 同步移除 `RelatedVideos.tsx:142` 的 `variant="portrait"` 传值（注意 `RelatedVideos` 自身 `variant="sidebar"|"grid"` 是另一 prop，不动）。
  - ⑤ 修 `VideoGrid` scroll 模式 `cardWidth='160px'` 硬编码 → `var(--shelf-card-w-portrait)`（消 token 漂移；scroll 路径零消费方，仅 token 化、不删路径以尊重选定范围）。
- **不做**：gap token 统一 / 响应式列数断点归一 / 标题字号归一（→ 子卡 -B，需 Opus token 方案）；定宽机制重构 / 组件合并（中力度不含）；删 VideoGrid scroll 死路径（→ follow-up 登记 task-queue）。
- **涉及文件**：`apps/web-next/src/components/video/VideoCardWide.tsx`（删）、`apps/web-next/src/app/globals.css`、`apps/web-next/src/components/video/Shelf.tsx`、`apps/web-next/src/components/video/VideoGrid.tsx`、`apps/web-next/src/components/detail/RelatedVideos.tsx` + 相关前台单测（如引用 variant/landscape-row）。
- **门禁**：typecheck=0 / lint=0 / test:changed 全过（VideoGrid/Shelf/RelatedVideos 相关测试零回归）+ 视觉零变化（landscape-row/variant/scroll 均零消费）。**关键路径**：首页 shelf（poster-row/top10/featured 不受 landscape-row 删除影响，回归确认）。
- **验收口径（一句话）**：移除 5 处死代码/死配置后全量前台测试零回归且任何已渲染页面视觉零变化。

---

### ⏸️ IMGH-P4-A — 方案C worker：确定性出口写 checked_at + fetchImageDimensions 判别式 + A-SCAN 门（ADR-213，SEQ-20260621-02）

- **状态**：⏸️ **代码已交付**（commit `968d4efb`，门禁全绿）·**待部署期跑 A-SCAN**（`scripts/run-imgh-ascan.ts` 落 `checked_at` 真值、排空初始 unknown 桶 → C 硬前置门）——A-SCAN 属运维步、非编码工作台占用，**不占单 🔄 槽**｜ **创建/开始**：2026-06-22 ｜ **执行模型**：claude-opus-4-8（主循环）｜**子代理**：无（实施按 ADR-213 D-213-5；worker 逻辑非新架构决策）
- **依据**：ADR-213 **Accepted**（D-213-5）。0M 已收口（migration 121 + 常量落地，真库演练 PASS，见 changelog [IMGH-P4-0M]）。
- **范围（worker 单层）**：
  - ① `updateCatalogImageStatus`（`imageHealth.ts:127-144`）**确定性出口**（ok/low_quality/broken）同步写 `<kind>_checked_at=NOW()`；**瞬态出口不写**（checked_at = 最近确定性判定，非探测尝试，R2-HIGH-2）。
  - ② `fetchImageDimensions`（`imageHealthWorker.ts:170-188`）改返判别式 `{width,height,failure?:'http_4xx'|'http_5xx'|'decode'|'transient'}`；`checkImageHealth` 映射：URL 语法非法/HEAD 404/HEAD 5xx/GET 404/GET 5xx/sharp decode → **broken**；width>0 尺寸·比例不合 → **low_quality**；全过 → **ok**；**瞬态（网络/超时/abort/DNS/TLS）→ 不改 status 且不写 checked_at**（D-213-5/9，消 timeout 误报）。
  - ③ **A-SCAN（部署后一次性，C 硬前置门）**：把所有 `<kind>_url` 非空行入 health-check 队列（**不限 `pending_review`**）→ worker 落 checked_at 真值、排空初始 unknown 桶。经 ImageHealthService 暴露 / 一次性脚本触发。
  - events 仍 emit 作遥测、与健康判定解耦（不变）。
- **不做**：读端谓词（C）/ internal 信号列（B）/ 周期 scheduler（S）。
- **涉及文件**：`apps/api/src/workers/imageHealthWorker.ts`（判别式 + 映射）、`apps/api/src/db/queries/imageHealth.ts`（updateCatalogImageStatus 加 checked_at）、`apps/api/src/services/ImageHealthService.ts`（A-SCAN 入队）+ 可能 `imageHealth.ts` 新查询（列 ok 行供 A-SCAN）、`tests/unit/api/image-health-*.test.ts`。
- **门禁**：typecheck/lint/test:changed + 单测（404/5xx/decode→broken · 尺寸小→low_quality · **瞬态→status 不变且 checked_at 不推进** · 确定性出口刷 checked_at · A-SCAN 入队 ok 行）+ `verify:adr-contracts`。**关键路径**：worker 图片健康巡检 status 写入，改后回归。
- **备注**：A 部署后跑 A-SCAN 再起 C（C 硬依赖扫描完成）；B 可与 A 并行。Subagents trailer 引 ADR-213 arch-reviewer（设计背书）。
- **进展（2026-06-22）**：worker 三改（`fetchImageDimensions` 判别式 / `checkImageHealth` 确定性→broken·瞬态→不改 status·不写 checked_at / 删内存连败计数器 + 死代码 extractDomain）+ `updateCatalogImageStatus` 确定性出口写 checked_at + `listUncheckedImageUrls` 查询 + `ImageHealthService.enqueueHealthScanForUnchecked`（A-SCAN）+ 触发脚本 `scripts/run-imgh-ascan.ts` 全落；单测覆盖（404/5xx→broken·HEAD/GET 瞬态→不改 status·GET 5xx→broken·checked_at 条件写入·A-SCAN 入队）。**门禁**：typecheck=0/lint=0/test:changed=181/verify:adr-contracts=0。**待**：部署后跑 A-SCAN（`run-imgh-ascan.ts`）落 checked_at 真值 → 收口 A、起 C（B 可先行）。

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
