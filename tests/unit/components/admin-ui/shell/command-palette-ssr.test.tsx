/**
 * CommandPalette SSR 单测（CHG-SN-2-11 范式遵守 — Shell 范式章法 5C）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - open=false renderToString 输出空字符串（mounted=false 提前 return null）
 *   - open=true renderToString 不抛错（首次 render mounted=false → return null；
 *     useEffect / focus / createPortal 在 SSR 不执行；客户端 mount 后才显示）
 *   - groups=[] 空态在 SSR 下不抛错
 *
 * 注：与 DrawerShell 范式一致（CHG-SN-2-10）：
 *   useState mounted=false + useEffect setMounted(true) → SSR 首帧返回 null，
 *   客户端 hydration 后第二次 render 才创建 portal。
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { CommandPalette } from '../../../../../packages/admin-ui/src/shell/command-palette'
import type { CommandGroup } from '../../../../../packages/admin-ui/src/shell/types'

const GROUPS: readonly CommandGroup[] = [
  {
    id: 'nav',
    label: '导航',
    items: [
      { id: 'g-dashboard', label: '管理台站', shortcut: 'mod+1', kind: 'navigate', href: '/admin' },
      { id: 'g-moderation', label: '内容审核', shortcut: 'mod+2', kind: 'navigate', href: '/admin/moderation' },
    ],
  },
  {
    id: 'actions',
    label: '快捷操作',
    items: [{ id: 'a-help', label: '帮助', kind: 'invoke' }],
  },
]

const NOOP = () => {}

describe('CommandPalette — SSR', () => {
  it('open=false → 输出空字符串', () => {
    const html = renderToString(
      <CommandPalette open={false} groups={GROUPS} onClose={NOOP} onAction={NOOP} />,
    )
    expect(html).toBe('')
  })

  it('open=true → renderToString 不抛错（mounted=false 首帧 return null）', () => {
    expect(() =>
      renderToString(
        <CommandPalette open groups={GROUPS} onClose={NOOP} onAction={NOOP} />,
      ),
    ).not.toThrow()
  })

  it('open=true mounted=false → 输出空字符串（SSR 首帧）', () => {
    const html = renderToString(
      <CommandPalette open groups={GROUPS} onClose={NOOP} onAction={NOOP} />,
    )
    expect(html).toBe('')
  })

  it('groups=[] open=true → renderToString 不抛错', () => {
    expect(() =>
      renderToString(<CommandPalette open groups={[]} onClose={NOOP} onAction={NOOP} />),
    ).not.toThrow()
  })

  it('placeholder 自定义 + open=true → renderToString 不抛错', () => {
    expect(() =>
      renderToString(
        <CommandPalette open groups={GROUPS} onClose={NOOP} onAction={NOOP} placeholder="搜索命令..." />,
      ),
    ).not.toThrow()
  })
})
