// ================================================================
// ADD TO YOUR CLOUDFLARE WORKER
// upfrog-proxy.shiny-poetry-341c.workers.dev
//
// Required Worker environment variables (add in Cloudflare dashboard):
//   SUPABASE_URL         = https://yiuqzzlatenrszwvdhui.supabase.co
//   SUPABASE_SERVICE_KEY = your service_role key (from Supabase Settings → API)
//
// The service_role key bypasses RLS — keep it secret, never expose to browser.
// ================================================================

// ── ADD THIS ROUTE to your main fetch() handler ───────────────
//
//   if (path === '/lead' && request.method === 'POST') {
//     return handleLead(request, env);
//   }
//
// This endpoint:
//   1. Receives the full lead payload from the consumer funnel
//   2. Writes to Supabase leads table
//   3. Forwards to GHL webhook
//   4. Returns the lead ID so the funnel can build the results URL
// ─────────────────────────────────────────────────────────────

async function handleLead(request, env) {
  const origin = request.headers.get('Origin');

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin); }

  const {
    // Client
    clientId, clientSlug, vertical = 'roofing',
    // Homeowner
    firstName, lastName, email, phone,
    // Property
    address, lat, lng,
    // Form answers
    roofType, condition, layers,
    // AI results
    pitch, squares, footprint, complexity, confidence,
    roofTypeDetected, materialDetected,
    // Signals
    signalSolar, signalSv, signalSat, signalRegrid,
    // Pricing
    priceGood, priceBetter, priceBest, monthlyPayment,
    // GHL
    ghlWebhookUrl,
  } = body;

  // ── 1. Build lead record ──────────────────────────────────────
  const lead = {
    client_id:          clientId    || null,
    client_slug:        clientSlug  || null,
    vertical:           vertical,
    first_name:         firstName   || '',
    last_name:          lastName    || '',
    email:              email       || '',
    phone:              phone       || '',
    address:            address     || '',
    lat:                lat         || null,
    lng:                lng         || null,
    roof_type:          roofType    || null,
    condition:          condition   || null,
    layers:             layers      || null,
    pitch:              pitch       || null,
    squares:            squares     || null,
    footprint:          footprint   || null,
    complexity:         complexity  || null,
    confidence:         confidence  || null,
    roof_type_detected: roofTypeDetected  || null,
    material_detected:  materialDetected  || null,
    signal_solar:       !!signalSolar,
    signal_sv:          !!signalSv,
    signal_sat:         !!signalSat,
    signal_regrid:      !!signalRegrid,
    price_good:         priceGood   || null,
    price_better:       priceBetter || null,
    price_best:         priceBest   || null,
    monthly_payment:    monthlyPayment || null,
    source:             'upfrog-funnel',
    ghl_pushed:         false,
  };

  // ── 2. Write to Supabase ──────────────────────────────────────
  let leadId = null;
  try {
    const sbRes = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'apikey':        env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(lead),
    });

    if (sbRes.ok) {
      const rows = await sbRes.json();
      leadId = rows?.[0]?.id || null;

      // Update lead with results URL now that we have the ID
      if (leadId) {
        const resultsUrl = `https://refrog.app/results/${leadId}`;
        await fetch(`${env.SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
          method: 'PATCH',
          headers: {
            'apikey':        env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ results_url: resultsUrl }),
        });
        lead.results_url = resultsUrl;
      }
    }
  } catch(e) {
    // Supabase write failed — log but don't block GHL
    console.error('Supabase write failed:', e.message);
  }

  // ── 3. Forward to GHL webhook ─────────────────────────────────
  let ghlPushed = false;
  const webhookUrl = ghlWebhookUrl || env.GHL_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const ghlPayload = {
        firstName, lastName, email, phone, address,
        roofType, condition, layers,
        pitch, squares, confidence: Math.round((confidence || 0) * 100),
        priceGood, priceBetter, priceBest,
        resultsUrl: lead.results_url || '',
        source: 'upfrog-funnel',
        vertical,
        timestamp: new Date().toISOString(),
      };

      const ghlRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ghlPayload),
      });

      ghlPushed = ghlRes.ok;

      // Mark GHL push in Supabase
      if (ghlPushed && leadId) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
          method: 'PATCH',
          headers: {
            'apikey':        env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ ghl_pushed: true, ghl_pushed_at: new Date().toISOString() }),
        });
      }
    } catch(e) {
      console.error('GHL webhook failed:', e.message);
    }
  }

  // ── 4. Return lead ID to funnel ───────────────────────────────
  return jsonResponse({
    success:    true,
    leadId,
    resultsUrl: lead.results_url || null,
    ghlPushed,
  }, 200, origin);
}

// ── Helper ────────────────────────────────────────────────────
function jsonResponse(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
