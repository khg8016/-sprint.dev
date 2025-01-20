/* eslint-disable */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SupabaseManagementAPI } from 'https://esm.sh/supabase-management-js@1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-access-token',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get access token from request
    const accessToken = req.headers.get('x-access-token');

    if (!accessToken) {
      throw new Error('No access token provided');
    }

    const managementApi = new SupabaseManagementAPI({
      accessToken,
    });

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const projectRef = pathParts[pathParts.length - 1]; // Get project ref from URL

      if (!projectRef) {
        throw new Error('Project reference is required');
      }

      // Get project API keys
      const apiKeys = await managementApi.getProjectApiKeys(projectRef);

      return new Response(JSON.stringify(apiKeys), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Method ${req.method} not allowed`);
  } catch (err: unknown) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
