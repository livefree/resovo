# SitePicker · 采集站点选择器

> status: 🟡 骨架（M-SN-SHARED-04 实装时回填具体 API 字段与截图）
> owner: @engineering
> scope: 采集站点选择器组件文档
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10
> 业务域：crawler
> 核心 API：GET /admin/crawler/sites

## 1. 用途

(待填，1-2 句说明在哪里出现 / 替代了什么 ID 输入)

## 2. 触发器形态

(待填，截图 + 状态机：未选 / hover / 已选 / loading)

## 3. Dialog 形态

(待填，搜索框 + 列表行字段 + 快捷过滤)

## 4. 字段映射（业务字段 → 接口字段）

| 显示 | 来源字段 | 备注 |
|---|---|---|
| (待填) | (待填) | (待填) |

## 5. 键盘 / 快捷键

| 键 | 作用 |
|---|---|
| ↑↓ | 列表上下 |
| Enter | 确认选中 |
| Esc | 关闭 dialog |
| ⌘K | 全局打开（如配置）|

## 6. 错误态

- 搜索结果空：显式提示，不显示 "0 results"
- 网络失败：保留输入文本 + 「重试」按钮
- 权限不足：toast 提示

