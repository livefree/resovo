# W1 · 采集 → 审核 → 上架（金票）

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / M-SN-8 金票 CHG-SN-8-01..08 全闭合后定稿 2026-05-23 / CHG-SN-8-CLOSE-AUDIT-DRIFT-FIX 元信息同步）
> **这是 server-next 后台**最高频**的端到端业务流程，必须 100% 闭合。**

## 0. 元信息

| 字段 | 值 |
|---|---|
| 触发场景 | 把新采集到的视频审核完毕并上架到前台 |
| 涉及页面 | [P-crawler](../20-pages/P-crawler.md) → [P-moderation](../20-pages/P-moderation.md) → [P-videos](../20-pages/P-videos.md)（可选）|
| 涉及端点 | `POST /admin/crawler/sites/:key/run` / `GET /admin/moderation` / `POST /admin/moderation/:id/approve` / `POST /admin/moderation/:id/publish` |
| 适用角色 | crawler（采集）+ moderator（审核）+ editor（编辑） |
| 关联设计 | reference.md §5.6 / §5.2 / §5.3 |

## 1. 业务场景

> "我是审核员小李，每天上班第一件事就是把昨晚自动采集 + 今早手动触发的新视频，逐条过一遍，决定通过 / 拒绝 / 合并，并立即上架。整个流程不能让我去地址栏复制 ID、不能让我在多个标签页之间手动切换、更不能让我看到 'mock' 字样。"

## 2. 端到端步骤（**0 ID 输入 / 0 URL 编辑**）

```
①  /admin/crawler · 触发采集
    └─ 在「站点列表」找到目标站点行 → 点行尾「增量采集」按钮（站点级，常规）
       【高级】顶部 PageHeader 「全站增量」（dropdown 内） / 「全站全量」（双重确认 + 输入站点数才放行）
    └─ TimelineCard 实时显示任务运行
    └─ 任务完成后 → Toast「采集完成，新增 N 条视频」+ 「查看本次新增视频」按钮

②  ↳ 点击 toast 按钮 → /admin/moderation?run_id=<最近一次>
    └─ 左队列自动定位本次新增视频（高亮第一条）
    └─ J/K 上下切换 · A 通过 · R 拒绝 · S 跳过
    └─ 右栏：详情 / 历史 / 类似（类似页支持「合并候选」直达 W4）

③  ↳ 通过即自动入 staging tab；或在 RightPane 选「通过即上架」开关一步到位

④  /admin/moderation?tab=staging
    └─ 选中目标 → 「发布」（primary）→ 前台立即可见
    └─ 或 /admin/videos 行 inline action 「上架」直接发布

[end]  前台 /videos/<short_id> 立即可见
```

## 3. 反例（不要这样做）

| 反例 | 现象 | 当前状态 |
|---|---|---|
| 「全站全量」是主按钮 + 一键触发 | 误触爆炸性损耗 | ✅ 已修复（CHG-SN-8-01，commit 89fc7e00）|
| 采集完成后没有跳转入口 | 用户要手动开 moderation | ✅ 软深链已修复（CHG-SN-8-03，硬过滤 -03-B follow-up）|
| 审核台右栏「类似」是占位 | 无法找重复视频 | ✅ CHG-SN-8-04 (ADR-137 + EP + VIEW) 全闭合；纯字段召回 top10 + 行级合并深链 |
| 审核台「探/播 待测」无测试入口 | 用户无法手动重测线路 | ✅ 批量重测已修复（CHG-SN-8-05）；per-line inline 重测推 -05-B follow-up |
| 通过后还要去 staging 再点一次 | 多走一步 | ✅ CHG-SN-8-06 提供「通过即上架」toggle（admin 限定）；moderator 走 staging 路径（REDO-04 裁决保留）|

## 4. 失败 / 中断 处理

| 失败点 | 现象 | 自救步骤 |
|---|---|---|
| 第 ① 步采集触发返回 409 | 任务正在运行 / freezeEnabled | 等待 / 解除 freeze |
| 第 ② 步深链 404 | run_id 已过期或不存在 | 进 /admin/crawler/runs 找历史 |
| 第 ③ 步审核 409 | 别人同时操作了 | 刷新后重做 |
| 第 ④ 步发布 409 | 源全失效或元数据不完整 | 走 W2 补源 / 回填元数据 |

## 5. 相关

- W2 补源（审核中发现源全失效）
- W4 合并拆分（审核中发现疑似重复）
- W5 首页编排（上架后挂运营位）
