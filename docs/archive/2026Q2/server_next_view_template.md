# server-next 视图模块开发模板

> 任务卡：DEBT-SN-3-A（M-SN-3 欠账，CHG-SN-4-10-A 落地）
> 真源：M-SN-3 / M-SN-4 已实装的 admin 视图模块（VideoListClient / ModerationConsole / VideoEditDrawer）
> 适用：`apps/server-next/src/app/admin/<module>/` 新视图开发的脚手架与组织规范

## 1. 任务卡卡头模板

新视图任务卡（写入 `docs/tasks.md`）参照下方填空：

```markdown
### CHG-SN-X-NN · <模块名> 视图实装

- **状态**：🚧 进行中
- **创建时间**：YYYY-MM-DD
- **执行模型**：claude-<opus|sonnet|haiku>-<version>（完整 ID）
- **来源**：<plan 文档路径> §X.Y
- **依赖**：<上游卡片 ID>

#### 交付物
- `apps/server-next/src/app/admin/<module>/page.tsx`
- `apps/server-next/src/app/admin/<module>/_client/<ModuleName>Client.tsx`
- `apps/server-next/src/lib/<module>/{api,types,use-xxx}.ts`
- `tests/unit/components/server-next/admin/<module>/<ModuleName>Client.test.tsx`
- visual baseline：`tests/visual/<module>/*.png`（如需）

#### 完成判据
- ✅ typecheck / lint
- ✅ unit test（覆盖关键交互 + i18n + a11y）
- ✅ tokens:validate / verify-token-references
- ✅ 浏览器实测核心路径

#### 子代理调用
- 共享组件 API 契约设计 → 强制 arch-reviewer (claude-opus-4-7)
- 模板化文档 / 归档 → 可选 doc-janitor (claude-haiku-4-5)
```

## 2. 视图骨架（page.tsx + _client/）

### 2.1 page.tsx（Server Component，最小化）

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { <ModuleName>Client } from './_client/<ModuleName>Client'

export const metadata: Metadata = {
  title: '<模块标题> | Resovo Admin',
}

export default function <ModuleName>Page() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <<ModuleName>Client />
    </Suspense>
  )
}
```

**约束**：
- page.tsx **不写业务逻辑**，仅装配 Client 组件 + Suspense + metadata
- metadata.title 格式：`<中文模块名> | Resovo Admin`
- 不直接 import `_client/` 之外的 React 组件（边界清晰）

### 2.2 `_client/` 子目录组织

```
admin/<module>/
├── page.tsx                          # Server Component 入口
└── _client/
    ├── <ModuleName>Client.tsx        # 主 'use client' 容器
    ├── <ModuleName>RowActions.tsx    # 行级操作（如有）
    ├── <ModuleName>FilterFields.tsx  # 筛选字段（如有）
    ├── <SubFeature>Drawer.tsx        # Drawer / Modal 子组件（如有）
    ├── _<subfeature>/                # 子目录承载子模块的内部拆分
    │   ├── types.ts
    │   ├── TabA.tsx
    │   └── TabB.tsx
    └── mock-data.ts                  # 仅开发期占位，cutover 前清零
```

**约束**：
- `_client/` 下层级约束：单层文件 + 必要时 `_<subfeature>/` 一级子目录（不嵌套 2+ 层）
- `mock-data.ts` 开发期允许，**正式上线前必须删除**（M-SN-4 + CHG-SN-4-07/08 已示范 mock → real API 切换）
- 客户端文件首行必须 `'use client'`

## 3. 数据接入

### 3.1 API 层（`apps/server-next/src/lib/<module>/api.ts`）

```ts
// 标准模板：所有 fetch 走 lib/api-client（不直接 fetch）
import { apiClient } from '@/lib/api-client'
import type { <ModuleItem>, <ModuleListQuery> } from './types'

export async function list<Module>(query: <ModuleListQuery>) {
  return apiClient.get<{ data: <ModuleItem>[]; total: number }>(`/v1/admin/<module>`, { query })
}

export async function patch<Module>(id: string, body: Partial<<ModuleItem>>) {
  return apiClient.patch<{ data: <ModuleItem> }>(`/v1/admin/<module>/${id}`, body)
}
```

**约束**：
- 不在客户端代码直接 `fetch()` —— 必须用 `apiClient`（`@/lib/api-client`）
- types 单独抽到 `<module>/types.ts`，re-export 自 `@resovo/types`（如已定义）
- 命名约定：`list<Module>` / `get<Module>` / `patch<Module>` / `delete<Module>`

### 3.2 useTableQuery（列表型视图）

参考 `VideoListClient.tsx:440`、CHG-SN-4-07 审核台 plan §5.0.1：

```tsx
const { snapshot, patch } = useTableQuery({
  storageKey: '<module>-list.v1',  // 点分小写，bump v1 → v2 走破坏性升级
  defaults: {
    sort: { field: 'created_at', direction: 'desc' as const },
    page: { page: 1, limit: 20 },
    filters: {},
    columns: { /* 列可见性默认 */ },
  },
})
```

**约束**：
- `storageKey` 命名规范：`<module>-<view>.v<N>`（plan §5.0.1 D-13 决策）
- defaults 必须显式给全（防 SSR-mismatch）
- columns 字段是**完全替换**语义（applyPatch.columns 不 merge）

### 3.3 SWR / useSWR（详情型 + 子资源）

参考 `lib/videos/use-sources.ts` / `use-images.ts` / `use-douban.ts`：

```tsx
import useSWR from 'swr'
import { listSources } from './api'

