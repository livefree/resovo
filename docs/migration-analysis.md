# 外部项目迁移可行性分析

**分析日期**：2026-03-18
**分析对象**：`~/projects/LunaTV-enhanced`、`~/projects/yt-player`
**目标**：评估将两个项目的功能模块迁移至 Resovo（流光）的可行性与复杂度

---

## 一、项目概要

### 1.1 LunaTV-enhanced

| 维度 | 详情 |
|---|---|
| 框架 | Next.js App Router（v16.1-ish），React 19 |
| 语言 | TypeScript |
| 播放器 | ArtPlayer 5.3 + artplayer-plugin-danmuku |
| 视频格式 | HLS（hls.js 1.6），FLV（flv.js），WebSR 字幕渲染（@websr/websr） |
| 后端数据层 | 多存储抽象：Redis / Upstash / KVRocks / localStorage（同一接口） |
| 客户端持久化 | IndexedDB（播放记录、收藏）、ClientCache + localStorage（弹幕缓存） |
| UI 依赖 | @mui/material（MUI v5），framer-motion，TanStack Query v5 |
| 其他重依赖 | puppeteer-core（AI 爬取）、@websr/websr（AI 字幕）、@vidstack/react |
| API 路由 | 45 个 Next.js Route Handler（/api/ 目录） |
| Lib 文件数 | 62 个（含 danmu.ts、live.ts、ai-orchestrator.ts 等） |
| 版本管理 | 无 git 历史（无 .git 目录） |

**架构特点**：

- **大页面模式**：`/app/play/page.tsx` 为超大 client component，直接引用 20+ 子组件
- **无服务层分离**：API 路由直接操作数据，无 Service 层抽象
- **耦合度高**：播放器、弹幕、元数据、同步观影等功能深度耦合在 `play/` 页面中
- **模块化程度**：✦✦✧✧✧（组件有拆分但内聚不足，跨层调用多）

**核心功能模块**（可作为迁移候选）：

| 模块 | 文件 | 说明 |
|---|---|---|
| 弹幕系统 | `hooks/useDanmu.ts`（476L），`components/play/DanmuSettingsPanel.tsx`，`app/api/danmu-external/` | 第三方弹幕 API 聚合 + 缓存 + 设置 UI |
| IPTV/直播 | `lib/live.ts` | TVBox M3u 格式解析、EPG 24h 缓存 |
| 剧集选择器 | `components/play/EpisodeSelector.tsx`（及父组件） | 多剧集/季切换 UI |
| Douban 元数据 | `app/api/douban-*`，`app/play/hooks/usePlayPageQueries.ts` | 豆瓣信息（评分/演员/海报） |
| M3u8 下载 | `lib/download/m3u8-downloader.ts` | 流式下载 m3u8 |
| AI 推荐 | `lib/ai-orchestrator.ts` | LLM + puppeteer-core 爬取 |
| 同步观影 | `components/play/WatchRoomSyncBanner.tsx`，`app/watch-room/` | WebSocket 实时同步 |

---

### 1.2 yt-player

| 维度 | 详情 |
|---|---|
| 类型 | React 组件库（独立 npm 包） |
| 包名 | `@livefree/yt-player` v0.1.0 |
| React | 支持 React 18+（peerDependency） |
| 主文件 | `src/player/Player.tsx`（1984 LOC），`Player.module.css`（1471 LOC） |
| 子组件 | Bezel, Button, icons, SeekOverlay, Spinner, Tooltip（轻量 primitives） |
| Hooks | `useThumbnails.ts`（缩略图预览） |
| HLS 支持 | hls.js 动态导入（运行时按需加载），无 hls.js 则降级 |
| 构建产物 | tsup → ESM + CJS 双格式；Vite → IIFE bundle（独立脚本） |
| 运行时依赖 | 零（仅 React peerDep） |
| 样式隔离 | CSS Modules（无全局泄漏） |
| 版本管理 | 无 git 历史（无 .git 目录） |

**架构特点**：

