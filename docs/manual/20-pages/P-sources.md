# P-sources · 播放线路

> status: 🟡 §3.1/§3.2 已填写（CHG-SN-8-FUP-SOURCES-DEAD-BTN）；其它章节待 follow-up

## 0. 元信息（骨架默认值）

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/sources` |
| 设计稿引用 | reference.md §5.4 |
| 主任务卡 | (待 M-SN-8 各卡填充) |
| 涉及端点 | (待填) |
| 适用角色 | editor+ |
| 最近更新 | 2026-05-21 (骨架创建) |
| 同事走读签字 | (未走读) |

## 1. 这个页面是做什么的

(待填，1-2 句业务定义)

## 2. 页面布局

(待填，ASCII + 区域名)

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

## 4. 进阶操作

(待填，含二次确认 + 可回滚)

## 5. 字段含义 / 6. 状态颜色 / 7. FAQ / 8. 关系

(待填)
