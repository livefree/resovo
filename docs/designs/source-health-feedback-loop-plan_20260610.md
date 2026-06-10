# 视频 / 线路 / 站点三层健康度与反馈闭环优化方案

**状态**：调研完成，方案待独立审核（arch-reviewer / Opus）
**日期**：2026-06-10
**触发背景**：用户报告「点击『全部探测』『全部试播』后状态没有及时更新」；同时要求调研探测分层现状、各层关联，并提出完善健康度 + 反馈闭环的方案，目标是减少前台「无法播放 / 频繁切线」现象。
**调研方式**：主循环（claude-fable-5）静态代码走查，未运行服务；所有事实均带 `文件:行号` 证据，审核者可直接复核。

---

## 1. 现状全景：探测分层与证据

系统实际存在 4 个探测层级 + 1 条反馈通道，**层与层之间大多是孤岛**。

| 层级 | 实现位置 | 写入 | 触发 |
|---|---|---|---|
| L0 站点（采集 API） | `apps/api/src/routes/admin/crawlerSites.ts:258-292`（`POST /admin/crawler/sites/validate`，GET `?ac=list&pg=1`，8s 超时） | **不落库**，结果仅 UI 即显 | 手动 |
| L0.5 主机熔断 | `apps/worker/src/lib/circuit-breaker.ts`（按**视频 URL hostname** 聚合；5 次失败/5min 窗口 → 30min 冷却，`config.ts:21-25`） | **纯内存 Map**，worker 重启即失忆 | worker 探测时顺带 |
| L1 源探测 probe | worker：`apps/worker/src/jobs/source-health/level1-probe.ts`（HLS GET+m3u8 解析可产出 `partial`；其他 HEAD；10s 超时）。admin 手动：`apps/api/src/services/SourceProbeService.ts:117-142`（HEAD 3s，**二值 ok/dead**） | `video_sources.probe_status` + `latency_ms` + `source_health_events` | cron `0 */6 * * *` 全量；手动单源 / 视频级 batch（ADR-158） |
| L2 渲染试播 render | worker：`apps/worker/src/jobs/source-health/level2-render.ts`（真解析 m3u8 variants / mp4 moov / mpd，测出分辨率 → `quality_detected`）。admin 手动「试播」：`SourceProbeService.ts:187-221`（**仅 HEAD + Content-Type 正则**，代码注释 I3 自承"仅 reachability 强化版，不是 playability"） | `render_status` + `resolution_*` + `quality_detected` | cron `0 */2 * * *`，每轮 LIMIT 100，**只挑 `probe_status='ok'` 的行**（level2-render.ts:180-198）；手动 |
| L3 视频聚合 | `apps/worker/src/jobs/source-health/aggregate-source-check-status.ts`（all_dead / partial / ok / pending） | `videos.source_check_status` | **仅 worker level1 跑完后**（`jobs/source-health/index.ts:7-12`）；手动探测、feedback、level2 均不触发 |
| 反馈通道 | `apps/api/src/routes/feedback.ts`（`POST /v1/feedback/playback`，202 + fire-and-forget 副作用） | 见 §2.3 | 播放器上报 |

线路级（`site_key + source_name`）补充事实：

- `SourcesMatrixService.testRoute`（:194-241）：同步 HEAD 抽样 **1 集** + 返回**占位 probeJobId**（注释"Y3 advisory 未来对接 source-health worker"）。
- `SourcesMatrixService.reprobeRoute`（:246-275）：**只写 audit + 返回占位 jobId，不做任何探测、不修改 video_sources**（注释"待 E2 后续完善"）。线路级"重新探测"按钮目前是假动作。
- auto-retire（`apps/worker/src/jobs/auto-retire-line.ts`，ADR-164 D-164-8）：线路别名全 source 双轨 dead 持续 180 天 → 自动退役，每日 03:30 UTC，批次上限 50，退役前 SQL 二次确认防误杀。该机制健全，本方案不动它。

---

## 2. 已确认的问题清单

### 2.1 「全部探测/试播后状态没及时更新」根因（P0，用户可见 bug）

线路面板内部回写链路**是通的**：`apps/server-next/src/lib/sources/use-source-lines-controller.ts:297-331` 把 batch 结果 `setLines` → `groupSourcesByLine` 重新派生行/线聚合。真正不更新的是上层视图，三处确凿：

