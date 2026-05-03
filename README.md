# DDU Business Dashboard

A personal weekly business dashboard. Replaces the original Excel sheet with a web app that stores everything in your browser's localStorage — no database, no login, no server.

Tabs:
- **Overview** — KPIs across revenue, leads, socials, email
- **Revenue** — monthly goal/actual/costs/profit, product mix, financial planning
- **Leads** — kanban pipeline, table, follow-up tracking, analytics. Imported from ClickUp CSV.
- **Socials** — weekly entry for engagement, leads, clients & fans across IG / LinkedIn / Twitter / YouTube
- **Emails** — monthly subscribers and per-email opens / clicks / unsubs / revenue

## Tech

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Recharts
- Persistence: **Upstash Redis** via a Next.js Route Handler. Same data on every device.
- Backup: Export / Import JSON buttons in the header.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploy to Vercel

1. Create a new GitHub repo and push this folder to it.
2. In Vercel: **New Project → Import the repo**.
3. Add these env vars under **Settings → Environment Variables**:

   | Name | Value |
   |---|---|
   | `UPSTASH_REDIS_REST_URL` | from Upstash console → your DB → REST API tab |
   | `UPSTASH_REDIS_REST_TOKEN` | same place |

4. Click **Deploy**.

For local dev, copy `.env.local.example` → `.env.local` and fill in the same two values.

## How data is stored

Everything lives in **Upstash Redis** under the single key `dashboard:state`. The Next.js Route Handler at `/api/state` reads on page load (`GET`) and writes on every change (`PUT`, debounced 500 ms after the last edit).

If you ever want a snapshot, click **Export** in the header — it downloads the current state as JSON. **Import** restores from a JSON file (writes through to Redis like any other edit).

## Importing historical data from the Excel sheet

A converter script is included at [scripts/excel_to_json.py](scripts/excel_to_json.py).

```bash
pip3 install --user openpyxl
python3 scripts/excel_to_json.py
```

It reads `Business dashboard 2026 DDU.xlsx` from the project root and writes `dashboard-import.json`. Then in the running app, click **Import** in the header and pick that file — all weekly socials, finance, and email rows are loaded.

## Importing leads from ClickUp

Two ways:

**a) Drop the CSV directly into the app.** Go to the **Leads** tab → click **Import leads** → pick `clickup export.csv`. The dashboard parses it in-browser, dedupes by Task ID, and merges with anything you've already added.

**b) Convert to JSON first, then import** (useful if you want to inspect the file before importing):
```bash
python3 scripts/clickup_to_json.py
# writes leads-import.json
```
Then in **Leads → Import leads**, pick `leads-import.json`.

The mapping used:
- ClickUp `Closed` → **Won**
- ClickUp `lost` → **Lost**
- `check in later`, `proposal sent`, `negotiating` → kept as-is
- Custom fields captured: Deal Value, Probability %, Deal Source, Contact Name, Email, Phone, Performance model, Service/Product labels, Due Date (next follow-up), Date Done (closed date), Latest Comment (notes).

After importing once, manage everything inside the dashboard — add/edit leads, drag between stages, set follow-up dates. Your local store is the source of truth.

## Importing email campaigns from ActiveCampaign

In ActiveCampaign, go to **Reports → Campaigns → Performance Report** and export as CSV (the file looks like `Campaign performance ytd.csv`).

Then in the dashboard, **Emails** tab → **Import campaigns** → select the CSV. Campaigns are deduped by date + subject, so re-running every Monday only adds new campaigns and updates rates on existing ones. Any `revenue` you've manually entered in the dashboard is preserved.

The mapping:

| AC column | Dashboard field |
|---|---|
| Subject | `name` |
| Sent Date | `date` |
| Open Rate | `openPct` (÷100) |
| Click Rate | `clickPct` (÷100) |
| Unsubscribes | `unsubs` |

Subscriber counts aren't in this report — keep entering those manually under **Subscribers per month**.

## Customising metrics

- Social metrics & default targets: `lib/types.ts` (`SOCIAL_METRICS`).
- Active channels & seed defaults: `lib/defaults.ts`.
- Number formatting / aggregation rules: `lib/calc.ts`.
