"use client";
import { useEffect } from "react";
import OAuth2RedirectHandler from "@/components/auth/OAuth2RedirectHandler";

export default function OAuthCallbackPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (process.env.NODE_ENV === 'development') {
        console.log("OAuth 콜백 페이지 로드됨");
        const status = new URLSearchParams(window.location.search).get("status");
        console.log("상태 파라미터:", status);
      }
    }
  }, []);

  return <OAuth2RedirectHandler />;
}