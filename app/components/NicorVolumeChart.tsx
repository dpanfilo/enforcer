'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

interface Props {
  data: { label: string; received: number; permitOpened: number; closed: number }[]
}

export default function NicorVolumeChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#9ca3af' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="received"     name="Received"      fill="#6366f1" radius={[3,3,0,0]} />
        <Bar dataKey="permitOpened" name="Permit Opened" fill="#10b981" radius={[3,3,0,0]} />
        <Bar dataKey="closed"       name="Closed"        fill="#f59e0b" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
