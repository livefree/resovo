# 视频 / 线路 / 站点三层健康度与反馈闭环优化方案

**状态**：v2 修订版（2026-06-10）——两轮独立审核（§7 / §8）均「有条件通过」，全部必修意见已吸收进 §3–§5（变更对照见 §9）；可按 §4 门禁拆卡执行
**日期**：2026-06-10（v1 调研稿 + 同日 v2 审核修订）
**触发背景**：用户报告「点击『全部探测』『全部试播』后状态没有及时更新」；同时要求调研探测分层现状、各层关联，并提出完善健康度 + 反馈闭环的方案，目标是减少前台「无法播放 / 频繁切线」现象。
**调研方式**：主循环（claude-fable-5）静态代码走查，未运行服务；所有事实均带 `文件:行号` 证据，审核者可直接复核（§8.1 已逐条核验 10/10 命中）。

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

**交付顺序（§8 C6 裁定）**：P1-4(B3) → P1-2(B2) 首交付——`probeAllSources` 的 `setLines` 已让展开区内部即时更新，用户报告的「不更新」最可能对应 B2/B3 而非默认隐藏的 B1 列；P1-1 随后。

| 项 | 内容 | 涉及文件 | 对应问题 |
|---|---|---|---|
| P1-1 | videos 列表 SQL 补 probe/render 聚合字段（复用 `source_check_status` + 新增 render 聚合表达式），`VideoColumns` 探测列接真数据、恢复排序。**单项横跨 SQL+route+UI 三层，按 CLAUDE.md 原子化判据强制拆 -A（API/SQL）/-B（UI）子卡**（§8 C6） | `apps/api/src/db/queries/videos.*`、`routes/admin/videos.ts`、`VideoColumns.tsx` | B1 |
| P1-2 | 把 `computeCheckStatus` 提为共享纯函数（建议 `apps/api/src/lib/` 或随 P3-2 入 worker 可复用位置）；`SourceProbeService` 单源/batch 完成后**同步重算**该视频 `source_check_status` | `SourceProbeService.ts`、`aggregate-source-check-status.ts`（抽取） | B2（用户 bug 直接解药） |
| P1-4 | sources 页探测完成后联动外层聚合行 refetch（`onSourceHealthChanged` 范式已有，CHG-358） | `SourceLinesExpand.tsx`、`SourcesClient` | B3 |
| P1-5 | recheck 定向化：feedback recheck 先对目标 source 跑 level1（probe），`runLevel2Render` 增加可选 `sourceIds` 参数定向重测；消费多少标记多少 | `feedback-driven-recheck.ts`、`level2-render.ts` | F2 |

#### P1-3（从 Phase 1 移出 → 独立卡，§7.1-4 裁定）

手动「试播」升级为 worker level2 同款 manifest 解析（m3u8/moov/mpd），结果支持 `partial`，消除 D1/D2。**不与 P1 其余项混做**：涉及跨 API / worker 共享解析器，触碰 ADR-107 §4 边界（worker 禁止 import apps/api，反向同样不可）。共享策略已按 Q2 改判收敛为**新建 `packages/media-probe`**（workspace 内部包非外部依赖；双侧 byte-identical 副本的漂移风险违背价值排序 #2）。执行前置：spawn Opus 子代理裁决包的导出面（解析器纯函数 + 类型契约），落地须独立验收 typecheck / lint / worker 测试 / API service 测试与双端替换回归。涉及：`SourceProbeService.ts`、`apps/worker/src/lib/parsers.ts` → `packages/media-probe`。

### Phase 2 — 反馈闭环（2 个 migration：P2-2 字段 + P2-4 partial index）

