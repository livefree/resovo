export interface SharedElementProps {
  /**
   * 跨路由匹配 id，约定格式：`${entity}:${entityId}:${slot}`，
   * 例如 'movie:123:cover' / 'movie:123:title'。
   */
  id: string
  /**
   * 语义角色，决定 FLIP 时的属性插值范围（REG-M3-01 消费）。
   */
  role?: 'cover' | 'title' | 'auto'
  as?: keyof React.JSX.IntrinsicElements
  priority?: number
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export interface SharedElementRef {
  getRect: () => DOMRect | null
  getElement: () => HTMLElement | null
}

export interface SharedElementRegistry {
  register: (id: string, el: HTMLElement, role: SharedElementProps['role']) => () => void
  unregister: (id: string) => void
  query: (id: string) => { element: HTMLElement; role: NonNullable<SharedElementProps['role']> } | null
}
