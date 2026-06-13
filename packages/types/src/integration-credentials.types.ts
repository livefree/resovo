/**
 * integration-credentials.types.ts — API 凭证统一管理 provider 注册表（ADR-173 D-173-2）
 *
 * 单一真源：外部数据源凭证（bangumi 现 / tmdb Bearer 就绪 / 未来源）的字段声明。
 * 类型 + runtime const 同居（对齐 external.types EXTERNAL_PROVIDERS / route-codenames 范式）：
 * apps/api（zod 校验 + 解析器 + 测试适配器）与 apps/server-next（注册表驱动 UI）同源消费，
 * 杜绝双真源漂移。接新源 = 追加一条 spec + 实现其测试适配器（CREDENTIAL_TESTERS），非纯配置。
 *
 * secret 治理（ADR-173 D-173-4）：字段 `secret` flag 为遮罩/redact/占位跳过的唯一真源
 * （不依赖 key 名正则——新表字段为 camelCase 如 token 不命中 ADR-168 SECRET_KEY_PATTERNS）。
 * secret=true 字段存 api_credentials.secrets JSONB；secret=false 存 config JSONB（明文）。
 */

import type { ProviderKey } from './external.types'

/** 单个凭证字段声明（驱动 UI 渲染 + zod 校验 + 解析器分列 + env 回退）。 */
export interface CredentialFieldSpec {
  /** 字段键（同时是 secrets/config JSONB 内的 key）：'token' | 'userAgent' | 'timeoutMs' | 'baseUrl' | 'language' 等 */
  readonly key: string
  /** UI 标签 */
  readonly label: string
  /** true → 敏感字段（存 secrets 列 + 遮罩/redact/占位跳过）；false → 非敏感（存 config 列，明文） */
  readonly secret: boolean
  /** UI 控件类型 */
  readonly input: 'text' | 'password' | 'number'
  /** 是否必填（保存时 zod 校验；当前所有源凭证均可选——缺省走 env/降级） */
  readonly required: boolean
  /** 缺省默认值（非敏感字段；解析器 + UI placeholder 复用） */
  readonly default?: string | number
  /** number 字段下界（zod .min 复用） */
  readonly min?: number
  /** number 字段上界（zod .max 复用） */
  readonly max?: number
  /** UI 占位提示 */
  readonly placeholder?: string
  /** 字段说明（UI 辅助文案） */
  readonly help?: string
  /** 缺省回退的环境变量名（向后兼容 process.env，ADR-173 D-173-3 两阶段迁移过渡期） */
  readonly envVar?: string
}

/** 单个 provider 的凭证规格（一条 = 一个外部数据源的全部凭证字段）。 */
export interface ProviderCredentialSpec {
  readonly provider: ProviderKey
  readonly label: string
  readonly fields: readonly CredentialFieldSpec[]
}

/**
 * provider 凭证注册表（ADR-173 D-173-2 单一真源）。
 * 仅声明「有凭证可配」的源；douban（scrape，cookie 仍走 system_settings）/ imdb（未接）不在此表。
 *
 * - bangumi（ADR-161/189，active）：Bearer Token + 描述性 UA + 超时。
 * - tmdb（ADR-173 占位就绪，consumption 后续）：API Read Access Token（Bearer，覆盖 v3/v4，
 *   不绑 v3 query api_key）+ baseUrl + 默认语言。
 */
export const PROVIDER_CREDENTIAL_SPECS: readonly ProviderCredentialSpec[] = [
  {
    provider: 'bangumi',
    label: 'Bangumi',
    fields: [
      {
        key: 'token',
        label: 'API Token',
        secret: true,
        input: 'password',
        required: false,
        placeholder: '粘贴 bangumi.tv access token',
        help: '见 https://bangumi.tv/dev；缺省时仅本地 dump 索引可用，REST 详情链路降级',
        envVar: 'BANGUMI_API_TOKEN',
      },
      {
        key: 'userAgent',
        label: 'User-Agent',
        secret: false,
        input: 'text',
        required: false,
        default: 'resovo/1.0 (+https://github.com/resovo)',
        placeholder: 'resovo/1.0 (+https://github.com/resovo)',
        help: 'Bangumi 要求描述性 User-Agent',
        envVar: 'BANGUMI_USER_AGENT',
      },
      {
        key: 'timeoutMs',
        label: '请求超时 (ms)',
        secret: false,
        input: 'number',
        required: false,
        default: 8000,
        min: 1000,
        max: 60000,
        placeholder: '8000',
        envVar: 'BANGUMI_API_TIMEOUT_MS',
      },
    ],
  },
  {
    provider: 'tmdb',
    label: 'TMDb',
    fields: [
      {
        key: 'token',
        label: 'API Read Access Token',
        secret: true,
        input: 'password',
        required: false,
        placeholder: '粘贴 TMDb API Read Access Token',
        help: 'TMDb 设置 > API > API Read Access Token（Bearer，覆盖 v3/v4）；富集消费后续立项',
        envVar: 'TMDB_READ_ACCESS_TOKEN',
      },
      {
        key: 'baseUrl',
        label: 'API Base URL',
        secret: false,
        input: 'text',
        required: false,
        default: 'https://api.themoviedb.org/3',
        placeholder: 'https://api.themoviedb.org/3',
        envVar: 'TMDB_BASE_URL',
      },
      {
        key: 'language',
        label: '默认语言',
        secret: false,
        input: 'text',
        required: false,
        default: 'zh-CN',
        placeholder: 'zh-CN',
        envVar: 'TMDB_LANGUAGE',
      },
    ],
  },
]

/** registry 查找 helper（消费方按 provider key 取规格；未知 key → undefined）。 */
export function getProviderCredentialSpec(provider: string): ProviderCredentialSpec | undefined {
  return PROVIDER_CREDENTIAL_SPECS.find((s) => s.provider === provider)
}
