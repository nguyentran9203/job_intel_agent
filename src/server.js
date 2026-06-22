/**
 * server.js — Minimal Express API server for the dashboard
 *
 * Serves the computed aggregates and raw job data over HTTP.
 * The React dashboard (running at :5173) proxies /api/* to :3001.
 *
 * Usage:
 *   node src/server.js
 *
 * Run alongside the Vite dev server:
 *   Terminal 1: node src/server.js
 *   Terminal 2: cd dashboard && npm run dev
 */

import 'dotenv/config';
import http from 'http';
import { computeTrends } from './aggregate.js';
import { getAllJobs, getJobCount, getRecentRuns } from './db.js';

const PORT = parseInt(process.env.SERVER_PORT ?? '3001', 10);

// ── Cache trends for 60s so the dashboard can poll without hammering SQLite ──
let cachedTrends = null;
let cacheExpiry  = 0;

function getTrends() {
  if (cachedTrends && Date.now() < cacheExpiry) return cachedTrends;
  cachedTrends = computeTrends();
  cacheExpiry  = Date.now() + 60_000;
  return cachedTrends;
}

// ── Minimal router ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS for Vite dev server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (url.pathname === '/api/trends') {
      json(res, getTrends());
    } else if (url.pathname === '/api/jobs') {
      const page   = parseInt(url.searchParams.get('page')  ?? '1',  10);
      const limit  = parseInt(url.searchParams.get('limit') ?? '100', 10);
      const offset = (page - 1) * limit;
      json(res, getAllJobs({ limit, offset }));
    } else if (url.pathname === '/api/runs') {
      json(res, getRecentRuns(50));
    } else if (url.pathname === '/api/health') {
      json(res, { ok: true, jobs: getJobCount(), ts: new Date().toISOString() });
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    console.error('[server]', err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

server.listen(PORT, () => {
  console.log(`Job intel API running at http://localhost:${PORT}`);
  console.log(`  GET /api/trends  — aggregated market data`);
  console.log(`  GET /api/jobs    — raw job rows (?page=1&limit=100)`);
  console.log(`  GET /api/runs    — pipeline run history`);
  console.log(`  GET /api/health  — health check`);
});
