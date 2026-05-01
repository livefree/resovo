/* global React, I, VIDEOS, SITES, poster, DualSignal, VisChip, Spark */
const { useState: uS } = React;

/* ── Sources / Lines (grouped by video, expandable) ──────────── */
const SourcesView = () => {
  const [expanded, setExpanded] = uS({ v1: true, v4: true });
  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">播放源 / 线路</h1>
          <div className="page__sub">按视频分组 · 展开查看线路矩阵 (站点 × 集) · 失效源批量替换</div>
        </div>
        <div className="page__actions">
          <button className="btn">{I.zap} 一键替换最相似 URL</button>
          <button className="btn btn--primary">{I.refresh} 批量验证</button>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginBottom:12}}>
        <div className="kpi"><span className="kpi__label">总播放源</span><span className="kpi__value">145,307</span><span className="kpi__delta is-up">↑ +112 今日</span></div>
        <div className="kpi is-ok"><span className="kpi__label">有效</span><span className="kpi__value">143,368</span><span className="kpi__delta">98.7%</span></div>
        <div className="kpi is-danger"><span className="kpi__label">失效</span><span className="kpi__value">1,939</span><span className="kpi__delta">1.3%</span></div>
        <div className="kpi is-warn"><span className="kpi__label">孤岛 / 用户纠错</span><span className="kpi__value">42</span><span className="kpi__delta">需关联视频</span></div>
      </div>

      <div className="seg" style={{marginBottom:12}}>
        <span className="seg__btn is-active">按视频分组 <span className="badge">695</span></span>
        <span className="seg__btn">仅失效 <span className="badge">1.9k</span></span>
        <span className="seg__btn">用户纠错 <span className="badge">12</span></span>
        <span className="seg__btn">孤岛源 <span className="badge">30</span></span>
      </div>

      <div className="fbar" style={{marginBottom:12}}>
        <input className="inp" placeholder="搜视频名 / URL / 站点 key" style={{width:280}} />
        <span className="fchip"><span className="fchip__key">站点:</span> 全部 ▾</span>
        <span className="fchip"><span className="fchip__key">健康:</span> 含失效 ▾</span>
        <span style={{flex:1}}/>
        <span style={{fontSize:11, color:"var(--muted)"}}>排序：失效数 ↓</span>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:30}}><span className="checkbox"/></th>
              <th>视频</th>
              <th>线路</th>
              <th>集 · 源</th>
              <th>探测</th>
              <th>播放</th>
              <th>更新</th>
              <th style={{width:120}}>操作</th>
            </tr>
          </thead>
          <tbody>
            {VIDEOS.slice(0,5).map((v) => (
              <React.Fragment key={v.id}>
                <tr onClick={() => setExpanded((e) => ({...e, [v.id]: !e[v.id]}))}>
                  <td><span className="checkbox"/></td>
                  <td>
                    <div style={{display:"flex", gap:8, alignItems:"center"}}>
                      <span style={{transform: expanded[v.id] ? "rotate(90deg)" : "rotate(0)", transition:"transform .15s", color:"var(--muted)"}}>{I.chevR}</span>
                      <img src={poster(v.thumb)} className="tbl-thumb tbl-thumb--sm" />
                      <div>
                        <div className="tbl-title">{v.title}</div>
                        <div className="tbl-meta">{v.type} · {v.year} · {v.episodes} 集</div>
                      </div>
                    </div>
                  </td>
                  <td><strong>{v.lines}</strong> <span style={{color:"var(--muted)", fontSize:11}}>条</span></td>
                  <td><strong>{v.sources}</strong> <span style={{color:"var(--muted)", fontSize:11}}>个</span></td>
                  <td><span className={`pill pill--${v.probe==="ok"?"ok":v.probe==="partial"?"warn":"danger"}`}><span className="dot"/>{v.probe==="ok"?"全部可达":v.probe==="partial"?"部分":"全失效"}</span></td>
                  <td><span className={`pill pill--${v.render==="ok"?"ok":v.render==="partial"?"warn":v.render==="all_dead"?"danger":""}`}><span className="dot"/>{v.render==="ok"?"可播":v.render==="partial"?"部分":v.render==="all_dead"?"不可播":"未测"}</span></td>
                  <td style={{color:"var(--muted)", fontSize:11}}>{v.updated}</td>
                  <td>
                    <div style={{display:"flex", gap:4}}>
                      <button className="btn btn--xs">{I.refresh}</button>
                      <button className="btn btn--xs">{I.zap}</button>
                      <button className="btn btn--xs">{I.more}</button>
                    </div>
                  </td>
                </tr>
                {expanded[v.id] && (
                  <tr>
                    <td/>
                    <td colSpan={7} style={{background:"var(--bg1)", padding:"10px 14px"}}>
                      <div style={{fontSize:11, color:"var(--muted)", marginBottom:8}}>线路矩阵 — 行：线路 / 列：集 · 颜色：探测 ✕ 播放 双信号</div>
                      <div style={{display:"grid", gridTemplateColumns:"100px repeat(8, 1fr) 80px", gap:3, fontSize:11}}>
                        <div/>
                        {[1,2,3,4,5,6,7,8].map((ep) => <div key={ep} style={{textAlign:"center", color:"var(--muted)", padding:"2px 0"}}>EP{ep}</div>)}
                        <div style={{textAlign:"center", color:"var(--muted)"}}>操作</div>
                        {[
                          {n:"线路 1 lzcaiji", health:[1,1,1,1,1,1,2,1]},
                          {n:"线路 2 yzzy",    health:[3,3,3,3,3,3,3,3]},
                          {n:"线路 3 hhzy",    health:[3,3,3,3,3,3,3,3]},
                          {n:"线路 4 360zy",   health:[1,1,1,1,1,1,1,2]},
                          {n:"线路 5 bfzy",    health:[1,1,2,1,2,1,3,1]},
                        ].map((row, ri) => (
                          <React.Fragment key={ri}>
                            <div style={{padding:"6px 0", color:"var(--text-2)", fontSize:11, fontFamily:"monospace"}}>{row.n}</div>
                            {row.health.map((h, ei) => (
                              <div key={ei} style={{
                                height:24, borderRadius:3, cursor:"pointer",
                                background: h===1?"var(--ok-soft)":h===2?"var(--warn-soft)":"var(--danger-soft)",
                                border: `1px solid ${h===1?"var(--ok)":h===2?"var(--warn)":"var(--danger)"}`,
                                display:"grid", placeItems:"center",
                                color: h===1?"var(--ok)":h===2?"var(--warn)":"var(--danger)",
                                fontSize:10, fontWeight:700
                              }}>{h===1?"✓":h===2?"!":"✕"}</div>
                            ))}
                            <div><button className="btn btn--xs" style={{width:"100%"}}>替换</button></div>
                          </React.Fragment>
                        ))}
                      </div>
                      <div style={{marginTop:10, display:"flex", gap:6}}>
                        <button className="btn btn--xs">{I.copy} 复制线路到其他视频</button>
                        <button className="btn btn--xs">{I.refresh} 重验全部线路</button>
                        <button className="btn btn--xs btn--danger">{I.trash} 删除全失效线路</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ── Staging Queue with rules ────────────────────────────────── */
const StagingView = () => (
  <>
    <div className="page__head">
      <div><h1 className="page__title">暂存发布队列</h1>
      <div className="page__sub">通过审核的视频在此等待自动 / 手动发布 — 透明的发布规则与风险预检</div></div>
      <div className="page__actions">
        <button className="btn">{I.settings} 自动发布规则</button>
        <button className="btn btn--primary">{I.upload} 批量发布选中</button>
      </div>
    </div>

    <div style={{display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:12, marginBottom:12}}>
      <div className="card">
        <div className="card__head">
          <div className="card__title">发布流水线</div>
          <span style={{marginLeft:"auto", fontSize:11, color:"var(--muted)"}}>当前批次：23 条</span>
        </div>
        <div className="card__body" style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr) 24px", alignItems:"center", gap:0}}>
          {[
            {label:"已审核", n:23, color:"var(--ok)"},
            {label:"元数据补齐中", n:11, color:"var(--info)"},
            {label:"封面 ✓", n:8, color:"var(--accent)"},
            {label:"上架就绪", n:6, color:"var(--ok)"},
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <div style={{textAlign:"center"}}>
                <div style={{width:36, height:36, borderRadius:"50%", background:`color-mix(in srgb, ${s.color} 20%, transparent)`, color:s.color, display:"grid", placeItems:"center", margin:"0 auto", fontWeight:700, fontSize:13}}>{s.n}</div>
                <div style={{fontSize:11, marginTop:6, color:"var(--text-2)"}}>{s.label}</div>
              </div>
              {i < arr.length - 1 && <div style={{height:1, background:"var(--border-strong)", position:"relative"}}><span style={{position:"absolute", right:-2, top:-3, color:"var(--muted)"}}>{I.chevR}</span></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <div className="card__title">自动发布规则</div>
          <span style={{marginLeft:"auto"}}><span className="pill pill--ok"><span className="dot"/>已启用</span></span>
        </div>
        <div className="card__body" style={{fontSize:12}}>
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            {[
              ["豆瓣评分 ≥", "6.0", "ok"],
              ["有效线路数 ≥", "2", "ok"],
              ["封面 P0 状态", "可达", "ok"],
              ["发布时间窗", "08:00 – 23:00 UTC+8", "info"],
              ["每小时上限", "50 条", "info"],
            ].map(([k,v,t], i) => (
              <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"6px 8px", background:"var(--bg3)", borderRadius:4}}>
                <span style={{flex:1}}>{k}</span>
                <span style={{fontWeight:600}}>{v}</span>
                <span className={`pill pill--${t}`}><span className="dot"/>{t === "ok" ? "通过" : "约束"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div className="seg" style={{marginBottom:12}}>
      <span className="seg__btn is-active">全部 <span className="badge">23</span></span>
      <span className="seg__btn">就绪 <span className="badge">6</span></span>
      <span className="seg__btn">警告 <span className="badge">12</span></span>
      <span className="seg__btn">阻塞 <span className="badge">5</span></span>
    </div>

    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>
          <th style={{width:30}}><span className="checkbox"/></th>
          <th>视频</th><th>类型</th><th>豆瓣</th><th>探测/播放</th><th>暂存时长</th><th>就绪状态</th><th>操作</th>
        </tr></thead>
        <tbody>
          {[
            {v:VIDEOS[0], status:"阻塞",  reason:"线路全失效", color:"danger"},
            {v:VIDEOS[1], status:"警告",  reason:"豆瓣未匹配", color:"warn"},
            {v:VIDEOS[3], status:"警告",  reason:"封面 P0 失效", color:"warn"},
            {v:VIDEOS[4], status:"就绪",  reason:"通过全部规则",  color:"ok"},
            {v:VIDEOS[6], status:"就绪",  reason:"通过全部规则",  color:"ok"},
            {v:VIDEOS[7], status:"警告",  reason:"豆瓣空 + 缺简介", color:"warn"},
          ].map((r, i) => (
            <tr key={i}>
              <td><span className="checkbox"/></td>
              <td><div style={{display:"flex", gap:8, alignItems:"center"}}>
                <img src={poster(r.v.thumb)} className="tbl-thumb tbl-thumb--sm"/>
                <div><div className="tbl-title">{r.v.title}</div><div className="tbl-meta">{r.v.type} · {r.v.year}</div></div>
              </div></td>
              <td><span className="pill"><span className="dot"/>{r.v.type === "电影" ? "movie" : "series"}</span></td>
              <td>{r.v.score ? <span style={{color:"var(--accent)", fontWeight:600}}>{r.v.score}</span> : <span style={{color:"var(--muted)"}}>—</span>}</td>
              <td><DualSignal probe={r.v.probe} render={r.v.render}/></td>
              <td style={{color:"var(--muted)"}}>{i*2+2} 分钟</td>
              <td><span className={`pill pill--${r.color}`}><span className="dot"/>{r.status} · {r.reason}</span></td>
              <td><div style={{display:"flex", gap:4}}>
                <button className="btn btn--xs btn--primary">发布</button>
                <button className="btn btn--xs" onClick={() => window.openEditDrawer(r.v.id)}>{I.edit}</button>
                <button className="btn btn--xs">{I.more}</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

/* ── Crawler Control Center ────────────────────────────── */
const SITE_ROUTES = {
  iqiy:  [{id:"r1",name:"线路1",alias:"高清",proto:"m3u8",probe:"ok",render:"ok",videos:312,ms:142},{id:"r2",name:"线路2",alias:"",proto:"mp4",probe:"partial",render:"ok",videos:89,ms:280}],
  bdzy:  [{id:"r3",name:"线路1",alias:"",proto:"m3u8",probe:"all_dead",render:"all_dead",videos:201,ms:null},{id:"r4",name:"线路2",alias:"备线",proto:"m3u8",probe:"ok",render:"ok",videos:201,ms:312}],
  dbzy:  [{id:"r5",name:"线路1",alias:"主线",proto:"m3u8",probe:"ok",render:"ok",videos:445,ms:88},{id:"r6",name:"线路2",alias:"",proto:"m3u8",probe:"ok",render:"ok",videos:445,ms:96}],
};

const SiteRouteRow = ({ route, onTestPlay }) => {
  const [alias, setAlias] = React.useState(route.alias);
  const [editing, setEditing] = React.useState(false);
  const probeC = route.probe === "ok" ? "ok" : route.probe === "partial" ? "warn" : "danger";
  const renderC = route.render === "ok" ? "ok" : route.render === "partial" ? "warn" : "danger";
  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 120px 70px 70px 70px 100px", gap:0, padding:"8px 12px", alignItems:"center", fontSize:12, borderBottom:"1px solid var(--border-subtle)"}}>
      <div>
        <div style={{fontWeight:600}}>{route.name}</div>
        <div className="mono" style={{fontSize:10, color:"var(--muted)"}}>{route.proto.toUpperCase()}</div>
      </div>
      <div>
        {editing ? (
          <input className="inp inp--sm" defaultValue={alias} autoFocus
            onBlur={(e) => { setAlias(e.target.value); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
            style={{width:"100%"}}
          />
        ) : (
          <span onClick={() => setEditing(true)} style={{fontSize:11, color: alias ? "var(--text-2)" : "var(--muted-2)", cursor:"pointer", padding:"2px 4px", borderRadius:3, border:"1px dashed var(--border)"}}>
            {alias || "设别名"}
          </span>
        )}
      </div>
      <span className={`pill pill--${probeC}`} style={{fontSize:10}}><span className="dot"/>探</span>
      <span className={`pill pill--${renderC}`} style={{fontSize:10}}><span className="dot"/>播</span>
      <span style={{color:"var(--muted)"}}>{route.ms ? `${route.ms}ms` : "—"}</span>
      <div style={{display:"flex", gap:3}}>
        <button className="btn btn--xs">{I.play}</button>
        <button className="btn btn--xs">{I.refresh}</button>
        <button className="btn btn--xs btn--danger">{I.trash}</button>
      </div>
    </div>
  );
};

const SiteExpandRow = ({ site }) => {
  const routes = SITE_ROUTES[site.key] || [];
  const [mapExpanded, setMapExpanded] = React.useState(false);
  return (
    <div style={{background:"var(--bg1)", borderBottom:"1px solid var(--border)"}}>
      {/* Routes section */}
      <div style={{padding:"10px 14px 4px", display:"flex", alignItems:"center", gap:8}}>
        <span style={{fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:.8}}>线路 / 别名</span>
        <span style={{fontSize:11, color:"var(--muted)"}}>{routes.length} 条</span>
        <span style={{flex:1}}/>
        <button className="btn btn--xs">+ 添加线路</button>
      </div>
      {routes.length > 0 ? (
        <div style={{margin:"0 14px 10px", border:"1px solid var(--border)", borderRadius:6, overflow:"hidden"}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 120px 70px 70px 70px 100px", gap:0, padding:"6px 12px", background:"var(--bg3)", fontSize:10, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.5}}>
            <span>线路名</span><span>别名</span><span>探测</span><span>播放</span><span>延迟</span><span>操作</span>
          </div>
          {routes.map(r => <SiteRouteRow key={r.id} route={r} />)}
        </div>
      ) : (
        <div style={{margin:"0 14px 10px", padding:"10px 12px", background:"var(--bg3)", borderRadius:6, fontSize:11, color:"var(--muted)"}}>暂无线路数据</div>
      )}

      {/* Category mapping */}
      <div style={{padding:"4px 14px 10px"}}>
        <div
          onClick={() => setMapExpanded(e => !e)}
          style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom: mapExpanded ? 8 : 0}}
        >
          <span style={{fontSize:11, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", letterSpacing:.8}}>分类映射</span>
          <span style={{color:"var(--muted)", fontSize:11}}>{mapExpanded ? "▴" : "▾"}</span>
        </div>
        {mapExpanded && (
          <div style={{display:"flex", flexDirection:"column", gap:4}}>
            {[["动作片","action"],["喜剧片","comedy"],["剧情片","drama"]].map(([src, tgt]) => (
              <div key={src} style={{display:"flex", alignItems:"center", gap:8, fontSize:12}}>
                <span className="mono" style={{color:"var(--muted)", width:80, flexShrink:0}}>{src}</span>
                <span style={{color:"var(--muted-2)"}}>→</span>
                <select className="inp inp--sm" defaultValue={tgt} style={{flex:1}}>
                  <option value="action">动作</option><option value="comedy">喜剧</option><option value="drama">剧情</option><option value="sci-fi">科幻</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Crawler Site List — full-width expandable table ──── */
const CrawlerView = () => {
  const [expanded, setExpanded] = React.useState({iqiy: true});
  const toggle = (key) => setExpanded(e => ({...e, [key]: !e[key]}));

  return (
  <>
    <div className="page__head">
      <div><h1 className="page__title">采集控制</h1>
      <div className="page__sub">40 个站点 · 实时任务时间轴 · 一键诊断失败源 · 展开查看线路/分类映射</div></div>
      <div className="page__actions">
        <button className="btn">{I.download} 导出</button>
        <button className="btn">+ 新增站点</button>
        <button className="btn btn--primary">{I.zap} 全站全量</button>
      </div>
    </div>

    {/* KPI row */}
    <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:12, marginBottom:12}}>
      <div className="kpi"><span className="kpi__label">站点</span><span className="kpi__value">40</span><span className="kpi__delta is-up">33 健康</span></div>
      <div className="kpi is-warn"><span className="kpi__label">运行中</span><span className="kpi__value">7</span><span className="kpi__delta">实时</span></div>
      <div className="kpi is-danger"><span className="kpi__label">失败</span><span className="kpi__value">7</span><span className="kpi__delta">≥3 次连失</span></div>
      <div className="kpi is-ok"><span className="kpi__label">本批视频量</span><span className="kpi__value">649</span><span className="kpi__delta">+47 今日</span></div>
      <div className="kpi"><span className="kpi__label">平均时长</span><span className="kpi__value">60s</span><span className="kpi__delta">/ 站点</span></div>
    </div>

    {/* Timeline card — full width */}
    <div className="card" style={{marginBottom:12}}>
      <div className="card__head">
        <div className="card__title">实时任务时间轴</div>
        <span style={{marginLeft:"auto", display:"flex", gap:6}}>
          <button className="btn btn--xs">{I.pause}</button>
          <span className="pill pill--ok"><span className="dot pulse"/>实时</span>
        </span>
      </div>
      <div className="card__body" style={{padding:0}}>
        <div style={{padding:"8px 14px", borderBottom:"1px solid var(--border-subtle)", fontSize:11, color:"var(--muted)", display:"flex", gap:24}}>
          <span>00:00</span><span>00:15</span><span>00:30</span><span>00:45</span><span>01:00</span><span>01:15</span><span>01:30</span><span>01:45</span><span style={{marginLeft:"auto", color:"var(--accent)"}}>NOW</span>
        </div>
        {SITES.slice(0,8).map((s, i) => {
          const start = (i * 8 + 5) % 90;
          const dur = 30 + (i % 4) * 15;
          const status = s.health > 80 ? "ok" : s.health > 50 ? "warn" : "danger";
          return (
            <div key={s.key} style={{display:"flex", alignItems:"center", borderBottom:"1px solid var(--border-subtle)", padding:"8px 14px"}}>
              <div style={{width:140, fontSize:12, fontWeight:600, display:"flex", gap:6, alignItems:"center", flexShrink:0}}>
                <span style={{width:6, height:6, borderRadius:"50%", background:`var(--${status})`, animation: status === "ok" ? "pulse-dot 1.6s infinite" : "none", flexShrink:0}}/>
                {s.name}
              </div>
              <div style={{flex:1, height:18, background:"var(--bg3)", borderRadius:3, position:"relative"}}>
                <div style={{position:"absolute", left:`${start}%`, width:`${dur}%`, height:"100%", background:`var(--${status}-soft)`, border:`1px solid var(--${status})`, borderRadius:3, fontSize:10, color:`var(--${status})`, padding:"2px 6px", overflow:"hidden", whiteSpace:"nowrap"}}>
                  {Math.round(dur*1.5)}s · {Math.round(s.health*1.2)} 视频
                </div>
              </div>
              <div style={{width:70, textAlign:"right", fontSize:11, color:"var(--muted)", flexShrink:0}}>{s.last}</div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Site list — full-width expandable table (aligns with wireframe §07) */}
    <div className="card">
      <div className="card__head">
        <div className="card__title">站点列表</div>
        <span style={{fontSize:11, color:"var(--muted)"}}>点击行展开查看线路 / 分类映射</span>
        <span style={{marginLeft:"auto", display:"flex", gap:6}}>
          <input className="inp" placeholder="搜索站点名 / key" style={{width:200, height:30}}/>
          <button className="btn btn--xs">{I.filter} 筛选</button>
        </span>
      </div>
      <div className="card__body" style={{padding:0}}>
        {/* Table header */}
        <div style={{
          display:"grid",
          gridTemplateColumns:"32px 32px 1fr 80px 80px 80px 80px 90px 140px",
          gap:0,
          padding:"7px 14px",
          background:"var(--bg3)",
          borderBottom:"1px solid var(--border)",
          fontSize:10,
          fontWeight:600,
          color:"var(--muted)",
          textTransform:"uppercase",
          letterSpacing:.5,
        }}>
          <span></span>
          <span></span>
          <span>站点</span>
          <span>类型</span>
          <span>线路</span>
          <span>健康度</span>
          <span>权重</span>
          <span>最近采集</span>
          <span>操作</span>
        </div>

        {SITES.map((s, i) => (
          <React.Fragment key={s.key}>
            {/* Main row */}
            <div
              onClick={() => toggle(s.key)}
              style={{
                display:"grid",
                gridTemplateColumns:"32px 32px 1fr 80px 80px 80px 80px 90px 140px",
                gap:0,
                padding:"9px 14px",
                alignItems:"center",
                borderTop: i ? "1px solid var(--border-subtle)" : "0",
                background: expanded[s.key] ? "var(--accent-soft)" : "transparent",
                cursor:"pointer",
                transition:"background .1s",
              }}
            >
              {/* Chevron */}
              <span style={{
                display:"inline-block",
                transform: expanded[s.key] ? "rotate(90deg)" : "rotate(0)",
                transition:"transform .15s",
                color:"var(--muted)",
                fontSize:12,
              }}>{I.chevR}</span>

              {/* Status dot */}
              <span style={{
                width:8, height:8, borderRadius:"50%",
                background: s.on ? (s.health > 80 ? "var(--ok)" : s.health > 50 ? "var(--warn)" : "var(--danger)") : "var(--muted-2)",
                display:"inline-block",
                animation: s.on && s.health > 80 ? "pulse-dot 1.6s infinite" : "none",
              }}/>

              {/* Name + key */}
              <div>
                <div style={{fontSize:13, fontWeight:600}}>{s.name}</div>
                <div style={{fontSize:10, color:"var(--muted)", fontFamily:"monospace", marginTop:1}}>{s.key} · {s.format}</div>
              </div>

              {/* Type */}
              <span className="pill" style={{fontSize:10, width:"fit-content"}}>
                <span className="dot"/>{s.type}
              </span>

              {/* Routes count */}
              <span style={{fontSize:12, fontWeight:600}}>
                {(SITE_ROUTES[s.key] || []).length || "—"}
                <span style={{color:"var(--muted)", fontWeight:400, fontSize:10}}> 条</span>
              </span>

              {/* Health bar */}
              <div style={{display:"flex", alignItems:"center", gap:6}}>
                <div style={{width:40, height:5, background:"var(--bg3)", borderRadius:999, overflow:"hidden"}}>
                  <div style={{
                    width:`${s.health}%`, height:"100%",
                    background: s.health > 80 ? "var(--ok)" : s.health > 50 ? "var(--warn)" : "var(--danger)",
                    borderRadius:999,
                  }}/>
                </div>
                <span style={{fontSize:11, color: s.health > 80 ? "var(--ok)" : s.health > 50 ? "var(--warn)" : "var(--danger)", fontWeight:600}}>{s.health}%</span>
              </div>

              {/* Weight */}
              <span style={{fontSize:12, color:"var(--text-2)"}}>{s.weight}</span>

              {/* Last crawl */}
              <span style={{fontSize:11, color:"var(--muted)"}}>{s.last}</span>

              {/* Actions */}
              <div style={{display:"flex", gap:4}} onClick={e => e.stopPropagation()}>
                <button className="btn btn--xs">{I.zap} 增量</button>
                <button className="btn btn--xs">全量</button>
                <button className="btn btn--xs">{I.more}</button>
              </div>
            </div>

            {/* Expanded detail row */}
            {expanded[s.key] && (
              <div style={{
                background:"var(--bg1)",
                borderTop:"1px solid var(--border)",
                borderBottom:"1px solid var(--border)",
                padding:"0 14px 14px",
              }}>
                <SiteExpandRow site={s} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  </>
  );
};

/* ── Home Operations (Banner + Modules unified) ───────── */
const HomeOpsView = () => (
  <>
    <div className="page__head">
      <div><h1 className="page__title">首页位编辑器</h1>
      <div className="page__sub">Banner · Top10 · 推荐 · 分类入口 — 拖拽排序 + 实时预览</div></div>
      <div className="page__actions">
        <button className="btn">{I.eye} 预览前台</button>
        <button className="btn btn--primary">+ 新建编排</button>
      </div>
    </div>

    <div style={{display:"grid", gridTemplateColumns:"1fr 360px", gap:12}}>
      <div>
        <div className="seg" style={{marginBottom:12}}>
          <span className="seg__btn is-active">Banner <span className="badge">2</span></span>
          <span className="seg__btn">Top10 <span className="badge">10</span></span>
          <span className="seg__btn">推荐位 <span className="badge">3</span></span>
          <span className="seg__btn">分类入口 <span className="badge">8</span></span>
        </div>

        <div className="card">
          <div className="card__head">
            <div className="card__title">Banner 编排 · 拖拽调整顺序</div>
            <span style={{marginLeft:"auto", fontSize:11, color:"var(--muted)"}}>所有改动会触发 60s 内缓存失效</span>
          </div>
          <div className="card__body" style={{display:"flex", flexDirection:"column", gap:10}}>
            {[
              {n:1, title:"阿凡达：火与烬", img:0, time:"2026-04-20 → 2026-04-30", brand:"全部", live:true},
              {n:2, title:"危险关系", img:2, time:"2026-04-25 → 2026-05-10", brand:"全部", live:true},
              {n:3, title:"凡尔赛宫第一季", img:6, time:"2026-05-01 → 2026-05-30", brand:"主站", live:false},
            ].map((b) => (
              <div key={b.n} style={{display:"flex", gap:12, padding:10, background:"var(--bg3)", borderRadius:6, border:"1px solid var(--border)", alignItems:"center"}}>
                <span style={{color:"var(--muted-2)", cursor:"grab"}}>≡</span>
                <span style={{width:24, textAlign:"center", color:"var(--muted)", fontSize:11, fontWeight:700}}>#{b.n}</span>
                <img src={poster(b.img)} style={{width:120, height:54, borderRadius:4, objectFit:"cover"}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600, fontSize:13}}>{b.title}</div>
                  <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{b.time}</div>
                  <div style={{display:"flex", gap:6, marginTop:4}}>
                    <span className="pill"><span className="dot"/>scope: {b.brand}</span>
                    {b.live ? <span className="pill pill--ok"><span className="dot"/>已发布</span> : <span className="pill pill--warn"><span className="dot"/>预排程</span>}
                  </div>
                </div>
                <button className="btn btn--xs">{I.edit}</button>
                <button className="btn btn--xs">{I.eye}</button>
                <button className="btn btn--xs btn--danger">{I.trash}</button>
              </div>
            ))}
            <button className="btn" style={{justifyContent:"center", padding:"10px"}}>+ 新增 Banner</button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="card" style={{position:"sticky", top:80, height:"fit-content"}}>
        <div className="card__head">
          <div className="card__title">前台实时预览</div>
          <span className="pill pill--info" style={{marginLeft:"auto"}}><span className="dot"/>1080p · 桌面</span>
        </div>
        <div style={{padding:14, background:"linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)", borderRadius:0}}>
          <div style={{position:"relative", aspectRatio:"16/9", borderRadius:6, overflow:"hidden", background:"#000"}}>
            <img src={poster(0)} style={{width:"100%", height:"100%", objectFit:"cover"}}/>
            <div style={{position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(0,0,0,.85) 0%, transparent 50%)"}}/>
            <div style={{position:"absolute", left:14, bottom:14, color:"white"}}>
              <div style={{fontSize:18, fontWeight:700}}>阿凡达：火与烬</div>
              <div style={{fontSize:10, opacity:.8, marginTop:4}}>2025 · 科幻 · 美国</div>
            </div>
            <div style={{position:"absolute", left:0, right:0, bottom:6, display:"flex", justifyContent:"center", gap:5}}>
              <span style={{width:18, height:3, borderRadius:2, background:"white"}}/>
              <span style={{width:18, height:3, borderRadius:2, background:"rgba(255,255,255,.3)"}}/>
              <span style={{width:18, height:3, borderRadius:2, background:"rgba(255,255,255,.3)"}}/>
            </div>
          </div>
          <div style={{marginTop:12, color:"white", fontSize:12, fontWeight:600}}>Top10 本周热度</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginTop:8}}>
            {[1,2,3,4,5,6].map((n) => (
              <div key={n} style={{position:"relative", aspectRatio:"2/3", borderRadius:3, overflow:"hidden"}}>
                <img src={poster(n)} style={{width:"100%", height:"100%", objectFit:"cover"}}/>
                <span style={{position:"absolute", left:2, top:2, fontSize:18, fontWeight:900, color:"white", textShadow:"2px 2px 4px rgba(0,0,0,.7)", lineHeight:1}}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </>
);

/* ── Image Health ──────────────────────────────────────── */
const ImageHealthView = () => (
  <>
    <div className="page__head">
      <div><h1 className="page__title">图片健康</h1>
      <div className="page__sub">封面 / 背景图 / 缩略图 — 全链路可达性监控 + 一键修复</div></div>
      <div className="page__actions">
        <button className="btn">{I.refresh} 重扫所有封面</button>
        <button className="btn btn--primary">{I.zap} 批量切换 fallback 域</button>
      </div>
    </div>

    <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:12}}>
      <div className="kpi"><span className="kpi__label">已上架视频</span><span className="kpi__value">13</span></div>
      <div className="kpi is-warn"><span className="kpi__label">P0 封面失效</span><span className="kpi__value">7.7%</span><span className="kpi__delta">1 / 13</span></div>
      <div className="kpi is-ok"><span className="kpi__label">P1 背景图</span><span className="kpi__value">0.0%</span><span className="kpi__delta">0 / 13</span></div>
      <div className="kpi is-danger"><span className="kpi__label">7 天新增破链</span><span className="kpi__value">597</span><Spark data={[412,455,478,512,540,572,597]} color="var(--danger)"/></div>
    </div>

    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
      <div className="card">
        <div className="card__head"><div className="card__title">TOP 破损域名</div></div>
        <div className="card__body" style={{padding:0}}>
          {[
            ["img3.doubanio.com", 231, "danger"],
            ["img.picbf.com", 76, "warn"],
            ["www.maoyanimg.top", 64, "warn"],
            ["viptulz.com", 47, "warn"],
            ["img.guangsuimg.com", 46, "warn"],
            ["www.imgzy360.com:7788", 45, "warn"],
            ["pic3.yzzyimg.online", 43, "warn"],
            ["tu.iqiyiyimg.com", 42, "warn"],
          ].map(([d, n, c], i) => (
            <div key={d} style={{display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderTop: i ? "1px solid var(--border-subtle)" : "0"}}>
              <span style={{width:24, color:"var(--muted)", fontSize:11}}>#{i+1}</span>
              <span style={{flex:1, fontFamily:"monospace", fontSize:12}}>{d}</span>
              <div style={{width:120, height:14, background:"var(--bg3)", borderRadius:2, overflow:"hidden"}}>
                <div style={{width:`${Math.min(100, n/231*100)}%`, height:"100%", background:`var(--${c})`}}/>
              </div>
              <span style={{width:40, textAlign:"right", color:`var(--${c})`, fontWeight:600}}>{n}</span>
              <button className="btn btn--xs">切 fallback</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__head"><div className="card__title">破损样本</div><span style={{marginLeft:"auto"}}><button className="btn btn--xs">全部修复</button></span></div>
        <div className="card__body" style={{padding:14, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10}}>
          {[0,1,2,3,4,5,6,7].map((i) => (
            <div key={i} style={{position:"relative", aspectRatio:"2/3", borderRadius:6, overflow:"hidden", background:"var(--bg3)", border:"1px dashed var(--danger)"}}>
              <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", color:"var(--danger)", fontSize:18}}>{I.image}</div>
              <div style={{position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,.7)", padding:"4px 6px", fontSize:10, color:"white"}}>404 · {i*3+12}h</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </>
);

/* ── Merge / Split Workbench ─────────────────────────── */
const MergeView = () => (
  <>
    <div className="page__head">
      <div><h1 className="page__title">合并 / 拆分工单</h1>
      <div className="page__sub">采集时疑似自动合并的候选 — 可在生效前预览，或回滚已发生的错误合并</div></div>
      <div className="page__actions">
        <button className="btn">{I.doc} 合并审计日志</button>
      </div>
    </div>

    <div className="seg" style={{marginBottom:12}}>
      <span className="seg__btn is-active">待审候选 <span className="badge">6</span></span>
      <span className="seg__btn">已合并 <span className="badge">412</span></span>
      <span className="seg__btn">已拆分 <span className="badge">8</span></span>
    </div>

    <div className="card" style={{marginBottom:12}}>
      <div style={{padding:14, borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:12}}>
        <span className="pill pill--warn"><span className="dot"/>置信度 71% · 算法存疑</span>
        <span style={{fontWeight:600}}>候选 #SR-204 · 危险关系 1990 ⇄ 危险关系 1988</span>
        <span style={{flex:1}}/>
        <button className="btn btn--sm">{I.x} 拒绝合并</button>
        <button className="btn btn--sm btn--primary">{I.check} 确认合并</button>
      </div>
      <div style={{padding:14, display:"grid", gridTemplateColumns:"1fr 60px 1fr", gap:14, alignItems:"flex-start"}}>
        {[
          {v:VIDEOS[5], note:"采集自 lzcaiji · 2 天前"},
          null,
          {v:VIDEOS[2], note:"已发布 · catalog 17 · 11 sources"}
        ].map((side, i) => side === null ? (
          <div key="arrow" style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8, paddingTop:60}}>
            <div style={{color:"var(--warn)"}}>{I.merge}</div>
            <span style={{fontSize:10, color:"var(--muted)", textAlign:"center"}}>title_normalized + year + type 模糊命中</span>
          </div>
        ) : (
          <div key={i} style={{padding:12, background:"var(--bg3)", borderRadius:6, border:"1px solid var(--border)"}}>
            <div style={{display:"flex", gap:10}}>
              <img src={poster(side.v.thumb)} style={{width:60, height:90, borderRadius:4, objectFit:"cover"}}/>
              <div>
                <div style={{fontWeight:600}}>{side.v.title} <span style={{color:"var(--muted)", fontWeight:400}}>({side.v.year})</span></div>
                <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{side.v.type} · {side.v.country} · ⭐ {side.v.score}</div>
                <div style={{fontSize:10, color:"var(--muted-2)", marginTop:6}}>{side.note}</div>
              </div>
            </div>
            <div style={{marginTop:10, display:"flex", flexDirection:"column", gap:4, fontSize:11}}>
              {[
                ["豆瓣 ID", side.v.id === "v6" ? "未匹配" : "1305703", side.v.id === "v6" ? "danger" : "ok"],
                ["源数", side.v.sources, "info"],
                ["导演", side.v.id === "v6" ? "Milos Forman" : "Stephen Frears", side.v.id === "v6" ? "warn" : "ok"],
                ["语言", "FR/EN", "ok"],
              ].map(([k,v,c]) => (
                <div key={k} style={{display:"flex", justifyContent:"space-between"}}>
                  <span style={{color:"var(--muted)"}}>{k}</span>
                  <span style={{color:`var(--${c})`}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:14, borderTop:"1px solid var(--border)", background:"var(--bg1)"}}>
        <div style={{fontSize:11, color:"var(--muted)", marginBottom:6}}>合并影响预览</div>
        <div style={{display:"flex", gap:14, fontSize:12}}>
          <div>线路总数：<strong>1 → 5</strong></div>
          <div>源总数：<strong>2 → 13</strong></div>
          <div>受影响用户收藏：<strong style={{color:"var(--warn)"}}>0 / 7</strong></div>
          <div>是否可回滚：<strong style={{color:"var(--ok)"}}>是（30 天内）</strong></div>
        </div>
      </div>
    </div>

    <div className="empty" style={{background:"var(--bg2)", border:"1px dashed var(--border)", borderRadius:6}}>
      还有 5 个待审候选 · 滚动查看
    </div>
  </>
);

Object.assign(window, { SourcesView, StagingView, CrawlerView, HomeOpsView, ImageHealthView, MergeView });
