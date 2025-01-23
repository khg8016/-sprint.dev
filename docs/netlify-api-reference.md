# Netlify API Reference

## 개요
Netlify API는 웹사이트 배포, 도메인 관리, 폼 제출 관리 등을 위한 RESTful API를 제공합니다. 이 문서는 배포 관련 주요 API들을 설명합니다.

## 인증
모든 API 요청은 개인 액세스 토큰을 통해 인증되어야 합니다.

```bash
curl -H "Authorization: Bearer your-access-token" https://api.netlify.com/api/v1/sites
```

## 환경 변수
필수 환경 변수:
- `NETLIFY_AUTH_TOKEN`: API 인증을 위한 개인 액세스 토큰
- `NETLIFY_SITE_ID`: 배포할 사이트의 ID (선택적)

## API 엔드포인트

### 사이트 관리

#### 1. 사이트 생성
```http
POST /api/v1/sites
```

요청 바디:
```json
{
  "name": "my-site-name",
  "custom_domain": "www.example.com",
  "force_ssl": true,
  "processing_settings": {
    "html": {
      "pretty_urls": true
    }
  }
}
```

응답:
```json
{
  "id": "site-id",
  "name": "my-site-name",
  "url": "https://my-site-name.netlify.app",
  "admin_url": "https://app.netlify.com/sites/my-site-name",
  "deploy_url": "https://my-site-name.netlify.app"
}
```

#### 2. 사이트 조회
```http
GET /api/v1/sites/{site_id}
```

### 배포 관리

#### 1. 새 배포 생성 (다이제스트 방식)
```http
POST /api/v1/sites/{site_id}/deploys
```

요청 헤더:
```
Content-Type: application/json
```

요청 바디:
```json
{
  "files": {
    "/index.html": {
      "hash": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
    }
  },
  "async": true
}
```

#### 2. 파일 업로드 (다이제스트 방식)
```http
PUT /api/v1/deploys/{deploy_id}/files/{path}
```

요청 헤더:
```
Content-Type: application/octet-stream
```

#### 3. 새 배포 생성 (ZIP 방식)
```http
POST /api/v1/sites/{site_id}/deploys
```

요청 헤더:
```
Content-Type: application/zip
```

### 배포 상태 관리

#### 1. 배포 상태 조회
```http
GET /api/v1/sites/{site_id}/deploys/{deploy_id}
```

응답:
```json
{
  "id": "deploy-id",
  "site_id": "site-id",
  "state": "ready",
  "name": "production",
  "url": "https://my-site-name.netlify.app",
  "ssl_url": "https://my-site-name.netlify.app",
  "admin_url": "https://app.netlify.com/sites/my-site-name/deploys/deploy-id",
  "deploy_url": "https://deploy-id--my-site-name.netlify.app"
}
```

#### 2. 배포 취소
```http
POST /api/v1/sites/{site_id}/deploys/{deploy_id}/cancel
```

### DNS 관리

#### 1. DNS 레코드 생성
```http
POST /api/v1/sites/{site_id}/dns
```

요청 바디:
```json
{
  "type": "CNAME",
  "hostname": "www",
  "value": "my-site-name.netlify.app",
  "ttl": 3600
}
```

#### 2. DNS 레코드 목록 조회
```http
GET /api/v1/sites/{site_id}/dns
```

## 배포 프로세스

1. 사이트 생성 또는 기존 사이트 조회
2. 배포 방식 선택:
   - 다이제스트 방식 (권장):
     1. 파일 해시 계산
     2. 배포 생성
     3. 변경된 파일만 업로드
   - ZIP 방식:
     1. 전체 사이트를 ZIP으로 압축
     2. 단일 요청으로 업로드
3. 배포 상태 모니터링
4. DNS 설정 (필요한 경우)

## 에러 처리

API는 다음과 같은 HTTP 상태 코드를 반환할 수 있습니다:

- 200: 성공
- 201: 리소스 생성됨
- 400: 잘못된 요청
- 401: 인증 실패
- 404: 리소스를 찾을 수 없음
- 422: 처리할 수 없는 엔티티
- 500: 서버 에러

각 에러 응답은 다음과 같은 형식을 가집니다:
```json
{
  "code": "error_code",
  "message": "Error description"
}