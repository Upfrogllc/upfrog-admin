import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getClients, createClient, updateClient, deleteClient,
  addVertical, removeVertical, updateVertical, updatePricebook,
  updateGHL, getStatusLabel, slugify, seedDemoData,
} from './lib/store';
import { VERTICALS, VERTICAL_LIST, REGION_PRESETS } from './data/verticals';
import { generateFunnelHTML, generateWorkerSnippet, downloadXLSX } from './lib/generateHTML';
import { setupClientPortal as authSetupPortal } from './lib/auth';
import { LeadsTable } from './LeadsView';

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const C = {
  bg:    '#f8fafc',
  panel: '#ffffff',
  sidebar: '#0f172a',
  border: '#e2e8f0',
  orange: '#f97316',
  orangeLight: '#fed7aa',
  text:  '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  green: '#059669',
  amber: '#d97706',
  red:   '#dc2626',
  blue:  '#2563eb',
};

const statusStyles = {
  draft:  { bg:'#f3f4f6', text:'#374151' },
  setup:  { bg:'#fef3c7', text:'#92400e' },
  ready:  { bg:'#dbeafe', text:'#1e40af' },
  live:   { bg:'#d1fae5', text:'#065f46' },
  paused: { bg:'#fee2e2', text:'#991b1b' },
};

// ─────────────────────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = statusStyles[status] || statusStyles.draft;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:s.bg, color:s.text }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor', display:'inline-block' }} />
      {getStatusLabel(status)}
    </span>
  );
}

function Btn({ children, onClick, variant='primary', small, disabled, full }) {
  const base = { display:'inline-flex', alignItems:'center', gap:6, borderRadius:8, fontWeight:600, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1, border:'none', transition:'opacity .15s', whiteSpace:'nowrap', width:full?'100%':undefined, justifyContent:full?'center':undefined };
  const sizes = { padding: small ? '6px 14px' : '9px 18px', fontSize: small ? 12 : 13 };
  const variants = {
    primary:   { background:C.orange, color:'#fff' },
    secondary: { background:'transparent', color:C.text, border:`1px solid ${C.border}` },
    danger:    { background:'transparent', color:C.red, border:`1px solid #fecaca` },
    ghost:     { background:'transparent', color:C.muted },
    green:     { background:C.green, color:'#fff' },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes, ...variants[variant] }}>{children}</button>;
}

function Card({ children, style }) {
  return <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, ...style }}>{children}</div>;
}

function Input({ value, onChange, placeholder, type='text', prefix, suffix, autoFocus }) {
  return (
    <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', background:'#fff' }}>
      {prefix && <span style={{ padding:'0 12px', background:'#f8fafc', color:C.muted, fontSize:13, borderRight:`1px solid ${C.border}`, alignSelf:'stretch', display:'flex', alignItems:'center' }}>{prefix}</span>}
      <input autoFocus={autoFocus} type={type} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ flex:1, padding:'10px 12px', border:'none', outline:'none', fontSize:14, color:C.text, background:'transparent', fontFamily:'inherit' }} />
      {suffix && <span style={{ padding:'0 12px', background:'#f8fafc', color:C.muted, fontSize:13, borderLeft:`1px solid ${C.border}`, alignSelf:'stretch', display:'flex', alignItems:'center' }}>{suffix}</span>}
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows=3 }) {
  return <textarea value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width:'100%', padding:'10px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, color:C.text, resize:'vertical', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />;
}

function Field({ label, hint, children, required }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:600, color:C.text, marginBottom:6 }}>
        {label}{required && <span style={{ color:C.red, marginLeft:2 }}>*</span>}
      </label>
      {hint && <p style={{ fontSize:11, color:C.faint, margin:'0 0 8px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden' }}>
      {label && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', background:'#f8fafc', borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontSize:11, fontWeight:600, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
          <Btn onClick={copy} variant='ghost' small>{copied ? '✓ Copied' : 'Copy'}</Btn>
        </div>
      )}
      <pre style={{ margin:0, padding:'14px', fontSize:12, color:'#1e293b', background:'#f8fafc', overflowX:'auto', lineHeight:1.6, maxHeight:280, overflow:'auto' }}>{code}</pre>
    </div>
  );
}

function Shell({ children, nav }) {
  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Inter,system-ui,sans-serif', background:C.bg }}>
      <aside style={{ width:220, background:C.sidebar, display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontWeight:800, fontSize:20, color:C.orange, letterSpacing:'-0.5px' }}>Up<span style={{ color:'#fff' }}>frog</span></div>
          <div style={{ fontSize:10, color:'#64748b', marginTop:2, fontWeight:500, letterSpacing:'1px', textTransform:'uppercase' }}>Agency Admin</div>
        </div>
        <nav style={{ flex:1, padding:'12px 12px' }}>{nav}</nav>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#475569', lineHeight:1.4 }}>
          Worker: upfrog-proxy.<br/>shiny-poetry-341c
        </div>
      </aside>
      <main style={{ flex:1, overflow:'auto' }}>{children}</main>
    </div>
  );
}

function NavItem({ label, icon, active, onClick, count }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px', borderRadius:8, border:'none', cursor:'pointer', background:active?'rgba(249,115,22,0.15)':'transparent', color:active?C.orange:'#94a3b8', fontSize:13, fontWeight:active?600:400, textAlign:'left', marginBottom:2, transition:'all 0.15s' }}>
      <span style={{ fontSize:15 }}>{icon}</span>
      <span style={{ flex:1 }}>{label}</span>
      {count != null && <span style={{ fontSize:10, background:'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:10, color:'#94a3b8' }}>{count}</span>}
    </button>
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
// BRAND COLOR EXTRACTOR
// ─────────────────────────────────────────────────────────────

async function extractColorsFromImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100; canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 100, 100);
      const data = ctx.getImageData(0, 0, 100, 100).data;
      const buckets = {};
      for (let i = 0; i < data.length; i += 16) {
        const r = Math.round(data[i]/32)*32;
        const g = Math.round(data[i+1]/32)*32;
        const b = Math.round(data[i+2]/32)*32;
        const a = data[i+3];
        if (a < 128) continue;
        if (r > 240 && g > 240 && b > 240) continue;
        if (r < 15  && g < 15  && b < 15) continue;
        const k = `${r},${g},${b}`;
        buckets[k] = (buckets[k]||0) + 1;
      }
      const top = Object.entries(buckets).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const colors = top.map(([k]) => {
        const [r,g,b] = k.split(',').map(Number);
        return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
      });
      URL.revokeObjectURL(url);
      resolve(colors);
    };
    img.src = url;
  });
}

