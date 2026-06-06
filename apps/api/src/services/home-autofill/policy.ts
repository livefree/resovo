/**
 * policy.ts — Home 自动填充策略版本与权重常量（ADR-183 D-183-4 / D-183-5）
 *
 * 权重为代码常量、首版不开放运营调参（D-183-4.4）：settings JSONB 不存权重，
 * 调权需求出现时递增 POLICY_VERSION 走代码评审——CLAUDE.md「不得写死值」红线
 * 针对类型/路由/配置/筛选条件的可扩展性，算法常量不属该范畴（D-183-4.4 边界声明）。
 */

/**
 * 策略版本（D-183-5）：信号集 / 权重 / 过滤规则语义变更时必须递增并在 changelog 标注。
 * 快照携带 policy_version + settings_snapshot → 解释链闭环（方案 §11）。
 */
export const POLICY_VERSION = 'hp-v1'

/** 豆瓣加权（D-183-4.1）：score = 0.4·norm_votes + 0.3·rating/10 + 0.15·recency + 0.15·source_health − penalties */
export const DOUBAN_WEIGHTS = {
  votes: 0.4,
  rating: 0.3,
  recency: 0.15,
  sourceHealth: 0.15,
} as const

/** 惩罚项（D-183-4.1：图片缺失 / 源不稳定；幅度属策略常量，随 POLICY_VERSION 演进） */
export const PENALTY_MISSING_IMAGE = 0.1
export const PENALTY_UNSTABLE_SOURCE = 0.1

/** recency 衰减半衰期（天）：站内视频最近上线/更新信号，30 天衰减一半 */
export const RECENCY_HALF_LIFE_DAYS = 30

/** source_health 饱和阈值：活跃可播源 ≥ 该数即满分 1（线性爬升） */
export const SOURCE_HEALTH_SATURATION = 3
