# Resovo（流光） — 任务看板

---

## 当前进行中（仅保留一条）

#### CHG-128 submissions 列表迁移到 shared table 基线

- **状态**：🔄 进行中
- **创建时间**：2026-03-21 11:20
- **计划开始时间**：2026-03-21 21:00
- **实际开始时间**：2026-03-21 15:50
- **完成时间**：
- **目标**：投稿审核列表对齐统一表格能力并保持审核流程不回退。
- **范围**：
  - `src/components/admin/content/SubmissionTable.tsx`
  - `src/components/admin/content/AdminSubmissionList.tsx`
  - 相关 hooks/services（仅必要范围）
- **依赖**：CHG-127
- **DoD**：
  - 保持审核操作路径不变
  - 表格能力对齐 baseline（含状态持久化）
  - 后端分页优先策略生效
- **回滚方式**：回退 submissions 迁移 commit
- **备注**：
  - 默认“后端分页优先”；仅明确低数据量页面允许前端排序作为过渡。
