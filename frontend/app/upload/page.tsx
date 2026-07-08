'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Upload, File as FileGeneric, FileText, FileSpreadsheet, X, CheckCircle, Loader2, ChevronDown, Mic, StopCircle, BookOpen, FileStack, Folder } from 'lucide-react'
import { listFolders, type Folder as FolderType } from '@/lib/api'

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'
type Mode = 'file' | 'record'
type DocType = 'knowledge' | 'reference'

const AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
]

const ACCEPTED_TYPES = [
  ...AUDIO_TYPES,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
]

const getFileExt = (f: File) => f.name.split('.').pop()?.toLowerCase() ?? ''

const isAccepted = (f: File) => {
  if (ACCEPTED_TYPES.includes(f.type)) return true
  const ext = getFileExt(f)
  return ext === 'docx' || ext === 'xlsx'
}

const getSourceType = (f: File): string => {
  if (AUDIO_TYPES.includes(f.type) || f.type.startsWith('audio/')) return 'audio'
  const ext = getFileExt(f)
  if (ext === 'xlsx' || f.type.includes('spreadsheetml')) return 'spreadsheet'
  return 'document'
}

const FileIcon = ({ file, className }: { file: File; className: string }) => {
  const ext = getFileExt(file)
  if (ext === 'xlsx') return <FileSpreadsheet className={className} />
  if (ext === 'docx') return <FileText className={className} />
  return <FileGeneric className={className} />
}

const CATEGORIES = [
  'Riunioni con clienti',
  'Procedure interne',
  'Aggiornamenti normativi',
  'Scadenze e adempimenti',
  'Formazione interna',
] as const

const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

