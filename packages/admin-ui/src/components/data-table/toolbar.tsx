/**
 * toolbar.tsx — DataTable v2 表格工具栏（槽位容器）
 * 真源：ADR-103 §4.4 Toolbar（CHG-SN-2-14）
 *
 * 职责：1 行容器，三个槽位（leading / columnSettings / trailing）；
 * 不持有数据，不调 query.patch（每个 slot 由消费方塞组件）。
 */
import React from 'react'

export interface ToolbarProps {
  /** 左侧槽：search input / 全局 filter trigger / FilterChipBar */
  readonly leading?: React.ReactNode
  /** 右侧自定义 actions（refresh / export / 新建等）*/
  readonly trailing?: React.ReactNode
  /** ⚙ 列设置触发器槽（紧贴 trailing 左侧）*/
  readonly columnSettings?: React.ReactNode
  readonly className?: string
}

const TOOLBAR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 0',
  minHeight: '44px',
}

const TRAILING_GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginLeft: 'auto',
  flexShrink: 0,
}

export function Toolbar({ leading, trailing, columnSettings, className }: ToolbarProps): React.ReactElement {
  return (
    <div
      data-toolbar
      role="toolbar"
      aria-label="表格工具栏"
      style={TOOLBAR_STYLE}
      className={className}
    >
      {leading && <div data-toolbar-leading style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>{leading}</div>}
      <div style={TRAILING_GROUP_STYLE}>
        {columnSettings}
        {trailing}
      </div>
    </div>
  )
}
