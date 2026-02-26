import { supabase } from './supabase'

export interface PermitWeek {
  week: string   // display label e.g. "Nov 10"
  weekKey: string // YYYY-MM-DD (Monday) for sorting
  jobs: number
}

const BULK_MIGRATION_DATE = '2025-11-04'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getMondayKey(dateStr: string): string {
  const dt = new Date(dateStr + 'T00:00:00')
  const day = dt.getDay() // 0=Sun
  const offset = (day + 6) % 7  // days since Monday
  dt.setDate(dt.getDate() - offset)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function weekLabel(mondayKey: string): string {
  const [, m, d] = mondayKey.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

export async function fetchPermitWeekly(): Promise<PermitWeek[]> {
  // Resolve "To Permit" status index
  const { data: statusRow } = await supabase
    .from('statuses')
    .select('index')
    .eq('name', 'To Permit')
    .single()

  const toPermitId = statusRow?.index
  if (!toPermitId) return []

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

  // Exclude the Nov 4 bulk migration day
  const realRows = allRows.filter((r) => r.changed_at.slice(0, 10) !== BULK_MIGRATION_DATE)
  if (realRows.length === 0) return []

  // Group unique job_ids by Monday week
  const weekJobs = new Map<string, Set<number>>()
  for (const row of realRows) {
    const key = getMondayKey(row.changed_at.slice(0, 10))
    if (!weekJobs.has(key)) weekJobs.set(key, new Set())
    weekJobs.get(key)!.add(row.job_id)
  }

  // Build continuous week range (first → last), filling gaps with 0
  const keys = Array.from(weekJobs.keys()).sort()
  const result: PermitWeek[] = []
  const cur = new Date(keys[0] + 'T00:00:00')
  const last = new Date(keys[keys.length - 1] + 'T00:00:00')

  while (cur <= last) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    result.push({
      week: weekLabel(key),
      weekKey: key,
      jobs: weekJobs.get(key)?.size ?? 0,
    })
    cur.setDate(cur.getDate() + 7)
  }

  return result
}
