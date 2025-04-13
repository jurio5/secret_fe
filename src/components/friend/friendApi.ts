import client from "@/lib/backend/client";
import { Friend, FriendRequest, FriendSearchResult } from "./types";
import { fetchWithRetry, fetchWithAuthErrorHandling } from '@/lib/utils/apiUtils';

// API 기본 URL 설정
const API_BASE_URL = process.env.NEXT_PUBLIC_WAS_HOST || 'https://quizzle.p-e.kr';

// 친구 목록 조회
export const getFriendList = async (): Promise<Friend[]> => {
  try {
    // 인증 오류 처리 및 재시도 로직 적용
    const response = await fetchWithAuthErrorHandling(
      () => fetchWithRetry(
        () => client.GET("/api/v1/friends", {}),
        1 // 최대 1번 재시도
      )
    );
    
    return (response.data?.data || []) as Friend[];
  } catch (error) {
    console.error("친구 목록을 불러오는데 실패했습니다:", error);
    return [];
  }
};

// 친구 요청 목록 조회
export const getFriendRequests = async (): Promise<FriendRequest[]> => {
  try {
    // 인증 오류 처리 및 재시도 로직 적용
    const response = await fetchWithAuthErrorHandling(
      () => fetchWithRetry(
        () => client.GET("/api/v1/friends/requests", {}),
        1 // 최대 1번 재시도
      )
    );
    
    return (response.data?.data || []) as FriendRequest[];
  } catch (error) {
    console.error("친구 요청 목록을 불러오는데 실패했습니다:", error);
    return [];
  }
};

// 닉네임으로 사용자 검색 (환경에 맞게 최적화된 버전)
export const searchUserByNickname = async (nickname: string): Promise<FriendSearchResult[]> => {
  try {
    console.log(`검색 시도: nickname=${nickname}`);
    
    // 현재 친구 목록을 가져옴
    const friendList = await getFriendList();
    const friendIds = friendList.map(friend => friend.memberId);
    
    // client 객체를 통한 API 호출 - 타입 캐스팅으로 타입 오류 해결
    const response = await (client as any).GET("/api/v1/members/search", {
      params: {
        query: { nickname }
      }
    });
    
    const { data, error } = response;
    
    // 오류 처리
    if (error) {
      console.error('검색 중 오류 발생:', error);
      
      // HTTP 상태 코드 확인
      if (response.response?.status === 401 || response.response?.status === 403) {
        console.error('인증 오류: 로그인이 필요하거나 권한이 없습니다');
        return [];
      }
      
      if (response.response?.status === 400) {
        console.log('검색 결과가 없습니다 (400 응답)');
        return [];
      }
      
      return []; // 기타 오류 시 빈 배열 반환
    }
    
    console.log('검색 결과 데이터:', data);
    
    // 백엔드에서 반환된 데이터를 FriendSearchResult 형식으로 변환
    return (data?.data || []).map((member: any) => {
      // 현재 사용자 ID
      const currentUserId = (window as any).__INITIAL_USER__?.memberId;
      
      // 상태 결정: 자신, 친구, 요청됨, 또는 백엔드에서 제공된 상태
      let status = member.status || 'NONE';
      
      // 자신인 경우
      if (member.id === currentUserId) {
        status = 'SELF';
      } 
      // 이미 친구 목록에 있는 경우
      else if (friendIds.includes(member.id)) {
        status = 'FRIEND';
      }
      
      return {
        memberId: member.id,
        nickname: member.nickname,
        avatarUrl: member.avatarUrl,
        level: member.level,
        status: status
      };
    }) as FriendSearchResult[];
  } catch (error) {
    console.error("사용자 검색에 실패했습니다:", error);
    return [];
  }
};

