/**
 * audit/api.ts — /admin/audit 视图 API 客户端（CHG-SN-6-01 / ADR-118 3 端点消费）
 *
 * 端点契约：ADR-118 §端点契约 row 1-3
 *   GET /admin/audit/logs
 *   GET /admin/audit/logs/:id
 *   GET /admin/audit/enums
 */

import { apiClient } from '@/lib/api-client'
import type {
  ListAdminAuditLogsParams,
  AdminAuditLogListRow,
  AdminAuditLogDetail,
  AdminAuditLogEnumsResult,
} from '@resovo/types'

export interface ListAdminAuditLogsApiResult {
  readonly data: readonly AdminAuditLogListRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export async function listAdminAuditLogs(
  params: ListAdminAuditLogsParams,
): Promise<ListAdminAuditLogsApiResult> {
  const qs = new URLSearchParams()
  if (params.page != null)       qs.set('page', String(params.page))
  if (params.limit != null)      qs.set('limit', String(params.limit))
  if (params.actorId)            qs.set('actorId', params.actorId)
  if (params.actionType)         qs.set('actionType', params.actionType)
  if (params.targetKind)         qs.set('targetKind', params.targetKind)
  if (params.targetId)           qs.set('targetId', params.targetId)
  if (params.requestId)          qs.set('requestId', params.requestId)
  if (params.from)               qs.set('from', params.from)
  if (params.to)                 qs.set('to', params.to)
  // sub 2 EXTEND（2026-05-24）：sort 字段透传
  if (params.sortField)          qs.set('sortField', params.sortField)
  if (params.sortDirection)      qs.set('sortDirection', params.sortDirection)
  const q = qs.toString()
  return apiClient.get<ListAdminAuditLogsApiResult>(
    `/admin/audit/logs${q ? `?${q}` : ''}`,
  )
}

export async function getAdminAuditLogDetail(id: string): Promise<AdminAuditLogDetail> {
  const result = await apiClient.get<{ data: AdminAuditLogDetail }>(
    `/admin/audit/logs/${encodeURIComponent(id)}`,
  )
  return result.data
}

export async function getAdminAuditEnums(): Promise<AdminAuditLogEnumsResult> {
  const result = await apiClient.get<{ data: AdminAuditLogEnumsResult }>(
    '/admin/audit/enums',
  )
  return result.data
}
