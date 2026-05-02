# Resovo（流光） — Track sn4-08-video-edit-drawer 任务工作台

> Track: sn4-08-video-edit-drawer
> 分支：`track/sn4-08-video-edit-drawer`
> status: active
> owner: @engineering
> source_of_truth: yes（本 Track 内）
> last_reviewed: 2026-05-02
>
> 单任务工作台（Track 内）：同一时刻只保留 1 个进行中任务。Track 注册表见 `docs/tracks.md`，并行规则真源 `docs/rules/parallel-dev-rules.md` v1.1。
>
> **本 Track 持有冲突域**：`app:server-next:videos`（自定义软锁，命名空间隔离）
> **集成阶段 task-queue.md Type B 写入**：禁止在本分支执行；统一在 PR 合并到 main 时由集成方串行更新。

---

## 进行中任务

### CHG-SN-4-08 · VideoEditDrawer 三 Tab 真实 API：线路 / 图片 / 豆瓣 · 🔄 进行中

- **来源序列**：`docs/task-queue.md` SEQ-20260501-01 / M-SN-4 阶段 C 双轨
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §6（数据显示补全）+ §7（mock → 真实 API 接入清单）+ §8.1 第 6 张卡
- **建议主循环模型**：`claude-sonnet-4-6`（plan §8.1 - 4 工作日规模）
- **强制子代理**：否（如出现新 ADR 级决策 / packages/admin-ui 共享 API 契约改动 → BLOCKER 暂停）
- **前置**（全部已就位）：CHG-SN-4-04 ✅（5 件 admin-ui 下沉）+ CHG-SN-4-05 ✅（后端 API + 058a + admin/videos GET 扩展）+ CHG-SN-4-05a ✅（ErrorCode 真源）+ CHG-SN-4-05b ✅（CONFLICT status）
- **下游解锁**：CHG-SN-4-10 milestone 收口卡
- **可与 sn4-07 完全并行**（文件域零重叠）

#### 现状（已实测）

```
apps/server-next/src/app/admin/videos/_client/
├── VideoEditDrawer.tsx              # 主 Drawer 容器（249 行；已就位）
└── _videoEdit/
    ├── TabBasicInfo.tsx             # 基础信息 Tab（已接 API；本卡不动）
    ├── TabLines.tsx                 # 线路 Tab（mock；本卡接入）
    ├── TabImages.tsx                # 图片 Tab（mock；本卡接入）
    ├── TabDouban.tsx                # 豆瓣 Tab（mock；本卡接入）
    ├── form-helpers.ts
    └── types.ts
```

#### 范围

**三 Tab 真实 API 接入（依赖 054/059 字段 + apps/api admin/videos GET 扩展）**：

1. **TabLines**（plan §6 + §7 — `LinesPanel.tsx` 同源逻辑参考）：
   - 接入 `GET /admin/videos/:id/sources`（含 probe_status / render_status / quality_detected / resolution_width/height / latency_ms / last_probed_at / last_rendered_at 等 054/059 字段）
   - 接入 `PATCH /admin/videos/:id/sources/:sourceId`（线路 toggle）
   - 接入 `POST /admin/videos/:id/sources/disable-dead`（批量禁 dead）
   - 接入 `POST /admin/videos/:id/refetch-sources`（重新抓取）
   - 显示：`[user_label] [1080P实测] {N}ms` + 线路证据展开（`source_health_events` 列表 / GET /admin/moderation/:id/line-health/:sourceId）
   - 失败回滚 + 乐观更新（参考 plan §5.0.3）

2. **TabImages**（plan §6）：
   - 接入 `GET /admin/videos/:id/images` + `PUT /admin/videos/:id/images`（CHG-SN-4-05 拆分新建路由 `apps/api/src/routes/admin/videoImages.ts`）
   - poster / backdrop / banner_backdrop / logo 4 类图片管理
   - 上传 + 替换 + 删除 + R2 fallback FS 兼容（已就位）

3. **TabDouban**（plan §6 + §7 — `ModerationConsole` douban 子流程同源）：
   - 接入 `POST /admin/videos/:id/douban-search`（CHG-SN-4-05 已上线）
   - 接入 `POST /admin/videos/:id/douban-confirm`
   - 接入 `POST /admin/videos/:id/douban-ignore`
   - 显示：豆瓣匹配状态 chip（待匹配/已匹配/候选/无匹配 — `douban_status` 精确值）
   - 候选项选择 + confirm 入库

**共性约束**（参考 plan §5.0 — 与 sn4-07 共享前端规范）：
- LoadingState / ErrorState 接线（§5.0.4）
- i18n key 命名 `admin.videos.edit.*`（§5.0.5；新建 i18n keys 文件 `apps/server-next/src/i18n/messages/zh-CN/videos-edit.ts`）
- a11y 焦点环 + Drawer focus trap（§5.0.6）
- 失败回滚 + 乐观更新（§5.0.3）

**Visual baseline**（plan §1202 / 1 张）：
- `tests/visual/admin-videos/video-edit-drawer-lines-tab.png`（线路 Tab 真实数据布局）

#### 文件作用域（不得越界）

