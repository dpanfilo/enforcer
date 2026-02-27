import { supabase } from './supabase'
import { ADMIN_CODES } from './hoursData'

const NCP_RE = /^NCP-\d{2}-\d{3,5}$/
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isFinite(n) ? n : 0
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slash) {
    let [, m, d, y] = slash
    if (y.length === 2) y = parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return s
}

function monthKey(date: string): string {
  return date.slice(0, 7) // YYYY-MM
}

function quarterKey(date: string): string {
  const [y, m] = date.split('-').map(Number)
  return `Q${Math.ceil(m / 3)} ${y}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

export interface EmployeeDraftingMisc {
  name: string
  draftingHours: number
  miscHours: number
  ncpJobCount: number
  avgDraftingPerJob: number
  avgMiscPerJob: number
}

export interface PeriodBreakdown {
  period: string
  draftingHours: number
  miscHours: number
  ncpJobCount: number
  avgDraftingPerJob: number
  avgMiscPerJob: number
}

export interface DraftingMiscData {
  employees: EmployeeDraftingMisc[]
  totalDrafting: number
  totalMisc: number
  uniqueNcpJobs: number
  avgDraftingPerJob: number
  avgMiscPerJob: number
  miscRatio: number
  miscPerDraftingHour: number
  monthly: PeriodBreakdown[]
  quarterly: PeriodBreakdown[]
}

function buildPeriods(
  allRows: { date: string; job: string | null; h: number }[]
): { monthly: PeriodBreakdown[]; quarterly: PeriodBreakdown[] } {
  // Group by month and quarter
  const byMonth  = new Map<string, { drafting: number; misc: number; jobs: Set<string> }>()
  const byQuarter = new Map<string, { drafting: number; misc: number; jobs: Set<string> }>()

  for (const { date, job, h } of allRows) {
    if (!job || !date) continue
    const mk = monthKey(date)
    const qk = quarterKey(date)

    if (!byMonth.has(mk))   byMonth.set(mk,   { drafting: 0, misc: 0, jobs: new Set() })
    if (!byQuarter.has(qk)) byQuarter.set(qk, { drafting: 0, misc: 0, jobs: new Set() })

    if (NCP_RE.test(job)) {
      byMonth.get(mk)!.drafting   += h
      byMonth.get(mk)!.jobs.add(job)
      byQuarter.get(qk)!.drafting += h
      byQuarter.get(qk)!.jobs.add(job)
    } else if (ADMIN_CODES.has(job)) {
      byMonth.get(mk)!.misc   += h
      byQuarter.get(qk)!.misc += h
    }
  }

  const toPeriodRow = (period: string, v: { drafting: number; misc: number; jobs: Set<string> }): PeriodBreakdown => {
    const d = Math.round(v.drafting * 100) / 100
    const m = Math.round(v.misc     * 100) / 100
    const c = v.jobs.size
    return {
      period,
      draftingHours:    d,
      miscHours:        m,
      ncpJobCount:      c,
      avgDraftingPerJob: c > 0 ? Math.round((d / c) * 100) / 100 : 0,
      avgMiscPerJob:     c > 0 ? Math.round((m / c) * 100) / 100 : 0,
    }
  }

  const monthly = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mk, v]) => toPeriodRow(monthLabel(mk), v))

  // Sort quarters chronologically: Q1 2025, Q2 2025 ...
  const quarterly = [...byQuarter.entries()]
    .sort(([a], [b]) => {
      const parse = (s: string) => { const [q, y] = s.split(' '); return Number(y) * 4 + Number(q[1]) }
      return parse(a) - parse(b)
    })
    .map(([qk, v]) => toPeriodRow(qk, v))

  return { monthly, quarterly }
}

export async function fetchDraftingMisc(employeeNames: string[]): Promise<DraftingMiscData> {
  // Fetch all rows (with date) for all employees in parallel
  const allEmployeeRows = await Promise.all(
    employeeNames.map(async (name) => {
      const rows: { date: string; job: string | null; straight_hours: number | string | null; premium_hours: number | string | null }[] = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from('hours_import')
          .select('date,job,straight_hours,premium_hours')
          .eq('employee_name', name)
          .range(offset, offset + 999)
        if (error || !data || data.length === 0) break
        rows.push(...(data as typeof rows))
        if (data.length < 1000) break
      }
      return { name, rows }
    })
  )

  // Team-wide unique NCP jobs
  const teamNcpJobs = new Set<string>()
  for (const { rows } of allEmployeeRows) {
    for (const row of rows) {
      if (row.job && NCP_RE.test(row.job)) teamNcpJobs.add(row.job)
    }
  }

  // Per-employee overall breakdown
  const employees: EmployeeDraftingMisc[] = allEmployeeRows.map(({ name, rows }) => {
    let draftingHours = 0
    let miscHours = 0
    const empNcpJobs = new Set<string>()

    for (const row of rows) {
      const h = toNum(row.straight_hours) + toNum(row.premium_hours)
      if (!row.job) continue
      if (NCP_RE.test(row.job)) {
        draftingHours += h
        empNcpJobs.add(row.job)
      } else if (ADMIN_CODES.has(row.job)) {
        miscHours += h
      }
    }

    const jobCount = empNcpJobs.size
    return {
      name,
      draftingHours: Math.round(draftingHours * 100) / 100,
      miscHours:     Math.round(miscHours     * 100) / 100,
      ncpJobCount:   jobCount,
      avgDraftingPerJob: jobCount > 0 ? Math.round((draftingHours / jobCount) * 100) / 100 : 0,
      avgMiscPerJob:     jobCount > 0 ? Math.round((miscHours     / jobCount) * 100) / 100 : 0,
    }
  })

  // Flatten all rows for period grouping
  const flatRows = allEmployeeRows.flatMap(({ rows }) =>
    rows.map((r) => ({
      date: normalizeDate(r.date),
      job:  r.job,
      h:    toNum(r.straight_hours) + toNum(r.premium_hours),
    }))
  )

  const { monthly, quarterly } = buildPeriods(flatRows)

  const totalDrafting = Math.round(employees.reduce((s, e) => s + e.draftingHours, 0) * 100) / 100
  const totalMisc     = Math.round(employees.reduce((s, e) => s + e.miscHours,     0) * 100) / 100
  const uniqueNcpJobs = teamNcpJobs.size
  const combined      = totalDrafting + totalMisc

  return {
    employees,
    totalDrafting,
    totalMisc,
    uniqueNcpJobs,
    avgDraftingPerJob:   uniqueNcpJobs > 0 ? Math.round((totalDrafting / uniqueNcpJobs) * 100) / 100 : 0,
    avgMiscPerJob:       uniqueNcpJobs > 0 ? Math.round((totalMisc     / uniqueNcpJobs) * 100) / 100 : 0,
    miscRatio:           combined > 0 ? Math.round((totalMisc / combined) * 1000) / 10 : 0,
    miscPerDraftingHour: totalDrafting > 0 ? Math.round((totalMisc / totalDrafting) * 1000) / 1000 : 0,
    monthly,
    quarterly,
  }
}
