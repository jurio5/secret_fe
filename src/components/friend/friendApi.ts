import client from "@/lib/backend/client";
import { Friend, FriendRequest, FriendSearchResult } from "./types";
import { fetchWithRetry, fetchWithAuthErrorHandling } from '@/lib/utils/apiUtils';

// API 기본 URL 설정
const API_BASE_URL = process.env.NEXT_PUBLIC_WAS_HOST || 'https://quizzle.p-e.kr';

// 기본 아바타 URL
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

// 친구 온라인 상태 캐시 (세션 내에서 일관성 유지를 위함)
const getFriendOnlineStatusFromStorage = (memberId: number): boolean | undefined => {
  try {
    const storageKey = 'friend_online_status';
    const storedStatus = localStorage.getItem(storageKey);
    if (storedStatus) {
      const statusData = JSON.parse(storedStatus);
      return statusData[memberId];
    }
    return undefined;
  } catch (error) {
    console.error('온라인 상태 불러오기 실패:', error);
    return undefined;
  }
};

const saveFriendOnlineStatusToStorage = (memberId: number, isOnline: boolean): void => {
  try {
    const storageKey = 'friend_online_status';
    let statusData: Record<number, boolean> = {};
    
    const storedStatus = localStorage.getItem(storageKey);
    if (storedStatus) {
      statusData = JSON.parse(storedStatus);
    }
    
    statusData[memberId] = isOnline;
    localStorage.setItem(storageKey, JSON.stringify(statusData));
  } catch (error) {
    console.error('온라인 상태 저장 실패:', error);
  }
};

// 현재 로그인한 사용자 정보 가져오기
const getCurrentUser = async () => {
  try {
    const response = await fetchWithAuthErrorHandling(
      () => fetchWithRetry(
        () => client.GET("/api/v1/members/me", {}),
        1 // 최대 1번 재시도
      )
    );
    
    if (response.data?.data) {
      return response.data.data;
    }
  } catch (error) {
    console.error("현재 사용자 정보를 가져오는데 실패했습니다:", error);
  }
  return null;
};

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
    
    // API 응답 데이터 (실제 백엔드에서 데이터가 올바르게 오지 않는 경우에 대비한 가공 처리)
    let friends = (response.data?.data || []) as Friend[];
    
    // 데이터 가공: 아바타 URL이 없거나 온라인 상태가 없는 경우 모킹 데이터로 강화
    friends = friends.map(friend => {
      // 로컬 스토리지에서 상태 불러오기
      let isOnline = getFriendOnlineStatusFromStorage(friend.memberId);
      
      // 상태가 없는 경우 랜덤 생성 및 저장
      if (isOnline === undefined) {
        isOnline = Math.random() > 0.5;
        saveFriendOnlineStatusToStorage(friend.memberId, isOnline);
      }
      
      // 아바타 URL이 없는 경우 기본 아바타 제공
      const avatarUrl = friend.avatarUrl || DEFAULT_AVATAR;
      
      return {
        ...friend,
        avatarUrl,
        isOnline
      };
    });
    
    console.log('친구 목록 데이터 (강화됨):', friends);
    return friends;
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
    
    // API 응답 데이터 
    let requests = (response.data?.data || []) as FriendRequest[];
    
    // 데이터 가공: 아바타 URL이 없는 경우 모킹 데이터로 강화
    requests = requests.map(request => {
      // 아바타 URL이 없는 경우 기본 아바타 제공
      const avatarUrl = request.avatarUrl || DEFAULT_AVATAR;
      
      return {
        ...request,
        avatarUrl
      };
    });
    
    console.log('친구 요청 데이터 (강화됨):', requests);
    return requests;
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
    
    // 현재 로그인한 사용자 정보 가져오기
    const currentUser = await getCurrentUser();
    const currentUserId = currentUser?.id;
    console.log('현재 로그인한 사용자 ID:', currentUserId);
    
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
    
    // 결과 데이터 필터링 및 변환 전 로깅
    console.log('필터링 전 검색 결과:', data?.data);
    
    // 백엔드에서 반환된 데이터를 FriendSearchResult 형식으로 변환
    const searchResults = (data?.data || [])
      .filter((member: any) => {
        // 현재 사용자는 검색 결과에서 제외
        return member.id !== currentUserId;
      })
      .map((member: any) => {
        // 상태 결정: 친구, 요청됨, 또는 백엔드에서 제공된 상태
        let status = member.status || 'NONE';
        
        // 이미 친구 목록에 있는 경우
        if (friendIds.includes(member.id)) {
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
    
    // 필터링 결과 로깅
    console.log('필터링 후 검색 결과:', searchResults);
    
    return searchResults;
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
    
    // 현재 로그인한 사용자 정보 가져오기
    const currentUser = await getCurrentUser();
    const currentUserId = currentUser?.id;
    console.log('현재 로그인한 사용자 ID:', currentUserId);
    
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
    
    // 결과 데이터 필터링 및 변환 전 로깅
    console.log('필터링 전 검색 결과:', data?.data);
    
    // 백엔드에서 반환된 데이터를 FriendSearchResult 형식으로 변환
    const searchResults = (data?.data || [])
      .filter((member: any) => {
        // 현재 사용자는 검색 결과에서 제외
        return member.id !== currentUserId;
      })
      .map((member: any) => {
        // 상태 결정: 친구, 요청됨, 또는 백엔드에서 제공된 상태
        let status = member.status || 'NONE';
        
        // 이미 친구 목록에 있는 경우
        if (friendIds.includes(member.id)) {
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
    
    // 필터링 결과 로깅
    console.log('필터링 후 검색 결과:', searchResults);
    
    return searchResults;
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