/**
 * theme-init-script.ts — TOKEN-11
 *
 * 生成注入到 <head> 首个位置的 blocking inline script 字符串。
 * 在 React hydration 之前同步读取 cookie，设置 <html data-brand data-theme>，
 * 防止 FOUC（首屏主题闪烁）。
 *
 * 策略：
 *   1. 读 cookie resovo-brand → data-brand（默认 'resovo'）
 *   2. 读 URL query ?_theme=light|dark|system → data-theme（HANDOFF-03，截图用途，优先级高于 cookie）
 *   3. 读 cookie resovo-theme → data-theme（system → matchMedia 解析）
 *   4. 主题/品牌不使用 localStorage，仅用 cookie（与 middleware 同源）
 *   5. 读 localStorage resovo:bg-pattern → data-bg-pattern（HANDOFF-42，纯客户端视觉偏好，
 *      首绘前同步设属性消除底纹 FOUC；默认 'dots' 与设计稿一致；key 与 lib/bg-pattern.ts
 *      的 BG_PATTERN_STORAGE_KEY 保持一致——inline 脚本无法 import 故字面量重复）
 */

export const THEME_INIT_SCRIPT = `(function(){
  var BRAND_COOKIE = 'resovo-brand';
  var THEME_COOKIE = 'resovo-theme';
  var QUERY_THEME_KEY = '_theme';
  var BG_PATTERN_KEY = 'resovo:bg-pattern';
  var DEFAULT_BRAND = 'resovo';
  var DEFAULT_BG_PATTERN = 'dots';
  var VALID_THEMES = { light: 1, dark: 1, system: 1 };
  var VALID_PATTERNS = { none: 1, dots: 1, grid: 1, noise: 1 };
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
  }
  function getQueryTheme() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = params.get(QUERY_THEME_KEY);
      return raw && VALID_THEMES[raw] ? raw : undefined;
    } catch (e) { return undefined; }
  }
  function resolveTheme(t) {
    if (t === 'system' || !t || !VALID_THEMES[t]) {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t;
  }
  function getBgPattern() {
    try {
      var raw = window.localStorage.getItem(BG_PATTERN_KEY);
      return raw && VALID_PATTERNS[raw] ? raw : DEFAULT_BG_PATTERN;
    } catch (e) { return DEFAULT_BG_PATTERN; }
  }
  var brand = getCookie(BRAND_COOKIE) || DEFAULT_BRAND;
  var rawTheme = getQueryTheme() || getCookie(THEME_COOKIE);
  var theme = resolveTheme(rawTheme);
  var el = document.documentElement;
  el.dataset.brand = brand;
  el.dataset.theme = theme;
  el.dataset.bgPattern = getBgPattern();
})();`
