/**
 * admin/migration.ts — 数据导入导出 API
 * CHG-31: admin only
 *
 * GET  /admin/export/sources  — 导出播放源 JSON 文件
 * POST /admin/import/sources  — 导入播放源 JSON 文件（multipart）
 */

import type { FastifyInstance } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { db } from '@/api/lib/postgres'
import { MigrationService } from '@/api/services/MigrationService'
import { AuditLogService } from '@/api/services/AuditLogService'

export async function adminMigrationRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const migrationService = new MigrationService(db)
  const auditSvc = new AuditLogService(db)  // CHG-SN-6-RETRO-3-A

  // GET /admin/export/sources — 导出为 JSON 附件
  fastify.get('/admin/export/sources', { preHandler: auth }, async (_request, reply) => {
    const sources = await migrationService.exportSources()
    const date = new Date().toISOString().slice(0, 10)
    reply.header('Content-Type', 'application/json')
    reply.header('Content-Disposition', `attachment; filename=sources-${date}.json`)
    return reply.send(JSON.stringify(sources, null, 2))
  })

  // POST /admin/import/sources — 上传 JSON 文件导入
  fastify.post('/admin/import/sources', { preHandler: auth }, async (request, reply) => {
    const data = await (request as unknown as { file: () => Promise<MultipartFile | undefined> }).file()
    if (!data) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '未找到上传文件', status: 422 },
      })
    }

    // 读取文件内容
    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const content = Buffer.concat(chunks).toString('utf-8')

    // 解析 JSON
    let rawRecords: unknown[]
    try {
      const parsed = JSON.parse(content) as unknown
      if (!Array.isArray(parsed)) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '文件内容必须是 JSON 数组', status: 422 },
        })
      }
      rawRecords = parsed
    } catch {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'JSON 格式解析失败', status: 422 },
      })
    }

    const result = await migrationService.importSources(rawRecords)

    // CHG-SN-6-RETRO-3-A：审计 — 写 admin_audit_log（system.sources_import / ultrareview P0-3）
    // beforeJsonb: 输入记录数；afterJsonb: 实际导入 / 跳过 / 失败统计
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'system.sources_import',
      targetKind: 'system',
      targetId: null,
      beforeJsonb: { inputRecordCount: rawRecords.length },
      afterJsonb: result as unknown as Record<string, unknown>,
      requestId: request.id,
    })

    return reply.send({ data: result })
  })
}
