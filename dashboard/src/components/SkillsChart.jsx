/**
 * components/SkillsChart.jsx
 * Horizontal bar chart of top N skills by frequency.
 */

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts';

const COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#0d9488', '#b45309',
];

export function SkillsChart({ skills = [] }) {
  const data = skills
    .slice(0, 20)
    .map((s) => ({ name: s.skill, pct: s.pct, count: s.count }))
    .reverse(); // recharts renders bottom-to-top for horizontal

  return (
    <div style={{ width: '100%', height: Math.max(data.length * 36 + 40, 200) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 12, fill: '#374151' }}
          />
          <Tooltip
            formatter={(value, _, props) => [
              `${value}% of jobs (${props.payload.count} postings)`,
              'Frequency',
            ]}
            contentStyle={{ fontSize: 13, borderRadius: 8 }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
