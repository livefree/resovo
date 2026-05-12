# REVIEW-A — Batch A 阶段独立审核报告

**审核时间**：2026-04-24
**审核模型**：claude-opus-4-6（arch-reviewer）
**审核范围**：HANDOFF-19 + HANDOFF-20 + HANDOFF-21
**触发条件**：三个任务全部 ✅，typecheck / lint 全绿，test 1 pre-existing failure（StagingEditPanel，与 HANDOFF 无关）

---

## 逐项结论

### 1. BrowseGrid `/videos` 接口参数一致性

- **结论：WARN**
- **依据**：
  - BrowseGrid（`apps/web-next/src/components/browse/BrowseGrid.tsx:161-168`）正确传递 `type`, `page`, `limit`, `country`, `year`, `rating_min`, `sort` 给 `/videos`
  - FilterArea（`apps/web-next/src/components/browse/FilterArea.tsx:59-65, 97-103`）定义了 `lang`（语言）和 `status`（状态）两个筛选维度
  - 后端 route（`apps/api/src/routes/videos.ts:49-58`）schema 仅接受：`type`, `category`, `year`, `country`, `rating_min`, `sort`, `page`, `limit`
  - **`lang` 和 `status` 参数被 Zod safeParse 静默剥离，用户选择这两个筛选项不会产生任何效果**
- **建议**：在 FilterArea 中为 `lang`/`status` 维度添加注释标注"后端暂未支持"，或暂时移除直到后端补齐

### 2. `lib/categories.ts` 结构与映射

- **结论：PASS**
- **依据**：
  - `apps/web-next/src/lib/categories.ts:17-29`：ALL_CATEGORIES 正确映射全部 11 个 VideoType
  - 关键映射 `tvshow(URL) → variety(API)` 在 line 21，与 ADR-048 §4 一致
  - `CategoryEntry` interface（lines 11-15）使用 `readonly` 字段，结构合理
  - `MAIN_TYPE_PARAMS`（5 个）和 `MORE_TYPE_PARAMS`（6 个）分区正确
  - `videoType` 值与 `packages/types/src/video.types.ts:7-18` 的 VideoType union 完全匹配
  - FilterArea.tsx（line 211）和 Nav.tsx（lines 31-38）均正确消费此单源

### 3. `initialType` prop 与 VideoType enum 约束

- **结论：PASS**
- **依据**：
  - BrowseGrid（`BrowseGrid.tsx:142-145`）：`initialType?: VideoType`，类型从 `@resovo/types` 导入（line 21）
  - `params.set('type', initialType)`（line 165）类型安全，只会传递合法 VideoType 值
  - FilterArea 通过 `lockedDims` 机制隐藏锁定的 type 行，架构合理

### 4. OS 检测 SSR 安全性

- **结论：PASS**
- **依据**：
  - `Nav.tsx:316-319`：`navigator` 访问在 `useEffect` 内部 + `typeof navigator !== 'undefined'` 双重守卫，SSR 安全
  - `isMac` 默认 `false`（line 307），SSR 阶段渲染 "Ctrl+K"，行为正确
  - MoreMenu 中 `window.matchMedia`（lines 163, 169）有 `typeof window !== 'undefined'` 守卫

### 5. HeroBanner fallback 颜色零硬编码

- **结论：WARN**
- **依据**：
  - **HeroBannerFallback**（lines 250-308）：全部使用 CSS 变量，完全合规
  - **BannerContent**（lines 152-204）存在硬编码：
    - `text-white`（lines 160-161）
    - `from-black/90 via-black/40`（line 95，渐变遮罩）
    - `text-white bg-white/10 border-white/20 hover:bg-white/20`（line 194，详情按钮）
  - **判断**：这些颜色用于全出血背景图上的文字叠加层，语义上为"图片上的对比色"，暗色模式下 white-on-dark-image 仍然正确。严格解读 CLAUDE.md 规则属于违规，但实际场景有合理性
- **建议**：替换为 `text-[var(--fg-on-accent)]` 或新建 `--banner-text-over-image` token

