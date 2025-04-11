"use client";

import { useEffect, Suspense, useState } from "react";
import AppLayout from "@/components/common/AppLayout";

function LobbyContent() {
  const [rooms, setRooms] = useState<any>([]);

  useEffect(() => {
    const wasHost = process.env.NEXT_PUBLIC_WAS_HOST;

    fetch(`${wasHost}/api/v1/rooms`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setRooms(data.data);
      });
  }, []);

  return (
    <div className="text-white">
      <h1>로비 페이지</h1>

      {rooms.map((room: any) => (
        <div key={room.id}>
          <h2>{room.title}</h2>
        </div>
      ))}
    </div>
  );
}

export default function LobbyPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        }
      >
        <LobbyContent />
      </Suspense>
    </AppLayout>
  );
}
