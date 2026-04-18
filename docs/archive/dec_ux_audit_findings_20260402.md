# 审计收敛计划：DEC/UX 风险修复序列（修订版）

> status: archived
> owner: @engineering
> scope: DEC/UX audit risk remediation plan
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-02

> 目标：根据 `dec_ux_audit_findings_20260402.md` 的审计发现，系统性收敛 SEQ-20260402-50/51 的遗留风险与验收偏差
> 日期：2026-04-02（修订：用户复核意见已合入）
> 触发原因：任务台账标记"已完成"，但实测体感变化不大，审计确认 DEC 完成度约 75%、UX 约 45%

---

## Context

DEC（前后台解耦）和 UX（后台交互改造）两个序列在 task-queue.md 中均标记 ✅ 已完成，但存在三类系统性偏差：

1. **关键改动未在默认路径生效**：视频管理 v2 操作区藏在 localStorage flag 后，绝大多数管理员看不到
2. **落点偏移**：审核页改造落在 `/admin/content/submissions`，但实际运营入口是 `/admin/moderation`
3. **链路断裂**：后台会话失效后重定向到已下线的 `/auth/login`（404），后台首页 analytics SSR 使用 `x-internal-secret` 绕过鉴权（长期失败风险）

执行顺序按审计建议：P0 → P1 → P2 → P3（台账一致性）。

---

## 任务序列（新建 CHG-337 起）

### P0 — 立即修复（链路断裂，影响可用性）

#### CHG-337 — 修复 api-client.ts 401 重定向目标

**问题**：`getLoginRedirectPath()` 在管理员会话失效后仍指向 `/${locale}/auth/login`，该路由已下线（404）。

**文件**：`src/lib/api-client.ts`

**改动**：

1. `line 61`：guard 从 `pathname.includes('/auth/login')` 改为 `pathname.includes('/admin/login')`（防止重定向到新登录页后再次 401 形成循环）
2. `line 70`：返回值 `/${locale}/auth/login?callbackUrl=...` 改为 `/${locale}/admin/login?callbackUrl=...`

**验收**：后台页面 401 后跳转到 `/[locale]/admin/login`，不再到 404。

---

#### CHG-338 — 修复后台首页 analytics SSR 鉴权

**问题**：`src/app/[locale]/admin/page.tsx` 用 `x-internal-secret` 绕过鉴权拉取 analytics，但 `/admin/analytics` 端点要求 `authenticate + requireRole(['admin'])`，`x-internal-secret` 已无效，首页长期显示"数据加载失败"。

**根因**：Server Component 无法访问客户端 Bearer token，SSR prefetch（CHG-25 优化）与当前鉴权模型不兼容。

**文件**：

- `src/app/[locale]/admin/page.tsx`
- `src/components/admin/dashboard/AnalyticsCards.tsx`

**组件现状**（需改造）：

- `AnalyticsCards` 当前：`initialData: AnalyticsData`（必填），`useState<AnalyticsData>(initialData)`
- 已有 `apiClient.getAnalytics()` 用于 30 秒轮询（`line 67-68`）

**方案**：

1. `AnalyticsCards.tsx`：
   - `initialData` 改为 `initialData?: AnalyticsData | null`
   - `useState<AnalyticsData | null>(initialData ?? null)`
   - 在 `useEffect` 中增加首屏 fetch（`initialData` 为 null 时立即拉数，不等待 30 秒轮询）
   - 组件内处理 null data 的骨架屏 loading 状态
2. `admin/page.tsx`（Server Component）：
   - 删除 `fetchAnalytics()` 函数及 `x-internal-secret` 调用
   - 传 `<AnalyticsCards />` 时不再传 `initialData`（或传 `initialData={null}`）

**注意**：`x-internal-secret` 模式是安全反模式，此次修复后禁止在任何路由复用。

**验收**：登录后访问 `/admin`，数据看板可正常展示统计数据，首屏有 loading 骨架，30 秒后自动刷新。

---

### P1 — 高优先级（验收偏差，影响核心功能体感）

#### CHG-339 — 去除视频管理 v2 灰度开关，默认启用

**问题**：`useVideoOpsV2Flag()` 读取 `localStorage('admin_video_ops_v2')`，默认 false，绝大多数管理员仍看旧版操作下拉。灰度窗口（2 周）已过。

**文件**：`src/components/admin/videos/useVideoTableColumns.tsx`，`src/components/admin/videos/VideoTable.tsx`

**改动**：

