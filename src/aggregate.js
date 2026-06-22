/**
 * aggregate.js — Compute market trends from stored jobs
 *
 * All functions return plain objects ready to be serialised to JSON
 * and served to the dashboard via the /api/trends endpoint.
 */

import {
  getSkillFrequency,
  getStackFrequency,
  getWorkModeSplit,
  getSalaryBySeniority,
  getVolumeOverTime,
  getJobCount,
} from './db.js';

/**
 * Compute all aggregates in one shot.
 * Called after each pipeline run and on dashboard load.
 *
 * @returns {object} Full trends payload
 */
export function computeTrends() {
  const totalJobs = getJobCount();
  if (totalJobs === 0) return emptyTrends();

  return {
    total_jobs:       totalJobs,
    top_skills:       topSkills(20),
    stack_trends:     topStack(15),
    work_mode_split:  workModeSplit(totalJobs),
    salary_ranges:    salaryRanges(),
    volume_over_time: volumeOverTime(),
    generated_at:     new Date().toISOString(),
  };
}

// ── Individual aggregates ─────────────────────────────────────────────────────

function topSkills(n) {
  const totalJobs = getJobCount();
  const freq = getSkillFrequency();

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([skill, count]) => ({
      skill,
      count,
      pct: Math.round((count / totalJobs) * 100),
    }));
}

function topStack(n) {
  const totalJobs = getJobCount();
  const freq = getStackFrequency();

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / totalJobs) * 100),
    }));
}

function workModeSplit(totalJobs) {
  const rows = getWorkModeSplit();
  return rows.map((r) => ({
    mode:  r.work_mode,
    count: r.count,
    pct:   Math.round((r.count / totalJobs) * 100),
  }));
}

function salaryRanges() {
  const rows = getSalaryBySeniority();
  return rows.map((r) => ({
    seniority: r.seniority,
    count:     r.count,
    avg_min:   r.avg_min,
    avg_max:   r.avg_max,
    abs_min:   r.abs_min,
    abs_max:   r.abs_max,
  }));
}

function volumeOverTime() {
  return getVolumeOverTime();
}

function emptyTrends() {
  return {
    total_jobs:       0,
    top_skills:       [],
    stack_trends:     [],
    work_mode_split:  [],
    salary_ranges:    [],
    volume_over_time: [],
    generated_at:     new Date().toISOString(),
  };
}
