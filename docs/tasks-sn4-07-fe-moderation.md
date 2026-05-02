# Resovo（流光） — Track sn4-07-fe-moderation 任务工作台

> Track: sn4-07-fe-moderation
> 分支：`track/sn4-07-fe-moderation`
> status: active
> owner: @engineering
> source_of_truth: yes（本 Track 内）
> last_reviewed: 2026-05-02
>
> 单任务工作台（Track 内）：同一时刻只保留 1 个进行中任务。Track 注册表见 `docs/tracks.md`，并行规则真源 `docs/rules/parallel-dev-rules.md` v1.1。
>
> **本 Track 持有冲突域**：`app:server-next:moderation`（自定义软锁，命名空间隔离）
> **集成阶段 task-queue.md Type B 写入**：禁止在本分支执行；统一在 PR 合并到 main 时由集成方串行更新。

---

## 进行中任务

### CHG-SN-4-07 · 审核台前端接入（useTableQuery + Gmail 流 + RejectModal/Drawer 接线 + i18n + a11y + visual baseline）· 🔄 进行中

- **来源序列**：`docs/task-queue.md` SEQ-20260501-01 / M-SN-4 阶段 C 双轨
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §5（六项前端共性约束 + 三 Tab 操作流程）
- **建议主循环模型**：`claude-sonnet-4-6`（plan §8.1 - 4 工作日规模）
- **强制子代理**：否（如出现新 ADR 级决策 / packages/admin-ui 共享 API 契约改动 → BLOCKER 暂停）
- **前置**（全部已就位）：CHG-SN-4-04 ✅（5 件 admin-ui 下沉）+ CHG-SN-4-05 ✅（后端 API + 058a）+ CHG-SN-4-05a ✅（ErrorCode 真源）+ CHG-SN-4-05b ✅（CONFLICT status）
- **下游解锁**：CHG-SN-4-10 milestone 收口卡（含 e2e + arch-reviewer A/B/C 评级）
- **可与 sn4-08 完全并行**（文件域零重叠）

#### 范围（详见 plan §5 + §8.1 第 5 张卡）

**共性约束实装（plan §5.0 六项）**：
1. **状态保留型筛选**（D-13 / §5.0.1）：替代 `setListRefreshKey`，复用 `useTableQuery`（已落地 `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx:431`）；含 URL params + sessionStorage 持久化（key 命名规范全小写点分隔 + 末段 `.v1`）
2. **键盘流作用域**（§5.0.2）：J/K/A/R/S 仅 ModerationConsole pending Tab 激活时启用；Modal/Drawer focus trap / input focus / 全局导航优先级
3. **失败回滚 + 乐观更新**（§5.0.3）：approve / reject-labeled / sources toggle / disable-dead / visibility patch / publish / staff-note PATCH 7 类操作
4. **LoadingState / ErrorState 接线**（§5.0.4）：复用 `@resovo/admin-ui` 已有原语 5 个接线点
5. **i18n key 规范**（§5.0.5）：`apps/server-next/src/i18n/messages/zh-CN/moderation.ts` 新建 + 全量 `t()` 调用（本期仅 zh-CN，但 key 必须经 `t()`）
6. **a11y 要求**（§5.0.6）：focus-visible / focus trap / aria-rowcount / 对比度 ≥ 4.5:1

**三 Tab 操作流程（plan §5.1 / §5.2 / §5.3）**：
- 待审核 Tab：队列加载 + 导航 + RejectModal + LinesPanel + LineHealthDrawer + StaffNoteBar 接线
- 待发布 Tab：发布就绪检查 + 退回审核
- 已拒绝 Tab：reopen + 历史查询

**API 接入**（消费 CHG-SN-4-05 已上线端点）：
- GET /admin/moderation/pending-queue（cursor 分页 + todayStats）
- POST /admin/moderation/:id/reject-labeled
- PATCH /admin/moderation/:id/staff-note
- GET /admin/moderation/:id/line-health/:sourceId
- POST /admin/staging/:id/revert
- PATCH /admin/videos/:id/sources/:sourceId
- POST /admin/videos/:id/sources/disable-dead
- GET /admin/review-labels

**Visual baseline**（plan §1190-1202 / 7 张）：建 `tests/visual/moderation/`

#### 文件作用域（不得越界）

