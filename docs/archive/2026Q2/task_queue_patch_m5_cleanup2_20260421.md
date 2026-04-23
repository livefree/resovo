# task-queue.md 补丁 — SEQ-20260421-M5-CLEANUP-2（PC 端人工回归纠偏序列）

- **补丁日期**：2026-04-21
- **触发来源**：PC 端人工回归测试否决 M5 真·PHASE COMPLETE（见 `docs/task-queue.md` 尾部 BLOCKER 块）
- **决策依据**：用户决策 (a) 启动纠偏序列 / (b) 不回滚 eb163fa / (c) 不修订 ADR-037 §4b / (d) 扩写 M5 e2e 固化 9 场景 / (e) 暂不扩大人工回归
- **关联文档**：
  - `docs/task-queue.md` 尾部 BLOCKER 块（9 项缺陷清单）
  - `docs/milestone_alignment_m5_final_20260421.md`（已追加 §3.5 人工回归否决记录）
  - `docs/changelog.md`（已标注 ★ M5 真·PHASE COMPLETE ★ CANCELED）
- **前一序列**：SEQ-20260421-M5-CLEANUP（3 张 + CLOSE-02，已完成但被否决）

---

## 1. 拆卡原则

每张卡绑定一个**模块边界 + 缺陷簇**（避免单卡跨多模块导致边界模糊）。依赖关系以"最小前置"为准 — 互不依赖的卡可并行取卡。

| 原则 | 说明 |
|------|------|
| 边界单一 | 一张卡只修一个模块的一组缺陷（如 CLEANUP-06 只动 playerStore + PlayerShell + MiniPlayer + GlobalPlayerHost，不动 VideoCard） |
| 依赖最小 | 除 CLEANUP-07（依赖 06 的容器状态）、CLEANUP-11（依赖 04-10 全部完成）、CLOSE-03（依赖 11），其他卡互相独立，可并行 |
| 验收硬门槛 | 每卡除 typecheck/lint/unit 外，**强制要求在任务卡片内列"浏览器手动验收清单"**，完成备注必须记录主循环手动测试结果（启动 dev 服务器 + 逐项走查） |
| 模型路由 | 修复类卡片（CLEANUP-04 至 10）建议 sonnet；e2e 扩写（11）建议 sonnet；CLOSE-03 强制 opus 主循环 + opus arch-reviewer 子代理 |

---

## 2. 任务卡清单（9 张，建议顺序）

### 2.1 CLEANUP-04 — VideoCard 双出口反转 + TagLayer 溢出

- **对应缺陷**：#1（点击图片未触发 Fast Takeover / 悬浮文字区才出播放按钮 / TagLayer lifecycle 文字溢出与标题重叠）
- **规模**：M（~150 min）
- **建议模型**：sonnet
- **依赖**：无
- **文件范围**（限定）：
  - `apps/web-next/src/components/video/VideoCard.tsx`（PosterAction 与 MetaAction 的 click/hover 绑定）
  - `apps/web-next/src/components/video/TagLayer.tsx`（lifecycle 标签定位 + z-index）
  - `apps/web-next/src/components/video/StackedPosterFrame.tsx`（仅在确需配合 TagLayer 层叠时）
  - `apps/web-next/src/app/globals.css`（VideoCard 内布局 CSS 调整，不越界）
- **根因排查方向**：
  - PosterAction onClick 事件是否被 MetaAction `<a>` 外层捕获吃掉（可能是 article 内 button/a 嵌套层级顺序错）
  - Hover 样式是否错绑到 MetaAction 而非 PosterAction
  - TagLayer 是否脱离了 StackedPosterFrame overflow 容器（absolute 定位参考系错）
- **验收**：
  - 浏览器手动：点击封面 → 立即进入 Fast Takeover（URL `/watch/...`）；点击文字 → 跳详情；悬浮封面 → 出现浮动播放按钮；悬浮文字 → 无播放按钮；lifecycle 标签（如"连载中"/"更新至 12 集"）位于封面右下，不溢出文字区
  - typecheck / lint / unit ✅
  - e2e `card-to-watch.spec.ts` 不得回退

