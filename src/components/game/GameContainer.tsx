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
    lastMessage?: string; // 중복 메시지 방지용 이전 메시지 저장
  }>({
    status: "IDLE",
    message: "준비 중입니다...",
    progress: 20, // 기본값 20%로 시작
    lastMessage: "",
  });
  
  // 현재 문제 정보
  const currentQuestion = questions[currentQuestionIndex];
  
  // 타임아웃 관리를 위한 ref 추가
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 타임아웃 실행 여부 추적
  const [timeoutExecuted, setTimeoutExecuted] = useState<boolean>(false);
  
  // 플레이어 선택 추적을 위한 상태 추가
  const [playerChoices, setPlayerChoices] = useState<Record<string, { nickname: string, answerId: number, avatarUrl?: string }>>({});
  
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
      
      // 백엔드에 직접 문제 데이터 요청
      publish(`/app/room/${roomId}/question/request`, {
        roomId: roomId,
        quizId: quizId,
        timestamp: Date.now()
      });
      
      console.log("WebSocket을 통해 문제 데이터 요청을 전송했습니다. 서버의 응답을 기다립니다...");
      
      // 웹소켓으로 개별 문제를 받으므로 여기서는 초기화만 수행
      // questions는 WebSocket 구독에서 동적으로 업데이트됨
      setQuestions([]);
      setTimeLeft(30); // 첫 문제 타이머 시작
      setCurrentQuestionIndex(0);
    } catch (error) {
      console.error("문제 데이터 요청 중 오류:", error);
      
      // 오류 발생 시 WebSocket 채널로 오류 알림
      publish(`/app/room/${roomId}/error`, {
        error: "문제 데이터 요청 실패",
        details: error instanceof Error ? error.message : "알 수 없는 오류",
        timestamp: Date.now()
      });
      
      toast.error("문제 데이터를 불러오는데 실패했습니다. 다시 시도해주세요.");
      
      // 더미 데이터 사용 (직접 호출하지 않고 상태 설정)
      const dummyQuestions = createDummyQuestions();
      setQuestions(dummyQuestions);
      setTimeLeft(20);
      setCurrentQuestionIndex(0);
    }
  }, [roomId, publish]);
  
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
    
    // 타임아웃 상태 초기화
    setTimeoutExecuted(false);
    
    // 강제 종료된 타임아웃이 있다면 정리
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
      console.log("컴포넌트 마운트 시 기존 타임아웃 정리");
    }
    
    // 플레이어 스코어 초기화
    initializePlayerScores();
    
    // 인공적인 진행률 증가를 위한 변수와 함수
    let lastReceivedProgress = 0;
    let currentDisplayProgress = 0;
    let progressIntervalId: NodeJS.Timeout | null = null;
    
    // 진행률 부드럽게 증가시키는 함수
    const startSmoothProgress = (targetProgress: number) => {
      // 이미 인터벌이 실행 중이면 취소
      if (progressIntervalId) {
        clearInterval(progressIntervalId);
      }
      
      // 현재 진행률에서 목표 진행률까지 부드럽게 증가
      progressIntervalId = setInterval(() => {
        if (currentDisplayProgress < targetProgress) {
          // 남은 거리를 기준으로 증가량 계산 (빠르게 진행되다가 목표에 가까워지면 천천히)
          const step = Math.max(1, Math.floor((targetProgress - currentDisplayProgress) / 5));
          currentDisplayProgress = Math.min(targetProgress, currentDisplayProgress + step);
          
          // UI 업데이트
          setQuizGenerationStatus(prev => ({
            ...prev,
            progress: currentDisplayProgress
          }));
        } else if (progressIntervalId) {
          // 목표 도달 시 인터벌 취소
          clearInterval(progressIntervalId);
          progressIntervalId = null;
        }
      }, 100);
    };
    
    // 퀴즈 생성 상태 구독
    const generationSubscriptionId = subscribe(`/topic/room/${roomId}/quiz/generation`, (data) => {
      console.log("퀴즈 생성 상태 수신:", data);
      
      // 서버 메시지 처리
      const newMessage = data.message || "퀴즈를 생성 중입니다...";
      
      // 이전 메시지와 비교하여 중복 방지
      const isDuplicateMessage = newMessage === quizGenerationStatus.lastMessage;
      
      // 진행률 계산 로직 - 서버에서 값이 없으면 단계별로 값 할당
      let progressValue = data.progress;
      if (progressValue === undefined || progressValue === 0) {
        if (data.status === "STARTED") {
          progressValue = 25;
        } else if (data.status === "IN_PROGRESS") {
          // 현재 진행률에 기반하여 증가
          progressValue = Math.min(80, quizGenerationStatus.progress + 15);
        } else if (data.status === "COMPLETED") {
          progressValue = 100;
        }
      }
      
      // 상태 업데이트 (중복 메시지가 아닌 경우에만 메시지 업데이트)
      setQuizGenerationStatus(prev => ({
        ...prev,
        status: data.status,
        message: isDuplicateMessage ? prev.message : newMessage,
        progress: progressValue || prev.progress,
        stage: data.stage,
        totalStages: data.totalStages,
        stageDescription: data.stageDescription,
        animation: data.animation,
        lastMessage: newMessage // 이전 메시지 저장
      }));
      
      // 중복이 아닌 경우만 메시지 전송
      if (!isDuplicateMessage) {
        // 진행 상태에 따른 토스트 메시지 표시
        if (data.status === "STARTED") {
          toast.success("퀴즈 생성이 시작되었습니다!");
        } else if (data.status === "IN_PROGRESS" && progressValue >= 50 && quizGenerationStatus.progress < 50) {
          toast.success(`퀴즈 생성 진행중: 50%`);
        }
      }
      
      // 새 진행률이 이전보다 높으면 부드러운 진행률 애니메이션 시작
      if (progressValue > lastReceivedProgress) {
        lastReceivedProgress = progressValue;
        startSmoothProgress(progressValue);
      }
      
      // 상태에 따른 인공적인 진행률 처리
      if (data.status === "STARTED" && progressValue === 0) {
        // 처음 시작 - 0%에서 20%까지 올라가도록
        lastReceivedProgress = 20;
        startSmoothProgress(20);
        
        // 시작 토스트
        toast.success("퀴즈 생성이 시작되었습니다!");
      } else if (data.status === "IN_PROGRESS") {
        // 진행 중 - 서버에서 진행률을 받지 못하면 점점 올라가도록 처리
        if (progressValue === 0) {
          // 서버에서 명시적인 진행률을 보내지 않는 경우 단계별로 진행률 증가
          const newProgress = Math.min(80, lastReceivedProgress + 15);
          lastReceivedProgress = newProgress;
          startSmoothProgress(newProgress);
        }
        
        // 25%, 50%, 75% 도달 시 토스트 (중복 방지) 
        if (progressValue >= 25 && lastReceivedProgress < 25) {
          toast.success(`퀴즈 생성 진행중: 25%`);
        } else if (progressValue >= 50 && lastReceivedProgress < 50) {
          toast.success(`퀴즈 생성 진행중: 50%`);
        } else if (progressValue >= 75 && lastReceivedProgress < 75) {
          toast.success(`퀴즈 생성 진행중: 75%`);
        }
      }
      
      // 퀴즈 생성이 완료되면 게임 시작 준비
      if (data.status === "COMPLETED") {
        // 완료 시 100%로 설정
        lastReceivedProgress = 100;
        startSmoothProgress(100);
        
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
            
            // 게임 시작 메시지 발행 개선 - 모든 클라이언트에게 확실히 전달되도록 여러 채널에 메시지 발행
            // 1. 명시적 게임 시작 메시지 발행
            publish(`/app/room/${roomId}/game/start`, {
              roomId: roomId,
              quizId: data.quizId,
              gameStatus: "IN_PROGRESS",
              timestamp: Date.now()
            });
            
            // 2. 방 상태 업데이트 메시지 발행 (대체 경로)
            publish(`/app/room/${roomId}/status`, {
              gameStatus: "IN_PROGRESS",
              roomStatus: "IN_GAME",
              quizId: data.quizId,
              timestamp: Date.now()
            });
            
            // 3. 새로운 브로드캐스트 메시지 발행 (모든 사용자에게 게임 시작 통지)
            publish(`/app/room/${roomId}/broadcastGameStart`, {
              roomId: roomId,
              quizId: data.quizId,
              gameStatus: "IN_PROGRESS",
              timestamp: Date.now()
            });
            
            // 4. 시스템 메시지로 게임 시작 알림
            publish(`/app/room/chat/${roomId}`, {
              type: "SYSTEM",
              content: "게임이 시작되었습니다! 모든 플레이어는 문제 화면으로 이동합니다.",
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
            console.log("타이머 강제 리렌더링", forceRenderKey + 1);
          }, 2000); // 2초 지연
        }
      } else if (data.status === "FAILED") {
        // 실패 시 토스트 에러 메시지
        toast.error("퀴즈 생성에 실패했습니다. 다시 시도해주세요.");
      }
    });
    
    // 컴포넌트 언마운트 시 구독 및 인터벌 해제
    return () => {
      unsubscribe(`/topic/room/${roomId}/quiz/generation`);
      if (progressIntervalId) {
        clearInterval(progressIntervalId);
      }
      console.log("퀴즈 생성 상태 구독 해제");
    };
  }, [roomId, publish, quizId, fetchQuestions, quizGenerationStatus.status]);

  // 문제 변경 이벤트 구독은 별도의 useEffect로 분리
  useEffect(() => {
    // 문제 변경 이벤트 구독
    const questionSubscriptionId = subscribe(`/topic/room/${roomId}/question`, (data) => {
      console.log("문제 변경 이벤트 수신:", data);
      
      // 문제 데이터를 수신했으므로 타임아웃이 실행되지 않도록 플래그 설정
      setTimeoutExecuted(true);
      
      // 기존 타임아웃이 있으면 취소
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
        console.log("문제 데이터 수신으로 타임아웃 취소됨");
      }
      
      // 기존 상태 초기화 (다음 문제 준비)
      setAnswerSubmitted(false);
      setSelectedAnswer(null);
      setShowResults(false);
      
      // 문제 인덱스 업데이트 (서버에서 전달한 인덱스 사용)
      if (data.questionIndex !== undefined) {
        console.log(`문제 인덱스 업데이트: 기존=${currentQuestionIndex}, 새로운=${data.questionIndex}`);
        
        // 서버에서 마지막 문제 플래그가 있으면 저장
        if (data.isLastQuestion) {
          console.log("마지막 문제 표시됨");
          window.sessionStorage.setItem('isLastQuestion', 'true');
        } else {
          window.sessionStorage.removeItem('isLastQuestion');
        }
        
        // 문제 인덱스 불일치 시 동기화
        if (data.questionIndex !== currentQuestionIndex) {
          setCurrentQuestionIndex(data.questionIndex);
        }
      }
      
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
          
          // 현재 문제 바로 설정
          // questions 배열 대신 직접 현재 문제 상태 업데이트
          setQuestions(prevQuestions => {
            // 현재 인덱스 위치에 새 문제 저장
            const updatedQuestions = [...prevQuestions];
            
            // 배열 크기 확장이 필요한 경우
            while (updatedQuestions.length <= data.questionIndex) {
              updatedQuestions.push(null as any);
            }
            
            updatedQuestions[data.questionIndex] = newQuestion;
            console.log(`문제 배열 업데이트: 현재 ${updatedQuestions.length}개 문제`);
            return updatedQuestions;
          });
          
          // 답변 상태 초기화 (중요: 마지막 문제에서도 동일하게 초기화)
          setSelectedAnswer(null);
          setAnswerSubmitted(false);
          setShowResults(false);
          
          // 타이머 즉시 시작 (딜레이 제거)
          console.log("타이머 시작: 15초");
          setTimeLeft(15);
          setGameStatus("IN_PROGRESS");
          console.log("문제가 화면에 표시되었습니다:", questionText);
          
          // 마지막 문제인지 확인 (버튼 텍스트 변경용으로만 사용)
          if (data.isLastQuestion) {
            console.log("마지막 문제 표시됨 (결과 버튼 텍스트만 변경)");
            window.sessionStorage.setItem('isLastQuestion', 'true');
          } else {
            window.sessionStorage.removeItem('isLastQuestion');
          }
        } catch (error) {
          console.error("문제 데이터 파싱 중 오류 발생:", error);
        }
      }
      // 이미 questions 배열에 문제가 있는 경우
      else if (data.questionIndex !== undefined && questions[data.questionIndex]) {
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
      
      // 재렌더링 강제 발생
      setForceRenderKey(prev => prev + 1);
    });
    
    return () => {
      unsubscribe(`/topic/room/${roomId}/question`);
      console.log("문제 변경 이벤트 구독 해제");
    };
  }, [roomId, questions, subscribe, unsubscribe]);

  // 문제 데이터 로딩 부분을 별도로 분리
  useEffect(() => {
    // 이미 타임아웃이 실행된 경우 다시 실행하지 않음
    if (timeoutExecuted) {
      console.log("이미 타임아웃이 실행되었으므로 로직을 스킵합니다.");
      return;
    }
    
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
          
          // 중요: 문제 데이터가 이미 있는 경우 즉시 리턴하고 타이머를 설정하지 않음
          if (questions.length > 0 && questions.some(q => q != null)) {
            console.log("이미 문제 데이터가 로드되어 있습니다. 타임아웃 로직을 실행하지 않습니다.");
            return;
          }
          
          console.log(`퀴즈 ID ${finalQuizId}에 해당하는 문제 데이터 요청 중...`);
          
          // 백엔드에 직접 문제 데이터 요청
          publish(`/app/room/${roomId}/question/request`, {
            roomId: roomId,
            quizId: finalQuizId,
            timestamp: Date.now()
          });
          
          // 기존 타임아웃이 있으면 제거
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
          
          // 타임아웃 로직 - 이미 문제 데이터 확인 후 설정
          loadTimeoutRef.current = setTimeout(() => {
            console.log("퀴즈 데이터 수신 시간 초과, 임시 데이터 사용");
            
            // 타임아웃 실행 상태 설정
            setTimeoutExecuted(true);
            
            // 중요: 타임아웃 발생 시점에 다시 한번 문제 데이터 확인
            if (questions.length > 0 && questions.some(q => q != null)) {
              console.log("타임아웃 실행 시점에 이미 문제 데이터가 있어 더미 데이터를 사용하지 않습니다.");
              return;
            }
            
            // 세션 스토리지에 저장된 QuizId 재확인
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
          }, 5000); // 5초로 타임아웃 시간 단축 (테스트 쉽게)
        } catch (error) {
          console.error("문제 데이터를 가져오는 중 오류 발생:", error);
        }
      };
      
      fetchQuestions();
    }
    
    // 컴포넌트 언마운트 시 타임아웃 제거
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [gameStatus, quizId, questions, publish, roomId, timeoutExecuted]);
  
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
    
    // 결과 표시
    setShowResults(true);
    
    // 서버에 결과 표시 알림
    publish(`/app/room/${roomId}/question/result`, {
      roomId: roomId,
      questionIndex: currentQuestionIndex,
      timestamp: Date.now()
    });
    
    console.log(`문제 ${currentQuestionIndex} 결과 표시 중, 곧 다음 문제로 자동 이동합니다`);
    
    // 현재 문제가 마지막 문제인지 확인
    const isLastQuestion = currentQuestionIndex + 1 >= (room?.problemCount || 5) || 
                           window.sessionStorage.getItem('isLastQuestion') === 'true';
    
    // 일정 시간 후 자동으로 다음 문제로 이동 또는 게임 종료
    setTimeout(() => {
      if (isLastQuestion) {
        console.log("마지막 문제였습니다. 게임을 종료합니다.");
        finishGame();
      } else {
        console.log("다음 문제로 자동 이동합니다.");
        moveToNextQuestion();
      }
    }, 5000); // 5초 후 자동 이동
  };
  
  // 답변 제출 처리
  const handleSubmitAnswer = (answer: string) => {
    if (answerSubmitted) return;

    setSelectedAnswer(answer);
    setAnswerSubmitted(true);

    // 정답 인덱스
    const correctAnswerIndex = typeof currentQuestion.correctAnswer === 'number'
      ? currentQuestion.correctAnswer
      : currentQuestion.choices.indexOf(currentQuestion.correctAnswer as string);

    // 선택한 답변 인덱스
    const selectedAnswerIndex = currentQuestion.choices.indexOf(answer);

    // 정답 여부
    const isCorrect = selectedAnswerIndex === correctAnswerIndex;

    // 서버에 답변 전송
    publish(`/app/room/${roomId}/answer`, {
      questionId: currentQuestion.id,
      playerId: currentUserId,
      answer: selectedAnswerIndex,
      isCorrect: isCorrect,
      timestamp: Date.now()
    });

    // 다른 플레이어들에게 선택 알림
    publish(`/app/game/${roomId}/player-choice`, {
      playerId: currentUserId,
      playerNickname: playerScores.find(p => p.id === currentUserId.toString())?.nickname || "플레이어",
      answerId: selectedAnswerIndex,
      avatarUrl: playerScores.find(p => p.id === currentUserId.toString())?.avatarUrl || "",
      timestamp: Date.now()
    });

    // 로컬 상태 업데이트
    updatePlayerScore(isCorrect);

    // API로 답변 제출
    submitAnswerToServer(currentQuestion.id, answer, isCorrect);
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
    // 다음 문제 인덱스 계산
    const nextQuestionIdx = currentQuestionIndex + 1;
    
    // 총 문제 수 결정 (room.problemCount를 우선적으로 사용)
    const totalProblems = room?.problemCount || 5;  // 기본값 5로 설정
    
    console.log(`다음 문제 이동: 현재=${currentQuestionIndex}, 다음=${nextQuestionIdx}, 총=${totalProblems}, questions 배열 길이=${questions.length}`);
    
    // 모든 문제를 풀었다면 게임 종료
    if (nextQuestionIdx >= totalProblems) {
      console.log("모든 문제 완료! 게임 종료합니다.");
      finishGame();  // 직접 finishGame 함수 호출
      return;
    }
    
    // 타이머 리셋을 위한 상태 업데이트 (순서 중요)
    setSelectedAnswer(null);
    setAnswerSubmitted(false);
    setShowResults(false);
    setTimeLeft(15); // 타이머 초기 시간 설정
    
    // 타이머 강제 리렌더링 위한 키 업데이트 (상태 업데이트 후에 실행)
    setForceRenderKey(prev => prev + 1);
    console.log("타이머 강제 리렌더링", forceRenderKey + 1);
    
    // 현재 문제 인덱스 업데이트 (마지막에 수행)
    setCurrentQuestionIndex(nextQuestionIdx);
    
    // 서버에 다음 문제 요청
    publish(`/app/room/${roomId}/question/next`, {
      roomId: roomId,
      currentQuestionIndex: currentQuestionIndex,
      nextQuestionIndex: nextQuestionIdx,
      timestamp: Date.now()
    });
    
    // 다음 문제로 이동했다는 채팅 메시지
    publish(`/app/room/chat/${roomId}`, {
      type: "SYSTEM",
      content: `문제 ${nextQuestionIdx + 1} 시작!`,
      timestamp: Date.now()
    });
    
    // 일정 시간이 지나도 다음 문제가 오지 않으면
    setTimeout(() => {
      if (currentQuestionIndex === nextQuestionIdx && 
          (!currentQuestion || currentQuestion.question === "")) {
        console.log("다음 문제를 받아오지 못했습니다.");
        // 오류 상태를 표시하거나 다시 시도할 수 있는 로직 추가
      }
    }, 3000);
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
    const statusSubscriptionId = subscribe(`/topic/room/${roomId}/status`, (data) => {
      console.log("방 상태 업데이트 수신:", data);
      
      // gameStatus 필드가 있는 경우 게임 상태 업데이트 처리
      if (data.gameStatus) {
        console.log(`게임 상태 업데이트: ${gameStatus} -> ${data.gameStatus}`);
        
        // 대소문자 및 다양한 형식 지원
        const newStatus = data.gameStatus.toUpperCase();
        let finalStatus: "WAITING" | "IN_PROGRESS" | "FINISHED" = gameStatus;
        
        if (newStatus === "IN_PROGRESS" || newStatus === "IN_GAME") {
          finalStatus = "IN_PROGRESS";
          console.log("게임 상태 IN_PROGRESS로 설정");
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
            // 퀴즈 ID를 이용하여 문제 로드
            if (quizId) {
              console.log("저장된 퀴즈 ID로 문제 데이터 로드:", quizId);
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
          }
          
          // 게임이 종료되면 최종 결과 표시
          if (finalStatus === "FINISHED") {
            console.log("게임 종료 감지: 최종 결과 표시 처리");
            // 게임 종료 토스트 메시지
            toast.success("게임이 종료되었습니다! 최종 결과를 확인하세요.", {
              duration: 3000,
              icon: '🏆'
            });
            
            // 게임 종료 처리 함수 호출
            handleGameEnd();
            
            // 최종 채팅 메시지 전송
            publish(`/app/room/chat/${roomId}`, {
              type: "SYSTEM",
              content: "모든 문제가 끝났습니다. 최종 결과를 확인하세요!",
              timestamp: Date.now()
            });
            
            // 결과 화면 표시
            setShowFinalResults(true);
            
            // 결과 데이터 전송 (백엔드가 처리기능을 구현하지 않았더라도 시도)
            try {
              // 최종 점수 정보
              const finalScores = playerScores.map(player => ({
                playerId: player.id,
                score: player.score
              }));
              
              // 서버에 결과 저장 시도
              publish(`/app/room/${roomId}/finish`, {
                roomId: roomId,
                scores: finalScores,
                timestamp: Date.now()
              });
              
              // 최종 결과 브로드캐스트 시도
              publish(`/app/room/${roomId}/scores`, {
                roomId: roomId,
                scores: playerScores,
                timestamp: Date.now()
              });
            } catch (error) {
              console.error("게임 종료 데이터 전송 중 오류:", error);
            }
          }
          
          // 강제 리렌더링
          setForceRenderKey(prev => prev + 1);
        }
      }
      // 게임 종료 메시지 직접 감지 (gameEnd 필드가 있는 경우)
      else if (data.gameEnd === true || data.status === "GAME_END") {
        console.log("게임 종료 메시지 직접 감지");
        
        // 게임 종료 상태로 변경
        setGameStatus("FINISHED");
        
        // 게임 종료 처리 함수 호출
        handleGameEnd();
        
        // 결과 화면 표시
        setShowFinalResults(true);
      }
      // 기존 상태 업데이트 로직 유지
      else if (data.status) {
        // 기존 코드 유지
      } else {
        console.warn("방 상태 업데이트: 지원되지 않는 메시지 형식", data);
      }
    });
    
    return () => {
      unsubscribe(`/topic/room/${roomId}/status`);
      console.log("방 상태 구독 해제");
    };
  }, [roomId, gameStatus, quizId, fetchQuestions, playerScores]);
  
  // 게임 상태가 변경될 때마다 타임아웃 상태 초기화
  useEffect(() => {
    // 게임 상태가 변경될 때 타임아웃 상태 초기화
    console.log(`게임 상태 변경 감지: ${gameStatus}`);
    
    if (gameStatus === "IN_PROGRESS") {
      // 게임이 시작되면 타임아웃 상태 초기화
      setTimeoutExecuted(false);
      console.log("게임 시작으로 타임아웃 실행 상태 초기화");
    }
    
    // 기존 타임아웃 제거
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
      console.log("게임 상태 변경으로 타임아웃 제거");
    }
  }, [gameStatus]);
  
  // 플레이어 선택 수신을 위한 웹소켓 구독 추가 (useEffect 내에 추가)
  useEffect(() => {
    // 다른 플레이어의 선택 구독
    const playerChoiceSubscriptionId = subscribe(`/topic/game/${roomId}/player-choice`, (data) => {
      console.log("다른 플레이어 선택 수신:", data);
      
      // 자신의 선택은 무시
      if (data.playerId === currentUserId) {
        return;
      }
      
      // 플레이어 선택 정보 업데이트
      setPlayerChoices(prev => ({
        ...prev,
        [data.playerId]: {
          nickname: data.playerNickname,
          answerId: data.answerId,
          avatarUrl: data.avatarUrl
        }
      }));
      
      // 토스트 메시지 (선택적)
      toast.success(`${data.playerNickname}님이 선택했습니다.`, {
        duration: 1500,
        icon: '👆'
      });
    });
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      unsubscribe(`/topic/game/${roomId}/player-choice`);
    };
  }, [roomId, currentUserId, subscribe, unsubscribe]);

  // 문제 변경 시 플레이어 선택 초기화
  useEffect(() => {
    // 새 문제로 변경되면 플레이어 선택 초기화
    setPlayerChoices({});
  }, [currentQuestionIndex]);
  
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
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="text-gray-400 mr-2">문제</div>
            <div className="text-xl font-bold text-white">
              {currentQuestionIndex + 1}/{room?.problemCount || questions.filter(q => q !== null).length || 1}
            </div>
          </div>
          
          <div className="flex-grow flex justify-center items-center">
            <FaClock className="text-gray-400 mr-2" />
            <Timer 
              key={forceRenderKey}
              initialTime={timeLeft} 
              onExpire={handleTimerExpired}
              show={!showResults}
            />
          </div>
          
          <div className="w-16"></div> {/* 균형을 위한 빈 공간 */}
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
              playerChoices={playerChoices}
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