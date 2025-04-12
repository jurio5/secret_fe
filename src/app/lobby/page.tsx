"use client";

import { useEffect, Suspense, useState } from "react";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { components } from "@/lib/backend/apiV1/schema";
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";
import Toast, { ToastProps } from "@/components/common/Toast";

interface User {
  id: number;
  email: string;
  nickname: string;
  sessions: string[];
  lastActive: number;
  status: string;
  avatarUrl?: string;
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
}

// 룸 정보 타입
type RoomResponse = {
  id?: number;
  title?: string;
  status?: string;
  ownerId?: number;
  ownerNickname?: string;
  currentParticipants?: number;
  maxParticipants?: number;
  createdAt?: string;
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

// 기본 아바타 URL
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

function LobbyContent() {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showNicknameModal, setShowNicknameModal] = useState<boolean>(false);
  const [newNickname, setNewNickname] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [toast, setToast] = useState<ToastProps | null>(null);

  // 세션 무효화 오류 확인 함수
  const checkSessionError = (error: any): boolean => {
    const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
    return errorStr.includes("Session was invalidated") || 
           errorStr.includes("HTTP Status 500 – Internal Server Error");
  };

  // 로그인 페이지로 리다이렉트 함수
  const redirectToLogin = async () => {
    try {
      // 백엔드에 로그아웃 요청 (세션 및 HTTP-Only 쿠키 삭제)
      await client.DELETE("/api/v1/members");
      console.log("로그아웃 API 호출 성공");
      
      // 백엔드 로그아웃 API가 처리하지 않는 클라이언트 측 쿠키 수동 삭제
      document.cookie = "needs_nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      document.cookie = "needs_nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
      
      // 로컬 스토리지 정리
      localStorage.clear();
    } catch (error) {
      console.error("로그아웃 API 호출 실패:", error);
      // 실패해도 계속 진행 - 수동으로 쿠키 삭제 시도
      document.cookie = "needs_nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      document.cookie = "needs_nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
      localStorage.clear();
    }
    
    // 토스트 메시지로 사용자에게 알림
    setToast({
      type: "error", 
      message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
      duration: 3000
    });
    
    // 3초 후 로그인 페이지로 리다이렉트
    setTimeout(() => {
      window.location.href = "/login";
    }, 3000);
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
    try {
      const response = await client.GET("/api/v1/members/me") as ApiResponse<User>;
      
      if (response.error) {
        console.error("사용자 정보를 가져오는데 실패했습니다:", response.error);
        
        // 세션 오류 확인
        if (checkSessionError(response.error)) {
          redirectToLogin();
          return;
        }
        
        return;
      }
      
      if (response.data?.data) {
        setCurrentUser(response.data.data);
        
        // REGISTER 상태인 경우 닉네임 모달 표시
        if (response.data.data.status === "REGISTER") {
          setShowNicknameModal(true);
        }
      }
    } catch (error) {
      console.error("사용자 정보를 가져오는데 실패했습니다:", error);
      
      // 세션 오류 확인
      if (checkSessionError(error)) {
        redirectToLogin();
      }
    }
  };

  // 닉네임 변경 함수
  const handleChangeNickname = async () => {
    if (!newNickname.trim()) {
      alert("닉네임을 입력해주세요.");
      return;
    }
    
    try {
      const response = await client.PATCH("/api/v1/members/{memberId}/nickname", {
        params: {
          path: { memberId: 0 } // 'me' 대신 0 사용 (API에서 현재 사용자를 의미)
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
      // 닉네임 모달 표시
      setShowNicknameModal(true);
    }
    
    loadRooms();
    fetchCurrentUser(); // 사용자 정보 가져오기

    // 로컬 스토리지에서 REGISTER 상태 확인
    const hasRegisterStatus = localStorage.getItem('quizzle_register_status') === 'true';
    
    // URL에 파라미터가 없지만 로컬 스토리지에 상태가 있는 경우 닉네임 모달 표시
    if (!isRegister && hasRegisterStatus) {
      setShowNicknameModal(true);
    }

    // 룸 업데이트 구독
    subscribe("/topic/lobby", (_) => {
      loadRooms();
    });

    // 로비 접속자 목록 구독
    subscribe("/topic/lobby/users", async (data: User[]) => {
      // 아바타 정보 추가
      const usersWithAvatars = await fetchUserAvatars(data);
      setActiveUsers(usersWithAvatars);
      setIsConnected(true);
    });

    // 접속자 목록 요청
    publish("/app/lobby/users", JSON.stringify({ action: "getUsers" }));

    return () => {
      unsubscribe("/topic/lobby");
      unsubscribe("/topic/lobby/users");
    };
  }, []);

  const handleUserClick = async (user: User) => {
    // 캐시에 사용자 정보가 있으면 사용
    if (userProfileCache[user.id]) {
      setSelectedUser({
        ...userProfileCache[user.id],
        loading: false
      });
      setShowProfileModal(true);
      return;
    }
    
    // 로딩 상태로 모달 표시
    setSelectedUser({
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR,
      level: 0,
      exp: 0,
      point: 0,
      loading: true
    });
    setShowProfileModal(true);

    try {
      // 실제 API를 통해 사용자 프로필 가져오기
      const response = await client.GET(`/api/v1/members/{memberId}`, {
        params: { path: { memberId: user.id } }
      }) as ApiResponse<UserProfile>;
      
      if (response.error || !response.data) {
        throw new Error(response.error?.message || "프로필 정보를 가져오는데 실패했습니다");
      }
      
      // 캐시에 저장
      userProfileCache[user.id] = response.data.data;
      
      setSelectedUser({
        ...response.data.data,
        loading: false
      });
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 토스트 메시지 표시 */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-grow">
          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-xl p-6 mb-8">
            <h1 className="text-3xl font-bold text-white mb-4">로비</h1>
            <p className="text-gray-300 mb-6">
              퀴즈 룸에 참여하거나 새 퀴즈 룸을 만들어 친구들과 경쟁하세요!
            </p>
            
            <div className="flex flex-wrap gap-4 mb-6">
              <button 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
                onClick={() => alert("퀴즈룸 생성 기능은 준비 중입니다.")}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.length > 0 ? (
                rooms.map((room) => (
                  <div 
                    key={room.id} 
                    className="bg-gray-700/60 border border-gray-600 rounded-xl p-4 hover:border-blue-500 transition-colors cursor-pointer"
                    onClick={() => alert(`방 ${room.id}로 입장하는 기능은 준비 중입니다.`)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-xs uppercase tracking-wider text-blue-400">
                        {room.status || "대기중"}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-xs text-gray-300">
                          {room.currentParticipants || 0}/{room.maxParticipants || 5}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-medium text-white mb-2">{room.title}</h3>
                    <div className="text-xs text-gray-400 mb-3">방장: {room.ownerNickname || "퀴즐"}</div>
                    <div className="text-xs text-gray-300">생성: {new Date(room.createdAt || Date.now()).toLocaleString()}</div>
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
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {activeUsers.length > 0 ? (
                activeUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/60 cursor-pointer transition-colors duration-200"
                    onClick={() => handleUserClick(user)}
                  >
                    <div className="w-8 h-8 rounded-full border border-gray-700 overflow-hidden">
                      {user.avatarUrl ? (
                        <img 
                          src={user.avatarUrl} 
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
                    <div>
                      <div className="text-sm text-white font-medium">{user.nickname}</div>
                      <div className="text-xs text-gray-400">{user.status}</div>
                    </div>
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

      {/* 닉네임 변경 모달 */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800/80 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-white mb-4">닉네임 설정</h3>
            <p className="text-gray-300 mb-4">
              퀴즐에 오신 것을 환영합니다! 서비스를 이용하기 위해 닉네임을 설정해주세요.
            </p>
            
            <div className="mb-4">
              <input
                type="text"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                placeholder="닉네임을 입력하세요"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                maxLength={10}
              />
              <p className="text-xs text-gray-400 mt-1">최대 10자까지 입력 가능합니다.</p>
            </div>
            
            <button
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium"
              onClick={handleChangeNickname}
            >
              닉네임 저장
            </button>
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
                  <div className="flex items-center text-blue-400 text-sm">
                    <span className="bg-blue-900/30 rounded-md px-2 py-0.5 border border-blue-800/50">
                      Lv. {selectedUser.level || 1}
                    </span>
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
    </div>
  );
}

export default function LobbyPage() {
  return (
    <AppLayout showBeforeUnloadWarning={true}>
      <Suspense
        fallback={
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        }
      >
        <LobbyContent />
      </Suspense>
    </AppLayout>
  );
}
