# Resovo（流光）— 任务序列池归档：SEQ-20260521-06 全段（2026-05-21 ~ 2026-05-23）

> 归档时间：2026-05-23
> 归档触发：CHG-SN-7-MISC-DOCS-CLEANUP-SESSION-CLOSE sub-task 1
> 范围：SEQ-20260521-06「GAPS 高 ROI 闭合（小卡批量）」整段 68 卡 ✅（含本卡 #68 归档自身）
> 来源：docs/task-queue.md line 769 - EOF（归档前 1719 行）
> 闭合状态：68 卡全 ✅（#1-67 + #68 归档卡自身）
>
> 完整 changelog 条目仍在 docs/changelog.md（本归档不重复 changelog 内容）
> 后续新卡：起新 SEQ-20260524-NN 序列号容器

---

## [SEQ-20260521-06] GAPS 高 ROI 闭合（小卡批量）

68. **CHG-SN-7-MISC-DOCS-CLEANUP-SESSION-CLOSE** · 本会话 9 commit 后文档清理批次 — 状态：🔄 进行中
    - **建议模型**：sonnet（纯文档归档 + 更新）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无
    - **范围**：4 sub-task 独立 commit
      - sub-task 1：task-queue.md SEQ-20260521-06 整段归档
      - sub-task 2：GAPS.md 更新本会话闭合项
      - sub-task 3：manual 内容更新（P-user-submissions / 其他）
      - sub-task 4：changelog.md 归档调查 + 决策
    - **关联**：12a0a37b + 25163216（PREDEV hook 收尾）
    - **不在范围**：业务代码 / spec / ADR / 新功能
    - **工时估算**：~0.35w

67. **CHG-SN-7-MISC-DEV-MIGRATE-CHECK** · npm run dev 前自动 migrate:check 巡检（防 dev DB schema 滞后）— 状态：✅ 已完成（2026-05-23 / commit 12a0a37b + 25163216）
    - **建议模型**：sonnet（package.json 单行 hook）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无
    - **范围**：package.json 加 `predev` npm lifecycle hook 跑 `migrate:check --silent || true`
    - **关联**：f22e7b4b（VISUAL-FOLLOWUP-2 实证 9 migration 落后导致 wish_list 500）
    - **不在范围**：dev.mjs 改 / 强制阻塞 / preflight.sh 替代
    - **工时估算**：~0.05w

66. **CHG-SN-7-MISC-VISUAL-FOLLOWUP-2** · 3 follow-up 收口（migration sync + seed + LinesPanel ADR 评估）— 状态：✅ 已完成（2026-05-23 / commit f22e7b4b）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无
    - **范围**：
      - wish_list 500 修复（npm run migrate 全跑 9 / 064-072）
      - dev DB seed 2 wish_list user_submissions
      - 5 张 user-submissions baseline（2 新 + 3 modified re-capture）
      - LinesPanel auto-select ADR 评估 ❌ NEGATED（ROI 低 / UX 决策守护）
    - **关联**：5993feb0（VISUAL-FOLLOWUP-BATCH）+ dev DB schema sync
    - **不在范围**：业务代码 / spec 修改 / LinesPanel 重构
    - **工时估算**：~0.1w

65. **CHG-SN-7-MISC-VISUAL-FOLLOWUP-BATCH** · 3 follow-up 合卡：admin-ui recapture + moderation player-idle + user-submissions fixup — 状态：✅ 已完成（2026-05-23 / commit 5993feb0）
    - **建议模型**：sonnet（capture + 可能 spec 微调）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无
    - **范围**：5 PNG 上限内（admin-ui 2 + moderation 1 + submissions 2）
    - **关联**：0e4e7098（VISUAL-BACKLOG-COMMIT）+ dev server :3003/:3001 仍跑
    - **不在范围**：业务代码 / schema / 端点 / dev DB seed / wish_list bug 修复
    - **工时估算**：~0.13w

64. **CHG-SN-7-MISC-VISUAL-BACKLOG-COMMIT** · 用户先前 capture 副作用 15 PNG 入库（visual coverage 历史 backlog 收口 / admin-ui 2 张错截已排除）— 状态：✅ 已完成（2026-05-23 / commit 0e4e7098）
    - **建议模型**：sonnet（纯 baseline 入库 / 不动 code / 不动 spec）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无（baseline 已 capture / 仅 review + git add）
    - **范围**：2 类 15 PNG（admin-ui 2 张排除 review 发现为登录页错截 git restore）
      - tests/visual/moderation/ 8 张 untracked（ae4ea66f spec 落地 baseline backlog）
      - tests/visual/admin-moderation/ 7 张 modified
    - **review 拦截**：admin-ui 2 张（line-health-drawer-default / reject-modal-default）capture 时 access token 失效 → middleware redirect /login → 错截登录页；git restore 恢复 pre-existing baseline；独立 follow-up CHG-SN-7-MISC-VISUAL-ADMIN-UI-RECAPTURE
    - **关联**：a000f59f（本卡 baseline 先入库）+ ae4ea66f（moderation spec 落地 / baseline 占位）
    - **不在范围**：spec 文件 / 业务代码 / moderation player-idle 缺张 / admin-ui 2 张 recapture
    - **工时估算**：~0.05w

63. **CHG-SN-7-MISC-VISUAL-BATCH** · CHG-SN-7-MISC-VISUAL-CRAWLER + VISUAL-SUBMISSIONS 合卡：2 visual spec 落地（共 13 张 baseline 占位 / capture 由用户手动触发 / REDO-01-J + REDO-02-F 软门收尾）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet（visual spec 撰写 / 同 moderation.visual.spec.ts 范式）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无（同 ae4ea66f moderation 9 张占位先例 / 不动 admin-ui 公开 API）
    - **范围**：
      - 新建 `tests/visual/crawler/crawler.visual.spec.ts` 7 test cases（kpi-row / timeline-card / site-list / site-row-expanded / advanced-menu / runs-list / page-header）
      - 新建 `tests/visual/user-submissions/user-submissions.visual.spec.ts` 6 test cases（page-header / segment-bad-src / segment-processed / first-card / pagination / empty-state）
      - 同 moderation 范式：`storageState: tests/visual/.auth/admin.json` + `expect.toHaveScreenshot(...)` + 头部注释含运行方式 + dev DB 前置 + capture 由用户手动 `npm run test:visual:update`
      - PLAYWRIGHT_VISUAL=1 env gate 保护（默认不参与 test:e2e）
    - **验收**：
      - ✅ typecheck PASS（spec 文件无语法错误）
      - ✅ `PLAYWRIGHT_VISUAL=1 npx playwright test --project=admin-visual --list` 列出 13 tests（spec parse OK）
      - ⏸ baseline PNG 不入库（dev server 起后 user 手动 capture / PR 内 review）
    - **关联**：REDO-01-J 软门验收扣 0.5（CHG-SN-7-REDO-01-J）+ REDO-02-F 软门验收扣 0.5（CHG-SN-7-REDO-02-F）→ spec 落地后 milestone audit 可正式归零
    - **不在范围**：起 dev server / 实际 capture baseline / 入库 PNG（按 ae4ea66f 范式留用户独立操作）
    - **工时估算**：~0.15w（合卡 / 实际 ~0.15w / 含 testid 收集 + 2 spec 撰写）

62. **CHG-SN-8-CHORE-ADR-146-D-N-CLOSE** · ADR-146 D-N 编号 advisory 清零（6 条）+ crawlerKpi.ts SQL subquery alias 修正（advisory 误报清零）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet（advisory 清零 + SQL alias rename / 无新决策）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无（机械文档补登记 + SQL alias 字面量替换）
    - **范围实际**：
      - `docs/changelog.md` ADR-146 起草条目 `D-N 偏离闭环` 段范围引用 `D-146-1..8` 展开为 8 行枚举（含语义摘要）；D-146-2/4/5/6/7/8 共 6 条新增明确闭环
      - `apps/api/src/db/queries/crawlerKpi.ts` SITE_STATS_SQL subquery alias `vs` → `rc`（3 处字面量替换）
    - **验收结果**：
      - ✅ verify-adr-d-numbers: 全部 150 条 D-N 闭环（144→150）
      - ✅ verify-sql-schema-alignment: queries SQL 引用列全部对齐
      - ✅ verify-endpoint-adr: 186 admin 路由 / 64 ADR 端点对齐保持
      - typecheck + lint PASS
    - **价值**：advisory 红线 2/3 升 ✅ / SEQ-20260521-06 chore 收尾 / milestone audit 准备
    - **工时估算**：~0.05w / 实际 ~0.05w

61. **CHG-SN-8-CHORE-DOCS-DRIFT-SYNC** · ADR-003 描述同步 AMENDMENT + MOD-PLAYER 状态修正（文档漂移收尾）— 状态：✅ 已完成（2026-05-23 / commit 9b58a1c3）
    - **建议模型**：sonnet（文档同步）
    - **执行模型**：claude-opus-4-7（续会话）
    - **子代理**：无（事实记录 / 引用既有 ADR-148 Opus A PASS + CHG-37）
    - **范围**：
      - `docs/decisions.md` ADR-003 末尾追加 AMENDMENT 2026-05-23 段（access TTL 15m → KV 驱动默认 60m + refresh 7d → 30d 事实同步）
      - `docs/task-queue.md` line 249 + 252-326 MOD-PLAYER 状态从 ⬜ + FIX-D 解锁 → ✅ 全 3 阶段闭合 commit cb29435e/56133915/ae4ea66f
    - **关联**：ADR-148 EP-A changelog 登记的「ADR-003 描述更新（独立小卡 / 不阻塞）」；M-SN-7 跟踪卡清账
    - **不在范围**：N1-148-1 / N1-148-2 独立 ADR / 代码改动
    - **工时估算**：~0.05w

60. **CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-B** · ADR-148 EP-B 前端 LoginSessions Tab disabled tooltip 提示（小卡收尾）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续 EP-A 会话）
    - **子代理**：无
    - **依赖**：ADR-148 ✅ + EP-A ✅（commit dd71d1a2）
    - **范围**：1 文件（LoginSessionsTab.tsx）
    - **关联 GAP**：#G-settings-session-fields-consume 完全闭合 + UX 透明化
    - **完成备注**：
      - timeoutMinutes hint 加「✅ 已生效（ADR-148 EP-A / commit dd71d1a2）」状态标识
      - sessionMaxConcurrent input 加 disabled + tooltip「需 user_sessions 表 + 踢出策略 ADR（N1-148-1）」+ hint「⏸ 即将支持」
      - sessionExtendOnActivity checkbox 加 disabled + tooltip「需 ADR-003 兼容性评估（N1-148-2）」+ hint「⏸ 即将支持」
      - 用户避免误以为 maxConcurrent/extendOnActivity 已生效（H1 零 mock + UX 透明范式）
      - typecheck + lint PASS
      - 现有 LoginSessionsTab.test 5/5 PASS（disabled 不影响 controlled value 测试）
    - **工时估算**：~0.1w / 实际 ~0.05w

