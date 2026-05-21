# 30 · 业务级选择器（Pickers）

> 杀手用途：彻底消灭"输入 UUID / DB 主键"的反人类交互。
> 真源：`packages/admin-ui/src/components/pickers/`（M-SN-SHARED-04 落地）

## 清单

| Picker | 替换的反人类输入 | 关联页面 | 状态 |
|---|---|---|---|
| [VideoPicker](./VideoPicker.md) | 字幕上传 / 首页模块「内容引用 ID」/ 合并候选 | P-subtitles / P-home / P-merge | 🟡 待 M-SN-SHARED-04 实装 |
| [SourceLinePicker](./SourceLinePicker.md) | sources「一键替换最相似 URL」目标线路；线路别名跳转 | P-sources | 🟡 待 |
| [ContentRefPicker](./ContentRefPicker.md) | 首页模块「内容引用」4 种类型混在一个 input | P-home | 🟡 待 |
| [UserPicker](./UserPicker.md) | audit 用户筛选；邀请用户 | P-audit / P-users | 🟡 待 |
| [SitePicker](./SitePicker.md) | 采集 per-site override 添加 | P-crawler / P-settings | 🟡 待 |

## 通用契约（所有 Picker 必须满足）

1. **触发器（PickerTrigger）**：
   - 未选时：灰色按钮 / chip "点击选择 <资源类型>"
   - 已选时：缩略图 + 标题 + meta + ✕ 取消按钮
2. **Dialog（PickerDialog）**：
   - 顶部 search 输入框（多字段模糊匹配）
   - 列表行：业务可识别字段（不出现 UUID）
   - 上下方向键 + Enter 确认
   - 可选「最近使用」「我相关」快捷过滤
3. **API 复用**：调现有 GET 列表端点 + `?q=&limit=20`
4. **错误态**：搜不到结果时显式提示「未找到匹配的 <资源类型>，请尝试不同关键词」