```
apps/server-next/src/app/admin/videos/_client/VideoEditDrawer.tsx        # 主容器（如需扩展状态/loading）
apps/server-next/src/app/admin/videos/_client/_videoEdit/TabLines.tsx
apps/server-next/src/app/admin/videos/_client/_videoEdit/TabImages.tsx
apps/server-next/src/app/admin/videos/_client/_videoEdit/TabDouban.tsx
apps/server-next/src/app/admin/videos/_client/_videoEdit/types.ts        # 如需扩展 Drawer 类型
apps/server-next/src/app/admin/videos/_client/_videoEdit/form-helpers.ts # 如需新增 helper
apps/server-next/src/lib/videos/**                                        # 扩展；API 客户端 + 三 Tab hooks（按 ADR-110 §决策 4 feature 拆分）
apps/server-next/src/i18n/messages/zh-CN/videos-edit.ts                   # 新建；i18n keys
tests/unit/server-next/videos/video-edit-drawer/**                        # 新建
tests/visual/admin-videos/video-edit-drawer-lines-tab.png                 # 新建；1 张 visual baseline
docs/changelog.md                                                          # 追加 CHG-SN-4-08 条目
docs/tracks.md                                                             # 仅自己 sn4-08 区块（集成阶段更新）
```

**禁止触碰**（共享层冻结，违反即 BLOCKER）：
- `packages/admin-ui/**`（5 件下沉组件已就位；如必须新增组件 → BLOCKER）
- `packages/types/**`（ErrorCode 真源已统一；如需新类型 → BLOCKER 评估）
- `packages/design-tokens/**`
- `apps/api/**`（后端 API 已 freeze；如发现端点契约不足 → BLOCKER）
- `apps/worker/**`
- `apps/server-next/src/app/admin/moderation/**`（sn4-07 持有）
- `apps/server-next/src/lib/moderation/**`（sn4-07 可能新建）
- `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx`（**主列表不动；本卡仅扩展 Drawer 部分**）
- `apps/server-next/src/app/admin/videos/_client/_videoEdit/TabBasicInfo.tsx`（已接 API；本卡不动）
- `docs/decisions.md` / `docs/architecture.md`
- `docs/task-queue.md` Type B 字段（集成阶段串行）

#### 关键约束

- **零硬编码颜色**：CSS 变量；CI grep 守门
- **零硬编码中文文案**：全部 `t()` 调用；CI grep 守门
- **零业务越界**：不动 VideoListClient 主结构（VideoEditDrawer 是 modal 边界，本卡范围终止于此）
- **API 契约消费方**：所有错误响应通过 ApiError 信封解包（参考 ADR-110）；errorCode 字面量须命中 packages/types ERRORS 14 码
- **REVIEW_RACE / STATE_INVALID 处理**：toggleSource / refetch 等写操作的 409/422 必须有用户提示（不得静默吞错）

#### 质量门禁

```bash
npm run typecheck       # 全 8 workspace 零报错
npm run lint            # turbo lint 全 pass
npm run test -- --run   # 246+ 文件 / 3045+ 测试不回归
npm run test:e2e        # VIDEO 类 — **本卡内必跑 admin/videos 关键流回归**
```

**Visual diff 1 张**：`tests/visual/admin-videos/video-edit-drawer-lines-tab.png`

#### Step 表入口（具体 Step 由开发会话基于 plan §6 / §7 自行规划）

| Phase | 内容 | 依赖 | plan 引用 |
|---|---|---|---|
| A | 准备：lib/videos/ 扩展 API 客户端（线路 / 图片 / 豆瓣 hooks）+ i18n keys | 无 | ADR-110 + §5.0.4-5 |
| B | TabLines 真实 API 接入（含 toggle / disable-dead / refetch / line-health 展开 + BarSignal 头部 / 失败回滚） | A | §6 + §7 |
| C | TabImages 真实 API 接入（4 类图片 + 上传/替换/删除） | A | §6 + §7 |
| D | TabDouban 真实 API 接入（搜索 / 确认 / 忽略） | A | §6 + §7 |
| E | a11y + Drawer focus trap + visual baseline 1 张 + e2e admin/videos 关键流回归 | B-D | §5.0.6 |

#### 与 sn4-07 的协调点

- **共享层冻结**：双轨期内不动 packages/admin-ui / types
- **lib/api 客户端**：sn4-07 建 lib/moderation/，sn4-08 扩展 lib/videos/，路径不重叠
- **packages/types 错误码**：复用 ADR-110 已建 ERRORS / ErrorCode（13+1=14 码），双方都不改字典
- **i18n 命名空间隔离**：sn4-07 用 `admin.moderation.*`；sn4-08 用 `admin.videos.edit.*`
- **集成顺序**：任一先完成即先集成；docs/changelog.md 末尾追加冲突按上次 sn4-05/-06 经验手工合并

#### 集成

- 集成 PR 标题：`track(sn4-08-video-edit-drawer): CHG-SN-4-08 VideoEditDrawer 三 Tab 真实 API`
- PR 合并后：删除 `track/sn4-08-video-edit-drawer` 分支 / 更新 `docs/tracks.md` 本 Track 区块为 ✅ 已集成 / 本文件归档至 `docs/archive/tasks/`

---

## BLOCKER 区

> 本 Track 触发的 BLOCKER 写入此处（不写入主 docs/tasks.md / docs/task-queue.md）。
> 当前：无
