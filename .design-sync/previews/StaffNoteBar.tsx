import { StaffNoteBar } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }

// display 态（只读，有编辑入口）
export const Display = () => (
  <div style={col}>
    <StaffNoteBar
      note="该视频标题与 TMDB 标准不符，建议运营二次确认发布时间。封面图已人工替换。"
      onEdit={() => {}}
    />
  </div>
)

// display 态（纯只读，无编辑入口）
export const DisplayReadonly = () => (
  <div style={col}>
    <StaffNoteBar
      note="已由超管锁定。请勿修改元数据，待版权确认后再操作。"
    />
  </div>
)

// 编辑态（editing=true）
export const Editing = () => (
  <div style={col}>
    <StaffNoteBar
      note="待运营确认封面图来源"
      onEdit={() => {}}
      editing
      onSubmit={async () => {}}
      onCancelEdit={() => {}}
      noteMaxLength={500}
    />
  </div>
)

// 提交中态（submitting=true）
export const Submitting = () => (
  <div style={col}>
    <StaffNoteBar
      note="检查字幕轨道，英文字幕已上传但未绑定"
      onEdit={() => {}}
      editing
      onSubmit={async () => {}}
      onCancelEdit={() => {}}
      submitting
    />
  </div>
)
