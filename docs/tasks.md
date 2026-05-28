# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 3 状态（SEQ-20260528-MOD-WAVE3 / 🔄 进行中 = 60% / 6/10 + 1 DEFERRED）

- ✅ **PRE-INDEX-DESIGN-RULES** 索引设计 4 步核验 + 双 invariant + 四级范式 + 禁令 + Checklist 沉淀到 db-rules.md（2026-05-28 / sonnet-4-6 / 纯 docs / 零回归 / CHG-368-B-A1-FIX 1-5 经验首次完整规范化）
- ✅ **CHG-369-B** 自定义主题输入（2026-05-28 / sonnet-4-6 / 5 业务+测试 PATCH=5 + 1 docs / CustomThemeData schema + 双 key localStorage + CustomThemeDialog NEW + RouteThemeSelector 扩 + PlayerShell wiring / 54/54 测试 PASS / docs/manual §8.7 "未实装" → "已 ship 2026-05-28"）
- ✅ **CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW** Layer B codename + retired_at 数据通路打通（2026-05-28 / sonnet-4-6 / 2 业务 + 1 测试 PATCH=3 / listAdminSources LEFT JOIN source_line_aliases + SELECT 扩 2 列 / ContentSourceRow 扩 2 字段 / 34/34 admin-sources 域测试 PASS / PRE-INDEX-DESIGN-RULES 4 步核验首次显式应用）
- ✅ **CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL** LinesPanel 退役标识自动/手动区分（2026-05-28 / sonnet-4-6 + arch-reviewer Opus 4-7 / Opus A- CONDITIONAL → Y-A-1/Y-A-2 全落升 A / 4 业务 + 1 测试 + 1 docs PATCH=6 超 5 接受完成度风险 / ADR-164 D-164-8 UI 兑现 / 53/53 测试 PASS / 双红线触发 Subagents trailer）
- ⛔ **CHG-SN-9-MOD-BUTTON-MIGRATE** DEFERRED（2026-05-28 / 用户决策方案 A / 38 文件 100+ button 远超 PATCH 5 软上限 / 独立 SEQ-FOLLOWUP-MIGRATE 长尾系列择期推进）
- ✅ **CHG-SN-9-REJECTED-ENHANCE-A** RejectedTab 分页 hook 抽取 + 接入（2026-05-28 / sonnet-4-6 / 3 业务 + 1 测试 + 1 i18n PATCH=5 严守 / useRejectedQueue.ts NEW 152 行 + RejectedTabContent 接入 + listHeaderWithTotal/loadMore/loadingMore/allLoaded i18n 扩 / 8/8 hook 测试 PASS / plan §5 P2 rejected 写死 30 条 bug 闭环 / -B 视觉对齐留 follow-up）
- ✅ **CHG-SN-9-PLAYER-ERROR** player-core onError + suppressDefaultErrorUI public API（2026-05-28 / sonnet-4-6 + arch-reviewer Opus 4-7 / Opus A- CONDITIONAL → 3 红线 R-N-1/-2/-3 全落 + 4 黄线 3 落 1 留升 A / 4 业务 + 1 测试 PATCH=5 / DEBT-FIX-D-ERROR API 闭环 / ADR-108 兑现 / 6/6 buildOverlayEntries 测试 PASS / 双红线触发 Subagents trailer）

剩余 3 张卡（按执行序列）：CHG-SN-9-META-BANGUMI-A → CHG-SN-9-SITE-VIEWS-EXTRACT → CHG-SN-9-ROUTE-LABEL-D

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

**Wave 2 完整收官**：主线 13/13 + ADR 2/2 全 Accepted + 实施 6/6 + docs sync + Opus 评审全部完成。Layer B 山名代号体系完整 ship（schema + 业务 + audit + UI + 字库 + 退役治理 + LinesPanel 显示 + Wave 3 衔接补丁 codename/retired_at/auto_retired 三字段全通）/ ADR-164 5 黄线 + 4 advisory 全部闭档。

---

## 下次会话恢复入口

- **SEQ-FOLLOWUP-MIGRATE**（Wave 3 用户决策方案 A 抽出）：BTN_* → AdminButton 38 tsx 文件 / 100+ raw button 长尾迁移 / 按域拆 7-8 子卡 / 独立 SEQ 择期推进 / 非 Wave 节奏
- **CHG-SN-9-REJECTED-ENHANCE-B** 视觉对齐（plan §7 拆 -B）：BTN_SM → AdminButton + 复用 SplitPane + 批量 reopen + 跳转回 pending 提示
- **CHG-SN-9-PLAYER-ERROR-CONSUMER-A** AdminPlayer onError 消费 + feedback 上报失败（POST /v1/feedback/playback {success:false, errorCode}）
- **CHG-SN-9-PLAYER-ERROR-CONSUMER-B** PlayerShell onError 消费 + 自动切下一线路 + 标 dead-source
- **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL** retrySourceLoad 上抛（onError(event, controls) vs imperativeHandle 二选 / 跨 Opus 决策）
- **CHG-SN-9-ROUTE-LABEL-D 跨设备主题同步**（plan §17.2 Wave 3）：users.preferences schema
- **PRE-DEAD-LINE-AUTO-RETIRE-WORKER**（A-164-1 占位）：plan §10.5 全 dead 180 天自动退役 worker（写 retired_at + auto_retired=true）
- 其他 pre-existing 长尾 / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** 等
