"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";
import { components } from "@/lib/backend/apiV1/schema";
import Image from "next/image";
import { FaChevronLeft, FaDoorOpen, FaCrown, FaCheck, FaComments, FaUsers, FaInfoCircle, FaPlay, FaBrain, FaList, FaQuestionCircle, FaHourglass } from "react-icons/fa";
import GameContainer from "@/components/game/GameContainer";
import { useSearchParams } from "next/navigation";
import { updateOnlineUserIds } from '@/components/friend/friendApi';
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

interface PlayerProfile {
  id: string;
  name: string;
  nickname: string;
  isOwner: boolean | null;
  isReady: boolean;
  avatarUrl: string;
  _uniqueId?: string; // 중복 플레이어 구분용 고유 ID
  sessionId?: string; // 세션 구분용 ID
  team?: string; // 팀 구분
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const router = useRouter();
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<string>('WAITING');
  const [activeTab, setActiveTab] = useState<'players' | 'chat'>('players');
  const [subscribers, setSubscribers] = useState<string[]>([]);
  const [isGameStartCooldown, setIsGameStartCooldown] = useState<boolean>(false);
  const [gameStartCooldownRemaining, setGameStartCooldownRemaining] = useState<number>(0);
  // 추가 상태 변수 선언 부분 (isGameStartCooldown 바로 아래에 추가)
  const [isReadyCooldown, setIsReadyCooldown] = useState<boolean>(false);
  const [readyCooldownRemaining, setReadyCooldownRemaining] = useState<number>(0);
  
  // 플레이어 목록 초기화 여부 추적
  const playersInitialized = useRef<boolean>(false);
  
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
        
        const roomData = response.data.data;
        setRoom(roomData);
        
