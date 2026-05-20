'use client'

/**
 * RoleMatrixModal.tsx — 角色权限矩阵只读 Modal（CHG-SN-7-MISC-USERS-1）
 *
 * 设计：reference.md §5.10「page head + actions：角色矩阵、邀请用户」
 * 只读展示，无 API 调用。
 */
import type { CSSProperties } from 'react'
import { Modal } from '@resovo/admin-ui'

// ── 权限矩阵数据 ──────────────────────────────────────────────────

interface PermissionRow {
  readonly feature: string
  readonly user: boolean
  readonly moderator: boolean
  readonly admin: boolean
}

const PERMISSION_MATRIX: readonly PermissionRow[] = [
  { feature: '浏览公开内容',     user: true,  moderator: true,  admin: true  },
  { feature: '投稿 / 举报',      user: true,  moderator: true,  admin: true  },
  { feature: '字幕管理',         user: false, moderator: true,  admin: true  },
  { feature: '内容审核',         user: false, moderator: true,  admin: true  },
  { feature: '爬虫控制',         user: false, moderator: false, admin: true  },
  { feature: '用户管理',         user: false, moderator: false, admin: true  },
  { feature: '视频库编辑',       user: false, moderator: false, admin: true  },
  { feature: '首页运营位',       user: false, moderator: false, admin: true  },
  { feature: '图片健康',         user: false, moderator: false, admin: true  },
  { feature: '站点设置',         user: false, moderator: false, admin: true  },
  { feature: '审计日志',         user: false, moderator: false, admin: true  },
]

// ── 样式 ──────────────────────────────────────────────────────────

const BODY_STYLE: CSSProperties = {
  padding: '20px',
  overflowY: 'auto',
}

const TABLE_STYLE: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--font-size-sm)',
}

const TH_STYLE: CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-sunken)',
}

const TH_CENTER_STYLE: CSSProperties = { ...TH_STYLE, textAlign: 'center' }

const TD_STYLE: CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--fg-default)',
}

const TD_CENTER_STYLE: CSSProperties = { ...TD_STYLE, textAlign: 'center' }

const CHECK_STYLE: CSSProperties = {
  color: 'var(--state-success-fg)',
  fontWeight: 700,
  fontSize: 'var(--font-size-sm)',
}

const DASH_STYLE: CSSProperties = {
  color: 'var(--fg-subtle)',
}

// ── 组件 ─────────────────────────────────────────────────────────

export interface RoleMatrixModalProps {
  readonly open: boolean
  readonly onClose: () => void
}

export function RoleMatrixModal({ open, onClose }: RoleMatrixModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="角色权限矩阵"
      size="md"
      data-testid="role-matrix-modal"
    >
      <div style={BODY_STYLE}>
        <table style={TABLE_STYLE} data-role-matrix>
          <thead>
            <tr>
              <th style={TH_STYLE}>功能</th>
              <th style={TH_CENTER_STYLE}>用户</th>
              <th style={TH_CENTER_STYLE}>版主</th>
              <th style={TH_CENTER_STYLE}>管理员</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MATRIX.map((row) => (
              <tr key={row.feature} data-matrix-row>
                <td style={TD_STYLE}>{row.feature}</td>
                <td style={TD_CENTER_STYLE}>
                  {row.user
                    ? <span style={CHECK_STYLE} aria-label="允许">✓</span>
                    : <span style={DASH_STYLE} aria-label="不允许">—</span>}
                </td>
                <td style={TD_CENTER_STYLE}>
                  {row.moderator
                    ? <span style={CHECK_STYLE} aria-label="允许">✓</span>
                    : <span style={DASH_STYLE} aria-label="不允许">—</span>}
                </td>
                <td style={TD_CENTER_STYLE}>
                  {row.admin
                    ? <span style={CHECK_STYLE} aria-label="允许">✓</span>
                    : <span style={DASH_STYLE} aria-label="不允许">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
