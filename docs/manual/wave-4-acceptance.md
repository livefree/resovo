# Wave 4 验收报告（SEQ-20260528-MOD-WAVE4）

> status: 实施期收官 / 等待人工验收
> 收官日期：2026-05-29
> plan 依据：W4-务实方案 / Wave 3 验收期推出的 follow-up 卡（CHG-SN-9-REJECTED-ENHANCE-B / -PLAYER-ERROR-CONSUMER-A / -B / -RETRY-CONTROL / PRE-DEAD-LINE-AUTO-RETIRE-WORKER ADR-164 A-164-1）+ Wave 3 验收期补丁 CODENAME-MATRIX e2e
> 工程约束：plan §16.2 集中验收 + plan §16.5 BLOCKER 触发清单 + CLAUDE.md "PATCH 卡范围 ≤ 5 项" 软上限

---

## 1. Wave 4 总览

| 指标 | 数值 |
|---|---|
| **实施完成度** | 6/6（100%）+ 0 DEFERRED |
| **plan 主线** | 5 follow-up 卡 + 1 验收期补丁 = 6 全 ship |
| **拆卡** | 2 拆（4-ADR + 4-EP / 5-A + 5-B）= 8 实施单元 |
| **新增 ADR** | 1（ADR-166 PlayerErrorControls / A- CONDITIONAL 等同 A-）|
| **完整闭环 ADR** | 1（ADR-164 D-164-8 schema → query → worker → UI 全链路）|
| **arch-reviewer Opus 评审次数** | 2 轮（ADR-166 / PRE-DEAD-LINE-WORKER）/ 均 A- CONDITIONAL / 红线全消化 |
| **Codex stop-time review** | 6 次 FIX 全闭环（player-error 3 + auto-retire 3）|
| **总 commit 数** | 13 commits（含 6 FIX）|
| **门禁状态** | typecheck ✅ / lint ✅ / verify:adr-contracts ✅（EXIT=0 / 每卡核验）|
| **Migration 新增** | 1（081 / source_line_aliases.dead_since）|
| **新端点** | 0（worker 范畴 / 不暴露 admin route）|
| **新增 cron job** | 1（worker auto-retire-line / 03:30 UTC daily）|

---

## 2. 已完成卡片清单（8 实施单元 / 6 业务卡 + 2 拆卡）

### 2.1 业务卡 4 张

| # | TASK-ID | 改动要点 | commit | 测试 |
|---|---|---|---|---|
| 1 | **CHG-SN-9-REJECTED-ENHANCE-B** | RejectedTab 视觉对齐：BTN_SM inline → AdminButton(×5) + 手写 flex → SplitPane 两栏 + AdminCheckbox 行勾选 + sticky 批量栏 + 客户端循环 batchReopen + useToast 跳回 pending 提示 / 共享原语占比 ~10% → ~75% | `4dbcf94b` | 11/11 PASS（既有 8 + 新 3）|
| 2 | **CHG-SN-9-PLAYER-ERROR-CONSUMER-A** | AdminPlayer 接入 player-core onError + POST `/v1/feedback/playback` `{success:false, errorCode}` 上报失败 + 独立 errorReportedRef per-sourceId 去抖 / **DEBT-FIX-D-ERROR 真正闭环**（Wave 3 #7 API 端 + 本卡 admin 端）| `7ddd641f` | 13/13 PASS（既有 8 + 新 5）|
| 3 | **CHG-SN-9-PLAYER-ERROR-CONSUMER-B** | PlayerShell onError 接入 + 标 dead-source + 环形扫下一可用 + POST feedback 上报 + per-(sourceId, errorCode) 去抖 / **R-N-3 警告闭环**（用 activeSourceIndex 关联而非 event.src）| `34797db8` | 4/4 PASS（NEW）|
| 6 | **CHG-SN-9-WAVE3-FOLLOWUP-CODENAME-MATRIX-E2E** | Wave 3 验收期补丁 CODENAME-MATRIX 的 e2e 补全：playwright 4 case（page-load + matrix open / available-pick → PUT codename / occupied-suggest modal → PUT codename-N / cooling-disabled 守卫）+ docs/manual route-labeling.md §9.10 + §9.11 sync | `d374576e` | 4/4 spec 注册 |

