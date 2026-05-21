'use client'

/**
 * video-picker.tsx — VideoPicker 编排组件（消灭 UUID 输入的钥匙）
 *
 * 真源：M-SN-SHARED-04-A / arch-reviewer Opus A− PASS（2026-05-21）
 *
 * 用法（单选 / 多选 discriminated union）：
 *   <VideoPicker value={v} onChange={setV} fetcher={fetcher} />
 *   <VideoPicker multiple value={vs} onChange={setVs} max={5} fetcher={fetcher} />
 *
 * fetcher 注入实现 admin-ui ↔ apps/* 隔离（ADR-103b）
 */

import { useCallback, useState } from 'react'
import { PickerTrigger } from './picker-trigger'
import { PickerDialog } from './picker-dialog'
import type {
  PickerVideoItem,
  VideoPickerProps,
} from './video-picker.types'

export function VideoPicker(props: VideoPickerProps) {
  const {
    fetcher,
    filter,
    disabled = false,
    required = false,
    error,
    label,
    placeholder = props.multiple ? '选择视频（可多选）...' : '选择视频...',
    dialogTitle,
    id,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'data-testid': testid,
  } = props

  const [open, setOpen] = useState(false)

  const handleOpen = useCallback(() => setOpen(true), [])
  const handleClose = useCallback(() => setOpen(false), [])

  // single 模式
  if (!props.multiple) {
    const { value, onChange } = props
    const handleConfirm = (items: readonly PickerVideoItem[]) => {
      onChange(items[0] ?? null)
      setOpen(false)
    }
    const handleClear = () => onChange(null)
    return (
      <>
        <PickerTrigger
          label={label}
          required={required}
          value={value}
          multiple={false}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          onOpen={handleOpen}
          onClear={handleClear}
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          data-testid={testid}
        />
        <PickerDialog
          open={open}
          multiple={false}
          initialSelection={value ? [value] : []}
          title={dialogTitle ?? '选择视频'}
          fetcher={fetcher}
          filter={filter}
          onConfirm={handleConfirm}
          onClose={handleClose}
          data-testid={testid}
        />
      </>
    )
  }

  // multi 模式
  const { value: multiValue, onChange: multiOnChange, max } = props
  const handleConfirmMulti = (items: readonly PickerVideoItem[]) => {
    multiOnChange(items)
    setOpen(false)
  }
  const handleClearMulti = () => multiOnChange([])
  return (
    <>
      <PickerTrigger
        label={label}
        required={required}
        value={multiValue}
        multiple
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        onOpen={handleOpen}
        onClear={handleClearMulti}
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        data-testid={testid}
      />
      <PickerDialog
        open={open}
        multiple
        initialSelection={multiValue}
        max={max}
        title={dialogTitle ?? '选择视频（多选）'}
        fetcher={fetcher}
        filter={filter}
        onConfirm={handleConfirmMulti}
        onClose={handleClose}
        data-testid={testid}
      />
    </>
  )
}
