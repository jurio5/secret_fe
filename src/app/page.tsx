"use client";

export default function Page() {
  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-blue-100 to-white" />

      {/* Decorative circles */}
      <div className="fixed top-10 right-10 md:top-20 md:right-20 w-32 h-32 md:w-64 md:h-64 bg-blue-200 rounded-full blur-3xl opacity-20" />
      <div className="fixed bottom-10 left-10 md:bottom-20 md:left-20 w-48 h-48 md:w-96 md:h-96 bg-blue-300 rounded-full blur-3xl opacity-10" />

      <div className="relative z-10 w-full">
        <header className="bg-white/80 backdrop-blur-sm py-4 px-6 shadow-sm">
          <div className="container mx-auto flex justify-center">
            <h1 className="text-xl font-bold text-blue-600">Quizzle</h1>
          </div>
        </header>

        <div className="content-wrapper container mx-auto px-4 max-w-7xl pb-20">
          {/* Hero Section */}
          <div className="text-center mt-16 mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 px-4">
              Quizzle에 오신 것을 환영합니다
            </h1>
            <p className="text-lg text-gray-600 mb-8 px-4">
              지식을 테스트하고 새로운 것을 배워보세요
            </p>
            
            <div className="mt-8 flex justify-center space-x-4">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                시작하기
              </button>
              <button className="bg-white hover:bg-gray-100 text-blue-500 border border-blue-500 px-6 py-3 rounded-lg font-medium transition-colors">
                더 알아보기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