### 2.2 拆卡 #4 — PLAYER-ERROR-RETRY-CONTROL（ADR + EP）

| # | TASK-ID | 改动要点 | commit | 测试 |
|---|---|---|---|---|
| 4-ADR | **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-ADR** | ADR-166 起草（arch-reviewer Opus A- CONDITIONAL → 3 红线 R-166-1/-2/-3 + 5 P1 黄线全消化 = 等同 A-）+ player-core onError 签名扩为 `(event, controls)` 双参 + `PlayerErrorControls = {retry: () => void}` Object.freeze 单方法命令面 + wrappedOnError stub 让 useSourceLoader / usePlayerOrchestration 类型零改动 | `f33a0fde` | 5/5 PASS（NEW）|
| 4-ADR-FIX-1 | controls.retry 生命周期外溢守卫 | active 双层守卫：try { onError } finally { active=false } → 防 await/setTimeout/外部 ref 持有调用绕过 srcRef 守卫破缺契约（Codex stop-time review 第 1 轮）| `63711ff4` | 7/7 PASS（既有 5 重写 + 新 2）|
| 4-EP | **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-EP** | AdminPlayer 加"重试此线路"按钮 + sourceLoadVersion bump 强制 Player remount（Y-166-6 / 不用 controls.retry）+ PlayerShell handlePlayerError 重写：首次 fatal 同 tick 调 controls.retry + retryAttemptedSet per-idx 计数 + 3s watchdog setTimeout / 超时主动切线 / onPlay 成功 cancel + 重置 / 第二次 fatal 立即切线（Y-166-3）| `d13c9eab` | admin-player 15/15 + player-shell-on-error 6/6 + retry-control 7/7 = 28/28 PASS |
| 4-EP-FIX-2 | watchdog currentEpisode cleanup | useEffect cleanup on [currentEpisode] → clearWatchdog + retryAttemptedSetRef.clear()（Codex stop-time review 第 2 轮 / 防切集后 stale watchdog 误切线）| `5f2bc15e` | 7/7 PASS |
| 4-EP-FIX-3 | watchdog shortId cleanup | useEffect deps 扩 [currentEpisode, shortId] → 切视频同集场景 cleanup（Codex stop-time review 第 3 轮 / shortId 同步派生比 video.id 异步更早）| `67f46812` | 8/8 PASS |

### 2.3 拆卡 #5 — PRE-DEAD-LINE-AUTO-RETIRE-WORKER（A schema+queries / B worker）

| # | TASK-ID | 改动要点 | commit | 测试 |
|---|---|---|---|---|
| 5-A | **CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A** | arch-reviewer Opus A- CONDITIONAL → 推荐方案 D'（dead_since 加 alias 表 / worker 自维护 / 不动 probe/render 写路径）+ 4 红线 R-DEAD-1/2/3/4 全消化 + 5 P1 黄线落 / 不起 ADR-167（D-164-8 + 评审报告 + 实施指南 = 完整决策真源）/ Migration 081 + auto-retire-line.ts queries 4 段式 + architecture.md §5 sync + docs/manual/auto-retire-line-worker.md NEW | `b4184f8e` | 8/8 PASS |
| 5-A-FIX-1 | advisory lock 同 client + SQL 软删过滤 | pool.connect() 拿专用 PoolClient / 所有 query 用 client.query / lock + unlock 同 session + CTE LEFT JOIN 加 `vs.deleted_at IS NULL`（Codex stop-time review 第 4 轮）| `0b391152` | 8/8 PASS（既有 6 + 新 T9/T10）|
| 5-A-FIX-2 | unlock 失败 release(err) destroy connection | finally let unlockFailed = false / unlock catch 块 set true / `client.release(unlockFailed ? new Error : undefined)` 让 pool destroy connection 防 lock 泄漏到 pool（Codex stop-time review 第 5 轮）| `a9f6b9e3` | 10/10 PASS（既有 8 + 新 T11/T12）|
| 5-B | **CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B** | worker 层接入：runAutoRetireLine 调用 query + R-DEAD-4 RETURNING per-row 结构化日志 + batch_total log / cron config + index.ts 注册 cron 03:30 daily + startup/shutdown | `c08d1909` | 5/5 PASS |
| 5-B-FIX-3 | worker 撤回 apps/api 跨 app import / 内联 SQL | ADR-107 §4 真源："禁止 import apps/api 内部任何文件 / 零跨 workspace 代码耦合" → 内联完整 SQL 字面量 + 自包含 connection 管理 + 双源 SQL byte-identical 跨包同步约束（Codex stop-time review 第 6 轮）| `7f301dda` | 重写 10/10 PASS（5→10 case）|

