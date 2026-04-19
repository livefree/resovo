# 任务队列补丁 — M3 PLAYER 接管（2026-04-19）

> 适用范围：Phase 3（M3 — 详情页 + 播放器重写）
> 前置补丁：
> - `docs/task_queue_patch_m0_5_close_20260418.md`（Phase 0.5 止损闭幕 + workflow-rules 三条协议）
> - `docs/task_queue_patch_rewrite_track_20260418.md`（apps/web-next/ 并行路线 + RW-SETUP 序列）
> - `docs/task_queue_patch_m2_followup_20260419.md`（M2 闭幕序列，已落地 ✅）
> 发布者：主循环（claude-opus-4-7）审计后起草
> 交付对象：Claude Code 执行会话（默认 claude-sonnet-4-6，M3-PLAYER-01 强制 opus + arch-reviewer 子代理）

---

## 1. 背景与决策

### 1.1 M3 范围

M3 接管 apps/web 全部与"详情页 + 播放器"相关的路由与组件，迁移到 apps/web-next。覆盖面：

- **详情页路由**：6 种 → 合并为 5 种（variety 已在 M2 改名为 tvshow）
  - `/movie/[slug]`、`/series/[slug]`、`/anime/[slug]`、`/tvshow/[slug]`、`/others/[slug]`
- **播放页路由**：1 种
  - `/watch/[slug]`
- **详情页共享组件**：EpisodeGrid / VideoDetailClient / VideoDetailHero / VideoMeta（HeroBanner / VideoCard / VideoCardWide / VideoGrid 已在 M2-HOMEPAGE-01 迁移）
- **播放器**：
  - core 层 28 个文件（Player.tsx + 11 组件 + 11 hooks + ControlRenderer + types + utils）
  - shell 层 5 个文件（PlayerShell.tsx + ResumePrompt.tsx + SourceBar.tsx + VideoPlayer.tsx + playerShell.layout.ts）

### 1.2 关键决策

