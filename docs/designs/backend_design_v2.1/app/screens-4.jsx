/* global React, I, Icon */
/* §09 Developer Mode — Tokens / Semantic / Components
   §10 Modal Spec — Modal / Drawer / Popover decision flow */
const { useState: s4US, useEffect: s4UE } = React;

/* ══════════════════════════════════════════════════════
   §09  Developer Mode
   ══════════════════════════════════════════════════════ */

/* ── Shared table row for token/semantic tables ──────── */
const TRow = ({ cols, borderless }) => (
  <div style={{
    display:"grid",
    gridTemplateColumns: cols.map(c => c.w || "1fr").join(" "),
    gap:0,
    padding:"6px 10px",
    borderBottom: borderless ? "none" : "1px solid var(--border-subtle)",
    alignItems:"center",
    fontSize:11,
  }}>
    {cols.map((c, i) => (
      <div key={i} style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", ...c.style}}>
        {c.content}
      </div>
    ))}
  </div>
);

const THead = ({ cols }) => (
  <div style={{
    display:"grid",
    gridTemplateColumns: cols.map(c => c.w || "1fr").join(" "),
    gap:0,
    padding:"5px 10px",
    background:"var(--bg3)",
    borderBottom:"1px solid var(--border)",
    fontSize:10,
    fontWeight:700,
    color:"var(--muted)",
    textTransform:"uppercase",
    letterSpacing:.5,
    position:"sticky",
    top:0,
    zIndex:1,
  }}>
    {cols.map((c, i) => <div key={i}>{c.label}</div>)}
  </div>
);

const TSection = ({ label }) => (
  <div style={{
    padding:"5px 10px 3px",
    fontSize:10,
    fontWeight:700,
    color:"var(--accent)",
    background:"var(--bg3)",
    borderBottom:"1px solid var(--border-subtle)",
    textTransform:"uppercase",
    letterSpacing:.7,
    marginTop:4,
  }}>{label}</div>
);

