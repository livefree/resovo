# 图片管线与样板图系统方案

> status: proposed
> owner: @engineering
> scope: image types and priorities, ingestion governance, health checks, blurhash and primary color, safeimage and fallbackcover components, admin dashboards, CDN-ready architecture
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-18

---

## 1. 背景

Resovo 作为视频资源索引平台，页面上几乎每一个视觉单元都依赖图片（封面、详情背景、剧集缩略、Banner 等）。当前状态：

- 图片来源**主要跟随第三方视频源抓取**，画质不稳定，失效率不可控
- 未统一使用 `next/image`，各组件 `<img>` 直用 URL，缺少占位符、降级、健康治理
- 无样板图系统，图加载失败时出现浏览器默认破损图标
- 未接入图片 CDN（有接入计划但未实施）
- 入库后图片状态无监控，失效图可能持续留在生产环境

本方案为前端重新设计（`frontend_redesign_plan_20260418.md`）的配套工程，目标是把图片从**脆弱的外部输入**变成**可治理、可降级、可扩展的内部资产**。

---

## 2. 目标

1. 定义清晰的**图片类别与优先级体系**，每个视频至少一张 P0 保底。
2. 建立**入库治理 job**：抓取/导入时识别低质、损坏、尺寸不符、URL 无效等情况，不让坏图进入生产渲染路径。
3. 建立**运行时降级链**：BlurHash 占位 → 真实图 → 失败时 `<FallbackCover>` 样板图 → CSS 兜底，用户永远不见破图。
4. 设计**品牌感知的样板图系统**（`<FallbackCover>`），SVG 运行时生成，品牌 Token 驱动，零硬编码。
5. 建立**图片健康监控**：后台 Dashboard 展示覆盖率、破损数、趋势；样板图实时预览。
6. 为**未来接入 CDN**预留零改动扩展边界（loader 接口、URL 参数约定、降级默认行为）。

---

## 3. 非目标

1. **本轮不实施** CDN 对接（Cloudflare Images / 阿里云 IMG / ImageKit 选型等）。
2. **不做**完整的图片编辑器（裁剪、滤镜、合成），后台只支持上传/替换。
3. **不做**视频首帧截图用作剧集缩略（延后）。
4. **不做** AI 自动图质评估（延后，本轮靠尺寸/格式/loadable 基础校验）。
5. **不做**用户上传封面的 UGC 功能。
6. **不做**多语言文字叠加的封面合成。

---

## 4. 图片类别与优先级

### 4.1 使用位置全景

| 位置 | 比例 | 推荐原图 | 使用组件 |
|------|------|---------|---------|
| 列表/网格卡片封面 | 竖 2:3 | 600×900 | PosterCard |
| 搜索结果左侧缩略 | 竖 2:3 | 复用卡片 | VideoListRow |
| 详情页顶部背景大图 | 横 16:9 | 1920×1080 | DetailHero |
| 详情页前景竖封面 | 竖 2:3 | 复用卡片 | DetailHero |
| 首页 Banner 背景（PC） | 横 16:9 或 21:9 | 2560×1080 | BannerCarouselDesktop |
| 首页 Banner 竖版（移动） | 竖 5:6 或 4:5 | 900×1200 或复用竖封面 | BannerCarouselMobile |
| 剧集缩略图 | 横 16:9 | 480×270 | EpisodeCard |
| 视频 Logo（艺术字） | 透明矩形 | 800×400 | DetailHeroTitle |
| 剧照 Stills | 横 16:9 | 1920×1080 × N | DetailStills |
| 演员/导演头像 | 正 1:1 | 400×400 | PersonCard（用户功能上线后）|

### 4.2 优先级分级与策略

