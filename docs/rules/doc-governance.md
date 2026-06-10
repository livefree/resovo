# 文档治理规范（Doc Governance）

> status: active
> owner: @engineering
> scope: docs lifecycle — cleanup, archive, index update, conflict & reference verification
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10

本规范定义一个**可重复执行的文档治理流程**：在阶段性开发完成后或发现文档问题时，按固定步骤完成清理、归档、索引更新、冲突检测与引用修复。本规范是 `docs/README.md` §5「冲突与归档约定」的执行层展开，二者冲突时以本文件为准并回写 README。

---

## 1. 文档分类模型

治理动作按文档类别区别对待。所有 `docs/**/*.md` 必须能归入下表之一：

| 类别 | 位置 | 生命周期 | 治理策略 |
| --- | --- | --- | --- |
| **真源（Source of Truth）** | `architecture.md` / `decisions.md` / `server_next_plan_*.md` / `designs/backend_design_v2.1/reference.md` | 常青，只更新不归档 | 内容修订 + `last_reviewed` 刷新；过期章节就地标注，不整文件归档 |
| **规则（Rules）** | `docs/rules/*.md` | 常青 | 同上；规则废止时整文件加 `superseded_by` 后移入 archive |
| **工作流文档** | `tasks.md` / `task-queue.md` / `changelog.md` / `tracks.md` | 常青 + 分段归档 | 超长时按 milestone 分段切入 `archive/<topic>/`，活文件保留活跃段 |
| **方案/设计（Plan/Design）** | `docs/designs/*_YYYYMMDD.md` | 一次性，随序列落地而过期 | 对应 SEQ 全部 ✅ 后进入归档判定（§4 判定表） |
| **台账/审计（Audit）** | `docs/audit/*` | 跟随评审周期 | 评审闭环后归档；生成型文件（`adr-d-status.json`）永不手改、永不归档 |
| **手册（Manual）** | `docs/manual/**` | 常青，随页面共存亡 | 页面/路由退役时对应手册同卡归档；`verify:manual-coverage` 守门 |
| **归档（Archive）** | `docs/archive/**` | 终态 | 只读。只允许：追加索引条目、修复入链。禁止内容修改 |

**frontmatter 契约**（全体 `docs/**/*.md`，archive 内文件同样适用）：

```yaml
> status: active | stale | archived
> owner: @engineering
> scope: <一句话职责>
> source_of_truth: yes | no
> supersedes: none | <path>
> superseded_by: none | <path>
> last_reviewed: YYYY-MM-DD
```

- 新建文档缺 frontmatter → 当次治理中补齐。
- `superseded_by` 指向的文件必须真实存在（§6 检查项 C3）。

---

## 2. 触发条件（何时执行）

| 触发器 | 时机 | 执行范围 |
| --- | --- | --- |
| **T1 · 阶段收尾** | PHASE COMPLETE 审计前 / milestone 完结 | 全量流程（§3 Step 1–6） |
| **T2 · 序列收尾** | 某 SEQ 全部任务 ✅，且其设计文档不再被活跃序列引用 | 仅该序列产出文档：Step 2/3/6 |
| **T3 · 即时小修** | 任意任务中发现文档错误（断引用 / 内容与实现矛盾 / 索引缺漏） | 单点修复：Step 5/6，**不扩大范围** |
| **T4 · 季度归档** | 每季度首个治理窗口（新季度第一次 T1 时合并执行） | 新建 `archive/<YYYYQn>/` + README，迁移上季终态文档 |
| **T5 · 活文档超限** | `task-queue.md` / `changelog.md` 活跃段 > 4000 行 | 分段归档：Step 2/3/6 |

T1/T4/T5 必须走任务卡（卡型 `CHORE-DOCS-CLEANUP-<YYYYMMDD>`，按 workflow-rules 正常写入 tasks.md）；T2 可附挂在序列最后一张卡的完成备注里执行；T3 在当前任务内完成，但**只允许修复引用与索引，不允许顺手改业务内容**（CLAUDE.md「文件范围」禁令仍然生效，修复项逐条记入完成备注）。

---

## 3. 治理流程（六步，按序执行）

### Step 1 · 盘点分类

产出一张**盘点清单**（写在任务卡执行备注，不另建文件）：

```bash
# 候选：活区中所有方案/审计文档
ls docs/designs/*.md docs/audit/*.md

# 候选：frontmatter 标记异常（active 但其 SEQ 已完结，或 stale 滞留活区）
grep -rl "status: stale" docs --include="*.md" | grep -v archive/
```

