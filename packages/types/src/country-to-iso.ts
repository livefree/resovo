/**
 * country-to-iso.ts — 任意国家/地区名 → ISO 3166-1 alpha-2 归一（正向真源，META-40）
 *
 * 与 `format-country-name.ts` 构成 country 字段双向真源：
 *   countryToIso('中国大陆')  → 'CN'    （入：写库前归一，本文件）
 *   formatCountryName('CN')   → '中国'  （出：显示层，format-country-name.ts）
 *
 * 真源约束：`media_catalog.country` 统一存 ISO 3166-1 alpha-2。所有写入侧（douban /
 * bangumi / tmdb 增强）须经 `countryToIso` 归一后写，杜绝同国裂「中文名 / ISO」两值
 * （此前 douban 直写 detail.countries[0] 中文名 → 视频库 distinct/筛选/分组失效）。
 *
 * 收敛真源（META-40 评审 #2「禁止新建第二套国家表」）：本表取代原 API-local
 * `SourceParserService.maps.ts` 的 `COUNTRY_MAP`（仅 8 国）+ `SourceLanguageResolver`
 * 的 `normalizeCountryCode`，两者改 re-export / 委托本文件，全仓单一国家映射真源。
 *
 * 双形态归一：
 *   - 已是 ISO 2 位 ASCII alpha → 直接大写返回（'us' → 'US'）
 *   - 中文名 / 线路名地区别名 → 过 COUNTRY_NAME_TO_ISO 表
 *   - 不可归一 → null（调用方决定跳过 / 登记；写入侧只写非 null 的 ISO 保列纯净）
 */

/**
 * 中文国家/地区名（及线路名地区别名）→ ISO 3166-1 alpha-2。
 *
 * 覆盖来源：① 原 COUNTRY_MAP 8 国全部别名（含「港剧/日剧」等线路 token，
 * `SourceParserService.parseCountry` 复用，不可删）；② media_catalog 实测污染 14 种
 * （含「中国香港/中国台湾」豆瓣前缀形态）；③ 常见影视产出国扩充。
 *
 * 「中国X」前缀：豆瓣 detail.countries 产出「中国大陆/中国香港/中国台湾/中国澳门」，
 * 须分别归一到 CN/HK/TW/MO（非全归 CN）。
 */
export const COUNTRY_NAME_TO_ISO: Readonly<Record<string, string>> = {
  // ── 中国（大陆/港澳台 + 豆瓣「中国X」前缀 + 线路别名）──
  中国: 'CN', 中国大陆: 'CN', 大陆: 'CN', 国产: 'CN', 华语: 'CN', 内地: 'CN',
  香港: 'HK', 中国香港: 'HK', 港剧: 'HK',
  台湾: 'TW', 中国台湾: 'TW',
  澳门: 'MO', 中国澳门: 'MO',
  // ── 东亚 / 东南亚 / 南亚 ──
  日本: 'JP', 日剧: 'JP',
  韩国: 'KR', 韩剧: 'KR', 南韩: 'KR',
  朝鲜: 'KP',
  泰国: 'TH',
  新加坡: 'SG',
  马来西亚: 'MY',
  印度尼西亚: 'ID', 印尼: 'ID',
  菲律宾: 'PH',
  越南: 'VN',
  印度: 'IN',
  // ── 北美 ──
  美国: 'US', 美剧: 'US',
  加拿大: 'CA',
  墨西哥: 'MX',
  // ── 欧洲 ──
  英国: 'GB', 英剧: 'GB',
  法国: 'FR',
  德国: 'DE',
  意大利: 'IT',
  西班牙: 'ES',
  葡萄牙: 'PT',
  荷兰: 'NL',
  比利时: 'BE',
  爱尔兰: 'IE',
  瑞典: 'SE',
  丹麦: 'DK',
  挪威: 'NO',
  芬兰: 'FI',
  瑞士: 'CH',
  奥地利: 'AT',
  波兰: 'PL',
  俄罗斯: 'RU', 苏联: 'RU',
  // ── 大洋洲 ──
  澳大利亚: 'AU', 澳洲: 'AU',
  新西兰: 'NZ',
  // ── 中东 / 南美 ──
  土耳其: 'TR',
  以色列: 'IL',
  伊朗: 'IR',
  巴西: 'BR',
  阿根廷: 'AR',
}

/**
 * 任意国家/地区名 → ISO 3166-1 alpha-2 code（双形态）。不可归一返回 null。
 *
 * @example
 *   countryToIso('中国大陆')  // 'CN'
 *   countryToIso('中国香港')  // 'HK'
 *   countryToIso('us')        // 'US'（已 ISO，大写归一）
 *   countryToIso('火星')      // null（不在表 → 调用方跳过，不污染 ISO 列）
 *   countryToIso(null)        // null
 */
export function countryToIso(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  // 已是 ISO 3166-1 alpha-2（2 个 ASCII 字母）→ 直接大写
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase()
  return COUNTRY_NAME_TO_ISO[s] ?? null
}
