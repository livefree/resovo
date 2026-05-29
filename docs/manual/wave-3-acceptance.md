# Wave 3 验收报告（SEQ-20260528-MOD-WAVE3）

> status: 实施期收官 / 等待人工验收
> 收官日期：2026-05-28
> plan 依据：plan §14 Wave 3 + §17.2 Wave 3 增补
> 工程约束：plan §16.2 集中验收

---

## 1. Wave 3 总览

| 指标 | 数值 |
|---|---|
| **实施完成度** | 9/10（90%）+ 3 DEFERRED |
| **长尾清理** | 4/4 ✅ |
| **plan §14 主线** | 5/6 ✅（1 DEFERRED） |
| **新增 ADR** | 1（ADR-165 / 11 D-N 全闭环） |
| **arch-reviewer Opus 评审次数** | 3 轮（FOLLOWUP-AUTO-RETIRED-LABEL / PLAYER-ERROR / ROUTE-LABEL-D-ADR）|
| **Codex stop-time review** | 2 次（FIX + FIX-2 / 均已闭环） |
| **总 commit 数** | 13 |
| **门禁状态** | typecheck ✅ / lint ✅ / verify:adr-contracts ✅（EXIT=0）/ Wave 3 域单测 143/143 PASS |
| **Migration 新增** | 080（users.preferences JSONB）|
| **新端点** | 2（GET / PUT `/users/me/preferences`）|

---

## 2. 已完成卡片清单（9 张）

### 2.1 长尾清理 4 张

| # | TASK-ID | 改动要点 | commit | 测试 |
|---|---|---|---|---|
| 1 | **PRE-INDEX-DESIGN-RULES** | 索引设计 4 步核验 + 双 invariant + 四级范式 + 4 类禁令 + 6 项 Checklist 沉淀到 `docs/rules/db-rules.md`（CHG-368-B-A1-FIX 1-5 经验首次完整规范化）| `67bf693a` | N/A 纯 docs |
| 2 | **CHG-369-B** | 自定义主题输入完整 ship（CustomThemeDialog NEW + 双 key localStorage 协议 + CustomThemeData zod schema + RouteThemeSelector "自定义…" option + ✎ 编辑按钮）| `1e1fb61f` | 54/54 PASS |
| 3 | **CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW** | Layer B codename + retired_at 数据通路打通（listAdminSources LEFT JOIN source_line_aliases + SELECT 2 列 + ContentSourceRow 扩 2 字段 / PRE-INDEX-DESIGN-RULES 4 步核验首次显式应用）| `5321b6cc` | 34/34 PASS |
| 4 | **CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL** | LinesPanel 退役标识区分"（已退役·自动）/（已退役·手动）"（arch-reviewer Opus A- → Y-A-1/Y-A-2 全落升 A / 4 业务 + 1 测试 + 1 docs PATCH=6 接受完成度风险 / ADR-164 D-164-8 UI 兑现）| `c4564418` | 53/53 PASS |

### 2.2 plan §14 主线 5 张

| # | TASK-ID | 改动要点 | commit | 测试 |
|---|---|---|---|---|
| 5 | **CHG-SN-9-REJECTED-ENHANCE-A** | RejectedTab 分页 hook 抽取 + 接入（useRejectedQueue.ts NEW 152 行 / page+limit + activeIdx near-end loadMore + sessionStorage 持久化 + length>5 守卫修 spurious loadMore bug / plan §5 P2 rejected 写死 30 条 bug 闭环）| `97ca3946` | 8/8 PASS |
| 6 | **CHG-SN-9-PLAYER-ERROR** | player-core onError + suppressDefaultErrorUI public API（arch-reviewer Opus A- → 3 红线 + 4 黄线全落升 A / DEBT-FIX-D-ERROR API 端闭环 / ADR-108 兑现）| `bf8ecfc6` | 6/6 PASS |
| 7 | **CHG-SN-9-ROUTE-LABEL-D-ADR** | ADR-165 起草 + Opus A- CONDITIONAL → 5 红线 R-165-1/-2/-3/-4/-5 + 4 P1 黄线 + 2 关键洞察全消化 → 升 Accepted | `fd6e3f93` | N/A 纯 docs |
| 8 | **CHG-SN-9-ROUTE-LABEL-D-A1** | ADR-165 后端实施（Migration 080 inline CHECK + packages/types 5 zod schema + CUSTOM_THEME_CONSTRAINTS 真源迁移 + userPreferences queries NEW + UserPreferencesService NEW + 2 路由端点 + architecture.md §5.14 sync / D-165-1/-2/-3/-9 闭环）| `8c2d1b1b` | 8/8 PASS |
| 9 | **CHG-SN-9-ROUTE-LABEL-D-A2** | ADR-165 前端实施（useUserPreferencesSync NEW + useRouteTheme 接入 + RouteThemeSelector syncing + PlayerShell wiring / D-165-4/-5/-6/-7/-8/-11 闭环 / **ADR-165 全 11 D-N 闭环**）+ 2 FIX（FIX-1 区分用户存过 vs 默认 / FIX-2 hydration 守卫防 corrupt-storage 污染）| `87f20537` + `ba7cbcbb` + `77b0d403` | 11/11 PASS（4 + 4 + 3）|

