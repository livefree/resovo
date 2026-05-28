# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-27

---

## 进行中任务

（空 — CHG-365-A1 完成 ✅ / Wave 2 卡 13/17 / CHG-365-A/B SKIPPED + 拆 A1/A2 / 下一个 CHG-365-A2 meta_quality schema + 集成持久化）

---

---

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

## Wave 2 进行中（SEQ-20260527-MOD-WAVE2 / 13/17）

- ✅ CHG-361-A（ADR-160 起草 + getVideoDetailHref 沉淀 / 5f64e78d）
- ✅ CHG-361-B2（apps/api 后端 3 文件 + 5 case 单测 + ADR-160 AMENDMENT 1 / a3c1c9ed）
- ✅ CHG-361-B1（web-next 前端 3 文件 + 2 测试 17 case PASS / 3b9c8fa9）
- ✅ CHG-361-C（后台按钮 + VideoQueueRow 扩 + e2e + manual / 34121022）
- ✅ CHG-361-D（PlayerShell previewMode Props + 3 case PASS / a52141d9）
- ✅ CHG-361-E1（sources 端点 preview query + SourceService 派发 / ADR-160 AMENDMENT 2 / 285c4fb4）
- ✅ CHG-361-E2（detail-page-factory + VideoDetailClient server-side hydration / b48913f0）
- ✅ CHG-361-E3（watch page + PlayerShell server-side hydration / 6 case PASS + 3 个 Codex 回归 fix / ed43059e + 552656bc + 4360688f + a1bcc272 + e643998f）
- ⛔ CHG-362-A/B SKIPPED（ADR-105 已覆盖 / 后端已实现 / 10d7a0df）
- ✅ CHG-363-A（PendingCenter "✂ 拆分" 按钮入口 + 3 case PASS / 264ab332）
- ✅ CHG-363-B（MergeClient `?split=:videoId` 深链 + MergeSplitSection initialVideoId 自动加载 + 4 case PASS / Codex stop-time review #4 触发 / 本卡 / 待 commit）

**CHG-361 PREVIEW-ADMIN 8 子卡全闭环 ✅(A → B2 → B1 → C → D → E1 → E2 → E3)/ 跨 app preview 链路 + server-side hydration 修补完整就绪 + 4 类时序 bug 收敛 / 待 prod gate OPS 卡 CHG-OPS-COOKIE-SUBDOMAIN-1 / Y-AMD2-2 episode 切换 internal 视频限制独立 FOLLOWUP 卡**

**SPLIT 系列：CHG-362-A/B SKIPPED → CHG-363 SPLIT-UI 完整序列闭环 ✅（-A 入口 → -B 深链 + 自动加载）/ PendingCenter ✂ 拆分 → /admin/merge?split=:videoId 端到端就绪**

**MERGE 系列：CHG-364 MERGE-INLINE 完整序列闭环 ✅（-A BatchActionsBar 合并按钮 → -B MergeClient ?ids 深链 + BatchMergeWorkspace 选 target + 提交 mergeVideos）/ 审核台批量选 ≥2 条 → ↔ 合并 → /admin/merge?ids=<csv> 端到端就绪**

- ✅ CHG-364-A（BatchActionsBar "↔ 合并" 按钮入口 + 4 case PASS / 4662de12）
- ✅ CHG-364-B（MergeClient ?ids query + BatchMergeWorkspace + 6 case PASS / 595e68ec + 0f02cf96）
- ⛔ CHG-365-A/B SKIPPED（MetadataEnrichService 已实施 80% / BLOCKER #2 / 3da17c74）
- ✅ CHG-365-A1（PinyinDetector helper + 18 case PASS / 本卡 / 待 commit）

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