| 优先级 | 类别 | 数量 | 策略 |
|--------|------|------|------|
| **P0** | 竖封面 Poster | 1 张 | **强制必填**，入库时缺失阻断发布 |
| **P1** | 横版 Backdrop | 1 张 | 尽力获取，缺失不阻断但视觉降级（兜底见 5.3） |
| **P1** | 剧集缩略图 | 每集 1 张 | 剧/动漫/综艺尽力获取；电影类不适用 |
| **P2** | 视频 Logo | 1 张（可选）| 有则用，无则显示标题文字 |
| **P2** | Banner 专属横图 | 1 张（可选）| 缺失时用 P1 backdrop 兜底 |
| **P3** | 剧照 Stills | 2–4 张 | 完全可选，有则做 Stills 区块 |
| **P3** | 演员/导演头像 | 每人 1 张 | 用户功能上线后再规划 |

**执行策略：强制 P0 + 尽力 P1**

- 新视频入库时检查：若 P0（竖封面）缺失或不合格，视频 `review_status` 置为 `needs_manual_review`，不进入前台发布路径
- P1/P2/P3 缺失不阻断，但在后台视频列表显示完善度角标（如"⚠ 缺背景图"）
- 运营定期补齐缺失项

### 4.3 多尺寸策略

**只存一份原图**（按比例类别各一张），多尺寸通过图片 CDN 动态裁切。当前未接 CDN 时的过渡方案见第 10 节。

每张图入库时生成：
- BlurHash 字符串（~30 字节，用于首屏占位）
- 主色（OKLCH，用于 Banner 主色染色、样板图调色等）
- 原图尺寸（宽、高、文件大小、格式）
- 健康状态

---

## 5. 数据模型与 Schema 变更

### 5.1 `videos` 表扩展

```
poster_url                 权威竖封面 2:3 URL（P0 必填）
poster_blurhash            BlurHash 字符串
poster_primary_color       OKLCH 字符串（用于主色染色）
poster_width               原图宽
poster_height              原图高
poster_status              ok | missing | broken | low_quality | pending_review
poster_source              ingest | tmdb | bangumi | manual | ...

backdrop_url               横版 16:9（P1）
backdrop_blurhash
backdrop_primary_color
backdrop_status

logo_url                   透明艺术字（P2，可选）
logo_status

banner_backdrop_url        Banner 专属横图（P2，可选，为空时用 backdrop_url 兜底）
banner_backdrop_blurhash
banner_backdrop_status

stills_urls                JSON 数组，剧照集合（P3）
stills_meta                JSON，每张的 blurhash/status/source
```

### 5.2 `episodes` 表扩展

```
thumbnail_url              剧集缩略 16:9（P1）
thumbnail_blurhash
thumbnail_status
```

### 5.3 新增 `broken_image_events` 表

记录所有图片健康异常事件，供监控和运营处理。

```
id                 PK
video_id           FK → videos
episode_id         FK → episodes（可空）
image_kind         poster | backdrop | logo | banner_backdrop | stills | thumbnail
url                出问题的 URL
event_type         fetch_404 | fetch_5xx | timeout | decode_fail | dimension_too_small | mime_mismatch | aspect_mismatch
first_seen_at
last_seen_at
occurrence_count   同一 URL 重复次数
resolved_at        运营处理后标记
resolution_note    处理说明
```

### 5.4 迁移注意

- 所有新增字段采用**新增**而非 `ALTER EXISTING`，避免破坏现有查询
- `poster_status` / `backdrop_status` 等字段首次上线时默认填 `pending_review`，由一次性回填 job 扫描已有 URL 标记为 `ok`
- Schema 变更必须同步 `docs/architecture.md`（CLAUDE.md 明文要求）

---

## 6. 入库治理 Job

### 6.1 `image_health_check`

**触发**：

- 视频创建/更新时同步触发（针对该视频）
- 每日全量巡检（`cron: 0 3 * * *`，低峰期）

**检查项**：

对每张图片 URL 依次执行：

