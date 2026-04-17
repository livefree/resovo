import type { ReactNode } from 'react'
import { Modal } from '@/components/admin/Modal'

interface AdminModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function AdminModal({ open, onClose, title, children, size = 'md' }: AdminModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size={size}>
      {children}
    </Modal>
  )
}
