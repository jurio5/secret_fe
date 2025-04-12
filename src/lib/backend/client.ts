import createClient from "openapi-fetch";

import type { paths } from "@/lib/backend/apiV1/schema";

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const cookieToken = getCookie('access_token');
  if (cookieToken) {
    console.log('쿠키에서 토큰 찾음');
    return cookieToken;
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('access_token');
  if (urlToken) {
    console.log('URL에서 토큰 찾음');
    localStorage.setItem('access_token', urlToken);
    return urlToken;
  }
  
  const localStorageToken = localStorage.getItem('access_token');
  if (localStorageToken) {
    console.log('로컬스토리지에서 토큰 찾음');
    return localStorageToken;
  }
  
  console.warn('토큰을 어디에서도 찾을 수 없음');
  return null;
};

type FetchOptions = {
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  method?: string;
  body?: any;
  [key: string]: any;
};

const customFetch = (input: RequestInfo | URL, init?: FetchOptions) => {
  const options = init || {};
  
  console.log(`API 요청: ${options.method || 'GET'} ${typeof input === 'string' ? input : input.toString()}`);
  
  const accessToken = getAccessToken();
  const headers = options.headers || {};
  
  if (accessToken) {
    console.log('토큰 확인됨, 인증 헤더 추가');
    options.headers = {
      ...headers,
      'Authorization': `Bearer ${accessToken}`,
    };
  } else {
    console.warn('토큰이 없습니다! 인증 실패 가능성 있음');
  }
  
  options.credentials = 'include';
  
  return fetch(input, options);
};

const client = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_WAS_HOST,
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  fetch: customFetch
});

export default client;
