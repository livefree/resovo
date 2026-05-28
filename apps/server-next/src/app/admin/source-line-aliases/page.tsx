/**
 * /admin/source-line-aliases — Layer B 山名代号体系独立管理 UI
 *
 * 任务卡：CHG-368-B-B（ADR-164 §6 显示规约）
 * 范围：列表 + 行级编辑（displayName / codename / priority）+ 退役操作 + codename 字库可用性展示
 *
 * 与 /admin/sources 既有 SourceLineAliasPanel（侧栏式 display_name 编辑）的关系：
 *   - 既有 SourceLineAliasPanel 仅支持 display_name，是 ADR-117 时期最小可用实施
 *   - 本独立路径承接 ADR-164 §6 完整 Layer B 视图（codename / priority / 退役 / cooling 池）
 *   - 既有 SourceLineAliasPanel 暂保留（兼容历史 IA）/ 后续考虑迁移
 */

import { SourceLineAliasesClient } from './_client/SourceLineAliasesClient'

export const dynamic = 'force-dynamic'

export default function SourceLineAliasesPage() {
  return <SourceLineAliasesClient />
}
