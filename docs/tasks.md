# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-29

---

## 进行中任务

### META-16-A — ADR-168 后端：secret redaction + 凭证 key 类型扩展
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260530-05
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-8
- **子代理调用**：无（实施 ADR-168 已 Opus 评审契约）
- **实际开始**：2026-05-30
- **文件范围**：
  - 新建 `packages/types/src/security.types.ts`（SECRET_KEY_PATTERNS / isSecretSettingKey / MASK_PREFIX）+ `packages/types/src/index.ts` runtime export
  - 改 `packages/types/src/system.types.ts`（SystemSettingKey +4 / SiteSettings +8 字段）
  - 新建 `apps/api/src/lib/secretRedaction.ts`（redactSecretsForAudit / maskSecret / isMaskedPlaceholder）
  - 改 `apps/api/src/routes/admin/siteConfig.ts`（POST 占位跳过 + 审计 redaction + schema/pairs 扩展）
  - 改 `apps/api/src/db/queries/systemSettings.ts`（deserializeSiteSettings 遮罩 + Set 布尔 + bangumi 默认值）
  - 新建 `tests/unit/api/secret-redaction.test.ts` + 扩 system-config 审计回归
- **完成备注**：_（完成后填写）_

> 前序 META-16-ADR ✅（ADR-168 Accepted / arch-reviewer Opus）。后续 META-16-B（凭证下沉 Service）/ -C（SettingsTab UI）。
> 黄线（Opus 评审）：Y1 pairs 顺序 zod→占位过滤→pairs→审计 redact / Y2 前端无其他明文 secret 消费方（Grep 复核）。

---

## ✅ Wave 4 完全收官（SEQ-20260528-MOD-WAVE4 / 用户验收签字 2026-05-29）

实施期 6/6 + 7 拆卡（4-ADR / 4-EP / 5-A / 5-B）+ **8 Codex stop-time review FIX** 全闭环 + arch-reviewer Opus 2 次评审（ADR-166 + PRE-DEAD-LINE-WORKER）+ **用户验收返工 1 轮 4 finding（FIX-1/2/3）+ Codex 第 8 轮 LEFT JOIN 退化 FIX-4** / 17 commits（13 主线 + 4 验收返工）/ 1 ADR 起草并 Accepted（ADR-166）/ 1 ADR 完整链路闭环（ADR-164 D-164-8 schema → query → worker → UI）。

**验收报告**：`docs/manual/wave-4-acceptance.md`（§9 用户已签字 PASS 2026-05-29）

详细卡片清单 ↓

### Wave 4 主线（6 张实施 / 含 2 拆卡）

- ✅ **CHG-SN-9-REJECTED-ENHANCE-B** RejectedTab 视觉对齐 BTN_SM → AdminButton+SplitPane+批量 reopen（2026-05-28 / opus-4-7）
- ✅ **CHG-SN-9-PLAYER-ERROR-CONSUMER-A** AdminPlayer onError + feedback 上报（2026-05-28 / opus-4-7 / DEBT-FIX-D-ERROR 闭环）
- ✅ **CHG-SN-9-PLAYER-ERROR-CONSUMER-B** PlayerShell onError + 自动切线（2026-05-28 / opus-4-7 / R-N-3 闭环）
- ✅ **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-ADR**（+FIX-1）ADR-166 起草 + player-core onError(event, controls)（2026-05-28 / opus-4-7 + arch-reviewer Opus A- CONDITIONAL）
- ✅ **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-EP**（+FIX-2 +FIX-3）AdminPlayer key-bump + PlayerShell retry watchdog 3s（2026-05-28 / opus-4-7）
- ✅ **CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A**（+FIX-1 +FIX-2）Migration 081 + queries + docs（2026-05-28 / opus-4-7 + arch-reviewer Opus A- CONDITIONAL）
- ✅ **CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B**（+FIX-3）worker cron 03:30 daily + 内联 SQL ADR-107 §4 合规（2026-05-28 / opus-4-7）
- ✅ **CHG-SN-9-WAVE3-FOLLOWUP-CODENAME-MATRIX-E2E** playwright 4 case + route-labeling.md §9.10/9.11（2026-05-28 / opus-4-7）

### Codex stop-time review FIX 全闭环（6 轮）

- ✅ FIX-1（#4-ADR）：controls.retry active 双层守卫
- ✅ FIX-2（#4-EP）：watchdog currentEpisode cleanup
- ✅ FIX-3（#4-EP）：watchdog shortId cleanup
- ✅ FIX-1（#5-A）：advisory lock 同 client session + SQL deleted_at 过滤
- ✅ FIX-2（#5-A）：unlock 失败 client.release(err) destroy connection
- ✅ FIX-3（#5-B）：撤回 apps/api 跨 app import / worker 内联 SQL（ADR-107 §4）

