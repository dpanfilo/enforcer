import { supabase } from './supabase'
import { fetchJobDetails } from './jobEnrichment'
import { ADMIN_CODES } from './hoursData'

const JOB_CODE_RE = /^[A-Z]{2,4}-\d{2}-\d{3,5}$/
const BULK_MIGRATION_DATE = '2025-11-04'

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
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  return s
}

export interface UnsentJob {
  fullNumber: string
  description: string
  city: string
  state: string
  macro_status: string
  status_name: string
  rush: boolean
  hours: number
  firstEntry: string
  lastEntry: string
}

export interface UnsentJobsData {
  jobs: UnsentJob[]
  totalJobs: number
  totalHours: number
}

export async function fetchUnsentJobs(): Promise<UnsentJobsData> {
  // 1. Fetch all hours rows for Jovani
  const allRows: { date: string; job: string | null; straight_hours: number | string | null; premium_hours: number | string | null }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('hours_import')
      .select('date,job,straight_hours,premium_hours')
      .eq('employee_name', 'Jovani Mendoza')
      .range(offset, offset + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    allRows.push(...(data as typeof allRows))
    if (data.length < 1000) break
  }

  // 2. Group by structured job codes (not admin codes)
  const jobEntry = new Map<string, { hours: number; dates: string[] }>()
  for (const row of allRows) {
    if (!row.job || ADMIN_CODES.has(row.job) || !JOB_CODE_RE.test(row.job)) continue
    const d = normalizeDate(row.date)
    if (!d) continue
    const h = toNum(row.straight_hours) + toNum(row.premium_hours)
    const existing = jobEntry.get(row.job) ?? { hours: 0, dates: [] }
    existing.hours += h
    existing.dates.push(d)
    jobEntry.set(row.job, existing)
  }

  // 3. Get To Permit status index
  const { data: statusRow } = await supabase
    .from('statuses').select('index').eq('name', 'To Permit').single()
  const toPermitId = statusRow?.index
  if (!toPermitId) return { jobs: [], totalJobs: 0, totalHours: 0 }

  // 4. Fetch all JMendoza → To Permit job_ids (exclude bulk migration)
  const permitJobIds: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('jobstatushistory')
      .select('job_id,changed_at')
      .eq('changed_by_username', 'JMendoza')
      .eq('to_status_id', toPermitId)
      .range(offset, offset + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const r of data as { job_id: string | number; changed_at: string }[]) {
      if (r.changed_at.slice(0, 10) !== BULK_MIGRATION_DATE) permitJobIds.push(String(r.job_id))
    }
    if (data.length < 1000) break
  }

  // 5. Resolve job_ids → full_numbers
  const sentSet = new Set<string>()
  const uniquePermitIds = [...new Set(permitJobIds)]
  for (let i = 0; i < uniquePermitIds.length; i += 100) {
    const chunk = uniquePermitIds.slice(i, i + 100)
    const { data } = await supabase
      .from('jobs').select('index,full_number').in('index', chunk)
    for (const j of (data ?? []) as { index: number | string; full_number: string }[]) {
      sentSet.add(j.full_number)
    }
  }

  // 6. Find unsent job codes
  const unsentCodes = [...jobEntry.keys()].filter((code) => !sentSet.has(code))

  // 7. Fetch job details
  const details = await fetchJobDetails(unsentCodes)

  // 8. Build result
  const jobs: UnsentJob[] = unsentCodes.map((code) => {
    const entry = jobEntry.get(code)!
    const detail = details.get(code)
    const sortedDates = entry.dates.sort()
    return {
      fullNumber: code,
      description: detail?.description ?? '',
      city: detail?.city ?? '',
      state: detail?.state ?? '',
      macro_status: detail?.macro_status ?? '',
      status_name: detail?.status_name ?? '',
      rush: detail?.rush ?? false,
      hours: Math.round(entry.hours * 100) / 100,
      firstEntry: sortedDates[0] ?? '',
      lastEntry: sortedDates[sortedDates.length - 1] ?? '',
    }
  }).sort((a, b) => b.hours - a.hours)

  const totalHours = jobs.reduce((s, j) => s + j.hours, 0)
  return { jobs, totalJobs: jobs.length, totalHours: Math.round(totalHours * 100) / 100 }
}
