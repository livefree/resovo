# 任务队列补丁 — M2 后续闭幕序列（2026-04-19）

> 适用范围：Phase 2（M2 — Homepage & Browse 重写）
> 前置补丁：`docs/task_queue_patch_m0_5_close_20260418.md`、`docs/task_queue_patch_rewrite_track_20260418.md`
> 发布者：主循环（claude-opus-4-7）审计后起草
> 交付对象：Claude Code 执行会话（建议默认 claude-sonnet-4-6，部分卡注明 haiku / opus）

---

## 1. 背景与决策

### 1.1 M2 已完成工作

Claude Code 在 M2 阶段已完成 4 张卡（均已 ✅，commit 齐全）：

- **M2-HOMEPAGE-01** — apps/web-next/ 首页组件树 + page.tsx；ALLOWLIST 追加 `/` exact localeAware；旧 apps/web homepage 删除；tests/e2e/homepage.spec.ts → tests/e2e-next/homepage.spec.ts（15 tests）；known_failing 删 6 条 homepage。
- **M2-TVSHOW-01** — apps/web-next Nav MORE_CATEGORIES variety → tvshow；apps/web BrowseGrid 加 tvshow → variety 别名映射。
- **M2-TVSHOW-02** — apps/web Nav MORE_CATEGORIES variety → tvshow。
- **M2-TVSHOW-03** — apps/web FilterArea variety → tvshow（含 testid）。

方案 A 已确认为本里程碑基调：DB/VideoType/packages/types 不动，前台对外呈现 tvshow，内部映射回 variety。

### 1.2 审计发现的三个未闭合缺口

M2 不能原样进入 M3，必须先闭合以下三项：

**缺口 A — apps/web-next/ CSS 变量回归 TOKEN-13 之前的旧名**
apps/web-next/src/app/[locale]/page.tsx 及新建组件引用 `--background` / `--foreground` / `--gold` 等旧变量名，但 apps/web-next/src/app/globals.css 按 TOKEN-13 仅定义 `--bg-canvas` / `--fg-default` / `--accent-default`，无 legacy shim。首页浏览器渲染时上述变量未定义，会回落到继承/透明，色彩错乱。必须清退为 TOKEN-13 新名，禁止在 globals.css 加 shim。

**缺口 B — 详情页 URL 未对外一致**
apps/web 与 apps/web-next 的 `src/lib/video-route.ts` 中 `PRIMARY_DETAIL_TYPES` 仍把 variety 映射到 `/variety/` URL 段；apps/web 详情页目录只有 `variety/[slug]/`，没有 `tvshow/[slug]/`。用户经 Nav → /browse?type=tvshow → 点卡片后跳到 `/variety/[slug]`，对外 URL 与导航不一致。

**缺口 C — 搜索页侧未同步**
apps/web/src/components/search/FilterBar.tsx 与 ResultCard.tsx 未纳入 M2-TVSHOW-01..03 的修改集，类型筛选器值与 E2E testid 仍为 variety。

### 1.3 本补丁决策

1. 方案 A 继续使用，DB/VideoType/packages/types 全部不动；显示文案（综艺 / Variety）不改。
2. 对外 URL 扩展到详情页段：`/variety/[slug]` → `/tvshow/[slug]`；原 `/variety/*` 以 308 permanent redirect 兼容。
3. `/variety/*` 旧路径在 M3 开始前保留 redirect；M6 末 apps/web 整体退役时连同一并移除（届时 apps/web-next 直接以 `/tvshow/*` 承载）。
4. apps/web-next CSS 变量清退为 TOKEN-13 新名。globals.css 不得添加 legacy shim。
5. apps/server 后台的 variety 显示与筛选本里程碑不动（后台面向运营，内部类型名变更成本大于收益；M6 前单独评审）。
6. 本补丁 §5 固化补丁 #2 §2 已悬而未决的 apps/\*-next/ 叙述校正为 apps/web-next/ 单线。

### 1.4 反向约束

