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
