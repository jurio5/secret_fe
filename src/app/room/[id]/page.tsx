"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { components } from "@/lib/backend/apiV1/schema";
import { subscribe, unsubscribe, publish, reconnectWebSocket } from "@/lib/backend/stompClient";
import Toast, { ToastProps } from "@/components/common/Toast";
import { FaCrown, FaUsers, FaDoorOpen, FaInfoCircle, FaComments, FaCheckCircle } from "react-icons/fa";

// 컴포넌트 임포트
import PlayerList from "@/components/room/PlayerList";
import RoomChat from "@/components/room/RoomChat";
import RoomHeader from "@/components/room/RoomHeader";

// 타입 임포트
import { RoomResponse, PlayerProfile } from "@/lib/types/room";

// 기본 아바타 URL
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

// API 응답 타입
type ApiResponse<T> = {
  error?: {
    message?: string;
  };
  data?: {
    data: T;
  };
};

// 유저 정보 타입
interface User {
  id: number;
  email: string;
  nickname: string;
  avatarUrl?: string;
  status: string;
}

// 채팅 메시지 타입
interface ChatMessage {
  id?: string;
  type: "CHAT" | "SYSTEM";
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  avatarUrl?: string;
}

function RoomContent() {
  const params = useParams();
  const roomId = params.id as string;
  const router = useRouter();
  
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastProps | null>(null);
  
  // 채팅 관련 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  
  // 채팅 메시지 상태 업데이트 함수
  const updateChatMessages = (newMessage: ChatMessage) => {
    // 중복 메시지 검사 (ref로 저장된 최신 메시지 기준)
    const isDuplicate = chatMessagesRef.current.some(existingMsg => 
      existingMsg.timestamp === newMessage.timestamp && 
      existingMsg.content === newMessage.content &&
      existingMsg.senderId === newMessage.senderId
    );
    
    // 중복 메시지면 무시
    if (isDuplicate) {
      console.log("중복 메시지 무시:", newMessage);
      return;
    }
    
    // 메시지에 고유 ID 추가
    const messageWithId: ChatMessage = {
      ...newMessage,
      id: newMessage.id || `${newMessage.senderId}-${newMessage.timestamp}-${Math.random().toString(36).substr(2, 5)}`,
      avatarUrl: newMessage.avatarUrl || DEFAULT_AVATAR
    };
    
    console.log("새 메시지 추가:", messageWithId);
    
    // 상태와 ref 모두 업데이트
    setChatMessages(prev => {
      const updated = [...prev, messageWithId];
      chatMessagesRef.current = updated; // ref도 함께 업데이트
      return updated;
    });
  };
  
  // 방 정보 가져오기
  const fetchRoomData = async () => {
    try {
      const response = await client.GET(`/api/v1/rooms/{roomId}`, {
        params: { path: { roomId: parseInt(roomId) } }
      }) as ApiResponse<RoomResponse>;
      
      if (response.error) {
        setError(response.error.message || "방 정보를 불러오는데 실패했습니다.");
        return null;
      }
      
      if (response.data?.data) {
        console.log("방 정보:", response.data.data);
        const roomData = response.data.data;
        setRoom(roomData);
        return roomData;
      }
      
      setError("방 정보를 불러오는데 실패했습니다.");
      return null;
    } catch (error) {
      console.error("방 정보를 불러오는데 실패했습니다:", error);
      setError("방 정보를 불러오는데 실패했습니다.");
      return null;
    }
  };
  
  // 현재 사용자 정보 가져오기
  const fetchCurrentUser = async () => {
    try {
      const response = await client.GET("/api/v1/members/me") as ApiResponse<User>;
      
      if (response.error) {
        console.error("사용자 정보를 가져오는데 실패했습니다:", response.error);
        return null;
      }
      
      if (response.data?.data) {
        const userData = response.data.data;
        setCurrentUser(userData);
        
        // 방장 여부 확인
        if (room && room.ownerId === userData.id) {
          setIsOwner(true);
        }
        
        return userData;
      }
      
      return null;
    } catch (error) {
      console.error("사용자 정보를 가져오는데 실패했습니다:", error);
      return null;
    }
  };
  
  // 플레이어 목록에서 자신의 준비 상태 확인
  const checkReadyStatus = () => {
    if (!currentUser || !room?.readyPlayers) return;
    
    const isUserReady = room.readyPlayers.includes(currentUser.id);
    setIsReady(isUserReady);
  };
  
  // 웹소켓 구독 설정
  const setupWebSocket = () => {
    // 방 정보 업데이트 구독
    subscribe(`/topic/room/${roomId}`, (data) => {
      console.log("방 정보 업데이트:", data);
      
      // 메시지 타입이 있는 경우 처리
      if (data && data.type) {
        // 방 정보 업데이트
        if (data.type === 'ROOM_UPDATED' || data.type === 'JOIN' || data.type === 'LEAVE') {
          setRoom(prev => {
            if (!prev) return data;
            return { ...prev, ...data };
          });
          
          // 플레이어 정보가 포함된 경우 처리
          if (data.players) {
            setPlayers(data.players);
            
            // 방장 여부 확인
            if (currentUser && data.ownerId === currentUser.id) {
              setIsOwner(true);
            } else {
              setIsOwner(false);
            }
            
            // 준비 상태 확인
            checkReadyStatus();
          }
        }
      } else if (data && typeof data === 'object') {
        // 단순 객체인 경우 (방 정보만 담긴 형태)
        setRoom(prev => {
          if (!prev) return data;
          return { ...prev, ...data };
        });
      }
    });
    
    // 플레이어 목록 구독
    subscribe(`/topic/room/${roomId}/players`, (data) => {
      console.log("플레이어 목록 업데이트:", data);
      
      if (Array.isArray(data)) {
        // 플레이어 목록 처리
        const formattedPlayers = data.map(player => ({
          id: player.id.toString(),
          nickname: player.nickname,
          avatarUrl: player.avatarUrl || DEFAULT_AVATAR,
          isOwner: player.id === room?.ownerId,
          isReady: room?.readyPlayers?.includes(player.id) || false
        }));
        
        setPlayers(formattedPlayers);
      }
    });
    
    // 방 상태 구독
    subscribe(`/topic/room/${roomId}/status`, (message) => {
      try {
        console.log("방 상태 업데이트:", message);
        
        // 메시지가 없거나 유효하지 않은 경우 처리
        if (!message) return;
        
        let status;
        
        // 메시지 형식에 따른 처리
        if (typeof message === 'object') {
          // 이미 파싱된 객체인 경우
          status = message;
        } else {
          // 문자열인 경우 파싱 시도
          try {
            status = JSON.parse(message);
          } catch (error) {
            console.error("JSON 파싱 오류:", error);
            return;
          }
        }
        
        // 방 정보 업데이트
        if (status.room) {
          setRoom(prevRoom => {
            if (!prevRoom) return status.room;
            return { ...prevRoom, ...status.room };
          });
          
          // 방장 변경 시 isOwner 상태 업데이트
          if (status.room.ownerId && currentUser) {
            const isCurrentUserOwner = status.room.ownerId === currentUser.id;
            setIsOwner(isCurrentUserOwner);
          }
        }
        
        // 플레이어 목록 업데이트
        if (status.players && Array.isArray(status.players)) {
          setPlayers(status.players);
          
          // 자신의 준비 상태 확인
          if (currentUser) {
            const playerInfo = status.players.find((p: any) => p.id === currentUser.id.toString());
            if (playerInfo) {
              setIsReady(playerInfo.isReady);
            }
          }
        }
        
        // 게임 상태 변경 처리 (예: 게임 시작 시 게임 페이지로 이동)
        if (status.room?.status === 'IN_GAME') {
          // 게임 시작 시 게임 페이지로 이동하는 로직 추가
          setToast({
            type: "info",
            message: "게임이 시작되었습니다!",
            duration: 2000
          });
          
          // 게임 시작 상태 유지 (게임 로직을 여기에 추가하거나 다른 페이지로 이동)
        }
      } catch (error) {
        console.error("방 상태 처리 오류:", error);
      }
    });
    
    // 채팅 메시지 구독
    subscribe(`/topic/room/chat/${roomId}`, (message) => {
      console.log("채팅 메시지 수신:", message);
      console.log("채팅 메시지 타입:", typeof message);
      console.log("채팅 메시지 JSON:", JSON.stringify(message, null, 2));
      console.log("현재 메시지 목록 길이:", chatMessagesRef.current.length);
      
      try {
        // 메시지 처리 및 추가
        updateChatMessages(message);
      } catch (error) {
        console.error("채팅 메시지 처리 중 오류:", error);
      }
    });
    
    setIsConnected(true);
  };
  
  // 방 입장 처리
  const joinRoom = async () => {
    if (!currentUser) return;
    
    try {
      // 방 입장 API 호출
      await client.POST(`/api/v1/rooms/{roomId}/join`, {
        params: { path: { roomId: parseInt(roomId) } }
      });
      
      // 입장 메시지 발행
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: `${currentUser.nickname}님이 입장했습니다.`,
        senderId: "system",
        senderName: "System",
        timestamp: Date.now()
      });
      
      // 입장 시스템 메시지
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: `${currentUser.nickname}님이 입장했습니다.`,
        senderId: "system",
        senderName: "System",
        timestamp: Date.now()
      });
      
      // 로비에 사용자 상태 업데이트 전송
      publish(`/app/lobby/status`, {
        type: "STATUS_UPDATE",
        status: `게임방 ${roomId}번 입장`,
        location: "IN_ROOM",
        roomId: parseInt(roomId),
        timestamp: Date.now()
      });
      
      // 성공 메시지
      setToast({
        type: "success",
        message: "방에 입장했습니다!",
        duration: 2000
      });
    } catch (error) {
      console.error("방 입장에 실패했습니다:", error);
      setToast({
        type: "error",
        message: "방 입장에 실패했습니다.",
        duration: 3000
      });
    }
  };
  
  // 방 퇴장 처리
  const leaveRoom = async () => {
    try {
      // 방 퇴장 API 호출
      await client.POST(`/api/v1/rooms/{roomId}/leave`, {
        params: { path: { roomId: parseInt(roomId) } }
      });
      
      // 퇴장 메시지 발행
      if (currentUser) {
        publish(`/app/room/chat/${roomId}`, {
          type: "SYSTEM",
          content: `${currentUser.nickname}님이 퇴장했습니다.`,
          senderId: "system",
          senderName: "System",
          timestamp: Date.now()
        });
      }
      
      // 로비에 사용자 상태 업데이트 전송
      publish(`/app/lobby/status`, {
        type: "STATUS_UPDATE",
        status: "로비",
        location: "IN_LOBBY",
        roomId: null,
        timestamp: Date.now()
      });
      
      // 웹소켓 구독 해제
      unsubscribe(`/topic/room/${roomId}`);
      unsubscribe(`/topic/room/${roomId}/players`);
      unsubscribe(`/topic/room/${roomId}/status`);
      unsubscribe(`/topic/room/chat/${roomId}`);
      
      // 로비로 이동
      localStorage.setItem('intentional_navigation', 'true');
      router.push('/lobby');
    } catch (error) {
      console.error("방 퇴장에 실패했습니다:", error);
      setToast({
        type: "error",
        message: "방 퇴장에 실패했습니다.",
        duration: 3000
      });
    }
  };
  
  // 준비 상태 토글
  const toggleReady = async () => {
    try {
      // 게임이 이미 시작된 경우 처리하지 않음
      if (room?.status !== 'WAITING' || isOwner) return;
      
      // 준비 상태 토글
      const newReadyState = !isReady;
      
      // 준비 상태 변경 API 호출
      await client.POST(`/api/v1/rooms/{roomId}/ready`, {
        params: { path: { roomId: parseInt(roomId) } }
      });
      
      // 메시지 발행
      if (currentUser) {
        publish(`/app/room/chat/${roomId}`, {
          type: "SYSTEM",
          content: `${currentUser.nickname}님이 ${newReadyState ? '준비 완료' : '준비 취소'}하였습니다.`,
          senderId: "system",
          senderName: "System",
          timestamp: Date.now()
        });
      }
      
      // 로컬 상태 업데이트
      setIsReady(newReadyState);
      
      // 플레이어 목록 업데이트
      setPlayers(prev => {
        const updated = prev.map(player => {
          if (currentUser && player.id === currentUser.id.toString()) {
            return { ...player, isReady: newReadyState };
          }
          return player;
        });
        
        // 상태 업데이트 브로드캐스트
        publish(`/app/room/${roomId}/status`, {
          players: updated,
          timestamp: Date.now()
        });
        
        return updated;
      });
    } catch (error) {
      console.error("준비 상태 변경에 실패했습니다:", error);
      setToast({
        type: "error",
        message: "준비 상태 변경에 실패했습니다.",
        duration: 3000
      });
    }
  };
  
  // 게임 시작
  const startGame = async () => {
    // 방장이 아니거나 게임이 이미 시작된 경우 처리하지 않음
    if (!isOwner || room?.status !== 'WAITING') {
      setToast({
        type: "error",
        message: "게임을 시작할 수 없습니다.",
        duration: 3000
      });
      return;
    }
    
    // 모든 플레이어가 준비 완료인지 확인
    const allPlayersReady = players.every(player => player.isOwner || player.isReady);
    
    if (!allPlayersReady) {
      setToast({
        type: "warning",
        message: "모든 플레이어가 준비를 완료해야 합니다.",
        duration: 3000
      });
      return;
    }
    
    try {
      // 게임 시작 API 호출
      await client.POST(`/api/v1/rooms/{roomId}/start`, {
        params: { path: { roomId: parseInt(roomId) } }
      });
      
      // 게임 시작 메시지 발행
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: "게임이 시작되었습니다!",
        senderId: "system",
        senderName: "System",
        timestamp: Date.now()
      });
      
      // 게임 상태 업데이트
      publish(`/app/room/${roomId}/status`, {
        room: { ...room, status: 'IN_GAME' },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("게임 시작에 실패했습니다:", error);
      setToast({
        type: "error",
        message: "게임 시작에 실패했습니다.",
        duration: 3000
      });
    }
  };
  
  // 채팅 메시지 전송
  const sendChatMessage = (message: string) => {
    if (!message.trim() || !currentUser) return;
    
    // 메시지 객체 생성
    const chatMessage = {
      type: "CHAT" as const,
      content: message,
      senderId: currentUser.id.toString(),
      senderName: currentUser.nickname,
      timestamp: Date.now()
    };
    
    // 서버로 채팅 메시지 발행
    publish(`/app/room/chat/${roomId}`, chatMessage);
    
    // 메시지를 바로 화면에 표시 (옵티미스틱 업데이트)
    updateChatMessages({
      ...chatMessage,
      avatarUrl: currentUser.avatarUrl || DEFAULT_AVATAR
    });
  };
  
  // 페이지 초기화
  useEffect(() => {
    // 데이터 로딩
    const initData = async () => {
      setLoading(true);
      
      try {
        // 방 정보 가져오기
        const roomData = await fetchRoomData();
        
        // 사용자 정보 가져오기
        const userData = await fetchCurrentUser();
        
        // 웹소켓 구독 설정
        setupWebSocket();
        
        // 방 입장 처리
        if (userData && roomData) {
          await joinRoom();
          
          // 방장 여부 확인
          setIsOwner(roomData.ownerId === userData.id);
          
          // 초기 시스템 메시지 추가 - 환영 메시지
          const initialMessage = {
            id: `system-${Date.now()}-welcome`,
            type: "SYSTEM" as const,
            content: "채팅방에 입장했습니다. 환영합니다!",
            senderId: "system",
            senderName: "System",
            timestamp: Date.now(),
            avatarUrl: DEFAULT_AVATAR
          };
          
          console.log("초기 채팅 메시지 추가:", initialMessage);
          setChatMessages([initialMessage]);
          chatMessagesRef.current = [initialMessage]; // ref도 함께 초기화
          
          // 플레이어 목록 초기화 - 자신을 포함한 목록 생성
          if (roomData.players && roomData.players.length > 0) {
            console.log("초기 플레이어 목록:", roomData.players);
            
            // 기본 처리: 플레이어 ID가 있는 경우, 자신을 추가
            if (userData) {
              setPlayers([{
                id: userData.id.toString(),
                nickname: userData.nickname,
                avatarUrl: userData.avatarUrl || DEFAULT_AVATAR,
                isOwner: roomData.ownerId === userData.id,
                isReady: false
              }]);
              
              console.log("초기 플레이어 설정 - 자신만:", userData);
            }
          } else if (userData) {
            // 방에 자신만 있는 경우
            setPlayers([{
              id: userData.id.toString(),
              nickname: userData.nickname, 
              avatarUrl: userData.avatarUrl || DEFAULT_AVATAR,
              isOwner: roomData.ownerId === userData.id,
              isReady: false
            }]);
            
            console.log("초기 플레이어 설정 - 자신만:", userData);
          }
        }
      } catch (error) {
        console.error("초기화 중 오류 발생:", error);
        setError("방 정보를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };
    
    initData();
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      // 웹소켓 구독 해제
      unsubscribe(`/topic/room/${roomId}`);
      unsubscribe(`/topic/room/${roomId}/players`);
      unsubscribe(`/topic/room/${roomId}/status`);
      unsubscribe(`/topic/room/chat/${roomId}`);
    };
  }, [roomId]);
  
  // 앱 종료 전 경고 메시지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const message = "정말로 페이지를 나가시겠습니까? 진행 중인 내용이 손실될 수 있습니다.";
      e.returnValue = message;
      return message;
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  // 로딩 중 표시
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="animate-spin mb-4">
          <svg className="w-12 h-12 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-xl font-medium">방 정보를 불러오는 중입니다...</p>
      </div>
    );
  }
  
  // 오류 발생 시
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-6 max-w-md">
          <h1 className="text-xl font-bold mb-4">오류가 발생했습니다</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button 
            onClick={() => router.push('/lobby')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded transition-colors"
          >
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-4 h-[calc(100vh-2rem)] flex flex-col">
      {/* 토스트 메시지 표시 */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* 방 헤더 */}
      <RoomHeader 
        room={room}
        roomId={roomId}
        onLeave={leaveRoom}
      />
      
      {/* 메인 컨텐츠 - 플레이어 목록과 채팅창 */}
      <div className="flex flex-col md:flex-row gap-5 flex-grow overflow-hidden">
        {/* 왼쪽 영역 - 플레이어 목록 */}
        <div className="w-full md:w-1/3 flex flex-col gap-5">
          {/* 플레이어 목록 컴포넌트 */}
          <PlayerList 
            players={players}
            currentUserId={currentUser?.id || null}
          />
          
          {/* 게임 조작 영역 */}
          <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5">
            <h2 className="text-xl font-semibold text-white mb-4">게임 조작</h2>
            
            {isOwner ? (
              <button
                className={`w-full py-3 rounded-xl font-medium text-white ${
                  room?.status !== 'WAITING' || players.some(p => !p.isOwner && !p.isReady)
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                }`}
                onClick={startGame}
                disabled={room?.status !== 'WAITING' || players.some(p => !p.isOwner && !p.isReady)}
              >
                게임 시작
              </button>
            ) : (
              <button
                className={`w-full py-3 rounded-xl font-medium text-white ${
                  room?.status !== 'WAITING'
                    ? 'bg-gray-700 cursor-not-allowed'
                    : isReady
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                }`}
                onClick={toggleReady}
                disabled={room?.status !== 'WAITING'}
              >
                {isReady ? '준비 취소' : '준비 완료'}
              </button>
            )}
            
            {room?.status === 'WAITING' && (
              <div className="mt-3 text-center text-sm text-gray-400">
                {isOwner 
                  ? '모든 플레이어가 준비를 완료하면 게임을 시작할 수 있습니다.'
                  : '게임에 참여하려면 준비 버튼을 클릭하세요.'}
              </div>
            )}
          </div>
        </div>
        
        {/* 오른쪽 영역 - 채팅창 */}
        <div className="w-full md:w-2/3 flex-grow">
          <RoomChat 
            messages={chatMessages}
            currentUserId={currentUser?.id || null}
            onSendMessage={sendChatMessage}
            key={`chat-${roomId}-${chatMessages.length}`}
          />
        </div>
      </div>
    </div>
  );
}

export default function RoomPage() {
  return (
    <AppLayout showBeforeUnloadWarning={true} showHeader={false}>
      <RoomContent />
    </AppLayout>
  );
}
