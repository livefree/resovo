# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-30
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

### CHG-DESIGN-07 7D-2 — Dev server + Playwright MCP 截图 + e2e 实跑（SEQ-20260429-02 第 7 卡 · 阶段 4/4 后半）

- **状态**：🔄 待启动（新 session）
- **关联序列**：SEQ-20260429-02
- **创建时间**：2026-04-30
- **建议主循环模型**：sonnet
- **前置依赖**：7A ✅ + 7B ✅ + 7C ✅ + 7D-1 ✅（详见 changelog 和 task-queue.md）

#### 7D-2 阶段范围

7D-1 已完成 9 项视觉规格 desk review（代码字面对齐 reference §5.1）。7D-2 启动 dev server，做 browser-based 验证 + visual baseline 入库 + e2e smoke 实跑。

#### 7D-2 推进顺序

1. **dev 栈启动**：
   - `docker compose up -d`（pg + redis）
   - `npm run dev`（design-tokens / api / server / server-next / web-next 全栈）
   - 验证 server-next :3003 与 api :4000 健康
2. **Playwright MCP visual 验证**：
   - `browser_navigate` `http://localhost:3003/admin`
   - `browser_snapshot` 主视图（语义快照供 Claude 分析）
   - `browser_take_screenshot` 入库 ≥ 8 张：
     - `row1.png` / `row2.png` / `row3.png`（三行布局）
     - `attention-card.png` / `workflow-card.png`（row1）
     - `metric-kpi--default.png` / `metric-kpi--is-warn.png` / `metric-kpi--is-ok.png` / `metric-kpi--is-danger.png`（row2 4 张）
     - `recent-activity-card.png` / `site-health-card.png`（row3）
3. **截图入库**：保存到 `tests/visual/dashboard/`，git 提交作为 `INFRA-VISUAL-DIFF-CI` follow-up 基线
4. **e2e smoke 实跑**：`npm run test:e2e -- dashboard.spec.ts` 三路径全过
5. **9 项视觉对照清单 visual 二次签收**（与 7D-1 desk review 互证）

#### 7D-2 文件范围

- 新建：`tests/visual/dashboard/*.png`（≥ 8 张 PNG baseline）
- 不写代码（7D-2 仅 visual 验收 + e2e 实跑 + baseline 入库）

#### 7D-2 不在范围

- visual diff CI 集成（留 follow-up `INFRA-VISUAL-DIFF-CI`）
- live 数据扩张（留 follow-up `STATS-EXTEND-DASHBOARD`：源可达率 / 失效源 / 视频总量 / 已上架等）
- 编辑态（CardLibraryDrawer / FullscreenCard，§A4 决议后做）
- analytics tab 内容（CHG-DESIGN-09）

#### 验收标准

- 8+ 张 PNG baseline 入库 + git 提交
- e2e smoke 3 路径全过
- 9 项视觉对照 visual 签收 ☑
- typecheck / lint / verify:token-references / 单测 / e2e 全绿

---
