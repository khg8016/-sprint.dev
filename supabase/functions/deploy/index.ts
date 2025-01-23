/* eslint-disable */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface FileMap {
  [path: string]: {
    type: 'file' | 'folder';
    content?: string;
    isBinary: boolean;
  };
}

interface DeploymentConfig {
  chatId: string;
  files: FileMap;
  subdomain: string;
}

const CLOUDFLARE_API_KEY = Deno.env.get('CLOUDFLARE_API_KEY');
const CLOUDFLARE_EMAIL = Deno.env.get('CLOUDFLARE_EMAIL');
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CLOUDFLARE_ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SPRINT_DEV_URL = Deno.env.get('SPRINT_DEV_URL') || 'http://localhost:5173';

if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_EMAIL || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_ZONE_ID) {
  throw new Error('Missing required Cloudflare environment variables');
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createCloudflareDeployment(config: { projectId: string; files: FileMap; subdomain: string }) {
  // Create project if it doesn't exist
  const projectResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects`,
    {
      method: 'POST',
      headers: {
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.projectId,
        production_branch: 'main',
      }),
    },
  );

  if (!projectResponse.ok) {
    const errorText = await projectResponse.text();
    console.error('Cloudflare API Response:', {
      status: projectResponse.status,
      statusText: projectResponse.statusText,
      headers: Object.fromEntries(projectResponse.headers.entries()),
      body: errorText
    });
    throw new Error(`Failed to create Cloudflare Pages project: ${errorText}`);
  }

  // Create manifest for deployment
  const manifest = {
    manifest_version: 1,
    files: await Promise.all(Object.entries(config.files).map(async ([path, fileData]) => {
      const content = fileData.content || '';
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return {
        file: path,
        hash
      };
    }))
  };

  // Create form data
  const formData = new FormData();
  
  // Add manifest file with correct field name
  formData.append(
    'manifest',
    new Blob([JSON.stringify(manifest)], { type: 'application/json' }),
    'manifest.json'
  );
  
  // Add files to form data with correct field name
  Object.entries(config.files).forEach(([path, fileData]) => {
    formData.append(
      'files',
      new Blob([fileData.content || ''], { type: 'application/octet-stream' }),
      path
    );
  });

  // Create deployment
  const deploymentResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${config.projectId}/deployments`,
    {
      method: 'POST',
      headers: {
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_KEY,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    },
  );

  if (!deploymentResponse.ok) {
    throw new Error(`Failed to create deployment: ${await deploymentResponse.text()}`);
  }

  const deployment = await deploymentResponse.json();

  return deployment.result;
}

async function setupDNSRecord(config: { subdomain: string; target: string }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
    method: 'POST',
    headers: {
      'X-Auth-Email': CLOUDFLARE_EMAIL,
      'X-Auth-Key': CLOUDFLARE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'CNAME',
      name: config.subdomain,
      content: config.target,
      proxied: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create DNS record: ${await response.text()}`);
  }

  return response.json();
}

async function deployToCloudflare(config: DeploymentConfig) {
  // 프로젝트 ID를 더 짧고 유효한 형식으로 생성
  const timestamp = new Date().getTime().toString(36); // 타임스탬프를 base36으로 변환하여 더 짧게 만듦
  const shortChatId = config.chatId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8); // chatId를 8자로 제한
  const projectId = `sp-${shortChatId}-${timestamp}`;

  try {
    // 기존 실패한 deployment 찾기
    const { data: existingDeployment } = await supabase
      .from('deployments')
      .select()
      .eq('chat_id', config.chatId)
      .eq('status', 'pending')
      .single();

    let deployment;
    
    if (existingDeployment) {
      // 기존 deployment 상태 업데이트
      const { data: updatedDeployment, error: updateError } = await supabase
        .from('deployments')
        .update({ subdomain: config.subdomain })
        .eq('id', existingDeployment.id)
        .select()
        .single();
        
      if (updateError) throw updateError;
      deployment = updatedDeployment;
    } else {
      // 새 deployment 레코드 생성
      const { data: newDeployment, error: insertError } = await supabase
        .from('deployments')
        .insert({
          chat_id: config.chatId,
          subdomain: config.subdomain,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      deployment = newDeployment;
    }

    // Create Cloudflare deployment
    const cloudflareDeployment = await createCloudflareDeployment({
      projectId,
      files: config.files,
      subdomain: config.subdomain,
    });

    // Setup DNS record
    await setupDNSRecord({
      subdomain: config.subdomain,
      target: cloudflareDeployment.url,
    });

    // Update deployment record
    const { error: updateError } = await supabase
      .from('deployments')
      .update({
        status: 'deployed',
        cloudflare_deployment_id: cloudflareDeployment.id,
      })
      .eq('id', deployment.id);

    if (updateError) {
      throw updateError;
    }

    // Log success
    await supabase.from('deployment_logs').insert({
      deployment_id: deployment.id,
      log_type: 'info',
      message: 'Deployment completed successfully',
    });

    return {
      success: true,
      deployment: {
        ...deployment,
        cloudflare_deployment_id: cloudflareDeployment.id,
        url: `https://${config.subdomain}`,
      },
    };
  } catch (error) {
    console.error('Deployment failed:', error);

    // Log error
    if (deployment?.id) {
      await supabase.from('deployment_logs').insert({
        deployment_id: deployment.id,
        log_type: 'error',
        message: error.message,
      });
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

serve(async (req) => {
  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': SPRINT_DEV_URL,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { chatId, files } = await req.json();

    if (!chatId || !files) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const timestamp = new Date().getTime();
    const subdomain = `${chatId}-${timestamp}.sprint.solo.dev`;
    const result = await deployToCloudflare({ chatId, files, subdomain });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });
  }
});
