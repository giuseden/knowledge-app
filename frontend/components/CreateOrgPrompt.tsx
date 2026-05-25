'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setupOrg } from '@/lib/api'
import { Building2 } from 'lucide-react'

export default function CreateOrgPrompt({ userId }: { userId: string }) {
  // Start in 'pending' — we check localStorage before deciding what to show.
  // This prevents a flash of the manual form when a pendingFirmName exists.
  const [mode, setMode] = useState<'pending' | 'auto' | 'form'>('pending')
  const [firmName, setFirmName] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
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
      setError(err instanceof Error ? err.message : 'Failed to create organization')
      setFirmName(name)   // pre-fill the form with the name we already have
      setMode('form')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('No active session — please log out and log back in.')
      return
    }
    try {
      await setupOrg(firmName, session.access_token)
      localStorage.removeItem('pendingFirmName')
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
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
          <h2 className="text-xl font-bold text-gray-900">Set up your organization</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Your account isn&apos;t linked to a firm yet. Create one to continue.
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Firm name
              </label>
              <input
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                className="input"
                placeholder="Acme Law Firm"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full">
              Create organization
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
