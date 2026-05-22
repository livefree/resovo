# W3 · 封面失效 → 切 fallback 域

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / 2026-05-21）
> 触发场景：图片健康页发现 TOP 破损域名累积 / Dashboard AttentionCard 图片告警

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
②  主体左侧「TOP 破损域名」card → 看条形图
    └─ 定位主要问题源（如 img3.doubanio.com 占 95%）
③  小范围验证（建议）：
    a. 在视频库选 3-5 个 P0 失效视频
    b. 手动改其 cover_url 到 fallback CDN
    c. spot-check 新 URL 是否可达
④  PageHeader 「切 fallback 域」（admin only）
    └─ Modal: 填 from = "img3.doubanio.com" / to = "fallback.resovo.cdn"
    └─ 点「预览」→ 「将影响 N 条 video 封面」
⑤  确认 → 批量改写 + audit log
⑥  toast「N 条已切」+ 等 backfill worker 重新探测（异步）
⑦  返回看 KPI「P0 失效」下降 / 「7 天新增破损」清零
⑧  如需强制重下：PageHeader「backfill」触发 worker
```

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

- 主页 [P-image-health](../20-pages/P-image-health.md) §3.3
- GAPS：#G-images-rollback（fallback 切完无自动反向回滚 API）— 候选未登记
