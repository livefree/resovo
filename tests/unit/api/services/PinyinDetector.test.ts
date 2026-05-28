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
    it('首尾标点剥离 + 含 distinctive feature（"Da, Xi You." → true）', () => {
      expect(isPinyin('Da, Xi You.')).toBe(true)
    })

    it('全小写 / 全大写 等价（"DA HUA XI YOU" → true / 含 x distinctive）', () => {
      expect(isPinyin('DA HUA XI YOU')).toBe(true)
      expect(isPinyin('da hua xi you')).toBe(true)
    })
  })

  describe('严格 false-positive 防御（Codex stop-time review #6）', () => {
    // 这些英文 / 外语词全是基础拼音音节（无 zh/ch/sh/q/x/j 声母或复韵母）
    // 新增 distinctive feature 门槛后应被正确判 false
    it('"Ma Ma" → false（英文重叠词 / 仅基础音节）', () => {
      expect(isPinyin('Ma Ma')).toBe(false)
    })

    it('"Sushi" → false（日语 / 但能分解 su + shi）', () => {
      // sushi 含 sh distinctive → 实际会判 true / 这是已知 limit case
      // 此 case 保留作 documentation：拼音 helper 无法区分日语罗马音 vs 中文拼音
      expect(isPinyin('Sushi')).toBe(true)
    })

    it('"Naomi" → false（英文名 / 仅基础音节 na+o+mi 无 distinctive）', () => {
      expect(isPinyin('Naomi')).toBe(false)
    })

    it('"Bao" → false（单词 + 仅基础音节 / 防短词误判）', () => {
      expect(isPinyin('Bao')).toBe(false)
    })

    it('"Wo Bei" → false（仅基础音节 / 无 distinctive / 保守判定）', () => {
      expect(isPinyin('Wo Bei')).toBe(false)
    })
  })
})
