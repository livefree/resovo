/* global React, I, Icon, VIDEOS, SITES, poster, DualSignal, VisChip, Spark */
const { useState, useEffect, useRef, useMemo } = React;

/* ── Platform detect (Mac vs other) ──────────────────────── */
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
const MOD = IS_MAC ? "⌘" : "Ctrl";
const kbd = (s) => s.replace(/⌘/g, MOD);

/* ── Sidebar ─────────────────────────────────────────────── */
const NAV = [
  { group: "运营中心", items: [
    { id: "dashboard",  icon: I.layers, label: "管理台站", count: null,           shortcut: "⌘1" },
    { id: "moderation", icon: I.inbox,  label: "内容审核", count: 484, type:"warn", shortcut: "⌘2" },
  ]},
  { group: "内容资产", items: [
    { id: "videos",      icon: I.film,  label: "视频库",   count: 695,             shortcut: "⌘3" },
    { id: "sources",     icon: I.link,  label: "播放线路", count: 1939, type:"danger" },
    { id: "merge",       icon: I.merge, label: "合并拆分", count: 6,    type:"warn" },
    { id: "subtitles",   icon: I.doc,   label: "字幕管理", count: null,            shortcut: "⌘4" },
    { id: "image-health",icon: I.image, label: "图片健康", count: 597,  type:"warn" },
  ]},
  { group: "首页运营", items: [
    { id: "home",        icon: I.banner, label: "首页编辑", count: null },
    { id: "submissions", icon: I.flag,   label: "用户投稿", count: 12 },
  ]},
  { group: "采集中心", items: [
    { id: "crawler",     icon: I.spider, label: "采集控制", count: null,           shortcut: "⌘5" },
    { id: "staging",     icon: I.upload, label: "待发布",   count: 23 },
  ]},
  { group: "系统管理", items: [
    { id: "users",       icon: I.users,    label: "用户管理", count: null },
    { id: "settings",    icon: I.settings, label: "站点设置", count: null,         shortcut: "⌘," },
    { id: "audit",       icon: I.doc,      label: "审计日志", count: null },
  ]},
];

/* tooltip — collapsed-state only, label + shortcut */
const NavTip = ({ label, shortcut }) => (
  <span className="sb__tip" role="tooltip">
    {label}
    {shortcut && <span className="sb__tip-kbd">{kbd(shortcut)}</span>}
  </span>
);

const Sidebar = ({ active, onNav, collapsed, onToggle }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (!e.target.closest(".sb__foot") && !e.target.closest(".sb__menu")) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);
  return (
  <aside className={`sb ${collapsed ? "sb--collapsed" : ""}`}>
    <div className="sb__brand">
      <div className="sb__logo">流</div>
      {!collapsed && (
        <div>
          <div className="sb__name">流光后台 <small>v2</small></div>
        </div>
      )}
    </div>
    <div className="sb__scroll" style={{padding: "8px 0 12px"}}>
      {NAV.map((g) => (
        <div className="sb__section" key={g.group}>
          {!collapsed && <h4>{g.group}</h4>}
          {collapsed && <div className="sb__divider" />}
          {g.items.map((it) => (
            <a
              key={it.id}
              className={`sb__link ${active === it.id ? "is-active" : ""}`}
              onClick={(e) => { e.preventDefault(); onNav?.(it.id); }}
              aria-label={it.label}
            >
              <span className="sb__icon">{it.icon}</span>
              {!collapsed && <span style={{flex:1}}>{it.label}</span>}
              {!collapsed && it.count != null && (
                <span className={`sb__count ${it.type === "warn" ? "is-warn" : it.type === "danger" ? "is-danger" : ""}`}>
                  {it.count > 999 ? `${(it.count/1000).toFixed(1)}k` : it.count}
                </span>
              )}
              {collapsed && it.count != null && (
                <span className={`sb__pip ${it.type === "warn" ? "is-warn" : it.type === "danger" ? "is-danger" : ""}`} />
              )}
              {collapsed && <NavTip label={it.label} shortcut={it.shortcut} />}
            </a>
          ))}
        </div>
      ))}
    </div>
    <div className="sb__collapse" onClick={onToggle} title={collapsed ? "展开侧栏" : "收起侧栏"}>
      <span>{collapsed ? (I.chevRight || "››") : (I.chevLeft || "‹‹")}</span>
      {!collapsed && <span className="sb__collapse-label">收起边栏</span>}
      {!collapsed && <span className="sb__collapse-kbd"><span className="kbd">{IS_MAC ? "⌘" : "Ctrl"}</span><span className="kbd">B</span></span>}
      {collapsed && <NavTip label="展开侧栏" shortcut="⌘B" />}
    </div>
    <div className="sb__foot" onClick={() => setMenuOpen(o => !o)}>
      <div className="sb__avatar">YL</div>
      {!collapsed && (
        <>
          <div className="sb__user-meta">
            <div className="sb__user-name">Yan Liu</div>
            <div className="sb__user-role">管理员 · admin</div>
          </div>
          <span className="sb__user-chev">{menuOpen ? "▴" : "▾"}</span>
        </>
      )}
      {collapsed && <NavTip label="Yan Liu · 账户" shortcut="" />}
      {menuOpen && (
        <div className="sb__menu" onClick={(e) => e.stopPropagation()}>
          <div className="sb__menu-header">
            <div className="n">Yan Liu</div>
            <div className="e">yan@resovo.io · 管理员</div>
          </div>
          <div className="sb__menu-item"><span className="ico">○</span>个人资料</div>
          <div className="sb__menu-item"><span className="ico">⚙</span>偏好设置</div>
          <div className="sb__menu-item"><span className="ico">🌗</span>主题切换</div>
          <div className="sb__menu-sep"></div>
          <div className="sb__menu-item"><span className="ico">?</span>帮助 · 快捷键</div>
          <div className="sb__menu-item"><span className="ico">⇄</span>切换账号</div>
          <div className="sb__menu-sep"></div>
          <div className="sb__menu-item is-danger"><span className="ico">⏻</span>登出</div>
        </div>
      )}
    </div>
  </aside>
  );
};

