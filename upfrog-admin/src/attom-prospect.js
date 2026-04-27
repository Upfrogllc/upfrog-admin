/**
 * ============================================================
 * Upfrog ATTOM Prospect Search Worker
 * ============================================================
 *
 * Endpoints:
 *   POST /attom/prospect-search    - Kick off a new search job
 *   GET  /attom/prospect-search/:id - Get job status + results
 *   POST /attom/prospect-search/:id/run - Process the job (called internally)
 *
 * Required environment variables (set in Cloudflare Worker dashboard):
 *   ATTOM_API_KEY        - Your ATTOM API key
 *   SUPABASE_URL         - Your Supabase project URL
 *   SUPABASE_SERVICE_KEY - Supabase service role key (server-side only)
 *   ADMIN_AUTH_TOKEN     - Shared secret for admin panel auth
 *
 * Add this to your existing Cloudflare Worker by importing
 * handleAttomProspectSearch and routing to it.
 * ============================================================
 */

const ATTOM_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

// HVAC permit keyword detection — case insensitive matching
const HVAC_PERMIT_KEYWORDS = [
  'HVAC',
  'MECHANICAL',
  'A/C',
  'AC ',
  ' AC',
  'AIR COND',
  'AIR-COND',
  'AIRCOND',
  'HEAT PUMP',
  'HEATPUMP',
  'FURNACE',
  'HEATING',
  'COOLING',
  'CONDENSER',
  'EVAPORATOR',
  'CHANGEOUT',
  'CHANGE OUT',
  'CHANGE-OUT',
  'SPLIT SYSTEM',
  'PACKAGE UNIT',
  'ROOFTOP UNIT',
  'RTU',
  'MINI SPLIT',
  'MINI-SPLIT',
  'MINISPLIT',
];

// ============================================================
// MAIN ROUTER
// ============================================================

export async function handleAttomProspectSearch(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS headers for admin panel
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.ADMIN_AUTH_TOKEN}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    // POST /attom/prospect-search - create new job
    if (method === 'POST' && path === '/attom/prospect-search') {
      const body = await request.json();
      return await createJob(body, env, corsHeaders);
    }

    // GET /attom/prospect-search/:id - get job status
    const jobMatch = path.match(/^\/attom\/prospect-search\/([a-f0-9-]+)$/);
    if (method === 'GET' && jobMatch) {
      return await getJobStatus(jobMatch[1], env, corsHeaders);
    }

    // POST /attom/prospect-search/:id/run - process the job
    const runMatch = path.match(/^\/attom\/prospect-search\/([a-f0-9-]+)\/run$/);
    if (method === 'POST' && runMatch) {
      return await runJob(runMatch[1], env, corsHeaders);
    }

    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  } catch (err) {
    console.error('Worker error:', err);
    return jsonResponse(
      { error: err.message, stack: err.stack },
      500,
      corsHeaders
    );
  }
}

// ============================================================
// JOB CREATION
// ============================================================

