/**
 * video-route.ts — web-next URL 派生 re-export（ADR-160 D-160-7 / CHG-361-A）
 *
 * 实现已沉淀到 `packages/types/src/url-helpers.ts` 供跨 app 共享。
 * 本文件保留作为 web-next 内的 import 入口（向后兼容 / 既有消费方无需改 import 路径）。
 */

export { getVideoDetailHref } from '@resovo/types'
