# 图片健康「问题图片」可视化治理板 — 设计方案

> 文档用途：把 `/admin/image-health` 健康概览右侧「破损样本区」升级为**全宽「问题图片」可视化批量治理板**，供运营**看图人工分诊**失效图片并进治理抽屉处置。
> 撰写日期：2026-06-20 ｜ 代码基线：`fix/imgh-broken-samples-empty-20260620`（含 IMGH-P3-1A/1B + P3-2）
> 性质：设计方案（非可执行代码）。端点契约见 **ADR-211**（supersede ADR-210）；实现按 §9 拆 -A/-B 卡。
> 关联：`docs/designs/image-health-ux-handoff_20260618.md`（母方案）/ ADR-046/135/208/209/210/211。

---

## 0. 一句话

数据信号双向不可靠（`poster_status` 漏报、`broken_image_events` 过报），机器判不准 → **用真实缩略图 + 人眼批量分诊**，点击进治理抽屉处置；前台 `SafeImage→FallbackCover` 安全网保证用户端永不裂图。

---

## 1. 背景：为什么要可视化分诊

§3 实地核查（连真库 `resovo_dev`）确认：**没有任何现成字段能精确算出「当前坏了几个」。**

- 已发布 47 个视频：`poster_status` = ok 22 / low_quality 23 / pending_review 2 / **broken 0 / missing 0**；前台实测仅 1 个（`d4lidZ0t`）真打不开。
- `d4lidZ0t`：status=`pending_review`（**漏报**），却有 13 条全未解决 poster 事件（含今天）。
- `broken_image_events` 未解决事件 46/47（**过报**，豆瓣 CDN 偶发 timeout 堆积、从不 resolve）。
- ADR-210 D-210-6 已查明事件类型噪声：`timeout`（2080 视频，worker HEAD 300ms 超时误报，浏览器能加载）+ `dimension_too_small/aspect_mismatch`（图能加载，属 low_quality），均**非真破损**。

结论：机器口径都不可信。**最务实办法 = 把候选问题图以真实 URL 缩略呈现，人眼一扫即可辨真假**（真坏显示失败态，误报正常渲染），再点击进抽屉治理。

---

## 2. 系统现有「失败图片处理」机制盘点（§7 用户问题的答案）

| | 机制 | 现状 | 文件 |
|---|---|---|---|
| **A 前台展示兜底** ✅ | `SafeImage`：`src` 空或 `onError` → `FallbackCover`（渐变+类型图标+标题，按 seed 确定性，零硬编码色） | **前台封面失败=占位图，不裂图**（目标#3 前台已实现，前提：所有封面入口都走 SafeImage） | `apps/web-next/src/components/media/SafeImage.tsx` |
| **B 失败上报** ⚠️ | `onLoadFail`→`reportBrokenImage`→`sendBeacon /internal/image-broken`→`broken_image_events` | 去重仅页面会话级（`Set`），**刷新即重报** → 事件越堆越多（噪声根因） | `apps/web-next/src/lib/report-broken-image.ts` |
| **C 后台巡检标记** ⚠️ | `imageHealthWorker` HEAD：URL 非法→broken；连续 3 次失败→broken；尺寸/比例→low_quality；通过→ok | 连续失败计数=**进程内存 Map**，重启清零 → 几乎到不了「连续 3 次」→ 真破损常停 `pending_review`（漏报根因） | `apps/api/src/workers/imageHealthWorker.ts:104-165` |
| **D 治理动作** ✅ | 重扫 / 切 fallback 域 / 单图替换 / 候选补图 / 标记已解决 | 全人工触发 | image-health.ts 各端点 |
| **E 自动替换/自愈** ❌ | — | grep 零命中，**完全不存在**（母方案 §8 规划未实装） | — |
| **缺口** ❌ | admin-ui `Thumb` 的 `hasSrc` 分支**无 `onError`** | 后台缩略 URL 失败 → 浏览器**原生裂图** | `packages/admin-ui/src/components/cell/thumb.tsx:105` |

### 2.1 关键架构点：不裂图靠安全网，不靠数据准确

**「保证有图可显示 + 不裂图」必须由前台安全网（`SafeImage→FallbackCover`）保证，与数据准确性解耦**——只要加载失败就兜底，用户端零裂图。

