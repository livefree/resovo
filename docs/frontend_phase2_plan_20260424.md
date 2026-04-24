# 前台 UI 功能补完计划 · Phase 2

> status: draft · 待入队执行（v1.1 已修订 6 项可行性缺陷）
> owner: @engineering
> created: 2026-04-24
> revised: 2026-04-24（v1.1，基于执行前审查修订：热搜端点 / MiniPlayer 范围 / Server Component 约束 / filter 空值处理 / highlight XSS / 影院模式 CSS bug）
> 对齐方案：`docs/handoff_20260422/landing_plan_v1.md`（上游）、`docs/frontend_design_spec_20260423.md`（视觉基准）
> 关联序列：`SEQ-20260423-UI-REBUILD`（HANDOFF-10~18 ✅，已完成）
> 建议序列 ID：`SEQ-20260424-FRONTEND-PHASE2`
> 调查来源：`docs/handoff_20260422/manual_qa_m6_20260423.md` + 2026-04-23 人工审查报告

---

## 0. 背景与定位

SEQ-20260423-UI-REBUILD（HANDOFF-10~18）完成了 Token 补齐、Nav/Footer/HeroBanner/Shelf/Browse/Search/Detail/Watch 的骨架重做。
本计划针对审查发现的**确定性 Bug、缺失功能区块、交互偏差**进行补完，不改变已通过 arch-reviewer 签字的架构决策。

---

## 1. 问题全景

### 1.1 确定性 Bug（P0，阻断核心路径）

| # | 问题 | 定位 | 根因 |
|---|------|------|------|
| B-1 | BrowseGrid 使用 `/videos/trending`，返回无 `pagination` 字段 | `BrowseGrid.tsx:160` | 接口错用；`res.pagination.total` 为 undefined，分类页永远"暂无内容" |
| B-2 | `CategoryPageContent` 解析了 `videoType` 但未传给 `BrowseGrid` | `[type]/page.tsx:34` | BrowseGrid 靠 URL searchParams 取 type，但路由 segment 的类型未同步注入 |
| B-3 | FilterArea chip 再次点击已选值不会取消，重复写入 URL | `FilterArea.tsx:212` | `handleSelect` 缺"已选 → 删参"分支，逻辑与 `HANDOFF.md:66` 要求不符 |
| B-4 | 影院模式下播放器被压缩到页面最左侧 | `globals.css:571-574`、`PlayerShell.tsx:354` | `@media(≥1024px)` `.player-layout` 设 `align-items: flex-start`；切换影院模式时 `flex-direction` 变回 `column` 但 `align-items` 未重置，子元素按内容宽度收缩 |

### 1.2 功能缺失（P1）

| # | 问题 | 设计稿锚点 |
|---|------|-----------|
| F-1 | 首页缺 FeaturedRow（编辑精选）、TopTenRow（Top10 排行）、新番动漫 Shelf | `home-b-2.html:1013-1143` |
| F-2 | 首页未消费 `/home/top10`、`/home/modules`，后端运营位能力闲置 | `home.ts:19` |
| F-3 | TypeShortcuts 分类捷径无数量角标，未调 `/videos/count-by-type` | `home-b-2.html:1113-1141` |
| F-4 | HeroBanner 无数据时直接返回 `null`，首屏塌陷 | `HeroBanner.tsx:29` |
| F-5 | 详情页主列为空（注释"后续任务补充"），无简介、演职员 | `VideoDetailClient.tsx:81` |
| F-6 | 搜索结果用 VideoCard 网格展示，无高亮、无分页 | `SearchPage.tsx:234`；`Site Design-2.html:1561` |

### 1.3 交互偏差（P2）

| # | 问题 | 定位 |
|---|------|------|
| I-1 | Nav 搜索框快捷键未适配 OS：Mac 应显示 ⌘K，Windows/Linux 应显示 Ctrl+K | `Nav.tsx:443` |
| I-2 | Nav 右侧组件（ThemeToggle + 设置按钮）未靠右 | `Nav.tsx`：内层 flex 容器缺 `w-full`，`flex-1` 搜索框无法撑开 |
| I-3 | 搜索浮层缺热搜榜、仅 focus 触发（无 ⌘K/Ctrl+K 键盘监听） | `Nav.tsx:443` |
| I-4 | MiniPlayer 缺 hover 返回 chip、视频区点击无跳转（进度条和播放/暂停控制需等 LIFT 序列完成） | `MiniPlayer.tsx:120`；`Global Shell.html:546` |
| I-5 | Nav "更多"按钮无 hover 展开逻辑 | `Nav.tsx` |
| I-6 | Nav 分类（MAIN_CATEGORIES）与 FilterArea type options 不同源：`tvshow` vs `variety`，且 documentary/more 品类未在 FilterArea 中出现 | `Nav.tsx:44`；`FilterArea.tsx:55` |

### 1.4 视觉/结构问题（P3）

| # | 问题 | 定位 |
|---|------|------|
| V-1 | 各页面视频卡片大小不一致：`VideoCardWide`（16:9）与 `VideoCard`（2:3）混用 | `Shelf.tsx:247`；`VideoGrid.tsx:123,139` |
| V-2 | Footer 结构与 `Global Shell.html` 不符：有重复链接（Help/Privacy/DMCA/About 出现两次），链接全部 404，缺 locale 前缀 | `Footer.tsx:28` |
| V-3 | Settings 按钮无任何行为 | `Nav.tsx:487`（`onClick` 缺失） |
| V-4 | 搜索框最大宽度 480px 偏大（视觉占比过重），需缩至 240px | `globals.css:107` |

