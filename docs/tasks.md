# Resovo（流光） — 任务看板

---

## 当前进行中（仅保留一条）

#### CHG-142 — 修复字幕审核入口与 tab 跳转

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 00:05
- **计划开始时间**：2026-03-22 00:06
- **实际开始时间**：2026-03-22 00:07
- **完成时间**：2026-03-22 00:11
- **目标**：恢复后台字幕审核入口可见性，并修复 query tab 兼容跳转。
- **范围**：
  - `src/components/admin/AdminSidebar.tsx`
  - `src/app/[locale]/admin/content/page.tsx`
  - `docs/task-queue.md`、`docs/changelog.md`、`docs/run-logs.md`
- **依赖**：CHG-141
- **DoD**：
  - 侧栏可见“字幕审核”入口
  - `/admin/content?tab=subtitles` 直达字幕审核 Tab
  - `npm run typecheck` / `npm run lint` / 相关测试通过
- **回滚方式**：
  - 回退 CHG-142 提交
- **备注**：
  - 当前热修复已完成，下一任务待分配。