1. **URL 语法合法性**（非空、协议 http/https、格式合规）
2. **HEAD 请求**（300ms 超时）：状态码 200，`Content-Type: image/*`
3. **尺寸检查**（从 HEAD 或部分 GET 读 image meta）：
   - P0 竖封面：宽 ≥ 300、比例 2:3 ± 10%
   - P1 横版：宽 ≥ 640、比例 16:9 ± 10%
   - 不符合 → 状态 `low_quality` 或 `aspect_mismatch`（可接受但降级）
4. **可解码**（可选深度检查，抽样执行）：下载并解码，损坏 → `broken`

**结果写入**：
- 更新 `<kind>_status` 字段
- 异常事件写入 `broken_image_events`
- 连续 3 次失败或 7 天未恢复的 URL → 自动降级 `poster_status` 等字段到 `broken`

### 6.2 `blurhash_and_color_extract`

**触发**：视频/剧集图片字段首次获得 URL 时、URL 变更时。

**流程**：

1. 下载原图（本地临时）
2. 缩略到 100×100
3. 计算 BlurHash（`blurhash-js`，~30 字节字符串）
4. 提取主色（k-means 聚类取最频繁色块，或简单 LAB 平均；输出 OKLCH）
5. 写回 `<kind>_blurhash` / `<kind>_primary_color`
6. 删除本地临时文件

**特殊处理**：

- 主色检查：若亮度 `L < 15` 或 `L > 90`，视为"极端色"不适合 banner 染色，记为 `null`
- 执行失败不阻断入库，字段保留 `null`，前端降级为无染色

### 6.3 执行调度

- 使用项目现有的 job 框架（具体名称待确认）
- 并发度限制：同时最多 5 个 URL 检查，避免瞬时压垮源站
- 限速：对同一 domain 的请求间隔 ≥ 200ms

---

## 7. 前端渲染：四级降级链

对于任意一张图，用户看到的顺序：

```
请求真实图 URL
   ├─ OK → 显示真实图（加载过程中用 BlurHash 占位）
   ├─ 加载失败（onError）→ 显示 <FallbackCover> SVG
   │                      └─ SVG 也渲染失败 → 纯 CSS 渐变 + 文字
   └─ URL 本就是 null（服务端已判定不 OK）→ 直接 <FallbackCover> SVG
```

### 7.1 `<SafeImage>` 组件契约

```tsx
interface SafeImageProps {
  src: string | null;                // null 时直接走 fallback
  alt: string;                       // 视频标题（也用于 fallback 文字）
  aspect: '2:3' | '16:9' | '1:1' | '5:6' | '21:9';
  blurhash?: string;                 // 缺省时用纯色占位
  priority?: boolean;                // 首屏大图启用
  sizes?: string;                    // 响应式 srcset 尺寸
  fallback?: {                       // 失败时 FallbackCover 的参数
    title: string;
    originalTitle?: string;
    type?: VideoType;
    seed: string;                    // 通常用 video.id
    size?: 'xs' | 'sm' | 'md' | 'lg';
  };
  className?: string;
  onLoadSuccess?: () => void;
  onLoadFail?: (reason: string) => void;  // 上报破损
}
```

**内部行为**：

1. `src == null` → 立即渲染 `<FallbackCover>`，不请求网络
2. `src != null`：
   - 先渲染 BlurHash 占位（若提供）
   - 发起图片请求
   - 成功 → crossfade 替换（200ms）
   - 失败 → 切换到 `<FallbackCover>`，**同时 beacon API 上报**（用于健康监控）
3. 支持 `loading="lazy"` + `IntersectionObserver` 预取
4. 支持 `sizes` + 响应式 srcset

### 7.2 `<FallbackCover>` 组件契约

```tsx
interface FallbackCoverProps {
  title: string;
  originalTitle?: string;
  type?: 'movie' | 'tv' | 'anime' | 'variety' | 'documentary' | 'episode';
  aspect: '2:3' | '16:9' | '1:1' | '5:6' | '21:9' | 'episode-16:9';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  seed: string;
}
```

**渲染逻辑**：

SVG 运行时生成，**所有视觉元素从 `useBrand()` 和 Token 读取**：

