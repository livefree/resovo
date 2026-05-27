/**
 * player-shell-preview-mode.test.ts — CHG-361-D / ADR-160 D-160-5
 *
 * 覆盖 PlayerShell `previewMode` Props 派生的写入开关 `isPlaybackFeedbackEnabled`：
 * - 默认（undefined / 未传 Props）→ feedback 开启
 * - previewMode=false → feedback 开启
 * - previewMode=true → feedback 关闭（D-160-5 写入禁令）
 *
 * 注：当前 PlayerShell 未实装 usePlaybackFeedback hook（D-160-5 实证审查是前瞻性 advisory），
 *     本测试守护 Props → 派生 helper 的契约，为未来 feedback hook 接入提供回归保障。
 */

import { describe, it, expect } from 'vitest'
import { isPlaybackFeedbackEnabled } from '../../../apps/web-next/src/components/player/PlayerShell'

describe('isPlaybackFeedbackEnabled — ADR-160 D-160-5 写入开关', () => {
  it('未传 Props（undefined）→ feedback 开启（默认公开访问）', () => {
    expect(isPlaybackFeedbackEnabled(undefined)).toBe(true)
  })

  it('previewMode=false → feedback 开启', () => {
    expect(isPlaybackFeedbackEnabled(false)).toBe(true)
  })

  it('previewMode=true → feedback 关闭（preview 模式不写 audit / view_count / feedback）', () => {
    expect(isPlaybackFeedbackEnabled(true)).toBe(false)
  })
})
