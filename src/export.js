/**
 * export.js — Export trends + recent jobs to a static JSON file
 *
 * Useful for deploying the dashboard as a static site (Netlify, Vercel, etc.)
 * without needing a running server.
 *
 * Usage:
 *   node src/export.js > dashboard/public/trends.json
 *
 * Then set VITE_USE_STATIC=true in dashboard/.env.local
 * and deploy the dashboard/dist folder after `npm run build`.
 */

import 'dotenv/config';
import { computeTrends } from './aggregate.js';
import { getAllJobs } from './db.js';

const trends    = computeTrends();
const recentJobs = getAllJobs({ limit: 500 });

const output = {
  ...trends,
  recent_jobs: recentJobs,
};

process.stdout.write(JSON.stringify(output, null, 2));
