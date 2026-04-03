// ─────────────────────────────────────────────────────────────
// STORE — localStorage persistence
// Replace the load/save functions with Supabase calls when ready.
// Everything else stays the same.
// ─────────────────────────────────────────────────────────────

import { VERTICALS } from '../data/verticals';

const KEY = 'upfrog_clients';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(clients) {
  localStorage.setItem(KEY, JSON.stringify(clients));
}

// ── CLIENT CRUD ───────────────────────────────────────────────

export function getClients() {
  return load();
}

export function getClient(id) {
  return load().find(c => c.id === id) || null;
}

export function createClient(data) {
  const clients = load();
  const client = {
    id:        crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status:    'draft',

    // Brand profile
    name:       data.name || '',
    slug:       data.slug || slugify(data.name || ''),
    phone:      data.phone || '',
    email:      data.email || '',
    logoUrl:    data.logoUrl || '',
    brandColor: data.brandColor || '#c0572a',
    domain:     data.domain || '',
    address:    data.address || '',
    city:       data.city || '',
    state:      data.state || '',

    // GHL integration — manual paste
    ghl: {
      locationId:   '',
      locationName: '',
      webhookUrl:   '',
      calendarUrl:  '',
      apiKey:       '',
      connected:    false,
      customFields: {},  // fieldName → ghlFieldId
    },

    // Verticals this client has enabled
    // Each is a { verticalId, status, pricebook, launchedAt }
    verticals: [],

    // Lead stats (populated from GHL or manually)
    stats: {
      totalLeads:  0,
      thisMonth:   0,
      lastUpdated: null,
    },

    // Notes for internal Upfrog use
    notes: '',
  };

  clients.push(client);
  save(clients);
  return client;
}

export function updateClient(id, updates) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === id);
  if (idx === -1) return null;
  clients[idx] = { ...clients[idx], ...updates, updatedAt: new Date().toISOString() };
  save(clients);
  return clients[idx];
}

export function deleteClient(id) {
  const clients = load().filter(c => c.id !== id);
  save(clients);
}

// ── GHL INTEGRATION ───────────────────────────────────────────

export function updateGHL(clientId, ghlData) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return null;
  clients[idx].ghl = {
    ...clients[idx].ghl,
    ...ghlData,
    connected: !!(ghlData.locationId && ghlData.webhookUrl),
  };
  clients[idx].updatedAt = new Date().toISOString();
  save(clients);
  return clients[idx];
}

// ── VERTICAL MANAGEMENT ───────────────────────────────────────

export function addVertical(clientId, verticalId) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return null;

  const existing = clients[idx].verticals.find(v => v.verticalId === verticalId);
  if (existing) return clients[idx];

  const verticalDef = VERTICALS[verticalId];
  clients[idx].verticals.push({
    verticalId,
    status:     'setup',      // setup → ready → live → paused
    pricebook:  { ...verticalDef.defaultPricebook },
    customFields: {},         // ghl field ID map for this vertical
    funnelUrl:  '',
    launchedAt: null,
    createdAt:  new Date().toISOString(),
  });
  clients[idx].updatedAt = new Date().toISOString();
  save(clients);
  return clients[idx];
}

export function removeVertical(clientId, verticalId) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return null;
  clients[idx].verticals = clients[idx].verticals.filter(v => v.verticalId !== verticalId);
  clients[idx].updatedAt = new Date().toISOString();
  save(clients);
  return clients[idx];
}

export function updateVertical(clientId, verticalId, updates) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return null;
  const vIdx = clients[idx].verticals.findIndex(v => v.verticalId === verticalId);
  if (vIdx === -1) return null;
  clients[idx].verticals[vIdx] = { ...clients[idx].verticals[vIdx], ...updates };
  clients[idx].updatedAt = new Date().toISOString();
  save(clients);
  return clients[idx];
}

export function updatePricebook(clientId, verticalId, pricebookUpdates) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return null;
  const vIdx = clients[idx].verticals.findIndex(v => v.verticalId === verticalId);
  if (vIdx === -1) return null;
  clients[idx].verticals[vIdx].pricebook = {
    ...clients[idx].verticals[vIdx].pricebook,
    ...pricebookUpdates,
  };
  clients[idx].updatedAt = new Date().toISOString();
  save(clients);
  return clients[idx];
}

// ── HELPERS ───────────────────────────────────────────────────

export function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getStatusLabel(status) {
  return { draft: 'Draft', setup: 'Setting up', ready: 'Ready', live: 'Live', paused: 'Paused' }[status] || status;
}

export function getStatusColor(status) {
  return {
    draft:  'gray',
    setup:  'amber',
    ready:  'blue',
    live:   'green',
    paused: 'red',
  }[status] || 'gray';
}

// ── SEED DATA (for demo/testing) ─────────────────────────────

export function seedDemoData() {
  if (load().length > 0) return;
  const demo = createClient({
    name: 'Peak Roofing — Maryland',
    phone: '(772) 555-0100',
    email: 'info@peakroofing.com',
    brandColor: '#c0572a',
    state: 'MD',
    city: 'Leonardtown',
  });
  updateClient(demo.id, { status: 'live', notes: 'Demo account — St. Mary\'s County Maryland' });
  addVertical(demo.id, 'roofing');
  updateVertical(demo.id, 'roofing', { status: 'live', funnelUrl: 'https://refrog.app/peak-roofing' });
  updateGHL(demo.id, {
    locationId: 'iRqFTUm8UyvpoVVqMRxp',
    locationName: 'Peak Roofing',
    webhookUrl: 'https://services.leadconnectorhq.com/hooks/iRqFTUm8UyvpoVVqMRxp/webhook-trigger/',
    calendarUrl: 'https://api.leadconnectorhq.com/widget/booking/Xx8KE0xuc1fq2j29sFa3',
  });
}