| 项 | 内容 | 涉及文件 | 对应问题 |
|---|---|---|---|
| P2-1 | 前台补 success 上报：首播成功（`handlePlaySuccess`）即报，per-sourceId 去抖 + 可采样（1/N 配置化）；复用既有 rate-limit | `PlayerShell.tsx` | F1 |
| P2-2 | Migration（§7.1-2 + Q3 改判重设计）：`video_sources` 增 **EMA 衰减字段** `fb_score NUMERIC`（0–1 平滑成功率）、`fb_sample_weight NUMERIC`（有效样本权重）、`last_feedback_at TIMESTAMPTZ`。写入侧即时衰减：每次反馈先按距 `last_feedback_at` 时长对 `fb_score`/`fb_sample_weight` 施半衰（半衰期常量配置化），再并入本次观测——无 cron、无全表 UPDATE、近期质量主导。**统计语义落地并经影子验证（Q5）前，feedback 只触发 recheck，不进评分**。跨 3+ 消费方字段设计，执行前置 Opus 子代理 | migration + `feedback.ts` | F4 前置 |
| P2-3 | 复活门槛对称化（§8 C3 修正 redis 原语）：dead→ok 复活要求窗口内 **≥2 个独立 ipHash** 成功——用 **SET 语义**（`SADD` + `SCARD` + TTL）统计独立客户端，**不得照搬失败侧 `INCR`**（那是同一 ipHash 计次，照搬会实现成"同一客户端成功 2 次即复活"）。同卡顺带：失败→recheck 触发（现 `INCR` 3 次/5min，`feedback.ts:56-62`）也迁移为独立 ipHash SET 计数，统一"信任需独立佐证"原则 | `feedback.ts` | F3 |
| P2-4 | 实装 `reprobeRoute`（§7.1-3 收敛队列语义）：占位 jobId 改为真实信号——按 (siteKey, sourceName) 批量写 `source_health_events` 队列行，**新增 `origin='manual_route_reprobe'`**（不复用 `feedback_driven`，避免混淆真实用户反馈与运营操作）。配套四件：① 新增 partial index `WHERE processed_at IS NULL AND origin='manual_route_reprobe'`；② worker 拉取条件扩展为消费两种 origin（或拆独立定向 job，接 P1-5 的 `sourceIds` 参数）；③ processed 标记语义同现行（消费即 `processed_at=NOW()`，消费多少标多少）；④ audit 口径沿用 `sources.route_action`（afterJsonb 记真实 jobId + queuedCount） | `SourcesMatrixService.ts`、worker、migration（index） | §1 线路级假按钮 |

### Phase 3 — 评分进化 + 站点/主机桥接（设计审核重点）

| 项 | 内容 | 对应问题 |
|---|---|---|
| P3-1 | **新鲜度衰减（双时钟，§8.3）**：health 的 probe 子项按 `last_probed_at`、render 子项按 `last_rendered_at` **分别**向中性值（0.345）指数回归——render 在 health 内权重 0.6，共用单时钟会低估高权重子项的陈旧度。旧 ok 不再永久满分，同时自然驱动重探优先级（level1 已按 `last_probed_at ASC` 排队，互补）。配套纯函数单测校准表（§4） | D3 |
| P3-2 | **反馈项进分（§8 C4 动态权重）**：`effective_score` 增第五因子，feedback 项 = EMA 平滑成功率 `fb_score`（P2-2）。权重**按样本置信度动态缩放**：`w_fb = 0.20 × min(1, fb_sample_weight / N)`，未用部分回补 health——静态 0.20 在 F1 上报冷启动期（样本≈0 全取中性 0.5）会压缩分数区间、稀释 health/quality/latency 区分力，且此劣化是 ramp 窗口真实回归，灰度开关救不了。前置依赖：P2-2 落地 + 影子计算一周（Q5） | F4 |
| P3-3 | **`host_health` 落库 + join key 补齐（§7.1-1）**：前置 migration 新增 `video_sources.source_hostname`（写路径维护：插入/换源时由 URL 解析写入；存量回填脚本；建索引；解析失败 NULL 容忍），杜绝评分查询 SQL 临时解析 URL 或 Service 逐行解析。`host_health` 表以 **hostname 为主键/唯一键**；hostname↔site_key 为多对多，`site_key` 仅作派生维度（关联经 video_sources 反查，不在 host_health 放单列 site_key）。存储双分工（Q4 改判）：redis/内存扛熔断热路径判定，PG 表存供评分 JOIN 的持久状态。某主机熔断时对该主机全部线路**软降权**（排序后置，不标 dead），恢复探测通过后自动回升。影响半径从"6 小时逐个发现"压缩到"分钟级整体降权" | D4、§2.4 站点层盲点 |
| P3-4 | 播放端按分切线：`listSources` 响应已含 `effectiveScore`（CHG-352 R1），前台 fatal 切线从数组序环形扫描改为按分数优先 | 体验收口 |

