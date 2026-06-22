/**
 * sources/lever.js — Lever postings API fetcher
 *
 * Lever has a public API for job postings that requires no authentication.
 * Per-company: https://api.lever.co/v0/postings/{slug}?mode=json
 *
 * Returns up to 100 postings. Lever doesn't include full descriptions
 * in the list endpoint, so we do a per-job detail fetch for the body.
 * We rate-limit these with a small delay to avoid hammering their API.
 */

import fetch from 'node-fetch';

const BASE = 'https://api.lever.co/v0/postings';
const DETAIL_DELAY_MS = 200; // delay between per-job detail fetches

/**
 * Fetch all current jobs from one Lever company board.
 *
 * @param {string} slug - Company slug, e.g. "pitch", "miro"
 * @returns {object[]} Normalised job objects
 */
export async function fetchLeverBoard(slug) {
  const url = `${BASE}/${slug}?mode=json&limit=100`;

  let listings;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'JobIntelAgent/1.0 (research tool)' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[lever] ${slug}: HTTP ${res.status}`);
      return [];
    }

    listings = await res.json();
  } catch (err) {
    console.error(`[lever] ${slug}: fetch failed —`, err.message);
    return [];
  }

  if (!Array.isArray(listings)) {
    console.warn(`[lever] ${slug}: unexpected response shape`);
    return [];
  }

  // Filter to engineering/tech roles before doing detail fetches
  const relevant = listings.filter((j) => isRelevant(j));
  console.log(`[lever] ${slug}: ${listings.length} total, ${relevant.length} relevant`);

  // Fetch details for each relevant job (includes full description)
  const jobs = [];
  for (const listing of relevant) {
    const detail = await fetchLeverDetail(slug, listing.id);
    jobs.push(normalise(slug, listing, detail));
    await sleep(DETAIL_DELAY_MS);
  }

  return jobs;
}

async function fetchLeverDetail(slug, jobId) {
  const url = `${BASE}/${slug}/${jobId}?mode=json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'JobIntelAgent/1.0 (research tool)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch from all configured Lever slugs.
 */
export async function fetchAllLever(slugs) {
  if (!slugs.length) return [];

  const results = [];
  for (const slug of slugs) {
    const jobs = await fetchLeverBoard(slug);
    results.push(...jobs);
  }
  return results;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalise(slug, listing, detail) {
  // Build description from available fields
  const bodyParts = [];
  const lists = detail?.lists ?? listing.lists ?? [];
  for (const section of lists) {
    if (section.text) bodyParts.push(`\n${section.text}:`);
    if (section.content) bodyParts.push(stripHtml(section.content));
  }
  if (detail?.additionalPlain ?? listing.additionalPlain) {
    bodyParts.push(detail?.additionalPlain ?? listing.additionalPlain);
  }

  return {
    source:          'lever',
    source_id:       listing.id,
    company:         titleCase(slug),
    title:           listing.text ?? null,
    url:             listing.hostedUrl ?? null,
    location:        listing.categories?.location ?? null,
    description_raw: bodyParts.join('\n').trim(),
    fetched_at:      new Date().toISOString(),
    skills:          [],
    stack:           [],
    seniority:       null,
    salary:          { min: null, max: null, currency: 'EUR' },
    work_mode:       null,
  };
}

function isRelevant(job) {
  const team = (job.categories?.team ?? '').toLowerCase();
  const title = (job.text ?? '').toLowerCase();
  const keywords = [
    'frontend', 'front-end', 'front end',
    'javascript', 'typescript', 'react', 'vue', 'angular',
    'web', 'ui engineer', 'software engineer', 'full-stack', 'fullstack',
    'design engineer', 'ux engineer',
  ];
  return keywords.some((kw) => team.includes(kw) || title.includes(kw));
}

function stripHtml(html) {
  return (html ?? '')
    .replace(/<li>/gi, '\n• ')
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
