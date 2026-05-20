# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-20

---

## 进行中任务

## 任务卡片：CHG-SN-7-MISC-USERS-2

- **任务 ID**：CHG-SN-7-MISC-USERS-2
- **所属序列**：SEQ-20260507-01（M-SN-7 MISC #13）
- **状态**：🔄 进行中
- **建议模型**：claude-sonnet-4-6（统计端点与 ADR-133 同类，Opus 仅用于 ADR 评审子代理）
- **创建时间**：2026-05-20 14:35
- **实际开始时间**：2026-05-20 14:35
- **目标**：users 页顶部增加 4 列 KPI 统计（总用户数 / 今日新增 / 已封账号 / 版主数量），消费 KpiCard 共享组件 + 新建 GET /admin/users/stats 端点
- **文件范围**：
  - 新建：`apps/api/src/db/queries/usersStats.ts`（statsAdminUsers 单条 SQL）
  - 改：`apps/api/src/routes/admin/users.ts`（追加 GET /admin/users/stats 端点）
  - 改：`apps/server-next/src/lib/users/api.ts`（追加 fetchUsersStats 客户端函数）
  - 改：`apps/server-next/src/app/admin/users/_client/UsersListClient.tsx`（追加 KpiCard 4 列行）
  - 新建：`tests/unit/components/server-next/admin/users/UsersKpiRow.test.tsx`（≥6 case）
- **子代理调用**：arch-reviewer (claude-opus-4-7) — ADR-136 评审
- **执行模型**：claude-sonnet-4-6（主循环）
- **验收要点**：
  - typecheck + lint + test 全绿
  - verify:endpoint-adr 通过（ADR-136 覆盖新端点）
  - KpiCard 4 列用 `@resovo/admin-ui` KpiCard 组件，不自行实现
  - 无硬编码颜色
