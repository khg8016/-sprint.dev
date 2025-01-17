-- Create supabase_tokens table
-- Enable RLS
ALTER TABLE IF EXISTS supabase_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS supabase_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_in INTEGER NOT NULL,
    token_type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_supabase_tokens_updated_at
    BEFORE UPDATE ON supabase_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create policy to allow users to only see their own tokens
CREATE POLICY "Users can only view their own tokens"
    ON supabase_tokens
    FOR ALL
    USING (auth.uid() = user_id);
