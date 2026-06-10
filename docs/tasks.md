# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 NTLG-NTF-DISMISS — 通知/任务抽屉 dismiss 软移除（ADR-197 设计中）

- **所属**：通知抽屉交互增强（用户裁定 2026-06-10「两者都推」之重档；轻档 NTLG-NTF-UNREAD-FILTER ✅ 已交付）
- **建议模型**：opus（含 schema + 新端点 ADR）
- **现状**：**ADR-197 dismiss 子系统由 arch-reviewer Opus 子代理设计中**（agentId a2edc8aa4e6cfa1a9，后台运行）。需求：抽屉级软移除（单条/清空），移除 ≠ 物理删除，被移除项在消息中心仍按 TTL 常规留存；外加「只看未读」切换（轻档已做）。
- **设计难点（已传子代理）**：抽屉项多源（notifications 表行 + audit_log 派生 + task_runs/crawler_runs 派生）→ 需统一 item_key 编码 + per-user `notification_dismissals` 表 + 抽屉三处（list drawer/background-events/jobs）排除 vs 消息中心 history 模式不排除 + 派生项 dismiss 范围裁决（general/finished 可 / upcoming·active 不可）+ dismissal 记录清理（notifications FK CASCADE / 派生项 TTL）。
- **下一步**：子代理出 ADR-197 草案 → 主循环落 docs/decisions.md（+ arch-reviewer PASS）→ 拆 -A（schema+queries）/ -B（api 端点 + 三处过滤接入）/ -C（UI 抽屉移除/清空按钮）实施。
- **状态**：🔄 等待子代理设计输出（不抢跑实现——新 admin route + 跨消费方 schema 双红线，须 ADR PASS 后落地）

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
