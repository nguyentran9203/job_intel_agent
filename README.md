# EU Frontend Job Market Intelligence Agent

Tracks job postings from Greenhouse, Lever, and Arbeitnow daily. Extracts structured data via Claude API, stores in SQLite/Supabase, and surfaces skill frequency, salary ranges, work mode splits, and tech stack trends.

## Project structure

```
job-intel-agent/
├── src/
│   ├── pipeline.js         # Main orchestrator (run this daily)
│   ├── sources/
│   │   ├── greenhouse.js   # Greenhouse boards API fetcher
│   │   ├── lever.js        # Lever postings API fetcher
│   │   └── arbeitnow.js    # Arbeitnow aggregator fetcher
│   ├── extract.js          # Claude LLM extraction
│   ├── db.js               # SQLite database layer
│   ├── aggregate.js        # Trend computation
│   └── email.js            # Optional daily digest
├── dashboard/              # React dashboard
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── SkillsChart.jsx
│   │   │   ├── SalaryChart.jsx
│   │   │   ├── WorkModeChart.jsx
│   │   │   ├── StackTrends.jsx
│   │   │   ├── VolumeChart.jsx
│   │   │   └── JobsTable.jsx
│   │   ├── hooks/
│   │   │   └── useJobData.js
│   │   └── lib/
│   │       └── api.js
│   └── package.json
├── scripts/
│   └── cron.sh             # Cron setup helper
├── .env.example
├── package.json
└── README.md
```

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your ANTHROPIC_API_KEY
# Optionally add company slugs for Greenhouse/Lever
```

### 3. Run the pipeline once

```bash
node src/pipeline.js
```

### 4. Set up daily cron (8 AM UTC)

```bash
bash scripts/cron.sh
```

### 5. Launch the dashboard

```bash
cd dashboard && npm install && npm run dev
```

Open http://localhost:5173

## Sources

| Source | API | Auth | Notes |
|--------|-----|------|-------|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | None | Per-company. Add slugs to `.env` |
| Lever | `api.lever.co/v0/postings/{slug}?mode=json` | None | Per-company. Add slugs to `.env` |
| Arbeitnow | `arbeitnow.com/api/job-board-api` | None | EU-focused aggregator, no config needed |

## Adding more companies

In `.env`:
```
GREENHOUSE_SLUGS=intercom,hubspot,deliveryhero,zalando
LEVER_SLUGS=pitch,miro,remote,typeform
```

## Cost estimate

- ~$0.002 per job extracted (Claude Sonnet 4.6)
- 30 new jobs/day = ~$0.06/day = ~$1.80/month
- After the corpus stabilises, new jobs/day drops as dedup kicks in

## Database schema

Two tables in `jobs.db` (SQLite):

**jobs**
- `id` TEXT PRIMARY KEY (source_source_id)
- `source` TEXT (greenhouse | lever | arbeitnow)
- `source_id` TEXT
- `company` TEXT
- `title` TEXT
- `url` TEXT
- `description_raw` TEXT
- `skills` TEXT (JSON array)
- `seniority` TEXT
- `salary_min` INTEGER
- `salary_max` INTEGER
- `salary_currency` TEXT
- `stack` TEXT (JSON array)
- `work_mode` TEXT
- `location` TEXT
- `fetched_at` TEXT (ISO timestamp)

**runs**
- `id` INTEGER PRIMARY KEY
- `started_at` TEXT
- `finished_at` TEXT
- `new_jobs` INTEGER
- `total_jobs` INTEGER
- `sources_fetched` TEXT (JSON)
- `errors` TEXT (JSON)
