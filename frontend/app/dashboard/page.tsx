import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import CreateOrgPrompt from '@/components/CreateOrgPrompt'

async function getOrgData(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  console.log('[dashboard] getOrgData userId:', userId)

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .single()

  if (membershipError || !membership) {
    console.error('[dashboard] organization_members query failed:', membershipError)
    return null
  }

  const orgId = membership.organization_id
  console.log('[dashboard] found orgId:', orgId)

  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()

  if (orgError) console.error('[dashboard] organizations query failed:', orgError)

  const { count: totalDocs } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  const { count: readyDocs } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'ready')

  const { count: processingDocs } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'processing')

  const { data: recentDocs } = await supabase
    .from('documents')
    .select('id, title, source_type, status, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    org: orgRow ?? null,
    orgId,
    totalDocs: totalDocs ?? 0,
    readyDocs: readyDocs ?? 0,
    processingDocs: processingDocs ?? 0,
    recentDocs: recentDocs ?? [],
  }
}

const statusIcon = (status: string) => {
  if (status === 'ready') return <CheckCircle className="w-4 h-4 text-green-500" />
  if (status === 'processing') return <Clock className="w-4 h-4 text-amber-500" />
  return <AlertCircle className="w-4 h-4 text-red-500" />
}

const sourceLabel: Record<string, string> = {
  audio: 'Audio',
  video: 'Video',
  document: 'Document',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const data = await getOrgData(user.id, supabase)

  if (!data) {
    return <CreateOrgPrompt />
  }

  const stats = [
    {
      label: 'Total Documents',
      value: data.totalDocs,
      icon: FileText,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Ready',
      value: data.readyDocs,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Processing',
      value: data.processingDocs,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50',
    },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {(data.org as { name: string } | null)?.name ?? 'Your Firm'}
        </h1>
        <p className="text-gray-500 mt-1">Knowledge base overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">{label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Recent documents */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recent Documents</h2>
        </div>
        {data.recentDocs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No documents yet. Upload your first file.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.recentDocs.map((doc: { id: string; title: string | null; source_type: string | null; status: string; created_at: string }) => (
              <li key={doc.id} className="flex items-center px-6 py-4 gap-4">
                {statusIcon(doc.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.title ?? 'Untitled'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {sourceLabel[doc.source_type ?? ''] ?? doc.source_type} ·{' '}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  doc.status === 'ready'
                    ? 'bg-green-50 text-green-700'
                    : doc.status === 'processing'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {doc.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
