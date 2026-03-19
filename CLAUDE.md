# Resovo（流光） — Claude Code 工作总纲

你是 Resovo（流光） 项目的首席工程师。Resovo（流光） 是一个国际化视频资源聚合索引平台，本身不托管视频，只提供链接索引服务。

**工作模式：全自动推进。** 除非触发暂停条件，否则完成一个任务后立即开始下一个，无需等待确认。

---

## 完整任务闭环（每个任务必须走完全部步骤）

```
1. 读取任务  →  2. 读取规范  →  3. 实现代码  →  4. 写测试
                                                      ↓
                              7. 开始下一任务  ←  6. git commit  ←  5. 跑测试（全通过）
                                                                           ↓ 失败
                                                               修复 → 重跑（最多 2 次）
                                                                           ↓ 仍失败
                                                                      写入 BLOCKER，暂停
```

---

## 每次开始工作前：任务读取顺序

1. 检查 `docs/tasks.md` 是否有 `🚨 BLOCKER` — 有则优先处理（见暂停条件章节）
2. 找状态为 `❌ 有问题` 的任务（git review 返工）
3. 找 `CHG-xx` 变更任务（状态为 `⬜ 待开始`）
4. 找普通功能任务（状态为 `⬜ 待开始`，按顺序取第一个）
5. 确认该任务的所有依赖均为 `✅ 已完成`，否则跳到下一个可开始的任务

找到任务后：**直接开始，不需要报告计划等待确认**（除非任务描述中标注了 `⚠️ 开始前需确认`）。

---

## 技术栈速览

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js App Router | 15 |
| 前端语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 3.x |
| 国际化 | next-intl | 3.x |
| 状态管理 | Zustand | 4.x |
| 播放器 | Video.js + HLS.js | 8.x / 1.x |
| 弹幕 | CommentCoreLibrary | 0.11.x |
| 后端框架 | Fastify | 4.x |
| 后端语言 | TypeScript (Node.js 22) | — |
| 主数据库 | PostgreSQL | 16 |
| 搜索引擎 | Elasticsearch | 8.x |
| 缓存/队列 | Redis + Bull | 7.x |
| 对象存储 | Cloudflare R2 | — |
| 单元测试 | Vitest | latest |
| E2E 测试 | Playwright | latest |

---

## 规范文件索引

开始编写代码前，根据任务类型读取对应规范：

- **所有代码任务** → `docs/rules/code-style.md`
- **前端组件任务** → `docs/rules/ui-rules.md`
- **API 接口任务** → `docs/rules/api-rules.md`
- **数据库任务** → `docs/rules/db-rules.md`
- **所有需要测试的任务** → `docs/rules/test-rules.md`

---

## 类型与 API 客户端（必读）

**所有类型从统一入口导入，不得自行定义已有类型：**
```typescript
import type { Video, User, SearchParams, ApiResponse } from '@/types'
```

**前端所有 API 请求通过统一客户端，不得直接使用 fetch：**
```typescript
import { apiClient } from '@/lib/api-client'
```

---

## 创建新文件时：优先使用模板

| 文件类型 | 模板路径 |
|---------|---------|
| React 组件 | `src/components/templates/Component.template.tsx` |
| Next.js 页面 | `src/components/templates/Page.template.tsx` |
| Zustand Store | `src/components/templates/Store.template.ts` |
| Fastify 路由 | `src/api/templates/route.template.ts` |
| Service 层 | `src/api/templates/service.template.ts` |
| 数据库查询 | `src/api/templates/queries.template.ts` |

详细说明见 `TEMPLATES.md`。

---

## 架构决策参考

遇到以下情形时，**必须先查阅 `docs/decisions.md`**，不得自行决策：

- 播放器架构、视频源处理方式
- 搜索实现方案选择
- 用户认证机制
- 数据库 schema 变更
- URL 结构设计

---

## 绝对禁止清单

- ❌ 修改 `docs/` 目录内规范文件，除非任务明确标注"更新文档"
- ❌ 修改任务「文件范围」以外的文件，哪怕"顺手优化"
- ❌ 更改数据库 schema 而不同步更新 `docs/architecture.md`
- ❌ 引入技术栈以外的新依赖（触发 BLOCKER，等待确认）
- ❌ 删除或重命名现有 API 路径（向后兼容原则）
- ❌ 在未登录用户的请求路径中访问 `users` 表
- ❌ 硬编码颜色值，必须使用 CSS 变量
- ❌ 使用 `any` 类型
- ❌ 留下空的 catch 块：`catch (e) {}`
- ❌ 测试未通过时执行 git commit

---

## 测试流程（每个任务必须执行）

### 第一步：实现代码
按任务描述和规范文件完成功能代码。

### 第二步：编写测试
根据 `docs/rules/test-rules.md` 中对应任务类型的要求编写测试。
- 测试文件放 `tests/unit/` 或 `tests/e2e/`
- 使用 `tests/helpers/factories.ts` 生成测试数据
- INFRA 任务跳过此步，直接运行 `bash scripts/verify-env.sh`

### 第三步：运行测试
```bash
# 类型检查（必须通过，有报错不得继续）
npm run typecheck

# Lint（必须通过）
npm run lint

# 单元测试（必须全部通过）
npm run test -- --run

# E2E 测试（PLAYER、AUTH、SEARCH、VIDEO 任务完成后运行）
npm run test:e2e
```

### 第四步：测试失败时的处理
1. 分析错误信息，修复代码
2. 重新运行测试
3. 如果连续 2 次修复后仍然失败 → **写入 BLOCKER，停止工作**

