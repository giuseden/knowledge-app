-- =============================================
-- Migration 001: Folders + document_type
-- =============================================

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'knowledge', -- 'knowledge' | 'reference'
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE, -- per subfolder nidificati (future)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add folder_id and document_type to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'knowledge'; -- 'knowledge' | 'reference'

-- =============================================
-- RLS for folders
-- =============================================

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folders_select" ON folders
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = folders.organization_id
    )
  );

CREATE POLICY "folders_insert" ON folders
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = folders.organization_id
    )
  );

CREATE POLICY "folders_update" ON folders
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = folders.organization_id
    )
  );

CREATE POLICY "folders_delete" ON folders
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = folders.organization_id
    )
  );
