// ─────────────────────────────────────────────────────────────
// AUTH — Mock layer, Supabase-ready
//
// To swap in Supabase:
//   npm install @supabase/supabase-js
//   Replace the 5 exported functions below with Supabase calls.
//   Nothing else in the app changes.
//
// Supabase swap example:
//   import { createClient } from '@supabase/supabase-js'
//   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
//   export async function signInWithEmail(email, password) {
//     const { data, error } = await supabase.auth.signInWithPassword({ email, password })
//     if (error) throw error
//     return data.user
//   }
// ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'upfrog_client_session';
const CLIENTS_KEY = 'upfrog_clients_v2';

function loadClients() {
  try { return JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]'); }
  catch { return []; }
}
function saveClients(clients) {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
}

// ── SESSION ───────────────────────────────────────────────────

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s) return null;
    // Expire after 7 days
    if (Date.now() - s.createdAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

function createSession(clientId, email) {
  const session = { clientId, email, createdAt: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

// ── SIGN IN WITH PASSWORD ─────────────────────────────────────

export async function signInWithPassword(email, password) {
  await mockDelay();
  const clients = loadClients();
  const client  = clients.find(c => c.portalEmail?.toLowerCase() === email.toLowerCase());

  if (!client) throw new Error('No account found for that email address.');
  if (!client.portalPasswordHash) throw new Error('Password not set. Use the magic link option.');

  const hash = await hashString(password);
  if (hash !== client.portalPasswordHash) throw new Error('Incorrect password.');

  // Record last login
  client.portalLastLogin = new Date().toISOString();
  saveClients(clients);

  return createSession(client.id, email);
}

// ── MAGIC LINK ────────────────────────────────────────────────
// In production: send a real email with a signed token.
// Mock: stores a one-time token in localStorage, returns the link.

export async function sendMagicLink(email) {
  await mockDelay();
  const clients = loadClients();
  const client  = clients.find(c => c.portalEmail?.toLowerCase() === email.toLowerCase());

  if (!client) throw new Error('No account found for that email address. Contact your Upfrog representative.');

  // Generate token
  const token     = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

  const idx = clients.findIndex(c => c.id === client.id);
  clients[idx].magicToken    = token;
  clients[idx].magicExpires  = expiresAt;
  saveClients(clients);

  const link = `${window.location.origin}${window.location.pathname}#portal-magic:${token}`;

  // In production: email this link. For now, log it.
  console.log('🔗 MAGIC LINK (dev only):', link);

  // DEV HELPER: auto-fill in UI
  return { link, token, clientId: client.id };
}

export async function signInWithMagicToken(token) {
  await mockDelay();
  const clients = loadClients();
  const idx     = clients.findIndex(c => c.magicToken === token);

  if (idx === -1) throw new Error('Invalid or expired magic link.');
  if (Date.now() > clients[idx].magicExpires) throw new Error('Magic link has expired. Request a new one.');

  const client = clients[idx];

  // Consume token
  clients[idx].magicToken   = null;
  clients[idx].magicExpires = null;
  clients[idx].portalLastLogin = new Date().toISOString();
  saveClients(clients);

  return createSession(client.id, client.portalEmail);
}

// ── SET PASSWORD (from portal) ────────────────────────────────

export async function setPassword(clientId, newPassword) {
  await mockDelay();
  if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');

  const clients = loadClients();
  const idx     = clients.findIndex(c => c.id === clientId);
  if (idx === -1) throw new Error('Client not found.');

  clients[idx].portalPasswordHash = await hashString(newPassword);
  saveClients(clients);
}

// ── ADMIN: SETUP CLIENT PORTAL ACCESS ────────────────────────

export function setupClientPortal(clientId, email) {
  const clients = loadClients();
  const idx     = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return;
  clients[idx].portalEmail     = email;
  clients[idx].portalEnabled   = true;
  clients[idx].portalCreatedAt = new Date().toISOString();
  clients[idx].portalLastLogin = null;
  saveClients(clients);
}

// ── HELPERS ───────────────────────────────────────────────────

async function hashString(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function mockDelay() {
  return new Promise(r => setTimeout(r, 600 + Math.random() * 400));
}
