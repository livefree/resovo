import type { ReactNode } from 'react'
import { createElement } from 'react'

/**
 * parseHighlight — 将 API 返回的含 <em> 高亮标记字符串转为 React 节点数组。
 *
 * 规则：
 *   - 用正则分割 `<em>...</em>` 片段
 *   - `<em>` 内文本提取为纯字符串，包裹在 <mark> 元素中（走 CSS 变量着色）
 *   - 普通片段直接作为字符串节点
 *   - 禁止 dangerouslySetInnerHTML
 */
export function parseHighlight(raw: string): ReactNode[] {
  // 以 <em>...</em> 为分隔符，保留捕获组
  const parts = raw.split(/(<em>.*?<\/em>)/g)

  return parts.map((part, index) => {
    const match = /^<em>(.*?)<\/em>$/.exec(part)
    if (match) {
      return createElement(
        'mark',
        {
          key: index,
          style: {
            background: 'var(--accent-muted)',
            color: 'var(--accent-default)',
            borderRadius: '2px',
            padding: '0 2px',
          },
        },
        match[1],
      )
    }
    return part
  })
}
