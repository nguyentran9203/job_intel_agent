/**
 * hooks/useJobData.js
 * Loads trends, jobs, and run history from the API.
 * Refreshes every 60 seconds.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchTrends, fetchJobs, fetchRuns } from '../lib/api.js';

export function useJobData() {
  const [trends, setTrends]   = useState(null);
  const [jobs, setJobs]       = useState([]);
  const [runs, setRuns]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, j, r] = await Promise.all([fetchTrends(), fetchJobs(), fetchRuns()]);
      setTrends(t);
      setJobs(j);
      setRuns(r);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  return { trends, jobs, runs, loading, error, lastRefresh, reload: load };
}
