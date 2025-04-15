"use client";

import { useState, useEffect, useRef } from 'react';

interface PlayerScore {
  id: string;
  nickname: string;
  avatarUrl: string;
  score: number;
  lastAnswerCorrect?: boolean;
  isReady?: boolean;
}

interface PlayerScoresProps {
  scores: PlayerScore[];
  currentUserId: string;
}

export default function PlayerScores({ scores, currentUserId }: PlayerScoresProps) {
  // 이전 점수를 저장하기 위한 상태
  const [prevScores, setPrevScores] = useState<{[key: string]: number}>({});
  // 애니메이션 점수를 저장하기 위한 상태
  const [animatedScores, setAnimatedScores] = useState<{[key: string]: number}>({});
  // 애니메이션 활성화 플래그
  const [animations, setAnimations] = useState<{[key: string]: boolean}>({});
  
  // 점수 기준으로 정렬
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  
  // requestAnimationFrame의 ID를 저장하기 위한 ref
  const animationFrames = useRef<{[key: string]: number}>({});
  
  // 애니메이션 발생시킬 때 적용할 시간(ms)
  const ANIMATION_DURATION = 1000;
  
  useEffect(() => {
    // 초기화
    if (Object.keys(prevScores).length === 0) {
      const initialScores: {[key: string]: number} = {};
      const initialAnimated: {[key: string]: number} = {};
      
      scores.forEach(player => {
        initialScores[player.id] = player.score;
        initialAnimated[player.id] = player.score;
      });
      
      setPrevScores(initialScores);
      setAnimatedScores(initialAnimated);
      return;
    }
    
    // 점수 변화 감지 및 애니메이션 적용
    const newAnimations: {[key: string]: boolean} = {};
    const newAnimatedScores = {...animatedScores};
    
    scores.forEach(player => {
      // 이전 점수와 다르면 애니메이션 트리거
      if (prevScores[player.id] !== undefined && prevScores[player.id] !== player.score) {
        newAnimations[player.id] = true;
        
        // 기존 애니메이션이 있으면 취소
        if (animationFrames.current[player.id]) {
          cancelAnimationFrame(animationFrames.current[player.id]);
        }
        
        // 점수 증가 애니메이션 시작
        const startTime = Date.now();
        const startValue = prevScores[player.id];
        const endValue = player.score;
        const changeInValue = endValue - startValue;
        
        const animateScore = () => {
          const currentTime = Date.now();
          const elapsed = currentTime - startTime;
          
          if (elapsed < ANIMATION_DURATION) {
            // 부드러운 easeOut 효과 (cubic-bezier)
            const progress = 1 - Math.pow(1 - elapsed / ANIMATION_DURATION, 3);
            const currentValue = startValue + changeInValue * progress;
            
            setAnimatedScores(prev => ({
              ...prev,
              [player.id]: Math.round(currentValue)
            }));
            
            animationFrames.current[player.id] = requestAnimationFrame(animateScore);
          } else {
            // 애니메이션 종료
            setAnimatedScores(prev => ({
              ...prev,
              [player.id]: endValue
            }));
            
            // 500ms 후 애니메이션 플래그 해제
            setTimeout(() => {
              setAnimations(prev => ({
                ...prev,
                [player.id]: false
              }));
            }, 500);
          }
        };
        
        animationFrames.current[player.id] = requestAnimationFrame(animateScore);
      }
    });
    
    // 애니메이션 상태 업데이트
    if (Object.keys(newAnimations).length > 0) {
      setAnimations(prev => ({...prev, ...newAnimations}));
    }
    
    // 이전 점수 업데이트
    const newPrevScores: {[key: string]: number} = {};
    scores.forEach(player => {
      newPrevScores[player.id] = player.score;
    });
    setPrevScores(newPrevScores);
    
    // 컴포넌트 unmount 시 모든 애니메이션 정리
    return () => {
      Object.values(animationFrames.current).forEach(id => {
        cancelAnimationFrame(id);
      });
    };
  }, [scores]);
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 h-full">
      <h2 className="text-lg font-semibold text-white mb-3">참가자 점수</h2>
      
      <div className="space-y-2 overflow-y-auto max-h-[calc(100%-2rem)]">
        {sortedScores.map((player) => (
          <div 
            key={player.id} 
            className={`flex items-center bg-gray-800/80 p-3 rounded-lg ${
              player.id === currentUserId ? 'border-2 border-blue-500' : 'border border-gray-700'
            }`}
          >
            <img 
              src={player.avatarUrl} 
              alt={player.nickname} 
              className="w-10 h-10 rounded-full" 
            />
            <div className="ml-3 flex-grow">
              <div className="font-medium text-white">
                {player.nickname}
                {player.id === currentUserId && (
                  <span className="ml-2 text-xs text-blue-400">(나)</span>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div 
                className={`text-xl font-bold transition-all duration-300 ${
                  animations[player.id] 
                    ? 'text-yellow-400 scale-125' 
                    : 'text-blue-400 scale-100'
                }`}
              >
                {animatedScores[player.id] !== undefined 
                  ? animatedScores[player.id] 
                  : player.score}점
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 