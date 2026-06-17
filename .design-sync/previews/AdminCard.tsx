import { AdminCard } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }

const bodyText: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  lineHeight: 1.6,
}

const metaRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: 8,
}

// canonical：带 header+body 的基础卡片（视频元数据）
export const Basic = () => (
  <div style={{ ...col, maxWidth: 480 }}>
    <AdminCard
      header={{
        title: '视频基本信息',
        subtitle: 'ID: vid_20240117_8821 · TMDB 已匹配',
      }}
    >
      <div style={bodyText}>
        <div><strong>标题：</strong>流浪地球 2</div>
        <div><strong>类型：</strong>科幻 / 动作</div>
        <div><strong>地区：</strong>中国大陆</div>
        <div><strong>年份：</strong>2023</div>
        <div style={metaRow}>
          <span>更新时间：2024-01-17 14:22</span>
          <span>来源：TMDB</span>
        </div>
      </div>
    </AdminCard>
  </div>
)

// surface 层级轴：elevated / plain / subtle
export const Surfaces = () => (
  <div style={{ ...col, maxWidth: 520 }}>
    <AdminCard surface="elevated" header={{ title: 'elevated（默认浮起层）', subtitle: '卡片在页面背景色上浮起' }}>
      <div style={bodyText}>用于 Dashboard 主卡片、详情面板等浮起区域</div>
    </AdminCard>
    <AdminCard surface="plain" header={{ title: 'plain（同 page 层）', subtitle: '与页面底色保持一致' }}>
      <div style={bodyText}>用于 nested card 避免颜色叠加过深，嵌套在 elevated 卡内</div>
    </AdminCard>
    <AdminCard surface="subtle" header={{ title: 'subtle（最浅，call-out）', subtitle: '背景略淡于 plain' }}>
      <div style={bodyText}>用于提示框、说明区块等引用风格卡</div>
    </AdminCard>
  </div>
)

// 状态修饰：ok / warn / danger
export const Status = () => (
  <div style={{ ...col, maxWidth: 480 }}>
    <AdminCard
      status="ok"
      header={{
        title: '数据同步正常',
        subtitle: 'TMDB 双源已覆盖，最后更新 5 分钟前',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-ok, var(--state-success-fg))' }}>
        ✓ 共 1,284 条记录已同步，元数据完整率 98.3%
      </div>
    </AdminCard>
    <AdminCard
      status="warn"
      header={{
        title: '线路可用性下降',
        subtitle: '资源 #2241 · 3 条线路超时',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-warn, var(--state-warning-fg))' }}>
        ⚠ 已有 3 条备用线路响应超时，建议检查 CDN 节点状态
      </div>
    </AdminCard>
    <AdminCard
      status="danger"
      header={{
        title: '爬虫任务异常',
        subtitle: '豆瓣 Cookie 已过期',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-danger, var(--state-error-fg))' }}>
        ✗ Cookie 验证失败，最近 47 条抓取任务中断，需重新登录授权
      </div>
    </AdminCard>
  </div>
)

// 带 footer + actions 的完整卡片
export const WithFooter = () => (
  <div style={{ ...col, maxWidth: 480 }}>
    <AdminCard
      header={{
        title: '审核备注',
        subtitle: '由系统自动生成，可补充人工说明',
        actions: (
          <button
            type="button"
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--accent-default)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            编辑
          </button>
        ),
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
          <span>最后修改：审核员 #admin_009 · 2024-01-15</span>
          <span>备注 ID: note_18834</span>
        </div>
      }
    >
      <div style={bodyText}>
        该视频元数据已经人工核对，TMDB 标题与豆瓣标题存在差异，以 TMDB 为准（"流浪地球 2" vs "流浪地球 II"）。封面已替换为官方横图。
      </div>
    </AdminCard>
  </div>
)