        // 현재 사용자 정보가 이미 있고, 방장인 경우 플레이어 목록 초기화
        if (currentUser && roomData.ownerId === currentUser.id) {
          console.log("현재 사용자가 방장이므로 플레이어 목록 초기화");
          
          // 서버에서 받은 플레이어 목록이 비어있으면 자신을 추가
          if (!roomData.players || roomData.players.length === 0) {
            const ownerPlayer = {
              id: currentUser.id.toString(),
              name: currentUser.nickname,
              nickname: currentUser.nickname,
              isOwner: true,
              isReady: false,
              avatarUrl: currentUser.avatarUrl || DEFAULT_AVATAR
            };
            
            setPlayers([ownerPlayer]);
            console.log("방장 플레이어 정보 설정:", ownerPlayer);
          }
        }
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
      // 캐시 방지 헤더 추가
      const customHeaders = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Request-Time": Date.now().toString() // 무작위 헤더 값으로 캐시 방지
      };
      
      const response = await client.GET("/api/v1/members/me", {
        headers: customHeaders
      }) as any;
      
      if (response.error) {
        console.error("사용자 정보를 가져오는데 실패했습니다:", response.error);
        return null;
      }
      
      if (response.data?.data) {
        const userData = response.data.data;
        setCurrentUserId(userData.id);
        
        console.log("원본 사용자 정보 및 아바타 URL:", userData.nickname, userData.avatarUrl);
        
        // 프로필 정보 추가 요청으로 최신 아바타 URL 가져오기
        try {
          const profileResponse = await client.GET(`/api/v1/members/{memberId}`, {
            params: { path: { memberId: userData.id } },
            headers: customHeaders
          }) as any;
          
          if (profileResponse.data?.data && profileResponse.data.data.avatarUrl) {
            userData.avatarUrl = profileResponse.data.data.avatarUrl;
            console.log("사용자 프로필에서 아바타 URL 가져옴:", userData.avatarUrl);
          }
        } catch (profileError) {
          console.error("프로필 정보를 가져오는데 실패했습니다:", profileError);
        }
        
        setCurrentUser(userData);
        
        // 방장 여부 확인
        if (room && room.ownerId === userData.id) {
          setIsOwner(true);
        }
        
        console.log("최종 사용자 정보:", userData.nickname, "아바타 URL:", userData.avatarUrl);
        return userData; // 사용자 정보 반환
      }
      return null;
    } catch (error) {
      console.error("사용자 정보를 가져오는데 실패했습니다:", error);
      return null;
    }
  };

  // 웹소켓 구독 설정
  const setupWebSocket = () => {
    // 방 정보 업데이트 구독
    subscribe(`/topic/room/${roomId}`, (data) => {
      console.log("방 정보 업데이트 원본 데이터:", data);
      
      // 타입이 있는 경우 (WebSocketRoomMessageResponse 형식)
      if (data && data.type) {
        console.log(`메시지 타입: ${data.type}`);
        
        // room 정보 업데이트 - 기존 방 정보는 유지하고 새로운 속성만 업데이트
        if (data.type === 'ROOM_UPDATED' || data.type === 'JOIN' || data.type === 'LEAVE') {
          setRoom(prev => {
            if (!prev) return data;
            return { ...prev, ...data };
          });
        }
        
        // data 필드에 플레이어 목록이 포함되어 있는 경우
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
            
            // JOIN, LEAVE 등의 메시지인 경우, 이 때 받은 플레이어 목록이 최신 상태임
            // 이를 전체 목록으로 설정 (다른 채널의 변경 사항보다 우선함)
            if (playersData.length > 0) {
              console.log(`서버에서 ${playersData.length}명의 완전한 플레이어 목록 수신`);
              
              // 플레이어 데이터 형식 통일화
              const formattedPlayers = playersData.map((player: any) => {
                // ID가 숫자면 문자열로 변환
                const id = typeof player.id === 'number' ? String(player.id) : player.id;
                
                // 방장이 나간 후 다시 들어왔을 때 방장 권한이 돌아가는 문제 해결
                // 기존 방에 방장이 이미 있는 경우 새로 들어온 사용자는 방장이 될 수 없음
                const ownerExists = playersData.some((p: any) => p.isOwner && p.id !== player.id);
                const isOwnerValue = ownerExists ? false : Boolean(player.isOwner);
                
                return {
                  ...player,
                  id,
                  // 필수 필드가 없는 경우 기본값 설정
                  name: player.name || player.nickname || '사용자',
                  nickname: player.nickname || player.name || '사용자',
                  isOwner: isOwnerValue,
                  isReady: Boolean(player.isReady),
                  avatarUrl: player.avatarUrl || DEFAULT_AVATAR,
                  // 중복 방지를 위한 고유 세션 ID (없는 경우)
                  sessionId: player.sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`
                };
              });
              
              // 기존 플레이어 중 현재 사용자가 있는지 확인
              const currentUserPlayer = currentUser ? players.find(p => p.id === currentUser.id.toString()) : null;
              
              // 새 목록에 현재 사용자가 없는 경우에만 추가
              if (currentUser && currentUserPlayer && !formattedPlayers.some(p => p.id === currentUser.id.toString())) {
                console.log("서버 플레이어 목록에 현재 사용자 추가:", currentUser.nickname);
                formattedPlayers.push(currentUserPlayer);
              }
              
              // 플레이어 목록 완전 교체 (이 메시지가 가장 신뢰할 수 있는 전체 목록임)
              setPlayers(formattedPlayers);
              console.log("플레이어 목록 완전 교체:", formattedPlayers);
              
              // 방장 정보 업데이트 - owner 속성이 있는 사람을 찾음
              const ownerPlayer = formattedPlayers.find((p: any) => p.isOwner);
              
              // 현재 사용자의 준비 상태 확인
              if (currentUserId) {
                const currentPlayer = formattedPlayers.find((player: any) => {
                  const playerId = player.id;
                  const currentId = typeof currentUserId === 'string' ? currentUserId : String(currentUserId);
                  return playerId === currentId;
                });
                
                if (currentPlayer) {
                  setIsReady(currentPlayer.isReady || false);
                  
                  // 현재 사용자가 방장인지 여부 확인 및 업데이트
                  if (currentPlayer.isOwner !== isOwner) {
                    setIsOwner(currentPlayer.isOwner || false);
                    console.log(`현재 사용자 방장 여부 변경: ${currentPlayer.isOwner}`);
                  }
                }
              }
              
              // 방 정보 인원수 업데이트
              if (room) {
                setRoom(prevRoom => {
                  if (!prevRoom) return prevRoom;
                  
                  // 방장 정보가 있으면 함께 업데이트
                  const updates: any = {
                    currentPlayers: formattedPlayers.length
                  };
                  
                  if (ownerPlayer) {
                    updates.ownerId = ownerPlayer.id;
                    updates.ownerNickname = ownerPlayer.nickname || ownerPlayer.name;
                  }
                  
                  return {
                    ...prevRoom,
                    ...updates
                  };
                });
              }
            }
          } catch (error) {
            console.error("플레이어 데이터 처리 오류:", error);
          }
        } else {
          console.log("메시지에 data 필드가 없음");
        }
      } else if (data && typeof data === 'object') {
        // 단순 객체인 경우 (room 정보만 담긴 형태) - 기존 방 정보 유지
        console.log("단순 객체 형태의 데이터 수신");
        
        // gameStatus가 있으면 게임 상태 처리
        if (data.gameStatus) {
          console.log(`게임 상태 메시지 수신: ${data.gameStatus}`);
          
          if (data.gameStatus === 'IN_PROGRESS' || data.gameStatus === 'IN_GAME') {
            setGameStatus('IN_GAME');
            
            // 방 상태도 함께 업데이트
            setRoom(prev => {
              if (!prev) return prev;
              return { 
                ...prev, 
                status: 'IN_GAME'
              };
            });
          } else if (data.gameStatus === 'FINISHED') {
            setGameStatus('WAITING');
          }
          
          // 로직 처리 후 return으로 종료하여 추가 처리 방지
          return;
        }
        
        // gameStatus 필드가 없는 경우 기존 방 정보 업데이트
        setRoom(prev => {
          if (!prev) return data;
          return { ...prev, ...data };
        });
      } else {
        console.log("처리할 수 없는 형식의 데이터:", typeof data);
      }
    });
    
    // 방장 변경 이벤트 구독
    subscribe(`/topic/room/${roomId}/owner/change`, (data) => {
      console.log("방장 변경 이벤트 수신:", data);
      
      if (data && data.newOwnerId && data.newOwnerNickname) {
        // 방 정보 업데이트
        setRoom(prevRoom => {
          if (!prevRoom) return prevRoom;
          return {
            ...prevRoom,
            ownerId: data.newOwnerId,
            ownerNickname: data.newOwnerNickname
          };
        });
        
        // 플레이어 목록에서 방장 상태 업데이트
        setPlayers(prevPlayers => {
          const updatedPlayers = prevPlayers.map(player => ({
            ...player,
            isOwner: String(player.id) === String(data.newOwnerId)
          }));
          
          return updatedPlayers;
        });
        
        // 현재 사용자 방장 여부 업데이트
        if (currentUserId && String(currentUserId) === String(data.newOwnerId)) {
          setIsOwner(true);
          console.log("현재 사용자가 새로운 방장이 되었습니다.");
        } else {
          setIsOwner(false);
        }
      }
    });
    
    // 퀴즈 생성 상태 구독 추가 - 모든 참가자가 공통으로 처리하도록 수정
    subscribe(`/topic/room/${roomId}/quiz/generation`, (data) => {
      console.log("퀴즈 생성 상태 업데이트:", data);
      
      if (data.status === "STARTED" || data.status === "IN_PROGRESS") {
        // 진행 상태 메시지 전송
        publish(`/app/room/chat/${roomId}`, `!SYSTEM ${data.message || "문제 생성이 진행 중입니다..."}`);
      } else if (data.status === "COMPLETED") {
        // 완료 메시지 전송
        publish(`/app/room/chat/${roomId}`, `!SYSTEM 문제 생성 완료! 3초 후 게임이 시작됩니다.`);
        
        // 중요: 모든 클라이언트에서 게임 상태를 IN_GAME으로 즉시 변경
        setGameStatus('IN_GAME');
        
        // 퀴즈 ID가 있으면 세션 스토리지에 저장 (모든 클라이언트)
        if (data.quizId) {
          console.log(`퀴즈 생성 완료, ID: ${data.quizId} - 모든 클라이언트 게임 상태 변경`);
          window.sessionStorage.setItem('currentQuizId', data.quizId);
        }
        
        // 방 상태 업데이트
        setRoom(prevRoom => {
          if (!prevRoom) return prevRoom;
          
          return { 
            ...prevRoom, 
            status: 'IN_GAME' 
          };
        });
        
        // 방 상태 변경 메시지를 명시적으로 서버에 전송
        publish(`/app/room/${roomId}/status/update`, {
          status: 'IN_GAME',
          gameStatus: 'IN_PROGRESS',
          quizId: data.quizId,
          roomId: parseInt(roomId),
          timestamp: Date.now()
        });
        
        // 로비 사용자 목록 업데이트 메시지를 명시적으로 서버에 전송
        if (players && players.length > 0) {
          players.forEach(player => {
            publish(`/app/lobby/users/update`, {
              type: "USER_LOCATION_UPDATE",
              status: "게임중",
              location: "IN_ROOM",
              roomId: parseInt(roomId),
              userId: parseInt(player.id),
              nickname: player.nickname || player.name,
              senderId: player.id,
              senderName: player.nickname || player.name,
              timestamp: Date.now()
            });
          });
        }
        
        // 로비에 방 상태 변경 알림 (대기중 -> 게임중)
        // 여러 형식으로 전송하여 확실하게 전달되도록 함
        const statusUpdatePayload = {
          type: "ROOM_UPDATED",
          roomId: parseInt(roomId),
          status: "IN_GAME",
          timestamp: Date.now()
        };
        
        // 1. 로비 메인 채널로 전송
        publish('/app/lobby', statusUpdatePayload);
        
        // 2. 다른 형식으로도 전송 (문자열 형식)
        publish('/app/lobby', `ROOM_UPDATED:${roomId}`);
        
        // 3. 로비 상태 채널로도 전송
        publish('/app/lobby/status', statusUpdatePayload);
        
        // 4. 방송 채널로도 전송
        publish('/app/lobby/broadcast', statusUpdatePayload);
        
        // 현재 방의 모든 플레이어의 상태를 업데이트하여 로비에 알림
        if (players && players.length > 0) {
          console.log("모든 플레이어 상태 업데이트 (게임 시작):", players);
          
          players.forEach(player => {
            const playerStatusUpdate = {
              type: "USER_LOCATION_UPDATE",
              status: "게임중",
              location: "IN_ROOM",
              roomId: parseInt(roomId),
              userId: parseInt(player.id),
              senderId: player.id,
              senderName: player.nickname || player.name,
              timestamp: Date.now()
            };
            
            // 모든 채널에 위치 정보 변경 알림
            ['lobby', 'lobby/status', 'lobby/users', 'lobby/broadcast'].forEach(channel => {
              publish(`/app/${channel}`, playerStatusUpdate);
            });
          });
        }
        
        // 지연 후 상태 브로드캐스트 - 게임 상태 동기화
        setTimeout(() => {
          // 방 상태 메시지 발행 (전체 동기화)
          publish(`/app/room/${roomId}/status`, {
            gameStatus: 'IN_PROGRESS',
            quizId: data.quizId,
            room: {
              status: 'IN_GAME'
            },
            timestamp: Date.now()
          });
          
          // 게임 시작 메시지도 발행 (명시적 브로드캐스트)
          publish(`/app/room/${roomId}/broadcastGameStart`, {
            roomId: roomId,
            quizId: data.quizId,
            gameStatus: 'IN_PROGRESS',
            timestamp: Date.now()
          });
        }, 1500);
      } else if (data.status === "FAILED") {
        // 실패 시 에러 메시지 표시
        publish(`/app/room/chat/${roomId}`, `!SYSTEM ${data.message || "문제 생성에 실패했습니다. 다시 시도해주세요."}`);
        
        // 게임 상태 롤백
        setGameStatus('WAITING');
        console.error("문제 생성 실패:", data.message);
      }
    });
    
    // 방 채팅 구독
    subscribe(`/topic/room/chat/${roomId}`, (message) => {
      try {
        // 메시지 유효성 검사
        if (!message) {
          console.warn("유효하지 않은 채팅 메시지 수신");
          return;
        }
        
        console.log("채팅 메시지 수신 (처리 전):", message);
        console.log("현재 사용자 정보:", currentUser);
        
        // 처리할 메시지 객체 초기화
        let processedMessage;
        
        // 메시지 타입에 따른 처리
        if (typeof message === 'string') {
          // 일반 텍스트 메시지인 경우 (로비와 동일하게 처리)
          console.log("일반 텍스트 채팅 메시지 수신:", message);
          
          // 따옴표 제거
          let content = message;
          if (content.startsWith('"') && content.endsWith('"')) {
            content = content.substring(1, content.length - 1);
          }
          
          // 시스템 메시지인지 확인 (입장/퇴장 메시지)
          const isSystemMessage = 
            content.includes("님이 입장했습니다") || 
            content.includes("님이 퇴장했습니다") ||
            content.includes("님이 준비 완료") ||
            content.includes("님이 준비 취소") ||
            content.includes("채팅에 연결되었습니다") ||
            content.includes("문제 생성");
          
          if (isSystemMessage) {
            // 시스템 메시지
            processedMessage = {
              type: "SYSTEM",
              content: content,
              senderId: "system",
              senderName: "System",
              timestamp: Date.now(),
              roomId: roomId
            };
          } else {
            // 내가 방금 보낸 메시지인지 확인 (보낸 메시지와 동일한 내용인지)
            const isMyMessage = content === newChatMessage.trim() || 
                                (currentUser && message === newChatMessage.trim());
            
            console.log("메시지 내용 비교:", {
              "받은 내용": content,
              "내가 보낸 내용": newChatMessage.trim(),
              "내 메시지 여부": isMyMessage
            });
            
            if (isMyMessage && currentUser) {
              // 내가 보낸 메시지
              processedMessage = {
                type: "CHAT",
                content: content,
                senderId: String(currentUser.id),
                senderName: currentUser.nickname,
                avatarUrl: currentUser.avatarUrl || DEFAULT_AVATAR,
                timestamp: Date.now(),
                roomId: roomId
              };
              
              console.log("내 메시지로 처리됨:", processedMessage);
            } else {
              // 다른 플레이어가 보낸 메시지
              const sender = players.find(p => p.id !== String(currentUser?.id));
              
              processedMessage = {
                type: "CHAT",
                content: content,
                senderId: sender?.id || "unknown",
                senderName: sender?.nickname || "사용자",
                avatarUrl: sender?.avatarUrl || DEFAULT_AVATAR,
                timestamp: Date.now(),
                roomId: roomId
              };
              
              console.log("다른 사용자 메시지로 처리됨:", processedMessage);
            }
          }
        } else {
          // JSON 객체 형태의 메시지인 경우
          processedMessage = {
            type: message.type || "CHAT",
            content: message.content || "내용 없음",
            senderId: message.senderId || "unknown",
            senderName: message.senderName || "알 수 없음",
            avatarUrl: message.avatarUrl || DEFAULT_AVATAR,
            timestamp: message.timestamp || Date.now(),
            roomId: message.roomId || roomId
          };
        }
        
        // 채팅 메시지 추가
        setChatMessages((prevMessages) => {
          return [...prevMessages, processedMessage];
        });
      } catch (error) {
        console.error("채팅 메시지 처리 중 오류:", error, "원본 메시지:", message);
      }
    });
    
    // 로비 유저 목록 구독 - 게임 내에서도 온라인 상태 유지
    subscribe("/topic/lobby/users", (data) => {
      // 게임방에 있는 경우에는 상태 업데이트를 무시
      console.log("로비 유저 목록 업데이트 수신 (무시됨)");
      
      // 온라인 상태만 업데이트하고 위치 정보는 변경하지 않음
      if (Array.isArray(data)) {
        const onlineUserIds = data.map((user: any) => user.id);
        updateOnlineUserIds(onlineUserIds);
      }
    });
    
    // 로비 상태 업데이트 구독 추가
    subscribe("/topic/lobby/status", (data) => {
      // 게임방에 있는 경우에는 로비 상태 업데이트를 무시
      console.log("로비 상태 업데이트 수신 (무시됨)");
    });
    
    // 방 상태 구독 추가 - 다른 사용자들의 상태 변화를 수신
    subscribe(`/topic/room/${roomId}/status`, (message) => {
      try {
        // 메시지 형식 확인 및 처리
        let status;
        
        if (!message) {
          console.log("방 상태 업데이트: 메시지 객체가 없음");
          return;
        }
        
        // 메시지 형식에 따른 처리
        if (message.body) {
          // body 속성이 있는 경우 (일반적인 STOMP 메시지)
          if (message.body === "undefined" || message.body === "") {
            console.log("방 상태 업데이트: 빈 메시지 본문");
            return;
          }
          try {
            status = JSON.parse(message.body);
          } catch (parseError) {
            console.error("JSON 파싱 오류:", parseError, "원본:", message.body);
            return;
          }
        } else if (typeof message === 'object' && (message.room || message.players)) {
          // 메시지 자체가 데이터 객체인 경우 (이미 파싱된 객체)
          status = message;
        } else {
          console.log("방 상태 업데이트: 지원되지 않는 메시지 형식", message);
          return;
        }
        
        console.log("방 상태 업데이트:", status);

        // 게임 상태나 방 정보만 업데이트하고 불완전한 플레이어 목록은 무시
        if (status.room) {
          setRoom(prevRoom => {
            if (!prevRoom) return status.room;
            
            // 방장 변경이나 인원수 변경 등의 정보를 반영
            const updatedRoom = {
              ...prevRoom,
              ...status.room,
            };
            
            // 인원수 정확성 보장: status.players가 있으면 그 길이로 업데이트
            if (status.players && Array.isArray(status.players) && status.players.length > 0) {
              updatedRoom.currentPlayers = status.players.length;
              console.log(`인원수 정확한 데이터로 조정: ${status.players.length}명 (플레이어 목록 기준)`);
            }
            
            // 인원수와 방장 정보 업데이트 로그
            if (prevRoom.ownerId !== updatedRoom.ownerId) {
              console.log(`방장 변경: ${prevRoom.ownerNickname} -> ${updatedRoom.ownerNickname || "알 수 없음"}`);
            }
            
            if (prevRoom.currentPlayers !== updatedRoom.currentPlayers) {
              console.log(`인원수 변경: ${prevRoom.currentPlayers}명 -> ${updatedRoom.currentPlayers}명`);
            }
            
            // 방 상태가 변경되면 게임 상태도 함께 업데이트
            if (prevRoom.status !== updatedRoom.status) {
              console.log(`방 상태 변경: ${prevRoom.status} -> ${updatedRoom.status}`);
              if (updatedRoom.status === 'IN_GAME') {
                setGameStatus('IN_GAME');
              } else if (updatedRoom.status === 'FINISHED') {
                setGameStatus('WAITING');
              }
            }
            
            return updatedRoom;
          });
          
          // 방장 변경 시 isOwner 상태 업데이트
          if (status.room.ownerId && currentUserId) {
            const isCurrentUserOwner = String(status.room.ownerId) === String(currentUserId);
            setIsOwner(isCurrentUserOwner);
            console.log(`현재 사용자 방장 여부: ${isCurrentUserOwner}`);
          }
        }
        
        if (status.gameStatus) {
          setGameStatus(status.gameStatus);
          console.log(`게임 상태 업데이트: ${status.gameStatus}`);
        }
        
        // 플레이어 목록이 완전하면 업데이트, 그렇지 않으면 기존 목록 유지
        if (status.players) {
          // 1. status.players가 비어있으면 기존 목록 유지
          if (status.players.length === 0 && players.length > 0) {
            console.log("빈 플레이어 목록 수신, 기존 목록 유지");
            return;
          }
          
          // room.players ID 목록과 status.players 객체 배열을 비교하여 완전성 확인
          const roomPlayerIds = status.room?.players || [];
          console.log("Room player IDs:", roomPlayerIds);
          console.log("Status players:", status.players);
          
          // room.players에 있지만 status.players에 없는 ID 확인
          const missingPlayerIds = roomPlayerIds.filter((id: number) => 
            !status.players.some((p: any) => String(p.id) === String(id))
          );
          
          if (missingPlayerIds.length > 0) {
            console.log("누락된 플레이어 ID 감지:", missingPlayerIds);
            
            // 기존 플레이어 목록에서 해당 ID의 플레이어 정보 보존
            setPlayers(prevPlayers => {
              // 수신된 플레이어 정보 형식 통일
              const formattedReceived = status.players.map((player: any) => ({
                id: String(player.id),
                name: player.name || player.nickname || '사용자',
                nickname: player.nickname || player.name || '사용자',
                isOwner: Boolean(player.isOwner),
                isReady: Boolean(player.isReady),
                avatarUrl: player.avatarUrl || DEFAULT_AVATAR,
                sessionId: player.sessionId || `session-${Date.now()}`
              }));
              
              // 기존 플레이어 중 누락된 ID 해당 플레이어 정보 유지
              const preservedPlayers = prevPlayers.filter(player => 
                missingPlayerIds.includes(Number(player.id))
              );
              
              // 두 배열 병합 (중복 없이)
              const mergedPlayers = [...formattedReceived];
              
              preservedPlayers.forEach(player => {
                if (!mergedPlayers.some(p => String(p.id) === String(player.id))) {
                  mergedPlayers.push(player);
                }
              });
              
              // 방장 속성 정확히 설정
              if (status.room?.ownerId) {
                mergedPlayers.forEach(player => {
                  player.isOwner = String(player.id) === String(status.room.ownerId);
                });
              }
              
              // 현재 사용자가 목록에 없으면 추가
              if (currentUser && !mergedPlayers.some(p => String(p.id) === String(currentUser.id))) {
                const currentUserInfo = prevPlayers.find(p => String(p.id) === String(currentUser.id));
                if (currentUserInfo) {
                  mergedPlayers.push(currentUserInfo);
                  console.log("현재 사용자 정보 목록에 추가");
                }
              }
              
              console.log("병합된 최종 플레이어 목록:", mergedPlayers);
              return mergedPlayers;
            });
          } else {
            // 완전한 플레이어 목록인 경우 교체
            console.log("완전한 플레이어 목록 수신, 목록 교체");
            
            // 수신된 목록 형식 통일화
            const formattedPlayers = status.players.map((player: any) => ({
              id: String(player.id),
              name: player.name || player.nickname || '사용자',
              nickname: player.nickname || player.name || '사용자',
              isOwner: status.room?.ownerId ? String(player.id) === String(status.room.ownerId) : Boolean(player.isOwner),
              isReady: Boolean(player.isReady),
              avatarUrl: player.avatarUrl || DEFAULT_AVATAR,
              sessionId: player.sessionId || `session-${Date.now()}`
            }));
            
            // 현재 사용자가 수신된 목록에 없으면 추가
            if (currentUser && !formattedPlayers.some((p: PlayerProfile) => String(p.id) === String(currentUser.id))) {
              const currentUserInPrevList = players.find((p: PlayerProfile) => String(p.id) === String(currentUser.id));
              
              if (currentUserInPrevList) {
                formattedPlayers.push(currentUserInPrevList);
                console.log("현재 사용자 정보 목록에 추가");
              }
            }
            
            setPlayers(formattedPlayers);
            console.log("방 상태 업데이트: 플레이어 목록 초기화");
            console.log("상태 채널에서 초기 플레이어 목록 설정:", formattedPlayers);
          }
        }
      } catch (e) {
        console.error("방 상태 업데이트 메시지 처리 오류:", e);
      }
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

  // 방 상태 브로드캐스트 함수 - 상태 변경 시 호출
  const broadcastRoomStatus = () => {
    if (!room || !currentUser) return;
    
    // 방 상태 정보 구성
    const roomStatusData = {
      room: room,
      players: players,
      timestamp: Date.now()
    };
    
    // 방 상태 업데이트 메시지 발행
    publish(`/app/room/${roomId}/status`, roomStatusData);
    console.log("방 상태 업데이트 발행:", roomStatusData);
  };

  // 웹소켓 설정 및 방 입장 순서 제어
  useEffect(() => {
    // 웹소켓 구독 설정 (페이지 진입 시 가장 먼저 실행)
    setupWebSocket();
    
    // 방 정보와 사용자 정보를 순차적으로 로드
    const loadData = async () => {
      try {
        console.log("페이지 로드 - 데이터 초기화 시작");
        
        // 방 정보 로드
        await fetchRoomData();
        console.log("방 정보 로드 완료");
        
        // 사용자 정보 로드 및 반환값 저장
        const userData = await fetchCurrentUser();
        
        // 사용자 정보가 없으면 재시도 또는 에러 처리
        if (!userData) {
          console.log("사용자 정보 로드 실패, 3초 후 재시도...");
          await new Promise(resolve => setTimeout(resolve, 3000));
          const retryData = await fetchCurrentUser();
          
          if (!retryData) {
            console.error("사용자 정보를 가져오지 못했습니다. 로비로 돌아갑니다.");
            window.location.href = "/lobby";
            return;
          }
        }
        
        // 반환된 userData를 직접 사용하여 방 입장 처리
        if (userData) {
          console.log("사용자 정보 확인됨:", userData.nickname);
          
          // 기존 방장 여부 확인 로직 제거 - 서버에서 받은 정보만 사용
          /* 이 부분 삭제
          // 방장 여부 확인 및 설정
          if (room && room.ownerId === userData.id) {
            setIsOwner(true);
          }
          */
          
          // 기존 loadData의 joinRoom 호출 대신 임시 플레이어 정보 구성 및 방 입장
          // 여기에서 isCurrentUserOwner를 임의로 설정하지 않고 서버에서 받을 때까지 기다림
          const newPlayer = {
            id: userData.id.toString(),
            name: userData.nickname,
            nickname: userData.nickname,
            isOwner: false, // 초기에는 방장이 아닌 것으로 설정, 서버에서 방장 정보를 받아 업데이트
            isReady: false,
            avatarUrl: userData.avatarUrl || DEFAULT_AVATAR
          };
          
          // API 요청
          console.log("방 입장 API 요청 시작");
          try {
            const response = await (client.POST as any)(`/api/v1/rooms/${roomId}/join`, {});
            console.log("방 입장 API 응답:", response);
          } catch (error) {
            console.warn("방 입장 API 요청 실패, 이미 입장한 상태일 수 있음:", error);
          }
          
          // 입장 메시지 전송
          publish(`/app/room/${roomId}/join`, {
            roomId: parseInt(roomId)
          });
          
          // 방장 여부 확인 (이미 방에 방장이 있는지 체크)
          const ownerAlreadyExists = players.some(p => p.isOwner);
          const shouldBeOwner = !ownerAlreadyExists && (room?.ownerId === userData.id);
          
          // 입장 메시지 전송 시 방장 여부도 함께 전송
          publish(`/app/room/${roomId}/join`, {
            roomId: parseInt(roomId),
            isOwner: shouldBeOwner
          });
          
          // 방 입장 시스템 메시지 - 일반 텍스트로 변경
          publish(`/app/room/chat/${roomId}`, `!SYSTEM ${userData.nickname}님이 입장했습니다.`);
          
          // 로비에 사용자 상태 업데이트 전송
          publish(`/app/lobby/status`, {
            type: "USER_LOCATION_UPDATE",
            status: `게임방 ${roomId}번 입장`,
            location: "IN_ROOM",
            roomId: parseInt(roomId),
            userId: userData.id,
            nickname: userData.nickname,
            senderId: userData.id.toString(),
            senderName: userData.nickname,
            timestamp: Date.now()
          });
          
          // 로비 사용자 목록 업데이트 메시지를 명시적으로 서버에 전송
          publish(`/app/lobby/users/update`, {
            type: "USER_LOCATION_UPDATE",
            status: `게임방 ${roomId}번`,
            location: "IN_ROOM",
            roomId: parseInt(roomId),
            userId: userData.id,
            nickname: userData.nickname,
            senderId: userData.id.toString(),
            senderName: userData.nickname,
            timestamp: Date.now()
          });
          
          // 모든 채널에 위치 정보 변경 알림
          for (const channel of ['/app/lobby/users', '/app/lobby/broadcast', '/app/lobby/broadcast/location']) {
            publish(channel, {
              type: "USER_LOCATION_UPDATE",
              status: `게임방 ${roomId}번 입장`,
              location: "IN_ROOM",
              roomId: parseInt(roomId),
              userId: userData.id,
              nickname: userData.nickname,
              senderId: userData.id.toString(),
              senderName: userData.nickname,
              timestamp: Date.now()
            });
          }
          
          // 3회 반복하여 전송 (확실하게 업데이트되도록)
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              publish(`/app/lobby/broadcast`, {
                type: "USER_LOCATION_UPDATE",
                userId: userData.id,
                senderId: userData.id.toString(),
                nickname: userData.nickname,
                senderName: userData.nickname,
                location: "IN_ROOM",
                status: `게임방 ${roomId}번 입장`,
                roomId: parseInt(roomId),
                timestamp: Date.now() + i
              });
            }, 500 * (i + 1));
          }
          
          // 플레이어 목록 설정
          setPlayers(prevPlayers => {
            const updatedPlayers = [...prevPlayers];
            const existingIndex = updatedPlayers.findIndex(p => p.id === userData.id.toString());
            
            if (existingIndex === -1) {
              updatedPlayers.push(newPlayer);
            } else {
              updatedPlayers[existingIndex] = {
                ...updatedPlayers[existingIndex],
                ...newPlayer
              };
            }
            
            // 상태 업데이트 후 즉시 브로드캐스트 진행
            if (room) {
              // 인원 수 즉시 업데이트
              const updatedRoom = {
                ...room,
                currentPlayers: updatedPlayers.length // 실제 플레이어 수로 정확히 설정
              };
              
              // 업데이트된 방 정보로 브로드캐스트
              publish(`/app/room/${roomId}/status`, {
                room: updatedRoom,
                players: updatedPlayers,
                timestamp: Date.now()
              });
              console.log("방 입장 즉시 정확한 인원 수로 브로드캐스트:", updatedPlayers.length);
              
              // 방 정보도 즉시 업데이트
              setRoom(updatedRoom);
            }
            
            return updatedPlayers;
          });
          
          console.log("방 입장 프로세스 완료");
          
          // 플레이어 목록 명시적 갱신 요청 - 지연 없이 즉시 실행
          publish(`/app/room/${roomId}/players/refresh`, {});
          console.log("방 입장 후 플레이어 목록 명시적 갱신 요청");
        } else {
          console.error("사용자 정보가 상태에 설정되지 않았습니다.");
        }
      } catch (error) {
        console.error("방 데이터 로드 또는 입장 중 오류:", error);
      }
    };
    
    loadData();
    
    // 컴포넌트 언마운트 시 웹소켓 구독 해제
    return () => {
      console.log("컴포넌트 언마운트 - 웹소켓 구독 해제");
      unsubscribe(`/topic/room/${roomId}`);
      unsubscribe(`/topic/room/chat/${roomId}`);
      unsubscribe(`/topic/room/${roomId}/status`);
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

  // 강제 플레이어 목록 업데이트
  // room과 currentUser가 모두 로드된 후 players가 비어있으면 직접 설정
  useEffect(() => {
    if (!playersInitialized.current && room && currentUser && players.length === 0) {
      console.log("강제 플레이어 목록 초기화 시도");
      
      // 플레이어 목록 명시적 갱신 요청
      publish(`/app/room/${roomId}/players/refresh`, {});
      console.log("플레이어 목록 명시적 갱신 요청 전송");
      
      // 현재 사용자 정보가 유효한지 확인
      if (!currentUser.id || !currentUser.nickname) {
        console.error("현재 사용자 정보가 불완전합니다:", currentUser);
        return;
      }
      
      // 방장 여부 확인
      const isCurrentUserOwner = currentUser.id === room.ownerId;
      console.log("현재 사용자 방장 여부 확인:", isCurrentUserOwner);
      
      // 플레이어 목록 직접 생성
      const newPlayer = {
        id: currentUser.id.toString(),
        name: currentUser.nickname || '사용자',
        nickname: currentUser.nickname || '사용자',
        isOwner: isCurrentUserOwner,
        isReady: false,
        avatarUrl: currentUser.avatarUrl || DEFAULT_AVATAR,
        sessionId: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` // 고유 세션 ID 생성
      };
      
      console.log("생성된 플레이어 정보:", newPlayer);
      setPlayers([newPlayer]);
      
      // 방 정보에 현재 인원 업데이트
      if (room) {
        setRoom(prevRoom => ({
          ...prevRoom,
          currentPlayers: Math.max(1, prevRoom?.currentPlayers || 0)
        }));
      }
      
      // 상태 업데이트 후 브로드캐스트를 위한 시간 지연
      setTimeout(() => {
        // 플레이어 목록 정보와 함께 방 상태 브로드캐스트
        publish(`/app/room/${roomId}/status`, {
          room: {
            ...room,
            currentPlayers: 1
          },
          players: [newPlayer],
          timestamp: Date.now()
        });
        console.log("강제 플레이어 목록 초기화 후 브로드캐스트 전송");
      }, 1000);
      
      playersInitialized.current = true;
      console.log("플레이어 목록 강제 초기화 완료");
    }
  }, [room, currentUser, players.length, roomId]);

  // 주기적으로 방 상태 공유 (60초마다)
  useEffect(() => {
    if (!room || !currentUser) return;
    
    const intervalId = setInterval(() => {
      broadcastRoomStatus();
    }, 60000); // 60초마다 상태 업데이트
    
    return () => clearInterval(intervalId);
  }, [room, players, currentUser]);

  // 채팅 메시지 전송 함수
  const handleSendChatMessage = () => {
    if (!newChatMessage.trim() || !currentUser) return;
    
    // 채팅 메시지 발행 - JSON 객체 대신 일반 텍스트로 변경
    publish(`/app/room/chat/${roomId}`, newChatMessage.trim());
    
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
      if (room?.status !== 'WAITING' || !currentUser) {
        console.log("게임이 이미 시작되었거나 방이 대기 상태가 아닙니다.");
        return;
      }
      
      // 쿨다운 타이머 처리 - 마지막 준비 상태 변경 후 1.5초 이내에는 다시 변경 불가
      const lastToggleTime = parseInt(sessionStorage.getItem('lastReadyToggleTime') || '0');
      const currentTime = Date.now();
      const cooldownTime = 1500; // 1.5초 쿨다운
      
      // 쿨다운 시간이 지나지 않았으면 리턴
      if (currentTime - lastToggleTime < cooldownTime) {
        console.log("준비 상태 변경 쿨다운 중입니다. 잠시 후 다시 시도하세요.");
        return;
      }
      
      // 현재 준비 상태의 반대로 설정
      const newReadyState = !isReady;
      
      // 현재 시간을 세션 스토리지에 저장
      sessionStorage.setItem('lastReadyToggleTime', currentTime.toString());
      
      // API 호출 - 준비 상태 변경 (as any 타입 캐스팅 사용)
      await (client.POST as any)(`/api/v1/rooms/${roomId}/ready`, {
        body: { isReady: newReadyState }
      });
      
      // 메시지 발행 - 방 내 플레이어에게 알림 (일반 텍스트로 변경)
      publish(`/app/room/chat/${roomId}`, `!SYSTEM ${currentUser.nickname || '플레이어'}님이 ${newReadyState ? '준비 완료' : '준비 취소'}하였습니다.`);
      
      // 로컬 상태 업데이트 및 브로드캐스트
      setIsReady(newReadyState);
      
      // 플레이어 목록에서 현재 사용자 상태 업데이트
      setPlayers(prevPlayers => {
        const updatedPlayers = prevPlayers.map(player => {
          if (player.id === currentUser.id.toString()) {
            return { ...player, isReady: newReadyState };
          }
          return player;
        });
        
        // 상태가 업데이트된 후 즉시 브로드캐스트
        setTimeout(() => {
          if (room) {
            publish(`/app/room/${roomId}/status`, {
              room: room,
              players: updatedPlayers,
              timestamp: Date.now()
            });
            console.log("준비 상태 변경 후 업데이트된 플레이어 목록 브로드캐스트:", updatedPlayers);
          }
        }, 0);
        
        return updatedPlayers;
      });
      
      console.log(`준비 상태가 ${newReadyState ? '완료' : '취소'}되었습니다.`);
    } catch (error) {
      console.error("준비 상태 변경에 실패했습니다:", error);
      alert("준비 상태 변경에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 게임 시작
  const startGame = async () => {
    try {
      // 방장인지 확인 및 room이 null이 아닌지 확인
      if (!isOwner || !currentUser || !room) {
        console.error("방장만 게임을 시작할 수 있거나 방 정보가 없습니다.");
        return;
      }
      
      // 쿨다운 타이머 처리 - 마지막 시작 시도 후 5초 이내에는 다시 시도 불가
      const lastStartTime = parseInt(sessionStorage.getItem('lastGameStartTime') || '0');
      const currentTime = Date.now();
      const cooldownTime = 5000; // 5초 쿨다운
      
      // 쿨다운 시간이 지나지 않았으면 리턴
      if (currentTime - lastStartTime < cooldownTime) {
        console.log("게임 시작 쿨다운 중입니다. 잠시 후 다시 시도하세요.");
        return;
      }
      
      // 현재 시간을 세션 스토리지에 저장
      sessionStorage.setItem('lastGameStartTime', currentTime.toString());
      
      // 게임 시작 로딩 상태 표시
      setGameStatus('STARTING');
      
      // 게임이 이미 시작된 상태인지 확인
      if (room.status !== 'WAITING') {
        console.log("게임이 이미 시작되었습니다.");
        return;
      }
      
      // 문제 생성 중임을 알리는 시스템 메시지 (!SYSTEM 접두사 사용)
      publish(`/app/room/chat/${roomId}`, `!SYSTEM AI가 문제를 생성하는 중입니다. 잠시만 기다려주세요...`);
      
      // WebSocket을 통해 AI 퀴즈 생성 요청 전송
      publish(`/app/room/${roomId}/quiz/generate`, {
        mainCategory: room.mainCategory,
        subCategory: room.subCategory,
        difficulty: room.difficulty,
        problemCount: room.problemCount || 5,
        timestamp: Date.now()
      });
      
      console.log("AI 퀴즈 생성 요청 전송됨:", {
        mainCategory: room.mainCategory,
        subCategory: room.subCategory,
        difficulty: room.difficulty,
        problemCount: room.problemCount || 5
      });
      
      // 퀴즈 생성 상태 구독 (없는 경우 새로 구독)
      if (!subscribers.includes(`/topic/room/${roomId}/quiz/generation`)) {
        // 이미 전송된 메시지 추적용 변수
        let sentMessages: Set<string> = new Set();
        
        subscribe(`/topic/room/${roomId}/quiz/generation`, (data) => {
          console.log("퀴즈 생성 상태 업데이트:", data);
          
          // 메시지가 방 인원 수만큼 중복 출력되는 문제를 해결하기 위해 메시지 출력하지 않음
          // 생성 완료 메시지만 표시
          if (data.status === "COMPLETED" && !sentMessages.has("문제 생성 완료!")) {
            publish(`/app/room/chat/${roomId}`, `!SYSTEM 문제 생성 완료! 3초 후 게임이 시작됩니다.`);
            sentMessages.add("문제 생성 완료!");
            
            // 중요: 모든 클라이언트에서 게임 상태를 IN_GAME으로 즉시 변경
            setGameStatus('IN_GAME');
            
            // 퀴즈 ID가 있으면 세션 스토리지에 저장 (모든 클라이언트)
            if (data.quizId) {
              console.log(`퀴즈 생성 완료, ID: ${data.quizId} - 모든 클라이언트 게임 상태 변경`);
              window.sessionStorage.setItem('currentQuizId', data.quizId);
            }
            
            // 방 상태 업데이트
            setRoom(prevRoom => {
              if (!prevRoom) return prevRoom;
              
              return { 
                ...prevRoom, 
                status: 'IN_GAME' 
              };
            });
            
            // 방 상태 변경 메시지를 명시적으로 서버에 전송
            publish(`/app/room/${roomId}/status/update`, {
              status: 'IN_GAME',
              gameStatus: 'IN_PROGRESS',
              quizId: data.quizId,
              roomId: parseInt(roomId),
              timestamp: Date.now()
            });
            
            // 로비 사용자 목록 업데이트 메시지를 명시적으로 서버에 전송
            if (players && players.length > 0) {
              players.forEach(player => {
                publish(`/app/lobby/users/update`, {
                  type: "USER_LOCATION_UPDATE",
                  status: "게임중",
                  location: "IN_ROOM",
                  roomId: parseInt(roomId),
                  userId: parseInt(player.id),
                  nickname: player.nickname || player.name,
                  senderId: player.id,
                  senderName: player.nickname || player.name,
                  timestamp: Date.now()
                });
              });
            }
            
            // 로비에 방 상태 변경 알림 (대기중 -> 게임중)
            // 여러 형식으로 전송하여 확실하게 전달되도록 함
            const statusUpdatePayload = {
              type: "ROOM_UPDATED",
              roomId: parseInt(roomId),
              status: "IN_GAME",
              timestamp: Date.now()
            };
            
            // 1. 로비 메인 채널로 전송
            publish('/app/lobby', statusUpdatePayload);
            
            // 2. 다른 형식으로도 전송 (문자열 형식)
            publish('/app/lobby', `ROOM_UPDATED:${roomId}`);
            
            // 3. 로비 상태 채널로도 전송
            publish('/app/lobby/status', statusUpdatePayload);
            
            // 4. 방송 채널로도 전송
            publish('/app/lobby/broadcast', statusUpdatePayload);
            
            // 현재 방의 모든 플레이어의 상태를 업데이트하여 로비에 알림
            if (players && players.length > 0) {
              console.log("모든 플레이어 상태 업데이트 (게임 시작):", players);
              
              players.forEach(player => {
                const playerStatusUpdate = {
                  type: "USER_LOCATION_UPDATE",
                  status: "게임중",
                  location: "IN_ROOM",
                  roomId: parseInt(roomId),
                  userId: parseInt(player.id),
                  senderId: player.id,
                  senderName: player.nickname || player.name,
                  timestamp: Date.now()
                };
                
                // 모든 채널에 위치 정보 변경 알림
                ['lobby', 'lobby/status', 'lobby/users', 'lobby/broadcast'].forEach(channel => {
                  publish(`/app/${channel}`, playerStatusUpdate);
                });
              });
            }
            
            // 지연 후 상태 브로드캐스트 - 게임 상태 동기화
            setTimeout(() => {
              // 방 상태 메시지 발행 (전체 동기화)
              publish(`/app/room/${roomId}/status`, {
                gameStatus: 'IN_PROGRESS',
                quizId: data.quizId,
                room: {
                  status: 'IN_GAME'
                },
                timestamp: Date.now()
              });
              
              // 게임 시작 메시지도 발행 (명시적 브로드캐스트)
              publish(`/app/room/${roomId}/broadcastGameStart`, {
                roomId: roomId,
                quizId: data.quizId,
                gameStatus: 'IN_PROGRESS',
                timestamp: Date.now()
              });
            }, 1500);
          } else if (data.status === "FAILED") {
            // 실패 시 에러 메시지 표시
            publish(`/app/room/chat/${roomId}`, `!SYSTEM ${data.message || "문제 생성에 실패했습니다. 다시 시도해주세요."}`);
            
            // 게임 상태 롤백
            setGameStatus('WAITING');
            console.error("문제 생성 실패:", data.message);
          }
        });
        
        // 구독 목록에 추가
        setSubscribers(prev => [...prev, `/topic/room/${roomId}/quiz/generation`]);
      }
      
    } catch (error) {
      console.error("게임 시작에 실패했습니다:", error);
      
      // 에러 메시지 표시
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: "게임 시작에 실패했습니다. 잠시 후 다시 시도해주세요.",
        timestamp: Date.now()
      });
      
      // 게임 상태 원상복구
      setGameStatus('WAITING');
      alert("게임 시작에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 방 퇴장
  const leaveRoom = async () => {
    try {
      if(!currentUser || !room) return;
      
      // 퇴장 시스템 메시지 먼저 전송 - 일반 텍스트로 변경
      publish(`/app/room/chat/${roomId}`, `!SYSTEM ${currentUser.nickname}님이 퇴장했습니다.`);
      
      // 현재 사용자 ID
      const currentUserId = currentUser.id.toString();
      
      // 현재 사용자가 방장인지 확인
      const isCurrentUserOwner = isOwner;
      
      // 방장이 나가는 경우, 다음 방장 지정
      if (isCurrentUserOwner) {
        const remainingPlayers = players.filter(player => player.id !== currentUserId);
        if (remainingPlayers.length > 0) {
          // 남은 사용자 중 첫 번째 사용자를 방장으로 지정
          const newOwner = remainingPlayers[0];
          
          // 새 방장 정보 업데이트
          publish(`/app/room/${roomId}/owner/change`, {
            roomId: parseInt(roomId),
            newOwnerId: parseInt(newOwner.id),
            newOwnerNickname: newOwner.nickname
          });
          
          // 방장 변경 메시지 전송
          publish(`/app/room/chat/${roomId}`, `!SYSTEM ${newOwner.nickname}님이 새로운 방장이 되었습니다.`);
          
          console.log(`방장 권한 이전: ${currentUser.nickname} -> ${newOwner.nickname}`);
        }
      }
      
      // 퇴장 메시지 전송
      publish(`/app/room/${roomId}/leave`, {
        roomId: parseInt(roomId)
      });
      
      // 방 정보 업데이트 (인원 수 정확히 반영)
      const updatedRoom = {
        ...room,
        currentPlayers: players.length - 1
      };
      
      // 인원 수 즉시 갱신을 위한 브로드캐스트 메시지 전송
      publish(`/app/room/${roomId}/status`, {
        room: updatedRoom,
        players: players,
        timestamp: Date.now()
      });
      console.log("방 퇴장 즉시 정확한 인원 수로 브로드캐스트:", updatedRoom.currentPlayers);
      
      // 로컬 상태도 업데이트
      setPlayers(players.filter(player => player.id !== currentUserId));
      setRoom(updatedRoom);

      // 로비에 사용자 상태 업데이트 전송
      publish(`/app/lobby/status`, {
        type: "USER_LOCATION_UPDATE",
        status: "로비",
        location: "IN_LOBBY",
        roomId: null,
        userId: currentUser.id,
        nickname: currentUser.nickname,
        senderId: currentUser.id.toString(),
        senderName: currentUser.nickname,
        timestamp: Date.now()
      });
      
      // 로비 사용자 목록 업데이트 메시지를 명시적으로 서버에 전송
      publish(`/app/lobby/users/update`, {
        type: "USER_LOCATION_UPDATE",
        status: "로비",
        location: "IN_LOBBY",
        roomId: null,
        userId: currentUser.id,
        nickname: currentUser.nickname,
        senderId: currentUser.id.toString(),
        senderName: currentUser.nickname,
        timestamp: Date.now()
      });
      
      // 모든 채널에 위치 정보 변경 알림
      for (const channel of ['/app/lobby/users', '/app/lobby/broadcast', '/app/lobby/broadcast/location']) {
        publish(channel, {
          type: "USER_LOCATION_UPDATE",
          status: "로비",
          location: "IN_LOBBY",
          roomId: null,
          userId: currentUser.id,
          nickname: currentUser.nickname,
          senderId: currentUser.id.toString(),
          senderName: currentUser.nickname,
          timestamp: Date.now()
        });
      }
      
      // 여러 번 전송하여 확실하게 업데이트되도록 함
      setTimeout(() => {
        publish(`/app/lobby/broadcast`, {
          type: "USER_LOCATION_UPDATE",
          status: "로비",
          location: "IN_LOBBY",
          roomId: null,
          userId: currentUser.id,
          nickname: currentUser.nickname,
          senderId: currentUser.id.toString(),
          senderName: currentUser.nickname,
          timestamp: Date.now() + 1
        });
      }, 500);
      
      // 웹소켓 구독 해제
      unsubscribe(`/topic/room/${roomId}`);
      unsubscribe(`/topic/room/chat/${roomId}`);
      unsubscribe(`/topic/room/${roomId}/status`);
      unsubscribe("/topic/lobby/users");
      unsubscribe("/topic/lobby/status");
      
      // beforeunload 경고 없이 로비로 이동하기 위해 로컬 스토리지에 플래그 설정
      localStorage.setItem('intentional_navigation', 'true');
      
      // API 호출 및 리다이렉트 (브로드캐스트 메시지가 전송될 시간 확보)
      setTimeout(async () => {
        try {
          await (client.POST as any)(`/api/v1/rooms/${roomId}/leave-with-id`, {});
          // 로비로 리다이렉트
          window.location.href = "/lobby";
        } catch (error) {
          console.error("API 호출 중 오류 발생:", error);
          // 오류가 발생해도 로비로 이동
          window.location.href = "/lobby";
        }
      }, 500);
    } catch (error) {
      console.error("방 퇴장에 실패했습니다:", error);
      // 오류가 발생해도 로비로 이동 시도
      window.location.href = "/lobby";
    }
  };

  // 페이지 로드 시 방 페이지에 들어왔다는 플래그 설정
  useEffect(() => {
    // 방 페이지 로드 시 beforeunload 경고 비활성화 플래그 설정
    // URL로 직접 접근 시에도 작동하도록 함
    localStorage.setItem('intentional_navigation', 'true');
  }, []);

  // 컴포넌트 언마운트 시 구독 해제 및 소켓 연결 종료
  useEffect(() => {
    return () => {
      try {
        // 채팅 구독 해제
        unsubscribe(`/topic/room/chat/${roomId}`);
        
        // 방 상태 구독 해제
        unsubscribe(`/topic/room/${roomId}/status`);
        
        // 방장 변경 이벤트 구독 해제
        unsubscribe(`/topic/room/${roomId}/owner/change`);
        
        // 퀴즈 생성 상태 구독 해제
        unsubscribe(`/topic/room/${roomId}/quiz/generation`);
        
        console.log("WebSocket 구독 해제 완료");
      } catch (e) {
        console.error("WebSocket 구독 해제 중 오류 발생:", e);
      }
    };
  }, [roomId]);

  // 브라우저 탭 닫기/새로고침/페이지 이동 시 방 퇴장 처리
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 사용자가 방에 있는 경우에만 퇴장 메시지 전송
      if (currentUserId && room?.id) {
        // 동기적으로 방 퇴장 메시지 전송
        console.log("페이지 이탈 감지, 방 퇴장 메시지 전송");
        
        // 서버에 방 퇴장 메시지 전송 (비동기 요청을 동기적으로 처리)
        const leaveMessage = JSON.stringify({
          type: "LEAVE",
          playerId: currentUserId,
          playerName: currentUser?.nickname || "알 수 없음",
          timestamp: Date.now()
        });

        // 네비게이트 비콘 API를 사용하여 페이지를 떠날 때도 요청이 전송되도록 함
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            `${process.env.NEXT_PUBLIC_WAS_HOST}/api/v1/rooms/${room.id}/leave-with-id?userId=${currentUserId}`,
            new Blob([leaveMessage], { type: 'application/json' })
          );
        } else {
          // sendBeacon을 지원하지 않는 브라우저를 위한 대체 방법
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${process.env.NEXT_PUBLIC_WAS_HOST}/api/v1/rooms/${room.id}/leave-with-id?userId=${currentUserId}`, false); // 동기 요청
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(leaveMessage);
        }
      }
    };

    // 이벤트 리스너 등록
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUserId, currentUser, room]);

  // 페이지 이동 감지 및 방 퇴장 처리
  useEffect(() => {
    let isLeaving = false;

    // 방 입장 시 상태 초기화
    const initRoom = async () => {
      try {
        const userData = await fetchCurrentUser();
        if (userData) {
          await fetchRoomData();
          
          // 플레이어 목록에 현재 사용자 아바타 URL 강제 적용
          setTimeout(() => {
            if (userData.avatarUrl) {
              setPlayers(prevPlayers => {
                return prevPlayers.map(player => {
                  if (player.id === String(userData.id)) {
                    console.log(`아바타 URL 강제 적용: ${userData.nickname}, ${userData.avatarUrl}`);
                    return {
                      ...player,
                      avatarUrl: userData.avatarUrl
                    };
                  }
                  return player;
                });
              });
            }
          }, 500); // 플레이어 목록이 로딩된 후 적용
          
          console.log("방 입장 처리 완료");
        }
      } catch (error) {
        console.error("방 입장 초기화 중 오류:", error);
      }
    };

    initRoom();

    // 컴포넌트 언마운트 시 방 퇴장 처리
    return () => {
      if (isLeaving) return; // 이미 퇴장 처리 중이면 중복 실행 방지
      isLeaving = true;

      if (currentUserId && roomId) {
        console.log("컴포넌트 언마운트, 방 퇴장 처리");
        
        try {
          // 방 퇴장 메시지 전송
          const leaveMessage = JSON.stringify({
            type: "LEAVE",
            playerId: currentUserId,
            playerName: currentUser?.nickname || "알 수 없음",
            timestamp: Date.now()
          });
          
          // stompClient를 통해 퇴장 메시지 발행 (동기식으로 처리하기 위한 시도)
          publish(`/app/room/${roomId}/leave`, leaveMessage);
          
          // 직접 API 호출로 방 나가기 요청
          fetch(`${process.env.NEXT_PUBLIC_WAS_HOST}/api/v1/rooms/${roomId}/leave-with-id?userId=${currentUserId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: leaveMessage,
            // 가능한 한 요청이 완료될 때까지 기다리도록 함
            keepalive: true
          }).catch(e => console.error("방 퇴장 API 호출 실패:", e));
          
          console.log("방 퇴장 메시지 전송 완료");
        } catch (error) {
          console.error("방 퇴장 처리 중 오류:", error);
        }
      }
    };
  }, [roomId]);

  // 게임 시작 쿨다운 타이머 관리
  useEffect(() => {
    // 방장인 경우에만 타이머 적용
    if (!isOwner) return;
    
    // 컴포넌트 마운트 시 마지막 시작 시간 확인
    const checkCooldown = () => {
      const lastStartTime = parseInt(sessionStorage.getItem('lastGameStartTime') || '0');
      const currentTime = Date.now();
      const cooldownTime = 5000; // 3초 (startGame 함수와 동일하게 유지)
      const remainingTime = Math.max(0, cooldownTime - (currentTime - lastStartTime));
      
      if (remainingTime > 0) {
        setIsGameStartCooldown(true);
        setGameStartCooldownRemaining(remainingTime);
      } else {
        setIsGameStartCooldown(false);
        setGameStartCooldownRemaining(0);
      }
    };
    
    // 초기 확인
    checkCooldown();
    
    // 100ms마다 상태 체크
    const timer = setInterval(checkCooldown, 100);
    
    return () => clearInterval(timer);
  }, [isOwner]);

  // 준비 버튼 쿨다운 타이머 관리 (게임 시작 쿨다운 타이머 관리 바로 아래에 추가)
  useEffect(() => {
    // 방장이 아닌 경우에만 타이머 적용
    if (isOwner) return;
    
    // 컴포넌트 마운트 시 마지막 토글 시간 확인
    const checkCooldown = () => {
      const lastToggleTime = parseInt(sessionStorage.getItem('lastReadyToggleTime') || '0');
      const currentTime = Date.now();
      const cooldownTime = 1500; // 1.5초 (toggleReady 함수와 동일하게 유지)
      const remainingTime = Math.max(0, cooldownTime - (currentTime - lastToggleTime));
      
      if (remainingTime > 0) {
        setIsReadyCooldown(true);
        setReadyCooldownRemaining(remainingTime);
      } else {
        setIsReadyCooldown(false);
        setReadyCooldownRemaining(0);
      }
    };
    
    // 초기 확인
    checkCooldown();
    
    // 100ms마다 상태 체크
    const timer = setInterval(checkCooldown, 100);
    
    return () => clearInterval(timer);
  }, [isOwner]);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
  console.log("컴포넌트 마운트, 방 ID:", roomId);
  let isLeaving = false;
  
  // 방 입장 시 초기화 수행
  const initRoom = async () => {
    try {
      // 1. 방 정보 불러오기
      await fetchRoomData();
      
      // 2. 현재 사용자 정보 불러오기
      const userData = await fetchCurrentUser();
      
      if (!userData) {
        console.error("사용자 정보를 가져오는데 실패했습니다.");
        setError("사용자 정보를 불러오는데 실패했습니다. 로그인 후 다시 시도해주세요.");
        return;
      }
      
      console.log("방 입장 - 현재 사용자:", userData.nickname, "아바타:", userData.avatarUrl);
      
      // 아바타 URL이 없으면 기본 아바타 설정
      if (!userData.avatarUrl) {
        userData.avatarUrl = DEFAULT_AVATAR;
        console.log("기본 아바타 설정:", DEFAULT_AVATAR);
      }
      
      // 현재 사용자 ID는 정수형이 원본이므로 비교를 위해 문자열로 변환
      const currentUserIdStr = String(userData.id);
      
      // 방장 여부 설정 (수동으로 방장 여부 체크)
      if (room && room.ownerId === userData.id) {
        setIsOwner(true);
        console.log("현재 사용자는 방장입니다.");
      }
      
      // 3. 웹소켓 설정
      setupWebSocket();
      
      // 4. 초기 메시지 추가
      setChatMessages(prev => [
        ...prev, 
        {
          type: "SYSTEM",
          content: "채팅에 연결되었습니다.",
          senderId: "system",
          senderName: "System",
          timestamp: Date.now(),
          roomId: roomId
        }
      ]);
      
      // 5. 잠시 후 플레이어 목록에 현재 플레이어 존재 여부 체크하고 아바타 강제 업데이트
      setTimeout(() => {
        if (userData) {
          // 플레이어 목록에 현재 사용자 아바타 강제 적용
          setPlayers(prevPlayers => {
            // 로그 추가
            console.log("플레이어 목록 현재 상태:", prevPlayers.map(p => `${p.id} (${p.nickname}): ${p.avatarUrl}`));
            
            return prevPlayers.map(player => {
              if (player.id === String(userData.id)) {
                console.log(`아바타 URL 강제 적용: ${userData.nickname}, ${userData.avatarUrl}`);
                return {
                  ...player,
                  avatarUrl: userData.avatarUrl || DEFAULT_AVATAR
                };
              }
              return player;
            });
          });
        }
      }, 500); // 플레이어 목록이 로딩된 후 적용
      
      console.log("방 입장 처리 완료");
    } catch (error) {
      console.error("방 입장 초기화 중 오류:", error);
    }
  };
  
  initRoom();
  }, [roomId]);

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
          
          {/* 메인 컨텐츠 영역 - 게임 중이면 게임 화면, 대기 중이면 기존 플레이어 목록 표시 */}
          {(gameStatus === 'IN_GAME' || room?.status === 'IN_GAME') ? (
            <div className="flex-grow bg-gray-800/20 rounded-2xl overflow-hidden">
              <GameContainer 
                roomId={roomId} 
                players={players}
                room={room}
                currentUserId={currentUser?.id}
                onGameEnd={() => setGameStatus('WAITING')}
                publish={publish}
                subscribe={subscribe}
                unsubscribe={unsubscribe}
                leaveRoom={leaveRoom}
              />
            </div>
          ) : (
            <>
              {/* 기존 대기실 UI (플레이어 목록, 채팅 등) */}
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
                <div className={`md:w-1/3 flex-shrink-0 ${activeTab !== 'players' && 'hidden md:block'}`}>
                  <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 h-full">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <FaUsers className="mr-2" />
                      참가자 {players.length}명
                    </h2>
                    
                    <div className="space-y-3 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
                      {players.map(player => (
                        <div 
                          key={player._uniqueId || player.id}
                          className={`flex items-center p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 ${
                            player.id === currentUser?.id.toString() ? 'bg-blue-900/20 border-blue-500/50' : ''
                          }`}
                        >
                          <div className="relative">
                            <img 
                              src={player.id === String(currentUser?.id) ? currentUser?.avatarUrl : player.avatarUrl || DEFAULT_AVATAR} 
                              alt={player.nickname} 
                              className="w-10 h-10 rounded-full"
                              onError={(e) => { 
                                (e.target as HTMLImageElement).src = DEFAULT_AVATAR; 
                              }}
                            />
                            {player.isOwner && (
                              <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full w-5 h-5 flex items-center justify-center">
                                <FaCrown className="text-yellow-900 text-xs" />
                              </div>
                            )}
                          </div>
                          <div className="ml-3 flex-grow">
                            <div className="font-medium text-white flex items-center">
                              {player.nickname}
                              {player.id === currentUser?.id.toString() && (
                                <span className="ml-2 text-xs text-blue-400">(나)</span>
                              )}
                            </div>
                          </div>
                          <div>
                            {player.isReady ? (
                              <div className="bg-green-600/30 text-green-400 px-2 py-1 rounded text-xs font-medium">
                                <FaCheck className="inline-block mr-1" />
                                준비완료
                              </div>
                            ) : player.isOwner ? (
                              <div className="bg-yellow-600/30 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                                방장
                              </div>
                            ) : (
                              <div className="bg-gray-600/30 text-gray-400 px-2 py-1 rounded text-xs font-medium">
                                대기중
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* 채팅창 */}
                <div className={`md:flex-1 flex flex-col ${activeTab !== 'chat' && 'hidden md:flex'}`}>
                  <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 flex flex-col h-full">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <FaComments className="mr-2" />
                      채팅
                    </h2>
                    
                    {/* 채팅 메시지 영역 */}
                    <div 
                      ref={chatContainerRef}
                      className="flex-grow space-y-3 overflow-y-auto max-h-[calc(100vh-400px)] pr-1 mb-4"
                    >
                      {chatMessages.map((msg, index) => {
                        // JSON 문자열인지 확인하고 파싱
                        let displayMsg = { ...msg };
                        
                        if (typeof msg.content === 'string' && (
                            msg.content.startsWith('{') || 
                            msg.content.startsWith('{"type":')
                          )) {
                          try {
                            // JSON 형식이면 파싱
                            const parsedContent = JSON.parse(msg.content);
                            if (parsedContent.content) {
                              displayMsg.content = parsedContent.content;
                            }
                          } catch (e) {
                            // 파싱 실패시 원본 메시지 유지
                            console.warn("JSON 파싱 실패:", e);
                          }
                        }

                        return (
                          <div key={index} className={`${msg.type === 'SYSTEM' ? 'flex justify-center' : 'flex items-start'}`}>
                            {msg.type === 'SYSTEM' ? (
                              <div className="bg-gray-700/40 text-gray-300 px-3 py-1.5 rounded-md text-sm text-center max-w-[80%]">
                                {displayMsg.content}
                              </div>
                            ) : (
                              <>
                                {/* 아바타 표시 - 내 메시지일 때는 항상 현재 사용자 아바타 사용 */}
                                <img 
                                  src={
                                    // 내 메시지인지 확인 (ID가 같은지, 이름이 같은지)
                                    msg.senderId === String(currentUser?.id) ||
                                    msg.senderName === currentUser?.nickname 
                                      ? currentUser?.avatarUrl || DEFAULT_AVATAR // 내 아바타
                                      : msg.avatarUrl || DEFAULT_AVATAR // 원래 메시지의 아바타
                                  } 
                                  alt={msg.senderName} 
                                  className="w-8 h-8 rounded-full mr-2 mt-1" 
                                  onError={(e) => { 
                                    console.log("아바타 로딩 실패:", e);
                                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR; 
                                  }}
                                />
                                <div className={`max-w-[70%] ${
                                  // 내 메시지인지 확인 (ID가 같은지, 이름이 같은지)
                                  msg.senderId === String(currentUser?.id) ||
                                  msg.senderName === currentUser?.nickname 
                                    ? 'bg-blue-600/40 text-blue-100' 
                                    : 'bg-gray-700/60 text-white'
                                } px-3 py-2 rounded-lg`}>
                                  <div className="text-xs text-gray-300 mb-1 flex justify-between">
                                    <span>{msg.senderName}</span>
                                    <span className="ml-4 opacity-70">
                                      {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                      })}
                                    </span>
                                  </div>
                                  <div className="text-sm break-words">{displayMsg.content}</div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 채팅 입력 영역 */}
                    <div className="flex items-center">
                      <input
                        type="text"
                        placeholder="메시지를 입력하세요..."
                        className="flex-grow px-4 py-2 bg-gray-700/50 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newChatMessage}
                        onChange={(e) => setNewChatMessage(e.target.value)}
                        onKeyDown={handleChatKeyDown}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                      />
                      <button
                        className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={handleSendChatMessage}
                      >
                        전송
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 하단 버튼 영역 */}
              <div className="mt-5 flex justify-center gap-4">
                {isOwner ? (
                  // 방장이면 시작 버튼
                  <button
                    className={`bg-gradient-to-r ${
                      isGameStartCooldown
                        ? 'from-gray-500 to-gray-600 cursor-not-allowed'
                        : players.filter(p => !p.isOwner).every(p => p.isReady)
                          ? 'from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700'
                          : 'from-indigo-400 to-blue-400 opacity-50 cursor-not-allowed'
                    } text-white px-8 py-3 rounded-xl font-medium transition-all shadow-md`}
                    onClick={startGame}
                    disabled={isGameStartCooldown || !players.filter(p => !p.isOwner).every(p => p.isReady)}
                  >
                    {isGameStartCooldown ? (
                      <>
                        <FaHourglass className="inline-block mr-2 animate-pulse" />
                        대기 중... ({Math.ceil(gameStartCooldownRemaining / 1000)}초)
                      </>
                    ) : (
                      <>
                        <FaPlay className="inline-block mr-2" />
                        게임 시작
                      </>
                    )}
                  </button>
                ) : (
                  // 일반 사용자면 준비 버튼
                  <button
                    className={`${
                      isReadyCooldown
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        : isReady
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                    } text-white px-8 py-3 rounded-xl font-medium transition-all shadow-md`}
                    onClick={toggleReady}
                    disabled={isReadyCooldown}
                  >
                    {isReadyCooldown ? (
                      <>
                        <FaHourglass className="inline-block mr-2 animate-pulse" />
                        대기 중... ({Math.ceil(readyCooldownRemaining / 1000)}초)
                      </>
                    ) : isReady ? (
                      <>
                        <FaCheck className="inline-block mr-2" />
                        준비 완료
                      </>
                    ) : (
                      <>
                        <FaBrain className="inline-block mr-2" />
                        준비하기
                      </>
                    )}
                  </button>
                )}
                
                {/* 나가기 버튼 추가 */}
                <button
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-md flex items-center"
                  onClick={leaveRoom}
                >
                  <FaDoorOpen className="mr-2" />
                  나가기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
} 