- **单组件封装**：Player.tsx 虽行数多，但逻辑内聚，对外暴露干净的 Props API
- **零依赖设计**：无 video.js、无 artplayer，仅依赖 hls.js（动态加载）
- **CSS 隔离**：CSS Modules 确保样式不泄漏宿主页面
- **可直接安装**：已是完整 npm 包结构，可本地 `npm install` 或 `file:` 引用
- **模块化程度**：✦✦✦✦✧（对外接口清晰，内部有适度分层）

---

## 二、迁移可行性矩阵

### 2.1 yt-player → Resovo 播放器替换

**可行性：⭐⭐⭐⭐⭐（强烈推荐，最低风险）**

| 项目 | 现状 | 迁移后 |
|---|---|---|
| 播放器库 | video.js 8.x（`package.json` 中已引入） | @livefree/yt-player（本地包） |
| HLS 支持 | hls.js 1.5（独立引入） | yt-player 内置动态加载 hls.js |
| CSS | 需自定义 video.js 主题 | CSS Modules 隔离，风格已近 YouTube |
| React 兼容性 | React 19 | peerDep React 18+，完全兼容 |
| 依赖清理 | — | 可移除 `video.js` + `@types/video.js` |

**迁移步骤**：

```
1. npm install file:../../yt-player（或 file:../yt-player）
2. 替换 src/components/VideoPlayer.tsx 中的 video.js 初始化逻辑
3. 接入 Resovo 的 HLS 源地址（sourceUrl prop）
4. 接入弹幕层（yt-player 提供 overlay slot 或 portal，需确认 API）
5. 从 package.json 移除 video.js、@types/video.js
```

**复杂度**：低（约 1~2 天工作量）
**风险**：极低（yt-player 已为打包产物，CSS Modules 不泄漏，API 干净）

---

### 2.2 LunaTV 弹幕系统 → Resovo

**可行性：⭐⭐⭐（可行，需中等改造）**

Resovo 已在 `package.json` 引入 `comment-core-library`，但尚未接入弹幕 API。LunaTV 的弹幕方案基于 `artplayer-plugin-danmuku`，与 Resovo 使用的 `comment-core-library` 是不同技术栈。

**建议做法**：不迁移 LunaTV 的弹幕插件（与 ArtPlayer 深度绑定），而是：
- 参考 LunaTV 的 `useDanmu.ts` 的**数据层逻辑**（缓存策略、多源聚合、重试）
- 在 Resovo 基于 `comment-core-library` 自行实现弹幕渲染层
- 后端弹幕 API 参考 LunaTV `app/api/danmu-external/`（接入 `smonedanmu` 等第三方服务）

| 组件 | 迁移价值 | 操作 |
|---|---|---|
| `useDanmu.ts` 缓存逻辑 | 高（30min cache + retry 机制成熟） | 参考重写，不直接复制（依赖 LunaTV-specific ClientCache） |
| `DanmuSettingsPanel.tsx` | 中（UI 参考） | 参考 UI 结构，用 Tailwind 重写 |
| `/api/danmu-external/` | 高（第三方弹幕源集成） | 在 Resovo Fastify 后端新增 `GET /danmaku` 端点，参考逻辑实现 |

**复杂度**：中（约 3~5 天）
**风险**：中（需自建与 comment-core-library 兼容的数据适配层）

---

### 2.3 LunaTV IPTV/直播模块 → Resovo

**可行性：⭐⭐（可行，但依赖 schema 变更）**

LunaTV 的 `live.ts` 实现了完整的 TVBox M3u 解析 + EPG 缓存，是独立文件（约 400-600 LOC），没有与播放器深度耦合。

**迁移障碍**：
- Resovo 当前数据库无 `live_channels`、`epg_programs` 等表
- Resovo 视频模型（`videos` 表）基于点播，直播是不同业务模型
- 需要新的 ADR（播放架构中没有直播规划）

**建议**：作为独立 Phase 规划（Phase 3 或更晚），不在当前迭代中处理。
**复杂度**：高（需 schema 变更 + 新 ADR + 新路由 + 直播播放器支持）

