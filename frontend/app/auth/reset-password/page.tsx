'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Building2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'

type PageState = 'loading' | 'form' | 'success' | 'invalid'

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase processes the #access_token hash asynchronously.
    // Listen for the PASSWORD_RECOVERY event which fires once the token
    // in the URL fragment has been exchanged for a valid session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('form')
      }
    })

    // Fallback: if the user already has an active session when they land here
    // (e.g. the client processed the hash synchronously), skip waiting.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPageState('form')
    })

    // After 8 seconds with no recovery event, the link is likely expired or invalid.
    const timeout = setTimeout(() => {
      setPageState((prev) => (prev === 'loading' ? 'invalid' : prev))
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Le password non corrispondono.')
      return
    }
    if (password.length < 8) {
      setError('La password deve contenere almeno 8 caratteri.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setPageState('success')
    // Sign out so the recovery session doesn't linger, then redirect.
    await supabase.auth.signOut()
    setTimeout(() => router.push('/auth/login?reset=1'), 2500)
  }

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-gray-100 px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <p className="text-gray-500 text-sm">Verifica del link in corso…</p>
        </div>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">Link non valido o scaduto</h2>
            <p className="text-sm text-gray-500">
              Il link per il reset della password è scaduto o è già stato utilizzato. Richiedi un nuovo link.
            </p>
            <Link href="/auth/forgot-password" className="btn-primary inline-block mt-2">
              Richiedi nuovo link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">Password aggiornata!</h2>
            <p className="text-sm text-gray-500">Verrai reindirizzato alla pagina di accesso…</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Imposta nuova password</h1>
          <p className="text-gray-500 mt-1 text-sm">Scegli una password sicura per il tuo account.</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nuova password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Min. 8 caratteri"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Conferma password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                placeholder="Ripeti la nuova password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Aggiornamento…' : 'Aggiorna password'}
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
