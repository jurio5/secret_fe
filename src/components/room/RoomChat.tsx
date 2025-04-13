"use client";

import { useState, useRef, useEffect } from "react";
import { FaComments } from "react-icons/fa";

// 기본 아바타 URL
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

interface ChatMessage {
  id?: string;
  type: "CHAT" | "SYSTEM";
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  avatarUrl?: string;
}

interface RoomChatProps {
  messages: ChatMessage[];
  currentUserId: number | null;
  onSendMessage: (message: string) => void;
}

export default function RoomChat({ messages, currentUserId, onSendMessage }: RoomChatProps) {
  const [newMessage, setNewMessage] = useState<string>("");
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // 채팅 메시지 전송 핸들러
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    onSendMessage(newMessage.trim());
    setNewMessage("");
  };
  
  // 키 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // 메시지 목록이 변경될 때 스크롤 맨 아래로 이동
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  return (
    <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5 flex flex-col h-full">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
        <FaComments className="mr-2 text-indigo-400" />
        채팅
      </h2>
      
      <div 
        ref={chatContainerRef}
        className="flex-grow overflow-y-auto p-3 space-y-2 bg-gray-900/30 rounded-lg mb-4"
      >
        {messages.length === 0 ? (
          <div className="flex justify-center my-6">
            <div className="bg-gray-800/70 text-gray-300 text-sm py-2 px-4 rounded-full">
              채팅이 없습니다. 첫 메시지를 보내보세요!
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={msg.id || index} 
              className={`${
                msg.type === "SYSTEM" 
                  ? "flex justify-center" 
                  : "flex"
              }`}
            >
              {msg.type === "SYSTEM" ? (
                <div className="bg-gray-800/70 text-gray-300 text-xs py-1 px-3 rounded-full">
                  {msg.content}
                </div>
              ) : (
                <>
                  {/* 시간 표시 */}
                  <div className="flex-shrink-0 text-xs text-gray-500 mr-2 mt-1 w-10">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  
                  {/* 발신자 아바타 */}
                  <div className="flex-shrink-0 mr-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-800">
                      {msg.avatarUrl ? (
                        <img 
                          src={msg.avatarUrl} 
                          alt={msg.senderName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs font-bold">
                          {msg.senderName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 닉네임과 메시지 */}
                  <div className="flex-grow">
                    <div className="flex items-center gap-1 leading-none">
                      <span className={`font-medium text-sm ${
                        currentUserId && msg.senderId === currentUserId.toString() 
                          ? "text-blue-400" 
                          : "text-gray-300"
                      }`}>
                        {msg.senderName}
                      </span>
                      {currentUserId && msg.senderId === currentUserId.toString() && (
                        <span className="text-xs bg-blue-900/30 text-blue-400 px-1 rounded">나</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-200 break-words">{msg.content}</div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
      
      <div className="flex items-center">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="메시지를 입력하세요..."
          className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleSendMessage}
          disabled={!newMessage.trim()}
          className={`ml-2 p-2 rounded-lg ${
            newMessage.trim()
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-700 cursor-not-allowed"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
} 