/* ── Left column: Tokens table ───────────────────────── */
const DevTokensTable = () => {
  const cols = [
    { label:"变量", w:"120px" },
    { label:"值", w:"1fr" },
    { label:"预览", w:"36px" },
  ];

  const sections = [
    { label:"颜色 · Accent", rows: [
      ["--accent",        "#f59e0b",                  <div style={{width:28,height:14,borderRadius:3,background:"var(--accent)",border:"1px solid var(--border)"}}/>],
      ["--accent-hover",  "#fbbf24",                  <div style={{width:28,height:14,borderRadius:3,background:"var(--accent-hover)",border:"1px solid var(--border)"}}/>],
      ["--accent-soft",   "rgba(245,158,11,.12)",      <div style={{width:28,height:14,borderRadius:3,background:"var(--accent-soft)",border:"1px solid var(--border)"}}/>],
    ]},
    { label:"颜色 · 状态", rows: [
      ["--ok",      "#22c55e", <div style={{width:28,height:14,borderRadius:3,background:"var(--ok)",border:"1px solid var(--border)"}}/>],
      ["--warn",    "#f59e0b", <div style={{width:28,height:14,borderRadius:3,background:"var(--warn)",border:"1px solid var(--border)"}}/>],
      ["--danger",  "#ef4444", <div style={{width:28,height:14,borderRadius:3,background:"var(--danger)",border:"1px solid var(--border)"}}/>],
      ["--info",    "#3b82f6", <div style={{width:28,height:14,borderRadius:3,background:"var(--info)",border:"1px solid var(--border)"}}/>],
      ["--probe",   "#38bdf8", <div style={{width:28,height:14,borderRadius:3,background:"var(--probe)",border:"1px solid var(--border)"}}/>],
      ["--render",  "#a855f7", <div style={{width:28,height:14,borderRadius:3,background:"var(--render)",border:"1px solid var(--border)"}}/>],
    ]},
    { label:"颜色 · 表面", rows: [
      ["--bg0",  "#0b0d10",  <div style={{width:28,height:14,borderRadius:3,background:"var(--bg0)",border:"1px solid var(--border)"}}/>],
      ["--bg1",  "#11141a",  <div style={{width:28,height:14,borderRadius:3,background:"var(--bg1)",border:"1px solid var(--border)"}}/>],
      ["--bg2",  "#161a22",  <div style={{width:28,height:14,borderRadius:3,background:"var(--bg2)",border:"1px solid var(--border)"}}/>],
      ["--bg3",  "#1d222c",  <div style={{width:28,height:14,borderRadius:3,background:"var(--bg3)",border:"1px solid var(--border)"}}/>],
      ["--bg4",  "#252b37",  <div style={{width:28,height:14,borderRadius:3,background:"var(--bg4)",border:"1px solid var(--border)"}}/>],
    ]},
    { label:"间距 · Spacing", rows: [
      ["--s-1","4px",  <div style={{height:8,width:4,background:"var(--accent)",borderRadius:1}}/>],
      ["--s-2","8px",  <div style={{height:8,width:8,background:"var(--accent)",borderRadius:1}}/>],
      ["--s-3","12px", <div style={{height:8,width:12,background:"var(--accent)",borderRadius:1}}/>],
      ["--s-4","16px", <div style={{height:8,width:16,background:"var(--accent)",borderRadius:1}}/>],
      ["--s-5","20px", <div style={{height:8,width:20,background:"var(--accent)",borderRadius:1}}/>],
      ["--s-6","24px", <div style={{height:8,width:24,background:"var(--accent)",borderRadius:1}}/>],
    ]},
    { label:"圆角 · Radii", rows: [
      ["--r-1","4px",  <div style={{width:28,height:14,background:"var(--accent-soft)",border:"1px solid var(--accent)",borderRadius:4}}/>],
      ["--r-2","6px",  <div style={{width:28,height:14,background:"var(--accent-soft)",border:"1px solid var(--accent)",borderRadius:6}}/>],
      ["--r-3","8px",  <div style={{width:28,height:14,background:"var(--accent-soft)",border:"1px solid var(--accent)",borderRadius:8}}/>],
      ["--r-4","12px", <div style={{width:28,height:14,background:"var(--accent-soft)",border:"1px solid var(--accent)",borderRadius:12}}/>],
      ["--r-full","999px",<div style={{width:28,height:14,background:"var(--accent-soft)",border:"1px solid var(--accent)",borderRadius:999}}/>],
    ]},
    { label:"字号 · Type Scale", rows: [
      ["--fs-11","11px",<span style={{fontSize:11,color:"var(--text-2)",fontWeight:500}}>Aa</span>],
      ["--fs-12","12px",<span style={{fontSize:12,color:"var(--text-2)",fontWeight:500}}>Aa</span>],
      ["--fs-13","13px",<span style={{fontSize:13,color:"var(--text-2)",fontWeight:500}}>Aa</span>],
      ["--fs-14","14px",<span style={{fontSize:14,color:"var(--text-2)",fontWeight:500}}>Aa</span>],
      ["--fs-16","16px",<span style={{fontSize:16,color:"var(--text-2)",fontWeight:500}}>Aa</span>],
      ["--fs-20","20px",<span style={{fontSize:20,color:"var(--text-2)",fontWeight:500}}>Aa</span>],
    ]},
  ];

  return (
    <div>
      <THead cols={cols.map(c => ({label:c.label, w:c.w}))} />
      {sections.map(sec => (
        <React.Fragment key={sec.label}>
          <TSection label={sec.label} />
          {sec.rows.map(([name, value, preview], i) => (
            <TRow key={i} cols={[
              { w:"120px", content: <code className="mono" style={{fontSize:10,color:"var(--accent)"}}>{name}</code> },
              { w:"1fr",   content: <code className="mono" style={{fontSize:10,color:"var(--muted)"}}>{value}</code> },
              { w:"36px",  content: preview },
            ]} />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

/* ── Middle column: Semantic mapping table ───────────── */
const DevSemanticTable = () => {
  const cols = [
    { label:"语义名",  w:"1fr" },
    { label:"映射",    w:"90px" },
    { label:"描述",    w:"80px" },
  ];

  const sections = [
    { label:"布局 · Layout", rows: [
      ["sidebar-w",           "232px",        "展开宽"],
      ["sidebar-w-collapsed", "60px",         "折叠宽"],
      ["topbar-h",            "52px",         "顶栏高"],
      ["row-h",               "40px",         "标准行高"],
      ["row-h-compact",       "32px",         "紧凑行高"],
    ]},
    { label:"表面 · Surfaces", rows: [
      ["surface.primary",   "→ --bg-1",  "主背景"],
      ["surface.card",      "→ --bg-2",  "卡片"],
      ["surface.row",       "→ --bg-3",  "行/输入"],
      ["surface.elevated",  "→ --bg-4",  "浮层"],
      ["surface.overlay",   "→ bg-overlay","遮罩"],
    ]},
    { label:"边框 · Borders", rows: [
      ["border.default",  "→ --border",         "默认线"],
      ["border.strong",   "→ --border-strong",  "强线"],
      ["border.subtle",   "→ --border-subtle",  "弱线"],
    ]},
    { label:"文字 · Text", rows: [
      ["text.primary",   "→ --text",      "主要"],
      ["text.secondary", "→ --text-2",    "次要"],
      ["text.muted",     "→ --muted",     "静音"],
      ["text.disabled",  "→ --muted-2",   "禁用"],
      ["text.onAccent",  "→ --on-accent", "反色"],
    ]},
    { label:"操作 · Actions", rows: [
      ["action.primary",  "→ --accent",       "主操作"],
      ["action.hover",    "→ --accent-hover",  "Hover"],
      ["action.soft",     "→ --accent-soft",   "软底色"],
    ]},
    { label:"状态 · Status", rows: [
      ["status.ok",      "→ --ok",      "成功"],
      ["status.warn",    "→ --warn",    "警告"],
      ["status.danger",  "→ --danger",  "危险"],
      ["status.info",    "→ --info",    "信息"],
      ["status.probe",   "→ --probe",   "探测信号"],
      ["status.render",  "→ --render",  "播放信号"],
    ]},
    { label:"圆角 · Radii", rows: [
      ["radius.sm",    "→ --r-1 (4px)",   "行内小元素"],
      ["radius.md",    "→ --r-2 (6px)",   "按钮/pill"],
      ["radius.card",  "→ --r-3 (8px)",   "卡片"],
      ["radius.lg",    "→ --r-4 (12px)",  "Modal"],
    ]},
    { label:"阴影 · Shadows", rows: [
      ["shadow.sm",  "→ --shadow-sm",  "行内"],
      ["shadow.md",  "→ --shadow-md",  "卡片"],
      ["shadow.lg",  "→ --shadow-lg",  "Modal/Drawer"],
    ]},
  ];

  return (
    <div>
      <THead cols={cols.map(c => ({label:c.label, w:c.w}))} />
      {sections.map(sec => (
        <React.Fragment key={sec.label}>
          <TSection label={sec.label} />
          {sec.rows.map(([name, mapping, desc], i) => (
            <TRow key={i} cols={[
              { w:"1fr",  content: <code className="mono" style={{fontSize:10,color:"var(--text-2)"}}>{name}</code> },
              { w:"90px", content: <code className="mono" style={{fontSize:10,color:"var(--ok)"}}>{mapping}</code> },
              { w:"80px", content: <span style={{fontSize:10,color:"var(--muted)"}}>{desc}</span> },
            ]} />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

/* ── Right column: Component live preview (table-based) ─ */
const DevComponentsLivePreview = () => (
  <div style={{display:"flex", flexDirection:"column", gap:20}}>

    {/* Buttons */}
    <div>
      <div style={{fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.6, marginBottom:8}}>Button</div>
      <div style={{border:"1px solid var(--border)", borderRadius:6, overflow:"hidden"}}>
        <THead cols={[{label:"变体",w:"100px"},{label:"预览",w:"1fr"},{label:"类名",w:"120px"},{label:"",w:"40px"}]}/>
        {[
          ["Default",  <button className="btn">默认</button>,         ".btn",             ""],
          ["Primary",  <button className="btn btn--primary">主要</button>,".btn.btn--primary",""],
          ["Ghost",    <button className="btn btn--ghost">幽灵</button>,".btn.btn--ghost",   ""],
          ["Danger",   <button className="btn btn--danger">危险</button>,".btn.btn--danger",  ""],
          ["SM",       <button className="btn btn--sm">小</button>,    ".btn.btn--sm",      ""],
          ["XS",       <button className="btn btn--xs">超小</button>,  ".btn.btn--xs",      ""],
        ].map(([label, preview, cls, _], i) => (
          <TRow key={i} cols={[
            {w:"100px", content:<span style={{fontSize:11,color:"var(--text-2)"}}>{label}</span>},
            {w:"1fr",   content:preview},
            {w:"120px", content:<code className="mono" style={{fontSize:10,color:"var(--muted)"}}>{cls}</code>},
            {w:"40px",  content:<button className="btn btn--xs" style={{padding:"1px 5px"}}>{I.copy}</button>},
          ]}/>
        ))}
      </div>
    </div>

    {/* Pills */}
    <div>
      <div style={{fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.6, marginBottom:8}}>Pill · Badge</div>
      <div style={{border:"1px solid var(--border)", borderRadius:6, overflow:"hidden"}}>
        <THead cols={[{label:"变体",w:"100px"},{label:"预览",w:"1fr"},{label:"类名",w:"120px"},{label:"",w:"40px"}]}/>
        {[
          ["默认",   <span className="pill"><span className="dot"/>默认</span>,              ".pill"],
          ["成功",   <span className="pill pill--ok"><span className="dot"/>成功</span>,     ".pill.pill--ok"],
          ["警告",   <span className="pill pill--warn"><span className="dot"/>警告</span>,   ".pill.pill--warn"],
          ["危险",   <span className="pill pill--danger"><span className="dot"/>危险</span>, ".pill.pill--danger"],
          ["信息",   <span className="pill pill--info"><span className="dot"/>信息</span>,   ".pill.pill--info"],
          ["探测",   <span className="pill pill--probe"><span className="dot"/>探</span>,    ".pill.pill--probe"],
          ["播放",   <span className="pill pill--render"><span className="dot"/>播</span>,   ".pill.pill--render"],
        ].map(([label, preview, cls], i) => (
          <TRow key={i} cols={[
            {w:"100px", content:<span style={{fontSize:11,color:"var(--text-2)"}}>{label}</span>},
            {w:"1fr",   content:preview},
            {w:"120px", content:<code className="mono" style={{fontSize:10,color:"var(--muted)"}}>{cls}</code>},
            {w:"40px",  content:<button className="btn btn--xs" style={{padding:"1px 5px"}}>{I.copy}</button>},
          ]}/>
        ))}
      </div>
    </div>

    {/* Inputs */}
    <div>
      <div style={{fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.6, marginBottom:8}}>Input</div>
      <div style={{border:"1px solid var(--border)", borderRadius:6, overflow:"hidden"}}>
        <THead cols={[{label:"状态",w:"100px"},{label:"预览",w:"1fr"},{label:"说明",w:"120px"},{label:"",w:"40px"}]}/>
        {[
          ["默认",   <input className="inp" placeholder="占位文字" style={{width:"100%"}}/>,       "正常"],
          ["聚焦",   <input className="inp" placeholder="聚焦态" style={{width:"100%",outline:"2px solid var(--accent)"}}/>, "focus-visible"],
          ["错误",   <input className="inp" placeholder="错误态" style={{width:"100%",borderColor:"var(--danger)"}}/>,      "error state"],
          ["Select", <select className="inp" style={{width:"100%"}}><option>选项 A</option><option>选项 B</option></select>,"下拉选择"],
        ].map(([label, preview, desc], i) => (
          <TRow key={i} cols={[
            {w:"100px", content:<span style={{fontSize:11,color:"var(--text-2)"}}>{label}</span>},
            {w:"1fr",   content:preview},
            {w:"120px", content:<span style={{fontSize:10,color:"var(--muted)"}}>{desc}</span>},
            {w:"40px",  content:<button className="btn btn--xs" style={{padding:"1px 5px"}}>{I.copy}</button>},
          ]}/>
        ))}
      </div>
    </div>

    {/* Table rows */}
    <div>
      <div style={{fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.6, marginBottom:8}}>Table Row · 状态</div>
      <div style={{border:"1px solid var(--border)", borderRadius:6, overflow:"hidden"}}>
        <THead cols={[{label:"状态",w:"100px"},{label:"预览",w:"1fr"},{label:"说明",w:"160px"}]}/>
        {[
          ["普通",    <div style={{display:"flex",gap:10,padding:"6px 8px",background:"transparent",borderRadius:4,fontSize:12}}><span className="checkbox"/><span>普通行</span></div>,    "默认背景"],
          ["Hover",   <div style={{display:"flex",gap:10,padding:"6px 8px",background:"var(--bg3)",borderRadius:4,fontSize:12}}><span className="checkbox"/><span>悬停行</span></div>,     "var(--bg3)"],
          ["选中",    <div style={{display:"flex",gap:10,padding:"6px 8px",background:"var(--accent-soft)",border:"1px solid var(--accent-border)",borderRadius:4,fontSize:12}}><span className="checkbox is-checked"/><span style={{color:"var(--accent)"}}>已选行</span></div>,"var(--accent-soft)"],
          ["展开",    <div style={{display:"flex",gap:10,padding:"6px 8px",background:"var(--bg1)",borderRadius:4,fontSize:12,borderLeft:"2px solid var(--accent)"}}><span>▾</span><span>展开父行</span></div>,"var(--bg1) + accent border"],
          ["高亮",    <div style={{display:"flex",gap:10,padding:"6px 8px",background:"var(--ok-soft)",borderRadius:4,fontSize:12}}><span>↑</span><span style={{color:"var(--ok)"}}>乐观更新行</span></div>,"新增/改值 1.5s fade"],
        ].map(([label, preview, desc], i) => (
          <TRow key={i} cols={[
            {w:"100px", content:<span style={{fontSize:11,color:"var(--text-2)"}}>{label}</span>},
            {w:"1fr",   content:preview},
            {w:"160px", content:<span style={{fontSize:10,color:"var(--muted)"}}>{desc}</span>},
          ]}/>
        ))}
      </div>
    </div>

    {/* KPI */}
    <div>
      <div style={{fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.6, marginBottom:8}}>KPI Card</div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
        <div className="kpi"><span className="kpi__label">视频总量</span><span className="kpi__value">695</span><span className="kpi__delta is-up">↑ +47 今日</span></div>
        <div className="kpi is-warn"><span className="kpi__label">待审核</span><span className="kpi__value">484</span><span className="kpi__delta">较昨日 +18</span></div>
        <div className="kpi is-ok"><span className="kpi__label">源可达率</span><span className="kpi__value">98.7%</span><span className="kpi__delta is-up">↑ 0.3pt</span></div>
        <div className="kpi is-danger"><span className="kpi__label">失效源</span><span className="kpi__value">1,939</span><span className="kpi__delta is-down">↓ -28</span></div>
      </div>
    </div>

    {/* Banners */}
    <div>
      <div style={{fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.6, marginBottom:8}}>Banner</div>
      <div style={{display:"flex", flexDirection:"column", gap:6}}>
        <div className="banner"><span style={{color:"var(--info)"}}>{I.bell}</span><div style={{fontSize:12}}>信息提示 <code className="mono">.banner</code></div></div>
        <div className="banner banner--warn"><span style={{color:"var(--warn)"}}>{I.alert}</span><div style={{fontSize:12}}>警告提示 <code className="mono">.banner--warn</code></div></div>
        <div className="banner banner--danger"><span style={{color:"var(--danger)"}}>{I.alert}</span><div style={{fontSize:12}}>危险提示 <code className="mono">.banner--danger</code></div></div>
      </div>
    </div>

    {/* Kbd */}
    <div>
      <div style={{fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.6, marginBottom:8}}>Kbd · 快捷键标签</div>
      <div style={{display:"flex", gap:6, flexWrap:"wrap", alignItems:"center"}}>
        <span className="kbd">⌘</span><span className="kbd">K</span>
        <span style={{fontSize:11, color:"var(--muted)", margin:"0 4px"}}>命令面板</span>
        <span className="kbd">J</span><span className="kbd">K</span>
        <span style={{fontSize:11, color:"var(--muted)", margin:"0 4px"}}>列表导航</span>
        <span className="kbd">A</span>
        <span style={{fontSize:11, color:"var(--muted)"}}>通过审核</span>
      </div>
    </div>
  </div>
);

/* ── §09 Main view — THREE-COLUMN layout matching wireframe ── */
const DevModeView = () => {
  const [theme, s4setTheme] = s4US("dark");

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">开发者模式</h1>
          <div className="page__sub">Design tokens · Semantic variables · Component catalogue · 任意 token 改动 → 整个 UI 即时重渲</div>
        </div>
        <div className="page__actions">
          <button className="btn">{I.copy} 复制 CSS Vars</button>
          <button className="btn btn--primary">{I.download} 导出 tokens.json</button>
        </div>
      </div>

      {/* Three-column panel — matches wireframe §09 */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"260px 300px 1fr",
        gap:0,
        border:"1px solid var(--border)",
        borderRadius:8,
        overflow:"hidden",
        minHeight:540,
        background:"var(--bg2)",
      }}>
        {/* Left: Tokens */}
        <div style={{borderRight:"1px solid var(--border)", background:"var(--bg3)", display:"flex", flexDirection:"column"}}>
          <div style={{padding:"10px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.6, color:"var(--muted)"}}>Tokens · 原始</span>
          </div>
          <div style={{padding:10, flex:1, overflowY:"auto"}}>
            {/* Theme switcher */}
            <div style={{marginBottom:10}}>
              <div className="seg" style={{width:"100%"}}>
                {["dark","light","hc"].map(t => (
                  <span key={t} className={`seg__btn ${theme === t ? "is-active" : ""}`} style={{flex:1, textAlign:"center"}} onClick={() => s4setTheme(t)}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <DevTokensTable />
          </div>
        </div>

        {/* Mid: Semantic mapping */}
        <div style={{borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column"}}>
          <div style={{padding:"10px 14px", borderBottom:"1px solid var(--border)"}}>
            <span style={{fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.6, color:"var(--muted)"}}>Semantic · 语义映射</span>
          </div>
          <div style={{flex:1, overflowY:"auto"}}>
            <DevSemanticTable />
          </div>
          <div style={{padding:"8px 14px", borderTop:"1px solid var(--border)", fontSize:10, color:"var(--muted)"}}>
            可拖拽改 mapping，立即在右侧预览中生效
          </div>
        </div>

        {/* Right: Component live preview */}
        <div style={{display:"flex", flexDirection:"column"}}>
          <div style={{padding:"10px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.6, color:"var(--muted)", flex:1}}>Components · 实时预览</span>
            <select className="inp" style={{width:100, height:26, fontSize:11}}>
              <option>视口: 1440</option>
              <option>视口: 1280</option>
              <option>视口: 768</option>
            </select>
            <span style={{fontSize:11, color:"var(--muted)"}}>{theme}</span>
            <button className="btn btn--xs btn--primary">{I.download} 导出 ▾</button>
          </div>
          <div style={{flex:1, overflowY:"auto", padding:16}}>
            <DevComponentsLivePreview />
          </div>
          <div style={{padding:"8px 14px", borderTop:"1px solid var(--border)", fontSize:10, color:"var(--muted)"}}>
            每个组件附 ▸ 查看代码 / ▸ 复制 token 引用
          </div>
        </div>
      </div>

      {/* Entry info */}
      <div style={{marginTop:12, padding:"10px 14px", background:"var(--bg3)", borderRadius:6, fontSize:11, color:"var(--muted)", display:"flex", gap:24}}>
        <span>正式入口：系统管理 → 开发者模式（仅「开发者」角色可见）</span>
        <span>隐藏入口：URL 加 <code className="mono">?dev=1</code> 任何登录用户均可只读浏览</span>
        <span>编辑历史自动写入审计日志</span>
      </div>
    </>
  );
};




/* ══════════════════════════════════════════════════════
   §10  弹层规范
   ══════════════════════════════════════════════════════ */

const ModalSpecView = () => {
  const [demoModal, setDemoModal] = s4US(false);
  const [demoDrawer, setDemoDrawer] = s4US(false);
  const [demoPopover, setDemoPopover] = s4US(null); // anchor element

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">弹层规范</h1>
          <div className="page__sub">Modal · Drawer · Popover — 判断流程 + 交互规范 + 实例演示</div>
        </div>
      </div>

      {/* Decision flow */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card__head"><div className="card__title">如何选择弹层类型？</div></div>
        <div className="card__body">
          <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, background:"var(--border)"}}>
            {[
              {
                type:"Popover",
                when:"上下文操作、快捷菜单、少量选项",
                size:"< 320px 宽，≤ 6 个选项",
                trigger:"点击图标 / 按钮，hover 慎用",
                dismiss:"点击外部自动关闭",
                examples:["列表行三点菜单","列头筛选菜单","用户头像菜单"],
                color:"info",
              },
              {
                type:"Drawer",
                when:"详情编辑、多字段表单、不离开当前上下文",
                size:"宽 480–720px，右侧滑入",
                trigger:"点击行内编辑、「编辑」按钮",
                dismiss:"点击遮罩或按 Esc",
                examples:["视频编辑 Drawer","审核详情面板","站点配置"],
                color:"accent",
              },
              {
                type:"Modal",
                when:"需要用户明确确认的操作、危险操作、独立流程",
                size:"宽 480–640px，居中",
                trigger:"删除确认、合并确认、高风险操作",
                dismiss:"按钮确认 / 取消，Esc 取消",
                examples:["删除确认","合并拆分确认","批量操作预览"],
                color:"warn",
              },
            ].map((item) => (
              <div key={item.type} style={{background:"var(--bg2)", padding:16}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
                  <span className={`pill pill--${item.color}`} style={{fontSize:13, fontWeight:700, padding:"4px 12px"}}>{item.type}</span>
                </div>
                <div style={{fontSize:11, color:"var(--muted)", marginBottom:6, textTransform:"uppercase", letterSpacing:.5}}>使用场景</div>
                <div style={{fontSize:12, marginBottom:10}}>{item.when}</div>
                <div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>尺寸</div>
                <div className="mono" style={{fontSize:11, marginBottom:10}}>{item.size}</div>
                <div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>触发方式</div>
                <div style={{fontSize:12, marginBottom:10}}>{item.trigger}</div>
                <div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>关闭方式</div>
                <div style={{fontSize:12, marginBottom:10}}>{item.dismiss}</div>
                <div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>本站例子</div>
                <div style={{display:"flex", flexDirection:"column", gap:3}}>
                  {item.examples.map(e => (
                    <span key={e} style={{fontSize:11, display:"flex", alignItems:"center", gap:4}}>
                      <span style={{color:`var(--${item.color})`}}>·</span> {e}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision tree */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card__head"><div className="card__title">判断流程图</div></div>
        <div className="card__body">
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:0, fontSize:12}}>
            {/* Root */}
            <DecisionBox label="需要打开一个弹出层" color="bg3" />
            <DecisionArrow />
            <DecisionBox label="操作需要用户明确确认？（删除/合并/高风险）" color="bg3" isQuestion />
            <div style={{display:"grid", gridTemplateColumns:"1fr 60px 1fr", width:"100%", maxWidth:600}}>
              <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                <div style={{height:24, width:1, background:"var(--border)"}}/>
                <span style={{fontSize:10, color:"var(--ok)", fontWeight:700}}>是</span>
                <div style={{height:12, width:1, background:"var(--border)"}}/>
                <DecisionBox label="Modal（居中，按钮确认）" color="warn" result />
              </div>
              <div style={{display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"var(--muted)"}}>否↓</div>
              <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                <div style={{height:24, width:1, background:"var(--border)"}}/>
                <DecisionBox label="需要展示/编辑大量内容？（表单、详情）" color="bg3" isQuestion />
                <div style={{display:"grid", gridTemplateColumns:"1fr 40px 1fr", width:"100%"}}>
                  <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                    <div style={{height:16, width:1, background:"var(--border)"}}/>
                    <span style={{fontSize:10, color:"var(--ok)", fontWeight:700}}>是</span>
                    <div style={{height:8, width:1, background:"var(--border)"}}/>
                    <DecisionBox label="Drawer（侧边滑入）" color="accent" result />
                  </div>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"var(--muted)"}}>否↓</div>
                  <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                    <div style={{height:16, width:1, background:"var(--border)"}}/>
                    <DecisionBox label="Popover（就地展开，小菜单）" color="info" result />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live demos */}
      <div className="card">
        <div className="card__head"><div className="card__title">实例演示</div></div>
        <div className="card__body" style={{display:"flex", gap:12, flexWrap:"wrap"}}>
          <button className="btn" onClick={() => setDemoModal(true)}>
            {I.layers} 打开 Modal 示例
          </button>
          <button className="btn" onClick={() => setDemoDrawer(true)}>
            {I.edit} 打开 Drawer 示例
          </button>
          <div style={{position:"relative"}}>
            <button className="btn" onClick={(e) => setDemoPopover(demoPopover ? null : e.currentTarget)}>
              {I.more} 打开 Popover 示例
            </button>
            {demoPopover && (
              <div style={{
                position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:50,
                background:"var(--bg4)", border:"1px solid var(--border-strong)",
                borderRadius:"var(--r-3)", boxShadow:"var(--shadow-lg)",
                padding:6, minWidth:180,
              }}>
                {["编辑视频信息","复制链接","移入收藏夹","标记为问题","隐藏视频"].map((item, i) => (
                  <div key={i} onClick={() => { setDemoPopover(null); window.addToast && window.addToast(`执行：${item}`, "info"); }}
                    style={{padding:"7px 10px", fontSize:12, borderRadius:4, cursor:"pointer", color: i === 4 ? "var(--danger)" : "var(--text-2)"}}
                    onMouseOver={(e) => e.currentTarget.style.background = "var(--bg3)"}
                    onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                  >{item}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Demo Modal */}
      {demoModal && (
        <div className="modal-bg" onClick={() => setDemoModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <span className="modal__title">确认删除视频</span>
              <span style={{flex:1}}/>
              <button className="btn btn--xs" onClick={() => setDemoModal(false)}>{I.x}</button>
            </div>
            <div className="modal__body">
              <div className="banner banner--danger" style={{marginBottom:14}}>
                <span style={{color:"var(--danger)"}}>{I.alert}</span>
                <div>此操作不可撤销。视频及其所有播放源将被永久删除。</div>
              </div>
              <div style={{fontSize:12, color:"var(--text-2)", lineHeight:1.6}}>
                你正在删除视频 <strong>危险关系 (2012)</strong>。<br/>
                关联的 <strong>7 条线路</strong> 和 <strong>145,307 个播放源</strong> 也将同步删除。<br/>
                该视频在 <strong>3</strong> 名用户收藏中，删除后将自动移除。
              </div>
            </div>
            <div className="modal__foot">
              <button className="btn" onClick={() => setDemoModal(false)}>取消</button>
              <button className="btn btn--danger" onClick={() => { setDemoModal(false); window.addToast && window.addToast("视频已删除", "ok"); }}>{I.trash} 确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Demo Drawer */}
      {demoDrawer && (
        <div style={{position:"fixed", inset:0, zIndex:200, display:"flex", justifyContent:"flex-end"}} onClick={() => setDemoDrawer(false)}>
          <div style={{position:"absolute", inset:0, background:"var(--bg-overlay)"}}/>
          <div style={{position:"relative", width:480, background:"var(--bg1)", borderLeft:"1px solid var(--border)", boxShadow:"var(--shadow-lg)", display:"flex", flexDirection:"column"}} onClick={(e) => e.stopPropagation()}>
            <div style={{padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:10}}>
              <span style={{fontSize:14, fontWeight:700, flex:1}}>Drawer 示例 · 编辑站点配置</span>
              <button className="btn btn--xs" onClick={() => setDemoDrawer(false)}>{I.x}</button>
            </div>
            <div style={{flex:1, overflow:"auto", padding:18}}>
              <div style={{marginBottom:12, fontSize:11, color:"var(--muted)", lineHeight:1.6}}>
                Drawer 适合编辑内容较多、但不需要离开当前列表的场景。右侧滑入，用户仍能感知到背景内容。
              </div>
              {[["站点名称","豆瓣资源"],["采集 URL","https://dbzy.example.com"],["权重","高"],["更新频率","每 30 分钟"]].map(([k,v]) => (
                <div key={k} style={{marginBottom:12}}>
                  <div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>{k}</div>
                  <input className="inp" defaultValue={v}/>
                </div>
              ))}
            </div>
            <div style={{padding:"10px 18px", borderTop:"1px solid var(--border)", display:"flex", gap:8, justifyContent:"flex-end", background:"var(--bg2)"}}>
              <button className="btn" onClick={() => setDemoDrawer(false)}>取消</button>
              <button className="btn btn--primary" onClick={() => { setDemoDrawer(false); window.addToast && window.addToast("站点配置已保存", "ok"); }}>{I.check} 保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Close popover on outside click */}
      {demoPopover && <div style={{position:"fixed", inset:0, zIndex:49}} onClick={() => setDemoPopover(null)}/>}
    </>
  );
};

/* helpers for decision tree */
const DecisionBox = ({ label, color, isQuestion, result }) => (
  <div style={{
    padding: result ? "8px 14px" : "10px 16px",
    background: color === "bg3" ? "var(--bg3)" : color === "warn" ? "var(--warn-soft)" : color === "accent" ? "var(--accent-soft)" : "var(--info-soft)",
    border: `1px solid ${color === "bg3" ? "var(--border)" : color === "warn" ? "rgba(245,158,11,.4)" : color === "accent" ? "var(--accent-border)" : "rgba(59,130,246,.4)"}`,
    borderRadius: 6, fontSize:12, textAlign:"center",
    maxWidth: result ? 180 : 400, width: "100%",
    color: color === "warn" ? "var(--warn)" : color === "accent" ? "var(--accent)" : color === "info" ? "var(--info)" : "var(--text)",
    fontWeight: result ? 700 : 500,
  }}>
    {isQuestion ? `❓ ${label}` : label}
  </div>
);
const DecisionArrow = () => <div style={{height:20, width:1, background:"var(--border)", margin:"0 auto"}}/>;

Object.assign(window, { DevModeView, ModalSpecView });
