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

### 3.1 处理待审视频（J/K 翻页）

（待 CHG-SN-8-04 填写键盘流；CHG-SN-8-06 通过即上架开关见 §3.1b）

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

### 3.2 拒绝视频（带 label）

（待填）

### 3.3 查看历史 / 类似 / 详情（右栏 tabs）

（待 CHG-SN-8-04 TabSimilar 实装后填写）

## 8. 与其他页面的关系

- ← 跳入自 [P-crawler](./P-crawler.md)：采集完成 toast 深链（CHG-SN-8-03）
- → 跳出到 [P-staging](./P-crawler.md)（已合到 staging tab）：通过的视频自动入暂存
- ↔ 相关工作流：[W1 金票](../10-workflows/W1-crawl-to-publish.md) — **本页是 ② 中段**
