# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### CHG-EXT-RES-API-B — 外部资源治理资源浏览端点（collections/search）
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260607-04（卡 3-B）
- **建议模型**：opus
- **执行模型**：claude-opus-4-8
- **子代理调用**：无（实施 ADR-188 D-188-5/D-188-6 既定授权）
- **实际开始**：2026-06-07 19:50
- **文件范围**：`apps/api/src/routes/admin/external-resources.ts`（加 collections + search 2 端点）、`apps/api/src/services/ExternalResourcesService.ts`（加 getCollections + unifiedSearch + live 并发1限流）、`apps/api/src/db/queries/externalData.ts`（dump 模糊搜索 query，D-188-6）、`tests/unit/...`（搜索/合集单测）
- **完成备注**：_（完成后填写）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
