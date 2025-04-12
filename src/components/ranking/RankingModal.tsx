'use client';

import { useState, useEffect } from 'react';
import client from "@/lib/backend/client";
import { fetchWithRetry, fetchWithAuthErrorHandling } from '@/lib/utils/apiUtils';

// 상수 정의
const DEFAULT_AVATAR = 'https://quizzle-avatars.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8+%EC%95%84%EB%B0%94%ED%83%80.png';

// 인터페이스 정의
interface MemberRanking {
  id: number;
  nickname: string;
  exp: number;
  level: number;
  rank: number;
  avatarUrl?: string;
}

interface UserProfile {
  id?: number;
  nickname?: string;
  avatarUrl?: string;
  level?: number;
  exp?: number;
  point?: number;
  loading?: boolean;
  error?: string;
  lastUpdated?: number;
}

type ApiResponse<T> = {
  error?: {
    message?: string;
  };
  data?: {
    data: T;
  };
};

interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  duration: number;
}

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: number;
  onToast?: (toast: ToastProps) => void;
}

export default function RankingModal({ isOpen, onClose, currentUserId, onToast }: RankingModalProps) {
  const [rankings, setRankings] = useState<MemberRanking[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState<boolean>(false);
  const userProfileCache: Record<number, UserProfile> = {};

  useEffect(() => {
    if (isOpen) {
      fetchRankings();
    }
  }, [isOpen]);

  // 랭킹 정보 가져오기
  const fetchRankings = async () => {
    setIsLoadingRankings(true);
    
    try {
      // fetchWithAuthErrorHandling 사용하여 인증 오류 처리
      const response = await fetchWithAuthErrorHandling(
        () => client.GET("/api/v1/members/rankings") as Promise<ApiResponse<MemberRanking[]>>,
        () => {
          // 인증 오류 발생 시 토스트 메시지 표시
          if (onToast) {
            onToast({
              type: "error",
              message: "인증이 필요합니다. 다시 로그인해주세요.",
              duration: 3000
            });
          }
        }
      );
      
      if (response.error) {
        console.error("랭킹 정보를 가져오는데 실패했습니다:", response.error);
        
        if (onToast) {
          onToast({
            type: "error",
            message: "랭킹 정보를 불러오는데 실패했습니다.",
            duration: 3000
          });
        }
        
        return;
      }
      
      if (response.data?.data) {
        // 우선 기본 데이터로 UI 업데이트 (기본 아바타 사용)
        const rankingsWithRank = response.data.data.map((ranking, index) => ({
          ...ranking,
          rank: index + 1,
          avatarUrl: DEFAULT_AVATAR // 기본 아바타로 초기화
        }));
        
        // 우선 기본 아바타로 UI 업데이트
        setRankings(rankingsWithRank);
        
        // 백그라운드에서 순차적으로 아바타 정보 가져오기
        const updateAvatars = async () => {
          for (const ranking of rankingsWithRank) {
            try {
              // 캐시에 이미 사용자 정보가 있는지 확인
              if (userProfileCache[ranking.id]?.avatarUrl) {
                // 캐시된 정보로 UI 업데이트
                setRankings(prevRankings => 
                  prevRankings.map(r => 
                    r.id === ranking.id 
                      ? { ...r, avatarUrl: userProfileCache[ranking.id].avatarUrl } 
                      : r
                  )
                );
                continue;
              }
              
              // 재시도 로직 포함하여 사용자 정보 가져오기
              const profileResponse = await fetchWithRetry(
                () => client.GET(`/api/v1/members/{memberId}`, {
                  params: { path: { memberId: ranking.id } }
                }) as Promise<ApiResponse<UserProfile>>,
                1, // 최대 1번 재시도
                300 // 300ms 대기 후 재시도
              );
              
              if (profileResponse.data?.data) {
                // 캐시 업데이트
                userProfileCache[ranking.id] = {
                  ...profileResponse.data.data,
                  lastUpdated: Date.now()
                };
                
                // UI 업데이트 (하나씩 순차적으로)
                setRankings(prevRankings => 
                  prevRankings.map(r => 
                    r.id === ranking.id 
                      ? { ...r, avatarUrl: profileResponse.data!.data.avatarUrl || DEFAULT_AVATAR } 
                      : r
                  )
                );
              }
            } catch (error) {
              console.error(`사용자 ${ranking.id}의 아바타 정보를 가져오는데 실패했습니다:`, error);
              // 오류가 발생해도 다음 사용자 진행
            }
            
            // 서버 부하 방지를 위한 짧은 대기
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        };
        
        // 백그라운드에서 실행
        updateAvatars();
      }
    } catch (error) {
      console.error("랭킹 정보를 가져오는데 실패했습니다:", error);
      
      if (onToast) {
        onToast({
          type: "error",
          message: "서버 연결에 문제가 발생했습니다.",
          duration: 3000
        });
      }
    } finally {
      setIsLoadingRankings(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800/90 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 relative">
        {/* 닫기 버튼 */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
          <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-full mr-2 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </div>
          <span>랭킹</span>
        </h3>
        
        {isLoadingRankings ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : rankings.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-700 max-h-[400px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700/50 sticky top-0">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">순위</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">사용자</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">레벨</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">경험치</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800/30 divide-y divide-gray-700">
                {rankings.map((ranking, index) => (
                  <tr 
                    key={ranking.id}
                    className={`${
                      currentUserId === ranking.id ? 'bg-blue-900/30' : 
                      index % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-800/20'
                    } hover:bg-gray-700/30 transition-colors`}
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      {ranking.rank <= 3 ? (
                        <div className={`flex items-center justify-center rounded-full w-7 h-7 ${
                          ranking.rank === 1 ? 'bg-yellow-500' : 
                          ranking.rank === 2 ? 'bg-gray-400' : 
                          'bg-amber-700'
                        }`}>
                          <span className="font-bold text-white">{ranking.rank}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">{ranking.rank}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <img 
                            className="h-8 w-8 rounded-full" 
                            src={ranking.avatarUrl || DEFAULT_AVATAR} 
                            alt={ranking.nickname} 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                            }}
                          />
                        </div>
                        <div className="ml-3">
                          <div className={`font-medium ${currentUserId === ranking.id ? 'text-blue-400' : 'text-white'}`}>
                            {ranking.nickname}
                            {currentUserId === ranking.id && <span className="ml-2 text-xs text-blue-400">(나)</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-gray-200">Lv. {ranking.level}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        <span className="text-blue-400">{ranking.exp.toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 110 20 10 10 0 010-20z" />
            </svg>
            <p className="text-gray-400">랭킹 정보가 없습니다.</p>
          </div>
        )}
        
        <div className="mt-4 text-center text-sm text-gray-400">
          <p>경험치는 퀴즈를 풀어서 정답을 맞출 때 획득할 수 있습니다.</p>
          <p className="mt-1">더 많은 퀴즈에 도전하여 랭킹에 도전해보세요!</p>
        </div>
      </div>
    </div>
  );
} 