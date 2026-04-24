# 测试失败 Triage 文档 — 2026-04-18

> status: archived
> owner: @engineering
> scope: 2026-04-18 test failure triage
> source_of_truth: no
> supersedes: none
> superseded_by: docs/baseline_20260418/, docs/task-queue.md
> last_reviewed: 2026-04-24
>
> 对应 baseline：`docs/baseline_20260418/failing_tests.json`
> 产出来源：TESTFIX-03（单元测试）/ TESTFIX-07（E2E 全 suite 重建）
> 适用规范：`docs/rules/workflow-rules.md §Phase 基线测试条款`

---

## 汇总

| 类型 | 失败数 | fix | quarantine | defer |
|------|--------|-----|------------|-------|
| A（基础设施）| 0 | 13* | 0 | 0 |
| B（架构真源冲突）| 0 | — | — | — |
| C（testid / DOM 漂移）| 47 | 0 | 47 | 47 |
| D（断言漂移 / 真 bug）| 7 | 0 | 7 | 7 |
| **合计（当前基线）** | **54** | **0** | **54** | **54** |

> \* A×13 单元测试已由 TESTFIX-05 修复（`vi.mock` CrawlerRunService / process.exit 级联），不再出现于当前基线。
> D×3 单元测试同由 TESTFIX-05 修复（mock db.query 补全）。

- 单元测试：0 条失败（16 条已由 TESTFIX-05 修复）
- E2E（全 8 suite）：54 条（C×47 + D×7）

---

## 单元测试失败明细（历史记录，已由 TESTFIX-05 修复）

### A 类：基础设施失败（已修复）

根本原因：`apps/api/src/services/CrawlerService.ts` 在模块顶层 `import` 了 `apps/api/src/lib/config.ts`；
`config.ts` 在缺少必要环境变量时调用 `process.exit(1)`。
测试环境未设置这些变量，导致 Fastify `buildApp()` 在 `beforeEach` 阶段失败，`app` 变量不被赋值，
`afterEach(() => app.close())` 随即抛出 `Cannot read properties of undefined (reading 'close')`，
进而导致同 describe 块的后续测试全部以 0ms 级联失败。

**修复**（TESTFIX-05）：在 `douban.test.ts` / `moderationStats.test.ts` 中添加
`vi.mock('@/api/services/CrawlerRunService', () => ({ CrawlerRunService: class {} }))` 拦截模块加载。

<details>
<summary>A-01 ~ A-13（已修复，展开查看）</summary>

#### A-01
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::未登录返回 401`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-02
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::moderator 权限返回 403`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-03
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::user 权限返回 403`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-04
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::匹配成功时返回 200 updated:true 和 fields`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-05
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::搜索无结果降级返回 updated:false reason:no_match，不抛 500`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-06
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::ID 格式非法返回 404`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-07
- **test_id**: `unit::moderationStats::GET /admin/videos/moderation-stats::返回统计数据`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-08
- **test_id**: `unit::moderationStats::GET /admin/videos/moderation-stats::未认证 → 401`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-09
- **test_id**: `unit::moderationStats::GET /admin/videos/moderation-stats::interceptRate 无数据时为 null`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-10
- **test_id**: `unit::moderationStats::GET /admin/videos/pending-review::返回待审列表，含 firstSourceUrl`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-11
- **test_id**: `unit::moderationStats::GET /admin/videos/pending-review::分页参数传递给查询层`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-12
- **test_id**: `unit::moderationStats::GET /admin/videos/pending-review::无效分页参数 → 422`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

#### A-13
- **test_id**: `unit::moderationStats::GET /admin/videos/pending-review::未认证 → 401`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A | **处置**: fix | **里程碑**: TESTFIX-05（已完成）

</details>

---

### D 类：断言漂移 / 真 bug（单元，已修复）

根本原因：`apps/api/src/db/queries/externalData.ts` 和 `metadataProvenance.ts` 直接调用 `db.query<T>(sql)`（raw SQL 模式），但测试 mock 只提供 `db: {}` 空对象，没有 `query` 方法。

