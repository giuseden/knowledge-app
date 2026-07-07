'use client'

import { useRef } from 'react'
import { Download } from 'lucide-react'

export type InfographicItem = {
  label: string
  description: string
  icon?: string
}

export type InfographicData = {
  type: 'steps' | 'process' | 'categories' | 'comparison' | 'timeline' | 'keypoints'
  title: string
  items: InfographicItem[]
}

const CARD_COLORS = [
  { bar: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { bar: 'from-purple-500 to-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { bar: 'from-blue-500 to-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { bar: 'from-violet-500 to-violet-600', bg: 'bg-violet-50 border-violet-200' },
  { bar: 'from-sky-500 to-sky-600', bg: 'bg-sky-50 border-sky-200' },
  { bar: 'from-fuchsia-500 to-fuchsia-600', bg: 'bg-fuchsia-50 border-fuchsia-200' },
]

function StepsView({ items }: { items: InfographicItem[] }) {
  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {item.icon ?? i + 1}
            </div>
            {i < items.length - 1 && (
              <div className="w-0.5 h-6 bg-indigo-200 my-1" />
            )}
          </div>
          <div className="pb-4 pt-1">
            <p className="font-semibold text-gray-900 text-sm leading-tight">{item.label}</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function CategoriesView({ items }: { items: InfographicItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, i) => {
        const color = CARD_COLORS[i % CARD_COLORS.length]
        return (
          <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className={`bg-gradient-to-r ${color.bar} p-3`}>
              <span className="text-2xl">{item.icon ?? '📌'}</span>
            </div>
            <div className="p-3">
              <p className="font-semibold text-gray-900 text-sm leading-tight">{item.label}</p>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">{item.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TimelineView({ items }: { items: InfographicItem[] }) {
  return (
    <div className="relative pt-2">
      <div className="absolute top-6 left-8 right-8 h-0.5 bg-indigo-200" />
      <div className="flex gap-2 overflow-x-auto pb-2">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center min-w-[110px] relative">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 relative z-10 shadow">
              {item.icon ?? `${i + 1}`}
            </div>
            <div className="mt-3 text-center px-1">
              <p className="font-semibold text-gray-900 text-xs leading-tight">{item.label}</p>
              <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KeypointsView({ items }: { items: InfographicItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, i) => {
        const color = CARD_COLORS[i % CARD_COLORS.length]
        return (
          <div key={i} className={`rounded-xl border-2 p-4 ${color.bg}`}>
            <div className="text-2xl mb-2">{item.icon ?? '⭐'}</div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{item.label}</p>
            <p className="text-gray-600 text-xs mt-1 leading-relaxed">{item.description}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function InfographicRenderer({ data }: { data: InfographicData }) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleDownload = async () => {
    if (!containerRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = 'infografica.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Download PNG failed:', err)
    }
  }

  const isSteps = data.type === 'steps' || data.type === 'process'
  const isCategories = data.type === 'categories' || data.type === 'comparison'
  const isTimeline = data.type === 'timeline'

  return (
    <div className="mt-3 rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
      <div ref={containerRef} className="bg-white p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-6 bg-indigo-600 rounded-full flex-shrink-0" />
          <h3 className="font-bold text-gray-900 text-sm leading-tight flex-1">{data.title}</h3>
          <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0">
            {data.type}
          </span>
        </div>

        {isSteps && <StepsView items={data.items} />}
        {isCategories && <CategoriesView items={data.items} />}
        {isTimeline && <TimelineView items={data.items} />}
        {!isSteps && !isCategories && !isTimeline && <KeypointsView items={data.items} />}
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          Scarica PNG
        </button>
      </div>
    </div>
  )
}
