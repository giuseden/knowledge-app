'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Building2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="card p-8 space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-4 rounded-lg text-sm leading-relaxed">
              Email inviata! Controlla la tua casella e clicca il link per reimpostare la password. Il link scade dopo 1 ora.
            </div>
            <p className="text-center text-xs text-gray-400">
              Non hai ricevuto nulla? Controlla la cartella spam.
            </p>
            <div className="text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Torna al login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Password dimenticata?</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Inserisci la tua email e ti invieremo un link per reimpostare la password.
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Indirizzo email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="tu@studio.com"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Invio in corso…' : 'Invia link di recupero'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Torna al login
          </Link>
        </p>
      </div>
    </div>
  )
}
