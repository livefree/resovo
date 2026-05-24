# 用户复核反馈 2026-05-23

> **trigger**：M-SN-8 主体完结声明（commit `991ab99b`）后用户实测 server-next，发现系统性"假装实现"问题
> **status**：登记中（用户持续补充 / 未启动处理）
> **owner**：@livefree（用户复核）/ @engineering（后续修复）
> **related**：本表条目与 `docs/manual/GAPS.md` 多条 ✅ 标记 + `docs/changelog.md` 多条 EP-A/EP-B ✅ 标记冲突

---

## 根因诊断（用户原话）

> 很多实现起来是需要做决策的，但开发过程都被跳过，要么没有实现，要么使用不可用的方式假装实现了。

M-SN-8 全期被标 ✅ 的项目中，至少 7-8 项在用户实测下不成立。**开发者标准**（代码 merge + 单测 PASS + grep 端点在位）与**用户标准**（功能真实可用）严重脱节。文档自报数据不能再作为完结依据。

---

## 元任务（Meta）

- [ ] **#UR-M01** 撤回 commit `991ab99b` changelog 中"M-SN-8 主体官方完结"措辞 → 起新 commit 修正为"SEQ 任务列表完结 / 用户复核未通过 / 见本文件"
- [ ] **#UR-M02** GAPS.md 对应被标 ✅ 但用户实测未通过的条目（至少 #G-shell-notifications / #G-dashboard-activities-mock / 未明示 GAP 但涉及 image-health / home / moderation 等）追加"⚠️ 用户复核 2026-05-23 未通过"标记 + 反向链接本文件 #UR-NN
- [ ] **#UR-M03** 工程流程修订：✅ 强前置加入"dev server 实测 + 用户走读 ≥ 1 次"；ADR 决策点不得简化为 noop；表格头/搜索等跨页面 UX 先做原语层一致性

---

## A · 整模块未真实实装（被标 ✅ 但用户视角不可用）

### #UR-A1 · 管理台站可编辑卡片（widgets）系统未实装

- **页面**：`/admin/dashboard`
- **现象**：设计稿（`reference.md §5.1.3`）要求拖拽 + resize + 全屏 + CardLibrary；当前只有静态浏览态
- **冲突**：`#G-dashboard-edit-mode` ⬜ 长期 backlog P3 — **优先级被严重低估**，这是设计稿核心要求，"管理台站可编辑"是其本质定义
- **跳过的决策**：是否实装编辑态 / 是否做 CardLibrary / 拖拽库选型（dnd-kit / react-grid-layout / 手写）/ 持久化（localStorage / DB）

### #UR-A2 · 内容审核台快捷键未完善

- **页面**：`/admin/moderation`
- **现象**：基础键 J/K/A/R/S 在位但仍不完善（具体缺漏待用户演示）
- **冲突**：`P-moderation §3.1` 刚翻 🟢 完整定稿（commit `991ab99b`）
- **跳过的决策**：完善程度 — 数字 1-9 批量？G/g 跳首尾？空格预览？字幕 ←/→？多键组合冲突处理？

### #UR-A3 · 内容审核：线路探测 + 播放验证未实装

- **页面**：`/admin/moderation` 右栏详情 Tab + LinesPanel
- **现象**：按钮在位但**实际探测/播放验证逻辑未真实运行**
- **冲突**：CHG-SN-8-05 ✅ "批量重测此视频线路按钮"
- **跳过的决策**：probe timeout / 并发限制 / 失败重试 / render 验证方式（headless 真跑 vs HEAD 请求 vs stub）

### #UR-A4 · 内容审核台选集不能真实切换

- **页面**：`/admin/moderation` 主预览
- **现象**：选集切换不生效
- **冲突**：P-moderation 全套手册刚翻 🟢 完整定稿
- **跳过的决策**：选集状态归属（视频元数据 / sources 集数）/ 切换 API / 与 GlobalPlayerHost 联动方式

### #UR-A5 · 图片健康页面无图片显示、不能编辑

- **页面**：`/admin/image-health`
- **现象**：页面打开后**看不到任何图片**；也**没有编辑能力**
- **冲突**：CHG-SN-8-FUP-IMAGE ✅ "完全闭合"；GAPS.md 标"4 actions + 6 endpoints grep 全在位"——**grep 通过但实际页面不可用是典型"假装实现"**
- **跳过的决策**：图片预览渲染（lazy / virtualize）/ 编辑（fallback 域切换 / 可疑标记 / 重扫触发）/ KPI 数据源真实性 / 破损样本 grid 真实生效

### #UR-A6 · 首页编辑无可用功能

- **页面**：`/admin/home`
- **现象**：**任何功能都不可用**
- **冲突**：CHG-SN-8-FUP-HOME ✅ "完全闭合"（ContentRefPicker + HomeModuleDrawer 接入）；用户问题 #10 标 ✅
- **跳过的决策**：home_modules 6 端点（ADR-104）真实可用性 / Drawer 提交真实写库 / 前台 fetch 真实生效 / brand_slug 多品牌真实路径

### #UR-A7 · 侧栏 badge 数字与页面内部数据无关联

- **页面**：admin shell 侧栏
- **现象**：数字在显示但与审核台 pending / 任务 / 通知数据不一致
- **冲突**：ADR-147 + EP-A + EP-B 全 PASS ✅；`#G-shell-notifications` ✅ "完全闭合 3/3"
- **跳过的决策**：badge 数据源口径（audit_log 子集映射？pending count？job active？）/ 实时性（60s polling 是否够）/ cache TTL

---

## B · 跨模块表格 / UX 系统偏差

