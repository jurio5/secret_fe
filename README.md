```
frontend/
│
├─ node_modules/
├─ public/
│
├─ src/
│  ├─ app/
│  │  ├─ oauth/
│  │  │  └─ callback/
│  │  │     └─ page.tsx  # OAuth 콜백 페이지
│  │  ├─ layout.tsx      # 앱 레이아웃
│  │  ├─ page.tsx        # 메인 페이지
│  │  └─ globals.css     # 전역 스타일
│  │
│  ├─ components/
│  │  ├─ ui/             # 공통 UI 컴포넌트
│  │  └─ auth/
│  │     └─ OAuth2RedirectHandler.tsx  # OAuth 처리 컴포넌트
│  │
│  └─ lib/
│     ├─ api/
│     │  ├─ auth/
│     │  │  └─ AuthApi.ts  # 인증 관련 API
│     │  └─ global/
│     │     └─ FetchApi.ts  # API 유틸리티
│     │
│     ├─ types/
│     │  ├─ global/
│     │  │  └─ FetchOption.ts  # API 요청 타입
│     │  └─ RsData.ts  # API 응답 타입
│     │
│     └─ utils/
│        ├─ CookieUtil.ts  # 쿠키 유틸리티
│        └─ utils.ts  # 기타 유틸리티
│
├─ .gitignore
├─ next.config.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

## 실행 방법

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start
```

## 환경 설정

### 로컬 개발 환경

`.env.development` 파일을 프로젝트 루트에 생성하고 필요한 환경 변수를 설정하세요.

```
NEXT_PUBLIC_NODE_ENV=development
NEXT_PUBLIC_WAS_HOST=http://localhost:8080
NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_KAKAO_AUTH_CLIENT_ID=your-kakao-client-id
NEXT_PUBLIC_REQUEST_TIMEOUT=60000
```

### 프로덕션 환경 (Vercel)

프로덕션 환경에서는 Vercel 대시보드의 환경 변수 설정을 사용합니다:

## 배포

이 프로젝트는 Vercel을 통해 배포됩니다. 메인 배포 URL: [secret-fe.vercel.app](https://secret-fe.vercel.app/)

## 통신관련 스키마 업데이트

```bash
npx --package typescript --package openapi-typescript openapi-typescript http://localhost:8080/v3/api-docs/api -o src/lib/backend/apiV1/schema.d.ts --properties-required-by-default
```
