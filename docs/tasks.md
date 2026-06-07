# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### CHG-ENRICH-DOUBAN-CONSISTENCY-A — MediaCatalogService.safeUpdate 写侧：外部 ID fill-if-empty + 返回值语义
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260607-01
- **建议模型**：opus
- **执行模型**：claude-opus-4-8
- **子代理调用**：_（待填；commit 强制 `Subagents: arch-reviewer` trailer — 共享 service 契约改动）_
- **实际开始**：2026-06-07 12:30
- **文件范围**：`apps/api/src/services/MediaCatalogService.ts`（safeUpdate 优先级闸门 L334-340 改造 + metadata_source 条件传入 L427-430）；`tests/unit/api/mediaCatalogSafeUpdate.test.ts`（补例）
- **依赖**：CHG-ENRICH-DOUBAN-CONSISTENCY-ADR ✅（ADR-186）
- **问题理解 / 方案**：实施 ADR-186 D-186-1/2/3/5：① 外部 ID cache 列（doubanId/bangumiSubjectId）当前 NULL 时 fill-if-empty（封装 `EXTERNAL_REF_FIELD_KEYS`）② 优先级闸门逐字段放行——非 fillable 字段（含内容字段、非空外部 ID）进锁循环前剔除并计入 skippedFields；fillableKeys 空时维持整段 skip ③ **metadata_source 不降级**（仅 incomingPriority>=currentPriority 才传 metadataSource）④ exact 写侧复用不改 catalogExternalRefs.ts。
- **验收**：「外部 ID 字段当前 NULL 时低优先级源可填充，非 NULL/锁/exact 冲突受保护，metadata_source 不降级」单测全过（覆盖 ADR-186 测试要点②④⑦必修）；typecheck/lint/test:changed 绿。
- **完成备注**：_（完成后填写）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
