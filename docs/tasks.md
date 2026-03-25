# Resovo（流光） — 任务看板

> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 当前进行中（仅保留一条）




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

- **状态**：✅ 已完成
- **创建时间**：2026-03-24 00:00
- **计划开始时间**：2026-03-24
- **实际开始时间**：2026-03-25 00:00
- **完成时间**：2026-03-25 00:00
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

- **状态**：✅ 已完成
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

- **状态**：✅ 已完成
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

- **状态**：✅ 已完成
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

- **状态**：✅ 已完成
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

---

## P2 序列 — 前端用户体验质量补全

> 决策依据：`docs/priority-plan-20260324.md` 第七章
> 目标：修复颜色硬编码、补全浏览分页、补充前端测试覆盖

---

#### CHG-162 — 全站硬编码颜色修复

- **状态**：⬜ 待开始
- **创建时间**：2026-03-25 00:00
- **计划开始时间**：2026-03-25
- **实际开始时间**：_
- **完成时间**：_
- **目标**：将 `#f5c518`（金色）和 `#a0a0a0`（灰色）替换为对应 CSS 变量，消除深色模式兼容性风险
- **文件范围**：
  - `src/components/video/HeroBanner.tsx`
  - `src/components/video/VideoCard.tsx`
  - `src/components/video/VideoCardWide.tsx`
  - `src/components/video/VideoDetailHero.tsx`
  - `src/components/search/ResultCard.tsx`
- **变更内容**：
  - `#f5c518` → `var(--gold)`（5处）
  - `#a0a0a0` → `var(--muted-foreground)`（1处，VideoCardWide 连载状态徽章）
  - `rgba(0,0,0,0.7)` 半透明叠加层保留（非语义颜色）
  - `VideoMeta.tsx` 的 `var(--gold, #e8b84b)` 降级写法保留不改
- **DoD**：`grep -r "#f5c518\|#a0a0a0" src/components/video src/components/search` 无结果；现有测试通过
- **依赖**：无
- **回滚方式**：回退 CHG-162 提交
- **完成备注**：_

---

#### VIDEO-08 — 浏览页分页 UI

- **状态**：✅ 已完成
- **创建时间**：2026-03-25 00:00
- **计划开始时间**：CHG-162 完成后
- **实际开始时间**：2026-03-25
- **完成时间**：2026-03-25
- **目标**：在浏览页网格下方增加分页控件，使用户可以浏览第 2+ 页内容（当前每页 24 条）
- **文件范围**：`src/components/browse/BrowseGrid.tsx`
- **变更内容**：
  - 读取 URL `?page=N`（`buildSearchQuery` 已支持）
  - 在网格下方渲染分页区域：上一页 / 页码 / 下一页
  - 参考 `src/components/admin/Pagination.tsx` 样式，或内联轻量分页（不引入新依赖）
  - 点击翻页通过 `router.push()` 更新 `page` 参数，`FilterArea` 的筛选变化已会 `params.delete('page')` 重置
- **DoD**：有数据且 total > 24 时显示分页；点击翻页 URL 正确；单元测试覆盖分页渲染
- **依赖**：CHG-162
- **回滚方式**：回退 VIDEO-08 提交
- **完成备注**：修改 `src/components/browse/BrowseGrid.tsx`（+useRouter/usePathname/goToPage/pagination UI）；新建 `tests/unit/components/browse/BrowseGrid.test.tsx`（7 tests）；commit 9fff5f8

---

#### VIDEO-06 — 首页组件单元测试

- **状态**：✅ 已完成
- **创建时间**：2026-03-25 00:00
- **计划开始时间**：VIDEO-08 完成后
- **实际开始时间**：2026-03-25
- **完成时间**：2026-03-25
- **目标**：为 HeroBanner 和 VideoGrid 补充单元测试，覆盖 loading / 有数据 / 空数据三状态
- **文件范围**：
  - `tests/unit/components/video/HeroBanner.test.tsx`（新建）
  - `tests/unit/components/video/VideoGrid.test.tsx`（新建）
