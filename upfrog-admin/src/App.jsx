import { useState, useEffect, useCallback } from 'react';
import {
  getClients, createClient, updateClient, deleteClient,
  addVertical, removeVertical, updateVertical, updatePricebook,
  updateGHL, getStatusLabel, getStatusColor, slugify, seedDemoData,
} from './lib/store';
import { VERTICALS, VERTICAL_LIST, REGION_PRESETS } from './data/verticals';
import { generateFunnelHTML, generateWorkerSnippet } from './lib/generateHTML';

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  // Status badge colors
  statusBg:    { live:'#d1fae5', ready:'#dbeafe', setup:'#fef3c7', draft:'#f3f4f6', paused:'#fee2e2' },
  statusText:  { live:'#065f46', ready:'#1e40af', setup:'#92400e', draft:'#374151', paused:'#991b1b' },
};

function StatusBadge({ status }) {
  const label = getStatusLabel(status);
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
      background: T.statusBg[status] || '#f3f4f6',
      color:      T.statusText[status] || '#374151',
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor', display:'inline-block' }} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// LAYOUT SHELL
// ─────────────────────────────────────────────────────────────
function Shell({ children, nav }) {
  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Inter,system-ui,sans-serif', background:'#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{ width:220, background:'#0f172a', display:'flex', flexDirection:'column', flexShrink:0 }}>
        {/* Logo */}
        <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontWeight:800, fontSize:20, color:'#f97316', letterSpacing:'-0.5px' }}>
            Up<span style={{ color:'#fff' }}>frog</span>
          </div>
          <div style={{ fontSize:10, color:'#64748b', marginTop:2, fontWeight:500, letterSpacing:'1px', textTransform:'uppercase' }}>Agency Admin</div>
        </div>
        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 12px' }}>
          {nav}
        </nav>
        {/* Footer */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:11, color:'#475569' }}>
          Worker: upfrog-proxy.shiny&#8209;poetry&#8209;341c
        </div>
      </aside>
      {/* Main */}
      <main style={{ flex:1, overflow:'auto' }}>
        {children}
      </main>
    </div>
  );
}

function NavItem({ label, icon, active, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, width:'100%',
      padding:'9px 12px', borderRadius:8, border:'none', cursor:'pointer',
      background: active ? 'rgba(249,115,22,0.15)' : 'transparent',
      color: active ? '#f97316' : '#94a3b8',
      fontSize:13, fontWeight: active ? 600 : 400,
      textAlign:'left', marginBottom:2,
      transition:'all 0.15s',
    }}>
      <span style={{ fontSize:15 }}>{icon}</span>
      <span style={{ flex:1 }}>{label}</span>
      {count != null && (
        <span style={{ fontSize:10, background:'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:10, color:'#94a3b8' }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE HEADER
// ─────────────────────────────────────────────────────────────
function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'32px 36px 24px', borderBottom:'1px solid #e2e8f0', background:'#fff' }}>
      <div>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#0f172a' }}>{title}</h1>
        {subtitle && <p style={{ margin:'4px 0 0', fontSize:14, color:'#64748b' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Btn({ children, onClick, variant='primary', small, disabled }) {
  const styles = {
    primary:   { background:'#f97316', color:'#fff', border:'none' },
    secondary: { background:'transparent', color:'#374151', border:'1px solid #d1d5db' },
    danger:    { background:'transparent', color:'#dc2626', border:'1px solid #fecaca' },
    ghost:     { background:'transparent', color:'#6b7280', border:'none' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      padding: small ? '6px 14px' : '9px 18px',
      borderRadius:8, fontSize: small ? 12 : 13, fontWeight:600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      display:'inline-flex', alignItems:'center', gap:6,
      transition:'opacity 0.15s',
      whiteSpace:'nowrap',
    }}>
      {children}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, ...style }}>
      {children}
    </div>
  );
}

function Field({ label, hint, children, required }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>
        {label}{required && <span style={{ color:'#ef4444', marginLeft:2 }}>*</span>}
      </label>
      {hint && <p style={{ fontSize:11, color:'#94a3b8', margin:'0 0 8px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type='text', prefix, suffix }) {
  return (
    <div style={{ display:'flex', alignItems:'center', border:'1px solid #d1d5db', borderRadius:8, overflow:'hidden', background:'#fff' }}>
      {prefix && <span style={{ padding:'0 12px', background:'#f8fafc', color:'#6b7280', fontSize:13, borderRight:'1px solid #d1d5db', alignSelf:'stretch', display:'flex', alignItems:'center' }}>{prefix}</span>}
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex:1, padding:'10px 12px', border:'none', outline:'none', fontSize:14, color:'#0f172a', background:'transparent' }}
      />
      {suffix && <span style={{ padding:'0 12px', background:'#f8fafc', color:'#6b7280', fontSize:13, borderLeft:'1px solid #d1d5db', alignSelf:'stretch', display:'flex', alignItems:'center' }}>{suffix}</span>}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} style={{
      width:'100%', padding:'10px 12px', border:'1px solid #d1d5db',
      borderRadius:8, fontSize:14, color:'#0f172a', background:'#fff', outline:'none',
    }}>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Textarea({ value, onChange, placeholder, rows=3 }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, color:'#0f172a', resize:'vertical', outline:'none', boxSizing:'border-box' }}
    />
  );
}

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden' }}>
      {label && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
          <Btn onClick={copy} variant='ghost' small>{copied ? '✓ Copied' : 'Copy'}</Btn>
        </div>
      )}
      <pre style={{ margin:0, padding:'14px', fontSize:12, color:'#1e293b', background:'#f8fafc', overflowX:'auto', lineHeight:1.6, maxHeight:320, overflow:'auto' }}>
        {code}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GLOBAL DASHBOARD
