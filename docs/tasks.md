# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### ⏸️ CARD-SIZE-E2E — 卡片尺寸体系 e2e spec + 全量回归门禁（ADR-214 D-214-4/7/9，SEQ-20260622-03 Phase 4 收官）

- **状态**：⏸️ **spec 已交付 + 可跑门禁全绿**（commit 见 changelog [CARD-SIZE-E2E]；typecheck=0/lint=0/全量单测 602 文件 8216 测/verify:adr-contracts=0）·**待 e2e 实跑**（`npm run test:e2e` 须在具备 `.env.local`+DB(migration 124)+Redis 的主 checkout / CI 跑——= 合并 main 前 e2e gate 节点；worktree 缺 .env.local 起不来 dev server）——e2e 实跑属合并 gate 运维步、**不占单 🔄 槽** ｜ **创建/开始**：2026-06-23 ｜ **执行模型**：claude-opus-4-8（主循环；卡建议 sonnet）｜**子代理**：无（e2e spec + 跑门禁，非新架构决策/新契约）
- **依据**：ADR-214 D-214-4/7（CardGrid 防溢出 + 桌面列数消费 DB 变量）/ D-214-9 R3（SSR 新鲜度有界 + admin PUT→公开读链路）。Phase 0–3 全交付（DB→types→service→public-cache→SSR→CardGrid→scroll→VideoCard→browse→featured→admin-ui）。
- **问题理解**：卡片尺寸体系全栈代码已就绪，缺端到端 e2e 验证（SSR 注入值→前台渲染 + 网格视觉回归）。
- **根因判断**：前序卡单测覆盖契约层（card-size-fetch/CardGrid/VideoCard/service/public-cache/admin-ui 单测），但 SSR 注入→真实页面渲染 CSS 变量→CardGrid 消费的端到端链路 + 窄容器/长标题视觉防溢出（D-214-4/7）仅 e2e 可验。
- **⚠️ 环境约束（关键）**：worktree 隔离副本**缺 `.env.local`**（gitignore 本地文件、不随 worktree 复制）→ dev server 命令 `node --env-file=../../.env.local` 解析失败 → **apps/api / web-next / server-next dev server 均无法启动** → **playwright e2e 在本 worktree 背景会话不可实跑**（还需 DB migration 124 + Redis）。
- **方案（务实拆解）**：
  - ✅ **可交付**：① 新建 `tests/e2e-next/card-size-grid.spec.ts`（设计为仅依赖 `web` server；SSR fetch 失败降级 CARD_SIZE_DEFAULTS、值==seed 故断言稳定〔standard 5/16〕，不强依赖 apps/api 有 card_size_settings 表）：断言 SSR 注入 `<style data-card-size-vars>` + `:root` 变量〔D-214-6/9〕 / featured-grid 桌面 5 列消费 DB 变量〔D-214-7〕 / 长标题不溢出〔D-214-4 min-width:0〕 / 窄视口降 2 列响应式。② 全量单测 `npx vitest run`（PHASE COMPLETE 兜底节点）。③ typecheck/lint/verify:adr-contracts。
  - ⏸️ **环境阻塞（登记须他处跑）**：`npm run test:e2e`（4 projects 实跑）须在具备 `.env.local`+DB(migration 124)+Redis 的主 checkout / CI 跑——**即合并 main 前的 e2e gate 节点**（CLAUDE.md「合并 main 前必跑 test:e2e」）。admin PUT→公开读新鲜度端到端（D-214-9 R3 mutation 侧）依赖 admin 鉴权 + DB 写，契约层已由 `card-size-admin.test.ts`（PUT→Redis unlink）+ `card-size-public.test.ts`（miss→setex 重读）单测覆盖；e2e 实跑随上述 gate。