// client 객체를 이용한 검색 방법 (타입 문제가 있을 경우 위의 함수를 사용)
export const searchUserByNicknameWithClient = async (nickname: string): Promise<FriendSearchResult[]> => {
  try {
    console.log(`Client 객체로 검색 시도: nickname=${nickname}`);
    
    // 현재 친구 목록을 가져옴
    const friendList = await getFriendList();
    const friendIds = friendList.map(friend => friend.memberId);
    
    // client 객체를 any로 캐스팅하여 타입 오류 방지
    const response = await (client as any).GET("/api/v1/members/search", {
      params: {
        query: { nickname }
      }
    });
    
    const { data, error } = response;
    
    if (error) {
      // 오류 코드 및 응답 로깅
      console.error('검색 중 오류 발생:', error, '응답 상태:', response.response?.status);
      
      // 400 에러는 검색 결과가 없는 경우로 처리
      if (response.response?.status === 400) {
        console.log('검색 결과가 없습니다 (400 응답)');
        return [];
      }
      
      // 401 또는 403 오류는 인증 문제로 처리
      if (response.response?.status === 401 || response.response?.status === 403) {
        console.error('인증 오류: 로그인이 필요하거나 권한이 없습니다');
        // 사용자에게 재로그인 유도 등의 처리 필요
        return [];
      }
      
      return []; // 기타 오류 시 빈 배열 반환
    }
    
    console.log('검색 결과 데이터:', data);
    
    // 백엔드에서 반환된 데이터를 FriendSearchResult 형식으로 변환
    return (data?.data || []).map((member: any) => {
      // 현재 사용자 ID
      const currentUserId = (window as any).__INITIAL_USER__?.memberId;
      
      // 상태 결정: 자신, 친구, 요청됨, 또는 백엔드에서 제공된 상태
      let status = member.status || 'NONE';
      
      // 자신인 경우
      if (member.id === currentUserId) {
        status = 'SELF';
      } 
      // 이미 친구 목록에 있는 경우
      else if (friendIds.includes(member.id)) {
        status = 'FRIEND';
      }
      
      return {
        memberId: member.id,
        nickname: member.nickname,
        avatarUrl: member.avatarUrl,
        level: member.level,
        status: status
      };
    }) as FriendSearchResult[];
  } catch (error) {
    console.error("사용자 검색에 실패했습니다:", error);
    return [];
  }
};

// 친구 요청 보내기
export const sendFriendRequest = async (memberId: number): Promise<boolean> => {
  try {
    // 인증 오류 처리 및 재시도 로직 적용
    await fetchWithAuthErrorHandling(
      () => client.POST(`/api/v1/friends/{memberId}/request`, {
        params: { path: { memberId } }
      })
    );
    return true;
  } catch (error) {
    console.error("친구 요청 전송에 실패했습니다:", error);
    return false;
  }
};

// 친구 요청 수락
export const acceptFriendRequest = async (memberId: number): Promise<boolean> => {
  try {
    // 인증 오류 처리 및 재시도 로직 적용
    await fetchWithAuthErrorHandling(
      () => client.POST(`/api/v1/friends/{memberId}/accept`, {
        params: { path: { memberId } }
      })
    );
    return true;
  } catch (error) {
    console.error("친구 요청 수락에 실패했습니다:", error);
    return false;
  }
};

// 친구 요청 거절
export const rejectFriendRequest = async (memberId: number): Promise<boolean> => {
  try {
    // 인증 오류 처리 및 재시도 로직 적용
    await fetchWithAuthErrorHandling(
      () => client.POST(`/api/v1/friends/{memberId}/reject`, {
        params: { path: { memberId } }
      })
    );
    return true;
  } catch (error) {
    console.error("친구 요청 거절에 실패했습니다:", error);
    return false;
  }
};

// 친구 삭제
export const deleteFriend = async (memberId: number): Promise<boolean> => {
  try {
    // 인증 오류 처리 및 재시도 로직 적용
    await fetchWithAuthErrorHandling(
      () => client.DELETE(`/api/v1/friends/{memberId}`, {
        params: { path: { memberId } }
      })
    );
    return true;
  } catch (error) {
    console.error("친구 삭제에 실패했습니다:", error);
    return false;
  }
}; 