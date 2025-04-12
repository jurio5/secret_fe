"use client";

import React from 'react';

interface UserProfileProps {
  username: string;
  level: number;
  points: number;
  rank: string;
}

const UserProfile: React.FC<UserProfileProps> = ({
  username = "테스터박",
  level = 1,
  points = 0,
  rank = "Bronze"
}) => {
  return (
    <div className="p-4 border-b border-indigo-900/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-indigo-600/30 flex items-center justify-center text-xl font-medium overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
            <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-white">{username}</h3>
          <div className="text-xs text-gray-400">레벨 {level}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="bg-indigo-900/20 rounded p-1.5">
          <div className="text-gray-400">포인트</div>
          <div className="text-white font-medium">{points}</div>
        </div>
        <div className="bg-indigo-900/20 rounded p-1.5">
          <div className="text-gray-400">등급</div>
          <div className="text-white font-medium">{rank}</div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 