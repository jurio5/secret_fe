"use client";

import { useState, useEffect } from "react";

interface TimerProps {
  initialTime: number;
  onExpire: () => void;
  show: boolean;
}

export default function Timer({ initialTime, onExpire, show }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(initialTime);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  
  // 타이머 표시 여부에 따라 일시 정지
  useEffect(() => {
    if (!show) {
      setIsPaused(true);
    } else {
      setIsPaused(false);
    }
  }, [show]);
  
  // 초기 시간이 변경되면 타이머 재설정
  useEffect(() => {
    setTimeLeft(initialTime);
    setIsPaused(false);
  }, [initialTime]);
  
  // 타이머 카운트다운
  useEffect(() => {
    if (timeLeft <= 0 || isPaused) return;
    
    const timer = setTimeout(() => {
      if (timeLeft > 0) {
        setTimeLeft(timeLeft - 1);
      }
      
      if (timeLeft === 1) {
        // 시간이 끝날 때 콜백 호출
        onExpire();
      }
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