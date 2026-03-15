/**
 * TEMPLATE: Service 层
 * 使用方法：复制此文件，替换 [Resource]，填充 TODO 部分
 * Service 层只写业务逻辑，不直接拼 SQL（SQL 放 db/queries/）
 */

import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
// TODO: 替换为实际查询函数
import * as [resource]Queries from '@/api/db/queries/[resource]s'
// TODO: 替换为实际类型
import type { [Resource], Create[Resource]Input } from '@/types/[resource].types'

export class [Resource]Service {
  constructor(
    private db: Pool,
    private redis: Redis,
  ) {}

  // 列表查询（含分页）
  async list(params: {
    page: number
    limit: number
    // TODO: 添加过滤参数
  }): Promise<{ data: [Resource][]; pagination: Pagination }> {
    const { rows, total } = await [resource]Queries.list(this.db, params)
    return {
      data: rows,
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        hasNext: params.page * params.limit < total,
      },
    }
  }

  // 详情查询（带缓存，可选）
  async findById(id: string): Promise<[Resource] | null> {
    // TODO: 按需开启 Redis 缓存
    // const cached = await this.redis.get(`[resource]:${id}`)
    // if (cached) return JSON.parse(cached)

    const item = await [resource]Queries.findById(this.db, id)

    // if (item) await this.redis.setex(`[resource]:${id}`, 300, JSON.stringify(item))
    return item
  }

  // 创建
  async create(input: Create[Resource]Input): Promise<[Resource]> {
    // TODO: 业务校验（如唯一性检查）
    // const exists = await [resource]Queries.findByTitle(this.db, input.title)
    // if (exists) throw new ConflictError('[Resource] already exists')

    return [resource]Queries.create(this.db, input)
  }

  // 更新（含权限检查）
  async update(
    id: string,
    input: Partial<Create[Resource]Input>,
    requestUserId: string,
  ): Promise<[Resource]> {
    const item = await this.findById(id)
    if (!item) throw new NotFoundError('[Resource] not found')

    // TODO: 权限检查（只有所有者可以编辑）
    // if (item.ownerId !== requestUserId) throw new ForbiddenError()

    const updated = await [resource]Queries.update(this.db, id, input)

    // TODO: 按需清除缓存
    // await this.redis.del(`[resource]:${id}`)

    return updated
  }

  // 删除（软删除）
  async delete(id: string, requestUserId: string): Promise<void> {
    const item = await this.findById(id)
    if (!item) throw new NotFoundError('[Resource] not found')

    // TODO: 权限检查
    // if (item.ownerId !== requestUserId) throw new ForbiddenError()

    await [resource]Queries.softDelete(this.db, id)
    // await this.redis.del(`[resource]:${id}`)
  }
}

// ── 分页类型（全局共用，可移到 types/pagination.types.ts）────────
interface Pagination {
  total: number
  page: number
  limit: number
  hasNext: boolean
}