**修复**（TESTFIX-05）：mock `@/api/db/queries/externalData` 和 `@/api/db/queries/metadataProvenance`；
补全 `safeUpdate` 第 4 参数 `{ sourceRef: subjectId }` 断言。

<details>
<summary>D-01 ~ D-03（已修复，展开查看）</summary>

#### D-01
- **test_id**: `unit::stagingDouban::DoubanService.confirmSubject::成功写入豆瓣信息并更新 douban_status=matched`
- **suite**: `tests/unit/api/stagingDouban.test.ts`
- **类别**: D | **处置**: fix | **里程碑**: TESTFIX-05（已完成）
- **原因**: `db.query is not a function`：`upsertVideoExternalRef` 调用 raw `db.query`，但 mock 提供 `db: {}`

#### D-02
- **test_id**: `unit::stagingDouban::DoubanService.confirmSubject::meta_score 正确计算（所有字段齐全 → 100）`
- **suite**: `tests/unit/api/stagingDouban.test.ts`
- **类别**: D | **处置**: fix | **里程碑**: TESTFIX-05（已完成）
- **原因**: 同 D-01

#### D-03
- **test_id**: `unit::douban::DoubanService.syncVideo::匹配成功时更新 catalog，返回 updated:true`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: D | **处置**: fix | **里程碑**: TESTFIX-05（已完成）
- **原因**: `db.query is not a function`：`getHardLockedFields` 调用 raw `db.query`，mock 未提供该方法

</details>

---

## E2E 测试失败明细

### web-chromium — homepage.spec.ts（6 失败，全部 C 类）

根本原因：导航栏重构后移除或重命名了若干 `data-testid`，导致测试找不到元素。
`nav-login` 缺失引发语言切换测试及点击登录测试级联失败。

---

#### C-10
- **test_id**: `e2e::homepage.spec.ts::首页::导航栏显示分类标签`
- **suite**: `tests/e2e/homepage.spec.ts`
- **类别**: C
- **处置**: defer | **关联里程碑**: M2
- **原因**: `data-testid='nav-cat-all'` 在当前导航实现中不存在；M2 重写导航/分类组件时补齐

#### C-11
- **test_id**: `e2e::homepage.spec.ts::首页::底部免责声明常驻显示`
- **suite**: `tests/e2e/homepage.spec.ts`
- **类别**: C
- **处置**: defer | **关联里程碑**: M2
- **原因**: `data-testid='footer-disclaimer'` 在当前 Footer 实现中不存在；M2 重写 Footer 时补齐

#### C-12
- **test_id**: `e2e::homepage.spec.ts::首页::未登录时显示Sign In按钮`
- **suite**: `tests/e2e/homepage.spec.ts`
- **类别**: C
- **处置**: defer | **关联里程碑**: M2
- **原因**: `data-testid='nav-login'` 在当前导航栏中不存在；M2 重写导航时补齐

#### C-13
- **test_id**: `e2e::homepage.spec.ts::语言切换::切换到中文后页面为中文内容`
- **suite**: `tests/e2e/homepage.spec.ts`
- **类别**: C
- **处置**: defer | **关联里程碑**: M2
- **原因**: 语言切换依赖 `nav-login` 交互，`nav-login` 不存在导致级联失败

#### C-14
- **test_id**: `e2e::homepage.spec.ts::语言切换::切换回英文后页面为英文内容`
- **suite**: `tests/e2e/homepage.spec.ts`
- **类别**: C
- **处置**: defer | **关联里程碑**: M2
- **原因**: 同 C-13，语言切换前置条件 `nav-login` 缺失

#### C-15
- **test_id**: `e2e::homepage.spec.ts::导航跳转::点击Sign In跳转到登录页`
- **suite**: `tests/e2e/homepage.spec.ts`
- **类别**: C
- **处置**: defer | **关联里程碑**: M2
- **原因**: `getByTestId('nav-login')` 超时 30s，testid 不存在

---

### web-chromium — auth.spec.ts（15 失败，全部 C 类）

根本原因：登录/注册表单的 DOM 选择器已变更（`#login-identifier`、`#login-password`、`login-submit`、`register-submit` 等 ID 或 testid 不再匹配当前实现），导致所有 15 个 auth 测试全部失败。

