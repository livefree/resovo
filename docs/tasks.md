# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

### 🔄 CHG-SN-9-CW1-CW2-REDESIGN-A-EP-3b-1 — D-155-3 前端 now-line + range 4→7 + pending 虚线

- **SEQ**：SEQ-20260526-CRAWLER-W3-FIX
- **状态**：🔄 进行中
- **创建时间**：2026-05-26 06:55
- **实际开始**：2026-05-26 06:55
- **建议模型**：sonnet
- **执行模型**：claude-opus-4-7（本会话延续）
- **关联 ADR**：ADR-155 D-155-3（🟢 Accepted）
- **拆分理由**：原 EP-3b 含拖拽 pan + viewport buffer + 30d 封顶（ADR-155 §3 D-155-3 + R-155-5 完整设计 / 工程量 0.3-0.4w）；本卡仅做轻量 UI 元素（now-line / range 扩展 / pending 虚线），拖拽 pan **推迟到 N1-EP3b-2**（@livefree 实测三段窗后视情况评估是否真需要拖拽）。

### 问题理解

EP-3a 后端已落地三段窗 [NOW-0.7×range, NOW+0.3×range]，前端 CrawlerTimelineCard 需要：
1. **now-line 垂直指示线**（让用户看到 NOW 在窗口 70% 位置）
2. **range select 扩展**（4 → 7 选项 / 加 12h/24h/7d 长历史回看）
3. **pending bar 虚线样式**（虚线 + 半透明 / 区分 "已发生" vs "计划中"）

### 根因判断

EP-3a 三段窗后 future buffer 30% 显示 pending bar 真位（不再 clamp 到 NOW），但前端没有视觉区分 "已发生 done/running" 与 "未来 pending"；range select 仍是旧 4 选项。

### 方案

**Step 1**（`apps/server-next/src/lib/crawler/api.ts`）：
- `CrawlerTimelineRange` 类型扩 7 选项 与后端 EP-3a 对齐：`'30m' | '1h' | '2h' | '6h' | '12h' | '24h' | '7d'`

**Step 2**（`apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`）：
- **RANGE_OPTIONS** 扩 7 entry：`12 小时 / 24 小时 / 7 天`
- **now-line 渲染**：在 TRACK_STYLE 容器内绝对定位垂直线 `left: 70%`（对应 HISTORY_RATIO=0.7）+ `width: 1px` + `background: var(--accent-default)` + `pointer-events: none` 不阻塞 hover
- **pending 虚线样式**：`status='warn'` 的 bar（pending raw status 映射）用 `border: 1px dashed` + `opacity: 0.5` + 透明背景 + accent border color（区分已发生）
- tick 标尺行也加 now-line 标识（"现在"字样在 70% 位置）

**Step 3**（`tests/unit/components/server-next/admin/crawler/CrawlerTimelineCard.test.tsx`）：
- 扩 3 case：
  - now-line 渲染（`data-now-line` 存在 + left ≈ 70%）
  - range select 含 7 选项（12h/24h/7d 文本）
  - pending bar 虚线样式（dashed border + opacity）

### 涉及文件

- `apps/server-next/src/lib/crawler/api.ts`（Step 1 类型扩展）
- `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（Step 2 now-line + range + pending）
- `tests/unit/components/server-next/admin/crawler/CrawlerTimelineCard.test.tsx`（Step 3 扩 3 case）

PATCH 文件数：2 源 + 1 测试 = 3 项（≤ 5 硬约束 ✅）

### 验收要点

- **dev server 实测**（@livefree / ADR-155 §8 验收第 4 条）：
  1. `/admin/crawler` 时间轴可见垂直 now-line 在容器 70% 位置（accent color）
  2. range select 含 7 选项；切到 7d 可见 7 天历史 task
  3. pending task bar 显示为虚线 + 半透明（区分实线 done/running bar）
  4. now-line 位置随 range 切换保持 70%（不抖动）
- typecheck / lint / test / verify:adr-contracts 全过
- 现有 11 case 不破坏

### 不在范围（→ N1-EP3b-2 / 推迟）

- 拖拽 pan + viewport buffer + 30d 封顶 → N1-EP3b-2（@livefree 实测三段窗 + now-line 后评估是否需要）
- ADR-155 §3 D-155-3 完整 R-155-5（throttle 16ms / 防抖 300ms / ±0.5×range buffer / 30d cap）→ 推迟到 N1-EP3b-2

---

## 下次会话恢复入口

EP-3b-1 完成后 W3-FIX SEQ 核心闭环；剩 N1-EP3b-2（拖拽 pan / 可选扩展）+ EP-1C-CLEANUP（dailyTimes required）。