---

### 2.4 LunaTV 剧集选择器 → Resovo

**可行性：⭐⭐⭐（组件层可迁移，但需后端配合）**

`EpisodeSelector.tsx` 是纯 UI 组件，但依赖 LunaTV 自己的数据结构（TanStack Query + LunaTV-specific API response shape）。

Resovo 已有 `episode_number` 字段（`watch_history` 表中），视频可能需要 episodes 子表（当前架构未定义）。

**建议**：先确认 Resovo 是否需要多剧集支持，再规划 schema（新 ADR），然后用 LunaTV 的 UI 作参考实现。
**复杂度**：中（UI 参考价值大，但后端需扩展）

---

### 2.5 LunaTV Douban 元数据集成 → Resovo

**可行性：⭐⭐⭐（API 层可直接移植）**

LunaTV 的 Douban API 集成（搜索、详情、演员）可作为 Resovo 视频元数据丰富功能，通过爬取豆瓣公开信息补全视频信息。

**迁移方式**：将 LunaTV `app/api/douban-*/` 的逻辑移植到 Resovo Fastify 后端的 `admin/` 路由中（仅管理员触发元数据同步）。

**复杂度**：低~中（约 2~3 天，主要工作是 API 逻辑迁移）
**风险**：低（无深度耦合，纯 HTTP 请求 + 数据清洗）
**注意**：豆瓣无官方 API，需处理反爬限制（User-Agent 轮换、延迟等）。

---

### 2.6 LunaTV AI 推荐 → Resovo

**可行性：⭐（不推荐，复杂度极高）**

- 依赖 `puppeteer-core`（无头浏览器）+ 本地 LLM 或外部 LLM API
- 与 Resovo 当前无 AI 规划的架构路线不匹配
- 引入 puppeteer-core 违反 Resovo 禁止引入计划外依赖原则

**建议**：跳过，不迁移。

---

### 2.7 LunaTV 同步观影（Watch Room）→ Resovo

**可行性：⭐（不推荐，当前阶段过重）**

- 需要 WebSocket 支持（Fastify WebSocket 插件）
- 需要 Room 数据模型（新表）
- 是独立产品功能，与 MVP 核心功能距离远

**建议**：留作 Phase N+2 以后的长期规划项，当前不纳入。

---

### 2.8 LunaTV 后台管理模块 → Resovo 管理员前端

**总体可行性：⭐⭐⭐⭐（高价值，但需要选择性迁移）**

#### 现状对比

| 维度 | LunaTV-enhanced | Resovo 当前状态 |
|---|---|---|
| 后端 Admin API | 24 个路由，4990 LOC | CHG-13~19 已完整实现（users/videos/content/analytics） |
| 前端 Admin UI | `app/admin/page.tsx`（7634 LOC，单文件） | **尚未建立**（无 `/app/admin/` 目录） |
| 架构模式 | 单巨型 client component，30+ 折叠面板 | — |
| 权限体系 | Owner / Admin 两级 | admin / moderator / user 三级（DB + JWT） |
| 配置存储 | KV 存储（Redis/Upstash/localStorage） | 无站点级配置表（各功能配置硬编码或 env） |

**核心结论**：Resovo 的后端 admin API 已完备，缺失的是**整个前端管理界面**。LunaTV 的管理后台提供了功能完整的参考实现，但架构需重构（单文件 → 多页面）。

---

#### 模块级分析

**A. 视频源管理（Source CRUD + 测试）**

| 项目 | LunaTV 实现 | Resovo 对应 |
|---|---|---|
| 源 CRUD | `/api/admin/source`（360L） | 已有：`ContentService` + `/admin/content` |
| 拖拽排序 | `@dnd-kit/core`，权重字段（0~100） | 无排序字段，需加 `sort_order` 列 |
| 源验证测试 | `SourceTestModule.tsx`（965L） | 已有：`verifyWorker` + Bull 队列 |
| 测试结果 UI | 响应时间、匹配率、错误报告 | 无前端 UI |

