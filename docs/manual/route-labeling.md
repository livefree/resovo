# 线路命名 / 排序 / 主题体系（route-labeling）

> 真源设计稿：`docs/designs/route-labeling-system.md`
> Phase 1 实施：CHG-352（后端 effective_score / 本卡）+ CHG-353（前台主题渲染 / 后续卡）
> 适用范围：前台播放页 `/v/:shortId/play` 的 SourceBar / LinesPanel 线路选择
> arch-reviewer (claude-opus-4-7) 评审 A-CONDITIONAL → 3 红线 + 4 黄线全采纳

---

## 1. 整体设计（三层）

```
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  Layer C（用户侧）   │   │  Layer B（运维侧）    │   │  Layer A（排序引擎） │
│  主题标签（位置映射）│   │  山名代号（永久绑定） │   │  effective_score     │
│  ⏳ CHG-353（前台）  │   │  ⏳ Phase 3 / MIG 064 │   │  ✅ CHG-352（本卡）  │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

- **Layer A**（本卡 / CHG-352）：后端 `SourceService.listSources()` 计算 `effective_score` + 按分值降序返回；前台直接消费已排序列表。
- **Layer B**（Phase 3）：运维侧山名代号（峨眉/泰山等），永久绑定 (siteKey, sourceName)，仅运维可见。需 Migration 064 落地。
- **Layer C**（CHG-353）：用户侧主题标签（节气/NATO/Planets 等），仅代表"排序位置"不绑定具体线路；纯前端处理。

---

## 2. Layer A — effective_score 公式（本卡范围）

### 2.1 主公式

```
effective_score = 0.50 × health_score
                + 0.30 × quality_score
                + 0.15 × latency_score
                + 0.05 × priority_bonus
```

**权重常量**（`apps/api/src/lib/route-scoring.ts` `WEIGHTS`，不可改动）：

| 因子 | 权重 | 理由 |
|------|------|------|
| health_score | 0.50 | 双轨信号综合 / 占主导（不可播 = 用户拉黑） |
| quality_score | 0.30 | 画质优先级次之（用户偏好高清） |
| latency_score | 0.15 | 延迟影响首帧体验，但短瞬可接受 |
| priority_bonus | 0.05 | 运维微调（不覆盖健康主导） |

### 2.2 health_score（双轨综合）

```
health_score = probe_map(probe_status) × 0.4 + render_map(render_status) × 0.6

probe / render_map: dead → 0.0, pending → 0.3, partial → 0.6, ok → 1.0
```

**render 权重更高**：探测通过但渲染失败比单纯探测失败更影响用户（点进去看不了）。

### 2.3 quality_score（fallback 链）

```
优先 quality_detected (实测，migration 059 7 档)
fallback quality (配置，5 档)
都 NULL → 0.40 中性

