# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-21
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## M5-PAGE-SEARCH-01 — 搜索页重塑

- **状态**：🔄 进行中
- **任务 ID**：M5-PAGE-SEARCH-01
- **所属序列**：SEQ-20260420-M5-PAGE
- **创建时间**：2026-04-20 19:00
- **实际开始**：2026-04-21 15:50
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无

### 目标

新建 `[locale]/search/page.tsx` 全屏搜索页：搜索建议 debounce 120ms、空结果推荐、VideoGrid 消费、SearchCircularReveal 动效、SearchResults.Skeleton。

### 文件范围

- 新增 `apps/web-next/src/app/[locale]/search/page.tsx`
- 新增 `apps/web-next/src/app/[locale]/search/_components/SearchPage.tsx`（客户端逻辑）
- 新增 `apps/web-next/src/components/search/SearchCircularReveal.tsx`
- 新增 `apps/web-next/src/components/search/SearchSuggestions.tsx`
- 新增 `apps/web-next/src/components/search/SearchEmptyState.tsx`

### 验收要点

- `/en/search` 和 `/en/search?q=xxx` 正常渲染
- 输入 debounce 120ms 调 `/search/suggest`
- 空结果显示推荐内容（VideoGrid 热门内容）
- SearchCircularReveal clip-path 250ms，reduced-motion 降级 opacity 150ms
- typecheck ✅ / lint ✅ / unit ✅
