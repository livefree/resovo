/**
 * csv-export.ts — 客户端 CSV 导出共享工具（CHG-SN-6-21）
 *
 * 单元函数纯函数 + DOM 副作用最小化：
 *   - toCsv：行 → RFC 4180 CSV 字符串（quote escape）
 *   - downloadCsv：toCsv → Blob → a.download 触发下载
 *
 * 不依赖任何业务类型；通过 columns accessor 解耦消费方。
 */

export interface CsvColumn<T> {
  /** 表头文本（CSV 第一行） */
  readonly header: string
  /** 行值取出函数，返回任意 JSON-safe 值（string/number/boolean/null/undefined/object） */
  readonly accessor: (row: T) => unknown
}

/**
 * 将单个值序列化为 CSV cell：
 *   - undefined / null → 空字符串
 *   - string → 含 quote/comma/newline 时整体加双引号 + 内部 quote 双倍
 *   - number / boolean → toString
 *   - object → JSON.stringify 再按 string 规则处理
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value)
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

/**
 * 行 + 列定义 → CSV 字符串。
 * 输出格式：CRLF 行尾（RFC 4180 推荐 / Excel 兼容）+ UTF-8。
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines: string[] = []
  lines.push(columns.map((c) => escapeCsvCell(c.header)).join(','))
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.accessor(row))).join(','))
  }
  return lines.join('\r\n')
}

/**
 * 触发浏览器下载：toCsv → Blob → 临时 a 标签。
 * 在 jsdom 测试环境中 URL.createObjectURL 可能被 polyfill 但不实际下载；
 * 测试侧通过 spy a.click 或 URL.createObjectURL 验证调用。
 *
 * @returns 实际下载的字符串体（便于断言内容）
 */
export function downloadCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  filename: string,
): string {
  const csv = toCsv(rows, columns)
  // BOM 让 Excel 正确识别 UTF-8（中文不乱码）
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 释放 blob（异步以避免某些浏览器还未触发下载就 revoke）
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return csv
}
