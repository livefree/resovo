# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-03

---

（空 / **CHG-VIR-9-B Phase 2c identity_decisions migration + confirmed→merge + reject 写路径 ✅ 已完成（SEQ-20260602-03）** 2026-06-03：ADR-178 Accepted（reject 端点 + DDL 定档 D-178-1~6）+ ADR-105a AMENDMENT（D-105a-11 闭环 R8）；Migration 087（identity_decisions：R8 CHECK + partial unique confirmed + revert consistency，真实 DB 验证 6 项约束）+ 088（target_kind 14→15）；新 IdentityCandidatesService（reject 单事务 / validateForMerge / attachConfirmedDecision）+ identity-decision queries + merge 单事务挂 decision(confirmed,auditId)〔校验全在 BEGIN 前，主路径零变更；并发冲突整 merge ROLLBACK〕+ unmerge 联动 reverted〔candidate 保持 confirmed〕+ 新 route POST /admin/identity-candidates/:id/reject + audit 枚举 4 处同步（R-MID-1 第 31 次）；merge 函数 110→60 行拆分。门禁全过 6196 passed 0 failed（净 +37）/ claude-opus-4-8 + code-architect (claude-opus-4-8)。**解阻 CHG-VIR-9-C**。详见 changelog + task-queue.md。 / **CHG-VIR-9-A Phase 2c 端点 ADR amendment + 候选来源读切换 ✅ 已完成（SEQ-20260602-03）** 2026-06-03：ADR-137 AMENDMENT 2.0（similar 端点保留路径 + `?source=identity|legacy` default identity + 响应扩 optional candidateId/identityScore/strongNegativeReasons/status，向后兼容）+ ADR-105a AMENDMENT（merge candidates `?source=` default legacy）；新 query listPendingCandidatesByVideoId（审核台对侧召回 CASE）+ listPendingCandidatePairs（merge 折叠）；ModerationService.listSimilar source 分支 + 空表自动降级 legacy（返回 {items,source}）；VideoMergesService.listCandidates source 分支 + buildGroupFromPair（抽 schemas，每 pair→2-video group）+ 空表降级；schema source 参数（similar/candidates）+ 前端 api 类型扩展（SimilarVideoItem optional + source 参数）。门禁全过 6159 passed 0 failed 零回归（净 +9：source-switch 7 + queries 2；moderation-similar 7 现有测试更新消费新契约）/ claude-opus-4-8 + code-architect 蓝图。无新 route/migration（verify:endpoint-adr 不触发）。**解阻 CHG-VIR-9-B**（identity_decisions + confirmed→merge + reject 端点）。详见 changelog + task-queue.md。 / **CHG-VIR-9 Phase 2c 设计阶段完成 → 拆 9-A/9-B/9-C（SEQ-20260602-03 / 待用户裁定 3 决策点后起 9-A）** 2026-06-03：code-architect (claude-opus-4-8 / agentId a662a6b4cd495065e) 端点 ADR amendment 草案 + 实施蓝图。结论体量 12+ 项必拆 3 子卡（9-A 端点 ADR+读切换 / 9-B identity_decisions migration+confirmed→merge+reject 端点 / 9-C UI），依赖序 9-A→9-B→9-C，已入 task-queue。ADR-137 AMENDMENT 已预告取代方向（实施+契约细化）。**3 待裁定决策点**：(a) /admin/merge 默认 source（荐 legacy 直到 shadow 稳定）(b) reject 新增独立端点（荐是 → 新 route 须 ADR+Opus PASS）(c) 切 identity 默认前是否先全量回填 title_observations（荐 similar 先切·merge 待回填）。详见 task-queue.md。 / **CHG-VIR-8 Phase 2b identity_candidate + 离线生成 job ✅ 已完成（SEQ-20260602-03 / ADR-105a D-105a-7/8/10）** 2026-06-03：Migration 086（identity_candidate 表 + 6 索引含 partial unique pending + blocking 表达式索引 + 2 CHECK / 真实 DB 验证约束生效）+ identity 模块 5 新文件（evidenceHash 确定性 sha256 D-105a-8 / candidateUpsert 单事务幂等 R5/R6 / externalIdLoader Y-105a-4 / offlineRescore Blocking 分桶→评分→upsert pipeline / queries 6 函数）+ Bull worker（apps/api/src/workers，裁定 A 评分逻辑单一真源不跨 ADR-107 §4）+ 2 运维脚本（手动触发 + 对比报表，不切 UI/不加端点）。code-architect Opus 蓝图忠实落地；蓝图偏离（合理）：不加自动 scheduler（shadow 阶段手动触发）+ offlineRescore 内联 scorePair 消除循环依赖。门禁全过 6148 passed + 净 35 测试（2 jsdom flaky 隔离全过无关）/ claude-opus-4-8 + code-architect。**解阻 CHG-VIR-9（Phase 2c）**。详见 changelog + task-queue.md。 / **CHG-VIR-7 Phase 2a 候选附加多证据 evidence ✅ 已完成（SEQ-20260602-03 / ADR-105a D-105a-3/5/6/9/15）** 2026-06-03：新建 `apps/api/src/services/identity/` 评分模块（weights 权重常量 + type-compat 矩阵 D-105a-5 + scorePair 单对评分 D-105a-3 聚合 + aggregateGroup group→单值 D-105a-15 min/union + scoreGroup 编排）+ `Evidence`/`PairScore`/`GroupIdentityScore` 类型契约（packages/types，code-architect Opus 蓝图）+ CandidateGroup 加 optional `identity` 字段（与 legacyScore=score 分离 / R3）+ listCandidates 唯一新增行 `identity: scoreGroup(videos)`（minScore/排序/分页只看 legacyScore，候选数量/排序逐值不变 Y-105a-1）+ MergeClient 双 pill（置信度+身份分）+ 抽 EvidencePanel.tsx（为何可合并/拦截/逐对明细）。release_marker_mismatch（CHG-VIR-6.5）落地 veto。p95 优化：去 Phase 2a 未评估占位 evidence（scoreGroup 7.46→5.55ms，perf p95 < 200ms 稳定）。门禁全过 6115 passed 0 failed 零回归（净 +31）/ claude-opus-4-8 + code-architect (claude-opus-4-8)。外部 ID/集数/metadata 证据留 Phase 2b。详见 changelog + task-queue.md。 / **CHG-VIR-6.5 Phase 2 前置门禁 ✅ 已完成（ADR-105a AMENDMENT / SEQ-20260602-03）** 2026-06-02：D-105a-3 强负表补 `release_marker_mismatch`（对齐 ADR-176 剧场版/SP/OVA 独立 catalog；arch-reviewer CONDITIONAL → 红线 A1 null 语义收窄〔仅双方非 null 且不同才 veto〕/ A2 exact 不豁免 / B1 group 聚合 over all unordered pairs〔min+union 零 recommendedTarget 新原语〕+ 黄线 a1/b1/c1 全吸收）+ 新增 D-105a-14/15 + adr-parser.mjs 正则放宽 `D-\d+[a-z]?-\d+` 识别 `D-105a-N`（唯一影响=识别 105a，103a/103b 无 D 编号零变化）。门禁全过 6084 passed 零回归 / claude-opus-4-8 + arch-reviewer (claude-opus-4-8)。**解除 CHG-VIR-7 硬前置**。详见 changelog + task-queue.md。 / **CHG-VSR-4-A 视频库列重构 ✅ 已完成（复合显示列 + 默认隐藏原子列 + §2.4 数据格式 / 设计 §2.2/§2.3/§2.4/§2.5/§2.6）** 2026-06-02：VideoColumns 重组默认可见 9 列（cover/title「视频」/type/release 复合/episodes §2.4 降级/meta〔enrichment→meta〕/status 复合/updated/actions）+ §2.3 降级 source_health·probe·image_health 默认隐藏 + §2.6② 原子列 year/country/catalog_status/visibility/review_status/is_published/douban_status/bangumi_status/meta_score 默认隐藏 render-only；复合列与未接线列显式 `filterable:false`（D-150-AMD2-1 / §2.6 只读），4-A 筛选面 = title/type/visibility/review_status；排序 buildVideoFilter COMPOSITE_SORT_MAP（release→year/episodes→episode_count/meta→meta_score/status→review_status）+ 白名单 +episode_count + default sort updated_at desc；VIDEO_COLUMN_DESCRIPTORS 同步 + 新建 VideoColumns.test 25 用例 + enrichment-cluster-faces 同步。门禁全过 451 files 5984 passed 0 failed 零 flaky（净 +25）；filter 接线/搜索/快捷筛选/行操作/头部清理留 4-B；e2e 结构零破坏归 CHG-VSR-7。详见 changelog + task-queue.md。 / **CHG-VSR-6 用共享 `LinesPanel` 替换 `MatrixExpand` ✅ 已完成（消费 PRE-2 控制器 / 设计 §3.6）** 2026-06-02：删 `MatrixExpand` + 死代码（`SourceMatrixRow` 主组件/`EpisodeCellBlock`/矩阵常量），新建 `SourceLinesExpand` 消费 `useSourceLinesController` + 共享 `LinesPanel`(regular) + `groupSourcesByLine` + 本地 `LineHealthDrawer`；三宗罪修复（消除 render 阶段请求 / `.slice(0,8)` 截断 / 全操作接通含 codename·retired·auto_retired）；反馈 `actionError` 红条 + `useToast` 浮层（内联中文）；保留 `SignalPill`（SourceColumns 依赖）。门禁全过 5955 passed 0 failed 零 flaky（+1 展开测试）；无新端点/schema/ADR；e2e 与 smoke 正交归 CHG-VSR-7；drawer 第 3 处提取 `useLineHealthDrawer` 拆 follow-up 卡 14（用户裁决）。详见 changelog + task-queue.md。 / **CHG-VSR-6 用共享 `LinesPanel` 替换 `MatrixExpand` ✅ 已完成（消费 PRE-2 控制器 / 设计 §3.6）** 2026-06-02：删 `MatrixExpand` + 死代码（`SourceMatrixRow` 主组件/`EpisodeCellBlock`/矩阵常量），新建 `SourceLinesExpand` 消费 `useSourceLinesController` + 共享 `LinesPanel`(regular) + `groupSourcesByLine` + 本地 `LineHealthDrawer`；三宗罪修复（消除 render 阶段请求 / `.slice(0,8)` 截断 / 全操作接通含 codename·retired·auto_retired）；反馈 `actionError` 红条 + `useToast` 浮层（内联中文）；保留 `SignalPill`（SourceColumns 依赖）。门禁全过 5955 passed 0 failed 零 flaky（+1 展开测试）；无新端点/schema/ADR；e2e 与 smoke 正交归 CHG-VSR-7；drawer 第 3 处提取 `useLineHealthDrawer` 拆 follow-up 卡 14（用户裁决）。详见 changelog + task-queue.md。 / **CHG-VSR-PRE-2 抽中性 `useSourceLinesController(videoId)` ✅ 已完成（§5.5 / arch-reviewer 蓝图 R1-R5/Y1-Y4）** 2026-06-02：新建中性数据层 hook（乐观锁 toggle R2 / batch stale-write R3 / 结构化 onActionResult R4 / fetchHealth 留 drawer R5 / onLoaded 首行选 Y4）+ R1 源操作真源移 moderation/api→sources/api（moderation re-export 兼容）+ Y1 `SourceLineRowData` 中性行 + 两消费方迁移（moderation/LinesPanel 341→219 / TabLines 接 hook 新增 probe·render）。门禁全过 5949 passed 零失败零 flaky（新增 hook 14 用例）；e2e 审核台 3 spec 因本机鉴权 env（mock cookie 走真实 :4000→307 login）+ :3000 webServer 冲突，在页面加载前失败=非回归，真门禁归 CHG-VSR-7。解阻 CHG-VSR-6。详见 changelog + task-queue.md。 / **CHG-VSR-5-B 播放线路快捷筛选(B：可点击 KPI 卡 pressed) + 列头筛选 + 删 SourceSegment ✅ 已完成（设计 §3.5/§4）** 2026-06-02：5 KPI 可点击卡（全部/含异常源/待补源/待探测/低质量，消费②维度 stats，KpiCard onClick+pressed 可组合 AND）+ quality 列「低质量」单选 enum filter（映射 lowQuality）+ typed client 补 quickFilters/lowQuality 序列化 + 删 SourceSegment 枚举/segment 查询分支（types/api/server-next/tests，全仓代码零引用）。门禁全过 5934 passed + 1 flaky(CrawlerClient 隔离通过)；e2e smoke test 1/2/4 PASS、test 3 仍 = 已追踪 CHG-VSR-DTAF-VIEWPORT（零新破坏）。详见 changelog + task-queue.md。/ **CHG-VSR-5-A 播放线路结构重构 ✅ 已完成（删四 Tab + 删内嵌别名 Tab + 列重构 / 设计 §3.1/§3.2）** 2026-06-02：SourcesClient 377→264 删 segment 四 Tab + 主体/别名 Tab + 内嵌面板（保留别名管理跳转 + KPI 4 卡 display + 自动 refetch）；SourceColumns 重建 §3.2 列集（video/coverage/probe/render/quality/issues/sites/last_checked，复用 Pill，保留 e2e 关键列 id）；typed client 补 lastCheckedFrom/To 序列化；SourcesClient.test 同步 8 passed。门禁全过 5931 passed + 1 flaky(StagingEditPanel 隔离通过)。KPI pressed/quality 过滤/快捷筛选留 5-B、LinesPanel 留 6、e2e 留 7。详见 changelog + task-queue.md。/ **CHG-VSR-3 线路聚合 API 派生列 + KPI②维度 + queries 拆分 ✅ 已完成（ADR-117 AMENDMENT 3 / D-117-VSR3-1..8）** 2026-06-02：queries 拆 4 文件（sources-matrix.ts 759→381 解硬限 + 3 新 query 文件全 <500 零新违规 / budget 净改善 -1）+ 派生列单趟聚合 FILTER（QUALITY_RANK_EXPR alias 工厂三处共用 / COALESCE 回退口径 / coverage / percentile_cont 延迟中位 / qualityHighest CASE MAX 反查）+ KPI② per-video 子查询 + 外层 COUNT FILTER（①口径零变更逐值回归 + ②abnormal/needsSource/pendingProbe/lowQuality）+ quickFilters 全 WHERE EXISTS（lowQuality OR 合流单份谓词）+ sortField 扩 activeSources/quality/lastChecked（IDENT 正则零放宽）+ 派生列双层透传 + 7 测试 BLOCKER 方案 A mock 路径迁移。门禁全过 5933 passed（1 flaky=VideoImageSection 隔离重跑通过、与本卡无关）+ 新增 25 单测。详见 changelog + task-queue.md。/ **CHG-DT-RESIZE-ROLLOUT 列宽可调推广 server-next 全表 ✅ 已完成（含 Codex stop-time review FIX）** 2026-06-01：先 merge main→dev 引入 resize 核心 DTR-A..F；server-next **全部 `<DataTable>` 渲染点 17 个（操作型 15 个 = 14 client 文件，ImageHealthClient 含 2 表；+ dev/components demo 2 个）**启用 `enableColumnResizing`（4 已接线仅加开关 / 9 补 in-session columnPrefs 接线 / Merge·SourceLineAliases·ImageHealth·Staging·KeywordCrawl·demo 补列宽规避 flex 回归）。**Codex review FIX**：逐表审计「≥2 无 width 列 / 主列无 minWidth」回归点，修 ImageHealth missing·Staging·KeywordCrawl·demo 共 4 处。门禁全过 5902 passed 零回归。详见 changelog。/ **SEQ-20260531-01 归并键剥标点统一全序列 ✅ 完全收官** 2026-06-01：A✅ B✅ C✅ D✅ **E✅**。META-23-E 全量回归 5832 passed 零回归 + 4 门禁全过 + architecture.md 字段语义收尾；用户重跑 `reenrich-backfill --mode unmatched --type anime`（453 入队）后 **JP anime 命中率 48.7%→56.4%（+7.7pp）** / 全 anime matched 145→166（+21）/ 23 条 dedupConflict 降级 candidate / meta_null=0 / 队列已 drain。详见 task-queue.md + changelog.md。）

