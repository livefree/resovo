'use client'

/**
 * UserMenuActionModal — 用户菜单 4 个 noop action 的反馈 Modal（CHG-SN-8-FUP-USER-MENU）
 *
 * 真源：CHG-SN-8-FUP-USER-MENU / 用户问题 #13「用户菜单项目多不可用」修复
 *
 * 支持的 action（与 UserMenuAction union 对齐，去掉 theme + logout + switchAccount）：
 *   - profile      → 显示当前用户信息（user.name + role + email）+ 「编辑（筹备中）」disabled
 *   - preferences  → 主题切换（复用 ThemeContext）+ 「更多偏好筹备中」占位
 *   - help         → 工作流速查（W1-W5 链接）+ 高频快捷键 + 完整说明书入口
 *
 * switchAccount 走 Toast 不在本 Modal 范围（admin-shell-client 直接 toast.push）
 */

import { type CSSProperties } from 'react'
import { Modal, AdminButton } from '@resovo/admin-ui'
import type { AdminShellUser } from '@resovo/admin-ui'

export type UserMenuActionModalType = 'profile' | 'preferences' | 'help'

export interface UserMenuActionModalProps {
  readonly type: UserMenuActionModalType | null
  readonly user: AdminShellUser
  readonly theme: 'light' | 'dark'
  readonly onThemeToggle: () => void
  readonly onClose: () => void
}

const FIELD_ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: 12,
  padding: '8px 0',
  borderBottom: '1px solid var(--border-subtle)',
  alignItems: 'center',
  fontSize: 'var(--font-size-sm)',
}

const FIELD_LABEL: CSSProperties = {
  color: 'var(--fg-muted)',
}

const FIELD_VALUE: CSSProperties = {
  color: 'var(--fg-default)',
  fontWeight: 500,
}

const SECTION_TITLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  marginTop: 12,
  marginBottom: 8,
}

const NOTE_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  marginTop: 12,
  padding: '8px 10px',
  background: 'var(--bg-subtle, var(--bg-surface))',
  borderRadius: 'var(--radius-md)',
}

const LIST_STYLE: CSSProperties = {
  margin: '4px 0 0 0',
  padding: '0 0 0 20px',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
}

const KBD_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: 4,
  background: 'var(--bg-subtle, var(--bg-surface))',
  border: '1px solid var(--border-subtle)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  marginRight: 4,
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
  paddingTop: 12,
  borderTop: '1px solid var(--border-subtle)',
}

const TITLE_BY_TYPE: Record<UserMenuActionModalType, string> = {
  profile: '个人信息',
  preferences: '偏好设置',
  help: '帮助与说明书',
}

