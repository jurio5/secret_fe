# Quizzle 프론트엔드

이 프로젝트는 Next.js 기반의 Quizzle 프론트엔드 애플리케이션입니다.

## 프로젝트 구조

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

`.env` 파일을 프로젝트 루트에 생성하고 필요한 환경 변수를 설정하세요.

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## OAuth2 인증 흐름

1. 사용자가 OAuth 로그인 버튼 클릭
2. 외부 OAuth 제공자로 리다이렉트
3. 인증 후 `/oauth/callback` 페이지로 리다이렉트
4. `OAuth2RedirectHandler` 컴포넌트에서 처리:
   - 신규 가입: `/join` 페이지로 이동
   - 로그인 성공: 역할에 따라 적절한 페이지로 이동
