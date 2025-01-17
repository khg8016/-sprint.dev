# Supabase Edge Functions 배포 프로세스

## entrypoint_path 설명
`entrypoint_path: "./index.ts"`는 단순히 파일 경로를 지정하는 것이 아닙니다. Edge Function을 생성할 때는 다음과 같은 프로세스가 필요합니다:

1. **로컬 개발 환경**
   - Supabase CLI를 사용하여 로컬에서 Edge Function 프로젝트를 생성
   - 프로젝트 구조에 맞게 함수 코드 작성
   ```bash
   # 예시: Edge Function 생성
   supabase functions new my-function
   ```

2. **함수 코드 작성**
   ```typescript
   // /supabase/functions/my-function/index.ts
   export const handler = async (req: Request) => {
     // 함수 로직 구현
     return new Response(JSON.stringify({ message: "Hello" }))
   }
   ```

3. **배포 프로세스**
   - Supabase CLI를 통한 배포
   ```bash
   supabase functions deploy my-function
   ```
   - 이 과정에서 함수 코드가 Supabase의 Edge Function 인프라로 업로드됨

4. **API 엔드포인트 생성**
   - API를 통한 함수 생성(`POST /v1/projects/{ref}/functions`)은 단순히 함수의 메타데이터와 설정을 등록하는 과정
   - 실제 함수 코드는 별도의 배포 프로세스를 통해 업로드되어야 함

## 중요 사항
- `entrypoint_path`는 배포된 함수 코드 내에서 실행을 시작할 진입점을 지정하는 설정
- API 호출만으로는 실제 함수 코드가 배포되지 않음
- Supabase CLI를 통한 proper deployment 프로세스가 필요
- Edge Function 생성과 배포는 별개의 프로세스

## 실제 사용 예시
1. 함수 생성 및 코드 작성
```bash
supabase functions new my-function
# /supabase/functions/my-function/index.ts 작성
```

2. 함수 배포
```bash
supabase functions deploy my-function
```

3. API를 통한 함수 설정 (선택적)
```bash
curl -X POST 'https://api.supabase.com/v1/projects/{ref}/functions' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
-d '{
  "name": "my-function",
  "entrypoint_path": "./index.ts"
}'
