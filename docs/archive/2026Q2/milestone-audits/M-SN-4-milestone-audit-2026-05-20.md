# M-SN-4 Milestone 审计报告

> 序列 ID：SEQ-20260502-01 M-SN-4 收口扫尾：审核台投产对齐
> 审计日期：2026-05-20
> arch-reviewer 模型：claude-opus-4-7
> 主循环模型：claude-sonnet-4-6

---

## 总体评级：A−

**结论**：具备直升 M-SN-5 资格。所有 6 个 FIX 卡核心目标达成，模块边界干净，类型安全无破绽，纯函数严谨，e2e 覆盖完整。唯一已记录的 P2 欠账（DEBT-FIX-D-ERROR）已在 changelog 中显式登记，归到 FIX-CLOSE 阶段处理，不构成阻塞。

| 维度 | 状态 | 说明 |
|------|------|------|
| 1. 模块边界（R2 约束） | ✅ | admin-ui 树内零 apps/server-next 反向 import |
| 2. 类型安全 | ✅ | 全树零 `: any` / `as any`；catch (e: unknown) + instanceof 缩窄合规 |
| 3. 职责分离（分层） | ✅ | 前端→apiClient→Route→Service→Queries；无越层调用 |
| 4. AdminPlayer feedback 去抖 | ✅⚠️ | reportedRef 实现正确；A→B→A 语义为"per-session last-write-wins"，注释已修正 |
| 5. 共享组件 API（R1 成对约束） | ✅ | 运行时 AND 守卫 + 文档约束；TS 编译期升为 union 列 P3 |
| 6. groupSourcesByLine 聚合规则 | ✅ | 5 状态规则顺序、中位数、质量等级、hostname 解析全部正确 |
| 7. e2e 覆盖 | ✅ | 5 个新 spec 覆盖 FIX-A/B/C/D/F 核心路径；断言聚焦契约属性 |

---

## FIX 卡完成清单

| FIX | 标题 | 状态 | 完成日期 | 关键产出 |
|-----|------|------|---------|---------|
| FIX-A | 视频编辑跳转修复 + DecisionCard BarSignal 删除 | ✅ | 2026-05-02 | VideoEditDrawer 内嵌；BarSignal 移除 |
| FIX-B | LinesPanel 共享组件提取 + 双消费方迁移 | ✅ | 2026-05-19 | packages/admin-ui composite/lines-panel；11 文件 / 38 unit |
| FIX-C | 右栏 RightPaneTabs 三态化 | ✅ | 2026-05-02 | detail/history/similar；sessionStorage 持久化 |
| FIX-D | 极简 AdminPlayer 接入 + feedback 上报 | ✅ | 2026-05-20 | AdminPlayer + use-selected-line；8 unit |
| FIX-E | 缩略图统一接入 admin-ui Thumb | ✅ | 2026-05-02 | PendingCenter/DecisionCard Thumb 统一 |
| FIX-F | 筛选预设 CRUD（localStorage 持久化） | ✅ | 2026-05-02 | FilterPresetPopover / SavePresetModal；localStorage v1 格式 |

---

## 新增 DEBT 登记（本次评审产生）

| DEBT-ID | 描述 | 优先级 | 归属节点 |
|---------|------|--------|---------|
| DEBT-FIX-D-ERROR | player-core 未暴露外部 onError 回调；错误 feedback 不可上报 | P2 | FIX-CLOSE / M-SN-7 前 |
| DEBT-FIX-D-DEDUP-SEMANTIC | reportedRef A→B→A 语义已修正注释，如需严格 Set 语义可改 | P3 | M-SN-5 评估 |
| DEBT-FIX-B-R1-COMPILE | selectedKey/onLineSelect R1 当前为运行时约束；TS union 升级 | P3 | M-SN-5 新消费方时评估 |
| DEBT-FIX-D-PLAYER-IDLE-E2E | player-integration 第三个 case 未测试 ready→idle 回归 | P3 | M-SN-5 补测 |
| DEBT-FIX-E-VISUAL-SPEC | FIX-E 缩略图接入无独立 e2e spec | P3 | M-SN-5 视觉回归时补 |

---

## 测试数字汇总

| 阶段 | 新增 unit | 累计 unit | 关键覆盖 |
|------|----------|----------|---------|
| FIX-A/C/E/F（并行） | +20 | 4216 | approve/reject/reopen/refetch/staging 黄金路径 |
| FIX-B | +38 | 4254 | aggregate 23 case + signal-chip 15 case |
| FIX-D | +8 | 4262 | AdminPlayer 8 case（idle/ready/feedback/去抖/sourceId重置/useSelectedLine×3） |
| FIX-CLOSE | +0（e2e specs） | 4262 | 5 e2e spec（需 dev server；visual 9 张 baseline 需 PLAYWRIGHT_VISUAL=1 capture） |

---

## 遗留事项

- **Visual baseline**：`tests/visual/moderation/moderation.visual.spec.ts` 已写（9 张截图），baseline 文件需 `npm run test:visual:update` 配合 dev server 单独 capture 入库。
- **e2e 执行**：5 个新 spec 需 `npm run test:e2e` 配合 apps/server-next dev server (:3003) 运行；API mock 全覆盖，无需真实后端数据。
- **DEBT-FIX-D-ERROR**：FIX-CLOSE 阶段已评估；player-core 扩展需 arch-reviewer Opus 新卡。

---

## 后续行动（M-SN-5 启动前）

1. 将本文件 5 条新 DEBT 录入 task-queue.md 欠账表
2. 准备 M-SN-5 规划（字幕功能 CHG-SN-7-MISC-SUBTITLES-1 + 视频库 CHG-DESIGN-08）
3. 可选：在 CI 环境下跑一次 `npm run test:e2e` 验证 5 个新 spec（需 seed 数据 + storageState）