---

## 2. 任务拆分（HANDOFF-19 起）

### HANDOFF-19 · BrowseGrid 接口修正 + FilterArea 交互修复 + 影院模式 CSS Bug

**目标**：修复 B-1/B-2/B-3/B-4，让分类浏览页功能完整可用，同时修复影院模式布局塌陷。  
**建议模型**：sonnet  
**估时**：0.75d

**文件范围**：

**① BrowseGrid 接口（B-1/B-2）**

> **实现备注**：`[type]/page.tsx` 当前 props 仅有 `params`，`CategoryPageContent` 无 `searchParams` 入参。若要在服务端净化 URL 参数需额外修改 page props（Next.js App Router 支持 `searchParams: Promise<...>` prop，但增加了传递链）。为避免实现时漏接参数，**选择以 BrowseGrid 的 `initialType` 强制覆盖作为唯一权威防线**，不在 `CategoryPageContent` 层做参数净化。

- `apps/web-next/src/app/[locale]/[type]/page.tsx`
  - **无需修改** page props 签名（`params` 不变）
  - `CategoryPageContent` 将已解析的 `videoType` 作为 `initialType` prop 传给 `<BrowseGrid initialType={videoType} />`
  - 同时向 `<FilterArea lockedDims={['type']} />` 传入 `lockedDims`，隐藏 type 筛选行（路由 segment 已锁定类型，视觉上不出现可编辑的 type chip）
- `apps/web-next/src/components/browse/BrowseGrid.tsx`
  - 端点由 `/videos/trending` 改为 `/videos`
  - 新增 prop `initialType?: VideoType`，构建请求参数时**无条件强制覆盖 type**，不做条件判断：
    ```ts
    const effectiveParams = new URLSearchParams(searchParams.toString())
    if (initialType) effectiveParams.set('type', initialType)
    // ↑ 这是唯一权威：无论 URL 中 ?type= 是什么，initialType 始终优先
    ```
  - 读取 `res.pagination.total` 做分页总数（`/videos` 接口已返回 pagination）

**② FilterArea chip 取消逻辑（B-3）**

`handleSelect` 正确实现（v1.0 片段有缺陷，v1.1 修正）：

```ts
function handleSelect(dim: FilterDim, value: string) {
  const current = new URLSearchParams(searchParams.toString())
  // 1) value='' 代表"全部"，无论何时都删参
  if (value === '') {
    current.delete(dim)
  // 2) 再次点击已选的非空值 → 取消（相当于退回全部）
  } else if (current.get(dim) === value) {
    current.delete(dim)
  // 3) 选择新值
  } else {
    current.set(dim, value)
  }
  current.set('page', '1')
  router.push(`${pathname}?${current.toString()}`)
}
```

**③ 分类路由与过滤器一致性规则（B-2 延伸）**

权威层级：**BrowseGrid 的 `initialType` 强制覆盖是唯一权威**，FilterArea 的 `lockedDims` 仅作视觉辅助（隐藏 type 行，防止用户误操作），二者均由 `CategoryPageContent` 传入。

- `CategoryPageContent`（`[type]/page.tsx`）无需接收 `searchParams`，仅凭路由 segment 解析出的 `videoType` 即可完成防御：传 `initialType={videoType}` 给 BrowseGrid，传 `lockedDims={['type']}` 给 FilterArea
- `FilterArea` 中 `lockedDims` 包含的维度行**完全隐藏**（不渲染，不仅禁用），使用户无法通过 UI 注入错误类型
- BrowseGrid 的 `effectiveParams.set('type', initialType)` 作为最终防线，即使用户手动修改 URL query 也会被覆盖
- 仅无 `initialType` 的场景（如未来的 `/browse` 通用页）才显示完整 type 维度

**④ 影院模式 CSS Bug（B-4）**
- `apps/web-next/src/app/globals.css`：在 `.player-layout--theater` 规则中补充 `align-items: stretch`：
  ```css
  .player-layout.player-layout--theater {
    flex-direction: column;
    gap: 0;
    align-items: stretch;  /* 重置 @media(≥1024px) 的 flex-start，防止子元素按内容宽度收缩 */
  }
  ```

**验收**：
- `/en/movie` 显示电影列表 + 分页可用；FilterArea 无 type 行
- `/en/browse`（若有）显示完整过滤包含 type 维度
- 点击已选 chip 取消选择；点击"全部"清除该维度
- `/en/series?country=JP` 正确过滤
- 影院模式下播放器全宽铺满（无左侧压缩现象）

---

### HANDOFF-20 · 全站竖版卡片统一 + HeroBanner fallback + TypeShortcuts 计数 + lib/categories.ts 创建

**目标**：统一视觉（V-1）；修复首屏塌陷（F-4）；补充分类计数（F-3）；创建分类单源常量文件（供 HANDOFF-21 直接导入，避免并行执行时重复定义）。  
**建议模型**：sonnet  
**估时**：1d