- **不裂图** = 安全网职责（前台已基本就绪，待核查覆盖面，见 §8 验证项）。
- **治理失效图（拿回真图）** = 问题板 + 抽屉职责（人工闭环）。
- 二者分工，不靠「把数据修准」消灭裂图。

---

## 3. 治理闭环

```
看图分诊(板)        →   进抽屉(drawer)        →   二选一处置                  →  安全网兜底
缩略=真实URL onError     点击卡片                 ·替换URL(候选/手填/切域)         前台 SafeImage
人眼辨真假               定位到该 kind            → status=pending_review→重探     →FallbackCover
                                                 ·确认无可用图 → 标 missing       (没治理完用户端
清噪声: 对"有事件但能显示"的 → 标记已解决(resolve-event) 清陈旧事件                  也不裂图)
```

---

## 4. 信息架构与布局（全宽；TOP 破损域名下移）

概览 Tab A 自上而下：**① KPI 3 卡 → ② 问题图片板（全宽，本方案新增）→ ③ TOP 破损域名（下移到板下方）**。

```
┌─ 问题图片 · 看图定夺（数据信号不可靠，以实际渲染为准）──────────────────────────────┐
│ 类型: 〔封面 25〕 背景 41  台标 35  Banner 47      范围: 〔仅已发布〕 全部              │  ← Segment×2
├──────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                               │
│  │[img] │ │[img] │ │✗加载 │ │[img] │ │[img] │ │[img] │  ← 缩略=真实URL；onError→失败态 │
│  │      │ │      │ │ 失败 │ │      │ │      │ │      │     （口径已 url 非空，无「无图」）│
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                               │
│  《沙丘》 《奥本…》《进击…》《三体》 《流浪…》《灌篮…》  ← 影片标题（取代原「域名」）     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                  〔加载更多〕   已显示 24 / 共 25 条                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **类型 Tab**（`Segment`）：封面 / 背景 / 台标 / Banner（4 单值类型；stills 多图本期不做，§8）。tab 挂问题计数 badge。
- **范围开关**（`Segment`）：仅已发布 / 全部，**默认仅已发布**（优先级最高、量小）。
- **网格**：响应式 `auto-fill`，缩略按类型比例（封面 2:3 / 背景·Banner 16:9 / 台标透明）。
- **加载更多**（底部按钮）：服务端 `offset/limit`，前端累积追加（非分页器）。

---

## 5.「问题图片」判定口径（广撒网，但避开已证伪噪声）

某类图片进入板的条件（按 `kind` 独立；用户裁定「广撒网」+ ADR-210 D-210-6 噪声收敛 + arch-reviewer HIGH-1「有图才谈失效」守卫）：

```
<kind>_url IS NOT NULL                                                  -- ⓪ 前置守卫：有图才谈失效（排除从未配置空位）
AND (
  <kind>_status <> 'ok'                                                 -- ① 有 URL 但未确认正常（broken/low_quality/pending_review，广）
  OR EXISTS 未解决事件 WHERE image_kind=kind                             -- ② 真·加载失败（捕 status=ok 漏报）
                          AND event_type ∈ BROKEN_SAMPLE_EVENT_TYPES
)
```

- **ⓠ `url IS NOT NULL` 前置守卫（HIGH-1 根因修复）**：`logo_status`/`banner_backdrop_status` 默认即 `'missing'` + 实测已发布 banner URL=0、logo 多数从未配置 → 不守卫则 banner tab 把 47/47 全判「问题」淹没板。守卫后**「从未配置空位」（url=null）排除出问题集**，归缺图/覆盖率范畴（KPI Card 2 覆盖率 + Tab B missing-videos 承载，非本板）。对齐全域 `cover_url IS NOT NULL` 守卫范式。
- `BROKEN_SAMPLE_EVENT_TYPES = {client_load_error, empty_src, fetch_404, fetch_5xx, decode_fail}`（ADR-210 D-210-6 白名单，scan.ts:54）。**②刻意排除 timeout / dimension / aspect 误报**（图能加载，否则 2771 假阳性淹没）。①保留 broken/low_quality/pending_review → 仍「广」，交人眼定夺。
- 排除 `status='ok'` 且无真坏事件者（已确认正常，无需复查）。
- **实现约束**：kind→列名经白名单 Record/CASE 映射（禁请求参数裸插值列名）；LATERAL 按 `image_kind=$kind` 过滤。
- 验证：已发布 poster 命中 ≈ 25（含真坏 `d4lidZ0t`）；banner 命中 0（url 全 null，不再淹没）。

> **仅 poster 必须（用户裁定 2026-06-20）**：每个视频必须有可用封面；backdrop/logo/banner 为可选增强。故 secondary「从未配置」（url=null）完全可接受、非问题（url-guard 与此一致）；板**默认 tab=封面**（必须项优先），其余 3 tab 按需治理。「保证视频有图」的硬保证仅落 poster。
>
> 口径取舍：low_quality 纳入「问题」可争议（图能显示、仅尺寸）；本版纳入（值得人工确认是否可接受），后续可加状态子筛选。

---

## 6. 卡片设计（三处改动 + 失败态）

```
       ┌─────────────┐  ← 鼠标悬浮：详情浮层（绝对定位盖卡上方）
       │ ●pending     │     状态 pill / 来源 / 破损原因 event_type
       │ douban·timeout│    / 破损域名 / occurrence · last_seen
   ┌───┴─────────────┴──┐
   │     [缩略图]         │  ← ① 缩略=真实 URL；onError → 明确「✗ 加载失败」态
   │   (失败→✗加载失败)   │     （--state-error-border 红框+图标+文案，非原生裂图）
   └─────────────────────┘     （口径已 url IS NOT NULL，无「无图」态）
        《沙丘》              ← ② 标题（取代原「域名」）

   点击卡片 → ③ 打开 ImageGovernanceDrawer（复用 IMGH-P2-3A，定位到该 kind）
