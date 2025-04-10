"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-blue-100 to-white" />

      {/* Decorative circles */}
      <div className="fixed top-10 right-10 md:top-20 md:right-20 w-32 h-32 md:w-64 md:h-64 bg-blue-200 rounded-full blur-3xl opacity-20" />
      <div className="fixed bottom-10 left-10 md:bottom-20 md:left-20 w-48 h-48 md:w-96 md:h-96 bg-blue-300 rounded-full blur-3xl opacity-10" />

      <div className="relative z-10 w-full">
        <header className="bg-white/80 backdrop-blur-sm py-4 px-6 shadow-sm">
          <div className="container mx-auto flex justify-between items-center">
            <Link href="/">
              <h1 className="text-xl font-bold text-blue-600">Quizzle</h1>
            </Link>
            <Link href="/">
              <button className="text-blue-500 px-4 py-2 rounded-lg text-sm">
                홈으로
              </button>
            </Link>
          </div>
        </header>

        <div className="content-wrapper container mx-auto px-4 max-w-5xl py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-8">
            Quizzle 서비스 소개
          </h1>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Quizzle이란?</h2>
            <p className="text-lg text-gray-600 mb-6">
              Quizzle은 GPT를 활용한 실시간 대화형 퀴즈 플랫폼입니다. 다양한 주제와 난이도의 퀴즈를 친구들과 함께 즐기며 지식을 테스트하고 새로운 정보를 배울 수 있습니다.
            </p>
            <p className="text-lg text-gray-600">
              소셜 로그인을 통해 간편하게 가입하고, 방을 생성하거나 참여하여 퀴즈 게임을 즐겨보세요!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-3">GPT 기반 퀴즈 생성</h2>
              <p className="text-gray-600">
                최신 GPT 기술을 활용하여 다양한 주제와 난이도의 퀴즈를 실시간으로 생성합니다. 객관식과 OX 퀴즈 등 다양한 형태의 문제를 제공합니다.
              </p>
            </div>
            
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-3">실시간 멀티플레이</h2>
              <p className="text-gray-600">
                웹소켓 기술을 활용한 실시간 대화형 퀴즈 방에서 친구들과 함께 퀴즈를 풀고 경쟁할 수 있습니다. 최대 8명까지 한 방에서 게임을 즐길 수 있습니다.
              </p>
            </div>
            
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-3">다양한 난이도</h2>
              <p className="text-gray-600">
                쉬움, 보통, 어려움 등 다양한 난이도의 퀴즈를 선택하여 자신의 지식 수준에 맞게 즐길 수 있습니다. 난이도에 따라 획득할 수 있는 포인트도 달라집니다.
              </p>
            </div>
            
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-3">소셜 로그인</h2>
              <p className="text-gray-600">
                구글, 카카오 등 소셜 계정을 통해 간편하게 가입하고 로그인할 수 있습니다. 별도의 회원가입 절차 없이 바로 서비스를 이용할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">어떻게 시작하나요?</h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-600">
              <li>소셜 계정으로 간편하게 로그인합니다.</li>
              <li>퀴즈 방을 생성하거나 기존 방에 참여합니다.</li>
              <li>방장이 게임을 시작하면 실시간으로 퀴즈가 제공됩니다.</li>
              <li>정답을 맞추고 포인트를 획득하세요!</li>
            </ol>
          </div>

          <div className="text-center">
            <Link href="/">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium transition-colors">
                지금 시작하기
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 