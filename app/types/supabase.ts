export interface Project {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  status: string;
}

export interface CreateProjectParams {
  name: string;
  db_pass: string;
  organization_id: string;
  region: string;
}

export interface SupabaseToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  expires_at: string;
}

export interface ErrorResponse {
  error: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}
