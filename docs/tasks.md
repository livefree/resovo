# Resovo（流光） — 任务看板

---

## 当前进行中（仅保留一条）

#### CHG-151 — 全量回归与文档收口（BLOCK 修复序列）

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 14:41
- **计划开始时间**：2026-03-22 14:46
- **实际开始时间**：2026-03-22 14:46
- **完成时间**：2026-03-22 14:47
- **目标**：完成 CHG-149/150 全量验收并闭环文档记录，结束本阻断修复序列。
- **范围**：
  - 全量 `typecheck/lint/test:run`
  - `docs/changelog.md`、`docs/run-logs.md`、`docs/tasks.md`、`docs/task-queue.md`
- **依赖**：CHG-150
- **DoD**：
  - 全量检查通过
  - `SEQ-20260322-03` 状态与任务时间戳完整
  - 文档记录与代码提交一致
- **回滚方式**：
  - 回退 CHG-151 文档提交
- **备注**：
  - `SEQ-20260322-03` 已完成，下一任务待分配。

---

#### CHG-152 — 提交未追踪文档

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：2026-03-22 15:00
- **实际开始时间**：2026-03-22 15:00
- **完成时间**：2026-03-22 15:00
- **目标**：将 branch_handoff_report.md、admin_ui_unification_plan.md、architecture-current.md 纳入版本控制
- **范围**：`docs/branch_handoff_report.md`、`docs/admin_ui_unification_plan.md`、`docs/architecture-current.md`
- **依赖**：CHG-151
- **DoD**：三个文件已提交，`git status` 无 `??`
- **回滚方式**：`git revert` 该 commit
- **完成备注**：commit `abe809a`；5 files changed；工作区干净

---

#### CHORE-02 — 执行 codex-takeover-20260319 → main --no-ff merge

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：2026-03-22 15:05
- **实际开始时间**：2026-03-22 15:02
- **完成时间**：2026-03-22 15:02
- **目标**：将分支合并入 main，保留完整 commit 历史
- **范围**：git merge 操作
- **依赖**：CHG-152
- **DoD**：merge 成功，main 上全量检查通过
- **回滚方式**：`git revert -m 1 <merge-commit>`
- **完成备注**：merge commit `31e3734`；298 files changed；main typecheck+test ✅

---

#### CHG-153 — watchdog 周期 sync 活跃 run + 独立心跳定时器

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：合并后
- **实际开始时间**：2026-03-22 15:03
- **完成时间**：2026-03-22 15:05
- **目标**：修复 run 列表滞后（NB-01）并补充 worker 独立心跳 timer（风险提示 A）
- **范围**：`crawlerRuns.ts`、`crawlerScheduler.ts`、`crawlerWorker.ts`、对应测试
- **依赖**：CHORE-02
- **DoD**：watchdog sync 活跃 run、worker timer 3min 心跳、测试覆盖
- **回滚方式**：回退 CHG-153 提交
- **完成备注**：commit `1688242`；4 files changed；533/533 tests ✅

---

#### CHG-154 — triggerSiteCrawlTask 迁移到 /runs 触发路径

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：合并后
- **实际开始时间**：2026-03-22 15:06
- **完成时间**：2026-03-22 15:07
- **目标**：统一单站触发调用 POST /admin/crawler/runs，消除双路径（NB-02）
- **范围**：`crawlTaskService.ts`、`crawler.ts`（POST /tasks 加 deprecated 注释）
- **依赖**：CHG-153
- **DoD**：单站触发走 /runs 路径，响应字段兼容，旧路由注释 deprecated
- **回滚方式**：回退 CHG-154 提交
- **完成备注**：commit `a2a9923`；2 files changed；533/533 tests ✅

---

