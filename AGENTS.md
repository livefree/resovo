# Resovo（流光） — Codex 工作总纲

Resovo 是国际化视频资源聚合索引平台，本身不托管视频，只提供链接索引服务。

**工作模式：全自动推进。** 除非触发暂停条件，否则完成一个任务后立即开始下一个。

---

## 价值排序（所有决策的根本依据）

1. **正确性与稳定性** — 不引入回归、不破坏关键路径、不绕过测试。
2. **边界与复用** — 模块边界清晰，职责单一，优先复用已有共享组件，不重复实现同功能逻辑。
3. **可扩展性** — 类型、路由、配置、筛选条件可增量扩展，不得写死值。
4. **一致性** — 交互、样式、组件使用与现有实现保持统一。
5. **改动收敛（最后约束）** — 满足 1–4 后，控制改动范围。"最小改动"不是首要目标。

**实现前**：确认输入输出契约、状态归属、依赖方向、与现有模块的关系。新建共享组件前先定义 Props 类型。

**实现后**：回答「此次逻辑是否应沉淀到共享层？」是 → 当前任务内完成沉淀；否 → 完成备注中说明理由。

---

## 任务入口规则

**`docs/tasks.md` 是执行任务的唯一入口**，完整流程见 `docs/rules/workflow-rules.md`。

简述：
1. 先检查 task-queue.md 是否有 `🚨 BLOCKER`，有则停止
2. 读 tasks.md，有进行中任务则继续；为空则从 task-queue.md 按优先级取下一个
3. 写入任务卡片到 tasks.md + 更新 task-queue.md 状态，再开始执行

完成后顺序：填写备注 → 更新 task-queue → 删除 tasks.md 卡片 → 追加 changelog → git commit。

---

## 必跑命令

```bash
npm run typecheck        # 必须通过，有报错不得继续
npm run lint             # 必须通过
npm run test -- --run    # 单元测试，必须全部通过
npm run test:e2e         # PLAYER / AUTH / SEARCH / VIDEO 任务完成后运行
```

测试未通过，不得执行 git commit。

---

## 核心架构约束

**后端分层**：Route → Service → DB queries，不得跨层调用。Route 层不含业务逻辑，UI 层不直接调用 DB queries。

**播放器模块**：core 层不写业务逻辑；shell 层负责编排（字幕/线路/影院模式）。不得硬编码颜色，必须使用 CSS 变量。关键路径（断点续播、线路切换、影院模式、字幕开关）每次涉及必须回归。

**共享组件**：同一 UI 模式 3 处以上必须提取。新建前先确认 `src/components/shared/` 和 `src/components/admin/shared/` 无等价实现。接口设计先于实现。

**后台表格**：必须使用 `ModernDataTable` + `ColumnSettingsPanel` + `AdminDropdown` + `SelectionActionBar` + `PaginationV2` + 服务端排序，详见 `docs/rules/admin-module-template.md`。

---

## 质量门禁

每个任务完成前必须通过质量门禁，完整规则见 `docs/rules/quality-gates.md`：
- 开发前输出：问题理解 / 根因判断 / 方案 / 涉及文件
- 开发后输出：六问自检 + 偏离检测 + [AI-CHECK] 结论块
- 同一模块连续 3 次污染 streak → 强制重构评估

---

## 绝对禁止

- ❌ schema 变更不同步 `docs/architecture.md`
- ❌ 引入技术栈以外的新依赖（触发 BLOCKER）
- ❌ 越层调用（Route 含业务逻辑 / UI 直接调 DB）
- ❌ 使用 `any` 类型
- ❌ 空的 catch 块 `catch (e) {}`
- ❌ 硬编码颜色值（必须用 CSS 变量）
- ❌ 测试未通过执行 git commit
- ❌ 跳过 tasks.md 直接修改 task-queue.md 状态
- ❌ 未写任务卡片就开始执行代码
- ❌ 修改任务「文件范围」以外的文件（哪怕顺手优化）
- ❌ 修改 `docs/` 规范文件（除非任务明确标注"更新文档"）
- ❌ 删除或重命名现有 API 路径
- ❌ 在未登录请求路径中访问 `users` 表
- ❌ docs/ 下新文档不执行 `git add`（审计类文档必须纳入版本控制）
- ❌ "最小改动"作为首要依据——未满足价值排序 1–4 时不得以改动范围小绕过架构约束
- ❌ 函数超 80 行非声明性 / 嵌套 3 层 / 多独立逻辑阶段，不先拆分就继续写
- ❌ 文件超 500 行非声明性 / 导出 2+ 主要概念，不先拆分就继续写

---

## 规范文件索引

开始编写代码前，根据任务类型读取对应规范：

| 任务类型 | 规范文件 |
|---------|---------|
| 所有代码任务 | `docs/rules/code-style.md` |
| 前端组件任务 | `docs/rules/ui-rules.md` |
| API 接口任务 | `docs/rules/api-rules.md` |
| 数据库任务 | `docs/rules/db-rules.md` |
| 测试编写 | `docs/rules/test-rules.md` |
| 后台模块 | `docs/rules/admin-module-template.md` |
| 任务工作流 | `docs/rules/workflow-rules.md` |
| Git 提交 | `docs/rules/git-rules.md` |
| 质量门禁 | `docs/rules/quality-gates.md` |

**架构决策**：以下情形必须先查阅 `docs/decisions.md`：播放器架构、视频源处理、搜索方案、认证机制、DB schema 变更、URL 结构设计。

**统一类型入口**：`import type { Video, User, SearchParams, ApiResponse } from '@/types'`

**统一 API 客户端**：`import { apiClient } from '@/lib/api-client'`（前端不得直接使用 fetch）

**文件模板**：新建文件优先使用 `src/components/templates/` 和 `src/api/templates/` 下的模板，详见 `TEMPLATES.md`。