59. **CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-A** · ADR-148 后端实施 session_timeout_minutes KV 消费 + R-148-4 user:rca TTL 同步 + 12 单测（#G-settings-session-fields-consume 完全闭合 2/2）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续 ADR 起草会话）
    - **子代理**：无（ADR-148 已 Opus A PASS commit e34b1229）
    - **依赖**：ADR-148 ✅ + auth.ts signAccessToken + UserService 4 caller + admin/users.ts user:rca 3 处写入
    - **范围**：5 代码 + 1 新测试（9 用例）+ 1 现有测试扩展（3 用例）+ 3 现有测试更新（EX=900 → 3600）+ 3 文档
    - **关联 GAP**：#G-settings-session-fields-consume（P2 安全）⚠️+🔄 → ✅ **完全闭合 2/2**
    - **完成备注**：
      - auth.ts signAccessToken 加可选 expiresIn 参数（默认 ACCESS_TOKEN_EXPIRES_IN '15m'，向后兼容）+ jsonwebtoken 类型断言 `as jwt.SignOptions`
      - UserService.getSessionTimeoutMinutes private helper：try-catch getSetting + Number 转换 + NaN 降级默认 60min + Math.max(5, Math.min(1440, x)) clamp 防护
      - 4 处 signAccessToken caller 改造（register/login/refresh/devLogin）传 `${ttl}m` 字符串
      - admin/users.ts R-148-4 修复：ROLE_CHANGED_CACHE_TTL_SECONDS 常量删除 + resolveRoleChangedCacheTtl helper（getSetting + try-catch 降级 + Math.max(900, minutes * 60) 下限保护）+ 3 处写入（ban / role 变更 / batch-ban）改用动态 TTL；batch-ban loop 外 await 一次复用
      - 12 新单测全 PASS：
        - auth.test.ts 加 3 用例（默认 '15m' / '30m' / '5m' expiresIn 参数）
        - user-service-session-timeout.test.ts 新建 9 用例（4 caller 集成 + KV 缺失/非数字降级 + clamp 边界 0/1/9999）
      - 3 现有测试更新 EX=900 → EX=3600（默认 60min default + R-148-4 max 下限）
      - 全 unit 4700/4701 PASS（1 pre-existing flaky 隔离 PASS / 与本卡 0 重叠）
      - typecheck + lint + verify:adr-contracts PASS
    - **行为变更**：access token TTL 从硬编码 15m → KV 驱动默认 60m；user:rca Redis TTL 从硬编码 900s → max(900, session_timeout_minutes * 60) 动态
    - **不在范围**：
      - maxConcurrent 消费（独立 ADR / N1-148-1）
      - extendOnActivity 消费（独立 ADR / N1-148-2）
      - KV Redis cache 升级（N1-148-3）
      - ADR-003 描述更新（独立小卡 / 不阻塞）
      - LoginSessions Tab UI disabled tooltip（EP-B 可选 / 不阻塞）
    - **工时估算**：~0.5w / 实际 ~0.5w（含 R-148-4 同步修复 + 3 现有测试更新 + try-catch 降级范式）

58. **CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-ADR** · ADR-148 起草（session 3 KV 字段中间件消费协议）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（D-148-1..8 完整 / 12 测试 surface / 4 风险 / 4 N1 / MVP 范围控制：仅 timeoutMinutes / maxConcurrent + extendOnActivity 推 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 C UserService.getSessionTimeoutMinutes helper + 方案 A 每次查 DB（QPS < 10） + 方案 C 双重防护（zod + clamp + NaN） + maxConcurrent/extendOnActivity 推 N1 + R-148-4 ADR-139 user:rca Redis TTL 同步修复（EP-A 一并完成）
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-148 11 节完整正文；8 D-N 决策 + 端点契约 + R-MID-1 零新增确认 + 12 测试 surface + 4 风险 + 4 N1
      - 关键发现 **R-148-4**：ADR-139 `user:rca` Redis TTL 硬编码 900s（= 旧 access token 15m），动态化 timeout 后会出现 max(0, timeout - 900) 秒的权限穿越窗口；EP-A 一并修复（user:rca TTL → `Math.max(900, session_timeout_minutes * 60)`）
      - MVP 范围控制：仅消费 timeoutMinutes（1 KV）；maxConcurrent（需 user_sessions 表 + 踢出策略）+ extendOnActivity（需 ADR-003 兼容评估 + authenticate plugin 改造）独立 N1
      - 与 ADR-003 张力：access token TTL 默认 15m → 60m（KV seed 一致）；属"有意行为变更"
      - 8 条 D-148-N 完整 + 4 关联 ADR（ADR-003 直接修改 / ADR-139 R-148-4 兼容性 / ADR-121 无变更 / ADR-146 同期 KV 消费范式）
      - GAPS.md #G-settings-session-fields-consume ⬜/🔄 → ⚠️+🔄
      - verify-endpoint-adr PASS（零新端点）
    - **关联 GAP**：#G-settings-session-fields-consume（P2 安全）⬜/🔄 → ⚠️+🔄（ADR ✅ 2/3 / 实施 3/3 待立）
    - **工时估算**：~0.15w / 实际 ~0.2w（含 Opus 1 轮评审 + R-148-4 增量发现）

57. **CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B** · ADR-147 前端实施 admin shell SWR 接入 + localStorage read + 5 单测（#G-shell-notifications 完全闭合 3/3）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续 EP-A 会话）
    - **子代理**：无（消费 EP-A 后端 + ADR-147 既定决策）
    - **依赖**：EP-A ✅（commit 1784a943）+ admin-ui AdminShell 现有 props 契约
    - **范围**：4 代码 + 1 测试（5 用例）+ 3 文档
    - **关联 GAP**：#G-shell-notifications（P1）⚠️+🔄 → ✅ **完全闭合** 3/3
    - **完成备注**：
      - admin-shell-notifications.ts 新建（useAdminNotifications + useAdminTasks 双 hook + apiClient.get 复用 + 60s setInterval polling + cleanup + localStorage lastViewedAt + readIds Set session）
      - admin-shell-client.tsx mock → hook（删 mockNotifications/mockTasks import + handleMarkAllNotificationsRead 改 markAllRead from hook + handleNotificationItemClick 改 markOneRead）
      - cancel/retry 改 toast 占位（CrawlerRun cancel + bull retry 端点 N1-147-4 后端待加；维持现有 UX）
      - shell-data.tsx 删 mockNotifications/mockTasks exports + 清 unused NotificationItem/TaskItem import
      - 5 新单测 PASS（mount fetch / lastViewedAt 已读判定 / markAllRead 写 localStorage + 全部 read=true / markOneRead session readIds 不影响其他 / degraded 暴露）
      - read 状态前端计算：`readIds.has(id) || createdAt <= lastViewedAt`（markOneRead 仅 session 弱反馈，不持久化）
      - 零新依赖（不引入 SWR / 复用 apiClient 标准 fetch wrapper）
      - 全 unit 4688/4689 PASS（1 pre-existing flaky 隔离 PASS / 与本卡 0 重叠）
      - typecheck + lint PASS
    - **不在范围**：
      - CrawlerRun cancel + bull retry 真后端端点（N1-147-4 / 按需启动）
      - per-user DB read 表（ADR-147 N1-147-1 / admin 多人协作时触发）
      - SSE 实时推送（ADR-147 N1-147-3 / 同时在线 > 20 时触发）
    - **工时估算**：~0.10w / 实际 ~0.15w（含 markOneRead readIds Set 设计重构 1 轮）

56. **CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A** · ADR-147 后端实施 + 14 单测（admin shell notification hub MVP）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7（续 ADR 起草会话）
    - **子代理**：无（ADR-147 已 Opus A PASS commit 2a8bc91a）
    - **依赖**：ADR-147 ✅ + admin-ui SSOT NotificationItem/TaskItem ✅ + admin_audit_log + crawler_runs + bull queue
    - **范围**：6 代码 + 2 测试文件（14 用例）+ 4 文档
    - **关联 GAP**：#G-shell-notifications（P1）⚠️+🔄 → ⚠️+🔄 **后端 + ADR 闭合**（剩 EP-B 前端 ~0.10w）
    - **完成备注**：
      - packages/types/admin-shell.types.ts 新建（AdminNotificationItem + AdminTaskItem + Response 信封 + AdminQueueCounts）；types/index.ts export
      - NotificationService（白名单 ReadonlySet 8 类 + LEVEL/HREF/TITLE 三 Map + list 方法 SQL ANY 子查询 + COUNT）
      - TaskAggregator（CrawlerRun mapper readonly-friendly + bull active mapper + Redis try-catch 降级 + id 前缀防冲突 + progress 0-100 clamp）
      - 2 route（notifications + system-jobs）+ server.ts 注册
      - ADR-147 §4 加 sub-heading 触发 verify-endpoint-adr 识别（186 admin 路由 ↔ 63 ADR 端点对齐）
      - 14 新单测全 PASS（NotificationService 9：白名单 + 8 类完整 + level/href 映射 + 时间窗口 + limit + 401/200 endpoint；TaskAggregator 5：CrawlerRun running/failed + Redis 降级 + bull progress clamp + endpoint queueCounts）
      - vi.hoisted 范式避免 mock hoisting 错误
      - 零 R-MID-1 新增 / 零 ErrorCode / 零 migration / 零新依赖
      - 全 unit 4683/4684 PASS（1 pre-existing flaky use-filter-presets.test.ts 隔离 7/7 PASS / 与本卡无关）
      - typecheck + lint + verify:adr-contracts PASS
    - **不在范围**：前端 SWR hooks + admin-shell-client 接入（留 CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B ~0.10w / 4 文件）
    - **工时估算**：~0.20w / 实际 ~0.25w（含 ADR §4 sub-heading 修复 + vi.hoisted 范式适配 + TS readonly 修复 1 轮）

55. **CHG-SN-8-FUP-SHELL-NOTIFICATIONS-ADR** · ADR-147 起草（admin shell notification hub MVP）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（D-147-1..8 完整 / 14 测试 surface / 5 风险 / 4 N1 / MVP 范围 + 现有基础设施复用最大化）
    - **方案选型**：spawn Opus 1 轮；选方案 A audit_log 子集映射（8 类白名单 actionType + level/href 映射，零新表）+ 方案 A 前端 polling 60s + 方案 C 有主次 tasks 数据源（CrawlerRun 主 + bull active 副 + Redis 降级）+ 方案 A localStorage lastViewedAt read（零 per-user DB read）+ 零 R-MID-1 新增 + 零新依赖 + 2 新端点（GET /admin/notifications + GET /admin/system/jobs）
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-147 11 节完整正文；8 D-N 决策 + 端点契约 + R-MID-1 零新增确认 + 14 测试 surface + 5 风险 + 4 N1
      - 关键设计：audit_log 已覆盖 39 actionType → notifications 派生（零表/零 migration/零双写）；CrawlerRun + bull active 双源去重（CrawlerRun 优先）；polling 60s（admin <10 人，0.17 QPS/人 + idx 覆盖）；localStorage lastViewedAt（MVP 单人 admin 场景 OK，跨设备需求弱）
      - GAPS.md #G-shell-notifications ⬜/🔄 → ⚠️+🔄；ADR-147 决策 + 实施 follow-up 完整说明
      - verify-endpoint-adr 184 admin 路由全部对齐（2 新端点登记 ADR-147 待 EP-A 落地）
    - **关联 GAP**：#G-shell-notifications（P1）⬜/🔄 → ⚠️+🔄（ADR ✅ 2/3 / 实施 3/3 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审）

54. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.4** · ADR-146 storage.r2.alert R2 quota cron 触发点接入（4/5 触发点闭合 + 框架 100%）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A ✅ + EP-A2.3 cron 范式 ✅ + @aws-sdk/client-s3 ^3.717 已装
    - **范围**：2 文件代码（maintenanceScheduler 加 runR2QuotaTick + 注册 setInterval + getSchedulerStatus / types SystemSettingKey 扩 2 KV key）+ 2 文档（GAPS / P-settings §3.7）
    - **关联 GAP**：#G-settings-webhook-impl 3/5 → 4/5 触发点闭合 + 框架 100%（剩 1 触发点 EP-A2.2 外部依赖）
    - **完成备注**：
      - runR2QuotaTick：6h 间隔 / ListObjectsV2 分页累加 Size / bucket=R2_IMAGES_BUCKET / 阈值 50 GB 默认 / usagePercent > 80% 触发 / 12h debounce 防风暴（ADR-146 R-146-3）
      - 10 万 keys partial 上限保护（R2_LIST_MAX_ITERATIONS=100）— 超出 partial 数据告警（保守估计反而符合预警目的）
      - payload 对齐 ADR-146 D-146-7：`{ usagePercent, usageBytes, threshold, bucket, checkedAt }`
      - SystemSettingKey 扩 2 KV key（notification_r2_quota_threshold_bytes / notification_r2_last_alert）
      - getSchedulerStatus 加 r2-quota-check 条目
      - R2 env 未配（R2_ENDPOINT/ACCESS_KEY/SECRET_KEY 任一缺失）跳过 tick；零本地开发噪音
      - try/catch 兜底 webhook 失败不阻塞 scheduler 退出
      - 零新依赖（@aws-sdk/client-s3 复用 ImageStorageService 同 SDK）
      - 零新单测（依赖现有 webhook framework 17 用例 + R2 SDK 行为）
      - 全 unit 4669/4670 PASS（1 pre-existing flaky CrawlerClient.test.tsx 隔离 62/62 PASS / 与本卡无关）
      - typecheck + lint + verify:adr-contracts PASS（184 admin 路由 ↔ 61 ADR 端点对齐）
    - **不在范围**：submission.created EP-A2.2（外部依赖待用户端 POST 实装）
    - **工时估算**：~30 min / 实际 ~30 min

53. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.3** · ADR-146 moderation.pending.threshold cron 触发点接入（maintenanceScheduler 1h tick + 1h debounce）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A ✅ + EP-A2.1 ✅
    - **范围**：2 文件代码（maintenanceScheduler 加 tick + dispatcher 触发 + types SystemSettingKey 扩 2 KV）
    - **关联 GAP**：#G-settings-webhook-impl 3/5 触发点闭合
    - **完成备注**：
      - runPendingThresholdTick：1h 间隔 / SQL COUNT pending_review / KV threshold 默认 50 / KV last_alert 1h debounce 防风暴（ADR-146 R-146-3）
      - 不入 maintenanceQueue（轻量 SQL + KV 直接执行）
      - getSchedulerStatus 新增 pending-threshold-check 条目
      - SystemSettingKey 扩 2 KV key（notification_pending_threshold / notification_pending_last_alert）
      - 全 unit 4670/4670 PASS
    - **工时估算**：~20 min / 实际 ~20 min

52. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.1** · ADR-146 CrawlerRun.failed 触发点接入（最小侵入 worker 1 处）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A ✅ + EP-A2 ✅
    - **范围**：2 文件代码（query 加 RETURNING + 返回类型 + worker finally 块接入触发）
    - **关联 GAP**：#G-settings-webhook-impl 2/5 触发点闭合
    - **完成备注**：
      - syncRunStatusFromTasks 加 RETURNING + SyncRunStatusResult interface（8 处 worker 调用方 zero-impact）
      - crawlerWorker.ts finally 块 status=failed/partial_failed 时 webhook 触发
      - try/catch 兜底 webhook 失败不阻塞 worker 退出
      - 零新单测（复用 webhook framework 测试 14+3 = 17 用例覆盖）
      - 全 unit 4670/4670 PASS（0 失败）
    - **工时估算**：~15 min / 实际 ~15 min

51. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2** · ADR-146 触发点接入（StagingPublishService 1 触发点 + framework 集成 3 单测）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A ✅ + EP-B ✅
    - **范围**：3 文件（StagingPublishService 注入 dispatcher + enqueue 调用 + Route 实例化 + 3 单测）
    - **关联 GAP**：#G-settings-webhook-impl 后端核心 + UI → 1/5 触发点闭合（剩余 4 触发点 follow-up）
    - **完成备注**：
      - optional dispatcher 注入范式（系统 Job 不发，避免 cron 噪音）
      - payload 6 字段（operationType + totalCount + successCount + failedCount + publishedIds + skippedIds）
      - 3 单测验证 framework 集成正确
      - 全 unit 4670/4670 PASS（0 失败）
    - **不在范围**：CrawlerRun.failed EP-A2.1 ~30 min / submission.created EP-A2.2 等用户端 / R2 quota + pending threshold cron EP-A2.3 ~40 min
    - **工时估算**：~15 min / 实际 ~20 min

50. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B** · ADR-146 前端实施（NotificationsTab 5 事件订阅 + 连通性测试按钮 + 4 单测）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-146 ✅ + EP-A 后端端点 ✅（commit f8a57462）
    - **范围**：8 文件（webhook-api lib 新建 + NotificationsTab 改 + siteConfig zod/mapper + systemSettings 读 mapper + types 扩 + v1 fixture 同步 + 4 新单测）
    - **关联 GAP**：#G-settings-webhook-impl 后端核心 → 后端核心 + 前端 UI ✅（5 触发点接入 EP-A2 follow-up 待）
    - **完成备注**：
      - webhook-api.ts lib（testWebhook + WEBHOOK_EVENT_TYPES enum + WEBHOOK_EVENT_LABELS）
      - NotificationsTab 加 webhookEvents state + toggleEvent handler + 5 checkbox enum 驱动渲染 + 「连通性测试」按钮 + handleTestWebhook（dirty 守卫 + 成功/失败 toast）
      - siteConfig zod schema notificationWebhookEvents enum array + mapper 写 KV（去重 Set）
      - systemSettings 读 mapper 加 parseWebhookEvents helper（JSON 解析失败降级 []）
      - types SiteSettings 扩字段 + v1 fixture 同步
      - 4 新单测 PASS（5 checkbox 渲染 / 勾选 dirty + 保存透传 / 测试按钮 disabled 当 dirty / click + success toast）
      - 全 unit 4667/4667 PASS / typecheck/lint PASS
    - **工时估算**：~30 min / 实际 ~30 min

49. **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A** · ADR-146 后端核心实施（R-MID-1 第 25 次 + WebhookDispatcher + ssrf-guard + 测试端点 + 16 单测）— 状态：✅ 已完成（2026-05-23）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-146 已 Opus A PASS commit 07b142ca）
    - **依赖**：ADR-146 ✅（commit 07b142ca）+ AuditLogService + crypto + system_settings 表
    - **范围**：10 文件后端（4 R-MID-1 真源 + ssrf-guard + WebhookDispatcher + Route + server.ts + 16 单测）
    - **关联 GAP**：#G-settings-webhook-impl ⚠️+🔄 → ✅ 后端核心闭合（5 触发点接入 + 前端 UI follow-up 待）
    - **完成备注**：
      - R-MID-1 第 25 次 7 文件 checklist 完整闭环（types union + ACTION_TYPES + 2 set-equal 测试 + Dispatcher audit fire-and-forget）
      - ssrf-guard 5 层防御独立模块（https only + RFC 1918 + loopback + link-local + 云元数据）
      - WebhookDispatcher：enqueue fire-and-forget + dispatch retry [5s/15s/45s] + jitter + 30s 超时 + HMAC sha256= + 4 自定义 header + 最终失败 audit + sendTest 单次不重试
      - POST /admin/webhook/test admin auth + 422/200 完备
      - 16 单测全 PASS（14 dispatcher + 2 endpoint）
      - 全 unit 4661/4663 PASS（2 pre-existing flaky 隔离 PASS）
      - typecheck/lint/verify:adr-contracts PASS（184 admin 路由全部对齐 61 ADR 端点）
    - **不在范围**：5 触发点接入 → CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2 ~25 min / 前端 NotificationsTab → CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B ~30 min
    - **工时估算**：~1.5h / 实际 ~1h（含 R-MID-1 真源同步 + ssrf-guard 5 层 + Dispatcher 完整 + 16 测试 + flaky 边界确认）

48. **CHG-SN-8-FUP-WEBHOOK-IMPL-ADR** · ADR-146 起草（admin webhook 通知触发协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-146-1..8 完整 / 16 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 B 事件 enum + 用户多选订阅（不引入多端点表）+ 5 事件枚举（crawler/storage/moderation/submission/video）+ 方案 A 修正版 fire-and-forget Dispatcher（不用 bull 避免 Redis 依赖）+ HMAC-SHA256 + retry + SSRF 5 层防御 + R-MID-1 第 25 次 + 唯一新端点 POST /admin/webhook/test
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-146 11 节完整正文；8 D-N 决策 + WebhookDispatcher sketch + R-MID-1 7 文件 checklist + 16 测试 surface + 4 风险 + 2 N1
      - 关键设计：bull 已装但不用（避免 Redis 依赖与 Resovo 当前架构对齐）；fire-and-forget Dispatcher 与 AuditLogService 同模式；HMAC sha256= 前缀对齐 GitHub 行业惯例；SSRF 5 层独立模块（apps/api/src/lib/ssrf-guard.ts）
      - verify-endpoint-adr 183 admin 路由全部对齐 61 ADR 端点
      - GAPS.md #G-settings-webhook-impl ⚠️ → ⚠️+🔄；P-settings §3.7 完整重写
    - **关联 GAP**：#G-settings-webhook-impl（P3） ⚠️ → ⚠️+🔄（消费层 warn banner ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.25w / 实际 ~0.3w（含 Opus 1 轮评审）

47. **CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B** · ADR-145 前端实施（VideoEditDrawer 双模式 + 按钮 enable + 3 单测）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-145 ✅ + EP-A 后端端点 ✅（commit b483a59b）
    - **范围**：4 文件（lib createVideo 封装 + Drawer 双模式 + VideoListClient drawerTarget 三态 + 3 新单测）
    - **关联 GAP**：#G-videos-add ⚠️+🔄 → ✅ 完全闭合 4/4
    - **完成备注**：
      - lib createVideo 封装 + ManualAddVideoInput/Result/PublishMode 类型
      - Drawer isCreating 判定 + useEffect 双路径 + handleSubmit 分支 + render header/footer/tab 文案变化
      - VideoListClient drawerTarget 三态 'closed' | null | string（避免 null 双义）
      - PageHeader 「+ 手动添加视频」按钮 enable
      - 3 新单测 PASS（创建模式 header + 提交 + tab disabled）
      - 全 unit 4644/4645 PASS（1 pre-existing flaky 隔离 PASS）
    - **工时估算**：~40 min / 实际 ~50 min（含 form 字段转换 typecheck 修正）

46. **CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A** · ADR-145 后端实施（R-MID-1 第 24 次 + VideoService 重构 + Route + 20 单测）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-145 已 Opus A PASS commit 5dcc897f）
    - **依赖**：ADR-145 ✅（commit 5dcc897f）+ MediaCatalogService.findOrCreate + createVideo + transitionVideoState
    - **范围**：7 文件后端（types union + AuditLogService + 2 set-equal + Service 重构 + Route schema + 20 单测）
    - **关联 GAP**：#G-videos-add ⚠️+🔄 → ✅ 后端闭合（前端 follow-up 待）
    - **完成备注**：
      - VideoService.create 重构：findOrCreate + 重复检测 SELECT count + force 跳过 + publishMode 三路径状态机 + R-MID-1 audit fire-and-forget
      - 新增 ManualAddVideoInput / VideoPublishMode / VideoManualAddResult 类型 + VideoManualAddConflictError 异常
      - Route ManualAddVideoSchema + 409 STATE_CONFLICT detail（existingVideoId + existingTitle）
      - R-MID-1 第 24 次 7 文件 checklist 完整闭环
      - 修复 ADR-145 §1 列出 6 项现有技术债（绕过 catalog / 无类型 / 零 audit / 零重复检测 / 无 publishMode / locked_fields 不保护）
      - 20 新单测 PASS（含 audit payload 内容断言 4 个用例 + 422/403/409 三态不写 audit）
      - 全 unit 4641/4642 PASS（1 pre-existing flaky 隔离 PASS）
    - **不在范围**：前端 VideoEditDrawer 双模式 + 按钮 enable（留 CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B ~40min）
    - **工时估算**：~0.2w / 实际 ~0.3w（含 elasticsearch mock 边界排查）

45. **CHG-SN-8-FUP-VIDEO-MANUAL-ADD-ADR** · ADR-145 起草（admin 手动添加视频端点协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-145-1..8 完整 / 20 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 C 最小 3 字段（title/type/contentRating）+ 14 元数据 optional + 方案 B 重复检测（findOrCreate isNewlyCreated + force 跳过）+ 方案 B catalog 复用 findOrCreate(metadataSource='manual')+ 方案 C publishMode 三路径 + 方案 A VideoEditDrawer 双模式 + 零新 ErrorCode（复用 STATE_CONFLICT）+ R-MID-1 第 24 次 video.manual_add
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-145 11 节完整正文；8 D-N 决策 + 端点 sketch + R-MID-1 7 文件 checklist + 20 测试 surface + 4 风险 + 2 N1
      - 修复 6 项现有 POST /admin/videos 技术债（不是新增端点而是重构）
      - 8 条 D-145-N 在本卡 changelog 完整闭环
      - GAPS.md #G-videos-add ⚠️ → ⚠️+🔄；P-videos §3.5 完整重写
      - verify-endpoint-adr PASS（183 admin 路由全部对齐 60 ADR 端点）
    - **关联 GAP**：#G-videos-add（P2） ⚠️ → ⚠️+🔄（消费层 disabled btn ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审）

