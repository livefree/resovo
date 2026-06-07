/**
 * home-publish.types.ts — Home Curation 发布治理（ADR-185）
 *
 * 「版本快照 + 草稿覆盖层」模型（D-185-1）：三真源表维持发布态唯一真源，
 * 前台读路径零改动；HomePageConfig 为整页三键快照/覆盖层的同构型。
 * 草稿条目新建行尚无 id / 时间戳（publish 时生成）；版本快照行恒携全量
 * （发布事务应用后回读三表拍版，运行时保证）——故 id/createdAt/updatedAt 可选。
 */

import type { Banner } from './banner.types'
import type { HomeModule } from './home-module.types'
import type { HomeSectionSettings } from './home-section.types'

// ── 整页配置（三键，与 097 版本快照 / 098 草稿覆盖层同构）────────────────────

export type HomeConfigBannerEntry =
  Omit<Banner, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Banner, 'id' | 'createdAt' | 'updatedAt'>>

export type HomeConfigModuleEntry =
  Omit<HomeModule, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<HomeModule, 'id' | 'createdAt' | 'updatedAt'>>

/** settings 身份键 = section（seed 7 行恒存在，id 稳定不随发布变化） */
export type HomeConfigSectionSettingsEntry =
  Omit<HomeSectionSettings, 'id' | 'updatedAt'> &
  Partial<Pick<HomeSectionSettings, 'id' | 'updatedAt'>>

export interface HomePageConfig {
  banners: HomeConfigBannerEntry[]
  modules: HomeConfigModuleEntry[]
  /** 恒覆盖 7 区块各一次（PUT 整页语义，zod 强制） */
  settings: HomeConfigSectionSettingsEntry[]
}

// ── 草稿（098 home_config_drafts 行）────────────────────────────────────────

export interface HomeConfigDraft {
  id: string
  /** 首版恒 'global'（多 brand 扩展位，D-185-1.3） */
  scope: string
  config: HomePageConfig
  /** 创建草稿时的最新版本号；null = 冷启动期无版本（陈旧检测锚，D-185-2.2） */
  baseVersionNo: number | null
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

/**
 * 草稿陈旧双信号（D-185-2.2；GET /admin/home/draft additive 顶层字段，
 * 与候选端点 gaps additive 同范式非 break）。权威判定仍在 publish 时点（409）；
 * 本结构仅供编辑器显著提示。
 */
export interface HomeDraftStaleness {
  /** baseMismatch ∨ tablesNewer */
  stale: boolean
  /** 信号①：base_version_no ≠ 当前最新 version_no */
  baseMismatch: boolean
  /** 信号②：三真源表 max(updated_at) 晚于草稿 updated_at（直写通道写入） */
  tablesNewer: boolean
  latestVersionNo: number | null
  tablesMaxUpdatedAt: string | null
}

// ── 版本（097 home_publish_versions 行）─────────────────────────────────────

export const HOME_PUBLISH_SOURCES = ['publish', 'rollback'] as const
export type HomePublishSource = (typeof HOME_PUBLISH_SOURCES)[number]

/** 版本列表轻量行（端点 #5，不含 config 载荷，D-185-3.3） */
export interface HomePublishVersionSummary {
  id: string
  versionNo: number
  source: HomePublishSource
  note: string | null
  publishedBy: string
  publishedAt: string
}

/** 版本详情（端点 #6，diff 数据源——diff 计算归消费端，D-185-4.2） */
export interface HomePublishVersion extends HomePublishVersionSummary {
  config: HomePageConfig
}
