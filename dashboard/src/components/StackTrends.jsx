/**
 * components/StackTrends.jsx
 * Bar chart of primary tech stack frequency.
 */

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts';

const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#7c3aed',
                 '#dc2626','#0d9488','#b45309','#6d28d9','#0369a1'];

export function StackTrends({ stack = [] }) {
  const data = stack.slice(0, 12).map((s) => ({ name: s.name, pct: s.pct, count: s.count }));

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 0, right: 10, left: -10, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#374151' }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(value, _, props) => [
              `${value}% of jobs (${props.payload.count} postings)`,
              props.payload.name,
            ]}
            contentStyle={{ fontSize: 13, borderRadius: 8 }}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
