# Netlify Environment Variables API 문서

## 목차
1. [인증 (Authentication)](#인증)
2. [환경 변수 생성 (Create Environment Variables)](#1-환경-변수-생성)
3. [환경 변수 삭제 (Delete Environment Variable)](#2-환경-변수-삭제)
4. [환경 변수 값 삭제 (Delete Environment Variable Value)](#3-환경-변수-값-삭제)
5. [사이트 환경 변수 조회 (Get Site Environment Variables)](#4-사이트-환경-변수-조회)
6. [환경 변수 업데이트 (Update Environment Variable)](#5-환경-변수-업데이트)

## 인증

모든 API 요청에는 netlifyAuth 인증이 필요합니다. 인증 토큰을 Authorization 헤더에 포함시켜야 합니다.

```
Authorization: Bearer {your-netlify-access-token}
```

## 1. 환경 변수 생성

### 엔드포인트
```
POST /api/v1/accounts/{account_id}/env
```

### 설명
계정 또는 특정 사이트에 새로운 환경 변수를 생성합니다. Pro 플랜 이상에서는 세분화된 스코프 설정이 가능합니다.

### 요청 파라미터
- **account_id** (path parameter, required)
  - 타입: string
  - 설명: Netlify 계정 ID

### 쿼리 파라미터
- **site_id** (query parameter, optional)
  - 타입: string
  - 설명: 특정 사이트에 대한 환경 변수를 생성하려는 경우 사용. 제공되면 계정 레벨이 아닌 사이트 레벨에서 환경 변수가 생성됩니다.
  - 예시: ?site_id=your-site-id

### 요청 바디
Content-Type: application/json

```json
[
  {
    "key": "string",         // 환경 변수 이름 (대소문자 구분). 이미 존재하는 키를 사용하면 해당 환경 변수가 업데이트됨
    "scopes": ["builds", "functions", "runtime", "post-processing"],  // 환경 변수 적용 범위 (Pro 플랜 이상에서만 사용 가능)
    "values": [
      {
        "id": "string",      // 환경 변수 값의 고유 식별자
        "value": "string",   // 환경 변수의 암호화되지 않은 값
        "context": "all|dev|branch-deploy|deploy-preview|production|branch",  // 환경 변수가 적용될 컨텍스트
        "context_parameter": "string"  // 사용자 정의 브랜치에 대한 추가 파라미터. context=branch일 때 사용됨
      }
    ],
    "is_secret": false      // true면 Netlify 시스템에서만 읽을 수 있음. UI, API, CLI에서는 로컬 개발 컨텍스트 값만 읽을 수 있음
  }
]
```

#### 스코프 설명
- **builds**: 빌드 프로세스 중에만 사용 가능
- **functions**: Netlify Functions에서 사용 가능
- **runtime**: 런타임 환경에서 사용 가능
- **post-processing**: 포스트 프로세싱 단계에서 사용 가능

#### 컨텍스트 설명
- **all**: 모든 환경에서 사용
- **dev**: 로컬 개발 환경 (`netlify dev` 실행 시)
- **branch-deploy**: 브랜치 배포 시
- **deploy-preview**: 풀 리퀘스트에 대한 프리뷰 배포 시
- **production**: 프로덕션 배포 시
- **branch**: 특정 브랜치에 대한 배포 시 (context_parameter로 브랜치명 지정)

### 응답
- **성공**: 201 Created
- **실패**: 400, 401, 404, 422

## 2. 환경 변수 삭제

### 엔드포인트
```
DELETE /api/v1/accounts/{account_id}/env/{key}
```

### 설명
특정 계정의 환경 변수를 삭제합니다.

### 요청 파라미터
- **account_id** (path parameter, required)
  - 타입: string
  - 설명: Netlify 계정 ID
- **key** (path parameter, required)
  - 타입: string
  - 설명: 삭제할 환경 변수의 키

### 쿼리 파라미터
- **site_id** (query parameter, optional)
  - 타입: string
  - 설명: 특정 사이트의 환경 변수를 삭제하려는 경우 사용
  - 예시: ?site_id=your-site-id

### 응답
- **성공**: 204 No Content
- **실패**: 401, 404

## 3. 환경 변수 값 삭제

### 엔드포인트
```
DELETE /api/v1/accounts/{account_id}/env/{key}/value/{value_id}
```

### 설명
특정 환경 변수의 값을 삭제합니다.

### 요청 파라미터
- **account_id** (path parameter, required)
  - 타입: string
  - 설명: Netlify 계정 ID
- **key** (path parameter, required)
  - 타입: string
  - 설명: 환경 변수의 키
- **value_id** (path parameter, required)
  - 타입: string
  - 설명: 삭제할 값의 ID

### 쿼리 파라미터
- **site_id** (query parameter, optional)
  - 타입: string
  - 설명: 특정 사이트의 환경 변수 값을 삭제하려는 경우 사용
  - 예시: ?site_id=your-site-id

### 응답
- **성공**: 204 No Content
- **실패**: 401, 404

## 4. 사이트 환경 변수 조회

### 엔드포인트
```
GET /api/v1/sites/{site_id}/env
```

### 설명
특정 사이트의 모든 환경 변수를 조회합니다.

### 요청 파라미터
- **site_id** (path parameter, required)
  - 타입: string
  - 설명: Netlify 사이트 ID

### 응답
```json
[
  {
    "key": "string",           // 환경 변수 키 (예: ALGOLIA_ID)
    "scopes": ["builds", "functions", "runtime", "post-processing"],  // 환경 변수 적용 범위
    "values": [               // 값과 메타데이터를 포함하는 Value 객체 배열
      {
        "id": "string",       // 값의 고유 식별자
        "value": "string",    // 환경 변수 값
        "context": "string"   // 적용 컨텍스트 (all, dev, branch-deploy, deploy-preview, production)
      }
    ],
    "is_secret": boolean,     // true인 경우 Netlify 시스템에서만 읽기 가능
    "updated_at": "string",   // 마지막 업데이트 시간 (<date-time>)
    "updated_by": {          // 마지막 업데이트한 사용자 정보
      "id": "string",
      "name": "string",
      "email": "string"
    }
  }
]
```

### 응답
- **성공**: 200 OK
- **실패**: 401, 404

## 5. 환경 변수 업데이트

### 엔드포인트
```
PUT /api/v1/accounts/{account_id}/env/{key}
```

### 설명
기존 환경 변수의 설정을 업데이트합니다.

### 요청 파라미터
- **account_id** (path parameter, required)
  - 타입: string
  - 설명: Netlify 계정 ID
- **key** (path parameter, required)
  - 타입: string
  - 설명: 업데이트할 환경 변수의 키

### 쿼리 파라미터
- **site_id** (query parameter, optional)
  - 타입: string
  - 설명: 특정 사이트의 환경 변수를 업데이트하려는 경우 사용
  - 예시: ?site_id=your-site-id

### 요청 바디
Content-Type: application/json

```json
{
  "key": "string",         // 환경 변수의 기존 또는 새 이름 (대소문자 구분)
  "scopes": ["builds", "functions", "runtime", "post-processing"],  // 환경 변수 적용 범위 (Pro 플랜 이상에서만 사용 가능)
  "values": [             // 값과 메타데이터를 포함하는 Value 객체 배열
    {
      "id": "string",     // 환경 변수 값의 고유 식별자
      "value": "string",  // 환경 변수의 암호화되지 않은 값
      "context": "all|dev|branch-deploy|deploy-preview|production|branch",  // 적용 컨텍스트
      "context_parameter": "string"  // 사용자 정의 브랜치에 대한 추가 파라미터. context=branch일 때 사용됨
    }
  ],
  "is_secret": false      // true면 Netlify 시스템에서만 읽을 수 있음
}
```

### 응답
- **성공**: 200 OK
- **실패**: 400, 401, 404, 422
