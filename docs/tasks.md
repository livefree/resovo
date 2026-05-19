# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-17

---

## 进行中任务

<!-- ✅ PRE-04 全 16 子卡闭环（2026-05-18，连续推进 #2–#16 用户授权）；总览：5 ✅ A 级（dashboard/moderation/videos/sources/analytics）+ 8 ⚠️ S 级（merge/subtitles/home/image-health/users/audit/login/dashboard MISC）+ 4 ❌（staging/submissions/crawler/settings）+ 16 MISC + 4 REDO（01/02/03/04）+ SHARED-03 取消；详见 docs/M-SN-7-design-realign-audit-FULL.md；下一步等用户拍板 PRE-04 收尾 + 启动 SHARED-01/02 milestone -->

### CHG-SN-7-PRE-01 文件大小守卫 ✅ 已闭环（2026-05-18）

**完成时间**：2026-05-18
**实施**：`scripts/verify-file-size-budget.mjs`（210 行）+ package.json 集成 + preflight.sh 5e2/6 步骤
**实测结果**：5 PERMANENT（v1 frozen 永久豁免）+ 23 BASELINE（M-SN-6 复核 7 + PRE-01 全量扩 16）+ **0 新违规** ✅
**关键决策**：PRE-01 执行中实测发现 baseline 清单严重不全（原 7 → 实际 28），用户裁决"扩 BASELINE_EXEMPT 至 28 文件全量" + "v1 永久豁免"，新挂 5 张 MISC 拆分跟踪卡（API-QUERIES/ROUTES/SERVICES + WEB-NEXT + PLAYER-CORE）
**质量门禁**：typecheck ✅ / lint ✅ / 4018 unit PASS ✅ / file-size-budget ✅ 0 新违规
**执行模型**：claude-opus-4-7 / 子代理：无

<!-- 下张：CHG-SN-7-PRE-02 ADR-121 R-MID-1 协议化（0.15w，M-SN-6 挂账） -->


**SEQ**：M-SN-7 / PRE 阶段第 2 张（M-SN-6 关闭挂账）

**问题理解**：
M-SN-6 关闭复核暴露"自评数据可信度"盲点 — PATCH-2 自评"全部 ≤ 500 行"实际 7 文件超限。需要静态扫描守卫 + preflight 集成，把 500 行约束从"软门"提升为"硬门"。

**根因判断**：
CLAUDE.md §绝对禁止第 11 条「文件超 500 行非声明性 / 导出 2+ 主要概念，不先拆分就继续写」无机制守卫；arch-reviewer 抽样无法兜底（H1 案例已证）。

**方案**：
1. 新建 `scripts/verify-file-size-budget.mjs`：
   - 扫描 `apps/**/*.{ts,tsx}` + `packages/**/*.{ts,tsx}`
   - 超 500 行 → 收入违规清单
   - **5 baseline 豁免清单**（M-SN-6 复核 2026-05-17 实测）：MergeClient 756 / VideoListClient 734 / ModerationConsole 583 / sidebar 696 / data-table 608
   - **GENERIC_WHITELIST**：`*.types.ts` / `index.ts` 等结构性大文件豁免
   - **新增文件零容忍**：不在 baseline 清单 + 不在 whitelist = FAIL
   - exit 0 = 通过；exit 1 = 命中违规 + 清单；exit 2 = 脚本错误
2. `package.json` 新增 `verify:file-size-budget` script
3. `scripts/preflight.sh` 集成（紧跟 verify:token-references 之后）
4. 单测：脚本本身先跑通（实测当前仓库应输出 5 baseline 0 新违规）

**涉及文件**：
- 新建：`scripts/verify-file-size-budget.mjs`
- 修改：`package.json`（scripts 段）
- 修改：`scripts/preflight.sh`（5f/6 步骤新增）

**严格约束**：
- ❌ 不改业务代码
- ❌ 不调整 baseline 清单（5 文件锁定 M-SN-6 复核实测数）
- 一旦实测产出 baseline 外新违规 → 立即汇报（说明 M-SN-6 关闭至今有人新违规提交）

**执行模型**：claude-opus-4-7（主循环，按 sonnet 模式独立实施，无需 Opus 子代理）

**估时**：0.12w


**完成时间**：2026-05-18（连续推进 #1–#16 一会话内闭环）
**产出**：`docs/M-SN-7-design-realign-audit-FULL.md` 16 段完整审计

**汇报评级**：