**决策 A — player core 提升到 packages/player-core/**
player core 层不含业务逻辑（CLAUDE.md 架构约束），须在 apps/web 与 apps/web-next 之间共享。ADR-035 规定 apps/web 与 apps/web-next 不得直接共享代码，共享逻辑放 packages/*。core 层物理迁出到 packages/player-core/，apps/web 的旧 PlayerShell 在 M3-PLAYER-01 后仅改 import 路径（不改业务逻辑），apps/web-next 的新 PlayerShell 在 M3-PLAYER-02 消费该 package。此决策构成 ADR-036，必须由 arch-reviewer (claude-opus-4-6) 子代理设计 API 契约并撰写。

**决策 B — shell 层各 app 独立实现**
PlayerShell 含业务编排（字幕 / 线路 / 剧场模式 / 断点续播），与 apps/*-next 的路由、apps/*-next 的 stores、apps/*-next 的 i18n 强耦合。apps/web-next 的 shell 层为新建，不从 apps/web 物理迁移。apps/web 旧 shell 在 M3-PLAYER-03 翻转 /watch 后整体删除。

**决策 C — ALLOWLIST 分两批翻转**
- 批 1（M3-DETAIL-03）：`/movie` / `/series` / `/anime` / `/tvshow` / `/others` 五条 prefix
- 批 2（M3-PLAYER-03）：`/watch` 一条 prefix
分批目的是降低回滚粒度：若播放器出现严重问题，详情页已接管的成果无需回退。

**决策 D — E2E 迁移与各业务卡同批进行**
详情页 E2E（movie / anime 两个 describe，共 10 tests）在 M3-DETAIL-03 同批从 tests/e2e/player.spec.ts 迁出到 tests/e2e-next/detail.spec.ts。播放页 E2E（PlayerShell / 多集动漫 / VideoPlayer 集成 / PLAYER-10，共 ~15 tests）在 M3-PLAYER-03 同批迁到 tests/e2e-next/player.spec.ts。known_failing 条目在迁移时按补丁 #1 §3.2「重写期测试基线例外」delete-and-add。

**决策 E — 关键路径人工回归清单（M3-PLAYER-03 必做）**
按 CLAUDE.md「播放器模块」约束，M3-PLAYER-03 合并前必须人工回归：① 断点续播 ② 线路切换 ③ 剧场模式 ④ 字幕开关。四项任一未通过则本卡不得合并。

### 1.3 反向约束

- ❌ 不得修改 packages/types 的 VideoType 枚举（方案 A 继续）
- ❌ 不得在 packages/player-core/ 引入 apps/* 的任何代码或类型（core 纯逻辑层）
- ❌ 不得在 apps/web-next 的 PlayerShell 中 `import` apps/web 的任何模块（ADR-035 禁止跨 app 共享）
- ❌ 不得删除 apps/web/src/components/player/core/（物理移到 packages/player-core/ 用 `git mv`）
- ❌ 不得在 M3-DETAIL-03 翻转 ALLOWLIST 前删除 apps/web 旧详情页目录（必须 rewrite 生效后同 PR 删除）
- ❌ 不得在 M3-PLAYER-03 前翻转 `/watch` ALLOWLIST（播放器接管必须在 shell 层就绪后）
- ❌ 不得修改 apps/server/ 或 apps/api/（后台与后端本里程碑不动）
- ❌ 不得修改 docs/decisions.md 的 ADR-034（/watch vs /movie 双路由分治）—— ADR-036 新增为独立条目
- ❌ 不得在任何播放器组件中硬编码颜色（必须用 CSS 变量，TOKEN-13 新名）

---

## 2. SEQ-20260420-M3-DETAIL — 5 种详情页接管

> 状态：⬜ 待开始
> 依赖：M2 PHASE COMPLETE ✅
> 目标：将 movie / series / anime / tvshow / others 5 种详情页路由从 apps/web 迁移到 apps/web-next
> 任务卡数：3（M3-DETAIL-01 / 02 / 03）

---

### 2.1 M3-DETAIL-01 — 详情页共享组件迁移 apps/web-next

- **建议模型**：sonnet
- **依赖**：M2 PHASE COMPLETE ✅
- **目录目标**：apps/web-next/src/components/video/、apps/web-next/src/lib/
- **文件范围**：
  - **新增**：
    - `apps/web-next/src/components/video/EpisodeGrid.tsx`（从 apps/web 复制，CSS 变量用 TOKEN-13 新名）
    - `apps/web-next/src/components/video/VideoDetailClient.tsx`
    - `apps/web-next/src/components/video/VideoDetailHero.tsx`
    - `apps/web-next/src/components/video/VideoMeta.tsx`
    - `apps/web-next/src/lib/video-detail.ts`（如 apps/web 存在，同步迁移 extractShortId 等辅助）
    - `apps/web-next/src/lib/line-display-name.ts`（若详情页引用）
  - **删除**：无（apps/web 原组件保留到 M3-DETAIL-03 翻转后）
  - **修改**：
    - `apps/web-next/package.json`（若新增组件依赖 workspace 包，如 @resovo/types，补齐）
  - **不在范围内**：
    - apps/web 下同名组件（M3-DETAIL-03 删除）
    - player 相关任何文件（M3-PLAYER-01 起处理）
    - i18n messages 新增 key（若组件需要新 key，同步补齐 apps/web-next/messages/\*.json）
- **E2E 生存规则**：
  - 本卡仅新增组件，不翻转 ALLOWLIST，apps/web 详情页继续运行，tests/e2e/player.spec.ts 保持原状。
  - 不新增 E2E。
- **隔离清单操作**：无。
- **路由切分操作**：无。
- **回滚条件**：组件引入破坏 apps/web-next typecheck/lint → `git revert` 本卡。
- **验收**：
  - `apps/web-next/src/components/video/` 含 8 个组件文件（M2 已有 4 个 + 本卡新增 4 个）
  - `rg -n '(--background|--foreground|--gold)\b' apps/web-next/src/components/video` 零命中
  - `npm run typecheck` / `npm run lint` 全绿
  - 不要求运行时验证（未翻转 ALLOWLIST）

---

### 2.2 M3-DETAIL-02 — 5 种详情页路由新建 apps/web-next

- **建议模型**：sonnet
- **依赖**：M3-DETAIL-01 ✅
- **目录目标**：apps/web-next/src/app/[locale]/
- **文件范围**：
  - **新增**：
    - `apps/web-next/src/app/[locale]/movie/[slug]/page.tsx`
    - `apps/web-next/src/app/[locale]/series/[slug]/page.tsx`
    - `apps/web-next/src/app/[locale]/anime/[slug]/page.tsx`
    - `apps/web-next/src/app/[locale]/tvshow/[slug]/page.tsx`
    - `apps/web-next/src/app/[locale]/others/[slug]/page.tsx`
    - （若 5 种 page.tsx 结构高度相似，抽出 `apps/web-next/src/app/[locale]/_lib/detail-page-factory.ts` 工厂函数，5 个 page.tsx 仅传 VideoType 参数；工厂位置以 `_lib` 下划线前缀避免成为路由段）
  - **删除**：无
  - **修改**：
    - `apps/web-next/messages/en.json` / `zh-CN.json`（补齐详情页 i18n key：动作按钮、meta 标签等）
  - **不在范围内**：
    - ALLOWLIST 修改（M3-DETAIL-03 处理）
    - apps/web 旧路由（M3-DETAIL-03 处理）
    - watch 路由（M3-PLAYER-02 处理）
- **E2E 生存规则**：
  - 不翻转 ALLOWLIST，对 apps/web 现有 E2E 无影响。
  - 本卡不新增 E2E（新页面直接访问需经 ALLOWLIST 翻转）。
- **隔离清单操作**：无。
- **路由切分操作**：无（ALLOWLIST 不变，新页面此时仅在 apps/web-next 本地 :3002 可见）。
- **回滚条件**：
  - 新 page.tsx 运行时错误（直接访问 http://127.0.0.1:3002/zh-CN/movie/test 报错）→ 修复或 revert。
- **验收**：
  - 5 个 page.tsx 文件就位，结构一致（如采用工厂函数则 page.tsx 极简，10 行以内）
  - 本地 apps/web-next :3002 直接访问 `/zh-CN/movie/some-slug-xxx` / `/tvshow/...` / `/others/...` 能正确渲染详情页（或 skeleton，视 API 是否命中）
  - `npm run typecheck` / `npm run lint` 全绿
  - `rg -n "'variety'" apps/web-next/src/app` 零命中（URL 段统一 tvshow）

---

### 2.3 M3-DETAIL-03 — ALLOWLIST 翻转 + apps/web 详情页删除 + 详情页 E2E 迁移

- **建议模型**：sonnet
- **依赖**：M3-DETAIL-02 ✅
- **目录目标**：apps/web/src/lib/（ALLOWLIST）+ apps/web/src/app/[locale]/（删除）+ tests/e2e/ + tests/e2e-next/
- **文件范围**：
  - **新增**：
    - `tests/e2e-next/detail.spec.ts`（从 tests/e2e/player.spec.ts 迁出"电影详情页" + "动漫详情页（多集）" 两个 describe，共 ~10 tests；URL 基础地址改为 web-next-chromium 的 WEB_NEXT_URL 或通过 rewrite 统一 apps/web 端口入口）
  - **删除**：
    - `apps/web/src/app/[locale]/movie/`
    - `apps/web/src/app/[locale]/series/`
    - `apps/web/src/app/[locale]/anime/`
    - `apps/web/src/app/[locale]/tvshow/`
    - `apps/web/src/app/[locale]/others/`
    - `apps/web/src/components/video/EpisodeGrid.tsx`
    - `apps/web/src/components/video/VideoDetailClient.tsx`
    - `apps/web/src/components/video/VideoDetailHero.tsx`
    - `apps/web/src/components/video/VideoMeta.tsx`
    - `apps/web/src/lib/video-detail.ts`（若无 apps/web 剩余引用）
    - `apps/web/next.config.ts` 中 M2-TVSHOW-04 添加的 `/variety → /tvshow` redirects 迁到 apps/web-next/next.config.ts（因详情页已由 apps/web-next 承载）
    - （注意：`tests/e2e/player.spec.ts` 保留"播放页"相关 describe，不整体删除；详情页部分 describe 迁出后从该文件移除）
  - **修改**：
    - `apps/web/src/lib/rewrite-allowlist.ts` — 追加 5 条 M3 prefix 条目：
      ```typescript
      { milestone: 'M3', domain: 'player', path: '/movie',   mode: 'prefix', localeAware: true, enabled: true, note: 'M3 movie detail' },
      { milestone: 'M3', domain: 'player', path: '/series',  mode: 'prefix', localeAware: true, enabled: true, note: 'M3 series detail' },
      { milestone: 'M3', domain: 'player', path: '/anime',   mode: 'prefix', localeAware: true, enabled: true, note: 'M3 anime detail' },
      { milestone: 'M3', domain: 'player', path: '/tvshow',  mode: 'prefix', localeAware: true, enabled: true, note: 'M3 tvshow detail' },
      { milestone: 'M3', domain: 'player', path: '/others',  mode: 'prefix', localeAware: true, enabled: true, note: 'M3 others detail' },
      ```
    - `tests/unit/lib/rewrite-match.test.ts` — 追加 5 条 prefix 匹配测试
    - `tests/e2e/player.spec.ts` — 移除 "电影详情页" + "动漫详情页" describe 块
    - `docs/known_failing_tests_phase0.md` — 删除 2 条 M3 详情页 C 条目（C-22 / C-23 对应 "立即观看按钮指向播放页" / "点击第 3 集跳转到播放页 ep 3"；这两条在 e2e::player.spec.ts 原命名下），同步更新 LEGACY SNAPSHOT 注记
    - `apps/web-next/next.config.ts` — 接收来自 apps/web 的 `/variety/:path*` → `/tvshow/:path*` redirect（或改为在 middleware 层统一处理；此决策由本卡执行者结合 ADR-035 判断）
  - **不在范围内**：
    - watch 路由（M3-PLAYER-03）
    - playerStore / player 组件任何文件（M3-PLAYER 阶段）
    - apps/server / apps/api
- **E2E 生存规则**：
  - 翻转后访问 `/zh-CN/movie/...` 经 middleware rewrite 到 apps/web-next :3002 返回 200。
  - 新 tests/e2e-next/detail.spec.ts 全绿（Playwright project: web-next-chromium）。
  - tests/e2e/player.spec.ts 保留的 "播放页" describe 仍绿（不受本卡影响）。
  - 旧 `/variety/...` URL 仍能 308 到 `/tvshow/...`（redirect 已迁至 apps/web-next/next.config.ts）。
- **隔离清单操作**：
  - 删除 `e2e::player.spec.ts::电影详情页::立即观看按钮指向播放页`
  - 删除 `e2e::player.spec.ts::动漫详情页（多集）::点击第 3 集跳转到播放页 ep 3`
  - 追加（若 detail.spec.ts 迁移后有新失败）：以 `e2e-next::detail.spec.ts::...` 前缀写入
- **路由切分操作**：5 条 M3 prefix 条目全部 `enabled: true` 入库。
- **回滚条件**：
  - ALLOWLIST 翻转后 apps/web-next 某详情页 500 / 404：
    - 优先 `REWRITE_ALLOWLIST_DISABLED=1` 秒级回退（整个 ALLOWLIST 失效，回退到 apps/web，但此时 apps/web 详情页已删除，会 404）
    - 因此更安全的回滚是 `git revert` 本卡 commit：ALLOWLIST 条目 + apps/web 删除 + E2E 迁移一起回退
  - 详情页 E2E 断言跨 project 定位错误：播放页 describe 若意外被误删，`git revert` 后重新拆分迁移
- **验收**：
  - `curl -I http://localhost:3000/zh-CN/movie/x-abc123` 返回 200 且 `x-rewrite-source: web-next` / `x-rewrite-rule: M3:player`
  - `curl -I http://localhost:3000/zh-CN/variety/x-abc123` 返回 308 到 `/zh-CN/tvshow/x-abc123`
  - tests/e2e-next/detail.spec.ts 全绿（10 tests）
  - tests/e2e/player.spec.ts 保留的 "播放页" describe 至少与 M2 末态绿度一致
  - `npm run test:guarded -- --mode all --phase 0` 通过
  - `rg -rn "apps/web/src/app/\[locale\]/(movie|series|anime|tvshow|others)" apps/` 零命中

---

## 3. SEQ-20260420-M3-PLAYER — 播放器核心迁移

> 状态：⬜ 待开始
> 依赖：M3-DETAIL-03 ✅
> 目标：player core 提升到 packages/player-core/，apps/web-next 新建 shell 层与 /watch 路由，ALLOWLIST 翻转 /watch
> 任务卡数：3（M3-PLAYER-01 / 02 / 03）

---

### 3.1 M3-PLAYER-01 — player core 提升 packages/player-core/ + ADR-036

- **建议模型**：**opus**（强制；属 CLAUDE.md「重构播放器 core / shell 层的接口」升 Opus 子代理情形）
- **子代理调用**：必须先 `Task(subagent_type: "arch-reviewer", model: "claude-opus-4-6", prompt: ...)` 出具 API 契约设计 + ADR-036 草稿；主循环按子代理结论实施
- **依赖**：M3-DETAIL-03 ✅
- **目录目标**：packages/player-core/（新增）+ apps/web/src/components/player/（import 路径更新）
- **文件范围**：
  - **新增**：
    - `packages/player-core/package.json`（参照 packages/design-tokens 结构）
    - `packages/player-core/tsconfig.json`
    - `packages/player-core/src/index.ts`（公开导出清单）
    - `packages/player-core/README.md`（API 契约 + 消费方约束）
  - **删除**：无（core 目录整体 `git mv` 保留 history）
  - **修改**：
    - **git mv** `apps/web/src/components/player/core/` → `packages/player-core/src/` （保持内部结构：Player.tsx / components/ / controls/ / hooks/ / types.ts / utils/）
    - `apps/web/src/components/player/PlayerShell.tsx` 及 VideoPlayer.tsx、SourceBar.tsx、ResumePrompt.tsx 等 shell 层：所有 `from './core/...'` import 改为 `from '@resovo/player-core'`
    - `apps/web/package.json` 新增 workspace 依赖 `@resovo/player-core: *`
    - `apps/web/tsconfig.json` 路径映射（若需要）
    - 根 `tsconfig.json` 路径映射（参照 TOKEN-12 对 @resovo/design-tokens 的处理）
    - 根 `package.json` typecheck 追加 `--workspace @resovo/player-core`
    - `docs/decisions.md` — 追加 ADR-036（title: 「播放器 core 层提升 packages/player-core」，放在 ADR-035 之后）；内容包含：背景 / 决策 / API 契约（公共导出清单 + 类型签名） / 非目标 / 与 ADR-034 的关系 / 退役时机
    - `docs/architecture.md` — §5 packages 列表追加 player-core 条目
  - **不在范围内**：
    - apps/web-next 下任何文件（M3-PLAYER-02 处理）
    - player shell 层业务逻辑改动（core 内容不改，仅物理移动 + import 路径）
    - 任何 tests 迁移（core 迁移不破坏既有行为，现有 vitest 单测若存在于 apps/web 下同步迁到 packages/player-core/__tests__/）
- **E2E 生存规则**：
  - apps/web `/watch/...` 必须全部保持原有行为（本卡只改 import 路径，不改逻辑）。
  - tests/e2e/player.spec.ts 保留的 "播放页" describe 保持既有绿度（C×5 在 known_failing，不变）。
  - 不新增 E2E。
- **隔离清单操作**：无。
- **路由切分操作**：无（ALLOWLIST 不动）。
- **回滚条件**：
  - apps/web `/watch/` 运行时错误：`git revert` 后 core 目录回到 apps/web/src/components/player/。
  - packages/player-core 构建失败：本卡暂停，在 tasks.md 写 BLOCKER（architecture 级问题，不得主循环自行升 opus 强改）。
- **验收**：
  - `packages/player-core/` 目录就位，`packages/player-core/src/` 含 Player.tsx + 11 组件 + 11 hooks + controls / types / utils
  - `rg -rn "from '.*/core/'" apps/web/src/components/player` 零命中（全部改为 `from '@resovo/player-core'`）
  - `npm run typecheck` / `npm run lint` 全绿
  - `npm run test -- --run` 全绿（vitest 1102+ 不降）
  - `docs/decisions.md` 含 ADR-036，日期 2026-04-xx（写入日期），状态"已采纳"
  - `docs/architecture.md` §5 含 player-core 条目
  - tasks.md 卡片「子代理调用」字段填 `arch-reviewer (claude-opus-4-6) — API 契约设计 + ADR-036 草稿`
  - commit trailer 含模型审计信息

