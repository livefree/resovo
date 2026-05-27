# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-27

---

## 进行中任务

### 🚨 BLOCKER — Wave 1 主循环暂停

**CHG-351 PROBE-RENDER-INLINE** 触发 plan §16.5 BLOCKER 条件：
- 需要新建 2 个 admin route → 需要新 ADR + verify:endpoint-adr 触发
- 需要修改 `packages/admin-ui/.../lines-panel.types.ts` 公开 Props → CLAUDE.md "共享组件 API 契约强制 Opus" + commit 必含 arch-reviewer trailer
- 预计 8-12 文件改动 / 远超 PATCH ≤ 5 项硬约束 / 必须拆 -A/-B/-C 子卡

**Wave 1 当前进度 6/9 完成**：
- ✅ CHG-346（死代码清理） / 43105c35
- ✅ CHG-345（EpisodeSelector ↔ LinesPanel ↔ AdminPlayer 修复） / 84ccf041
- ✅ CHG-347（SPLIT-A usePendingQueue hook） / f032f737
- ✅ CHG-348（SPLIT-B BatchActionsBar） / 93572682
- ✅ CHG-349（SPLIT-C PendingPaneController） / 02926ac2
- ✅ CHG-350（左栏 search + filterChips） / 05283390
- ⏸ CHG-351（PROBE-RENDER-INLINE） / **BLOCKER**
- ⏸ CHG-352（route-labeling A1 effective_score） / 等待
- ⏸ CHG-353（route-labeling A2 主题渲染） / 等待

**详情见 docs/task-queue.md 顶部 BLOCKER 块的 4 个备选方案**，请用户选择：
- 方案 A: 暂停 Wave 1，先起 CHG-351-A/-B/-C 三张子卡
- 方案 B: 跳序先做 CHG-352/353，CHG-351 拆子卡独立调度
- 方案 C: 缩减 CHG-351 范围（仅 admin-ui Props + UI 入口，后端 mock 化）
- 方案 D: Wave 1 提前在 6/9 进入验收，CHG-351/352/353 转 Wave 2

---

## 下次会话恢复入口

- **C-2 残留**：`tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`、`tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx`、`tests/e2e/admin.spec.ts` 中仍有 `dailyTime` 字段留在 fixture（extra field，不影响 typecheck；C-2 任务 3k 待执行）
- **CrawlerClient 时区 flaky**：`tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` 第 1086 行时区/HH:MM 断言并行跑偶 fail，单独跑 66/66 PASS
- **CHG-354 SPLIT-D 待立卡**（Wave 1 完成后规划）：ModerationConsole ≤ 500 行
