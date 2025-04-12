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
    const response = await fetch(`/api/v1/members/search?nickname=${encodeURIComponent(nickname)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`검색 실패: ${response.status}`);
    }
    
    const data = await response.json();
    return (data?.data || []) as FriendSearchResult[];
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