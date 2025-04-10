export interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; // HTTP 메서드
  headers?: Record<string, string>; // 헤더 객체 (Authorization 포함 가능)
  body?: any; // 요청 본문 (JSON)
}