---

## 3. DEFERRED 卡片清单（3 张）

| TASK-ID | DEFERRED 理由 | 后续承接 |
|---|---|---|
| **CHG-SN-9-MOD-BUTTON-MIGRATE** | 38 tsx 文件 / 100+ raw button 远超 PATCH 5 软上限 / 单卡推进需拆 7-8 个子卡 / 用户决策方案 A | 独立 SEQ-FOLLOWUP-MIGRATE 长尾系列择期推进（非 Wave 节奏）|
| **CHG-SN-9-META-BANGUMI-A** | plan §13 用户既有决策"§10.4.2 Bangumi - D. 暂缓 - 本轮不集成 Bangumi - 留下一轮迭代" / 用户决策组合 X | 下一轮迭代 |
| **CHG-SN-9-SITE-VIEWS-EXTRACT** | plan §10.6 方案 C 架构级跨 app 重构 / CLAUDE.md §16.5 "跨 app 影响范围扩大" BLOCKER 触发 / 用户决策组合 X | 独立 SEQ-FOLLOWUP-ARCH 长尾架构系列 |

---

## 4. ADR-165 全 11 D-N 决策点闭环

| D-N | 内容 | 承接卡 |
|---|---|---|
| D-165-1 | schema：users.preferences JSONB inline CHECK（Migration 080 / 077 范式对齐）| -A1 |
| D-165-2 | preferences shape：嵌套 + server passthrough + 客户端 strict 双 schema | -A1 |
| D-165-2a | 嵌套层级规约最多 3 层（§5a）| -A1 |
| D-165-3 | 端点契约：GET / PUT `/users/me/preferences` + preHandler auth + PUT 200 + body | -A1 |
| D-165-4 | 同步协议：mount 双阶段 GET + setTheme 时 debounce 500ms PUT | -A2 |
| D-165-5 | 登录迁移：server 空 + localStorage 真有用户存过的值 → PUT 迁移（**FIX-1 + FIX-2 修偏离实现**）| -A2 + FIX×2 |
| D-165-6 | 未登录态降级：CHG-369 + CHG-369-B 既有路径零回归 | -A2 |
| D-165-7 | 顶层模块 PATCH + 模块内 last-write-wins（JSONB merge SQL）| -A1 |
| D-165-8 | 错误处理 + sessionStorage `resovo:prefs-sync-failed-at` 静默重试 | -A2 |
| D-165-9 | CLAUDE.md "未登录访问 users 表" 红线规避 + admin 域 RBAC 副作用规避 | -A1 |
| D-165-10 | D-N 编号闭环 | 本卡 |
| D-165-11 | hydration mismatch 双阶段防御 + syncing UI disable | -A2 |

---

## 5. 数据通路总览

### 5.1 ADR-164 Layer B（Wave 2 + Wave 3 衔接）3 字段全通

```
source_line_aliases (Migration 079)
    │ codename / retired_at / auto_retired
    ▼
listAdminSources SELECT LEFT JOIN sla (CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW + AUTO-RETIRED-LABEL)
    │
    ▼
ContentSourceRow (apps/server-next / 扩 3 字段)
    │
    ▼
RawSourceRow (admin-ui / optional 3 字段 / ADR-164 alias 派生字段集同源不变式)
    │
    ▼
aggregate.ts groupSourcesByLine (取首行透传)
    │
    ▼
LineAggregate (admin-ui / autoRetired Y-A-1 invariant JSDoc)
    │
    ▼
LinesPanel UI (admin-ui)
    ├─ codename badge（CHG-368-B-C-UI）
    ├─ 退役行 opacity（CHG-368-B-C-UI）
    └─ "（已退役·{自动/手动}）" 文案 + aria-label + data-line-retired-auto（CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL）
```

### 5.2 ADR-165 跨设备主题同步全链