#### CHG-155 — 批次 A 回归与文档收口

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：合并后
- **实际开始时间**：2026-03-22 15:07
- **完成时间**：2026-03-22 15:08
- **目标**：完成 SEQ-20260322-05 全量验收与文档闭环
- **范围**：`docs/changelog.md`、`docs/run-logs.md`、`docs/tasks.md`、`docs/task-queue.md`
- **依赖**：CHG-154
- **DoD**：typecheck/lint/test 通过，文档记录一致
- **回滚方式**：回退 CHG-155 文档提交
- **完成备注**：commit `e600e78`；SEQ-20260322-04/05 全部完成；533/533 tests ✅

---

#### CHG-156 — migration 012: crawler_tasks.started_at

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：批次 A 完成后
- **实际开始时间**：2026-03-22 15:09
- **完成时间**：2026-03-22 15:10
- **目标**：补充 task 实际开始时间字段（NB-04）
- **范围**：`012_add_task_started_at.sql`、`crawlerTasks.ts`、`crawler.ts`（mapTaskDto）
- **依赖**：CHG-155
- **DoD**：migration 幂等，mapTaskDto.startedAt 有值时不为 null
- **回滚方式**：回退 CHG-156 提交
- **完成备注**：commit `4c5d560`；3 files changed；533/533 tests ✅

---

#### CHG-157 — useAdminTableState defaultState ref 稳定化

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：批次 A 完成后
- **实际开始时间**：2026-03-22 15:10
- **完成时间**：2026-03-22 15:11
- **目标**：防止非 memoize defaultState 触发无限 re-render（NB-06）
- **范围**：`useAdminTableState.ts`
- **依赖**：CHG-156
- **DoD**：useRef 固定初始值，JSDoc 补充说明，现有测试通过
- **回滚方式**：回退 CHG-157 提交
- **完成备注**：commit `8290f48`；1 file changed；533/533 tests ✅

---

#### CHG-158 — docs 追踪规范补充

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：批次 A 完成后
- **实际开始时间**：2026-03-22 15:12
- **完成时间**：2026-03-22 15:12
- **目标**：CLAUDE.md 补充 docs/ 文档必须立即追踪的规范（NB-05）
- **范围**：`CLAUDE.md`
- **依赖**：CHG-157
- **DoD**：CLAUDE.md 新增对应规则条目
- **回滚方式**：回退 CHG-158 提交
- **完成备注**：commit `07dcbf5`；1 file changed；绝对禁止清单新增条目

---

#### CHG-159 — 批次 B 回归与文档收口

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：批次 A 完成后
- **实际开始时间**：2026-03-22 15:12
- **完成时间**：2026-03-22 15:13
- **目标**：完成 SEQ-20260322-06 全量验收与文档闭环
- **范围**：`docs/changelog.md`、`docs/run-logs.md`、`docs/tasks.md`、`docs/task-queue.md`
- **依赖**：CHG-158
- **DoD**：typecheck/lint/test 通过，文档记录一致
- **回滚方式**：回退 CHG-159 文档提交
- **完成备注**：SEQ-20260322-06 全部完成；533/533 tests ✅

---

## P1 优先级序列 — 内容流通管道修复与验证

> 决策依据：`docs/priority-plan-20260324.md`
> 目标：修复 ES 同步断链，建立"爬虫→DB→ES→前端可见"完整通路

---

#### CHG-160 — 修复 publish/batchPublish 缺失 ES 同步

- **状态**：⬜ 待开始
- **创建时间**：2026-03-24 00:00
- **计划开始时间**：2026-03-24
- **实际开始时间**：_
- **完成时间**：_
- **目标**：`publish()`、`batchPublish()`、`batchUnpublish()` 在 DB 更新后触发 `indexToES()`，消除发布动作与 ES 的同步断点
- **文件范围**：`src/api/services/VideoService.ts`
- **变更内容**：
  - `publish()` 在 DB 更新成功后调用 `void this.indexToES(id)`
  - `batchPublish()` 对每个已更新的 id 触发 indexToES（批量，fire-and-forget）
  - `batchUnpublish()` 同样触发（ES 需更新 `is_published: false`）
- **DoD**：发布/批量发布/下架后，ES 对应文档 `is_published` 字段同步更新；单元测试覆盖
- **依赖**：无
- **回滚方式**：回退 CHG-160 提交
- **完成备注**：_

