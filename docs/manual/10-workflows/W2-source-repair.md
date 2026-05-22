# W2 · 线路失效 → 补源 → 复测

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / 2026-05-21）
> 触发场景：审核台 / 视频库发现「探测/播放 全失效」或大量「孤岛源」需修复

## 0. 元信息

| 字段 | 值 |
|---|---|
| 涉及页面 | [P-sources](../20-pages/P-sources.md) / [P-moderation](../20-pages/P-moderation.md) / [P-videos](../20-pages/P-videos.md) / [P-user-submissions](../20-pages/P-user-submissions.md) |
| 适用角色 | editor + admin |
| 关联设计 | reference.md §5.4 + §6.2 + 双信号 (probe/render) |

## 1. 业务场景

> "我是运营小张，刚收到 3 条用户失效源举报；昨晚 worker 检测又发现 50+ 个视频出现 probe.dead。我要快速定位哪些是真正失效（需删除/替换）哪些是探测误报（孤岛源）。"

## 2. 端到端步骤

### 2.1 从用户投稿入口（被动）

```
①  /admin/user-submissions（segment=「失效源举报」）
    └─ 看 SubmissionCard 列表（含视频标题 + 举报内容 quote）
②  card 「重验源」按钮 → 调对应视频的 reprobe
③  如确实失效 → admin 进 P-sources 行级删除该线路
④  如孤岛源（重验仍 ok 但用户报失效）→ spot-check 真机播放
⑤  card「处理」标 processed + reason 备注
```

### 2.2 从审核台入口（主动）

```
①  /admin/moderation 选某视频
②  右栏「详情」Tab → 「重测此视频线路」批量按钮（CHG-SN-8-05）
③  toast 显示「N 条线路 · 成功 X / 失败 Y」
④  失败比例高 → 拒绝该视频或转人工补源
```

### 2.3 从 P-sources 主动巡检

```
①  /admin/sources segment=「按视频分组」
②  filter health chip 选「全失效」/「孤岛」
③  展开行 → 线路矩阵 (8 集 × 多线路)
④  逐线路操作：
    - 重测：reprobeRoute (CHG-SN-8-05 / Promise.allSettled 批量)
    - 替换：当前无 URL 编辑入口（GAPS.md #G-sources-route-url-edit 候选）
    - 删除全失效：danger 按钮 + confirm
⑤  完成后 KPI「失效源」数字下降
```

## 3. 反例（不要这样做）

| 反例 | 解决 |
|---|---|
| 直接按用户报告删除（不 spot-check）| 孤岛源 % 高时容易误删 |
| 一键替换最相似 URL 没实装 | 当前 PageHeader 按钮是 Modal 占位（CHG-SN-8-FUP-SOURCES-DEAD-BTN） |
| 删除后忘记验证 | 删除立即生效；前台用户立刻看不到 |

## 4. 失败 / 中断 处理

| 失败点 | 现象 | 自救步骤 |
|---|---|---|
| reprobe 429 | rate-limit | 等 1 分钟 / 减小批量 |
| 删除 409 | 该线路有未结束的合并审计 | 先 unmerge / 查 audit log |
| 重测 worker 没跑完 | 异步 | 看 P-crawler timeline |

## 5. 相关

- 主页 [P-sources](../20-pages/P-sources.md) §3.3-§3.4
- 子流程：[W1 ②](./W1-crawl-to-publish.md) 重测在审核中触发
- GAPS：#G-sources-replace-similar / #G-sources-route-url-edit（候选）