---

#### C-16
- **test_id**: `e2e::auth.spec.ts::登录页::登录页正常加载显示账号和密码输入框`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: `#login-identifier` 不在登录页 DOM 中；M4 重写 Auth 时对齐 testid

#### C-17
- **test_id**: `e2e::auth.spec.ts::登录页::空表单提交显示必填验证错误`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: `login-submit` testid 不存在

#### C-18
- **test_id**: `e2e::auth.spec.ts::登录页::空账号提交显示账号必填错误`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: `#login-identifier` fill 失败（元素不存在）

#### C-19
- **test_id**: `e2e::auth.spec.ts::登录页::用户完成登录后跳转到首页`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 同 C-18，登录表单 ID 已变更

#### C-20
- **test_id**: `e2e::auth.spec.ts::登录页::登录后导航栏显示用户名`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 同 C-18，级联失败

#### C-21
- **test_id**: `e2e::auth.spec.ts::登录页::登录失败401显示错误提示`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 同 C-18

#### C-22
- **test_id**: `e2e::auth.spec.ts::登录页::点击注册链接跳转到注册页`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 注册链接 testid 漂移，URL 断言失败

#### C-23
- **test_id**: `e2e::auth.spec.ts::注册页::注册页正常加载显示三个输入框`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 注册表单输入框 ID/testid 不在 DOM 中

#### C-24
- **test_id**: `e2e::auth.spec.ts::注册页::空表单提交显示用户名必填错误`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: `register-submit` testid 不存在

#### C-25
- **test_id**: `e2e::auth.spec.ts::注册页::密码少于8位显示密码长度错误`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 注册表单输入框 ID 已变更

#### C-26
- **test_id**: `e2e::auth.spec.ts::注册页::用户完成注册后跳转到首页`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 注册表单 ID 不存在

#### C-27
- **test_id**: `e2e::auth.spec.ts::注册页::注册后导航栏显示用户名`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 同 C-26，级联

#### C-28
- **test_id**: `e2e::auth.spec.ts::注册页::重复邮箱422CONFLICT显示冲突错误`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 注册表单 ID 不存在

#### C-29
- **test_id**: `e2e::auth.spec.ts::注册页::点击登录链接跳转到登录页`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 登录链接 testid 漂移

#### C-30
- **test_id**: `e2e::auth.spec.ts::登出流程::登出后导航栏不显示用户名`
- **suite**: `tests/e2e/auth.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M4
- **原因**: 超时 30s 等待 `#login-identifier`（登录前置步骤失败）

---

### web-chromium — player.spec.ts（7 失败，全部 C 类）

（C-01 ~ C-07，原 TESTFIX-03 已记录，内容不变）

#### C-01
- **test_id**: `e2e::player.spec.ts::电影详情页::立即观看按钮指向播放页`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M3
- **原因**: 测试期望 `/watch/{shortId}`，代码生成 `/watch/{title-slug}-{shortId}`；URL 格式已在 ADR-034 确认，测试需同步更新

#### C-02
- **test_id**: `e2e::player.spec.ts::动漫详情页（多集）::点击第 3 集跳转到播放页 ep 3`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M3
- **原因**: 同 C-01，href 格式不匹配

#### C-03
- **test_id**: `e2e::player.spec.ts::播放页（PlayerShell）::标题链接指向详情页`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M3
- **原因**: `data-testid='back-to-detail-link'` 在当前 PlayerShell 实现中不存在；M3 重写 PlayerShell 时补齐

#### C-04
- **test_id**: `e2e::player.spec.ts::播放页（PlayerShell）::剧场模式切换按钮可见（大屏设备）`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M3
- **原因**: `data-testid='theater-mode-btn'` 未渲染；M3 重写 PlayerShell 时实现剧场模式并补 testid

#### C-05
- **test_id**: `e2e::player.spec.ts::播放页（多集动漫）::显示右侧选集面板`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M3
- **原因**: `data-testid='player-side-panel'` 未渲染；M3 重写播放器时实现选集面板

#### C-06
- **test_id**: `e2e::player.spec.ts::播放页（多集动漫）::选集面板显示正确数量`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M3
- **原因**: `side-episode-*` testid 全部缺失（0 elements），M3 重写时补齐

