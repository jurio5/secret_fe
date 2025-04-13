import { ReactNode, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface AppLayoutProps {
  children: ReactNode;
  showHomeButton?: boolean;
  showBeforeUnloadWarning?: boolean;
  showHeader?: boolean;
}

export default function AppLayout({ 
  children, 
  showHomeButton = true,
  showBeforeUnloadWarning = false,
  showHeader = true
}: AppLayoutProps) {
  
  useEffect(() => {
    // 페이지를 나가거나 새로고침할 때 경고 메시지 표시
    if (showBeforeUnloadWarning) {
      console.log('beforeunload 경고가 활성화되었습니다.');
      
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // 의도적인 페이지 이동인 경우 경고 표시하지 않음
        if (localStorage.getItem('intentional_navigation') === 'true') {
          // 플래그 즉시 제거 (한 번의 네비게이션에만 사용되도록)
          localStorage.removeItem('intentional_navigation');
          return;
        }
        
        const message = '페이지를 나가시겠습니까? 진행 중인 연결이 끊어질 수 있습니다.';
        e.preventDefault();
        e.returnValue = message;
        return message;
      };
      
      // 페이지 로드 시에도 플래그 정리 (안전장치)
      localStorage.removeItem('intentional_navigation');
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        console.log('beforeunload 경고가 제거되었습니다.');
        window.removeEventListener('beforeunload', handleBeforeUnload);
        // 언마운트 시에도 플래그 정리 (안전장치)
        localStorage.removeItem('intentional_navigation');
      };
    }
  }, [showBeforeUnloadWarning]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-br from-blue-800/30 to-indigo-800/20 rounded-full blur-3xl transform translate-x-1/4 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-gradient-to-tr from-indigo-800/20 to-blue-800/20 rounded-full blur-3xl transform -translate-x-1/4 translate-y-1/4" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {showHeader && <Header showHomeButton={showHomeButton} />}
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
} 