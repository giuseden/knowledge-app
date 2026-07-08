'use client'

export type LaborCostData = {
  ral: number
  contributi_inps_azienda: number
  inail: number
  tfr_accantonamento: number
  costo_annuo_azienda: number
  costo_mensile_azienda: number
  aliquote_usate: { inps_azienda_pct: number; inail_pct: number }
  ccnl?: string | null
  livello?: string | null
}

function formatEuro(value: number) {
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default function LaborCostCard({ data }: { data: LaborCostData }) {
  const rows: [string, number][] = [
    ['RAL (Retribuzione Annua Lorda)', data.ral],
    ['Contributi INPS azienda', data.contributi_inps_azienda],
    ['INAIL', data.inail],
    ['TFR (accantonamento annuo)', data.tfr_accantonamento],
  ]

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 max-w-md">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Stima costo del lavoro</p>
        {(data.ccnl || data.livello) && (
          <p className="text-xs text-gray-500">
            {[data.ccnl, data.livello].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-600">{label}</span>
            <span className="text-gray-900 font-medium">{formatEuro(value)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-indigo-200 mt-3 pt-3 space-y-1">
        <div className="flex justify-between text-sm font-semibold text-indigo-900">
          <span>Costo annuo azienda</span>
          <span>{formatEuro(data.costo_annuo_azienda)}</span>
        </div>
        <div className="flex justify-between text-xs text-indigo-700">
          <span>Costo mensile azienda</span>
          <span>{formatEuro(data.costo_mensile_azienda)}</span>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
        Stima calcolata con aliquote standard (INPS azienda {(data.aliquote_usate.inps_azienda_pct * 100).toFixed(1)}%,
        INAIL {(data.aliquote_usate.inail_pct * 100).toFixed(1)}%) — da verificare con un consulente del lavoro
        per il caso specifico (settore, agevolazioni, dimensione azienda).
      </p>
    </div>
  )
}
