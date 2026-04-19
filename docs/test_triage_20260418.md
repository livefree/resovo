# 测试失败 Triage 文档 — 2026-04-18

> 对应 baseline：`docs/baseline_20260418/failing_tests.json`
> 产出来源：TESTFIX-03
> 适用规范：`docs/rules/workflow-rules.md §Phase 基线测试条款`

---

## 汇总

| 类型 | 失败数 | fix | quarantine | defer |
|------|--------|-----|------------|-------|
| A（基础设施）| 13 | 0 | 0 | 13 |
| B（架构真源冲突）| 0 | — | — | — |
| C（testid / DOM 漂移）| 9 | 0 | 0 | 9 |
| D（断言漂移 / 真 bug）| 3 | 3 | 0 | 0 |
| **合计** | **25** | **3** | **0** | **22** |

- 单元测试：16 条（A×13 + D×3）
- E2E（web-chromium）：9 条（C×9）

---

## 单元测试失败明细

### A 类：基础设施失败

根本原因：`apps/api/src/services/CrawlerService.ts` 在模块顶层 `import` 了 `apps/api/src/lib/config.ts`；
`config.ts` 在缺少必要环境变量时调用 `process.exit(1)`。
测试环境未设置这些变量，导致 Fastify `buildApp()` 在 `beforeEach` 阶段失败，`app` 变量不被赋值，
`afterEach(() => app.close())` 随即抛出 `Cannot read properties of undefined (reading 'close')`，
进而导致同 describe 块的后续测试全部以 0ms 级联失败。

**修复方向**（TESTFIX-05）：将 `config.ts` 的 `process.exit` 改为仅在生产入口触发，或在 CrawlerService 中延迟加载 config；同时在测试 setup 中 mock `@/api/services/CrawlerService`。

---

#### A-01
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::未登录返回 401`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: `buildApp()` 在 beforeEach 触发 `process.exit(1)` 导致 app 未初始化，afterEach 抛出 undefined.close()

#### A-02
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::moderator 权限返回 403`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-01，级联失败（beforeEach 失败后 app 为 undefined）

#### A-03
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::user 权限返回 403`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-02 级联

#### A-04
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::匹配成功时返回 200 updated:true 和 fields`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-02 级联

