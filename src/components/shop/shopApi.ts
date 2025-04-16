import client from "@/lib/backend/client";
import { Avatar } from './types';
import { fetchWithRetry, fetchWithAuthErrorHandling } from '@/lib/utils/apiUtils';

// API 기본 URL 설정
const API_BASE_URL = process.env.NEXT_PUBLIC_WAS_HOST || 'https://quizzle.p-e.kr';
// 기본 아바타 URL
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

// 사용자가 소유한 아바타 목록 조회
export const getOwnedAvatars = async (userId?: number): Promise<Avatar[]> => {
  try {
    if (!userId) {
      throw new Error('사용자 ID를 찾을 수 없습니다.');
    }

    const memberId = userId;
    
    // client를 any로 타입 캐스팅하여 사용
    const response = await fetchWithAuthErrorHandling(
      () => fetchWithRetry(
        () => (client as any).GET(`/api/v1/members/${memberId}/avatars/owned`, {})
      )
    ) as any;

    // API 응답 데이터 처리
    if (response.data?.data) {
      return response.data.data.map((avatar: any) => ({
        id: avatar.id,
        fileName: avatar.fileName,
        price: avatar.price,
        status: avatar.status,
        url: avatar.url || DEFAULT_AVATAR
      }));
    }
    
    return [];
  } catch (error) {
    console.error('소유한 아바타 목록을 불러오는데 실패했습니다:', error);
    return [];
  }
};

// 구매 가능한 아바타 목록 조회
export const getAvailableAvatars = async (userId?: number): Promise<Avatar[]> => {
  try {
    if (!userId) {
      throw new Error('사용자 ID를 찾을 수 없습니다.');
    }

    const memberId = userId;
    
    // client를 any로 타입 캐스팅하여 사용
    const response = await fetchWithAuthErrorHandling(
      () => fetchWithRetry(
        () => (client as any).GET(`/api/v1/members/${memberId}/avatars/available`, {})
      )
    ) as any;

    // API 응답 데이터 처리
    if (response.data?.data) {
      return response.data.data.map((avatar: any) => ({
        id: avatar.id,
        fileName: avatar.fileName,
        price: avatar.price,
        status: avatar.status,
        url: avatar.url || DEFAULT_AVATAR
      }));
    }
    
    return [];
  } catch (error) {
    console.error('구매 가능한 아바타 목록을 불러오는데 실패했습니다:', error);
    return [];
  }
};

// 아바타 구매
export const purchaseAvatar = async (avatarId: number, userId?: number): Promise<boolean> => {
  try {
    if (!userId) {
      throw new Error('사용자 ID를 찾을 수 없습니다.');
    }

    const memberId = userId;
    
    // client를 any로 타입 캐스팅하여 사용
    const response = await fetchWithAuthErrorHandling(
      () => (client as any).POST(`/api/v1/members/${memberId}/avatars/${avatarId}`, {})
    ) as any;

    return response.data?.status === 'success' || response.data?.resultCode === '200 OK';
  } catch (error) {
    console.error('아바타 구매에 실패했습니다:', error);
    return false;
  }
};

// 현재 사용자 포인트 조회
export const getUserPoints = async (userId?: number): Promise<number> => {
  try {
    if (!userId) {
      throw new Error('사용자 ID를 찾을 수 없습니다.');
    }

    const memberId = userId;
    
    // client를 any로 타입 캐스팅하여 사용
    const response = await fetchWithAuthErrorHandling(
      () => (client as any).GET(`/api/v1/members/${memberId}/profile`, {})
    ) as any;

    if (response.data?.data) {
      return response.data.data.point || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('사용자 포인트를 불러오는데 실패했습니다:', error);
    return 0;
  }
};

// 아바타 장착
export const equipAvatar = async (avatarId: number, userId?: number): Promise<{ success: boolean; message?: string }> => {
  try {
    // userId가 제공되지 않은 경우 현재 로그인한 사용자 정보를 가져옴
    let memberId = userId;
    if (!memberId) {
      console.log("사용자 ID가 제공되지 않았습니다. 현재 로그인한 사용자 정보를 가져옵니다.");
      try {
        const currentUserResponse = await fetchWithAuthErrorHandling(
          () => (client as any).GET("/api/v1/members/me", {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          })
        ) as any;
        
        if (currentUserResponse.data?.data?.id) {
          memberId = currentUserResponse.data.data.id;
          console.log("현재 로그인한 사용자 ID:", memberId);
        } else {
          throw new Error('현재 로그인한 사용자 정보를 찾을 수 없습니다.');
        }
      } catch (userError) {
        console.error('현재 사용자 정보를 가져오는데 실패했습니다:', userError);
        return { success: false, message: '사용자 정보를 가져오는데 실패했습니다. 다시 로그인해주세요.' };
      }
    }
    
    if (!memberId) {
      return { success: false, message: '사용자 ID를 찾을 수 없습니다.' };
    }
    
    // 요청 헤더 추가
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    };
    
    // client를 any로 타입 캐스팅하여 사용
    const response = await fetchWithAuthErrorHandling(
      () => (client as any).PATCH(`/api/v1/members/${memberId}/avatars/${avatarId}`, { headers })
    ) as any;
    
    // 오류 응답 처리
    if (response.error) {
      const errorMsg = response.error.msg || 
                      response.error.error?.msg || 
                      '아바타 장착에 실패했습니다.';
      return { success: false, message: errorMsg };
    }
    
    // 백엔드가 400 에러를 반환했지만 그 안에 메시지가 있는 경우
    if (response.data?.error) {
      return { 
        success: false, 
        message: response.data.error.msg || '아바타 장착에 실패했습니다.' 
      };
    }
    
    // 성공
    return { 
      success: response.data?.resultCode === 'OK' || 
              response.data?.status === 'success' || 
              response.status === 200,
      message: '아바타가 성공적으로 변경되었습니다!'
    };
  } catch (error: any) {
    // 에러 응답에서 메시지 추출
    let errorMessage = '아바타 장착에 실패했습니다.';
    
    if (error.response?.data?.error?.msg) {
      errorMessage = error.response.data.error.msg;
    } else if (error.error?.msg) {
      errorMessage = error.error.msg;
    }
    
    return { success: false, message: errorMessage };
  }
}; 