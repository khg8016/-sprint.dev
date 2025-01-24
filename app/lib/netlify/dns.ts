import { type NetlifyEnv } from '~/types/netlify';
import type { AxiosInstance } from 'axios';

export async function getDnsZoneId(env: NetlifyEnv, client: AxiosInstance): Promise<string> {
  try {
    const response = await client.get('https://api.netlify.com/api/v1/dns_zones', {
      params: { account_slug: env.NETLIFY_ACCOUNT_SLUG },
      headers: { Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}` },
    });

    const zone = response.data.find((zone: any) => zone.name === 'sprintsolo.dev');

    if (!zone) {
      throw new Error('DNS zone for sprintsolo.dev not found');
    }

    return zone.id;
  } catch (error: any) {
    throw new Error(`Failed to get DNS zone ID: ${error.message}`);
  }
}

export async function setupNetlifyDNSRecord(
  config: { subdomain: string; target: string },
  zoneId: string,
  env: NetlifyEnv,
  client: AxiosInstance,
) {
  try {
    await client.post(
      `https://api.netlify.com/api/v1/dns_zones/${zoneId}/dns_records`,
      {
        type: 'CNAME',
        hostname: config.subdomain,
        value: config.target,
        ttl: 3600,
      },
      {
        headers: {
          Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error: any) {
    throw new Error(`Failed to manage DNS record: ${error.message}`);
  }
}
