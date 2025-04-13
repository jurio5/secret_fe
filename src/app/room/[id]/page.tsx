"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";
import { components } from "@/lib/backend/apiV1/schema";

// 방 정보 타입
type RoomResponse = components["schemas"]["RoomResponse"];

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

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

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
        const userId = response.data.data.id;
        setCurrentUserId(userId);
        
        // 방장 여부 확인
        if (room && room.ownerId === userId) {
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
    
    // 로비 사용자 목록 구독 추가
    subscribe("/topic/lobby/users", (data) => {
      console.log("로비 사용자 목록 업데이트:", data);
      // 방 페이지에서는 처리할 필요 없지만 구독은 유지
    });
    
    // 로비 상태 업데이트 구독 추가
    subscribe("/topic/lobby/status", (data) => {
      console.log("로비 상태 업데이트:", data);
      // 방 페이지에서는 처리할 필요 없지만 구독은 유지
    });
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
      
      console.log("방에 입장했습니다.");
    } catch (error) {
      console.error("방 입장에 실패했습니다:", error);
    }
  };

  // 준비 상태 토글
  const toggleReady = async () => {
    try {
      await (client.POST as any)(`/api/v1/rooms/${roomId}/ready`, {});
      setIsReady(!isReady);
      
      // 준비 상태 메시지 전송
      const messageType = isReady ? "UNREADY" : "READY";
      publish(`/app/rooms/${roomId}/ready`, {
        type: messageType,
        roomId: parseInt(roomId)
      });
    } catch (error) {
      console.error("준비 상태 변경에 실패했습니다:", error);
    }
  };

  // 게임 시작
  const startGame = async () => {
    if (!isOwner) {
      console.error("방장만 게임을 시작할 수 있습니다.");
      return;
    }
    
    try {
      await (client.POST as any)(`/api/v1/rooms/${roomId}/start`, {});
      
      // 게임 시작 메시지 전송
      publish(`/app/rooms/${roomId}/start`, {
        roomId: parseInt(roomId)
      });
      
      console.log("게임을 시작합니다!");
    } catch (error) {
      console.error("게임 시작에 실패했습니다:", error);
    }
  };

  // 방 퇴장
  const leaveRoom = async () => {
    try {
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
      unsubscribe("/topic/lobby/users");
      unsubscribe("/topic/lobby/status");
      
      // 로비로 리다이렉트
      window.location.href = "/lobby";
    } catch (error) {
      console.error("방 퇴장에 실패했습니다:", error);
    }
  };

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

  if (loading) {
    return (
      <AppLayout>
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
      <AppLayout>
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
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          {/* 방 정보 헤더 */}
          <div className="border-b border-gray-700 pb-4 mb-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">{room?.title}</h1>
              <div className="flex space-x-2">
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                  onClick={leaveRoom}
                >
                  나가기
                </button>
              </div>
            </div>
            <div className="mt-2 text-gray-400">
              <p>방장: {room?.ownerNickname}</p>
              <p>참가자: {room?.currentPlayers}/{room?.capacity}</p>
              <p>상태: {room?.status === 'WAITING' ? '대기중' : '게임중'}</p>
            </div>
          </div>

          {/* 플레이어 목록 */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">참가자 목록</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {players.map((player) => (
                <div 
                  key={player.id} 
                  className={`p-4 rounded-lg ${
                    player.isOwner 
                      ? 'bg-yellow-800' 
                      : player.isReady 
                        ? 'bg-green-800' 
                        : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0">
                      {player.avatarUrl && (
                        <img 
                          src={player.avatarUrl} 
                          alt={player.nickname} 
                          className="w-full h-full rounded-full"
                        />
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-white font-medium">{player.nickname}</p>
                      <p className="text-gray-400 text-sm">
                        {player.isOwner 
                          ? '방장' 
                          : player.isReady 
                            ? '준비 완료' 
                            : '준비 중'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex justify-center mt-6">
            {isOwner ? (
              <button
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-lg font-semibold"
                onClick={startGame}
                disabled={room?.status !== 'WAITING'}
              >
                게임 시작
              </button>
            ) : (
              <button
                className={`px-8 py-3 ${
                  isReady ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                } text-white rounded-lg transition text-lg font-semibold`}
                onClick={toggleReady}
                disabled={room?.status !== 'WAITING'}
              >
                {isReady ? '준비 취소' : '준비 완료'}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 