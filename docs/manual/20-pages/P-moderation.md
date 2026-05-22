# P-moderation · 内容审核

> status: 🟡 §2 / §3.0 已部分填写（CHG-SN-8-03 RunInfoBanner 部分）；§3 主体待 CHG-SN-8-04/05/06 填写

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/moderation`（query `?tab=pending\|rejected` / `?run_id=<id>`）|
| 设计稿引用 | reference.md §5.2 + §6.0 |
| 主任务卡 | CHG-SN-4-FIX-*（基础重做）+ CHG-SN-8-03..06（金票链路打通）|
| 涉及端点 | `GET /admin/moderation/pending-queue` / `POST /admin/moderation/:id/reject-labeled` / `GET /admin/moderation/:id/audit-log` / `GET /admin/moderation/:id/line-health/:sourceId` / `GET /admin/moderation/history` 等 |
| 适用角色 | moderator ✅ / admin ✅ / editor ❌ |
| 最近更新 | 2026-05-21 (CHG-SN-8-03 软深链落地) |
| 同事走读签字 | (未走读) |

---

## 1. 这个页面是做什么的

后台审核员处理"待审核 / 已通过待发布 / 已拒绝"三态视频的工作台。从采集进来的新视频，逐条决定通过 / 拒绝 / 合并候选，是 [W1 金票工作流](../10-workflows/W1-crawl-to-publish.md) 的中段。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 内容审核                                            │
│ 副标题：今日 N 处理 · M% 通过率 · 键盘 J/K 切换                  │
├──────────────────────────────────────────────────────────────────┤
│ 【可选】RunInfoBanner ← 仅当 url 含 ?run_id 时（CHG-SN-8-03）   │
├──────────────────────────────────────────────────────────────────┤
│ Segment tabs: 待审核 / 已拒绝（已审已合到独立 /admin/staging）  │
├──────────────────────────────────────────────────────────────────┤
│ 三栏布局（pending tab）：                                       │
│  ┌──────────┬─────────────────────────┬──────────┐              │
│  │ 左队列   │ 中间主预览              │ 右详情   │              │
│  │ 280px    │ 主预览 + J/K 进度       │ 300px    │              │
│  │          │                         │ 详情/历史 │              │
│  │          │                         │ /类似 tab │              │
│  └──────────┴─────────────────────────┴──────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.0 接收采集深链（CHG-SN-8-03 落地）

- **触发条件**：从 [P-crawler](./P-crawler.md) 触发增量/全量后，toast 含「查看本次新增视频」action；点击跳转此处
- **现象**：URL `?run_id=<runId>`；页面顶部 Segment tabs 上方显示 RunInfoBanner「来自采集 run xxxxxxxx · 新增视频按创建时间排在队列顶部；逐条 J/K 翻页处理」
- **操作**：直接 J/K 翻页处理；新视频自然在顶部
- **「清除筛选」**：点击右侧按钮 → 移除 url `run_id` 参数，banner 消失
- **未来增强**（CHG-SN-8-03-B）：后端按 runId 严格过滤队列，仅显示该次 run 新增视频

### 3.1 处理待审视频（J/K 翻页 · 高频核心流）

- **前置**：moderator+ 角色 / Segment Tab = pending
- **键盘流（CHG-SN-4-FIX-C 实装）**：
  - `J` / 下方向键 → 队列下一条
  - `K` / 上方向键 → 队列上一条
  - `A` → 通过（视 §3.1b toggle 决定 approve 或 approve_and_publish）
  - `R` → 打开 RejectModal（带 label）→ §3.2
  - `S` → 跳过（不改状态，仅 activeIdx + 1）
  - `Esc` → 关闭 Modal / Drawer
- **鼠标流**：左队列点击视频 → 中央预览 + 右栏 tabs（详情/历史/类似）
- **乐观更新**：通过/拒绝即在左队列移除该条，API 失败则回滚
- **失败处理**：
  - 409 REVIEW_RACE「已被其他审核员处理」→ 刷新队列
  - 403 FORBIDDEN（approve_and_publish 非 admin）→ toast + 回滚

### 3.1b 「通过即上架」开关（CHG-SN-8-06 / W1 反例 #5 修复）

- **位置**：Segment tabs 右侧 toggle 标签
- **默认值**：off（sessionStorage `admin.moderation.approveAndPublishOn.v1` 持久化）
- **off 状态**：toggle 显示「通过 → 暂存」；A 键 / 通过 按钮调 `approve` action → 视频入 staging（独立路由 `/admin/staging` 等 admin 二次发布）
- **on 状态**：toggle 显示「✓ 通过即上架」；A 键 / 通过 按钮调 `approve_and_publish` action → 视频直接发布到前台（仅 admin 角色；moderator 触发 → toast「FORBIDDEN · approve_and_publish 仅限 admin 角色」回滚乐观更新）
- **权限**：moderator 可切 toggle on 但实际调用会被后端 403 拦截；建议 moderator 保持 off
- **场景**：admin 处理高确信新视频（如手动入库 + 元数据已齐 + 探测已通过）时打开开关一键过完整流程；对未确信的批量审核保持 off 走 staging 再二次确认

### 3.1a 重测此视频所有线路（CHG-SN-8-05 / W1 反例 #4 部分修复）

- **位置**：右栏 → 详情 Tab 顶部 actions row「重测此视频线路」按钮
- **行为**：拉取该视频所有 source_site_key + source_name 组合（去重）→ 并行调 `/admin/sources/:siteKey/:sourceName/reprobe` 触发线路重测
- **结果 toast**：
  - 全成功："已重测全部线路 · N 条 · 成功 N / 失败 0"（success）
  - 部分失败："部分重测失败 · N 条 · 成功 X / 失败 Y"（warn）
  - 无可重测："此视频暂未关联任何 (site_key, source_name) 线路"（warn）
  - fetch 失败："重测失败 · ${错误}"（danger）
- **未来增强**（CHG-SN-8-05-B follow-up）：LinesPanel 每行 inline「重测」xs btn 触发单线路重测；需 admin-ui API 扩展 + Opus 评审

### 3.2 拒绝视频（带 label · RejectModal）

- **触发**：R 键 / 「✕ 拒绝」按钮
- **Modal 内容**：
  - 必选 `labelKey` enum（来自 review_labels 表 / `GET /admin/review-labels`，如 `quality_low` / `duplicate` / `spam`）
  - 可选 `reason` 文本（500 字内）
- **行为**：调 `POST /admin/moderation/:id/reject-labeled` + 乐观更新移除
- **失败处理**：
  - 400 LABEL_UNKNOWN → labelKey 不存在
  - 409 REVIEW_RACE → 刷新

### 3.3 查看历史 / 类似 / 详情（右栏 tabs）

#### 3.3.1 详情 Tab（默认）
- 显示视频元数据 + 「重测此视频线路」批量按钮（CHG-SN-8-05）

#### 3.3.2 历史 Tab
- 调 `/admin/moderation/:id/audit-log` → 渲染审核动作时间线

#### 3.3.3 类似 Tab（CHG-SN-8-04-VIEW / ADR-137 已实装）
- 切到 Tab 时自动调 `GET /admin/moderation/:id/similar?limit=10`
- 召回算法：同 type 严格 + year ±5 + country 加权 + genres Jaccard（ADR-137 §3 公式）
- 列表行：标题 + meta（type · 年 · 国家）+ similarityScore pill 0-100 + 「发起合并」按钮
- 「发起合并」→ 跳 `/admin/merge?candidate_a=<当前视频>&candidate_b=<选中相似>&from=moderation` → Merge 页顶部显示 candidate_a banner（CHG-SN-8-08）
- 空召回 → EmptyState「未找到类似视频」（说明该视频在同类型/年份范围无相似项；可考虑直接审核或检查元数据完整性）
- 网络错误 → ErrorState + 「重试」按钮（refetch）

### 3.4 筛选预设（FilterPresetPopover · CHG-SN-4-FIX-F）

- **位置**：Segment tabs 旁齿轮 icon → Popover
- **行为**：保存当前 filter 组合为命名预设（如「我的待审」「本周新增」）+ 设为默认
- **持久化**：sessionStorage `admin.moderation.presets.<tab>.v1`
- **多账号共享**：⬜ 未实装（GAPS.md #G-moderation-preset-team）

### 3.5 批量审核（CHG-SN-8-GAPS-MOD-BATCH）

> **用途**：审核员对显然合格 / 显然不合格的批量视频快速处理，提高效率（替代逐条 J/K）。

- **位置**：Segment tabs 右侧「批量模式」toggle（仅 pending tab 显示）
- **开启批量模式**：
  - 左队列每行显示 checkbox + 单击行 = toggle 选中（不再跳详情）
  - J/K 流暂停（避免误操作）
- **选中 ≥ 1 行**：屏幕底部出现 bulk action bar（fixed bottom）：
  - 「✓ 批量通过 (N)」primary：confirm → POST `/admin/moderation/batch-approve { ids }` → 队列移除 + toast 反馈
  - 「✕ 批量拒绝 (N)」danger：弹 RejectModal（reason + label）→ POST `/admin/moderation/batch-reject { ids, reason, labelKey }`
  - 「清除选择」：清空 selectedIds + 关 bulk bar
- **后端约束**：每批 max 50 ids（端点 zod 限制）；部分失败 toast 显示「批量通过 X 条（失败 Y）」
- **退出批量模式**：toggle off → 清空选择 + 恢复 J/K 流

## 4. 进阶操作

### 4.1 重开审核（rejected → pending）

- 入口：右栏 → 详情 Tab 或视频库行级
- 调 `POST /admin/moderation/:id/reopen`
- 影响：清空 review_reason + 重置 reviewedAt/reviewedBy

### 4.2 批量审核

- **状态**：✅ 已实装（详见 §3.5）— GAPS.md #G-moderation-batch-ui 闭合

## 5. 字段含义

| VideoQueueRow 字段 | 含义 |
|---|---|
| review_status | pending_review / approved / rejected |
| visibility_status | public / internal / hidden |
| is_published | true/false（视为暂存与上架的核心标记）|
| probe / render | DualSignal 探测/播放双信号 |
| sourceCheckStatus | ok / partial / all_dead / unknown |
| metaScore | 0-100 元数据完整度 |
| doubanStatus | matched / candidate / unmatched |
| trendingTag | 'hot' / 'weekly_top' / 'editors_pick' / 'exclusive' |
| reviewSource | 'auto' / 'manual' / 'crawler' |
| badges | 端点投影计算（如 "线路全失效" / "图片失效"）|

## 6. 状态颜色

| pill | 含义 |
|---|---|
| 绿（ok）| approved / probe.ok / render.ok / matched |
| 黄（warn）| pending_review / partial / candidate / staging |
| 红（danger）| rejected / all_dead / unmatched |
| 灰（muted）| 未审 / 未测 |
| 蓝（info）| running / 部分新数据 |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 通过后跳 staging 而非前台 | toggle off | 切 §3.1b on（需 admin）|
| toast「approve_and_publish 仅限 admin」| moderator 切了 toggle on | toggle off 走 staging 路径 |
| RightPane「类似」Tab 空召回 | 该视频同 type/year 范围无相似项 | 检查 metadata 完整性 |
| 「重测此视频线路」空线路 | 视频无 sources | 走 P-crawler 重新采集 |
| FilterPresetPopover 预设丢失 | sessionStorage 浏览器关闭清 | M-SN-N 加 localStorage 持久化 |

## 8. 与其他页面的关系

- ← 跳入自 [P-crawler](./P-crawler.md)：采集完成 toast 深链（CHG-SN-8-03）
- → 跳出到 [P-staging](./P-crawler.md)（已合到 staging tab）：通过的视频自动入暂存
- ↔ 相关工作流：[W1 金票](../10-workflows/W1-crawl-to-publish.md) — **本页是 ② 中段**
