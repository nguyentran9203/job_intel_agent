/**
 * db.js — SQLite database layer
 *
 * All reads and writes go through here. Uses better-sqlite3
 * for synchronous API (simpler than async sqlite3 for a pipeline).
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../jobs.db');

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id              TEXT PRIMARY KEY,
      source          TEXT NOT NULL,
      source_id       TEXT NOT NULL,
      company         TEXT,
      title           TEXT,
      url             TEXT,
      description_raw TEXT,
      skills          TEXT DEFAULT '[]',
      seniority       TEXT,
      salary_min      INTEGER,
      salary_max      INTEGER,
      salary_currency TEXT DEFAULT 'EUR',
      stack           TEXT DEFAULT '[]',
      work_mode       TEXT,
      location        TEXT,
      fetched_at      TEXT NOT NULL,
      UNIQUE(source, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_source     ON jobs(source);
    CREATE INDEX IF NOT EXISTS idx_jobs_fetched_at ON jobs(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_seniority  ON jobs(seniority);
    CREATE INDEX IF NOT EXISTS idx_jobs_work_mode  ON jobs(work_mode);

    CREATE TABLE IF NOT EXISTS runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at      TEXT NOT NULL,
      finished_at     TEXT,
      new_jobs        INTEGER DEFAULT 0,
      total_jobs      INTEGER DEFAULT 0,
      sources_fetched TEXT DEFAULT '{}',
      errors          TEXT DEFAULT '[]'
    );
  `);
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

/**
 * Returns all (source, source_id) pairs we've already seen.
 * Used for fast dedup without loading full rows.
 */
export function getSeenIds() {
  const db = getDb();
  const rows = db.prepare('SELECT source, source_id FROM jobs').all();
  const seen = new Set();
  for (const row of rows) {
    seen.add(`${row.source}::${row.source_id}`);
  }
  return seen;
}

/**
 * Insert a batch of extracted jobs. Ignores conflicts (already-seen IDs).
 * Returns the number of rows actually inserted.
 */
export function insertJobs(jobs) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO jobs
      (id, source, source_id, company, title, url, description_raw,
       skills, seniority, salary_min, salary_max, salary_currency,
       stack, work_mode, location, fetched_at)
    VALUES
      (@id, @source, @source_id, @company, @title, @url, @description_raw,
       @skills, @seniority, @salary_min, @salary_max, @salary_currency,
       @stack, @work_mode, @location, @fetched_at)
  `);

  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    for (const row of rows) {
      const info = stmt.run({
        id:              `${row.source}::${row.source_id}`,
        source:          row.source,
        source_id:       row.source_id,
        company:         row.company ?? null,
        title:           row.title ?? null,
        url:             row.url ?? null,
        description_raw: row.description_raw ?? null,
        skills:          JSON.stringify(row.skills ?? []),
        seniority:       row.seniority ?? null,
        salary_min:      row.salary?.min ?? null,
        salary_max:      row.salary?.max ?? null,
        salary_currency: row.salary?.currency ?? 'EUR',
        stack:           JSON.stringify(row.stack ?? []),
        work_mode:       row.work_mode ?? null,
        location:        row.location ?? null,
        fetched_at:      row.fetched_at ?? new Date().toISOString(),
      });
      if (info.changes > 0) inserted++;
    }
    return inserted;
  });

  return insertMany(jobs);
}

/**
 * All jobs, newest first. Parses JSON columns back to arrays.
 */
export function getAllJobs({ limit = 1000, offset = 0 } = {}) {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM jobs ORDER BY fetched_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
  return rows.map(parseJobRow);
}

export function getJobCount() {
  return getDb().prepare('SELECT COUNT(*) as n FROM jobs').get().n;
}

// ── Aggregates ────────────────────────────────────────────────────────────────

/**
 * Returns skill frequency map: { React: 42, TypeScript: 39, ... }
 * Computed in JS from all stored skill arrays.
 */
export function getSkillFrequency() {
  const db = getDb();
  const rows = db.prepare('SELECT skills FROM jobs').all();
  const freq = {};
  for (const row of rows) {
    const skills = JSON.parse(row.skills ?? '[]');
    for (const s of skills) {
      const key = s.trim();
      if (key) freq[key] = (freq[key] ?? 0) + 1;
    }
  }
  return freq;
}

export function getStackFrequency() {
  const db = getDb();
  const rows = db.prepare('SELECT stack FROM jobs').all();
  const freq = {};
  for (const row of rows) {
    const stack = JSON.parse(row.stack ?? '[]');
    for (const s of stack) {
      const key = s.trim();
      if (key) freq[key] = (freq[key] ?? 0) + 1;
    }
  }
  return freq;
}

export function getWorkModeSplit() {
  const db = getDb();
  return db
    .prepare(`
      SELECT work_mode, COUNT(*) as count
      FROM jobs
      WHERE work_mode IS NOT NULL
      GROUP BY work_mode
    `)
    .all();
}

export function getSalaryBySeniority() {
  const db = getDb();
  return db
    .prepare(`
      SELECT
        seniority,
        COUNT(*) as count,
        ROUND(AVG(salary_min)) as avg_min,
        ROUND(AVG(salary_max)) as avg_max,
        MIN(salary_min) as abs_min,
        MAX(salary_max) as abs_max
      FROM jobs
      WHERE salary_min IS NOT NULL
        AND salary_max IS NOT NULL
        AND seniority IS NOT NULL
      GROUP BY seniority
    `)
    .all();
}

export function getVolumeOverTime() {
  const db = getDb();
  return db
    .prepare(`
      SELECT
        DATE(fetched_at) as date,
        COUNT(*) as count
      FROM jobs
      GROUP BY DATE(fetched_at)
      ORDER BY date ASC
    `)
    .all();
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export function startRun() {
  const db = getDb();
  const info = db
    .prepare(`INSERT INTO runs (started_at) VALUES (?)`)
    .run(new Date().toISOString());
  return info.lastInsertRowid;
}

export function finishRun(runId, { newJobs, totalJobs, sourcesFetched, errors }) {
  getDb()
    .prepare(`
      UPDATE runs SET
        finished_at     = ?,
        new_jobs        = ?,
        total_jobs      = ?,
        sources_fetched = ?,
        errors          = ?
      WHERE id = ?
    `)
    .run(
      new Date().toISOString(),
      newJobs,
      totalJobs,
      JSON.stringify(sourcesFetched),
      JSON.stringify(errors),
      runId,
    );
}

export function getRecentRuns(n = 30) {
  return getDb()
    .prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?')
    .all(n)
    .map((r) => ({
      ...r,
      sources_fetched: JSON.parse(r.sources_fetched ?? '{}'),
      errors: JSON.parse(r.errors ?? '[]'),
    }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJobRow(row) {
  return {
    ...row,
    skills: JSON.parse(row.skills ?? '[]'),
    stack: JSON.parse(row.stack ?? '[]'),
    salary: row.salary_min != null
      ? { min: row.salary_min, max: row.salary_max, currency: row.salary_currency }
      : null,
  };
}
