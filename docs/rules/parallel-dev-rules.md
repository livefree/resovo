# Resovo（流光） — 并行开发规范

> status: active
> owner: @engineering
> scope: parallel track lifecycle, conflict zone lock, track registry, integration protocol
> source_of_truth: yes
> supersedes: none
> last_reviewed: 2026-05-01

---

## 一、核心概念：Track（开发轨道）

**Track** 是一条并发开发流，拥有独立的 git 分支、任务文件和文件作用域声明。每条 Track 内部的单任务约束不变；Track 之间可并行，但须遵守冲突域锁协议。

### 上限与触发

- **最多同时 3 条 Track**（含主干 Track）。超过 3 条时协调成本高于并行收益，禁止新开。
- **触发条件**：存在 ≥ 2 条独立工作流（文件域不重叠、无 ADR 等架构决策前置依赖），且当前主干已有足够多可并行推进的任务。
- **不适合并行的情形**：
  - 所有待开任务都触碰同一冲突域
  - 当前存在未解除的共享层 Opus 评审门（架构 API 契约未 PASS）
  - 任一 Track 处于 BLOCKER 状态时，禁止新开其他 Track（先解除 BLOCKER）
  - 仅剩 1 条有意义的独立工作流

---

## 二、Track 注册表（docs/tracks.md）

并行模式激活时，维护 `docs/tracks.md` 作为轨道注册表（不存在则新建）。

### 字段格式

```markdown
## <track-id>

- **状态**：🔄 活跃 / ✅ 已集成 / ⛔ 已取消
- **分支**：track/<track-id>
- **任务文件**：docs/tasks-<track-id>.md
- **文件作用域**：[目录/文件列表，越详细越好]
- **持有冲突域**：[无 / 列举冲突域名称]
- **创建时间**：YYYY-MM-DD HH:mm
- **集成时间**：YYYY-MM-DD HH:mm（完成后填写）
- **说明**：一句话描述 Track 目标
```

### 生命周期

```
Propose → Open → Active → [BLOCKER?] → Integrate → Close
```

1. **Propose**：检查冲突域是否空闲，检查待开任务是否构成独立流。
2. **Open**：从 `main` 切出 `track/<id>` 分支，新建 `docs/tasks-<id>.md`，向 `docs/tracks.md` 追加注册条目。
3. **Active**：在各自 Track 内按正常单任务流程推进（workflow-rules.md §三步顺序）。
4. **Integrate**：Track 内全部任务完成 + 质量门禁通过 → 创建 PR 合并至 `main`。
5. **Close**：PR 合并后删除 `track/<id>` 分支，更新 tracks.md 状态为 `✅ 已集成`，tasks-<id>.md 归档至 `docs/archive/tasks/`。

---

## 三、冲突域（Conflict Zones）

以下为**硬冲突域**：同一时刻只允许一条 Track 持有写权，其他 Track 触碰前须等待持有 Track 集成。

| 冲突域名称 | 路径 |
|---|---|
| `shared-components` | `packages/admin-ui/src/` |
| `design-tokens` | `packages/design-tokens/` |
| `adr` | `docs/decisions.md` |
| `architecture` | `docs/architecture.md` |
| `workspace-root` | 根 `package.json` / `pnpm-workspace.yaml` |

以下为**软冲突域**：append-only 写入协议保证安全，无需独占锁，但并行写入前须人工确认无内容冲突。

| 软冲突域名称 | 路径 | 协议 |
|---|---|---|
| `task-queue` | `docs/task-queue.md` | 尾部追加，不改已有条目 |
| `changelog` | `docs/changelog.md` | 尾部追加，每条含 Track ID |

### 硬冲突域锁协议

1. Track 需要修改硬冲突域时，先查 `docs/tracks.md` — `持有冲突域` 字段。
2. 若该域已被另一 Track 持有 → 写入 BLOCKER，等待持有 Track 集成后释放。
3. 若未被持有 → 更新自身 tracks.md 条目的 `持有冲突域` 字段，然后开始修改。
4. Track 集成（PR 合并）后，`持有冲突域` 清空为 `无`。

