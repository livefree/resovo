# Resovo 重写前 E2E 关键路径基线档案

> 建档日期：2026-04-18
> 分支：dev（commit 1fe3159）
> 用途：M2–M5 重写阶段的回滚判据——每个里程碑完成后对照本文档验证关键路径未回归
> 截图目录：`docs/baseline_20260418/screenshots/`
> 时序数据：`docs/baseline_20260418/timings.json`

---

## E2E 套件全局状态

| 维度 | 数值 |
|------|------|
| Playwright 版本 | 1.58.2 |
| 总测试数 | 181 |
| 通过数 | 85 |
| 失败数 | 96（全部为预存失败，详见下方说明） |
| 运行耗时 | 17.3 分钟 |
| 前台关键路径 | **4/6 通过**（播放器 3 条 + 搜索 1 条） |

### 预存失败说明（与本次重写无关）

1. **auth.spec.ts 全部失败**：commit `e601ea2` 已从前台移除用户认证 UI（删除了 `#login-identifier`、`#register-username` 等表单元素），登录/注册页面 E2E 测试全部失败为预期状态。重写阶段将重新实现登录 UI（M5+）。
2. **admin.spec.ts / admin-source-and-video-flows.spec.ts / video-governance.spec.ts / publish-flow.spec.ts 失败**：Admin 的认证中间件依赖真实 API 服务（`localhost:4000`），E2E 环境未启动 API，导致重定向断言失败。这是已知测试环境限制，非代码 bug。

---

## 关键路径 1：断点续播（Resume Playback）

- **截图**：`screenshots/homepage_resume_before.png`（首页加载状态，断点续播为运行时特性）
- **E2E 状态**：⚠️ 无独立 E2E 用例（功能在运行时由 `playerStore` + `localStorage` 驱动）
- **关键 DOM 节点**：
  - 续播提示条：`data-testid="resume-prompt"`（当 `localStorage[rv-progress-{shortId}-{episode}] > 30s` 时出现）
  - 从头播放按钮：`data-testid="resume-from-start"`
  - 继续播放按钮：`data-testid="resume-continue"`
- **前置条件**：用户之前访问过 `/watch/:slug`，且播放超过 30 秒（写入 localStorage）
- **断言点**：
  1. 再次访问同一播放页，8 秒内出现提示条
  2. 点击"继续播放"，视频从上次位置开始
  3. 点击"从头播放"，视频从 0:00 开始
- **重写期回归验收**：M3（播放器全局化）完成后，`playerStore.ts` 和 `localStorage` 逻辑不变，续播行为与基线一致
- **时序参考（首页）**：p50=1600ms, p95=2500ms

---

## 关键路径 2：线路切换（Source Switching）

- **截图**：`screenshots/source_switching_before.png`
- **E2E 状态**：✅ 通过（`player.spec.ts` PLAYER-10）
- **关键 DOM 节点**：
  - SourceBar 容器：`data-testid="source-bar"`
  - 线路按钮（n 从 0 起）：`data-testid="source-btn-{n}"`
  - 活跃状态：按钮 `style="background: var(--gold)"`
- **前置条件**：播放页 `/watch/:slug`，API mock 返回多条 `video_sources`
- **断言点**：
  1. `source-bar` 可见
  2. 所有线路按钮（source-btn-0 ~ source-btn-N）可见
  3. 点击 `source-btn-1` 后 PlayerShell 不崩溃，按钮视觉高亮
- **spec 位置**：`tests/e2e/player.spec.ts:281-303`（PLAYER-10 多线路测试）
- **重写期回归验收**：M3 播放器提升至 Root Layout 后，SourceBar 切换行为与此截图一致，`data-testid` 保持不变
- **时序参考（播放页）**：p50=1800ms, p95=2600ms

---

## 关键路径 3：影院模式（Theater Mode）

- **截图**：`screenshots/theater_mode_before.png`
- **E2E 状态**：✅ 通过（`player.spec.ts` 播放页 PlayerShell 测试）
- **关键 DOM 节点**：
  - 影院模式按钮：`data-testid="theater-mode-btn"`（桌面端可见，通过 CSS `@media` 在移动端隐藏）
  - 播放页容器：`data-testid="watch-page"`
  - PlayerShell：`data-testid="player-shell"`
  - 视频区域：`data-testid="player-video-area"`
- **前置条件**：桌面端（viewport ≥ 1280px）访问 `/watch/:slug`
- **断言点**：
  1. `theater-mode-btn` 附加到 DOM（`toBeAttached()`），桌面端可见
  2. 点击后播放区域扩展至全宽（CSS 类变更验证）
