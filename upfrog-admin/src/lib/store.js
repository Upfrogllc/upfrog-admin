import { VERTICALS } from '../data/verticals';

const KEY = 'upfrog_clients_v2';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}
function save(c) { localStorage.setItem(KEY, JSON.stringify(c)); }

export function getClients() { return load(); }
export function getClient(id) { return load().find(c => c.id === id) || null; }

export function createClient(data = {}) {
  const clients = load();
  const client = {
    id:        crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status:    'draft',
    name:        data.name || '',
    slug:        data.slug || slugify(data.name || ''),
    phone:       data.phone || '',
    email:       data.email || '',
    address:     data.address || '',
    city:        data.city || '',
    state:       data.state || '',
    zip:         data.zip || '',
    serviceArea: data.serviceArea || '',
    domain:      data.domain || '',
    notes:       data.notes || '',
    logoUrl:       data.logoUrl || '',
    brandColor:    data.brandColor || '#c0572a',
    brandColorAlt: data.brandColorAlt || '#2d2a26',
    brandColors:   data.brandColors || [],
    brandContext:  data.brandContext || '',
    metaPixelId:     data.metaPixelId || '',
    gaMeasurementId: data.gaMeasurementId || '',
    ghl: { locationId:'', locationName:'', webhookUrl:'', calendarUrl:'', apiKey:'', connected:false, customFields:{} },
    verticals: [],
    stats: { totalLeads:0, thisMonth:0, lastUpdated:null },
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

export function deleteClient(id) { save(load().filter(c => c.id !== id)); }

export function updateGHL(clientId, ghlData) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return null;
  clients[idx].ghl = { ...clients[idx].ghl, ...ghlData, connected: !!(ghlData.locationId && ghlData.webhookUrl) };
  clients[idx].updatedAt = new Date().toISOString();
  save(clients);
  return clients[idx];
}

export function addVertical(clientId, verticalId) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return null;
  if (clients[idx].verticals.find(v => v.verticalId === verticalId)) return clients[idx];
  const def = VERTICALS[verticalId];
  const pbToken = btoa(`${clientId}:${verticalId}:${Date.now()}`).replace(/[=+/]/g, c => ({'=':'','+':`-`,'/':'_'}[c]||c));
  clients[idx].verticals.push({
    verticalId, status:'setup',
    pricebook: { ...def.defaultPricebook },
    pbToken, pbCompletedAt:null,
    customFields:{}, funnelUrl:'', launchedAt:null,
    createdAt: new Date().toISOString(),
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

export function updatePricebook(clientId, verticalId, pb) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return null;
  const vIdx = clients[idx].verticals.findIndex(v => v.verticalId === verticalId);
  if (vIdx === -1) return null;
  clients[idx].verticals[vIdx].pricebook = { ...clients[idx].verticals[vIdx].pricebook, ...pb };
  clients[idx].verticals[vIdx].pbCompletedAt = new Date().toISOString();
  clients[idx].updatedAt = new Date().toISOString();
  save(clients);
  return clients[idx];
}

export function getClientByPbToken(token) {
  for (const c of load()) {
    for (const v of c.verticals) {
      if (v.pbToken === token) return { client: c, vertical: v };
    }
  }
  return null;
}

export function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function getStatusLabel(s) {
  return { draft:'Draft', setup:'Setting up', ready:'Ready', live:'Live', paused:'Paused' }[s] || s;
}

export function seedDemoData() {
  if (load().length > 0) return;
  const demo = createClient({
    name:'Peak Roofing — Maryland', phone:'(301) 555-0100', email:'info@peakroofing.com',
    brandColor:'#c0572a', brandColorAlt:'#2d2a26', city:'Leonardtown', state:'MD', zip:'20650',
    serviceArea:"St. Mary's County, Calvert County, Charles County MD", domain:'peakroofing.com',
    metaPixelId:'1234567890', gaMeasurementId:'G-XXXXXXXXXX',
    notes:"Demo account — St. Mary's County Maryland",
    brandColors:[{hex:'#c0572a',role:'primary'},{hex:'#2d2a26',role:'secondary'},{hex:'#f5e8e0',role:'background'}],
  });
  updateClient(demo.id, { status:'live' });
  addVertical(demo.id, 'roofing');
  updateVertical(demo.id, 'roofing', { status:'live', funnelUrl:'https://refrog.app/peak-roofing' });
  updateGHL(demo.id, {
    locationId:'iRqFTUm8UyvpoVVqMRxp', locationName:'Peak Roofing',
    webhookUrl:'https://services.leadconnectorhq.com/hooks/iRqFTUm8UyvpoVVqMRxp/webhook-trigger/',
    calendarUrl:'https://api.leadconnectorhq.com/widget/booking/Xx8KE0xuc1fq2j29sFa3',
  });
}

export function setupClientPortal(clientId, email) {
  const clients = load();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return;
  clients[idx].portalEmail   = email;
  clients[idx].portalEnabled = true;
  clients[idx].portalCreatedAt = new Date().toISOString();
  save(clients);
}
