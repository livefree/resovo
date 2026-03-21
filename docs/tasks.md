# Resovo（流光） — 任务看板

---

## 当前进行中（仅保留一条）

#### CHG-129 subtitles 列表迁移到 shared table 基线

- **状态**：🔄 进行中
- **创建时间**：2026-03-21 11:20
- **计划开始时间**：2026-03-22 09:30
- **实际开始时间**：2026-03-21 15:57
- **完成时间**：
- **目标**：字幕审核列表对齐统一表格能力。
- **范围**：
  - `src/components/admin/content/SubtitleTable.tsx`
  - `src/components/admin/AdminSubtitleList.tsx`
  - 相关 hooks/services（仅必要范围）
- **依赖**：CHG-128
- **DoD**：
  - 支持排序/显隐/列宽/持久化
  - 长文本截断 + tooltip 统一
  - 保持现有审核动作与权限逻辑不变
- **回滚方式**：回退 subtitles 迁移 commit
- **备注**：
  - 默认“后端分页优先”；仅明确低数据量页面允许前端排序作为过渡。
