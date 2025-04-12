import client from "@/lib/backend/client";
import { Friend, FriendRequest, FriendSearchResult } from "./types";

// API 기본 URL 설정
const API_BASE_URL = process.env.NEXT_PUBLIC_WAS_HOST || 'https://quizzle.p-e.kr';

// 친구 목록 조회
export const getFriendList = async (): Promise<Friend[]> => {
  try {
    const { data } = await client.GET("/api/v1/friends", {});
    return (data?.data || []) as Friend[];
  } catch (error) {
    console.error("친구 목록을 불러오는데 실패했습니다:", error);
    return [];
  }
};

// 친구 요청 목록 조회
export const getFriendRequests = async (): Promise<FriendRequest[]> => {
  try {
    const { data } = await client.GET("/api/v1/friends/requests", {});
    return (data?.data || []) as FriendRequest[];
  } catch (error) {
    console.error("친구 요청 목록을 불러오는데 실패했습니다:", error);
    return [];
  }
};

// 닉네임으로 사용자 검색 (환경에 맞게 최적화된 버전)
export const searchUserByNickname = async (nickname: string): Promise<FriendSearchResult[]> => {
  try {
    console.log(`검색 시도: nickname=${nickname}`);
    
    // 직접 fetch로 호출 - 환경변수에 따른 API 주소 사용
    const url = `${API_BASE_URL}/api/v1/members/search?nickname=${encodeURIComponent(nickname)}`;
    console.log(`API 호출: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 인증 쿠키 포함
    });
    
    // HTTP 응답 상태 로깅
    console.log(`검색 응답 상태: ${response.status}`);
    
    // 400 에러는 검색 결과가 없는 경우로 처리
    if (response.status === 400) {
      console.log('검색 결과가 없습니다 (400 응답)');
      return [];
    }
    
    // 401 또는 403 오류는 인증 문제로 처리
    if (response.status === 401 || response.status === 403) {
      console.error('인증 오류: 로그인이 필요하거나 권한이 없습니다');
      // 사용자에게 재로그인 유도 등의 처리 필요
      return [];
    }
    
    // 기타 오류 처리
    if (!response.ok) {
      console.error(`검색 실패: ${response.status}`, response);
      return []; // 오류 발생 시 빈 배열 반환 (에러 화면 방지)
    }
    
    const responseData = await response.json();
    console.log('검색 결과 데이터:', responseData);
    
    // 백엔드에서 반환된 데이터를 FriendSearchResult 형식으로 변환
    return (responseData?.data || []).map((member: any) => ({
      memberId: member.id,
      nickname: member.nickname,
      avatarUrl: member.avatarUrl,
      level: member.level,
      status: 'NONE' // 기본 상태
    })) as FriendSearchResult[];
  } catch (error) {
    console.error("사용자 검색에 실패했습니다:", error);
    
    // 애플리케이션 중단 방지를 위해 빈 배열 반환
    return [];
  }
};

// client 객체를 이용한 검색 방법 (타입 문제가 있을 경우 위의 함수를 사용)
export const searchUserByNicknameWithClient = async (nickname: string): Promise<FriendSearchResult[]> => {
  try {
    console.log(`Client 객체로 검색 시도: nickname=${nickname}`);
    
    // client 객체를 any로 캐스팅하여 타입 오류 방지
    const { data, error, response } = await (client as any).GET("/api/v1/members/search", {
      params: {
        query: { nickname }
      }
    });
    
    if (error) {
      // 오류 코드 및 응답 로깅
      console.error('검색 중 오류 발생:', error, '응답 상태:', (response as any)?.status);
      
      // 400 에러는 검색 결과가 없는 경우로 처리
      if ((response as any)?.status === 400) {
        console.log('검색 결과가 없습니다 (400 응답)');
        return [];
      }
      
      // 401 또는 403 오류는 인증 문제로 처리
      if ((response as any)?.status === 401 || (response as any)?.status === 403) {
        console.error('인증 오류: 로그인이 필요하거나 권한이 없습니다');
        // 사용자에게 재로그인 유도 등의 처리 필요
        return [];
      }
      
      return []; // 기타 오류 시 빈 배열 반환
    }
    
    console.log('검색 결과 데이터:', data);
    
    // 백엔드에서 반환된 데이터를 FriendSearchResult 형식으로 변환
    return ((data as any)?.data || []).map((member: any) => ({
      memberId: member.id,
      nickname: member.nickname,
      avatarUrl: member.avatarUrl,
      level: member.level,
      status: 'NONE' // 기본 상태
    })) as FriendSearchResult[];
  } catch (error) {
    console.error("사용자 검색에 실패했습니다:", error);
    return [];
  }
};

// 친구 요청 보내기
export const sendFriendRequest = async (memberId: number): Promise<boolean> => {
  try {
    await client.POST(`/api/v1/friends/{memberId}/request`, {
      params: { path: { memberId } }
    });
    return true;
  } catch (error) {
    console.error("친구 요청 전송에 실패했습니다:", error);
    return false;
  }
};

// 친구 요청 수락
export const acceptFriendRequest = async (memberId: number): Promise<boolean> => {
  try {
    await client.POST(`/api/v1/friends/{memberId}/accept`, {
      params: { path: { memberId } }
    });
    return true;
  } catch (error) {
    console.error("친구 요청 수락에 실패했습니다:", error);
    return false;
  }
};

// 친구 요청 거절
export const rejectFriendRequest = async (memberId: number): Promise<boolean> => {
  try {
    await client.POST(`/api/v1/friends/{memberId}/reject`, {
      params: { path: { memberId } }
    });
    return true;
  } catch (error) {
    console.error("친구 요청 거절에 실패했습니다:", error);
    return false;
  }
};

// 친구 삭제
export const deleteFriend = async (memberId: number): Promise<boolean> => {
  try {
    await client.DELETE(`/api/v1/friends/{memberId}`, {
      params: { path: { memberId } }
    });
    return true;
  } catch (error) {
    console.error("친구 삭제에 실패했습니다:", error);
    return false;
  }
}; 