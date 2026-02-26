'use client'

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { PermitWeek } from '@/lib/permitData'

interface Props {
  data: PermitWeek[]
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getQuarter(weekKey: string): string {
  const [y, m] = weekKey.split('-').map(Number)
  const q = Math.ceil(m / 3)
  return `Q${q} ${y}`
}

function getMonthLabel(weekKey: string): string {
  const [y, m] = weekKey.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

interface TooltipPayload {
  payload?: PermitWeek
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d) return null
  return (
    <div className="rounded-lg border border-zinc-700 p-3 text-xs" style={{ backgroundColor: '#1a1d27' }}>
      <p className="font-semibold text-white mb-1">Week of {d.week}</p>
      <p className="text-emerald-400 font-semibold">
        {d.jobs} job{d.jobs !== 1 ? 's' : ''} sent to permit
      </p>
      {d.jobs > 0 && <p className="text-zinc-400 mt-1">Click to see job list</p>}
    </div>
  )
}

export default function PermitWeeklyChart({ data }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('All')

  // Build filter options from data
  const filterOptions = useMemo(() => {
    const quarters = new Set<string>()
    const months = new Set<string>()
    for (const w of data) {
      quarters.add(getQuarter(w.weekKey))
      months.add(getMonthLabel(w.weekKey))
    }
    return {
      quarters: [...quarters].sort(),
      months: [...months].sort((a, b) => {
        // sort by year then month
        const parse = (s: string) => {
          const [mon, yr] = s.split(' ')
          return Number(yr) * 12 + MONTHS.indexOf(mon)
        }
        return parse(a) - parse(b)
      }),
    }
  }, [data])

  const filtered = useMemo(() => {
    if (filter === 'All') return data
    // quarter match
    if (filter.startsWith('Q')) return data.filter((w) => getQuarter(w.weekKey) === filter)
    // month match
    return data.filter((w) => getMonthLabel(w.weekKey) === filter)
  }, [data, filter])

  const weeklyAvg = useMemo(() => {
    const active = filtered.filter((d) => d.jobs > 0)
    if (!active.length) return 0
    return Math.round((active.reduce((s, d) => s + d.jobs, 0) / active.length) * 10) / 10
  }, [filtered])

  const selectedWeek = data.find((w) => w.weekKey === selectedKey) ?? null

  function handleBarClick(entry: PermitWeek) {
    if (entry.jobs === 0) return
    setSelectedKey(entry.weekKey === selectedKey ? null : entry.weekKey)
  }

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">
        Unique jobs moved to "To Permit" per week · Nov 4 bulk migration excluded
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(['All', ...filterOptions.quarters, ...filterOptions.months] as string[]).map((opt) => (
          <button
            key={opt}
            onClick={() => { setFilter(opt); setSelectedKey(null) }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === opt
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-transparent text-zinc-400 border-zinc-600 hover:border-zinc-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={filtered}
          margin={{ top: 4, right: 48, left: -8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            interval={0}
            angle={-40}
            textAnchor="end"
            height={48}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={weeklyAvg}
            stroke="#6b7280"
            strokeDasharray="4 4"
            label={{ value: `avg ${weeklyAvg}`, fill: '#6b7280', fontSize: 10, position: 'right' }}
          />
          <Bar dataKey="jobs" radius={[3, 3, 0, 0]} onClick={(entry: unknown) => handleBarClick(entry as PermitWeek)} style={{ cursor: 'pointer' }}>
            {filtered.map((d, i) => {
              const isSelected = d.weekKey === selectedKey
              const base = d.jobs === 0 ? '#2a2d3a' : d.jobs >= 25 ? '#22c55e' : '#10b981'
              return (
                <Cell
                  key={i}
                  fill={isSelected ? '#facc15' : base}
                  opacity={selectedKey && !isSelected && d.jobs > 0 ? 0.4 : 1}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Job list panel */}
      {selectedWeek && selectedWeek.jobs > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-700 p-4" style={{ backgroundColor: '#13151f' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">
              Week of {selectedWeek.week} —{' '}
              <span className="text-emerald-400">{selectedWeek.jobs} job{selectedWeek.jobs !== 1 ? 's' : ''}</span>
            </p>
            <button
              onClick={() => setSelectedKey(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕ close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {selectedWeek.jobList.map((j) => (
              <div key={j.fullNumber} className="rounded px-3 py-2 bg-zinc-800/60 border border-zinc-700/50">
                <p className="text-xs font-mono font-semibold text-emerald-300">{j.fullNumber}</p>
                {j.description && (
                  <p className="text-xs text-zinc-400 mt-0.5 leading-tight truncate" title={j.description}>
                    {j.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