| # | 路由 | 评级 | 关键发现 |
|---|---|---|---|
| 1 | dashboard | ⚠️ S 级 | 90%+ 对齐 + 3 MISC（按钮 onClick / 数据 mock / 编辑态延后）；KpiCard + Spark 已入库 → SHARED-01 0.35w→0.1w |
| 2 | moderation | ✅ A 级 | SplitPane 三栏 + segment + 键盘流全对齐，0 偏离 |
| 3 | staging | ❌ 整页未做 | 路由不存在；REDO-04 待 Opus 裁决（独立路由 ~1.5w vs IA 修订 0.1w） |
| 4 | videos | ✅ A 级（标杆） | DataTable 标杆，1 MISC（poster 32×48 vs 48×72 设计升级决议） |
| 5 | sources | ✅ A 级 | KpiCard 4 + Segment 4 + MatrixExpand 全对齐，0 偏离 |
| 6 | merge | ⚠️ S 级 | 缺 Segment 3 类 + 候选 card 形态（左右视频卡对比），2 MISC |
| 7 | subtitles | ⚠️ S 级 | 缺 KPI 4 列 + 上传字幕 action，2 MISC |
| 8 | home | ⚠️ S 级 | 缺 sticky 前台预览（1fr/360px），2 MISC |
| 9 | submissions | ❌ 整体错位 | DataTable vs §5.13 Card list；REDO-02 已锁 ~1w |
| 10 | crawler | ❌ 整体错位 | 计划文档 §2 已审；REDO-01 已立 10 子卡 2.55w |
| 11 | image-health | ⚠️ S 级 | 缺 2 actions（重扫封面/切 fallback 域）+ 破损样本 grid，2 MISC |
| 12 | analytics | ✅ A 级 | CHG-DESIGN-09 完整实施；reference §5.15.4 自评"占位"已过期；0 偏离 |
| 13 | users | ⚠️ S 级 | 缺 KPI 4 列 + 角色矩阵 + 邀请用户 actions，2 MISC |
| 14 | settings/system | ❌ 架构错位 | sidebar 5 子项分散违反 §5.11 + plan §6 8 类实际 5 类；REDO-03 ~1.5w（4 子卡） |
| 15 | audit | ⚠️ S 级 | 缺时间穿梭 action（功能需求待用户确认），1 MISC |
| 16 | login | ⚠️ S 级 | card 视觉偏离（320 vs 400 + 无 brand/SSO/审计），1 MISC |

**关键裁决（PRE-04 收尾）**：
- **SHARED-03 Spark 取消**：dashboard / analytics / sources / MetricKpiCardRow 已消费现有 admin-ui Spark
- **REDO-03 settings 收敛**新增（4 子卡 ~1.5w）：吸收原 MISC-SETTINGS-TABS
- **REDO-04 staging** 待 Opus 裁决方案 A vs B

**总览**：5 ✅ + 8 ⚠️ + 4 ❌ + **16 MISC** + **4 REDO（01/02/03/04）**

**等待**：用户对 REDO 启动顺序 + REDO-04 staging 裁决方案拍板


**SEQ**：M-SN-7 / 设计稿对齐重做 / PRE-04 全量审计 16 路由的第 1 张

**计划真源**：`docs/M-SN-7-design-realign-plan.md` §1（16 路由审计矩阵）+ §4（调用顺序）+ §1.2（PRE-04 拆解）

**问题理解**：

server-next 后台 `/admin/dashboard` 当前实现是否对齐设计稿 §5.1 + screens-2.jsx Dashboard 真源。设计稿 §5.1 spec：
- page__head 问候式 title + 全站全量采集 primary action
- AttentionCard：异常列表（采集失败 / 图片 404 / 合并候选 / Banner 过期），按优先级 + 状态 icon + xs action
- WorkflowCard：4 段 progress（采集入库 accent / 待审核 warn / 暂存待发布 info / 已上架 ok），底部审核 / 批量发布快捷按钮

**根因判断**：未知，本卡即审计本身

**方案**：
1. 读设计稿真源：`docs/designs/backend_design_v2.1/reference.md` §5.1（行 501–556 含 AttentionCard / WorkflowCard 描述）+ `docs/designs/backend_design_v2.1/app/screens-2.jsx` Dashboard 部分
2. 读现有实现：`apps/server-next/src/app/admin/page.tsx` + 关联 client 组件
3. 输出 spec ↔ 现状 ↔ 偏离归属对照表（与计划文档 §2.4 同结构）
4. 给 ✅ / ⚠️ / ❌ 总评级 + 偏离项分级
5. 写入 `docs/M-SN-7-design-realign-audit-FULL.md`（新文档，本卡首段）

**涉及文件**：
- 读：`docs/designs/backend_design_v2.1/reference.md` §5.1 + `app/screens-2.jsx` Dashboard 段 + `apps/server-next/src/app/admin/page.tsx` + `apps/server-next/src/app/admin/_client/**`
- 写：**新建** `docs/M-SN-7-design-realign-audit-FULL.md`（仅本卡建首段，后续 PRE-04 子卡接续追加）

**严格约束**（CLAUDE.md §绝对禁止 + 计划文档 §0）：
- ❌ 不动业务代码（审计卡只读 + 写 docs/）
- ❌ 不修计划文档（除非用户明确要求）
- ❌ 不动 SETTINGS / image-health / crawler 等其他路由（本卡仅 dashboard）
- 一旦发现规范偏离立即停止汇报

**执行模型**：claude-opus-4-7（主循环，按 PRE-04 §1.2 模型路由——Sonnet 主循环逐路由扫描；本会话主循环虽为 Opus，仍按 sonnet 模式独立产出审计而不擅自升 Opus）

**估时**：0.05w
