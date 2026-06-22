/**
 * sources/greenhouse.js — Greenhouse boards API fetcher
 *
 * Greenhouse has a public API for job boards that requires no authentication.
 * Per-company: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 *
 * The ?content=true param includes the full job description in the listing
 * response, saving us a second per-job fetch.
 */

import fetch from 'node-fetch';

const BASE = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * Fetch all current jobs from one Greenhouse company board.
 *
 * @param {string} slug - Company slug, e.g. "intercom", "hubspot"
 * @returns {object[]} Normalised job objects
 */
export async function fetchGreenhouseBoard(slug) {
  const url = `${BASE}/${slug}/jobs?content=true`;

  let data;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'JobIntelAgent/1.0 (research tool)' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[greenhouse] ${slug}: HTTP ${res.status}`);
      return [];
    }

    data = await res.json();
  } catch (err) {
    console.error(`[greenhouse] ${slug}: fetch failed —`, err.message);
    return [];
  }

  const jobs = data.jobs ?? [];
  console.log(`[greenhouse] ${slug}: ${jobs.length} jobs`);

  return jobs.map((j) => normalise(slug, j));
}

/**
 * Fetch from all configured Greenhouse slugs.
 *
 * @param {string[]} slugs - Array of company slugs
 * @returns {object[]} All jobs, normalised
 */
export async function fetchAllGreenhouse(slugs) {
  if (!slugs.length) return [];

  const results = await Promise.all(slugs.map(fetchGreenhouseBoard));
  return results.flat();
}

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalise(slug, j) {
  // Strip HTML tags from description
  const descRaw = stripHtml(j.content ?? '');

  return {
    source:          'greenhouse',
    source_id:       String(j.id),
    company:         j.company?.name ?? titleCase(slug),
    title:           j.title ?? null,
    url:             j.absolute_url ?? null,
    location:        j.location?.name ?? null,
    description_raw: descRaw,
    fetched_at:      new Date().toISOString(),
    // Fields below are populated by extract.js
    skills:          [],
    stack:           [],
    seniority:       null,
    salary:          { min: null, max: null, currency: 'EUR' },
    work_mode:       null,
  };
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function titleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
