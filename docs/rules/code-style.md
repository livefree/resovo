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
- **每个函数只做一件事**：满足以下任一条件必须拆分（见 CLAUDE.md 绝对禁止清单）：(1) 包含 2 个以上独立逻辑阶段；(2) 嵌套层数达到 3 层；(3) 超过 80 行且非纯声明性结构
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

## 文件职责约束

文件拆分的判断依据是**职责边界**，而非行数。各文件类型的硬约束：

| 文件类型 | 唯一职责约束 |
|---------|-------------|
| React 组件 | 只导出一个主组件；可复用的子组件提取为独立文件 |
| Service | 只负责一个聚合根（VideoService 不混入 UserService 的逻辑） |
| API Route | 只处理一个资源的 CRUD；超过 8 个 endpoints 评估是否拆子路由 |
| DB queries | 一个文件对应一张主表；复杂跨表聚合可拆 aggregates/ |
| Hook | 只导出一个 hook |
| Store | 只对应一个状态域 |
| Types | 按领域分组（video.types.ts / user.types.ts），不跨域混合 |

行数作为辅助信号（详细触发条件见 CLAUDE.md 绝对禁止清单）：
- **超过 400 行**：必须先声明「本文件的唯一职责是 ___」，无法一句话表达时立即拆分
- **超过 500 行**：若非纯声明性文件（类型定义、静态映射数据），必须拆分