44. **CHG-SN-8-FUP-PRESET-TEAM-EP-B** · ADR-144 前端实施（DB 双源 + scope badge + import 入口）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-144 既定决策 / 消费 EP-A 后端端点）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：ADR-144 ✅ + EP-A ✅（commit 0bf0b36c）
    - **范围**：5 文件（lib api 新建 + hook 改 async + Console 透传 + Popover 加 badges/import + 5 SWR 测试）+ 1 旧测试迁移说明
    - **关联 GAP**：#G-moderation-preset-team ⚠️+🔄 → ✅ 完全闭合 4/4
    - **完成备注**：
      - filter-presets-api.ts 4 端点封装
      - hook 改 async + 双源 fallback（fetch 失败保留 localStorage offline 兜底）+ importLocalToServer + dataSource/localPendingCount 状态
      - ModerationConsole 4 handler 加 try/catch 兜底
      - Popover live/local badge + 团队 shared badge + 「导入本地 (N)」按钮
      - 5 新 SWR 单测 + 5 过时 CRUD 测试迁移说明
      - 全 unit 4623/4625 PASS / typecheck + lint PASS
      - 零新依赖（使用仓内 useEffect+fetch；不引入 SWR 避免 BLOCKER）
    - **不在范围**：SavePresetModal scope picker / 列表行 scope 切换 UI（留 follow-up CHG-SN-8-FUP-PRESET-TEAM-EP-C 按需 ~0.05w）
    - **工时估算**：~0.2w / 实际 ~0.2w（含 5 旧测试迁移 + jsdom env 修复）

43. **CHG-SN-8-FUP-PRESET-TEAM-EP-A** · ADR-144 后端实施（migration + DB + Service + Route + R-MID-1 第 21-23 次系统化 + 18 单测）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-144 既定决策 / 复用全栈）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-144 已 Opus A PASS commit b1585847）
    - **依赖**：ADR-144 ✅（commit b1585847）
    - **范围**：10 文件后端（2 migration + DB query + Service + Route + server.ts 注册 + 2 types union + AuditLogService 同步 + 18 单测 + 2 守卫测试同步）
    - **拆 -A/-B 理由**：CLAUDE.md「PATCH 范围 > 5 项」+ ADR-144 §8 工时 ~0.4w；-A 后端独立闭合 / -B 前端 SWR 重写留 follow-up
    - **关联 GAP**：#G-moderation-preset-team ⚠️+🔄 → ✅ 后端闭合（前端 follow-up 待）
    - **完成备注**：
      - migration 071+072（建表 + 3 索引 + 部分唯一保证 default 单一 + CHECK 12→13）
      - DB query CRUD 5 函数（含 LEFT JOIN users + clearDefaultForOwnerTab 互斥）
      - FilterPresetService（zod + RBAC + diff-only audit + 23505→409 兜底）
      - 4 端点（GET/POST/PATCH/DELETE）+ moderator+admin 权限 + 完备错误码
      - R-MID-1 第 21-23 次系统化（filter_preset.create/update/delete + targetKind filter_preset）
      - 18 新单测含 audit 3 路径全断言 PASS / 完整 unit 4618/4620（+18；2 pre-existing flaky）
      - typecheck + lint + verify:adr-contracts 全 PASS（verify-endpoint-adr 4 端点匹配 ADR-144 §端点契约表）
    - **工时估算**：~0.25w / 实际 ~0.3w（含端点契约表 6 列格式修复 + flaky 边界排查）

42. **CHG-SN-8-FUP-PRESET-TEAM-ADR** · ADR-144 起草（FilterPreset 团队共享协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-144-1..8 完整 / 18 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 B `scope: 'private' | 'shared'`（不引入 team 概念，Resovo 当前架构无多租户）+ user_filter_presets 表 + 4 端点（GET/POST/PATCH/DELETE）+ owner 全权 + admin 强制删 shared + R-MID-1 第 21-23 次系统化 + 用户手动 import 迁移 + DB 部分唯一索引保证 default 单一 + 零新 ErrorCode + 7 关联 ADR 实证
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-144 11 节完整正文；8 D-N 决策 + migration 071+072 SQL + 18 测试 surface + 4 风险 + 2 N1
      - 8 条 D-144-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 推进
      - GAPS.md #G-moderation-preset-team ⚠️ → ⚠️+🔄；P-moderation §3.4 更新
    - **关联 GAP**：#G-moderation-preset-team（P3） ⚠️ → ⚠️+🔄（消费层 warn chip ✅ 1/3 + ADR ✅ 2/3 / 实施 3/3 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审）

41. **CHG-SN-8-FUP-USERS-BATCH-BAN-UI** · ADR-143 前端 batch mode UI（#G-users-batch-ban 完全闭合）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（消费侧 UI / 复用 DataTable 原生 selection / 无 ADR）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（消费 admin-ui 真源范式 / 不动公开 API）
    - **依赖**：CHG-SN-8-FUP-USERS-BATCH-BAN-EP ✅（commit b1f8c05f）+ DataTable selection 范式
    - **范围**：2 文件 — UsersListClient（state + 3 handler + DataTable selection/bulkActions props + 删 PageHeader 旧 disabled btn）+ UsersListClient.test 5 新测试
    - **不在范围**：N1-143-1 并行 pipeline / 其他列表页 selection 范式扩展
    - **关联 GAP**：#G-users-batch-ban → ✅ **完全闭合** 4/4
    - **完成备注**：
      - UsersListClient 加 selectedIds Set + batchPending state
      - handleSelectionChange 过滤 admin id 与后端 skip 一致
      - DataTable selection + onSelectionChange + bulkActions 三件套
      - bulkActions slot：已选 N + danger ban + default unban + ghost clear
      - 5 新单测 + 全 unit 4596/4596 PASS
      - 删 PageHeader 旧 disabled「批量封禁」按钮（checkbox 自启后冗余）
      - GAPS / P-users §4.1 完整闭合说明
    - **工时估算**：~0.3w / 实际 ~0.3w（含测试 + 文档闭环）



12. **CHG-SN-8-GAPS-BATCH-1** · merge candidate_b auto-fill + dashboard runAll 改造 + videos-add 状态确认 — 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **完成备注**：
      - **#G-merge-candidate-b-auto 闭合**：DirectMergeWorkspace 增 `candidateBIdFromUrl` prop + useEffect 一次性 fetch + 注入 picker.value；含 AbortController cleanup；测试新增 1 用例 PASS（共 4 用例）
      - **#G-dashboard-runall 闭合**：DashboardClient PageHeader 拆 2 按钮 — 「全站增量」primary（单次 confirm）+ 「全站全量」ghost（双重 confirm + prompt 输入"全量"）；测试 4 用例改造（前 2 个改双重 + 新增 incremental + confirm 取消）；总 16 PASS
      - **#G-videos-add 验证**：实证按钮存在 disabled + tooltip，状态升 ⚠️ 部分实装（H2 已避免死按钮；实际创建功能 follow-up）
      - GAPS.md 3 条状态更新（2 ✅ + 1 ⚠️）
      - typecheck + lint + verify:manual-coverage PASS
    - **关联**：W1 金票 + W4 工作流流畅度提升
    - **工时估算**：0.1w / 实际 ~0.1w（3 件小事打包）

13. **CHG-SN-8-GAPS-MOD-BATCH** · 审核台批量审核 UI（#G-moderation-batch-ui P1）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **完成备注**：
      - `apps/server-next/src/lib/moderation/api.ts` 增 `batchApproveVideos(ids)` + `batchRejectVideos(ids, reason, labelKey?)` lib 封装
      - `ModListRow.tsx` 增 selectionMode + selected + onToggleSelect props；selectionMode 开时显 checkbox + 单击 row → toggle 而非跳详情
      - `ModerationConsole.tsx` 增 batchModeOn state + selectedIds Set + toggleSelectId + clearSelection + handleBatchApprove + handleBatchRejectSubmit
      - 顶部增「批量模式」toggle 标签（紧邻 approveAndPublishOn）
      - 底部 fixed bulk action bar（accent border-top + shadow + 3 按钮：批量通过 / 批量拒绝 / 清除选择）
      - 复用 RejectModal 作批量拒绝弹窗（title 「批量拒绝 N 条」）
      - ModerationBatch.test 5 用例 PASS（lib batch-approve / batch-reject 调用 + ModListRow checkbox + selected 视觉 + 默认模式回归）
      - GAPS.md #G-moderation-batch-ui 标 ✅
      - P-moderation §3.5 完整章节 + §4.2 标 ✅
    - **关联**：审核效率提升；后端 batch-approve / batch-reject 端点首次前端消费
    - **工时估算**：0.2w / 实际 ~0.2w

18. **CHG-SN-8-GAPS-AUDIT-ROLLBACK** · 审计行尾「回滚」按钮（#G-audit-rollback-universal 消费层补齐）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（不动后端 / 不起 ADR / 复用已有反向 API）
    - **完成备注**：
      - 通用后端端点路线（POST /admin/audit/logs/:id/rollback + reverse_action 映射 + 跨表 schema 回滚）需 0.5-0.8w + ADR-138 + Opus 评审；本卡走**消费层补齐**最小可用范围 0.15w
      - 新建 `apps/server-next/src/lib/audit/rollback-routes.ts` — `resolveRollbackTarget(row)` 返 `{ href, label, disabledReason }`；覆盖 40 actionType（含 8 类可跳转业务页 + 22 类单向操作 disabled + targetKind fallback）
      - AuditColumns.tsx：`buildAuditColumns({ onRollback })` 支持回滚 callback；新增 `actions` 列 + danger xs button + disabled 状态视觉（bg-disabled + cursor: not-allowed）+ title tooltip
      - AuditClient.tsx：useRouter + handleRollback → router.push(target.href) / disabled → warn toast；columns useMemo deps 含 handleRollback
      - rollback-routes.test 12 用例 PASS（video.approve / video.reject_labeled / staging.publish / video.merge / home_module.create / crawler.run_create disabled / system.cache_clear disabled / image_health.rescan disabled / targetId 缺失 disabled / 未知 actionType fallback / encodeURIComponent 特殊字符）
      - AuditClient.test 补 `vi.mock('next/navigation')` 修复因新增 useRouter 引发的 15 测试预存红潜在风险；全 unit 4441 → 4453 (+12) PASS
      - GAPS.md #G-audit-rollback-universal ⬜ → ⚠️；登记通用端点 follow-up CHG-SN-8-FUP-AUDIT-ROLLBACK-EP
      - P-audit §3.4 完整重写为新行为说明（含 8 类跳转表 + 单向不可回滚类型清单 + fallback 规则 + follow-up 路径）；§7 FAQ 2 行更新
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
    - **关联**：H2「零死按钮」豁免范式（disabled+tooltip）；P2 GAPS；通用后端端点立独立 follow-up（需 ADR-138 + Opus 评审 0.3w+）
    - **工时估算**：0.15w / 实际 ~0.18w（含 audit.test mock 顺手补 + 文档完整重写）

17. **CHG-SN-8-GAPS-HOME-BRAND-MULTI** · TopTen/Featured 消费 brand_slug（#G-home-brand-multi）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（前端消费已有后端契约 + ADR-052；不动后端 / 公开 API）
    - **完成备注**：
      - 实证核查：后端 `apps/api/src/routes/home.ts:22,41` + HomeService 已按 brand_slug 过滤；问题在前端调用未传 brand_slug 始终走 null 路径（仅命中 brand_scope='all-brands'）
      - TopTenRow.tsx + FeaturedRow.tsx 引入 `useBrand()` → URL 拼 `?brand_slug=<slug>`（encodeURIComponent）+ useEffect deps 加 brand.slug → brand 切换自动重 fetch
      - HomeBrandFiltering.test 3 用例 PASS（TopTen 带 brand_slug / TopTen brand 缺省走 base / FeaturedRow 带 brand_slug）；polyfill ResizeObserver（jsdom 缺失）
      - GAPS.md #G-home-brand-multi 状态 ⬜ → ✅
      - P-home §4.1 改写为「✅ 已完整打通」三段说明（后端 / 前台消费 / 编辑场景）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4441 PASS（+3）
    - **关联**：ADR-052 brand 协议消费侧补齐；多品牌部署完整路径打通；GAPS P3
    - **工时估算**：0.1w / 实际 ~0.1w

