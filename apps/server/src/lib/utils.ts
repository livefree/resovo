/**
 * utils.ts — 通用工具函数
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 Tailwind CSS className，支持条件和冲突处理 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
