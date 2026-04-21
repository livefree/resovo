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

## M5-CARD-CTA-01 — VideoCard 双出口拆分 + Fast Takeover

- **状态**：🔄 进行中
- **所属 SEQ**：SEQ-20260420-M5-CARD
- **创建时间**：2026-04-20
- **实际开始**：2026-04-21
- **建议模型**：claude-sonnet-4-6
- **规模**：M（~150 分钟）
- **依赖**：M5-PREP-01 ✅ + M5-PREP-02 ✅
- **执行模型**：claude-sonnet-4-6（主循环）
- **子代理调用**：待定（关键路径回归视情况）

### 文件范围

- 修改 `apps/web-next/src/components/video/VideoCard.tsx`：外层拆为 `<article>` + `VideoCard.PosterAction`（button，图片区，触发 Fast Takeover）+ `VideoCard.MetaAction`（Link，文字区，跳详情页）；8px 中轴间隙；hover 时显示 FloatingPlayButton
- 修改 `apps/web-next/src/app/[locale]/_lib/player/playerStore.ts`：`enter()` 扩展 `transition: 'fast-takeover' | 'standard-takeover'` 参数
- 新增 `apps/web-next/src/components/video/FloatingPlayButton.tsx`：44px 悬浮播放按钮，hover 进入 120ms / 离开 90ms
- 新增 `apps/web-next/src/components/player/transitions/FastTakeover.ts`：Fast Takeover 动效（移动 200ms / 桌面 240ms）
- 修改 `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerFullFrame.tsx`：识别 transition 参数调用对应动效
- 新增 `tests/unit/web-next/VideoCard.test.tsx`（双点击区分、Tab 顺序、reduced motion）
- 新增 `tests/e2e-next/card-to-watch.spec.ts`（桌面 hover ▶ / 移动点图片直达 /watch / 点文字进详情）

### 验收要点

- 图片区点击 → 200-240ms 内 GlobalPlayerHost 进入 full 态播放 ep=1
- 文字区点击 → 路由跳详情页
- 键盘 Tab：PosterAction 先于 MetaAction 获焦
- 两个 button 各自独立 aria-label
- reduced motion 下 Fast Takeover 退化为 opacity 120ms
- VideoCard.Skeleton 导出（像素匹配占位）
- 关键路径回归（断点续播 / 线路切换 / 影院模式 / 字幕开关）PASS
- typecheck ✅ / lint ✅ / unit ✅ / e2e ✅

---
