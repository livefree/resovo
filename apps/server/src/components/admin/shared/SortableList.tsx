'use client'

/**
 * SortableList — admin 有序列表 primitive（ADR-049）
 * 消费 @dnd-kit/core + @dnd-kit/sortable；外部模块不得直接使用 @dnd-kit 原语。
 * 键盘：↑↓ 移位；无障碍：aria-roledescription="sortable item"
 */

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SortableListProps<T extends { id: string }> {
  items: T[]
  onReorder: (newItems: T[]) => void
  renderItem: (item: T, index: number) => ReactNode
  disabled?: boolean
  'data-testid'?: string
}

// ── SortableItem wrapper ──────────────────────────────────────────────────────

function SortableItem({
  id,
  children,
  disabled,
}: {
  id: string
  children: ReactNode
  disabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

// ── SortableList ──────────────────────────────────────────────────────────────

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  disabled,
  'data-testid': testId,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div data-testid={testId}>
          {items.map((item, index) => (
            <SortableItem key={item.id} id={item.id} disabled={disabled}>
              {renderItem(item, index)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
