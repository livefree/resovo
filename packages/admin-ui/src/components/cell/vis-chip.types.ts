/**
 * vis-chip.types.ts — VisChip 共享组件 Props 契约（CHG-DESIGN-12 12A）
 *
 * 真源（按优先级 — **enum 字面值真源 > 视觉渲染参考**）：
 *   1. **enum 字面值真源**：`packages/types/src/video.types.ts` 的 `VisibilityStatus` + `ReviewStatus`
 *      （后端契约 `'public' | 'internal' | 'hidden'` + `'pending_review' | 'approved' | 'rejected'`）
 *   2. `docs/designs/backend_design_v2.1/reference.md` §6.1 visibility 列「`<VisChip visibility review />`」
 *      （组件用法真源；reference §6.1 不规定 enum 字面，仅描述用法）
 *   3. **视觉渲染参考（不取 enum 字面）**：`docs/designs/backend_design_v2.1/app/icons-data.jsx` `VisChip` 实装
 *      （行 128-135）— ⚠️ 设计稿原型用 stale enum 字面 `'pending'` / `'private'`，与后端真源
 *      `'pending_review'` / `'hidden'` 不一致；本契约**仅取设计稿派生分支结构与视觉映射**，enum 字面值
 *      以 packages/types 真源为准
 *   4. CHG-DESIGN-12 任务卡（SEQ-20260429-02 第 12 卡 · 12A 阶段）
 *
 * 业务语义：
 *   把视频的「visibility 可见性」+「review 审核」两个状态字段融合成**单一前台可见性 chip**，
 *   消除消费方在多列分别展示两个状态导致视觉冗余 + 用户认知负担过重。
 *
 * 派生规则（分支优先级；enum 字面取 packages/types 真源，与设计稿 jsx 视觉映射等价）：
 * 1. `review === 'rejected'` → "已拒" pill--danger
 * 2. `review === 'pending_review'` → "待审" pill--warn
 * 3. `visibility === 'public'`   → "前台可见" pill--ok
 * 4. `visibility === 'internal'` → "仅内部" pill (neutral)
 * 5. 其他（包括 visibility='hidden'）→ "隐藏" pill--danger
 *
 * 与 reference §6.1 视频库列的关系：
 *   - 单独的 visibility 列（120 宽）渲染 `<VisChip visibility review />`
 *   - 单独的 review 列（90 宽）渲染纯 review pill（不复用 VisChip）— 因为 visibility 列承担了"复合状态"职责，
 *     review 列仅做单状态显示
 *
 * 与 Pill 关系：
 *   VisChip **复用** Pill 渲染（一个 Pill 实例）；VisChip 只负责派生映射，不重新实现 pill 视觉。
 *
 * 不变约束：
 *   - 颜色仅消费 packages/design-tokens
 *   - Edge Runtime 兼容
 */

/**
 * 后端 visibility_status 三态
 *
 * **真源镜像**：`packages/types/src/video.types.ts` 的 `VisibilityStatus`。
 * admin-ui 是零业务依赖纯 UI 库，不直接 import packages/types；本类型镜像真源字面值，
 * 任何 drift 由 typecheck 在消费方边界自动暴露（消费方一般直接传 packages/types 的 enum
 * 给本组件，类型不匹配会立即编译失败）。
 *
 * - `public`：前台可见（is_published=true 的常规上架状态）
 * - `internal`：仅内部可见（编辑态 / 暂存待发布）
 * - `hidden`：隐藏 / 下架（管理员主动隐藏）
 */
export type VisibilityStatus = 'public' | 'internal' | 'hidden'

/**
 * 后端 review_status 三态
 *
 * **真源镜像**：`packages/types/src/video.types.ts` 的 `ReviewStatus`。
 * 同上 drift 守门策略。
 *
 * - `pending_review`：待审
 * - `approved`：已通过
 * - `rejected`：已拒
 */
export type ReviewStatus = 'pending_review' | 'approved' | 'rejected'

/**
 * VisChip Props
 *
 * 渲染：单个 Pill 实例；variant 由 visibility + review 复合派生（见上方"派生规则"）
 *
 * a11y：
 * - aria-label 由派生文案 + visibility / review raw 值组合（如 "前台可见（visibility=public, review=approved）"）
 * - 屏幕阅读器读出复合语义而非纯文案
 *
 * 派生表（5 种结果）：
 * | review          | visibility  | 渲染              | variant   |
 * | --------------- | ----------- | ----------------- | --------- |
 * | rejected        | *           | "已拒"            | danger    |
 * | pending_review  | *           | "待审"            | warn      |
 * | approved        | public      | "前台可见"        | ok        |
 * | approved        | internal    | "仅内部"          | neutral   |
 * | approved        | hidden      | "隐藏"            | danger    |
 *
 * 注：`approved` + `hidden` 是合法状态（已通过审核但管理员主动隐藏）；渲染 "隐藏 danger" 与
 * `rejected` 的 "已拒 danger" 视觉相同 — 消费方需要区分时通过 ariaLabel 中的 raw 值识别。
 */
export interface VisChipProps {
  /** 视频可见性状态（必填） */
  readonly visibility: VisibilityStatus

  /** 视频审核状态（必填） */
  readonly review: ReviewStatus

  /** 测试钩子 */
  readonly testId?: string
}
