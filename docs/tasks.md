# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-22
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

<!-- M5-CLEANUP-04~10 已完成：commit b557463 -->
<!-- M5-CLEANUP-11 已完成：commit d85bf9e -->
<!-- 剩余：CLOSE-03（PHASE COMPLETE v2） -->
<!-- CLEANUP-08 字体规格 BLOCKER：design_system_plan 未明确具体字体族，body 已补 font-sans 系统回退链；具体字体选型（Inter/Noto 等）需人工确认后另起任务 -->

### M5-CLOSE-03 — M5 真·PHASE COMPLETE v2（真·真·闭环）
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260421-M5-CLEANUP-2
- **建议模型**：opus（主循环）+ arch-reviewer (claude-opus-4-6) 子代理（强制）+ 浏览器手动验收
- **执行模型**：claude-opus-4-7
- **子代理调用**：_（待填，预计 arch-reviewer claude-opus-4-6）_
- **实际开始**：2026-04-22
- **依赖**：CLEANUP-04 至 CLEANUP-11 ✅
- **文件范围**：
  - 新增 `docs/milestone_alignment_m5_final_v2_20260422.md`（v2 闭环对齐表 + 11 点审计签字 + 手动验收清单）
  - 修改 `docs/decisions.md`（追加 v2 签字条目，不修 ADR-037 §4b）
  - 修改 `docs/changelog.md`（追加 ★ M5 真·PHASE COMPLETE v2 ★）
  - 修改 `docs/task-queue.md`（解除 BLOCKER）
- **强制义务**：主循环负责"dev server 启动记录 + 9 项逐一走查结论 + 关键交互/日志摘要"；arch-reviewer 以此为"非静态审计一维"判据
- **验收**：11 点 PASS + typecheck/lint/unit/e2e 全绿 + 用户二次人工确认通过
- **完成备注**：_（完成后填写）_
