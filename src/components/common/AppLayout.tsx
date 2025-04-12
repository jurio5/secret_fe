import { ReactNode, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface AppLayoutProps {
  children: ReactNode;
  showHomeButton?: boolean;
  showBeforeUnloadWarning?: boolean;
}

export default function AppLayout({ 
  children, 
  showHomeButton = true,
  showBeforeUnloadWarning = false 
}: AppLayoutProps) {
  
  useEffect(() => {
    // 페이지를 나가거나 새로고침할 때 경고 메시지 표시
    if (showBeforeUnloadWarning) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        const message = '페이지를 나가시겠습니까? 진행 중인 연결이 끊어질 수 있습니다.';
        e.preventDefault();
        e.returnValue = message;
        return message;
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [showBeforeUnloadWarning]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-br from-blue-800/30 to-indigo-800/20 rounded-full blur-3xl transform translate-x-1/4 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-gradient-to-tr from-indigo-800/20 to-blue-800/20 rounded-full blur-3xl transform -translate-x-1/4 translate-y-1/4" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header showHomeButton={showHomeButton} />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
} 