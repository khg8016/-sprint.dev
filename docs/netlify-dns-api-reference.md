# Netlify DNS API Reference

## DNS 레코드 관리 API

### 1. DNS 레코드 생성
```http
POST /api/v1/dns_zones/{zone_id}/dns_records
```

요청 헤더:
```
Content-Type: application/json
Authorization: Bearer {netlifyAuth}
```

요청 바디:
```json
{
  "type": "CNAME",
  "hostname": "subdomain",
  "value": "target.netlify.app",
  "ttl": 3600,
  "priority": 0,
  "weight": 0,
  "port": 0,
  "flag": 0
}
```

필수 파라미터:
- zone_id: DNS 존 ID
- type: 레코드 타입 (예: CNAME)
- hostname: 서브도메인
- value: 타겟 도메인

선택 파라미터:
- ttl: Time To Live (초 단위)
- priority: 우선순위
- weight: 가중치
- port: 포트 번호
- flag: 플래그 값

### 2. DNS 레코드 조회
```http
GET /api/v1/dns_zones/{zone_id}/dns_records
```

요청 헤더:
```
Authorization: Bearer {netlifyAuth}
```

응답:
```json
{
  "records": [
    {
      "id": "record-id",
      "type": "CNAME",
      "hostname": "subdomain",
      "value": "target.netlify.app",
      "ttl": 3600
    }
  ]
}
```

### 3. DNS 레코드 삭제
```http
DELETE /api/v1/dns_zones/{zone_id}/dns_records/{record_id}
```

요청 헤더:
```
Authorization: Bearer {netlifyAuth}
```

### 4. 사이트 DNS 설정
```http
PUT /api/v1/sites/{site_id}/dns
```

요청 헤더:
```
Content-Type: application/json
Authorization: Bearer {netlifyAuth}
```

요청 바디:
```json
{
  "dns_zone": "sprintsolo.dev",
  "records": [
    {
      "type": "CNAME",
      "hostname": "subdomain",
      "value": "site-name.netlify.app",
      "ttl": 3600
    }
  ]
}
```

## 주요 특징

1. 인증:
   - 모든 API 요청에는 Netlify 인증 토큰이 필요
   - Bearer 토큰 방식 사용

2. DNS 레코드 타입:
   - CNAME: 서브도메인을 Netlify 사이트로 연결
   - 기타: A, AAAA, MX, TXT 등 지원

3. TTL (Time To Live):
   - 기본값: 3600초 (1시간)
   - 최소값: 60초
   - 최대값: 86400초 (24시간)

4. 에러 처리:
   - 400: 잘못된 요청
   - 401: 인증 실패
   - 404: 리소스 없음
   - 500: 서버 에러

## 사용 예시

1. 새 사이트의 DNS 설정:
```javascript
// 1. 사이트 생성
const site = await createSite();

// 2. DNS 레코드 생성
await createDnsRecord({
  zone_id: "zone_id",
  type: "CNAME",
  hostname: "subdomain",
  value: `${site.name}.netlify.app`
});
```

2. 기존 DNS 레코드 업데이트:
```javascript
// 1. 기존 레코드 조회
const records = await getDnsRecords(zone_id);
const existingRecord = records.find(r => r.hostname === "subdomain");

// 2. 레코드 삭제
if (existingRecord) {
  await deleteDnsRecord(zone_id, existingRecord.id);
}

// 3. 새 레코드 생성
await createDnsRecord({
  zone_id: "zone_id",
  type: "CNAME",
  hostname: "subdomain",
  value: "new-site.netlify.app"
});