### 2.2 CLEANUP-05 — 分类页面 404 路由修复

- **对应缺陷**：#2（`/movie`/`/series`/`/anime`/`/tvshow`/`/short`/`/clip` 等全部 404）
- **规模**：M（~120 min）
- **建议模型**：sonnet
- **依赖**：无
- **文件范围**（限定）：
  - `apps/web-next/src/app/[locale]/[type]/page.tsx`（或等价分类页路由入口）
  - `apps/web-next/src/config/rewrite-allowlist.ts`（ADR-035 单一真源，确认 `/[locale]/[type]` 在 allowlist）
  - `apps/web-next/src/middleware.ts`（确认 middleware 不拦截分类页）
  - 如需补 `generateStaticParams` 或 `dynamicParams`，仅改 `[type]/page.tsx`
- **根因排查方向**：
  - 路由文件是否实际存在（M5-PAGE-GRID-01 是否真的提交了 page.tsx）
  - `rewrite-allowlist.ts` 是否在 M2-M4 阶段漏了 `[type]` 项
  - middleware locale 识别是否把 `/movie/` 误判为无效 locale
  - next.config.js rewrite 规则是否与新路由冲突
- **验收**：
  - 浏览器手动：`/zh/movie`、`/en/series`、`/zh/tvshow`、`/en/anime`、`/zh/short`、`/en/clip` 全部 200 且渲染 Grid
  - 每个 type 的 Grid 拉到真实 API 数据（非 mock）
  - typecheck / lint / unit ✅；e2e `browse-tvshow.spec.ts` 保持通过

### 2.3 CLEANUP-06 — 播放器三态 + 线路持久化

- **对应缺陷**：#3（播放器弹窗化 + 关闭后空白 + mini 无法展开）+ #4（线路切换重置）+ #5（线路/选集选项卡不稳定）
- **规模**：L（~240 min，最大工作量卡）
- **建议模型**：sonnet（若执行中发现架构决策需改 → 写 BLOCKER 升级 opus 子代理，不擅自决策）
- **依赖**：无
- **文件范围**（限定）：
  - `apps/web-next/src/stores/playerStore.ts`（LEGAL_TRANSITIONS 检查、lineId/episodeId 归属、持久化策略）
  - `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerHost.tsx`（Portal 挂载 + hostMode 控制）
  - `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerFullFrame.tsx`（full 态渲染）
  - `apps/web-next/src/app/[locale]/_lib/player/MiniPlayer.tsx`（mini 态 + 展开回 full）
  - `apps/web-next/src/components/player/shell/PlayerShell.tsx`（编排：线路/选集/字幕/影院模式）
  - `apps/web-next/src/components/player/shell/EpisodePicker.tsx` / `LineSwitcher.tsx`（选项卡稳定性）
- **根因排查方向**：
  - 弹窗化：`/watch/*` 页面可能把 GlobalPlayerFullFrame 当 modal 而非路由内容渲染 — 应该是 route 的 default 视图，关闭行为不应存在
  - mini 无法展开：LEGAL_TRANSITIONS 是否缺 `mini → full`；或 MiniPlayer onClick 未触发 playerStore.action
  - 线路切换重置：线路状态可能挂在 PlayerShell 本地 state 而非 playerStore，mini 化时组件卸载状态丢失
  - 选项卡不稳定：EpisodePicker 与 LineSwitcher 渲染条件可能有 `video.episodes?.length > 0 && video.lines?.length > 0`（应改为只要 video 存在就始终渲染占位，避免整卡消失）
- **验收**：
  - 浏览器手动：访问 `/watch/slug-shortId?ep=1` 无"关闭"按钮（播放器是页面主体，不是弹窗）
  - 点击"缩小"按钮 → MiniPlayer 右下显示，继续播放 → 点击 MiniPlayer → 回 full 态且保持线路/集数/播放进度
  - 切换线路 → 视频源切换但 mini 化后仍可播放；回 full 后线路仍为切换后的值
  - 选集选项卡与线路选项卡始终存在（哪怕只有一条线路也渲染），与播放器容器布局稳定（等高或等宽取决于 PC 横向 / 移动纵向）
  - typecheck / lint / unit ✅；e2e `player.spec.ts` 保持通过