**背景决策（用户 2026-04-24 明确）**：  
现阶段弃用 `VideoCardWide`（16:9 横版），全部使用 `VideoCard`（2:3 竖版）。`landscape-row` Shelf 保留横向滚动轨道，但卡片宽度与比例切换为竖版。`VideoCardWide.tsx` 文件保留但标注 `@deprecated`，不删除（保留 git 历史可追溯），等后续有明确设计方案后再决策复用或移除。

**文件范围**：
- `apps/web-next/src/components/video/Shelf.tsx`
  - `landscape-row` track：`VideoCardWide` → `VideoCard`；卡片宽度改用 `var(--shelf-card-w-portrait)`（170px）；`aspectRatio` 改为 `2/3`
  - 更新 Skeleton track 对应分支：`landscape-row` 的 `cardWidth` 和 `aspectRatio` 同步修改
  - 移除 `import { VideoCardWide }` 导入（Shelf 内不再使用）
- `apps/web-next/src/components/video/VideoGrid.tsx`
  - `variant='landscape'` 分支：`VideoCardWide` → `VideoCard`；width/aspectRatio 同步为竖版
  - 移除 `import { VideoCardWide }` 导入
- `apps/web-next/src/components/video/VideoCardWide.tsx`
  - 文件首行加 `/** @deprecated 已弃用，竖版统一，保留待评估 */` 注释，不删除
- `apps/web-next/src/components/video/HeroBanner.tsx`
  - `/banners` 返回空数组时，渲染静态 fallback：品牌主色背景（`var(--accent-muted)`）+ 中央品牌 Logo + Slogan 文案（i18n key `hero.fallbackSlogan`）。不渲染轮播控件；高度保持 `min(520px, 60vh)`，不塌陷。
- **不修改** `apps/web-next/src/app/[locale]/page.tsx` 的 Server Component 性质
  - `page.tsx` 保持 async Server Component，继续使用 `getTranslations()`
  - 将 `CategoryShortcuts` 函数**提取为独立文件** `apps/web-next/src/components/home/CategoryShortcutsClient.tsx`（新建，`'use client'`）
  - `page.tsx` 将 `locale`（或不传，由 Client Component 自行读 params/context）传给 `<CategoryShortcutsClient />`
  - `CategoryShortcutsClient`：mount 时调用 `/videos/count-by-type`（`skipAuth: true`），在每个分类卡片右上角叠加数量 badge（`1,234+` 格式；`>= 10000` → `10K+`）；加载中 / 接口错误时 badge 不渲染，卡片结构不受影响
  - i18n 文案：Client Component 通过 `next-intl` 的 `useTranslations('nav')` 获取（next-intl 支持 Client Component 使用 `useTranslations`）
- `apps/web-next/messages/{zh,en}.json`：补 `hero.fallbackSlogan` 文案
- **新建 `apps/web-next/src/lib/categories.ts`**（提前到本卡，供 `CategoryShortcutsClient` 和后续 HANDOFF-21 共同使用，避免并行执行时重复定义）：
  ```ts
  // 唯一真实来源：typeParam = 路由 slug，videoType = API 参数（对齐 ADR-048 §4）
  export const ALL_CATEGORIES = [
    { typeParam: 'movie',       videoType: 'movie',       labelKey: 'nav.catMovie'       },
    { typeParam: 'series',      videoType: 'series',      labelKey: 'nav.catSeries'      },
    { typeParam: 'anime',       videoType: 'anime',       labelKey: 'nav.catAnime'       },
    { typeParam: 'tvshow',      videoType: 'variety',     labelKey: 'nav.catVariety'     },
    { typeParam: 'documentary', videoType: 'documentary', labelKey: 'nav.catDocumentary' },
    { typeParam: 'short',       videoType: 'short',       labelKey: 'nav.catShort'       },
    { typeParam: 'sports',      videoType: 'sports',      labelKey: 'nav.catSports'      },
    { typeParam: 'music',       videoType: 'music',       labelKey: 'nav.catMusic'       },
    { typeParam: 'news',        videoType: 'news',        labelKey: 'nav.catNews'        },
    { typeParam: 'kids',        videoType: 'kids',        labelKey: 'nav.catKids'        },
    { typeParam: 'other',       videoType: 'other',       labelKey: 'nav.catOther'       },
  ] as const
  export const MAIN_TYPE_PARAMS = ['movie','series','anime','tvshow','documentary'] as const
  export const MORE_TYPE_PARAMS  = ['short','sports','music','news','kids','other'] as const
  ```
  `CategoryShortcutsClient` 从此文件导入并过滤 `MAIN_TYPE_PARAMS` 展示前 5 个分类。

**验收**：
- 所有 ShelfRow（poster-row / landscape-row）显示竖版卡片，比例 2:3
- 关闭 API 时首页有品牌色 fallback，首屏不白屏
- 分类捷径显示数量角标；接口错误时卡片仍正常渲染
- `lib/categories.ts` 已创建，导出三个常量，`typecheck` 通过

---

### HANDOFF-21 · Nav 交互修正（右对齐 + 分类同源 + 搜索宽度 + ⌘K 适配 + 更多展开）

**目标**：修复 I-1/I-2/I-3/I-5/I-6，一次性解决 Nav 所有交互偏差。  
**前置依赖**：HANDOFF-20（`lib/categories.ts` 已创建）  
**建议模型**：sonnet  
**估时**：0.75d

