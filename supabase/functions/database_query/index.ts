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

    if (req.method === 'POST') {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const projectRef = pathParts[pathParts.length - 1]; // Get project ref from URL

      if (!projectRef) {
        throw new Error('Project reference is required');
      }

      const { query } = await req.json();

      if (!query) {
        throw new Error('SQL query is required');
      }
      console.log(projectRef)
      // Execute database query
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });
      console.log(JSON.stringify(response))

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to execute query');
        } else {
          const text = await response.text();
          throw new Error(`API Error (${response.status}): ${text.substring(0, 200)}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Invalid response format. Expected JSON but got: ${text.substring(0, 200)}`);
      }

      const result = await response.json();

      return new Response(JSON.stringify(result), {
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
