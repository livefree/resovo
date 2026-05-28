# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空 / Wave 3 -A1 后端实施闭环 / 下一卡 -A2 前端实施待启动）

---

## Wave 3 状态（SEQ-20260528-MOD-WAVE3 / 🔄 进行中 = 80% / 8/10 + 3 DEFERRED）

- ✅ **PRE-INDEX-DESIGN-RULES**（2026-05-28 / sonnet-4-6 / 纯 docs / 4 步核验 + 双 invariant + 四级范式沉淀 db-rules.md）
- ✅ **CHG-369-B**（2026-05-28 / sonnet-4-6 / 5+1 / CustomThemeDialog NEW + 双 key localStorage）
- ✅ **CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW**（2026-05-28 / sonnet-4-6 / 3 / listAdminSources JOIN + ContentSourceRow 扩）
- ✅ **CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL**（2026-05-28 / sonnet-4-6 + Opus 4-7 / 6 接受完成度风险 / ADR-164 D-164-8 UI 兑现）
- ⛔ **CHG-SN-9-MOD-BUTTON-MIGRATE** DEFERRED（2026-05-28 / 用户决策方案 A / 独立 SEQ-FOLLOWUP-MIGRATE）
- ✅ **CHG-SN-9-REJECTED-ENHANCE-A**（2026-05-28 / sonnet-4-6 / 5 / useRejectedQueue hook + 分页）
- ✅ **CHG-SN-9-PLAYER-ERROR**（2026-05-28 / sonnet-4-6 + Opus 4-7 / 5 / player-core onError + suppressDefaultErrorUI public API）
- ⛔ **CHG-SN-9-META-BANGUMI-A** DEFERRED（2026-05-28 / 用户决策组合 X / plan §13 既有"Bangumi 暂缓"一致）
- ⛔ **CHG-SN-9-SITE-VIEWS-EXTRACT** DEFERRED（2026-05-28 / 用户决策组合 X / 独立 SEQ-FOLLOWUP-ARCH）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-ADR**（2026-05-28 / sonnet-4-6 + arch-reviewer Opus 4-7 / 1 docs / Opus A- CONDITIONAL → 5 红线 + 4 P1 黄线 + 2 关键洞察全消化 → 升 Accepted）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-A1**（2026-05-28 / sonnet-4-6 / 4 业务 + 1 测试 PATCH=5 + 1 architecture.md sync / Migration 080 + types runtime exports + queries + Service + 路由 2 端点 / 8/8 测试 PASS / D-165-1/-2/-3/-9 后端层闭环）

剩余 1 张实施子卡：CHG-SN-9-ROUTE-LABEL-D-A2（前端 / useUserPreferencesSync hook + route-theme-storage 改造 + RouteThemeSelector syncing + 测试 + docs/manual / PATCH≤5）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / ✅ **完全收官 = 100%**）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A/B-A/B-B（ADR-163 META-EPISODES 全实施收官）
- ✅ CHG-368-A ADR-164 起草（arch-reviewer Opus A- Accepted）
- ✅ CHG-368-B-A1 数据层（Migration 079 + types + queries SELECT / + 5 次 FIX 沉淀索引设计 4 步核验规范）
- ✅ CHG-368-B-A2a queries + Service 业务层
- ✅ CHG-368-B-A2b route 3 端点 + R-MID-1 RETRO 7 文件（R-MID-1 第 29-30 次系统化）
- ✅ CHG-368-B-A3 route-scoring priority 通道激活 + listSources JOIN retired_at IS NULL 谓词
- ✅ CHG-368-B-B admin UI 独立路径 /admin/source-line-aliases + DataTable 一体化
- ✅ CHG-368-B-C-DOCS docs/architecture.md "已 ship" 升级 + docs/manual/route-labeling.md §9 Layer B 实施记录
- ✅ CHG-368-B-C-UI LinesPanel codename badge + 退役行 opacity（arch-reviewer Opus A）

**Wave 2 完整收官**：主线 13/13 + ADR 2/2 全 Accepted + 实施 6/6 + docs sync + Opus 评审全部完成。

---

## 下次会话恢复入口

- **CHG-SN-9-ROUTE-LABEL-D-A2**：ADR-165 §11 前端实施（useUserPreferencesSync NEW + route-theme-storage 改造 + RouteThemeSelector syncing + 测试 + docs/manual / PATCH≤5）
- **SEQ-FOLLOWUP-MIGRATE**（用户决策方案 A 抽出）：BTN_* → AdminButton 38 tsx / 100+ button 长尾迁移
- **SEQ-FOLLOWUP-ARCH**（用户决策组合 X 抽出）：CHG-SN-9-SITE-VIEWS-EXTRACT plan §10.6 方案 C 抽 packages/site-views
- **CHG-SN-9-META-BANGUMI-A** DEFERRED（用户决策组合 X / plan §13 暂缓 / 下一轮迭代）
- **CHG-SN-9-REJECTED-ENHANCE-B** 视觉对齐（plan §7 拆 -B）：BTN_SM → AdminButton + 复用 SplitPane + 批量 reopen + 跳转回 pending 提示
- **CHG-SN-9-PLAYER-ERROR-CONSUMER-A** AdminPlayer onError 消费 + feedback 上报失败
- **CHG-SN-9-PLAYER-ERROR-CONSUMER-B** PlayerShell onError 消费 + 自动切下一线路 + 标 dead-source
- **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL** retrySourceLoad 上抛
- **PRE-DEAD-LINE-AUTO-RETIRE-WORKER**（A-164-1 占位）：plan §10.5 全 dead 180 天自动退役 worker
- 其他 pre-existing 长尾 / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** 等
