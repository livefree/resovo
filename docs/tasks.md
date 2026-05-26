# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-25

---

## 进行中任务

（空 — 本会话已交付 CW1-A + CW1-B-ADR + CW1-B-EP + CW1-C + CW1-D 五 commit）

---

## 下次会话恢复入口

### W1 剩余候选（按建议顺序）

1. **CHG-SN-9-CW1-D** Dashboard 自动采集卡（0.2w / sonnet / autoCrawlNext 字段已就绪 / 见 task-queue.md 第 5 项）
2. **CHG-SN-9-CW1-B-EP-TEST** 单测补齐 follow-up（0.1w / sonnet / cancelTaskById 7 case + crawler.tasks route 6 case + CrawlerRunDetailView 4 case）
3. **CHG-SN-9-CW1-E-ADR** Topbar 铃铛端点 ADR 起草（0.15w / opus + arch-reviewer / 5 决策点）
4. **CHG-SN-9-CW1-E-EP** Topbar 铃铛实施（0.25w / sonnet / 依赖 -ADR PASS）

### 走读重点（@livefree dev server）

CW1-C 已落地需验收：
1. `/admin/crawler` 高级 dropdown 新增「关键词采集」菜单项（采集记录下方 / 全站全量上方 / 中性色）
2. 点击 →「关键词采集」Drawer 弹出（width 680）：keyword 输入 + 类型筛选 select + 站点多选（默认全勾 enabled）
3. 输入关键词 + 点「预览」→ 各站点扁平化表（站点 / 标题 / 年份 / 类型 / 线路数 / source 状态 Pill）
4. 站点失败 → 行渲染 `⚠ 站点失败：<msg>`；空结果 → EmptyState
5. 点「立即采集」→ toast 含 runId + deep-link「查看本次新增视频」+ Drawer close

CW1-B 历史走读项（仍待验收）：
1. `/admin/crawler` PageHeader subtitle：「X 个站点 · 实时/采集已关闭 · 下次自动: MM-DD HH:mm」chip
2. 高级 dropdown 6 项 4 字命名：定时设置 / 全站全量 / 重建索引 / 一键停采 / 关闭采集 / 采集记录
3. `/admin/crawler/runs/[id]` task 表行 [取消] 按钮（queued/running/paused 三态可点）
4. task 表表头多选 + sticky bulk action bar（已选 N 个 + 批量取消 / batch 50+ 弹 confirm）
5. **migration 073 必须先跑**：`npm run migrate`（admin_audit_log.target_kind CHECK 13→14 / 不跑则 batch_cancel audit 会 violate constraint）

---

## 本会话已完成 commit 链

- `5cae1c74` **CHG-SN-9-CW1-A** 采集页 UI 三合一 / 6 项 4 字命名 + 撤回删除入口 4 处 + PageHeader 下次自动 chip
- `943611eb` **CHG-SN-9-CW1-B-ADR** ADR-151 起草 + Opus 评审 A− CONDITIONAL → R3+Y3+G1 修订 → Accepted
- `25974688` **CHG-SN-9-CW1-B-EP** Bug-A 实施 / ADR-151 §10 全 6 步 + worker R-151-3 守卫 + migration 073
- _本卡_ **CHG-SN-9-CW1-C** 关键词采集 Drawer / api.ts +2 函数 + AdvancedMenu 菜单项 + 8 单测 全 PASS + audit-log-coverage R-MID-1 第 26 次系统化同步守卫

总计 +1278+CW1-C / 1 新 migration / 1 新 ADR / arch-reviewer Opus 1 轮评审 / D-151-1..6 全闭环（184 总）/ crawler 全栈测试稳定
