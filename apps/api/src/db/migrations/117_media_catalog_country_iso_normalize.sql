-- 117_media_catalog_country_iso_normalize.sql
-- 描述：media_catalog.country 存量清洗——douban 增强直写的中文国家名（'中国大陆'/'美国'/'日本'…）
--      归一为 ISO 3166-1 alpha-2 code（CN/US/JP…），消除同国「中文名 / ISO」两值导致的
--      视频库 distinct / 筛选 / 分组失效（筛「美国」匹配不到「US」行）。
-- 日期：2026-06-15
-- 决策真源：SEQ-20260615-01 META-40（裁定 A——本清洗为 ADR-199 D-199-3「不回写存量」的
--      显式例外：定向修复 douban 引入的 catalog.country 污染，非全表语义回溯改写）。
-- 任务卡：META-40 / SEQ-20260615-01
-- 子代理：无（country 归一既有 API-local 逻辑收敛上提 packages/types，opus 主循环亲定 helper 契约）。
-- 幂等：是（WHERE country = <中文名>；UPDATE 后值已变 ISO，复跑不再命中任一中文 key，安全重复执行）。
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105/112/115/116 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）；ISO→中文为有损坍缩（多中文别名映单 ISO），不可逆，不提供 down。
--
-- 映射真源：本 VALUES 表为 packages/types `COUNTRY_NAME_TO_ISO`（@META-40）的 point-in-time SQL
--   快照（SQL 无法 import TS，固有约束）。写入侧 5 处已经 countryToIso 归一 → 新数据不再产生
--   中文名，故本快照仅需覆盖存量；日后映射扩充无须回改本 migration。
-- 不可归一登记：表外的罕见中文名（生僻国）保留原值不强清，待后续人工 / 映射补全后下次 enrich 自洁
--   （写入侧「归一不到则不写」保证不再新增污染，存量罕见名静默保留可由 SELECT country !~ '^[A-Z]{2}$' 审计）。

UPDATE media_catalog AS mc
SET country = m.iso
FROM (VALUES
  ('中国', 'CN'), ('中国大陆', 'CN'), ('大陆', 'CN'), ('国产', 'CN'), ('华语', 'CN'), ('内地', 'CN'),
  ('香港', 'HK'), ('中国香港', 'HK'), ('港剧', 'HK'),
  ('台湾', 'TW'), ('中国台湾', 'TW'),
  ('澳门', 'MO'), ('中国澳门', 'MO'),
  ('日本', 'JP'), ('日剧', 'JP'),
  ('韩国', 'KR'), ('韩剧', 'KR'), ('南韩', 'KR'),
  ('朝鲜', 'KP'),
  ('泰国', 'TH'),
  ('新加坡', 'SG'),
  ('马来西亚', 'MY'),
  ('印度尼西亚', 'ID'), ('印尼', 'ID'),
  ('菲律宾', 'PH'),
  ('越南', 'VN'),
  ('印度', 'IN'),
  ('美国', 'US'), ('美剧', 'US'),
  ('加拿大', 'CA'),
  ('墨西哥', 'MX'),
  ('英国', 'GB'), ('英剧', 'GB'),
  ('法国', 'FR'),
  ('德国', 'DE'),
  ('意大利', 'IT'),
  ('西班牙', 'ES'),
  ('葡萄牙', 'PT'),
  ('荷兰', 'NL'),
  ('比利时', 'BE'),
  ('爱尔兰', 'IE'),
  ('瑞典', 'SE'),
  ('丹麦', 'DK'),
  ('挪威', 'NO'),
  ('芬兰', 'FI'),
  ('瑞士', 'CH'),
  ('奥地利', 'AT'),
  ('波兰', 'PL'),
  ('俄罗斯', 'RU'), ('苏联', 'RU'),
  ('澳大利亚', 'AU'), ('澳洲', 'AU'),
  ('新西兰', 'NZ'),
  ('土耳其', 'TR'),
  ('以色列', 'IL'),
  ('伊朗', 'IR'),
  ('巴西', 'BR'),
  ('阿根廷', 'AR')
) AS m(zh, iso)
WHERE mc.country = m.zh;

-- Down（不可逆，注释留存）：
-- ISO→中文为有损坍缩（多别名映单 ISO），无确定反向映射；如需回退按业务从
-- external_douban_movies_raw / douban 原始 detail.countries 重建。
