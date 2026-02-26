import { supabase } from './supabase'

export interface JobDetail {
  full_number: string
  description: string
  city: string
  state: string
  macro_status: string
  status_name: string   // resolved from statuses table
  rush: boolean
}

export interface StatusHistoryEntry {
  job_id: number
  full_number: string
  changed_at: string
  from_status: string
  to_status: string
  changed_by: string
}

/** Fetch all statuses → Map<index, name> */
async function fetchStatuses(): Promise<Map<number, string>> {
  const { data, error } = await supabase
    .from('statuses')
    .select('index,name')
  if (error) throw new Error(`statuses fetch: ${error.message}`)
  const map = new Map<number, string>()
  for (const row of data ?? []) map.set(Number(row.index), row.name)
  return map
}

/**
 * Fetch job details for a list of full_numbers (hours_import.job values).
 * Returns Map<full_number, JobDetail>
 */
export async function fetchJobDetails(
  jobCodes: string[]
): Promise<Map<string, JobDetail>> {
  if (!jobCodes.length) return new Map()

  const statusMap = await fetchStatuses()

  // Batch into chunks of 100 to stay within URL length limits
  const CHUNK = 100
  const allRows: Record<string, unknown>[] = []
  for (let i = 0; i < jobCodes.length; i += CHUNK) {
    const chunk = jobCodes.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('jobs')
      .select('index,full_number,project_description,city,state,macro_status,status_id,rush')
      .in('full_number', chunk)
    if (error) throw new Error(`jobs fetch: ${error.message}`)
    allRows.push(...(data ?? []))
  }

  const map = new Map<string, JobDetail>()
  for (const row of allRows) {
    const r = row as {
      full_number: string
      project_description?: string
      city?: string
      state?: string
      macro_status?: string
      status_id?: string | number
      rush?: string | boolean
    }
    map.set(r.full_number, {
      full_number: r.full_number,
      description: r.project_description ?? '',
      city: r.city ?? '',
      state: r.state ?? '',
      macro_status: r.macro_status ?? '',
      status_name: statusMap.get(Number(r.status_id)) ?? r.macro_status ?? '',
      rush: r.rush === 'true' || r.rush === true,
    })
  }
  return map
}

/**
 * Fetch recent status history for a list of job index IDs.
 * Returns entries sorted newest-first.
 */
export async function fetchStatusHistory(
  jobIndexIds: number[],
  jobIndexToFullNumber: Map<number, string>
): Promise<StatusHistoryEntry[]> {
  if (!jobIndexIds.length) return []

  const [statusMap, histResult] = await Promise.all([
    fetchStatuses(),
    supabase
      .from('jobstatushistory')
      .select('job_id,from_status_id,to_status_id,changed_at,changed_by_username')
      .in('job_id', jobIndexIds)
      .order('changed_at', { ascending: false })
      .limit(500),
  ])

  if (histResult.error) throw new Error(`jobstatushistory fetch: ${histResult.error.message}`)

  return (histResult.data ?? []).map((row) => ({
    job_id: Number(row.job_id),
    full_number: jobIndexToFullNumber.get(Number(row.job_id)) ?? String(row.job_id),
    changed_at: row.changed_at,
    from_status: statusMap.get(Number(row.from_status_id)) ?? `#${row.from_status_id}`,
    to_status: statusMap.get(Number(row.to_status_id)) ?? `#${row.to_status_id}`,
    changed_by: row.changed_by_username ?? '',
  }))
}
