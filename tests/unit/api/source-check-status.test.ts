/**
 * source-check-status.test.ts — SRCHEALTH-P1-2（B2）
 *
 * apps/api/src/lib/source-check-status.ts computeCheckStatus 纯函数：
 *   1. 语义用例（镜像 worker 侧 aggregate-source-check-status.test.ts）
 *   2. 双侧对拍守卫：api 版与 worker 版（并行真源，ADR-107 禁跨 app import 的双副本）
 *      对全量输入组合断言输出一致——任何一侧单独改动语义都会在此失败。
 */

import { describe, it, expect } from 'vitest'
import { computeCheckStatus as apiCompute, type ProbeStatus } from '@/api/lib/source-check-status'
import { computeCheckStatus as workerCompute } from '../../../apps/worker/src/jobs/source-health/aggregate-source-check-status'

describe('computeCheckStatus (api 侧 / SRCHEALTH-P1-2)', () => {
  it('全 pending → pending', () => {
    expect(apiCompute(['pending', 'pending'])).toBe('pending')
  })

  it('全 dead → all_dead', () => {
    expect(apiCompute(['dead', 'dead'])).toBe('all_dead')
  })

  it('全 ok → ok', () => {
    expect(apiCompute(['ok', 'ok'])).toBe('ok')
  })

  it('ok + dead 混合 → partial', () => {
    expect(apiCompute(['ok', 'dead'])).toBe('partial')
  })

  it('ok + pending 混合 → partial', () => {
    expect(apiCompute(['ok', 'pending'])).toBe('partial')
  })

  it('空数组 → pending（调用方约定：无 active 源时不写库，此返回值仅防御）', () => {
    expect(apiCompute([])).toBe('pending')
  })

  it('partial + dead（无 ok）→ partial', () => {
    expect(apiCompute(['partial', 'dead'])).toBe('partial')
  })

  it('单源各态：ok→ok / dead→all_dead / pending→pending / partial→partial', () => {
    expect(apiCompute(['ok'])).toBe('ok')
    expect(apiCompute(['dead'])).toBe('all_dead')
    expect(apiCompute(['pending'])).toBe('pending')
    expect(apiCompute(['partial'])).toBe('partial')
  })
})

describe('双侧对拍守卫（api lib ↔ worker aggregate 并行真源）', () => {
  const STATES: readonly ProbeStatus[] = ['pending', 'ok', 'partial', 'dead']

  it('长度 0–3 全组合输出一致（85 组）', () => {
    const inputs: ProbeStatus[][] = [[]]
    for (const a of STATES) {
      inputs.push([a])
      for (const b of STATES) {
        inputs.push([a, b])
        for (const c of STATES) {
          inputs.push([a, b, c])
        }
      }
    }
    for (const input of inputs) {
      expect(apiCompute(input), `输入 [${input.join(',')}] 双侧不一致`).toBe(workerCompute(input))
    }
  })
})
