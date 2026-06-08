# 后台 cutover 功能重现核对（apps/server → apps/server-next）2026-06-08

> **trigger**：用户指令"核对新后台对旧后台功能的重现，更新规划退役路线"
> **status**：核对完成 / 退役路线已据此刷新（plan v2.6 → v2.7）
> **owner**：@livefree（裁定）/ @engineering（执行）
> **related**：`docs/server_next_plan_20260427.md` §6 M-SN-7（CUTOVER）/ ADR-101（切流回滚）/ ADR-181 + ADR-182（banner 收编）/ SEQ-20260606-01（v1 E2E 降冒烟）
> **执行模型**：claude-opus-4-8 ｜ **子代理**：arch-reviewer (claude-opus-4-8)

---

## 0. 结论摘要

旧后台 `apps/server/src/app/admin` 共 **28 个 page.tsx 物理文件 / 26 条逻辑路由**（`banners` 的 `page`/`new`/`[id]` 三页在矩阵中折叠为一行）。逐项对照新后台 `apps/server-next`（page 路由 + 权威导航 `apps/server-next/src/lib/admin-nav.tsx` 侧栏 15 项）：

- **业务功能 100% 重现 / 有意收编 / 拆分**（24 项 ✅）
- **有意冻结退役**（1 项，ADR 已落非遗漏）：`banners` → ADR-181/182 收编进 `/admin/home`（需 1 项运营等价确认）
- **QA/开发工具**（3 项）：`sandbox` 已被 dev/components 覆盖 ✅；`fallback-preview` / `design-tokens` 新后台无完整对应 → **用户裁定：退役前迁移到 `/admin/dev/`**

**cutover 前置实质已达成**：v1 E2E 已降冒烟/退役（SEQ-20260606-01，2026-06-06 收口，admin 域 76/76 EXIT=0，BLOCKER 已撤除）；apps/server 仅余维护期身份，无业务功能缺口阻塞退役。

---

## 1. 全量对照矩阵（26 条逻辑路由 / 28 物理 page.tsx）

| 旧后台路由 | 功能 | 新后台对应 | 结论 |
|---|---|---|---|
| `/admin` | 管理台站 dashboard | `/admin`（DashboardClient） | ✅ 重现 |
| `analytics` | 数据看板 | `/admin/analytics` + dashboard Tab | ✅ 重现 |
| `moderation` | 内容审核 | `/admin/moderation`（4 Tab） | ✅ 重现 |
| `content` | 投稿/字幕统一入口 | 拆为 `moderation` + `subtitles` + `user-submissions`/`submissions` | ✅ 重现（拆分） |
| `videos` | 视频库 | `/admin/videos` | ✅ 重现 |
| `videos/new` | 手动添加视频（ADMIN-02） | videos Drawer `createVideo` + "手动添加视频"入口（`VideoListClient.tsx`/`VideoEditDrawer.tsx`） | ✅ 重现（页→Drawer） |
| `videos/[id]/edit` | 视频编辑 | videos Drawer（`_videoEdit`） | ✅ 重现（页→Drawer） |
| `sources` | 播放线路 | `/admin/sources`（+ `source-line-aliases` 别名表增强） | ✅ 重现+增强 |
| `subtitles` | 字幕管理 | `/admin/subtitles` | ✅ 重现 |
| `image-health` | 图片健康 | `/admin/image-health` | ✅ 重现 |
| `crawler` | 采集控制 | `/admin/crawler`（+ `runs`/`runs/[id]` 采集批次增强） | ✅ 重现+增强 |
| `system/sites` | 站点（兼容入口） | 本就是 `redirect('/admin/crawler?tab=sites')`；新 crawler 站点表 `crawler-site-columns-v2.tsx` 覆盖 | ✅ 重现（入口可随删） |
| `system/cache` | 缓存管理 | `/admin/system/cache` | ✅ 重现 |
| `system/config` | 配置 | `/admin/system/config` | ✅ 重现 |
| `system/migration` | 迁移 | `/admin/system/migration` | ✅ 重现 |
| `system/monitor` | 性能监控 | `/admin/system/monitor` | ✅ 重现 |
| `system/settings` | 站点设置 | `/admin/settings` + `/admin/system/settings` | ✅ 重现 |
| `users` | 用户管理 | `/admin/users` | ✅ 重现 |
| `submissions` | 投稿 | `/admin/submissions` + `/admin/user-submissions` | ✅ 重现 |
| `staging` | 暂存发布 | `/admin/staging` | ✅ 重现 |
| `403` | 403 页 | `/403`（next） | ✅ 重现 |
| `login` | 登录 | `/admin/login` + `/login` | ✅ 重现 |
| `banners`（+`new`+`[id]`） | Banner CRUD / 时间窗 / 拖拽排序 | **ADR-181/182 冻结退役** → 收编 `/admin/home`（`home_banners` 维持 Hero 唯一真源；`BannerImageGuard` 已实装） | ⚠️ 有意收编（见 §2） |
| `sandbox` | 表格 demo（dev 工具） | `/admin/dev/components`（Storybook-style demo） | ✅ 重现（dev 工具） |
| `design-tokens` | token 预览（QA 工具） | `/admin/dev/visual` 部分覆盖 | ⚠️ 退役前迁移（见 §3） |
| `fallback-preview` | 样板图预览（QA 工具） | **无完整对应** | ⚠️ 退役前迁移（见 §3） |

