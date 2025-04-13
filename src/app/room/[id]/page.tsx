"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";
import { components } from "@/lib/backend/apiV1/schema";
import Image from "next/image";
import { FaChevronLeft, FaDoorOpen, FaCrown, FaCheck, FaComments, FaUsers, FaInfoCircle, FaPlay, FaBrain, FaList, FaQuestionCircle } from "react-icons/fa";

// 방 정보 타입
type RoomResponse = components["schemas"]["RoomResponse"] & {
  // 추가 필드
  questionCount?: number;
  problemCount?: number;
  mainCategory?: string;
  subCategory?: string;
};

// API 응답 타입
type ApiResponse<T> = {
  error?: {
    message?: string;
  };
  data?: {
    data: T;
  };
};

// 기본 아바타 URL
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

// 카테고리 한글 변환 함수
const translateCategory = (category?: string): string => {
  if (!category) return '';
  
  const categories: Record<string, string> = {
    'SCIENCE': '과학',
    'HISTORY': '역사',
    'LANGUAGE': '언어',
    'GENERAL_KNOWLEDGE': '일반 상식'
  };
  
  return categories[category] || category;
};

// 서브 카테고리 한글 변환 함수
const translateSubCategory = (subCategory?: string): string => {
  if (!subCategory) return '';
  
  const subCategories: Record<string, string> = {
    'PHYSICS': '물리학',
    'CHEMISTRY': '화학',
    'BIOLOGY': '생물학',
    'WORLD_HISTORY': '세계사',
    'KOREAN_HISTORY': '한국사',
    'KOREAN': '한국어',
    'ENGLISH': '영어',
    'CURRENT_AFFAIRS': '시사',
    'CULTURE': '문화',
    'SPORTS': '스포츠'
  };
  
  return subCategories[subCategory] || subCategory;
};

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'players' | 'chat'>('players');
  
  // 채팅 관련 상태
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState<string>("");
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 방 정보 불러오기
  const fetchRoomData = async () => {
    setLoading(true);
    try {
      const response = await (client.GET as any)(`/api/v1/rooms/${roomId}`, {}) as ApiResponse<RoomResponse>;
      
      if (response.error) {
        setError(response.error.message || "방 정보를 불러오는데 실패했습니다.");
        return;
      }
      
      if (response.data?.data) {
        console.log("방 정보 API 응답:", response.data.data); // 실제 API 응답 데이터 확인
        setRoom(response.data.data);
      } else {
        setError("방 정보를 불러오는데 실패했습니다.");
      }
    } catch (error) {
      console.error("방 정보를 불러오는데 실패했습니다:", error);
      setError("방 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 현재 사용자 정보 가져오기
  const fetchCurrentUser = async () => {
    try {
      const response = await client.GET("/api/v1/members/me", {}) as any;
      
      if (response.error) {
        console.error("사용자 정보를 가져오는데 실패했습니다:", response.error);
        return;
      }
      
      if (response.data?.data) {
        const userData = response.data.data;
        setCurrentUserId(userData.id);
        setCurrentUser(userData);
        
        // 방장 여부 확인
        if (room && room.ownerId === userData.id) {
          setIsOwner(true);
        }
      }
    } catch (error) {
      console.error("사용자 정보를 가져오는데 실패했습니다:", error);
    }
  };

  // 웹소켓 구독 설정
  const setupWebSocket = () => {
    // 방 정보 업데이트 구독
    subscribe(`/topic/rooms/${roomId}`, (data) => {
      console.log("방 정보 업데이트:", data);
      setRoom(data);
    });
    
    // 플레이어 목록 구독
    subscribe(`/topic/rooms/${roomId}/players`, (data) => {
      console.log("플레이어 목록 업데이트:", data);
      setPlayers(data);
      
      // 현재 사용자의 준비 상태 확인
      if (currentUserId) {
        const currentPlayer = data.find((player: any) => player.id === currentUserId);
        if (currentPlayer) {
          setIsReady(currentPlayer.isReady || false);
        }
      }
    });
    
    // 방 채팅 구독
    subscribe(`/topic/rooms/${roomId}/chat`, (message) => {
      // 채팅 메시지 처리
      setChatMessages((prevMessages) => {
        const newMessage = {
          ...message,
          avatarUrl: message.avatarUrl || DEFAULT_AVATAR,
          timestamp: message.timestamp || Date.now()
        };
        
        return [...prevMessages, newMessage];
      });
    });
    
    // 로비 사용자 목록 구독 추가
    subscribe("/topic/lobby/users", (data) => {
      // 방 페이지에서는 처리할 필요 없지만 구독은 유지
    });
    
    // 로비 상태 업데이트 구독 추가
    subscribe("/topic/lobby/status", (data) => {
      // 방 페이지에서는 처리할 필요 없지만 구독은 유지
    });
    
    // 시스템 초기 메시지
    setChatMessages([{
      type: "SYSTEM",
      content: `${roomId}번 방 채팅에 연결되었습니다.`,
      senderId: "system",
      senderName: "System",
      timestamp: Date.now(),
      roomId: roomId
    }]);
  };

  // 방 입장 처리
  const joinRoom = async () => {
    try {
      await (client.POST as any)(`/api/v1/rooms/${roomId}/join`, {});
      
      // 입장 성공 시 메시지를 방에 전송
      publish(`/app/rooms/${roomId}/join`, {
        roomId: parseInt(roomId)
      });
      
      // 로비에 사용자 상태 업데이트 전송
      publish(`/app/lobby/status`, {
        type: "STATUS_UPDATE",
        status: `게임방 ${roomId}번 입장`,
        location: "IN_ROOM",
        roomId: parseInt(roomId),
        timestamp: Date.now()
      });
      
      // 방 입장 시스템 메시지
      if (currentUser) {
        publish(`/app/rooms/${roomId}/chat`, {
          type: "SYSTEM",
          content: `${currentUser.nickname}님이 입장했습니다.`,
          timestamp: Date.now()
        });
      }
      
      console.log("방에 입장했습니다.");
    } catch (error) {
      console.error("방 입장에 실패했습니다:", error);
    }
  };

  // 채팅 메시지 전송 함수
  const handleSendChatMessage = () => {
    if (!newChatMessage.trim() || !currentUser) return;
    
    // 채팅 메시지 발행
    publish(`/app/rooms/${roomId}/chat`, {
      type: "CHAT",
      content: newChatMessage,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      timestamp: Date.now(),
      roomId: roomId
    });
    
    setNewChatMessage("");
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

  // 준비 상태 토글
  const toggleReady = async () => {
    try {
      // 이미 게임이 시작된 경우 또는 방이 대기 상태가 아닌 경우 처리하지 않음
      if (room?.status !== 'WAITING') {
        console.log("게임이 이미 시작되었거나 방이 대기 상태가 아닙니다.");
        return;
      }
      
      // 현재 준비 상태의 반대로 설정
      const newReadyState = !isReady;
      
      // API 호출 - 준비 상태 변경 (as any 타입 캐스팅 사용)
      await (client.PATCH as any)(`/api/v1/rooms/${roomId}/players/ready`, {
        body: { isReady: newReadyState }
      });
      
      // 메시지 발행 - 방 내 플레이어에게 알림
      publish(`/app/rooms/${roomId}/chat`, {
        type: "SYSTEM",
        content: `${currentUser?.nickname || '플레이어'}님이 ${newReadyState ? '준비 완료' : '준비 취소'}하였습니다.`,
        timestamp: Date.now()
      });
      
      // 로컬 상태 업데이트
      setIsReady(newReadyState);
      console.log(`준비 상태가 ${newReadyState ? '완료' : '취소'}되었습니다.`);
    } catch (error) {
      console.error("준비 상태 변경에 실패했습니다:", error);
      alert("준비 상태 변경에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 게임 시작
  const startGame = async () => {
    try {
      // 방장인지 확인
      if (!isOwner) {
        console.error("방장만 게임을 시작할 수 있습니다.");
        return;
      }
      
      // 플레이어 수 확인 (최소 2명 이상)
      if (players.length < 2) {
        alert("게임을 시작하려면 최소 2명의 플레이어가 필요합니다.");
        return;
      }
      
      // 모든 참가자가 준비 완료 상태인지 확인 (방장 제외)
      const allPlayersReady = players.every(player => 
        player.isOwner || player.isReady
      );
      
      if (!allPlayersReady) {
        alert("모든 플레이어가 준비를 완료해야 게임을 시작할 수 있습니다.");
        return;
      }
      
      // 게임이 이미 시작된 상태인지 확인
      if (room?.status !== 'WAITING') {
        console.log("게임이 이미 시작되었습니다.");
        return;
      }
      
      // API 호출 - 게임 시작 (as any 타입 캐스팅 사용)
      await (client.PATCH as any)(`/api/v1/rooms/${roomId}/start`, {});
      
      // 알림 메시지
      publish(`/app/rooms/${roomId}/chat`, {
        type: "SYSTEM",
        content: "게임이 시작되었습니다!",
        timestamp: Date.now()
      });
      
      console.log("게임이 시작되었습니다.");
    } catch (error) {
      console.error("게임 시작에 실패했습니다:", error);
      alert("게임 시작에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 방 퇴장
  const leaveRoom = async () => {
    try {
      // 퇴장 시스템 메시지
      if (currentUser) {
        publish(`/app/rooms/${roomId}/chat`, {
          type: "SYSTEM",
          content: `${currentUser.nickname}님이 퇴장했습니다.`,
          timestamp: Date.now()
        });
      }
      
      await (client.POST as any)(`/api/v1/rooms/${roomId}/leave`, {});
      
      // 퇴장 메시지 전송
      publish(`/app/rooms/${roomId}/leave`, {
        roomId: parseInt(roomId)
      });
      
      // 로비에 사용자 상태 업데이트 전송
      publish(`/app/lobby/status`, {
        type: "STATUS_UPDATE",
        status: "로비",
        location: "IN_LOBBY",
        roomId: null,
        timestamp: Date.now()
      });
      
      // 웹소켓 구독 해제
      unsubscribe(`/topic/rooms/${roomId}`);
      unsubscribe(`/topic/rooms/${roomId}/players`);
      unsubscribe(`/topic/rooms/${roomId}/chat`);
      unsubscribe("/topic/lobby/users");
      unsubscribe("/topic/lobby/status");
      
      // beforeunload 경고 없이 로비로 이동하기 위해 로컬 스토리지에 플래그 설정
      localStorage.setItem('intentional_navigation', 'true');
      
      // 로비로 리다이렉트
      window.location.href = "/lobby";
    } catch (error) {
      console.error("방 퇴장에 실패했습니다:", error);
    }
  };

  // 페이지 로드 시 방 페이지에 들어왔다는 플래그 설정
  useEffect(() => {
    // 방 페이지 로드 시 beforeunload 경고 비활성화 플래그 설정
    // URL로 직접 접근 시에도 작동하도록 함
    localStorage.setItem('intentional_navigation', 'true');
  }, []);

  useEffect(() => {
    // 방 정보 로드
    fetchRoomData();
    
    // 사용자 정보 로드
    fetchCurrentUser();
    
    // 웹소켓 구독 설정
    setupWebSocket();
    
    // 방 입장
    joinRoom();
    
    // 컴포넌트 언마운트 시 웹소켓 구독 해제 및 방 퇴장
    return () => {
      unsubscribe(`/topic/rooms/${roomId}`);
      unsubscribe(`/topic/rooms/${roomId}/players`);
      unsubscribe(`/topic/rooms/${roomId}/chat`);
      unsubscribe("/topic/lobby/users");
      unsubscribe("/topic/lobby/status");
    };
  }, [roomId]);
  
  // 현재 사용자 ID 또는 방 정보가 업데이트되면 방장 여부 확인
  useEffect(() => {
    if (currentUserId && room) {
      setIsOwner(room.ownerId === currentUserId);
    }
  }, [currentUserId, room]);
  
  // 새 메시지가 올 때마다 스크롤 이동
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (loading) {
    return (
      <AppLayout showBeforeUnloadWarning={false} showHeader={false}>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">방 정보를 불러오는 중...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout showBeforeUnloadWarning={false} showHeader={false}>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">오류 발생</div>
            <p className="text-gray-400">{error}</p>
            <button 
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              onClick={() => window.location.href = "/lobby"}
            >
              로비로 돌아가기
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showBeforeUnloadWarning={false} showHeader={false}>
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 py-6">
        <div className="max-w-[1400px] mx-auto px-4 py-4 h-[calc(100vh-2rem)] flex flex-col">
          {/* 상단 헤더 - 더 간소화하고 세련되게 */}
          <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5 mb-5">
            <div className="flex flex-wrap md:flex-nowrap justify-between items-center">
              <div className="flex items-center space-x-4 w-full md:w-auto mb-3 md:mb-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
                  {room?.title}
                  <span className="ml-3 px-2.5 py-1 text-xs bg-indigo-600/50 text-indigo-200 rounded-md">
                    #{roomId}
                  </span>
                </h1>
                <div className="text-sm text-gray-400 flex flex-wrap gap-x-5 mt-1">
                  <span className="flex items-center">
                    <FaCrown className="mr-1.5 text-yellow-500" />
                    {room?.ownerNickname}
                  </span>
                  <span className="flex items-center">
                    <FaUsers className="mr-1.5" />
                    {room?.currentPlayers}/{room?.capacity}명
                  </span>
                  <span className="flex items-center">
                    <FaInfoCircle className="mr-1.5" />
                    {room?.status === 'WAITING' ? '대기중' : '게임중'}
                  </span>
                </div>
              </div>
              <button
                className="px-4 py-2.5 bg-red-600/80 text-white rounded-xl hover:bg-red-700 transition flex items-center shadow-md"
                onClick={leaveRoom}
              >
                <FaDoorOpen className="mr-2" />
                나가기
              </button>
            </div>
          </div>
          
          {/* 방 상세 정보 */}
          <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-900/50 rounded-xl p-4 flex flex-col items-center transform hover:scale-105 transition-all hover:bg-gray-900/80 hover:shadow-xl">
                <div className="text-indigo-400 mb-1 flex items-center">
                  <FaBrain className="mr-1.5" />
                  난이도
                </div>
                <div className="text-lg font-medium text-white">
                  {(room?.difficulty === 'EASY' && '쉬움') || 
                   (room?.difficulty === 'NORMAL' && '보통') || 
                   (room?.difficulty === 'HARD' && '어려움') || 
                   '미정'}
                </div>
              </div>
              
              <div className="bg-gray-900/50 rounded-xl p-4 flex flex-col items-center transform hover:scale-105 transition-all hover:bg-gray-900/80 hover:shadow-xl">
                <div className="text-indigo-400 mb-1 flex items-center">
                  <FaList className="mr-1.5" />
                  카테고리
                </div>
                <div className="text-lg font-medium text-white">
                  {translateCategory(room?.mainCategory)}
                  {room?.mainCategory && room?.subCategory && ' > '}
                  {translateSubCategory(room?.subCategory)}
                  {!room?.mainCategory && !room?.subCategory && '일반'}
                </div>
              </div>
              
              <div className="bg-gray-900/50 rounded-xl p-4 flex flex-col items-center transform hover:scale-105 transition-all hover:bg-gray-900/80 hover:shadow-xl">
                <div className="text-indigo-400 mb-1 flex items-center">
                  <FaQuestionCircle className="mr-1.5" />
                  문제 수
                </div>
                <div className="text-lg font-medium text-white">
                  {(room?.questionCount || room?.problemCount || 10)}문제
                </div>
              </div>
            </div>
          </div>
          
          {/* 메인 콘텐츠 - 데스크톱에서는 좌우로 나누고, 모바일에서는 탭으로 구성 */}
          <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden">
            {/* 모바일 탭 메뉴 */}
            <div className="md:hidden flex rounded-xl overflow-hidden mb-3 bg-gray-800/40 border border-gray-700/50">
              <button
                onClick={() => setActiveTab('players')}
                className={`flex-1 py-3 px-4 text-sm font-medium flex justify-center items-center ${
                  activeTab === 'players'
                    ? 'bg-indigo-600/60 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
                }`}
              >
                <FaUsers className="mr-2" />
                참가자
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 px-4 text-sm font-medium flex justify-center items-center ${
                  activeTab === 'chat'
                    ? 'bg-indigo-600/60 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
                }`}
              >
                <FaComments className="mr-2" />
                채팅
              </button>
            </div>
            
            {/* 플레이어 목록 */}
            <div className={`md:w-1/3 bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5 overflow-hidden flex flex-col ${
              activeTab !== 'players' && 'hidden md:flex'
            }`}>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <FaUsers className="mr-2.5 text-indigo-400" />
                참가자 목록
                <span className="ml-2.5 px-2 py-0.5 bg-indigo-900/60 text-indigo-300 text-xs rounded-full">
                  {players.length}명
                </span>
              </h2>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {players.map((player) => (
                  <div 
                    key={player.id} 
                    className={`p-4 rounded-xl transition-all hover:shadow-lg ${
                      player.isOwner 
                        ? 'bg-gradient-to-r from-amber-900/40 to-amber-800/30 border border-amber-700/30 hover:from-amber-900/50 hover:to-amber-800/40' 
                        : player.isReady 
                          ? 'bg-gradient-to-r from-green-900/40 to-green-800/30 border border-green-700/30 hover:from-green-900/50 hover:to-green-800/40' 
                          : 'bg-gradient-to-r from-gray-800/60 to-gray-800/40 border border-gray-700/30 hover:from-gray-700/60 hover:to-gray-700/40'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 border-2 border-gray-600/50 shadow-md">
                        {player.avatarUrl ? (
                          <Image
                            src={player.avatarUrl}
                            alt={player.nickname}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-medium bg-gradient-to-br from-blue-500 to-indigo-600">
                            {player.nickname.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        {/* 상태 아이콘 */}
                        {player.isOwner ? (
                          <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-yellow-900 rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-800 shadow-lg">
                            <FaCrown className="w-3 h-3" />
                          </div>
                        ) : player.isReady ? (
                          <div className="absolute -bottom-1 -right-1 bg-green-500 text-green-900 rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-800 shadow-lg">
                            <FaCheck className="w-3 h-3" />
                          </div>
                        ) : null}
                      </div>
                      
                      <div className="ml-4 flex-1">
                        <div className="flex flex-col sm:flex-row sm:justify-between">
                          <p className="text-white font-medium text-lg">{player.nickname}</p>
                          {/* 현재 사용자 표시 */}
                          {currentUserId === player.id && (
                            <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded-md inline-block mt-1 sm:mt-0">나</span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mt-1 flex items-center">
                          {player.isOwner 
                            ? <><FaCrown className="text-yellow-500 mr-1.5" /> 방장</> 
                            : player.isReady 
                              ? <><FaCheck className="text-green-500 mr-1.5" /> 준비 완료</> 
                              : <span className="flex items-center">
                                  <span className="relative flex h-2 w-2 mr-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                  </span>
                                  준비 중
                                </span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 채팅 영역 */}
            <div className={`md:flex-1 bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5 flex flex-col ${
              activeTab !== 'chat' && 'hidden md:flex'
            }`}>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <FaComments className="mr-2.5 text-indigo-400" />
                방 채팅
              </h2>
              
              {/* 채팅 메시지 영역 */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto pr-1 custom-scrollbar bg-gray-900/30 rounded-xl p-4 mb-4"
              >
                <div className="space-y-3">
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
                        <div className="bg-gray-800/70 text-gray-300 text-xs py-1.5 px-4 rounded-full">
                          {msg.content}
                        </div>
                      ) : (
                        <>
                          {/* 시간 표시 */}
                          <div className="flex-shrink-0 text-xs text-gray-500 mr-2 mt-1 w-10">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          
                          {/* 발신자 아바타 */}
                          <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 mr-2.5">
                            {msg.avatarUrl ? (
                              <Image
                                src={msg.avatarUrl}
                                alt={msg.senderName || "사용자"}
                                fill
                                sizes="36px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white font-medium bg-gradient-to-br from-blue-500 to-indigo-600">
                                {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : "?"}
                              </div>
                            )}
                          </div>
                          
                          {/* 메시지 내용 */}
                          <div className="flex-1">
                            <div className="flex items-baseline">
                              <span className="font-medium text-sm text-white mr-2">
                                {msg.senderName}
                              </span>
                              {currentUserId === parseInt(msg.senderId) && (
                                <span className="px-1.5 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded">나</span>
                              )}
                            </div>
                            <div className="text-gray-300 bg-gray-800/60 rounded-lg py-2 px-3 mt-1 break-words">
                              {msg.content}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 채팅 입력창 */}
              <div className="flex">
                <input
                  type="text"
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  placeholder="메시지 입력..."
                  className="flex-1 bg-gray-900/70 text-white px-4 py-3 rounded-l-xl border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendChatMessage}
                  disabled={!newChatMessage.trim()}
                  className={`px-4 rounded-r-xl flex items-center justify-center ${
                    newChatMessage.trim()
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  } transition-colors`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* 하단 액션 버튼 영역 */}
          <div className="mt-5 bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5">
            <div className="flex justify-center space-x-4">
              {isOwner ? (
                <button
                  onClick={startGame}
                  disabled={players.length < 2 || !players.every(p => p.isOwner || p.isReady)}
                  className={`px-8 py-4 rounded-xl font-bold flex items-center justify-center min-w-[160px] transition-all transform hover:scale-105 shadow-lg ${
                    players.length < 2 || !players.every(p => p.isOwner || p.isReady)
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-700/30'
                  }`}
                >
                  <FaPlay className="mr-2" />
                  게임 시작하기
                </button>
              ) : (
                <button
                  onClick={toggleReady}
                  className={`px-8 py-4 rounded-xl font-bold flex items-center justify-center min-w-[160px] transition-all transform hover:scale-105 shadow-lg ${
                    isReady
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-red-700/30'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-blue-700/30'
                  }`}
                >
                  {isReady ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      준비 취소
                    </>
                  ) : (
                    <>
                      <FaCheck className="mr-2" />
                      준비하기
                    </>
                  )}
                </button>
              )}
            </div>
            
            {/* 게임 시작 조건 안내 메시지 */}
            {isOwner && (
              <div className="mt-4 text-center text-sm text-gray-400">
                {players.length < 2 ? (
                  "게임을 시작하려면 최소 2명의 플레이어가 필요합니다."
                ) : !players.every(p => p.isOwner || p.isReady) ? (
                  "모든 플레이어가 준비 완료해야 게임을 시작할 수 있습니다."
                ) : (
                  "모든 준비가 완료되었습니다. 게임을 시작할 수 있습니다!"
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 