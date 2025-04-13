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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-center">받은 친구 요청이 없습니다.</p>
        <p className="text-center text-sm mt-1">다른 사용자에게 친구 요청이 오면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-gray-900/30 rounded-lg overflow-hidden">
        <thead className="bg-gray-800/40">
          <tr>
            <th className="py-3 px-4 text-left text-sm font-medium text-gray-300">사용자</th>
            <th className="py-3 px-4 text-right text-sm font-medium text-gray-300">작업</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/30">
          {friendRequests.map((request) => (
            <tr key={`request-${request.memberId}`} className="hover:bg-gray-800/30">
              <td className="py-3 px-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 h-10 w-10">
                    {request.avatarUrl ? (
                      <Image
                        src={request.avatarUrl}
                        alt={request.nickname || ''}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                        onError={(e) => {
                          // 이미지 로드 실패 시 대체 이미지로 변경
                          const target = e.target as HTMLImageElement;
                          target.onerror = null; // 무한 루프 방지
                          target.src = "https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png"; // 기본 아바타 이미지
                        }}
                      />
                    ) : (
                      <div className="rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 h-10 w-10 flex items-center justify-center text-white font-medium">
                        {request.nickname?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white">{request.nickname}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(request.requestedAt).toLocaleDateString('ko-KR')}에 요청함
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex space-x-2 justify-end">
                  <button
                    onClick={() => onAccept(request.memberId)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 hover:bg-green-500 text-white transition-colors"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => onReject(request.memberId)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                  >
                    거절
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FriendRequests; 