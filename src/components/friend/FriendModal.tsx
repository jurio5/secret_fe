import React, { useState, useEffect } from 'react';
import FriendList from './FriendList';
import FriendRequests from './FriendRequests';
import FriendSearch from './FriendSearch';
import { FriendModalProps, Friend, FriendRequest } from './types';
import { getFriendList, getFriendRequests, acceptFriendRequest, rejectFriendRequest, deleteFriend } from './friendApi';
// import { toast } from 'react-hot-toast';

const FriendModal: React.FC<FriendModalProps> = ({ 
  isOpen, 
  onClose, 
  friendRequestCount, 
  onRequestCountChange 
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friendList, setFriendList] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFriendList();
      fetchFriendRequests();
    }
  }, [isOpen]);

  const fetchFriendList = async () => {
    try {
      setIsLoadingFriends(true);
      console.log("친구 목록 로딩 시작...");
      const friends = await getFriendList();
      console.log("받은 친구 목록 데이터:", friends);
      setFriendList(friends);
      console.log("친구 목록 상태 업데이트 완료:", friends.length);
    } catch (error) {
      console.error("친구 목록을 불러오는데 실패했습니다:", error);
      // toast.error("친구 목록을 불러오는데 실패했습니다.");
      console.log("친구 목록을 불러오는데 실패했습니다.");
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const requests = await getFriendRequests();
      setFriendRequests(requests);
      
      // 부모 컴포넌트에 친구 요청 개수 전달
      if (onRequestCountChange) {
        onRequestCountChange(requests.length);
      }
    } catch (error) {
      console.error("친구 요청 목록을 불러오는데 실패했습니다:", error);
    }
  };

  const handleAcceptFriendRequest = async (memberId: number) => {
    try {
      const success = await acceptFriendRequest(memberId);
      if (success) {
        // toast.success("친구 요청을 수락했습니다.");
        console.log("친구 요청을 수락했습니다.");
        fetchFriendRequests();
        fetchFriendList();
      }
    } catch (error) {
      console.error("친구 요청 수락에 실패했습니다:", error);
      // toast.error("친구 요청 수락에 실패했습니다.");
      console.log("친구 요청 수락에 실패했습니다.");
    }
  };

  const handleRejectFriendRequest = async (memberId: number) => {
    try {
      const success = await rejectFriendRequest(memberId);
      if (success) {
        // toast.success("친구 요청을 거절했습니다.");
        console.log("친구 요청을 거절했습니다.");
        fetchFriendRequests();
      }
    } catch (error) {
      console.error("친구 요청 거절에 실패했습니다:", error);
      // toast.error("친구 요청 거절에 실패했습니다.");
      console.log("친구 요청 거절에 실패했습니다.");
    }
  };

  const handleDeleteFriend = async (memberId: number) => {
    try {
      const success = await deleteFriend(memberId);
      if (success) {
        // toast.success("친구가 삭제되었습니다.");
        console.log("친구가 삭제되었습니다.");
        fetchFriendList();
      }
    } catch (error) {
      console.error("친구 삭제에 실패했습니다:", error);
      // toast.error("친구 삭제에 실패했습니다.");
      console.log("친구 삭제에 실패했습니다.");
    }
  };

  if (!isOpen) return null;

  // 내부 상태 또는 props에서 친구 요청 개수 결정
  const requestCount = friendRequestCount !== undefined ? friendRequestCount : friendRequests.length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800/80 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700/50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">친구 관리</h2>

        <div className="flex border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'friends'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            친구 목록
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'requests'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            친구 요청
            {requestCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                {requestCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'search'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            사용자 검색
          </button>
        </div>

        {activeTab === 'friends' && (
          <FriendList 
            friendList={friendList} 
            isLoading={isLoadingFriends} 
            onDeleteFriend={handleDeleteFriend} 
          />
        )}

        {activeTab === 'requests' && (
          <FriendRequests 
            friendRequests={friendRequests} 
            onAccept={handleAcceptFriendRequest}
            onReject={handleRejectFriendRequest}
          />
        )}

        {activeTab === 'search' && (
          <FriendSearch 
            onFriendRequestSent={fetchFriendRequests} 
          />
        )}
      </div>
    </div>
  );
};

export default FriendModal; 