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
export const equipAvatar = async (avatarId: number, userId?: number): Promise<boolean> => {
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
        throw new Error('사용자 정보를 가져오는데 실패했습니다. 다시 로그인해주세요.');
      }
    }
    
    if (!memberId) {
      throw new Error('사용자 ID를 찾을 수 없습니다.');
    }
    
    // 요청 헤더 추가
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    };
    
    console.log(`아바타 장착 요청: PATCH /api/v1/members/${memberId}/avatars/${avatarId}`);
    
    // client를 any로 타입 캐스팅하여 사용
    const response = await fetchWithAuthErrorHandling(
      () => (client as any).PATCH(`/api/v1/members/${memberId}/avatars/${avatarId}`, { headers })
    ) as any;

    console.log('아바타 장착 응답:', JSON.stringify(response, null, 2));
    
    if (response.error) {
      console.error('아바타 장착 실패 응답:', response.error);
      return false;
    }
    
    // 백엔드 응답에 맞게 성공 여부 체크 로직 수정
    // 실제 응답은 response.data.resultCode가 'OK'인 형태
    return response.data?.resultCode === 'OK' || 
           response.data?.status === 'success' || 
           response.status === 200;
  } catch (error: any) {
    console.error('아바타 장착 오류 세부정보:', error);
    console.error('오류 메시지:', error.message);
    console.error('오류 응답:', error.response?.data);
    console.error('오류 상태코드:', error.response?.status);
    return false;
  }
}; 