/* ── Topbar ──────────────────────────────────────────────── */
const Topbar = ({ crumbs = [], onSearch, theme, onTheme, health }) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const runningTasks = 2; // mock
  return (
  <div className="tb">
    <div className="tb__crumbs">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="tb__crumb-sep">/</span>}
          {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
        </React.Fragment>
      ))}
    </div>
    <div style={{flex:1}} />
    <div className="tb__search" onClick={onSearch}>
      <span style={{color:"var(--muted)"}}>{I.search}</span>
      <span className="tb__search-input">搜索视频 / 播放源 / 任务…</span>
      <span className="kbd">{IS_MAC ? "⌘" : "Ctrl"}</span><span className="kbd">K</span>
    </div>
    {health && (
      <div className="tb__health">
        <div className="tb__health-item"><span className="tb__health-dot pulse" style={{background:"var(--ok)"}}/>采集 33/40</div>
        <div className="tb__health-item"><span className="tb__health-dot" style={{background:"var(--warn)"}}/>失效 1.3%</div>
        <div className="tb__health-item"><span className="tb__health-dot" style={{background:"var(--danger)"}}/>待审 484</div>
      </div>
    )}
    <div className="tb__right">
      <div className="tb__icon-btn" onClick={onTheme} title={theme === "dark" ? "切到浅色" : "切到深色"}>
        {theme === "dark" ? I.sun : I.moon}
      </div>
      <div className="tb__icon-btn" title="任务" onClick={() => { setTasksOpen(o => !o); setNotifOpen(false); }} style={{position:"relative"}}>
        {I.zap}
        {runningTasks > 0 && <span className="dot" style={{background:"var(--ok)"}} />}
      </div>
      <div className="tb__icon-btn" title="通知" onClick={() => { setNotifOpen(o => !o); setTasksOpen(false); }} style={{position:"relative"}}>
        {I.bell}
        <span className="dot" />
      </div>
      <div className="tb__icon-btn" title="设置">{I.settings}</div>
    </div>
    {typeof NotifPanel !== "undefined" && <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)} />}
    {typeof TasksPanel !== "undefined" && <TasksPanel open={tasksOpen} onClose={() => setTasksOpen(false)} />}
  </div>
  );
};

