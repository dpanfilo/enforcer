'use client'

import { useState } from 'react'
import type { Flag, FraudReport } from '@/lib/fraudAnalysis'

interface Props {
  report: FraudReport
}

const SEVERITY_STYLE: Record<string, string> = {
  high: 'bg-red-900/40 text-red-300 border-red-700',
  medium: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  low: 'bg-zinc-800 text-zinc-300 border-zinc-600',
}

const SEVERITY_BADGE: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border border-red-500/40',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
  low: 'bg-zinc-700 text-zinc-400 border border-zinc-600',
}

const CATEGORIES = [
  'All',
  'Duplicate Entry',
  'Overlapping Entries',
  'Hours Mismatch',
  'Future Date',
  'Zero Hours With Time',
  'Extremely Long Day',
  'Long Work Streak',
  'Identical Daily Hours',
  'Unusual Hours',
  'Weekend Work',
  'High Admin Day',
  'Excessive Prep Work',
  'Driving Billed',
  'Admin Code Fragmentation',
  'Unrecognized Job Code',
  'Hours on Closed Unbilled Jobs',
]

export default function FraudReport({ report }: Props) {
  const { flags, summary } = report
  const [filter, setFilter] = useState<string>('All')
  const [severityFilter, setSeverityFilter] = useState<string>('All')

  const visible = flags.filter((f) => {
    if (filter !== 'All' && f.category !== filter) return false
    if (severityFilter !== 'All' && f.severity !== severityFilter) return false
    return true
  })

  return (
    <div>
      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-red-900/30 border border-red-700/40">
          <span className="text-red-400 font-bold text-lg">{summary.high}</span>
          <span className="text-red-300 text-xs">High Risk</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-yellow-900/30 border border-yellow-700/40">
          <span className="text-yellow-400 font-bold text-lg">{summary.medium}</span>
          <span className="text-yellow-300 text-xs">Medium Risk</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-zinc-800 border border-zinc-600">
          <span className="text-zinc-300 font-bold text-lg">{summary.low}</span>
          <span className="text-zinc-400 text-xs">Low / Info</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-zinc-800 border border-zinc-600">
          <span className="text-white font-bold text-lg">{summary.weekendDays}</span>
          <span className="text-zinc-400 text-xs">Weekend Days</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-zinc-800 border border-zinc-600">
          <span className="text-white font-bold text-lg">{summary.longestStreak}</span>
          <span className="text-zinc-400 text-xs">Longest Streak</span>
        </div>
        {summary.duplicates > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-red-900/30 border border-red-700/40">
            <span className="text-red-400 font-bold text-lg">{summary.duplicates}</span>
            <span className="text-red-300 text-xs">Duplicates</span>
          </div>
        )}
        {summary.overlaps > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-red-900/30 border border-red-700/40">
            <span className="text-red-400 font-bold text-lg">{summary.overlaps}</span>
            <span className="text-red-300 text-xs">Overlaps</span>
          </div>
        )}
        {summary.mismatches > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-yellow-900/30 border border-yellow-700/40">
            <span className="text-yellow-400 font-bold text-lg">{summary.mismatches}</span>
            <span className="text-yellow-300 text-xs">Hour Mismatches</span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-yellow-900/30 border border-yellow-700/40">
          <span className="text-yellow-400 font-bold text-lg">{summary.adminPct}%</span>
          <span className="text-yellow-300 text-xs">Admin Hours ({summary.adminHours.toFixed(0)}h)</span>
        </div>
        {summary.unbilledClosedHours > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-yellow-900/30 border border-yellow-700/40">
            <span className="text-yellow-400 font-bold text-lg">{summary.unbilledClosedHours.toFixed(0)}h</span>
            <span className="text-yellow-300 text-xs">On Closed Unbilled Jobs</span>
          </div>
        )}
        {summary.unrecognizedCodes.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-red-900/30 border border-red-700/40">
            <span className="text-red-400 font-bold text-lg">{summary.unrecognizedCodes.length}</span>
            <span className="text-red-300 text-xs">Unknown Job Code{summary.unrecognizedCodes.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['All', 'high', 'medium', 'low'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              severityFilter === s
                ? s === 'high' ? 'bg-red-600 text-white border-red-500'
                  : s === 'medium' ? 'bg-yellow-600 text-white border-yellow-500'
                  : s === 'low' ? 'bg-zinc-500 text-white border-zinc-400'
                  : 'bg-white text-black border-white'
                : 'bg-transparent text-zinc-400 border-zinc-600 hover:border-zinc-400'
            }`}
          >
            {s === 'All' ? 'All Severity' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="text-zinc-600 text-xs self-center mx-1">|</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-600 text-zinc-300 text-xs rounded px-2 py-1"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Flag count */}
      <p className="text-xs text-zinc-500 mb-3">{visible.length} finding{visible.length !== 1 ? 's' : ''}</p>

      {/* Flag list */}
      {visible.length === 0 ? (
        <p className="text-zinc-500 text-sm py-4 text-center">No findings match the current filter.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
          {visible.map((flag, i) => (
            <div
              key={i}
              className={`rounded-lg border px-4 py-3 flex gap-3 items-start ${SEVERITY_STYLE[flag.severity]}`}
            >
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_BADGE[flag.severity]}`}>
                    {flag.severity.toUpperCase()}
                  </span>
                  <span className="text-xs font-medium opacity-80">{flag.category}</span>
                  <span className="text-xs font-mono opacity-60 ml-auto">{flag.date}</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90 mt-0.5">{flag.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