```
未登录态（场景 A）：
  useRouteTheme → 双 key localStorage（CHG-369 + CHG-369-B）/ 零网络

已登录态（场景 B）：
  mount 第 1 阶段：localStorage 即时 + setSyncing(true) disable 切换器
  mount 第 2 阶段：useUserPreferencesSync → GET /users/me/preferences
    - 200 + server.routeTheme 非空 → handleRemoteValue 单次受控 re-paint + 双 key localStorage 同步
    - 200 + server 空 + hasStoredTheme=true → 登录迁移 PUT 本地值（FIX-1/-2 守卫防默认值污染）
    - 401 / 网络错 → 静默降级
  mount 第 3 阶段：setSyncing(false) 解锁

用户操作 → setTheme/setCustomTheme/clearCustomTheme:
  → 即时双 key localStorage + setState（hasStoredTheme=true）
  → debounce 500ms → useUserPreferencesSync.putValue → PUT /users/me/preferences
    body: { routeTheme: { themeId, customTheme? } } 顶层模块 PATCH 语义
    SQL: UPDATE users SET preferences = preferences || $1::jsonb / 或 preferences - 'routeTheme'

跨设备同步（场景 C）：
  PC: setTheme → debounce → PUT server
  手机: 刷新/重打开 → mount 第 2 阶段 GET → server 值 → 应用
```

---

## 6. 建议用户亲手验收路径

### 6.1 LinesPanel 退役标识自动/手动区分（CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL）

**前置**：登录后台审核台 `/admin/moderation`，进入任一含线路的视频。

**步骤**：
1. 打开 LinesPanel（中栏线路列表）
2. 寻找 codename 已分配的线路（有山名 badge 显示）
3. 在另一个标签页执行：手动 POST `/admin/source-line-aliases/:siteKey/:name/retire` 退役该线路（reason 可选）
4. 回到审核台刷新 → 应看到该线路文案 "（已退役·手动）" + aria-label "线路手动退役"
5. 通过数据库直接 UPDATE `source_line_aliases SET auto_retired = true, retired_at = NOW()` 模拟 worker 自动退役 → 刷新 → 应看到 "（已退役·自动）" + aria-label "线路自动退役"
6. 检查 DOM：`[data-line-retired-label][data-line-retired-auto="true"]` 仅自动退役时存在该 attribute

### 6.2 RejectedTab 分页（CHG-SN-9-REJECTED-ENHANCE-A）

**前置**：登录审核台，确保已拒绝队列 > 30 条（如不足请先批量 reject 一批视频测试）。

**步骤**：
1. 切换到 "已拒绝" tab
2. 列表头部应显示 "30 / NNN 条已拒绝"（loaded / total）
3. 滚动列表到底部 → 应自动 loadMore（near-end 预取 / activeIdx >= length - 5 触发）
4. 或点击底部 "加载更多" 按钮 → page=2 + 追加新行
5. 加载完毕 → 显示 "已显示全部"
6. 点击任一行 → 中栏显示详情 + 可点 "↻ 重新审核" → 视频从列表移除 + total - 1

### 6.3 player-core onError + suppressDefaultErrorUI（CHG-SN-9-PLAYER-ERROR）

**前置**：本卡为 public API 扩展（消费方接入 留 follow-up CONSUMER-A/B/RETRY-CONTROL）。本验收仅验证 API 契约本身。

**步骤**：
1. 检查 `packages/player-core/src/types.ts`：`PlayerErrorCode` union 3 成员（'native_media_failed' | 'hls_fatal' | 'unknown'） + `PlayerErrorEvent` { code, src, fatal } + `PlayerProps.onError?` + `PlayerProps.suppressDefaultErrorUI?`
2. 检查 `apps/server-next/src/app/admin/moderation/_client/AdminPlayer.tsx` 仍含 DEBT-FIX-D-ERROR 占位（消费方接入留 CHG-SN-9-PLAYER-ERROR-CONSUMER-A）
3. （可选 / 高级）：在 web-next 任意页面挂载 Player + 传入故意非法 src（如 `'https://bogus.example/non-existent.m3u8'`） + onError callback → 应触发 native_media_failed 或 hls_fatal 事件
4. 验证默认 error overlay 仍渲染（suppressDefaultErrorUI 默认 false 保持 CHG-369 既有行为）

### 6.4 ADR-165 跨设备主题同步（CHG-SN-9-ROUTE-LABEL-D-A1 + A2 + 2 FIX）

**前置**：登录前台（如有）/ 或验证未登录态零回归。

#### 未登录态（场景 A 验证 / 既有路径零回归）

