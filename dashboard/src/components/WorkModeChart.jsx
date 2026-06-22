/**
 * components/WorkModeChart.jsx
 * Pie chart showing remote / hybrid / onsite split.
 */

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = { remote: '#059669', hybrid: '#0891b2', onsite: '#d97706' };
const LABELS  = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Onsite' };

export function WorkModeChart({ split = [] }) {
  const data = split.map((s) => ({
    name:  LABELS[s.mode] ?? s.mode,
    value: s.pct,
    count: s.count,
    color: COLORS[s.mode] ?? '#94a3b8',
  }));

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            label={({ name, value }) => `${name} ${value}%`}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _, props) => [
              `${value}% (${props.payload.count} jobs)`,
              props.payload.name,
            ]}
            contentStyle={{ fontSize: 13, borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
