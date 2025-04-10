"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import AppLayout from "@/components/common/AppLayout";

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center px-4 py-10">
      <div className="content-wrapper w-full max-w-md">
        <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-8 border border-gray-700">
          <h1 className="text-2xl font-bold text-center mb-6">
            <span className="bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">Quizzle 로그인</span>
          </h1>
          
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800 text-red-300 rounded-xl text-sm">
              {error}
            </div>
          )}
          
          <p className="text-center text-gray-300 mb-8">
            소셜 계정으로 간편하게 로그인하세요
          </p>
          
          <div className="space-y-4">
            <a 
              href="/oauth2/authorization/kakao"
              className="flex items-center justify-center w-full px-4 py-3.5 space-x-4 bg-[#FEE500] text-[#3C1E1E] rounded-xl hover:shadow-md transition-all"
            >
              <div className="w-6 h-6 relative">
                <Image
                  src="/images/kakao.png"
                  alt="Kakao"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-medium">카카오로 시작하기</span>
            </a>
            
            <a 
              href="/oauth2/authorization/google"
              className="flex items-center justify-center w-full px-4 py-3.5 space-x-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:shadow-md transition-all"
            >
              <div className="w-6 h-6 relative">
                <Image
                  src="/images/google.png"
                  alt="Google"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-medium">구글로 시작하기</span>
            </a>
          </div>
          
          <div className="mt-8 text-center text-sm text-gray-400">
            <p>처음 방문하시나요? 소셜 로그인 시 자동으로 회원가입이 됩니다.</p>
          </div>
        </div>
        
        <div className="absolute -z-10 -top-10 -right-10 w-40 h-40 bg-blue-800/30 rounded-full blur-xl"></div>
        <div className="absolute -z-10 -bottom-10 -left-10 w-40 h-40 bg-indigo-800/30 rounded-full blur-xl"></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-gray-400">로딩 중...</div>
      </div>}>
        <LoginContent />
      </Suspense>
    </AppLayout>
  );
} 