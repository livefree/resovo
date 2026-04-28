/* global React, I, Icon */
/* §08 — Notifications panel, Background tasks panel, Toast system */
const { useState: nUS, useEffect: nUE, useRef: nUR, useCallback: nUC } = React;

/* ── Notification Panel (from bell icon) ──────────────── */
const NOTIF_DATA = [
  { id:"n1", type:"danger", icon: I.alert, title:"采集站点「电影天堂」连续 3 次失败", desc:"最后成功：4 小时前 · 建议检查域名/IP", time:"2 分钟前", read:false, action:"诊断" },
  { id:"n2", type:"warn", icon: I.image, title:"img3.doubanio.com 封面批量 404", desc:"影响 231 张封面 · 建议切换 fallback 域", time:"18 分钟前", read:false, action:"处理" },
  { id:"n3", type:"ok", icon: I.check, title:"全站采集完成 · 40 站 33 成功", desc:"+47 视频 · +112 源 · 7 站失败", time:"24 分钟前", read:false, action:"查看" },
  { id:"n4", type:"info", icon: I.merge, title:"自动合并候选：危险关系 2024 ← cat-17", desc:"置信度 88% · 需人工确认", time:"1 小时前", read:true, action:"审核" },
  { id:"n5", type:"warn", icon: I.banner, title:"首页 Banner「阿凡达」将在 2 天后过期", desc:"建议准备替换素材", time:"3 小时前", read:true, action:"编辑" },
  { id:"n6", type:"info", icon: I.flag, title:"新投稿：用户 @user_4218 举报线路黑屏", desc:"危险关系 EP3 线路 2", time:"5 小时前", read:true, action:"查看" },
  { id:"n7", type:"ok", icon: I.upload, title:"批量发布完成 · 6 条视频上架", desc:"全部通过预检", time:"昨天", read:true, action:null },
  { id:"n8", type:"info", icon: I.settings, title:"系统：豆瓣 Cookie 将在 7 天后过期", desc:"建议提前续期", time:"昨天", read:true, action:"设置" },
];

