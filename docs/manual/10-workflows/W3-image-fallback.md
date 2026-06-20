# W3 · 封面失效 → 切 fallback 域 / 单视频补图

> status: 🟢 完整定稿（IMGH-P2 治理闭环 / 2026-06-20）
> owner: @engineering
> scope: 视频封面失效修复工作流 — 破损域识别、fallback CDN 批量切换、单视频跨源补图 / 手填 / 标记已解决
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-20
> 触发场景：图片健康页发现 TOP 破损域名累积 / Dashboard AttentionCard 图片告警 / 个别视频封面破损需精细补图

## 0. 元信息

| 字段 | 值 |
|---|---|
| 涉及页面 | [P-image-health](../20-pages/P-image-health.md) / [P-settings](../20-pages/P-settings.md) / [P-videos](../20-pages/P-videos.md) |
| 适用角色 | admin（批量切 fallback 域）+ editor（看 KPI + 重扫）|
| 关联设计 | reference.md §5.8 |

## 1. 业务场景

> "我是 admin 张哥，dashboard 异常告警显示 P0 封面失效 1200+ 条；img3.doubanio.com 占破损 90%。需要批量切到 fallback CDN 域恢复封面。"

## 2. 端到端步骤

```
①  /admin/image-health
    └─ KPI 4 看 P0 失效数（dashboard AttentionCard 深链同入口）
②  「健康概览」Tab → 主体左侧「TOP 破损域名」card → 看条形图
    └─ 定位主要问题源（如 img3.doubanio.com 占 95%）
    └─ 快捷操作：该行「切此域」按钮 → 直接打开 Modal 且预填源域名（省去步骤④手填 from）
③  小范围验证（建议）：
    a. 在视频库选 3-5 个 P0 失效视频
    b. 手动改其 cover_url 到 fallback CDN
    c. spot-check 新 URL 是否可达
④  PageHeader 「批量切 fallback 域」按钮（admin only）
    └─ Modal: 若从步骤②「切此域」进入，from 已预填为该行域名（无需手填）
    └─ 或手动填 from = "img3.doubanio.com" / to = "fallback.resovo.cdn"
    └─ 点「预览」→ dry-run 展示「将影响 N 条 video 封面」+ 三列 breakdown（cover_url / backdrop_url / banner_backdrop_url）
⑤  确认 → 批量改写 + audit log
⑥  toast「N 条已切」+ 等 backfill worker 重新探测（异步）
⑦  返回看 KPI「P0 失效」下降 / 「7 天新增破损」清零
⑧  如需让 worker 重新探活 / 补 blurhash：PageHeader「backfill」入队（不下载、不改 URL）
```

## 2b. 单视频精细补图 / 标记已解决（SEQ-20260619-02 / ADR-208 + ADR-209）

> 适用：个别视频封面破损、域级批量切不划算（破损分散在多域 / 量小）、或某源有更优封面候选时的精细治理。无需 admin 域级权限，editor 可在治理抽屉内逐个处理。

```
①  /admin/image-health → 切「图片治理」Tab
②  定位目标视频（治理工作台 §3.6）：
    └─ 列头 ⋯ 服务端筛选：海报状态=broken / 事件类型=fetch_404 / 破损域名=xxx 等按面收窄
    └─ 看「跨源候选」列：🟢 高置信（有可直接采用的候选）/ 🟡 待确认 / —（无候选，只能手填）
③  点击目标行 → 右侧「图片治理抽屉」打开
④  替换封面，二选一：
    a. 跨源候选补图：候选 Picker 选一张 → ImageCompare 与当前图对比 + 自动探活（达最小尺寸才允许确认）
       → 「确认」→ apply-candidate 经 safeUpdate 闸门写回，封面置 pending_review + 入队巡检
       （若提示 409 候选过期 → 关闭重开抽屉刷新候选再试）
    b. 手填封面 URL：粘贴可达的封面 URL → 「替换」→ 写回 + 置 pending_review
⑤  （可选）标记已解决：确认该破损已修复 / 属误报 → 抽屉底部「标记已解决」→ resolve 当前展示事件（幂等）
⑥  成功 → toast + 抽屉关闭 + 该行 flash 高亮 + 列表刷新；等 backfill worker 复探 pending_review
⑦  多行同类破损：勾选多行 → 底部「批量重扫选中」（scoped 重置 + 入队，纯 missing 无 URL 行自动跳过）
    或「打开候选队列」逐个进抽屉补图
```

> **与 §2 批量切 fallback 域的分工**：§2 解决「某 CDN 域整体失效、数千条同源破损」（域级 URL 改写）；§2b 解决「个别 / 分散破损需逐个换更优封面或标记已处理」（视频级补图）。先用治理工作台筛选判断破损是否集中于单域——集中 → §2；分散 → §2b。

## 3. 反例

| 反例 | 解决 |
|---|---|
| 直接切全站 fallback 不预览 | 影响数千条；不可逆 + 仅 audit 可追溯 |
| 切完不验证 | fallback 域可能不可达 → 切完反而失效更多 |
| 不告知前端用户 | 大批量改写后短时间内 CDN 缓存可能旧 + 新混杂 |

## 4. 失败 / 中断 处理

| 失败点 | 现象 | 自救 |
|---|---|---|
| 403 切 fallback 域 | 非 admin | 联系 admin |
| 切完仍显示 dead | 新 URL 也不可达 | spot-check 真机；反向 audit 回滚 |
| backfill 没跑 | worker 没启 | 查 P-crawler timeline |

## 5. 相关

- 主页 [P-image-health](../20-pages/P-image-health.md)：§3.3（批量切 fallback 域）/ §3.6（治理工作台）/ §3.7（治理抽屉补图闭环）/ §3.8（标记已解决）
- ADR：[ADR-208](../../decisions.md)（candidates 读 + apply-candidate 闸门）/ [ADR-209](../../decisions.md)（missing-videos 筛选 + resolve-event + ids 重扫）
- GAPS：#G-images-rollback（fallback 切完无自动反向回滚 API）— 候选未登记
