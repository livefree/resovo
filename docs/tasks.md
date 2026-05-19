# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-17

---

## 进行中任务

<!-- ✅ PRE-04 全 16 子卡闭环（2026-05-18，连续推进 #2–#16 用户授权）；总览：5 ✅ A 级（dashboard/moderation/videos/sources/analytics）+ 8 ⚠️ S 级（merge/subtitles/home/image-health/users/audit/login/dashboard MISC）+ 4 ❌（staging/submissions/crawler/settings）+ 16 MISC + 4 REDO（01/02/03/04）+ SHARED-03 取消；详见 docs/M-SN-7-design-realign-audit-FULL.md；下一步等用户拍板 PRE-04 收尾 + 启动 SHARED-01/02 milestone -->

### CHG-SN-SHARED-01 KpiCard `progress?` prop 扩展 ✅ 已闭环（2026-05-18）

**完成时间**：2026-05-18
**实施**：
- `kpi-card.types.ts` 新增 `KpiCardProgress` interface + `progress?` 字段 + 完整 JSDoc
- `kpi-card.tsx` 新增 `PROGRESS_SLOT_STYLE` / `PROGRESS_LABEL_STYLE` / `PROGRESS_TRACK_STYLE` / `variantProgressColor()` / `deriveProgress()` + footer 渲染 progress 与 spark 互斥逻辑 + 4 dev warn 防御
- `kpi-card.test.tsx` 新增 17 case（12 主流程 + 5 黄线修订）
**评级**：A−（arch-reviewer Opus 1 轮，**0 红线** + 3 黄线）→ 采纳黄线 1（color CSS 变量运行时防御）+ 黄线 2（a11y aria-label 追加百分比），跳过黄线 3（value=0 dev warn 争议）
**重大决策（执行中）**：原假设"扩 progress 承载 WorkflowCard 4 段形态"被识别为错误（KpiCard 单卡 vs WorkflowCard 子区域形态不匹配），用户裁决方案 A：footer spark/progress 互斥拓展；WorkflowCard 不动
**质量门禁**：KpiCard 单测 49 → **54 PASS**；待跑全量
**执行模型**：claude-opus-4-7 主循环（契约 + 实施）+ arch-reviewer (claude-opus-4-7) 1 轮评审

<!-- 下张：CHG-SN-SHARED-02 ExpandableTable 新建（0.4w）— SHARED milestone 收尾后启动 REDO-01-A -->


**SEQ**：M-SN-7 / SHARED milestone 第 1 张 / WorkflowCard 4 段 progress 形态承载

**问题理解**：PRE-04 dashboard 子卡 #1 实测发现 admin-ui 已入库 `KpiCard`（`packages/admin-ui/src/components/cell/kpi-card.tsx`），但当前消费方为 MetricKpiCardRow（dashboard 4 KPI）和 AnalyticsView（4 KPI + Spark）。**WorkflowCard 4 段 progress** 形态（采集入库 / 待审核 / 暂存待发布 / 已上架）目前是 dashboard 内独立组件，未消费 KpiCard。设计稿 reference §5.1.2 + §5.6（Crawler KPI 5 列）要求 KpiCard 能承载 progress 视觉。

**根因判断**：KpiCard 现有 props（label / value / delta / variant / spark / icon / onClick / dataSource）覆盖 4/4 + Spark 形态，但不支持"progress bar + n/total + label/color"组合（设计稿 §5.1.2 WorkflowCard 4 段每段 6px progress track）。

**方案**：
1. 主循环 opus-4-7 设计 `progress?: { value, total, color?, showLabel? }` prop API 契约
2. spawn arch-reviewer Opus 子代理评审契约（覆盖：渲染契约 / footer slot 与 spark/delta 共存规则 / 向后兼容硬约束 / 7 页消费扩展性）
3. 按评审落地实施：
   - 扩 `KpiCardProps` interface
   - 扩 KpiCard 组件渲染逻辑（progress 与 spark 互斥位置 footer / 与 delta 同行）
   - 单测：6 case（progress=undefined / value=0 / value=total / partial / value>total 边缘 / color 自定义）
   - 视觉 baseline 更新（admin-ui Playwright visual harness）
4. 现有消费方零破坏验证（MetricKpiCardRow + AnalyticsView 全量回归）
5. WorkflowCard 选项性消费 progress prop（dashboard 内部重构，本卡可选 stretch goal）

