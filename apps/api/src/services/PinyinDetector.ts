/**
 * PinyinDetector.ts — 标题拼音识别 helper（CHG-365-A1 / plan §10.4.1）
 *
 * 用途：判断 `videos.title_en` 字段是否实际填入了中文拼音（而非真英文标题）。
 * 例如 "Wo Bei Quan Wang Da Bao" 是拼音 / "The Avengers" 是英文。
 *
 * 算法：
 *   1. 拆词 by whitespace（大小写不敏感）
 *   2. 每词剥离首尾标点 → 必须全 ASCII 字母
 *   3. 贪心 longest-match 分解为合法拼音音节序列（PINYIN_SYLLABLES）
 *   4. 所有词都能完全分解 → 判定为拼音
 *
 * 已知 false-positive：英文中也有"ma" / "ban" / "an" 等单词同时是合法拼音音节。
 * 这是 heuristic 判断，配合人工校对（审核台 TabDetail manual 修正）使用。
 *
 * 数据来源：标准普通话音节表（约 410 个 / 含轻声变体 / 不含声调标记）。
 */

/** 标准普通话拼音音节集合（不含声调标记 / lower-cased） */
const PINYIN_SYLLABLES: ReadonlySet<string> = new Set([
  // 单韵母 + 零声母音节
  'a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'er',
  'yi', 'wu', 'yu', 'ya', 'ye', 'yao', 'you', 'yan', 'yin', 'yang', 'ying', 'yong',
  'wa', 'wo', 'wai', 'wei', 'wan', 'wen', 'wang', 'weng',
  'yue', 'yuan', 'yun',
  // b
  'ba', 'bo', 'bai', 'bei', 'bao', 'ban', 'ben', 'bang', 'beng',
  'bi', 'bie', 'biao', 'bian', 'bin', 'bing', 'bu',
  // p
  'pa', 'po', 'pai', 'pei', 'pao', 'pou', 'pan', 'pen', 'pang', 'peng',
  'pi', 'pie', 'piao', 'pian', 'pin', 'ping', 'pu',
  // m
  'ma', 'mo', 'me', 'mai', 'mei', 'mao', 'mou', 'man', 'men', 'mang', 'meng',
  'mi', 'mie', 'miao', 'miu', 'mian', 'min', 'ming', 'mu',
  // f
  'fa', 'fo', 'fei', 'fou', 'fan', 'fen', 'fang', 'feng', 'fu',
  // d
  'da', 'de', 'dai', 'dei', 'dao', 'dou', 'dan', 'den', 'dang', 'deng', 'dong',
  'di', 'die', 'diao', 'diu', 'dian', 'din', 'ding', 'du', 'duo', 'dui', 'duan', 'dun',
  // t
  'ta', 'te', 'tai', 'tao', 'tou', 'tan', 'tang', 'teng', 'tong',
  'ti', 'tie', 'tiao', 'tian', 'ting', 'tu', 'tuo', 'tui', 'tuan', 'tun',
  // n
  'na', 'nai', 'nei', 'nao', 'nou', 'nan', 'nen', 'nang', 'neng', 'nong',
  'ni', 'nie', 'niao', 'niu', 'nian', 'nin', 'niang', 'ning', 'nu', 'nuo', 'nuan',
  'nü', 'nv', 'nüe', 'nue',
  // l
  'la', 'le', 'lai', 'lei', 'lao', 'lou', 'lan', 'lang', 'leng', 'long',
  'li', 'lia', 'lie', 'liao', 'liu', 'lian', 'lin', 'liang', 'ling',
  'lu', 'luo', 'luan', 'lun', 'lü', 'lv', 'lüe', 'lue',
  // g
  'ga', 'ge', 'gai', 'gei', 'gao', 'gou', 'gan', 'gen', 'gang', 'geng', 'gong',
  'gu', 'gua', 'guo', 'guai', 'gui', 'guan', 'gun', 'guang',
  // k
  'ka', 'ke', 'kai', 'kao', 'kou', 'kan', 'ken', 'kang', 'keng', 'kong',
  'ku', 'kua', 'kuo', 'kuai', 'kui', 'kuan', 'kun', 'kuang',
  // h
  'ha', 'he', 'hai', 'hei', 'hao', 'hou', 'han', 'hen', 'hang', 'heng', 'hong',
  'hu', 'hua', 'huo', 'huai', 'hui', 'huan', 'hun', 'huang',
  // j
  'ji', 'jia', 'jie', 'jiao', 'jiu', 'jian', 'jin', 'jiang', 'jing', 'jiong',
  'ju', 'jue', 'juan', 'jun',
  // q
  'qi', 'qia', 'qie', 'qiao', 'qiu', 'qian', 'qin', 'qiang', 'qing', 'qiong',
  'qu', 'que', 'quan', 'qun',
  // x
  'xi', 'xia', 'xie', 'xiao', 'xiu', 'xian', 'xin', 'xiang', 'xing', 'xiong',
  'xu', 'xue', 'xuan', 'xun',
  // zh
  'zha', 'zhe', 'zhi', 'zhai', 'zhao', 'zhou', 'zhan', 'zhen', 'zhang', 'zheng', 'zhong',
  'zhu', 'zhua', 'zhuo', 'zhuai', 'zhui', 'zhuan', 'zhun', 'zhuang',
  // ch
  'cha', 'che', 'chi', 'chai', 'chao', 'chou', 'chan', 'chen', 'chang', 'cheng', 'chong',
  'chu', 'chua', 'chuo', 'chuai', 'chui', 'chuan', 'chun', 'chuang',
  // sh
  'sha', 'she', 'shi', 'shai', 'shei', 'shao', 'shou', 'shan', 'shen', 'shang', 'sheng',
  'shu', 'shua', 'shuo', 'shuai', 'shui', 'shuan', 'shun', 'shuang',
  // r
  're', 'ri', 'rao', 'rou', 'ran', 'ren', 'rang', 'reng', 'rong',
  'ru', 'rua', 'ruo', 'rui', 'ruan', 'run',
  // z
  'za', 'ze', 'zi', 'zai', 'zei', 'zao', 'zou', 'zan', 'zen', 'zang', 'zeng', 'zong',
  'zu', 'zuo', 'zui', 'zuan', 'zun',
  // c
  'ca', 'ce', 'ci', 'cai', 'cao', 'cou', 'can', 'cen', 'cang', 'ceng', 'cong',
  'cu', 'cuo', 'cui', 'cuan', 'cun',
  // s
  'sa', 'se', 'si', 'sai', 'sao', 'sou', 'san', 'sen', 'sang', 'seng', 'song',
  'su', 'suo', 'sui', 'suan', 'sun',
])

