# VideoPicker · 视频选择器

> status: 🟢 已实装（M-SN-SHARED-04-A / arch-reviewer Opus A−）
> owner: @engineering
> scope: 视频选择器组件文档
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10
> 真源：`packages/admin-ui/src/components/pickers/video-picker.tsx`
> 业务域：videos
> 核心 API：消费方注入的 `VideoPickerFetcher`（推荐底层调 GET `/admin/videos?q=&limit=&cursor=&type=&...`）

## 1. 用途

消灭"让用户输入视频 UUID"的反人类交互。出现在所有需要"选一/多个视频"的表单位置：

| 受害方（CHG 修复中）| 旧反人类 | 新接入方式 |
|---|---|---|
| ✅ 字幕上传 Modal（CHG-SN-8-FUP-SUB 2026-05-21 已接入）| ~~`<input>` 36 位 UUID 校验~~（已废） | `<VideoPicker value={v} onChange={setV} fetcher={videoPickerFetcher} required label="视频" />` 单选 |
| 首页模块 Drawer「内容引用 ID」 | 单 input 四种类型混填 | 配合 ContentRefPicker，video 类型走 VideoPicker |
| 合并发起（CHG-SN-8-08）| — | 单/多选 |

## 2. 触发器形态

| 状态 | 视觉 |
|---|---|
| 未选（单选）| 灰色按钮 + placeholder "选择视频..." |
| 已选（单选）| Thumb 海报缩略图 + 标题 + `shortId · 年份` + 「✕」清除按钮 |
| 未选（多选）| 同上 + placeholder "选择视频（可多选）..." |
| 已选（多选）| 多个 chip 平铺，每个 chip 含 `title shortId` + 「✕」整体清除 |
| disabled | 灰显 + cursor `not-allowed` + 不打开 Dialog |
| error | 边框红 + 底部红字错误文案 |

## 3. Dialog 形态

```
┌─ 选择视频 [或 选择视频（多选）] ────────────────────┐
│ ┌─ 搜索框（auto focus）──────────────────────────┐ │
│ │ 搜索标题 / shortId / 年份…                     │ │
│ └────────────────────────────────────────────────┘ │
│ ┌─ 结果列表（max-height 360，独立滚动）────────────┐ │
│ │ ┌────┬─────────────────────────┬────────┐    │ │
│ │ │ 📷 │ 标题                    │ pill   │    │ │
│ │ │    │ shortId · 年份          │ type   │    │ │
│ │ └────┴─────────────────────────┴────────┘    │ │
│ │ ……                                            │ │
│ └────────────────────────────────────────────────┘ │
├─ 多选模式才有的 footer ─────────────────────────────┤
│ 已选 3 / 5            [取消] [确认]                │
└──────────────────────────────────────────────────────┘
```

- 初始 focus 自动落在搜索框
- 搜索 debounce 300ms（业界标准；快速键入只触发末次 fetch）
- 搜索每次都 AbortSignal 取消上一次未完成请求（避免乱序回包）

## 4. 字段映射（业务字段 → PickerVideoItem）

| PickerVideoItem | 来源（apps/server-next 实现 fetcher 时映射）| 备注 |
|---|---|---|
| `id` | `row.id` (UUID PK) | 提交后端用 |
| `shortId` | `row.shortId` | 人类可读短 ID，运营复述用 |
| `title` | `row.title` | 主标题 |
| `titleEn` | `row.titleEn` | 英文标题（可选） |
| `type` | `row.type` (VideoType 枚举) | string 形式即可 |
| `year` | `row.year` | int 或 null |
| `coverUrl` | `row.coverUrl ?? row.posterUrl` | 海报 URL |
| `isPublished` | `row.isPublished` | 已上架视频用 ok 状态背景 |

**admin-ui 零 import apps/\*\* 业务路径**（ADR-103b）；fetcher 实现完全由消费方写。

## 5. 键盘 / 快捷键

| 上下文 | 键 | 作用 |
|---|---|---|
| 触发器 | Space / Enter | 打开 Dialog（disabled 时不响应）|
| Dialog 搜索框 | 文字输入 | debounce 后触发 fetcher |
| Dialog 搜索框 | ArrowDown | 焦点移到结果列表第一项 |
| Dialog 全局 | Escape | 关闭 Dialog（多选丢弃 staging）|
| Dialog 列表 | ArrowUp/Down | 移动 active 项 |
| Dialog 列表（single）| Enter | 选中并关闭 |
| Dialog 列表（multi）| Space | toggle 选中 |
| Dialog 列表（multi）| Shift+Enter | 确认 staging 选中并关闭 |
| Dialog 全局 | Tab | 焦点循环 |

WAI-ARIA：触发器 `role=combobox` + `aria-haspopup=dialog`；Dialog 内 listbox + option + aria-selected。

## 6. 错误态

| 现象 | 处理 |
|---|---|
| 搜索结果空 | 显式 EmptyState：「未找到匹配的视频，请尝试不同关键词」（不是 "0 results"）|
| fetcher throw 错误 | 显示 `加载失败：${err.message}` + 「重试」按钮（重新调 fetcher） |
| AbortError | 静默忽略（不显示给用户） |
| 多选超过 max | toggle 静默 no-op；不弹错（footer 显示 `已选 N / max` 提示） |
| disabled 中点击 | 触发器无响应（不打开 Dialog） |
| 已选项失效（外部删除）| 触发器仍正常显示已选内容；消费方在 `onChange` 时自行校验 |

## 7. 公开 export 清单

```ts
import {
  VideoPicker,
  type VideoPickerProps,
  type SingleVideoPickerProps,
  type MultipleVideoPickerProps,
  type PickerVideoItem,
  type VideoPickerFilter,
  type VideoPickerFetcher,
  type VideoPickerFetchParams,
  type VideoPickerFetchResult,
} from '@resovo/admin-ui'
```

## 8. 消费方接入示例（fetcher 注入）

```tsx
// 在 apps/server-next 内
import { VideoPicker, type VideoPickerFetcher } from '@resovo/admin-ui'
import { listVideos } from '@/lib/videos/api'

const videoFetcher: VideoPickerFetcher = async ({ q, limit, cursor, filter, signal }) => {
  const res = await listVideos({ q, limit, cursor, type: filter?.type })
  return {
    items: res.rows.map((row) => ({
      id: row.id,
      shortId: row.shortId,
      title: row.title,
      titleEn: row.titleEn ?? null,
      type: row.type,
      year: row.year,
      coverUrl: row.coverUrl,
      isPublished: row.isPublished,
    })),
    nextCursor: res.nextCursor,
    total: res.total,
  }
}

// 单选
<VideoPicker
  label="视频"
  value={video}
  onChange={setVideo}
  fetcher={videoFetcher}
  required
/>

// 多选 + 类型锁定
<VideoPicker
  multiple
  max={5}
  value={videos}
  onChange={setVideos}
  fetcher={videoFetcher}
  filter={{ type: 'movie' }}
/>
```
