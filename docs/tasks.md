# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-23

---

## 进行中任务

### CHG-SN-7-MISC-VISUAL-FOLLOWUP-2 · 3 follow-up 收口（migration sync + seed + LinesPanel ADR 评估）

- **状态**：🔄 进行中
- **序列**：SEQ-20260521-06 GAPS 高 ROI 闭合 / #66
- **创建时间**：2026-05-23
- **建议模型**：sonnet（dev DB 操作 + visual capture + 评估结论）
- **执行模型**：claude-opus-4-7（max effort 续会话）
- **子代理**：无
- **依赖**：5993feb0（VISUAL-FOLLOWUP-BATCH）+ dev server 仍跑

#### 范围（3 follow-up 闭合）

1. **wish_list 500 endpoint bug ✅ 修复**
   - 根因：dev DB 落后 9 个 pending migration（064-072）
   - 修复：`npm run migrate` 全跑（064-072 全 ✅）
   - 验证：所有 4 type（bad_source/wish_list/metadata_correction/all）endpoint 恢复 HTTP 200

2. **dev DB seed user_submissions ✅ 落地**
   - SQL INSERT 2 条 wish_list pending submissions（admin user 提交 / metadata_jsonb 含 title + year）
   - 触发 first-card baseline 能 capture（wish_list segment 2 条 / 切到 wish_list 截首张）
   - empty-state baseline 仍 capture default bad_source segment（0 条 / EmptyState 正确）

3. **LinesPanel auto-select ADR ❌ NEGATED**
   - 评估：仅为 1 张 player-idle baseline 改 LinesPanel UX 决策（auto-select 第一条 active line）ROI 极低
   - 决策：不起 ADR / 接受 player-idle baseline 长期缺
   - spec conditional skip 保留 / 未来 dev DB 有无活跃线路视频时自动 capture

#### 新增 baseline（2 张）

- `submission-card-first-admin-visual-darwin.png` — 求片 card「建议补充黑人喜剧《富贵双生》」+ metadata quote + 拒绝/处理 actions
- `submissions-empty-state-admin-visual-darwin.png` — 用户投稿/纠错 header + 4 segment toolbar（求片 2 条）+ EmptyState

#### Modified baseline（3 张 / re-capture）

- `submissions-page-header` / `submissions-segment-bad-src` / `submissions-segment-processed` — 因 user_submissions 数据从 0 变 2 条 → 副标题 0→2、求片 segment badge 0→2 → 微小视觉差异 → re-capture

#### 不在范围

- 不动业务代码 / 不改 spec（除 user-submissions empty-state 已在 commit 5993feb0 改过）
- 不动 LinesPanel auto-select 决策
- migration 文件本身已在仓内（跑 migration 仅 dev DB 操作）
- dev DB seed SQL 不入仓（独立 dev 数据 / 生产部署不带）

#### 验收

- typecheck + lint PASS
- 全 unit 4701 PASS（pre-existing flaky 隔离 PASS）
- verify:adr-contracts 维持 ✅
- baseline visual review 全 valid

#### 价值

- **user-submissions visual coverage 6/6 完整入库**（之前 4/6 + 本卡 2）
- **wish_list 500 bug 闭合**（用户问题溯源 + 根因修复 + 验证恢复）
- **dev DB schema sync**（M-SN-3 ~ M-SN-7 跨 5 milestone migration 全跑）
- **LinesPanel UX 决策守护**：评估 ROI 后拒绝破坏 UX，体现「价值排序」原则
- **SEQ-20260521-06 第 6 张 chore 卡完成**（本会话累计 7 commit）

#### 工时估算

- migration + seed：~0.05w
- recapture submissions baseline：~0.03w
- LinesPanel ADR 评估：~0.02w
- **总计：~0.1w**
