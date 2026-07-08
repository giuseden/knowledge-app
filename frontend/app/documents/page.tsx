import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Upload } from 'lucide-react'
import DocumentsClient from './DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  const [documentsResult, foldersResult] = await Promise.all([
    membership
      ? supabase
          .from('documents')
          .select('id, title, source_type, status, created_at, transcript, organization_id, folder_id, document_type')
          .eq('organization_id', membership.organization_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    membership
      ? supabase
          .from('folders')
          .select('id, name, document_type, parent_id, created_at')
          .eq('organization_id', membership.organization_id)
          .order('name')
      : Promise.resolve({ data: [] }),
  ])

  const documents = documentsResult.data ?? []
  const folders = foldersResult.data ?? []
  const organizationId = membership?.organization_id ?? null

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documenti</h1>
          <p className="text-gray-500 mt-1">{documents.length} file nella knowledge base</p>
        </div>
        <Link href="/upload" className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Carica nuovo
        </Link>
      </div>

      <DocumentsClient
        documents={documents}
        folders={folders}
        organizationId={organizationId}
      />
    </div>
  )
}
