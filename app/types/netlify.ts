export interface NetlifyDeploymentResponse {
  id: string;
  site_id: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  deploy_url: string;
}

export interface NetlifySiteResponse {
  id: string;
  name: string;
  custom_domain: string;
  url: string;
  default_domain: string; // netlify.app 도메인
}

export interface NetlifyEnv {
  NETLIFY_AUTH_TOKEN: string;
  NETLIFY_ACCOUNT_SLUG: string;
}

export interface NetlifyEnvVar {
  key: string;
  values: Array<{
    id?: string;
    value: string;
    context: string;
    context_parameter?: string;
  }>;
  scopes?: string[];
  is_secret: boolean;
}

export interface NetlifyEnvVarValue {
  value: string;
  scopes: string[];
  is_secret: boolean;
}
