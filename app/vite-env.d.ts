declare const __COMMIT_HASH: string;
declare const __APP_VERSION: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_FUNCTION_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPA_CONNECT_CLIENT_ID: string;
  readonly VITE_SUPA_CONNECT_CLIENT_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
