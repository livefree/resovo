# apps/web-next — Resovo 前台（重写版）

**状态**：🟢 REGRESSION 完成，方案 M1/M2/M3 能力层已补齐（2026-04-20）

---

## 当前架构状态

`apps/web-next/` 是 `apps/web/` 的并行重写版本，通过 nginx 网关 + middleware ALLOWLIST 渐进接管路由。

| 里程碑 | 已接管路由 | 状态 |
|--------|-----------|------|
| M2 | `/`（首页） | ✅ 已完成 |
| M3 | `/watch/*`、`/movie/*`、`/series/*`、`/anime/*`、`/variety/*`（tvshow）、`/others/*` | ✅ 已完成 |
| M4 | `/auth/*` | ⬜ 未开始 |
| M5 | `/search`、`/browse`、弹幕 | ⬜ 未开始 |
| M6 | 后台全量；旧应用下线 | ⬜ 未开始 |
| M6-RENAME | `git mv apps/web-next apps/web` | ⬜ 未开始 |

> **分类/筛选/搜索页目前不可达**（dev 环境）：这些页面尚未迁入 apps/web-next，通过 nginx 代理时会回退到 `apps/web`（port 3000）。直接访问 web-next 端口时，未迁移路由返回 404，属正常情况。

---

## 核心能力层（REGRESSION 阶段补齐）

### 品牌与主题系统

- **BrandProvider**（`src/contexts/BrandProvider.tsx`）：SSR 安全双 Context（ThemeContext + BrandContext）
- **useBrand / useTheme / useSetTheme**（`src/hooks/`）：消费品牌/主题状态
- **middleware**（`src/middleware.ts`）：读取 `resovo-brand` / `resovo-theme` cookie → 注入请求头
- **theme-init-script**（`src/lib/theme-init-script.ts`）：`<head>` 内 blocking script，首屏无 FOUC

### 全局骨架

Root layout 常驻四件套（`src/app/[locale]/layout.tsx`）：

```
BrandProvider
  ├── Nav（消费 useBrand）
  ├── main#main-content（页面内容槽）
  ├── #global-player-host-portal（Portal 宿主，pointer-events:none）
  ├── GlobalPlayerHost（client-only，createPortal）
  ├── RoutePlayerSync（路由↔播放器状态同步）
  └── Footer（消费 useBrand）
```

### Primitives（`src/components/primitives/`）

| Primitive | 状态 | 说明 |
|-----------|------|------|
| PageTransition | ✅ 实装 | View Transitions API，三态降级（支持/不支持/reduced-motion） |
| SharedElement | ⚠️ noop 合约 | API 契约冻结，FLIP 数学 M5 实装 |
| RouteStack | ⚠️ noop stub | API 合约冻结，手势 M5 Tab Bar 实装 |
| LazyImage + BlurHash | ✅ 实装 | IntersectionObserver + blurhash@2.x 解码 |
| ScrollRestoration | ✅ 实装 | sessionStorage 跨路由恢复 |
| PrefetchOnHover | ✅ 实装 | hover 150ms + matchMedia 能力检测 |

### 图片系统（`src/components/media/` + `src/lib/image/`）

- **SafeImage**：四级降级链（真实图 → BlurHash 占位 → FallbackCover → CSS 渐变）
- **FallbackCover**：纯 CSS + 内联 SVG，颜色全部 CSS 变量，零硬编码
- **image-loader**：passthrough 实现，预留 Cloudflare Images 接入点（env: `NEXT_PUBLIC_IMAGE_LOADER=cloudflare`）

### 播放器系统（`src/app/[locale]/_lib/player/` + `src/stores/playerStore.ts`）

**hostMode 状态机**：

```
closed → full → mini → closed
                ↕
               pip
```

**Portal 架构**：

- `GlobalPlayerHost`：createPortal 到 `#global-player-host-portal`
  - `full` 态 → `GlobalPlayerFullFrame`（渲染 PlayerShell，含关闭/缩小控制栏）
  - `mini` 态 → `MiniPlayer`（固定右下 320×180，点击"展开"导航到 /watch 页）
  - `pip` 态 → `PipSlot`（不可见容器，浏览器 PiP 窗口控制画面）

**sessionStorage 持久化**：key `resovo:player-host:v1`，mini/pip 跨路由保持，full 刷新降级为 closed

**已知限制**：mini 模式无真实视频画面（`<video>` 元素随 PlayerShell 卸载而停止），后续重构保持 DOM 存活后解决。

---

## 本地开发快速启动

```bash
# 1. 安装依赖
npm install

# 2. 启动全部服务（推荐，含 nginx 代理）
docker-compose up

# 3. 仅启动 web-next（port 3002）
npm run dev --workspace=@resovo/web-next

# 4. 通过 nginx 代理访问（推荐，ALLOWLIST 生效）
open http://localhost:3000
```

**端口说明**：

| 服务 | 端口 | 说明 |
|------|------|------|
| nginx | 3000 | 反向代理，ALLOWLIST 决定路由去向 |
| apps/web | 3001 | 旧前台（逐步退役） |
| apps/web-next | 3002 | 新前台（本应用） |
| apps/server | 3003 | 后台管理 |
| apps/api | 4000 | Fastify API |

**ALLOWLIST**（`src/config/rewrite-allowlist.ts`）：控制哪些路由由 web-next 提供。未在 ALLOWLIST 内的路由由 nginx 回退到 apps/web。

---

## 测试策略

```bash
# 单元测试（Vitest）
npm run test -- --run

# E2E 新套件（Playwright，apps/web-next 专属）
npm run test:e2e -- --project=web-next

# 类型检查
npm run typecheck

# Lint
npm run lint
```

**三层测试**：

| 层级 | 位置 | 说明 |
|------|------|------|
| 单元测试 | `tests/unit/` | Vitest，1136 条，全绿 |
| E2E（新） | `tests/e2e-next/` | Playwright，web-next 专属 |
| E2E（旧/quarantine） | `tests/e2e/` | LEGACY SNAPSHOT，逐块随页面迁移删除 |

---

## 关联文档

- `docs/architecture.md` — 系统架构总览
- `docs/decisions.md` — ADR 决策记录（ADR-030 起含重写期决策）
- `docs/milestone_alignment_20260420.md` — 方案 M1/M2/M3 ↔ 执行里程碑对齐表
- `docs/task-queue.md` — 任务规划与进度
- `CLAUDE.md` — AI 助手工作总纲