- **涉及文件**：`tests/e2e-next/card-size-grid.spec.ts`（新）。
- **门禁**：typecheck/lint + **全量单测**（PHASE COMPLETE）+ verify:adr-contracts。**e2e 实跑环境阻塞、登记他处补跑**（非本 worktree 能力范围）。
- **备注**：spec 严格仿 typography-layout/featured-row-sparse 既证范式（同 _fixtures + route mock + 选择器）以最大化正确性；本卡不修改产品代码。**Phase 4 性质 = 测试收口 + 门禁，e2e 实跑是合并 gate 节点、非 worktree 内必达**。

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
- **改动归位（2026-06-22）**：为隔离 `chore/card-sizing-governance-20260622` 工作区，4 文件改动（`ImageGovernanceDrawer.tsx` / `ImageHealthProblemBoard.tsx` / 新增 `ImageMatrixCell.tsx` / drawer 测试）已存入具名 stash。**恢复**：`git stash list` 找 message 含「IMGH-P3-5 parked」的条目 → `git stash apply <ref>`（用 apply 不用 pop，保留 stash 直至验收 commit 后再 drop）。
- **进展**：A 基础 + B 精修全落地（focusKind 内部 state 四图切换 / cell 填充式选中态 vs 候选卡 ring 分层 / `ImageMatrixCell` 按 kind 比例精致化 + hover 预览按钮 / 替换区改前小窗 + 改后大图双预览 / 成功不关抽屉留存连续治理）。Codex 候选竞态 + 用户报 border shorthand 运行时警告均已闭环。**门禁**：typecheck=0 / lint=0 / test:changed=58 passed。
- **待办（用户验收后收尾）**：填完成备注 → 更新 task-queue → 删卡 → changelog → git commit。**未 commit**（用户仍在视觉迭代）。

---

_（**当前无 🔄 进行中卡片。SEQ-20260620-01 全交付 ✅ 2026-06-20**：1A/1B〔`f804de79`〕+ 2〔`f804de79`〕+ ADR-211 设计〔`2f71cb31`〕+ 4A〔`3a827433`〕+ 4B〔治理板 + 退役，`c335e393`〕+ 4C〔SafeImage 覆盖面核查，`4afddb3d`〕+ 4D〔DailyAnimeRow 裸 img → SafeImage，**前台零裂图全闭环**，本提交〕。**整个「破损样本区根治」主题收官**：后台问题图片治理板（看图分诊失效图）+ 前台 SafeImage 安全网全覆盖（用户端零裂图）。**剩余可选 follow-up**：problem-images DTO 加 eventId 使治理板可 resolve（4B gap，sonnet 小卡，task-queue 备注）。取卡前先查 🚨 BLOCKER。）_

---

_（**SEQ-20260619-02 image-health P2 治理闭环 ✅ 全交付 2026-06-20**：Phase 0〔ADR-208 + ADR-209〕+ Phase 1〔1A-1D 后端：candidates / apply-candidate / resolve-event + rescan-selected / missing-videos 筛选+行级契约〕+ Phase 2〔2A ImageCompare + 2B ImageCandidatePicker，admin-ui 共享组件〕+ Phase 3〔3A 治理抽屉 + 3B 工作台增强 + 3C 文档收尾〕全完成。**收口待办（合并 dev→main 前）**：`npm run test:e2e`（4 projects）✅ 已补跑（2026-06-20）：暴露 12 失败已全部修复（**E2E-AUDIT-FIX-20260620**，分支 `fix/e2e-audit-20260620`，详见 changelog），全量 173 pass / 0 fail；`npm run test -- --run` 单测全量 ✅ 585 文件 / 8084 测全过（2026-06-20，零回归）。**两道收口门禁均达标。** 下一任务取 task-queue.md 按优先级；取前先查 🚨 BLOCKER。）_

---