- **子代理触发条件**：若需修改 `LEGAL_TRANSITIONS` 常量或新增状态字段 → 强制 spawn arch-reviewer (opus-4-6) 做接口评审

### 2.4 CLEANUP-07 — CinemaMode 容器尺寸

- **对应缺陷**：#6（影院模式下播放器容器有时过大）
- **规模**：S（~60 min）
- **建议模型**：sonnet
- **依赖**：CLEANUP-06 ✅（先稳定播放器三态再调影院态样式）
- **文件范围**（限定）：
  - `apps/web-next/src/app/[locale]/_lib/player/CinemaMode.tsx`（overlay 层，不负责容器尺寸）
  - `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerFullFrame.tsx`（cinema 态容器 max-width / max-height 约束）
  - `apps/web-next/src/app/globals.css`（如需 `--cinema-max-width` Token 则在 CLEANUP-01 新增 Token 分组下补齐，不独立硬编码）
- **根因排查方向**：
  - cinema 态容器是否继承了 flex-grow: 1 但无 max-width，导致超宽屏下视频撑满
  - 16:9 aspect-ratio 约束是否丢失
- **验收**：
  - 浏览器手动：在 PC 超宽屏（≥ 1920px）进入影院模式 → 播放器容器保持 16:9 且不超过 `min(85vw, 1440px)`；窗口缩放时容器等比缩放
  - typecheck / lint / unit ✅

### 2.5 CLEANUP-08 — 排版 + 字体 + 布局堆叠修复

- **对应缺陷**：#7（文字与卡片堆一起 + 字体与显示内容不符设计）
- **规模**：L（~240 min，涉及全局 Typography Token 审查）
- **建议模型**：sonnet
- **依赖**：无（但与 CLEANUP-04 VideoCard 布局有耦合，建议 04 先完成以免重复改动）
- **文件范围**（限定）：
  - `apps/web-next/src/app/globals.css`（Typography Token 引用 + 间距栅格）
  - `packages/design-tokens/src/semantic/typography.ts`（确认字体/字号/行高三件套齐全）
  - `apps/web-next/src/components/layout/*`（首页/分类/搜索页的间距栅格）
  - `apps/web-next/src/components/video/VideoCard.tsx`（若 04 未覆盖的文字行高、间距）
  - **禁止改动**：路由层、Store 层、Player 层
- **根因排查方向**：
  - 是否使用了系统默认字体而非设计稿指定的字体
  - Card Grid 间距 Token 是否被全局 reset 覆盖
  - 移动端与 PC 的 `gap` / `padding` Token 是否错用
- **验收**：
  - 浏览器手动：首页/分类页/搜索页 VideoCard Grid 间距合理（PC 三列 gap-6 / 移动两列 gap-4），文字不溢出不堆叠
  - 字体与 `design_system_plan_20260418.md` §typography 一致（SF Pro / Inter / 系统回退链）
  - typecheck / lint / unit ✅
- **注意**：若发现方案文档未明确指定字体或缺关键 Token，**写 BLOCKER 暂停**，不擅自定字体

### 2.6 CLEANUP-09 — 搜索结果修复

- **对应缺陷**：#8（搜索结果只返热门内容，q 参数未生效）
- **规模**：M（~120 min）
- **建议模型**：sonnet
- **依赖**：无
- **文件范围**（限定）：
  - `apps/web-next/src/app/[locale]/search/page.tsx`（q 参数解析 + 传递到组件）
  - `apps/web-next/src/components/search/SearchResults.tsx`（API 调用参数）
  - `apps/web-next/src/hooks/useSearch.ts` 或等价 fetch hook（若存在）
  - `apps/api/src/routes/searchRoutes.ts`（若为前端传参问题则不动）
  - 严禁改动：搜索索引 / Elasticsearch 配置 / DB schema
