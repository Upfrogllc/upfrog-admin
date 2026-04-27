import { useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// ATTOM PROSPECT SEARCH
// Find owner-occupied homes with no HVAC permit history.
// Uses the same design tokens as App.jsx so it matches the admin look.
// ─────────────────────────────────────────────────────────────

const C = {
  bg:    '#f8fafc',
  panel: '#ffffff',
  border: '#e2e8f0',
  orange: '#f97316',
  text:  '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  green: '#059669',
  amber: '#d97706',
  red:   '#dc2626',
  blue:  '#2563eb',
};

// Worker URL + auth token — set these as Netlify env vars
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://upfrog-proxy.shiny-poetry-341c.workers.dev';
const AUTH_TOKEN = import.meta.env.VITE_ADMIN_AUTH_TOKEN || '';

// ─────────────────────────────────────────────────────────────
// VEGAS ZIP PRESETS
// ─────────────────────────────────────────────────────────────
const VEGAS_PRESETS = {
  'Summerlin':         ['89117', '89134', '89135', '89138', '89144', '89145'],
  'Henderson':         ['89002', '89011', '89012', '89014', '89015', '89052', '89074'],
  'North Las Vegas':   ['89030', '89031', '89032', '89081', '89084', '89085', '89086'],
  'Centennial Hills':  ['89129', '89130', '89131', '89149', '89166'],
  'Spring Valley':     ['89102', '89103', '89146', '89147', '89148'],
  'Green Valley':      ['89052', '89074', '89014', '89012'],
};

// ─────────────────────────────────────────────────────────────
// MATCH App.jsx UI PRIMITIVES (so the look stays consistent)
// ─────────────────────────────────────────────────────────────

function Btn({ children, onClick, variant='primary', small, disabled }) {
  const base = { display:'inline-flex', alignItems:'center', gap:6, borderRadius:8, fontWeight:600, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1, border:'none', whiteSpace:'nowrap' };
  const sizes = { padding: small ? '6px 14px' : '9px 18px', fontSize: small ? 12 : 13 };
  const variants = {
    primary:   { background:C.orange, color:'#fff' },
    secondary: { background:'transparent', color:C.text, border:`1px solid ${C.border}` },
    ghost:     { background:'transparent', color:C.muted },
    green:     { background:C.green, color:'#fff' },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes, ...variants[variant] }}>{children}</button>;
}

function Card({ children, style }) {
  return <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, ...style }}>{children}</div>;
}

