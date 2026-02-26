export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { fetchEmployees, nameToSlug } from '@/lib/employees'

export default async function Home() {
  const employees = await fetchEmployees()

  return (
    <main
      className="min-h-screen p-6 md:p-10 font-sans"
      style={{ backgroundColor: '#0f1117', color: '#e5e7eb' }}
    >
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Employee Time Dashboards
        </h1>
        <p className="text-zinc-400 text-sm mb-8">
          Select an employee to view their hours analysis and irregularity report.
        </p>

        <div className="flex flex-col gap-3">
          {employees.map((name) => (
            <Link
              key={name}
              href={`/${nameToSlug(name)}`}
              className="flex items-center justify-between rounded-xl p-5 border border-zinc-700 hover:border-zinc-500 transition-colors"
              style={{ backgroundColor: '#1a1d27' }}
            >
              <span className="text-white font-semibold">{name}</span>
              <span className="text-zinc-500 text-sm">View dashboard →</span>
            </Link>
          ))}
        </div>

        {employees.length === 0 && (
          <p className="text-zinc-500 text-sm py-8 text-center">
            No employees found in hours_import.
          </p>
        )}
      </div>
    </main>
  )
}