### 不做什么（范围外）

- 不动 auto-retire 机制（健全，有二次确认）。
- 不做用户端 latency 上报 / 地域感知评分（涉及 PII 与采样设计，独立议题）。
- 不引入新依赖（熔断落库用 PG/既有 redis）。
- L0 站点采集 API 健康（`crawler/sites/validate`）维持现状——它与播放健康正交，桥接价值在 hostname 层（P3-3）而非采集 API 层。

---

## 4. 阶段门禁与回归点

- 任务卡原子化（两条规则都触发，§8 C6）：范围 >5 项必拆 -A/-B 子卡；**P1-1 单项跨 SQL+route+UI 三层独立触发拆卡**。Phase 1 首交付顺序 P1-4 → P1-2（见 §3）。
- 强制 Opus 子代理节点（CLAUDE.md 模型路由）：P1-3 共享包 `packages/media-probe` 导出面裁决；P2-2 EMA 字段（跨 3+ 消费方 migration）设计。
- P3-2 改 `route-scoring.ts` 权重 = 改前台线路顺序关键路径：必须补纯函数单测校准表（对照现有 `max=1.00 / min=0.020 / 中性=0.345` 风格重算，P3-1 双时钟衰减同要求）+ PLAYER 域 e2e 回归（断点续播、线路切换不回归）+ 影子计算一周后切换（Q5）。
- `verify:adr-contracts` / `verify:endpoint-adr`：P2-4 若新增 admin route 需先起 ADR；feedback 端点扩展沿用 ADR-110 信封；`manual_route_reprobe` origin 入 types union（`SourceHealthEventOriginWorker` 同位扩展）。
- 时序硬依赖链：P2-2（统计字段）→ 影子验证 → P3-2（进分）；P3-3 内部 `source_hostname` migration 先于 host_health 表。

---

## 5. 开放问题（v2 已全部收敛）

| # | 问题 | v1 倾向 | **v2 裁决（§7/§8 综合）** |
|---|---|---|---|
| Q1 | P1-2 同步聚合放 Service 内还是复用 worker advisory-lock 路径？ | Service 内直算 | **维持**：Service 内直算（手动操作低频，锁竞争可忽略；worker 侧现有路径不动；两轮审核均未驳回） |
| Q2 | P1-3 解析器共享策略：共享包 vs 双侧 byte-identical 副本？ | 包边界留 Opus 裁决 | **改判（§8.4）**：新建 `packages/media-probe`——workspace 内部包非外部依赖，价值排序 #2（边界与复用）优于双副本漂移；导出面细节仍由执行卡前置 Opus 裁决 |
| Q3 | P2-2 成功率计数的时间衰减机制？ | cron 半衰（实现最薄） | **改判（§8.4）**：单个时间衰减浮点 **EMA**（写入即时衰减，无 cron、无全表 UPDATE）——v1 倾向以"实现最薄"为据倒置价值排序，改动收敛 #5 不应凌驾正确性 #1 |
| Q4 | P3-3 host_health 用 PG 还是 redis？ | PG 表 | **改判（§8.4）**：**双存储分工**——redis/内存扛熔断热路径判定，PG 仅存供评分 JOIN 的持久状态；非二选一 |
| Q5 | P3-2 权重调整是否需要灰度？ | system_settings 开关 + 影子计算 | **维持并强化**：影子计算一周为 P3-2 硬前置（§7.2）；另注意 C4 指出冷启动劣化是真实回归，动态权重（非灰度开关）才是根本解 |

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

