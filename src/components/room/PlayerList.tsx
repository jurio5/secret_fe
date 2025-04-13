"use client";

import Image from "next/image";
import { FaUsers, FaCrown, FaCheck } from "react-icons/fa";
import { PlayerProfile } from "../../types/room";

// 기본 프로필 이미지 URL
const DEFAULT_PROFILE_IMAGE = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

interface PlayerListProps {
  players: PlayerProfile[];
  currentUserId: number | null;
}

export default function PlayerList({ players, currentUserId }: PlayerListProps) {
  return (
    <div className="md:col-span-2 bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <FaUsers className="mr-2.5 text-indigo-400" />
        참가자 목록
        <span className="ml-2.5 px-2 py-0.5 bg-indigo-900/60 text-indigo-300 text-xs rounded-full">
          {players.length}명
        </span>
      </h2>
      
      {/* 플레이어 목록이 비어있을 때 */}
      {players.length === 0 && (
        <div className="p-4 bg-yellow-900/30 border border-yellow-700/40 rounded-lg text-yellow-200 text-sm">
          플레이어 목록을 불러오는 중입니다...
        </div>
      )}
      
      {/* 플레이어 목록 */}
      <div className="space-y-3">
        {players.map((player) => (
          <PlayerCard 
            key={player.id} 
            player={player}
            isCurrentUser={currentUserId !== null && currentUserId.toString() === player.id}
          />
        ))}
      </div>
    </div>
  );
}

interface PlayerCardProps {
  player: PlayerProfile;
  isCurrentUser: boolean;
}

function PlayerCard({ player, isCurrentUser }: PlayerCardProps) {
  return (
    <div
      className={`p-4 rounded-xl flex items-center transition-all ${
        player.isOwner 
          ? 'bg-gradient-to-r from-amber-900/40 to-amber-800/30 border border-amber-700/30' 
          : player.ready 
            ? 'bg-gradient-to-r from-green-900/40 to-green-800/30 border border-green-700/30' 
            : 'bg-gradient-to-r from-gray-800/60 to-gray-800/40 border border-gray-700/30'
      }`}
    >
      {/* 프로필 이미지 */}
      <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 border-2 border-gray-600/50 shadow-md">
        {player.profileImage ? (
          <Image
            src={player.profileImage}
            alt={player.nickname || '사용자'}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white font-medium bg-gradient-to-br from-blue-500 to-indigo-600">
            {player.nickname ? player.nickname.charAt(0).toUpperCase() : '?'}
          </div>
        )}
        
        {/* 상태 아이콘 */}
        {player.isOwner ? (
          <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-yellow-900 rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-800 shadow-lg">
            <FaCrown className="w-3 h-3" />
          </div>
        ) : player.ready ? (
          <div className="absolute -bottom-1 -right-1 bg-green-500 text-green-900 rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-800 shadow-lg">
            <FaCheck className="w-3 h-3" />
          </div>
        ) : null}
      </div>
      
      {/* 플레이어 정보 */}
      <div className="ml-4 flex-grow">
        <div className="flex justify-between items-start">
          <p className="text-white font-medium text-lg">{player.nickname || '익명 사용자'}</p>
          {/* 현재 사용자 표시 */}
          {isCurrentUser && (
            <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded-md">나</span>
          )}
        </div>
        <p className="text-gray-400 text-sm mt-1 flex items-center">
          {player.isOwner 
            ? <><FaCrown className="text-yellow-500 mr-1.5" /> 방장</> 
            : player.ready 
              ? <><FaCheck className="text-green-500 mr-1.5" /> 준비 완료</> 
              : <span className="flex items-center">
                  <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  준비 중
                </span>}
        </p>
      </div>
    </div>
  );
} 