---

#### CHG-161 — 爬虫写入 DB 后触发 ES 异步索引

- **状态**：⬜ 待开始
- **创建时间**：2026-03-24 00:00
- **计划开始时间**：CHG-160 完成后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：爬虫 insertCrawledVideo/updateExistingVideo 成功后，通过现有 Bull 队列异步投递 ES 索引任务，不阻塞爬虫主流程
- **文件范围**：`src/api/services/CrawlerService.ts`、`src/api/workers/crawlerWorker.ts`（或新建 es-sync Bull 队列处理器）
- **变更内容**：
  - 写入/更新视频后，向 Bull 队列投递 `{ type: 'index-video', videoId }` 任务
  - Worker 端处理：调用 VideoService.indexToES()（或内联 ES index 调用）
  - 注意：`is_published=false` 的视频也需索引（管理员搜索需要）；前台搜索 API 过滤 `is_published: true`
- **DoD**：爬虫写入后，ES 中出现对应文档；现有测试通过
- **依赖**：CHG-160
- **回滚方式**：回退 CHG-161 提交
- **完成备注**：_

---

#### ADMIN-07 — 管理后台视频列表增加来源站点筛选

- **状态**：⬜ 待开始
- **创建时间**：2026-03-24 00:00
- **计划开始时间**：CHG-161 完成后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：VideoFilters 新增"来源站点"下拉，按爬虫站点查看该站贡献内容的质量，辅助人工审核决策
- **文件范围**：
  - `src/components/admin/videos/VideoFilters.tsx`
  - `src/api/routes/admin/videos.ts`（GET /admin/videos 增加 `site_id` 参数）
  - `src/api/db/queries/videos.ts`（listAdminVideos 增加 site_id 过滤）
- **DoD**：站点筛选可用；后端 site_id 参数过滤正确；现有测试通过
- **依赖**：CHG-161
- **回滚方式**：回退 ADMIN-07 提交
- **完成备注**：_

---

#### ADMIN-06 — 管理后台内容质量统计视图

- **状态**：⬜ 待开始
- **创建时间**：2026-03-24 00:00
- **计划开始时间**：ADMIN-07 完成后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：提供按来源站点分组的数据质量统计，帮助管理员判断哪些站点内容可批量发布
- **文件范围**：
  - `src/api/routes/admin/analytics.ts`（新增 `GET /admin/analytics/content-quality` 端点）
  - `src/app/[locale]/admin/analytics/`（新增 quality-stats tab 或独立页）
- **统计维度**：
  - 按站点分组：总视频数 / 已发布 / 待审核
  - 字段覆盖率：有封面率、有简介率、有年份率
  - 源存活率（is_active=true 比例）
  - 合并命中数（video_aliases 条数）
- **DoD**：管理员可访问质量统计页；数据准确；测试覆盖 API
- **依赖**：ADMIN-07
- **回滚方式**：回退 ADMIN-06 提交
- **完成备注**：_

---

#### ADMIN-08 — 端对端内容流通 E2E 验证与收口

- **状态**：⬜ 待开始
- **创建时间**：2026-03-24 00:00
- **计划开始时间**：ADMIN-06 完成后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：编写/补全 E2E 测试覆盖完整发布流，验收 P1 序列成果
- **文件范围**：`tests/e2e/`（新增 publish-flow.spec.ts）
- **E2E 覆盖流程**：
  1. 管理员登录 → /admin/videos?status=pending → 看到待审核视频
  2. 发布单条视频 → 确认状态变更
  3. 前台搜索该视频 → 出现在结果中（验证 ES 同步）
  4. 进入详情页 → 基本信息完整
  5. 进入播放页 → 播放器组件正常加载
- **DoD**：E2E 测试通过；或完成人工验收并记录报告；文档更新
- **依赖**：ADMIN-06
- **回滚方式**：回退 ADMIN-08 提交
- **完成备注**：_
