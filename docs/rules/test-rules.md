# Resovo（流光） — 测试规范

> AI 在每个任务完成后，按本文件判断需要写什么测试、运行什么命令。
> 测试全部通过才能执行 git commit。

---

## 测试分工原则

两套工具职责严格分离，不重叠：

| 工具 | 负责验证 | 不负责 |
|------|---------|--------|
| **Vitest** | 数据采集/解析/映射的正确性；组件状态与逻辑；播放器内部状态机；工具函数；API Service 层业务逻辑 | 真实浏览器行为、页面跳转 |
| **Playwright** | 真实用户流程的可用性（搜索→结果→播放→切换）；页面跳转；断点续播；后台操作；跨组件交互 | 内部实现细节、单元逻辑 |

**判断依据**：这个验证需要"真实浏览器 + 真实页面"吗？是 → Playwright；否 → Vitest。

---

## 测试文件位置

```
tests/
├── unit/                        ← Vitest
│   ├── api/                     ← 后端 Service 和路由
│   │   ├── auth.test.ts
│   │   ├── videos.test.ts
│   │   ├── search.test.ts
│   │   ├── sources.test.ts
│   │   ├── subtitles.test.ts
│   │   ├── danmaku.test.ts
│   │   ├── lists.test.ts
│   │   └── crawler.test.ts
│   ├── components/              ← 前端组件逻辑
│   │   ├── player/
│   │   │   ├── ControlBar.test.tsx
│   │   │   ├── EpisodeOverlay.test.tsx
│   │   │   ├── SpeedPanel.test.tsx
│   │   │   ├── CCPanel.test.tsx
│   │   │   └── DanmakuBar.test.tsx
│   │   └── search/
│   │       ├── FilterBar.test.tsx
│   │       └── MetaChip.test.tsx
│   ├── stores/                  ← Zustand store 状态逻辑
│   │   ├── playerStore.test.ts
│   │   └── authStore.test.ts
│   └── lib/
│       └── api-client.test.ts
├── e2e/                         ← Playwright
│   ├── search.spec.ts           ← 搜索流程
│   ├── player.spec.ts           ← 播放、切换、续播
│   ├── auth.spec.ts             ← 登录/登出流程
│   ├── homepage.spec.ts         ← 首页加载与导航
│   └── admin.spec.ts            ← 后台操作
└── helpers/
    ├── factories.ts             ← 测试数据工厂
    ├── db.ts                    ← 数据库工具
    └── setup.ts                 ← 全局配置
```

---

## 各任务类型的测试要求

### INFRA 任务
不写测试文件，用验证脚本代替：
```bash
bash scripts/verify-env.sh
```
全部通过即视为验收，可以执行 commit。

---

### AUTH 任务

**Vitest（必须）— 采集与映射正确性**
```typescript
// tests/unit/api/auth.test.ts

describe('register', () => {
  it('成功注册：密码被 bcrypt 哈希，返回正确用户结构')
  it('重复 email → 422 CONFLICT')
  it('重复 username → 422 CONFLICT')
  it('密码少于 8 位 → 422 VALIDATION_ERROR')
  it('locale 字段正确写入数据库，默认值为 en')
})

describe('login', () => {
  it('正确凭据：access_token 在响应 body，Set-Cookie 包含 refresh_token')
  it('access_token payload 包含 userId 和 role')
  it('错误密码 → 401，不泄露"密码错误"还是"用户不存在"')
  it('refresh_token cookie 是 HttpOnly + Secure + SameSite=Strict')
})

describe('refresh', () => {
  it('有效 cookie → 返回新 access_token')
  it('无 cookie → 401')
  it('黑名单中的 token → 401')
  it('并发刷新请求只执行一次，不重复写黑名单')
})

describe('logout', () => {
  it('登出后该 refresh_token 加入 Redis 黑名单')
  it('登出后立即刷新 → 401')
  it('登出清除 Set-Cookie')
})
```

**Playwright（必须）— 用户流程可用性**
```typescript
// tests/e2e/auth.spec.ts
test('用户完成 注册 → 登录 → 查看个人中心 → 登出 完整流程')
test('登录后导航栏显示用户名和头像')
test('登出后访问需要登录的页面重定向到登录页')
test('access_token 过期后操作自动续签，用户无感知')
```

---

### VIDEO / SEARCH 任务

**Vitest（必须）— 数据映射与过滤逻辑**
```typescript
// tests/unit/api/videos.test.ts
describe('GET /videos', () => {
  it('type 过滤：只返回指定类型')
  it('year 过滤：只返回指定年份')
  it('sort=rating：评分从高到低排列')
  it('分页：page=2 返回正确偏移量的数据')
  it('响应结构包含 pagination.hasNext')
})

describe('GET /videos/:id', () => {
  it('通过 short_id 查询，返回 director/cast/writers 数组')
  it('不存在的 short_id → 404 NOT_FOUND')
  it('已软删除的视频 → 404，不出现在结果中')
})

// tests/unit/api/search.test.ts
describe('GET /search', () => {
  it('director 精确匹配：只返回该导演的作品')
  it('actor 精确匹配：只返回含该演员的作品')
  it('writer 精确匹配：只返回含该编剧的作品')
  it('q 为空但有 director 参数：正常返回结果')
  it('highlight 字段包含 <em> 标记')
  it('lang 过滤：只返回有该语言字幕的视频')
})

describe('GET /search/suggest', () => {
  it('返回视频标题联想，type 字段为 video')
  it('返回人名联想，type 字段为 director/actor/writer')
  it('联想结果数量不超过 limit 参数')
})
```