---

## 7. 独立审核结论（2026-06-10）

**结论**：方案方向成立，但当前版本为“有条件通过”。建议先修订以下 4 个点，再拆任务卡执行；不宜直接按当前 Phase 表开工。主要风险不在事实调研，而在数据模型、反馈统计语义和任务边界尚未收敛。

### 7.1 必须修订的问题

1. **P3-3 `host_health` 缺少可索引 join key**
   - 当前 `video_sources` 只有 `source_url`，没有 `source_hostname` 字段或索引；若评分查询需要 JOIN `host_health`，实现时容易退化为 SQL 临时解析 URL，或只能在 Service 层逐行解析，影响性能与一致性。
   - 修订建议：P3-3 明确新增 `video_sources.source_hostname`，包含存量回填、URL 写路径维护、索引与空值处理；`host_health` 以 hostname 为主键/唯一键。`site_key` 只能做派生维度，不能用单列表示 hostname 与 site_key 的多对多关系。

2. **P2-2 / P3-2 feedback 计数模型不足以直接进评分**
   - 当前方案只加累计 `fb_success_count` / `fb_fail_count` / `last_feedback_at`，随后将平滑成功率纳入 `effective_score`。这会把长期历史当成近期质量，也可能被单一客户端长期累积影响排序。
   - 修订建议：先定义滚动窗口或衰减字段，再允许进评分。可选方案包括 `last_feedback_decay_at` + 半衰任务、按天/小时 bucket 表、或独立近期聚合表。统计语义落地前，feedback 应只触发 recheck，不直接参与排序。

3. **P2-4 复用 `source_health_events` 队列语义不清**
   - 现有 worker 只消费 `origin='feedback_driven' AND processed_at IS NULL`，索引也只覆盖该 origin。若线路级手动重探继续写 `feedback_driven`，会混淆真实用户反馈与运营操作；若新增 origin，当前 worker 不会消费。
   - 修订建议：明确新增 `manual_route_reprobe` origin、partial index、worker 查询条件、processed 标记语义和 audit 口径；或独立建 recheck job 表，避免把事件表继续扩成多语义队列表。

4. **P1-3 不应混在“无 schema 变更，低风险”的 Phase 1 内**
   - 手动试播升级为 worker level2 同款解析，需要跨 API / worker 共享解析器。既有 ADR-107 约束 worker 不 import apps/api；反向 import worker 同样破坏边界。若抽 `packages/media-probe`，会涉及 workspace 包、导出、测试与双端替换，风险明显高于 P1 其他状态刷新修复。
   - 修订建议：将 P1-3 单独拆卡，先裁决 `packages/media-probe` vs 双侧 byte-identical 副本。若抽共享包，必须独立验收 typecheck / lint / worker 测试 / API service 测试，不与 P1-1/P1-2/P1-4/P1-5 混做。

### 7.2 可先推进范围

- P1-1、P1-2、P1-4、P1-5 方向正确，且直接对应用户可见的“探测/试播后状态不刷新”问题。建议先作为第一批修复卡推进。
- P2-3 复活门槛对称化合理，但应依赖独立客户端计数语义明确后实施。
- P3-1 新鲜度衰减方向合理，但需要配套测试校准表，避免线路排序产生不可解释的大幅波动。
- P3-2 feedback 进分应延后到 feedback 统计模型和灰度/影子计算机制明确之后。

---

## 8. 第二轮独立审核（Opus 主循环，2026-06-10）

**审核者**：本会话 Opus 主循环（`claude-opus-4-8`），即文档头请求的「独立审核（arch-reviewer / Opus）」。
**与 §7 关系**：独立完成，结论一致（**有条件通过**）。§7 的 4 条必修（P3-3 join key、P2-2 计数模型、P2-4 队列语义、P1-3 拆卡）我**全部确认成立、不重述**；本节只记录 §7 未覆盖的增量：逐条证据核验、3 处新增必修（C3/C4/C6）、2 处次要补全，以及开放问题倾向改判。