1. 删除 `useVideoOpsV2Flag()` hook（`line 305-313`）
2. 删除旧版 actions cell 代码（`line 260-288`，`AdminDropdown` + 快速/完整编辑下拉）
3. 清理 `ColumnDeps` 中的 `videoOpsV2` 字段及所有调用处
4. 清理 `VideoTable.tsx` 中对 `useVideoOpsV2Flag` 的调用

**验收**：视频管理表格默认展示新版操作区（编辑/前台详情/前台播放/上下架按钮），无"操作▾"下拉。

---

#### CHG-340 — visibility 从 2 态开关改为 3 态选择控件

**问题**：`visibility_status` 有 `public / internal / hidden` 三态，但当前单元格用 `TableSwitchCell`（二态），`internal` 和 `hidden` 的区别被抹平。

**文件**：`src/components/admin/videos/useVideoTableColumns.tsx`（`line 186-197`，`visibility` case）

**API 字段确认**：`PATCH /admin/videos/:id/visibility` 的 schema 为 `VisibilitySchema = z.object({ visibility: z.enum(['public', 'internal', 'hidden']) })`，前端传 `{ visibility: ... }`，**不是** `visibility_status`。

**改动**：

1. 替换 `TableSwitchCell` 为三态 select 控件（如现有 `TableSelectCell` 可复用则优先复用，否则内联 `<select>`）
2. 选项：`public → 公开` / `internal → 内部` / `hidden → 隐藏`
3. `deps.handleVisibilityToggle` 签名改为接受 `'public' | 'internal' | 'hidden'`，内部 PATCH body 传 `{ visibility: newValue }`
4. `visibilityPendingIds` 逻辑保持不变（disable 操作中的行）
5. `TableSwitchCell` 在 `is_published` 等其他列保持不变

**验收**：visibility 列为三选一下拉，选择"内部"后 API 收到 `{ visibility: 'internal' }`，页面正确回显。

---

#### CHG-341 — 审核台（/admin/moderation）补齐过滤、排序、多源播放器

**问题**：

1. `ModerationList.tsx` 只有 page/limit，无类型筛选和排序
2. `ModerationDetail.tsx` 只取 1 条 source（`limit=1`），无法多源对比
3. `getTypeLabel()` 内仍有 `tv` 映射（应为 `series`），与全链路类型标准不一致

**文件**：

- `src/components/admin/moderation/ModerationList.tsx`
- `src/components/admin/moderation/ModerationDetail.tsx`
- `src/api/routes/admin/videos.ts`（`GET /admin/videos/pending-review` 路由）

**ModerationList 改动**：

1. 修正 `getTypeLabel()` 中 `tv` → `series`，补充其余类型标签（参照 `VideoMetaSchema` 全类型枚举：movie/series/anime/variety/documentary/short/sports/music/news/kids/other）
2. 列表头增加"类型"筛选 select（使用相同枚举值，空值表示全部）
3. 增加"排序"按钮（最新优先/最早优先，对应 `sortDir: desc|asc`）
4. 筛选/排序变更时重置 page 到 1

**ModerationDetail 改动**：

1. sources 请求改为 `limit=10`（不再只取 1 条）
2. 增加 source 选择器 UI（简单 select 或编号按钮组），展示"当前 N / 共 M 条"
3. 切换 source 时更新播放器 src

**后端改动（三层必须同步）**：

1. `src/api/routes/admin/videos.ts`：`GET /admin/videos/pending-review` 增加 `type` 和 `sortDir` 可选参数并解析
2. 对应 Service 方法（`videoService.pendingReviewList` 或同名函数）：接收并透传 `type`/`sortDir`
3. 对应 DB query 层（`src/api/db/queries/videos.ts` 中 `pendingReviewList` 或同名函数）：SQL WHERE 条件增加 `type` 过滤，ORDER BY 支持 `sortDir`
   - 需确认 SQL 已有参数化过滤机制（参照 `listAdminUsers` 的动态 WHERE 模式）

**注意**：三层（Route → Service → Query）必须同步改动，只改路由层不改 SQL 等于无效。

**验收**：审核台可按类型筛选、按时间排序；右侧播放器可切换多个 source；`series` 类型标签正确显示"剧集"而非 `tv`。

---

#### CHG-342 — 统一视频类型选项（AdminVideoForm 对齐 API Schema）

**问题**：`AdminVideoForm.tsx` 编辑表单只有 movie/series/anime/variety 4 类（`line 253-257`），但 `VideoMetaSchema` 已支持 11 类（movie/series/anime/variety/documentary/short/sports/music/news/kids/other），编辑会将新类型回写为旧分类。

**文件**：`src/components/admin/AdminVideoForm.tsx`

**改动**：

