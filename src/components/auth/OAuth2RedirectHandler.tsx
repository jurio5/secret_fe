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
      
      console.log("OAuth 리다이렉트 처리 시작:", status);

      try {
        if (!status) {
          console.error("상태 정보가 없습니다!");
          throw new Error("OAuth 인증 상태 정보가 없습니다");
        }
        
        switch (status) {
          case "REGISTER": {
            onLoginSuccess?.();
            console.log("신규 사용자(REGISTER) 감지, 닉네임 설정으로 리다이렉션");
            
            // 사용자 정보를 미리 확인하여 로컬 스토리지에 저장
            try {
              const userResponse = await fetch(`${process.env.NEXT_PUBLIC_WAS_HOST}/api/v1/members/me`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include'
              });
              
              if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData.data) {
                  // 사용자 기본 정보를 로컬 스토리지에 저장
                  localStorage.setItem('user_id', userData.data.id);
                  localStorage.setItem('user_email', userData.data.email);
                  console.log("사용자 기본 정보 저장 완료:", userData.data.id);
                }
              }
            } catch (e) {
              console.error("사용자 정보 미리 확인 중 오류:", e);
            }
            
            const lobbyUrl = `/lobby?status=${encodeURIComponent(status)}`;
            
            document.cookie = `oauth_status=${status}; path=/; max-age=3600`;
            localStorage.setItem('oauth_status', status);
            localStorage.setItem('needs_nickname', 'true');
            localStorage.setItem('quizzle_register_status', 'true');
            
            // 쿠키 만료 시간 설정 (1시간)
            const date = new Date();
            date.setTime(date.getTime() + (3600 * 1000));
            document.cookie = `needs_nickname=true; path=/; expires=${date.toUTCString()}`;
            
            window.location.href = lobbyUrl;
            break;
          }

          case "SUCCESS": {
            onLoginSuccess?.();
            console.log("로그인 성공(SUCCESS), 사용자 프로필 확인 시작");
            
            const roleData = getRoleFromCookie();
            if (roleData?.role === "ADMIN") {
              console.log("관리자 권한 감지, 관리자 페이지로 이동");
              window.location.href = "/admin";
              break;
            }
            
            // 사용자의 프로필을 체크하여 닉네임이 비어있거나 GUEST로 시작하는지 확인
            try {
              const response = await fetch(`${process.env.NEXT_PUBLIC_WAS_HOST}/api/v1/members/me`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include'
              });
              
              // API 호출이 성공했을 때만 닉네임 확인
              if (response.ok) {
                const data = await response.json();
                
                if (data.data) {
                  const nickname = data.data.nickname;
                  console.log("사용자 닉네임:", nickname);
                  
                  // 닉네임이 없거나 GUEST로 시작하면 닉네임 설정이 필요함
                  if (!nickname || nickname.trim() === '' || nickname.toLowerCase().startsWith('guest')) {
                    console.log("닉네임 설정이 필요함을 감지");
                    localStorage.setItem('needs_nickname', 'true');
                    document.cookie = 'needs_nickname=true; path=/; max-age=3600';
                  }
                }
              } else {
                console.error("사용자 프로필 확인 실패:", response.status);
              }
            } catch (e) {
              console.error("프로필 확인 중 오류:", e);
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
