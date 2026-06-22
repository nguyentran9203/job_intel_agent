/**
 * sources/arbeitnow.js — Arbeitnow job board aggregator
 *
 * Arbeitnow is an EU-focused job board with a free public API.
 * No authentication required. Returns paginated results.
 *
 * API: https://www.arbeitnow.com/api/job-board-api
 * Docs: https://www.arbeitnow.com/blog/job-board-api
 *
 * We filter client-side to frontend/web engineering roles since
 * the API doesn't support category filtering for the free tier.
 */

import fetch from 'node-fetch';

const BASE = 'https://www.arbeitnow.com/api/job-board-api';
const MAX_PAGES = 5; // Each page has 25 results → up to 125 jobs

/**
 * Fetch relevant EU frontend jobs from Arbeitnow.
 *
 * @returns {object[]} Normalised job objects
 */
export async function fetchArbeitnow() {
  const allJobs = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${BASE}?page=${page}`;

    let data;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'JobIntelAgent/1.0 (research tool)' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.warn(`[arbeitnow] page ${page}: HTTP ${res.status}`);
        break;
      }

      data = await res.json();
    } catch (err) {
      console.error(`[arbeitnow] page ${page}: fetch failed —`, err.message);
      break;
    }

    const jobs = data.data ?? [];
    if (!jobs.length) break; // No more pages

    const relevant = jobs.filter(isRelevant);
    allJobs.push(...relevant.map(normalise));

    // If this page had fewer jobs than expected, we're done
    if (jobs.length < 25) break;
  }

  console.log(`[arbeitnow] ${allJobs.length} relevant jobs`);
  return allJobs;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalise(j) {
  const descRaw = [
    j.description ?? '',
    // Tags sometimes contain stack hints
    j.tags?.length ? `\nTech: ${j.tags.join(', ')}` : '',
  ].join('\n').trim();

  // Arbeitnow slugs are like "senior-frontend-engineer-at-company-12345"
  // Extract a stable ID from the slug
  const source_id = j.slug ?? j.url?.split('/').pop() ?? String(Math.random());

  return {
    source:          'arbeitnow',
    source_id,
    company:         j.company_name ?? null,
    title:           j.title ?? null,
    url:             j.url ?? null,
    location:        buildLocation(j),
    description_raw: stripHtml(descRaw),
    fetched_at:      new Date().toISOString(),
    skills:          [],
    stack:           [],
    seniority:       null,
    salary:          { min: null, max: null, currency: 'EUR' },
    work_mode:       j.remote ? 'remote' : null, // Arbeitnow has a remote flag
  };
}

function buildLocation(j) {
  if (j.location) return j.location;
  if (j.remote) return 'Remote, EU';
  return null;
}

function isRelevant(j) {
  const title = (j.title ?? '').toLowerCase();
  const desc  = (j.description ?? '').toLowerCase();
  const tags  = (j.tags ?? []).map((t) => t.toLowerCase()).join(' ');

  const positiveKeywords = [
    'frontend', 'front-end', 'front end',
    'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt',
    'javascript', 'typescript',
    'ui engineer', 'web engineer', 'design engineer', 'ux engineer',
  ];

  const negativeKeywords = [
    'backend', 'back-end', 'devops', 'data engineer',
    'machine learning', 'android', 'ios', 'mobile',
    'sales', 'marketing', 'account', 'recruiter',
  ];

  const combined = `${title} ${tags}`;

  const hasPositive = positiveKeywords.some((kw) => combined.includes(kw));
  const hasNegative = negativeKeywords.some((kw) => title.includes(kw));

  return hasPositive && !hasNegative;
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
