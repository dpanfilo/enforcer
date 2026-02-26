import { supabase } from './supabase'

/**
 * Returns all distinct employee names found in hours_import, sorted alphabetically.
 */
export async function fetchEmployees(): Promise<string[]> {
  const names = new Set<string>()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('hours_import')
      .select('employee_name')
      .not('employee_name', 'is', null)
      .range(offset, offset + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const row of data as { employee_name: string }[]) {
      if (row.employee_name) names.add(row.employee_name)
    }
    if (data.length < 1000) break
  }
  return [...names].sort()
}

export function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}
