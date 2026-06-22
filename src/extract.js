/**
 * extract.js — LLM-powered structured data extraction
 *
 * Takes raw job description text and returns clean structured data:
 * skills, seniority, salary, tech stack, work mode, location.
 *
 * Uses Claude claude-sonnet-4-6 via the Anthropic SDK.
 * One API call per new job posting.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a job data extraction agent specialising in software engineering roles.

Given a job posting (title + description), return ONLY valid JSON — no prose, no markdown fences, no explanation. Use exactly this shape:

{
  "skills": ["React", "TypeScript", ...],
  "seniority": "junior" | "mid" | "senior",
  "salary": { "min": null | number, "max": null | number, "currency": "EUR" | "GBP" | "USD" | "SEK" | "DKK" | "PLN" | "CZK" },
  "stack": ["Next.js", "Node.js", ...],
  "work_mode": "remote" | "hybrid" | "onsite",
  "location": "City, Country"
}

Rules:
- skills: every specific technology, framework, language, or tool mentioned. Include soft tools like Figma, Storybook, Docker.
- stack: the PRIMARY frameworks/languages only (max 5). Choose the ones the role actually revolves around.
- seniority: infer from job title and any mentioned years of experience. "Lead" and "Staff" count as senior.
- salary: extract the numeric range if mentioned. Convert to annual if given monthly (multiply by 12). Default currency EUR if not stated. Set min/max to null if not mentioned.
- work_mode: infer from "fully remote", "hybrid", "in-office", "on-site", etc. Default to "hybrid" if unclear but an office location is given. Default to "remote" if no office mentioned.
- location: the city and country where the role is based, or "Remote, EU" for fully remote EU roles.

Never add extra keys. Never wrap in markdown.`;

/**
 * Extract structured data from a single job posting.
 *
 * @param {object} job - Raw job object with title and description_raw
 * @returns {object} Extracted fields merged into the job object
 */
export async function extractJob(job) {
  const prompt = `Title: ${job.title ?? 'Unknown'}
Company: ${job.company ?? 'Unknown'}

Description:
${truncate(job.description_raw ?? '', 4000)}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const extracted = parseJson(text);
    if (!extracted) {
      console.warn(`[extract] Failed to parse JSON for job ${job.source_id}`);
      return { ...job, extraction_failed: true };
    }

    return {
      ...job,
      skills:    Array.isArray(extracted.skills)   ? extracted.skills   : [],
      seniority: extracted.seniority ?? null,
      salary:    extracted.salary    ?? { min: null, max: null, currency: 'EUR' },
      stack:     Array.isArray(extracted.stack)    ? extracted.stack    : [],
      work_mode: extracted.work_mode ?? null,
      location:  extracted.location  ?? job.location ?? null,
    };
  } catch (err) {
    console.error(`[extract] API error for job ${job.source_id}:`, err.message);
    return { ...job, extraction_failed: true };
  }
}

/**
 * Extract a batch of jobs with controlled concurrency.
 * Logs progress as it goes.
 *
 * @param {object[]} jobs - Array of raw job objects
 * @param {number}   concurrency - Max parallel API calls (default 3)
 * @returns {object[]} Array of extracted job objects
 */
export async function extractBatch(jobs, concurrency = 3) {
  const results = [];
  const queue = [...jobs];
  let done = 0;

  async function worker() {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      const result = await extractJob(job);
      results.push(result);
      done++;
      console.log(
        `[extract] ${done}/${jobs.length} — ${job.company ?? '?'}: "${job.title ?? '?'}"` +
        (result.extraction_failed ? ' ⚠ failed' : ` → ${result.seniority}, ${result.work_mode}`)
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker())
  );

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(str, maxChars) {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '\n[truncated]';
}

function parseJson(text) {
  const clean = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Try to extract a JSON object substring
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}
