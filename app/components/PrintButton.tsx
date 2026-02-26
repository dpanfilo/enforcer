'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 transition-colors print:hidden"
    >
      Print / Save PDF
    </button>
  )
}