async function createJob(params, env, corsHeaders) {
  // Validate input
  if (!params.zip_codes || !Array.isArray(params.zip_codes) || params.zip_codes.length === 0) {
    return jsonResponse({ error: 'zip_codes array required' }, 400, corsHeaders);
  }

  if (params.zip_codes.length > 10) {
    return jsonResponse(
      { error: 'Max 10 zip codes per job — break larger searches into multiple jobs' },
      400,
      corsHeaders
    );
  }

  // Sensible defaults
  const searchParams = {
    zip_codes: params.zip_codes,
    year_built_max: params.year_built_max ?? 2015,
    year_built_min: params.year_built_min ?? 1950,
    owner_occupied: params.owner_occupied ?? true,
    min_value: params.min_value ?? 300000,
    max_value: params.max_value ?? 1500000,
    min_sqft: params.min_sqft ?? 1200,
    max_sqft: params.max_sqft ?? 5000,
    exclude_hvac_permit_years: params.exclude_hvac_permit_years ?? 15,
    property_types: params.property_types ?? ['SFR'], // single family residential
  };

  // Create job in Supabase
  const job = await supabaseInsert(env, 'attom_jobs', {
    status: 'pending',
    stage: 'queued',
    user_id: params.user_id || null,
    client_id: params.client_id || null,
    search_params: searchParams,
  });

  // Kick off async processing — fire and forget
  // The admin panel polls job status to watch progress
  const runUrl = `${new URL(env.WORKER_URL || 'https://worker.upfrog.io').origin}/attom/prospect-search/${job.id}/run`;
  fetch(runUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.ADMIN_AUTH_TOKEN}` },
  }).catch(err => console.error('Failed to kick off job:', err));

  return jsonResponse(
    {
      job_id: job.id,
      status: 'pending',
      message: 'Job created. Poll GET /attom/prospect-search/:id for status.',
    },
    202,
    corsHeaders
  );
}

// ============================================================
// JOB STATUS
// ============================================================

async function getJobStatus(jobId, env, corsHeaders) {
  const job = await supabaseSelectOne(env, 'attom_jobs', { id: jobId });

  if (!job) {
    return jsonResponse({ error: 'Job not found' }, 404, corsHeaders);
  }

  // If complete, include result counts
  let preview = null;
  if (job.status === 'complete') {
    preview = await supabaseSelect(
      env,
      'attom_properties',
      { job_id: jobId, is_target: true },
      { limit: 10, order: 'target_score.desc' }
    );
  }

  return jsonResponse(
    {
      ...job,
      preview,
    },
    200,
    corsHeaders
  );
}

// ============================================================
// JOB RUNNER — the actual ATTOM work happens here
// ============================================================

async function runJob(jobId, env, corsHeaders) {
  const job = await supabaseSelectOne(env, 'attom_jobs', { id: jobId });
  if (!job) {
    return jsonResponse({ error: 'Job not found' }, 404, corsHeaders);
  }

  if (job.status !== 'pending') {
    return jsonResponse({ error: `Job already ${job.status}` }, 400, corsHeaders);
  }

  await supabaseUpdate(env, 'attom_jobs', jobId, {
    status: 'running',
    stage: 'properties',
  });

  try {
    // ============================================================
    // STAGE 1: Pull properties matching base filters
    // ============================================================
    const params = job.search_params;
    const allProperties = [];

    for (const zip of params.zip_codes) {
      const props = await fetchPropertiesByZip(zip, params, env);
      allProperties.push(...props);

      // Update progress
      await supabaseUpdate(env, 'attom_jobs', jobId, {
        total_properties: allProperties.length,
      });
    }

    // Insert properties into Supabase in batches
    await insertPropertiesBatch(env, jobId, allProperties);

    // ============================================================
    // STAGE 2: Permit enrichment
    // ============================================================
    await supabaseUpdate(env, 'attom_jobs', jobId, { stage: 'permits' });

    let processed = 0;
    for (const prop of allProperties) {
      const permits = await fetchPermitsForProperty(prop.attom_id, env);
      const permitAnalysis = analyzePermits(permits, params.exclude_hvac_permit_years);

      await supabaseUpdate(env, 'attom_properties', prop.id, {
        has_hvac_permit: permitAnalysis.has_hvac_permit,
        hvac_permit_count: permitAnalysis.hvac_permit_count,
        most_recent_hvac_permit_date: permitAnalysis.most_recent_hvac_permit_date,
        permit_history: permits,
      });

      processed++;
      if (processed % 25 === 0) {
        await supabaseUpdate(env, 'attom_jobs', jobId, {
          permits_checked: processed,
        });
      }
    }

    // ============================================================
    // STAGE 3: Filter & score
    // ============================================================
    await supabaseUpdate(env, 'attom_jobs', jobId, { stage: 'filtering' });

    let targetCount = 0;
    for (const prop of allProperties) {
      const score = calculateTargetScore(prop, params);
      const isTarget = score > 0; // score of 0 means filtered out

      await supabaseUpdate(env, 'attom_properties', prop.id, {
        target_score: score,
        is_target: isTarget,
      });

      if (isTarget) targetCount++;
    }

    // ============================================================
    // DONE
    // ============================================================
    await supabaseUpdate(env, 'attom_jobs', jobId, {
      status: 'complete',
      stage: 'done',
      targets_found: targetCount,
      completed_at: new Date().toISOString(),
    });

    return jsonResponse(
      { status: 'complete', targets_found: targetCount },
      200,
      corsHeaders
    );
  } catch (err) {
    await supabaseUpdate(env, 'attom_jobs', jobId, {
      status: 'failed',
      error_message: err.message,
    });
    throw err;
  }
}

// ============================================================
// ATTOM API CALLS
// ============================================================

/**
 * Stage 1: Pull all properties in a zip matching our filters.
 * Uses ATTOM's property snapshot endpoint with pagination.
 */
async function fetchPropertiesByZip(zip, params, env) {
  const properties = [];
  let page = 1;
  const pageSize = 100; // ATTOM max

  while (true) {
    const url = new URL(`${ATTOM_BASE_URL}/property/snapshot`);
    url.searchParams.set('postalcode', zip);
    url.searchParams.set('page', page);
    url.searchParams.set('pagesize', pageSize);
    url.searchParams.set('propertytype', 'SFR');
    url.searchParams.set('minyearbuilt', params.year_built_min);
    url.searchParams.set('maxyearbuilt', params.year_built_max);

    const res = await fetch(url, {
      headers: {
        apikey: env.ATTOM_API_KEY,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ATTOM property/snapshot failed for ${zip}: ${res.status} ${text}`);
    }

    const data = await res.json();
    const props = data.property || [];

    // Filter for owner-occupied + value range client-side
    // (ATTOM's snapshot endpoint doesn't always honor these as filters)
    for (const p of props) {
      const ownerOccupied = p.summary?.absenteeInd === 'OWNER OCCUPIED' ||
                            p.summary?.absenteeInd === 'O';
      const marketValue = p.assessment?.market?.mktTtlValue || p.avm?.amount?.value || 0;
      const sqft = p.building?.size?.universalsize || p.building?.size?.livingsize || 0;

      if (params.owner_occupied && !ownerOccupied) continue;
      if (marketValue < params.min_value || marketValue > params.max_value) continue;
      if (sqft < params.min_sqft || sqft > params.max_sqft) continue;

      properties.push(mapAttomProperty(p));
    }

    // Pagination check
    if (props.length < pageSize) break;
    page++;
    if (page > 50) break; // safety cap at 5000 props per zip
  }

  return properties;
}

