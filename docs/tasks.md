# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-27

---

## 进行中任务

（空 — CHG-369 完成 ✅ / Wave 2 卡 16/17 / Wave 2 非 ADR 卡全部完成 / 剩 CHG-367-A/-B + CHG-368-A/-B PAUSED 用户拒绝 spawn Opus）

---

---

---

## Wave 1 收官（SEQ-20260527-MOD-WAVE1 / 9/9 完成）

- ✅ CHG-345 ~ CHG-353 全部完成

## Wave 2 进行中（SEQ-20260527-MOD-WAVE2 / 16/17 闭合 / 剩 ADR 卡 PAUSED）

- ✅ CHG-361 PREVIEW-ADMIN 完整序列闭环（A → E3）
- ⛔ CHG-362-A/B SKIPPED（ADR-105 已覆盖）
- ✅ CHG-363 SPLIT-UI 完整序列闭环（A → B）
- ✅ CHG-364 MERGE-INLINE 完整序列闭环（A → B）
- ⛔ CHG-365-A/B SKIPPED（MetadataEnrichService 已实施 80%）
- ✅ CHG-365-A1（PinyinDetector helper / 18 case）
- ✅ CHG-365-A2 + FIX（meta_quality jsonb + Codex #8 stale fix / 37 case）
- ✅ CHG-366 + FIX（formatCountryName + CountryName + 5 消费方 / 10 case / Codex #10 hero fix）
- ⏸️ CHG-367-A/-B PAUSED（用户拒绝 spawn Opus）
- ⏸️ CHG-368-A/-B PAUSED（用户拒绝 spawn Opus）
- ✅ CHG-369（ROUTE-LABEL-C 主题选择器 + localStorage / 8 case）

---

## 下次会话恢复入口

- **CHG-367-A/-B + CHG-368-A/-B PAUSED**：用户在 CHG-367-A 时拒绝 spawn arch-reviewer Opus 子代理。两张 ADR 卡保持 PAUSED，待用户明确指示恢复（继续 spawn Opus / 或允许 Sonnet 主循环直起 ADR / 或推迟到下一 Milestone）
- **CHG-369-B 自定义主题输入**：CHG-369 仅做 5 内置 + localStorage / 自定义输入（labels ≤ 30 / name ≤ 10 字符 / schema 校验 + JSON serialize）独立 follow-up
- **CHG-SN-9-ROUTE-LABEL-D 跨设备同步**：plan §17.2 Wave 3 / `users.preferences` schema
- **C-2 残留**：`tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx` 等 fixture 残留 dailyTime
- **CrawlerClient 时区 flaky** / **StagingTable.test.tsx:236 flaky** / **ModerationBatch.test.tsx flaky** / **localStorage 全量测试 167 个 flaky**（pre-existing main 分支同样 fail）
- **CHG-354 SPLIT-D 待立卡**：ModerationConsole ≤ 500 行
- **audit 4 真源 advisory follow-up**：crawler_task.* + image_health.* 4 项 actionType set-equal drift
- **Phase 2 route-labeling 优化**：后端 SourceService 派生 `isDead: boolean` 字段替代前端 effectiveScore < 0.1 heuristic
- **PRE-PROBE-WORKER / PRE-RENDER-CHECK-WORKER**：占位 jobId / 真实写回待补
- **meta_quality 消费方 UI**：CHG-365-A2 写入就绪 / TabDetail "重新匹配"提示 UI 尚未消费