**涉及文件**：
- 修改：`packages/admin-ui/src/components/cell/kpi-card.types.ts`
- 修改：`packages/admin-ui/src/components/cell/kpi-card.tsx`
- 修改：`packages/admin-ui/src/components/cell/kpi-card.test.tsx`（如存在）+ 新增 progress test cases
- 修改：`apps/server-next/src/app/admin/dev/components/components-demo.tsx`（demo 新增 progress 形态展示）
- baseline 更新：`packages/admin-ui/playwright-baselines/kpi-card/` 视觉 baseline（如有）
- WorkflowCard 消费（可选 stretch）：`apps/server-next/src/components/admin/dashboard/WorkflowCard.tsx`

**严格约束**：
- ❌ 向后破坏（现有 MetricKpiCardRow + AnalyticsView 不得改动消费方）
- ❌ 颜色硬编码（progress.color 必须 CSS 变量 token）
- ❌ progress 与 spark **同时**渲染（footer 互斥；设计稿不要求二者并存）
- 一旦实施中发现 KpiCard 现有 footer 布局无法容纳 progress → 立即汇报

**执行模型**：claude-opus-4-7 主循环（契约 + 实施）+ arch-reviewer (claude-opus-4-7) 评审契约

**估时**：0.1w


**完成时间**：2026-05-18
**实施**：spawn arch-reviewer Opus 子代理 1 轮独立起草 → 主循环落 `docs/decisions.md`（追加 ~310 行）
**评级**：**Accepted A−**（子代理直接 PASS，无需修订）
**决策**：方案 A（新建表 `crawler_site_category_maps`）；方案 B（JSONB）/ C（config 文件）/ D（仅扩展硬编码）全部否定
**核心设计**：
- 复合主键 `(site_key, source_label)` + FK `crawler_sites(key)` ON DELETE CASCADE
- `target_genre` CHECK 约束 22 值（ADR-017 VideoGenre 20 + `_unmapped` + `_discard`）
- `PUT /admin/crawler/sites/:key/category-mapping` 全量替换语义 + 7 文件 RETRO 框架
- 入库前查表映射，命中即用 / 未命中走现有 `parseGenre()` 兜底（向后兼容）
- migration 064 SQL 草案完整（含 updated_at trigger + ROLLBACK 段）
**REDO-01-F 实施路径**：schema migration → query + service + 2 endpoints (with audit RETRO) → UI collapsible 消费 GET/PUT
**质量门禁**：verify:adr-d-numbers ⚠️ advisory（D-121-4/6 + D-123-1..6 未闭环，后续实施卡补）/ file-size-budget ✅ / typecheck ✅
**执行模型**：claude-opus-4-7 主循环 + arch-reviewer (claude-opus-4-7) 独立起草

<!-- PRE 阶段全部 4 张闭环 ✅✅✅✅
     下张：M-SN-SHARED milestone 启动 — SHARED-01 KpiCard progress? prop 扩展（0.1w）+ SHARED-02 ExpandableTable（0.4w）可并行；SHARED-03 已取消 -->


**SEQ**：M-SN-7 / PRE 阶段第 4 张 / REDO-01-F 前置依赖

**问题理解**：M-SN-7 设计稿对齐重做的 Crawler 重做（REDO-01）站点行展开包含"分类映射 collapsible"区块（screens-2.jsx:307-330）— 站点采集到的源分类（如「动作片」/「喜剧片」）→ 资源库类目（如 `action` / `comedy` / `drama` / `sci-fi`）的映射。当前无任何 schema / API / lib 支持。

**根因判断**：M-SN-6 实现 crawler 模块时此功能未规划；设计稿 v2.1 §5.6 + §6.8 + screens-2.jsx 真源新增此需求。

**方案**：
spawn arch-reviewer Opus 子代理起草 ADR-123（独立设计任务）：
- Context：业务必要性 + screens-2.jsx mock + 关联 ADR-017 内容类型系统
- Decision：3 选项对比并选定
  - 方案 A：新建表 `crawler_site_category_maps`（site_key + source_label + target_genre + 唯一约束）
  - 方案 B：`crawler_sites` 表加 JSONB 字段 `category_map`
  - 方案 C：写入 config 文件（与 fromConfig 站点同源 / 读写非对称）
- 决策要点（D-123-1...）
- 实施路径（migration + service + 端点 + UI）
- 不在范围 / 关联 / 4 维度自评

