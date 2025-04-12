"use client";

import React, { useEffect, useState } from 'react';
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";

interface User {
  id: string | number;
  nickname?: string;
  email?: string;
  status?: string;
  color?: string;
  lastActive?: number;
}

interface UserListProps {
  users?: User[];
  isConnected?: boolean | null;
}

const UserList: React.FC<UserListProps> = ({ users: initialUsers, isConnected }) => {
  const [users, setUsers] = useState<User[]>(initialUsers || []);

  // 초기 사용자 데이터가 변경되면 상태 업데이트
  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      console.log('초기 사용자 데이터 업데이트됨:', initialUsers);
      setUsers(initialUsers);
    }
  }, [initialUsers]);

  // 디버깅을 위한 로그 추가
  useEffect(() => {
    console.log('UserList 컴포넌트 마운트됨');
    console.log('초기 사용자 데이터:', initialUsers);
    console.log('WebSocket 연결 상태:', isConnected);
  }, [initialUsers, isConnected]);

  useEffect(() => {
    // 로비 접속자 목록 구독
    const subscribeToUserList = () => {
      console.log('접속자 목록 구독 시작 - 연결 상태:', isConnected);
      
      // 로비 접속자 목록 구독
      subscribe("/topic/lobby/users", (message) => {
        console.log('접속자 목록 메시지 수신 (원본):', message);
        try {
          console.log('접속자 목록 메시지 수신:', message);
          
          // 문자열로 받은 경우 파싱
          let userList: User[] = [];
          if (typeof message === 'string') {
            userList = JSON.parse(message);
          } else if (Array.isArray(message)) {
            userList = message;
          } else if (message && typeof message === 'object' && message.data) {
            // data 필드에 있는 경우
            userList = Array.isArray(message.data) ? message.data : [message.data];
          }
          
          console.log('파싱된 접속자 목록:', userList);
          
          // 형식 변환 (서버에서 전송하는 형식에 맞게 조정)
          const formattedUsers = userList.map((user: any) => ({
            id: user.id || user.email,
            nickname: user.nickname || user.email?.split('@')[0] || '익명',
            email: user.email,
            status: user.status || 'online',
            lastActive: user.lastActive,
            // 임의의 색상 지정 (고유 ID 기반)
            color: getColorForUser(user.id || user.email)
          }));
          
          setUsers(formattedUsers);
        } catch (error) {
          console.error('접속자 목록 처리 오류:', error);
        }
      });
      
      // 서버에 접속자 목록 요청
      setTimeout(() => {
        try {
          publish("/app/lobby/users", {
            type: "REQUEST",
            content: "get_users"
          });
          console.log('접속자 목록 요청 전송');
        } catch (error) {
          console.error('접속자 목록 요청 실패:', error);
        }
      }, 1000);
    };
    
    if (isConnected) {
      subscribeToUserList();
    }
    
    return () => {
      unsubscribe("/topic/lobby/users");
    };
  }, [isConnected]);
  
  // 디버깅: 사용자 목록 상태 변화 감지
  useEffect(() => {
    console.log('사용자 목록 상태 변경됨:', users);
    
    // 더미 데이터 사용 중인지 로그
    const usingDummyData = users.length === 0;
    console.log('더미 데이터 사용 중:', usingDummyData ? '예' : '아니오');
  }, [users]);
  
  // 실제 데이터에 더미 데이터를 추가하여 항상 표시
  const displayUsers = [
    // 실제 사용자 (서버에서 받아온 데이터)
    ...users,
    // 더미 데이터 (개발용, 실제 데이터가 없을 때만 표시)
    ...(users.length === 0 ? [
      { id: 1, nickname: "사용자1", color: "purple-300", status: "online" },
      { id: 2, nickname: "사용자2", color: "green-300", status: "online" },
      { id: 3, nickname: "사용자3", color: "blue-300", status: "online" }
    ] : [])
  ];
  
  // 주기적으로 접속자 목록 갱신 요청 보내기
  useEffect(() => {
    if (!isConnected) return;
    
    // 5초마다 서버에 접속자 목록 요청
    const requestInterval = setInterval(() => {
      try {
        publish("/app/lobby/users", {
          type: "REQUEST",
          content: "get_users",
          timestamp: Date.now()
        });
        console.log("정기 접속자 목록 요청 전송");
      } catch (error) {
        console.error("정기 접속자 목록 요청 실패:", error);
      }
    }, 5000);
    
    return () => clearInterval(requestInterval);
  }, [isConnected]);
  
  // 사용자 ID에 따라 일관된 색상 반환
  const getColorForUser = (userId: string | number): string => {
    const colors = ["purple-300", "green-300", "blue-300", "pink-300", "yellow-300", "indigo-300"];
    const hash = String(userId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  // 활동 시간 포맷팅
  const formatLastActive = (timestamp?: number): string => {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="flex-grow p-4 overflow-y-auto">
      <h2 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          접속자 목록
        </div>
        <span className="text-xs text-gray-400">
          {displayUsers.length}명 접속중
        </span>
      </h2>
      
      <div className="space-y-2">
        {displayUsers.map(user => (
          <div key={user.id} className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors text-sm flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs overflow-hidden relative">
              {user.status === 'online' && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-indigo-900"></span>
              )}
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className={`w-5 h-5 text-${user.color || 'white'}`}
              >
                <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate">{user.nickname}</div>
              {user.lastActive && (
                <div className="text-xs text-gray-400">{formatLastActive(user.lastActive)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList; 