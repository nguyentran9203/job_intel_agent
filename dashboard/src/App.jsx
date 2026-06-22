/**
 * App.jsx — Root dashboard component
 *
 * Tabs: Overview | Jobs | Pipeline runs
 */

import React, { useState } from 'react';
import { useJobData }      from './hooks/useJobData.js';
import { SkillsChart }     from './components/SkillsChart.jsx';
import { WorkModeChart }   from './components/WorkModeChart.jsx';
import { SalaryChart }     from './components/SalaryChart.jsx';
import { StackTrends }     from './components/StackTrends.jsx';
import { VolumeChart }     from './components/VolumeChart.jsx';
import { JobsTable }       from './components/JobsTable.jsx';

const TABS = ['Overview', 'Raw jobs', 'Pipeline runs'];

export default function App() {
  const [tab, setTab] = useState('Overview');
  const { trends, jobs, runs, loading, error, lastRefresh, reload } = useJobData();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>EU Frontend job market</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '3px 0 0' }}>
            Greenhouse · Lever · Arbeitnow — aggregated daily via Claude
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={reload} style={btnStyle}>↺ Refresh</button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#b91c1c' }}>
          ⚠ {error} — is the pipeline server running? (<code>node src/server.js</code>)
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: '#9ca3af', fontSize: 14, padding: '48px 0', textAlign: 'center' }}>
          Loading…
        </div>
      )}

      {!loading && trends && (
        <>
          {/* Metrics strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <MetricCard label="Total jobs" value={trends.total_jobs?.toLocaleString() ?? 0} sub="in corpus" />
            <MetricCard label="Skills tracked" value={trends.top_skills?.length ?? 0} sub="unique skills" />
            <MetricCard label="Top skill" value={trends.top_skills?.[0]?.skill ?? '—'} sub={`${trends.top_skills?.[0]?.pct ?? 0}% of jobs`} />
            <MetricCard label="Remote share" value={`${trends.work_mode_split?.find(m => m.mode === 'remote')?.pct ?? 0}%`} sub="of collected jobs" />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding:      '8px 16px',
                  border:       'none',
                  background:   'none',
                  cursor:       'pointer',
                  fontSize:     14,
                  fontWeight:   tab === t ? 600 : 400,
                  color:        tab === t ? '#111' : '#6b7280',
                  borderBottom: tab === t ? '2px solid #111' : '2px solid transparent',
                  marginBottom: -1,
                  fontFamily:   'inherit',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {tab === 'Overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Top row */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
                <Card title="Top 20 skills by frequency">
                  <SkillsChart skills={trends.top_skills} />
                </Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <Card title="Work mode split">
                    <WorkModeChart split={trends.work_mode_split} />
                  </Card>
                </div>
              </div>

              {/* Bottom row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                <Card title="Salary by seniority">
                  <SalaryChart ranges={trends.salary_ranges} />
                </Card>
                <Card title="Tech stack trends">
                  <StackTrends stack={trends.stack_trends} />
                </Card>
                <Card title="Job volume over time">
                  <VolumeChart volume={trends.volume_over_time} />
                </Card>
              </div>
            </div>
          )}

          {/* Raw jobs tab */}
          {tab === 'Raw jobs' && (
            <Card title={`All collected jobs (${jobs.length})`}>
              <JobsTable jobs={jobs} />
            </Card>
          )}

          {/* Pipeline runs tab */}
          {tab === 'Pipeline runs' && (
            <Card title="Pipeline run history">
              {runs.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>No runs recorded yet.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      {['Run','Started','Duration','New jobs','Total','Sources','Errors'].map((h) => (
                        <th key={h} style={{ textAlign:'left',padding:'8px 12px 8px 0',fontSize:11,fontWeight:500,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => {
                      const start = new Date(r.started_at);
                      const end   = r.finished_at ? new Date(r.finished_at) : null;
                      const dur   = end ? `${((end - start) / 1000).toFixed(0)}s` : '…';
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={runTd}>#{r.id}</td>
                          <td style={runTd}>{start.toLocaleString()}</td>
                          <td style={runTd}>{dur}</td>
                          <td style={runTd}>{r.new_jobs}</td>
                          <td style={runTd}>{r.total_jobs}</td>
                          <td style={runTd}>
                            {Object.entries(r.sources_fetched ?? {}).map(([s, n]) => `${s}:${n}`).join(', ') || '—'}
                          </td>
                          <td style={{ ...runTd, color: r.errors?.length ? '#dc2626' : '#9ca3af' }}>
                            {r.errors?.length ? r.errors.length : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
      <h2 style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

const btnStyle = {
  padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};

const runTd = { padding: '10px 12px 10px 0', color: '#374151', verticalAlign: 'top', fontSize: 13 };
