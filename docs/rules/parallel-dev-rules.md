# Resovo（流光） — 并行开发规范

> status: active
> version: v1.1（2026-05-01 修订：冲突域粒化 / tracks.md 写入协议 / task-queue 写入分类 / BLOCKER 口径统一 / e2e 继承 / git 净化检查 / 适用面指南新增）
> owner: @engineering
> scope: parallel track lifecycle, conflict zone lock, track registry, integration protocol
> source_of_truth: yes
> supersedes: none
> last_reviewed: 2026-05-01

---

## 一、核心概念：Track（开发轨道）

**Track** 是一条并发开发流，拥有独立的 git 分支、任务文件和文件作用域声明。每条 Track 内部的单任务约束不变；Track 之间可并行，但须遵守冲突域锁协议。

### 上限与适用条件

- **最多同时 3 条 Track**（含主干 Track）。超过 3 条时协调成本高于并行收益，禁止新开。
- **触发条件**：存在 ≥ 2 条独立工作流（文件域不重叠、无未完成的 ADR/Opus 架构评审门），且这些工作流的收益大于 Track 管理开销。
- **最适合并行的场景**（详见 §八 适用面指南）：
  - server-next 不同路由模块（各自目录隔离）
  - 一条做业务页面，另一条做测试补齐 / mock 数据整理
  - UI 实现 + 独立的 API 接口层（无共享组件新增需求）
  - 文档审计 / changelog 整理等与业务代码完全隔离的流

---

## 二、Track 注册表（docs/tracks.md）

并行模式激活时，维护 `docs/tracks.md` 作为轨道注册表（不存在则新建）。

### tracks.md 写入协议（防并发冲突）

`docs/tracks.md` 本身是协调中枢，**多 Track 并发写入会产生合并冲突**。规避方式：

1. 文件采用**命名区块结构**：文件顶部是人工维护的汇总表（只由人工 / 操作员更新），正文每条 Track 独占一个 `## <track-id>` 区块。
2. **每条 Track 只写自己的 `## <track-id>` 区块**，不修改其他 Track 区块或汇总表。
3. 汇总表（`docs/tracks.md` 头部的 Track 清单）由人工在 Open / Close 时维护。

### 字段格式（每条 Track 的命名区块）

```markdown
## <track-id>

- **状态**：🔄 活跃 / ✅ 已集成 / ⛔ 已取消
- **分支**：track/<track-id>
- **任务文件**：docs/tasks-<track-id>.md
- **文件作用域**：[目录/文件列表，越具体越好]
- **持有冲突域**：[无 / 列举冲突域名称]
- **创建时间**：YYYY-MM-DD HH:mm
- **集成时间**：YYYY-MM-DD HH:mm（完成后填写）
- **说明**：一句话描述 Track 目标
```

### 生命周期

```
Propose → Open → Active → [BLOCKER?] → Integrate → Close
```

1. **Propose**：检查冲突域是否空闲；确认待开任务构成独立工作流（见 §八）。
2. **Open**：
   - **前置**：`git status --short` 必须为空（无未提交改动）
   - 从 `main` HEAD 切出 `track/<id>` 分支
   - 新建 `docs/tasks-<id>.md`（头部写 `> Track: <track-id>`）
   - 在 `docs/tracks.md` 追加自己的命名区块（不改汇总表，人工维护汇总表）
3. **Active**：在 Track 内按正常单任务流程推进（workflow-rules.md §三步顺序）。
4. **Integrate**：Track 内全部任务完成 + 质量门禁通过 → 创建 PR 合并至 `main`。
   - **前置**：`git status --short` 必须为空；task-queue.md B 类状态更新须在此时完成（见 §三）
5. **Close**：PR 合并后删除 `track/<id>` 分支，更新自身区块状态为 `✅ 已集成`，`tasks-<id>.md` 归档至 `docs/archive/tasks/`。

---

## 三、冲突域（Conflict Zones）与写入协议

### 硬冲突域（独占锁，同时只允许一条 Track 持有写权）

| 冲突域名称 | 路径 | 备注 |
|---|---|---|
| `admin-ui:api-surface` | `packages/admin-ui/src/index.ts` + 任何新 Props 类型定义文件 | 变更 API 契约须先完成 Opus arch-reviewer 评审 |
| `admin-ui:shell` | `packages/admin-ui/src/shell/` | Shell 层编排逻辑 |
| `design-tokens` | `packages/design-tokens/` | Token 层变更全局影响 |
| `adr` | `docs/decisions.md` | ADR 写入 |
| `architecture` | `docs/architecture.md` | Schema / 分层变更 |
| `workspace-root` | 根 `package.json` / `pnpm-workspace.yaml` | 依赖 / 工作区 |