_（**SEQ-20260610-02 source-health v2 落地 🔄 15/17 — Phase 1 ✅ + Phase 2 ✅ + Phase 3 本轮可执行范围全收口 ✅ 2026-06-10**（P3-3-A/-B1/-B2 + P3-1 共 4 卡：source_hostname join key + host_health 熔断持久化 + 排序分桶软降权 + 双时钟新鲜度衰减——**D3+D4 闭环**；三轮 arch-reviewer claude-opus-4-8 裁决；母卡拆分序列 16→17）。**剩余 2 卡时序阻塞**：P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算，**最早 ~06-17 后启动**）→ P3-4 依赖评分项收口随后。登记：P3-3 ADR 草稿（双存储分工/排序分桶/恢复语义三决策）PHASE COMPLETE 前补；feedback success 不刷 last_rendered_at 非对称候选卡（P3-1 裁决 D 登记）。**Phase 1 全收口 ✅ + Phase 2 全收口 ✅ 2026-06-10**（P2-1：F1 断点闭合，PlayerShell 首播成功上报；P2-2：migration 105 EMA 三字段 + 写入侧即时半衰〔arch-reviewer claude-opus-4-8 两轮裁决 + 真库对拍〕；P2-3：复活/recheck 独立 ipHash SET 门槛；P2-4-A：migration 106 + manual_route_reprobe 真实信号入队；P2-4-B：worker 双 origin 混批定向消费）。下一步：Phase 3——P3-3-A 前置 Opus / **P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算）** / P3-1·P3-3 可先行；或 Phase 1 复盘三候选裁决（见 queue P1-2/P1-5 备注）。候选独立卡：e2e-next seed 基建（queue P2-1 备注）。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260610-01 首次文档治理 T1 ✅ 2026-06-10**（CHORE-DOCS-CLEANUP-20260610：活区断链 20+2 处清零 + frontmatter 38 文件补齐，残留登记见 changelog）。**SEQ-20260609-01 P3 dismiss 软移除 ✅ 端到端闭环 2026-06-10**（ADR-197 + -A/-B1/-B2/-B3/-C1/-C2 全完成：schema / 写端点+守卫 / 双侧读过滤+purge 清理 / 通知+任务抽屉 UI〔单项移除 + 清空/清除已完成 + H-1 行重构〕）。**可选 follow-up**：selectTerminalTaskRunIds 真实 SQL 集成验证 + 跨标签即时同步（MEDIUM-1，drawer-refresh SSE 事件独立卡）。**SEQ-20260609-01 其余**：P0→P2 收官（除暂缓 P2-b）+ P2-c 可见性增强（UI-1 分组/UNREAD-FILTER 只看未读）✅。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

### 🔄 CARD-SIZE-A1-E2E — e2e 重写 + 全量回归（SEQ-20260623-01 Phase 7，合并 gate 收口）

- **状态**：🔄 进行中 ｜ **创建/开始**：2026-06-23 ｜ **执行模型**：claude-opus-4-8（主循环；卡建议 sonnet）｜ **子代理**：无。
- **依据**：Codex-R5 测试漂移 + ADR e2e 门禁（合并 main 前 test:e2e）。承接 SEQ-20260622-03 CARD-SIZE-E2E 同款环境约束。
- **问题理解**：卡片尺寸 A1 改造（standard size-driven + compact 退役 + 详情/播放横滚）需 e2e 验证 SSR→视觉链路 + 合并 main 前全量门禁；既有 `card-size-grid.spec` 断言旧列数语义、需重写。
- **方案**：① 重写 `tests/e2e-next/card-size-grid.spec.ts`（standard size-driven 桌面卡宽 `--card-w-standard` 断言替列数 / compact 删除后无 `--card-cols-compact`/`--card-w-compact` 残留变量 / 窄视口响应式）；② 详情/播放页相关横滚 e2e（`related-scroll` 渲染 + VideoCard）；③ **合并 main 前**：全量单测 `npm run test -- --run` + `test:e2e` 4 projects + migration 125 冷启动。
- **涉及文件**：`tests/e2e-next/card-size-grid.spec.ts`（重写）+ 可能详情/播放 e2e spec。
- **门禁**：spec 可写（worktree）；**实跑环境阻塞**——worktree 缺 `.env.local` + node_modules 不完整 → dev server 起不来 + playwright/`test:changed` 不可跑 → **`test:e2e` 4 projects + 全量单测 + migration 125 冷启动须主 checkout/CI 跑 = 合并 main 前 gate**（同 CARD-SIZE-E2E）。
- **备注**：本卡 spec 编写为主、实跑登记合并 gate；不占编码工作台活跃槽（环境阻塞性质）。**横滚线 #2/#5/#6 主体已交付**，本卡收口测试 + 合并 gate。

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
