import { useState, useEffect, useCallback } from 'react';
import { getSession, signOut, signInWithPassword, sendMagicLink, signInWithMagicToken, setPassword } from './lib/auth';
import { getClient, updateClient, updatePricebook, getClients } from './lib/store';
import { VERTICALS, REGION_PRESETS } from './data/verticals';
import { generateFunnelHTML, downloadXLSX } from './lib/generateHTML';

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS — warm, contractor-friendly
// ─────────────────────────────────────────────────────────────
const C = {
  bg:     '#f8fafc',
  panel:  '#ffffff',
  border: '#e2e8f0',
  text:   '#0f172a',
  muted:  '#64748b',
  faint:  '#94a3b8',
  green:  '#059669',
  red:    '#dc2626',
  orange: '#f97316',
};

// ─────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────

function PBtn({ children, onClick, variant='primary', disabled, full, small }) {
  const styles = {
    primary:   { background:'#1e293b', color:'#fff', border:'none' },
    secondary: { background:'transparent', color:C.text, border:`1px solid ${C.border}` },
    ghost:     { background:'transparent', color:C.muted, border:'none' },
    danger:    { background:'transparent', color:C.red, border:`1px solid #fecaca` },
    orange:    { background:C.orange, color:'#fff', border:'none' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      padding: small ? '6px 14px' : '10px 20px',
      borderRadius:8, fontSize: small ? 12 : 14, fontWeight:600,
      cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1,
      display:'inline-flex', alignItems:'center', gap:6,
      width:full?'100%':undefined, justifyContent:full?'center':undefined,
      transition:'opacity .15s', fontFamily:'inherit',
    }}>{children}</button>
  );
}

function PInput({ value, onChange, placeholder, type='text', autoFocus }) {
  return (
    <input type={type} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
      style={{ width:'100%', padding:'12px 14px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, color:C.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .2s' }}
      onFocus={e=>e.target.style.borderColor='#1e293b'} onBlur={e=>e.target.style.borderColor=C.border}
    />
  );
}

function PCard({ children, style }) {
  return <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, ...style }}>{children}</div>;
}

