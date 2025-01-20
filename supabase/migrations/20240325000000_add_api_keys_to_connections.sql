-- Add API key columns to chat_supabase_connections table
ALTER TABLE chat_supabase_connections
ADD COLUMN anon_key text,
ADD COLUMN service_role_key text;
