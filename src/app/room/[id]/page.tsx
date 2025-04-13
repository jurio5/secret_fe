"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { subscribe, unsubscribe, publish, reconnectWebSocket, isConnected } from "@/lib/backend/stompClient";
import Image from "next/image";
import { FaChevronLeft, FaDoorOpen, FaCrown, FaCheck, FaComments, FaUsers, FaInfoCircle, FaPlay } from "react-icons/fa";
import { RoomResponse, PlayerProfile, RoomStatus, RoomMessageType } from "../../../lib/types/room";
import PlayerList from "@/components/room/PlayerList";
import RoomHeader from "@/components/room/RoomHeader";

// API 응답 타입
type ApiResponse<T> = {
  error?: {
    message?: string;
  };
  data?: {
    data: T;
  };
};

// 기본 프로필 이미지 URL
const DEFAULT_PROFILE_IMAGE = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<RoomStatus>("WAITING");
  const [activeTab, setActiveTab] = useState<'players' | 'chat'>('players');
  
  // 플레이어 목록 초기화 여부 추적
  const playersInitialized = useRef<boolean>(false);
  
  // 채팅 관련 상태
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState<string>("");
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 디버깅 컨트롤
  const debug = (message: string, data?: any) => {
    console.log(`[디버그] ${message}`, data || '');
  };

  // 방장 확인 헬퍼 함수
  const isUserRoomOwner = (roomData: RoomResponse | null, userId: number | null): boolean => {
    if (!roomData || !userId) return false;
    
    // 두 값을 문자열로 변환하여 비교
    const roomOwnerId = roomData.ownerId?.toString();
    const userIdStr = userId.toString();
    
    const isOwner = roomOwnerId === userIdStr;
    debug("방장 확인 로직", {
      userId: userIdStr,
      roomOwnerId: roomOwnerId,
      isOwner: isOwner
    });
    
    return isOwner;
  };

  // 방 정보 불러오기
  const fetchRoomData = async () => {
    setLoading(true);
    try {
      debug("방 정보 요청 시작", roomId);
      const response = await (client.GET as any)(`/api/v1/rooms/${roomId}`, {}) as ApiResponse<RoomResponse>;
      
      if (response.error) {
        setError(response.error.message || "방 정보를 불러오는데 실패했습니다.");
        return;
      }
      
      if (response.data?.data) {
        const roomData = response.data.data;
        debug("방 정보 로드 성공", roomData);
        setRoom(roomData);
        
        // 방장 여부 확인 - 헬퍼 함수 사용
        const isCurrentUserOwner = isUserRoomOwner(roomData, currentUserId);
        setIsOwner(isCurrentUserOwner);
        
        if (isCurrentUserOwner) {
          debug("현재 사용자는 방장입니다");
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
      debug("사용자 정보 요청 시작");
      const response = await client.GET("/api/v1/members/me", {}) as any;
      
      if (response.error) {
        console.error("사용자 정보를 가져오는데 실패했습니다:", response.error);
        return null;
      }
      
      if (response.data?.data) {
        const userData = response.data.data;
        debug("사용자 정보 로드 성공", userData);
        
        setCurrentUserId(userData.id);
        setCurrentUser(userData);
        
        // 방장 여부 확인 (room이 이미 로드된 경우) - 헬퍼 함수 사용
        if (room) {
          const isCurrentUserOwner = isUserRoomOwner(room, userData.id);
          setIsOwner(isCurrentUserOwner);
          
          if (isCurrentUserOwner) {
            debug("현재 사용자는 방장입니다");
          }
        }
        
        return userData;
      }
      return null;
    } catch (error) {
      console.error("사용자 정보를 가져오는데 실패했습니다:", error);
      return null;
    }
  };

  // 웹소켓 구독 설정
  const setupWebSocket = () => {
    debug("웹소켓 구독 설정", roomId);

    // 먼저 이전 구독이 있다면 정리
    unsubscribe(`/topic/room/${roomId}`);
    unsubscribe(`/topic/player/${roomId}`);
    unsubscribe(`/topic/room/chat/${roomId}`);
    unsubscribe(`/topic/chat/room/${roomId}`);
    unsubscribe(`/topic/game/chat/${roomId}`);
    
    // 웹소켓 연결이 완전히 준비될 때까지 약간의 지연 추가
    const trySubscribe = (retryCount = 0, maxRetries = 3) => {
      if (!isConnected()) {
        if (retryCount < maxRetries) {
          debug(`웹소켓 연결 대기 중... (${retryCount + 1}/${maxRetries + 1})`);
          // 500ms 후 재시도
          setTimeout(() => trySubscribe(retryCount + 1, maxRetries), 500);
          return;
        }
        
        // 최대 재시도 횟수 초과
        debug("웹소켓 연결 실패, 재연결 시도");
        const reconnected = reconnectWebSocket();
        if (!reconnected) {
          debug("웹소켓 재연결 실패, 구독 설정 중단");
          setError("웹소켓 연결에 실패했습니다. 페이지를 새로고침해주세요.");
          return false;
        }
        
        // 재연결 후 구독을 위해 약간의 지연
        setTimeout(() => performSubscriptions(), 1000);
      } else {
        performSubscriptions();
      }
    };
    
    // 실제 구독 로직
    const performSubscriptions = () => {
      debug("구독 설정 시작");
      
      try {
        // 방 정보 업데이트 구독
        subscribe(`/topic/room/${roomId}`, (data) => {
          debug("방 정보 업데이트 수신", data);
          
          // 타입이 있는 경우 (WebSocketRoomMessageResponse 형식)
          if (data && data.type) {
            debug(`메시지 타입: ${data.type}`);
            
            // JOIN, LEAVE, READY 이벤트 발생 시 서버에서 최신 플레이어 목록 조회
            if (data.type === 'JOIN' || data.type === 'LEAVE' || data.type === 'READY') {
              // 1초 후 서버에서 최신 정보 조회 (이벤트 처리 시간 고려)
              setTimeout(async () => {
                try {
                  debug(`${data.type} 이벤트 발생, 서버에서 최신 정보 조회`);
                  const response = await (client.GET as any)(`/api/v1/rooms/${roomId}`, {}) as ApiResponse<RoomResponse>;
                  
                  if (response.error) {
                    console.error("방 정보 갱신 실패:", response.error);
                    return;
                  }
                  
                  if (response.data?.data) {
                    const roomData = response.data.data;
                    debug("서버에서 최신 방 정보 로드 성공", roomData);
                    
                    // 방 정보 업데이트
                    setRoom(roomData);
                    
                    // players 필드가 있으면 사용 (빈 배열이어도 그대로 사용)
                    const playersData = roomData.players || [];
                    debug("플레이어 목록:", playersData);
                    
                    // 빈 배열이어도 처리 (플레이어가 없는 상태)
                    const formattedPlayers: PlayerProfile[] = playersData.map((player: any) => {
                      // ID가 숫자면 문자열로 변환
                      const id = typeof player.id === 'number' ? String(player.id) : player.id;
                      
                      // 방장 여부 확인 - boolean 타입으로 명시적 변환
                      const isPlayerOwner = Boolean(player.isOwner === true || 
                        (roomData.ownerId && id === roomData.ownerId.toString()));
                      
                      return {
                        id,
                        nickname: player.nickname || player.name || '사용자',
                        profileImage: player.profileImage || player.avatarUrl || DEFAULT_PROFILE_IMAGE,
                        isOwner: isPlayerOwner,
                        ready: Boolean(player.ready || player.isReady),
                        status: player.status || "WAITING",
                        score: player.score || 0
                      };
                    });
                    
                    // 현재 유저가 목록에 없고 방에 입장 중인 경우 자신을 추가
                    if (formattedPlayers.length === 0 && currentUserId) {
                      const isCurrentUserOwner = isUserRoomOwner(roomData, currentUserId);
                      const selfPlayer: PlayerProfile = {
                        id: currentUserId.toString(),
                        nickname: currentUser?.nickname || "사용자",
                        profileImage: currentUser?.profileImage || DEFAULT_PROFILE_IMAGE,
                        isOwner: isCurrentUserOwner,
                        ready: isReady,
                        status: "WAITING",
                        score: 0
                      };
                      formattedPlayers.push(selfPlayer);
                      debug("플레이어 목록이 비어있어 자신을 추가", selfPlayer);
                    }
                    
                    setPlayers(formattedPlayers);
                    debug("플레이어 목록 업데이트 완료", formattedPlayers);
                    
                    // 방장 여부 업데이트
                    if (roomData.ownerId && currentUserId) {
                      const isCurrentUserOwner = isUserRoomOwner(roomData, currentUserId);
                      setIsOwner(isCurrentUserOwner);
                    }
                  }
                } catch (error) {
                  console.error("최신 방 정보 조회 중 오류:", error);
                }
              }, 1000);
            }
            
            // 기존 room 정보 업데이트 코드는 계속 유지
            if (data.type === 'ROOM_UPDATED' || data.type === 'JOIN' || data.type === 'LEAVE') {
              setRoom(prev => {
                if (!prev) return data;
                
                // 플레이어 수 계산을 위한 처리
                let updatedCurrentPlayers = prev.currentPlayers;
                
                if (data.type === 'JOIN') {
                  // 플레이어 입장 시 +1
                  updatedCurrentPlayers = (prev.currentPlayers || 0) + 1;
                  debug("플레이어 입장", { before: prev.currentPlayers, after: updatedCurrentPlayers });
                } else if (data.type === 'LEAVE') {
                  // 플레이어 퇴장 시 -1 (0 미만이 되지 않도록)
                  updatedCurrentPlayers = Math.max(0, (prev.currentPlayers || 1) - 1);
                  debug("플레이어 퇴장", { before: prev.currentPlayers, after: updatedCurrentPlayers });
                } else if (data.currentPlayers !== undefined) {
                  // 직접 currentPlayers 값이 제공되면 사용
                  updatedCurrentPlayers = data.currentPlayers;
                  debug("플레이어 수 직접 업데이트", { before: prev.currentPlayers, after: updatedCurrentPlayers });
                }
                
                // 방 정보와 플레이어 수 업데이트
                const updated = { 
                  ...prev, 
                  ...data,
                  currentPlayers: updatedCurrentPlayers 
                };
                
                debug("방 정보 업데이트 완료", {
                  id: updated.id,
                  title: updated.title,
                  currentPlayers: updated.currentPlayers,
                  capacity: updated.capacity,
                  owner: updated.ownerId || updated.owner
                });
                
                return updated;
              });
            }
            
            // 게임 상태 업데이트
            if (data.gameStatus || data.status) {
              const newStatus = data.gameStatus || data.status;
              debug("게임 상태 업데이트", newStatus);
              setGameStatus(newStatus as RoomStatus);
            }
          }
        });
      
        // 플레이어 상태 변경 구독
        subscribe(`/topic/player/${roomId}`, (data) => {
          debug("플레이어 상태 업데이트", data);
          
          if (data && data.id) {
            // 단일 플레이어 상태 업데이트
            setPlayers(prevPlayers => {
              const updatedPlayers = [...prevPlayers];
              const playerIndex = updatedPlayers.findIndex(p => p.id === data.id);
              
              if (playerIndex !== -1) {
                // 기존 플레이어 정보 유지하면서 새 정보 병합
                updatedPlayers[playerIndex] = {
                  ...updatedPlayers[playerIndex],
                  nickname: data.nickname || updatedPlayers[playerIndex].nickname,
                  profileImage: data.profileImage || data.avatarUrl || updatedPlayers[playerIndex].profileImage,
                  ready: data.ready !== undefined ? data.ready : data.isReady !== undefined ? data.isReady : updatedPlayers[playerIndex].ready,
                  isOwner: data.isOwner !== undefined ? data.isOwner : updatedPlayers[playerIndex].isOwner,
                  status: data.status || updatedPlayers[playerIndex].status,
                  score: data.score !== undefined ? data.score : updatedPlayers[playerIndex].score
                };
                
                // 현재 사용자의 상태가 변경된 경우 isReady 상태도 업데이트
                if (currentUserId && data.id === currentUserId.toString()) {
                  setIsReady(updatedPlayers[playerIndex].ready);
                }
              } else if (data.id) {
                // 새 플레이어 추가
                const newPlayer: PlayerProfile = {
                  id: data.id,
                  nickname: data.nickname || data.name || '사용자',
                  profileImage: data.profileImage || data.avatarUrl || DEFAULT_PROFILE_IMAGE,
                  isOwner: Boolean(data.isOwner),
                  ready: Boolean(data.ready || data.isReady),
                  status: data.status || "WAITING",
                  score: data.score || 0
                };
                
                updatedPlayers.push(newPlayer);
              }
              
              return updatedPlayers;
            });
          }
        });
      
        // 채팅 메시지 구독 - 1번 주소
        subscribe(`/topic/room/chat/${roomId}`, (data) => {
          debug("채팅 메시지 수신 (주소1)", data);
          handleChatMessage(data, "주소1");
        });
      
        // 채팅 메시지 구독 - 2번 주소 (대체 경로)
        subscribe(`/topic/chat/room/${roomId}`, (data) => {
          debug("채팅 메시지 수신 (주소2)", data);
          handleChatMessage(data, "주소2");
        });
      
        // 채팅 메시지 구독 - 3번 주소 (게임 채팅 경로)
        subscribe(`/topic/game/chat/${roomId}`, (data) => {
          debug("채팅 메시지 수신 (주소3)", data);
          handleChatMessage(data, "주소3");
        });
        
        debug("구독 설정 완료");
        return true;
      } catch (error) {
        console.error("구독 설정 중 오류 발생:", error);
        debug("구독 설정 실패");
        return false;
      }
    };
    
    // 구독 시도 시작
    trySubscribe();
    return true;
  };

  // 채팅 메시지 처리 공통 함수
  const handleChatMessage = (data: any, source: string) => {
    console.warn(`채팅 메시지 수신 [${source}]:`, data);
    
    try {
      // 테스트: 모든 수신 메시지를 강제로 채팅에 표시
      const rawMessage = {
        senderId: "system",
        senderName: `시스템 (${source})`,
        content: typeof data === 'string' ? data : JSON.stringify(data),
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, rawMessage]);
      
      // 서버에서 받은 데이터 형식이 다양할 수 있으므로 처리
      let chatData = data;
      
      // 문자열이면 JSON으로 파싱
      if (typeof data === 'string') {
        try {
          chatData = JSON.parse(data);
          debug("채팅 메시지 파싱 결과", chatData);
        } catch (e) {
          console.error("채팅 메시지 파싱 실패:", e);
          return;
        }
      }
      
      // 필요한 필드가 있는지 확인
      debug("채팅 메시지 데이터 검사", {
        hasData: !!chatData,
        source,
        type: chatData?.type,
        content: chatData?.content,
        senderId: chatData?.senderId,
        senderName: chatData?.senderName
      });
      
      if (chatData && chatData.content) {
        const chatMessage = {
          senderId: chatData.senderId || chatData.userId || "unknown",
          senderName: chatData.senderName || chatData.username || "사용자",
          content: chatData.content || chatData.message || "내용 없음",
          timestamp: chatData.timestamp || Date.now()
        };
        
        debug("채팅 메시지 추가", chatMessage);
        setChatMessages(prev => [...prev, chatMessage]);
        
        // 채팅 자동 스크롤
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 100);
      } else {
        debug("처리할 수 없는 채팅 메시지 형식", chatData);
      }
    } catch (error) {
      console.error("채팅 메시지 처리 중 오류:", error);
    }
  };

  // 방 나가기
  const leaveRoom = async () => {
    try {
      debug("방 나가기 요청", roomId);
      await (client.POST as any)(`/api/v1/rooms/${roomId}/leave`, {});
      window.location.href = '/lobby';
    } catch (error) {
      console.error("방을 나가는데 실패했습니다:", error);
      // 오류가 발생해도 로비로 이동
      window.location.href = '/lobby';
    }
  };

  // 준비 상태 토글
  const toggleReady = async () => {
    // 백엔드는 토글 API를 사용함
    try {
      debug("준비 상태 토글 요청", {roomId, currentState: isReady});
      const response = await (client.POST as any)(`/api/v1/rooms/${roomId}/ready`, {});
      
      if (response.error) {
        console.error("준비 상태 변경에 실패했습니다:", response.error);
        return;
      }
      
      // 성공 시 로컬 상태 업데이트
      const newReadyState = !isReady;
      debug("준비 상태 변경 성공", {before: isReady, after: newReadyState});
      setIsReady(newReadyState);
      
      // 플레이어 목록에서 현재 사용자 상태 업데이트
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.id === currentUserId?.toString()
            ? { ...player, ready: newReadyState }
            : player
        )
      );
    } catch (error) {
      console.error("준비 상태 변경에 실패했습니다:", error);
    }
  };

  // 게임 시작
  const startGame = async () => {
    if (!isOwner) {
      console.warn("방장만 게임을 시작할 수 있습니다.");
      return;
    }
    
    debug("게임 시작 요청", {roomId, isOwner});
    
    try {
      const response = await (client.POST as any)(`/api/v1/rooms/${roomId}/start`, {});
      
      if (response.error) {
        console.error("게임 시작에 실패했습니다:", response.error);
        return;
      }
      
      debug("게임 시작 요청 성공");
      // 게임 시작 요청 후 WebSocket으로 상태 변경을 감지하므로 추가 조치 필요 없음
    } catch (error) {
      console.error("게임 시작에 실패했습니다:", error);
    }
  };

  // 채팅 메시지 전송
  const handleSendChatMessage = () => {
    if (!newChatMessage.trim() || isComposing) return;
    
    const message = newChatMessage.trim();
    setNewChatMessage("");
    
    try {
      debug("채팅 메시지 전송", {roomId, message});
      
      // 서버에서는 /app/room/chat/{roomId} 형식으로 처리
      publish(`/app/room/chat/${roomId}`, message);
      debug(`메시지 전송 완료: ${message}`);
      
      // 채팅 화면에 바로 표시 (낙관적 업데이트)
      const localMessage = {
        senderId: currentUserId,
        senderName: currentUser?.nickname || "나",
        content: message,
        timestamp: Date.now()
      };
      
      setChatMessages(prev => [...prev, localMessage]);
    } catch (error) {
      console.error("채팅 메시지 전송 실패:", error);
    }
  };

  // 채팅 입력 키 이벤트 처리
  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendChatMessage();
    }
  };

  // IME 조합 시작 (한글, 일본어, 중국어 등)
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  // IME 조합 종료
  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  // 초기 로딩
  useEffect(() => {
    const loadData = async () => {
      try {
        debug("초기 데이터 로딩 시작");
        
        // 웹소켓 연결 상태 확인 및 필요시 재연결
        if (!isConnected()) {
          debug("웹소켓 연결 확인 - 연결 안됨, 재연결 시도");
          const reconnected = reconnectWebSocket();
          if (!reconnected) {
            debug("웹소켓 재연결 실패");
            // 페이지 로드 초기에 재연결 실패 시 바로 에러 표시하지 않고
            // 사용자 정보와 방 정보 로드 후 구독 설정에서 다시 시도
            console.warn("웹소켓 재연결 실패, 사용자/방 정보 로드 후 다시 시도");
          } else {
            debug("웹소켓 재연결 성공");
            // 재연결 후 연결이 완전히 설정될 때까지 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          debug("웹소켓 연결 확인 - 이미 연결됨");
        }
        
        // 사용자 정보 로드
        const user = await fetchCurrentUser();
        if (!user) {
          setError("사용자 정보를 가져올 수 없습니다. 로그인이 필요합니다.");
          return;
        }
        
        // 방 정보 로드
        await fetchRoomData();
        
        // 구독 설정 - 최대 3번 시도
        let wsSetupSuccess = false;
        for (let i = 0; i < 3; i++) {
          debug(`웹소켓 구독 설정 시도 ${i + 1}/3`);
          wsSetupSuccess = setupWebSocket();
          if (wsSetupSuccess) {
            debug("구독 설정 성공");
            break;
          }
          
          // 설정 실패 시 1초 대기 후 재시도
          debug("구독 설정 실패, 재시도...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (!wsSetupSuccess) {
          debug("여러 번의 시도 후에도 구독 설정 실패");
          setError("실시간 업데이트 연결에 실패했습니다. 페이지를 새로고침하거나 다시 시도해주세요.");
        } else {
          debug("초기 데이터 로딩 및 웹소켓 설정 완료");
        }
      } catch (error) {
        console.error("데이터 로딩 중 오류:", error);
        setError("데이터를 로딩하는 중 오류가 발생했습니다.");
      }
    };

    loadData();

    // 컴포넌트 언마운트 시 WebSocket 연결 해제
    return () => {
      debug("웹소켓 구독 해제", roomId);
      unsubscribe(`/topic/room/${roomId}`);
      unsubscribe(`/topic/player/${roomId}`);
      unsubscribe(`/topic/room/chat/${roomId}`);
      unsubscribe(`/topic/chat/room/${roomId}`);
      unsubscribe(`/topic/game/chat/${roomId}`);
    };
  }, [roomId]);

  // 채팅 스크롤 자동화
  useEffect(() => {
    if (chatContainerRef.current && chatMessages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  // 방장 상태 변경 시 로그
  useEffect(() => {
    debug("방장 상태 변경", {isOwner, currentUserId});
  }, [isOwner, currentUserId]);

  // 방 정보 로드 완료 후 플레이어 목록 초기화 (필요시)
  useEffect(() => {
    if (room && currentUserId && !playersInitialized.current && players.length === 0) {
      debug("초기 플레이어 목록 설정");
      
      // 방장 여부 다시 확인 - ownerId 필드 사용
      const isCurrentUserOwner = isUserRoomOwner(room, currentUserId);
      if (isCurrentUserOwner) {
        setIsOwner(true);
        debug("사용자가 방장임을 확인 (초기 플레이어 설정)", {
          currentUserId: currentUserId,
          roomOwnerId: room.ownerId,
          isOwner: isCurrentUserOwner
        });
      }
      
      // 자신을 플레이어로 추가
      const userPlayer: PlayerProfile = {
        id: currentUserId.toString(),
        nickname: currentUser?.nickname || "사용자",
        profileImage: currentUser?.profileImage || DEFAULT_PROFILE_IMAGE,
        isOwner: isCurrentUserOwner,
        ready: false,
        status: "WAITING"
      };
      
      setPlayers([userPlayer]);
      playersInitialized.current = true;
      debug("초기 플레이어 정보 설정", userPlayer);
      
      // 방 인원 수 설정 (초기화)
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentPlayers: 1 // 자기 자신 한 명
        };
      });
    }
  }, [room, currentUserId, currentUser, players.length]);

  // 에러 발생 시 표시
  if (error) {
    return (
      <AppLayout showHomeButton={false}>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center p-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p className="font-bold mb-2">오류 발생</p>
            <p>{error}</p>
          </div>
          <button 
            onClick={() => window.location.href = '/lobby'} 
            className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            로비로 돌아가기
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHomeButton={false} showBeforeUnloadWarning={true}>
      <div className="flex flex-col h-full max-w-7xl mx-auto">
        {/* 방 헤더 */}
        <RoomHeader room={room} />
        
        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 플레이어 목록 또는 채팅 (모바일에서는 탭으로 전환) */}
          <div className="md:hidden flex mb-4">
            <div className="w-full grid grid-cols-2 bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
              <button 
                onClick={() => setActiveTab('players')}
                className={`py-3 flex items-center justify-center transition-colors ${
                  activeTab === 'players' 
                    ? 'bg-indigo-800/50 text-white border-b-2 border-indigo-500' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <FaUsers className="mr-2" />
                플레이어 ({players.length})
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`py-3 flex items-center justify-center transition-colors ${
                  activeTab === 'chat' 
                    ? 'bg-indigo-800/50 text-white border-b-2 border-indigo-500' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <FaComments className="mr-2" />
                채팅
              </button>
            </div>
          </div>
          
          {/* 모바일에서는 선택된 탭만 표시 */}
          <div className={`md:block ${activeTab !== 'players' && 'hidden'}`}>
            <PlayerList players={players} currentUserId={currentUserId} />
          </div>
          
          {/* 게임 중앙 영역 - 게임 상태에 따라 다른 내용 표시 */}
          <div className="md:col-span-1 bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-6 flex flex-col">
            {gameStatus === "WAITING" ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">게임 대기 중</h2>
                  <p className="text-gray-400">
                    {isOwner 
                      ? "모든 플레이어가 준비되면 게임을 시작할 수 있습니다." 
                      : "방장이 게임을 시작하기를 기다리고 있습니다."}
                  </p>
                </div>
                
                {isOwner ? (
                  // 방장 전용 버튼
                  <button
                    onClick={startGame}
                    disabled={players.filter(p => !p.isOwner).some(p => !p.ready) || players.length < 2}
                    className={`flex items-center justify-center w-full max-w-xs px-6 py-3 rounded-xl text-lg font-medium transition-colors 
                      ${players.filter(p => !p.isOwner).some(p => !p.ready) || players.length < 2
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                      }`}
                  >
                    <FaPlay className="mr-2" />
                    게임 시작
                  </button>
                ) : (
                  // 일반 플레이어 버튼
                  <button
                    onClick={toggleReady}
                    className={`flex items-center justify-center w-full max-w-xs px-6 py-3 rounded-xl text-lg font-medium transition-colors 
                      ${isReady 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white' 
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                      }`}
                  >
                    {isReady 
                      ? <>준비 취소</>
                      : <><FaCheck className="mr-2" /> 준비 완료</>
                    }
                  </button>
                )}
                
                <div className="mt-8 text-gray-400 text-sm">
                  <p className="flex items-center justify-center">
                    <FaInfoCircle className="mr-2" />
                    {isOwner 
                      ? `최소 2명 이상의 플레이어가 필요하며, 모든 플레이어가 준비 완료해야 합니다.`
                      : `방장이 게임을 시작하기 전에 준비 버튼을 눌러주세요.`
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold mb-4">게임 진행 중</p>
                <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            )}
          </div>
          
          {/* 채팅 영역 - 데스크톱에서는 항상 표시, 모바일에서는 채팅 탭 선택 시만 표시 */}
          <div className={`md:block ${activeTab !== 'chat' && 'hidden'} bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-6 flex flex-col`}>
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <FaComments className="mr-2.5 text-indigo-400" />
              채팅
            </h2>
            
            {/* 채팅 메시지 목록 */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto mb-4 pr-2 space-y-2.5 min-h-[200px] max-h-[500px]"
            >
              {chatMessages.length === 0 && (
                <div className="p-4 bg-gray-800/50 rounded-lg text-gray-400 text-sm text-center">
                  채팅 메시지가 없습니다.
                </div>
              )}
              
              {chatMessages.map((message, index) => (
                <div key={index} className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 mr-2 overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center text-white font-medium bg-gradient-to-br from-blue-500 to-indigo-600">
                      {message.senderName ? message.senderName.charAt(0).toUpperCase() : '?'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-medium">{message.senderName || '익명'}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 채팅 입력 */}
            <div className="flex">
              <input
                type="text"
                value={newChatMessage}
                onChange={e => setNewChatMessage(e.target.value)}
                onKeyDown={handleChatKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder="메시지 입력..."
                className="flex-1 bg-gray-900/80 text-white border border-gray-700 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <button
                onClick={handleSendChatMessage}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-r-lg transition-colors"
              >
                전송
              </button>
            </div>
          </div>
        </div>
        
        {/* 하단 버튼 */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={leaveRoom}
              className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              <FaDoorOpen className="mr-2" />
              나가기
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
