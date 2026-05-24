# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

### CHG-SN-9-DT-AUTOFILTER-EP-3-A sub 2（AuditClient 迁 toolbar → 列内 + 白名单 AMENDMENT）
- **任务来源**：sub 1 commit 后继续 EP-3-A 子卡 / 完成 EP-3-A 整体
- **范围**：AuditClient 4 个 toolbar AdminSelect/AdminInput 删除 + 4 列加 filterable + filterFieldName + filterOptions + AuditLogService FILTER_FIELDS 注册（如走 DtFiltersSchema 通用 schema）/ 后端 distinct-whitelist.ts AMENDMENT 追加 actor_id 等
- **建议模型**：sonnet（实施层 / 范式已成熟 / 现 opus 主循环）
- **执行模型**：claude-opus-4-7（主循环）
- **子代理**：spawn arch-reviewer Opus PR review（sub 1 + sub 2 整体 review）
- **文件范围**：
  - `apps/server-next/src/app/admin/audit/_client/AuditClient.tsx`（删 4 AdminSelect/Input + 列加 filterable / 类似 CrawlerRunsView 范式）
  - `apps/api/src/services/datatable/distinct-whitelist.ts`（白名单 AMENDMENT / 追加 admin_audit_log.actor_id 等如需要）
  - `apps/api/src/services/AuditLogService.ts`（FILTER_FIELDS 注册 / 可选 / 旧 schema 兼容）
  - `tests/unit/...`（AuditClient 单测更新）
- **预算**：~0.15w
- **依赖**：sub 1 ✅ commit `<TODO>`
- **完成条件**：AuditClient toolbar AdminSelect 删 / 列内 filterable 工作 / 单测 PASS / Opus PR review (sub 1+sub 2) PASS