1. **背景**：基于 `seed` 哈希从 `brand.palette.fallbackSeeds`（品牌层 Token）选两色做斜向线性渐变
2. **装饰**：按 `type` 叠加语义图形
   - `movie` → 右下角淡胶片穿孔线条
   - `tv` → 右上角电视天线几何
   - `anime` → 细密点状纹理
   - `variety` → 几何音波抽象
   - `documentary` → 山水等高线
   - `episode` → 中心大字"EP N"
3. **主文字**：标题居中偏上，最多 2 行，超长自动截断加"…"；颜色使用 `var(--color-content-primary)`（主题响应）
4. **副文字**：原文标题 / 年份等；颜色使用 `var(--color-content-secondary)`
5. **品牌角标**：右下角叠印 `brand.logo.urlMono`（单色版）；无 Logo 时用 `brand.nameShort` 首字
6. **噪点纹理**：叠加 1% 透明度 SVG noise，打破"塑料感"
7. **深浅色**：整个 SVG 使用 `currentColor` 和 CSS 变量，自动响应主题

**确定性**：相同 `seed` 永远生成同一张样板图，避免刷新跳动。

**尺寸**：SVG 内元素按 `size` 缩放；父容器按 `aspect` 控制宽高。

### 7.3 使用示例

```tsx
<SafeImage
  src={video.posterUrl}
  alt={video.title}
  aspect="2:3"
  blurhash={video.posterBlurhash}
  fallback={{
    title: video.title,
    originalTitle: video.originalTitle,
    type: video.type,
    seed: video.id,
  }}
  onLoadFail={(reason) => reportBrokenImage(video.id, 'poster', reason)}
/>
```

### 7.4 特殊情形

- **比例不匹配**（源图实际是横版，字段声明竖版）：`object-fit: cover` + `object-position: center top` 强切，同时上报 `aspect_mismatch`
- **预取失败**（桌面 hover 预取）：静默，不显示错误，只标记
- **Logo 缺失**：详情页顶部 Logo 位**不降级为样板图**，而是直接显示品牌 Token 字体渲染的文字标题

---

## 8. 后台支持

### 8.1 `/admin/fallback-preview`（样板图预览）

- 实时预览四种比例 × 五种视频类型 × 浅/深主题的 40 个样板图
- 顶部品牌切换器（与设计系统后台共用）
- 允许运营调整 `brand.palette.fallbackSeeds`（跳转到设计系统编辑）
- "上传品牌最终兜底大图"入口（极少数情况下，运营可为整个品牌上传一张统一兜底 PNG 替代 SVG 生成）

### 8.2 图片健康监控 Dashboard

后台首页或 `/admin/image-health` 页面，卡片化展示：

- **总视频数 / P0 覆盖率 / P1 覆盖率**
- **7 天新增破损数**（趋势图）
- **TOP 破损域名**（同一源站大面积失效优先处理）
- **未补图视频排行**（按流量/热度排序，运营优先补）

### 8.3 视频编辑页改造

视频详情编辑页新增"图片"区块：

- 显示当前各 kind 的图片 + 状态（✓ OK / ⚠ 失败 / ○ 缺失）
- 点击替换：支持 URL 填写或本地上传（本地上传阶段性方案，见第 10 节）
- 显示最近一次健康检查时间和结果

### 8.4 视频列表角标

视频列表每行增加"图片健康"角标：

- 🟢 全部 P0+P1 OK
- 🟡 P0 OK 但 P1 缺失
- 🔴 P0 失效（需立即处理）

---

## 9. 多品牌适配

样板图系统天然品牌感知（见 7.2）。其他要点：

- 每个品牌的 `brand/palette/fallbackSeeds` 独立配置，样板图自动使用当前品牌的调色板
- 每个品牌的 Logo 独立，样板图角标自动切换
- `/admin/fallback-preview` 支持切换品牌预览
- **类型装饰图形（胶片、天线等）品牌无关**——这是通用语义符号，不应品牌化
- 图片治理的 job、监控、URL 空间**品牌无关**——视频内容跨品牌共享

