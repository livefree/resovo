# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-27

---

## 进行中任务

（空 — Wave 1 全部完成 ✅ + CHG-355/356/357 三张 follow-up bug fix + 增强已闭环 / 待用户实测验收）

---

## Wave 1 收官（SEQ-20260527-MOD-WAVE1 / 9/9 完成）

- ✅ CHG-345（EpisodeSelector ↔ LinesPanel ↔ AdminPlayer / 84ccf041）
- ✅ CHG-346（StagingTabContent 死代码清理 / 43105c35）
- ✅ CHG-347（SPLIT-A usePendingQueue hook / f032f737）
- ✅ CHG-348（SPLIT-B BatchActionsBar / 93572682）
- ✅ CHG-349（SPLIT-C PendingPaneController / 02926ac2）
- ✅ CHG-350（左栏 search + filterChips / 05283390 + CHG-350-FIX/FIX-2 + CHG-355 第 3 次复发根治）
- ✅ CHG-351-A（ADR-158 + 后端 probe/render-check / 08538385）
- ✅ CHG-351-B（admin-ui LinesPanel Props 扩展 / ab9d2bec）
- ✅ CHG-351-C（server-next 消费 + i18n + docs §3.8 / 82651785）
- ✅ CHG-352（route-labeling effective_score 后端 / 93107287）
- ✅ CHG-353（route-labeling Phase 1 前台主题渲染 / 本卡 / 待 commit）

**Wave 1 共 11 commits（含 3 张 bug fix / 修复 search 焦点 3 次复发）**

---

## 下次会话恢复入口

- **C-2 残留**：`tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`、`SchedulerConfigDrawer.test.tsx`、`tests/e2e/admin.spec.ts` 中仍有 `dailyTime` fixture（extra field / 不影响 typecheck / C-2 任务 3k 待执行）
- **CrawlerClient 时区 flaky**：并行跑偶 fail / 单跑 66/66 PASS
- **StagingTable.test.tsx:236 flaky**（CHG-351-A 新发现 / 单跑 13/13 PASS / pre-existing）
- **ModerationBatch.test.tsx flaky**（CHG-355 新发现 / 单跑 5/5 PASS / pre-existing）
- **CHG-354 SPLIT-D 待立卡**（Wave 1 完成后规划）：ModerationConsole ≤ 500 行
- **audit 4 真源 advisory follow-up**：crawler_task.* + image_health.* 4 项 actionType 在 union (1) + REQUIRED (4) 已含，但 AuditLogService.ACTION_TYPES (2) + EXPECTED_ACTION_TYPES (3a) 未同步（set-equal 守卫两边自洽 drift 而 PASS）；隐式违反 4 真源严格性；建议独立 follow-up 卡修复
- **Phase 2 route-labeling 优化**：后端 SourceService 派生 `isDead: boolean` 字段（health_score === 0 严格判定）替代前端 effectiveScore < 0.1 heuristic / 暴露到 VideoSource
- **PRE-PROBE-WORKER / PRE-RENDER-CHECK-WORKER**：source-health worker + player-render-check worker 真实写回 probe_status / render_status / latency_ms（advisory ADR-158 A2 + A4 / 当前都是占位 jobId）
