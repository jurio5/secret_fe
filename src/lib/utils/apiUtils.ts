/**
 * API 호출 재시도 유틸리티 함수
 * 지정된 최대 시도 횟수만큼 API 호출을 재시도합니다.
 * 
 * @param apiCall API 호출 함수
 * @param maxRetries 최대 재시도 횟수 (기본값: 1)
 * @param delayMs 재시도 간 지연 시간 (ms, 기본값: 500)
 * @returns API 호출 결과
 */
export const fetchWithRetry = async <T>(
  apiCall: () => Promise<T>, 
  maxRetries = 1, 
  delayMs = 500
): Promise<T> => {
  let retries = 0;
  let lastError: any;
  
  while (retries <= maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      if (retries === maxRetries) {
        console.error(`API 호출 최대 재시도 횟수(${maxRetries + 1}회) 초과, 실패:`, error);
        break;
      }
      
      console.log(`API 호출 실패, 재시도 중 (${retries + 1}/${maxRetries + 1})...`);
      retries++;
      
      // 재시도 전 지연 시간
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
};

/**
 * 인증 오류(401, 403) 발생 시 콜백을 호출하는 API 유틸리티 함수
 * 
 * @param apiCall API 호출 함수
 * @param onAuthError 인증 오류 발생 시 호출할 콜백 함수
 * @returns API 호출 결과
 */
export const fetchWithAuthErrorHandling = async <T>(
  apiCall: () => Promise<T>,
  onAuthError?: () => void
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error: any) {
    // 응답 상태 코드 확인
    const statusCode = error?.response?.status || error?.status;
    
    // 인증 오류 (401: 인증 없음, 403: 권한 없음)
    if (statusCode === 401 || statusCode === 403) {
      console.error('인증 오류 발생:', statusCode, error);
      
      // 인증 오류 처리 콜백이 있으면 호출
      if (onAuthError) {
        onAuthError();
      }
    }
    
    throw error;
  }
}; 