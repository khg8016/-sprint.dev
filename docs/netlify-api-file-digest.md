# Netlify API - File Digest Method

## Overview
Netlify API는 프로그래밍 가능한 웹을 위한 호스팅 서비스입니다. 이 API는 웹사이트의 원자적 배포, 폼 제출 관리, JavaScript 스니펫 주입 등 다양한 기능을 제공합니다. REST 스타일의 API이며 JSON을 직렬화에 사용하고 OAuth 2를 인증에 사용합니다.

## File Digest Method

### 목적
File Digest Method는 배포에 필요한 파일들을 효율적으로 관리하고 업로드하기 위한 메커니즘을 제공합니다. 각 파일에 대해 파일 경로와 SHA1을 포함하는 다이제스트를 사용하는 것을 권장합니다. 서버리스 함수의 경우 SHA256을 사용해야 합니다.

### 배포 생성
배포를 시작하려면 다음과 같은 API 엔드포인트를 사용합니다:

```
POST /api/v1/sites/{site_id}/deploys
```

요청 본문 예시:
```json
{
  "files": {
    "/index.html": "907d14fb3af2b0d4f18c2d46abe8aedce17367bd",
    "/main.css": "f18c2d7367bd9046abe8aedce17d14fb3af2b0d4"
  },
  "functions": {
    "hello-world": "708b029d8aa9c8fa513d1a25b97ffb6efb12b423"
  }
}
```

### 응답 구조
API는 다음과 같은 속성을 포함하는 객체를 반환합니다:

```json
{
  "id": "1234",
  "required": ["907d14fb3af2b0d4f18c2d46abe8aedce17367bd"],
  "required_functions": ["708b029d8aa9c8fa513d1a25b97ffb6efb12b423"]
}
```

- `id`: 배포 ID
- `required`: 업로드가 필요한 파일들의 SHA1 해시 목록
- `required_functions`: 업로드가 필요한 함수들의 SHA256 해시 목록

### 파일 업로드
파일 다이제스트 응답에서 반환된 배포 ID를 사용하여 파일을 업로드합니다:

```
PUT /api/v1/deploys/{deploy_id}/files/index.html
```

#### 주의사항
- `file_path` 파라미터는 반드시 이스케이프 처리되어야 합니다.
- 파일 경로에 `#` 또는 `?` 문자를 포함하지 않아야 합니다.
- Content-Type은 `application/octet-stream`을 사용해야 합니다.
- HTTP 요청 본문에 파일 내용을 포함해야 합니다.
- 동일한 SHA1을 가진 파일이 여러 개 있는 경우, 하나만 업로드하면 됩니다.

### 함수 업로드
필요한 파일이 함수인 경우, functions 엔드포인트를 통해 업로드합니다:
```
PUT /api/v1/deploys/{deploy_id}/functions/hello-world?runtime=js
```

#### 런타임 옵션
- `js`: 압축된 Node.js 프로그램 또는 번들된 JavaScript 파일
- `go`: Go 바이너리

함수를 업로드할 때는 파일 경로나 확장자가 아닌 함수 이름을 사용해야 합니다. API에 업로드하기 전에 함수를 ZIP 형식으로 압축해야 합니다.

### 함수 압축 요구사항 (출처: https://docs.netlify.com/functions/deploy/?fn-language=js)
1. 함수 파일은 반드시 ZIP 형식으로 압축되어야 합니다.
2. ZIP 파일 내부에는 함수 이름과 동일한 파일명으로 함수 코드가 포함되어야 합니다 (예: `hello-world.js`).
3. Content-Type은 `application/zip`으로 설정해야 합니다.
4. 업로드 시 `runtime` 쿼리 파라미터를 통해 런타임을 지정해야 합니다 (예: `?runtime=js`).

예시:
```javascript
// 1. ZIP 파일 생성
const zip = new JSZip();

// 2. 함수 이름으로 함수 코드 추가 (예: hello-world.js)
zip.file(`${functionName}.js`, functionContent);

// 3. ZIP 생성
const zipBuffer = await zip.generateAsync({
  type: 'uint8array',
  compression: 'DEFLATE',
});

// 4. 함수 업로드
await client.put(
  `https://api.netlify.com/api/v1/deploys/{deploy_id}/functions/{name}?runtime=js`,
  zipBuffer,
  {
    headers: {
      'Content-Type': 'application/zip',
    },
  },
);
```

### 대규모 배포를 위한 비동기 요청
API 요청이 30초 이상 지속되면 자동으로 종료됩니다. 대규모 배포를 생성할 때는 파일 다이제스트에 `async` 속성을 포함시킵니다:

```json
{
  "async": true,
  "files": {
    "/index.html": "907d14fb3af2b0d4f18c2d46abe8aedce17367bd"
  },
  "functions": {
    "hello-world": "708b029d8aa9c8fa513d1a25b97ffb6efb12b423"
  }
}
```

### 배포 상태 확인
배포 상태를 확인하려면 다음 엔드포인트를 사용합니다:
```
GET /api/v1/sites/{site_id}/deploys/{deploy_id}
```

응답의 `state` 파라미터는 다음 값 중 하나를 가집니다:
- `preparing`: 업로드 매니페스트 생성 중
- `prepared`: 매니페스트 생성 완료
- `uploading`: 파일 업로드 중
- `uploaded`: 파일 업로드 완료
- `ready`: 배포 준비 완료

### 추가 고려사항
- 대용량 파일 업로드 시 요청이 시간 초과될 수 있습니다. 이런 경우 업로드를 몇 번 더 시도하여 성공 여부를 확인하는 것이 좋습니다.
- 모든 파일이 업로드되면 Netlify는 배포를 후처리하고 CDN을 무효화합니다.

## 보안
- API는 OAuth 2.0을 사용하여 인증을 처리합니다.
- 모든 요청은 HTTPS를 통해 이루어져야 합니다.
