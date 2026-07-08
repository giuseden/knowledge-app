const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function setupOrg(firmName: string, accessToken: string): Promise<string> {
  const res = await fetch(`${API_URL}/setup-org`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ firm_name: firmName }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.organization_id
}

export async function reEmbed(
  documentId: string,
  organizationId: string,
  transcript: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/re-embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      document_id: documentId,
      organization_id: organizationId,
      transcript,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
}

// ── Folders ────────────────────────────────────────────────────────────────

export type Folder = {
  id: string
  name: string
  document_type: 'knowledge' | 'reference'
  parent_id: string | null
  created_at: string
}

export async function listFolders(organizationId: string, accessToken: string): Promise<Folder[]> {
  const res = await fetch(`${API_URL}/folders?organization_id=${organizationId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.folders
}

export async function createFolder(
  organizationId: string,
  name: string,
  documentType: 'knowledge' | 'reference',
  accessToken: string,
  parentId?: string,
): Promise<Folder> {
  const res = await fetch(`${API_URL}/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      organization_id: organizationId,
      name,
      document_type: documentType,
      parent_id: parentId ?? null,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.folder
}

export async function renameFolder(
  folderId: string,
  name: string,
  accessToken: string,
): Promise<Folder> {
  const res = await fetch(`${API_URL}/folders/${folderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.folder
}

export async function deleteFolder(folderId: string, accessToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/folders/${folderId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export async function moveDocument(
  documentId: string,
  folderId: string | null,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${documentId}/move`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ folder_id: folderId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}
