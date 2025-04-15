"use client";

import { useState, useEffect, useRef } from "react";

interface TimerProps {
  initialTime: number;
  onExpire: () => void;
  show: boolean;
}

export default function Timer({ initialTime, onExpire, show }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(initialTime);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const hasExpiredRef = useRef<boolean>(false);
  
  // 타이머 표시 여부에 따라 일시 정지 (show가 true면 타이머를 계속 실행, false면 일시 정지)
  useEffect(() => {
    setIsPaused(!show);
  }, [show]);
  
  // 초기 시간이 변경되면 타이머 재설정
  useEffect(() => {
    console.log("Timer: initialTime 변경됨", initialTime);
    setTimeLeft(initialTime);
    hasExpiredRef.current = false;
    
    // show가 true인 경우만 타이머 시작, 아니면 일시 정지
    setIsPaused(!show);
  }, [initialTime, show]);
  
  // 타이머 카운트다운
  useEffect(() => {
    // 일시 정지된 경우만 타이머 중지
    if (isPaused) return;
    
    // timeLeft가 0이면 onExpire 호출 (최초 1회만)
    if (timeLeft === 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire();
      return;
    }
    
    // 이미 만료되었거나 시간이 0이면 추가 처리 없음
    if (timeLeft <= 0) return;
    
    const timer = setTimeout(() => {
      // 남은 시간 감소
      setTimeLeft(timeLeft - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [timeLeft, isPaused, onExpire]);
  
  // 시간을 분:초 형식으로 포맷팅
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 남은 시간에 따라 색상 지정
  const getTimeColor = (): string => {
    if (timeLeft <= 5) return "text-red-400";
    if (timeLeft <= 10) return "text-yellow-400";
    return "text-white";
  };
  
  return (
    <div className={`font-mono text-xl font-bold ${getTimeColor()}`}>
      {formatTime(timeLeft)}
    </div>
  );
} 