export function useSources(videoId: string) {
  return useSWR(
    videoId ? ['sources', videoId] : null,
    () => listSources(videoId),
  )
}
```

**约束**：
- key 模式：`[<resource>, <id>, ...filters]` 数组（避免字符串拼接）
- `null` 短路：必填参数缺失时禁止请求

### 3.4 mock-data.ts → 真实 API 切换路径

CHG-SN-4-07 示范：
1. 开发期：`_client/mock-data.ts` 提供 mock fixture，Client 组件 `import { MOCK_LIST } from './mock-data'`
2. 接入期：在 `Client.tsx` 把 `MOCK_LIST` 替换为 `useSWR(...)` / `useTableQuery(...)`
3. 清理期：删除 `mock-data.ts` + 相关 import + grep 验证 0 命中

## 4. 测试模板

### 4.1 unit test 骨架

`tests/unit/components/server-next/admin/<module>/<ModuleName>Client.test.tsx`：

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

afterEach(() => cleanup())

describe('<ModuleName>Client — 渲染与基础交互', () => {
  it('LoadingState → ErrorState / EmptyState 三态', () => { /* ... */ })
  it('useTableQuery 初始默认值正确', () => { /* ... */ })
  it('行级 onClick 触发 navigate / drawer', () => { /* ... */ })
})

describe('<ModuleName>Client — i18n', () => {
  it('全部用户可见文案走 i18n key（无硬编码中文）', () => { /* ... */ })
})

describe('<ModuleName>Client — a11y', () => {
  it('表格 role="grid" + 行 role="row" + 单元格 role="cell"', () => { /* ... */ })
  it('键盘流 J/K/Enter 可达', () => { /* ... */ })
})
```

### 4.2 visual baseline（Playwright `toHaveScreenshot()`）

`tests/visual/<module>/<scenario>.png`（M-SN-4 期 visual harness 在 DEBT-SN-4-A 收口阶段建立）：

- 命名：`<module>-<scenario>.png`（如 `moderation-pending-list.png`）
- baseline 落 git；`tests/visual/.gitignore` 排除 `*-actual.png` / `*-diff.png`
- CI 与本地差异容忍：`maxDiffPixelRatio: 0.01`（待 DEBT-SN-4-A 确认）

### 4.3 e2e 测试（关键路径）

参考 plan v1.4 §11.1：`tests/e2e-next/admin/<module>/<flow>.spec.ts`

```ts
import { test, expect } from '@playwright/test'

test.describe('admin <module> 黄金路径', () => {
  test('<flow 名称>', async ({ page }) => {
    await page.goto('/admin/<module>')
    // ... 状态机正向路径
    await expect(page.getByRole('row', { name: /.../ })).toBeVisible()
  })
})
```

**约束**：
- 必须覆盖至少 1 条黄金路径（业务关键状态机）
- e2e 不 mock API，跑真实后端（CI 启 docker-compose 起 db + api）

## 5. 国际化 + a11y 强约束

### 5.1 i18n（plan §5.0.5）

- 所有用户可见字符串走 i18n key：`apps/server-next/src/i18n/messages/zh-CN/<module>.ts`
- 命名约定：`<module>.<feature>.<key>`（如 `videos.actions.delete`）
- **零硬编码中文**（CHG-SN-4-09a 修复 -07 期 ~15 处违规为示警）

### 5.2 a11y（plan §5.0.4）

- `role="grid"` / `role="row"` / `role="cell"` 完整链
- 键盘流：J/K（行间）/ Enter（确认）/ Esc（关闭 drawer）/ A/R/S（业务快捷键）
- focus-visible 兜底（admin-shell 已注入全局规则，无需重复设）

## 6. 共享组件优先约束

- 所有 UI 元素**先查** `packages/admin-ui/src/components/` 是否有等价 — 有则直接 import
- 已有可复用：DataTable / Drawer / Thumb / Pill / DualSignal / DecisionCard / RejectModal / LineHealthDrawer / KpiCard / SplitPane / LoadingState / ErrorState / EmptyState 等
- 新建共享组件 → 必须 spawn arch-reviewer (claude-opus-4-7) 评审 Props 契约（CLAUDE.md "强制升 Opus 子代理"#1）

## 7. CSS 与 token 严禁

- ❌ 硬编码颜色（必须 `var(--*)`）
- ❌ 裸值 padding / fontSize（必须 `var(--<scope>-padding-<axis>)` / `var(--font-size-*)`）
- ❌ 跳过 token 层直接改业务文件
- ✅ admin-layout/spacing 真源（page / section / list-row / card / toolbar / foot / panel / button-x）
- 详见 ADR-113 / ADR-111 / ADR-112

## 8. 任务卡 lifecycle

```
📝 待开工 → 写入 task-queue.md（候选池）
       ↓
🚧 进行中 → 写入 tasks.md（卡片，开工时填）
       ↓
✅ 已完成 → tasks.md 删除卡片 + task-queue.md 状态更新 + changelog.md 追加 + git commit
```

每个卡片完成必须：
1. typecheck / lint / unit test 全绿
2. 关键路径浏览器实测（UI 任务）
3. arch-reviewer 子代理评审（共享组件 / ADR 类）
4. 记录主循环模型 + 子代理模型到卡片"执行模型"/"子代理调用"字段
5. commit message 含 `Executed-By` + `Co-Authored-By` trailer

---

> 本模板由 CHG-SN-4-10-A 落地，参考 M-SN-4 期已实装 3 个标杆模块。
> 后续视图模块新建时**必须**对照本模板检查 8 个章节覆盖度。
> 模板演进：发现遗漏的最佳实践 → 在对应章节追加，commit message 标注 `chore(template): ...`。