---

### 3.2 M3-PLAYER-02 — apps/web-next PlayerShell + shell 层 + /watch 路由

- **建议模型**：sonnet
- **依赖**：M3-PLAYER-01 ✅
- **目录目标**：apps/web-next/src/components/player/、apps/web-next/src/stores/、apps/web-next/src/app/[locale]/watch/
- **文件范围**：
  - **新增**：
    - `apps/web-next/src/components/player/PlayerShell.tsx`（新建，消费 @resovo/player-core；结构参考 apps/web 旧 PlayerShell，但 Next.js App Router 语义 / apps/web-next 的 stores 与 lib）
    - `apps/web-next/src/components/player/SourceBar.tsx`
    - `apps/web-next/src/components/player/ResumePrompt.tsx`
    - `apps/web-next/src/components/player/VideoPlayer.tsx`（含 dynamic import ssr: false）
    - `apps/web-next/src/components/player/playerShell.layout.ts`
    - `apps/web-next/src/stores/playerStore.ts`（zustand；API 与 apps/web 保持一致）
    - `apps/web-next/src/app/[locale]/watch/[slug]/page.tsx`（Server Component 入口，渲染 PlayerShell）
    - `apps/web-next/src/lib/video-detail.ts`（如 M3-DETAIL-01 未迁则在此补齐；extractShortId 等）
    - `apps/web-next/src/lib/line-display-name.ts`（同上）
  - **删除**：无（apps/web /watch 目录保留到 M3-PLAYER-03）
  - **修改**：
    - `apps/web-next/package.json` 追加 `@resovo/player-core: *` + `zustand: *`（若未引入）
    - `apps/web-next/messages/en.json` / `zh-CN.json` 补齐播放页 i18n key
  - **不在范围内**：
    - ALLOWLIST 修改（M3-PLAYER-03）
    - apps/web 旧 shell 层删除（M3-PLAYER-03）
    - 弹幕（M5）、字幕源切换 UI 新增（M3 仅迁移现有能力）
