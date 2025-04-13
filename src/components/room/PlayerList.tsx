"use client";

import { FaCrown, FaCheckCircle } from "react-icons/fa";
import { PlayerProfile } from "../../lib/types/room";

// 기본 프로필 이미지 URL
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

interface PlayerListProps {
  players: PlayerProfile[];
  currentUserId: number | null;
}

export default function PlayerList({ players, currentUserId }: PlayerListProps) {
  // 로딩 중 상태 처리 - 플레이어 목록이 빈 배열일 때
  const isEmpty = players.length === 0;

  return (
    <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-6 h-full">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
        플레이어 ({players.length})
      </h2>
      
      {isEmpty ? (
        <div className="text-center py-8 text-gray-400">
          <p>현재 방에 플레이어가 없습니다.</p>
          <p className="text-sm mt-2">다른 플레이어들이 입장하기를 기다려주세요.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-24rem)] overflow-y-auto pr-2">
          {players.map((player) => (
            <div 
              key={player.id} 
              className={`flex items-center gap-3 p-3 rounded-lg ${
                player.id === currentUserId?.toString() 
                  ? 'bg-indigo-900/40 border border-indigo-700/50' 
                  : 'bg-gray-800/70'
              }`}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700">
                {player.avatarUrl ? (
                  <img 
                    src={player.avatarUrl} 
                    alt={player.nickname} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {player.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="flex-grow">
                <div className="flex items-center">
                  <span className="font-medium text-white">
                    {player.nickname}
                  </span>
                  {player.isOwner && (
                    <span className="ml-2 text-yellow-500" title="방장">
                      <FaCrown />
                    </span>
                  )}
                  {player.id === currentUserId?.toString() && (
                    <span className="ml-1 px-1.5 py-0.5 bg-indigo-900/60 text-indigo-300 text-xs rounded">
                      나
                    </span>
                  )}
                </div>
                
                <div className="flex items-center text-sm mt-1">
                  {player.isReady ? (
                    <span className="text-green-400 flex items-center">
                      <FaCheckCircle className="mr-1" />
                      준비 완료
                    </span>
                  ) : player.isOwner ? (
                    <span className="text-yellow-400">방장</span>
                  ) : (
                    <span className="text-gray-400">대기 중</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 