16. **CHG-SN-8-GAPS-SETTINGS-NEGATE** · #G-settings-save-all NEGATED 登记（架构决策不实装）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：haiku（纯文档 NEGATED 登记）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **完成备注**：
      - 实证查代码：`apps/server-next/src/app/admin/settings/_client/SettingsContainer.tsx:161-163` 注释明示「CHG-SN-6-AUDIT-DEBOUNCE-FIX 已删除『保存所有更改』，理由：5 Tab 各自保存模型下无语义」
      - GAPS.md #G-settings-save-all 状态从「⬜ 未启动」改 **❌ NEGATED**（CHG-SN-7-LOW-2 双子卡决策树 / CHG-SN-8-07 NEGATED 同范式）
      - P-settings §4.1 改写为 NEGATED 说明（保存通过 Tab 内 debounced 自动持久化）
      - verify:manual-coverage PASS（不动业务代码）
    - **关联**：澄清「设计稿要求」vs「CHG-SN-6 架构决策」冲突；GAPS P3 移出追踪
    - **工时估算**：≤ 0.02w / 实际 ~0.02w（纯实证 + 文档）

15. **CHG-SN-8-GAPS-DASH-ACTIVITY** · RecentActivityCard mock 视觉警示（#G-dashboard-activities-mock）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（仅前端 prop 透传 + lib 字段新增；无公开 API 改动）
    - **完成备注**：
      - 核查 `apps/server-next/src/lib/dashboard-data.ts` 两 return 路径（live 全量 + ModerationStats fallback）：`activities` 字段均为 `MOCK_ACTIVITIES` 全 mock → 违反 H1「零 mock 视图」硬约束（看似真实的活动时序误导审核员）
      - dashboard-data.ts：`DashboardStats` 新增 `activitiesDataSource: 'mock' | 'live'` 字段；两 return 路径设 'mock'（待 CHG-SN-8-FUP-DASH-ACTIVITY-LIVE follow-up 接 audit_log 端点后改 'live'）
      - RecentActivityCard.tsx：Props 加 `dataSource?: 'mock' | 'live'`（默认 'live'）；mock 时头部右侧渲染「示例数据」warn chip（state-warning-bg/fg + tooltip 指 follow-up 卡号 + cursor: help）
      - DashboardClient.tsx：传 `dataSource={dashboardStats.activitiesDataSource}`
      - tests/.../RecentActivityCard.test.tsx 新建 3 用例 PASS（mock 显 chip / live 不显 / 缺省默认 live）
      - GAPS.md #G-dashboard-activities-mock 状态从「⬜ 待复核」→「⚠️ 已部分实装」+ 真端点 follow-up CHG-SN-8-FUP-DASH-ACTIVITY-LIVE 登记
      - P-dashboard §7 FAQ 一行更新（说明 warn chip 来源 + follow-up 路径）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4438 PASS
    - **关联**：H1 硬约束部分缓解（mock 数据视觉可识别，真后端接入立单独 follow-up）；GAPS P2
    - **工时估算**：0.05w / 实际 ~0.08w

14. **CHG-SN-8-04-N1** · ADR-137 §11 N1 跨类型相似召回 fallback — 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（按 ADR-137 既定决策直接实施，未触动公开 API）
    - **完成备注**：
      - `apps/api/src/db/queries/moderation.ts` `listSimilarCandidates` 新增 `relaxType?: boolean` + `excludeIds?: readonly string[]` 参数；动态 WHERE（relaxType=true 去除 `v.type=$2` 严格约束 / excludeIds 非空时 `AND v.id != ALL($6::uuid[])`）
      - `ModerationService.listSimilar` 加 fallback 路径：strict 通过 minScore 后 < limit 时发起第二次 relaxType 查询，excludeIds 传 strict 结果 ids 避免重复；合并 strict+fallback scored 后整体 score desc 排序 + slice top-N
      - `computeSimilarityScore` 公式不变（type 维度 +40 仅同 type 命中；跨类型自然 +0 由其他 3 维评分）
      - moderation-similar.test 新增 2 用例（#8 fallback 命中：strict 1 条 + fallback 1 条异 type → 合并 2 条 + score 排序 / #9 strict ≥ limit → fallback 不触发只 1 次 query）；旧用例 #1 #6 改用 mockResolvedValueOnce + 第二次返空数组确保 fallback 调用预期；总 15 PASS
      - ADR-137 §11 N1 状态从「非阻塞建议（待 follow-up）」改为「✅ 已闭合（CHG-SN-8-04-N1）」
      - **顺手修 pre-existing 红线**：CHG-SN-8-08 在 MergeClient.tsx + VideoRowActions.tsx 引入 useRouter/useSearchParams 但未给测试补 mock，导致 30 测试预存红；为两个 test 文件加 `vi.mock('next/navigation', ...)` stub，恢复 30 测试 PASS（4405 → 4435 total）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4435 PASS
    - **关联**：ADR-137 §11 N1 非阻塞建议闭合；预存测试红清零；为未来用户反馈漏召回明显场景（电影同名 anime 改编版等）提供 fallback 通道
    - **工时估算**：0.1w / 实际 ~0.15w（含 pre-existing 测试红修复）

   - **历史 trailer 残留**：sonnet（文档）
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - P-videos 完整定稿（179 行 / 8 章节：标杆页 + 14 列字段表 + 6 类常用操作 + 行级/批量动作 + 4 进阶 / FAQ 6 行）
     - P-dashboard 完整定稿（96 行 / 5 类信息 + 8 卡布局 + 数据看板 Tab + 编辑态登记 backlog）
     - P-moderation 补全 §3.1 J/K 键盘流 + §3.2 RejectModal + §3.4 FilterPresetPopover + §4 进阶（重开/批量）+ §5 字段 + §6 颜色 + §7 FAQ
     - P-merge 完整定稿（136 行 / 3 类入口 + DirectMergeWorkspace + minScore 调节 + 5 字段 + 6 FAQ）
     - 新建 `docs/manual/GAPS.md`（11 条已登记 gap + 闭合规则 + 引用规约）：
       - P0 阻塞 1（#G-shell-notifications）
       - P1 主线 4（#G-dashboard-runall / #G-videos-add / #G-moderation-batch-ui / #G-merge-candidate-b-auto / 等）
       - P2 长尾 3
       - P3 视觉/文档 3
     - manual README 末尾新增 GAPS.md 索引行
     - verify:manual-coverage PASS（15 admin 路由 ↔ 15 P-* 1:1）
   - **新发现的 gap**：#G-dashboard-runall（dashboard 全站全量按钮未跟进双重 confirm） / #G-moderation-batch-ui（批量审核 UI 缺失但端点已存在） / #G-merge-candidate-b-auto（审核台深链 candidate_b 未自动注入 Merge）等 — 全部登记 GAPS.md，未在本卡修复（独立 follow-up）
   - **工时估算**：0.3-0.4w / 实际 ~0.35w（4 份 + GAPS 单 commit）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（消费 VideoPicker / 不动 admin-ui 公开 API）
   - **完成备注**：
     - MergeClient.tsx：import VideoPicker + PickerVideoItem + videoPickerFetcher；candidate_a banner 下渲染 DirectMergeWorkspace 子组件（仅当 candidate_a 存在时）
     - 新增 DirectMergeWorkspace 子组件（~75 行）：AdminCard 容器 + 标题 + 说明 + VideoPicker label「候选 B（被合并到 A）」+ 「立即合并」AdminButton
     - handleMerge：B 必选 + B !== A 校验 + window.confirm 二次确认 + mergeVideos({ sourceVideoIds: [B.id], targetVideoId: A.id }) + 成功 toast + 调用 onMergeSuccess（清 banner）
     - 错误：复用 describeError(err, 'merge')；B === A 时按钮 disabled
     - MergeDirectWorkspace.test 3 用例 PASS（工作区渲染 + 选 B 合并 + B===A disabled）
     - W4 §2.2 完整填写（视频库 → Merge 页直接合并 8 步流程含撤销路径）
     - typecheck + lint + verify:manual-coverage 全 PASS
   - **关联问题**：CHG-SN-8-08 follow-up；用户问题 #7 合并入口的端到端工作流闭合
   - **工时估算**：0.15w / 实际 ~0.15w
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（仅前端 UI / 不动 admin-ui 公开 API）
   - **完成备注**：
     - 新建 `apps/server-next/src/app/admin/_client/UserMenuActionModal.tsx`（~210 行 / 单组件根据 type prop 切 3 视图：profile / preferences / help）
     - profile：显示当前 user.displayName / email / role / id + 「编辑（筹备中）」disabled
     - preferences：复用 ThemeProvider 暴露主题切换 + 「品牌 / 语言 / 密度」筹备中占位
     - help：W1-W5 工作流速查 + 9 高频快捷键 + `docs/manual/` 完整说明书入口
     - admin-shell-client.tsx：增 actionModalType state + useToast；handleUserMenuAction 3 case → setActionModalType；switchAccount → toast「多账号切换在 M-SN-N」
     - UserMenuActionModal.test 5 用例 PASS（null / profile / preferences toggle / help / close）
     - typecheck + lint + verify:manual-coverage PASS
     - 00-roles-and-permissions.md §4 用户菜单 6 项 action 矩阵填写
   - **关联问题**：用户问题 #13「用户菜单项目多不可用」**完全闭合**（H2 零死按钮）
   - **工时估算**：0.15w / 实际 ~0.15w

40. **CHG-SN-8-FUP-USERS-BATCH-BAN-EP** · ADR-143 实施（POST batch-ban + batch-unban 2 endpoint）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-143 既定决策 / 复用全链路）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-143 已 Opus A PASS commit de20a302）
    - **依赖**：ADR-143 ✅（commit de20a302）+ USERS-BAN-INV/AUDIT 全链路
    - **范围**：4 文件 — 2 route handler + 2 lib + UsersListClient PageHeader tooltip 更新 + 16 单测；零新 actionType / 零 R-MID-1 触发
    - **不在范围**：前端 batch mode toggle UI（独立 CHG-SN-8-FUP-USERS-BATCH-BAN-UI）/ N1-143-1 并行 pipeline
    - **关联 GAP**：#G-users-batch-ban ⚠️+🔄 → ✅ 后端端点闭合（前端 UI 留 FUP-UI）
    - **完成备注**：
      - routes/admin/users.ts 加 POST batch-ban + batch-unban：admin auth + zod max 50 ids + dedupe Set + per-id for-loop + 5 类 skip（self/missing/admin/already-banned/dedup）+ Redis fire-and-forget per-id + R-MID-1 user.ban/unban audit fire-and-forget per-id + 三计数 response
      - lib batchBanUsers/batchUnbanUsers 2 封装
      - 16 新单测 PASS（覆盖所有 skip guards + 三态 422 + Redis + audit 内容 + 403）
      - 附带修：admin-shell-client.test 前序卡 ADR-142 漂移（moderator 可见 /admin/audit）
      - 完整 unit 4593/4593 PASS / typecheck PASS / lint PASS / verify advisory PASS
      - GAPS.md + P-users.md §4.1 同步
    - **工时估算**：~0.3w（实际 ~0.5w 含前序漂移修复）