- ❌ 不得在 apps/web-next/src/app/globals.css 添加 `--background` / `--foreground` / `--gold` 旧名别名——缺口 A 走清退方向，不走 shim 方向。
- ❌ 不得删除 apps/web/src/app/[locale]/variety/ 目录——改为 git mv 重命名保留历史；308 redirect 由 next.config.ts 配置。
- ❌ 不得修改 packages/types/VideoType 枚举或 DB 相关 migration。
- ❌ 不得修改 apps/server/（admin 后台）或 apps/api/（后端）的 variety 引用。
- ❌ 不得在 rewrite-allowlist.ts 中将 `/variety` 或 `/tvshow` 加入 M2 条目——详情页仍由 apps/web 承载，M3 player 接管时再决定是否迁 apps/web-next。
- ❌ 不得改动已合并的 M2-HOMEPAGE-01 / TVSHOW-01..03 的 commit；增量改动走新卡。

---

（以下为追加到 task-queue.md 的内容）

## 2. 任务序列 SEQ-20260419-M2-CLOSE

> 状态：⬜ 待开始
> 依赖：M2-HOMEPAGE-01 + M2-TVSHOW-01..03 全部 ✅（已满足）
> 目标：闭合三个未闭合缺口 + 正式关闭 M2 里程碑，准备进入 M3（PLAYER 接管）
> 任务卡数：6（M2-HOMEPAGE-02 / M2-TVSHOW-04 / M2-TVSHOW-05 / M2-TVSHOW-06 / M2-E2E-01 / M2-CLOSE-01）

---

### 2.1 M2-HOMEPAGE-02 — apps/web-next/ 清退 TOKEN-13 之前的旧 CSS 变量

- **建议模型**：sonnet
- **依赖**：M2-HOMEPAGE-01 ✅
- **目录目标**：apps/web-next/
- **文件范围**：
  - **新增**：无
  - **删除**：无
  - **修改**：
    - `apps/web-next/src/app/[locale]/page.tsx`（`--background` → `--bg-canvas`、`--foreground` → `--fg-default`、`--gold` → `--accent-default`）
    - `apps/web-next/src/components/layout/Nav.tsx`（同上所有旧变量）
    - `apps/web-next/src/components/layout/Footer.tsx`
    - `apps/web-next/src/components/ui/ThemeToggle.tsx`
    - `apps/web-next/src/components/video/HeroBanner.tsx`
    - `apps/web-next/src/components/video/VideoGrid.tsx`
    - `apps/web-next/src/components/video/VideoCard.tsx`
    - `apps/web-next/src/components/video/VideoCardWide.tsx`
  - **不在范围内**：
    - `apps/web-next/src/app/globals.css`（禁止加 legacy shim）
    - `apps/web/src/*`（apps/web 旧变量的清退由 TOKEN-13 完成，本卡只管 apps/web-next）
    - 任何 apps/server / apps/api / packages/\*
- **E2E 生存规则**：
  - tests/e2e-next/homepage.spec.ts 所有 15 tests 必须保持绿。
  - 不新增 E2E；本卡仅涉及 CSS 变量名，无行为变更。
- **隔离清单操作**：无（本卡不触发 E2E 新增/删除）。
- **路由切分操作**：无（ALLOWLIST 不变）。
- **回滚条件**：
  - 若任何页面视觉回归（与 TOKEN-13 后的 apps/web 首页截图对比出现肉眼可辨色差），回滚本卡并在 task-queue 记录；由主循环评估是否需要 globals.css 临时 shim 作为补丁。
- **验收**：
  - `rg -n '(--background|--foreground|--gold)\b' apps/web-next/src` 零命中（排除注释）。
  - `npm run typecheck` / `npm run lint` / `npm run test -- --run` 全绿。
  - 人工打开 http://localhost:3000/zh-CN/ 与 http://localhost:3000/en/ 截图与 TOKEN-13 合并前 apps/web 首页截图比对无色差。

---

### 2.2 M2-TVSHOW-04 — 详情页 URL /variety → /tvshow