| # | 现象 | 证据 |
|---|---|---|
| B1 | 视频列表「探测/播放」列**永远显示 unknown** | `apps/server-next/src/app/admin/videos/_client/VideoColumns.tsx:362-367`：`cell: () => <DualSignal probe="unknown" render="unknown" />` 硬编码占位，注释"后端字段补齐前排序禁用 / STATS-EXTEND-VIDEOS follow-up" |
| B2 | `videos.source_check_status` 最多滞后 6 小时 | 聚合仅挂在 worker level1 cron 之后（`source-health/index.ts:10-11`）；`SourceProbeService.batchProbe/probeOne` 改完 `video_sources` 后无人触发视频级重聚合 |
| B3 | sources 页外层聚合行不刷新 | 外层行 probe/render 聚合来自服务端 STRING_AGG（`apps/api/src/db/queries/source-routes.ts:57-62`），展开区（`SourceLinesExpand.tsx`）探测完成只更新展开区内部 state，外层不 refetch |

### 2.2 语义与数据质量问题

- **D1 手动「试播」名不副实**：HEAD + Content-Type ≠ 可播放。试播 ok 的源前台仍可能播不了，运营据此误判。
- **D2 手动探测二值化退化**：手动 probe/render-check 只产出 ok/dead，会把 worker 测出的 `partial` 覆盖掉（`SourceProbeService.ts:156,193`）。
- **D3 评分无新鲜度概念**：`route-scoring.ts` 的 health 项不看 `last_probed_at`——6 天前的 ok 和 6 分钟前的 ok 同分。
- **D4 熔断器信号不落库**：hostname 维度故障只存在于单个 worker 进程内存；admin 手动探测不经过熔断器；hostname 与 `site_key` 无映射。熔断 skip 时只写 health event（`new_status='dead'`，level1-probe.ts:21-29），**不改 `video_sources` 主状态**——主状态无污染，但事件流有噪音且信号无人消费。

### 2.3 反馈闭环断点

`POST /v1/feedback/playback`（feedback.ts）现行为：

- `success:true` → `probe_status` dead→ok 复活 + `last_probed_at=NOW()`；带分辨率时写 `quality_detected`（仅当原值 NULL）。
- `success:false` → 写 health event（`origin='feedback_driven'`，`processed_at=NOW()` 仅记录）；redis 计数同 ipHash+sourceId 5 分钟窗口 ≥3 次 → 再写一条 `processed_at=NULL` 的队列信号。
- worker `feedback-driven-recheck.ts`（每分钟）：拉 `processed_at IS NULL` 信号 → 把对应 source `render_status='pending'` → 跑一轮 `runLevel2Render` → 标记事件 processed。

断点：

| # | 断点 | 证据 |
|---|---|---|
| F1 | **前台只报失败不报成功**：`PlayerShell.tsx:299-336` 仅 fatal 切线时 POST `success:false`；`handlePlaySuccess`（:365-369）不上报。系统无法积累真实播放成功率。AdminPlayer 双向上报（`AdminPlayer.tsx:112,124`），口径不一致 | PlayerShell vs AdminPlayer |
| F2 | **recheck 信号与动作脱钩**：recheck 只重置 `render_status`，但 level2 候选 SQL 要求 `probe_status='ok'`——若该源 probe 已 dead 则重置无效，事件却被标 processed（静默丢信号）。且 `runLevel2Render` 是全局取 100 条（按 `last_rendered_at ASC`），不保证本批失败源被重测 | `feedback-driven-recheck.ts:22-28` + `level2-render.ts:188` |
| F3 | **复活门槛不对称**：失败侧要 3 次/5min 才触发 recheck，成功侧 1 次反馈即把 dead 翻 ok（feedback.ts:98-106）。单点误报/异常客户端可复活坏源 | feedback.ts |
| F4 | **反馈不进评分**：feedback 只翻状态/触发 recheck，无成功率累计字段，`effective_score` 完全感知不到真实播放质量 | route-scoring.ts 输入字段 |

### 2.4 排序算法盲点（对应调研问题 4）

前台排序 `effective_score = 0.50×health(probe×0.4+render×0.6) + 0.30×quality(实测>配置>0.4) + 0.15×latency + 0.05×priority`（`apps/api/src/lib/route-scoring.ts`，请求时实时计算，`SourceService.listSources` DESC + created_at ASC 稳定）。框架合理，盲点 = D3（新鲜度）+ F4（反馈）+ latency 为服务器机房视角（与用户端 CDN 体感无关）+ D2（partial 退化）+ 站点/主机层信号缺席（某 CDN 整体宕掉要等 6h cron 逐个标 dead，期间旧分继续把用户导向坏线路）。

### 2.5 调研四问结论（供审核对照）