---

## ✅ Wave 4 完全收官（SEQ-20260528-MOD-WAVE4 / 用户验收签字 2026-05-29）

实施期 6/6 + 7 拆卡（4-ADR / 4-EP / 5-A / 5-B）+ **8 Codex stop-time review FIX** 全闭环 + arch-reviewer Opus 2 次评审（ADR-166 + PRE-DEAD-LINE-WORKER）+ **用户验收返工 1 轮 4 finding（FIX-1/2/3）+ Codex 第 8 轮 LEFT JOIN 退化 FIX-4** / 17 commits（13 主线 + 4 验收返工）/ 1 ADR 起草并 Accepted（ADR-166）/ 1 ADR 完整链路闭环（ADR-164 D-164-8 schema → query → worker → UI）。

**验收报告**：`docs/manual/wave-4-acceptance.md`（§9 用户已签字 PASS 2026-05-29）

详细卡片清单 ↓

### Wave 4 主线（6 张实施 / 含 2 拆卡）

- ✅ **CHG-SN-9-REJECTED-ENHANCE-B** RejectedTab 视觉对齐 BTN_SM → AdminButton+SplitPane+批量 reopen（2026-05-28 / opus-4-7）
- ✅ **CHG-SN-9-PLAYER-ERROR-CONSUMER-A** AdminPlayer onError + feedback 上报（2026-05-28 / opus-4-7 / DEBT-FIX-D-ERROR 闭环）
- ✅ **CHG-SN-9-PLAYER-ERROR-CONSUMER-B** PlayerShell onError + 自动切线（2026-05-28 / opus-4-7 / R-N-3 闭环）
- ✅ **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-ADR**（+FIX-1）ADR-166 起草 + player-core onError(event, controls)（2026-05-28 / opus-4-7 + arch-reviewer Opus A- CONDITIONAL）
- ✅ **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-EP**（+FIX-2 +FIX-3）AdminPlayer key-bump + PlayerShell retry watchdog 3s（2026-05-28 / opus-4-7）
- ✅ **CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A**（+FIX-1 +FIX-2）Migration 081 + queries + docs（2026-05-28 / opus-4-7 + arch-reviewer Opus A- CONDITIONAL）
- ✅ **CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B**（+FIX-3）worker cron 03:30 daily + 内联 SQL ADR-107 §4 合规（2026-05-28 / opus-4-7）
- ✅ **CHG-SN-9-WAVE3-FOLLOWUP-CODENAME-MATRIX-E2E** playwright 4 case + route-labeling.md §9.10/9.11（2026-05-28 / opus-4-7）