4K → 1.00   2K → 0.85   1080P → 0.70   720P → 0.50
480P → 0.30   360P → 0.15   240P → 0.05   NULL → 0.40
```

- **quality_detected 优先**：实测压倒配置（配置可能是爬虫粗估）。
- **2K + 240P 仅在 quality_detected 出现**（migration 059 quality_detected 7 档；migration 001 quality 5 档无 2K/240P）。

### 2.4 latency_score（档位映射）

```
NULL    → 0.50（未知，中性）
≤200ms  → 1.00
≤500ms  → 0.70
≤1000ms → 0.50
≤2000ms → 0.30
>2000ms → 0.10
```

### 2.5 priority_bonus（Phase 1 默认 0）

`source_line_aliases.priority` (0-100) 归一化到 0.0-1.0。
**Phase 1 / 本卡**：Migration 064 未落地 → 默认 0（arch-reviewer C1）。
Phase 3 落地后通过 admin UI 手动微调（不覆盖健康主导）。

---

## 3. 数学校准（边界值）

| 场景 | 输入 | effective_score |
|------|------|----------------|
| max（全 ok + 4K + ≤200ms + priority=1） | 完美线路 | **1.00** |
| 中性回落（全 NULL/pending） | 新爬未探测 | **0.345** |
| dead+4K+fast（dead 线路画质好） | probe=dead, 4K, 100ms | **0.45** |
| ok+240P+slow（活线低质量慢） | probe=ok, 240P, 5s | **0.53** |
| min（全 dead + 240P + >2s + priority=0） | 最差 | **0.03** |

**期望排序行为**：`ok+240P+slow (0.53) > dead+4K+fast (0.45) > 中性 pending (0.345)`。

> **关键洞察**：pending 行（新爬未探测 / 0.345）会排在"ok 实测差线路"(0.53) 之后但在"全 dead 高质量"(0.45) 之前。CHG-353 前台主题渲染时建议给 pending 行加单独标记（如"检测中"），避免用户困惑。

---

## 4. 后端实施位置（CHG-352 文件清单）

| 文件 | 职责 |
|------|------|
| `apps/api/src/lib/route-scoring.ts` | 纯函数模块：常量 + calculateEffectiveScore + 4 子函数（arch-reviewer R3） |
| `apps/api/src/services/SourceService.ts` | listSources 调 calculateEffectiveScore + sort by score DESC + stable secondary key (created_at ASC) |
| `apps/api/src/db/queries/sources.ts` | 新增 `findActiveSourcesWithSignalsByVideoId` + `DbSourceRowWithSignals` 类型（不污染 mapSource / 既有 findActiveSourcesByVideoId 契约不变） |
| `packages/types/src/video.types.ts` | `VideoSource.effectiveScore?: number` 可选字段（arch-reviewer R1） |
| `tests/unit/api/source-effective-score.test.ts` | 28 case：权重 + 4 子公式 + fallback 链 + 数学校准 + 排序稳定性参考 |

### 4.1 排序行为

```
SourceService.listSources(videoShortId, episode?):
  1. findVideoByShortId → 404 if not exists
  2. findActiveSourcesWithSignalsByVideoId → raw rows[]
  3. raw.map → { source: VideoSource, effectiveScore, createdAt }[]
  4. sort by effectiveScore DESC, fallback created_at ASC (stable)
  5. return VideoSource[] with effectiveScore
```

### 4.2 API 响应（向后兼容增字段）

`GET /videos/:shortId/sources` 响应增字段 `effectiveScore`（0.0-1.0），老客户端可忽略。

```jsonc
{
  "data": [
    {
      "id": "src-1",
      "videoId": "vid-1",
      "episodeNumber": 1,
      "sourceUrl": "https://...",
      "sourceName": "线路1",
      "siteDisplayName": "极速源",
      "quality": "1080P",
      "type": "hls",
      "isActive": true,
      "lastChecked": "2026-05-27T00:00:00Z",
      "effectiveScore": 0.825  // CHG-352 新增（可选，老客户端忽略）
    }
  ]
}
```

---

## 5. 范围与限制

### 5.1 本卡范围（Phase 1 / CHG-352）

- ✅ 前台 `GET /videos/:shortId/sources` 按 effective_score 排序
- ✅ effectiveScore 字段透出至 VideoSource（前台 SourceBar 可消费 / CHG-353）
- ❌ admin 后台 SourcesMatrixService 不动（Phase 3 + Migration 064 落地后独立卡）
- ❌ LinesPanel EpisodeMini 不加 effectiveScore（避免 admin-ui Props 契约爆破 / E1 决策）
- ❌ priority_bonus = 0（Migration 064 未落地）

### 5.2 后续卡

- **CHG-353**（即将落地）：Layer C 前台主题渲染 — 节气/NATO/Planets 等主题标签 + SourceBar.tsx 消费 effectiveScore + `applyThemeLabels()` 函数
- **Phase 3 / Migration 064**：source_line_aliases 加 codename / priority / retired_at 字段 + admin UI 调整 priority + LinesPanel 透出分数
- **PRE-PROBE-WORKER**：source-health worker 真实写回 probe_status / render_status / latency_ms（当前 effective_score 依赖这些字段，但 worker 写回路径需独立卡完善）

---

## 6. 公式校准记录（黄线 Y3 预留）

| 日期 | 改动 | 上行（修订前）| 下行（修订后）| 触发原因 |
|------|------|--------------|--------------|---------|
| 2026-05-27 | 初始公式（设计稿 §Layer A） | — | health 0.5 / quality 0.3 / latency 0.15 / priority 0.05 | CHG-352 落地 |
| — | — | — | — | — |

> 任何后续公式权重 / 档位映射调整需在此表追加一行，记录 上下行表现对比 + 触发原因。

---

## 7. FAQ

**Q1：为什么 health 权重最高？**
A：不可播 = 用户拉黑（线路失去意义）。其他因素（画质 / 延迟 / 运维优先级）在线路可用前提下才有意义。

**Q2：pending 行（0.345）排在 dead+4K（0.45）之前合理吗？**
A：合理。pending 是"尚未探测"中性状态，dead+4K 已经确认不可播；公式让 pending 行有"被尝试"的机会。CHG-353 主题渲染建议给 pending 行加"检测中"标记。

**Q3：为什么 effectiveScore 是可选字段？**
A：arch-reviewer R1 防破坏既有 5 处消费方（PlayerShell / playerStore / 测试 factory 等）。老客户端 `s.effectiveScore ?? 0` 兜底即可。

**Q4：能否在 SQL 直接 ORDER BY effective_score？**
A：拒。SQL CASE WHEN 写法易碎、难单测、公式变更需 migration。Service 层 + JS sort 公式可单独单测 + 灵活演进（arch-reviewer A1）。

**Q5：admin 后台为什么不同步排序？**
A：Phase 1 严格控范围 ≤ 5 文件 + admin Props 契约改动需 arch-reviewer trailer + 整套 admin matrix 重排有可能颠覆运维心智模型。Phase 3 + Migration 064 落地后再独立卡（arch-reviewer E1 + G1 advisory）。

---

## 8. Layer C — 前台主题渲染（CHG-353 / Wave 1 #9）

### 8.1 主题概念

主题标签 **不与具体线路绑定**，仅代表"排序位置"。换主题 = 换"皮肤"，排序和可用性不变。

实现位置：`apps/web-next/src/lib/line-display-name.ts`（`RouteTheme` 类型 + 5 主题常量 + `applyThemeLabels`）+ `apps/web-next/src/components/player/SourceBar.tsx`（消费）。

### 8.2 5 预置主题

| 主题 | 语言 | 标签数 | 示例 | deadLabel | fallback 前缀 |
|------|------|--------|------|-----------|-------|
| 节气（推荐 zh）| zh | 24 | 立春 雨水 惊蛰 春分 … 大寒 | 已断 | 线路 |
| NATO Phonetic（推荐 en）| en | 26 | Alpha Bravo … Zulu | Offline | Route  |
| 数字 | zh | 10 | 一 二 三 … 十 | 断 | 线路 |
| Planets | en | 8 | Mercury Venus … Pluto | Dark | Route  |
| Colors | en | 8 | Crimson Amber … Pearl | Dim | Route  |

### 8.3 标签赋值规则

```
后端返回：已按 effective_score 排序的线路列表（CHG-352）