1. type select 选项对齐 `VideoMetaSchema` 全量枚举（11 类）
2. 对应中文标签完整映射（参照 CHG-341 中 `getTypeLabel()` 更新后的版本）

**验收**：编辑表单类型下拉与筛选层一致，含 documentary/short 等类型，不会出现"选不到正确类型"。

---

#### CHG-343 — robots.txt 基于 routing.locales 动态生成多语言屏蔽路径

**问题**：`src/app/robots.ts` 只 disallow `/admin/` 和 `/auth/`，实际路由 `/${locale}/admin/*` 未被覆盖。

**文件**：`src/app/robots.ts`

**改动**：动态读取 `routing.locales`（来自 `src/i18n/routing.ts`，当前值 `['en', 'zh-CN']`）生成 disallow 列表，避免未来新增语言时遗漏：

```typescript
import { routing } from '@/i18n/routing'

export default function robots(): MetadataRoute.Robots {
  const localizedPaths = routing.locales.flatMap((locale) => [
    `/${locale}/admin/`,
    `/${locale}/auth/`,
  ])
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/auth/', ...localizedPaths],
      },
    ],
  }
}
```

**验收**：访问 `/robots.txt`，disallow 包含 `/admin/`、`/auth/`、`/en/admin/`、`/en/auth/`、`/zh-CN/admin/`、`/zh-CN/auth/`。

---

### P2 — 中优先级（清尾，改善一致性）

#### CHG-344 — 全量迁移剩余局部 toast 到全局 notify

**问题**：`AdminToastHost` 已上线（位于页面**右下角** `fixed bottom-6 right-6`），但多个文件仍使用旧局部 toast：

- `src/components/admin/system/config-file/ConfigFileEditor.tsx`（`line 33-39`）
- `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx`（`line 11`）
- 可能还有其他文件

**全局 toast 正确用法**：

```typescript
import { notify } from '@/components/admin/shared/toast/useAdminToast'
// 使用：
notify.success('操作成功')
notify.error('操作失败')
```

注意：`useAdminToast.ts` 导出的是 `notify` 对象和 `useAdminToastStore`，**没有** `useAdminToast()` hook，迁移时统一改用 `notify.success/error/warn/info()`。

**改动**：

1. `Grep` 全量扫描 `src/components/admin/**/*.tsx` 中的旧 toast 引用（非 `shared/toast` 路径）
2. 逐文件替换为 `notify.*` 调用，删除旧 toast 组件引用
3. 迁移完成后，**删除** `src/components/admin/shared/feedback/useAdminToast.ts`（若存在），防止被误用回潮；若该文件有其他导出需保留，改为在文件顶部加 `@deprecated` 注释并移除所有旧 toast 实现

**验收**：执行保存/删除等操作，toast 出现在页面**右下角**（全局位置），无任何组件内局部 toast；`src/components/admin/shared/feedback/` 中无可用的旧 toast hook。

---

### P3 — 治理（台账与文档一致性）

#### CHG-345 — 台账/文档一致性收敛 + ESLint no-restricted-imports 升级为 error

**问题**：

1. `docs/task-queue.md` 中 SEQ-20260402-50/51 存在时间戳倒序，影响审计可信度
2. `docs/admin_console_decoupling_and_ux_plan_20260402.md` 内存在"已撤销项"与"旧风险描述"并存（语义冲突）
3. `no-restricted-imports`（禁止前端 import `@/api/**`）当前为 `warn` 模式，DEC 序列已清零违规——应升级为 `error`，防止后续回潮

**文件**：

- `docs/task-queue.md`
- `docs/admin_console_decoupling_and_ux_plan_20260402.md`
- `.eslintrc.json`（或 `eslint.config.mjs`，视项目实际配置文件）

**改动**：

1. 修正 task-queue.md 中倒序时间戳（在时间戳后补注 `[已修正]`，保留原始记录）
2. 在方案文档中将"已撤销"决策（如 `video_sources.site_key` 回填）标注为 `~~已撤销~~`，保留原文供审计追溯
3. 为 CHG-337~344 在 task-queue.md 追加新任务序列条目
4. 将 `no-restricted-imports` 规则中针对 `@/api/**` 的配置从 `warn` 改为 `error`
   - 升级前先运行 `npm run lint` 确认零违规（若有残留必须先修复，不可直接升级）

**验收**：

- task-queue.md 无倒序时间戳；方案文档无未标注的语义冲突
- CHG-337~344 均有台账记录
- `npm run lint` 通过且 `@/api/**` 规则已为 `error`
- 故意在前端写一行 `import { db } from '@/api/lib/postgres'`，lint 应报 error 而非 warn

---

## 执行顺序

