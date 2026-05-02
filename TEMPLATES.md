# Resovo（流光） — 代码模板使用指南

> AI 在创建新文件时，**必须优先使用模板**，而不是从空文件开始。
> 模板消除了样板代码的重复决策，减少 token 消耗，保证结构一致性。

---

## 模板文件位置

```
src/
├── components/templates/
│   ├── Component.template.tsx   ← React 客户端组件
│   ├── Page.template.tsx        ← Next.js 页面（SSR）
│   └── Store.template.ts        ← Zustand Store
└── api/templates/
    ├── route.template.ts        ← Fastify 路由
    ├── service.template.ts      ← Service 业务层
    └── queries.template.ts      ← 数据库查询层
```

---

## 使用流程（AI 必须遵守）

1. 确定要创建的文件类型
2. 找到对应模板文件，**复制内容**到目标路径
3. 替换所有 `[占位符]`（如 `[ComponentName]`、`[resource]`）
4. 填充所有标注 `// TODO:` 的位置
5. 删除所有注释（包括 TODO 注释）后提交

---

## 占位符替换规则

| 占位符 | 替换规则 | 示例 |
|--------|---------|------|
| `[ComponentName]` | PascalCase 组件名 | `VideoCard` |
| `[component-name]` | kebab-case，用于翻译 namespace | `video-card` |
| `[Resource]` | PascalCase 资源名 | `Video` |
| `[resource]` | camelCase 或 lowercase | `video` |
| `[resource]s` | 资源复数形式（表名/路由） | `videos` |
| `[Name]` | Store 名称 PascalCase | `Player` |
| `[name]` | Store 名称 camelCase | `player` |
| `[page-name]` | 页面标识 kebab-case | `search` |
| `[PageName]` | 页面名称 PascalCase | `Search` |

---

## 各模板适用场景

### Component.template.tsx
适用于：所有 `src/components/` 下的客户端组件
- VideoCard、FilterBar、MetaChip、DanmakuBar 等
- 包含 state、事件处理、条件渲染的组件

### Page.template.tsx
适用于：所有 `src/app/[locale]/` 下的页面文件
- 包含 generateMetadata（SSR SEO）
- 包含 Suspense 边界

### Store.template.ts
适用于：所有 `src/stores/` 下的状态文件
- playerStore、authStore、themeStore 等
- 包含选择器函数，避免不必要的重渲染

### route.template.ts
适用于：所有 `src/api/routes/` 下的路由文件
- 包含完整的 CRUD 路由结构
- 包含 Zod schema 验证和认证中间件

### service.template.ts
适用于：所有 `src/api/services/` 下的 Service 文件
- 只含业务逻辑，不直接写 SQL
- 包含 Redis 缓存的注释示例

### queries.template.ts
适用于：所有 `src/api/db/queries/` 下的查询文件
- 只含参数化 SQL，不含业务逻辑
- 包含动态 WHERE 条件构建模式

---

## Worker 模板（apps/worker）

### Cron Job

适用于：`apps/worker/src/jobs/` 下的 cron 任务函数

```typescript
// [job-name].ts
import type { Pool } from 'pg'
import type pino from 'pino'

export async function run[JobName](pool: Pool, log: pino.Logger): Promise<void> {
  // 1. load data
  // 2. process
  // 3. write results
}
```

### Parser（无外依赖）

适用于：`apps/worker/src/lib/parsers/` 下的格式解析

```typescript
export type [Format]ParseResult = { /* fields */ }

export function parse[Format](input: string | Buffer): [Format]ParseResult {
  // pure function, no side effects, no dependencies
}
```

### Circuit Breaker 消费

```typescript
import { shouldSkipSite, recordFailure, recordSuccess } from '../../lib/circuit-breaker'

if (shouldSkipSite(siteId)) {
  // skip and log
  return
}
try {
  // do work
  recordSuccess(siteId)
} catch (err) {
  recordFailure(siteId)
  throw err
}
```

---

## 不使用模板的情形

以下情形可以不使用模板，直接编写：
- 类型定义文件（`*.types.ts`）
- 工具函数文件（`src/lib/utils.ts` 等）
- 配置文件（`config.ts`、`postgres.ts` 等）
- 数据库迁移 SQL 文件
