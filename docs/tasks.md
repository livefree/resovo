# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 CHG-CUTOVER-EXECUTE（Phase A：功能性退役，改名后置） — 物理删除 apps/server + nginx 切流

- **来源**：`docs/task-queue.md` SEQ-20260608-01 卡 3（🔴 高风险不可逆 · 独立门禁）
- **状态**：🟡 分支完成待人工 final sign-off（分支 `cutover/retire-apps-server`，回滚 tag `pre-server-next-cutover` @ 13940b06；**未合 main/dev**）
- **已落地**：物理删 apps/server（256 删除）+ 47 老 admin 测试删 + 16 配置/脚本/文档同步 + nginx :3001→:3003。门禁：typecheck ✅ / lint 4/4 ✅ / verify:adr-contracts EXIT=0 ✅ / vitest 6828 passed（1 CSV flaky 隔离 3/3 通过）/ playwright 配置有效。待你 sign-off 后合并。
- **执行模型**：claude-opus-4-8（卡建议 opus，高风险架构动作）
- **子代理调用**：无（执行 ADR-101 + plan §4.2 既定方案，非新架构设计）
- **用户决策（AskUserQuestion 2026-06-08）**：**分阶段，改名后置** — 本卡只做功能性退役；`apps/server-next → apps/admin` 改名（152 文件，纯命名零功能收益）拆为独立后续卡 CHG-CUTOVER-RENAME-ADMIN。
- **交付约束（plan §6 + ADR-101）**：分支作业，全程不直接合 main/dev；跑全量门禁后产出供**人工 final sign-off**（PR 描述签字）后才合并；回滚走 tag + nginx reload（RTO ≤ 4h）。

**问题理解**：4 项 cutover 启动准入全部满足（parity / v1 E2E 降冒烟 / QA 迁移 / banner 确认），执行物理退役：apps/server 删除 + /admin 流量切到 server-next。

**方案（Phase A）**：
1. **nginx 切流**：`docker/nginx.conf` `upstream server` :3001 → :3003（server-next），/admin + /admin/_next/ 随之指向 server-next。
2. **删 apps/server**：整目录 + workspaces + typecheck/e2e scripts + dev.mjs 进程 + vitest/playwright 老 admin 解析/project + 老 admin 测试。
3. **架构同步**：docs/architecture.md + CLAUDE.md 去除 v1 双后台并存表述。

**文件范围**（删除 ~47 + 编辑 ~12）：
- 删：`apps/server/`（整目录）；`tests/unit/components/admin/`（43 老 admin 单测）；`tests/e2e/{admin,admin-source-and-video-flows,video-governance,publish-flow}.spec.ts`（4 老 admin e2e）。
- 编辑：`package.json`（workspaces/typecheck/test:e2e*/verify scripts）/ `playwright.config.ts` / `vitest.config.ts` / `scripts/dev.mjs` / `scripts/verify-admin-guardrails.mjs` / `scripts/verify-file-size-budget.mjs` / `.eslintrc.json` / `docker/nginx.conf` / `docker/docker-compose.dev.yml` / `.env.example` / `README.md` / `docs/architecture.md` / `CLAUDE.md`。

**不在范围**：`apps/server-next → apps/admin` 改名（→ CHG-CUTOVER-RENAME-ADMIN 后续卡）。

**完成标准**：apps/server 物理删除；nginx /admin → :3003；typecheck/lint/vitest 全量/verify:adr-contracts 全绿（无 apps/server 残留引用）；e2e admin 域可跑（仅 admin-next）；分支产出待人工 final sign-off。

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
