"use client";

import { FaCrown, FaUsers, FaInfoCircle, FaDoorOpen } from "react-icons/fa";
import { RoomResponse } from "../../lib/types/room";

interface RoomHeaderProps {
  room: RoomResponse | null;
  roomId: string;
  onLeave: () => void;
}

export default function RoomHeader({ room, roomId, onLeave }: RoomHeaderProps) {
  // 난이도 텍스트 변환
  const getDifficultyText = (difficulty?: string) => {
    switch (difficulty) {
      case "EASY": return "쉬움";
      case "NORMAL": return "보통";
      case "HARD": return "어려움";
      default: return "보통";
    }
  };
  
  // 카테고리 텍스트 변환
  const getCategoryText = (category?: string) => {
    const categoryMap: Record<string, string> = {
      'SCIENCE': '과학',
      'HISTORY': '역사',
      'LANGUAGE': '언어',
      'GENERAL_KNOWLEDGE': '일반 상식',
      'PHYSICS': '물리학',
      'CHEMISTRY': '화학',
      'BIOLOGY': '생물학',
      'WORLD_HISTORY': '세계사',
      'KOREAN_HISTORY': '한국사',
      'KOREAN': '한국어',
      'ENGLISH': '영어',
      'CURRENT_AFFAIRS': '시사',
      'CULTURE': '문화',
      'SPORTS': '스포츠'
    };
    
    return category ? (categoryMap[category] || category) : '일반';
  };
  
  // 게임 상태 텍스트 변환
  const getStatusText = (status?: string) => {
    switch (status) {
      case "WAITING": return "대기중";
      case "IN_GAME": return "게임중";
      case "FINISHED": return "종료됨";
      default: return "대기중";
    }
  };
  
  if (!room) {
    return (
      <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5 mb-5">
        <div className="animate-pulse flex flex-wrap justify-between items-center">
          <div className="w-1/2 h-8 bg-gray-700 rounded mb-2"></div>
          <div className="w-24 h-10 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg p-5 mb-5">
      <div className="flex flex-wrap md:flex-nowrap justify-between items-center">
        <div className="flex items-center space-x-4 w-full md:w-auto mb-3 md:mb-0">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
            {room.title}
            <span className="ml-3 px-2.5 py-1 text-xs bg-indigo-600/50 text-indigo-200 rounded-md">
              #{roomId}
            </span>
          </h1>
          <div className="text-sm text-gray-400 flex flex-wrap gap-x-5 mt-1">
            <span className="flex items-center">
              <FaCrown className="mr-1.5 text-yellow-500" />
              {room.ownerNickname}
            </span>
            <span className="flex items-center">
              <FaUsers className="mr-1.5" />
              {room.currentPlayers}/{room.capacity}명
            </span>
            <span className="flex items-center">
              <FaInfoCircle className="mr-1.5" />
              {getStatusText(room.status)}
            </span>
          </div>
        </div>
        <button
          className="px-4 py-2.5 bg-red-600/80 text-white rounded-xl hover:bg-red-700 transition flex items-center shadow-md"
          onClick={onLeave}
        >
          <FaDoorOpen className="mr-2" />
          나가기
        </button>
      </div>
      
      {/* 추가 정보 섹션 */}
      {(room.difficulty || room.mainCategory || room.subCategory) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {room.difficulty && (
            <div className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded-md flex items-center">
              난이도: {getDifficultyText(room.difficulty)}
            </div>
          )}
          {room.mainCategory && (
            <div className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded-md flex items-center">
              카테고리: {getCategoryText(room.mainCategory)}
            </div>
          )}
          {room.subCategory && (
            <div className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded-md flex items-center">
              서브: {getCategoryText(room.subCategory)}
            </div>
          )}
          {room.problemCount && (
            <div className="text-xs bg-orange-900/50 text-orange-300 px-2 py-1 rounded-md flex items-center">
              문제수: {room.problemCount}개
            </div>
          )}
        </div>
      )}
    </div>
  );
} 