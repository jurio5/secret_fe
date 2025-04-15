"use client";

import { FaCrown, FaCheckCircle } from "react-icons/fa";
import { PlayerProfile } from "../../lib/types/room";
import { useEffect, useState } from "react";

// 기본 프로필 이미지 URL
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

interface PlayerListProps {
  players: PlayerProfile[];
  currentUserId: string | number | null;
  isOwner?: boolean;
  isReady?: boolean;
  onToggleReady?: () => void;
  roomStatus?: string;
}

export default function PlayerList({ 
  players, 
  currentUserId, 
  isOwner = false,
  isReady = false,
  onToggleReady,
  roomStatus = 'WAITING'
}: PlayerListProps) {
  const [cachedPlayers, setCachedPlayers] = useState<PlayerProfile[]>([]);
  const [isButtonCooldown, setIsButtonCooldown] = useState<boolean>(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  
  // 쿨다운 타이머 관리
  useEffect(() => {
    // 컴포넌트 마운트 시 마지막 토글 시간 확인
    const checkCooldown = () => {
      const lastToggleTime = parseInt(sessionStorage.getItem('lastReadyToggleTime') || '0');
      const currentTime = Date.now();
      const cooldownTime = 1500; // 1.5초 (toggleReady 함수와 동일하게 유지)
      const remainingTime = Math.max(0, cooldownTime - (currentTime - lastToggleTime));
      
      if (remainingTime > 0) {
        setIsButtonCooldown(true);
        setCooldownRemaining(remainingTime);
      } else {
        setIsButtonCooldown(false);
        setCooldownRemaining(0);
      }
    };
    
    // 초기 확인
    checkCooldown();
    
    // 100ms마다 상태 체크
    const timer = setInterval(checkCooldown, 100);
    
    return () => clearInterval(timer);
  }, []);
  
  // 플레이어 목록이 비어있지 않은 경우에만 캐시 업데이트
  useEffect(() => {
    if (players.length > 0) {
      console.log("플레이어 목록 캐시 업데이트:", players);
      console.log("각 플레이어 준비 상태:", players.map(p => `${p.nickname}: ${p.isReady}`).join(', '));
      setCachedPlayers(players);
    }
  }, [players]);
  
  // 실제 렌더링에 사용할 플레이어 목록
  const displayPlayers = players.length > 0 ? players : cachedPlayers;
  
  // 로딩 중 상태 처리 - 플레이어 목록이 빈 배열일 때
  const isEmpty = displayPlayers.length === 0;
  
  console.log("PlayerList 렌더링:", { 
    isEmpty, 
    playersCount: displayPlayers.length, 
    playersOriginal: players.length,
    cachedPlayersCount: cachedPlayers.length,
    displayPlayers,
    currentUserId,
    isOwner,
    isReady,
    roomStatus
  });

  return (
    <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-6 h-full">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
        플레이어 ({displayPlayers.length})
      </h2>
      
      {isEmpty ? (
        <div className="text-center py-8 text-gray-400">
          <p>현재 방에 플레이어가 없습니다.</p>
          <p className="text-sm mt-2">다른 플레이어들이 입장하기를 기다려주세요.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 max-h-[calc(100vh-28rem)] overflow-y-auto pr-2">
            {displayPlayers.map((player) => {
              const isCurrentUser = player.id === String(currentUserId);
              return (
                <div 
                  key={player.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isCurrentUser
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
                      {isCurrentUser && (
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
              );
            })}
          </div>
          
          {onToggleReady && roomStatus === 'WAITING' && !isOwner && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <button 
                onClick={onToggleReady}
                disabled={isButtonCooldown}
                className={`w-full py-2 rounded-lg font-medium ${
                  isButtonCooldown
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    : isReady 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isButtonCooldown 
                  ? `대기 중... (${Math.ceil(cooldownRemaining / 1000)}초)` 
                  : isReady ? '준비 취소' : '준비 완료'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 