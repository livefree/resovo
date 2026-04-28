/* global React */
/* DataTable v2 — generic, reusable across all list pages.
   Features: header-integrated sort/filter/hide/pin, bulk action bar,
   pagination (auto-mode), saved views (personal/team), sticky thead,
   internal scroll, optimistic row-flash, empty state. */
const { useState: dtUS, useEffect: dtUE, useMemo: dtUM, useRef: dtUR } = React;

/* ---- Header column popover ---- */
const DTHeaderMenu = ({ col, sortKey, sortDir, onSort, onFilter, onHide, onPin, onClose, anchor }) => {
  const ref = dtUR(null);
  dtUE(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const r = anchor?.getBoundingClientRect?.();
  const style = r ? { top: r.bottom + 4, left: Math.max(8, r.left - 8) } : {};
  return (
    <div className="dt__pop" style={style} ref={ref}>
      <div className={`dt__pop-item ${sortKey===col.key && sortDir==="asc" ? "is-active" : ""}`} onClick={() => { onSort(col.key, "asc"); onClose(); }}>
        <span className="ico">↑</span>升序
      </div>
      <div className={`dt__pop-item ${sortKey===col.key && sortDir==="desc" ? "is-active" : ""}`} onClick={() => { onSort(col.key, "desc"); onClose(); }}>
        <span className="ico">↓</span>降序
      </div>
      {col.filterable !== false && (
        <>
          <div className="dt__pop-sep"></div>
          <div style={{padding:"6px 10px"}}>
            <div style={{fontSize:10, color:"var(--muted)", marginBottom:4, textTransform:"uppercase", letterSpacing:.5}}>过滤</div>
            <input className="dt__pop-input" placeholder={`筛选 ${col.label}…`} onKeyDown={(e) => { if (e.key === "Enter") { onFilter(col.key, e.target.value); onClose(); } }} />
          </div>
        </>
      )}
      <div className="dt__pop-sep"></div>
      <div className="dt__pop-item" onClick={() => { onPin(col.key); onClose(); }}>
        <span className="ico">📌</span>固定到左侧
      </div>
      <div className="dt__pop-item" onClick={() => { onHide(col.key); onClose(); }}>
        <span className="ico">𐌎</span>隐藏此列
      </div>
    </div>
  );
};

/* ---- Saved views dropdown ---- */
const DTViewList = ({ views, current, onPick, onSaveCurrent, onClose, anchor }) => {
  const ref = dtUR(null);
  dtUE(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const r = anchor?.getBoundingClientRect?.();
  const style = r ? { top: r.bottom + 4, left: r.left } : {};
  return (
    <div className="dt__view-list" style={style} ref={ref}>
      {views.map((v) => (
        <div key={v.id} className={`dt__view-row ${current === v.id ? "is-active" : ""}`} onClick={() => { onPick(v.id); onClose(); }}>
          <span style={{flex:1}}>{v.label}</span>
          <span className={`scope ${v.scope === "team" ? "team" : ""}`}>{v.scope === "team" ? "团队" : "个人"}</span>
        </div>
      ))}
      <div className="dt__pop-sep"></div>
      <div className="dt__view-row" onClick={() => { onSaveCurrent("personal"); onClose(); }}>
        <span style={{color:"var(--accent)"}}>＋ 保存当前为个人视图</span>
      </div>
      <div className="dt__view-row" onClick={() => { onSaveCurrent("team"); onClose(); }}>
        <span style={{color:"var(--info)"}}>＋ 保存当前为团队视图</span>
      </div>
    </div>
  );
};

/* ---- Pagination ---- */
const DTPager = ({ total, page, pageSize, onPage, onPageSize }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cursor = total > 50000;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const renderPages = () => {
    if (cursor) {
      return [
        <span key="m" className="pg is-disabled">游标分页 (大数据集)</span>
      ];
    }
    const out = [];
    const push = (p) => out.push(
      <span key={p} className={`pg ${page === p ? "is-active" : ""}`} onClick={() => onPage(p)}>{p}</span>
    );
    push(1);
    if (page > 3) out.push(<span key="l" className="pg is-disabled">…</span>);
    for (let i = Math.max(2, page-1); i <= Math.min(totalPages-1, page+1); i++) push(i);
    if (page < totalPages-2) out.push(<span key="r" className="pg is-disabled">…</span>);
    if (totalPages > 1) push(totalPages);
    return out;
  };
  return (
    <>
      <span>共 <strong style={{color:"var(--text)"}}>{total.toLocaleString()}</strong> 条 · 当前 {start}–{end}</span>
      <span style={{flex:1}} />
      <select value={pageSize} onChange={(e) => onPageSize(+e.target.value)} className="dt__pop-input" style={{width:"auto", margin:0, padding:"4px 6px"}}>
        {[20, 50, 100].map(n => <option key={n} value={n}>每页 {n}</option>)}
      </select>
      <div className="dt__pager">
        <span className={`pg ${page === 1 ? "is-disabled" : ""}`} onClick={() => onPage(1)}>‹‹</span>
        <span className={`pg ${page === 1 ? "is-disabled" : ""}`} onClick={() => onPage(Math.max(1, page-1))}>‹</span>
        {renderPages()}
        <span className={`pg ${page === totalPages || cursor ? "is-disabled" : ""}`} onClick={() => onPage(Math.min(totalPages, page+1))}>›</span>
        <span className={`pg ${page === totalPages || cursor ? "is-disabled" : ""}`} onClick={() => onPage(totalPages)}>››</span>
      </div>
    </>
  );
};

/* ---- Main DataTable ---- */
const DataTable = ({
  columns,            // [{key, label, render?, sortable?, filterable?, width?, pinned?}]
  rows,               // array of records
  rowKey = "id",
  totalCount,         // total (defaults to rows.length)
  selectable = true,
  bulkActions = null, // function(selectedIds, clear) => ReactNode
  toolbar = null,     // extra toolbar items (right side)
  views = [],         // saved views [{id, label, scope, state}]
  flashIds = [],      // ids to highlight (optimistic update)
  onRowClick,
  empty = null,       // empty state element
  searchable = true,
  searchPlaceholder = "搜索…",
}) => {
  const [sortKey, setSortKey] = dtUS(null);
  const [sortDir, setSortDir] = dtUS("desc");
  const [hidden, setHidden] = dtUS(new Set());
  const [pinned, setPinned] = dtUS(new Set(columns.filter(c => c.pinned).map(c => c.key)));
  const [filters, setFilters] = dtUS({});
  const [search, setSearch] = dtUS("");
  const [sel, setSel] = dtUS(new Set());
  const [page, setPage] = dtUS(1);
  const [pageSize, setPageSize] = dtUS(20);
  const [menu, setMenu] = dtUS(null); // {col, anchor}
  const [viewOpen, setViewOpen] = dtUS(false);
  const [activeView, setActiveView] = dtUS(null);
  const viewBtn = dtUR(null);

  const visibleCols = columns.filter(c => !hidden.has(c.key));
  const total = totalCount ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSort = (k, d) => { setSortKey(k); setSortDir(d); };
  const handleHide = (k) => setHidden(s => new Set(s).add(k));
  const handlePin = (k) => setPinned(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const handleFilter = (k, v) => setFilters(f => v ? {...f, [k]: v} : (() => { const n = {...f}; delete n[k]; return n; })());
  const clearSel = () => setSel(new Set());

  const allKeys = rows.map(r => r[rowKey]);
  const allOnPage = new Set(allKeys);
  const selOnPageCount = [...sel].filter(k => allOnPage.has(k)).length;
  const headChk = selOnPageCount === 0 ? "" : selOnPageCount === allKeys.length ? "is-checked" : "is-mixed";

  const flashSet = new Set(flashIds);

  const restoreCol = (k) => setHidden(s => { const n = new Set(s); n.delete(k); return n; });

  return (
    <div className="dt">
      {/* Toolbar */}
      <div className="dt__toolbar">
        {searchable && (
          <div className="dt__search">
            <span className="dt__search-ico">⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} />
          </div>
        )}
        <div className="dt__views" ref={viewBtn} onClick={() => setViewOpen(o => !o)}>
          <span style={{color:"var(--muted)", fontSize:11}}>视图</span>
          <strong style={{fontWeight:600, color:"var(--text)"}}>{views.find(v => v.id === activeView)?.label || "默认"}</strong>
          <span style={{color:"var(--muted)"}}>▾</span>
        </div>
        {viewOpen && (
          <DTViewList
            views={views}
            current={activeView}
            anchor={viewBtn.current}
            onPick={(id) => setActiveView(id)}
            onSaveCurrent={(scope) => alert(`保存为${scope === "team" ? "团队" : "个人"}视图`)}
            onClose={() => setViewOpen(false)}
          />
        )}
        {Object.entries(filters).map(([k, v]) => {
          const col = columns.find(c => c.key === k);
          return (
            <span key={k} className="fchip fchip--active">
              <span className="fchip__key">{col?.label}:</span>{v}
              <span className="fchip__x" onClick={() => handleFilter(k, "")}>×</span>
            </span>
          );
        })}
        <span className="dt__spacer" />
        {hidden.size > 0 && (
          <span className="fchip" onClick={() => setHidden(new Set())}>
            <span className="fchip__key">已隐藏:</span>{hidden.size} 列 <span className="fchip__x">恢复</span>
          </span>
        )}
        {toolbar}
      </div>

      {/* Body */}
      <div className="dt__body">
        {rows.length === 0 ? (
          empty || <div className="empty" style={{padding:"60px 20px"}}>没有数据</div>
        ) : (
          <table>
            <thead>
              <tr>
                {selectable && (
                  <th style={{width:36}}>
                    <span className={`checkbox ${headChk}`} onClick={() => setSel(headChk === "is-checked" ? new Set() : new Set(allKeys))} />
                  </th>
                )}
                {visibleCols.map((col) => (
                  <th key={col.key} style={{width: col.width}}>
                    <span className="dt__th-inner" onClick={(e) => setMenu({ col, anchor: e.currentTarget.parentElement })}>
                      {pinned.has(col.key) && <span style={{fontSize:9, color:"var(--accent)"}}>📌</span>}
                      {col.label}
                      {sortKey === col.key && (
                        <span className="dt__th-sort is-on">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                      <span className={`dt__th-menu ${menu?.col?.key === col.key ? "is-active" : ""}`}>⋯</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = row[rowKey];
                const isSel = sel.has(id);
                const isFlash = flashSet.has(id);
                return (
                  <tr key={id} className={`${isSel ? "is-selected" : ""} ${isFlash ? "is-flash" : ""}`}>
                    {selectable && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <span className={`checkbox ${isSel ? "is-checked" : ""}`} onClick={() => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })} />
                      </td>
                    )}
                    {visibleCols.map((col) => (
                      <td key={col.key} onClick={() => onRowClick?.(row)}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Bulk bar — sticky inside scroll body so always visible */}
        {selectable && sel.size > 0 && (
          <div className="dt__bulk">
            <span>已选 <em>{sel.size}</em> / {total} 项</span>
            <span className="dt__bulk-sep" />
            {bulkActions ? bulkActions([...sel], clearSel) : null}
            <span style={{flex:1}} />
            <span style={{color:"var(--muted)", fontSize:11}}>取消 · Esc</span>
            <button className="btn btn--xs" onClick={clearSel}>清除选择</button>
          </div>
        )}
      </div>

      {/* Footer / pagination */}
      <div className="dt__foot">
        <DTPager total={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {/* Header column popover */}
      {menu && (
        <DTHeaderMenu
          col={menu.col}
          anchor={menu.anchor}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onFilter={handleFilter}
          onHide={handleHide}
          onPin={handlePin}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
};

Object.assign(window, { DataTable });
