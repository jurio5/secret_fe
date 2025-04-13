"use client";

import React from 'react';
import { RoomResponse } from '../../types/room';

interface RoomHeaderProps {
  room: RoomResponse | null;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({ room }) => {
  // 난이도 한글 변환 함수
  const getDifficultyText = (difficulty?: string) => {
    switch (difficulty) {
      case 'EASY':
        return '쉬움';
      case 'NORMAL':
        return '보통';
      case 'HARD':
        return '어려움';
      default:
        return '보통';
    }
  };

  // 카테고리 한글 변환 함수
  const getCategoryText = (category?: string) => {
    const categoryMap: Record<string, string> = {
      'GENERAL': '일반',
      'SCIENCE': '과학',
      'HISTORY': '역사',
      'GEOGRAPHY': '지리',
      'SPORTS': '스포츠',
      'ENTERTAINMENT': '엔터테인먼트',
      'TECHNOLOGY': '기술',
      'LITERATURE': '문학',
      'ART': '예술',
      'MUSIC': '음악',
    };
    
    return category ? (categoryMap[category] || category) : '일반';
  };

  // 로딩 상태일 때 (room이 null)
  if (!room) {
    return (
      <div className="p-4 border-b bg-white shadow-sm">
        <div className="flex items-center">
          <div className="flex-1">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-60 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b bg-white shadow-sm">
      <div className="flex items-center">
        <div className="flex-1">
          <div className="flex items-center">
            <h1 className="text-xl font-bold truncate mr-2">{room.title}</h1>
            <span className="text-sm bg-gray-100 px-2 py-1 rounded">{`방 번호: ${room.id}`}</span>
          </div>
          <div className="flex mt-1 text-sm text-gray-600">
            <span className="mr-3">
              난이도: {getDifficultyText(room.difficulty)}
            </span>
            <span className="mr-3">
              카테고리: {getCategoryText(room.mainCategory)}
            </span>
            <span>
              인원: {room.currentPlayers !== undefined ? room.currentPlayers : 0}/{room.capacity || 1}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomHeader; 