```

- **①缩略失败态**：`ProblemImageCard` 内置 `<img onError>` → 渲染「✗ 加载失败」占位（`--state-error-border` 红框+图标，token 已确认存在）。**不复用 admin-ui `Thumb`**（它无 onError 会原生裂图）。同时满足「不裂图」+「triage 可辨」。口径已 `url IS NOT NULL`（§5），卡片恒有真实 URL，**无「无图」态**（缺图归覆盖率范畴）。
- **②文案**：卡下 域名 → **影片标题**（truncate）。
- **③交互**：悬浮显详情（原 Lightbox 信息面板的角色下放到 hover）；点击 → 治理抽屉（缩放 Lightbox 收进抽屉内，抽屉已具图片矩阵+放大）。
- **后台失败态语义**：「**亮问题给运维**」（要看出哪些坏）——与前台 `FallbackCover`「**藏问题给用户**」（要好看）是两套语义，不混用。

---

## 7. 后端契约（新端点 → ADR-211，supersede ADR-210）

详见 **ADR-211**。摘要：

```
GET /admin/image-health/problem-images
    ?kind=poster|backdrop|logo|banner_backdrop  &scope=published|all  &offset=&limit=
→ { data: ProblemImageRow[], total, counts: { poster, backdrop, logo, banner_backdrop } }

