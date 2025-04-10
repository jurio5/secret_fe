"use client";
import Link from "next/link";
import { useState } from "react";
import AppLayout from "@/components/common/AppLayout";

export default function Page() {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const correctAnswer = "B";
  
  const [resultAnimating, setResultAnimating] = useState(false);
  
  const handleAnswerClick = (option: string) => {
    setSelectedAnswer(option);
    setResultAnimating(true);
    
    setTimeout(() => {
      setShowResult(true);
      setResultAnimating(false);
    }, 300);
    
    setTimeout(() => {
      setShowResult(false);
      setSelectedAnswer(null);
    }, 3000);
  };
  
  const getAnswerClass = (option: string) => {
    if (!showResult) {
      return selectedAnswer === option 
        ? "bg-blue-600/30 border-blue-500" 
        : "bg-gray-700/60 border-gray-600 hover:bg-blue-600/30 hover:border-blue-500";
    }
    
    if (option === correctAnswer) {
      return "bg-green-600/30 border-green-500";
    }
    
    if (selectedAnswer === option && option !== correctAnswer) {
      return "bg-red-600/30 border-red-500";
    }
    
    return "bg-gray-700/60 border-gray-600";
  };

  return (
    <AppLayout showHomeButton={false}>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="content-wrapper container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row items-center gap-12 mb-12">
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                지식을 <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">테스트</span>하고<br/> 함께 <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">성장</span>하세요
              </h1>
              <p className="text-lg text-gray-300 mb-8 max-w-md mx-auto md:mx-0">
                Quizzle에서 다양한 주제의 퀴즈를 풀고 친구들과 경쟁하며 새로운 지식을 쌓아보세요.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-4">
                <Link href="/login">
                  <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-full font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40">
                    시작하기
                  </button>
                </Link>
                <Link href="/about">
                  <button className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-8 py-3 rounded-full font-medium transition-all shadow-md shadow-gray-900/30 hover:shadow-gray-900/50">
                    더 알아보기
                  </button>
                </Link>
              </div>
            </div>
            
            <div className="flex-1 relative max-w-md">
              <div className="absolute -top-5 -right-5 w-20 h-20 bg-blue-800/30 rounded-full blur-md z-0"></div>
              <div className="absolute -bottom-5 -left-5 w-24 h-24 bg-indigo-800/30 rounded-full blur-md z-0"></div>
              
              <div className="relative bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-xl overflow-hidden p-6 h-[520px] flex items-center justify-center z-10">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/10 to-indigo-900/5"></div>
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-blue-900/20 rounded-full blur-xl"></div>
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-900/20 rounded-full blur-xl"></div>
                
                <div className="relative w-full h-full z-10 flex flex-col gap-4 overflow-hidden">
                  <div className="flex justify-between items-center bg-gray-900/80 rounded-xl p-3 border border-gray-800">
                    <div className="text-sm text-gray-300">퀴즈 #42</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <div className="text-sm text-gray-300">02:45</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gray-900/80 rounded-xl p-3 border border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600/60 flex items-center justify-center text-xs text-white">K</div>
                      <div className="text-sm text-gray-300">퀴즐</div>
                    </div>
                    <div className="text-sm text-blue-400">
                      {showResult && selectedAnswer === correctAnswer ? '1300점' : '1200점'}
                    </div>
                  </div>
                  
                  <div className="flex-grow flex flex-col bg-gray-900/80 rounded-xl p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-xs uppercase tracking-wider text-blue-400">일반 상식</div>
                      <div className="px-2 py-0.5 bg-indigo-900/50 rounded-md text-[10px] text-indigo-300 border border-indigo-800/50">
                        데모 화면 • 실제 게임과 다를 수 있음
                      </div>
                    </div>
                    <div className="font-medium text-white mb-4">세계에서 가장 긴 강은 무엇일까요?</div>
                    
                    <div className={`overflow-hidden transition-all duration-300 ${showResult ? 'max-h-[100px]' : 'max-h-0'}`}>
                      <div className={`p-2 rounded-lg text-sm ${selectedAnswer === correctAnswer ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'}`}>
                        {selectedAnswer === correctAnswer 
                          ? '정답입니다! 나일강은 길이 6,650km로 세계에서 가장 긴 강입니다.' 
                          : `오답입니다! 정답은 B. 나일 강입니다. 길이 6,650km로 세계에서 가장 긴 강입니다.`}
                      </div>
                    </div>
                    
                    <div className={`${showResult ? 'h-4' : 'h-0'} transition-all duration-300`}></div>
                    
                    <div className="space-y-2 overflow-y-auto pr-1">
                      <div 
                        className={`p-2 pl-3 rounded-lg text-gray-300 text-sm cursor-pointer transition-colors border ${getAnswerClass('A')}`}
                        onClick={() => !showResult && handleAnswerClick('A')}
                      >
                        <span className="font-medium">A.</span> 아마존 강
                      </div>
                      <div 
                        className={`p-2 pl-3 rounded-lg text-gray-300 text-sm cursor-pointer transition-colors border ${getAnswerClass('B')}`}
                        onClick={() => !showResult && handleAnswerClick('B')}
                      >
                        <span className="font-medium">B.</span> 나일 강
                      </div>
                      <div 
                        className={`p-2 pl-3 rounded-lg text-gray-300 text-sm cursor-pointer transition-colors border ${getAnswerClass('C')}`}
                        onClick={() => !showResult && handleAnswerClick('C')}
                      >
                        <span className="font-medium">C.</span> 양쯔 강
                      </div>
                      <div 
                        className={`p-2 pl-3 rounded-lg text-gray-300 text-sm cursor-pointer transition-colors border ${getAnswerClass('D')}`}
                        onClick={() => !showResult && handleAnswerClick('D')}
                      >
                        <span className="font-medium">D.</span> 미시시피 강
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 text-center">
                <div className="text-xs text-gray-500 italic">
                  클릭하여 답변을 선택해보세요
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
