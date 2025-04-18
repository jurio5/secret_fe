"use client";

import { useEffect, Suspense, useState, useRef } from "react";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { components } from "@/lib/backend/apiV1/schema";
import { subscribe, unsubscribe, publish, reconnectWebSocket, stompClient } from "@/lib/backend/stompClient";
import Toast, { ToastProps } from "@/components/common/Toast";
import { FaTrophy, FaUserFriends, FaUser, FaComments } from "react-icons/fa";
import { useRouter } from "next/navigation";
import FriendModal from '@/components/friend/FriendModal';
import RankingModal from '@/components/ranking/RankingModal';
import { updateOnlineUserIds } from '@/components/friend/friendApi';
import ShopModal from '@/components/shop/ShopModal';
import { DEFAULT_AVATAR } from '@/lib/constants';

interface User {
  id: number;
  email: string;
  nickname: string;
  sessions: string[];
  lastActive: number;
  status: string;
  avatarUrl?: string;
  location?: string;
  roomId?: number;
}

// 프로필 정보 타입
interface UserProfile {
  id?: number;
  nickname?: string;
  avatarUrl?: string;
  level?: number;
  exp?: number;
  point?: number;
  loading?: boolean;
  error?: string;
  lastUpdated?: number;
}

// 룸 정보 타입
type RoomResponse = {
  id?: number;
  title?: string;
  status?: string;
  ownerId?: number;
  ownerNickname?: string;
  currentParticipants?: number; // 백엔드의 currentPlayers와 매핑
  maxParticipants?: number;     // 백엔드의 capacity와 매핑
  createdAt?: string;
  difficulty?: string;          // 난이도 추가
  mainCategory?: string;        // 메인 카테고리 추가
  subCategory?: string;         // 서브 카테고리 추가
  questionCount?: number;       // 문제 수 추가
  
  // 백엔드 스키마와 일치시키기 위한 필드
  capacity?: number;            // 최대 참가자 수 (maxParticipants와 동일)
  currentPlayers?: number;      // 현재 참가자 수 (currentParticipants와 동일)
  isPrivate?: boolean;          // 비공개 방 여부
  password?: string;           // 비밀번호
  players?: number[];          // 참가자 ID 목록
  readyPlayers?: number[];     // 준비 완료 플레이어 ID 목록
}

// API 응답 타입
type ApiResponse<T> = {
  error?: {
    message?: string;
  };
  data?: {
    data: T;
  };
};

// 사용자 ID별 프로필 캐시
const userProfileCache: Record<number, UserProfile> = {};

// 채팅 메시지를 임시로 저장할 캐시 (웹소켓 연결이 끊겼다 다시 연결되어도 메시지가 유지되도록)
let lobbyMessageCache: any[] = [];

// 기본 아바타 URL
// const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

// 랭킹 정보 타입 정의
// interface MemberRanking {
//   id: number;
//   nickname: string;
//   exp: number;
//   level: number;
//   rank: number;
//   avatarUrl?: string;
// }

// activeUsers 타입 정의 업데이트
type ActiveUser = {
  id: number;
  nickname: string;
  status: string;
  avatarUrl?: string;
  location?: string;
  roomId?: number | null;
  // User 타입과 호환되도록 필요한 필드 추가
  email?: string;
  sessions?: string[];
  lastActive?: number;
};

