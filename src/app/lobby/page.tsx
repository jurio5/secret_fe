"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/common/AppLayout";
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";
import Link from "next/link";

interface User {
  id: number;
  email: string;
  nickname: string;
  sessions: string[];
  lastActive: number;
  status: string;
}

export default function LobbyPage() {
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // 로비 접속자 목록 구독
    const usersSub = subscribe("/topic/lobby/users", (data: User[]) => {
      setActiveUsers(data);
      setIsConnected(true);
    });

    // 컴포넌트 마운트 시 접속자 목록 요청
    publish("/app/lobby/users", JSON.stringify({ action: "getUsers" }));

    // 언마운트 시 구독 해제
    return () => {
      unsubscribe("/topic/lobby/users");
    };
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-grow">
            <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-xl p-6 mb-8">
              <h1 className="text-3xl font-bold text-white mb-4">로비</h1>
              <p className="text-gray-300 mb-6">
                퀴즈 룸에 참여하거나 새 퀴즈 룸을 만들어 친구들과 경쟁하세요!
              </p>
              
              <div className="flex flex-wrap gap-4 mb-6">
                <Link href="/room/create">
                  <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40">
                    새 퀴즈룸 만들기
                  </button>
                </Link>
                <button className="bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600 px-6 py-3 rounded-lg font-medium transition-all">
                  룸 목록 새로고침
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 여기에 룸 목록이 표시될 예정 */}
                <div className="bg-gray-700/60 border border-gray-600 rounded-xl p-4 hover:border-blue-500 transition-colors cursor-pointer">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs uppercase tracking-wider text-blue-400">대기중</div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-gray-300">3/5</span>
                    </div>
                  </div>
                  <h3 className="font-medium text-white mb-2">일반 상식 퀴즈</h3>
                  <div className="text-xs text-gray-400 mb-3">방장: 퀴즐</div>
                  <div className="text-xs text-gray-300">5분 전에 생성됨</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 실시간 접속자 목록 */}
          <div className="w-full md:w-80">
            <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-xl p-6 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">접속자 목록</h2>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                  <span className="text-sm text-gray-300">{activeUsers.length}명 접속 중</span>
                </div>
              </div>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {activeUsers.length > 0 ? (
                  activeUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/60">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium">
                        {user.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm text-white font-medium">{user.nickname}</div>
                        <div className="text-xs text-gray-400">{user.status}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">
                    {isConnected ? '접속자가 없습니다' : '연결 중...'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