#### C-07
- **test_id**: `e2e::player.spec.ts::PLAYER-10 播放页完整链路::DanmakuBar 存在于播放页中（data-testid=danmaku-bar）`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M5
- **原因**: `data-testid='danmaku-bar'` 未渲染；弹幕功能已在 e601ea2 移除，M5 重新接入时恢复 testid

---

### web-chromium — search.spec.ts（2 失败，全部 C 类）

（C-08 ~ C-09，原 TESTFIX-03 已记录，内容不变）

#### C-08
- **test_id**: `e2e::search.spec.ts::分类浏览页::点击类型筛选后结果更新（只显示该类型）`
- **suite**: `tests/e2e/search.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M2
- **原因**: `data-testid='result-count'` 显示文本与断言期望不符；M2 重写搜索/筛选页时对齐 testid 与文案

#### C-09
- **test_id**: `e2e::search.spec.ts::搜索页::点击结果卡片跳转到播放页`
- **suite**: `tests/e2e/search.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M3
- **原因**: `result-card` href 未匹配 `/watch/` 模式；与 C-01 同根因，M3 统一修复 watch URL 格式

---

### admin-chromium — admin.spec.ts（18 失败：C×15 + D×3）

#### C-31
- **test_id**: `e2e::admin.spec.ts::权限控制::未登录访问/admin重定向到登录页`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 重定向目标 URL 格式变更（含 locale prefix / callbackUrl 参数不匹配）

#### C-32
- **test_id**: `e2e::admin.spec.ts::权限控制::未登录访问/admin/videos重定向到登录页`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 同 C-31

#### C-33
- **test_id**: `e2e::admin.spec.ts::权限控制::role=user访问/admin重定向到403页面`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 403 重定向 URL 或页面路径格式变更

#### C-34
- **test_id**: `e2e::admin.spec.ts::权限控制::role=user访问/admin/videos重定向到403页面`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 同 C-33

#### C-35
- **test_id**: `e2e::admin.spec.ts::权限控制::role=moderator访问/admin/users重定向到403`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 403 重定向 URL 漂移

#### C-36
- **test_id**: `e2e::admin.spec.ts::权限控制::role=moderator访问/admin/crawler重定向到403`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 同 C-35

#### C-37
- **test_id**: `e2e::admin.spec.ts::权限控制::role=moderator访问/admin/analytics重定向到403`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 同 C-35

#### C-38
- **test_id**: `e2e::admin.spec.ts::侧边栏::admin侧边栏显示系统管理区`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: `system-admin-section` testid 在当前后台侧边栏实现中不存在

#### C-39
- **test_id**: `e2e::admin.spec.ts::侧边栏::admin侧边栏有返回前台链接`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: `back-to-frontend` testid 不在侧边栏中

#### C-40
- **test_id**: `e2e::admin.spec.ts::侧边栏::moderator侧边栏同样有返回前台链接`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 同 C-39，moderator 角色同样失败

#### C-41
- **test_id**: `e2e::admin.spec.ts::视频管理::视频列表页渲染并显示状态筛选器`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 视频状态筛选器 testid 不在视频列表页 DOM 中

#### C-42
- **test_id**: `e2e::admin.spec.ts::投稿审核::投稿审核页面显示待审列表`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: `pending-review` 列表 testid 不在审核页面中

#### C-43
- **test_id**: `e2e::admin.spec.ts::字幕审核::字幕审核页面显示待审列表`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 字幕审核列表 testid 不存在

#### C-44
- **test_id**: `e2e::admin.spec.ts::用户管理::用户管理页面显示用户列表`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 用户列表 testid 不在用户管理页中

#### C-45
- **test_id**: `e2e::admin.spec.ts::采集控制台::采集控制台触发入口位于sites_tab`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 采集控制台 sites tab testid 不存在

---

#### D-04
- **test_id**: `e2e::admin.spec.ts::视频管理::点击上架触发PATCH请求`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: D | **处置**: defer | **关联里程碑**: TESTFIX-08
- **原因**: 超时 30s — 发布按钮点击后预期网络请求未触发；可能是 UI 交互契约变更（按钮位置/形态）

