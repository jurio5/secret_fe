"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRoleFromCookie } from "@/lib/utils/CookieUtil";

interface OAuth2RedirectProps {
  onLoginSuccess?: () => void;
}

const OAuth2RedirectHandler = ({ onLoginSuccess }: OAuth2RedirectProps) => {
  const router = useRouter();

  useEffect(() => {
    const handleOAuth2Redirect = async () => {
      
      const searchParams = new URLSearchParams(window.location.search);
      const status = searchParams.get("status");
      

      try {
        if (!status) {
          console.error("상태 정보가 없습니다!");
          throw new Error("OAuth 인증 상태 정보가 없습니다");
        }
        
        switch (status) {
          case "REGISTER": {
            onLoginSuccess?.();
            
            const lobbyUrl = `/lobby?status=${encodeURIComponent(status)}`;
            
            document.cookie = `oauth_status=${status}; path=/`;
            
            localStorage.setItem('oauth_status', status);
            
            window.location.href = lobbyUrl;
            break;
          }

          case "SUCCESS": {
            onLoginSuccess?.();
            const roleData = getRoleFromCookie();
            if (roleData?.role === "ADMIN") {
              window.location.href = "/admin";
              break;
            }
            window.location.href = "/lobby";
            break;
          }

          default:
            console.error("알 수 없는 상태:", status);
            throw new Error("잘못된 인증 상태입니다.");
        }
      } catch (error) {
        console.error("OAuth2 리다이렉트 처리 중 오류 발생:", error);
        window.location.href = `/login?error=${encodeURIComponent(
          error instanceof Error
            ? error.message
            : "인증 처리 중 오류가 발생했습니다."
        )}`;
      }
    };

    handleOAuth2Redirect();
  }, [router, onLoginSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900" />
      <p className="ml-3 text-gray-500">OAuth 인증 처리 중...</p>
    </div>
  );
};

export default OAuth2RedirectHandler;
