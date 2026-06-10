# ContentRefPicker · 内容引用选择器（复合）

> status: 🟢 已实装（CHG-SN-8-FUP-HOME / arch-reviewer Opus A−）
> owner: @engineering
> scope: 首页运营位内容引用字段多类型选择器
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10
> 真源：`packages/admin-ui/src/components/pickers/content-ref-picker.tsx`
> 业务域：home_modules（首页运营位编辑器）
> 依赖：VideoPicker（type='video' 时）+ AdminSelect（type='video_type'）+ AdminInput（其它类型）

## 1. 用途

替换首页模块表单中「视频 ID / URL / HTML ID / 类型枚举值」单 input 混填的反人类交互。
根据外部传入的 `type` prop 自动渲染对应专用输入器：

| type | 子输入器 | 用户感知 |
|---|---|---|
| `video` | VideoPicker single | 搜索式选视频，回显标题+缩略图 |
| `external_url` | URL input + 内联校验 | 输入完整 URL（http://...）+ 实时校验 |
| `custom_html` | text input | 输入运营可识别 HTML 片段 ID |
| `video_type` | AdminSelect | 11 VideoType 枚举值下拉 |

## 2. 受害方接入示例

```tsx
import { ContentRefPicker } from '@resovo/admin-ui'
import { videoPickerFetcher } from '@/lib/videos/picker-fetcher'

const VIDEO_TYPE_OPTIONS = [
  { value: 'movie', label: '电影 (movie)' },
  { value: 'series', label: '连续剧 (series)' },
  // ... 11 个枚举值
]

<ContentRefPicker
  label="内容引用 *"
  type={form.contentRefType}              // 外部受控
  value={form.contentRefId}
  onChange={(next) => setField('contentRefId', next)}
  videoFetcher={videoPickerFetcher}       // type='video' 时使用
  videoTypeOptions={VIDEO_TYPE_OPTIONS}   // type='video_type' 时使用
  required
/>
```

**消费方必须**：在 `setField('contentRefType', ...)` 时同步 `setField('contentRefId', '')`（type 切换时 reset value 是消费方职责；ContentRefPicker 内部仅清 resolvedVideo state）。

## 3. type 切换行为

| 切换路径 | ContentRefPicker 内部 | 消费方职责 |
|---|---|---|
| video → 其它 | 清空 resolvedVideo state | setField('contentRefId', '') |
| 其它 → video | resolvedVideo 初始 null；若 value 非空则触发 fetcher 恢复查询（编辑态回显）| 同上 |
| 非 video 类型间切换 | 无内部状态需清理 | setField('contentRefId', '') |

## 4. video 编辑态回显

- 编辑已有 home_module 时，value 是 UUID 字符串（无 PickerVideoItem 对象）
- ContentRefPicker 检测到 `type==='video' && value !== '' && resolvedVideo?.id !== value` 时自动调 `videoFetcher({ q: value, limit: 1 })` 恢复 PickerVideoItem
- 含 AbortController cleanup（type 切换或 unmount 时 abort 旧请求）
- 恢复失败 → console.error + resolvedVideo 保持 null + VideoPicker 触发器显示 placeholder（**value 不丢**）

## 5. 错误态

| 场景 | 处理 |
|---|---|
| `value === ''` && `required` | 子输入器透传 required HTML 属性；实际表单校验由消费方在 submit 时处理 |
| external_url 输入非法 URL | 内联红字「请输入有效的 URL（含 http:// 或 https://）」 |
| `videoFetcher` 缺失但 type='video' | console.error + 降级 AdminInput type='text'（UUID 手动输入兜底，不 throw） |
| `videoTypeOptions` 缺失但 type='video_type' | console.error + AdminSelect 渲染空 options |
| `error` prop 传入 | 子输入器红边框 + 底部红字文案（与内联 url 校验并存且不冲突） |

## 6. 公开 export

```ts
import {
  ContentRefPicker,
  type ContentRefPickerProps,
  type ContentRefType,
} from '@resovo/admin-ui'
```

## 7. 测试覆盖

`packages/admin-ui/.../pickers/content-ref-picker.test.tsx` 10 用例：
1. type=video → VideoPicker 选中 → onChange(video.id)
2. type=external_url 合法 URL → onChange
3. type=external_url 非法 URL → 内联错误
4. type=custom_html → onChange
5. type=video_type → AdminSelect onChange
6. type 切换：VideoPicker 卸载 / AdminInput 挂载
7. videoFetcher 缺失 → console.error + fallback
8. disabled 透传
9. (advisory) 编辑态 fetcher 恢复
10. (advisory) error prop 显示

## 8. 已接入受害方

| 视图 | 旧反人类 | 新接入方式 |
|---|---|---|
| ✅ HomeModuleDrawer（CHG-SN-8-FUP-HOME 2026-05-21）| `<input>` 4 类型混填 + 4 hint 切换 | `<ContentRefPicker type={form.contentRefType} value={form.contentRefId} videoFetcher videoTypeOptions />` |