const NotifPanel = ({ open, onClose, anchor }) => {
  const ref = nUR(null);
  const [filter, setFilter] = nUS("all"); // all | unread
  const [notifs, setNotifs] = nUS(NOTIF_DATA);

  nUE(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.tb__icon-btn[title="通知"]')) onClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  if (!open) return null;

  const unreadCount = notifs.filter(n => !n.read).length;
  const filtered = filter === "unread" ? notifs.filter(n => !n.read) : notifs;
  const markAllRead = () => setNotifs(ns => ns.map(n => ({...n, read: true})));
  const markRead = (id) => setNotifs(ns => ns.map(n => n.id === id ? {...n, read: true} : n));

  return (
    <div ref={ref} style={{
      position:"absolute", top: "calc(var(--topbar-h) - 4px)", right: 60,
      width: 400, maxHeight: "70vh",
      background:"var(--bg4)", border:"1px solid var(--border-strong)",
      borderRadius:"var(--r-4)", boxShadow:"var(--shadow-lg)",
      display:"flex", flexDirection:"column", overflow:"hidden",
      zIndex: 80
    }}>
      {/* Header */}
      <div style={{padding:"12px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8}}>
        <span style={{fontSize:14, fontWeight:700}}>通知</span>
        {unreadCount > 0 && <span className="pill pill--danger" style={{fontSize:10}}><span className="dot"/>{unreadCount} 未读</span>}
        <span style={{flex:1}}/>
        <button className="btn btn--xs" onClick={markAllRead}>全部已读</button>
      </div>

      {/* Filter */}
      <div style={{padding:"6px 14px", display:"flex", gap:4}}>
        <div className="seg">
          <span className={`seg__btn ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>全部</span>
          <span className={`seg__btn ${filter === "unread" ? "is-active" : ""}`} onClick={() => setFilter("unread")}>未读 <span className="badge">{unreadCount}</span></span>
        </div>
      </div>

      {/* List */}
      <div style={{flex:1, overflowY:"auto"}}>
        {filtered.length === 0 && (
          <div style={{padding:"40px 20px", textAlign:"center", color:"var(--muted)", fontSize:12}}>没有{filter === "unread" ? "未读" : ""}通知</div>
        )}
        {filtered.map((n) => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            style={{
              display:"flex", gap:10, padding:"10px 14px",
              borderBottom:"1px solid var(--border-subtle)",
              cursor:"pointer", transition:"background .1s",
              background: !n.read ? `var(--${n.type}-soft)` : "transparent"
            }}
            onMouseOver={(e) => e.currentTarget.style.background = "var(--bg3)"}
            onMouseOut={(e) => e.currentTarget.style.background = !n.read ? `var(--${n.type}-soft)` : "transparent"}
          >
            <div style={{
              width:28, height:28, borderRadius:6, flexShrink:0,
              background:`var(--${n.type}-soft)`, color:`var(--${n.type})`,
              display:"grid", placeItems:"center"
            }}>{n.icon}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, fontWeight: n.read ? 500 : 600, display:"flex", alignItems:"center", gap:6}}>
                <span style={{flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{n.title}</span>
                {!n.read && <span style={{width:6, height:6, borderRadius:"50%", background:"var(--accent)", flexShrink:0}}/>}
              </div>
              <div style={{fontSize:11, color:"var(--muted)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{n.desc}</div>
              <div style={{display:"flex", alignItems:"center", gap:6, marginTop:4}}>
                <span style={{fontSize:10, color:"var(--muted-2)"}}>{n.time}</span>
                {n.action && <button className="btn btn--xs" onClick={(e) => e.stopPropagation()}>{n.action}</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{padding:"8px 14px", borderTop:"1px solid var(--border)", textAlign:"center"}}>
        <button className="btn btn--xs btn--ghost" style={{width:"100%", justifyContent:"center"}}>查看所有通知</button>
      </div>
    </div>
  );
};

/* ── Background Tasks Panel ───────────────────────────── */
const TASKS_DATA = [
  { id:"t1", type:"crawl", label:"全站全量采集", status:"running", progress:82, detail:"33/40 站完成 · +47 视频 · ETA 45s", started:"2 分钟前" },
  { id:"t2", type:"verify", label:"批量验证失效源", status:"running", progress:41, detail:"794/1939 已验 · 回收 12 条", started:"5 分钟前" },
  { id:"t3", type:"publish", label:"批量发布 · 6 条", status:"done", progress:100, detail:"全部成功上架", started:"38 分钟前" },
  { id:"t4", type:"crawl", label:"增量采集 · 豆瓣资源", status:"done", progress:100, detail:"+12 视频 · 42s", started:"1 小时前" },
  { id:"t5", type:"export", label:"导出 CSV · 视频库", status:"done", progress:100, detail:"695 条 · 1.2MB", started:"3 小时前" },
  { id:"t6", type:"crawl", label:"全量采集 · 电影天堂", status:"failed", progress:67, detail:"超时 · 3 次重试失败", started:"4 小时前" },
];

const taskIcon = (type) => {
  const map = { crawl: I.spider, verify: I.refresh, publish: I.upload, export: I.download };
  return map[type] || I.zap;
};

const TasksPanel = ({ open, onClose }) => {
  const ref = nUR(null);
  const [filter, setFilter] = nUS("all");

  nUE(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.tb__icon-btn[title="任务"]')) onClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  if (!open) return null;

  const running = TASKS_DATA.filter(t => t.status === "running");
  const filtered = filter === "running" ? running : TASKS_DATA;

  return (
    <div ref={ref} style={{
      position:"absolute", top:"calc(var(--topbar-h) - 4px)", right:16,
      width:400, maxHeight:"70vh",
      background:"var(--bg4)", border:"1px solid var(--border-strong)",
      borderRadius:"var(--r-4)", boxShadow:"var(--shadow-lg)",
      display:"flex", flexDirection:"column", overflow:"hidden",
      zIndex:80
    }}>
      <div style={{padding:"12px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8}}>
        <span style={{fontSize:14, fontWeight:700}}>后台任务</span>
        {running.length > 0 && <span className="pill pill--ok" style={{fontSize:10}}><span className="dot pulse"/>{running.length} 运行中</span>}
        <span style={{flex:1}}/>
      </div>

      <div style={{padding:"6px 14px", display:"flex", gap:4}}>
        <div className="seg">
          <span className={`seg__btn ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>全部</span>
          <span className={`seg__btn ${filter === "running" ? "is-active" : ""}`} onClick={() => setFilter("running")}>运行中 <span className="badge">{running.length}</span></span>
        </div>
      </div>

      <div style={{flex:1, overflowY:"auto"}}>
        {filtered.map((t) => {
          const statusColor = t.status === "running" ? "accent" : t.status === "done" ? "ok" : "danger";
          const statusLabel = t.status === "running" ? "运行中" : t.status === "done" ? "完成" : "失败";
          return (
            <div key={t.id} style={{padding:"10px 14px", borderBottom:"1px solid var(--border-subtle)"}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <div style={{width:24, height:24, borderRadius:4, background:`var(--${statusColor}-soft)`, color:`var(--${statusColor})`, display:"grid", placeItems:"center", flexShrink:0}}>{taskIcon(t.type)}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{t.label}</div>
                </div>
                <span className={`pill pill--${statusColor}`} style={{fontSize:10}}>
                  <span className={`dot ${t.status === "running" ? "pulse" : ""}`}/>{statusLabel}
                </span>
              </div>
              {/* Progress bar */}
              <div style={{marginTop:6, display:"flex", alignItems:"center", gap:8}}>
                <div style={{flex:1, height:4, background:"var(--bg3)", borderRadius:999, overflow:"hidden"}}>
                  <div style={{
                    width:`${t.progress}%`, height:"100%",
                    background:`var(--${statusColor})`,
                    borderRadius:999,
                    transition:"width .3s",
                    ...(t.status === "running" ? {animation:"task-pulse 1.5s ease-in-out infinite"} : {})
                  }}/>
                </div>
                <span style={{fontSize:10, color:"var(--muted)", fontWeight:600, minWidth:32, textAlign:"right"}}>{t.progress}%</span>
              </div>
              <div style={{marginTop:4, display:"flex", alignItems:"center", gap:8}}>
                <span style={{fontSize:10, color:"var(--muted)", flex:1}}>{t.detail}</span>
                <span style={{fontSize:10, color:"var(--muted-2)"}}>{t.started}</span>
                {t.status === "failed" && <button className="btn btn--xs">{I.refresh} 重试</button>}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes task-pulse { 0%,100% { opacity:1; } 50% { opacity:.7; } }`}</style>
    </div>
  );
};

/* ── Toast System ─────────────────────────────────────── */
let _toastId = 0;
const _toastListeners = new Set();
let _toasts = [];

const addToast = (msg, type = "info", duration = 4000) => {
  const id = ++_toastId;
  const toast = { id, msg, type, duration, visible: true };
  _toasts = [..._toasts, toast];
  _toastListeners.forEach(fn => fn([..._toasts]));
  if (duration > 0) {
    setTimeout(() => {
      _toasts = _toasts.map(t => t.id === id ? {...t, visible: false} : t);
      _toastListeners.forEach(fn => fn([..._toasts]));
      setTimeout(() => {
        _toasts = _toasts.filter(t => t.id !== id);
        _toastListeners.forEach(fn => fn([..._toasts]));
      }, 300);
    }, duration);
  }
  return id;
};
window.addToast = addToast;

const dismissToast = (id) => {
  _toasts = _toasts.map(t => t.id === id ? {...t, visible: false} : t);
  _toastListeners.forEach(fn => fn([..._toasts]));
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id);
    _toastListeners.forEach(fn => fn([..._toasts]));
  }, 300);
};

const ToastContainer = () => {
  const [toasts, setToasts] = nUS([]);
  nUE(() => {
    _toastListeners.add(setToasts);
    return () => _toastListeners.delete(setToasts);
  }, []);

  if (!toasts.length) return null;

  const iconMap = { ok: I.check, danger: I.alert, warn: I.alert, info: I.bell };

  return (
    <div style={{position:"fixed", bottom:20, right:20, zIndex:300, display:"flex", flexDirection:"column-reverse", gap:8, maxWidth:380}}>
      <style>{`
        @keyframes toast-in { from { transform: translateX(40px); opacity:0; } to { transform: translateX(0); opacity:1; } }
        @keyframes toast-out { from { transform: translateX(0); opacity:1; } to { transform: translateX(40px); opacity:0; } }
      `}</style>
      {toasts.map(t => (
        <div key={t.id} style={{
          display:"flex", alignItems:"center", gap:10,
          padding:"10px 14px",
          background:"var(--bg4)", border:`1px solid var(--${t.type === "ok" ? "ok" : t.type === "danger" ? "danger" : t.type === "warn" ? "warn" : "border-strong"})`,
          borderRadius:"var(--r-3)", boxShadow:"var(--shadow-lg)",
          animation: t.visible ? "toast-in .2s ease" : "toast-out .25s ease forwards",
          fontSize:12
        }}>
          <span style={{color:`var(--${t.type})`, flexShrink:0}}>{iconMap[t.type] || I.bell}</span>
          <span style={{flex:1}}>{t.msg}</span>
          <span style={{color:"var(--muted)", cursor:"pointer", flexShrink:0}} onClick={() => dismissToast(t.id)}>{I.x}</span>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, { NotifPanel, TasksPanel, ToastContainer, addToast, dismissToast });