> **`admin-ui` 粒化说明**：修改已有组件的内部实现（不改 Props 类型签名、不改 index.ts 导出）属于**组件级软锁**（见下方），不持有 `admin-ui:api-surface` 或 `admin-ui:shell` 硬锁。这样凡是不新增/改变公开 API 的 admin-ui 改动都不再强制串行，大幅提升后台重构阶段的并行收益。

### 组件级软锁（per-component，无需独占，但须在 tracks.md 声明）

修改 `packages/admin-ui/src/components/<component-name>/` 内部实现时，只须在自身 tracks.md 区块的 `持有冲突域` 字段写入 `admin-ui:component:<component-name>`，防止同组件被另一条 Track 同时改写。一旦集成，该组件锁释放。

### 软冲突域（append-only 协议，无独占锁）

| 软冲突域名称 | 路径 | 安全写入类型 |
|---|---|---|
| `tracks.md` | `docs/tracks.md` | 只写自己的命名区块（见 §二） |
| `changelog` | `docs/changelog.md` | 尾部追加，每条含 Track ID |
| `task-queue-append` | `docs/task-queue.md` | **仅** Type A 写入（见下） |

### task-queue.md 写入协议（Type A / Type B 分类）

**Type A（追加，随时安全）**：
- 追加新序列块（新 `## [SEQ-...]`）
- 追加 BLOCKER / PHASE-COMPLETE 通知块
- 追加 Track 标注字段 `track:` 到未开始任务

**Type B（原地更新，必须串行）**：
- 更新任务状态（`⬜ → 🔄 → ✅`）、填写完成时间、写入完成备注
- 更新序列整体状态（`🔄 → ✅`）

> Track 活跃期间**禁止在分支上做 Type B 写入**。Type B 更新统一在集成阶段（PR 合并到 main 时）按串行顺序执行，一次一条 Track，防止并行分支产生 task-queue 状态的 git 冲突。

### 硬冲突域锁协议（步骤）

1. Track 需要修改硬冲突域时，先查 `docs/tracks.md` 各区块的 `持有冲突域` 字段。
2. 若该域已被另一 Track 持有 → 本 Track 发出 BLOCKER（§七），等待持有 Track 集成后锁释放。
3. 若未被持有 → 在自身区块的 `持有冲突域` 字段追加该域名，然后开始改动。
4. PR 合并后，将 `持有冲突域` 字段清空为 `无`。

---

## 四、任务文件约定

### 并行模式下的 tasks.md

并行模式激活后，`docs/tasks.md` 降级为**协调器视图**：只写 BLOCKER 通知 + Track 间冲突仲裁。顶部追加以下标记（并行模式激活时写入，恢复单轨时删除）：

```markdown
> **并行模式**：当前有 N 条 Track 活跃，工作台见各 `docs/tasks-<id>.md`。
> 本文件仅用于 BLOCKER 监控与 Track 间仲裁。
```

### 每条 Track 的任务文件（docs/tasks-\<id\>.md）

- 与 `docs/tasks.md` 格式完全相同，遵守同等单活任务约束（同一时刻只允许 1 个 `🔄 进行中`）。
- `来源序列` 字段仍指向 `docs/task-queue.md` 中的原序列。
- 文件头部：`> Track: <track-id>`

### 单轨模式恢复

所有 Track 集成完毕，`docs/tracks.md` 全部区块为 `✅` → 删除 `tasks.md` 的并行模式标记，恢复单任务工作台。

---

## 五、分支策略扩展

```
main              ← 每次 Track 集成后合并（PR，non-fast-forward）
track/<track-id>  ← 每条 Track 的独立分支（从 main HEAD 切出）
```

- Track 分支只从 `main` 切出，禁止从其他 Track 分支切出。
- 集成采用 PR（非 force push，非 rebase），commit history 保留。
- PR 标题格式：`track(<track-id>): <Track 目标一句话描述>`
- PR 合并后立即删除 `track/<id>` 分支。
- **禁止** Track 分支互相 merge（产生交叉依赖，集成顺序失控）。

### Track 间代码同步（按需，谨慎使用）

Track A 需要消费 Track B 已产出但尚未集成的共享组件时：首选等待 Track B 先集成。若等待代价过高，可 `git cherry-pick` 具体 commit，PR 描述中标注依赖关系，人工确认合并顺序（先 B 后 A）。

---

## 六、质量门禁（并行版）

每条 Track 创建集成 PR 前必须在 **track/<id> 分支**上独立通过：

```bash
npm run typecheck
npm run lint
npm run test -- --run
```

若 Track 内包含 **PLAYER / AUTH / SEARCH / VIDEO** 类型的任务，还须通过（继承 CLAUDE.md 必跑命令约束）：

