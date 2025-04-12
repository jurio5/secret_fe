"use client";

import Link from "next/link";
import AppLayout from "@/components/common/AppLayout";

export default function AboutPage() {
  return (
    <AppLayout>
      <div className="container mx-auto px-8 py-8 max-w-6xl">
        <h1 className="text-4xl font-bold text-center text-white mb-8">
          <span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">Quizzle에 대해 알아보세요</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800/60 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 col-span-3 hover:shadow-2xl transition-all duration-300">
            <h2 className="text-3xl font-bold text-white mb-4">
              <span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">Quizzle이란?</span>
            </h2>
            <p className="text-lg text-gray-200 leading-relaxed">
              Quizzle은 GPT를 활용한 실시간 대화형 퀴즈 플랫폼입니다. 다양한 주제와 난이도의 퀴즈를 친구들과 함께 즐기며 지식을 테스트하고 새로운 정보를 배울 수 있습니다. 소셜 로그인을 통해 간편하게 가입하고, 방을 생성하거나 참여하여 실시간으로 퀴즈 게임을 즐겨보세요!
            </p>
          </div>

          <div className="bg-gray-800/60 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/40 hover:shadow-blue-900/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/40 flex items-center justify-center mr-4 shadow-lg shadow-blue-800/30">
                <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                <span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">GPT 기반 퀴즈 생성</span>
              </h3>
            </div>
            <p className="text-base text-gray-200">
              최신 GPT 기술로 다양한 주제의 퀴즈를 생성합니다. 객관식과 OX 퀴즈 등 다양한 형태 제공.
            </p>
          </div>

          <div className="bg-gray-800/60 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-indigo-500/40 hover:shadow-indigo-900/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600/40 flex items-center justify-center mr-4 shadow-lg shadow-indigo-800/30">
                <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                <span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">실시간 멀티플레이</span>
              </h3>
            </div>
            <p className="text-base text-gray-200">
              웹소켓 기술로 실시간 대화형 퀴즈 방에서 친구들과 함께 퀴즈를 풀고 경쟁. 최대 8명 참여 가능.
            </p>
          </div>

          <div className="bg-gray-800/60 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-purple-500/40 hover:shadow-purple-900/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-600/40 flex items-center justify-center mr-4 shadow-lg shadow-purple-800/30">
                <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                <span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">다양한 난이도</span>
              </h3>
            </div>
            <p className="text-base text-gray-200">
              쉬움, 보통, 어려움 등 다양한 난이도 퀴즈로 자신의 지식 수준에 맞게 즐길 수 있습니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gray-800/60 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/40 hover:shadow-blue-900/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/40 flex items-center justify-center mr-4 shadow-lg shadow-blue-800/30">
                <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                <span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">소셜 로그인</span>
              </h3>
            </div>
            <p className="text-base text-gray-200">
              구글, 카카오 등 소셜 계정으로 간편하게 가입하고 로그인. 별도 회원가입 불필요.
            </p>
          </div>

          <div className="bg-gray-800/60 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 col-span-2 hover:border-gray-600/70 hover:shadow-gray-900/20 hover:shadow-2xl transition-all duration-300">
            <h2 className="text-2xl font-bold text-white mb-4">
              <span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">어떻게 시작하나요?</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-base text-gray-200 flex items-start">
                <span className="bg-blue-500/30 text-blue-300 rounded-full w-7 h-7 flex items-center justify-center mr-3 flex-shrink-0 shadow-md">1</span>
                <span>소셜 계정으로 간편하게 로그인합니다.</span>
              </div>
              <div className="text-base text-gray-200 flex items-start">
                <span className="bg-blue-500/30 text-blue-300 rounded-full w-7 h-7 flex items-center justify-center mr-3 flex-shrink-0 shadow-md">2</span>
                <span>퀴즈 방을 생성하거나 기존 방에 참여합니다.</span>
              </div>
              <div className="text-base text-gray-200 flex items-start">
                <span className="bg-blue-500/30 text-blue-300 rounded-full w-7 h-7 flex items-center justify-center mr-3 flex-shrink-0 shadow-md">3</span>
                <span>방장이 게임을 시작하면 실시간으로 퀴즈가 제공됩니다.</span>
              </div>
              <div className="text-base text-gray-200 flex items-start">
                <span className="bg-blue-500/30 text-blue-300 rounded-full w-7 h-7 flex items-center justify-center mr-3 flex-shrink-0 shadow-md">4</span>
                <span>정답을 맞추고 레벨을 올려서 포인트를 획득하세요!</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href="/login">
            <button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-12 py-4 rounded-full font-medium transition-all shadow-xl shadow-blue-900/30 hover:shadow-2xl hover:shadow-blue-900/50 text-xl">
              지금 시작하기
            </button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
} 