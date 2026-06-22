/**
 * components/SalaryChart.jsx
 * Range bar chart showing avg salary min/max by seniority level.
 */

import React from 'react';

const COLORS = { junior: '#059669', mid: '#0891b2', senior: '#d97706' };
const ORDER  = ['junior', 'mid', 'senior'];
const ABS_MAX = 180_000;

export function SalaryChart({ ranges = [] }) {
  const sorted = [...ranges].sort(
    (a, b) => ORDER.indexOf(a.seniority) - ORDER.indexOf(b.seniority)
  );

  if (!sorted.length) {
    return (
      <p style={{ color: '#9ca3af', fontSize: 13, padding: '1rem 0' }}>
        No salary data yet — accumulates as jobs with listed salaries are processed.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sorted.map((r) => {
        const color  = COLORS[r.seniority] ?? '#94a3b8';
        const left   = (r.avg_min / ABS_MAX) * 100;
        const width  = ((r.avg_max - r.avg_min) / ABS_MAX) * 100;

        return (
          <div key={r.seniority}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>
                {r.seniority}
              </span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                €{Math.round(r.avg_min / 1000)}k – €{Math.round(r.avg_max / 1000)}k / yr
                <span style={{ marginLeft: 8, color: '#9ca3af' }}>({r.count} jobs)</span>
              </span>
            </div>
            <div style={{
              position: 'relative', background: '#f3f4f6',
              borderRadius: 6, height: 16, overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                left:     `${left}%`,
                width:    `${width}%`,
                height:   '100%',
                background: `${color}33`,
                border:   `1.5px solid ${color}`,
                borderRadius: 6,
              }} />
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {[0, 45, 90, 135, 180].map((v) => (
          <span key={v} style={{ fontSize: 11, color: '#9ca3af' }}>€{v}k</span>
        ))}
      </div>
    </div>
  );
}