```bash
npm run test:e2e
```

集成后（PR 合并到 main），在 main 上再跑一次完整质量门禁，确认无合并回归。

milestone 阶段审计（Opus arch-reviewer）仍串行，须等全部相关 Track 集成到 main 后进行。

---

## 七、BLOCKER 规则（统一口径）

> v1.0 在"不适合并行的情形"和"质量门禁"两处对 BLOCKER 的表述有歧义，此处统一。

### 基本规则：BLOCKER 只阻塞本 Track

Track 内的 BLOCKER 只停止本 Track 工作，**不自动阻塞其他活跃 Track**。其他 Track 继续推进。

### 例外：冲突域相关 BLOCKER 会间接阻塞

若 BLOCKER 的触发原因是"需要等待某硬冲突域释放"：

- 该 BLOCKER 写入本 Track 的 tasks-<id>.md
- 同时在 `docs/tracks.md` 保留"持有冲突域"为当前持有方
- 其他 Track 尝试持有同一硬冲突域时，会读到该域仍被占用 → **其他 Track 自行等待**，但并非被 BLOCKER 直接阻塞

### 新开 Track 的限制

新 Track 可以在任何时候提出，但 Open 操作前必须满足：

- 新 Track 的文件作用域与已存在的任一 Track 不重叠（含持有冲突域不冲突）
- 并行上限（3 条）未超出

> 即：某 Track 有 BLOCKER 不妨碍另一个文件域完全独立的新 Track 开始。但如果新 Track 需要持有同一冲突域，则等待冲突域释放后才能 Open。

---

## 八、适用面指南

### 强适合场景

| 场景 | 示例 | 说明 |
|---|---|---|
| server-next 不同路由模块 | Track A 做 `/admin/users`，Track B 做 `/admin/analytics` | 文件目录天然隔离 |
| 业务页面 + 测试补齐 | Track A 实现业务逻辑，Track B 补单测 / e2e | 测试文件与实现文件作用域不重叠 |
| 业务页面 + mock 数据整理 | Track A 做 API 集成，Track B 整理 mock-data.ts | mock 文件本地化，不影响实现 |
| 文档审计 / changelog 整理 | Track A 做功能开发，Track B 补文档欠账 | 完全隔离，零冲突 |
| API 接口层 + UI 消费层 | Track A 写 apps/api 端点，Track B 写 server-next 页面（API 未就绪时用 mock） | API 层与 UI 层目录不重叠 |

### 弱适合 / 需要评估场景

| 场景 | 风险 | 建议 |
|---|---|---|
| 两条 Track 都需要修改 packages/admin-ui 共享组件 | 触发组件级软锁竞争 | 先拆任务，确认两条 Track 改的是不同组件 |
| 一条做新 admin-ui 组件（改 index.ts），另一条消费它 | 依赖未就绪，B Track 要等 | cherry-pick 或等 A 先集成 |
| 两条 Track 都有大量 task-queue.md Type B 写入 | 集成时状态更新容易冲突 | 约定一条 Track 先集成，另一条在此之后处理状态 |

### 不适合场景

- 所有待开任务都触碰同一硬冲突域（强制串行，开多 Track 无收益）
- 当前有未完成的共享层 Opus API 契约评审（架构未稳定，并行实现风险高）
- 任务数量少（< 6 个待开任务），Track 管理开销得不偿失
- 只有 1 条有意义的独立工作流

---

## 九、task-queue.md 的 Track 标注（可选）

task-queue.md 中的任务条目可添加可选字段 `track:`，预先分配给某条 Track：

```markdown
- **track**：sn4-api（可选；缺省则由任何 Track 按作用域自行认领）
```

未标注 `track:` 的任务，由第一个将其纳入作用域的 Track 认领（认领后在 tracks.md 区块的 `文件作用域` 字段体现）。

---

## 十、与现有规范的衔接

| 现有规范 | 并行模式下的变化 |
|---|---|
| `workflow-rules.md` §三步顺序 | 不变；读 `tasks-<id>.md` 替代 `tasks.md` |
| `workflow-rules.md` §单活任务约束 | 约束范围缩小到 Track 内；Track 间并行合法 |
| `workflow-rules.md` §BLOCKER | 作用域限定本 Track（§七 统一口径） |
| `git-rules.md` §分支策略 | 扩展 track/<id> 类型；集成 PR 协议新增 |
| `quality-gates.md` | 不变；每 Track 独立运行，集成后 main 再跑一次 |
| `CLAUDE.md` §必跑命令（e2e） | PLAYER/AUTH/SEARCH/VIDEO 任务的 e2e 要求在并行版质量门禁中继承 |
| `CLAUDE.md` §模型路由规则 | 不变；每条 Track 内的主循环模型独立选择 |