- **根因排查方向**：
  - `searchParams.q` 是否正确读取（RSC 与 client 边界问题）
  - API 调用 URL 是否拼 `?q=${q}` 参数
  - API 端 zod schema 是否声明了 q 为必填
- **验收**：
  - 浏览器手动：访问 `/zh/search?q=abc` → 结果区展示与 `abc` 相关的视频；切换不同 q 结果不同
  - 空 q 时展示"请输入关键词"或推荐结果（明确区分于"真搜索"）
  - typecheck / lint / unit ✅；e2e `search-page.spec.ts` 保持通过并补断言

### 2.7 CLEANUP-10 — 详情页选集按钮点击

- **对应缺陷**：#9（详情页选集按钮点击无响应，无法打开对应视频）
- **规模**：S（~60 min）
- **建议模型**：sonnet
- **依赖**：无
- **文件范围**（限定）：
  - `apps/web-next/src/components/detail/EpisodePicker.tsx`（click handler + `router.replace(?ep=N)`）
  - `apps/web-next/src/components/video/VideoDetailClient.tsx`（ep state 同步到播放按钮）
  - `apps/web-next/src/components/detail/DetailHero.tsx`（播放按钮携带 activeEp 触发 takeover）
- **根因排查方向**：
  - EpisodePicker 是否只更新了 URL 未同步到 playerStore
  - 选集点击后 DetailHero 的播放按钮 href 是否拼错
- **验收**：
  - 浏览器手动：详情页点击"第 3 集" → URL 变 `?ep=3` 且选集高亮切到第 3 集；点"立即播放" → 进入 `/watch/...?ep=3` 且播放器加载第 3 集源
  - typecheck / lint / unit ✅；e2e `detail.spec.ts` 保持通过并补断言

### 2.8 CLEANUP-11 — M5 e2e 扩写（9 场景固化）

- **对应决策**：(d) 扩写 M5 e2e 固化 9 类场景
- **规模**：M（~180 min）
- **建议模型**：sonnet
- **依赖**：CLEANUP-04 ✅ + 05 ✅ + 06 ✅ + 07 ✅ + 08 ✅ + 09 ✅ + 10 ✅
- **文件范围**（限定）：
  - `tests/e2e-next/card-dual-exit.spec.ts`（新建）：VideoCard 图片点击 → Fast Takeover；文字点击 → 详情；TagLayer 与标题不重叠（DOM getBoundingClientRect 断言）
  - `tests/e2e-next/browse-category-routes.spec.ts`（新建）：6 种 type 路由全部 200 + Grid 渲染
  - `tests/e2e-next/player-tri-state.spec.ts`（新建）：full → mini → full 状态一致性；线路切换后 mini 化再展开仍是切换后线路；进度保持
  - `tests/e2e-next/player-option-tabs-stable.spec.ts`（新建）：线路/选集 tab 始终可见（即使只有 1 项）
  - `tests/e2e-next/cinema-mode-size.spec.ts`（新建）：超宽屏（≥ 1920px viewport）影院模式容器不超过 `min(85vw, 1440px)`
  - `tests/e2e-next/typography-layout.spec.ts`（新建）：首页 Grid 卡片 gap 符合 Token；字体 family 在 computedStyle 中命中设计稿列表
  - `tests/e2e-next/search-query.spec.ts`（扩写）：`?q=abc` 返回包含 abc 的结果；空 q 走热门；q 变化结果刷新
  - `tests/e2e-next/detail-episode-pick.spec.ts`（新建）：详情页选集按钮点击 → URL + 高亮 + 播放按钮目标 ep 同步
- **验收**：
  - 新增 8 个 spec 文件 + 最小 16 个 test case（每文件 ≥ 2 case）
  - 全部在 `playwright.config.ts` 的 `tests/e2e-next/` project 中运行
  - 未引入新的 testid（复用 VideoCard/PlayerShell/SearchResults 等现有 testid）
  - `npm run test:e2e` 全绿（无 flaky 提升）