---

## 3. ADR-166 完整 D-N 决策点

| D-N / R-N | 内容 | 承接位置 |
|---|---|---|
| §2 方案 A' vs B 否决 | onError(event, controls) 收敛版 / 否决 useImperativeHandle ref / 三大理由：player-core 范式一致性 + time-to-impact + 扩展性悖论 | ADR-166 §2 |
| R-166-1 | 删 suppressDefault() 仅留 retry() / 避免与 suppressDefaultErrorUI prop 双套机制 | types.ts + Player.tsx |
| R-166-2 | snapshotSrc 闭包 + srcRef.current 比对 + dev console.warn / 防异步 retry 作用于新 src | Player.tsx wrappedOnError + FIX-1 双层 active 守卫 |
| R-166-3 | retry void / 不抛错 / 不返回 Promise / fire-and-forget | types.ts jsdoc + Player.tsx |
| Y-166-1 | Object.freeze({ retry }) 防 monkey-patch | Player.tsx |
| Y-166-2 | retryAttemptRef + setAttribute 'data-retry-attempt' / src 变化 useEffect 重置 | Player.tsx |
| Y-166-3 | PlayerShell retry watchdog 3s 超时（shell 层职责）| -EP PlayerShell |
| Y-166-4 | retry 失败仍触发 onError / 消费方计数防死循环 | types.ts jsdoc |
| Y-166-5 | 默认 overlay Retry 按钮与 controls.retry 同源底层 | types.ts jsdoc |
| Y-166-6 | AdminPlayer 手动重试用 key bump remount / 不用 controls.retry | -EP AdminPlayer |

---

## 4. ADR-164 D-164-8 完整链路闭环（跨 Wave 2/3/4）

| 阶段 | 卡 | 承接 |
|---|---|---|
| schema | Wave 2 #13 ADR-164 | source_line_aliases.retired_at + auto_retired 字段 ship（Migration 079）|
| UI | Wave 3 #4 CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL | LinesPanel "已退役·自动" / "已退役·手动" 区分标识 |
| schema + query + docs | Wave 4 #5-A | Migration 081 dead_since + autoRetireLineByDeadCheck() + docs/manual/auto-retire-line-worker.md |
| worker + cron + 测试 | Wave 4 #5-B | runAutoRetireLine + cron 03:30 daily + 5/5 测试 |
| **完整链路** | — | worker cron → advisory lock → 段 1+2 维护 dead_since → 段 3 检测 + 退役 → RETURNING → 结构化日志 → LinesPanel UI |

---

## 5. 数据通路 & 关键路径

### 5.1 player-core onError 全链路（ADR-166 + Wave 3 #7 + Wave 4 #2/#3/#4）