---

## 10. CDN 与存储方案（已定稿）

**选型决议**：**Cloudflare Images + R2** 贯穿两个部署阶段。理由与部署路径见 `frontend_redesign_plan_20260418.md` 第 21 节 F3 条目。本节只给出接入细节。

### 10.1 Loader 契约（本轮做）

以 Cloudflare Images 参数为统一契约，其他候选（imgix / aliyun IMG）若未来需要只需换 URL 模板：

```ts
// src/lib/image/loader.ts
export interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;                          // 1-100, default 75
  format?: 'auto' | 'webp' | 'avif' | 'jpg'; // Cloudflare Images 默认 auto
}

export interface ImageLoader {
  (params: ImageLoaderParams): string;       // 返回最终 URL
}

// 开发环境 / 测试环境 loader：原样返回 src
export const passthroughLoader: ImageLoader = ({ src }) => src;

// 生产默认 loader：Cloudflare Images
// 交付 URL 规范：https://<ACCOUNT_HASH>.cloudflareimages.com/<IMAGE_ID>/<VARIANT>
// 或通过 URL params 动态变换：/cdn-cgi/image/width=<w>,quality=<q>,format=<f>/<SRC>
export const cloudflareLoader: ImageLoader = ({ src, width, quality = 75, format = 'auto' }) =>
  `${CF_IMAGE_DELIVERY_BASE}/cdn-cgi/image/width=${width},quality=${quality},format=${format}/${encodeURIComponent(src)}`;
```

`<SafeImage>` 内部统一通过 `loader()` 包一层。

### 10.2 接入 `next/image`（Vercel 阶段必做）

- **`next.config.ts`**：`images.loader = 'custom'` + `images.loaderFile = './src/lib/image/loader.ts'`
- **禁用 Vercel 默认 optimizer**（关键）：上述配置已使 `next/image` 走自定义 loader，不再使用 Vercel 的 `/_next/image` 路径，避免二次变换与多余带宽计费
- 保留 `next/image` 原生能力：lazy-loading、`srcset`、priority 调度、占位图
- 切换 Cloudflare Pages 阶段：同一套配置继续生效，URL 仍走 Cloudflare Images

### 10.3 图片存储方案

**运营上传、入库预生成、用户未来上传**统一走 **S3-compatible 抽象**：

```ts
// src/lib/storage/index.ts
export interface FileStorage {
  put(key: string, data: Buffer | ReadableStream, opts: { contentType: string }): Promise<{ url: string }>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  getPresignedUploadUrl(key: string, opts: { contentType: string; expiresIn: number }): Promise<string>;
}
```

- **生产（Vercel 与 Cloudflare Pages 阶段均用）**：Cloudflare R2（零出站费，S3-compatible，与 Cloudflare Images 同域可打通）
- **本地开发**：MinIO（Docker 启动一条即可，S3-compatible）
- **CI / 测试**：MinIO 或内存 mock

**R2 与 Cloudflare Images 的协同**：
- 运营上传的原图 → R2 私有 bucket
- 前端展示时把 R2 的对象 URL 通过 Cloudflare Images Transform 分发（同账户零出站）
- 抓取的第三方图暂不落盘到 R2（保留原始 URL），直接经 Cloudflare Images 做 fetch-and-transform，这是 Cloudflare Images 的"Transform external images"能力

### 10.4 多尺寸策略

Cloudflare Images 接入后统一走 **动态参数模式**——前端按视口计算 `width`，loader 自动生成对应 URL。无需预生成多个尺寸字段，字段 `poster_url_sm/md/lg` **不再需要**。

过渡期（开发环境 / 本地）：`passthroughLoader` 原样返回 src，尺寸由浏览器自行处理。

### 10.5 未来切换其他 CDN 的路径