#### D-05
- **test_id**: `e2e::admin.spec.ts::投稿审核::点击通过触发approve请求`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: D | **处置**: defer | **关联里程碑**: TESTFIX-08
- **原因**: 超时 30s — approve 按钮未找到或点击未触发请求

#### D-06
- **test_id**: `e2e::admin.spec.ts::用户管理::点击封号触发ban请求`
- **suite**: `tests/e2e/admin.spec.ts`
- **类别**: D | **处置**: defer | **关联里程碑**: TESTFIX-08
- **原因**: 超时 30s — ban 按钮未找到或点击未完成

---

### admin-chromium — admin-source-and-video-flows.spec.ts（2 失败，全部 D 类）

#### D-07
- **test_id**: `e2e::admin-source-and-video-flows.spec.ts::视频操作::video_actions_dropdown_triggers_publish_and_douban_sync`
- **suite**: `tests/e2e/admin-source-and-video-flows.spec.ts`
- **类别**: D | **处置**: defer | **关联里程碑**: TESTFIX-08
- **原因**: 超时 30s — 下拉菜单交互未完成或网络请求未触发；dropdown 组件 API 可能已变更

#### D-08
- **test_id**: `e2e::admin-source-and-video-flows.spec.ts::审核流程::moderation_reject_submits_reason`
- **suite**: `tests/e2e/admin-source-and-video-flows.spec.ts`
- **类别**: D | **处置**: defer | **关联里程碑**: TESTFIX-08
- **原因**: 超时 30s — 拒绝操作未完成；reject 表单提交链路可能变更

---

### admin-chromium — publish-flow.spec.ts（2 失败：C×1 + D×1）

#### C-46
- **test_id**: `e2e::publish-flow.spec.ts::搜索验证::点击搜索结果进入详情页基本信息可见`
- **suite**: `tests/e2e/publish-flow.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M2
- **原因**: 视频详情页基本信息 testid 不存在（从 publish-flow 上下文访问详情页）

#### D-09
- **test_id**: `e2e::publish-flow.spec.ts::发布流程::管理员在视频列表中发布待审核视频状态变为已上架`
- **suite**: `tests/e2e/publish-flow.spec.ts`
- **类别**: D | **处置**: defer | **关联里程碑**: TESTFIX-08
- **原因**: 超时 30s — 后台视频列表发布操作未完成；与 D-04 同根因

---

### admin-chromium — video-governance.spec.ts（2 失败：C×1 + D×1）

#### C-47
- **test_id**: `e2e::video-governance.spec.ts::审核快捷键::happy_path_入库后在审核台按快捷键通过`
- **suite**: `tests/e2e/video-governance.spec.ts`
- **类别**: C | **处置**: defer | **关联里程碑**: M6
- **原因**: 审核台快捷键 UI testid 不存在；M6 审核台重写时补齐

#### D-10
- **test_id**: `e2e::video-governance.spec.ts::审核快捷键::reject_path_入库后在审核台按快捷键拒绝`
- **suite**: `tests/e2e/video-governance.spec.ts`
- **类别**: D | **处置**: defer | **关联里程碑**: TESTFIX-08
- **原因**: 超时 30s — 快捷键拒绝操作未完成；与 D-08 同链路

---

## 数字一致性备档

| 维度 | 数量 |
|------|------|
| 单元测试失败总数（当前）| 0（16 条由 TESTFIX-05 修复）|
| E2E 失败总数（全 8 suite）| 54 |
| C 类 | 47 |
| D 类 | 7 |
| 总计（当前基线）| 54 |
| defer 到 M2 | 4（C-08, C-11, C-12, C-46）|
| defer 到 M3 | 8（C-01~C-07, C-09）|
| defer 到 M4 | 15（C-16~C-30）|
| defer 到 M5 | 1（C-07）|
| defer 到 M6 | 16（C-31~C-45, C-47）|
| defer 到 TESTFIX-08 | 7（D-04~D-10）|

> 校验命令：`npm run verify:baseline -- --unit 0 --e2e 54 --total 54 --coverage-report`