/* ── Cmd+K palette ───────────────────────────────────────── */
const CMDS = [
  { group: "导航", items: [
    { icon: I.inbox, label: "前往 内容审核台", meta: "G then M", action: "moderation" },
    { icon: I.upload, label: "前往 暂存发布队列", meta: "G then S", action: "staging" },
    { icon: I.film, label: "前往 视频库", meta: "G then V", action: "videos" },
    { icon: I.link, label: "前往 播放源 / 线路", meta: "G then L", action: "sources" },
    { icon: I.spider, label: "前往 采集控制台", meta: "G then C", action: "crawler" },
  ]},
  { group: "快捷操作", items: [
    { icon: I.zap, label: "批量验证当前列表所有失效源", meta: "Shift+V" },
    { icon: I.refresh, label: "全站全量采集", meta: "" },
    { icon: I.split, label: "新建合并拆分工单", meta: "" },
    { icon: I.banner, label: "新增首页 Banner", meta: "" },
  ]},
  { group: "搜索结果", items: [
    { icon: I.film, label: "危险关系 (2012, 电影)", meta: "ID v1 · 7 sources" },
    { icon: I.film, label: "危险关系 2024 (电影)", meta: "ID v2 · 4 sources" },
    { icon: I.link, label: "cj.lzcaiji.com / S1E1", meta: "v.lzcdn31.com/…" },
  ]},
];

const CmdK = ({ open, onClose, onAction }) => {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => {
    const flat = CMDS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
    return flat.filter((it) => !q || it.label.toLowerCase().includes(q.toLowerCase()));
  }, [q]);
  useEffect(() => { setActive(0); }, [q]);
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal cmdk" onClick={(e) => e.stopPropagation()} style={{paddingTop:0, paddingBottom:0}}>
        <input
          autoFocus
          className="cmdk__input"
          placeholder="输入命令、视频名、URL、shortId…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { setActive((a) => Math.min(a + 1, filtered.length - 1)); e.preventDefault(); }
            if (e.key === "ArrowUp") { setActive((a) => Math.max(a - 1, 0)); e.preventDefault(); }
            if (e.key === "Enter") { onAction?.(filtered[active]); onClose?.(); }
            if (e.key === "Escape") onClose?.();
          }}
        />
        <div className="cmdk__list">
          {CMDS.map((g) => {
            const items = g.items.filter((it) => !q || it.label.toLowerCase().includes(q.toLowerCase()));
            if (!items.length) return null;
            return (
              <div key={g.group}>
                <div className="cmdk__group-label">{g.group}</div>
                {items.map((it, idx) => {
                  const flatIdx = filtered.indexOf(filtered.find((f) => f.label === it.label));
                  return (
                    <div
                      key={it.label}
                      className={`cmdk__row ${flatIdx === active ? "is-active" : ""}`}
                      onMouseEnter={() => setActive(flatIdx)}
                      onClick={() => { onAction?.(it); onClose?.(); }}
                    >
                      <span className="cmdk__row-icon">{it.icon}</span>
                      <span className="cmdk__row-label">{it.label}</span>
                      {it.meta && <span className="cmdk__row-meta">{it.meta}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="cmdk__foot">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> 移动</span>
          <span><span className="kbd">↵</span> 选择</span>
          <span><span className="kbd">esc</span> 关闭</span>
          <span style={{marginLeft:"auto"}}>提示：输入 <code>v:</code> 搜视频，<code>u:</code> 搜 URL，<code>!</code> 走命令</span>
        </div>
      </div>
    </div>
  );
};

/* ── Reusable shell ──────────────────────────────────────── */
const AdminShell = ({ active, onNav, crumbs, children, theme, onTheme, showHealth = true }) => {
  const [cmd, setCmd] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sb-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("sb-collapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "k") { e.preventDefault(); setCmd(true); return; }
      if (mod && (e.key === "b" || e.key === "B")) { e.preventDefault(); setCollapsed((c)=>!c); return; }
      if (mod && /^[1-5]$/.test(e.key)) {
        const map = { "1":"dashboard","2":"moderation","3":"videos","4":"subtitles","5":"crawler" };
        if (map[e.key]) { e.preventDefault(); onNav?.(map[e.key]); }
        return;
      }
      if (e.key === "Escape") setCmd(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNav]);
  return (
    <div className="app">
      <Sidebar active={active} onNav={onNav} collapsed={collapsed} onToggle={() => setCollapsed((c)=>!c)} />
      <main className="main">
        <Topbar crumbs={crumbs} theme={theme} onTheme={onTheme} health={showHealth} onSearch={() => setCmd(true)} />
        <div className="page">{children}</div>
      </main>
      <CmdK open={cmd} onClose={() => setCmd(false)} onAction={(it) => it.action && onNav?.(it.action)} />
    </div>
  );
};

Object.assign(window, { Sidebar, Topbar, CmdK, AdminShell, NAV, IS_MAC, MOD, kbd });
