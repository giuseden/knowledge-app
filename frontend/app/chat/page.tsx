'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/client'
import {
  Send, Bot, User, Loader2, MessageSquare,
  Plus, Trash2, MessagesSquare,
} from 'lucide-react'
import InfographicRenderer, { type InfographicData } from '@/components/InfographicRenderer'
import LaborCostCard, { type LaborCostData } from '@/components/LaborCostCard'

const mdComponents = {
  p: ({ children }: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  h1: ({ children }: React.ComponentPropsWithoutRef<'h1'>) => (
    <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
  ),
  ul: ({ children }: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: React.ComponentPropsWithoutRef<'li'>) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: React.ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: React.ComponentPropsWithoutRef<'em'>) => (
    <em className="italic">{children}</em>
  ),
  blockquote: ({ children }: React.ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="border-l-2 border-indigo-300 pl-3 my-2 text-gray-600 italic">
      {children}
    </blockquote>
  ),
  pre: ({ children }: React.ComponentPropsWithoutRef<'pre'>) => (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children }: React.ComponentPropsWithoutRef<'code'>) => {
    const isBlock = !!className || String(children).includes('\n')
    if (isBlock) {
      return <code className={className}>{children}</code>
    }
    return (
      <code className="bg-gray-100 text-gray-800 rounded px-1 py-0.5 text-xs font-mono">
        {children}
      </code>
    )
  },
  table: ({ children }: React.ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: React.ComponentPropsWithoutRef<'thead'>) => (
    <thead className="bg-gray-100">{children}</thead>
  ),
  th: ({ children }: React.ComponentPropsWithoutRef<'th'>) => (
    <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold text-gray-700">
      {children}
    </th>
  ),
  td: ({ children }: React.ComponentPropsWithoutRef<'td'>) => (
    <td className="border border-gray-200 px-3 py-1.5 text-gray-700">{children}</td>
  ),
  a: ({ href, children }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: { document_id: string; content: string }[]
  infographic?: InfographicData
  laborCost?: LaborCostData
}

type ChatSession = {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

type OrgDoc = {
  id: string
  title: string | null
  source_type: string | null
}

const SESSIONS_KEY = 'kb_chat_sessions'
const ACTIVE_KEY = 'kb_chat_active_id'

function loadSessions(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persistSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

function newSession(): ChatSession {
  return {
    id: Date.now().toString(),
    title: 'Nuova chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [orgDocs, setOrgDocs] = useState<OrgDoc[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Initialise from localStorage (client only)
  useEffect(() => {
    const stored = loadSessions()
    const storedActiveId = localStorage.getItem(ACTIVE_KEY)
    if (stored.length === 0) {
      const s = newSession()
      setSessions([s])
      setActiveId(s.id)
    } else {
      setSessions(stored)
      const validId = stored.find((s) => s.id === storedActiveId)?.id ?? stored[0].id
      setActiveId(validId)
    }
  }, [])

  // Fetch org documents for context awareness
  useEffect(() => {
    const fetchDocs = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()
      if (!membership) return
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title, source_type')
        .eq('organization_id', membership.organization_id)
        .eq('status', 'ready')
      setOrgDocs(docs ?? [])
    }
    fetchDocs()
  }, [])

  // Persist sessions on change
  useEffect(() => {
    if (sessions.length > 0) persistSessions(sessions)
  }, [sessions])

  // Persist active session ID
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  const activeSession = sessions.find((s) => s.id === activeId) ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages.length])

  const updateSession = useCallback((id: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)))
  }, [])

  const handleNewChat = () => {
    const s = newSession()
    setSessions((prev) => [s, ...prev])
    setActiveId(s.id)
  }

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = sessions.filter((s) => s.id !== sessionId)
    if (next.length === 0) {
      const s = newSession()
      setSessions([s])
      setActiveId(s.id)
    } else {
      setSessions(next)
      if (activeId === sessionId) setActiveId(next[0].id)
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || !activeId) return

    // Capture history before state mutation (stale closure gives pre-update messages)
    const currentSession = sessions.find((s) => s.id === activeId)
    const history = (currentSession?.messages ?? []).map((m) => ({ role: m.role, content: m.content }))

    const userMsgId = Date.now().toString()
    const assistantMsgId = (Date.now() + 1).toString()
    const capturedActiveId = activeId

    updateSession(capturedActiveId, (s) => ({
      ...s,
      title: s.messages.length === 0 ? text.slice(0, 45) : s.title,
      messages: [
        ...s.messages,
        { id: userMsgId, role: 'user', content: text },
        { id: assistantMsgId, role: 'assistant', content: '' },
      ],
      updatedAt: Date.now(),
    }))

    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          history,
          documents_context: orgDocs.map((d) => ({ id: d.id, title: d.title, source_type: d.source_type })),
        }),
      })

      if (!res.ok || !res.body) throw new Error('Chat request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.delta) {
              updateSession(capturedActiveId, (s) => ({
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: m.content + data.delta } : m
                ),
              }))
            }
            if (data.done && data.sources) {
              updateSession(capturedActiveId, (s) => ({
                ...s,
                updatedAt: Date.now(),
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, sources: data.sources } : m
                ),
              }))
            }
            if (data.infographic) {
              updateSession(capturedActiveId, (s) => ({
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, infographic: data.infographic } : m
                ),
              }))
            }
            if (data.labor_cost) {
              updateSession(capturedActiveId, (s) => ({
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, laborCost: data.labor_cost } : m
                ),
              }))
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } catch {
      updateSession(capturedActiveId, (s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: 'Spiacente, si è verificato un errore. Riprova.' }
            : m
        ),
      }))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const messages = activeSession?.messages ?? []
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg px-3 py-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuova chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {sortedSessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`group flex items-center gap-2 px-3 py-2 mx-2 rounded-lg cursor-pointer text-sm transition-colors ${
                s.id === activeId
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessagesSquare className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="flex-1 truncate text-xs">{s.title}</span>
              <button
                onClick={(e) => handleDeleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                title="Elimina chat"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            Chat Knowledge Base
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orgDocs.length > 0
              ? `${orgDocs.length} document${orgDocs.length !== 1 ? 'i' : 'o'} disponibil${orgDocs.length !== 1 ? 'i' : 'e'} nella knowledge base`
              : 'Fai domande sui documenti della tua azienda'}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center pb-16">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Interroga la knowledge base</h2>
              <p className="text-gray-400 text-sm mt-2 max-w-sm">
                Fai domande su riunioni, procedure, normative o qualsiasi documento caricato.
              </p>
              <div className="mt-6 space-y-2 text-left">
                {[
                  "Cosa è stato discusso nell'ultima riunione con il cliente?",
                  'Riassumi le procedure interne per la gestione dei contratti',
                  'Quali sono le scadenze fiscali del prossimo trimestre?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="block w-full text-left text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex-shrink-0 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-2xl ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm leading-relaxed whitespace-pre-wrap'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : msg.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse rounded-sm" />
                  )}
                </div>
                {msg.infographic && (
                  <InfographicRenderer data={msg.infographic} />
                )}
                {msg.laborCost && (
                  <LaborCostCard data={msg.laborCost} />
                )}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-400 font-medium">Fonti:</p>
                    {msg.sources.map((src, i) => (
                      <div key={i} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-600">
                        {src.content}...
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-8 py-4 border-t border-gray-200 bg-white">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi una domanda... (Invio per inviare)"
              rows={1}
              className="flex-1 input resize-none py-3 min-h-[44px] max-h-32"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 128) + 'px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="btn-primary p-3 flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