- **DoD**：测试覆盖三状态；现有 tests + 新增全通过
- **依赖**：VIDEO-08
- **回滚方式**：回退 VIDEO-06 提交
- **完成备注**：新建两个测试文件（HeroBanner 7 tests，VideoGrid 7 tests）；578 tests 全通过；commit 683b258

---

#### VIDEO-07 — 详情页组件单元测试

- **状态**：✅ 已完成
- **创建时间**：2026-03-25 00:00
- **计划开始时间**：VIDEO-08 完成后
- **实际开始时间**：2026-03-25
- **完成时间**：2026-03-25
- **目标**：为 VideoDetailClient 补充单元测试，覆盖 loading / notFound / 正常渲染三状态
- **文件范围**：`tests/unit/components/video/VideoDetailClient.test.tsx`（新建）
- **DoD**：测试三状态；通过 typecheck/lint/test
- **依赖**：VIDEO-08（可与 VIDEO-06 并行，但同序列顺序执行）
- **回滚方式**：回退 VIDEO-07 提交
- **完成备注**：新建测试文件（7 tests，覆盖 loading/404/正常渲染/showEpisodes/slug 提取）；commit bc8b4be

---

#### SEARCH-05 — 搜索页 E2E 补全

- **状态**：✅ 已完成
- **创建时间**：2026-03-25 00:00
- **计划开始时间**：VIDEO-07 完成后
- **实际开始时间**：2026-03-25
- **完成时间**：2026-03-25
- **目标**：补充搜索页 E2E 测试，覆盖 FilterBar→结果渲染→点击进入详情页 完整用户流程
- **文件范围**：`tests/e2e/search.spec.ts`（追加场景）
- **测试场景**：
  1. 输入关键词 submit → 结果列表渲染（mock `/search`）
  2. 点击结果卡片 → 跳转到正确的 `/movie/slug-shortId` 路由
  3. MetaChip 点击（年份）→ URL `year=` 参数出现（ResultCard 渲染 year MetaChip）
- **DoD**：三个场景 E2E 通过；覆盖 FilterBar→结果→导航链路
- **依赖**：VIDEO-07
- **回滚方式**：回退 SEARCH-05 提交
- **完成备注**：在 `tests/e2e/search.spec.ts` 追加 SEARCH-05 describe block（3 tests）；ResultCard href 链接到 /{type}/ 路由已验证

---

#### PLAYER-10 — 播放页 E2E + DanmakuBar 联通验证

- **状态**：✅ 已完成
- **创建时间**：2026-03-25 00:00
- **计划开始时间**：VIDEO-07 完成后
- **实际开始时间**：2026-03-25
- **完成时间**：2026-03-25
- **目标**：补充播放页 E2E 测试；核实 DanmakuBar 是否已接入 `/videos/:id/danmaku` API
- **文件范围**：`tests/e2e/player.spec.ts`（追加场景）
- **测试场景**：
  1. 访问 `/watch/slug-shortId?ep=1` → 播放页 shell 加载
  2. SourceBar 多线路时点击切换
  3. 检查 DanmakuBar 实现状态（read code + 记录结论）
- **DoD**：E2E 场景通过；DanmakuBar 联通状态写入任务完成备注
- **依赖**：VIDEO-07（可与 SEARCH-05 并行，但同序列顺序执行）
- **回滚方式**：回退 PLAYER-10 提交
- **完成备注**：
  - 追加 PLAYER-10 describe block（4 E2E tests）：shell 加载 / 多线路 SourceBar / 线路切换 / DanmakuBar 存在性
  - **DanmakuBar 联通状态**：✅ 完全接入。`useDanmaku` hook 从 `GET /videos/:id/danmaku` 拉取数据（sessionStorage 30min 缓存），`apiClient.postDanmaku` 持久化发送弹幕到 `POST /videos/:id/danmaku`（fire-and-forget，已登录时触发）。CCL `CommentManager` 渲染飞弹幕，ResizeObserver 追踪播放器尺寸变化。