- **建议模型**：sonnet
- **依赖**：M2-TVSHOW-01..03 ✅
- **目录目标**：apps/web/（主体：目录重命名 + redirect）+ apps/web-next/（route-helper 同步）
- **文件范围**：
  - **新增**：无
  - **删除**：无（git mv 保留历史，不得 rm）
  - **修改**：
    - `apps/web/src/app/[locale]/variety/` → `apps/web/src/app/[locale]/tvshow/`（`git mv`，保留 `[slug]/page.tsx`）
    - `apps/web/src/lib/video-route.ts` — 引入 `URL_SEGMENT_MAP: Record<VideoType, string>`（variety → 'tvshow'，其他类型原样），改 `getDetailSegment` 读该表；`PRIMARY_DETAIL_TYPES` 保留以判定 PRIMARY vs others，内部枚举继续用 variety
    - `apps/web-next/src/lib/video-route.ts` — 同上实现镜像（直到 apps/web 整体退役）
    - `apps/web/next.config.ts` — 新增 `redirects()` 条目：`{ source: '/:locale(en|zh-CN)/variety/:path*', destination: '/:locale/tvshow/:path*', permanent: true }`
  - **不在范围内**：
    - `packages/types` VideoType 枚举
    - apps/api 任何文件（后端仍按 variety 内部类型处理）
    - apps/server（后台不动）
    - tests/e2e（旧 E2E 中含 /variety/ 的断言本卡不改，由 M2-E2E-01 统一处理）
- **E2E 生存规则**：
  - 本卡完成后 apps/web 详情页 E2E（如 tests/e2e/player.spec.ts 或类似）若断言 `/variety/[slug]` URL，会从绿转红；由 M2-E2E-01 统一更新断言 URL 到 `/tvshow/[slug]`。
  - 本卡交付前暂时允许这些 E2E 失败，必须在 M2-E2E-01 同批 PR 内修复。
- **隔离清单操作**：
  - 若本卡造成新增 E2E 失败，临时写入 `docs/known_failing_tests_phase0.md` 的 LEGACY SNAPSHOT 区域并注 "M2-TVSHOW-04 过渡，M2-E2E-01 修复"；M2-E2E-01 完成后同批移除。
- **路由切分操作**：
  - `apps/web/src/lib/rewrite-allowlist.ts` 不追加条目（详情页仍由 apps/web 承载）。
  - 校验 `/tvshow/[slug]` 请求不被 middleware 错误地 rewrite 到 apps/web-next（因 ALLOWLIST 当前只含 `/` exact，不会误伤，但需 playwright 断言 `x-rewrite-source` 头不存在）。
- **回滚条件**：
  - 若 redirect 造成循环重定向或 404：立即 `git revert` 本卡 commit，apps/web 恢复 variety/ 目录，用户体验退回 M2-TVSHOW-03 末态。
  - 若 next.config.ts redirects 与 middleware 冲突（如 locale 匹配失败）：改为在 middleware 顶部插 308，回退到代码级处理；以 ADR-035 kill-switch 机制为紧急退出。
- **验收**：
  - 访问 `/zh-CN/variety/some-slug-abc123` 返回 308 跳到 `/zh-CN/tvshow/some-slug-abc123`；`/en/variety/...` 同理。
  - `/zh-CN/tvshow/some-slug-abc123` 返回 200，页面加载详情。
  - VideoCard 点击后浏览器地址栏直接为 `/tvshow/[slug]`，无中间 308（因 getVideoDetailHref 已生成新段）。
  - `rg -n "'variety'" apps/web/src/lib/video-route.ts` 命中仅限 VideoType 类型判定（不含 URL 段）。
  - `npm run typecheck` / `npm run lint` / `npm run test -- --run` 全绿。

---

### 2.3 M2-TVSHOW-05 — apps/web search FilterBar + ResultCard variety → tvshow

- **建议模型**：sonnet
- **依赖**：M2-TVSHOW-04 完成（URL 段统一后搜索页跳详情才一致）
- **目录目标**：apps/web/
- **文件范围**：
  - **新增**：无
  - **删除**：无
  - **修改**：
    - `apps/web/src/components/search/FilterBar.tsx` — type 筛选项 variety → tvshow；testid `filter-type-variety` → `filter-type-tvshow`；URL query `?type=tvshow` 构造（不改 API 调用，API 侧继续接收 variety，通过 BrowseGrid 的 TYPE_ALIAS 或此处新增同样的别名函数映射）
    - `apps/web/src/components/search/ResultCard.tsx` — 若有硬编码 `/variety/` URL 构造，改走 `getVideoDetailHref`（M2-TVSHOW-04 已更新为输出 `/tvshow/`）
    - `apps/web/src/components/search/FilterBar.tsx` 如含 API query 构造，复用或集中到 `apps/web/src/lib/video-route.ts` 的 `buildTypeQueryParam(label → internal)` 辅助函数（若不存在则在此卡新增）
    - `tests/e2e/search.spec.ts` — 筛选器 testid、URL 参数、结果卡点击后 URL 断言同步更新（variety → tvshow）
  - **不在范围内**：
    - apps/web-next 搜索页（M5 搜索接管时处理）
    - apps/api search route（后端枚举不动）
    - 消息文件 `messages/*.json` 的 "综艺"/"Variety" 显示文本
