import { FetchOptions } from "../../types/global/FetchOption";

export const fetchAPI = async <T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> => {
  // 환경 변수에서 타임아웃 값을 가져옴 (기본값 60초)
  const timeout = parseInt(process.env.NEXT_PUBLIC_REQUEST_TIMEOUT || '60000', 10);
  
  // AbortController 설정
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`요청 타임아웃 (${timeout}ms): ${url}`);
    controller.abort();
  }, timeout);
  
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
      body: options.body ? JSON.stringify(options.body) : null,
      signal: options.signal || controller.signal,
    });

    const text = await response.text();
    console.log("응답 상태 코드:", response.status);
    console.log("응답 원본 데이터:", text);

    const isJsonResponse = response.headers
      .get("content-type")
      ?.includes("application/json");

    if (response.ok) {
      if (isJsonResponse) {
        try {
          const rsData = JSON.parse(text);
          return rsData.data as T;
        } catch (jsonError) {
          throw new Error(`응답 JSON 파싱 오류: ${response.status} - ${text}`);
        }
      } else {
        console.warn("응답이 JSON 형식이 아닙니다.", text);
        return text as T;
      }
    } else {
      const errorMessage = isJsonResponse ? text : `오류 메시지: ${text}`;
      throw new Error(
        `API 오류 응답: ${response.status} ${response.statusText} - ${errorMessage}`
      );
    }
  } finally {
    clearTimeout(timeoutId);
  }
};
