# P-submissions-deprecated · （已弃用）旧用户投稿

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/submissions`（已弃用 banner，跳 `/admin/user-submissions`）|
| 设计稿引用 | — |
| 主任务卡 | CHG-SN-5-01（旧版 DataTable 视图）+ CHG-SN-7-REDO-02-D（B'' 简化 deprecation banner）+ CHG-SN-8-MANUAL-BATCH-3（手册定稿）|
| 涉及端点 | 旧 submissions 端点保留（M-SN-9 退役卡承担清理）|
| 适用角色 | 历史角色保留（仅看 banner，不操作）|
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-3）|

---

## 1. 这个页面是做什么的

**本页已弃用**。旧版用户投稿管理（DataTable 形态），在 CHG-SN-7-REDO-02 设计稿对齐重做后被新版 [P-user-submissions](./P-user-submissions.md)（Card list 形态，reference §5.13）取代。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ AdminCard surface='subtle' status='warn'                         │
│ ⚠️ 本页已弃用                                                     │
│ 用户投稿已迁移至新版 Card list 视图：                              │
│ 「前往 /admin/user-submissions」按钮（Next.js Link）              │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 跳转新版

- 点「前往 /admin/user-submissions」 → Next.js client 路由 push

## 4-7. 进阶 / 字段 / 颜色 / FAQ

详见 [P-user-submissions](./P-user-submissions.md)（新版真源）。

## 8. 与其他页面的关系

- → 跳出到 [P-user-submissions](./P-user-submissions.md)：新版真源
- **生命周期**：M-SN-9 退役卡承担 redirect + 物理删除路由
