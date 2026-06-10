# auto-retire-line worker — 全 dead 180 天自动退役

> status: active
> owner: @engineering
> scope: apps/worker auto-retire-line cron job 的运维手册
> source_of_truth: code（apps/worker/src/jobs/auto-retire-line.ts + apps/api/src/db/queries/auto-retire-line.ts）
> supersedes: none
> superseded_by: none
> related: ADR-164 D-164-8 / Migration 081 / CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER（Wave 4 #5）
> last_reviewed: 2026-05-28

---

## 1. 业务规则

`source_line_aliases` 表的 alias 行（标识"运维已识别为某站点某线路"），当**全部关联 `video_sources` 持续 180 天 dead**时，由 worker cron 自动写：

```sql
UPDATE source_line_aliases
SET retired_at = NOW(), auto_retired = true
WHERE source_site_key = $1 AND source_name = $2 AND retired_at IS NULL
```

UI 端 `LinesPanel` 已支持 `auto_retired = true` 显示"已退役·自动"标识（CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL ship Wave 3 #4）。

## 2. dead_since 状态机（arch-reviewer Opus 评审方案 D'）

`source_line_aliases.dead_since TIMESTAMPTZ NULL` 列由 worker 单向维护（**不影响既有 probe / render 写路径**）。状态转换：

| 当前状态 | 触发 | 转换 | dead_since 写 |
|---|---|---|---|
| `dead_since IS NULL` | alias 全部 source dead | 上升沿 | `SET NOW()` |
| `dead_since IS NOT NULL` | 任一 source 转非 dead | 下降沿 | `SET NULL`（重置观察期）|
| `dead_since IS NOT NULL` | 所有 source 被删（孤儿）| 下降沿 | `SET NULL`（R-DEAD-2 防卡死）|
| `dead_since IS NULL` | 无 source（孤儿 alias 新建）| 保持 | 不写 |
| `dead_since IS NOT NULL` | 仍全 dead 且 `dead_since < NOW() - 180 days` | 触发退役 | `retired_at = NOW(), auto_retired = true`（dead_since 不再用）|

**关键判据**：
- "全 dead" = alias 关联的**所有** `video_sources` 行（`is_active = true`）满足 `probe_status = 'dead' AND render_status = 'dead'`
- "孤儿 alias" = alias 行存在但 `video_sources` 中无 `(source_site_key, source_name)` 匹配的活跃 source
- "alias 已退役" = `retired_at IS NOT NULL`（worker 跳过 / 不重复处理）

## 3. cron 调度

- **频率**：每日 `30 3 * * *`（03:30 UTC）
- **调度依据**：避开 level1-probe / level2-render 整点波峰 + 180 天阈值粒度允许 daily + 误报 24h 内可被人工发现
- **配置项**：`WORKER_CRON_AUTO_RETIRE_LINE` 环境变量覆盖（默认 `'30 3 * * *'`）

## 4. batch limit

- **单次 run 最多退役 50 条**（`RETIRE_BATCH_LIMIT = 50` / arch-reviewer Q3）
- **优先级**：`ORDER BY dead_since ASC`（最老 dead alias 先退役 / 防雪崩）
- **未处理项**：保留到下一次 cron / 自然漏斗

## 5. advisory lock + 同 client session 守卫（Codex stop-time review FIX-1）

- **键**：`pg_try_advisory_lock(hashtext('worker:auto-retire-line'))`
- **行为**：非阻塞 / 拿不到锁直接 `return []` + `log.info({lock_key}, 'another instance holds')`
- **多 worker 实例并发**：同一时刻只有 1 个实例执行段 1+2 / 段 3
- **session 守卫（关键 / Codex FIX-1）**：
  - PostgreSQL `pg_advisory_lock` 是 **session-level 锁** — lock 和 unlock 必须在**同一 connection** 上执行
  - 实施时使用 `pool.connect()` 获取专用 `PoolClient`，所有 4 段 query 通过 `client.query()` 调用
  - **禁止 `pool.query()`**：每次调用可能拿到不同 client → unlock 在错误 connection 执行（静默成功 / 实际 lock 仍在原 client 上 / 下次 worker run 永久拿不到锁）
- **unlock + release**：`finally` 块保证调用 / 即便段 1+2 SQL 抛错也 unlock + release client
  - **unlock 失败（极罕见 / connection reset 等）→ `client.release(err)` 传 truthy 强制 pg pool destroy connection**（Codex stop-time review FIX-2）
    - **不能**仅 `client.release()` 无参数：client 会被放回 pool / session 仍持锁 / 别的 worker 取该 client 时 pg_try_advisory_lock 永久失败 → 锁泄漏
    - `client.release(err)` 让 pool 销毁连接 → session 终结 → PG 自动释放 advisory lock（pg 文档行为）
  - unlock 成功 → `client.release()` 无参数（正常回 pool）
  - 拿不到锁时不调 unlock（防 PG NOTICE 噪音 / 但仍调 release() 无参数）

