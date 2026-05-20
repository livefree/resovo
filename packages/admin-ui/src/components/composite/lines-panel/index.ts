/**
 * composite/lines-panel/index.ts — LinesPanel 复合组件公开 API
 *
 * 落地：FIX-B Stage B（CHG-SN-7-MISC-MOD-PLAYER；arch-reviewer Opus PASS）
 */

export { LinesPanel } from './lines-panel'
export { groupSourcesByLine } from './aggregate'
export type {
  LineAggregate,
  EpisodeMini,
  RawSourceRow,
  LinesPanelProps,
  LinesPanelDensity,
  GroupSourcesOptions,
} from './lines-panel.types'
