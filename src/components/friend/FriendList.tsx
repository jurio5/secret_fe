import React from 'react';
import { Friend } from './types';
import Image from 'next/image';

interface FriendListProps {
  friendList: Friend[];
  isLoading: boolean;
  onDeleteFriend: (memberId: number) => void;
}

const FriendList: React.FC<FriendListProps> = ({ friendList, isLoading, onDeleteFriend }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-60">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (friendList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-center">아직 친구가 없습니다.</p>
        <p className="text-center text-sm mt-1">다른 사용자에게 친구 요청을 보내보세요!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-gray-900/30 rounded-lg overflow-hidden">
        <thead className="bg-gray-800/40">
          <tr>
            <th className="py-3 px-4 text-left text-sm font-medium text-gray-300">사용자</th>
            <th className="py-3 px-2 text-center text-sm font-medium text-gray-300">상태</th>
            <th className="py-3 px-2 text-center text-sm font-medium text-gray-300">레벨</th>
            <th className="py-3 px-2 text-right text-sm font-medium text-gray-300">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/30">
          {friendList.map((friend, i) => (
            <tr key={`friend-${friend.memberId}`} className="hover:bg-gray-800/30">
              <td className="py-3 px-4">
                <div className="flex items-center space-x-3">
                  <div className="relative flex-shrink-0 h-10 w-10">
                    {friend.avatarUrl ? (
                      <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-gray-700">
                        <Image
                          src={friend.avatarUrl}
                          alt={friend.nickname || ''}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 h-10 w-10 flex items-center justify-center text-white font-medium border-2 border-gray-700">
                        {friend.nickname?.[0] || '?'}
                      </div>
                    )}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-gray-800 flex items-center justify-center ${friend.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}>
                      {friend.isOnline && (
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-white">{friend.nickname}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(friend.acceptedAt).toLocaleDateString('ko-KR')} 부터 친구
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-3 text-center">
                {friend.isOnline ? (
                  <span className="px-2.5 py-1.5 text-xs font-medium rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                    온라인
                  </span>
                ) : (
                  <span className="px-2.5 py-1.5 text-xs font-medium rounded-full bg-gray-700/30 text-gray-400 border border-gray-600/30">
                    오프라인
                  </span>
                )}
              </td>
              <td className="py-3 text-center">
                <span className="font-medium text-blue-300 bg-blue-900/30 px-2.5 py-1 rounded-lg border border-blue-500/20">
                  Lv.{friend.level}
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <button
                  onClick={() => onDeleteFriend(friend.memberId)}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FriendList; 