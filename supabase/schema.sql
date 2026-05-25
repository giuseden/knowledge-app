-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members (links Supabase auth users to orgs)
CREATE TABLE IF NOT EXISTS organization_members (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  PRIMARY KEY (user_id, organization_id)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT,
  source_type TEXT, -- 'audio', 'video', 'document'
  transcript TEXT,
  docx_path TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'ready', 'error'
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with vector embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Organizations: members can read their org
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = organizations.id
    )
  );

-- Organizations: any authenticated user can create a new org (signup flow)
CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Organization members: users can see members of their orgs
CREATE POLICY "members_select" ON organization_members
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
    )
  );

-- Organization members: users can insert themselves into an org
CREATE POLICY "members_insert" ON organization_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Documents: org members can CRUD
CREATE POLICY "docs_select" ON documents
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = documents.organization_id
    )
  );

CREATE POLICY "docs_insert" ON documents
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = documents.organization_id
    )
  );

CREATE POLICY "docs_update" ON documents
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = documents.organization_id
    )
  );

CREATE POLICY "docs_delete" ON documents
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = documents.organization_id
    )
  );

-- Document chunks: org members can CRUD
CREATE POLICY "chunks_select" ON document_chunks
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = document_chunks.organization_id
    )
  );

CREATE POLICY "chunks_insert" ON document_chunks
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = document_chunks.organization_id
    )
  );

CREATE POLICY "chunks_delete" ON document_chunks
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = document_chunks.organization_id
    )
  );

-- =============================================
-- Vector similarity search function
-- =============================================

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INT,
  p_organization_id UUID
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.organization_id = p_organization_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- =============================================
-- Storage bucket for documents
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT DO NOTHING;

-- Storage RLS: org members can upload/read their org's files
CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    auth.uid() IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid() IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    auth.uid() IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id::text = (storage.foldername(name))[1]
    )
  );