### Codex stop-time review FIX 全闭环（6 轮）

- ✅ FIX-1（#4-ADR）：controls.retry active 双层守卫
- ✅ FIX-2（#4-EP）：watchdog currentEpisode cleanup
- ✅ FIX-3（#4-EP）：watchdog shortId cleanup
- ✅ FIX-1（#5-A）：advisory lock 同 client session + SQL deleted_at 过滤
- ✅ FIX-2（#5-A）：unlock 失败 client.release(err) destroy connection
- ✅ FIX-3（#5-B）：撤回 apps/api 跨 app import / worker 内联 SQL（ADR-107 §4）

---

## ✅ Wave 3 完全收官（SEQ-20260528-MOD-WAVE3 / 用户验收签字 2026-05-28）

实施期 9/10 + 3 DEFERRED + 验收期补丁 2 张 + Codex stop-time review 4 次 FIX 全闭环 / 17 commits / 4 ADR Accepted（ADR-165 + 既有 ADR-110/-117/-164 AMENDMENT）。

**验收报告**：`docs/manual/wave-3-acceptance.md`（§9 用户已签字）

详细卡片清单 ↓

### Wave 3 主线 + 长尾（9 张实施）

- ✅ **PRE-INDEX-DESIGN-RULES**（2026-05-28 / sonnet-4-6）
- ✅ **CHG-369-B** 自定义主题输入（2026-05-28 / sonnet-4-6）
- ✅ **CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW** Layer B 通路（2026-05-28 / sonnet-4-6）
- ✅ **CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL** UI 自动/手动区分（2026-05-28 / sonnet-4-6 + Opus）
- ✅ **CHG-SN-9-REJECTED-ENHANCE-A** 分页（2026-05-28 / sonnet-4-6）
- ✅ **CHG-SN-9-PLAYER-ERROR** public API（2026-05-28 / sonnet-4-6 + Opus）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-ADR** ADR-165 Accepted（2026-05-28 / sonnet-4-6 + Opus）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-A1** 后端实施（2026-05-28 / sonnet-4-6）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-A2** 前端实施 + 2 Codex FIX（2026-05-28 / sonnet-4-6）

