"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { components } from "@/lib/backend/apiV1/schema";
import { subscribe, unsubscribe, publish, reconnectWebSocket, isConnected as isWebSocketConnected } from "@/lib/backend/stompClient";
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
  
  // 웹소켓 구독 ID 저장용 Ref
  const subscriptions = useRef<string[]>([]);
  
  // 모든 구독 해제 함수
  const unsubscribeAll = useCallback(() => {
    console.log("모든 웹소켓 구독 해제");
    subscriptions.current.forEach(subId => unsubscribe(subId));
    subscriptions.current = [];
  }, []);
  
  // 플레이어 목록이 변경될 때 방 정보의 currentPlayers 자동 업데이트
  useEffect(() => {
    if (room && players.length !== room.currentPlayers) {
      console.log("플레이어 수 동기화:", { 
        before: room.currentPlayers, 
        after: players.length 
      });
      
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentPlayers: players.length
        };
      });
    }
  }, [players, room]);
  
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
  const setupWebSocket = useCallback(() => {
    console.log("웹소켓 설정 시작...");
    
    // 기존 구독 해제 (중복 방지)
    unsubscribeAll();
    
    // 연결이 끊어진 경우 재연결 시도
    if (!isWebSocketConnected()) {
      reconnectWebSocket();
    }
    
    // 방 정보 업데이트 구독
    subscribe(`/topic/room/${roomId}`, (data) => {
      console.log("방 정보 업데이트:", data);
      
      // 메시지 타입이 있는 경우 처리
      if (data && data.type) {
        // 방 정보 업데이트
        if (data.type === 'ROOM_UPDATED' || data.type === 'JOIN' || data.type === 'LEAVE') {
          console.log(`${data.type} 이벤트 발생:`, data);
          
          // JOIN/LEAVE 이벤트 발생 시 강제로 방 정보 갱신 API 호출
          if (data.type === 'JOIN' || data.type === 'LEAVE') {
            // 약간의 지연 후 API로 방 정보 갱신 (서버 처리 시간 고려)
            setTimeout(async () => {
              try {
                const response = await client.GET(`/api/v1/rooms/{roomId}`, {
                  params: { path: { roomId: parseInt(roomId) } }
                }) as ApiResponse<RoomResponse>;
                
                if (response.data?.data) {
                  const roomData = response.data.data;
                  console.log(`${data.type} 이후 방 정보 갱신:`, roomData);
                  
                  // 방 정보 업데이트
                  setRoom(prevRoom => {
                    if (!prevRoom) return roomData;
                    return {
                      ...prevRoom,
                      ...roomData,
                      // 플레이어 목록 길이 기반으로 currentPlayers 강제 설정
                      currentPlayers: roomData.players?.length || 0
                    };
                  });
                }
              } catch (error) {
                console.error("방 정보 갱신 실패:", error);
              }
            }, 300);
          }
          
          setRoom(prev => {
            if (!prev) return data;
            return { ...prev, ...data };
          });
          
          // 데이터 필드에서 플레이어 정보 추출
          if (data.data) {
            try {
              console.log("data 필드 원본:", data.data);
              
              // 문자열인 경우 JSON으로 파싱
              let playersData;
              if (typeof data.data === 'string') {
                try {
                  playersData = JSON.parse(data.data);
                  console.log("JSON 파싱 후 플레이어 데이터:", playersData);
                } catch (parseError) {
                  console.error("플레이어 데이터 JSON 파싱 실패:", parseError);
                  return;
                }
              } else if (Array.isArray(data.data)) {
                playersData = data.data;
                console.log("배열 형태의 플레이어 데이터:", playersData);
              } else {
                console.log("알 수 없는 데이터 형식:", typeof data.data);
                return;
              }
              
              // 플레이어 데이터가 유효한지 확인
              if (!Array.isArray(playersData)) {
                console.warn("플레이어 데이터가 배열이 아닙니다:", playersData);
                return;
              }
              
              // 플레이어 데이터 형식 통일화
              const formattedPlayers = playersData.map((player: any) => {
                // ID가 숫자면 문자열로 변환
                const id = typeof player.id === 'number' ? String(player.id) : player.id;
                
                return {
                  id,
                  nickname: player.nickname || player.name || '사용자',
                  avatarUrl: player.avatarUrl || DEFAULT_AVATAR,
                  isOwner: Boolean(player.isOwner || player.id === room?.ownerId),
                  isReady: Boolean(player.isReady || room?.readyPlayers?.includes(player.id))
                };
              });
              
              console.log("포맷된 플레이어 목록:", formattedPlayers);
              setPlayers(formattedPlayers);
              
              // Room 객체의 currentPlayers 값과 players 목록 업데이트
              setRoom(prev => {
                if (!prev) return prev;
                
                // 플레이어 ID 목록 생성
                const playerIds = formattedPlayers.map(p => 
                  typeof p.id === 'string' ? parseInt(p.id) : p.id
                );
                
                return {
                  ...prev,
                  currentPlayers: formattedPlayers.length, // 실제 플레이어 수로 업데이트
                  players: playerIds // 플레이어 ID 목록 업데이트
                };
              });
            } catch (error) {
              console.error("플레이어 데이터 처리 중 오류:", error);
            }
          }
          
          // 방장 여부 확인
          if (currentUser && data.ownerId === currentUser.id) {
            setIsOwner(true);
          } else {
            setIsOwner(false);
          }
            
          // 준비 상태 확인
          checkReadyStatus();
        }
      } else if (data && typeof data === 'object') {
        // 단순 객체인 경우 (방 정보만 담긴 형태)
        setRoom(prev => {
          if (!prev) return data;
          return { ...prev, ...data };
        });
      }
    });
    
    // 방 상태 구독
    subscribe(`/topic/room/${roomId}/status`, (message) => {
      try {
        console.log("방 상태 업데이트 수신:", message);
        
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
        
        // 디버깅을 위한 상세 로그
        console.log("파싱된 상태 데이터:", status);
        
        // 방 정보 업데이트
        if (status.room) {
          console.log("방 정보 업데이트:", status.room);
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
          console.log("플레이어 목록 업데이트 전:", players);
          console.log("받은 플레이어 목록:", status.players);
          
          // 플레이어 데이터 구조 확인 및 표준화
          const formattedPlayers = status.players.map((player: any) => {
            // 기본 필드 확인 및 기본값 설정
            const id = String(player.id || '');
            const nickname = player.nickname || player.name || '알 수 없음';
            const avatarUrl = player.avatarUrl || DEFAULT_AVATAR;
            const isPlayerOwner = room ? String(room.ownerId) === id : false;
            const isPlayerReady = Boolean(player.isReady);
            
            console.log(`플레이어 정보 처리: id=${id}, nickname=${nickname}, isReady=${isPlayerReady}`);
            
            return {
              id,
              nickname,
              avatarUrl,
              isOwner: isPlayerOwner,
              isReady: isPlayerReady
            };
          });
          
          console.log("포맷된 플레이어 목록:", formattedPlayers);
          
          // 플레이어 목록이 변경된 경우에만 상태 업데이트 - 커스텀 비교
          if (JSON.stringify(formattedPlayers) !== JSON.stringify(players)) {
            console.log("플레이어 목록 변경 감지, 상태 업데이트");
            setPlayers([...formattedPlayers]);
          }
          
          // 자신의 준비 상태 확인
          if (currentUser) {
            const playerInfo = formattedPlayers.find((p: any) => 
              String(p.id) === String(currentUser.id)
            );
            
            if (playerInfo) {
              console.log("내 준비 상태 업데이트:", playerInfo.isReady);
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
          
          // 게임 페이지로 리다이렉션
          setTimeout(() => {
            router.push(`/game/${roomId}`);
          }, 1500);
        }
      } catch (error) {
        console.error("방 상태 처리 오류:", error);
      }
    });
    
    // 입장/퇴장 이벤트 구독 (실시간 인원 변동 감지용)
    subscribe(`/topic/room/${roomId}/join`, (message) => {
      console.log("입장 이벤트 수신:", message);
      // 상태 요청 발행 (새로운 플레이어 정보 가져오기)
      setTimeout(() => {
        publish(`/app/room/status/${roomId}`, {
          type: "STATUS_REQUEST",
          roomId: parseInt(roomId),
          timestamp: Date.now()
        });
      }, 100);
    });
    
    subscribe(`/topic/room/${roomId}/leave`, (message) => {
      console.log("퇴장 이벤트 수신:", message);
      // 상태 요청 발행 (플레이어 목록 업데이트)
      setTimeout(() => {
        publish(`/app/room/status/${roomId}`, {
          type: "STATUS_REQUEST",
          roomId: parseInt(roomId),
          timestamp: Date.now()
        });
      }, 100);
    });
    
    // 채팅 메시지 구독
    subscribe(`/topic/room/chat/${roomId}`, (message) => {
      try {
        // 문자열이면 파싱
        const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
        
        // 중복 처리를 위한 ID 생성
        const msgId = parsedMessage.id || 
          `${parsedMessage.senderId}-${parsedMessage.timestamp}-${Math.random().toString(36).substring(2, 5)}`;
        
        // UI에 표시될 상태값에서 중복 체크
        const isDuplicate = chatMessages.some(msg => 
          (msg.id === msgId) || 
          (msg.timestamp === parsedMessage.timestamp && 
          msg.content === parsedMessage.content && 
          msg.senderId === parsedMessage.senderId)
        );
        
        if (!isDuplicate) {
          const messageWithId = {
            ...parsedMessage,
            id: msgId,
            avatarUrl: parsedMessage.avatarUrl || DEFAULT_AVATAR
          };
          
          // 상태만 업데이트 (ref 사용 제거)
          setChatMessages(prev => [...prev, messageWithId]);
        }
      } catch (error) {
        console.error("채팅 메시지 처리 오류:", error);
      }
    });
    
    setIsConnected(true);
    console.log("웹소켓 구독 설정 완료");
  }, [roomId, currentUser, players, room, chatMessages, router, unsubscribeAll]);
  
  // 방 입장 처리
  const joinRoom = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      console.log("방 입장 시도:", roomId, currentUser);
      
      // 웹소켓 연결 확인 후 재연결 시도
      if (!isWebSocketConnected()) {
        console.log("웹소켓 연결 시도...");
        reconnectWebSocket();
        // 연결 설정 대기
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // 방 입장 API 호출
      await client.POST(`/api/v1/rooms/{roomId}/join`, {
        params: { path: { roomId: parseInt(roomId) } }
      });
      
      // 입장 이벤트 발행
      publish(`/app/room/join/${roomId}`, {
        roomId: parseInt(roomId),
        playerId: currentUser.id,
        playerNickname: currentUser.nickname,
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
      
      // 웹소켓 구독 설정
      setupWebSocket();
      
      // 방 상태 정보 요청 (플레이어 목록 포함)
      setTimeout(() => {
        publish(`/app/room/status/${roomId}`, {
          type: "STATUS_REQUEST",
          roomId: parseInt(roomId),
          timestamp: Date.now()
        });
      }, 500);
      
    } catch (error) {
      console.error("방 입장에 실패했습니다:", error);
      setToast({
        type: "error",
        message: "방 입장에 실패했습니다.",
        duration: 3000
      });
    }
  }, [currentUser, roomId, setupWebSocket, isWebSocketConnected, reconnectWebSocket]);
  
  // 방 나가기 처리
  const leaveRoom = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      console.log("방 나가기 시도:", roomId, currentUser);
      
      // 방 나가기 API 호출
      await client.POST(`/api/v1/rooms/{roomId}/leave`, {
        params: { path: { roomId: parseInt(roomId) } }
      });
      
      // 떠나는 메시지 발행
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: `${currentUser.nickname}님이 퇴장했습니다.`,
        senderId: "system",
        senderName: "System",
        timestamp: Date.now()
      });
      
      // 퇴장 이벤트 발행
      publish(`/app/room/leave/${roomId}`, {
        roomId: parseInt(roomId),
        playerId: currentUser.id,
        playerNickname: currentUser.nickname,
        timestamp: Date.now()
      });
      
      // 로비에 사용자 상태 업데이트 전송
      publish(`/app/lobby/status`, {
        type: "STATUS_UPDATE",
        status: "로비에서 대기 중",
        location: "IN_LOBBY",
        timestamp: Date.now()
      });
      
      // 직접 플레이어 목록에서 자신 제거 (초기 상태 처리)
      setPlayers(prev => prev.filter(p => p.id !== currentUser.id.toString()));
      
      // Room 객체의 players 목록과 currentPlayers 값 함께 업데이트
      setRoom(prev => {
        if (!prev) return prev;
        
        // players 목록에서 제거
        const playerId = currentUser.id;
        const playerIds = prev.players?.filter(id => id !== playerId) || [];
        
        return {
          ...prev,
          players: playerIds, // 플레이어 목록 업데이트
          currentPlayers: playerIds.length // 플레이어 수 업데이트
        };
      });
      
      // 웹소켓 구독 해제
      unsubscribeAll();
      
      // 로비로 이동
      router.push('/lobby');
      
      // 성공 메시지
      setToast({
        type: "success",
        message: "방에서 나왔습니다.",
        duration: 2000
      });
      
    } catch (error) {
      console.error("방 나가기에 실패했습니다:", error);
      setToast({
        type: "error",
        message: "방 나가기에 실패했습니다.",
        duration: 3000
      });
    }
  }, [roomId, currentUser, publish, setPlayers, setRoom, unsubscribeAll, router, setToast]);
  
  // 준비 상태 토글
  const toggleReady = async () => {
    try {
      // 게임이 이미 시작된 경우 처리하지 않음
      if (room?.status !== 'WAITING' || isOwner) return;
      
      // 준비 상태 토글
      const newReadyState = !isReady;
      console.log("준비 상태 변경 시도:", newReadyState);
      
      // 옵티미스틱 업데이트 - API 응답 전에 UI 먼저 업데이트
      setIsReady(newReadyState);
      
      // 플레이어 목록 업데이트
      setPlayers(prev => {
        const updated = prev.map(player => {
          if (currentUser && player.id === String(currentUser.id)) {
            return { ...player, isReady: newReadyState };
          }
          return player;
        });
        console.log("준비 상태 변경 후 로컬 플레이어 목록:", updated);
        return updated;
      });
      
      // 준비 상태 변경 API 호출
      await client.POST(`/api/v1/rooms/{roomId}/ready`, {
        params: { path: { roomId: parseInt(roomId) } }
      });
      
      // 메시지 발행
      if (currentUser) {
        // 채팅 메시지 발행
        publish(`/app/room/chat/${roomId}`, {
          type: "SYSTEM",
          content: `${currentUser.nickname}님이 ${newReadyState ? '준비 완료' : '준비 취소'}하였습니다.`,
          senderId: "system",
          senderName: "System",
          timestamp: Date.now()
        });
        
        // 준비 상태 변경 이벤트 발행
        console.log("준비 상태 변경 이벤트 발행:", {
          roomId: parseInt(roomId),
          playerId: currentUser.id,
          isReady: newReadyState
        });
        
        // 준비 상태 변경 이벤트 발행 - /app/room/ready/{roomId} 엔드포인트 사용
        publish(`/app/room/ready/${roomId}`, {
          roomId: parseInt(roomId),
          playerId: currentUser.id,
          isReady: newReadyState,
          timestamp: Date.now()
        });
        
        // 방 상태 업데이트 요청 - 모든 클라이언트에 상태 갱신 트리거
        setTimeout(() => {
          publish(`/app/room/status/${roomId}`, {
            type: "STATUS_REQUEST",
            roomId: parseInt(roomId),
            timestamp: Date.now()
          });
        }, 200);
      }
    } catch (error) {
      console.error("준비 상태 변경에 실패했습니다:", error);
      
      // 에러 발생 시 상태 원복
      const newReadyState = !isReady; // 현재 상태 (업데이트된 상태)
      setIsReady(!newReadyState); // 원래 상태로 되돌림
      setPlayers(prev => prev.map(player => {
        if (currentUser && player.id === String(currentUser.id)) {
          return { ...player, isReady: !newReadyState };
        }
        return player;
      }));
      
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
      timestamp: Date.now(),
      avatarUrl: currentUser.avatarUrl || DEFAULT_AVATAR
    };
    
    // 서버로 채팅 메시지 발행
    publish(`/app/room/chat/${roomId}`, chatMessage);
    
    // 중복 방지를 위한 ID 추가
    const messageWithId = {
      ...chatMessage,
      id: `${chatMessage.senderId}-${chatMessage.timestamp}-${Math.random().toString(36).substr(2, 5)}`
    };
    
    // 메시지를 바로 화면에 표시 (옵티미스틱 업데이트)
    setChatMessages(prev => [...prev, messageWithId]);
  };
  
  // 방에 입장할 때 주기적으로 방 상태 및 플레이어 목록 요청
  useEffect(() => {
    // 컴포넌트 마운트 후 방 상태 및 플레이어 목록 주기적으로 요청
    const statusInterval = setInterval(() => {
      if (isConnected && roomId && currentUser) {
        console.log("방 상태 주기적 요청");
        
        // 방 상태 요청 (WebSocket)
        publish(`/app/room/status/${roomId}`, {
          type: "STATUS_REQUEST",
          roomId: parseInt(roomId),
          timestamp: Date.now()
        });
        
        // REST API를 통한 방 상태 요청 추가 (백업)
        if (!isWebSocketConnected()) {
          console.log("웹소켓 연결 안됨, API로 상태 요청");
          fetchRoomData().then(roomData => {
            if (roomData) {
              console.log("API로 가져온 방 정보:", roomData);
            }
          });
        }
      }
    }, 2000); // 2초마다 요청 (로비와 동일하게 빈도 조정)
    
    return () => {
      clearInterval(statusInterval);
    };
  }, [roomId, isConnected, currentUser, publish, fetchRoomData, isWebSocketConnected]);
  
  // 채팅 메시지 디버깅용 효과
  useEffect(() => {
    console.log("채팅 메시지 목록 변경:", chatMessages);
  }, [chatMessages]);
  
  // 플레이어 준비 상태 변화 감지 useEffect 추가
  useEffect(() => {
    console.log("플레이어 준비 상태 확인:", players.map(p => ({
      id: p.id,
      nickname: p.nickname, 
      isReady: p.isReady
    })));
    
    // 자신의 준비 상태 확인
    if (currentUser) {
      const myPlayer = players.find(p => String(p.id) === String(currentUser.id));
      if (myPlayer && myPlayer.isReady !== isReady) {
        console.log("내 준비 상태 불일치 감지:", { 
          component: isReady, 
          playersList: myPlayer.isReady 
        });
        setIsReady(myPlayer.isReady);
      }
    }
  }, [players, currentUser, isReady]);
  
  // 플레이어 목록 변경 감지
  useEffect(() => {
    console.log("플레이어 목록 변경 감지:", players.length);
    
    // 자신이 목록에 있는지 확인
    if (currentUser && players.length > 0) {
      const myPlayer = players.find(p => String(p.id) === String(currentUser.id));
      if (!myPlayer) {
        console.log("경고: 내가 플레이어 목록에 없음, 상태 요청");
        // 상태 요청 발행
        publish(`/app/room/status/${roomId}`, {
          type: "STATUS_REQUEST",
          roomId: parseInt(roomId),
          timestamp: Date.now()
        });
      }
    }
    
    // 방 객체가 있고 플레이어 목록이 있는 경우 방의 currentPlayers 업데이트
    if (room && room.currentPlayers !== players.length) {
      console.log(`방 정보 플레이어 수 업데이트: ${room.currentPlayers} -> ${players.length}`);
      setRoom(prev => {
        if (!prev) return prev;
        return { ...prev, currentPlayers: players.length };
      });
    }
  }, [players, currentUser, room, roomId, publish]);
  
  // 컴포넌트 초기화 useEffect (가장 중요한 효과, 맨 뒤에 위치해야 함)
  useEffect(() => {
    // 데이터 로딩
    const initData = async () => {
      setLoading(true);
      
      // 로딩 타임아웃 설정 (10초)
      const loadingTimeout = setTimeout(() => {
        console.log("방 정보 로딩 타임아웃 발생");
        setLoading(false);
        setError("방 정보를 불러오는데 시간이 너무 오래 걸립니다. 새로고침 해주세요.");
      }, 10000);
      
      try {
        console.log("방 정보 로딩 시작");
        
        // 방 정보 가져오기
        const roomData = await fetchRoomData();
        console.log("방 정보 로딩 완료:", roomData);
        
        if (!roomData) {
          throw new Error("방 정보를 가져오지 못했습니다.");
        }
        
        // 사용자 정보 가져오기
        const userData = await fetchCurrentUser();
        console.log("사용자 정보 로딩 완료:", userData);
        
        if (!userData) {
          throw new Error("사용자 정보를 가져오지 못했습니다.");
        }
        
        // 웹소켓 구독 설정
        console.log("웹소켓 구독 설정 시작");
        setupWebSocket();
        
        // 웹소켓이 연결됐는지 확인하는 Promise 추가 (5초 타임아웃)
        const waitForWebSocketConnection = () => {
          return new Promise((resolve, reject) => {
            // 최대 5초 기다림
            const maxWaitTime = 5000;
            const startTime = Date.now();
            
            const checkConnection = () => {
              // 이미 연결됨
              if (isConnected) {
                console.log("웹소켓 연결 완료");
                resolve(true);
                return;
              }
              
              // 타임아웃 체크
              if (Date.now() - startTime > maxWaitTime) {
                console.log("웹소켓 연결 타임아웃");
                // 연결은 안됐지만 계속 진행
                resolve(false);
                return;
              }
              
              // 100ms 후 다시 체크
              setTimeout(checkConnection, 100);
            };
            
            checkConnection();
          });
        };
        
        // 방 입장 처리 - 웹소켓 연결 확인 후
        if (userData && roomData) {
          // 웹소켓 연결 후 방 입장
          await waitForWebSocketConnection();
          
          try {
            await joinRoom();
            console.log("방 입장 완료");
          } catch (joinError) {
            console.error("방 입장 실패:", joinError);
            // 방 입장이 실패해도 계속 진행
          }
          
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
        setError(error instanceof Error ? error.message : "방 정보를 불러오는데 실패했습니다.");
      } finally {
        // 로딩 타임아웃 클리어
        clearTimeout(loadingTimeout);
        setLoading(false);
        console.log("초기화 완료, 로딩 상태 해제");
      }
    };
    
    initData();
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      // 웹소켓 구독 해제
      unsubscribeAll();
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
        playersCount={players.length}
      />
      
      {/* 메인 컨텐츠 - 플레이어 목록과 채팅창 */}
      <div className="flex flex-col md:flex-row gap-5 flex-grow overflow-hidden">
        {/* 왼쪽 영역 - 플레이어 목록 */}
        <div className="w-full md:w-1/3 flex flex-col gap-5">
          {/* 플레이어 목록 컴포넌트 */}
          <PlayerList 
            key={`player-list-${players.map(p => `${p.id}-${p.isReady}`).join('-')}`}
            players={players}
            currentUserId={currentUser?.id || null}
            isOwner={isOwner}
            isReady={isReady}
            onToggleReady={toggleReady}
            roomStatus={room?.status || 'WAITING'}
          />
          {/* 방 정보 디버깅 */}
          <div className="mt-2 p-2 bg-blue-500/20 rounded text-xs text-white">
            <div>방 정보: {room ? JSON.stringify({
              id: room.id,
              title: room.title,
              currentPlayers: room.currentPlayers,
              capacity: room.capacity,
              ownerId: room.ownerId
            }) : '없음'}</div>
            <div>플레이어 수: {players.length}</div>
            <div>현재 사용자: {currentUser ? `${currentUser.id} (${currentUser.nickname})` : '없음'}</div>
            <div>준비 상태: {isReady ? '준비 완료' : '대기 중'}</div>
            <div>방장 여부: {isOwner ? '방장' : '일반 참가자'}</div>
          </div>
          
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
          {/* 디버깅용 메시지 정보 */}
          <div className="mt-2 p-2 bg-red-500/20 rounded text-xs text-white">
            <div>메시지 수: {chatMessages.length}</div>
            <div>연결 상태: {isConnected ? '연결됨' : '연결 안됨'}</div>
            <div>플레이어 수: {players.length}</div>
          </div>
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

