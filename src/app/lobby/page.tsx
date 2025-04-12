"use client";

import { useEffect, Suspense, useState, useRef } from "react";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { components } from "@/lib/backend/apiV1/schema";
import { subscribe, unsubscribe, publish, isConnected, getConnectionStatus } from "@/lib/backend/stompClient";

interface ApiResponse<T> {
  data: {
    data: T;
  };
  error?: {
    msg: string;
  };
}

type WebSocketEventHandler = (e: Event) => void;

function LobbyContent() {
  const [rooms, setRooms] = useState<components["schemas"]["RoomResponse"][]>(
    []
  );
  const [chatMessages, setChatMessages] = useState<Array<{
    id: number;
    sender: string;
    message: string;
    timestamp: string;
    type: string;
  }>>([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatVisible, setChatVisible] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [socketConnected, setSocketConnected] = useState<boolean | null>(null); // null=초기상태, true=연결됨, false=연결실패

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
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

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
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (typeof message === 'string') {
        try {
          const parsedMessage = JSON.parse(message);
          addChatMessage(parsedMessage);
        } catch (e) {
          addChatMessage({
            id: Date.now(),
            sender: "시스템",
            message: message,
            timestamp: timeString,
            type: "SYSTEM"
          });
        }
      } else {
        addChatMessage({
          id: Date.now(),
          sender: message.sender || "알 수 없음",
          message: message.content || message.message || "",
          timestamp: message.timestamp || timeString,
          type: message.type || "CHAT"
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

  const sendChatMessage = () => {
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

    setMessageInput("");
  };

  const toggleChat = () => {
    setChatVisible(!chatVisible);
  };

  return (
    <div className="text-white h-screen flex">
      <div className="w-64 bg-[#0a0b14]/80 backdrop-blur-sm border-r border-indigo-900/20 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-indigo-900/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-indigo-600/30 flex items-center justify-center text-xl font-medium overflow-hidden">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white">테스터박</h3>
              <div className="text-xs text-gray-400">레벨 1</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-indigo-900/20 rounded p-1.5">
              <div className="text-gray-400">포인트</div>
              <div className="text-white font-medium">0</div>
            </div>
            <div className="bg-indigo-900/20 rounded p-1.5">
              <div className="text-gray-400">등급</div>
              <div className="text-white font-medium">Bronze</div>
            </div>
          </div>
        </div>
        
        <div className="flex-grow p-4 overflow-y-auto">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            접속자 목록
          </h2>
          
          <div className="space-y-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors text-sm flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs overflow-hidden">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-purple-300">
                  <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span>사용자1</span>
            </div>
            <div className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors text-sm flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs overflow-hidden">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-300">
                  <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span>사용자2</span>
            </div>
            <div className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors text-sm flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs overflow-hidden">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-300">
                  <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span>사용자3</span>
            </div>
          </div>
        </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl p-4 border border-indigo-500/10 shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-gray-400 text-xs mb-1">내 프로필</h3>
                      <p className="text-xl font-bold text-white">사용자</p>
                    </div>
                    <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md text-xs">
                      Lv.1
                    </span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl p-4 border border-indigo-500/10 shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-gray-400 text-xs mb-1">랭킹</h3>
                      <p className="text-xl font-bold text-white">99위</p>
                    </div>
                    <button className="text-xs text-indigo-400 hover:text-indigo-300">
                      전체보기
                    </button>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl p-4 border border-indigo-500/10 shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-gray-400 text-xs mb-1">포인트</h3>
                      <p className="text-xl font-bold text-white">0 P</p>
                    </div>
                    <button className="text-xs text-indigo-400 hover:text-indigo-300">
                      상점가기
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">방 목록</h2>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input 
                      type="search" 
                      className="w-60 pl-9 pr-3 py-1.5 text-sm bg-[#10121f]/60 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      placeholder="방 제목 검색..." 
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => loadRooms()}
                    className="flex items-center justify-center w-8 h-8 bg-[#10121f]/60 hover:bg-[#161a2d]/60 rounded-lg text-white transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rooms.length > 0 ? (
                  rooms.map((room) => (
                    <div key={room.id} className="bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl overflow-hidden border border-indigo-500/10 hover:border-indigo-500/30 transition-all shadow-lg cursor-pointer group">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-white font-bold text-base truncate">{room.title}</h3>
                          <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded">대기중</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs mb-2">
                          <div className="text-gray-400">방장: {room.ownerNickname || '알 수 없음'}</div>
                          <div className="text-gray-400">난이도: 보통</div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-3">
                          <div className="text-indigo-400 text-xs">
                            {room.currentPlayers || 1}/{room.capacity || 4} 명
                          </div>
                          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs transition-colors opacity-90 group-hover:opacity-100">
                            입장하기
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl p-8 text-center shadow-lg border border-indigo-500/10">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 mb-4 shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">아직 생성된 방이 없습니다</h3>
                      <p className="text-gray-400 text-sm mb-4">첫 번째 방을 만들고 친구들을 초대해보세요!</p>
                      
                      <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md flex items-center gap-2 transition-colors text-sm shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        방 만들기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className={`flex-1 border-t border-indigo-900/30 transition-all ${chatVisible ? 'min-h-[180px]' : 'h-8'}`}>
              <div 
                className="h-8 px-3 flex items-center justify-between bg-gradient-to-r from-indigo-900/30 to-purple-900/20 cursor-pointer"
                onClick={toggleChat}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    </svg>
                    <span className="text-indigo-300 text-xs font-medium">채팅</span>
                  </div>
                  
                  {socketConnected !== null && (
                    <div className="flex items-center ml-2">
                      <span 
                        className={`w-1.5 h-1.5 rounded-full ${
                          socketConnected ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      ></span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">{messageInput.length}/120</span>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-3.5 w-3.5 text-gray-400 transition-transform ${chatVisible ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {socketConnected === false && chatVisible && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-2 mx-2 mt-2">
                  <p className="text-xs text-red-300">
                    서버 연결에 실패했습니다. 일부 기능이 제한될 수 있습니다.
                  </p>
                </div>
              )}

              {chatVisible && (
                <div className="flex flex-col h-[calc(100%-32px)]">
                  <div 
                    ref={chatContainerRef}
                    className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-900/30 scrollbar-track-transparent p-2 space-y-px bg-[#080a12]"
                  >
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`group flex items-start gap-1 mb-px transition-opacity duration-150 ease-in ${
                        msg.type === 'SYSTEM' ? 'text-yellow-500' : ''
                      }`}>
                        <span className={`text-xs font-medium whitespace-nowrap ${
                          msg.type === 'SYSTEM' ? 'text-yellow-500' : 
                          msg.sender === '나' ? 'text-indigo-400' : 'text-blue-400'
                        }`}>
                          [{msg.timestamp}] {msg.sender}
                        </span>
                        
                        <span className={`text-xs break-all ${
                          msg.type === 'SYSTEM' ? 'text-yellow-200' : 'text-gray-200'
                        }`}>
                          : {msg.message}
                        </span>
                      </div>
                    ))}
                    
                    {chatMessages.length === 0 && (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500 text-xs">채팅 메시지가 없습니다</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-2.5 border-t border-indigo-900/40 bg-[#06070d] flex items-center gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder="메시지를 입력하세요..."
                      className="flex-1 bg-[#141729] border border-indigo-900/40 rounded text-white placeholder-gray-500 text-xs px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      maxLength={120}
                    />
                    
                    <button
                      onClick={sendChatMessage}
                      disabled={messageInput.trim() === ''}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5 rounded transition-colors"
                    >
                      전송
                    </button>
                  </div>
                </div>
              )}
            </div>
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