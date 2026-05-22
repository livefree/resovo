# W5 · 首页运营位编排

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / 2026-05-21）
> 触发场景：周期性更新前台首页 4 类运营位（Banner / 推荐位 / Top10 / 分类入口）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 涉及页面 | [P-home](../20-pages/P-home.md)（主）+ [P-videos](../20-pages/P-videos.md)（VideoPicker 选片源）|
| 适用角色 | editor + admin |
| 关联设计 | reference.md §5.7 + ADR-104 home_modules 6 端点 |

## 1. 业务场景

> "我是内容运营李姐，每周一更新首页：① 改 Banner 主推新片 ② 调 Top10 顺序 ③ 增/删 推荐位条目 ④ 看真实前台预览确认。"

## 2. 端到端步骤

```
①  /admin/home
②  Segment 选 4 slot 之一（Banner / featured / Top10 / type_shortcuts）
③  右侧 sticky 预览（CHG-SN-7-MISC-HOME-1）持续显示前台模拟视图
④  操作：
    a. 新建：PageHeader 「新建模块」→ HomeModuleDrawer
       └─ slot / brandScope / contentRefType / 内容引用（ContentRefPicker）
          / ordering / startAt / endAt → 提交 (POST /admin/home-modules)
       └─ 内容引用 4 种 type 自动切换专用输入器（CHG-SN-8-FUP-HOME）：
          - video → VideoPicker 搜索式
          - external_url → URL input + 校验
          - custom_html → HTML 片段 ID
          - video_type → 11 VideoType select
    b. 编辑：行级 edit → PATCH /admin/home-modules/:id
    c. 拖拽排序：drag handle → POST /reorder（事务）
    d. 启用/禁用：toggle → POST /publish-toggle（ADR-104 D-104 协议）
    e. 删除：danger → DELETE（硬删）
⑤  「预览前台」（PageHeader · CHG-SN-7-MISC-HOME-2）：新窗口看真实 SSR
⑥  发布生效：CDN 缓存 5 分钟内更新
```

## 3. 反例

| 反例 | 解决 |
|---|---|
| 让用户输 video UUID | ContentRefPicker video → VideoPicker（CHG-SN-8-FUP-HOME 已修复）|
| 改 enabled 走 PATCH | 后端禁止（ADR-104 D-104）；走 publish-toggle |
| 删模块没确认 | 硬删不可回滚；建议先禁用再删 |

## 4. 失败 / 中断 处理

| 失败点 | 现象 | 自救 |
|---|---|---|
| 拖拽事务失败 | 顺序错乱 | 刷新页面 → 后端事务回滚保证一致 |
| 时效模块未自动启用 | startAt 到但未启 | 查 worker cron 是否运行 |
| 前台未看到改动 | CDN 缓存 5 分钟 | 等待 / 强制刷新 |

## 5. 相关

- 主页 [P-home](../20-pages/P-home.md)
- ContentRefPicker [picker manual](../30-pickers/ContentRefPicker.md)
- GAPS：#G-home-brand-multi（多品牌前台消费）
