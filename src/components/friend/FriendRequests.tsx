import React from 'react';
import { FriendRequest } from './types';
import Image from 'next/image';

interface FriendRequestsProps {
  friendRequests: FriendRequest[];
  onAccept: (memberId: number) => void;
  onReject: (memberId: number) => void;
}

const FriendRequests: React.FC<FriendRequestsProps> = ({ friendRequests, onAccept, onReject }) => {
  if (friendRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <p className="text-center">받은 친구 요청이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-gray-900/30 rounded-lg overflow-hidden">
        <thead className="bg-gray-800/40">
          <tr>
            <th className="py-3 px-4 text-left text-sm font-medium text-gray-300">사용자</th>
            <th className="py-3 px-4 text-center text-sm font-medium text-gray-300">요청일</th>
            <th className="py-3 px-4 text-right text-sm font-medium text-gray-300">액션</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/30">
          {friendRequests.map((request) => (
            <tr key={`friend-request-${request.memberId}`} className="hover:bg-gray-800/30">
              <td className="py-3 px-4">
                <div className="flex items-center space-x-3">
                  <div className="relative flex-shrink-0 h-10 w-10">
                    {request.avatarUrl ? (
                      <Image
                        src={request.avatarUrl}
                        alt={request.nickname || ''}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="rounded-full bg-gradient-to-r from-purple-400 to-pink-500 h-10 w-10 flex items-center justify-center text-white font-medium">
                        {request.nickname?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div className="font-medium text-white">{request.nickname}</div>
                </div>
              </td>
              <td className="py-3 px-4 text-center text-sm text-gray-300">
                {new Date(request.requestedAt).toLocaleDateString('ko-KR')}
              </td>
              <td className="py-3 px-4 text-right space-x-2">
                <button
                  onClick={() => onAccept(request.memberId)}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-green-400 hover:text-green-300 hover:bg-green-900/20 transition-colors"
                >
                  수락
                </button>
                <button
                  onClick={() => onReject(request.memberId)}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
                >
                  거절
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FriendRequests; 