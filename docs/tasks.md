# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-31

---

（空 / **CHG-VSR-6 用共享 `LinesPanel` 替换 `MatrixExpand` ✅ 已完成（消费 PRE-2 控制器 / 设计 §3.6）** 2026-06-02：删 `MatrixExpand` + 死代码（`SourceMatrixRow` 主组件/`EpisodeCellBlock`/矩阵常量），新建 `SourceLinesExpand` 消费 `useSourceLinesController` + 共享 `LinesPanel`(regular) + `groupSourcesByLine` + 本地 `LineHealthDrawer`；三宗罪修复（消除 render 阶段请求 / `.slice(0,8)` 截断 / 全操作接通含 codename·retired·auto_retired）；反馈 `actionError` 红条 + `useToast` 浮层（内联中文）；保留 `SignalPill`（SourceColumns 依赖）。门禁全过 5955 passed 0 failed 零 flaky（+1 展开测试）；无新端点/schema/ADR；e2e 与 smoke 正交归 CHG-VSR-7；drawer 第 3 处提取 `useLineHealthDrawer` 拆 follow-up 卡 14（用户裁决）。详见 changelog + task-queue.md。 / **CHG-VSR-PRE-2 抽中性 `useSourceLinesController(videoId)` ✅ 已完成（§5.5 / arch-reviewer 蓝图 R1-R5/Y1-Y4）** 2026-06-02：新建中性数据层 hook（乐观锁 toggle R2 / batch stale-write R3 / 结构化 onActionResult R4 / fetchHealth 留 drawer R5 / onLoaded 首行选 Y4）+ R1 源操作真源移 moderation/api→sources/api（moderation re-export 兼容）+ Y1 `SourceLineRowData` 中性行 + 两消费方迁移（moderation/LinesPanel 341→219 / TabLines 接 hook 新增 probe·render）。门禁全过 5949 passed 零失败零 flaky（新增 hook 14 用例）；e2e 审核台 3 spec 因本机鉴权 env（mock cookie 走真实 :4000→307 login）+ :3000 webServer 冲突，在页面加载前失败=非回归，真门禁归 CHG-VSR-7。解阻 CHG-VSR-6。详见 changelog + task-queue.md。 / **CHG-VSR-5-B 播放线路快捷筛选(B：可点击 KPI 卡 pressed) + 列头筛选 + 删 SourceSegment ✅ 已完成（设计 §3.5/§4）** 2026-06-02：5 KPI 可点击卡（全部/含异常源/待补源/待探测/低质量，消费②维度 stats，KpiCard onClick+pressed 可组合 AND）+ quality 列「低质量」单选 enum filter（映射 lowQuality）+ typed client 补 quickFilters/lowQuality 序列化 + 删 SourceSegment 枚举/segment 查询分支（types/api/server-next/tests，全仓代码零引用）。门禁全过 5934 passed + 1 flaky(CrawlerClient 隔离通过)；e2e smoke test 1/2/4 PASS、test 3 仍 = 已追踪 CHG-VSR-DTAF-VIEWPORT（零新破坏）。详见 changelog + task-queue.md。/ **CHG-VSR-5-A 播放线路结构重构 ✅ 已完成（删四 Tab + 删内嵌别名 Tab + 列重构 / 设计 §3.1/§3.2）** 2026-06-02：SourcesClient 377→264 删 segment 四 Tab + 主体/别名 Tab + 内嵌面板（保留别名管理跳转 + KPI 4 卡 display + 自动 refetch）；SourceColumns 重建 §3.2 列集（video/coverage/probe/render/quality/issues/sites/last_checked，复用 Pill，保留 e2e 关键列 id）；typed client 补 lastCheckedFrom/To 序列化；SourcesClient.test 同步 8 passed。门禁全过 5931 passed + 1 flaky(StagingEditPanel 隔离通过)。KPI pressed/quality 过滤/快捷筛选留 5-B、LinesPanel 留 6、e2e 留 7。详见 changelog + task-queue.md。/ **CHG-VSR-3 线路聚合 API 派生列 + KPI②维度 + queries 拆分 ✅ 已完成（ADR-117 AMENDMENT 3 / D-117-VSR3-1..8）** 2026-06-02：queries 拆 4 文件（sources-matrix.ts 759→381 解硬限 + 3 新 query 文件全 <500 零新违规 / budget 净改善 -1）+ 派生列单趟聚合 FILTER（QUALITY_RANK_EXPR alias 工厂三处共用 / COALESCE 回退口径 / coverage / percentile_cont 延迟中位 / qualityHighest CASE MAX 反查）+ KPI② per-video 子查询 + 外层 COUNT FILTER（①口径零变更逐值回归 + ②abnormal/needsSource/pendingProbe/lowQuality）+ quickFilters 全 WHERE EXISTS（lowQuality OR 合流单份谓词）+ sortField 扩 activeSources/quality/lastChecked（IDENT 正则零放宽）+ 派生列双层透传 + 7 测试 BLOCKER 方案 A mock 路径迁移。门禁全过 5933 passed（1 flaky=VideoImageSection 隔离重跑通过、与本卡无关）+ 新增 25 单测。详见 changelog + task-queue.md。/ **CHG-DT-RESIZE-ROLLOUT 列宽可调推广 server-next 全表 ✅ 已完成（含 Codex stop-time review FIX）** 2026-06-01：先 merge main→dev 引入 resize 核心 DTR-A..F；server-next **全部 `<DataTable>` 渲染点 17 个（操作型 15 个 = 14 client 文件，ImageHealthClient 含 2 表；+ dev/components demo 2 个）**启用 `enableColumnResizing`（4 已接线仅加开关 / 9 补 in-session columnPrefs 接线 / Merge·SourceLineAliases·ImageHealth·Staging·KeywordCrawl·demo 补列宽规避 flex 回归）。**Codex review FIX**：逐表审计「≥2 无 width 列 / 主列无 minWidth」回归点，修 ImageHealth missing·Staging·KeywordCrawl·demo 共 4 处。门禁全过 5902 passed 零回归。详见 changelog。/ **SEQ-20260531-01 归并键剥标点统一全序列 ✅ 完全收官** 2026-06-01：A✅ B✅ C✅ D✅ **E✅**。META-23-E 全量回归 5832 passed 零回归 + 4 门禁全过 + architecture.md 字段语义收尾；用户重跑 `reenrich-backfill --mode unmatched --type anime`（453 入队）后 **JP anime 命中率 48.7%→56.4%（+7.7pp）** / 全 anime matched 145→166（+21）/ 23 条 dedupConflict 降级 candidate / meta_null=0 / 队列已 drain。详见 task-queue.md + changelog.md。）

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
