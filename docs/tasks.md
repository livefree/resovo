# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-27

---

## 进行中任务

（空 — CHG-366 完成 ✅ / Wave 2 卡 15/17 / 下一个 CHG-367-A META-EPISODES ADR-163 起草）

---

---

---

## Wave 1 收官（SEQ-20260527-MOD-WAVE1 / 9/9 完成）

- ✅ CHG-345（EpisodeSelector ↔ LinesPanel ↔ AdminPlayer / 84ccf041）
- ✅ CHG-346（StagingTabContent 死代码清理 / 43105c35）
- ✅ CHG-347(SPLIT-A usePendingQueue hook / f032f737)
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

## Wave 2 进行中（SEQ-20260527-MOD-WAVE2 / 15/17）

- ✅ CHG-361-A（ADR-160 起草 + getVideoDetailHref 沉淀 / 5f64e78d）
- ✅ CHG-361-B2（apps/api 后端 3 文件 + 5 case 单测 + ADR-160 AMENDMENT 1 / a3c1c9ed）
- ✅ CHG-361-B1（web-next 前端 3 文件 + 2 测试 17 case PASS / 3b9c8fa9）
- ✅ CHG-361-C（后台按钮 + VideoQueueRow 扩 + e2e + manual / 34121022）
- ✅ CHG-361-D（PlayerShell previewMode Props + 3 case PASS / a52141d9）
- ✅ CHG-361-E1（sources 端点 preview query + SourceService 派发 / ADR-160 AMENDMENT 2 / 285c4fb4）
- ✅ CHG-361-E2（detail-page-factory + VideoDetailClient server-side hydration / b48913f0）
- ✅ CHG-361-E3（watch page + PlayerShell server-side hydration / 6 case PASS + 3 个 Codex 回归 fix）
- ⛔ CHG-362-A/B SKIPPED（ADR-105 已覆盖 / 10d7a0df）
- ✅ CHG-363-A（PendingCenter "✂ 拆分" 按钮入口 / 264ab332）
- ✅ CHG-363-B（MergeClient `?split=:videoId` 深链 + MergeSplitSection 自动加载 / Codex stop-time review #4 触发）
- ✅ CHG-364-A（BatchActionsBar "↔ 合并" 按钮 / 4662de12）
- ✅ CHG-364-B（MergeClient ?ids query + BatchMergeWorkspace / 595e68ec + 0f02cf96）
- ⛔ CHG-365-A/B SKIPPED（MetadataEnrichService 已实施 80% / BLOCKER #2 / 3da17c74）
- ✅ CHG-365-A1（PinyinDetector helper + 18 case PASS / 8926bcfd + 07545f93 + 9c9fa2e8）
- ✅ CHG-365-A2（Migration 077 + VideoMetaQuality + MetadataEnrichService 集成 + 23 case PASS / 6d7c3da4）
- ✅ CHG-365-A2-FIX（Codex stop-time review #8 manual paths stale fix / 37 case PASS / 81c6e24d + bc033c77）
- ✅ CHG-366（META-COUNTRY-DISPLAY formatCountryName + CountryName 原语 + 4 消费方迁移 / 10 case PASS / 本卡 / 待 commit）

**CHG-361 PREVIEW-ADMIN 8 子卡全闭环 ✅**
**SPLIT 系列：CHG-362-A/B SKIPPED → CHG-363 SPLIT-UI 完整序列闭环 ✅**
**MERGE 系列：CHG-364 MERGE-INLINE 完整序列闭环 ✅**
**META 系列：CHG-365 META-DOUBAN-AUTO 完整序列闭环 ✅（含 stop-time stale fix）/ CHG-366 META-COUNTRY-DISPLAY ✅**

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
- **localStorage 全量测试 flaky**：CHG-365-A2 全量测试发现 167 个测试在 jsdom 环境下 `localStorage.clear is not a function` / main 分支同样 fail（pre-existing / 与本卡零关联）/ vitest jsdom 环境 setup 缺 localStorage stub / 独立 follow-up 卡 CHG-INFRA-VITEST-LOCALSTORAGE 修复
- **meta_quality 消费方**：CHG-365-A2 仅落 schema + service 写入 / 审核台 TabDetail "重新匹配" UI 提示尚未消费 meta_quality.douban_confidence + douban_match_method 字段（plan §10.4.1 治理路径"重新匹配"+ "手动指定豆瓣 URL/ID" 按钮 / 独立 follow-up 卡承接）
- **CountryName web-next 三处消费方实测**：CHG-366 通过 MetaChip 内化达成"消费方零改"，但 VideoDetailHero L213 / DetailHero L221 直接渲染 `<span>{video.country}</span>` 不经 MetaChip，仍是原 ISO code。可独立 follow-up 卡或留作 P3 sweep 任务
