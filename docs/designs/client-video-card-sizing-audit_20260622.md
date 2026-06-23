---
title: 客户端视频卡片尺寸设计与使用现状调查
date: 2026-06-22
type: 调查报告（audit）
scope: 仅现状梳理（不含改造方案）
target: apps/web-next（前台客户端）
status: 一次性产物
---

# 客户端视频卡片尺寸设计与使用现状调查

> **范围声明**：本报告仅做**现状梳理**，盘点 `apps/web-next` 前台视频卡片的尺寸定义、布局机制与
> 使用分布，并归纳碎片化问题清单。**不含**任何统一/重构方案——后续是否治理由需求方据此裁定。
>
> **调查方法**：只读检索（卡片组件 / 布局容器 / `globals.css` token / 全部消费页面），
> 路径与行号已逐一与当前代码核对（调查时点 2026-06-22，分支 `fix/imgh-broken-samples-empty-20260620`）。

## 总览：三层分离的尺寸结构

客户端卡片尺寸采取「**三层分离**」：

1. **卡片组件层**：只定义**内部比例 / 封面像素**，组件宽度恒为 `w-full`（或由父容器约束）。
2. **布局容器层**：**实际卡宽由此决定**——固定 px / 响应式列 / fr 比例等多种机制并存。
3. **设计 token 层**：尺寸数值部分沉淀到 `app/globals.css` 的 CSS 变量，部分**硬编码**在容器内。

碎片化主要发生在**布局容器层**。

---

## 1. 卡片组件层

| 组件 | 文件 | 比例 | 封面 px | 标题样式 | 特性 | 状态 |
|------|------|------|---------|----------|------|------|
| `VideoCard` | `components/video/VideoCard.tsx` | 2:3 | 200×300（`StackedPosterFrame`） | `text-sm`(14) `line-clamp-1` | 播放器 Fast Takeover 集成、`FloatingPlayButton`、`TagLayer` | **主力** |
| `BrowseCard` | `components/browse/BrowseCard.tsx` | 2:3 | 200×300（`SafeImage`） | 13px `line-clamp-2` | 纯跳详情、与播放器解耦 | Browse 专用 |
| `VideoCardWide` | `components/video/VideoCardWide.tsx` | 16:9 | 320×180 | `text-sm` `line-clamp-1` | 横版、状态/评分角标 | **`@deprecated`，全仓零引用（死代码）** |
| `SidebarList`（内联） | `components/detail/RelatedVideos.tsx:27` | 2:3 | 60×90 | 13px `line-clamp-2` | 详情侧栏横向缩略列表（非网格卡） | 详情 sidebar |
| `VideoCardPlaceholder` | `components/primitives/video-card-placeholder/` | — | — | — | 占位 primitive | — |

**重复观察**：`VideoCard` 与 `BrowseCard` 高度重叠（均 2:3 portrait + 标题 + 年份），仅「播放器集成」
差异，且标题字号 / 截断行数不一致（14px·1 行 vs 13px·2 行）。

---

## 2. 布局容器层 —— 定宽机制 5 种并存（碎片化核心）

| 容器 / 轨道 | 文件 | 定宽机制 | 具体值 | gap |
|-------------|------|----------|--------|-----|
| `ShelfRow` · PosterTrack / LandscapeTrack | `components/video/Shelf.tsx` | 固定 px **token** | `--shelf-card-w-portrait` = **170px** | `--shelf-gap` 16px |
| `ShelfRow` · FeaturedGrid | 同上 | 等分 fr | `repeat(5, 1fr)` | 16px |
| `TopTenRow` | `components/home/TopTenRow.tsx` | 固定 px token | 170px | 16px |
| `FeaturedRow` | `components/home/FeaturedRow.tsx` | **fr 比例** | `1.6fr 1fr 1fr 1fr`（首列加宽） | `--shelf-gap` 16px |
| `VideoGrid`（grid 模式） | `components/video/VideoGrid.tsx` | 响应式 Tailwind 列 | 默认 `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` | `gap-4 lg:gap-6`（16→24px） |
| `VideoGrid`（scroll 模式） | 同上 | **硬编码 px** | `cardWidth = '160px'`（≠ token 170px） | 16px |
| `BrowseGrid` | `components/browse/BrowseGrid.tsx` | 固定 5 列 fr | `repeat(5, 1fr)` | `--browse-grid-gap` 20px |
| 搜索结果 → `VideoGrid` | `app/[locale]/search/_components/SearchPage.tsx` | 响应式列 | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` | 16→24px |
| 详情相关 → `VideoGrid` | `components/detail/RelatedVideos.tsx:140` | 响应式列 | `grid-cols-3 sm:grid-cols-4 md:grid-cols-6` | 16→24px |

---

## 3. 设计 token 层（`app/globals.css`）

```
--shelf-gap:              16px   --shelf-bottom-padding:  8px
--shelf-card-w-portrait:  170px  --shelf-card-w-top10:    170px
--shelf-card-w-landscape: 300px  ← 死 token（无任何代码消费）
--shelf-empty-opacity:    0.32   --shelf-empty-min-slots: 4
--browse-grid-gap:        20px   --browse-pagination-*：  分页相关
```

---

## 4. 消费方映射

- **首页** `app/[locale]/page.tsx`：`FeaturedRow`（1.6fr 网格）+ `TopTenRow`（170px 轨道）+ 3× `ShelfRow`（170px 轨道）。
- **分类页** `app/[locale]/[type]/page.tsx`：`BrowseGrid`（固定 5 列 / 20px gap）。
- **搜索页** `SearchPage.tsx`：`VideoGrid`（2/3/5 响应式 / 16→24px gap）。
- **详情页** `RelatedVideos.tsx`：主区 `VideoGrid`（3/4/6 响应式）；sidebar 走 `SidebarList`（60px 横向列表）。

---

## 5. 问题清单（现状梳理结论）

1. **定宽机制 5 种并存无统一抽象**：固定 px token（170）/ 硬编码 px（160）/ 响应式 Tailwind 列 /
   等分 fr（5 列）/ 比例 fr（1.6fr）。
2. **响应式断点列数各页不一**：搜索 2/3/5、相关 3/4/6、分类固定 5 列 —— 无统一「网格密度」规范。
3. **gap 三值且命名分散**：shelf 16px（`--shelf-gap`）、browse 20px（`--browse-grid-gap`）、
   VideoGrid 16→24px（Tailwind `gap-4 lg:gap-6`）。
4. **硬编码与 token 漂移**：`VideoGrid` scroll 模式 `cardWidth='160px'` 与 shelf token 170px 不一致。
5. **死 token**：`--shelf-card-w-landscape: 300px` 无任何代码消费（`landscape-row` 经 HANDOFF-20 已统一为
   竖版，`LandscapeTrack` 完全复用 `PosterTrack`）。
6. **死代码 / 未用扩展点**：`VideoCardWide`（`@deprecated` 零引用）、`VideoGrid` 的 `variant="landscape"`
   prop（零消费）、`ShelfRow` 的 `landscape-row` template（零调用方）。
7. **卡片组件重复**：`VideoCard` 与 `BrowseCard` 仅播放器集成差异，标题字号 / 截断不一致。

---

> 本报告为一次性「方案/设计」类产物，按 `docs/rules/doc-governance.md` 归档判定表，
> 后续若据此发起统一治理序列，序列全部 ✅ 后进入归档判定。
