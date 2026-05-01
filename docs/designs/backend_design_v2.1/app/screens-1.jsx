/* global React, I, Icon, VIDEOS, SITES, poster, DualSignal, VisChip, Spark */
const { useState: useS1, useMemo: useM1, useRef: useR1, useCallback: useC1, useEffect: useE1 } = React;

/* ═══════════════════════════════════════════════════════════
   DASHBOARD — 管理台站
   编辑布局模式 + 团队/个人布局 + 卡片库 + 全屏化
   ═══════════════════════════════════════════════════════════ */

/* ── Spark mini chart (inline, used by cards) ───────────── */
const MiniSpark = ({ data = [], color = "var(--accent)", h = 32 }) => {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: 80, height: h, display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

/* ── Card definitions ───────────────────────────────────── */
const CARD_DEFS = [
  { id: "kpi-online",   label: "实时在线",     w: 3, h: 1, group: "实时数据" },
  { id: "kpi-pending",  label: "待审 / 暂存",  w: 3, h: 1, group: "实时数据" },
  { id: "kpi-health",   label: "源可达率",     w: 3, h: 1, group: "实时数据" },
  { id: "kpi-dead",     label: "失效源",       w: 3, h: 1, group: "实时数据" },
  { id: "trend-7d",     label: "7 日观看趋势", w: 8, h: 2, group: "图表" },
  { id: "subtitle-prog",label: "字幕进度",     w: 4, h: 2, group: "图表" },
  { id: "crawl-status", label: "采集状态",     w: 4, h: 1, group: "采集" },
  { id: "audit-recent", label: "最近审计",     w: 6, h: 2, group: "运营" },
  { id: "site-health",  label: "站点健康度",   w: 6, h: 2, group: "运营" },
  { id: "alerts",       label: "需要注意",     w: 8, h: 2, group: "运营" },
  { id: "workflow",     label: "我的工作流",   w: 4, h: 2, group: "运营" },
];

const LAYOUT_PRESETS = {
  "ops":  { label: "运营视角", cards: ["alerts","kpi-pending","kpi-health","workflow","trend-7d","subtitle-prog","audit-recent","site-health"] },
  "tech": { label: "技术视角", cards: ["kpi-health","kpi-dead","crawl-status","kpi-online","site-health","audit-recent","trend-7d","subtitle-prog"] },
  "mod":  { label: "内容审核", cards: ["kpi-pending","workflow","alerts","trend-7d","subtitle-prog","audit-recent"] },
};

/* ── Individual card content renderers ─────────────────── */
const CardContent = ({ id, fullscreen }) => {
  const sites = [88,91,87,93,89,94,91,95,93,96,94,97,93];
  const fail  = [42,38,35,41,33,28,30,25,22,19,18,15,13];
  const inbox = [402,415,421,438,452,461,470,475,481,479,484];

  if (id === "kpi-online") return (
    <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",height:"100%",padding:"12px 14px"}}>
      <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.5}}>实时在线</div>
      <div style={{fontSize:28,fontWeight:700,lineHeight:1}}>12,847</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:"var(--ok)"}}>↑ +340 今日峰值</span>
        <MiniSpark data={[9200,9800,10200,11000,11400,12000,12400,12847]} color="var(--ok)" />
      </div>
    </div>
  );

  if (id === "kpi-pending") return (
    <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",height:"100%",padding:"12px 14px",background:"rgba(245,158,11,.04)"}}>
      <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.5}}>待审 / 暂存</div>
      <div style={{fontSize:28,fontWeight:700,lineHeight:1}}>484 <span style={{fontSize:14,color:"var(--muted)",fontWeight:400}}>/ 23</span></div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:"var(--warn)"}}>较昨日 +18</span>
        <MiniSpark data={inbox} color="var(--warn)" />
      </div>
    </div>
  );

  if (id === "kpi-health") return (
    <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",height:"100%",padding:"12px 14px"}}>
      <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.5}}>源可达率</div>
      <div style={{fontSize:28,fontWeight:700,lineHeight:1,color:"var(--ok)"}}>98.7%</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:"var(--ok)"}}>↑ 0.3pt · 7d</span>
        <MiniSpark data={sites} color="var(--ok)" />
      </div>
    </div>
  );

  if (id === "kpi-dead") return (
    <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",height:"100%",padding:"12px 14px",background:"rgba(239,68,68,.04)"}}>
      <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.5}}>失效源</div>
      <div style={{fontSize:28,fontWeight:700,lineHeight:1,color:"var(--danger)"}}>1,939</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:"var(--ok)"}}>↓ -28 较昨日</span>
        <MiniSpark data={fail} color="var(--danger)" />
      </div>
    </div>
  );

  if (id === "trend-7d") return (
    <div style={{padding:"12px 14px",height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>7 日观看趋势</div>
      <div style={{flex:1,position:"relative"}}>
        <svg viewBox="0 0 560 120" style={{width:"100%",height:"100%"}} preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity=".4"/>
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[30,60,90].map(y => <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="1"/>)}
          {(() => {
            const raw = [8200,9100,8700,10200,11000,10500,11800,12100,11600,12400,12847,12200,13000];
            const mn = Math.min(...raw), mx = Math.max(...raw), rng = mx-mn;
            const pts = raw.map((v,i) => `${(i/(raw.length-1))*560},${110-((v-mn)/rng)*100}`).join(" ");
            return <>
              <polygon points={`0,120 ${pts} 560,120`} fill="url(#trendGrad)"/>
              <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"/>
            </>;
          })()}
        </svg>
        {fullscreen && (
          <div style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",gap:8,justifyContent:"center"}}>
            {["日","周","月","季"].map(t => (
              <button key={t} className="btn btn--xs" style={{padding:"2px 8px"}}>{t}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (id === "subtitle-prog") return (
    <div style={{padding:"12px 14px",height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>字幕进度 · 多语言</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,flex:1}}>
        {[
          ["简体中文", 1021, 2148, "var(--accent)"],
          ["English",  876, 2148, "var(--ok)"],
          ["繁體中文",  147, 2148, "var(--info)"],
          ["日本語",    63,  2148, "var(--muted-2)"],
        ].map(([lang,n,total,color]) => (
          <div key={lang}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
              <span style={{color:"var(--text-2)"}}>{lang}</span>
              <span style={{color:"var(--muted)"}}>{n} / {total}</span>
            </div>
            <div style={{height:6,background:"var(--bg3)",borderRadius:999,overflow:"hidden"}}>
              <div style={{width:`${(n/total)*100}%`,height:"100%",background:color,borderRadius:999}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (id === "crawl-status") return (
    <div style={{padding:"12px 14px",height:"100%"}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>采集状态</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[
          {label:"进行中",n:3,color:"var(--ok)"},
          {label:"失败",n:4,color:"var(--danger)"},
          {label:"等待",n:7,color:"var(--muted-2)"},
        ].map(it => (
          <div key={it.label} style={{textAlign:"center",padding:"8px 4px",background:"var(--bg3)",borderRadius:6}}>
            <div style={{fontSize:20,fontWeight:700,color:it.color}}>{it.n}</div>
            <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (id === "audit-recent") return (
    <div style={{padding:"12px 14px",height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>最近审计动作</div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:0}}>
        {[
          {who:"系统", what:"完成全量采集 · 33 成功", when:"12m",c:"var(--info)"},
          {who:"Yan",  what:"批准 24 条视频上架",      when:"38m",c:"var(--ok)"},
          {who:"Mira", what:"标记 v.lzcdn31 永久失效", when:"52m",c:"var(--danger)"},
          {who:"系统", what:"自动合并候选 catalog 17", when:"1h", c:"var(--warn)"},
          {who:"Yan",  what:"替换 Banner 阿凡达",      when:"3h", c:"var(--accent)"},
        ].map((it,i) => (
          <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:"1px solid var(--border-subtle)",alignItems:"center"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:it.c,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <span style={{fontSize:11,fontWeight:600}}>{it.who}</span>
              <span style={{fontSize:11,color:"var(--text-2)"}}> · {it.what}</span>
            </div>
            <span style={{fontSize:10,color:"var(--muted)",flexShrink:0}}>{it.when}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (id === "site-health") return (
    <div style={{padding:"12px 14px",height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>站点健康度</div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:0}}>
        {SITES.slice(0,6).map((s,i) => (
          <div key={s.key} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid var(--border-subtle)"}}>
            <span style={{width:24,height:24,borderRadius:4,background:s.health>80?"var(--ok-soft)":s.health>50?"var(--warn-soft)":"var(--danger-soft)",color:s.health>80?"var(--ok)":s.health>50?"var(--warn)":"var(--danger)",display:"grid",placeItems:"center",fontSize:9,fontWeight:700,flexShrink:0}}>{s.health}</span>
            <span style={{flex:1,fontSize:12,fontWeight:600}}>{s.name}</span>
            <MiniSpark data={Array.from({length:7},()=>Math.max(0,s.health+(Math.random()-.5)*16))} color={s.health>80?"var(--ok)":s.health>50?"var(--warn)":"var(--danger)"} h={20}/>
          </div>
        ))}
      </div>
    </div>
  );

  if (id === "alerts") return (
    <div style={{padding:"12px 14px",height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:12,fontWeight:600}}>需要注意</span>
        <span style={{fontSize:10,color:"var(--warn)"}}>4 项</span>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:0}}>
        {[
          {sev:"danger",title:"4 个采集站点连续 3 次失败",meta:"电影天堂 · 豪华资源 · 帝王云 · 暴风资源",action:"诊断"},
          {sev:"warn",title:"img3.doubanio.com 封面 4h 404",meta:"影响 231 张封面，建议切换 fallback",action:"切换"},
          {sev:"warn",title:"6 个候选合并待人工确认",meta:"包含『危险关系 1990』疑似与 1988 错合",action:"工单"},
          {sev:"info",title:"Banner『阿凡达：火与烬』将在 2 天后过期",meta:"建议替换新档期素材",action:"编辑"},
        ].map((it,i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border-subtle)"}}>
            <span style={{color:`var(--${it.sev})`,fontSize:14}}>{I.alert}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600}}>{it.title}</div>
              <div style={{fontSize:10,color:"var(--muted)",marginTop:1}}>{it.meta}</div>
            </div>
            <button className="btn btn--xs" style={{flexShrink:0}}>{it.action}</button>
          </div>
        ))}
      </div>
    </div>
  );

  if (id === "workflow") return (
    <div style={{padding:"12px 14px",height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>我的工作流</div>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
        {[
          {label:"采集入库",n:649,total:649,color:"var(--accent)"},
          {label:"待审核",n:484,total:649,color:"var(--warn)"},
          {label:"暂存待发布",n:23,total:649,color:"var(--info)"},
          {label:"已上架",n:13,total:649,color:"var(--ok)"},
        ].map(it => (
          <div key={it.label}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
              <span>{it.label}</span><span style={{fontWeight:600,color:it.color}}>{it.n}</span>
            </div>
            <div style={{height:5,background:"var(--bg3)",borderRadius:999,overflow:"hidden"}}>
              <div style={{width:`${(it.n/it.total)*100}%`,height:"100%",background:it.color,borderRadius:999}}/>
            </div>
          </div>
        ))}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:4}}>
          <button className="btn btn--sm" style={{justifyContent:"center"}}>{I.inbox} 审核</button>
          <button className="btn btn--sm" style={{justifyContent:"center"}}>{I.upload} 发布</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{padding:14,color:"var(--muted)",fontSize:12,height:"100%",display:"grid",placeItems:"center"}}>
      {id}
    </div>
  );
};

/* ── DashCard — wrapper in both browse & edit mode ──────── */
const COL = 12;
const ROW_H = 130; // px per grid row unit
const GAP = 12;

const DashCard = ({ def, editing, onRemove, onFullscreen, style: extraStyle }) => {
  const [hovered, setHovered] = useS1(false);
  return (
    <div
      className={editing ? "dash-card dash-card--editing" : "dash-card"}
      style={{
        gridColumn: `span ${def.w}`,
        gridRow: `span ${def.h}`,
        background: "var(--bg2)",
        border: editing ? "1.5px dashed var(--border-strong)" : "1px solid var(--border)",
        borderRadius: 8,
        position: "relative",
        overflow: "hidden",
        cursor: editing ? "grab" : "default",
        minHeight: def.h * ROW_H + (def.h - 1) * GAP,
        ...extraStyle,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing && (
        <div style={{position:"absolute",top:4,left:6,fontSize:10,color:"var(--muted-2)",userSelect:"none",zIndex:2}}>⠿⠿</div>
      )}
      {editing && (
        <button
          className="btn btn--xs"
          onClick={onRemove}
          style={{position:"absolute",top:4,right:4,zIndex:3,padding:"2px 5px",opacity:.8}}
          title="移除"
        >✕</button>
      )}
      {!editing && (hovered) && (
        <button
          className="btn btn--xs"
          onClick={onFullscreen}
          style={{position:"absolute",top:6,right:6,zIndex:3,padding:"2px 5px",opacity:.7}}
          title="全屏"
        >⛶</button>
      )}
      <CardContent id={def.id} />
    </div>
  );
};

/* ── Card Library Drawer ─────────────────────────────────── */
const CardLibrary = ({ activeIds, onAdd, onClose }) => {
  const groups = [...new Set(CARD_DEFS.map(c => c.group))];
  return (
    <div style={{
      position:"fixed",top:"var(--topbar-h)",left:"var(--sidebar-w)",bottom:0,width:260,
      background:"var(--bg2)",borderRight:"1px solid var(--border)",zIndex:40,
      display:"flex",flexDirection:"column",boxShadow:"4px 0 16px rgba(0,0,0,.3)"
    }}>
      <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:13,fontWeight:700,flex:1}}>卡片库</span>
        <button className="btn btn--xs" onClick={onClose}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:10}}>
        {groups.map(g => (
          <div key={g} style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.6,marginBottom:6,padding:"0 4px"}}>{g}</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {CARD_DEFS.filter(c => c.group === g).map(c => {
                const added = activeIds.includes(c.id);
                return (
                  <div key={c.id} style={{
                    display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
                    background:"var(--bg3)",borderRadius:6,border:"1px solid var(--border)",
                    opacity: added ? .5 : 1
                  }}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600}}>{c.label}</div>
                      <div style={{fontSize:10,color:"var(--muted)",marginTop:1}}>{c.w}×{c.h} 格</div>
                    </div>
                    <button
                      className={`btn btn--xs ${added ? "" : "btn--primary"}`}
                      disabled={added}
                      onClick={() => !added && onAdd(c)}
                    >{added ? "已添加" : "+ 添加"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{padding:"8px 4px",fontSize:11,color:"var(--muted)"}}>
          拖拽到画布即添加；可重复添加同类型（不同筛选条件）
        </div>
      </div>
    </div>
  );
};

/* ── Fullscreen Card Modal ────────────────────────────────── */
const FullscreenCard = ({ def, onClose }) => (
  <div className="modal-bg" onClick={onClose} style={{zIndex:200}}>
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10,
        width:"min(900px,92vw)",height:"min(600px,80vh)",display:"flex",flexDirection:"column",
        boxShadow:"var(--shadow-lg)"
      }}
    >
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:13,fontWeight:700,flex:1}}>管理台站 / {def.label} · 全屏视图</span>
        <button className="btn btn--xs" onClick={onClose}>⛶ 退出全屏 · <span className="kbd">Esc</span></button>
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        <CardContent id={def.id} fullscreen />
      </div>
    </div>
  </div>
);

/* ── Main Dashboard ──────────────────────────────────────── */
const Dashboard = () => {
  const [editing, setEditing] = useS1(false);
  const [layoutScope, setLayoutScope] = useS1("team");      // "team" | "personal"
  const [presetKey, setPresetKey] = useS1("ops");
  const [cards, setCards] = useS1(() =>
    LAYOUT_PRESETS["ops"].cards.map(id => CARD_DEFS.find(c => c.id === id)).filter(Boolean)
  );
  const [showLibrary, setShowLibrary] = useS1(false);
  const [fullscreenCard, setFullscreenCard] = useS1(null);
  const [draftCards, setDraftCards] = useS1([]);

  const enterEdit = () => { setDraftCards([...cards]); setEditing(true); setShowLibrary(true); };
  const cancelEdit = () => { setEditing(false); setShowLibrary(false); };
  const saveEdit = () => { setCards([...draftCards]); setEditing(false); setShowLibrary(false); };

  const activeCards = editing ? draftCards : cards;
  const setActiveCards = editing ? setDraftCards : setCards;

  const removeCard = (idx) => setActiveCards(cs => cs.filter((_,i) => i !== idx));
  const addCard = (def) => {
    setDraftCards(cs => [...cs, def]);
  };

  const applyPreset = (key) => {
    setPresetKey(key);
    const next = LAYOUT_PRESETS[key].cards.map(id => CARD_DEFS.find(c => c.id === id)).filter(Boolean);
    if (editing) setDraftCards(next); else setCards(next);
  };

  // Esc closes fullscreen
  useE1(() => {
    const h = e => { if (e.key === "Escape") setFullscreenCard(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <>
      {/* Card Library drawer (edit mode) */}
      {editing && showLibrary && (
        <CardLibrary
          activeIds={draftCards.map(c => c.id)}
          onAdd={addCard}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Fullscreen overlay */}
      {fullscreenCard && <FullscreenCard def={fullscreenCard} onClose={() => setFullscreenCard(null)} />}

      <div style={{marginLeft: editing && showLibrary ? 260 : 0, transition:"margin .2s"}}>
        {/* Page head */}
        <div className="page__head">
          <div>
            {editing ? (
              <>
                <h1 className="page__title">管理台站 · <span style={{color:"var(--accent)"}}>编辑布局中</span></h1>
                <div className="page__sub">拖拽卡片重排 · 右下角 resize · 左侧卡片库添加 · ✕ 移除</div>
              </>
            ) : (
              <>
                <h1 className="page__title">管理台站</h1>
                <div className="page__sub">最后一次全站采集 · 12 分钟前完成 · 视频量 +47 · 新增源 +112</div>
              </>
            )}
          </div>
          <div className="page__actions">
            {editing ? (
              <>
                {/* Layout scope toggle */}
                <div className="seg">
                  <span className={`seg__btn ${layoutScope === "team" ? "is-active" : ""}`} onClick={() => setLayoutScope("team")}>团队</span>
                  <span className={`seg__btn ${layoutScope === "personal" ? "is-active" : ""}`} onClick={() => setLayoutScope("personal")}>个人</span>
                </div>
                {/* Preset picker */}
                <select
                  className="inp"
                  style={{width:130,height:32}}
                  value={presetKey}
                  onChange={e => applyPreset(e.target.value)}
                >
                  {Object.entries(LAYOUT_PRESETS).map(([k,p]) => (
                    <option key={k} value={k}>{p.label}</option>
                  ))}
                </select>
                <button className="btn btn--xs">+ 新建布局</button>
                <button className="btn btn--xs">克隆为个人</button>
                <span style={{width:1,height:20,background:"var(--border)",margin:"0 4px"}}/>
                <button className="btn" onClick={cancelEdit}>取消</button>
                <button className="btn btn--xs">恢复默认</button>
                <button className="btn btn--primary" onClick={saveEdit}>{I.check} 保存布局</button>
              </>
            ) : (
              <>
                {/* Layout info */}
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 10px",background:"var(--bg3)",borderRadius:6,height:32,fontSize:12,color:"var(--text-2)"}}>
                  布局：<strong style={{color:"var(--text)"}}>{layoutScope === "team" ? "团队" : "个人"} · {LAYOUT_PRESETS[presetKey]?.label}</strong>
                  <span style={{color:"var(--muted)"}}>▾</span>
                </div>
                <button className="btn">{I.refresh} 刷新</button>
                <button className="btn btn--primary" onClick={enterEdit}>⚙ 编辑布局</button>
              </>
            )}
          </div>
        </div>

        {/* Edit mode top hint bar */}
        {editing && (
          <div style={{
            display:"flex",alignItems:"center",gap:12,padding:"8px 14px",marginBottom:12,
            background:"var(--accent-soft)",border:"1px solid var(--accent-border)",borderRadius:8,
            fontSize:12,color:"var(--text-2)"
          }}>
            <span style={{color:"var(--accent)"}}>{I.edit}</span>
            <span>编辑模式 · 拖拽调整顺序 · <strong>✕</strong> 移除卡片 · 点击左侧「卡片库」添加更多</span>
            {!showLibrary && <button className="btn btn--xs btn--primary" onClick={() => setShowLibrary(true)}>打开卡片库</button>}
          </div>
        )}

        {/* Grid */}
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(12, 1fr)",
          gap:GAP,
          alignItems:"start",
        }}>
          {activeCards.map((def, idx) => (
            <DashCard
              key={`${def.id}-${idx}`}
              def={def}
              editing={editing}
              onRemove={() => removeCard(idx)}
              onFullscreen={() => setFullscreenCard(def)}
            />
          ))}

          {/* "Add card" tile in edit mode */}
          {editing && (
            <div
              onClick={() => setShowLibrary(true)}
              style={{
                gridColumn:"span 2",
                minHeight: ROW_H,
                border:"1.5px dashed var(--border-strong)",
                borderRadius:8,
                display:"grid",placeItems:"center",
                color:"var(--muted-2)",
                cursor:"pointer",
                fontSize:11,
                flexDirection:"column",
                gap:4,
              }}
            >
              <span style={{fontSize:20}}>＋</span>
              <span>卡片库</span>
            </div>
          )}
        </div>

        {/* Layout permission note in edit mode */}
        {editing && (
          <div style={{marginTop:16,padding:"10px 14px",background:"var(--bg3)",borderRadius:6,fontSize:11,color:"var(--muted)"}}>
            <strong style={{color:"var(--text-2)"}}>权限说明：</strong>
            团队布局由管理员发布，成员只读；个人布局可基于团队布局克隆后自由修改，下次登录自动恢复。
          </div>
        )}
      </div>
    </>
  );
};


/* ═══════════════════════════════════════════════════════════
   MODERATION CONSOLE — 内容审核台
   三栏 + Tab（待审核 / 待发布 / 已拒绝）
   「待发布」整合进审核台，不再是独立路由
   ═══════════════════════════════════════════════════════════ */

/* Left list row */
const ModListRow = ({ it, active, onClick, idx }) => {
  const probeBad = it.probe === "all_dead" ? 2 : it.probe === "partial" ? 1 : 0;
  const renderBad = it.render === "all_dead" ? 2 : it.render === "partial" ? 1 : 0;
  const worst = Math.max(probeBad, renderBad);
  const healthLabel = worst === 2 ? "全失效" : worst === 1 ? "部分失效" : "活跃";
  const healthColor = worst === 2 ? "danger" : worst === 1 ? "warn" : "ok";
  return (
    <div
      onClick={onClick}
      style={{
        display:"flex", gap:10, padding:"10px 12px",
        borderBottom:"1px solid var(--border-subtle)",
        background: active ? "var(--accent-soft)" : "transparent",
        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
        cursor:"pointer"
      }}
    >
      <span className="checkbox" onClick={(e) => e.stopPropagation()} />
      <img src={poster(it.thumb)} className="tbl-thumb tbl-thumb--sm" />
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:"flex", alignItems:"center", gap:6}}>
          <div style={{fontSize:13, fontWeight:600, color: active ? "var(--accent)" : "var(--text)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.title}</div>
          {active && <span className="kbd" style={{fontSize:10}}>↵</span>}
        </div>
        <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{it.type} · {it.year} · {it.sources} 源</div>
        <div style={{display:"flex", gap:4, marginTop:4, flexWrap:"wrap"}}>
          <span className={`pill pill--${healthColor}`} style={{fontSize:10}}><span className="dot"/>{healthLabel}</span>
          {it.badges.includes("封面失效") && <span className="pill pill--danger" style={{fontSize:10}}><span className="dot"/>封面</span>}
          {it.badges.includes("豆瓣未匹配") && <span className="pill pill--warn" style={{fontSize:10}}><span className="dot"/>豆瓣</span>}
        </div>
      </div>
      <div style={{fontSize:10, color:"var(--muted)", flexShrink:0}}>{it.updated}</div>
    </div>
  );
};

/* Decision card */
const DecisionCard = ({ v }) => {
  const allDead = v.probe === "all_dead" && v.render === "all_dead";
  const conflict = v.probe !== v.render && v.render !== "unknown" && !allDead;
  if (allDead) return (
    <div className="banner banner--danger" style={{marginBottom:12, alignItems:"flex-start"}}>
      <span style={{color:"var(--danger)", fontSize:18, marginTop:2}}>{I.alert}</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:600, display:"flex", alignItems:"center", gap:6}}>所有线路均失效 <span className="pill pill--danger" style={{fontSize:10}}>P0</span></div>
        <div style={{color:"var(--text-2)", marginTop:4, fontSize:11, lineHeight:1.6}}>
          7 条线路 · 0 条可达 · 0 条可播。<br/>
          <span style={{color:"var(--muted)"}}>建议：直接拒绝，或转入「等待补源」队列。</span>
        </div>
      </div>
      <div style={{display:"flex", gap:4}}>
        <button className="btn btn--xs btn--danger">{I.x} 拒绝</button>
        <button className="btn btn--xs">补源队列</button>
      </div>
    </div>
  );
  if (conflict) return (
    <div className="banner banner--warn" style={{marginBottom:12, alignItems:"flex-start"}}>
      <span style={{color:"var(--warn)", fontSize:18, marginTop:2}}>{I.alert}</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:600}}>探测 vs 播放信号不一致</div>
        <div style={{color:"var(--text-2)", marginTop:4, fontSize:11, lineHeight:1.6}}>
          HEAD 探测 <code>3/7</code> 可达，但 hls.js 实测 <code>5/7</code> 可渲染。建议以播放结果为准。
        </div>
      </div>
      <div style={{display:"flex", gap:4}}>
        <button className="btn btn--xs">{I.eye} 证据</button>
        <button className="btn btn--xs">忽略</button>
      </div>
    </div>
  );
  return (
    <div className="banner" style={{marginBottom:12, alignItems:"flex-start", background:"var(--ok-soft)", borderColor:"rgba(34,197,94,.3)"}}>
      <span style={{color:"var(--ok)", fontSize:18, marginTop:2}}>{I.check}</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:600}}>信号一致 · 健康</div>
        <div style={{color:"var(--text-2)", marginTop:4, fontSize:11}}>全部线路探测与播放结果一致。可直接通过。</div>
      </div>
      <button className="btn btn--xs btn--primary">{I.check} 通过 <span className="kbd">A</span></button>
    </div>
  );
};

/* Mock lines data */
const MOCK_LINES = [
  {id:"l1", name:"线路 1", host:"lzcaiji.com", probe:"ok", render:"ok", enabled:true, ms:182},
  {id:"l2", name:"线路 2", host:"yzzy.cdn", probe:"all_dead", render:"ok", enabled:true, ms:241},
  {id:"l3", name:"线路 3", host:"hhzy", probe:"all_dead", render:"all_dead", enabled:false, ms:null},
  {id:"l4", name:"线路 4", host:"360zy", probe:"ok", render:"ok", enabled:true, ms:96},
  {id:"l5", name:"线路 5", host:"bfzy", probe:"partial", render:"ok", enabled:true, ms:312},
];

/* Draggable line row */
const LineRow = ({ line, index, selected, onSelect, onToggle, dragHandlers }) => {
  const probeColor = line.probe === "ok" ? "ok" : line.probe === "partial" ? "warn" : "danger";
  const renderColor = line.render === "ok" ? "ok" : line.render === "partial" ? "warn" : "danger";
  return (
    <div
      style={{
        display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
        background: selected ? "var(--accent-soft)" : "transparent",
        border: selected ? "1px solid var(--accent-border)" : "1px solid transparent",
        borderRadius:6, opacity: line.enabled ? 1 : 0.5,
        cursor:"pointer", transition:"background .1s"
      }}
      onClick={() => onSelect(line.id)}
    >
      <span
        {...dragHandlers}
        style={{cursor:"grab", color:"var(--muted-2)", fontSize:14, userSelect:"none", padding:"0 2px"}}
        onClick={(e) => e.stopPropagation()}
      >⠿</span>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:"flex", alignItems:"center", gap:6}}>
          <span style={{fontSize:12, fontWeight:600}}>{line.name}</span>
          <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>{line.host}</span>
          {line.ms && <span style={{fontSize:10, color:"var(--muted)"}}>{line.ms}ms</span>}
        </div>
        <div style={{display:"flex", gap:6, marginTop:4}}>
          <span className={`pill pill--${probeColor}`} style={{fontSize:10}}><span className="dot"/>探 {line.probe === "ok" ? "可达" : line.probe === "partial" ? "部分" : "失效"}</span>
          <span className={`pill pill--${renderColor}`} style={{fontSize:10}}><span className="dot"/>播 {line.render === "ok" ? "可播" : line.render === "partial" ? "部分" : "不可播"}</span>
        </div>
      </div>
      <button
        className={`btn btn--xs ${!line.enabled ? "btn--primary" : ""}`}
        onClick={(e) => { e.stopPropagation(); onToggle(line.id); }}
        title={line.enabled ? "隐藏此线路" : "显示此线路"}
      >
        {line.enabled ? I.eye : I.eyeOff}
        <span>{line.enabled ? "显示" : "隐藏"}</span>
      </button>
    </div>
  );
};

/* Lines panel with drag reorder */
const LinesPanel = ({ videoId }) => {
  const [lines, setLines] = useS1(MOCK_LINES);
  const [selectedLine, setSelectedLine] = useS1("l1");
  const [dragIdx, setDragIdx] = useS1(null);

  const toggleLine = (id) => {
    setLines(ls => ls.map(l => l.id === id ? {...l, enabled: !l.enabled} : l));
  };

  const onDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx);
  };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setLines(prev => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDragIdx(idx);
  };
  const onDragEnd = () => setDragIdx(null);

  const enabledCount = lines.filter(l => l.enabled).length;

  return (
    <div>
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
        <span style={{fontSize:12, fontWeight:600}}>线路</span>
        <span style={{fontSize:11, color:"var(--muted)"}}>{enabledCount}/{lines.length} 启用</span>
        <span style={{flex:1}}/>
        <button className="btn btn--xs">{I.refresh} 重测全部</button>
      </div>
      <div style={{display:"flex", flexDirection:"column", gap:3}}>
        {lines.map((line, idx) => (
          <div
            key={line.id}
            draggable
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
          >
            <LineRow
              line={line}
              index={idx}
              selected={selectedLine === line.id}
              onSelect={setSelectedLine}
              onToggle={toggleLine}
              dragHandlers={{}}
            />
          </div>
        ))}
      </div>
      <div style={{display:"flex", gap:6, marginTop:8}}>
        <button className="btn btn--xs">{I.eye} 证据</button>
        <span style={{flex:1}}/>
        <button className="btn btn--xs btn--danger">{I.trash} 删除全失效</button>
      </div>
    </div>
  );
};

/* Episode selector */
const EpisodeSelector = ({ total, current, onSelect }) => {
  const perPage = 20;
  const [page, setPage] = useS1(0);
  const maxPage = Math.max(0, Math.ceil(total / perPage) - 1);
  const start = page * perPage + 1;
  const end = Math.min((page + 1) * perPage, total);

  return (
    <div>
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
        <span style={{fontSize:12, fontWeight:600}}>选集</span>
        <span style={{fontSize:11, color:"var(--muted)"}}>{total} 集</span>
        {total > perPage && (
          <>
            <span style={{flex:1}}/>
            <button className="btn btn--xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
            <span style={{fontSize:10, color:"var(--muted)"}}>{start}-{end}</span>
            <button className="btn btn--xs" disabled={page === maxPage} onClick={() => setPage(p => p + 1)}>›</button>
          </>
        )}
      </div>
      <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
        {Array.from({length: end - start + 1}, (_, i) => {
          const ep = start + i;
          const isCurrent = ep === current;
          return (
            <div
              key={ep}
              onClick={() => onSelect(ep)}
              style={{
                width:34, height:30, display:"grid", placeItems:"center",
                borderRadius:4, fontSize:11, fontWeight: isCurrent ? 700 : 500,
                cursor:"pointer",
                background: isCurrent ? "var(--accent)" : "var(--bg3)",
                color: isCurrent ? "var(--on-accent)" : "var(--text-2)",
                border: `1px solid ${isCurrent ? "var(--accent)" : "var(--border)"}`,
                transition:"all .1s"
              }}
            >{ep}</div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Pending tab center pane ──────────────────────────── */
const PendingCenter = ({ v, activeIdx, total }) => {
  const [currentEp, setCurrentEp] = useS1(1);
  return (
    <>
      <DecisionCard v={v} />

      {/* Player area */}
      <div style={{background:"#000", borderRadius:6, aspectRatio:"16/9", position:"relative", overflow:"hidden", marginBottom:14}}>
        <img src={poster(v.thumb)} style={{width:"100%", height:"100%", objectFit:"cover", opacity:.35, filter:"blur(8px)"}}/>
        <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center"}}>
          <div style={{width:48, height:48, borderRadius:"50%", background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", display:"grid", placeItems:"center"}}>
            <span style={{color:"white"}}>{I.play}</span>
          </div>
        </div>
        <div style={{position:"absolute", bottom:8, left:10, right:10, display:"flex", gap:6, alignItems:"center"}}>
          <span style={{fontSize:10, color:"white", background:"rgba(0,0,0,.5)", padding:"2px 6px", borderRadius:4}}>线路 1 / 5 · EP{currentEp}</span>
          <span style={{flex:1}}/>
          <span className="kbd" style={{background:"rgba(0,0,0,.6)", color:"white", borderColor:"rgba(255,255,255,.2)"}}>space</span>
        </div>
      </div>

      {/* Video info */}
      <div style={{display:"flex", gap:14, marginBottom:14}}>
        <img src={poster(v.thumb)} style={{width:100, height:150, borderRadius:6, objectFit:"cover", boxShadow:"var(--shadow-md)", flexShrink:0}} />
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap"}}>
            <h2 style={{margin:0, fontSize:20, fontWeight:700}}>{v.title}</h2>
            <span style={{color:"var(--muted)", fontSize:13}}>{v.year}</span>
            <VisChip visibility={v.visibility} review={v.review} />
          </div>
          <div style={{marginTop:4, fontSize:12, color:"var(--muted)"}}>
            {v.type} · {v.episodes} 集 · {v.country} · ⭐ {v.score} · ID <code className="mono">{v.id}</code>
          </div>
          <div style={{marginTop:8, display:"flex", gap:6, flexWrap:"wrap"}}>
            {v.badges.map((b) => <span key={b} className="pill pill--warn"><span className="dot"/>{b}</span>)}
            {v.staffNote && <span className="pill pill--info"><span className="dot"/>备注: {v.staffNote}</span>}
          </div>
          <div style={{marginTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:6}}>
            <button className="btn btn--sm" onClick={() => window.openEditDrawer(v.id)}>{I.edit} 编辑视频</button>
            <button className="btn btn--sm">{I.image} 修封面</button>
            <button className="btn btn--sm">{I.split} 拆分</button>
            <button className="btn btn--sm">{I.external} 前台</button>
          </div>
        </div>
      </div>

      {/* Episode selector */}
      {v.episodes > 1 && (
        <div style={{marginBottom:14, padding:12, background:"var(--bg3)", borderRadius:6}}>
          <EpisodeSelector total={v.episodes} current={currentEp} onSelect={setCurrentEp} />
        </div>
      )}

      {/* Lines panel */}
      <div style={{padding:12, background:"var(--bg3)", borderRadius:6}}>
        <LinesPanel videoId={v.id} />
      </div>
    </>
  );
};

/* ── Staging tab (待发布) — integrated into ModerationConsole ── */
const STAGING_VIDEOS = [
  VIDEOS[3], VIDEOS[4], VIDEOS[7],
].map(v => ({...v, review:"approved", visibility:"internal"}));

const StagingTabContent = () => {
  const [activeIdx, setActiveIdx] = useS1(0);
  const v = STAGING_VIDEOS[activeIdx];
  return (
    <div style={{display:"flex", gap:12, flex:1, minHeight:0}}>
      {/* Left list */}
      <div className="split__pane" style={{width:280, flexShrink:0}}>
        <div className="split__pane-head">
          <span className="checkbox" />
          <span style={{fontSize:12, color:"var(--muted)"}}>{STAGING_VIDEOS.length} 条待发布</span>
          <span style={{flex:1}}/>
          <button className="btn btn--xs btn--primary">{I.upload} 全部发布</button>
        </div>
        <div className="split__pane-body">
          {STAGING_VIDEOS.map((it, i) => (
            <div
              key={it.id}
              onClick={() => setActiveIdx(i)}
              style={{
                display:"flex", gap:10, padding:"10px 12px",
                borderBottom:"1px solid var(--border-subtle)",
                background: i === activeIdx ? "var(--accent-soft)" : "transparent",
                borderLeft: i === activeIdx ? "2px solid var(--accent)" : "2px solid transparent",
                cursor:"pointer"
              }}
            >
              <span className="checkbox" onClick={(e) => e.stopPropagation()} />
              <img src={poster(it.thumb)} className="tbl-thumb tbl-thumb--sm" />
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:600, color: i === activeIdx ? "var(--accent)" : "var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.title}</div>
                <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{it.type} · {it.year} · {it.sources} 源</div>
                <span className="pill pill--ok" style={{fontSize:10, marginTop:4}}><span className="dot"/>已通过审核</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center */}
      <div className="split__pane" style={{flex:1, minWidth:0}}>
        <div className="split__pane-head">
          <span style={{fontSize:12, fontWeight:600}}>发布预检</span>
          <span style={{fontSize:12, color:"var(--muted)", marginLeft:8}}>{v.title}</span>
          <span style={{flex:1}}/>
          <button className="btn btn--sm btn--danger">{I.x} 退回审核</button>
          <button className="btn btn--sm btn--primary">{I.upload} 发布上架</button>
        </div>
        <div className="split__pane-body" style={{padding:14}}>
          {/* Readiness checklist */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>发布就绪检查</div>
            {[
              {label:"审核状态", value:"已通过", ok: true},
              {label:"有效线路 ≥ 2", value:`${v.lines} 条`, ok: v.lines >= 2},
              {label:"封面 P0", value: v.badges.includes("封面失效") ? "失效" : "可达", ok: !v.badges.includes("封面失效")},
              {label:"豆瓣匹配", value: v.badges.some(b => b.includes("豆")) ? "未匹配" : "已匹配", ok: !v.badges.some(b => b.includes("豆"))},
              {label:"探测/播放信号", value: v.probe === "ok" ? "全部正常" : "存在异常", ok: v.probe === "ok"},
            ].map((c, i) => (
              <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"var(--bg3)", borderRadius:4, marginBottom:4}}>
                <span style={{color: c.ok ? "var(--ok)" : "var(--warn)"}}>{c.ok ? I.check : I.alert}</span>
                <span style={{flex:1, fontSize:12}}>{c.label}</span>
                <span style={{fontSize:12, fontWeight:600, color: c.ok ? "var(--ok)" : "var(--warn)"}}>{c.value}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex", gap:14}}>
            <img src={poster(v.thumb)} style={{width:80, height:120, borderRadius:6, objectFit:"cover"}} />
            <div style={{flex:1}}>
              <h3 style={{margin:0, fontSize:16, fontWeight:700}}>{v.title}</h3>
              <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>{v.type} · {v.year} · {v.country} · {v.episodes} 集 · ⭐ {v.score}</div>
              <div style={{marginTop:6}}><DualSignal probe={v.probe} render={v.render} /></div>
              <div style={{marginTop:8, display:"flex", gap:4}}>
                {v.badges.map(b => <span key={b} className="pill pill--warn" style={{fontSize:10}}><span className="dot"/>{b}</span>)}
                {!v.badges.length && <span className="pill pill--ok" style={{fontSize:10}}><span className="dot"/>无异常</span>}
              </div>
            </div>
          </div>
          <div style={{marginTop:16, padding:12, background:"var(--bg3)", borderRadius:6}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>发布设置</div>
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <span style={{fontSize:12, color:"var(--muted)", width:80}}>可见性</span>
                <div className="seg" style={{flex:1}}>
                  <span className="seg__btn is-active">公开</span>
                  <span className="seg__btn">仅内部</span>
                  <span className="seg__btn">隐藏</span>
                </div>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <span style={{fontSize:12, color:"var(--muted)", width:80}}>发布时间</span>
                <div className="seg" style={{flex:1}}>
                  <span className="seg__btn is-active">立即</span>
                  <span className="seg__btn">定时</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Rejected tab (已拒绝) ─────────────────────────── */
const REJECTED_VIDEOS = [
  VIDEOS[5], VIDEOS[0],
].map(v => ({...v, review:"rejected", visibility:"hidden", rejectReason: v.id === "v6" ? "重复上传" : "全线路失效无法播放", rejectedBy: v.id === "v6" ? "Mira" : "Yan", rejectedAt: v.id === "v6" ? "3 天前" : "2 小时前"}));

const RejectedTabContent = () => {
  const [activeIdx, setActiveIdx] = useS1(0);
  const v = REJECTED_VIDEOS[activeIdx];
  return (
    <div style={{display:"flex", gap:12, flex:1, minHeight:0}}>
      <div className="split__pane" style={{width:280, flexShrink:0}}>
        <div className="split__pane-head">
          <span className="checkbox" />
          <span style={{fontSize:12, color:"var(--muted)"}}>{REJECTED_VIDEOS.length} 条已拒绝</span>
          <span style={{flex:1}}/>
          <button className="btn btn--xs">{I.trash} 批量删除</button>
        </div>
        <div className="split__pane-body">
          {REJECTED_VIDEOS.map((it, i) => (
            <div
              key={it.id}
              onClick={() => setActiveIdx(i)}
              style={{
                display:"flex", gap:10, padding:"10px 12px",
                borderBottom:"1px solid var(--border-subtle)",
                background: i === activeIdx ? "var(--accent-soft)" : "transparent",
                borderLeft: i === activeIdx ? "2px solid var(--accent)" : "2px solid transparent",
                cursor:"pointer"
              }}
            >
              <img src={poster(it.thumb)} className="tbl-thumb tbl-thumb--sm" style={{opacity:.6}} />
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:600, color: i === activeIdx ? "var(--accent)" : "var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.title}</div>
                <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{it.type} · {it.year}</div>
                <span className="pill pill--danger" style={{fontSize:10, marginTop:4}}><span className="dot"/>已拒绝</span>
              </div>
              <div style={{fontSize:10, color:"var(--muted)", flexShrink:0}}>{it.rejectedAt}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="split__pane" style={{flex:1, minWidth:0}}>
        <div className="split__pane-head">
          <span style={{fontSize:12, fontWeight:600, color:"var(--danger)"}}>已拒绝</span>
          <span style={{fontSize:12, color:"var(--muted)", marginLeft:8}}>{v.title}</span>
          <span style={{flex:1}}/>
          <button className="btn btn--sm">{I.refresh} 重新审核</button>
          <button className="btn btn--sm btn--danger">{I.trash} 永久删除</button>
        </div>
        <div className="split__pane-body" style={{padding:14}}>
          <div className="banner banner--danger" style={{marginBottom:14, alignItems:"flex-start"}}>
            <span style={{color:"var(--danger)", fontSize:18, marginTop:2}}>{I.x}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600}}>拒绝原因</div>
              <div style={{color:"var(--text-2)", marginTop:4, fontSize:12}}>{v.rejectReason}</div>
              <div style={{color:"var(--muted)", marginTop:4, fontSize:11}}>操作人：{v.rejectedBy} · {v.rejectedAt}</div>
            </div>
          </div>
          <div style={{display:"flex", gap:14, marginBottom:14}}>
            <img src={poster(v.thumb)} style={{width:80, height:120, borderRadius:6, objectFit:"cover", opacity:.7}} />
            <div style={{flex:1}}>
              <h3 style={{margin:0, fontSize:16, fontWeight:700, color:"var(--text-2)"}}>{v.title}</h3>
              <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>{v.type} · {v.year} · {v.country} · {v.episodes} 集</div>
              <div style={{marginTop:6}}><DualSignal probe={v.probe} render={v.render} /></div>
              <div style={{marginTop:8, display:"flex", gap:4, flexWrap:"wrap"}}>
                {v.badges.map(b => <span key={b} className="pill pill--danger" style={{fontSize:10}}><span className="dot"/>{b}</span>)}
              </div>
            </div>
          </div>
          <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>操作历史</div>
          <div style={{position:"relative", paddingLeft:18}}>
            <div style={{position:"absolute", left:5, top:6, bottom:6, width:1, background:"var(--border)"}}/>
            {[
              {t: v.rejectedAt, who: v.rejectedBy, e:"拒绝", detail: v.rejectReason, c:"danger"},
              {t:"1 天前", who:"系统", e:"采集入库", detail:"自动入库", c:"info"},
              {t:"2 天前", who:"系统", e:"全站采集", detail:"来源站点匹配", c:"info"},
            ].map((h, i) => (
              <div key={i} style={{position:"relative", paddingBottom:14}}>
                <span style={{position:"absolute", left:-17, top:4, width:9, height:9, borderRadius:"50%", background:`var(--${h.c})`, border:"2px solid var(--bg2)"}}/>
                <div style={{display:"flex", gap:6, alignItems:"baseline"}}>
                  <span style={{fontSize:11, fontWeight:600}}>{h.e}</span>
                  <span style={{fontSize:10, color:"var(--muted)"}}>· {h.who}</span>
                  <span style={{flex:1}}/>
                  <span style={{fontSize:10, color:"var(--muted)"}}>{h.t}</span>
                </div>
                <div style={{fontSize:11, color:"var(--text-2)", marginTop:2}}>{h.detail}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:14, padding:12, background:"var(--bg3)", borderRadius:6}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>可执行操作</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
              <button className="btn btn--sm">{I.refresh} 重新审核</button>
              <button className="btn btn--sm">{I.zap} 补源后重审</button>
              <button className="btn btn--sm btn--danger">{I.trash} 永久删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Main Moderation Console ──────────────────────────── */
const ModerationConsole = () => {
  const [tab, setTab] = useS1("pending");
  const [activeIdx, setActiveIdx] = useS1(1);
  const [rightTab, setRightTab] = useS1("detail");
  const [rightOpen, setRightOpen] = useS1(true);

  useE1(() => {
    const update = () => setRightOpen(window.innerWidth >= 1280);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const list = VIDEOS;
  const v = list[activeIdx] || list[0];

  const tabs = [
    { id:"pending",  label:"待审核",  count:484 },
    { id:"staging",  label:"待发布",  count:23 },
    { id:"rejected", label:"已拒绝",  count:2, color:"danger" },
  ];

  return (
    <div style={{display:"flex", flexDirection:"column", height:"calc(100vh - var(--topbar-h) - 32px)"}}>
      <div className="page__head" style={{marginBottom:8}}>
        <div>
          <h1 className="page__title">内容审核台</h1>
          <div className="page__sub" style={{display:"flex", gap:14, alignItems:"center"}}>
            <span>今天已处理 <strong style={{color:"var(--text)"}}>27</strong> 条 · 通过率 <strong style={{color:"var(--ok)"}}>81%</strong> · 平均决策 <strong>14s</strong></span>
            <span style={{color:"var(--border)"}}>|</span>
            <span><span className="kbd">J</span><span className="kbd">K</span> 切换 · <span className="kbd">A</span> 通过 · <span className="kbd">R</span> 拒 · <span className="kbd">S</span> 跳过</span>
          </div>
        </div>
        <div className="page__actions">
          <button className="btn">{I.filter} 筛选预设 ▾</button>
          <button className="btn">{I.copy} 保存预设</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10, flexShrink:0}}>
        <div className="seg">
          {tabs.map((t) => (
            <span
              key={t.id}
              className={`seg__btn ${tab === t.id ? "is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label} <span className="badge" style={t.color === "danger" ? {background:"var(--danger-soft)", color:"var(--danger)"} : {}}>{t.count}</span>
            </span>
          ))}
        </div>
        {tab === "pending" && (
          <div style={{display:"flex", gap:6, marginLeft:8, alignItems:"center"}}>
            <span className="fchip fchip--active"><span className="fchip__key">类型:</span> 电影 {I.x}</span>
            <span className="fchip"><span className="fchip__key">健康:</span> 包含失效 ▾</span>
          </div>
        )}
      </div>

      {/* Tab content */}
      {tab === "pending" && (
        <div style={{display:"flex", gap:12, flex:1, minHeight:0}}>
          {/* Left list */}
          <div className="split__pane" style={{width:280, flexShrink:0}}>
            <div className="split__pane-head">
              <span className="checkbox" />
              <span style={{fontSize:12, color:"var(--muted)"}}>484 条 · 已选 0</span>
              <span style={{flex:1}}/>
              <span style={{fontSize:11, color:"var(--ok)", display:"flex", alignItems:"center", gap:4}}>
                <span style={{width:6, height:6, borderRadius:"50%", background:"var(--ok)"}}/>键盘流
              </span>
            </div>
            <div className="split__pane-body">
              {list.map((it, i) => (
                <ModListRow key={it.id} it={it} idx={i} active={i === activeIdx} onClick={() => setActiveIdx(i)} />
              ))}
              <div style={{padding:14, textAlign:"center", color:"var(--muted)", fontSize:11}}>— 底部 · 还有 476 条 —</div>
            </div>
          </div>

          {/* Center */}
          <div className="split__pane" style={{flex:1, minWidth:0}}>
            <div className="split__pane-head">
              <span className="kbd">J</span><span className="kbd">K</span>
              <span style={{fontSize:12, color:"var(--muted)"}}>第 {activeIdx + 1} / 484</span>
              <div style={{flex:1, height:4, background:"var(--bg3)", borderRadius:2, marginLeft:8, marginRight:8}}>
                <div style={{height:"100%", width:`${((activeIdx+1)/484)*100}%`, background:"var(--accent)", borderRadius:2}}/>
              </div>
              <button className="btn btn--sm btn--danger">{I.x} 拒绝 <span className="kbd">R</span></button>
              <button className="btn btn--sm">跳过 <span className="kbd">S</span></button>
              <button className="btn btn--sm btn--primary">{I.check} 通过 <span className="kbd">A</span></button>
              <button className="btn btn--sm" onClick={() => setRightOpen(o => !o)} style={{marginLeft:6}}>
                {rightOpen ? I.chevR : I.chevL} 详情
              </button>
            </div>
            <div className="split__pane-body" style={{padding:14}}>
              <PendingCenter v={v} activeIdx={activeIdx} total={484} />
            </div>
          </div>

          {/* Right panel */}
          {rightOpen && (
          <div className="split__pane" style={{width:300, flexShrink:0}}>
            <div className="split__pane-head" style={{padding:0, gap:0}}>
              {[
                {id:"detail", label:"详情"},
                {id:"history", label:"历史", count:8},
                {id:"similar", label:"类似", count:3, color:"warn"},
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setRightTab(t.id)}
                  style={{
                    flex:1, padding:"10px 0", textAlign:"center", fontSize:12, cursor:"pointer",
                    borderBottom: rightTab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                    color: rightTab === t.id ? "var(--text)" : "var(--muted)",
                    fontWeight: rightTab === t.id ? 600 : 500,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:5
                  }}
                >
                  {t.label}
                  {t.count != null && (
                    <span style={{
                      background: t.color==="warn" ? "var(--warn-soft)" : "var(--bg3)",
                      color: t.color==="warn" ? "var(--warn)" : "var(--muted)",
                      padding:"1px 6px", borderRadius:8, fontSize:10
                    }}>{t.count}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="split__pane-body" style={{padding:14, fontSize:12}}>
              {rightTab === "detail" && (
                <>
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:4}}>豆瓣匹配</div>
                    <div style={{display:"flex", gap:8, padding:8, background:"var(--bg3)", borderRadius:6}}>
                      <img src={poster(v.thumb)} style={{width:36, height:54, objectFit:"cover", borderRadius:3}}/>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontWeight:600}}>{v.title}</div>
                        <div style={{color:"var(--muted)", fontSize:11, marginTop:2}}>豆瓣 ID 26277285 · 置信度 <span style={{color:"var(--ok)"}}>92%</span></div>
                        <div style={{marginTop:4, display:"flex", gap:4}}>
                          <button className="btn btn--xs">确认</button>
                          <button className="btn btn--xs btn--ghost">换一个</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:4}}>状态三元组</div>
                    <div style={{display:"flex", flexDirection:"column", gap:6}}>
                      {[
                        ["is_published", v.review === "approved", v.review === "approved" ? "true" : "false"],
                        ["visibility", v.visibility === "public", v.visibility],
                        ["review", v.review === "approved", v.review],
                      ].map(([k, ok, val]) => (
                        <div key={k} style={{display:"flex", justifyContent:"space-between", padding:"4px 8px", background:"var(--bg3)", borderRadius:4}}>
                          <span className="mono" style={{color:"var(--muted)"}}>{k}</span>
                          <span style={{color: ok ? "var(--ok)" : "var(--warn)"}}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:6}}>关键字段</div>
                    <table style={{width:"100%", fontSize:12, borderCollapse:"collapse"}}>
                      <tbody>
                        {[
                          ["演员", "王凯, 江疏影, 韩雪"],
                          ["导演", "黄立行"],
                          ["分类", "悬疑 · 爱情"],
                          ["语言", "普通话"],
                          ["更新", "2 小时前"],
                        ].map(([k,val])=> (
                          <tr key={k} style={{borderBottom:"1px solid var(--border-subtle)"}}>
                            <td style={{padding:"6px 0", color:"var(--muted)", width:50}}>{k}</td>
                            <td style={{padding:"6px 0"}}>{val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {rightTab === "history" && (
                <div style={{position:"relative", paddingLeft:18}}>
                  <div style={{position:"absolute", left:5, top:6, bottom:6, width:1, background:"var(--border)"}}/>
                  {[
                    {t:"刚才", who:"系统", e:"采集入库", detail:"来自 v.lzcdn31.com / iCMS v10", c:"info"},
                    {t:"5m 前", who:"系统", e:"自动合并", detail:"merged → catalog#12 (危险关系)", c:"info"},
                    {t:"5m 前", who:"系统", e:"豆瓣匹配", detail:"置信度 92% · ID 26277285", c:"ok"},
                    {t:"3h 前", who:"Mira", e:"标记为 staffNote", detail:'"封面有水印，先 hold"', c:"warn"},
                    {t:"昨天",  who:"系统", e:"封面失效", detail:"P0 头像 404 → 待修复", c:"danger"},
                    {t:"3 天前", who:"Yan",  e:"批量重验源", detail:"7 条线路 / 3 通过 / 4 失败", c:"info"},
                  ].map((h, i) => (
                    <div key={i} style={{position:"relative", paddingBottom:14}}>
                      <span style={{position:"absolute", left:-17, top:4, width:9, height:9, borderRadius:"50%", background:`var(--${h.c})`, border:"2px solid var(--bg2)"}}/>
                      <div style={{display:"flex", gap:6, alignItems:"baseline"}}>
                        <span style={{fontSize:11, fontWeight:600}}>{h.e}</span>
                        <span style={{fontSize:10, color:"var(--muted)"}}>· {h.who}</span>
                        <span style={{flex:1}}/>
                        <span style={{fontSize:10, color:"var(--muted)"}}>{h.t}</span>
                      </div>
                      <div style={{fontSize:11, color:"var(--text-2)", marginTop:2}}>{h.detail}</div>
                    </div>
                  ))}
                </div>
              )}
              {rightTab === "similar" && (
                <div>
                  <div style={{fontSize:11, color:"var(--muted)", marginBottom:8, lineHeight:1.6}}>
                    根据标题、年份、演员相似度找出可能<strong style={{color:"var(--text)"}}>重复</strong>的视频。
                  </div>
                  {[
                    {title:"危险关系1988", year:1988, country:"US", sim:97, sources:11, thumb:2, why:"标题、演员高度重合"},
                    {title:"危险关系2024", year:2024, country:"FR", sim:84, sources:4,  thumb:1, why:"标题相同 · 演员不同"},
                    {title:"危险关系1990", year:1990, country:"FR", sim:72, sources:2,  thumb:5, why:"翻拍系列"},
                  ].map((s, i) => (
                    <div key={i} style={{display:"flex", gap:8, padding:8, background:"var(--bg3)", borderRadius:6, marginBottom:8}}>
                      <img src={poster(s.thumb)} style={{width:40, height:60, objectFit:"cover", borderRadius:3}}/>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{display:"flex", alignItems:"center", gap:6}}>
                          <span style={{fontWeight:600, fontSize:12, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{s.title}</span>
                          <span style={{fontSize:10, fontWeight:700, color: s.sim > 90 ? "var(--danger)" : s.sim > 80 ? "var(--warn)" : "var(--muted)"}}>{s.sim}%</span>
                        </div>
                        <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{s.year} · {s.country} · {s.sources} 源</div>
                        <div style={{fontSize:10, color:"var(--muted)", marginTop:2, fontStyle:"italic"}}>{s.why}</div>
                        <div style={{marginTop:4, display:"flex", gap:4}}>
                          <button className="btn btn--xs">{I.layers} 合并</button>
                          <button className="btn btn--xs btn--ghost">{I.external}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {tab === "staging" && <StagingTabContent />}
      {tab === "rejected" && <RejectedTabContent />}
    </div>
  );
};

Object.assign(window, { Dashboard, ModerationConsole });