/** 单词最少字符数；过短词（< 2）通常不能可靠分解为拼音 → 直接判 false */
const MIN_WORD_LEN = 2

/**
 * 拼音特征模式：含这些声母 / 韵母的单词极少在英文中出现完整匹配。
 * - 声母 zh / ch / sh / q / x / j（英文 "qi" "xi" "ji" 几乎不存在 / 卷舌音节)
 * - 复韵母 ang / eng / ong / iao / iong / iang / uang / üe（中文特征韵尾）
 *
 * 用于 title_en 质量门禁：所有基础音节（"ma" "ba" "na" 等）在英文中常见 →
 * 仅靠"能分解为拼音音节"会过度判定（"Ma Ma" / "Sushi" / "Naomi"
 * false-positive）。至少 1 个词含 distinctive feature 才判为拼音。
 */
const DISTINCTIVE_PINYIN_PATTERN = /(zh|ch|sh|q|x|j)|(ang|eng|ong|iao|iong|iang|uang|üe|ue|iu|ui|er)/

/**
 * DP 分解为拼音音节序列，返回**最少**音节数；不可完全分解返回 null。
 * （CHG-VIR-11-C 抽出供 canDecomposeAsPinyin / isConcatenatedPinyin 共用。
 *  原实现为贪心 longest-match，存在回溯缺陷：'dierji' 被贪心吃成 'die'+残留 'rji'
 *  误判不可分解〔正确分解 di-er-ji〕——DP 修复为完整可达性判定，方向 = 减少
 *  false-negative；isPinyin 在「词内贪心歧义」的罕见形态上命中率提升，护栏不变。）
 */
