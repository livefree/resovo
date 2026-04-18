# Resovo（流光） — Git 规范

> status: active
> owner: @engineering
> scope: branch strategy, commit format, commit gates, forbidden git operations
> source_of_truth: yes
> supersedes: CLAUDE.md §"Git 规范" + §"Git 提交与变更管理规则"（2026-04-12 拆出）
> last_reviewed: 2026-04-12

---

## 分支策略

```
main  ← 每个 Phase 完成后合并，稳定版本
dev   ← 日常开发，所有任务在此分支工作
```

所有工作在 `dev` 分支进行，不创建 feature 分支。

Phase 完成时合并：
```bash
git checkout main
git merge dev --no-ff -m "feat: complete Phase N MVP"
git checkout dev
```
合并后写入 PHASE COMPLETE 通知（格式见 workflow-rules.md）。

---

## Commit 规范

**一个原子任务对应一个 commit。** 一个 commit 只能包含单一目的改动，不得混入无关修复、顺手重构、格式化噪音或额外功能。

### Commit message 格式

```
<type>(<TASK-ID>): <简短描述>
```

type 枚举：

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `chg` | 设计变更任务（CHG-xx） |
| `test` | 补充测试（不含功能变更） |
| `refactor` | 重构 |
| `docs` | 文档更新 |
| `chore` | 构建 / 配置 |

示例：
```
feat(INFRA-01): initialize Next.js + Fastify monorepo with TypeScript
feat(AUTH-02): add register/login/refresh/logout endpoints
fix(VIDEO-01): correct short_id lookup in video detail query
chg(CHG-01): update player sources to direct link per ADR-001
```

**无 TASK-ID 的例外情况**（满足 MAINT 条件时允许省略括号部分）：
```
chore: 根目录旧配置文件清理
docs: 更新 rules/ 路径引用至 monorepo 结构
```

不得使用模糊描述（`update`、`fix stuff`、`misc changes`）。提交信息应与任务记录、changelog 保持一致。

---

## 提交时机

commit 在"任务完成后：必做事项"第 6 步执行，即所有文档更新（task-queue / changelog / tasks.md 清空）完成后。测试通过不等于立即 commit，**文档收口是 commit 的前置条件**。

---

## 提交前门禁（条件须全部满足）

1. 当前原子任务已完成
2. typecheck 通过（`npm run typecheck`）
3. lint 通过（`npm run lint`）
4. 改动相关测试通过（`npm run test -- --run`）
5. 已完成质量门禁输出（详见 quality-gates.md）
6. task-queue.md 对应条目已更新为 `✅`，changelog.md 已追加，tasks.md 已清空（无进行中卡片）

---

## 禁止行为

- 提交无关文件改动
- 提交调试代码、临时日志、临时注释代码
- 提交失败状态（编译失败 / lint 失败 / 测试失败）
- 为通过检查而临时绕过测试、类型或 lint 规则（`--no-verify` 等）
- 未经明确要求执行 rebase、squash、reset、force push 或改写历史
- 未经明确要求擅自创建、切换或整理分支
- 连续执行任务时，前一任务未完成并提交，进入下一任务