若未来因成本或地域扩展需要切换：
- **imgix**：只改 `cloudflareLoader` 的 URL 拼接规则
- **阿里云 IMG**：同上，URL 参数从 `width=` 改为 `?x-oss-process=image/resize,w_`
- **自建 imgproxy**：同上

Loader 抽象保证业务代码零改动。

---

## 11. 迁移策略

### 11.1 阶段

**阶段 1：数据层打底**

- Schema 变更落地（`videos` / `episodes` / `broken_image_events`）
- 一次性回填 job：扫描现有视频 URL，首次生成 BlurHash / 主色 / 状态
- 回填期间前台继续使用旧路径，不受影响

**阶段 2：组件替换**

- 实现 `<SafeImage>` + `<FallbackCover>`
- 逐模块替换 `<img>` / 现有 `next/image` 调用：列表卡 → 详情页 → Banner → 剧集 → 搜索
- 每个模块替换后回归测试

**阶段 3：治理开启**

- `image_health_check` job 上线，定期巡检
- `/admin/image-health` Dashboard 上线
- `/admin/fallback-preview` 上线

**阶段 4：CDN 接入（未来）**

- 选型 + loader 实现
- 切换 loader 默认值
- 回归与监控

### 11.2 兼容期行为

- 旧组件未迁移前：保持原状，不强制
- 新组件必须用 `<SafeImage>`（ESLint 规则禁止新 `<img>`）
- 迁移完成后 ESLint 全站开启禁用规则

---

## 12. 里程碑拆分

### M1：Schema 与入库治理（预计 2 个任务卡）

- [ ] `videos` / `episodes` 字段扩展 + 迁移脚本
- [ ] `broken_image_events` 表新建
- [ ] `image_health_check` job 实现
- [ ] `blurhash_and_color_extract` job 实现
- [ ] 一次性回填 job（存量视频初始状态填充）
- [ ] 架构文档同步（`docs/architecture.md`）

### M2：前端组件（预计 2 个任务卡）

- [ ] `<SafeImage>` 组件 + `loader()` 抽象
- [ ] `<FallbackCover>` SVG 组件（四比例 + 五类型 + 品牌感知）
- [ ] beacon API 上报失败事件
- [ ] 全站现有 `<img>` / `next/image` 迁移到 `<SafeImage>`
- [ ] 单元测试 + Storybook（或替代预览）

### M3：后台治理（预计 2 个任务卡）

- [ ] `/admin/image-health` Dashboard
- [ ] `/admin/fallback-preview` 预览页
- [ ] 视频编辑页图片区块改造
- [ ] 视频列表健康角标

### M4：CDN 预备（预计 1 个任务卡，不实施对接）

- [ ] loader 接口定义
- [ ] `next.config.ts` 接入 custom loader
- [ ] 过渡期多尺寸方案（按运营上传 or 原图直出）

**CDN 实际接入**属于未来任务，不纳入本次里程碑。

---

## 13. 架构决策要点（需追加到 `docs/decisions.md`）

1. **选 SVG 运行时生成样板图**，不选静态 PNG 图集：承载标题文字、适应品牌变化、尺寸任意。
2. **选 `<SafeImage>` 封装统一降级链**，不让调用者各自 `onError`：保证破图永远不现身。
3. **选服务端预判 `<kind>_status`**，不让前端每次都试探：节省用户端请求，响应更快。
4. **选 BlurHash 而非 ThumbHash 或 LQIP**：字节数最小、视觉效果足够好、社区成熟。
5. **选入库时一次性生成 BlurHash/主色**，不运行时计算：成本前置，前端零负担。
6. **选图片 URL loader 抽象**，不立即接 CDN：解耦"管线契约"与"CDN 选型"，未来切换零改动。
7. **选失败 beacon 上报而非每次都写 DB**：低干扰、可聚合、失败率可观测。

---

