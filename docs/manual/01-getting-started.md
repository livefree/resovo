# 01 · 入门指南

> status: draft（骨架）；M-SN-8 各业务卡按需回填截图与具体步骤。
> owner: @engineering
> scope: 后台新员工首次登录指南 / 密码恢复 / 角色查询
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10

## 1. 首次登录

1. 访问 `https://<server>/login`
2. 输入分配的邮箱 + 密码
3. 如启用 2FA，输入 6 位验证码
4. 登录成功跳转 `/admin`（管理台站）

## 2. 找回密码

- 当前流程：联系 admin 在 [P-users](./20-pages/P-users.md) 重置（self-serve 找回功能 M-SN-N 落地）

## 3. 我的角色是什么？

- 登录后右上角用户头像 → 用户菜单 → 查看角色
- 角色含义见 [角色矩阵](./00-roles-and-permissions.md)

## 4. 高频快捷键

| 快捷键 | 作用 |
|---|---|
| ⌘1 | 跳转管理台站 |
| ⌘2 | 跳转内容审核 |
| ⌘3 | 跳转视频库 |
| ⌘4 | 跳转字幕管理 |
| ⌘5 | 跳转采集控制 |
| ⌘, | 跳转站点设置 |
| ⌘K | 全局命令面板 |
| J / K | 审核台上下移动 |
| A / R / S | 审核台 通过 / 拒绝 / 跳过 |
| Esc | 关闭 Drawer / Modal |

## 5. 我看到一个问题怎么办？

- **mock 数据 / 死按钮 / 跳 404 / 让我输 UUID** → 这是 bug，请提 Issue 并标注 `H1/H2/H3/H4`（见 [README §3](./README.md#3-4-条硬约束m-sn-8-完结态)）
- **不知道怎么操作** → 查对应 [P-* 页面手册](./20-pages/)
- **不知道术语含义** → 查 [glossary](./90-glossary.md)