```
原生 video error / HLS fatal
  → useSourceLoader onError?
  → Player.tsx wrappedOnError stub
  → wrappedOnErrorRef.current(event)
  → 构造 frozen controls {retry: () => {...active 守卫 + srcRef 守卫 + retrySourceLoad...}}
  → props.onError?.(event, controls)
  → 消费方 onError 回调:
      AdminPlayer: POST /feedback/playback {success:false, errorCode}
      PlayerShell: 首次 fatal 调 controls.retry + 启 3s watchdog → 超时切线 / onPlay 成功 cancel
```

### 5.2 auto-retire-line worker 全链路（ADR-164 D-164-8 / Wave 4 #5-A + #5-B）

```
cron 03:30 UTC daily
  → runWithLogger('auto-retire-line', runAutoRetireLine)
  → pool.connect() 拿专用 PoolClient
  → client.query pg_try_advisory_lock (非阻塞)
  → 段 1+2 CTE LEFT JOIN video_sources (vs.deleted_at IS NULL + is_active=true)
    → classified 三态 (orphan / all_dead / has_alive)
    → UPDATE source_line_aliases.dead_since CASE 守卫
  → 段 3 UPDATE retired_at + auto_retired WHERE dead_since < NOW() - 180 days + ORDER BY ASC LIMIT 50 + RETURNING
  → finally pg_advisory_unlock (acquired=true 时)
    → unlock 成功 → client.release()
    → unlock 失败 → client.release(err) destroy connection
  → log.info per row 'auto_retire_line.retired' + batch_total
  → LinesPanel UI 显示 "已退役·自动"
```

---

## 6. 建议用户亲手验收路径

### 6.1 RejectedTab 视觉对齐 + 批量 reopen（CHG-SN-9-REJECTED-ENHANCE-B）

1. 起 dev server → 进入 `/admin/moderation` → 切到「已拒绝」tab
2. 验证：列表行使用 `AdminCheckbox` 勾选 / 多选后底部 sticky 栏出现「已勾选 N 条 + 清空 + 批量重审 N 条」
3. 点击「批量重审」→ 全成功 toast「已跳回待审核 N 条」+ 部分失败 toast「已跳回 X 条 · Y 条失败」
4. 单条重审 toast「已跳回待审核 / 该视频已回到「待审核」队列」

### 6.2 player-core onError(event, controls) + retry（ADR-166 / Wave 4 #4）

#### 前台 PlayerShell 自动切线
1. 进入任意 watch 页（如 `/movie/test-slug-aB3kR9x1`）
2. 制造 fatal 错误（如 chrome devtools → Network → 把当前 m3u8 设为 Block request URL）
3. 验证：首次 fatal 不立即切线 / 3s 内若 retry 成功 → 继续播 / 3s 后仍 fatal → 自动切下一线路 + SourceBar 显示原线路 dead

#### 后台 AdminPlayer 手动重试
1. 进入 `/admin/moderation` → 选择视频 → 选线路播放
2. 点击播放器右上"↻ 重试此线路"按钮
3. 验证：Player 重 mount（视频从头加载）/ errorReportedRef 清空 / 同 sourceId 再 fatal 允许新一次 feedback POST

### 6.3 auto-retire-line worker（ADR-164 D-164-8 / Wave 4 #5）

1. **离线验证**：起 worker 进程 → 等到 cron 03:30 触发 / 或手动调用 `runAutoRetireLine(db, log)` 一次
2. **DB 验证 SQL**：
   ```sql
   SELECT source_site_key, source_name, dead_since, retired_at, auto_retired
   FROM source_line_aliases
   WHERE retired_at IS NOT NULL AND auto_retired = true
   ORDER BY retired_at DESC LIMIT 10;
   ```
3. **UI 验证**：进入 `/admin/source-line-aliases` → 已退役行显示「已退役·自动」标识

### 6.4 CODENAME-MATRIX-PICKER e2e（Wave 3 验收期补丁 / Wave 4 #6）

