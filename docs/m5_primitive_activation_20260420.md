# M5 Primitive 激活归属表（2026-04-21）

> 产出卡片：M5-PREP-02
> 决策来源：ADR-048 §（决策 M5-G）+ `docs/task_queue_patch_m5_card_protocol_20260420_v1_1.md` §1.2
> 用途：明确 REGRESSION 阶段产出的 noop/stub primitive 在 M5 各执行卡中的激活责任，防止多卡抢占或无人实装

---

## 激活归属总表

| Primitive | REGRESSION 产物 | 文件路径 | M5 激活卡 | 消费卡 | 验收门槛 |
|-----------|----------------|---------|-----------|--------|---------|
| `SharedElement` | noop（API 存在但无实际 FLIP） | `apps/web-next/src/components/shared/primitives/SharedElement.tsx` | **M5-CARD-SHARED-01** | M5-PAGE-DETAIL-01 | FLIP 帧率 ≥ 55fps；arch-reviewer code review PASS |
| `RouteStack` | stub（监听器挂载但无手势逻辑） | `apps/web-next/src/components/shared/primitives/RouteStack.tsx` | **M5-CARD-ROUTESTACK-01** | M5-PAGE-GRID-01、M5-PAGE-SEARCH-01 | 移动端左边缘右滑返回；桌面不触发 |
| `PageTransition`（Sibling variant） | noop（variant 参数存在，效果为瞬切） | `apps/web-next/src/components/shared/primitives/PageTransition.tsx` | **M5-PAGE-GRID-01**（首激活） | 所有后续 M5-PAGE-* 卡继承 | 分类切换触发 120/160ms 交叉淡入 + stagger 40ms |
| `PageTransition`（Takeover variant） | 待实装 | 同上 | **M5-CARD-CTA-01** | M5-PAGE-DETAIL-01、M5-PAGE-PLAYER-01 | Fast Takeover 200/240ms；Standard Takeover 360ms |
| `Skeleton` primitive | 不存在（需新建） | `apps/web-next/src/components/primitives/feedback/Skeleton.tsx`（待创建） | **M5-CARD-SKELETON-01** | 所有 M5 新建组件（通过 `.Skeleton` 子组件消费） | 三档门槛；shimmer 动画；像素匹配 |

---

## 激活顺序与依赖关系

```
M5-CARD-CTA-01
  └─ 激活 PageTransition Takeover variant（Fast Takeover 实装）
  └─ 消费方：M5-PAGE-DETAIL-01 / M5-PAGE-PLAYER-01

M5-CARD-SHARED-01
  └─ 激活 SharedElement（FLIP 算法实装，noop 替换）
  └─ 消费方：M5-PAGE-DETAIL-01

M5-CARD-ROUTESTACK-01
  └─ 激活 RouteStack（touch 手势实装，stub 替换）
  └─ 消费方：M5-PAGE-GRID-01 / M5-PAGE-SEARCH-01

M5-CARD-SKELETON-01
  └─ 新建 Skeleton primitive
  └─ 消费方：所有 M5 新建组件（VideoCard.Skeleton / HeroBanner.Skeleton 等）

M5-PAGE-GRID-01
  └─ 首次激活 PageTransition Sibling variant
  └─ 后续 PAGE 卡片通过继承默认行为消费 Sibling variant
```

---

## 激活职责边界（禁止越界）

| 规则 | 说明 |
|------|------|
| 激活卡之外不得改动 primitive 实现 | 非激活卡（消费卡）只能调用 primitive，不得修改其实现文件 |
| 消费 SharedElement 的组件使用 `.Source`/`.Target` API | 不得直接调用内部 `useFLIP()` hook，保持 API 边界 |
| PageTransition Sibling variant 首激活在 GRID-01 | 其他 PAGE 卡（SEARCH/DETAIL/PLAYER 等）只需确保路由在 PageTransition 包裹内，不单独激活 |
| Skeleton 形态扩展走 primitive Props | 新增形态必须在 `<Skeleton shape=...>` 的联合类型中注册，不得在组件内 hardcode 骨架样式 |

---

## 注：与 ADR-048 的对应关系

本表是 ADR-048"决策 M5-G"（primitive 激活归属）的执行层投影：

- ADR-048 §4.5：Skeleton primitive 契约 → M5-CARD-SKELETON-01
- ADR-048 §3.1：Fast Takeover → M5-CARD-CTA-01 激活 Takeover variant
- ADR-048 §2：双出口交互 → M5-CARD-CTA-01 实装 VideoCard.PosterAction/MetaAction
- ADR-044（已落地）：SharedElement / RouteStack stub 接口 → M5-CARD-SHARED-01 / ROUTESTACK-01 替换实现

---

## 变更记录

| 日期 | 版本 | 作者 |
|------|------|------|
| 2026-04-21 | v1.0 | M5-PREP-02（claude-sonnet-4-6 主循环） |
