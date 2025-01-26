# SprintSolo.dev 자동 배포 시스템 설계

## 0. 사용자 시나리오

### 0.1 기본 흐름

1. 사용자가 채팅을 통해 코드 작성

```
사용자: "React로 Todo 앱을 만들어줘"
AI: Todo 앱 코드 생성 및 파일 작성
```

2. 사용자가 Deploy 버튼 클릭

```
- 현재 채팅 세션의 모든 파일이 수집됨
- 자동으로 [chatId].sprint.solo.dev 서브도메인 생성
- Cloudflare Pages를 통해 배포
```

3. 배포 완료 및 접근

```
- 배포 완료 알림
- https://[chatId].sprint.solo.dev 로 접속 가능
```

### 0.2 예시 시나리오

````
1. 사용자가 채팅 시작
   - 새로운 채팅 세션 생성 (chatId: abc123)

2. AI와의 대화로 코드 작성
   사용자: "React로 Todo 앱을 만들어줘"
   AI: src/App.js, src/components/TodoList.js 등 생성

3. Deploy 버튼 클릭
   - 프로젝트 ID: sprint-abc123-[timestamp]
   - 도메인: abc123.sprint.solo.dev
   - 자동 SSL 인증서 발급

```sql
-- 배포 정보 테이블
create table deployments (
  id uuid primary key default uuid_generate_v4(),
  chat_id text references chats(id),
  subdomain text unique,
  status text,
  cloudflare_deployment_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 배포 로그 테이블
create table deployment_logs (
  id uuid primary key default uuid_generate_v4(),
  deployment_id uuid references deployments(id),
  log_type text,
  message text,
  created_at timestamp with time zone default now()
);
````

## 1. 시스템 개요

### 1.1 핵심 기능

- AI 기반 코드 생성 및 관리
- 원클릭 자동 배포
- 서브도메인 기반 프로젝트 호스팅

### 1.2 기술 스택

- Frontend: Remix, React, TypeScript
- Backend: Supabase Edge Functions
- 배포: Cloudflare Pages
- DNS: Cloudflare DNS
- 데이터베이스: Supabase PostgreSQL

## 2. 상세 아키텍처

### 2.1 데이터베이스 스키마

```typescript
-- 배포 정보 테이블
create table deployments (
  id uuid primary key default uuid_generate_v4(),
  chat_id text references chats(id),
  subdomain text unique,
  status text,
  cloudflare_deployment_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 배포 로그 테이블
create table deployment_logs (
  id uuid primary key default uuid_generate_v4(),
  deployment_id uuid references deployments(id),
  log_type text,
  message text,
  created_at timestamp with time zone default now()
);
2.2 Supabase Edge Functions
// /supabase/functions/deploy/index.ts
interface DeploymentConfig {
  chatId: string;
  files: FileMap;
  subdomain: string;
}

async function deployToCloudflare(config: DeploymentConfig) {
  // 1. 파일 패키징
  // 2. Cloudflare Pages API 호출
  // 3. DNS 레코드 설정
  // 4. 배포 상태 추적
}
3. 배포 프로세스
3.1 사용자 코드 생성 단계
사용자가 채팅으로 코드 작성 요청
AI가 코드 생성 및 파일 작성
WebContainer가 가상 파일 시스템에 파일 저장
workbenchStore가 파일 상태 관리
3.2 배포 단계
사용자가 Deploy 버튼 클릭
Frontend에서 배포 프로세스 시작:
async function handleDeploy() {
  const chatId = getCurrentChatId();
  const files = workbenchStore.files.get();

  // Supabase Edge Function 호출
  const { data, error } = await supabase.functions.invoke('deploy', {
    body: { chatId, files }
  });
}
Supabase Edge Function 실행:
// 1. 프로젝트 준비
const projectId = `sprint-${chatId}-${timestamp}`;
const subdomain = `${chatId}.sprint.solo.dev`;

// 2. Cloudflare Pages API 호출
const deployment = await createCloudflareDeployment({
  projectId,
  files,
  subdomain
});

// 3. DNS 레코드 설정
await setupDNSRecord({
  subdomain,
  target: deployment.url
});
배포 상태 모니터링:
// 배포 상태 업데이트
async function updateDeploymentStatus(deploymentId: string) {
  const status = await checkCloudflareStatus(deploymentId);
  await supabase.from('deployments')
    .update({ status })
    .match({ id: deploymentId });
}
3.3 DNS 설정
async function setupDNSRecord(config: {
  subdomain: string;
  target: string;
}) {
  // Cloudflare API를 통한 DNS 레코드 생성
  await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'CNAME',
      name: config.subdomain,
      content: config.target,
      proxied: true
    })
  });
}
4. 보안 및 환경 설정
4.1 필요한 환경 변수
# Cloudflare 설정
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_ZONE_ID=xxx

# Supabase 설정
SUPABASE_URL=xxx
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
4.2 보안 고려사항
Cloudflare API 토큰 권한 제한
배포 요청 인증 검증
리소스 사용량 제한
SSL/TLS 인증서 자동 관리
5. 모니터링 및 로깅
5.1 배포 모니터링
interface DeploymentStatus {
  status: 'pending' | 'building' | 'deployed' | 'failed';
  url?: string;
  error?: string;
}

// 배포 상태 추적
function trackDeployment(deploymentId: string) {
  const status = supabase
    .from('deployments')
    .on('UPDATE', handleStatusUpdate)
    .subscribe();
}
5.2 로그 관리
배포 과정 상세 로깅
에러 추적 및 알림
리소스 사용량 모니터링
6. 에러 처리 및 복구
6.1 에러 시나리오
파일 패키징 실패
Cloudflare 배포 실패
DNS 설정 실패
6.2 복구 전략
async function handleDeploymentError(error: Error) {
  // 1. 에러 로깅
  await logError(error);

  // 2. 리소스 정리
  await cleanup();

  // 3. 사용자에게 알림
  notifyUser(error.message);

  // 4. 자동 재시도 (선택적)
  if (isRetryable(error)) {
    await retryDeployment();
  }
}
7. 확장성 고려사항
7.1 스케일링
Edge Functions의 동시 실행 제한 고려
큰 프로젝트 처리를 위한 청크 업로드
캐싱 전략 구현
7.2 향후 개선사항
커스텀 도메인 지원
배포 이력 관리
롤백 기능
프리뷰 환경 제공
```