- **E2E 生存规则**：
  - ALLOWLIST 未翻转，`/watch/*` 仍由 apps/web 承载；新增的 apps/web-next watch 仅在 :3002 本地可达。
  - 不新增 tests/e2e-next E2E（M3-PLAYER-03 统一迁移）。
- **隔离清单操作**：无。
- **路由切分操作**：无。
- **回滚条件**：
  - apps/web-next :3002 直接访问 `/watch/test-abc` 500：`git revert` 本卡，apps/web 未受影响。
- **验收**：
  - `apps/web-next/src/components/player/` 含 5 个 shell 文件 + 无 core/ 子目录
  - `rg -rn "from '@resovo/player-core'" apps/web-next/src/components/player` 命中每个 shell 文件
  - `rg -rn "apps/web/src/" apps/web-next/src` 零命中（禁止跨 app 相对路径）
  - 本地 apps/web-next :3002 访问 `/zh-CN/watch/some-slug-abc` 能渲染 PlayerShell（视频源可能为 mock 或实际 API）
  - `npm run typecheck` / `npm run lint` 全绿
  - `rg -n '(--background|--foreground|--gold)\b' apps/web-next/src/components/player` 零命中

---

### 3.3 M3-PLAYER-03 — ALLOWLIST 翻转 /watch + apps/web 清退 + 播放页 E2E 迁移 + 关键路径回归

