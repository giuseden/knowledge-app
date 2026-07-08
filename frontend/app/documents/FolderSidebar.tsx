'use client'

import React, { useState } from 'react'
import {
  Folder, FolderOpen, FolderPlus, Pencil, Trash2,
  Check, X, ChevronRight, BookOpen, FileStack,
} from 'lucide-react'
import type { Folder as FolderType } from '@/lib/api'

type Props = {
  folders: FolderType[]
  selectedFolderId: string | null          // null = "Tutti"
  selectedType: 'knowledge' | 'reference'
  onSelectFolder: (id: string | null) => void
  onSelectType: (type: 'knowledge' | 'reference') => void
  onCreateFolder: (name: string, type: 'knowledge' | 'reference') => Promise<void>
  onRenameFolder: (id: string, name: string) => Promise<void>
  onDeleteFolder: (id: string) => Promise<void>
}

export default function FolderSidebar({
  folders,
  selectedFolderId,
  selectedType,
  onSelectFolder,
  onSelectType,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [creatingFor, setCreatingFor] = useState<'knowledge' | 'reference' | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [loading, setLoading] = useState(false)

  const knowledgeFolders = folders.filter((f) => f.document_type === 'knowledge')
  const referenceFolders = folders.filter((f) => f.document_type === 'reference')

  const handleCreate = async () => {
    if (!newFolderName.trim() || !creatingFor) return
    setLoading(true)
    try {
      await onCreateFolder(newFolderName.trim(), creatingFor)
      setNewFolderName('')
      setCreatingFor(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return
    setLoading(true)
    try {
      await onRenameFolder(id, renameValue.trim())
      setRenamingId(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare la cartella? I documenti al suo interno resteranno nella radice.')) return
    setLoading(true)
    try {
      await onDeleteFolder(id)
    } finally {
      setLoading(false)
    }
  }

  const FolderItem = ({ folder }: { folder: FolderType }) => {
    const isSelected = selectedFolderId === folder.id
    const isRenaming = renamingId === folder.id

    return (
      <div
        className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
          isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
        }`}
        onClick={() => !isRenaming && onSelectFolder(folder.id)}
      >
        {isSelected
          ? <FolderOpen className="w-4 h-4 flex-shrink-0" />
          : <Folder className="w-4 h-4 flex-shrink-0" />
        }

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename(folder.id)
              if (e.key === 'Escape') setRenamingId(null)
            }}
            className="flex-1 text-sm border border-indigo-300 rounded px-1 py-0.5 outline-none"
          />
        ) : (
          <span className="flex-1 truncate">{folder.name}</span>
        )}

        {isRenaming ? (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleRename(folder.id)}
              disabled={loading}
              className="text-green-600 hover:text-green-700"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setRenamingId(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            className="hidden group-hover:flex gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name) }}
              className="text-gray-400 hover:text-indigo-500"
              title="Rinomina"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(folder.id)}
              className="text-gray-400 hover:text-red-500"
              title="Elimina"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  const Section = ({
    type,
    label,
    icon,
    folderList,
    accentColor,
  }: {
    type: 'knowledge' | 'reference'
    label: string
    icon: React.ReactNode
    folderList: FolderType[]
    accentColor: string
  }) => {
    const isTypeSelected = selectedType === type && selectedFolderId === null

    return (
      <div className="mb-4">
        {/* Sezione header — cliccabile per vedere tutti i doc del tipo */}
        <button
          onClick={() => { onSelectType(type); onSelectFolder(null) }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            isTypeSelected ? `${accentColor} font-bold` : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {icon}
          <span className="flex-1 text-left">{label}</span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {/* Cartelle */}
        <div className="ml-3 mt-1 space-y-0.5">
          {folderList.map((f) => (
            <FolderItem key={f.id} folder={f} />
          ))}

          {/* Nuova cartella inline */}
          {creatingFor === type ? (
            <div className="flex items-center gap-1 px-3 py-1.5">
              <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') { setCreatingFor(null); setNewFolderName('') }
                }}
                placeholder="Nome cartella..."
                className="flex-1 text-sm border border-indigo-300 rounded px-1.5 py-0.5 outline-none"
              />
              <button
                onClick={handleCreate}
                disabled={loading || !newFolderName.trim()}
                className="text-green-600 hover:text-green-700 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setCreatingFor(null); setNewFolderName('') }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setCreatingFor(type); setNewFolderName('') }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Nuova cartella
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <aside className="w-60 flex-shrink-0 border-r border-gray-200 pr-4">
      <Section
        type="knowledge"
        label="Knowledge Base"
        icon={<BookOpen className="w-4 h-4" />}
        folderList={knowledgeFolders}
        accentColor="bg-indigo-50 text-indigo-700"
      />
      <Section
        type="reference"
        label="Documenti di riferimento"
        icon={<FileStack className="w-4 h-4" />}
        folderList={referenceFolders}
        accentColor="bg-emerald-50 text-emerald-700"
      />
    </aside>
  )
}
