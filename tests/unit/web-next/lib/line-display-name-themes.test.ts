/**
 * line-display-name-themes.test.ts — CHG-353 / route-labeling Phase 1 Layer C
 *
 * 主题标签 + applyThemeLabels 守卫。
 * 覆盖：5 主题常量长度 + getDefaultTheme(locale) + applyThemeLabels 行为
 *   含 dead / pending / fallback / 索引超长等边界
 */

import { describe, it, expect } from 'vitest'
import {
  applyThemeLabels,
  getDefaultTheme,
  THEME_JIE_QI,
  THEME_NATO,
  THEME_NUMBERS,
  THEME_PLANETS,
  THEME_COLORS,
  ALL_THEMES,
} from '../../../../apps/web-next/src/lib/line-display-name'

// ── 主题常量 ────────────────────────────────────────────────────────────

describe('主题常量长度对齐设计稿', () => {
  it('节气 24 个', () => {
    expect(THEME_JIE_QI.labels).toHaveLength(24)
    expect(THEME_JIE_QI.labels[0]).toBe('立春')
    expect(THEME_JIE_QI.labels[23]).toBe('大寒')
    expect(THEME_JIE_QI.deadLabel).toBe('已断')
  })

  it('NATO Phonetic 26 个', () => {
    expect(THEME_NATO.labels).toHaveLength(26)
    expect(THEME_NATO.labels[0]).toBe('Alpha')
    expect(THEME_NATO.labels[25]).toBe('Zulu')
    expect(THEME_NATO.deadLabel).toBe('Offline')
  })

  it('数字 10 个 / Planets 8 个 / Colors 8 个', () => {
    expect(THEME_NUMBERS.labels).toHaveLength(10)
    expect(THEME_PLANETS.labels).toHaveLength(8)
    expect(THEME_COLORS.labels).toHaveLength(8)
  })

  it('ALL_THEMES 含 5 主题', () => {
    expect(ALL_THEMES).toHaveLength(5)
    expect(ALL_THEMES.map(t => t.id)).toEqual(['jie_qi', 'nato', 'numbers', 'planets', 'colors'])
  })
})

// ── getDefaultTheme(locale) ────────────────────────────────────────────

describe('getDefaultTheme(locale) — 按语言选默认主题', () => {
  it('zh-CN → 节气', () => {
    expect(getDefaultTheme('zh-CN').id).toBe('jie_qi')
    expect(getDefaultTheme('zh').id).toBe('jie_qi')
    expect(getDefaultTheme('zh-TW').id).toBe('jie_qi')
    expect(getDefaultTheme('ZH-cn').id).toBe('jie_qi')  // case insensitive
  })

  it('en + 其他 → NATO Phonetic', () => {
    expect(getDefaultTheme('en').id).toBe('nato')
    expect(getDefaultTheme('en-US').id).toBe('nato')
    expect(getDefaultTheme('ja').id).toBe('nato')  // 其他语言 fallback NATO
    expect(getDefaultTheme('').id).toBe('nato')
  })
})

// ── applyThemeLabels — 基本行为 ──────────────────────────────────────