- **建议模型**：sonnet
- **依赖**：M3-PLAYER-02 ✅
- **目录目标**：apps/web/src/lib/、apps/web/（删除）、tests/e2e-next/
- **文件范围**：
  - **新增**：
    - `tests/e2e-next/player.spec.ts`（从 tests/e2e/player.spec.ts 迁入剩余所有 describe：播放页 PlayerShell / 多集动漫 / VideoPlayer 集成 / PLAYER-10 完整链路，共 ~15 tests）
  - **删除**：
    - `apps/web/src/app/[locale]/watch/`
    - `apps/web/src/components/player/PlayerShell.tsx`
    - `apps/web/src/components/player/SourceBar.tsx`
    - `apps/web/src/components/player/ResumePrompt.tsx`
    - `apps/web/src/components/player/VideoPlayer.tsx`
    - `apps/web/src/components/player/playerShell.layout.ts`
    - `apps/web/src/components/player/`（整个目录，因 core 已在 M3-PLAYER-01 移走，本卡删除 shell 后目录空）
    - `apps/web/src/stores/playerStore.ts`（若 apps/web 无其他消费者）
    - `tests/e2e/player.spec.ts`（整份删除，内容已分两批迁到 tests/e2e-next/detail.spec.ts 与 player.spec.ts）
  - **修改**：
    - `apps/web/src/lib/rewrite-allowlist.ts` — 追加 M3 `/watch` prefix 条目：
      ```typescript
      { milestone: 'M3', domain: 'player', path: '/watch', mode: 'prefix', localeAware: true, enabled: true, note: 'M3 watch player' },
      ```
    - `tests/unit/lib/rewrite-match.test.ts` — 追加 `/watch` prefix 测试
    - `docs/known_failing_tests_phase0.md` — 删除 5 条 C 类 M3 播放页条目（标题链接指向详情页 / 剧场模式切换按钮可见 / 显示右侧选集面板 / 选集面板显示正确数量）；保留 C-47 「DanmakuBar 存在于播放页中」到 M5（按原 triage）
  - **不在范围内**：
    - search.spec.ts 「点击结果卡片跳转到播放页」（C-31）：该条卡的断言是搜索 → 播放页 href 格式，属搜索页行为。M5 搜索接管时处理；本卡可选补 testid 但不强制。
    - 弹幕（C-47）保留到 M5
    - apps/api 后端播放源逻辑
