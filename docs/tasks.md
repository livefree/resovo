# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### CHG-EXT-RES-UI-B — 外部资源浏览 Tab（热门资源 + 资源搜索）
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260607-04（卡 4-B）
- **建议模型**：opus
- **执行模型**：claude-opus-4-8
- **子代理调用**：无（复用 admin-ui 既有组件，零新共享契约）
- **实际开始**：2026-06-07 21:00
- **文件范围**：`apps/server-next/src/lib/external-resources/api.ts`（追加 fetchCollections/unifiedSearch + 类型）、`apps/server-next/src/app/admin/external-resources/_client/ExternalResourcesClient.tsx`（TABS 扩到 4 + 挂载 2 Tab）、`_client/CollectionsTab.tsx` + `_client/SearchTab.tsx`（新建）、`tests/unit/components/server-next/...`（视图单测追加）、`tests/e2e/...`（admin 域 e2e）
- **完成备注**：_（完成后填写）_

---

#### 卡 4-A 完成存档（CHG-EXT-RES-UI-A ✅ 2026-06-07 20:55）
- 已交付：采集中心 nav「外部资源」入口 + `/admin/external-resources` provider 框架（Segment + tab 容器 `?provider=&tab=`）+ api 取数层 + 概览 Tab（KpiCard + 采集/富集明细 + 合集新鲜度）+ 采集流水 Tab（DataTable + 过滤器）+ 13 视图单测。
- 门禁：typecheck/lint/test:changed 全绿。详见 changelog `[CHG-EXT-RES-UI-A]`。

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
