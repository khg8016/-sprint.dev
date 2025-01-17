-- First, drop the constraints/indexes if they exist
DROP INDEX IF EXISTS unique_active_chat_connection;
DROP INDEX IF EXISTS unique_chat_project_connection_idx;
ALTER TABLE chat_supabase_connections 
    DROP CONSTRAINT IF EXISTS unique_chat_project_connection,
    DROP CONSTRAINT IF EXISTS unique_chat_connection;

-- Add unique constraint to ensure one chat can only connect to one project
ALTER TABLE chat_supabase_connections
ADD CONSTRAINT unique_chat_connection 
UNIQUE (chat_id);
