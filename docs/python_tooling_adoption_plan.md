# Python Tooling 渐进接入方案（CHG-93）

- **记录时间**：2026-03-20 12:48
- **状态**：已落盘，待按具体 Python 子任务逐步执行
- **目标**：在不干扰现有主流程的前提下，为后续 Python 模块引入统一且可持续的工程规范（`uv + ruff + ty`）

## 1. 现状与约束

1. 当前仓库主体是前后端 TypeScript/Node.js 工程，Python 不是现有主技术栈。
2. 规范引入方式必须是“最小侵入增量改造”，不能影响现有 `npm` 工作流。
3. 仅当新增或维护 Python 代码时，才触发本方案执行。

## 2. 适用范围

1. 新增 `scripts/*.py`、数据处理脚本、爬虫辅助脚本、Python 后台子模块。
2. 后续若拆分出独立 Python 服务，也沿用本方案并按目录局部扩展。

## 3. 执行原则

1. 不改现有业务架构，不替换现有 Node/TS 技术链。
2. 先保证需求交付，再在改动附近做规范治理。
3. 每次 Python 改动后，默认执行：
   - `uv run ruff check .`
   - `uv run ruff check . --fix`（安全场景）
   - `uv run ruff format .`
   - `uv run ty check`
4. 历史遗留问题只做“就近收敛”，不做全仓无关大扫除。

## 4. 最小接入方案（首次需要 Python 时执行）

1. 新增 `pyproject.toml`，仅包含最小配置：
   - Python 版本约束
   - `ruff` 配置（lint + format）
   - `ty` 配置（类型检查入口）
2. 若当前仅有 `requirements.txt`：
   - 保留兼容，不强制一次性迁移
   - 新增依赖优先 `uv add`/`uv add --dev`
3. 不引入功能重复工具（如与 ruff 职责重叠的格式化/lint 组合），除非后续明确评估迁移成本。

## 5. 日常命令规范

1. 依赖同步：`uv sync`
2. 新增依赖：`uv add <package>`
3. 新增开发依赖：`uv add --dev <package>`
4. 代码检查：
   - `uv run ruff check .`
   - `uv run ruff check . --fix`
   - `uv run ruff format .`
   - `uv run ty check`
5. 测试：`uv run pytest`

## 6. 提交前检查与汇报模板

每次涉及 Python 改动，提交前必须输出以下信息：

1. 做了什么
2. 改了哪些文件
3. 为什么这样改
4. 执行了哪些检查命令
5. 检查结果如何
6. 风险点 / 待确认事项

## 7. 渐进治理路线

1. Phase A：仅在新增 Python 文件的任务中落地最小工具链。
2. Phase B：将高频 Python 脚本逐步补齐类型标注与 ruff 规则。
3. Phase C：若出现独立 Python 服务，再将 `uv/ruff/ty` 提升为该服务强制门禁。

## 8. 风险与边界

1. 若执行环境缺少 `uv` 或 `ty`，先报告缺失条件并给出最小补齐方案。
2. 若检查命令受限（CI/权限/运行时依赖），需给出替代验证和未覆盖风险。
3. 本方案是“落盘基线”；不自动触发对当前 TypeScript 代码的任何技术栈迁移。
