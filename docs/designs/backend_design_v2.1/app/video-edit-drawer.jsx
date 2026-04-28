/* global React, I, Icon, VIDEOS, SITES, poster, DualSignal, VisChip, Spark */
/* VideoEditDrawer — global reusable video editing drawer + fullscreen mode */
const { useState: dUS, useEffect: dUE, useRef: dUR, useCallback: dUC } = React;

/* ── Drawer Shell ─────────────────────────────────────── */
const DrawerOverlay = ({ open, onClose, children, fullscreen, onToggleFullscreen, title }) => {
  dUE(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  if (fullscreen) {
    return (
      <div style={{position:"fixed", inset:0, zIndex:200, background:"var(--bg0)", display:"flex", flexDirection:"column"}}>
        <div style={{display:"flex", alignItems:"center", gap:10, padding:"10px 18px", borderBottom:"1px solid var(--border)", background:"var(--bg1)", flexShrink:0}}>
          <button className="btn btn--xs" onClick={onClose}>{I.chevLeft} 返回</button>
          <span style={{fontSize:14, fontWeight:700}}>{title}</span>
          <span style={{flex:1}}/>
          <button className="btn btn--xs" onClick={onToggleFullscreen} title="退出全屏">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            <span>退出全屏</span>
          </button>
        </div>
        <div style={{flex:1, overflow:"auto"}}>{children}</div>
      </div>
    );
  }

  return (
    <div style={{position:"fixed", inset:0, zIndex:200, display:"flex", justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{position:"absolute", inset:0, background:"var(--bg-overlay)"}}/>
      <div
        style={{
          position:"relative", width:680, maxWidth:"90vw", height:"100vh",
          background:"var(--bg1)", borderLeft:"1px solid var(--border)",
          boxShadow:"var(--shadow-lg)", display:"flex", flexDirection:"column",
          animation:"drawer-in .2s ease"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes drawer-in { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        <div style={{display:"flex", alignItems:"center", gap:10, padding:"12px 18px", borderBottom:"1px solid var(--border)", flexShrink:0}}>
          <span style={{fontSize:14, fontWeight:700, flex:1}}>{title}</span>
          <button className="btn btn--xs" onClick={onToggleFullscreen} title="全屏编辑">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            <span>全屏</span>
          </button>
          <button className="btn btn--xs" onClick={onClose}>{I.x}</button>
        </div>
        <div style={{flex:1, overflow:"auto"}}>{children}</div>
      </div>
    </div>
  );
};

/* ── Form field helpers ─────────────────────────────── */
const Field = ({ label, children, sub }) => (
  <div style={{marginBottom:14}}>
    <div style={{fontSize:11, color:"var(--muted)", marginBottom:4, display:"flex", alignItems:"center", gap:6}}>
      {label}
      {sub && <span style={{fontSize:10, color:"var(--muted-2)"}}>{sub}</span>}
    </div>
    {children}
  </div>
);

const FieldRow = ({ children }) => (
  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>{children}</div>
);

/* ── Tab: 基础信息 ──────────────────────────────── */
const TabBasicInfo = ({ v, fullscreen }) => (
  <div style={{maxWidth: fullscreen ? 720 : "none", margin: fullscreen ? "0 auto" : 0}}>
    <FieldRow>
      <Field label="标题"><input className="inp" defaultValue={v.title}/></Field>
      <Field label="原名"><input className="inp" defaultValue={v.title} style={{color:"var(--muted)"}}/></Field>
    </FieldRow>
    <FieldRow>
      <Field label="类型">
        <select className="inp"><option>{v.type}</option><option>电影</option><option>剧集</option><option>动漫</option><option>综艺</option></select>
      </Field>
      <Field label="年份"><input className="inp" type="number" defaultValue={v.year}/></Field>
    </FieldRow>
    <FieldRow>
      <Field label="国家/地区"><input className="inp" defaultValue={v.country}/></Field>
      <Field label="语言"><input className="inp" defaultValue="普通话"/></Field>
    </FieldRow>
    <Field label="分类标签" sub="逗号分隔">
      <input className="inp" defaultValue="悬疑, 爱情, 犯罪"/>
    </Field>
    <FieldRow>
      <Field label="总集数"><input className="inp" type="number" defaultValue={v.episodes}/></Field>
      <Field label="更新状态">
        <select className="inp"><option>完结</option><option>连载中</option><option>未定</option></select>
      </Field>
    </FieldRow>
    <Field label="简介">
      <textarea className="inp" rows={4} defaultValue={`${v.title}是一部${v.year}年的${v.country}${v.type}，讲述了一段充满悬疑色彩的故事。`}/>
    </Field>
    <Field label="演员" sub="逗号分隔">
      <input className="inp" defaultValue="王凯, 江疏影, 韩雪"/>
    </Field>
    <Field label="导演">
      <input className="inp" defaultValue="黄立行"/>
    </Field>
    <FieldRow>
      <Field label="可见性">
        <select className="inp">
          <option value="public" selected={v.visibility === "public"}>公开 (public)</option>
          <option value="internal" selected={v.visibility === "internal"}>仅内部 (internal)</option>
          <option value="hidden" selected={v.visibility === "hidden"}>隐藏 (hidden)</option>
        </select>
      </Field>
      <Field label="审核状态">
        <div style={{display:"flex", alignItems:"center", gap:6, padding:"6px 0"}}>
          <VisChip visibility={v.visibility} review={v.review} />
          <span style={{fontSize:11, color:"var(--muted)"}}>{v.review}</span>
        </div>
      </Field>
    </FieldRow>
    <Field label="内部备注">
      <textarea className="inp" rows={2} defaultValue={v.staffNote || ""} placeholder="仅管理员可见"/>
    </Field>
  </div>
);

/* ── Tab: 线路管理 ──────────────────────────────── */
const EDIT_LINES = [
  {id:"el1", name:"线路 1", alias:"高清线", host:"lzcaiji.com", probe:"ok", render:"ok", enabled:true, ms:182, episodes:[1,2,3,4,5,6,7,8]},
  {id:"el2", name:"线路 2", alias:"", host:"yzzy.cdn", probe:"all_dead", render:"ok", enabled:true, ms:241, episodes:[1,2,3,4,5]},
  {id:"el3", name:"线路 3", alias:"备用", host:"hhzy", probe:"all_dead", render:"all_dead", enabled:false, ms:null, episodes:[1,2,3]},
  {id:"el4", name:"线路 4", alias:"", host:"360zy", probe:"ok", render:"ok", enabled:true, ms:96, episodes:[1,2,3,4,5,6,7,8]},
  {id:"el5", name:"线路 5", alias:"", host:"bfzy", probe:"partial", render:"ok", enabled:true, ms:312, episodes:[1,2,3,4,5,6]},
];

const TabLines = ({ v, fullscreen }) => {
  const [lines, setLines] = dUS(EDIT_LINES);
  const [dragIdx, setDragIdx] = dUS(null);
  const [editingAlias, setEditingAlias] = dUS(null);

  const toggle = (id) => setLines(ls => ls.map(l => l.id === id ? {...l, enabled: !l.enabled} : l));
  const onDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setLines(prev => { const n = [...prev]; const [item] = n.splice(dragIdx, 1); n.splice(idx, 0, item); return n; });
    setDragIdx(idx);
  };
  const onDragEnd = () => setDragIdx(null);
  const updateAlias = (id, val) => setLines(ls => ls.map(l => l.id === id ? {...l, alias: val} : l));
  const enabledCount = lines.filter(l => l.enabled).length;

  return (
    <div style={{maxWidth: fullscreen ? 900 : "none", margin: fullscreen ? "0 auto" : 0}}>
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
        <span style={{fontSize:13, fontWeight:600}}>线路列表</span>
        <span style={{fontSize:11, color:"var(--muted)"}}>{enabledCount}/{lines.length} 启用</span>
        <span style={{flex:1}}/>
        <button className="btn btn--xs">{I.refresh} 重测全部</button>
        <button className="btn btn--xs btn--danger">{I.trash} 清理全失效</button>
      </div>

      <div style={{border:"1px solid var(--border)", borderRadius:6, overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"grid", gridTemplateColumns:"28px 1fr 100px 90px 70px 90px 60px", gap:0, padding:"8px 10px", background:"var(--bg3)", fontSize:10, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5, borderBottom:"1px solid var(--border)"}}>
          <span></span><span>线路</span><span>别名</span><span>探测</span><span>播放</span><span>集数</span><span>操作</span>
        </div>

        {lines.map((line, idx) => {
          const probeC = line.probe === "ok" ? "ok" : line.probe === "partial" ? "warn" : "danger";
          const renderC = line.render === "ok" ? "ok" : line.render === "partial" ? "warn" : "danger";
          return (
            <div
              key={line.id}
              draggable
              onDragStart={(e) => onDragStart(e, idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
              style={{
                display:"grid", gridTemplateColumns:"28px 1fr 100px 90px 70px 90px 60px",
                gap:0, padding:"8px 10px", alignItems:"center",
                borderBottom: idx < lines.length - 1 ? "1px solid var(--border-subtle)" : "none",
                opacity: line.enabled ? 1 : 0.45,
                background: dragIdx === idx ? "var(--accent-soft)" : "transparent",
                transition:"background .1s"
              }}
            >
              <span style={{cursor:"grab", color:"var(--muted-2)", fontSize:12, userSelect:"none"}}>⠿</span>
              <div>
                <div style={{fontSize:12, fontWeight:600}}>{line.name}</div>
                <div className="mono" style={{fontSize:10, color:"var(--muted)"}}>{line.host}</div>
              </div>
              <div>
                {editingAlias === line.id ? (
                  <input
                    className="inp inp--sm"
                    defaultValue={line.alias}
                    autoFocus
                    onBlur={(e) => { updateAlias(line.id, e.target.value); setEditingAlias(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                    style={{width:"100%"}}
                  />
                ) : (
                  <span
                    onClick={() => setEditingAlias(line.id)}
                    style={{fontSize:11, color: line.alias ? "var(--text-2)" : "var(--muted-2)", cursor:"pointer", padding:"2px 4px", borderRadius:3, border:"1px dashed var(--border)"}}
                  >{line.alias || "点击设置"}</span>
                )}
              </div>
              <span className={`pill pill--${probeC}`} style={{fontSize:10}}><span className="dot"/>{line.probe === "ok" ? "可达" : line.probe === "partial" ? "部分" : "失效"}</span>
              <span className={`pill pill--${renderC}`} style={{fontSize:10}}><span className="dot"/>{line.render === "ok" ? "可播" : line.render === "partial" ? "部分" : "不可播"}</span>
              <span style={{fontSize:11, color:"var(--muted)"}}>{line.episodes.length} 集</span>
              <div style={{display:"flex", gap:3}}>
                <button className="btn btn--xs" onClick={() => toggle(line.id)} title={line.enabled ? "隐藏" : "显示"}>
                  {line.enabled ? I.eye : I.eyeOff}
                </button>
                <button className="btn btn--xs" title="更多">{I.more}</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:12, fontSize:11, color:"var(--muted)", display:"flex", alignItems:"center", gap:6}}>
        {I.alert} 拖拽手柄 ⠿ 可调整线路播放优先级，排在前面的线路默认优先播放。
      </div>
    </div>
  );
};

/* ── Tab: 图片管理 ──────────────────────────────── */
const IMG_SLOTS = [
  { key:"cover", label:"封面 (P0)", desc:"竖版海报 2:3", required:true, url: null, thumbIdx: 0 },
  { key:"banner", label:"横版 Banner", desc:"16:9 推荐位用", required:false, url: null, thumbIdx: 1 },
  { key:"bg", label:"背景大图", desc:"模糊背景用", required:false, url: null, thumbIdx: 2 },
  { key:"logo", label:"标题 Logo", desc:"片名 PNG 透明底", required:false, url: null, thumbIdx: null },
  { key:"still1", label:"剧照 1", desc:"可选", required:false, url: null, thumbIdx: 3 },
  { key:"still2", label:"剧照 2", desc:"可选", required:false, url: null, thumbIdx: null },
];

const ImgSlot = ({ slot, onUpload }) => {
  const hasImg = slot.thumbIdx !== null;
  return (
    <div style={{border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", background:"var(--bg3)"}}>
      {/* Preview */}
      <div style={{
        aspectRatio: slot.key === "cover" ? "2/3" : slot.key === "logo" ? "3/1" : "16/9",
        background:"var(--bg0)", position:"relative", overflow:"hidden",
        display:"flex", alignItems:"center", justifyContent:"center"
      }}>
        {hasImg ? (
          <img src={poster(slot.thumbIdx)} style={{width:"100%", height:"100%", objectFit:"cover"}}/>
        ) : (
          <div style={{color:"var(--muted-2)", display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
            {I.image}
            <span style={{fontSize:10}}>暂无图片</span>
          </div>
        )}
        {hasImg && (
          <div style={{position:"absolute", top:4, right:4, display:"flex", gap:3}}>
            <button className="btn btn--xs" style={{background:"rgba(0,0,0,.6)", borderColor:"rgba(255,255,255,.2)", color:"white"}}>{I.external}</button>
            <button className="btn btn--xs" style={{background:"rgba(0,0,0,.6)", borderColor:"rgba(255,255,255,.2)", color:"var(--danger)"}}>{I.trash}</button>
          </div>
        )}
      </div>
      {/* Meta */}
      <div style={{padding:"8px 10px"}}>
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <span style={{fontSize:12, fontWeight:600}}>{slot.label}</span>
          {slot.required && <span style={{fontSize:9, color:"var(--danger)", fontWeight:700}}>必填</span>}
          {hasImg && <span className="pill pill--ok" style={{fontSize:9, marginLeft:"auto"}}><span className="dot"/>可用</span>}
          {!hasImg && <span className="pill pill--warn" style={{fontSize:9, marginLeft:"auto"}}><span className="dot"/>缺失</span>}
        </div>
        <div style={{fontSize:10, color:"var(--muted)", marginTop:2}}>{slot.desc}</div>
        <div style={{marginTop:6, display:"flex", gap:4}}>
          <button className="btn btn--xs" style={{flex:1}}>{I.upload} 上传</button>
          <button className="btn btn--xs" style={{flex:1}}>{I.link} URL</button>
        </div>
      </div>
    </div>
  );
};

const TabImages = ({ v, fullscreen }) => {
  const [urlInput, setUrlInput] = dUS(false);
  return (
    <div style={{maxWidth: fullscreen ? 900 : "none", margin: fullscreen ? "0 auto" : 0}}>
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
        <span style={{fontSize:13, fontWeight:600}}>图片素材</span>
        <span style={{fontSize:11, color:"var(--muted)"}}>3/6 已上传</span>
        <span style={{flex:1}}/>
        <button className="btn btn--xs">{I.refresh} 重新检测可达性</button>
      </div>

      {/* URL batch input */}
      {urlInput ? (
        <div style={{marginBottom:14, padding:12, background:"var(--bg3)", borderRadius:6}}>
          <div style={{fontSize:11, color:"var(--muted)", marginBottom:6}}>批量添加图片 URL — 每行一个，格式：<code>slot_key|URL</code></div>
          <textarea className="inp mono" rows={4} placeholder={"cover|https://img.example.com/cover.jpg\nbanner|https://img.example.com/banner.jpg"}/>
          <div style={{display:"flex", gap:6, marginTop:6, justifyContent:"flex-end"}}>
            <button className="btn btn--xs" onClick={() => setUrlInput(false)}>取消</button>
            <button className="btn btn--xs btn--primary">确认导入</button>
          </div>
        </div>
      ) : (
        <div style={{marginBottom:14}}>
          <button className="btn btn--xs" onClick={() => setUrlInput(true)}>{I.link} 批量 URL 导入</button>
        </div>
      )}

      <div style={{display:"grid", gridTemplateColumns: fullscreen ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap:12}}>
        {IMG_SLOTS.map(slot => <ImgSlot key={slot.key} slot={{...slot, thumbIdx: slot.key === "cover" ? v.thumb : slot.thumbIdx}} />)}
      </div>
    </div>
  );
};

/* ── Tab: 豆瓣 / 元数据 ──────────────────────────── */
const TabDouban = ({ v, fullscreen }) => (
  <div style={{maxWidth: fullscreen ? 720 : "none", margin: fullscreen ? "0 auto" : 0}}>
    {/* Match status */}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:13, fontWeight:600, marginBottom:8}}>豆瓣匹配</div>
      <div style={{display:"flex", gap:12, padding:12, background:"var(--bg3)", borderRadius:6, alignItems:"center"}}>
        <img src={poster(v.thumb)} style={{width:48, height:72, borderRadius:4, objectFit:"cover"}}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:600, fontSize:13}}>{v.title}</div>
          <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>豆瓣 ID <code className="mono">26277285</code> · 置信度 <span style={{color:"var(--ok)", fontWeight:600}}>92%</span></div>
          <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>评分：<span style={{color:"var(--accent)", fontWeight:600}}>{v.score}</span> · {v.year} · {v.country}</div>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:4}}>
          <button className="btn btn--xs btn--primary">{I.check} 确认匹配</button>
          <button className="btn btn--xs">{I.refresh} 重新搜索</button>
          <button className="btn btn--xs btn--ghost">{I.edit} 手动输入 ID</button>
        </div>
      </div>
    </div>

    {/* Imported fields */}
    <div style={{marginBottom:16}}>
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
        <span style={{fontSize:13, fontWeight:600}}>豆瓣导入字段</span>
        <button className="btn btn--xs">{I.download} 全部拉取覆盖</button>
      </div>
      <div style={{border:"1px solid var(--border)", borderRadius:6, overflow:"hidden"}}>
        {[
          {field:"标题", local: v.title, douban: v.title, synced: true},
          {field:"年份", local: String(v.year), douban: String(v.year), synced: true},
          {field:"评分", local: String(v.score), douban: "7.6", synced: true},
          {field:"简介", local:"（本地）一段充满悬疑色彩…", douban:"（豆瓣）法国经典改编…", synced: false},
          {field:"演员", local:"王凯, 江疏影", douban:"王凯, 江疏影, 韩雪", synced: false},
          {field:"导演", local:"黄立行", douban:"黄立行", synced: true},
          {field:"封面", local:"本地 URL", douban:"豆瓣 URL", synced: false},
        ].map((r, i) => (
          <div key={r.field} style={{
            display:"grid", gridTemplateColumns:"80px 1fr 1fr 70px",
            gap:0, padding:"8px 10px", alignItems:"center",
            borderBottom: i < 6 ? "1px solid var(--border-subtle)" : "none",
            fontSize:12
          }}>
            <span style={{color:"var(--muted)", fontWeight:600, fontSize:11}}>{r.field}</span>
            <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{r.local}</span>
            <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--info)"}}>{r.douban}</span>
            {r.synced ? (
              <span className="pill pill--ok" style={{fontSize:10, justifySelf:"end"}}><span className="dot"/>一致</span>
            ) : (
              <button className="btn btn--xs" style={{justifySelf:"end"}}>{I.download} 用豆瓣</button>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Manual douban ID */}
    <Field label="手动指定豆瓣 ID" sub="如果自动匹配不准确">
      <div style={{display:"flex", gap:8}}>
        <input className="inp" placeholder="输入豆瓣 ID（如 26277285）" style={{flex:1}}/>
        <button className="btn btn--xs">{I.search} 查找</button>
      </div>
    </Field>
  </div>
);

/* ── Main VideoEditDrawer ─────────────────────────── */
const VideoEditDrawer = ({ open, onClose, videoId }) => {
  const [tab, setTab] = dUS("basic");
  const [fullscreen, setFullscreen] = dUS(false);
  const [dirty, setDirty] = dUS(false);

  const v = VIDEOS.find(v => v.id === videoId) || VIDEOS[0];

  const tabs = [
    { id:"basic",  label:"基础信息", icon: I.doc },
    { id:"lines",  label:"线路管理", icon: I.link },
    { id:"images", label:"图片素材", icon: I.image },
    { id:"douban", label:"豆瓣/元数据", icon: I.database },
  ];

  const content = (
    <div style={{display:"flex", flexDirection:"column", height:"100%"}}>
      {/* Tabs */}
      <div style={{display:"flex", alignItems:"center", gap:0, padding:"0 18px", borderBottom:"1px solid var(--border)", flexShrink:0, background:"var(--bg2)"}}>
        <div className="seg" style={{border:"none", background:"transparent", padding:0}}>
          {tabs.map(t => (
            <span key={t.id} className={`seg__btn ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)} style={{padding:"8px 12px"}}>
              <span style={{opacity:.7}}>{t.icon}</span> {t.label}
            </span>
          ))}
        </div>
        <span style={{flex:1}}/>
        {dirty && <span style={{fontSize:10, color:"var(--warn)", display:"flex", alignItems:"center", gap:4}}>{I.alert} 有未保存更改</span>}
      </div>

      {/* Video quick header */}
      <div style={{display:"flex", gap:10, padding:"10px 18px", background:"var(--bg3)", borderBottom:"1px solid var(--border)", flexShrink:0, alignItems:"center"}}>
        <img src={poster(v.thumb)} style={{width:32, height:48, borderRadius:3, objectFit:"cover"}}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{v.title}</div>
          <div style={{fontSize:11, color:"var(--muted)"}}>ID <code className="mono">{v.id}</code> · {v.type} · {v.year} · {v.sources} 源</div>
        </div>
        <VisChip visibility={v.visibility} review={v.review} />
        <DualSignal probe={v.probe} render={v.render} />
      </div>

      {/* Tab content */}
      <div style={{flex:1, overflow:"auto", padding:"18px 18px 100px"}} onChange={() => setDirty(true)}>
        {tab === "basic" && <TabBasicInfo v={v} fullscreen={fullscreen} />}
        {tab === "lines" && <TabLines v={v} fullscreen={fullscreen} />}
        {tab === "images" && <TabImages v={v} fullscreen={fullscreen} />}
        {tab === "douban" && <TabDouban v={v} fullscreen={fullscreen} />}
      </div>

      {/* Footer */}
      <div style={{
        display:"flex", alignItems:"center", gap:8,
        padding:"10px 18px", borderTop:"1px solid var(--border)",
        background:"var(--bg2)", flexShrink:0
      }}>
        <span style={{fontSize:11, color:"var(--muted)"}}>最后编辑 · 2 小时前 · Yan Liu</span>
        <span style={{flex:1}}/>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn--primary" onClick={() => { setDirty(false); }}>{I.check} 保存更改</button>
      </div>
    </div>
  );

  return (
    <DrawerOverlay
      open={open}
      onClose={onClose}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen(f => !f)}
      title={`编辑 · ${v.title}`}
    >
      {content}
    </DrawerOverlay>
  );
};

Object.assign(window, { VideoEditDrawer, DrawerOverlay, Field, FieldRow });
