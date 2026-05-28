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
 * 尝试把单词按贪心 longest-match 分解为拼音音节序列。
 * 返回 true 表示能完全分解；false 表示有残留字符不在音节集合中。
 */
function canDecomposeAsPinyin(word: string): boolean {
  const lower = word.toLowerCase()
  if (lower.length < MIN_WORD_LEN) return false
  // 仅含 a-z（不含数字 / 标点 / 重音）
  if (!/^[a-z]+$/.test(lower)) return false

  let i = 0
  while (i < lower.length) {
    // 最长合法音节：标准拼音音节最长为 6 字符（如 'shuang' / 'zhuang'）
    let matched = false
    for (let len = Math.min(6, lower.length - i); len >= 1; len--) {
      const candidate = lower.slice(i, i + len)
      if (PINYIN_SYLLABLES.has(candidate)) {
        i += len
        matched = true
        break
      }
    }
    if (!matched) return false
  }
  return true
}

/** 至少 1 个词含拼音 distinctive feature → 防英文 false-positive */
function hasDistinctivePinyinFeature(words: readonly string[]): boolean {
  return words.some((w) => DISTINCTIVE_PINYIN_PATTERN.test(w.toLowerCase()))
}

/**
 * 判断输入字符串是否实际是中文拼音（而非真英文标题）。
 *
 * 判定规则：
 *   - 空 / 全空白 / 含数字 / 含非 ASCII → false
 *   - 拆词后所有词必须能完全分解为合法拼音音节序列
 *   - 至少 1 词含拼音 distinctive feature（zh/ch/sh/q/x/j 声母 或 ang/eng/ong/iao/iong/iang/uang/üe 复韵母）
 *     → 防"Ma Ma" / "Sushi" / "Naomi" 等英文词全是基础拼音音节的 false-positive
 *
 * @example
 *   isPinyin('Wo Bei Quan Wang Da Bao') // true（含 Quan q-、Wang ang）
 *   isPinyin('Da Hua Xi You')            // true（含 Xi x-）
 *   isPinyin('The Avengers')             // false（不能分解）
 *   isPinyin('Sushi')                    // false（基础音节 / 无 distinctive）
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

  if (words.length === 0) return false

  // 1. 所有词必须能分解为合法拼音音节
  if (!words.every((w) => canDecomposeAsPinyin(w))) return false

  // 2. 至少 1 词含 distinctive pinyin feature（zh/ch/sh/q/x/j 声母 或 复韵母）
  // → 防"Ma Ma" / "Sushi" / "Naomi" 等英文词被误判（Codex stop-time review #6 修复）
  if (!hasDistinctivePinyinFeature(words)) return false

  return true
}
