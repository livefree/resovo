# P-subtitles · 字幕管理

> status: 🟡 §3.1 上传字幕已填写（CHG-SN-8-FUP-SUB 2026-05-21）；其它章节待 follow-up

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/subtitles` |
| 设计稿引用 | reference.md §5.14 |
| 主任务卡 | CHG-SN-7-MISC-SUBTITLES-1（KPI）+ -2（上传 / ADR-134）+ CHG-SN-8-FUP-SUB（VideoPicker 接入） |
| 涉及端点 | `GET /admin/subtitles` / `POST /admin/subtitles` / `GET /admin/subtitles/stats` 等 |
| 适用角色 | editor+ |
| 最近更新 | 2026-05-21 (CHG-SN-8-FUP-SUB) |
| 同事走读签字 | (未走读) |

## 1. 这个页面是做什么的

(待填，1-2 句业务定义)

## 2. 页面布局

(待填，ASCII + 区域名)

## 3. 常用操作

### 3.1 上传字幕（CHG-SN-8-FUP-SUB / W H4 修复）

> **重要变更**（2026-05-21）：原「视频 ID（UUID）」字段需用户输入 36 位 UUID 字符串，反人类已废除。改用 VideoPicker 业务级选择器（搜索视频标题 / shortId / 年份）。

- **前置条件**：editor 或 admin 角色 / 字幕文件已上传至 R2（拿到完整 URL）
- **操作步骤**：
  1. 「上传字幕」按钮 → Modal 打开
  2. **「视频」字段**：点击触发器 → Dialog 打开 + 自动 focus 搜索框 → 输入视频标题 / shortId 关键词 → 选中视频（Enter 或点击）→ Dialog 关闭 + 触发器显示视频缩略图 + 标题 + shortId
  3. 「语言」select 选择（默认中文简体；自动填充 label）
  4. 「标签」按需调整（如「中文简体」/「英文」/「日语机翻」）
  5. 「格式」选择 srt / vtt / ass
  6. 「字幕文件 URL（R2）」粘贴完整 URL
  7. 「集数」选填（电影留空 / 剧集填 1, 2, ...）
  8. 「上传字幕」按钮提交
- **期望结果**：toast「字幕已创建」+ Modal 关闭 + 列表刷新
- **失败处理**：
  - 「视频」未选 → 红字「必选」提示，提交被阻止
  - 「文件 URL」非有效 URL → 红字「必须是有效 URL」
  - 后端 409 / 500 → ERROR_STYLE 区显示 submitError 文案
  - 重复字幕（同 video + 同 language + 同 episodeNumber）→ 后端返回错误，submitError 显示
- **快捷键**：Esc 关闭 Modal（VideoPicker Dialog 内 Esc 先关 Dialog，再次按 Esc 关 Modal）

(其它操作待 follow-up 填写)

## 4. 进阶操作

(待填，含二次确认 + 可回滚)

## 5. 字段含义 / 6. 状态颜色 / 7. FAQ / 8. 关系

(待填)