1. **采集站点健康度 vs 线路连接**：目前零关联。`crawler_sites.last_crawl_status` 是采集 API 维度；线路健康是播放 CDN 维度；两者域名通常不同，数据模型无桥。系统没有混淆两者（正确），但也完全没利用站点/主机级信号（缺失）。
2. **源站 (site_key+source_name) 连接失败 ⇒ 线路视频全失效？** 不必然，系统也未如此假定。同线路 URL 可散布多个 CDN 主机；唯一线路级全失效判定是 auto-retire（全 source 双轨 dead 180 天 + 二次确认）。但 hostname 维度的"连坐"信号（熔断器）确实存在且有价值，只是没被持久化利用。
3. **播放器反馈能否更新探测状态？** 通道已存在且双端接入，但为半闭环（F1–F4）。
4. **线路顺序算法是否完善？** 框架完善，输入信号不完整（§2.4 五盲点）。

---

## 3. 优化方案（三阶段）

设计原则：**用户每一次真实播放都是一次免费且最真实的探测**。反馈为最高权重信号，服务器探测退居验证与兜底；状态变更即时传播到所有读取面。

### Phase 1 — 修可见断点（无 schema 变更，低风险）

| 项 | 内容 | 涉及文件 | 对应问题 |
|---|---|---|---|
| P1-1 | videos 列表 SQL 补 probe/render 聚合字段（复用 `source_check_status` + 新增 render 聚合表达式），`VideoColumns` 探测列接真数据、恢复排序 | `apps/api/src/db/queries/videos.*`、`routes/admin/videos.ts`、`VideoColumns.tsx` | B1 |
| P1-2 | 把 `computeCheckStatus` 提为共享纯函数（建议 `apps/api/src/lib/` 或随 P3-2 入 worker 可复用位置）；`SourceProbeService` 单源/batch 完成后**同步重算**该视频 `source_check_status` | `SourceProbeService.ts`、`aggregate-source-check-status.ts`（抽取） | B2（用户 bug 直接解药） |
| P1-3 | 手动「试播」升级为 worker level2 同款 manifest 解析：把 m3u8/moov/mpd 解析提为共享 lib（注意 ADR-107 §4 worker 禁止 import apps/api——方向应为 api 侧新建或提至共享包，worker 保持自有副本或同源生成），结果支持 `partial` | `SourceProbeService.ts`、`apps/worker/src/lib/parsers.ts`（同步策略见 §5 开放问题 Q2） | D1、D2 |
| P1-4 | sources 页探测完成后联动外层聚合行 refetch（`onSourceHealthChanged` 范式已有，CHG-358） | `SourceLinesExpand.tsx`、`SourcesClient` | B3 |
| P1-5 | recheck 定向化：feedback recheck 先对目标 source 跑 level1（probe），`runLevel2Render` 增加可选 `sourceIds` 参数定向重测；消费多少标记多少 | `feedback-driven-recheck.ts`、`level2-render.ts` | F2 |

### Phase 2 — 反馈闭环（1 个 migration）

| 项 | 内容 | 涉及文件 | 对应问题 |
|---|---|---|---|
| P2-1 | 前台补 success 上报：首播成功（`handlePlaySuccess`）即报，per-sourceId 去抖 + 可采样（1/N 配置化）；复用既有 rate-limit | `PlayerShell.tsx` | F1 |
| P2-2 | Migration：`video_sources` 增 `fb_success_count INT`、`fb_fail_count INT`、`last_feedback_at TIMESTAMPTZ`（滚动窗口语义由消费侧定义，写入侧只累计 + 定期衰减见 Q3）；feedback 写入累计 | migration + `feedback.ts` | F4 前置 |
| P2-3 | 复活门槛对称化：dead→ok 复活要求窗口内 ≥2 个独立 ipHash 成功（redis 计数，与失败侧同模式） | `feedback.ts` | F3 |
| P2-4 | 实装 `reprobeRoute`：占位 jobId 改为真实信号——按 (siteKey, sourceName) 批量写 `source_health_events` pending 队列行（复用 `processed_at IS NULL` 消费范式），worker 定向消费（接 P1-5 的定向参数） | `SourcesMatrixService.ts`、worker | §1 线路级假按钮 |

### Phase 3 — 评分进化 + 站点/主机桥接（设计审核重点）