- **E2E 生存规则**：
  - ALLOWLIST 翻转后 `/zh-CN/watch/xxx` rewrite 到 apps/web-next :3002 返回 200
  - tests/e2e-next/player.spec.ts 新迁入 describe 中凡原在 known_failing 的条目，迁移后若仍失败则以 `e2e-next::player.spec.ts::...` 前缀保留（走 delete-and-add 基线例外）；若迁移后转绿则直接删除
  - tests/e2e/ 目录下不得再保留任何 player 相关 spec
- **隔离清单操作**：
  - 删除 4 条 `e2e::player.spec.ts::播放页（PlayerShell）::...` 和 `e2e::player.spec.ts::播放页（多集动漫）::...` 对应条目
  - 若迁移后仍红，以新前缀 `e2e-next::player.spec.ts::...` 重新写入并注 "M3-PLAYER-03 过渡保留"
  - LEGACY SNAPSHOT 注记更新，total 条数按本卡实际缩减数量同步
- **路由切分操作**：`/watch` prefix `enabled: true`
- **回滚条件**：
  - `/watch` 翻转后任一关键路径回归失败（断点续播 / 线路切换 / 剧场模式 / 字幕开关）：立即 `REWRITE_ALLOWLIST_DISABLED=1` 秒级回退 + `git revert` 本卡 commit；apps/web /watch 与 shell 层从 M3-PLAYER-02 状态恢复（M3-PLAYER-02 未删这些文件，本卡才删）
  - 若本卡已合并但发现问题，由于 apps/web 的 shell 层已删，秒级回退后需要额外 `git revert M3-PLAYER-03` 并重建 apps/web shell → 成本较高；因此**本卡合并前必须完成下面的关键路径回归验收**
- **验收**：
  - `curl -I http://localhost:3000/zh-CN/watch/xxx-abc123` 返回 200 + `x-rewrite-source: web-next` + `x-rewrite-rule: M3:player`
  - **关键路径人工回归四项全通过**（合并前必做，不得跳过）：
    1. 断点续播：播放到 30s 关闭，重开同一页面，ResumePrompt 提示并能 resume
    2. 线路切换：多线路视频点击 `source-btn-1` 后播放器切换线路且继续播放
    3. 剧场模式：大屏幕点击剧场模式切换按钮，右侧面板收起 + 下方推荐出现
    4. 字幕开关：若有字幕源，开关字幕能显示/隐藏
  - tests/e2e-next/player.spec.ts 全部新迁 describe 运行（预期绿度不低于迁移前 tests/e2e/player.spec.ts 对应 describe 的绿度）
  - `npm run test:guarded -- --mode all --phase 0` 通过（newFailures == 0）
  - `rg -rn "apps/web/src/(app/\[locale\]/watch|components/player|stores/playerStore)" apps/` 零命中
  - `ls tests/e2e/` 无 player.spec.ts

---

## 4. SEQ-20260420-M3-CLOSE — M3 闭幕

> 状态：⬜ 待开始
> 依赖：M3-DETAIL-03 + M3-PLAYER-03 全部 ✅
> 目标：M3 PHASE COMPLETE、known_failing 缩减统计、补丁 §2 叙述微调、独立审计员挂钩
> 任务卡数：1（M3-CLOSE-01）