---

#### CHG-175 — VideoType / VideoGenre 类型定义重写

- **状态**：⬜ 待开始
- **创建时间**：2026-03-25 10:00
- **计划开始时间**：SEQ-20260325-02 启动后第一步
- **实际开始时间**：_（AI 填写）_
- **完成时间**：_（AI 填写）_
- **变更原因**：`drama`/`documentary` 在 VideoType 和 VideoCategory 双重出现导致命名冲突，参见 `docs/db-rebuild-naming-plan.md`
- **影响的已完成任务**：VIDEO-01、CHG-38、CHG-163
- **文件范围**：`src/types/video.types.ts`
- **变更内容**：
  - VideoType：drama→series，short_drama→short，children→kids，game_show 并入 variety，共 11 种
  - 删除 VideoCategory；新增 VideoGenre 15 种（含 romance/war/family/biography/martial_arts/other，sci-fi→sci_fi）
  - 导出 VideoGenre 类型
- **DoD**：typecheck 通过；VideoCategory 引用为零；VideoGenre 可正常导入
- **完成备注**：_（AI 填写）_

---

#### CHG-176 — Migration 019：category→genre + type 值域重建

- **状态**：⬜ 待开始
- **创建时间**：2026-03-25 10:00
- **计划开始时间**：CHG-175 完成后
- **实际开始时间**：_（AI 填写）_
- **完成时间**：_（AI 填写）_
- **变更原因**：数据库字段名和 CHECK 约束需与新类型定义同步
- **影响的已完成任务**：INFRA-01（schema 初始化）
- **文件范围**：`src/api/db/migrations/019_rebuild_video_type_genre.sql`（新建）
- **变更内容**：
  - ALTER TABLE videos RENAME COLUMN category TO genre
  - UPDATE type 值：drama→series，short_drama→short，children→kids，game_show→variety
  - UPDATE genre 值：sci-fi→sci_fi，清空 drama/animation/documentary（题材迁移）
  - 重建 CHECK 约束（videos_type_check、videos_genre_check）
- **DoD**：migration 可幂等执行；执行后 DB schema 与新类型定义一致
- **完成备注**：_（AI 填写）_

---

#### CHG-177 — 后端查询层 + Zod schema 更新

- **状态**：⬜ 待开始
- **创建时间**：2026-03-25 10:00
- **计划开始时间**：CHG-176 完成后
- **实际开始时间**：_（AI 填写）_
- **完成时间**：_（AI 填写）_
- **变更原因**：查询层 DbVideoRow 字段名、mapVideoRow 映射、Zod enum 需与 Migration 019 同步
- **影响的已完成任务**：VIDEO-01、ADMIN-02
- **文件范围**：`src/api/db/queries/videos.ts`、`src/api/routes/admin/videos.ts`、`src/api/routes/public/videos.ts`（如有 category 参数）
- **变更内容**：
  - DbVideoRow：`category` 字段改为 `genre`
  - mapVideoRow：`category: row.category` 改为 `genre: row.genre`
  - admin/videos.ts Zod enum：VideoType 更新为 11 种新值，VideoCategory 改为 VideoGenre 15 种
  - 查询 SQL 中 `category` 列名全部改为 `genre`
- **DoD**：typecheck 通过；lint 通过；相关 API 测试通过
- **完成备注**：_（AI 填写）_

---

#### CHG-178 — 服务层写入逻辑更新

- **状态**：⬜ 待开始
- **创建时间**：2026-03-25 10:00
- **计划开始时间**：CHG-177 完成后
- **实际开始时间**：_（AI 填写）_
- **完成时间**：_（AI 填写）_
- **变更原因**：VideoService/CrawlerService 写入时使用旧字段名 category 和旧 type 值
- **影响的已完成任务**：VIDEO-01、CRAWLER-01、CHG-161
- **文件范围**：`src/api/services/VideoService.ts`、`src/api/services/CrawlerService.ts`、`src/api/services/SearchService.ts`（ES 索引字段）
- **变更内容**：
  - VideoService：create/update 路径中 category→genre，type 映射更新
  - CrawlerService：爬虫写入 type 时的映射规则（旧值→新值）
  - SearchService/ES mapping：category 字段名改为 genre