**文件范围**：

**① 右侧靠右（I-2）**
- `Nav.tsx`：内层容器 `<div className="max-w-shell mx-auto px-8 h-full flex items-center gap-6">` 加 `w-full`，使 `flex-1` 搜索框撑满剩余空间，右侧按钮组自然靠右

**② 搜索框宽度（V-4）**
- `apps/web-next/src/app/globals.css:107`：`--search-input-max-w: 480px` → `240px`

**③ ⌘K OS 适配（I-1/I-3）**

> **v1.1 修订**：原计划调用 `/search/suggest?hot=1` 不可行。现有 `/search/suggest` 接口 schema 要求 `q` 非空（`z.string().min(1)`），收到无 `q` 或 `q=''` 请求会返回 422。不新增后端端点，改为前端静态热搜列表。

- `Nav.tsx`：新增 `useEffect` 检测平台并注册键盘监听：
  ```ts
  const isMac = typeof navigator !== 'undefined' &&
    (navigator.platform.toUpperCase().includes('MAC') ||
     navigator.userAgentData?.platform === 'macOS')
  // 监听 (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
  // ← 一个监听覆盖 Mac(⌘K) 和 Win/Linux(Ctrl+K) 两平台
  ```
- 搜索框占位符 / badge 文案按平台动态显示：Mac → `⌘K`，其他 → `Ctrl+K`
- 浮层展开逻辑：键盘触发时 `focus()` 搜索框 + `setOverlayOpen(true)`
- 浮层**无输入内容时**展示静态热搜榜：
  - 在 `messages/{zh,en}.json` 中维护 `nav.hotSearchTerms`（字符串数组，各 ≤ 6 个词）
  - `SearchOverlay` 读取翻译数组，渲染最多 8 条热搜 chip，点击 chip 填入搜索框并触发搜索
  - 无需任何 API 调用；文案随运营需求更新 i18n 文件即可

**④ "更多"hover 展开（I-5）**
- `MoreMenu` 组件（或 Nav 内联 MoreMenu）：去掉 `onClick` 状态管理，改为 CSS `group/hover` + `group-hover:block` 展开子菜单。`@media (hover: none)` 下降级为点击展开（触屏设备保持可用）

**⑤ 分类数据同源（I-6）**
- `lib/categories.ts` 已在 HANDOFF-20 创建，本卡直接导入，**不重新定义**
- `Nav.tsx`：移除内部 `MAIN_CATEGORIES` / `MORE_CATEGORIES` 常量，改从 `lib/categories.ts` 导入 `ALL_CATEGORIES`、`MAIN_TYPE_PARAMS`、`MORE_TYPE_PARAMS` 派生
- `FilterArea.tsx`：`type` dimension 的 options 改从 `lib/categories.ts` 的 `ALL_CATEGORIES` 生成（`videoType` 作为 filter value，`labelKey` 作为显示文案），确保与 Nav 完全同步
- `[type]/page.tsx`：`VALID_TYPES` 映射改从 `lib/categories.ts` 生成，消除多处维护

**验收**：
- Nav 右侧 ThemeToggle + 设置按钮贴右边缘
- 搜索框宽度缩至约 240px
- Mac 显示 ⌘K 提示，Windows/Linux 显示 Ctrl+K；键盘触发可打开浮层
- "更多" hover 展开（桌面端）/ 点击展开（触屏端）
- Nav 分类与 Browse page type chip 完全一致

---

### REVIEW-A · 阶段独立审核（HANDOFF-19~21 完成后）

**触发条件**：HANDOFF-19 + HANDOFF-20 + HANDOFF-21 全部 ✅，且 `npm run typecheck / lint / test` 全绿  
**模型**：arch-reviewer（`claude-opus-4-6`）  
**审核要点**（不少于 8 项）：
1. BrowseGrid `/videos` 接口参数格式与后端 schema 一致性
2. `lib/categories.ts` 单源常量导出结构合理性，`typeParam` vs `videoType` 映射正确性（对齐 ADR-048 §4）
3. `initialType` prop 接口定义与 `VideoType` enum 约束
4. OS 检测代码 SSR 安全性（`typeof navigator !== 'undefined'` 守卫）
5. HeroBanner fallback 颜色零硬编码（CSS 变量全覆盖）
6. TypeShortcuts 改 Client Component 后 SSR/CSR 边界是否合理
7. VideoCardWide 弃用注释合规；无遗漏的 landscape import（全仓 grep 确认）
8. `globals.css` token `--search-input-max-w` 变更是否与 design-tokens 层一致（或应迁入 tokens）

审核结果写入 `docs/handoff_20260422/review_phase2_a_20260424.md`，PASS 后才可启动 HANDOFF-22。

---

### HANDOFF-22 · 首页完整区块补完（FeaturedRow + TopTenRow + 动漫 Shelf）

**目标**：首页对齐 `home-b-2.html:1013-1143`，补充三个缺失核心区块。  
**建议模型**：sonnet  
**估时**：1.5d

