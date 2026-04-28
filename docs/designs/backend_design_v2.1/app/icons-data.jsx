/* global React */
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

/* ── Icons (inline SVG strokes, currentColor) ────────────────────── */
const Icon = ({ d, size = 16, fill, stroke = "currentColor", strokeWidth = 1.6, viewBox = "0 0 24 24", ...rest }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill || "none"} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);
const I = {
  search:    <Icon d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />,
  bell:      <Icon d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Zm4 13a2 2 0 0 0 4 0" />,
  cmd:       <Icon d="M9 3a3 3 0 1 0 0 6h6a3 3 0 1 0 0-6 3 3 0 0 0-3 3v12a3 3 0 0 0 6 0 3 3 0 0 0-3-3H9a3 3 0 1 0 3 3" />,
  settings:  <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.4a7 7 0 0 0-2 1.2l-2.4-.8-2 3.5 2 1.5A7 7 0 0 0 5 12l-2 1.5 2 3.5 2.4-.8a7 7 0 0 0 2 1.2L10 21h4l.5-2.4a7 7 0 0 0 2-1.2l2.4.8 2-3.5-2-1.5c.07-.4.1-.8.1-1.2Z" />,
  moon:      <Icon d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  sun:       <Icon d="M12 4V2m0 20v-2M4 12H2m20 0h-2m-3-7-1.4 1.4M6.4 17.6 5 19m12 0-1.4-1.4M6.4 6.4 5 5m7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />,
  layers:    <Icon d="M12 3 2 8l10 5 10-5-10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5" />,
  film:      <Icon d="M3 4h18v16H3zM7 4v16M17 4v16M3 8h4m10 0h4M3 12h4m10 0h4M3 16h4m10 0h4" />,
  link:      <Icon d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1m1 9a5 5 0 0 1-7 0l-3-3a5 5 0 0 1 7-7l1 1" />,
  check:     <Icon d="M20 6 9 17l-5-5" />,
  x:         <Icon d="M18 6 6 18M6 6l18 18" viewBox="0 0 24 24" />,
  inbox:     <Icon d="M3 13h6l2 3h4l2-3h6m-18 0V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8m-18 0v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" />,
  upload:    <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  spider:    <Icon d="M12 8v8m-4-8L4 4m4 4-4 4m4 4-4 4m12-12 4-4m-4 4 4 4m-4 4 4 4M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />,
  image:     <Icon d="M3 5h18v14H3zM3 16l5-5 5 5 4-4 4 4M9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
  users:     <Icon d="M16 11a4 4 0 1 0-8 0m12 9a8 8 0 1 0-16 0" />,
  bar:       <Icon d="M3 21V8m6 13V3m6 18v-7m6 7v-12" />,
  banner:    <Icon d="M3 5h18v6H3zM3 13h18v6H3z" />,
  filter:    <Icon d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />,
  refresh:   <Icon d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4" />,
  more:      <Icon d="M5 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm6 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm6 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" fill="currentColor" stroke="none" />,
  play:      <Icon d="M6 4l14 8L6 20V4Z" fill="currentColor" stroke="currentColor" />,
  pause:     <Icon d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" stroke="none" />,
  chevR:     <Icon d="M9 6l6 6-6 6" />,
  chevD:     <Icon d="M6 9l6 6 6-6" />,
  chevL:     <Icon d="M15 6l-6 6 6 6" />,
  arrow:     <Icon d="M5 12h14M13 6l6 6-6 6" />,
  trash:     <Icon d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />,
  edit:      <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />,
  alert:     <Icon d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />,
  zap:       <Icon d="M13 2 3 14h7l-1 8 11-12h-7l1-8Z" />,
  eye:       <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  eyeOff:    <Icon d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A10 10 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19M9.88 9.88a3 3 0 1 0 4.24 4.24M1 1l22 22" />,
  globe:     <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-20a14 14 0 0 1 0 20m0-20a14 14 0 0 0 0 20M2 12h20" />,
  key:       <Icon d="M21 2 14 9m-2 2-9 9 1 4 4 1 9-9m-2-2a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" />,
  sparkle:   <Icon d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  list:      <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  grid:      <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  clock:     <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 2" />,
  download:  <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  copy:      <Icon d="M8 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2M4 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" />,
  split:     <Icon d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M14 14l7 7M14 14h5M14 14v5" />,
  merge:     <Icon d="M8 6 14 12 8 18M16 6l-6 6 6 6" />,
  flag:      <Icon d="M4 22V4a8 8 0 0 1 16 0v10H8" />,
  chevLeft:  <Icon d="M15 18l-6-6 6-6" />,
  chevRight: <Icon d="M9 18l6-6-6-6" />,
  external:  <Icon d="M14 3h7v7M21 3l-9 9M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />,
  database:  <Icon d="M4 6c0-2 4-3 8-3s8 1 8 3-4 3-8 3-8-1-8-3Zm0 0v12c0 2 4 3 8 3s8-1 8-3V6M4 12c0 2 4 3 8 3s8-1 8-3" />,
  shield:    <Icon d="M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5l-8-3Z" />,
  doc:       <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M9 14h6M9 18h6M9 10h2" />,
  trend:     <Icon d="M3 17l6-6 4 4 8-8M14 7h7v7" />,
  star:      <Icon d="m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z" />,
  bot:       <Icon d="M12 2v4M5 9h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2ZM2 13h2M20 13h2M9 14h.01M15 14h.01M9 18h6" />,
};