**新后台净增（旧后台无）**：`merge`（合并拆分）、`external-resources`（外部资源）、`audit`（独立审计页）、`crawler/runs`（采集批次）。

---

## 2. Banner 收编（ADR-181/182）——运营等价确认项

`banners` 的 CRUD/详情编辑/时间窗/拖拽排序属业务功能。ADR-181 D-181-1 已裁定：`home_modules.slot='banner'` 两段式冻结退役，`home_banners` 维持前台 Hero 唯一真源；ADR-182 提供 `/admin/home/*` 聚合门面 7 端点。即 banner 是**有意收编进 `/admin/home`**，非遗漏。

- [ ] **#PARITY-BANNER-01** cutover 前确认：`/admin/home` 是否提供原 banner 的"时间窗（生效区间）+ 显示顺序拖拽"运营等价能力；若有缺口，登记为 home 增强卡而非 cutover 阻塞项（对照 ADR-181 §时间窗不 rename + 聚合 DTO 统一）。

---

## 3. QA/开发工具迁移（用户裁定 2026-06-08：退役前迁移到 dev/）

| 旧页 | 现状 | 处置 |
|---|---|---|
| `fallback-preview`（FallbackCover 样板图预览，确认颜色变量无硬编码） | server-next 仅有 lib 级使用，无预览页 | 退役前补迁到 `/admin/dev/`（隐藏路由，开发/QA 工具区） |
| `design-tokens`（token 预览） | `/admin/dev/visual` 部分覆盖 | 退役前确认/补齐到 `/admin/dev/` |
| `sandbox`（表格 demo） | `/admin/dev/components` 已覆盖 | 无需迁移 ✅ |

> 迁移子卡登记于 `docs/task-queue.md` 退役执行序列（仅登记，本次不实现代码）。

---

## 4. cutover 前置完成度小结

| 前置项 | 状态 | 依据 |
|---|---|---|
| 业务功能 parity | ✅ 达成 | 本文件 §1 |
| v1 E2E 降冒烟/退役 | ✅ 完成 | SEQ-20260606-01（admin 域 76/76 EXIT=0，2026-06-06） |
| QA 工具迁移 dev/ | ⏳ 待执行 | §3（退役序列子卡） |
| banner 收编运营确认 | ⏳ 待确认 | §2 #PARITY-BANNER-01 |
| nginx 切流 + 删 apps/server + 改名 apps/admin | ⏳ 待执行（独立门禁） | plan §4.2 / ADR-101 |

**裁定**：旧后台无业务功能缺口阻塞退役；剩余为 QA 工具迁移、banner 运营确认与物理 cutover 三项收尾工作，均登记进退役执行序列。
