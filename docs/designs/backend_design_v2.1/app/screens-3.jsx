/* global React, I, VIDEOS, SITES, poster, DualSignal, VisChip, Spark */
const { useState: u3 } = React;

/* ── Videos Library — flagship for DataTable v2 ─────────── */
const VideosView = () => {
  const [flash, setFlash] = u3([]);
  const flashRow = (id) => { setFlash([id]); setTimeout(() => setFlash([]), 1600); };

  const columns = [
    { key:"thumb", label:"封面", width:60, sortable:false, filterable:false,
      render: (v) => <img src={poster(v.thumb)} className="tbl-thumb tbl-thumb--sm" /> },
    { key:"title", label:"标题", pinned:true, render: (v) => (
      <div>
        <div className="tbl-title">{v.title}</div>
        <div className="tbl-meta mono">{v.id} · {v.year}</div>
      </div>
    )},
    { key:"type", label:"类型", width:90, render: (v) => <span className="pill">{v.type}</span> },
    { key:"sources", label:"源活跃", width:100, render: (v) => (
      <div style={{display:"flex", alignItems:"center", gap:6}}>
        <span style={{width:6, height:6, borderRadius:"50%", background: v.sources > 10 ? "var(--ok)" : v.sources > 3 ? "var(--warn)" : "var(--danger)"}}/>
        <span style={{fontWeight:600}}>{v.sources}</span>
        <span style={{fontSize:10, color:"var(--muted)"}}>{v.sources > 10 ? "活跃" : v.sources > 3 ? "一般" : "稀少"}</span>
      </div>
    )},
    { key:"probe", label:"探测/播放", width:140, render: (v) => <DualSignal probe={v.probe} render={v.render} /> },
    { key:"image", label:"图片", width:100, render: (v) => (
      <span className={`pill pill--${v.badges.includes("封面失效")?"danger":"ok"}`}>
        <span className="dot"/>{v.badges.includes("封面失效")?"P0 失效":"P0 活跃"}
      </span>
    )},
    { key:"visibility", label:"可见性", width:120, render: (v) => <VisChip visibility={v.visibility} review={v.review} /> },
    { key:"review", label:"审核", width:90, render: (v) => (
      <span className={`pill pill--${v.review==="approved"?"ok":v.review==="rejected"?"danger":"warn"}`}>
        <span className="dot"/>{v.review==="approved"?"已通过":v.review==="rejected"?"已拒":"待审"}
      </span>
    )},
    { key:"actions", label:"操作", width:170, sortable:false, filterable:false, render: (v) => (
      <div style={{display:"flex", gap:3}}>
        <button className="btn btn--xs" title="编辑" onClick={(e) => { e.stopPropagation(); window.openEditDrawer(v.id); }}>{I.edit}</button>
        <button className="btn btn--xs" title="前台">{I.external}</button>
        <button className="btn btn--xs" title="播放">{I.play}</button>
        <button className="btn btn--xs">补源</button>
        <button className="btn btn--xs btn--primary" onClick={(e) => { e.stopPropagation(); flashRow(v.id); }}>上架</button>
      </div>
    )},
  ];

  const views = [
    { id:"v1", label:"我的待审 · 本周", scope:"personal" },
    { id:"v2", label:"封面失效", scope:"personal" },
    { id:"v3", label:"团队 · 新增上架", scope:"team" },
  ];

  return (
    <div style={{display:"flex", flexDirection:"column", height:"calc(100vh - var(--topbar-h) - 32px)", gap:12}}>
      <div className="page__head" style={{flex:"none", marginBottom:0}}>
        <div><h1 className="page__title">视频库</h1>
        <div className="page__sub">695 条视频 · 表头集成 · 视图保存 · 乐观更新</div></div>
        <div className="page__actions">
          <button className="btn">{I.download} 导出 CSV</button>
          <button className="btn btn--primary">+ 手动添加视频</button>
        </div>
      </div>
      <div style={{flex:1, minHeight:0}}>
        <DataTable
          columns={columns}
          rows={VIDEOS}
          rowKey="id"
          totalCount={695}
          searchPlaceholder="搜标题 / shortId / 演员 / 导演…"
          views={views}
          flashIds={flash}
          bulkActions={(ids, clear) => (
            <>
              <button className="btn btn--xs">{I.check} 批准</button>
              <button className="btn btn--xs">{I.upload} 上架</button>
              <button className="btn btn--xs">{I.refresh} 重验源</button>
              <button className="btn btn--xs">{I.image} 修封面</button>
              <button className="btn btn--xs btn--danger">{I.trash} 隐藏</button>
            </>
          )}
        />
      </div>
    </div>
  );
};

