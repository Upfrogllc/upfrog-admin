import { useState, useEffect } from 'react';
import { getLeads, getLeadStats } from './lib/supabase';

const C = {
  bg:'#f8fafc', panel:'#fff', border:'#e2e8f0',
  text:'#0f172a', muted:'#64748b', faint:'#94a3b8',
  green:'#059669', amber:'#d97706', red:'#dc2626', blue:'#2563eb',
  orange:'#f97316',
};

function StatCard({ label, value, color, prefix }) {
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:'18px 20px' }}>
      <div style={{ fontSize:12, color:C.muted, fontWeight:500, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color:color||C.text }}>{prefix||''}{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

function ConfBadge({ confidence }) {
  const pct = Math.round((confidence||0)*100);
  const s = pct>=80
    ? { bg:'#d1fae5', color:'#065f46', label:'High' }
    : pct>=60
    ? { bg:'#fef3c7', color:'#92400e', label:'Medium' }
    : { bg:'#fee2e2', color:'#991b1b', label:'Low' };
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:s.bg, color:s.color }}>
      {s.label} {pct}%
    </span>
  );
}

export function LeadsTable({ clientId, clientSlug, showClient = false }) {
  const [leads, setLeads]   = useState([]);
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(0);
  const PER_PAGE = 25;

  useEffect(() => {
    load();
  }, [clientId]);

  async function load() {
    setLoading(true);
    try {
      const s = await getLeadStats(clientId);
      setStats(s);
      setLeads(s.leads || []);
    } catch(e) {
      console.error('Failed to load leads:', e);
    }
    setLoading(false);
  }

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.first_name?.toLowerCase().includes(q) ||
      l.last_name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.address?.toLowerCase().includes(q) ||
      l.phone?.includes(q)
    );
  });

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const fmt = n => n ? '$' + Math.round(n).toLocaleString() : '—';
  const fmtDate = d => {
    if (!d) return '—';
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.round(diff/60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff/3600000) + 'h ago';
    return date.toLocaleDateString();
  };

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:C.muted, fontSize:14 }}>Loading leads…</div>
  );

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          <StatCard label="Total leads"      value={stats.total}        color={C.text} />
          <StatCard label="This month"       value={stats.thisMonth}    color={C.blue} />
          <StatCard label="Avg confidence"   value={stats.avgConf+'%'}  color={C.green} />
          <StatCard label="Pipeline value"   value={stats.totalRevenue} color={C.orange} prefix="$" />
        </div>
      )}

      {/* Search */}
      <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center' }}>
        <input
          value={search} onChange={e=>{ setSearch(e.target.value); setPage(0); }}
          placeholder="Search by name, email, address…"
          style={{ flex:1, padding:'10px 14px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, color:C.text, outline:'none', fontFamily:'inherit' }}
        />
        <button onClick={load} style={{ padding:'10px 16px', background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, color:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
          ↻ Refresh
        </button>
        <span style={{ fontSize:13, color:C.faint, whiteSpace:'nowrap' }}>{filtered.length} leads</span>
      </div>

      {/* Table */}
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
        {paginated.length === 0 ? (
          <div style={{ padding:60, textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:16, fontWeight:600, color:C.text, marginBottom:6 }}>
              {leads.length === 0 ? 'No leads yet' : 'No leads match your search'}
            </div>
            <div style={{ fontSize:14, color:C.faint }}>
              {leads.length === 0 ? 'Leads will appear here as homeowners submit the estimate form.' : 'Try a different search term.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid #f1f5f9`, background:'#f8fafc' }}>
                  {[
                    'Homeowner', 'Address', 'Vertical',
                    'Pitch', 'Squares', 'Better price',
                    'Confidence', 'GHL', 'Results', 'When'
                  ].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:C.faint, textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(lead => (
                  <tr key={lead.id}
                    style={{ borderBottom:`1px solid #f8fafc`, transition:'background .1s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'12px 14px' }}>
                      <div style={{ fontWeight:500, fontSize:14, color:C.text }}>
                        {lead.first_name} {lead.last_name}
                      </div>
                      <div style={{ fontSize:12, color:C.muted }}>{lead.email}</div>
                      <div style={{ fontSize:12, color:C.faint }}>{lead.phone}</div>
                    </td>
                    <td style={{ padding:'12px 14px', fontSize:13, color:C.muted, maxWidth:180 }}>
                      <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lead.address || '—'}</div>
                    </td>
                    <td style={{ padding:'12px 14px' }}>
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20, background:'#f1f5f9', color:'#475569' }}>
                        {lead.vertical}
                      </span>
                    </td>
                    <td style={{ padding:'12px 14px', fontSize:14, fontWeight:500, color:C.text }}>
                      {lead.pitch ? `${lead.pitch}/12` : '—'}
                    </td>
                    <td style={{ padding:'12px 14px', fontSize:14, color:C.text }}>
                      {lead.squares ? parseFloat(lead.squares).toFixed(1) : '—'}
                    </td>
                    <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color:C.text }}>
                      {fmt(lead.price_better)}
                    </td>
                    <td style={{ padding:'12px 14px' }}>
                      <ConfBadge confidence={lead.confidence} />
                    </td>
                    <td style={{ padding:'12px 14px' }}>
                      {lead.ghl_pushed
                        ? <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>✓ Sent</span>
                        : <span style={{ fontSize:11, color:C.faint }}>—</span>
                      }
                    </td>
                    <td style={{ padding:'12px 14px' }}>
                      {lead.results_url ? (
                        <a href={lead.results_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize:12, color:C.blue, textDecoration:'none', fontWeight:500 }}>
                          View →
                        </a>
                      ) : '—'}
                    </td>
                    <td style={{ padding:'12px 14px', fontSize:12, color:C.faint, whiteSpace:'nowrap' }}>
                      {fmtDate(lead.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, color:C.faint }}>
              Showing {page*PER_PAGE+1}–{Math.min((page+1)*PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
                style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${C.border}`, background:C.panel, fontSize:13, cursor:page===0?'not-allowed':'pointer', opacity:page===0?0.5:1, fontFamily:'inherit' }}>
                ← Prev
              </button>
              <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}
                style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${C.border}`, background:C.panel, fontSize:13, cursor:page===totalPages-1?'not-allowed':'pointer', opacity:page===totalPages-1?0.5:1, fontFamily:'inherit' }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
