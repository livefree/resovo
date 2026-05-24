# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-23

---

## 进行中任务

### CHG-SN-7-MISC-DOCS-CLEANUP-SESSION-CLOSE · 本会话 9 commit 后文档清理批次（4 sub-task 独立 commit）

- **状态**：🔄 进行中
- **序列**：SEQ-20260521-06 GAPS 高 ROI 闭合 / #68
- **创建时间**：2026-05-23
- **建议模型**：sonnet（纯文档归档 + 更新）
- **执行模型**：claude-opus-4-7（max effort 续会话）
- **子代理**：无（机械文档维护）
- **依赖**：12a0a37b + 25163216（PREDEV hook 收尾）

#### 范围（4 sub-task 独立 commit）

1. **task-queue.md SEQ-20260521-06 整段归档**
   - SEQ-06 已 7 卡 ✅（本会话 #61-67）+ 之前 60+ 卡（#1-60 全 ✅）
   - 全段 mv 到 `docs/archive/task-queue/task-queue_archive_SEQ-20260521-06_20260523.md`
   - task-queue.md 留 SEQ-06 容器 header + 归档声明 + 「下次新卡起新 SEQ-20260524-01」提示

2. **GAPS.md 更新本会话闭合项**
   - wish_list 500 ✅ 修复（dev DB migration sync）
   - user-submissions visual coverage 6/6（+ first-card / empty-state）
   - dev-migrate-check follow-up ✅ 闭合（predev hook 落地）
   - LinesPanel auto-select ❌ NEGATED 登记（player-idle baseline 长期 backlog）
   - admin-ui visual capture 基础设施 ✅ 修复（api-client 根因 fix）

3. **manual 内容更新**
   - P-user-submissions §FAQ：wish_list 500 已修说明（dev DB migrate 后正常）
   - 其他按需更新（visual baseline coverage 32 张统计）

4. **changelog.md 归档调查 + 决策**
   - 当前 3345 行 / 已 2 archive 文件（M-SN-2 ~ M-SN-7 + m0-m6）
   - 评估是否需进一步归档（如 SEQ-20260521 系列 mv 到独立 archive）
   - 给用户决策选项 / 或直接执行（按用户偏好）

#### 不在范围

- 业务代码改动
- spec / 测试 / baseline 改动
- ADR 起草 / 评审
- 新功能 / bug 修复

#### 验收

- typecheck + lint PASS（不动 code）
- 全 unit PASS 保持
- verify:adr-contracts 维持 ✅
- verify:manual-coverage PASS（manual 改动后核验）
- 各 sub-task 独立 commit 可追溯

#### 价值

- task-queue.md 清账（1719 行 → 减半左右）便于下次 milestone 看板浏览
- GAPS.md 状态准确反映本会话进展
- manual 同步 user-submissions 真实状态（避免新 contributor 误以为 wish_list 仍 broken）
- changelog 归档评估（即使不动也明确未来策略）

#### 工时估算

- sub-task 1（task-queue）：~0.15w
- sub-task 2（GAPS）：~0.05w
- sub-task 3（manual）：~0.1w
- sub-task 4（changelog）：~0.05w
- **总计：~0.35w**