**文件范围**：
- 新增 `apps/web-next/src/components/home/TopTenRow.tsx`
  - 调用 `GET /home/top10`（已存在）
  - 水平滚动轨道，竖版卡片（2:3，170px 宽，统一 HANDOFF-20 决策）
  - 每张卡片左下角叠加 rank badge：1-3 号字号更大（`32px / 700`），4-10 正常（`20px / 600`），颜色走 `var(--fg-muted)`
  - 副标题文案：当 `Top10Response.sortStrategy === 'manual_plus_rating'` 时显示"编辑推荐 · 基于评分精选"（`v2.1` 算法上线后前端零改动自动切换）
  - 无数据时渲染 4 个 `EmptyPlaceholderCard` 占位，不隐藏区块
- 新增 `apps/web-next/src/components/home/FeaturedRow.tsx`
  - 调用 `GET /home/modules?slot=featured`（已存在）
  - 布局：`1.6fr + 3×1fr` CSS grid（桌面端），大卡比例 4:5，小卡比例 2:3
  - 无数据（接口返回空 / 失败）时降级为普通 `ShelfRow`（`poster-row` 样式，调 `/videos/trending?period=week&limit=5`）
  - 大卡显示标题、描述前 80 字符（折叠），小卡只显示封面
- `apps/web-next/src/app/[locale]/page.tsx`：首页节奏改为：

  ```
  HeroBanner（全宽）
  └─ 主内容容器（max-w-feature，gap: 56px）
     ├─ CategoryShortcuts（5 列分类捷径 + 数量角标）
     ├─ FeaturedRow（编辑精选，消费 /home/modules?slot=featured）
     ├─ TopTenRow（Top10 排行，消费 /home/top10）
     ├─ ShelfRow — 热门电影（poster-row，/videos/trending?type=movie&period=week&limit=10）
     ├─ ShelfRow — 热播剧集（poster-row，/videos/trending?type=series&period=week&limit=10）
     └─ ShelfRow — 新番动漫（poster-row，/videos/trending?type=anime&period=week&limit=10）
  ```

- 国际化：`messages/{zh,en}.json` 补 `home.topTen`、`home.featured`、`home.trendingAnime` 等文案
- `apps/web-next/src/components/home/` 目录（新建）

**验收**：
- 首页 6 个内容区块全部渲染（FeaturedRow / TopTenRow / 电影 / 剧集 / 动漫）
- TopTenRow rank badge 位置精确（左下角叠加）
- FeaturedRow 无运营数据时降级为普通 Shelf，不白屏
- 所有卡片为竖版（2:3）

---

### HANDOFF-23 · 搜索结果页重构（列表式 + 高亮 + 分页）

**目标**：搜索结果对齐 `Site Design-2.html:1561`，从网格改为列表式，支持关键词高亮和分页。  
**建议模型**：sonnet  
**估时**：0.75d

**文件范围**：
- `apps/web-next/src/app/[locale]/search/_components/SearchPage.tsx`
  - 结果区域从 `VideoCard` 网格改为列表行
  - 每行结构：封面（120px，2:3）+ 右侧信息区（标题 + meta + CTA）
  - 标题渲染：若 `highlight.title` 存在，需解析其中的 `<em>...</em>` 标记并安全渲染。**实现规范**：
    - API 返回的 `highlight.title` 为含 `<em>` 标签的字符串（Elasticsearch 高亮格式），如 `"毒液：<em>最后</em>一舞"`
    - **禁止使用 `dangerouslySetInnerHTML`**（字段内容来自用户搜索词，存在 XSS 风险）
    - 实现 `parseHighlight(raw: string): React.ReactNode[]` 工具函数：
      1. 用 `raw.split(/(<em>.*?<\/em>)/g)` 分割字符串
      2. 遍历分割结果：普通文本直接作为字符串节点；`<em>...</em>` 片段提取内部文本（`slice(4, -5)`）包裹为 `<mark key={i}>`
      3. 所有文本内容均为纯字符串（不含 HTML），无需额外转义
    - `parseHighlight` 放在 `apps/web-next/src/lib/parse-highlight.ts`（可被 SearchPage 和未来其他组件复用）
    - `<mark>` 样式走 CSS 变量：`background: var(--accent-muted); color: var(--accent-default); border-radius: 2px; padding: 0 2px`
  - meta 信息行：类型 Chip + 年份 + 评分（三者均有 token 支撑）
  - CTA 按钮："立即观看"→ `router.push(watchUrl)`；"详情"→ detail 页
  - 分页：`limit=20`，底部 Pagination 组件（复用 BrowseGrid 已有的 `BrowsePagination` 或提取为 `Pagination` primitive）
  - Tab 切换（全部/电影/剧集/动漫）控制 API `type` 参数，**不做前端过滤**

**验收**：
- 搜索结果以列表行展示（封面 + 信息区）
- 关键词有 `<mark>` 高亮（API 返回 `highlight` 字段时）
- 分页控件可用
- Tab 切换触发新 API 请求

---

### HANDOFF-24 · 详情页主列补完

**目标**：填充 `VideoDetailClient.tsx` 主列空白区域（F-5），对齐 `Site Design-2.html:1581`。  
**建议模型**：sonnet  
**估时**：0.75d