export function UserMenuActionModal({
  type,
  user,
  theme,
  onThemeToggle,
  onClose,
}: UserMenuActionModalProps) {
  if (!type) {
    return <Modal open={false} onClose={onClose} title="" size="sm"><span /></Modal>
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={TITLE_BY_TYPE[type]}
      size="sm"
      data-testid={`user-menu-modal-${type}`}
    >
      {type === 'profile' && (
        <div data-testid="user-menu-profile-content">
          <div style={FIELD_ROW}>
            <span style={FIELD_LABEL}>显示名</span>
            <span style={FIELD_VALUE}>{user.displayName}</span>
          </div>
          <div style={FIELD_ROW}>
            <span style={FIELD_LABEL}>邮箱</span>
            <span style={FIELD_VALUE}>{user.email}</span>
          </div>
          <div style={FIELD_ROW}>
            <span style={FIELD_LABEL}>角色</span>
            <span style={FIELD_VALUE}>{user.role === 'admin' ? '管理员 (admin)' : '审核员 (moderator)'}</span>
          </div>
          <div style={FIELD_ROW}>
            <span style={FIELD_LABEL}>用户 ID</span>
            <span style={{ ...FIELD_VALUE, fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '11px' }}>{user.id}</span>
          </div>
          <div style={NOTE_STYLE}>
            个人信息编辑功能筹备中（CHG-SN-8-FUP-USER-MENU 后续 follow-up）；当前角色变更请联系 admin 在「用户管理」页操作。
          </div>
          <div style={FOOTER_STYLE}>
            <AdminButton size="sm" variant="default" disabled data-testid="user-menu-profile-edit">
              编辑（筹备中）
            </AdminButton>
            <AdminButton size="sm" variant="primary" onClick={onClose}>关闭</AdminButton>
          </div>
        </div>
      )}

      {type === 'preferences' && (
        <div data-testid="user-menu-preferences-content">
          <div style={SECTION_TITLE}>主题</div>
          <div style={FIELD_ROW}>
            <span style={FIELD_LABEL}>当前主题</span>
            <span style={FIELD_VALUE}>{theme === 'dark' ? '深色 (dark)' : '浅色 (light)'}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <AdminButton size="sm" variant="default" onClick={onThemeToggle} data-testid="user-menu-preferences-theme-toggle">
              切换为{theme === 'dark' ? '浅色' : '深色'}主题
            </AdminButton>
          </div>
          <div style={SECTION_TITLE}>其它偏好（筹备中）</div>
          <ul style={LIST_STYLE}>
            <li style={{ color: 'var(--fg-muted)' }}>品牌切换（M-SN-N）</li>
            <li style={{ color: 'var(--fg-muted)' }}>语言切换（M-SN-N）</li>
            <li style={{ color: 'var(--fg-muted)' }}>密度切换（M-SN-N）</li>
          </ul>
          <div style={FOOTER_STYLE}>
            <AdminButton size="sm" variant="primary" onClick={onClose}>关闭</AdminButton>
          </div>
        </div>
      )}

      {type === 'help' && (
        <div data-testid="user-menu-help-content">
          <div style={SECTION_TITLE}>常用工作流</div>
          <ul style={LIST_STYLE}>
            <li>W1 · 采集 → 审核 → 上架（金票工作流）</li>
            <li>W2 · 线路失效 → 补源 → 复测</li>
            <li>W3 · 封面失效 → 切 fallback 域</li>
            <li>W4 · 合并候选 → 确认 / 拒绝 / 回滚</li>
            <li>W5 · 首页运营位编排</li>
          </ul>

          <div style={SECTION_TITLE}>高频快捷键</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-default)', lineHeight: 2 }}>
            <span style={KBD_STYLE}>⌘1</span>管理台站
            <span style={{ marginLeft: 12 }} />
            <span style={KBD_STYLE}>⌘2</span>内容审核
            <span style={{ marginLeft: 12 }} />
            <span style={KBD_STYLE}>⌘3</span>视频库
            <br />
            <span style={KBD_STYLE}>⌘4</span>字幕管理
            <span style={{ marginLeft: 12 }} />
            <span style={KBD_STYLE}>⌘5</span>采集控制
            <span style={{ marginLeft: 12 }} />
            <span style={KBD_STYLE}>⌘,</span>站点设置
            <br />
            <span style={KBD_STYLE}>⌘K</span>命令面板
            <span style={{ marginLeft: 12 }} />
            <span style={KBD_STYLE}>J</span>/<span style={KBD_STYLE}>K</span>审核台上下
            <span style={{ marginLeft: 12 }} />
            <span style={KBD_STYLE}>A</span>通过 <span style={KBD_STYLE}>R</span>拒绝 <span style={KBD_STYLE}>S</span>跳过
          </div>

          <div style={NOTE_STYLE}>
            完整说明书位于 <code>docs/manual/</code>：每个页面对应一份 <code>P-&lt;slug&gt;.md</code>；端到端工作流见 <code>10-workflows/</code>。
          </div>

          <div style={FOOTER_STYLE}>
            <AdminButton size="sm" variant="primary" onClick={onClose}>关闭</AdminButton>
          </div>
        </div>
      )}
    </Modal>
  )
}
