/**
 * ToastViewport SSR 单测（CHG-SN-2-03 范式锁定）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - 服务端 renderToString 零 throw
 *   - SSR 输出含 viewport 容器但无 toast 卡（getQueueSnapshotSSR 返 empty）
 *   - 这是 Shell 9 张后续卡的范式不变量：所有 store-driven 组件 SSR 安全
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ToastViewport } from '../../../../../packages/admin-ui/src/shell/toast-viewport'

describe('ToastViewport — SSR renderToString（ADR-103a §4.4-2 Edge Runtime 兼容）', () => {
  it('renderToString 不抛错', () => {
    expect(() => renderToString(<ToastViewport />)).not.toThrow()
  })

  it('SSR 输出含 viewport 容器 + 0 toast 卡（getQueueSnapshotSSR 返 empty）', () => {
    const html = renderToString(<ToastViewport position="top-right" />)
    expect(html).toContain('data-toast-viewport="top-right"')
    expect(html).not.toContain('data-toast-id')
    expect(html).not.toContain('role="status"')
  })
})