- **E2E 生存规则**：
  - tests/e2e/search.spec.ts 的 "点击类型筛选后结果更新" 在 known_failing 中（C-30），完成本卡后从清单移除。
  - tests/e2e/search.spec.ts 的 "点击结果卡片跳转到播放页"（C-31）本里程碑不处理，保留在隔离清单。
- **隔离清单操作**：
  - `docs/known_failing_tests_phase0.md` 删除 `e2e::search.spec.ts::分类浏览页::点击类型筛选后结果更新（只显示该类型）`（1 条）。
  - 总条数从 54 减到 47（含 M2-HOMEPAGE-01 删的 6 条 homepage）。
- **路由切分操作**：无。
- **回滚条件**：
  - 若筛选器点击"综艺"后无结果（API 别名映射断开）：立即 `git revert` 本卡 commit 并排查 BrowseGrid / FilterBar 的别名函数是否被误重构。
- **验收**：
  - 访问 `/search?q=...`，点击类型筛选"综艺"后 URL 变为 `?type=tvshow`，列表返回 variety 类型视频。
  - 点击搜索结果卡跳到 `/tvshow/[slug]`。
  - search.spec.ts 至少 "点击类型筛选" 一条从 known_failing 移除后变绿。
  - `npm run typecheck` / `npm run lint` / `npm run test -- --run` 全绿。

---

### 2.4 M2-TVSHOW-06 — apps/web 剩余 variety URL 构造扫尾

- **建议模型**：haiku（机械性扫描 + 替换）
- **依赖**：M2-TVSHOW-04 完成
- **目录目标**：apps/web/ 前台展示层
- **文件范围**：
  - **新增**：无
  - **删除**：无
  - **修改**：以下文件中若存在硬编码 `/variety/` URL 字符串或局部类型段拼接，改走 `getVideoDetailHref`（M2-TVSHOW-04 已为唯一入口）：
    - `apps/web/src/components/video/VideoCard.tsx`
    - `apps/web/src/components/video/VideoMeta.tsx`
    - `apps/web/src/components/video/VideoDetailHero.tsx`
    - `apps/web/src/components/templates/Page.template.tsx`
    - `apps/web/src/app/[locale]/others/[slug]/page.tsx`（只处理内部链接；others 目录本身不改名）
  - **不在范围内**：
    - 任何 apps/server / apps/api 文件
    - 任何 `*.test.*` / `*.spec.*`（E2E 断言统一在 M2-E2E-01 处理）
    - packages/design-tokens、packages/types
    - i18n messages 文件
  - **验收方法**：`rg -n "'/variety/'" apps/web/src` 零命中（允许 `VideoType` 枚举判定保留 `'variety'` 字符串）。
- **E2E 生存规则**：本卡只改 URL 构造口，不触发 E2E 行为变化；若 M2-TVSHOW-04 + M2-TVSHOW-05 已覆盖，本卡不应引入新 E2E 失败。
- **隔离清单操作**：无（仅扫尾）。
- **路由切分操作**：无。
- **回滚条件**：若替换后某页面详情链接 404，回滚本卡并排查 `getVideoDetailHref` 入参是否包含 `type === 'variety'` 的 video 记录。
- **验收**：
  - `rg -n "/variety/" apps/web/src` 命中仅限 next.config.ts redirects source、video-route.ts 注释。
  - 手工点击 VideoMeta / VideoDetailHero / ResultCard 任一 variety 类型卡片，URL 为 `/tvshow/[slug]`。
  - `npm run typecheck` / `npm run lint` / `npm run test -- --run` 全绿。

---

### 2.5 M2-E2E-01 — M2 E2E 新增覆盖 & 断言同步