**迁移建议**：
- 后端 API 无需迁移（Resovo 已有）
- `SourceTestModule.tsx`（965L）的**测试 UI 逻辑**参考价值高，可用 Tailwind 重新实现
- 拖拽排序依赖 `@dnd-kit/core`，若确认需要则按需引入

**工作量**：中（约 3~4 天，主要是前端 UI 实现）

---

**B. 用户管理界面**

| 项目 | LunaTV 实现 | Resovo 对应 |
|---|---|---|
| 用户列表 | `/api/admin/user`（500L），含分页/搜索 | 已有：`listAdminUsers` |
| Ban/Unban | 同上 | 已有：`banUser` / `unbanUser` |
| 角色变更 | setAdmin（两级） | 已有：`updateUserRole`（三级） |
| 密码重置 | 支持 | 未实现 |
| 用户标签/分组 | 支持 | 无此功能 |
| Per-user API 权限 | 支持 | 无此功能（Resovo 用角色控制） |

**迁移建议**：后端已完整，仅需实现前端列表 + 操作 UI。LunaTV 的用户管理组件结构直接可参考。

**工作量**：低（约 1~2 天）

---

**C. 缓存管理（CacheManager）**

LunaTV `CacheManager.tsx`（407L）：按类型展示缓存大小，支持分类清除（豆瓣/弹幕/搜索/YouTube 等 8 类）。

Resovo 对应情况：
- 使用 Redis（`ioredis`），无前端缓存管理界面
- Redis key 命名规范已在各 service 中分散定义

**可行性**：⭐⭐⭐⭐

**迁移方式**：
1. Resovo Fastify 后端新增 `GET /admin/cache/stats`（扫描 Redis key 统计）和 `DELETE /admin/cache/:type`（按前缀批量删除）
2. 前端参考 LunaTV `CacheManager.tsx` 的 UI 结构，用 Tailwind 重写
3. 缓存类型映射到 Resovo 的 Redis key 前缀（如 `video:`, `search:`, `danmaku:` 等）

**工作量**：中（约 2~3 天，后端 + 前端各半）

---

**D. 性能监控（PerformanceMonitor）**

LunaTV `PerformanceMonitor.tsx` 监控：CPU 使用率、内存（heap/RSS/系统）、请求速率（次/分钟）、DB 查询速率、平均响应时间、外部 API 流量分域名统计、最近请求历史。后端 `/api/admin/performance`（97L）。

Resovo 对应情况：**无任何性能监控**。

**可行性**：⭐⭐⭐

**迁移方式**：
- Fastify 支持 hooks（`onRequest` / `onResponse`），可在 `server.ts` 层面收集请求指标
- 内存/CPU 指标用 `process.memoryUsage()` + `os.cpus()` 即可（无需额外依赖）
- LunaTV 的前端 PerformanceMonitor UI 组件可参考，用 Tailwind 重写
- 数据存储可写入 Redis 的短周期 sorted set，定时聚合

**工作量**：高（约 4~5 天，需在 Fastify 中构建指标收集基础设施）

---

**E. 数据迁移（DataMigration）**

LunaTV `DataMigration.tsx`（504L）：支持导入/导出视频源、直播源、用户配置、分类、Emby 配置，格式为 JSON。后端使用多个专用 export/import 端点。

Resovo 对应情况：**无导入导出功能**。

**可行性**：⭐⭐⭐

**适合迁移的子功能**：
- 视频源批量导入（JSON/CSV 格式），映射到 `video_sources` 表
- 视频源批量导出（备份用）
- 用户批量导出（不包含密码 hash）

**迁移方式**：后端新增 `GET /admin/export/sources`、`POST /admin/import/sources`（Fastify multipart 已引入），前端参考 LunaTV 的 ImportExportModal UI。

**工作量**：中（约 2~3 天）

---

**F. 站点配置（SiteConfig）**

LunaTV 有完整的站点级配置（站名、公告、搜索参数、代理设置等），存储在 KV 中。

