import { Pill } from '@resovo/admin-ui'

const row: React.CSSProperties = { display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap', alignItems: 'center' }
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }
const label: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 4 }

// 八种 variant 全集——视频库/审核/元数据 真实状态场景
export const AllVariants = () => (
  <div style={row}>
    <Pill variant="ok">已上架</Pill>
    <Pill variant="warn">待复审</Pill>
    <Pill variant="danger">已下架</Pill>
    <Pill variant="neutral">草稿</Pill>
    <Pill variant="info">采集中</Pill>
    <Pill variant="accent">置顶</Pill>
    <Pill variant="probe">探测</Pill>
    <Pill variant="render">渲染</Pill>
  </div>
)

// 视频库行状态——真实上架/下架/待审/异常四色
export const VideoStatus = () => (
  <div style={col}>
    <div style={label}>视频库行状态 Pill（reference §6.1 status 列）</div>
    <div style={row}>
      <Pill variant="ok">已上架</Pill>
      <Pill variant="neutral">未发布</Pill>
      <Pill variant="warn">待审核</Pill>
      <Pill variant="danger">源异常</Pill>
      <Pill variant="info">采集中</Pill>
    </div>
  </div>
)

// 版本历史面板——发布来源 + 当前版本标记
export const VersionHistory = () => (
  <div style={col}>
    <div style={label}>版本历史 Pill（VersionHistoryPanel 真实用法）</div>
    <div style={row}>
      <Pill variant="accent">发布</Pill>
      <Pill variant="warn">回滚</Pill>
      <Pill variant="neutral">当前版本</Pill>
    </div>
    <div style={label}>画布草稿标记 + 区块 key 展示</div>
    <div style={row}>
      <Pill variant="accent">草稿 · 未发布</Pill>
      <Pill variant="neutral">hero_banner</Pill>
      <Pill variant="neutral">carousel_main</Pill>
    </div>
  </div>
)

// 候选池过滤状态——来源/过滤原因/已应用/聚合 gap provider
export const CandidatePool = () => (
  <div style={col}>
    <div style={label}>候选池状态（CandidatePoolPanel 真实用法）</div>
    <div style={row}>
      <Pill variant="info">豆瓣推荐</Pill>
      <Pill variant="warn">已过滤：版权区域</Pill>
      <Pill variant="ok">已应用</Pill>
    </div>
    <div style={label}>gap provider 标记</div>
    <div style={row}>
      <Pill variant="neutral">TMDB</Pill>
      <Pill variant="neutral">豆瓣</Pill>
      <Pill variant="neutral">Bangumi</Pill>
    </div>
  </div>
)

// probe / render 双信号 variant——DualSignal 配套展示
export const ProbeRender = () => (
  <div style={col}>
    <div style={label}>probe / render 双信号状态 Pill</div>
    <div style={row}>
      <Pill variant="probe">探测 OK</Pill>
      <Pill variant="probe">探测失败</Pill>
      <Pill variant="render">渲染正常</Pill>
      <Pill variant="render">渲染超时</Pill>
    </div>
  </div>
)
