import type { ReactNode } from 'react'
import type { ColumnFilterRenderContext } from '@/components/admin/shared/table/useAdminColumnFilter'

type AdminColumnFilterContainerProps = {
  context: ColumnFilterRenderContext
  children: (context: ColumnFilterRenderContext) => ReactNode
}

// Render-prop container for column filter content.
// UI details are intentionally left to business modules.
export function AdminColumnFilterContainer(props: AdminColumnFilterContainerProps) {
  const { context, children } = props
  return <>{children(context)}</>
}