/* ── Mock data ──────────────────────────────────────────────────── */
const POSTERS = [
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=200&q=70&auto=format",
  "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=200&q=70&auto=format",
  "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=200&q=70&auto=format",
  "https://images.unsplash.com/photo-1518676590629-3dcba9c5a555?w=200&q=70&auto=format",
  "https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=200&q=70&auto=format",
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&q=70&auto=format",
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&q=70&auto=format",
  "https://images.unsplash.com/photo-1603739903239-8b6e64c3b185?w=200&q=70&auto=format",
];
const poster = (i) => POSTERS[i % POSTERS.length];

const VIDEOS = [
  { id:"v1", title:"危险关系", year:2012, type:"电影", episodes:1, score:7.6, country:"KR", probe:"all_dead", render:"unknown", visibility:"internal", review:"pending", lines:3, sources:7, thumb:0, badges:["全失效","未豆配","封面失效"], updated:"2小时前", staffNote:null },
  { id:"v2", title:"危险关系2024", year:2024, type:"电影", episodes:1, score:6.8, country:"FR", probe:"partial", render:"ok", visibility:"public", review:"pending", lines:2, sources:4, thumb:1, badges:["米豆配","部分失效"], updated:"5分钟前", staffNote:"豆瓣 ID 待补" },
  { id:"v3", title:"危险关系1988", year:1988, type:"电影", episodes:1, score:7.9, country:"US", probe:"ok", render:"ok", visibility:"public", review:"approved", lines:4, sources:11, thumb:2, badges:[], updated:"昨天", staffNote:null },
  { id:"v4", title:"梅尔特伊", year:2025, type:"剧集", episodes:8, score:7.2, country:"FR", probe:"partial", render:"partial", visibility:"public", review:"pending", lines:5, sources:23, thumb:3, badges:["部分失效"], updated:"30分钟前", staffNote:null },
  { id:"v5", title:"非常关系", year:2023, type:"剧集", episodes:24, score:8.1, country:"CN", probe:"ok", render:"unknown", visibility:"internal", review:"pending", lines:3, sources:48, thumb:4, badges:["视频量异常"], updated:"1小时前", staffNote:null },
  { id:"v6", title:"危险关系1990", year:1990, type:"电影", episodes:1, score:6.4, country:"FR", probe:"all_dead", render:"all_dead", visibility:"hidden", review:"rejected", lines:1, sources:2, thumb:5, badges:["全失效"], updated:"3天前", staffNote:"重复上传" },
  { id:"v7", title:"凡尔赛宫", year:2026, type:"剧集", episodes:10, score:8.3, country:"FR", probe:"ok", render:"ok", visibility:"public", review:"approved", lines:6, sources:62, thumb:6, badges:[], updated:"1天前", staffNote:null },
  { id:"v8", title:"亚特兰蒂斯之谜", year:2025, type:"电影", episodes:1, score:5.9, country:"US", probe:"partial", render:"unknown", visibility:"internal", review:"pending", lines:2, sources:5, thumb:7, badges:["部分失效","豆瓣空"], updated:"15分钟前", staffNote:null },
];