### 8.1 证据核验（10/10 命中，零误差）

逐条静态复核文档关键 `文件:行号`，全部精确属实：评分公式（`route-scoring.ts:45-50,68-70`，确认无 `last_probed_at` 输入 → D3 成立）、聚合仅挂 level1 cron 后（`source-health/index.ts:7-12`）、level2 候选要求 `probe_status='ok'`（`level2-render.ts:188`，F2 静默丢信号根因）、B1 硬编码 `probe="unknown"`（`VideoColumns.tsx:367`）、feedback 成功 1 次翻 dead→ok / 失败 3 次入队（`feedback.ts:98-106,134-145`）、recheck 只重置 render_status + 全局 runLevel2Render + 全标 processed（`feedback-driven-recheck.ts:22-34`）、F1 `handlePlaySuccess` 不上报（`PlayerShell.tsx:365-369`）、reprobeRoute 假按钮（`SourcesMatrixService.ts:259-272`）、熔断器纯内存 Map + hostname 聚合（`circuit-breaker.ts:9` + `level1-probe.ts:166-168`）、D4 熔断 skip 只写 event 不改主状态（`level1-probe.ts:19-31` 无 `updateSourceProbe`）、B3 外层 STRING_AGG 不随 setLines 刷新（`source-routes.ts:57-58` + `use-source-lines-controller.ts:303-306`）。诊断可作为后续 ADR 事实基底直接采纳。

### 8.2 §7 未覆盖的新增必修

| # | 等级 | 问题 | 要求 |
|---|---|---|---|
| C3 | 🟠 | **P2-3「与失败侧同模式」用错 redis 原语**。失败侧是 `INCR`（`feedback.ts:56-62`，统计同一 ipHash 次数），但 P2-3 目标是「≥2 个**独立 ipHash**」，照搬 INCR 会实现成「同一客户端成功 2 次即复活」，没解决 F3 | 复活计数改用 SET 语义（`SADD`+`SCARD`+TTL）统计独立 ipHash；若「信任需独立佐证」原则成立，失败→recheck 路径也应一并迁移（当前单客户端重复失败 3 次即可强制 recheck）|
| C4 | 🟠 | **P3-2 静态 0.20 反馈权重在冷启动期劣化排序**。F1 成功上报全新，部署初期样本≈0 → Laplace 取中性 0.5，把 0.20 压在对所有源恒为 0.5 的因子上会压缩分数区间、稀释 health/quality/latency 区分力。此为 ramp 窗口真实回归，比灰度开关更根本（与 §7.2「延后进分」互补：即便延后，进分时也须解决静态权重稀释）| 反馈权重按样本置信度动态缩放（如 `w_fb = 0.20 × min(1, n/N)`，未用部分回补 health），非静态 0.20 |
| C6 | 🟡 | **任务卡原子化**。P1-1 单项横跨 SQL+route+UI **三层**，独立触发 CLAUDE.md「跨 3 层须拆」；叠加 Phase 1 共 5 项 → 两条规则都要求拆 -A/-B 子卡。文档 §4 只提「>5 项必拆」，漏了 P1-1 跨层触发 | 拆 P1-1 子卡；落地前确认复现面，把 **P1-4(B3)/P1-2(B2) 排为首交付**（`probeAllSources` 的 `setLines` 已让展开区内部即时更新，用户「不更新」最可能是 B2/B3，而非默认隐藏的 B1 列）|

### 8.3 次要补全（不阻塞，记入对应卡）

- **P3-1 衰减时钟**：render 子项（health 内权重 0.6）有独立 `last_rendered_at`，应与 probe 的 `last_probed_at` 分别衰减，否则高权重子项陈旧度被低估。
- **审计字段**：文档头「主循环 claude-fable-5」不在 CLAUDE.md §模型路由合法 ID 表内，ADR 化时校正为真实 ID。

