/**
 * metadata-tooltip.ts — 统一 tooltip 结构化构造器（ADR-201 §Tooltip / META-33-A）
 *
 * 纯函数，**零 react import**（C1）：供 cluster（hover tooltip）与 panel（headline）共用，
 * 单测零渲染对拍。把 `MetadataStatusSummary` 结构化字段 → 固定结构文本行（ADR-201 §22704）：
 *
 *   元数据：部分增强 · 完整度 72 · 最近 2026-06-14
 *   豆瓣：已应用 · 3541415 · 自动匹配 0.92
 *   Bangumi：待确认 · bgm.tv/123456 · 年份一致
 *   TMDB：未获取
 *   IMDb：未获取
 *   问题：Bangumi 候选尚未应用
 *   下一步：确认候选
 *
 * 约束：最多 4 provider 行 + 3 issue 行（超出「另有 N 个问题」）；完整度非「评分」；
 * 时间走消费方注入文案（i18n/时间库不下沉）；不出现「富集状态/外部元数据」并列标签。
 */

import { METADATA_PROVIDER_ORDER } from '@resovo/types'
import type {
  MetadataProviderStatus,
  MetadataStatusIssue,
  MetadataStatusSummary,
} from '@resovo/types'
import { SOURCE_LABEL } from '../enrichment-badge/enrichment-logos'
import type { MetadataTooltipModel, MetadataTooltipOptions } from './metadata-status.types'
import {
  ISSUE_CODE_LABEL,
  MATCH_METHOD_LABEL,
  NEXT_ACTION_LABEL,
  OVERALL_LABEL,
  PROVIDER_STATE_LABEL,
} from './metadata-status-labels'

const MAX_ISSUE_LINES = 3
const SEP = ' · '

/** 置信度 0..1 → 两位小数（对齐 ADR 示例 `0.92`）。 */
function formatConfidence(confidence: number): string {
  return confidence.toFixed(2)
}

/** 单 provider 行：`{来源}：{状态}[ · {外部ID/label}][ · {匹配方式}[ {置信度}]]`，缺字段降级省略。 */
function buildProviderLine(status: MetadataProviderStatus): string {
  const segs: string[] = [`${SOURCE_LABEL[status.provider]}：${PROVIDER_STATE_LABEL[status.state]}`]

  // missing / not_applicable：仅状态文案（Phase 1 无凭证未配置 reasonCode，不裸露内部诊断码）
  if (status.state === 'missing' || status.state === 'not_applicable') {
    return segs.join(SEP)
  }

  const idText = status.label ?? status.externalId
  if (idText) segs.push(idText)

  if (status.matchMethod) {
    const method = MATCH_METHOD_LABEL[status.matchMethod] ?? status.matchMethod
    segs.push(status.confidence != null ? `${method} ${formatConfidence(status.confidence)}` : method)
  } else if (status.confidence != null) {
    segs.push(formatConfidence(status.confidence))
  }

  return segs.join(SEP)
}

/** issue 行文案：`问题：{来源 }{问题码中文}`（未知码回退 message 英文友好名）。 */
function buildIssueLine(issue: MetadataStatusIssue): string {
  const providerPart = issue.provider ? `${SOURCE_LABEL[issue.provider]} ` : ''
  const codeLabel = ISSUE_CODE_LABEL[issue.code] ?? issue.message
  return `问题：${providerPart}${codeLabel}`
}

/** issue 行集合：≤3 行，溢出时第 3 行替换为「另有 N 个问题」（保留 2 条 + 1 条汇总）。 */
function buildIssueLines(issues: readonly MetadataStatusIssue[]): string[] {
  if (issues.length <= MAX_ISSUE_LINES) return issues.map(buildIssueLine)
  return [
    buildIssueLine(issues[0]),
    buildIssueLine(issues[1]),
    `另有 ${issues.length - (MAX_ISSUE_LINES - 1)} 个问题`,
  ]
}

/** headline：`元数据：{overall}[ · 完整度 {score}][ · 最近 {enrichedAtLabel}]`。 */
function buildHeadline(summary: MetadataStatusSummary, enrichedAtLabel?: string): string {
  const segs: string[] = [`元数据：${OVERALL_LABEL[summary.overall]}`]
  if (summary.score != null) segs.push(`完整度 ${summary.score}`)
  if (enrichedAtLabel) segs.push(`最近 ${enrichedAtLabel}`)
  return segs.join(SEP)
}

/**
 * 构造统一 tooltip 结构化模型。provider 行固定按 `METADATA_PROVIDER_ORDER`（不依赖 Record key 序，C5）。
 */
export function buildMetadataTooltip(
  summary: MetadataStatusSummary,
  opts?: MetadataTooltipOptions,
): MetadataTooltipModel {
  const providerLines = METADATA_PROVIDER_ORDER.map((p) => buildProviderLine(summary.providers[p]))
  const issueLines = buildIssueLines(summary.issues)
  const nextActionLine =
    summary.nextAction === 'none' ? undefined : `下一步：${NEXT_ACTION_LABEL[summary.nextAction]}`

  return {
    headline: buildHeadline(summary, opts?.enrichedAtLabel),
    providerLines,
    issueLines,
    nextActionLine,
  }
}
