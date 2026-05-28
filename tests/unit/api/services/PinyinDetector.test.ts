/**
 * PinyinDetector.test.ts — CHG-365-A1
 *
 * 覆盖 isPinyin 的判定语义：
 *  1. 典型拼音（多词）→ true
 *  2. 真英文标题 → false（含非拼音音节词）
 *  3. 边界：空 / null / undefined / 纯空白 → false
 *  4. 单字符 / 短词 → false（MIN_WORD_LEN=2 防误判）
 *  5. 含非 ASCII（中文 / 重音字符）→ false
 *  6. 含数字 → false
 *  7. 首尾标点宽容（如 "Wo,Bei" 视为 2 词，仍判拼音）
 *  8. 大小写不敏感
 */

import { describe, it, expect } from 'vitest'
import { isPinyin } from '../../../../apps/api/src/services/PinyinDetector'

describe('PinyinDetector.isPinyin', () => {
  describe('典型拼音（plan §10.4.1 示例）', () => {
    it('"Wo Bei Quan Wang Da Bao" → true', () => {
      expect(isPinyin('Wo Bei Quan Wang Da Bao')).toBe(true)
    })

    it('"Da Hua Xi You" → true', () => {
      expect(isPinyin('Da Hua Xi You')).toBe(true)
    })

    it('"Hong Lou Meng" → true', () => {
      expect(isPinyin('Hong Lou Meng')).toBe(true)
    })

    it('"Zhuang Yuan Mei" (复音节 zhuang) → true', () => {
      expect(isPinyin('Zhuang Yuan Mei')).toBe(true)
    })
  })

  describe('真英文标题', () => {
    it('"The Avengers" → false ("the" / "avengers" 都非拼音音节)', () => {
      expect(isPinyin('The Avengers')).toBe(false)
    })

    it('"Inception" → false', () => {
      expect(isPinyin('Inception')).toBe(false)
    })

    it('"Star Wars" → false', () => {
      expect(isPinyin('Star Wars')).toBe(false)
    })

    it('"Forrest Gump" → false', () => {
      expect(isPinyin('Forrest Gump')).toBe(false)
    })
  })

  describe('边界', () => {
    it('空字符串 → false', () => {
      expect(isPinyin('')).toBe(false)
    })

    it('null → false', () => {
      expect(isPinyin(null)).toBe(false)
    })

    it('undefined → false', () => {
      expect(isPinyin(undefined)).toBe(false)
    })

    it('纯空白 → false', () => {
      expect(isPinyin('   ')).toBe(false)
    })

    it('单字符 → false（MIN_WORD_LEN=2 防误判）', () => {
      expect(isPinyin('a')).toBe(false)
    })
  })

  describe('非法字符', () => {
    it('含中文 → false', () => {
      expect(isPinyin('中文 Title')).toBe(false)
    })

    it('含重音字符 → false（café）', () => {
      expect(isPinyin('Café Bao')).toBe(false)
    })

    it('含数字 → false', () => {
      expect(isPinyin('Bao 2024')).toBe(false)
    })
  })

  describe('标点 / 大小写宽容', () => {
    it('首尾标点剥离（"Wo, Bei." → true）', () => {
      expect(isPinyin('Wo, Bei.')).toBe(true)
    })

    it('全小写 / 全大写 等价（"WO BEI" → true）', () => {
      expect(isPinyin('WO BEI')).toBe(true)
      expect(isPinyin('wo bei')).toBe(true)
    })
  })
})