- **建议模型**：sonnet
- **依赖**：M2-HOMEPAGE-02 / M2-TVSHOW-04 / M2-TVSHOW-05 / M2-TVSHOW-06 全部 ✅
- **目录目标**：tests/e2e-next/（新增）+ tests/e2e/（更新旧断言）
- **文件范围**：
  - **新增**：
    - `tests/e2e-next/browse-tvshow.spec.ts`（覆盖：home → Nav 点综艺 → /browse?type=tvshow → 点首张卡片 → /tvshow/[slug]）
  - **删除**：无
  - **修改**：
    - `tests/e2e/search.spec.ts`（若 M2-TVSHOW-05 未完全覆盖搜索结果卡点击 URL 断言，在本卡统一补齐；检查所有 variety 字面量）
    - 其他 tests/e2e/\* 中含 `/variety/` 字符串的断言：逐一改为 `/tvshow/`（redirect 测试除外，如显式断言 308 行为）
    - `docs/known_failing_tests_phase0.md`：若 M2-TVSHOW-04 过渡期临时写入的条目仍在，全部移除
  - **不在范围内**：
    - tests/e2e-next/homepage.spec.ts（M2-HOMEPAGE-01 已覆盖，本卡不动）
    - tests/e2e-next/smoke.spec.ts（RW-SETUP-03 验收用，保留）
- **E2E 生存规则**：
  - 新增 browse-tvshow.spec.ts 必须全绿；若 apps/web 详情页 rewrite 未加入 ALLOWLIST，则 playwright 中该 spec 跨 port（3000→3002 rewrite→3000 return）可能需要 base-URL 配置，已在 RW-SETUP-03 playwright.config.ts 中预留。
- **隔离清单操作**：
  - 本卡完成后 `docs/known_failing_tests_phase0.md` 的 E2E 条数从 M2-TVSHOW-05 后的 47 条继续缩减。
  - 建议复核 LEGACY SNAPSHOT 区域全部 M2 相关条目，能删尽删。
- **路由切分操作**：无新增 ALLOWLIST 条目。
- **回滚条件**：若 browse-tvshow.spec.ts 在 CI 稳定红（本地绿），判定为 playwright webServer 配置问题，回滚本卡并在 task-queue 写 BLOCKER。
- **验收**：
  - `npm run test:e2e -- --project=web-next-chromium browse-tvshow.spec.ts` 全绿。
  - `npm run test:e2e -- --project=web-chromium` 无新增红。
  - `npm run test:guarded -- --mode all --phase 0` 通过（newFailures 为 0）。

---

### 2.6 M2-CLOSE-01 — M2 PHASE COMPLETE + 文档收尾 + 补丁 §2 叙述校正

- **建议模型**：haiku
- **依赖**：M2-HOMEPAGE-02 / M2-TVSHOW-04 / M2-TVSHOW-05 / M2-TVSHOW-06 / M2-E2E-01 全部 ✅
- **目录目标**：docs/
- **文件范围**：
  - **新增**：无
  - **删除**：无
  - **修改**：
    - `docs/task-queue.md` — 追加 M2 PHASE COMPLETE 通知块（格式参照 Phase 1 通知块，含本里程碑完成任务数 / 关键产出 / M3 启动条件）
    - `docs/changelog.md` — 追加 M2 闭幕汇总条目（列出本里程碑所有卡 ID + 交付产出）
    - `docs/task_queue_patch_rewrite_track_20260418.md` — §2 ASCII 拓扑图修订：apps/\*-next/ 改写为 apps/web-next/ 单线；§5 "旧代码删除时机"表对应修订；admin-next / server-next 写入"M6 前单独评审"占位
    - `docs/known_failing_tests_phase0.md` — 更新 header 注记：Phase 0 完结前缩减统计（homepage 6 + search 1 + 其他；最终条数以本卡提交时实际为准）
    - `docs/architecture.md` — §15 过渡期路由拓扑章节补 URL_SEGMENT_MAP 说明段（variety → tvshow 映射的存在与 M6 末退役）
  - **不在范围内**：
    - 任何 apps/ 下文件
    - tests/ 下文件
    - packages/ 下文件
    - docs/decisions.md（ADR-035 内容不需改动，退役时机已写明 M6）
- **E2E 生存规则**：无（纯文档卡）。
- **隔离清单操作**：本卡不修改隔离清单条目，但在 PHASE COMPLETE 块中引用当前条数。
- **路由切分操作**：无。
- **回滚条件**：文档内容错误——`git revert` 即可。
- **验收**：
  - `docs/task-queue.md` 末尾出现 `✅ PHASE COMPLETE — Phase 2（M2）Homepage & Browse 重写里程碑已完成` 块。
  - `docs/changelog.md` 含 "## M2 — PHASE CLOSE" 汇总条目。
  - `docs/task_queue_patch_rewrite_track_20260418.md` §2 / §5 内容已校正为 apps/web-next/ 单线。
  - 人工验收后通过，进入 M3（PLAYER 接管）。

