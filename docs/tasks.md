# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-12

---

## 进行中任务

### CHG-SN-5-PRE-01-F · moderation 7 张占位 PNG 替换真截图（PRE-01-E-2 harness 复用）

- **建议模型**：opus（spec selector 适配 + 整页 fullPage screenshot 协议）
- **执行模型**：claude-opus-4-7
- **关联序列**：SEQ-20260506-02（M-SN-5.5 A 段第 5 件 cutover-blocker / DEBT-SN-4-07-A 关闭）
- **真源**：
  - task-queue.md line 2001（DEBT-SN-4-07-A：moderation 7 张占位 PNG 69-byte 单像素）
  - ADR-116 §2.7（PRE-01-F 前置数据协议：storageState + seed + click+waitForSelector）
- **依赖**：CHG-SN-5-PRE-01-E-1 ✅（harness 基础设施）+ CHG-SN-5-PRE-01-E-2 ✅（5 件组件 baseline 入库实例验证）

#### 问题理解
PRE-01-E-2 完成后 5 件组件 baseline 已入库 + harness 已验证可工作。PRE-01-F 是同一 harness 在 admin/moderation 真实页面跑 7 张整页截图，替换现有 `tests/visual/moderation/*.png` 7 张 69-byte 占位 PNG（DEBT-SN-4-07-A）。

#### 涉及文件
- `tests/visual/admin-moderation.visual.spec.ts`（已存在骨架，需调整 selector 适配实际 moderation page DOM）
- `tests/visual/admin-moderation.visual.spec.ts-snapshots/`（新生成 7 张 baseline PNG）
- `tests/visual/moderation/*.png`（删除 7 张 69-byte 占位）
- `tests/visual/.auth/admin.json`（user 本地生成；已 gitignored）

#### 前置准备（user 操作）
1. **生成 admin storageState**（解决 codegen 登录失败 + ASSET_PREFIX 冲突）
2. **dev DB seed**：moderation 至少有 pending / rejected / staging 各 1+ 视频
3. **spec selector 适配**：本卡 AI 任务，预先 grep moderation page DOM 调整 spec（避免 user 跑后 fix）

#### 工时估算
~0.2w（spec selector 适配 + user 跑 update-snapshots + commit 入库）

#### 子代理调用
无（spec 适配 + baseline 入库，非 ADR/契约设计）
