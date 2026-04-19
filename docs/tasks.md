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

#### M3-DETAIL-03 — ALLOWLIST 翻转 + apps/web 详情页删除 + E2E 迁移

- **状态**：🔄 进行中
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **创建时间**：2026-04-19
- **依赖**：M3-DETAIL-02 ✅
- **文件范围**（原子操作，同一 commit）：
  - 修改：`apps/web/src/lib/rewrite-allowlist.ts`（追加 5 条 M3 prefix 条目）
  - 修改：`tests/unit/lib/rewrite-match.test.ts`（追加 5 条 prefix 测试）
  - 新增：`tests/e2e-next/detail.spec.ts`（从 player.spec.ts 迁出"电影详情页"+"动漫详情页"）
  - 修改：`tests/e2e/player.spec.ts`（移除已迁出的 describe 块）
  - 修改：`docs/known_failing_tests_phase0.md`（删除 2 条 M3 详情页条目）
  - 删除：`apps/web/src/app/[locale]/movie|series|anime|tvshow|others/`（5 个目录）
  - 删除：`apps/web/src/components/video/EpisodeGrid|VideoDetailClient|VideoDetailHero|VideoMeta.tsx`
  - 修改：`apps/web-next/next.config.ts`（接收 /variety→/tvshow redirect）
  - 修改：`apps/web/next.config.ts`（移除已接收的 redirect）