前端 applyThemeLabels(routes, theme):
  index 0 → theme.labels[0]                          // 最优线路
  index n → theme.labels[n]                           // 主题长度内
        ?? `${theme.fallbackPrefix}${n+1}`            // 超主题长度 fallback
  effectiveScore < 0.1 → theme.deadLabel + isDead=true // dead 线路
  0.3 <= effectiveScore < 0.4 → isPending=true        // 中性 pending（"检测中"标记）
```

### 8.4 默认主题（按 locale）

| Locale | 默认主题 |
|--------|---------|
| zh-CN / zh-* | 节气 |
| en + 其他 | NATO Phonetic |

实现：`getDefaultTheme(locale)`。

### 8.4a 主题选择 + localStorage 持久化（CHG-369 / Phase 2）

用户可在播放器 sources tab 顶部下拉切换 5 内置主题；选择立即生效并持久化到 localStorage `resovo:route-theme`。

- **首次访问**：使用 `getDefaultTheme(locale)`（zh→节气 / en→NATO）
- **后续访问**：localStorage 命中合法 themeId → 应用；非法 / 已删除主题 → 静默回退 default
- **SSR 安全**：服务端 render 总是返回 default（避免 hydration mismatch）；client mount 后第一次 effect 切换到 localStorage 值
- **自定义主题输入**：本期未实装（labels ≤ 30 / name ≤ 10 字符 / follow-up CHG-369-B）
- **跨设备同步**：本期未实装（→ Wave 3 ROUTE-LABEL-D / `users.preferences`）

实现位置：`apps/web-next/src/lib/route-theme-storage.ts`（`useRouteTheme` hook + `readStoredThemeId` / `writeStoredThemeId` 纯函数）+ `apps/web-next/src/components/player/RouteThemeSelector.tsx`（下拉组件）。

### 8.5 边界处理

| 情况 | 处理 |
|------|------|
| **0 条线路** | SourceBar 不渲染（设计稿 §Layer C 极端情况）|
| **1 条线路** | SourceBar 显示画质（quality）作为 label / 无主题标签（仅 1 条无需选择）|
| **全部 dead** | 所有按钮 isDead=true + 灰色 + 50% opacity + deadLabel + title 提示"线路失效"|
| **超主题长度** | `${fallbackPrefix}${n+1}` 数字兜底，永远不缺位 |
| **pending（中性）** | label 正常显示 + 加省略号"…" + title "检测中" / CHG-352 I3 advisory 防"未知>已知差"困惑 |

### 8.6 dead 判定 heuristic

**Phase 1 简化**：用 `effectiveScore < 0.1` 阈值判定。

**精度限制**（advisory）：
- 全 dead+240P+slow = 0.030（min）— 0.1 阈值能覆盖 ✅
- 全 dead+1080P+200ms = 0.36（health=0, quality=0.21, latency=0.15）— **不会被覆盖** ❌

**Phase 2 优化方向**：后端 SourceService 派生 `isDead: boolean` 字段（health_score === 0 严格判定 / 暴露到 VideoSource）+ 前端直接消费 / 不再依赖 score 阈值。

### 8.7 用户自定义主题（CHG-369-B / 已 ship 2026-05-28）

设计稿 §Layer C "用户自定义主题"已实装。播放器 sources tab 主题下拉末尾新增"自定义…"选项 + 紧邻"✎"编辑按钮 → 打开 `CustomThemeDialog` 表单。

**存储协议**：

- `resovo:route-theme`：themeId（'jie_qi' / 'nato' / 'numbers' / 'planets' / 'colors' / **'custom'**）
- `resovo:route-theme:custom`：CustomThemeData JSON（与 themeId 解耦 / 仅在 themeId='custom' 时消费）

**CustomThemeData shape**：

```ts
{
  displayName: string         // 主题展示名（trim 后 1-10 字符）
  labels: string[]            // 标签列表（1-30 个 / 每个 trim 后 1-10 字符）
  deadLabel?: string          // 已断文案（可选 / trim 后 1-10 字符 / 默认 '已断'）
}
```

**约束**：

- displayName：≥ 1 字符 / ≤ 10 字符
- labels：≥ 1 个 / ≤ 30 个 / 每个 ≤ 10 字符
- deadLabel：可选 / ≤ 10 字符（超长默认丢弃 / 不阻断保存）
- 任一硬约束不满足 → Dialog 保存按钮 disabled + 错误就近显示
- 脏数据（localStorage 被直接改）→ `parseCustomTheme` 静默回 null / `useRouteTheme` 自动回退 default

**UI 流程**：

1. 用户点 sources tab → 顶部 RouteThemeSelector 下拉
2. 选 "自定义…"（无自定义时）→ 触发 `onOpenCustomDialog` → 打开 CustomThemeDialog
3. 选 "自定义：&lt;displayName&gt;"（已有自定义时）→ 立即应用 / 不打开 dialog
4. 点 "✎" 编辑按钮（任意时刻）→ 打开 CustomThemeDialog（如已有自定义则回显 / 否则新建）
5. Dialog 内点 "保存并应用" → 写 localStorage + setState + 关闭 dialog
6. Dialog 内点 "清除自定义主题"（仅已存在时）→ 删 localStorage + 当前若用自定义则回退到 default

**跨设备同步**：本期未实装（→ Wave 3 ROUTE-LABEL-D / `users.preferences`）。

### 8.8 文件清单（CHG-353 / CHG-369 / CHG-369-B）

| 文件 | 改动 |
|------|------|
| `apps/web-next/src/lib/line-display-name.ts` | 加 RouteTheme 类型 + 5 主题常量 + getDefaultTheme + applyThemeLabels（CHG-353）|
| `apps/web-next/src/lib/route-theme-storage.ts` | useRouteTheme + read/writeStoredThemeId（CHG-369）+ CustomThemeData + parseCustomTheme + read/write/clearStoredCustomTheme + customThemeToRouteTheme + useRouteTheme 扩 customTheme / setCustomTheme / clearCustomTheme（CHG-369-B）|
| `apps/web-next/src/components/player/SourceBar.tsx` | 接 themeLabel + quality + isDead + isPending props / 处理 1 条 / dead / pending 边界（CHG-353）|
| `apps/web-next/src/components/player/PlayerShell.tsx` | useLocale + applyThemeLabels 调用 + SourceItem 透传新字段（CHG-353）+ 装载 RouteThemeSelector（CHG-369）+ CustomThemeDialog + customDialogOpen state（CHG-369-B）|
| `apps/web-next/src/components/player/RouteThemeSelector.tsx` | 5 内置下拉（CHG-369）+ 自定义 option + 编辑按钮 + onOpenCustomDialog prop（CHG-369-B）|
| `apps/web-next/src/components/player/CustomThemeDialog.tsx` | NEW 自定义主题表单 dialog（仿 ConfirmReplaceDialog 模式 / role=dialog aria-modal / 实时校验 / 字符计数 / 保存 + 取消 + 清除）（CHG-369-B）|
| `tests/unit/web-next/lib/line-display-name-themes.test.ts` | 34 case：5 主题常量长度 + getDefaultTheme + applyThemeLabels 边界（CHG-353）|
| `tests/unit/web-next/route-theme-storage.test.ts` | 20 case：localStorage helper + parseCustomTheme 边界 + roundtrip + customThemeToRouteTheme（CHG-369 + CHG-369-B）|

### 8.8 文件清单（CHG-353）

| 文件 | 改动 |
|------|------|
| `apps/web-next/src/lib/line-display-name.ts` | 加 RouteTheme 类型 + 5 主题常量 + getDefaultTheme + applyThemeLabels |
| `apps/web-next/src/components/player/SourceBar.tsx` | 接 themeLabel + quality + isDead + isPending props / 处理 1 条 / dead / pending 边界 |
| `apps/web-next/src/components/player/PlayerShell.tsx` | useLocale + applyThemeLabels 调用 + SourceItem 透传新字段 |
| `tests/unit/web-next/lib/line-display-name-themes.test.ts` | 新建 22 case：5 主题常量长度 + getDefaultTheme + applyThemeLabels 边界 |


---

## §9 Layer B 实施记录（CHG-368-B / ADR-164）

> 真源：ADR-164（accepted 2026-05-28）+ Migration 079 + CHG-368-B-A1/-A2a/-A2b/-A3/-B 五子卡。

### 9.1 schema 扩展（Migration 079 / 2026-05-28）

`source_line_aliases` 扩 4 字段：

| 字段 | 类型 | 语义 | 引用 |
|---|---|---|---|
| `codename` | VARCHAR(20) NULL | 山名代号（"泰山-2"）/ 永久绑定 (siteKey, sourceName)/ 退役 90 天后可复用 | D-164-2 |
| `priority` | SMALLINT NOT NULL DEFAULT 0 CHECK 0-100 | Layer A `priority_bonus` 通道（route-scoring.ts 归一化 priority/100）| D-164-3 |
| `retired_at` | TIMESTAMPTZ NULL | 软删时间戳（NULL=在役 / NOT NULL=退役 + 90 天冷却）| D-164-4 |
| `auto_retired` | BOOLEAN NOT NULL DEFAULT false | true=worker 自动退役（plan §10.5 / 180 天全 dead）/ false=人工 POST retire | D-164-8 |

索引：
- `UNIQUE (codename) WHERE codename IS NOT NULL AND retired_at IS NULL` — 活跃 codename 全局唯一（部分唯一索引 / D-164-9）
- `(retired_at) WHERE retired_at IS NOT NULL` — 已退役行集合（候选路径 admin UI "已退役" tab + cooling 范围扫描 / 实测 EXPLAIN ANALYZE 验证）

### 9.2 字库治理（D-164-10）

代码常量真源：`packages/types/src/route-codenames.ts`

```ts
export const MOUNTAIN_CODENAMES: readonly string[] = [
  // 五岳（5）+ 道教（8）+ 西部（8）+ 华东（8）+ 华北（7）+ 华南（8）+ 其他（8）+ 占位（2）= 52 项
]
```

- DB 不存字库（参 ADR-017 VideoGenre union type 同模式）
- 字库支持后缀扩容（如 "泰山-2"）/ 不强制必须来自常量
- GET `/admin/source-line-aliases/codename-pool` 返回 `{ available, occupied, cooling }`

**字库枯竭重评条件**（R-164-5）：`occupied + cooling > 45` 触发 `PRE-ROUTE-CODENAME-LIBRARY-EXTEND` 卡（扩字库 / 允许英文 NATO / 元素周期表等）。

### 9.3 90 天冷却期判定（D-164-11 应用层）

`SourcesMatrixService.getCodenamePool()` 应用层判定：

```ts
const COOLING_MS = 90 * 24 * 60 * 60 * 1000
const now = Date.now()
const isCooling = (retiredAt !== null) && (now - Date.parse(retiredAt)) < COOLING_MS
```

DB 不写 CHECK 约束（D-164-11 / 运营紧急复用口子 / 时间约束不应写 DB / 与 ADR-163 D-163-4 "DB 层不强制业务不变式" 同模式）。

### 9.4 端点契约（R-MID-1 第 29-30 次系统化 / D-164-7）

| Method | Path | 鉴权 | actionType | RETRO |
|---|---|---|---|---|
| GET | `/admin/source-line-aliases` | moderator+ | — | — |
| GET | `/admin/source-line-aliases/codename-pool` | moderator+ | — | — |
| PUT | `/admin/source-line-aliases/:siteKey/:sourceName` | admin | `source_line_alias.upsert`（既有 / payload 扩 codename/priority）| 既有 |
| POST | `/admin/source-line-aliases/:siteKey/:sourceName/retire` | admin | `source_line_alias.retire`（新增）| 第 29 次 |
| PUT | `/admin/source-line-aliases/:siteKey/:sourceName/priority` | admin | `source_line_alias.priority_update`（新增）| 第 30 次 |

### 9.5 admin UI（CHG-368-B-B）

- 独立路径：`/admin/source-line-aliases`
- 真源：`apps/server-next/src/app/admin/source-line-aliases/_client/SourceLineAliasesClient.tsx`
- 组件：PageHeader + AdminCard codename 池摘要 + DataTable 一体化（mode='client' / 6 列）+ Modal 编辑行 + 行级退役
- 列：siteKey + sourceName + displayName + codename + priority + status (computed) + actions (kind: 'action')

### 9.6 priority 通道激活（CHG-368-B-A3）

- 改动：`SourceService.listSources` 内 `priorityBonus: row.alias_priority !== null ? row.alias_priority / 100 : 0`
- 公式（CHG-352 ship / 本卡未改）：`effective_score = 0.5×health + 0.3×quality + 0.15×latency + 0.05×(priority/100)`
- 行为：admin 通过 PUT priority 端点调高某线路 → 该线路 effective_score 立即上升 → SourceBar 排序前移

### 9.7 退役治理（D-164-4 + D-164-6）

- 手动退役：admin 通过 POST retire 端点 / `auto_retired=false` / 写 audit `source_line_alias.retire`
- 自动退役（plan §10.5 / 未实施）：worker 检测全 dead 180 天 → 写 `retired_at=NOW()` + `auto_retired=true` / 留 PRE-DEAD-LINE-AUTO-RETIRE-WORKER 占位卡（A-164-1）
- 退役语义对 effective_score 的影响：`SourceService.listSources` JOIN 加 `sla.retired_at IS NULL` 谓词 → 已退役行不出现在 SourceBar 排序池

### 9.8 5 黄线 + 4 advisory + 7 重评条件

详 ADR-164 §11 自审。CHG-368-B 五子卡（-A1/-A2a/-A2b/-A3/-B）已 ship 全部主线 + 大部分黄线（Y-164-3 admin UI bulkActions Toast 聚合留 advisory）。advisory A-164-2（LinesPanel codename 标签）→ CHG-368-B-C 待。

### 9.9 文件清单（CHG-368-B / 累计 5 子卡）

| 子卡 | 主要文件 |
|---|---|
| -A1 | `migrations/079_*.sql` + `packages/types/{sources-matrix.types,route-codenames}.ts` + `queries/sources-matrix.ts` |
| -A2a | `queries/sources-matrix.ts` (4 mutations) + `services/SourcesMatrixService.ts` (4 方法) |
| -A2b | `routes/admin/sources-matrix.ts` (3 端点) + RETRO 7 文件框架（types union + ACTION_TYPES + 双 audit 测试 + payload 测试）|
| -A3 | `queries/sources.ts` (JOIN + WHERE 谓词) + `services/SourceService.ts` (priority/100 派发) |
| -B | `app/admin/source-line-aliases/{page,_client/SourceLineAliasesClient}.tsx` + `lib/sources/api.ts` (4 函数) + `lib/admin-nav.tsx` sidebar 入口 |
