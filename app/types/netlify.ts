export interface FileDigestDeployment {
  files: {
    [path: string]: string; // path: SHA1 hash
  };
  functions: {
    [name: string]: string; // name: SHA256 hash
  };
}

export interface FileDigestResponse {
  id: string;
  required: string[]; // 업로드 필요한 파일 해시
  required_functions: string[]; // 업로드 필요한 함수 해시
}

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
