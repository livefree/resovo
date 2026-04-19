/**
 * theme-init-script.ts — TOKEN-11
 *
 * 生成注入到 <head> 首个位置的 blocking inline script 字符串。
 * 在 React hydration 之前同步读取 cookie，设置 <html data-brand data-theme>，
 * 防止 FOUC（首屏主题闪烁）。
 *
 * 策略：
 *   1. 读 cookie resovo-brand → data-brand（默认 'resovo'）
 *   2. 读 cookie resovo-theme → data-theme（system → matchMedia 解析）
 *   3. 不使用 localStorage，仅用 cookie（与 middleware 同源）
 */

export const THEME_INIT_SCRIPT = `(function(){
  var BRAND_COOKIE = 'resovo-brand';
  var THEME_COOKIE = 'resovo-theme';
  var DEFAULT_BRAND = 'resovo';
  var VALID_THEMES = { light: 1, dark: 1, system: 1 };
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
  }
  function resolveTheme(t) {
    if (t === 'system' || !t || !VALID_THEMES[t]) {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t;
  }
  var brand = getCookie(BRAND_COOKIE) || DEFAULT_BRAND;
  var rawTheme = getCookie(THEME_COOKIE);
  var theme = resolveTheme(rawTheme);
  var el = document.documentElement;
  el.dataset.brand = brand;
  el.dataset.theme = theme;
})();`