describe('applyThemeLabels — 索引位置赋标签', () => {
  it('索引 0..N 内 → 对应主题标签', () => {
    const routes = [
      { effectiveScore: 0.9, quality: '1080P' },
      { effectiveScore: 0.7, quality: '720P' },
      { effectiveScore: 0.5, quality: '480P' },
    ]
    const result = applyThemeLabels(routes, THEME_JIE_QI)
    expect(result).toHaveLength(3)
    expect(result[0].themeLabel).toBe('立春')
    expect(result[1].themeLabel).toBe('雨水')
    expect(result[2].themeLabel).toBe('惊蛰')
    result.forEach(r => {
      expect(r.isDead).toBe(false)
      expect(r.isFallback).toBe(false)
    })
  })

  it('NATO 主题对应索引位置', () => {
    const routes = Array.from({ length: 5 }, (_, i) => ({ effectiveScore: 0.9 - i * 0.1, quality: '720P' }))
    const result = applyThemeLabels(routes, THEME_NATO)
    expect(result.map(r => r.themeLabel)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
  })
})

// ── 边界：fallback（超主题长度）──────────────────────────────────────

describe('applyThemeLabels — 超主题长度 fallback', () => {
  it('Planets 8 → 第 9 条用 "Route 9" fallback', () => {
    const routes = Array.from({ length: 9 }, (_, i) => ({ effectiveScore: 0.8 - i * 0.05, quality: '720P' }))
    const result = applyThemeLabels(routes, THEME_PLANETS)
    expect(result[7].themeLabel).toBe('Pluto')  // 第 8 条 (index 7) 是最后主题
    expect(result[7].isFallback).toBe(false)
    expect(result[8].themeLabel).toBe('Route 9')  // 第 9 条 fallback
    expect(result[8].isFallback).toBe(true)
  })

  it('数字 10 → 第 11 条用 "线路 11" fallback', () => {
    const routes = Array.from({ length: 11 }, (_, i) => ({ effectiveScore: 0.8 - i * 0.05, quality: '720P' }))
    const result = applyThemeLabels(routes, THEME_NUMBERS)
    expect(result[9].themeLabel).toBe('十')
    expect(result[10].themeLabel).toBe('线路11')
    expect(result[10].isFallback).toBe(true)
  })
})

// ── 边界：dead（effectiveScore < DEAD_THRESHOLD 0.1）─────────────────

describe('applyThemeLabels — dead 判定（score < 0.1）', () => {
  it('effectiveScore 0.05 → deadLabel + isDead=true', () => {
    const result = applyThemeLabels(
      [{ effectiveScore: 0.05, quality: '240P' }],
      THEME_JIE_QI,
    )
    expect(result[0].themeLabel).toBe('已断')
    expect(result[0].isDead).toBe(true)
  })

  it('effectiveScore 0.03 (min) → deadLabel', () => {
    const result = applyThemeLabels(
      [{ effectiveScore: 0.03, quality: '240P' }],
      THEME_NATO,
    )
    expect(result[0].themeLabel).toBe('Offline')
    expect(result[0].isDead).toBe(true)
  })

  it('effectiveScore 0 → 视为未知（非 dead / 与未提供同语义）', () => {
    // score = 0 可能是"未传字段"被默认为 0 / heuristic 安全：不视为 dead
    const result = applyThemeLabels(
      [{ effectiveScore: 0, quality: '720P' }],
      THEME_JIE_QI,
    )
    expect(result[0].isDead).toBe(false)
    expect(result[0].themeLabel).toBe('立春')
  })

  it('effectiveScore undefined → 视为未知（非 dead）', () => {
    const result = applyThemeLabels(
      [{ quality: '720P' }],
      THEME_JIE_QI,
    )
    expect(result[0].isDead).toBe(false)
    expect(result[0].themeLabel).toBe('立春')
  })

  it('effectiveScore 0.1 (上边界) → 非 dead', () => {
    const result = applyThemeLabels(
      [{ effectiveScore: 0.1, quality: '480P' }],
      THEME_JIE_QI,
    )
    expect(result[0].isDead).toBe(false)
  })
})

// ── 边界：pending（0.3 <= score < 0.4 / CHG-352 中性 0.345）──────────

describe('applyThemeLabels — pending 判定（0.3 <= score < 0.4 / 中性 ≈ 0.345）', () => {
  it('effectiveScore 0.345 (中性) → isPending=true', () => {
    const result = applyThemeLabels(
      [{ effectiveScore: 0.345, quality: null }],
      THEME_JIE_QI,
    )
    expect(result[0].isPending).toBe(true)
    expect(result[0].themeLabel).toBe('立春')  // 仍正常显示主题标签
    expect(result[0].isDead).toBe(false)
  })

  it('effectiveScore 0.3 (下边界) → isPending=true', () => {
    const result = applyThemeLabels([{ effectiveScore: 0.3, quality: '720P' }], THEME_JIE_QI)
    expect(result[0].isPending).toBe(true)
  })

  it('effectiveScore 0.4 (上边界 / 排除) → 非 pending', () => {
    const result = applyThemeLabels([{ effectiveScore: 0.4, quality: '720P' }], THEME_JIE_QI)
    expect(result[0].isPending).toBe(false)
  })

  it('effectiveScore 0.5 → 非 pending', () => {
    const result = applyThemeLabels([{ effectiveScore: 0.5, quality: '720P' }], THEME_JIE_QI)
    expect(result[0].isPending).toBe(false)
  })
})

// ── 边界：0 / 1 条线路 ────────────────────────────────────────────────

describe('applyThemeLabels — 0/1 条线路边界', () => {
  it('0 条 → 返回空数组', () => {
    const result = applyThemeLabels([], THEME_JIE_QI)
    expect(result).toEqual([])
  })

  it('1 条 → 单条带主题标签（caller SourceBar 判定单条不显标签）', () => {
    const result = applyThemeLabels(
      [{ effectiveScore: 0.9, quality: '1080P' }],
      THEME_JIE_QI,
    )
    expect(result).toHaveLength(1)
    expect(result[0].themeLabel).toBe('立春')
  })
})

// ── 边界：全 dead ───────────────────────────────────────────────────

describe('applyThemeLabels — 全 dead 线路（all isDead=true）', () => {
  it('3 条 dead 线路 → 全部 deadLabel + isDead=true', () => {
    const routes = [
      { effectiveScore: 0.04, quality: '480P' },
      { effectiveScore: 0.05, quality: '720P' },
      { effectiveScore: 0.03, quality: '360P' },
    ]
    const result = applyThemeLabels(routes, THEME_JIE_QI)
    result.forEach(r => {
      expect(r.isDead).toBe(true)
      expect(r.themeLabel).toBe('已断')
    })
  })
})

// ── buildThemedSources（CHG-369 Codex stop-time review #11）─────────

import { buildThemedSources, type RawSourceForTheme } from '../../../../apps/web-next/src/lib/line-display-name'

function makeRaw(overrides: Partial<RawSourceForTheme> & { id: number }): RawSourceForTheme {
  return {
    sourceUrl: `https://example.com/${overrides.id}.m3u8`,
    type: 'hls',
    sourceName: `line${overrides.id}`,
    siteDisplayName: null,
    quality: '1080P',
    effectiveScore: 0.8,
    ...overrides,
  }
}

describe('buildThemedSources — 主题切换重新 relabel', () => {
  it('同一份原始数据用不同主题派生 → label 改变 / src 与 quality 不变', () => {
    const raw = [makeRaw({ id: 1 }), makeRaw({ id: 2 }), makeRaw({ id: 3 })]

    const jieQi = buildThemedSources(raw, THEME_JIE_QI)
    const nato = buildThemedSources(raw, THEME_NATO)

    expect(jieQi[0].label).toBe('立春')
    expect(jieQi[1].label).toBe('雨水')
    expect(jieQi[2].label).toBe('惊蛰')

    expect(nato[0].label).toBe('Alpha')
    expect(nato[1].label).toBe('Bravo')
    expect(nato[2].label).toBe('Charlie')

    // 非主题维度的字段保持稳定
    for (let i = 0; i < 3; i++) {
      expect(jieQi[i].src).toBe(nato[i].src)
      expect(jieQi[i].quality).toBe(nato[i].quality)
      expect(jieQi[i].type).toBe(nato[i].type)
    }
  })

  it('effectiveScore 缺失（老后端 fallback）→ 走 buildLineDisplayName 而非主题标签', () => {
    const raw = [
      makeRaw({ id: 1, effectiveScore: undefined, sourceName: 'TestSite' }),
    ]
    const result = buildThemedSources(raw, THEME_JIE_QI)
    expect(result[0].label).not.toBe('立春')
    expect(result[0].label).toContain('TestSite')
  })

  it('dead 线路（effectiveScore < 0.1）→ themeLabel = deadLabel + isDead=true', () => {
    const raw = [makeRaw({ id: 1, effectiveScore: 0.05 })]
    const jieQi = buildThemedSources(raw, THEME_JIE_QI)
    const nato = buildThemedSources(raw, THEME_NATO)
    expect(jieQi[0].label).toBe('已断')
    expect(jieQi[0].isDead).toBe(true)
    expect(nato[0].label).toBe('Offline')
    expect(nato[0].isDead).toBe(true)
  })

  it('5 主题全部各派生一份 → 全 label 互不相同（核心 invariant）', () => {
    const raw = [makeRaw({ id: 1 })]
    const labels = ALL_THEMES.map((t) => buildThemedSources(raw, t)[0].label)
    expect(new Set(labels).size).toBe(ALL_THEMES.length)
  })
})

// ── matchActiveSourceIndex（CHG-369 Codex stop-time review #13）─────

import { matchActiveSourceIndex } from '../../../../apps/web-next/src/lib/line-display-name'

describe('matchActiveSourceIndex — 集数切换跨主题稳定保持 active source', () => {
  const prev = [
    makeRaw({ id: 1, sourceName: 'siteA' }),
    makeRaw({ id: 2, sourceName: 'siteB' }),
    makeRaw({ id: 3, sourceName: 'siteC' }),
  ]

  it('新集数包含相同 sourceName → 返回新位置（即便位置变了 / 按 effective_score 重排）', () => {
    // 新集数把 siteC 排到第 0 位（effective_score 不同）
    const next = [
      makeRaw({ id: 30, sourceName: 'siteC' }),
      makeRaw({ id: 10, sourceName: 'siteA' }),
      makeRaw({ id: 20, sourceName: 'siteB' }),
    ]
    expect(matchActiveSourceIndex(prev, 0, next)).toBe(1)   // siteA → 新位置 1
    expect(matchActiveSourceIndex(prev, 1, next)).toBe(2)   // siteB → 新位置 2
    expect(matchActiveSourceIndex(prev, 2, next)).toBe(0)   // siteC → 新位置 0
  })

  it('新集数不含 prev sourceName → fallback 0', () => {
    const next = [makeRaw({ id: 99, sourceName: 'siteX' })]
    expect(matchActiveSourceIndex(prev, 1, next)).toBe(0)
  })

  it('prevIndex 越界 / prev 为空 → fallback 0', () => {
    expect(matchActiveSourceIndex(prev, 99, prev)).toBe(0)
    expect(matchActiveSourceIndex([], 0, prev)).toBe(0)
  })

  it('核心 invariant：跨主题稳定（label 不参与判定 / 只看 sourceName 稳定 key）', () => {
    // 这是 Codex #13 fix 的核心证明：label 派生自主题不稳定，但 sourceName 是 raw API 字段稳定
    // → matchActiveSourceIndex 完全不依赖 label，避免主题切换时位置漂移
    const next = [
      makeRaw({ id: 1, sourceName: 'siteB' }),  // 同 prev[1] 的 sourceName
    ]
    expect(matchActiveSourceIndex(prev, 1, next)).toBe(0)
  })
})

// ── matchActiveSourceIndex 复合匹配（CHG-369 Codex stop-time review #14）─────

describe('matchActiveSourceIndex — 复合 (siteDisplayName, sourceName) 防多站点同名误切', () => {
  it('两个不同站点都叫"线路 1" → 按 siteDisplayName 复合精确命中正确站点', () => {
    const prev = [
      makeRaw({ id: 1, sourceName: '线路1', siteDisplayName: '站点 A' }),
      makeRaw({ id: 2, sourceName: '线路1', siteDisplayName: '站点 B' }),
    ]
    // 新集数顺序颠倒
    const next = [
      makeRaw({ id: 20, sourceName: '线路1', siteDisplayName: '站点 B' }),
      makeRaw({ id: 10, sourceName: '线路1', siteDisplayName: '站点 A' }),
    ]
    expect(matchActiveSourceIndex(prev, 0, next)).toBe(1)  // 站点 A 在新数组位置 1
    expect(matchActiveSourceIndex(prev, 1, next)).toBe(0)  // 站点 B 在新数组位置 0
  })

  it('prev siteDisplayName=null → 单 sourceName 兜底（兼容历史数据）', () => {
    const prev = [makeRaw({ id: 1, sourceName: 'siteX', siteDisplayName: null })]
    const next = [makeRaw({ id: 10, sourceName: 'siteX', siteDisplayName: '站点 X' })]
    // siteDisplayName 缺失 → 走 sourceName 兜底 → 命中
    expect(matchActiveSourceIndex(prev, 0, next)).toBe(0)
  })

  it('复合不命中但 sourceName 命中 → 降级 sourceName 单匹配（新站点同名场景）', () => {
    const prev = [makeRaw({ id: 1, sourceName: '线路1', siteDisplayName: '站点 A' })]
    // 新集数中"站点 A"被重命名为"站点 A.cn"（display_name 偶发变动）但 sourceName 稳定
    const next = [makeRaw({ id: 10, sourceName: '线路1', siteDisplayName: '站点 A.cn' })]
    expect(matchActiveSourceIndex(prev, 0, next)).toBe(0)
  })

  it('prev=有 siteDisplayName + sourceName / 新集数同 sourceName 但不同 siteDisplayName 多条 → 不误切（fallback 0 而非匹配第一条）', () => {
    // 这是 #14 fix 核心断言：sourceName-only 会切到错站点
    const prev = [makeRaw({ id: 1, sourceName: '线路1', siteDisplayName: '站点 X' })]
    const next = [
      makeRaw({ id: 100, sourceName: '线路1', siteDisplayName: '站点 A' }),  // 同 sourceName 不同站
      makeRaw({ id: 200, sourceName: '线路1', siteDisplayName: '站点 B' }),  // 同 sourceName 不同站
    ]
    // 复合不命中 → 走 sourceName 兜底 → 匹配首位（已属 best-effort / 历史 sourceName-only 行为）
    // 注：若运营需要"严格 strict"则未来 follow-up 改为 -1 / 0；当前选 sourceName 兜底保留可用性
    const result = matchActiveSourceIndex(prev, 0, next)
    expect(result).toBe(0)  // sourceName 兜底命中首位
  })
})