Resovo 对应情况：无站点配置表，相关配置硬编码或通过环境变量管理。

**可行性**：⭐⭐

**迁移障碍**：Resovo 无 `site_config` 表，需先做 schema 变更和 ADR。此外 LunaTV 的许多配置项（TVBox、豆瓣代理、Emby 等）与 Resovo 无关，需大量裁剪。

**建议**：暂不迁移，等 Resovo 明确需要哪些站点级配置后再设计（避免过度工程化）。

---

**G. 不适合迁移的模块（LunaTV 特有功能）**

以下模块与 Resovo 的产品形态不符，不应迁移：

| 模块 | 原因 |
|---|---|
| TVBox 安全配置 | Resovo 无 TVBox 支持 |
| Emby 私人影库 | Resovo 无 Emby 集成 |
| 弹幕 API 配置面板 | Resovo 弹幕方案不同（见 §2.2） |
| OIDC/Telegram 登录配置 | Resovo 使用 JWT 独立认证，暂无 SSO 规划 |
| 信任网络配置 | 内网穿透场景，与 Resovo 部署模式不符 |
| AI 推荐配置 | 不引入（见 §2.6） |
| 短剧/YouTube 配置 | Resovo 聚合逻辑不同 |
| 配置文件订阅 | TVBox 生态专用 |

---

**H. 架构建议：不要复制 LunaTV 的单文件模式**

LunaTV 的 `admin/page.tsx`（7634L 单文件）是反模式：
- 首次加载 JS bundle 极大
- 所有 admin 功能无论是否使用都被加载
- 测试和维护困难

**Resovo 管理后台应采用的架构**：

```
src/app/admin/
├── layout.tsx              ← 侧边栏导航 + 权限守卫
├── page.tsx                ← 仪表盘（Analytics）
├── videos/
│   └── page.tsx            ← 视频管理列表 + 发布
├── sources/
│   └── page.tsx            ← 视频源管理 + 测试
├── users/
│   └── page.tsx            ← 用户管理 + ban/role
├── content/
│   └── page.tsx            ← 投稿审核 + 字幕审核
└── system/
    ├── cache/page.tsx      ← 缓存管理
    ├── monitor/page.tsx    ← 性能监控
    └── migration/page.tsx  ← 数据导入导出
```

每个页面为独立路由，按需加载，权限检查在 `layout.tsx` 中统一处理。

---

## 三、迁移优先级建议

### 播放器 & 播放功能

| 优先级 | 模块 | 来源 | 估算工作量 | 依赖前置 |
|---|---|---|---|---|
| P1 | 播放器替换（video.js → yt-player） | yt-player | 1~2 天 | 无 |
| P2 | 弹幕系统（后端 API + comment-core-library 接入） | LunaTV 参考 | 3~5 天 | P1 完成 |
| P3 | Douban 元数据集成 | LunaTV 参考 | 2~3 天 | 无 |
| P4 | 剧集多集支持（需新 ADR + schema） | LunaTV 参考 | 5~8 天 | 新 ADR |
| P5 | IPTV/直播支持 | LunaTV live.ts | 10+ 天 | 新 ADR + schema |
| — | AI 推荐 | LunaTV | 不推荐 | — |
| — | 同步观影 | LunaTV | 不推荐（当前阶段） | — |

### 管理后台前端（Resovo 当前完全缺失）

| 优先级 | 模块 | 来源 | 估算工作量 | 依赖前置 |
|---|---|---|---|---|
| P1 | Admin layout + 仪表盘页（Analytics UI） | LunaTV 参考 | 2~3 天 | 无（后端已有） |
| P1 | 用户管理页（列表/ban/role） | LunaTV 参考 | 1~2 天 | 无（后端已有） |
| P1 | 视频管理页（列表/发布/编辑） | LunaTV 参考 | 2~3 天 | 无（后端已有） |
| P2 | 视频源管理页（CRUD + 测试 UI） | LunaTV SourceTestModule 参考 | 3~4 天 | 无（后端已有） |
| P2 | 投稿/字幕审核页 | LunaTV 参考 | 1~2 天 | 无（后端已有） |
| P3 | 缓存管理页 | LunaTV CacheManager 参考 | 2~3 天 | 需新增后端 cache API |
| P3 | 数据导入导出 | LunaTV DataMigration 参考 | 2~3 天 | 需新增后端 export API |
| P4 | 性能监控页 | LunaTV PerformanceMonitor 参考 | 4~5 天 | 需 Fastify 指标收集层 |
| — | 站点配置 | LunaTV 参考 | 暂不规划 | 需 schema 变更 + ADR |

