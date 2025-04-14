"use client";

import { FaCheck, FaTimes } from 'react-icons/fa';

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
  // 점수 기준으로 정렬
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  
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
              {player.lastAnswerCorrect !== undefined && (
                <div className="mr-2">
                  {player.lastAnswerCorrect ? (
                    <FaCheck className="text-green-400" />
                  ) : (
                    <FaTimes className="text-red-400" />
                  )}
                </div>
              )}
              <div className="text-xl font-bold text-blue-400">{player.score}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 