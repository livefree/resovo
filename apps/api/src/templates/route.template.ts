/**
 * TEMPLATE: Fastify API 路由
 * 使用方法：复制此文件，替换 [resource] 和 [Resource]，填充 TODO 部分
 * 删除所有注释后提交
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
// TODO: 替换为实际 Service
import { [Resource]Service } from '@/api/services/[Resource]Service'

// ── Schema 定义（放文件顶部，方便复用和修改）──────────────────────

// TODO: 替换为实际列表查询参数
const ListQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // 可选过滤字段示例：
  // type: z.enum(['movie', 'series']).optional(),
})

// TODO: 替换为实际详情路径参数
const IdParamSchema = z.object({
  id: z.string().min(1),  // short_id 格式
})

// TODO: 替换为实际创建/更新的请求体
const CreateBodySchema = z.object({
  title: z.string().min(1).max(200),
  // ...
})

// TODO: 替换为实际响应结构（可选，Fastify 会自动序列化）
// const [Resource]Schema = z.object({ ... })

// ── 路由注册函数 ──────────────────────────────────────────────────

export async function [resource]Routes(fastify: FastifyInstance) {
  const service = new [Resource]Service(fastify.db, fastify.redis)

  // GET /[resource]s — 列表
  fastify.get('/[resource]s', {
    schema: { querystring: ListQuerySchema },
  }, async (request, reply) => {
    const { page, limit } = request.query
    const result = await service.list({ page, limit })
    return reply.send(result)
  })

  // GET /[resource]s/:id — 详情
  fastify.get('/[resource]s/:id', {
    schema: { params: IdParamSchema },
  }, async (request, reply) => {
    const { id } = request.params
    const item = await service.findById(id)
    if (!item) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: '[Resource] not found', status: 404 },
      })
    }
    return reply.send({ data: item })
  })

  // POST /[resource]s — 创建（需要登录）
  fastify.post('/[resource]s', {
    preHandler: [fastify.authenticate],   // TODO: 按需改为 optionalAuthenticate 或 requireRole
    schema: { body: CreateBodySchema },
  }, async (request, reply) => {
    const item = await service.create({
      ...request.body,
      userId: request.user.id,            // TODO: 按需删除
    })
    return reply.status(201).send({ data: item })
  })

  // PATCH /[resource]s/:id — 更新（需要登录）
  fastify.patch('/[resource]s/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: IdParamSchema,
      body: CreateBodySchema.partial(),   // 所有字段可选
    },
  }, async (request, reply) => {
    const { id } = request.params
    const item = await service.update(id, request.body, request.user.id)
    return reply.send({ data: item })
  })

  // DELETE /[resource]s/:id — 删除（需要登录）
  fastify.delete('/[resource]s/:id', {
    preHandler: [fastify.authenticate],
    schema: { params: IdParamSchema },
  }, async (request, reply) => {
    await service.delete(request.params.id, request.user.id)
    return reply.status(204).send()
  })
}
