# P-subtitles · 字幕管理

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / 2026-05-21）

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

后台字幕集中审核 + 上传管理。看 KPI 4（总数 / 中文 / 英文 / 缺字幕视频）+ 字幕列表 + 上传新字幕（手动 R2 URL）。审核维度复用「is_verified」字段（admin 上传默认直接 verified）。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 字幕管理 · Actions: 「上传字幕」                      │
├──────────────────────────────────────────────────────────────────┤
│ KPI 4 列（CHG-SN-7-MISC-SUBTITLES-1 + ADR-133）：                │
│  字幕总数 / 中文 / 英文 / 缺字幕视频                              │
├──────────────────────────────────────────────────────────────────┤
│ DataTable（reference §6.6）：                                    │
│  video / lang pill / format mono / source muted / quality(60×6  │
│  progress) / size muted / actions（eye / edit / trash danger）   │
└──────────────────────────────────────────────────────────────────┘
```

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

### 3.2 通过待审字幕（approve）

- **位置**：is_verified=false 行尾「通过」按钮
- **行为**：`POST /admin/subtitles/:id/approve`
- **效果**：is_verified=true；前台播放器开始消费

### 3.3 拒绝待审字幕

- **位置**：行尾「拒绝」+ confirm
- **行为**：`POST /admin/subtitles/:id/reject` 软删（不物理删）

### 3.4 删除字幕（danger）

- **位置**：actions 列 trash icon
- **行为**：confirm → 软删除 + audit log

### 3.5 看字幕详情（eye icon）

- **行为**：跳字幕文件 URL（R2）→ 浏览器尝试预览

## 4. 进阶操作

### 4.1 批量审核 / 删除
- **状态**：⬜ 未实装（GAPS.md #G-subtitles-batch）

### 4.2 字幕同步质量自动评估
- reference §6.6 列出 progress bar；当前数据源未明（GAPS.md #G-subtitles-quality-source 待复核）

## 5. 字段含义（reference §6.6）

| 列 | 含义 |
|---|---|
| video | tbl-thumb-sm + tbl-title |
| lang | pill info（简体中文 / English ...）|
| format | mono `srt / ass / vtt` |
| source | OpenSubtitles / 用户上传 / 管理员手动（muted fs 11）|
| quality | 60×6 progress（ok 色）+ {N}% |
| size | KB（muted fs 11）|
| actions | eye / edit / trash danger 3 xs btn |

## 6. 状态颜色

| pill | 含义 |
|---|---|
| 绿（ok）| is_verified=true / 同步质量 ≥ 90% |
| 黄（warn）| pending review / 同步 60-90% |
| 红（danger）| rejected / 同步 <60% |
| 灰（muted）| 缺字幕视频 |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 「上传字幕」让我输 UUID | 已废除（CHG-SN-8-FUP-SUB）| 用 VideoPicker 搜索 |
| 同步质量条总是空 | 数据源待核（GAPS）| follow-up |
| 字幕 URL 404 | R2 URL 失效 / CORS | 改 URL 重传 |
| 批量动作缺失 | 未实装 | GAPS.md #G-subtitles-batch |

## 8. 与其他页面的关系

- → 跳出到 [P-videos](./P-videos.md)：video 列点击 / 缺字幕视频深链
- → 跳出到 [P-audit](./P-audit.md)：上传 / 通过 / 拒绝 / 删除 写 audit log
- ← 跳入自 [P-dashboard](./P-dashboard.md)：「缺字幕视频」KPI 深链
