# DEC 解耦违规清单

> 生成时间：2026-04-02
> 生成方式：DEC-01 lint 扫描（`grep -rn "from '@/api/" src/app src/components src/lib src/stores`）
> 用途：Phase 1（DEC-02~04）整改依据，修复完毕后此文件归档

---

## 违规汇总（共 7 处，6 个文件）

| # | 文件 | 行号 | 违规 import | 整改任务 |
|---|------|------|-------------|----------|
| 1 | `src/app/[locale]/admin/page.tsx` | 6 | `import { AnalyticsService } from '@/api/services/AnalyticsService'` | DEC-02 + 架构问题（见下） |
| 2 | `src/app/[locale]/admin/page.tsx` | 7 | `import { db } from '@/api/lib/postgres'` | DEC-02 + 架构问题（见下） |
| 3 | `src/app/[locale]/admin/page.tsx` | 11 | `import type { AnalyticsData } from '@/api/routes/admin/analytics'` | DEC-02 |
| 4 | `src/components/admin/AdminAnalyticsDashboard.tsx` | 16 | `import type { AnalyticsData } from '@/api/routes/admin/analytics'` | DEC-02 |
| 5 | `src/components/admin/dashboard/AnalyticsCards.tsx` | 11 | `import type { AnalyticsData } from '@/api/routes/admin/analytics'` | DEC-02 |
| 6 | `src/components/admin/dashboard/QueueAlerts.tsx` | 7 | `import type { AnalyticsData } from '@/api/routes/admin/analytics'` | DEC-02 |
| 7 | `src/components/admin/system/monitoring/CacheManager.tsx` | 16 | `import type { CacheStat, CacheType } from '@/api/services/CacheService'` | DEC-03 |

---

## 严重性分级

### 🔴 高优先级（逻辑违规，不仅是类型依赖）

**`src/app/[locale]/admin/page.tsx` 第 6-7 行**

```ts
import { AnalyticsService } from '@/api/services/AnalyticsService'
import { db } from '@/api/lib/postgres'
```

- **问题**：这是 Next.js 页面组件（前端层），但直接调用了后端 Service 和数据库客户端。这违反了分层约束（Route → Service → DB），也是最严重的耦合形式。
- **根因**：该 page.tsx 可能是 Server Component，利用 Next.js 服务端渲染直接调用后端。虽然运行时可行，但与"前后台代码完全解耦可独立部署"的目标冲突。
- **整改方向**：
  - 短期：将数据获取改为调用 `/v1/admin/analytics` API（通过 server-side fetch），而非直接 import Service/db
  - 中期：Phase 4 独立部署后，admin-console 是独立 Next.js 应用，无法访问 api-core 的代码

### 🟡 中优先级（类型依赖，运行时无影响）

其余 5 处均为 `import type`，仅在 TypeScript 编译期使用，运行时不引入任何后端实现。
但为满足"contracts 成为唯一共享边界"的结构性要求，仍需迁移到 `src/types/contracts/v1/`。

---

## 整改计划

| 任务 | 处理违规 | 主要工作 |
|------|----------|----------|
| DEC-02 | #1~6（AnalyticsData 相关） | 新建 `src/types/contracts/v1/admin.ts`，定义 AnalyticsData；page.tsx 的 Service/db 直接调用改为 API fetch |
| DEC-03 | #7（CacheStat/CacheType） | contracts/v1/admin.ts 追加 CacheStat/CacheType；CacheManager 改引用 contracts |
| DEC-04 | AnalyticsService 反向依赖 | AnalyticsService 自身不再 import route 层类型 |

---

## 归档条件

当 `npm run lint` 对 `src/app|src/components|src/lib|src/stores` 零 `no-restricted-imports` 警告时，本文件归档至 `docs/archive/`，lint 规则同步升级为 `error`。
