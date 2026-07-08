'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Clock, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Pencil, Check, X, Loader2,
  FolderInput,
} from 'lucide-react'
import DeleteDocButton from './DeleteDocButton'
import SpreadsheetEditor from './SpreadsheetEditor'
import { createClient } from '@/lib/supabase/client'
import { reEmbed, moveDocument, type Folder } from '@/lib/api'

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

const statusBadge = (status: string) => {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    ready:      { cls: 'bg-green-50 text-green-700',  label: 'Pronto',       icon: <CheckCircle className="w-3.5 h-3.5" /> },
    processing: { cls: 'bg-amber-50 text-amber-700',  label: 'Elaborazione', icon: <Clock className="w-3.5 h-3.5" /> },
    pending:    { cls: 'bg-gray-100 text-gray-600',   label: 'In attesa',    icon: <Clock className="w-3.5 h-3.5" /> },
    error:      { cls: 'bg-red-50 text-red-700',      label: 'Errore',       icon: <AlertCircle className="w-3.5 h-3.5" /> },
  }
  const { cls, label, icon } = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cls}`}>
      {icon}{label}
    </span>
  )
}

const sourceColors: Record<string, string> = {
  audio:       'text-purple-500',
  video:       'text-blue-500',
  document:    'text-indigo-500',
  spreadsheet: 'text-green-600',
}

const sourceLabel: Record<string, string> = {
  audio:       'Audio',
  video:       'Video',
  document:    'Word',
  spreadsheet: 'Excel',
}

export default function DocumentsTable({ documents: initialDocs, folders, organizationId }: Props) {
  const [docs, setDocs] = useState(initialDocs)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTranscriptId, setEditTranscriptId] = useState<string | null>(null)
  const [editTranscript, setEditTranscript] = useState('')
  const [movingDocId, setMovingDocId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    return session.access_token
  }

  const toggle = (id: string, hasTranscript: boolean) => {
    if (editingId) return
    if (!hasTranscript) return
    if (expanded === id) setEditTranscriptId(null)
    setExpanded((prev) => (prev === id ? null : id))
  }

  const startEditTitle = (e: React.MouseEvent, doc: Doc) => {
    e.stopPropagation()
    setEditingId(doc.id)
    setEditTitle(doc.title ?? '')
  }

  const cancelEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
  }

  const saveTitle = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation()
    setSaving(true)
    await supabase.from('documents').update({ title: editTitle }).eq('id', docId)
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, title: editTitle } : d))
    setEditingId(null)
    setSaving(false)
    router.refresh()
  }

  const startEditTranscript = (docId: string, transcript: string) => {
    setEditTranscriptId(docId)
    setEditTranscript(transcript)
  }

  const cancelEditTranscript = () => {
    setEditTranscriptId(null)
  }

  const saveTranscript = async (doc: Doc) => {
    setSaving(true)
    try {
      const token = await getToken()
      await reEmbed(doc.id, doc.organization_id, editTranscript, token)
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, transcript: editTranscript } : d))
      setEditTranscriptId(null)
      router.refresh()
    } catch {
      alert('Errore nel salvataggio della trascrizione. Riprova.')
    } finally {
      setSaving(false)
    }
  }

  const handleMoveDoc = async (docId: string, folderId: string | null) => {
    setSaving(true)
    try {
      const token = await getToken()
      await moveDocument(docId, folderId, token)
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, folder_id: folderId } : d))
      setMovingDocId(null)
      router.refresh()
    } catch {
      alert('Errore nello spostamento. Riprova.')
    } finally {
      setSaving(false)
    }
  }

  // Cartelle dello stesso document_type del documento corrente
  const foldersForDoc = (doc: Doc) =>
    folders.filter((f) => f.document_type === doc.document_type)

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Documento</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stato</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {docs.map((doc) => {
            const hasTranscript = !!doc.transcript
            const isExpanded = expanded === doc.id
            const isEditingTitle = editingId === doc.id
            const isEditingTranscript = editTranscriptId === doc.id
            const isMoving = movingDocId === doc.id
            const availableFolders = foldersForDoc(doc)
            const currentFolderName = doc.folder_id
              ? folders.find((f) => f.id === doc.folder_id)?.name
              : null

            return (
              <React.Fragment key={doc.id}>
                <tr
                  onClick={() => toggle(doc.id, hasTranscript)}
                  className={`transition-colors ${hasTranscript && !isEditingTitle ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className={`w-4 h-4 flex-shrink-0 ${sourceColors[doc.source_type ?? ''] ?? 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveTitle(e as unknown as React.MouseEvent, doc.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="input w-full text-sm py-1 px-2"
                          />
                        ) : (
                          <>
                            <p className="font-medium text-gray-900">{doc.title ?? 'Senza titolo'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {currentFolderName && (
                                <span className="text-xs text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  📁 {currentFolderName}
                                </span>
                              )}
                              {doc.transcript && !isExpanded && (
                                <p className="text-xs text-gray-400 truncate max-w-xs">
                                  {doc.transcript.substring(0, 80)}…
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-500">{sourceLabel[doc.source_type ?? ''] ?? doc.source_type ?? '—'}</td>
                  <td className="px-4 py-4">{statusBadge(doc.status)}</td>
                  <td className="px-4 py-4 text-gray-500">{new Date(doc.created_at).toLocaleDateString('it-IT')}</td>
                  <td className="px-4 py-4">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isEditingTitle ? (
                        <>
                          <button
                            onClick={(e) => saveTitle(e, doc.id)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-700 disabled:opacity-50"
                            title="Salva"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={cancelEditTitle}
                            disabled={saving}
                            className="text-gray-400 hover:text-gray-600"
                            title="Annulla"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Sposta in cartella */}
                          <div className="relative">
                            <button
                              onClick={() => setMovingDocId(isMoving ? null : doc.id)}
                              className="text-gray-400 hover:text-indigo-500 transition-colors"
                              title="Sposta in cartella"
                            >
                              <FolderInput className="w-4 h-4" />
                            </button>

                            {isMoving && (
                              <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                                <p className="px-3 py-1 text-xs text-gray-400 font-semibold uppercase">Sposta in</p>
                                {/* Radice */}
                                <button
                                  onClick={() => handleMoveDoc(doc.id, null)}
                                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${!doc.folder_id ? 'text-indigo-600 font-medium' : 'text-gray-700'}`}
                                >
                                  — Nessuna cartella
                                </button>
                                {availableFolders.map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => handleMoveDoc(doc.id, f.id)}
                                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${doc.folder_id === f.id ? 'text-indigo-600 font-medium' : 'text-gray-700'}`}
                                  >
                                    <span>📁</span> {f.name}
                                  </button>
                                ))}
                                {availableFolders.length === 0 && (
                                  <p className="px-3 py-1.5 text-xs text-gray-400">Nessuna cartella disponibile</p>
                                )}
                              </div>
                            )}
                          </div>

                          {hasTranscript && (
                            isExpanded
                              ? <ChevronUp className="w-4 h-4 text-gray-400" />
                              : <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                          <button
                            onClick={(e) => startEditTitle(e, doc)}
                            className="text-gray-400 hover:text-indigo-500 transition-colors"
                            title="Modifica titolo"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <DeleteDocButton docId={doc.id} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {isExpanded && doc.transcript !== null && (
                  <tr>
                    <td colSpan={5} className="px-6 py-5 bg-gray-50 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trascrizione</p>
                        {isEditingTranscript ? (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => saveTranscript(doc)}
                              disabled={saving}
                              className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50"
                            >
                              {saving
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Check className="w-3 h-3" />}
                              Salva e re-indicizza
                            </button>
                            <button
                              onClick={cancelEditTranscript}
                              disabled={saving}
                              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            >
                              <X className="w-3 h-3" /> Annulla
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditTranscript(doc.id, doc.transcript!)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Modifica
                          </button>
                        )}
                      </div>
                      {doc.source_type === 'spreadsheet' ? (
                        <SpreadsheetEditor
                          key={isEditingTranscript ? `edit-${doc.id}` : `view-${doc.id}`}
                          value={isEditingTranscript ? editTranscript : doc.transcript!}
                          onChange={setEditTranscript}
                          readOnly={!isEditingTranscript}
                        />
                      ) : isEditingTranscript ? (
                        <textarea
                          value={editTranscript}
                          onChange={(e) => setEditTranscript(e.target.value)}
                          className="input w-full text-sm leading-relaxed resize-y"
                          rows={10}
                        />
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{doc.transcript}</p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