**文件范围**：
- `apps/web-next/src/components/video/VideoDetailClient.tsx`
  - 主列"后续任务补充"注释区域填充以下内容：
    1. **剧情简介**：`video.description`，超 4 行折叠 + "展开"toggle；无 description 时不渲染该区块
    2. **演职员横向列表**：`video.cast`（演员）+ `video.director`（导演），头像（`SafeImage`，圆形 40px）+ 姓名；无此字段时不渲染
    3. **制作信息 meta 行**：国家 + 语言 + 年份 + 类型（从现有 `VideoMeta` 组件读取或复用）
  - 如 `/videos/:slug` 响应中 `cast`/`director` 字段缺失，标注 `// TODO: API 待补充 cast/director 字段` 注释，对应区块条件渲染（`if (!video.cast?.length) return null`），不造假数据

**注意**：若调查确认 API 响应无 cast/director 字段，HANDOFF-24 在简介 + meta 行上验收通过即可，演职员区块标注 TODO 等后端补充。

**验收**：
- 详情页主列有剧情简介区块（有数据时）
- 简介超 4 行有折叠/展开
- meta 信息行显示完整

---

### REVIEW-B · 阶段独立审核（HANDOFF-22~24 完成后）

**触发条件**：HANDOFF-22 + HANDOFF-23 + HANDOFF-24 全部 ✅，且 `typecheck / lint / test / e2e` 全绿  
**模型**：arch-reviewer（`claude-opus-4-6`）  
**审核要点**（不少于 8 项）：
1. FeaturedRow 数据降级路径（无运营数据时 fallback 不白屏）
2. TopTenRow `sortStrategy` 字段驱动副标题文案（向前兼容性）
3. FeaturedRow / TopTenRow 组件 Props 类型定义合理性，是否需要沉淀共享层
4. `parseHighlight()` 实现正确性：分割后普通文本段不含 HTML 标签（grep `dangerouslySetInnerHTML` 零命中）；`<em>` 内部文本已提取为纯字符串后包裹 `<mark>`，无 XSS 路径
5. `Pagination` primitive 是否已提取为共享组件（BrowseGrid / SearchPage 复用同一实现）
6. DetailPage 演职员 TODO 标注规范；API 字段缺失时条件渲染逻辑是否正确
7. 首页新区块在 `light / dark` 双主题下颜色全走变量（arch-reviewer grep 验证）
8. `home-b-2.html` 设计稿节奏对照（6 个区块顺序是否与设计稿一致）

审核结果写入 `docs/handoff_20260422/review_phase2_b_20260424.md`，PASS 后才可启动 HANDOFF-25。

---

### HANDOFF-25 · MiniPlayer 交互补齐（范围受限版）

**目标**：MiniPlayer 补充视频区点击回播页、hover 返回 chip（I-4 受限范围）。  
**建议模型**：sonnet  
**估时**：0.4d

**v1.1 范围说明**：

原计划包含进度条和播放/暂停控制，但经可行性审查发现**无法在本卡范围内实现**：

- 离开 `/watch` 后，`RoutePlayerSync` 将 `hostMode` 切为 `mini`，此时 `GlobalPlayerHost` 只渲染 `MiniPlayer`；原 `/watch` 页面的 `PlayerShell` / `VideoPlayer` 已卸载，`data-mini-video-slot` 中的 `<video>` DOM 元素不存在
- 无真实 `<video>` 元素的情况下：进度条只能反映 `playerStore.currentTime`（最后一次 `onTimeUpdate` 的缓存值，不再更新）；播放/暂停只能切换 store 状态，无法控制实际媒体播放
- 要实现可用的进度条和播放控制，必须完成 `<video>` 跨容器单例移动（`SEQ-202605XX-PLAYER-VIDEO-LIFT`），本卡**不做**这两项

**本卡实际交互范围**：
- `apps/web-next/src/app/[locale]/_lib/player/MiniPlayer.tsx`
  - **视频区点击回播页**：`data-mini-video-slot` 容器加 `onClick`，读取 `usePlayerStore((s) => s.hostOrigin?.slug)` 和 `useParams()` locale，调用 `router.push(\`/${locale}/watch/${slug}\`)`；`cursor: pointer`
  - **hover 返回 chip**：视频容器 relative 定位内添加绝对居中覆盖层，hover 时 `opacity: 0 → 1`（CSS transition 150ms），文案走 i18n key `miniPlayer.returnToWatch`，点击逻辑与 onClick 同
  - 所有颜色走 `var(--player-mini-*)` tokens，不硬编码

**显式延期至 SEQ-PLAYER-VIDEO-LIFT**（文档记录，不在本卡验收）：
- 进度条（依赖实时 `<video>.currentTime` 事件）
- 播放/暂停按钮（依赖对实际媒体的控制权）

**验收**：
- 点击视频区域（`data-mini-video-slot`）跳转到 `/[locale]/watch/[slug]`
- hover 视频区域出现返回 chip，mouseLeave 消失（CSS transition）
- 点击 chip 同样触发跳转
- 颜色零硬编码

---

### HANDOFF-26 · Footer 重构 + Settings 基础抽屉

**目标**：Footer 对齐 `Global Shell.html`（V-2）；Settings 按钮有基础抽屉（V-3）。  
**背景决策（用户 2026-04-24 明确）**：账户列（账户/登录/注册等）本阶段不实现，现阶段无账户功能。Footer 采用 3 列结构（浏览 / 帮助 / 关于）。  
**建议模型**：sonnet  
**估时**：0.75d

