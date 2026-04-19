# Resovo（流光） — 任务看板

### TESTFIX-06 — 隔离清单 + CI 门禁 + test:guarded 脚本
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260418-M0.5
- **建议模型**：sonnet
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **实际开始**：2026-04-18
- **文件范围**：
  - 新增 `docs/known_failing_tests_phase0.md`
  - 修改 `scripts/verify-baseline.ts`（追加 diff 模式）
  - 新增 `scripts/test-guarded.ts`
  - 修改 `package.json`（追加 `test:guarded` script）
- **完成备注**：_（AI 填写）_


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-18
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