## 14. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 存量视频 BlurHash 回填消耗大量带宽和时间 | 分批次低峰执行（1k/batch）+ 失败重试队列 |
| `image_health_check` 对源站发出大量请求被封 | 域级限速 + `User-Agent` 标识 + 出现 429 自动 backoff |
| 样板图 SVG 在低端机渲染慢 | 限制装饰密度；按 `size` 参数精简；极端情况降级为纯色块 |
| 品牌 Logo 透明 PNG 缺失导致样板图角标尴尬 | 用 `brand.nameShort` 首字兜底，确保任意品牌都可渲染 |
| 过渡期多尺寸策略不一致（抓取走 A，上传走 C） | 字段冗余但向前兼容；CDN 接入后字段可废弃 |
| 抓取的"竖封面"实际是横版，前端强切丑 | 入库检查阻断（aspect_mismatch 状态），后台显示提醒 |
| beacon 上报风暴（单视频失效导致 N 次上报） | 前端去重（同一 session 同一 URL 只上报 1 次）+ 后端聚合 |

---

## 15. 已决策（2026-04-18）

本文原列的 6 项待定在本次规划讨论中全部落定。

**I1 · CDN 选型** → 见第 10 节已改为"已定稿"：**Cloudflare Images + R2**；决议理由与部署路径见 `frontend_redesign_plan_20260418.md` 第 21 节 F3。

**I2 · 运营上传图存储**

- 决议：**S3-compatible 抽象**；生产默认后端 **Cloudflare R2**，本地开发用 MinIO
- 不走"本地磁盘过渡再迁移"路径：迁移成本永远大于一开始就抽象
- 影响章节：10.3

**I3 · Logo 透明 PNG 纳入 TMDB 抓取**

- 决议：**纳入**。`external_metadata_import` 流程需为已有的 `videos.logo_url / logo_status`（5.1 节定义）补齐 TMDB `/images/logos` 抓取实现；不再新增字段
- 理由：边际成本接近 0（同一次 TMDB API 调用）；视觉回报高（"电影 Logo 贴 backdrop"是现代流媒体详情页标配）；不抓未来补跑代价大
- 影响章节：5.1（字段已存在，只需实现抓取）、`docs/external_metadata_import_plan_20260405.md`（需补充 logos 端点调用）

**I4 · 剧集缩略图来源**

- 决议：**本轮纯抓取 + 四级 fallback**；截帧方案留 V2
- 理由：服务端截帧不可行（本站不托管视频）；客户端截帧受第三方视频源 CORS 限制；现有 fallback 链路覆盖足够
- 截帧的前置条件：自有视频源或转码中间层，均非本轮能推进
- 影响章节：5.2

**I5 · 品牌最终兜底大图上传**

- 决议：**延后至 V2**
- 理由：SVG fallback 覆盖率 100%，CSS 纯色渐变作为最终兜底已足够；`brand/asset/og-image` 字段已承载分享场景的"实图兜底"需求
- 未来如需启用，字段设计为 `brand/asset/fallback-image`，走同一套运营上传流

**I6 · beacon 上报端点**

- 决议：**新建专用端点 `POST /api/internal/image-broken`**，不复用 Sentry 等错误监控
- 理由：图片失效是业务指标（进后台仪表盘、需聚合去重、关联 video_id），与错误日志的数据模型、保留时长、查询需求完全不同
- 实现：前端 `navigator.sendBeacon()` 异步上报；后端 10 分钟窗口去重（同 session × 同 URL 只记一次）；写入 `broken_image_events` 表
- 影响章节：6.1、8.2

---

---

## 16. 关联文档

- 前端重新设计总方案：`docs/frontend_redesign_plan_20260418.md`
- 设计系统与 Token 管理：`docs/design_system_plan_20260418.md`（品牌 Token 来源）
- 外部元数据导入：`docs/external_metadata_import_plan_20260405.md`（TMDB / Bangumi 图片来源）
- 架构：`docs/architecture.md`（Schema 变更需同步）
- 架构决策：`docs/decisions.md`（需追加图片管线相关 ADR）
- DB 规范：`docs/rules/db-rules.md`
- API 规范：`docs/rules/api-rules.md`
