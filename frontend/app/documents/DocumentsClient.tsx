'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FolderSidebar from './FolderSidebar'
import DocumentsTable from './DocumentsTable'
import {
  listFolders, createFolder, renameFolder, deleteFolder,
  type Folder,
} from '@/lib/api'

type Doc = {
  id: string
  title: string | null
  source_type: string | null
  status: string
  created_at: string
  transcript: string | null
  organization_id: string
  folder_id: string | null
  document_type: string
}

type Props = {
  documents: Doc[]
  folders: Folder[]
  organizationId: string | null
}

export default function DocumentsClient({ documents: initialDocs, folders: initialFolders, organizationId }: Props) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'knowledge' | 'reference'>('knowledge')
  const router = useRouter()
  const supabase = createClient()

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    return session.access_token
  }, [supabase])

  const refreshFolders = useCallback(async () => {
    if (!organizationId) return
    try {
      const token = await getToken()
      const updated = await listFolders(organizationId, token)
      setFolders(updated)
    } catch {
      // silently ignore
    }
  }, [organizationId, getToken])

  const handleCreateFolder = useCallback(async (name: string, type: 'knowledge' | 'reference') => {
    if (!organizationId) return
    const token = await getToken()
    await createFolder(organizationId, name, type, token)
    await refreshFolders()
  }, [organizationId, getToken, refreshFolders])

  const handleRenameFolder = useCallback(async (id: string, name: string) => {
    const token = await getToken()
    await renameFolder(id, name, token)
    await refreshFolders()
  }, [getToken, refreshFolders])

  const handleDeleteFolder = useCallback(async (id: string) => {
    const token = await getToken()
    await deleteFolder(id, token)
    // Se la cartella eliminata era selezionata, torna alla radice
    if (selectedFolderId === id) setSelectedFolderId(null)
    await refreshFolders()
    router.refresh()
  }, [getToken, refreshFolders, selectedFolderId, router])

  // Filtra i documenti in base alla selezione corrente
  const filteredDocs = initialDocs.filter((doc) => {
    const matchType = doc.document_type === selectedType
    const matchFolder = selectedFolderId === null
      ? true                                  // mostra tutti del tipo
      : doc.folder_id === selectedFolderId   // solo quelli nella cartella
    return matchType && matchFolder
  })

  const selectedFolderName = selectedFolderId
    ? folders.find((f) => f.id === selectedFolderId)?.name
    : selectedType === 'knowledge' ? 'Knowledge Base' : 'Documenti di riferimento'

  return (
    <div className="flex gap-8">
      <FolderSidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        selectedType={selectedType}
        onSelectFolder={setSelectedFolderId}
        onSelectType={(type) => { setSelectedType(type); setSelectedFolderId(null) }}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      <div className="flex-1 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span
            className="cursor-pointer hover:text-indigo-600"
            onClick={() => setSelectedFolderId(null)}
          >
            {selectedType === 'knowledge' ? 'Knowledge Base' : 'Documenti di riferimento'}
          </span>
          {selectedFolderId && (
            <>
              <span>/</span>
              <span className="text-gray-900 font-medium">{selectedFolderName}</span>
            </>
          )}
          <span className="ml-auto text-gray-400">{filteredDocs.length} documenti</span>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <p className="font-medium">Nessun documento in questa sezione</p>
            <p className="text-sm mt-1">Carica un file o spostane uno qui</p>
          </div>
        ) : (
          <DocumentsTable
            documents={filteredDocs}
            folders={folders}
            organizationId={organizationId}
          />
        )}
      </div>
    </div>
  )
}
