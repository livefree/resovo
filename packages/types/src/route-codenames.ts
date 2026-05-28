/**
 * route-codenames.ts — Route Label Layer B codename 字库常量（ADR-164 D-164-10）
 *
 * 50 山名 + 2 占位 = 52 项基础字库；codename 实际格式允许"基础名 + 数字后缀"扩容
 * （如 "泰山-2" / "黄山-3" 同名 site 多线路场景）。
 *
 * 字库治理：
 *   - DB 不存字库（避免 schema 膨胀 / Git 版本控制 + TS 编译期检查更可靠 / 参 ADR-017 VideoGenre union 同模式）
 *   - GET /admin/source-line-aliases/codename-pool 端点返回 { available, occupied, cooling } 三段（CHG-368-B-A2 实施）
 *   - 90 天冷却期判定由 SourceLineAliasService 应用层实现（D-164-11 / 不写 DB CHECK）
 *
 * 关联：
 *   - ADR-164 §3 D-164-10 codename 字库治理决策
 *   - docs/manual/route-labeling.md §"命名字库"（5 山名 + 含本 ADR §10 R-164-5 字库枯竭重评条件）
 *   - CHG-368-B-A2 GET codename-pool 端点直接消费 MOUNTAIN_CODENAMES 计算 available
 */

export const MOUNTAIN_CODENAMES: readonly string[] = [
  // 五岳（5）
  '泰山', '华山', '衡山', '嵩山', '恒山',
  // 道教名山（8）
  '峨眉', '武当', '普陀', '九华', '五台', '龙虎', '齐云', '武夷',
  // 西部山脉（8）
  '昆仑', '天山', '祁连', '贺兰', '六盘', '太白', '终南', '秦岭',
  // 华东山脉（8）
  '崂山', '蒙山', '沂山', '天目', '莫干', '雁荡', '天台', '琅琊',
  // 华北山脉（7）
  '太行', '燕山', '长白', '大青', '阴山', '大别', '桐柏',
  // 华南山脉（8）
  '梵净', '黄山', '庐山', '三清', '丹霞', '罗浮', '鼎湖', '天柱',
  // 其他（8）
  '缙云', '崆峒', '麦积', '鸡公', '大明', '天门', '南山', '云台',
  // 占位（2）
  '神农', '虎牢',
] as const

/**
 * codename 字库总数（52 项）。当 occupied + cooling > 45 时触发 R-164-5
 * 字库枯竭重评条件，建议起 PRE-ROUTE-CODENAME-LIBRARY-EXTEND 卡扩字库或允许数字后缀复用。
 */
export const MOUNTAIN_CODENAMES_COUNT = MOUNTAIN_CODENAMES.length
