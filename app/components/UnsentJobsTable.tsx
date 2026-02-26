'use client'

import { useState, useMemo } from 'react'
import type { UnsentJobsData } from '@/lib/unsentJobs'

interface Props { data: UnsentJobsData }

const MACRO_BADGE: Record<string, string> = {
  backlog: 'bg-blue-900/40 text-blue-300',
  cad: 'bg-purple-900/40 text-purple-300',
  blocked: 'bg-red-900/40 text-red-300',
  completed: 'bg-green-900/40 text-green-300',
  to_submit: 'bg-orange-900/40 text-orange-300',
  submitted: 'bg-cyan-900/40 text-cyan-300',
  invoiced: 'bg-emerald-900/40 text-emerald-300',
}

type SortKey = 'hours' | 'firstEntry' | 'lastEntry' | 'macro_status'

export default function UnsentJobsTable({ data }: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('hours')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [hideCompleted, setHideCompleted] = useState(false)

  const visible = useMemo(() => {
    let rows = data.jobs
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (j) => j.fullNumber.toLowerCase().includes(q) || j.description.toLowerCase().includes(q)
      )
    }
    if (hideCompleted) {
      rows = rows.filter((j) => j.macro_status !== 'completed' && j.macro_status !== 'invoiced')
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [data.jobs, search, sortKey, sortDir, hideCompleted])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span> : null

  if (data.totalJobs === 0) {
    return <p className="text-zinc-500 text-sm py-4 text-center">All billed jobs have been submitted to permit.</p>
  }

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-4">
        {data.totalJobs} jobs · {data.totalHours}h total — structured job codes where Jovani logged
        hours but JMendoza has no "To Permit" transition in the system
      </p>

      {/* Controls */}
      <div className="print:hidden flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Search job # or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-800 border border-zinc-600 text-zinc-300 text-xs rounded px-3 py-1.5 w-56 placeholder-zinc-600"
        />
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
            className="accent-emerald-500"
          />
          Hide completed / invoiced
        </label>
        <span className="text-xs text-zinc-600 ml-auto">{visible.length} showing</span>
      </div>

      {/* Table */}
      <div className="print-full-height overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-900 z-10">
            <tr className="text-zinc-400 text-left">
              <th className="pb-2 pr-4 font-medium">Job</th>
              <th className="pb-2 pr-4 font-medium">Description</th>
              <th
                className="pb-2 pr-4 font-medium cursor-pointer hover:text-zinc-200"
                onClick={() => toggleSort('macro_status')}
              >Status <SortArrow k="macro_status" /></th>
              <th
                className="pb-2 pr-4 font-medium cursor-pointer hover:text-zinc-200 text-right"
                onClick={() => toggleSort('hours')}
              >Hours <SortArrow k="hours" /></th>
              <th
                className="pb-2 pr-4 font-medium cursor-pointer hover:text-zinc-200"
                onClick={() => toggleSort('firstEntry')}
              >First Entry <SortArrow k="firstEntry" /></th>
              <th
                className="pb-2 font-medium cursor-pointer hover:text-zinc-200"
                onClick={() => toggleSort('lastEntry')}
              >Last Entry <SortArrow k="lastEntry" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {visible.map((j) => (
              <tr
                key={j.fullNumber}
                className={`hover:bg-zinc-800/50 ${j.rush ? 'border-l-2 border-orange-500' : ''}`}
              >
                <td className="py-2 pr-4 font-mono font-semibold text-emerald-300 whitespace-nowrap">
                  {j.fullNumber}
                  {j.rush && <span className="ml-1 text-orange-400">⚡</span>}
                </td>
                <td className="py-2 pr-4 text-zinc-300 max-w-xs truncate" title={j.description}>
                  {j.description || <span className="text-zinc-600">—</span>}
                </td>
                <td className="py-2 pr-4">
                  {j.macro_status ? (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${MACRO_BADGE[j.macro_status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                      {j.status_name || j.macro_status}
                    </span>
                  ) : <span className="text-zinc-600">—</span>}
                </td>
                <td className="py-2 pr-4 text-right text-zinc-200 font-semibold whitespace-nowrap">{j.hours}h</td>
                <td className="py-2 pr-4 text-zinc-400 whitespace-nowrap">{j.firstEntry}</td>
                <td className="py-2 text-zinc-400 whitespace-nowrap">{j.lastEntry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
