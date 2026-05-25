'use client'

import { useState, useCallback } from 'react'

type SheetData = Record<string, string[][]>

function parseTranscript(transcript: string): SheetData {
  const sheets: SheetData = {}
  let current = 'Sheet1'

  for (const line of transcript.split('\n')) {
    const match = line.match(/^\[(.+)\]$/)
    if (match) {
      current = match[1]
      if (!sheets[current]) sheets[current] = []
    } else if (line.trim()) {
      if (!sheets[current]) sheets[current] = []
      sheets[current].push(line.split(' | '))
    }
  }

  return Object.keys(sheets).length > 0 ? sheets : { Sheet1: [] }
}

function serializeSheets(sheets: SheetData): string {
  return Object.entries(sheets)
    .map(([name, rows]) => `[${name}]\n${rows.map((r) => r.join(' | ')).join('\n')}`)
    .join('\n')
}

export default function SpreadsheetEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
}) {
  const [sheets, setSheets] = useState<SheetData>(() => parseTranscript(value))
  const [activeSheet, setActiveSheet] = useState<string>(() => {
    const parsed = parseTranscript(value)
    return Object.keys(parsed)[0] ?? 'Sheet1'
  })

  const sheetNames = Object.keys(sheets)
  const rows = sheets[activeSheet] ?? []
  const maxCols = Math.max(...rows.map((r) => r.length), 1)

  const updateCell = useCallback(
    (rowIdx: number, colIdx: number, val: string) => {
      setSheets((prev) => {
        const next = {
          ...prev,
          [activeSheet]: prev[activeSheet].map((row, ri) =>
            ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? val : cell)) : row
          ),
        }
        onChange(serializeSheets(next))
        return next
      })
    },
    [activeSheet, onChange],
  )

  return (
    <div>
      {sheetNames.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200 mb-0">
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => setActiveSheet(name)}
              className={`text-xs px-3 py-1.5 border-t border-x rounded-t transition-colors ${
                name === activeSheet
                  ? 'bg-white border-gray-200 text-gray-900 font-medium -mb-px'
                  : 'bg-gray-100 border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs">Nessun dato disponibile</div>
        ) : (
          <table className="border-collapse text-xs w-full">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? 'bg-gray-100' : 'bg-white even:bg-gray-50/50'}>
                  <td className="border-r border-b border-gray-200 px-2 py-1 text-gray-400 text-right select-none w-8 font-mono text-[10px]">
                    {ri + 1}
                  </td>
                  {Array.from({ length: maxCols }).map((_, ci) => (
                    <td key={ci} className="border-r border-b border-gray-200 p-0 last:border-r-0">
                      {readOnly ? (
                        <span
                          className={`block px-2 py-1 min-w-[80px] ${ri === 0 ? 'font-semibold text-gray-700' : 'text-gray-600'}`}
                        >
                          {row[ci] ?? ''}
                        </span>
                      ) : (
                        <input
                          value={row[ci] ?? ''}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                          className={`w-full px-2 py-1 min-w-[80px] bg-transparent focus:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-300 ${
                            ri === 0 ? 'font-semibold' : ''
                          }`}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
