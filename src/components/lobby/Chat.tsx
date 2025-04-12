"use client";

import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: number;
  sender: string;
  message: string;
  timestamp: string;
  type: string;
}

interface ChatProps {
  messages: ChatMessage[];
  socketConnected: boolean | null;
  onSendMessage: (message: string) => void;
}

const Chat: React.FC<ChatProps> = ({ 
  messages = [], 
  socketConnected, 
  onSendMessage 
}) => {
  const [messageInput, setMessageInput] = useState("");
  const [chatVisible, setChatVisible] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendChatMessage = () => {
    if (messageInput.trim() === "") return;
    onSendMessage(messageInput);
    setMessageInput("");
  };

  const toggleChat = () => {
    setChatVisible(!chatVisible);
  };

  return (
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
            {messages.map((msg) => (
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
            
            {messages.length === 0 && (
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
  );
};

export default Chat; 