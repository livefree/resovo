# P-user-submissions · 用户投稿（Card list · §5.13 真源）

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/user-submissions` |
| 设计稿引用 | reference.md §5.13（Card list 形态，非 DataTable）|
| 主任务卡 | CHG-SN-7-REDO-02-A0..F（ADR-124 + migration 065 + 6 端点 + Card list 视图 + Segment primitive 沉淀）+ CHG-SN-8-MANUAL-BATCH-3（手册定稿）|
| 涉及端点 | `GET /admin/user-submissions`（按 type filter）/ `POST /admin/user-submissions/:id/process` / `POST /admin/user-submissions/:id/reject` / 等（ADR-124 共 6 端点）|
| 适用角色 | moderator + admin |
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-3）|

---

## 1. 这个页面是做什么的

处理来自前台用户的反馈投稿：失效源举报 / 求片 / 元数据纠错。3 类 segment 切换 + Card list 渲染。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 用户投稿                                              │
├──────────────────────────────────────────────────────────────────┤
│ Segment（CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE-A）：               │
│  失效源举报 / 求片 / 元数据纠错 / 已处理                          │
├──────────────────────────────────────────────────────────────────┤
│ Card list（非表格 · reference §5.13）：                          │
│  ┌─ SubmissionCard ─────────────────────────────────────────┐ │
│  │ 32px 状态 icon box (warn/info/danger 配色)                │ │
│  │ + 可选 poster（涉及视频时）                                │ │
│  │ + title + who/time meta                                    │ │
│  │ + quote block（用户投稿正文）                              │ │
│  │ + 操作按钮：重验源 / 查看视频 / 处理                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 切 segment 看不同类型投稿

| segment | type | 含义 |
|---|---|---|
| 失效源举报 | `bad_source` | 用户报告某视频源不可播 |
| 求片 | `wish_list` | 用户求某影片 |
| 元数据纠错 | `metadata_correction` | 用户报告标题/年份/演员等错误 |
| 已处理 | status=`processed` | 历史处理记录 |

### 3.2 处理失效源举报（bad_source）

- **位置**：card 「重验源」按钮
- **行为**：调对应视频的 reprobe API → 成功后该投稿自动标 processed
- **如确实失效**：admin 进 P-sources 删除该线路

### 3.3 处理求片（wish_list）

- **位置**：card 「处理」按钮
- **流程**：判断是否上架 / 是否已收录 → 调 process 端点 + reason 备注
- **不实际去采集片源**（采集走 P-crawler 单独工作流）

### 3.4 处理元数据纠错（metadata_correction）

- **位置**：card 「查看视频」+ 「处理」
- **流程**：跳视频库行级编辑 → 改字段 → 回此页标 processed

### 3.5 拒绝投稿

- **位置**：card 「拒绝」（部分类型）→ confirm + reason
- **行为**：调 reject 端点 + audit log
- **效果**：状态变 `rejected`

## 4. 进阶操作

### 4.1 批量处理
- **状态**：⬜ 未实装（GAPS.md #G-user-submissions-batch）

## 5. 字段含义（ADR-124 schema）

| 字段 | 含义 |
|---|---|
| type | bad_source / wish_list / metadata_correction |
| status | pending / processed / rejected |
| videoId | 涉及视频 UUID（可选）|
| submittedBy | 投稿用户（可空，匿名投稿）|
| submittedAt | 投稿时间 |
| metadata | jsonb，按 type 不同结构（ADR-124 D-124-3 zod 校验 3 类 metadata）|
| processedBy / processedAt / processNote | 处理人 / 时间 / 备注 |

## 6. 状态颜色

| 状态 icon box 颜色 | 含义 |
|---|---|
| 警告（warn）| bad_source / pending |
| info（蓝）| wish_list / pending |
| danger（红）| metadata_correction / pending |
| ok（绿）| processed |
| muted（灰）| rejected |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 看不到「已处理」记录 | 默认 segment 是 pending | 切到「已处理」|
| 求片该如何「处理」 | 视具体诉求；可标 processed + reason 「已记录」/「需采集」 | 据情判断 |
| metadata 字段空 | 投稿表单可能允许部分字段 | 看 ADR-124 D-124-3 schema |
| 旧 `/admin/submissions` 还在 | deprecation banner（M-SN-9 退役）| 跳 `/admin/user-submissions` |

## 8. 与其他页面的关系

- → 跳出到 [P-videos](./P-videos.md)：「查看视频」深链
- → 跳出到 [P-sources](./P-sources.md)：失效源举报后续处理
- → 跳出到 [P-audit](./P-audit.md)：所有 process/reject 写 audit log（ADR-124）
- ← 跳入自 [P-submissions-deprecated](./P-submissions-deprecated.md)：旧版 deprecation banner
