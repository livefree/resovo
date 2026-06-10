# Resovo 后台使用说明书

> status: active
> owner: @engineering（开发卡按 page 维护）
> scope: 后台管理员日常操作指南
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-21

本目录是 Resovo 后台（admin console）的**用户使用说明书**，面向运营、审核员、采集运维等**非工程师角色**。

## 0. 使用约定

- **每个页面 / 每条工作流必须能让非工程师独立操作完成**
- 任何包含"输入 UUID / 数据库 ID / 内部主键"的操作 **=== 文档 bug**，请提 Issue
- 任何"按钮点了无反应 / 跳转 404 / 显示 mock 数据"的现象 **=== 实现 bug**，请提 Issue 并标 `H1/H2/H3/H4` 违反维度

## 1. 高频任务索引

> 按角色 + 频次排序；点链接直达对应章节。

| 我想…… | 角色 | 入口 | 详情 |
|---|---|---|---|
| 处理今天新采集到的视频（采集 → 审核 → 上架）| moderator+ | [W1 金票工作流](./10-workflows/W1-crawl-to-publish.md) | ★★★ |
| 修复失效的播放线路 | editor+ | [W2 补源](./10-workflows/W2-source-repair.md) | ★★ |
| 替换显示破图的封面 | editor+ | [W3 图片回退](./10-workflows/W3-image-fallback.md) | ★ |
| 合并两条疑似重复视频 | moderator+ | [W4 合并拆分](./10-workflows/W4-merge-split.md) | ★ |
| 编辑首页运营位 | editor+ | [W5 首页编排](./10-workflows/W5-home-curation.md) | ★ |
| 邀请新员工 / 改角色 | admin | [P-users](./20-pages/P-users.md) | — |
| 修改站点设置 | admin | [P-settings](./20-pages/P-settings.md) | — |
| 查看历史操作（谁改了什么）| admin | [P-audit](./20-pages/P-audit.md) | — |

## 2. 目录结构

```
docs/manual/
├── README.md                              本文（总览 + 索引）
├── _template/                             开发卡起手复制
│   ├── PAGE_TEMPLATE.md                   单页说明书 8 章节模板
│   └── WORKFLOW_TEMPLATE.md               端到端工作流模板
├── 00-roles-and-permissions.md            角色矩阵（admin / moderator / editor / crawler / viewer）
├── 01-getting-started.md                  首次登录 / 找回密码 / 2FA / 角色范围
├── 10-workflows/                          ★ 跨页面端到端工作流
│   ├── W1-crawl-to-publish.md             ★ 金票：采集 → 审核 → 上架
│   ├── W2-source-repair.md
│   ├── W3-image-fallback.md
│   ├── W4-merge-split.md
│   └── W5-home-curation.md
├── 20-pages/                              ★ 每个 admin 路由一份
│   ├── P-dashboard.md
│   ├── P-moderation.md
│   ├── P-videos.md
│   ├── P-sources.md
│   ├── P-merge.md
│   ├── P-subtitles.md
│   ├── P-image-health.md
│   ├── P-crawler.md
│   ├── P-home.md
│   ├── P-user-submissions.md
│   ├── P-submissions-deprecated.md        老 /admin/submissions 跳转说明
│   ├── P-users.md
│   ├── P-settings.md
│   ├── P-audit.md
│   └── P-login.md
├── 30-pickers/                            业务级选择器使用说明
│   ├── VideoPicker.md
│   ├── SourceLinePicker.md
│   ├── ContentRefPicker.md
│   ├── UserPicker.md
│   └── SitePicker.md
├── 90-glossary.md                         术语：双信号 / 线路别名 / 暂存 / 软删 / fallback 域
└── GAPS.md                                实施缺失 / 意义不明模块汇总（CHG-SN-8-MANUAL-BATCH-1 起活跃登记）
```

## 3. 4 条硬约束（M-SN-8 完结态）

新开发的页面 / 操作 / 表单必须同时满足以下 4 条；任一违反 = 实现 bug：

| 编号 | 约束 | 验收方法 |
|---|---|---|
| **H1** | 零 mock 视图：所有数字 / 列表 / 卡片必须 live 数据；fallback 必须显式标 "—" 或"暂无数据" | grep 代码无 `mock` / `sample` / `占位` 字样残留 |
| **H2** | 零死按钮：每个 `<button>` 必须有 onClick 或显式 `disabled` + tooltip 解释；危险操作必须二次确认；试错操作必须可撤销 / 可重试 | 同事点击每个按钮验证 |
| **H3** | 零断链：任意业务（采集/审核/上架/补源/合并）可从入口走到完成态，无需用户在地址栏改 URL | W1-W5 工作流逐条走通 |
| **H4** | 零 ID 输入：所有"选别的资源"必须用业务级 Picker（搜索 + 列表 + 选中卡），禁止 UUID / DB 主键直接 `<input>` | grep 代码无 `placeholder.*ID` / 36 位 UUID 正则 |

## 4. 开发双轨流（必须遵守）

```
[开发卡起草时]
  └─ DoD §0 必须先建 docs/manual/20-pages/P-<slug>.md 草稿（§1/§2/§3/§4 至少填空）
  └─ 涉及跨页面工作流时同步 docs/manual/10-workflows/

[开发实施中]
  └─ 每完成一个交互即回填 §3/§4 步骤截图或文案

[开发卡 PASS 前]
  └─ DoD §N 手册定稿，非工程师按手册走一遍能完成（同事走读 ≥ 1 次）
  └─ verify:manual-coverage 守门：admin 路由 ↔ manual page 1:1
```

## 5. 维护协议

- **新页面**：CHG 卡 DoD §0 起 manual 草稿 → 完工时定稿
- **页面改造**：触及交互的 CHG 卡必须更新对应 manual §3/§4
- **删除页面**：manual 文件改名为 `P-<slug>-removed.md` 并加 deprecation 头部，**不删除**（保留搜索可达性）
- **跨页面流程变化**：同步更新对应 W*.md

## 6. 角色矩阵

详见 [00-roles-and-permissions.md](./00-roles-and-permissions.md)。
