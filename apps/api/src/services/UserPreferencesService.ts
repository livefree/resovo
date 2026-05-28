/**
 * UserPreferencesService.ts — 用户偏好业务层（ADR-165 / CHG-SN-9-ROUTE-LABEL-D-A1）
 *
 * 职责：
 *   - GET：调 queries.getUserPreferences → 返回 UserPreferences ?? {}
 *   - PUT：zod passthrough 校验 patch → 调 queries.updateUserPreferences JSONB merge
 *
 * 不在职责内：
 *   - 鉴权（由 fastify.authenticate preHandler 完成 / Service 层信任 userId 来自 JWT）
 *   - 跨用户读 / admin 域读其他用户 preferences（洞察 5 / 独立 ADR 评估）
 */

import type { Pool } from 'pg'
import {
  UserPreferencesPatchSchema,
  type UserPreferences,
  type UserPreferencesPatch,
} from '@resovo/types'
import * as queries from '@/api/db/queries/userPreferences'

export class UserPreferencesService {
  constructor(private db: Pool) {}

  /**
   * 拉取当前用户偏好（GET /users/me/preferences）。
   * 用户不存在 → null（caller 返 404）。
   * 用户存在 / preferences 为空对象 → 返回 `{}`（不是 null）。
   */
  async get(userId: string): Promise<UserPreferences | null> {
    return queries.getUserPreferences(this.db, userId)
  }

  /**
   * 顶层模块 PATCH 更新（PUT /users/me/preferences）。
   *
   * @param input 已通过 fastify zod 校验的 patch（或调用方手动 parse）
   * @returns 更新后的完整 preferences / 用户不存在 → null
   *
   * R-165-4：server 用 passthrough schema 持久化（防演进期未知字段误删）。
   */
  async update(userId: string, input: unknown): Promise<UserPreferences | null> {
    const parsed = UserPreferencesPatchSchema.safeParse(input)
    if (!parsed.success) {
      const error = new Error('VALIDATION_ERROR') as Error & { code?: string }
      error.code = 'VALIDATION_ERROR'
      throw error
    }
    return queries.updateUserPreferences(this.db, userId, parsed.data as UserPreferencesPatch)
  }
}
