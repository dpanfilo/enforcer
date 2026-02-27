import { supabase } from './supabase'
import { ADMIN_CODES } from './hoursData'

const NCP_RE = /^NCP-\d{2}-\d{3,5}$/

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isFinite(n) ? n : 0
}

export interface EmployeeDraftingMisc {
  name: string
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
  uniqueNcpJobs: number       // unique NCP job codes across the whole team
  avgDraftingPerJob: number   // total team drafting / unique NCP jobs
  avgMiscPerJob: number       // total team misc / unique NCP jobs
  miscRatio: number           // misc as % of (drafting + misc)
  miscPerDraftingHour: number // misc hours per 1 drafting hour
}

export async function fetchDraftingMisc(employeeNames: string[]): Promise<DraftingMiscData> {
  // Fetch all rows for all employees in parallel
  const allEmployeeRows = await Promise.all(
    employeeNames.map(async (name) => {
      const rows: { job: string | null; straight_hours: number | string | null; premium_hours: number | string | null }[] = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from('hours_import')
          .select('job,straight_hours,premium_hours')
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

  // Per-employee breakdown
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
      miscHours: Math.round(miscHours * 100) / 100,
      ncpJobCount: jobCount,
      avgDraftingPerJob: jobCount > 0 ? Math.round((draftingHours / jobCount) * 100) / 100 : 0,
      avgMiscPerJob: jobCount > 0 ? Math.round((miscHours / jobCount) * 100) / 100 : 0,
    }
  })

  const totalDrafting = Math.round(employees.reduce((s, e) => s + e.draftingHours, 0) * 100) / 100
  const totalMisc     = Math.round(employees.reduce((s, e) => s + e.miscHours,     0) * 100) / 100
  const uniqueNcpJobs = teamNcpJobs.size
  const combined      = totalDrafting + totalMisc

  return {
    employees,
    totalDrafting,
    totalMisc,
    uniqueNcpJobs,
    avgDraftingPerJob:    uniqueNcpJobs > 0 ? Math.round((totalDrafting / uniqueNcpJobs) * 100) / 100 : 0,
    avgMiscPerJob:        uniqueNcpJobs > 0 ? Math.round((totalMisc     / uniqueNcpJobs) * 100) / 100 : 0,
    miscRatio:            combined > 0 ? Math.round((totalMisc / combined) * 1000) / 10 : 0,
    miscPerDraftingHour:  totalDrafting > 0 ? Math.round((totalMisc / totalDrafting) * 1000) / 1000 : 0,
  }
}
