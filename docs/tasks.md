# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空 / Wave 4 #4-EP 已 ship / ADR-166 闭环 / 下一卡 #5 PRE-DEAD-LINE-AUTO-RETIRE-WORKER 主循环自动启动）

---

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

## ⬜ Wave 4 待启动（SEQ-20260528-MOD-WAVE4 / W4-务实方案 / 6 张卡）

**详细卡片**：见 `docs/task-queue.md` 尾部 SEQ-20260528-MOD-WAVE4 段。

| # | TASK-ID | 内容 | 建议模型 |
|---|---|---|---|
| 1 | CHG-SN-9-REJECTED-ENHANCE-B | 视觉对齐 BTN_SM → AdminButton + SplitPane + 批量 reopen | sonnet |
| 2 | CHG-SN-9-PLAYER-ERROR-CONSUMER-A | AdminPlayer onError + feedback 上报失败 | sonnet |
| 3 | CHG-SN-9-PLAYER-ERROR-CONSUMER-B | PlayerShell onError + 自动切下一线路 | sonnet |
| 4 | CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL | retrySourceLoad 上抛 / 起 ADR-166 / Opus 评审 | opus + Opus |
| 5 | PRE-DEAD-LINE-AUTO-RETIRE-WORKER | plan §10.5 全 dead 180 天 worker / ADR-164 A-164-1 闭环 | opus + Opus |
| 6 | CHG-SN-9-WAVE3-FOLLOWUP-CODENAME-MATRIX-E2E | 验收期补丁 e2e 测试补全 | sonnet |

执行序列：1 → 2 → 3 → 4（ADR-166）→ 5 → 6

---

## 新会话启动指引（Wave 4）

```bash
# 1. 启动 Claude Code
claude --model claude-sonnet-4-6

# 2. 第一句指令（任选）：
#   - "继续 Wave 4"
#   - "Wave 4 启动"
#   - "继续按规范，自动推进 Wave 4"
```

主循环将自动按 task-queue.md SEQ-20260528-MOD-WAVE4 段取 ⬜ 待开始 首卡 → 写 tasks.md 任务卡 → 按既定模型路由执行 → commit + 状态更新 + 下一卡循环。

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / ✅ **完全收官 = 100%**）

详细见 changelog。Layer B 山名代号体系完整 ship（schema + 业务 + audit + UI + 字库 + 退役治理 + LinesPanel 显示）/ ADR-164 5 黄线 + 4 advisory 全部闭档。

---

## 下次会话恢复入口（含 Wave 4 + 长尾）

- **Wave 4 启动**（W4-务实方案 / SEQ-20260528-MOD-WAVE4 / 6 张卡）→ 用上方启动指引
- **SEQ-FOLLOWUP-MIGRATE**（Wave 3 BLOCKER 方案 A）：BTN_* → AdminButton 38 tsx / 100+ button 长尾迁移
- **SEQ-FOLLOWUP-ARCH**（Wave 3 组合 X）：CHG-SN-9-SITE-VIEWS-EXTRACT 抽 packages/site-views
- **CHG-SN-9-META-BANGUMI-A** DEFERRED（plan §13 暂缓 / 下一轮迭代）
- 其他 pre-existing 长尾 / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** 等
