# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### CHG-ENRICH-DOUBAN-CONSISTENCY-B — MetadataEnrichService status 接线 + 存量矫正脚本
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260607-01
- **建议模型**：sonnet（主循环 opus 承接，能力≥建议）
- **执行模型**：claude-opus-4-8
- **子代理调用**：_（待填）_
- **实际开始**：2026-06-07 12:48
- **文件范围**：`apps/api/src/services/MetadataEnrichService.ts`（step1 imdb/step1 title/step2 三处接线 + meta_quality 同步）；`apps/api/src/services/DoubanService.ts`（同口径核验）；`scripts/`（存量矫正脚本，新建）；`tests/unit/api/metadataEnrich.test.ts`（补例）
- **依赖**：CHG-ENRICH-DOUBAN-CONSISTENCY-A ✅
- **问题理解 / 方案**：实施 ADR-186 D-186-4 调用侧 + INV-1/INV-2 + 存量例外兜底：① MetadataEnrichService step1-imdb(L153)/step1-title(L197)/step2(L263) 三处检查 safeUpdate 返回——`skippedFields.includes('doubanId')` → douban_status 落 candidate 而非 matched，并同步 `meta_quality.douban_match_status`（recordDoubanSignal）② DoubanService.syncVideo/confirmSubject 已检查返回值，确认无回归 ③ scripts/ 一次性矫正脚本（dry-run 优先；圈定 douban_status=matched 且当前有效 catalog.douban_id IS NULL，按子原因重置 status / 含 redirect 脱钩例外兜底 D-186-6）④ metadataEnrich.test.ts 补例。
- **验收**：诊断 SQL 圈定的 matched+空 doubanId 视频清零；新富集 matched ⟹ douban_id 非空；typecheck/lint/test:changed 绿。
- **完成备注**：_（完成后填写）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
