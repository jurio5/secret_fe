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
        switch (status) {
          case "REGISTER": {
            const provider = searchParams.get("provider");
            const oauthId = searchParams.get("oauthId");

            if (!provider || !oauthId) {
              throw new Error("OAuth 정보가 누락되었습니다.");
            }

            router.push(
              `/join?provider=${encodeURIComponent(
                provider
              )}&oauthId=${encodeURIComponent(oauthId)}`
            );
            break;
          }

          case "SUCCESS": {
            onLoginSuccess?.();
            const roleData = getRoleFromCookie();
            if (roleData?.role === "ADMIN") {
              router.push("/admin");
              break;
            }
            router.push("/");
            break;
          }

          default:
            throw new Error("잘못된 인증 상태입니다.");
        }
      } catch (error) {
        console.error("OAuth2 리다이렉트 처리 중 오류 발생:", error);
        router.push(
          `/login?error=${encodeURIComponent(
            error instanceof Error
              ? error.message
              : "인증 처리 중 오류가 발생했습니다."
          )}`
        );
      }
    };

    handleOAuth2Redirect();
  }, [router, onLoginSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900" />
    </div>
  );
};

export default OAuth2RedirectHandler;