const getSupportedMimeType = () => {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export default function UploadPage() {
  const [mode, setMode] = useState<Mode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [docType, setDocType] = useState<DocType>('knowledge')
  const [folderId, setFolderId] = useState<string>('')
  const [folders, setFolders] = useState<FolderType[]>([])
  const [state, setState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // Carica le cartelle all'avvio
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', session.user.id)
          .single()
        if (!membership) return
        const result = await listFolders(membership.organization_id, session.access_token)
        setFolders(result)
      } catch {
        // silently ignore
      }
    }
    loadFolders()
  }, [supabase])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Reset cartella quando cambia il tipo
  useEffect(() => {
    setFolderId('')
  }, [docType])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped && isAccepted(dropped)) {
        setFile(dropped)
        if (!title) setTitle(dropped.name.replace(/\.[^/.]+$/, ''))
      }
    },
    [title],
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      if (!title) setTitle(selected.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const switchMode = (next: Mode) => {
    if (isRecording) {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
    }
    setMode(next)
    setFile(null)
    setTitle('')
    setRecSeconds(0)
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Il tuo browser non supporta la registrazione audio.')
      setState('error')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const ext = (mr.mimeType || 'audio/webm').split('/')[1]?.split(';')[0] ?? 'webm'
        const recorded = new File(
          [blob],
          `registrazione-${Date.now()}.${ext}`,
          { type: mr.mimeType || 'audio/webm' },
        )
        setFile(recorded)
        setTitle(`Registrazione ${new Date().toLocaleDateString('it-IT')}`)
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorderRef.current = mr
      mr.start()
      setIsRecording(true)
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000)
    } catch {
      setErrorMsg('Impossibile accedere al microfono. Verifica i permessi del browser.')
      setState('error')
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const handleUpload = async () => {
    if (!file || !category) return
    setState('uploading')
    setErrorMsg('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setState('error'); setErrorMsg('Utente non autenticato'); return }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) { setState('error'); setErrorMsg('Nessuna organizzazione trovata'); return }

    const orgId = membership.organization_id
    const ext = file.name.split('.').pop()
    const storagePath = `${orgId}/${Date.now()}.${ext}`

    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file)

    if (storageError) { setState('error'); setErrorMsg(storageError.message); return }

    const insertData: Record<string, unknown> = {
      organization_id: orgId,
      title: title || file.name,
      source_type: getSourceType(file),
      file_path: storagePath,
      status: 'processing',
      category,
      document_type: docType,
    }
    if (folderId) insertData.folder_id = folderId

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert(insertData)
      .select('id')
      .single()

    if (docError || !doc) { setState('error'); setErrorMsg('Impossibile creare il documento'); return }

    setState('processing')

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${apiUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          document_id: doc.id,
          organization_id: orgId,
          file_path: storagePath,
          source_type: getSourceType(file),
        }),
      })
    } catch {
      // Processing is async; status updates via backend
    }

    setState('done')
    setTimeout(() => router.push('/documents'), 1500)
  }

  const canUpload = !!file && !!category && !['uploading', 'processing', 'done'].includes(state)
  const availableFolders = folders.filter((f) => f.document_type === docType)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Carica Documento</h1>
        <p className="text-gray-500 mt-1">Carica file audio, Word o Excel nella knowledge base.</p>
      </div>

      <div className="card p-6 space-y-6">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['file', 'record'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                mode === m ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m === 'file' ? <Upload className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {m === 'file' ? 'Carica file' : 'Registra Audio'}
            </button>
          ))}
        </div>

        {/* File drop zone */}
        {mode === 'file' && (
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById('file-input')?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-indigo-400 bg-indigo-50'
              : file ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
            }`}
          >
            <input id="file-input" type="file" className="hidden" accept=".mp3,.wav,.ogg,.m4a,.webm,.docx,.xlsx" onChange={onFileChange} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileIcon file={file} className="w-8 h-8 text-green-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); setTitle('') }} className="ml-2 text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Trascina il file qui, o clicca per sfogliare</p>
                <p className="text-xs text-gray-400 mt-1">Audio (MP3, WAV, M4A, OGG) · Word (DOCX) · Excel (XLSX)</p>
              </>
            )}
          </div>
        )}

        {/* Recording zone */}
        {mode === 'record' && (
          <div className="border-2 border-dashed rounded-xl p-10 text-center">
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileGeneric className="w-8 h-8 text-green-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {fmt(recSeconds)}
                  </p>
                </div>
                <button
                  onClick={() => { setFile(null); setTitle(''); setRecSeconds(0) }}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : isRecording ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-700">Registrazione in corso</span>
                </div>
                <div className="text-4xl font-mono font-bold text-gray-900 tabular-nums">
                  {fmt(recSeconds)}
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  <StopCircle className="w-4 h-4" />
                  Ferma
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Mic className="w-10 h-10 text-gray-400 mx-auto" />
                <p className="text-sm font-medium text-gray-700">
                  Premi il pulsante per iniziare la registrazione
                </p>
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  Registra Audio
                </button>
              </div>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Titolo documento</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Riunione cliente Rossi, Formazione GDPR..."
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Categoria <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input appearance-none pr-8">
              <option value="" disabled>Seleziona una categoria...</option>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Tipo documento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo documento</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {([
              { value: 'knowledge', label: 'Knowledge Base', icon: <BookOpen className="w-4 h-4" /> },
              { value: 'reference', label: 'Documenti di riferimento', icon: <FileStack className="w-4 h-4" /> },
            ] as { value: DocType; label: string; icon: React.ReactNode }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDocType(opt.value)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  docType === opt.value
                    ? opt.value === 'knowledge'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {docType === 'knowledge'
              ? 'Riunioni, procedure, note interne dello studio'
              : 'CCNL, tabelle contributive, circolari normative'}
          </p>
        </div>

        {/* Cartella (opzionale) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Cartella <span className="text-gray-400 font-normal">(opzionale)</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <Folder className="w-4 h-4 text-gray-400" />
            </div>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="input appearance-none pl-9 pr-8"
            >
              <option value="">— Nessuna cartella</option>
              {availableFolders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          {availableFolders.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Nessuna cartella disponibile. Creane una dalla pagina Documenti.
            </p>
          )}
        </div>

        {state === 'error' && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{errorMsg}</div>
        )}
        {state === 'done' && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Caricamento completato! Reindirizzamento ai documenti...
          </div>
        )}

        <button onClick={handleUpload} disabled={!canUpload} className="btn-primary w-full flex items-center justify-center gap-2">
          {['uploading', 'processing'].includes(state) && <Loader2 className="w-4 h-4 animate-spin" />}
          {state === 'uploading' ? 'Caricamento...'
            : state === 'processing' ? 'Elaborazione...'
            : state === 'done' ? 'Completato!'
            : 'Carica ed elabora'}
        </button>
      </div>

      {mode === 'file' && (
        <div className="mt-6 card p-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Formati supportati</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'MP3', color: 'bg-purple-50 text-purple-700' },
              { label: 'WAV', color: 'bg-purple-50 text-purple-700' },
              { label: 'M4A', color: 'bg-purple-50 text-purple-700' },
              { label: 'OGG', color: 'bg-purple-50 text-purple-700' },
              { label: 'DOCX', color: 'bg-indigo-50 text-indigo-700' },
              { label: 'XLSX', color: 'bg-green-50 text-green-700' },
            ].map(({ label, color }) => (
              <span key={label} className={`text-xs px-2 py-1 rounded-md ${color}`}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
