# 00 · 角色矩阵与权限

> status: draft（骨架待 M-SN-8 各业务卡按需回填具体端点的角色限制）
> owner: @engineering
> scope: 后台系统 5 角色权限矩阵及页面访问权限表
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10
> 真源：`apps/api/src/routes/admin/*.ts` + `apps/api/src/lib/auth/*`

## 1. 角色列表（5 类）

| 角色 | 中文 | 主要职责 | 典型用户 |
|---|---|---|---|
| `admin` | 管理员 | 系统设置 / 用户管理 / 危险动作 / 审计回滚 | 站长、技术负责人 |
| `moderator` | 审核员 | 内容审核（通过/拒绝/合并）/ 暂存发布 | 全职审核团队 |
| `editor` | 编辑 | 元数据编辑 / 补源 / 字幕上传 / 首页编排 | 内容运营 |
| `crawler` | 采集 | 仅采集任务相关 | 自动化账号 |
| `viewer` | 只读 | 只看数据，不能改 | 数据分析、试用 |

## 2. 页面 × 角色权限速查（待 M-SN-8 各卡精修）

| 页面 / 操作 | admin | moderator | editor | crawler | viewer |
|---|---|---|---|---|---|
| 管理台站浏览 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 视频库浏览 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 视频编辑 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 通过 / 拒绝审核 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 合并 / 拆分 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 上传字幕 | ✅ | ❌ | ✅ | ❌ | ❌ |
| 首页编排 | ✅ | ❌ | ✅ | ❌ | ❌ |
| 采集触发（站点级）| ✅ | ❌ | ❌ | ✅ | ❌ |
| 采集触发（全站）| ✅ | ❌ | ❌ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 站点设置 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 审计日志 | ✅ | ⚠️ 仅自己 | ⚠️ 仅自己 | ❌ | ❌ |

## 3. 调整角色

- 入口：[P-users · 角色矩阵](./20-pages/P-users.md#41-改角色)
- 仅 `admin` 可改其他用户角色
- 改角色操作会写入审计日志

## 4. 用户菜单 6 项 action（CHG-SN-8-FUP-USER-MENU 已实装）

| Action | 行为 | 状态 |
|---|---|---|
| 个人信息（profile）| Modal 显示当前 user.displayName / email / role / id；编辑按钮筹备中 | ✅ |
| 偏好设置（preferences）| Modal 含主题切换 + 「品牌 / 语言 / 密度」筹备中占位 | ✅ |
| 主题切换（theme）| 直接切换 light/dark（复用 ThemeProvider） | ✅ |
| 帮助（help）| Modal 含 W1-W5 工作流速查 + 高频快捷键 + manual 入口 | ✅ |
| 切换账号（switchAccount）| Toast「多账号切换在 M-SN-N 实装」 | ⚠️ 反馈 |
| 登出（logout）| 跳 `/login` | ✅ |