39. **CHG-SN-8-FUP-USERS-BATCH-BAN-ADR** · ADR-143 起草（用户批量封禁端点协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-143-1..6 完整 / 6 batch endpoint 仓内实证 / 16 测试 surface / 4 风险 / 1 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 B 对称双端点 + best-effort per-id + 三计数 + max 50 + 5 类 skip + Redis fire-and-forget per-id + 复用 user.ban actionType（零 R-MID-1 触发）+ 零新 ErrorCode + 零 schema；与仓内 6 batch endpoint 范式 100% 对齐；端点实施独立卡 CHG-SN-8-FUP-USERS-BATCH-BAN-EP 依赖 ADR-143 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-143 11 节完整正文；6 D-N 决策 + 7 维 trade-off + 16 测试 surface + 4 风险 + 1 N1
      - 6 条 D-143-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 104 → 110 全闭环
      - GAPS.md #G-users-batch-ban ⚠️ → ⚠️+🔄；P-users §4.1 更新
      - 仓内实证：arch-reviewer 完整 grep 6 现有 batch endpoint（moderation/submissions/videos/staging）；命名 + 部分失败 + max + audit 范式 100% 对齐
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-143-1（串行→并行 pipeline 优化）登记按需评估
    - **关联 GAP**：#G-users-batch-ban ⚠️ → ⚠️+🔄
    - **工时估算**：~0.2w / 实际 ~0.2w

38. **CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP** · ADR-142 实施（audit endpoints moderator self-scope）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-142 已 Opus A− PASS commit 0ded3c38）
    - **依赖**：ADR-142 ✅（commit 0ded3c38）+ AUDIT-NAV-HIDE（commit 3277ee7b）
    - **完成备注**：
      - 3 GET 端点守卫 requireRole(['admin']) → (['moderator', 'admin'])；list handler Route 层强制覆盖 actorId 防 bypass；detail handler 所有权校验 404 防枚举
      - ADMIN_ONLY_HREFS Set 移除 /admin/audit（3→2 项）；moderator 可见审计 nav
      - AuditClient 加 readUserRoleFromCookie + isModerator 推断；info banner (state-info 样式) + actorId filter 隐藏 + subtitle 分支
      - rollback 维持 adminOnly 不变（ADR-138 D-138-2）
      - audit-self-scope.test 12/12 PASS（按 ADR-142 §9 完整覆盖）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - GAPS #G-audit-self-scope ⚠️+🔄 → ✅ 完全闭合；P-audit §0 适用角色字段重写
      - 基础设施零改动（Service / Query 完全未触）
    - **关联 GAP**：#G-audit-self-scope ⚠️+🔄 → ✅ 完全闭合
    - **工时估算**：~0.2-0.3w / 实际 ~0.2w

37. **CHG-SN-8-FUP-AUDIT-SELF-SCOPE-ADR** · ADR-142 起草（audit endpoints self-scope 权限协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A− PASS**（D-142-1..6 完整 / 3 方案 8 维度 trade-off / 4 endpoint 各自策略 + 详情 404 防枚举 / Route 层注入防 bypass + 伪代码 / 6 文件降级清单 / 12 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮；选方案 B（admin + moderator self-scope）+ Route 层强制覆盖 actorId + 详情端点 404 防枚举 + 前端 nav 恢复 + info banner + 零 schema + 零新 ErrorCode + 复用 idx_admin_audit_log_actor_created；端点 1-3 GET 扩 moderator，端点 4 POST rollback 维持 admin only（ADR-138 D-138-2）；端点实施独立卡 CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP 依赖 ADR-142 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-142 11 节完整正文；6 D-N 决策 + 3 方案 trade-off + 4 endpoint 策略 + Route 层注入防 bypass 设计含伪代码 + 6 文件 R-MID-1 降级清单 + 12 测试 surface + 4 风险 + 2 N1
      - 6 条 D-142-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 98 → 104 全闭环
      - GAPS.md #G-audit-self-scope ⚠️ → ⚠️+🔄；P-audit §0 适用角色字段重写（admin + moderator self-scope 待 EP）
      - 重要发现：基础设施全部就绪（Query 层 actorId 参数已支持 + Service 层透传 + 索引已就位）；EP 实施仅 Route 层 + 前端少量改动
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-142-1（moderator dashboard widget）/ N1-142-2（ipHash strip GDPR）登记按需评估不立 follow-up
    - **关联 GAP**：#G-audit-self-scope ⚠️ → ⚠️+🔄（消费层 ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审 + decisions.md ~600 行落盘）

36. **CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS** · ADR-138 N1-138-1 P1 闭合（注册 video.approve + video.reject_labeled handler）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：CHG-SN-8-FUP-AUDIT-ROLLBACK-EP ✅（commit c8a2cb33）
    - **完成备注**：
      - 新增 2 reverse_handler 不调 ModerationService.reopen / transitionVideoState（避免嵌套事务）；同事务 client 直接 UPDATE SQL
      - ROLLBACK_HANDLER_REGISTRY 初始化含 2 项 Map（之前为空）
      - UNSUPPORTED Set 移除 video.approve + video.reject_labeled（32→30）；video.reopen 单独保留（反向语义模糊）
      - 顺手修 TARGET_KIND_TABLE_MAP home_module softDeleteColumn 'deleted_at' → null（schema 实证 hard delete / migration 050 无 deleted_at 列）
      - audit-rollback.test 扩 2 用例 PASS（#22 video.approve / #23 video.reject_labeled handler 都 bypass 通用路径）；修 #3 home_module.update 断言 → null；23/23 PASS
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - ADR-138 §11 N1-138-1 P1 状态「按需启动」→「✅ 已闭合」+ P2 推迟说明 + P3 仍待
    - **关联 N1**：ADR-138 §11 N1-138-1 P1 ✅ / P2 推迟（home_modules hard delete schema）/ P3 待独立 ADR
    - **工时估算**：~0.15w / 实际 ~0.15w

35. **CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE** · ADR-138 N1-138-2 闭合（rollback 加 force 参数跳过 stale）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：CHG-SN-8-FUP-AUDIT-ROLLBACK-EP ✅（commit c8a2cb33）
    - **完成备注**：
      - 端点 RollbackBodySchema z.object({ force?: boolean }).default({}) + POST handler 解析 body
      - AuditRollbackService.rollback options 第 3 参数 + rollbackGeneric force 参数 + 跳过 stale 检测
      - audit log payload spread auditMeta 含 force flag 供追溯审计
      - audit-rollback.test 扩 2 用例 PASS（force 跳 stale + audit flag / force 不绕 UNSUPPORTED）；21/21 PASS
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - ADR-138 §11 N1-138-2 状态「待运营反馈」→「✅ 已闭合」
      - 向后兼容：空 body 仍合法（旧调用零回归）；force 仅跳过 stale，其它守卫保持
    - **关联 N1**：ADR-138 §11 N1-138-2（force 强制覆盖参数） → ✅ 闭合
    - **工时估算**：~0.1w / 实际 ~0.1w

34. **CHG-SN-8-FUP-USERS-BAN-AUDIT** · user.ban + user.unban audit 补齐（R-MID-1 第 20 次系统化）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无
    - **依赖**：USERS-EDIT-EP migration 069 + USERS-BAN-INV（commit 4301d8e6）
    - **完成备注**：
      - R-MID-1 7 文件 + 1 新单测 = 8 文件改动
      - admin-moderation.types union + AuditLogService ACTION_TYPES + enums set-equal + coverage REQUIRED+PAYLOAD_REQUIRED 同步加 user.ban + user.unban
      - ban handler 加 auditSvc.write（before/after.banned_at null/NEW）
      - unban handler 先 findAdminUserById 取 before snapshot + 顺手加 404 兜底 + audit.write（before/after.banned_at OLD/null）
      - admin-users-ban-audit.test 4 用例 PASS（ban payload / unban payload / ban admin 403 / unban 404）
      - 共 121/121 PASS（audit-log-coverage 97 自动验证 R-MID-1 守卫 + ban-audit 4 + ban-inv 4 + admin-users 12 + enums 4）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - P-users §3.4 audit 追溯标 ✅；闭合 ADR-139 N1-139-2 audit follow-up
    - **关联**：ADR-139 N1-139-2 audit 补齐路径完全闭环
    - **工时估算**：~0.15w / 实际 ~0.15w

33. **CHG-SN-8-FUP-USERS-BAN-INV** · ADR-139 N1-139-2 闭合（ban 同模式 session invalidate）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（N1 派生）
    - **依赖**：USERS-ROLE-INV-EP ✅（commit c2594fa7）
    - **完成备注**：
      - banUser SQL 加 SET role_changed_at = NOW() + RETURNING role_changed_at；返回类型补字段
      - ban handler 写 Redis user:rca:{id} EX 900 + 防御性 if 守卫 + 404 兜底新增
      - admin-users-ban-inv.test 4 用例 PASS（SQL / Redis 写入 / admin 403 / 404 边界）
      - admin-users.test 12/12 不变（防御性守卫保证 mock 兼容）；admin-users-role-change/edit 测试同步 PASS（共 46/46）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS
      - ADR-139 §11 N1-139-2 状态「登记」→「✅ 已闭合」含语义 trade-off 说明
      - P-users §3.4 封禁段重写（session 即时失效说明 + audit follow-up）
      - audit 补齐独立 follow-up CHG-SN-8-FUP-USERS-BAN-AUDIT 按需启动
    - **关联 N1**：ADR-139 §11 N1-139-2（ban/unban 同模式扩展） → ✅ 闭合
    - **工时估算**：~0.15w / 实际 ~0.15w

32. **CHG-SN-8-FUP-DASH-ACTIVITY-DISPLAY-NAME** · ADR-141 N1-141-1 闭合（targetDisplayName 扩展）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-141 N1-141-1 既定决策 / 接口向后兼容）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（N1 范围扩展 / 无新端点 / 无 ADR）
    - **依赖**：CHG-SN-8-FUP-DASH-ACTIVITY-LIVE ✅（commit 27833561）
    - **完成备注**：
      - DashboardActivityRow 追加 targetDisplayName?: string | null 可选字段（向后兼容）
      - enrichTargetDisplayNames helper：TARGET_DISPLAY_MAP 4 项映射（video.title / user.username / crawler_site.name / home_module.slot）；按 target_kind 分组 Promise.all 并行 IN 查询 + 去重 + 单组失败兜底
      - route handler enrich + 缓存对 enriched 结果（缓存行为不变）
      - 前端 mapActivityRow 文案：`${actionLabel}「${displayName ?? shortId ?? ''}」`；formatTargetSuffix 三层 fallback
      - dashboard-activities.test 扩 2 用例（#11 video.title 拼接 / #12 target 不存在 fallback）；#10 缓存断言更新为 2 次 DB；12/12 PASS
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage PASS；dashboard 组前端 60/60 PASS
      - ADR-141 §11 N1-141-1 状态从"待登记"→"✅ 已闭合"含完整实施摘要
    - **关联 N1**：ADR-141 §11 N1-141-1（targetDisplayName 扩展） → ✅ 闭合
    - **工时估算**：~0.15w / 实际 ~0.18w（含文档同步）

31. **CHG-SN-8-FUP-DASH-ACTIVITY-LIVE** · ADR-141 实施（dashboard activities 真端点 + 前端 mock → live）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-141 既定决策）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-141 已 Opus A PASS commit 4de065f4）
    - **依赖**：ADR-141 ✅（commit 4de065f4）
    - **完成备注**：
      - migration 070 idx_admin_audit_log_created (created_at DESC) 幂等
      - DashboardActivityRow 类型 + listDashboardActivities query（LEFT JOIN users + ORDER BY created_at DESC, id DESC + LIMIT）
      - GET /admin/dashboard/activities handler + zod limit 1-50 default 10 + Map<number, {data, expiry}> 60s TTL 缓存
      - getDashboardActivities lib fetcher + 新 i18n audit-action-labels.ts 37 项全集 + deriveActivitySeverity helper
      - dashboard-data.ts buildDashboardStats 加 activitiesRows 第 3 参数 + mapActivityRow + formatRelative helpers；两 return 路径派生 activities + activitiesDataSource live/mock
      - DashboardClient.tsx 新增 activities state + Promise.all 拉真端点 + fallback null → mock
      - dashboard-activities.test 10/10 PASS（含缓存命中测试 vi.resetModules 隔离）
      - 全 unit 4547/4547 PASS（+10 / 0 回归）；typecheck + lint + verify:adr-contracts（verify-endpoint-adr 176→177 含 GET activities 自动对齐 / verify-adr-d-numbers 98 全闭环）+ verify:manual-coverage PASS
      - GAPS.md #G-dashboard-activities-mock ⚠️+🔄 → ✅ 完全闭合；P-dashboard §7 FAQ 重写（已实装 + fallback 路径）
      - N1-141-1 targetDisplayName / N1-141-2 severity 后端化登记按需启动
    - **关联 GAP**：#G-dashboard-activities-mock ⚠️+🔄 → ✅ 完全闭合
    - **工时估算**：~0.3w / 实际 ~0.3w

