# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

### CHG-SN-9-DT-AUTOFILTER-AMD2-EP · ADR-150 AMENDMENT 2 实施（共享层 + 4 消费方 opt-out）

- **状态**：🔄 进行中
- **创建时间**：2026-05-24
- **触发**：ADR-150 AMENDMENT 2 起草 + @livefree 仲裁 2 红线 PASS（dev warn 足够 / AMENDMENT 2 内一起实施）
- **建议模型**：opus（共享层 API 契约重构 / CLAUDE.md §模型路由 1 命中）
- **执行模型**：claude-opus-4-7（opus xhigh 续会话 / 严格遵循"主循环模型中途不可降级"）
- **子代理**：可能 spawn arch-reviewer (claude-opus-4-7) 复审实施合规
- **关联 ADR**：ADR-150 AMENDMENT 2 D-150-AMD2-1..9（详 decisions.md / commit `<ADR 落档 commit>`）
- **范围**（共享层 + 4 消费方 / 同卡 ~0.6w）：
  - **共享层改造**（4 文件）：
    - `packages/admin-ui/src/components/data-table/types.ts`：TableColumn discriminated union by kind（DataKindColumn / ActionKindColumn / MediaKindColumn / ComputedKindColumn）/ AutoFilterColumnFields 调整 default
    - `packages/admin-ui/src/components/data-table/data-table.tsx`：默认值 filterable + enableSorting / kind 筛选（矩阵 popover 跳过 non-data kind）/ filterFieldName fallback column.id / dev warn server mode + 非业务命名特征
    - `packages/admin-ui/src/components/data-table/use-filter-kind-inference.ts`：触发条件先判 `column.kind ?? 'data'` 仅 data 运行
    - `packages/admin-ui/src/components/data-table/column-matrix-menu.tsx`：filter 格行过滤 kind !== 'data' / D-150-AMD2-9 列设置 popover 范围澄清
  - **4 消费方 opt-out review**（4 文件 review）：
    - CrawlerRunsView: actions 列加 `kind: 'action'` / 验证 sub 1+EXTEND filter props 不破坏
    - AuditClient: actions 列加 `kind: 'action'` / 5 列 filter props 简化（可删冗余 filterFieldName 默认 = column.id）
    - UsersListClient: actions 列加 `kind: 'action'` / 3 列 filter props 简化
    - VideoListClient: cover 列加 `kind: 'media'` / actions 列加 `kind: 'action'` / 4 列 filter props 简化
  - **单测**：
    - admin-ui/table 21 旧单测保持（kind = 'data' 默认不破坏）
    - 新增 ~10 case：column.kind 4 值 × 矩阵 popover 显隐 / inference 触发 / filterFieldName fallback / dev warn
    - 4 消费方单测 review（typecheck PASS + 行为断言）
  - **文档同步**：
    - admin-module-template.md 2026-05-24 修订段补 AMENDMENT 2 决策树
    - ADR-150 主体 D-150-5 处 cross-reference AMENDMENT 2 D-150-AMD2-8 NEGATED
- **质量门禁**：typecheck / lint / file-size / adr-contracts / 全 unit PASS
- **e2e 黄金路径**：留 ADR-150 阶段 5 EP-4
- **不在范围**（独立后续）：
  - EP-3-D/E/F/G 其它 6 表格的迁移（按 AMENDMENT 2 新范式 / 减负 60%+）
  - reference.md §4.4 同步（与 EP-3-D 入口顺手）
- **工时估算**：~0.6w
- **完成顺序**：① ADR 起草 commit ✅ → ② 共享层 types/data-table/use-filter-kind-inference/column-matrix-menu → ③ 4 消费方 opt-out → ④ 单测 → ⑤ 4 质量门禁 → ⑥ commit → ⑦ arch-reviewer Opus 复审 → ⑧ @livefree 走读

---

## 下次会话恢复入口

**AMD2-EP 实施走读重点**：
1. `/admin/users` actions 列点 ⋯ → **无 popover**（kind='action' / `never` type 强制）
2. `/admin/videos` cover 列点 ⋯ → 无 popover（kind='media'）
3. 矩阵 popover 仅显示 data kind 列（actions/cover 不出现）
4. 消费方 column 定义减负 60%+（filter props 多数可删）
5. 4 已迁消费方零回退（CrawlerRunsView/AuditClient/UsersListClient/VideoListClient）

**通过 → EP-3-D 启动**（ImageHealthClient + MergeClient ~0.3w / 按 AMENDMENT 2 新范式 column 定义减负）

---

## 本会话已完成 commit 链

1-15. EP-3-A 全闭环 + sub B + sub C（详见 changelog）
16. `<TBD>` **AMD2-ADR** ADR-150 AMENDMENT 2 起草 + @livefree 仲裁 PASS
17. `<TBD>` **AMD2-EP** AMENDMENT 2 实施（共享层 + 4 消费方 opt-out）

总计 +4000+ lines / 80+ 新单测 / 0 回退 / ADR-150 AMENDMENT 2 范式根本反转 / 全质量门禁全过。
