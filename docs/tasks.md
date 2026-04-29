# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-29
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## CHG-SN-2-22 — stop-gate 质量债清零（P1×2 + P2×3 + gitignore）

- **状态**：🔄 进行中
- **创建时间**：2026-04-29 09:00
- **实际开始时间**：2026-04-29 09:00
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无

### 问题来源

Codex stop-gate adversarial review 在 M-SN-2 闭环后发现 5 个质量问题 + 1 个安全问题：

| 优先级 | 文件 | 描述 |
|---|---|---|
| P1 | `packages/admin-ui/src/shell/user-menu.tsx:173-179` | `handleItemClick` try/finally 无 catch，callback 抛出异常透传为 unhandled |
| P1 | `packages/admin-ui/src/components/data-table/selection-action-bar.tsx:78-83` | 引用 3 个不存在的 CSS token：`--accent-primary`/`--state-error`/`--bg-surface-hover` |
| P2 | `packages/admin-ui/src/components/data-table/data-table.tsx:256-263` | 根容器无 `role="grid"`，子节点 table role 孤立 |
| P2 | `packages/admin-ui/src/components/data-table/data-table.tsx:293-302` | 可排序列标题无 `tabIndex`/`onKeyDown`，键盘不可达 |
| P2 | `packages/admin-ui/src/shell/sidebar.tsx:70-77` | `BRAND_STYLE` 无 `height: var(--topbar-h)`，与 topbar 高度不对齐 |
| 安全 | `.gitignore` + `.playwright-mcp/` | 未 ignore 的本地浏览器快照含管理员身份数据 |

### 文件范围

- `packages/admin-ui/src/shell/user-menu.tsx`
- `packages/admin-ui/src/components/data-table/selection-action-bar.tsx`
- `packages/admin-ui/src/components/data-table/data-table.tsx`
- `packages/admin-ui/src/shell/sidebar.tsx`
- `.gitignore`

<!-- M-SN-2 milestone 已闭环（评级 A）。下一 milestone：M-SN-3 标杆页视频库。 -->