async function scrapeHomepageColors(domain) {
  // In production: call your Cloudflare Worker /scrape-brand endpoint
  // For now return a placeholder
  return {
    colors: ['#c0572a', '#2d2a26', '#f5e8e0'],
    context: `Homepage scraped from ${domain}. Brand appears to use warm terracotta tones.`,
  };
}

// ─────────────────────────────────────────────────────────────
// NEW CLIENT WIZARD — one question at a time
// ─────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id:'name',        title:"What's the business name?",         sub:"This is how they'll appear in the admin and on their funnel pages.", field:'name' },
  { id:'contact',     title:'How do we reach them?',             sub:'Phone and email for internal records.', field:'contact' },
  { id:'location',    title:'Where are they located?',           sub:'City, state, zip, and the area they serve.', field:'location' },
  { id:'domain',      title:"What's their website?",             sub:"We'll scrape it for brand colors and context.", field:'domain' },
  { id:'logo',        title:'Upload their logo',                 sub:"We'll extract their brand colors automatically.", field:'logo' },
  { id:'colors',      title:'Confirm brand colors',              sub:'We extracted these from the logo. Adjust as needed.', field:'colors' },
  { id:'tracking',    title:'Tracking codes',                    sub:'Meta Pixel ID and GA Measurement ID for their funnel pages.', field:'tracking' },
  { id:'vertical',    title:'Which vertical are we setting up?', sub:'You can add more verticals later.', field:'vertical' },
];

