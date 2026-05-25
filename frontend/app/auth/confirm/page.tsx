'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setupOrg } from '@/lib/api'
import { Building2 } from 'lucide-react'

export default function ConfirmPage() {
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const firmName = localStorage.getItem('pendingFirmName') ?? 'My Firm'
        try {
          await setupOrg(firmName, session.access_token)
          localStorage.removeItem('pendingFirmName')
          router.push('/auth/login?confirmed=1')
        } catch (err) {
          setError(
            `Account confermato, ma impossibile creare l'organizzazione: ${
              err instanceof Error ? err.message : 'errore sconosciuto'
            }`
          )
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
        </div>
        <div className="card p-8 text-center">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Attivazione in corso...</p>
          )}
        </div>
      </div>
    </div>
  )
}
