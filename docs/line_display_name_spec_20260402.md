# 线路显示名称规范方案（2026-04-02）

## 目标

将“线路2 / subyun”这类技术名替换为用户可理解、稳定一致、可运营治理的展示名。

## 适用范围

- 前台播放页线路选择
- 审核详情页“源站/线路”选择
- 视频管理相关预览区

## 命名优先级

按以下优先级生成最终展示名 `display_name`：

1. `manual_display_name`（人工覆盖）
2. `site_key` 对应站点品牌名（来自 `crawler_sites`）
3. `source_url` 域名映射命中值
4. `source_name` 归一化映射命中值
5. 回退名：`线路A` / `线路B` / `线路C`（禁用“线路2”样式）

## 展示格式

前台优先格式：

- `display_name · quality_label`
- 例如：`量子云 · 1080P`
- 无质量时：`量子云 · 未知清晰度`

后台可附加原始信息（仅运营可见）：

- 原始 `source_name`
- 源域名
- 命中规则来源（manual/site/domain/source/fallback）

## 归一化规则（首批）

- `subyun|sub-yun|sub云` -> `SUB云`
- `line1|线路1|默认线路` -> `线路A`
- `line2|线路2|备用2` -> `线路B`
- 其他未知值 -> `线路{字母}`，并进入“命名治理待处理”队列

## 数据字段建议

建议在 `video_sources` 增加：

- `display_name TEXT`
- `display_name_source TEXT CHECK (IN ('manual','site','domain','source','fallback'))`
- `raw_source_name TEXT`

说明：`raw_source_name` 永久保留原始抓取值，`display_name` 可持续治理。

## 生成时机

1. 爬虫入库时生成初始 `display_name`
2. 人工改名后写入 `manual_display_name`（最高优先级，后续采集不覆盖）
3. 可离线批处理回填历史数据

## 实施步骤（下一步执行）

1. 新增 `normalizeLineDisplayName()` 规则函数
2. 接入爬虫入库和审核展示层
3. 补 migration + 历史回填脚本
4. 增加后台“命名治理”页面（可批量修正 fallback 名称）

## 验收标准

1. 前台不再出现 `线路2`、`subyun` 等低可读文案
2. 同一来源长期显示一致名称，不随抓取顺序漂移
3. 运营可追溯“展示名由哪条规则生成”