30. **CHG-SN-8-FUP-DASH-ACTIVITY-ADR** · ADR-141 起草（dashboard activities 真端点协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 **A PASS**（最高级 / D-141-1..6 完整 / 3 方案 6 维度 trade-off / 索引 4 项分析 + 新索引代价评估 / 10 测试 surface / 4 风险 / 2 N1）
    - **方案选型**：spawn Opus 1 轮起草；选方案 C（admin_audit_log 直接派生 + Service 层 60s TTL 缓存）+ 新 idx_admin_audit_log_created (created_at DESC) 索引 + actionType 中文 label 前端 i18n 承担（37 项扩展） + admin only + 单 limit max 50 + 零新 ErrorCode；端点实施独立卡 CHG-SN-8-FUP-DASH-ACTIVITY-LIVE 依赖 ADR-141 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-141 11 节完整正文；6 D-N 决策 + 3 方案 trade-off + 索引 4 项分析 + 5 文件 R-MID-1 降级清单 + 10 测试 surface + 4 风险 + 2 N1
      - 6 条 D-141-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 92 → 98 全闭环
      - GAPS.md #G-dashboard-activities-mock ⚠️ → ⚠️+🔄；P-dashboard §7 FAQ 重写（含 ADR-141 决策摘要）
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-141-1（targetDisplayName 扩展）→ CHG-SN-8-FUP-DASH-ACTIVITY-DISPLAY-NAME 按需启动
      - N1-141-2（severity 后端化）→ 按需评估不立 follow-up
      - **评级 A**（最高级）：GET 只读端点设计简洁清晰；所有决策自洽 + trade-off 完整 + 索引代价实证
    - **关联 GAP**：#G-dashboard-activities-mock ⚠️ → ⚠️+🔄（消费层 ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.2w / 实际 ~0.2w

29. **CHG-SN-8-FUP-AUDIT-ROLLBACK-EP** · ADR-138 实施（audit 通用回滚端点 + R-MID-1）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-138 既定决策）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-138 已 Opus PASS commit e446a17c）
    - **依赖**：ADR-138 ✅（commit e446a17c）+ USERS-EDIT-EP migration 069
    - **完成备注**：
      - api-errors.ts +3 码（AUDIT_ROLLBACK_UNSUPPORTED 422 / STALE 409 / SCHEMA_DRIFT 422）；15 → 18 码
      - admin-moderation.types union +1 + AuditLogService ACTION_TYPES +1（system.audit_rollback）
      - AuditRollbackService 新建（核心算法 + 9 target_kind 字段白名单 + 32 项 UNSUPPORTED Set + ROLLBACK_HANDLER_REGISTRY 扩展点 + 事务管理 + isJsonEqual stale 检测）
      - DB queries +3：rollbackAuditLogTarget（动态 SET + quoteIdent 防注入）+ selectCurrentRowForRollback（stale 检测）+ insertAuditLogInTransaction（事务原子性）
      - POST /admin/audit/logs/:id/rollback handler（AppError 域异常分发；PG 23505→409 STALE / 42703→422 SCHEMA_DRIFT）
      - R-MID-1 第 19 次系统化（enums set-equal + coverage REQUIRED + PAYLOAD_REQUIRED 同步）
      - audit-rollback.test 新建 19 用例 PASS；全 unit 4537/4537 PASS（+21 / 0 回归）
      - typecheck + lint + verify:adr-contracts（verify-endpoint-adr 175→176 / verify-adr-d-numbers 92 闭环）+ verify:manual-coverage PASS
      - GAPS.md #G-audit-rollback-universal ⚠️+🔄 → ✅ 完全闭合；P-audit §3.4 重写（含 8 失败场景 / 11 target_kind 白名单 / R-MID-1 第 19 次）
      - N1-138-1（reverse_handler 渐进注册）/ N1-138-2（force 参数）/ 消费层升级 — 3 follow-up 登记按需启动
    - **关联 GAP**：#G-audit-rollback-universal ⚠️+🔄 → ✅ 完全闭合
    - **工时估算**：0.5-0.8w / 实际 ~0.5w

28. **CHG-SN-8-FUP-AUDIT-ROLLBACK-ADR** · ADR-138 起草（audit 通用回滚端点协议）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D-138-1..6 完整 + 4 方案 trade-off 8 维度 + 8 失败场景处理 + 字段白名单 3 示例 + 24 项 UNSUPPORTED + 19 测试 surface + 5 风险 + 2 N1）
    - **方案选型**：spawn arch-reviewer Opus 1 轮起草；选方案 D 混合策略（JSONB diff 反向 UPDATE + reverse_handler 注册扩展 + UNSUPPORTED Set 24 项）；admin only + 高敏感 6 actionType 二次确认；R-MID-1 第 19 次（system.audit_rollback 复用 system targetKind）；3 新 ErrorCode（UNSUPPORTED 422 / STALE 409 / SCHEMA_DRIFT 422）；字段白名单防 password_hash/role 注入；端点实施独立卡 CHG-SN-8-FUP-AUDIT-ROLLBACK-EP 依赖 ADR-138 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-138 11 节完整正文；6 D-N 决策 + 4 方案 trade-off + 8 失败场景 + 字段白名单 3 示例 + 11 target_kind→table 映射 + 24 项 UNSUPPORTED 完整清单 + ~12 项可自动回滚 + 10 文件 R-MID-1 清单 + 19 测试 surface + 5 风险 + 2 N1
      - 6 条 D-138-N 在本卡 changelog 完整闭环；verify-adr-d-numbers 86 → 92 全闭环
      - GAPS.md #G-audit-rollback-universal ⚠️ → ⚠️+🔄；P-audit §3.4 通用端点段重写（方案 D / 字段白名单 / 3 ErrorCode / R-MID-1 第 19 次 + 2 N1）
      - 重要发现：USERS-EDIT-EP migration 069 已修 admin_audit_log CHECK 含 system / user — 本 ADR 的 system.audit_rollback actionType + system targetKind 可直接复用，无 schema 阻塞
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-138-1（reverse_handler 渐进注册 P1/P2/P3）→ CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS 按需启动
      - N1-138-2（force 强制覆盖参数）→ CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE 待运营反馈触发
    - **关联 GAP**：#G-audit-rollback-universal ⚠️ → ⚠️+🔄（消费层 ✅ + ADR ✅ / 实施 follow-up 待立）
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审 + decisions.md ~600 行落盘）

27. **CHG-SN-8-FUP-USERS-EDIT-EP** · ADR-140 实施（admin 改邮箱 + 编辑资料 + R-MID-1 + audit CHECK 历史漂移修复）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-140 既定决策）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（ADR-140 已 Opus PASS commit 2523a920）
    - **依赖**：ADR-140 ✅（commit 2523a920）+ USERS-ROLE-INV-EP（commit c2594fa7）
    - **完成备注**：
      - 2 migration（068 users.display_name VARCHAR(50) + 069 admin_audit_log CHECK 6→12 含 user + 5 历史漂移修复）
      - DB queries: updateUserEmail + updateUserProfile（动态 SET + COALESCE 模式）+ findUserByEmailExcludingId（唯一性预验）+ mapUser/findAdminUserById/listAdminUsers 加 display_name
      - User 类型加 displayName?: string | null（向后兼容）
      - R-MID-1 第 18 次系统化（user.email_change + user.profile_update 2 actionType 单卡落地）
      - 2 PATCH route handler（admin 守卫 + 404/403/409/422 + Service 层唯一性 + DB UNIQUE race 23505 兜底 + audit fire-and-forget + partial before/after payload）
      - 前端 EditEmailModal + EditProfileModal + columns 2 按钮（admin disabled + tooltip + 列宽 240→340）
      - 测试 22 后端 + 12 前端 = 34 新单测 PASS；全 unit 4516/4515 PASS (+38 / 1 pre-existing flaky 与本卡无关)
      - typecheck + lint + verify:manual-coverage + verify:adr-contracts (verify-endpoint-adr 173→175 / verify-adr-d-numbers 86 全闭环) PASS
      - **顺手修复 USERS-ROLE-INV-EP 生产可用性 BLOCKER**：migration 069 补 admin_audit_log CHECK 至 12 种 target_kind，消除 'user' INSERT reject 风险
      - GAPS.md #G-users-edit-profile ⚠️+🔄 → ✅ 完全闭合（reset-pwd + ADR + EP 三段路径全 PASS）
      - P-users §4.2 完整重写；N1-140-1（邮件升级）/ N1-140-2（email session inv）登记 follow-up
    - **不在范围**：N1-140-1 邮件验证流程 / N1-140-2 email session invalidate — 按需启动
    - **关联 GAP**：#G-users-edit-profile 🔄 → ✅ 完全闭合
    - **工时估算**：0.55-0.65w / 实际 ~0.55w

26. **CHG-SN-8-FUP-USERS-ROLE-INV-EP** · ADR-139 实施（角色变更 session invalidate 完整端点）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet（按 ADR-139 既定决策直接实施）
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（按 ADR-139 D-139-1..8 既定决策）
    - **依赖**：ADR-139 ✅（commit 83e49fbb）
    - **完成备注**：
      - migration 067_users_role_changed_at.sql（幂等 + COMMENT）
      - DB queries: updateUserRole SET role_changed_at = NOW() + RETURNING；mapUser/DbUserRow 加 roleChangedAt
      - User.roleChangedAt 类型扩展（向后兼容 optional）
      - ErrorCode ROLE_CHANGED 加入 ERRORS 字典（14 → 15 码）
      - R-MID-1 7 文件框架（actionType union + AuditLogService ACTION_TYPES + enums set-equal test + coverage REQUIRED/PAYLOAD_REQUIRED + route 调用 + payload 内容断言 + changelog）
      - UserService.refresh: 新增 RoleChangedError + iat 比对；auth.ts route catch 区分 → 401 ROLE_CHANGED
      - middleware resolveUser 重构为 ResolveResult 三态 + Promise.all 并行查 blacklist + user:rca
      - PATCH /admin/users/:id/role: 增 Redis set fire-and-forget EX 900 + auditSvc.write payload 含 before/after role + roleChangedAt
      - 前端 api-client.ts: peekErrorCode + handleRoleChanged → forced logout + redirect /login?reason=role_changed
      - admin-users-role-change.test 8/8 PASS（PATCH + Redis + audit payload / middleware 3 用例 / refresh 3 用例）
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4478/4478 PASS（+8 / 0 回归）
      - 审计发现：image_health.* pre-existing 漂移（ADR-140 D-140-5 已识别），本卡守 ADR-140 EP 范围不顺手修
      - N1-139-1（DB fallback）评估后选不加；N1-139-2（ban/unban）登记独立 follow-up CHG-SN-8-FUP-USERS-BAN-INV
    - **不在范围**：e2e（#11 测试 surface 推迟 advisory）/ ban-inv（N1-139-2 独立卡）/ cache miss DB fallback（实施评估后选不加，保持 ADR-139 §D-139-7 默认放行）
    - **关联 GAP**：#G-users-role-session-invalidate 🔄 → ✅ 完全闭合
    - **工时估算**：0.4-0.6w / 实际 ~0.45w

25. **CHG-SN-8-GAPS-USERS-BATCH-BAN-BTN** · 用户管理「批量封禁」disabled 入口（#G-users-batch-ban 消费层）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（纯前端 visual / 同 audit-rollback disabled 范式）
    - **方案选型**：disabled 按钮 + tooltip（同 P-videos 添加视频 / audit-rollback 未支持类型 / H2 死按钮豁免）；位 PageHeader actions 末尾；后端 batch endpoint follow-up CHG-SN-8-FUP-USERS-BATCH-BAN-EP
    - **完成备注**：
      - UsersListClient PageHeader 邀请用户 与 刷新 之间插 disabled「批量封禁」按钮 + title tooltip 指 GAPS + follow-up
      - UsersListClient.test 扩 2 用例 PASS（#4 disabled + 文案 / #5 tooltip 指向 GAPS + follow-up）；总 5/5 PASS
      - GAPS.md #G-users-batch-ban ⬜ → ⚠️；登记 CHG-SN-8-FUP-USERS-BATCH-BAN-EP（参 ModerationBatch 已闭合范式可直接复用）
      - P-users §4.1 重写（含 disabled 入口说明）
      - typecheck + lint + verify:manual-coverage PASS
    - **关联 GAP**：#G-users-batch-ban（P3） ⬜ → ⚠️
    - **工时估算**：~0.05w / 实际 ~0.07w

