// ─────────────────────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://yiuqzzlatenrszwvdhui.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4vtLNHyVawj4U5hT32hLRA_mf_VJGF4';

// Lightweight fetch wrapper — no SDK dependency needed
async function supaFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── LEADS ─────────────────────────────────────────────────────

export async function getLeads({ clientId, limit = 100, offset = 0 } = {}) {
  let path = `/leads?order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (clientId) path += `&client_id=eq.${clientId}`;
  return supaFetch(path) || [];
}

export async function getLeadsBySlug(clientSlug, { limit = 100 } = {}) {
  const path = `/leads?client_slug=eq.${clientSlug}&order=created_at.desc&limit=${limit}`;
  return supaFetch(path) || [];
}

export async function insertLead(lead) {
  return supaFetch('/leads', {
    method: 'POST',
    body: JSON.stringify(lead),
  });
}

export async function getLeadStats(clientId) {
  // Total leads
  const allLeads = await getLeads({ clientId });
  const now      = new Date();
  const thisMonth = allLeads.filter(l => {
    const d = new Date(l.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const avgConf = allLeads.length
    ? Math.round(allLeads.reduce((s,l) => s + (l.confidence || 0), 0) / allLeads.length * 100)
    : 0;
  const totalRevenue = allLeads.reduce((s,l) => s + (l.price_better || 0), 0);

  return {
    total:      allLeads.length,
    thisMonth:  thisMonth.length,
    avgConf,
    totalRevenue,
    leads:      allLeads,
  };
}

// ── CLIENTS ───────────────────────────────────────────────────

export async function getClientsFromDB() {
  return supaFetch('/clients?order=created_at.desc') || [];
}

export async function upsertClient(client) {
  return supaFetch('/clients', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(client),
  });
}

export async function getClientBySlug(slug) {
  const results = await supaFetch(`/clients?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return results?.[0] || null;
}

// ── AUTH (portal login via Supabase) ─────────────────────────

export async function getClientByPortalEmail(email) {
  const results = await supaFetch(`/clients?portal_email=eq.${encodeURIComponent(email.toLowerCase())}&limit=1`);
  return results?.[0] || null;
}

export async function updateClientPortalLogin(clientId) {
  return supaFetch(`/clients?id=eq.${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify({ portal_last_login: new Date().toISOString() }),
  });
}