对每个候选文档回答三问并记录结论：
1. 是否仍被活跃序列 / 真源 / 规则引用？（`grep -rn "<文件名>" docs/ --include="*.md" | grep -v archive/`）
2. 对应 SEQ / 评审是否已全部闭环？（对照 task-queue.md）
3. 是否属于「被引用保留」特例？（如 `adr177-external-refs-relation_20260602.md` 被 decisions.md 引用 → 保留并在 README §2 注明理由）

### Step 2 · 归档执行

对判定为「归档」的文档（判定表见 §4）：

1. 文件 frontmatter 更新：`status: archived` + `superseded_by`（若有继任者）。
2. `git mv` 到目标位置：
   - 方案/审计 → `docs/archive/<YYYYQn>/`（同主题 ≥ 3 份时建子目录，如 `design-iterations/`）
   - 活文档分段 → `docs/archive/changelog/` 或 `docs/archive/task-queue/`，命名 `<name>_<里程碑范围>_<YYYYMMDD>.md`
3. 追加条目到 `docs/archive/<YYYYQn>/README.md`（一行：文件名 + 一句话内容 + 归档原因）。
4. **changelog 分段后**必须同步 `scripts/verify-adr-d-numbers.mjs` 的 `CHANGELOG_ARCHIVES` 数组，否则 D-N 闭环统计回退（历史教训，强制项）。
5. **task-queue 分段后**核对新序列号不与归档段重号。

### Step 3 · 索引与真源更新

归档/新增文档后，按依赖方向自内向外更新索引（顺序固定）：

1. `docs/archive/<YYYYQn>/README.md`（Step 2 已做）
2. `docs/README.md`：§2 当前执行上下文移除已归档项 → §3 已归档参考追加；§1/§4 如有真源/规则变化同步；刷新 `last_reviewed`
3. `CLAUDE.md`：仅当**规则文件增删**或**真源路径变化**时更新「规范文件索引」表，其余情况不动
4. 真源内指向被归档文档的引用：改为指向 archive 新路径（不删除引用，保留历史可追溯）

### Step 4 · 冲突检测

逐项检查，发现冲突先记录再修复（修复原则：**真源优先级 CLAUDE.md > rules > 真源文档 > 方案文档**，低优先级一侧修改或标注）：

| # | 冲突类型 | 检查方法 |
| --- | --- | --- |
| K1 | 同一约束在多文件表述不一致（如组件清单、禁令、命令） | 对本次改动涉及的主题词 grep 全 docs，逐处对照 |
| K2 | 真源声明冲突：同一主题出现两个 `source_of_truth: yes` | `npm run verify:docs-format` 检查 [5]（按文件名判重）；跨文件名的同 scope 冲突再以 `grep -rl "source_of_truth: yes" docs --include="*.md" \| grep -v archive/` 人工对照 scope 行 |
| K3 | 已退役内容仍以现行口吻出现（如 v1 组件被推荐使用） | 对退役关键词（`ModernDataTable`、`apps/server` 等）grep 活区，应仅以「已退役」口吻出现 |
| K4 | 双向链断裂：A 声明 `superseded_by: B`，但 B 未声明 `supersedes: A` | 抽查本次涉及的替代链 |

冲突无法当场裁决（涉及架构语义）→ 按 CLAUDE.md 模型路由 spawn Opus 子代理裁决，或写 BLOCKER。

### Step 5 · 引用健康检查与修复

