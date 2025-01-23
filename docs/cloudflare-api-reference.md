# Cloudflare API Reference

이 문서는 Cloudflare Pages 프로젝트 및 DNS 관리와 관련된 주요 API에 대한 참조를 제공합니다.

## Pages Projects API

### 프로젝트 생성

**엔드포인트:** `POST /accounts/{account_id}/pages/projects`

**설명:** 새로운 Cloudflare Pages 프로젝트를 생성합니다.

**필수 헤더:**

- Content-Type: application/json
- X-Auth-Email: your-email
- X-Auth-Key: your-api-token

**요청 본문 매개변수:**

```json
{
  "name": "project-name", // 필수: 프로젝트 이름
  "production_branch": "main", // 필수: 기본 프로덕션 브랜치
  "build_config": {
    // 선택: 빌드 설정
    "build_command": "npm run build",
    "destination_dir": "build",
    "root_dir": "/",
    "web_analytics_tag": "123", // 선택: 웹 분석 태그
    "web_analytics_token": "token" // 선택: 웹 분석 토큰
  },
  "source": {
    // 선택: 소스 설정
    "type": "github",
    "config": {
      "owner": "username",
      "repo_name": "repo",
      "production_branch": "main",
      "pr_comments_enabled": true,
      "deployments_enabled": true
    }
  },
  "deployment_configs": {
    // 선택: 배포 설정
    "preview": {
      "env_vars": {
        "MY_PREVIEW_VAR": "value"
      }
    },
    "production": {
      "env_vars": {
        "MY_PROD_VAR": "value"
      }
    }
  }
}
```

**응답 예시:**

```json
{
  "result": {
    "id": "project-id",
    "name": "project-name",
    "created_on": "2024-01-01T00:00:00Z",
    "subdomain": "project-name.pages.dev",
    "domains": ["project-name.pages.dev"],
    "build_config": {
      "build_command": "npm run build",
      "destination_dir": "build",
      "root_dir": "/"
    }
  },
  "success": true
}
```

## Pages Deployments API

### 배포 생성

**엔드포인트:** `POST /accounts/{account_id}/pages/projects/{project_name}/deployments`

**설명:** Pages 프로젝트에 대한 새로운 배포를 생성합니다. 저장소와 계정이 Cloudflare Pages 대시보드에서 이미 인증되어 있어야 합니다.

**필수 헤더:**

- Content-Type: multipart/form-data
- X-Auth-Email: your-email
- X-Auth-Key: your-api-token

**요청 매개변수:**

Form 데이터에 포함되어야 하는 항목:

- `manifest`: 배포 파일 메타데이터를 포함하는 JSON 파일
- `files`: 배포할 모든 프로젝트 파일들

**매니페스트 형식:**

```json
{
  "manifest_version": 1,
  "files": [
    {
      "file": "index.html",
      "hash": "dc4c67a0f73c2a997f6c12de2f91d89d"
    },
    {
      "file": "css/styles.css",
      "hash": "7898d8f7d8f7d8f7d8f7d8f7d8f7d8f7"
    }
  ]
}
```

**선택적 매개변수:**

- `branch`: 배포할 브랜치. 생략하면 프로덕션 브랜치가 사용됨
- `production`: 프로덕션 배포 여부 (boolean)
- `commit_hash`: 배포와 연관된 커밋 해시
- `commit_message`: 배포와 연관된 커밋 메시지
- `commit_dirty`: 워킹 디렉토리가 깨끗하지 않은 상태에서의 배포 여부

**응답 예시:**

```json
{
  "result": {
    "id": "deployment-id",
    "project_id": "project-id",
    "project_name": "project-name",
    "created_on": "2024-01-01T00:00:00Z",
    "production": false,
    "status": "pending",
    "url": "deployment-id.project-name.pages.dev",
    "deployment_trigger": {
      "type": "api",
      "metadata": {
        "branch": "main",
        "commit_hash": "abc123"
      }
    }
  },
  "success": true
}
```

## DNS Records API

### DNS 레코드 생성

**엔드포인트:** `POST /zones/{zone_id}/dns_records`

**설명:** 존(zone)에 대한 새로운 DNS 레코드를 생성합니다.

**중요 참고사항:**

- A/AAAA 레코드는 CNAME 레코드와 동일한 이름으로 존재할 수 없습니다.
- NS 레코드는 다른 레코드 타입과 동일한 이름으로 존재할 수 없습니다.
- 도메인 이름은 유니코드 문자로 생성했더라도 항상 Punycode로 표현됩니다.

**필수 헤더:**

- Content-Type: application/json
- X-Auth-Email: your-email
- X-Auth-Key: your-api-token

**필수 권한:**

- DNS Write

**요청 본문 매개변수:**

```json
{
  "type": "A", // 필수: 레코드 타입 (A, AAAA, CNAME 등)
  "name": "example.com", // 필수: DNS 레코드 이름
  "content": "192.0.2.1", // 필수: DNS 레코드 내용
  "ttl": 3600, // 선택: TTL (1 = 자동)
  "proxied": true, // 선택: 프록시 사용 여부
  "comment": "API를 통해 생성된 레코드", // 선택: 레코드에 대한 설명
  "tags": ["api-managed"] // 선택: 레코드와 연관된 태그
}
```

**지원되는 레코드 타입:**

- `A`: IPv4 주소
- `AAAA`: IPv6 주소
- `CNAME`: 정식 이름
- `TXT`: 텍스트 레코드
- `MX`: 메일 교환
- `NS`: 네임서버
- `SPF`: 발신자 정책 프레임워크
- `SRV`: 서비스 로케이터
- `CAA`: 인증 기관 인증
- `DNSKEY`: DNS 키
- `DS`: 위임 서명자
- `HTTPS`: HTTPS 리소스 레코드
- `SVCB`: 서비스 바인딩

**응답 예시:**

```json
{
  "result": {
    "id": "record-id",
    "type": "A",
    "name": "example.com",
    "content": "192.0.2.1",
    "proxiable": true,
    "proxied": true,
    "ttl": 3600,
    "locked": false,
    "zone_id": "zone-id",
    "zone_name": "example.com",
    "created_on": "2024-01-01T00:00:00Z",
    "modified_on": "2024-01-01T00:00:00Z",
    "comment": "API를 통해 생성된 레코드",
    "tags": ["api-managed"]
  },
  "success": true
}
```

## 인증

Cloudflare API는 API Email + API Key 인증 방식을 사용합니다:

### API Email + API Key

- **필수 헤더**:
  - X-Auth-Email: your-email
  - X-Auth-Key: your-api-token
- **설명**: Cloudflare API와 상호 작용하기 위한 인증 방식으로, 글로벌 API 키와 함께 사용됩니다.
- **생성 방법**: Cloudflare 대시보드의 "내 프로필"에서 API 키를 확인할 수 있습니다.

## 속도 제한

- 모든 API 엔드포인트에는 속도 제한이 적용됩니다
- 속도 제한은 다음을 기준으로 합니다:
  - API 토큰
  - IP 주소
  - 계정 ID
  - 존 ID
- 속도 제한을 초과하면 HTTP 429 응답이 반환됩니다

## 오류 처리

일반적인 HTTP 상태 코드:

- 200: 성공
- 400: 잘못된 요청 (매개변수 누락 또는 잘못됨)
- 401: 인증 실패
- 403: 권한 없음
- 429: 속도 제한 초과
- 500: 서버 오류