**Playwright（必须）— 搜索流程可用性**
```typescript
// tests/e2e/search.spec.ts
test('用户在搜索框输入关键词，看到联想词下拉')
test('选择联想词后跳转到搜索结果页，URL 包含正确参数')
test('点击筛选条件，结果列表实时更新，URL 同步变化')
test('点击视频 MetaChip（如导演名）跳转到对应搜索结果页')
test('点击结果卡片的"立即观看"跳转到播放页')
test('刷新搜索结果页，筛选条件从 URL 参数恢复')
```

---

### PLAYER 任务

**Vitest（必须）— 播放器内部状态机与组件逻辑**
```typescript
// tests/unit/stores/playerStore.test.ts
describe('playerStore', () => {
  it('setEpisode 更新 currentEpisode，不影响其他字段')
  it('theaterMode 只能由 ControlBar 的 toggleTheater action 修改')
  it('speed 更新后，SpeedPanel 中对应预设高亮')
  it('danmakuEnabled 关闭后，danmakuOpacity 和 fontSize 状态保留')
})

// tests/unit/components/player/ControlBar.test.tsx
describe('ControlBar', () => {
  it('有下一集时渲染下一集按钮')
  it('没有下一集时不渲染下一集按钮')
  it('悬停下一集按钮，选集按钮 max-width 从 0 变为可见值')
  it('点击倍速面板中的预设，playerStore.speed 更新为对应值')
  it('拖动自定义滑条，speed 实时变化，面板不关闭')
  it('选择字幕后，playerStore.activeSubtitle 更新')
})

// tests/unit/components/player/EpisodeOverlay.test.tsx
describe('EpisodeOverlay', () => {
  it('打开时第一个集数 button 获得焦点')
  it('ArrowRight 将焦点移到下一个集数')
  it('ArrowDown 将焦点移到下一行（+8）')
  it('Enter 键确认选集，触发 onSelect 回调')
  it('Esc 键关闭浮层')
  it('点击浮层外部关闭浮层')
  it('当前集数的 button 有 cur 样式标识')
})

// tests/unit/components/player/SpeedPanel.test.tsx
describe('SpeedPanel', () => {
  it('8 个预设按钮全部渲染')
  it('当前速度对应的预设按钮高亮')
  it('滑条范围是 0.25 到 2，步进 0.05')
  it('点击预设后面板关闭')
  it('拖动滑条时面板保持打开')
})
```

**Playwright（必须）— 播放流程与交互可用性**
```typescript
// tests/e2e/player.spec.ts
test('从搜索结果点击视频，播放页正确加载视频信息和播放源')
test('Default Mode → Theater Mode 切换：右侧面板收起，播放器撑满')
test('Theater Mode → Default Mode 切换：右侧面板恢复')
test('打开选集浮层，用键盘方向键导航，按 Enter 切换集数')
test('切换字幕语言，Video.js 加载新字幕轨道')
test('设置播放进度到 30 秒，刷新页面，进度从 30 秒续播（断点续播）')
test('切换播放线路，视频重新加载')
test('弹幕开关 OFF 后，飞行弹幕消失；ON 后恢复')
test('按快捷键 T，剧场模式切换；按 F，全屏切换；按 Esc，关闭浮层')
```

---

### SUBTITLE 任务

**Vitest（必须）**
```typescript
// tests/unit/api/subtitles.test.ts
describe('GET /videos/:id/subtitles', () => {
  it('返回所有可用字幕，含 language/label/format/url 字段')
  it('is_verified=true 的字幕排在前面')
})

describe('POST /videos/:id/subtitles', () => {
  it('未登录上传 → 401')
  it('.srt 文件成功上传，返回文件 URL')
  it('超过 2MB 的文件 → 422')
  it('不支持的格式（如 .txt）→ 422')
})
```

**Playwright（可选，SUBTITLE-01 完成后补充）**
```typescript
test('登录用户点击"上传字幕"，选择文件，成功后 CC 面板出现新语言选项')
```

---

### CRAWLER 任务

**Vitest（必须）**
```typescript
// tests/unit/api/crawler.test.ts
describe('链接验证逻辑', () => {
  it('HTTP 200 的链接：is_active 更新为 true，last_checked 更新')
  it('HTTP 404 的链接：is_active 更新为 false')
  it('超时的链接：is_active 更新为 false，retry_count +1')
  it('retry_count 达到 3 后不再重试')
})
```

---

## 运行命令

```bash
# 类型检查（有报错不得 commit）
npm run typecheck

# Lint（有报错不得 commit）
npm run lint

# 单元测试（全部通过才 commit）
npm run test -- --run

# 单元测试 + 覆盖率报告
npm run test:coverage

# E2E 测试（PLAYER/AUTH/SEARCH/VIDEO 任务完成后运行）
npm run test:e2e

# 仅运行某个任务相关的测试（节省时间）
npm run test -- --run tests/unit/api/auth.test.ts
npm run test:e2e -- tests/e2e/player.spec.ts
```

---

## 测试失败处理规则

1. 失败 → 分析错误，修复代码，重跑
2. 修复后仍失败 → 换思路再尝试一次
3. **连续 2 次修复后仍失败 → 写入 BLOCKER，停止工作**

不允许通过修改测试断言来让测试通过（除非测试本身写错了，需在 BLOCKER 中说明）。

---

## 覆盖率参考目标（不阻断 commit，低于时在备注中说明）

| 路径 | 目标行覆盖率 |
|------|------------|
| `src/api/services/` | 80% |
| `src/api/routes/` | 70% |
| `src/api/db/queries/` | 60% |
| `src/components/player/` | 70% |
| `src/lib/api-client.ts` | 85% |
| `src/stores/` | 75% |