---

## 四、关键结论

1. **yt-player 是直接可用的最高价值资产**：零依赖、CSS 隔离、干净 API，可立即通过本地 `file:` 引用安装到 Resovo，替换现有 video.js 方案，清理一批不必要的依赖。

2. **LunaTV 管理后台是 Resovo 最需要的参考**：Resovo 后端 admin API 在 CHG-13~19 中已全部实现，但完全没有前端管理界面。LunaTV 的管理后台恰好覆盖了相同的功能域（视频/源/用户/Analytics），是构建 Resovo 管理前端的最直接参考。

3. **架构不能照搬**：LunaTV 7634L 的单文件管理页是反模式，Resovo 应采用多页面路由（`/admin/videos`、`/admin/users` 等），按需加载，逻辑清晰。LunaTV 的各独立组件（CacheManager、PerformanceMonitor、SourceTestModule 等）可作为参考，用 Tailwind 重写。

4. **LunaTV 特有功能不迁移**：TVBox、Emby、OIDC/Telegram、AI 推荐、同步观影等模块与 Resovo 产品形态不符，不引入。

5. **弹幕是播放侧最值得推进的功能**（在播放器替换后）：Resovo 已引入 `comment-core-library` 但未使用，技术依赖已就绪，只差后端 API 接入和渲染层实现。

6. **IPTV/直播需要独立规划**：涉及 schema 变更和新 ADR，不应在现有迭代中插入，需作为独立 Phase 前置设计。

7. **两个项目均无 git 历史**，无法通过 commit log 追踪设计演进，迁移决策只能基于当前代码状态。

---

## 五、建议新增任务（下一 Phase）

### 播放器

| # | 任务 | 来源 | 优先级 |
|---|---|---|---|
| CHG-20 | 将 video.js 替换为 @livefree/yt-player | yt-player | P1 |
| CHG-21 | 实现弹幕后端 API（GET /videos/:id/danmaku） | LunaTV 参考 | P2 |
| CHG-22 | 接入 comment-core-library 渲染弹幕（播放页）| Resovo 内部 | P2 |
| CHG-23 | Douban 元数据同步（admin trigger） | LunaTV 参考 | P3 |

### 管理后台前端

| # | 任务 | 来源 | 优先级 |
|---|---|---|---|
| CHG-24 | Admin 基础 UI 组件库（DataTable/Modal/StatusBadge/Pagination）— 所有 Admin 页面增强的前置 | 内部新建 | P1 |
| CHG-25 | Admin 仪表盘增强（SSR 直出 + 30s 刷新 + 队列警示横幅） | LunaTV 参考 | P1 |
| CHG-26 | Admin 用户管理页 | LunaTV 参考 | P1 |
| CHG-27 | Admin 视频管理页（列表/发布/元数据编辑） | LunaTV 参考 | P1 |
| CHG-28 | Admin 视频源管理页（CRUD + 验证测试 UI） | LunaTV SourceTestModule | P2 |
| CHG-29 | Admin 投稿审核 + 字幕审核页 | LunaTV 参考 | P2 |
| CHG-30 | Admin 缓存管理（后端 API + 前端 UI） | LunaTV CacheManager | P3 |
| CHG-31 | Admin 数据导入导出（sources JSON） | LunaTV DataMigration | P3 |
| CHG-32 | Admin 性能监控（Fastify 指标 + UI） | LunaTV PerformanceMonitor | P4 |