ProblemImageRow {
  videoId, catalogId, title, isPublished, kind,
  imageUrl,            // <kind>_url（missing/空 → null）
  status,              // <kind>_status
  source,              // poster_source（仅 poster 有，余 null）
  eventType, brokenDomain, occurrenceCount, lastSeenBrokenAt   // 最近未解决真坏事件（无 → null）
}
```

- WHERE = §5 口径；`scope` → `is_published`；`counts` 一次给 4 类 badge（避免 4 次请求）。
- query 落 `imageHealth.scan.ts`（同 recent-broken-samples 域）→ `ImageHealthService` → route（守 Route→Service→DB）。
- **ADR-210 `recent-broken-samples` 端点随本端点落地后退役**（problem-images 是其超集：4 类 + 状态∪真坏事件口径）。

---

## 8. 复用 / 新增 / 退役

| 项 | 归属 | 处置 |
|---|---|---|
| `ImageHealthProblemBoard.tsx` | server-next `_client/`（新） | 编排 2×Segment + 网格 + 加载更多 |
| `ProblemImageCard.tsx` | server-next `_client/`（新） | 缩略+失败态+标题+hover 详情+onClick |
| `ImageGovernanceDrawer` / `ImageLightbox` | 已存在（复用） | 点击进入治理 |
| `Segment`/`Pill`/`AdminButton`（复用） | admin-ui | 无新共享契约 |
| `BrokenSamplesGrid.tsx` + `getRecentBrokenSamples` + ADR-210 端点 | 退役 | 被 problem-board / problem-images 取代 |

**待补验证项（关系目标#3 是否真闭环）**：核查前台**所有**公开封面入口是否都走 `SafeImage`（含 `SafeImageNext` 的 onError 行为）；若有裸 `<img>`/直挂 URL → 仍会裂图。建议独立核查卡（不在本设计实现范围）。

---

## 9. 门禁与任务拆分（实现期）

- 新 admin route → **ADR-211（草案→Accepted）+ Opus arch-reviewer PASS + `verify:endpoint-adr` + Subagents trailer**。
- 本设计 + ADR-211（非代码产物）→ 定稿前 **Codex 对抗性审核**。
- 无新 admin-ui 公开 Props（`ProblemImageCard` 模块内自实现失败态）→ 不触发强制 Opus 组件契约。
- 颜色零硬编码；后端 Route→Service→DB 分层。

**拆卡（原子化）**：
- **IMGH-P3-4A 后端**：ADR-211 + problem-images 端点（query/service/route，kind→列名白名单 Record 映射 + url IS NOT NULL 守卫 + LATERAL image_kind 过滤）+ counts + 单测；ADR-210 端点不在本卡删（退役随 4B 前端切换）。
- **IMGH-P3-4B 前端**：`ImageHealthProblemBoard` + `ProblemImageCard`（`--state-error-border` 失败态）+ 全宽布局（TOP 域名下移）+ 抽屉接入 + 加载更多 + 组件测试；退役 `BrokenSamplesGrid` / `getRecentBrokenSamples`；ADR-210 状态行补 superseded-by 标记。
- **IMGH-P3-4C 核查（LOW-2）**：前台**所有**公开封面入口是否都走 `SafeImage`（含 `SafeImageNext` 的 onError 行为）；若有裸 `<img>`/直挂 URL → 仍会裂图。这是目标#3「用户端零裂图」真正闭环点，独立核查（与 4A/4B 解耦）。

---

## 10. 评审点处置（arch-reviewer CONDITIONAL-PASS 已吸收）

1. **§5 口径 secondary missing 泛滥（HIGH-1）→ 已吸收**：加 `url IS NOT NULL` 前置守卫，「从未配置空位」排除（banner 47→0）；缺图归覆盖率范畴。
2. **动态列名注入（MEDIUM-1）→ 已吸收**：kind→列名白名单 Record/CASE，禁裸插值。
3. **counts/offset 漂移（MEDIUM-2）→ 登记**：counts 每页恒返回（规模毫秒级）；offset 加载更多漂移为分诊视图可接受取舍，刷新即重置。
4. **supersede 时序（MEDIUM-3）→ 已吸收**：4B 时 ADR-210 补 superseded-by。
5. **失败态 token（LOW-1）→ 已核**：`--state-error-border` 存在。
6. **SafeImage 覆盖面（LOW-2）→ 落 4C 核查卡**。
7. **low_quality 是否算问题**：本版纳入但**降权**（Codex H-2：派生 `problemReason` broken_event>broken>low_quality>pending + 默认真坏在前 + UI 分色/子筛选），避免淹没真破损。
8. **stills 多图**：本期不做第 5 tab（确认）。

**Codex 对抗性终审吸收（NO-BLOCK，2026-06-20）**：H-1 URL 守卫强化 `btrim(url)<>''`（防空串绕过）/ H-2 `problemReason` 派生+排序+分色（防 low_quality 淹没）/ H-3 offset 漂移三缓解（去重追加+治理后刷新 counts+切筛选重置）/ H-4 退役 checklist 单一真源（4B 同 commit 删 6 项 + ADR-210 已标 Superseded）。详见 ADR-211 决策与文末 Codex 摘要。**ADR-211 → Accepted。**