function Input({ value, onChange, placeholder, type='text', prefix }) {
  return (
    <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', background:'#fff' }}>
      {prefix && <span style={{ padding:'0 12px', background:'#f8fafc', color:C.muted, fontSize:13, borderRight:`1px solid ${C.border}`, alignSelf:'stretch', display:'flex', alignItems:'center' }}>{prefix}</span>}
      <input type={type} value={value??''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ flex:1, padding:'10px 12px', border:'none', outline:'none', fontSize:14, color:C.text, background:'transparent', fontFamily:'inherit' }} />
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:600, color:C.text, marginBottom:6 }}>{label}</label>
      {hint && <p style={{ fontSize:11, color:C.faint, margin:'0 0 8px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'32px 36px 24px', borderBottom:`1px solid ${C.border}`, background:'#fff' }}>
      <div>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>{title}</h1>
        {subtitle && <p style={{ margin:'4px 0 0', fontSize:14, color:C.muted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function AttomProspect() {
  const [filters, setFilters] = useState({
    zip_codes: [],
    year_built_max: 2015,
    year_built_min: 1990,
    owner_occupied: true,
    min_value: 400000,
    max_value: 900000,
    min_sqft: 1800,
    max_sqft: 3500,
    exclude_hvac_permit_years: 15,
  });
  const [zipInput, setZipInput] = useState('');
  const [activeJob, setActiveJob] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  // Poll active job status every 3 seconds while running
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === 'complete' || activeJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${WORKER_URL}/attom/prospect-search/${activeJob.job_id || activeJob.id}`, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        });
        const data = await res.json();
        setActiveJob(data);
        if (data.status === 'complete' && data.preview) setResults(data.preview);
      } catch (err) {
        console.error('Status poll error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJob]);

  const addZip = (zip) => {
    const cleaned = zip.trim();
    if (!/^\d{5}$/.test(cleaned)) return;
    if (filters.zip_codes.includes(cleaned)) return;
    if (filters.zip_codes.length >= 10) {
      setError('Max 10 zip codes per job');
      return;
    }
    setFilters({ ...filters, zip_codes: [...filters.zip_codes, cleaned] });
    setZipInput('');
    setError(null);
  };

  const removeZip = (zip) => {
    setFilters({ ...filters, zip_codes: filters.zip_codes.filter(z => z !== zip) });
  };

  const applyPreset = (presetName) => {
    const zips = VEGAS_PRESETS[presetName];
    if (!zips) return;
    const unique = [...new Set(zips)].slice(0, 10);
    setFilters({ ...filters, zip_codes: unique });
    setError(null);
  };

  const runSearch = async () => {
    setError(null);
    setResults([]);

    if (filters.zip_codes.length === 0) {
      setError('Add at least one zip code');
      return;
    }

    try {
      const res = await fetch(`${WORKER_URL}/attom/prospect-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        body: JSON.stringify(filters),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setActiveJob(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportCsv = () => {
    if (!results.length) return;
    const headers = ['address_line1','city','state','zip','owner_name','year_built','square_feet','bedrooms','bathrooms','market_value','last_sale_date','target_score'];
    const rows = [
      headers.join(','),
      ...results.map(r => headers.map(h => csvEscape(r[h])).join(',')),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const jobShort = (activeJob?.job_id || activeJob?.id || 'export').slice(0,8);
    a.download = `attom-prospects-${jobShort}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRunning = activeJob && (activeJob.status === 'pending' || activeJob.status === 'running');

  // ───────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="ATTOM Prospect Search"
        subtitle="Find owner-occupied homes with no recent HVAC permit — likely replacement candidates"
        action={
          <Btn onClick={runSearch} disabled={isRunning || filters.zip_codes.length === 0}>
            {isRunning ? '⏳ Running...' : '▶ Run search'}
          </Btn>
        }
      />

      <div style={{ padding:'24px 36px' }}>

        {/* ── GEOGRAPHY ── */}
        <Card style={{ padding:24, marginBottom:20 }}>
          <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:4 }}>1. Geography</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>Pick zip codes (max 10 per job).</div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.faint, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Vegas presets</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {Object.keys(VEGAS_PRESETS).map(name => (
                <button key={name} onClick={() => applyPreset(name)}
                  style={{ padding:'6px 12px', background:'#fff7ed', border:`1px solid ${C.orange}`, borderRadius:20, fontSize:12, color:C.orange, cursor:'pointer', fontWeight:500 }}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <Input
                value={zipInput}
                onChange={setZipInput}
                placeholder="Add zip code (e.g. 89117)"
              />
            </div>
            <Btn variant='secondary' onClick={() => addZip(zipInput)}>+ Add</Btn>
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', gap:6, minHeight:32 }}>
            {filters.zip_codes.length === 0
              ? <span style={{ fontSize:13, color:C.faint }}>No zip codes selected</span>
              : filters.zip_codes.map(zip => (
                  <span key={zip} style={{ background:'#dbeafe', color:'#1e40af', padding:'4px 10px', borderRadius:6, fontSize:13, display:'inline-flex', alignItems:'center', gap:6, fontWeight:500 }}>
                    {zip}
                    <button onClick={() => removeZip(zip)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#1e40af', fontSize:16, padding:0, lineHeight:1 }}>×</button>
                  </span>
                ))
            }
          </div>
        </Card>

        {/* ── FILTERS ── */}
        <Card style={{ padding:24, marginBottom:20 }}>
          <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:4 }}>2. Filters</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>Tighter filters = fewer but higher-quality targets.</div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <Field label="Year built — min" hint="Older homes have older HVAC">
              <Input type="number" value={filters.year_built_min} onChange={v => setFilters({ ...filters, year_built_min: parseInt(v) || 1950 })} />
            </Field>
            <Field label="Year built — max" hint="10+ years old = built 2015 or earlier">
              <Input type="number" value={filters.year_built_max} onChange={v => setFilters({ ...filters, year_built_max: parseInt(v) || 2015 })} />
            </Field>

            <Field label="Min home value" hint="Filters out low-end / flips">
              <Input type="number" value={filters.min_value} prefix="$" onChange={v => setFilters({ ...filters, min_value: parseInt(v) || 0 })} />
            </Field>
            <Field label="Max home value" hint="Filters out luxury homes (different sale process)">
              <Input type="number" value={filters.max_value} prefix="$" onChange={v => setFilters({ ...filters, max_value: parseInt(v) || 99999999 })} />
            </Field>

            <Field label="Min square feet">
              <Input type="number" value={filters.min_sqft} onChange={v => setFilters({ ...filters, min_sqft: parseInt(v) || 0 })} />
            </Field>
            <Field label="Max square feet">
              <Input type="number" value={filters.max_sqft} onChange={v => setFilters({ ...filters, max_sqft: parseInt(v) || 99999 })} />
            </Field>

            <Field label="Exclude HVAC permits within (years)" hint="If they pulled a permit recently, system isn't due">
              <Input type="number" value={filters.exclude_hvac_permit_years} onChange={v => setFilters({ ...filters, exclude_hvac_permit_years: parseInt(v) || 15 })} />
            </Field>

            <div style={{ display:'flex', alignItems:'center', paddingTop:24 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, color:C.text, cursor:'pointer' }}>
                <input type="checkbox" checked={filters.owner_occupied} onChange={e => setFilters({ ...filters, owner_occupied: e.target.checked })} />
                Owner-occupied only
              </label>
            </div>
          </div>
        </Card>

        {/* ── ERROR ── */}
        {error && (
          <Card style={{ padding:'14px 18px', marginBottom:20, background:'#fee2e2', borderColor:'#fecaca' }}>
            <div style={{ color:'#991b1b', fontSize:14 }}>⚠️ {error}</div>
          </Card>
        )}

        {/* ── JOB STATUS ── */}
        {activeJob && (
          <Card style={{ padding:24, marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:15, color:C.text }}>3. Job status</div>
                <div style={{ fontSize:12, color:C.faint, marginTop:2 }}>ID: {(activeJob.job_id || activeJob.id || '').slice(0, 8)}</div>
              </div>
              <StatusPill status={activeJob.status} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              <Stat label="Stage" value={activeJob.stage || '—'} />
              <Stat label="Properties" value={(activeJob.total_properties || 0).toLocaleString()} />
              <Stat label="Permits checked" value={(activeJob.permits_checked || 0).toLocaleString()} />
              <Stat label="Targets found" value={(activeJob.targets_found || 0).toLocaleString()} highlight={activeJob.targets_found > 0} />
            </div>

            {activeJob.error_message && (
              <div style={{ marginTop:16, padding:'12px 14px', background:'#fee2e2', borderRadius:8, fontSize:13, color:'#991b1b' }}>
                Error: {activeJob.error_message}
              </div>
            )}
          </Card>
        )}

        {/* ── RESULTS ── */}
        {results.length > 0 && (
          <Card style={{ marginBottom:20 }}>
            <div style={{ padding:'16px 24px', borderBottom:`1px solid #f1f5f9`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:15, color:C.text }}>4. Top targets (preview)</div>
                <div style={{ fontSize:12, color:C.faint, marginTop:2 }}>Showing top 10 by score · full list in CSV export</div>
              </div>
              <Btn small variant='secondary' onClick={exportCsv}>↓ Export CSV</Btn>
            </div>

            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:`1px solid #f1f5f9` }}>
                  {['Score','Address','Built','Sq ft','Value','Owner'].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:C.faint, textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id} style={{ borderBottom:`1px solid #f8fafc` }}>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ fontWeight:700, fontSize:14, color: scoreColor(r.target_score) }}>
                        {r.target_score}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, color:C.text }}>
                      <div style={{ fontWeight:500 }}>{r.address_line1}</div>
                      <div style={{ fontSize:12, color:C.faint }}>{r.city}, {r.state} {r.zip}</div>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, color:C.text }}>{r.year_built}</td>
                    <td style={{ padding:'14px 16px', fontSize:13, color:C.text }}>{r.square_feet?.toLocaleString()}</td>
                    <td style={{ padding:'14px 16px', fontSize:13, color:C.text, fontWeight:500 }}>${r.market_value?.toLocaleString()}</td>
                    <td style={{ padding:'14px 16px', fontSize:13, color:C.muted }}>{r.owner_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const styles = {
    pending: { bg:'#fef3c7', text:'#92400e', label:'Pending' },
    running: { bg:'#dbeafe', text:'#1e40af', label:'Running' },
    complete: { bg:'#d1fae5', text:'#065f46', label:'Complete' },
    failed:  { bg:'#fee2e2', text:'#991b1b', label:'Failed' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:s.bg, color:s.text }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor' }} />
      {s.label}
    </span>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{ padding:'12px 14px', background:highlight ? '#f0fdf4' : '#f8fafc', border:`1px solid ${highlight ? '#bbf7d0' : C.border}`, borderRadius:8 }}>
      <div style={{ fontSize:11, color:C.muted, fontWeight:500, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, color: highlight ? C.green : C.text }}>{value}</div>
    </div>
  );
}

function scoreColor(score) {
  if (score >= 80) return C.green;
  if (score >= 60) return C.amber;
  return C.muted;
}

function csvEscape(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
