# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### CHG-EXT-RES-UI-A — 外部资源治理页框架 + 观测 Tab
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260607-04（卡 4-A）
- **建议模型**：opus
- **执行模型**：claude-opus-4-8
- **子代理调用**：无（复用 admin-ui 既有组件，零新共享契约）
- **实际开始**：2026-06-07 20:15
- **文件范围**：`apps/server-next/src/lib/admin-nav.tsx`（采集中心加外部资源 item）、`apps/server-next/src/app/admin/external-resources/page.tsx` + `_client/ExternalResourcesClient.tsx`（provider Segment + tab 容器）+ `_client/OverviewTab.tsx` + `_client/ActivityTab.tsx`、`apps/server-next/src/lib/external-resources/api.ts`（apiClient 取数 + 类型）、`tests/unit/components/server-next/...`（视图单测）
- **完成备注**：_（完成后填写）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
