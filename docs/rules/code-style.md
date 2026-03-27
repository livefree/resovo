# Resovo（流光） — 代码风格规范

> status: active
> owner: @engineering
> scope: code style and engineering conventions
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 适用范围：所有 TypeScript 文件（前端和后端）
> AI 在编写任何代码前必须读取本文件

---

## 基本原则

- **明确优于隐式**：宁可多写几行，也要让意图清晰
- **每个函数只做一件事**：超过 40 行的函数考虑拆分
- **错误必须处理**：不得有 `catch (e) {}` 的空处理
- **类型必须明确**：不使用 `any`，用 `unknown` 替代

---

## TypeScript 规范

### 类型定义
```typescript
// ✅ 正确：在 types/ 目录或文件顶部定义类型
type VideoType = 'movie' | 'series' | 'anime' | 'variety'

interface Video {
  id: string
  shortId: string
  title: string
  type: VideoType
  // ...
}

// ❌ 错误：使用 any
function process(data: any) { ... }

// ✅ 正确：使用 unknown + 类型守卫
function process(data: unknown) {
  if (!isVideo(data)) throw new Error('Invalid video data')
  // ...
}
```

### 命名规范
```typescript
// 组件：PascalCase
export function VideoCard() { ... }

// 函数/变量：camelCase
const fetchVideoById = async (id: string) => { ... }

// 常量：SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT = 3

// 类型/接口：PascalCase
interface UserProfile { ... }
type SearchFilter = { ... }

// 文件名：
// 组件文件 → PascalCase.tsx（VideoCard.tsx）
// 工具/服务文件 → camelCase.ts（videoService.ts）
// 类型文件 → camelCase.types.ts（video.types.ts）
```

### 异步处理
```typescript
// ✅ 正确：使用 async/await + 明确错误处理
async function fetchVideo(id: string): Promise<Video> {
  try {
    const result = await db.query(...)
    if (!result) throw new NotFoundError(`Video ${id} not found`)
    return result
  } catch (error) {
    logger.error('fetchVideo failed', { id, error })
    throw error
  }
}

// ❌ 错误：裸 Promise chain
fetchVideo(id).then(v => ...).catch(e => console.log(e))
```

### 导入顺序
```typescript
// 1. Node 内置模块
import path from 'path'

// 2. 第三方库
import { FastifyInstance } from 'fastify'
import { z } from 'zod'

// 3. 内部模块（按层级从外到内）
import { VideoService } from '@/api/services/VideoService'
import { db } from '@/api/lib/postgres'

// 4. 类型导入（放最后）
import type { Video, VideoType } from '@/types/video.types'
```

---

## 项目约定

### 环境变量
```typescript
// ✅ 正确：通过 config 对象访问
import { config } from '@/api/lib/config'
const { databaseUrl } = config

// ❌ 错误：直接访问 process.env
const url = process.env.DATABASE_URL
```

### 日志
```typescript
// ✅ 使用 Fastify 内置 logger，不使用 console.log
request.log.info({ videoId: id }, 'Fetching video')
request.log.error({ error, videoId: id }, 'Failed to fetch video')

// ❌ 禁止在生产代码中使用 console.log
console.log('debug:', data)
```

### 常量管理
```typescript
// ✅ 集中管理在 src/lib/constants.ts
export const VIDEO_TYPES = ['movie', 'series', 'anime', 'variety'] as const
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
```

---

## 文件长度限制

| 文件类型 | 建议最大行数 | 超出时 |
|----------|-------------|--------|
| React 组件 | 200 行 | 拆分子组件 |
| Service 类 | 300 行 | 拆分职责 |
| API 路由文件 | 150 行 | 拆分子路由 |
| 工具函数文件 | 100 行 | 拆分为多文件 |

---

## Git Commit 规范

```
feat: 新功能
fix: Bug 修复
refactor: 重构（不影响功能）
docs: 文档更新
test: 测试相关
chore: 构建/配置相关

示例：
feat(player): add episode overlay with keyboard navigation
fix(search): correct director filter query parameter
docs(architecture): update videos table with new fields
```
