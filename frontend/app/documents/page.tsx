import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, Upload } from 'lucide-react'
import DocumentsTable from './DocumentsTable'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  const { data: documents } = membership
    ? await supabase
        .from('documents')
        .select('id, title, source_type, status, created_at, transcript, organization_id')
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trascrizioni e Documenti</h1>
          <p className="text-gray-500 mt-1">{documents?.length ?? 0} files in your knowledge base</p>
        </div>
        <Link href="/upload" className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload new
        </Link>
      </div>

      {!documents || documents.length === 0 ? (
        <div className="card p-16 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No documents yet</p>
          <p className="text-gray-400 text-sm mt-1">Upload audio, video or text files to get started</p>
          <Link href="/upload" className="btn-primary inline-flex mt-4">Upload your first file</Link>
        </div>
      ) : (
        <DocumentsTable documents={documents} />
      )}
    </div>
  )
}
