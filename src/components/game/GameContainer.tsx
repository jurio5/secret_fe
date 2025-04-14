"use client";

import { useState, useEffect, useRef } from "react";
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";
import QuizQuestion from "./QuizQuestion";
import Timer from "./Timer";
import PlayerScores from "./PlayerScores";
import { FaFlag, FaClock } from "react-icons/fa";

// 퀴즈 문제 타입 정의
interface QuizQuestionType {
  id: string;
  questionNumber: number;
  question: string;
  choices: string[];
  correctAnswer: string | number;
  category: string;
  subCategory?: string;
  explanation?: string;
  timeLimit: number;
}

// 플레이어 점수 타입 정의
interface PlayerScore {
  id: string;
  nickname: string;
  avatarUrl: string;
  score: number;
  lastAnswerCorrect?: boolean;
  isReady?: boolean;
}

interface GameContainerProps {
  roomId: string;
  currentUserId: string | number;
  players: any[];
}

export default function GameContainer({ roomId, currentUserId, players }: GameContainerProps) {
  // 게임 상태 관리
  const [gameStatus, setGameStatus] = useState<"WAITING" | "IN_PROGRESS" | "FINISHED">("WAITING");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [questions, setQuestions] = useState<QuizQuestionType[]>([]);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState<boolean>(false);
  const [showFinalResults, setShowFinalResults] = useState<boolean>(false);
  
  // 현재 문제 정보
  const currentQuestion = questions[currentQuestionIndex];
  
  // 웹소켓 구독 설정
  useEffect(() => {
    // 문제 변경 이벤트 구독
    subscribe(`/topic/room/${roomId}/question`, (data) => {
      console.log("문제 업데이트 수신:", data);
      
      if (data.type === "NEW_QUESTION") {
        // 새 문제 수신 시
        setShowResults(false);
        setSelectedAnswer(null);
        setAnswerSubmitted(false);
        
        if (data.questionIndex !== undefined) {
          setCurrentQuestionIndex(data.questionIndex);
        }
        
        if (data.timeLimit) {
          setTimeLeft(data.timeLimit);
        }
      } else if (data.type === "SHOW_RESULT") {
        // 결과 표시 이벤트 수신 시
        setShowResults(true);
      } else if (data.type === "GAME_FINISHED") {
        // 게임 종료 이벤트 수신 시
        setGameStatus("FINISHED");
        setShowFinalResults(true);
      }
    });
    
    // 점수 업데이트 이벤트 구독
    subscribe(`/topic/room/${roomId}/scores`, (data) => {
      console.log("점수 업데이트 수신:", data);
      
      if (data.scores) {
        setPlayerScores(data.scores);
      }
    });
    
    // 게임 시작 시 문제 데이터 로드
    fetchQuestions();
    
    // 초기 플레이어 점수 설정
    initializePlayerScores();
    
    return () => {
      // 컴포넌트 언마운트 시 구독 해제
      unsubscribe(`/topic/room/${roomId}/question`);
      unsubscribe(`/topic/room/${roomId}/scores`);
    };
  }, [roomId]);
  
  // 플레이어 점수 초기화
  const initializePlayerScores = () => {
    const initialScores = players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      avatarUrl: player.avatarUrl,
      score: 0,
      lastAnswerCorrect: false,
      isReady: player.isReady
    }));
    
    setPlayerScores(initialScores);
  };
  
  // 문제 데이터 가져오기
  const fetchQuestions = async () => {
    try {
      // TODO: 실제 API 호출로 대체
      // 임시 데이터
      const dummyQuestions: QuizQuestionType[] = [
        {
          id: "q1",
          questionNumber: 1,
          question: "세계에서 가장 긴 강은 무엇일까요?",
          choices: ["아마존 강", "나일 강", "양쯔 강", "미시시피 강"],
          correctAnswer: 1, // 인덱스 1, 즉 "나일 강"
          category: "GENERAL_KNOWLEDGE",
          subCategory: "GEOGRAPHY",
          explanation: "나일강은 길이 6,650km로 세계에서 가장 긴 강입니다.",
          timeLimit: 15
        },
        {
          id: "q2",
          questionNumber: 2,
          question: "대한민국의 수도는?",
          choices: ["부산", "서울", "인천", "대전"],
          correctAnswer: 1, // 인덱스 1, 즉 "서울"
          category: "GENERAL_KNOWLEDGE",
          subCategory: "GEOGRAPHY",
          explanation: "대한민국의 수도는 서울입니다.",
          timeLimit: 10
        },
        {
          id: "q3",
          questionNumber: 3,
          question: "E=mc²를 제안한 과학자는?",
          choices: ["아이작 뉴턴", "앨버트 아인슈타인", "니콜라 테슬라", "갈릴레오 갈릴레이"],
          correctAnswer: 1, // 인덱스 1, 즉 "앨버트 아인슈타인"
          category: "SCIENCE",
          subCategory: "PHYSICS",
          explanation: "질량-에너지 등가원리(E=mc²)는 앨버트 아인슈타인이 제안했습니다.",
          timeLimit: 12
        }
      ];
      
      setQuestions(dummyQuestions);
      setGameStatus("IN_PROGRESS");
      
      // 첫 번째 문제 시간 설정
      if (dummyQuestions.length > 0) {
        setTimeLeft(dummyQuestions[0].timeLimit);
      }
    } catch (error) {
      console.error("문제 데이터를 가져오는데 실패했습니다:", error);
    }
  };
  
  // 답변 제출 처리
  const handleSubmitAnswer = (answer: string) => {
    if (answerSubmitted || !currentQuestion) return;
    
    setSelectedAnswer(answer);
    setAnswerSubmitted(true);
    
    // 서버에 답변 제출
    const isCorrect = answer === currentQuestion.choices[currentQuestion.correctAnswer as number];
    
    publish(`/app/room/${roomId}/answer`, {
      questionId: currentQuestion.id,
      playerId: currentUserId,
      answer: answer,
      isCorrect: isCorrect,
      timestamp: Date.now()
    });
    
    // 로컬에서 결과 미리 표시 (실제 게임에서는 서버에서 결과 수신 후 표시)
    if (isCorrect) {
      // 정답 처리
      setPlayerScores(prevScores => 
        prevScores.map(player => 
          player.id === currentUserId.toString() 
            ? { ...player, score: player.score + 100, lastAnswerCorrect: true }
            : player
        )
      );
    } else {
      // 오답 처리
      setPlayerScores(prevScores => 
        prevScores.map(player => 
          player.id === currentUserId.toString() 
            ? { ...player, lastAnswerCorrect: false }
            : player
        )
      );
    }
  };
  
  // 다음 문제로 이동
  const moveToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedAnswer(null);
      setAnswerSubmitted(false);
      setShowResults(false);
      setTimeLeft(questions[currentQuestionIndex + 1].timeLimit);
    } else {
      // 모든 문제가 끝난 경우
      setGameStatus("FINISHED");
      setShowFinalResults(true);
    }
  };
  
  // 타이머 만료 처리
  const handleTimerExpired = () => {
    if (!answerSubmitted) {
      setAnswerSubmitted(true);
      
      // 시간 초과로 자동 오답 처리
      publish(`/app/room/${roomId}/answer`, {
        questionId: currentQuestion?.id,
        playerId: currentUserId,
        answer: null,
        isCorrect: false,
        timestamp: Date.now()
      });
      
      // 로컬 상태 업데이트
      setPlayerScores(prevScores => 
        prevScores.map(player => 
          player.id === currentUserId.toString() 
            ? { ...player, lastAnswerCorrect: false }
            : player
        )
      );
    }
    
    // 결과 표시 (실제 게임에서는 서버에서 결과 표시 메시지 수신 후 표시)
    setTimeout(() => {
      setShowResults(true);
    }, 1000);
  };
  
  // 게임 대기 화면
  if (gameStatus === "WAITING") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">게임이 곧 시작됩니다...</p>
        </div>
      </div>
    );
  }
  
  // 게임 종료 후 최종 결과 화면
  if (showFinalResults) {
    return (
      <div className="bg-gray-900/60 rounded-2xl p-6 h-full">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">최종 결과</h2>
        
        {/* 승자 표시 */}
        {playerScores.length > 0 && (
          <div className="mb-8 text-center">
            <div className="text-lg text-gray-300 mb-2">승자</div>
            <div className="inline-block bg-gradient-to-r from-indigo-600 to-blue-600 p-1 rounded-xl">
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-center mb-2">
                  <img 
                    src={playerScores.sort((a, b) => b.score - a.score)[0].avatarUrl} 
                    alt="Winner" 
                    className="w-16 h-16 rounded-full border-4 border-yellow-500"
                  />
                </div>
                <div className="text-xl font-bold text-white">
                  {playerScores.sort((a, b) => b.score - a.score)[0].nickname}
                </div>
                <div className="text-2xl font-bold text-yellow-500 mt-1">
                  {playerScores.sort((a, b) => b.score - a.score)[0].score} 점
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 순위표 */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">점수 순위</h3>
          <div className="space-y-3">
            {playerScores
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <div 
                  key={player.id} 
                  className={`flex items-center bg-gray-800/80 p-3 rounded-lg ${
                    player.id === currentUserId.toString() ? 'border-2 border-blue-500' : 'border border-gray-700'
                  }`}
                >
                  <div className="w-8 h-8 flex items-center justify-center font-bold rounded-full bg-gray-700 text-white">
                    {index + 1}
                  </div>
                  <img 
                    src={player.avatarUrl} 
                    alt={player.nickname} 
                    className="w-10 h-10 rounded-full mx-3" 
                  />
                  <div className="flex-grow">
                    <div className="font-medium text-white">{player.nickname}</div>
                  </div>
                  <div className="text-xl font-bold text-blue-400">{player.score}</div>
                </div>
              ))}
          </div>
        </div>
        
        {/* 다시 하기 버튼 (방장만 표시) */}
        <div className="mt-6 flex justify-center">
          <button 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg"
            onClick={() => {
              // 방장인 경우 새 게임 시작 요청
              publish(`/app/room/${roomId}/restart`, {
                roomId: roomId,
                timestamp: Date.now()
              });
            }}
          >
            새 게임 시작
          </button>
        </div>
      </div>
    );
  }
  
  // 게임 진행 화면
  return (
    <div className="flex flex-col h-full">
      {/* 게임 헤더 - 문제 번호, 타이머, 카테고리 등 */}
      <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap justify-between items-center">
          <div className="flex items-center">
            <div className="text-gray-400 mr-2">문제</div>
            <div className="text-xl font-bold text-white">
              {currentQuestionIndex + 1}/{questions.length}
            </div>
          </div>
          
          <div className="flex items-center">
            <FaClock className="text-gray-400 mr-2" />
            <Timer 
              initialTime={timeLeft} 
              onExpire={handleTimerExpired}
              showResults={showResults}
            />
          </div>
          
          <div className="hidden md:flex items-center">
            <FaFlag className="text-gray-400 mr-2" />
            <div className="text-white font-medium">
              {currentQuestion?.category === "GENERAL_KNOWLEDGE" ? "일반 상식" : 
                currentQuestion?.category === "SCIENCE" ? "과학" : 
                currentQuestion?.category === "HISTORY" ? "역사" : 
                currentQuestion?.category === "LANGUAGE" ? "언어" : "기타"}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 flex-grow">
        {/* 문제 및 보기 영역 */}
        <div className="flex-grow">
          {currentQuestion && (
            <QuizQuestion 
              question={currentQuestion}
              selectedAnswer={selectedAnswer}
              onSelectAnswer={handleSubmitAnswer}
              showResults={showResults}
              answerSubmitted={answerSubmitted}
              onNext={moveToNextQuestion}
              isLastQuestion={currentQuestionIndex === questions.length - 1}
            />
          )}
        </div>
        
        {/* 플레이어 점수 영역 */}
        <div className="w-full md:w-72">
          <PlayerScores 
            scores={playerScores} 
            currentUserId={currentUserId.toString()}
          />
        </div>
      </div>
    </div>
  );
} 