### #UR-B1 · 表格头体验不一致 — 塞一堆过滤选项

- **页面**：跨多个 admin 列表页（videos / sources / users / moderation queue 等）
- **现象**：表头被塞入过滤选项；不同页面表现不一
- **冲突**：DataTable 一体化"Step 7A 完整"（CLAUDE.md §核心架构约束）
- **跳过的决策**：表头放什么（仅列名 + 排序 + 三点设置）vs 过滤放哪（独立 toolbar 区 / filter chips 区 / 列内 dropdown）

### #UR-B2 · 列名排序 + 三点设置实装未达预期

- **现象**：原本设计是点列名排序 / 旁边三点打开列设置 — 实装存在但 UX 不到位
- **冲突**：DataTable `enableHeaderMenu` sort+hide+clear filter
- **跳过的决策**：排序触发区域（整列名可点 vs 仅图标）/ 三点菜单内容 / 多列排序支持？/ 排序持久化？

### #UR-B3 · 表格搜索 IME 未处理 — 中文拼音打不完就刷新

- **现象**：搜索框 `onChange` 即触发 refetch；中文 composition 阶段就触发，拼音都打不完
- **跳过的决策**：debounce 时长（300ms / 500ms / 800ms）/ `compositionstart`/`compositionend` 暂停触发 / 是否走 Enter 提交模式

### #UR-B4 · 表格始终不支持所有列

- **现象**：列覆盖不全（设计稿要求的列未全部接入）
- **冲突**：admin-ui 20 cell 类型
- **跳过的决策**：哪些页面缺哪些列（待用户细化）/ 是真未实装还是 `hideable` 默认隐藏 / 列优先级排序

### #UR-B5 · 播放线路展开只显示 1 集

- **页面**：`/admin/sources` 或 LinesPanel 展开态
- **现象**：线路点开展开只显示 1 集，应显示全集
- **跳过的决策**：episode 数据源 / 展开 UI 选型（accordion / tabs / table）/ 集数上限处理（500+ 集如何展示）

### #UR-B6 · 采集控制时间轴设计有问题

- **页面**：`/admin/crawler` TimelineCard
- **现象**：时间轴设计存在问题（待用户细化具体不合理点）
- **冲突**：M-SN-7-REDO-01 重做 A⁻ + TimelineCard 落地
- **跳过的决策**：时间轴粒度 / 排序方向 / pause/resume 入口 / run 详情跳转方式 / 跨日聚合

---

## C · 数据真实性

### #UR-C1 · 管理台站很多不真实数据（非 RecentActivityCard）

- **页面**：`/admin/dashboard`
- **现象**：RecentActivityCard 之外的卡片仍是 mock
- **冲突**：`#G-dashboard-activities-mock` ✅ 完全闭合**仅覆盖一张卡**；其它 dashboard 卡片状态未单独评估
- **跳过的决策**：逐张核 dashboard 哪些卡片仍 mock（KPI 卡 / 任务卡 / 通知卡 / 注意力卡 / 其它）/ 真数据源是否齐备

### #UR-C2 · 各页面"操作没有实际功能"（笼统）

- **现象**：用户笼统提示 — 很多按钮/操作只是 UI，没接真实后端
- **关联**：与 #UR-A* 各模块的"假装实现"根因一致
- **细化方式**：用户后续在 D 段补充具体页面 + 具体按钮

---

## D · 待用户继续补充

> 用户已提示"还有很多问题"；本段开放，新增条目编号 `#UR-D01` / `#UR-D02` / ... 持续追加。
>
> 推荐方式（任选）：
> 1. 一次性列文字描述（粒度任意，我后续细化）
> 2. 边打开 dev server 实测边列（最准确）
> 3. 按你的浏览顺序按页面列（dashboard / moderation / videos / sources / merge / subtitles / users / settings / audit / crawler / home / image-health / submissions / staging / dev / login / system / analytics）

---

## 处理流程（提议 / 待用户授权）

1. **收集阶段**（当前）：用户持续补充 D 段，**我不动手实施**
2. **整体分类阶段**：列完后整体分类
   - 立刻可做（前端微调 / IME / debounce 等）
   - 需 ADR（dashboard widgets / 线路探测协议 / 选集状态归属等）
   - 长期 backlog（明确推迟，不再标 ✅）
3. **逐项启动**：
   - 起 CHG 卡 + 必要时起 ADR
   - 实施（前端 + 后端 + 测试）
   - **dev server 实测 + 用户走读 ≥ 1 次（✅ 的强前置）**
   - 走读通过 → 本表对应 #UR-XX 标 ✅
   - GAPS.md 同步更新（撤回错误 ✅）
4. **全闭合后**：
   - 修正 `changelog.md` 中错误措辞（起新 commit / 不 amend / 不 revert）
   - 归档本文件至 `docs/archive/audit/`
   - 起 M-SN-9 或新 milestone 容器（如有遗留长期 backlog）

---

## 处理原则（M-SN-8 教训）

- ❌ **不再以"开发者代码 merge + 单测 PASS"作为 ✅ 标准**
- ✅ **必须经过用户走读 ≥ 1 次**（M-SN-8 双轨流 §4 已写明"非工程师按手册走一遍能完成"，但实际未执行）
- ✅ **每个"决策点"必须明示选择哪个方案**，不得简化为 noop / stub / "按钮在位即可"
- ✅ **跨页面 UX（表格头 / 搜索 / 列设置 / 快捷键）先做原语层一致性，再做单模块**
- ✅ **grep 通过 ≠ 功能可用**；端点存在 ≠ 真实生效；ADR 起草 ≠ 决策已做