### 8.4 开放问题倾向改判

综合两轮审核：**Q2→共享包 `packages/media-probe`**（workspace 内部包非外部依赖，价值排序 #2 优于双副本漂移）、**Q3→单个时间衰减浮点 EMA**（写入即时衰减，无 cron、无全表 UPDATE；Q3 原「实现最薄」倒置了价值排序，改动收敛 #5 不应凌驾正确性 #1）、**Q4→双存储分工**（redis/内存扛熔断热判定，PG 仅存供评分 JOIN 的持久 host_health，非二选一）。

---

## 9. 修订记录：v1 → v2（2026-06-10）

§7/§8 审核章节为审核者原文，一字未动；以下为方案正文（§3–§5 及文档头）按审核意见的修订对照。两轮审核全部必修项均已吸收，无保留异议。

| 审核条目 | 修订落点 |
|---|---|
| §7.1-1 host_health 缺 join key | P3-3 重写：前置 `video_sources.source_hostname` migration（写路径维护 + 存量回填 + 索引 + NULL 容忍）；host_health 以 hostname 为 PK；site_key 降为派生维度（多对多经 video_sources 反查） |
| §7.1-2 feedback 计数模型不足以进评分 | P2-2 重写：裸累计 count 字段 → EMA 衰减字段（`fb_score` + `fb_sample_weight` + `last_feedback_at`，写入即时衰减）；明确"统计语义落地 + 影子验证前，feedback 只触发 recheck 不进评分"；§4 增补时序硬依赖链 P2-2 → 影子 → P3-2 |
| §7.1-3 P2-4 队列语义不清 | P2-4 重写：新增 `origin='manual_route_reprobe'`（不复用 `feedback_driven`）+ partial index + worker 消费条件扩展 + processed 标记语义 + audit 口径四件套；§4 补 origin 入 types union |
| §7.1-4 P1-3 不属低风险 Phase 1 | P1-3 移出 Phase 1 表，独立成节（独立卡 + 前置 Opus 包边界裁决 + 独立验收清单）；Phase 1 标题"无 schema 变更，低风险"在移出后恢复成立 |
| §8 C3 复活计数 redis 原语 | P2-3 重写：`SADD`+`SCARD`+TTL 统计独立 ipHash，显式禁止照搬失败侧 `INCR`；失败→recheck 触发同卡迁移为独立 ipHash 计数 |
| §8 C4 静态反馈权重冷启动劣化 | P3-2 重写：`w_fb = 0.20 × min(1, fb_sample_weight / N)` 动态缩放，未用部分回补 health；Q5 裁决注记"动态权重是根本解，灰度开关不是" |
| §8 C6 任务卡原子化 | P1-1 行内标注强制拆 -A/-B；Phase 1 增"交付顺序 P1-4 → P1-2 首交付"；§4 第一条改写补"跨 3 层独立触发拆卡" |
| §8.3 P3-1 衰减时钟 | P3-1 改为双时钟：probe 按 `last_probed_at`、render 按 `last_rendered_at` 分别衰减 |
| §8.3 审计字段 | 说明：`claude-fable-5` 为本会话运行环境提供的真实模型 ID（Fable 5）；CLAUDE.md §模型路由映射表（`docs/model_routing_patch_20260418.md`）尚未收录 Fable 系列，属路由表滞后而非 ID 失实。拆卡执行时各卡按当时实际执行模型完整记录，ADR 化时沿用真实 ID 并在卡内注明本说明 |
| §8.4 开放问题改判 | §5 改为"已收敛"对照表：Q2→`packages/media-probe`、Q3→EMA、Q4→双存储分工；Q1/Q5 维持（Q5 强化为硬前置） |

**v2 后续动作**：按 §4 门禁拆卡入队 `task-queue.md`，第一批 = P1-4(B3) + P1-2(B2)（用户可见 bug 直接解药，无 schema 变更）。