24. **CHG-SN-8-GAPS-WEBHOOK-NOT-IMPL** · Webhook 通知「字段存但回调未实装」警示（#G-settings-webhook-impl 消费层）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（纯前端 visual + 文档）
    - **方案选型**：纯视觉警示（同 PRESET-LOCAL-BADGE / DASH-ACTIVITY 范式）— card 顶部 warn banner 明示「字段存储有效但 webhook 触发未实装」；字段保留以便实装后无迁移；后端实装 follow-up CHG-SN-8-FUP-WEBHOOK-IMPL
    - **完成备注**：
      - 实证：apps/api + apps/worker grep `webhookEnabled` / `sendWebhook` 零匹配 — 字段存但永远不发
      - NotificationsTab webhook card subtitle 改 ⚠️ 标记；card 顶部加 warn banner（state-warning-bg + 「不会向该 URL 发送任何 HTTP POST」+ 指向 GAPS）
      - NotificationsTab.test 扩 2 用例 PASS（#6 banner 渲染 + 关键文案 / #7 banner 含 #G-settings-webhook-impl + CHG-SN-8-FUP-WEBHOOK-IMPL 指向）；总 7/7 PASS
      - GAPS.md #G-settings-webhook-impl ⬜ → ⚠️；登记 CHG-SN-8-FUP-WEBHOOK-IMPL（5 决策点设计草案：事件订阅 / HMAC / 重试 / audit / worker job 派发）
      - P-settings §3.7 完整重写（含视觉警示 + 后端 follow-up）
      - typecheck + lint + verify:manual-coverage PASS
    - **关联 GAP**：#G-settings-webhook-impl（P3） ⬜ → ⚠️
    - **工时估算**：~0.05w / 实际 ~0.08w（含文档同步）

23. **CHG-SN-8-GAPS-PRESET-LOCAL-BADGE** · FilterPreset 「仅本地」视觉警示（#G-moderation-preset-team 消费层）— 状态：✅ 已完成（2026-05-22）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（纯前端 visual + i18n）
    - **方案选型**：纯视觉警示（同 DASH-ACTIVITY mock 警示范式）— popover header 加「仅本地」chip + tooltip 解释；零 admin-ui contract / 零端点 / 零 schema；团队共享需后端表 + ADR + Opus 独立 follow-up CHG-SN-8-FUP-PRESET-TEAM-EP
    - **完成备注**：
      - i18n moderation.ts preset 块加 localOnlyBadge + localOnlyTooltip 2 key
      - FilterPresetPopover header 拆 flex 布局 + warn chip（state-warning-bg/fg + cursor: help + title tooltip 指 GAPS）
      - 新建 FilterPresetPopoverBadge.test 3/3 PASS（chip 渲染 / tooltip 含 localStorage + 未跨账号同步 + #G-moderation-preset-team / open=false 不渲染）
      - 实证修正：use-filter-presets.ts 是 localStorage 不是 sessionStorage；P-moderation §3.4 + §7 FAQ + GAPS 三处同步修正
      - GAPS.md #G-moderation-preset-team ⬜ → ⚠️；登记 CHG-SN-8-FUP-PRESET-TEAM-EP（含 user_filter_presets 表 + 4 端点 + scope toggle 设计草案）
      - typecheck + lint + verify:manual-coverage PASS
    - **关联 GAP**：#G-moderation-preset-team（P3） ⬜ → ⚠️
    - **工时估算**：~0.05w / 实际 ~0.08w（含文档同步修正）

22. **CHG-SN-8-FUP-USERS-EDIT-ADR** · ADR-140 起草（admin 改用户邮箱 + 显示名端点协议）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：opus
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D-140-1..6 完整 + 3 方案 trade-off + 22 测试 surface + 4 风险 + 2 N1）
    - **方案选型**：spawn arch-reviewer Opus 1 轮起草 ADR-140；选方案 B 双端点（PATCH /admin/users/:id/email + /profile）；email 直接生效（邮件服务零基础设施实证）；admin 互改保护沿用 4 端点一致守卫；R-MID-1 7 文件框架触发；端点实施独立卡 CHG-SN-8-FUP-USERS-EDIT-EP 依赖 ADR-140 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-140 11 节完整正文（~370 行）；6 D-N 决策 + 3 方案 trade-off 表 + 双端点契约 + 2 migration（users 加 display_name + audit_log CHECK 6→12 历史漂移补齐）+ 22 测试 surface + R-MID-1 7 文件清单
      - D-140-1（双端点）/ D-140-2（直接生效 + 邮件服务零基础设施实证）/ D-140-3（displayName VARCHAR(50) + 正则字符集）/ D-140-4（admin 互改保护沿用 role === 'admin' 守卫）/ D-140-5（R-MID-1 触发 + 2 actionType + 1 targetKind）/ D-140-6（关联 ADR 8 项 + Schema 2 列变更）
      - 6 条 D-140-N 在本卡 changelog 条目完整闭环；verify-adr-d-numbers 从 80 → 86 全闭环
      - GAPS.md #G-users-edit-profile ⚠️ → ⚠️ + 🔄（reset-pwd ✅ 1/3 + ADR 2/3 + 实施 follow-up CHG-SN-8-FUP-USERS-EDIT-EP 3/3 待立）；P-users §4.2 同步更新
      - 重要发现：admin_audit_log CHECK 约束仅 6 种 target_kind（TS 类型已扩展到 11 种漂移），实施卡顺带一次性补齐至 12 种
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-140-1（邮件服务上线后升级路径）/ N1-140-2（email 变更后 session invalidate）登记
    - **关联 GAP**：#G-users-edit-profile（P2） ⚠️ → ⚠️ + 🔄 ADR 已起草（reset-pwd 1/3 + ADR 2/3 + 实施 follow-up 3/3）
    - **工时估算**：~0.2w / 实际 ~0.3w（含 Opus 1 轮评审 + decisions.md ~370 行落盘）

21. **CHG-SN-8-FUP-USERS-RESET-PWD** · 用户管理「重置密码」前端补齐（#G-users-edit-profile 消费层 1/3）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（消费层；后端已存在 POST /admin/users/:id/reset-password）
    - **方案选型**：reset-pwd 后端 ready 走纯消费层；2 态 Modal（idle confirm + success 显示新密码 + 复制按钮 + warn 一次性 / 关闭后不可复看）；admin 目标 disabled（与后端 403 一致）；改邮箱 / 改显示名（2 新端点）需 ADR + Opus，独立 follow-up CHG-SN-8-FUP-USERS-EDIT-ADR
    - **完成备注**：
      - api.ts 加 `resetUserPassword(id) → { newPassword }` lib 封装
      - 新建 ResetPasswordModal.tsx（2 态 / 含错误内联 / 复制 navigator.clipboard 失败降级）
      - columns.tsx 加 onResetPassword + 「重置密码」xs ghost btn（admin disabled + tooltip）；列宽 170 → 240
      - UsersListClient 接 modal state + handler
      - ResetPasswordModal.test 5/5 PASS；users 6 文件 41/41 PASS；全 unit 4460 PASS
      - GAPS.md #G-users-edit-profile ⬜ → ⚠️（reset-pwd 1/3 闭合）；登记 CHG-SN-8-FUP-USERS-EDIT-ADR follow-up
      - P-users §3.5 完整新建「重置密码」章节；§4.2 改名 + 标 reset-pwd 已闭合
      - typecheck + lint + verify:manual-coverage PASS
    - **关联 GAP**：#G-users-edit-profile（P2） ⬜ → ⚠️（reset-pwd 1/3 闭合，email + displayName 待 ADR）
    - **工时估算**：~0.15w / 实际 ~0.18w

20. **CHG-SN-8-FUP-USERS-ROLE-INV-ADR** · ADR-139 起草（角色变更 session invalidate 协议）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：opus（CLAUDE.md §模型路由 ADR 起草强制升 Opus）
    - **执行模型**：claude-opus-4-7
    - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D-139-1..8 完整 + 4 方案 trade-off + 12 测试 surface + 4 风险 + 2 N1）
    - **方案选型**：用户裁定 — 仅 ADR 卡（不实施 端点 / Service / migration / 前端）；端点实施独立卡 CHG-SN-8-FUP-USERS-ROLE-INV-EP 依赖 ADR-139 PASS
    - **完成备注**：
      - spawn Opus arch-reviewer 1 轮：ADR-139 11 节完整正文（~370 行）；选方案 B（users.role_changed_at TIMESTAMPTZ + access token iat 校验）；权限穿越窗口最大 15min → 0
      - D-139-1（方案 B 选型）/ D-139-2（401 ROLE_CHANGED + 不静默续约）/ D-139-3（refresh 拒绝 + 强制重登）/ D-139-4（user_role cookie 靠 logout 清除）/ D-139-5（migration ALTER 幂等 + 回滚 SQL）/ D-139-6（R-MID-1 降级 — 实施卡补 user.role_change actionType + user targetKind）/ D-139-7（Redis 缓存 user:rca:{id} EX 900 + 与 blacklist Promise.all 并行 + cache miss 放行）/ D-139-8（admin 自残保护现状已充分）
      - 8 条 D-139-N 在本卡 changelog 条目完整闭环；verify-adr-d-numbers 从 72 → 80 全闭环
      - GAPS.md #G-users-role-session-invalidate ⬜ → 🔄 ADR 已起草；P-users §3.3 + §7 FAQ 同步更新
      - typecheck + lint + verify:manual-coverage PASS（纯文档）
      - N1-139-1（cache miss DB fallback）→ 实施卡评估；N1-139-2（ban/unban 同类穿越）→ 独立 follow-up CHG-SN-8-FUP-USERS-BAN-INV
    - **关联 GAP**：#G-users-role-session-invalidate（P2 安全） ⬜ → 🔄 ADR 已起草
    - **工时估算**：~0.2w / 实际 ~0.25w（含 Opus 1 轮评审 + decisions.md ~370 行落盘）

19. **CHG-SN-8-GAPS-AUDIT-NAV-HIDE** · 系统管理组对 moderator 消费层 nav 过滤（#G-audit-self-scope 消费层补齐）— 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **子代理**：无（不动 admin-ui 公开 API；消费层 ADMIN_NAV 按 role 过滤）
    - **方案选型**：用户裁定 Path A — 仅消费层补齐；moderator 隐藏「系统管理」组 3 死链（用户管理 / 站点设置 / 审计日志）；不起 ADR / 不改后端；完整 self-scope（admin 看全量 + moderator 看自己 audit）走独立后端 follow-up CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP
    - **完成备注**：
      - 实证：后端 `/admin/audit/*` + `/admin/users` + `/admin/system/settings` 全 adminOnly；前端 sidebar 对 moderator 全显 → 死链 403
      - admin-shell-client.tsx 新增 `filterNavForRole(nav, role)` helper + `ADMIN_ONLY_HREFS` Set；useMemo navForRole；admin 看全量 / moderator 自动过滤 3 路由
      - 测试 5/5 PASS（原 2 用例主题 + 新增 3 用例：admin 见全部 / moderator 不见 admin-only / moderator 仍见业务 nav）
      - GAPS.md #G-audit-self-scope ⬜ 待复核 → ⚠️ 已部分实装；登记 CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP（需 ADR-N + Opus + 后端 role-aware filter）
      - P-audit §0 适用角色字段重写
      - typecheck + lint + verify:adr-contracts + verify:manual-coverage + 全 unit 4456 PASS（+3）
    - **关联**：#G-audit-self-scope ⬜ → ⚠️；H2「零死按钮」延伸到 nav 死链豁免
    - **工时估算**：0.08w / 实际 ~0.1w

