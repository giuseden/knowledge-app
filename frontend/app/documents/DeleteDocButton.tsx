'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Loader2 } from 'lucide-react'

export default function DeleteDocButton({ docId }: { docId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    if (!confirm('Eliminare questo documento? L\'operazione è irreversibile.')) return
    setLoading(true)
    await supabase.from('document_chunks').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('id', docId)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
      title="Elimina documento"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  )
}
