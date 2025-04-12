"use client";

import React from 'react';

interface StatCardsProps {
  nickname: string;
  level: number;
  rank: number;
  points: number;
}

const StatCards: React.FC<StatCardsProps> = ({
  nickname = "사용자",
  level = 1,
  rank = 99,
  points = 0
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div className="bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl p-4 border border-indigo-500/10 shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-gray-400 text-xs mb-1">내 프로필</h3>
            <p className="text-xl font-bold text-white">{nickname}</p>
          </div>
          <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md text-xs">
            Lv.{level}
          </span>
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl p-4 border border-indigo-500/10 shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-gray-400 text-xs mb-1">랭킹</h3>
            <p className="text-xl font-bold text-white">{rank}위</p>
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
            <p className="text-xl font-bold text-white">{points} P</p>
          </div>
          <button className="text-xs text-indigo-400 hover:text-indigo-300">
            상점가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatCards; 