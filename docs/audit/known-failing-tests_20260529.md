# 已知 pre-existing 失败单测台账（2026-05-29 基线）

> 记录目的：避免后续任务反复"重新发现"这批与本次改动无关的存量失败。
> 发现于：META-07（SEQ-20260529-02）全量单测验证；经 `git stash` 基线比对确认**与 META-07 无关**（main 树态即失败）。
> 处置：择时另起独立清理卡修复（不混入功能卡）。修一项划掉一项。

## 基线状态

- 验证命令：`npm run test -- --run`
- 基线（main 树态）：**20 failed / 76 passed**（这 7 个文件范围内）；全量 5616 passed。
- 全部为 **前端组件测试（jsdom）**，与后端/类型改动无 import 关系。

## 失败清单（6 文件 / 20 用例）

| 文件 | 失败数 | 用例 | 疑似根因（待确认） |
|---|---|---|---|
| `tests/unit/web-next/route-theme-selector.test.tsx` | 1 | 渲染 ALL_THEMES 5 个选项 + 当前主题默认选中 | 主题列表/选中态渲染漂移 |
| `tests/unit/web-next/player-shell-hydration.test.tsx` | 1 | 有 initialVideo + initialSources → 完全跳过 client fetch（apiClient.get 不调） | hydration mock / SSR 注入断言 |
| `tests/unit/components/server-next/admin/moderation/ModerationBatch.test.tsx` | 3 | selectionMode=true 渲 checkbox+onToggleSelect / selected=true checkbox checked / selectionMode=undefined 无 checkbox | ModListRow selectionMode 渲染契约漂移 |
| `tests/unit/components/server-next/admin/submissions/SubmissionsListClient.test.tsx` | 4 | CSV 导出 1/2/3 + REDO-02-D deprecation banner | CSV 按钮 + deprecation banner 渲染 |
| `tests/unit/components/server-next/admin/sources/SourcesClient.test.tsx` | 9 | 渲染基础/KPI 4卡/Segment 4 tabs/segment 切换/Empty/Error/视频分组/全局别名表 tab/搜索 | SourcesClient 整体渲染契约（疑大改后测试未同步） |
| `tests/unit/components/server-next/admin/sources/SourcesReplaceTip.test.tsx` | 2 | 一键替换提示 Modal 渲染 / 「我知道了」关闭 | Modal 交互 |

## Flaky（非稳定失败，单跑即过）

| 文件 | 用例 | 现象 |
|---|---|---|
| `tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` | 51. 时间轴 rangeStart/rangeEnd + ticks 使用本地时区 HH:MM（非 UTC slice） | 全量并行跑偶发失败，**单独跑 66/66 通过** → 时区/并行负载敏感，非确定性失败。建议加固为时区无关断言。 |

## 复现

```bash
npx vitest run \
  tests/unit/web-next/route-theme-selector.test.tsx \
  tests/unit/web-next/player-shell-hydration.test.tsx \
  tests/unit/components/server-next/admin/moderation/ModerationBatch.test.tsx \
  tests/unit/components/server-next/admin/submissions/SubmissionsListClient.test.tsx \
  tests/unit/components/server-next/admin/sources/SourcesClient.test.tsx \
  tests/unit/components/server-next/admin/sources/SourcesReplaceTip.test.tsx
# → 6 failed | 1 passed (CrawlerClient 单跑过)
```
