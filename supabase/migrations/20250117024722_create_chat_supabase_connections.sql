-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create chat_supabase_connections table
CREATE TABLE IF NOT EXISTS chat_supabase_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    project_organization_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    project_region TEXT NOT NULL,
    project_created_at TIMESTAMPTZ NOT NULL,
    project_status TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chat_id_not_empty CHECK (chat_id <> ''),
    CONSTRAINT project_id_not_empty CHECK (project_id <> ''),
    CONSTRAINT project_organization_id_not_empty CHECK (project_organization_id <> ''),
    CONSTRAINT project_name_not_empty CHECK (project_name <> ''),
    CONSTRAINT project_region_not_empty CHECK (project_region <> ''),
    CONSTRAINT project_status_valid CHECK (project_status IN ('ACTIVE', 'INACTIVE', 'PAUSED'))
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_supabase_connections_updated_at
    BEFORE UPDATE ON chat_supabase_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE chat_supabase_connections ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own connections
CREATE POLICY "Users can only view their own connections"
    ON chat_supabase_connections
    FOR ALL
    USING (auth.uid() = user_id);

-- Create unique constraint to prevent multiple active connections for the same chat
CREATE UNIQUE INDEX unique_active_chat_connection 
    ON chat_supabase_connections (chat_id) 
    WHERE is_active = true;