/**
 * Stage 2: Get permit history for a single property.
 */
async function fetchPermitsForProperty(attomId, env) {
  const url = new URL(`${ATTOM_BASE_URL}/property/buildingpermits`);
  url.searchParams.set('attomid', attomId);

  const res = await fetch(url, {
    headers: {
      apikey: env.ATTOM_API_KEY,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    // Permit data missing is common — don't throw, just return empty
    if (res.status === 404) return [];
    console.warn(`Permit lookup failed for ${attomId}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.property?.[0]?.building?.permits || [];
}

/**
 * Map raw ATTOM property to our schema.
 */
function mapAttomProperty(p) {
  return {
    attom_id: p.identifier?.attomId,
    apn: p.identifier?.apn,
    fips: p.identifier?.fips,
    address_line1: p.address?.line1,
    city: p.address?.locality,
    state: p.address?.countrySubd,
    zip: p.address?.postal1,
    latitude: p.location?.latitude,
    longitude: p.location?.longitude,
    owner_name: p.owner?.owner1?.fullname || null,
    owner_occupied:
      p.summary?.absenteeInd === 'OWNER OCCUPIED' ||
      p.summary?.absenteeInd === 'O',
    ownership_start_date: p.sale?.saleTransDate || null,
    year_built: p.summary?.yearbuilt || p.building?.summary?.yearbuilteffective,
    square_feet: p.building?.size?.universalsize || p.building?.size?.livingsize,
    lot_size_sqft: p.lot?.lotsize2,
    bedrooms: p.building?.rooms?.beds,
    bathrooms: p.building?.rooms?.bathstotal,
    property_use: p.summary?.proptype,
    assessed_value: p.assessment?.assessed?.assdTtlValue,
    market_value: p.assessment?.market?.mktTtlValue || p.avm?.amount?.value,
    last_sale_date: p.sale?.saleTransDate,
    last_sale_price: p.sale?.saleAmountData?.saleAmt,
    raw_attom_data: p,
  };
}

// ============================================================
// PERMIT ANALYSIS
// ============================================================

function analyzePermits(permits, excludeYears) {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - excludeYears);

  let hasHvacPermit = false;
  let count = 0;
  let mostRecent = null;

  for (const permit of permits) {
    const description = (
      (permit.description || '') +
      ' ' +
      (permit.type || '') +
      ' ' +
      (permit.subType || '')
    ).toUpperCase();

    const isHvac = HVAC_PERMIT_KEYWORDS.some(kw => description.includes(kw));
    if (!isHvac) continue;

    const permitDate = new Date(permit.effectiveDate || permit.issueDate);
    if (isNaN(permitDate.getTime())) continue;

    count++;
    if (permitDate >= cutoffDate) hasHvacPermit = true;
    if (!mostRecent || permitDate > new Date(mostRecent)) {
      mostRecent = permit.effectiveDate || permit.issueDate;
    }
  }

  return {
    has_hvac_permit: hasHvacPermit,
    hvac_permit_count: count,
    most_recent_hvac_permit_date: mostRecent,
  };
}

// ============================================================
// SCORING
// ============================================================

/**
 * Score 0-100. Returns 0 if property fails any hard filter.
 *
 * Higher scores prioritize:
 *  - Long ownership tenure (likely original system)
 *  - Sweet spot home value ($400K-$900K in Vegas)
 *  - Sweet spot age (built 2000-2010 = aging builder-grade systems)
 *  - Moderate square footage (clean residential HVAC sizing)
 */
function calculateTargetScore(prop, params) {
  // HARD FILTER: had recent HVAC permit = not a target
  if (prop.has_hvac_permit) return 0;

  let score = 50; // base score

  // Ownership tenure — longer = more likely original system
  if (prop.ownership_start_date) {
    const yearsOwned =
      (Date.now() - new Date(prop.ownership_start_date).getTime()) /
      (1000 * 60 * 60 * 24 * 365);
    if (yearsOwned >= 8) score += 15;
    else if (yearsOwned >= 5) score += 10;
    else if (yearsOwned >= 3) score += 5;
  }

  // Year built sweet spot — 2000-2010 builder-grade systems failing now
  if (prop.year_built >= 2000 && prop.year_built <= 2010) score += 15;
  else if (prop.year_built >= 1990 && prop.year_built <= 1999) score += 10;
  else if (prop.year_built >= 2011 && prop.year_built <= 2015) score += 5;

  // Value sweet spot
  const value = prop.market_value || 0;
  if (value >= 400000 && value <= 900000) score += 10;
  else if (value >= 300000 && value < 400000) score += 5;

  // Square footage — standard residential HVAC sizing
  const sqft = prop.square_feet || 0;
  if (sqft >= 1800 && sqft <= 3500) score += 10;
  else if (sqft >= 1200 && sqft < 1800) score += 5;

  return Math.min(score, 100);
}

// ============================================================
// SUPABASE HELPERS
// ============================================================

async function supabaseInsert(env, table, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase insert failed: ${await res.text()}`);
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

async function insertPropertiesBatch(env, jobId, properties) {
  // Insert in batches of 50 to avoid request size limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    const batch = properties.slice(i, i + BATCH_SIZE).map(p => ({
      ...p,
      job_id: jobId,
    }));
    const inserted = await supabaseInsert(env, 'attom_properties', batch);
    // Stash the returned IDs back onto the original objects
    if (Array.isArray(inserted)) {
      for (let j = 0; j < inserted.length; j++) {
        properties[i + j].id = inserted[j].id;
      }
    }
  }
}

async function supabaseSelectOne(env, table, filters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    params.set(k, `eq.${v}`);
  }
  params.set('limit', '1');
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase select failed: ${await res.text()}`);
  const arr = await res.json();
  return arr[0] || null;
}

async function supabaseSelect(env, table, filters, options = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    params.set(k, `eq.${v}`);
  }
  if (options.limit) params.set('limit', options.limit);
  if (options.order) params.set('order', options.order);
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase select failed: ${await res.text()}`);
  return res.json();
}

async function supabaseUpdate(env, table, id, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase update failed: ${await res.text()}`);
}

// ============================================================
// UTILS
// ============================================================

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
