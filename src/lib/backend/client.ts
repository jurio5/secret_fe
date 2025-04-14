import createClient from "openapi-fetch";

import type { paths } from "@/lib/backend/apiV1/schema";

// 환경 변수 또는 상대 경로 사용
// const baseUrl = process.env.NEXT_PUBLIC_WAS_HOST || "";
  const baseUrl = "https://quizzle.p-e.kr";
const client = createClient<paths>({
  baseUrl: baseUrl,
  credentials: "include",
});

export default client;