---

## 3. 外部接口与协议影响

- ALLOWLIST：本补丁全程只消费 M2-HOMEPAGE-01 已追加的 `/` 条目，不追加新条目。
- ADR-035：退役时机条款不变（M6 整体退役）。
- VideoType 枚举：方案 A 维持不变，variety 为内部标识，前台 URL 对外统一呈现 tvshow。
- 后台（apps/server）：本里程碑不动，M6 前单独评审。

---

## 4. 执行时序与交接建议

| 序号 | 任务 ID        | 模型   | 依赖                | 估时    | 备注                                                 |
| ---- | -------------- | ------ | ------------------- | ------- | ---------------------------------------------------- |
| 1    | M2-HOMEPAGE-02 | sonnet | M2-HOMEPAGE-01 ✅   | 30 分钟 | 独立可启动，不依赖其他 M2-TVSHOW 卡                  |
| 2    | M2-TVSHOW-04   | sonnet | M2-TVSHOW-01..03 ✅ | 45 分钟 | 含 git mv + redirects + video-route.ts；E2E 会临时红 |
| 3    | M2-TVSHOW-05   | sonnet | M2-TVSHOW-04        | 40 分钟 | 搜索页同步                                           |
| 4    | M2-TVSHOW-06   | haiku  | M2-TVSHOW-04        | 20 分钟 | 机械扫尾                                             |
| 5    | M2-E2E-01      | sonnet | 1–4 全部 ✅         | 40 分钟 | 新 E2E + 断言同步                                    |
| 6    | M2-CLOSE-01    | haiku  | 1–5 全部 ✅         | 15 分钟 | 文档闭幕                                             |

**并行机会**：1 与 2 可并行（文件无交集）；3 与 4 不并行（3 依赖 4 的 getDetailSegment 输出）；5 必须串行于前四卡后。

**交接格式**：每张卡完成后在 tasks.md 写单任务卡片（依工作流 workflow-rules）→ 执行 → 完成备注 → 更新 task-queue 状态 → 删除 tasks.md 卡片 → 追加 changelog → git commit（commit message 前缀 `feat(M2-XXX):` / `chore(M2-XXX):`）。

---

## 5. 反向约束重申

- 本补丁适用期内，Claude Code 不得：
  1. 进入 M3 前未完成本 SEQ 全部 6 卡。
  2. 修改 packages/types/VideoType 或任何 DB migration。
  3. 触碰 apps/server/ 或 apps/api/ 的 variety 引用。
  4. 在 apps/web-next/globals.css 添加旧 CSS 变量 shim。
  5. 未经独立审计员（Opus 子代理）审核前宣布 M2 PHASE COMPLETE（遵循补丁 #1 §3.1 协议）。

---

## 6. 审计员挂钩（引用补丁 #1 §3.1）

M2-CLOSE-01 提交前，主会话必须通过 Task(arch-reviewer, claude-opus-4-6) 子代理独立复核：

- 本 SEQ 全部 6 张卡是否均已 ✅ 且 quality gate 全绿
- known_failing_tests_phase0.md 缩减统计是否与 M2 实际交付一致
- M2-HOMEPAGE-02 CSS 变量清退是否彻底（grep 零命中为准）
- M2-TVSHOW-04 redirect 是否通过人工验证（访问 /variety/... 真得到 308）
- 补丁 #2 §2 / §5 的 apps/\*-next/ → apps/web-next/ 单线叙述校正是否落实

子代理报告作为 M3 启动的硬前置条件，写入 tasks.md 卡片的 "子代理调用" 字段与 commit trailer。

---

## 7. 本补丁不包含的内容（非目标）

- M3（PLAYER 接管）的任务序列——M2 闭幕后单独起补丁
- apps/admin-next / apps/server-next 的去留决策——M6 前单独评审
- Phase 2 隔离清单从 phase0 迁到 phase1 的协议——M6 末一并处理
- apps/web 详情页本身的重写（player shell、字幕、线路切换等）——M3 范围

---

**补丁结束。**
