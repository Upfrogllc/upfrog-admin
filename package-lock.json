# Upfrog Admin

White-label home services quoting agency admin panel.

## What this is

A React app that lets the Upfrog team manage contractor clients across all verticals (roofing, windows, garage doors, HVAC, siding, lawn). For each client you can:

- Set up their brand profile
- Connect their GHL location (webhook, calendar, location ID)
- Enable verticals and configure pricebooks via guided one-question-at-a-time UI
- Generate ready-to-paste GHL funnel HTML per vertical
- Download pricebook XLSX for the contractor

## Setup

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Deploy to Netlify

```bash
npm run build
# drag the dist/ folder into Netlify UI
# or: netlify deploy --dir=dist --prod
```

## Repo structure

```
src/
  App.jsx              Main app — all screens and routing
  data/
    verticals.js       Registry of all verticals + pricebook questions
  lib/
    store.js           localStorage persistence (swap for Supabase later)
    generateHTML.js    Builds GHL-ready funnel HTML per client+vertical
worker/
  worker-v8.js         Cloudflare Worker (upfrog-proxy)
funnel/
  roofiq-ghl.html      Consumer funnel template
```

## Adding a new vertical

1. Add an entry to `src/data/verticals.js` with:
   - `id`, `label`, `icon`, `status: 'live'`
   - `workerEndpoint` — which worker route handles analysis
   - `pricebookQuestions` — the guided setup questions
   - `ghlFields` — which custom fields to push to GHL
   - `defaultPricebook` — sensible defaults

2. Add the analysis handler to the Cloudflare Worker

That's it — the admin UI picks it up automatically.

## Upgrading from localStorage to Supabase

Replace the functions in `src/lib/store.js`:
- `load()` → `supabase.from('clients').select('*')`
- `save()` → `supabase.from('clients').upsert(...)`

All component code stays the same.