- **spec 位置**：`tests/e2e/player.spec.ts:156-162`
- **重写期回归验收**：M3 完成后，影院模式按钮仍通过 `data-testid="theater-mode-btn"` 可访问，FLIP 动画结束后播放区域全宽
- **时序参考（详情页）**：p50=1700ms, p95=2400ms

---

## 关键路径 4：字幕开关（Subtitle / Danmaku Toggle）

- **E2E 状态**：⚠️ 部分通过（DanmakuBar 可见性测试通过，字幕文件加载依赖后端）
- **关键 DOM 节点**：
  - 弹幕条：`data-testid="danmaku-bar"`
  - 弹幕开关：`data-testid="danmaku-toggle"`
  - 弹幕输入框：`data-testid="danmaku-input"`
- **前置条件**：访问 `/watch/:slug`，mock danmaku API 返回弹幕数据
- **断言点**：
  1. `danmaku-bar` 可见
  2. `danmaku-toggle` 可见（可点击切换开/关）
  3. `danmaku-input` 附加到 DOM
- **spec 位置**：`tests/e2e/player.spec.ts:305-320`（PLAYER-10 DanmakuBar 测试）
- **重写期回归验收**：M3 后 DanmakuBar 仍在 `player-shell` 内部，所有 `data-testid` 保持不变
- **备注**：字幕（subtitle）功能与弹幕（danmaku）是不同系统，字幕加载依赖真实字幕 API，E2E 未覆盖

---

## 关键路径 5：登录（Login）

- **截图**：`screenshots/login_before.png`（当前登录页 UI，前台 Auth UI 已被移除）
- **E2E 状态**：❌ 预存失败（见全局状态说明）
- **当前状态**：`/en/auth/login` 页面存在，但 `#login-identifier`、`#login-password` 等表单元素已被 commit e601ea2 移除
- **预期重建时间**：M5+ 页面重制阶段
- **重建后断言点（参考 auth.spec.ts）**：
  1. `#login-identifier` 可见
  2. `#login-password` 可见
  3. 提交后跳转到 `/en`（已登录）或显示错误提示
  4. 登录成功后 NavBar 显示用户名
- **回归基准**：登录 E2E 全绿（auth.spec.ts 所有登录页用例通过）

---

## 关键路径 6：搜索（Search）

- **截图**：`screenshots/search_before.png`
- **E2E 状态**：✅ 通过（`search.spec.ts` SEARCH-02）
- **关键 DOM 节点**：
  - 搜索输入框：`data-testid="search-input"`（也有 `#search-input`）
  - 搜索结果列表：`data-testid="search-results"`
  - 视频卡片：`data-testid="video-card-{shortId}"`
  - URL 参数同步：`?q=关键词&type=movie` 等
- **前置条件**：`/en/search`，mock 搜索 API 返回视频列表
- **断言点**：
  1. 输入搜索词后结果列表更新
  2. 类型筛选后 URL 同步 `?type=anime`
  3. 刷新后筛选状态恢复
  4. 点击 MetaChip（如导演）跳转到带 `?director=` 的 URL
- **spec 位置**：`tests/e2e/search.spec.ts` SEARCH-02 和 BROWSE-01 用例
- **重写期回归验收**：M5 搜索页重制后，所有 `data-testid` 保持不变，URL 参数语义不变
- **时序参考（搜索页）**：p50=1800ms, p95=2800ms

---

## 回归验收使用方式

每个里程碑完成后，对照本文档执行以下检查：

```bash
# 1. 运行 E2E 套件（需两个 dev server 在运行）
npx playwright test --project=web-chromium

# 2. 检查 6 条关键路径对应的测试用例全部通过
#    - player.spec.ts: 播放页 PlayerShell 加载、多线路 SourceBar、DanmakuBar
#    - search.spec.ts: SEARCH-02 搜索流程
#    - auth.spec.ts: 登录页（M5+ 重建后）

# 3. 视觉对比（可选，SSIM ≥ 0.98）
# 将新截图与 screenshots/*_before.png 对比
```

### 预存失败跟踪

| 失败类型 | 预计修复里程碑 | 状态 |
|----------|----------------|------|
| Auth UI 测试（登录/注册） | M5+（页面重制） | ⏳ 待重建 |
| Admin 中间件重定向测试 | 需启动 API 服务器 | ⏳ 环境依赖 |