function decomposeSyllableCount(word: string): number | null {
  const lower = word.toLowerCase()
  if (lower.length < MIN_WORD_LEN) return null
  // 仅含 a-z（不含数字 / 标点 / 重音）
  if (!/^[a-z]+$/.test(lower)) return null

  const n = lower.length
  // dp[i] = 前缀 [0,i) 的最少音节数；Infinity = 不可达
  const dp = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY)
  dp[0] = 0
  for (let i = 0; i < n; i++) {
    if (dp[i]! === Number.POSITIVE_INFINITY) continue
    // 标准拼音音节最长 6 字符（'shuang' / 'zhuang'）
    for (let len = 1; len <= Math.min(6, n - i); len++) {
      if (PINYIN_SYLLABLES.has(lower.slice(i, i + len))) {
        dp[i + len] = Math.min(dp[i + len]!, dp[i]! + 1)
      }
    }
  }
  return dp[n] === Number.POSITIVE_INFINITY ? null : dp[n]!
}

/**
 * 尝试把单词按贪心 longest-match 分解为拼音音节序列。
 * 返回 true 表示能完全分解；false 表示有残留字符不在音节集合中。
 */
function canDecomposeAsPinyin(word: string): boolean {
  return decomposeSyllableCount(word) !== null
}

/** 至少 1 个词含拼音 distinctive feature → 防英文 false-positive */
function hasDistinctivePinyinFeature(words: readonly string[]): boolean {
  return words.some((w) => DISTINCTIVE_PINYIN_PATTERN.test(w.toLowerCase()))
}

/**
 * 判断输入字符串是否实际是中文拼音（而非真英文标题）。
 *
 * 判定规则（保守）：
 *   - 空 / 全空白 / 含数字 / 含非 ASCII → false
 *   - 至少 2 个词（单词输入太不可靠 / "Long" / "Chang" / "Sheng" 等英文姓名都能分解为
 *     合法拼音音节且含 distinctive feature → 词数 ≥ 2 大幅降低 false-positive）
 *   - 所有词必须能完全分解为合法拼音音节序列
 *   - 至少 1 词含拼音 distinctive feature（zh/ch/sh/q/x/j 声母 或 ang/eng/ong/iao/iong/iang/uang/üe 复韵母）
 *     → 防"Ma Ma" / "Naomi" 等英文词全是基础拼音音节的 false-positive
 *
 * @example
 *   isPinyin('Wo Bei Quan Wang Da Bao') // true（≥2 词 + 含 Quan q-、Wang ang）
 *   isPinyin('Da Hua Xi You')            // true（≥2 词 + 含 Xi x-）
 *   isPinyin('The Avengers')             // false（不能分解）
 *   isPinyin('Long')                     // false（单词输入 / 即使含 distinctive 也保守判 false）
 *   isPinyin('Sushi')                    // false（单词输入 / 保守）
 *   isPinyin('Wo Bei')                   // false（基础音节 / 无 distinctive / 保守判定）
 *   isPinyin('')                         // false
 */
export function isPinyin(input: string | null | undefined): boolean {
  if (!input) return false
  const trimmed = input.trim()
  if (!trimmed) return false

  // 含数字 / 非 ASCII 字符（中文 / 重音）→ 直接 false
  // 拼音标题不应含数字（年份 / 集数等线索说明这是混合元数据）
  if (/[\d]/.test(trimmed)) return false
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(trimmed)) return false

  // 拆词；strip 首尾标点（保留词内字母）
  const words = trimmed
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''))
    .filter((w) => w.length > 0)

  // 至少 2 个词（单词输入：英文姓名 "Long" / "Chang" / "Sheng" 都能分解 + 含 distinctive
  // → 单词模式不可靠 / Codex stop-time review #7 修复 / 多词标题才是拼音 title_en 的典型形态）
  if (words.length < 2) return false

  // 所有词必须能分解为合法拼音音节
  if (!words.every((w) => canDecomposeAsPinyin(w))) return false

  // 至少 1 词含 distinctive pinyin feature（zh/ch/sh/q/x/j 声母 或 复韵母）
  // → 防"Ma Ma" / "Naomi" 等英文词被误判（Codex stop-time review #6 修复）
  if (!hasDistinctivePinyinFeature(words)) return false

  return true
}

/** isConcatenatedPinyin 保守阈值：最少音节数 / 最少字符数（CHG-VIR-11-C） */
const MIN_CONCAT_SYLLABLES = 4
const MIN_CONCAT_LENGTH = 8