```
CHG-337（P0：redirect 链路修复）
    ↓
CHG-338（P0：analytics SSR 鉴权修复 + AnalyticsCards 契约改造）
    ↓
CHG-339（P1：v2 操作区默认开启 + 旧代码删除）
    ↓
CHG-340（P1：三态 visibility 控件，API 字段用 visibility）
    ↓
CHG-341（P1：审核台过滤/排序/多源 + tv→series 清理）
    ↓
CHG-342（P1：视频类型选项对齐 API Schema 全量）
    ↓
CHG-343（P1：robots.txt 动态多语言屏蔽）
    ↓
CHG-344（P2：局部 toast → notify 全量迁移，验收位置：右下角）
    ↓
CHG-345（P3：台账与文档一致性收敛）
```

---

## 关键文件索引

| 任务    | 文件                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-337 | `src/lib/api-client.ts`（line 61, 70）                                                                                                      |
| CHG-338 | `src/app/[locale]/admin/page.tsx`，`src/components/admin/dashboard/AnalyticsCards.tsx`                                                      |
| CHG-339 | `src/components/admin/videos/useVideoTableColumns.tsx`（line 260-313），`VideoTable.tsx`                                                    |
| CHG-340 | `src/components/admin/videos/useVideoTableColumns.tsx`（line 186-197），API 字段：`visibility`                                              |
| CHG-341 | `src/components/admin/moderation/ModerationList.tsx`，`ModerationDetail.tsx`，`src/api/routes/admin/videos.ts`，对应 Service 与 DB query 层 |
| CHG-342 | `src/components/admin/AdminVideoForm.tsx`（line 253-257）                                                                                   |
| CHG-343 | `src/app/robots.ts`，`src/i18n/routing.ts`（只读，取 locales）                                                                              |
| CHG-344 | `src/components/admin/system/config-file/ConfigFileEditor.tsx`，`CrawlerSiteManager.tsx`，及全量扫描                                        |
| CHG-345 | `docs/task-queue.md`，`docs/admin_console_decoupling_and_ux_plan_20260402.md`，`.eslintrc.json`                                             |

---

## 验收检查表

| 任务    | 验收点                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------- |
| CHG-337 | 清空 token，访问 `/admin/*` 路径，跳转 `/[locale]/admin/login` 非 404                                   |
| CHG-338 | 登录后访问 `/admin`，数据看板展示数据（首屏骨架，30 秒刷新）                                            |
| CHG-339 | `/admin/videos` 列表行操作为图标按钮，无"操作▾"下拉                                                     |
| CHG-340 | visibility 列为三选一下拉；选"内部"后 API body 含 `{ visibility: "internal" }`                          |
| CHG-341 | 审核台左侧有类型筛选/排序；右侧播放器有 source 切换；"剧集"标签正确                                     |
| CHG-342 | 视频编辑表单 type 下拉含 11 类，含 documentary/short/sports 等                                          |
| CHG-343 | `/robots.txt` disallow 含 `/en/admin/`、`/zh-CN/admin/` 等多语言路径                                    |
| CHG-344 | 保存操作后 toast 出现在**右下角**；无组件内局部 toast；`shared/feedback/useAdminToast.ts` 已删除或废弃  |
| CHG-345 | task-queue.md 无时间戳倒序；方案文档无语义冲突；lint 中 `@/api/**` 为 error；故意违规时 lint 报错不通过 |

---

## 设计约束说明

- **CHG-338**：方案选"客户端拉数"不选"新建内部路由"，理由：后者引入更多可绕过鉴权的后门，前者符合已有 apiClient 认证模型。`AnalyticsCards` 已有 `apiClient.getAnalytics()` 轮询能力，改造成本低。
- **CHG-340**：API 字段名是 `visibility`（`VisibilitySchema`），前端 `handleVisibilityToggle` 需同步改名或调整内部 body 构造，确保不再传 `visibility_status`。
- **CHG-341**：`tv` 映射是历史遗留，应在此任务统一清理；类型枚举以 `VideoMetaSchema` 为权威来源（11 类）。
- **CHG-343**：动态生成方案依赖 `routing.locales`，新增语言时无需手动维护 robots.ts。
- **CHG-344**：`useAdminToast.ts` 无 hook，只有 `notify` 对象，迁移时不得导入不存在的 `useAdminToast()`。迁移完成后必须删除或废弃 `shared/feedback/useAdminToast.ts`（封口旧实现），否则后续误引用会导致新旧并存回潮。
- **CHG-345**：升级 lint error 前必须确认零违规（`npm run lint` 无 warn），否则升级会使 CI 立即失败。