**文件范围**：
- `apps/web-next/src/components/layout/Footer.tsx`
  - 改为 3 列网格结构（`repeat(3, 1fr)`，桌面端；移动端单列）
  - **浏览列**：电影 / 剧集 / 动漫 / 综艺 / 纪录片 链接，带 `/${locale}` 前缀（从 `lib/categories.ts` MAIN 部分生成，同 Nav 同源）
  - **帮助列**：帮助中心 / DMCA 投诉 / 隐私政策（链接暂用 `#`，后续补充真实 URL）
  - **关于列**：关于我们 / 联系方式（链接暂用 `#`）
  - 删除重复的 Help/Privacy/DMCA/About 底部行（只保留 Copyright 信息）
  - 所有链接添加 `/${locale}` 前缀
  - 颜色、间距全走 token
- 新增 `apps/web-next/src/components/layout/SettingsDrawer.tsx`
  - 从右侧划入，`position: fixed`，`z-index: var(--z-overlay)`
  - 阶段一内容：
    - 主题选择（Light / Dark / System 三选一，写入 `localStorage` + 更新 `BrandProvider` context）
    - 动效强度滑块（0 减弱 / 1 正常 / 1.5 增强），写入 `localStorage`，驱动 `--motion-scale` CSS 变量
  - 其余配置项（字幕、MiniPlayer 默认尺寸、快捷键等）预留 section 标题 + "即将推出"占位文案
  - 点击遮罩或 ESC 关闭
- `Nav.tsx`：Settings 按钮绑定 `SettingsDrawer` open state（`useState`）

**验收**：
- Footer 3 列结构（浏览 / 帮助 / 关于），无重复链接，链接含 locale 前缀
- Settings 按钮点击打开抽屉，ESC / 遮罩关闭
- 主题切换在抽屉内可用（Light/Dark/System）
- 动效强度滑块改变 `--motion-scale` CSS 变量

---

### REVIEW-C · 最终独立审核 + Phase 2 Close（HANDOFF-25~26 完成后）

**触发条件**：HANDOFF-25 + HANDOFF-26 全部 ✅，且 `typecheck / lint / test / e2e` 全绿  
**模型**：arch-reviewer（`claude-opus-4-6`）  
**审核要点**（不少于 10 项）：
1. MiniPlayer `router.push` locale 来源：locale 必须从 `useParams()` 或 context 读取，不得硬编码（检查 `/${locale}/watch/${slug}` 拼接路径的 locale 变量来源）
2. MiniPlayer hover chip：`opacity` transition 在 `prefers-reduced-motion: reduce` 下是否被 `--motion-scale: 0` 覆盖（或直接用 `visibility` 替代 opacity transition）
3. MiniPlayer 无假播放控件：组件内不得出现 `currentTime`、`duration`、`isPlaying` 等 store 订阅（HANDOFF-25 范围已明确排除，grep 验证）
4. Settings Drawer `z-index` 层级与 `--z-overlay` token 对比 MiniPlayer `--z-mini-player` 是否正确（抽屉 > MiniPlayer）
5. Footer 浏览链接来源是否 `lib/categories.ts` 同源，与 Nav 分类一致
6. Footer 链接 locale 前缀覆盖完整（无裸 `/movie` 类路径）
7. SettingsDrawer `localStorage` 读写 SSR 安全性（`typeof window !== 'undefined'` 守卫）
8. `--motion-scale` CSS 变量驱动机制（变量挂在 `:root` 还是 `.app-shell`）
9. HANDOFF-19~26 全范围：grep 验证硬编码颜色零遗漏
10. HANDOFF-19~26 全范围：`any` 类型零遗漏
11. `VideoCardWide.tsx` `@deprecated` 注释已写入；无新增消费点

审核结果写入 `docs/handoff_20260422/review_phase2_c_20260424.md`；全部 PASS 后追加 changelog 条目 + task-queue ✅。

---

## 3. 阶段性独立审核规则（通用）

每个 REVIEW 节点执行规范：

1. **触发**：对应批次所有任务 ✅，质量门禁全绿，方可 spawn arch-reviewer
2. **子代理上下文**：提供审核要点清单 + 关键文件路径，不提供主循环分析（独立意见）
3. **结论形式**：PASS / NEED_FIX（附具体修改项）
4. **阻塞效果**：NEED_FIX 时当前批次所有任务保持 🔄；按修改项逐一修复后重新提交审核
5. **记录**：审核结论写入 `docs/handoff_20260422/review_phase2_{a,b,c}_*.md`，结论和子代理 ID 写入对应任务 changelog 条目

---

## 4. 执行顺序与估时

```
Batch A（Bug 修复）：HANDOFF-19 + HANDOFF-20 + HANDOFF-21（可部分并行）
  └─ REVIEW-A（arch-reviewer）
     └─ Batch B（功能补完）：HANDOFF-22 + HANDOFF-23 + HANDOFF-24（可并行）
        └─ REVIEW-B（arch-reviewer）
           └─ Batch C（交互/Shell）：HANDOFF-25 + HANDOFF-26（可并行）
              └─ REVIEW-C（arch-reviewer）→ Phase 2 Close
```

