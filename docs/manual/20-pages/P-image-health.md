# P-image-health · 图片健康

> status: 🟢 完整定稿（CHG-SN-8-FUP-IMAGE 2026-05-21）
> owner: @engineering
> scope: 图片健康监控页面使用说明 — 破损域统计、fallback 域切换、图片重扫
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-19

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/image-health` |
| 设计稿引用 | reference.md §5.8 |
| 主任务卡 | CHG-SN-6-02（页面骨架）+ CHG-SN-7-MISC-IMAGE-1（重扫 + 切 fallback 域）+ CHG-SN-7-MISC-IMAGE-2（破损样本 grid）+ CHG-SN-8-FUP-IMAGE（手册定稿） |
| 涉及端点 | `GET /admin/image-health/stats` / `GET /admin/image-health/broken-domains` / `GET /admin/image-health/missing-videos` / `POST /admin/image-health/rescan` / `POST /admin/image-health/backfill` / `POST /admin/image-health/switch-fallback-domain` |
| 适用角色 | editor + admin（破坏性 action 需 admin） |
| 最近更新 | 2026-05-21 (CHG-SN-8-FUP-IMAGE) |
| 同事走读签字 | (未走读) |

---

## 1. 这个页面是做什么的

集中治理后台所有视频的封面（poster P0）和背景图（backdrop P1）健康度。

**双 Tab 治理工作台**：「健康概览」看 KPI 和破损分析，「图片治理」操作缺图视频；通过 KPI 看覆盖率，通过 TOP 破损域名定位"哪个 CDN 域出问题"，通过破损样本 grid 直观看坏图，通过 4 个 action 实施治理动作（重扫 / backfill / 切 fallback 域）。

**破损样本交互**：破损样本 grid 中的缩略图可点击打开 ImageLightbox（全屏放大 + 元信息诊断面板，含尺寸 / 来源 / 状态 / 破损域名和次数 / 可复制原始 URL）。

**TOP 域行内快捷操作**：TOP 破损域名表中每行都有「切此域」按钮，点击直接打开切 fallback 域 Modal 并预填源域名（无需手动输入）。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 图片健康                          ┌─────────────────┐│
│                                                │ 4 按钮          ││
│                                                │ Backfill /      ││
│                                                │ 重扫所有封面 /   ││
│                                                │ 批量切 fallback ││
│                                                │ 域 / 刷新       ││
└──────────────────────────────────────────────────────────────────┘

┌─ Segment 双 Tab ─────────────────────────────────────────────────┐
│ ◉ 健康概览  ○ 图片治理                                             │
└──────────────────────────────────────────────────────────────────┘

【Tab A：健康概览】
┌─ KPI 4 卡 ────────────────────────────────────────────────────┐
│ 已上架视频 · P0 覆盖率 · P1 覆盖率 · 7日新增破损（+趋势Spark）  │
└────────────────────────────────────────────────────────────────┘
┌─ 趋势卡 ──────────────────────────────────────────────────────┐
│ 7 日破损趋势（area 图，按日 count）                            │
└────────────────────────────────────────────────────────────────┘
┌─ 主体 1fr / 1fr ──────────────────────────────────────────────┐
│ TOP 破损域名（条形图列表）│ 破损样本 Grid（2:3 ratio +        │
│ 每行「切此域」按钮        │  错误 overlay，点击 →             │
│                        │  ImageLightbox）                   │
└────────────────────────────────────────────────────────────────┘

【Tab B：图片治理】
┌─ 缺图视频 DataTable ──────────────────────────────────────────┐
│ 分页 + 排序：标题 / 海报状态 / 海报来源 / 破损域名 / 破损次数  │
│            / 最近破损                                       │
└────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 重扫所有封面（CHG-SN-7-MISC-IMAGE-1）

- **位置**：PageHeader 右上 「重扫所有封面」按钮
- **行为**：调 `POST /admin/image-health/rescan` with `scope='broken_only'`（把符合 scope 的 `poster_status` 重置为 `pending_review` 且要求 `cover_url IS NOT NULL`，只动 poster、不动 backdrop，让 backfill worker 重新探测；scope 可选 `all` / `broken_only` / `missing_only`，默认 `broken_only`）
- **前置**：editor+ 角色
- **期望结果**：toast「重扫已触发 · 已重置 N 条封面，backfill 任务已入队」+ 列表 refresh
- **失败处理**：toast danger 显示错误信息

### 3.2 手动触发 backfill

- **位置**：PageHeader 「backfill」按钮
- **行为**：调 `POST /admin/image-health/backfill` → 扫 `pending_review` 图片 + 缺 blurhash 的 ok 图片，分批入队 `health-check` / `blurhash-extract` job。**不下载图片、不改任何 URL**（仅触发探活与 blurhash 提取；纠正旧文档「重新下载到 fallback CDN」的错误说法）
- **前置**：editor+ 角色；建议先用 3.1 重扫
- **期望结果**：toast「backfill 已入队」
- **何时用**：3.1 重扫后，让 worker 对 `pending_review` 封面批量探活 / 补 blurhash

### 3.3 批量切 fallback 域（CHG-SN-7-MISC-IMAGE-1 + ADR-135）

> ⚠️ **批量改写已上架视频的封面 URL**；需 admin 角色 + 二次确认

- **位置**：PageHeader 「切 fallback 域」按钮
- **行为**：打开 SwitchDomainModal → 输入 from / to 域 → 预览影响条数 → 确认 → 批量改写
- **操作步骤**：
  1. 点击「切 fallback 域」
  2. Modal 内填「源域 from」（如失效的 img3.doubanio.com）+「目标域 to」（fallback CDN）
  3. 点击「预览」→ 显示「将影响 N 条 video 封面」
  4. 点击「确认」→ 批量改写 + audit log + toast 成功
- **回滚**：通过 audit log 找到本次 actionType=`image_health.switch_domain` 条目 → 手动反向操作（无自动逆操作）
- **失败处理**：from/to 域为空 → 校验错误；500 → toast danger

### 3.4 看破损 TOP 域名

- **位置**：「健康概览」Tab 主体左侧 card「TOP 破损域名」
- **行为**：调 `GET /admin/image-health/broken-domains` → 显示域名 + 破损数量条形图
- **用途**：定位"哪个 CDN 域是主要问题源"，决策是否 3.3 切 fallback
- **快捷操作**：每行有「切此域」按钮，点击直接打开「批量切 fallback 域」Modal 并预填源域名为该行域名（省去手填）

### 3.5 看破损样本（CHG-SN-7-MISC-IMAGE-2）

- **位置**：「健康概览」Tab 主体右侧 grid「破损样本」
- **行为**：渲染 N 张 2:3 ratio 占位（danger dashed border + 底部错误信息 overlay）；点击缩略图打开 ImageLightbox
- **ImageLightbox 内容**：全屏放大显示 + 元信息诊断面板（尺寸 / 来源 / 状态 / 破损域名和次数 / 可复制原始 URL）
- **用途**：直观看坏图样式（404 / 5xx / dns error / timeout 等分类）+ 诊断元信息

### 3.6 缺图视频表

- **位置**：「图片治理」Tab 内 DataTable
- **行为**：调 `GET /admin/image-health/missing-videos` → 列出缺 poster 或 backdrop 的视频
- **列定义**：视频标题 / 海报状态 / 海报来源 / 破损域名 / 破损次数 / 最近破损（分页 + 排序支持）

## 4. 进阶操作

### 4.1 批量切 fallback 域（已在 §3.3 详述，本节强调危险）

- **影响范围**：所有匹配源域的视频封面 URL（可能数千条）
- **不可逆**：URL 改写后无自动反向回滚（仅 audit log 可追溯）
- **建议**：先用预览看影响范围 → 小范围验证（在 3-5 个视频上人工 spot-check 新 URL 是否可达）→ 再批量执行

## 5. 字段含义

| KPI | 含义 |
|---|---|
| 已上架视频 | is_published=true AND visibility=public 的视频总数 |
| P0 封面失效 | poster_status='broken' 的视频数（枚举无 `dead`，失效态是 `broken`） |
| P1 背景图失效 | backdrop_status='broken' 的视频数 |
| 7 天新增破损 | 最近 7 天内首次标 broken 的封面数 |

| 破损样本字段 | 含义 |
|---|---|
| 缩略图 (2:3) | 原 URL 的快照（danger dashed border 标记是坏图）|
| 错误信息 overlay | 底部黄色 overlay 显示「404 not_found」/「dns_failure」等错误码 |

## 6. 状态颜色

| pill / dot | 含义 |
|---|---|
| 绿（ok）| 探测通过，封面可用 |
| 黄（warn）| 部分集 / 部分尺寸失效 |
| 红（danger）| 失效（poster_status=broken）|
| 灰（muted）| 待探测 |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 切 fallback 域 → toast 403 | 非 admin 角色 | 联系 admin 操作 |
| 重扫后 P0 失效数量没变 | broken_only 只重置探测状态，不替换 URL；需 3.3 切 fallback 域才会真改 URL | 流程：重扫 → 切 fallback → 验证 |
| TOP 破损域名列表为空 | 无破损 / 数据尚未跑出 | 查 cron job 状态 |
| 破损样本 grid 全是占位 | sample 量未达阈值 | 等 worker 跑出更多数据 |

## 8. 与其他页面的关系

- → 跳出到 [P-videos](./P-videos.md)：缺图视频行操作「去编辑」跳视频库
- ← 跳入自 [P-dashboard](./P-dashboard.md)：管理台站 AttentionCard 显示 P0 失效数 + 「全部解决」深链
- ↔ 相关工作流：[W3 封面失效 → 切 fallback 域](../10-workflows/W3-image-fallback.md)

---

**本次更新** (2026-06-19)：新增双 Tab 结构（健康概览 / 图片治理）、破损样本 ImageLightbox 交互、TOP 域行内「切此域」快捷按钮、7 日破损趋势 Spark 卡（SEQ-20260619-01 P1 双 Tab 重构落地）