---

### 4.1 M3-CLOSE-01 — M3 PHASE COMPLETE + 缩减统计 + 审计挂钩

- **建议模型**：haiku
- **依赖**：SEQ-20260420-M3-DETAIL + SEQ-20260420-M3-PLAYER 全部 ✅
- **目录目标**：docs/
- **文件范围**：
  - **新增**：无
  - **删除**：无
  - **修改**：
    - `docs/task-queue.md` — 追加 M3 PHASE COMPLETE 通知块（格式参照 Phase 1/2 通知块）
    - `docs/changelog.md` — 追加 M3 闭幕汇总条目（列出 7 张卡 ID + 关键产出：packages/player-core 新建 / ADR-036 / 6 条 ALLOWLIST 条目 / known_failing 缩减 N 条）
    - `docs/task_queue_patch_rewrite_track_20260418.md` — §5 「旧代码删除时机」表 M3 行核对：apps/web 详情页 5 个目录 + watch 目录 + player/ 整个目录 已删除；§6 M6-RENAME-01 协议的 file_scope 删除列表同步缩减
    - `docs/known_failing_tests_phase0.md` — 更新 header 注记，汇总 Phase 0 至 M3 末尾的条目缩减：homepage 6 + search 1（M2）+ movie/anime detail 2（M3-DETAIL-03）+ PlayerShell/多集 4（M3-PLAYER-03）= 13 条已删；剩余条目以实际为准
    - `docs/architecture.md` — §15 过渡期路由拓扑章节更新 ALLOWLIST 当前启用条目清单（原 1 + M2 1 + M3 6 = 8 条）
  - **不在范围内**：
    - 任何 apps/ 或 packages/ 下文件
    - tests/ 下文件
    - ADR 新增（ADR-036 已在 M3-PLAYER-01 落地）
- **E2E 生存规则**：无（纯文档卡）。
- **隔离清单操作**：仅更新 header 注记，不改 JSON 条目（M3-DETAIL-03 + M3-PLAYER-03 已完成实际删除）。
- **路由切分操作**：无。
- **回滚条件**：文档错字或格式错误 → `git revert`。
- **验收**：
  - `docs/task-queue.md` 末尾出现 `✅ PHASE COMPLETE — Phase 3（M3）详情页 + 播放器重写里程碑已完成` 通知块
  - `docs/changelog.md` 含 `## M3 — PHASE CLOSE` 汇总条目
  - `docs/task_queue_patch_rewrite_track_20260418.md` §5 / §6 内容同步
  - `docs/known_failing_tests_phase0.md` header 缩减统计与实际 JSON 条目数一致
  - 人工验收后通过，进入 M4（AUTH 接管）

---

## 5. 外部接口与协议影响

- **ALLOWLIST**：本里程碑追加 6 条（5 详情页 prefix + 1 watch prefix），全部 `enabled: true`；累计启用 8 条（next-placeholder + homepage + 6 M3）。
- **ADR-035**：退役时机不变（M6 整体退役）；本里程碑仅追加条目，不改协议。
- **ADR-036（新增）**：播放器 core 层提升 packages/player-core；退役时机 = M6 M6-RENAME-01 完成后 apps/web 不再存在时重评估（可能保持 packages 态）。
- **ADR-034（/watch vs /movie/... 双路由分治）**：不变，M3 仅物理迁移路由，不重新评估分治策略。
- **packages/types**：不动。
- **DB / API**：不动。
- **apps/server / apps/admin**：不动（按方案 A 与补丁 #2 §2 单线叙述，M6 前单独评审）。

---

## 6. 执行时序与交接建议

| 序号 | 任务 ID | 模型 | 依赖 | 估时 | 关键风险点 |
|------|---------|------|------|------|------------|
| 1 | M3-DETAIL-01 | sonnet | M2 ✅ | 45min | CSS 变量清退（同 M2-HOMEPAGE-02 经验） |
| 2 | M3-DETAIL-02 | sonnet | 1 ✅ | 50min | 5 种路由结构一致性（建议工厂函数） |
| 3 | M3-DETAIL-03 | sonnet | 2 ✅ | 60min | ALLOWLIST 翻转 + 同批删除 + E2E 迁移的原子性 |
| 4 | M3-PLAYER-01 | **opus** | 3 ✅ | 90min | `git mv` 原子性 + `@resovo/player-core` workspace 配置 + ADR-036 撰写（arch-reviewer opus 子代理必须先出设计） |
| 5 | M3-PLAYER-02 | sonnet | 4 ✅ | 90min | shell 层新建时对 apps/web-next stores / lib 的镜像；VideoPlayer dynamic import ssr: false |
| 6 | M3-PLAYER-03 | sonnet | 5 ✅ | 60min | 关键路径四项人工回归（合并前硬阻断） |
| 7 | M3-CLOSE-01 | haiku | 3 + 6 ✅ | 20min | 纯文档，不改 apps/ |

