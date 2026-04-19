# Resovo（流光） — 任务看板



> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-19
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

#### M2-HOMEPAGE-02 — apps/web-next/ 清退旧 CSS 变量名

- **状态**：🔄 进行中
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **创建时间**：2026-04-19
- **依赖**：M2-HOMEPAGE-01 ✅
- **目录目标**：apps/web-next/
- **文件范围**：
  - 修改：`apps/web-next/src/app/[locale]/page.tsx`
  - 修改：`apps/web-next/src/components/layout/Nav.tsx`
  - 修改：`apps/web-next/src/components/layout/Footer.tsx`
  - 修改：`apps/web-next/src/components/ui/ThemeToggle.tsx`
  - 修改：`apps/web-next/src/components/video/HeroBanner.tsx`
  - 修改：`apps/web-next/src/components/video/VideoGrid.tsx`
  - 修改：`apps/web-next/src/components/video/VideoCard.tsx`
  - 修改：`apps/web-next/src/components/video/VideoCardWide.tsx`
- **变量映射**：
  - `--background` → `--bg-canvas`
  - `--foreground` → `--fg-default`
  - `--gold` → `--accent-default`
  - `--secondary` → `--bg-surface-sunken`
  - `--muted-foreground` → `--fg-muted`
  - `--border` → `--border-default`
  - `--card` → `--bg-surface`
  - `--accent` → `--accent-default`
  - `--accent-foreground` → `--accent-fg`
- **反向约束**：禁止在 globals.css 添加 legacy shim
- **验收**：`rg '(--background|--foreground|--gold|--secondary|--muted-foreground|--border|--card)\b' apps/web-next/src` 零命中；typecheck ✅ lint ✅ unit tests ✅