// ─────────────────────────────────────────────────────────────
function Dashboard({ clients, onSelectClient, onNewClient }) {
  const live    = clients.filter(c => c.status === 'live').length;
  const setup   = clients.filter(c => c.status !== 'live' && c.status !== 'paused').length;
  const paused  = clients.filter(c => c.status === 'paused').length;
  const totalLeads = clients.reduce((s, c) => s + (c.stats?.totalLeads || 0), 0);

  return (
    <>
      <PageHeader
        title="All clients"
        subtitle={`${clients.length} total · ${live} live`}
        action={<Btn onClick={onNewClient}>+ Add client</Btn>}
      />

      <div style={{ padding:'24px 36px' }}>
        {/* Summary stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          {[
            { label:'Total clients', value:clients.length, color:'#0f172a' },
            { label:'Live',          value:live,            color:'#059669' },
            { label:'Setting up',    value:setup,           color:'#d97706' },
            { label:'Total leads',   value:totalLeads,      color:'#2563eb' },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:500, marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Client table */}
        <Card>
          {clients.length === 0 ? (
            <div style={{ padding:60, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🏗️</div>
              <div style={{ fontSize:16, fontWeight:600, color:'#374151', marginBottom:6 }}>No clients yet</div>
              <div style={{ fontSize:14, color:'#94a3b8', marginBottom:20 }}>Add your first client to get started</div>
              <Btn onClick={onNewClient}>+ Add first client</Btn>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #f1f5f9' }}>
                  {['Client', 'Verticals', 'GHL', 'Leads', 'Status', ''].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id}
                    onClick={() => onSelectClient(client.id)}
                    style={{ borderBottom:'1px solid #f8fafc', cursor:'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:8, background:client.brandColor || '#f97316', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
                          {(client.name || '?').slice(0,1).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>{client.name || 'Unnamed'}</div>
                          <div style={{ fontSize:12, color:'#94a3b8' }}>{client.city}{client.state ? `, ${client.state}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {(client.verticals || []).map(v => (
                          <span key={v.verticalId} style={{ padding:'2px 8px', background:'#f1f5f9', borderRadius:20, fontSize:11, color:'#475569', fontWeight:500 }}>
                            {VERTICALS[v.verticalId]?.icon} {VERTICALS[v.verticalId]?.label}
                          </span>
                        ))}
                        {(!client.verticals || client.verticals.length === 0) && (
                          <span style={{ fontSize:12, color:'#cbd5e1' }}>None added</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      {client.ghl?.connected
                        ? <span style={{ color:'#059669', fontSize:12, fontWeight:600 }}>✓ Connected</span>
                        : <span style={{ color:'#94a3b8', fontSize:12 }}>Not set</span>
                      }
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:14, fontWeight:600, color:'#374151' }}>
                      {(client.stats?.totalLeads || 0).toLocaleString()}
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <StatusBadge status={client.status} />
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ color:'#94a3b8', fontSize:18 }}>›</span>
                    </td>
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
// NEW CLIENT WIZARD
// ─────────────────────────────────────────────────────────────
function NewClientWizard({ onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name:'', phone:'', email:'', brandColor:'#c0572a',
    logoUrl:'', domain:'', city:'', state:'', notes:'',
  });

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const steps = [
    {
      title: 'Business profile',
      subtitle: 'Basic info about the contractor',
      content: (
        <div>
          <Field label="Company name" required>
            <Input value={data.name} onChange={v => { set('name', v); set('slug', slugify(v)); }} placeholder="Peak Roofing Maryland" />
          </Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <Field label="Phone">
              <Input value={data.phone} onChange={v => set('phone', v)} placeholder="(772) 555-0100" />
            </Field>
            <Field label="Email">
              <Input value={data.email} onChange={v => set('email', v)} placeholder="info@contractor.com" type="email" />
            </Field>
            <Field label="City">
              <Input value={data.city} onChange={v => set('city', v)} placeholder="Leonardtown" />
            </Field>
            <Field label="State">
              <Input value={data.state} onChange={v => set('state', v)} placeholder="MD" />
            </Field>
          </div>
          <Field label="Brand color" hint="Primary color for their funnel page">
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <input type="color" value={data.brandColor} onChange={e => set('brandColor', e.target.value)}
                style={{ width:44, height:36, border:'1px solid #d1d5db', borderRadius:8, cursor:'pointer', padding:2 }} />
              <Input value={data.brandColor} onChange={v => set('brandColor', v)} placeholder="#c0572a" />
            </div>
          </Field>
          <Field label="Logo URL" hint="Direct image URL — shown in funnel header">
            <Input value={data.logoUrl} onChange={v => set('logoUrl', v)} placeholder="https://..." />
          </Field>
          <Field label="Website / domain">
            <Input value={data.domain} onChange={v => set('domain', v)} placeholder="peakroofing.com" />
          </Field>
          <Field label="Internal notes">
            <Textarea value={data.notes} onChange={v => set('notes', v)} placeholder="Any notes about this account..." />
          </Field>
        </div>
      ),
    },
    {
      title: 'GHL integration',
      subtitle: 'Connect their GoHighLevel location',
      content: <GHLSetupForm data={data} set={set} />,
    },
    {
      title: 'Review',
      subtitle: 'Confirm and create the client',
      content: (
        <div>
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, paddingBottom:16, borderBottom:'1px solid #e2e8f0' }}>
              <div style={{ width:44, height:44, borderRadius:10, background:data.brandColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff' }}>
                {(data.name || '?').slice(0,1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:'#0f172a' }}>{data.name || 'Unnamed'}</div>
                <div style={{ fontSize:13, color:'#64748b' }}>{data.city}{data.state ? `, ${data.state}` : ''}</div>
              </div>
            </div>
            {[
              ['Phone', data.phone],
              ['Email', data.email],
              ['GHL Location', data.ghlLocationId || 'Not set'],
              ['Webhook', data.ghlWebhookUrl ? '✓ Set' : 'Not set'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:13, borderBottom:'1px solid #f1f5f9' }}>
                <span style={{ color:'#64748b' }}>{k}</span>
                <span style={{ color:'#0f172a', fontWeight:500 }}>{v || '—'}</span>
              </div>
            ))}
          </div>
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#92400e' }}>
            You can add verticals and configure pricebooks after creating the client.
          </div>
        </div>
      ),
    },
  ];

  const canNext = step === 0 ? !!data.name : true;

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'32px 24px' }}>
      {/* Step indicators */}
      <div style={{ display:'flex', gap:8, marginBottom:32 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i <= step ? '#f97316' : '#e2e8f0', transition:'background 0.3s' }} />
        ))}
      </div>

      <div style={{ marginBottom:8, fontSize:12, fontWeight:600, color:'#f97316', textTransform:'uppercase', letterSpacing:'1px' }}>
        Step {step + 1} of {steps.length}
      </div>
      <h2 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, color:'#0f172a' }}>{steps[step].title}</h2>
      <p style={{ margin:'0 0 28px', fontSize:14, color:'#64748b' }}>{steps[step].subtitle}</p>

      <Card style={{ padding:'28px' }}>
        {steps[step].content}
      </Card>

      <div style={{ display:'flex', justifyContent:'space-between', marginTop:20 }}>
        <Btn variant='secondary' onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>
          {step === 0 ? 'Cancel' : '← Back'}
        </Btn>
        {step < steps.length - 1 ? (
          <Btn onClick={() => setStep(s => s + 1)} disabled={!canNext}>
            Continue →
          </Btn>
        ) : (
          <Btn onClick={() => onSave(data)}>
            Create client →
          </Btn>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GHL SETUP FORM (reused in wizard and client detail)
// ─────────────────────────────────────────────────────────────
function GHLSetupForm({ data, set, onSave, saving }) {
  return (
    <div>
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'14px 16px', marginBottom:24, fontSize:13, color:'#1e40af', lineHeight:1.6 }}>
        <strong>How to find your GHL Location ID:</strong><br />
        GHL → Settings → Business Profile → scroll to bottom → copy the Location ID string.
        <br /><br />
        <strong>Webhook URL:</strong> GHL → Settings → Integrations → Webhooks → copy the trigger URL for your location.
      </div>

      <Field label="GHL Location ID" hint="The unique ID for this contractor's GHL sub-account">
        <Input value={data.ghlLocationId} onChange={v => set('ghlLocationId', v)} placeholder="iRqFTUm8UyvpoVVqMRxp" />
      </Field>
      <Field label="Location name" hint="Just for your reference">
        <Input value={data.ghlLocationName} onChange={v => set('ghlLocationName', v)} placeholder="Peak Roofing" />
      </Field>
      <Field label="Webhook URL" hint="Where leads are POSTed when a homeowner submits the form">
        <Input value={data.ghlWebhookUrl} onChange={v => set('ghlWebhookUrl', v)}
          placeholder="https://services.leadconnectorhq.com/hooks/LOCATION_ID/webhook-trigger/" />
      </Field>
      <Field label="Calendar booking URL" hint="Embedded in the results page for booking inspections">
        <Input value={data.ghlCalendarUrl} onChange={v => set('ghlCalendarUrl', v)}
          placeholder="https://api.leadconnectorhq.com/widget/booking/YOUR_CALENDAR_ID" />
      </Field>
      <Field label="Private API key" hint="Optional — for future automated provisioning. GHL → Settings → Private Integrations">
        <Input value={data.ghlApiKey} onChange={v => set('ghlApiKey', v)} type="password" placeholder="sk-..." />
      </Field>

      {onSave && (
        <div style={{ marginTop:8 }}>
          <Btn onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save GHL integration'}
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PRICEBOOK EDITOR — one question at a time
// ─────────────────────────────────────────────────────────────
function PricebookEditor({ client, verticalInstance, onUpdate, onBack }) {
  const vertDef = VERTICALS[verticalInstance.verticalId];
  const questions = vertDef.pricebookQuestions;
  const [step, setStep] = useState(0);
  const [pb, setPb] = useState({ ...verticalInstance.pricebook });

  const q = questions[step];
  const isLast = step === questions.length - 1;

  const set = (k, v) => setPb(prev => ({ ...prev, [k]: v }));

  const handleNext = () => {
    onUpdate(pb);
    if (isLast) { onBack(); return; }
    setStep(s => s + 1);
  };

  // Region preset loads all defaults
  const applyRegionPreset = (regionKey) => {
    if (regionKey === 'custom') return;
    const preset = REGION_PRESETS[regionKey];
    if (preset) setPb(prev => ({ ...prev, ...preset }));
  };

  if (!q) return null;

  const progress = ((step) / questions.length) * 100;

  return (
    <div style={{ maxWidth:560, margin:'0 auto', padding:'32px 24px' }}>
      {/* Progress */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
        <div style={{ flex:1, height:4, background:'#e2e8f0', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progress}%`, background:'#f97316', borderRadius:2, transition:'width 0.4s' }} />
        </div>
        <span style={{ fontSize:12, color:'#94a3b8', whiteSpace:'nowrap' }}>{step + 1} / {questions.length}</span>
      </div>

      <h2 style={{ fontSize:22, fontWeight:700, color:'#0f172a', margin:'0 0 10px', lineHeight:1.3 }}>
        {q.question}
      </h2>
      {q.hint && <p style={{ fontSize:14, color:'#64748b', margin:'0 0 24px', lineHeight:1.6 }}>{q.hint}</p>}

      {/* Question types */}
      {q.type === 'choice' && (
        <div style={{ display:'grid', gap:10, marginBottom:24 }}>
          {q.options.map(opt => {
            const val = q.fieldKey ? pb[q.fieldKey] : pb[q.id];
            const selected = val === opt.value;
            return (
              <button key={opt.value}
                onClick={() => {
                  const update = { [q.fieldKey || q.id]: opt.value };
                  setPb(prev => ({ ...prev, ...update }));
                  if (q.id === 'region') applyRegionPreset(opt.value);
                }}
                style={{
                  padding:'16px 20px', borderRadius:12, cursor:'pointer', textAlign:'left',
                  border: selected ? '2px solid #f97316' : '2px solid #e2e8f0',
                  background: selected ? '#fff7ed' : '#fff',
                  transition:'all 0.15s',
                }}
              >
                <div style={{ fontWeight:600, fontSize:15, color:'#0f172a', marginBottom: opt.desc ? 3 : 0 }}>{opt.label}</div>
                {opt.desc && <div style={{ fontSize:13, color:'#64748b' }}>{opt.desc}</div>}
              </button>
            );
          })}
        </div>
      )}

      {(q.type === 'currency' || q.type === 'percent' || q.type === 'multiplier') && (
        <div style={{ marginBottom:24 }}>
          <div style={{ marginBottom:16 }}>
            <Input
              value={pb[q.fieldKey || q.id]}
              onChange={v => set(q.fieldKey || q.id, parseFloat(v) || v)}
              placeholder={q.placeholder}
              prefix={q.prefix}
              suffix={q.suffix}
              type="number"
            />
          </div>
          {q.marketRange && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#166534' }}>
              📊 {q.marketRange.label}
            </div>
          )}
          {/* Quick presets for common values */}
          {q.type === 'currency' && q.marketRange && (
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              {[q.marketRange.low, Math.round((q.marketRange.low + q.marketRange.high) / 2), q.marketRange.high].map(v => (
                <button key={v}
                  onClick={() => set(q.fieldKey || q.id, v)}
                  style={{ padding:'5px 12px', borderRadius:20, border:'1px solid #e2e8f0', background:'#f8fafc', fontSize:12, cursor:'pointer', color:'#475569' }}>
                  ${v}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Btn variant='secondary' onClick={() => step === 0 ? onBack() : setStep(s => s - 1)}>
          {step === 0 ? '← Back' : '← Prev'}
        </Btn>
        <Btn onClick={handleNext}>
          {isLast ? 'Save pricebook ✓' : 'Next →'}
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CLIENT DETAIL — full client management screen
// ─────────────────────────────────────────────────────────────
function ClientDetail({ clientId, clients, onUpdate, onBack }) {
  const [tab, setTab]             = useState('overview');
  const [editingPricebook, setEditingPricebook] = useState(null); // verticalId
  const [editingGHL, setEditingGHL]             = useState(false);
  const [ghlData, setGhlData]     = useState({});
  const [saving, setSaving]       = useState(false);

  const client = clients.find(c => c.id === clientId);
  if (!client) return null;

  const setGHL = (k, v) => setGhlData(prev => ({ ...prev, [k]: v }));

  const saveGHL = () => {
    setSaving(true);
    const updated = updateGHL(clientId, {
      locationId:   ghlData.ghlLocationId || client.ghl?.locationId,
      locationName: ghlData.ghlLocationName || client.ghl?.locationName,
      webhookUrl:   ghlData.ghlWebhookUrl || client.ghl?.webhookUrl,
      calendarUrl:  ghlData.ghlCalendarUrl || client.ghl?.calendarUrl,
      apiKey:       ghlData.ghlApiKey || client.ghl?.apiKey,
    });
    onUpdate();
    setSaving(false);
    setEditingGHL(false);
  };

  // Init GHL form from existing data
  const startEditGHL = () => {
    setGhlData({
      ghlLocationId:   client.ghl?.locationId || '',
      ghlLocationName: client.ghl?.locationName || '',
      ghlWebhookUrl:   client.ghl?.webhookUrl || '',
      ghlCalendarUrl:  client.ghl?.calendarUrl || '',
      ghlApiKey:       client.ghl?.apiKey || '',
    });
    setEditingGHL(true);
  };

  // If editing pricebook, show that UI instead
  if (editingPricebook) {
    const vInstance = client.verticals.find(v => v.verticalId === editingPricebook);
    return (
      <PricebookEditor
        client={client}
        verticalInstance={vInstance}
        onUpdate={(pb) => {
          updatePricebook(clientId, editingPricebook, pb);
          onUpdate();
        }}
        onBack={() => setEditingPricebook(null)}
      />
    );
  }

  const tabs = ['overview', 'verticals', 'ghl', 'deploy'];

  return (
    <>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0' }}>
        <div style={{ padding:'20px 36px 0' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'#94a3b8', fontSize:13, cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', gap:4 }}>
            ← All clients
          </button>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:48, height:48, borderRadius:10, background:client.brandColor || '#f97316', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff' }}>
                {(client.name || '?').slice(0,1).toUpperCase()}
              </div>
              <div>
                <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:'#0f172a' }}>{client.name}</h1>
                <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>
                  {client.city}{client.state ? `, ${client.state}` : ''} · slug: {client.slug}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <StatusBadge status={client.status} />
              <select
                value={client.status}
                onChange={e => { updateClient(clientId, { status: e.target.value }); onUpdate(); }}
                style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #d1d5db', fontSize:12, color:'#374151', cursor:'pointer' }}
              >
                {['draft','setup','ready','live','paused'].map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
              </select>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:0 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:'10px 20px', border:'none', borderBottom: tab===t ? '2px solid #f97316' : '2px solid transparent',
                background:'none', fontSize:13, fontWeight: tab===t ? 600 : 400,
                color: tab===t ? '#f97316' : '#64748b', cursor:'pointer', textTransform:'capitalize',
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding:'28px 36px' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <Card style={{ padding:24 }}>
              <div style={{ fontWeight:600, fontSize:15, color:'#0f172a', marginBottom:16 }}>Business profile</div>
              {[
                ['Phone', client.phone],
                ['Email', client.email],
                ['Website', client.domain],
                ['Brand color', <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}><span style={{ width:14, height:14, borderRadius:3, background:client.brandColor, display:'inline-block', border:'1px solid rgba(0,0,0,0.1)' }} />{client.brandColor}</span>],
              ].map(([k, v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f8fafc', fontSize:13 }}>
                  <span style={{ color:'#64748b' }}>{k}</span>
                  <span style={{ color:'#0f172a', fontWeight:500 }}>{v || '—'}</span>
                </div>
              ))}
              {client.notes && (
                <div style={{ marginTop:14, padding:12, background:'#f8fafc', borderRadius:8, fontSize:13, color:'#475569' }}>
                  {client.notes}
                </div>
              )}
            </Card>

            <Card style={{ padding:24 }}>
              <div style={{ fontWeight:600, fontSize:15, color:'#0f172a', marginBottom:16 }}>GHL integration</div>
              {client.ghl?.connected ? (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                    <span style={{ color:'#059669', fontWeight:600, fontSize:13 }}>✓ Connected</span>
                    <span style={{ color:'#64748b', fontSize:13 }}>{client.ghl.locationName || client.ghl.locationId}</span>
                  </div>
                  {[
                    ['Location ID', client.ghl.locationId],
                    ['Webhook', client.ghl.webhookUrl ? '✓ Set' : 'Not set'],
                    ['Calendar', client.ghl.calendarUrl ? '✓ Set' : 'Not set'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f8fafc', fontSize:12 }}>
                      <span style={{ color:'#64748b' }}>{k}</span>
                      <span style={{ color:'#374151', fontFamily:'monospace', fontSize:11 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:14 }}>
                    <Btn variant='secondary' small onClick={startEditGHL}>Edit GHL settings</Btn>
                  </div>
                </>
              ) : (
                <div style={{ textAlign:'center', padding:20 }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🔗</div>
                  <div style={{ fontSize:14, color:'#64748b', marginBottom:16 }}>GHL not connected yet</div>
                  <Btn onClick={() => setTab('ghl')}>Connect GHL →</Btn>
                </div>
              )}
            </Card>

            <Card style={{ padding:24, gridColumn:'1/-1' }}>
              <div style={{ fontWeight:600, fontSize:15, color:'#0f172a', marginBottom:16 }}>Active verticals</div>
              {client.verticals?.length === 0 ? (
                <div style={{ color:'#94a3b8', fontSize:14 }}>No verticals yet — add them in the Verticals tab</div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                  {client.verticals.map(v => {
                    const def = VERTICALS[v.verticalId];
                    return (
                      <div key={v.verticalId} style={{ padding:'14px 16px', border:'1px solid #e2e8f0', borderRadius:10 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                          <span style={{ fontSize:20 }}>{def?.icon}</span>
                          <StatusBadge status={v.status} />
                        </div>
                        <div style={{ fontWeight:600, fontSize:14, color:'#0f172a' }}>{def?.label}</div>
                        <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Avg: {def?.avgTicket}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── VERTICALS ── */}
        {tab === 'verticals' && (
          <div>
            <div style={{ marginBottom:20 }}>
              <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:600, color:'#0f172a' }}>Enabled verticals</h3>
              <p style={{ margin:0, fontSize:13, color:'#64748b' }}>Each vertical gets its own pricebook and funnel page</p>
            </div>

            {/* Live verticals for this client */}
            {client.verticals.map(v => {
              const def = VERTICALS[v.verticalId];
              return (
                <Card key={v.verticalId} style={{ padding:20, marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:28 }}>{def?.icon}</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:15, color:'#0f172a' }}>{def?.label}</div>
                        <div style={{ fontSize:12, color:'#94a3b8' }}>{def?.description}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <StatusBadge status={v.status} />
                      <Btn small variant='secondary' onClick={() => setEditingPricebook(v.verticalId)}>
                        Edit pricebook
                      </Btn>
                      <Btn small variant='secondary' onClick={() => { setTab('deploy'); }}>
                        Deploy
                      </Btn>
                      <Btn small variant='danger' onClick={() => {
                        if (confirm(`Remove ${def?.label} from this client?`)) {
                          removeVertical(clientId, v.verticalId);
                          onUpdate();
                        }
                      }}>
                        Remove
                      </Btn>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Add new vertical */}
            <div style={{ marginTop:24 }}>
              <div style={{ fontWeight:600, fontSize:14, color:'#374151', marginBottom:12 }}>Add a vertical</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
                {VERTICAL_LIST.map(def => {
                  const already = client.verticals.find(v => v.verticalId === def.id);
                  const comingSoon = def.status === 'coming_soon';
                  return (
                    <button key={def.id}
                      disabled={!!already || comingSoon}
                      onClick={() => { addVertical(clientId, def.id); onUpdate(); }}
                      style={{
                        padding:'14px 16px', borderRadius:10, border:'1px solid #e2e8f0',
                        background: already ? '#f8fafc' : '#fff',
                        cursor: (already || comingSoon) ? 'default' : 'pointer',
                        textAlign:'left', opacity: comingSoon ? 0.5 : 1,
                      }}>
                      <div style={{ fontSize:22, marginBottom:6 }}>{def.icon}</div>
                      <div style={{ fontWeight:600, fontSize:13, color:'#0f172a' }}>{def.label}</div>
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                        {already ? '✓ Added' : comingSoon ? 'Coming soon' : def.avgTicket}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── GHL ── */}
        {tab === 'ghl' && (
          <div style={{ maxWidth:560 }}>
            <Card style={{ padding:28 }}>
              <div style={{ fontWeight:600, fontSize:16, color:'#0f172a', marginBottom:4 }}>GoHighLevel integration</div>
              <div style={{ fontSize:13, color:'#64748b', marginBottom:24 }}>Connect this client's GHL sub-account. All leads from their funnels will be POSTed to their webhook.</div>
              <GHLSetupForm
                data={editingGHL ? ghlData : {
                  ghlLocationId:   client.ghl?.locationId,
                  ghlLocationName: client.ghl?.locationName,
                  ghlWebhookUrl:   client.ghl?.webhookUrl,
                  ghlCalendarUrl:  client.ghl?.calendarUrl,
                  ghlApiKey:       '',
                }}
                set={(k, v) => {
                  setEditingGHL(true);
                  setGhlData(prev => ({ ...prev, [k]: v }));
                }}
                onSave={saveGHL}
                saving={saving}
              />
            </Card>
          </div>
        )}

        {/* ── DEPLOY ── */}
        {tab === 'deploy' && (
          <div>
            <div style={{ marginBottom:20 }}>
              <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:600, color:'#0f172a' }}>Deploy</h3>
              <p style={{ margin:0, fontSize:13, color:'#64748b' }}>Generated code for each vertical — paste into GHL or deploy to Netlify</p>
            </div>

            {client.verticals.length === 0 ? (
              <div style={{ color:'#94a3b8', fontSize:14 }}>Add at least one vertical first</div>
            ) : (
              client.verticals.map(v => {
                const def = VERTICALS[v.verticalId];
                const html = generateFunnelHTML(client, v);
                const workerSnippet = generateWorkerSnippet(client, v);
                return (
                  <Card key={v.verticalId} style={{ marginBottom:20 }}>
                    <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:20 }}>{def?.icon}</span>
                      <span style={{ fontWeight:600, fontSize:15, color:'#0f172a' }}>{def?.label}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <div style={{ padding:20 }}>
                      {!client.ghl?.webhookUrl && (
                        <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#c2410c', marginBottom:16 }}>
                          ⚠️ GHL webhook not set — leads won't be captured. Set it in the GHL tab first.
                        </div>
                      )}
                      <div style={{ marginBottom:16 }}>
                        <CodeBlock label="GHL page HTML — paste into Custom HTML block" code={html} />
                      </div>
                      <div>
                        <CodeBlock label="Worker config snippet" code={workerSnippet} />
                      </div>
                      <div style={{ marginTop:16, display:'flex', gap:10 }}>
                        <Btn small variant='secondary' onClick={() => {
                          updateVertical(clientId, v.verticalId, { status:'live', launchedAt: new Date().toISOString() });
                          onUpdate();
                        }}>
                          Mark as live
                        </Btn>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
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
  const [screen, setScreen]   = useState('dashboard'); // dashboard | new | client
  const [activeId, setActiveId] = useState(null);

  const refresh = useCallback(() => setClients(getClients()), []);

  useEffect(() => {
    seedDemoData();
    refresh();
  }, []);

  const nav = (
    <>
      <NavItem icon="⊞" label="Dashboard" active={screen==='dashboard'} onClick={() => setScreen('dashboard')} count={clients.length} />
      <NavItem icon="+" label="New client" active={screen==='new'} onClick={() => setScreen('new')} />
      <div style={{ margin:'16px 0 8px', fontSize:10, fontWeight:600, color:'#334155', letterSpacing:'1px', textTransform:'uppercase', paddingLeft:12 }}>Verticals</div>
      {VERTICAL_LIST.filter(v => v.status==='live').map(v => (
        <NavItem key={v.id} icon={v.icon} label={v.label}
          active={false}
          count={clients.filter(c => c.verticals?.find(vv => vv.verticalId===v.id)).length || null}
          onClick={() => {}} />
      ))}
    </>
  );

  return (
    <Shell nav={nav}>
      {screen === 'dashboard' && (
        <Dashboard
          clients={clients}
          onSelectClient={id => { setActiveId(id); setScreen('client'); }}
          onNewClient={() => setScreen('new')}
        />
      )}
      {screen === 'new' && (
        <NewClientWizard
          onSave={data => {
            const c = createClient(data);
            if (data.ghlLocationId) {
              updateGHL(c.id, {
                locationId:   data.ghlLocationId,
                locationName: data.ghlLocationName,
                webhookUrl:   data.ghlWebhookUrl,
                calendarUrl:  data.ghlCalendarUrl,
              });
            }
            refresh();
            setActiveId(c.id);
            setScreen('client');
          }}
          onCancel={() => setScreen('dashboard')}
        />
      )}
      {screen === 'client' && activeId && (
        <ClientDetail
          clientId={activeId}
          clients={clients}
          onUpdate={refresh}
          onBack={() => setScreen('dashboard')}
        />
      )}
    </Shell>
  );
}