function NewClientWizard({ onSave, onCancel }) {
  const [step, setStep]         = useState(0);
  const [data, setData]         = useState({ brandColor:'#c0572a', brandColorAlt:'#2d2a26', brandColors:[], verticals:[] });
  const [loading, setLoading]   = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const fileRef = useRef();

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const currentStep = WIZARD_STEPS[step];
  const progress = ((step) / WIZARD_STEPS.length) * 100;

  const canAdvance = () => {
    if (currentStep.id === 'name')     return !!(data.name?.trim());
    if (currentStep.id === 'contact')  return !!(data.email?.trim() || data.phone?.trim());
    if (currentStep.id === 'location') return !!(data.city?.trim());
    if (currentStep.id === 'vertical') return data.verticals?.length > 0;
    return true;
  };

  const handleLogoUpload = async (file) => {
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    // Store as data URL for persistence
    const reader = new FileReader();
    reader.onload = (e) => set('logoUrl', e.target.result);
    reader.readAsDataURL(file);
    // Extract colors
    setLoading(true);
    try {
      const colors = await extractColorsFromImage(file);
      const palette = colors.map((hex, i) => ({ hex, role: i===0?'primary':i===1?'secondary':'accent' }));
      set('brandColors', palette);
      if (colors[0]) set('brandColor', colors[0]);
      if (colors[1]) set('brandColorAlt', colors[1]);
    } catch(e) {}
    setLoading(false);
  };

  const handleDomainScrape = async () => {
    if (!data.domain) return;
    setLoading(true);
    try {
      const result = await scrapeHomepageColors(data.domain);
      if (result.colors?.length && !data.brandColors?.length) {
        const palette = result.colors.map((hex, i) => ({ hex, role: i===0?'primary':i===1?'secondary':'accent' }));
        set('brandColors', palette);
        if (result.colors[0]) set('brandColor', result.colors[0]);
      }
      if (result.context) set('brandContext', result.context);
    } catch(e) {}
    setLoading(false);
  };

  const next = async () => {
    if (currentStep.id === 'domain' && data.domain) {
      handleDomainScrape();
    }
    if (step < WIZARD_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      onSave(data);
    }
  };

  const skip = () => {
    if (step < WIZARD_STEPS.length - 1) setStep(s => s + 1);
    else onSave(data);
  };

  return (
    <div style={{ maxWidth:580, margin:'0 auto', padding:'32px 24px' }}>
      {/* Progress */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:36 }}>
        <div style={{ flex:1, height:4, background:C.border, borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progress}%`, background:C.orange, borderRadius:2, transition:'width .4s' }} />
        </div>
        <span style={{ fontSize:12, color:C.faint, whiteSpace:'nowrap' }}>{step+1} of {WIZARD_STEPS.length}</span>
      </div>

      <div style={{ fontSize:12, fontWeight:600, color:C.orange, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>
        New client
      </div>
      <h2 style={{ margin:'0 0 8px', fontSize:26, fontWeight:700, color:C.text, lineHeight:1.2 }}>{currentStep.title}</h2>
      <p style={{ margin:'0 0 32px', fontSize:15, color:C.muted, lineHeight:1.6 }}>{currentStep.sub}</p>

      <Card style={{ padding:28, marginBottom:24 }}>
        {/* ── NAME ── */}
        {currentStep.id === 'name' && (
          <Field label="Company name" required>
            <Input value={data.name} onChange={v => { set('name', v); set('slug', slugify(v)); }} placeholder="Peak Roofing Maryland" autoFocus />
            {data.slug && <div style={{ fontSize:11, color:C.faint, marginTop:6 }}>Slug: {data.slug}</div>}
          </Field>
        )}

        {/* ── CONTACT ── */}
        {currentStep.id === 'contact' && (
          <>
            <Field label="Phone number">
              <Input value={data.phone} onChange={v=>set('phone',v)} placeholder="(301) 555-0100" autoFocus />
            </Field>
            <Field label="Email address">
              <Input value={data.email} onChange={v=>set('email',v)} placeholder="info@contractor.com" type="email" />
            </Field>
          </>
        )}

        {/* ── LOCATION ── */}
        {currentStep.id === 'location' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 100px', gap:12 }}>
              <Field label="City" required><Input value={data.city} onChange={v=>set('city',v)} placeholder="Leonardtown" autoFocus /></Field>
              <Field label="State"><Input value={data.state} onChange={v=>set('state',v)} placeholder="MD" /></Field>
              <Field label="Zip"><Input value={data.zip} onChange={v=>set('zip',v)} placeholder="20650" /></Field>
            </div>
            <Field label="Service area" hint="Counties or cities they cover — used in funnel context">
              <Textarea value={data.serviceArea} onChange={v=>set('serviceArea',v)} placeholder="St. Mary's County, Calvert County, Charles County MD" rows={2} />
            </Field>
          </>
        )}

        {/* ── DOMAIN ── */}
        {currentStep.id === 'domain' && (
          <>
            <Field label="Homepage URL" hint="We'll scrape this for brand context and colors">
              <Input value={data.domain} onChange={v=>set('domain',v)} placeholder="peakroofing.com" autoFocus />
            </Field>
            {loading && <div style={{ fontSize:13, color:C.muted, marginTop:8 }}>⏳ Scraping homepage...</div>}
            {data.brandContext && (
              <div style={{ marginTop:12, padding:12, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, fontSize:12, color:'#166534' }}>
                ✓ {data.brandContext}
              </div>
            )}
            <div style={{ marginTop:8, fontSize:12, color:C.faint }}>You can also skip this and add colors manually in the next step.</div>
          </>
        )}

        {/* ── LOGO ── */}
        {currentStep.id === 'logo' && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border:`2px dashed ${C.border}`, borderRadius:12, padding:40, textAlign:'center', cursor:'pointer', transition:'border-color .2s', marginBottom:16 }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.orange}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" style={{ maxHeight:80, maxWidth:240, objectFit:'contain' }} />
              ) : (
                <>
                  <div style={{ fontSize:40, marginBottom:12 }}>🖼️</div>
                  <div style={{ fontSize:15, fontWeight:600, color:C.text, marginBottom:4 }}>Click to upload logo</div>
                  <div style={{ fontSize:13, color:C.faint }}>PNG, JPG, SVG — we'll extract brand colors automatically</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
            {loading && <div style={{ fontSize:13, color:C.muted }}>⏳ Extracting colors from logo...</div>}
            {logoPreview && !loading && <div style={{ fontSize:12, color:C.green }}>✓ Logo uploaded — colors extracted</div>}
            <div style={{ marginTop:12, fontSize:12, color:C.faint }}>No logo? Skip this step and enter colors manually.</div>
          </>
        )}

        {/* ── COLORS ── */}
        {currentStep.id === 'colors' && (
          <>
            {/* Extracted palette */}
            {data.brandColors?.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:10 }}>Extracted palette</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
                  {data.brandColors.map((c, i) => (
                    <div key={i} style={{ textAlign:'center' }}>
                      <div
                        onClick={() => { set('brandColor', c.hex); }}
                        style={{ width:48, height:48, borderRadius:10, background:c.hex, border:`2px solid ${data.brandColor===c.hex?C.orange:C.border}`, cursor:'pointer', marginBottom:4 }}
                        title={`Set as primary: ${c.hex}`}
                      />
                      <div style={{ fontSize:10, color:C.faint }}>{c.hex}</div>
                      <div style={{ fontSize:10, color:C.muted, fontWeight:500 }}>{c.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <Field label="Primary brand color" hint="Used for buttons and accents">
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={data.brandColor||'#c0572a'} onChange={e=>set('brandColor',e.target.value)}
                    style={{ width:44, height:38, border:`1px solid ${C.border}`, borderRadius:8, cursor:'pointer', padding:2 }} />
                  <Input value={data.brandColor} onChange={v=>set('brandColor',v)} placeholder="#c0572a" />
                </div>
              </Field>
              <Field label="Secondary color" hint="Used for headings and dark areas">
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={data.brandColorAlt||'#2d2a26'} onChange={e=>set('brandColorAlt',e.target.value)}
                    style={{ width:44, height:38, border:`1px solid ${C.border}`, borderRadius:8, cursor:'pointer', padding:2 }} />
                  <Input value={data.brandColorAlt} onChange={v=>set('brandColorAlt',v)} placeholder="#2d2a26" />
                </div>
              </Field>
            </div>

            {/* Live preview */}
            <div style={{ marginTop:16, borderRadius:12, overflow:'hidden', border:`1px solid ${C.border}` }}>
              <div style={{ background:data.brandColor||'#c0572a', padding:'16px 20px', color:'#fff' }}>
                <div style={{ fontSize:11, opacity:.8, marginBottom:4, textTransform:'uppercase', letterSpacing:'1px' }}>Preview</div>
                <div style={{ fontWeight:700, fontSize:18 }}>{data.name||'Contractor Name'}</div>
              </div>
              <div style={{ padding:'12px 20px', background:'#faf7f2', display:'flex', gap:10 }}>
                <div style={{ background:data.brandColor||'#c0572a', color:'#fff', padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:600 }}>Get My Estimate</div>
                <div style={{ border:`1px solid ${C.border}`, padding:'8px 16px', borderRadius:8, fontSize:13, color:data.brandColorAlt||'#2d2a26' }}>Learn more</div>
              </div>
            </div>
          </>
        )}

        {/* ── LEADS ── */}
        {tab==='leads' && (
          <LeadsTable clientId={client.id} clientSlug={client.slug} />
        )}

        {/* ── TRACKING ── */}
        {currentStep.id === 'tracking' && (
          <>
            <Field label="Meta Pixel ID" hint="Numbers only — e.g. 1234567890123456">
              <Input value={data.metaPixelId} onChange={v=>set('metaPixelId',v)} placeholder="1234567890" autoFocus />
            </Field>
            <Field label="GA Measurement ID" hint="From Google Analytics — starts with G-">
              <Input value={data.gaMeasurementId} onChange={v=>set('gaMeasurementId',v)} placeholder="G-XXXXXXXXXX" />
            </Field>
            <div style={{ fontSize:12, color:C.faint, marginTop:4 }}>Both are optional. They'll be baked into every generated funnel page for this client.</div>
          </>
        )}

        {/* ── VERTICAL ── */}
        {currentStep.id === 'vertical' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
              {VERTICAL_LIST.filter(v=>v.status==='live').map(def => {
                const sel = data.verticals?.includes(def.id);
                return (
                  <button key={def.id}
                    onClick={() => set('verticals', sel ? (data.verticals||[]).filter(v=>v!==def.id) : [...(data.verticals||[]), def.id])}
                    style={{ padding:'16px 14px', borderRadius:12, border:`2px solid ${sel?C.orange:C.border}`, background:sel?'#fff7ed':'#fff', cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                    <div style={{ fontSize:26, marginBottom:8 }}>{def.icon}</div>
                    <div style={{ fontWeight:600, fontSize:13, color:C.text }}>{def.label}</div>
                    <div style={{ fontSize:11, color:C.faint, marginTop:2 }}>{def.avgTicket}</div>
                    {sel && <div style={{ marginTop:6, fontSize:11, color:C.orange, fontWeight:600 }}>✓ Selected</div>}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop:12, fontSize:12, color:C.faint }}>You can add more verticals after creating the client.</div>
          </>
        )}
      </Card>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Btn variant='secondary' onClick={step===0 ? onCancel : ()=>setStep(s=>s-1)}>
          {step===0 ? 'Cancel' : '← Back'}
        </Btn>
        <div style={{ display:'flex', gap:10 }}>
          {!['name','vertical'].includes(currentStep.id) && (
            <Btn variant='ghost' onClick={skip}>Skip</Btn>
          )}
          <Btn onClick={next} disabled={!canAdvance() || loading}>
            {step===WIZARD_STEPS.length-1 ? 'Create client →' : 'Continue →'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PORTAL INVITE CARD
// ─────────────────────────────────────────────────────────────

function PortalInviteCard({ client, onUpdate }) {
  const [inviteEmail, setInviteEmail] = useState(client.portalEmail || client.email || '');
  const [sent, setSent]   = useState(false);
  const [copied, setCopied] = useState(false);

  const portalUrl = `${window.location.origin}${window.location.pathname}#portal`;

  const sendInvite = () => {
    if (!inviteEmail) return;
    authSetupPortal(client.id, inviteEmail);
    onUpdate();
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card style={{ padding:28 }}>
      <div style={{ fontWeight:600, fontSize:16, color:C.text, marginBottom:4 }}>Client portal access</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>
        Give this client access to their self-service portal — pricebook, brand settings, and leads.
      </div>

      {client.portalEnabled && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#166534', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>✓ Portal enabled · {client.portalEmail}</span>
          {client.portalLastLogin && <span style={{ fontSize:12, color:'#4ade80' }}>Last login: {new Date(client.portalLastLogin).toLocaleDateString()}</span>}
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden' }}>
          <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="client@contractor.com"
            style={{ flex:1, padding:'10px 12px', border:'none', outline:'none', fontSize:14, color:C.text, fontFamily:'inherit' }} />
        </div>
        <Btn onClick={sendInvite} disabled={!inviteEmail}>{sent ? '✓ Enabled!' : client.portalEnabled ? 'Update' : 'Enable portal'}</Btn>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#f8fafc', borderRadius:8, border:`1px solid ${C.border}` }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:C.faint, marginBottom:3, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Portal URL — send to client</div>
          <code style={{ fontSize:12, color:C.text }}>{portalUrl}</code>
        </div>
        <Btn small variant='ghost' onClick={copyLink}>{copied ? '✓ Copied' : 'Copy'}</Btn>
      </div>
    </Card>
  );
}


// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────

function Dashboard({ clients, onSelectClient, onNewClient }) {
  const live   = clients.filter(c=>c.status==='live').length;
  const setup  = clients.filter(c=>!['live','paused'].includes(c.status)).length;
  const totalLeads = clients.reduce((s,c)=>s+(c.stats?.totalLeads||0),0);

  return (
    <>
      <PageHeader title="All clients" subtitle={`${clients.length} total · ${live} live`} action={<Btn onClick={onNewClient}>+ Add client</Btn>} />
      <div style={{ padding:'24px 36px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          {[{label:'Total clients',value:clients.length,color:C.text},{label:'Live',value:live,color:C.green},{label:'Setting up',value:setup,color:C.amber},{label:'Total leads',value:totalLeads,color:C.blue}].map(s=>(
            <div key={s.label} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:12, color:C.muted, fontWeight:500, marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <Card>
          {clients.length===0 ? (
            <div style={{ padding:60, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🏗️</div>
              <div style={{ fontSize:16, fontWeight:600, color:C.text, marginBottom:6 }}>No clients yet</div>
              <div style={{ fontSize:14, color:C.faint, marginBottom:20 }}>Add your first client to get started</div>
              <Btn onClick={onNewClient}>+ Add first client</Btn>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:`1px solid #f1f5f9` }}>
                  {['Client','Verticals','Tracking','Leads','Status',''].map(h=>(
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:C.faint, textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map(client=>(
                  <tr key={client.id} onClick={()=>onSelectClient(client.id)} style={{ borderBottom:`1px solid #f8fafc`, cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {client.logoUrl
                          ? <img src={client.logoUrl} alt="" style={{ width:36, height:36, borderRadius:8, objectFit:'contain', border:`1px solid ${C.border}`, background:'#f8fafc' }} />
                          : <div style={{ width:36, height:36, borderRadius:8, background:client.brandColor||C.orange, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>{(client.name||'?').slice(0,1).toUpperCase()}</div>
                        }
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{client.name||'Unnamed'}</div>
                          <div style={{ fontSize:12, color:C.faint }}>{client.city}{client.state?`, ${client.state}`:''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {(client.verticals||[]).map(v=>(
                          <span key={v.verticalId} style={{ padding:'2px 8px', background:'#f1f5f9', borderRadius:20, fontSize:11, color:'#475569', fontWeight:500 }}>
                            {VERTICALS[v.verticalId]?.icon} {VERTICALS[v.verticalId]?.label}
                          </span>
                        ))}
                        {(!client.verticals||client.verticals.length===0)&&<span style={{ fontSize:12, color:'#cbd5e1' }}>None</span>}
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:12 }}>
                      {client.metaPixelId && <span style={{ color:C.green }}>● Meta</span>}
                      {client.gaMeasurementId && <span style={{ color:C.blue, marginLeft:6 }}>● GA</span>}
                      {!client.metaPixelId && !client.gaMeasurementId && <span style={{ color:C.faint }}>—</span>}
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:14, fontWeight:600, color:C.text }}>{(client.stats?.totalLeads||0).toLocaleString()}</td>
                    <td style={{ padding:'14px 16px' }}><StatusBadge status={client.status} /></td>
                    <td style={{ padding:'14px 16px', color:C.faint, fontSize:18 }}>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// GHL SETUP FORM
// ─────────────────────────────────────────────────────────────

function GHLSetupForm({ data, set, onSave, saving }) {
  return (
    <div>
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'14px 16px', marginBottom:24, fontSize:13, color:'#1e40af', lineHeight:1.6 }}>
        <strong>GHL Location ID:</strong> GHL → Settings → Business Profile → scroll to bottom.<br/>
        <strong>Webhook URL:</strong> GHL → Settings → Integrations → Webhooks → trigger URL.
      </div>
      <Field label="GHL Location ID"><Input value={data.ghlLocationId} onChange={v=>set('ghlLocationId',v)} placeholder="iRqFTUm8UyvpoVVqMRxp" /></Field>
      <Field label="Location name"><Input value={data.ghlLocationName} onChange={v=>set('ghlLocationName',v)} placeholder="Peak Roofing" /></Field>
      <Field label="Webhook URL"><Input value={data.ghlWebhookUrl} onChange={v=>set('ghlWebhookUrl',v)} placeholder="https://services.leadconnectorhq.com/hooks/.../webhook-trigger/" /></Field>
      <Field label="Calendar booking URL"><Input value={data.ghlCalendarUrl} onChange={v=>set('ghlCalendarUrl',v)} placeholder="https://api.leadconnectorhq.com/widget/booking/..." /></Field>
      <Field label="Private API key" hint="Optional — for automated provisioning"><Input value={data.ghlApiKey} onChange={v=>set('ghlApiKey',v)} type="password" placeholder="sk-..." /></Field>
      {onSave && <div style={{ marginTop:8 }}><Btn onClick={onSave} disabled={saving}>{saving?'Saving…':'Save GHL integration'}</Btn></div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PRICEBOOK EDITOR
// ─────────────────────────────────────────────────────────────

function PricebookEditor({ client, verticalInstance, onUpdate, onBack }) {
  const def = VERTICALS[verticalInstance.verticalId];
  const questions = def.pricebookQuestions;
  const [step, setStep] = useState(0);
  const [pb, setPb] = useState({ ...verticalInstance.pricebook });

  const q = questions[step];
  const isLast = step === questions.length - 1;
  const set = (k,v) => setPb(prev=>({...prev,[k]:v}));

  const applyRegionPreset = (key) => {
    if (key==='custom') return;
    const preset = REGION_PRESETS[key];
    if (preset) setPb(prev=>({...prev,...preset}));
  };

  const handleNext = () => {
    onUpdate(pb);
    if (isLast) { onBack(); return; }
    setStep(s=>s+1);
  };

  if (!q) return null;

  return (
    <div style={{ maxWidth:560, margin:'0 auto', padding:'32px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
        <div style={{ flex:1, height:4, background:C.border, borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${(step/questions.length)*100}%`, background:C.orange, borderRadius:2, transition:'width .4s' }} />
        </div>
        <span style={{ fontSize:12, color:C.faint, whiteSpace:'nowrap' }}>{step+1}/{questions.length}</span>
      </div>

      <div style={{ fontSize:12, fontWeight:600, color:C.orange, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>
        {def.label} pricebook · {client.name}
      </div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.text, margin:'0 0 10px', lineHeight:1.3 }}>{q.question}</h2>
      {q.hint && <p style={{ fontSize:14, color:C.muted, margin:'0 0 24px', lineHeight:1.6 }}>{q.hint}</p>}

      <Card style={{ padding:24, marginBottom:24 }}>
        {q.type==='choice' && (
          <div style={{ display:'grid', gap:10 }}>
            {q.options.map(opt=>{
              const val = pb[q.fieldKey||q.id];
              const sel = val===opt.value;
              return (
                <button key={opt.value} onClick={()=>{set(q.fieldKey||q.id,opt.value);if(q.id==='region')applyRegionPreset(opt.value);}}
                  style={{ padding:'16px 20px', borderRadius:12, cursor:'pointer', textAlign:'left', border:`2px solid ${sel?C.orange:C.border}`, background:sel?'#fff7ed':'#fff', transition:'all .15s' }}>
                  <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:opt.desc?3:0 }}>{opt.label}</div>
                  {opt.desc && <div style={{ fontSize:13, color:C.muted }}>{opt.desc}</div>}
                </button>
              );
            })}
          </div>
        )}
        {(q.type==='currency'||q.type==='percent'||q.type==='multiplier') && (
          <>
            <Input value={pb[q.fieldKey||q.id]} onChange={v=>set(q.fieldKey||q.id,parseFloat(v)||v)} placeholder={q.placeholder} prefix={q.prefix} suffix={q.suffix} type="number" />
            {q.marketRange && (
              <div style={{ marginTop:12, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#166534' }}>
                📊 {q.marketRange.label}
              </div>
            )}
            {q.type==='currency' && q.marketRange && (
              <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                {[q.marketRange.low, Math.round((q.marketRange.low+q.marketRange.high)/2), q.marketRange.high].map(v=>(
                  <button key={v} onClick={()=>set(q.fieldKey||q.id,v)}
                    style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${C.border}`, background:'#f8fafc', fontSize:12, cursor:'pointer', color:C.muted }}>
                    ${v}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <Btn variant='secondary' onClick={()=>step===0?onBack():setStep(s=>s-1)}>{step===0?'← Back':'← Prev'}</Btn>
        <Btn onClick={handleNext}>{isLast?'Save pricebook ✓':'Next →'}</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CLIENT DETAIL
// ─────────────────────────────────────────────────────────────

function ClientDetail({ clientId, clients, onUpdate, onBack }) {
  const [tab, setTab]           = useState('overview');
  const [editingPricebook, setEditingPricebook] = useState(null);
  const [ghlData, setGhlData]   = useState({});
  const [saving, setSaving]     = useState(false);

  const client = clients.find(c=>c.id===clientId);
  if (!client) return null;

  const setGHL = (k,v) => setGhlData(prev=>({...prev,[k]:v}));

  const saveGHL = () => {
    setSaving(true);
    updateGHL(clientId, {
      locationId:   ghlData.ghlLocationId   || client.ghl?.locationId,
      locationName: ghlData.ghlLocationName || client.ghl?.locationName,
      webhookUrl:   ghlData.ghlWebhookUrl   || client.ghl?.webhookUrl,
      calendarUrl:  ghlData.ghlCalendarUrl  || client.ghl?.calendarUrl,
      apiKey:       ghlData.ghlApiKey       || client.ghl?.apiKey,
    });
    onUpdate(); setSaving(false);
  };

  const startGHL = () => {
    setGhlData({ ghlLocationId:client.ghl?.locationId||'', ghlLocationName:client.ghl?.locationName||'', ghlWebhookUrl:client.ghl?.webhookUrl||'', ghlCalendarUrl:client.ghl?.calendarUrl||'', ghlApiKey:'' });
    setTab('ghl');
  };

  if (editingPricebook) {
    const vi = client.verticals.find(v=>v.verticalId===editingPricebook);
    return (
      <PricebookEditor
        client={client}
        verticalInstance={vi}
        onUpdate={pb=>{ updatePricebook(clientId,editingPricebook,pb); onUpdate(); }}
        onBack={()=>setEditingPricebook(null)}
      />
    );
  }

  const tabs = ['overview','verticals','leads','ghl','tracking','deploy'];

  // Build pricebook share URL (in production, host pricebook.html separately)
  const pbBaseUrl = window.location.origin + window.location.pathname;

  return (
    <>
      <div style={{ background:'#fff', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ padding:'20px 36px 0' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:C.faint, fontSize:13, cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', gap:4 }}>← All clients</button>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              {client.logoUrl
                ? <img src={client.logoUrl} alt="" style={{ width:48, height:48, borderRadius:10, objectFit:'contain', border:`1px solid ${C.border}`, background:'#f8fafc' }} />
                : <div style={{ width:48, height:48, borderRadius:10, background:client.brandColor||C.orange, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff' }}>{(client.name||'?').slice(0,1).toUpperCase()}</div>
              }
              <div>
                <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:C.text }}>{client.name}</h1>
                <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>{client.city}{client.state?`, ${client.state}`:''} · {client.slug}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <StatusBadge status={client.status} />
              <select value={client.status} onChange={e=>{updateClient(clientId,{status:e.target.value});onUpdate();}}
                style={{ padding:'6px 10px', borderRadius:8, border:`1px solid ${C.border}`, fontSize:12, color:C.text, cursor:'pointer' }}>
                {['draft','setup','ready','live','paused'].map(s=><option key={s} value={s}>{getStatusLabel(s)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:0 }}>
            {tabs.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ padding:'10px 20px', border:'none', borderBottom:`2px solid ${tab===t?C.orange:'transparent'}`, background:'none', fontSize:13, fontWeight:tab===t?600:400, color:tab===t?C.orange:C.muted, cursor:'pointer', textTransform:'capitalize' }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding:'28px 36px' }}>

        {/* ── OVERVIEW ── */}
        {tab==='overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <Card style={{ padding:24 }}>
              <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:16 }}>Business profile</div>
              {[['Phone',client.phone],['Email',client.email],['Website',client.domain],['Service area',client.serviceArea],['Brand color',<span style={{ display:'inline-flex',alignItems:'center',gap:8 }}><span style={{ width:14,height:14,borderRadius:3,background:client.brandColor,display:'inline-block',border:'1px solid rgba(0,0,0,0.1)' }} />{client.brandColor}</span>]].map(([k,v])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid #f8fafc`, fontSize:13 }}>
                  <span style={{ color:C.muted }}>{k}</span>
                  <span style={{ color:C.text, fontWeight:500 }}>{v||'—'}</span>
                </div>
              ))}
              {/* Brand colors */}
              {client.brandColors?.length>0 && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:12, color:C.faint, marginBottom:8 }}>Brand palette</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {client.brandColors.map((c,i)=>(
                      <div key={i} title={c.hex} style={{ width:28, height:28, borderRadius:6, background:c.hex, border:`1px solid ${C.border}` }} />
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card style={{ padding:24 }}>
              <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:16 }}>GHL integration</div>
              {client.ghl?.connected ? (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                    <span style={{ color:C.green, fontWeight:600, fontSize:13 }}>✓ Connected</span>
                    <span style={{ color:C.muted, fontSize:13 }}>{client.ghl.locationName||client.ghl.locationId}</span>
                  </div>
                  {[['Location ID',client.ghl.locationId],['Webhook',client.ghl.webhookUrl?'✓ Set':'Not set'],['Calendar',client.ghl.calendarUrl?'✓ Set':'Not set']].map(([k,v])=>(
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid #f8fafc`, fontSize:12 }}>
                      <span style={{ color:C.muted }}>{k}</span>
                      <span style={{ color:C.text, fontFamily:'monospace', fontSize:11 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:14 }}><Btn variant='secondary' small onClick={startGHL}>Edit GHL</Btn></div>
                </>
              ) : (
                <div style={{ textAlign:'center', padding:20 }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🔗</div>
                  <div style={{ fontSize:14, color:C.muted, marginBottom:16 }}>GHL not connected</div>
                  <Btn onClick={()=>setTab('ghl')}>Connect GHL →</Btn>
                </div>
              )}
            </Card>

            <Card style={{ padding:24, gridColumn:'1/-1' }}>
              <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:16 }}>Active verticals</div>
              {client.verticals?.length===0
                ? <div style={{ color:C.faint, fontSize:14 }}>No verticals yet — add them in the Verticals tab</div>
                : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                    {client.verticals.map(v=>{
                      const def=VERTICALS[v.verticalId];
                      return (
                        <div key={v.verticalId} style={{ padding:'14px 16px', border:`1px solid ${C.border}`, borderRadius:10 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                            <span style={{ fontSize:20 }}>{def?.icon}</span>
                            <StatusBadge status={v.status} />
                          </div>
                          <div style={{ fontWeight:600, fontSize:14, color:C.text }}>{def?.label}</div>
                          <div style={{ fontSize:12, color:C.faint, marginTop:2 }}>{def?.avgTicket}</div>
                          {v.pbCompletedAt && <div style={{ fontSize:11, color:C.green, marginTop:4 }}>✓ Pricebook complete</div>}
                        </div>
                      );
                    })}
                  </div>
              }
            </Card>
          </div>
        )}

        {/* ── VERTICALS ── */}
        {tab==='verticals' && (
          <div>
            <div style={{ marginBottom:20 }}>
              <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:600, color:C.text }}>Enabled verticals</h3>
              <p style={{ margin:0, fontSize:13, color:C.muted }}>Each vertical has its own pricebook and funnel page</p>
            </div>
            {client.verticals.map(v=>{
              const def=VERTICALS[v.verticalId];
              // Build pricebook share URL
              const pbUrl = `${pbBaseUrl}#pricebook:${v.pbToken}`;
              return (
                <Card key={v.verticalId} style={{ padding:20, marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:28 }}>{def?.icon}</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:15, color:C.text }}>{def?.label}</div>
                        <div style={{ fontSize:12, color:C.faint }}>{def?.description}</div>
                        {v.pbCompletedAt && <div style={{ fontSize:11, color:C.green, marginTop:2 }}>✓ Pricebook complete · {new Date(v.pbCompletedAt).toLocaleDateString()}</div>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
                      <StatusBadge status={v.status} />
                      <Btn small variant='secondary' onClick={()=>setEditingPricebook(v.verticalId)}>Edit pricebook</Btn>
                      <Btn small variant='secondary' onClick={()=>downloadXLSX(client,v)}>↓ Excel</Btn>
                      <Btn small variant='secondary' onClick={()=>setTab('deploy')}>Deploy</Btn>
                      <Btn small variant='danger' onClick={()=>{ if(confirm(`Remove ${def?.label}?`)){removeVertical(clientId,v.verticalId);onUpdate();} }}>Remove</Btn>
                    </div>
                  </div>
                  {/* Pricebook share URL */}
                  <div style={{ marginTop:16, padding:'10px 14px', background:'#f8fafc', borderRadius:8, border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:11, fontWeight:600, color:C.faint, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Pricebook link — send to client</div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <code style={{ flex:1, fontSize:12, color:C.text, wordBreak:'break-all' }}>{pbUrl}</code>
                      <Btn small variant='ghost' onClick={()=>navigator.clipboard.writeText(pbUrl)}>Copy</Btn>
                    </div>
                    <div style={{ fontSize:11, color:C.faint, marginTop:4 }}>Client fills out their pricebook one question at a time — no login needed</div>
                  </div>
                </Card>
              );
            })}
            <div style={{ marginTop:24 }}>
              <div style={{ fontWeight:600, fontSize:14, color:C.text, marginBottom:12 }}>Add a vertical</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
                {VERTICAL_LIST.map(def=>{
                  const already=client.verticals.find(v=>v.verticalId===def.id);
                  const soon=def.status==='coming_soon';
                  return (
                    <button key={def.id} disabled={!!already||soon} onClick={()=>{addVertical(clientId,def.id);onUpdate();}}
                      style={{ padding:'14px 16px', borderRadius:10, border:`1px solid ${C.border}`, background:already?'#f8fafc':'#fff', cursor:(already||soon)?'default':'pointer', textAlign:'left', opacity:soon?0.5:1 }}>
                      <div style={{ fontSize:22, marginBottom:6 }}>{def.icon}</div>
                      <div style={{ fontWeight:600, fontSize:13, color:C.text }}>{def.label}</div>
                      <div style={{ fontSize:11, color:C.faint, marginTop:2 }}>{already?'✓ Added':soon?'Coming soon':def.avgTicket}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── GHL ── */}
        {tab==='ghl' && (
          <div style={{ maxWidth:560 }}>
            <Card style={{ padding:28, marginBottom:20 }}>
              <div style={{ fontWeight:600, fontSize:16, color:C.text, marginBottom:4 }}>GoHighLevel integration</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:24 }}>Connect this client's GHL sub-account. All leads POST to their webhook.</div>
              <GHLSetupForm
                data={Object.keys(ghlData).length>0 ? ghlData : { ghlLocationId:client.ghl?.locationId, ghlLocationName:client.ghl?.locationName, ghlWebhookUrl:client.ghl?.webhookUrl, ghlCalendarUrl:client.ghl?.calendarUrl, ghlApiKey:'' }}
                set={(k,v)=>setGhlData(prev=>({...prev,[k]:v}))}
                onSave={saveGHL}
                saving={saving}
              />
            </Card>
            <PortalInviteCard client={client} onUpdate={onUpdate} />
          </div>
        )}

        {/* ── LEADS ── */}
        {tab==='leads' && (
          <LeadsTable clientId={client.id} clientSlug={client.slug} />
        )}

        {/* ── TRACKING ── */}
        {tab==='tracking' && (
          <div style={{ maxWidth:560 }}>
            <Card style={{ padding:28 }}>
              <div style={{ fontWeight:600, fontSize:16, color:C.text, marginBottom:4 }}>Tracking codes</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:24 }}>These are baked into every generated funnel HTML for this client.</div>
              <Field label="Meta Pixel ID" hint="From Meta Events Manager">
                <Input value={client.metaPixelId} onChange={v=>{ updateClient(clientId,{metaPixelId:v}); onUpdate(); }} placeholder="1234567890" />
              </Field>
              <Field label="GA Measurement ID" hint="From Google Analytics — starts with G-">
                <Input value={client.gaMeasurementId} onChange={v=>{ updateClient(clientId,{gaMeasurementId:v}); onUpdate(); }} placeholder="G-XXXXXXXXXX" />
              </Field>
              <div style={{ padding:'12px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, fontSize:13, color:'#166534' }}>
                ✓ These codes will be included in the &lt;head&gt; of the generated funnel HTML. Regenerate the funnel after updating.
              </div>
            </Card>
          </div>
        )}

        {/* ── DEPLOY ── */}
        {tab==='deploy' && (
          <div>
            <div style={{ marginBottom:20 }}>
              <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:600, color:C.text }}>Deploy</h3>
              <p style={{ margin:0, fontSize:13, color:C.muted }}>One HTML file per vertical — paste into GHL Custom HTML block</p>
            </div>
            {!client.ghl?.webhookUrl && (
              <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#c2410c', marginBottom:20 }}>
                ⚠️ GHL webhook not set — leads won't be captured. Set it in the GHL tab first.
              </div>
            )}
            {client.verticals.length===0
              ? <div style={{ color:C.faint, fontSize:14 }}>Add at least one vertical first</div>
              : client.verticals.map(v=>{
                  const def=VERTICALS[v.verticalId];
                  const html=generateFunnelHTML(client,v);
                  const snippet=generateWorkerSnippet(client,v);
                  return (
                    <Card key={v.verticalId} style={{ marginBottom:20 }}>
                      <div style={{ padding:'16px 20px', borderBottom:`1px solid #f1f5f9`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontSize:20 }}>{def?.icon}</span>
                          <span style={{ fontWeight:600, fontSize:15, color:C.text }}>{def?.label}</span>
                          <StatusBadge status={v.status} />
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <Btn small variant='secondary' onClick={()=>downloadXLSX(client,v)}>↓ Pricebook Excel</Btn>
                          <Btn small variant='green' onClick={()=>{ updateVertical(clientId,v.verticalId,{status:'live',launchedAt:new Date().toISOString()}); onUpdate(); }}>Mark live</Btn>
                        </div>
                      </div>
                      <div style={{ padding:20 }}>
                        {/* Tracking status */}
                        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
                          <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:client.metaPixelId?'#d1fae5':'#f3f4f6', color:client.metaPixelId?'#065f46':'#6b7280', fontWeight:500 }}>
                            {client.metaPixelId?'✓ Meta Pixel':'⚠ No Meta Pixel'}
                          </span>
                          <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:client.gaMeasurementId?'#dbeafe':'#f3f4f6', color:client.gaMeasurementId?'#1e40af':'#6b7280', fontWeight:500 }}>
                            {client.gaMeasurementId?'✓ GA4':'⚠ No GA4'}
                          </span>
                          <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:v.pbCompletedAt?'#d1fae5':'#fef3c7', color:v.pbCompletedAt?'#065f46':'#92400e', fontWeight:500 }}>
                            {v.pbCompletedAt?'✓ Pricebook set':'⚠ Pricebook pending'}
                          </span>
                        </div>
                        <div style={{ marginBottom:16 }}>
                          <CodeBlock label={`${def?.label} funnel — paste into GHL Custom HTML block`} code={html} />
                        </div>
                        <CodeBlock label="Worker snippet (add to Cloudflare Worker)" code={snippet} />
                      </div>
                    </Card>
                  );
                })
            }
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────

export default function App() {
  const [clients, setClients] = useState([]);
  const [screen, setScreen]   = useState('dashboard');
  const [activeId, setActiveId] = useState(null);

  const refresh = useCallback(()=>setClients(getClients()),[]);

  useEffect(()=>{ seedDemoData(); refresh(); },[]);

  const nav = (
    <>
      <NavItem icon="⊞" label="Dashboard" active={screen==='dashboard'} onClick={()=>setScreen('dashboard')} count={clients.length} />
      <NavItem icon="📋" label="All leads" active={screen==='leads'} onClick={()=>setScreen('leads')} />
      <NavItem icon="+" label="New client" active={screen==='new'} onClick={()=>setScreen('new')} />
      <div style={{ margin:'16px 0 8px', fontSize:10, fontWeight:600, color:'#334155', letterSpacing:'1px', textTransform:'uppercase', paddingLeft:12 }}>Verticals</div>
      {VERTICAL_LIST.filter(v=>v.status==='live').map(v=>(
        <NavItem key={v.id} icon={v.icon} label={v.label} active={false}
          count={clients.filter(c=>c.verticals?.find(vv=>vv.verticalId===v.id)).length||null}
          onClick={()=>{}} />
      ))}
    </>
  );

  return (
    <Shell nav={nav}>
      {screen==='dashboard' && (
        <Dashboard
          clients={clients}
          onSelectClient={id=>{setActiveId(id);setScreen('client');}}
          onNewClient={()=>setScreen('new')}
        />
      )}
      {screen==='leads' && (
        <div>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'32px 36px 24px', borderBottom:'1px solid #e2e8f0', background:'#fff' }}>
            <div>
              <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#0f172a' }}>All leads</h1>
              <p style={{ margin:'4px 0 0', fontSize:14, color:'#64748b' }}>Every lead across all clients and verticals</p>
            </div>
          </div>
          <div style={{ padding:'24px 36px' }}>
            <LeadsTable showClient={true} />
          </div>
        </div>
      )}
      {screen==='new' && (
        <NewClientWizard
          onSave={data=>{
            const c=createClient(data);
            if(data.ghlLocationId){updateGHL(c.id,{locationId:data.ghlLocationId,locationName:data.ghlLocationName,webhookUrl:data.ghlWebhookUrl,calendarUrl:data.ghlCalendarUrl});}
            (data.verticals||[]).forEach(vid=>addVertical(c.id,vid));
            refresh();
            setActiveId(c.id);
            setScreen('client');
          }}
          onCancel={()=>setScreen('dashboard')}
        />
      )}
      {screen==='client' && activeId && (
        <ClientDetail
          clientId={activeId}
          clients={clients}
          onUpdate={refresh}
          onBack={()=>setScreen('dashboard')}
        />
      )}
    </Shell>
  );
}