1. 进入 `/admin/source-line-aliases`
2. 点击未分配的 codename 列单元格 → matrix modal 打开 + 52 山名 grid 可见
3. 测 3 路径：
   - **available**：点击 `泰山`（未占用）→ PUT codename + modal close + toast 成功
   - **occupied**：点击 `泰山`（已占用）→ suggest modal 弹「使用 泰山-2？」→ 接受 → PUT codename=`泰山-2`
   - **cooling**：点击 retired_at < 90 天前的山名 → button disabled + title「剩 X 天可复用」

### 6.5 docs/manual sync 完整性

| docs | Wave 4 sync 内容 |
|---|---|
| `docs/decisions.md` | ADR-166（PlayerErrorControls / §1-§12）|
| `docs/architecture.md` | §5 source_line_aliases 加 dead_since 字段 + 部分索引（Migration 081）|
| `docs/manual/auto-retire-line-worker.md` | NEW 11 节运维手册（业务规则 / dead_since 状态机 / cron / batch / advisory lock 同 client / 误报恢复 / R-MID-1 不触发 / follow-up）|
| `docs/manual/route-labeling.md` | §9.10 CODENAME-MATRIX-PICKER 完整文档 + §9.11 e2e 测试映射 |
| `docs/changelog.md` | 13 条目（含 6 FIX）|
| `docs/task-queue.md` | SEQ-20260528-MOD-WAVE4 段头部状态 ⬜ → ✅ 收官 |
| `docs/tasks.md` | Wave 4 段从「待启动」改「实施期收官」+ 删过期会话指引 |
| **本报告** | NEW `docs/manual/wave-4-acceptance.md` |

---

## 7. 已 ship 文件清单

### 7.1 -ADR / 共享层

- `docs/decisions.md` — ADR-166 §1-§12 全文
- `packages/player-core/src/types.ts` — `PlayerErrorControls` interface + `PlayerProps.onError` 签名扩第 2 参
- `packages/player-core/src/Player.tsx` — wrappedOnError stub + srcRef + retryAttemptRef + active 双层守卫 + data-retry-attempt setAttribute

### 7.2 admin（apps/server-next）

- `apps/server-next/src/app/admin/moderation/_client/RejectedTabContent.tsx` — SplitPane + AdminButton + AdminCheckbox + 批量栏 + toast
- `apps/server-next/src/app/admin/moderation/_client/useRejectedQueue.ts` — selectedIds + batchReopen + BatchReopenResult
- `apps/server-next/src/app/admin/moderation/_client/AdminPlayer.tsx` — onError 接入 + errorReportedRef + 重试按钮 + sourceLoadVersion key bump

### 7.3 前台（apps/web-next）

- `apps/web-next/src/components/player/PlayerShell.tsx` — handlePlayerError 重写 + retry watchdog 3s + retryAttemptedSetRef + clearWatchdog + [currentEpisode, shortId] cleanup

### 7.4 worker（apps/worker）

- `apps/worker/src/jobs/auto-retire-line.ts` NEW — runAutoRetireLine + 内联 SQL (ADR-107 §4) + 4 段工作流 + R-DEAD-1/2/3/4 全吸收
- `apps/worker/src/index.ts` — 注册 cron task + startup / shutdown
- `apps/worker/src/config.ts` — `cron.autoRetireLine`

### 7.5 apps/api（D-164-8 query 参考实现 / 不被 worker 消费 / 留作 admin API 端点未来用）

- `apps/api/src/db/queries/auto-retire-line.ts` — `autoRetireLineByDeadCheck()` 函数 + 10/10 单测
- `apps/api/src/db/migrations/081_source_line_aliases_dead_since.sql`
- `docs/architecture.md` §5 source_line_aliases.dead_since 字段说明

### 7.6 docs/manual

- `docs/manual/auto-retire-line-worker.md` NEW
- `docs/manual/route-labeling.md` §9.10 + §9.11
- **本报告** `docs/manual/wave-4-acceptance.md` NEW

### 7.7 测试

