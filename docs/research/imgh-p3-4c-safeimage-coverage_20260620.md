# IMGH-P3-4C — 前台 SafeImage 零裂图覆盖面核查报告

> 任务：SEQ-20260620-01 / IMGH-P3-4C（Codex LOW-2/L-4，设计 `image-health-problem-board_20260620.md` §8 待补验证项）
> 日期：2026-06-20 ｜ 分支：`fix/imgh-broken-samples-empty-20260620` ｜ 执行模型：claude-opus-4-8
> 性质：**仅核查 + 出清单（修复另起卡）**，未改业务代码。

---

## 0. 一句话结论

`apps/web-next` 前台封面渲染**绝大多数已走 `SafeImage` 安全网**（12 消费点，`onError`→`FallbackCover` 零裂图）；核出 **1 个生产漏网点**：`components/home/DailyAnimeRow.tsx:97` 裸 `<img src={item.coverUrl}>`（无 `onError`、不经 SafeImage，首页「每日新番」公开行）→ 封面失败时浏览器原生裂图。**这是「用户端零裂图」唯一未闭环点。**

---

## 1. 核查方法（含工具教训）

- **范围**：`apps/web-next/src`（apps/web 前台 v1 已随 cutover 删除，web-next 为唯一前台）。
- **方法**：`git grep`（基于 git index，可靠）枚举所有图片渲染信号：`<img` / `next/image` / `SafeImage`/`FallbackCover` / `backgroundImage`/`background-image` / `LazyImage` 直接消费。
- **⚠️ 工具教训**：本环境 `find -type f` 与 `grep -rn` 递归**静默失败返回假空**（误判 components 目录为空、零图片渲染）；改用 `git ls-files` / `git grep` 后得到真实数据。后续核查类任务一律优先 `git grep`。

---

## 2. 前台安全网架构（已就绪）

```
SafeImage (components/media/SafeImage.tsx)
 ├─ mode='next' → SafeImageNext（next/image fill + aspect wrapper，CDN-02）
 └─ 默认 lazy → LazyImage（视口懒加载 + blurHash 占位）
        src 空 或 onError → setErrored → <FallbackCover>（渐变+类型图标+标题，按 seed 确定性，零硬编码色）
        onError 同时回调 onLoadFail/onLoadError（→ reportBrokenImage 上报 broken_image_events）
```

- `FallbackCover`：加载失败的视觉兜底（藏问题给用户）。
- `LazyImage`：**安全网底层部件**（接收并透传 `onError`），非独立漏网入口。

---

## 3. SafeImage 消费点清单（12 处，✅ 走安全网）

| 文件 | 角色 | 备注 |
|---|---|---|
| `components/primitives/media/StackedPosterFrame.tsx` | 主卡封面框 | `VideoCard` 经此渲染 `coverUrl` + `fallback` + `onLoadFail`→reportBrokenImage |
| `components/video/HeroBanner.tsx` | 首页 Hero | |
| `components/video/BannerCarouselMobile.tsx` | 移动轮播 | |
| `components/video/VideoCardWide.tsx` | 宽卡 | |
| `components/video/VideoDetailHero.tsx` / `VideoDetailClient.tsx` | 详情页主视觉 | |
| `components/browse/BrowseCard.tsx` | 浏览页卡片 | `fallback={{ seed: video.id }}` 标准范式 |
| `components/detail/DetailHero.tsx` / `RelatedVideos.tsx` | 详情页 | |
| `components/search/SearchOverlay.tsx` / `app/[locale]/search/_components/SearchPage.tsx` | 搜索结果 | |
| `app/[locale]/dev/fallback-preview/page.tsx` | dev 预览页 | 非生产 |

> `VideoCard`（首页/列表核心卡）链路：`VideoCard → StackedPosterFrame → SafeImage → LazyImage(onError→FallbackCover)`，**完整安全网**。

---

## 4. 漏网点清单（修复另起卡）

| # | 位置 | 风险 | 公开入口 | 修复建议 |
|---|---|---|---|---|
| **L-1** ❌ | `apps/web-next/src/components/home/DailyAnimeRow.tsx:97` | 裸 `<img src={item.coverUrl}>`，**无 `onError`、不经 SafeImage**；封面 URL 失败 → 浏览器原生裂图（虽有 `--bg-surface-sunken` 底色，仍显示裂图图标） | **是**（首页「每日新番」行，`app/[locale]/page.tsx:102` 消费） | 改用 `SafeImage`（mode lazy，`fallback={{ title, type:'anime', seed }}`），对齐 `BrowseCard` 范式 → 失败/空封面走 `FallbackCover` 不裂图（去 `item.coverUrl &&` 守卫，src 空交 SafeImage 自动兜底）。**不接 `reportBrokenImage`**（Bangumi 外部源，见 §6 上报权衡）。**已实施 IMGH-P3-4D `c39707bc`** |

**仅此 1 处。** 其余 `git grep "<img"` 命中（`LazyImage.tsx:100`）为安全网部件（由 SafeImage 注入 onError），非独立漏网。

---

## 5. 非漏网点说明（排除项）

| 信号 | 位置 | 判定 |
|---|---|---|
| `<img>` | `LazyImage.tsx:100` | ✅ 安全网底层部件，`onError` 由 SafeImage 透传；仅 `dev/fallback-preview` 直接消费（非生产） |
| `next/image` | `SafeImageNext.tsx`（内部）+ `dev/fallback-preview` | ✅ SafeImageNext 封装含 onError→FallbackCover；dev 非生产 |
| `backgroundImage` | `primitives/feedback/Skeleton.tsx:42` | ✅ CSS 渐变（`linear-gradient`，非外部 URL），无裂图风险 |

---

## 6. 结论与后续

- **覆盖面结论**：web-next 前台「用户端零裂图」**已 92% 闭环**（12/13 图片入口走安全网）；唯一缺口 = `DailyAnimeRow.tsx:97`（L-1）。
- **后续卡建议**：起 **IMGH-P3-4D（修复卡，sonnet）** — DailyAnimeRow 裸 img 改 SafeImage（小改动，单文件，附组件测试断言 onError→FallbackCover）。修复后前台零裂图全闭环。
- **上报权衡（IMGH-P3-4D 实施已定，`c39707bc`）**：DailyAnime 封面为 Bangumi calendar 外部源（**非站内 media_catalog 治理对象**），4D **不接** `reportBrokenImage`——`broken_image_events` 需 `video_id`、未入站项无，强接语义不符。4D 仅做 SafeImage 不裂图兜底（`onError`/空 → `FallbackCover`）；后台 problem-images 治理板（ADR-211）覆盖范围仍限站内视频封面，不含 Bangumi 发现板块。（本节原「建议接上报」已被 4D 决策推翻，留痕以正记录。）
