# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-30
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

### CHG-DESIGN-08 8B — saved views + 表头菜单 + flash row 接入（SEQ-20260429-02 第 8 卡 · 阶段 2/3）

- **状态**：🔄 待启动（8A 已完成；建议新 session 推）
- **关联序列**：SEQ-20260429-02
- **创建时间**：2026-04-30
- **建议主循环模型**：sonnet
- **前置依赖**：CHG-DESIGN-02 Step 7A（DataTable saved views / 表头菜单 / flash row API 已就位）+ CHG-DESIGN-08 8A（视觉对齐已完成）

#### 8B 阶段范围

VideoListClient 接入 DataTable Step 7A 已就位的三个 API：

1. **saved views**（个人 / 团队）：
   - 个人 views：localStorage 持久化（namespace `admin-videos-views`）
   - 团队 views：暂用 mock（M-SN-4+ 接入真端点）
   - 4 默认 views（reference §5.3）：「我的待审」/「本周」/「封面失效」/「团队新增上架」
   - 接入 DataTable.toolbar.viewsConfig

2. **表头菜单**（已 enableHeaderMenu）：
   - 验证当前实装在 8A 重构后仍工作（sort + hide + clear filter）
   - 加 Playwright MCP smoke 验证

3. **flash row**（reference §6.1 + DataTable.flashRowKeys）：
   - publish/unpublish 后 flash 当前行（视觉确认乐观更新）
   - 接入 VideoRowActions 内的 onRowUpdate 后 setTimeout flash 1.5s

#### 8B 文件范围

- `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx`（接入 viewsConfig + flashRowKeys）
- `apps/server-next/src/lib/videos/saved-views.ts`（新建：localStorage 持久化 + 4 默认 views）
- 不动：admin-ui DataTable / 5 cell / 列定义（8A 已就位）

#### 8B 不在范围

- VIDEO-INLINE-ROW-ACTIONS-MIGRATE（actions 列 inline btn 重构，依赖 CHG-DESIGN-10 VideoEditDrawer 增强）
- visual baseline + e2e — 8C
- 团队 views 真端点 — M-SN-4+（saved views 后端 schema 留 §A4 决议）

#### 8B 验收标准

- typecheck / lint / verify:token-references / verify:admin-guardrails 全绿
- 现有单测 2740 不回归
- 4 默认 saved views 切换工作；个人 view 持久化跨会话生效
- flash row 1.5s 视觉确认（reference §6.1 flash 动画）
- 表头菜单 sort+hide+clear filter 在 8A 重构后仍工作

---
