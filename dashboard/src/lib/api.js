/**
 * lib/api.js — Fetches aggregated trends from the backend API.
 *
 * The pipeline exposes a minimal Express server (server.js) at localhost:3001.
 * In development, Vite proxies /api/* to it.
 *
 * You can also run the dashboard against a static JSON export:
 *   node src/export.js > dashboard/public/trends.json
 * Then set VITE_USE_STATIC=true in dashboard/.env.local
 */

const USE_STATIC = import.meta.env.VITE_USE_STATIC === 'true';

export async function fetchTrends() {
  const url = USE_STATIC ? '/trends.json' : '/api/trends';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchJobs({ page = 1, limit = 50 } = {}) {
  const url = USE_STATIC
    ? '/trends.json'
    : `/api/jobs?page=${page}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return USE_STATIC ? data.recent_jobs ?? [] : data;
}

export async function fetchRuns() {
  if (USE_STATIC) return [];
  const res = await fetch('/api/runs');
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
