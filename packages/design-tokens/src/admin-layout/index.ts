/**
 * admin-layout — admin 专属布局 token 命名空间
 * 由 ADR-102 引入；与 semantic / primitives / components / brands 平级
 * 消费方：apps/server-next + packages/admin-ui（M-SN-2+）
 * 跨域消费禁令：apps/web-next 任何路由 0 消费（ESLint no-restricted-imports + ts-morph CI 守卫，CHG-SN-1-07）
 */
export { adminShell } from './shell.js'
export type { AdminShellToken } from './shell.js'

export { adminTable } from './table.js'
export type { AdminTableToken } from './table.js'

export { adminDensity } from './density.js'
export type { AdminDensityToken } from './density.js'

export { adminShellZIndex } from './z-index.js'
export type { AdminShellZIndexToken } from './z-index.js'

export { adminShellSurfaces } from './surfaces.js'
export type { AdminShellSurfacesToken } from './surfaces.js'