function LobbyContent({ 
  showCreateRoomModal: externalShowCreateRoomModal, 
  setShowCreateRoomModal: externalSetShowCreateRoomModal 
}: { 
  showCreateRoomModal: boolean;
  setShowCreateRoomModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showNicknameModal, setShowNicknameModal] = useState<boolean>(false);
  const [newNickname, setNewNickname] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [isChangingNickname, setIsChangingNickname] = useState<boolean>(false);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(false);
  const [showRankingModal, setShowRankingModal] = useState<boolean>(false);
  const [showFriendModal, setShowFriendModal] = useState<boolean>(false);
  const [friendRequestCount, setFriendRequestCount] = useState<number>(0);
  // 방 생성 모달 상태 추가
  const [showCreateRoomModal, setShowCreateRoomModal] = [externalShowCreateRoomModal, externalSetShowCreateRoomModal];
  // 방 생성 관련 상태 추가
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [roomCreateError, setRoomCreateError] = useState<string>("");
  // 상점 모달 상태 추가
  const [showShopModal, setShowShopModal] = useState<boolean>(false);
  
  // 비밀번호 입력 모달 상태 추가
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomResponse | null>(null);
  const [roomPassword, setRoomPassword] = useState<string>("");
  const [isJoiningRoom, setIsJoiningRoom] = useState<boolean>(false);
  const [joinRoomError, setJoinRoomError] = useState<string>("");
  
  // 세션 로딩 재시도 횟수 관리
  const userLoadRetryCountRef = useRef<number>(0);
  
  // 채팅 관련 상태 추가
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState<string>("");
  const [showChat, setShowChat] = useState<boolean>(true);
  const [showFriendList, setShowFriendList] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  
  const router = useRouter();
  
  // 세션 무효화 오류 확인 함수
  const checkSessionError = (error: any): boolean => {
    const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
    return errorStr.includes("Session was invalidated") || 
           errorStr.includes("HTTP Status 500 – Internal Server Error");
  };

  // 세션 정리 함수 - 로그아웃 처리, 쿠키 및 로컬 스토리지 정리
  const cleanupSession = async () => {
    try {
      // 백엔드에 로그아웃 요청 (세션 및 HTTP-Only 쿠키 삭제)
      await client.DELETE("/api/v1/members").catch(() => {
        console.log("로그아웃 API 호출 실패, 수동 정리 진행");
      });
      
      // 모든 쿠키 삭제
      document.cookie.split(";").forEach(c => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/");
      });
      
      // 도메인 쿠키도 삭제 시도
      document.cookie.split(";").forEach(c => {
        const cookieName = c.replace(/^ +/, "").split("=")[0];
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });
      
      // 로컬 스토리지 정리
      localStorage.clear();
      
      // 세션 스토리지 정리
      sessionStorage.clear();
      
      console.log("세션 정리 완료");
    } catch (error) {
      console.error("세션 정리 중 오류 발생:", error);
    }
  };

  // 세션 재연결 시도 함수
  const tryReconnectSession = async (retryCount = 0, maxRetries = 1) => {
    console.log(`세션이 만료되었습니다. 자동으로 재연결을 시도합니다. (시도: ${retryCount + 1}/${maxRetries + 1})`);
    
    // 이미 최대 재시도 횟수를 초과한 경우
    if (retryCount > maxRetries) {
      console.log("최대 재시도 횟수를 초과했습니다. 로그인 페이지로 이동합니다.");
      
      // 쿠키와 로컬 스토리지 완전 초기화
      cleanupSession();
      
      // 오류 메시지 토스트 표시
      setToast({
        type: "error",
        message: "세션 복구에 실패했습니다. 다시 로그인해주세요.",
        duration: 3000
      });
      
      // 3초 후 로그인 페이지로 리다이렉트
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
      return false;
    }
    
    // 토스트 메시지로 사용자에게 알림
    if (retryCount === 0) {
      setToast({
        type: "info",
        message: "세션이 만료되었습니다. 자동으로 재연결 중...",
        duration: 5000
      });
    }
    
    try {
      // 현재 사용자 정보 다시 가져오기 시도
      const response = await client.GET("/api/v1/members/me") as ApiResponse<User>;
      
      if (response.data?.data) {
        // 성공적으로 사용자 정보를 가져온 경우
        setCurrentUser(response.data.data);
        
        // 성공 메시지 표시
        setToast({
          type: "success",
          message: "세션이 성공적으로 복구되었습니다.",
          duration: 3000
        });
        
        // 룸 목록 다시 로드
        loadRooms();
        
        return true; // 재연결 성공
      } else if (response.error) {
        throw new Error(response.error?.message || "세션 재연결 실패");
      }
    } catch (error) {
      console.error("세션 재연결 시도 중 오류 발생:", error);
      
      // 로그아웃 처리 및 쿠키 정리
      try {
        // 백엔드에 로그아웃 요청 (세션 및 HTTP-Only 쿠키 삭제)
        await client.DELETE("/api/v1/members");
        console.log("로그아웃 API 호출 성공");
        
        // 백엔드 로그아웃 API가 처리하지 않는 클라이언트 측 쿠키 수동 삭제
        document.cookie = "needs_nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = "needs_nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        
        // 로컬 스토리지 정리
        localStorage.clear();
      } catch (logoutError) {
        console.error("로그아웃 API 호출 실패:", logoutError);
        // 실패해도 계속 진행 - 수동으로 쿠키 삭제 시도
        document.cookie = "needs_nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = "needs_nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        localStorage.clear();
      }
      
      // 오류 메시지 토스트 표시
      setToast({
        type: "error",
        message: "세션을 복구할 수 없습니다. 다시 로그인해주세요.",
        duration: 3000
      });
      
      // 3초 후 로그인 페이지로 리다이렉트 - Next.js Router 사용
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
      return false; // 재연결 실패
    }
    
    return false; // 기본적으로 실패 반환
  };

  // 로그인 페이지로 리다이렉트 함수 - 세션 재연결 시도 후 실패 시에만 리다이렉트
  const redirectToLogin = async () => {
    // 먼저, 세션 재연결 시도
    const reconnectSuccess = await tryReconnectSession();
    
    // 재연결에 실패한 경우에만 로그인 페이지로 리다이렉트
    if (!reconnectSuccess) {
      // 여기까지 오면 이미 tryReconnectSession에서 에러 처리와 토스트 메시지를 표시했으므로
      // 추가적인 처리는 필요 없음 (로그인 페이지로의 리다이렉트도 이미 처리됨)
    }
  };

  async function loadRooms() {
    try {
      const res = await client.GET("/api/v1/rooms") as ApiResponse<RoomResponse[]>;

      if (res.error) {
        console.error('룸 정보를 가져오는데 실패했습니다:', res.error?.message || '상세 오류 정보 없음');
        console.error('전체 오류 객체:', res.error);
        
        // 세션 오류 확인
        if (checkSessionError(res.error)) {
          redirectToLogin();
          return;
        }
        
        return;
      }

      if (res.data?.data) {
        console.log('로드된 룸 정보:', res.data.data);
        setRooms(res.data.data);
      } else {
        setRooms([]);
      }
    } catch (error) {
      console.error("룸 정보를 가져오는데 실패했습니다:", error);
      
      // 세션 오류 확인
      if (checkSessionError(error)) {
        redirectToLogin();
        return;
      }
      
      setRooms([]);
    }
  }

  // 사용자의 아바타 URL을 가져오는 함수
  const fetchUserAvatars = async (users: User[]) => {
    // 아바타 정보가 없는 사용자들을 위해 기본 아바타 설정
    const updatedUsers = users.map(user => ({
      ...user,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR // 아바타가 없으면 기본 아바타 설정
    }));
    
    // 캐시에 없는 사용자들만 필터링
    const usersWithoutCache = updatedUsers.filter(user => !userProfileCache[user.id]);
    
    if (usersWithoutCache.length === 0) return updatedUsers;
    
    // 모든 사용자의 프로필 정보를 병렬로 가져오기
    await Promise.all(
      usersWithoutCache.map(async (user) => {
        try {
          const response = await client.GET(`/api/v1/members/{memberId}`, {
            params: { path: { memberId: user.id } }
          }) as ApiResponse<UserProfile>;
          
          if (response.data?.data) {
            // 캐시에 저장
            userProfileCache[user.id] = response.data.data;
            
            // 해당 사용자 정보 업데이트
            const index = updatedUsers.findIndex(u => u.id === user.id);
            if (index !== -1) {
              updatedUsers[index] = {
                ...updatedUsers[index],
                avatarUrl: response.data.data.avatarUrl || DEFAULT_AVATAR // 아바타가 없으면 기본 아바타 설정
              };
            }
          }
        } catch (error) {
          console.error(`사용자 ${user.id}의 아바타 정보를 가져오는데 실패했습니다:`, error);
        }
      })
    );
    
    return updatedUsers;
  };

  // 현재 로그인한 사용자 정보 가져오기
  const fetchCurrentUser = async () => {
    // 동시에 여러 요청이 발생하는 것을 방지
    if (isLoadingUser) {
      console.log("사용자 정보를 이미 로딩 중입니다");
      return;
    }
    
    setIsLoadingUser(true);
    
    try {
      console.log("사용자 정보 로딩 중... (시도: " + (userLoadRetryCountRef.current + 1) + ")");
      
      // 캐시 방지 헤더 추가
      const customHeaders = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Request-Time": Date.now().toString() // 무작위 헤더 값으로 캐시 방지
      };
      
      const response = await client.GET("/api/v1/members/me", {
        headers: customHeaders
      }) as ApiResponse<User>;
      
      if (response.error) {
        console.error("사용자 정보를 가져오는데 실패했습니다:", response.error);
        
        // 세션 오류 확인
        if (checkSessionError(response.error)) {
          userLoadRetryCountRef.current++; // 재시도 횟수 증가
          
          // 최대 재시도 횟수 초과 시에만 로그인 페이지로 리다이렉트
          if (userLoadRetryCountRef.current > 2) {
            redirectToLogin();
          } else {
            // 잠시 후 다시 시도
            setTimeout(() => {
              setIsLoadingUser(false);
              fetchCurrentUser();
            }, 1000);
          }
          return;
        }
        
        // 재시도 카운트 초기화 (세션 오류가 아닌 다른 오류)
        userLoadRetryCountRef.current = 0;
        return;
      }
      
      if (response.data?.data) {
        const userData = response.data.data;
        setCurrentUser(userData);
        
        // 재시도 카운트 초기화 (성공)
        userLoadRetryCountRef.current = 0;
        
        // 프로필 캐시 업데이트
        if (userData.id) {
          // 기존 캐시 정보 유지하면서 업데이트
          userProfileCache[userData.id] = {
            ...userProfileCache[userData.id],
            id: userData.id,
            nickname: userData.nickname,
            avatarUrl: userData.avatarUrl || DEFAULT_AVATAR,
            lastUpdated: Date.now()
          };
        }
        
        // REGISTER 상태인 경우 닉네임 모달 표시
        if (userData.status === "REGISTER") {
          setShowNicknameModal(true);
        }
      }
    } catch (error) {
      console.error("사용자 정보를 가져오는데 실패했습니다:", error);
      
      // 세션 오류 확인
      if (checkSessionError(error)) {
        userLoadRetryCountRef.current++; // 재시도 횟수 증가
        
        // 최대 재시도 횟수 초과 시에만 로그인 페이지로 리다이렉트
        if (userLoadRetryCountRef.current > 2) {
          redirectToLogin();
        } else {
          // 잠시 후 다시 시도
          setTimeout(() => {
            setIsLoadingUser(false);
            fetchCurrentUser();
          }, 1000);
        }
      } else {
        // 재시도 카운트 초기화 (세션 오류가 아닌 다른 오류)
        userLoadRetryCountRef.current = 0;
      }
    } finally {
      setIsLoadingUser(false);
    }
  };

  // 닉네임 변경 함수
  const handleChangeNickname = async () => {
    if (!newNickname.trim()) {
      alert("닉네임을 입력해주세요.");
      return;
    }
    
    // REGISTER 상태가 아니고 GUEST도 아니고 포인트가 부족한 경우 체크
    if (currentUser?.status !== "REGISTER" && 
        !(currentUser?.nickname && currentUser.nickname.startsWith("GUEST")) && 
        (userProfileCache[currentUser?.id || 0]?.point || 0) < 100) {
      alert("포인트가 부족합니다. 퀴즈를 풀어 포인트를 모아보세요!");
      return;
    }
    
    // 현재 닉네임과 동일한 경우 (REGISTER 상태가 아닐 때만 체크)
    if (currentUser?.status !== "REGISTER" && newNickname === currentUser?.nickname) {
      alert("현재 닉네임과 동일합니다. 다른 닉네임을 입력해주세요.");
      return;
    }
    
    // 사용자 정보가 없는 경우 다시 가져오기 시도
    if (!currentUser || !currentUser.id) {
      try {
        console.log("사용자 정보가 없어 다시 가져오는 중...");
        
        // 로컬 스토리지에서 OAuth 리다이렉트 과정에서 저장된 사용자 ID 확인
        const storedUserId = localStorage.getItem('user_id');
        if (storedUserId) {
          console.log("로컬 스토리지에서 사용자 ID 복원:", storedUserId);
          const userId = parseInt(storedUserId, 10);
          
          // 기본 정보로 임시 객체 생성
          setCurrentUser({
            id: userId,
            email: localStorage.getItem('user_email') || '',
            nickname: 'Temporary',
            sessions: [],
            lastActive: Date.now(),
            status: 'REGISTER'
          });
          
          // 실제 API 호출도 병행
          client.GET("/api/v1/members/me").catch(err => {
            console.warn("백그라운드 사용자 정보 가져오기 실패:", err);
          });
        } else {
          // 로컬 스토리지에 정보가 없으면 API 호출
          const response = await client.GET("/api/v1/members/me") as ApiResponse<User>;
          
          if (response.error) {
            console.error("사용자 정보를 가져오는데 실패했습니다:", response.error);
            
            // 세션 오류 확인
            if (checkSessionError(response.error)) {
              redirectToLogin();
              return;
            }
            
            alert("사용자 정보를 가져오는데 실패했습니다. 다시 로그인해주세요.");
            redirectToLogin();
            return;
          }
          
          if (response.data?.data) {
            setCurrentUser(response.data.data);
          } else {
            alert("사용자 정보를 가져오는데 실패했습니다. 다시 로그인해주세요.");
            redirectToLogin();
            return;
          }
        }
      } catch (error) {
        console.error("사용자 정보를 가져오는데 실패했습니다:", error);
        alert("사용자 정보를 가져오는데 실패했습니다. 다시 로그인해주세요.");
        redirectToLogin();
        return;
      }
    }
    
    // 여전히 사용자 정보가 없다면 처리 중단
    if (!currentUser || !currentUser.id) {
      console.error("사용자 정보를 가져오는데 실패했습니다.");
      alert("사용자 정보를 가져오는데 실패했습니다. 다시 로그인해주세요.");
      redirectToLogin();
      return;
    }
    
    // 닉네임 변경 진행 상태 설정
    setIsChangingNickname(true);
    
    try {
      const response = await client.PATCH("/api/v1/members/{memberId}/nickname", {
        params: {
          path: { memberId: currentUser.id } // 현재 사용자의 실제 ID 사용
        },
        body: { nickname: newNickname }
      }) as ApiResponse<User>;
      
      if (response.error) {
        // 세션 오류 확인
        if (checkSessionError(response.error)) {
          redirectToLogin();
          return;
        }
        
        alert(response.error?.message || "닉네임 변경에 실패했습니다.");
        return;
      }
      
      // 성공 시 사용자 정보 다시 로드
      await fetchCurrentUser();
      setShowNicknameModal(false);
      // 로컬 스토리지에서 REGISTER 상태 제거
      localStorage.removeItem('quizzle_register_status');
      
      // 이제 닉네임 설정이 완료되었으므로 룸 목록 로드
      await loadRooms();
      
      // 사용자 프로필 캐시 업데이트 - 변경된 닉네임 반영
      if (currentUser && currentUser.id) {
        // 현재 사용자의 프로필 캐시 업데이트
        if (userProfileCache[currentUser.id]) {
          userProfileCache[currentUser.id] = {
            ...userProfileCache[currentUser.id],
            nickname: newNickname
          };
        }
        
        // 액티브 유저 목록에서도 사용자 닉네임 업데이트
        setActiveUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === currentUser.id 
              ? { ...user, nickname: newNickname } 
              : user
          )
        );
        
        // REGISTER 상태가 아닐 때만 웹소켓 재연결 로직 실행
        if (currentUser.status !== "REGISTER") {
          // 웹소켓 연결을 완전히 재설정
          console.log("닉네임 변경 후 웹소켓 연결 재설정");
          
          // 웹소켓 연결 완전 재설정
          const success = reconnectWebSocket();
          
          if (success) {
            // 재연결 성공 시 약간의 지연 후 구독 재설정
            setTimeout(() => {
              // 룸 업데이트 구독
              subscribe("/topic/lobby", (_) => {
                loadRooms();
              });
              
              // 로비 접속자 목록 구독
              subscribe("/topic/lobby/users", async (data: any) => {
                console.log("[LOBBY] 로비 유저 목록 수신:", data);
                
                // 데이터가 배열인 경우 (전체 유저 목록)
                if (Array.isArray(data)) {
                  // 온라인 사용자 ID 목록 추출 및 업데이트
                  const onlineUserIds = data.map(user => user.id);
                  updateOnlineUserIds(onlineUserIds);
                  
                  // 아바타 정보 추가
                  const usersWithAvatars = await fetchUserAvatars(data);
                  
                  // 현재 상태의 activeUsers에서 location과 roomId 정보 유지
                  const updatedUsers = usersWithAvatars.map(newUser => {
                    // 기존 사용자 정보 찾기
                    const existingUser = activeUsers.find(u => u.id === newUser.id);
                    
                    // 기존 사용자 정보가 있고 IN_ROOM 상태라면 그 정보 유지
                    if (existingUser && existingUser.location === "IN_ROOM") {
                      return {
                        ...newUser,
                        location: existingUser.location,
                        roomId: existingUser.roomId,
                        status: existingUser.status
                      };
                    }
                    
                    // 새로 받은 정보에 location이 있으면 그 정보 사용
                    if (newUser.location === "IN_ROOM") {
                      return newUser;
                    }
                    
                    // 그 외에는 기본적으로 로비에 있는 것으로 설정
                    return {
                      ...newUser,
                      location: newUser.location || "IN_LOBBY",
                      status: newUser.status || "online"
                    };
                  });
                  
                  // 현재 사용자를 목록 최상단으로 정렬
                  if (currentUser) {
                    const sortedUsers = [...updatedUsers].sort((a, b) => {
                      if (a.id === currentUser.id) return -1;
                      if (b.id === currentUser.id) return 1;
                      return 0;
                    });
                    setActiveUsers(sortedUsers);
                  } else {
                    setActiveUsers(updatedUsers);
                  }
                  
                  setIsConnected(true);
                  
                  // 현재 로그인한 사용자의 정보도 업데이트
                  if (currentUser) {
                    const updatedCurrentUser = updatedUsers.find(user => user.id === currentUser.id);
                    if (updatedCurrentUser) {
                      // User 타입에 맞게 roomId가 null이면 undefined로 변환
                      const typeSafeUser = {
                        ...updatedCurrentUser,
                        roomId: updatedCurrentUser.roomId === null ? undefined : updatedCurrentUser.roomId
                      };
                      setCurrentUser(typeSafeUser as User);
                    }
                  }
                }
                // 데이터가 단일 객체인 경우 (USER_LOCATION_UPDATE 등)
                else if (data && typeof data === 'object' && data.type) {
                  receiveMessage(data);
                }
              });
              
              // 접속자 목록 요청
              publish("/app/lobby/users", JSON.stringify({ action: "getUsers" }));
            }, 1000); // 1초 후 재구독
          } else {
            console.error("웹소켓 재연결 실패");
          }
        }
      }
      
      // 성공 메시지 토스트 표시
      setToast({
        type: "success",
        message: "닉네임이 성공적으로 변경되었습니다!",
        duration: 3000
      });
    } catch (error) {
      console.error("닉네임 변경에 실패했습니다:", error);
      
      // 세션 오류 확인
      if (checkSessionError(error)) {
        redirectToLogin();
        return;
      }
      
      alert("닉네임 변경에 실패했습니다.");
    } finally {
      // 닉네임 변경 진행 상태 해제
      setIsChangingNickname(false);
    }
  };

  useEffect(() => {
    // URL에서 REGISTER 파라미터 확인
    const params = new URLSearchParams(window.location.search);
    const isRegister = params.get('status') === 'REGISTER';
    
    if (isRegister) {
      // REGISTER 상태를 로컬 스토리지에 저장
      localStorage.setItem('quizzle_register_status', 'true');
      // URL에서 파라미터 제거 (히스토리 유지)
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      
      // REGISTER 상태일 때 사용자 정보를 먼저 가져옴
      fetchCurrentUser().then(() => {
        // 닉네임 모달 표시
        setShowNicknameModal(true);
      });
    } else {
      // REGISTER 상태가 아닐 때만 API 호출
      loadRooms();
      fetchCurrentUser(); // 사용자 정보 가져오기
    }
    
    // 로컬 스토리지에서 REGISTER 상태 확인
    const hasRegisterStatus = localStorage.getItem('quizzle_register_status') === 'true';
    
    // URL에 파라미터가 없지만 로컬 스토리지에 상태가 있는 경우
    if (!isRegister && hasRegisterStatus) {
      // 사용자 정보를 가져온 후 닉네임 모달 표시
      fetchCurrentUser().then(() => {
        setShowNicknameModal(true);
      });
    }

    // 룸 업데이트 구독
    subscribe("/topic/lobby", (_) => {
      // REGISTER 상태가 아닐 때만 API 호출
      if (!isRegister && !hasRegisterStatus) {
        loadRooms();
      }
    });

    // 로비 접속자 목록 구독
    subscribe("/topic/lobby/users", async (data: any) => {
      console.log("[LOBBY] 로비 유저 목록 수신:", data);
      
      // 데이터가 배열인 경우 (전체 유저 목록)
      if (Array.isArray(data)) {
        // 온라인 사용자 ID 목록 추출 및 업데이트
        const onlineUserIds = data.map(user => user.id);
        updateOnlineUserIds(onlineUserIds);
        
        // 아바타 정보 추가
        const usersWithAvatars = await fetchUserAvatars(data);
        
        // 현재 상태의 activeUsers에서 location과 roomId 정보 유지
        const updatedUsers = usersWithAvatars.map(newUser => {
          // 기존 사용자 정보 찾기
          const existingUser = activeUsers.find(u => u.id === newUser.id);
          
          // 기존 사용자 정보가 있고 IN_ROOM 상태라면 그 정보 유지
          if (existingUser && existingUser.location === "IN_ROOM") {
            return {
              ...newUser,
              location: existingUser.location,
              roomId: existingUser.roomId,
              status: existingUser.status
            };
          }
          
          // 새로 받은 정보에 location이 있으면 그 정보 사용
          if (newUser.location === "IN_ROOM") {
            return newUser;
          }
          
          // 그 외에는 기본적으로 로비에 있는 것으로 설정
          return {
            ...newUser,
            location: newUser.location || "IN_LOBBY",
            status: newUser.status || "online"
          };
        });
        
        // 현재 사용자를 목록 최상단으로 정렬
        if (currentUser) {
          const sortedUsers = [...updatedUsers].sort((a, b) => {
            if (a.id === currentUser.id) return -1;
            if (b.id === currentUser.id) return 1;
            return 0;
          });
          setActiveUsers(sortedUsers);
        } else {
          setActiveUsers(updatedUsers);
        }
        
        setIsConnected(true);
        
        // 현재 로그인한 사용자의 정보도 업데이트
        if (currentUser) {
          const updatedCurrentUser = updatedUsers.find(user => user.id === currentUser.id);
          if (updatedCurrentUser) {
            // User 타입에 맞게 roomId가 null이면 undefined로 변환
            const typeSafeUser = {
              ...updatedCurrentUser,
              roomId: updatedCurrentUser.roomId === null ? undefined : updatedCurrentUser.roomId
            };
            setCurrentUser(typeSafeUser as User);
          }
        }
      } 
      // 데이터가 단일 객체인 경우 (USER_LOCATION_UPDATE 등)
      else if (data && typeof data === 'object' && data.type) {
        receiveMessage(data);
      }
    });

    // 접속자 목록 요청
    publish("/app/lobby/users", JSON.stringify({ action: "getUsers" }));

    // 컴포넌트 언마운트 시 모든 구독 해제 및 웹소켓 정리
    return () => {
      console.log("로비 페이지 언마운트: 웹소켓 구독 해제");
      
      // 구독 해제 - 연결 자체는 유지 (페이지 간 이동을 위해)
      unsubscribe("/topic/lobby");
      unsubscribe("/topic/lobby/users");
      unsubscribe("/topic/lobby/chat");
      unsubscribe("/topic/lobby/status");
      
      // 의도적인 네비게이션인지 확인 (룸으로 이동하는 경우 등)
      const isIntentionalNavigation = localStorage.getItem('intentional_navigation') === 'true';
      console.log("의도적 네비게이션 여부:", isIntentionalNavigation);
      
      if (!isIntentionalNavigation) {
        // 의도적인 네비게이션이 아닌 경우에만 메시지 캐시 클리어
        console.log("페이지 이탈: 메시지 캐시 클리어");
        lobbyMessageCache = [];
      }
      
      // 페이지 벗어날 때 세션 변경 여부 체크
      if (currentUser && currentUser.nickname && 
          currentUser.nickname !== localStorage.getItem('user_nickname')) {
        // 닉네임이 변경된 경우 로컬 스토리지에 저장
        localStorage.setItem('user_nickname', currentUser.nickname);
        // 다음 페이지 로드 시 참조할 수 있도록 세션 변경 정보 저장
        localStorage.setItem('session_changed', 'true');
      }
    };
  }, []);

  // ESC 키로 닉네임 모달 닫기 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showNicknameModal && 
         (currentUser?.status !== "REGISTER" || (currentUser?.nickname && currentUser.nickname.startsWith("GUEST")))) {
        setShowNicknameModal(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNicknameModal, currentUser?.status, currentUser?.nickname]);

  const handleUserClick = async (user: User | ActiveUser) => {
    try {
      // 클릭한 사용자가 현재 사용자와 동일한 경우, 로컬 상태에서 최신 정보 사용
      if (currentUser && user.id === currentUser.id) {
        setSelectedUser(currentUser as User);
        setShowProfileModal(true);
        return;
      }
      
      // 사용자 정보 가져오기
      const response = await client.GET(`/api/v1/members/{memberId}`, {
        params: { path: { memberId: user.id } }
      }) as ApiResponse<UserProfile>;
      
      if (response.error || !response.data) {
        throw new Error(response.error?.message || "프로필 정보를 가져오는데 실패했습니다");
      }
      
      // 캐시에 저장 (타임스탬프 추가)
      const profileWithTimestamp = {
        ...response.data.data,
        lastUpdated: Date.now()
      };
      userProfileCache[user.id] = profileWithTimestamp;
      
      setSelectedUser(profileWithTimestamp);
      setShowProfileModal(true);
    } catch (error) {
      console.error("프로필 정보를 가져오는데 실패했습니다:", error);
      // 에러 발생 시 기본 정보로 대체
      setSelectedUser({
        id: user.id,
        nickname: user.nickname,
        avatarUrl: DEFAULT_AVATAR,
        level: 1,
        exp: 0,
        point: 0,
        loading: false,
        error: '프로필 정보를 가져오는데 실패했습니다'
      });
    }
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setSelectedUser(null);
  };

  // 채팅 메시지 전송 함수
  const handleSendChatMessage = async () => {
    if (!newChatMessage.trim() || !currentUser) return;
    
    // 발송할 메시지 내용
    const messageContent = newChatMessage.trim();
    
    // 메시지 입력창 초기화
    setNewChatMessage("");
    
    try {
      // 안전한 발행 함수 사용
      const { safePublish } = await import('@/lib/backend/stompClient');
      
      // 안전한 발행 함수를 사용하여 메시지 전송 (구독 부분 제거)
      console.log(`[CHAT] 채팅 메시지 전송: "${messageContent}"`);
      const published = await safePublish("/app/lobby/chat", messageContent);
      
      if (!published) {
        throw new Error("메시지 발행 실패");
      }
    } catch (error) {
      console.error("[CHAT] 메시지 전송 중 오류 발생:", error);
      // 오류 메시지를 채팅창에 추가
      setChatMessages(prev => [
        ...prev,
        {
          type: "SYSTEM",
          content: "메시지 전송에 실패했습니다. 새로고침 후 다시 시도해주세요.",
          senderId: "system",
          senderName: "System",
          timestamp: Date.now(),
          id: `system-error-${Date.now()}`
        }
      ]);
    }
  };
  
  // 채팅 입력창 키 이벤트 핸들러
  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendChatMessage();
    }
  };
  
  // 조합 입력 시작 핸들러 (한글, 일본어 등 IME 입력)
  const handleCompositionStart = () => {
    setIsComposing(true);
  };
  
  // 조합 입력 종료 핸들러
  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  // 채팅 구독 설정
  useEffect(() => {
    // 초기 메시지 설정 (캐시가 비어있을 때만)
    if (lobbyMessageCache.length === 0) {
      const initialMessage = {
        type: "SYSTEM",
        content: "로비 채팅에 연결되었습니다. 안녕하세요! 👋",
        senderId: "system",
        senderName: "System",
        timestamp: Date.now(),
        roomId: "lobby"
      };
      lobbyMessageCache = [initialMessage];
    }
    
    // 캐시된 메시지 불러오기
    setChatMessages(lobbyMessageCache);
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // 웹소켓 연결 시 채팅 구독 설정
  useEffect(() => {
    if (!isConnected) return; // 웹소켓이 연결되어 있어야 구독 가능
    
    // 로비 채팅 구독
    const handleChatMessage = (message: any) => {
      // 중복 메시지 검사: 동일한 시간과 내용을 가진 메시지가 있는지 확인
      const isDuplicate = chatMessages.some(existingMsg => 
        existingMsg.timestamp === message.timestamp && 
        existingMsg.content === message.content &&
        existingMsg.senderId === message.senderId
      );
      
      // 중복 메시지면 무시
      if (isDuplicate) {
        console.log("중복 메시지 무시:", message);
        return;
      }
      
      // 사용자 프로필 정보 확인 및 아바타 URL 가져오기
      let avatarUrl = undefined;
      
      if (message.senderId && message.senderId !== "system") {
        const senderId = parseInt(message.senderId);
        // 캐시에서 아바타 URL 찾기
        avatarUrl = userProfileCache[senderId]?.avatarUrl;
        
        // 캐시에 사용자 정보가 없고 발신자가 현재 활성 사용자 목록에 있는 경우
        if (!avatarUrl) {
          // 활성 사용자 목록에서 찾기
          const activeUser = activeUsers.find(user => user.id === senderId);
          if (activeUser && activeUser.avatarUrl) {
            avatarUrl = activeUser.avatarUrl;
            
            // 캐시 업데이트
            if (!userProfileCache[senderId]) {
              userProfileCache[senderId] = {
                id: senderId,
                nickname: message.senderName,
                avatarUrl: activeUser.avatarUrl,
                lastUpdated: Date.now()
              };
            }
          } else {
            // 기본 아바타 설정
            avatarUrl = DEFAULT_AVATAR;
            
            // 백그라운드에서 사용자 프로필 정보 가져오기
            // 단, 많은 요청을 피하기 위해 이미 진행 중인 요청이 없을 때만 실행
            const fetchUserAvatar = async () => {
              try {
                const response = await client.GET(`/api/v1/members/{memberId}`, {
                  params: { path: { memberId: senderId } }
                }) as ApiResponse<UserProfile>;
                
                if (response.data?.data && response.data.data.avatarUrl) {
                  // 캐시에 저장할 프로필 데이터와 아바타 URL 추출
                  const profileData = response.data.data;
                  const avatarUrl = profileData.avatarUrl;
                  
                  // 캐시 업데이트
                  userProfileCache[senderId] = {
                    ...profileData,
                    lastUpdated: Date.now()
                  };
                  
                  // 메시지 업데이트 - 아바타만 변경
                  setChatMessages(prev => {
                    const updatedMessages = prev.map(msg => 
                      msg.senderId === message.senderId && 
                      msg.timestamp === message.timestamp
                        ? { ...msg, avatarUrl: avatarUrl }
                        : msg
                    );
                    
                    // 글로벌 캐시 업데이트
                    lobbyMessageCache = [...updatedMessages];
                    
                    return updatedMessages;
                  });
                }
              } catch (error) {
                console.error(`사용자 ${senderId}의 프로필 정보를 가져오는데 실패했습니다:`, error);
              }
            };
            
            // 사용자 정보가 캐시에 없고, 로그인된 사용자인 경우에만 백그라운드 요청 수행
            if (currentUser) {
              fetchUserAvatar();
            }
          }
        }
      }
      
      // 메시지에 고유 ID 추가
      const messageWithId = {
        ...message,
        id: `${message.senderId}-${message.timestamp}-${Math.random().toString(36).substr(2, 5)}`,
        avatarUrl: avatarUrl || DEFAULT_AVATAR
      };
      
      // 메시지 추가
      setChatMessages((prevMessages) => {
        // 새 메시지가 추가된 배열
        const newMessages = [...prevMessages, messageWithId];
        
        // 메시지 최대 개수 제한 (너무 많은 메시지가 쌓이지 않도록)
        const maxMessages = 100;
        const trimmedMessages = newMessages.length > maxMessages 
          ? newMessages.slice(newMessages.length - maxMessages) 
          : newMessages;
        
        // 글로벌 캐시 업데이트
        lobbyMessageCache = [...trimmedMessages];
        
        return trimmedMessages;
      });
    };
    
    console.log("useEffect에서 로비 채팅 추가 구독 시도...");
    // 중복 구독이 되더라도 메시지 처리에는 영향이 없으므로 안전
    subscribe("/topic/lobby/chat", handleChatMessage);
    
    return () => {
      unsubscribe("/topic/lobby/chat");
    };
  }, [isConnected, chatMessages]); // 연결 상태가 변경될 때와 채팅 메시지 변경될 때 구독 갱신
  
  // 기존 사용자 프로필 아바타 URL 업데이트 useEffect는 유지
  useEffect(() => {
    // 사용자 목록이 변경될 때 아바타 정보만 업데이트
    const updatedMessages = chatMessages.map(msg => {
      if (msg.senderId && msg.senderId !== "system") {
        const senderId = parseInt(msg.senderId);
        const activeUser = activeUsers.find(user => user.id === senderId);
        
        if (activeUser && activeUser.avatarUrl && msg.avatarUrl !== activeUser.avatarUrl) {
          return { ...msg, avatarUrl: activeUser.avatarUrl };
        }
      }
      return msg;
    });
    
    // 메시지가 변경된 경우만 업데이트
    if (JSON.stringify(updatedMessages) !== JSON.stringify(chatMessages)) {
      // 글로벌 캐시 업데이트
      lobbyMessageCache = [...updatedMessages];
      
      setChatMessages(updatedMessages);
    }
  }, [activeUsers, chatMessages]);
  
  // 새 메시지가 올 때마다 스크롤 이동
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // 사용자 프로필 클릭 핸들러
  const handleUserProfileClick = () => {
    if (currentUser) {
      handleUserClick(currentUser);
    } else {
      alert("로그인이 필요합니다.");
    }
  };
  
  // 웹소켓 연결됐지만 세션이 만료된 경우 자동 재연결 시도
  useEffect(() => {
    // 웹소켓 연결 상태와 사용자 인증 상태의 불일치 감지
    // isConnected가 true인데 currentUser가 null인 경우
    if (isConnected && !currentUser && activeUsers.length > 0) {
      tryReconnectSession();
    }
  }, [isConnected, currentUser, activeUsers.length]);

  // 랭킹 모달 열기
  const openRankingModal = () => {
    setShowRankingModal(true);
  };
  
  // 랭킹 모달 닫기
  const closeRankingModal = () => {
    setShowRankingModal(false);
  };

  // 친구 모달 토글 함수
  const toggleFriendModal = () => {
    setShowFriendModal(!showFriendModal);
    // 모달을 열 때 친구 요청 목록 다시 가져오기
    if (!showFriendModal) {
      fetchFriendRequests();
    }
  };

  // 메시지 타입에 따른 처리
  const receiveMessage = (message: any) => {
    // 문자열 메시지 처리 (예: "ROOM_DELETED:13", "ROOM_UPDATED:13")
    if (typeof message === 'string') {
      console.log("[CLEAR-TRACE] 문자열 메시지 수신:", message);
      
      // 방 삭제 메시지 처리
      if (message.startsWith("ROOM_DELETED:")) {
        const roomId = message.split(":")[1];
        console.log(`[CLEAR-TRACE] 방 ID ${roomId} 삭제 메시지 수신`);
        
        setRooms(prevRooms => {
          return prevRooms.filter(room => room.id !== parseInt(roomId));
        });
        return;
      }
      
      // 방 업데이트 메시지 처리
      if (message.startsWith("ROOM_UPDATED:")) {
        const roomId = message.split(":")[1];
        console.log(`[CLEAR-TRACE] 방 ID ${roomId} 업데이트 메시지 수신`);
        
        // 업데이트된 방 정보 가져오기
        fetch(`/api/v1/rooms/${roomId}`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`방 정보 요청 실패: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            if (data && data.data) {
              const updatedRoom = data.data;
              console.log(`[CLEAR-TRACE] 방 ${roomId} 정보 수신:`, updatedRoom);
              
              setRooms(prevRooms => {
                const roomExists = prevRooms.some(room => room.id === parseInt(roomId));
                
                if (roomExists) {
                  return prevRooms.map(room => 
                    room.id === parseInt(roomId) ? { ...room, ...updatedRoom } : room
                  );
                } else {
                  return [...prevRooms, updatedRoom];
                }
              });
            }
          })
          .catch(error => {
            console.error("[CLEAR-TRACE] 방 정보 업데이트 실패:", error);
            // 오류 발생 시 전체 목록 새로고침
            loadRooms();
          });
        return;
      }
      
      // 기타 문자열 메시지는 그대로 처리
      return;
    }
    
    // 채팅 메시지인 경우
    if (message.type === "CHAT" || (!message.type && message.content)) {
      // 메시지 내용에서 불필요한 따옴표 제거
      if (message.content && typeof message.content === 'string') {
        // 앞뒤 따옴표로 감싸져 있는 경우 제거
        if (message.content.startsWith('"') && message.content.endsWith('"')) {
          message.content = message.content.substring(1, message.content.length - 1);
        }
      }
      
      // 사용자 프로필 정보 확인 및 아바타 URL 가져오기
      let avatarUrl = undefined;
      
      if (message.senderId && message.senderId !== "system") {
        const senderId = parseInt(message.senderId);
        // 캐시에서 아바타 URL 찾기
        avatarUrl = userProfileCache[senderId]?.avatarUrl;
        
        // 캐시에 사용자 정보가 없고 발신자가 현재 활성 사용자 목록에 있는 경우
        if (!avatarUrl) {
          // 활성 사용자 목록에서 찾기
          const activeUser = activeUsers.find(user => user.id === senderId);
          if (activeUser && activeUser.avatarUrl) {
            avatarUrl = activeUser.avatarUrl;
            
            // 캐시 업데이트
            if (!userProfileCache[senderId]) {
              userProfileCache[senderId] = {
                id: senderId,
                nickname: message.senderName,
                avatarUrl: activeUser.avatarUrl,
                lastUpdated: Date.now()
              };
            }
          } else {
            // 기본 아바타 설정
            avatarUrl = DEFAULT_AVATAR;
            
            // 백그라운드에서 사용자 프로필 정보 가져오기
            // 단, 많은 요청을 피하기 위해 이미 진행 중인 요청이 없을 때만 실행
            const fetchUserAvatar = async () => {
              try {
                const response = await client.GET(`/api/v1/members/{memberId}`, {
                  params: { path: { memberId: senderId } }
                }) as ApiResponse<UserProfile>;
                
                if (response.data?.data && response.data.data.avatarUrl) {
                  // 캐시에 저장할 프로필 데이터와 아바타 URL 추출
                  const profileData = response.data.data;
                  const avatarUrl = profileData.avatarUrl;
                  
                  // 캐시 업데이트
                  userProfileCache[senderId] = {
                    ...profileData,
                    lastUpdated: Date.now()
                  };
                  
                  // 메시지 업데이트 - 아바타만 변경
                  setChatMessages(prev => {
                    const updatedMessages = prev.map(msg => 
                      msg.senderId === message.senderId && 
                      msg.timestamp === message.timestamp
                        ? { ...msg, avatarUrl: avatarUrl }
                        : msg
                    );
                    
                    // 글로벌 캐시 업데이트
                    lobbyMessageCache = [...updatedMessages];
                    
                    return updatedMessages;
                  });
                }
              } catch (error) {
                console.error(`사용자 ${senderId}의 프로필 정보를 가져오는데 실패했습니다:`, error);
              }
            };
            
            // 사용자 정보가 캐시에 없고, 로그인된 사용자인 경우에만 백그라운드 요청 수행
            if (currentUser) {
              fetchUserAvatar();
            }
          }
        }
      }
      
      // 메시지에 고유 ID 추가
      const messageWithId = {
        ...message,
        id: `${message.senderId}-${message.timestamp}-${Math.random().toString(36).substr(2, 5)}`,
        avatarUrl: avatarUrl || DEFAULT_AVATAR
      };
      
      // 메시지 추가
      setChatMessages((prevMessages) => {
        // 새 메시지가 추가된 배열
        const newMessages = [...prevMessages, messageWithId];
        
        // 메시지 최대 개수 제한 (너무 많은 메시지가 쌓이지 않도록)
        const maxMessages = 100;
        const trimmedMessages = newMessages.length > maxMessages 
          ? newMessages.slice(newMessages.length - maxMessages) 
          : newMessages;
        
        // 글로벌 캐시 업데이트
        lobbyMessageCache = [...trimmedMessages];
        
        return trimmedMessages;
      });
    }
    
    // 방 생성 메시지인 경우
    if (message.type === "ROOM_CREATED") {
      console.log("방 생성 알림 수신:", message);
      // 방 목록 새로고침
      loadRooms();
      return;
    }
    
    // 방 삭제 메시지인 경우 - 객체 형태로 받을 때
    if (message === "ROOM_DELETED" || 
        (typeof message === 'object' && message.type === "ROOM_DELETED")) {
      
      console.log("방 삭제 알림 수신:", message);
      let roomId = null;
      
      // 메시지 형식에 따른 룸 ID 추출
      if (message.roomId) {
        roomId = message.roomId;
      } else if (message.id) {
        roomId = message.id;
      }
      
      if (roomId) {
        // 특정 방 ID만 삭제
        setRooms(prevRooms => {
          const filtered = prevRooms.filter(room => room.id !== parseInt(roomId));
          console.log(`방 ID ${roomId} 삭제됨, 남은 방 목록:`, filtered.length);
          return filtered;
        });
      } else {
        // 방 목록 새로고침
        console.log("전체 방 목록 새로고침 (방 삭제)");
        loadRooms();
      }
      return;
    }
    
    // 방 업데이트 메시지인 경우 - 객체 형태로 받을 때
    if (message === "ROOM_UPDATED" || 
        (typeof message === 'object' && message.type === "ROOM_UPDATED")) {
      
      console.log("방 업데이트 알림 수신:", message);
      let roomId = null;
      let hasStatusUpdate = false;
      let newStatus = null;
      
      // 메시지 형식에 따른 룸 ID 추출
      if (message.roomId) {
        roomId = message.roomId;
        if (message.status) {
          hasStatusUpdate = true;
          newStatus = message.status;
        }
      } else if (message.id) {
        roomId = message.id;
        if (message.status) {
          hasStatusUpdate = true;
          newStatus = message.status;
        }
      }
      
      if (roomId) {
        // 개별 방 정보 업데이트
        try {
          // 상태 변경이 명시적으로 있으면 즉시 반영 (게임 시작)
          if (hasStatusUpdate && newStatus) {
            console.log(`[CLEAR-TRACE] 방 ${roomId} 상태 즉시 변경 시도: ${newStatus}`);
            setRooms(prevRooms => {
              return prevRooms.map(room => {
                if (room.id === parseInt(roomId)) {
                  console.log(`[CLEAR-TRACE] 방 ${roomId} 상태 즉시 변경: ${room.status} -> ${newStatus}`);
                  return { ...room, status: newStatus };
                }
                return room;
              });
            });
          }
          
          // 약간의 지연 후 백엔드에서 다시 최신 정보 가져오기 (네트워크 지연 고려)
          setTimeout(() => {
            console.log(`[CLEAR-TRACE] 방 ${roomId} 상태 업데이트 - 지연 후 백엔드에서 최신 정보 가져오기`);
            
            fetch(`/api/v1/rooms/${roomId}`)
              .then(res => {
                if (!res.ok) {
                  throw new Error(`방 정보 요청 실패: ${res.status}`);
                }
                return res.json();
              })
              .then(data => {
                if (data && data.data) {
                  const updatedRoom = data.data;
                  console.log(`[CLEAR-TRACE] 방 ${roomId} 지연 후 정보 수신:`, updatedRoom);
                  console.log(`[CLEAR-TRACE] 방 ${roomId} 지연 후 상태:`, updatedRoom.status);
                  
                  setRooms(prevRooms => {
                    // 기존 목록에 있는지 확인
                    const roomExists = prevRooms.some(room => room.id === parseInt(roomId));
                    
                    if (roomExists) {
                      // 기존 방 정보 업데이트
                      const updatedRooms = prevRooms.map(room => {
                        if (room.id === parseInt(roomId)) {
                          console.log(`[CLEAR-TRACE] 방 ${roomId} 상태 업데이트: ${room.status} -> ${updatedRoom.status}`);
                          return { ...room, ...updatedRoom };
                        }
                        return room;
                      });
                      console.log(`[CLEAR-TRACE] 방 ID ${roomId} 정보 업데이트됨:`, updatedRoom);
                      return updatedRooms;
                    } else {
                      // 새 방 추가
                      console.log(`[CLEAR-TRACE] 새 방 정보 추가됨: ID ${roomId}`, updatedRoom);
                      return [...prevRooms, updatedRoom];
                    }
                  });
                }
              })
              .catch(error => {
                console.error("[CLEAR-TRACE] 방 정보 업데이트 실패:", error);
                // 오류 발생 시 전체 목록 새로고침
                loadRooms();
              });
          }, 1000); // 1초 후 다시 시도
        } catch (error) {
          console.error("[CLEAR-TRACE] 방 정보 업데이트 요청 실패:", error);
          loadRooms();
        }
      } else {
        // 전체 방 목록 새로고침
        console.log("[CLEAR-TRACE] 전체 방 목록 새로고침 (방 업데이트)");
        loadRooms();
      }
      return;
    }
    
    // 사용자 상태 메시지인 경우
    if (message.type === "USER_CONNECT" || message.type === "USER_DISCONNECT" || 
        message.type === "STATUS_UPDATE" || message.type === "USER_LOCATION_UPDATE") {
      // 메시지 정보 로깅
      console.log(`[CLEAR-TRACE] 사용자 상태 업데이트 수신: 타입=${message.type}, 사용자=${message.senderName}, 위치=${message.location || "알 수 없음"}, 방=${message.roomId || "없음"}, 상태=${message.status || "기본"}`);
      
      // 타입이 USER_LOCATION_UPDATE인 경우 중요 내용 강조
      if (message.type === "USER_LOCATION_UPDATE") {
        console.log(`[CLEAR-TRACE] 위치 업데이트: 사용자=${message.senderName}, 방=${message.roomId}, 위치=${message.location}, 상태=${message.status}`);
      }
      
      // 사용자 목록 갱신
      setActiveUsers(prev => {
        // 기존 사용자 목록에서 해당 사용자 제외
        const filtered = prev.filter(u => u.id !== parseInt(message.senderId));
        
        // 연결 메시지인 경우에만 사용자 추가
        if (message.type !== "USER_DISCONNECT") {
          const user: ActiveUser = {
            id: parseInt(message.senderId),
            nickname: message.senderName,
            avatarUrl: message.avatarUrl || DEFAULT_AVATAR,
            status: message.status || "online",
            location: message.location || "IN_LOBBY",
            roomId: message.roomId || null,
            email: currentUser?.email,
            sessions: currentUser?.sessions,
            lastActive: currentUser?.lastActive
          };
          
          // USER_LOCATION_UPDATE 타입일 경우 정확한 상태 표시
          if (message.type === "USER_LOCATION_UPDATE") {
            if (message.location === "IN_ROOM") {
              console.log(`[CLEAR-TRACE] ${message.senderName}님이 ${message.roomId}번 방에 입장했습니다. 상태=${message.status || "게임중"}`);
              
              // 상태가 없다면 게임중/대기중을 판단하기 위해 방 정보 확인
              if (!message.status && message.roomId) {
                const room = rooms.find(r => r.id === parseInt(message.roomId));
                if (room && room.status === 'IN_GAME') {
                  user.status = "게임중";
                  console.log(`[CLEAR-TRACE] 방 정보로부터 상태 유추: ${message.senderName}님은 게임중 상태로 설정`);
                } else if (room) {
                  user.status = "대기중";
                  console.log(`[CLEAR-TRACE] 방 정보로부터 상태 유추: ${message.senderName}님은 대기중 상태로 설정`);
                }
              }
            } else if (message.location === "IN_LOBBY") {
              console.log(`[CLEAR-TRACE] ${message.senderName}님이 로비로 돌아왔습니다. 상태=${message.status || "대기중"}`);
            }
          }
          
          return [...filtered, user];
        }
        
        return filtered;
      });
      
      // 상태 메시지는 채팅에 추가하지 않음
      return;
    }
  };

// WebSocket 초기화에 로비 상태 메시지 구독 추가
const initializeWebSocket = async () => {
  try {
    console.log("[INIT] WebSocket 초기화 시작");
    
    // STOMP 클라이언트 연결 상태 확인 및 대기
    const { waitForConnection, reconnectWebSocket, safeSubscribe, safePublish } = await import('@/lib/backend/stompClient');
    
    // 연결 상태 확인
    let connected = await waitForConnection(2000);
    if (!connected) {
      console.log("[INIT] STOMP 연결 대기 시간 초과, 재연결 시도");
      await reconnectWebSocket();
      connected = await waitForConnection(3000);
      
      if (!connected) {
        console.log("[INIT] 재연결 후에도 STOMP 연결 실패");
        // 실패해도 계속 진행 - 나중에 자동 재시도됨
      }
    }
    
    console.log("[INIT] STOMP 연결 상태:", connected ? "연결됨" : "연결 안됨");
    
    // 모든 구독을 한 번에 시도
    console.log("[INIT] 안전 구독 시작 - 로비 채팅");
    await safeSubscribe("/topic/lobby/chat", (chatMessage) => {
      console.log("[CHAT] 로비 채팅 메시지 수신:", chatMessage);
      
      // 메시지 타입 확인 및 중복 메시지 검사
      if (chatMessage && 
          (chatMessage.type === "CHAT" || (!chatMessage.type && chatMessage.content))) {
        
        // 중복 메시지 검사 - receiveMessage 내부로 이동
        const isDuplicate = chatMessages.some(existingMsg => 
          existingMsg.timestamp === chatMessage.timestamp && 
          existingMsg.senderId === chatMessage.senderId && 
          existingMsg.content === chatMessage.content
        );
        
        if (isDuplicate) {
          console.log("[CHAT] 중복 메시지 무시:", chatMessage);
          return;
        }
      }
      
      // 중복 검사를 통과한 메시지만 처리
      receiveMessage(chatMessage);
    });
    
    console.log("[INIT] 안전 구독 시작 - 기타 토픽");
    await safeSubscribe("/topic/lobby", receiveMessage);
    
    // 로비 상태 업데이트 구독 - 단일 객체 메시지도 처리할 수 있도록 특별 처리
    await safeSubscribe("/topic/lobby/status", (message) => {
      console.log("[SAFE-MESSAGE] /topic/lobby/status 메시지 수신:", message);
      receiveMessage(message);
    });
    
    // 로비 사용자 목록 구독 - 배열과 단일 객체 모두 처리할 수 있도록 수정
    await safeSubscribe("/topic/lobby/users", (data) => {
      console.log("[RECONNECT] 로비 유저 목록/상태 수신:", data);
      
      // 배열인 경우 (전체 유저 목록)
      if (Array.isArray(data)) {
        // 온라인 사용자 ID 목록 추출 및 업데이트
        const onlineUserIds = data.map(user => user.id);
        updateOnlineUserIds(onlineUserIds);
        
        // 아바타 정보 추가
        fetchUserAvatars(data).then(usersWithAvatars => {
          // 현재 상태의 activeUsers에서 location과 roomId 정보 유지
          const updatedUsers = usersWithAvatars.map(newUser => {
            // 기존 사용자 정보 찾기
            const existingUser = activeUsers.find(u => u.id === newUser.id);
            
            // 기존 사용자 정보가 있고 IN_ROOM 상태라면 그 정보 유지
            if (existingUser && existingUser.location === "IN_ROOM") {
              return {
                ...newUser,
                location: existingUser.location,
                roomId: existingUser.roomId,
                status: existingUser.status
              };
            }
            
            // 새로 받은 정보에 location이 있으면 그 정보 사용
            if (newUser.location === "IN_ROOM") {
              return newUser;
            }
            
            // 그 외에는 기본적으로 로비에 있는 것으로 설정
            return {
              ...newUser,
              location: newUser.location || "IN_LOBBY",
              status: newUser.status || "online"
            };
          });
          
          // 현재 사용자를 목록 최상단으로 정렬
          if (currentUser) {
            const sortedUsers = [...updatedUsers].sort((a, b) => {
              if (a.id === currentUser.id) return -1;
              if (b.id === currentUser.id) return 1;
              return 0;
            });
            setActiveUsers(sortedUsers);
          } else {
            setActiveUsers(updatedUsers);
          }
          
          setIsConnected(true);
          
          // 현재 로그인한 사용자의 정보도 업데이트
          if (currentUser) {
            const updatedCurrentUser = updatedUsers.find(user => user.id === currentUser.id);
            if (updatedCurrentUser) {
              // User 타입에 맞게 roomId가 null이면 undefined로 변환
              const typeSafeUser = {
                ...updatedCurrentUser,
                roomId: updatedCurrentUser.roomId === null ? undefined : updatedCurrentUser.roomId
              };
              setCurrentUser(typeSafeUser as User);
            }
          }
        });
      } 
      // 객체인 경우 (위치 업데이트 등)
      else if (data && typeof data === 'object') {
        receiveMessage(data);
      }
    });
    
    // 웹소켓 연결 상태 업데이트
    setIsConnected(true);
    console.log("[INIT] WebSocket 연결 및 구독 완료");
    
    // 연결 성공 시 사용자 정보 로드
    await fetchCurrentUser();
    
    // 방 목록 로드
    await loadRooms();
    
    // 연결 성공 시 본인 상태를 로비에 업데이트
    console.log("[INIT] 로비 상태 업데이트 전송");
    await safePublish('/app/lobby/status', {
      type: "STATUS_UPDATE",
      status: "로비",
      location: "IN_LOBBY",
      roomId: null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("[ERROR] WebSocket 초기화 중 오류 발생:", error);
  }
};

  // 페이지 로드 시 intentional_navigation 플래그 초기화
  useEffect(() => {
    // 로비에 진입하면 플래그 제거
    localStorage.removeItem('intentional_navigation');
  }, []);

  // 웹소켓 초기화 및 방 목록 자동 갱신을 위한 useEffect
  useEffect(() => {
    // 웹소켓 연결 및 방 목록 초기 로드
    initializeWebSocket();
    
    // 15초마다 방 목록 자동 갱신 (백그라운드에서 갱신되도록)
    const refreshInterval = setInterval(() => {
      console.log("방 목록 자동 새로고침");
      loadRooms();
    }, 15000);
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      // 웹소켓 연결 해제
      try {
        if (typeof window !== "undefined") {
          // 모든 웹소켓 구독 해제
          unsubscribe("/topic/lobby");
          unsubscribe("/topic/lobby/chat");
          unsubscribe("/topic/lobby/status");
          unsubscribe("/topic/lobby/users");
          console.log("로비 페이지 언마운트 - 웹소켓 연결 해제");
        }
      } catch (error) {
        console.error("웹소켓 연결 해제 중 오류:", error);
      }
      
      // 자동 갱신 타이머 해제
      clearInterval(refreshInterval);
    };
  }, []);
  
  // 사용자가 페이지를 나갈 때 메시지 캐시 클리어
  useEffect(() => {
    // 다른 페이지로 이동할 때 메시지 캐시를 클리어
    return () => {
      // 방 입장이 아닌 다른 페이지로 이동할 때만 캐시 클리어
      if (!localStorage.getItem('intentional_navigation')) {
        lobbyMessageCache = [];
      }
    };
  }, []);

  // 방 입장 처리 함수 추가
  const handleJoinRoom = async (roomId: string, password?: string) => {
    setIsJoiningRoom(true);
    
    try {
      // 선택한 방 정보 찾기
      const selectedRoom = rooms.find(room => room.id === parseInt(roomId));
      
      // 방 정원 확인
      if (selectedRoom) {
        const currentParticipants = selectedRoom.currentParticipants || selectedRoom.currentPlayers || 0;
        const maxParticipants = selectedRoom.maxParticipants || selectedRoom.capacity || 5;
        
        if (currentParticipants >= maxParticipants) {
          // 방이 가득 찼으면 알림 표시 후 함수 종료
          setToast({
            type: "error",
            message: "방이 이미 가득 찼습니다.",
            duration: 3000
          });
          setIsJoiningRoom(false);
          return;
        }
      }
      
      if (password) {
        // 비공개 방인 경우
        await client.POST(`/api/v1/rooms/{roomId}/join`, {
          params: { path: { roomId: parseInt(roomId) } },
          body: { password } as any
        });
      } else {
        // 공개 방인 경우
        await client.POST(`/api/v1/rooms/{roomId}/join`, {
          params: { path: { roomId: parseInt(roomId) } }
        });
      }
      // 방 입장 성공
      localStorage.setItem('intentional_navigation', 'true');
      window.location.href = `/room/${roomId}`;
    } catch (error) {
      console.error("방 입장에 실패했습니다:", error);
      setJoinRoomError("비밀번호가 올바르지 않거나 입장할 수 없습니다.");
    } finally {
      setIsJoiningRoom(false);
    }
  };

  // 비밀번호 입력 처리 함수
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRoom?.id) return;
    
    handleJoinRoom(String(selectedRoom.id), roomPassword);
  };

  // 친구 요청 목록을 가져오는 함수 추가
  const fetchFriendRequests = async () => {
    try {
      const { getFriendRequests } = await import('@/components/friend/friendApi');
      const requests = await getFriendRequests();
      setFriendRequestCount(requests.length);
    } catch (error) {
      console.error("친구 요청 목록을 불러오는데 실패했습니다:", error);
    }
  };

  // 컴포넌트 마운트 시 및 주기적으로 친구 요청 목록 가져오기
  useEffect(() => {
    if (currentUser) {
      fetchFriendRequests();
      
      // 5분마다 친구 요청 목록 갱신
      const interval = setInterval(fetchFriendRequests, 300000);
      
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // 웹소켓 연결 상태를 주기적으로 확인하는 useEffect 추가
  useEffect(() => {
    if (!currentUser) return; // 로그인된 사용자만 확인
    
    // 10초마다 웹소켓 연결 상태 확인
    const checkConnectionInterval = setInterval(async () => {
      try {
        const { stompClient, waitForConnection, safeSubscribe, reconnectWebSocket } = await import('@/lib/backend/stompClient');
        
        // 연결 상태 확인
        if (!stompClient.connected) {
          console.log("[CHECK] STOMP 연결이 끊어짐 감지");
          
          // 연결이 끊어진 상태임을 사용자에게 알림
          setChatMessages(prev => [
            ...prev,
            {
              type: "SYSTEM",
              content: "채팅 연결이 끊어졌습니다. 재연결 중...",
              senderId: "system",
              senderName: "System",
              timestamp: Date.now(),
              id: `system-reconnect-${Date.now()}`
            }
          ]);
          
          // 재연결 시도
          console.log("[CHECK] 연결 재시도 중...");
          await reconnectWebSocket();
          
          // 연결 대기
          const connected = await waitForConnection(3000);
          
          if (connected) {
            console.log("[CHECK] 연결 복구 성공");
            
            // 모든 주요 채널 재구독
            await safeSubscribe("/topic/lobby/chat", (chatMsg) => {
              console.log("[CHAT] 로비 채팅 메시지 수신:", chatMsg);
              
              // 중복 메시지 검사 추가
              if (chatMsg && 
                  (chatMsg.type === "CHAT" || (!chatMsg.type && chatMsg.content))) {
                
                // 중복 메시지 검사 
                const isDuplicate = chatMessages.some(existingMsg => 
                  existingMsg.timestamp === chatMsg.timestamp && 
                  existingMsg.senderId === chatMsg.senderId && 
                  existingMsg.content === chatMsg.content
                );
                
                if (isDuplicate) {
                  console.log("[CHAT] 중복 메시지 무시:", chatMsg);
                  return;
                }
              }
              
              receiveMessage(chatMsg);
            });
            
            await safeSubscribe("/topic/lobby", receiveMessage);
            await safeSubscribe("/topic/lobby/status", receiveMessage);
            await safeSubscribe("/topic/lobby/users", receiveMessage);
            
            // 연결 성공 메시지
            setChatMessages(prev => [
              ...prev,
              {
                type: "SYSTEM",
                content: "채팅 연결이 복구되었습니다.",
                senderId: "system",
                senderName: "System",
                timestamp: Date.now(),
                id: `system-reconnected-${Date.now()}`
              }
            ]);
            
            // 연결 상태 업데이트
            setIsConnected(true);
          } else {
            console.log("[CHECK] 연결 복구 실패");
            
            // 연결 실패 메시지
            setChatMessages(prev => [
              ...prev,
              {
                type: "SYSTEM",
                content: "채팅 연결 복구에 실패했습니다. 페이지를 새로고침 해주세요.",
                senderId: "system",
                senderName: "System",
                timestamp: Date.now(),
                id: `system-reconnect-fail-${Date.now()}`
              }
            ]);
          }
        }
      } catch (error) {
        console.error("[CHECK] 연결 상태 확인 중 오류:", error);
      }
    }, 10000); // 10초마다 확인
    
    return () => {
      clearInterval(checkConnectionInterval);
    };
  }, [currentUser, chatMessages]);

  // 사용자 프로필 캐시 초기화
  useEffect(() => {
    // 이미 로그인된 사용자라면 프로필 정보를 재로드
    if (currentUser?.id) {
      console.log("현재 사용자 프로필 캐시 상태 확인:", userProfileCache[currentUser.id]);
      
      // 이미 캐시에 있는 경우도 '새로고침' 시점에 다시 로드하여 최신 상태 유지
      const fetchProfileData = async () => {
        try {
          const response = await client.GET(`/api/v1/members/{memberId}`, {
            params: { path: { memberId: currentUser.id } }
          }) as ApiResponse<UserProfile>;
          
          if (response.data?.data) {
            console.log("사용자 프로필 데이터 리로드 완료:", response.data.data);
            // 캐시 업데이트
            userProfileCache[currentUser.id] = {
              ...response.data.data,
              lastUpdated: Date.now()
            };
            
            // 현재 사용자 상태도 업데이트 - 중요한 필드만
            setCurrentUser(prevUser => {
              if (!prevUser) return prevUser;
              return {
                ...prevUser,
                avatarUrl: response.data?.data.avatarUrl || prevUser.avatarUrl
              };
            });
            
            // 로컬 스토리지에 프로필 캐시 저장
            try {
              localStorage.setItem('userProfileCache', JSON.stringify(userProfileCache));
            } catch (e) {
              console.error("프로필 캐시 저장 실패:", e);
            }
          }
        } catch (error) {
          console.error("프로필 데이터 새로고침 실패:", error);
        }
      };
      
      fetchProfileData();
    }
  }, [currentUser?.id]);

  // 첫 로딩 시 로컬 스토리지에서 캐시 복원
  useEffect(() => {
    try {
      const cachedData = localStorage.getItem('userProfileCache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        // 전역 변수에 할당
        Object.assign(userProfileCache, parsed);
        console.log("로컬 스토리지에서 프로필 캐시 복원:", userProfileCache);
      }
    } catch (e) {
      console.error("캐시 복원 실패:", e);
    }
  }, []);

  // 상점 모달 토글 함수 추가
  const toggleShopModal = () => {
    setShowShopModal(!showShopModal);
  };

  // 아바타 구매 완료 후 호출될 함수 추가
  const handleAvatarPurchased = async () => {
    try {
      // 즉시 캐시 무효화를 위한 헤더 추가
      const customHeaders = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Request-Time": Date.now().toString()
      };
      
      // 1. 현재 사용자 정보 다시 불러오기 (이미지 URL 갱신)
      const userResponse = await client.GET("/api/v1/members/me", {
        headers: customHeaders
      }) as ApiResponse<User>;
      
      if (userResponse.data?.data) {
        const userData = userResponse.data.data;
        
        // 현재 사용자 상태 업데이트
        setCurrentUser(userData);
        
        // 프로필 캐시 강제 업데이트
        if (userData.id) {
          // 프로필 데이터 가져오기
          const profileResponse = await client.GET(`/api/v1/members/{memberId}`, {
            params: { path: { memberId: userData.id } },
            headers: customHeaders
          }) as ApiResponse<UserProfile>;
          
          if (profileResponse.data?.data) {
            // 캐시 최신 데이터로 업데이트
            userProfileCache[userData.id] = {
              ...profileResponse.data.data,
              lastUpdated: Date.now()
            };
            
            // 로컬 스토리지 캐시 업데이트
            try {
              localStorage.setItem('userProfileCache', JSON.stringify(userProfileCache));
            } catch (e) {
              console.error("프로필 캐시 저장 실패:", e);
            }
            
            // activeUsers 목록에서도 현재 사용자 아바타 업데이트
            setActiveUsers(prev => {
              return prev.map(user => {
                if (user.id === userData.id) {
                  return {
                    ...user,
                    avatarUrl: profileResponse.data?.data.avatarUrl || DEFAULT_AVATAR
                  };
                }
                return user;
              });
            });
            
            // 채팅 메시지에서 현재 사용자 아바타 업데이트
            setChatMessages(prev => {
              return prev.map(msg => {
                if (msg.senderId === String(userData.id)) {
                  return {
                    ...msg,
                    avatarUrl: profileResponse.data?.data.avatarUrl || DEFAULT_AVATAR
                  };
                }
                return msg;
              });
            });
          }
        }
      }
      
      // 2. 웹소켓 이용해 로비 사용자 목록 새로고침
      if (stompClient && stompClient.connected) {
        publish("/app/lobby/users", {});
      }
      
      // 3. 성공 메시지 표시
      setToast({
        type: "success",
        message: "아바타가 성공적으로 적용되었습니다.",
        duration: 3000
      });
    } catch (error) {
      console.error("아바타 적용 후 데이터 갱신 실패:", error);
      
      // 기본 재시도만 수행
      fetchCurrentUser();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col h-full">
      {/* 토스트 메시지 표시 */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* 게임스러운 상단 네비게이션 바 추가 */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-md border-b border-gray-700/50 shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 로고 */}
            <div className="flex items-center">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">Quizzle</div>
            </div>
            
            {/* 중앙 네비게이션 버튼들 */}
            <div className="flex items-center space-x-1">
              <button 
                onClick={toggleFriendModal}
                className="group relative px-4 py-2 rounded-lg hover:bg-gray-700/50 transition-all"
              >
                <div className="flex flex-col items-center relative">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 group-hover:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  {friendRequestCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {friendRequestCount > 9 ? '9+' : friendRequestCount}
                    </span>
                  )}
                  <span className="text-xs text-gray-300 group-hover:text-white mt-1">친구</span>
                </div>
                <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-blue-500 ${showFriendModal ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all`}></div>
              </button>
              
              <button className="group relative px-4 py-2 rounded-lg hover:bg-gray-700/50 transition-all">
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 group-hover:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  <span className="text-xs text-gray-300 group-hover:text-white mt-1">룸</span>
                </div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-blue-500 opacity-100 transition-all"></div>
              </button>
              
              <button 
                onClick={openRankingModal} 
                className="group relative px-4 py-2 rounded-lg hover:bg-gray-700/50 transition-all"
              >
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 group-hover:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM1.99 4.75a1 1 0 011-1H3a1 1 0 011 1v.01a1 1 0 01-1 1h-.01a1 1 0 01-1-1v-.01zM1.99 15.25a1 1 0 011-1H3a1 1 0 011 1v.01a1 1 0 01-1 1h-.01a1 1 0 01-1-1v-.01zM1.99 10a1 1 0 011-1H3a1 1 0 011 1v.01a1 1 0 01-1 1h-.01a1 1 0 01-1-1V10z" />
                  </svg>
                  <span className="text-xs text-gray-300 group-hover:text-white mt-1">랭킹</span>
                </div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-all"></div>
              </button>
              
              <button 
                onClick={toggleShopModal} 
                className="group relative px-4 py-2 rounded-lg hover:bg-gray-700/50 transition-all"
              >
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 group-hover:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                  </svg>
                  <span className="text-xs text-gray-300 group-hover:text-white mt-1">상점</span>
                </div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-all"></div>
              </button>
            </div>
            
            {/* 사용자 프로필 */}
            {currentUser ? (
              <div 
                className="flex items-center bg-gray-800/80 pl-3 pr-4 py-1.5 rounded-full border border-gray-700/50 cursor-pointer hover:bg-gray-700/50 transition-all"
                onClick={() => handleUserClick(currentUser as User)}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden mr-2 border border-gray-700">
                  {currentUser.avatarUrl ? (
                    <img 
                      src={currentUser.avatarUrl} 
                      alt={currentUser.nickname} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium">
                      {currentUser.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">{currentUser.nickname}</span>
                  <div className="flex items-center">
                    <span className="text-xs text-blue-400 mr-2">Lv. {userProfileCache[currentUser.id]?.level || 1}</span>
                    <span className="text-xs text-yellow-400">
                      {userProfileCache[currentUser.id]?.point || 0} P
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <button className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm transition-all">
                로그인
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* 메인 컨텐츠 - 상단 네비게이션 바 공간 확보를 위해 마진 추가 */}
      <div className="flex flex-col lg:flex-row gap-8 flex-grow mb-4 mt-20">
        <div className="flex-grow">
          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-xl p-6 mb-8">
            <h1 className="text-3xl font-bold text-white mb-4">로비</h1>
            <p className="text-gray-300 mb-6">
              퀴즈 룸에 참여하거나 새 퀴즈 룸을 만들어 친구들과 경쟁하세요!
            </p>
            
            <div className="flex flex-wrap gap-4 mb-6">
              <button 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
                onClick={() => {
                  if (!currentUser) {
                    setToast({
                      type: "error",
                      message: "로그인 후 이용 가능합니다.",
                      duration: 3000
                    });
                    return;
                  }
                  setShowCreateRoomModal(true);
                }}
              >
                새 퀴즈룸 만들기
              </button>
              <button 
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600 px-6 py-3 rounded-lg font-medium transition-all"
                onClick={loadRooms}
              >
                룸 목록 새로고침
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto pr-2">
              {rooms.length > 0 ? (
                rooms.map((room) => (
                  <div 
                    key={room.id} 
                    className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-blue-500 transition-colors cursor-pointer shadow-md"
                    onClick={() => {
                      console.log(room)
                      if (room.id) {
                        if (room.isPrivate) {
                          // 비공개 방인 경우 비밀번호 입력 모달 표시
                          setSelectedRoom(room);
                          setShowPasswordModal(true);
                          setRoomPassword("");
                          setJoinRoomError("");
                        } else {
                          // 공개 방인 경우 바로 입장
                          handleJoinRoom(String(room.id));
                        }
                      } else {
                        alert("잘못된 방 정보입니다.");
                      }
                    }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className={`text-xs uppercase tracking-wider font-semibold ${
                        room.status === "IN_GAME" ? "text-red-400" : "text-blue-400"
                      }`}>
                        {room.status === "IN_GAME" ? "게임중" : "대기중"}
                      </div>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 ${
                          room.status === "IN_GAME" ? "bg-red-400" : "bg-green-400"
                        } rounded-full mr-1`}></div>
                        <span className="text-xs text-gray-300">
                          {room.currentParticipants || room.currentPlayers || 0}/{room.maxParticipants || room.capacity || 5}
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="font-medium text-white text-lg mb-1">{room.title}</h3>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      <div className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded-md flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {room.ownerNickname || "퀴즐"}
                      </div>
                      
                      {room.isPrivate && (
                        <div className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded-md flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          비공개
                        </div>
                      )}
                      
                      {room.difficulty && (
                        <div className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded-md flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {room.difficulty}
                        </div>
                      )}
                      
                      {room.questionCount && (
                        <div className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded-md flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          문제 {room.questionCount}개
                        </div>
                      )}
                    </div>
                    
                    {(room.mainCategory || room.subCategory) && (
                      <div className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded-md inline-flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {room.mainCategory && `${room.mainCategory}`}
                        {room.mainCategory && room.subCategory && ' > '}
                        {room.subCategory && `${room.subCategory}`}
                      </div>
                    )}
                    
                    <div className="text-xs bg-gray-800/80 text-gray-400 px-2 py-1 rounded-md inline-flex items-center mt-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      최근 활동: {new Date(room.createdAt || Date.now()).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-10 text-gray-400">
                  현재 열려있는 방이 없습니다. 새로운 퀴즈 룸을 만들어보세요!
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 실시간 접속자 목록 */}
        <div className="w-full lg:w-80">
          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-xl p-6 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">접속자 목록</h2>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                <span className="text-sm text-gray-300">{activeUsers.length}명 접속 중</span>
                        </div>
                        </div>
            
            <div className="space-y-2 max-h-[20vh] overflow-y-auto pr-2">
              {activeUsers.length > 0 ? (
                activeUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/60 cursor-pointer transition-colors duration-200 ${
                      currentUser && user.id === currentUser.id ? 'bg-gray-700/40 border border-blue-500/30' : ''
                    }`}
                    onClick={() => handleUserClick(user as User)}
                  >
                    <div className="w-8 h-8 rounded-full border border-gray-700 overflow-hidden">
                      {user.avatarUrl ? (
                        <img 
                          src={userProfileCache[user.id]?.avatarUrl || user.avatarUrl} 
                          alt={user.nickname} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // 이미지 로드 실패 시 이니셜 표시
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-br', 'from-blue-500', 'to-indigo-500', 'flex', 'items-center', 'justify-center', 'text-white', 'font-medium');
                            (e.target as HTMLImageElement).parentElement!.innerHTML = user.nickname.charAt(0).toUpperCase();
                          }} 
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium">
                          {user.nickname.charAt(0).toUpperCase()}
                      </div>
                      )}
                        </div>
                    <div className="flex-grow">
                      <div className="text-sm text-white font-medium flex items-center">
                        {user.nickname}
                        {currentUser && user.id === currentUser.id && (
                          <span className="ml-1 px-1.5 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded-md">나</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-400">
                          {user.location === "IN_ROOM" 
                            ? `게임중 ${user.roomId ? `(${user.roomId}번방)` : ''}` 
                            : user.status === "online" ? "대기중" : user.status}
                        </div>
                        {/* 게임중 입장 버튼 제거 */}
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="온라인"></div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-4">
                  {isConnected ? '접속자가 없습니다' : '연결 중...'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 채팅 영역 */}
      <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-xl mt-auto">
        <div className="flex items-center justify-between p-2 border-b border-gray-700">
          <div className="flex items-center">
            <h3 className="text-white font-medium text-sm">로비 채팅</h3>
            <div className="flex items-center ml-2">
              <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
              <span className="text-xs text-gray-300">{activeUsers.length}명 접속 중</span>
            </div>
          </div>
          <button 
            onClick={() => setShowChat(!showChat)}
            className="bg-gray-700 hover:bg-gray-600 p-1 rounded text-white"
          >
            {showChat ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
        
        {showChat && (
          <>
            <div 
              ref={chatContainerRef}
              className="h-32 overflow-y-auto p-2 space-y-1 bg-gray-900/30"
            >
              {chatMessages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`${
                    msg.type === "SYSTEM" 
                      ? "flex justify-center" 
                      : "flex"
                  }`}
                >
                  {msg.type === "SYSTEM" ? (
                    <div className="bg-gray-800/70 text-gray-300 text-xs py-0.5 px-2 rounded-full">
                      {msg.content}
                    </div>
                  ) : (
                    <>
                      {/* 시간 표시 */}
                      <div className="flex-shrink-0 text-xs text-gray-500 mr-1 mt-1 w-8">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      
                      {/* 발신자 아바타 */}
                      <div className="flex-shrink-0 mr-1">
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-800">
                          {msg.avatarUrl ? (
                            <img 
                              src={userProfileCache[msg.senderId]?.avatarUrl || msg.avatarUrl} 
                              alt={msg.senderName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // 이미지 로드 실패 시 기본 아바타 표시
                                (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs font-bold">
                              {msg.senderName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 닉네임과 메시지 */}
                      <div className="flex-grow">
                        <div className="flex items-center gap-1 leading-none">
                          <span className={`font-medium text-sm ${
                            currentUser && msg.senderId === currentUser.id.toString() 
                              ? "text-blue-400" 
                              : "text-gray-300"
                          }`}>
                            {msg.senderName}
                          </span>
                          {currentUser && msg.senderId === currentUser.id.toString() && (
                            <span className="text-xs bg-blue-900/30 text-blue-400 px-1 rounded">나</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-200 break-words">{msg.content}</div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {/* 세션 만료 상태일 때 자동 재연결 메시지 표시 */}
              {isConnected && !currentUser && activeUsers.length > 0 && (
                <div className="flex justify-center">
                  <div className="bg-blue-900/30 text-blue-300 text-xs py-2 px-4 rounded-lg border border-blue-800/50 flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    세션이 만료되었습니다. 자동으로 재연결 중...
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-2 border-t border-gray-700">
              <div className="flex items-center">
                <input
                  type="text"
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  placeholder={currentUser ? "메시지를 입력하세요..." : "로그인 후 채팅 가능합니다"}
                  className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-gray-200 text-xs placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!currentUser}
                />
                <button
                  onClick={handleSendChatMessage}
                  disabled={!newChatMessage.trim() || !currentUser}
                  className={`ml-2 p-1.5 rounded-lg ${
                    newChatMessage.trim() && currentUser
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-700 cursor-not-allowed"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              {!currentUser && (
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-red-400">
                    {isConnected && activeUsers.length > 0 ? 
                      "세션이 만료되었습니다. 자동으로 재연결 중..." : 
                      "로그인 후 채팅에 참여할 수 있습니다."
                    }
                  </div>
                  {isConnected && !currentUser && activeUsers.length > 0 && (
                    <button 
                      onClick={() => router.push('/login')}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded transition-colors"
                    >
                      로그인 하기
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {/* 닉네임 변경 모달 */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800/80 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 relative">
            {/* X 버튼 (REGISTER 상태가 아닐 때만 활성화) */}
            <button 
              onClick={() => {
                if (currentUser?.status !== "REGISTER" || (currentUser?.nickname && currentUser.nickname.startsWith("GUEST"))) {
                  setShowNicknameModal(false);
                }
              }}
              disabled={currentUser?.status === "REGISTER" && !(currentUser?.nickname && currentUser.nickname.startsWith("GUEST"))}
              className={`absolute top-4 right-4 p-1.5 rounded-full ${
                currentUser?.status === "REGISTER" && !(currentUser?.nickname && currentUser.nickname.startsWith("GUEST"))
                  ? "text-gray-500 cursor-not-allowed" 
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h3 className="text-xl font-bold text-white mb-4">
              {currentUser?.status === "REGISTER" ? "닉네임 설정" : "닉네임 변경"}
            </h3>
            
            {currentUser?.status === "REGISTER" && (
              <div className="mb-3 p-2 bg-blue-900/20 text-blue-400 text-sm rounded-lg border border-blue-800/30">
                첫 로그인 시에는 닉네임 설정이 필수입니다.
              </div>
            )}
            
            {currentUser?.status === "REGISTER" ? (
              <p className="text-gray-300 mb-4">
                퀴즐에 오신 것을 환영합니다! 서비스를 이용하기 위해 닉네임을 설정해주세요.
              </p>
            ) : currentUser?.nickname && currentUser.nickname.startsWith("GUEST") ? (
              <div className="text-gray-300 mb-4">
                <p>새로운 닉네임을 입력해주세요.</p>
                <p className="mt-1">GUEST 닉네임은 1회 무료로 변경 가능합니다.</p>
                
                <div className="mt-3 p-3 bg-blue-900/20 rounded-lg border border-blue-700/30">
                  <p className="text-blue-400 text-sm">
                    <span className="font-medium">✨ 특별 혜택:</span> GUEST 사용자는 닉네임을 1회 무료로 변경할 수 있습니다. 원하는 닉네임으로 지금 변경해보세요!
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-gray-300 mb-4">
                <p>새로운 닉네임을 입력해주세요.</p>
                <p className="mt-1">닉네임 변경 시 포인트가 차감될 수 있습니다.</p>
                
                <div className="mt-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">현재 포인트:</span>
                    <span className="text-green-400 font-semibold">{userProfileCache[currentUser?.id || 0]?.point || 0} P</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-gray-400">차감 포인트:</span>
                    <span className="text-red-400 font-semibold">100 P</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-gray-400">변경 후 포인트:</span>
                    <span className="text-blue-400 font-semibold">{Math.max(0, (userProfileCache[currentUser?.id || 0]?.point || 0) - 100)} P</span>
                  </div>
                  
                  {(userProfileCache[currentUser?.id || 0]?.point || 0) < 100 && (
                    <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/30">
                      포인트가 부족합니다. 퀴즈를 풀어 포인트를 모아보세요!
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <input
                type="text"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                placeholder="닉네임을 입력하세요"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                maxLength={10}
                disabled={isChangingNickname}
              />
              <p className="text-xs text-gray-400 mt-1">최대 10자까지 입력 가능합니다.</p>
            </div>
            
            <div className={currentUser?.status === "REGISTER" && !(currentUser?.nickname && currentUser.nickname.startsWith("GUEST")) ? "" : "flex gap-2"}>
              {(currentUser?.status !== "REGISTER" || (currentUser?.nickname && currentUser.nickname.startsWith("GUEST"))) && (
                <button
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium"
                  onClick={() => setShowNicknameModal(false)}
                  disabled={isChangingNickname}
                >
                  취소
                </button>
              )}
              
              <button
                className={`${currentUser?.status === "REGISTER" && !(currentUser?.nickname && currentUser.nickname.startsWith("GUEST")) ? "w-full" : "flex-1"} ${
                  currentUser?.status === "REGISTER" || (currentUser?.nickname && currentUser.nickname.startsWith("GUEST")) || (userProfileCache[currentUser?.id || 0]?.point || 0) >= 100
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    : "bg-gray-600 cursor-not-allowed"
                } text-white px-4 py-2 rounded-lg font-medium relative`}
                onClick={handleChangeNickname}
                disabled={(currentUser?.status !== "REGISTER" && !(currentUser?.nickname && currentUser.nickname.startsWith("GUEST")) && (userProfileCache[currentUser?.id || 0]?.point || 0) < 100) || isChangingNickname}
              >
                {isChangingNickname ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    처리 중...
                  </span>
                ) : (
                  currentUser?.status === "REGISTER" ? "닉네임 저장" : "닉네임 변경"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 모달 */}
      {showProfileModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800/80 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="relative">
              {/* 배경 그라데이션 */}
              <div className="h-28 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
              
              {/* 닫기 버튼 */}
              <button 
                onClick={closeProfileModal}
                className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 rounded-full p-1.5 text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* 아바타 */}
              <div className="absolute -bottom-12 left-6">
                <div className="w-24 h-24 rounded-full border-4 border-gray-800 overflow-hidden shadow-lg">
                  {selectedUser.loading ? (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : selectedUser.avatarUrl ? (
                    <img 
                      src={selectedUser.avatarUrl} 
                      alt={selectedUser.nickname} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // 이미지 로드 실패 시 기본 아바타로 대체
                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                      }} 
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold">
                      {selectedUser.nickname?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="pt-14 px-6 pb-6">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white mb-1">{selectedUser.nickname}</h3>
                {selectedUser.loading ? (
                  <div className="h-6 w-16 bg-gray-700 rounded animate-pulse"></div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-900/30 rounded-md px-2 py-0.5 border border-blue-800/50 text-blue-400 text-sm">
                      Lv. {selectedUser.level || 1}
                    </span>
                    
                    {/* 자신의 프로필인 경우 닉네임 변경 버튼 표시 */}
                    {currentUser && selectedUser.id === currentUser.id && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // 이벤트 버블링 방지
                          closeProfileModal();
                          // 닉네임 모달 표시 전 기본값 설정
                          setNewNickname(currentUser.nickname);
                          setShowNicknameModal(true);
                        }}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded transition-colors"
                      >
                        닉네임 변경
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {selectedUser.error && (
                  <div className="bg-red-900/20 text-red-400 p-3 rounded-lg text-sm border border-red-900/30">
                    {selectedUser.error}
                  </div>
                )}
                
                <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-gray-400 text-sm mb-2">프로필 정보</h4>
                  {selectedUser.loading ? (
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-gray-700 rounded w-1/2 animate-pulse"></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">경험치</div>
                        <div className="text-white font-medium">{selectedUser.exp?.toLocaleString() || 0} XP</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">포인트</div>
                        <div className="text-white font-medium">{selectedUser.point?.toLocaleString() || 0} P</div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-gray-400 text-sm mb-2">업적</h4>
                  {selectedUser.loading ? (
                    <div className="flex gap-2">
                      <div className="w-8 h-8 bg-gray-700 rounded-md animate-pulse"></div>
                      <div className="w-8 h-8 bg-gray-700 rounded-md animate-pulse"></div>
                      <div className="w-8 h-8 bg-gray-700 rounded-md animate-pulse"></div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l.707.707.707-.707A1 1 0 0115 2h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-.707-.293L14 5.414l-.707.707A1 1 0 0112 7h-2a1 1 0 01-1-1V4a1 1 0 011-1h2zm0 10a1 1 0 01.707.293l.707.707.707-.707A1 1 0 0115 12h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-.707-.293L14 15.414l-.707.707A1 1 0 0112 17h-2a1 1 0 01-1-1v-2a1 1 0 011-1h2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 랭킹 모달 */}
      <RankingModal 
        isOpen={showRankingModal} 
        onClose={closeRankingModal} 
        currentUserId={currentUser?.id}
        onToast={(toast) => setToast(toast)}
      />

      {/* 친구 모달 */}
      {showFriendModal && (
        <FriendModal 
          isOpen={showFriendModal} 
          onClose={() => setShowFriendModal(false)}
          friendRequestCount={friendRequestCount}
          onRequestCountChange={setFriendRequestCount}
        />
      )}

      {/* 방 생성 모달 */}
      {showCreateRoomModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800/90 border border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 relative overflow-y-auto max-h-[90vh]">
            {/* 닫기 버튼 */}
            <button 
              onClick={() => setShowCreateRoomModal(false)}
              className="absolute top-4 right-4 bg-gray-700 hover:bg-gray-600 p-1.5 rounded-full text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-2xl font-bold text-white mb-6">새 퀴즈룸 만들기</h2>
            
            {roomCreateError && (
              <div className="bg-red-900/30 text-red-400 p-3 rounded-lg mb-4 border border-red-800/30">
                {roomCreateError}
              </div>
            )}
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              
              if (isCreatingRoom) return;
              
              // 폼 데이터 가져오기
              const formData = new FormData(e.currentTarget);
              const title = formData.get('title') as string;
              const capacity = parseInt(formData.get('capacity') as string);
              const difficulty = formData.get('difficulty') as string;
              const mainCategory = formData.get('mainCategory') as string;
              const subCategory = formData.get('subCategory') as string;
              const answerType = formData.get('answerType') as string;
              const problemCount = parseInt(formData.get('problemCount') as string);
              const isPrivate = formData.get('isPrivate') === 'on';
              const password = formData.get('password') as string;
              
              // 유효성 검사
              if (!title || title.trim() === '') {
                setRoomCreateError("방 제목을 입력해주세요.");
                return;
              }
              
              if (title.length > 30) {
                setRoomCreateError("방 제목은 30자 이내로 입력해주세요.");
                return;
              }
              
              if (isNaN(capacity) || capacity < 1 || capacity > 8) {
                setRoomCreateError("최대 인원은 1-8명 사이로 설정해주세요.");
                return;
              }
              
              if (!difficulty) {
                setRoomCreateError("난이도를 선택해주세요.");
                return;
              }
              
              if (!mainCategory) {
                setRoomCreateError("메인 카테고리를 선택해주세요.");
                return;
              }
              
              if (!subCategory) {
                setRoomCreateError("서브 카테고리를 선택해주세요.");
                return;
              }
              
              if (!answerType) {
                setRoomCreateError("답변 유형을 선택해주세요.");
                return;
              }
              
              if (!problemCount || isNaN(parseInt(problemCount.toString())) || parseInt(problemCount.toString()) < 5 || parseInt(problemCount.toString()) > 20) {
                setRoomCreateError("문제 수는 5-20개 사이로 설정해주세요.");
                return;
              }
              
              if (isPrivate && (!password || !password.match(/^\d{4}$/))) {
                setRoomCreateError("비공개 방은 4자리 숫자 비밀번호가 필요합니다.");
                return;
              }
              
              // 방 생성 요청
              setIsCreatingRoom(true);
              setRoomCreateError("");
              
              try {
                // capacity, problemCount를 숫자로 변환
                const capacityNum = parseInt(capacity.toString());
                const problemCountNum = parseInt(problemCount.toString());
                
                // 요청 데이터 준비
                // Enum 값을 문자열 그대로 전달
                const requestData = {
                  title,
                  capacity: capacityNum,
                  difficulty: difficulty as "EASY" | "NORMAL" | "HARD",
                  mainCategory: mainCategory as "SCIENCE" | "HISTORY" | "LANGUAGE" | "GENERAL_KNOWLEDGE",
                  subCategory: subCategory as "PHYSICS" | "CHEMISTRY" | "BIOLOGY" | "WORLD_HISTORY" | "KOREAN_HISTORY" | "KOREAN" | "ENGLISH" | "CURRENT_AFFAIRS" | "CULTURE" | "SPORTS",
                  answerType: answerType as "MULTIPLE_CHOICE" | "TRUE_FALSE",
                  problemCount: problemCountNum,
                  isPrivate,
                  password: isPrivate ? password : undefined
                };
                
                console.log("방 생성 요청 데이터:", requestData);
                
                // client 객체 사용 (baseUrl이 이미 설정되어 있음)
                const response = await client.POST("/api/v1/rooms", {
                  body: requestData
                } as any) as ApiResponse<RoomResponse>;
                
                console.log("API 응답:", response);
                
                if (response.error) {
                  console.error("방 생성 오류:", response.error);
                  setRoomCreateError(response.error.message || "방 생성에 실패했습니다.");
                  return;
                }
                
                if (response.data?.data) {
                  const roomId = response.data.data.id;
                  
                  // 방 생성 성공 메시지
                  setToast({
                    type: "success",
                    message: "퀴즈룸이 생성되었습니다!",
                    duration: 3000
                  });
                  
                  // 방 생성 모달 닫기
                  setShowCreateRoomModal(false);
                  
                  // 생성된 방으로 이동
                  localStorage.setItem('intentional_navigation', 'true');
                  window.location.href = `/room/${roomId}`;
                }
              } catch (error) {
                console.error("방 생성 중 오류 발생:", error);
                setRoomCreateError("방 생성에 실패했습니다. 다시 시도해주세요.");
              } finally {
                setIsCreatingRoom(false);
              }
            }} className="space-y-4">
              {/* 방 제목 */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">방 제목</label>
                <input 
                  type="text" 
                  id="title" 
                  name="title" 
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="방 제목을 입력하세요 (최대 30자)"
                  maxLength={30}
                />
              </div>
              
              {/* 최대 인원 */}
              <div>
                <label htmlFor="capacity" className="block text-sm font-medium text-gray-300 mb-1">최대 인원</label>
                <select 
                  id="capacity" 
                  name="capacity" 
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <option key={num} value={num}>{num}명</option>
                  ))}
                </select>
              </div>
              
              {/* 난이도 */}
              <div>
                <label htmlFor="difficulty" className="block text-sm font-medium text-gray-300 mb-1">난이도</label>
                <select 
                  id="difficulty" 
                  name="difficulty" 
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EASY">쉬움</option>
                  <option value="NORMAL">보통</option>
                  <option value="HARD">어려움</option>
                </select>
              </div>
              
              {/* 메인 카테고리 */}
              <div>
                <label htmlFor="mainCategory" className="block text-sm font-medium text-gray-300 mb-1">메인 카테고리</label>
                <select 
                  id="mainCategory" 
                  name="mainCategory" 
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    // 서브 카테고리 업데이트 로직 (필요하면 추가)
                    const subCategorySelect = document.getElementById('subCategory') as HTMLSelectElement;
                    const selectedMainCategory = e.target.value;
                    
                    // 서브 카테고리 옵션 필터링
                    Array.from(subCategorySelect.options).forEach(option => {
                      const optionElement = option as HTMLOptionElement;
                      const isVisible = optionElement.dataset.main === selectedMainCategory;
                      optionElement.hidden = !isVisible;
                      optionElement.disabled = !isVisible;
                    });
                    
                    // 첫 번째 가능한 서브 카테고리 선택
                    const firstVisibleOption = Array.from(subCategorySelect.options).find(
                      option => (option as HTMLOptionElement).dataset.main === selectedMainCategory
                    ) as HTMLOptionElement | undefined;
                    
                    if (firstVisibleOption) {
                      subCategorySelect.value = firstVisibleOption.value;
                    }
                  }}
                >
                  <option value="SCIENCE">과학</option>
                  <option value="HISTORY">역사</option>
                  <option value="LANGUAGE">언어</option>
                  <option value="GENERAL_KNOWLEDGE">일반 상식</option>
                </select>
              </div>
              
              {/* 서브 카테고리 */}
              <div>
                <label htmlFor="subCategory" className="block text-sm font-medium text-gray-300 mb-1">서브 카테고리</label>
                <select 
                  id="subCategory" 
                  name="subCategory" 
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PHYSICS" data-main="SCIENCE">물리학</option>
                  <option value="CHEMISTRY" data-main="SCIENCE">화학</option>
                  <option value="BIOLOGY" data-main="SCIENCE">생물학</option>
                  
                  <option value="WORLD_HISTORY" data-main="HISTORY" hidden disabled>세계사</option>
                  <option value="KOREAN_HISTORY" data-main="HISTORY" hidden disabled>한국사</option>
                  
                  <option value="KOREAN" data-main="LANGUAGE" hidden disabled>한국어</option>
                  <option value="ENGLISH" data-main="LANGUAGE" hidden disabled>영어</option>
                  
                  <option value="CURRENT_AFFAIRS" data-main="GENERAL_KNOWLEDGE" hidden disabled>시사</option>
                  <option value="CULTURE" data-main="GENERAL_KNOWLEDGE" hidden disabled>문화</option>
                  <option value="SPORTS" data-main="GENERAL_KNOWLEDGE" hidden disabled>스포츠</option>
                </select>
              </div>
              
              {/* 답변 유형 */}
              <div>
                <label htmlFor="answerType" className="block text-sm font-medium text-gray-300 mb-1">답변 유형</label>
                <select 
                  id="answerType" 
                  name="answerType" 
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MULTIPLE_CHOICE">객관식</option>
                  {/* <option value="TRUE_FALSE">O/X</option> */}
                </select>
              </div>
              
              {/* 문제 수 */}
              <div>
                <label htmlFor="problemCount" className="block text-sm font-medium text-gray-300 mb-1">문제 수</label>
                <select 
                  id="problemCount" 
                  name="problemCount" 
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[5, 10, 15, 20].map(num => (
                    <option key={num} value={num}>{num}개</option>
                  ))}
                </select>
              </div>
              
              {/* 비공개 방 설정 */}
              <div className="flex items-center mb-2">
                <input 
                  type="checkbox" 
                  id="isPrivate" 
                  name="isPrivate" 
                  className="w-4 h-4 text-blue-600 border-gray-500 rounded focus:ring-blue-500"
                  onChange={(e) => {
                    const passwordInput = document.getElementById('password') as HTMLInputElement;
                    if (e.target.checked) {
                      passwordInput.disabled = false;
                      passwordInput.classList.remove('bg-gray-800');
                      passwordInput.classList.add('bg-gray-700');
                    } else {
                      passwordInput.disabled = true;
                      passwordInput.value = '';
                      passwordInput.classList.remove('bg-gray-700');
                      passwordInput.classList.add('bg-gray-800');
                    }
                  }}
                />
                <label htmlFor="isPrivate" className="ml-2 text-sm font-medium text-gray-300">비공개 방</label>
              </div>
              
              {/* 비밀번호 */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">비밀번호 (4자리 숫자)</label>
                <input 
                  type="password" 
                  id="password" 
                  name="password" 
                  disabled
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0000"
                  maxLength={4}
                  pattern="\d{4}"
                  title="4자리 숫자를 입력해주세요."
                />
                <p className="text-xs text-gray-400 mt-1">비공개 방은 4자리 숫자 비밀번호가 필요합니다.</p>
              </div>
              
              {/* 제출 버튼 */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isCreatingRoom}
                  className={`w-full ${
                    isCreatingRoom
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  } text-white py-3 rounded-lg font-medium transition-all`}
                >
                  {isCreatingRoom ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      방 생성 중...
                    </div>
                  ) : "방 생성하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 비밀번호 입력 모달 */}
      {showPasswordModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800/90 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 relative">
            {/* 닫기 버튼 */}
            <button 
              onClick={() => {
                setShowPasswordModal(false);
                setSelectedRoom(null);
                setRoomPassword("");
                setJoinRoomError("");
              }}
              className="absolute top-4 right-4 bg-gray-700 hover:bg-gray-600 p-1.5 rounded-full text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-2xl font-bold text-white mb-2">비공개 방</h2>
            <p className="text-gray-400 mb-4">이 방에 입장하려면 비밀번호를 입력하세요.</p>
            
            <div className="flex items-center gap-2 mb-6 bg-gray-900/40 rounded-lg p-3">
              <div className="text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">{selectedRoom.title}</div>
                <div className="text-xs text-gray-400">방장: {selectedRoom.ownerNickname}</div>
              </div>
            </div>
            
            {joinRoomError && (
              <div className="bg-red-900/30 text-red-400 p-3 rounded-lg mb-4 border border-red-800/30">
                {joinRoomError}
              </div>
            )}
            
            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label htmlFor="roomPassword" className="block text-sm font-medium text-gray-300 mb-1">비밀번호 (4자리)</label>
                <input 
                  type="password" 
                  id="roomPassword" 
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0000"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isJoiningRoom || roomPassword.length !== 4}
                className={`w-full ${
                  isJoiningRoom || roomPassword.length !== 4
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                } text-white py-3 rounded-lg font-medium transition-all`}
              >
                {isJoiningRoom ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    입장 중...
                  </div>
                ) : "입장하기"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 상점 모달 */}
      <ShopModal 
        isOpen={showShopModal} 
        onClose={toggleShopModal}
        currentPoints={userProfileCache[currentUser?.id || 0]?.point || 0}
        onAvatarPurchased={handleAvatarPurchased}
        userId={currentUser?.id}
      />
    </div>
  );
}

export default function LobbyPage() {
  // Modal 상태를 상위 컴포넌트로 끌어올림
  const [showCreateRoomModal, setShowCreateRoomModal] = useState<boolean>(false);
  
  // 모달이 열려있을 때는 beforeunload 경고 비활성화
  const shouldShowBeforeUnloadWarning = !showCreateRoomModal;
  
  return (
    <AppLayout showBeforeUnloadWarning={shouldShowBeforeUnloadWarning} showHomeButton={false} showHeader={false}>
      <Suspense
        fallback={
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        }
      >
        <LobbyContent 
          showCreateRoomModal={showCreateRoomModal}
          setShowCreateRoomModal={setShowCreateRoomModal}
        />
      </Suspense>
    </AppLayout>
  );
}