## 6. 工作流（5 段 / Codex FIX-1 加段 -1）

| 段 | 内容 | SQL 类型 |
|---|---|---|
| -1 | `pool.connect()` 获取专用 PoolClient（lock + unlock 同 session 守卫） | — |
| 0 | `client.query` pg_try_advisory_lock 非阻塞获取 | SELECT |
| 1+2 | `client.query` CTE 识别"当前全 dead"集（LEFT JOIN vs.deleted_at IS NULL + is_active=true）+ UPDATE 维护 `dead_since`（上升沿/下降沿/孤儿三态守卫）| 单 UPDATE |
| 3 | `client.query` 检测 `dead_since < NOW() - 180 days` + batch limit ORDER BY dead_since ASC LIMIT 50 → UPDATE `retired_at, auto_retired` + RETURNING 行 | 单 UPDATE |
| finally | `client.query` pg_advisory_unlock（仅 acquired=true 时调）+ `client.release()` | SELECT + release |

**R-DEAD-1**：段 2 与 段 3 必须是**两条独立 SQL 语句**（不可合并 CTE）。否则同事务内 `NOW()` 等值，"刚写 dead_since=NOW()"可能被立即判 `< NOW()-180 days`（虽然实际差 0 ms，但 PostgreSQL `NOW()` 文档行为是"事务开始时刻"，跨语句仍是同一值）。

## 7. 监控

worker 结构化日志：

```js
log.info({
  metric: 'auto_retire_line.retired',
  value: 1,
  source_site_key: 'site_a',
  source_name: '线A',
  dead_since: '2025-09-01T00:00:00Z',
  retired_at: '2026-05-28T03:30:00Z',
}, 'auto-retire-line: alias auto-retired')

log.info({
  metric: 'auto_retire_line.batch_total',
  value: 12,
}, 'auto-retire-line: job completed')
```

观察指标：
- `auto_retire_line.batch_total` per run — 异常飙升（> 30）可能是数据质量问题
- `auto_retire_line.retired` per row — 审计回溯单条 alias

## 8. 误报恢复

若运维发现 worker 误退役（auto_retired = true 但实际线路恢复），当前**无 admin UI 路径**直接 unretire（详 §10 follow-up）。临时 SQL 操作：

```sql
-- 1. 立即恢复（清 retired_at + auto_retired + dead_since）
UPDATE source_line_aliases
SET retired_at = NULL,
    auto_retired = false,
    dead_since = NULL,  -- 重置观察期
    updated_at = NOW()
WHERE source_site_key = $1 AND source_name = $2;

-- 2. 注意 90 天冷却（ADR-164 §10.2）
--    如果同 (site_key, codename) 在 90 天内重新创建 alias，应用层会拦截。
--    人工 unretire 不绕过冷却（一致性 > 灵活性）。
```

## 9. 不在范围内

- ❌ **写 `source_health_events` 事件日志**：D-164-8 明示"worker 不写 admin audit"；event log 是 admin / probe 范畴 / 自动退役走 worker structured log 已足够
- ❌ **触发 R-MID-1 audit RETRO**：D-164-8 明示"不写 admin audit" / R-MID-1 是 admin 写端点范式 / 不适用 worker
- ❌ **暴露 admin 端点**：worker 直接读写 `source_line_aliases` 表 / 不暴露 HTTP route
- ❌ **修改 probe / render 写路径**：方案 D' 核心优势 — dead_since 由 worker 单向维护 / level1-probe.ts / level2-render.ts / feedback-driven-recheck.ts 三处既有 worker job 零改动

## 10. follow-up（独立卡承接）

- **`CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B`**（Wave 4 #5-B）：worker job 文件 + cron 注册 + worker integration test
- **`CHG-PRE-DEAD-LINE-UNRETIRE-ENDPOINT`**（Wave 4 后续）：POST `/admin/source-line-aliases/:siteKey/:sourceName/unretire` 人工恢复端点 / 含 90 天冷却 check / R-MID-1 audit / Opus arch-reviewer 评审
- **`LinesPanel dead_since tooltip`**（admin-ui follow-up）：active alias 行 + dead_since IS NOT NULL 时显示"dead since: YYYY-MM-DD"提升运维可观测性

## 11. 参考

- `apps/api/src/db/migrations/081_source_line_aliases_dead_since.sql` — Schema 真源
- `apps/api/src/db/queries/auto-retire-line.ts` — SQL 三段式真源
- `apps/worker/src/jobs/auto-retire-line.ts`（Wave 4 #5-B 实施）— worker job 入口
- `docs/decisions.md` ADR-164 §D-164-8 — 决策真源
- `docs/server_next_plan_20260427.md` §10.5 — 业务规则源头