---

## ✅ Wave 3 完全收官（SEQ-20260528-MOD-WAVE3 / 用户验收签字 2026-05-28）

实施期 9/10 + 3 DEFERRED + 验收期补丁 2 张 + Codex stop-time review 4 次 FIX 全闭环 / 17 commits / 4 ADR Accepted（ADR-165 + 既有 ADR-110/-117/-164 AMENDMENT）。

**验收报告**：`docs/manual/wave-3-acceptance.md`（§9 用户已签字）

详细卡片清单 ↓

### Wave 3 主线 + 长尾（9 张实施）

- ✅ **PRE-INDEX-DESIGN-RULES**（2026-05-28 / sonnet-4-6）
- ✅ **CHG-369-B** 自定义主题输入（2026-05-28 / sonnet-4-6）
- ✅ **CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW** Layer B 通路（2026-05-28 / sonnet-4-6）
- ✅ **CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL** UI 自动/手动区分（2026-05-28 / sonnet-4-6 + Opus）
- ✅ **CHG-SN-9-REJECTED-ENHANCE-A** 分页（2026-05-28 / sonnet-4-6）
- ✅ **CHG-SN-9-PLAYER-ERROR** public API（2026-05-28 / sonnet-4-6 + Opus）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-ADR** ADR-165 Accepted（2026-05-28 / sonnet-4-6 + Opus）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-A1** 后端实施（2026-05-28 / sonnet-4-6）
- ✅ **CHG-SN-9-ROUTE-LABEL-D-A2** 前端实施 + 2 Codex FIX（2026-05-28 / sonnet-4-6）

### Wave 3 验收期补丁（2 张）

- ✅ **CHG-SN-9-LINES-VIEW-UNIFY** 线路别名管理改造 + 入口移到播放线路 + FIX-3（FULL OUTER JOIN）+ FIX-4（stale mock）
- ✅ **CHG-SN-9-CODENAME-MATRIX** 52 字库预览表 + 单元格内联代号分配 + 重复使用建议

### 3 DEFERRED（用户决策）

- ⛔ **CHG-SN-9-MOD-BUTTON-MIGRATE**（方案 A）→ SEQ-FOLLOWUP-MIGRATE
- ⛔ **CHG-SN-9-META-BANGUMI-A**（plan §13 暂缓 / 下一轮迭代）
- ⛔ **CHG-SN-9-SITE-VIEWS-EXTRACT**（组合 X）→ SEQ-FOLLOWUP-ARCH

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / ✅ **完全收官 = 100%**）

详细见 changelog。Layer B 山名代号体系完整 ship（schema + 业务 + admin audit + UI + 字库 + 退役治理 + LinesPanel 显示）/ ADR-164 5 黄线 + 4 advisory 全部闭档 / Wave 4 #5-A/-B 完整闭环 D-164-8 worker 自动退役。

---

## 下次会话恢复入口（含 Wave 5 待立案 + 长尾）

- **Wave 5 待立案**：Wave 4 验收签字后用户决策方向；建议候选包括：
  - **SEQ-FOLLOWUP-MIGRATE**（Wave 3 BLOCKER 方案 A）：BTN_* → AdminButton 38 tsx / 100+ button 长尾迁移
  - **SEQ-FOLLOWUP-ARCH**（Wave 3 组合 X）：CHG-SN-9-SITE-VIEWS-EXTRACT 抽 packages/site-views
  - **CHG-SN-9-META-BANGUMI-A**（plan §13 暂缓 / 下一轮迭代候选）
  - **Y-DEAD-3 follow-up**：CHG-PRE-DEAD-LINE-UNRETIRE-ENDPOINT（人工 unretire admin 端点 / 起 R-MID-1 RETRO）
  - **Y-DEAD-4 follow-up**：LinesPanel dead_since tooltip（运维可观测性提升）
- 其他 pre-existing 长尾 / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** 等

---

## 新会话启动指引（Wave 5 待立案）

```bash
# 1. 启动 Claude Code（推荐 sonnet 主循环 / Wave 4 各卡偏离 opus 已 ship）
claude --model claude-sonnet-4-6

# 2. 第一句指令（任选）：
#   - "Wave 4 验收 / 起 Wave 5 立案"
#   - "Wave 4 用户签字完成"
#   - "继续推进长尾 SEQ-FOLLOWUP-MIGRATE"（直接进具体 SEQ）
```

主循环将先校验 `docs/manual/wave-4-acceptance.md` 用户签字状态 → 按用户决策推进 Wave 5 立案或具体长尾 SEQ。
