-- ============================================================
--  KnowledgeAI — complete schema
--  Run once in the Supabase SQL editor (Database > SQL Editor)
-- ============================================================


-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector (embeddings)


-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

CREATE TABLE organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT,
  source_type     TEXT        NOT NULL CHECK (source_type IN ('audio', 'video', 'document')),
  file_path       TEXT,
  docx_path       TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  category        TEXT,
  transcript      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_chunks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID        NOT NULL REFERENCES documents(id)     ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  embedding       vector(1536),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

CREATE INDEX ON organization_members (user_id);
CREATE INDEX ON organization_members (organization_id);
CREATE INDEX ON documents (organization_id, created_at DESC);
CREATE INDEX ON documents (organization_id, status);
CREATE INDEX ON document_chunks (document_id);
CREATE INDEX ON document_chunks (organization_id);

-- ANN index for cosine-similarity search.
-- `lists = 100` is a sensible default; tune to ~sqrt(row_count) as data grows.
CREATE INDEX document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks      ENABLE ROW LEVEL SECURITY;

-- Helper: returns the org the current user belongs to (used repeatedly below)
-- We inline the subquery instead of a function so Supabase can plan it well.


-- organizations
-- A user can read any org they are a member of.
CREATE POLICY "org: members can select"
  ON organizations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Any authenticated user can create an org (needed for the signup flow).
-- In a multi-tenant SaaS you would gate this behind an invitation token.
CREATE POLICY "org: authenticated users can create"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only org admins can rename/update the org.
CREATE POLICY "org: admins can update"
  ON organizations FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- organization_members
-- A user can see their own membership row.
CREATE POLICY "members: view own membership"
  ON organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- A user can add themselves to an org (covers the signup flow where there
-- is not yet an admin to approve).  Because org UUIDs are unguessable this
-- is acceptable for an internal tool; add an invitation flow to lock it down.
CREATE POLICY "members: self-join an org"
  ON organization_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- An existing org admin can add other users.
CREATE POLICY "members: admins can add others"
  ON organization_members FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- documents
CREATE POLICY "docs: org members can select"
  ON documents FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "docs: org members can insert"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "docs: org members can update"
  ON documents FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "docs: org members can delete"
  ON documents FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );


-- document_chunks
-- The backend writes chunks via the service_role key (bypasses RLS).
-- Authenticated users only need SELECT (browsing) and DELETE (via the
-- delete-document button in the UI, which deletes chunks before the doc).
CREATE POLICY "chunks: org members can select"
  ON document_chunks FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "chunks: org members can delete"
  ON document_chunks FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- Storage bucket policies
-- ------------------------------------------------------------
-- First create the bucket manually:
--   Supabase dashboard → Storage → New bucket
--   Name: "documents"  |  Public: OFF
-- Then run the policies below.

CREATE POLICY "storage: org members can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "storage: org members can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "storage: org members can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- pgvector similarity-search function (called by POST /chat)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  org_id          UUID,
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  document_id UUID,
  content     TEXT,
  similarity  FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    document_id,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE organization_id = org_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
