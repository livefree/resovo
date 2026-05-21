# W3 · 封面失效 → 切 fallback 域

> status: 🟡 骨架
> 触发场景：图片健康页发现 TOP 破损域名累积，需统一切到 fallback CDN 域

## 0. 元信息
- 涉及页面：[P-image-health](../20-pages/P-image-health.md) / [P-settings](../20-pages/P-settings.md)
- 适用角色：editor+
- 关联设计：reference.md §5.8

## 1. 端到端步骤
```
①  /admin/image-health → KPI 看 P0 失效数
②  TOP 破损域名条形图 → 选一个 → 「切 fallback」按钮
③  Modal 输入目标 fallback 域（业务级 select / 不允许输入 raw URL）
④  确认 → 后台批量改写 → toast 显示已替换 N 条
```

