import { Modal, AdminButton } from '@resovo/admin-ui'

const body: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 }
const warn: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--state-error-fg)', background: 'var(--state-error-bg, color-mix(in srgb, var(--state-error-fg) 10%, transparent))', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }
const foot: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }
const para: React.CSSProperties = { fontSize: 'var(--font-size-sm-tight)', color: 'var(--fg-default)', margin: 0 }
const muted: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', margin: 0 }

// sm 尺寸 — 删除确认弹窗
export const ConfirmDeleteSm = () => (
  <Modal open={true} size="sm" onClose={() => {}} title="删除 Banner">
    <div style={body}>
      <p style={para}>确认删除以下 Banner？</p>
      <div style={{ padding: '8px 12px', background: 'var(--bg-surface-row)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm-tight)', color: 'var(--fg-default)', fontWeight: 500 }}>
        夏日限定特辑
      </div>
      <p style={warn}>硬删除不可恢复；前台首屏将立即不再展示该 Banner。</p>
      <div style={foot}>
        <AdminButton variant="ghost" size="sm">取消</AdminButton>
        <AdminButton variant="danger" size="sm">确认删除</AdminButton>
      </div>
    </div>
  </Modal>
)

// md 尺寸 — 批量添加视频（默认 size）
export const BatchAddVideosMd = () => (
  <Modal open={true} size="md" onClose={() => {}} title="批量添加视频">
    <div style={body}>
      <p style={para}>粘贴视频 ID，每行一个（最多 100 条）：</p>
      <textarea
        style={{ width: '100%', height: 120, fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-row)', color: 'var(--fg-default)', resize: 'vertical', boxSizing: 'border-box' }}
        defaultValue={'vid_20240523_001\nvid_20240523_002\nvid_20240523_003'}
        readOnly
      />
      <p style={muted}>已解析 3 个 ID · 0 个格式错误</p>
      <div style={foot}>
        <AdminButton variant="ghost" size="sm">取消</AdminButton>
        <AdminButton variant="primary" size="sm">添加至模块</AdminButton>
      </div>
    </div>
  </Modal>
)

// lg 尺寸 — 发布确认（含风险摘要）
export const PublishConfirmLg = () => (
  <Modal open={true} size="lg" onClose={() => {}} title="发布首页配置">
    <div style={body}>
      <p style={para}>以下变更将在 30 秒内同步至线上前台，请仔细核对：</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
        <thead>
          <tr style={{ background: 'var(--bg-surface-row)' }}>
            <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--fg-muted)', fontWeight: 500 }}>类型</th>
            <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--fg-muted)', fontWeight: 500 }}>内容</th>
            <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--fg-muted)', fontWeight: 500 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {[
            { type: 'Banner', content: '夏日限定特辑', op: '新增' },
            { type: '运营位', content: '热播番剧 · 第 3 位', op: '排序变更' },
            { type: '运营位', content: '最新上架 · 全部下线', op: '删除' },
          ].map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '6px 10px', color: 'var(--fg-muted)' }}>{row.type}</td>
              <td style={{ padding: '6px 10px', color: 'var(--fg-default)' }}>{row.content}</td>
              <td style={{ padding: '6px 10px', color: row.op === '删除' ? 'var(--state-error-fg)' : 'var(--state-success-fg)' }}>{row.op}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={foot}>
        <AdminButton variant="ghost" size="sm">取消</AdminButton>
        <AdminButton variant="primary" size="sm">确认发布</AdminButton>
      </div>
    </div>
  </Modal>
)