**并行机会**：
- M3-DETAIL-01 与 M3-PLAYER-01 不可并行（PLAYER-01 建议在 DETAIL 全部完成后启动，避免 apps/web 旧 shell 在 ALLOWLIST 翻转过程中同时被 core 迁移扰动）
- M3-PLAYER-02 与 M3-PLAYER-01 不可并行（强依赖）
- 除此之外卡间严格串行

**关键路径回归执行脚本建议**（M3-PLAYER-03 使用）：
```
# 断点续播
npx playwright test tests/e2e-next/player.spec.ts -g "resume"
# 线路切换
npx playwright test tests/e2e-next/player.spec.ts -g "source-btn"
# 剧场模式
npx playwright test tests/e2e-next/player.spec.ts -g "剧场模式"
# 字幕（若有覆盖）
npx playwright test tests/e2e-next/player.spec.ts -g "字幕"
```
但自动化无法完全替代人工观感验证，M3-PLAYER-03 验收条目中"关键路径四项"必须有一次 devtools 观察确认。

**交接格式**：每张卡完成后严格按 workflow-rules 走单任务工作台 → tasks.md 写卡 → 执行 → 完成备注 → 更新 task-queue → 删除 tasks.md 卡片 → 追加 changelog → git commit（前缀 `feat(M3-XXX):` / `chore(M3-XXX):` / `refactor(M3-XXX):` / `docs(M3-XXX):`）。

---

## 7. 反向约束重申

M3 期间，Claude Code 不得：

1. 进入 M4 前未完成 SEQ-20260420-M3-DETAIL + SEQ-20260420-M3-PLAYER + SEQ-20260420-M3-CLOSE 全部 7 卡。
2. 修改 packages/types/VideoType / DB migration / apps/api / apps/server。
3. 在 apps/web-next 与 apps/web 之间直接 `import`（共享代码必须经 packages/*）。
4. 在 M3-PLAYER-01 之前跳过 arch-reviewer (claude-opus-4-6) 子代理设计（违反 CLAUDE.md「重构播放器 core / shell 层接口」强制升 Opus 情形）。
5. 在 M3-PLAYER-03 合并前跳过关键路径四项人工回归（断点续播 / 线路切换 / 剧场模式 / 字幕开关）。
6. 在 M3-CLOSE-01 之前宣布 M3 PHASE COMPLETE。
7. 未经独立审计员（Opus 子代理）审核前完成 M3-CLOSE-01（遵循补丁 #1 §3.1 协议）。
8. 在 packages/player-core 中引入 apps/* 的任何类型或模块。
9. 在 playerShell / VideoPlayer 等组件中硬编码颜色（必须 CSS 变量）。
10. 删除 apps/web 文件时未经 ALLOWLIST 翻转先行（M3-DETAIL-03 与 M3-PLAYER-03 的删除步骤必须与 ALLOWLIST 翻转在同一 commit）。

---

## 8. 审计员挂钩（引用补丁 #1 §3.1）

M3-CLOSE-01 提交前，主会话必须通过 `Task(subagent_type: "arch-reviewer", model: "claude-opus-4-6", prompt: ...)` 子代理独立复核：

- 本里程碑 7 张卡是否均 ✅ 且 quality gate 全绿
- packages/player-core 是否满足 ADR-036 的 API 契约（公开导出清单与 README 一致）
- apps/web 是否已清退：`/app/[locale]/watch`、`/app/[locale]/{movie,series,anime,tvshow,others}`、`/components/player/`、`/stores/playerStore.ts` 全部消失
- ALLOWLIST 实际启用条目是否与 §5 声明的 8 条一致
- 关键路径四项回归记录是否有人工验收证据（截图 / 视频 / 文字记录三选一）
- known_failing_tests_phase0.md 缩减统计是否与 M3 实际删除数对齐
- ADR-036 是否在 docs/decisions.md 就位，状态"已采纳"，且与 ADR-034 / 035 不冲突

子代理报告作为 M4 启动的硬前置条件，写入 tasks.md 卡片的「子代理调用」字段与 commit trailer（格式参考 TOKEN-09 / RW-SETUP-02）。

---

## 9. 非目标

- **M4（AUTH 接管）**：login / register / session 的 apps/web-next 迁移 —— M3 完成后单独起补丁
- **M5（SEARCH 接管 + 弹幕重接入）**：search 路由迁移 + DanmakuBar（C-47）—— M3 不处理
- **M6（ADMIN 接管 + RENAME）**：apps/server 处理 + apps/web 整体退役 + git mv apps/web-next → apps/web —— M3 不涉及
- **packages/player-core 的独立发布**：本里程碑仅 workspace 内部消费，不上 npm
- **字幕源切换 UI 新增 / 弹幕新增 / 剧场模式重构**：M3 仅物理迁移现有能力，不做功能增量
- **apps/admin-next / apps/server-next 的去留**：仍在 M6 前单独评审（参见补丁 #2 §2 单线叙述校正）

---

**补丁结束。**
