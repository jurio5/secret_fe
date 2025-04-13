import React, { useState } from 'react';
import { searchUserByNickname, sendFriendRequest } from './friendApi';
import { FriendSearchResult } from './types';
import Image from 'next/image';
// import { toast } from 'react-hot-toast';

interface FriendSearchProps {
  onFriendRequestSent: () => void;
}

const FriendSearch: React.FC<FriendSearchProps> = ({ onFriendRequestSent }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    
    try {
      // 현재 로그인한 사용자 정보 로깅
      console.log('현재 로그인한 사용자 정보:', (window as any).__INITIAL_USER__);
      
      const results = await searchUserByNickname(searchQuery);
      console.log('검색 결과와 친구 상태:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('사용자 검색 중 오류 발생:', error);
      // toast.error('사용자 검색에 실패했습니다.');
      console.log('사용자 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = async (memberId: number) => {
    try {
      const success = await sendFriendRequest(memberId);
      if (success) {
        // toast.success('친구 요청을 보냈습니다.');
        console.log('친구 요청을 보냈습니다.');
        onFriendRequestSent();
        // 요청 보낸 사용자를 목록에서 업데이트
        setSearchResults(prev => 
          prev.map(user => 
            user.memberId === memberId 
              ? { ...user, status: 'REQUESTED' } 
              : user
          )
        );
      }
    } catch (error) {
      console.error('친구 요청 전송 중 오류 발생:', error);
      // toast.error('친구 요청 전송에 실패했습니다.');
      console.log('친구 요청 전송에 실패했습니다.');
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="닉네임으로 사용자 검색"
            className="flex-1 bg-gray-800/70 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:text-blue-100/50 text-white rounded-lg transition-colors"
          >
            {isSearching ? '검색 중...' : '검색'}
          </button>
        </div>
      </form>

      {isSearching && (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {!isSearching && hasSearched && searchResults.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-center">검색 결과가 없습니다.</p>
          <p className="text-center text-sm mt-1">다른 닉네임으로 검색해보세요.</p>
        </div>
      )}

      {!isSearching && searchResults.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-900/30 rounded-lg overflow-hidden">
            <thead className="bg-gray-800/40">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-300">사용자</th>
                <th className="py-3 px-4 text-center text-sm font-medium text-gray-300">레벨</th>
                <th className="py-3 px-4 text-right text-sm font-medium text-gray-300">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {searchResults.map((user) => (
                <tr key={`user-${user.memberId}`} className="hover:bg-gray-800/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 h-10 w-10">
                        {user.avatarUrl ? (
                          <Image
                            src={user.avatarUrl}
                            alt={user.nickname || ''}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 h-10 w-10 flex items-center justify-center text-white font-medium">
                            {user.nickname?.[0] || '?'}
                          </div>
                        )}
                      </div>
                      <div className="font-medium text-white">{user.nickname}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-medium text-blue-300 bg-blue-900/30 px-2.5 py-1 rounded-lg border border-blue-500/20">
                      Lv.{user.level}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {user.status === 'FRIEND' ? (
                      <span className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-900/20 text-green-400">
                        이미 친구
                      </span>
                    ) : user.status === 'REQUESTED' ? (
                      <span className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-900/20 text-blue-400">
                        요청됨
                      </span>
                    ) : user.status === 'SELF' ? (
                      <span className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-800/40 text-gray-400">
                        나
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSendFriendRequest(user.memberId)}
                        className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                      >
                        친구 요청
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FriendSearch; 