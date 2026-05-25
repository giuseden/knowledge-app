'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { setupOrg } from '@/lib/api'
import { Building2 } from 'lucide-react'

export default function SignupPage() {
  const [firmName, setFirmName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'http://localhost:3001/auth/confirm',
      },
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Signup failed')
      setLoading(false)
      return
    }

    if (authData.session) {
      // Email confirmation is disabled — session is live, create org now.
      try {
        await setupOrg(firmName, authData.session.access_token)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create organization')
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
      return
    }

    // Email confirmation is enabled — org creation happens in /auth/confirm after the user clicks the link.
    localStorage.setItem('pendingFirmName', firmName)
    setConfirmed(true)
    setLoading(false)
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="card p-8">
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-4 rounded-lg text-sm leading-relaxed">
              Registrazione completata! Ti abbiamo inviato una email di conferma. Controlla la tua casella e clicca il link per attivare l&apos;account.
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
          <h1 className="text-2xl font-bold text-gray-900">Register your firm</h1>
          <p className="text-gray-500 mt-1 text-sm">Start building your AI knowledge base</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSignup} className="space-y-5">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@firm.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Min. 8 characters"
                minLength={8}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