### 第五步：全部通过后执行 commit
```bash
git add .
git commit -m "<type>(<TASK-ID>): <描述>"
```

---

## Git 规范

### 分支策略
```
main  ← 每个 Phase 完成后合并，稳定版本
dev   ← 日常开发，所有任务在此分支工作
```

**所有工作在 `dev` 分支进行。** 不创建 feature 分支。

### Commit 规范（每个任务一个 commit）
```
<type>(<TASK-ID>): <简短描述>

type:
  feat     新功能
  fix      Bug 修复
  chg      设计变更任务（CHG-xx）
  test     补充测试（不含功能变更）
  refactor 重构
  docs     文档更新
  chore    构建/配置
```

**示例：**
```
feat(INFRA-01): initialize Next.js + Fastify monorepo with TypeScript
feat(AUTH-02): add register/login/refresh/logout endpoints
feat(PLAYER-04): implement control bar with CC panel and speed panel
fix(VIDEO-01): correct short_id lookup in video detail query
chg(CHG-01): update player sources to direct link per ADR-001
```

### Commit 执行时机
测试全部通过后立即执行，不等待人工确认。

### Phase 完成时合并到 main
当 Phase 1 所有任务标记 `✅ 已完成` 后：
```bash
git checkout main
git merge dev --no-ff -m "feat: complete Phase 1 MVP"
git checkout dev
```
合并后写入 PHASE COMPLETE 通知（见下方暂停条件）。

---

## 暂停条件与通知格式

以下情况必须立即停止工作，在 `docs/tasks.md` 统一通知区写入通知（文件尾部追加），等待人工处理。

### BLOCKER（立即暂停，不执行 commit）

触发条件：
- 测试连续 2 次修复后仍然失败，且 AI 无法判断根本原因
- 需要引入技术栈之外的新依赖才能完成任务
- 发现已有数据库 schema 与 `docs/architecture.md` 存在冲突
- 任务描述不清晰或存在歧义，无法确定正确实现方向

**BLOCKER 写入位置：`docs/tasks.md` 文件尾部统一通知区（仅追加，不头插）**

```markdown
---
🚨 BLOCKER — 需要人工处理后才能继续
- **任务**：TASK-ID 任务标题
- **时间**：YYYY-MM-DD HH:MM
- **问题描述**：[具体是什么问题，AI 已尝试了什么]
- **已尝试**：
  1. [第一次尝试的思路和结果]
  2. [第二次尝试的思路和结果]
- **需要决策**：[需要你做什么决定或提供什么信息]
---
```

**处理方式：** 你解决问题后，删除此 BLOCKER 块，AI 重新启动后会继续工作。

---

### PHASE COMPLETE（阶段性暂停，等待确认后继续下一 Phase）

触发条件：某个 Phase 的所有任务全部标记 `✅ 已完成`，且已合并到 main。

**写入位置：`docs/tasks.md` 文件尾部统一通知区（仅追加，不头插）**

```markdown
---
✅ PHASE COMPLETE — Phase N 已完成，等待确认开始 Phase N+1
- **完成时间**：YYYY-MM-DD HH:MM
- **本 Phase 完成任务数**：N 个
- **已合并到 main**：是
- **建议下一步**：[Phase N+1 的第一个可开始任务]
- **需要你做的事**：
  - [ ] 验收测试（运行 `npm run test` 和 `npm run test:e2e`）
  - [ ] 部署到测试环境（如有）
  - [ ] 确认开始 Phase N+1（删除此块即可）
---
```

---

## 任务完成后：必做事项

1. `docs/tasks.md` 任务状态改为 `✅ 已完成`
2. "完成备注"填写：
   - 修改的文件列表
   - 测试覆盖情况（跑了哪些测试，结果如何）
   - commit hash（`git rev-parse --short HEAD`）
3. `docs/changelog.md` 末尾追加一条记录
4. 如有新架构决策，在 `docs/decisions.md` 追加 ADR

---

## 任务与记录一致性补充（2026-03-19）

1. 多任务规划统一写入 `docs/task-queue.md`，不得临时“走一步看一步”。
2. `docs/tasks.md` 可保留全量任务，但同一时刻最多 1 个任务为 `🔄 进行中`。
3. 新任务编号必须遵循现有前缀格式：`<PREFIX>-NN`，同前缀按最大编号递增（如 `CHG-39`）。
4. 新任务必须带时间戳字段：`创建时间`、`计划开始时间`、`实际开始时间`、`完成时间`（按状态填写）。
5. 记录写入统一规则：`tasks.md` / `changelog.md` / `task-queue.md` 新记录一律尾部追加，禁止头部插入。

---

## 设计变更处理规则

### 情况 A：只影响还未开始的任务
在对应任务卡片追加变更说明，无需其他操作。

### 情况 B：影响已完成的任务
由人工在 `docs/tasks.md` 变更任务区新增 `CHG-xx` 任务，AI 按优先级顺序执行。

### 变更任务格式
```markdown
#### CHG-01 [变更标题]
- **状态**：⬜ 待开始
- **变更原因**：[为什么要改]
- **影响的已完成任务**：[如 VIDEO-01]
- **文件范围**：[受影响文件]
- **变更内容**：[具体改什么]
- **完成备注**：_（AI 填写）_
- **问题说明**：_（若有问题）_
```

---

## 遇到不确定情况时

如果情况既不是 BLOCKER 也不是普通任务，但 AI 有疑问：
在 changelog.md 末尾写一条 `❓ QUESTION:` 记录，然后继续推进——除非是 BLOCKER 级别的歧义，否则不暂停。
