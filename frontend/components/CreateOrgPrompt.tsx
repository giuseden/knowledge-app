'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setupOrg } from '@/lib/api'
import { Building2 } from 'lucide-react'

export default function CreateOrgPrompt() {
  // Start in 'pending' — we check localStorage before deciding what to show.
  // This prevents a flash of the manual form when a pendingFirmName exists.
  const [mode, setMode] = useState<'pending' | 'auto' | 'form'>('pending')
  const [firmName, setFirmName] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const pending = localStorage.getItem('pendingFirmName')
    if (pending) {
      setMode('auto')
      run(pending)
    } else {
      setMode('form')
    }
  }, [])

  const run = async (name: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      // Session gone — fall back to the manual form so the user isn't stuck
      setMode('form')
      return
    }
    try {
      await setupOrg(name, session.access_token)
      localStorage.removeItem('pendingFirmName')
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile creare l\'organizzazione')
      setFirmName(name)   // pre-fill the form with the name we already have
      setMode('form')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Sessione non attiva — effettua il logout e accedi di nuovo.')
      return
    }
    try {
      await setupOrg(firmName, session.access_token)
      localStorage.removeItem('pendingFirmName')
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile creare l\'organizzazione')
    }
  }

  // Waiting for localStorage check or auto-creating in the background
  if (mode === 'pending' || mode === 'auto') {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <p className="text-gray-500 text-sm">
            {mode === 'auto' ? 'Configurazione organizzazione in corso…' : ''}
          </p>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Manual fallback — shown only when no pendingFirmName exists in localStorage
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Configura la tua organizzazione</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Il tuo account non è ancora collegato a uno studio. Creane uno per continuare.
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome dello studio
              </label>
              <input
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                className="input"
                placeholder="Studio Legale Rossi"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full">
              Crea organizzazione
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
