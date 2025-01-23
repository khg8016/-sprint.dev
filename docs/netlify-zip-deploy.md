# Netlify ZIP 파일 배포 방법

## 개요
ZIP 파일 배포 방식은 Netlify에 사이트를 배포하는 가장 간단하고 신뢰성 있는 방법입니다. 전체 사이트를 하나의 ZIP 파일로 압축하여 단일 API 호출로 배포할 수 있습니다.

## API 엔드포인트

### 기존 사이트에 배포하기
```http
POST /api/v1/sites/{site_id}/deploys
```

### 새 사이트 생성과 동시에 배포하기
```http
POST /api/v1/sites
```

## 요청 헤더
```http
Content-Type: application/zip
Authorization: Bearer your-access-token
```

## 요청 파라미터
- `name` (선택): 새 사이트 생성 시 사이트 이름
- `branch` (선택): 배포할 브랜치 이름 (기본값: main/master)
- `deploy_key` (선택): 배포 키
- `title` (선택): 배포의 제목
- `async` (선택): 비동기 배포 여부 (기본값: false)

## ZIP 파일 요구사항

### 1. 파일 구조
- ZIP 파일의 루트에 모든 파일이 위치해야 함
- 하위 디렉토리 구조는 유지됨
- index.html은 루트에 있어야 함

### 2. 파일 크기
- ZIP 파일 최대 크기: 100MB
- 압축 해제 후 최대 크기: 500MB

### 3. 지원하는 압축 형식
- ZIP (.zip)
- 다른 압축 형식(예: .tar.gz, .rar)은 지원하지 않음

## 구현 예시

### cURL을 사용한 예시
```bash
# 기존 사이트에 배포
curl -H "Content-Type: application/zip" \
     -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
     --data-binary "@site.zip" \
     https://api.netlify.com/api/v1/sites/{site_id}/deploys

# 새 사이트 생성과 동시에 배포
curl -H "Content-Type: application/zip" \
     -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
     --data-binary "@site.zip" \
     https://api.netlify.com/api/v1/sites?name=my-site
```

### JavaScript/Node.js 예시
```javascript
const fs = require('fs');
const axios = require('axios');

async function deployToNetlify(zipFilePath, siteId, token) {
  const zipData = fs.readFileSync(zipFilePath);
  
  try {
    const response = await axios.post(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
      zipData,
      {
        headers: {
          'Content-Type': 'application/zip',
          'Authorization': `Bearer ${token}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    
    return response.data;
  } catch (error) {
    throw new Error(`Deploy failed: ${error.message}`);
  }
}
```

## 응답 예시
```json
{
  "id": "deploy-id",
  "site_id": "site-id",
  "deploy_url": "https://deploy-id--site-name.netlify.app",
  "url": "https://site-name.netlify.app",
  "ssl_url": "https://site-name.netlify.app",
  "admin_url": "https://app.netlify.com/sites/site-name/deploys/deploy-id",
  "deploy_timestamp": "2023-01-01T00:00:00.000Z",
  "state": "ready"
}
```

## 에러 처리

### 일반적인 에러 코드
- 400: 잘못된 요청 (예: 유효하지 않은 ZIP 파일)
- 401: 인증 실패
- 413: ZIP 파일이 너무 큼
- 422: 처리할 수 없는 요청 (예: 압축 해제 실패)
- 500: 서버 에러

### 에러 응답 예시
```json
{
  "code": "invalid_zip",
  "message": "Could not extract ZIP file"
}
```

## 모범 사례

### 1. ZIP 파일 생성
- 불필요한 파일 제외 (.git, node_modules 등)
- 빌드된 파일만 포함
- index.html이 루트에 있는지 확인

### 2. API 호출
- maxContentLength와 maxBodyLength 설정 (큰 파일 처리)
- 적절한 타임아웃 설정
- 에러 처리 로직 구현

### 3. 배포 상태 확인
- deploy_url로 배포 확인
- state가 'ready'가 될 때까지 대기

## 장점
1. 단일 API 호출로 전체 배포 처리
2. 파일별 해시 계산 불필요
3. 실패 가능성 최소화
4. 구현이 간단하고 직관적
5. 네트워크 요청 최소화

## 제한 사항
1. ZIP 파일 크기 제한 (100MB)
2. 압축 해제 후 크기 제한 (500MB)
3. 증분 배포 불가능 (항상 전체 파일 업로드)
4. 특정 파일만 업데이트 불가능