import { otherSupabase } from './otherSupabase'

// Status IDs in the other org's DB
const STATUS_TO_PERMIT = 14
const STATUS_PERMIT_OPEN = 15
const STATUS_CLOSED = 17

const NCP_RE = /^NCP-\d{2}-\d{3,5}$/

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export interface NcpJobDetail {
  jobNumber: string
  receivedDate: string
  permitOpenDate: string | null
  closedDate: string | null
  daysToPermitOpen: number | null
  daysPermitOpenToClosed: number | null
  daysOverall: number | null
  currentStatus: string
}

export interface TurnaroundStats {
  avg: number
  median: number
  min: number
  max: number
  count: number
}

export interface MonthlyVolume {
  month: string   // YYYY-MM
  label: string   // "Jan 2025"
  received: number
  permitOpened: number
  closed: number
}

export interface NicorClientData {
  totalJobs: number
  jobsWithPermitOpen: number
  jobsWithClosed: number
  jobsInProgress: number
  receivedToPermitOpen: TurnaroundStats
  permitOpenToClosed: TurnaroundStats
  overall: TurnaroundStats
  monthlyVolume: MonthlyVolume[]
  recentJobs: NcpJobDetail[]
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

export async function fetchNicorClientData(): Promise<NicorClientData> {
  // 1. Fetch all NCP jobs (paginated)
  const jobs: { index: number; full_number: string; date: string; macro_status: string; status_id: number }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await otherSupabase
      .from('jobs')
      .select('index,full_number,date,macro_status,status_id')
      .like('full_number', 'NCP-%')
      .range(offset, offset + 999)
    if (error || !data || data.length === 0) break
    jobs.push(...(data as typeof jobs))
    if (data.length < 1000) break
  }

  // Filter to valid NCP format
  const ncpJobs = jobs.filter(j => NCP_RE.test(j.full_number))

  if (ncpJobs.length === 0) {
    return {
      totalJobs: 0,
      jobsWithPermitOpen: 0,
      jobsWithClosed: 0,
      jobsInProgress: 0,
      receivedToPermitOpen: { avg: 0, median: 0, min: 0, max: 0, count: 0 },
      permitOpenToClosed: { avg: 0, median: 0, min: 0, max: 0, count: 0 },
      overall: { avg: 0, median: 0, min: 0, max: 0, count: 0 },
      monthlyVolume: [],
      recentJobs: [],
    }
  }

  // 2. Fetch status history for all NCP jobs
  const jobIds = ncpJobs.map(j => j.index)

  // Paginate through history in batches of 1000 job IDs at a time
  const BATCH = 500
  const allHistory: { job_id: number; to_status_id: number; changed_at: string }[] = []
  for (let b = 0; b < jobIds.length; b += BATCH) {
    const batchIds = jobIds.slice(b, b + BATCH)
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await otherSupabase
        .from('jobstatushistory')
        .select('job_id,to_status_id,changed_at')
        .in('job_id', batchIds)
        .in('to_status_id', [STATUS_TO_PERMIT, STATUS_PERMIT_OPEN, STATUS_CLOSED])
        .range(offset, offset + 999)
      if (error || !data || data.length === 0) break
      allHistory.push(...(data as typeof allHistory))
      if (data.length < 1000) break
    }
  }

  // 3. Build per-job history maps
  const permitOpenDate = new Map<number, string>()
  const closedDate = new Map<number, string>()

  for (const h of allHistory) {
    if (h.to_status_id === STATUS_PERMIT_OPEN) {
      // Keep earliest permit open date
      const existing = permitOpenDate.get(h.job_id)
      if (!existing || h.changed_at < existing) permitOpenDate.set(h.job_id, h.changed_at.slice(0, 10))
    }
    if (h.to_status_id === STATUS_CLOSED) {
      // Keep latest closed date
      const existing = closedDate.get(h.job_id)
      if (!existing || h.changed_at > existing) closedDate.set(h.job_id, h.changed_at.slice(0, 10))
    }
  }

  // 4. Compute per-job turnaround
  const jobDetails: NcpJobDetail[] = ncpJobs.map(j => {
    const received = j.date ? j.date.slice(0, 10) : null
    const permitOpen = permitOpenDate.get(j.index) ?? null
    const closed = closedDate.get(j.index) ?? null

    const daysToPermitOpen = received && permitOpen ? daysBetween(received, permitOpen) : null
    const daysPermitOpenToClosed = permitOpen && closed ? daysBetween(permitOpen, closed) : null
    const daysOverall = received && closed ? daysBetween(received, closed) : null

    return {
      jobNumber: j.full_number,
      receivedDate: received ?? '',
      permitOpenDate: permitOpen,
      closedDate: closed,
      daysToPermitOpen,
      daysPermitOpenToClosed,
      daysOverall,
      currentStatus: j.macro_status ?? '',
    }
  })

  // 5. Compute stats
  function stats(values: number[]): TurnaroundStats {
    const valid = values.filter(v => v >= 0)
    if (valid.length === 0) return { avg: 0, median: 0, min: 0, max: 0, count: 0 }
    const avg = Math.round(valid.reduce((s, v) => s + v, 0) / valid.length)
    return {
      avg,
      median: median(valid),
      min: Math.min(...valid),
      max: Math.max(...valid),
      count: valid.length,
    }
  }

  const receivedToPermitOpenStats = stats(
    jobDetails.map(j => j.daysToPermitOpen).filter((v): v is number => v !== null)
  )
  const permitOpenToClosedStats = stats(
    jobDetails.map(j => j.daysPermitOpenToClosed).filter((v): v is number => v !== null)
  )
  const overallStats = stats(
    jobDetails.map(j => j.daysOverall).filter((v): v is number => v !== null)
  )

  // 6. Monthly volume
  const byMonth = new Map<string, { received: number; permitOpened: number; closed: number }>()

  for (const j of jobDetails) {
    if (j.receivedDate) {
      const mk = j.receivedDate.slice(0, 7)
      if (!byMonth.has(mk)) byMonth.set(mk, { received: 0, permitOpened: 0, closed: 0 })
      byMonth.get(mk)!.received++
    }
    if (j.permitOpenDate) {
      const mk = j.permitOpenDate.slice(0, 7)
      if (!byMonth.has(mk)) byMonth.set(mk, { received: 0, permitOpened: 0, closed: 0 })
      byMonth.get(mk)!.permitOpened++
    }
    if (j.closedDate) {
      const mk = j.closedDate.slice(0, 7)
      if (!byMonth.has(mk)) byMonth.set(mk, { received: 0, permitOpened: 0, closed: 0 })
      byMonth.get(mk)!.closed++
    }
  }

  const monthlyVolume: MonthlyVolume[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mk, v]) => ({ month: mk, label: monthLabel(mk), ...v }))

  // 7. Recent jobs (last 50 sorted by received date desc)
  const recentJobs = [...jobDetails]
    .filter(j => j.receivedDate)
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))
    .slice(0, 50)

  const jobsWithPermitOpen = jobDetails.filter(j => j.permitOpenDate !== null).length
  const jobsWithClosed = jobDetails.filter(j => j.closedDate !== null).length

  return {
    totalJobs: ncpJobs.length,
    jobsWithPermitOpen,
    jobsWithClosed,
    jobsInProgress: ncpJobs.length - jobsWithClosed,
    receivedToPermitOpen: receivedToPermitOpenStats,
    permitOpenToClosed: permitOpenToClosedStats,
    overall: overallStats,
    monthlyVolume,
    recentJobs,
  }
}
