/**
 * components/JobsTable.jsx
 * Table of raw collected jobs with filter controls.
 */

import React, { useState, useMemo } from 'react';

const SEN_COLORS = {
  junior: { bg: '#d1fae5', color: '#065f46' },
  mid:    { bg: '#dbeafe', color: '#1e40af' },
  senior: { bg: '#fef3c7', color: '#92400e' },
};

const WM_COLORS = {
  remote:  { bg: '#d1fae5', color: '#065f46' },
  hybrid:  { bg: '#dbeafe', color: '#1e40af' },
  onsite:  { bg: '#fef3c7', color: '#92400e' },
};

export function JobsTable({ jobs = [] }) {
  const [search,    setSearch]    = useState('');
  const [seniority, setSeniority] = useState('all');
  const [workMode,  setWorkMode]  = useState('all');
  const [source,    setSource]    = useState('all');

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (seniority !== 'all' && j.seniority !== seniority) return false;
      if (workMode  !== 'all' && j.work_mode  !== workMode)  return false;
      if (source    !== 'all' && j.source     !== source)    return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (j.title   ?? '').toLowerCase().includes(q) ||
          (j.company ?? '').toLowerCase().includes(q) ||
          (j.skills  ?? []).some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [jobs, search, seniority, workMode, source]);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search title, company, skill..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <Select value={seniority} onChange={setSeniority} options={['all','junior','mid','senior']} label="Seniority" />
        <Select value={workMode}  onChange={setWorkMode}  options={['all','remote','hybrid','onsite']} label="Work mode" />
        <Select value={source}    onChange={setSource}    options={['all','greenhouse','lever','arbeitnow']} label="Source" />
        <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>
          {filtered.length} of {jobs.length} jobs
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['Company','Title','Seniority','Work mode','Salary','Skills','Source'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((j) => (
              <tr key={j.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{j.company ?? '—'}</td>
                <td style={tdStyle}>
                  {j.url
                    ? <a href={j.url} target="_blank" rel="noopener" style={{ color: '#4f46e5', textDecoration: 'none' }}>{j.title}</a>
                    : j.title ?? '—'}
                </td>
                <td style={tdStyle}>
                  {j.seniority && (
                    <Badge label={j.seniority} colors={SEN_COLORS[j.seniority] ?? {}} />
                  )}
                </td>
                <td style={tdStyle}>
                  {j.work_mode && (
                    <Badge label={j.work_mode} colors={WM_COLORS[j.work_mode] ?? {}} />
                  )}
                </td>
                <td style={tdStyle}>
                  {j.salary?.min
                    ? `€${Math.round(j.salary.min/1000)}k–€${Math.round(j.salary.max/1000)}k`
                    : '—'}
                </td>
                <td style={{ ...tdStyle, maxWidth: 200 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {(j.skills ?? []).slice(0, 5).map((s) => (
                      <span key={s} style={skillChipStyle}>{s}</span>
                    ))}
                  </div>
                </td>
                <td style={{ ...tdStyle, color: '#9ca3af' }}>{j.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <p style={{ color: '#9ca3af', fontSize: 12, padding: '8px 0' }}>
            Showing first 100 of {filtered.length} results. Use filters to narrow down.
          </p>
        )}
      </div>
    </div>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, width: 130 }}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o === 'all' ? `All ${label.toLowerCase()}s` : o}</option>
      ))}
    </select>
  );
}

function Badge({ label, colors }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 500,
      background: colors.bg ?? '#f3f4f6',
      color:      colors.color ?? '#374151',
    }}>
      {label}
    </span>
  );
}

const inputStyle = {
  padding:      '6px 10px',
  borderRadius: 8,
  border:       '1px solid #e5e7eb',
  fontSize:     13,
  background:   '#fff',
  color:        '#111',
  outline:      'none',
};

const thStyle = {
  textAlign:     'left',
  padding:       '8px 12px 8px 0',
  fontSize:      11,
  fontWeight:    500,
  color:         '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace:    'nowrap',
};

const tdStyle = {
  padding:    '10px 12px 10px 0',
  color:      '#374151',
  verticalAlign: 'top',
};

const skillChipStyle = {
  padding:      '1px 7px',
  borderRadius: 10,
  fontSize:     11,
  background:   '#f3f4f6',
  color:        '#4b5563',
  border:       '1px solid #e5e7eb',
};
