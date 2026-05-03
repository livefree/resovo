# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-02
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

### CHG-SN-4-09a · DEBT-SN-4-07-C 修复：审核台 i18n 硬编码中文清理 · 🔄 进行中

- **来源序列**：DEBT-SN-4-07-C 闭环卡（CHG-SN-4-07 复核发现，2026-05-02）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §5.0.5（i18n key 命名规范："本期仅 zh-CN，但 key 必须经 t() 调用 + CI grep 守门"）
- **建议主循环模型**：`claude-sonnet-4-6`（机械字面量替换 + i18n keys 扩展，无新决策）
- **强制子代理**：否（如发现需新增组件 / 改 packages/admin-ui → BLOCKER）
- **前置**（全部已集成 main）：CHG-SN-4-07 ✅（审核台前端骨架）+ CHG-SN-4-08 ✅（VideoEditDrawer）
- **下游解锁**：CHG-SN-4-10 milestone 收口卡（含 e2e + arch-reviewer A/B/C 评级）

#### 范围（修复 ~15 处硬编码中文 → 走 i18n keys）

按 plan §5.0.5 + DEBT-SN-4-07-C 登记：

| 文件 | 命中位置 | 数量 | 类型 |
|---|---|---|---|
| `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx` | aria-label / 错误 toast 文案 / 标题 backtick 中的 `'全集'` | 10 | toast (4) + aria-label (6) |
| `apps/server-next/src/app/admin/moderation/_client/StagingTabContent.tsx` | readiness check 字典（'审核状态' / '有效线路 ≥ 1' / '封面 P0' / '豆瓣匹配' / '探测/播放信号'） + aria-label | 4 | dict (1) + aria-label (3) |
| `apps/server-next/src/app/admin/moderation/_client/RejectedTabContent.tsx` | aria-label '重新开审' × 2 | 2 | aria-label |
| `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx` | aria-label（审核台三栏 / 审核队列 / 拒绝/跳过/通过 视频 / 视频审核预览 / 视频详情）| 8 | aria-label |

总计 ~24 处用户可见文本字面量（含 aria-label）→ 全部迁至 `apps/server-next/src/i18n/messages/zh-CN/moderation.ts`（已存在，扩展键空间）。

#### 文件作用域（不得越界）

```
apps/server-next/src/i18n/messages/zh-CN/moderation.ts                         # 扩展 i18n keys
apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx               # 替换 ~10 处
apps/server-next/src/app/admin/moderation/_client/StagingTabContent.tsx        # 替换 ~4 处
apps/server-next/src/app/admin/moderation/_client/RejectedTabContent.tsx       # 替换 ~2 处
apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx        # 替换 ~8 处
docs/changelog.md                                                              # 追加 CHG-SN-4-09a 条目
docs/task-queue.md                                                             # CHG-SN-4-09a 状态 ✅ 完成 + DEBT-SN-4-07-C 标完全关闭
docs/tasks.md                                                                  # 删除本卡片
```

**禁止触碰**：
- `apps/server-next/src/app/admin/moderation/_client/mock-data.ts`（mock 数据本应是中文样例，不算违规）
- `packages/admin-ui/**`（共享组件 5 件已就位）
- `packages/types/**`
- `apps/api/**` / `apps/worker/**`
- `apps/server-next/src/app/admin/videos/**`（CHG-SN-4-08 范围）
- `tests/**`（除非测试文件因类型变更必须 fix）
- `docs/decisions.md` / `docs/architecture.md`

#### Step 表

| Step | 内容 | 依赖 | 验证 |
|---|---|---|---|
| 1 | 扩展 `i18n/messages/zh-CN/moderation.ts`：追加 `M.lines.*`（toast / actions） + `M.staging.readiness.*`（5 条字典） + `M.aria.*`（约 17 条 aria-label key） | 无 | typecheck（i18n 文件） |
| 2 | LinesPanel.tsx：4 个 toast / 6 个 aria-label / 1 个 backtick `'全集'` 替换为 `M.lines.*` / `M.aria.*` | Step 1 | typecheck + grep |
| 3 | StagingTabContent.tsx：readiness 字典 5 条 → `M.staging.readiness.*` + 3 aria-label → `M.aria.*` | Step 1 | typecheck + grep |
| 4 | RejectedTabContent.tsx：2 aria-label → `M.aria.*` | Step 1 | typecheck + grep |
| 5 | ModerationConsole.tsx：8 aria-label → `M.aria.*` | Step 1 | typecheck + grep |
| 6 | 全门禁：typecheck + lint + 全量 unit + grep 校验 | Step 2-5 | 250f / 3076t 不回归 |

#### 质量门禁

```bash
npm run typecheck                                  # 全 8 workspace 零报错
npm run lint                                       # turbo lint 全 pass
npm run test -- --run                              # 250f / 3076t 不回归
```

**grep 校验**（应 0 命中除 mock-data.ts 外）：
```bash
grep -rE "['\"][一-龥]" apps/server-next/src/app/admin/moderation/_client/ | grep -v "mock-data.ts" && echo "[残留命中 ⚠️]" || echo "[0 命中 ✅]"
```

#### 完成判据

- ✅ 4 个 _client/ 文件硬编码中文 grep 0 命中（除 mock-data.ts）
- ✅ 全部质量门禁通过 + 全量测试零回归
- ✅ DEBT-SN-4-07-C 完全关闭（task-queue.md 欠账登记表更新状态）
- ✅ M.aria.* / M.lines.* / M.staging.readiness.* keys 在 zh-CN/moderation.ts 集中维护

#### 风险与回退

- **风险 1**：扩展 i18n keys 时与现有 `M` 命名冲突 → typecheck 会报错，按提示修
- **风险 2**：aria-label 改 i18n 后 a11y 测试可能因 label 文本变化失败 → 检查 `tests/unit/server-next/moderation/` 与 e2e（如有断言 aria-label 文本，同步改）
- **回退**：本卡所有改动可一次 `git revert` 回到 main `2c45b98`（CHG-SN-4-07 集成 commit）

#### 集成

- 单卡集成（非并行 Track），完成后直接 commit 到 main：
  - `chg(CHG-SN-4-09a): DEBT-SN-4-07-C 修复 — 审核台 i18n 硬编码中文清理`
  - 含质量门禁结果 + grep 校验输出 + 任务卡删除 + task-queue 状态更新
