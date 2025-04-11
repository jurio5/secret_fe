"use client";

import { useEffect, Suspense, useState } from "react";
import AppLayout from "@/components/common/AppLayout";
import client from "@/lib/backend/client";
import { components } from "@/lib/backend/apiV1/schema";
import { subscribe, unsubscribe, publish } from "@/lib/backend/stompClient";

function LobbyContent() {
  const [rooms, setRooms] = useState<components["schemas"]["RoomResponse"][]>(
    []
  );

  async function loadRooms() {
    const res = await client.GET("/api/v1/rooms");

    if (res.error) {
      alert(res.error.msg);
      return;
    }

    setRooms(res.data.data);
  }

  useEffect(() => {
    loadRooms();

    subscribe("/topic/lobby", (_) => {
      loadRooms();
    });

    return () => {
      unsubscribe("/topic/lobby");
    };
  }, []);

  return (
    <div className="text-white">
      <h1>로비 페이지</h1>

      {rooms.map((room) => (
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
