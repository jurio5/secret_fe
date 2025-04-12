"use client";

import { useEffect, Suspense, useState, useRef } from "react";
import client from "@/lib/backend/client";
import { components } from "@/lib/backend/apiV1/schema";
import { subscribe, unsubscribe, publish, isConnected, getConnectionStatus } from "@/lib/backend/stompClient";

// 쿠키 관련 유틸리티 함수 추가
function getCookieValue(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

// 컴포넌트 가져오기
import UserProfile from "@/components/lobby/UserProfile";
import UserList from "@/components/lobby/UserList";
import StatCards from "@/components/lobby/StatCards";
import RoomList from "@/components/lobby/RoomList";
import Chat from "@/components/lobby/Chat";

// 서버 응답 타입 정의
interface ApiResponse<T> {
  data: {
    data: T;
  };
  error?: {
    msg: string;
  };
}

// 서버를 위한 ChatMessage 인터페이스 정의
export interface ChatMessage {
  id: string | number;
  sender: string;
  message: string;
  timestamp: string;
  type: string;
}

// 사용자 타입 정의
interface User {
  id: string | number;
  nickname: string;
  email?: string;
  status?: string;
  color?: string;
  lastActive?: number;
}

function LobbyContent() {
  const [rooms, setRooms] = useState<components["schemas"]["RoomResponse"][]>([]);
  
  // 채팅 관련 상태 - ChatMessage 인터페이스 사용
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // WebSocket 연결 상태
  const [socketConnected, setSocketConnected] = useState<boolean | null>(null);
  
  // 디버깅: WebSocket 연결 상태 변화를 로그로 출력
  useEffect(() => {
    console.log('WebSocket 연결 상태 변경됨:', socketConnected);
  }, [socketConnected]);
  
  // 사용자 목록 (예시 데이터)
  const [users, setUsers] = useState<User[]>([
    { id: 1, nickname: "사용자1", color: "purple-300" },
    { id: 2, nickname: "사용자2", color: "green-300" },
    { id: 3, nickname: "사용자3", color: "blue-300" }
  ]);

  // chatMessages 상태 변화 추적
  useEffect(() => {
    console.log("채팅 메시지 상태 업데이트:", chatMessages);
  }, [chatMessages]);

  // 쿠키 확인 및 저장 로직 추가
  useEffect(() => {
    // 페이지 로드시와 10초마다 쿠키 확인
    const checkCookies = () => {
      const cookies = document.cookie;
      console.log("현재 쿠키:", cookies);
      
      // 쿠키에서 토큰 추출
      const getCookieValue = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
      };
      
      const token = getCookieValue('access_token');
      console.log("액세스 토큰 존재 여부:", token ? "있음" : "없음");
      
      // 쿠키에 토큰이 있으면 로컬 스토리지에도 저장
      if (token) {
        try {
          localStorage.setItem('access_token', token);
          console.log("로컬 스토리지에 토큰 저장 완료");
        } catch (e) {
          console.error("로컬 스토리지 저장 실패:", e);
        }
      }
    };
    
    checkCookies();
    const interval = setInterval(checkCookies, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // 방 목록 로드 함수
  async function loadRooms() {
    try {
      const res = await client.GET("/api/v1/rooms") as ApiResponse<components["schemas"]["RoomResponse"][]>;

      if (res.error) {
        alert(res.error.msg);
        return;
      }
      
      setRooms(res.data?.data || []);
    } catch (error) {
      console.error("방 목록을 불러오는 중 오류가 발생했습니다:", error);
      alert("방 목록을 불러오는 중 오류가 발생했습니다.");
    }
  }

  // 웹소켓 연결 및 구독 설정
  useEffect(() => {
    loadRooms();

    // STOMP 클라이언트 연결 상태 주기적 확인
    const checkConnectionStatus = () => {
      const status = isConnected();
      setSocketConnected(status);
      console.log("STOMP 연결 상태:", status ? "연결됨" : "연결 끊김", getConnectionStatus());
      
      // 연결되면 접속자 목록 요청
      if (status) {
        setTimeout(() => {
          try {
            console.log("초기 접속자 목록 요청 시도");
            publish("/app/lobby/users", {
              type: "REQUEST",
              content: "get_users",
              timestamp: Date.now()
            });
          } catch (error) {
            console.error("초기 접속자 목록 요청 실패:", error);
          }
        }, 1000);
      }
    };
    
    // 초기 연결 상태 확인
    checkConnectionStatus();
    
    // 주기적으로 연결 상태 확인 (3초마다)
    const interval = setInterval(checkConnectionStatus, 3000);

    // 방 목록 업데이트 구독
    subscribe("/topic/lobby", (_) => {
      loadRooms();
    });

    // 로비 채팅 구독
    subscribe("/topic/lobby/chat", (message) => {
      handleChatMessage(message);
    });
    
    // 로비 접속자 목록 구독 - 페이지에서 직접 처리
    subscribe("/topic/lobby/users", (message) => {
      try {
        console.log("로비 접속자 목록 메시지 수신 [페이지]:", message);
        
        // 메시지 형식에 따라 적절히 처리
        let userList = [];
        if (typeof message === 'string') {
          userList = JSON.parse(message);
        } else if (Array.isArray(message)) {
          userList = message;
        } else if (message && typeof message === 'object' && message.data) {
          userList = Array.isArray(message.data) ? message.data : [message.data];
        }
        
        if (Array.isArray(userList) && userList.length > 0) {
          console.log("사용자 목록 업데이트 [페이지]:", userList);
          
          // 사용자 목록 업데이트
          const formattedUsers = userList.map((user: any) => ({
            id: user.id || user.email,
            nickname: user.nickname || user.email?.split('@')[0] || '익명',
            email: user.email,
            status: user.status || 'online',
            lastActive: user.lastActive,
            color: user.color
          }));
          
          setUsers(formattedUsers);
        } else {
          console.log("빈 사용자 목록 또는 형식 오류, 기본 사용자 유지");
        }
      } catch (error) {
        console.error("접속자 목록 처리 중 오류 [페이지]:", error);
      }
    });
    
    // 주기적으로 사용자 목록 갱신 요청 전송
    const userListInterval = setInterval(() => {
      if (isConnected()) {
        try {
          publish("/app/lobby/users", {
            type: "REQUEST",
            content: "get_users",
            timestamp: Date.now()
          });
          console.log("주기적 접속자 목록 요청 전송");
        } catch (error) {
          console.error("주기적 접속자 목록 요청 실패:", error);
        }
      }
    }, 10000); // 10초마다 갱신

    return () => {
      unsubscribe("/topic/lobby");
      unsubscribe("/topic/lobby/chat");
      unsubscribe("/topic/lobby/users");
      clearInterval(interval);
      clearInterval(userListInterval);
    };
  }, []);

  // 테스트 메시지 생성 (실제 구현에서는 제거)
  useEffect(() => {
    // 초기 더미 메시지 추가
    if (chatMessages.length === 0) {
      const dummyMessages = [
        {
          id: Date.now() - 5000,
          sender: "시스템",
          message: "로비 채팅에 오신 것을 환영합니다!",
          timestamp: "12:00",
          type: "SYSTEM"
        },
        {
          id: Date.now() - 4000,
          sender: "채팅봇",
          message: "퀴즐 서비스에 관한 질문이 있으면 언제든 물어보세요!",
          timestamp: "12:01",
          type: "CHAT"
        },
        {
          id: Date.now() - 3000,
          sender: "사용자1",
          message: "안녕하세요! 오늘 신규 퀴즈가 추가되었나요?",
          timestamp: "12:05",
          type: "CHAT"
        },
        {
          id: Date.now() - 2000,
          sender: "사용자2",
          message: "네! 과학 카테고리에 우주 관련 문제들이 새로 추가됐어요.",
          timestamp: "12:06",
          type: "CHAT"
        }
      ];
      setChatMessages(dummyMessages);
    }
  }, []);

  // 채팅 메시지 처리 함수
  const handleChatMessage = (message: any) => {
    try {
      console.log("수신된 채팅 메시지:", message);
      
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // 서버에서 오는 WebSocketChatMessageResponse 형식 처리
      // WebSocketChatMessageResponse[type=CHAT, content={...}, senderId=... 형식
      if (typeof message === 'object' && message.content) {
        console.log("메시지 처리 시작:", message);
        
        let messageContent = "";
        let sender = "";
        let messageType = "CHAT";
        let clientId: string | number | null = null;
        
        // content가 JSON 문자열인 경우 (중첩된 형식)
        if (typeof message.content === 'string' && message.content.startsWith('{')) {
          try {
            const innerMessage = JSON.parse(message.content);
            console.log("내부 메시지 파싱:", innerMessage);
            
            messageContent = innerMessage.content || "";
            messageType = innerMessage.type || "CHAT";
            clientId = innerMessage.clientMessageId || null;
            
            // 발신자 처리: 내가 보낸 메시지이면 "나"로 표시
            if (innerMessage.sender === "나" && message.senderName) {
              const isMyMessage = clientId && typeof clientId === 'string' && clientId.startsWith("local_");
              sender = isMyMessage ? "나" : message.senderName;
            } else {
              sender = message.senderName || "알 수 없음";
            }
            
            console.log("메시지 정보:", {
              내용: messageContent,
              발신자: sender,
              타입: messageType,
              클라이언트ID: clientId
            });
            
            // 이미 표시된 메시지는 건너뛰기 (clientId로 식별)
            if (clientId && chatMessages.some(msg => {
              // 문자열 ID와 숫자 ID 모두 처리
              const msgId = String(msg.id);
              const compareId = String(clientId);
              return msgId === compareId;
            })) {
              console.log("이미 표시된 메시지 무시:", clientId);
              return;
            }
          } catch (e) {
            console.error("내부 메시지 파싱 실패:", e);
            // 파싱 실패 시 원본 메시지 사용
            messageContent = message.content;
            sender = message.senderName || message.senderId || "알 수 없음";
          }
        } else {
          // 일반 형식
          messageContent = message.content;
          sender = message.senderName || message.senderId || "알 수 없음";
        }
        
        // 고유 ID 생성 - clientId가 없는 경우에도 메시지별 고유 ID 사용
        const messageId = clientId || "server_" + Date.now();
        
        // 다시 한번 중복 메시지 검사
        if (chatMessages.some(msg => String(msg.id) === String(messageId))) {
          console.log("중복 메시지 무시 (최종 검사):", messageId);
          return;
        }
        
        // 메시지 추가
        addChatMessage({
          id: messageId,
          sender: sender,
          message: messageContent,
          timestamp: message.timestamp ? 
            new Date(parseInt(message.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            timeString,
          type: messageType
        });
        return;
      }
      
      // 문자열 메시지 처리
      if (typeof message === 'string') {
        try {
          const parsedMessage = JSON.parse(message);
          console.log("문자열 메시지 파싱:", parsedMessage);
          // 파싱된 메시지를 다시 처리
          handleChatMessage(parsedMessage);
        } catch (e) {
          // 단순 문자열인 경우
          console.log("단순 문자열 메시지:", message);
          
          const messageId = "system_" + Date.now();
          // 중복 검사
          if (chatMessages.some(msg => msg.message === message && msg.type === "SYSTEM")) {
            console.log("중복 시스템 메시지 무시");
            return;
          }
          
          addChatMessage({
            id: messageId,
            sender: "시스템",
            message: message,
            timestamp: timeString,
            type: "SYSTEM"
          });
        }
        return;
      }
      
      // 위 조건에 해당하지 않는 객체인 경우
      console.log("기타 메시지 형식:", message);
      
      const messageId = message.id || "other_" + Date.now();
      // 중복 검사
      if (chatMessages.some(msg => String(msg.id) === String(messageId))) {
        console.log("중복 기타 메시지 무시:", messageId);
        return;
      }
      
      addChatMessage({
        id: messageId,
        sender: message.senderName || message.senderId || "알 수 없음",
        message: message.content || message.message || message.text || JSON.stringify(message),
        timestamp: message.timestamp ? 
          new Date(parseInt(message.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
          timeString,
        type: message.type || "CHAT"
      });
      
    } catch (error) {
      console.error("채팅 메시지 처리 중 오류:", error);
    }
  };

  // 채팅 메시지 추가 함수 - 매개변수 타입을 ChatMessage로 수정
  const addChatMessage = (message: ChatMessage) => {
    // 중복 메시지 검사 추가
    if (chatMessages.some(msg => msg.id === message.id)) {
      console.log("중복 메시지 무시 (addChatMessage):", message.id);
      return;
    }
    
    setChatMessages((prev) => [...prev, message]);
  };

  // 채팅 메시지 전송 함수
  const sendChatMessage = (messageInput: string) => {
    if (messageInput.trim() === "") return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // 프론트엔드에서 생성한 메시지ID에는 'local_' 접두사를 붙여서 서버 메시지와 구분
    const messageId = 'local_' + Date.now();

    // 클라이언트 측에서 메시지 미리보기 추가
    const newMessage = {
      id: messageId,
      sender: "나", // 실제로는 사용자 닉네임을 사용
      message: messageInput,
      timestamp: timeString,
      type: "CHAT"
    };

    addChatMessage(newMessage);

    // 서버로 메시지 전송 - 메시지 ID 추가
    publish("/app/lobby/chat", {
      type: "CHAT",
      content: messageInput,
      sender: "나", // 실제로는 사용자 정보를 포함해야 함
      timestamp: now.toISOString(),
      clientMessageId: messageId // 로컬 메시지 ID를 서버에 전달
    });
  };

  return (
    <div className="text-white h-screen flex">
      {/* 왼쪽 사이드바 (프로필 및 사용자 목록) */}
      <div className="w-64 bg-[#0a0b14]/80 backdrop-blur-sm border-r border-indigo-900/20 flex flex-col overflow-hidden">
        {/* 프로필 컴포넌트 */}
        <UserProfile 
          nickname="테스터박"
          level={1}
          points={0}
          rank="Bronze"
        />
        
        {/* 사용자 목록 컴포넌트 */}
        <UserList users={users} isConnected={socketConnected} />
        
        {/* 접속자 목록 수동 갱신 버튼 (디버깅용) */}
        <div className="px-4 pb-2">
          <button 
            onClick={() => {
              try {
                console.log("접속자 목록 수동 갱신 요청");
                publish("/app/lobby/users", {
                  type: "REQUEST",
                  content: "get_users",
                  timestamp: Date.now()
                });
              } catch (error) {
                console.error("접속자 목록 수동 갱신 요청 실패:", error);
              }
            }}
            className="w-full text-xs py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-sm transition-colors"
          >
            접속자 목록 새로고침
          </button>
        </div>
      </div>
      
      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 메뉴 탭 */}
        <div className="bg-[#0a0b14] h-12 border-b border-indigo-900/20 px-4 flex items-center">
          <div className="flex space-x-4">
            <div className="px-3 py-1 rounded-md text-sm bg-indigo-600 text-white">전체</div>
            <div className="px-3 py-1 rounded-md text-sm text-gray-400 hover:bg-[#161a2d]/40 cursor-pointer">대기중</div>
            <div className="px-3 py-1 rounded-md text-sm text-gray-400 hover:bg-[#161a2d]/40 cursor-pointer">진행중</div>
          </div>
          
          <div className="ml-auto">
            <button className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md flex items-center gap-2 transition-colors text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              방 만들기
            </button>
          </div>
        </div>
        
        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 중앙 영역: 방 목록 + 채팅 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 방 목록 영역 */}
            <div className="flex-[2] p-4 overflow-y-auto min-h-0">
              {/* 통계 카드 컴포넌트 */}
              <StatCards 
                nickname="테스터박"
                level={1}
                rank={99}
                points={0}
              />

              {/* 방 목록 컴포넌트 */}
              <RoomList 
                rooms={rooms}
                onRefresh={loadRooms}
              />
            </div>
            
            {/* 채팅 컴포넌트 */}
            <Chat 
              messages={chatMessages}
              socketConnected={socketConnected}
              onSendMessage={sendChatMessage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LobbyPage() {
  return (
    <div className="h-screen w-full bg-[#05060f] flex flex-col overflow-hidden">
      {/* 배경 그라데이션 효과 */}
      <div className="fixed inset-0 bg-[#05060f] z-0">
        {/* 블러 그라데이션 효과 */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-indigo-900/5 via-[#05060f] to-purple-900/5"></div>
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-purple-600/5 rounded-full blur-[100px]"></div>
      </div>
      
      {/* 컨텐츠 영역 */}
      <div className="relative z-10 w-full h-full flex flex-col">
        <Suspense
          fallback={
            <div className="flex justify-center items-center h-full">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-3 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent animate-spin mb-3"></div>
                <div className="text-indigo-400 text-lg">로딩 중...</div>
              </div>
            </div>
          }
        >
          <LobbyContent />
        </Suspense>
      </div>
    </div>
  );
}