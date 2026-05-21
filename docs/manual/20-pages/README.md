# 20 · 页面手册（每路由一份）

> 每页对应一个 admin 路由，1:1 由 `verify:manual-coverage` 守护。

| 文件 | 路由 | 设计稿 | 状态 |
|---|---|---|---|
| [P-dashboard](./P-dashboard.md) | `/admin` | §5.1 | 骨架 |
| [P-moderation](./P-moderation.md) | `/admin/moderation` | §5.2 | 骨架 |
| [P-videos](./P-videos.md) | `/admin/videos` | §5.3 | 骨架 |
| [P-sources](./P-sources.md) | `/admin/sources` | §5.4 | 骨架 |
| [P-merge](./P-merge.md) | `/admin/merge` | §5.9 | 骨架 |
| [P-subtitles](./P-subtitles.md) | `/admin/subtitles` | §5.14 | 骨架 |
| [P-image-health](./P-image-health.md) | `/admin/image-health` | §5.8 | 骨架 |
| [P-crawler](./P-crawler.md) | `/admin/crawler` | §5.6 | 骨架 |
| [P-home](./P-home.md) | `/admin/home` | §5.7 | 骨架 |
| [P-user-submissions](./P-user-submissions.md) | `/admin/user-submissions` | §5.13 | 骨架 |
| [P-submissions-deprecated](./P-submissions-deprecated.md) | `/admin/submissions`（deprecation banner）| — | 骨架 |
| [P-users](./P-users.md) | `/admin/users` | §5.10 | 骨架 |
| [P-settings](./P-settings.md) | `/admin/settings` | §5.11 | 骨架 |
| [P-audit](./P-audit.md) | `/admin/audit` | §5.12 | 骨架 |
| [P-login](./P-login.md) | `/login` | §5.16 | 骨架 |

## 不需要 manual 的路由（守卫脚本豁免）
- `/admin/dev/*` — 开发者模式（reference 真源仍 §未编号；不暴露给运营）
- `/admin/system` — system landing（settings 已是真源）
- `/admin/analytics` — hidden + redirect 到 dashboard tab
- `/admin/staging` — 合并到 moderation tab

