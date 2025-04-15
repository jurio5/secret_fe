"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";
import client from "@/lib/backend/client";
import QuizQuestion from "./QuizQuestion";
import Timer from "./Timer";
import PlayerScores from "./PlayerScores";
import { FaFlag, FaClock } from "react-icons/fa";
import { RoomResponse } from "@/lib/types/room";
import toast from 'react-hot-toast';

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
  room: any;
  onGameEnd: () => void;
  publish: (destination: string, body: any) => void;
  subscribe: (destination: string, callback: (message: any) => void) => void;
  unsubscribe: (destination: string) => void;
}

export default function GameContainer({ roomId, currentUserId, players, room, onGameEnd, publish, subscribe, unsubscribe }: GameContainerProps) {
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
  const [quizId, setQuizId] = useState<string | null>(null);
  const [forceRenderKey, setForceRenderKey] = useState<number>(0); // 강제 리렌더링용 키
  
  // 퀴즈 생성 진행 상태 관리
  const [quizGenerationStatus, setQuizGenerationStatus] = useState<{
    status: "IDLE" | "STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
    message: string;
    progress: number;
    stage?: number;
    totalStages?: number;
    stageDescription?: string;
    animation?: string;
  }>({
    status: "IDLE",
    message: "준비 중입니다...",
    progress: 0,
  });
  
  // 현재 문제 정보
  const currentQuestion = questions[currentQuestionIndex];
  
  // 더미 문제 생성 함수 (훅 아님)
  const createDummyQuestions = () => {
    console.log("더미 문제 데이터 생성");
    const dummyQuestions: QuizQuestionType[] = [
      {
        id: "dummy1",
        questionNumber: 1,
        question: "더미 문제 1: 다음 중 옳은 것은?",
        choices: ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
        correctAnswer: 0,
        category: "DUMMY",
        subCategory: "DUMMY",
        explanation: "",
        timeLimit: 20
      },
      {
        id: "dummy2",
        questionNumber: 2,
        question: "더미 문제 2: 다음 중 옳은 것은?",
        choices: ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
        correctAnswer: 1,
        category: "DUMMY",
        subCategory: "DUMMY",
        explanation: "",
        timeLimit: 20
      },
      {
        id: "dummy3",
        questionNumber: 3,
        question: "더미 문제 3: 다음 중 옳은 것은?",
        choices: ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
        correctAnswer: 2,
        category: "DUMMY",
        subCategory: "DUMMY",
        explanation: "",
        timeLimit: 20
      },
      {
        id: "dummy4",
        questionNumber: 4,
        question: "더미 문제 4: 다음 중 옳은 것은?",
        choices: ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
        correctAnswer: 3,
        category: "DUMMY",
        subCategory: "DUMMY",
        explanation: "",
        timeLimit: 20
      },
      {
        id: "dummy5",
        questionNumber: 5,
        question: "더미 문제 5: 다음 중 옳은 것은?",
        choices: ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
        correctAnswer: 0,
        category: "DUMMY",
        subCategory: "DUMMY",
        explanation: "",
        timeLimit: 20
      }
    ];
    return dummyQuestions;
  };

  // 더미 문제 사용 함수 (컴포넌트 내 최상위 레벨)
  const useDummyQuestions = useCallback(() => {
    console.log("더미 문제 데이터 사용");
    const dummyQuestions = createDummyQuestions();
    setQuestions(dummyQuestions);
    setTimeLeft(20); // 첫 문제 타이머 시작
    setCurrentQuestionIndex(0);
  }, []);
  
  // 문제 데이터 가져오기 함수 - useCallback으로 감싸기
  const fetchQuestions = useCallback(async (quizId: string) => {
    try {
      console.log(`퀴즈 ID ${quizId}로 문제 데이터 요청`);
      const response = await fetch(`/api/quizzes/${quizId}/questions`);
      if (!response.ok) {
        throw new Error('문제 데이터 로드 실패');
      }
      const data = await response.json();
      console.log("문제 데이터 로드 성공:", data);
      setQuestions(data);
      setTimeLeft(30); // 첫 문제 타이머 시작
      setCurrentQuestionIndex(0);
    } catch (error) {
      console.error("문제 데이터 로드 중 오류:", error);
      // 오류 발생 시 더미 문제 설정 (직접 호출하지 않고 상태 설정)
      const dummyQuestions = createDummyQuestions();
      setQuestions(dummyQuestions);
      setTimeLeft(20);
      setCurrentQuestionIndex(0);
    }
  }, []);
  
  // 게임 종료 처리 함수
  const handleGameEnd = () => {
    console.log("게임 종료 처리");
    setShowFinalResults(true);
    // 필요한 다른 종료 처리 로직 추가
  };
  
  // 플레이어 점수 초기화
  const initializePlayerScores = () => {
    const initialScores = players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      avatarUrl: player.avatarUrl || "https://via.placeholder.com/40",
      score: 0,
      lastAnswerCorrect: false,
      isReady: player.isReady
    }));
    
    setPlayerScores(initialScores);
  };

  // 웹소켓 구독 설정 - 퀴즈 생성 상태를 위한 useEffect
  useEffect(() => {
    console.log("GameContainer 마운트 시 초기 gameStatus:", gameStatus);
    
    // 플레이어 스코어 초기화
    initializePlayerScores();
    
    // 퀴즈 생성 상태 구독
    const generationSubscriptionId = subscribe(`/topic/room/${roomId}/quiz/generation`, (data) => {
      console.log("퀴즈 생성 상태 수신:", data);
      setQuizGenerationStatus({
        status: data.status,
        message: data.message || "퀴즈를 생성 중입니다...",
        progress: data.progress || 0,
        stage: data.stage,
        totalStages: data.totalStages,
        stageDescription: data.stageDescription,
        animation: data.animation
      });
      
      // 진행 상태에 따른 토스트 메시지 표시
      if (data.status === "STARTED") {
        toast.success("퀴즈 생성이 시작되었습니다!");
      } else if (data.status === "IN_PROGRESS" && data.progress % 25 === 0) {
        // 25%, 50%, 75% 진행 시에만 토스트 표시
        toast.success(`퀴즈 생성 진행중: ${data.progress}%`);
      }
      
      // 퀴즈 생성이 완료되면 게임 시작 준비
      if (data.status === "COMPLETED") {
        console.log("퀴즈 생성이 완료되었습니다. 게임 시작 준비 중...");
        
        // 완료 토스트 메시지
        toast.success("퀴즈 생성 완료! 게임을 시작합니다.", {
          duration: 3000,
          icon: '🎮'
        });
        
        // 백엔드에서 전달받은 퀴즈 ID 저장
        if (data.quizId) {
          setQuizId(data.quizId);
          console.log("백엔드에서 받은 퀴즈 ID:", data.quizId);
          
          // 생성된 퀴즈 ID가 있으면 더미 데이터를 사용하지 않도록 플래그 설정
          window.sessionStorage.setItem('currentQuizId', data.quizId);
          
          // 이전에 사용했던 더미 퀴즈 ID 제거
          const storedQuizId = window.sessionStorage.getItem('currentQuizId');
          if (storedQuizId && storedQuizId.startsWith('dummy-quiz-')) {
            window.sessionStorage.removeItem('currentQuizId');
          }
          
          // 게임 시작 지연 추가
          setTimeout(() => {
            console.log("지연 후 게임 상태 변경: WAITING -> IN_PROGRESS");
            // 상태 변경
            setGameStatus("IN_PROGRESS");
            
            // 게임 시작 토스트 메시지
            toast.success("게임이 시작되었습니다!", {
              icon: '🚀',
              duration: 3000
            });
            
            // 게임 시작 메시지 발행 (상태 전환 후)
            publish(`/app/room/${roomId}/game/start`, {
              roomId: roomId,
              quizId: data.quizId,
              gameStatus: "IN_PROGRESS",
              timestamp: Date.now()
            });
            
            // 문제 데이터 로드 시작
            if (quizId) {
              console.log("저장된 퀴즈 ID로 문제 데이터 로드 시작:", quizId);
              fetchQuestions(quizId);
            } else {
              // 세션 스토리지에서 저장된 퀴즈 ID 확인
              const storedQuizId = window.sessionStorage.getItem('currentQuizId');
              if (storedQuizId) {
                console.log("세션 스토리지에서 퀴즈 ID 복원:", storedQuizId);
                setQuizId(storedQuizId);
                fetchQuestions(storedQuizId);
              } else {
                console.log("퀴즈 ID가 없어 더미 문제를 사용합니다.");
                // 더미 문제 사용 (직접 생성하여 상태 설정)
                const dummyQuestions = createDummyQuestions();
                setQuestions(dummyQuestions);
                setTimeLeft(20);
                setCurrentQuestionIndex(0);
              }
            }
            
            // 강제 리렌더링
            setForceRenderKey(prev => prev + 1);
          }, 2000); // 2초 지연
        }
      } else if (data.status === "FAILED") {
        // 실패 시 토스트 에러 메시지
        toast.error("퀴즈 생성에 실패했습니다. 다시 시도해주세요.");
      }
    });
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      unsubscribe(`/topic/room/${roomId}/quiz/generation`);
      console.log("퀴즈 생성 상태 구독 해제");
    };
  }, [roomId, publish, quizId, fetchQuestions]);

  // 문제 변경 이벤트 구독은 별도의 useEffect로 분리
  useEffect(() => {
    // 문제 변경 이벤트 구독
    const questionSubscriptionId = subscribe(`/topic/room/${roomId}/question`, (data) => {
      console.log("문제 변경 이벤트 수신:", data);
      
      setCurrentQuestionIndex(data.questionIndex);
      setAnswerSubmitted(false);
      setSelectedAnswer(null);
      setShowResults(false);
      
      // 서버에서 받은 문제 데이터 처리
      if (data.questionText) {
        try {
          // 질문 텍스트 파싱
          const questionTextRaw = data.questionText.replace(/^"|"$/g, '');
          const lines = questionTextRaw.split('\\n').filter((line: string) => line.trim() !== '');
          
          // 첫 번째 줄은 문제 제목
          const questionText = lines[0].replace(/^\d+:\s*/, '');
          
          // 선택지 추출
          const choices: string[] = [];
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].match(/^[a-d]\)/)) {
              choices.push(lines[i].replace(/^[a-d]\)\s*/, ''));
            }
          }
          
          // 정답 처리
          const correctAnswer = data.correctAnswer.replace(/^"|"$/g, '');
          const correctAnswerIndex = correctAnswer.charCodeAt(0) - 'a'.charCodeAt(0);
          
          // 새 문제 객체 생성
          const newQuestion: QuizQuestionType = {
            id: `q${data.questionIndex + 1}`,
            questionNumber: data.questionIndex + 1,
            question: questionText,
            choices: choices,
            correctAnswer: correctAnswerIndex,
            category: "HISTORY",  // 기본값 설정 또는 서버에서 받을 경우 업데이트
            subCategory: "KOREAN_HISTORY",
            explanation: data.explanation || "",  // 서버에서 제공된 해설 사용, 없으면 빈 문자열
            timeLimit: 15  // 기본 시간 제한
          };
          
          console.log("생성된 문제 객체:", newQuestion);
          
          // questions 배열 업데이트
          setQuestions(prevQuestions => {
            const updatedQuestions = [...prevQuestions];
            updatedQuestions[data.questionIndex] = newQuestion;
            return updatedQuestions;
          });
          
          // 타이머 즉시 시작 (딜레이 제거)
          console.log("타이머 시작: 15초");
          setTimeLeft(15);
          setGameStatus("IN_PROGRESS");
          console.log("문제가 화면에 표시되었습니다:", questionText);
        } catch (error) {
          console.error("문제 데이터 파싱 중 오류 발생:", error);
        }
      }
      // 이미 questions 배열에 문제가 있는 경우
      else if (questions[data.questionIndex]) {
        // 딜레이 제거하고 즉시 시작
        console.log("타이머 시작: 15초");
        setTimeLeft(15);
        console.log("문제가 화면에 표시되었습니다:", questions[data.questionIndex].question);
      }
      
      // quizId 업데이트
      if (data.quizId) {
        setQuizId(data.quizId);
        // 세션 스토리지에 저장
        window.sessionStorage.setItem('currentQuizId', data.quizId);
      }
    });
    
    return () => {
      unsubscribe(`/topic/room/${roomId}/question`);
      console.log("문제 변경 이벤트 구독 해제");
    };
  }, [roomId, questions]);

  // 문제 데이터 로딩 부분을 별도로 분리
  useEffect(() => {
    // 게임이 시작된 상태이고 퀴즈 ID가 있는 경우에만 문제 가져오기
    if (gameStatus === "IN_PROGRESS" && quizId) {
      // 백엔드에서 문제를 가져오는 함수
      const fetchQuestions = async () => {
        try {
          // 세션 스토리지에서 저장된 퀴즈 ID 확인
          const storedQuizId = window.sessionStorage.getItem('currentQuizId');
          const finalQuizId = quizId || storedQuizId;
          
          if (!finalQuizId) {
            console.log("유효한 퀴즈 ID가 없습니다.");
            return;
          }
          
          // 문제 데이터가 이미 있는 경우 다시 가져오지 않음
          if (questions.length > 0 && questions.some(q => q != null)) {
            console.log("이미 문제 데이터가 로드되어 있습니다.");
            return;
          }
          
          console.log(`퀴즈 ID ${finalQuizId}에 해당하는 문제 데이터 요청 중...`);
          
          // 백엔드에서 문제 데이터 가져오기
          const loadTimeout = setTimeout(() => {
            console.log("퀴즈 데이터 수신 시간 초과, 임시 데이터 사용");
            
            // 이미 문제 데이터가 있으면 더미 데이터를 사용하지 않음
            if (questions.length > 0 && questions.some(q => q != null)) {
              console.log("이미 문제 데이터가 있어 더미 데이터를 사용하지 않습니다.");
              clearTimeout(loadTimeout);
              return;
            }
            
            // 세션 스토리지에 저장된 QuizId 체크
            const storedQuizId = window.sessionStorage.getItem('currentQuizId');
            if (storedQuizId && storedQuizId.startsWith('dummy-quiz-')) {
              console.log("이미 더미 퀴즈 ID가 사용 중입니다.");
              return;
            }
            
            // 백엔드에서 문제 데이터를 받아오지 못한 경우에만 더미 데이터 생성
            const dummyQuizId = `dummy-quiz-${Date.now()}`;
            console.log("더미 퀴즈 ID 생성 (백엔드에서 ID를 받지 못한 경우):", dummyQuizId);
            
            // 더미 퀴즈 ID 저장
            setQuizId(dummyQuizId);
            window.sessionStorage.setItem('currentQuizId', dummyQuizId);
            
            // 더미 문제 데이터 생성
            const dummyQuestions = createDummyQuestions();
            
            // 더미 문제 데이터 설정
            setQuestions(dummyQuestions);
            
            // 첫 번째 문제부터 시작
            setCurrentQuestionIndex(0);
            setTimeLeft(20);
          }, 10000); // 10초 후에 타임아웃
          
          return () => {
            clearTimeout(loadTimeout);
          };
        } catch (error) {
          console.error("문제 데이터를 가져오는 중 오류 발생:", error);
        }
      };
      
      fetchQuestions();
    }
  }, [gameStatus, quizId, questions]);
  
  // 답변 제출 처리
  const handleSubmitAnswer = (answer: string) => {
    if (answerSubmitted || !currentQuestion) return;
    
    setSelectedAnswer(answer);
    setAnswerSubmitted(true);
    
    // 실제 정답과 비교
    const isCorrect = currentQuestion.correctAnswer === 
      (typeof currentQuestion.correctAnswer === 'number' 
        ? currentQuestion.choices.indexOf(answer)
        : answer);
    
    // 서버에 답변 제출
    publish(`/app/room/${roomId}/answer`, {
      questionId: currentQuestion.id,
      playerId: currentUserId,
      answer: answer,
      isCorrect: isCorrect,
      timestamp: Date.now()
    });
    
    // 웹소켓으로 답변 제출
    if (quizId) {
      submitAnswerToServer(currentQuestion.id, answer, isCorrect);
    }
    
    // 로컬에서 결과 미리 표시
    updatePlayerScore(isCorrect);
  };
  
  // 서버에 답변 제출하는 웹소켓 메시지 전송
  const submitAnswerToServer = async (questionId: string, answer: string, isCorrect: boolean) => {
    try {
      if (!quizId) {
        console.error("퀴즈 ID가 없어 답변을 제출할 수 없습니다.");
        return;
      }
      
      // 웹소켓으로 답변 제출
      publish(`/app/quiz/${quizId}/submit`, {
        questionNumber: parseInt(questionId.replace(/\D/g, '')) || currentQuestionIndex + 1,
        submittedAnswer: answer
      });
      
      console.log("답변이 웹소켓을 통해 제출되었습니다.");
    } catch (error) {
      console.error("답변 제출 중 오류 발생:", error);
    }
  };
  
  // 플레이어 점수 업데이트
  const updatePlayerScore = (isCorrect: boolean) => {
    if (isCorrect) {
      // 정답 처리
      const scoreIncrease = calculateScore();
      
      setPlayerScores(prevScores => 
        prevScores.map(player => 
          player.id === currentUserId.toString() 
            ? { ...player, score: player.score + scoreIncrease, lastAnswerCorrect: true }
            : player
        )
      );
      
      // 정답 맞춘 메시지
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: `${playerScores.find(p => p.id === currentUserId.toString())?.nickname || '플레이어'}님이 정답을 맞추었습니다! +${scoreIncrease}점`,
        timestamp: Date.now()
      });
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
  
  // 남은 시간에 따른 점수 계산
  const calculateScore = () => {
    // 기본 점수
    const baseScore = 100;
    
    // 남은 시간에 따른 보너스 (최대 2배)
    const timeBonus = Math.floor((timeLeft / currentQuestion.timeLimit) * 100);
    
    return baseScore + timeBonus;
  };
  
  // 다음 문제로 이동
  const moveToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      // 다음 문제로 이동 전 서버에 알림
      publish(`/app/room/${roomId}/question/next`, {
        roomId: roomId,
        currentQuestionIndex: currentQuestionIndex,
        nextQuestionIndex: currentQuestionIndex + 1,
        timestamp: Date.now()
      });
      
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedAnswer(null);
      setAnswerSubmitted(false);
      setShowResults(false);
      setTimeLeft(questions[currentQuestionIndex + 1].timeLimit);
      
      // 다음 문제로 이동했다는 채팅 메시지
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: `다음 문제로 이동합니다. (${currentQuestionIndex + 2}/${questions.length})`,
        timestamp: Date.now()
      });
    } else {
      // 모든 문제가 끝난 경우
      finishGame();
    }
  };
  
  // 게임 종료 처리
  const finishGame = async () => {
    try {
      // 게임 종료 상태로 변경
      setGameStatus("FINISHED");
      setShowFinalResults(true);
      
      // 서버에 게임 종료 알림
      publish(`/app/room/${roomId}/game/end`, {
        roomId: roomId,
        timestamp: Date.now()
      });
      
      // 게임 종료 채팅 메시지
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: "모든 문제가 끝났습니다. 최종 결과를 확인하세요!",
        timestamp: Date.now()
      });
      
      // 최종 점수 정보
      const finalScores = playerScores.map(player => ({
        playerId: player.id,
        score: player.score
      }));
      
      // 서버에 결과 저장 (웹소켓으로 전송 - API 대신)
      publish(`/app/room/${roomId}/finish`, {
        roomId: roomId,
        scores: finalScores,
        timestamp: Date.now()
      });
      
      // 최종 결과 브로드캐스트
      publish(`/app/room/${roomId}/scores`, {
        roomId: roomId,
        scores: playerScores,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("게임 종료 처리 중 오류 발생:", error);
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
      
      // API로 시간 초과 제출
      if (currentQuestion) {
        submitAnswerToServer(currentQuestion.id, "TIMEOUT", false);
      }
      
      // 로컬 상태 업데이트
      setPlayerScores(prevScores => 
        prevScores.map(player => 
          player.id === currentUserId.toString() 
            ? { ...player, lastAnswerCorrect: false }
            : player
        )
      );
      
      // 시간 초과 메시지
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: `${playerScores.find(p => p.id === currentUserId.toString())?.nickname || '플레이어'}님이 시간 초과되었습니다.`,
        timestamp: Date.now()
      });
    }
    
    // 결과 표시 (실제 게임에서는 서버에서 결과 표시 메시지 수신 후 표시)
    setTimeout(() => {
      setShowResults(true);
      
      // 서버에 결과 표시 알림
      publish(`/app/room/${roomId}/question/result`, {
        roomId: roomId,
        questionIndex: currentQuestionIndex,
        timestamp: Date.now()
      });
    }, 1000);
  };
  
  // 게임 재시작 처리
  const handleRestartGame = () => {
    // 방장일 경우에만 재시작 메시지 전송
    const currentPlayer = playerScores.find(p => p.id === currentUserId.toString());
    
    if (currentPlayer && isPlayerOwner(currentPlayer)) {
      publish(`/app/room/${roomId}/restart`, {
        roomId: roomId,
        timestamp: Date.now()
      });
      
      // 게임 재시작 메시지
      publish(`/app/room/chat/${roomId}`, {
        type: "SYSTEM",
        content: "방장이 게임을 재시작합니다.",
        timestamp: Date.now()
      });
    }
  };
  
  // 플레이어가 방장인지 확인
  const isPlayerOwner = (player: PlayerScore) => {
    // 방장 여부를 현재 플레이어 목록에서 확인 (players 배열에서 방장 정보 확인)
    const ownerPlayer = players.find(p => p.isOwner);
    return player.id === ownerPlayer?.id || player.id === String(currentUserId);
  };
  
  // 게임 초기화 함수
  const resetGame = () => {
    // 게임 상태 초기화
    setGameStatus('WAITING');
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAnswerSubmitted(false);
    setShowResults(false);
    setShowFinalResults(false);
    setQuizId(null);
    
    // 플레이어 점수 초기화
    initializePlayerScores();
    
    // 게임 재시작 메시지
    publish(`/app/room/chat/${roomId}`, {
      type: "SYSTEM",
      content: "게임이 재시작되었습니다. 모든 플레이어는 다시 준비해주세요.",
      timestamp: Date.now()
    });
  };
  
  // 방 상태 업데이트 구독
  useEffect(() => {
    console.log("방 상태 업데이트 구독 설정", roomId);
    
    // 게임 시작 메시지 명시적 게시 - 게임 시작 시 한 번만 실행
    const publishGameStart = () => {
      if (quizId) {
        console.log("게임 시작 메시지 명시적 발행", quizId);
        
        // 방 상태 업데이트 메시지 발행 (모든 클라이언트에게 전파)
        publish(`/app/room/${roomId}/status`, {
          room: {
            status: 'IN_GAME'
          },
          gameStatus: 'IN_PROGRESS',
          timestamp: Date.now()
        });
        
        // 게임 시작 메시지 발행 - 약간의 지연 추가
        setTimeout(() => {
          publish(`/app/room/${roomId}/game/start`, {
            roomId: roomId,
            quizId: quizId,
            gameStatus: 'IN_PROGRESS',
            timestamp: Date.now()
          });
          console.log("지연된 게임 시작 메시지 발행 완료");
        }, 500);
      }
    };
    
    // 게임 상태가 WAITING -> IN_PROGRESS로 바뀔 때 한 번만 실행
    if (gameStatus === "IN_PROGRESS" && quizId) {
      publishGameStart();
    }
    
    const statusSubscriptionId = subscribe(`/topic/room/${roomId}/status`, (data) => {
      console.log("방 상태 업데이트 수신:", data);
      
      try {
        // 다양한 메시지 형식 지원
        let messageData = data;
        
        // 문자열인 경우 파싱 시도
        if (typeof data === 'string') {
          try {
            messageData = JSON.parse(data);
          } catch (e) {
            console.warn("상태 메시지 파싱 실패:", e);
          }
        }
        
        // body 속성이 있는 경우 (일반적인 STOMP 메시지)
        if (messageData.body) {
          try {
            messageData = JSON.parse(messageData.body);
          } catch (e) {
            console.warn("STOMP 메시지 body 파싱 실패:", e);
          }
        }
        
        // gameStatus 필드가 있는 경우 게임 상태 업데이트 처리
        if (messageData.gameStatus) {
          console.log(`게임 상태 업데이트: ${gameStatus} -> ${messageData.gameStatus}`);
          
          // 대소문자 및 다양한 형식 지원
          const newStatus = typeof messageData.gameStatus === 'string' 
            ? messageData.gameStatus.toUpperCase() 
            : messageData.gameStatus;
            
          let finalStatus: "WAITING" | "IN_PROGRESS" | "FINISHED" = gameStatus;
          
          if (newStatus === "IN_PROGRESS" || newStatus === "IN_GAME") {
            finalStatus = "IN_PROGRESS";
            console.log("게임 상태 IN_PROGRESS로 설정");
            
            // 퀴즈 ID 처리
            if (messageData.quizId && messageData.quizId !== quizId) {
              console.log(`퀴즈 ID 업데이트: ${quizId} -> ${messageData.quizId}`);
              setQuizId(messageData.quizId);
              window.sessionStorage.setItem('currentQuizId', messageData.quizId);
            }
          } else if (newStatus === "FINISHED" || newStatus === "COMPLETE" || newStatus === "COMPLETED") {
            finalStatus = "FINISHED";
            console.log("게임 상태 FINISHED로 설정");
          } else if (newStatus === "WAITING" || newStatus === "READY") {
            finalStatus = "WAITING";
            console.log("게임 상태 WAITING으로 설정");
          }
          
          // 게임 상태가 실제로 변경되는 경우에만 업데이트
          if (finalStatus !== gameStatus) {
            console.log(`게임 상태 실제 변경: ${gameStatus} -> ${finalStatus}`);
            // 게임 상태 업데이트
            setGameStatus(finalStatus);
            
            // 게임이 시작되면 문제 로드 및 타이머 시작
            if (finalStatus === "IN_PROGRESS") {
              // 세션 스토리지 또는 메시지의 퀴즈 ID 확인
              const messageQuizId = messageData.quizId;
              const storedQuizId = window.sessionStorage.getItem('currentQuizId');
              const effectiveQuizId = quizId || messageQuizId || storedQuizId;
              
              console.log("게임 시작 시 유효 퀴즈 ID:", effectiveQuizId);
              
              if (effectiveQuizId) {
                if (effectiveQuizId !== quizId) {
                  console.log("퀴즈 ID 업데이트:", effectiveQuizId);
                  setQuizId(effectiveQuizId);
                  // 세션 스토리지에 저장
                  window.sessionStorage.setItem('currentQuizId', effectiveQuizId);
                }
                
                console.log("퀴즈 ID로 문제 데이터 로드:", effectiveQuizId);
                fetchQuestions(effectiveQuizId);
              } else {
                console.log("퀴즈 ID가 없어 더미 문제를 사용합니다.");
                // 더미 문제 사용 (직접 생성하여 상태 설정)
                const dummyQuestions = createDummyQuestions();
                setQuestions(dummyQuestions);
                setTimeLeft(20);
                setCurrentQuestionIndex(0);
              }
              
              // 로그 추가
              console.log("게임 시작 상태로 전환 완료 - 다른 상태 초기화 중");
              
              // 다른 상태 초기화
              setAnswerSubmitted(false);
              setSelectedAnswer(null);
              setShowResults(false);
              
              // 강제 리렌더링
              setForceRenderKey(prev => prev + 1);
            }
            
            // 게임이 종료되면 최종 결과 표시
            if (finalStatus === "FINISHED") {
              handleGameEnd();
            }
          }
        }
        // room 객체 내에 status 필드가 있는 경우 (room 형식의 메시지)
        else if (messageData.room?.status) {
          const roomStatus = messageData.room.status.toUpperCase();
          
          // 방 상태가 'IN_GAME'인 경우 게임 상태도 업데이트
          if (roomStatus === 'IN_GAME' && gameStatus !== 'IN_PROGRESS') {
            console.log("방 상태로부터 게임 상태 업데이트: WAITING -> IN_PROGRESS");
            setGameStatus('IN_PROGRESS');
            
            // 퀴즈 ID 확인 및 문제 로드
            if (messageData.room.quizId && messageData.room.quizId !== quizId) {
              setQuizId(messageData.room.quizId);
              window.sessionStorage.setItem('currentQuizId', messageData.room.quizId);
              fetchQuestions(messageData.room.quizId);
            } else {
              const storedQuizId = window.sessionStorage.getItem('currentQuizId');
              if (storedQuizId) {
                setQuizId(storedQuizId);
                fetchQuestions(storedQuizId);
              } else {
                console.log("퀴즈 ID가 없어 더미 문제를 사용합니다.");
                // 더미 문제 사용 (직접 생성하여 상태 설정)
                const dummyQuestions = createDummyQuestions();
                setQuestions(dummyQuestions);
                setTimeLeft(20);
                setCurrentQuestionIndex(0);
              }
            }
            
            // 강제 리렌더링
            setForceRenderKey(prev => prev + 1);
          } else if (roomStatus === 'FINISHED' && gameStatus !== 'FINISHED') {
            setGameStatus('FINISHED');
            handleGameEnd();
          }
        }
        
      } catch (e) {
        console.error("방 상태 메시지 처리 중 오류:", e);
      }
    });
    
    // 게임 시작 메시지 전용 구독 추가
    const gameStartSubscriptionId = subscribe(`/topic/room/${roomId}/game/start`, (data) => {
      console.log("게임 시작 메시지 수신:", data);
      
      try {
        // 메시지에 quizId가 있으면 사용
        if (data.quizId && data.quizId !== quizId) {
          console.log("게임 시작 메시지에서 퀴즈 ID 설정:", data.quizId);
          setQuizId(data.quizId);
          window.sessionStorage.setItem('currentQuizId', data.quizId);
        }
        
        // 게임 상태가 아직 WAITING이면 IN_PROGRESS로 변경
        if (gameStatus === "WAITING") {
          console.log("게임 시작 메시지로 상태 변경: WAITING -> IN_PROGRESS");
          setGameStatus("IN_PROGRESS");
          
          // quizId가 있으면 문제 로드
          const effectiveQuizId = data.quizId || quizId || window.sessionStorage.getItem('currentQuizId');
          if (effectiveQuizId) {
            console.log("게임 시작 시 문제 데이터 로드:", effectiveQuizId);
            fetchQuestions(effectiveQuizId);
          } else {
            console.log("퀴즈 ID가 없어 더미 문제를 사용합니다.");
            const dummyQuestions = createDummyQuestions();
            setQuestions(dummyQuestions);
            setTimeLeft(20);
            setCurrentQuestionIndex(0);
          }
          
          // 강제 리렌더링
          setForceRenderKey(prev => prev + 1);
        }
      } catch (e) {
        console.error("게임 시작 메시지 처리 중 오류:", e);
      }
    });
    
    return () => {
      unsubscribe(`/topic/room/${roomId}/status`);
      unsubscribe(`/topic/room/${roomId}/game/start`);
      console.log("방 상태 및 게임 시작 구독 해제");
    };
  }, [roomId, gameStatus, quizId, fetchQuestions, publish]);
  
  // 게임 대기 화면
  if (gameStatus === "WAITING") {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-full max-w-md bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-700/50">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white">퀴즈 준비 중</h2>
            <p className="text-gray-400 mt-1">{quizGenerationStatus.message}</p>
          </div>
          
          {/* 프로그레스 바 */}
          <div className="relative pt-1 mb-4">
            <div className="mb-2 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-200 bg-blue-600">
                  {quizGenerationStatus.progress}%
                </span>
              </div>
              {quizGenerationStatus.stage && quizGenerationStatus.totalStages && (
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-200">
                    단계 {quizGenerationStatus.stage}/{quizGenerationStatus.totalStages}
                  </span>
                </div>
              )}
            </div>
            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-700">
              <div 
                style={{ width: `${quizGenerationStatus.progress}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
              ></div>
            </div>
            {quizGenerationStatus.stageDescription && (
              <div className="mt-1 text-xs text-gray-400">
                {quizGenerationStatus.stageDescription}
              </div>
            )}
          </div>
          
          {/* 로딩 애니메이션 */}
          <div className="flex justify-center items-center py-4">
            {quizGenerationStatus.status === "STARTED" && (
              <div className="inline-flex space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
            
            {quizGenerationStatus.status === "IN_PROGRESS" && (
              <div className="relative w-16 h-16">
                <div className="absolute top-0 left-0 w-full h-full border-4 border-t-blue-500 border-r-transparent border-b-indigo-500 border-l-transparent rounded-full animate-spin"></div>
                <div className="absolute top-2 left-2 w-12 h-12 border-4 border-t-transparent border-r-blue-400 border-b-transparent border-l-indigo-400 rounded-full animate-spin" style={{ animationDelay: '0.1s', animationDuration: '1.2s' }}></div>
                <div className="absolute top-4 left-4 w-8 h-8 border-4 border-t-blue-300 border-r-transparent border-b-indigo-300 border-l-transparent rounded-full animate-spin" style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}></div>
              </div>
            )}
            
            {quizGenerationStatus.status === "COMPLETED" && (
              <div className="rounded-full bg-green-500/20 p-3 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            
            {quizGenerationStatus.status === "FAILED" && (
              <div className="rounded-full bg-red-500/20 p-3 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          
          {/* 플레이어 대기 상태 */}
          <div className="mt-4 border-t border-gray-700 pt-4">
            <div className="text-sm font-medium text-white mb-2">참가 플레이어</div>
            <div className="grid grid-cols-2 gap-2">
              {playerScores.map(player => (
                <div 
                  key={player.id} 
                  className={`flex items-center p-2 rounded-lg ${
                    player.id === currentUserId.toString() ? 'bg-blue-600/30 border border-blue-500/50' : 'bg-gray-700/50'
                  }`}
                >
                  <img 
                    src={player.avatarUrl} 
                    alt={player.nickname} 
                    className="w-8 h-8 rounded-full mr-2" 
                  />
                  <div className="truncate text-sm text-white">{player.nickname}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* 게임 시작 준비 중 메시지 - 생성 완료 시 표시 */}
          {quizGenerationStatus.status === "COMPLETED" && (
            <div className="mt-6 text-center">
              <div className="text-lg font-medium text-white mb-2">게임 시작 준비 완료!</div>
              <div className="text-sm text-gray-400">잠시 후 게임이 자동으로 시작됩니다...</div>
              <div className="mt-3 flex justify-center">
                <div className="inline-flex space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
                </div>
              </div>
            </div>
          )}
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
            onClick={handleRestartGame}
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
              show={showResults}
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