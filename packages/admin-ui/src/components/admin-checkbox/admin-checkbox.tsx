'use client'

/**
 * admin-checkbox.tsx — 后台 boolean toggle 通用原语（CHG-SN-6-09 / arch-reviewer Opus PASS）
 *
 * 真源：CHG-SN-6-09 起草卡 + arch-reviewer Opus 1 轮 CONDITIONAL PASS（条件已满足：本注释明示 YAGNI）
 *
 * 消费方场景（≥ 5 处沉淀阈值已满足）：
 *   - SettingsTab showAdultContent / contentFilterEnabled / videoProxyEnabled
 *     / autoCrawlEnabled / autoCrawlRecentOnly（5 处）
 *   - 未来 ModerationTable batch select / Filter chip enable / indeterminate 三态
 *
 * 视觉契约：
 *   - 包壳原生 `<input type="checkbox">` + `accent-color: var(--accent-default)` 上色
 *   - 自绘 svg 否决（CHG-SN-6-09 起草段 §6 否决方案 A）
 *   - 14px 统一尺寸（无 size 档；YAGNI / 未来 ≥ 2 处差异化需求时加 prop 不破契约）
 *   - label + description 双层布局（label 主标 / description 灰字辅助）
 *   - indeterminate 三态通过 ref + useEffect 写 DOM（React 不直接 prop 化）
 *
 * **YAGNI 决策明示（arch-reviewer Opus CONDITIONAL 条件）**：
 *   - 不暴露 `size` Prop：5 处消费方全 form 内联场景无对比需求；未来 ≥ 2 处
 *     需求时按增量 prop 路径加（不破契约）
 *   - 不暴露 `error` Prop：boolean toggle 与表单 required 校验脱钩；admin 后台
 *     必填 checkbox 是边缘场景；未来 ≥ 2 处需求时增量加
 *
 * 不变约束：
 *   - 零业务视图消费 / 零图标库依赖 / Edge Runtime 兼容
 *   - token 引用 100%（accent-color / fg-default / fg-muted）/ 零硬编码颜色
 */

import React from 'react'

export interface AdminCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** 受控选中态；省略走非受控（defaultChecked via ...rest） */
  readonly checked?: boolean
  /** 三态 indeterminate；true 时视觉部分选中，不影响 checked 值 */
  readonly indeterminate?: boolean
  /** 主标签；省略不渲染 <label> 包裹层（裸 input） */
  readonly label?: React.ReactNode
  /** 副说明（灰字辅助，位于 label 下方） */
  readonly description?: React.ReactNode
  /** 容器额外 className */
  readonly wrapperClassName?: string
  /** 容器测试 id（input 本身 data-testid 通过 ...rest 透传） */
  readonly 'data-testid'?: string
}

const BOX_BASE: React.CSSProperties = {
  width: '14px',
  height: '14px',
  margin: 0,
  flexShrink: 0,
  cursor: 'pointer',
  accentColor: 'var(--accent-default)',
}

const LABEL_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'flex-start',
  gap: '8px',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  lineHeight: 1.5,
}

const DESCRIPTION_BASE: React.CSSProperties = {
  display: 'block',
  marginTop: '2px',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

export function AdminCheckbox({
  checked,
  indeterminate,
  label,
  description,
  disabled,
  wrapperClassName,
  'data-testid': testId,
  ...rest
}: AdminCheckboxProps): React.ReactElement {
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate === true
  }, [indeterminate])

  const boxStyle: React.CSSProperties = {
    ...BOX_BASE,
    ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null),
  }

  // testid 直接放 input（checkbox 是单焦点元素，与 AdminInput 多 slot 不同；
  // 消费方 fireEvent.click(byTestId) 命中即为预期）
  const inputEl = (
    <input
      ref={ref}
      type="checkbox"
      data-admin-checkbox-control
      data-testid={testId}
      checked={checked}
      disabled={disabled}
      aria-checked={indeterminate ? 'mixed' : checked}
      style={boxStyle}
      {...rest}
    />
  )

  if (label === undefined) {
    return inputEl
  }

  return (
    <label
      data-admin-checkbox
      data-disabled={disabled ? '' : undefined}
      data-indeterminate={indeterminate ? '' : undefined}
      className={wrapperClassName}
      style={{
        ...LABEL_BASE,
        ...(disabled ? { opacity: 0.7, cursor: 'not-allowed' } : null),
      }}
    >
      {inputEl}
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span data-admin-checkbox-label>{label}</span>
        {description !== undefined && description !== null && (
          <span data-admin-checkbox-description style={DESCRIPTION_BASE}>{description}</span>
        )}
      </span>
    </label>
  )
}