| 项 | 内容 | 对应问题 |
|---|---|---|
| P3-1 | **新鲜度衰减**：health 项按 `last_probed_at` 距今时长向中性值（0.345）指数回归；旧 ok 不再永久满分，同时自然驱动重探优先级（level1 已按 `last_probed_at ASC` 排队，互补） | D3 |
| P3-2 | **反馈项进分**：`effective_score` 增第五因子。初始建议权重 health 0.40 / feedback 0.20 / quality 0.25 / latency 0.10 / priority 0.05；feedback 项 = 平滑成功率（Laplace：(succ+1)/(succ+fail+2)），样本 <3 取中性 0.5 | F4 |
| P3-3 | **`host_health` 落库表**（hostname 维度 + hostname↔site_key 映射列）：熔断器读写从 worker 内存升级为 DB（或 redis）共享；某主机熔断时对该主机全部线路做**软降权**（排序后置，不标 dead），恢复探测通过后自动回升。影响半径从"6 小时逐个发现"压缩到"分钟级整体降权" | D4、§2.4 站点层盲点 |
| P3-4 | 播放端按分切线：`listSources` 响应已含 `effectiveScore`（CHG-352 R1），前台 fatal 切线从数组序环形扫描改为按分数优先 | 体验收口 |

### 不做什么（范围外）

- 不动 auto-retire 机制（健全，有二次确认）。
- 不做用户端 latency 上报 / 地域感知评分（涉及 PII 与采样设计，独立议题）。
- 不引入新依赖（熔断落库用 PG/既有 redis）。
- L0 站点采集 API 健康（`crawler/sites/validate`）维持现状——它与播放健康正交，桥接价值在 hostname 层（P3-3）而非采集 API 层。

---

## 4. 阶段门禁与回归点

- 每阶段独立任务卡（范围 >5 项必拆 -A/-B 子卡；P2-2 migration 跨 3+ 消费方字段设计须先 spawn Opus 子代理，CLAUDE.md 模型路由强制项）。
- P3-2 改 `route-scoring.ts` 权重 = 改前台线路顺序关键路径：必须补純函数单测校准表（对照现有 `max=1.00 / min=0.020 / 中性=0.345` 风格重算）+ PLAYER 域 e2e 回归（断点续播、线路切换不回归）。
- `verify:adr-contracts` / `verify:endpoint-adr`：P2-4 若新增 admin route 需先起 ADR；feedback 端点扩展沿用 ADR-110 信封。

---

## 5. 留给审核者的开放问题

| # | 问题 | 倾向 |
|---|---|---|
| Q1 | P1-2 同步聚合放 Service 内（每次 batch 后 1 条 UPDATE）还是复用 worker advisory-lock 路径？ | Service 内直算（手动操作低频，锁竞争可忽略；worker 侧保留现有路径不动） |
| Q2 | P1-3 解析器共享策略：ADR-107 禁 worker import apps/api，反向（api import worker）同样不可。提共享包（如 `packages/` 新增）违反"不引入技术栈以外依赖"吗？ | 不违反（workspace 内部包非外部依赖），但包边界值得 Opus 裁决：单独 `packages/media-probe` vs 双侧 byte-identical 副本（auto-retire SQL 已有双侧同步先例） |
| Q3 | P2-2 成功率计数的时间衰减：定期 cron 半衰（×0.5/周）vs 滚动窗口表？ | cron 半衰（单表无新增行，实现最薄） |
| Q4 | P3-3 host_health 用 PG 表还是 redis hash？ | PG 表（需进评分查询 JOIN；redis 仅作熔断热路径缓存可选） |
| Q5 | P3-2 权重调整幅度是否需要灰度（如 feature flag 双算法对照）？ | 建议 system_settings 开关 + 影子计算日志一周后切换 |

---

## 6. 调研文件清单（复核入口）

```
apps/worker/src/jobs/source-health/{index,level1-probe,level2-render,aggregate-source-check-status}.ts
apps/worker/src/jobs/{feedback-driven-recheck,auto-retire-line}.ts
apps/worker/src/{config.ts,lib/circuit-breaker.ts}
apps/api/src/services/{SourceProbeService,SourcesMatrixService,SourceService}.ts
apps/api/src/lib/route-scoring.ts
apps/api/src/routes/{feedback.ts,admin/crawlerSites.ts,admin/sources-matrix.ts}
apps/api/src/db/queries/{video_sources,sources,source-routes}.ts
apps/server-next/src/lib/sources/{use-source-lines-controller,api}.ts
apps/server-next/src/app/admin/videos/_client/VideoColumns.tsx
apps/server-next/src/app/admin/moderation/_client/{LinesPanel,AdminPlayer}.tsx
apps/server-next/src/app/admin/sources/_client/SourceLinesExpand.tsx
apps/web-next/src/components/player/PlayerShell.tsx
packages/admin-ui/src/components/composite/lines-panel/{lines-panel,aggregate}.tsx|ts
```
