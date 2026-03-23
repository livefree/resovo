# Resovo（流光）— 后台管理结构重组设计

> **文档性质**：架构设计决策文档，非任务卡片。
> **创建时间**：2026-03-22
> **状态**：设计已定稿，待排入任务序列实施
> **背景**：当前"内容管理 / 系统管理"二分法粗粒度，语义模糊，且多个已有功能未挂载。本文档定义重组后的三层结构。

---

## 一、设计原则

1. **按处理对象分层**，而非按权限高低堆叠
2. 每层有明确的"谁用 / 处理什么 / 产出什么"
3. URL 路径与层级一一对应，Next.js 目录结构随之对齐
4. 角色访问控制（admin / moderator / operator）随分区自然对齐，不需要额外配置散点
5. 后端 API 路径前缀 `/admin/*` 保持不变，前端路由重组与 API 解耦

---

## 二、三层结构总览

```
/admin/
├── ops/          内容运营后台（Content Ops）
├── workflow/     审核与处理后台（Moderation Workflow）
└── system/       系统后台（System Admin）
```

---

## 三、各层详细设计

### 3.1 内容运营后台 `/admin/ops`

**使用者**：内容运营、编辑（operator 及以上）
**处理对象**：视频内容本身的生命周期管理

| 菜单项 | 路由 | 现有对应 | 说明 |
|--------|------|----------|------|
| 视频库 | `/admin/ops/videos` | `/admin/videos` | 列表/搜索/元数据/上下架/批量/豆瓣同步 |
| 播放源 | `/admin/ops/sources` | `/admin/sources` | 来源管理/软删除/批量清理 |
| 字幕库 | `/admin/ops/subtitles` | `/admin/subtitles` | 字幕列表与预览（审核操作归 workflow 层） |
| 数据导入 | `/admin/ops/import` | `/admin/system/migration` | JSON 批量导入播放源 |
| 豆瓣同步 | （视频详情内） | `PATCH /admin/videos/:id/douban-sync` | 不单独页面，在视频编辑表单中触发 |

**访问权限**：operator+（moderator 可只读）

---

### 3.2 审核与处理后台 `/admin/workflow`

**使用者**：审核员（moderator 及以上）
**处理对象**：需要人工决策的事项队列

| 菜单项 | 路由 | 现有对应 | 说明 |
|--------|------|----------|------|
| 内容审核 | `/admin/workflow/review` | `/admin/content`（空壳） | 待审视频队列（review_status=pending_review）；approve → visibility_status='public' |
| 投稿审核 | `/admin/workflow/submissions` | `/admin/submissions`（空壳） | 用户投稿 approve / reject |
| 字幕审核 | `/admin/workflow/subtitles` | `/admin/subtitles`（approve 部分） | 字幕质量 moderator 审核 |
| 用户举报 | `/admin/workflow/reports` | 无（缺口，需新建） | 举报单队列，处理结果联动视频可见性/用户封禁 |
| 用户处理 | `/admin/workflow/users` | `/admin/users`（封禁/解封部分） | 封禁/解封/权限变更（非系统级账户管理） |

**访问权限**：moderator+

**关键依赖**：`review_status` / `visibility_status`（Migration 016）已就绪，这层是目前最大的 UI 欠缺。

---

### 3.3 系统后台 `/admin/system`

**使用者**：管理员（admin only）
**处理对象**：平台基础设施，不涉及内容本身

| 菜单项 | 路由 | 现有对应 | 说明 |
|--------|------|----------|------|
| 采集控制台 | `/admin/system/crawler` | `/admin/crawler`（4-tab） | 站点/运行/日志/策略（已完整） |
| 账户管理 | `/admin/system/accounts` | `/admin/users`（完整列表） | 全量用户表 + 角色管理（区别于 workflow 的"用户处理"） |
| 数据看板 | `/admin/system/analytics` | `/admin/analytics` | 系统级统计与队列监控 |
| 性能监控 | `/admin/system/performance` | `/admin/performance` | API 延迟/队列积压 |
| 缓存管理 | `/admin/system/cache` | `/admin/cache` | Redis 手动清理 |
| 站点配置 | `/admin/system/settings` | `/admin/system/settings` | 全局开关/系统参数 |

**访问权限**：admin only

---

## 四、角色 × 分区访问矩阵

| 角色 | `/ops` | `/workflow` | `/system` |
|------|--------|-------------|-----------|
| **admin** | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| **moderator** | ✅ 只读 + 字幕 | ✅ 全部 | ❌ |
| **operator** | ✅ 全部 | ❌ | ❌ |
| **viewer** *(待扩充)* | ✅ 只读 | ❌ | ❌ |

> **注**：当前代码角色只有 `admin` / `moderator` / `user`，`operator` 和 `viewer` 是建议随业务扩充时新增的角色。

---

## 五、新侧边栏结构

```
流光后台
│
├── 📺 内容运营（operator+）
│   ├── 视频库
│   ├── 播放源
│   ├── 字幕库
│   └── 数据导入
│
├── ✅ 审核处理（moderator+）          ← 当前最大 UI 缺口
│   ├── 内容审核队列
│   ├── 投稿审核
│   ├── 字幕审核
│   ├── 用户举报
│   └── 用户处理
│
└── ⚙️ 系统管理（admin only）
    ├── 采集控制台
    ├── 账户管理
    ├── 数据看板
    ├── 性能监控
    ├── 缓存管理
    └── 站点配置
```

---

## 六、迁移影响评估

### 低代价（可立即做）

| 改动 | 文件 | 说明 |
|------|------|------|
| 侧边栏重组 | `AdminSidebar.tsx` | 重新分组现有条目，加入未挂载模块 |
| 旧路径 redirect | 各 page.tsx | `redirect('/admin/ops/videos')` 等，防止旧书签失效 |
| layout 分层 | `src/app/[locale]/admin/` 目录 | 新增 `ops/` `workflow/` 子目录 |

### 中代价（需要新页面）

| 改动 | 说明 |
|------|------|
| `/admin/workflow/review` | 接通 `review_status=pending_review` 队列，approve/reject 操作联动 visibility_status；schema 已就绪 |
| `/admin/workflow/submissions` | 已有 API（`/admin/submissions`），需要新建 UI 页面 |
| `/admin/workflow/subtitles` | 已有 API（`/admin/subtitles`），需要拆出 moderator 审核视图 |

### 不需要改动

| 项目 | 原因 |
|------|------|
| 后端 API 路径 | 全部保持 `/admin/*`，前端路由与 API 解耦 |
| 鉴权逻辑 | `authenticate + requireRole` 已有，按分区配置即可 |
| 数据库 | 所有字段已就绪（Migration 013–018） |
| 测试 | API 测试不依赖前端路由，无需修改 |

---

## 七、实施优先级建议

| 优先级 | 任务 | 理由 |
|--------|------|------|
| P0 | 侧边栏重组 + 目录迁移 + 旧路径 redirect | 纯结构调整，零风险，立即消除混乱 |
| P1 | `/workflow/review` 内容审核队列 | Migration 016 字段已就绪，功能价值最高 |
| P2 | `/workflow/submissions` + `/workflow/subtitles` | API 已有，只差 UI |
| P3 | `operator` 角色扩充 | 按业务实际需要决定时机 |
| P4 | `/workflow/reports` 用户举报 | 需新建 API + schema + UI |
