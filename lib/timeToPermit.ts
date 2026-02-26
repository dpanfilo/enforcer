import { supabase } from './supabase'
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

function dateDiffDays(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10
}

export interface TimeToPermitJob {
  fullNumber: string
  description: string
  firstHoursDate: string
  permitDate: string
  daysToPermit: number
}

export interface TimeToPermitBucket {
  label: string
  count: number
}

export interface TimeToPermitData {
  jobs: TimeToPermitJob[]
  buckets: TimeToPermitBucket[]
  median: number
  avg: number
  slowest: TimeToPermitJob[]
}

export async function fetchTimeToPermit(): Promise<TimeToPermitData> {
  // 1. Fetch hours rows — build earliest date per job code
  const firstHoursMap = new Map<string, string>() // fullNumber -> earliest date
  const jobDescMap = new Map<string, string>()

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('hours_import')
      .select('date,job,straight_hours,premium_hours')
      .eq('employee_name', 'Jovani Mendoza')
      .range(offset, offset + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const row of data as { date: string; job: string | null; straight_hours: number | string | null; premium_hours: number | string | null }[]) {
      if (!row.job || ADMIN_CODES.has(row.job) || !JOB_CODE_RE.test(row.job)) continue
      if (toNum(row.straight_hours) + toNum(row.premium_hours) <= 0) continue
      const d = normalizeDate(row.date)
      if (!d) continue
      const existing = firstHoursMap.get(row.job)
      if (!existing || d < existing) firstHoursMap.set(row.job, d)
    }
    if ((data as unknown[]).length < 1000) break
  }

  // 2. Get To Permit status index
  const { data: statusRow } = await supabase
    .from('statuses').select('index').eq('name', 'To Permit').single()
  const toPermitId = statusRow?.index
  if (!toPermitId) return { jobs: [], buckets: [], median: 0, avg: 0, slowest: [] }

  // 3. Fetch JMendoza → To Permit transitions, earliest per job_id
  const earliestPermit = new Map<string, string>() // job_id -> earliest changed_at date
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('jobstatushistory')
      .select('job_id,changed_at')
      .eq('changed_by_username', 'JMendoza')
      .eq('to_status_id', toPermitId)
      .order('changed_at', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const r of data as { job_id: string | number; changed_at: string }[]) {
      if (r.changed_at.slice(0, 10) === BULK_MIGRATION_DATE) continue
      const id = String(r.job_id)
      const dt = r.changed_at.slice(0, 10)
      if (!earliestPermit.has(id)) earliestPermit.set(id, dt)
    }
    if ((data as unknown[]).length < 1000) break
  }

  // 4. Resolve job_ids → full_numbers + descriptions
  const uniqueIds = [...earliestPermit.keys()]
  const idToFullNumber = new Map<string, string>()

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100)
    const { data } = await supabase
      .from('jobs')
      .select('index,full_number,project_description')
      .in('index', chunk)
    for (const j of (data ?? []) as { index: number | string; full_number: string; project_description?: string }[]) {
      idToFullNumber.set(String(j.index), j.full_number)
      jobDescMap.set(j.full_number, j.project_description ?? '')
    }
  }

  // 5. Compute days-to-permit for each job
  const result: TimeToPermitJob[] = []
  for (const [jobId, permitDate] of earliestPermit.entries()) {
    const fullNumber = idToFullNumber.get(jobId)
    if (!fullNumber) continue
    const firstDate = firstHoursMap.get(fullNumber)
    if (!firstDate) continue
    const days = dateDiffDays(firstDate, permitDate)
    if (days < 0) continue // hours logged after permit — skip
    result.push({
      fullNumber,
      description: jobDescMap.get(fullNumber) ?? '',
      firstHoursDate: firstDate,
      permitDate,
      daysToPermit: days,
    })
  }

  if (!result.length) return { jobs: result, buckets: [], median: 0, avg: 0, slowest: [] }

  // 6. Histogram buckets
  const bucketDefs = [
    { label: '0–7 days', min: 0, max: 7 },
    { label: '8–14 days', min: 8, max: 14 },
    { label: '15–30 days', min: 15, max: 30 },
    { label: '31–60 days', min: 31, max: 60 },
    { label: '60+ days', min: 61, max: Infinity },
  ]
  const buckets: TimeToPermitBucket[] = bucketDefs.map(({ label, min, max }) => ({
    label,
    count: result.filter((j) => j.daysToPermit >= min && j.daysToPermit <= max).length,
  }))

  const days = result.map((j) => j.daysToPermit)
  const avg = Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10
  const med = median(days)

  const sorted = [...result].sort((a, b) => b.daysToPermit - a.daysToPermit)

  return {
    jobs: result,
    buckets,
    median: med,
    avg,
    slowest: sorted.slice(0, 10),
  }
}