### Wave 3 验收期补丁（2 张）

- ✅ **CHG-SN-9-LINES-VIEW-UNIFY** 线路别名管理改造 + 入口移到播放线路 + FIX-3（FULL OUTER JOIN）+ FIX-4（stale mock）
- ✅ **CHG-SN-9-CODENAME-MATRIX** 52 字库预览表 + 单元格内联代号分配 + 重复使用建议

### 3 DEFERRED（用户决策）

- ⛔ **CHG-SN-9-MOD-BUTTON-MIGRATE**（方案 A）→ SEQ-FOLLOWUP-MIGRATE
- ⛔ **CHG-SN-9-META-BANGUMI-A**（plan §13 暂缓 / 下一轮迭代）
- ⛔ **CHG-SN-9-SITE-VIEWS-EXTRACT**（组合 X）→ SEQ-FOLLOWUP-ARCH

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / ✅ **完全收官 = 100%**）

详细见 changelog。Layer B 山名代号体系完整 ship（schema + 业务 + admin audit + UI + 字库 + 退役治理 + LinesPanel 显示）/ ADR-164 5 黄线 + 4 advisory 全部闭档 / Wave 4 #5-A/-B 完整闭环 D-164-8 worker 自动退役。

---

## 下次会话恢复入口（含 Wave 5 待立案 + 长尾）

