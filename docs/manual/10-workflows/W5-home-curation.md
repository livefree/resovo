# W5 · 首页运营位编排

> status: 🟡 骨架
> 触发场景：每周更新首页推荐 / Banner / Top10 / 分类入口

## 0. 元信息
- 涉及页面：[P-home](../20-pages/P-home.md)
- 适用角色：editor+
- 关联设计：reference.md §5.7

## 1. 端到端步骤
```
①  /admin/home → 左侧编排列表 + 右侧 sticky 前台预览
②  Segment 选 Banner / Top10 / 推荐位 / 分类入口
③  「新建模块」→ Drawer 表单
    └─ 内容引用：VideoPicker 选视频（不允许输入 UUID）
       或 ContentRefPicker 切换 URL / HTML / 类型 模式
    └─ 排序 / 生效时间 / 是否启用
④  实时预览 → 「发布」即生效
```

## 2. 反例
- 「内容引用 ID」让用户输入 UUID/URL/HTML/枚举值混在一个框 → 必须 ContentRefPicker（CHG-SN-8-XX）