**步骤**：
1. 打开浏览器 incognito 模式（无 cookie）/ 或注销
2. 访问任意视频 watch 页 → sources tab 顶部 "主题" 下拉
3. 切换内置主题（节气 → NATO → ...）→ 应立即生效 + localStorage `resovo:route-theme` 写入
4. F12 → Application → Local Storage → 验证 `resovo:route-theme` 值正确
5. 刷新 → 仍应是上次选择的主题
6. F12 → Network → 验证**有** GET `/users/me/preferences` 请求（试探性 / 401 静默降级）但**无** PUT 请求（未登录 / 因 hasStoredTheme=false + 401 守卫）

#### 已登录态（场景 B + C 跨设备同步）

**步骤**：
1. 登录前台用户账号
2. 打开 watch 页 → sources tab → 注意切换器顶部短暂 disable + cursor wait + tooltip "正在同步偏好…"（D-165-11 syncing 状态 / mount GET 进行中）
3. 切换主题（如 jie_qi → nato）→ 立即生效 + localStorage 写入 + 500ms 后 PUT server
4. F12 → Network → 验证 PUT `/users/me/preferences` body = `{ "routeTheme": { "themeId": "nato" } }`
5. 在**另一设备**（或另一浏览器）登录同账号 → 打开 watch 页 → 主题应自动应用为 nato（mount GET 拉取 server 值）
6. 设置自定义主题 → 验证 PUT body 含 customTheme 完整字段
7. 调用 "清除自定义主题" → 验证主题回 default + PUT body 不含 customTheme

#### Corrupt/Partial 数据防御（FIX-1 + FIX-2 验证）

**步骤**：
1. 登录账号 + 设置过自定义主题（localStorage 双 key 都有值）
2. F12 → Application → Local Storage → 手动删除 `resovo:route-theme:custom`（保留 `resovo:route-theme` = 'custom'）
3. 刷新页面 → 主题应回 default（因 customTheme 数据缺失 / state hydration 失败）
4. F12 → Network → **不应**看到 PUT `/users/me/preferences` 把默认主题（jie_qi）误传到 server（FIX-2 守卫）
5. 检查 server preferences（用 admin DB 工具或 GET 端点）应仍保留之前的有效 routeTheme（未被默认值覆盖）

### 6.5 CustomThemeDialog 自定义主题（CHG-369-B）

**步骤**：
1. sources tab → 主题下拉切到 "自定义…"（无既有自定义时）→ 应打开 CustomThemeDialog
2. 输入：displayName = "我的主题" / labels textarea 输入多行 / deadLabel 留空
3. 实时校验：name 超 10 字符显示错误 / labels 超 30 个 / 单个 label 超 10 字符 提示精修
4. 保存 → 主题应用 + 立即写双 key localStorage
5. 重新打开 dialog（点 ✎ 编辑按钮）→ 表单回显既有数据
6. 点 "清除自定义主题" → 主题回 default

### 6.6 docs/manual sync 完整性

**验证文件**：
- `docs/manual/route-labeling.md` §8.4a + §8.7（跨设备同步协议 + 自定义主题 已 ship 2026-05-28）
- `docs/manual/route-labeling.md` §9（Layer B 实施记录）
- `docs/architecture.md` §5.14（users.preferences schema + 双 zod 范式）
- `docs/rules/db-rules.md`（索引设计 4 步核验 + 双 invariant + 四级范式）

---

## 7. 已 ship 文件清单

### 7.1 packages/types
- `packages/types/src/user.types.ts` 扩 5 zod schema + CUSTOM_THEME_CONSTRAINTS 常量 + User.preferences? 字段
- `packages/types/src/index.ts` 加 runtime exports

### 7.2 packages/player-core
- `packages/player-core/src/types.ts` 扩 PlayerErrorCode + PlayerErrorEvent + onError + suppressDefaultErrorUI
- `packages/player-core/src/Player.tsx` native onError 触发回调
- `packages/player-core/src/hooks/useSourceLoader.ts` HLS fatal 触发回调
- `packages/player-core/src/hooks/useOverlayManager.ts` suppressDefaultErrorUI 守卫
- `packages/player-core/src/Player/usePlayerOrchestration.ts` props 透传

### 7.3 packages/admin-ui
- `packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts` LineAggregate + RawSourceRow 扩 autoRetired
- `packages/admin-ui/src/components/composite/lines-panel/aggregate.ts` 取首行 auto_retired
- `packages/admin-ui/src/components/composite/lines-panel/lines-panel.tsx` 退役标识自动/手动 + data attribute

