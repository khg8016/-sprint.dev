# Supabase Edge Functions API - Create Function

## Endpoint
```
POST https://api.supabase.com/v1/projects/{ref}/functions
```

## Description
Creates a new Edge Function in the specified project.

## Path Parameters
- `ref` (required): Project reference ID
  - Type: string
  - Length: min 20, max 20 characters
  - Required: true

## Request Headers
- `Authorization`: Bearer token for authentication

## Query Parameters
- `slug`: URL-safe identifier for the function
  - Type: string
  - Pattern: /^[A-Za-z0-9_-]+$/
  - Description: Must contain only alphanumeric characters, hyphens, and underscores

## Request Body Parameters
- `name` (required)
  - Type: string
  - Description: Name of the function (must be unique within project)
  - Pattern: Must be URL-safe (alphanumeric, hyphens, underscores)

- `verify_jwt`
  - Type: boolean
  - Description: Whether to verify JWT tokens
  - Default: false

- `import_map`
  - Type: boolean
  - Description: Whether to use an import map for the function

- `entrypoint_path`
  - Type: string
  - Description: Path to the function's entrypoint file
  - Default: "./index.ts"

- `import_map_path`
  - Type: string
  - Description: Path to the import map file

## Response

### Success Response (200 OK)
```json
{
  "id": "string",
  "name": "string",
  "slug": "string",
  "status": "string",
  "version": "string",
  "verify_jwt": boolean,
  "import_map": "string",
  "entrypoint_path": "string",
  "created_at": "string",
  "updated_at": "string"
}
```

## Important Notes
1. Function names must be:
   - Unique within the project
   - URL-safe (only alphanumeric characters, hyphens, and underscores)
2. The project reference (`ref`) must be exactly 20 characters long
3. The function slug must follow URL-safe patterns
4. JWT verification is optional and disabled by default
5. Import maps can be used to manage dependencies
6. The default entrypoint is "./index.ts" but can be customized

## Example Usage
```bash
curl -X POST 'https://api.supabase.com/v1/projects/{ref}/functions' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
  "name": "my-function",
  "verify_jwt": false,
  "import_map": true,
  "entrypoint_path": "./index.ts"
}'
