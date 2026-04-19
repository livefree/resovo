# 已知失败测试隔离清单 — Phase 0

> 适用阶段：Phase 0（2026-04-18 起）
> 更新协议：每进入新 Phase 只能缩小不能增长；新增失败必须在本 Phase 内修复或创建 CHG-NN 任务
> 关联文档：`docs/test_triage_20260418.md`，`docs/baseline_20260418/failing_tests.json`

---

## 说明

- 单元测试：经 TESTFIX-05 修复后 **0 条**失败，本清单无单元测试条目
- E2E 测试：9 条 C 类失败，全部 defer 到 M2/M3/M5 里程碑，进入本清单
- CI `test:guarded` 运行单元测试时，清单外新增失败 → 退出码 1（阻断 merge）

---

## 隔离 ID 列表（E2E）

```json
[
  "e2e::player.spec.ts::电影详情页::立即观看按钮指向播放页",
  "e2e::player.spec.ts::动漫详情页（多集）::点击第 3 集跳转到播放页 ep 3",
  "e2e::player.spec.ts::播放页（PlayerShell）::标题链接指向详情页",
  "e2e::player.spec.ts::播放页（PlayerShell）::剧场模式切换按钮可见（大屏设备）",
  "e2e::player.spec.ts::播放页（多集动漫）::显示右侧选集面板",
  "e2e::player.spec.ts::播放页（多集动漫）::选集面板显示正确数量",
  "e2e::player.spec.ts::PLAYER-10 播放页完整链路::DanmakuBar 存在于播放页中（data-testid=danmaku-bar）",
  "e2e::search.spec.ts::分类浏览页::点击类型筛选后结果更新（只显示该类型）",
  "e2e::search.spec.ts::搜索页::点击结果卡片跳转到播放页"
]
```

---

## 处置计划

| test_id | 分类 | defer 里程碑 | 原因 |
|---------|------|-------------|------|
| `e2e::player.spec.ts::电影详情页::立即观看按钮指向播放页` | C | M3 | href 格式：shortId-only vs title-slug |
| `e2e::player.spec.ts::动漫详情页（多集）::点击第 3 集跳转到播放页 ep 3` | C | M3 | 同上 |
| `e2e::player.spec.ts::播放页（PlayerShell）::标题链接指向详情页` | C | M3 | back-to-detail-link testid 缺失 |
| `e2e::player.spec.ts::播放页（PlayerShell）::剧场模式切换按钮可见（大屏设备）` | C | M3 | theater-mode-btn testid 缺失 |
| `e2e::player.spec.ts::播放页（多集动漫）::显示右侧选集面板` | C | M3 | player-side-panel testid 缺失 |
| `e2e::player.spec.ts::播放页（多集动漫）::选集面板显示正确数量` | C | M3 | side-episode-* testid 缺失 |
| `e2e::player.spec.ts::PLAYER-10 播放页完整链路::DanmakuBar 存在于播放页中（data-testid=danmaku-bar）` | C | M5 | danmaku-bar 已移除，M5 重新接入 |
| `e2e::search.spec.ts::分类浏览页::点击类型筛选后结果更新（只显示该类型）` | C | M2 | result-count testid 文案漂移 |
| `e2e::search.spec.ts::搜索页::点击结果卡片跳转到播放页` | C | M3 | result-card href 格式漂移 |
