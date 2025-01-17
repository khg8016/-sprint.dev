# Supabase Management API Documentation

## Authentication

### OAuth Token Generation
**Endpoint**: `POST /v1/oauth/token`  
**URL**: https://api.supabase.com/api/v1/oauth/token

This endpoint is used to generate OAuth access tokens for authenticating with the Supabase Management API.

#### Request Body Parameters
- `grant_type`: String
  - Required
  - Must be one of: "password", "refresh_token"
- `username`: String (for grant_type="password")
  - Required for password grant type
  - Your Supabase account email
- `password`: String (for grant_type="password")
  - Required for password grant type
  - Your Supabase account password
- `refresh_token`: String (for grant_type="refresh_token")
  - Required for refresh token grant type
  - Previously issued refresh token

#### Response
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "string"
}
```

## Projects Management

### List Projects
**Endpoint**: `GET /v1/projects`  
**URL**: https://api.supabase.com/api/v1/projects

This endpoint retrieves a list of all projects that belong to your organization.

#### Headers
- `Authorization`: Bearer token required
  - Format: `Bearer your-access-token`

#### Response
```json
[
  {
    "id": "string",
    "organization_id": "string",
    "name": "string",
    "region": "string",
    "created_at": "string",
    "database": {
      "host": "string",
      "port": number,
      "name": "string"
    }
  }
]
```

### Get Project Details
**Endpoint**: `GET /v1/projects/{ref}`  
**URL**: https://api.supabase.com/api/v1/projects/{ref}

This endpoint retrieves detailed information about a specific project.

#### Path Parameters
- `ref`: String
  - Required
  - Project reference ID or name

#### Headers
- `Authorization`: Bearer token required
  - Format: `Bearer your-access-token`

#### Response
```json
{
  "id": "string",
  "organization_id": "string",
  "name": "string",
  "region": "string",
  "created_at": "string",
  "database": {
    "host": "string",
    "port": number,
    "name": "string"
  }
}
```

## Common Response Codes

- 200: Successful operation
- 400: Bad request - check request parameters
- 401: Unauthorized - invalid or expired token
- 403: Forbidden - insufficient permissions
- 404: Resource not found
- 500: Internal server error
