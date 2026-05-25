import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Building2 } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organizations(name)')
    .eq('user_id', user.id)
    .single()

  const orgName = (membership?.organizations as { name: string } | null)?.name ?? '—'

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profilo</h1>
        <p className="text-gray-500 mt-1">Informazioni sul tuo account</p>
      </div>

      <div className="card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Email</p>
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Organizzazione</p>
            <p className="text-sm font-medium text-gray-900">{orgName}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
