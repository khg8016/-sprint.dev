/* eslint-disable */
// @ts-nocheck
// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
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
      const path = url.pathname.split('/').pop();

      if (path === 'organizations') {
        // List organizations
        const organizations = await managementApi.getOrganizations();
        return new Response(JSON.stringify(organizations), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // List projects
      const projects = await managementApi.getProjects();

      return new Response(JSON.stringify(projects), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (req.method === 'POST') {
      // Create project
      const data = await req.json();
      const project = await managementApi.createProject(data);

      return new Response(JSON.stringify(project), {
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
