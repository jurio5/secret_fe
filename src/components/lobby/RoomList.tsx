"use client";

import React from 'react';
import { components } from "@/lib/backend/apiV1/schema";

type Room = components["schemas"]["RoomResponse"];

interface RoomListProps {
  rooms: Room[];
  onRefresh: () => void;
}

const RoomList: React.FC<RoomListProps> = ({ rooms = [], onRefresh }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">방 목록</h2>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <input 
              type="search" 
              className="w-60 pl-9 pr-3 py-1.5 text-sm bg-[#10121f]/60 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              placeholder="방 제목 검색..." 
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          <button 
            onClick={onRefresh}
            className="flex items-center justify-center w-8 h-8 bg-[#10121f]/60 hover:bg-[#161a2d]/60 rounded-lg text-white transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* 방 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rooms.length > 0 ? (
          rooms.map((room) => (
            <div key={room.id} className="bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl overflow-hidden border border-indigo-500/10 hover:border-indigo-500/30 transition-all shadow-lg cursor-pointer group">
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-white font-bold text-base truncate">{room.title}</h3>
                  <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded">대기중</span>
                </div>
                
                <div className="flex justify-between items-center text-xs mb-2">
                  <div className="text-gray-400">방장: {room.ownerNickname || '알 수 없음'}</div>
                  <div className="text-gray-400">난이도: 보통</div>
                </div>
                
                <div className="flex justify-between items-center mt-3">
                  <div className="text-indigo-400 text-xs">
                    {room.currentPlayers || 1}/{room.capacity || 4} 명
                  </div>
                  <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs transition-colors opacity-90 group-hover:opacity-100">
                    입장하기
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 bg-gradient-to-br from-[#10121f]/80 to-[#0d0f1a]/80 backdrop-blur-sm rounded-xl p-8 text-center shadow-lg border border-indigo-500/10">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 mb-4 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">아직 생성된 방이 없습니다</h3>
              <p className="text-gray-400 text-sm mb-4">첫 번째 방을 만들고 친구들을 초대해보세요!</p>
              
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md flex items-center gap-2 transition-colors text-sm shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                방 만들기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomList; 