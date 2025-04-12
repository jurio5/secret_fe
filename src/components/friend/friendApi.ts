import client from "@/lib/backend/client";
import { Friend, FriendRequest, FriendSearchResult } from "./types";

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

// 닉네임으로 사용자 검색
export const searchUserByNickname = async (nickname: string): Promise<FriendSearchResult[]> => {
  try {
    console.log(`검색 시도: nickname=${nickname}`);
    
    // 백엔드 서버 주소 직접 지정
    const response = await fetch(`http://localhost:8080/api/v1/members/search?nickname=${encodeURIComponent(nickname)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 인증 쿠키 포함
    });
    
    // 400 에러는 검색 결과가 없는 경우일 수 있음
    if (response.status === 400) {
      console.log('검색 결과가 없습니다 (400 응답)');
      return [];
    }
    
    if (!response.ok) {
      console.error(`검색 실패: ${response.status}`, response);
      return []; // 오류 발생 시 빈 배열 반환 (에러 화면 방지)
    }
    
    const data = await response.json();
    console.log('검색 결과 데이터:', data);
    
    // 백엔드에서 반환된 데이터를 FriendSearchResult 형식으로 변환
    return (data?.data || []).map((member: any) => ({
      memberId: member.id,
      nickname: member.nickname,
      avatarUrl: member.avatarUrl,
      level: member.level,
      status: 'NONE' // 기본 상태
    })) as FriendSearchResult[];
  } catch (error) {
    console.error("사용자 검색에 실패했습니다:", error);
    return []; // 오류 발생 시 빈 배열 반환 (에러 화면 방지)
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