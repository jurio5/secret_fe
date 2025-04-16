import React, { useState, useEffect } from 'react';
import { ShopModalProps, Avatar } from './types';
import { getOwnedAvatars, getAvailableAvatars, purchaseAvatar, equipAvatar, getUserPoints } from './shopApi';
import { toast } from 'react-hot-toast';

const ShopModal: React.FC<ShopModalProps> = ({ 
  isOpen, 
  onClose,
  currentPoints: initialPoints,
  onAvatarPurchased,
  userId
}) => {
  const [activeTab, setActiveTab] = useState<'available' | 'owned'>('available');
  const [availableAvatars, setAvailableAvatars] = useState<Avatar[]>([]);
  const [ownedAvatars, setOwnedAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isEquipping, setIsEquipping] = useState(false);
  const [points, setPoints] = useState(initialPoints || 0);
  const [currentAvatarId, setCurrentAvatarId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    if (!isOpen || !userId) return;
    
    setIsLoading(true);
    try {
      const [owned, available, userPoints] = await Promise.all([
        getOwnedAvatars(userId),
        getAvailableAvatars(userId),
        initialPoints === undefined ? getUserPoints(userId) : Promise.resolve(initialPoints)
      ]);
      
      setOwnedAvatars(owned);
      setAvailableAvatars(available);
      setPoints(userPoints);
      
      // 현재 장착된 아바타 찾기
      const equippedAvatar = owned.find(avatar => avatar.status === 'EQUIPPED');
      if (equippedAvatar) {
        setCurrentAvatarId(equippedAvatar.id);
      }
    } catch (error) {
      console.error('상점 데이터를 불러오는데 실패했습니다:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (avatarId: number) => {
    if (!userId) return;

    setIsPurchasing(true);
    try {
      const success = await purchaseAvatar(avatarId, userId);
      if (success) {
        // 구매 성공 후 데이터 다시 불러오기
        await loadData();
        
        // 구매 완료 콜백 호출
        if (onAvatarPurchased) {
          onAvatarPurchased();
        }
      }
    } catch (error) {
      console.error('아바타 구매에 실패했습니다:', error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleEquip = async (avatarId: number) => {
    console.log(`아바타 ID ${avatarId} 장착 요청`);
    try {
      const success = await equipAvatar(avatarId);
      
      if (success) {
        toast.success('아바타가 성공적으로 변경되었습니다!');
        
        // 유저 프로필 캐시 업데이트를 위해 콜백 호출
        if (onAvatarPurchased) {
          await onAvatarPurchased();
        }
        
        // 방 내 프로필 업데이트를 위한 웹소켓 메시지 발행
        try {
          const roomId = window.location.pathname.split('/').pop();
          if (roomId && !isNaN(Number(roomId))) {
            // 방 안에 있는 경우에만 발행
            const { publish } = await import('@/lib/backend/stompClient');
            
            // 두 채널에 모두 발행하여 확실하게 알림
            publish(`/app/room/${roomId}/status`, {
              type: "AVATAR_UPDATE",
              senderId: userId,
              avatarUrl: ownedAvatars.find(a => a.id === avatarId)?.url,
              timestamp: Date.now()
            });
            
            publish(`/app/room/${roomId}`, {
              type: "AVATAR_UPDATE",
              senderId: userId,
              avatarUrl: ownedAvatars.find(a => a.id === avatarId)?.url,
              timestamp: Date.now()
            });
            
            console.log("아바타 변경 웹소켓 메시지 발행:", roomId);
            
            // 모달 닫기
            onClose();
            
            // 아바타가 즉시 방에 반영되도록 강제 새로고침
            toast.success('아바타가 적용되었습니다. 페이지를 새로고침합니다...');
            setTimeout(() => {
              window.location.reload();
            }, 1000);
            return; // 방에 있는 경우 여기서 종료
          }
        } catch (wsError) {
          console.error("웹소켓 메시지 발행 중 오류:", wsError);
        }
        
        // 방에 있지 않은 경우에만 실행
        // 모달 닫기
        setActiveTab('owned');
        loadData();
      } else {
        console.error("아바타 장착 실패");
        
        // 상세 에러 로그 확인을 위한 안내 메시지
        toast.error("아바타 장착에 실패했습니다. 콘솔을 확인해주세요 (F12)");
      }
    } catch (error) {
      console.error("아바타 장착 중 오류:", error);
      toast.error("아바타 장착에 실패했습니다. 콘솔을 확인해주세요 (F12)");
    }
  };

  if (!isOpen) return null;

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

        <div className="flex flex-col mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">아바타 상점</h2>
          <div className="bg-gray-700/70 px-4 py-2 rounded-lg inline-flex items-center self-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold text-yellow-400">{points.toLocaleString()} 포인트</span>
          </div>
        </div>

        <div className="flex border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'available'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            구매 가능한 아바타
          </button>
          <button
            onClick={() => setActiveTab('owned')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'owned'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            내 아바타
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {activeTab === 'available' && availableAvatars.map((avatar) => (
              <div key={avatar.id} className="bg-gray-700/50 rounded-lg p-4 flex flex-col items-center">
                <div className="w-28 h-28 mb-4 rounded-full overflow-hidden bg-gray-600">
                  <img 
                    src={avatar.url} 
                    alt={avatar.fileName} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/default-avatar.png';
                    }}
                  />
                </div>
                <h3 className="text-white font-medium text-lg mb-2 text-center">{avatar.fileName}</h3>
                <p className="text-yellow-400 font-semibold mb-4">{avatar.price.toLocaleString()} 포인트</p>
                <button
                  onClick={() => handlePurchase(avatar.id)}
                  disabled={isPurchasing || points < avatar.price}
                  className={`w-full py-2 rounded-md ${
                    points >= avatar.price 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  } transition-colors duration-300`}
                >
                  {isPurchasing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      구매 중...
                    </span>
                  ) : (
                    points >= avatar.price ? '구매하기' : '포인트 부족'
                  )}
                </button>
              </div>
            ))}

            {activeTab === 'owned' && ownedAvatars.map((avatar) => (
              <div key={avatar.id} className={`bg-gray-700/50 rounded-lg p-4 flex flex-col items-center ${
                currentAvatarId === avatar.id ? 'ring-2 ring-blue-500' : ''
              }`}>
                <div className="w-28 h-28 mb-4 rounded-full overflow-hidden bg-gray-600 relative">
                  <img 
                    src={avatar.url} 
                    alt={avatar.fileName} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/default-avatar.png';
                    }}
                  />
                  {currentAvatarId === avatar.id && (
                    <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="text-white font-medium text-lg mb-4 text-center">{avatar.fileName}</h3>
                <button
                  onClick={() => handleEquip(avatar.id)}
                  disabled={isEquipping || currentAvatarId === avatar.id}
                  className={`w-full py-2 rounded-md ${
                    currentAvatarId === avatar.id
                      ? 'bg-green-500 text-white cursor-default'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  } transition-colors duration-300`}
                >
                  {isEquipping ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      적용 중...
                    </span>
                  ) : (
                    currentAvatarId === avatar.id ? '사용 중' : '사용하기'
                  )}
                </button>
              </div>
            ))}

            {activeTab === 'available' && availableAvatars.length === 0 && (
              <div className="col-span-3 text-center text-gray-400 py-12">
                구매 가능한 아바타가 없습니다.
              </div>
            )}

            {activeTab === 'owned' && ownedAvatars.length === 0 && (
              <div className="col-span-3 text-center text-gray-400 py-12">
                소유한 아바타가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopModal; 