```bash
# R1 markdown 链接目标存在性（手动程序，工具化见 §7）
grep -rnoE '\]\((\.\./)*(docs/)?[A-Za-z0-9_./-]+\.(md|json)' docs --include="*.md" \
  | sed -E 's/.*\]\(//' | sort -u | while read -r p; do
    [ -f "$p" ] || [ -f "docs/$p" ] || echo "BROKEN: $p"
  done

# R2 纯文本路径引用（`docs/...` 反引号风格）
grep -rnoE '`docs/[A-Za-z0-9_./-]+\.(md|json)`' docs CLAUDE.md --include="*.md" \
  | sed -E 's/.*`(docs[^`]+)`.*/\1/' | sort -u | while read -r p; do
    [ -f "$p" ] || echo "BROKEN: $p"
  done

# R3 现有自动核验（治理收尾必跑）
npm run verify:docs-format
npm run verify:adr-contracts
npm run verify:manual-coverage
```

扫描范围：**仅活区 + `CLAUDE.md`**。`docs/archive/**` 内部的引用是归档时点的历史快照，不修（R1/R2 程序中先 `grep -v "^docs/archive/"` 排除）。

修复规则：
- 目标已归档 → 引用改指 archive 新路径，并在引用处补「已归档」字样。decisions.md ADR 正文内的引用同样只改路径、不改其余文字（编号与上下文是历史记录）。
- 目标确已删除且无继任 → 删除该引用并在完成备注登记。
- ADR / D-N / CHG / SEQ 编号引用错误 → 以 `decisions.md` / changelog（含归档段）为准修正，**禁止反向改编号真源**。

### Step 6 · 记录与提交

1. 完成备注：盘点清单结论 + 归档清单 + 冲突修复清单 + R1/R2 残留（若有，登记原因）。
2. `docs/changelog.md` 追加 `CHORE-DOCS-CLEANUP-<YYYYMMDD>` 记录（统一模板，修改文件逐一列出）。
3. 全部新增/移动文件 `git add`（CLAUDE.md 禁令：docs 新文档必须纳入版本控制；`git mv` 保留历史）。
4. 单独 commit，格式 `docs(CHORE-DOCS-CLEANUP-<YYYYMMDD>): <摘要>`，**不与业务代码混提**。
5. T3 即时小修：附在当前任务 commit 内，但 changelog 备注中单列「文档修复」段。

---

## 4. 归档判定表

满足任一「归档」行即归档；满足任一「保留」行则保留并在 README §2 登记保留理由。**保留判定优先于归档判定。**

| 判定 | 条件 |
| --- | --- |
| **保留** | 被真源（decisions.md / architecture.md / reference.md）或 manual 真源引用作为定档输入 |
| **保留** | 对应 SEQ 仍有 🟡/⏳ 任务，或 follow-up 触发条件登记在 task-queue |
| **保留** | 常青类别（真源 / 规则 / 手册 / 工作流活跃段） |
| **归档** | 方案文档：对应 SEQ 全部 ✅ 且无活跃引用，自最后一个任务完成起 ≥ 14 天 |
| **归档** | 审计/验收文档：评审结论已写入 changelog 或被后续审计取代 |
| **归档** | 被 `superseded_by` 指向继任者 → **立即**归档，不等窗口期 |
| **归档** | 活文档分段：触发 T5（活跃段 > 4000 行），保留当前 milestone 段 |
| **人工裁决** | `last_reviewed` 距今 > 180 天且非常青类别，但不满足上述任何归档行 → 列入盘点清单请用户裁决，不得擅自归档 |

---

## 5. 角色与模型路由

- 机械执行步骤（`git mv`、索引条目追加、changelog 模板填充、frontmatter 批量补齐）→ spawn **doc-janitor / Haiku** 子代理，符合 CLAUDE.md「强制降 Haiku」第 2/5 条。
- 冲突裁决涉及架构语义（K1–K3 中无法机械判定者）→ 主循环自判或按需 spawn **Opus** 子代理。
- 子代理调用照常记入任务卡「子代理调用」字段与 changelog。

## 6. 禁止事项

- ❌ 修改 `docs/archive/**` 内文件内容（仅允许追加季度 README 索引、修复指向它的入链）
- ❌ 手改生成型文件（`docs/audit/adr-d-status.json`）
- ❌ 归档时直接 `rm` 或不经 `git mv` 复制粘贴（丢失历史）
- ❌ changelog/task-queue 分段后不同步 `verify-adr-d-numbers.mjs` 的归档数组
- ❌ T3 即时小修时顺手做范围外的归档/重组（升级为 T1 任务卡）
- ❌ 复用/重排 ADR、SEQ、CHG、D-N 编号以「整理」之名
- ❌ 删除真源中指向归档文档的历史引用（只改路径，不删上下文）
- ❌ 治理 commit 与业务代码混提

## 7. 工具缺口（后续卡登记，非本规范阻塞项）

以下检查当前以 §3 Step 5 的 shell 程序人工执行，达到触发条件时起独立小卡工具化：

1. `scripts/verify-doc-links.mjs`：R1+R2 自动化（扫描 markdown link + 反引号路径 → 存在性核验），advisory 模式接入 `verify:adr-contracts` 链。触发条件：连续 2 次治理中 R1/R2 发现 ≥ 3 处断链。
2. K4（supersedes 双向链连通性）自动化：frontmatter 字段完整性与 K2 真源唯一性已由 `scripts/check-docs-format.sh` 检查 [4]/[5] 覆盖，K4 与 stale 告警（`last_reviewed` > 180 天清单）尚缺，建议扩展该脚本而非新建。触发条件：治理中发现 ≥ 2 处断链或盘点超 30 份待裁决。

> 已知遗留：`verify:docs-format` 当前报 60+ 项历史 frontmatter 缺失（manual/、rules/ 部分文件），属存量债务，不阻断（脚本 advisory 输出）。首次 T1 全量治理时按 §3 Step 1 一并补齐。