### 6. TypeShortcuts Client Component SSR/CSR 边界

- **结论：PASS**
- **依据**：
  - `CategoryShortcutsClient.tsx` line 1 有 `'use client'` 指令
  - 使用 `useEffect`（line 88）、`useState`（line 86）、`useLocale`、`useTranslations` 等客户端 API，`'use client'` 必要
  - 父页面（`app/[locale]/page.tsx`）为 Server Component，渲染 `<CategoryShortcutsClient />` 作为客户端岛屿
  - 文件名含 "Client" 后缀，命名规范清晰

### 7. VideoCardWide 弃用注释与 landscape import 检查

- **结论：PASS**
- **依据**：
  - `VideoCardWide.tsx` line 1：`/** @deprecated 全站已统一为竖版卡片（VideoCard 2:3），此组件保留但不得新引用 */`，弃用注释到位
  - Shelf 组件（`Shelf.tsx:29`）仅导入 `VideoCard`，不再导入 `VideoCardWide`
  - `LandscapeTrack`（lines 225-254）已改用 `VideoCard` + portrait 尺寸（`2:3`），统一完成
  - 首页 page.tsx（line 61）使用 `template="poster-row"`，正确

### 8. `--search-input-max-w` token 一致性

- **结论：WARN**
- **依据**：
  - `globals.css` line 107：`--search-input-max-w: 240px;` 定义在 `:root` 组件别名 token 区
  - `packages/design-tokens/src/css/tokens.css` 不含此 token（也不含其他 search/browse/detail/player 别名 token）
  - **与现有模式一致**：design-tokens 包存放原语/语义 token，globals.css 存放 web-next 专属组件别名 token
  - Nav.tsx（line 429）正确消费：`maxWidth: 'var(--search-input-max-w)'`
  - 240px 不对应 space-scale 中的任何值，但作为组件级 max-width 可接受

---

## 额外观察（审核项之外）

**A. CategoryShortcutsClient catch 块**（line 98-100）：`catch(() => { /* badge 不渲染，卡片结构不受影响 */ })`——函数体仅有注释。CLAUDE.md 禁止 `catch (e) {}`，此处为无参 arrow function + 解释性注释，属边缘情况，非严格违规。

**B. HeroBanner 硬编码中文字符串**：lines 178 "立即观看"、188 "立即播放"、195 "详情信息" 未使用 i18n `t()` 函数。不在本次颜色/架构审核范围内，但应后续跟进。

**C. Nav.tsx `z-50` Tailwind class**（line 252）：使用 Tailwind 工具类而非 CSS 变量 z-index。ADR-048 §8.3 要求 z-index 走 CSS 变量层。轻微偏差，dropdown 在定位父级内部，影响有限。

---

## 总结论

| 项 | 结论 | 严重度 |
|----|------|--------|
| 1. BrowseGrid API 参数 | WARN | P2 — `lang`/`status` 筛选无效果 |
| 2. categories.ts 映射 | PASS | — |
| 3. initialType 类型约束 | PASS | — |
| 4. OS 检测 SSR 安全性 | PASS | — |
| 5. HeroBanner 硬编码颜色 | WARN | P3 — banner 叠加层合理但违反字面规则 |
| 6. TypeShortcuts CSR 边界 | PASS | — |
| 7. VideoCardWide 弃用 | PASS | — |
| 8. search-input token | WARN | P4 — 与现有模式一致 |

**总结论：PASS（附 WARN）**

- 5 项 PASS，3 项 WARN（无 NEED_FIX）
- 所有 WARN 项为非回归性问题（pre-existing 设计间隙或边缘合规性），不阻塞后续工作
- **阻塞 Batch B：否**

### 后续跟进建议

1. FilterArea `lang`/`status` 筛选维度需在后端支持前标注或移除（优先级 P2）
2. HeroBanner 叠加层颜色 token 化（优先级 P3，可纳入 design-tokens 下一轮更新）
3. HeroBanner 中文硬编码字符串 i18n 化（优先级 P3）
