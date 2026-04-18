/**
 * AdminPageShell.tsx — 后台列表页容器（admin 薄包装）
 * CHG-319: 委托给 ListPageShell variant="admin"，保持向后兼容
 */

import {
  ListPageShell,
  type ListPageShellProps,
} from '@/components/shared/layout/ListPageShell'

export type AdminPageShellProps = Omit<ListPageShellProps, 'variant'>

export function AdminPageShell(props: AdminPageShellProps) {
  return <ListPageShell {...props} variant="admin" />
}
