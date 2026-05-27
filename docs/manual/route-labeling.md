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
