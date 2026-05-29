# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空 / Wave 3 验收期补丁 CHG-SN-9-LINES-VIEW-UNIFY 完成 / 主循环等待用户继续验收）

---

## Wave 3 验收期补丁记录

- ✅ **CHG-SN-9-LINES-VIEW-UNIFY**（2026-05-28 / sonnet-4-6 / 7 业务+测试 PATCH=7 接受完成度风险 + 1 ADR AMENDMENT / listAllSourceLines query NEW + 端点 NEW + SourceLineRow type NEW + 管理页改造 unassigned 行可分配 + SourcesClient 按钮 "一键替换最相似 URL" → "线路别名管理" 链接 / 7/7 测试 PASS / typecheck + lint + verify 全 EXIT=0）

---

## ⏳ Wave 3 验收期（2026-05-28 启动）

**验收报告**：`docs/manual/wave-3-acceptance.md`

**门禁状态**：✅ typecheck + lint + verify:adr-contracts 全 EXIT=0 / Wave 3 域单测 143/143 PASS

**建议用户亲手验收 5 条路径**（见验收报告 §6）：

1. LinesPanel 退役标识自动/手动区分（CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL）
2. RejectedTab 分页（CHG-SN-9-REJECTED-ENHANCE-A）
3. player-core onError public API（CHG-SN-9-PLAYER-ERROR）
4. ADR-165 跨设备主题同步未登录 + 已登录 + corrupt-storage 防御（A1 + A2 + 2 FIX）
5. CustomThemeDialog 自定义主题（CHG-369-B）

签字后主循环可自动取 Wave 4 首卡继续。

---

## Wave 3 状态（SEQ-20260528-MOD-WAVE3 / ✅ **实施期完成 = 90% / 9/10 + 3 DEFERRED**）

- ✅ **PRE-INDEX-DESIGN-RULES**（2026-05-28 / sonnet-4-6 / 纯 docs / 4 步核验 + 双 invariant + 四级范式沉淀 db-rules.md）
- ✅ **CHG-369-B**（2026-05-28 / sonnet-4-6 / 5+1 / CustomThemeDialog NEW + 双 key localStorage）
- ✅ **CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW**（2026-05-28 / sonnet-4-6 / 3 / listAdminSources JOIN + ContentSourceRow 扩）
- ✅ **CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL**（2026-05-28 / sonnet-4-6 + Opus 4-7 / 6 接受完成度风险 / ADR-164 D-164-8 UI 兑现）
- ⛔ **CHG-SN-9-MOD-BUTTON-MIGRATE** DEFERRED（2026-05-28 / 用户决策方案 A / 独立 SEQ-FOLLOWUP-MIGRATE）
- ✅ **CHG-SN-9-REJECTED-ENHANCE-A**（2026-05-28 / sonnet-4-6 / 5 / useRejectedQueue hook + 分页）
- ✅ **CHG-SN-9-PLAYER-ERROR**（2026-05-28 / sonnet-4-6 + Opus 4-7 / 5 / player-core onError + suppressDefaultErrorUI public API）
- ⛔ **CHG-SN-9-META-BANGUMI-A** DEFERRED（2026-05-28 / 用户决策组合 X / plan §13 既有"Bangumi 暂缓"一致）
- ⛔ **CHG-SN-9-SITE-VIEWS-EXTRACT** DEFERRED（2026-05-28 / 用户决策组合 X / 独立 SEQ-FOLLOWUP-ARCH）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-ADR**（2026-05-28 / sonnet-4-6 + Opus 4-7 / 1 docs / ADR-165 Accepted / 5 红线 + 4 P1 黄线 + 2 关键洞察消化）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-A1**（2026-05-28 / sonnet-4-6 / 4 业务 + 1 测试 + 1 docs / Migration 080 + types + queries + Service + 路由 / 8/8 测试 / D-165-1/-2/-3/-9 闭环）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-A2** + 2 FIX（2026-05-28 / sonnet-4-6 / 5 业务 + 1 测试 + 1 docs / useUserPreferencesSync NEW + useRouteTheme 接入 + UI syncing / D-165-4/-5/-6/-7/-8/-11 闭环 / **ADR-165 全 11 D-N 闭环**）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / ✅ **完全收官 = 100%**）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A/B-A/B-B（ADR-163 META-EPISODES 全实施收官）
- ✅ CHG-368-A ADR-164 起草（arch-reviewer Opus A- Accepted）
- ✅ CHG-368-B-A1/A2a/A2b/A3/B/C-DOCS/C-UI（详 changelog）

**Wave 2 完整收官**：主线 13/13 + ADR 2/2 全 Accepted + 实施 6/6 + docs sync + Opus 评审全部完成。

---

## 下次会话恢复入口

- **Wave 3 验收签字**（用户走完 `docs/manual/wave-3-acceptance.md` §6 建议路径后）→ 主循环自动取 Wave 4 首卡
- **SEQ-FOLLOWUP-MIGRATE**（用户决策方案 A 抽出）：BTN_* → AdminButton 38 tsx / 100+ button 长尾迁移
- **SEQ-FOLLOWUP-ARCH**（用户决策组合 X 抽出）：CHG-SN-9-SITE-VIEWS-EXTRACT plan §10.6 方案 C 抽 packages/site-views
- **CHG-SN-9-META-BANGUMI-A** DEFERRED（用户决策组合 X / plan §13 暂缓 / 下一轮迭代）
- **CHG-SN-9-REJECTED-ENHANCE-B** 视觉对齐（plan §7 拆 -B）：BTN_SM → AdminButton + 复用 SplitPane + 批量 reopen + 跳转回 pending 提示
- **CHG-SN-9-PLAYER-ERROR-CONSUMER-A** AdminPlayer onError 消费 + feedback 上报失败
- **CHG-SN-9-PLAYER-ERROR-CONSUMER-B** PlayerShell onError 消费 + 自动切下一线路 + 标 dead-source
- **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL** retrySourceLoad 上抛
- **PRE-DEAD-LINE-AUTO-RETIRE-WORKER**（A-164-1 占位）：plan §10.5 全 dead 180 天自动退役 worker
- 其他 pre-existing 长尾 / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** 等
