/**
 * pipeline.js — Main orchestrator
 *
 * Run this daily (via cron, GitHub Actions, etc.) to:
 * 1. Fetch new postings from all sources
 * 2. Deduplicate against already-processed jobs
 * 3. Extract structured data via Claude API
 * 4. Store to SQLite
 * 5. Log a summary
 *
 * Usage:
 *   node src/pipeline.js
 */

import 'dotenv/config'; // Load .env automatically
import { fetchAllGreenhouse } from './sources/greenhouse.js';
import { fetchAllLever }      from './sources/lever.js';
import { fetchArbeitnow }     from './sources/arbeitnow.js';
import { extractBatch }       from './extract.js';
import { getSeenIds, insertJobs, getJobCount, startRun, finishRun } from './db.js';
import { computeTrends }      from './aggregate.js';
import { sendDailyDigest }    from './email.js';

// ── Config ────────────────────────────────────────────────────────────────────

const GREENHOUSE_SLUGS = (process.env.GREENHOUSE_SLUGS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const LEVER_SLUGS = (process.env.LEVER_SLUGS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY ?? '3', 10);
const MAX_JOBS_PER_RUN = parseInt(process.env.MAX_JOBS_PER_RUN ?? '50', 10);
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now();
  const runId = startRun();
  const errors = [];
  const sourcesFetched = {};

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EU Frontend Job Intel — pipeline starting');
  console.log(`Run ID: ${runId} | ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ── 1. Fetch from all sources ────────────────────────────────────────────────

  const allFetched = [];

  if (GREENHOUSE_SLUGS.length) {
    console.log(`\n[source] Greenhouse — ${GREENHOUSE_SLUGS.length} boards`);
    try {
      const jobs = await fetchAllGreenhouse(GREENHOUSE_SLUGS);
      allFetched.push(...jobs);
      sourcesFetched.greenhouse = jobs.length;
    } catch (err) {
      console.error('[source] Greenhouse error:', err.message);
      errors.push({ source: 'greenhouse', error: err.message });
    }
  } else {
    console.log('[source] Greenhouse: no slugs configured (see .env)');
  }

  if (LEVER_SLUGS.length) {
    console.log(`\n[source] Lever — ${LEVER_SLUGS.length} boards`);
    try {
      const jobs = await fetchAllLever(LEVER_SLUGS);
      allFetched.push(...jobs);
      sourcesFetched.lever = jobs.length;
    } catch (err) {
      console.error('[source] Lever error:', err.message);
      errors.push({ source: 'lever', error: err.message });
    }
  } else {
    console.log('[source] Lever: no slugs configured (see .env)');
  }

  console.log('\n[source] Arbeitnow');
  try {
    const jobs = await fetchArbeitnow();
    allFetched.push(...jobs);
    sourcesFetched.arbeitnow = jobs.length;
  } catch (err) {
    console.error('[source] Arbeitnow error:', err.message);
    errors.push({ source: 'arbeitnow', error: err.message });
  }

  console.log(`\n[fetch] Total fetched: ${allFetched.length} jobs`);

  // ── 2. Deduplicate ───────────────────────────────────────────────────────────

  const seenIds = getSeenIds();
  const newJobs = allFetched.filter(
    (j) => !seenIds.has(`${j.source}::${j.source_id}`)
  );

  console.log(
    `[dedup] ${seenIds.size} already seen — ${newJobs.length} new jobs to process`
  );

  if (newJobs.length === 0) {
    console.log('[dedup] Nothing new. Exiting.\n');
    finishRun(runId, { newJobs: 0, totalJobs: getJobCount(), sourcesFetched, errors });
    return;
  }

  // Safety cap
  const batch = newJobs.slice(0, MAX_JOBS_PER_RUN);
  if (batch.length < newJobs.length) {
    console.log(`[safety] Capped at ${MAX_JOBS_PER_RUN} jobs this run (${newJobs.length - batch.length} deferred)`);
  }

  // ── 3. LLM extraction ────────────────────────────────────────────────────────

  console.log(`\n[extract] Extracting structured data from ${batch.length} jobs (concurrency=${LLM_CONCURRENCY})`);
  const extracted = await extractBatch(batch, LLM_CONCURRENCY);

  const succeeded = extracted.filter((j) => !j.extraction_failed);
  const failed = extracted.filter((j) => j.extraction_failed);
  console.log(`[extract] Done — ${succeeded.length} succeeded, ${failed.length} failed`);

  // ── 4. Store ─────────────────────────────────────────────────────────────────

  const inserted = insertJobs(succeeded);
  const totalJobs = getJobCount();
  console.log(`[db] Inserted ${inserted} rows. Total corpus: ${totalJobs} jobs`);

  // ── 5. Aggregates + summary ──────────────────────────────────────────────────

  const trends = computeTrends();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Run complete in ${elapsed}s`);
  console.log(`New jobs: ${inserted} | Total: ${totalJobs}`);
  if (trends.top_skills.length) {
    console.log('Top 5 skills: ' + trends.top_skills.slice(0, 5).map((s) => `${s.skill} (${s.pct}%)`).join(', '));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  finishRun(runId, { newJobs: inserted, totalJobs, sourcesFetched, errors });

  // ── 6. Email digest (optional) ───────────────────────────────────────────────

  if (EMAIL_ENABLED && inserted > 0) {
    try {
      await sendDailyDigest(trends, inserted);
      console.log('[email] Daily digest sent');
    } catch (err) {
      console.error('[email] Failed to send digest:', err.message);
    }
  }
}

run().catch((err) => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