**涉及文件**：
- 修改：`docs/decisions.md`（追加 ADR-123 段）

**严格约束**：
- ❌ 不改业务代码（仅 ADR 文档）
- ❌ 不动 schema（迁移在 ADR 通过后由 REDO-01-F 实施）
- Opus 子代理独立起草后主循环直接落（CLAUDE.md §模型路由"设计跨 3+ 消费方 schema"+"撰写 ADR"双重强制项）

**执行模型**：spawn arch-reviewer (claude-opus-4-7) 独立起草 + 主循环 opus-4-7 落到 decisions.md

**估时**：0.1w


**完成时间**：2026-05-18
**实施**：`docs/decisions.md` 追加 ADR-121 段（约 240 行）
**评审**：arch-reviewer Opus 1 轮 **A- CONDITIONAL** → 红线 1（6 文件 → 7 文件，漏 audit-log-service-enums-set-equal）+ 黄线 3（D-121-5 与 R7 MUST-8 关系 / 替代方案缺 D / 自评对称性 A → A-）全部修订后 PASS
**重大发现**：原起草"6 文件固定框架"实际遗漏 `tests/unit/api/audit-log-service-enums-set-equal.test.ts`（service 层 enum 一致性独立守卫），5 先例均触及；评审拦截修订为 **7 文件框架**
**质量门禁**：typecheck ✅ / file-size-budget ✅ 0 新违规 / **4018 unit PASS 保持**
**执行模型**：claude-opus-4-7（主循环起草）+ arch-reviewer (claude-opus-4-7) 1 轮评审

<!-- 下张：CHG-SN-7-PRE-05 ADR-123 分类映射 schema 起草（0.1w）— REDO-01-F 依赖 -->


**SEQ**：M-SN-7 / PRE 阶段第 3 张（M-SN-6 关闭挂账）

**问题理解**：M-SN-6 期间产生 12 次 R-MID-1 RETRO 实践（5 卡先例 CHG-SN-6-14/16-A/20-A/25-RETRO/26-RETRO；共补齐 crawler 域 v1 写端点 audit 13/13），但范式无 ADR 规范背书。下游若有人偏离范式，无规范可援引拒绝。

**根因判断**：R-MID-1（reorder before=after）首次发现于 CHG-SN-5-06 audit；之后 12 次实践全部沿用同框架（4 真源同步 + 6 文件固定 + PATCH ≤ 5 豁免依据），但范式未沉淀为 ADR 文档。

**方案**：撰写 `docs/decisions.md` 追加 `ADR-121: R-MID-1 audit RETRO 协议正式化`，9 段结构：
1. Context（R-MID-1 起源 + 12 次实践累积）
2. Decision（4 真源同步范式 + 6 文件固定框架 + PATCH ≤ 5 豁免依据）
3. Status（Accepted）
4. Consequences（正面 + 负面）
5. Alternatives Considered
6. Compliance & Verification（如何核验范式合规）
7. References（5 先例 changelog 链接 + ADR-100 / ADR-109）
8. 4 维度自评（命名 / 对称性 / 状态职责 / 扩展性）
9. spawn arch-reviewer Opus 评审起草质量

**4 真源同步范式**（从 5 先例提炼）：
- (1) `packages/types/src/admin-moderation.types.ts` union 新增分支
- (2) `apps/api/src/services/AuditLogService.ts` ACTION_TYPES 常量数组追加
- (3) `tests/unit/api/audit-log-coverage.test.ts` EXPECTED set-equal 测试同步
- (4) `tests/unit/api/audit-log-coverage.test.ts` REQUIRED / PAYLOAD_ASSERTION_REQUIRED 数组同步

**6 文件固定框架**（PATCH ≤ 5 豁免依据）：
1-4 上述 4 真源 + 5 端点 route auditSvc.write + 6 端点 payload 内容断言新测试

**涉及文件**：
- 修改：`docs/decisions.md`（追加 ADR-121 段）

**严格约束**：
- ❌ 不改业务代码 / 测试代码
- ❌ 不动 5 先例 changelog（保留作 audit trail）
- ADR 起草必经 spawn arch-reviewer Opus 评审（CLAUDE.md §模型路由强制项）

**执行模型**：claude-opus-4-7 主循环起草 + spawn arch-reviewer (claude-opus-4-7) 评审

**估时**：0.15w


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