```
apps/server-next/src/app/admin/moderation/page.tsx
apps/server-next/src/app/admin/moderation/_client/**           # ModerationConsole + 子组件全部
apps/server-next/src/lib/moderation/**                          # 新建；API 客户端 + hooks（按 ADR-110 §决策 4 feature 拆分）
apps/server-next/src/i18n/messages/zh-CN/moderation.ts          # 新建；i18n keys per §5.0.5
tests/unit/server-next/moderation/**                            # 新建
tests/visual/moderation/**                                      # 新建；7 张 visual baseline
docs/changelog.md                                               # 追加 CHG-SN-4-07 条目
docs/tracks.md                                                  # 仅自己 sn4-07-fe-moderation 区块（集成阶段更新）
```

**禁止触碰**（共享层冻结，违反即 BLOCKER）：
- `packages/admin-ui/**`（5 件下沉组件 + DataTable 已就位，本期不扩展；如必须新增组件 → BLOCKER）
- `packages/types/**`（ErrorCode 真源已统一；如需新类型 → BLOCKER 评估）
- `packages/design-tokens/**`
- `apps/api/**`（后端 API 已 freeze；如发现端点契约不足 → BLOCKER）
- `apps/worker/**`
- `apps/server-next/src/app/admin/videos/**`（sn4-08 持有）
- `apps/server-next/src/lib/videos/**`（sn4-08 可能扩展）
- `docs/decisions.md` / `docs/architecture.md`
- `docs/task-queue.md` Type B 字段（集成阶段串行）

#### 关键约束（plan §5.0 引用）

- **零硬编码颜色**：CSS 变量；CI grep 守门
- **零硬编码中文文案**：全部 `t()` 调用；CI grep 守门
- **`setListRefreshKey` 调用次数 = 0**：CI grep 守门 `grep -rE 'setListRefreshKey' apps/server-next/src/`
- **i18n key 命名规范**：CI grep 守门 `grep -rE 'admin\.moderation\.[^"]*\.(V[0-9]|v[0-9]+[A-Z])'` 应 0 命中
- **键盘流作用域**：J/K/A/R/S 在 input/textarea focus / Modal 打开时禁用（手工验证 + e2e）

#### 质量门禁

```bash
npm run typecheck       # 全 8 workspace 零报错
npm run lint            # turbo lint 全 pass
npm run test -- --run   # 246+ 文件 / 3045+ 测试不回归
npm run test:e2e        # 审核台属 ADMIN 类（详见 plan §5）— **本卡内必跑**
```

**Visual diff 7 张**（plan §1190-1202）：
- pending-queue.png（首屏 Gmail 流）
- reject-modal.png（标签字典 + reason 输入）
- line-health-drawer.png（线路健康历史）
- staff-note-bar-display.png + staff-note-bar-edit.png
- staging-tab-readiness.png
- rejected-tab-history.png

#### Step 表入口（具体 Step 由开发会话基于 plan §5.1/.2/.3 自行规划）

| Phase | 内容 | 依赖 | plan 引用 |
|---|---|---|---|
| A | 准备：lib/moderation/ API 客户端 + hooks 骨架 + i18n keys 文件 | 无 | §5.0.4 + §5.0.5 |
| B | 共性约束：useTableQuery + 键盘流 scope + LoadingState/ErrorState 接线 | A | §5.0.1-3 + §5.0.6 |
| C | 待审核 Tab：队列 + RejectModal + LinesPanel + LineHealthDrawer + StaffNoteBar 接线 | B | §5.1 |
| D | 待发布 Tab：发布就绪检查 + revert 接线 | B | §5.2 |
| E | 已拒绝 Tab：reopen + history | B | §5.3 |
| F | a11y + visual baseline 7 张 + e2e 关键流回归 | C-E | §5.0.6 + §1190-1202 |

#### 与 sn4-08 的协调点

- **共享层冻结**：双轨期内不动 packages/admin-ui / types
- **lib/api 客户端**：sn4-07 建 lib/moderation/，sn4-08 扩展 lib/videos/，路径不重叠
- **packages/types 错误码**：复用 ADR-110 已建 ERRORS / ErrorCode（13+1=14 码），双方都不改字典
- **集成顺序**：任一先完成即先集成；docs/changelog.md 末尾追加冲突按上次 sn4-05/-06 经验手工合并

#### 集成

- 集成 PR 标题：`track(sn4-07-fe-moderation): CHG-SN-4-07 审核台前端接入`
- PR 合并后：删除 `track/sn4-07-fe-moderation` 分支 / 更新 `docs/tracks.md` 本 Track 区块为 ✅ 已集成 / 本文件归档至 `docs/archive/tasks/`

---

## BLOCKER 区

> 本 Track 触发的 BLOCKER 写入此处（不写入主 docs/tasks.md / docs/task-queue.md）。
> 当前：无
