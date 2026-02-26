import { supabase } from './supabase'

export interface PermitJobEntry {
  fullNumber: string
  description: string
}

export interface PermitWeek {
  week: string    // display label e.g. "Nov 10"
  weekKey: string // YYYY-MM-DD (Monday) for sorting/filtering
  jobs: number
  jobList: PermitJobEntry[]
}

const BULK_MIGRATION_DATE = '2025-11-04'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const JOB_CODE_RE = /^[A-Z]{2,4}-\d{2}-\d{3,5}$/

function getMondayKey(dateStr: string): string {
  const dt = new Date(dateStr + 'T00:00:00')
  const offset = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - offset)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function weekLabel(mondayKey: string): string {
  const [, m, d] = mondayKey.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

export async function fetchPermitWeekly(employeeName: string): Promise<PermitWeek[]> {
  // Resolve "To Permit" status index
  const { data: statusRow } = await supabase
    .from('statuses')
    .select('index')
    .eq('name', 'To Permit')
    .single()

  const toPermitId = statusRow?.index
  if (!toPermitId) return []

  // Get the employee's structured job codes and resolve to job_ids
  const employeeJobCodes = new Set<string>()
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase
      .from('hours_import')
      .select('job')
      .eq('employee_name', employeeName)
      .not('job', 'is', null)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    for (const row of data as { job: string | null }[]) {
      if (row.job && JOB_CODE_RE.test(row.job)) employeeJobCodes.add(row.job)
    }
    if (data.length < 1000) break
  }

  if (employeeJobCodes.size === 0) return []

  const employeeJobIds = new Set<string>()
  const codes = [...employeeJobCodes]
  for (let i = 0; i < codes.length; i += 100) {
    const { data } = await supabase
      .from('jobs').select('index').in('full_number', codes.slice(i, i + 100))
    for (const j of (data ?? []) as { index: number | string }[]) {
      employeeJobIds.add(String(j.index))
    }
  }

  if (employeeJobIds.size === 0) return []

  // Fetch all JMendoza → To Permit transitions
  const allRows: { job_id: number; changed_at: string }[] = []
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
    allRows.push(...(data as { job_id: number; changed_at: string }[]))
    if (data.length < 1000) break
  }

  // Exclude the Nov 4 bulk migration day, and filter to this employee's jobs
  const realRows = allRows.filter((r) =>
    r.changed_at.slice(0, 10) !== BULK_MIGRATION_DATE &&
    employeeJobIds.has(String(r.job_id))
  )
  if (realRows.length === 0) return []

  // Group unique job_ids by Monday week — coerce to string for consistent keys
  const weekJobs = new Map<string, Set<string>>()
  for (const row of realRows) {
    const key = getMondayKey(row.changed_at.slice(0, 10))
    if (!weekJobs.has(key)) weekJobs.set(key, new Set())
    weekJobs.get(key)!.add(String(row.job_id))
  }

  // Fetch job details for all unique job_ids
  const uniqueJobIds = [...new Set(realRows.map((r) => String(r.job_id)))]
  const jobMap = new Map<string, PermitJobEntry>()
  for (let i = 0; i < uniqueJobIds.length; i += 100) {
    const chunk = uniqueJobIds.slice(i, i + 100)
    const { data } = await supabase
      .from('jobs')
      .select('index,full_number,project_description')
      .in('index', chunk)
    for (const j of (data ?? []) as { index: number | string; full_number: string; project_description?: string }[]) {
      jobMap.set(String(j.index), {
        fullNumber: j.full_number,
        description: j.project_description ?? '',
      })
    }
  }

  // Build continuous week range (first → last), filling gaps with empty jobList
  const keys = Array.from(weekJobs.keys()).sort()
  const result: PermitWeek[] = []
  const cur = new Date(keys[0] + 'T00:00:00')
  const last = new Date(keys[keys.length - 1] + 'T00:00:00')

  while (cur <= last) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    const ids = weekJobs.get(key) ?? new Set<string>()
    const jobList = [...ids]
      .map((id) => jobMap.get(id))
      .filter((j): j is PermitJobEntry => !!j)
      .sort((a, b) => a.fullNumber.localeCompare(b.fullNumber))

    result.push({ week: weekLabel(key), weekKey: key, jobs: ids.size, jobList })
    cur.setDate(cur.getDate() + 7)
  }

  return result
}