| 批次 | 卡号 | 内容 | 估时 |
|------|------|------|------|
| Batch A | HANDOFF-19~21 | Bug 修复 + 卡片统一 + Nav 修正 | 2d |
| REVIEW-A | — | arch-reviewer 审核 | — |
| Batch B | HANDOFF-22~24 | 首页完整化 + 搜索重构 + 详情主列 | 3d |
| REVIEW-B | — | arch-reviewer 审核 | — |
| Batch C | HANDOFF-25~26 | MiniPlayer 交互（受限）+ Footer + Settings | 1.2d |
| REVIEW-C | — | arch-reviewer 最终审核 + Phase Close | — |
| **合计** | | | **≈ 6.2d** |

---

## 5. 明确 Scope 外（本序列不做）

| 项目 | 原因 / 去向 |
|------|-------------|
| VideoCard hover overlay + TypeChip + CornerTags（HANDOFF-07） | 独立设计评审后推进，非本轮优先项 |
| `<video>` 跨容器单例 lift（MiniPlayer video DOM 移动） | 已有 `SEQ-202605XX-PLAYER-VIDEO-LIFT` 占位，需 ADR + Opus 双审 |
| Settings Drawer 完整功能（字幕/快捷键/MiniPlayer 默认尺寸） | HANDOFF-26 只做阶段一；其余等 UX 评审 |
| 账户功能（注册/登录/个人中心） | 现阶段无账户功能，Footer 账户列不实现 |
| Admin 首页推荐统一管理页（HANDOFF-08） | 后台功能，独立序列处理 |
| 移动端响应式补齐 | 当前聚焦 PC 端，移动端另立序列 |
| 视频广告插入点 | Scope 外（同 landing_plan_v1.md §10） |

---

## 6. 风险提示

| 风险 | 缓解措施 |
|------|---------|
| `/videos` 接口返回字段与 BrowseGrid 期望不一致（分页格式） | HANDOFF-19 开工前先用 curl 确认 `GET /videos?type=movie&page=1&limit=1` 响应结构，特别核查 `pagination.total`、`pagination.page`、`pagination.limit` 字段名 |
| `lib/categories.ts` 中 `typeParam vs videoType` 映射错误（ADR-048 §4 已定 tvshow→variety） | HANDOFF-21 实施前必须对照 `docs/decisions.md` ADR-048 核查 ALL_CATEGORIES 映射表 |
| 详情页 API 缺 cast/director 字段 | HANDOFF-24 开工前先检查 `/videos/:slug` 实际响应（`curl + jq`），缺字段时演职员区块写 TODO，不造假数据 |
| OS 检测代码 SSR 不安全（navigator 未定义） | HANDOFF-21 实现时所有 `navigator` 访问均加 `typeof navigator !== 'undefined'` 守卫 |
| MiniPlayer `router.push` locale 拼接错误 | HANDOFF-25 中 locale 必须来自 `useParams()` 或 next-intl context，不得硬编码；REVIEW-C 审核项 #1 验证 |
| FeaturedRow 降级 ShelfRow 的 API 查询参数需要和首页其他 Shelf 区分 | HANDOFF-22 降级 ShelfRow 使用 `slot=featured-fallback` 或明确 query 参数，避免与其他 Shelf 返回重复内容 |

---

## 7. 变更历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-24 | 初稿：基于 2026-04-23 人工审查报告 + 用户补充 4 条意见（OS 适配快捷键 / Nav 右对齐 / 竖版卡片统一 / 账户列不做）整合，新增 3 轮阶段性独立审核机制 |
| v1.1 | 2026-04-24 | 执行前可行性审查，修订 6 项缺陷：① 热搜端点 → 静态 i18n 列表（`/search/suggest` 不支持 hot 模式）；② MiniPlayer 范围缩减（移除进度条/播放控制，LIFT 未完成时 video 元素不存在）；③ CategoryShortcuts 改为提取独立 Client Component（`page.tsx` 保持 Server Component）；④ filter 空值处理修正（`value===''` 先删参，再判断同值取消）；⑤ highlight 渲染方案明确（`parseHighlight()` 工具函数，禁止 `dangerouslySetInnerHTML`）；⑥ 新增影院模式 CSS Bug B-4（`align-items: stretch` 修复）+ `lockedDims` 解决分类路由与过滤器语义矛盾 |
| v1.2 | 2026-04-24 | 执行前二次审查，补充 3 项修订：① `initialType` 强制覆盖策略（`effectiveParams.set('type', initialType)` 无条件覆盖，`CategoryPageContent` 净化 searchParams 删除 type 键，彻底堵住 `/movie?type=series` 语义矛盾）；② 清理 REVIEW-C 和风险区中关于进度条/`useShallow`/`currentTime` 的过时条目，替换为 locale 安全、无假播放控件的正确审核点；③ `lib/categories.ts` 创建提前至 HANDOFF-20（供 `CategoryShortcutsClient` 使用），HANDOFF-21 改为导入而非重新定义，明确 HANDOFF-21 前置依赖 HANDOFF-20 |
| v1.3 | 2026-04-24 | 实现备注补充：`[type]/page.tsx` 当前仅接 `params`，`CategoryPageContent` 无 `searchParams` 入参路径；放弃服务端净化层（需额外修改 page props 传递链），**以 BrowseGrid 的 `initialType` 强制覆盖作为唯一权威防线**；`CategoryPageContent` 无需修改 props 签名，只需传 `initialType` 和 `lockedDims`；"一致性规则"小节同步更新说明权威层级 |