- **注意**：本卡不修源码，只写测试；如果测试用现有 testid 写不出来 → 在对应源码组件补 `data-testid` 即可（不改业务逻辑）

### 2.9 CLOSE-03 — M5 真·PHASE COMPLETE v2（真·真·闭环）

- **规模**：S（~120 min）
- **建议模型**：**opus 主循环 + arch-reviewer (opus-4-6) 子代理（强制）+ 浏览器手动验收（主循环负责）**
- **依赖**：CLEANUP-04 至 CLEANUP-11 全部 ✅
- **文件范围**：
  - 新增 `docs/milestone_alignment_m5_final_v2_20260XXX.md`（继 v1 + §3.5 否决记录之后的 v2 闭环对齐表）
  - 修改 `docs/decisions.md`（如有需要追加 ADR-037 再次迭代；当前决策 c 不修订所以默认只追加 PASS 签字）
  - 修改 `docs/changelog.md`（追加 ★ M5 真·PHASE COMPLETE v2 ★）
  - 修改 `docs/task-queue.md`（解除 BLOCKER）
- **arch-reviewer 必查 11 点**（在原 10 点基础上追加 1 项浏览器手动验收审查）：
  1. 原 CLOSE-02 10 点保持通过
  2. 9 项 PC 端人工缺陷的修复证据（各 CLEANUP 卡 diff 审查）
  3. CLEANUP-11 新增 8 个 e2e spec 全绿
  4. **主循环必须在卡片完成备注中贴出 "dev server 手动验收清单 + 9 项逐一走查结果截图或日志摘要"**；arch-reviewer 以此作为"非静态审计一维"判据
- **验收**：
  - arch-reviewer 11 点 PASS
  - typecheck / lint / unit / e2e 全绿
  - 主循环提供手动验收记录（浏览器逐项走查 9 项缺陷不复发）
  - 用户二次人工确认通过（解除 BLOCKER 前最后一道门）
- **解除 BLOCKER**：仅当以上 4 项全部满足时，task-queue.md 才允许移除 BLOCKER 块并宣告 M5 真·PHASE COMPLETE v2

---

## 3. 风险与备忘

| 风险 | 缓解 |
|------|------|
| CLEANUP-06 工作量大，可能中途发现需改 `LEGAL_TRANSITIONS` 等架构决策 | 卡片已注明"子代理触发条件"，发现即 spawn arch-reviewer，不擅自改 |
| CLEANUP-08 字体不明 | 卡片注明"方案文档未明确则写 BLOCKER"，禁止擅自选字体 |
| CLEANUP-11 测试不稳定（flaky） | 强制新 spec 先本地连跑 3 次绿，再提交 |
| 并行取卡冲突 | 04/05/06/08/09/10 互不依赖可并行；07 依赖 06；11 依赖 04-10；CLOSE-03 依赖 11 |
| 决策 (c) 不修订 ADR-037 | CLOSE-03 主循环仍强制 "浏览器手动验收" 作为任务卡验收条款一部分（写在卡里而非 ADR），有效等价约束；后续如遇第二次类似漏洞，可再议修订 |

---

## 4. 非目标

- ❌ 本序列不触及 M5-ADMIN-BANNER-01 图片上传延期（属独立任务，仍走原有延期计划）
- ❌ 本序列不启动 M6 任何任务
- ❌ 本序列不扩大人工回归范围（用户决策 e 暂不）；若 CLEANUP 过程中顺手发现新缺陷，记录到 BLOCKER 块但不立刻扩卡，留给下次人工回归窗口
- ❌ 不回滚 eb163fa commit（用户决策 b）；原 M5-CLOSE-02 commit 作为"静态审计误签"历史案例保留

---

## 5. 签发

- **起草**：claude-opus-4-7（本次主循环）
- **授权**：用户决策 (a) 启动 / (b) 不回滚 / (c) 不修订 / (d) 扩写 / (e) 暂不
- **日期**：2026-04-21