const SITES = [
  { key:"iqiy", name:"爱奇艺-", type:"长片",   format:"JSON", weight:"中", on:true,  last:"2分钟前", health:97 },
  { key:"360",  name:"360 资源", type:"长片",   format:"JSON", weight:"中", on:true,  last:"2分钟前", health:91 },
  { key:"love", name:"又旦影视", type:"长片",   format:"JSON", weight:"中", on:true,  last:"2分钟前", health:88 },
  { key:"bdzy", name:"百度云zy", type:"长片",   format:"JSON", weight:"中", on:true,  last:"3分钟前", health:62 },
  { key:"bfzy", name:"暴风资源", type:"长片",   format:"JSON", weight:"中", on:true,  last:"2分钟前", health:73 },
  { key:"dyts", name:"电影天堂", type:"长片",   format:"JSON", weight:"低", on:false, last:"4小时前", health:23 },
  { key:"dbzy", name:"豆瓣资源", type:"长片",   format:"JSON", weight:"高", on:true,  last:"刚刚",     health:99 },
  { key:"ffzy", name:"非凡资源", type:"长片",   format:"JSON", weight:"中", on:true,  last:"2分钟前", health:81 },
  { key:"gszy", name:"光速资源", type:"长片",   format:"JSON", weight:"中", on:true,  last:"2分钟前", health:79 },
  { key:"hhzy", name:"豪华资源", type:"长片",   format:"JSON", weight:"中", on:false, last:"1小时前", health:0 },
];

/* dual-signal cell */
const DualSignal = ({ probe, render }) => {
  const map = (k) => ({
    ok: { cls: "pill--ok",     dot: "ok",     label: "可用" },
    partial: { cls: "pill--warn", dot: "warn", label: "部分" },
    all_dead: { cls: "pill--danger", dot: "danger", label: "失效" },
    unknown: { cls: "", dot: "", label: "未测" },
  }[k]);
  const p = map(probe), r = map(render);
  return (
    <div style={{display:"inline-flex", flexDirection:"column", gap:3, alignItems:"flex-start"}}>
      <span className={`pill pill--probe`} title={`链接探测：${p.label}`} style={{minWidth:62}}>
        <span className="dot" style={{background:`var(--${p.dot==="ok"?"ok":p.dot==="warn"?"warn":p.dot==="danger"?"danger":"muted"})`}}/>
        <span style={{color:"var(--probe)", fontWeight:600}}>探</span>
        <span style={{color:"var(--text-2)"}}>{p.label}</span>
      </span>
      <span className={`pill pill--render`} title={`实际播放：${r.label}`} style={{minWidth:62}}>
        <span className="dot" style={{background:`var(--${r.dot==="ok"?"ok":r.dot==="warn"?"warn":r.dot==="danger"?"danger":"muted"})`}}/>
        <span style={{color:"var(--render)", fontWeight:600}}>播</span>
        <span style={{color:"var(--text-2)"}}>{r.label}</span>
      </span>
    </div>
  );
};

/* visibility atomic indicator (combines is_published + visibility + review) */
const VisChip = ({ visibility, review }) => {
  if (review === "rejected") return <span className="pill pill--danger"><span className="dot"/>已拒</span>;
  if (review === "pending") return <span className="pill pill--warn"><span className="dot"/>待审</span>;
  if (visibility === "public") return <span className="pill pill--ok"><span className="dot"/>前台可见</span>;
  if (visibility === "internal") return <span className="pill"><span className="dot"/>仅内部</span>;
  return <span className="pill pill--danger"><span className="dot"/>隐藏</span>;
};

const Spark = ({ data, color = "var(--accent)" }) => {
  const w = 60, h = 18, max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

Object.assign(window, { I, Icon, VIDEOS, SITES, poster, DualSignal, VisChip, Spark });