### 7.4 apps/api
- `apps/api/src/db/migrations/079_*.sql`（Wave 2 / 已 ship）
- `apps/api/src/db/migrations/080_users_preferences.sql` NEW
- `apps/api/src/db/queries/sources.ts` listAdminSources LEFT JOIN
- `apps/api/src/db/queries/userPreferences.ts` NEW
- `apps/api/src/services/UserPreferencesService.ts` NEW
- `apps/api/src/routes/users.ts` 扩 2 端点

### 7.5 apps/server-next
- `apps/server-next/src/lib/moderation/api.ts` ContentSourceRow 扩 3 字段
- `apps/server-next/src/app/admin/moderation/_client/useRejectedQueue.ts` NEW
- `apps/server-next/src/app/admin/moderation/_client/RejectedTabContent.tsx` 改造
- `apps/server-next/src/i18n/messages/zh-CN/moderation.ts` 扩 i18n keys

### 7.6 apps/web-next
- `apps/web-next/src/lib/route-theme-storage.ts` 改造 + FIX-1/-2 守卫
- `apps/web-next/src/lib/use-user-preferences-sync.ts` NEW
- `apps/web-next/src/components/player/RouteThemeSelector.tsx` syncing prop
- `apps/web-next/src/components/player/PlayerShell.tsx` wiring
- `apps/web-next/src/components/player/CustomThemeDialog.tsx` NEW

### 7.7 docs
- `docs/decisions.md` ADR-165 完整章节
- `docs/architecture.md` §5.14 users.preferences schema
- `docs/manual/route-labeling.md` §8.4a + §8.7 跨设备同步规范
- `docs/rules/db-rules.md` 索引设计 4 步核验章节
- `docs/changelog.md` 13 卡完整记录

### 7.8 测试
- `tests/unit/api/admin-sources-sql.test.ts` 扩 2 case
- `tests/unit/api/user-preferences.test.ts` NEW 8 case
- `tests/unit/components/admin-ui/composite/lines-panel/aggregate.test.ts` 扩 5 case
- `tests/unit/components/admin-ui/composite/lines-panel/lines-panel.test.tsx` 升级 + 扩 3 case
- `tests/unit/player-core/overlay-manager.test.ts` NEW 6 case
- `tests/unit/server-next/admin-moderation/use-rejected-queue.test.ts` NEW 8 case
- `tests/unit/web-next/route-theme-storage.test.ts` 扩 15 case
- `tests/unit/web-next/use-user-preferences-sync.test.ts` NEW 7 case
- `tests/unit/web-next/use-route-theme-sync-fix.test.tsx` NEW 7 case

---

## 8. 质量门禁最终状态

| 门禁 | 状态 |
|---|---|
| `npm run typecheck` | ✅ EXIT=0（root + 5 workspaces）|
| `npm run lint` | ✅ EXIT=0（仅 2 pre-existing react-hooks/exhaustive-deps warning 与 Wave 3 无关）|
| `npm run verify:adr-contracts` | ✅ EXIT=0（verify-endpoint-adr 199 路由 + verify-sql-schema-alignment 81 表 + verify-adr-d-numbers 266 D-N + verify-style-shorthand-conflict + verify-admin-shell-types-mirror + verify-enum-ssot advisory）|
| Wave 3 域单测合集 | ✅ 143/143 PASS（含 user-preferences 8 / use-user-preferences-sync 7 / use-route-theme-sync-fix 7 / use-rejected-queue 8 / overlay-manager 6 / route-theme-storage 20 / line-display-name-themes 34 / admin-sources-sql 5 / lines-panel 16 + aggregate 32）|

---

## 9. 验收签字

| 验收人 | 验收状态 | 备注 |
|---|---|---|
| 主循环 | ✅ 实施期完成 | 9/10 + 3 DEFERRED / 13 commits / 2 BLOCKER 解除 / 2 Codex FIX |
| arch-reviewer Opus | ✅ 3 轮独立评审通过 | FOLLOWUP-AUTO-RETIRED-LABEL A / PLAYER-ERROR A / ROUTE-LABEL-D-ADR A- → Accepted |
| 用户 | ⬜ 待验收 | 按本报告 §6 建议路径走一遍 |

---

## 10. 进入 Wave 4 的前置条件

- [x] Wave 3 实施期完成
- [x] 全门禁绿
- [x] 验收报告输出
- [ ] 用户/reviewer 走完 §6 建议路径
- [ ] 用户签字确认

签字后主循环可自动取 Wave 4 首卡继续（plan §16.5 全自动衔接）。

---

> 本验收报告由主循环 claude-sonnet-4-6 输出 / 子代理评审记录见 changelog 各卡 trailer。
