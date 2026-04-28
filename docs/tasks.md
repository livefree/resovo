# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-28
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## CHG-SN-2-02 — admin-nav.ts 5 字段扩展 + ADMIN_NAV 注入 icon/shortcut/badge + admin-layout z-shell-* token 三新增

- **状态**：🟠 PARTIAL · stage 1/2 已完成 / stage 2/2 BLOCKER 暂停（详见 task-queue.md 尾部 BLOCKER 通知）
- **创建时间**：2026-04-28 22:00
- **实际开始**：2026-04-28 23:15
- **建议模型**：opus（Token 层新增字段，CLAUDE.md 模型路由第 5 条）
- **主循环模型**：opus
- **工时估算**：0.5 天
- **关联序列**：SEQ-20260428-03 任务 2/N（M-SN-2 第一张实施卡）
- **关联 plan §**：§4.3 token 4+1 层 / §4.4 / §6 M-SN-2 v2.3 / §4.7 依赖白名单
- **关联 ADR**：ADR-103a（本卡输入，已 PASS + fix 修订）/ ADR-102 v2.1（admin-layout 第 5 层 token 字段新增按修订段硬约束 2 — milestone 报备而非 ADR）
- **依赖**：CHG-SN-2-01 PASS + fix(CHG-SN-2-01) 修订 PASS（commit 1757b7a + cacd582）
- **文件范围**：
  - `apps/server-next/src/lib/admin-nav.ts`（AdminNavItem 5 字段扩展 + AdminNavCountProvider 接口 + ADMIN_NAV 13 项注入 icon/shortcut/badge）
  - `apps/server-next/src/lib/shell-data.ts`（新建：AdminNavCountProvider stub + HealthSnapshot stub + TopbarIcons stub）
  - `apps/server-next/package.json`（lucide-react deps 追加，如未存在）
  - `packages/design-tokens/src/admin-layout/z-index.ts`（新建：3 token）
  - `packages/design-tokens/src/admin-layout/index.ts`（追加 z-index 导出）
  - `packages/design-tokens/build.ts`（buildLayoutVars 追加 z-shell-* 字段写入）
  - `packages/design-tokens/scripts/build-css.ts`（同步追加，如有该脚本）
  - `packages/design-tokens/src/css/tokens.css`（auto-generated；执行 build 后产物）
  - `tests/unit/design-tokens/admin-layout.test.ts`（追加 z-shell-* 3 断言）
  - `scripts/verify-token-isolation.mjs`（FORBIDDEN_TOKENS 追加 z-shell-drawer / z-shell-cmdk / z-shell-toast）
- **不在范围**：Shell 组件实施（CHG-SN-2-03+）/ admin-ui zustand 加 deps（CHG-SN-2-03 ToastViewport 卡范围）
- **验收要点**：
  - admin-nav.ts AdminNavItem 类型 5 字段（含原 children）+ AdminNavCountProvider 接口导出
  - ADMIN_NAV 13 项链接注入 icon ReactNode（lucide-react）+ 6 项 shortcut（管理台站/内容审核/视频库/字幕/采集/站点设置 = ⌘1/⌘2/⌘3/⌘4/⌘5/⌘,）+ badge（内容审核 warn / 播放线路 danger / 合并 warn / 图片健康 warn / 用户投稿 info）按设计稿 v2.1 shell.jsx 真源
  - shell-data.ts 含 stub provider 函数（M-SN-2 阶段返 empty Map / mock data）
  - admin-layout 三 z-shell-* token 落盘 + tokens.css auto-generated 含 3 行 + 单测 PASS
  - verify-token-isolation FORBIDDEN_TOKENS 含 3 新 token + 故意制造违规 → 脚本捕获
  - typecheck + lint + test 全绿
  - :3003 实测（如可登录）：admin-nav 渲染含 icon + shortcut（视觉层 M-SN-2 后续卡装配 Sidebar 后才能完整呈现，本卡仅数据准备）
- **子代理调用**：arch-reviewer (claude-opus-4-7) — Token 层新增字段评审（CLAUDE.md 模型路由第 5 条）；本卡是 ADR-103a 之后的实施卡，复核重点：实施与 ADR §4.2/§4.3 1:1 对齐 + 守卫扩展正确性
- **完成判据**：所有文件落盘 + 必跑命令全绿 + Opus 复核 PASS + commit