- **Wave 5 待立案**：Wave 4 验收签字后用户决策方向；建议候选包括：
  - **SEQ-FOLLOWUP-MIGRATE**（Wave 3 BLOCKER 方案 A）：BTN_* → AdminButton 38 tsx / 100+ button 长尾迁移
  - **SEQ-FOLLOWUP-ARCH**（Wave 3 组合 X）：CHG-SN-9-SITE-VIEWS-EXTRACT 抽 packages/site-views
  - **CHG-SN-9-META-BANGUMI-A**（plan §13 暂缓 / 下一轮迭代候选）
  - **Y-DEAD-3 follow-up**：CHG-PRE-DEAD-LINE-UNRETIRE-ENDPOINT（人工 unretire admin 端点 / 起 R-MID-1 RETRO）
  - **Y-DEAD-4 follow-up**：LinesPanel dead_since tooltip（运维可观测性提升）
- 其他 pre-existing 长尾 / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** 等

---

## 新会话启动指引（Wave 5 待立案）

```bash
# 1. 启动 Claude Code（推荐 sonnet 主循环 / Wave 4 各卡偏离 opus 已 ship）
claude --model claude-sonnet-4-6

# 2. 第一句指令（任选）：
#   - "Wave 4 验收 / 起 Wave 5 立案"
#   - "Wave 4 用户签字完成"
#   - "继续推进长尾 SEQ-FOLLOWUP-MIGRATE"（直接进具体 SEQ）
```

主循环将先校验 `docs/manual/wave-4-acceptance.md` 用户签字状态 → 按用户决策推进 Wave 5 立案或具体长尾 SEQ。
