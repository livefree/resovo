# 已知 pre-existing 失败单测台账（2026-05-29 基线）

> 记录目的：避免后续任务反复"重新发现"这批与本次改动无关的存量失败。
> 发现于：META-07（SEQ-20260529-02）全量单测验证；经 `git stash` 基线比对确认**与 META-07 无关**（main 树态即失败）。
> 处置：择时另起独立清理卡修复（不混入功能卡）。修一项划掉一项。
> **✅ 2026-05-30 已修复（CHORE-TEST-BASELINE-20260529）**：6 文件 / 20 用例全部解决，根因均为测试侧（陈旧断言 / 缺失 next/navigation mock / 覆盖已删除功能），无产品代码 bug。CrawlerClient 时区 flaky 未在本次范围（仍待加固）。

## 基线状态

- 验证命令：`npm run test -- --run`
- 基线（main 树态 / 2026-05-29）：**20 failed / 76 passed**（这 7 个文件范围内）；全量 5616 passed。
- **修复后（2026-05-30）**：6 文件 20 用例 **全绿**；全量 **5642 passed / 0 failed**（437 文件）。
- 全部为 **前端组件测试（jsdom）**，与后端/类型改动无 import 关系。

## 失败清单（6 文件 / 20 用例）— ✅ 全部已修复（2026-05-30）

| 文件 | 失败数 | 用例 | 确认根因 + 修复 |
|---|---|---|---|
| `tests/unit/web-next/route-theme-selector.test.tsx` | 1 ✅ | 渲染 ALL_THEMES 5 个选项 + 当前主题默认选中 | CHG-369-B 末尾加「自定义」option + 新增必填 props；测试断言 option 数应 +1，并补传 `customTheme`/`onOpenCustomDialog` |
| `tests/unit/web-next/player-shell-hydration.test.tsx` | 1 ✅ | 有 initialVideo + initialSources → 完全跳过 client fetch（apiClient.get 不调） | ADR-165 让 PlayerShell mount 时发 `/users/me/preferences` GET；stub `useRouteTheme`，补全 `line-display-name` mock（`buildThemedSources`/`matchActiveSourceIndex`），`RouteThemeSelector` mock 成 null |
| `tests/unit/components/server-next/admin/moderation/ModerationBatch.test.tsx` | 3 ✅ | selectionMode=true 渲 checkbox+onToggleSelect / selected=true checkbox checked / selectionMode=undefined 无 checkbox | CHG-360-C/ADR-159：ModListRow 改用 `DualSignalCount probe={it.probeAggregate}`；fixture 补 `probeAggregate`/`renderAggregate` |
| `tests/unit/components/server-next/admin/submissions/SubmissionsListClient.test.tsx` | 4 ✅ | CSV 导出 1/2/3 + REDO-02-D deprecation banner | 组件新增 `useRouter()`；补 `vi.mock('next/navigation')` |
| `tests/unit/components/server-next/admin/sources/SourcesClient.test.tsx` | 9 ✅ | 渲染基础/KPI 4卡/Segment 4 tabs/segment 切换/Empty/Error/视频分组/全局别名表 tab/搜索 | 同上：`SourcesClient` 用 `useRouter()`；补 `vi.mock('next/navigation')` |
| `tests/unit/components/server-next/admin/sources/SourcesReplaceTip.test.tsx` | 2 ✅ | 一键替换提示 Modal 渲染 / 「我知道了」关闭 | CHG-SN-9-LINES-VIEW-UNIFY 已移除该按钮 + Modal，替换为「线路别名管理」链接；测试重写为覆盖 `sources-line-aliases-link` → `router.push` |

## Flaky（非稳定失败，单跑即过）

| 文件 | 用例 | 现象 |
|---|---|---|
| `tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` | 51. 时间轴 rangeStart/rangeEnd + ticks 使用本地时区 HH:MM（非 UTC slice） | ✅ **已加固（CHORE-TEST-CRAWLER-TZ-FLAKY / 2026-06-04）**。根因双重：① waitFor 只等 card testid、HH:MM 内容依赖 timeline mock 异步 resolve 后渲染（并行负载下断言早于数据 paint = flaky 主因）→ 内容断言整体包入 waitFor；② 期望值手工 `getHours()+':00'` 与组件 `toLocaleTimeString(hour12:false)` 口径不一致（半小时偏移时区/非 ':' locale 会确定性失败）→ 期望值改逐字同参 toLocaleTimeString。验证：本机 ×3 + TZ=Asia/Kolkata（+5:30）/UTC/America/New_York 全过 + 全量并行 6359 passed。 |

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