| 文件 | case 数 |
|---|---|
| `tests/unit/server-next/admin-moderation/use-rejected-queue.test.ts` | 11（既有 8 + 新 3）|
| `tests/unit/admin-moderation/admin-player.test.tsx` | 15（既有 8 + 新 5 + 5d 2）|
| `tests/unit/web-next/player-shell-on-error.test.tsx` | 8 NEW |
| `tests/unit/player-core/retry-control.test.tsx` | 7 NEW |
| `tests/unit/api/auto-retire-line-queries.test.ts` | 10 NEW |
| `tests/unit/worker/jobs/auto-retire-line.test.ts` | 10 NEW |
| `tests/e2e/admin/sources/codename-matrix-picker.spec.ts` | 4 NEW（playwright）|
| **合计新增** | **~58 case** |

---

## 8. 风险与已知遗留

### 8.1 已 ship 风险（接受）

| 风险 | 缓解 |
|---|---|
| auto-retire-line worker 首次启用后需 180 天才能开始退役历史 dead alias | arch-reviewer 评估为"特性而非 bug"（dead_since 从启用时算 = 自然观察期 / 历史 dead 不会立即误退役）|
| 双源 SQL byte-identical 跨包同步约束（apps/api + apps/worker auto-retire-line.ts）| jsdoc 双侧标注「SQL 真源对照」/ 维护时同步改 / 评审报告 §2.2 §6 共同源头 |
| AdminPlayer 手动重试不复用 controls.retry | Y-166-6 明示 / 用 key bump remount 范式 / 文档明确生命周期边界 |

### 8.2 Wave 5 候选 follow-up

| 卡 | 来源 | 优先级 |
|---|---|---|
| **CHG-PRE-DEAD-LINE-UNRETIRE-ENDPOINT** | Y-DEAD-3 / 人工 unretire admin 端点 + 90 天冷却 check + R-MID-1 RETRO | 高（误报恢复必要）|
| **LinesPanel dead_since tooltip** | Y-DEAD-4 / 运维可观测性 | 中 |
| **SEQ-FOLLOWUP-MIGRATE** | Wave 3 BLOCKER 方案 A / BTN_* → AdminButton 38 tsx 长尾迁移 | 中（视觉一致性）|
| **SEQ-FOLLOWUP-ARCH** | Wave 3 组合 X / SITE-VIEWS-EXTRACT 抽 packages/site-views | 低（架构重构）|
| **CHG-SN-9-META-BANGUMI-A** | Wave 3 DEFERRED / plan §13 | 低（候选）|

---

## 9. 用户签字

- **状态**：⬜ 等待签字
- **建议验收路径**：按 §6.1-6.5 五段依次手动验收
- **签字栏**：

  ```
  [ ] 签字日期：__________
  [ ] 签字人：__________
  [ ] 验收结论（PASS / 部分 PASS / FAIL）：__________
  [ ] 退回原因（如 FAIL）：__________
  ```

---

## 10. 进入 Wave 5 前置条件

- [ ] §6 各路径用户已手动验收
- [ ] §9 用户签字完成
- [ ] 无新 BLOCKER 写入 `docs/task-queue.md` 尾部
- [ ] 长尾候选（§8.2）由用户决策选哪条 SEQ 推进

---

## 11. 新会话启动指引（Wave 5 立案）

```bash
# 1. 启动 Claude Code（推荐 sonnet / 长尾卡多数 sonnet 够用）
claude --model claude-sonnet-4-6

# 2. 第一句指令（任选）：
#   - "Wave 4 验收签字完成 / 起 Wave 5 立案"
#   - "起 CHG-PRE-DEAD-LINE-UNRETIRE-ENDPOINT 实施"（直接进具体 follow-up）
#   - "推进 SEQ-FOLLOWUP-MIGRATE 长尾"
```

主循环将先校验 §9 签字状态 → 按用户决策推进 Wave 5 立案或具体长尾 SEQ。