> **注意**：共享组件 API 契约变更（`packages/admin-ui` 新增/修改 Props 类型）必须先完成 Opus arch-reviewer 评审，才能进入 Active 阶段。这一 Opus 门本身是串行点，不受 Track 数量影响。

---

## 四、任务文件约定

### 并行模式下的 tasks.md

- 并行模式激活后，`docs/tasks.md` 降级为**协调器视图**：只写 BLOCKER 通知 + Track 间冲突仲裁，不再承载单任务工作台职责。
- 文件顶部追加以下标记（并行模式激活时写入，关闭时删除）：

```markdown
> **并行模式**：当前有 N 条 Track 活跃，工作台见各 `docs/tasks-<id>.md`。
> 本文件仅用于 BLOCKER 监控与 Track 间仲裁。
```

### 每条 Track 的任务文件（docs/tasks-\<id\>.md）

- 与 `docs/tasks.md` 格式完全相同，遵守同等单活任务约束（同一时刻只允许 1 个 `🔄 进行中`）。
- Track 内任务的来源序列（`来源序列` 字段）仍指向 `docs/task-queue.md` 中的原序列。
- 文件头部注明所属 Track：`> Track: <track-id>`

### 单轨模式恢复

所有 Track 集成完毕，`docs/tracks.md` 全部条目为 `✅` → 并行模式结束：删除 `tasks.md` 的并行模式标记，恢复为单任务工作台。

---

## 五、分支策略扩展

```
main ← 每次 Track 集成后合并（PR，不 fast-forward）
track/<track-id> ← 每条 Track 的独立分支（从 main 切出）
```

- Track 分支从 **`main` 的当前 HEAD** 切出，不从其他 Track 分支切出。
- 集成采用 PR（非 force push，非 rebase），commit history 保留。
- PR 标题格式：`track(<track-id>): <Track 目标一句话描述>`
- PR 合并后立即删除 `track/<id>` 分支。

### 并行 Track 间的代码同步（非强制，按需）

当 Track A 需要消费 Track B 已产出但尚未集成的共享组件时：
- 首选等待 Track B 先集成。
- 若等待代价过高，可在 Track A 分支中 `git cherry-pick` 具体 commit，并在 PR 描述中标注依赖关系，由人工确认合并顺序（先 B 后 A）。
- **禁止** Track 分支互相 merge（会产生交叉依赖，导致集成顺序无法保证）。

---

## 六、质量门禁（并行版）

每条 Track 在集成 PR 创建前必须独立通过：

```bash
npm run typecheck        # 在 track/<id> 分支上
npm run lint
npm run test -- --run
```

集成后（PR 合并到 main），在 main 上再跑一次完整质量门禁，确认无合并回归。

- **BLOCKER 作用域**：Track 内的 BLOCKER 只阻塞本 Track，不阻塞其他 Track。
  - 例外：若 BLOCKER 涉及硬冲突域，则阻塞所有尝试持有同一冲突域的 Track。
- **milestone 阶段审计**（Opus arch-reviewer）仍串行，须等全部相关 Track 集成到 main 后进行。

---

## 七、task-queue.md 的 Track 标注（可选）

task-queue.md 中的任务条目可添加可选字段 `track:`，预先分配给某条 Track：

```markdown
- **track**：sn4-api（可选；缺省则由任何 Track 按作用域自行认领）
```

未标注 `track:` 的任务，由第一个将其纳入作用域的 Track 认领（认领后在 tracks.md 的 `文件作用域` 字段体现）。

---

## 八、与现有规范的衔接

| 现有规范 | 并行模式下的变化 |
|---|---|
| `workflow-rules.md` §三步顺序 | 不变；"读 tasks.md" → 改为"读 docs/tasks-<id>.md" |
| `workflow-rules.md` §单活任务约束 | 约束范围缩小到 Track 内（Track 间并行合法） |
| `git-rules.md` §分支策略 | 扩展 track/<id> 分支类型；集成 PR 协议新增 |
| `quality-gates.md` | 不变；每条 Track 独立运行，集成后 main 再跑一次 |
| `workflow-rules.md` §BLOCKER | 作用域限定本 Track（除硬冲突域冲突外） |
| `CLAUDE.md` §模型路由规则 | 不变；每条 Track 内的主循环模型独立选择 |