#### A-05
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::搜索无结果降级返回 updated:false reason:no_match，不抛 500`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-02 级联

#### A-06
- **test_id**: `unit::douban::POST /v1/admin/videos/:id/douban-sync::ID 格式非法返回 404`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-02 级联

#### A-07
- **test_id**: `unit::moderationStats::GET /admin/videos/moderation-stats::返回统计数据`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-01，同文件同根因

#### A-08
- **test_id**: `unit::moderationStats::GET /admin/videos/moderation-stats::未认证 → 401`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-07 级联

#### A-09
- **test_id**: `unit::moderationStats::GET /admin/videos/moderation-stats::interceptRate 无数据时为 null`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-07 级联

#### A-10
- **test_id**: `unit::moderationStats::GET /admin/videos/pending-review::返回待审列表，含 firstSourceUrl`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-07 级联

#### A-11
- **test_id**: `unit::moderationStats::GET /admin/videos/pending-review::分页参数传递给查询层`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-07 级联

#### A-12
- **test_id**: `unit::moderationStats::GET /admin/videos/pending-review::无效分页参数 → 422`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-07 级联

#### A-13
- **test_id**: `unit::moderationStats::GET /admin/videos/pending-review::未认证 → 401`
- **suite**: `tests/unit/api/moderationStats.test.ts`
- **类别**: A
- **处置**: defer
- **关联里程碑**: TESTFIX-05
- **原因**: 同 A-07 级联

---

### D 类：断言漂移 / 真 bug

根本原因：`apps/api/src/db/queries/externalData.ts` 和 `metadataProvenance.ts` 直接调用 `db.query<T>(sql)`（raw SQL 模式），但测试 mock 只提供 `db: {}` 空对象，没有 `query` 方法。

这是真实 bug 指示：生产代码已切换为 raw `db.query` 调用，但测试 mock 未跟进。需确认是 mock 过时（修 mock）还是生产代码误用 raw query（修源码）。

**修复方向**（TESTFIX-05）：在受影响测试的 `vi.mock('@/api/lib/postgres', ...)` 中为 `db` 增加 `query: vi.fn()` 方法，并补全相应的 mock 返回值。

---

#### D-01
- **test_id**: `unit::stagingDouban::DoubanService.confirmSubject::成功写入豆瓣信息并更新 douban_status=matched`
- **suite**: `tests/unit/api/stagingDouban.test.ts`
- **类别**: D
- **处置**: fix
- **关联里程碑**: TESTFIX-05
- **原因**: `db.query is not a function`：`upsertVideoExternalRef` 调用 raw `db.query`，但 mock 提供 `db: {}`

#### D-02
- **test_id**: `unit::stagingDouban::DoubanService.confirmSubject::meta_score 正确计算（所有字段齐全 → 100）`
- **suite**: `tests/unit/api/stagingDouban.test.ts`
- **类别**: D
- **处置**: fix
- **关联里程碑**: TESTFIX-05
- **原因**: 同 D-01，同函数路径

#### D-03
- **test_id**: `unit::douban::DoubanService.syncVideo::匹配成功时更新 catalog，返回 updated:true`
- **suite**: `tests/unit/api/douban.test.ts`
- **类别**: D
- **处置**: fix
- **关联里程碑**: TESTFIX-05
- **原因**: `db.query is not a function`：`getHardLockedFields` 调用 raw `db.query`，mock 未提供该方法

---

## E2E 测试失败明细（web-chromium）

所有 9 条均为 C 类（testid / href 漂移），全部 defer 至对应重写里程碑，不进入本 Phase 修复队列。

---

### C 类：testid / DOM 漂移（href 格式）

---

#### C-01
- **test_id**: `e2e::player.spec.ts::电影详情页::立即观看按钮指向播放页`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M3
- **原因**: 测试期望 `/watch/{shortId}`，代码生成 `/watch/{title-slug}-{shortId}`；URL 格式已在 ADR-034 确认，测试需同步更新

#### C-02
- **test_id**: `e2e::player.spec.ts::动漫详情页（多集）::点击第 3 集跳转到播放页 ep 3`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M3
- **原因**: 同 C-01，href 格式不匹配

#### C-03
- **test_id**: `e2e::player.spec.ts::播放页（PlayerShell）::标题链接指向详情页`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M3
- **原因**: `data-testid='back-to-detail-link'` 在当前 PlayerShell 实现中不存在；M3 重写 PlayerShell 时补齐

#### C-04
- **test_id**: `e2e::player.spec.ts::播放页（PlayerShell）::剧场模式切换按钮可见（大屏设备）`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M3
- **原因**: `data-testid='theater-mode-btn'` 未渲染；M3 重写 PlayerShell 时实现剧场模式并补 testid

#### C-05
- **test_id**: `e2e::player.spec.ts::播放页（多集动漫）::显示右侧选集面板`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M3
- **原因**: `data-testid='player-side-panel'` 未渲染；M3 重写播放器时实现选集面板

#### C-06
- **test_id**: `e2e::player.spec.ts::播放页（多集动漫）::选集面板显示正确数量`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M3
- **原因**: `side-episode-*` testid 全部缺失（0 elements），M3 重写时补齐

#### C-07
- **test_id**: `e2e::player.spec.ts::PLAYER-10 播放页完整链路::DanmakuBar 存在于播放页中（data-testid=danmaku-bar）`
- **suite**: `tests/e2e/player.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M5
- **原因**: `data-testid='danmaku-bar'` 未渲染；弹幕功能已在 e601ea2 移除，M5 重新接入时恢复 testid

#### C-08
- **test_id**: `e2e::search.spec.ts::分类浏览页::点击类型筛选后结果更新（只显示该类型）`
- **suite**: `tests/e2e/search.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M2
- **原因**: `data-testid='result-count'` 显示文本与断言期望不符；M2 重写搜索/筛选页时对齐 testid 与文案

#### C-09
- **test_id**: `e2e::search.spec.ts::搜索页::点击结果卡片跳转到播放页`
- **suite**: `tests/e2e/search.spec.ts`
- **类别**: C
- **处置**: defer
- **关联里程碑**: M3
- **原因**: `result-card` href 未匹配 `/watch/` 模式；与 C-01 同根因，M3 统一修复 watch URL 格式

---

## 数字一致性备档

| 维度 | 数量 |
|------|------|
| 单元测试失败总数 | 16 |
| E2E 失败总数（web-chromium） | 9 |
| 总计 | 25 |
| 本 Phase 内 fix（D 类）| 3 |
| defer 到 TESTFIX-05（A + D 类）| 16 |
| defer 到 M2–M5（C 类）| 9 |

> 校验命令：`npm run verify:baseline -- --unit 16 --e2e 9 --total 25`
