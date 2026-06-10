# P-sources · 播放线路

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / 2026-05-21）
> owner: @engineering
> scope: 播放线路管理页面使用说明 — 线路健康监控、别名管理、失效处理
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/sources` |
| 设计稿引用 | reference.md §5.4 + §6.2 |
| 主任务卡 | CHG-SN-5-11（视图基座 + ADR-117）+ -11-PATCH（清债 6 项）+ CHG-SN-8-FUP-SOURCES-DEAD-BTN（死按钮 Modal 修复）+ CHG-SN-8-MANUAL-BATCH-3（手册定稿） |
| 涉及端点 | `GET /admin/source-line-aliases` / `PATCH .../:siteKey/:sourceName` / `GET /admin/sources` 视频分组 / 行级 `reprobe` / `delete` 等（ADR-117 5 端点）|
| 适用角色 | editor + admin |
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-3）|

---

## 1. 这个页面是做什么的

后台所有视频播放线路的集中查询、健康监控、批量处理工作台。按视频分组展开线路矩阵；全局别名表管理「线路代号」（让运营按业务名称引用线路而非 source_name 原始字符串）。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 播放线路 · Actions: 「一键替换最相似 URL」(GAPS)+ 批量验证│
├──────────────────────────────────────────────────────────────────┤
│ KPI 4 列：总播放源 / 有效 / 失效 / 孤岛（ADR-117 §7 "孤岛"统一）│
├──────────────────────────────────────────────────────────────────┤
│ Segment Tab：按视频分组（matrix）/ 全局别名表（aliases）         │
├─ matrix Tab ──────────────────────────────────────────────────┤
│ Filter bar：搜索视频名/URL/site_key + 站点 chip + 健康 chip      │
│ DataTable（视频分组、行可展开）：                                  │
│  _select / video / lines / sources / probe / render / updated /  │
│  actions                                                          │
│ 行展开内容：线路矩阵（行=线路 / 列=集 / 颜色=双信号）+ 3 xs btn   │
├─ aliases Tab ─────────────────────────────────────────────────┤
│ SourceLineAliasPanel：每行 sourceSiteKey + sourceName + display  │
│  name input + onSave 调 upsertLineAlias                          │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 「一键替换最相似 URL」按钮（CHG-SN-8-FUP-SOURCES-DEAD-BTN 部分修复）

- **位置**：PageHeader 右上 primary 按钮
- **当前状态**：⚠️ **算法未实装**（M-SN-N follow-up 起 ADR）；按钮点击会弹出 Modal 解释功能筹备 + 替代路径
- **预期行为（设计稿原意）**：扫描全部失效线路 → 在同一视频内寻找与失效 URL 最相似的活跃 URL → 自动替换 + audit
- **替代路径**：
  1. 「按视频分组」segment 选某视频 → 展开行 → 「线路矩阵」逐条线路操作（重测 / 替换 / 删除）
  2. 失效线路批量删除：行级「全失效」筛选 + 批量动作
- **如需求该算法批量替换**：登记 follow-up CHG-SN-8-FUP-SOURCES-REPLACE-ADR

### 3.2 线路别名 displayName

- 在「全局别名表」segment 编辑：`(source_site_key, source_name)` → `displayName`（运营可识别中文代号，如「线路 A · 1080P」）
- 编辑后矩阵自动消费：SourceMatrixRow 行展示 `displayName ?? sourceName` fallback
- 设计意图：让运营按代号引用线路，不用记住 source_name 原始 ID

### 3.3 看视频分组矩阵（matrix Tab）

- **触发**：行尾 chevron 展开 → 显示 `100px repeat(8,1fr) 80px` grid
- **颜色编码**（双信号 DualSignal）：
  - 24h ok 绿（含 ✓）→ 探测 + 播放均成功
  - warn 黄（含 !）→ 部分集失效
  - danger 红（含 ✕）→ 探测失败 / 播放失败
- **行级 3 xs btn**：复制线路 / 重验全部 / **删除全失效（danger）**

### 3.4 行级单线路操作

| 操作 | 调用 |
|---|---|
| 重测（reprobe）| `POST /admin/sources/:siteKey/:sourceName/reprobe`（实证可用）|
| 测试（testRoute）| `POST /admin/sources/:siteKey/:sourceName/test` |
| 删除（删除全失效线路）| `DELETE /admin/sources/:siteKey/:sourceName` |

### 3.5 批量验证（PageHeader 按钮）

- **行为**：对当前 filter 内所有线路触发 reprobe
- **耗时**：worker 后台异步；进度查 P-crawler timeline

## 4. 进阶操作

### 4.1 删除全失效线路（danger）

- **影响**：该视频该线路所有集都标软删除；前台播放器不再显示该线路
- **回滚**：unmerge 类操作 / 重新采集（worker 重抓）

### 4.2 KPI「孤岛」语义（ADR-117 §7）

- "孤岛源" = 用户报告失效但 worker 探测仍 ok 的源（探测 / 用户感知背离）
- 处理：人工 spot-check + 决策保留或删除

## 5. 字段含义（reference §6.2）

| 列 | 含义 |
|---|---|
| video | chevron + thumb-sm + tbl-title + meta(type · year · 集数) |
| lines | 线路数（strong）|
| sources | 集×源（strong）|
| probe | 全部可达 / 部分 / 全失效 pill |
| render | 可播 / 部分 / 不可播 / 未测 pill |
| updated | 最后探测时间 muted |
| actions | refresh / zap / more 3 xs btn |

## 6. 状态颜色

| pill | 含义 |
|---|---|
| 绿（ok）| 全部可达 / 可播 |
| 黄（warn）| 部分失效 |
| 红（danger）| 全失效 / 不可播 |
| 灰（muted）| 未测 |
| accent（cyan/violet）| 双信号 probe(cyan) / render(violet) 分色（reference §3.1）|

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 一键替换 URL 按钮无效 | 算法未实装 | 见 #G-sources-replace-similar follow-up |
| 别名编辑后未更新展示 | 矩阵 cache 未刷新 | 强制 refresh / 等下次进入 |
| 行展开慢 | 大型视频集数多 | 等待；后续可加分集懒加载 |
| 「孤岛」KPI 数字异常高 | 探测算法过于宽松 | 联系 admin 查 worker 日志 |
| 删除全失效线路误删 | 双信号判断错误 | unmerge 不可逆；建议 spot-check 后再批量 |

## 8. 与其他页面的关系

- → 跳出到 [P-videos](./P-videos.md)：视频名点击进编辑
- → 跳出到 [P-crawler](./P-crawler.md)：批量验证进度查 timeline
- → 跳出到 [P-audit](./P-audit.md)：所有写动作（reprobe / delete / alias upsert）写 audit log（ADR-117）
- ← 跳入自 [P-user-submissions](./P-user-submissions.md)：失效源举报处理
- ↔ 相关工作流：[W2 补源](../10-workflows/W2-source-repair.md)
