# 分级验证功能方案（未来扩展，2026-04-02）

## 目标

在控制带宽与时延成本前提下，提高“可用源”判断可信度，并沉淀可用于线路质量展示的数据。

## 当前状态

当前验证为 L1：

- `HEAD` 可达性检测
- `2xx => active=true`
- 结果仅代表“链接可达”，不等于“一定可播放”

## 分级模型

### L1 Reachability（保留现状）

- HEAD/轻量 GET 探活
- 低成本全量巡检

### L2 Playability（按风险触发）

- m3u8：拉取 playlist 并验证可解析
- 抽样拉取 1-2 个分片（或 Range）验证真实播放链路
- 输出：`playable=true/false`、失败阶段（manifest/segment/auth）

### L3 Metadata（按需采集）

- m3u8 master 提取 `RESOLUTION/BANDWIDTH`
- mp4 通过轻量元信息提取宽高/码率/时长
- 输出：`quality_label`、`width`、`height`、`bitrate`

## 成本控制策略

1. 不做全量 L2/L3
2. 触发条件：
   - 用户播放失败率升高
   - 同站点批量异常
   - 关键视频（高热度）优先
3. 并发与预算：
   - 站点级并发上限
   - 日预算上限（任务数/流量）

## 前端参与策略（推荐）

采用“后端 L1 + 前端信号回传 + 后端异步确认”的混合模型：

1. 前端回传事件：
   - `manifest_loaded`
   - `first_frame`
   - `playback_error`
2. 后端汇总事件，更新可靠性分数
3. 对高风险源再触发 L2/L3 主动验证

## 数据字段建议

建议补充 `video_sources` 字段：

- `verify_level`（L1/L2/L3）
- `playability_score`
- `quality_label`
- `width` / `height` / `bitrate`
- `last_play_ok_at` / `last_verify_error`

## 路线图

1. Phase A：前端播放事件上报 + 后端聚合
2. Phase B：站点风险驱动的 L2 验证
3. Phase C：L3 元信息采集与质量标签稳定化

## 备注

该方案标记为“未来扩展”，当前不进入立即开发序列。