/* ── Users Management ─────────────────────────────────── */
const UsersView = () => (
  <>
    <div className="page__head">
      <div><h1 className="page__title">用户管理</h1>
      <div className="page__sub">5 名用户 · 角色 RBAC · 审计日志可追溯</div></div>
      <div className="page__actions">
        <button className="btn">{I.shield} 角色矩阵</button>
        <button className="btn btn--primary">+ 邀请用户</button>
      </div>
    </div>

    <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:12}}>
      <div className="kpi"><span className="kpi__label">总数</span><span className="kpi__value">5</span></div>
      <div className="kpi is-ok"><span className="kpi__label">活跃 (7d)</span><span className="kpi__value">4</span></div>
      <div className="kpi"><span className="kpi__label">今日新增</span><span className="kpi__value">0</span></div>
      <div className="kpi is-warn"><span className="kpi__label">已封禁</span><span className="kpi__value">0</span></div>
    </div>

    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>用户</th><th>角色</th><th>邮箱</th><th>权限范围</th><th>最后登录</th><th>2FA</th><th>操作</th></tr></thead>
        <tbody>
          {[
            {n:"Yan Liu", role:"admin", email:"yan@resovo.io", scope:"全部", last:"2 分钟前", color:"danger"},
            {n:"Mira Chen", role:"moderator", email:"mira@resovo.io", scope:"审核 / 暂存", last:"1 小时前", color:"warn"},
            {n:"Kai Tan", role:"editor", email:"kai@resovo.io", scope:"视频库 / 首页", last:"3 小时前", color:"info"},
            {n:"Rui Zhang", role:"crawler", email:"rui@resovo.io", scope:"采集 / 源", last:"昨天", color:"info"},
            {n:"Demo User", role:"viewer", email:"demo@resovo.io", scope:"只读", last:"7 天前", color:""},
          ].map((u, i) => (
            <tr key={i}>
              <td><div style={{display:"flex", gap:10, alignItems:"center"}}>
                <div style={{width:30, height:30, borderRadius:"50%", background:`linear-gradient(135deg, hsl(${i*73} 65% 55%), hsl(${i*73+30} 60% 45%))`, color:"white", display:"grid", placeItems:"center", fontWeight:700, fontSize:11}}>{u.n.split(" ").map(s=>s[0]).join("")}</div>
                <div><div className="tbl-title">{u.n}</div><div className="tbl-meta">@{u.email.split("@")[0]}</div></div>
              </div></td>
              <td><span className={`pill pill--${u.color || "info"}`}><span className="dot"/>{u.role}</span></td>
              <td className="mono" style={{color:"var(--muted)"}}>{u.email}</td>
              <td>{u.scope}</td>
              <td style={{color:"var(--muted)", fontSize:11}}>{u.last}</td>
              <td>{i < 2 ? <span className="pill pill--ok"><span className="dot"/>已开</span> : <span className="pill pill--warn"><span className="dot"/>未开</span>}</td>
              <td><div style={{display:"flex", gap:3}}><button className="btn btn--xs">{I.edit}</button><button className="btn btn--xs">{I.shield}</button><button className="btn btn--xs btn--danger">{I.trash}</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

/* ── Settings toggle helper ─────────────────────────── */
const SettingToggle = ({ label, desc, defaultOn }) => {
  const [on, setOn] = u3(defaultOn);
  return (
    <div style={{display:"flex", gap:12, alignItems:"center", padding:10, background:"var(--bg3)", borderRadius:4, cursor:"pointer"}} onClick={() => setOn(v => !v)}>
      <div style={{width:36, height:20, borderRadius:999, background: on ? "var(--accent)" : "var(--muted-2)", position:"relative", flexShrink:0, transition:"background .15s"}}>
        <div style={{position:"absolute", top:2, left: on ? 18 : 2, width:16, height:16, borderRadius:"50%", background:"white", transition:"left .15s"}}/>
      </div>
      <div style={{flex:1}}>
        <div style={{fontWeight:600, fontSize:13}}>{label}</div>
        {desc && <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{desc}</div>}
      </div>
    </div>
  );
};

/* ── Settings (tabbed) ───────────────────────────────── */
const SettingsView = () => {
  const [tab, setTab] = u3("basic");
  const sideItems = [
    ["basic",  "基础信息",     I.settings],
    ["douban", "豆瓣集成",     I.database],
    ["filter", "内容过滤",     I.shield],
    ["images", "图片回退",     I.image],
    ["notify", "通知",         I.bell],
    ["api",    "API & Webhook", I.key],
    ["cache",  "缓存与 CDN",   I.zap],
    ["auth",   "登录与会话",   I.shield],
  ];
  return (
    <>
      <div className="page__head">
        <div><h1 className="page__title">站点设置</h1>
        <div className="page__sub">配置项 · 集成 · 内容过滤 · 通知 — 改动会即时记入审计日志</div></div>
        <div className="page__actions">
          <button className="btn">{I.doc} 审计日志</button>
          <button className="btn btn--primary">{I.check} 保存所有更改</button>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"180px 1fr", gap:16}}>
        {/* Side nav */}
        <div className="card" style={{padding:6, height:"fit-content"}}>
          {sideItems.map(([k,l,ic]) => (
            <div key={k} onClick={() => setTab(k)} style={{display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:4, cursor:"pointer", background: tab===k ? "var(--accent-soft)" : "transparent", color: tab===k ? "var(--accent)" : "var(--text-2)", fontSize:12}}>
              <span style={{opacity:.85}}>{ic}</span>{l}
            </div>
          ))}
        </div>

        <div className="card">
          {/* ── 基础信息 ── */}
          {tab === "basic" && <div className="card__body" style={{display:"flex", flexDirection:"column", gap:14}}>
            <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>站点名称</div><input className="inp" defaultValue="Resovo 流光"/></div>
            <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>站点公告</div><textarea className="inp" rows={3} placeholder="留空不显示"/></div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>主域</div><input className="inp" defaultValue="resovo.app"/></div>
              <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>主题模式</div><select className="inp"><option>跟随系统</option><option>深色</option><option>浅色</option></select></div>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>时区</div><select className="inp"><option>Asia/Shanghai (UTC+8)</option><option>UTC</option></select></div>
              <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>语言</div><select className="inp"><option>简体中文</option><option>English</option></select></div>
            </div>
          </div>}

          {/* ── 豆瓣集成 ── */}
          {tab === "douban" && <div className="card__body" style={{display:"flex", flexDirection:"column", gap:12}}>
            <div className="banner banner--warn"><span style={{color:"var(--warn)"}}>{I.alert}</span><div>豆瓣 Cookie 将每 30 天提醒续期。建议配置代理域以提升稳定性。</div></div>
            <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>Douban API 代理</div><input className="inp" placeholder="https://your-douban-proxy.example.com"/></div>
            <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>Douban Cookie</div><textarea className="inp mono" rows={4} placeholder="bid=xxx; dbcl2=xxx; ck=xxx;"/></div>
            <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>匹配置信度阈值</div>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <input className="inp" type="range" min={50} max={99} defaultValue={75} style={{flex:1}}/>
                <span style={{fontSize:12, fontWeight:600, width:36}}>75%</span>
              </div>
              <div style={{fontSize:10, color:"var(--muted)", marginTop:2}}>低于此值的匹配将进入「待确认」队列</div>
            </div>
            <div style={{display:"flex", gap:8}}><button className="btn btn--sm">{I.zap} 测试连通性</button><button className="btn btn--sm">{I.refresh} 刷新匹配缓存</button></div>
          </div>}

          {/* ── 内容过滤 ── */}
          {tab === "filter" && <div className="card__body" style={{display:"flex", flexDirection:"column", gap:10}}>
            <SettingToggle label="启用关键词过滤" desc="屏蔽敏感分类标题" defaultOn={true}/>
            <SettingToggle label="显示成人内容" desc="仅对标记 is_adult 的隐藏源生效" defaultOn={false}/>
            <SettingToggle label="新视频默认隐藏" desc="需手动审核后才公开" defaultOn={true}/>
            <SettingToggle label="豆瓣低分自动隐藏" desc="评分 < 4.0 自动设为 internal" defaultOn={false}/>
            <div style={{marginTop:8}}>
              <div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>关键词黑名单</div>
              <textarea className="inp mono" rows={4} defaultValue={"赌博\n诈骗\n色情\n违禁"} style={{resize:"vertical"}}/>
              <div style={{fontSize:10, color:"var(--muted)", marginTop:2}}>每行一个关键词，匹配标题或分类</div>
            </div>
          </div>}

          {/* ── 图片回退 ── */}
          {tab === "images" && <div className="card__body" style={{display:"flex", flexDirection:"column", gap:10}}>
            <div style={{fontSize:11, color:"var(--muted)"}}>当 P0 封面 4xx/5xx 时的回退顺序（拖拽调整）：</div>
            {["img.doubanio.com → cdn.proxy.io", "img.maoyan → mirror.maoyan", "豆瓣 ID 已知 → 豆瓣 API 重新拉取", "全部失败 → 显示占位图"].map((s, i) => (
              <div key={i} style={{display:"flex", gap:8, alignItems:"center", padding:"8px 10px", background:"var(--bg3)", borderRadius:4}}>
                <span style={{cursor:"grab", color:"var(--muted-2)"}}>⠿</span>
                <span style={{color:"var(--muted)", fontFamily:"monospace", fontSize:11, width:18}}>{i+1}.</span>
                <span style={{flex:1, fontSize:12}}>{s}</span>
                <button className="btn btn--xs">{I.edit}</button>
              </div>
            ))}
            <div style={{marginTop:4}}>
              <SettingToggle label="封面健康监控" desc="每 6 小时自动扫描 P0 封面可达性" defaultOn={true}/>
            </div>
          </div>}

          {/* ── 通知 ── */}
          {tab === "notify" && <div className="card__body" style={{display:"flex", flexDirection:"column", gap:14}}>
            <div style={{fontSize:12, fontWeight:600, color:"var(--text-2)", marginBottom:4}}>站内通知</div>
            <SettingToggle label="采集失败告警" desc="站点连续 3 次失败时通知" defaultOn={true}/>
            <SettingToggle label="封面批量失效告警" desc="超过 50 张封面失效时通知" defaultOn={true}/>
            <SettingToggle label="合并候选需确认" desc="自动合并置信度 &lt; 90% 时通知" defaultOn={true}/>
            <SettingToggle label="首页 Banner 过期提醒" desc="过期前 3 天提醒" defaultOn={true}/>
            <div style={{borderTop:"1px solid var(--border)", paddingTop:14, marginTop:4}}>
              <div style={{fontSize:12, fontWeight:600, color:"var(--text-2)", marginBottom:8}}>Webhook 推送</div>
              <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>Webhook URL</div><input className="inp" placeholder="https://hooks.slack.com/services/…"/></div>
              <div style={{marginTop:8}}>
                <div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>推送事件</div>
                <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                  {["crawl.failed","video.approved","source.dead","merge.candidate"].map(e => (
                    <span key={e} className="fchip fchip--active"><span className="fchip__key">{e}</span> <span className="fchip__x">×</span></span>
                  ))}
                  <button className="btn btn--xs">+ 添加</button>
                </div>
              </div>
              <button className="btn btn--sm" style={{marginTop:8}}>{I.zap} 测试推送</button>
            </div>
          </div>}

          {/* ── API & Webhook ── */}
          {tab === "api" && <div className="card__body" style={{display:"flex", flexDirection:"column", gap:14}}>
            <div className="banner" style={{background:"var(--info-soft)", borderColor:"rgba(59,130,246,.3)"}}>
              <span style={{color:"var(--info)"}}>{I.key}</span>
              <div style={{fontSize:11}}>API 密钥请妥善保管，不要提交到代码仓库。密钥仅在创建时完整显示一次。</div>
            </div>
            <div>
              <div style={{fontSize:11, color:"var(--muted)", marginBottom:6}}>当前 API 密钥</div>
              <div style={{display:"flex", gap:8, alignItems:"center", padding:"8px 10px", background:"var(--bg3)", borderRadius:4}}>
                <code className="mono" style={{flex:1, fontSize:12}}>sk_live_••••••••••••••••••••••••••••••••</code>
                <button className="btn btn--xs">{I.copy} 复制</button>
                <button className="btn btn--xs btn--danger">撤销</button>
              </div>
            </div>
            <button className="btn btn--sm">+ 生成新密钥</button>
            <div style={{borderTop:"1px solid var(--border)", paddingTop:14}}>
              <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>速率限制</div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
                <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>每分钟请求上限</div><input className="inp" defaultValue="300"/></div>
                <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>每日请求上限</div><input className="inp" defaultValue="50000"/></div>
              </div>
            </div>
            <div style={{borderTop:"1px solid var(--border)", paddingTop:14}}>
              <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>CORS 允许域名</div>
              <textarea className="inp mono" rows={3} defaultValue={"https://resovo.app\nhttps://admin.resovo.app"}/>
              <div style={{fontSize:10, color:"var(--muted)", marginTop:2}}>每行一个域名</div>
            </div>
          </div>}

          {/* ── 缓存与 CDN ── */}
          {tab === "cache" && <div className="card__body" style={{display:"flex", flexDirection:"column", gap:14}}>
            <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:4}}>
              {[
                {label:"CDN 缓存命中率", value:"94.2%", color:"ok"},
                {label:"源站请求/分钟", value:"1,247", color:"info"},
                {label:"平均响应时间", value:"42ms", color:"ok"},
              ].map(k => (
                <div key={k.label} className="kpi" style={{padding:"10px 12px"}}>
                  <span className="kpi__label" style={{fontSize:10}}>{k.label}</span>
                  <span className="kpi__value" style={{fontSize:20, color:`var(--${k.color})`}}>{k.value}</span>
                </div>
              ))}
            </div>
            <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>CDN 服务商</div>
              <select className="inp"><option>Cloudflare</option><option>阿里云 CDN</option><option>腾讯云 CDN</option><option>自建</option></select>
            </div>
            <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>静态资源 TTL（秒）</div><input className="inp" defaultValue="86400"/></div>
            <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>API 响应缓存 TTL（秒）</div><input className="inp" defaultValue="60"/></div>
            <SettingToggle label="首页缓存" desc="缓存首页渲染结果，Banner 更新后自动失效" defaultOn={true}/>
            <SettingToggle label="视频列表缓存" desc="分页列表缓存 60s" defaultOn={true}/>
            <div style={{display:"flex", gap:8, marginTop:4}}>
              <button className="btn btn--sm btn--danger">{I.refresh} 全站清除缓存</button>
              <button className="btn btn--sm">{I.zap} 清除首页缓存</button>
            </div>
          </div>}

          {/* ── 登录与会话 ── */}
          {tab === "auth" && <div className="card__body" style={{display:"flex", flexDirection:"column", gap:14}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>会话超时（分钟）</div><input className="inp" defaultValue="1440" type="number"/></div>
              <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>记住登录（天）</div><input className="inp" defaultValue="14" type="number"/></div>
            </div>
            <SettingToggle label="强制 2FA" desc="所有管理员账号必须开启双因素认证" defaultOn={false}/>
            <SettingToggle label="SSO 登录" desc="支持 SAML / OIDC 单点登录" defaultOn={false}/>
            <SettingToggle label="IP 白名单" desc="仅允许指定 IP 段访问后台" defaultOn={false}/>
            <div>
              <div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>IP 白名单</div>
              <textarea className="inp mono" rows={3} placeholder={"10.0.0.0/8\n192.168.1.0/24"} disabled/>
              <div style={{fontSize:10, color:"var(--muted-2)", marginTop:2}}>开启「IP 白名单」开关后可编辑</div>
            </div>
            <div style={{borderTop:"1px solid var(--border)", paddingTop:14}}>
              <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>当前活跃会话</div>
              {[
                {who:"Yan Liu", ip:"10.0.1.4", ua:"Chrome 124 / macOS", time:"当前"},
                {who:"Mira Chen", ip:"10.0.2.7", ua:"Firefox 125 / Windows", time:"1 小时前"},
              ].map((s,i) => (
                <div key={i} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"var(--bg3)", borderRadius:4, marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12, fontWeight:600}}>{s.who}</div>
                    <div className="mono" style={{fontSize:10, color:"var(--muted)"}}>{s.ip} · {s.ua} · {s.time}</div>
                  </div>
                  {i > 0 && <button className="btn btn--xs btn--danger">踢出</button>}
                  {i === 0 && <span className="pill pill--ok" style={{fontSize:10}}><span className="dot pulse"/>当前</span>}
                </div>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </>
  );
};

/* ── Audit Log ─────────────────────────────────────── */
const AuditView = () => (
  <>
    <div className="page__head">
      <div><h1 className="page__title">审计日志</h1>
      <div className="page__sub">所有写操作不可篡改 · 30 天内可回滚 · 支持时间穿梭对比</div></div>
      <div className="page__actions">
        <button className="btn">{I.download} 导出</button>
        <button className="btn">{I.clock} 时间穿梭</button>
      </div>
    </div>

    <div className="fbar" style={{marginBottom:12}}>
      <input className="inp" placeholder="搜操作类型 / 对象 / 用户" style={{width:280}}/>
      <span className="fchip"><span className="fchip__key">用户:</span> 全部 ▾</span>
      <span className="fchip"><span className="fchip__key">类型:</span> 全部 ▾</span>
      <span className="fchip"><span className="fchip__key">时间:</span> 7 天内 ▾</span>
      <span style={{flex:1}}/>
      <span style={{fontSize:11, color:"var(--muted)"}}>共 1,287 条</span>
    </div>

    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>时间</th><th>用户</th><th>操作</th><th>对象</th><th>变更</th><th>IP</th><th>操作</th></tr></thead>
        <tbody>
          {[
            {t:"刚刚", u:"系统", a:"crawl.complete", o:"豆瓣资源", c:"+47 视频, +112 源", ip:"—", c2:"info"},
            {t:"5 分钟前", u:"Yan Liu", a:"video.approve", o:"v3 危险关系1988", c:"review: pending → approved", ip:"10.0.1.4", c2:"ok"},
            {t:"38 分钟前", u:"Yan Liu", a:"bulk.approve", o:"24 条视频", c:"批量通过", ip:"10.0.1.4", c2:"ok"},
            {t:"52 分钟前", u:"Mira Chen", a:"site.disable", o:"v.lzcdn31.com", c:"on: true → false", ip:"10.0.2.7", c2:"warn"},
            {t:"1 小时前", u:"系统", a:"merge.auto", o:"危险关系2024 ← cat-17", c:"置信度 88%", ip:"—", c2:"warn"},
            {t:"3 小时前", u:"Yan Liu", a:"banner.update", o:"banner-1 阿凡达：火与烬", c:"image, link", ip:"10.0.1.4", c2:"info"},
            {t:"昨天", u:"Kai Tan", a:"video.edit", o:"v7 凡尔赛宫", c:"poster, synopsis", ip:"10.0.3.2", c2:"info"},
            {t:"昨天", u:"Yan Liu", a:"settings.update", o:"内容过滤", c:"启用关键词过滤", ip:"10.0.1.4", c2:"info"},
            {t:"2 天前", u:"Rui Zhang", a:"site.add", o:"光速资源", c:"新增采集站", ip:"10.0.4.1", c2:"ok"},
          ].map((r, i) => (
            <tr key={i}>
              <td style={{color:"var(--muted)", fontSize:11, whiteSpace:"nowrap"}}>{r.t}</td>
              <td><strong>{r.u}</strong></td>
              <td><span className={`pill pill--${r.c2}`}><span className="dot"/>{r.a}</span></td>
              <td className="mono">{r.o}</td>
              <td style={{color:"var(--text-2)", fontSize:11}}>{r.c}</td>
              <td className="mono" style={{color:"var(--muted)", fontSize:11}}>{r.ip}</td>
              <td><div style={{display:"flex", gap:3}}><button className="btn btn--xs">查看 diff</button><button className="btn btn--xs btn--danger">回滚</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

/* ── User Submissions ─────────────────────────────── */
const SubmissionsView = () => (
  <>
    <div className="page__head">
      <div><h1 className="page__title">用户投稿 / 纠错</h1>
      <div className="page__sub">12 条待处理 · 用户报错的失效源、找不到的视频、错误元数据</div></div>
    </div>

    <div className="seg" style={{marginBottom:12}}>
      <span className="seg__btn is-active">失效源举报 <span className="badge">8</span></span>
      <span className="seg__btn">求片 <span className="badge">3</span></span>
      <span className="seg__btn">元数据纠错 <span className="badge">1</span></span>
      <span className="seg__btn">已处理 <span className="badge">412</span></span>
    </div>

    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      {[
        {ty:"danger", icon:I.alert, t:"举报：危险关系 EP3 线路 2 黑屏", who:"@user_4218", time:"5 分钟前", quote:"换了线路也是一样的，估计是源挂了", v:VIDEOS[0]},
        {ty:"danger", icon:I.alert, t:"举报：梅尔特伊 EP1-3 全部加载失败", who:"@user_9012", time:"15 分钟前", quote:"昨天还能看，今天打开就卡住", v:VIDEOS[3]},
        {ty:"info",   icon:I.flag,  t:"求片：拜伦勋爵传记片 (2026)", who:"@user_1124", time:"30 分钟前", quote:"豆瓣评分 7.8，最近上的，希望能加进来", v:null},
        {ty:"warn",   icon:I.edit,  t:"纠错：凡尔赛宫导演名称拼错", who:"@user_3456", time:"1 小时前", quote:"应该是 Simon Mirren，不是 Simon Mirran", v:VIDEOS[6]},
      ].map((s, i) => (
        <div key={i} className="card" style={{padding:14, display:"flex", gap:14, alignItems:"center"}}>
          <div style={{width:32, height:32, borderRadius:6, background:`var(--${s.ty}-soft)`, color:`var(--${s.ty})`, display:"grid", placeItems:"center"}}>{s.icon}</div>
          {s.v && <img src={poster(s.v.thumb)} style={{width:42, height:60, borderRadius:4, objectFit:"cover"}}/>}
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:600}}>{s.t}</div>
            <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{s.who} · {s.time}</div>
            <div style={{fontSize:11, color:"var(--text-2)", marginTop:6, padding:"4px 8px", background:"var(--bg3)", borderRadius:4, fontStyle:"italic"}}>"{s.quote}"</div>
          </div>
          <div style={{display:"flex", gap:6}}>
            <button className="btn btn--sm">{I.refresh} 重验</button>
            <button className="btn btn--sm">查看视频</button>
            <button className="btn btn--sm btn--primary">{I.check} 处理</button>
          </div>
        </div>
      ))}
    </div>
  </>
);

/* ── Subtitles ─────────────────────────────────── */
const SubtitlesView = () => (
  <>
    <div className="page__head">
      <div><h1 className="page__title">字幕管理</h1>
      <div className="page__sub">按视频聚合 · 支持多语言版本 · 来源溯源</div></div>
      <div className="page__actions">
        <button className="btn btn--primary">+ 上传字幕</button>
      </div>
    </div>

    <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:12}}>
      <div className="kpi"><span className="kpi__label">字幕总数</span><span className="kpi__value">2,148</span></div>
      <div className="kpi is-ok"><span className="kpi__label">中文 (简)</span><span className="kpi__value">1,021</span></div>
      <div className="kpi is-ok"><span className="kpi__label">英文</span><span className="kpi__value">876</span></div>
      <div className="kpi is-warn"><span className="kpi__label">缺字幕视频</span><span className="kpi__value">42</span></div>
    </div>

    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>视频</th><th>语言</th><th>格式</th><th>来源</th><th>同步质量</th><th>大小</th><th>操作</th></tr></thead>
        <tbody>
          {VIDEOS.slice(0,6).flatMap((v, vi) => ["zh-Hans","en"].map((lang, li) => (
            <tr key={`${vi}-${li}`}>
              <td><div style={{display:"flex", gap:8, alignItems:"center"}}><img src={poster(v.thumb)} className="tbl-thumb tbl-thumb--sm"/><div className="tbl-title">{v.title}</div></div></td>
              <td><span className="pill pill--info"><span className="dot"/>{lang === "zh-Hans" ? "简体中文" : "English"}</span></td>
              <td className="mono">srt</td>
              <td style={{color:"var(--muted)", fontSize:11}}>{vi%2===0?"OpenSubtitles":"用户上传"}</td>
              <td><div style={{display:"flex", gap:4, alignItems:"center"}}>
                <div style={{width:60, height:6, background:"var(--bg3)", borderRadius:999}}><div style={{width:`${85+vi*2}%`, height:"100%", background:"var(--ok)", borderRadius:999}}/></div>
                <span style={{fontSize:11}}>{85+vi*2}%</span>
              </div></td>
              <td style={{color:"var(--muted)", fontSize:11}}>{45+vi*3} KB</td>
              <td><div style={{display:"flex", gap:3}}><button className="btn btn--xs">{I.eye}</button><button className="btn btn--xs">{I.edit}</button><button className="btn btn--xs btn--danger">{I.trash}</button></div></td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  </>
);

/* ── Analytics Dashboard ────────────────────────── */
const AnalyticsView = () => {
  const wave = (a, b, n=24) => Array.from({length:n}, (_, i) => a + Math.sin(i/3)*b + Math.random()*b*.3);
  return (
    <>
      <div className="page__head">
        <div><h1 className="page__title">数据看板</h1>
        <div className="page__sub">视频 · 源 · 用户 · 采集任务 — 多维度运营观测</div></div>
        <div className="page__actions">
          <select className="inp" style={{width:120}}><option>7 天</option><option>30 天</option><option>90 天</option></select>
          <button className="btn">{I.download} 导出报表</button>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:12}}>
        <div className="kpi"><span className="kpi__label">视频总数</span><span className="kpi__value">695</span><span className="kpi__delta is-up">↑ +47 7d</span><Spark data={wave(680, 8)} color="var(--accent)"/></div>
        <div className="kpi is-ok"><span className="kpi__label">已上架</span><span className="kpi__value">13</span><span className="kpi__delta is-up">↑ +3 今日</span><Spark data={wave(8, 3)} color="var(--ok)"/></div>
        <div className="kpi is-warn"><span className="kpi__label">待审 / 暂存</span><span className="kpi__value">484 <span style={{fontSize:14, color:"var(--muted)"}}>/ 23</span></span><Spark data={wave(450, 30)} color="var(--warn)"/></div>
        <div className="kpi is-ok"><span className="kpi__label">源可达率</span><span className="kpi__value">98.7%</span><span className="kpi__delta is-up">↑ 0.3pt</span><Spark data={wave(96, 1.5)} color="var(--ok)"/></div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12}}>
        <div className="card">
          <div className="card__head"><div className="card__title">采集任务量 · 7 天</div></div>
          <div className="card__body" style={{padding:14}}>
            <svg viewBox="0 0 700 200" style={{width:"100%", height:200}}>
              <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".5"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
              {[40,80,120,160].map(y => <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="var(--border-subtle)"/>)}
              {(() => {
                const pts = wave(120, 40, 28).map((v,i) => `${i*25},${200-v}`).join(" ");
                return <>
                  <polyline points={`0,200 ${pts} 700,200`} fill="url(#ag)"/>
                  <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2"/>
                </>;
              })()}
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="card__head"><div className="card__title">源类型分布</div></div>
          <div className="card__body" style={{display:"flex", flexDirection:"column", gap:8}}>
            {[["m3u8 (HLS)", 78, "var(--ok)"], ["mp4", 12, "var(--info)"], ["embed iframe", 7, "var(--warn)"], ["其他", 3, "var(--muted-2)"]].map(([l,n,c]) => (
              <div key={l}><div style={{display:"flex", justifyContent:"space-between", fontSize:12}}><span>{l}</span><span style={{fontWeight:600}}>{n}%</span></div>
              <div style={{height:8, background:"var(--bg3)", borderRadius:999, overflow:"hidden", marginTop:3}}><div style={{width:`${n}%`, height:"100%", background:c}}/></div></div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><div className="card__title">爬虫最近任务</div><span style={{marginLeft:"auto", fontSize:11, color:"var(--muted)"}}>实时</span></div>
        <table className="tbl">
          <thead><tr><th>资源站</th><th>状态</th><th>开始</th><th>结束</th><th>新增视频</th><th>新增源</th><th>耗时</th></tr></thead>
          <tbody>
            {SITES.slice(0,6).map((s, i) => (
              <tr key={s.key}>
                <td><strong>{s.name}</strong></td>
                <td><span className={`pill pill--${s.health > 50 ? "ok" : "danger"}`}><span className="dot"/>{s.health > 50 ? "成功" : "失败"}</span></td>
                <td style={{color:"var(--muted)", fontSize:11}}>{i*7+2} 分钟前</td>
                <td style={{color:"var(--muted)", fontSize:11}}>{i*7+1} 分钟前</td>
                <td><strong style={{color:"var(--ok)"}}>+{Math.round(s.health*0.6)}</strong></td>
                <td><strong style={{color:"var(--accent)"}}>+{Math.round(s.health*1.5)}</strong></td>
                <td>{45 + i*8}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ── Login ───────────────────────────────────── */
const LoginView = () => (
  <div style={{minHeight:"100vh", display:"grid", placeItems:"center", background:"radial-gradient(ellipse at top, rgba(245,158,11,.12), transparent), var(--bg0)"}}>
    <div style={{width:400, padding:40, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, boxShadow:"var(--shadow-lg)"}}>
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:24}}>
        <div className="sb__logo" style={{width:36, height:36, fontSize:16}}>流</div>
        <div><div style={{fontSize:18, fontWeight:700}}>流光后台 <small style={{color:"var(--muted)", fontWeight:500, fontSize:12, marginLeft:4}}>v2</small></div>
        <div style={{fontSize:11, color:"var(--muted)"}}>Resovo Admin Console</div></div>
      </div>
      <div style={{display:"flex", flexDirection:"column", gap:12}}>
        <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4}}>邮箱 / 用户名</div><input className="inp" defaultValue="yan@resovo.io"/></div>
        <div><div style={{fontSize:11, color:"var(--muted)", marginBottom:4, display:"flex", justifyContent:"space-between"}}><span>密码</span><span style={{color:"var(--accent)", cursor:"pointer"}}>忘记密码？</span></div><input className="inp" type="password" defaultValue="••••••••••"/></div>
        <div style={{display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--muted)"}}><span className="checkbox is-checked"/>记住我 14 天</div>
        <button className="btn btn--primary" style={{padding:"10px", justifyContent:"center", marginTop:8}}>登录</button>
        <div style={{textAlign:"center", fontSize:11, color:"var(--muted)", margin:"8px 0", position:"relative"}}><span style={{padding:"0 10px", background:"var(--bg2)", position:"relative", zIndex:1}}>或</span><div style={{position:"absolute", left:0, right:0, top:"50%", height:1, background:"var(--border)"}}/></div>
        <button className="btn" style={{padding:"8px", justifyContent:"center"}}>{I.key} 使用 SSO 登录</button>
      </div>
      <div style={{fontSize:11, color:"var(--muted)", textAlign:"center", marginTop:24}}>所有登录都会被记录到审计日志</div>
    </div>
  </div>
);

Object.assign(window, { VideosView, UsersView, SettingsView, AuditView, SubmissionsView, SubtitlesView, AnalyticsView, LoginView });