/**
 * 判断输入是否为**无空格连写拼音**（catalog 层 title_en 实际污染形态，如
 * "wuyanshashou" / "keaideniwugexiaohaidexiaochang"——爬虫 slug 形态）。
 *
 * 与 {@link isPinyin}（空格分隔 ≥2 词形态）互补，**不改其既有语义**；二者各自保守，
 * 消费方按需组合（CHG-VIR-11-C 拼音迁出脚本：`isPinyin(x) || isConcatenatedPinyin(x)`）。
 *
 * 判定规则（保守）：
 *   - trim 后单 token（含空白 → false，多词交给 isPinyin）
 *   - 全小写 ASCII 字母（含大写/数字/非 ASCII → false，混合大小写 slug 如 "moxuMAO"
 *     与含年份 slug 如 "maoxuewang2026" 均为元数据噪声而非罗马音，不迁）
 *   - 长度 ≥ 8 且能完全分解为 ≥ 4 个合法拼音音节（短串歧义大："wang"/"shang" 是英文词）
 *   - 含 distinctive pinyin feature（同 isPinyin 防英文 false-positive）
 *
 * 已知 false-positive：个别英文长词可完全分解（如 "manganese" = man-ga-ne-se）。
 * 真英文标题极少为单 token 无空格长词，且迁出可恢复（alias 保留 + 运营可改）；
 * 消费脚本默认 dry-run 列出全部命中供人工过目后再 --apply。
 *
 * @example
 *   isConcatenatedPinyin('wuyanshashou')   // true（wu-yan-sha-shou / 含 sh）
 *   isConcatenatedPinyin('moxuMAO')        // false（混合大小写）
 *   isConcatenatedPinyin('maoxuewang2026') // false（含数字）
 *   isConcatenatedPinyin('banana')         // false（长度 < 8）
 *   isConcatenatedPinyin('The Avengers')   // false（含空格 / 交给 isPinyin）
 */
export function isConcatenatedPinyin(input: string | null | undefined): boolean {
  if (!input) return false
  const trimmed = input.trim()
  if (trimmed.length < MIN_CONCAT_LENGTH) return false
  // 单 token 全小写 ASCII 字母（大写/数字/空白/标点/非 ASCII → false）
  if (!/^[a-z]+$/.test(trimmed)) return false

  const syllables = decomposeSyllableCount(trimmed)
  if (syllables === null || syllables < MIN_CONCAT_SYLLABLES) return false

  return DISTINCTIVE_PINYIN_PATTERN.test(trimmed)
}

/**
 * `title_en` / 罗马音字段「是否实际是中文拼音（而非真英文标题）」的**正典组合谓词**——
 * {@link isPinyin}（空格分隔 ≥2 词形态，如 "Wo Bei Quan Wang"）∪
 * {@link isConcatenatedPinyin}（无空格连写 slug 形态，如 "tabiqiannanyouzhire"），二者各自保守。
 *
 * 两类污染形态在 `title_en` 真实并存（采集源 `vod_en` 既有空格分词全拼、也有无空格 slug）。
 * 既有 catalog 迁出脚本（`scripts/catalog-multilingual-cleanup.ts`）按红线-2 在 catalog 层
 * **独立**拼这两判定；本谓词把同一口径沉淀为单一真源供**入库侧**（`SourceParserService`
 * vod_en → title_en 门禁）复用，避免判定漂移。catalog 迁出脚本不强制改用（红线-2 独立性保留）。
 */
export function isPinyinTitle(input: string | null | undefined): boolean {
  if (isPinyin(input) || isConcatenatedPinyin(input)) return true
  // CHG-VIR-11-E 数字盲区：季数/年份嵌入的连写拼音（如 "geleisidi6ji"=格雷斯第6季 /
  // "...dangshidi4ji"=第4季）——isConcatenatedPinyin 的 `^[a-z]+$` 拒绝含数字串而漏判。
  // 剥离数字后再测无空格拼音；短串/<4 音节仍由 isConcatenatedPinyin 阈值放过（"miqing2025"→"miqing" 2 音节不判）。
  if (input) {
    const trimmed = input.trim()
    const stripped = trimmed.replace(/[0-9]/g, '')
    if (stripped.length !== trimmed.length && isConcatenatedPinyin(stripped)) return true
  }
  return false
}