function PField({ label, hint, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:600, color:C.text, marginBottom:6 }}>{label}</label>
      {hint && <p style={{ fontSize:12, color:C.faint, margin:'0 0 8px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function Alert({ type, children }) {
  const styles = {
    error:   { bg:'#fef2f2', border:'#fecaca', color:'#991b1b' },
    success: { bg:'#f0fdf4', border:'#bbf7d0', color:'#166534' },
    info:    { bg:'#eff6ff', border:'#bfdbfe', color:'#1e40af' },
  };
  const s = styles[type] || styles.info;
  return <div style={{ padding:'12px 16px', background:s.bg, border:`1px solid ${s.border}`, borderRadius:8, fontSize:13, color:s.color, marginBottom:16 }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [mode, setMode]       = useState('magic'); // magic | password
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [devLink, setDevLink]   = useState('');

  const handleMagic = async () => {
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true); setError('');
    try {
      const result = await sendMagicLink(email);
      setMagicSent(true);
      setDevLink(result.link); // dev only
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const handlePassword = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError('');
    try {
      const session = await signInWithPassword(email, password);
      onLogin(session);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontWeight:800, fontSize:28, color:'#0f172a', letterSpacing:'-0.5px' }}>
            Up<span style={{ color:C.orange }}>frog</span>
          </div>
          <div style={{ fontSize:14, color:C.muted, marginTop:6 }}>Client portal</div>
        </div>

        <PCard style={{ padding:32 }}>
          {magicSent ? (
            <>
              <div style={{ textAlign:'center', marginBottom:24 }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📬</div>
                <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:8 }}>Check your email</div>
                <div style={{ fontSize:14, color:C.muted, lineHeight:1.6 }}>
                  We sent a magic link to <strong>{email}</strong>. Click it to sign in — it expires in 15 minutes.
                </div>
              </div>
              {devLink && (
                <div style={{ background:'#fefce8', border:'1px solid #fde68a', borderRadius:8, padding:'12px 14px', fontSize:12, marginBottom:16 }}>
                  <div style={{ fontWeight:600, color:'#92400e', marginBottom:6 }}>🛠 Dev mode — magic link:</div>
                  <a href={devLink} style={{ color:'#1e40af', wordBreak:'break-all', fontSize:11 }}>{devLink}</a>
                </div>
              )}
              <PBtn full variant='secondary' onClick={()=>{ setMagicSent(false); setDevLink(''); }}>← Try again</PBtn>
            </>
          ) : (
            <>
              <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>Sign in to your account</div>
              <div style={{ fontSize:14, color:C.muted, marginBottom:24 }}>Manage your pricebook, brand settings, and leads.</div>

              {error && <Alert type='error'>{error}</Alert>}

              {/* Mode toggle */}
              <div style={{ display:'flex', background:'#f8fafc', borderRadius:8, padding:4, marginBottom:24 }}>
                {[['magic','✉️ Magic link'],['password','🔑 Password']].map(([m,label])=>(
                  <button key={m} onClick={()=>{ setMode(m); setError(''); }}
                    style={{ flex:1, padding:'8px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:13, fontWeight:mode===m?600:400, background:mode===m?'#fff':'transparent', color:mode===m?C.text:C.muted, boxShadow:mode===m?'0 1px 3px rgba(0,0,0,0.1)':'none', transition:'all .2s', fontFamily:'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>

              <PField label="Email address">
                <PInput value={email} onChange={setEmail} placeholder="you@contractor.com" type="email" autoFocus />
              </PField>

              {mode==='password' && (
                <PField label="Password">
                  <PInput value={password} onChange={setPassword} placeholder="••••••••" type="password" />
                </PField>
              )}

              <PBtn full onClick={mode==='magic'?handleMagic:handlePassword} disabled={loading}>
                {loading ? '⏳ Sending…' : mode==='magic' ? 'Send magic link →' : 'Sign in →'}
              </PBtn>

              <div style={{ marginTop:16, fontSize:12, color:C.faint, textAlign:'center' }}>
                Don't have access? Contact your Upfrog representative.
              </div>
            </>
          )}
        </PCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PRICEBOOK EDITOR (client-facing)
// ─────────────────────────────────────────────────────────────

function ClientPricebookEditor({ client, verticalInstance, onSave }) {
  const def       = VERTICALS[verticalInstance.verticalId];
  const questions = def.pricebookQuestions;
  const [step, setStep]   = useState(0);
  const [pb, setPb]       = useState({ ...verticalInstance.pricebook });
  const [saved, setSaved] = useState(false);

  const q      = questions[step];
  const isLast = step === questions.length - 1;
  const set    = (k,v) => setPb(prev=>({...prev,[k]:v}));

  const applyPreset = (key) => {
    if (key==='custom') return;
    const preset = REGION_PRESETS[key];
    if (preset) setPb(prev=>({...prev,...preset}));
  };

  const handleNext = () => {
    if (isLast) {
      onSave(pb);
      setSaved(true);
      setTimeout(()=>setSaved(false), 3000);
      return;
    }
    setStep(s=>s+1);
  };

  if (!q) return null;

  const progress = (step / questions.length) * 100;

  return (
    <div>
      {saved && <Alert type='success'>✓ Pricebook saved successfully!</Alert>}

      {/* Progress */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progress}%`, background:'#1e293b', borderRadius:3, transition:'width .4s' }} />
        </div>
        <span style={{ fontSize:13, color:C.muted, whiteSpace:'nowrap' }}>{step+1} of {questions.length}</span>
      </div>

      <h3 style={{ margin:'0 0 8px', fontSize:20, fontWeight:700, color:C.text }}>{q.question}</h3>
      {q.hint && <p style={{ margin:'0 0 20px', fontSize:14, color:C.muted, lineHeight:1.6 }}>{q.hint}</p>}

      <PCard style={{ padding:24, marginBottom:20 }}>
        {q.type==='choice' && (
          <div style={{ display:'grid', gap:10 }}>
            {q.options.map(opt=>{
              const val = pb[q.fieldKey||q.id];
              const sel = val===opt.value;
              return (
                <button key={opt.value} onClick={()=>{ set(q.fieldKey||q.id,opt.value); if(q.id==='region')applyPreset(opt.value); }}
                  style={{ padding:'16px 20px', borderRadius:10, cursor:'pointer', textAlign:'left', border:`2px solid ${sel?'#1e293b':C.border}`, background:sel?'#f8fafc':'#fff', transition:'all .15s', fontFamily:'inherit' }}>
                  <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:opt.desc?3:0 }}>{opt.label}</div>
                  {opt.desc && <div style={{ fontSize:13, color:C.muted }}>{opt.desc}</div>}
                </button>
              );
            })}
          </div>
        )}

        {(q.type==='currency'||q.type==='percent'||q.type==='multiplier') && (
          <>
            <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', marginBottom:12 }}>
              {q.prefix && <span style={{ padding:'0 14px', background:'#f8fafc', color:C.muted, fontSize:14, borderRight:`1px solid ${C.border}`, alignSelf:'stretch', display:'flex', alignItems:'center', fontWeight:600 }}>{q.prefix}</span>}
              <input type="number" value={pb[q.fieldKey||q.id]||''} onChange={e=>set(q.fieldKey||q.id, parseFloat(e.target.value)||e.target.value)}
                placeholder={q.placeholder}
                style={{ flex:1, padding:'12px 14px', border:'none', outline:'none', fontSize:16, color:C.text, fontFamily:'inherit', fontWeight:600 }} />
              {q.suffix && <span style={{ padding:'0 14px', background:'#f8fafc', color:C.muted, fontSize:14, borderLeft:`1px solid ${C.border}`, alignSelf:'stretch', display:'flex', alignItems:'center' }}>{q.suffix}</span>}
            </div>

            {q.marketRange && (
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#166534', marginBottom:12 }}>
                📊 {q.marketRange.label}
              </div>
            )}

            {q.type==='currency' && q.marketRange && (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:12, color:C.faint, marginBottom:8 }}>Quick select:</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {[q.marketRange.low, Math.round((q.marketRange.low+q.marketRange.high)/2), q.marketRange.high].map(v=>(
                    <button key={v} onClick={()=>set(q.fieldKey||q.id,v)}
                      style={{ padding:'6px 16px', borderRadius:20, border:`1px solid ${C.border}`, background:'#f8fafc', fontSize:13, cursor:'pointer', color:C.muted, fontFamily:'inherit', fontWeight:500 }}>
                      {q.prefix||''}{v}{q.suffix||''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </PCard>

      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <PBtn variant='secondary' onClick={()=>step===0?null:setStep(s=>s-1)} disabled={step===0}>← Back</PBtn>
        <PBtn onClick={handleNext}>{isLast?'Save pricebook ✓':'Next →'}</PBtn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BRAND SETTINGS (client-facing)
// ─────────────────────────────────────────────────────────────

function ClientBrandSettings({ client, onSave }) {
  const [data, setData]   = useState({
    phone:       client.phone || '',
    brandColor:  client.brandColor || '#c0572a',
    brandColorAlt: client.brandColorAlt || '#2d2a26',
    logoUrl:     client.logoUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const set = (k,v) => setData(d=>({...d,[k]:v}));

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r=>setTimeout(r,600));
    onSave(data);
    setSaving(false);
    setSaved(true);
    setTimeout(()=>setSaved(false),3000);
  };

  return (
    <div>
      {saved && <Alert type='success'>✓ Brand settings saved!</Alert>}

      <PCard style={{ padding:28, marginBottom:20 }}>
        <div style={{ fontWeight:600, fontSize:16, color:C.text, marginBottom:20 }}>Brand settings</div>

        <PField label="Business phone" hint="Displayed in the header of your estimate page">
          <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden' }}>
            <span style={{ padding:'0 12px', background:'#f8fafc', color:C.muted, fontSize:14, borderRight:`1px solid ${C.border}`, alignSelf:'stretch', display:'flex', alignItems:'center' }}>📞</span>
            <input value={data.phone} onChange={e=>set('phone',e.target.value)} placeholder="(301) 555-0100"
              style={{ flex:1, padding:'11px 14px', border:'none', outline:'none', fontSize:14, color:C.text, fontFamily:'inherit' }} />
          </div>
        </PField>

        <PField label="Logo URL" hint="Direct link to your logo image (PNG or SVG recommended)">
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden' }}>
              <input value={data.logoUrl} onChange={e=>set('logoUrl',e.target.value)} placeholder="https://yoursite.com/logo.png"
                style={{ flex:1, padding:'11px 14px', border:'none', outline:'none', fontSize:14, color:C.text, fontFamily:'inherit' }} />
            </div>
            {data.logoUrl && <img src={data.logoUrl} alt="Logo preview" style={{ height:44, borderRadius:8, border:`1px solid ${C.border}`, padding:4, background:'#f8fafc', objectFit:'contain' }} onError={e=>e.target.style.display='none'} />}
          </div>
        </PField>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <PField label="Primary brand color" hint="Buttons and accents">
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="color" value={data.brandColor} onChange={e=>set('brandColor',e.target.value)}
                style={{ width:44, height:42, border:`1px solid ${C.border}`, borderRadius:8, cursor:'pointer', padding:2 }} />
              <div style={{ flex:1, display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden' }}>
                <input value={data.brandColor} onChange={e=>set('brandColor',e.target.value)}
                  style={{ flex:1, padding:'11px 12px', border:'none', outline:'none', fontSize:14, color:C.text, fontFamily:'inherit' }} />
              </div>
            </div>
          </PField>
          <PField label="Secondary color" hint="Headings and dark areas">
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="color" value={data.brandColorAlt} onChange={e=>set('brandColorAlt',e.target.value)}
                style={{ width:44, height:42, border:`1px solid ${C.border}`, borderRadius:8, cursor:'pointer', padding:2 }} />
              <div style={{ flex:1, display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden' }}>
                <input value={data.brandColorAlt} onChange={e=>set('brandColorAlt',e.target.value)}
                  style={{ flex:1, padding:'11px 12px', border:'none', outline:'none', fontSize:14, color:C.text, fontFamily:'inherit' }} />
              </div>
            </div>
          </PField>
        </div>

        {/* Live preview */}
        <div style={{ marginTop:4, borderRadius:12, overflow:'hidden', border:`1px solid ${C.border}` }}>
          <div style={{ background:data.brandColor, padding:'18px 24px', color:'#fff' }}>
            <div style={{ fontSize:11, opacity:.8, marginBottom:4, textTransform:'uppercase', letterSpacing:'1px' }}>Funnel header preview</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              {data.logoUrl
                ? <img src={data.logoUrl} alt="" style={{ height:32, objectFit:'contain' }} onError={e=>e.target.style.display='none'} />
                : <div style={{ fontWeight:700, fontSize:20, color:'#fff' }}>{client.name}</div>
              }
              {data.phone && <div style={{ fontSize:13, opacity:.9 }}>📞 {data.phone}</div>}
            </div>
          </div>
          <div style={{ padding:'14px 24px', background:'#faf7f2', display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ background:data.brandColor, color:'#fff', padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600 }}>Get My Free Estimate</div>
            <div style={{ fontSize:13, color:'#6b6560' }}>No obligation · Results in 60 sec</div>
          </div>
        </div>
      </PCard>

      <PBtn onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save brand settings'}</PBtn>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LEADS & STATS (client-facing)
// ─────────────────────────────────────────────────────────────

function ClientLeads({ client }) {
  // In production: pull from GHL API or Supabase
  // Mock: generate sample leads based on client data
  const mockLeads = [
    { name:'Sarah Johnson', address:'247 Magnolia Dr', pitch:'6/12', squares:'18.4', priceBetter:'$14,200', confidence:'High', date:'2 hours ago' },
    { name:'Mike Torres',   address:'1842 Sunrise Blvd', pitch:'8/12', squares:'22.1', priceBetter:'$18,900', confidence:'High', date:'Yesterday' },
    { name:'Lisa Chen',     address:'904 Coral Way', pitch:'4/12', squares:'15.8', priceBetter:'$11,400', confidence:'Medium', date:'2 days ago' },
    { name:'David Brown',   address:'331 Oak Street', pitch:'10/12', squares:'28.3', priceBetter:'$26,100', confidence:'Low', date:'3 days ago' },
    { name:'Amy Wilson',    address:'567 Pine Ave', pitch:'6/12', squares:'20.2', priceBetter:'$15,800', confidence:'High', date:'4 days ago' },
  ];

  const confColor = c => ({ High:'#059669', Medium:'#d97706', Low:'#dc2626' }[c] || '#64748b');
  const confBg    = c => ({ High:'#d1fae5', Medium:'#fef3c7', Low:'#fee2e2' }[c] || '#f3f4f6');

  const totalLeads  = client.stats?.totalLeads || mockLeads.length;
  const thisMonth   = client.stats?.thisMonth  || 3;
  const avgConfidence = '87%';

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Total leads', value:totalLeads, color:'#0f172a' },
          { label:'This month',  value:thisMonth,  color:'#2563eb' },
          { label:'Avg confidence', value:avgConfidence, color:'#059669' },
        ].map(s=>(
          <PCard key={s.label} style={{ padding:'18px 20px' }}>
            <div style={{ fontSize:12, color:C.muted, fontWeight:500, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
          </PCard>
        ))}
      </div>

      {/* Leads table */}
      <PCard>
        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, fontWeight:600, fontSize:14, color:C.text }}>Recent leads</div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid #f1f5f9` }}>
                {['Homeowner','Address','Pitch','Squares','Better price','Confidence','When'].map(h=>(
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:C.faint, textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockLeads.map((lead,i)=>(
                <tr key={i} style={{ borderBottom:`1px solid #f8fafc` }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'12px 16px', fontSize:14, fontWeight:500, color:C.text }}>{lead.name}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:C.muted }}>{lead.address}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:C.text, fontWeight:500 }}>{lead.pitch}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:C.text }}>{lead.squares}</td>
                  <td style={{ padding:'12px 16px', fontSize:14, fontWeight:600, color:C.text }}>{lead.priceBetter}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:confBg(lead.confidence), color:confColor(lead.confidence) }}>{lead.confidence}</span>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:12, color:C.faint, whiteSpace:'nowrap' }}>{lead.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'12px 20px', fontSize:12, color:C.faint, borderTop:`1px solid ${C.border}` }}>
          Showing recent leads. Connect your GHL account to see all leads in real time.
        </div>
      </PCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SET PASSWORD PROMPT (first time after magic link)
// ─────────────────────────────────────────────────────────────

function SetPasswordPrompt({ clientId, onDone }) {
  const [pw, setPw]       = useState('');
  const [pw2, setPw2]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (pw !== pw2) { setError('Passwords don\'t match.'); return; }
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError('');
    try {
      await setPassword(clientId, pw);
      onDone();
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontWeight:800, fontSize:28, color:'#0f172a' }}>Up<span style={{ color:C.orange }}>frog</span></div>
        </div>
        <PCard style={{ padding:32 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:8 }}>Set a password</div>
          <div style={{ fontSize:14, color:C.muted, marginBottom:24, lineHeight:1.6 }}>
            Create a password so you can log in with email and password next time — no magic link needed.
          </div>
          {error && <Alert type='error'>{error}</Alert>}
          <PField label="New password">
            <PInput value={pw} onChange={setPw} type="password" placeholder="At least 8 characters" autoFocus />
          </PField>
          <PField label="Confirm password">
            <PInput value={pw2} onChange={setPw2} type="password" placeholder="Same password again" />
          </PField>
          <div style={{ display:'flex', gap:10 }}>
            <PBtn onClick={onDone} variant='secondary'>Skip for now</PBtn>
            <PBtn onClick={handle} disabled={loading}>{loading?'Saving…':'Set password →'}</PBtn>
          </div>
        </PCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN CLIENT PORTAL
// ─────────────────────────────────────────────────────────────

export default function ClientPortal() {
  const [session, setSession]       = useState(null);
  const [client, setClient]         = useState(null);
  const [tab, setTab]               = useState('pricebook');
  const [activeVertical, setActiveVertical] = useState(null);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [loading, setLoading]       = useState(true);

  const refreshClient = useCallback(() => {
    if (!session) return;
    const c = getClient(session.clientId);
    setClient(c);
    if (c?.verticals?.length > 0 && !activeVertical) {
      setActiveVertical(c.verticals[0].verticalId);
    }
  }, [session, activeVertical]);

  // Check for magic token in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#portal-magic:')) {
      const token = hash.replace('#portal-magic:','');
      signInWithMagicToken(token).then(session => {
        window.location.hash = '';
        setSession(session);
        setShowSetPassword(true); // prompt to set password after magic link
      }).catch(e => {
        console.error('Magic link error:', e.message);
      });
    }
  }, []);

  // Check existing session
  useEffect(() => {
    const existing = getSession();
    if (existing) setSession(existing);
    setLoading(false);
  }, []);

  useEffect(() => { refreshClient(); }, [session]);

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', color:C.muted }}>
      Loading…
    </div>
  );

  if (!session) return <LoginPage onLogin={s=>{ setSession(s); }} />;
  if (showSetPassword && client) return <SetPasswordPrompt clientId={client.id} onDone={()=>setShowSetPassword(false)} />;
  if (!client) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', color:C.muted }}>
      Account not found. <button onClick={()=>{ signOut(); setSession(null); }} style={{ marginLeft:8, color:C.red, background:'none', border:'none', cursor:'pointer' }}>Sign out</button>
    </div>
  );

  const activeV = client.verticals?.find(v=>v.verticalId===activeVertical);

  const tabs = [
    { id:'pricebook', label:'💰 Pricebook' },
    { id:'brand',     label:'🎨 Brand settings' },
    { id:'leads',     label:'📋 Leads & stats' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', fontFamily:'Inter,system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background:'#0f172a', padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ fontWeight:800, fontSize:20, color:C.orange }}>Up<span style={{ color:'#fff' }}>frog</span></div>
          <div style={{ width:1, height:24, background:'rgba(255,255,255,0.15)' }} />
          <div style={{ fontSize:14, color:'#94a3b8', fontWeight:500 }}>{client.name}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:13, color:'#64748b' }}>{session.email}</div>
          <PBtn small variant='ghost' onClick={()=>{ signOut(); setSession(null); setClient(null); }} style={{ color:'#64748b' }}>Sign out</PBtn>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px' }}>

        {/* Welcome */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>Welcome back{client.name ? `, ${client.name.split(' ')[0]}` : ''}!</h1>
          <p style={{ margin:'4px 0 0', fontSize:14, color:C.muted }}>Manage your pricing, brand, and leads from here.</p>
        </div>

        {/* Vertical switcher (if multiple) */}
        {client.verticals?.length > 1 && (
          <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
            {client.verticals.map(v=>{
              const def=VERTICALS[v.verticalId];
              return (
                <button key={v.verticalId} onClick={()=>setActiveVertical(v.verticalId)}
                  style={{ padding:'8px 16px', borderRadius:20, border:`2px solid ${activeVertical===v.verticalId?'#1e293b':C.border}`, background:activeVertical===v.verticalId?'#1e293b':'#fff', color:activeVertical===v.verticalId?'#fff':C.muted, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                  {def?.icon} {def?.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.border}`, marginBottom:28, background:'#fff', borderRadius:'12px 12px 0 0', overflow:'hidden', border:`1px solid ${C.border}` }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:'14px 20px', border:'none', borderBottom:`3px solid ${tab===t.id?'#1e293b':'transparent'}`, background:'none', fontSize:14, fontWeight:tab===t.id?600:400, color:tab===t.id?C.text:C.muted, cursor:'pointer', fontFamily:'inherit', transition:'all .2s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab==='pricebook' && (
          activeV ? (
            <ClientPricebookEditor
              client={client}
              verticalInstance={activeV}
              onSave={pb=>{
                updatePricebook(client.id, activeV.verticalId, pb);
                refreshClient();
              }}
            />
          ) : (
            <PCard style={{ padding:40, textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:16, fontWeight:600, color:C.text, marginBottom:6 }}>No verticals set up yet</div>
              <div style={{ fontSize:14, color:C.muted }}>Contact your Upfrog representative to get started.</div>
            </PCard>
          )
        )}

        {tab==='brand' && (
          <ClientBrandSettings
            client={client}
            onSave={updates=>{
              updateClient(client.id, updates);
              refreshClient();
            }}
          />
        )}

        {tab==='leads' && <ClientLeads client={client} />}

        {/* Download pricebook */}
        {activeV && (
          <div style={{ marginTop:24, padding:'16px 20px', background:'#fff', borderRadius:10, border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Download your pricebook</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Excel format with all your pricing and client details</div>
            </div>
            <PBtn small variant='secondary' onClick={()=>downloadXLSX(client,activeV)}>↓ Download Excel</PBtn>
          </div>
        )}
      </div>
    </div>
  );
}
