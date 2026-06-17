import { AdminTextarea } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const labelStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }

// canonical：站点公告文本域
export const Default = () => (
  <div style={col}>
    <div style={{ ...fieldStyle, maxWidth: 400 }}>
      <label style={labelStyle}>站点公告</label>
      <AdminTextarea
        rows={4}
        defaultValue="欢迎使用 Resovo 管理后台。当前版本 v2.1.0，元数据服务已接入 TMDB + 豆瓣双源。如遇问题请联系技术支持。"
        placeholder="请输入公告内容..."
      />
    </div>
  </div>
)

// 等宽字体（JSON / 代码配置）
export const Monospace = () => (
  <div style={col}>
    <div style={{ ...fieldStyle, maxWidth: 480 }}>
      <label style={labelStyle}>系统配置（JSON）</label>
      <AdminTextarea
        monospace
        rows={6}
        defaultValue={`{\n  "tmdb_api_key": "••••••••••••",\n  "douban_cookie": "sid=abc123; uid=12345",\n  "crawl_interval": 3600,\n  "proxy_host": "127.0.0.1:7890"\n}`}
      />
    </div>
    <div style={{ ...fieldStyle, maxWidth: 480 }}>
      <label style={labelStyle}>豆瓣 Cookie（等宽）</label>
      <AdminTextarea
        monospace
        rows={3}
        placeholder="粘贴 Cookie 字符串，例：bid=xxxxx; dbcl2=&quot;12345:abc&quot;"
      />
    </div>
  </div>
)

// 尺寸轴 sm/md/lg
export const Sizes = () => (
  <div style={col}>
    <div style={{ ...fieldStyle, maxWidth: 360 }}>
      <label style={labelStyle}>sm（小号）</label>
      <AdminTextarea size="sm" rows={2} defaultValue="小号文本域，用于行内备注或简短说明" />
    </div>
    <div style={{ ...fieldStyle, maxWidth: 360 }}>
      <label style={labelStyle}>md（中号，默认）</label>
      <AdminTextarea size="md" rows={3} defaultValue="中号文本域，标准后台表单场景" />
    </div>
    <div style={{ ...fieldStyle, maxWidth: 360 }}>
      <label style={labelStyle}>lg（大号）</label>
      <AdminTextarea size="lg" rows={4} defaultValue="大号文本域，适合较长内容的说明或描述字段" />
    </div>
  </div>
)

// 状态：错误态 + 禁用态
export const States = () => (
  <div style={col}>
    <div style={{ ...fieldStyle, maxWidth: 400 }}>
      <label style={labelStyle}>错误态（内容不符合要求）</label>
      <AdminTextarea
        rows={3}
        error
        defaultValue="此处内容包含违禁词汇，请修改后重新提交。"
      />
    </div>
    <div style={{ ...fieldStyle, maxWidth: 400 }}>
      <label style={labelStyle}>禁用态（只读配置）</label>
      <AdminTextarea
        rows={3}
        disabled
        defaultValue="此配置项已由运维团队锁定，不可在界面修改。如需变更请提交工单。"
      />
    </div>
  </div>
)