- **DoD**：typecheck 通过；写入路径测试通过；ES 索引字段与 DB 一致
- **完成备注**：_（AI 填写）_

---

#### CHG-179 — 前端类型标签与 Browse 筛选更新

- **状态**：⬜ 待开始
- **创建时间**：2026-03-25 10:00
- **计划开始时间**：CHG-178 完成后
- **实际开始时间**：_（AI 填写）_
- **完成时间**：_（AI 填写）_
- **变更原因**：前端 TYPE_LABELS、筛选下拉、Browse 页使用旧值域
- **影响的已完成任务**：VIDEO-05、VIDEO-08
- **文件范围**：`src/components/browse/BrowseFilters.tsx`、`src/components/admin/videos/`（type/genre 下拉）、`src/app/[locale]/browse/page.tsx`（参数解析）
- **变更内容**：
  - TYPE_LABELS：新增 series/short/kids/documentary，删除 drama/short_drama/children/game_show
  - 新增 GENRE_LABELS（15 种）
  - Browse 筛选参数：type enum、genre 筛选（替代 category）
  - Admin video 表单：type/genre 下拉选项更新
- **DoD**：typecheck 通过；Browse 页 type/genre 筛选正常工作；E2E BrowseGrid 测试通过
- **完成备注**：_（AI 填写）_

---

#### CHG-180 — 测试 fixtures + 测试用例更新

- **状态**：⬜ 待开始
- **创建时间**：2026-03-25 10:00
- **计划开始时间**：CHG-179 完成后
- **实际开始时间**：_（AI 填写）_
- **完成时间**：_（AI 填写）_
- **变更原因**：现有 factories.ts 和单元测试中大量引用 VideoCategory / 旧 VideoType 值
- **影响的已完成任务**：所有使用 factories.ts 的测试
- **文件范围**：`tests/helpers/factories.ts`、`tests/unit/**`（批量替换 VideoCategory 引用）
- **变更内容**：
  - factories.ts：VideoType 默认值改为 `series`；VideoCategory→VideoGenre，默认值 `action`
  - 单元测试：批量将 `drama` type 改为 `series`，`short_drama`→`short`，`children`→`kids`
  - 所有 `VideoCategory` import 改为 `VideoGenre`
- **DoD**：`npm run test -- --run` 全部通过；无 VideoCategory 导入残留
- **完成备注**：_（AI 填写）_

---

#### CHG-181 — 全量验收 + architecture.md 同步

- **状态**：⬜ 待开始
- **创建时间**：2026-03-25 10:00
- **计划开始时间**：CHG-180 完成后
- **实际开始时间**：_（AI 填写）_
- **完成时间**：_（AI 填写）_
- **变更原因**：命名重建完成后需全面验证、更新架构文档，确保 docs 与代码一致
- **影响的已完成任务**：全部 VideoType/VideoCategory 相关任务
- **文件范围**：`docs/architecture.md`、全量 typecheck/lint/test
- **变更内容**：
  - 运行 `npm run typecheck && npm run lint && npm run test -- --run`
  - 运行 `grep -r "VideoCategory" src/` 确认为零结果
  - 运行 `grep -r '"drama"\|"short_drama"\|"game_show"\|"children"' src/types/` 确认为零结果
  - 更新 `docs/architecture.md` 中 VideoType/VideoCategory 枚举表 → VideoType/VideoGenre
- **DoD**：全量检查零错误；architecture.md 与代码一致；`docs/db-rebuild-naming-plan.md` 状态更新为"已完成"
- **完成备注**：_（AI 填写）_
