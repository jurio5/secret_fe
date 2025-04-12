"use client";

import { useEffect, Suspense, useState, useRef } from "react";
import client from "@/lib/backend/client";
import { components } from "@/lib/backend/apiV1/schema";
import { subscribe, unsubscribe, publish, isConnected, getConnectionStatus } from "@/lib/backend/stompClient";

import UserProfile from "@/components/lobby/UserProfile";
import UserList from "@/components/lobby/UserList";
import StatCards from "@/components/lobby/StatCards";
import RoomList from "@/components/lobby/RoomList";
import Chat from "@/components/lobby/Chat";

interface ApiResponse<T> {
  data: {
    data: T;
  };
  error?: {
    msg: string;
  };
}

interface User {
  id: string | number;
  username: string;
  color?: string;
}

function LobbyContent() {
  const [rooms, setRooms] = useState<components["schemas"]["RoomResponse"][]>([]);
  
  const [chatMessages, setChatMessages] = useState<Array<{
    id: number;
    sender: string;
    message: string;
    timestamp: string;
    type: string;
  }>>([]);
  
  const [socketConnected, setSocketConnected] = useState<boolean | null>(null);
  
  const [users] = useState<User[]>([
    { id: 1, username: "사용자1", color: "purple-300" },
    { id: 2, username: "사용자2", color: "green-300" },
    { id: 3, username: "사용자3", color: "blue-300" }
  ]);

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

  useEffect(() => {
    loadRooms();

    const checkConnectionStatus = () => {
      const status = isConnected();
      setSocketConnected(status);
      console.log("STOMP 연결 상태:", status ? "연결됨" : "연결 끊김", getConnectionStatus());
    };
    
    checkConnectionStatus();
    
    const interval = setInterval(checkConnectionStatus, 3000);

    subscribe("/topic/lobby", (_) => {
      loadRooms();
    });

    subscribe("/topic/lobby/chat", (message) => {
      handleChatMessage(message);
    });

    return () => {
      unsubscribe("/topic/lobby");
      unsubscribe("/topic/lobby/chat");
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
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

  const handleChatMessage = (message: any) => {
    try {
      console.log("수신된 채팅 메시지:", message);
      
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (typeof message === 'string') {
        try {
          const parsedMessage = JSON.parse(message);
          console.log("파싱된 문자열 메시지:", parsedMessage);
          addChatMessage(parsedMessage);
        } catch (e) {
          console.log("문자열 메시지 처리:", message);
          addChatMessage({
            id: Date.now(),
            sender: "시스템",
            message: message,
            timestamp: timeString,
            type: "SYSTEM"
          });
        }
      } else {
        console.log("객체 메시지 처리:", message);
        
        let messageContent = "";
        let sender = "";
        let messageType = "CHAT";
        
        if (message.content && typeof message.content === 'string' && message.content.includes('"type"')) {
          try {
            const innerMessage = JSON.parse(message.content);
            messageContent = innerMessage.content || "";
            sender = innerMessage.sender || "";
            messageType = innerMessage.type || "CHAT";
            
            if (sender === "나") {
              console.log("자신이 보낸 메시지는 중복 표시하지 않음");
              return;
            }
            
            if (message.senderName) {
              sender = message.senderName;
            }
          } catch (e) {
            console.error("중첩된 메시지 파싱 실패:", e);
            messageContent = message.content;
            sender = message.senderName || message.senderId || "알 수 없음";
          }
        } else {
          messageContent = message.content || message.message || message.text || message.body || JSON.stringify(message);
          sender = message.sender || message.user || message.username || message.senderName || "알 수 없음";
          messageType = message.type || "CHAT";
        }
        
        addChatMessage({
          id: Date.now(),
          sender: sender,
          message: messageContent,
          timestamp: message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : timeString,
          type: messageType
        });
      }
    } catch (error) {
      console.error("채팅 메시지 처리 중 오류:", error);
    }
  };

  const addChatMessage = (message: {
    id: number;
    sender: string;
    message: string;
    timestamp: string;
    type: string;
  }) => {
    setChatMessages((prev) => [...prev, message]);
  };

  const sendChatMessage = (messageInput: string) => {
    if (messageInput.trim() === "") return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMessage = {
      id: Date.now(),
      sender: "나",
      message: messageInput,
      timestamp: timeString,
      type: "CHAT"
    };

    addChatMessage(newMessage);

    publish("/app/lobby/chat", {
      type: "CHAT",
      content: messageInput,
      sender: "나",
      timestamp: now.toISOString()
    });
  };

  return (
    <div className="text-white h-screen flex">
      <div className="w-64 bg-[#0a0b14]/80 backdrop-blur-sm border-r border-indigo-900/20 flex flex-col overflow-hidden">
        <UserProfile 
          username="테스터박"
          level={1}
          points={0}
          rank="Bronze"
        />
        
        <UserList users={users} />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
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
        
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-[2] p-4 overflow-y-auto min-h-0">
              <StatCards 
                username="테스터박"
                level={1}
                rank={99}
                points={0}
              />

              <RoomList 
                rooms={rooms}
                onRefresh={loadRooms}
              />
            </div>
            
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
      <div className="fixed inset-0 bg-[#05060f] z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-indigo-900/5 via-[#05060f] to-purple-900/5"></div>
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-purple-600/5 rounded-full blur-[100px]"></div>
      </div>
      
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