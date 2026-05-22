# P-merge · 合并 / 拆分工作台

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-1 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/merge`（query `?candidate_a=<id>&from=videos`/`moderation`）|
| 设计稿引用 | reference.md §5.9 |
| 主任务卡 | CHG-SN-5-08（ADR-105）+ CHG-SN-5-12（视图基座）+ CHG-SN-7-MISC-MERGE-1/2（重做）+ CHG-SN-8-08 + 08-B（深链 + 直接合并工作区） |
| 涉及端点 | `GET /admin/video-merges/candidates` / `POST /admin/video-merges` / `POST /admin/video-merges/:auditId/unmerge` / `POST /admin/videos/:id/split` |
| 适用角色 | moderator + admin |
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-1）|

---

## 1. 这个页面是做什么的

后台处理疑似重复视频的合并 / 拆分工作台。3 类入口：① 系统候选（自动算法生成的候选 group）② 视频库行级深链（CHG-SN-8-08 锁定 A）③ 审核台「类似」tab 深链（CHG-SN-8-04-VIEW）。

合并 = 把多个视频的源全部合并到一个 target，被合并的源标软删除（保留 audit）；可撤销（unmerge）。
拆分 = 把一个视频的源拆为多个独立视频（reverse operation）。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 合并 / 拆分工作台 · 拆分工作台 toggle 按钮            │
├──────────────────────────────────────────────────────────────────┤
│ 【条件】CandidateA Banner（仅 ?candidate_a 存在）+ DirectMergeWS │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 「已锁定候选 A: V001」+ 「清除」（CHG-SN-8-08）           │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ DirectMergeWorkspace（CHG-SN-8-08-B）：                   │ │
│  │  - VideoPicker 选 候选 B                                  │ │
│  │  - 「立即合并」按钮（B 未选 / B === A 时 disabled）       │ │
│  └──────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│ 【条件】SplitSection（拆分工作台 toggle on 时）                  │
├──────────────────────────────────────────────────────────────────┤
│ Segment：待审候选 / 已合并 / 已拆分                              │
│ ┌─ candidates Tab ─────────────────────────────────────────┐   │
│ │ minScore 调节 + DataTable（candidate group 行展开 card）│   │
│ ├─ merged Tab ────────────────────────────────────────────┤   │
│ │ AuditSection action='merge'（可撤销）                    │   │
│ ├─ split Tab ─────────────────────────────────────────────┤   │
│ │ AuditSection action='split'                              │   │
│ └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 系统候选合并（待审候选 segment）

- **位置**：「待审候选」segment + DataTable
- **行为**：调 listCandidates(minScore) → group 列表（每 group N 个疑似重复视频）
- **行展开**：card 形态 — 左右视频卡对比 + 中间合并原因 + 底部影响预览（线路 / 源 / 收藏 / 可回滚）
- **执行**：行内「确认合并」→ 二次确认（哪个为主体）→ mergeVideos
- **拒绝**：「拒绝候选」（仅本视图层 dismiss；group 后续可能重出）

### 3.2 视频库行级 → 直接合并（CHG-SN-8-08 + 08-B）

- **触发**：从 P-videos 行级「⋯」→「发起合并」→ 跳 `/admin/merge?candidate_a=<id>&from=videos`
- **效果**：顶部 banner 显示锁定的 A + 下方 DirectMergeWorkspace（VideoPicker 选 B + 「立即合并」）
- **完整流程见 [W4 §2.2](../10-workflows/W4-merge-split.md#22-视频库行级--merge-页直接合并chg-sn-8-08--08-b-已实施)**

### 3.3 审核台类似 tab → 直接合并（CHG-SN-8-04-VIEW）

- **触发**：从 P-moderation 右栏 「类似」tab → 任意行「发起合并」→ 跳 `/admin/merge?candidate_a=<当前>&candidate_b=<相似>&from=moderation`
- **当前状态**：candidate_a banner 显示；candidate_b 未自动填入 DirectMergeWorkspace（**功能缺失，登记 GAPS.md #G-merge-candidate-b-auto**）
- **当前替代**：用户在 Merge 页 VideoPicker 手动重选 candidate_b

### 3.4 已合并 segment 撤销（unmerge）

- **位置**：「已合并」Tab → AuditSection 列表
- **行为**：行尾「撤销合并」→ confirm → POST `/admin/video-merges/:auditId/unmerge`
- **效果**：被合并视频恢复 + audit log 写 unmerge 记录

### 3.5 拆分（拆分工作台 toggle）

- **位置**：PageHeader 「拆分工作台」secondary 按钮 → 展开 SplitSection
- **流程**：选源视频 → 按集分组 / 按线路分组 → 预览 → 执行 split
- **影响**：原视频分裂为多个新视频，每个新视频继承部分源

## 4. 进阶操作

### 4.1 unmerge（撤销合并 · 危险）

- **影响**：恢复 source video 软删除 + 移回各自原 sources；可能与新增数据冲突
- **回滚**：再次 merge（但 audit 链可能不连续）
- **建议**：合并后 24h 内发现错误立即 unmerge；超过则手动调

### 4.2 调 minScore 阈值

- **位置**：candidates Tab 顶部 AdminInput
- **效果**：min 0.6 默认；调高减少候选 / 调低暴露更多疑似项
- **建议**：日常用 0.6-0.7 平衡漏召回与噪声

## 5. 字段含义

| candidate group 字段 | 含义 |
|---|---|
| confidence pill | 0-1 算法置信度（CHG-SN-7-MISC-MERGE-2 card 顶部显示）|
| videos[] | group 内疑似重复视频（≥2 个）|
| score 公式 | v1 简化 = source_overlap_ratio（ADR-105 Y-105-1）|

| MergeParams | 含义 |
|---|---|
| sourceVideoIds | 被合并的视频（软删）|
| targetVideoId | 主体保留视频 |
| reason | 可选合并理由文本 |

## 6. 状态颜色

| pill | 含义 |
|---|---|
| 绿（ok）| 高置信度（>0.85）/ 成功合并 / 可撤销 |
| 黄（warn）| 中置信度（0.6-0.85）/ 冲突预警 |
| 红（danger）| 低置信度（<0.6 但勉强进列表）/ 拆分动作 |
| accent | 推荐 target（CHG-SN-5-12-PATCH P2-2 显式 badge）|

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| candidate_b 来自审核台但未自动选中 | GAPS.md #G-merge-candidate-b-auto 未实装 | 手动在 VideoPicker 内再选 B |
| 合并 toast 409 STATE_CONFLICT | A/B 有源冲突 / 已被合并 | 先到 /admin/sources 处理冲突 |
| 合并 toast 404 NOT_FOUND | videoId 已删除 | 刷新候选列表 |
| 撤销合并后部分源没回 | 期间有 source 增删 | audit log 手动核 |
| 拆分预览空 | source 无可拆分组 | 该视频不适合拆分 |
| 待审候选列表为空 | minScore 过高 / 算法未跑出 | 调低阈值 / 等定时任务 |

## 8. 与其他页面的关系

- ← 跳入自 [P-videos](./P-videos.md)：行级「发起合并」深链（CHG-SN-8-08）
- ← 跳入自 [P-moderation](./P-moderation.md)：RightPane「类似」Tab 行级深链（CHG-SN-8-04-VIEW）
- ← 跳入自 [P-dashboard](./P-dashboard.md)：AttentionCard 合并候选数深链
- → 跳出到 [P-audit](./P-audit.md)：合并/拆分动作均写入 audit log
- ↔ 相关工作流：[W4 合并拆分](../10-workflows/W4-merge-split.md)
