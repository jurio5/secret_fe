"use client";

import { useState, useEffect } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';

interface QuizQuestionProps {
  question: {
    id: string;
    question: string;
    choices: string[];
    correctAnswer: string | number;
    explanation?: string;
  };
  selectedAnswer: string | null;
  onSelectAnswer: (answer: string) => void;
  showResults: boolean;
  answerSubmitted: boolean;
  onNext: () => void;
  isLastQuestion: boolean;
}

export default function QuizQuestion({
  question,
  selectedAnswer,
  onSelectAnswer,
  showResults,
  answerSubmitted,
  onNext,
  isLastQuestion
}: QuizQuestionProps) {
  // 정답 인덱스
  const correctAnswerIndex = typeof question.correctAnswer === 'number' 
    ? question.correctAnswer 
    : question.choices.indexOf(question.correctAnswer);
  
  // 선택지 라벨
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  // 선택된 답변 인덱스
  const selectedAnswerIndex = selectedAnswer 
    ? question.choices.indexOf(selectedAnswer) 
    : null;
  
  // 정답 여부
  const isCorrect = selectedAnswerIndex === correctAnswerIndex;
  
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 h-full flex flex-col">
      {/* 문제 텍스트 */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-3">{question.question}</h2>
      </div>
      
      {/* 선택지 목록 */}
      <div className="flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {question.choices.map((choice, index) => (
            <button
              key={index}
              className={`p-4 rounded-lg text-left transition-all border ${
                selectedAnswerIndex === index 
                  ? showResults
                    ? isCorrect
                      ? 'bg-green-900/30 border-green-500 text-green-300'
                      : 'bg-red-900/30 border-red-500 text-red-300'
                    : 'bg-blue-900/30 border-blue-500 text-blue-300'
                  : showResults && index === correctAnswerIndex
                    ? 'bg-green-900/30 border-green-500 text-green-300'
                    : 'bg-gray-700/50 border-gray-600 text-white hover:bg-gray-700 hover:border-gray-500'
              } ${
                answerSubmitted ? 'cursor-default' : 'cursor-pointer'
              }`}
              onClick={() => !answerSubmitted && onSelectAnswer(choice)}
              disabled={answerSubmitted}
            >
              <div className="flex items-start">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mr-3 ${
                  selectedAnswerIndex === index 
                    ? showResults
                      ? isCorrect
                        ? 'bg-green-700 text-white'
                        : 'bg-red-700 text-white'
                      : 'bg-blue-700 text-white'
                    : showResults && index === correctAnswerIndex
                      ? 'bg-green-700 text-white'
                      : 'bg-gray-600 text-white'
                }`}>
                  {labels[index]}
                </div>
                <div className="flex-grow pt-1">
                  {choice}
                </div>
                {showResults && (
                  <div className="flex-shrink-0 ml-2">
                    {index === correctAnswerIndex ? (
                      <FaCheck className="text-green-400 text-lg" />
                    ) : (
                      selectedAnswerIndex === index && <FaTimes className="text-red-400 text-lg" />
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* 정답 설명 */}
      {showResults && question.explanation && (
        <div className="mt-4 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
          <h3 className="text-lg font-semibold text-white mb-2">해설</h3>
          <p className="text-gray-300">{question.explanation}</p>
        </div>
      )}
      
      {/* 타이머 종료 후 결과가 표시될 때 자동 이동 안내 메시지 */}
      {showResults && (
        <div className="mt-5 text-center text-gray-400">
          <p>{isLastQuestion ? '곧 결과 화면으로 이동합니다...' : '곧 다음 문제로 이동합니다...'}</p>
        </div>
      )}
    </div>
  );
} 