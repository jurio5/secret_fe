"use client";

import Link from "next/link";
import AppLayout from "@/components/common/AppLayout";

export default function AboutPage() {
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold text-center text-white mb-12">
          <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">Quizzle에 대해 알아보세요</span>
        </h1>

        <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-8 border border-gray-700 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">Quizzle이란?</span>
          </h2>
          <p className="text-gray-300 mb-6 leading-relaxed">
            Quizzle은 GPT를 활용한 실시간 대화형 퀴즈 플랫폼입니다. 다양한 주제와 난이도의 퀴즈를 친구들과 함께 즐기며 지식을 테스트하고 새로운 정보를 배울 수 있습니다.
          </p>
          <p className="text-gray-300 leading-relaxed">
            소셜 로그인을 통해 간편하게 가입하고, 방을 생성하거나 참여하여 실시간으로 퀴즈 게임을 즐겨보세요!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-gray-700 transform hover:scale-105 transition-transform">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/30 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">GPT 기반 퀴즈 생성</span>
              </h3>
            </div>
            <p className="text-gray-300">
              최신 GPT 기술을 활용하여 다양한 주제와 난이도의 퀴즈를 실시간으로 생성합니다. 객관식과 OX 퀴즈 등 다양한 형태의 문제를 제공합니다.
            </p>
          </div>

          <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-gray-700 transform hover:scale-105 transition-transform">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600/30 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">실시간 멀티플레이</span>
              </h3>
            </div>
            <p className="text-gray-300">
              웹소켓 기술을 활용한 실시간 대화형 퀴즈 방에서 친구들과 함께 퀴즈를 풀고 경쟁할 수 있습니다. 최대 8명까지 한 방에서 게임을 즐길 수 있습니다.
            </p>
          </div>

          <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-gray-700 transform hover:scale-105 transition-transform">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-600/30 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">다양한 난이도</span>
              </h3>
            </div>
            <p className="text-gray-300">
              쉬움, 보통, 어려움 등 다양한 난이도의 퀴즈를 선택하여 자신의 지식 수준에 맞게 즐길 수 있습니다. 난이도에 따라 획득할 수 있는 포인트도 달라집니다.
            </p>
          </div>

          <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-gray-700 transform hover:scale-105 transition-transform">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/30 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">소셜 로그인</span>
              </h3>
            </div>
            <p className="text-gray-300">
              구글, 카카오 등 소셜 계정을 통해 간편하게 가입하고 로그인할 수 있습니다. 별도의 회원가입 절차 없이 바로 서비스를 이용할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 md:p-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">어떻게 시작하나요?</span>
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-300">
            <li>소셜 계정으로 간편하게 로그인합니다.</li>
            <li>퀴즈 방을 생성하거나 기존 방에 참여합니다.</li>
            <li>방장이 게임을 시작하면 실시간으로 퀴즈가 제공됩니다.</li>
            <li>정답을 맞추고 레벨을 올려서 포인트를 획득하세요!</li>
          </ol>
        </div>

        <div className="text-center">
          <Link href="/login">
            <button className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-8 py-3 rounded-full font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40">
              지금 시작하기
            </button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
} 